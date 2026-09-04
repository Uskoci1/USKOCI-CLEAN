-- USKOČI RU-4 — owner edit lock / pre-Dogovor revision / stale Prijava resolution.
-- PROOF CANDIDATE ONLY. Do not live-apply before disposable auth/concurrency proof.
--
-- Latest owner contract:
-- 1) a Zadatak may be materially edited only before the first Dogovor has ever formed;
-- 2) opening edit/AI chat does not mutate or unpublish anything;
-- 3) explicit human confirmation atomically creates the new DRAFT revision;
-- 4) prior unselected Prijave become STALE_REVIEW_REQUIRED and disappear from selectable current candidates;
-- 5) each Worker must explicitly KEEP / UPDATE / WITHDRAW before their Prijava can become current again;
-- 6) once any Dogovor exists for the Zadatak, ordinary parent-Zadatak editing is permanently locked for V1.

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
  new_material_snapshot jsonb not null,
  created_by_account_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint need_revision_events_revision_step check (to_revision = from_revision + 1),
  constraint need_revision_events_previous_object check (jsonb_typeof(previous_material_snapshot) = 'object'),
  constraint need_revision_events_new_object check (jsonb_typeof(new_material_snapshot) = 'object'),
  unique (need_id, to_revision)
);

create index if not exists need_revision_events_need_idx
  on private.need_revision_events(need_id, to_revision desc);

alter table private.need_revision_events enable row level security;
alter table private.need_revision_events force row level security;
revoke all on table private.need_revision_events from public, anon, authenticated, service_role;

create table if not exists private.need_edit_commands (
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
  constraint need_edit_commands_request_id_length check (char_length(btrim(client_request_id)) between 8 and 200),
  constraint need_edit_commands_hash_hex check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint need_edit_commands_revision_step check (to_revision = from_revision + 1),
  constraint need_edit_commands_result_object check (jsonb_typeof(result) = 'object')
);

alter table private.need_edit_commands enable row level security;
alter table private.need_edit_commands force row level security;
revoke all on table private.need_edit_commands from public, anon, authenticated, service_role;

create table if not exists private.response_revision_resolution_commands (
  worker_account_id uuid not null references auth.users(id) on delete restrict,
  client_request_id text not null,
  request_hash text not null,
  response_id uuid not null references public.marketplace_responses(id) on delete restrict,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (worker_account_id, client_request_id),
  constraint response_revision_resolution_request_id_length check (char_length(btrim(client_request_id)) between 8 and 200),
  constraint response_revision_resolution_hash_hex check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint response_revision_resolution_result_object check (jsonb_typeof(result) = 'object')
);

alter table private.response_revision_resolution_commands enable row level security;
alter table private.response_revision_resolution_commands force row level security;
revoke all on table private.response_revision_resolution_commands from public, anon, authenticated, service_role;

create or replace function private.jsonb_text_array(p_value jsonb)
returns text[]
language sql
immutable
security definer
set search_path to 'pg_catalog'
as $$
  select coalesce(array_agg(x.value), '{}'::text[])
    from jsonb_array_elements_text(coalesce(p_value, '[]'::jsonb)) as x(value)
$$;
revoke all on function private.jsonb_text_array(jsonb) from public, anon, authenticated, service_role;

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
revoke all on function private.need_material_snapshot(uuid) from public, anon, authenticated, service_role;

