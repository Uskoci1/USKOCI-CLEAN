-- PKG-028a candidate. Deep read 4.2 and 6.1. Prepared on the owner's "kreni" (2026-09-21); applying it to
-- canonical DEV needs the owner's separate yes.
-- Contract/proof: docs/implementation/v5-ai-first/pkg028/PKG028_WORKERS_AND_PAST_TASKS.md
--
-- Defect, measured on canonical DEV: three deployed Edge workers each drain a queue and must be invoked on a
-- schedule, and nothing invokes them. pg_net is not installed, and the only cron job, uskoci_marketplace_tick,
-- never leaves the database. So:
--   - a confirmed account deletion locks the account and never erases it (6.1);
--   - a data export has sat in REQUESTED since 2026-09-13 (4.2);
--   - push has never run.
--
-- This candidate:
--   1. installs pg_net. anon and authenticated lose what the platform grants them on it: nothing here needs them
--      to be able to make this database send an HTTP request.
--   2. adds private.edge_worker_tick_v5(). For each worker that has work, it makes one call to that worker's
--      Edge function with the service key. The owner stores the key in Vault; this file holds no secret.
--   3. schedules the tick once a minute as the cron job uskoci_edge_workers.
-- Until the owner stores the key, the tick sends nothing and says so (NOT_CONFIGURED).
-- The only data written is one Vault entry: the public address of this project's Edge functions.
-- No table, column, constraint, trigger or policy in public/private changes, so the certified closure source
-- digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg028a_closure(source_digest text not null) on commit drop;

do $pre$
begin
  if to_regprocedure('private.edge_worker_tick_v5(timestamptz)') is not null then
    raise exception 'PKG028A_ALREADY_APPLIED';
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'PKG028A_PG_NET_ALREADY_INSTALLED';
  end if;
  if exists (select 1 from cron.job where jobname = 'uskoci_edge_workers') then
    raise exception 'PKG028A_JOB_NAME_TAKEN';
  end if;
  if exists (select 1 from vault.secrets where name in ('uskoci_edge_base_url', 'uskoci_edge_worker_key')) then
    raise exception 'PKG028A_VAULT_NAME_TAKEN';
  end if;
  -- The three functions the tick reads to know whether a worker has work.
  if to_regprocedure('private.data_export_policy_binding()') is null
     or to_regprocedure('private.closure_erasure_binding_v5()') is null then
    raise exception 'PKG028A_PREDECESSOR_MISSING';
  end if;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG028A_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg028a_closure values (private.closure_source_digest_v5());
end
$pre$;

create extension pg_net;

do $net$
declare f record;
begin
  -- The platform's event trigger grants USAGE on schema net to anon and authenticated so that database
  -- webhooks can run as any role. This project has no webhook, and a role that can reach net can make the
  -- database send HTTP requests anywhere. Only the tick, run by the database owner, may. The schema is the
  -- barrier: without USAGE no object in net can be named. EXECUTE is left to PUBLIC, because the database
  -- owner may hold it only through PUBLIC; any direct grant to anon or authenticated is taken back as well.
  revoke usage on schema net from public, anon, authenticated;
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'net'::regnamespace loop
    execute format('revoke all on function %s from anon, authenticated', f.sig);
  end loop;
end
$net$;

-- Public: this project's Edge address. The disposable proof points it at its own local gateway.
select vault.create_secret('https://leqcwgzvjsxugfgzdmth.supabase.co', 'uskoci_edge_base_url',
  'PKG-028a: where the scheduled Edge workers live. An address, not a secret.');

create function private.edge_worker_tick_v5(p_at timestamptz default statement_timestamp())
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_base text;
  v_key text;
  v_workers jsonb := '{}'::jsonb;
  w record;
