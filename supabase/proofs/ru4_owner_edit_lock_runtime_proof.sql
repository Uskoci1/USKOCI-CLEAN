-- USKOČI RU-4 rollback-only authenticated proof for latest owner lock.
\set ON_ERROR_STOP on
begin;

do $seed$
declare
  requester uuid := extensions.gen_random_uuid();
  worker_a uuid := extensions.gen_random_uuid();
  worker_b uuid := extensions.gen_random_uuid();
  worker_c uuid := extensions.gen_random_uuid();
  attacker uuid := extensions.gen_random_uuid();
  requester_profile uuid;
  worker_a_profile uuid;
  worker_b_profile uuid;
  worker_c_profile uuid;
  need_id uuid;
  response_a uuid;
  response_b uuid;
  response_c uuid;
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','ru4-lock-requester-'||requester::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_a,'authenticated','authenticated','ru4-lock-worker-a-'||worker_a::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Worker A','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_b,'authenticated','authenticated','ru4-lock-worker-b-'||worker_b::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Worker B','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_c,'authenticated','authenticated','ru4-lock-worker-c-'||worker_c::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Worker C','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (attacker,'authenticated','authenticated','ru4-lock-attacker-'||attacker::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Attacker','city','Novi Sad'),statement_timestamp(),statement_timestamp());

  select id into requester_profile from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_a_profile from public.app_profiles where account_id=worker_a and kind='WORKER';
  select id into worker_b_profile from public.app_profiles where account_id=worker_b and kind='WORKER';
  select id into worker_c_profile from public.app_profiles where account_id=worker_c and kind='WORKER';
  if requester_profile is null or worker_a_profile is null or worker_b_profile is null or worker_c_profile is null then
    raise exception 'RU4_LOCK_PROFILE_SETUP_FAILED';
  end if;

  update public.app_profiles set display_name='RU4 Worker A',city='Novi Sad',skills=array['proof'] where id=worker_a_profile;
  update public.app_profiles set display_name='RU4 Worker B',city='Novi Sad',skills=array['proof'] where id=worker_b_profile;
  update public.app_profiles set display_name='RU4 Worker C',city='Novi Sad',skills=array['proof'] where id=worker_c_profile;

  perform set_config('request.jwt.claim.sub',worker_a::text,true);
  perform public.rpc_complete_worker_profile(worker_a_profile);
  perform set_config('request.jwt.claim.sub',worker_b::text,true);
  perform public.rpc_complete_worker_profile(worker_b_profile);
  perform set_config('request.jwt.claim.sub',worker_c::text,true);
  perform public.rpc_complete_worker_profile(worker_c_profile);
  perform set_config('request.jwt.claim.sub','',true);

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(
    requester_account_id, requester_profile_id, status, title, description, category,
    approximate_city, approximate_area, schedule_kind, required_slots, mode,
    requester_price_rsd, required_skills, execution_location_mode, revision, published_at,
    response_deadline
  ) values (
    requester, requester_profile, 'PUBLISHED', 'RU4 old task', 'Original task terms', 'proof',
    'Novi Sad', 'Centar', 'FLEXIBLE', 2, 'MY_PRICE',
    5000, array['proof'], 'REMOTE', 1, statement_timestamp(), statement_timestamp()+interval '2 days'
  ) returning id into need_id;
  perform set_config('uskoci.need_lifecycle','',true);

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values
    (need_id,worker_a,worker_a_profile,'OFFER','SUBMITTED',1,1,1,5000,'keep me',statement_timestamp())
  returning id into response_a;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(response_a,1,1,5000,1,'keep me',repeat('a',64));

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values
    (need_id,worker_b,worker_b_profile,'OFFER','VIEWED',1,1,1,5000,'update me',statement_timestamp())
  returning id into response_b;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(response_b,1,1,5000,1,'update me',repeat('b',64));

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values
    (need_id,worker_c,worker_c_profile,'OFFER','SHORTLISTED',1,1,1,5000,'withdraw me',statement_timestamp())
  returning id into response_c;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(response_c,1,1,5000,1,'withdraw me',repeat('c',64));

  insert into private.dispatch_schedule(need_id,next_run_at)
  values(need_id,statement_timestamp())
  on conflict (need_id) do update set next_run_at=excluded.next_run_at;

  perform set_config('uskoci.ru4_requester',requester::text,true);
  perform set_config('uskoci.ru4_worker_a',worker_a::text,true);
  perform set_config('uskoci.ru4_worker_b',worker_b::text,true);
  perform set_config('uskoci.ru4_worker_c',worker_c::text,true);
  perform set_config('uskoci.ru4_attacker',attacker::text,true);
  perform set_config('uskoci.ru4_requester_profile',requester_profile::text,true);
  perform set_config('uskoci.ru4_worker_a_profile',worker_a_profile::text,true);
  perform set_config('uskoci.ru4_need',need_id::text,true);
  perform set_config('uskoci.ru4_response_a',response_a::text,true);
  perform set_config('uskoci.ru4_response_b',response_b::text,true);
  perform set_config('uskoci.ru4_response_c',response_c::text,true);
