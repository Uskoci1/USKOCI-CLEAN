-- PRE-P4 Repair 3: provenance-correct AI confirmation and legitimate-writer closure.
--
-- source records where a fact originated. Human confirmation is represented by
-- status plus confirmed_* metadata and must never rewrite that origin.
-- Direct client UPDATE/DELETE is removed; canonical SECURITY DEFINER RPCs remain
-- the only writers after INSERT was already revoked.

do $precondition$
declare
  v_rpc text := pg_get_functiondef(
    'public.rpc_ai_confirm_fact(uuid)'::regprocedure
  );
  v_guard text := pg_get_functiondef(
    'private.guard_ai_fact_write()'::regprocedure
  );
begin
  if position(
    'source = ''EXPLICIT_USER_ANSWER''' in v_rpc
  ) = 0 then
    raise exception 'STALE_AI_CONFIRM_PREDECESSOR'
      using detail = 'Expected the proven source-rewriting predecessor.';
  end if;

  if position('FACT_SOURCE_IMMUTABLE' in v_guard) = 0 then
    raise exception 'STALE_AI_FACT_GUARD'
      using detail = 'Expected the provenance-preserving source guard.';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.ai_structured_facts',
    'update'
  ) or not has_table_privilege(
    'authenticated',
    'public.ai_structured_facts',
    'delete'
  ) then
    raise exception 'STALE_AI_FACT_GRANTS'
      using detail = 'Expected the proven direct UPDATE/DELETE predecessor.';
  end if;
end
$precondition$;

