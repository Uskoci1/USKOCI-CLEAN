-- USKOCI clean build: correct fact supersession order and HUMAN_CONFIRMED semantics.
-- The unique one-live-fact-per-key invariant stays enabled. Replacements first
-- mark the currently-live row(s) superseded inside the transaction, then insert
-- the new fact, then backfill superseded_by. Any failure rolls the whole change back.

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
  v_previous_ids uuid[];
  v_user_message_id uuid;
  v_assistant_message_id uuid;
  v_proposals jsonb := coalesce(p_proposals, '[]'::jsonb);
begin
  if p_account_id is null or p_conversation_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_user_message)),0) < 1 or char_length(btrim(p_user_message)) > 4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023'; end if;
  if coalesce(char_length(btrim(p_assistant_message)),0) < 1 or char_length(btrim(p_assistant_message)) > 1000 then raise exception 'ASSISTANT_MESSAGE_INVALID' using errcode='22023'; end if;
  if p_safety not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then raise exception 'SAFETY_DECISION_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(v_proposals) <> 'array' or jsonb_array_length(v_proposals) > 10 then raise exception 'PROPOSALS_INVALID' using errcode='22023'; end if;

  select * into v_conv from public.ai_conversations where id=p_conversation_id for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id <> p_account_id then raise exception 'CONVERSATION_OWNER_MISMATCH' using errcode='42501'; end if;
  if v_conv.purpose <> 'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if v_conv.status <> 'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;

  for v_item in select value from jsonb_array_elements(v_proposals)
  loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'PROPOSAL_OBJECT_REQUIRED' using errcode='22023'; end if;
    v_key := nullif(btrim(v_item->>'key'),'');
    v_value := nullif(btrim(v_item->>'value'),'');
    v_evidence := nullif(btrim(v_item->>'evidence'),'');
    if v_key is null or v_key not in ('naslov','opis','kategorija','datum','vreme','polaziste','odrediste','osoba','vozilo','uslovi','mode','execution_location_mode') then raise exception 'FACT_KEY_INVALID' using errcode='22023',detail=coalesce(v_key,'NULL'); end if;
    if v_value is null or char_length(v_value) > 2000 then raise exception 'FACT_VALUE_INVALID' using errcode='22023',detail=v_key; end if;
    if v_evidence is null or char_length(v_evidence) > 500 then raise exception 'FACT_EVIDENCE_INVALID' using errcode='22023',detail=v_key; end if;
    begin v_confidence := (v_item->>'confidence')::numeric; exception when invalid_text_representation then raise exception 'FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end;
    if v_confidence is null or v_confidence < 0 or v_confidence > 1 then raise exception 'FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end if;

    v_fact_id := extensions.gen_random_uuid();
    with superseded as (
      update public.ai_structured_facts
         set superseded_at=statement_timestamp(), superseded_by=null
       where conversation_id=p_conversation_id and fact_key=v_key and superseded_at is null
       returning id
    ) select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

    insert into public.ai_structured_facts(
      id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,confidence,evidence_excerpt
    ) values (
      v_fact_id,p_account_id,p_conversation_id,v_conv.bound_need_id,v_key,to_jsonb(v_value),'NEEDS_CONFIRMATION','AI_INFERENCE','NEED_DRAFT',v_confidence,v_evidence
    );

    if cardinality(v_previous_ids) > 0 then
      update public.ai_structured_facts set superseded_by=v_fact_id where id=any(v_previous_ids);
    end if;
    v_fact_ids := array_append(v_fact_ids,v_fact_id);
  end loop;

  insert into public.ai_messages(account_id,conversation_id,role,body)
  values(p_account_id,p_conversation_id,'USER',btrim(p_user_message)) returning id into v_user_message_id;
  insert into public.ai_messages(account_id,conversation_id,role,body,safety,proposed_fact_ids)
  values(p_account_id,p_conversation_id,'ASSISTANT',btrim(p_assistant_message),p_safety,v_fact_ids) returning id into v_assistant_message_id;

  return jsonb_build_object('conversationId',p_conversation_id,'userMessageId',v_user_message_id,'assistantMessageId',v_assistant_message_id,'proposedCount',cardinality(v_fact_ids),'proposedFactIds',to_jsonb(v_fact_ids),'safety',p_safety,'authoritative',true);
end;
$function$;

revoke all on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) to service_role;

