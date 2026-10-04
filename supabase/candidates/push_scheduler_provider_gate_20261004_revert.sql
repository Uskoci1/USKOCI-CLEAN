-- SOURCE-ONLY revert for push_scheduler_provider_gate_20261004.sql.
-- DO NOT APPLY without the owner's explicit approval.
do $preflight$
declare v_md5 text;
begin
  select md5(p.prosrc) into v_md5
  from pg_proc p
  where p.oid=to_regprocedure('private.edge_worker_tick_v5(timestamp with time zone)');
  if v_md5 is distinct from 'fb29dc0b7c39aa8305c0a728f33d07dc' then
    raise exception 'PUSH_SCHEDULER_REVERT_SOURCE_CHANGED';
  end if;
end
$preflight$;

create or replace function private.edge_worker_tick_v5(
  p_at timestamp with time zone default statement_timestamp()
)
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
  -- The shape of a server key, a legacy JWT or a secret key (the length is checked apart: a regular expression
  -- repetition count cannot exceed 255). The key itself is never returned or logged.
  if v_key is null or length(v_key) not between 16 and 4096 or v_key !~ '^[A-Za-z0-9._~-]+$' then
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
          -- PKG-030a: on apikey. A secret key (sb_secret_) is not a JWT, so as a Bearer it never passes the gateway.
          headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
          timeout_milliseconds := 60000)));
    else
      v_workers := v_workers || jsonb_build_object(w.worker, 'IDLE');
    end if;
  end loop;
  return jsonb_build_object('kind', 'TICKED', 'workers', v_workers);
end
$function$;

do $postflight$
declare v_md5 text;
begin
  select md5(p.prosrc) into v_md5
  from pg_proc p
  where p.oid=to_regprocedure('private.edge_worker_tick_v5(timestamp with time zone)');
  if v_md5 is distinct from 'f9485392ceb2db1e06a982da7ee9b049' then
    raise exception 'PUSH_SCHEDULER_REVERT_MISMATCH';
  end if;
end
$postflight$;