create or replace function public.rpc_ai_confirm_fact(p_fact_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  uid uuid := auth.uid();
  v_fact public.ai_structured_facts%rowtype;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select *
    into v_fact
    from public.ai_structured_facts
   where id = p_fact_id
   for update;

  if not found then
    raise exception 'FACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_fact.account_id <> uid then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;

  if v_fact.superseded_at is not null then
    raise exception 'SUPERSEDED'
      using errcode = 'P0001',
            hint = 'Taj podatak je u medjuvremenu izmenjen.';
  end if;

  if v_fact.status = 'CONFIRMED' then
    return p_fact_id;
  end if;

  update public.ai_structured_facts
     set status = 'CONFIRMED'
   where id = p_fact_id;

  return p_fact_id;
end
$function$;

revoke all on function public.rpc_ai_confirm_fact(uuid) from public, anon;
grant execute on function public.rpc_ai_confirm_fact(uuid) to authenticated;

revoke update, delete on table public.ai_structured_facts
  from public, anon, authenticated;

comment on function public.rpc_ai_confirm_fact(uuid) is
  'Owner-only, replay-idempotent human confirmation. Preserves immutable source provenance; private.guard_ai_fact_write derives confirmed_by_user_id and confirmed_at.';

do $proof_seed$
declare
  v_owner_id uuid;
  v_other_id uuid;
  v_conversation_id uuid;
  v_fact_id uuid;
  v_conversation_count integer;
  v_fact_count integer;
begin
  select count(*) into v_conversation_count
    from public.ai_conversations;
  select count(*) into v_fact_count
    from public.ai_structured_facts;

  select u.id
    into v_owner_id
    from auth.users u
   order by u.created_at, u.id
   limit 1;

  if v_owner_id is null then
    perform set_config('uskoci.pre_p4_ai_proof_enabled', 'false', true);
    return;
  end if;

  select u.id
    into v_other_id
    from auth.users u
   where u.id <> v_owner_id
   order by u.created_at, u.id
   limit 1;

  if v_other_id is null then
    loop
      v_other_id := gen_random_uuid();
      exit when not exists (
        select 1 from auth.users u where u.id = v_other_id
      );
    end loop;
  end if;

  insert into public.ai_conversations (account_id, purpose)
  values (v_owner_id, 'NEED_INTAKE')
  returning id into v_conversation_id;

  insert into public.ai_structured_facts (
    account_id,
    conversation_id,
    fact_key,
    fact_value,
    status,
    source,
    scope,
    confidence,
    evidence_excerpt
  )
  values (
    v_owner_id,
    v_conversation_id,
    '__pre_p4_provenance_probe__',
    jsonb_build_object('value', 'probe'),
    'NEEDS_CONFIRMATION',
    'AI_INFERENCE',
    'NEED_DRAFT',
    0.5,
    'PRE-P4 transactional provenance probe'
  )
  returning id into v_fact_id;

  perform set_config('uskoci.pre_p4_ai_proof_enabled', 'true', true);
  perform set_config('uskoci.pre_p4_ai_owner_id', v_owner_id::text, true);
  perform set_config('uskoci.pre_p4_ai_other_id', v_other_id::text, true);
  perform set_config(
    'uskoci.pre_p4_ai_conversation_id',
    v_conversation_id::text,
    true
  );
  perform set_config('uskoci.pre_p4_ai_fact_id', v_fact_id::text, true);
  perform set_config(
    'uskoci.pre_p4_ai_conversation_count',
    v_conversation_count::text,
    true
  );
  perform set_config(
    'uskoci.pre_p4_ai_fact_count',
    v_fact_count::text,
    true
  );
end
$proof_seed$;

set local role authenticated;

do $first_confirmation$
declare
  v_enabled boolean := coalesce(
    current_setting('uskoci.pre_p4_ai_proof_enabled', true),
    'false'
  )::boolean;
  v_owner_id uuid;
  v_fact_id uuid;
  v_status text;
  v_source text;
  v_evidence text;
  v_confirmed_by uuid;
  v_confirmed_at timestamptz;
begin
  if not v_enabled then
    return;
  end if;

  v_owner_id :=
    current_setting('uskoci.pre_p4_ai_owner_id', true)::uuid;
  v_fact_id :=
    current_setting('uskoci.pre_p4_ai_fact_id', true)::uuid;

  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  perform set_config('request.jwt.claims', '', true);
  perform public.rpc_ai_confirm_fact(v_fact_id);

  select
    f.status,
    f.source,
    f.evidence_excerpt,
    f.confirmed_by_user_id,
    f.confirmed_at
  into
    v_status,
    v_source,
    v_evidence,
    v_confirmed_by,
    v_confirmed_at
  from public.ai_structured_facts f
  where f.id = v_fact_id;

  if v_status <> 'CONFIRMED'
     or v_source <> 'AI_INFERENCE'
     or v_evidence <> 'PRE-P4 transactional provenance probe'
     or v_confirmed_by is distinct from v_owner_id
     or v_confirmed_at is null then
    raise exception 'PRE_P4_AI_CONFIRM_PROVENANCE_PROOF_FAILED';
  end if;

  perform set_config(
    'uskoci.pre_p4_ai_confirmed_at',
    v_confirmed_at::text,
    true
  );
end
$first_confirmation$;

select pg_sleep(0.01)
where coalesce(
  current_setting('uskoci.pre_p4_ai_proof_enabled', true),
  'false'
)::boolean;

do $replay_and_denial_proof$
declare
  v_enabled boolean := coalesce(
    current_setting('uskoci.pre_p4_ai_proof_enabled', true),
    'false'
  )::boolean;
  v_owner_id uuid;
  v_other_id uuid;
  v_fact_id uuid;
  v_initial_confirmed_at timestamptz;
  v_replayed_confirmed_at timestamptz;
  v_source text;
  v_denied boolean;
begin
  if not v_enabled then
    return;
  end if;

  v_owner_id :=
    current_setting('uskoci.pre_p4_ai_owner_id', true)::uuid;
  v_other_id :=
    current_setting('uskoci.pre_p4_ai_other_id', true)::uuid;
  v_fact_id :=
    current_setting('uskoci.pre_p4_ai_fact_id', true)::uuid;
  v_initial_confirmed_at :=
    current_setting('uskoci.pre_p4_ai_confirmed_at', true)::timestamptz;

  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  perform public.rpc_ai_confirm_fact(v_fact_id);

  select f.confirmed_at, f.source
    into v_replayed_confirmed_at, v_source
    from public.ai_structured_facts f
   where f.id = v_fact_id;

  if v_replayed_confirmed_at is distinct from v_initial_confirmed_at
     or v_source <> 'AI_INFERENCE' then
    raise exception 'PRE_P4_AI_CONFIRM_REPLAY_MUTATED_FACT';
  end if;

  v_denied := false;
  begin
    update public.ai_structured_facts
       set source = 'EXPLICIT_USER_ANSWER'
     where id = v_fact_id;
  exception
    when insufficient_privilege then
      v_denied := true;
  end;

  if not v_denied then
    raise exception 'PRE_P4_AI_DIRECT_UPDATE_WAS_ALLOWED';
  end if;

  v_denied := false;
  begin
    delete from public.ai_structured_facts
     where id = v_fact_id;
  exception
    when insufficient_privilege then
      v_denied := true;
  end;

  if not v_denied then
    raise exception 'PRE_P4_AI_DIRECT_DELETE_WAS_ALLOWED';
  end if;

  perform set_config('request.jwt.claim.sub', v_other_id::text, true);
  v_denied := false;

  begin
    perform public.rpc_ai_confirm_fact(v_fact_id);
  exception
    when insufficient_privilege then
      if sqlerrm <> 'NOT_OWNER' then
        raise;
      end if;
      v_denied := true;
  end;

  if not v_denied then
    raise exception 'PRE_P4_AI_WRONG_OWNER_WAS_ALLOWED';
  end if;
end
$replay_and_denial_proof$;

reset role;

do $proof_cleanup$
declare
  v_enabled boolean := coalesce(
    current_setting('uskoci.pre_p4_ai_proof_enabled', true),
    'false'
  )::boolean;
  v_conversation_id uuid;
  v_expected_conversations integer;
  v_expected_facts integer;
  v_actual integer;
begin
  if not v_enabled then
    return;
  end if;

  v_conversation_id :=
    current_setting('uskoci.pre_p4_ai_conversation_id', true)::uuid;
  v_expected_conversations :=
    current_setting('uskoci.pre_p4_ai_conversation_count', true)::integer;
  v_expected_facts :=
    current_setting('uskoci.pre_p4_ai_fact_count', true)::integer;

  delete from public.ai_conversations
   where id = v_conversation_id;

  select count(*) into v_actual from public.ai_conversations;
  if v_actual <> v_expected_conversations then
    raise exception
      'PRE_P4_AI_PROOF_CLEANUP_CONVERSATION_MISMATCH expected %, got %',
      v_expected_conversations,
      v_actual;
  end if;

  select count(*) into v_actual from public.ai_structured_facts;
  if v_actual <> v_expected_facts then
    raise exception
      'PRE_P4_AI_PROOF_CLEANUP_FACT_MISMATCH expected %, got %',
      v_expected_facts,
      v_actual;
  end if;
end
$proof_cleanup$;
