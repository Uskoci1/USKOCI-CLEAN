-- USKOČI PKG-003 / GAP-0015
-- SOURCE CANDIDATE ONLY. This file is intentionally outside supabase/migrations.
-- It must not be applied to canonical DEV until it is promoted as a forward-only
-- migration and the package/disposable-schema gates authorize that promotion.
--
-- Purpose: create the smallest owner-authenticated manual fact bootstrap inside
-- the existing NEED_FACT_V2 conversation domain. This is NOT a second Need writer,
-- NOT a publisher, NOT an AI/provider fallback and NOT permission to bypass the
-- existing location/media/review/publication authorities.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Fail closed if the established V2 authority is not present.
do $pkg003_preflight$
begin
  if to_regclass('public.ai_conversations') is null
     or to_regclass('public.ai_structured_facts') is null
     or to_regclass('private.need_fact_registry') is null
     or to_regprocedure('private.validate_need_v2_fact(text,jsonb)') is null
     or to_regprocedure('public.rpc_ai_need_review_v2(uuid)') is null
     or to_regprocedure('public.rpc_save_need_draft_from_review(uuid,uuid,text)') is null
     or to_regprocedure('public.rpc_save_need_location_review(uuid,text,jsonb,boolean)') is null then
    raise exception 'PKG003_PREDECESSOR_MISMATCH: canonical NEED_FACT_V2 authority is incomplete'
      using errcode = '55000';
  end if;
end
$pkg003_preflight$;

create table if not exists private.manual_need_fact_commands (
  account_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  request_hash text not null,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  fact_key text not null,
  fact_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (account_id, client_request_id),
  check (char_length(request_hash) = 64),
  check (jsonb_typeof(result) = 'object')
);

alter table private.manual_need_fact_commands enable row level security;
alter table private.manual_need_fact_commands force row level security;
revoke all on table private.manual_need_fact_commands from public, anon, authenticated, service_role;

comment on table private.manual_need_fact_commands is
  'PKG-003 idempotency ledger for owner-authenticated NEED_FACT_V2 manual bootstrap commands; never a Need/publication writer.';

