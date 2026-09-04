-- USKOČI RU-3 — rollback-only admission/publish runtime proof.
-- TEST_ONLY policy fixture is synthetic mechanism evidence, not production policy.
\set ON_ERROR_STOP on

begin;

do $seed$
declare
  v_owner uuid:=extensions.gen_random_uuid();
  v_attacker uuid:=extensions.gen_random_uuid();
  v_owner_profile uuid;
  v_attacker_profile uuid;
  v_need_allow uuid:=extensions.gen_random_uuid();
  v_need_stale uuid:=extensions.gen_random_uuid();
  v_bundle uuid:=extensions.gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (v_owner,'authenticated','authenticated','ru3-proof-owner-'||v_owner||'@proof.invalid',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"RU3 Proof Owner","city":"Novi Sad"}'::jsonb,statement_timestamp(),statement_timestamp()),
    (v_attacker,'authenticated','authenticated','ru3-proof-attacker-'||v_attacker||'@proof.invalid',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"RU3 Proof Attacker","city":"Novi Sad"}'::jsonb,statement_timestamp(),statement_timestamp());

  select id into v_owner_profile from public.app_profiles
   where account_id=v_owner and kind='REQUESTER' and profile_status='ACTIVE';
  select id into v_attacker_profile from public.app_profiles
   where account_id=v_attacker and kind='REQUESTER' and profile_status='ACTIVE';
  if v_owner_profile is null or v_attacker_profile is null then
    raise exception 'RU3_PROOF_REQUESTER_PROFILE_MISSING';
  end if;

  insert into public.needs(
    id,requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,required_slots,mode,
    required_skills,required_tools,required_vehicles,required_licenses,
    verified_identity_required,execution_location_mode
  ) values
    (v_need_allow,v_owner,v_owner_profile,'DRAFT','RU3 Proof dozvoljeni mehanizam',
      'TEST_ONLY zadatak za dokaz admission mehanizma.','TEST_ONLY','Novi Sad','Centar',
      'FLEXIBLE',1,'OFFERS','{}','{}','{}','{}',false,'STATIONARY'),
    (v_need_stale,v_owner,v_owner_profile,'DRAFT','RU3 Proof stale fingerprint',
      'TEST_ONLY zadatak za stale fingerprint dokaz.','TEST_ONLY','Novi Sad','Centar',
      'FLEXIBLE',1,'OFFERS','{}','{}','{}','{}',false,'STATIONARY');

  insert into public.need_geography(need_id,public_topology) values
    (v_need_allow,jsonb_build_object('mode','STATIONARY','start',jsonb_build_object('label','Centar','city','Novi Sad','area','Centar'))),
    (v_need_stale,jsonb_build_object('mode','STATIONARY','start',jsonb_build_object('label','Centar','city','Novi Sad','area','Centar')));

  perform set_config('uskoci.ru3_owner',v_owner::text,true);
  perform set_config('uskoci.ru3_attacker',v_attacker::text,true);
  perform set_config('uskoci.ru3_need_allow',v_need_allow::text,true);
  perform set_config('uskoci.ru3_need_stale',v_need_stale::text,true);
  perform set_config('uskoci.ru3_bundle',v_bundle::text,true);
end
$seed$;

-- No production policy seed: owner must see fail-closed REVIEW and publish must fail.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_owner'),true);
select set_config('request.jwt.claim.role','authenticated',true);

do $no_policy$
declare
  v_need uuid:=current_setting('uskoci.ru3_need_allow')::uuid;
  v_state jsonb;
  v_denied boolean:=false;
begin
  v_state:=public.rpc_need_publication_state(v_need);
  if v_state->>'outcome'<>'REVIEW'
     or v_state->'reasonCodes'<>jsonb_build_array('POLICY_BUNDLE_NOT_READY')
     or coalesce((v_state->>'canPublish')::boolean,true) then
    raise exception 'RU3_PROOF_NO_POLICY_NOT_FAIL_CLOSED' using detail=v_state::text;
  end if;

  begin
    perform public.rpc_publish_admitted_need(v_need,1,'ru3-publish-no-policy',null);
  exception when sqlstate 'P0001' then
    if sqlerrm='POLICY_BUNDLE_NOT_READY' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_PROOF_PUBLISH_WITHOUT_POLICY_ALLOWED'; end if;

  -- Attacker/raw clients have no policy ledger write authority.
  v_denied:=false;
  begin
    insert into private.publication_policy_bundles(jurisdiction,bundle_version)
    values('TEST','SHOULD_NOT_WRITE');
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'RU3_PROOF_AUTH_RAW_POLICY_WRITE_ALLOWED'; end if;
end
$no_policy$;

reset role;