begin
  select s.decrypted_secret into v_base from vault.decrypted_secrets s where s.name = 'uskoci_edge_base_url';
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'uskoci_edge_worker_key';
  -- Only a Supabase project address over HTTPS, or the disposable local stack's own gateway.
  if v_base is null or v_base !~ '^(https://[a-z0-9]{20}\.supabase\.co|http://supabase_kong_[a-z0-9_-]+:8000)$' then
    return jsonb_build_object('kind', 'NOT_CONFIGURED', 'missing', 'BASE_URL');
  end if;
  -- The same shape every worker accepts as a bearer token. The key itself is never returned or logged.
  if v_key is null or v_key !~ '^[A-Za-z0-9._~-]{16,4096}$' then
    return jsonb_build_object('kind', 'NOT_CONFIGURED', 'missing', 'WORKER_KEY');
  end if;
  -- One call a minute per worker, and only when it has work. Every worker finishes or gives up inside
  -- 55 seconds, so two calls to the same worker never overlap. "Has work" may be wider than what a worker
  -- would take, never narrower: a wasted call is harmless, a skipped one leaves the work where it is.
  for w in
    select * from (values
      ('PUSH', 'uskoci-push-transport', '{"action":"tick"}'::jsonb,
        exists (select 1 from public.notification_deliveries d
                 where d.channel = 'PUSH' and d.push_started_at is null
                   and d.state in ('CREATED', 'QUEUED', 'FAILED_RETRYABLE'))
        or exists (select 1 from public.notification_push_attempts a
                    where a.transport_state in ('PENDING', 'RETRYABLE', 'SEND_LEASED', 'SEND_STARTED',
                                                'TICKET_PENDING', 'RECEIPT_LEASED'))),
      ('DATA_EXPORT', 'uskoci-data-export-worker', '{"action":"tick"}'::jsonb,
        (private.data_export_policy_binding() is not null
          and exists (select 1 from public.data_export_requests r
                       where r.export_revoked_at is null and r.status in ('REQUESTED', 'PROCESSING')))
        or exists (select 1 from private.data_export_artifacts x where x.cleanup_not_before <= p_at)),
      ('ACCOUNT_CLOSURE', 'uskoci-account-closure-worker', '{"action":"maintenance","maxSteps":8}'::jsonb,
        private.closure_erasure_binding_v5() is not null
        and exists (select 1 from private.closure_executions_v5 e where e.state = 'EXECUTING'))
    ) x(worker, slug, body, has_work)
  loop
    if w.has_work then
      v_workers := v_workers || jsonb_build_object(w.worker, jsonb_build_object('requestId',
        net.http_post(
          url := v_base || '/functions/v1/' || w.slug,
          body := w.body,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
          timeout_milliseconds := 60000)));
    else
      v_workers := v_workers || jsonb_build_object(w.worker, 'IDLE');
    end if;
  end loop;
  return jsonb_build_object('kind', 'TICKED', 'workers', v_workers);
end
$function$;
revoke all on function private.edge_worker_tick_v5(timestamptz) from public, anon, authenticated, service_role;
comment on function private.edge_worker_tick_v5(timestamptz) is
  'PKG-028a: once a minute, call each Edge worker that has work, with the service key the owner stored in Vault.';

select cron.schedule('uskoci_edge_workers', '* * * * *', 'select private.edge_worker_tick_v5()');

do $post$
begin
  if has_function_privilege('anon', 'private.edge_worker_tick_v5(timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.edge_worker_tick_v5(timestamptz)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.edge_worker_tick_v5(timestamptz)', 'EXECUTE') then
    raise exception 'PKG028A_TICK_EXECUTABLE_BY_CLIENTS';
  end if;
  if has_schema_privilege('anon', 'net', 'USAGE') or has_schema_privilege('authenticated', 'net', 'USAGE') then
    raise exception 'PKG028A_NET_SCHEMA_STILL_OPEN';
  end if;
  -- The tick runs as the database owner, who must still be able to send.
  if not has_schema_privilege(current_user, 'net', 'USAGE')
     or not exists (select 1 from pg_proc p where p.pronamespace = 'net'::regnamespace and p.proname = 'http_post'
                     and has_function_privilege(current_user, p.oid, 'EXECUTE')) then
    raise exception 'PKG028A_TICK_CANNOT_SEND';
  end if;
  if (select count(*) from cron.job where jobname = 'uskoci_edge_workers' and active and schedule = '* * * * *'
        and command = 'select private.edge_worker_tick_v5()' and username = current_user) <> 1 then
    raise exception 'PKG028A_JOB_NOT_SCHEDULED';
  end if;
  if (select count(*) from vault.decrypted_secrets where name = 'uskoci_edge_base_url'
        and decrypted_secret = 'https://leqcwgzvjsxugfgzdmth.supabase.co') <> 1
     or exists (select 1 from vault.secrets where name = 'uskoci_edge_worker_key') then
    raise exception 'PKG028A_VAULT_STATE';
  end if;
  -- Without the key nothing is sent.
  if private.edge_worker_tick_v5() is distinct from '{"kind":"NOT_CONFIGURED","missing":"WORKER_KEY"}'::jsonb then
    raise exception 'PKG028A_TICK_SENDS_WITHOUT_KEY';
  end if;
  if (select source_digest from pkg028a_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG028A_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
commit;
