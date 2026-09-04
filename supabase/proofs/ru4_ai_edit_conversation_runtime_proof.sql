-- USKOČI RU-4 rollback-only proof: prefilled AI edit conversation -> explicit human confirm -> DRAFT rev+1.
\set ON_ERROR_STOP on
begin;

do $seed$
declare
  requester uuid:=extensions.gen_random_uuid();
  attacker uuid:=extensions.gen_random_uuid();
  worker uuid:=extensions.gen_random_uuid();
  requester_profile uuid;
  worker_profile uuid;
  editable_need uuid;
  locked_need uuid;
  response_id uuid;
  locked_response uuid;
  selection_id uuid;
  agreement_id uuid;
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','ru4-ai-requester-'||requester::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 AI Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (attacker,'authenticated','authenticated','ru4-ai-attacker-'||attacker::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 AI Attacker','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker,'authenticated','authenticated','ru4-ai-worker-'||worker::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 AI Worker','city','Novi Sad'),statement_timestamp(),statement_timestamp());

  select id into requester_profile from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_profile from public.app_profiles where account_id=worker and kind='WORKER';
  if requester_profile is null or worker_profile is null then raise exception 'RU4_AI_PROFILE_SETUP_FAILED'; end if;
  update public.app_profiles set display_name='RU4 AI Worker',city='Novi Sad',skills=array['proof'] where id=worker_profile;
  perform set_config('request.jwt.claim.sub',worker::text,true);
  perform public.rpc_complete_worker_profile(worker_profile);
  perform set_config('request.jwt.claim.sub','',true);

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(
    requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,required_slots,mode,requester_price_rsd,
    required_skills,required_tools,required_vehicles,required_licenses,minimum_experience_years,
    verified_identity_required,execution_location_mode,revision,published_at,response_deadline
  ) values (
    requester,requester_profile,'PUBLISHED','RU4 AI old task','Preneti ormar iz sobe u kombi.','Selidbe',
    'Novi Sad','Centar','FLEXIBLE',2,'MY_PRICE',5000,
    array['prenošenje'],array['rukavice'],array[]::text[],array[]::text[],0,false,'STATIONARY',1,
    statement_timestamp(),statement_timestamp()+interval '2 days'
  ) returning id into editable_need;

  insert into public.needs(
    requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,required_slots,mode,requester_price_rsd,
    required_skills,execution_location_mode,revision,published_at,response_deadline
  ) values (
    requester,requester_profile,'PUBLISHED','RU4 AI locked task','Već ima Dogovor.','Selidbe',
    'Novi Sad','Centar','FLEXIBLE',1,'MY_PRICE',4000,
    array['prenošenje'],'REMOTE',1,statement_timestamp(),statement_timestamp()+interval '2 days'
  ) returning id into locked_need;
  perform set_config('uskoci.need_lifecycle','',true);

  insert into public.need_geography(need_id,public_topology) values(
    editable_need,
    jsonb_build_object('mode','STATIONARY','start',jsonb_build_object('label','Centar','city','Novi Sad','area','Centar'),'end',null,'waypoints','[]'::jsonb,'serviceArea',null)
  );
  insert into public.need_requirement_details(need_id,critical_conditions) values(editable_need,array['drugi sprat bez lifta']);
  insert into public.need_sensitive(need_id,exact_address,access_notes) values(editable_need,'Bulevar oslobođenja 1','Pozvati na interfon');

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,
    covered_slots,price_rsd,scope_note,submitted_at
  ) values(editable_need,worker,worker_profile,'OFFER','SUBMITTED',1,1,1,5000,'Mogu da pomognem',statement_timestamp())
  returning id into response_id;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(response_id,1,1,5000,1,'Mogu da pomognem',repeat('a',64));
  insert into private.dispatch_schedule(need_id,next_run_at) values(editable_need,statement_timestamp());

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,
    covered_slots,price_rsd,scope_note,submitted_at
  ) values(locked_need,worker,worker_profile,'OFFER','SELECTED',1,1,1,4000,'Izabrana prijava',statement_timestamp())
  returning id into locked_response;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(locked_response,1,1,4000,1,'Izabrana prijava',repeat('b',64));
  insert into public.need_selections(
    need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,
    worker_account_id,worker_profile_id,selection_mode,status
  ) values(locked_need,1,requester,'ru4-ai-locked-selection',1,locked_response,worker,worker_profile,'REQUESTER_SELECTS','SELECTED')
  returning id into selection_id;
  insert into public.agreements(
    need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values(locked_need,selection_id,locked_response,requester,requester_profile,worker,worker_profile,1,'CONFIRMED')
  returning id into agreement_id;
  insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
  values(agreement_id,1,'CONFIRMED',jsonb_build_object('needRevision',1,'priceRsd',4000),repeat('c',64),requester);

  perform set_config('uskoci.ru4_ai_requester',requester::text,true);
  perform set_config('uskoci.ru4_ai_attacker',attacker::text,true);
  perform set_config('uskoci.ru4_ai_worker',worker::text,true);
  perform set_config('uskoci.ru4_ai_need',editable_need::text,true);
  perform set_config('uskoci.ru4_ai_locked_need',locked_need::text,true);
  perform set_config('uskoci.ru4_ai_response',response_id::text,true);
end
$seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_ai_attacker'),true);
do $attacker$
declare denied boolean:=false;
begin
  begin
    perform public.rpc_ai_open_need_edit_conversation_v2(current_setting('uskoci.ru4_ai_need')::uuid);
  exception when sqlstate '42501' then denied:=true;
  end;
  if not denied then raise exception 'RU4_AI_ATTACKER_OPEN_ALLOWED'; end if;
end
$attacker$;

select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_ai_requester'),true);
do $open$
declare
  nid uuid:=current_setting('uskoci.ru4_ai_need')::uuid;
  locked uuid:=current_setting('uskoci.ru4_ai_locked_need')::uuid;
  r jsonb; cid uuid; cnt integer; rev integer; s text; denied boolean:=false;
begin
  r:=public.rpc_ai_open_need_edit_conversation_v2(nid);
  cid:=(r->>'conversationId')::uuid;
  perform set_config('uskoci.ru4_ai_conversation',cid::text,true);

  select revision,status into rev,s from public.needs where id=nid;
  if rev<>1 or s<>'PUBLISHED' then raise exception 'RU4_AI_OPEN_MUTATED_PUBLIC_TASK'; end if;

  select count(*) into cnt from public.ai_structured_facts
   where conversation_id=cid and superseded_at is null and status='CONFIRMED' and source='SYSTEM_DERIVED';
  if cnt<12 then raise exception 'RU4_AI_PREFILL_TOO_SPARSE' using detail=cnt::text; end if;
  if not exists(
    select 1 from public.ai_structured_facts
     where conversation_id=cid and fact_key='need.title' and fact_value=to_jsonb('RU4 AI old task'::text)
       and status='CONFIRMED' and subject_need_id=nid
  ) then raise exception 'RU4_AI_TITLE_NOT_PREFILLED'; end if;
  if not exists(
    select 1 from public.ai_structured_facts
     where conversation_id=cid and fact_key='need.critical_conditions'
       and fact_value='["drugi sprat bez lifta"]'::jsonb and status='CONFIRMED'
  ) then raise exception 'RU4_AI_CONDITIONS_NOT_PREFILLED'; end if;

  begin
    perform public.rpc_ai_open_need_edit_conversation_v2(locked);
  exception when sqlstate 'P0001' then
    if sqlerrm='NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'RU4_AI_OPEN_AFTER_DOGOVOR_ALLOWED'; end if;
end
$open$;

reset role;
set local role service_role;
do $ai_turn$
declare
  owner uuid:=current_setting('uskoci.ru4_ai_requester')::uuid;
  cid uuid:=current_setting('uskoci.ru4_ai_conversation')::uuid;
  r jsonb;
begin
  r:=public.rpc_ai_apply_interview_turn_v2_service(
    owner,cid,
    'Promeni samo uslov: sada je treći sprat bez lifta.',
    'Promenio sam samo uslov sprata. Ostalo ostaje isto.',
    'ALLOW',
    jsonb_build_array(jsonb_build_object(
      'key','need.critical_conditions',
      'value','["treći sprat bez lifta"]'::jsonb,
      'displayValue','Treći sprat bez lifta',
      'evidence','sada je treći sprat bez lifta',
      'confidence',1
    ))
  );
  if (r->>'proposedCount')::integer<>1 then raise exception 'RU4_AI_EDIT_PROPOSAL_COUNT_BAD'; end if;
end
$ai_turn$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_ai_requester'),true);
do $human_confirm_and_commit$
declare
  nid uuid:=current_setting('uskoci.ru4_ai_need')::uuid;
  cid uuid:=current_setting('uskoci.ru4_ai_conversation')::uuid;
  fid uuid;
  r jsonb; replay jsonb;
  denied boolean:=false;
  rev integer; s text; response_status text; conv_status text; conditions text[];
begin
  begin
    perform public.rpc_confirm_need_edit_from_review_v2(nid,1,cid,'ru4-ai-confirm-0001');
  exception when sqlstate 'P0001' then
    if sqlerrm='EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'RU4_AI_EDIT_COMMITTED_WITH_UNCONFIRMED_AI_FACT'; end if;

  select id into fid from public.ai_structured_facts
   where conversation_id=cid and fact_key='need.critical_conditions' and superseded_at is null;
  if fid is null then raise exception 'RU4_AI_CHANGED_FACT_MISSING'; end if;
  perform public.rpc_ai_confirm_fact(fid);

  r:=public.rpc_confirm_need_edit_from_review_v2(nid,1,cid,'ru4-ai-confirm-0001');
  if r->>'status'<>'DRAFT' or (r->>'revision')::integer<>2 or not (r->>'requiresReadmission')::boolean then
    raise exception 'RU4_AI_FINAL_CONFIRM_BAD_RESULT' using detail=r::text;
  end if;

  select revision,status into rev,s from public.needs where id=nid;
  if rev<>2 or s<>'DRAFT' then raise exception 'RU4_AI_EDIT_NOT_DRAFT_REV2'; end if;
  select critical_conditions into conditions from public.need_requirement_details where need_id=nid;
  if conditions<>array['treći sprat bez lifta'] then raise exception 'RU4_AI_CRITICAL_ONLY_CHANGE_NOT_PERSISTED'; end if;
  select status into response_status from public.marketplace_responses where id=current_setting('uskoci.ru4_ai_response')::uuid;
  if response_status<>'STALE_REVIEW_REQUIRED' then raise exception 'RU4_AI_PRIOR_APPLICATION_NOT_STALE'; end if;
  select status into conv_status from public.ai_conversations where id=cid;
  if conv_status<>'COMPLETED' then raise exception 'RU4_AI_CONVERSATION_NOT_COMPLETED'; end if;

  replay:=public.rpc_confirm_need_edit_from_review_v2(nid,1,cid,'ru4-ai-confirm-0001');
  if not coalesce((replay->>'idempotentReplay')::boolean,false) or (replay->>'revision')::integer<>2 then
    raise exception 'RU4_AI_EXACT_REPLAY_NOT_STABLE';
  end if;

  denied:=false;
  begin
    perform public.rpc_confirm_need_edit_from_review_v2(nid,2,cid,'ru4-ai-confirm-0001');
  exception when sqlstate '22023' then
    if sqlerrm='IDEMPOTENCY_KEY_REUSED' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'RU4_AI_KEY_REUSE_CHANGED_INPUT_ALLOWED'; end if;
end
$human_confirm_and_commit$;

reset role;
do $private_assert$
declare nid uuid:=current_setting('uskoci.ru4_ai_need')::uuid; cnt integer;
begin
  if exists(select 1 from private.dispatch_schedule where need_id=nid) then raise exception 'RU4_AI_OLD_DISPATCH_SURVIVED'; end if;
  select count(*) into cnt from private.need_revision_events where need_id=nid and from_revision=1 and to_revision=2;
  if cnt<>1 then raise exception 'RU4_AI_REVISION_EVENT_COUNT_BAD'; end if;
  select count(*) into cnt from private.need_edit_commands where need_id=nid;
  if cnt<>1 then raise exception 'RU4_AI_COMMAND_LEDGER_COUNT_BAD'; end if;
end
$private_assert$;

select 'PASS RU4_AI_EDIT prefilled_current_task open_is_readonly ai_changes_only_proposed_key human_confirm_required critical_only_change_counts draft_rev2 prior_application_stale first_dogovor_lock exact_replay key_reuse_rejected' as proof_result;
rollback;
