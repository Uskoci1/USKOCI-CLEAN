-- RU-5/P0C-01 rollback-only authenticated proof.
\set ON_ERROR_STOP on
begin;

do $seed$
declare
  victim uuid := extensions.gen_random_uuid();
  attacker uuid := extensions.gen_random_uuid();
  requester_profile uuid;
  worker_profile uuid;
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (victim,'authenticated','authenticated','ru5-c01-victim-'||victim::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU5 Public Victim','city','Novi Sad','skills',jsonb_build_array('Selidbe')),statement_timestamp(),statement_timestamp()),
  (attacker,'authenticated','authenticated','ru5-c01-attacker-'||attacker::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU5 Public Attacker','city','Beograd','skills',jsonb_build_array('Pomoc')),statement_timestamp(),statement_timestamp());

  select id into requester_profile from public.app_profiles where account_id=victim and kind='REQUESTER';
  select id into worker_profile from public.app_profiles where account_id=victim and kind='WORKER';
  if requester_profile is null or worker_profile is null then raise exception 'RU5_C01_PROOF_PROFILES_NOT_CREATED'; end if;

  update public.app_profiles
     set display_name='RU5 Public Victim', city='Novi Sad', headline='Kratak javni naslov', bio='Kratak javni opis',
         tools=array['PRIVATE_TOOL'], vehicles=array['PRIVATE_VEHICLE'], exclusions=array['PRIVATE_EXCLUSION'], minimum_fee_rsd=7777
   where account_id=victim;

  perform set_config('uskoci.ru5_c01_victim',victim::text,true);
  perform set_config('uskoci.ru5_c01_attacker',attacker::text,true);
  perform set_config('uskoci.ru5_c01_requester_profile',requester_profile::text,true);
  perform set_config('uskoci.ru5_c01_worker_profile',worker_profile::text,true);
end $seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru5_c01_victim'),true);
select set_config('request.jwt.claims','',true);

do $activate_worker$
declare pid uuid:=current_setting('uskoci.ru5_c01_worker_profile')::uuid;
begin
  perform public.rpc_complete_worker_profile(pid);
  if (select profile_status from public.app_profiles where id=pid) <> 'ACTIVE' then
    raise exception 'RU5_C01_PROOF_WORKER_NOT_ACTIVE';
  end if;
end $activate_worker$;

select set_config('request.jwt.claim.sub',current_setting('uskoci.ru5_c01_attacker'),true);

do $unrelated_user$
declare
  victim uuid:=current_setting('uskoci.ru5_c01_victim')::uuid;
  requester_profile uuid:=current_setting('uskoci.ru5_c01_requester_profile')::uuid;
  worker_profile uuid:=current_setting('uskoci.ru5_c01_worker_profile')::uuid;
  dto jsonb;
  raw_count integer;
begin
  select count(*) into raw_count from public.app_profiles where account_id=victim;
  if raw_count <> 0 then raise exception 'RU5_C01_PROOF_RAW_PROFILE_RLS_BROKEN'; end if;

  dto := public.rpc_public_profile(requester_profile);
  if dto is null then raise exception 'RU5_C01_PROOF_REQUESTER_DTO_MISSING'; end if;
  if dto->>'role' <> 'REQUESTER' then raise exception 'RU5_C01_PROOF_REQUESTER_ROLE_WRONG'; end if;
  if dto->>'displayName' <> 'RU5 Public Victim' or dto->>'city' <> 'Novi Sad' then raise exception 'RU5_C01_PROOF_PUBLIC_IDENTITY_WRONG'; end if;
  if dto->>'headline' <> 'Kratak javni naslov' or dto->>'bio' <> 'Kratak javni opis' then raise exception 'RU5_C01_PROOF_PUBLIC_BIO_WRONG'; end if;
  if (dto->>'completedWorkCount')::integer <> 0 then raise exception 'RU5_C01_PROOF_COMPLETED_COUNT_WRONG'; end if;
  if coalesce((dto#>>'{reputation,available}')::boolean,true) then raise exception 'RU5_C01_PROOF_REPUTATION_FABRICATED'; end if;
  if dto#>'{reputation,ratingAverage}' <> 'null'::jsonb or dto#>'{reputation,reviewCount}' <> 'null'::jsonb then raise exception 'RU5_C01_PROOF_REPUTATION_NOT_UNKNOWN'; end if;
  if coalesce((dto->>'identityVerified')::boolean,true) then raise exception 'RU5_C01_PROOF_IDENTITY_BADGE_FABRICATED'; end if;
  if dto->'publicCapabilities' <> 'null'::jsonb then raise exception 'RU5_C01_PROOF_CAPABILITIES_FABRICATED'; end if;
  if dto->'avatarUrl' <> 'null'::jsonb then raise exception 'RU5_C01_PROOF_PRIVATE_AVATAR_EXPOSED'; end if;

  if dto ?| array['accountId','account_id','profileStatus','skills','tools','vehicles','licenses','exclusions','radiusKm','availableNow','minimumFeeRsd','rating_worker','rating_requester'] then
    raise exception 'RU5_C01_PROOF_PRIVATE_FIELD_LEAK';
  end if;

  dto := public.rpc_public_profile(worker_profile);
  if dto is null or dto->>'role' <> 'WORKER' then raise exception 'RU5_C01_PROOF_WORKER_DTO_MISSING'; end if;
end $unrelated_user$;

reset role;
set local role anon;
do $anon_denied$
declare denied boolean:=false; pid uuid:=current_setting('uskoci.ru5_c01_requester_profile')::uuid;
begin
  begin perform public.rpc_public_profile(pid); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'RU5_C01_PROOF_ANON_EXECUTE_ALLOWED'; end if;
end $anon_denied$;

reset role;
rollback;