-- Forward-only lifecycle guard. Public material edits never happen in place.
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

  if token = 'CONFIRM_EDIT' then
    if old.status not in ('PUBLISHED','SELECTION') or new.status <> 'DRAFT' then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_STATUS_INVALID';
    end if;
    if new.revision <> old.revision + 1 then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_REVISION_INVALID';
    end if;
    if exists (select 1 from public.agreements a where a.need_id = old.id)
       or exists (select 1 from public.need_selections s where s.need_id = old.id)
       or exists (select 1 from public.marketplace_responses r where r.need_id = old.id and r.status = 'SELECTED') then
      raise exception using errcode='P0001', message='NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR';
    end if;
    if new.published_at is not null or new.response_deadline is not null then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_PUBLICATION_METADATA_NOT_CLEARED';
    end if;
    if coalesce(new.urgent, false)
       or new.urgent_activated_at is not null
       or new.urgent_expires_at is not null
       or new.urgent_policy_version is not null then
      raise exception using errcode='22023', message='CONFIRMED_EDIT_URGENT_METADATA_NOT_CLEARED';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
         (token = 'PUBLISH' and old.status = 'DRAFT' and new.status = 'PUBLISHED')
      or (token = 'SELECT' and old.status in ('PUBLISHED','SELECTION') and new.status in ('SELECTION','ACTIVE'))
      or (token = 'CANCEL_NEED' and old.status in ('DRAFT','PUBLISHED','SELECTION') and new.status = 'CANCELLED')
      or (token = 'CANCEL_AGREEMENT' and old.status in ('ACTIVE','SELECTION') and new.status = 'SELECTION')
      or (token = 'EXPIRE' and old.status in ('PUBLISHED','SELECTION') and new.status = 'EXPIRED')
      or (token = 'COMPLETE' and old.status in ('ACTIVE','SELECTION') and new.status = 'COMPLETED')
    ) then
      raise exception using errcode='22023', message='NEED_STATUS_TRANSITION_REQUIRES_RPC';
    end if;
  end if;

  if token is null then
    if new.revision is distinct from old.revision then
      raise exception using errcode='42501', message='NEED_REVISION_IS_SERVER_OWNED';
    end if;
    if new.urgent is distinct from old.urgent then raise exception using errcode='42501', message='URGENT_IS_SERVER_OWNED'; end if;
    if new.urgent_activated_at is distinct from old.urgent_activated_at then raise exception using errcode='42501', message='URGENT_ACTIVATED_AT_IS_SERVER_OWNED'; end if;
    if new.urgent_expires_at is distinct from old.urgent_expires_at then raise exception using errcode='42501', message='URGENT_EXPIRES_AT_IS_SERVER_OWNED'; end if;
    if new.urgent_policy_version is distinct from old.urgent_policy_version then raise exception using errcode='42501', message='URGENT_POLICY_VERSION_IS_SERVER_OWNED'; end if;
    if new.published_at is distinct from old.published_at then raise exception using errcode='42501', message='PUBLISHED_AT_IS_SERVER_OWNED'; end if;
    if new.response_deadline is distinct from old.response_deadline then raise exception using errcode='42501', message='RESPONSE_DEADLINE_IS_SERVER_OWNED'; end if;
  end if;

  if material then
    if old.status in ('PUBLISHED','SELECTION') then
      raise exception using errcode='22023', message='PUBLIC_NEED_EDIT_REQUIRES_CONFIRM_COMMAND';
    elsif old.status <> 'DRAFT' then
      raise exception using errcode='P0001', message='NEED_NOT_EDITABLE';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.guard_need_write() from public, anon, authenticated, service_role;

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

    -- No enqueue here. The new revision is DRAFT and must pass D-0140/B07 again.
  end if;
  return new;
end;
$$;
revoke all on function private.after_need_revision() from public, anon, authenticated, service_role;

