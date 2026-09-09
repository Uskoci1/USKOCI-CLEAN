-- Persistent live intent + future scheduled availability. No new bookings or push activation.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
  if to_regprocedure('public.rpc_save_worker_availability(text,jsonb)') is null
    or (select md5(prosrc) from pg_proc where oid='private.match_detail_without_calendar(uuid,uuid)'::regprocedure)
      is distinct from '599721689b8b89d2316f990231567b92'
    or (select md5(prosrc) from pg_proc where oid='private.dispatch_cheap_candidate_admitted(uuid,uuid)'::regprocedure)
      is distinct from '60806a6d33ae95f882f75d2d540a2603'
    or (select md5(prosrc) from pg_proc where oid='private.expire_lifecycle(timestamptz)'::regprocedure)
      is distinct from '3aba08b19f04bd19c06452bcd6e2e3a9' then
    raise exception 'W02_AVAILABILITY_MATCH_PREDECESSOR_CHANGED';
  end if;
end;
$preflight$;

-- Union explicit windows and each local weekly interval, then subtract personal
-- exceptions and authoritative Agreement occupancy. Adjacent intervals combine;
-- a gap never becomes availability. The current client need not have GPS access.
create function private.worker_available_periods(pid uuid,s timestamptz,e timestamptz,tz text)
returns tstzmultirange language plpgsql stable security definer set search_path=pg_catalog
as $function$
declare result tstzmultirange; blocked tstzmultirange; first_day date; last_day date;
begin
  if s is null or e is null or not isfinite(s) or not isfinite(e) or s>=e
    or not private.availability_timezone_valid(tz) then return '{}'::tstzmultirange; end if;
  first_day:=(s at time zone tz)::date; last_day:=(e at time zone tz)::date;
  -- Bound work for malformed/exceptionally broad search inputs, never allocate
  -- or deny an Agreement. Manual response/selection retains its own authority.
  if last_day-first_day>366 then return '{}'::tstzmultirange; end if;
  with days as (select first_day+i as d from generate_series(0,last_day-first_day) i),
  periods as (
    select w.starts_at as a,w.ends_at as b from public.profile_availability_windows w
      where w.profile_id=pid and w.availability_state='AVAILABLE' and w.starts_at<e and w.ends_at>s
    union all
    select (d+r.start_time) at time zone tz,(d+r.end_time) at time zone tz
      from days cross join public.profile_availability_rules r
      where r.profile_id=pid and r.active and extract(dow from d)::integer=any(r.weekdays)
        and r.starts_on<=d and (r.ends_on is null or r.ends_on>=d)
  ) select coalesce(range_agg(tstzrange(greatest(a,s),least(b,e),'[)')),'{}'::tstzmultirange)
      into result from periods where a<b and a<e and b>s;
  select coalesce(range_agg(tstzrange(greatest(a,s),least(b,e),'[)')),'{}'::tstzmultirange)
    into blocked from (
      select w.starts_at as a,w.ends_at as b from public.profile_availability_windows w
        where w.profile_id=pid and w.availability_state='UNAVAILABLE' and w.starts_at<e and w.ends_at>s
      union all
      select c.starts_at,c.ends_at from private.worker_calendar_events c
        where c.worker_profile_id=pid and c.state='BLOCKING' and c.starts_at<e and c.ends_at>s
    ) b;
  return result-blocked;
end;
$function$;
revoke all on function private.worker_available_periods(uuid,timestamptz,timestamptz,text) from public,anon,authenticated,service_role;

create or replace function private.schedule_fit(pid uuid,s timestamptz,e timestamptz,tz text)
returns boolean language plpgsql stable security definer set search_path=pg_catalog
as $function$
declare live_now boolean; at_now timestamptz:=statement_timestamp();
begin
  if s is null or e is null then return true; end if;
  if not isfinite(s) or not isfinite(e) or s>=e or not private.availability_timezone_valid(tz) then return false; end if;
  if private.worker_calendar_conflict(pid,s,e,null) or exists(
    select 1 from public.profile_availability_windows w where w.profile_id=pid and w.availability_state='UNAVAILABLE'
      and w.starts_at<e and w.ends_at>s) then return false; end if;
  select available_now into live_now from public.app_profiles where id=pid and kind='WORKER' and profile_status='ACTIVE';
  -- Live intent means now, not an invented expiry or arbitrary lead-time. Future
  -- exact appointments must fit the stored weekly/windows schedule even when ON.
  if coalesce(live_now,false) and s<=at_now and at_now<e then return true; end if;
  return private.worker_available_periods(pid,s,e,tz) @> tstzrange(s,e,'[)');
end;
$function$;
revoke all on function private.schedule_fit(uuid,timestamptz,timestamptz,text) from public,anon,authenticated,service_role;

