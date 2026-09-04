-- USKOČI RU-4 — replay-safe public boundary for AI-confirmed Zadatak edit.
-- The inner candidate remains the single write implementation; authenticated callers use only this wrapper.

create or replace function public.rpc_confirm_need_edit_from_review_v2(
  p_need_id uuid,
  p_expected_revision integer,
  p_conversation_id uuid,
  p_client_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_uid uuid:=auth.uid();
  v_request_id text:=btrim(coalesce(p_client_request_id,''));
  v_conv public.ai_conversations%rowtype;
  v_facts jsonb;
  v_request_hash text;
  v_existing private.need_edit_commands%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_conversation_id is null or p_expected_revision is null or p_expected_revision<1 then
    raise exception 'EDIT_REVIEW_IDENTITY_REQUIRED' using errcode='22004';
  end if;
  if char_length(v_request_id) not between 8 and 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  select * into v_conv from public.ai_conversations where id=p_conversation_id;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' or v_conv.fact_schema_version<>'NEED_FACT_V2' then
    raise exception 'EDIT_CONVERSATION_NOT_CONFIRMABLE' using errcode='P0001';
  end if;
  if v_conv.bound_need_id is distinct from p_need_id then
    raise exception 'EDIT_CONVERSATION_NEED_MISMATCH' using errcode='42501';
  end if;

  select coalesce(jsonb_object_agg(fact_key,fact_value),'{}'::jsonb)
    into v_facts
    from public.ai_structured_facts
   where conversation_id=p_conversation_id
     and superseded_at is null
     and fact_schema_version='NEED_FACT_V2'
     and status='CONFIRMED';

  v_request_hash:=encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'needId',p_need_id,
        'expectedRevision',p_expected_revision,
        'conversationId',p_conversation_id,
        'facts',v_facts
      )::text,'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||E'\n'||v_request_id,4411));
  select * into v_existing
    from private.need_edit_commands c
   where c.requester_account_id=v_uid
     and c.client_request_id=v_request_id
   for update;

  if found then
    if v_existing.need_id is distinct from p_need_id
       or v_existing.from_revision is distinct from p_expected_revision
       or v_existing.request_hash<>v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result||jsonb_build_object('idempotentReplay',true);
  end if;

  if v_conv.status<>'OPEN' then
    raise exception 'EDIT_CONVERSATION_NOT_CONFIRMABLE' using errcode='P0001';
  end if;

  return public.rpc_confirm_need_edit_from_review(
    p_need_id,p_expected_revision,p_conversation_id,v_request_id
  );
end;
$$;

revoke all on function public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)
  from authenticated, anon, public, service_role;
revoke all on function public.rpc_confirm_need_edit_from_review_v2(uuid,integer,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_confirm_need_edit_from_review_v2(uuid,integer,uuid,text)
  to authenticated;

comment on function public.rpc_confirm_need_edit_from_review_v2(uuid,integer,uuid,text) is
  'RU-4 replay-safe owner boundary. Exact replay returns the stored authoritative result after the edit has already completed; changed payload/key reuse fails.';

do $postconditions$
begin
  if has_function_privilege('authenticated','public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)','EXECUTE') then
    raise exception 'RU4_AI_EDIT_REPLAY_POSTCONDITION: inner writer exposed';
  end if;
  if not has_function_privilege('authenticated','public.rpc_confirm_need_edit_from_review_v2(uuid,integer,uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.rpc_confirm_need_edit_from_review_v2(uuid,integer,uuid,text)','EXECUTE') then
    raise exception 'RU4_AI_EDIT_REPLAY_POSTCONDITION: wrapper grants wrong';
  end if;
end
$postconditions$;
