-- USKOČI RU-3 / B07 disposable authenticated runtime proof.
-- Assumes canonical B05 + B06 plus exact B07 candidate are applied to a
-- disposable database. Synthetic policy/ALLOW fixtures exist only inside this
-- rollback-only proof; they are NOT production D-0140 authority.
\set ON_ERROR_STOP on

do $structural$
begin
  if to_regclass('private.need_publish_commands') is null then
    raise exception 'RU3_B07_PROOF: command receipt table missing';
  end if;
  if exists (select 1 from private.need_publish_commands) then
    raise exception 'RU3_B07_PROOF: candidate seeded command receipts';
  end if;

  if has_table_privilege('authenticated','private.need_publish_commands','SELECT')
     or has_table_privilege('authenticated','private.need_publish_commands','INSERT')
     or has_table_privilege('authenticated','private.need_publish_commands','UPDATE')
     or has_table_privilege('authenticated','private.need_publish_commands','DELETE')
     or has_table_privilege('service_role','private.need_publish_commands','SELECT')
     or has_table_privilege('service_role','private.need_publish_commands','INSERT') then
    raise exception 'RU3_B07_PROOF: receipt table authority leaked';
  end if;

  if has_function_privilege(
       'anon',
       'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B07_PROOF: anon canonical publish execute leaked';
  end if;
  if not has_function_privilege(
       'authenticated',
       'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B07_PROOF: authenticated canonical publish execute missing';
  end if;
  if has_function_privilege(
       'service_role',
       'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B07_PROOF: service role reached user publish command';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.rpc_publish_need(uuid,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B07_PROOF: legacy publish reopened';
  end if;
  if position('PACKAGE_4_NOT_READY' in pg_get_functiondef('public.rpc_ai_publish_need(uuid,uuid)'::regprocedure)) = 0 then
    raise exception 'RU3_B07_PROOF: AI publish not fail closed';
  end if;
  if position(
       'RU3_ALLOW_NOT_ENABLED'
       in pg_get_functiondef(
         'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)'::regprocedure
       )
     ) = 0 then
    raise exception 'RU3_B07_PROOF: B06 service writer ALLOW gate changed';
  end if;
end
$structural$;

begin;

do $seed_actors_need$
declare
  v_owner uuid := extensions.gen_random_uuid();
  v_attacker uuid := extensions.gen_random_uuid();
  v_profile uuid;
  v_need uuid;
begin
  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values
  (
    v_owner,
    'authenticated',
    'authenticated',
    'ru3-b07-owner-'||v_owner::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','RU3 B07 Owner','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  ),
  (
    v_attacker,
    'authenticated',
    'authenticated',
    'ru3-b07-attacker-'||v_attacker::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','RU3 B07 Attacker','city','Novi Sad','skills',jsonb_build_array('proof-skill')),
    statement_timestamp(),statement_timestamp()
  );

  select id into v_profile
    from public.app_profiles
   where account_id=v_owner
     and kind='REQUESTER'
     and profile_status='ACTIVE';
  if v_profile is null then
    raise exception 'RU3_B07_PROOF: owner requester profile missing';
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
    'RU3 B07 dokazni zadatak',
    'Dokazni sadržaj za canonical admitted publish transaction.',
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
  values(v_need,'RU3 B07 Proof Exact Address','PROOF ACCESS',45.255,19.845);

  perform set_config('uskoci.ru3_b07_owner',v_owner::text,true);
  perform set_config('uskoci.ru3_b07_attacker',v_attacker::text,true);
  perform set_config('uskoci.ru3_b07_need',v_need::text,true);
  perform set_config(
    'uskoci.ru3_b07_deadline',
    (statement_timestamp()+interval '2 days')::text,
    true
  );
end
$seed_actors_need$;

-- Test-only helper: creates immutable synthetic decisions directly as postgres.
-- Production B06 service writer still rejects ALLOW and is never changed here.
create or replace function pg_temp.ru3_b07_insert_decision(
  p_need uuid,
  p_bundle uuid,
  p_outcome text
)
returns bigint
language plpgsql
as $$
declare
  v_fp jsonb;
  v_policy_id text;
  v_policy_version integer;
  v_jurisdiction text;
  v_rule_id text;
  v_rule_provenance jsonb;
  v_sequence bigint;
begin
  select b.policy_id,b.version,b.jurisdiction
    into v_policy_id,v_policy_version,v_jurisdiction
    from private.publication_policy_bundles b
   where b.id=p_bundle;
  if not found then raise exception 'PROOF_BUNDLE_NOT_FOUND'; end if;

  select r.rule_id,r.rule_provenance
    into v_rule_id,v_rule_provenance
    from private.publication_policy_rule_refs r
   where r.bundle_id=p_bundle
   order by r.rule_id
   limit 1;
  if not found then raise exception 'PROOF_RULE_NOT_FOUND'; end if;

  v_fp := private.need_publication_fingerprint_snapshot(p_need);

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
    provider_ref,
    model_ref,
    reviewer_provenance,
    service_provenance,
    decision_identity
  ) values (
    p_need,
    (v_fp->>'needRevision')::integer,
    'NEED_PUBLICATION_FINGERPRINT_V1',
    v_fp->>'canonicalFingerprint',
    v_fp->>'privateMaterialityMarker',
    v_fp->'publicGeography',
    array(select jsonb_array_elements_text(v_fp->'publicMediaRefs')),
    p_bundle,
    v_policy_id,
    v_policy_version,
    v_jurisdiction,
    array[v_rule_id],
    jsonb_build_array(jsonb_build_object('ruleId',v_rule_id,'provenance',v_rule_provenance)),
    p_outcome,
    array['PROOF_ONLY'],
    'B07_SYNTHETIC_DISPOSABLE_PROOF',
    null,
    null,
    jsonb_build_object('proof',true,'authority','SYNTHETIC_ONLY'),
    jsonb_build_object('proof',true,'unit','B07'),
    encode(
      extensions.digest(
        convert_to(
          extensions.gen_random_uuid()::text || '|' || p_outcome || '|' || p_need::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  ) returning decision_sequence into v_sequence;

  return v_sequence;
end;
$$;

do $seed_policy$
declare
  v_bundle uuid;
begin
  insert into private.publication_policy_bundles(
    policy_id,version,jurisdiction,
    is_reviewed,is_complete,is_active,
    review_provenance,reviewed_at,activated_at,effective_from
  ) values (
    '__RU3_B07_PROOF_POLICY__',1,'__RU3_B07_PROOF_JURISDICTION__',
    true,true,true,
    jsonb_build_object('proof',true,'synthetic',true),
    statement_timestamp(),statement_timestamp(),statement_timestamp()-interval '1 minute'
  ) returning id into v_bundle;

  insert into private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance)
  values(
    v_bundle,
    '__RU3_B07_PROOF_RULE__',
    jsonb_build_object('proof',true,'synthetic',true,'version',1)
  );

  perform set_config('uskoci.ru3_b07_bundle',v_bundle::text,true);
end
$seed_policy$;

-- No decision -> fail closed, no side effects.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b07_owner'),true);
select set_config('request.jwt.claims','',true);

do $no_decision$
declare
  v_denied boolean := false;
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
begin
  begin
    perform public.rpc_publish_need_canonical(
      v_need,1,999999,current_setting('uskoci.ru3_b07_deadline')::timestamptz,
      'ru3-b07-nodecision-0001'
    );
  exception when others then
    if sqlerrm='PUBLICATION_DECISION_NOT_FOUND' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_B07_PROOF: no-decision publish succeeded'; end if;
end
$no_decision$;

reset role;

do $no_side_effects_1$
declare v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
begin
  if (select status from public.needs where id=v_need) <> 'DRAFT'
     or exists(select 1 from private.dispatch_schedule where need_id=v_need)
     or exists(select 1 from private.need_publish_commands where need_id=v_need) then
    raise exception 'RU3_B07_PROOF: no-decision failure left partial side effects';
  end if;
end
$no_side_effects_1$;

-- Wrong account is denied before decision authority matters.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b07_attacker'),true);

do $wrong_owner$
declare
  v_denied boolean := false;
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
begin
  begin
    perform public.rpc_publish_need_canonical(
      v_need,1,999999,current_setting('uskoci.ru3_b07_deadline')::timestamptz,
      'ru3-b07-attacker-0001'
    );
  exception when insufficient_privilege then
    if sqlerrm='NEED_NOT_OWNED' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_B07_PROOF: non-owner publish succeeded'; end if;
end
$wrong_owner$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b07_owner'),true);

do $stale_revision$
declare
  v_denied boolean := false;
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
begin
  begin
    perform public.rpc_publish_need_canonical(
      v_need,2,999999,current_setting('uskoci.ru3_b07_deadline')::timestamptz,
      'ru3-b07-stalerev-0001'
    );
  exception when serialization_failure then
    if sqlerrm='NEED_REVISION_STALE' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_B07_PROOF: stale revision publish succeeded'; end if;
end
$stale_revision$;

reset role;

-- REVIEW / CLARIFY / BLOCK are all non-publishable.
do $outcome_failures$
declare
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
  v_bundle uuid := current_setting('uskoci.ru3_b07_bundle')::uuid;
  v_seq bigint;
  v_outcome text;
  v_denied boolean;
begin
  foreach v_outcome in array array['REVIEW','CLARIFY','BLOCK']::text[]
  loop
    v_seq := pg_temp.ru3_b07_insert_decision(v_need,v_bundle,v_outcome);
    perform set_config('uskoci.ru3_b07_seq',v_seq::text,true);

    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b07_owner'),true);
    v_denied := false;
    begin
      perform public.rpc_publish_need_canonical(
        v_need,1,v_seq,current_setting('uskoci.ru3_b07_deadline')::timestamptz,
        'ru3-b07-outcome-'||lower(v_outcome)||'-0001'
      );
    exception when others then
      if sqlerrm='PUBLICATION_DECISION_NOT_ALLOW' then v_denied:=true; else raise; end if;
    end;
    perform set_config('role','none',true);

    if not v_denied then
      raise exception 'RU3_B07_PROOF: % decision became publishable',v_outcome;
    end if;
    if (select status from public.needs where id=v_need) <> 'DRAFT'
       or exists(select 1 from private.dispatch_schedule where need_id=v_need)
       or exists(select 1 from private.need_publish_commands where need_id=v_need) then
      raise exception 'RU3_B07_PROOF: % failure left side effects',v_outcome;
    end if;
  end loop;
end
$outcome_failures$;

-- Synthetic exact ALLOW for test only.
do $seed_allow$
declare
  v_seq bigint;
begin
  v_seq := pg_temp.ru3_b07_insert_decision(
    current_setting('uskoci.ru3_b07_need')::uuid,
    current_setting('uskoci.ru3_b07_bundle')::uuid,
    'ALLOW'
  );
  perform set_config('uskoci.ru3_b07_allow_seq',v_seq::text,true);
end
$seed_allow$;

-- Material DRAFT tamper does not bump revision today, so fingerprint must stop publish.
do $tamper_then_restore$
declare
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
begin
  update public.needs set title='RU3 B07 dokazni zadatak IZMENJEN' where id=v_need;
  if (select revision from public.needs where id=v_need) <> 1 then
    raise exception 'RU3_B07_PROOF: expected DRAFT edit to preserve revision';
  end if;
end
$tamper_then_restore$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b07_owner'),true);

do $fingerprint_stale$
declare
  v_denied boolean := false;
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
  v_seq bigint := current_setting('uskoci.ru3_b07_allow_seq')::bigint;
begin
  begin
    perform public.rpc_publish_need_canonical(
      v_need,1,v_seq,current_setting('uskoci.ru3_b07_deadline')::timestamptz,
      'ru3-b07-fingerprint-0001'
    );
  exception when others then
    if sqlerrm='PUBLICATION_DECISION_FINGERPRINT_STALE' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_B07_PROOF: changed fingerprint published'; end if;
end
$fingerprint_stale$;

reset role;
update public.needs
   set title='RU3 B07 dokazni zadatak'
 where id=current_setting('uskoci.ru3_b07_need')::uuid;

-- A later decision for the same Need/revision makes an older ALLOW stale.
do $newer_review_then_allow$
declare
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
  v_bundle uuid := current_setting('uskoci.ru3_b07_bundle')::uuid;
  v_newer bigint;
  v_final_allow bigint;
begin
  v_newer := pg_temp.ru3_b07_insert_decision(v_need,v_bundle,'REVIEW');
  perform set_config('uskoci.ru3_b07_newer_review',v_newer::text,true);

  -- Keep old ALLOW sequence for stale-decision test, then create a new final ALLOW.
  v_final_allow := pg_temp.ru3_b07_insert_decision(v_need,v_bundle,'ALLOW');
  perform set_config('uskoci.ru3_b07_final_allow',v_final_allow::text,true);
end
$newer_review_then_allow$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b07_owner'),true);

do $older_allow_stale$
declare
  v_denied boolean := false;
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
  v_old bigint := current_setting('uskoci.ru3_b07_allow_seq')::bigint;
begin
  begin
    perform public.rpc_publish_need_canonical(
      v_need,1,v_old,current_setting('uskoci.ru3_b07_deadline')::timestamptz,
      'ru3-b07-olddecision-0001'
    );
  exception when others then
    if sqlerrm='PUBLICATION_DECISION_STALE' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_B07_PROOF: older decision remained current'; end if;
end
$older_allow_stale$;

reset role;

-- Policy/rule provenance must remain exact after the decision.
do $rule_provenance_tamper$
begin
  update private.publication_policy_rule_refs
     set rule_provenance=jsonb_build_object('proof',true,'synthetic',true,'version',999)
   where bundle_id=current_setting('uskoci.ru3_b07_bundle')::uuid
     and rule_id='__RU3_B07_PROOF_RULE__';
end
$rule_provenance_tamper$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b07_owner'),true);

do $rule_provenance_stale$
declare
  v_denied boolean := false;
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
  v_seq bigint := current_setting('uskoci.ru3_b07_final_allow')::bigint;
begin
  begin
    perform public.rpc_publish_need_canonical(
      v_need,1,v_seq,current_setting('uskoci.ru3_b07_deadline')::timestamptz,
      'ru3-b07-ruleprov-0001'
    );
  exception when others then
    if sqlerrm='PUBLICATION_POLICY_RULE_PROVENANCE_STALE' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_B07_PROOF: changed rule provenance published'; end if;
end
$rule_provenance_stale$;

reset role;
update private.publication_policy_rule_refs
   set rule_provenance=jsonb_build_object('proof',true,'synthetic',true,'version',1)
 where bundle_id=current_setting('uskoci.ru3_b07_bundle')::uuid
   and rule_id='__RU3_B07_PROOF_RULE__';

-- Current bundle requirement: make v1 inactive and a v2 bundle current.
do $policy_stale_fixture$
declare
  v_v2 uuid;
begin
  update private.publication_policy_bundles
     set is_active=false, activated_at=null
   where id=current_setting('uskoci.ru3_b07_bundle')::uuid;

  insert into private.publication_policy_bundles(
    policy_id,version,jurisdiction,is_reviewed,is_complete,is_active,
    review_provenance,reviewed_at,activated_at,effective_from
  ) values (
    '__RU3_B07_PROOF_POLICY__',2,'__RU3_B07_PROOF_JURISDICTION__',
    true,true,true,jsonb_build_object('proof',true,'synthetic',true,'version',2),
    statement_timestamp(),statement_timestamp(),statement_timestamp()-interval '1 minute'
  ) returning id into v_v2;

  insert into private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance)
  values(v_v2,'__RU3_B07_PROOF_RULE__',jsonb_build_object('proof',true,'synthetic',true,'version',2));
  perform set_config('uskoci.ru3_b07_bundle_v2',v_v2::text,true);
end
$policy_stale_fixture$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b07_owner'),true);

do $policy_stale$
declare
  v_denied boolean := false;
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
  v_seq bigint := current_setting('uskoci.ru3_b07_final_allow')::bigint;
begin
  begin
    perform public.rpc_publish_need_canonical(
      v_need,1,v_seq,current_setting('uskoci.ru3_b07_deadline')::timestamptz,
      'ru3-b07-policystale-0001'
    );
  exception when others then
    if sqlerrm in ('POLICY_BUNDLE_NOT_READY','PUBLICATION_POLICY_STALE') then
      v_denied:=true;
    else
      raise;
    end if;
  end;
  if not v_denied then raise exception 'RU3_B07_PROOF: stale/inactive policy published'; end if;
end
$policy_stale$;

reset role;
delete from private.publication_policy_rule_refs
 where bundle_id=current_setting('uskoci.ru3_b07_bundle_v2')::uuid;
delete from private.publication_policy_bundles
 where id=current_setting('uskoci.ru3_b07_bundle_v2')::uuid;
update private.publication_policy_bundles
   set is_active=true, activated_at=statement_timestamp()
 where id=current_setting('uskoci.ru3_b07_bundle')::uuid;

-- Exact current synthetic ALLOW: one transition + one dispatch + one receipt.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru3_b07_owner'),true);

do $success_and_replay$
declare
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
  v_seq bigint := current_setting('uskoci.ru3_b07_final_allow')::bigint;
  v_deadline timestamptz := current_setting('uskoci.ru3_b07_deadline')::timestamptz;
  v_first jsonb;
  v_replay jsonb;
  v_denied boolean;
begin
  v_first := public.rpc_publish_need_canonical(
    v_need,1,v_seq,v_deadline,'ru3-b07-publish-0001'
  );
  if v_first->>'status' <> 'PUBLISHED'
     or (v_first->>'idempotentReplay')::boolean then
    raise exception 'RU3_B07_PROOF: successful publish result invalid';
  end if;
  if (select status from public.needs where id=v_need) <> 'PUBLISHED' then
    raise exception 'RU3_B07_PROOF: authenticated caller did not observe PUBLISHED Need';
  end if;

  v_replay := public.rpc_publish_need_canonical(
    v_need,1,v_seq,v_deadline,'ru3-b07-publish-0001'
  );
  if not (v_replay->>'idempotentReplay')::boolean
     or (v_replay - 'idempotentReplay') is distinct from (v_first - 'idempotentReplay') then
    raise exception 'RU3_B07_PROOF: same-key same-payload replay changed result';
  end if;

  v_denied := false;
  begin
    perform public.rpc_publish_need_canonical(
      v_need,1,v_seq,v_deadline+interval '1 hour','ru3-b07-publish-0001'
    );
  exception when others then
    if sqlerrm='IDEMPOTENCY_KEY_REUSED' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_B07_PROOF: same key accepted different payload'; end if;

  v_denied := false;
  begin
    perform public.rpc_publish_need_canonical(
      v_need,1,v_seq,v_deadline,'ru3-b07-publish-0002'
    );
  exception when others then
    if sqlerrm='NEED_NOT_DRAFT' then v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'RU3_B07_PROOF: second key republished already-published Need'; end if;
end
$success_and_replay$;

reset role;

do $success_private_postconditions$
declare
  v_need uuid := current_setting('uskoci.ru3_b07_need')::uuid;
  v_seq bigint := current_setting('uskoci.ru3_b07_final_allow')::bigint;
begin
  if (select status from public.needs where id=v_need) <> 'PUBLISHED' then
    raise exception 'RU3_B07_PROOF: publish did not persist PUBLISHED state';
  end if;
  if (select count(*) from private.dispatch_schedule where need_id=v_need) <> 1 then
    raise exception 'RU3_B07_PROOF: publish/replay did not leave exactly one dispatch schedule';
  end if;
  if (select count(*) from private.need_publish_commands where need_id=v_need) <> 1 then
    raise exception 'RU3_B07_PROOF: publish/replay did not leave exactly one command receipt';
  end if;
  if not exists (
    select 1
      from private.need_publish_commands c
     where c.need_id=v_need
       and c.decision_sequence=v_seq
       and c.client_request_id='ru3-b07-publish-0001'
  ) then
    raise exception 'RU3_B07_PROOF: durable receipt not bound to exact final ALLOW decision';
  end if;
end
$success_private_postconditions$;

-- Proof fixtures, including synthetic policy/ALLOW, must leave no rows.
rollback;

do $zero_residue$
begin
  if exists(select 1 from auth.users where email like 'ru3-b07-%@proof.invalid') then
    raise exception 'RU3_B07_PROOF: auth fixture residue';
  end if;
  if exists(select 1 from public.needs where title like 'RU3 B07 dokazni zadatak%') then
    raise exception 'RU3_B07_PROOF: Need fixture residue';
  end if;
  if exists(select 1 from private.publication_policy_bundles) then
    raise exception 'RU3_B07_PROOF: synthetic policy bundle residue';
  end if;
  if exists(select 1 from private.publication_policy_rule_refs) then
    raise exception 'RU3_B07_PROOF: synthetic policy rule residue';
  end if;
  if exists(select 1 from private.need_publication_decisions) then
    raise exception 'RU3_B07_PROOF: synthetic decision residue';
  end if;
  if exists(select 1 from private.need_publish_commands) then
    raise exception 'RU3_B07_PROOF: publish receipt residue';
  end if;
end
$zero_residue$;

select 'PASS RU3_B07 auth_owner two_account exact_allow current_decision exact_fingerprint current_policy rule_provenance outcome_fail_closed idempotent dispatch_atomic zero_residue no_policy_activation' as result;
