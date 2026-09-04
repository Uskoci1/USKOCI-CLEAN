-- USKOČI RU-3 / B05 disposable runtime proof.
-- Assumes the exact B05 candidate has already been applied.
-- All fixture writes are rolled back.

\set ON_ERROR_STOP on

do $structural$
begin
  if to_regclass('private.publication_policy_bundles') is null then
    raise exception 'RU3_B05_PROOF: policy bundle table missing';
  end if;
  if to_regclass('private.publication_policy_rule_refs') is null then
    raise exception 'RU3_B05_PROOF: rule refs table missing';
  end if;

  if exists (select 1 from private.publication_policy_bundles)
     or exists (select 1 from private.publication_policy_rule_refs) then
    raise exception 'RU3_B05_PROOF: candidate seeded policy content';
  end if;

  if has_table_privilege('authenticated','private.publication_policy_bundles','SELECT')
     or has_table_privilege('authenticated','private.publication_policy_bundles','INSERT')
     or has_table_privilege('authenticated','private.publication_policy_bundles','UPDATE')
     or has_table_privilege('authenticated','private.publication_policy_bundles','DELETE')
     or has_table_privilege('service_role','private.publication_policy_bundles','SELECT')
     or has_table_privilege('service_role','private.publication_policy_bundles','INSERT') then
    raise exception 'RU3_B05_PROOF: policy bundle authority leaked';
  end if;

  if has_function_privilege(
       'authenticated',
       'private.publication_policy_bundle_ready(uuid,text,timestamp with time zone)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'private.publication_policy_bundle_ready(uuid,text,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B05_PROOF: internal readiness helper exposed';
  end if;

  if private.current_publication_policy_bundle(
       '__RU3_B05_UNCONFIGURED__',
       '__UNCONFIGURED__',
       statement_timestamp()
     ) is not null then
    raise exception 'RU3_B05_PROOF: no-bundle state did not fail closed';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.rpc_publish_need(uuid,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B05_PROOF: legacy publish authority reopened';
  end if;

  if position(
       'PACKAGE_4_NOT_READY'
       in pg_get_functiondef('public.rpc_ai_publish_need(uuid,uuid)'::regprocedure)
     ) = 0 then
    raise exception 'RU3_B05_PROOF: legacy AI publish is not fail closed';
  end if;
end
$structural$;

begin;

do $fixtures$
declare
  v_bundle uuid;
  v_ready boolean;
  v_denied boolean := false;
begin
  insert into private.publication_policy_bundles(
    policy_id,
    version,
    jurisdiction,
    review_provenance
  )
  values (
    '__RU3_B05_PROOF__',
    1,
    '__PROOF_JURISDICTION__',
    jsonb_build_object('proof', true)
  )
  returning id into v_bundle;

  select private.publication_policy_bundle_ready(
    v_bundle,
    '__PROOF_JURISDICTION__',
    statement_timestamp()
  ) into v_ready;
  if v_ready then
    raise exception 'RU3_B05_PROOF: unreviewed bundle became ready';
  end if;

  begin
    update private.publication_policy_bundles
       set is_active = true,
           activated_at = statement_timestamp()
     where id = v_bundle;
  exception when check_violation then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'RU3_B05_PROOF: unreviewed/incomplete activation was accepted';
  end if;

  update private.publication_policy_bundles
     set is_reviewed = true,
         is_complete = true,
         reviewed_at = statement_timestamp(),
         is_active = true,
         activated_at = statement_timestamp(),
         effective_from = statement_timestamp() - interval '1 minute'
   where id = v_bundle;

  select private.publication_policy_bundle_ready(
    v_bundle,
    '__PROOF_JURISDICTION__',
    statement_timestamp()
  ) into v_ready;
  if not v_ready then
    raise exception 'RU3_B05_PROOF: structurally reviewed complete active bundle was not ready';
  end if;

  select private.publication_policy_bundle_ready(
    v_bundle,
    '__WRONG_JURISDICTION__',
    statement_timestamp()
  ) into v_ready;
  if v_ready then
    raise exception 'RU3_B05_PROOF: wrong jurisdiction matched';
  end if;

  if private.current_publication_policy_bundle(
       '__RU3_B05_PROOF__',
       '__PROOF_JURISDICTION__',
       statement_timestamp()
     ) is distinct from v_bundle then
    raise exception 'RU3_B05_PROOF: exact current bundle selector mismatch';
  end if;

  insert into private.publication_policy_rule_refs(
    bundle_id,
    rule_id,
    rule_provenance
  )
  values (
    v_bundle,
    '__RU3_B05_PROOF_RULE_ID__',
    jsonb_build_object('proof', true)
  );

  v_denied := false;
  begin
    insert into private.publication_policy_bundles(
      policy_id,
      version,
      jurisdiction,
      is_reviewed,
      is_complete,
      is_active,
      review_provenance,
      reviewed_at,
      activated_at,
      effective_from
    )
    values (
      '__RU3_B05_PROOF__',
      2,
      '__PROOF_JURISDICTION__',
      true,
      true,
      true,
      jsonb_build_object('proof', true),
      statement_timestamp(),
      statement_timestamp(),
      statement_timestamp() - interval '1 minute'
    );
  exception when unique_violation then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'RU3_B05_PROOF: second active bundle for same policy/jurisdiction was accepted';
  end if;
end
$fixtures$;

rollback;

do $zero_residue$
begin
  if exists (
    select 1
      from private.publication_policy_bundles
     where policy_id = '__RU3_B05_PROOF__'
  ) then
    raise exception 'RU3_B05_PROOF: bundle fixture residue';
  end if;

  if exists (
    select 1
      from private.publication_policy_rule_refs
     where rule_id = '__RU3_B05_PROOF_RULE_ID__'
  ) then
    raise exception 'RU3_B05_PROOF: rule fixture residue';
  end if;
end
$zero_residue$;

select 'PASS RU3_B05 structural_fail_closed no_seed no_client_write activation_gate exact_current_selector zero_residue legacy_publish_still_closed'
  as result;