end
$seed$;

set local role authenticated;

-- Attacker cannot edit another Requester's task.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_attacker'),true);
do $attacker$
declare
  denied boolean := false;
  m jsonb := jsonb_build_object(
    'title','RU4 edited task','description','New task terms','category','proof','requiredSlots',2,
    'mode','MY_PRICE','requesterPriceRsd',5500,'requiredSkills',jsonb_build_array('proof'),
    'requiredTools','[]'::jsonb,'requiredVehicles','[]'::jsonb,'requiredLicenses','[]'::jsonb,
    'minimumExperienceYears',0,'verifiedIdentityRequired',false,'scheduleKind','FLEXIBLE',
    'startsAt',null,'endsAt',null,'executionLocationMode','REMOTE','approximateLat',null,
    'approximateLng',null,'approximateCity','Novi Sad','approximateArea','Centar',
    'publicPhotoPaths','[]'::jsonb,'privateLocation',null
  );
begin
  begin
    perform public.rpc_confirm_need_edit(current_setting('uskoci.ru4_need')::uuid,1,'ru4-lock-attack',m);
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'RU4_LOCK_ATTACKER_EDIT_ALLOWED'; end if;
end
$attacker$;

-- Owner confirmation: old public task remains unchanged until this call; this call atomically creates DRAFT rev2.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_requester'),true);
do $edit$
declare
  nid uuid := current_setting('uskoci.ru4_need')::uuid;
  m jsonb := jsonb_build_object(
    'title','RU4 edited task','description','New task terms','category','proof','requiredSlots',2,
    'mode','MY_PRICE','requesterPriceRsd',5500,'requiredSkills',jsonb_build_array('proof'),
    'requiredTools','[]'::jsonb,'requiredVehicles','[]'::jsonb,'requiredLicenses','[]'::jsonb,
    'minimumExperienceYears',0,'verifiedIdentityRequired',false,'scheduleKind','FLEXIBLE',
    'startsAt',null,'endsAt',null,'executionLocationMode','REMOTE','approximateLat',null,
    'approximateLng',null,'approximateCity','Novi Sad','approximateArea','Centar',
    'publicPhotoPaths','[]'::jsonb,'privateLocation',null
  );
  r jsonb; r2 jsonb; s text; rev integer; cnt integer; price integer;
begin
  select title,revision into s,rev from public.needs where id=nid;
  if s<>'RU4 old task' or rev<>1 then raise exception 'RU4_LOCK_PRECONFIRM_TASK_MUTATED'; end if;

  r := public.rpc_confirm_need_edit(nid,1,'ru4-lock-edit-1',m);
  if r->>'status'<>'DRAFT' or (r->>'revision')::integer<>2 or not (r->>'requiresReadmission')::boolean then
    raise exception 'RU4_LOCK_EDIT_BAD_RESULT' using detail=r::text;
  end if;

  select status,revision,requester_price_rsd into s,rev,price from public.needs where id=nid;
  if s<>'DRAFT' or rev<>2 or price<>5500 then raise exception 'RU4_LOCK_EDIT_NOT_DRAFT_REV2'; end if;

  select count(*) into cnt from public.marketplace_responses
   where need_id=nid and status='STALE_REVIEW_REQUIRED' and submitted_against_need_revision=1;
  if cnt<>3 then raise exception 'RU4_LOCK_PRIOR_APPLICATIONS_NOT_ALL_STALE'; end if;

  r2 := public.rpc_confirm_need_edit(nid,1,'ru4-lock-edit-1',m);
  if not coalesce((r2->>'idempotentReplay')::boolean,false) or (r2->>'revision')::integer<>2 then
    raise exception 'RU4_LOCK_EDIT_REPLAY_NOT_STABLE';
  end if;

  begin
    perform public.rpc_confirm_need_edit(nid,1,'ru4-lock-edit-1',m||jsonb_build_object('title','DIFFERENT'));
    raise exception 'RU4_LOCK_EDIT_KEY_REUSE_ALLOWED';
  exception when sqlstate '22023' then
    if sqlerrm<>'IDEMPOTENCY_KEY_REUSED' then raise; end if;
  end;