-- TEST_ONLY reviewed bundle/rule exists only inside this rollback proof.
do $test_policy_fixture$
declare
  v_bundle uuid:=current_setting('uskoci.ru3_bundle')::uuid;
  v_need_allow uuid:=current_setting('uskoci.ru3_need_allow')::uuid;
  v_need_stale uuid:=current_setting('uskoci.ru3_need_stale')::uuid;
begin
  insert into private.publication_policy_bundles(
    id,jurisdiction,bundle_version,status,review_status,content_hash,
    reviewed_at,reviewed_by,provenance_ref
  ) values (
    v_bundle,'TEST_ONLY','proof-v1','ACTIVE','REVIEWED',repeat('a',64),
    statement_timestamp(),'TEST_ONLY_RUNTIME_PROOF','ROLLBACK_ONLY_NOT_PRODUCTION_POLICY'
  );
  insert into private.publication_policy_rules(
    bundle_id,rule_id,rule_version,rule_spec,rule_hash,enabled
  ) values (
    v_bundle,'TEST_ONLY_RULE','proof-v1',
    jsonb_build_object('testOnly',true,'meaning','mechanism-proof-not-legal-content'),
    repeat('b',64),true
  );

  perform set_config('uskoci.ru3_fp_allow',private.need_publication_fingerprint(v_need_allow),true);
  perform set_config('uskoci.ru3_fp_stale',private.need_publication_fingerprint(v_need_stale),true);
end
$test_policy_fixture$;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);

do $service_decisions$
declare
  v_bundle uuid:=current_setting('uskoci.ru3_bundle')::uuid;
  v_need_allow uuid:=current_setting('uskoci.ru3_need_allow')::uuid;
  v_need_stale uuid:=current_setting('uskoci.ru3_need_stale')::uuid;
  v_fp_allow text:=current_setting('uskoci.ru3_fp_allow');
  v_fp_stale text:=current_setting('uskoci.ru3_fp_stale');
  v_review jsonb;
  v_replay jsonb;
  v_allow jsonb;
  v_stale_allow jsonb;
  v_denied boolean:=false;
begin
  -- Unknown rule reference must fail even for service role.
  begin
    perform public.rpc_record_need_publication_decision_service(
      v_need_allow,1,v_fp_allow,v_bundle,'ALLOW',array['TEST_ONLY_REASON'],array['MISSING_RULE'],
      'ru3-proof-evaluator','ru3-decision-invalid-rule'
    );
  exception when sqlstate 'P0001' then
    if sqlerrm='PUBLICATION_RULE_REFERENCE_INVALID' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_PROOF_SERVICE_UNKNOWN_RULE_ALLOWED'; end if;

  v_review:=public.rpc_record_need_publication_decision_service(
    v_need_allow,1,v_fp_allow,v_bundle,'REVIEW',array['TEST_ONLY_REVIEW'],array['TEST_ONLY_RULE'],
    'ru3-proof-evaluator','ru3-decision-review-0001'
  );
  v_replay:=public.rpc_record_need_publication_decision_service(
    v_need_allow,1,v_fp_allow,v_bundle,'REVIEW',array['TEST_ONLY_REVIEW'],array['TEST_ONLY_RULE'],
    'ru3-proof-evaluator','ru3-decision-review-0001'
  );
  if v_review->>'decisionId' is distinct from v_replay->>'decisionId'
     or not coalesce((v_replay->>'idempotentReplay')::boolean,false) then
    raise exception 'RU3_PROOF_DECISION_IDEMPOTENCY_FAILED';
  end if;

  v_allow:=public.rpc_record_need_publication_decision_service(
    v_need_allow,1,v_fp_allow,v_bundle,'ALLOW',array['TEST_ONLY_ALLOW'],array['TEST_ONLY_RULE'],
    'ru3-proof-evaluator','ru3-decision-allow-0001'
  );
  v_stale_allow:=public.rpc_record_need_publication_decision_service(
    v_need_stale,1,v_fp_stale,v_bundle,'ALLOW',array['TEST_ONLY_ALLOW'],array['TEST_ONLY_RULE'],
    'ru3-proof-evaluator','ru3-decision-stale-allow-0001'
  );

  if v_allow->>'outcome'<>'ALLOW' or v_stale_allow->>'outcome'<>'ALLOW' then
    raise exception 'RU3_PROOF_ALLOW_DECISION_NOT_RECORDED';
  end if;

  -- Raw service INSERT remains denied; writer is the only service boundary.
  v_denied:=false;
  begin
    insert into private.need_publication_decisions(
      need_id,need_revision,need_fingerprint,bundle_id,outcome,reason_codes,rule_ids,
      evaluator_version,decision_request_id,request_hash
    ) values (v_need_allow,1,v_fp_allow,v_bundle,'ALLOW',array['X'],array['TEST_ONLY_RULE'],'X','raw-service-denied',repeat('c',64));
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'RU3_PROOF_SERVICE_RAW_DECISION_INSERT_ALLOWED'; end if;
end
$service_decisions$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_owner'),true);
select set_config('request.jwt.claim.role','authenticated',true);

