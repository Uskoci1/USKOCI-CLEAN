-- USKOČI RU-3 / B06 disposable runtime proof.
-- Assumes B05 + exact B06 candidate are applied to a disposable predecessor.
-- All fixtures and decisions are rolled back.
\set ON_ERROR_STOP on

do $structural$
begin
  if to_regclass('private.need_publication_decisions') is null then
    raise exception 'RU3_B06_PROOF: decision table missing';
  end if;

  if exists (select 1 from private.need_publication_decisions) then
    raise exception 'RU3_B06_PROOF: candidate seeded decisions';
  end if;

  if has_table_privilege('authenticated','private.need_publication_decisions','SELECT')
     or has_table_privilege('authenticated','private.need_publication_decisions','INSERT')
     or has_table_privilege('authenticated','private.need_publication_decisions','UPDATE')
     or has_table_privilege('authenticated','private.need_publication_decisions','DELETE')
     or has_table_privilege('service_role','private.need_publication_decisions','SELECT')
     or has_table_privilege('service_role','private.need_publication_decisions','INSERT')
     or has_table_privilege('service_role','private.need_publication_decisions','UPDATE')
     or has_table_privilege('service_role','private.need_publication_decisions','DELETE') then
    raise exception 'RU3_B06_PROOF: decision table authority leaked';
  end if;

  if has_function_privilege('authenticated','private.need_publication_fingerprint_snapshot(uuid)','EXECUTE')
     or has_function_privilege('service_role','private.need_publication_fingerprint_snapshot(uuid)','EXECUTE') then
    raise exception 'RU3_B06_PROOF: fingerprint helper exposed';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B06_PROOF: authenticated service writer execute leaked';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B06_PROOF: service writer execute missing';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.rpc_publish_need(uuid,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B06_PROOF: legacy publish reopened';
  end if;

  if position('PACKAGE_4_NOT_READY' in pg_get_functiondef('public.rpc_ai_publish_need(uuid,uuid)'::regprocedure)) = 0 then
    raise exception 'RU3_B06_PROOF: AI publish not fail closed';
  end if;
end
$structural$;

begin;

do $seed_need$
declare
  v_owner uuid := extensions.gen_random_uuid();
  v_profile uuid;
  v_need uuid;
begin
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    v_owner,
    'authenticated',
    'authenticated',
    'ru3-b06-proof-'||v_owner::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','RU3 B06 Proof Owner','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),
    statement_timestamp()
  );

  select id into v_profile
    from public.app_profiles
   where account_id=v_owner
     and kind='REQUESTER'
     and profile_status='ACTIVE';
  if v_profile is null then
    raise exception 'RU3_B06_PROOF: requester profile missing';
  end if;

  insert into public.needs(
    requester_account_id,
    requester_profile_id,
    status,
    title,
    description,
    category,
    approximate_city,
    approximate_area,
    schedule_kind,
    required_slots,
    mode,
    required_skills,
    required_tools,
    required_vehicles,
    required_licenses,
    minimum_experience_years,
    verified_identity_required,
    execution_location_mode,
    public_photo_paths
  ) values (
    v_owner,
    v_profile,
    'DRAFT',
    'RU3 B06 dokazni zadatak',
    'Dokazni sadržaj za proveru nepromenljive odluke i fingerprinta.',
    'PROOF_ONLY',
    'Novi Sad',
    'Centar',
    'FLEXIBLE',
    1,
    'OFFERS',
    array['proof-skill'],
    '{}'::text[],
    '{}'::text[],
    '{}'::text[],
    null,
    false,
    'STATIONARY',
    '{}'::text[]
  ) returning id into v_need;

  insert into public.need_geography(need_id,public_topology)
  values (
    v_need,
    jsonb_build_object(
      'mode','STATIONARY',
      'start',jsonb_build_object('label','Centar, Novi Sad','city','Novi Sad','area','Centar')
    )
  );

  insert into public.need_requirement_details(need_id,critical_conditions)
  values(v_need,array['PROOF_CONDITION']);

  insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng)
  values(v_need,'RU3 B06 Proof Exact Address','PROOF ACCESS',45.255,19.845);

  perform set_config('uskoci.ru3_b06_owner',v_owner::text,true);
  perform set_config('uskoci.ru3_b06_need',v_need::text,true);
end
$seed_need$;

set local role service_role;

do $no_bundle_fail_closed$
declare
  v_denied boolean := false;
  v_need uuid := current_setting('uskoci.ru3_b06_need')::uuid;
begin
  begin
    perform public.rpc_record_need_publication_decision_service(
      v_need,1,'__RU3_B06_PROOF_POLICY__','__RU3_B06_PROOF_JURISDICTION__',
      'REVIEW',array['__RU3_B06_PROOF_RULE__'],'STRUCTURAL_PROOF',
      array['PROOF_ONLY'],null,null,'{}'::jsonb,jsonb_build_object('proof',true)
    );
  exception when others then
    if sqlerrm = 'POLICY_BUNDLE_NOT_READY' then
      v_denied := true;
    else
      raise;
    end if;
  end;
  if not v_denied then
    raise exception 'RU3_B06_PROOF: missing bundle did not fail closed';
  end if;
