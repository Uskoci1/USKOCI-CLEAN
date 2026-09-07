-- N08 validated owner notification preferences. DISPOSABLE CANDIDATE, NOT LIVE.
-- Reuse the existing table and event engine; never opt in, backfill or dispatch.
begin;
lock table public.notification_preferences in share row exclusive mode;
do $guard$
begin
  if (select md5(prosrc) from pg_proc where oid=
      to_regprocedure('private.in_quiet_hours(public.notification_preferences)'))
       is distinct from '386e00eb4a7645addffac95fde09bea7'
     or (select md5(prosrc) from pg_proc where oid=
      to_regprocedure('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)'))
       is distinct from '8da91a4736e09b10872bd1240d6e0c8c'
     or (select md5(prosrc) from pg_proc where oid=
      to_regprocedure('public.rpc_send_agreement_message(uuid,text)'))
       is distinct from 'd9a3733814e3101a3941284c07dc2bed'
     or (select count(*) from pg_attribute where attrelid='public.notification_preferences'::regclass
          and attnum>0 and not attisdropped)<>16
     or exists(select 1 from pg_trigger where tgrelid='public.notification_preferences'::regclass and not tgisinternal)
     or to_regprocedure('public.rpc_get_notification_preferences(text)') is not null
     or to_regprocedure('public.rpc_set_notification_preferences(text,jsonb,bigint)') is not null
     or to_regprocedure('public.rpc_get_notification_preferences(uuid,text)') is not null
     or to_regprocedure('public.rpc_set_notification_preferences(uuid,text,jsonb,bigint)') is not null then
    raise exception 'N08_PREDECESSOR_MISMATCH';
  end if;
  -- Never silently repair a legacy row or apply only part of this boundary.
  if exists(select 1 from public.notification_preferences p
     where not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=p.quiet_timezone)
        or (p.quiet_hours_enabled and (p.quiet_start is null or p.quiet_end is null))
        or p.quiet_start>=time '24:00' or p.quiet_end>=time '24:00') then
    raise exception 'N08_EXISTING_INVALID_PREFERENCES';
  end if;
end
$guard$;

alter table public.notification_preferences
  add column revision bigint not null default 0 check(revision>=0),
  add constraint notification_quiet_times_complete check
    (not quiet_hours_enabled or (quiet_start is not null and quiet_end is not null)),
  add constraint notification_quiet_times_bounds check
    ((quiet_start is null or quiet_start<time '24:00') and
     (quiet_end is null or quiet_end<time '24:00'));

create function private.notification_preferences_write_guard()
returns trigger language plpgsql set search_path=pg_catalog
as $trigger$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=new.quiet_timezone)
     or (new.quiet_hours_enabled and (new.quiet_start is null or new.quiet_end is null))
     or new.quiet_start>=time '24:00' or new.quiet_end>=time '24:00' then
    raise exception 'INVALID_NOTIFICATION_PREFERENCES' using errcode='22023';
  end if;
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id or new.role_context is distinct from old.role_context then
      raise exception 'NOTIFICATION_PREFERENCES_OWNER_IMMUTABLE' using errcode='22023';
    end if;
    if old.revision=9223372036854775807 then
      raise exception 'NOTIFICATION_PREFERENCES_REVISION_EXHAUSTED' using errcode='22003';
    end if;
    new.revision:=old.revision+1;
  else
    new.revision:=1;
  end if;
  new.updated_at:=statement_timestamp();
  return new;
end
$trigger$;
create trigger notification_preferences_guard before insert or update
on public.notification_preferences for each row execute function private.notification_preferences_write_guard();

-- The complete canonical payload is explicit: future table columns never leak
-- into the client projection or silently become part of retry equality.
create function private.notification_preferences_settings(p public.notification_preferences)
returns jsonb language sql immutable set search_path=pg_catalog
as $settings$
  select jsonb_build_object(
    'in_app_enabled',p.in_app_enabled,'push_enabled',p.push_enabled,
    'opportunities_enabled',p.opportunities_enabled,'responses_enabled',p.responses_enabled,
    'dogovor_enabled',p.dogovor_enabled,'execution_enabled',p.execution_enabled,
    'recovery_enabled',p.recovery_enabled,'account_enabled',p.account_enabled,
    'quiet_hours_enabled',p.quiet_hours_enabled,'quiet_start',p.quiet_start,'quiet_end',p.quiet_end,
    'quiet_timezone',p.quiet_timezone,'urgent_overrides_quiet_hours',p.urgent_overrides_quiet_hours);
