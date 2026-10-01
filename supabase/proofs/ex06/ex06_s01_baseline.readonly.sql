-- EX-06 slice S01: READ-ONLY baseline of the EX-06 chain on canonical DEV (leqcwgzvjsxugfgzdmth). SELECT only; no write, no function call with side effects.
-- Run each statement separately (the Supabase connector returns one result set per call). The same three statements give the AFTER of any later EX-06 package.
-- Counts are aggregate only (no row content, no personal data). md5 is taken over prosrc with carriage returns removed (the convention of the earlier receipts).

-- 1. ledger, function body pins, candidate tables
select 'ledger' as k, (select count(*)::text from supabase_migrations.schema_migrations) as v, (select string_agg(version, ',' order by version desc) from (select version from supabase_migrations.schema_migrations order by version desc limit 3) x) as extra
union all
select 'fn', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', md5(replace(p.prosrc, E'\r', ''))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('match_detail','match_detail_for_calendar_interval','match_detail_without_calendar','dispatch_next_wave','dispatch_tick','dispatch_cheap_candidate_admitted','candidate_profile_ids','emit_event','push_suppression','work_kinds_v5','requeue_open_needs_for_worker_v5','rpc_begin_push_send','closure_source_digest_v5','closure_erasure_binding_v5')
order by 1, 2;

-- 2. certificate (certified binding vs live digest) and the columns of the chain's tables
select 'cert' as t, 'live_digest' as c, private.closure_source_digest_v5()::text as v
union all select 'cert', 'binding', (private.closure_erasure_binding_v5())::text
union all
select 'col', table_name, string_agg(column_name, ',' order by ordinal_position)
from information_schema.columns
where table_schema = 'public' and table_name in ('app_profiles','dispatch_rounds','opportunity_deliveries','notification_deliveries','user_activity_events','needs','profile_availability_rules','profile_availability_windows','worker_match_preferences')
group by table_name
order by 1, 2;

-- 3. aggregate state of the chain: profiles, availability, location, needs, dispatch rounds, deliveries, events, cron, worker AI
select 'profiles' as g, kind || '/' || profile_status as k, count(*) as n from public.app_profiles group by 1,2
union all select 'workers_active_with_skills', 'skills_nonempty=' || (coalesce(cardinality(skills),0) > 0)::text, count(*) from public.app_profiles where kind = 'WORKER' and profile_status = 'ACTIVE' group by 1,2
union all select 'workers_active_availability', 'rules_or_windows=' || (exists(select 1 from public.profile_availability_rules r where r.profile_id = p.id and r.active) or exists(select 1 from public.profile_availability_windows w where w.profile_id = p.id) or p.available_now)::text, count(*) from public.app_profiles p where kind = 'WORKER' and profile_status = 'ACTIVE' group by 1,2
union all select 'workers_active_location', 'pref_with_location=' || (exists(select 1 from public.worker_match_preferences m where m.worker_profile_id = p.id and m.approximate_geog is not null))::text, count(*) from public.app_profiles p where kind = 'WORKER' and profile_status = 'ACTIVE' group by 1,2
union all select 'needs', status || '/' || mode, count(*) from public.needs group by 1,2
union all select 'needs_open_fields', 'skills=' || (coalesce(cardinality(required_skills),0) > 0)::text || ' minexp>0=' || (coalesce(minimum_experience_years,0) > 0)::text || ' identity=' || coalesce(verified_identity_required,false)::text, count(*) from public.needs where status in ('OPEN','PUBLISHED','ACTIVE') group by 1,2
union all select 'dispatch_rounds', status || '/' || coalesce(stop_reason,'-'), count(*) from public.dispatch_rounds group by 1,2
union all select 'opportunity_deliveries', status, count(*) from public.opportunity_deliveries group by 1,2
union all select 'opp_dupes', 'worker+need+revision groups with >1', count(*) from (select 1 from public.opportunity_deliveries group by worker_profile_id, need_id, need_revision having count(*) > 1) d
union all select 'events', event_type, count(*) from public.user_activity_events where event_type in ('OPPORTUNITY_AVAILABLE') group by 1,2
union all select 'opp_event_deliveries', d.channel || '/' || d.state || '/' || coalesce(d.suppression_reason,'-'), count(*) from public.notification_deliveries d join public.user_activity_events e on e.id = d.event_id where e.event_type = 'OPPORTUNITY_AVAILABLE' group by 1,2
union all select 'worker_ai_sessions', 'all', count(*) from private.worker_ai_sessions
union all select 'worker_ai_saves', 'all', count(*) from private.worker_ai_saves
union all select 'cron_24h', status, count(*) from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname ilike '%marketplace%' and d.start_time > now() - interval '24 hours' group by 1,2
order by 1,2;
