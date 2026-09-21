-- PKG-030a candidate. Owner approval 2026-09-21: "kreni" to option A of the written report (the workers take the
-- secret key on the apikey header; the owner then stores that key in Vault in place of the legacy one).
-- Contract/proof: docs/implementation/v5-ai-first/pkg030/PKG030_WORKERS_SECRET_KEY.md
--
-- Measured on canonical DEV (2026-09-21): the tick sent the key the owner stored, the genuine legacy service_role
-- JWT, as "Authorization: Bearer", and all three workers refused it (push 403, export 401, closure 403). On this
-- project the Edge runtime's SUPABASE_SERVICE_ROLE_KEY is the new secret key (sb_secret_), and every worker compares
-- the caller's key with that value. A secret key is not a JWT, so as a Bearer it never passes the gateway; Supabase
-- asks pg_net callers to send it on the apikey header instead. The workers now accept the key there (Edge side of
-- PKG-030), and this candidate makes the tick send it there.
--
-- Function body only: private.edge_worker_tick_v5 is not on the certified closure list and is not a trigger
-- function, so the certified closure source digest must not move (asserted below). The tick is not called here:
-- on canonical DEV a key is stored, and a call would reach the workers.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg030a_before(signature text primary key, prosrc text not null, acl text,
  secdef boolean not null, config text) on commit drop;
create temporary table pkg030a_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg030a_closure(source_digest text not null, job text not null) on commit drop;

do $pre$
declare pin record;
begin
  if (select position('''apikey'', v_key' in prosrc) from pg_proc
       where oid = to_regprocedure('private.edge_worker_tick_v5(timestamptz)')) > 0 then
    raise exception 'PKG030A_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.edge_worker_tick_v5(timestamptz)', '2d898a940870c281e7efa312bb4a3000')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG030A_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg030a_before
      select pin.signature, p.prosrc, p.proacl::text, p.prosecdef, p.proconfig::text
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG030A_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg030a_closure
    select private.closure_source_digest_v5(), j.schedule || ' ' || j.command || ' ' || j.active::text
    from cron.job j where j.jobname = 'uskoci_edge_workers';
  if (select count(*) from pkg030a_closure) <> 1 then
    raise exception 'PKG030A_JOB_MISSING';
  end if;
end
$pre$;

insert into pkg030a_patch values
(1, 'private.edge_worker_tick_v5(timestamptz)',
$a$  -- The same shape every worker accepts as a bearer token (the length is checked apart: a regular expression
$a$,
$b$  -- The shape of a server key, a legacy JWT or a secret key (the length is checked apart: a regular expression
$b$),
(2, 'private.edge_worker_tick_v5(timestamptz)',
$a$          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
$a$,
$b$          -- PKG-030a: on apikey. A secret key (sb_secret_) is not a JWT, so as a Bearer it never passes the gateway.
          headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg030a_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG030A_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg030a_before loop
    expected := s.prosrc;
    for p in select * from pkg030a_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc, pr.proacl::text acl, pr.prosecdef secdef, pr.proconfig::text config
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG030A_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.acl, actual.secdef, actual.config) is distinct from (s.acl, s.secdef, s.config) then
      raise exception 'PKG030A_PRIVILEGES_CHANGED: %', s.signature;
    end if;
    if position('''Authorization''' in actual.prosrc) > 0 then
      raise exception 'PKG030A_AUTHORIZATION_STILL_SENT';
    end if;
  end loop;
  if has_function_privilege('anon', 'private.edge_worker_tick_v5(timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.edge_worker_tick_v5(timestamptz)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.edge_worker_tick_v5(timestamptz)', 'EXECUTE') then
    raise exception 'PKG030A_TICK_EXECUTABLE_BY_CLIENTS';
  end if;
  if (select job from pkg030a_closure) is distinct from
     (select j.schedule || ' ' || j.command || ' ' || j.active::text from cron.job j where j.jobname = 'uskoci_edge_workers') then
    raise exception 'PKG030A_JOB_CHANGED';
  end if;
  if (select source_digest from pkg030a_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG030A_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
commit;
