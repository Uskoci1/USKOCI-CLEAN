-- USKOČI RU-3 / B07 true-concurrency disposable fixture setup.
-- Synthetic policy/ALLOW rows are proof-only and are removed by the paired cleanup.
\set ON_ERROR_STOP on

begin;

do $setup$
declare
  v_owner constant uuid := '00000000-0000-4000-8000-00000000b071';
  v_need_a constant uuid := '00000000-0000-4000-8000-00000000b0a1';
  v_need_b constant uuid := '00000000-0000-4000-8000-00000000b0b1';
  v_need_c constant uuid := '00000000-0000-4000-8000-00000000b0c1';
  v_bundle constant uuid := '00000000-0000-4000-8000-00000000b0f1';
  v_profile uuid;
  v_need uuid;
  v_title text;
  v_fp jsonb;
  v_seq bigint;
begin
  if exists(select 1 from auth.users where id=v_owner)
     or exists(select 1 from public.needs where id in (v_need_a,v_need_b,v_need_c))
     or exists(select 1 from private.publication_policy_bundles where id=v_bundle) then
    raise exception 'RU3_B07_CONCURRENCY_SETUP: fixed proof IDs already exist';
  end if;

  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    v_owner,
    'authenticated',
    'authenticated',
    'ru3-b07-concurrency-owner@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','RU3 B07 Concurrency Owner','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  );

  select id into v_profile
    from public.app_profiles
   where account_id=v_owner
     and kind='REQUESTER'
     and profile_status='ACTIVE';
  if v_profile is null then
    raise exception 'RU3_B07_CONCURRENCY_SETUP: requester profile missing';
  end if;

  foreach v_need in array array[v_need_a,v_need_b,v_need_c]::uuid[]
  loop
    v_title := case v_need
      when v_need_a then 'RU3 B07 concurrency same-key-same-payload'
      when v_need_b then 'RU3 B07 concurrency same-key-different-payload'
      else 'RU3 B07 concurrency different-key-same-need'
    end;

    insert into public.needs(
      id,
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
      v_need,
      v_owner,
      v_profile,
      'DRAFT',
      v_title,
      'Disposable proof fixture for true concurrent canonical publish sessions.',
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
    );

    insert into public.need_geography(need_id,public_topology)
    values (
      v_need,
      jsonb_build_object(
        'mode','STATIONARY',
        'start',jsonb_build_object('label','Centar, Novi Sad','city','Novi Sad','area','Centar')
      )
    );

    insert into public.need_requirement_details(need_id,critical_conditions)
    values(v_need,array['PROOF_CONCURRENCY_CONDITION']);

    insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng)
    values(v_need,'RU3 B07 Concurrency Proof Address','PROOF ACCESS',45.255,19.845);
  end loop;

  insert into private.publication_policy_bundles(
    id,policy_id,version,jurisdiction,
    is_reviewed,is_complete,is_active,
    review_provenance,reviewed_at,activated_at,effective_from
  ) values (
    v_bundle,
    '__RU3_B07_CONCURRENCY_POLICY__',1,'__RU3_B07_CONCURRENCY_JURISDICTION__',
    true,true,true,
    jsonb_build_object('proof',true,'synthetic',true,'purpose','B07_TRUE_CONCURRENCY'),
    statement_timestamp(),statement_timestamp(),statement_timestamp()-interval '1 minute'
  );

  insert into private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance)
  values(
    v_bundle,
    '__RU3_B07_CONCURRENCY_RULE__',
    jsonb_build_object('proof',true,'synthetic',true,'version',1)
  );

  foreach v_need in array array[v_need_a,v_need_b,v_need_c]::uuid[]
  loop
    v_fp := private.need_publication_fingerprint_snapshot(v_need);

    insert into private.need_publication_decisions(
      need_id,
      need_revision,
      fingerprint_schema_version,
      canonical_fingerprint,
      private_materiality_marker,
      public_geography_snapshot,
      public_media_refs,
      policy_bundle_id,
      policy_id,
      policy_version,
      jurisdiction,
      rule_ids,
      rule_provenance_snapshot,
      outcome,
      safe_reason_codes,
      decision_source,
      reviewer_provenance,
      service_provenance,
      decision_identity
    ) values (
      v_need,
      (v_fp->>'needRevision')::integer,
      'NEED_PUBLICATION_FINGERPRINT_V1',
      v_fp->>'canonicalFingerprint',
      v_fp->>'privateMaterialityMarker',
      v_fp->'publicGeography',
      array(select jsonb_array_elements_text(v_fp->'publicMediaRefs')),
      v_bundle,
      '__RU3_B07_CONCURRENCY_POLICY__',
      1,
      '__RU3_B07_CONCURRENCY_JURISDICTION__',
      array['__RU3_B07_CONCURRENCY_RULE__'],
      jsonb_build_array(
        jsonb_build_object(
          'ruleId','__RU3_B07_CONCURRENCY_RULE__',
          'provenance',jsonb_build_object('proof',true,'synthetic',true,'version',1)
        )
      ),
      'ALLOW',
      array['PROOF_ONLY'],
      'B07_SYNTHETIC_DISPOSABLE_PROOF',
      jsonb_build_object('proof',true,'authority','SYNTHETIC_ONLY','purpose','TRUE_CONCURRENCY'),
      jsonb_build_object('proof',true,'unit','B07','purpose','TRUE_CONCURRENCY'),
      encode(
        extensions.digest(
          convert_to('B07_TRUE_CONCURRENCY|'||v_need::text,'UTF8'),
          'sha256'
        ),
        'hex'
      )
    ) returning decision_sequence into v_seq;

    if v_seq is null then
      raise exception 'RU3_B07_CONCURRENCY_SETUP: decision sequence missing for %',v_need;
    end if;
  end loop;
end
$setup$;

commit;

select 'PASS RU3_B07_CONCURRENCY_SETUP' as result;
