-- USKOCI clean build proof-only migration for AI interview authority.
-- Uses one existing OPEN NEED_INTAKE conversation dynamically. All positive
-- test writes are intentionally rolled back inside a PL/pgSQL subtransaction.

do $proof_seed$
declare
  v_conversation_id uuid;
  v_account_id uuid;
begin
  select c.id, c.account_id
    into v_conversation_id, v_account_id
    from public.ai_conversations c
   where c.purpose = 'NEED_INTAKE'
     and c.status = 'OPEN'
   order by c.created_at
   limit 1;

  if v_conversation_id is null then
    raise exception 'AI_TURN_PROOF_FIXTURE_REQUIRED: no OPEN NEED_INTAKE conversation exists';
  end if;

  perform set_config('uskoci.ai_turn_proof_conversation_id', v_conversation_id::text, true);
  perform set_config('uskoci.ai_turn_proof_account_id', v_account_id::text, true);
end
$proof_seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('uskoci.ai_turn_proof_account_id', true), true);
select set_config('request.jwt.claims', '', true);

do $authenticated_denial$
declare
  v_conversation_id uuid := current_setting('uskoci.ai_turn_proof_conversation_id', true)::uuid;
  v_account_id uuid := current_setting('uskoci.ai_turn_proof_account_id', true)::uuid;
  v_message_denied boolean := false;
  v_rpc_denied boolean := false;
begin
  begin
    insert into public.ai_messages(account_id, conversation_id, role, body)
    values (v_account_id, v_conversation_id, 'USER', 'USKOCI_AI_PROOF_DIRECT_WRITE_MUST_FAIL');
  exception when insufficient_privilege then
    v_message_denied := true;
  end;

  if not v_message_denied then
    raise exception 'AI_TURN_PROOF_FAILED: authenticated direct ai_messages INSERT was allowed';
  end if;

  begin
    perform public.rpc_ai_apply_interview_turn_service(
      v_account_id,
      v_conversation_id,
      'USKOCI_AI_PROOF_USER_DENIED',
      'USKOCI AI proof assistant denied',
      'ALLOW',
      '[]'::jsonb
    );
  exception when insufficient_privilege then
    v_rpc_denied := true;
  end;

  if not v_rpc_denied then
    raise exception 'AI_TURN_PROOF_FAILED: authenticated executed service-only AI turn RPC';
  end if;
end
$authenticated_denial$;

reset role;
set local role service_role;

do $service_atomic_proof$
declare
  v_conversation_id uuid := current_setting('uskoci.ai_turn_proof_conversation_id', true)::uuid;
  v_account_id uuid := current_setting('uskoci.ai_turn_proof_account_id', true)::uuid;
  v_messages_before bigint;
  v_facts_before bigint;
  v_messages_inside bigint;
  v_active_fact_inside bigint;
  v_messages_after bigint;
  v_facts_after bigint;
  v_result jsonb;
begin
  select count(*) into v_messages_before
    from public.ai_messages m
   where m.conversation_id = v_conversation_id;

  select count(*) into v_facts_before
    from public.ai_structured_facts f
   where f.conversation_id = v_conversation_id;

  begin
    v_result := public.rpc_ai_apply_interview_turn_service(
      v_account_id,
      v_conversation_id,
      'USKOCI_AI_PROOF_USER_MUST_ROLLBACK',
      'USKOCI AI proof assistant must rollback',
      'ALLOW',
      jsonb_build_array(jsonb_build_object(
        'key', 'naslov',
        'value', 'USKOCI_AI_PROOF_FACT_MUST_ROLLBACK',
        'confidence', 0.91,
        'evidence', 'USKOCI_AI_PROOF'
      ))
    );

    if coalesce((v_result->>'proposedCount')::integer, -1) <> 1
       or coalesce((v_result->>'authoritative')::boolean, false) is not true then
      raise exception 'AI_TURN_PROOF_FAILED: service writer returned invalid authority payload: %', v_result;
    end if;

    select count(*) into v_messages_inside
      from public.ai_messages m
     where m.conversation_id = v_conversation_id
       and m.body in ('USKOCI_AI_PROOF_USER_MUST_ROLLBACK', 'USKOCI AI proof assistant must rollback');

    if v_messages_inside <> 2 then
      raise exception 'AI_TURN_PROOF_FAILED: expected 2 persisted turn messages inside subtransaction, got %', v_messages_inside;
    end if;

    select count(*) into v_active_fact_inside
      from public.ai_structured_facts f
     where f.conversation_id = v_conversation_id
       and f.fact_key = 'naslov'
       and f.fact_value = to_jsonb('USKOCI_AI_PROOF_FACT_MUST_ROLLBACK'::text)
       and f.status = 'NEEDS_CONFIRMATION'
       and f.source = 'AI_INFERENCE'
       and f.scope = 'NEED_DRAFT'
       and f.superseded_at is null;

    if v_active_fact_inside <> 1 then
      raise exception 'AI_TURN_PROOF_FAILED: atomic fact proposal was not active inside subtransaction';
    end if;

    raise exception using errcode = 'P9002', message = 'USKOCI_EXPECTED_AI_TURN_PROOF_ROLLBACK';
  exception when sqlstate 'P9002' then
    null;
  end;

  select count(*) into v_messages_after
    from public.ai_messages m
   where m.conversation_id = v_conversation_id;
  select count(*) into v_facts_after
    from public.ai_structured_facts f
   where f.conversation_id = v_conversation_id;

  if v_messages_after <> v_messages_before then
    raise exception 'AI_TURN_PROOF_FAILED: test messages survived rollback';
  end if;
  if v_facts_after <> v_facts_before then
    raise exception 'AI_TURN_PROOF_FAILED: test fact/supersession survived rollback';
  end if;
  if exists (
    select 1 from public.ai_messages m
     where m.body like 'USKOCI_AI_PROOF_%'
  ) or exists (
    select 1 from public.ai_structured_facts f
     where f.fact_value = to_jsonb('USKOCI_AI_PROOF_FACT_MUST_ROLLBACK'::text)
  ) then
    raise exception 'AI_TURN_PROOF_FAILED: proof residue detected';
  end if;
end
$service_atomic_proof$;

reset role;

comment on table public.ai_messages is
  'AUTHENTICATED_RUNTIME_PROVEN: own-read only; direct authenticated INSERT denied. SERVICE_RUNTIME_PROVEN: atomic USER+ASSISTANT turn persisted inside rollback-only proof with zero residue.';

comment on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) is
  'SERVICE_RUNTIME_PROVEN: authenticated EXECUTE denied; service_role atomically persisted two messages plus one AI_INFERENCE NEEDS_CONFIRMATION fact, then proof subtransaction rolled back with zero retained rows.';