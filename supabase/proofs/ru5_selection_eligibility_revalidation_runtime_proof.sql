-- RU-5 manual Selection eligibility revalidation — rollback-only authenticated proof.
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

create or replace function pg_temp.expect_select_error(
  p_need_id uuid,
  p_need_revision integer,
  p_response_id uuid,
  p_response_version integer,
  p_hash text,
  p_request_id text,
  p_expected text
)
returns void
language plpgsql
as $$
begin
  begin
    perform public.rpc_select_response(
      p_need_id,p_need_revision,p_response_id,p_response_version,p_hash,p_request_id
    );
  exception when others then
    if sqlerrm = p_expected then return; end if;
    raise exception 'RU5_SELECTION_REVALIDATION_EXPECTED_%, GOT_% (%): %',
      p_expected,sqlerrm,sqlstate,sqlerrm;
  end;
  raise exception 'RU5_SELECTION_REVALIDATION_EXPECTED_ERROR_NOT_RAISED: %',p_expected;
end;
$$;

do $seed$
declare
  requester uuid := extensions.gen_random_uuid();
  worker_ready uuid := extensions.gen_random_uuid();
  worker_unready uuid := extensions.gen_random_uuid();
  worker_small uuid := extensions.gen_random_uuid();
  requester_pid uuid;
  ready_pid uuid;
  unready_pid uuid;
  small_pid uuid;
  n_ready uuid := extensions.gen_random_uuid();
  n_unready uuid := extensions.gen_random_uuid();
  n_small uuid := extensions.gen_random_uuid();
  r_ready uuid := extensions.gen_random_uuid();
  r_unready uuid := extensions.gen_random_uuid();
  r_small uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','ru5-sel-requester-'||requester||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Selection Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_ready,'authenticated','authenticated','ru5-sel-ready-'||worker_ready||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Ready Worker','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp()),
  (worker_unready,'authenticated','authenticated','ru5-sel-unready-'||worker_unready||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Legacy Worker','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_small,'authenticated','authenticated','ru5-sel-small-'||worker_small||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Small Team','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp());

  select id into requester_pid from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into ready_pid from public.app_profiles where account_id=worker_ready and kind='WORKER';
  select id into unready_pid from public.app_profiles where account_id=worker_unready and kind='WORKER';
  select id into small_pid from public.app_profiles where account_id=worker_small and kind='WORKER';
  if requester_pid is null or ready_pid is null or unready_pid is null or small_pid is null then
    raise exception 'RU5_SELECTION_REVALIDATION_PROFILE_SEED_FAILED';
  end if;

  update public.app_profiles
     set display_name='Ready Worker',city='Novi Sad',skills=array['Proof'],team_capacity=2
   where id=ready_pid;
  update public.app_profiles
     set display_name='Legacy Worker',city='Novi Sad',skills='{}'::text[],team_capacity=2
   where id=unready_pid;
  update public.app_profiles
     set display_name='Small Team',city='Novi Sad',skills=array['Proof'],team_capacity=1
   where id=small_pid;

  alter table public.app_profiles disable trigger guard_profile_write_trg;
  update public.app_profiles set profile_status='ACTIVE' where id in(ready_pid,unready_pid,small_pid);
  alter table public.app_profiles enable trigger guard_profile_write_trg;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(
    id,requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,mode,required_slots,response_deadline,published_at
  ) values
  (n_ready,requester,requester_pid,'PUBLISHED','Ready selection','proof','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_unready,requester,requester_pid,'PUBLISHED','Unready selection','proof','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_small,requester,requester_pid,'PUBLISHED','Small team selection','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp());
  perform set_config('uskoci.need_lifecycle','',true);

  insert into public.marketplace_responses(
    id,need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values
  (r_ready,n_ready,worker_ready,ready_pid,'OFFER','SUBMITTED',1,1,1,1100,'ready',statement_timestamp()),
  (r_unready,n_unready,worker_unready,unready_pid,'OFFER','SUBMITTED',1,1,1,1200,'legacy unready',statement_timestamp()),
  (r_small,n_small,worker_small,small_pid,'OFFER','SUBMITTED',1,1,2,1300,'team too small',statement_timestamp());

  insert into public.marketplace_response_versions(
    response_id,version,need_revision,covered_slots,price_rsd,scope_note,content_hash
  ) values
  (r_ready,1,1,1,1100,'ready',repeat('a',64)),
  (r_unready,1,1,1,1200,'legacy unready',repeat('b',64)),
  (r_small,1,1,2,1300,'team too small',repeat('c',64));

  perform set_config('uskoci.sel_requester',requester::text,true);
  perform set_config('uskoci.sel_n_ready',n_ready::text,true);
  perform set_config('uskoci.sel_n_unready',n_unready::text,true);
  perform set_config('uskoci.sel_n_small',n_small::text,true);
  perform set_config('uskoci.sel_r_ready',r_ready::text,true);
  perform set_config('uskoci.sel_r_unready',r_unready::text,true);
  perform set_config('uskoci.sel_r_small',r_small::text,true);
end
$seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.sel_requester'),true);

do $projection_and_denials$
declare
  rows jsonb;
  item jsonb;
  sel_before integer;
  agr_before integer;
begin
  rows := public.rpc_list_need_candidates(current_setting('uskoci.sel_n_unready')::uuid);
  item := pg_temp.candidate_for(rows,current_setting('uskoci.sel_r_unready')::uuid);
  if item is null or item->>'state'<>'STALE' or (item->>'canSelect')::boolean is true then
    raise exception 'RU5_SELECTION_REVALIDATION_UNREADY_PROJECTION_INVALID %',item;
  end if;

  rows := public.rpc_list_need_candidates(current_setting('uskoci.sel_n_small')::uuid);
  item := pg_temp.candidate_for(rows,current_setting('uskoci.sel_r_small')::uuid);
  if item is null or item->>'state'<>'STALE' or (item->>'canSelect')::boolean is true then
    raise exception 'RU5_SELECTION_REVALIDATION_TEAM_PROJECTION_INVALID %',item;
  end if;

  rows := public.rpc_list_need_candidates(current_setting('uskoci.sel_n_ready')::uuid);
  item := pg_temp.candidate_for(rows,current_setting('uskoci.sel_r_ready')::uuid);
  if item is null or item->>'state'<>'SELECTABLE' or (item->>'canSelect')::boolean is not true then
    raise exception 'RU5_SELECTION_REVALIDATION_READY_PROJECTION_INVALID %',item;
  end if;

  select count(*) into sel_before from public.need_selections;
  select count(*) into agr_before from public.agreements;

  perform pg_temp.expect_select_error(
    current_setting('uskoci.sel_n_unready')::uuid,1,
    current_setting('uskoci.sel_r_unready')::uuid,1,repeat('b',64),
    'sel-unready-proof','WORKER_PROFILE_NOT_READY'
  );
  if (select count(*) from public.need_selections)<>sel_before
     or (select count(*) from public.agreements)<>agr_before then
    raise exception 'RU5_SELECTION_REVALIDATION_UNREADY_PARTIAL_WRITE';
  end if;

  perform pg_temp.expect_select_error(
    current_setting('uskoci.sel_n_small')::uuid,1,
    current_setting('uskoci.sel_r_small')::uuid,1,repeat('c',64),
    'sel-team-proof','TEAM_CAPACITY_EXCEEDED'
  );
  if (select count(*) from public.need_selections)<>sel_before
     or (select count(*) from public.agreements)<>agr_before then
    raise exception 'RU5_SELECTION_REVALIDATION_TEAM_PARTIAL_WRITE';
  end if;
end
$projection_and_denials$;

-- Existing exact Selection -> Agreement behavior must still work for a ready Worker.
do $happy$
declare
  aid uuid;
  terms jsonb;
begin
  aid := public.rpc_select_response(
    current_setting('uskoci.sel_n_ready')::uuid,1,
    current_setting('uskoci.sel_r_ready')::uuid,1,repeat('a',64),
    'sel-ready-proof'
  );
  if aid is null then raise exception 'RU5_SELECTION_REVALIDATION_READY_SELECTION_FAILED'; end if;

  select av.terms into terms
    from public.agreements a
    join public.agreement_versions av on av.agreement_id=a.id and av.version=1
   where a.id=aid
     and a.selected_response_id=current_setting('uskoci.sel_r_ready')::uuid
     and a.status='CONFIRMED';

  if terms is null
     or (terms->>'need_revision')::integer<>1
     or (terms->>'response_version')::integer<>1
     or (terms->>'covered_slots')::integer<>1
     or (terms->>'price_rsd')::integer<>1100 then
    raise exception 'RU5_SELECTION_REVALIDATION_AGREEMENT_BINDING_INVALID %',terms;
  end if;
end
$happy$;
reset role;

\echo PASS RU5_SELECTION_ELIGIBILITY_REVALIDATION unready_stale team_capacity_stale ready_selectable unready_denied team_capacity_denied zero_partial_writes exact_agreement_binding rollback_only
rollback;
