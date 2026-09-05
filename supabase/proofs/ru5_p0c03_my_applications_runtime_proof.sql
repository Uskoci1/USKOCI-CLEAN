-- RU-5 / P0C-03 rollback-only authenticated runtime proof.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.application_for(p_rows jsonb, p_need_id uuid)
returns jsonb
language sql
as $$
  select e.value
  from jsonb_array_elements(p_rows) e(value)
  where e.value->>'needId' = p_need_id::text
  limit 1
$$;

create or replace function pg_temp.expect_withdraw_error(
  p_response_id uuid,
  p_need_revision integer,
  p_response_version integer,
  p_request_id text,
  p_reason text,
  p_expected text
) returns void
language plpgsql
as $$
begin
  begin
    perform public.rpc_withdraw_response(
      p_response_id,p_need_revision,p_response_version,p_request_id,p_reason
    );
  exception when others then
    if sqlerrm = p_expected then return; end if;
    raise exception 'RU5_P0C03_EXPECTED_%, GOT_% (%): %',p_expected,sqlerrm,sqlstate,sqlerrm;
  end;
  raise exception 'RU5_P0C03_EXPECTED_ERROR_NOT_RAISED: %',p_expected;
end;
$$;

do $seed$
declare
  requester uuid := extensions.gen_random_uuid();
  worker uuid := extensions.gen_random_uuid();
  other_worker uuid := extensions.gen_random_uuid();
  requester_pid uuid;
  worker_pid uuid;
  other_worker_pid uuid;
  n_submitted uuid := extensions.gen_random_uuid();
  n_delivered uuid := extensions.gen_random_uuid();
  n_viewed uuid := extensions.gen_random_uuid();
  n_shortlisted uuid := extensions.gen_random_uuid();
  n_stale uuid := extensions.gen_random_uuid();
  n_withdrawn uuid := extensions.gen_random_uuid();
  n_selected uuid := extensions.gen_random_uuid();
  n_closed uuid := extensions.gen_random_uuid();
  n_draft_response uuid := extensions.gen_random_uuid();
  n_other uuid := extensions.gen_random_uuid();
  r_submitted uuid := extensions.gen_random_uuid();
  r_delivered uuid := extensions.gen_random_uuid();
  r_viewed uuid := extensions.gen_random_uuid();
  r_shortlisted uuid := extensions.gen_random_uuid();
  r_stale uuid := extensions.gen_random_uuid();
  r_withdrawn uuid := extensions.gen_random_uuid();
  r_selected uuid := extensions.gen_random_uuid();
  r_closed uuid := extensions.gen_random_uuid();
  r_draft uuid := extensions.gen_random_uuid();
  r_other uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','ru5-p0c03-requester-'||requester||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0C03 Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker,'authenticated','authenticated','ru5-p0c03-worker-'||worker||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0C03 Worker','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp()),
  (other_worker,'authenticated','authenticated','ru5-p0c03-other-'||other_worker||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0C03 Other','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp());

  select id into requester_pid from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_pid from public.app_profiles where account_id=worker and kind='WORKER';
  select id into other_worker_pid from public.app_profiles where account_id=other_worker and kind='WORKER';
  if requester_pid is null or worker_pid is null or other_worker_pid is null then
    raise exception 'RU5_P0C03_PROFILE_SEED_FAILED';
  end if;

  update public.app_profiles set display_name='P0C03 Worker',city='Novi Sad',skills=array['Proof'],team_capacity=2 where id=worker_pid;
  update public.app_profiles set display_name='P0C03 Other',city='Novi Sad',skills=array['Proof'],team_capacity=2 where id=other_worker_pid;
  alter table public.app_profiles disable trigger guard_profile_write_trg;
  update public.app_profiles set profile_status='ACTIVE' where id in(worker_pid,other_worker_pid);
  alter table public.app_profiles enable trigger guard_profile_write_trg;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,response_deadline,published_at) values
  (n_submitted,requester,requester_pid,'PUBLISHED','P0C03 submitted','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_delivered,requester,requester_pid,'PUBLISHED','P0C03 delivered','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_viewed,requester,requester_pid,'PUBLISHED','P0C03 viewed','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_shortlisted,requester,requester_pid,'PUBLISHED','P0C03 shortlisted','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_stale,requester,requester_pid,'PUBLISHED','P0C03 stale','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_withdrawn,requester,requester_pid,'PUBLISHED','P0C03 withdrawn','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_selected,requester,requester_pid,'PUBLISHED','P0C03 selected','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_closed,requester,requester_pid,'PUBLISHED','P0C03 closed','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_draft_response,requester,requester_pid,'PUBLISHED','P0C03 draft response','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_other,requester,requester_pid,'PUBLISHED','P0C03 other worker','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp());
  perform set_config('uskoci.need_lifecycle','',true);

  alter table public.needs disable trigger needs_guard_write;
  update public.needs set revision=2 where id=n_stale;
  alter table public.needs enable trigger needs_guard_write;

  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at,withdrawn_at) values
  (r_submitted,n_submitted,worker,worker_pid,'OFFER','SUBMITTED',1,1,1,1100,'submitted note',statement_timestamp()-interval '9 minutes',null),
  (r_delivered,n_delivered,worker,worker_pid,'OFFER','DELIVERED',1,1,1,1200,'delivered note',statement_timestamp()-interval '8 minutes',null),
  (r_viewed,n_viewed,worker,worker_pid,'OFFER','VIEWED',1,1,1,1300,'viewed note',statement_timestamp()-interval '7 minutes',null),
  (r_shortlisted,n_shortlisted,worker,worker_pid,'OFFER','SHORTLISTED',1,1,1,1400,'shortlisted note',statement_timestamp()-interval '6 minutes',null),
  (r_stale,n_stale,worker,worker_pid,'OFFER','STALE_REVIEW_REQUIRED',1,1,1,1500,'stale note',statement_timestamp()-interval '5 minutes',null),
  (r_withdrawn,n_withdrawn,worker,worker_pid,'OFFER','WITHDRAWN',1,1,1,1600,'withdrawn note',statement_timestamp()-interval '4 minutes',statement_timestamp()-interval '1 minute'),
  (r_selected,n_selected,worker,worker_pid,'OFFER','SUBMITTED',1,1,1,1700,'selected note',statement_timestamp()-interval '3 minutes',null),
  (r_closed,n_closed,worker,worker_pid,'OFFER','NOT_SELECTED',1,1,1,1800,'closed note',statement_timestamp()-interval '2 minutes',null),
  (r_draft,n_draft_response,worker,worker_pid,'OFFER','DRAFT',1,1,1,1900,'draft note',statement_timestamp()-interval '1 minute',null),
  (r_other,n_other,other_worker,other_worker_pid,'OFFER','SUBMITTED',1,1,1,2100,'other note',statement_timestamp(),null);

  insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,scope_note,content_hash) values
  (r_submitted,1,1,1,1100,'submitted note',repeat('1',64)),
  (r_delivered,1,1,1,1200,'delivered note',repeat('2',64)),
  (r_viewed,1,1,1,1300,'viewed note',repeat('3',64)),
  (r_shortlisted,1,1,1,1400,'shortlisted note',repeat('4',64)),
  (r_stale,1,1,1,1500,'stale note',repeat('5',64)),
  (r_withdrawn,1,1,1,1600,'withdrawn note',repeat('6',64)),
  (r_selected,1,1,1,1700,'selected note',repeat('7',64)),
  (r_closed,1,1,1,1800,'closed note',repeat('8',64)),
  (r_draft,1,1,1,1900,'draft note',repeat('9',64)),
  (r_other,1,1,1,2100,'other note',repeat('a',64));

  perform set_config('uskoci.p0c03_requester',requester::text,true);
  perform set_config('uskoci.p0c03_worker',worker::text,true);
  perform set_config('uskoci.p0c03_other_worker',other_worker::text,true);
  perform set_config('uskoci.p0c03_n_submitted',n_submitted::text,true);
  perform set_config('uskoci.p0c03_n_delivered',n_delivered::text,true);
  perform set_config('uskoci.p0c03_n_viewed',n_viewed::text,true);
  perform set_config('uskoci.p0c03_n_shortlisted',n_shortlisted::text,true);
  perform set_config('uskoci.p0c03_n_stale',n_stale::text,true);
  perform set_config('uskoci.p0c03_n_withdrawn',n_withdrawn::text,true);
  perform set_config('uskoci.p0c03_n_selected',n_selected::text,true);
  perform set_config('uskoci.p0c03_n_closed',n_closed::text,true);
  perform set_config('uskoci.p0c03_n_draft',n_draft_response::text,true);
  perform set_config('uskoci.p0c03_n_other',n_other::text,true);
  perform set_config('uskoci.p0c03_r_submitted',r_submitted::text,true);
  perform set_config('uskoci.p0c03_r_stale',r_stale::text,true);
  perform set_config('uskoci.p0c03_r_selected',r_selected::text,true);
