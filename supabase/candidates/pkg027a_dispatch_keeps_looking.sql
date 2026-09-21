-- PKG-027a candidate. Owner approval 2026-09-21 ("odobravam sve to"), after the deep read (ledger 12.1).
-- Contract/proof: docs/implementation/v5-ai-first/pkg027/PKG027_OWNER_APPROVED_FIXES.md
--
-- Defect, measured on canonical DEV: every one of the 12 open tasks had exactly four dispatch rounds, all
-- STOPPED / NO_ELIGIBLE_CANDIDATES, within about 17 minutes, and then left the dispatch queue for good.
-- Cause: private.dispatch_next_wave counts every round, including one that found nobody, against the
-- four-wave budget, so the fifth check returns WAVES_EXHAUSTED and private.dispatch_tick deletes the
-- task from private.dispatch_schedule. Nothing a worker does puts it back.
--
-- This candidate:
--   1. counts only rounds that reached somebody against the wave budget;
--   2. never gives up on an open task: a check that finds nobody backs off to at most six hours;
--   3. re-queues the open tasks of the worker's world at once when a worker's matching inputs change
--      (availability, location, capacity, profile activation) through the existing writers;
--   4. puts the tasks that are open now back in the queue.
-- Function bodies and data only: no table, column, constraint, trigger, policy or grant change, so the
-- certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg027a_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg027a_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg027a_closure(source_digest text not null) on commit drop;
create temporary table pkg027a_requeued(count integer not null) on commit drop;

do $pre$
declare pin record;
begin
  if to_regprocedure('private.requeue_open_needs_for_worker_v5(uuid)') is not null then
    raise exception 'PKG027A_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.dispatch_next_wave(uuid)', '5f434a47486f73d3c107aa92c3ab321c'),
    ('private.dispatch_tick(integer,timestamptz)', 'd3ef4a0b0b63bcfaffd84547a2ad863b'),
    ('public.rpc_save_worker_availability(text,jsonb)', 'be5f8794ed459ead235c81360e3830b1'),
    ('public.rpc_save_worker_location(text,jsonb,boolean)', '68a448bc7344e64064b9a0babd939b40'),
    ('public.rpc_save_worker_capacity(text,jsonb)', 'b4e32f1fb9ae7e684ccb28a0cf6d00c7'),
    ('public.rpc_complete_worker_profile(uuid)', 'b4113385a78dc0ff763516a9dceb7820'),
    ('private.accounts_same_world(uuid,uuid)', '16f541f952d4e1e2dbb4fc87e594d572'),
    ('private.enqueue_dispatch(uuid,timestamptz)', '470ed6ab6501c69bf9ebbfe057ccd0fb')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG027A_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg027a_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG027A_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg027a_closure values (private.closure_source_digest_v5());
end
$pre$;

-- The one place that decides, for an ACTIVE worker, which open tasks may have become reachable.
create function private.requeue_open_needs_for_worker_v5(p_account_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare v_need uuid; v_count integer := 0;
begin
  if p_account_id is null or not exists (
    select 1 from public.app_profiles p
     where p.account_id = p_account_id and p.kind = 'WORKER' and p.profile_status = 'ACTIVE') then
    return 0;
  end if;
  -- Same open set as the marketplace reader, the worker's own world only, never the worker's own tasks.
  -- Queueing is idempotent (enqueue_dispatch keeps the earlier run time), and the tick decides eligibility.
  for v_need in
    select n.id from public.needs n
     where n.status in ('PUBLISHED','SELECTION')
       and n.published_at is not null
       and n.remaining_search_closed_at is null
       and n.requester_account_id <> p_account_id
       and (n.response_deadline is null or n.response_deadline > statement_timestamp())
       and private.accounts_same_world(n.requester_account_id, p_account_id)
     order by n.published_at desc, n.id desc
     limit 200
  loop
    perform private.enqueue_dispatch(v_need, statement_timestamp());
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$function$;
revoke all on function private.requeue_open_needs_for_worker_v5(uuid) from public, anon, authenticated, service_role;
comment on function private.requeue_open_needs_for_worker_v5(uuid) is
  'PKG-027a: re-queue the open tasks of an ACTIVE worker''s world when the worker''s matching inputs change.';

insert into pkg027a_patch values
(1, 'private.dispatch_next_wave(uuid)',
$a$   where need_id = nid and need_revision = n.revision and urgency = urg;$a$,
$b$   where need_id = nid and need_revision = n.revision and urgency = urg
     -- PKG-027a: a check that found nobody reached nobody, so it does not use up a wave.
     and not (status = 'STOPPED' and stop_reason = 'NO_ELIGIBLE_CANDIDATES');$b$),
(2, 'private.dispatch_tick(integer,timestamptz)',
$a$        -- NO_ELIGIBLE_CANDIDATES i slicno: eksponencijalno odlaganje, odustajanje na 8.$a$,
$b$        -- NO_ELIGIBLE_CANDIDATES i slicno: eksponencijalno odlaganje do sest sati, bez odustajanja
        -- (PKG-027a). Promena kod radnika vraca zadatak u red odmah (requeue_open_needs_for_worker_v5).$b$),
(3, 'private.dispatch_tick(integer,timestamptz)',
$a$                 mins => least(60, greatest(5, (2 ^ least(attempts, 6))::integer))),$a$,
$b$                 mins => least(360, greatest(5, (2 ^ least(attempts, 9))::integer))),$b$),
(4, 'private.dispatch_tick(integer,timestamptz)',
$a$        delete from private.dispatch_schedule where need_id = r.need_id and attempts >= 8;
$a$,
$b$$b$),
(5, 'public.rpc_save_worker_availability(text,jsonb)',
$a$  after_doc:=private.worker_availability_document(p.id);$a$,
$b$  perform private.requeue_open_needs_for_worker_v5(p.account_id);
  after_doc:=private.worker_availability_document(p.id);$b$),
