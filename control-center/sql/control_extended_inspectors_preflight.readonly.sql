-- USKOČI CONTROL v0.9+ inspector preflight — READ ONLY.
-- No DDL, no DML, no RPC execution with side effects.
set statement_timeout='10s';
set lock_timeout='3s';

select jsonb_build_object(
 'checkedAt',statement_timestamp(),
 'relations',jsonb_build_object(
  'responses',to_regclass('public.marketplace_responses') is not null,
  'responseVersions',to_regclass('public.marketplace_response_versions') is not null,
  'selections',to_regclass('public.need_selections') is not null,
  'agreements',to_regclass('public.agreements') is not null,
  'events',to_regclass('public.user_activity_events') is not null,
  'preferences',to_regclass('public.notification_preferences') is not null,
  'deliveries',to_regclass('public.notification_deliveries') is not null,
  'pushAttempts',to_regclass('public.notification_push_attempts') is not null,
  'pushDevices',to_regclass('public.notification_push_devices') is not null,
  'aiConversations',to_regclass('public.ai_conversations') is not null,
  'aiMessages',to_regclass('public.ai_messages') is not null,
  'aiFacts',to_regclass('public.ai_structured_facts') is not null,
  'aiProposals',to_regclass('public.ai_action_proposals') is not null,
  'dispatchRounds',to_regclass('public.dispatch_rounds') is not null,
  'opportunityDeliveries',to_regclass('public.opportunity_deliveries') is not null
 ),
 'authorities',jsonb_build_object(
  'matchDetail',to_regprocedure('private.match_detail(uuid,uuid)') is not null,
  'coveredSlots',to_regprocedure('public.fn_need_covered_slots(uuid)') is not null,
  'pushReadiness',to_regprocedure('public.rpc_get_push_readiness()') is not null
 ),
 'controlCandidatesAlreadyExist',jsonb_build_object(
  'application',to_regprocedure('public.rpc_control_application_v1(uuid)') is not null,
  'notification',to_regprocedure('public.rpc_control_notification_v1(uuid)') is not null,
  'ai',to_regprocedure('public.rpc_control_ai_v1(uuid)') is not null,
  'matching',to_regprocedure('public.rpc_control_matching_v1(uuid,uuid)') is not null
 )
);

select table_schema,table_name,column_name,data_type
from information_schema.columns
where (table_schema,table_name,column_name) in (
 ('public','marketplace_responses','need_id'),
 ('public','marketplace_responses','worker_profile_id'),
 ('public','marketplace_responses','status'),
 ('public','marketplace_responses','submitted_against_need_revision'),
 ('public','marketplace_responses','current_version'),
 ('public','marketplace_response_versions','response_id'),
 ('public','marketplace_response_versions','version'),
 ('public','marketplace_response_versions','need_revision'),
 ('public','need_selections','response_id'),
 ('public','need_selections','status'),
 ('public','agreements','selected_response_id'),
 ('public','user_activity_events','event_type'),
 ('public','user_activity_events','entity_type'),
 ('public','notification_deliveries','event_id'),
 ('public','notification_deliveries','state'),
 ('public','notification_push_attempts','delivery_id'),
 ('public','notification_push_attempts','outcome'),
 ('public','notification_push_attempts','transport_state'),
 ('public','notification_push_devices','platform'),
 ('public','ai_conversations','purpose'),
 ('public','ai_conversations','status'),
 ('public','ai_messages','conversation_id'),
 ('public','ai_messages','sequence_no'),
 ('public','ai_messages','safety'),
 ('public','ai_structured_facts','conversation_id'),
 ('public','ai_structured_facts','status'),
 ('public','ai_structured_facts','source'),
 ('public','ai_action_proposals','conversation_id'),
 ('public','ai_action_proposals','status'),
 ('public','dispatch_rounds','need_id'),
 ('public','dispatch_rounds','status'),
 ('public','opportunity_deliveries','need_id'),
 ('public','opportunity_deliveries','need_revision'),
 ('public','opportunity_deliveries','worker_profile_id'),
 ('public','opportunity_deliveries','reason_codes'),
 ('public','opportunity_deliveries','match_score')
)
order by table_schema,table_name,column_name;

select n.nspname schema_name,c.relname relation_name,c.relrowsecurity rls,c.relforcerowsecurity force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname,c.relname) in (
 ('public','marketplace_responses'),('public','marketplace_response_versions'),('public','need_selections'),
 ('public','agreements'),('public','user_activity_events'),('public','notification_preferences'),
 ('public','notification_deliveries'),('public','notification_push_attempts'),('public','notification_push_devices'),
 ('public','ai_conversations'),('public','ai_messages'),('public','ai_structured_facts'),('public','ai_action_proposals'),
 ('public','dispatch_rounds'),('public','opportunity_deliveries')
)
order by 1,2;

select
 has_function_privilege('anon','private.match_detail(uuid,uuid)','EXECUTE') as anon_match,
 has_function_privilege('authenticated','private.match_detail(uuid,uuid)','EXECUTE') as authenticated_match,
 has_function_privilege('service_role','private.match_detail(uuid,uuid)','EXECUTE') as service_match,
 has_function_privilege('authenticated','public.rpc_get_push_readiness()','EXECUTE') as authenticated_push_readiness,
 has_function_privilege('service_role','public.rpc_get_push_readiness()','EXECUTE') as service_push_readiness;

select schemaname,tablename,indexname,indexdef
from pg_indexes
where (schemaname,tablename) in (
 ('public','marketplace_responses'),('public','marketplace_response_versions'),('public','need_selections'),
 ('public','agreements'),('public','user_activity_events'),('public','notification_deliveries'),
 ('public','notification_push_attempts'),('public','ai_conversations'),('public','ai_messages'),
 ('public','ai_structured_facts'),('public','dispatch_rounds'),('public','opportunity_deliveries')
)
order by schemaname,tablename,indexname;

explain (format json) select id,status,current_version from public.marketplace_responses
 where id='00000000-0000-4000-8000-000000000000'::uuid;
explain (format json) select id,channel,state from public.notification_deliveries
 where event_id='00000000-0000-4000-8000-000000000000'::uuid;
explain (format json) select id,sequence_no,safety from public.ai_messages
 where conversation_id='00000000-0000-4000-8000-000000000000'::uuid order by sequence_no desc limit 20;
explain (format json) select id,status,match_score from public.opportunity_deliveries
 where need_id='00000000-0000-4000-8000-000000000000'::uuid and need_revision=1;