end
$seed$;

-- Create a real selected Application/Agreement through the existing authority.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0c03_requester'),true);
do $select_real$
declare
  aid uuid;
begin
  aid := public.rpc_select_response(
    current_setting('uskoci.p0c03_n_selected')::uuid,
    1,
    current_setting('uskoci.p0c03_r_selected')::uuid,
    1,
    repeat('7',64),
    'p0c03-selection-proof'
  );
  if aid is null then raise exception 'RU5_P0C03_SELECTION_NO_AGREEMENT'; end if;
  perform set_config('uskoci.p0c03_agreement',aid::text,true);
end
$select_real$;
reset role;

-- Own-only projection and canonical lifecycle mapping.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0c03_worker'),true);
do $projection$
declare
  rows jsonb := public.rpc_list_my_applications();
  item jsonb;
begin
  if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)<>8 then
    raise exception 'RU5_P0C03_OWN_COUNT_INVALID %',rows;
  end if;

  item := pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_submitted')::uuid);
  if item->>'state'<>'SUBMITTED' or (item->>'canWithdraw')::boolean is not true then raise exception 'RU5_P0C03_SUBMITTED_MAP %',item; end if;

  item := pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_delivered')::uuid);
  if item->>'state'<>'SUBMITTED' or (item->>'canWithdraw')::boolean is not true then raise exception 'RU5_P0C03_DELIVERED_NOT_HIDDEN %',item; end if;

  item := pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_viewed')::uuid);
  if item->>'state'<>'VIEWED' or (item->>'canWithdraw')::boolean is not true then raise exception 'RU5_P0C03_VIEWED_MAP %',item; end if;

  item := pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_shortlisted')::uuid);
  if item->>'state'<>'SHORTLISTED' or (item->>'canWithdraw')::boolean is not true then raise exception 'RU5_P0C03_SHORTLIST_MAP %',item; end if;

  item := pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_stale')::uuid);
  if item->>'state'<>'STALE_REVIEW_REQUIRED' or (item->>'requiresStaleReview')::boolean is not true or (item->>'canWithdraw')::boolean is true then raise exception 'RU5_P0C03_STALE_MAP %',item; end if;

  item := pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_withdrawn')::uuid);
  if item->>'state'<>'WITHDRAWN' or (item->>'canWithdraw')::boolean is true then raise exception 'RU5_P0C03_WITHDRAWN_MAP %',item; end if;

  item := pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_selected')::uuid);
  if item->>'state'<>'SELECTED' or item->>'agreementId'<>current_setting('uskoci.p0c03_agreement') or (item->>'canWithdraw')::boolean is true or (item->>'attentionRequired')::boolean is not true then raise exception 'RU5_P0C03_SELECTED_MAP %',item; end if;

  item := pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_closed')::uuid);
  if item->>'state'<>'CLOSED' or (item->>'canWithdraw')::boolean is true then raise exception 'RU5_P0C03_CLOSED_MAP %',item; end if;

  if pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_draft')::uuid) is not null
     or pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_other')::uuid) is not null then
    raise exception 'RU5_P0C03_DRAFT_OR_OTHER_LEAKED';
  end if;

  if exists (
    select 1 from jsonb_array_elements(rows) e(value)
    where e.value ?| array['workerAccountId','requesterAccountId','workerProfileId','requesterProfileId','exactAddress','phone','email']
  ) then
    raise exception 'RU5_P0C03_PRIVATE_FIELD_LEAK';
  end if;