create or replace function public.rpc_set_manual_need_fact_v2(
  p_conversation_id uuid,
  p_client_request_id uuid,
  p_fact_key text,
  p_value jsonb,
  p_display_value text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_conv public.ai_conversations%rowtype;
  v_existing private.manual_need_fact_commands%rowtype;
  v_current public.ai_structured_facts%rowtype;
  v_active_count integer;
  v_value_type text;
  v_display text := nullif(btrim(p_display_value), '');
  v_request_hash text;
  v_fact_id uuid;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_conversation_id is null or p_client_request_id is null then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode = '22023';
  end if;
  if v_display is null or char_length(v_display) > 1000 then
    raise exception 'V2_FACT_DISPLAY_INVALID' using errcode = '22023';
  end if;

  -- Manual bootstrap deliberately excludes every fact with an existing dedicated
  -- authority. Location must remain bound to the location review; media to media.
  if p_fact_key in ('need.task_country_code','need.task_geography','need.exact_address','need.access_notes','need.resolved_location') then
    raise exception 'MANUAL_FACT_USE_LOCATION_EDITOR' using errcode = '42501';
  end if;
  if p_fact_key = 'need.public_photo_paths' then
    raise exception 'MANUAL_FACT_USE_MEDIA_EDITOR' using errcode = '42501';
  end if;
  if p_fact_key not in (
    'need.title','need.description','need.category','need.price_mode','need.price_rsd',
    'need.schedule_kind','need.starts_at','need.ends_at','need.people_needed',
    'need.required_skills','need.required_tools','need.required_vehicles','need.required_licenses',
    'need.minimum_experience_years','need.verified_identity_required','need.critical_conditions'
  ) then
    raise exception 'V2_FACT_KEY_INVALID' using errcode = '22023';
  end if;
  if p_fact_key = 'need.verified_identity_required' and p_value is distinct from 'false'::jsonb then
    raise exception 'VERIFIED_IDENTITY_UNAVAILABLE' using errcode = '42501';
  end if;

  perform private.validate_need_v2_fact(p_fact_key, p_value);

  perform pg_advisory_xact_lock(hashtextextended('pkg003-manual-need:' || v_uid::text, 0));

  select * into v_conv
    from public.ai_conversations
   where id = p_conversation_id
   for update;
  if not found then
    raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_conv.account_id <> v_uid then
    raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_conv.purpose <> 'NEED_INTAKE'
     or v_conv.fact_schema_version <> 'NEED_FACT_V2'
     or v_conv.status <> 'OPEN'
     or v_conv.need_edit_base_fingerprint is not null then
    raise exception 'CONVERSATION_NOT_EDITABLE' using errcode = 'P0001';
  end if;

  select value_type into v_value_type
    from private.need_fact_registry
   where fact_key = p_fact_key
     and schema_version = 'NEED_FACT_V2';
  if not found then
    raise exception 'V2_FACT_KEY_INVALID' using errcode = '22023';
  end if;

  v_request_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'conversationId', p_conversation_id,
    'factKey', p_fact_key,
    'value', p_value,
    'displayValue', v_display
  )::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_existing
    from private.manual_need_fact_commands
   where account_id = v_uid
     and client_request_id = p_client_request_id
   for update;
  if found then
    if v_existing.request_hash <> v_request_hash
       or v_existing.conversation_id <> p_conversation_id
       or v_existing.fact_key <> p_fact_key then
      raise exception 'CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT' using errcode = '22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select count(*) into v_active_count
    from public.ai_structured_facts
   where conversation_id = p_conversation_id
     and fact_key = p_fact_key
     and superseded_at is null;
  if v_active_count > 1 then
    raise exception 'FACT_ACTIVE_DUPLICATE' using errcode = 'P0001';
  end if;

  select * into v_current
    from public.ai_structured_facts
   where conversation_id = p_conversation_id
     and fact_key = p_fact_key
     and superseded_at is null
   for update;

  if found
     and v_current.account_id = v_uid
     and v_current.fact_schema_version = 'NEED_FACT_V2'
     and v_current.scope = 'NEED_DRAFT'
     and v_current.status = 'CONFIRMED'
     and v_current.source = 'EXPLICIT_USER_ANSWER'
     and v_current.confirmed_by_user_id = v_uid
     and v_current.confirmed_at is not null
     and v_current.fact_value = p_value
     and v_current.display_value = v_display then
    v_fact_id := v_current.id;
  else
    v_fact_id := extensions.gen_random_uuid();

    if found then
      if v_current.account_id <> v_uid
         or v_current.fact_schema_version <> 'NEED_FACT_V2'
         or v_current.scope <> 'NEED_DRAFT' then
        raise exception 'FACT_NOT_EDITABLE' using errcode = 'P0001';
      end if;
      update public.ai_structured_facts
         set superseded_at = statement_timestamp(),
             superseded_by = v_fact_id
       where id = v_current.id;
    end if;

    insert into public.ai_structured_facts(
      id, account_id, conversation_id, subject_need_id, fact_key, fact_value,
      status, source, scope, confidence, evidence_excerpt,
      confirmed_by_user_id, confirmed_at, fact_schema_version, value_type, display_value
    ) values (
      v_fact_id, v_uid, v_conv.id, v_conv.bound_need_id, p_fact_key, p_value,
      'CONFIRMED', 'EXPLICIT_USER_ANSWER', 'NEED_DRAFT', 1, null,
      v_uid, statement_timestamp(), 'NEED_FACT_V2', v_value_type, v_display
    );
  end if;

  v_result := jsonb_build_object(
    'accountId', v_uid,
    'conversationId', p_conversation_id,
    'clientRequestId', p_client_request_id,
    'factId', v_fact_id,
    'factKey', p_fact_key,
    'authoritative', true,
    'idempotentReplay', false
  );

  insert into private.manual_need_fact_commands(
    account_id, client_request_id, request_hash, conversation_id, fact_key, fact_id, result
  ) values (
    v_uid, p_client_request_id, v_request_hash, p_conversation_id, p_fact_key, v_fact_id, v_result
  );

  return v_result;
end
$function$;

revoke all on function public.rpc_set_manual_need_fact_v2(uuid,uuid,text,jsonb,text)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_set_manual_need_fact_v2(uuid,uuid,text,jsonb,text)
  to authenticated;

comment on function public.rpc_set_manual_need_fact_v2(uuid,uuid,text,jsonb,text) is
  'PKG-003 owner-only typed manual NEED_FACT_V2 fact bootstrap. Uses the canonical conversation/review chain; never dispatches AI, writes a Need, edits location/media or publishes.';

do $pkg003_postcondition$
begin
  if to_regprocedure('public.rpc_set_manual_need_fact_v2(uuid,uuid,text,jsonb,text)') is null then
    raise exception 'PKG003_POSTCONDITION_FAILED: manual writer missing';
  end if;
  if not has_function_privilege('authenticated', 'public.rpc_set_manual_need_fact_v2(uuid,uuid,text,jsonb,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rpc_set_manual_need_fact_v2(uuid,uuid,text,jsonb,text)', 'EXECUTE') then
    raise exception 'PKG003_POSTCONDITION_FAILED: manual writer ACL mismatch';
  end if;
  if has_table_privilege('authenticated', 'private.manual_need_fact_commands', 'SELECT')
     or has_table_privilege('authenticated', 'private.manual_need_fact_commands', 'INSERT') then
    raise exception 'PKG003_POSTCONDITION_FAILED: command ledger leaked to client role';
  end if;
end
$pkg003_postcondition$;

commit;
