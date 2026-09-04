-- USKOČI RU-3 / B06 — immutable Need publication decision + canonical fingerprint
-- STRUCTURAL / FAIL-CLOSED ONLY.
-- This unit does not publish a Need, does not seed D-0140 policy content, and
-- intentionally refuses ALLOW until a later reviewed policy/evaluator unit enables it.

create table if not exists private.need_publication_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_sequence bigint generated always as identity unique,

  need_id uuid not null references public.needs(id) on delete restrict,
  need_revision integer not null,
  fingerprint_schema_version text not null,
  canonical_fingerprint text not null,
  private_materiality_marker text not null,
  public_geography_snapshot jsonb not null,
  public_media_refs text[] not null default '{}'::text[],

  policy_bundle_id uuid not null
    references private.publication_policy_bundles(id) on delete restrict,
  policy_id text not null,
  policy_version integer not null,
  jurisdiction text not null,
  rule_ids text[] not null,
  rule_provenance_snapshot jsonb not null,

  outcome text not null,
  safe_reason_codes text[] not null default '{}'::text[],
  decision_source text not null,
  provider_ref text,
  model_ref text,
  reviewer_provenance jsonb not null default '{}'::jsonb,
  service_provenance jsonb not null,

  decision_identity text not null unique,
  created_at timestamptz not null default statement_timestamp(),

  constraint need_publication_decisions_revision_positive
    check (need_revision > 0),
  constraint need_publication_decisions_fingerprint_schema_v1
    check (fingerprint_schema_version = 'NEED_PUBLICATION_FINGERPRINT_V1'),
  constraint need_publication_decisions_fingerprint_hex
    check (canonical_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint need_publication_decisions_private_marker_hex
    check (private_materiality_marker ~ '^[0-9a-f]{64}$'),
  constraint need_publication_decisions_geography_object
    check (jsonb_typeof(public_geography_snapshot) = 'object'),
  constraint need_publication_decisions_policy_id_nonempty
    check (btrim(policy_id) <> ''),
  constraint need_publication_decisions_policy_version_positive
    check (policy_version > 0),
  constraint need_publication_decisions_jurisdiction_nonempty
    check (btrim(jurisdiction) <> ''),
  constraint need_publication_decisions_rules_required
    check (cardinality(rule_ids) > 0),
  constraint need_publication_decisions_rule_provenance_array
    check (jsonb_typeof(rule_provenance_snapshot) = 'array'),
  constraint need_publication_decisions_outcome
    check (outcome in ('ALLOW','CLARIFY','REVIEW','BLOCK')),
  constraint need_publication_decisions_source_nonempty
    check (btrim(decision_source) <> ''),
  constraint need_publication_decisions_reviewer_object
    check (jsonb_typeof(reviewer_provenance) = 'object'),
  constraint need_publication_decisions_service_object
    check (jsonb_typeof(service_provenance) = 'object'),
  constraint need_publication_decisions_identity_hex
    check (decision_identity ~ '^[0-9a-f]{64}$')
);

create index if not exists need_publication_decisions_exact_lookup
  on private.need_publication_decisions(
    need_id,
    need_revision,
    canonical_fingerprint,
    policy_bundle_id,
    decision_sequence desc
  );

alter table private.need_publication_decisions enable row level security;
revoke all on table private.need_publication_decisions
  from public, anon, authenticated, service_role;

create or replace function private.reject_need_publication_decision_mutation()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
begin
  raise exception 'PUBLICATION_DECISION_IMMUTABLE' using errcode='55000';
end;
$$;

revoke all on function private.reject_need_publication_decision_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists need_publication_decisions_immutable
  on private.need_publication_decisions;
create trigger need_publication_decisions_immutable
before update or delete on private.need_publication_decisions
for each row execute function private.reject_need_publication_decision_mutation();

