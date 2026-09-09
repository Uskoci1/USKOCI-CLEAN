begin;

-- W02/W09 backend closure: confirmed Agreements become the authoritative busy
-- calendar for a worker. This is a projection of current Agreement terms, not
-- a second editable source of truth. Existing availability rules/windows stay
-- separate and continue to express when a worker wants to work.

do $preflight$
begin
  if to_regclass('private.worker_calendar_events') is not null
     or to_regprocedure('private.worker_calendar_conflict(uuid,timestamptz,timestamptz,uuid)') is not null
     or to_regprocedure('private.refresh_worker_calendar_event(uuid)') is not null
     or to_regprocedure('public.rpc_get_worker_calendar(timestamptz,timestamptz)') is not null then
    raise exception 'W02_CALENDAR_AUTHORITY_ALREADY_EXISTS';
  end if;
  if to_regprocedure('private.match_detail(uuid,uuid)') is null
     or to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)') is null
     or to_regprocedure('public.rpc_respond_agreement_change(uuid,boolean)') is null
     or to_regclass('public.agreements') is null
     or to_regclass('public.agreement_versions') is null
     or to_regclass('public.app_profiles') is null then
    raise exception 'W02_CALENDAR_PREDECESSOR_MISSING';
  end if;
  if md5(pg_get_functiondef('private.match_detail(uuid,uuid)'::regprocedure)) <> '6520e92fe9bc66729de1465d618775f2' then
    raise exception 'W02_MATCH_DETAIL_PREDECESSOR_CHANGED';
  end if;
end;
$preflight$;

