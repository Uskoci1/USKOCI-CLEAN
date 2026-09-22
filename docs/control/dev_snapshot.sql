-- Read-only snapshot of canonical DEV (leqcwgzvjsxugfgzdmth) for the control table.
-- Run it through the Supabase connector (execute_sql), add the Edge list from list_edge_functions, and save the
-- result as docs/control/dev_snapshot.json in the same shape. It reads catalog metadata only: no rows of user data,
-- no secrets, no writes.
select json_build_object(
  'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'ledger_total', (select count(*) from supabase_migrations.schema_migrations),
  'ledger_dev_alpha', (select count(*) from supabase_migrations.schema_migrations where name like 'dev_alpha%'),
  'ledger_last', (select name from supabase_migrations.schema_migrations order by version desc limit 1),
  'certificate_live', private.closure_source_digest_v5(),
  'certificate_certified', (select sha256 from private.closure_source_v5 where singleton),
  'retention_ai_ready', private.retention_ai_source_ready(),
  'cron', (select json_agg(json_build_object('job', jobname, 'schedule', schedule, 'active', active) order by jobname) from cron.job),
  'cron_failures_24h', (select count(*) filter (where status = 'failed') from cron.job_run_details where start_time > now() - interval '24 hours'),
  'cron_runs_24h', (select count(*) from cron.job_run_details where start_time > now() - interval '24 hours'),
  'rpc_all', (select json_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname like 'rpc\_%'),
  'rpc_authenticated', (select json_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname like 'rpc\_%' and has_function_privilege('authenticated', p.oid, 'EXECUTE'))
) as snapshot;
