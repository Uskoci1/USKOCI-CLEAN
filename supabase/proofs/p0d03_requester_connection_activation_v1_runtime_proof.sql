-- USKOČI P0D-03 — rollback-only authenticated Requester Povezivanje activation proof.
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
    raise exception 'P0D03_EXPECTED_%, GOT_% (%): %',p_expected,sqlerrm,sqlstate,sqlerrm;
  end;
  raise exception 'P0D03_EXPECTED_ERROR_NOT_RAISED: %',p_expected;
end;
$$;

do $seed$
declare
  requester uuid := extensions.gen_random_uuid();
  worker uuid := extensions.gen_random_uuid();
  requester_pid uuid;
  worker_pid uuid;
  n_main uuid := extensions.gen_random_uuid();
  n_rogue uuid := extensions.gen_random_uuid();
  r_main uuid := extensions.gen_random_uuid();
  r_rogue uuid := extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (requester,'authenticated','authenticated','p0d03-requester-'||requester||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D03 Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
  (worker,'authenticated','authenticated','p0d03-worker-'||worker||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D03 Worker','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp());

  select id into requester_pid from public.app_profiles where account_id=requester and kind='REQUESTER';
  select id into worker_pid from public.app_profiles where account_id=worker and kind='WORKER';
  if requester_pid is null or worker_pid is null then raise exception 'P0D03_PROFILE_SEED_FAILED'; end if;

  update public.app_profiles
     set display_name='P0D03 Worker',city='Novi Sad',skills=array['Proof'],team_capacity=3
   where id=worker_pid;
  alter table public.app_profiles disable trigger guard_profile_write_trg;
  update public.app_profiles set profile_status='ACTIVE' where id=worker_pid;
  alter table public.app_profiles enable trigger guard_profile_write_trg;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(
    id,requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,mode,required_slots,response_deadline,published_at
  ) values
  (n_main,requester,requester_pid,'PUBLISHED','P0D03 main','proof','PROOF','Novi Sad','Liman','OFFERS',2,statement_timestamp()+interval '2 days',statement_timestamp()),
  (n_rogue,requester,requester_pid,'PUBLISHED','P0D03 rogue','proof','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp());
  perform set_config('uskoci.need_lifecycle','',true);

  insert into public.marketplace_responses(
    id,need_id,worker_account_id,worker_profile_id,response_kind,status,
    submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
  ) values
  (r_main,n_main,worker,worker_pid,'OFFER','SUBMITTED',1,1,2,5700,'main',statement_timestamp()),
  (r_rogue,n_rogue,worker,worker_pid,'OFFER','SUBMITTED',1,1,1,8900,'rogue',statement_timestamp());

  insert into public.marketplace_response_versions(
    response_id,version,need_revision,covered_slots,price_rsd,scope_note,content_hash
  ) values
  (r_main,1,1,2,5700,'main',repeat('7',64)),
  (r_rogue,1,1,1,8900,'rogue',repeat('8',64));

  perform set_config('uskoci.p0d03_requester',requester::text,true);
  perform set_config('uskoci.p0d03_worker',worker::text,true);
  perform set_config('uskoci.p0d03_requester_pid',requester_pid::text,true);
  perform set_config('uskoci.p0d03_worker_pid',worker_pid::text,true);
  perform set_config('uskoci.p0d03_n_main',n_main::text,true);
  perform set_config('uskoci.p0d03_n_rogue',n_rogue::text,true);
  perform set_config('uskoci.p0d03_r_main',r_main::text,true);
  perform set_config('uskoci.p0d03_r_rogue',r_rogue::text,true);
end
$seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.p0d03_requester'),true);

do $selection_and_replay$
declare
  aid1 uuid;
  aid2 uuid;
  act_count integer;
  sel_count integer;
  agr_count integer;
begin
  aid1 := public.rpc_select_response(
    current_setting('uskoci.p0d03_n_main')::uuid,1,
    current_setting('uskoci.p0d03_r_main')::uuid,1,repeat('7',64),
    'p0d03-main-key'
  );
  if aid1 is null then raise exception 'P0D03_FIRST_SELECTION_FAILED'; end if;
  perform set_config('uskoci.p0d03_main_agreement',aid1::text,true);

  select count(*) into act_count from private.connection_activations;
  select count(*) into sel_count from public.need_selections;
  select count(*) into agr_count from public.agreements;

  aid2 := public.rpc_select_response(
    current_setting('uskoci.p0d03_n_main')::uuid,1,
    current_setting('uskoci.p0d03_r_main')::uuid,1,repeat('7',64),
    'p0d03-main-key'
  );
  if aid2 <> aid1 then raise exception 'P0D03_REPLAY_DIFFERENT_AGREEMENT'; end if;
  if (select count(*) from private.connection_activations) <> act_count
     or (select count(*) from public.need_selections) <> sel_count
     or (select count(*) from public.agreements) <> agr_count then
    raise exception 'P0D03_REPLAY_DUPLICATED_ROWS';
  end if;

  perform pg_temp.expect_select_error(
    current_setting('uskoci.p0d03_n_main')::uuid,1,
    current_setting('uskoci.p0d03_r_rogue')::uuid,1,repeat('8',64),
    'p0d03-main-key','IDEMPOTENCY_KEY_REUSED'
  );
  if (select count(*) from private.connection_activations) <> act_count then
    raise exception 'P0D03_DIFFERENT_PAYLOAD_CREATED_ACTIVATION';
  end if;
end
$selection_and_replay$;
reset role;

do $receipt_contract$
declare
  a private.connection_activations%rowtype;
  c private.selection_commands%rowtype;
  av public.agreement_versions%rowtype;
  expected_agreement uuid := current_setting('uskoci.p0d03_main_agreement')::uuid;
begin
  select * into a from private.connection_activations where agreement_id=expected_agreement;
  if not found then raise exception 'P0D03_ACTIVATION_MISSING'; end if;

  select * into c
    from private.selection_commands
   where requester_account_id=current_setting('uskoci.p0d03_requester')::uuid
     and client_request_id='p0d03-main-key';
  if not found then raise exception 'P0D03_SELECTION_RECEIPT_MISSING'; end if;

  select * into av from public.agreement_versions where agreement_id=expected_agreement and version=1;
  if not found then raise exception 'P0D03_AGREEMENT_VERSION_MISSING'; end if;

  if a.requester_account_id <> current_setting('uskoci.p0d03_requester')::uuid
     or a.beneficiary_account_id <> a.requester_account_id
     or a.worker_account_id <> current_setting('uskoci.p0d03_worker')::uuid
     or a.activation_reason <> 'SELECTION'
     or a.policy_key <> 'REQUESTER_SELECTION_V1'
     or a.policy_version <> 1
     or a.policy_snapshot->>'chargeMode' <> 'PROMOTIONAL_FREE'
     or a.policy_snapshot->>'unitBasis' <> 'HEADCOUNT'
     or a.units <> 2
     or a.platform_cost_rsd <> 0
     or a.state <> 'SATISFIED'
     or a.request_hash <> c.request_hash
     or a.selection_id <> c.selection_id
     or a.agreement_id <> c.agreement_id
     or a.response_id <> c.response_id
     or a.response_version <> c.response_version
     or a.response_content_hash <> c.response_content_hash then
    raise exception 'P0D03_ACTIVATION_BINDING_INVALID %',to_jsonb(a);
  end if;

  if (av.terms->>'price_rsd')::integer <> 5700 then
    raise exception 'P0D03_TASK_PRICE_CHANGED';
  end if;
  if a.platform_cost_rsd <> 0
     or a.policy_snapshot ? 'price_rsd'
     or a.policy_snapshot ? 'taskPriceRsd'
     or a.policy_snapshot ? 'laborPriceRsd' then
    raise exception 'P0D03_TASK_PRICE_CONFLATED_WITH_PLATFORM_COST';
  end if;

  if exists(select 1 from private.connection_activations where beneficiary_account_id=worker_account_id) then
    raise exception 'P0D03_WORKER_BENEFICIARY_OR_DEBIT_SEMANTIC_FOUND';
  end if;

  if has_table_privilege('anon','private.connection_activations','SELECT')
     or has_table_privilege('authenticated','private.connection_activations','SELECT')
     or has_table_privilege('service_role','private.connection_activations','SELECT')
     or has_table_privilege('anon','private.connection_policy_versions','SELECT')
     or has_table_privilege('authenticated','private.connection_policy_versions','SELECT')
     or has_table_privilege('service_role','private.connection_policy_versions','SELECT') then
    raise exception 'P0D03_PRIVATE_LEDGER_EXPOSED';
  end if;
end
$receipt_contract$;

-- Prove the private activation receipt is immutable even to the proof owner.
do $immutability$
begin
  begin
    update private.connection_activations
       set platform_cost_rsd=0
     where agreement_id=current_setting('uskoci.p0d03_main_agreement')::uuid;
  exception when others then
    if sqlerrm='CONNECTION_LEDGER_IMMUTABLE' then return; end if;
    raise;
  end;
  raise exception 'P0D03_ACTIVATION_UPDATE_WAS_NOT_BLOCKED';
end
$immutability$;

-- Prove future Agreement INSERT cannot commit without its matching activation.
do $agreement_guard$
declare
  sel uuid := extensions.gen_random_uuid();
  agr uuid := extensions.gen_random_uuid();
begin
  insert into public.need_selections(
    id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,
    response_id,worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    sel,current_setting('uskoci.p0d03_n_rogue')::uuid,1,
    current_setting('uskoci.p0d03_requester')::uuid,'p0d03-rogue-key',1,
    current_setting('uskoci.p0d03_r_rogue')::uuid,
    current_setting('uskoci.p0d03_worker')::uuid,
    current_setting('uskoci.p0d03_worker_pid')::uuid,
    'REQUESTER_SELECTS','SELECTED'
  );

  begin
    insert into public.agreements(
      id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
      worker_account_id,worker_profile_id,current_version,status
    ) values (
      agr,current_setting('uskoci.p0d03_n_rogue')::uuid,sel,
      current_setting('uskoci.p0d03_r_rogue')::uuid,
      current_setting('uskoci.p0d03_requester')::uuid,
      current_setting('uskoci.p0d03_requester_pid')::uuid,
      current_setting('uskoci.p0d03_worker')::uuid,
      current_setting('uskoci.p0d03_worker_pid')::uuid,1,'CONFIRMED'
    );
    set constraints agreements_require_connection_activation_trg immediate;
  exception when others then
    if sqlerrm='CONNECTION_ACTIVATION_REQUIRED' then
      return;
    end if;
    raise exception 'P0D03_WRONG_AGREEMENT_GUARD_ERROR %',sqlerrm;
  end;
  raise exception 'P0D03_AGREEMENT_WITHOUT_ACTIVATION_WAS_ALLOWED';
end
$agreement_guard$;

\echo PASS P0D03_REQUESTER_CONNECTION_ACTIVATION_V1 requester_beneficiary selection_reason headcount_units promotional_free zero_platform_cost task_price_separate same_key_same_receipt different_payload_rejected no_worker_debit private_immutable_ledger agreement_requires_activation rollback_only
rollback;
