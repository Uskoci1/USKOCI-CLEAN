-- RU-5/P0C-01 rollback-only authenticated proof.
\set ON_ERROR_STOP on
begin;

do $seed_accounts$
declare
  worker_account uuid := extensions.gen_random_uuid();
  requester_account uuid := extensions.gen_random_uuid();
  reader_account uuid := extensions.gen_random_uuid();
  worker_profile uuid;
  requester_profile uuid;
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (worker_account,'authenticated','authenticated','ru5-c01-worker-'||worker_account::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU5 Public Worker','city','Novi Sad','skills',jsonb_build_array('Selidbe')),statement_timestamp(),statement_timestamp()),
  (requester_account,'authenticated','authenticated','ru5-c01-requester-'||requester_account::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU5 Public Requester','city','Beograd'),statement_timestamp(),statement_timestamp()),
  (reader_account,'authenticated','authenticated','ru5-c01-reader-'||reader_account::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU5 Public Reader','city','Nis'),statement_timestamp(),statement_timestamp());

  select id into worker_profile from public.app_profiles where account_id=worker_account and kind='WORKER';
  select id into requester_profile from public.app_profiles where account_id=requester_account and kind='REQUESTER';
  if worker_profile is null or requester_profile is null then raise exception 'RU5_C01_PROOF_PROFILES_NOT_CREATED'; end if;

  update public.app_profiles
     set display_name='RU5 Public Worker', city='Novi Sad', headline='Kratak javni naslov', bio='Kratak javni opis',
         tools=array['PRIVATE_TOOL'], vehicles=array['PRIVATE_VEHICLE'], exclusions=array['PRIVATE_EXCLUSION'], minimum_fee_rsd=7777
   where id=worker_profile;
  update public.app_profiles
     set display_name='RU5 Public Requester', city='Beograd', headline='Trazi pouzdanu pomoc', bio='Javni requester opis'
   where id=requester_profile;

  perform set_config('uskoci.ru5_c01_worker_account',worker_account::text,true);
  perform set_config('uskoci.ru5_c01_requester_account',requester_account::text,true);
  perform set_config('uskoci.ru5_c01_reader_account',reader_account::text,true);
  perform set_config('uskoci.ru5_c01_worker_profile',worker_profile::text,true);
  perform set_config('uskoci.ru5_c01_requester_profile',requester_profile::text,true);
end $seed_accounts$;

-- Activate the proof Worker through the real RU-1 authority.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru5_c01_worker_account'),true);
select set_config('request.jwt.claims','',true);
do $activate_worker$
declare pid uuid:=current_setting('uskoci.ru5_c01_worker_profile')::uuid;
begin
  perform public.rpc_complete_worker_profile(pid);
  if (select profile_status from public.app_profiles where id=pid) <> 'ACTIVE' then
    raise exception 'RU5_C01_PROOF_WORKER_NOT_ACTIVE';
  end if;
end $activate_worker$;
reset role;

-- Server fixture setup: one structurally valid completed Agreement chain.
-- This setup is not user authority; all rows are inside this outer rollback.
do $seed_completed_agreement$
declare
  requester_account uuid:=current_setting('uskoci.ru5_c01_requester_account')::uuid;
  worker_account uuid:=current_setting('uskoci.ru5_c01_worker_account')::uuid;
  requester_profile uuid:=current_setting('uskoci.ru5_c01_requester_profile')::uuid;
  worker_profile uuid:=current_setting('uskoci.ru5_c01_worker_profile')::uuid;
  need_id uuid:=extensions.gen_random_uuid();
  response_id uuid:=extensions.gen_random_uuid();
  selection_id uuid:=extensions.gen_random_uuid();
  agreement_id uuid:=extensions.gen_random_uuid();
begin
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,schedule_kind,required_slots,mode,requester_price_rsd,execution_location_mode)
  values(need_id,requester_account,requester_profile,'DRAFT','RU5 C01 proof need','Rollback-only completed metric proof','proof','Beograd','Centar','FLEXIBLE',1,'MY_PRICE',1500,'STATIONARY');

  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,bounded_message,submitted_at,selected_at)
  values(response_id,need_id,worker_account,worker_profile,'APPLICATION','SELECTED',1,1,1,1500,'proof','proof',statement_timestamp(),statement_timestamp());

  insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode,status)
  values(selection_id,need_id,1,requester_account,'ru5-c01-proof-selection',1,response_id,worker_account,worker_profile,'REQUESTER_SELECTS','SELECTED');

  insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id,current_version,status)
  values(agreement_id,need_id,selection_id,response_id,requester_account,requester_profile,worker_account,worker_profile,1,'COMPLETED');

  insert into public.agreement_execution(agreement_id,agreement_version,mode,state,completed_at)
  values(agreement_id,1,'PHYSICAL','COMPLETED',statement_timestamp());