create or replace function public.rpc_ai_confirm_fact(p_fact_id uuid)
returns uuid language plpgsql security definer set search_path to 'pg_catalog'
as $function$
declare v_uid uuid:=auth.uid(); v_fact public.ai_structured_facts%rowtype; v_conv public.ai_conversations%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into v_fact from public.ai_structured_facts where id=p_fact_id for update;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_fact.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_fact.superseded_at is not null then raise exception 'SUPERSEDED' using errcode='P0001'; end if;
  select * into v_conv from public.ai_conversations where id=v_fact.conversation_id for update;
  if not found or v_conv.account_id<>v_uid then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;
  if v_fact.status='CONFIRMED' then
    if v_fact.confirmed_at is null or v_fact.confirmed_by_user_id is null then raise exception 'CONFIRMED_PROVENANCE_INVALID' using errcode='P0001'; end if;
    return p_fact_id;
  end if;
  update public.ai_structured_facts set status='CONFIRMED',confirmed_at=statement_timestamp(),confirmed_by_user_id=v_uid where id=p_fact_id;
  return p_fact_id;
end;
$function$;

create or replace function public.rpc_ai_correct_fact(p_fact_id uuid,p_value text)
returns uuid language plpgsql security definer set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid(); v_old public.ai_structured_facts%rowtype; v_conv public.ai_conversations%rowtype;
  v_value text:=nullif(btrim(p_value),''); v_new_id uuid:=extensions.gen_random_uuid(); v_previous_ids uuid[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if v_value is null or char_length(v_value)>2000 then raise exception 'FACT_VALUE_INVALID' using errcode='22023'; end if;
  select * into v_old from public.ai_structured_facts where id=p_fact_id for update;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_old.superseded_at is not null then raise exception 'SUPERSEDED' using errcode='P0001'; end if;
  if v_old.scope<>'NEED_DRAFT' then raise exception 'FACT_SCOPE_NOT_EDITABLE' using errcode='P0001'; end if;
  select * into v_conv from public.ai_conversations where id=v_old.conversation_id for update;
  if not found or v_conv.account_id<>v_uid then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.purpose<>'NEED_INTAKE' or v_conv.status<>'OPEN' then raise exception 'CONVERSATION_NOT_EDITABLE' using errcode='P0001'; end if;

  with superseded as (
    update public.ai_structured_facts set superseded_at=statement_timestamp(),superseded_by=null
     where conversation_id=v_old.conversation_id and fact_key=v_old.fact_key and superseded_at is null
     returning id
  ) select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

  insert into public.ai_structured_facts(
    id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at
  ) values (
    v_new_id,v_uid,v_old.conversation_id,v_old.subject_need_id,v_old.fact_key,to_jsonb(v_value),'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,null,v_uid,statement_timestamp()
  );
  if cardinality(v_previous_ids)>0 then update public.ai_structured_facts set superseded_by=v_new_id where id=any(v_previous_ids); end if;
  return v_new_id;
end;
$function$;

revoke all on function public.rpc_ai_confirm_fact(uuid) from public,anon;
grant execute on function public.rpc_ai_confirm_fact(uuid) to authenticated;
revoke all on function public.rpc_ai_correct_fact(uuid,text) from public,anon;
grant execute on function public.rpc_ai_correct_fact(uuid,text) to authenticated;

-- Runtime proofs: no retained rows.
do $proof_seed$
declare v_c uuid; v_a uuid; v_existing uuid; v_key text;
begin
  select c.id,c.account_id,f.id,f.fact_key into v_c,v_a,v_existing,v_key
    from public.ai_conversations c
    join public.ai_structured_facts f on f.conversation_id=c.id and f.superseded_at is null
   where c.purpose='NEED_INTAKE' and c.status='OPEN'
     and f.fact_key in ('naslov','opis','kategorija','datum','vreme','polaziste','odrediste','osoba','vozilo','uslovi')
   order by c.created_at,f.created_at limit 1;
  if v_c is null then raise exception 'AI_SUPERSESSION_PROOF_FIXTURE_REQUIRED'; end if;
  perform set_config('uskoci.ai_sup_c',v_c::text,true); perform set_config('uskoci.ai_sup_a',v_a::text,true);
  perform set_config('uskoci.ai_sup_existing',v_existing::text,true); perform set_config('uskoci.ai_sup_key',v_key,true);
end
$proof_seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ai_sup_a',true),true);
select set_config('request.jwt.claims','',true);

do $human_proof$
declare v_c uuid:=current_setting('uskoci.ai_sup_c',true)::uuid; v_a uuid:=current_setting('uskoci.ai_sup_a',true)::uuid; v_old uuid; v_new uuid; v_row public.ai_structured_facts%rowtype;
begin
  begin
    v_old:=public.rpc_ai_propose_fact(v_c,'uskoci_confirm_proof_temp',to_jsonb('TEMP'::text),'SYSTEM_DERIVED','NEED_DRAFT',1,null);
    perform public.rpc_ai_confirm_fact(v_old); select * into v_row from public.ai_structured_facts where id=v_old;
    if v_row.status<>'CONFIRMED' or v_row.confirmed_at is null or v_row.confirmed_by_user_id<>v_a then raise exception 'AI_CONFIRM_PROOF_FAILED'; end if;
    raise exception using errcode='P9003',message='EXPECTED'; exception when sqlstate 'P9003' then null;
  end;
  begin
    v_old:=public.rpc_ai_propose_fact(v_c,'uskoci_correct_proof_temp',to_jsonb('OLD'::text),'SYSTEM_DERIVED','NEED_DRAFT',1,null);
    v_new:=public.rpc_ai_correct_fact(v_old,'NEW'); select * into v_row from public.ai_structured_facts where id=v_new;
    if v_row.status<>'CONFIRMED' or v_row.source<>'EXPLICIT_USER_ANSWER' or v_row.confirmed_by_user_id<>v_a or v_row.confirmed_at is null then raise exception 'AI_CORRECT_PROOF_FAILED'; end if;
    if not exists(select 1 from public.ai_structured_facts where id=v_old and superseded_by=v_new and superseded_at is not null) then raise exception 'AI_CORRECT_SUPERSESSION_FAILED'; end if;
    raise exception using errcode='P9004',message='EXPECTED'; exception when sqlstate 'P9004' then null;
  end;
  if exists(select 1 from public.ai_structured_facts where fact_key in ('uskoci_confirm_proof_temp','uskoci_correct_proof_temp')) then raise exception 'AI_HUMAN_PROOF_RESIDUE'; end if;
end
$human_proof$;
reset role;

set local role service_role;
do $service_replacement_proof$
declare v_c uuid:=current_setting('uskoci.ai_sup_c',true)::uuid; v_a uuid:=current_setting('uskoci.ai_sup_a',true)::uuid; v_existing uuid:=current_setting('uskoci.ai_sup_existing',true)::uuid; v_key text:=current_setting('uskoci.ai_sup_key',true); v_new uuid; v_result jsonb;
begin
  begin
    v_result:=public.rpc_ai_apply_interview_turn_service(v_a,v_c,'USKOCI_REPLACE_PROOF_USER','USKOCI replace proof assistant','ALLOW',jsonb_build_array(jsonb_build_object('key',v_key,'value','USKOCI_REPLACE_PROOF_VALUE','confidence',0.9,'evidence','USKOCI_REPLACE_PROOF')));
    v_new:=(v_result->'proposedFactIds'->>0)::uuid;
    if v_new is null or not exists(select 1 from public.ai_structured_facts where id=v_new and superseded_at is null) then raise exception 'AI_SERVICE_REPLACEMENT_NEW_MISSING'; end if;
    if not exists(select 1 from public.ai_structured_facts where id=v_existing and superseded_by=v_new and superseded_at is not null) then raise exception 'AI_SERVICE_REPLACEMENT_LINK_MISSING'; end if;
    raise exception using errcode='P9005',message='EXPECTED'; exception when sqlstate 'P9005' then null;
  end;
  if exists(select 1 from public.ai_structured_facts where fact_value=to_jsonb('USKOCI_REPLACE_PROOF_VALUE'::text)) or exists(select 1 from public.ai_messages where body like 'USKOCI_REPLACE_PROOF%') then raise exception 'AI_SERVICE_REPLACEMENT_PROOF_RESIDUE'; end if;
end
$service_replacement_proof$;
reset role;

comment on function public.rpc_ai_confirm_fact(uuid) is 'AUTHENTICATED_RUNTIME_PROVEN: human confirmation stamps confirmed_at and confirmed_by_user_id.';
comment on function public.rpc_ai_correct_fact(uuid,text) is 'AUTHENTICATED_RUNTIME_PROVEN: explicit correction atomically supersedes prior live fact and creates CONFIRMED EXPLICIT_USER_ANSWER provenance.';
comment on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) is 'SERVICE_RUNTIME_PROVEN: repeated canonical keys preserve one-live-fact invariant by superseding before insert; replacement proof rolled back with zero residue.';