end
$projection$;

-- Authenticated direct response mutation remains denied.
do $direct_update$
begin
  begin
    update public.marketplace_responses set status='WITHDRAWN'
     where id=current_setting('uskoci.p0c03_r_submitted')::uuid;
  exception when others then
    if sqlstate='42501' then return; end if;
    raise;
  end;
  raise exception 'RU5_P0C03_DIRECT_UPDATE_UNEXPECTEDLY_SUCCEEDED';
end
$direct_update$;

-- Standard active withdraw is exact, replay-safe, and immediately reflected in projection.
do $withdraw_replay$
declare
  first_result jsonb;
  replay_result jsonb;
  item jsonb;
  rid uuid := current_setting('uskoci.p0c03_r_submitted')::uuid;
begin
  first_result := public.rpc_withdraw_response(rid,1,1,'p0c03-withdraw-standard','proof');
  if first_result->>'status'<>'WITHDRAWN' or (first_result->>'authoritative')::boolean is not true then raise exception 'RU5_P0C03_WITHDRAW_RESULT %',first_result; end if;
  replay_result := public.rpc_withdraw_response(rid,1,1,'p0c03-withdraw-standard','proof');
  if replay_result->>'responseId'<>first_result->>'responseId' or (replay_result->>'idempotentReplay')::boolean is not true then raise exception 'RU5_P0C03_WITHDRAW_REPLAY %',replay_result; end if;
  item := pg_temp.application_for(public.rpc_list_my_applications(),current_setting('uskoci.p0c03_n_submitted')::uuid);
  if item->>'state'<>'WITHDRAWN' or (item->>'canWithdraw')::boolean is true then raise exception 'RU5_P0C03_WITHDRAW_PROJECTION %',item; end if;
