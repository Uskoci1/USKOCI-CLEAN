-- V5 policy-bound account access closure. No executable policy, duration or activation is seeded.
-- Retained relational history is explicitly reported, never deleted to satisfy Auth FKs.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table private.retention_policy_sets add column account_closure_execution jsonb
 check(account_closure_execution is null or (jsonb_typeof(account_closure_execution)='object' and octet_length(account_closure_execution::text)<=65536));
comment on column private.retention_policy_sets.account_closure_execution is
 'NULL is closed. Reviewed finite retention for every current class, exact Privacy and source digest, and explicit Auth subject-retaining identity erasure. No text parser or default duration.';

create table private.closure_dataset_catalog_v5(data_class text primary key,relations text[] not null);
insert into private.closure_dataset_catalog_v5 values
('ACCOUNT_IDENTITY',array['public.app_accounts']),
('PROFILE_DATA',array['public.app_profiles','public.profile_availability_rules','public.profile_availability_windows','public.worker_match_preferences','private.worker_calendar_events','private.worker_calendar_serialization']),
('NEED_PUBLIC',array['public.needs','public.need_requirement_details','private.need_revision_events','private.need_fact_registry']),
('NEED_SENSITIVE',array['public.need_sensitive','public.need_geography','public.access_grants']),
('RESPONSES_SELECTION',array['public.marketplace_responses','public.marketplace_response_versions','private.response_application_snapshots','public.need_selections']),
('PRESELECTION_QA',array['private.preselection_qa_questions','private.preselection_qa_answer_versions','private.preselection_qa_materiality_decisions','private.preselection_qa_policy_decisions']),
('AGREEMENT_CORE',array['public.agreements','public.agreement_versions','public.agreement_change_proposals','public.agreement_execution','private.connection_activations']),
('AGREEMENT_MESSAGES',array['public.agreement_messages']),
('LEGAL_CONSENT',array['public.account_legal_acceptance_events']),
('NOTIFICATION_DELIVERY',array['public.notification_preferences','public.notification_deliveries','public.notification_push_devices','public.notification_push_attempts','public.opportunity_deliveries','public.dispatch_rounds','private.dispatch_schedule']),
('AI_VOLATILE',array['public.ai_conversations','public.ai_messages','public.ai_structured_facts','public.ai_action_proposals','private.ai_task_reviews','private.worker_ai_sessions','private.worker_ai_turns','private.worker_ai_reviews']),
('MEDIA_OBJECTS',array['private.owned_media_assets']),
('COMMAND_LEDGERS',array['private.need_draft_save_commands','private.need_edit_commands','private.need_publish_commands','private.need_publication_decisions','private.response_submit_commands','private.response_withdraw_commands','private.response_revision_resolution_commands','private.selection_commands','private.remaining_search_close_commands','private.requester_identity_commands','private.preselection_qa_commands','private.ai_need_open_commands','private.ai_need_turn_commands','private.ai_task_review_commands','private.worker_ai_saves','private.account_block_commands','private.account_closure_requests','private.account_closure_commands','public.data_export_requests','private.data_export_artifacts','private.closure_executions_v5','private.closure_actions_v5','private.closure_start_commands_v5']),
('AUDIT_SECURITY_LOGS',array['private.marketplace_audit_log','public.user_activity_events','private.account_blocks','private.safety_reports','private.retention_holds','private.retention_jobs','private.ai_test_accounts_v5','private.ai_test_reservations_v5']),
('AGREEMENT_REVIEWS',array['private.agreement_reviews']);
comment on table private.closure_dataset_catalog_v5 is 'Technical mapping only.126 review ledgers,127 per-account test allocations,128 worker history,129 existing safety/legal ledgers,130 media derivatives included. Global ai_test_budget_v5 is never reset or reduced by account closure.';
create table private.closure_executions_v5(
 account_id uuid primary key references public.app_accounts(id),request_id uuid not null unique references private.account_closure_requests(id),
 generation uuid not null unique default gen_random_uuid(),policy_id uuid not null references private.retention_policy_sets(id),
 policy_sha256 text not null check(policy_sha256~'^[a-f0-9]{64}$'),binding jsonb not null,
 requested_at timestamptz not null default clock_timestamp(),state text not null default 'EXECUTING' check(state in('EXECUTING','CLOSED')),
 last_checked_at timestamptz,closed_at timestamptz,receipt jsonb,check((state='CLOSED')=(closed_at is not null and receipt is not null)));
