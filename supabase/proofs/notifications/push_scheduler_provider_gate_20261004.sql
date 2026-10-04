\set ON_ERROR_STOP on
create schema if not exists private;
create schema if not exists vault;
create schema if not exists net;

create table vault.decrypted_secrets(name text primary key,decrypted_secret text not null);
insert into vault.decrypted_secrets values
 ('uskoci_edge_base_url','http://supabase_kong_test:8000'),
 ('uskoci_edge_worker_key','sb_secret_abcdefghijklmnop');

create table private.processor_provider_inventory(code text primary key,active boolean not null);
insert into private.processor_provider_inventory values ('EXPO_PUSH',false);
create table public.notification_deliveries(channel text,push_started_at timestamptz,state text);
create table public.notification_push_attempts(transport_state text);
create table public.data_export_requests(export_revoked_at timestamptz,status text);
create table private.data_export_artifacts(cleanup_not_before timestamptz);
create table private.closure_executions_v5(state text);
create table private.test_worker_flags(name text primary key,enabled boolean not null default false);
insert into private.test_worker_flags values ('export',false),('closure',false);
create table private.http_calls(id bigserial primary key,url text not null,body jsonb not null,headers jsonb not null,timeout_ms integer not null);

create or replace function private.data_export_policy_binding()
returns text language sql stable set search_path='pg_catalog'
as $$ select case when (select enabled from private.test_worker_flags where name='export') then 'READY' else null end $$;

create or replace function private.closure_erasure_binding_v5()
returns text language sql stable set search_path='pg_catalog'
as $$ select case when (select enabled from private.test_worker_flags where name='closure') then 'READY' else null end $$;

create or replace function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer)
returns bigint language plpgsql as $$
declare v_id bigint;
begin
 insert into private.http_calls(url,body,headers,timeout_ms)
 values(url,body,headers,timeout_milliseconds) returning id into v_id;
 return v_id;
end $$;

-- Exact live predecessor fixture copied from read-only canonical DEV.
create or replace function private.edge_worker_tick_v5(p_at timestamp with time zone default statement_timestamp())
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

do $$
declare h text;
begin
 select md5(prosrc) into h
 from pg_proc where oid=to_regprocedure('private.edge_worker_tick_v5(timestamp with time zone)');
 if h <> 'f9485392ceb2db1e06a982da7ee9b049' then
   raise exception 'BASELINE_HASH_MISMATCH:%',h;
 end if;
end $$;

\ir ../../candidates/push_scheduler_provider_gate_20261004.sql

-- Inactive provider + actionable delivery: no PUSH Edge call and no backlog mutation.
insert into public.notification_deliveries values ('PUSH',null,'CREATED');
do $$
declare r jsonb;
begin
 r:=private.edge_worker_tick_v5();
 if r#>>'{workers,PUSH}' <> 'IDLE' then raise exception 'INACTIVE_PUSH_NOT_IDLE:%',r; end if;
 if exists(select 1 from private.http_calls) then raise exception 'INACTIVE_PUSH_CALLED_EDGE'; end if;
 if (select count(*) from public.notification_deliveries)<>1 then raise exception 'BACKLOG_MUTATED'; end if;
end $$;

-- Active provider + same backlog: exactly one PUSH call.
update private.processor_provider_inventory set active=true where code='EXPO_PUSH';
truncate private.http_calls;
do $$
declare r jsonb;
begin
 r:=private.edge_worker_tick_v5();
 if jsonb_typeof(r#>'{workers,PUSH}') <> 'object' then raise exception 'ACTIVE_PUSH_NOT_CALLED:%',r; end if;
 if (select count(*) from private.http_calls where url like '%/functions/v1/uskoci-push-transport')<>1 then
   raise exception 'PUSH_CALL_COUNT';
 end if;
end $$;

-- Inactive provider + ticket pending only: still no Edge call.
update private.processor_provider_inventory set active=false where code='EXPO_PUSH';
truncate public.notification_deliveries, public.notification_push_attempts, private.http_calls;
insert into public.notification_push_attempts values ('TICKET_PENDING');
do $$
declare r jsonb;
begin
 r:=private.edge_worker_tick_v5();
 if r#>>'{workers,PUSH}' <> 'IDLE' then raise exception 'INACTIVE_TICKET_NOT_IDLE:%',r; end if;
 if exists(select 1 from private.http_calls) then raise exception 'INACTIVE_TICKET_CALLED_EDGE'; end if;
end $$;

-- DATA_EXPORT remains independent.
truncate private.http_calls;
update private.test_worker_flags set enabled=true where name='export';
insert into public.data_export_requests values (null,'REQUESTED');
do $$
declare r jsonb;
begin
 r:=private.edge_worker_tick_v5();
 if jsonb_typeof(r#>'{workers,DATA_EXPORT}') <> 'object' then raise exception 'EXPORT_NOT_CALLED:%',r; end if;
 if (select count(*) from private.http_calls where url like '%/functions/v1/uskoci-data-export-worker')<>1 then
   raise exception 'EXPORT_CALL_COUNT';
 end if;
end $$;

-- ACCOUNT_CLOSURE remains independent.
truncate private.http_calls;
update private.test_worker_flags set enabled=true where name='closure';
insert into private.closure_executions_v5 values ('EXECUTING');
do $$
declare r jsonb;
begin
 r:=private.edge_worker_tick_v5();
 if jsonb_typeof(r#>'{workers,ACCOUNT_CLOSURE}') <> 'object' then raise exception 'CLOSURE_NOT_CALLED:%',r; end if;
 if (select count(*) from private.http_calls where url like '%/functions/v1/uskoci-account-closure-worker')<>1 then
   raise exception 'CLOSURE_CALL_COUNT';
 end if;
end $$;

select md5(prosrc) as candidate_body_md5,prosecdef,proconfig
from pg_proc
where oid=to_regprocedure('private.edge_worker_tick_v5(timestamp with time zone)');

do $$
declare h text;
begin
 select md5(prosrc) into h
 from pg_proc where oid=to_regprocedure('private.edge_worker_tick_v5(timestamp with time zone)');
 if h <> 'fb29dc0b7c39aa8305c0a728f33d07dc' then
   raise exception 'CANDIDATE_HASH_MISMATCH:%',h;
 end if;
end $$;

-- A revert must be exact and restore the old scheduler semantics, while still
-- leaving every queued row untouched.
update private.test_worker_flags set enabled=false;
update private.processor_provider_inventory set active=false where code='EXPO_PUSH';
truncate public.notification_deliveries, public.notification_push_attempts, private.http_calls;
insert into public.notification_deliveries values ('PUSH',null,'CREATED');

\ir ../../candidates/push_scheduler_provider_gate_20261004_revert.sql

do $$
declare r jsonb; before_count bigint;
begin
 select count(*) into before_count from public.notification_deliveries;
 r:=private.edge_worker_tick_v5();
 if jsonb_typeof(r#>'{workers,PUSH}') <> 'object' then raise exception 'REVERT_DID_NOT_RESTORE_PUSH_CALL:%',r; end if;
 if (select count(*) from private.http_calls where url like '%/functions/v1/uskoci-push-transport')<>1 then
   raise exception 'REVERT_PUSH_CALL_COUNT';
 end if;
 if (select count(*) from public.notification_deliveries)<>before_count then raise exception 'REVERT_MUTATED_BACKLOG'; end if;
end $$;

select md5(prosrc) as reverted_body_md5,prosecdef,proconfig
from pg_proc
where oid=to_regprocedure('private.edge_worker_tick_v5(timestamp with time zone)');
