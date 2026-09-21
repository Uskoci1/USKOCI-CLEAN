-- PKG-032b candidate. Deep read 12.8, and the re-binding of the certified closure source it requires. Owner decision
-- 2026-09-21: "odobravam sve" to item 8 of the written list ("one round, proven on a disposable database first").
-- Contract/proof: docs/implementation/v5-ai-first/pkg032/PKG032_CANCEL_REASON_AND_GUARD.md
--
-- 12.8: private.guard_remaining_search_close_fields raises only
--         if current_setting('uskoci.need_lifecycle', true) <> 'CLOSE_REMAINING_SEARCH'
--       With the setting never set, that comparison is NULL and the guard lets the write through, so an owner can
--       stamp the three remaining_search_* columns of their own draft directly. Every other guard in the schema uses
--       "is distinct from". This makes this one do the same; nothing else in it changes.
--
-- The guard is a trigger function of public.needs, and the certified closure source digest includes the md5 of every
-- trigger function of every public/private table. So the fix moves the digest, and the certificate has to be bound
-- to the new value, in its three places: private.closure_source_v5, private.closure_erasure_source_v5 and the
-- constant inside private.retention_ai_source_ready() (the $rebind$ pattern of PKG-023f).
--
-- What makes the re-binding honest:
--   - before: live = certified in all three places, the source is ready, no account closure is executing;
--   - the new digest differs from the old one, and restoring the old guard body inside this transaction gives the
--     old certified value back, so the guard is the only thing the new value reflects;
--   - after: the three places hold the new live value, the readiness function changed only by its constant, the
--     source is ready, and the erasure binding carries the new value.
-- The erasure program (the redaction relations and patch) is not touched.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create temporary table pkg032b_state(certified text not null, ready_masked text not null, guard_before text not null,
  moved text) on commit drop;

do $pre$
declare v_certified text; v_ready_def text;
begin
  if (select position('is distinct from ''CLOSE_REMAINING_SEARCH''' in prosrc) from pg_proc
       where oid = to_regprocedure('private.guard_remaining_search_close_fields()')) > 0 then
    raise exception 'PKG032B_ALREADY_APPLIED';
  end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
       where oid = to_regprocedure('private.guard_remaining_search_close_fields()')) is distinct from '0e8a1f49fd552d7e799df791a8622c19' then
    raise exception 'PKG032B_PREDECESSOR_DRIFT: private.guard_remaining_search_close_fields()';
  end if;
  -- One certified value, in all three places, equal to the live digest, and the source ready.
  select sha256 into strict v_certified from private.closure_source_v5 where singleton;
  if v_certified is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton) then
    raise exception 'PKG032B_CERTIFIED_VALUES_DISAGREE';
  end if;
  v_ready_def := pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  if (length(v_ready_def) - length(replace(v_ready_def, v_certified, ''))) <> length(v_certified)
     or (select count(*) from regexp_matches(v_ready_def, '[0-9a-f]{64}', 'g')) <> 1 then
    raise exception 'PKG032B_READY_BINDING_INVALID';
  end if;
  if private.closure_source_digest_v5() is distinct from v_certified or not private.retention_ai_source_ready() then
    raise exception 'PKG032B_CLOSURE_SOURCE_NOT_READY';
  end if;
  if exists (select 1 from private.closure_executions_v5 where state = 'EXECUTING') then
    raise exception 'PKG032B_CLOSURE_IN_FLIGHT';
  end if;
  insert into pkg032b_state(certified, ready_masked, guard_before)
    select v_certified,
      (select md5(regexp_replace(prosrc, '[0-9a-f]{64}', '<CERTIFIED>', 'g')) from pg_proc where oid = 'private.retention_ai_source_ready()'::regprocedure),
      (select prosrc from pg_proc where oid = to_regprocedure('private.guard_remaining_search_close_fields()'));
end
$pre$;

-- a. The guard: "<>" becomes "is distinct from", so an unset setting refuses instead of passing.
do $guard$
declare v_def text; v_anchor text := $a$    if current_setting('uskoci.need_lifecycle', true) <> 'CLOSE_REMAINING_SEARCH' then
$a$;
begin
  v_def := pg_get_functiondef(to_regprocedure('private.guard_remaining_search_close_fields()'));
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) <> length(v_anchor) then
    raise exception 'PKG032B_ANCHOR';
  end if;
  execute replace(v_def, v_anchor, $b$    if current_setting('uskoci.need_lifecycle', true) is distinct from 'CLOSE_REMAINING_SEARCH' then
$b$);
end
$guard$;

