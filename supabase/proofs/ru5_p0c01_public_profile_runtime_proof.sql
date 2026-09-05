-- RU-5 / P0C-01 rollback-only authenticated public-profile proof.
\set ON_ERROR_STOP on
begin;

do $seed$
declare
  victim uuid := extensions.gen_random_uuid();
  attacker uuid := extensions.gen_random_uuid();
  requester_pid uuid;
  worker_pid uuid;
  attacker_requester_pid uuid;
  attacker_worker_pid uuid;
  requester_need_id uuid := extensions.gen_random_uuid();
  worker_need_id uuid := extensions.gen_random_uuid();
  requester_response_id uuid := extensions.gen_random_uuid();
  worker_response_id uuid := extensions.gen_random_uuid();
  requester_selection_id uuid := extensions.gen_random_uuid();
  worker_selection_id uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values
  (
    victim,'authenticated','authenticated',
    'ru5-p0c01-victim-'||victim::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','RU5 Victim','city','Novi Sad','skills',jsonb_build_array('Selidbe')),
    statement_timestamp(),statement_timestamp()
  ),
  (
    attacker,'authenticated','authenticated',
    'ru5-p0c01-attacker-'||attacker::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','RU5 Attacker','city','Beograd','skills',jsonb_build_array('Proof')),
    statement_timestamp(),statement_timestamp()
  );

  select id into requester_pid from public.app_profiles where account_id=victim and kind='REQUESTER';
  select id into worker_pid from public.app_profiles where account_id=victim and kind='WORKER';
  select id into attacker_requester_pid from public.app_profiles where account_id=attacker and kind='REQUESTER';
  select id into attacker_worker_pid from public.app_profiles where account_id=attacker and kind='WORKER';
  if requester_pid is null or worker_pid is null
     or attacker_requester_pid is null or attacker_worker_pid is null then
    raise exception 'RU5_P0C01_PROOF_PROFILE_SEED_FAILED';
  end if;

  update public.app_profiles
  set display_name='RU5 Public Requester',
      city='Novi Sad',
      headline='RU5_PRIVATE_REQUESTER_HEADLINE',
      bio='RU5_PRIVATE_REQUESTER_BIO',
      avatar_path='profile-media/ru5-requester/avatar.jpg',
      radius_km=50,
      available_now=true,
      team_capacity=9,
      tools=array['RU5_PRIVATE_TOOL'],
      licenses=array['RU5_PRIVATE_LICENSE'],
      vehicles=array['RU5_PRIVATE_VEHICLE'],
      exclusions=array['RU5_PRIVATE_EXCLUSION'],
      minimum_fee_rsd=99999
  where id=requester_pid;

  update public.app_profiles
  set display_name='RU5 Public Worker',
      city='Novi Sad',
      headline='Selidbe i montaža',
      bio='Radim pažljivo i uredno.',
      avatar_path='profile-media/ru5-worker/avatar.jpg',
      skills=array['Selidbe','Montaža'],
      radius_km=60,
      available_now=true,
      team_capacity=7,
      tools=array['RU5_PRIVATE_WORKER_TOOL'],
      licenses=array['RU5_PRIVATE_WORKER_LICENSE'],
      vehicles=array['RU5_PRIVATE_WORKER_VEHICLE'],
      exclusions=array['RU5_PRIVATE_WORKER_EXCLUSION'],
      minimum_fee_rsd=88888
  where id=worker_pid;

  -- Projection-only trust fixtures. These rows are inserted as postgres inside
  -- this rollback-only proof and satisfy the real FK/check contract. They do
  -- not claim to re-prove Agreement writer/lifecycle authority, which has its
  -- own authenticated runtime proof. Their sole purpose is to prove that the
  -- public profile count is positive and role-scoped.
  insert into public.needs(
    id, requester_account_id, requester_profile_id,
    title, description, category, mode, required_slots
  ) values
  (
    requester_need_id, victim, requester_pid,
    'RU5 requester completed-count proof', 'Projection proof fixture', 'PROOF', 'OFFERS', 1
  ),
  (
    worker_need_id, attacker, attacker_requester_pid,
    'RU5 worker completed-count proof', 'Projection proof fixture', 'PROOF', 'OFFERS', 1
  );

  insert into public.marketplace_responses(
    id, need_id, worker_account_id, worker_profile_id,
    response_kind, status, submitted_against_need_revision,
    covered_slots, price_rsd
  ) values
  (
    requester_response_id, requester_need_id, attacker, attacker_worker_pid,
    'APPLICATION', 'SELECTED', 1, 1, 1000
  ),
  (
    worker_response_id, worker_need_id, victim, worker_pid,
    'APPLICATION', 'SELECTED', 1, 1, 1000
  );

  insert into public.need_selections(
    id, need_id, need_revision, selected_by_account_id,
    client_request_id, covered_slots, response_id,
    worker_account_id, worker_profile_id, selection_mode, status
  ) values
  (
    requester_selection_id, requester_need_id, 1, victim,
    'ru5-p0c01-requester-count', 1, requester_response_id,
    attacker, attacker_worker_pid, 'REQUESTER_SELECTS', 'SELECTED'
  ),
  (
    worker_selection_id, worker_need_id, 1, attacker,
    'ru5-p0c01-worker-count', 1, worker_response_id,
    victim, worker_pid, 'REQUESTER_SELECTS', 'SELECTED'
  );

  insert into public.agreements(
    need_id, selection_id, selected_response_id,
    requester_account_id, requester_profile_id,
    worker_account_id, worker_profile_id, status
  ) values
  (
    requester_need_id, requester_selection_id, requester_response_id,
    victim, requester_pid, attacker, attacker_worker_pid, 'COMPLETED'
  ),
  (
    worker_need_id, worker_selection_id, worker_response_id,
    attacker, attacker_requester_pid, victim, worker_pid, 'COMPLETED'
  );

  perform set_config('uskoci.ru5_victim',victim::text,true);
  perform set_config('uskoci.ru5_attacker',attacker::text,true);
  perform set_config('uskoci.ru5_requester_pid',requester_pid::text,true);
  perform set_config('uskoci.ru5_worker_pid',worker_pid::text,true);
