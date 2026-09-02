-- RU-1 — AI → HUMAN CONFIRMATION → CANONICAL FACT AUTHORITY
--
-- Canonical invariant:
--   AI may propose a replacement, but an already HUMAN_CONFIRMED fact remains
--   canonical until the user explicitly confirms/corrects the replacement.
--
-- This repair also closes direct authenticated writes to AI persistence tables.
-- The mobile client keeps SELECT access and uses RPC/Edge command boundaries.

-- -----------------------------------------------------------------------------
-- A. Close direct authenticated mutation of AI persistence.
-- -----------------------------------------------------------------------------
revoke insert, update, delete on public.ai_conversations from authenticated;
revoke insert, update, delete on public.ai_structured_facts from authenticated;
revoke insert, update, delete on public.ai_action_proposals from authenticated;

-- RLS now documents the same read-only client boundary instead of leaving stale
-- FOR ALL policies behind a table-grant denial.
drop policy if exists ai_conversations_own on public.ai_conversations;
create policy ai_conversations_select_own
  on public.ai_conversations
  for select to authenticated
  using (account_id = auth.uid());

drop policy if exists ai_facts_own on public.ai_structured_facts;
create policy ai_facts_select_own
  on public.ai_structured_facts
  for select to authenticated
  using (account_id = auth.uid());

drop policy if exists ai_proposals_own on public.ai_action_proposals;
create policy ai_proposals_select_own
  on public.ai_action_proposals
  for select to authenticated
  using (account_id = auth.uid());

-- -----------------------------------------------------------------------------
-- B. Separate canonical CONFIRMED truth from pending AI proposals.
-- -----------------------------------------------------------------------------
drop index if exists public.ai_structured_facts_one_live_per_key;

create unique index if not exists ai_structured_facts_one_live_confirmed_per_key
  on public.ai_structured_facts (conversation_id, fact_key)
  where superseded_at is null and status = 'CONFIRMED';

create unique index if not exists ai_structured_facts_one_live_pending_per_key
  on public.ai_structured_facts (conversation_id, fact_key)
  where superseded_at is null and status <> 'CONFIRMED';