$settings$;

create function public.rpc_get_notification_preferences(p_expected_user_id uuid,p_role text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $read$
declare v_uid uuid:=auth.uid(); d public.notification_preferences%rowtype; v_exists boolean:=true;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_expected_user_id is null or p_expected_user_id<>v_uid then
    raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
  if p_role is null or p_role not in ('REQUESTER','WORKER') then
    raise exception 'INVALID_NOTIFICATION_ROLE' using errcode='22023'; end if;
  select * into d from public.notification_preferences where user_id=v_uid and role_context=p_role;
  if not found then
    v_exists:=false;
    -- An absent row is revision0, with the existing emitter defaults. Reading
    -- never inserts a row and never acquires transport permission.
    d:=jsonb_populate_record(null::public.notification_preferences,
      '{"revision":0,"in_app_enabled":true,"push_enabled":false,"opportunities_enabled":true,
        "responses_enabled":true,"dogovor_enabled":true,"execution_enabled":true,
        "recovery_enabled":true,"account_enabled":true,"quiet_hours_enabled":false,
        "quiet_start":null,"quiet_end":null,"quiet_timezone":"Europe/Belgrade",
        "urgent_overrides_quiet_hours":false}'::jsonb);
    d.role_context:=p_role;
  end if;
  return jsonb_build_object('userId',v_uid,'exists',v_exists,'roleContext',d.role_context,'revision',d.revision,
    'updatedAt',d.updated_at,'settings',private.notification_preferences_settings(d));
end
$read$;

create function public.rpc_set_notification_preferences(p_expected_user_id uuid,p_role text,p_settings jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $write$
declare
  v_uid uuid:=auth.uid(); d public.notification_preferences%rowtype;
  wanted public.notification_preferences%rowtype; k text; v_canonical jsonb;
  v_keys constant text[]:=array['in_app_enabled','push_enabled','opportunities_enabled','responses_enabled',
    'dogovor_enabled','execution_enabled','recovery_enabled','account_enabled','quiet_hours_enabled',
    'quiet_start','quiet_end','quiet_timezone','urgent_overrides_quiet_hours'];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  -- The mobile request captures its initiating account. A later token switch
  -- must fail here, before reads, locks or writes under the new authenticated user.
  if p_expected_user_id is null or p_expected_user_id<>v_uid then
    raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
  if p_role is null or p_role not in ('REQUESTER','WORKER') then
    raise exception 'INVALID_NOTIFICATION_ROLE' using errcode='22023'; end if;
  if p_expected_revision is null or p_expected_revision<0 or p_expected_revision=9223372036854775807
     or p_settings is null or jsonb_typeof(p_settings)<>'object' then
    raise exception 'INVALID_NOTIFICATION_PREFERENCES' using errcode='22023'; end if;
  if not (p_settings ?& v_keys) or exists(select 1 from jsonb_object_keys(p_settings) x where not(x=any(v_keys))) then
    raise exception 'INVALID_NOTIFICATION_PREFERENCES' using errcode='22023'; end if;
  foreach k in array v_keys loop
    if k in ('quiet_start','quiet_end') then
      if jsonb_typeof(p_settings->k) not in ('null','string')
         or (jsonb_typeof(p_settings->k)='string' and
           (p_settings->>k) !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?$') then
        raise exception 'INVALID_NOTIFICATION_PREFERENCES' using errcode='22023'; end if;
    elsif k='quiet_timezone' then
      if jsonb_typeof(p_settings->k)<>'string'
         or not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=p_settings->>k) then
        raise exception 'INVALID_NOTIFICATION_PREFERENCES' using errcode='22023'; end if;
    elsif jsonb_typeof(p_settings->k)<>'boolean' then
      raise exception 'INVALID_NOTIFICATION_PREFERENCES' using errcode='22023';
    end if;
  end loop;
  wanted:=jsonb_populate_record(null::public.notification_preferences,p_settings);
  if wanted.quiet_hours_enabled and (wanted.quiet_start is null or wanted.quiet_end is null) then
    raise exception 'INVALID_NOTIFICATION_PREFERENCES' using errcode='22023'; end if;
  v_canonical:=private.notification_preferences_settings(wanted);
  -- Serialize missing-row first writes as well as updates for this owner/role.
  -- No token, account switch, event, provider call or unrelated row is touched.
  perform pg_advisory_xact_lock(hashtextextended('uskoci:notification-prefs:'||v_uid::text||':'||p_role,0));
  select * into d from public.notification_preferences where user_id=v_uid and role_context=p_role for update;
  if found then
    if d.revision=p_expected_revision+1 and private.notification_preferences_settings(d)=v_canonical then
      return jsonb_build_object('userId',v_uid,'exists',true,'roleContext',d.role_context,'revision',d.revision,
        'updatedAt',d.updated_at,'settings',v_canonical);
    end if;
    if d.revision<>p_expected_revision then
      raise exception 'NOTIFICATION_PREFERENCES_REVISION_CONFLICT' using errcode='40001'; end if;
    update public.notification_preferences set
      in_app_enabled=wanted.in_app_enabled,push_enabled=wanted.push_enabled,
      opportunities_enabled=wanted.opportunities_enabled,responses_enabled=wanted.responses_enabled,
      dogovor_enabled=wanted.dogovor_enabled,execution_enabled=wanted.execution_enabled,
      recovery_enabled=wanted.recovery_enabled,account_enabled=wanted.account_enabled,
      quiet_hours_enabled=wanted.quiet_hours_enabled,quiet_start=wanted.quiet_start,quiet_end=wanted.quiet_end,
      quiet_timezone=wanted.quiet_timezone,urgent_overrides_quiet_hours=wanted.urgent_overrides_quiet_hours
    where user_id=v_uid and role_context=p_role returning * into d;
  else
    if p_expected_revision<>0 then
      raise exception 'NOTIFICATION_PREFERENCES_REVISION_CONFLICT' using errcode='40001'; end if;
    insert into public.notification_preferences(user_id,role_context,in_app_enabled,push_enabled,
      opportunities_enabled,responses_enabled,dogovor_enabled,execution_enabled,recovery_enabled,account_enabled,
      quiet_hours_enabled,quiet_start,quiet_end,quiet_timezone,urgent_overrides_quiet_hours)
    values(v_uid,p_role,wanted.in_app_enabled,wanted.push_enabled,wanted.opportunities_enabled,wanted.responses_enabled,
      wanted.dogovor_enabled,wanted.execution_enabled,wanted.recovery_enabled,wanted.account_enabled,
      wanted.quiet_hours_enabled,wanted.quiet_start,wanted.quiet_end,wanted.quiet_timezone,wanted.urgent_overrides_quiet_hours)
    on conflict(user_id,role_context) do nothing returning * into d;
    if not found then -- A concurrent trusted insert cannot be overwritten.
      raise exception 'NOTIFICATION_PREFERENCES_REVISION_CONFLICT' using errcode='40001'; end if;
  end if;
  return jsonb_build_object('userId',v_uid,'exists',true,'roleContext',d.role_context,'revision',d.revision,
    'updatedAt',d.updated_at,'settings',private.notification_preferences_settings(d));
end
$write$;

drop policy if exists prefs_own on public.notification_preferences;
create policy notification_preferences_owner_read on public.notification_preferences
for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.notification_preferences from public,anon,authenticated,service_role;
grant select on public.notification_preferences to authenticated;
-- Service writers also pass invariants and monotonic revision trigger. An opt-
-- out is an update, never a deletion that resets the first-write CAS boundary.
grant select,insert,update on public.notification_preferences to service_role;
revoke all on function private.notification_preferences_write_guard() from public,anon,authenticated,service_role;
revoke all on function private.notification_preferences_settings(public.notification_preferences) from public,anon,authenticated,service_role;
revoke all on function public.rpc_get_notification_preferences(uuid,text) from public,anon,service_role;
revoke all on function public.rpc_set_notification_preferences(uuid,text,jsonb,bigint) from public,anon,service_role;
grant execute on function public.rpc_get_notification_preferences(uuid,text) to authenticated;
grant execute on function public.rpc_set_notification_preferences(uuid,text,jsonb,bigint) to authenticated;
commit;
