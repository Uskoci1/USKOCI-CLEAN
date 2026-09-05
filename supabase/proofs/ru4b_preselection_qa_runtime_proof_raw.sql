-- USKOCI RU-4B rollback-only authenticated proof.
\set ON_ERROR_STOP on
begin;

do $seed$
declare
  requester uuid:=extensions.gen_random_uuid();
  worker uuid:=extensions.gen_random_uuid();
  attacker uuid:=extensions.gen_random_uuid();
  requester_profile uuid;
  worker_profile uuid;
  need_id uuid;
  bundle_id uuid:=extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','ru4b-requester-'||requester::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4B Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker,'authenticated','authenticated','ru4b-worker-'||worker::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4B Worker','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (attacker,'authenticated','authenticated','ru4b-attacker-'||attacker::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4B Attacker','city','Novi Sad'),statement_timestamp(),statement_timestamp());

  select id into requester_profile from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_profile from public.app_profiles where account_id=worker and kind='WORKER';
  update public.app_profiles set display_name='RU4B Worker',city='Novi Sad',skills=array['proof'] where id=worker_profile;
  perform set_config('request.jwt.claim.sub',worker::text,true);
  perform public.rpc_complete_worker_profile(worker_profile);
  perform set_config('request.jwt.claim.sub','',true);

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(
    requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,required_slots,mode,
    requester_price_rsd,required_skills,execution_location_mode,revision,published_at,response_deadline
  ) values (
    requester,requester_profile,'PUBLISHED','RU4B proof task','Prenos ormara','proof',
    'Novi Sad','Centar','FLEXIBLE',1,'MY_PRICE',5000,array['proof'],'REMOTE',1,
    statement_timestamp(),statement_timestamp()+interval '2 days'
  ) returning id into need_id;
  perform set_config('uskoci.need_lifecycle','',true);

  insert into private.publication_policy_bundles(
    id,policy_id,version,jurisdiction,is_reviewed,is_complete,is_active,review_provenance,
    reviewed_at,effective_from,activated_at
  ) values (
    bundle_id,'RU4B_PROOF_POLICY',1,'RS',true,true,true,jsonb_build_object('proofOnly',true),
    statement_timestamp(),statement_timestamp()-interval '1 minute',statement_timestamp()
  );
  insert into private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance)
  values(bundle_id,'RU4B_PROOF_RULE',jsonb_build_object('proofOnly',true));

  perform set_config('uskoci.ru4b_requester',requester::text,true);
  perform set_config('uskoci.ru4b_worker',worker::text,true);
  perform set_config('uskoci.ru4b_attacker',attacker::text,true);
  perform set_config('uskoci.ru4b_need',need_id::text,true);
  perform set_config('uskoci.ru4b_bundle',bundle_id::text,true);
end
$seed$;

-- Production candidate must be fail closed before any Q&A row is created.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_worker'),true);
do $closed$
declare denied boolean:=false;
begin
  begin
    perform public.rpc_ru4b_ask_preselection_question(
      current_setting('uskoci.ru4b_need')::uuid,1,'Da li se ormar može rastaviti?',extensions.gen_random_uuid());
  exception when sqlstate 'P0001' then
    if sqlerrm='RU4B_BLOCK_AUTHORITY_NOT_READY' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'RU4B_PRODUCTION_BLOCK_AUTHORITY_DID_NOT_FAIL_CLOSED'; end if;
end
$closed$;
reset role;

-- Proof-only dependency adapters: no production policy is created by the candidate.
create or replace function private.ru4b_assert_block_authority_ready(uuid,uuid)
returns void language plpgsql security definer set search_path to 'pg_catalog' as $$begin return; end$$;
create or replace function private.ru4b_assert_rate_authority_ready(uuid)
returns void language plpgsql security definer set search_path to 'pg_catalog' as $$begin return; end$$;
revoke all on function private.ru4b_assert_block_authority_ready(uuid,uuid) from public,anon,authenticated;
revoke all on function private.ru4b_assert_rate_authority_ready(uuid) from public,anon,authenticated;

