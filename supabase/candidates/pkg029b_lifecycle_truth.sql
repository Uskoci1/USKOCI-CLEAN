-- PKG-029b candidate. Deep read 1.1, 7.49, 12.7, and the relative schedules found with 5.1. Owner approval
-- 2026-09-21: "dozvoljavam sve" to the command that also fixed what "danas", "sutra" and "ove nedelje" mean:
-- "danas" until midnight of the publication day, "sutra" until midnight of the next day, "ove nedelje" 7 days.
-- Contract/proof: docs/implementation/v5-ai-first/pkg029/PKG029_SERVER_ROUND.md
--
-- 1.1: sync_need_completion completes a task only when completed slots reach required_slots. Closing the remaining
--      search never lowers required_slots, so a task whose search was closed could never complete. Once the search
--      is closed, the task is complete when every selected person's Agreement is.
-- 7.49: rpc_list_my_applications reads an application as SELECTED whenever any Agreement names it, including a
--      cancelled one, so after a cancel "Moje prijave" showed it chosen, needing attention, at the top, forever.
-- 12.7: rpc_select_response decided remote or physical from the schedule (REMOTE_ANYTIME) instead of the place.
-- Relative schedules: TODAY_FLEXIBLE, TOMORROW_FLEXIBLE and WEEK_FLEXIBLE carry no date, and nothing ever expired
--      them; a "danas" task published on 2026-09-20 was still open the next day.
-- Function bodies and one new private function: the certified closure source digest must not move (asserted).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg029b_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg029b_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg029b_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if to_regprocedure('private.relative_schedule_end_v5(text,timestamptz,text)') is not null then
    raise exception 'PKG029B_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.sync_need_completion(uuid)', '22caab9e84bb10d7d2d8097c856579c6'),
    ('public.rpc_list_my_applications()', '6ce809c2939714451e60876ab3885115'),
    ('public.rpc_select_response(uuid,integer,uuid,integer,text,text)', '4178f4f158489beb3dec8b4a5cacdb0f'),
    ('private.expire_lifecycle(timestamptz)', '10da80e8677d3e806fbdb6c7444f3931')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG029B_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg029b_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG029B_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg029b_closure values (private.closure_source_digest_v5());
end
$pre$;

-- When a task with a relative schedule is over. The day is the task's own day, in its own timezone.
create function private.relative_schedule_end_v5(p_kind text, p_published_at timestamptz, p_timezone text)
returns timestamptz
language sql
stable
set search_path to 'pg_catalog'
as $function$
  select case
    when p_published_at is null then null
    when p_kind = 'TODAY_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone coalesce(p_timezone, 'Europe/Belgrade')) + interval '1 day')
           at time zone coalesce(p_timezone, 'Europe/Belgrade')
    when p_kind = 'TOMORROW_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone coalesce(p_timezone, 'Europe/Belgrade')) + interval '2 days')
           at time zone coalesce(p_timezone, 'Europe/Belgrade')
    when p_kind = 'WEEK_FLEXIBLE' then p_published_at + interval '7 days'
  end
$function$;
revoke all on function private.relative_schedule_end_v5(text,timestamptz,text) from public, anon, authenticated, service_role;
comment on function private.relative_schedule_end_v5(text,timestamptz,text) is
  'PKG-029b: "danas" ends at midnight of the publication day, "sutra" at midnight of the next, "ove nedelje" after 7 days.';

insert into pkg029b_patch values
(1, 'private.sync_need_completion(uuid)',
$a$  if v_completed_slots < n.required_slots then
    return false;
  end if;$a$,
$b$  -- PKG-029b (deep read 1.1): once the remaining search is closed, required_slots is never reached; the task is
  -- complete when everyone who was selected has completed.
  -- (The CASE is in parentheses: PL/pgSQL ends an IF condition at the first bare THEN.)
  if v_completed_slots < (case when n.remaining_search_closed_at is null then n.required_slots
       else (select coalesce(sum(s.covered_slots), 0)::integer from public.need_selections s
              where s.need_id = p_need_id and s.status = 'SELECTED') end)
     or v_completed_slots = 0 then
    return false;
  end if;$b$),