end $seed$;

-- Cached rating columns are server-derived and the normal RU-1 profile guard
-- correctly rejects direct client mutation. For this disposable proof only,
-- seed non-null cached values under postgres while the guard trigger is briefly
-- disabled, then re-enable it BEFORE any authenticated/RPC assertions. This
-- proves P0C-01 ignores legacy caches without weakening production authority.
alter table public.app_profiles disable trigger guard_profile_write_trg;
update public.app_profiles
   set rating_requester=4.9
 where id=current_setting('uskoci.ru5_requester_pid')::uuid;
update public.app_profiles
   set rating_worker=5.0
 where id=current_setting('uskoci.ru5_worker_pid')::uuid;
alter table public.app_profiles enable trigger guard_profile_write_trg;

do $guard_restored$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgrelid='public.app_profiles'::regclass
       and tgname='guard_profile_write_trg'
       and tgenabled='O'
  ) then
    raise exception 'RU5_P0C01_PROFILE_GUARD_NOT_RESTORED';
  end if;
end $guard_restored$;

-- Static privilege boundary: authenticated may execute the narrow projection;
-- anon may not. Raw table RLS remains unchanged and owner-only.
do $privileges$
begin
  if not has_function_privilege('authenticated','public.rpc_get_public_profile(uuid)','EXECUTE') then
    raise exception 'RU5_P0C01_AUTH_EXECUTE_MISSING';
  end if;
  if has_function_privilege('anon','public.rpc_get_public_profile(uuid)','EXECUTE') then
    raise exception 'RU5_P0C01_ANON_EXECUTE_ALLOWED';
  end if;
end $privileges$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru5_attacker'),true);
select set_config('request.jwt.claims','',true);

do $attacker_requester$
declare
  pid uuid := current_setting('uskoci.ru5_requester_pid')::uuid;
  dto jsonb;
  visible_raw integer;
begin
  select count(*) into visible_raw from public.app_profiles where id=pid;
  if visible_raw <> 0 then
    raise exception 'RU5_P0C01_ATTACKER_CAN_READ_RAW_REQUESTER_PROFILE';
  end if;

  dto := public.rpc_get_public_profile(pid);
  if dto is null then raise exception 'RU5_P0C01_SAFE_REQUESTER_DTO_MISSING'; end if;
  if dto->>'role' <> 'REQUESTER' then raise exception 'RU5_P0C01_REQUESTER_ROLE_WRONG'; end if;
  if dto->>'displayName' <> 'RU5 Public Requester' then raise exception 'RU5_P0C01_REQUESTER_NAME_WRONG'; end if;
  if dto->>'city' <> 'Novi Sad' then raise exception 'RU5_P0C01_REQUESTER_CITY_WRONG'; end if;
  if dto->'publicSummary'->'headline' <> 'null'::jsonb then raise exception 'RU5_P0C01_REQUESTER_HEADLINE_LEAK'; end if;
  if dto->'publicSummary'->'bio' <> 'null'::jsonb then raise exception 'RU5_P0C01_REQUESTER_BIO_LEAK'; end if;
  if (dto->'trust'->>'completedCount')::integer <> 1 then raise exception 'RU5_P0C01_REQUESTER_COMPLETED_NOT_ROLE_SCOPED'; end if;
  if dto->'trust'->'ratingAverage' <> 'null'::jsonb then raise exception 'RU5_P0C01_CACHED_REQUESTER_RATING_LEAK'; end if;
  if dto->'trust'->'reviewCount' <> 'null'::jsonb then raise exception 'RU5_P0C01_FAKE_REVIEW_COUNT'; end if;
  if (dto->'trust'->>'identityVerified')::boolean then raise exception 'RU5_P0C01_FAKE_IDENTITY_BADGE'; end if;
  if (dto->'trust'->>'ratingAvailable')::boolean then raise exception 'RU5_P0C01_RATING_FALSLEY_AVAILABLE'; end if;
  if (dto->'trust'->>'reviewsAvailable')::boolean then raise exception 'RU5_P0C01_REVIEWS_FALSLEY_AVAILABLE'; end if;
  if (dto->'trust'->>'identityVerificationAvailable')::boolean then raise exception 'RU5_P0C01_IDENTITY_FALSLEY_AVAILABLE'; end if;

  if dto::text like '%RU5_PRIVATE_TOOL%'
     or dto::text like '%RU5_PRIVATE_LICENSE%'
     or dto::text like '%RU5_PRIVATE_VEHICLE%'
     or dto::text like '%RU5_PRIVATE_EXCLUSION%'
     or dto::text like '%RU5_PRIVATE_REQUESTER_HEADLINE%'
     or dto::text like '%RU5_PRIVATE_REQUESTER_BIO%' then
    raise exception 'RU5_P0C01_REQUESTER_PRIVATE_DATA_LEAK';
  end if;

  if dto ?| array['accountId','email','phone','exactAddress','availableNow','radiusKm','teamCapacity','tools','licenses','vehicles','exclusions','minimumFeeRsd','matcherScore'] then
    raise exception 'RU5_P0C01_REQUESTER_FORBIDDEN_KEY_LEAK';
  end if;
