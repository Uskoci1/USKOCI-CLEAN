-- RU-0 — WORKER PROFILE ACTIVATION AUTHORITY CLOSURE
--
-- Canonical intent:
-- - WORKER profiles start as DRAFT.
-- - ACTIVE is server-derived and may only be reached through
--   rpc_complete_worker_profile after the current minimum readiness checks.
-- - Existing business history is preserved; this migration never deletes a
--   profile, Response or Agreement.
--
-- Forward-only repair. Do not rewrite predecessor migrations.

alter table public.app_profiles
  alter column profile_status set default 'DRAFT';

create or replace function private.guard_profile_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  token text := current_setting('uskoci.profile_mutation', true);
begin
  if tg_op = 'INSERT' then
    -- Requester identity is immediately usable, while a WORKER profile must
    -- pass the explicit activation gate before marketplace participation.
    new.profile_status := case
      when new.kind = 'WORKER' then 'DRAFT'
      else 'ACTIVE'
    end;
    new.account_type := 'INDIVIDUAL';
    new.rating_requester := null;
    new.rating_worker := null;
    return new;
  end if;

  if token is null then
    if new.profile_status is distinct from old.profile_status then
      raise exception using errcode = '42501',
        message = 'PROFILE_STATUS_IS_SERVER_DERIVED';
    end if;
    if new.account_type is distinct from old.account_type then
      raise exception using errcode = '42501',
        message = 'ACCOUNT_TYPE_IS_SERVER_DERIVED';
    end if;
    if new.rating_requester is distinct from old.rating_requester then
      raise exception using errcode = '42501',
        message = 'RATING_REQUESTER_IS_SERVER_DERIVED';
    end if;
    if new.rating_worker is distinct from old.rating_worker then
      raise exception using errcode = '42501',
        message = 'RATING_WORKER_IS_SERVER_DERIVED';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_profile_write()
  from public, anon, authenticated;

-- Reconcile legacy rows that were marked ACTIVE by the old INSERT trigger even
-- though they do not satisfy the existing server-side activation minimum.
-- Relations remain untouched, so historical Responses/Agreements keep their
-- original profile foreign keys and remain readable.
do $ru0_reconcile$
begin
  perform set_config('uskoci.profile_mutation', 'RU0_RECONCILE', true);

  update public.app_profiles
     set profile_status = 'DRAFT'
   where kind = 'WORKER'
     and profile_status = 'ACTIVE'
     and not (
       char_length(btrim(display_name)) >= 2
       and char_length(btrim(city)) >= 2
       and cardinality(skills) >= 1
     );

  if exists (
    select 1
      from public.app_profiles
     where kind = 'WORKER'
       and profile_status = 'ACTIVE'
       and not (
         char_length(btrim(display_name)) >= 2
         and char_length(btrim(city)) >= 2
         and cardinality(skills) >= 1
       )
  ) then
    raise exception 'RU0_INCOMPLETE_ACTIVE_WORKER_REMAINS';
  end if;
end
$ru0_reconcile$;

create or replace function public.rpc_complete_worker_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.app_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select *
    into v_profile
    from public.app_profiles
   where id = p_profile_id
   for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile.account_id <> v_uid or v_profile.kind <> 'WORKER' then
    raise exception 'NOT_WORKER_PROFILE_OWNER' using errcode = '42501';
  end if;

  -- Replay-idempotent completion.
  if v_profile.profile_status = 'ACTIVE' then
    return;
  end if;
  if v_profile.profile_status = 'SUSPENDED' then
    raise exception 'PROFILE_SUSPENDED' using errcode = 'P0001';
  end if;
  if v_profile.profile_status = 'CLOSED' then
    raise exception 'PROFILE_CLOSED' using errcode = 'P0001';
  end if;
  if v_profile.profile_status <> 'DRAFT' then
    raise exception 'PROFILE_STATE_NOT_ACTIVATABLE' using errcode = 'P0001',
      detail = v_profile.profile_status;
  end if;

  if char_length(btrim(v_profile.display_name)) < 2 then
    raise exception 'DISPLAY_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(btrim(v_profile.city)) < 2 then
    raise exception 'CITY_REQUIRED' using errcode = 'P0001';
  end if;
  if cardinality(v_profile.skills) < 1 then
    raise exception 'SKILL_REQUIRED' using errcode = 'P0001';
  end if;

  perform set_config('uskoci.profile_mutation', 'ACTIVATE', true);

  update public.app_profiles
     set profile_status = 'ACTIVE'
   where id = p_profile_id;
end;
$function$;

revoke all on function public.rpc_complete_worker_profile(uuid)
  from public, anon;
grant execute on function public.rpc_complete_worker_profile(uuid)
  to authenticated;

comment on function public.rpc_complete_worker_profile(uuid) is
  'RU-0: owner-only DRAFT→ACTIVE worker activation after server-side readiness validation; replay-idempotent.';

-- Deployment assertions.
do $ru0_assert$
declare
  v_default text;
begin
  select column_default
    into v_default
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'app_profiles'
     and column_name = 'profile_status';

  if v_default is null or position('DRAFT' in v_default) = 0 then
    raise exception 'RU0_PROFILE_STATUS_DEFAULT_NOT_DRAFT';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.rpc_complete_worker_profile(uuid)',
    'EXECUTE'
  ) then
    raise exception 'RU0_ACTIVATION_RPC_NOT_EXECUTABLE';
  end if;
end
$ru0_assert$;
