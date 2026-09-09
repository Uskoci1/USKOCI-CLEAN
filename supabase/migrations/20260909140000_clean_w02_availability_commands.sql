-- W02 remainder: one owner-controlled editor over the existing availability tables.
-- No booking model, geocoder, price, policy activation or profile activation is added.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('private.worker_calendar_events') is null
    or to_regclass('public.profile_availability_rules') is null
    or to_regclass('public.profile_availability_windows') is null
    or to_regclass('public.worker_match_preferences') is null then
    raise exception 'W02_AVAILABILITY_PREDECESSOR_MISSING';
  end if;
end;
$preflight$;

create function private.availability_timezone_valid(value text)
returns boolean language sql stable set search_path=pg_catalog
as $function$
  select value is not null and length(value)<=100
    and (value='UTC' or position('/' in value)>0)
    and value not like 'posix/%' and value not like 'right/%'
    and exists(select 1 from pg_catalog.pg_timezone_names z where z.name=value);
$function$;
revoke all on function private.availability_timezone_valid(text) from public,anon,authenticated,service_role;

-- A content revision avoids a competing mutable settings table. A single SQL
-- snapshot reads all sources; ordering and UTC formatting make its identity stable.
create function private.worker_availability_document(pid uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
set timezone='UTC' set datestyle='ISO, YMD'
as $function$
  with material as (
    select jsonb_build_object('profileId',p.id,'accountId',p.account_id,
      'timezone',coalesce(pref.timezone,'Europe/Belgrade'),'availableNow',p.available_now,
      'rules',coalesce((select jsonb_agg(jsonb_build_object(
        'id',r.id,'weekdays',r.weekdays,'startTime',r.start_time::text,'endTime',r.end_time::text,
        'startsOn',r.starts_on::text,'endsOn',r.ends_on::text,'label',r.label,'active',r.active)
        order by r.id) from public.profile_availability_rules r where r.profile_id=p.id),'[]'::jsonb),
      'windows',coalesce((select jsonb_agg(jsonb_build_object(
        'id',w.id,'startsAt',to_char(w.starts_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'endsAt',to_char(w.ends_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'state',w.availability_state,'label',w.label) order by w.id)
        from public.profile_availability_windows w where w.profile_id=p.id),'[]'::jsonb)) as doc
    from public.app_profiles p left join public.worker_match_preferences pref on pref.worker_profile_id=p.id
    where p.id=pid and p.kind='WORKER'
  ) select doc||jsonb_build_object('revision',encode(extensions.digest(doc::text,'sha256'),'hex')) from material;
$function$;
revoke all on function private.worker_availability_document(uuid) from public,anon,authenticated,service_role;

create function public.rpc_get_worker_availability()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $function$
declare pid uuid; status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select p.id,p.profile_status into pid,status from public.app_profiles p
    where p.account_id=auth.uid() and p.kind='WORKER';
  if pid is null then raise exception 'WORKER_PROFILE_REQUIRED' using errcode='55000'; end if;
  if status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  return private.worker_availability_document(pid);
end;
$function$;
revoke all on function public.rpc_get_worker_availability() from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_worker_availability() to authenticated;

-- Direct legacy profile editing still owns its existing toggle. It cannot
-- resurrect expiry or use that toggle while the profile is restricted.
create function private.guard_persistent_availability()
returns trigger language plpgsql set search_path=pg_catalog
as $function$
begin
  new.available_now_expires_at:=null;
  if new.kind='WORKER' and new.profile_status not in ('DRAFT','ACTIVE') then new.available_now:=false; end if;
  return new;
end;
$function$;
revoke all on function private.guard_persistent_availability() from public,anon,authenticated,service_role;
create trigger z_w02_persistent_availability before insert or update on public.app_profiles
  for each row execute function private.guard_persistent_availability();

-- Serialize preference changes against the same profile row used by the editor.
-- Existing coarse-location columns and existing cross-owner guard stay intact.
create function private.guard_availability_timezone()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $function$
declare p public.app_profiles;
begin
  select * into p from public.app_profiles where id=new.worker_profile_id for update;
  if not found or p.kind<>'WORKER' or p.account_id<>new.worker_account_id then
    raise exception 'WORKER_PROFILE_REQUIRED' using errcode='42501';
  end if;
  if not private.availability_timezone_valid(new.timezone) then
    raise exception 'AVAILABILITY_TIMEZONE_INVALID' using errcode='22023';
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_availability_timezone() from public,anon,authenticated,service_role;
create trigger w02_availability_timezone before insert or update on public.worker_match_preferences
  for each row execute function private.guard_availability_timezone();

-- The new editor is the only unprivileged write path for rules/windows. Existing
-- owner SELECT/RLS remains; Agreement rows live elsewhere and cannot be edited.
revoke insert,update,delete on public.profile_availability_rules,public.profile_availability_windows from authenticated;
revoke all on public.profile_availability_rules,public.profile_availability_windows from anon;

create function public.rpc_save_worker_availability(p_expected_revision text,p_value jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
set timezone='UTC' set datestyle='ISO, YMD'
as $function$
declare
  p public.app_profiles; before_doc jsonb; after_doc jsonb; wanted jsonb;
  item jsonb; wid uuid; days smallint[]; a time; b time; sd date; ed date;
  ws timestamptz; we timestamptz; rule_ids uuid[]:='{}'; window_ids uuid[]:='{}';
  rules jsonb:='[]'; windows jsonb:='[]'; zone text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
  if not found then raise exception 'WORKER_PROFILE_REQUIRED' using errcode='55000'; end if;
  if p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text)>262144 then
    raise exception 'AVAILABILITY_INPUT_INVALID' using errcode='22023';
  end if;
  if p_value-ARRAY['timezone','availableNow','rules','windows']<>'{}'::jsonb
    or jsonb_typeof(p_value->'availableNow') is distinct from 'boolean'
    or jsonb_typeof(p_value->'timezone') is distinct from 'string'
    or jsonb_typeof(p_value->'rules') is distinct from 'array'
    or jsonb_typeof(p_value->'windows') is distinct from 'array' then
    raise exception 'AVAILABILITY_INPUT_INVALID' using errcode='22023';
  end if;
  zone:=p_value->>'timezone';
  if not private.availability_timezone_valid(zone) then raise exception 'AVAILABILITY_TIMEZONE_INVALID' using errcode='22023'; end if;
  -- Transport/compute safety ceilings, not booking capacity or dispatch policy.
  if jsonb_array_length(p_value->'rules')>128 or jsonb_array_length(p_value->'windows')>512 then
    raise exception 'AVAILABILITY_INPUT_TOO_LARGE' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_value->'rules') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item-ARRAY['id','weekdays','startTime','endTime','startsOn','endsOn','label','active']<>'{}'::jsonb
      or jsonb_typeof(item->'id') is distinct from 'string'
      or (item->>'id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      or jsonb_typeof(item->'weekdays') is distinct from 'array'
      or jsonb_typeof(item->'active') is distinct from 'boolean'
      or jsonb_typeof(item->'label') is distinct from 'string' or length(item->>'label')>256
      or coalesce(item->>'startTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?$'
      or coalesce(item->>'endTime','') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?|24:00(:00)?)$'
      or coalesce(item->>'startsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or not (item?'endsOn') or (item->'endsOn'<>'null'::jsonb and coalesce(item->>'endsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
      raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_array_elements(item->'weekdays') d where jsonb_typeof(d)<>'number' or d::text !~ '^[0-6]$') then
      raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023';
    end if;
    select array_agg(d::text::smallint order by d::text::smallint) into days from jsonb_array_elements(item->'weekdays') d;
    if coalesce(cardinality(days),0) not between 1 and 7 or cardinality(days)<>(select count(distinct x) from unnest(days) x) then
      raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023';
    end if;
    begin
      wid:=(item->>'id')::uuid; a:=(item->>'startTime')::time; b:=(item->>'endTime')::time;
      sd:=(item->>'startsOn')::date; ed:=(item->>'endsOn')::date;
    exception when invalid_datetime_format or datetime_field_overflow then raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023'; end;
    if a>=b or not isfinite(sd) or (ed is not null and (not isfinite(ed) or ed<sd)) or wid=any(rule_ids)
      or exists(select 1 from public.profile_availability_rules r where r.id=wid and r.profile_id<>p.id) then
      raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023';
    end if;
    rule_ids:=array_append(rule_ids,wid);
    rules:=rules||jsonb_build_array(jsonb_build_object('id',wid,'weekdays',days,'startTime',a::text,'endTime',b::text,
      'startsOn',sd::text,'endsOn',ed::text,'label',item->>'label','active',(item->>'active')::boolean));
  end loop;
  for item in select value from jsonb_array_elements(p_value->'windows') loop
    if jsonb_typeof(item) is distinct from 'object' or item-ARRAY['id','startsAt','endsAt','state','label']<>'{}'::jsonb
      or jsonb_typeof(item->'id') is distinct from 'string'
      or (item->>'id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      or jsonb_typeof(item->'label') is distinct from 'string' or length(item->>'label')>256
      or coalesce(item->>'state','') not in ('AVAILABLE','UNAVAILABLE')
      or coalesce(item->>'startsAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-](0[0-9]|1[0-5]):[0-5][0-9])$'
      or coalesce(item->>'endsAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-](0[0-9]|1[0-5]):[0-5][0-9])$' then
      raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023';
    end if;
    begin wid:=(item->>'id')::uuid; ws:=(item->>'startsAt')::timestamptz; we:=(item->>'endsAt')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023'; end;
    if not isfinite(ws) or not isfinite(we) or ws>=we or wid=any(window_ids)
      or exists(select 1 from public.profile_availability_windows w where w.id=wid and w.profile_id<>p.id) then
      raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023';
    end if;
    window_ids:=array_append(window_ids,wid);
    windows:=windows||jsonb_build_array(jsonb_build_object('id',wid,
      'startsAt',to_char(ws,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'endsAt',to_char(we,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'state',item->>'state','label',item->>'label'));
  end loop;
  select coalesce(jsonb_agg(x order by x->>'id'),'[]'::jsonb) into rules from jsonb_array_elements(rules) x;
  select coalesce(jsonb_agg(x order by x->>'id'),'[]'::jsonb) into windows from jsonb_array_elements(windows) x;
  wanted:=jsonb_build_object('profileId',p.id,'accountId',p.account_id,'timezone',zone,
    'availableNow',(p_value->>'availableNow')::boolean,'rules',rules,'windows',windows);
  before_doc:=private.worker_availability_document(p.id);
  -- A lost response may be safely retried: an already-identical result performs
  -- no writes. A stale different document must never erase newer edits.
  if before_doc-'revision'=wanted then
    return jsonb_build_object('saved',true,'idempotentReplay',true,'availability',before_doc);
  end if;
  if before_doc->>'revision'<>p_expected_revision then raise exception 'AVAILABILITY_VERSION_CONFLICT' using errcode='40001'; end if;
  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,timezone)
    values(p.id,p.account_id,zone) on conflict(worker_profile_id) do update set timezone=excluded.timezone;
  update public.app_profiles set available_now=(p_value->>'availableNow')::boolean where id=p.id;
  delete from public.profile_availability_rules where profile_id=p.id and not(id=any(rule_ids));
  delete from public.profile_availability_windows where profile_id=p.id and not(id=any(window_ids));
  for item in select value from jsonb_array_elements(rules) loop
    insert into public.profile_availability_rules(id,profile_id,weekdays,start_time,end_time,starts_on,ends_on,label,active)
      values((item->>'id')::uuid,p.id,ARRAY(select x::text::smallint from jsonb_array_elements(item->'weekdays') x),
        (item->>'startTime')::time,(item->>'endTime')::time,(item->>'startsOn')::date,(item->>'endsOn')::date,item->>'label',(item->>'active')::boolean)
      on conflict(id) do update set weekdays=excluded.weekdays,start_time=excluded.start_time,end_time=excluded.end_time,
        starts_on=excluded.starts_on,ends_on=excluded.ends_on,label=excluded.label,active=excluded.active
      where public.profile_availability_rules.profile_id=p.id;
    if not found then raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023'; end if;
  end loop;
  for item in select value from jsonb_array_elements(windows) loop
    insert into public.profile_availability_windows(id,profile_id,starts_at,ends_at,availability_state,label)
      values((item->>'id')::uuid,p.id,(item->>'startsAt')::timestamptz,(item->>'endsAt')::timestamptz,item->>'state',item->>'label')
      on conflict(id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,availability_state=excluded.availability_state,label=excluded.label
      where public.profile_availability_windows.profile_id=p.id;
    if not found then raise exception 'AVAILABILITY_ITEM_INVALID' using errcode='22023'; end if;
  end loop;
  after_doc:=private.worker_availability_document(p.id);
  return jsonb_build_object('saved',true,'idempotentReplay',false,'availability',after_doc);
end;
$function$;
revoke all on function public.rpc_save_worker_availability(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rpc_save_worker_availability(text,jsonb) to authenticated;
comment on function public.rpc_save_worker_availability(text,jsonb) is
  'Owner-only atomic availability document over existing rules/windows and preferences. Content revision CAS, identical retry no-op. Not calendar occupancy or profile activation. Maximum128 rules/512 windows/256KiB input.';
commit;
