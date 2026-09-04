-- USKOČI RU-4 — material Zadatak revision / REVISE_TO_DRAFT.
-- PROOF CANDIDATE. Do not promote/live-apply before disposable auth/race proof.
--
-- Contract:
-- - public PUBLISHED/SELECTION Zadatak must become non-public BEFORE owner edits it;
-- - revision bumps exactly once at the REVISE_TO_DRAFT boundary;
-- - unselected old-revision Prijave become STALE_REVIEW_REQUIRED;
-- - SELECTED Prijave / Selection / Agreement snapshots are preserved;
-- - old publication decisions/audit history are immutable and remain attached to old revision;
-- - no dispatch/public unsafe window exists for the new revision;
-- - D-0140 re-admission of the new DRAFT revision remains a separate RU-3 authority.

-- Keep legacy STALE rows valid, but introduce the explicit product state used by RU-4/RU-5.
alter table public.marketplace_responses
  drop constraint if exists marketplace_responses_status_check;
alter table public.marketplace_responses
  add constraint marketplace_responses_status_check
  check (status in (
    'DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED',
    'NOT_SELECTED','WITHDRAWN','EXPIRED','STALE','STALE_REVIEW_REQUIRED'
  ));

create table if not exists private.need_revision_events (
  id uuid primary key default extensions.gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete restrict,
  from_revision integer not null,
  to_revision integer not null,
  from_status text not null,
  previous_material_snapshot jsonb not null,
  reason text not null default '',
  created_by_account_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint need_revision_events_revision_step check (to_revision = from_revision + 1),
  constraint need_revision_events_reason_length check (char_length(reason) <= 500),
  constraint need_revision_events_snapshot_object check (jsonb_typeof(previous_material_snapshot) = 'object'),
  unique (need_id, to_revision)
);

create index if not exists need_revision_events_need_idx
  on private.need_revision_events(need_id, to_revision desc);

alter table private.need_revision_events enable row level security;
alter table private.need_revision_events force row level security;
revoke all on table private.need_revision_events
  from public, anon, authenticated, service_role;

create table if not exists private.need_revision_commands (
  requester_account_id uuid not null references auth.users(id) on delete restrict,
  client_request_id text not null,
  request_hash text not null,
  need_id uuid not null references public.needs(id) on delete restrict,
  from_revision integer not null,
  to_revision integer not null,
  revision_event_id uuid not null references private.need_revision_events(id) on delete restrict,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (requester_account_id, client_request_id),
  constraint need_revision_commands_request_id_length
    check (char_length(btrim(client_request_id)) between 8 and 200),
  constraint need_revision_commands_request_hash_hex
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint need_revision_commands_revision_step
    check (to_revision = from_revision + 1),
  constraint need_revision_commands_result_object
    check (jsonb_typeof(result) = 'object')
);

alter table private.need_revision_commands enable row level security;
alter table private.need_revision_commands force row level security;
revoke all on table private.need_revision_commands
  from public, anon, authenticated, service_role;