end $seed_completed_agreement$;

-- Unrelated authenticated reader can see only the public-safe DTO, never raw rows.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru5_c01_reader_account'),true);
select set_config('request.jwt.claims','',true);
do $unrelated_user$
declare
  worker_account uuid:=current_setting('uskoci.ru5_c01_worker_account')::uuid;
  requester_account uuid:=current_setting('uskoci.ru5_c01_requester_account')::uuid;
  worker_profile uuid:=current_setting('uskoci.ru5_c01_worker_profile')::uuid;
  requester_profile uuid:=current_setting('uskoci.ru5_c01_requester_profile')::uuid;
  dto jsonb;
  raw_count integer;
begin
  select count(*) into raw_count from public.app_profiles where account_id in (worker_account,requester_account);
  if raw_count <> 0 then raise exception 'RU5_C01_PROOF_RAW_PROFILE_RLS_BROKEN'; end if;

  dto := public.rpc_public_profile(worker_profile);
  if dto is null then raise exception 'RU5_C01_PROOF_WORKER_DTO_MISSING'; end if;
  if dto->>'role' <> 'WORKER' then raise exception 'RU5_C01_PROOF_WORKER_ROLE_WRONG'; end if;
  if dto->>'displayName' <> 'RU5 Public Worker' or dto->>'city' <> 'Novi Sad' then raise exception 'RU5_C01_PROOF_PUBLIC_IDENTITY_WRONG'; end if;
  if dto->>'headline' <> 'Kratak javni naslov' or dto->>'bio' <> 'Kratak javni opis' then raise exception 'RU5_C01_PROOF_PUBLIC_BIO_WRONG'; end if;
  if (dto->>'completedWorkCount')::integer <> 1 then raise exception 'RU5_C01_PROOF_WORKER_COMPLETED_COUNT_WRONG'; end if;
  if coalesce((dto#>>'{reputation,available}')::boolean,true) then raise exception 'RU5_C01_PROOF_REPUTATION_FABRICATED'; end if;
  if dto#>'{reputation,ratingAverage}' <> 'null'::jsonb or dto#>'{reputation,reviewCount}' <> 'null'::jsonb then raise exception 'RU5_C01_PROOF_REPUTATION_NOT_UNKNOWN'; end if;
  if coalesce((dto->>'identityVerified')::boolean,true) then raise exception 'RU5_C01_PROOF_IDENTITY_BADGE_FABRICATED'; end if;
  if dto->'publicCapabilities' <> 'null'::jsonb then raise exception 'RU5_C01_PROOF_CAPABILITIES_FABRICATED'; end if;
  if dto->'avatarUrl' <> 'null'::jsonb then raise exception 'RU5_C01_PROOF_PRIVATE_AVATAR_EXPOSED'; end if;
  if dto ?| array['accountId','account_id','profileStatus','skills','tools','vehicles','licenses','exclusions','radiusKm','availableNow','minimumFeeRsd','rating_worker','rating_requester'] then
    raise exception 'RU5_C01_PROOF_PRIVATE_FIELD_LEAK';
  end if;

  dto := public.rpc_public_profile(requester_profile);
  if dto is null or dto->>'role' <> 'REQUESTER' then raise exception 'RU5_C01_PROOF_REQUESTER_DTO_MISSING'; end if;
  if (dto->>'completedWorkCount')::integer <> 1 then raise exception 'RU5_C01_PROOF_REQUESTER_COMPLETED_COUNT_WRONG'; end if;
end $unrelated_user$;

reset role;
set local role anon;
do $anon_denied$
declare denied boolean:=false; pid uuid:=current_setting('uskoci.ru5_c01_worker_profile')::uuid;
begin
  begin perform public.rpc_public_profile(pid); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'RU5_C01_PROOF_ANON_EXECUTE_ALLOWED'; end if;
end $anon_denied$;

reset role;
rollback;