create or replace function private.need_publication_fingerprint_snapshot(
  p_need_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_need public.needs%rowtype;
  v_topology jsonb;
  v_conditions text[] := '{}'::text[];
  v_public_geography jsonb;
  v_private_payload jsonb;
  v_private_marker text;
  v_payload jsonb;
  v_fingerprint text;
  v_media text[];
begin
  select * into v_need
    from public.needs
   where id = p_need_id;

  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;

  select g.public_topology
    into v_topology
    from public.need_geography g
   where g.need_id = p_need_id;

  select coalesce(r.critical_conditions, '{}'::text[])
    into v_conditions
    from public.need_requirement_details r
   where r.need_id = p_need_id;
  v_conditions := coalesce(v_conditions, '{}'::text[]);

  select case
           when s.need_id is null then jsonb_build_object('present', false)
           else jsonb_build_object(
             'present', true,
             'exactAddress', s.exact_address,
             'accessNotes', s.access_notes,
             'exactLat', s.exact_lat,
             'exactLng', s.exact_lng
           )
         end
    into v_private_payload
    from (select p_need_id as need_id) q
    left join public.need_sensitive s on s.need_id = q.need_id;

  v_private_marker := encode(
    extensions.digest(convert_to(v_private_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  v_public_geography := jsonb_build_object(
    'executionLocationMode', v_need.execution_location_mode,
    'approximateCity', v_need.approximate_city,
    'approximateArea', v_need.approximate_area,
    'approximateLat', v_need.approximate_lat,
    'approximateLng', v_need.approximate_lng,
    'topology', coalesce(v_topology, 'null'::jsonb)
  );

  v_media := coalesce(v_need.public_photo_paths, '{}'::text[]);

  v_payload := jsonb_build_object(
    'schemaVersion', 'NEED_PUBLICATION_FINGERPRINT_V1',
    'needId', v_need.id,
    'revision', v_need.revision,
    'title', v_need.title,
    'description', v_need.description,
    'category', v_need.category,
    'scheduleKind', v_need.schedule_kind,
    'startsAt', v_need.starts_at,
    'endsAt', v_need.ends_at,
    'requiredSlots', v_need.required_slots,
    'priceMode', v_need.mode,
    'requesterPriceRsd', v_need.requester_price_rsd,
    'requiredSkills', to_jsonb(v_need.required_skills),
    'requiredTools', to_jsonb(v_need.required_tools),
    'requiredVehicles', to_jsonb(v_need.required_vehicles),
    'requiredLicenses', to_jsonb(v_need.required_licenses),
    'minimumExperienceYears', v_need.minimum_experience_years,
    'verifiedIdentityRequired', v_need.verified_identity_required,
    'criticalConditions', to_jsonb(v_conditions),
    'publicGeography', v_public_geography,
    'publicMediaRefs', to_jsonb(v_media),
    'privateMaterialityMarker', v_private_marker
  );

  v_fingerprint := encode(
    extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  return jsonb_build_object(
    'schemaVersion', 'NEED_PUBLICATION_FINGERPRINT_V1',
    'needId', v_need.id,
    'needRevision', v_need.revision,
    'canonicalFingerprint', v_fingerprint,
    'privateMaterialityMarker', v_private_marker,
    'publicGeography', v_public_geography,
    'publicMediaRefs', to_jsonb(v_media)
  );
end;
$$;

revoke all on function private.need_publication_fingerprint_snapshot(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.rpc_record_need_publication_decision_service(
  p_need_id uuid,
  p_expected_revision integer,
  p_policy_id text,
  p_jurisdiction text,
  p_outcome text,
  p_rule_ids text[],
  p_decision_source text,
  p_safe_reason_codes text[] default '{}'::text[],
  p_provider_ref text default null,
  p_model_ref text default null,
  p_reviewer_provenance jsonb default '{}'::jsonb,
  p_service_provenance jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_need public.needs%rowtype;
  v_bundle_id uuid;
  v_policy_id text;
  v_policy_version integer;
  v_jurisdiction text;
  v_rule_ids text[];
  v_safe_reason_codes text[];
  v_rule_count integer;
  v_rule_snapshot jsonb;
  v_fp jsonb;
  v_identity_payload jsonb;
  v_identity text;
  v_decision_id uuid;
  v_sequence bigint;
begin
  if p_need_id is null or p_expected_revision is null then
    raise exception 'DECISION_NEED_REVISION_REQUIRED' using errcode='22004';
  end if;
  if coalesce(btrim(p_policy_id), '') = ''
     or coalesce(btrim(p_jurisdiction), '') = '' then
    raise exception 'POLICY_ID_JURISDICTION_REQUIRED' using errcode='22023';
  end if;
  if p_outcome not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then
    raise exception 'DECISION_OUTCOME_INVALID' using errcode='22023';
  end if;
  if p_outcome = 'ALLOW' then
    raise exception 'RU3_ALLOW_NOT_ENABLED' using errcode='42501';
  end if;
  if coalesce(btrim(p_decision_source), '') = '' then
    raise exception 'DECISION_SOURCE_REQUIRED' using errcode='22023';
  end if;
  if jsonb_typeof(coalesce(p_reviewer_provenance, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_service_provenance, 'null'::jsonb)) <> 'object'
     or coalesce(p_service_provenance, '{}'::jsonb) = '{}'::jsonb then
    raise exception 'DECISION_PROVENANCE_INVALID' using errcode='22023';
  end if;

  select * into v_need
    from public.needs
   where id = p_need_id
   for share;
  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;
  if v_need.status <> 'DRAFT' then
    raise exception 'NEED_NOT_DRAFT' using errcode='P0001';
  end if;
  if v_need.revision <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='40001';
  end if;

  if not exists (
    select 1 from public.need_geography g
     where g.need_id = p_need_id
       and jsonb_typeof(g.public_topology) = 'object'
  ) then
    raise exception 'PUBLIC_GEOGRAPHY_NOT_CANONICAL' using errcode='P0001';
  end if;

  if cardinality(coalesce(v_need.public_photo_paths, '{}'::text[])) > 0 then
    raise exception 'PUBLIC_MEDIA_REVIEW_AUTHORITY_NOT_READY' using errcode='P0001';
  end if;

  v_bundle_id := private.current_publication_policy_bundle(
    btrim(p_policy_id),
    btrim(p_jurisdiction),
    statement_timestamp()
  );
  if v_bundle_id is null then
    raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001';
  end if;

  select b.policy_id, b.version, b.jurisdiction
    into v_policy_id, v_policy_version, v_jurisdiction
    from private.publication_policy_bundles b
   where b.id = v_bundle_id;

  select coalesce(array_agg(x.rule_id order by x.rule_id), '{}'::text[])
    into v_rule_ids
    from (
      select distinct btrim(rid) as rule_id
        from unnest(coalesce(p_rule_ids, '{}'::text[])) rid
       where btrim(rid) <> ''
    ) x;

  if cardinality(v_rule_ids) = 0 then
    raise exception 'RULE_PROVENANCE_REQUIRED' using errcode='22023';
  end if;

  select count(*)::integer,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'ruleId', r.rule_id,
               'provenance', r.rule_provenance
             ) order by r.rule_id
           ),
           '[]'::jsonb
         )
    into v_rule_count, v_rule_snapshot
    from private.publication_policy_rule_refs r
   where r.bundle_id = v_bundle_id
     and r.rule_id = any(v_rule_ids);

  if v_rule_count <> cardinality(v_rule_ids) then
    raise exception 'RULE_PROVENANCE_MISMATCH' using errcode='P0001';
  end if;

  select coalesce(array_agg(x.reason_code order by x.reason_code), '{}'::text[])
    into v_safe_reason_codes
    from (
      select distinct btrim(rc) as reason_code
        from unnest(coalesce(p_safe_reason_codes, '{}'::text[])) rc
       where btrim(rc) <> ''
    ) x;

  v_fp := private.need_publication_fingerprint_snapshot(p_need_id);
  if (v_fp->>'needRevision')::integer <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='40001';
  end if;

  v_identity_payload := jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_expected_revision,
    'canonicalFingerprint', v_fp->>'canonicalFingerprint',
    'policyBundleId', v_bundle_id,
    'policyId', v_policy_id,
    'policyVersion', v_policy_version,
    'jurisdiction', v_jurisdiction,
    'ruleIds', to_jsonb(v_rule_ids),
    'outcome', p_outcome,
    'safeReasonCodes', to_jsonb(v_safe_reason_codes),
    'decisionSource', btrim(p_decision_source),
    'providerRef', nullif(btrim(coalesce(p_provider_ref,'')),''),
    'modelRef', nullif(btrim(coalesce(p_model_ref,'')),''),
    'reviewerProvenance', p_reviewer_provenance,
    'serviceProvenance', p_service_provenance
  );
  v_identity := encode(
    extensions.digest(convert_to(v_identity_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

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
    p_need_id,
    p_expected_revision,
    'NEED_PUBLICATION_FINGERPRINT_V1',
    v_fp->>'canonicalFingerprint',
    v_fp->>'privateMaterialityMarker',
    v_fp->'publicGeography',
    array(select jsonb_array_elements_text(v_fp->'publicMediaRefs')),
    v_bundle_id,
    v_policy_id,
    v_policy_version,
    v_jurisdiction,
    v_rule_ids,
    v_rule_snapshot,
    p_outcome,
    v_safe_reason_codes,
    btrim(p_decision_source),
    nullif(btrim(coalesce(p_provider_ref,'')),''),
    nullif(btrim(coalesce(p_model_ref,'')),''),
    p_reviewer_provenance,
    p_service_provenance,
    v_identity
  )
  on conflict (decision_identity) do nothing
  returning id, decision_sequence into v_decision_id, v_sequence;

  if v_decision_id is null then
    select d.id, d.decision_sequence
      into v_decision_id, v_sequence
      from private.need_publication_decisions d
     where d.decision_identity = v_identity;
  end if;

  return jsonb_build_object(
    'decisionId', v_decision_id,
    'decisionSequence', v_sequence,
    'needId', p_need_id,
    'needRevision', p_expected_revision,
    'canonicalFingerprint', v_fp->>'canonicalFingerprint',
    'policyBundleId', v_bundle_id,
    'policyVersion', v_policy_version,
    'jurisdiction', v_jurisdiction,
    'outcome', p_outcome,
    'publishable', false,
    'authoritative', true
  );
end;
$$;

revoke all on function public.rpc_record_need_publication_decision_service(
  uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.rpc_record_need_publication_decision_service(
  uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb
) to service_role;

comment on table private.need_publication_decisions is
  'RU-3 B06 append-only exact Need publication/admission decisions. No client direct write; current B06 service writer refuses ALLOW.';
comment on function private.need_publication_fingerprint_snapshot(uuid) is
  'INTERNAL RU-3 B06 canonical Need fingerprint V1. Includes public content/geography/media and only a private materiality digest, never raw private location in its return value.';
comment on function public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb) is
  'SERVICE_ONLY RU-3 B06 append-only decision writer. Requires current reviewed complete active bundle and exact rule provenance; ALLOW remains disabled until later reviewed policy/evaluator authority.';

do $ru3_b06_postconditions$
begin
  if exists (select 1 from private.need_publication_decisions) then
    raise exception 'RU3_B06_POSTCONDITION_FAILED: migration seeded decision content';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='private'
       and c.relname='need_publication_decisions'
       and c.relrowsecurity
  ) then
    raise exception 'RU3_B06_POSTCONDITION_FAILED: decision RLS missing';
  end if;

  if has_table_privilege('anon','private.need_publication_decisions','SELECT')
     or has_table_privilege('authenticated','private.need_publication_decisions','SELECT')
     or has_table_privilege('service_role','private.need_publication_decisions','SELECT')
     or has_table_privilege('anon','private.need_publication_decisions','INSERT')
     or has_table_privilege('authenticated','private.need_publication_decisions','INSERT')
     or has_table_privilege('service_role','private.need_publication_decisions','INSERT')
     or has_table_privilege('anon','private.need_publication_decisions','UPDATE')
     or has_table_privilege('authenticated','private.need_publication_decisions','UPDATE')
     or has_table_privilege('service_role','private.need_publication_decisions','UPDATE')
     or has_table_privilege('anon','private.need_publication_decisions','DELETE')
     or has_table_privilege('authenticated','private.need_publication_decisions','DELETE')
     or has_table_privilege('service_role','private.need_publication_decisions','DELETE') then
    raise exception 'RU3_B06_POSTCONDITION_FAILED: decision table exposed';
  end if;

  if has_function_privilege('anon','private.need_publication_fingerprint_snapshot(uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.need_publication_fingerprint_snapshot(uuid)','EXECUTE')
     or has_function_privilege('service_role','private.need_publication_fingerprint_snapshot(uuid)','EXECUTE') then
    raise exception 'RU3_B06_POSTCONDITION_FAILED: private fingerprint helper exposed';
  end if;

  if has_function_privilege(
       'anon',
       'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B06_POSTCONDITION_FAILED: service writer grants wrong';
  end if;

  if position(
       'RU3_ALLOW_NOT_ENABLED'
       in pg_get_functiondef(
         'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)'::regprocedure
       )
     ) = 0 then
    raise exception 'RU3_B06_POSTCONDITION_FAILED: current ALLOW gate missing';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.rpc_publish_need(uuid,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B06_POSTCONDITION_FAILED: legacy publish reopened';
  end if;

  if position(
       'PACKAGE_4_NOT_READY'
       in pg_get_functiondef('public.rpc_ai_publish_need(uuid,uuid)'::regprocedure)
     ) = 0 then
    raise exception 'RU3_B06_POSTCONDITION_FAILED: legacy AI publish is not fail closed';
  end if;
end
$ru3_b06_postconditions$;
