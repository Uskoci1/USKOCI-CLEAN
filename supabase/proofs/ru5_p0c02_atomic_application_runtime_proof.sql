-- RU-5 / P0C-02 rollback-only authenticated runtime proof.
\set ON_ERROR_STOP on
begin;

-- Helper runs the real authenticated RPC and requires one exact product error.
create or replace function pg_temp.expect_submit_error(
  p_need_id uuid,
  p_need_revision integer,
  p_worker_profile_id uuid,
  p_covered_slots integer,
  p_price_rsd integer,
  p_client_request_id text,
  p_expected text
) returns void
language plpgsql
as $$
begin
  begin
    perform public.rpc_submit_response(
      p_need_id,p_need_revision,p_worker_profile_id,p_covered_slots,p_price_rsd,
      null,null,null,p_client_request_id
    );
  exception when others then
    if sqlerrm = p_expected then return; end if;
    raise exception 'RU5_P0C02_EXPECTED_%, GOT_% (%): %',p_expected,sqlerrm,sqlstate,sqlerrm;
  end;
  raise exception 'RU5_P0C02_EXPECTED_ERROR_NOT_RAISED: %',p_expected;
end;
$$;

do $seed$
declare
  requester uuid := extensions.gen_random_uuid();
  worker uuid := extensions.gen_random_uuid();
  draft_worker uuid := extensions.gen_random_uuid();
  legacy_unready uuid := extensions.gen_random_uuid();
  selected_worker uuid := extensions.gen_random_uuid();
  requester_pid uuid; worker_requester_pid uuid; worker_pid uuid;
  draft_pid uuid; legacy_pid uuid; selected_pid uuid;
  need_happy uuid := extensions.gen_random_uuid();
  need_fixed uuid := extensions.gen_random_uuid();
  need_team uuid := extensions.gen_random_uuid();
  need_remaining uuid := extensions.gen_random_uuid();
  need_expired uuid := extensions.gen_random_uuid();
  need_cancelled uuid := extensions.gen_random_uuid();
  need_completed uuid := extensions.gen_random_uuid();
  need_own uuid := extensions.gen_random_uuid();
  need_withdraw uuid := extensions.gen_random_uuid();
  seeded_response uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','ru5-p0c02-requester-'||requester||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0C02 Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker,'authenticated','authenticated','ru5-p0c02-worker-'||worker||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0C02 Worker','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp()),
  (draft_worker,'authenticated','authenticated','ru5-p0c02-draft-'||draft_worker||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0C02 Draft','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp()),
  (legacy_unready,'authenticated','authenticated','ru5-p0c02-legacy-'||legacy_unready||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0C02 Legacy','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (selected_worker,'authenticated','authenticated','ru5-p0c02-selected-'||selected_worker||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0C02 Selected','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp());

  select id into requester_pid from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_requester_pid from public.app_profiles where account_id=worker and kind='REQUESTER';
  select id into worker_pid from public.app_profiles where account_id=worker and kind='WORKER';
  select id into draft_pid from public.app_profiles where account_id=draft_worker and kind='WORKER';
  select id into legacy_pid from public.app_profiles where account_id=legacy_unready and kind='WORKER';
  select id into selected_pid from public.app_profiles where account_id=selected_worker and kind='WORKER';
  if requester_pid is null or worker_requester_pid is null or worker_pid is null or draft_pid is null or legacy_pid is null or selected_pid is null then
    raise exception 'RU5_P0C02_PROFILE_SEED_FAILED';
  end if;

  update public.app_profiles set display_name='P0C02 Worker',city='Novi Sad',skills=array['Proof'],team_capacity=2,tools=array['ProofTool'] where id=worker_pid;
  update public.app_profiles set display_name='P0C02 Draft',city='Novi Sad',skills=array['Proof'],team_capacity=2 where id=draft_pid;
  update public.app_profiles set display_name='P0C02 Legacy',city='Novi Sad',skills=array[]::text[],team_capacity=2 where id=legacy_pid;
  update public.app_profiles set display_name='P0C02 Selected',city='Novi Sad',skills=array['Proof'],team_capacity=2 where id=selected_pid;

  alter table public.app_profiles disable trigger guard_profile_write_trg;
  update public.app_profiles set profile_status='ACTIVE' where id in(worker_pid,legacy_pid,selected_pid);
  alter table public.app_profiles enable trigger guard_profile_write_trg;

  if not exists(select 1 from pg_trigger where tgrelid='public.app_profiles'::regclass and tgname='guard_profile_write_trg' and tgenabled='O') then
    raise exception 'RU5_P0C02_PROFILE_GUARD_NOT_RESTORED';
  end if;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,mode,requester_price_rsd,required_slots,response_deadline,published_at) values
  (need_happy,requester,requester_pid,'PUBLISHED','P0C02 happy','proof','PROOF','Novi Sad','OFFERS',null,2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (need_fixed,requester,requester_pid,'PUBLISHED','P0C02 fixed','proof','PROOF','Novi Sad','MY_PRICE',5000,2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (need_team,requester,requester_pid,'PUBLISHED','P0C02 team','proof','PROOF','Novi Sad','OFFERS',null,4,statement_timestamp()+interval '2 days',statement_timestamp()),
  (need_remaining,requester,requester_pid,'PUBLISHED','P0C02 remaining','proof','PROOF','Novi Sad','OFFERS',null,3,statement_timestamp()+interval '2 days',statement_timestamp()),
  (need_expired,requester,requester_pid,'PUBLISHED','P0C02 expired','proof','PROOF','Novi Sad','OFFERS',null,2,statement_timestamp()-interval '1 minute',statement_timestamp()-interval '1 day'),
  (need_own,worker,worker_requester_pid,'PUBLISHED','P0C02 own','proof','PROOF','Novi Sad','OFFERS',null,2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (need_withdraw,requester,requester_pid,'PUBLISHED','P0C02 withdraw','proof','PROOF','Novi Sad','OFFERS',null,2,statement_timestamp()+interval '2 days',statement_timestamp());
  perform set_config('uskoci.need_lifecycle','',true);

  alter table public.needs disable trigger needs_guard_write;
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,mode,required_slots) values
  (need_cancelled,requester,requester_pid,'CANCELLED','P0C02 cancelled','proof','PROOF','Novi Sad','OFFERS',2),
  (need_completed,requester,requester_pid,'COMPLETED','P0C02 completed','proof','PROOF','Novi Sad','OFFERS',2);
  alter table public.needs enable trigger needs_guard_write;

  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,covered_slots,price_rsd,submitted_at,selected_at)
  values(seeded_response,need_remaining,selected_worker,selected_pid,'OFFER','SELECTED',1,1,2,1000,statement_timestamp(),statement_timestamp());
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,content_hash)
  values(seeded_response,1,1,1000,2,repeat('a',64));
  insert into public.need_selections(need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode,status)
  values(need_remaining,1,requester,'ru5-p0c02-seeded-selection',2,seeded_response,selected_worker,selected_pid,'REQUESTER_SELECTS','SELECTED');

  perform set_config('uskoci.p0c02_requester',requester::text,true);
  perform set_config('uskoci.p0c02_worker',worker::text,true);
  perform set_config('uskoci.p0c02_draft_worker',draft_worker::text,true);
  perform set_config('uskoci.p0c02_legacy_unready',legacy_unready::text,true);
  perform set_config('uskoci.p0c02_requester_pid',requester_pid::text,true);
  perform set_config('uskoci.p0c02_worker_pid',worker_pid::text,true);
  perform set_config('uskoci.p0c02_draft_pid',draft_pid::text,true);
  perform set_config('uskoci.p0c02_legacy_pid',legacy_pid::text,true);
  perform set_config('uskoci.p0c02_need_happy',need_happy::text,true);
  perform set_config('uskoci.p0c02_need_fixed',need_fixed::text,true);
  perform set_config('uskoci.p0c02_need_team',need_team::text,true);
  perform set_config('uskoci.p0c02_need_remaining',need_remaining::text,true);
  perform set_config('uskoci.p0c02_need_expired',need_expired::text,true);
  perform set_config('uskoci.p0c02_need_cancelled',need_cancelled::text,true);
  perform set_config('uskoci.p0c02_need_completed',need_completed::text,true);
  perform set_config('uskoci.p0c02_need_own',need_own::text,true);
  perform set_config('uskoci.p0c02_need_withdraw',need_withdraw::text,true);