create or replace function private.need_material_snapshot(p_need_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
  select jsonb_build_object(
    'title', n.title,
    'description', n.description,
    'category', n.category,
    'requiredSlots', n.required_slots,
    'mode', n.mode,
    'requesterPriceRsd', n.requester_price_rsd,
    'requiredSkills', to_jsonb(n.required_skills),
    'requiredTools', to_jsonb(n.required_tools),
    'requiredVehicles', to_jsonb(n.required_vehicles),
    'requiredLicenses', to_jsonb(n.required_licenses),
    'minimumExperienceYears', n.minimum_experience_years,
    'verifiedIdentityRequired', n.verified_identity_required,
    'scheduleKind', n.schedule_kind,
    'startsAt', n.starts_at,
    'endsAt', n.ends_at,
    'executionLocationMode', n.execution_location_mode,
    'approximateLat', n.approximate_lat,
    'approximateLng', n.approximate_lng,
    'approximateCity', n.approximate_city,
    'approximateArea', n.approximate_area,
    'publicPhotoPaths', to_jsonb(n.public_photo_paths),
    'privateLocation', case when s.need_id is null then null else jsonb_build_object(
      'exactAddress', s.exact_address,
      'accessNotes', s.access_notes,
      'exactLat', s.exact_lat,
      'exactLng', s.exact_lng
    ) end
  )
  from public.needs n
  left join public.need_sensitive s on s.need_id = n.id
  where n.id = p_need_id
$$;
revoke all on function private.need_material_snapshot(uuid)
  from public, anon, authenticated, service_role;

-- Replace the lifecycle guard forward-only: add explicit server-only REVISE_TO_DRAFT.
create or replace function private.guard_need_write()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  token text := current_setting('uskoci.need_lifecycle', true);
  material boolean;
begin
  if not exists (
    select 1 from public.app_profiles p
     where p.id = new.requester_profile_id
       and p.account_id = new.requester_account_id
       and p.kind = 'REQUESTER'
  ) then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT'
       and not (new.status = 'PUBLISHED' and token = 'PUBLISH') then
      raise exception using errcode='22023', message='NEED_MUST_START_AS_DRAFT';
    end if;
    if token is null then
      new.urgent := false;
      new.urgent_activated_at := null;
      new.urgent_expires_at := null;
      new.urgent_policy_version := null;
      new.published_at := null;
      new.response_deadline := null;
    end if;
    return new;
  end if;

  if old.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
     and (
       (to_jsonb(new) - array['urgent','updated_at'])
         is distinct from
       (to_jsonb(old) - array['urgent','updated_at'])
       or (not coalesce(old.urgent, false) and coalesce(new.urgent, false))
     ) then
    raise exception using errcode='22023', message='NEED_TERMINAL_IMMUTABLE';
  end if;

  if new.requester_account_id <> old.requester_account_id then
    raise exception using errcode='42501', message='NEED_OWNER_IMMUTABLE';
  end if;

  if token = 'REVISE_TO_DRAFT' then
    if old.status not in ('PUBLISHED','SELECTION')
       or new.status <> 'DRAFT' then
      raise exception using errcode='22023', message='REVISE_TO_DRAFT_STATUS_INVALID';
    end if;
    if new.revision <> old.revision + 1 then
      raise exception using errcode='22023', message='REVISE_TO_DRAFT_REVISION_INVALID';
    end if;
    if new.published_at is not null or new.response_deadline is not null then
      raise exception using errcode='22023', message='REVISE_TO_DRAFT_PUBLICATION_METADATA_NOT_CLEARED';
    end if;
    if coalesce(new.urgent, false)
       or new.urgent_activated_at is not null
       or new.urgent_expires_at is not null
       or new.urgent_policy_version is not null then
      raise exception using errcode='22023', message='REVISE_TO_DRAFT_URGENT_METADATA_NOT_CLEARED';
    end if;
    -- The transition command intentionally does not mutate material task terms.
    if (to_jsonb(new) - array[
          'status','revision','published_at','response_deadline',
          'urgent','urgent_activated_at','urgent_expires_at','urgent_policy_version','updated_at'
        ]) is distinct from
       (to_jsonb(old) - array[
          'status','revision','published_at','response_deadline',
          'urgent','urgent_activated_at','urgent_expires_at','urgent_policy_version','updated_at'
        ]) then
      raise exception using errcode='22023', message='REVISE_TO_DRAFT_MUST_PRECEDE_EDIT';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
         (token = 'PUBLISH'
          and old.status = 'DRAFT' and new.status = 'PUBLISHED')
      or (token = 'SELECT'
          and old.status in ('PUBLISHED','SELECTION')
          and new.status in ('SELECTION','ACTIVE'))
      or (token = 'CANCEL_NEED'
          and old.status in ('DRAFT','PUBLISHED','SELECTION')
          and new.status = 'CANCELLED')
      or (token = 'CANCEL_AGREEMENT'
          and old.status in ('ACTIVE','SELECTION')
          and new.status = 'SELECTION')
      or (token = 'EXPIRE'
          and old.status in ('PUBLISHED','SELECTION')
          and new.status = 'EXPIRED')
      or (token = 'COMPLETE'
          and old.status in ('ACTIVE','SELECTION')
          and new.status = 'COMPLETED')
    ) then
      raise exception using errcode='22023', message='NEED_STATUS_TRANSITION_REQUIRES_RPC';
    end if;
  end if;

  if token is null then
    if new.urgent is distinct from old.urgent then
      raise exception using errcode='42501', message='URGENT_IS_SERVER_OWNED';
    end if;
    if new.urgent_activated_at is distinct from old.urgent_activated_at then
      raise exception using errcode='42501', message='URGENT_ACTIVATED_AT_IS_SERVER_OWNED';
    end if;
    if new.urgent_expires_at is distinct from old.urgent_expires_at then
      raise exception using errcode='42501', message='URGENT_EXPIRES_AT_IS_SERVER_OWNED';
    end if;
    if new.urgent_policy_version is distinct from old.urgent_policy_version then
      raise exception using errcode='42501', message='URGENT_POLICY_VERSION_IS_SERVER_OWNED';
    end if;
    if new.published_at is distinct from old.published_at then
      raise exception using errcode='42501', message='PUBLISHED_AT_IS_SERVER_OWNED';
    end if;
    if new.response_deadline is distinct from old.response_deadline then
      raise exception using errcode='42501', message='RESPONSE_DEADLINE_IS_SERVER_OWNED';
    end if;
  end if;

  material :=
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
    or new.required_slots is distinct from old.required_slots
    or new.mode is distinct from old.mode
    or new.requester_price_rsd is distinct from old.requester_price_rsd
    or new.required_skills is distinct from old.required_skills
    or new.required_tools is distinct from old.required_tools
    or new.required_vehicles is distinct from old.required_vehicles
    or new.required_licenses is distinct from old.required_licenses
    or new.minimum_experience_years is distinct from old.minimum_experience_years
    or new.verified_identity_required is distinct from old.verified_identity_required
    or new.schedule_kind is distinct from old.schedule_kind
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.execution_location_mode is distinct from old.execution_location_mode
    or new.approximate_lat is distinct from old.approximate_lat
    or new.approximate_lng is distinct from old.approximate_lng
    or new.approximate_city is distinct from old.approximate_city
    or new.approximate_area is distinct from old.approximate_area
    or new.public_photo_paths is distinct from old.public_photo_paths
    or new.response_deadline is distinct from old.response_deadline;

  if material then
    if old.status in ('PUBLISHED','SELECTION') then
      -- A public material change must never happen in-place. The owner must
      -- first cross the explicit REVISE_TO_DRAFT command boundary.
      raise exception using errcode='22023', message='PUBLIC_NEED_MUST_REVISE_TO_DRAFT_BEFORE_EDIT';
    end if;
  elsif new.revision is distinct from old.revision then
    raise exception using errcode='22023', message='REVISION_BUMP_WITHOUT_MATERIAL_CHANGE';
  end if;

  return new;
