-- USKOČI CONTROL v0.4 — SOURCE-ONLY candidate.
-- DO NOT APPLY from this file. Canonical DEV readback + EXPLAIN/security proof is required first.
-- Purpose: one small owner/server-only aggregate for the Overview screen.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '5s';
set local search_path = pg_catalog;

create or replace function public.rpc_control_overview_v1()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $function$
with
account_counts as (
  select
    count(*)::bigint as registered_total,
    count(*) filter (where created_at >= statement_timestamp() - interval '24 hours')::bigint as registered_24h
  from public.app_accounts
),
worker_counts as (
  select
    count(*) filter (where kind='WORKER' and profile_status='ACTIVE')::bigint as active_worker_profiles,
    count(*) filter (where kind='WORKER' and profile_status='ACTIVE' and available_now)::bigint as available_now
  from public.app_profiles
),
need_counts as (
  select
    (select coalesce(jsonb_object_agg(status,n order by status),'{}'::jsonb)
       from (select status,count(*)::bigint n from public.needs group by status) s) as by_status,
    count(*) filter (where status in ('PUBLISHED','SELECTION','ACTIVE'))::bigint as active_count,
    count(*) filter (where status in ('PUBLISHED','SELECTION')
      and (response_deadline is null or response_deadline>statement_timestamp()))::bigint as open_for_applications_count,
    count(*) filter (where created_at>=statement_timestamp()-interval '24 hours')::bigint as created_24h,
    count(*) filter (where published_at>=statement_timestamp()-interval '24 hours')::bigint as published_24h
  from public.needs
),
response_counts as (
  select
    (select coalesce(jsonb_object_agg(status,n order by status),'{}'::jsonb)
       from (select status,count(*)::bigint n from public.marketplace_responses group by status) s) as by_status,
    count(*) filter (where created_at>=statement_timestamp()-interval '24 hours')::bigint as created_24h,
    count(*) filter (where submitted_at>=statement_timestamp()-interval '24 hours')::bigint as submitted_24h
  from public.marketplace_responses
),
agreement_counts as (
  select
    (select coalesce(jsonb_object_agg(status,n order by status),'{}'::jsonb)
       from (select status,count(*)::bigint n from public.agreements group by status) s) as by_status,
    count(*) filter (where status='CONFIRMED')::bigint as active_count,
    count(*) filter (where created_at>=statement_timestamp()-interval '24 hours')::bigint as created_24h
  from public.agreements
),
completion_counts as (
  select
    count(*) filter (
      where a.status='COMPLETED' and x.state='COMPLETED'
        and x.completed_at>=statement_timestamp()-interval '24 hours'
    )::bigint as completed_24h,
    count(*) filter (
      where (a.status='COMPLETED' and coalesce(x.state,'')<>'COMPLETED')
         or (a.status<>'COMPLETED' and x.state='COMPLETED')
    )::bigint as completion_mismatch_count
  from public.agreements a
  left join public.agreement_execution x on x.agreement_id=a.id
),
review_counts as (
  select
    count(*)::bigint as total,
    count(*) filter (where created_at >= statement_timestamp() - interval '24 hours')::bigint as created_24h
  from private.agreement_reviews
),
push_delivery_counts as (
  select jsonb_object_agg(state, n order by state) as by_state
  from (
    select state, count(*)::bigint n
    from public.notification_deliveries
    where channel='PUSH'
      and created_at >= statement_timestamp() - interval '24 hours'
    group by state
  ) d
),
push_backlog as (
  select count(*)::bigint as overdue_backlog
  from public.notification_deliveries
  where channel='PUSH'
    and state in ('CREATED','QUEUED','FAILED_RETRYABLE')
    and created_at < statement_timestamp() - interval '15 minutes'
    and (expires_at is null or expires_at > statement_timestamp())
),
push_attempt_counts as (
  select jsonb_object_agg(outcome, n order by outcome) as by_outcome
  from (
    select outcome, count(*)::bigint n
    from public.notification_push_attempts
    where created_at >= statement_timestamp() - interval '24 hours'
    group by outcome
  ) s
),
ai_counts as (
  select jsonb_object_agg(purpose || ':' || status, n order by purpose, status) as by_purpose_status
  from (
    select purpose, status, count(*)::bigint n
    from public.ai_conversations
    where created_at >= statement_timestamp() - interval '24 hours'
    group by purpose, status
  ) s
)
select jsonb_build_object(
  'schemaVersion','CONTROL_OVERVIEW_V1',
  'capturedAt',statement_timestamp(),
  'freshness','LIVE',
  'accounts',jsonb_build_object(
    'registeredTotal',(select registered_total from account_counts),
    'registered24h',(select registered_24h from account_counts),
    'active24h',null,
    'active24hState','UNKNOWN',
    'active24hReason','NO_CANONICAL_CROSS_APP_ACTIVITY_SIGNAL'
  ),
  'workers',jsonb_build_object(
    'activeProfiles',(select active_worker_profiles from worker_counts),
    'availableNow',(select available_now from worker_counts)
  ),
  'needs',jsonb_build_object(
    'byStatus',coalesce((select by_status from need_counts),'{}'::jsonb),
    'activeCount',coalesce((select active_count from need_counts),0),
    'openForApplicationsCount',coalesce((select open_for_applications_count from need_counts),0),
    'created24h',coalesce((select created_24h from need_counts),0),
    'published24h',coalesce((select published_24h from need_counts),0)
  ),
  'responses',jsonb_build_object(
    'byStatus',coalesce((select by_status from response_counts),'{}'::jsonb),
    'created24h',coalesce((select created_24h from response_counts),0),
    'submitted24h',coalesce((select submitted_24h from response_counts),0)
  ),
  'agreements',jsonb_build_object(
    'byStatus',coalesce((select by_status from agreement_counts),'{}'::jsonb),
    'activeCount',coalesce((select active_count from agreement_counts),0),
    'created24h',coalesce((select created_24h from agreement_counts),0),
    'completed24h',coalesce((select completed_24h from completion_counts),0),
    'completionMismatchCount',coalesce((select completion_mismatch_count from completion_counts),0)
  ),
  'reviews',jsonb_build_object(
    'total',(select total from review_counts),
    'created24h',(select created_24h from review_counts)
  ),
  'push',jsonb_build_object(
    'deliveries24hByState',coalesce((select by_state from push_delivery_counts),'{}'::jsonb),
    'attempts24hByOutcome',coalesce((select by_outcome from push_attempt_counts),'{}'::jsonb),
    'overdueBacklog',coalesce((select overdue_backlog from push_backlog),0)
  ),
  'ai',jsonb_build_object(
    'conversations24h',coalesce((select by_purpose_status from ai_counts),'{}'::jsonb)
  ),
  'privacy',jsonb_build_object(
    'containsEmail',false,
    'containsPhone',false,
    'containsExactAddress',false,
    'containsPushToken',false,
    'containsChatBody',false
  )
);
$function$;

revoke all on function public.rpc_control_overview_v1() from public, anon, authenticated, service_role;
grant execute on function public.rpc_control_overview_v1() to service_role;

comment on function public.rpc_control_overview_v1() is
  'USKOCI CONTROL source-only candidate. Aggregate read only. SECURITY DEFINER is required only because canonical review/push internals deny raw service-role table access; EXECUTE stays service-only and browser never receives the privileged key. Requires live preflight/security/performance proof before DEV application.';

rollback;
