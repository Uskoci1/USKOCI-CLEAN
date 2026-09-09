-- Owner decision 2026-09-09: only an agreed exact execution interval blocks
-- the WORKER. Flexible/day/week bounds are search preferences, never a booking.
-- The REQUESTER may schedule different workers for simultaneous tasks.
-- Forward-only; no rewrite of existing SQL, Agreement terms or Application hashes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('private.worker_calendar_serialization') is null
    or to_regprocedure('private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz)') is null
    or (select md5(prosrc) from pg_proc where oid='private.match_detail(uuid,uuid)'::regprocedure)
      is distinct from '8c77934a8e3f435b0a8ebccf7c19039f' then
    raise exception 'W02_FLEXIBLE_CALENDAR_PREDECESSOR_CHANGED';
  end if;
end;
$preflight$;

create or replace function private.match_detail(nid uuid,pid uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $function$
declare s timestamptz; e timestamptz;
begin
  -- A pair of timestamps alone is not evidence of a fixed appointment:
  -- FLEXIBLE/TODAY_FLEXIBLE/TOMORROW_FLEXIBLE/WEEK_FLEXIBLE can have both.
  select n.starts_at,n.ends_at into s,e from public.needs n
    where n.id=nid and n.schedule_kind='FIXED_WINDOW';
  if s is null or e is null then s:=null; e:=null; end if;
  return private.match_detail_for_calendar_interval(nid,pid,s,e);
end;
$function$;
revoke all on function private.match_detail(uuid,uuid) from public,anon,authenticated,service_role;

-- Submission/Selection already pass an explicit Application interval (or the
-- fixed Need interval) to match_detail_for_calendar_interval. Agreement changes
-- acquire the same worker fence and check their actual accepted terms. Preserve
-- those mutation guards: this only repairs the discovery/matching input.
comment on function private.match_detail(uuid,uuid) is
  'Need matching: only FIXED_WINDOW supplies a hard calendar interval. Flexible bounds do not book a day. Explicit Application/Agreement intervals remain worker-conflict protected; requester schedules are unrestricted.';

do $postflight$
begin
  if not (select prosecdef from pg_proc where oid='private.match_detail(uuid,uuid)'::regprocedure)
    or has_function_privilege('anon','private.match_detail(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','private.match_detail(uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','private.match_detail(uuid,uuid)','EXECUTE') then
    raise exception 'W02_FLEXIBLE_CALENDAR_SECURITY_FAILED';
  end if;
end;
$postflight$;
commit;
