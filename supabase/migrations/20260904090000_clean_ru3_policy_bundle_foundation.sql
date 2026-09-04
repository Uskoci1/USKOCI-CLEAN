-- USKOČI RU-3 / B05 — D-0140 publication policy bundle foundation
-- STRUCTURAL ONLY. This migration intentionally seeds no policy content and
-- creates no ALLOW rule. Canonical publish remains fail-closed until a later
-- reviewed policy bundle + exact admission decision + publish unit is proven.

create table if not exists private.publication_policy_bundles (
  id uuid primary key default gen_random_uuid(),
  policy_id text not null,
  version integer not null,
  jurisdiction text not null,

  is_reviewed boolean not null default false,
  is_complete boolean not null default false,
  is_active boolean not null default false,

  review_provenance jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  effective_from timestamptz,
  effective_until timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),

  constraint publication_policy_bundles_policy_id_nonempty
    check (btrim(policy_id) <> ''),
  constraint publication_policy_bundles_version_positive
    check (version > 0),
  constraint publication_policy_bundles_jurisdiction_nonempty
    check (btrim(jurisdiction) <> ''),
  constraint publication_policy_bundles_review_provenance_object
    check (jsonb_typeof(review_provenance) = 'object'),
  constraint publication_policy_bundles_review_stamp_coherent
    check (
      (not is_reviewed and reviewed_at is null)
      or
      (is_reviewed and reviewed_at is not null)
    ),
  constraint publication_policy_bundles_active_gate
    check (
      not is_active
      or (
        is_reviewed
        and is_complete
        and reviewed_at is not null
        and activated_at is not null
      )
    ),
  constraint publication_policy_bundles_effective_window
    check (
      effective_until is null
      or effective_from is null
      or effective_until > effective_from
    ),
  unique (policy_id, jurisdiction, version)
);

create unique index if not exists publication_policy_bundles_one_active
  on private.publication_policy_bundles(policy_id, jurisdiction)
  where is_active;

create table if not exists private.publication_policy_rule_refs (
  bundle_id uuid not null
    references private.publication_policy_bundles(id) on delete restrict,
  rule_id text not null,
  rule_provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),

  constraint publication_policy_rule_refs_rule_id_nonempty
    check (btrim(rule_id) <> ''),
  constraint publication_policy_rule_refs_provenance_object
    check (jsonb_typeof(rule_provenance) = 'object'),
  primary key (bundle_id, rule_id)
);

alter table private.publication_policy_bundles enable row level security;
alter table private.publication_policy_rule_refs enable row level security;

revoke all on table private.publication_policy_bundles
  from public, anon, authenticated, service_role;
revoke all on table private.publication_policy_rule_refs
  from public, anon, authenticated, service_role;

