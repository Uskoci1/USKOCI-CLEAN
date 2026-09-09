-- W02 follow-up: exact agreed intervals, immutable fixed-task snapshot, and
-- MVCC-aware per-worker serialization. Earlier migration bytes are preserved.
-- No production promotion or availability/provider/policy activation.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('private.worker_calendar_events') is null
     or to_regprocedure('private.match_detail_without_calendar(uuid,uuid)') is null then
    raise exception 'W02_INTERVAL_PREDECESSOR_MISSING';
  end if;
  if to_regclass('private.worker_calendar_serialization') is not null then
    raise exception 'W02_INTERVAL_ALREADY_EXISTS';
  end if;
  if (select md5(prosrc) from pg_proc where oid='private.refresh_worker_calendar_event(uuid)'::regprocedure)
       is distinct from 'd28563d5bbcd86ff70d1a706f9745fcf'
     or (select md5(prosrc) from pg_proc where oid='public.rpc_get_worker_calendar(timestamptz,timestamptz)'::regprocedure)
       is distinct from '279427d007028eb61f8d71e995145eb5'
     or (select md5(prosrc) from pg_proc where oid='public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure)
       is distinct from 'cbfb2334c51670017ef2cc102be04533'
     or (select md5(prosrc) from pg_proc where oid='public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'::regprocedure)
       is distinct from '79477cee02d7e7830571a308f28f2be4' then
    raise exception 'W02_INTERVAL_PREDECESSOR_CHANGED';
  end if;
  -- A mutable parent cannot be used to invent an old accepted execution time.
  -- Halt promotion for reconciliation rather than leaving such obligations free.
  if exists (
    select 1 from public.agreements a
    left join public.agreement_versions av on av.agreement_id=a.id and av.version=a.current_version
    join public.needs n on n.id=a.need_id
    where a.status='CONFIRMED' and (
      av.agreement_id is null or
      (n.schedule_kind='FIXED_WINDOW' and av.terms->>'proposed_start_at' is null
        and av.terms->>'proposed_end_at' is null)
    )
  ) then
    raise exception 'W02_LEGACY_INTERVAL_RECONCILIATION_REQUIRED';
  end if;
end;
$preflight$;

create function private.agreement_calendar_interval(p_terms jsonb)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer
set search_path = pg_catalog
as $function$
declare
  s text := p_terms->>'proposed_start_at';
  e text := p_terms->>'proposed_end_at';
  pattern text := '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-](0[0-9]|1[0-5]):[0-5][0-9])$';
begin
  if jsonb_typeof(p_terms) is distinct from 'object' then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  if s is null and e is null then
    return query select null::timestamptz,null::timestamptz;
    return;
  end if;
  if s is null or e is null or jsonb_typeof(p_terms->'proposed_start_at') <> 'string'
     or jsonb_typeof(p_terms->'proposed_end_at') <> 'string'
     or length(s)>32 or length(e)>32 or s !~ pattern or e !~ pattern then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  begin
    starts_at := s::timestamptz;
    ends_at := e::timestamptz;
  exception when datetime_field_overflow or invalid_datetime_format or invalid_parameter_value then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end;
  if not isfinite(starts_at) or not isfinite(ends_at) or starts_at>=ends_at then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  return next;
end;
$function$;
revoke all on function private.agreement_calendar_interval(jsonb) from public,anon,authenticated,service_role;

alter table private.worker_calendar_events add constraint worker_calendar_finite_range
  check (isfinite(starts_at) and isfinite(ends_at));

-- Technical serialization fence, NOT another calendar/data owner. A write to
-- this single worker row also forces a serialization failure when a caller uses
-- an old REPEATABLE READ snapshot. Advisory locks alone cannot refresh it.
create table private.worker_calendar_serialization (
  worker_profile_id uuid primary key references public.app_profiles(id) on delete cascade,
  touched_at timestamptz not null default statement_timestamp()
);
alter table private.worker_calendar_serialization enable row level security;
alter table private.worker_calendar_serialization force row level security;
revoke all on table private.worker_calendar_serialization from public,anon,authenticated,service_role;
insert into private.worker_calendar_serialization(worker_profile_id)
  select id from public.app_profiles where kind='WORKER';

create or replace function private.refresh_worker_calendar_event(p_agreement_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $function$
declare
  a public.agreements%rowtype;
  terms jsonb;
  interval_start timestamptz;
  interval_end timestamptz;
begin
  select ag.* into a from public.agreements ag where ag.id=p_agreement_id;
  if not found then return; end if; -- deletion cascades its projection
  select av.terms into terms from public.agreement_versions av
    where av.agreement_id=a.id and av.version=a.current_version;
  if not found then raise exception 'AGREEMENT_CALENDAR_VERSION_MISSING' using errcode='P0001'; end if;
  if not exists(select 1 from public.app_profiles p where p.id=a.worker_profile_id
    and p.account_id=a.worker_account_id and p.kind='WORKER') then
    raise exception 'AGREEMENT_CALENDAR_WORKER_MISMATCH' using errcode='P0001';
  end if;

  -- Always serialize acquisition, movement, cancellation and completion.
  -- The subsequent query gets a fresh READ COMMITTED snapshot; a stale higher
  -- isolation transaction must abort on the fence update, not double-book.
  insert into private.worker_calendar_serialization(worker_profile_id) values(a.worker_profile_id)
    on conflict(worker_profile_id) do update set touched_at=statement_timestamp();
  if a.status<>'CONFIRMED' then
    update private.worker_calendar_events set state='RELEASED',agreement_status=a.status,
      agreement_version=a.current_version,updated_at=statement_timestamp() where agreement_id=a.id;
    return;
  end if;

  select i.starts_at,i.ends_at into interval_start,interval_end
    from private.agreement_calendar_interval(terms) i;
  if interval_start is null then
    delete from private.worker_calendar_events where agreement_id=a.id;
    return;
  end if;
  -- A price/scope-only version must not invalidate legitimate grandfathered
  -- overlap. Only an unchanged existing interval qualifies for this exception.
  if not exists(select 1 from private.worker_calendar_events e where e.agreement_id=a.id
      and e.worker_profile_id=a.worker_profile_id and e.worker_account_id=a.worker_account_id
      and e.state='BLOCKING' and e.starts_at=interval_start and e.ends_at=interval_end)
     and private.worker_calendar_conflict(a.worker_profile_id,interval_start,interval_end,a.id) then
    raise exception 'WORKER_CALENDAR_CONFLICT' using errcode='P0001',detail='CALENDAR_CONFLICT';
  end if;
  insert into private.worker_calendar_events(agreement_id,worker_account_id,worker_profile_id,
    agreement_version,starts_at,ends_at,state,agreement_status)
  values(a.id,a.worker_account_id,a.worker_profile_id,a.current_version,interval_start,interval_end,'BLOCKING',a.status)
  on conflict(agreement_id) do update set worker_account_id=excluded.worker_account_id,
    worker_profile_id=excluded.worker_profile_id,agreement_version=excluded.agreement_version,
    starts_at=excluded.starts_at,ends_at=excluded.ends_at,state=excluded.state,
    agreement_status=excluded.agreement_status,updated_at=statement_timestamp();
end;
$function$;
revoke all on function private.refresh_worker_calendar_event(uuid) from public,anon,authenticated,service_role;

-- Interpret the calendar component using the interval under actual review.
-- The retained matcher still owns every other capability/availability rule.
create function private.match_detail_for_calendar_interval(nid uuid,pid uuid,s timestamptz,e timestamptz)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $function$
declare result jsonb; blockers jsonb;
begin
  if (s is null)<>(e is null) or (s is not null and (not isfinite(s) or not isfinite(e) or s>=e)) then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  result:=private.match_detail_without_calendar(nid,pid);
  if result is null or not private.worker_calendar_conflict(pid,s,e,null) then return result; end if;
  blockers:=coalesce(result->'hardBlockers','[]'::jsonb);
  if not (blockers @> '["CALENDAR_CONFLICT"]'::jsonb) then blockers:=blockers||'["CALENDAR_CONFLICT"]'::jsonb; end if;
  result:=jsonb_set(result,'{hardBlockers}',blockers,true);
  result:=jsonb_set(result,'{responseAllowed}','false'::jsonb,true);
  return jsonb_set(result,'{dispatchEligible}','false'::jsonb,true);
end;
$function$;
revoke all on function private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz)
  from public,anon,authenticated,service_role;

-- Keep public dispatch's established signature; explicit application proposals
-- use their own reviewed interval in the two mutation patches below.
create or replace function private.match_detail(nid uuid,pid uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $function$
declare s timestamptz; e timestamptz;
begin
  select n.starts_at,n.ends_at into s,e from public.needs n where n.id=nid;
  if s is null or e is null then s:=null; e:=null; end if;
  return private.match_detail_for_calendar_interval(nid,pid,s,e);
end;
$function$;
revoke all on function private.match_detail(uuid,uuid) from public,anon,authenticated,service_role;

-- Preserve all original lock/idempotency/fee/event behavior. Replace only the
-- calendar input and add a server-derived snapshot of the exact reviewed Need.
-- The selected Application hash remains its original immutable identity.
do $patch$
declare def text; anchor text; replacement text; signature regprocedure;
begin
  signature:='public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure;
  def:=pg_get_functiondef(signature);
  anchor:='  v_match := private.match_detail(p_need_id, v_resp.worker_profile_id);';
  replacement:=$code$  if (v_ver.proposed_start_at is null)<>(v_ver.proposed_end_at is null) then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
    and (v_need.starts_at is null or v_need.ends_at is null or not isfinite(v_need.starts_at)
      or not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, v_resp.worker_profile_id,
    coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.starts_at end),
    coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.ends_at end));$code$;
  if (length(def)-length(replace(def,anchor,'')))/length(anchor)<>1 then raise exception 'W02_SELECTION_MATCH_ANCHOR_CHANGED'; end if;
  def:=replace(def,anchor,replacement);
  anchor:=$code$    'proposed_start_at',v_ver.proposed_start_at,'proposed_end_at',v_ver.proposed_end_at,$code$;
  replacement:=$code$    'proposed_start_at',coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.starts_at end),
    'proposed_end_at',coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' then v_need.ends_at end),
    'schedule_source',case when v_ver.proposed_start_at is not null then 'APPLICATION_PROPOSAL'
      when v_need.schedule_kind='FIXED_WINDOW' then 'NEED_FIXED_WINDOW' else 'UNSCHEDULED' end,$code$;
  if (length(def)-length(replace(def,anchor,'')))/length(anchor)<>1 then raise exception 'W02_SELECTION_TERMS_ANCHOR_CHANGED'; end if;
  def:=replace(def,anchor,replacement);
  execute def;

  signature:='public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'::regprocedure;
  def:=pg_get_functiondef(signature);
  anchor:='  v_match := private.match_detail(p_need_id, p_worker_profile_id);';
  replacement:=$code$  if p_proposed_start_at is null and n.schedule_kind='FIXED_WINDOW'
    and (n.starts_at is null or n.ends_at is null or not isfinite(n.starts_at)
      or not isfinite(n.ends_at) or n.starts_at>=n.ends_at) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, p_worker_profile_id,
    coalesce(p_proposed_start_at,case when n.schedule_kind='FIXED_WINDOW' then n.starts_at end),
    coalesce(p_proposed_end_at,case when n.schedule_kind='FIXED_WINDOW' then n.ends_at end));$code$;
  if (length(def)-length(replace(def,anchor,'')))/length(anchor)<>1 then raise exception 'W02_APPLICATION_MATCH_ANCHOR_CHANGED'; end if;
  execute replace(def,anchor,replacement);

  signature:='public.rpc_get_worker_calendar(timestamptz,timestamptz)'::regprocedure;
  def:=pg_get_functiondef(signature);
  anchor:='p_from is null or p_to is null or p_from >= p_to';
  replacement:=anchor||' or not isfinite(p_from) or not isfinite(p_to)';
  if (length(def)-length(replace(def,anchor,'')))/length(anchor)<>1 then raise exception 'W02_READ_RANGE_ANCHOR_CHANGED'; end if;
  execute replace(def,anchor,replacement);
