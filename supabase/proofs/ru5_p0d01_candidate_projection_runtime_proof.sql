-- RU-5 / P0D-01 rollback-only authenticated Requester candidate projection proof.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.candidate_for(p_rows jsonb, p_response_id uuid)
returns jsonb
language sql
as $$
  select e.value
  from jsonb_array_elements(p_rows) e(value)
  where e.value->>'responseId' = p_response_id::text
  limit 1
$$;

create or replace function pg_temp.expect_candidate_error(p_need_id uuid, p_expected text)
returns void
language plpgsql
as $$
begin
  begin
    perform public.rpc_list_need_candidates(p_need_id);
  exception when others then
    if sqlerrm = p_expected then return; end if;
    raise exception 'RU5_P0D01_EXPECTED_%, GOT_% (%): %',p_expected,sqlerrm,sqlstate,sqlerrm;
  end;
  raise exception 'RU5_P0D01_EXPECTED_ERROR_NOT_RAISED: %',p_expected;
end;
$$;

do $seed$
declare
  requester uuid := extensions.gen_random_uuid();
  attacker uuid := extensions.gen_random_uuid();
  worker_a uuid := extensions.gen_random_uuid();
  worker_b uuid := extensions.gen_random_uuid();
  worker_c uuid := extensions.gen_random_uuid();
  requester_pid uuid;
  worker_a_pid uuid;
  worker_b_pid uuid;
  worker_c_pid uuid;

  n_main uuid := extensions.gen_random_uuid();
  n_stale uuid := extensions.gen_random_uuid();
  n_overfill uuid := extensions.gen_random_uuid();
  n_full uuid := extensions.gen_random_uuid();

  r_selectable uuid := extensions.gen_random_uuid();
  r_withdrawn uuid := extensions.gen_random_uuid();
  r_closed uuid := extensions.gen_random_uuid();
  r_draft uuid := extensions.gen_random_uuid();
  r_stale uuid := extensions.gen_random_uuid();
  r_overfill_seed uuid := extensions.gen_random_uuid();
  r_overfill uuid := extensions.gen_random_uuid();
  r_full_selected uuid := extensions.gen_random_uuid();
  r_full_other uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','ru5-p0d01-requester-'||requester||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D01 Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (attacker,'authenticated','authenticated','ru5-p0d01-attacker-'||attacker||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D01 Attacker','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_a,'authenticated','authenticated','ru5-p0d01-worker-a-'||worker_a||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D01 Worker A','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp()),
  (worker_b,'authenticated','authenticated','ru5-p0d01-worker-b-'||worker_b||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D01 Worker B','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp()),
  (worker_c,'authenticated','authenticated','ru5-p0d01-worker-c-'||worker_c||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D01 Worker C','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp());

  select id into requester_pid from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_a_pid from public.app_profiles where account_id=worker_a and kind='WORKER';
  select id into worker_b_pid from public.app_profiles where account_id=worker_b and kind='WORKER';
  select id into worker_c_pid from public.app_profiles where account_id=worker_c and kind='WORKER';
  if requester_pid is null or worker_a_pid is null or worker_b_pid is null or worker_c_pid is null then
    raise exception 'RU5_P0D01_PROFILE_SEED_FAILED';
  end if;

  update public.app_profiles set display_name='P0D01 Worker A',city='Novi Sad',skills=array['Proof'],team_capacity=2 where id=worker_a_pid;
  update public.app_profiles set display_name='P0D01 Worker B',city='Novi Sad',skills=array['Proof'],team_capacity=2 where id=worker_b_pid;
  update public.app_profiles set display_name='P0D01 Worker C',city='Novi Sad',skills=array['Proof'],team_capacity=2 where id=worker_c_pid;
  alter table public.app_profiles disable trigger guard_profile_write_trg;
  update public.app_profiles set profile_status='ACTIVE' where id in(worker_a_pid,worker_b_pid,worker_c_pid);
  alter table public.app_profiles enable trigger guard_profile_write_trg;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,response_deadline,published_at) values
  (n_main,requester,requester_pid,'PUBLISHED','P0D01 main','proof','PROOF','Novi Sad','Liman','OFFERS',3,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_stale,requester,requester_pid,'PUBLISHED','P0D01 stale','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_overfill,requester,requester_pid,'PUBLISHED','P0D01 overfill','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_full,requester,requester_pid,'PUBLISHED','P0D01 full','proof','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp());
  perform set_config('uskoci.need_lifecycle','',true);

  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at,withdrawn_at) values
  (r_selectable,n_main,worker_a,worker_a_pid,'OFFER','SUBMITTED',1,1,1,1100,'selectable note',statement_timestamp()-interval '10 minutes',null),
  (r_withdrawn,n_main,worker_b,worker_b_pid,'OFFER','WITHDRAWN',1,1,1,1200,'withdrawn note',statement_timestamp()-interval '9 minutes',statement_timestamp()-interval '1 minute'),
  (r_closed,n_main,worker_c,worker_c_pid,'OFFER','NOT_SELECTED',1,1,1,1300,'closed note',statement_timestamp()-interval '8 minutes',null),
  (r_draft,n_main,worker_c,worker_c_pid,'OFFER','DRAFT',1,1,1,1400,'draft note',statement_timestamp()-interval '7 minutes',null),
  (r_stale,n_stale,worker_a,worker_a_pid,'OFFER','SUBMITTED',1,1,1,1500,'stale note',statement_timestamp()-interval '6 minutes',null),
  (r_overfill_seed,n_overfill,worker_b,worker_b_pid,'OFFER','SUBMITTED',1,1,1,1600,'seed note',statement_timestamp()-interval '5 minutes',null),
  (r_overfill,n_overfill,worker_c,worker_c_pid,'OFFER','SUBMITTED',1,1,2,1700,'overfill note',statement_timestamp()-interval '4 minutes',null),
  (r_full_selected,n_full,worker_a,worker_a_pid,'OFFER','SUBMITTED',1,1,1,1800,'full selected note',statement_timestamp()-interval '3 minutes',null),
  (r_full_other,n_full,worker_b,worker_b_pid,'OFFER','SUBMITTED',1,1,1,1900,'full other note',statement_timestamp()-interval '2 minutes',null);

  insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,scope_note,content_hash) values
  (r_selectable,1,1,1,1100,'selectable note',repeat('1',64)),
  (r_withdrawn,1,1,1,1200,'withdrawn note',repeat('2',64)),
  (r_closed,1,1,1,1300,'closed note',repeat('3',64)),
  (r_draft,1,1,1,1400,'draft note',repeat('4',64)),
  (r_stale,1,1,1,1500,'stale note',repeat('5',64)),
  (r_overfill_seed,1,1,1,1600,'seed note',repeat('6',64)),
  (r_overfill,1,1,2,1700,'overfill note',repeat('7',64)),
  (r_full_selected,1,1,1,1800,'full selected note',repeat('8',64)),
  (r_full_other,1,1,1,1900,'full other note',repeat('9',64));

  insert into private.response_application_snapshots(
    response_id,response_version,snapshot_schema,worker_profile_id,worker_team_capacity,covered_slots,
    need_required_slots,need_selected_slots_before_submit,need_remaining_slots_before_submit,pricing_mode,
    requester_price_rsd,worker_skills,worker_tools,worker_licenses,worker_vehicles
  ) values (
    r_selectable,1,'APPLICATION_V1_SELF_DECLARED',worker_a_pid,2,1,3,0,3,'OFFERS',null,
    array['Proof'],array['Hammer'],array[]::text[],array['Van']
  );

  alter table public.needs disable trigger needs_guard_write;
  update public.needs set revision=2 where id=n_stale;
  alter table public.needs enable trigger needs_guard_write;

  perform set_config('uskoci.p0d01_requester',requester::text,true);
  perform set_config('uskoci.p0d01_attacker',attacker::text,true);
  perform set_config('uskoci.p0d01_n_main',n_main::text,true);
  perform set_config('uskoci.p0d01_n_stale',n_stale::text,true);
  perform set_config('uskoci.p0d01_n_overfill',n_overfill::text,true);
  perform set_config('uskoci.p0d01_n_full',n_full::text,true);
  perform set_config('uskoci.p0d01_r_selectable',r_selectable::text,true);
  perform set_config('uskoci.p0d01_r_withdrawn',r_withdrawn::text,true);
  perform set_config('uskoci.p0d01_r_closed',r_closed::text,true);
  perform set_config('uskoci.p0d01_r_draft',r_draft::text,true);
  perform set_config('uskoci.p0d01_r_stale',r_stale::text,true);
  perform set_config('uskoci.p0d01_r_overfill_seed',r_overfill_seed::text,true);
  perform set_config('uskoci.p0d01_r_overfill',r_overfill::text,true);
  perform set_config('uskoci.p0d01_r_full_selected',r_full_selected::text,true);
  perform set_config('uskoci.p0d01_r_full_other',r_full_other::text,true);