-- No direct private CRUD surface for authenticated clients.
do $acl$
begin
  if has_table_privilege('authenticated','private.preselection_qa_questions','SELECT')
     or has_table_privilege('authenticated','private.preselection_qa_questions','INSERT')
     or has_table_privilege('authenticated','private.preselection_qa_policy_decisions','INSERT')
     or has_table_privilege('anon','private.preselection_qa_questions','SELECT') then
    raise exception 'RU4B_PRIVATE_TABLE_ACL_OPEN';
  end if;
end
$acl$;

-- Seed an exact QUESTION policy ALLOW only inside this rollback proof.
do $question_allow$
declare
  nid uuid:=current_setting('uskoci.ru4b_need')::uuid;
  bid uuid:=current_setting('uskoci.ru4b_bundle')::uuid;
  fp text;
  ident text;
begin
  fp:=private.ru4b_content_fingerprint('QUESTION',nid,1,null,'Da li se ormar može rastaviti?');
  ident:=encode(extensions.digest(convert_to('proof-question-1-'||fp,'UTF8'),'sha256'),'hex');
  insert into private.preselection_qa_policy_decisions(
    subject_kind,need_id,need_revision,question_id,content_fingerprint,policy_bundle_id,
    policy_id,policy_version,jurisdiction,rule_ids,rule_provenance_snapshot,outcome,
    decision_source,service_provenance,decision_identity
  ) values ('QUESTION',nid,1,null,fp,bid,'RU4B_PROOF_POLICY',1,'RS',array['RU4B_PROOF_RULE'],
    jsonb_build_array(jsonb_build_object('ruleId','RU4B_PROOF_RULE','proofOnly',true)),
    'ALLOW','PROOF_ONLY',jsonb_build_object('proofOnly',true),ident);
end
$question_allow$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_worker'),true);
do $ask$
declare
  nid uuid:=current_setting('uskoci.ru4b_need')::uuid;
  rid uuid:=extensions.gen_random_uuid();
  r jsonb; r2 jsonb; qid uuid; cnt int;
begin
  r:=public.rpc_ru4b_ask_preselection_question(nid,1,'Da li se ormar može rastaviti?',rid);
  qid:=(r->>'questionId')::uuid;
  if r->>'status'<>'PENDING_ANSWER' or qid is null then raise exception 'RU4B_ASK_BAD_RESULT' using detail=r::text; end if;
  perform set_config('uskoci.ru4b_question',qid::text,true);
  select count(*) into cnt from public.rpc_ru4b_public_preselection_qa(nid);
  if cnt<>0 then raise exception 'RU4B_QUESTION_PUBLIC_BEFORE_ANSWER'; end if;
  r2:=public.rpc_ru4b_ask_preselection_question(nid,1,'Da li se ormar može rastaviti?',rid);
  if not coalesce((r2->>'idempotentReplay')::boolean,false) or r2->>'questionId'<>qid::text then
    raise exception 'RU4B_ASK_REPLAY_UNSTABLE';
  end if;
  begin
    perform public.rpc_ru4b_ask_preselection_question(nid,1,'Drugo pitanje',rid);
    raise exception 'RU4B_ASK_KEY_REUSE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'IDEMPOTENCY_KEY_REUSED' then raise; end if;
  end;
end
$ask$;

-- Owner projection must not disclose asker identity.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_requester'),true);
do $anonymous$
declare payload text; wid text:=current_setting('uskoci.ru4b_worker'); cnt int;
begin
  select count(*),coalesce(string_agg(to_jsonb(x)::text,''),'') into cnt,payload
  from public.rpc_ru4b_owner_preselection_questions(current_setting('uskoci.ru4b_need')::uuid) x;
  if cnt<>1 then raise exception 'RU4B_OWNER_PENDING_MISSING'; end if;
  if position(wid in payload)>0 or position('asker_account_id' in payload)>0 then raise exception 'RU4B_ASKER_IDENTITY_LEAK_OWNER'; end if;
