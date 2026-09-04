-- USKOČI RU-4 rollback-only proof: "Ne traži više nikoga" closes only remaining search.
\set ON_ERROR_STOP on
begin;

do $seed$
declare
  requester uuid := extensions.gen_random_uuid();
  worker_a uuid := extensions.gen_random_uuid();
  worker_b uuid := extensions.gen_random_uuid();
  attacker uuid := extensions.gen_random_uuid();
  requester_profile uuid;
  worker_a_profile uuid;
  worker_b_profile uuid;
  need_id uuid;
  response_selected uuid;
  response_pending uuid;
  selection_id uuid;
  agreement_id uuid;
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','ru4-close-requester-'||requester::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Close Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_a,'authenticated','authenticated','ru4-close-worker-a-'||worker_a::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Close Worker A','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_b,'authenticated','authenticated','ru4-close-worker-b-'||worker_b::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Close Worker B','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (attacker,'authenticated','authenticated','ru4-close-attacker-'||attacker::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Close Attacker','city','Novi Sad'),statement_timestamp(),statement_timestamp());

  select id into requester_profile from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_a_profile from public.app_profiles where account_id=worker_a and kind='WORKER';
  select id into worker_b_profile from public.app_profiles where account_id=worker_b and kind='WORKER';
  if requester_profile is null or worker_a_profile is null or worker_b_profile is null then
    raise exception 'RU4_CLOSE_PROFILE_SETUP_FAILED';
  end if;

  update public.app_profiles set display_name='RU4 Close Worker A',city='Novi Sad',skills=array['proof'] where id=worker_a_profile;
  update public.app_profiles set display_name='RU4 Close Worker B',city='Novi Sad',skills=array['proof'] where id=worker_b_profile;

  perform set_config('request.jwt.claim.sub',worker_a::text,true);
  perform public.rpc_complete_worker_profile(worker_a_profile);
  perform set_config('request.jwt.claim.sub',worker_b::text,true);
  perform public.rpc_complete_worker_profile(worker_b_profile);
  perform set_config('request.jwt.claim.sub','',true);

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(
    requester_account_id, requester_profile_id, status, title, description, category,
    approximate_city, approximate_area, schedule_kind, required_slots, mode,
    requester_price_rsd, required_skills, execution_location_mode, revision, published_at,
    response_deadline
  ) values (
    requester, requester_profile, 'PUBLISHED', 'RU4 close task', 'Three people, close remaining after two selected', 'proof',
    'Novi Sad', 'Centar', 'FLEXIBLE', 3, 'MY_PRICE',
    5000, array['proof'], 'REMOTE', 1, statement_timestamp(), statement_timestamp()+interval '2 days'
  ) returning id into need_id;
  perform set_config('uskoci.need_lifecycle','',true);

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values (
    need_id,worker_a,worker_a_profile,'OFFER','SELECTED',1,1,2,5000,'selected two slots',statement_timestamp()
  ) returning id into response_selected;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(response_selected,1,1,5000,2,'selected two slots',repeat('a',64));

  insert into public.marketplace_responses(
    need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values (
    need_id,worker_b,worker_b_profile,'OFFER','SUBMITTED',1,1,1,5000,'pending final slot',statement_timestamp()
  ) returning id into response_pending;
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash)
  values(response_pending,1,1,5000,1,'pending final slot',repeat('b',64));

  insert into public.need_selections(
    need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,
    worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    need_id,1,requester,'ru4-close-selection-a',2,response_selected,
    worker_a,worker_a_profile,'REQUESTER_SELECTS','SELECTED'
  ) returning id into selection_id;

  insert into public.agreements(
    need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values (
    need_id,selection_id,response_selected,requester,requester_profile,
    worker_a,worker_a_profile,1,'CONFIRMED'
  ) returning id into agreement_id;
  insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
  values(agreement_id,1,'CONFIRMED',jsonb_build_object('needRevision',1,'priceRsd',5000,'coveredSlots',2),repeat('d',64),requester);

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs set status='SELECTION' where id=need_id;
  perform set_config('uskoci.need_lifecycle','',true);

  insert into private.dispatch_schedule(need_id,next_run_at)
  values(need_id,statement_timestamp())
  on conflict (need_id) do update set next_run_at=excluded.next_run_at;

  perform set_config('uskoci.ru4_close_requester',requester::text,true);
  perform set_config('uskoci.ru4_close_worker_a',worker_a::text,true);
  perform set_config('uskoci.ru4_close_worker_b',worker_b::text,true);
  perform set_config('uskoci.ru4_close_attacker',attacker::text,true);
  perform set_config('uskoci.ru4_close_worker_b_profile',worker_b_profile::text,true);
  perform set_config('uskoci.ru4_close_need',need_id::text,true);
  perform set_config('uskoci.ru4_close_pending_response',response_pending::text,true);
  perform set_config('uskoci.ru4_close_agreement',agreement_id::text,true);
end
$seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_close_attacker'),true);
do $attacker$
declare denied boolean:=false;
begin
  begin
    perform public.rpc_close_remaining_search(current_setting('uskoci.ru4_close_need')::uuid,1,'ru4-close-attack','');
  exception when sqlstate '42501' then denied:=true;
  end;
  if not denied then raise exception 'RU4_CLOSE_ATTACKER_ALLOWED'; end if;
end
$attacker$;

select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_close_requester'),true);
do $close$
declare
  nid uuid:=current_setting('uskoci.ru4_close_need')::uuid;
  aid uuid:=current_setting('uskoci.ru4_close_agreement')::uuid;
  r jsonb; replay jsonb;
  req integer; rev integer; s text; close_at timestamptz; agreement_status text; pending_status text;
begin
  r := public.rpc_close_remaining_search(nid,1,'ru4-close-main-0001','Dovoljne su dve osobe');
  if not coalesce((r->>'remainingSearchClosed')::boolean,false)
     or (r->>'selectedSlots')::integer<>2
     or (r->>'closedRemainingSlots')::integer<>1
     or (r->>'requiredSlots')::integer<>3 then
    raise exception 'RU4_CLOSE_BAD_RESULT' using detail=r::text;
  end if;

  select required_slots,revision,status,remaining_search_closed_at into req,rev,s,close_at
    from public.needs where id=nid;
  if req<>3 or rev<>1 or s<>'SELECTION' or close_at is null then
    raise exception 'RU4_CLOSE_REWROTE_NEED_TERMS_OR_STATE';
  end if;

  select status into agreement_status from public.agreements where id=aid;
  if agreement_status<>'CONFIRMED' then raise exception 'RU4_CLOSE_CHANGED_EXISTING_DOGOVOR'; end if;

  select status into pending_status from public.marketplace_responses where id=current_setting('uskoci.ru4_close_pending_response')::uuid;
  if pending_status<>'EXPIRED' then raise exception 'RU4_CLOSE_PENDING_RESPONSE_NOT_EXPIRED'; end if;

  replay := public.rpc_close_remaining_search(nid,1,'ru4-close-main-0001','Dovoljne su dve osobe');
  if not coalesce((replay->>'idempotentReplay')::boolean,false) then raise exception 'RU4_CLOSE_REPLAY_NOT_IDEMPOTENT'; end if;
end
$close$;

reset role;

do $private_assert$
declare nid uuid:=current_setting('uskoci.ru4_close_need')::uuid; cnt integer;
begin
  if exists(select 1 from private.dispatch_schedule where need_id=nid) then
    raise exception 'RU4_CLOSE_DISPATCH_SCHEDULE_SURVIVED';
  end if;
  select count(*) into cnt from private.remaining_search_close_commands where need_id=nid;
  if cnt<>1 then raise exception 'RU4_CLOSE_COMMAND_LEDGER_BAD'; end if;
end
$private_assert$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru4_close_worker_b'),true);
do $new_application_blocked$
declare denied boolean:=false; r jsonb;
begin
  begin
    r := public.rpc_submit_response(
      current_setting('uskoci.ru4_close_need')::uuid,
      1,
      current_setting('uskoci.ru4_close_worker_b_profile')::uuid,
      1,5100,null,null,'try after close','ru4-close-worker-submit-0001'
    );
  exception when sqlstate 'P0001' then
    if sqlerrm='NEED_REMAINING_SEARCH_CLOSED' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'RU4_CLOSE_NEW_APPLICATION_ALLOWED'; end if;
end
$new_application_blocked$;

reset role;
select 'PASS RU4_CLOSE_REMAINING_SEARCH owner_only keeps_required_slots_revision_and_dogovor expires_pending stops_dispatch blocks_new_application idempotent' as proof_result;
rollback;