end
$withdraw_replay$;
select pg_temp.expect_withdraw_error(current_setting('uskoci.p0c03_r_submitted')::uuid,1,1,'p0c03-withdraw-standard','different','IDEMPOTENCY_KEY_REUSED');

-- Selected cannot be withdrawn by the standard port.
select pg_temp.expect_withdraw_error(current_setting('uskoci.p0c03_r_selected')::uuid,1,1,'p0c03-withdraw-selected','proof','RESPONSE_ALREADY_SELECTED');

-- Stale decisions remain the already-proven RU-4 authority, not generic withdraw.
do $stale_withdraw$
declare
  result jsonb;
  item jsonb;
begin
  result := public.rpc_resolve_stale_response_after_need_edit(
    current_setting('uskoci.p0c03_r_stale')::uuid,
    1,
    2,
    'p0c03-stale-withdraw',
    'WITHDRAW',
    null,null,null,null,null
  );
  if result->>'status'<>'WITHDRAWN' then raise exception 'RU5_P0C03_STALE_WITHDRAW_RESULT %',result; end if;
  item := pg_temp.application_for(public.rpc_list_my_applications(),current_setting('uskoci.p0c03_n_stale')::uuid);
  if item->>'state'<>'WITHDRAWN' then raise exception 'RU5_P0C03_STALE_WITHDRAW_PROJECTION %',item; end if;
end
$stale_withdraw$;
reset role;

-- Another Worker sees only their own Application.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0c03_other_worker'),true);
do $other_worker$
declare rows jsonb := public.rpc_list_my_applications();
begin
  if jsonb_array_length(rows)<>1
     or pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_other')::uuid) is null
     or pg_temp.application_for(rows,current_setting('uskoci.p0c03_n_viewed')::uuid) is not null then
    raise exception 'RU5_P0C03_OTHER_WORKER_SCOPE %',rows;
  end if;
end
$other_worker$;
reset role;

-- Exactly one standard withdrawal command/event despite replay; selected denial leaves none.
do $storage$
begin
  if (select count(*) from private.response_withdraw_commands c where c.worker_account_id=current_setting('uskoci.p0c03_worker')::uuid and c.client_request_id='p0c03-withdraw-standard')<>1 then raise exception 'RU5_P0C03_WITHDRAW_COMMAND_COUNT'; end if;
  if (select count(*) from public.user_activity_events e where e.entity_type='RESPONSE' and e.entity_id=current_setting('uskoci.p0c03_r_submitted')::uuid and e.event_type='RESPONSE_WITHDRAWN')<>1 then raise exception 'RU5_P0C03_WITHDRAW_EVENT_COUNT'; end if;
  if exists(select 1 from private.response_withdraw_commands c where c.client_request_id='p0c03-withdraw-selected') then raise exception 'RU5_P0C03_SELECTED_DENIAL_LEFT_COMMAND'; end if;
end
$storage$;

\echo 'PASS RU5_P0C03 own_only canonical_states delivered_hidden draft_excluded privacy_safe selected_agreement standard_withdraw exact_replay selected_denied stale_ru4_path direct_update_denied rollback_only'
rollback;