end $attacker_requester$;

-- DRAFT Worker profiles are not public.
do $draft_worker$
declare
  pid uuid := current_setting('uskoci.ru5_worker_pid')::uuid;
  dto jsonb;
begin
  dto := public.rpc_get_public_profile(pid);
  if dto is not null then raise exception 'RU5_P0C01_DRAFT_WORKER_PUBLIC'; end if;
end $draft_worker$;

-- The owner activates the Worker only through the existing RU-1 authority.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru5_victim'),true);
do $activate_worker$
declare
  pid uuid := current_setting('uskoci.ru5_worker_pid')::uuid;
  s text;
begin
  perform public.rpc_complete_worker_profile(pid);
  select profile_status into s from public.app_profiles where id=pid;
  if s <> 'ACTIVE' then raise exception 'RU5_P0C01_WORKER_ACTIVATION_FAILED'; end if;
end $activate_worker$;

-- Unrelated authenticated user gets only the safe Worker DTO, never the raw row.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru5_attacker'),true);
do $attacker_worker$
declare
  pid uuid := current_setting('uskoci.ru5_worker_pid')::uuid;
  dto jsonb;
  visible_raw integer;
begin
  select count(*) into visible_raw from public.app_profiles where id=pid;
  if visible_raw <> 0 then raise exception 'RU5_P0C01_ATTACKER_CAN_READ_RAW_WORKER_PROFILE'; end if;

  dto := public.rpc_get_public_profile(pid);
  if dto is null then raise exception 'RU5_P0C01_SAFE_WORKER_DTO_MISSING'; end if;
  if dto->>'role' <> 'WORKER' then raise exception 'RU5_P0C01_WORKER_ROLE_WRONG'; end if;
  if dto->>'displayName' <> 'RU5 Public Worker' then raise exception 'RU5_P0C01_WORKER_NAME_WRONG'; end if;
  if dto->'publicSummary'->>'headline' <> 'Selidbe i montaža' then raise exception 'RU5_P0C01_WORKER_HEADLINE_WRONG'; end if;
  if dto->'publicSummary'->>'bio' <> 'Radim pažljivo i uredno.' then raise exception 'RU5_P0C01_WORKER_BIO_WRONG'; end if;
  if (dto->'trust'->>'completedCount')::integer <> 1 then raise exception 'RU5_P0C01_WORKER_COMPLETED_NOT_ROLE_SCOPED'; end if;
  if dto->'trust'->'ratingAverage' <> 'null'::jsonb then raise exception 'RU5_P0C01_CACHED_WORKER_RATING_LEAK'; end if;
  if dto::text like '%RU5_PRIVATE_WORKER_TOOL%'
     or dto::text like '%RU5_PRIVATE_WORKER_LICENSE%'
     or dto::text like '%RU5_PRIVATE_WORKER_VEHICLE%'
     or dto::text like '%RU5_PRIVATE_WORKER_EXCLUSION%' then
    raise exception 'RU5_P0C01_WORKER_OPERATIONAL_DATA_LEAK';
  end if;
  if dto ?| array['skills','tools','licenses','vehicles','exclusions','availableNow','radiusKm','teamCapacity','minimumFeeRsd','matcherScore'] then
    raise exception 'RU5_P0C01_WORKER_FORBIDDEN_KEY_LEAK';
  end if;
end $attacker_worker$;

reset role;
\echo 'PASS RU5_P0C01 public_profile authenticated_unrelated_safe raw_rls_preserved draft_hidden completed_role_scoped trust_fail_closed no_private_operational_leak zero_residue'
rollback;