-- b. The new digest reflects the guard and only the guard.
do $isolate$
declare v_old text; v_new text; v_back text; v_again text; v_fixed text; v_restore text;
begin
  select certified into strict v_old from pkg032b_state;
  v_new := private.closure_source_digest_v5();
  if v_new is null then raise exception 'PKG032B_SOURCE_DIGEST_UNAVAILABLE'; end if;
  if v_new = v_old then raise exception 'PKG032B_GUARD_CHANGE_NOT_IN_THE_DIGEST'; end if;
  select pg_get_functiondef(to_regprocedure('private.guard_remaining_search_close_fields()')) into strict v_fixed;
  v_restore := replace(v_fixed, $a$is distinct from 'CLOSE_REMAINING_SEARCH' then$a$, $b$<> 'CLOSE_REMAINING_SEARCH' then$b$);
  execute v_restore;
  if (select prosrc from pg_proc where oid = to_regprocedure('private.guard_remaining_search_close_fields()'))
       is distinct from (select guard_before from pkg032b_state) then
    raise exception 'PKG032B_RESTORE_IS_NOT_THE_OLD_GUARD';
  end if;
  v_back := private.closure_source_digest_v5();
  if v_back is distinct from v_old then
    raise exception 'PKG032B_UNREVIEWED_CHANGE: with the old guard the digest is %, the certified value is %', v_back, v_old;
  end if;
  execute v_fixed;
  v_again := private.closure_source_digest_v5();
  if v_again is distinct from v_new then raise exception 'PKG032B_DIGEST_NOT_STABLE'; end if;
  update pkg032b_state set moved = v_new;
end
$isolate$;

-- c. The certified value, in its three places, for the state this transaction now holds.
do $rebind$
declare v_old text; v_new text; v_def text;
begin
  select certified, moved into strict v_old, v_new from pkg032b_state;
  if v_new is distinct from private.closure_source_digest_v5() then raise exception 'PKG032B_DIGEST_NOT_STABLE'; end if;
  v_def := pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  update private.closure_source_v5 set sha256 = v_new where singleton and sha256 = v_old;
  if not found then raise exception 'PKG032B_CERTIFIED_VALUES_DISAGREE'; end if;
  update private.closure_erasure_source_v5 set sha256 = v_new where singleton and sha256 = v_old;
  if not found then raise exception 'PKG032B_CERTIFIED_VALUES_DISAGREE'; end if;
  execute replace(v_def, v_old, v_new);
end
$rebind$;

do $post$
declare v_old text; v_live text; v_ready text; s record;
begin
  select * into strict s from pkg032b_state;
  v_old := s.certified;
  v_live := private.closure_source_digest_v5();
  select prosrc into strict v_ready from pg_proc where oid = 'private.retention_ai_source_ready()'::regprocedure;
  if (select sha256 from private.closure_source_v5 where singleton) is distinct from v_live
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from v_live
     or position(v_old in v_ready) > 0
     or (length(v_ready) - length(replace(v_ready, v_live, ''))) <> length(v_live) then
    raise exception 'PKG032B_REBIND_INCOMPLETE';
  end if;
  -- Nothing of the readiness function changed except the one constant.
  if md5(regexp_replace(v_ready, '[0-9a-f]{64}', '<CERTIFIED>', 'g')) is distinct from s.ready_masked then
    raise exception 'PKG032B_READINESS_FUNCTION_CHANGED_BEYOND_THE_CONSTANT';
  end if;
  if private.retention_ai_source_ready() is distinct from true then raise exception 'PKG032B_SOURCE_NOT_READY'; end if;
  if private.closure_erasure_binding_v5() is null
     or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from v_live then
    raise exception 'PKG032B_ERASURE_BINDING_NOT_READY';
  end if;
  -- The guard is exactly the old one with the one comparison changed.
  if (select prosrc from pg_proc where oid = to_regprocedure('private.guard_remaining_search_close_fields()'))
       is distinct from replace(s.guard_before, $a$<> 'CLOSE_REMAINING_SEARCH' then$a$, $b$is distinct from 'CLOSE_REMAINING_SEARCH' then$b$) then
    raise exception 'PKG032B_GUARD_NOT_AS_REVIEWED';
  end if;
  if has_function_privilege('anon', 'private.retention_ai_source_ready()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.retention_ai_source_ready()', 'EXECUTE') then
    raise exception 'PKG032B_GRANTS_NOT_EXACT';
  end if;
end
$post$;
commit;