create table private.closure_actions_v5(
 id uuid primary key default gen_random_uuid(),generation uuid not null references private.closure_executions_v5(generation),
 account_id uuid not null references public.app_accounts(id),kind text not null check(kind in('STORAGE_DELETE','AUTH_IDENTITY_ERASE')),
 bucket text,object_path text,attempt_id uuid not null default gen_random_uuid(),
 state text not null default 'PENDING' check(state in('PENDING','DISPATCHED','VERIFIED')),
 dispatched_at timestamptz,verified_at timestamptz,evidence text check(evidence in('STORAGE_OBJECT_ABSENT','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED')),
 check((kind='STORAGE_DELETE' and bucket in('profile-media','data-export-artifacts') and object_path is not null) or (kind='AUTH_IDENTITY_ERASE' and bucket is null and object_path is null)),
 check((state='PENDING')=(dispatched_at is null)),check((state='VERIFIED')=(verified_at is not null and evidence is not null)),
 unique(generation,bucket,object_path));
create unique index closure_one_auth_v5 on private.closure_actions_v5(generation) where kind='AUTH_IDENTITY_ERASE';
create index closure_actions_pending_v5 on private.closure_actions_v5(generation,state,kind,id);
create table private.closure_start_commands_v5(account_id uuid not null references public.app_accounts(id),client_request_id uuid not null,
 input_sha256 text not null,receipt jsonb not null,primary key(account_id,client_request_id));
create table private.closure_source_v5(singleton boolean primary key default true check(singleton),sha256 text not null);