end
$anonymous$;

-- Cross-account attacker cannot answer.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_attacker'),true);
do $attack$
declare denied boolean:=false;
begin
  begin
    perform public.rpc_ru4b_answer_preselection_question(current_setting('uskoci.ru4b_question')::uuid,'Može da se rastavi.',extensions.gen_random_uuid());
  exception when sqlstate 'P0001' then
    if sqlerrm='NOT_NEED_OWNER' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'RU4B_CROSS_ACCOUNT_ANSWER_ALLOWED'; end if;
end
$attack$;
reset role;

-- Seed exact NON_MATERIAL + ANSWER ALLOW proof decisions.
do $answer_allow$
declare
  qid uuid:=current_setting('uskoci.ru4b_question')::uuid;
  nid uuid:=current_setting('uskoci.ru4b_need')::uuid;
  bid uuid:=current_setting('uskoci.ru4b_bundle')::uuid;
  fp text; ident text;
begin
  fp:=private.ru4b_content_fingerprint('ANSWER',nid,1,qid,'Može da se rastavi.');
  insert into private.preselection_qa_materiality_decisions(question_id,need_id,need_revision,answer_fingerprint,materiality,decision_source,service_provenance,decision_identity)
  values(qid,nid,1,fp,'NON_MATERIAL','PROOF_ONLY',jsonb_build_object('proofOnly',true),
    encode(extensions.digest(convert_to('proof-materiality-1-'||fp,'UTF8'),'sha256'),'hex'));
  ident:=encode(extensions.digest(convert_to('proof-answer-1-'||fp,'UTF8'),'sha256'),'hex');
  insert into private.preselection_qa_policy_decisions(
    subject_kind,need_id,need_revision,question_id,content_fingerprint,policy_bundle_id,
    policy_id,policy_version,jurisdiction,rule_ids,rule_provenance_snapshot,outcome,
    decision_source,service_provenance,decision_identity
  ) values ('ANSWER',nid,1,qid,fp,bid,'RU4B_PROOF_POLICY',1,'RS',array['RU4B_PROOF_RULE'],
    jsonb_build_array(jsonb_build_object('ruleId','RU4B_PROOF_RULE','proofOnly',true)),
    'ALLOW','PROOF_ONLY',jsonb_build_object('proofOnly',true),ident);
end
$answer_allow$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_requester'),true);
do $answer$
declare r jsonb; cnt int; payload text;
begin
  r:=public.rpc_ru4b_answer_preselection_question(current_setting('uskoci.ru4b_question')::uuid,'Može da se rastavi.',extensions.gen_random_uuid());
  if r->>'status'<>'ANSWERED_PUBLIC' or (r->>'answerVersion')::int<>1 or (r->>'edited')::boolean then raise exception 'RU4B_ANSWER_BAD_RESULT' using detail=r::text; end if;
  select count(*),coalesce(string_agg(to_jsonb(x)::text,''),'') into cnt,payload
  from public.rpc_ru4b_public_preselection_qa(current_setting('uskoci.ru4b_need')::uuid) x;
  if cnt<>1 then raise exception 'RU4B_PUBLIC_QA_MISSING_AFTER_ANSWER'; end if;
  if position(current_setting('uskoci.ru4b_worker') in payload)>0 or position('asker' in lower(payload))>0 then raise exception 'RU4B_ASKER_IDENTITY_LEAK_PUBLIC'; end if;
end
$answer$;
reset role;