end;
$patch$;

-- Validate retained known intervals but never rewrite their immutable terms.
do $validate_existing$
declare r record;
begin
  for r in select av.terms from public.agreements a join public.agreement_versions av
    on av.agreement_id=a.id and av.version=a.current_version where a.status='CONFIRMED'
  loop perform * from private.agreement_calendar_interval(r.terms); end loop;
  if has_table_privilege('authenticated','private.worker_calendar_serialization','SELECT')
    or has_table_privilege('service_role','private.worker_calendar_serialization','UPDATE')
    or has_function_privilege('authenticated','private.agreement_calendar_interval(jsonb)','EXECUTE')
    or has_function_privilege('authenticated','private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz)','EXECUTE')
    or not has_function_privilege('authenticated','public.rpc_get_worker_calendar(timestamptz,timestamptz)','EXECUTE') then
    raise exception 'W02_INTERVAL_SECURITY_POSTCONDITION_FAILED';
  end if;
end;
$validate_existing$;

comment on table private.worker_calendar_serialization is
  'Internal per-worker MVCC serialization fence only. Agreement versions remain the sole source of booked intervals. No API access.';
comment on function private.refresh_worker_calendar_event(uuid) is
  'Agreement-owned finite calendar interval; serialized acquisition/movement/release including higher-isolation stale writes. Unchanged grandfathered overlap preserved.';
commit;