end
$edit$;

reset role;
-- Proof-only republish fixture: this is not a production D-0140 decision. It exists only inside the rollback transaction.
do $republish$
declare nid uuid:=current_setting('uskoci.ru4_need')::uuid;
begin
  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  update public.needs
     set status='PUBLISHED',published_at=statement_timestamp(),response_deadline=statement_timestamp()+interval '2 days'
   where id=nid and revision=2 and status='DRAFT';
  perform set_config('uskoci.need_lifecycle','',true);
end
$republish$;

set local role authenticated;

-- Worker A explicitly accepts the changed task. Same Prijava aggregate, new immutable version/revision.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_worker_a'),true);
do $keep$
declare rid uuid:=current_setting('uskoci.ru4_response_a')::uuid; r jsonb; r2 jsonb; s text; ver integer; nrev integer;
begin
  r := public.rpc_resolve_stale_response_after_need_edit(rid,1,2,'ru4-keep-a','KEEP',null,null,null,null,null);
  if r->>'status'<>'SUBMITTED' or (r->>'version')::integer<>2 or (r->>'needRevision')::integer<>2 then
    raise exception 'RU4_LOCK_KEEP_BAD_RESULT' using detail=r::text;
  end if;
  select status,current_version,submitted_against_need_revision into s,ver,nrev from public.marketplace_responses where id=rid;
  if s<>'SUBMITTED' or ver<>2 or nrev<>2 then raise exception 'RU4_LOCK_KEEP_NOT_REBOUND'; end if;
  r2 := public.rpc_resolve_stale_response_after_need_edit(rid,1,2,'ru4-keep-a','KEEP',null,null,null,null,null);
  if not coalesce((r2->>'idempotentReplay')::boolean,false) then raise exception 'RU4_LOCK_KEEP_REPLAY_NOT_STABLE'; end if;
end
$keep$;

-- Worker B changes their own Prijava before accepting the new revision.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_worker_b'),true);
do $update_response$
declare rid uuid:=current_setting('uskoci.ru4_response_b')::uuid; r jsonb; s text; ver integer; nrev integer; price integer;
begin
  r := public.rpc_resolve_stale_response_after_need_edit(rid,1,2,'ru4-update-b','UPDATE',1,6000,null,null,'updated after task change');
  if r->>'status'<>'SUBMITTED' or (r->>'version')::integer<>2 then raise exception 'RU4_LOCK_UPDATE_BAD_RESULT'; end if;
  select status,current_version,submitted_against_need_revision,price_rsd into s,ver,nrev,price from public.marketplace_responses where id=rid;
  if s<>'SUBMITTED' or ver<>2 or nrev<>2 or price<>6000 then raise exception 'RU4_LOCK_UPDATE_NOT_REBOUND'; end if;
end
$update_response$;

-- Worker C explicitly withdraws; it never silently returns to the requester list.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_worker_c'),true);
do $withdraw$
declare rid uuid:=current_setting('uskoci.ru4_response_c')::uuid; r jsonb; s text;
begin
  r := public.rpc_resolve_stale_response_after_need_edit(rid,1,2,'ru4-withdraw-c','WITHDRAW',null,null,null,null,null);
  if r->>'status'<>'WITHDRAWN' then raise exception 'RU4_LOCK_WITHDRAW_BAD_RESULT'; end if;
  select status into s from public.marketplace_responses where id=rid;
  if s<>'WITHDRAWN' then raise exception 'RU4_LOCK_WITHDRAW_NOT_STORED'; end if;
end
$withdraw$;