end
$seed$;

-- Requester-only authority: another authenticated account cannot inspect candidates.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0d01_attacker'),true);
select pg_temp.expect_candidate_error(current_setting('uskoci.p0d01_n_main')::uuid,'NOT_REQUESTER');
reset role;

-- Create real existing selections through the unchanged selection authority.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0d01_requester'),true);
do $select_existing$
declare
  a1 uuid;
  a2 uuid;
begin
  a1 := public.rpc_select_response(
    current_setting('uskoci.p0d01_n_overfill')::uuid,1,
    current_setting('uskoci.p0d01_r_overfill_seed')::uuid,1,repeat('6',64),'p0d01-overfill-seed'
  );
  a2 := public.rpc_select_response(
    current_setting('uskoci.p0d01_n_full')::uuid,1,
    current_setting('uskoci.p0d01_r_full_selected')::uuid,1,repeat('8',64),'p0d01-full-seed'
  );
  if a1 is null or a2 is null then raise exception 'RU5_P0D01_SELECTION_REGRESSION'; end if;
end
$select_existing$;
reset role;

-- Canonical states, exact version/hash, public-safe profile and snapshot evidence.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0d01_requester'),true);
do $projection$
declare
  rows jsonb;
  item jsonb;
  before_main jsonb;
  after_main jsonb;
