--143 AF-D17/18: private test support, one explicitly granted human operator.
-- No grant seed, provider, sanction, publication override, retention duration,
-- push transport or executable policy is installed by this migration.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create temporary table support143_predecessor(sha text,ready_definition text) on commit drop;
do $pre$ declare s text;d text;begin
 select sha256 into strict s from private.closure_source_v5 where singleton;
 if s is distinct from private.closure_source_digest_v5() or private.retention_ai_source_ready() is distinct from true then raise exception 'SUPPORT_PREDECESSOR_NOT_READY';end if;
 select prosrc into d from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if md5(replace(replace(d,E'\r\n',E'\n'),s,'__SOURCE139_SHA256__'))<>'75b560d9a71baa045f8e7f80cd77aada'
 or to_regprocedure('public.rpc_cancel_worker_ai_turn(uuid,uuid,uuid)') is null
 or jsonb_array_length(private.data_export_dataset_catalog())<>42 then raise exception 'SUPPORT_PREDECESSOR_DRIFT';end if;
 insert into support143_predecessor values(s,pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure));
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.rpc_ai_cancel_need_turn_v2(uuid,uuid)'::regprocedure) is distinct from '95218b55fd9a880719e172e57bc1157a'
 or (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.rpc_cancel_worker_ai_turn(uuid,uuid,uuid)'::regprocedure) is distinct from '4b5a74064a4993c9dee2b37355812b6f'
 then raise exception 'SUPPORT_SOURCE142_REQUIRED';end if;
end $pre$;

create table private.support_operator_grants_v5(
 singleton boolean primary key default true check(singleton),account_id uuid not null references public.app_accounts(id),
 purpose text not null check(purpose='PRIVATE_TEST_OWNER_SUPPORT'),active boolean not null,revision integer not null check(revision>0),
 granted_at timestamptz not null,updated_at timestamptz not null);
create table private.support_cases_v5(
 id uuid primary key default gen_random_uuid(),case_number bigint generated always as identity unique,
 account_id uuid not null references public.app_accounts(id),channel text not null check(channel in('SERVICE','TASK','SAFETY','LEGAL_PRIVACY')),
 topic text not null check(topic in('TECHNICAL','COLLABORATION','NO_SHOW','SERVICE_COMPLAINT','CONTENT_NOTICE','PRIVACY_RIGHTS','PUBLICATION_REVIEW','SAFETY_REPORT','OTHER')),
 title text not null check(length(btrim(title)) between 1 and 200 and octet_length(title)<=800),
 desired_outcome text check(length(desired_outcome)<=1000 and octet_length(desired_outcome)<=4000),
 context jsonb not null check(jsonb_typeof(context)='object'),safety_report_id uuid unique references private.safety_reports(id),
 status text not null default 'RECEIVED' check(status in('RECEIVED','IN_REVIEW','WAITING_FOR_AUTHOR','DECIDED','CLOSED')),
 revision integer not null default 1 check(revision between 1 and 2147483646),sequence bigint not null default 1 check(sequence between 1 and 9007199254740990),
 ordinary boolean not null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check((channel='SAFETY')=(safety_report_id is not null)));
create index support_cases_owner_v5 on private.support_cases_v5(account_id,case_number desc);
create index support_cases_inbox_v5 on private.support_cases_v5(channel,case_number desc);
create table private.support_events_v5(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references private.support_cases_v5(id),sequence bigint not null,
 actor_account_id uuid not null references public.app_accounts(id),author_role text not null check(author_role in('AUTHOR','OPERATOR')),
 kind text not null check(kind in('CREATE','SAFETY_REPORT','AUTHOR_REPLY','CLAIM','OPERATOR_REPLY','REQUEST_INFO','DECIDE','APPEAL','CLAIM_APPEAL','DECIDE_APPEAL','CLOSE')),
 body text check(length(btrim(body)) between 1 and 4000 and octet_length(body)<=16000),
 decision_id uuid,appeal_id uuid,created_at timestamptz not null default clock_timestamp(),unique(case_id,sequence));
create index support_events_actor_v5 on private.support_events_v5(actor_account_id,created_at) where kind='AUTHOR_REPLY';
create table private.support_decisions_v5(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references private.support_cases_v5(id),case_revision integer not null,
 operator_account_id uuid not null references public.app_accounts(id),grant_revision integer not null,
 outcome text not null check(outcome in('ACCEPTED','REJECTED')),reason_code text not null check(reason_code~'^[A-Z][A-Z0-9_]{0,63}$'),
 explanation text not null check(length(btrim(explanation)) between 1 and 4000 and octet_length(explanation)<=16000),
 effect text not null default 'NONE' check(effect='NONE'),evidence_ids uuid[] not null default '{}',prior_decision_id uuid references private.support_decisions_v5(id),
 created_at timestamptz not null default clock_timestamp());
create table private.support_appeals_v5(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references private.support_cases_v5(id),
 decision_id uuid not null references private.support_decisions_v5(id),account_id uuid not null references public.app_accounts(id),
 status text not null default 'RECEIVED' check(status in('RECEIVED','IN_REVIEW','DECIDED')),
 decision_result_id uuid references private.support_decisions_v5(id),created_at timestamptz not null default clock_timestamp(),
 check((status='DECIDED')=(decision_result_id is not null)));
create unique index support_one_open_appeal_v5 on private.support_appeals_v5(decision_id) where status<>'DECIDED';
create table private.support_evidence_v5(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references private.support_cases_v5(id),
 event_id uuid not null references private.support_events_v5(id),submitted_by_account_id uuid not null references public.app_accounts(id),
 source_kind text not null,source_id uuid not null,source_revision integer,snapshot jsonb not null,
 snapshot_sha256 text not null check(snapshot_sha256~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 unique(event_id,source_kind,source_id));
create table private.support_commands_v5(
 account_id uuid not null references public.app_accounts(id),client_request_id uuid not null,kind text,
 input_sha256 text check(input_sha256~'^[a-f0-9]{64}$'),expected_revision integer,state text not null check(state in('COMMITTED','CANCELLED')),
 case_id uuid references private.support_cases_v5(id),receipt jsonb,created_at timestamptz not null default clock_timestamp(),
 primary key(account_id,client_request_id),check((state='COMMITTED')=(receipt is not null and input_sha256 is not null and kind is not null and case_id is not null)));
create table private.support_read_markers_v5(
 account_id uuid not null references public.app_accounts(id),case_id uuid not null references private.support_cases_v5(id),
 sequence bigint not null check(sequence>=0),updated_at timestamptz not null default clock_timestamp(),primary key(account_id,case_id));
create table private.support_operator_audit_v5(
 id uuid primary key default gen_random_uuid(),actor_account_id uuid not null references public.app_accounts(id),
 action text not null,case_id uuid,grant_revision integer not null,created_at timestamptz not null default clock_timestamp());
create table private.support_grant_commands_v5(
 client_request_id uuid primary key,account_id uuid not null references public.app_accounts(id),input_sha256 text not null,
 receipt jsonb not null,created_at timestamptz not null default clock_timestamp());
comment on table private.support_cases_v5 is 'AF-D17/18 private test: author and one explicitly granted owner operator. No publication/Agreement/sanction effect. Missing retention schedule remains a closed execution binding, not indefinite retention approval.';
comment on table private.support_evidence_v5 is 'Only intentionally selected, server-authorized existing references. Exact snapshots; no full private conversation, new upload, AI or blanket counterparty access.';
comment on table private.support_operator_audit_v5 is 'Human operator action metadata only. No narrative, evidence bytes, policy/provider payload, or client export of internal operator activity.';
do $tables$ declare t text;begin
 foreach t in array array['support_operator_grants_v5','support_cases_v5','support_events_v5','support_decisions_v5','support_appeals_v5','support_evidence_v5','support_commands_v5','support_read_markers_v5','support_operator_audit_v5','support_grant_commands_v5'] loop
 execute format('alter table private.%I enable row level security',t);execute format('alter table private.%I force row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);end loop;
 revoke all on sequence private.support_cases_v5_case_number_seq from public,anon,authenticated,service_role;
end $tables$;

create function private.support_auth_v5(expected uuid) returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();sid uuid;begin
 if auth.role() is distinct from 'authenticated' or u is null or u is distinct from expected then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when invalid_text_representation then raise exception 'AUTH_REQUIRED' using errcode='28000';end;
 if not private.push_session_valid(u,sid) then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;return u;
end $f$;
create function private.support_operator_key_v5() returns bigint language sql immutable set search_path=pg_catalog as $f$ select hashtextextended('uskoci:support:operator',10143) $f$;
create function private.support_command_key_v5(a uuid,k uuid) returns bigint language sql immutable strict set search_path=pg_catalog as $f$ select hashtextextended('uskoci:support:command:'||a::text||':'||k::text,10143) $f$;
create function private.support_safe_exit_v5(a uuid,b uuid default null) returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid;begin
 for u in select distinct v from unnest(array[a,b]) v where v is not null order by v loop
 perform pg_advisory_xact_lock_shared(private.closure_account_key(u));
 -- READY/FAILED preparation retains the authenticated support exit. Once an
 -- actual executor owns the account, no new producer may race Auth erasure.
 if exists(select 1 from private.closure_executions_v5 where account_id=u)
 or exists(select 1 from private.account_closure_requests where account_id=u and state in('EXECUTING','CLOSED'))
 then raise exception 'ACCOUNT_CLOSING' using errcode='42501';end if;end loop;
end $f$;
create function private.support_operator_revision_v5(a uuid) returns integer language plpgsql security definer set search_path=pg_catalog as $f$
declare r integer;begin
 perform pg_advisory_xact_lock_shared(private.support_operator_key_v5());
 select revision into r from private.support_operator_grants_v5 where singleton and account_id=a and active and purpose='PRIVATE_TEST_OWNER_SUPPORT';
 return r;
end $f$;
create function private.support_immutable_v5() returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
begin raise exception 'SUPPORT_HISTORY_IMMUTABLE' using errcode='55000';end $f$;
do $immutable$ declare t text;begin foreach t in array array['support_events_v5','support_decisions_v5','support_evidence_v5','support_commands_v5','support_operator_audit_v5','support_grant_commands_v5'] loop
 execute format('create trigger support_immutable_v5 before update or delete on private.%I for each row execute function private.support_immutable_v5()',t);end loop;end $immutable$;
create function private.support_case_guard_v5() returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if tg_op='DELETE' or (to_jsonb(new)-array['status','revision','sequence','updated_at']) is distinct from (to_jsonb(old)-array['status','revision','sequence','updated_at'])
 then raise exception 'SUPPORT_HISTORY_IMMUTABLE' using errcode='55000';end if;return new;
end $f$;
create trigger support_case_guard_v5 before update or delete on private.support_cases_v5 for each row execute function private.support_case_guard_v5();

create function private.support_command_document_v5(a uuid,k uuid) returns jsonb language sql stable security definer set search_path=pg_catalog as $f$
 select jsonb_build_object('accountId',a,'clientRequestId',k,'kind',c.kind,'state',coalesce(c.state,'ABSENT'),'caseId',c.case_id,'expectedRevision',c.expected_revision,'inputSha256',c.input_sha256,'receipt',c.receipt,'authoritative',true)
 from (select 1) x left join private.support_commands_v5 c on c.account_id=a and c.client_request_id=k
$f$;
create function public.rpc_support_read_command_v5(p_expected_user_id uuid,p_client_request_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);begin
 if p_client_request_id is null then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
 return private.support_command_document_v5(u,p_client_request_id);
end $f$;
create function public.rpc_support_cancel_command_v5(p_expected_user_id uuid,p_client_request_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);begin
 if p_client_request_id is null then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
 -- Opaque cancellation is safe even when an executor already restricts writes:
 -- no case/event/provider exists, and retained account subjects are not deleted.
 perform pg_advisory_xact_lock_shared(private.closure_account_key(u));perform pg_advisory_xact_lock(private.support_command_key_v5(u,p_client_request_id));perform private.support_auth_v5(u);
 insert into private.support_commands_v5(account_id,client_request_id,state) values(u,p_client_request_id,'CANCELLED') on conflict do nothing;
 return private.support_command_document_v5(u,p_client_request_id);
end $f$;

create function private.support_reference_v5(a uuid,v jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare k text;i uuid;rev integer;n public.needs;ag public.agreements;m public.agreement_messages;gm private.group_messages_v5;
 review private.ai_task_reviews;sr private.safety_reports;content jsonb;facts jsonb;resolution jsonb;paths jsonb;media jsonb;media_owner uuid;begin
 if jsonb_typeof(v) is distinct from 'object' or v-array['kind','id','revision']<>'{}' or not(v?&array['kind','id','revision'])
 or jsonb_typeof(v->'kind') is distinct from 'string' or jsonb_typeof(v->'id') is distinct from 'string'
 or coalesce(v->>'id','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 or (v->'revision'<>'null' and (jsonb_typeof(v->'revision')<>'number' or (v->>'revision')!~'^[1-9][0-9]{0,9}$')) then raise exception 'SUPPORT_REFERENCE_INVALID' using errcode='22023';end if;
 k:=v->>'kind';i:=(v->>'id')::uuid;rev:=(v->>'revision')::integer;
 if k='TASK' then
  select * into n from public.needs where id=i for share;
  if not found or not(n.requester_account_id=a or n.status in('PUBLISHED','SELECTION') or rls_private.need_participant_can_read(n.id)) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
  if n.revision is distinct from rev then raise exception 'SUPPORT_REFERENCE_STALE' using errcode='40001';end if;
  content:=jsonb_build_object('title',n.title,'description',n.description,'status',n.status,'createdAt',n.created_at,'executionMode',n.execution_location_mode,'countryCode',n.task_country_code,'submitterRole',case when n.requester_account_id=a then 'REQUESTER' else 'READER' end);
  media_owner:=n.requester_account_id;paths:=to_jsonb(n.public_photo_paths);
 elsif k='AGREEMENT' then
  select * into ag from public.agreements where id=i for share;
  if not found or a not in(ag.requester_account_id,ag.worker_account_id) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
  if ag.current_version is distinct from rev then raise exception 'SUPPORT_REFERENCE_STALE' using errcode='40001';end if;
  content:=jsonb_build_object('needId',ag.need_id,'status',ag.status,'createdAt',ag.created_at,'submitterRole',case when a=ag.requester_account_id then 'REQUESTER' else 'WORKER' end);
 elsif k='AGREEMENT_MESSAGE' then
  select * into m from public.agreement_messages where id=i;
  select * into ag from public.agreements where id=m.agreement_id;
  if ag.id is null or a not in(ag.requester_account_id,ag.worker_account_id) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
  if m.agreement_version is distinct from rev then raise exception 'SUPPORT_REFERENCE_STALE' using errcode='40001';end if;
  -- Bilateral historical reads remain available to the two participants. A
  -- selected message never imports adjacent messages or private Agreement terms.
  content:=jsonb_build_object('agreementId',m.agreement_id,'body',m.body,'createdAt',m.created_at,'mine',m.sender_account_id=a);
 elsif k='GROUP_MESSAGE' then
  select * into gm from private.group_messages_v5 where id=i;
  if not found or rev is not null or not exists(select 1 from private.group_message_visibility_v5 where message_id=i and account_id=a)
  or not exists(select 1 from private.group_conversations_v5 g where g.id=gm.group_id and private.group_member_v5(g,a)) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
  content:=jsonb_build_object('groupId',gm.group_id,'sequence',gm.sequence::text,'body',gm.body,'createdAt',gm.created_at,'mine',gm.sender_account_id=a);
 elsif k='TASK_REVIEW' then
  select * into review from private.ai_task_reviews where id=i and account_id=a;
  if not found or rev is not null then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
  select coalesce(jsonb_agg(x),'[]') into facts from jsonb_array_elements(review.envelope->'publicProjection') x where x->>'key' not in('need.exact_address','need.access_notes','need.resolved_location','need.public_photo_paths');
  content:=jsonb_build_object('draftId',review.envelope->'draftId','draftRevision',review.envelope->'draftRevision','displayedContentDigest',review.envelope->'displayedContentDigest',
   'publicFacts',private.data_export_task_facts_v5(facts),'safety',review.envelope->'safety','createdAt',review.created_at,
   'policy',jsonb_build_object('bundleId',review.policy_binding->'bundleId','version',review.policy_binding->'version','contentSha256',review.policy_binding->'contentSha256'),
   'evaluation',(select jsonb_build_object('kind',c.evaluation->'kind','outcome',c.evaluation#>'{decision,outcome}','safeReasonCodes',c.evaluation#>'{decision,safeReasonCodes}') from private.ai_task_review_commands c where c.review_id=i));
  media_owner:=a;select x->'value' into paths from jsonb_array_elements(review.envelope->'publicProjection') x where x->>'key'='need.public_photo_paths';paths:=coalesce(paths,'[]');
 elsif k='SAFETY_REPORT' then
  select * into sr from private.safety_reports where id=i and reporter_account_id=a;
  if not found or rev is not null then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
  -- Narrative remains solely in safety_reports; only its exact owned reference.
  content:=jsonb_build_object('category',sr.category,'needId',sr.need_id,'agreementId',sr.agreement_id,'createdAt',sr.created_at);
 else raise exception 'SUPPORT_REFERENCE_INVALID' using errcode='22023';end if;
 if media_owner is not null then
  perform pg_advisory_xact_lock(private.media_evidence_key_v5(media_owner));
  resolution:=private.resolve_media_snapshot_v5(media_owner,coalesce(paths,'[]'));
  if resolution->'resolved' is distinct from 'true'::jsonb then raise exception 'SUPPORT_MEDIA_REFERENCE_NOT_AVAILABLE' using errcode='55000';end if;
  select coalesce(jsonb_agg(jsonb_build_object('assetId',x->'assetId','sha256',x->'sha256','width',x->'width','height',x->'height') order by x->>'assetId'),'[]') into media from jsonb_array_elements(resolution->'assets') x;
  content:=content||jsonb_build_object('media',media);
 end if;
 return jsonb_build_object('kind',k,'id',i,'revision',rev,'content',content);
end $f$;

-- Exact registered Task photos selected by a reference become evidence under
--139's existing immutable Storage guard. No new upload or blanket bucket grant.
alter table private.media_evidence_refs_v5 drop constraint media_evidence_refs_v5_source_kind_check;
alter table private.media_evidence_refs_v5 add constraint media_evidence_refs_v5_source_kind_check check(source_kind in('AGREEMENT_VERSION','AGREEMENT_PROBLEM','SAFETY_REPORT','RETENTION_HOLD','SUPPORT_CASE'));
create function private.support_capture_media_v5(cid uuid,ver integer,snapshot jsonb) returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare x jsonb;m private.owned_media_assets;begin
 for x in select value from jsonb_array_elements(coalesce(snapshot#>'{content,media}','[]')) loop
  select * into m from private.owned_media_assets where id=(x->>'assetId')::uuid;
  if m.id is null then raise exception 'SUPPORT_MEDIA_REFERENCE_NOT_AVAILABLE' using errcode='55000';end if;
  perform pg_advisory_xact_lock(private.media_evidence_key_v5(m.account_id));
  select * into m from private.owned_media_assets where id=m.id and state='READY' and sanitized_sha256=x->>'sha256';
  if not found or not exists(select 1 from storage.objects where bucket_id='profile-media' and name=m.storage_path) then raise exception 'SUPPORT_MEDIA_REFERENCE_NOT_AVAILABLE' using errcode='55000';end if;
  insert into private.media_evidence_refs_v5(asset_id,account_id,source_kind,source_id,source_version) values(m.id,m.account_id,'SUPPORT_CASE',cid,ver) on conflict do nothing;
 end loop;
end $f$;

create function private.support_safety_case_v5(r private.safety_reports,p_historical boolean default false) returns uuid language plpgsql security definer set search_path=pg_catalog as $f$
declare c private.support_cases_v5;begin
 if not p_historical then perform private.support_safe_exit_v5(r.reporter_account_id);end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:support:safety:'||r.id::text,10143));
 select * into c from private.support_cases_v5 where safety_report_id=r.id;if found then return c.id;end if;
 insert into private.support_cases_v5(account_id,channel,topic,title,context,safety_report_id,ordinary,created_at,updated_at)
 values(r.reporter_account_id,'SAFETY','SAFETY_REPORT',r.reason,jsonb_build_object('kind','SAFETY_REPORT','id',r.id,'revision',null,
 'content',jsonb_build_object('category',r.category,'needId',r.need_id,'agreementId',r.agreement_id,'createdAt',r.created_at)),r.id,false,r.created_at,r.created_at) returning * into c;
 insert into private.support_events_v5(case_id,sequence,actor_account_id,author_role,kind,created_at) values(c.id,1,r.reporter_account_id,'AUTHOR','SAFETY_REPORT',r.created_at);
 return c.id;
end $f$;
create function private.support_safety_capture_v5() returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
begin perform private.support_safety_case_v5(new);return new;end $f$;
-- Acquire author closure before139 AFTER INSERT takes its media-owner barrier.
-- This preserves closure→media ordering, including two opposite-party reports.
create function private.support_safety_closure_v5() returns trigger language plpgsql security definer set search_path=pg_catalog as $f$
begin perform private.support_safe_exit_v5(new.reporter_account_id);return new;end $f$;
create trigger support_safety_closure_v5 before insert on private.safety_reports for each row execute function private.support_safety_closure_v5();
create trigger support_safety_capture_v5 after insert on private.safety_reports for each row execute function private.support_safety_capture_v5();
do $safety_backfill$ declare r private.safety_reports;begin for r in select * from private.safety_reports order by reporter_account_id,id loop perform private.support_safety_case_v5(r,true);end loop;end $safety_backfill$;

create function private.support_event_document_v5(e private.support_events_v5) returns jsonb language sql stable security definer set search_path=pg_catalog as $f$
 select jsonb_build_object('id',e.id,'caseId',e.case_id,'sequence',e.sequence::text,'kind',e.kind,'authorRole',e.author_role,
 'body',case when e.kind='SAFETY_REPORT' then (select r.narrative from private.safety_reports r join private.support_cases_v5 c on c.safety_report_id=r.id where c.id=e.case_id) else e.body end,
 'createdAt',e.created_at,'decisionId',e.decision_id,'appealId',e.appeal_id)
$f$;
create function private.support_decision_document_v5(d private.support_decisions_v5) returns jsonb language sql immutable set search_path=pg_catalog as $f$
 select jsonb_build_object('id',d.id,'caseId',d.case_id,'caseRevision',d.case_revision,'outcome',d.outcome,'reasonCode',d.reason_code,
 'explanation',d.explanation,'effect',d.effect,'evidenceIds',to_jsonb(d.evidence_ids),'priorDecisionId',d.prior_decision_id,'createdAt',d.created_at,'reviewType',case when d.prior_decision_id is null then 'INITIAL' else 'RECONSIDERATION' end)
$f$;
create function private.support_allowed_actions_v5(c private.support_cases_v5,u uuid,g integer) returns text[] language sql stable security definer set search_path=pg_catalog as $f$
 select case when exists(select 1 from private.closure_executions_v5 where account_id in(u,c.account_id)) or exists(select 1 from private.account_closure_requests where account_id in(u,c.account_id) and state in('EXECUTING','CLOSED')) then '{}'::text[]
 when c.account_id=u then
 (case when c.status<>'CLOSED' then array['AUTHOR_REPLY'] else '{}'::text[] end)||
 (case when exists(select 1 from private.support_decisions_v5 d where d.case_id=c.id and not exists(select 1 from private.support_appeals_v5 a where a.decision_id=d.id and a.status<>'DECIDED')) then array['APPEAL'] else '{}'::text[] end)
 when g is null then '{}'::text[]
 when exists(select 1 from private.support_appeals_v5 a where a.case_id=c.id and a.status='RECEIVED') then array['CLAIM_APPEAL']
 when c.status='RECEIVED' then array['CLAIM']
 when exists(select 1 from private.support_appeals_v5 a where a.case_id=c.id and a.status='IN_REVIEW') then array['OPERATOR_REPLY','REQUEST_INFO','DECIDE_APPEAL']
 when c.status in('IN_REVIEW','WAITING_FOR_AUTHOR') then array['OPERATOR_REPLY','REQUEST_INFO','DECIDE']
 when c.status='DECIDED' then array['CLOSE'] else '{}'::text[] end
$f$;

create function public.rpc_support_set_operator_service_v5(p_account_id uuid,p_active boolean,p_expected_revision integer,p_client_request_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare g private.support_operator_grants_v5;c private.support_grant_commands_v5;h text;r jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if p_account_id is null or p_active is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=2147483646 or p_client_request_id is null then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
 if p_active then perform private.support_safe_exit_v5(p_account_id);else perform pg_advisory_xact_lock_shared(private.closure_account_key(p_account_id));end if;
 perform pg_advisory_xact_lock(private.support_operator_key_v5());
 h:=encode(extensions.digest(jsonb_build_array(p_account_id,p_active,p_expected_revision)::text,'sha256'),'hex');
 select * into c from private.support_grant_commands_v5 where client_request_id=p_client_request_id;
 if found then if c.input_sha256<>h then raise exception 'SUPPORT_KEY_REUSED' using errcode='22023';end if;return c.receipt;end if;
 select * into g from private.support_operator_grants_v5 where singleton;
 if coalesce(g.revision,0)<>p_expected_revision then raise exception 'SUPPORT_GRANT_STALE' using errcode='40001';end if;
 if g.active and g.account_id<>p_account_id then raise exception 'SUPPORT_OPERATOR_ALREADY_GRANTED' using errcode='55000';end if;
 if not p_active and g.account_id is distinct from p_account_id then raise exception 'SUPPORT_GRANT_STALE' using errcode='40001';end if;
 if p_active and not exists(select 1 from auth.users where id=p_account_id and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp())) then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 insert into private.support_operator_grants_v5(singleton,account_id,purpose,active,revision,granted_at,updated_at)
 values(true,p_account_id,'PRIVATE_TEST_OWNER_SUPPORT',p_active,p_expected_revision+1,clock_timestamp(),clock_timestamp())
 on conflict(singleton) do update set account_id=excluded.account_id,active=excluded.active,revision=excluded.revision,granted_at=case when excluded.active then excluded.granted_at else support_operator_grants_v5.granted_at end,updated_at=excluded.updated_at;
 insert into private.support_operator_audit_v5(actor_account_id,action,grant_revision) values(p_account_id,case when p_active then 'SERVICE_GRANT' else 'SERVICE_REVOKE' end,p_expected_revision+1);
 r:=jsonb_build_object('accountId',p_account_id,'purpose','PRIVATE_TEST_OWNER_SUPPORT','active',p_active,'revision',p_expected_revision+1,'authoritative',true);
 insert into private.support_grant_commands_v5(client_request_id,account_id,input_sha256,receipt) values(p_client_request_id,p_account_id,h,r);return r;
end $f$;

create function public.rpc_support_submit_v5(p_expected_user_id uuid,p_client_request_id uuid,p_kind text,p_case_id uuid,p_expected_revision integer,p_payload_text text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);p jsonb;c private.support_cases_v5;cmd private.support_commands_v5;
 g integer;h text;body text;ev private.support_events_v5;d private.support_decisions_v5;ap private.support_appeals_v5;
 ctx jsonb;ref jsonb;snapshot jsonb;refs jsonb:='[]';evidence_ids uuid[]:='{}';eid uuid;v_ordinary boolean;owner_id uuid;role_name text;next_status text;r jsonb;
begin
 if p_client_request_id is null or p_kind is null or p_kind not in('CREATE','AUTHOR_REPLY','CLAIM','OPERATOR_REPLY','REQUEST_INFO','DECIDE','APPEAL','CLAIM_APPEAL','DECIDE_APPEAL','CLOSE')
 or p_payload_text is null or octet_length(p_payload_text)>65536
 or (p_kind='CREATE' and (p_case_id is not null or p_expected_revision is not null))
 or (p_kind<>'CREATE' and (p_case_id is null or p_expected_revision is null or p_expected_revision<1 or p_expected_revision>=2147483646)) then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
 begin p:=p_payload_text::jsonb;exception when data_exception then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end;
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
 -- Hash the actual UTF8 transport and its typed scope, never PostgreSQL's
 -- reserialized JSONB whitespace. No plaintext is retained in the command.
 h:=encode(extensions.digest(convert_to(p_kind||E'\n'||coalesce(p_case_id::text,'')||E'\n'||coalesce(p_expected_revision::text,'')||E'\n'||p_payload_text,'UTF8'),'sha256'),'hex');
 select account_id into owner_id from private.support_cases_v5 where id=p_case_id;
 perform private.support_safe_exit_v5(u,owner_id);
 -- Private-test writes share one short transaction barrier. This also orders
 -- different selected media owners and exact grant revocation without lock upgrades.
 perform pg_advisory_xact_lock(private.support_operator_key_v5());g:=private.support_operator_revision_v5(u);
 perform pg_advisory_xact_lock(private.support_command_key_v5(u,p_client_request_id));perform private.support_auth_v5(u);
 select * into cmd from private.support_commands_v5 where account_id=u and client_request_id=p_client_request_id;
 if found then
  if cmd.state='COMMITTED' and cmd.input_sha256<>h then raise exception 'SUPPORT_KEY_REUSED' using errcode='22023';end if;
  return private.support_command_document_v5(u,p_client_request_id);
 end if;
 -- One actor quota lock serializes different keys; exact replay above is free.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:support:quota:'||u::text,10143));
 if p_kind='CREATE' then
  if p-array['channel','topic','title','body','desiredOutcome','context','evidence']<>'{}' or not(p?&array['channel','topic','title','body','desiredOutcome','context','evidence'])
  or jsonb_typeof(p->'channel') is distinct from 'string' or jsonb_typeof(p->'topic') is distinct from 'string'
  or jsonb_typeof(p->'title') is distinct from 'string' or length(btrim(p->>'title')) not between 1 and 200 or octet_length(p->>'title')>800
  or (p->'desiredOutcome'<>'null' and (jsonb_typeof(p->'desiredOutcome')<>'string' or length(p->>'desiredOutcome')>1000 or octet_length(p->>'desiredOutcome')>4000))
  or jsonb_typeof(p->'evidence') is distinct from 'array' or jsonb_array_length(p->'evidence')>50 then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
  if not((p->>'channel'='SERVICE' and p->>'topic' in('TECHNICAL','SERVICE_COMPLAINT','OTHER'))
   or(p->>'channel'='TASK' and p->>'topic' in('COLLABORATION','NO_SHOW','PUBLICATION_REVIEW'))
   or(p->>'channel'='LEGAL_PRIVACY' and p->>'topic' in('CONTENT_NOTICE','PRIVACY_RIGHTS')))
  then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
  v_ordinary:=p->>'topic'<>'PRIVACY_RIGHTS';
  if v_ordinary then
   if (select count(*) from private.support_cases_v5 where account_id=u and ordinary and created_at>clock_timestamp()-interval '24 hours')>=5 then raise exception 'SUPPORT_CASE_DAILY_LIMIT' using errcode='54000';end if;
   if exists(select 1 from private.support_cases_v5 where account_id=u and ordinary and created_at>clock_timestamp()-interval '60 seconds') then raise exception 'SUPPORT_CREATE_COOLDOWN' using errcode='54000';end if;
  end if;
  ctx:=case when p->'context'='null' then '{}'::jsonb else private.support_reference_v5(u,p->'context') end;
  if (p->>'topic' in('COLLABORATION','NO_SHOW') and ctx->>'kind' is distinct from 'AGREEMENT')
  or(p->>'topic'='PUBLICATION_REVIEW' and ctx->>'kind' is distinct from 'TASK_REVIEW')
  then raise exception 'SUPPORT_CONTEXT_REQUIRED' using errcode='22023';end if;
  refs:=p->'evidence';body:=p->>'body';role_name:='AUTHOR';next_status:='RECEIVED';
 else
  select * into c from private.support_cases_v5 where id=p_case_id for update;
  if not found or (c.account_id<>u and g is null) then raise exception 'SUPPORT_CASE_NOT_AVAILABLE' using errcode='42501';end if;
  if c.revision<>p_expected_revision or c.sequence>=9007199254740990 then raise exception 'SUPPORT_REVISION_STALE' using errcode='40001';end if;
  if not(p_kind=any(private.support_allowed_actions_v5(c,u,g))) then raise exception 'SUPPORT_ACTION_NOT_AVAILABLE' using errcode='42501';end if;
  role_name:=case when c.account_id=u then 'AUTHOR' else 'OPERATOR' end;next_status:=c.status;
  if p_kind='AUTHOR_REPLY' then
   if p-array['body','evidence']<>'{}' or not(p?&array['body','evidence']) or jsonb_typeof(p->'evidence') is distinct from 'array' or jsonb_array_length(p->'evidence')>50 then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
   if c.ordinary and (select count(*) from private.support_events_v5 e join private.support_cases_v5 z on z.id=e.case_id where e.actor_account_id=u and e.kind='AUTHOR_REPLY' and z.ordinary and e.created_at>clock_timestamp()-interval '24 hours')>=50 then raise exception 'SUPPORT_REPLY_DAILY_LIMIT' using errcode='54000';end if;
   body:=p->>'body';refs:=p->'evidence';next_status:=case when c.status='RECEIVED' then 'RECEIVED' else 'IN_REVIEW' end;
  elsif p_kind in('OPERATOR_REPLY','REQUEST_INFO') then
   if p-array['body']<>'{}' or not(p?'body') then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
   body:=p->>'body';if p_kind='REQUEST_INFO' then next_status:='WAITING_FOR_AUTHOR';end if;
  elsif p_kind='CLAIM' then
   if p<>'{}' then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;next_status:='IN_REVIEW';
  elsif p_kind='CLOSE' then
   if p<>'{}' then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;next_status:='CLOSED';
  elsif p_kind='APPEAL' then
   if p-array['decisionId','body']<>'{}' or not(p?&array['decisionId','body']) or coalesce(p->>'decisionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
   select * into d from private.support_decisions_v5 where id=(p->>'decisionId')::uuid and case_id=c.id;
   if not found then raise exception 'SUPPORT_DECISION_NOT_AVAILABLE' using errcode='42501';end if;
   if exists(select 1 from private.support_appeals_v5 where decision_id=d.id and status<>'DECIDED') then raise exception 'SUPPORT_APPEAL_ALREADY_OPEN' using errcode='40001';end if;
   insert into private.support_appeals_v5(case_id,decision_id,account_id) values(c.id,d.id,u) returning * into ap;
   body:=p->>'body';next_status:='RECEIVED';
  elsif p_kind='CLAIM_APPEAL' then
   if p-array['appealId']<>'{}' or not(p?'appealId') or coalesce(p->>'appealId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
   update private.support_appeals_v5 set status='IN_REVIEW' where id=(p->>'appealId')::uuid and case_id=c.id and status='RECEIVED' returning * into ap;
   if not found then raise exception 'SUPPORT_APPEAL_NOT_AVAILABLE' using errcode='42501';end if;next_status:='IN_REVIEW';
  elsif p_kind in('DECIDE','DECIDE_APPEAL') then
   if p-array['outcome','reasonCode','body','evidenceIds','appealId']<>'{}' or not(p?&array['outcome','reasonCode','body','evidenceIds','appealId'])
   or jsonb_typeof(p->'outcome') is distinct from 'string' or p->>'outcome' not in('ACCEPTED','REJECTED')
   or jsonb_typeof(p->'reasonCode') is distinct from 'string' or (p->>'reasonCode')!~'^[A-Z][A-Z0-9_]{0,63}$'
   or jsonb_typeof(p->'evidenceIds') is distinct from 'array' or jsonb_array_length(p->'evidenceIds')>50 then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
   for ref in select value from jsonb_array_elements(p->'evidenceIds') loop
    if jsonb_typeof(ref)<>'string' or (ref#>>'{}')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
    eid:=(ref#>>'{}')::uuid;if eid=any(evidence_ids) or not exists(select 1 from private.support_evidence_v5 where id=eid and case_id=c.id) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;evidence_ids:=array_append(evidence_ids,eid);
   end loop;
   if p_kind='DECIDE_APPEAL' then
    if coalesce(p->>'appealId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
    select * into ap from private.support_appeals_v5 where id=(p->>'appealId')::uuid and case_id=c.id and status='IN_REVIEW';
    if not found then raise exception 'SUPPORT_APPEAL_NOT_AVAILABLE' using errcode='42501';end if;
   elsif p->'appealId'<>'null' then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
   body:=p->>'body';next_status:='DECIDED';
  end if;
 end if;
 if p_kind in('CREATE','AUTHOR_REPLY','OPERATOR_REPLY','REQUEST_INFO','DECIDE','DECIDE_APPEAL','APPEAL')
 and(jsonb_typeof(p->'body') is distinct from 'string' or length(btrim(body)) not between 1 and 4000 or octet_length(body)>16000) then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
 body:=btrim(body);
 if p_kind='CREATE' then
  insert into private.support_cases_v5(account_id,channel,topic,title,desired_outcome,context,ordinary)
  values(u,p->>'channel',p->>'topic',btrim(p->>'title'),p->>'desiredOutcome',ctx,v_ordinary) returning * into c;
  perform private.support_capture_media_v5(c.id,c.revision,ctx);
 else
  update private.support_cases_v5 set status=next_status,revision=revision+1,sequence=sequence+1,updated_at=clock_timestamp() where id=c.id returning * into c;
 end if;
 if p_kind in('DECIDE','DECIDE_APPEAL') then
  insert into private.support_decisions_v5(case_id,case_revision,operator_account_id,grant_revision,outcome,reason_code,explanation,evidence_ids,prior_decision_id)
  values(c.id,c.revision,u,g,p->>'outcome',p->>'reasonCode',body,evidence_ids,ap.decision_id) returning * into d;
  if ap.id is not null then update private.support_appeals_v5 set status='DECIDED',decision_result_id=d.id where id=ap.id;end if;
 end if;
 insert into private.support_events_v5(case_id,sequence,actor_account_id,author_role,kind,body,decision_id,appeal_id)
 values(c.id,c.sequence,u,role_name,p_kind,body,d.id,ap.id) returning * into ev;
 for ref in select value from jsonb_array_elements(refs) loop
  snapshot:=private.support_reference_v5(u,ref);
  perform private.support_capture_media_v5(c.id,c.revision,snapshot);
  insert into private.support_evidence_v5(case_id,event_id,submitted_by_account_id,source_kind,source_id,source_revision,snapshot,snapshot_sha256)
  values(c.id,ev.id,u,snapshot->>'kind',(snapshot->>'id')::uuid,(snapshot->>'revision')::integer,snapshot,encode(extensions.digest(snapshot::text,'sha256'),'hex'));
 end loop;
 if c.safety_report_id is not null then update private.safety_reports set status=case when next_status='CLOSED' then 'RESOLVED' when next_status='RECEIVED' then 'RECEIVED' else 'IN_REVIEW' end where id=c.safety_report_id;end if;
 if role_name='OPERATOR' then insert into private.support_operator_audit_v5(actor_account_id,action,case_id,grant_revision) values(u,p_kind,c.id,g);end if;
 perform private.support_auth_v5(u);
 r:=jsonb_build_object('accountId',u,'clientRequestId',p_client_request_id,'kind',p_kind,'caseId',c.id,'caseNumber',c.case_number::text,
 'expectedRevision',p_expected_revision,'inputSha256',h,'eventId',ev.id,'sequence',ev.sequence::text,'caseRevision',c.revision,'createdAt',ev.created_at,'authoritative',true);
 insert into private.support_commands_v5(account_id,client_request_id,kind,input_sha256,expected_revision,state,case_id,receipt) values(u,p_client_request_id,p_kind,h,p_expected_revision,'COMMITTED',c.id,r);
 return private.support_command_document_v5(u,p_client_request_id);
end $f$;

create function public.rpc_support_capabilities_v5(p_expected_user_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);g integer:=private.support_operator_revision_v5(u);begin
 perform private.support_auth_v5(u);
 return jsonb_build_object('accountId',u,'operatorAvailable',g is not null,'canCreate',not exists(select 1 from private.closure_executions_v5 where account_id=u)
 and not exists(select 1 from private.account_closure_requests where account_id=u and state in('EXECUTING','CLOSED')),'authoritative',true);
end $f$;
create function public.rpc_support_inbox_v5(p_expected_user_id uuid,p_mode text,p_before_case_number text default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);g integer:=private.support_operator_revision_v5(u);items jsonb;last_number bigint;next_number text;before_number bigint;begin
 if p_mode is null or p_mode not in('OWN','OPERATOR','SAFETY') or (p_before_case_number is not null and p_before_case_number!~'^[1-9][0-9]{0,17}$') then raise exception 'SUPPORT_CURSOR_INVALID' using errcode='22023';end if;
 if p_mode<>'OWN' and g is null then raise exception 'SUPPORT_OPERATOR_REQUIRED' using errcode='42501';end if;
 before_number:=p_before_case_number::bigint;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'caseNumber',c.case_number::text,'channel',c.channel,'topic',c.topic,'status',c.status,'revision',c.revision,
 'lastSequence',c.sequence::text,'createdAt',c.created_at,'updatedAt',c.updated_at,
 'context',case when c.context='{}' then null else jsonb_build_object('kind',c.context->'kind','id',c.context->'id','revision',c.context->'revision') end,
 'unread',exists(select 1 from private.support_events_v5 e where e.case_id=c.id and e.actor_account_id<>u and e.sequence>coalesce((select m.sequence from private.support_read_markers_v5 m where m.account_id=u and m.case_id=c.id),0))) order by c.case_number desc),'[]'),min(c.case_number)
 into items,last_number from (select * from private.support_cases_v5 x where (p_mode<>'OWN' or x.account_id=u) and(p_mode<>'SAFETY' or x.channel='SAFETY')
 and(before_number is null or x.case_number<before_number) order by x.case_number desc limit 50)c;
 if exists(select 1 from private.support_cases_v5 c where c.case_number<last_number and(p_mode<>'OWN' or c.account_id=u) and(p_mode<>'SAFETY' or c.channel='SAFETY')) then next_number:=last_number::text;end if;
 if p_mode<>'OWN' then insert into private.support_operator_audit_v5(actor_account_id,action,grant_revision) values(u,'INBOX_'||p_mode,g);end if;
 perform private.support_auth_v5(u);
 return jsonb_build_object('accountId',u,'mode',p_mode,'operatorAvailable',g is not null,'cases',items,'nextBeforeCaseNumber',next_number,'authoritative',true);
end $f$;
create function public.rpc_support_detail_v5(p_expected_user_id uuid,p_case_id uuid,p_after_sequence text default '0') returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);g integer:=private.support_operator_revision_v5(u);c private.support_cases_v5;
 evs jsonb;ds jsonb;aps jsonb;es jsonb;ids uuid[];after_seq bigint;last_seq bigint;next_seq text;begin
 if p_after_sequence is null or p_after_sequence!~'^(0|[1-9][0-9]{0,15})$' then raise exception 'SUPPORT_CURSOR_INVALID' using errcode='22023';end if;
 after_seq:=p_after_sequence::bigint;
 select * into c from private.support_cases_v5 where id=p_case_id;
 if not found or(c.account_id<>u and g is null) then raise exception 'SUPPORT_CASE_NOT_AVAILABLE' using errcode='42501';end if;
 select coalesce(jsonb_agg(private.support_event_document_v5(e) order by e.sequence),'[]'),array_agg(e.id),max(e.sequence)
 into evs,ids,last_seq from(select * from private.support_events_v5 where case_id=c.id and sequence>after_seq order by sequence limit 50)e;
 if exists(select 1 from private.support_events_v5 where case_id=c.id and sequence>last_seq) then next_seq:=last_seq::text;end if;
 select coalesce(jsonb_agg(private.support_decision_document_v5(d) order by d.created_at,d.id),'[]') into ds from private.support_decisions_v5 d
 where d.case_id=c.id and exists(select 1 from private.support_events_v5 e where e.id=any(ids) and e.decision_id=d.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'caseId',a.case_id,'decisionId',a.decision_id,'status',a.status,'decisionResultId',a.decision_result_id,'createdAt',a.created_at) order by a.created_at,a.id),'[]') into aps from private.support_appeals_v5 a
 where a.case_id=c.id and exists(select 1 from private.support_events_v5 e where e.id=any(ids) and e.appeal_id=a.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'eventId',e.event_id,'reference',e.snapshot,'createdAt',e.created_at) order by e.created_at,e.id),'[]') into es from private.support_evidence_v5 e where e.case_id=c.id and e.event_id=any(ids);
 if c.account_id<>u then insert into private.support_operator_audit_v5(actor_account_id,action,case_id,grant_revision) values(u,'DETAIL_READ',c.id,g);end if;
 perform private.support_auth_v5(u);
 return jsonb_build_object('accountId',u,'case',jsonb_build_object('id',c.id,'caseNumber',c.case_number::text,'authorAccountId',c.account_id,'channel',c.channel,'topic',c.topic,'title',c.title,
 'desiredOutcome',c.desired_outcome,'context',c.context,'status',c.status,'revision',c.revision,'lastSequence',c.sequence::text,'createdAt',c.created_at,'updatedAt',c.updated_at),
 'viewerRole',case when c.account_id=u then 'AUTHOR' else 'OPERATOR' end,'operatorAvailable',g is not null,'allowedActions',to_jsonb(private.support_allowed_actions_v5(c,u,g)),
 'events',evs,'decisions',ds,'appeals',aps,'evidence',es,'nextAfterSequence',next_seq,'authoritative',true);
end $f$;
create function public.rpc_support_mark_read_v5(p_expected_user_id uuid,p_case_id uuid,p_sequence text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);g integer;c private.support_cases_v5;s bigint;begin
 if p_sequence is null or p_sequence!~'^[1-9][0-9]{0,15}$' then raise exception 'SUPPORT_CURSOR_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock_shared(private.closure_account_key(u));g:=private.support_operator_revision_v5(u);s:=p_sequence::bigint;
 select * into c from private.support_cases_v5 where id=p_case_id;
 if not found or(c.account_id<>u and g is null) or not exists(select 1 from private.support_events_v5 where case_id=c.id and sequence=s) then raise exception 'SUPPORT_CASE_NOT_AVAILABLE' using errcode='42501';end if;
 perform private.support_auth_v5(u);
 insert into private.support_read_markers_v5(account_id,case_id,sequence) values(u,c.id,s)
 on conflict(account_id,case_id) do update set sequence=greatest(support_read_markers_v5.sequence,excluded.sequence),updated_at=clock_timestamp() returning sequence into s;
 if c.account_id<>u then insert into private.support_operator_audit_v5(actor_account_id,action,case_id,grant_revision) values(u,'MARK_READ',c.id,g);end if;
 return jsonb_build_object('accountId',u,'caseId',c.id,'sequence',s::text,'authoritative',true);
end $f$;
create function public.rpc_support_find_context_v5(p_expected_user_id uuid,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);cid uuid;begin
 if p_kind is null or p_kind not in('TASK','AGREEMENT','AGREEMENT_MESSAGE','GROUP_MESSAGE','TASK_REVIEW','SAFETY_REPORT') or p_id is null then raise exception 'SUPPORT_INPUT_INVALID' using errcode='22023';end if;
 -- A selected message can be evidence while the case context is its Agreement.
 -- Recovery still searches only this author's cases, never an operator inbox.
 select c.id into cid from private.support_cases_v5 c where c.account_id=u and(
  (c.context->>'kind'=p_kind and c.context->>'id'=p_id::text)
  or exists(select 1 from private.support_evidence_v5 e where e.case_id=c.id and e.submitted_by_account_id=u
   and e.source_kind=p_kind and e.source_id=p_id)) order by c.case_number desc limit 1;
 return jsonb_build_object('accountId',u,'caseId',cid,'authoritative',true);
end $f$;

create function public.rpc_support_media_service_v5(p_account_id uuid,p_session_id uuid,p_case_id uuid,p_asset_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c private.support_cases_v5;g integer;m private.owned_media_assets;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if not private.push_session_valid(p_account_id,p_session_id) then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 g:=private.support_operator_revision_v5(p_account_id);select * into c from private.support_cases_v5 where id=p_case_id;
 if not found or(c.account_id<>p_account_id and g is null) or not exists(select 1 from private.media_evidence_refs_v5 where source_kind='SUPPORT_CASE' and source_id=c.id and asset_id=p_asset_id)
 then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
 select * into m from private.owned_media_assets where id=p_asset_id and state='READY' and dispatch_outcome='STORED';
 if not found then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
 if c.account_id<>p_account_id then insert into private.support_operator_audit_v5(actor_account_id,action,case_id,grant_revision) values(p_account_id,'MEDIA_READ',c.id,g);end if;
 if not private.push_session_valid(p_account_id,p_session_id) then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 return jsonb_build_object('assetId',m.id,'caseId',c.id,'bucket','profile-media','path',m.storage_path,'sha256',m.sanitized_sha256,'contentType','image/jpeg','byteSize',m.byte_size,'authoritative',true);
end $f$;

-- Compose the existing131 HTTP fence with the approved support safe exit.
-- Exact RPC paths only: no wildcard, raw table access, service grant or bypass
-- of the endpoint's account/session/ownership/closure producer checks.
do $api_predecessor$ begin
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.rpc_closure_api_guard()'::regprocedure)
 is distinct from 'abb246e71fa5ad4ac4664db31a5cc065' then raise exception 'SUPPORT_API_GUARD_PREDECESSOR_DRIFT';end if;
end $api_predecessor$;
create or replace function public.rpc_closure_api_guard() returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();path text:=coalesce(current_setting('request.path',true),'');begin
 if auth.role()='authenticated' and private.closure_account_restricted(u) then
  if path in('/rpc/rpc_read_account_closure_execution','/rpc/rpc_start_account_closure_execution') then return;end if;
  if path in('/rpc/rpc_support_capabilities_v5','/rpc/rpc_support_inbox_v5','/rpc/rpc_support_detail_v5',
   '/rpc/rpc_support_find_context_v5','/rpc/rpc_support_mark_read_v5','/rpc/rpc_support_read_command_v5',
   '/rpc/rpc_support_cancel_command_v5','/rpc/rpc_support_submit_v5') then
   perform private.support_auth_v5(u);return;
  end if;
  raise exception 'ACCOUNT_CLOSING' using errcode='42501';
 end if;
end $f$;

-- These private cases retain their evidence pending the already-open reviewed
-- retention schedule. Closing a case never releases a139 Storage hold or erases
-- a reporter's account. This is a blocker, not a fabricated lifetime or policy.
do $closure$ declare d text;needle text:=' return codes;';begin
 d:=pg_get_functiondef('private.closure_blockers_v5(uuid)'::regprocedure);
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'SUPPORT_CLOSURE_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,E' if exists(select 1 from private.support_cases_v5 where account_id=a) then codes:=array_append(codes,''SUPPORT_RETENTION_POLICY_NOT_READY'');end if;\n return codes;');
end $closure$;
update private.closure_dataset_catalog_v5 set relations=relations||array['private.support_cases_v5','private.support_events_v5','private.support_decisions_v5','private.support_appeals_v5','private.support_evidence_v5','private.support_operator_grants_v5','private.support_operator_audit_v5'] where data_class='AUDIT_SECURITY_LOGS';
update private.closure_dataset_catalog_v5 set relations=relations||array['private.support_commands_v5','private.support_grant_commands_v5'] where data_class='COMMAND_LEDGERS';
update private.closure_dataset_catalog_v5 set relations=relations||array['private.support_read_markers_v5'] where data_class='NOTIFICATION_DELIVERY';

do $export$ declare catalog jsonb;d text;needle text;replacement text;begin
 catalog:=private.data_export_dataset_catalog();
 if jsonb_array_length(catalog)<>42 or exists(select 1 from jsonb_array_elements(catalog) x where x->>'key' like 'ownSupport%') then raise exception 'SUPPORT_EXPORT_PREDECESSOR_DRIFT';end if;
 catalog:=catalog||'[
 {"key":"ownSupportCases","dataClass":"AUDIT_SECURITY_LOGS","fields":["id","caseNumber","channel","topic","title","desiredOutcome","context","status","revision","createdAt","updatedAt"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"},
 {"key":"ownSupportEvents","dataClass":"AUDIT_SECURITY_LOGS","fields":["id","caseId","sequence","kind","authorRole","body","decisionId","appealId","createdAt"],"ownershipFilter":"c.account_id=REQUEST_ACCOUNT"},
 {"key":"ownSupportDecisions","dataClass":"AUDIT_SECURITY_LOGS","fields":["id","caseId","caseRevision","outcome","reasonCode","explanation","effect","evidenceIds","priorDecisionId","createdAt"],"ownershipFilter":"c.account_id=REQUEST_ACCOUNT"},
 {"key":"ownSupportAppeals","dataClass":"AUDIT_SECURITY_LOGS","fields":["id","caseId","decisionId","status","decisionResultId","createdAt"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT and c.account_id=REQUEST_ACCOUNT"},
 {"key":"ownSupportEvidence","dataClass":"AUDIT_SECURITY_LOGS","fields":["id","caseId","eventId","reference","createdAt","bytesIncluded"],"ownershipFilter":"t.submitted_by_account_id=REQUEST_ACCOUNT and c.account_id=REQUEST_ACCOUNT"},
 {"key":"ownSupportCommands","dataClass":"COMMAND_LEDGERS","fields":["kind","state","caseId","createdAt"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"},
 {"key":"ownSupportReadMarkers","dataClass":"NOTIFICATION_DELIVERY","fields":["caseId","sequence","updatedAt"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"}]'::jsonb;
 execute format('create or replace function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $catalog$ select %L::jsonb $catalog$',catalog::text);
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure);
 needle:='from private.agreement_media_snapshots_v5 t join public.agreements a on a.id=t.agreement_id where t.account_id=p_account_id and a.requester_account_id=p_account_id),';
 if length(d)-length(replace(d,needle,''))<>length(needle) or strpos(d,'''OWN_ACCOUNT_V5_5''')=0 then raise exception 'SUPPORT_EXPORT_PREDECESSOR_DRIFT';end if;
 replacement:=$rows$from private.agreement_media_snapshots_v5 t join public.agreements a on a.id=t.agreement_id where t.account_id=p_account_id and a.requester_account_id=p_account_id
union all
select 'ownSupportCases',jsonb_build_object('id',t.id,'caseNumber',t.case_number::text,'channel',t.channel,'topic',t.topic,'title',t.title,'desiredOutcome',t.desired_outcome,'context',t.context,'status',t.status,'revision',t.revision,'createdAt',t.created_at,'updatedAt',t.updated_at) from private.support_cases_v5 t where t.account_id=p_account_id
union all
select 'ownSupportEvents',jsonb_build_object('id',t.id,'caseId',t.case_id,'sequence',t.sequence::text,'kind',t.kind,'authorRole',t.author_role,'body',case when t.kind='SAFETY_REPORT' then (select narrative from private.safety_reports where id=c.safety_report_id) else t.body end,'decisionId',t.decision_id,'appealId',t.appeal_id,'createdAt',t.created_at) from private.support_events_v5 t join private.support_cases_v5 c on c.id=t.case_id where c.account_id=p_account_id
union all
select 'ownSupportDecisions',jsonb_build_object('id',t.id,'caseId',t.case_id,'caseRevision',t.case_revision,'outcome',t.outcome,'reasonCode',t.reason_code,'explanation',t.explanation,'effect',t.effect,'evidenceIds',to_jsonb(t.evidence_ids),'priorDecisionId',t.prior_decision_id,'createdAt',t.created_at) from private.support_decisions_v5 t join private.support_cases_v5 c on c.id=t.case_id where c.account_id=p_account_id
union all
select 'ownSupportAppeals',jsonb_build_object('id',t.id,'caseId',t.case_id,'decisionId',t.decision_id,'status',t.status,'decisionResultId',t.decision_result_id,'createdAt',t.created_at) from private.support_appeals_v5 t join private.support_cases_v5 c on c.id=t.case_id where t.account_id=p_account_id and c.account_id=p_account_id
union all
select 'ownSupportEvidence',jsonb_build_object('id',t.id,'caseId',t.case_id,'eventId',t.event_id,'reference',t.snapshot,'createdAt',t.created_at,'bytesIncluded',false) from private.support_evidence_v5 t join private.support_cases_v5 c on c.id=t.case_id where t.submitted_by_account_id=p_account_id and c.account_id=p_account_id
union all
select 'ownSupportCommands',jsonb_build_object('kind',t.kind,'state',t.state,'caseId',t.case_id,'createdAt',t.created_at) from private.support_commands_v5 t where t.account_id=p_account_id
union all
select 'ownSupportReadMarkers',jsonb_build_object('caseId',t.case_id,'sequence',t.sequence::text,'updatedAt',t.updated_at) from private.support_read_markers_v5 t where t.account_id=p_account_id),$rows$;
 execute replace(replace(d,needle,replacement),'''OWN_ACCOUNT_V5_5''','''OWN_ACCOUNT_V5_6''');
 d:=pg_get_functiondef('private.data_export_policy_binding()'::regprocedure);
 if strpos(d,'''OWN_ACCOUNT_V5_5''')=0 or strpos(d,'jsonb_array_length(m->''datasets'')<>42')=0 then raise exception 'SUPPORT_EXPORT_PREDECESSOR_DRIFT';end if;
 execute replace(replace(replace(d,'''OWN_ACCOUNT_V5_5''','''OWN_ACCOUNT_V5_6'''),'jsonb_array_length(m->''datasets'')<>42','jsonb_array_length(m->''datasets'')<>49'),'''mediaMetadata'',''ownedMediaAssets''','''mediaMetadata'',''ownedMediaAssets'',''ownSupportEvidence''');
end $export$;

do $acl$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('private','public') and (p.proname like 'support%v5' or p.proname like 'rpc_support%v5') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.nspname='public' then execute format('grant execute on function %s to %I',f.signature,case when f.proname in('rpc_support_set_operator_service_v5','rpc_support_media_service_v5') then 'service_role' else 'authenticated' end);end if;
 end loop;
end $acl$;

-- Preserve the exact140 predicate and narrow candidate scope. Only its admitted
-- topology digest changes:143 tables, safety capture, evidence CHECK and blocker.
-- Existing executable policies still contain the old SHA/projection and close.
do $support_source$ declare d text;needle text:='''private.resolve_media_snapshot_v5(uuid,jsonb)'']';begin
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='private.closure_source_digest_v5()'::regprocedure) is distinct from '5ffcf7b1aba952eb7d4c5cc7f30fda51' then raise exception 'SUPPORT_DIGEST_PREDECESSOR_DRIFT';end if;
 d:=pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure);
 if length(d)-length(replace(d,needle,''))<>length(needle) or strpos(d,'having count(*)=6')=0 then raise exception 'SUPPORT_DIGEST_PREDECESSOR_DRIFT';end if;
 -- Explicit compiled support sources, including the non-trigger helpers, are
 -- attested alongside the six unchanged139 sources. No dynamic wildcard seal.
 execute replace(replace(d,needle,$sources$'private.resolve_media_snapshot_v5(uuid,jsonb)',
 'private.support_auth_v5(uuid)','private.support_operator_key_v5()','private.support_command_key_v5(uuid,uuid)',
 'private.support_safe_exit_v5(uuid,uuid)','private.support_operator_revision_v5(uuid)','private.support_immutable_v5()',
 'private.support_case_guard_v5()','private.support_command_document_v5(uuid,uuid)',
 'public.rpc_support_read_command_v5(uuid,uuid)','public.rpc_support_cancel_command_v5(uuid,uuid)',
 'private.support_reference_v5(uuid,jsonb)','private.support_capture_media_v5(uuid,integer,jsonb)',
 'private.support_safety_case_v5(private.safety_reports,boolean)','private.support_safety_capture_v5()','private.support_safety_closure_v5()',
 'private.support_event_document_v5(private.support_events_v5)','private.support_decision_document_v5(private.support_decisions_v5)',
 'private.support_allowed_actions_v5(private.support_cases_v5,uuid,integer)',
 'public.rpc_support_set_operator_service_v5(uuid,boolean,integer,uuid)','public.rpc_support_submit_v5(uuid,uuid,text,uuid,integer,text)',
 'public.rpc_support_capabilities_v5(uuid)','public.rpc_support_inbox_v5(uuid,text,text)',
 'public.rpc_support_detail_v5(uuid,uuid,text)','public.rpc_support_mark_read_v5(uuid,uuid,text)',
 'public.rpc_support_find_context_v5(uuid,text,uuid)','public.rpc_support_media_service_v5(uuid,uuid,uuid,uuid)',
 'public.rpc_closure_api_guard()']$sources$),'having count(*)=6','having count(*)=33');
end $support_source$;
do $rebind$ declare old_sha text;new_sha text;d text;begin
 select sha,ready_definition into strict old_sha,d from support143_predecessor;
 if (select sha256 from private.closure_source_v5 where singleton) is distinct from old_sha
 or length(d)-length(replace(d,old_sha,''))<>length(old_sha) then raise exception 'SUPPORT_SOURCE_BINDING_INVALID';end if;
 new_sha:=private.closure_source_digest_v5();if new_sha is null then raise exception 'SUPPORT_SOURCE_BINDING_INVALID';end if;update private.closure_source_v5 set sha256=new_sha where singleton;
 execute replace(d,old_sha,new_sha);
 if private.retention_ai_source_ready() is distinct from true then raise exception 'SUPPORT_SOURCE_NOT_READY';end if;
end $rebind$;
notify pgrst,'reload schema';
commit;