end
$no_bundle_fail_closed$;

reset role;

do $seed_policy$
declare
  v_bundle uuid;
begin
  insert into private.publication_policy_bundles(
    policy_id,version,jurisdiction,
    is_reviewed,is_complete,is_active,
    review_provenance,reviewed_at,activated_at,effective_from
  ) values (
    '__RU3_B06_PROOF_POLICY__',1,'__RU3_B06_PROOF_JURISDICTION__',
    true,true,true,
    jsonb_build_object('proof',true),
    statement_timestamp(),statement_timestamp(),statement_timestamp()-interval '1 minute'
  ) returning id into v_bundle;

  insert into private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance)
  values(v_bundle,'__RU3_B06_PROOF_RULE__',jsonb_build_object('proof',true));

  perform set_config('uskoci.ru3_b06_bundle',v_bundle::text,true);
end
$seed_policy$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b06_owner'),true);
select set_config('request.jwt.claims','',true);

do $authenticated_denied$
declare
  v_denied boolean := false;
  v_need uuid := current_setting('uskoci.ru3_b06_need')::uuid;
begin
  begin
    perform public.rpc_record_need_publication_decision_service(
      v_need,1,'__RU3_B06_PROOF_POLICY__','__RU3_B06_PROOF_JURISDICTION__',
      'REVIEW',array['__RU3_B06_PROOF_RULE__'],'STRUCTURAL_PROOF',
      array['PROOF_ONLY'],null,null,'{}'::jsonb,jsonb_build_object('proof',true)
    );
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'RU3_B06_PROOF: authenticated caller reached service writer';
  end if;
end
$authenticated_denied$;

reset role;
set local role service_role;

do $service_runtime$
declare
  v_need uuid := current_setting('uskoci.ru3_b06_need')::uuid;
  v_first jsonb;
  v_replay jsonb;
  v_denied boolean;
begin
  v_first := public.rpc_record_need_publication_decision_service(
    v_need,1,'__RU3_B06_PROOF_POLICY__','__RU3_B06_PROOF_JURISDICTION__',
    'REVIEW',array['__RU3_B06_PROOF_RULE__'],'STRUCTURAL_PROOF',
    array['PROOF_ONLY'],null,null,'{}'::jsonb,jsonb_build_object('proof',true,'run','b06')
  );

  if v_first->>'outcome' <> 'REVIEW'
     or (v_first->>'publishable')::boolean
     or not (v_first->>'authoritative')::boolean then
    raise exception 'RU3_B06_PROOF: service REVIEW result invalid';
  end if;

  v_replay := public.rpc_record_need_publication_decision_service(
    v_need,1,'__RU3_B06_PROOF_POLICY__','__RU3_B06_PROOF_JURISDICTION__',
    'REVIEW',array['__RU3_B06_PROOF_RULE__'],'STRUCTURAL_PROOF',
    array['PROOF_ONLY'],null,null,'{}'::jsonb,jsonb_build_object('proof',true,'run','b06')
  );

  if v_replay->>'decisionId' is distinct from v_first->>'decisionId'
     or v_replay->>'decisionSequence' is distinct from v_first->>'decisionSequence' then
    raise exception 'RU3_B06_PROOF: exact replay was not idempotent';
  end if;

  perform set_config('uskoci.ru3_b06_decision',v_first->>'decisionId',true);
  perform set_config('uskoci.ru3_b06_fingerprint',v_first->>'canonicalFingerprint',true);

  v_denied := false;
  begin
    perform public.rpc_record_need_publication_decision_service(
      v_need,1,'__RU3_B06_PROOF_POLICY__','__RU3_B06_PROOF_JURISDICTION__',
      'ALLOW',array['__RU3_B06_PROOF_RULE__'],'STRUCTURAL_PROOF',
      '{}'::text[],null,null,'{}'::jsonb,jsonb_build_object('proof',true)
    );
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'RU3_B06_PROOF: ALLOW became writable before policy evaluator authority';
  end if;

  v_denied := false;
  begin
    perform public.rpc_record_need_publication_decision_service(
      v_need,2,'__RU3_B06_PROOF_POLICY__','__RU3_B06_PROOF_JURISDICTION__',
      'REVIEW',array['__RU3_B06_PROOF_RULE__'],'STRUCTURAL_PROOF',
      '{}'::text[],null,null,'{}'::jsonb,jsonb_build_object('proof',true)
    );
  exception when serialization_failure then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'RU3_B06_PROOF: stale revision accepted';
  end if;
end
$service_runtime$;

reset role;

do $immutable_and_fingerprint$
declare
  v_need uuid := current_setting('uskoci.ru3_b06_need')::uuid;
  v_decision uuid := current_setting('uskoci.ru3_b06_decision')::uuid;
  v_original text := current_setting('uskoci.ru3_b06_fingerprint');
  v_snapshot jsonb;
  v_changed text;
  v_restored text;
  v_denied boolean;