begin
  select jsonb_agg(jsonb_build_object('id',id,'status',status,'version',current_version,'price',price_rsd,'slots',covered_slots) order by id)
  into before_main from public.marketplace_responses
  where need_id in (
    current_setting('uskoci.p0d01_n_main')::uuid,
    current_setting('uskoci.p0d01_n_stale')::uuid,
    current_setting('uskoci.p0d01_n_overfill')::uuid,
    current_setting('uskoci.p0d01_n_full')::uuid
  );

  rows := public.rpc_list_need_candidates(current_setting('uskoci.p0d01_n_main')::uuid);
  if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)<>3 then
    raise exception 'RU5_P0D01_MAIN_COUNT_INVALID %',rows;
  end if;

  item := pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_selectable')::uuid);
  if item->>'state'<>'SELECTABLE' or (item->>'canSelect')::boolean is not true
     or (item->>'version')::integer<>1 or item->>'contentHash'<>repeat('1',64)
     or (item->>'needRevision')::integer<>1 or (item->>'responseNeedRevision')::integer<>1
     or item#>>'{publicProfile,displayName}'<>'P0D01 Worker A'
     or item#>>'{applicationEvidence,schema}'<>'APPLICATION_V1_SELF_DECLARED'
     or (item#>>'{applicationEvidence,teamCapacity}')::integer<>2
     or item#>>'{applicationEvidence,vehicles,0}'<>'Van' then
    raise exception 'RU5_P0D01_SELECTABLE_INVALID %',item;
  end if;

  item := pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_withdrawn')::uuid);
  if item->>'state'<>'WITHDRAWN' or (item->>'canSelect')::boolean is true
     or item#>>'{applicationEvidence,schema}'<>'LEGACY_UNPROVEN'
     or item#>'{applicationEvidence,teamCapacity}' <> 'null'::jsonb then
    raise exception 'RU5_P0D01_WITHDRAWN_OR_LEGACY_INVALID %',item;
  end if;

  item := pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_closed')::uuid);
  if item->>'state'<>'CLOSED' or (item->>'canSelect')::boolean is true then
    raise exception 'RU5_P0D01_CLOSED_INVALID %',item;
  end if;

  if pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_draft')::uuid) is not null then
    raise exception 'RU5_P0D01_DRAFT_LEAKED';
  end if;

  if exists (
    select 1 from jsonb_array_elements(rows) e(value)
    where e.value ?| array['workerAccountId','requesterAccountId','phone','email','exactAddress','matchScore','hardBlockers','dispatchBlockers']
       or (e.value->'publicProfile') ?| array['accountId','phone','email','exactAddress','skills','tools','vehicles','radiusKm']
  ) then
    raise exception 'RU5_P0D01_PRIVATE_FIELD_LEAK';
  end if;

  rows := public.rpc_list_need_candidates(current_setting('uskoci.p0d01_n_stale')::uuid);
  item := pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_stale')::uuid);
  if item->>'state'<>'STALE' or (item->>'canSelect')::boolean is true
     or (item->>'needRevision')::integer<>2 or (item->>'responseNeedRevision')::integer<>1 then
    raise exception 'RU5_P0D01_STALE_INVALID %',item;
  end if;

  rows := public.rpc_list_need_candidates(current_setting('uskoci.p0d01_n_overfill')::uuid);
  item := pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_overfill_seed')::uuid);
  if item->>'state'<>'SELECTED' or (item->>'canSelect')::boolean is true then
    raise exception 'RU5_P0D01_SELECTED_INVALID %',item;
  end if;
  item := pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_overfill')::uuid);
  if item->>'state'<>'OVERFILL' or (item->>'canSelect')::boolean is true
     or (item->>'remainingSlots')::integer<>1 then
    raise exception 'RU5_P0D01_OVERFILL_INVALID %',item;
  end if;

  rows := public.rpc_list_need_candidates(current_setting('uskoci.p0d01_n_full')::uuid);
  item := pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_full_selected')::uuid);
  if item->>'state'<>'SELECTED' then raise exception 'RU5_P0D01_FULL_SELECTED_INVALID %',item; end if;
  item := pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_full_other')::uuid);
  if item->>'state'<>'FULL' or (item->>'canSelect')::boolean is true
     or (item->>'remainingSlots')::integer<>0 then
    raise exception 'RU5_P0D01_FULL_INVALID %',item;
  end if;

  select jsonb_agg(jsonb_build_object('id',id,'status',status,'version',current_version,'price',price_rsd,'slots',covered_slots) order by id)
  into after_main from public.marketplace_responses
  where need_id in (
    current_setting('uskoci.p0d01_n_main')::uuid,
    current_setting('uskoci.p0d01_n_stale')::uuid,
    current_setting('uskoci.p0d01_n_overfill')::uuid,
    current_setting('uskoci.p0d01_n_full')::uuid
  );
  if before_main is distinct from after_main then
    raise exception 'RU5_P0D01_PROJECTION_MUTATED_RESPONSES before=% after=%',before_main,after_main;
  end if;
end
$projection$;
reset role;

-- Exact projected binding remains consumable by the unchanged selection RPC.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0d01_requester'),true);
do $selection_binding$
declare
  rows jsonb := public.rpc_list_need_candidates(current_setting('uskoci.p0d01_n_main')::uuid);
  item jsonb;
  aid uuid;
  after_item jsonb;
begin
  item := pg_temp.candidate_for(rows,current_setting('uskoci.p0d01_r_selectable')::uuid);
  aid := public.rpc_select_response(
    current_setting('uskoci.p0d01_n_main')::uuid,
    (item->>'needRevision')::integer,
    (item->>'responseId')::uuid,
    (item->>'version')::integer,
    item->>'contentHash',
    'p0d01-exact-projected-selection'
  );
  if aid is null then raise exception 'RU5_P0D01_EXACT_SELECTION_FAILED'; end if;

  after_item := pg_temp.candidate_for(
    public.rpc_list_need_candidates(current_setting('uskoci.p0d01_n_main')::uuid),
    current_setting('uskoci.p0d01_r_selectable')::uuid
  );
  if after_item->>'state'<>'SELECTED' or (after_item->>'canSelect')::boolean is true then
    raise exception 'RU5_P0D01_POST_SELECTION_PROJECTION_INVALID %',after_item;
  end if;
end
$selection_binding$;
reset role;

raise notice 'PASS RU5_P0D01 requester_owner selectable_exact stale overfill full selected withdrawn closed draft_excluded public_safe snapshot_v1 legacy_unproven projection_read_only selection_binding rollback_only';
rollback;
