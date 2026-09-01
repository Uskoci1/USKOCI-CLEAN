-- USKOCI clean build: authoritative parent Need completion closure.
-- Preserve the existing Response/Selection/Agreement contracts and add only the
-- missing aggregate lifecycle transition: completed seat coverage -> Need COMPLETED.

create or replace function private.guard_need_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
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
      new.revision := old.revision + 1;
    end if;
  elsif new.revision is distinct from old.revision then
    raise exception using errcode='22023', message='REVISION_BUMP_WITHOUT_MATERIAL_CHANGE';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_need_write() from public, anon, authenticated;

create or replace function private.sync_need_completion(p_need_id uuid)
returns boolean language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  n public.needs;
  v_completed_slots integer := 0;
begin
  select * into n
    from public.needs
   where id = p_need_id
   for update;

  if not found then
    return false;
  end if;

  if n.status = 'COMPLETED' then
    return true;
  end if;

  if n.status not in ('ACTIVE','SELECTION') then
    return false;
  end if;

  select coalesce(sum(s.covered_slots), 0)::integer
    into v_completed_slots
    from public.need_selections s
    join public.agreements a on a.selection_id = s.id
   where s.need_id = p_need_id
     and s.status = 'SELECTED'
     and a.status = 'COMPLETED';

  if v_completed_slots < n.required_slots then
    return false;
  end if;

  perform set_config('uskoci.need_lifecycle', 'COMPLETE', true);

  update public.needs
     set status = 'COMPLETED',
         updated_at = statement_timestamp()
   where id = p_need_id
     and status in ('ACTIVE','SELECTION');

  return found;
end;
$$;

revoke all on function private.sync_need_completion(uuid) from public, anon, authenticated;

comment on function private.sync_need_completion(uuid) is
  'Authoritative parent Need completion aggregator. A Need closes only when SELECTED seat coverage backed by COMPLETED Agreements reaches required_slots.';

create or replace function public.rpc_confirm_completion(p_agreement_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare uid uuid := auth.uid(); v_agr public.agreements%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select * into v_agr from public.agreements where id = p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_agr.requester_account_id <> uid then raise exception 'NOT_REQUESTER' using errcode = '42501'; end if;
  if v_agr.status = 'COMPLETED' then raise exception 'ALREADY_COMPLETED' using errcode = 'P0001'; end if;

  update public.agreements
     set status = 'COMPLETED', updated_at = statement_timestamp()
   where id = p_agreement_id;

  update public.agreement_execution
     set state = 'COMPLETED', completed_at = statement_timestamp(),
         requester_deadline_at = null, updated_at = statement_timestamp()
   where agreement_id = p_agreement_id;

  perform private.sync_need_completion(v_agr.need_id);
end;
$fn$;

revoke all on function public.rpc_confirm_completion(uuid) from public, anon;
grant execute on function public.rpc_confirm_completion(uuid) to authenticated;

create or replace function public.rpc_tick_auto_completion()
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer := 0;
  v_need_ids uuid[];
  v_need_id uuid;
begin
  with due as (
    select e.agreement_id
      from public.agreement_execution e
     where e.state = 'AWAITING_REQUESTER'
       and e.problem_opened_at is null
       and e.requester_deadline_at is not null
       and e.requester_deadline_at <= statement_timestamp()
  ), zatvoreni as (
    update public.agreement_execution e
       set state = 'COMPLETED',
           completed_at = statement_timestamp(),
           requester_deadline_at = null,
           updated_at = statement_timestamp()
      from due
     where e.agreement_id = due.agreement_id
    returning e.agreement_id
  ), zatvoreni_agreements as (
    update public.agreements a
       set status = 'COMPLETED', updated_at = statement_timestamp()
      from zatvoreni z
     where a.id = z.agreement_id
    returning a.need_id
  )
  select count(*)::integer, array_agg(distinct need_id)
    into v_count, v_need_ids
    from zatvoreni_agreements;

  if v_need_ids is not null then
    foreach v_need_id in array v_need_ids loop
      perform private.sync_need_completion(v_need_id);
    end loop;
  end if;

  return v_count;
end;
$fn$;

revoke all on function public.rpc_tick_auto_completion() from public, anon, authenticated;

comment on function public.rpc_tick_auto_completion() is
  'Server-only 48h completion tick. Completes due Agreements and synchronizes aggregate parent Need completion without client authority.';