begin
  if (select count(*) from private.need_publication_decisions where need_id=v_need) <> 1 then
    raise exception 'RU3_B06_PROOF: exact replay created duplicate decision';
  end if;

  select private.need_publication_fingerprint_snapshot(v_need) into v_snapshot;
  if position('RU3 B06 Proof Exact Address' in v_snapshot::text) > 0
     or position('PROOF ACCESS' in v_snapshot::text) > 0 then
    raise exception 'RU3_B06_PROOF: fingerprint snapshot exposed raw private location/access';
  end if;
  if v_snapshot->>'canonicalFingerprint' is distinct from v_original then
    raise exception 'RU3_B06_PROOF: stored fingerprint not exact current fingerprint';
  end if;

  v_denied := false;
  begin
    update private.need_publication_decisions set outcome='BLOCK' where id=v_decision;
  exception when sqlstate '55000' then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'RU3_B06_PROOF: immutable decision UPDATE succeeded';
  end if;

  v_denied := false;
  begin
    delete from private.need_publication_decisions where id=v_decision;
  exception when sqlstate '55000' then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'RU3_B06_PROOF: immutable decision DELETE succeeded';
  end if;

  update public.need_sensitive
     set exact_address='RU3 B06 Proof Changed Exact Address'
   where need_id=v_need;
  select private.need_publication_fingerprint_snapshot(v_need)->>'canonicalFingerprint'
    into v_changed;
  if v_changed = v_original then
    raise exception 'RU3_B06_PROOF: private material change did not change fingerprint';
  end if;
  if position('Changed Exact Address' in private.need_publication_fingerprint_snapshot(v_need)::text) > 0 then
    raise exception 'RU3_B06_PROOF: changed private value exposed';
  end if;

  update public.need_sensitive
     set exact_address='RU3 B06 Proof Exact Address'
   where need_id=v_need;
  select private.need_publication_fingerprint_snapshot(v_need)->>'canonicalFingerprint'
    into v_restored;
  if v_restored <> v_original then
    raise exception 'RU3_B06_PROOF: private marker depends on timestamp instead of exact private content';
  end if;

  update public.needs
     set title='RU3 B06 dokazni zadatak IZMENJEN'
   where id=v_need;
  select private.need_publication_fingerprint_snapshot(v_need)->>'canonicalFingerprint'
    into v_changed;
  if v_changed = v_original then
    raise exception 'RU3_B06_PROOF: public content tamper did not change fingerprint';
  end if;

  if (select revision from public.needs where id=v_need) <> 1 then
    raise exception 'RU3_B06_PROOF: proof expected DRAFT edit to keep revision 1';
  end if;

  update public.needs
     set public_photo_paths=array['proof/unreviewed.jpg']
   where id=v_need;
end
$immutable_and_fingerprint$;

set local role service_role;

do $media_fail_closed$
declare
  v_need uuid := current_setting('uskoci.ru3_b06_need')::uuid;
  v_denied boolean := false;
begin
  begin
    perform public.rpc_record_need_publication_decision_service(
      v_need,1,'__RU3_B06_PROOF_POLICY__','__RU3_B06_PROOF_JURISDICTION__',
      'REVIEW',array['__RU3_B06_PROOF_RULE__'],'STRUCTURAL_PROOF',
      '{}'::text[],null,null,'{}'::jsonb,jsonb_build_object('proof',true,'media','unreviewed')
    );
  exception when others then
    if sqlerrm = 'PUBLIC_MEDIA_REVIEW_AUTHORITY_NOT_READY' then
      v_denied := true;
    else
      raise;
    end if;
  end;
  if not v_denied then
    raise exception 'RU3_B06_PROOF: unreviewed public media was admitted into a decision';
  end if;
end
$media_fail_closed$;

reset role;

do $no_publish_side_effect$
declare
  v_need uuid := current_setting('uskoci.ru3_b06_need')::uuid;
begin
  if (select status from public.needs where id=v_need) <> 'DRAFT' then
    raise exception 'RU3_B06_PROOF: B06 changed Need publication state';
  end if;
  if (select published_at from public.needs where id=v_need) is not null then
    raise exception 'RU3_B06_PROOF: B06 stamped published_at';
  end if;
end
$no_publish_side_effect$;

rollback;

do $zero_residue$
begin
  if exists (select 1 from private.need_publication_decisions) then
    raise exception 'RU3_B06_PROOF: decision residue';
  end if;
  if exists (
    select 1 from private.publication_policy_bundles
     where policy_id='__RU3_B06_PROOF_POLICY__'
  ) then
    raise exception 'RU3_B06_PROOF: policy fixture residue';
  end if;
  if exists (
    select 1 from auth.users
     where email like 'ru3-b06-proof-%@proof.invalid'
  ) then
    raise exception 'RU3_B06_PROOF: auth fixture residue';
  end if;
end
$zero_residue$;

select 'PASS RU3_B06 service_only immutable exact_fingerprint private_marker_no_leak no_bundle_fail_closed no_allow unreviewed_media_fail_closed idempotent zero_residue no_publish_side_effect'
  as result;