end;
$$;
revoke all on function private.guard_need_write()
  from public, anon, authenticated, service_role;

-- Revision invalidation is server-owned and explicit. Selected rows are never touched.
create or replace function private.after_need_revision()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
begin
  if new.revision > old.revision then
    update public.marketplace_responses
       set status = 'STALE_REVIEW_REQUIRED'
     where need_id = new.id
       and submitted_against_need_revision = old.revision
       and status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED');

    update public.opportunity_deliveries
       set status = 'EXPIRED'
     where need_id = new.id
       and need_revision = old.revision
       and status in ('READY','SEEN');

    update public.dispatch_rounds
       set status = 'STOPPED', stop_reason = 'NEED_REVISED'
     where need_id = new.id
       and need_revision = old.revision
       and status in ('PLANNED','SENT');

    -- Deliberately do NOT enqueue the new revision here. RU-4 revision starts
    -- as DRAFT and must pass D-0140 re-admission before B07 can publish it.
  end if;
  return new;
end;
$$;
revoke all on function private.after_need_revision()
  from public, anon, authenticated, service_role;

create or replace function public.rpc_revise_need_to_draft(
  p_need_id uuid,
  p_expected_revision integer,
  p_client_request_id text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id, ''));
  v_reason text := left(btrim(coalesce(p_reason, '')), 500);
  v_request_hash text;
  v_existing private.need_revision_commands%rowtype;
  v_need public.needs%rowtype;
  v_before jsonb;
  v_event_id uuid;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_need_id is null or p_expected_revision is null or p_expected_revision <= 0 then
    raise exception 'NEED_ID_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) < 8 or char_length(v_request_id) > 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'needId', p_need_id,
        'expectedRevision', p_expected_revision,
        'reason', v_reason
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || E'\n' || v_request_id, 4104)
  );

  select * into v_existing
    from private.need_revision_commands c
   where c.requester_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_need
    from public.needs n
   where n.id = p_need_id
   for update;
  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception 'NEED_NOT_OWNED' using errcode='42501';
  end if;
  if v_need.revision <> p_expected_revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode='40001';
  end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then
    raise exception 'NEED_NOT_REVISABLE_PUBLIC_STATE' using errcode='P0001', detail=v_need.status;
  end if;

  v_before := private.need_material_snapshot(v_need.id);
  if v_before is null then
    raise exception 'NEED_REVISION_SNAPSHOT_FAILED' using errcode='P0001';
  end if;

  perform set_config('uskoci.need_lifecycle', 'REVISE_TO_DRAFT', true);
  update public.needs n
     set status = 'DRAFT',
         revision = v_need.revision + 1,
         published_at = null,
         response_deadline = null,
         urgent = false,
         urgent_activated_at = null,
         urgent_expires_at = null,
         urgent_policy_version = null
   where n.id = v_need.id
     and n.revision = v_need.revision
     and n.status in ('PUBLISHED','SELECTION')
  returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle', '', true);

  if not found then
    raise exception 'NEED_REVISION_CONFLICT' using errcode='40001';
  end if;

  -- Defense in depth: leaving public state must remove pending dispatch schedule.
  delete from private.dispatch_schedule where need_id = v_need.id;

  insert into private.need_revision_events(
    need_id, from_revision, to_revision, from_status,
    previous_material_snapshot, reason, created_by_account_id
  ) values (
    v_need.id, p_expected_revision, v_need.revision,
    case when exists (
      select 1 from public.need_selections s
       where s.need_id = v_need.id and s.status = 'SELECTED'
    ) then 'SELECTION' else 'PUBLISHED' end,
    v_before, v_reason, v_actor
  )
  returning id into v_event_id;

  perform private.audit_marketplace(
    v_actor,
    'NEED_REVISE_TO_DRAFT',
    'NEED',
    v_need.id,
    v_need.revision,
    jsonb_build_object(
      'fromRevision', p_expected_revision,
      'toRevision', v_need.revision,
      'reason', v_reason,
      'revisionEventId', v_event_id
    )
  );

  v_result := jsonb_build_object(
    'needId', v_need.id,
    'fromRevision', p_expected_revision,
    'revision', v_need.revision,
    'status', v_need.status,
    'revisionEventId', v_event_id,
    'requiresReadmission', true,
    'idempotentReplay', false
  );

  insert into private.need_revision_commands(
    requester_account_id, client_request_id, request_hash,
    need_id, from_revision, to_revision, revision_event_id, result
  ) values (
    v_actor, v_request_id, v_request_hash,
    v_need.id, p_expected_revision, v_need.revision, v_event_id, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.rpc_revise_need_to_draft(uuid,integer,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_revise_need_to_draft(uuid,integer,text,text)
  to authenticated;

comment on function public.rpc_revise_need_to_draft(uuid,integer,text,text) is
  'USER_COMMAND RU-4. Owner-only public Zadatak revision boundary: PUBLISHED/SELECTION -> DRAFT, exact +1 revision, old unselected Prijave stale-review-required, selected Agreement snapshots preserved, no new dispatch until re-admission.';

-- Structural postconditions: this migration must not rewrite existing business rows.
do $ru4_postconditions$
begin
  if exists (select 1 from private.need_revision_commands) then
    raise exception 'RU4_POSTCONDITION_FAILED: seeded revision commands';
  end if;
  if exists (select 1 from private.need_revision_events) then
    raise exception 'RU4_POSTCONDITION_FAILED: seeded revision events';
  end if;
  if has_table_privilege('authenticated','private.need_revision_commands','SELECT')
     or has_table_privilege('authenticated','private.need_revision_events','SELECT')
     or has_table_privilege('service_role','private.need_revision_commands','SELECT')
     or has_table_privilege('service_role','private.need_revision_events','SELECT') then
    raise exception 'RU4_POSTCONDITION_FAILED: private revision tables exposed';
  end if;
  if has_function_privilege('anon','public.rpc_revise_need_to_draft(uuid,integer,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_revise_need_to_draft(uuid,integer,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.rpc_revise_need_to_draft(uuid,integer,text,text)','EXECUTE') then
    raise exception 'RU4_POSTCONDITION_FAILED: revise command grants wrong';
  end if;
  if has_function_privilege('authenticated','private.guard_need_write()','EXECUTE')
     or has_function_privilege('authenticated','private.after_need_revision()','EXECUTE') then
    raise exception 'RU4_POSTCONDITION_FAILED: trigger helper exposed';
  end if;
end
$ru4_postconditions$;