-- Edited answer: append version, never rewrite history.
do $edit_allow$
declare qid uuid:=current_setting('uskoci.ru4b_question')::uuid; nid uuid:=current_setting('uskoci.ru4b_need')::uuid; bid uuid:=current_setting('uskoci.ru4b_bundle')::uuid; fp text;
begin
  fp:=private.ru4b_content_fingerprint('ANSWER',nid,1,qid,'Može, rastavlja se na dva dela.');
  insert into private.preselection_qa_materiality_decisions(question_id,need_id,need_revision,answer_fingerprint,materiality,decision_source,service_provenance,decision_identity)
  values(qid,nid,1,fp,'NON_MATERIAL','PROOF_ONLY',jsonb_build_object('proofOnly',true),encode(extensions.digest(convert_to('proof-materiality-2-'||fp,'UTF8'),'sha256'),'hex'));
  insert into private.preselection_qa_policy_decisions(subject_kind,need_id,need_revision,question_id,content_fingerprint,policy_bundle_id,policy_id,policy_version,jurisdiction,rule_ids,rule_provenance_snapshot,outcome,decision_source,service_provenance,decision_identity)
  values('ANSWER',nid,1,qid,fp,bid,'RU4B_PROOF_POLICY',1,'RS',array['RU4B_PROOF_RULE'],jsonb_build_array(jsonb_build_object('ruleId','RU4B_PROOF_RULE','proofOnly',true)),'ALLOW','PROOF_ONLY',jsonb_build_object('proofOnly',true),encode(extensions.digest(convert_to('proof-answer-2-'||fp,'UTF8'),'sha256'),'hex'));
end
$edit_allow$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_requester'),true);
do $edit$
declare r jsonb;
begin
  r:=public.rpc_ru4b_answer_preselection_question(current_setting('uskoci.ru4b_question')::uuid,'Može, rastavlja se na dva dela.',extensions.gen_random_uuid());
  if (r->>'answerVersion')::int<>2 or not (r->>'edited')::boolean then raise exception 'RU4B_EDIT_MARKER_BAD'; end if;
end
$edit$;
reset role;
do $edit_history$
declare cnt int; latest int;
begin
  select count(*),max(answer_version) into cnt,latest from private.preselection_qa_answer_versions where question_id=current_setting('uskoci.ru4b_question')::uuid;
  if cnt<>2 or latest<>2 then raise exception 'RU4B_ANSWER_HISTORY_NOT_APPEND_ONLY'; end if;
end
$edit_history$;

-- MATERIAL answer may not become public; it must route through RU-4 edit/readmission.
do $material_seed$
declare qid uuid:=current_setting('uskoci.ru4b_question')::uuid; nid uuid:=current_setting('uskoci.ru4b_need')::uuid; fp text;
begin
  fp:=private.ru4b_content_fingerprint('ANSWER',nid,1,qid,'Nova cena je 9000 i termin je sutra.');
  insert into private.preselection_qa_materiality_decisions(question_id,need_id,need_revision,answer_fingerprint,materiality,decision_source,service_provenance,decision_identity)
  values(qid,nid,1,fp,'MATERIAL','PROOF_ONLY',jsonb_build_object('proofOnly',true),encode(extensions.digest(convert_to('proof-materiality-material-'||fp,'UTF8'),'sha256'),'hex'));
end
$material_seed$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_requester'),true);
do $material$
declare denied boolean:=false;
begin
  begin
    perform public.rpc_ru4b_answer_preselection_question(current_setting('uskoci.ru4b_question')::uuid,'Nova cena je 9000 i termin je sutra.',extensions.gen_random_uuid());
  exception when sqlstate 'P0001' then
    if sqlerrm='RU4B_MATERIAL_REQUIRES_RU4_EDIT' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'RU4B_MATERIAL_ANSWER_PUBLISHED'; end if;
end
$material$;
reset role;
do $material_side_effect$
declare cnt int;
begin
  select count(*) into cnt from private.preselection_qa_answer_versions where question_id=current_setting('uskoci.ru4b_question')::uuid;
  if cnt<>2 then raise exception 'RU4B_MATERIAL_ANSWER_LEFT_SIDE_EFFECT'; end if;
end
$material_side_effect$;