end
$seed$;

-- Baseline proving every rejected submit is a zero-write subtransaction.
do $baseline$
begin
  perform set_config('uskoci.p0c02_base_responses',(select count(*)::text from public.marketplace_responses),true);
  perform set_config('uskoci.p0c02_base_versions',(select count(*)::text from public.marketplace_response_versions),true);
  perform set_config('uskoci.p0c02_base_commands',(select count(*)::text from private.response_submit_commands),true);
  perform set_config('uskoci.p0c02_base_snapshots',(select count(*)::text from private.response_application_snapshots),true);
  perform set_config('uskoci.p0c02_base_events',(select count(*)::text from public.user_activity_events),true);
end
$baseline$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0c02_worker'),true);
select set_config('request.jwt.claims','',true);

do $direct_insert$
begin
  begin
    insert into public.marketplace_responses(need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,covered_slots,price_rsd)
    values(current_setting('uskoci.p0c02_need_happy')::uuid,current_setting('uskoci.p0c02_worker')::uuid,current_setting('uskoci.p0c02_worker_pid')::uuid,'OFFER','SUBMITTED',1,1,1000);
  exception when others then
    if sqlstate='42501' then return; end if;
    raise;
  end;
  raise exception 'RU5_P0C02_DIRECT_INSERT_UNEXPECTEDLY_SUCCEEDED';