reset role;

-- Form the first Dogovor from Worker A, then prove parent task editing is permanently locked.
do $form_agreement$
declare
  nid uuid:=current_setting('uskoci.ru4_need')::uuid;
  rid uuid:=current_setting('uskoci.ru4_response_a')::uuid;
  requester uuid:=current_setting('uskoci.ru4_requester')::uuid;
  requester_profile uuid:=current_setting('uskoci.ru4_requester_profile')::uuid;
  worker uuid:=current_setting('uskoci.ru4_worker_a')::uuid;
  worker_profile uuid:=current_setting('uskoci.ru4_worker_a_profile')::uuid;
  sid uuid; aid uuid;
begin
  update public.marketplace_responses set status='SELECTED',selected_at=statement_timestamp() where id=rid;
  insert into public.need_selections(
    need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,
    worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    nid,2,requester,'ru4-lock-selection-a',1,rid,worker,worker_profile,'REQUESTER_SELECTS','SELECTED'
  ) returning id into sid;

  insert into public.agreements(
    need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values (
    nid,sid,rid,requester,requester_profile,worker,worker_profile,1,'CONFIRMED'
  ) returning id into aid;
  insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
  values(aid,1,'CONFIRMED',jsonb_build_object('needRevision',2,'priceRsd',5000),repeat('d',64),requester);

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs set status='SELECTION' where id=nid;
  perform set_config('uskoci.need_lifecycle','',true);
end
$form_agreement$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_requester'),true);
do $locked_after_dogovor$
declare
  nid uuid:=current_setting('uskoci.ru4_need')::uuid;
  denied boolean:=false;
  m jsonb := jsonb_build_object(
    'title','RU4 forbidden third revision','description','must not happen','category','proof','requiredSlots',2,
    'mode','MY_PRICE','requesterPriceRsd',6500,'requiredSkills',jsonb_build_array('proof'),
    'requiredTools','[]'::jsonb,'requiredVehicles','[]'::jsonb,'requiredLicenses','[]'::jsonb,
    'minimumExperienceYears',0,'verifiedIdentityRequired',false,'scheduleKind','FLEXIBLE',
    'startsAt',null,'endsAt',null,'executionLocationMode','REMOTE','approximateLat',null,
    'approximateLng',null,'approximateCity','Novi Sad','approximateArea','Centar',
    'publicPhotoPaths','[]'::jsonb,'privateLocation',null
  );
begin
  begin
    perform public.rpc_confirm_need_edit(nid,2,'ru4-after-dogovor',m);
  exception when sqlstate 'P0001' then
    if sqlerrm='NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'RU4_LOCK_EDIT_AFTER_DOGOVOR_ALLOWED'; end if;
end
$locked_after_dogovor$;

reset role;

do $private_assert$
declare nid uuid:=current_setting('uskoci.ru4_need')::uuid; cnt integer;
begin
  select count(*) into cnt from private.need_edit_commands where need_id=nid;
  if cnt<>1 then raise exception 'RU4_LOCK_EDIT_COMMAND_COUNT_BAD'; end if;
  select count(*) into cnt from private.need_revision_events where need_id=nid and from_revision=1 and to_revision=2;
  if cnt<>1 then raise exception 'RU4_LOCK_REVISION_EVENT_COUNT_BAD'; end if;
  select count(*) into cnt from private.response_revision_resolution_commands
   where response_id in (
     current_setting('uskoci.ru4_response_a')::uuid,
     current_setting('uskoci.ru4_response_b')::uuid,
     current_setting('uskoci.ru4_response_c')::uuid
   );
  if cnt<>3 then raise exception 'RU4_LOCK_RESPONSE_RESOLUTION_COMMAND_COUNT_BAD'; end if;
  if exists(select 1 from private.dispatch_schedule where need_id=nid and current_setting('uskoci.ru4_requester')<>'' ) then
    raise exception 'RU4_LOCK_OLD_DISPATCH_SCHEDULE_SURVIVED_EDIT';
  end if;
end
$private_assert$;

select 'PASS RU4_OWNER_EDIT_LOCK owner_only atomic_confirm rev2_stale_all explicit_keep_update_withdraw same_response_history first_dogovor_permanent_lock no_silent_reconfirm' as proof_result;
rollback;