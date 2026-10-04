-- USKOČI CONTROL v0.5 inspectors — READ-ONLY preflight.
-- No DDL/DML. Intended for canonical DEV before any Control inspector apply.
set statement_timeout='10s';
set lock_timeout='3s';

select jsonb_build_object(
 'checkedAt',statement_timestamp(),
 'relations',jsonb_build_object(
  'app_accounts',to_regclass('public.app_accounts') is not null,
  'app_profiles',to_regclass('public.app_profiles') is not null,
  'needs',to_regclass('public.needs') is not null,
  'need_sensitive',to_regclass('public.need_sensitive') is not null,
  'marketplace_responses',to_regclass('public.marketplace_responses') is not null,
  'need_selections',to_regclass('public.need_selections') is not null,
  'agreements',to_regclass('public.agreements') is not null,
  'agreement_versions',to_regclass('public.agreement_versions') is not null,
  'agreement_execution',to_regclass('public.agreement_execution') is not null,
  'agreement_messages',to_regclass('public.agreement_messages') is not null,
  'agreement_reviews',to_regclass('private.agreement_reviews') is not null,
  'user_activity_events',to_regclass('public.user_activity_events') is not null
 ),
 'coverageHelper',to_regprocedure('public.fn_need_covered_slots(uuid)') is not null,
 'searchCandidateAlreadyExists',to_regprocedure('public.rpc_control_search_v1(text,integer)') is not null,
 'userCandidateAlreadyExists',to_regprocedure('public.rpc_control_user_v1(uuid)') is not null,
 'taskCandidateAlreadyExists',to_regprocedure('public.rpc_control_task_v1(uuid)') is not null,
 'agreementCandidateAlreadyExists',to_regprocedure('public.rpc_control_agreement_v1(uuid)') is not null
);

select table_schema,table_name,column_name,data_type
from information_schema.columns
where (table_schema,table_name,column_name) in (
 ('public','app_accounts','id'),('public','app_accounts','full_name'),('public','app_accounts','email'),('public','app_accounts','phone'),('public','app_accounts','city'),('public','app_accounts','active_mode'),('public','app_accounts','onboarding_complete'),('public','app_accounts','created_at'),
 ('public','app_profiles','id'),('public','app_profiles','account_id'),('public','app_profiles','kind'),('public','app_profiles','display_name'),('public','app_profiles','profile_status'),('public','app_profiles','skills'),('public','app_profiles','tools'),('public','app_profiles','vehicles'),('public','app_profiles','licenses'),('public','app_profiles','radius_km'),('public','app_profiles','available_now'),('public','app_profiles','team_capacity'),
 ('public','needs','id'),('public','needs','requester_account_id'),('public','needs','status'),('public','needs','title'),('public','needs','category'),('public','needs','revision'),('public','needs','approximate_city'),('public','needs','approximate_area'),('public','needs','schedule_kind'),('public','needs','starts_at'),('public','needs','ends_at'),('public','needs','response_deadline'),('public','needs','required_slots'),('public','needs','mode'),('public','needs','requester_price_rsd'),('public','needs','required_skills'),('public','needs','required_tools'),('public','needs','required_vehicles'),('public','needs','urgent'),('public','needs','urgent_expires_at'),('public','needs','execution_location_mode'),('public','needs','created_at'),('public','needs','published_at'),
 ('public','need_sensitive','need_id'),('public','need_sensitive','exact_address'),('public','need_sensitive','exact_lat'),('public','need_sensitive','exact_lng'),
 ('public','marketplace_responses','id'),('public','marketplace_responses','need_id'),('public','marketplace_responses','worker_account_id'),('public','marketplace_responses','response_kind'),('public','marketplace_responses','status'),('public','marketplace_responses','submitted_at'),('public','marketplace_responses','created_at'),
 ('public','need_selections','need_id'),('public','need_selections','covered_slots'),('public','need_selections','status'),
 ('public','agreements','id'),('public','agreements','need_id'),('public','agreements','requester_account_id'),('public','agreements','worker_account_id'),('public','agreements','requester_profile_id'),('public','agreements','worker_profile_id'),('public','agreements','current_version'),('public','agreements','status'),('public','agreements','created_at'),
 ('public','agreement_versions','agreement_id'),('public','agreement_versions','version'),('public','agreement_versions','terms'),
 ('public','agreement_execution','agreement_id'),('public','agreement_execution','state'),('public','agreement_execution','mode'),('public','agreement_execution','worker_marked_done_at'),('public','agreement_execution','requester_deadline_at'),('public','agreement_execution','problem_opened_at'),('public','agreement_execution','completed_at'),
 ('public','agreement_messages','agreement_id'),('public','agreement_messages','created_at'),
 ('private','agreement_reviews','agreement_id'),('private','agreement_reviews','reviewer_account_id'),('private','agreement_reviews','target_account_id'),('private','agreement_reviews','rating'),('private','agreement_reviews','created_at'),
 ('public','user_activity_events','recipient_user_id'),('public','user_activity_events','recipient_role'),('public','user_activity_events','event_type'),('public','user_activity_events','entity_type'),('public','user_activity_events','entity_id'),('public','user_activity_events','urgency'),('public','user_activity_events','created_at')
)
order by table_schema,table_name,column_name;

select n.nspname schema_name,c.relname relation_name,c.relrowsecurity rls,c.relforcerowsecurity force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname,c.relname) in (
 ('public','app_accounts'),('public','app_profiles'),('public','needs'),('public','need_sensitive'),
 ('public','marketplace_responses'),('public','need_selections'),('public','agreements'),('public','agreement_versions'),
 ('public','agreement_execution'),('public','agreement_messages'),('private','agreement_reviews'),('public','user_activity_events')
)
order by 1,2;

select schemaname,tablename,indexname,indexdef
from pg_indexes
where (schemaname,tablename) in (
 ('public','app_accounts'),('public','needs'),('public','marketplace_responses'),('public','need_selections'),
 ('public','agreements'),('public','agreement_messages'),('private','agreement_reviews'),('public','user_activity_events')
)
order by schemaname,tablename,indexname;

explain (format json)
select id,full_name,city from public.app_accounts where lower(full_name) like '__control_probe__%' order by created_at desc limit 20;
explain (format json)
select id,title,approximate_city,status from public.needs where lower(title) like '__control_probe__%' order by created_at desc limit 20;
explain (format json)
select r.id,n.title,r.status from public.marketplace_responses r join public.needs n on n.id=r.need_id
where lower(n.title) like '__control_probe__%' order by r.created_at desc limit 20;
explain (format json)
select a.id,n.title,a.status from public.agreements a join public.needs n on n.id=a.need_id
where lower(n.title) like '__control_probe__%' order by a.created_at desc limit 20;
explain (format json)
select status,count(*) from public.needs where requester_account_id='00000000-0000-4000-8000-000000000000'::uuid group by status;
explain (format json)
select status,count(*) from public.marketplace_responses where worker_account_id='00000000-0000-4000-8000-000000000000'::uuid group by status;
explain (format json)
select status,count(*) from public.need_selections where need_id='00000000-0000-4000-8000-000000000000'::uuid group by status;
explain (format json)
select count(*),max(created_at) from public.agreement_messages where agreement_id='00000000-0000-4000-8000-000000000000'::uuid;
explain (format json)
select event_type,entity_type,urgency,recipient_role,created_at from public.user_activity_events
where recipient_user_id='00000000-0000-4000-8000-000000000000'::uuid
order by created_at desc,id desc limit 25;