create function private.availability_is_future(kind text,s timestamptz,e timestamptz,at_now timestamptz)
returns boolean language sql immutable set search_path=pg_catalog
as $function$
  select coalesce(isfinite(s) and isfinite(e) and s<e and e>at_now
    and (s>at_now or kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE')),false);
$function$;
revoke all on function private.availability_is_future(text,timestamptz,timestamptz,timestamptz) from public,anon,authenticated,service_role;

create function private.worker_dispatch_time_admitted(nid uuid,pid uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog
as $function$
declare n public.needs; p public.app_profiles; tz text; at_now timestamptz:=statement_timestamp(); periods tstzmultirange;
begin
  select * into n from public.needs where id=nid;
  if not found then return false; end if;
  select * into p from public.app_profiles where id=pid and kind='WORKER' and profile_status='ACTIVE';
  if not found then return false; end if;
  select timezone into tz from public.worker_match_preferences where worker_profile_id=pid;
  tz:=coalesce(tz,'Europe/Belgrade');
  if not private.availability_timezone_valid(tz) then return false; end if;
  if private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,at_now) then
    periods:=private.worker_available_periods(pid,greatest(n.starts_at,at_now),n.ends_at,tz);
    if n.schedule_kind='FIXED_WINDOW' then return periods @> tstzrange(n.starts_at,n.ends_at,'[)'); end if;
    -- A flexible search window needs some real available time, not the whole
    -- day/week. It never reserves this window or invents an estimated duration.
    return periods<>'{}'::tstzmultirange;
  end if;
  if n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') or
    (n.ends_at is not null and n.ends_at<=at_now) then return false; end if;
  if not p.available_now then return false; end if;
  if exists(select 1 from public.profile_availability_windows w where w.profile_id=pid
    and w.availability_state='UNAVAILABLE' and w.starts_at<=at_now and w.ends_at>at_now)
    or exists(select 1 from private.worker_calendar_events c where c.worker_profile_id=pid
      and c.state='BLOCKING' and c.starts_at<=at_now and c.ends_at>at_now) then return false; end if;
  if n.schedule_kind='FIXED_WINDOW' then return private.schedule_fit(pid,n.starts_at,n.ends_at,tz); end if;
  return true;
end;
$function$;
revoke all on function private.worker_dispatch_time_admitted(uuid,uuid) from public,anon,authenticated,service_role;

-- Patch only the three fingerprinted availability consumers, retaining every
-- other skill/radius/fee/quiet-hours/safety/selection/lifecycle rule verbatim.
do $patch$
declare def text; anchor text; replacement text; signature regprocedure;
begin
  signature:='private.match_detail_without_calendar(uuid,uuid)'::regprocedure;
  def:=pg_get_functiondef(signature);
  anchor:='  sched := private.schedule_fit(pid, n.starts_at, n.ends_at, tz);';
  replacement:='  sched := private.worker_dispatch_time_admitted(nid,pid);';
  if (length(def)-length(replace(def,anchor,'')))/length(anchor)<>1 then raise exception 'W02_AVAILABILITY_SCHEDULE_ANCHOR_CHANGED'; end if;
  def:=replace(def,anchor,replacement);
  anchor:=$code$  if not coalesce(p.available_now,false) then disp := array_append(disp,'CURRENT_AVAILABILITY_PAUSED');
  elsif p.available_now_expires_at is null or p.available_now_expires_at <= statement_timestamp()
    then disp := array_append(disp,'AVAILABILITY_FRESHNESS_EXPIRED'); end if;$code$;
  replacement:=$code$  if not coalesce(p.available_now,false)
    and not private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,statement_timestamp())
    then disp := array_append(disp,'CURRENT_AVAILABILITY_PAUSED'); end if;$code$;
  if (length(def)-length(replace(def,anchor,'')))/length(anchor)<>1 then raise exception 'W02_AVAILABILITY_MATCH_ANCHOR_CHANGED'; end if;
  execute replace(def,anchor,replacement);
  signature:='private.dispatch_cheap_candidate_admitted(uuid,uuid)'::regprocedure;
  def:=pg_get_functiondef(signature);
  anchor:=$code$      and p.available_now = true
      and p.available_now_expires_at > statement_timestamp()$code$;
  replacement:='      and private.worker_dispatch_time_admitted(nid,pid)';
  if (length(def)-length(replace(def,anchor,'')))/length(anchor)<>1 then raise exception 'W02_AVAILABILITY_CHEAP_ANCHOR_CHANGED'; end if;
  execute replace(def,anchor,replacement);
  signature:='private.expire_lifecycle(timestamptz)'::regprocedure;
  def:=pg_get_functiondef(signature);
  anchor:=$code$  update public.app_profiles
     set available_now = false
   where available_now = true
     and available_now_expires_at is not null
     and available_now_expires_at <= p_at;
  get diagnostics av = row_count;$code$;
  replacement:='  av := 0; -- Persistent owner intent has no automatic expiration.';
  if (length(def)-length(replace(def,anchor,'')))/length(anchor)<>1 then raise exception 'W02_AVAILABILITY_EXPIRY_ANCHOR_CHANGED'; end if;
  execute replace(def,anchor,replacement);
end;
$patch$;
-- Historical values may remain stored for provenance, but no consumer or writer
-- is permitted to use them as an activation requirement or automatic OFF timer.
comment on column public.app_profiles.available_now_expires_at is
  'Retired expiry metadata. Available-now persists until explicit OFF/account safety. Matching, dispatch and lifecycle ignore this column; new profile writes clear it.';
commit;
