-- USKOCI clean build: persistent AI conversation turns with one server-only writer.
-- Authenticated clients may read only their own messages. AI/user turn persistence
-- and AI_INFERENCE fact proposals are committed atomically by a service-role-only
-- SECURITY DEFINER RPC called from the JWT-protected Edge boundary.

create table public.ai_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  sequence_no bigint generated always as identity unique,
  account_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('USER','ASSISTANT')),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  safety text null check (safety is null or safety in ('ALLOW','CLARIFY','REVIEW','BLOCK')),
  proposed_fact_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default statement_timestamp()
);

create index ai_messages_conversation_sequence_idx
  on public.ai_messages(conversation_id, sequence_no);

alter table public.ai_messages enable row level security;

revoke all privileges on table public.ai_messages from public, anon, authenticated;
grant select on table public.ai_messages to authenticated;

create policy ai_messages_own_read on public.ai_messages
  for select to authenticated
  using (account_id = auth.uid());

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
set search_path to 'pg_catalog'
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
  if jsonb_typeof(v_proposals) <> 'array' then
    raise exception 'PROPOSALS_ARRAY_REQUIRED' using errcode = '22023';
  end if;
  if jsonb_array_length(v_proposals) > 10 then
    raise exception 'TOO_MANY_PROPOSALS' using errcode = '22023';
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

  for v_item in select value from jsonb_array_elements(v_proposals)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'PROPOSAL_OBJECT_REQUIRED' using errcode = '22023';
    end if;

    v_key := nullif(btrim(v_item->>'key'), '');
    v_value := nullif(btrim(v_item->>'value'), '');
    v_evidence := nullif(btrim(v_item->>'evidence'), '');

    if v_key is null or v_key not in (
      'naslov','opis','kategorija','datum','vreme','polaziste','odrediste','osoba','vozilo','uslovi'
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
      v_confidence := (v_item->>'confidence')::numeric;
    exception when invalid_text_representation then
      raise exception 'FACT_CONFIDENCE_INVALID' using errcode = '22023', detail = v_key;
    end;
    if v_confidence is null or v_confidence < 0 or v_confidence > 1 then
      raise exception 'FACT_CONFIDENCE_INVALID' using errcode = '22023', detail = v_key;
    end if;

    insert into public.ai_structured_facts (
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
    )
    returning id into v_fact_id;

    update public.ai_structured_facts
       set superseded_at = statement_timestamp(),
           superseded_by = v_fact_id
     where conversation_id = p_conversation_id
       and fact_key = v_key
       and id <> v_fact_id
       and superseded_at is null;

    v_fact_ids := array_append(v_fact_ids, v_fact_id);
  end loop;

  insert into public.ai_messages(account_id, conversation_id, role, body)
  values (p_account_id, p_conversation_id, 'USER', btrim(p_user_message))
  returning id into v_user_message_id;

  insert into public.ai_messages(
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
  )
  returning id into v_assistant_message_id;

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

comment on table public.ai_messages is
  'Persistent NEED_INTAKE conversation history. Authenticated users have own-only RLS read access; writes are server-only through rpc_ai_apply_interview_turn_service.';

comment on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) is
  'Service-role-only atomic writer for one AI interview turn: persists USER + ASSISTANT messages and AI_INFERENCE NEEDS_CONFIRMATION facts in one transaction after Edge verified caller ownership.';