create function private.closure_source_digest_v5() returns text language sql stable security definer set search_path=pg_catalog as $f$
 select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,
 'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(pg_get_constraintdef(x.oid) order by x.conname) from pg_constraint x where x.conrelid=c.oid),
 'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),md5(p.prosrc)) order by t.tgname) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid=c.oid and not t.tgisinternal)) order by c.oid::regclass::text),'[]')::text,'UTF8'),'sha256'),'hex')
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private') and c.relkind in('r','p');
$f$;
create function private.closure_binding_v5() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare p private.retention_policy_sets;m jsonb;d jsonb;rules jsonb;privacy private.legal_document_versions;terms private.legal_document_versions; classes text[];seen text[]:='{}';binding jsonb;
begin
 select * into p from private.retention_policy_sets where retired_at is null and effective_at<=statement_timestamp();
 if not found or p.account_closure_execution is null then return null;end if;m:=p.account_closure_execution;
 if m-ARRAY['schemaVersion','adapterVersion','sourceSha256','privacyDocumentId','privacyContentSha256','authAction','mediaAction','datasets','contentSha256']<>'{}'
 or not(m?&ARRAY['schemaVersion','adapterVersion','sourceSha256','privacyDocumentId','privacyContentSha256','authAction','mediaAction','datasets','contentSha256'])
 or m->'schemaVersion' is distinct from '1'::jsonb or m->>'adapterVersion' is distinct from 'V5_RETAINED_SUBJECT_CLOSURE_V1'
 or m->>'authAction' is distinct from 'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED' or m->>'mediaAction' is distinct from 'DELETE_OWNED_OBJECTS'
 or m->>'sourceSha256' is distinct from (select sha256 from private.closure_source_v5 where singleton)
 or m->>'sourceSha256' is distinct from private.closure_source_digest_v5()
 or jsonb_typeof(m->'datasets') is distinct from 'array'
 or coalesce(m->>'privacyDocumentId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 or coalesce(m->>'privacyContentSha256','')!~'^[a-f0-9]{64}$'
 or m->>'contentSha256' is distinct from encode(extensions.digest(convert_to((m-'contentSha256')::text,'UTF8'),'sha256'),'hex') then return null;end if;
 select array_agg(code order by code) into classes from private.retention_data_classes where active and required;
 if classes is distinct from (select array_agg(data_class order by data_class) from private.closure_dataset_catalog_v5) then return null;end if;
 if exists(select 1 from private.closure_dataset_catalog_v5 c,unnest(c.relations) r where to_regclass(r) is null) then return null;end if;
 for d in select value from jsonb_array_elements(m->'datasets') loop
  if jsonb_typeof(d) is distinct from 'object' or d-ARRAY['dataClass','action','retentionSeconds','trigger','ruleSha256']<>'{}'
  or not(d?&ARRAY['dataClass','action','retentionSeconds','trigger','ruleSha256']) or not(coalesce(d->>'dataClass','')=any(classes))
  or (d->>'dataClass')=any(seen) or d->>'action' is distinct from 'RETAIN_RESTRICTED' or d->>'trigger' is distinct from 'CLOSURE_REQUESTED'
  or jsonb_typeof(d->'retentionSeconds') is distinct from 'number' or coalesce(d->>'retentionSeconds','')!~'^[1-9][0-9]{0,9}$'
  then return null;end if;
  if (d->>'retentionSeconds')::numeric>2147483647 then return null;end if;
  if d->>'ruleSha256' is distinct from (select encode(extensions.digest(convert_to(to_jsonb(r)::text,'UTF8'),'sha256'),'hex') from private.retention_policy_rules r where policy_id=p.id and data_class=d->>'dataClass') then return null;end if;
  seen:=array_append(seen,d->>'dataClass');
 end loop;
 if cardinality(seen)<>cardinality(classes) then return null;end if;
 select * into privacy from private.legal_document_versions where id=(m->>'privacyDocumentId')::uuid and document_kind='PRIVACY' and is_active
 and published_at<=statement_timestamp() and effective_at<=statement_timestamp() and content_sha256=m->>'privacyContentSha256';
 if not found then return null;end if;
 select * into terms from private.legal_document_versions where document_kind='TERMS' and is_active and published_at<=statement_timestamp() and effective_at<=statement_timestamp();
 if not found then return null;end if;
 select jsonb_agg(to_jsonb(r) order by data_class) into rules from private.retention_policy_rules r where policy_id=p.id;
 binding:=jsonb_build_object('policyId',p.id,'policyVersion',p.policy_version,'counselReference',p.counsel_reference,'execution',m,'rules',rules,
 'privacy',jsonb_build_object('id',privacy.id,'sha256',privacy.content_sha256),'terms',jsonb_build_object('id',terms.id,'sha256',terms.content_sha256));
 return binding||jsonb_build_object('sha256',encode(extensions.digest(convert_to(binding::text,'UTF8'),'sha256'),'hex'));
end $f$;

create function private.closure_blockers_v5(a uuid) returns text[] language plpgsql stable security definer set search_path=pg_catalog as $f$
declare codes text[]:='{}';
begin
 if exists(select 1 from private.retention_holds where account_id=a and active) then codes:=array_append(codes,'RETENTION_HOLD');end if;
 if exists(select 1 from public.agreements where (requester_account_id=a or worker_account_id=a) and status not in('COMPLETED','CANCELLED')) then codes:=array_append(codes,'ACTIVE_AGREEMENT');end if;
 if exists(select 1 from public.needs where requester_account_id=a and status in('PUBLISHED','SELECTION','ACTIVE')) then codes:=array_append(codes,'OPEN_TASK');end if;
 if exists(select 1 from public.marketplace_responses where worker_account_id=a and status in('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')) then codes:=array_append(codes,'ACTIVE_APPLICATION');end if;
 if exists(select 1 from private.ai_need_turn_commands where account_id=a and state='PROCESSING')
 or exists(select 1 from private.worker_ai_turns where account_id=a and state='PROCESSING')
 or exists(select 1 from private.retention_jobs where account_id=a and status='CLAIMED')
 or exists(select 1 from public.data_export_requests where account_id=a and status='PROCESSING') then codes:=array_append(codes,'PENDING_WORKFLOW');end if;
 if exists(select 1 from private.owned_media_assets where account_id=a and dispatch_state='DISPATCHING')
 or exists(select 1 from private.data_export_artifacts where account_id=a and verified_at is null) then codes:=array_append(codes,'STORAGE_PRODUCER_UNSETTLED');end if;
 -- A foreign bucket or a legacy object without an authoritative owner-prefix
 -- cannot become an arbitrary service-role deletion target.
 if exists(select 1 from storage.objects where (owner_id=a::text or split_part(name,'/',1)=a::text)
 and (bucket_id not in('profile-media','data-export-artifacts') or split_part(name,'/',1)<>a::text or name~'(^|/)[.][.](/|$)' or strpos(name,chr(92))>0)) then codes:=array_append(codes,'STORAGE_INVENTORY_UNSUPPORTED');end if;
 return codes;
end $f$;
create function public.rpc_review_account_closure_execution(p_expected_user_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();b jsonb;r private.account_closure_requests;codes text[];
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 perform pg_advisory_xact_lock(private.closure_account_key(u));
 select * into r from private.account_closure_requests where account_id=u;b:=private.closure_binding_v5();codes:=private.closure_blockers_v5(u);
 return jsonb_build_object('accountId',u,'requestId',r.id,'revision',coalesce(r.revision,0),'ready',b is not null and cardinality(codes)=0 and r.id is not null and r.revision<2147483646 and not private.closure_account_restricted(u),
 'policySha256',b->>'sha256','blockers',to_jsonb(codes),'code',case when b is null then 'CLOSURE_POLICY_NOT_READY' when r.id is null then 'CLOSURE_PREPARATION_REQUIRED' when cardinality(codes)>0 then 'CLOSURE_BLOCKED' else null end,
 'retainedDatasets',b#>'{execution,datasets}','authAction','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED','mediaAction','DELETE_OWNED_OBJECTS','authoritative',true);
end $f$;
create function public.rpc_start_account_closure_execution(p_expected_user_id uuid,p_request_id uuid,p_expected_revision integer,p_client_request_id uuid,p_policy_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();b jsonb;r private.account_closure_requests;e private.closure_executions_v5;c private.closure_start_commands_v5;h text;receipt jsonb;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_request_id is null or p_client_request_id is null or p_expected_revision is null or p_expected_revision<1 or p_expected_revision>=2147483646 or coalesce(p_policy_sha256,'')!~'^[a-f0-9]{64}$' then raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(private.closure_account_key(u));perform pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||u::text,0));
 h:=encode(extensions.digest(jsonb_build_array(u,p_request_id,p_expected_revision,p_policy_sha256)::text,'sha256'),'hex');
 select * into c from private.closure_start_commands_v5 where account_id=u and client_request_id=p_client_request_id;
 if found then if c.input_sha256<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023';end if;return c.receipt||jsonb_build_object('idempotentReplay',true);end if;
 select * into r from private.account_closure_requests where account_id=u;
 if r.id is distinct from p_request_id or r.revision is distinct from p_expected_revision then raise exception 'CLOSURE_REVISION_CONFLICT' using errcode='40001';end if;
 if private.closure_account_restricted(u) then raise exception 'ACCOUNT_CLOSING' using errcode='42501';end if;
 -- Freeze reviewed pointers during admission; later operations recheck current binding.
 perform 1 from private.retention_policy_sets where retired_at is null for share;
 perform 1 from private.retention_policy_rules order by id for share;
 perform 1 from private.legal_document_versions where is_active order by id for share;
 b:=private.closure_binding_v5();
 if b is null or b->>'sha256' is distinct from p_policy_sha256 then raise exception 'CLOSURE_POLICY_NOT_READY' using errcode='55000';end if;
 if cardinality(private.closure_blockers_v5(u))>0 then raise exception 'CLOSURE_BLOCKED' using errcode='55000';end if;
 insert into private.closure_executions_v5(account_id,request_id,policy_id,policy_sha256,binding) values(u,r.id,(b->>'policyId')::uuid,p_policy_sha256,b) returning * into e;
 update private.account_closure_requests set state='EXECUTING',revision=revision+1,updated_at=clock_timestamp() where account_id=u;
 insert into private.closure_actions_v5(generation,account_id,kind,bucket,object_path)
 select e.generation,u,'STORAGE_DELETE',x.bucket,x.path from (
  select bucket_id bucket,name path from storage.objects where split_part(name,'/',1)=u::text
  union select 'profile-media',storage_path from private.owned_media_assets where account_id=u and storage_path is not null
  union select 'data-export-artifacts',object_path from private.data_export_artifacts where account_id=u) x;
 insert into private.closure_actions_v5(generation,account_id,kind) values(e.generation,u,'AUTH_IDENTITY_ERASE');
 receipt:=jsonb_build_object('accountId',u,'requestId',r.id,'generation',e.generation,'state','EXECUTING','clientRequestId',p_client_request_id,'policySha256',p_policy_sha256,'idempotentReplay',false,'authoritative',true);
 insert into private.closure_start_commands_v5 values(u,p_client_request_id,h,receipt);return receipt;
end $f$;

create function private.closure_assert_current_v5(e private.closure_executions_v5) returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare b jsonb;
begin
 if e.account_id is null or e.state<>'EXECUTING' then raise exception 'CLOSURE_GENERATION_STALE' using errcode='40001';end if;
 perform 1 from private.retention_policy_sets where retired_at is null for share;
 perform 1 from private.retention_policy_rules order by id for share;
 perform 1 from private.legal_document_versions where is_active order by id for share;
 b:=private.closure_binding_v5();if b is null or b->>'sha256' is distinct from e.policy_sha256 then raise exception 'CLOSURE_POLICY_CHANGED' using errcode='55000';end if;
 if cardinality(private.closure_blockers_v5(e.account_id))>0 then raise exception 'CLOSURE_BLOCKED' using errcode='55000';end if;
 if exists(select 1 from jsonb_array_elements(e.binding#>'{execution,datasets}') d where e.requested_at+make_interval(secs=>(d->>'retentionSeconds')::integer)<=clock_timestamp()) then raise exception 'CLOSURE_RETAINED_RULE_DUE' using errcode='55000';end if;
end $f$;
create function private.closure_action_document_v5(a private.closure_actions_v5,e private.closure_executions_v5) returns jsonb language sql stable set search_path=pg_catalog as $f$
 select jsonb_build_object('accountId',a.account_id,'requestId',e.request_id,'generation',a.generation,'actionId',a.id,'attemptId',a.attempt_id,'kind',a.kind,'state',a.state,'bucket',a.bucket,'objectPath',a.object_path,'policySha256',e.policy_sha256);
$f$;
create function public.rpc_claim_account_closure_action_service(p_account_id uuid,p_generation uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare e private.closure_executions_v5;a private.closure_actions_v5;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if p_account_id is null or p_generation is null then raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(private.closure_account_key(p_account_id));perform pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||p_account_id::text,0));
 select * into e from private.closure_executions_v5 where account_id=p_account_id and generation=p_generation;
 if not found then raise exception 'CLOSURE_GENERATION_STALE' using errcode='40001';end if;
 if e.state='CLOSED' then return jsonb_build_object('kind','CLOSED','receipt',e.receipt);end if;
 perform private.closure_assert_current_v5(e);
 update private.closure_executions_v5 set last_checked_at=clock_timestamp() where account_id=e.account_id;
 select * into a from private.closure_actions_v5 where generation=e.generation and state<>'VERIFIED' order by case kind when 'STORAGE_DELETE' then 0 else 1 end,id limit 1;
 if not found then return jsonb_build_object('kind','FINALIZE','accountId',e.account_id,'generation',e.generation);end if;
 return private.closure_action_document_v5(a,e);
end $f$;
create function public.rpc_dispatch_account_closure_action_service(p_account_id uuid,p_generation uuid,p_action_id uuid,p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare e private.closure_executions_v5;a private.closure_actions_v5;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(private.closure_account_key(p_account_id));perform pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||p_account_id::text,0));
 select * into e from private.closure_executions_v5 where account_id=p_account_id and generation=p_generation;perform private.closure_assert_current_v5(e);
 select * into a from private.closure_actions_v5 where id=p_action_id and generation=e.generation and account_id=p_account_id;
 if not found or p_attempt_id is null or a.attempt_id is distinct from p_attempt_id then raise exception 'CLOSURE_ATTEMPT_STALE' using errcode='40001';end if;
 if a.state<>'PENDING' then return jsonb_build_object('admitted',false,'action',private.closure_action_document_v5(a,e));end if;
 if a.kind='AUTH_IDENTITY_ERASE' and (exists(select 1 from private.closure_actions_v5 where generation=e.generation and kind='STORAGE_DELETE' and state<>'VERIFIED') or exists(select 1 from storage.objects where owner_id=p_account_id::text or split_part(name,'/',1)=p_account_id::text)) then raise exception 'CLOSURE_STORAGE_NOT_CLEAN' using errcode='55000';end if;
 update private.closure_actions_v5 set state='DISPATCHED',dispatched_at=clock_timestamp() where id=a.id returning * into a;
 return jsonb_build_object('admitted',true,'action',private.closure_action_document_v5(a,e));
end $f$;
-- Exact positive physical evidence can settle an already dispatched operation even
-- after a hold/policy change. It cannot authorize another destructive operation.
create function public.rpc_complete_account_closure_action_service(p_account_id uuid,p_generation uuid,p_action_id uuid,p_attempt_id uuid,p_evidence text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare e private.closure_executions_v5;a private.closure_actions_v5;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(private.closure_account_key(p_account_id));
 select * into e from private.closure_executions_v5 where account_id=p_account_id and generation=p_generation;
 select * into a from private.closure_actions_v5 where id=p_action_id and generation=p_generation and account_id=p_account_id;
 if e.account_id is null or a.id is null or p_attempt_id is null or a.attempt_id is distinct from p_attempt_id or a.state='PENDING' then raise exception 'CLOSURE_ATTEMPT_STALE' using errcode='40001';end if;
 if p_evidence is distinct from (case a.kind when 'STORAGE_DELETE' then 'STORAGE_OBJECT_ABSENT' else 'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED' end) then raise exception 'CLOSURE_EVIDENCE_INVALID' using errcode='22023';end if;
 if a.kind='STORAGE_DELETE' and exists(select 1 from storage.objects where bucket_id=a.bucket and name=a.object_path) then raise exception 'CLOSURE_STORAGE_NOT_CLEAN' using errcode='55000';end if;
 if a.kind='AUTH_IDENTITY_ERASE' and (not exists(select 1 from auth.users where id=p_account_id and deleted_at is not null and coalesce(encrypted_password,'')='' and coalesce(raw_user_meta_data,'{}')='{}' and coalesce(raw_app_meta_data,'{}')='{}') or exists(select 1 from auth.sessions where user_id=p_account_id)) then raise exception 'CLOSURE_AUTH_NOT_CLOSED' using errcode='55000';end if;
 if a.state<>'VERIFIED' then update private.closure_actions_v5 set state='VERIFIED',verified_at=clock_timestamp(),evidence=p_evidence where id=a.id returning * into a;end if;
 return private.closure_action_document_v5(a,e)||jsonb_build_object('evidence',a.evidence);
end $f$;
create function public.rpc_finalize_account_closure_service(p_account_id uuid,p_generation uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare e private.closure_executions_v5;v_receipt jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(private.closure_account_key(p_account_id));perform pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||p_account_id::text,0));
 select * into e from private.closure_executions_v5 where account_id=p_account_id and generation=p_generation;
 if not found then raise exception 'CLOSURE_GENERATION_STALE' using errcode='40001';end if;
 if e.state='CLOSED' then return e.receipt;end if;
 perform private.closure_assert_current_v5(e);
 if exists(select 1 from private.closure_actions_v5 where generation=e.generation and state<>'VERIFIED')
 or exists(select 1 from storage.objects where owner_id=p_account_id::text or split_part(name,'/',1)=p_account_id::text)
 or not exists(select 1 from auth.users where id=p_account_id and deleted_at is not null)
 or exists(select 1 from auth.sessions where user_id=p_account_id) then raise exception 'CLOSURE_EVIDENCE_INCOMPLETE' using errcode='55000';end if;
 v_receipt:=jsonb_build_object('accountId',e.account_id,'requestId',e.request_id,'generation',e.generation,'state','CLOSED','closedAt',clock_timestamp(),'policySha256',e.policy_sha256,
 'authOutcome','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED','mediaOutcome','OWNED_OBJECTS_DELETED','relationalOutcome','RETAINED_RESTRICTED','retainedDatasets',e.binding#>'{execution,datasets}','authoritative',true);
 update private.closure_executions_v5 set state='CLOSED',closed_at=(v_receipt->>'closedAt')::timestamptz,receipt=v_receipt where account_id=p_account_id;
 update private.account_closure_requests set state='CLOSED',revision=revision+1,closed_at=(v_receipt->>'closedAt')::timestamptz,execution_receipt=v_receipt,updated_at=clock_timestamp() where account_id=p_account_id;
 return v_receipt;
end $f$;

create function public.rpc_read_account_closure_execution(p_expected_user_id uuid,p_client_request_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare c private.closure_start_commands_v5;e private.closure_executions_v5;u uuid:=auth.uid();
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_client_request_id is null then raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023';end if;
 select * into c from private.closure_start_commands_v5 where account_id=u and client_request_id=p_client_request_id;
 if not found then return jsonb_build_object('accountId',u,'clientRequestId',p_client_request_id,'found',false,'receipt',null,'execution',null,'authoritative',true);end if;
 select * into e from private.closure_executions_v5 where account_id=u and generation=(c.receipt->>'generation')::uuid;
 return jsonb_build_object('accountId',u,'clientRequestId',p_client_request_id,'found',true,'receipt',c.receipt,
 'execution',case when e.state='CLOSED' then e.receipt else jsonb_build_object('accountId',u,'requestId',e.request_id,'generation',e.generation,'state',e.state,'policySha256',e.policy_sha256,'authoritative',true) end,'authoritative',true);
end $f$;
revoke all on function public.rpc_read_account_closure_execution(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_read_account_closure_execution(uuid,uuid) to authenticated;
-- Existing trusted maintenance caller may request a bounded fair work list.
-- No scheduler or activation is created. Every actual dispatch rechecks locks,
-- current policy, hold and producer quiescence independently of this hint.
create function public.rpc_list_account_closure_work_service(p_limit integer) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare b jsonb;result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if p_limit is null or p_limit<1 or p_limit>8 then raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023';end if;
 b:=private.closure_binding_v5();if b is null then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('accountId',x.account_id,'generation',x.generation)),'[]') into result from(
 select e.account_id,e.generation from private.closure_executions_v5 e where e.state='EXECUTING' and e.policy_sha256=b->>'sha256'
 and cardinality(private.closure_blockers_v5(e.account_id))=0
 and not exists(select 1 from jsonb_array_elements(e.binding#>'{execution,datasets}') d where e.requested_at+make_interval(secs=>(d->>'retentionSeconds')::integer)<=statement_timestamp())
 order by coalesce(e.last_checked_at,e.requested_at),e.account_id limit p_limit) x;return result;
end $f$;
revoke all on function public.rpc_list_account_closure_work_service(integer) from public,anon,authenticated,service_role;
grant execute on function public.rpc_list_account_closure_work_service(integer) to service_role;
-- JWTs issued before Auth identity erasure remain cryptographically valid. A
-- pre-request hook fences those Data API calls, including SECURITY DEFINER RPCs.
-- Existing P10 read/preparation remain available while only REQUESTED/BLOCKED/NOT_READY.
create function public.rpc_closure_api_guard() returns void language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if auth.role()='authenticated' and private.closure_account_restricted(auth.uid()) and coalesce(current_setting('request.path',true),'') not in('/rpc/rpc_read_account_closure_execution','/rpc/rpc_start_account_closure_execution') then raise exception 'ACCOUNT_CLOSING' using errcode='42501';end if;
end $f$;
do $hook$ declare configured text;
begin
 select substring(v from length('pgrst.db_pre_request=')+1) into configured from pg_roles r cross join lateral unnest(r.rolconfig) v where r.rolname='authenticator' and v like 'pgrst.db_pre_request=%';
 if nullif(configured,'') is not null and configured<>'public.rpc_closure_api_guard' then raise exception 'CLOSURE_EXISTING_API_PRE_REQUEST_REQUIRES_COMPOSITION';end if;
 alter role authenticator set pgrst.db_pre_request='public.rpc_closure_api_guard';
end $hook$;
-- Storage endpoints do not run the PostgREST hook. This restrictive policy
-- complements existing owner policies and never grants access of its own.
create policy v5_closure_storage_fence on storage.objects as restrictive for all to authenticated
 using(not private.closure_account_restricted((select auth.uid()))) with check(not private.closure_account_restricted((select auth.uid())));

do $acl$ declare t record;f record;
begin
 for t in select tablename from pg_tables where schemaname='private' and tablename in('closure_dataset_catalog_v5','closure_executions_v5','closure_actions_v5','closure_start_commands_v5','closure_source_v5') loop
 execute format('alter table private.%I enable row level security',t.tablename);execute format('alter table private.%I force row level security',t.tablename);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t.tablename);end loop;
 for f in select oid::regprocedure sig,pronamespace::regnamespace::text n,proname from pg_proc where (pronamespace='private'::regnamespace and proname in('closure_source_digest_v5','closure_binding_v5','closure_blockers_v5','closure_assert_current_v5','closure_action_document_v5'))
 or (pronamespace='public'::regnamespace and proname in('rpc_review_account_closure_execution','rpc_start_account_closure_execution','rpc_claim_account_closure_action_service','rpc_dispatch_account_closure_action_service','rpc_complete_account_closure_action_service','rpc_finalize_account_closure_service','rpc_closure_api_guard')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 if f.n='public' then execute format('grant execute on function %s to %s',f.sig,case when f.proname='rpc_closure_api_guard' then 'anon,authenticated,service_role' when f.proname like '%_service' then 'service_role' else 'authenticated' end);end if;end loop;
end $acl$;
-- A tiny callable boolean is needed by Storage RLS; it exposes no private rows.
-- The historical private predicate already reveals only the supplied UUID's
-- restriction state. Use an own-account wrapper to avoid a cross-owner oracle.
create function public.rpc_storage_account_open() returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $f$
 begin if auth.uid() is null then return false;end if;perform private.closure_assert_open(auth.uid());return true;end;
$f$;
revoke all on function public.rpc_storage_account_open() from public,anon,authenticated,service_role;
grant execute on function public.rpc_storage_account_open() to authenticated;
alter policy v5_closure_storage_fence on storage.objects using(public.rpc_storage_account_open()) with check(public.rpc_storage_account_open());
-- Realtime and direct table paths do not run the API pre-request hook. The
-- existing owner/domain policies remain necessary; this adds no visibility.
do $visibility$ declare t record;
begin
 for t in select c.relname from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in('r','p') and c.relrowsecurity loop
 execute format('create policy v5_closed_account_visibility on public.%I as restrictive for select to authenticated using(public.rpc_storage_account_open())',t.relname);
 end loop;
end $visibility$;-- GoTrue soft erasure also updates email/phone. Preserve the existing Auth
-- mirror for ordinary edits; only a generation-bound dispatched erasure may
-- leave retained application evidence unchanged during the restriction.
do $auth_mirror$ declare definition text;needle text;replacement text;
begin
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.handle_uskoci_auth_user_updated()'::regprocedure) is distinct from '2e1c24de3bdc1888cb78acf15c287392' then raise exception 'CLOSURE_AUTH_MIRROR_PREDECESSOR_DRIFT';end if;
 definition:=replace(pg_get_functiondef('public.handle_uskoci_auth_user_updated()'::regprocedure),E'\r\n',E'\n');
 needle:=E'BEGIN\n  UPDATE public.app_accounts';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'CLOSURE_AUTH_MIRROR_PREDECESSOR_DRIFT';end if;
 replacement:=E'BEGIN\n  IF NEW.id=OLD.id AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL\n    AND EXISTS(SELECT 1 FROM private.closure_executions_v5 e JOIN private.closure_actions_v5 a ON a.generation=e.generation AND a.account_id=e.account_id\n      WHERE e.account_id=NEW.id AND e.state=''EXECUTING'' AND a.kind=''AUTH_IDENTITY_ERASE'' AND a.state=''DISPATCHED'') THEN RETURN NEW; END IF;\n  UPDATE public.app_accounts';
 execute replace(definition,needle,replacement);
end $auth_mirror$;insert into private.closure_source_v5(singleton,sha256) values(true,private.closure_source_digest_v5());
notify pgrst,'reload schema';notify pgrst,'reload config';
commit;