-- -----------------------------------------------------------------------------
-- C. Legacy propose RPC becomes internal-only and no longer supersedes canonical
--    CONFIRMED truth. Edge runtime uses rpc_ai_apply_interview_turn_service.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_ai_propose_fact(
  p_conversation_id uuid,
  p_fact_key text,
  p_fact_value jsonb,
  p_source text,
  p_scope text,
  p_confidence numeric default null,
  p_evidence text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  uid uuid := auth.uid();
  v_conv public.ai_conversations%rowtype;
  v_new uuid := extensions.gen_random_uuid();
  v_previous_ids uuid[];
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select *
    into v_conv
    from public.ai_conversations
   where id = p_conversation_id
   for update;

  if not found then
    raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_conv.account_id <> uid then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;
  if v_conv.status <> 'OPEN' then
    raise exception 'CONVERSATION_CLOSED' using errcode = 'P0001';
  end if;
  if p_source not in ('EXPLICIT_USER_ANSWER','CONFIRMED_PROFILE','AI_INFERENCE','SYSTEM_DERIVED') then
    raise exception 'BAD_SOURCE' using errcode = 'P0001';
  end if;
  if p_source = 'AI_INFERENCE' and coalesce(btrim(p_evidence), '') = '' then
    raise exception 'EVIDENCE_REQUIRED' using errcode = 'P0001';
  end if;

  -- A newer proposal may replace an older pending proposal, but it must never
  -- displace a live CONFIRMED fact before human confirmation.
  perform set_config('uskoci.ai_mutation', 'PROPOSE_PENDING', true);

  with superseded as (
    update public.ai_structured_facts
       set superseded_at = statement_timestamp(),
           superseded_by = null
     where conversation_id = p_conversation_id
       and fact_key = p_fact_key
       and superseded_at is null
       and status <> 'CONFIRMED'
     returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[])
    into v_previous_ids
    from superseded;

  insert into public.ai_structured_facts (
    id,
    account_id,
    conversation_id,
    subject_need_id,
    fact_key,
    fact_value,
    status,
    source,
    scope,
    confidence,
    evidence_excerpt
  ) values (
    v_new,
    uid,
    p_conversation_id,
    v_conv.bound_need_id,
    p_fact_key,
    p_fact_value,
    'NEEDS_CONFIRMATION',
    p_source,
    p_scope,
    p_confidence,
    p_evidence
  );

  if cardinality(v_previous_ids) > 0 then
    update public.ai_structured_facts
       set superseded_by = v_new
     where id = any(v_previous_ids);
  end if;

  return v_new;
end;
$function$;

revoke all on function public.rpc_ai_propose_fact(uuid,text,jsonb,text,text,numeric,text)
  from public, anon, authenticated, service_role;

comment on function public.rpc_ai_propose_fact(uuid,text,jsonb,text,text,numeric,text) is
  'RU-1 internal compatibility function. External authenticated/service callers are revoked; AI runtime uses rpc_ai_apply_interview_turn_service.';

-- -----------------------------------------------------------------------------
-- D. Service turn persists one pending proposal per key without replacing the
--    canonical CONFIRMED fact.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_ai_apply_interview_turn_service(
  p_account_id uuid,
  p_conversation_id uuid,
  p_user_message text,
  p_assistant_message text,
  p_safety text,
  p_proposals jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_conv public.ai_conversations%rowtype;
  v_item jsonb;
  v_key text;
  v_value text;
  v_evidence text;
  v_confidence numeric;
  v_fact_id uuid;
  v_fact_ids uuid[] := '{}'::uuid[];
  v_previous_ids uuid[];
  v_user_message_id uuid;
  v_assistant_message_id uuid;
  v_proposals jsonb := coalesce(p_proposals, '[]'::jsonb);
begin
  if p_account_id is null or p_conversation_id is null then
    raise exception 'TURN_IDENTITY_REQUIRED' using errcode = '22004';
  end if;
  if coalesce(char_length(btrim(p_user_message)), 0) < 1
     or char_length(btrim(p_user_message)) > 4000 then
    raise exception 'USER_MESSAGE_INVALID' using errcode = '22023';
  end if;
  if coalesce(char_length(btrim(p_assistant_message)), 0) < 1
     or char_length(btrim(p_assistant_message)) > 1000 then
    raise exception 'ASSISTANT_MESSAGE_INVALID' using errcode = '22023';
  end if;
  if p_safety not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then
    raise exception 'SAFETY_DECISION_INVALID' using errcode = '22023';
  end if;
  if jsonb_typeof(v_proposals) <> 'array' or jsonb_array_length(v_proposals) > 10 then
    raise exception 'PROPOSALS_INVALID' using errcode = '22023';
  end if;

  select *
    into v_conv
    from public.ai_conversations
   where id = p_conversation_id
   for update;

  if not found then
    raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_conv.account_id <> p_account_id then
    raise exception 'CONVERSATION_OWNER_MISMATCH' using errcode = '42501';
  end if;
  if v_conv.purpose <> 'NEED_INTAKE' then
    raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode = 'P0001';
  end if;
  if v_conv.status <> 'OPEN' then
    raise exception 'CONVERSATION_CLOSED' using errcode = 'P0001';
  end if;

  -- Explicit internal authority token. The service-role caller must not depend
  -- on auth.uid() for trigger ownership checks.
  perform set_config('uskoci.ai_mutation', 'SERVICE_TURN', true);

  for v_item in
    select value from jsonb_array_elements(v_proposals)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'PROPOSAL_OBJECT_REQUIRED' using errcode = '22023';
    end if;

    v_key := nullif(btrim(v_item ->> 'key'), '');
    v_value := nullif(btrim(v_item ->> 'value'), '');
    v_evidence := nullif(btrim(v_item ->> 'evidence'), '');

    if v_key is null or v_key not in (
      'naslov','opis','kategorija','datum','vreme','polaziste','odrediste',
      'osoba','vozilo','uslovi','mode','execution_location_mode'
    ) then
      raise exception 'FACT_KEY_INVALID' using errcode = '22023', detail = coalesce(v_key, 'NULL');
    end if;
    if v_value is null or char_length(v_value) > 2000 then
      raise exception 'FACT_VALUE_INVALID' using errcode = '22023', detail = v_key;
    end if;
    if v_evidence is null or char_length(v_evidence) > 500 then
      raise exception 'FACT_EVIDENCE_INVALID' using errcode = '22023', detail = v_key;
    end if;

    begin
      v_confidence := (v_item ->> 'confidence')::numeric;
    exception when invalid_text_representation then
      raise exception 'FACT_CONFIDENCE_INVALID' using errcode = '22023', detail = v_key;
    end;

    if v_confidence is null or v_confidence < 0 or v_confidence > 1 then
      raise exception 'FACT_CONFIDENCE_INVALID' using errcode = '22023', detail = v_key;
    end if;

    v_fact_id := extensions.gen_random_uuid();

    -- Supersede only older PENDING material for this key. CONFIRMED canonical
    -- truth survives until rpc_ai_confirm_fact or rpc_ai_correct_fact commits a
    -- human-authorized replacement.
    with superseded as (
      update public.ai_structured_facts
         set superseded_at = statement_timestamp(),
             superseded_by = null
       where conversation_id = p_conversation_id
         and fact_key = v_key
         and superseded_at is null
         and status <> 'CONFIRMED'
       returning id
    )
    select coalesce(array_agg(id), '{}'::uuid[])
      into v_previous_ids
      from superseded;

    insert into public.ai_structured_facts (
      id,
      account_id,
      conversation_id,
      subject_need_id,
      fact_key,
      fact_value,
      status,
      source,
      scope,
      confidence,
      evidence_excerpt
    ) values (
      v_fact_id,
      p_account_id,
      p_conversation_id,
      v_conv.bound_need_id,
      v_key,
      to_jsonb(v_value),
      'NEEDS_CONFIRMATION',
      'AI_INFERENCE',
      'NEED_DRAFT',
      v_confidence,
      v_evidence
    );

    if cardinality(v_previous_ids) > 0 then
      update public.ai_structured_facts
         set superseded_by = v_fact_id
       where id = any(v_previous_ids);
    end if;

    v_fact_ids := array_append(v_fact_ids, v_fact_id);
  end loop;

  insert into public.ai_messages (
    account_id,
    conversation_id,
    role,
    body
  ) values (
    p_account_id,
    p_conversation_id,
    'USER',
    btrim(p_user_message)
  ) returning id into v_user_message_id;

  insert into public.ai_messages (
    account_id,
    conversation_id,
    role,
    body,
    safety,
    proposed_fact_ids
  ) values (
    p_account_id,
    p_conversation_id,
    'ASSISTANT',
    btrim(p_assistant_message),
    p_safety,
    v_fact_ids
  ) returning id into v_assistant_message_id;

  return jsonb_build_object(
    'conversationId', p_conversation_id,
    'userMessageId', v_user_message_id,
    'assistantMessageId', v_assistant_message_id,
    'proposedCount', cardinality(v_fact_ids),
    'proposedFactIds', to_jsonb(v_fact_ids),
    'safety', p_safety,
    'authoritative', true
  );
end;
$function$;

revoke all on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)
  to service_role;

-- -----------------------------------------------------------------------------
-- E. Human confirmation is the exact canonical cutover point.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_ai_confirm_fact(p_fact_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_fact public.ai_structured_facts%rowtype;
  v_conv public.ai_conversations%rowtype;
begin
  if v_uid is null then
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
  if v_fact.account_id <> v_uid then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;
  if v_fact.superseded_at is not null then
    raise exception 'SUPERSEDED' using errcode = 'P0001';
  end if;

  select *
    into v_conv
    from public.ai_conversations
   where id = v_fact.conversation_id
   for update;

  if not found or v_conv.account_id <> v_uid then
    raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_conv.status <> 'OPEN' then
    raise exception 'CONVERSATION_CLOSED' using errcode = 'P0001';
  end if;

  if v_fact.status = 'CONFIRMED' then
    if v_fact.confirmed_at is null or v_fact.confirmed_by_user_id is null then
      raise exception 'CONFIRMED_PROVENANCE_INVALID' using errcode = 'P0001';
    end if;
    return p_fact_id;
  end if;

  if v_fact.status not in ('NEEDS_CONFIRMATION','INFERRED','UNKNOWN') then
    raise exception 'FACT_STATE_NOT_CONFIRMABLE' using errcode = 'P0001',
      detail = v_fact.status;
  end if;

  perform set_config('uskoci.ai_mutation', 'HUMAN_CONFIRM', true);

  -- Only now does the old canonical fact become superseded.
  update public.ai_structured_facts
     set superseded_at = statement_timestamp(),
         superseded_by = p_fact_id
   where conversation_id = v_fact.conversation_id
     and fact_key = v_fact.fact_key
     and id <> p_fact_id
     and superseded_at is null
     and status = 'CONFIRMED';

  update public.ai_structured_facts
     set status = 'CONFIRMED',
         confirmed_at = statement_timestamp(),
         confirmed_by_user_id = v_uid
   where id = p_fact_id;

  return p_fact_id;
end;
$function$;

revoke all on function public.rpc_ai_confirm_fact(uuid)
  from public, anon;
grant execute on function public.rpc_ai_confirm_fact(uuid)
  to authenticated;

comment on function public.rpc_ai_confirm_fact(uuid) is
  'RU-1: human confirmation is the atomic canonical cutover; prior CONFIRMED fact remains live until this command succeeds.';

comment on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) is
  'RU-1: service-only AI turn persistence; replaces older pending proposals but never supersedes HUMAN_CONFIRMED canonical truth.';

-- -----------------------------------------------------------------------------
-- F. Deployment assertions.
-- -----------------------------------------------------------------------------
do $ru1_assert$
begin
  if has_table_privilege('authenticated', 'public.ai_conversations', 'INSERT')
     or has_table_privilege('authenticated', 'public.ai_conversations', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ai_conversations', 'DELETE') then
    raise exception 'RU1_AI_CONVERSATION_DIRECT_WRITE_OPEN';
  end if;

  if has_table_privilege('authenticated', 'public.ai_structured_facts', 'INSERT')
     or has_table_privilege('authenticated', 'public.ai_structured_facts', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ai_structured_facts', 'DELETE') then
    raise exception 'RU1_AI_FACT_DIRECT_WRITE_OPEN';
  end if;

  if has_table_privilege('authenticated', 'public.ai_action_proposals', 'INSERT')
     or has_table_privilege('authenticated', 'public.ai_action_proposals', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ai_action_proposals', 'DELETE') then
    raise exception 'RU1_AI_PROPOSAL_DIRECT_WRITE_OPEN';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.rpc_ai_propose_fact(uuid,text,jsonb,text,text,numeric,text)',
    'EXECUTE'
  ) then
    raise exception 'RU1_AUTHENTICATED_PROPOSE_FACT_STILL_EXECUTABLE';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.rpc_ai_confirm_fact(uuid)',
    'EXECUTE'
  ) then
    raise exception 'RU1_HUMAN_CONFIRM_NOT_EXECUTABLE';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'RU1_SERVICE_TURN_NOT_EXECUTABLE';
  end if;
end
$ru1_assert$;
