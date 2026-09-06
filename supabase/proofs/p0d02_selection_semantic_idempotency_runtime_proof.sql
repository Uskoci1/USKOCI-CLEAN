-- USKOČI P0D-02 — rollback-only authenticated Selection semantic idempotency proof.
\set ON_ERROR_STOP on
begin;

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
    raise exception 'P0D02_EXPECTED_%, GOT_% (%): %',p_expected,sqlerrm,sqlstate,sqlerrm;
  end;
  raise exception 'P0D02_EXPECTED_ERROR_NOT_RAISED: %',p_expected;
end;
$$;

do $seed$
declare
  requester uuid := extensions.gen_random_uuid();
  worker_a uuid := extensions.gen_random_uuid();
  worker_b uuid := extensions.gen_random_uuid();
  requester_pid uuid;
  worker_a_pid uuid;
  worker_b_pid uuid;
  n_main uuid := extensions.gen_random_uuid();
  n_legacy uuid := extensions.gen_random_uuid();
  r_a uuid := extensions.gen_random_uuid();
  r_b uuid := extensions.gen_random_uuid();
  r_legacy uuid := extensions.gen_random_uuid();
  legacy_selection uuid := extensions.gen_random_uuid();
  legacy_agreement uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','p0d02-requester-'||requester||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D02 Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker_a,'authenticated','authenticated','p0d02-worker-a-'||worker_a||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D02 Worker A','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp()),
  (worker_b,'authenticated','authenticated','p0d02-worker-b-'||worker_b||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D02 Worker B','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp());

  select id into requester_pid from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_a_pid from public.app_profiles where account_id=worker_a and kind='WORKER';
  select id into worker_b_pid from public.app_profiles where account_id=worker_b and kind='WORKER';
  if requester_pid is null or worker_a_pid is null or worker_b_pid is null then
    raise exception 'P0D02_PROFILE_SEED_FAILED';
  end if;

  update public.app_profiles
     set display_name='P0D02 Worker A',city='Novi Sad',skills=array['Proof'],team_capacity=2
   where id=worker_a_pid;
  update public.app_profiles
     set display_name='P0D02 Worker B',city='Novi Sad',skills=array['Proof'],team_capacity=2
   where id=worker_b_pid;

  alter table public.app_profiles disable trigger guard_profile_write_trg;
  update public.app_profiles set profile_status='ACTIVE' where id in(worker_a_pid,worker_b_pid);
  alter table public.app_profiles enable trigger guard_profile_write_trg;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(
    id,requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,mode,required_slots,response_deadline,published_at
  ) values
  (n_main,requester,requester_pid,'PUBLISHED','P0D02 main','proof','PROOF','Novi Sad','Liman','OFFERS',3,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_legacy,requester,requester_pid,'PUBLISHED','P0D02 legacy','proof','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp());
  perform set_config('uskoci.need_lifecycle','',true);

  insert into public.marketplace_responses(
    id,need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values
  (r_a,n_main,worker_a,worker_a_pid,'OFFER','SUBMITTED',1,1,1,1100,'a',statement_timestamp()),
  (r_b,n_main,worker_b,worker_b_pid,'OFFER','SUBMITTED',1,1,2,2200,'b',statement_timestamp()),
  (r_legacy,n_legacy,worker_a,worker_a_pid,'OFFER','SELECTED',1,1,1,1300,'legacy',statement_timestamp());

  insert into public.marketplace_response_versions(
    response_id,version,need_revision,covered_slots,price_rsd,scope_note,content_hash
  ) values
  (r_a,1,1,1,1100,'a',repeat('a',64)),
  (r_b,1,1,2,2200,'b',repeat('b',64)),
  (r_legacy,1,1,1,1300,'legacy',repeat('c',64));

  -- Simulate a valid pre-P0D-02 historical Selection. Do not fabricate a new
  -- command receipt: legacy replay must rely only on immutable Selection/Agreement evidence.
  insert into public.need_selections(
    id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,
    response_id,worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    legacy_selection,n_legacy,1,requester,'p0d02-legacy-key',1,
    r_legacy,worker_a,worker_a_pid,'REQUESTER_SELECTS','SELECTED'
  );

  insert into public.agreements(
    id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values (
    legacy_agreement,n_legacy,legacy_selection,r_legacy,requester,requester_pid,
    worker_a,worker_a_pid,1,'CONFIRMED'
  );

  insert into public.agreement_versions(
    agreement_id,version,status,terms,content_hash,created_by_account_id
  ) values (
    legacy_agreement,1,'CONFIRMED',
    jsonb_build_object('price_rsd',1300,'covered_slots',1,'need_revision',1,'response_version',1),
    repeat('c',64),requester
  );

  insert into public.agreement_execution(agreement_id,agreement_version,mode,state)
  values(legacy_agreement,1,'PHYSICAL','CONFIRMED');

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs set status='ACTIVE' where id=n_legacy;
  perform set_config('uskoci.need_lifecycle','',true);

  perform set_config('uskoci.p0d02_requester',requester::text,true);
  perform set_config('uskoci.p0d02_n_main',n_main::text,true);
  perform set_config('uskoci.p0d02_n_legacy',n_legacy::text,true);
  perform set_config('uskoci.p0d02_r_a',r_a::text,true);
  perform set_config('uskoci.p0d02_r_b',r_b::text,true);
  perform set_config('uskoci.p0d02_r_legacy',r_legacy::text,true);
  perform set_config('uskoci.p0d02_legacy_agreement',legacy_agreement::text,true);
end
$seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0d02_requester'),true);

do $semantic_replay$
declare
  aid1 uuid;
  aid2 uuid;
  sel_after_first integer;
  agr_after_first integer;
begin
  aid1 := public.rpc_select_response(
    current_setting('uskoci.p0d02_n_main')::uuid,1,
    current_setting('uskoci.p0d02_r_a')::uuid,1,repeat('a',64),
    'p0d02-main-key'
  );
  if aid1 is null then raise exception 'P0D02_FIRST_SELECTION_FAILED'; end if;
  perform set_config('uskoci.p0d02_main_agreement',aid1::text,true);

  select count(*) into sel_after_first from public.need_selections;
  select count(*) into agr_after_first from public.agreements;

  aid2 := public.rpc_select_response(
    current_setting('uskoci.p0d02_n_main')::uuid,1,
    current_setting('uskoci.p0d02_r_a')::uuid,1,repeat('a',64),
    'p0d02-main-key'
  );
  if aid2 <> aid1 then
    raise exception 'P0D02_SAME_PAYLOAD_REPLAY_DIFFERENT_RESULT % %',aid1,aid2;
  end if;
  if (select count(*) from public.need_selections) <> sel_after_first
     or (select count(*) from public.agreements) <> agr_after_first then
    raise exception 'P0D02_SAME_PAYLOAD_REPLAY_DUPLICATED_BUSINESS_ROWS';
  end if;

  perform pg_temp.expect_select_error(
    current_setting('uskoci.p0d02_n_main')::uuid,1,
    current_setting('uskoci.p0d02_r_b')::uuid,1,repeat('b',64),
    'p0d02-main-key','IDEMPOTENCY_KEY_REUSED'
  );
  perform pg_temp.expect_select_error(
    current_setting('uskoci.p0d02_n_main')::uuid,1,
    current_setting('uskoci.p0d02_r_a')::uuid,2,repeat('a',64),
    'p0d02-main-key','IDEMPOTENCY_KEY_REUSED'
  );
  perform pg_temp.expect_select_error(
    current_setting('uskoci.p0d02_n_main')::uuid,1,
    current_setting('uskoci.p0d02_r_a')::uuid,1,repeat('d',64),
    'p0d02-main-key','IDEMPOTENCY_KEY_REUSED'
  );

  if (select count(*) from public.need_selections) <> sel_after_first
     or (select count(*) from public.agreements) <> agr_after_first then
    raise exception 'P0D02_DIFFERENT_PAYLOAD_REUSE_PARTIAL_WRITE';
  end if;
end
$semantic_replay$;

do $legacy_replay$
declare
  aid uuid;
  expected uuid := current_setting('uskoci.p0d02_legacy_agreement')::uuid;
begin
  aid := public.rpc_select_response(
    current_setting('uskoci.p0d02_n_legacy')::uuid,1,
    current_setting('uskoci.p0d02_r_legacy')::uuid,1,repeat('c',64),
    'p0d02-legacy-key'
  );
  if aid <> expected then
    raise exception 'P0D02_LEGACY_EXACT_REPLAY_FAILED % %',expected,aid;
  end if;

  perform pg_temp.expect_select_error(
    current_setting('uskoci.p0d02_n_legacy')::uuid,1,
    current_setting('uskoci.p0d02_r_legacy')::uuid,1,repeat('d',64),
    'p0d02-legacy-key','IDEMPOTENCY_KEY_REUSED'
  );
end
$legacy_replay$;
reset role;

do $receipt_and_privacy$
declare
  c private.selection_commands%rowtype;
  expected_agreement uuid := current_setting('uskoci.p0d02_main_agreement')::uuid;
begin
  select * into c
    from private.selection_commands
   where requester_account_id=current_setting('uskoci.p0d02_requester')::uuid
     and client_request_id='p0d02-main-key';
  if not found
     or c.agreement_id <> expected_agreement
     or c.need_id <> current_setting('uskoci.p0d02_n_main')::uuid
     or c.response_id <> current_setting('uskoci.p0d02_r_a')::uuid
     or c.response_version <> 1
     or c.response_content_hash <> repeat('a',64)
     or c.covered_slots <> 1
     or char_length(c.request_hash) <> 64 then
    raise exception 'P0D02_DURABLE_RECEIPT_INVALID %',to_jsonb(c);
  end if;

  if exists(
    select 1 from private.selection_commands
     where client_request_id='p0d02-legacy-key'
  ) then
    raise exception 'P0D02_LEGACY_HASH_WAS_FABRICATED';
  end if;

  if has_table_privilege('anon','private.selection_commands','SELECT')
     or has_table_privilege('authenticated','private.selection_commands','SELECT')
     or has_table_privilege('service_role','private.selection_commands','SELECT') then
    raise exception 'P0D02_COMMAND_RECEIPT_EXPOSED';
  end if;
end
$receipt_and_privacy$;

\echo PASS P0D02_SELECTION_SEMANTIC_IDEMPOTENCY same_key_same_payload same_agreement no_duplicate_rows different_response_rejected different_version_rejected different_hash_rejected durable_receipt legacy_exact_replay legacy_mismatch_rejected no_legacy_hash_fabrication private_receipt rollback_only
rollback;