end
$direct_insert$;

select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_happy')::uuid,1,current_setting('uskoci.p0c02_requester_pid')::uuid,1,1000,'p0c02-wrong-profile','PROFILE_NOT_OWNED_BY_ACCOUNT');
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_own')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,1,1000,'p0c02-own-need','OWN_NEED');
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_cancelled')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,1,1000,'p0c02-cancelled','NEED_NOT_OPEN');
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_completed')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,1,1000,'p0c02-completed','NEED_NOT_OPEN');
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_expired')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,1,1000,'p0c02-expired','RESPONSE_WINDOW_EXPIRED');
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_happy')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,0,1000,'p0c02-invalid-slots','INVALID_COVERED_SLOTS');
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_team')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,3,1000,'p0c02-over-team','TEAM_CAPACITY_EXCEEDED');
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_remaining')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,2,1000,'p0c02-over-remaining','NEED_REMAINING_CAPACITY_EXCEEDED');
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_fixed')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,1,4999,'p0c02-fixed-mismatch','FIXED_PRICE_MISMATCH');

select set_config('request.jwt.claim.sub',current_setting('uskoci.p0c02_draft_worker'),true);
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_happy')::uuid,1,current_setting('uskoci.p0c02_draft_pid')::uuid,1,1000,'p0c02-draft','WORKER_PROFILE_NOT_READY');
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0c02_legacy_unready'),true);
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_happy')::uuid,1,current_setting('uskoci.p0c02_legacy_pid')::uuid,1,1000,'p0c02-legacy-unready','WORKER_PROFILE_NOT_READY');
reset role;

do $failure_atomicity$
begin
  if (select count(*) from public.marketplace_responses) <> current_setting('uskoci.p0c02_base_responses')::bigint
     or (select count(*) from public.marketplace_response_versions) <> current_setting('uskoci.p0c02_base_versions')::bigint
     or (select count(*) from private.response_submit_commands) <> current_setting('uskoci.p0c02_base_commands')::bigint
     or (select count(*) from private.response_application_snapshots) <> current_setting('uskoci.p0c02_base_snapshots')::bigint
     or (select count(*) from public.user_activity_events) <> current_setting('uskoci.p0c02_base_events')::bigint then
    raise exception 'RU5_P0C02_FAILURE_LEFT_PARTIAL_ROWS';
  end if;
end
$failure_atomicity$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0c02_worker'),true);

do $happy_replay$
declare first_result jsonb; replay_result jsonb;
begin
  first_result := public.rpc_submit_response(current_setting('uskoci.p0c02_need_fixed')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,1,5000,null,null,null,'p0c02-happy-fixed');
  if first_result->>'status'<>'SUBMITTED' or (first_result->>'version')::integer<>1 or first_result->>'pricingMode'<>'MY_PRICE'
     or first_result->>'snapshotSchema'<>'APPLICATION_V1_SELF_DECLARED' or (first_result->>'authoritative')::boolean is not true then
    raise exception 'RU5_P0C02_HAPPY_RESULT_INVALID %',first_result;
  end if;
  perform set_config('uskoci.p0c02_happy_response',first_result->>'responseId',true);
  perform set_config('uskoci.p0c02_happy_hash',first_result->>'contentHash',true);

  replay_result := public.rpc_submit_response(current_setting('uskoci.p0c02_need_fixed')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,1,5000,null,null,null,'p0c02-happy-fixed');
  if replay_result->>'responseId'<>first_result->>'responseId' or replay_result->>'contentHash'<>first_result->>'contentHash'
     or (replay_result->>'version')::integer<>1 or (replay_result->>'idempotentReplay')::boolean is not true then
    raise exception 'RU5_P0C02_REPLAY_NOT_EXACT first=% replay=%',first_result,replay_result;
  end if;
