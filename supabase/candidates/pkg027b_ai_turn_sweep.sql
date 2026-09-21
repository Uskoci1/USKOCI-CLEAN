-- PKG-027b candidate. Owner approval 2026-09-21 ("odobravam sve to"), after the deep read (ledger 8.17, 11.1, 12.3).
-- Contract/proof: docs/implementation/v5-ai-first/pkg027/PKG027_OWNER_APPROVED_FIXES.md
--
-- Defect, measured on canonical DEV: three intake turns and one worker-profile turn have been PROCESSING for
-- days with a lease that ran out. Nothing moves a dispatched turn out of PROCESSING once the Edge worker that
-- claimed it is gone, so each one blocks its conversation and the account's closure (PENDING_WORKFLOW) for good.
--
-- This candidate:
--   1. adds private.ai_turn_sweep_v5: a dispatched turn whose lease ended more than ten minutes ago is marked
--      FAILED (intake and worker profile) or CANCELLED (pre-selection Q&A classification). The request is never
--      retried; the person sends a new message. The Edge ceiling is 12 s and the leases 60-90 s, so ten minutes
--      past the lease cannot overtake a live worker;
--   2. runs it from the existing one-minute marketplace tick;
--   3. makes leaving a worker-profile conversation end its unfinished turn, as leaving an intake one already does.
-- Function bodies only: no table, column, constraint, trigger, policy or grant change, so the certified closure
-- source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg027b_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg027b_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg027b_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if to_regprocedure('private.ai_turn_sweep_v5(timestamptz)') is not null then
    raise exception 'PKG027B_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.marketplace_tick(integer,timestamptz)', '0e6a850ef048911773266e2ab0b17d0e'),
    ('public.rpc_abandon_worker_ai(uuid)', '4d0c5201889155bfb3986f4ebc1b92c1')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG027B_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg027b_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  -- The three state vocabularies this sweep writes into, exactly as they are.
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'private.ai_need_turn_commands'::regclass and conname = 'ai_need_turn_commands_state_check')
       is distinct from $c$CHECK ((state = ANY (ARRAY['PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text])))$c$
     or (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'private.worker_ai_turns'::regclass and conname = 'worker_ai_turns_state_check')
       is distinct from $c$CHECK ((state = ANY (ARRAY['PROCESSING'::text, 'SUCCEEDED'::text, 'FAILED'::text])))$c$
     or (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'private.qa_ai_commands'::regclass and conname = 'qa_ai_commands_state_check')
       is distinct from $c$CHECK ((state = ANY (ARRAY['PROCESSING'::text, 'READY'::text, 'REJECTED'::text, 'STALE'::text, 'COMMITTED'::text, 'CANCELLED'::text])))$c$ then
    raise exception 'PKG027B_STATE_VOCABULARY_DRIFT';
  end if;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG027B_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg027b_closure values (private.closure_source_digest_v5());
end
$pre$;

create function private.ai_turn_sweep_v5(p_at timestamptz default statement_timestamp())
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_cutoff timestamptz := coalesce(p_at, statement_timestamp()) - interval '10 minutes';
  v_need integer := 0; v_worker integer := 0; v_qa integer := 0; v_errors jsonb := '[]'::jsonb;
begin
  -- A turn whose lease ended ten minutes ago will never be completed by the worker that claimed it.
  -- Expiry is still not proof that the provider did not run, so the request itself is never retried:
  -- it stays failed, and only a NEW request from the person can continue the conversation. What changes
  -- is that it stops blocking that conversation and the account's closure forever.
  begin
    update private.ai_need_turn_commands set state = 'FAILED', updated_at = clock_timestamp()
     where state = 'PROCESSING' and lease_expires_at < v_cutoff;
    get diagnostics v_need = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns', 'NEED_INTAKE', 'sqlstate', sqlstate));
  end;
  begin
    update private.worker_ai_turns set state = 'FAILED'
     where state = 'PROCESSING' and lease_expires_at < v_cutoff;
    get diagnostics v_worker = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns', 'WORKER_PROFILE', 'sqlstate', sqlstate));
  end;
  begin
    -- CANCELLED is the existing "this send will never publish anything" state the app already explains.
    update private.qa_ai_commands set state = 'CANCELLED', updated_at = clock_timestamp()
     where state = 'PROCESSING' and lease_expires_at < v_cutoff
       and not private.closure_account_restricted(account_id);
    get diagnostics v_qa = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns', 'PRESELECTION_QA', 'sqlstate', sqlstate));
  end;
  return jsonb_build_object('needTurnsFailed', v_need, 'workerTurnsFailed', v_worker,
    'qaCommandsCancelled', v_qa, 'graceMinutes', 10, 'errors', v_errors);
end
$function$;
revoke all on function private.ai_turn_sweep_v5(timestamptz) from public, anon, authenticated, service_role;
comment on function private.ai_turn_sweep_v5(timestamptz) is
  'PKG-027b: end AI turns whose lease expired more than ten minutes ago, so they stop blocking a conversation and account closure. Never retries the request.';

insert into pkg027b_patch values
(1, 'private.marketplace_tick(integer,timestamptz)',
$a$declare expiry jsonb;dispatch jsonb;completion jsonb;export_maintenance jsonb;retention_maintenance jsonb;$a$,
$b$declare expiry jsonb;dispatch jsonb;completion jsonb;export_maintenance jsonb;retention_maintenance jsonb;ai_turn_sweep jsonb;$b$),
(2, 'private.marketplace_tick(integer,timestamptz)',
$a$ retention_maintenance:=private.retention_maintenance(p_batch);$a$,
$b$ retention_maintenance:=private.retention_maintenance(p_batch);
 ai_turn_sweep:=private.ai_turn_sweep_v5(p_at);$b$),
(3, 'private.marketplace_tick(integer,timestamptz)',
$a$ 'exportMaintenance',export_maintenance,'retentionMaintenance',retention_maintenance);$a$,
$b$ 'exportMaintenance',export_maintenance,'retentionMaintenance',retention_maintenance,'aiTurnSweep',ai_turn_sweep);$b$),
(4, 'public.rpc_abandon_worker_ai(uuid)',
$a$ update public.ai_conversations set status='ABANDONED',completed_at=clock_timestamp() where id=p_conversation_id and account_id=auth.uid() and status='OPEN';$a$,
$b$ update public.ai_conversations set status='ABANDONED',completed_at=clock_timestamp() where id=p_conversation_id and account_id=auth.uid() and status='OPEN';
 -- PKG-027b: leaving the conversation also ends its unfinished turn, as leaving an intake conversation does.
 update private.worker_ai_turns set state='FAILED' where conversation_id=p_conversation_id and account_id=auth.uid() and state='PROCESSING';$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg027b_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG027B_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg027b_before loop
    expected := s.prosrc;
    for p in select * from pkg027b_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG027B_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG027B_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if has_function_privilege('anon', 'private.ai_turn_sweep_v5(timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.ai_turn_sweep_v5(timestamptz)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.ai_turn_sweep_v5(timestamptz)', 'EXECUTE') then
    raise exception 'PKG027B_GRANTS_MISMATCH';
  end if;
  if (select source_digest from pkg027b_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG027B_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