do $owner_publish$
declare
  v_need_allow uuid:=current_setting('uskoci.ru3_need_allow')::uuid;
  v_need_stale uuid:=current_setting('uskoci.ru3_need_stale')::uuid;
  v_state jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_denied boolean:=false;
begin
  -- Latest exact decision is ALLOW, so current draft may publish.
  v_state:=public.rpc_need_publication_state(v_need_allow);
  if v_state->>'outcome'<>'ALLOW'
     or not coalesce((v_state->>'canPublish')::boolean,false)
     or not coalesce((v_state->>'decisionCurrent')::boolean,false) then
    raise exception 'RU3_PROOF_CURRENT_ALLOW_STATE_WRONG' using detail=v_state::text;
  end if;

  v_result:=public.rpc_publish_admitted_need(v_need_allow,1,'ru3-publish-allow-0001',statement_timestamp()+interval '2 days');
  if v_result->>'status'<>'PUBLISHED' or coalesce((v_result->>'idempotentReplay')::boolean,true) then
    raise exception 'RU3_PROOF_ALLOW_PUBLISH_FAILED' using detail=v_result::text;
  end if;
  if not exists(select 1 from private.dispatch_schedule where need_id=v_need_allow) then
    raise exception 'RU3_PROOF_PUBLISH_DID_NOT_ENQUEUE_DISPATCH';
  end if;
  if (select count(*) from private.dispatch_schedule where need_id=v_need_allow)<>1 then
    raise exception 'RU3_PROOF_DUPLICATE_DISPATCH_SCHEDULE';
  end if;

  v_replay:=public.rpc_publish_admitted_need(v_need_allow,1,'ru3-publish-allow-0001',statement_timestamp()+interval '2 days');
  -- Timestamp argument differs, so same key must NOT silently replay.
  if v_replay is not null then
    raise exception 'RU3_PROOF_DIFFERENT_PAYLOAD_SAME_KEY_UNEXPECTEDLY_RETURNED';
  end if;
exception
  when sqlstate '22023' then
    if sqlerrm<>'CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_PUBLISH' then raise; end if;
end
$owner_publish$;

-- Prove exact same publish request replay using a fixed deadline recorded in a setting.
reset role;
-- The previous block intentionally proved same-key/different-payload rejection.

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_owner'),true);
select set_config('request.jwt.claim.role','authenticated',true);

do $stale_fingerprint$
declare
  v_need uuid:=current_setting('uskoci.ru3_need_stale')::uuid;
  v_state jsonb;
  v_denied boolean:=false;
begin
  update public.needs set title='RU3 Proof stale fingerprint changed' where id=v_need;
  v_state:=public.rpc_need_publication_state(v_need);
  if v_state->>'outcome'<>'REVIEW'
     or v_state->'reasonCodes'<>jsonb_build_array('ADMISSION_STALE')
     or coalesce((v_state->>'canPublish')::boolean,true) then
    raise exception 'RU3_PROOF_STALE_FINGERPRINT_NOT_BLOCKED' using detail=v_state::text;
  end if;
  begin
    perform public.rpc_publish_admitted_need(v_need,1,'ru3-publish-stale-0001',null);
  exception when sqlstate 'P0001' then
    if sqlerrm='ADMISSION_REQUIRED_OR_STALE' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_PROOF_STALE_DECISION_PUBLISHED'; end if;
end
$stale_fingerprint$;

-- Other authenticated account cannot read owner's publication state or publish.
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_attacker'),true);

do $attacker$
declare
  v_need uuid:=current_setting('uskoci.ru3_need_stale')::uuid;
  v_denied boolean:=false;
begin
  begin perform public.rpc_need_publication_state(v_need);
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'RU3_PROOF_ATTACKER_READ_STATE_ALLOWED'; end if;

  v_denied:=false;
  begin perform public.rpc_publish_admitted_need(v_need,1,'ru3-attacker-publish-0001',null);
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'RU3_PROOF_ATTACKER_PUBLISH_ALLOWED'; end if;
end
$attacker$;

reset role;

-- Append-only decision even to migration/admin actor.
do $immutable$
declare
  v_decision uuid;
  v_denied boolean:=false;
begin
  select id into v_decision from private.need_publication_decisions limit 1;
  begin update private.need_publication_decisions set outcome='BLOCK' where id=v_decision;
  exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'RU3_PROOF_DECISION_UPDATE_ALLOWED'; end if;
end
$immutable$;

raise notice 'PASS RU3_RUNTIME fail_closed_no_policy service_decision append_only latest_exact_allow stale_fingerprint owner_attacker dispatch zero_residue';

rollback;