(6, 'public.rpc_save_worker_location(text,jsonb,boolean)',
$a$  return jsonb_build_object('saved',true,'idempotentReplay',false,'location',private.worker_location_document(p.id));$a$,
$b$  perform private.requeue_open_needs_for_worker_v5(p.account_id);
  return jsonb_build_object('saved',true,'idempotentReplay',false,'location',private.worker_location_document(p.id));$b$),
(7, 'public.rpc_save_worker_capacity(text,jsonb)',
$a$  return jsonb_build_object('saved',true,'idempotentReplay',false,'capacity',private.worker_capacity_document(p.id));$a$,
$b$  perform private.requeue_open_needs_for_worker_v5(p.account_id);
  return jsonb_build_object('saved',true,'idempotentReplay',false,'capacity',private.worker_capacity_document(p.id));$b$),
(8, 'public.rpc_complete_worker_profile(uuid)',
$a$    raise exception 'PROFILE_ACTIVATION_RACE' using errcode = 'P0001';
  end if;$a$,
$b$    raise exception 'PROFILE_ACTIVATION_RACE' using errcode = 'P0001';
  end if;

  perform private.requeue_open_needs_for_worker_v5(v_uid);$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg027a_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG027A_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

-- The tasks that are open now left the queue under the old rule. Put them back.
do $requeue$
declare v_count integer;
begin
  with open_needs as (
    select n.id from public.needs n
     where n.status in ('PUBLISHED','SELECTION')
       and n.published_at is not null
       and n.remaining_search_closed_at is null
       and (n.response_deadline is null or n.response_deadline > statement_timestamp())
  ), queued as (
    select private.enqueue_dispatch(o.id, statement_timestamp()) from open_needs o
  )
  select count(*) into v_count from queued;
  insert into pkg027a_requeued values (v_count);
  if (select count(*) from private.dispatch_schedule s join public.needs n on n.id = s.need_id
       where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null
         and n.remaining_search_closed_at is null
         and (n.response_deadline is null or n.response_deadline > statement_timestamp())) <> v_count then
    raise exception 'PKG027A_REQUEUE_INCOMPLETE';
  end if;
  raise notice 'PKG027A_REQUEUED_OPEN_TASKS %', v_count;
end
$requeue$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg027a_before loop
    expected := s.prosrc;
    for p in select * from pkg027a_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG027A_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG027A_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select count(*) from pkg027a_before b join pkg027a_patch pt on pt.signature = b.signature) <> 8
     or (select count(distinct signature) from pkg027a_patch) <> 6 then
    raise exception 'PKG027A_PATCH_SET_CHANGED';
  end if;
  if has_function_privilege('anon', 'private.requeue_open_needs_for_worker_v5(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.requeue_open_needs_for_worker_v5(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.requeue_open_needs_for_worker_v5(uuid)', 'EXECUTE')
     or has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'PKG027A_GRANTS_MISMATCH';
  end if;
  if (select source_digest from pkg027a_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG027A_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