create table private.worker_calendar_events (
  id uuid primary key default extensions.gen_random_uuid(),
  agreement_id uuid not null unique references public.agreements(id) on delete cascade,
  worker_account_id uuid not null references public.app_accounts(id) on delete cascade,
  worker_profile_id uuid not null references public.app_profiles(id) on delete cascade,
  agreement_version integer not null check (agreement_version >= 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state text not null check (state in ('BLOCKING','RELEASED')),
  agreement_status text not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint worker_calendar_event_range_check check (ends_at > starts_at)
);

create index worker_calendar_events_worker_time_idx
  on private.worker_calendar_events(worker_profile_id, state, starts_at, ends_at);
create index worker_calendar_events_account_time_idx
  on private.worker_calendar_events(worker_account_id, state, starts_at, ends_at);

alter table private.worker_calendar_events enable row level security;
alter table private.worker_calendar_events force row level security;
revoke all on table private.worker_calendar_events from public, anon, authenticated, service_role;

create or replace function private.worker_calendar_conflict(
  p_worker_profile_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_agreement_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select case
    when p_worker_profile_id is null or p_starts_at is null or p_ends_at is null then false
    when p_starts_at >= p_ends_at then false
    else exists (
      select 1
      from private.worker_calendar_events e
      where e.worker_profile_id = p_worker_profile_id
        and e.state = 'BLOCKING'
        and (p_exclude_agreement_id is null or e.agreement_id <> p_exclude_agreement_id)
        and e.starts_at < p_ends_at
        and e.ends_at > p_starts_at
    )
  end;
$function$;

revoke all on function private.worker_calendar_conflict(uuid,timestamptz,timestamptz,uuid)
  from public, anon, authenticated, service_role;

create or replace function private.refresh_worker_calendar_event(p_agreement_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_worker_account_id uuid;
  v_worker_profile_id uuid;
  v_current_version integer;
  v_agreement_status text;
  v_terms jsonb;
  v_start_text text;
  v_end_text text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  select a.worker_account_id,
         a.worker_profile_id,
         a.current_version,
         a.status,
         av.terms
    into v_worker_account_id,
         v_worker_profile_id,
         v_current_version,
         v_agreement_status,
         v_terms
  from public.agreements a
  join public.agreement_versions av
    on av.agreement_id = a.id and av.version = a.current_version
  where a.id = p_agreement_id;

  if not found then
    -- Agreement deletion cascades the projection row. A missing current version
    -- is never silently reconstructed here.
    if exists (select 1 from public.agreements a where a.id = p_agreement_id) then
      raise exception 'AGREEMENT_CALENDAR_VERSION_MISSING' using errcode = 'P0001';
    end if;
    return;
  end if;

  if not exists (
    select 1
    from public.app_profiles p
    where p.id = v_worker_profile_id
      and p.account_id = v_worker_account_id
      and p.kind = 'WORKER'
  ) then
    raise exception 'AGREEMENT_CALENDAR_WORKER_MISMATCH' using errcode = 'P0001';
  end if;

  -- A no-longer-active Agreement must immediately stop blocking new work.
  if v_agreement_status <> 'CONFIRMED' then
    update private.worker_calendar_events
       set state = 'RELEASED',
           agreement_status = v_agreement_status,
           agreement_version = v_current_version,
           updated_at = statement_timestamp()
     where agreement_id = p_agreement_id;
    return;
  end if;

  v_start_text := nullif(btrim(v_terms->>'proposed_start_at'), '');
  v_end_text := nullif(btrim(v_terms->>'proposed_end_at'), '');

  -- A truly flexible/unscheduled Agreement occupies no hard interval.
  if v_start_text is null and v_end_text is null then
    delete from private.worker_calendar_events where agreement_id = p_agreement_id;
    return;
  end if;
  if v_start_text is null or v_end_text is null then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode = 'P0001';
  end if;

  begin
    v_starts_at := v_start_text::timestamptz;
    v_ends_at := v_end_text::timestamptz;
  exception when others then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode = 'P0001';
  end;

  if v_starts_at >= v_ends_at then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode = 'P0001';
  end if;

  -- All bookings for one worker serialize on the same transaction lock. This
  -- closes the race where two Selection transactions both pass matching before
  -- either Agreement row is visible to the other transaction.
  perform pg_advisory_xact_lock(
    hashtextextended('uskoci-worker-calendar:' || v_worker_profile_id::text, 0)
  );

  if private.worker_calendar_conflict(
       v_worker_profile_id, v_starts_at, v_ends_at, p_agreement_id
     ) then
    raise exception 'WORKER_CALENDAR_CONFLICT'
      using errcode = 'P0001',
            detail = 'CALENDAR_CONFLICT',
            hint = 'Uskocer vec ima potvrđen Dogovor u ovom terminu.';
  end if;

  insert into private.worker_calendar_events(
    agreement_id,
    worker_account_id,
    worker_profile_id,
    agreement_version,
    starts_at,
    ends_at,
    state,
    agreement_status
  ) values (
    p_agreement_id,
    v_worker_account_id,
    v_worker_profile_id,
    v_current_version,
    v_starts_at,
    v_ends_at,
    'BLOCKING',
    v_agreement_status
  )
  on conflict (agreement_id) do update
    set worker_account_id = excluded.worker_account_id,
        worker_profile_id = excluded.worker_profile_id,
        agreement_version = excluded.agreement_version,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        state = excluded.state,
        agreement_status = excluded.agreement_status,
        updated_at = statement_timestamp();
end;
$function$;

revoke all on function private.refresh_worker_calendar_event(uuid)
  from public, anon, authenticated, service_role;

-- Existing confirmed Agreements predate hard calendar authority. Project all of
-- them without retroactively invalidating history. Existing overlaps are
-- grandfathered; every future Selection/current-version update is guarded.
do $backfill$
declare
  r record;
  v_start_text text;
  v_end_text text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  for r in
    select a.id as agreement_id,
           a.worker_account_id,
           a.worker_profile_id,
           a.current_version,
           a.status as agreement_status,
           av.terms
    from public.agreements a
    join public.agreement_versions av
      on av.agreement_id = a.id and av.version = a.current_version
    where a.status = 'CONFIRMED'
    order by a.created_at, a.id
  loop
    v_start_text := nullif(btrim(r.terms->>'proposed_start_at'), '');
    v_end_text := nullif(btrim(r.terms->>'proposed_end_at'), '');
    if v_start_text is null and v_end_text is null then
      continue;
    end if;
    if v_start_text is null or v_end_text is null then
      raise exception 'W02_HISTORICAL_CALENDAR_INTERVAL_INVALID:%', r.agreement_id;
    end if;
    begin
      v_starts_at := v_start_text::timestamptz;
      v_ends_at := v_end_text::timestamptz;
    exception when others then
      raise exception 'W02_HISTORICAL_CALENDAR_INTERVAL_INVALID:%', r.agreement_id;
    end;
    if v_starts_at >= v_ends_at then
      raise exception 'W02_HISTORICAL_CALENDAR_INTERVAL_INVALID:%', r.agreement_id;
    end if;
    if not exists (
      select 1 from public.app_profiles p
      where p.id = r.worker_profile_id
        and p.account_id = r.worker_account_id
        and p.kind = 'WORKER'
    ) then
      raise exception 'W02_HISTORICAL_CALENDAR_WORKER_MISMATCH:%', r.agreement_id;
    end if;
    insert into private.worker_calendar_events(
      agreement_id, worker_account_id, worker_profile_id, agreement_version,
      starts_at, ends_at, state, agreement_status
    ) values (
      r.agreement_id, r.worker_account_id, r.worker_profile_id,
      r.current_version, v_starts_at, v_ends_at, 'BLOCKING', r.agreement_status
    );
  end loop;
end;
$backfill$;

create or replace function private.tg_worker_calendar_version_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_current_version integer;
begin
  select a.current_version into v_current_version
  from public.agreements a where a.id = new.agreement_id;
  if found and v_current_version = new.version then
    perform private.refresh_worker_calendar_event(new.agreement_id);
  end if;
  return new;
end;
$function$;

create or replace function private.tg_worker_calendar_agreement_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if new.current_version is distinct from old.current_version
     or new.status is distinct from old.status then
    perform private.refresh_worker_calendar_event(new.id);
  end if;
  return new;
end;
$function$;

revoke all on function private.tg_worker_calendar_version_insert()
  from public, anon, authenticated, service_role;
revoke all on function private.tg_worker_calendar_agreement_update()
  from public, anon, authenticated, service_role;

create trigger agreement_version_calendar_sync
  after insert on public.agreement_versions
  for each row execute function private.tg_worker_calendar_version_insert();

create trigger agreement_calendar_sync
  after update of current_version, status on public.agreements
  for each row execute function private.tg_worker_calendar_agreement_update();

-- Preserve the exact predecessor matcher as a private baseline, then keep the
-- public/internal function name stable for all existing dispatch/application/
-- Selection callers while adding the calendar hard blocker.
do $clone_matcher$
declare
  v_def text;
begin
  if to_regprocedure('private.match_detail_without_calendar(uuid,uuid)') is not null then
    raise exception 'W02_MATCH_BASELINE_ALREADY_EXISTS';
  end if;
  v_def := pg_get_functiondef('private.match_detail(uuid,uuid)'::regprocedure);
  v_def := replace(
    v_def,
    'FUNCTION private.match_detail(nid uuid, pid uuid)',
    'FUNCTION private.match_detail_without_calendar(nid uuid, pid uuid)'
  );
  if v_def = pg_get_functiondef('private.match_detail(uuid,uuid)'::regprocedure) then
    raise exception 'W02_MATCH_BASELINE_CLONE_FAILED';
  end if;
  execute v_def;
end;
$clone_matcher$;

revoke all on function private.match_detail_without_calendar(uuid,uuid)
  from public, anon, authenticated, service_role;

create or replace function private.match_detail(nid uuid, pid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_base jsonb;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_hard jsonb;
begin
  v_base := private.match_detail_without_calendar(nid, pid);
  if v_base is null then
    return null;
  end if;

  select n.starts_at, n.ends_at into v_starts_at, v_ends_at
  from public.needs n where n.id = nid;
  if not found or v_starts_at is null or v_ends_at is null or v_starts_at >= v_ends_at then
    return v_base;
  end if;

  if not private.worker_calendar_conflict(pid, v_starts_at, v_ends_at, null) then
    return v_base;
  end if;

  v_hard := coalesce(v_base->'hardBlockers', '[]'::jsonb);
  if not (v_hard @> jsonb_build_array('CALENDAR_CONFLICT')) then
    v_hard := v_hard || jsonb_build_array('CALENDAR_CONFLICT');
  end if;

  v_base := jsonb_set(v_base, '{hardBlockers}', v_hard, true);
  v_base := jsonb_set(v_base, '{responseAllowed}', 'false'::jsonb, true);
  v_base := jsonb_set(v_base, '{dispatchEligible}', 'false'::jsonb, true);
  return v_base;
end;
$function$;

comment on function private.match_detail(uuid,uuid) is
  'Authoritative match projection. Existing capability/availability/radius policy is preserved; confirmed Agreement overlap is now a hard CALENDAR_CONFLICT. Remaining known gaps are deep capability bonus, live resource override and routing provider.';

create or replace function public.rpc_get_worker_calendar(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_events jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'CALENDAR_RANGE_INVALID' using errcode = '22023';
  end if;

  select p.id into v_profile_id
  from public.app_profiles p
  where p.account_id = v_uid and p.kind = 'WORKER';

  if v_profile_id is null then
    return jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'events', '[]'::jsonb,
      'authoritative', true
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'eventId', e.id,
        'agreementId', e.agreement_id,
        'agreementVersion', e.agreement_version,
        'startsAt', e.starts_at,
        'endsAt', e.ends_at,
        'agreementStatus', e.agreement_status,
        'source', 'AGREEMENT'
      ) order by e.starts_at, e.ends_at, e.id
    ),
    '[]'::jsonb
  ) into v_events
  from private.worker_calendar_events e
  where e.worker_account_id = v_uid
    and e.worker_profile_id = v_profile_id
    and e.state = 'BLOCKING'
    and e.starts_at < p_to
    and e.ends_at > p_from;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'events', v_events,
    'authoritative', true
  );
end;
$function$;

revoke all on function public.rpc_get_worker_calendar(timestamptz,timestamptz)
  from public, anon, service_role;
grant execute on function public.rpc_get_worker_calendar(timestamptz,timestamptz)
  to authenticated;

-- Structural postconditions. Runtime overlap, lifecycle and concurrency proofs
-- are performed on a disposable database before integration.
do $postflight$
begin
  if to_regclass('private.worker_calendar_events') is null
     or to_regprocedure('private.worker_calendar_conflict(uuid,timestamptz,timestamptz,uuid)') is null
     or to_regprocedure('private.refresh_worker_calendar_event(uuid)') is null
     or to_regprocedure('private.match_detail_without_calendar(uuid,uuid)') is null
     or to_regprocedure('public.rpc_get_worker_calendar(timestamptz,timestamptz)') is null then
    raise exception 'W02_CALENDAR_POSTFLIGHT_MISSING';
  end if;
  if has_table_privilege('authenticated', 'private.worker_calendar_events', 'SELECT')
     or has_table_privilege('authenticated', 'private.worker_calendar_events', 'INSERT')
     or has_table_privilege('authenticated', 'private.worker_calendar_events', 'UPDATE')
     or has_table_privilege('authenticated', 'private.worker_calendar_events', 'DELETE') then
    raise exception 'W02_CALENDAR_DIRECT_CLIENT_TABLE_ACCESS';
  end if;
  if not has_function_privilege(
       'authenticated',
       'public.rpc_get_worker_calendar(timestamptz,timestamptz)',
       'EXECUTE'
     ) then
    raise exception 'W02_CALENDAR_READ_RPC_NOT_GRANTED';
  end if;
end;
$postflight$;

commit;
