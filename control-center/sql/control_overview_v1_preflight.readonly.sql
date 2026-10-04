-- USKOČI CONTROL Overview v1 — READ-ONLY preflight.
-- Safe intent: schema/ACL/RLS/index/count/plan inspection only. No DDL/DML.
set statement_timeout = '10s';
set lock_timeout = '3s';

select jsonb_build_object(
  'checkedAt',statement_timestamp(),
  'relations',jsonb_build_object(
    'app_accounts',to_regclass('public.app_accounts') is not null,
    'app_profiles',to_regclass('public.app_profiles') is not null,
    'needs',to_regclass('public.needs') is not null,
    'marketplace_responses',to_regclass('public.marketplace_responses') is not null,
    'agreements',to_regclass('public.agreements') is not null,
    'agreement_reviews',to_regclass('private.agreement_reviews') is not null,
    'notification_deliveries',to_regclass('public.notification_deliveries') is not null,
    'notification_push_attempts',to_regclass('public.notification_push_attempts') is not null,
    'ai_conversations',to_regclass('public.ai_conversations') is not null
  ),
  'candidateAlreadyExists',to_regprocedure('public.rpc_control_overview_v1()') is not null
);

select table_schema,table_name,column_name,data_type
from information_schema.columns
where (table_schema,table_name,column_name) in (
 ('public','app_accounts','created_at'),
 ('public','app_profiles','kind'),
 ('public','app_profiles','profile_status'),
 ('public','app_profiles','available_now'),
 ('public','needs','status'),
 ('public','needs','created_at'),
 ('public','marketplace_responses','status'),
 ('public','marketplace_responses','created_at'),
 ('public','agreements','status'),
 ('public','agreements','created_at'),
 ('private','agreement_reviews','created_at'),
 ('public','notification_deliveries','channel'),
 ('public','notification_deliveries','state'),
 ('public','notification_deliveries','created_at'),
 ('public','notification_deliveries','expires_at'),
 ('public','notification_push_attempts','outcome'),
 ('public','notification_push_attempts','created_at'),
 ('public','ai_conversations','purpose'),
 ('public','ai_conversations','status'),
 ('public','ai_conversations','created_at')
)
order by table_schema,table_name,column_name;

select n.nspname as schema_name,c.relname as relation_name,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where (n.nspname,c.relname) in (
 ('public','app_accounts'),('public','app_profiles'),('public','needs'),
 ('public','marketplace_responses'),('public','agreements'),('private','agreement_reviews'),
 ('public','notification_deliveries'),('public','notification_push_attempts'),('public','ai_conversations')
)
order by 1,2;

select schemaname,tablename,indexname,indexdef
from pg_indexes
where (schemaname,tablename) in (
 ('public','app_accounts'),('public','app_profiles'),('public','needs'),
 ('public','marketplace_responses'),('public','agreements'),('private','agreement_reviews'),
 ('public','notification_deliveries'),('public','notification_push_attempts'),('public','ai_conversations')
)
order by schemaname,tablename,indexname;

-- Counts only; no identity, text body, address, token or message content.
select jsonb_build_object(
 'accounts', (select count(*) from public.app_accounts),
 'profiles', (select count(*) from public.app_profiles),
 'needs', (select count(*) from public.needs),
 'responses', (select count(*) from public.marketplace_responses),
 'agreements', (select count(*) from public.agreements),
 'reviews', (select count(*) from private.agreement_reviews),
 'pushDeliveries24h', (select count(*) from public.notification_deliveries where channel='PUSH' and created_at>=statement_timestamp()-interval '24 hours'),
 'pushAttempts24h', (select count(*) from public.notification_push_attempts where created_at>=statement_timestamp()-interval '24 hours'),
 'aiConversations24h', (select count(*) from public.ai_conversations where created_at>=statement_timestamp()-interval '24 hours')
);

explain (format json)
select status,count(*) from public.needs group by status;

explain (format json)
select status,count(*) from public.marketplace_responses group by status;

explain (format json)
select status,count(*) from public.agreements group by status;

explain (format json)
select state,count(*) from public.notification_deliveries
where channel='PUSH' and created_at>=statement_timestamp()-interval '24 hours'
group by state;

explain (format json)
select outcome,count(*) from public.notification_push_attempts
where created_at>=statement_timestamp()-interval '24 hours'
group by outcome;

explain (format json)
select purpose,status,count(*) from public.ai_conversations
where created_at>=statement_timestamp()-interval '24 hours'
group by purpose,status;
