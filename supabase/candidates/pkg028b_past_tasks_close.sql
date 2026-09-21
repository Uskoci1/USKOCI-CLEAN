-- PKG-028b candidate. Deep read 5.1. Prepared on the owner's "kreni" (2026-09-21); applying it to canonical DEV
-- needs the owner's separate yes.
-- Contract/proof: docs/implementation/v5-ai-first/pkg028/PKG028_WORKERS_AND_PAST_TASKS.md
--
-- Defect, measured on canonical DEV: nothing rejects a past start and nothing expires a task whose time is over.
-- rpc_publish_need_canonical and need_publication_context never look at starts_at. private.expire_lifecycle, run
-- every minute, expires a published task only once a response deadline passes, and a fixed-time task published
-- without one is never refused and never expired. On 2026-09-21 three published tasks advertised work that was
-- already over. Since PKG-027a, such a task is offered to workers again.
--
-- This candidate:
--   1. expire_lifecycle also expires a fixed-time task in PUBLISHED or SELECTION with nobody selected, once its
--      end has passed (its start when it has no end). The rest of the path is the existing one: open
--      applications, notifications, rounds and the dispatch queue are closed exactly as for a passed deadline.
--   2. rpc_publish_need_canonical refuses to publish the caller's own fixed-time task whose start has already
--      passed (FIXED_WINDOW_START_PASSED). It checks before the publication context, and only on the caller's
--      own task.
-- Function bodies only. The certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg028b_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg028b_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg028b_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if (select position('FIXED_WINDOW_START_PASSED' in prosrc) from pg_proc
       where oid = to_regprocedure('public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)')) > 0 then
    raise exception 'PKG028B_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.expire_lifecycle(timestamptz)', 'c9e69fe79781da56eb7bb3853e75c798'),
    ('public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)', '818272ac56792c1eaf2cad20b2757f7f')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG028B_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg028b_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  -- The columns the new rule reads, and the only values schedule_kind can hold.
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.needs'::regclass and contype = 'c'
         and pg_get_constraintdef(oid) like '%schedule_kind%FIXED_WINDOW%' limit 1) is null then
    raise exception 'PKG028B_SCHEDULE_CONTRACT_DRIFT';
  end if;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG028B_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg028b_closure values (private.closure_source_digest_v5());
end
$pre$;

insert into pkg028b_patch values
(1, 'private.expire_lifecycle(timestamptz)',
$a$      and n.response_deadline is not null and n.response_deadline <= p_at
$a$,
$b$      and (
        (n.response_deadline is not null and n.response_deadline <= p_at)
        -- PKG-028b: a fixed-time task is over once its time has passed, with or without a deadline.
        or (n.schedule_kind = 'FIXED_WINDOW' and coalesce(n.ends_at, n.starts_at) <= p_at)
      )
$b$),
(2, 'private.expire_lifecycle(timestamptz)',
$a$       and x.response_deadline is not null
       and x.response_deadline <= p_at
$a$,
$b$       and (
         (x.response_deadline is not null and x.response_deadline <= p_at)
         or (x.schedule_kind = 'FIXED_WINDOW' and coalesce(x.ends_at, x.starts_at) <= p_at)
       )
$b$),
(3, 'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)',
$a$  if p_response_deadline is not null and p_response_deadline <= clock_timestamp() then
    raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023';
  end if;

  -- A recorded successful command$a$,
$b$  if p_response_deadline is not null and p_response_deadline <= clock_timestamp() then
    raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023';
  end if;

  -- PKG-028b: a fixed-time task whose start has already passed cannot be offered to anyone. Checked before
  -- the publication context, and only on the caller's own task, so nobody learns another person's schedule.
  if exists (select 1 from public.needs n
              where n.id = p_need_id and n.requester_account_id = v_actor
                and n.schedule_kind = 'FIXED_WINDOW' and n.starts_at <= clock_timestamp()) then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;

  -- A recorded successful command$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg028b_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG028B_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg028b_before loop
    expected := s.prosrc;
    for p in select * from pkg028b_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG028B_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG028B_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select count(*) from pkg028b_before) <> 2 or (select count(*) from pkg028b_patch) <> 3 then
    raise exception 'PKG028B_PATCH_SET_CHANGED';
  end if;
  if (select source_digest from pkg028b_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG028B_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