end
$happy_replay$;
select pg_temp.expect_submit_error(current_setting('uskoci.p0c02_need_fixed')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,1,5001,'p0c02-happy-fixed','IDEMPOTENCY_KEY_REUSED');
reset role;

do $happy_storage$
declare rid uuid := current_setting('uskoci.p0c02_happy_response')::uuid;
begin
  if (select count(*) from public.marketplace_responses r where r.id=rid and r.worker_account_id=current_setting('uskoci.p0c02_worker')::uuid and r.worker_profile_id=current_setting('uskoci.p0c02_worker_pid')::uuid and r.current_version=1 and r.covered_slots=1 and r.price_rsd=5000 and r.status='SUBMITTED')<>1 then raise exception 'RU5_P0C02_RESPONSE_ROW_INVALID'; end if;
  if (select count(*) from public.marketplace_response_versions v where v.response_id=rid and v.version=1 and v.content_hash=current_setting('uskoci.p0c02_happy_hash'))<>1 then raise exception 'RU5_P0C02_VERSION_INVALID'; end if;
  if (select count(*) from private.response_submit_commands c where c.response_id=rid and c.response_version=1)<>1 then raise exception 'RU5_P0C02_RECEIPT_INVALID'; end if;
  if (select count(*) from private.response_application_snapshots s where s.response_id=rid and s.response_version=1 and s.worker_team_capacity=2 and s.covered_slots=1 and s.pricing_mode='MY_PRICE' and s.requester_price_rsd=5000)<>1 then raise exception 'RU5_P0C02_SNAPSHOT_INVALID'; end if;
  if (select count(*) from public.user_activity_events e where e.entity_type='RESPONSE' and e.entity_id=rid and e.entity_version=1 and e.event_type='RESPONSE_RECEIVED')<>1 then raise exception 'RU5_P0C02_EVENT_INVALID'; end if;
end
$happy_storage$;

-- Exact Application version/hash remains selectable.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0c02_requester'),true);
do $selection$
declare aid uuid;
begin
  aid := public.rpc_select_response(current_setting('uskoci.p0c02_need_fixed')::uuid,1,current_setting('uskoci.p0c02_happy_response')::uuid,1,current_setting('uskoci.p0c02_happy_hash'),'p0c02-selection-regression');
  if aid is null then raise exception 'RU5_P0C02_SELECTION_NO_AGREEMENT'; end if;
  perform set_config('uskoci.p0c02_agreement',aid::text,true);
end
$selection$;
reset role;

-- Separate new Application remains withdrawable.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0c02_worker'),true);
do $withdraw$
declare r jsonb; w jsonb;
begin
  r := public.rpc_submit_response(current_setting('uskoci.p0c02_need_withdraw')::uuid,1,current_setting('uskoci.p0c02_worker_pid')::uuid,1,1200,null,null,null,'p0c02-withdraw-submit');
  w := public.rpc_withdraw_response((r->>'responseId')::uuid,1,(r->>'version')::integer,'p0c02-withdraw-command','proof');
  if w->>'status'<>'WITHDRAWN' or (w->>'authoritative')::boolean is not true then raise exception 'RU5_P0C02_WITHDRAW_BROKEN %',w; end if;
end
$withdraw$;
reset role;

-- Verify the real blocked inventories, using their actual private-schema names.
do $blocked$
begin
  if (select count(*) from private.publication_policy_bundles)<>0
     or (select count(*) from private.publication_policy_rule_refs)<>0
     or (select count(*) from private.need_publication_decisions)<>0
     or (select count(*) from private.preselection_qa_questions)<>0
     or (select count(*) from private.preselection_qa_answer_versions)<>0
     or (select count(*) from private.preselection_qa_policy_decisions)<>0
     or (select count(*) from private.preselection_qa_materiality_decisions)<>0
     or (select count(*) from private.preselection_qa_commands)<>0 then
    raise exception 'RU5_P0C02_BLOCKED_FEATURE_INVENTORY_CHANGED';
  end if;
end
$blocked$;

\echo 'PASS RU5_P0C02 atomic_submit happy wrong_profile own_need draft_unready terminal_deadline invalid_overteam_overremaining fixed_price exact_replay zero_partial direct_insert_denied snapshot_event selection_withdraw_regression blocked_features_zero rollback_only'
rollback;