(2, 'public.rpc_list_my_applications()',
$a$        when o.agreement_id is not null or o.raw_response_status = 'SELECTED'
$a$,
$b$        -- PKG-029b (deep read 7.49): an application whose Agreement was cancelled is no longer chosen.
        when (o.agreement_id is not null and not exists (select 1 from public.agreements ag
                where ag.id = o.agreement_id and ag.status = 'CANCELLED'))
             or o.raw_response_status = 'SELECTED'
$b$),
(3, 'public.rpc_select_response(uuid,integer,uuid,integer,text,text)',
$a$    case when v_need.schedule_kind='REMOTE_ANYTIME' then 'REMOTE' else 'PHYSICAL' end,
$a$,
$b$    -- PKG-029b (deep read 12.7): remote or physical follows the place; the schedule decides only for a task
    -- written before the place had a mode.
    case when coalesce(v_need.execution_location_mode = 'REMOTE', v_need.schedule_kind = 'REMOTE_ANYTIME')
      then 'REMOTE' else 'PHYSICAL' end,
$b$),
(4, 'private.expire_lifecycle(timestamptz)',
$a$        or (n.schedule_kind = 'FIXED_WINDOW' and coalesce(n.ends_at, n.starts_at) <= p_at)
$a$,
$b$        or (n.schedule_kind = 'FIXED_WINDOW' and coalesce(n.ends_at, n.starts_at) <= p_at)
        -- PKG-029b: "danas", "sutra" and "ove nedelje" end with their day, counted from publication.
        or (n.schedule_kind in ('TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE')
            and private.relative_schedule_end_v5(n.schedule_kind, n.published_at, n.task_timezone) <= p_at)
$b$),
(5, 'private.expire_lifecycle(timestamptz)',
$a$         or (x.schedule_kind = 'FIXED_WINDOW' and coalesce(x.ends_at, x.starts_at) <= p_at)
$a$,
$b$         or (x.schedule_kind = 'FIXED_WINDOW' and coalesce(x.ends_at, x.starts_at) <= p_at)
         or (x.schedule_kind in ('TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE')
             and private.relative_schedule_end_v5(x.schedule_kind, x.published_at, x.task_timezone) <= p_at)
$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg029b_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG029B_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg029b_before loop
    expected := s.prosrc;
    for p in select * from pkg029b_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG029B_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG029B_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select count(*) from pkg029b_before) <> 4 or (select count(*) from pkg029b_patch) <> 5 then
    raise exception 'PKG029B_PATCH_SET_CHANGED';
  end if;
  -- The rule as the owner stated it, on a fixed instant in Belgrade.
  if private.relative_schedule_end_v5('TODAY_FLEXIBLE', '2026-09-20 01:52:02+00', 'Europe/Belgrade') <> '2026-09-20 22:00:00+00'
     or private.relative_schedule_end_v5('TOMORROW_FLEXIBLE', '2026-09-20 05:46:34+00', 'Europe/Belgrade') <> '2026-09-21 22:00:00+00'
     or private.relative_schedule_end_v5('WEEK_FLEXIBLE', '2026-09-20 05:46:34+00', 'Europe/Belgrade') <> '2026-09-27 05:46:34+00'
     or private.relative_schedule_end_v5('FLEXIBLE', '2026-09-20 05:46:34+00', 'Europe/Belgrade') is not null then
    raise exception 'PKG029B_RELATIVE_RULE';
  end if;
  if has_function_privilege('anon', 'private.relative_schedule_end_v5(text,timestamptz,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.relative_schedule_end_v5(text,timestamptz,text)', 'EXECUTE') then
    raise exception 'PKG029B_GRANTS_MISMATCH';
  end if;
  if (select source_digest from pkg029b_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG029B_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