create or replace function public.rpc_confirm_need_edit(
  p_need_id uuid,
  p_expected_revision integer,
  p_client_request_id text,
  p_material jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id, ''));
  v_request_hash text;
  v_existing private.need_edit_commands%rowtype;
  v_need public.needs%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_event_id uuid;
  v_result jsonb;
  v_private jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'NEED_ID_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;
  if p_material is null or jsonb_typeof(p_material) <> 'object' then
    raise exception 'MATERIAL_OBJECT_REQUIRED' using errcode='22023';
  end if;

  if (p_material - array[
    'title','description','category','requiredSlots','mode','requesterPriceRsd',
    'requiredSkills','requiredTools','requiredVehicles','requiredLicenses',
    'minimumExperienceYears','verifiedIdentityRequired','scheduleKind','startsAt','endsAt',
    'executionLocationMode','approximateLat','approximateLng','approximateCity','approximateArea',
    'publicPhotoPaths','privateLocation'
  ]) <> '{}'::jsonb then
    raise exception 'UNSUPPORTED_MATERIAL_FIELD' using errcode='22023';
  end if;

  if not (p_material ?& array[
    'title','description','category','requiredSlots','mode','requesterPriceRsd',
    'requiredSkills','requiredTools','requiredVehicles','requiredLicenses',
    'minimumExperienceYears','verifiedIdentityRequired','scheduleKind','startsAt','endsAt',
    'executionLocationMode','approximateLat','approximateLng','approximateCity','approximateArea',
    'publicPhotoPaths','privateLocation'
  ]) then
    raise exception 'FULL_MATERIAL_SNAPSHOT_REQUIRED' using errcode='22023';
  end if;

  if jsonb_typeof(p_material->'requiredSkills') <> 'array'
     or jsonb_typeof(p_material->'requiredTools') <> 'array'
     or jsonb_typeof(p_material->'requiredVehicles') <> 'array'
     or jsonb_typeof(p_material->'requiredLicenses') <> 'array'
     or jsonb_typeof(p_material->'publicPhotoPaths') <> 'array' then
    raise exception 'MATERIAL_ARRAY_FIELD_INVALID' using errcode='22023';
  end if;

  if jsonb_typeof(p_material->'privateLocation') not in ('object','null') then
    raise exception 'PRIVATE_LOCATION_INVALID' using errcode='22023';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'needId', p_need_id,
        'expectedRevision', p_expected_revision,
        'material', p_material
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\n' || v_request_id, 4404));

  select * into v_existing
    from private.need_edit_commands c
   where c.requester_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;
  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_need from public.needs n where n.id = p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id <> v_actor then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.revision <> p_expected_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='40001'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists (select 1 from public.agreements a where a.need_id = v_need.id)
     or exists (select 1 from public.need_selections s where s.need_id = v_need.id)
     or exists (select 1 from public.marketplace_responses r where r.need_id = v_need.id and r.status = 'SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  v_before := private.need_material_snapshot(v_need.id);
  if v_before is null then raise exception 'NEED_SNAPSHOT_FAILED' using errcode='P0001'; end if;

  v_private := p_material->'privateLocation';

  perform set_config('uskoci.need_lifecycle', 'CONFIRM_EDIT', true);
  update public.needs n
     set title = btrim(p_material->>'title'),
         description = btrim(p_material->>'description'),
         category = btrim(p_material->>'category'),
         required_slots = (p_material->>'requiredSlots')::integer,
         mode = p_material->>'mode',
         requester_price_rsd = (p_material->>'requesterPriceRsd')::integer,
         required_skills = private.jsonb_text_array(p_material->'requiredSkills'),
         required_tools = private.jsonb_text_array(p_material->'requiredTools'),
         required_vehicles = private.jsonb_text_array(p_material->'requiredVehicles'),
         required_licenses = private.jsonb_text_array(p_material->'requiredLicenses'),
         minimum_experience_years = (p_material->>'minimumExperienceYears')::integer,
         verified_identity_required = (p_material->>'verifiedIdentityRequired')::boolean,
         schedule_kind = p_material->>'scheduleKind',
         starts_at = (p_material->>'startsAt')::timestamptz,
         ends_at = (p_material->>'endsAt')::timestamptz,
         execution_location_mode = p_material->>'executionLocationMode',
         approximate_lat = (p_material->>'approximateLat')::numeric,
         approximate_lng = (p_material->>'approximateLng')::numeric,
         approximate_city = coalesce(p_material->>'approximateCity',''),
         approximate_area = coalesce(p_material->>'approximateArea',''),
         public_photo_paths = private.jsonb_text_array(p_material->'publicPhotoPaths'),
         status = 'DRAFT',
         revision = v_need.revision + 1,
         published_at = null,
         response_deadline = null,
         urgent = false,
         urgent_activated_at = null,
         urgent_expires_at = null,
         urgent_policy_version = null,
         updated_at = statement_timestamp()
   where n.id = v_need.id
     and n.revision = v_need.revision
     and n.status in ('PUBLISHED','SELECTION')
  returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle', '', true);

  if not found then raise exception 'NEED_EDIT_CONFLICT' using errcode='40001'; end if;

  insert into public.need_sensitive(need_id, exact_address, access_notes, exact_lat, exact_lng, updated_at)
  values (
    v_need.id,
    case when jsonb_typeof(v_private)='object' then coalesce(v_private->>'exactAddress','') else '' end,
    case when jsonb_typeof(v_private)='object' then coalesce(v_private->>'accessNotes','') else '' end,
    case when jsonb_typeof(v_private)='object' then (v_private->>'exactLat')::numeric else null end,
    case when jsonb_typeof(v_private)='object' then (v_private->>'exactLng')::numeric else null end,
    statement_timestamp()
  )
  on conflict (need_id) do update
    set exact_address = excluded.exact_address,
        access_notes = excluded.access_notes,
        exact_lat = excluded.exact_lat,
        exact_lng = excluded.exact_lng,
        updated_at = excluded.updated_at;

  delete from private.dispatch_schedule where need_id = v_need.id;

  v_after := private.need_material_snapshot(v_need.id);
  if v_after is not distinct from v_before then
    raise exception 'NO_MATERIAL_CHANGE' using errcode='22023';
  end if;

  insert into private.need_revision_events(
    need_id, from_revision, to_revision, from_status,
    previous_material_snapshot, new_material_snapshot, created_by_account_id
  ) values (
    v_need.id, p_expected_revision, v_need.revision,
    case when v_need.status='DRAFT' then 'PUBLISHED_OR_SELECTION' else v_need.status end,
    v_before, v_after, v_actor
  ) returning id into v_event_id;

  perform private.audit_marketplace(
    v_actor,
    'NEED_EDIT_CONFIRMED',
    'NEED',
    v_need.id,
    v_need.revision,
    jsonb_build_object('fromRevision', p_expected_revision, 'toRevision', v_need.revision, 'revisionEventId', v_event_id)
  );

  v_result := jsonb_build_object(
    'needId', v_need.id,
    'fromRevision', p_expected_revision,
    'revision', v_need.revision,
    'status', v_need.status,
    'revisionEventId', v_event_id,
    'requiresReadmission', true,
    'idempotentReplay', false,
    'authoritative', true
  );

  insert into private.need_edit_commands(
    requester_account_id, client_request_id, request_hash,
    need_id, from_revision, to_revision, revision_event_id, result
  ) values (
    v_actor, v_request_id, v_request_hash,
    v_need.id, p_expected_revision, v_need.revision, v_event_id, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.rpc_confirm_need_edit(uuid,integer,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.rpc_confirm_need_edit(uuid,integer,text,jsonb) to authenticated;

create or replace function public.rpc_resolve_stale_response_after_need_edit(
  p_response_id uuid,
  p_expected_response_version integer,
  p_expected_need_revision integer,
  p_client_request_id text,
  p_action text,
  p_covered_slots integer,
  p_price_rsd integer,
  p_proposed_start_at timestamptz,
  p_proposed_end_at timestamptz,
  p_scope_note text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id,''));
  v_action text := upper(btrim(coalesce(p_action,'')));
  v_request_hash text;
  v_existing private.response_revision_resolution_commands%rowtype;
  v_need_id uuid;
  v_need public.needs%rowtype;
  v_response public.marketplace_responses%rowtype;
  v_match jsonb;
  v_new_version integer;
  v_covered integer;
  v_price integer;
  v_start timestamptz;
  v_end timestamptz;
  v_note text;
  v_content_hash text;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_response_id is null or p_expected_response_version is null or p_expected_response_version < 1
     or p_expected_need_revision is null or p_expected_need_revision < 1 then
    raise exception 'RESPONSE_VERSION_NEED_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 200 then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023'; end if;
  if v_action not in ('KEEP','UPDATE','WITHDRAW') then raise exception 'STALE_RESPONSE_ACTION_INVALID' using errcode='22023'; end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'responseId', p_response_id,
        'expectedResponseVersion', p_expected_response_version,
        'expectedNeedRevision', p_expected_need_revision,
        'action', v_action,
        'coveredSlots', p_covered_slots,
        'priceRsd', p_price_rsd,
        'proposedStartAt', p_proposed_start_at,
        'proposedEndAt', p_proposed_end_at,
        'scopeNote', coalesce(p_scope_note,'')
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\n' || v_request_id, 4405));

  select * into v_existing
    from private.response_revision_resolution_commands c
   where c.worker_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;
  if found then
    if v_existing.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select r.need_id into v_need_id from public.marketplace_responses r where r.id = p_response_id;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_need from public.needs n where n.id = v_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_response from public.marketplace_responses r where r.id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;

  if v_response.worker_account_id <> v_actor then raise exception 'RESPONSE_NOT_OWNED' using errcode='42501'; end if;
  if v_response.current_version <> p_expected_response_version then raise exception 'STALE_REVIEW_REQUIRED' using errcode='40001'; end if;
  if v_need.revision <> p_expected_need_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='40001'; end if;
  if v_response.status <> 'STALE_REVIEW_REQUIRED' then raise exception 'RESPONSE_NOT_AWAITING_REVIEW' using errcode='P0001'; end if;
  if v_response.submitted_against_need_revision >= v_need.revision then raise exception 'RESPONSE_ALREADY_CURRENT' using errcode='P0001'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_OPEN' using errcode='P0001'; end if;
  if exists (select 1 from public.agreements a where a.selected_response_id = v_response.id) then
    raise exception 'RESPONSE_ALREADY_SELECTED' using errcode='P0001';
  end if;

  if v_action = 'WITHDRAW' then
    update public.marketplace_responses
       set status = 'WITHDRAWN', withdrawn_at = statement_timestamp(), selected_at = null
     where id = v_response.id
     returning * into v_response;

    v_result := jsonb_build_object(
      'responseId', v_response.id,
      'needId', v_need.id,
      'needRevision', v_need.revision,
      'version', v_response.current_version,
      'status', v_response.status,
      'action', v_action,
      'idempotentReplay', false,
      'authoritative', true
    );
  else
    if not exists (
      select 1 from public.app_profiles p
       where p.id = v_response.worker_profile_id
         and p.account_id = v_actor
         and p.kind = 'WORKER'
    ) then
      raise exception 'PROFILE_NOT_OWNED_BY_ACCOUNT' using errcode='42501';
    end if;

    v_match := private.match_detail(v_need.id, v_response.worker_profile_id);
    if not coalesce((v_match->>'responseAllowed')::boolean,false) then
      raise exception 'WORKER_NOT_ELIGIBLE' using errcode='P0001', detail=coalesce((v_match->'hardBlockers')::text,'[]');
    end if;

    if v_action = 'KEEP' then
      v_covered := v_response.covered_slots;
      v_price := v_response.price_rsd;
      v_start := v_response.proposed_start_at;
      v_end := v_response.proposed_end_at;
      v_note := v_response.scope_note;
    else
      v_covered := p_covered_slots;
      v_price := p_price_rsd;
      v_start := p_proposed_start_at;
      v_end := p_proposed_end_at;
      v_note := coalesce(p_scope_note,'');
    end if;

    if v_covered is null or v_covered < 1 or v_covered > v_need.required_slots then
      raise exception 'INVALID_COVERED_SLOTS' using errcode='22023';
    end if;
    if v_price is null or v_price <= 0 then raise exception 'INVALID_PRICE' using errcode='22023'; end if;
    if v_end is not null and v_start is not null and v_end <= v_start then raise exception 'INVALID_PROPOSED_WINDOW' using errcode='22023'; end if;
    if char_length(coalesce(v_note,'')) > 1200 then raise exception 'SCOPE_NOTE_TOO_LONG' using errcode='22023'; end if;

    v_content_hash := encode(extensions.digest(convert_to(
      v_price::text || '|' || v_covered::text || '|' ||
      coalesce(v_start::text,'') || '|' || coalesce(v_end::text,'') || '|' ||
      coalesce(btrim(v_note),'') || '|' || v_need.revision::text,
      'UTF8'), 'sha256'), 'hex');

    v_new_version := v_response.current_version + 1;

    update public.marketplace_responses
       set current_version = v_new_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = v_need.revision,
           covered_slots = v_covered,
           price_rsd = v_price,
           proposed_start_at = v_start,
           proposed_end_at = v_end,
           scope_note = coalesce(v_note,''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null,
           selected_at = null
     where id = v_response.id
     returning * into v_response;

    insert into public.marketplace_response_versions(
      response_id, version, need_revision, covered_slots, price_rsd,
      proposed_start_at, proposed_end_at, scope_note, content_hash
    ) values (
      v_response.id, v_new_version, v_need.revision, v_covered, v_price,
      v_start, v_end, coalesce(v_note,''), v_content_hash
    );

    v_result := jsonb_build_object(
      'responseId', v_response.id,
      'needId', v_need.id,
      'needRevision', v_need.revision,
      'version', v_new_version,
      'contentHash', v_content_hash,
      'status', v_response.status,
      'action', v_action,
      'idempotentReplay', false,
      'authoritative', true
    );
  end if;

  perform private.audit_marketplace(
    v_actor,
    case when v_action='WITHDRAW' then 'STALE_RESPONSE_WITHDRAWN' else 'STALE_RESPONSE_RECONFIRMED' end,
    'RESPONSE',
    v_response.id,
    v_response.current_version,
    jsonb_build_object('needId',v_need.id,'needRevision',v_need.revision,'action',v_action)
  );

  insert into private.response_revision_resolution_commands(
    worker_account_id, client_request_id, request_hash, response_id, result
  ) values (v_actor, v_request_id, v_request_hash, v_response.id, v_result);

  return v_result;
end;
$$;

revoke all on function public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text)
  to authenticated;

comment on function public.rpc_confirm_need_edit(uuid,integer,text,jsonb) is
  'RU-4 owner command. Explicit human confirmation atomically moves an editable public Zadatak to the next DRAFT revision. It is permanently blocked after any Dogovor/Selection exists. Opening edit UI alone does nothing.';
comment on function public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamptz,timestamptz,text) is
  'RU-4 Worker command. Explicit KEEP/UPDATE/WITHDRAW for a STALE_REVIEW_REQUIRED Prijava after the edited Zadatak revision is republished. No silent reconfirmation.';

-- Structural postconditions: candidate migration seeds no business command rows.
do $ru4_postconditions$
begin
  if exists (select 1 from private.need_edit_commands) then raise exception 'RU4_POSTCONDITION_FAILED: seeded need edit commands'; end if;
  if exists (select 1 from private.need_revision_events) then raise exception 'RU4_POSTCONDITION_FAILED: seeded revision events'; end if;
  if exists (select 1 from private.response_revision_resolution_commands) then raise exception 'RU4_POSTCONDITION_FAILED: seeded response resolution commands'; end if;
  if has_table_privilege('authenticated','private.need_edit_commands','SELECT')
     or has_table_privilege('authenticated','private.need_revision_events','SELECT')
     or has_table_privilege('authenticated','private.response_revision_resolution_commands','SELECT') then
    raise exception 'RU4_POSTCONDITION_FAILED: private command tables exposed';
  end if;
  if not has_function_privilege('authenticated','public.rpc_confirm_need_edit(uuid,integer,text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.rpc_confirm_need_edit(uuid,integer,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.rpc_confirm_need_edit(uuid,integer,text,jsonb)','EXECUTE') then
    raise exception 'RU4_POSTCONDITION_FAILED: edit command grants wrong';
  end if;
end
$ru4_postconditions$;