create or replace function private.publication_policy_bundle_ready(
  p_bundle_id uuid,
  p_jurisdiction text,
  p_at timestamptz default statement_timestamp()
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
  select coalesce((
    select
      b.is_reviewed
      and b.is_complete
      and b.is_active
      and b.reviewed_at is not null
      and b.jurisdiction = p_jurisdiction
      and (b.effective_from is null or b.effective_from <= p_at)
      and (b.effective_until is null or b.effective_until > p_at)
    from private.publication_policy_bundles b
    where b.id = p_bundle_id
  ), false);
$$;

create or replace function private.current_publication_policy_bundle(
  p_policy_id text,
  p_jurisdiction text,
  p_at timestamptz default statement_timestamp()
)
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
  select b.id
  from private.publication_policy_bundles b
  where b.policy_id = p_policy_id
    and b.jurisdiction = p_jurisdiction
    and private.publication_policy_bundle_ready(b.id, p_jurisdiction, p_at)
  order by b.version desc
  limit 1;
$$;

revoke all on function private.publication_policy_bundle_ready(uuid,text,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.current_publication_policy_bundle(text,text,timestamptz)
  from public, anon, authenticated, service_role;

comment on table private.publication_policy_bundles is
  'RU-3 B05 server-owned D-0140 policy bundle metadata. Structural only: no policy content is seeded; activation requires reviewed+complete metadata.';
comment on table private.publication_policy_rule_refs is
  'RU-3 B05 stable rule identifiers and provenance only. This table intentionally contains no invented legal/safety rule content.';
comment on function private.publication_policy_bundle_ready(uuid,text,timestamptz) is
  'INTERNAL RU-3 readiness predicate. Missing/unreviewed/incomplete/inactive/stale bundles resolve false.';
comment on function private.current_publication_policy_bundle(text,text,timestamptz) is
  'INTERNAL RU-3 exact current bundle selector. Returns NULL when no reviewed complete active applicable bundle exists.';

do $ru3_b05_postconditions$
begin
  if exists (select 1 from private.publication_policy_bundles) then
    raise exception 'RU3_B05_POSTCONDITION_FAILED: migration seeded policy bundle content';
  end if;

  if exists (select 1 from private.publication_policy_rule_refs) then
    raise exception 'RU3_B05_POSTCONDITION_FAILED: migration seeded policy rule content';
  end if;

  if has_table_privilege('anon', 'private.publication_policy_bundles', 'SELECT')
     or has_table_privilege('authenticated', 'private.publication_policy_bundles', 'SELECT')
     or has_table_privilege('service_role', 'private.publication_policy_bundles', 'SELECT')
     or has_table_privilege('anon', 'private.publication_policy_bundles', 'INSERT')
     or has_table_privilege('authenticated', 'private.publication_policy_bundles', 'INSERT')
     or has_table_privilege('service_role', 'private.publication_policy_bundles', 'INSERT') then
    raise exception 'RU3_B05_POSTCONDITION_FAILED: policy bundle table exposed';
  end if;

  if has_table_privilege('anon', 'private.publication_policy_rule_refs', 'SELECT')
     or has_table_privilege('authenticated', 'private.publication_policy_rule_refs', 'SELECT')
     or has_table_privilege('service_role', 'private.publication_policy_rule_refs', 'SELECT')
     or has_table_privilege('anon', 'private.publication_policy_rule_refs', 'INSERT')
     or has_table_privilege('authenticated', 'private.publication_policy_rule_refs', 'INSERT')
     or has_table_privilege('service_role', 'private.publication_policy_rule_refs', 'INSERT') then
    raise exception 'RU3_B05_POSTCONDITION_FAILED: rule ref table exposed';
  end if;

  if has_function_privilege('anon', 'private.publication_policy_bundle_ready(uuid,text,timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.publication_policy_bundle_ready(uuid,text,timestamptz)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.publication_policy_bundle_ready(uuid,text,timestamptz)', 'EXECUTE')
     or has_function_privilege('anon', 'private.current_publication_policy_bundle(text,text,timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.current_publication_policy_bundle(text,text,timestamptz)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.current_publication_policy_bundle(text,text,timestamptz)', 'EXECUTE') then
    raise exception 'RU3_B05_POSTCONDITION_FAILED: private policy helper exposed';
  end if;

  if private.current_publication_policy_bundle(
       '__RU3_B05_UNCONFIGURED__',
       '__UNCONFIGURED__',
       statement_timestamp()
     ) is not null then
    raise exception 'RU3_B05_POSTCONDITION_FAILED: empty policy registry did not fail closed';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.rpc_publish_need(uuid,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B05_POSTCONDITION_FAILED: retired legacy publish regained authenticated execute';
  end if;

  if position(
       'PACKAGE_4_NOT_READY'
       in pg_get_functiondef('public.rpc_ai_publish_need(uuid,uuid)'::regprocedure)
     ) = 0 then
    raise exception 'RU3_B05_POSTCONDITION_FAILED: legacy AI publish is not fail closed';
  end if;
end
$ru3_b05_postconditions$;