-- Contact/PII floor is deterministic and cannot be bypassed by absent policy.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_worker'),true);
do $pii$
declare denied boolean:=false;
begin
  begin
    perform public.rpc_ru4b_ask_preselection_question(current_setting('uskoci.ru4b_need')::uuid,1,'Pišite mi na test@example.com',extensions.gen_random_uuid());
  exception when sqlstate 'P0001' then
    if sqlerrm='EMAIL_NOT_PUBLIC' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'RU4B_EMAIL_PUBLIC_FLOOR_BYPASSED'; end if;
end
$pii$;
reset role;

-- Second pending question is ignored and never public.
do $ignore_allow$
declare nid uuid:=current_setting('uskoci.ru4b_need')::uuid; bid uuid:=current_setting('uskoci.ru4b_bundle')::uuid; fp text;
begin
  fp:=private.ru4b_content_fingerprint('QUESTION',nid,1,null,'Da li je potreban moj alat?');
  insert into private.preselection_qa_policy_decisions(subject_kind,need_id,need_revision,question_id,content_fingerprint,policy_bundle_id,policy_id,policy_version,jurisdiction,rule_ids,rule_provenance_snapshot,outcome,decision_source,service_provenance,decision_identity)
  values('QUESTION',nid,1,null,fp,bid,'RU4B_PROOF_POLICY',1,'RS',array['RU4B_PROOF_RULE'],jsonb_build_array(jsonb_build_object('ruleId','RU4B_PROOF_RULE','proofOnly',true)),'ALLOW','PROOF_ONLY',jsonb_build_object('proofOnly',true),encode(extensions.digest(convert_to('proof-question-2-'||fp,'UTF8'),'sha256'),'hex'));
end
$ignore_allow$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_worker'),true);
do $ask2$
declare r jsonb;
begin
  r:=public.rpc_ru4b_ask_preselection_question(current_setting('uskoci.ru4b_need')::uuid,1,'Da li je potreban moj alat?',extensions.gen_random_uuid());
  perform set_config('uskoci.ru4b_question2',r->>'questionId',true);
end
$ask2$;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4b_requester'),true);
do $ignore$
declare r jsonb; cnt int;
begin
  r:=public.rpc_ru4b_disposition_preselection_question(current_setting('uskoci.ru4b_question2')::uuid,'IGNORE',extensions.gen_random_uuid());
  if r->>'status'<>'IGNORED' then raise exception 'RU4B_IGNORE_BAD_RESULT'; end if;
  select count(*) into cnt from public.rpc_ru4b_public_preselection_qa(current_setting('uskoci.ru4b_need')::uuid);
  if cnt<>1 then raise exception 'RU4B_IGNORED_QUESTION_BECAME_PUBLIC'; end if;
end
$ignore$;
reset role;

-- Event truth: requester gets creation events, asker gets answer-version events.
do $events$
declare created_cnt int; answered_cnt int;
begin
  select count(*) into created_cnt from public.user_activity_events
   where entity_type='CLARIFICATION' and event_type='CLARIFICATION_CREATED'
     and recipient_user_id=current_setting('uskoci.ru4b_requester')::uuid
     and entity_id in (current_setting('uskoci.ru4b_question')::uuid,current_setting('uskoci.ru4b_question2')::uuid);
  select count(*) into answered_cnt from public.user_activity_events
   where entity_type='CLARIFICATION' and event_type='CLARIFICATION_ANSWERED'
     and recipient_user_id=current_setting('uskoci.ru4b_worker')::uuid
     and entity_id=current_setting('uskoci.ru4b_question')::uuid;
  if created_cnt<>2 or answered_cnt<>2 then raise exception 'RU4B_EVENT_TRUTH_BAD created=% answered=%',created_cnt,answered_cnt; end if;
end
$events$;

select 'PASS RU4B_PRESELECTION_QA fail_closed_dependencies active_worker owner_only anonymous_until_answer no_identity_leak exact_policy_gate exact_materiality_gate material_routes_ru4 append_only_answer_history edited_marker ignore_nonpublic pii_floor idempotent events' as proof;
rollback;
