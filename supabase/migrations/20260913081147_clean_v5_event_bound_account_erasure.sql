--146 AF-D22. Event-bound ordinary personal-content erasure; source-only candidate.
-- Owner product provenance is not a legal retention policy/counsel certificate.
-- Reuses131 account/generation/attempt and actual Storage/Auth settlement.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';

create temporary table erasure146_predecessor(source_sha text,ready_definition text) on commit drop;
create temporary table erasure146_trigger_predecessors(signature regprocedure,body_md5 text) on commit drop;
do $pre$ declare s text;d text;begin
 select sha256 into strict s from private.closure_source_v5 where singleton;
 if s is distinct from private.closure_source_digest_v5() or private.retention_ai_source_ready() is distinct from true
 or jsonb_array_length(private.data_export_dataset_catalog())<>50
 or to_regprocedure('private.guard_unavailable_identity_requirement_v5()') is null
 then raise exception 'ERASURE_PREDECESSOR_NOT_READY';end if;
 -- Final145 normalized source pin is inserted only after its independent freeze.
 select prosrc into strict d from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if md5(replace(replace(d,E'\r\n',E'\n'),s,'__SOURCE139_SHA256__'))<>'9da5b89c314e6a04b7ec48a16778eed2'
 then raise exception 'ERASURE_PREDECESSOR_DRIFT';end if;
 insert into erasure146_predecessor values(s,pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure));
end $pre$;

-- A certificate exists only inside the single service-owned SQL transaction.
-- It contains no original plaintext, SQL statement, provider body or client flag.
-- Raw REST/GUC callers cannot create one or broaden its exact row/patch scope.
create table private.closure_redaction_certificate_v5(
 backend_pid integer not null,transaction_id bigint not null,account_id uuid not null,
 generation uuid not null,action_id uuid not null,relation_oid oid not null,
 operation text not null check(operation in('UPDATE','DELETE')),
 old_sha256 text not null check(old_sha256~'^[a-f0-9]{64}$'),
 patch jsonb not null check(jsonb_typeof(patch)='object'),
 primary key(backend_pid,transaction_id)
);
create table private.closure_redaction_steps_v5(
 action_id uuid not null references private.closure_actions_v5(id),
 account_id uuid not null references public.app_accounts(id),generation uuid not null,
 ordinal integer not null check(ordinal>0),relation_name text not null,
 state text not null default 'PENDING' check(state in('PENDING','VERIFIED')),
 affected_rows bigint not null default 0 check(affected_rows>=0),verified_at timestamptz,
 primary key(action_id,ordinal),unique(action_id,relation_name),
 check((state='VERIFIED')=(verified_at is not null))
);
create table private.closure_erasure_source_v5(
 singleton boolean primary key default true check(singleton),
 sha256 text not null check(sha256~'^[a-f0-9]{64}$')
);
create table private.closure_scope_sources_v5(
 account_id uuid not null references public.app_accounts(id),generation uuid not null references private.closure_executions_v5(generation),
 agreement_id uuid not null,source_kind text not null check(source_kind in('VERSION','PROPOSAL')),
 source_id text not null,scope_author uuid,primary key(generation,source_kind,agreement_id,source_id)
);
alter table private.closure_redaction_certificate_v5 enable row level security;
alter table private.closure_redaction_certificate_v5 force row level security;
alter table private.closure_redaction_steps_v5 enable row level security;
alter table private.closure_redaction_steps_v5 force row level security;
alter table private.closure_erasure_source_v5 enable row level security;
alter table private.closure_erasure_source_v5 force row level security;
alter table private.closure_scope_sources_v5 enable row level security;
alter table private.closure_scope_sources_v5 force row level security;
revoke all on private.closure_redaction_certificate_v5,private.closure_redaction_steps_v5,private.closure_erasure_source_v5,private.closure_scope_sources_v5
 from public,anon,authenticated,service_role;

create function private.closure_redaction_allowed_v5(rel oid,op text,before_row jsonb,after_row jsonb) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare c private.closure_redaction_certificate_v5;keys text[];
begin
 if auth.role() is distinct from 'service_role' or rel is null or op is null or op not in('UPDATE','DELETE') or before_row is null then return false;end if;
 select * into c from private.closure_redaction_certificate_v5 where backend_pid=pg_backend_pid() and transaction_id=txid_current();
 if not found or c.relation_oid<>rel or c.operation<>op
 or c.old_sha256 is distinct from encode(extensions.digest(convert_to(before_row::text,'UTF8'),'sha256'),'hex')
 or not exists(select 1 from private.closure_executions_v5 e join private.closure_actions_v5 a on a.generation=e.generation and a.account_id=e.account_id
  where e.account_id=c.account_id and e.generation=c.generation and e.state='EXECUTING'
   and e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1'
   and a.id=c.action_id and a.kind='RELATIONAL_REDACT' and a.state='DISPATCHED') then return false;end if;
 if op='DELETE' then return after_row is null and c.patch='{}'::jsonb;end if;
 select coalesce(array_agg(k),'{}') into keys from jsonb_object_keys(c.patch) k;
 -- This one generated column is derived from the two erased coordinates. Its
 -- BEFORE value is not materialized yet; executor verifies final NULL afterward.
 if rel='public.needs'::regclass and c.patch@>'{"approximate_lat":null,"approximate_lng":null}'::jsonb then keys:=keys||array['approx_geog'];end if;
 return after_row is not null and after_row@>c.patch
  and (after_row-keys-array['updated_at']) is not distinct from (before_row-keys-array['updated_at']);
end $f$;
revoke all on function private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb) from public,anon,authenticated,service_role;

-- Static account-owned relation order. No runtime SQL argument or table name is
-- accepted by an HTTP RPC. Unrelated global configuration/budget is absent.
create function private.closure_redaction_relations_v5() returns text[]
language sql immutable security definer set search_path=pg_catalog as $f$
 select array[
 'private.requester_identity_commands','private.worker_ai_saves','private.ai_task_review_commands',
 'private.ai_task_reviews','private.worker_ai_reviews','private.worker_ai_sessions',
 'public.ai_action_proposals','public.ai_structured_facts','public.ai_messages',
 'private.ai_need_turn_commands','private.worker_ai_turns','public.ai_conversations',
 'private.need_draft_save_commands','private.need_edit_commands','private.need_publish_commands',
 'private.response_submit_commands','private.response_withdraw_commands','private.response_revision_resolution_commands',
 'private.remaining_search_close_commands','private.preselection_qa_commands','private.qa_ai_commands',
 'private.need_publication_decisions','private.need_revision_events',
 'private.preselection_qa_answer_versions','private.preselection_qa_questions',
 'private.preselection_qa_policy_decisions','private.preselection_qa_materiality_decisions',
 'private.response_application_snapshots','public.marketplace_response_versions','public.marketplace_responses',
 'public.agreement_messages','private.group_messages_v5','public.agreement_versions','public.agreement_change_proposals',
 'public.agreement_execution','private.agreement_location_points','private.agreement_location_commands',
 'public.need_sensitive','public.need_geography','public.need_requirement_details','public.needs',
 'public.data_export_requests','private.data_export_artifacts',
 'public.notification_push_attempts','public.notification_deliveries','public.user_activity_events',
 'public.notification_push_devices','public.notification_preferences','public.opportunity_deliveries',
 'private.dispatch_schedule','public.dispatch_rounds','public.access_grants',
 'public.profile_availability_rules','public.profile_availability_windows','public.worker_match_preferences',
 'private.worker_calendar_events','private.worker_calendar_serialization','private.support_read_markers_v5',
 'private.owned_media_assets','private.agreement_photo_uploads_v5',
 'private.account_block_commands','private.marketplace_audit_log','private.retention_jobs',
 'private.retention_holds','private.support_commands_v5','private.support_grant_commands_v5',
 'private.group_message_visibility_v5','private.ai_test_accounts_v5','private.support_operator_grants_v5','public.app_profiles','public.app_accounts'
 ]::text[];
$f$;
revoke all on function private.closure_redaction_relations_v5() from public,anon,authenticated,service_role;

create function private.closure_erasure_media_protected_v5(a uuid,p text) returns boolean
language sql stable security definer set search_path=pg_catalog as $f$
 select exists(select 1 from private.retention_holds h where account_id=a and active and (conversation_id is null or exists(
  select 1 from private.owned_media_assets m where m.account_id=a and m.storage_path=p and m.conversation_id=h.conversation_id)))
 or exists(select 1 from private.media_evidence_gaps_v5 where account_id=a)
 or exists(select 1 from private.agreement_media_snapshots_v5 where account_id=a and state='UNRESOLVED')
 or exists(select 1 from private.media_evidence_refs_v5 r where r.account_id=a and r.asset_id in(
  select id from private.owned_media_assets where account_id=a and storage_path=p
  union all select id from private.agreement_photo_uploads_v5 where account_id=a and storage_path=p));
$f$;

-- Shared history is scoped to an actual source. A source hold/case does not
-- authorize keeping every unrelated profile, AI draft, token or export copy.
create function private.closure_erasure_agreement_protected_v5(g uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $f$
 select exists(select 1 from public.agreement_execution where agreement_id=g and problem_opened_at is not null)
 or exists(select 1 from private.safety_reports where agreement_id=g)
 or exists(select 1 from private.support_cases_v5 where context->>'kind'='AGREEMENT' and context->>'id'=g::text)
 or exists(select 1 from private.support_evidence_v5 where source_kind='AGREEMENT' and source_id=g);
$f$;

create function private.closure_erasure_scope_author_v5(g uuid,v integer) returns uuid
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare cur public.agreement_versions;prior public.agreement_versions;owner_id uuid;seen integer:=0;begin
 -- An unchanged merged scope_note inherits its field author. A price-only
 -- proposal does not transfer authorship of the other participant's scope.
 loop
  select ss.scope_author into owner_id from private.closure_scope_sources_v5 ss join private.closure_executions_v5 ce on ce.generation=ss.generation
   where ss.agreement_id=g and ss.source_kind='VERSION' and ss.source_id=v::text and ss.scope_author is not null order by ce.requested_at,ss.generation limit 1;
  if found then return owner_id;end if;
  select * into cur from public.agreement_versions where agreement_id=g and version=v;
  if not found or jsonb_typeof(cur.terms->'scope_note') is distinct from 'string' then return null;end if;
  if cur.terms->>'scope_note'='' then return null;end if;
  if v=1 then select worker_account_id into owner_id from public.agreements where id=g;return owner_id;end if;
  if cur.supersedes_version is null or cur.supersedes_version>=v then return null;end if;
  select * into prior from public.agreement_versions where agreement_id=g and version=cur.supersedes_version;
  if not found then return null;end if;
  if cur.terms->'scope_note' is distinct from prior.terms->'scope_note' then
   select case when count(*)=1 then (array_agg(p.proposed_by_account_id))[1] else null end into owner_id
   from public.agreement_change_proposals p where p.agreement_id=g and p.base_version=cur.supersedes_version and p.content_hash=cur.content_hash and p.status='ACCEPTED';
   return owner_id;
  end if;
  v:=cur.supersedes_version;seen:=seen+1;if seen>10000 then return null;end if;
 end loop;
end $f$;

-- This returns only bounded reason classes, never a private report/case ID,
-- reporter identity, narrative or an assertion that an exception lasts forever.
create function private.closure_erasure_exceptions_v5(a uuid) returns text[]
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare reasons text[]:='{}';
begin
 if exists(select 1 from private.support_cases_v5 where account_id=a)
 or exists(select 1 from private.support_events_v5 where actor_account_id=a and body is not null)
 or exists(select 1 from private.support_decisions_v5 where operator_account_id=a)
 or exists(with refs as (
  select context->>'kind' kind,(context->>'id')::uuid id from private.support_cases_v5 where context?'id'
  union all select source_kind,source_id from private.support_evidence_v5)
  select 1 from refs r where
   (r.kind='TASK' and exists(select 1 from public.needs where id=r.id and requester_account_id=a))
   or(r.kind='AGREEMENT_MESSAGE' and exists(select 1 from public.agreement_messages where id=r.id and sender_account_id=a))
   or(r.kind='GROUP_MESSAGE' and exists(select 1 from private.group_messages_v5 where id=r.id and sender_account_id=a))
   or(r.kind='TASK_REVIEW' and exists(select 1 from private.ai_task_reviews where id=r.id and account_id=a)))
 or exists(select 1 from private.retention_holds where account_id=a and active and conversation_id is not null)
 or exists(select 1 from private.safety_reports where reporter_account_id=a or target_account_id=a)
 or exists(select 1 from public.agreements g where a in(g.requester_account_id,g.worker_account_id)
  and private.closure_erasure_agreement_protected_v5(g.id))
 then reasons:=array_append(reasons,'SCOPED_EVIDENCE_REVIEW_REQUIRED');end if;
 if private.media_owner_protected_v5(a) then reasons:=array_append(reasons,'MEDIA_EVIDENCE_REVIEW_REQUIRED');end if;
 if exists(select 1 from private.closure_scope_sources_v5 ss where account_id=a and scope_author is null and
  (case when source_kind='VERSION' then (select v.terms->>'scope_note' from public.agreement_versions v where v.agreement_id=ss.agreement_id and v.version::text=ss.source_id)
   else (select p.proposed_terms->>'scope_note' from public.agreement_change_proposals p where p.id::text=ss.source_id) end) is distinct from '') then reasons:=array_append(reasons,'HISTORY_ATTRIBUTION_REVIEW_REQUIRED');end if;
 if exists(select 1 from private.qa_ai_commands own join private.qa_ai_commands peer
  on (peer.policy_decision_id=own.policy_decision_id or peer.materiality_decision_id=own.materiality_decision_id)
  where (own.account_id=a or own.need_id in(select id from public.needs where requester_account_id=a)) and peer.account_id<>a
  and not exists(select 1 from private.closure_executions_v5 e join private.closure_actions_v5 ac on ac.generation=e.generation
   where e.account_id=peer.account_id and ac.kind='RELATIONAL_REDACT' and ac.state='VERIFIED')) then reasons:=array_append(reasons,'SHARED_DECISION_REVIEW_REQUIRED');end if;
 return reasons;
end $f$;

-- Only a fixed server-owned relation enum selects a fixed WHERE fragment.
-- This private helper accepts neither a caller SQL string nor arbitrary columns.
create function private.closure_redaction_scope_v5(r text) returns text
language plpgsql immutable security definer set search_path=pg_catalog as $f$
begin
 if not(r=any(private.closure_redaction_relations_v5())) then raise exception 'ERASURE_RELATION_NOT_ADMITTED';end if;
 return case
 when r='public.app_accounts' then 't.id=$1'
 when r in('public.app_profiles','public.ai_conversations','public.ai_messages','public.ai_structured_facts','public.ai_action_proposals',
  'private.requester_identity_commands','private.worker_ai_saves','private.ai_task_review_commands','private.ai_task_reviews','private.worker_ai_reviews',
  'private.worker_ai_sessions','private.ai_need_turn_commands','private.worker_ai_turns','private.need_draft_save_commands','private.qa_ai_commands',
  'private.data_export_artifacts','public.data_export_requests','private.owned_media_assets','private.agreement_photo_uploads_v5',
  'private.retention_jobs','private.retention_holds','private.support_commands_v5','private.support_grant_commands_v5',
  'private.group_message_visibility_v5','private.ai_test_accounts_v5','private.support_operator_grants_v5','private.support_read_markers_v5') then 't.account_id=$1'
 when r in('private.need_edit_commands','private.need_publish_commands','private.remaining_search_close_commands') then 't.requester_account_id=$1'
 when r in('private.response_submit_commands','private.response_withdraw_commands','private.response_revision_resolution_commands',
  'public.marketplace_responses','public.worker_match_preferences','private.worker_calendar_events','public.opportunity_deliveries') then 't.worker_account_id=$1'
 when r in('public.profile_availability_rules','public.profile_availability_windows') then 't.profile_id in(select id from public.app_profiles where account_id=$1)'
 when r='private.worker_calendar_serialization' then 't.worker_profile_id in(select id from public.app_profiles where account_id=$1)'
 when r in('public.need_sensitive','public.need_geography','public.need_requirement_details','private.need_revision_events','private.need_publication_decisions',
  'private.dispatch_schedule','public.dispatch_rounds') then 't.need_id in(select id from public.needs where requester_account_id=$1)'
 when r='public.needs' then 't.requester_account_id=$1'
 when r in('private.response_application_snapshots','public.marketplace_response_versions') then 't.response_id in(select id from public.marketplace_responses where worker_account_id=$1)'
 when r='private.preselection_qa_questions' then 't.asker_account_id=$1'
 when r='private.preselection_qa_answer_versions' then 't.answered_by_account_id=$1'
 when r='private.preselection_qa_policy_decisions' then
  '(t.question_id in(select id from private.preselection_qa_questions where asker_account_id=$1) or t.need_id in(select id from public.needs where requester_account_id=$1) or t.id in(select policy_decision_id from private.qa_ai_commands where account_id=$1))'
 when r='private.preselection_qa_materiality_decisions' then
  '(t.question_id in(select id from private.preselection_qa_questions where asker_account_id=$1) or t.need_id in(select id from public.needs where requester_account_id=$1) or t.id in(select materiality_decision_id from private.qa_ai_commands where account_id=$1))'
 when r in('private.preselection_qa_commands','private.account_block_commands','private.agreement_location_commands','private.agreement_location_points') then 't.actor_account_id=$1'
 when r in('public.agreement_messages','private.group_messages_v5') then 't.sender_account_id=$1'
 when r='public.agreement_change_proposals' then 't.agreement_id in(select id from public.agreements where $1 in(requester_account_id,worker_account_id))'
 when r='public.agreement_versions' then 't.agreement_id in(select id from public.agreements where $1 in(requester_account_id,worker_account_id))'
 when r='public.agreement_execution' then 't.problem_opened_by=$1'
 when r='public.access_grants' then '$1 in(t.granted_by_account_id,t.granted_to_account_id)'
 when r in('public.notification_preferences','public.notification_push_devices') then 't.user_id=$1'
 when r='public.notification_push_attempts' then 't.delivery_id in(select id from public.notification_deliveries where recipient_user_id=$1) or t.device_id in(select id from public.notification_push_devices where user_id=$1)'
 when r='public.notification_deliveries' then 't.recipient_user_id=$1'
 when r='public.user_activity_events' then 't.recipient_user_id=$1 or t.entity_id in(select id from public.needs where requester_account_id=$1)'
 when r='private.marketplace_audit_log' then 't.actor_user_id=$1 or t.entity_id in(select id from public.needs where requester_account_id=$1) or t.entity_id in(select id from public.marketplace_responses where worker_account_id=$1)'
 else null end;
end $f$;

-- A NULL result means no ordinary row mutation; DELETE is a tagged internal
-- instruction. Every replacement is a fixed erased marker, not invented content.
create function private.closure_redaction_patch_v5(r text,t jsonb,a uuid,g uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare p jsonb:='{}';k text;h text;ag public.agreements;terms jsonb;
begin
 if r is null or t is null or a is null or g is null or not(r=any(private.closure_redaction_relations_v5()))
 then raise exception 'ERASURE_RELATION_NOT_ADMITTED';end if;
 h:=encode(extensions.digest(convert_to('AF-D22:ERASED:'||r||':'||coalesce(t->>'id',t->>'client_request_id',t->>'conversation_id',t->>'review_id',t->>'account_id','subject'),'UTF8'),'sha256'),'hex');
 -- Support command receipts are metadata only. A related scoped case keeps its
 -- exact recovery/hash contract until that exception is resolved; no narrative
 -- is copied into the redaction ledger. Cancelled opaque tombstones stay usable.
 if r in('private.support_commands_v5','private.support_grant_commands_v5') then return null;end if;
 if r in('public.ai_conversations','public.ai_messages','public.ai_structured_facts','public.ai_action_proposals',
  'private.ai_need_turn_commands','private.worker_ai_turns','private.worker_ai_sessions','private.ai_task_reviews','private.worker_ai_reviews','private.need_draft_save_commands')
 and exists(select 1 from private.retention_holds where account_id=a and active and conversation_id=
  case when r='public.ai_conversations' then (t->>'id')::uuid else (t->>'conversation_id')::uuid end) then return null;end if;
 if r='private.ai_task_review_commands' and exists(select 1 from private.ai_task_reviews v join private.retention_holds h on h.account_id=v.account_id and h.conversation_id=v.conversation_id and h.active
  where v.account_id=a and v.id=(t->>'review_id')::uuid) then return null;end if;
 if r='private.worker_ai_saves' and exists(select 1 from private.worker_ai_reviews v join private.retention_holds h on h.account_id=v.account_id and h.conversation_id=v.conversation_id and h.active
  where v.account_id=a and v.id=(t->>'review_id')::uuid) then return null;end if;
 if r='public.ai_structured_facts' then
  if t->'superseded_by'<>'null'::jsonb then return jsonb_build_object('operation','UPDATE','patch',jsonb_build_object('superseded_by',null));end if;
  if exists(select 1 from public.ai_structured_facts where superseded_by=(t->>'id')::uuid) then return null;end if;
 end if;
 if r in('public.ai_messages','public.ai_structured_facts','public.ai_action_proposals',
  'public.need_sensitive','public.need_geography','public.need_requirement_details',
  'private.data_export_artifacts','public.notification_push_attempts','public.notification_deliveries',
  'public.notification_push_devices','public.notification_preferences','public.opportunity_deliveries',
  'private.dispatch_schedule','public.access_grants','public.profile_availability_rules','public.profile_availability_windows',
  'public.worker_match_preferences','private.worker_calendar_events','private.worker_calendar_serialization',
  'private.support_read_markers_v5','private.group_message_visibility_v5') then
  if r='private.data_export_artifacts' and exists(select 1 from storage.objects where bucket_id='data-export-artifacts' and name=t->>'object_path')
  then raise exception 'ERASURE_STORAGE_NOT_CLEAN';end if;
  return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);
 end if;
 if r in('private.owned_media_assets','private.agreement_photo_uploads_v5') then
  if t->>'dispatch_state'='DISPATCHING' then raise exception 'ERASURE_PRODUCER_UNSETTLED';end if;
  if private.closure_erasure_media_protected_v5(a,t->>'storage_path') then return null;end if;
  if exists(select 1 from storage.objects where bucket_id='profile-media' and name=t->>'storage_path') then raise exception 'ERASURE_STORAGE_NOT_CLEAN';end if;
  return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);
 end if;
 if r='public.app_accounts' then p:=jsonb_build_object('email','','phone','','full_name','','city','');
 elsif r='public.app_profiles' then p:=jsonb_build_object('display_name','','city','','headline','','bio','','avatar_path',null,
  'portfolio','[]'::jsonb,'skills','[]'::jsonb,'tools','[]'::jsonb,'licenses','[]'::jsonb,'vehicles','[]'::jsonb,'exclusions','[]'::jsonb,
  'years_experience',0,'radius_km',1,'available_now',false,'available_now_expires_at',null,'team_capacity',1,
  'minimum_fee_rsd',0,'rating_requester',null,'rating_worker',null,'operating_country_code',null,'profile_status','CLOSED');
 elsif r='public.needs' then p:=jsonb_build_object('title','Obrisan zadatak','description','Sadržaj uklonjen pri zatvaranju naloga.','category','OBRISANO',
  'approximate_city','','approximate_area','','approximate_lat',null,'approximate_lng',null,
  'starts_at',null,'ends_at',null,'required_skills','[]'::jsonb,'required_tools','[]'::jsonb,'required_vehicles','[]'::jsonb,'required_licenses','[]'::jsonb,
  'public_photo_paths','[]'::jsonb,'requester_price_rsd',null,'response_deadline',null,'urgent',false,
  'urgent_activated_at',null,'urgent_expires_at',null,'urgent_policy_version',null,'remaining_search_close_reason',null);
 elsif r in('private.ai_task_reviews','private.worker_ai_reviews') then p:=jsonb_build_object('envelope',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.worker_ai_sessions' then p:=jsonb_build_object('candidate',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.ai_task_review_commands' then
  foreach k in array array['evaluation_binding','evaluation','published'] loop
   if t->k<>'null'::jsonb then p:=p||jsonb_build_object(k,jsonb_build_object('erasedBy','AF-D22'));end if;
  end loop;
 elsif r='private.need_revision_events' then p:=jsonb_build_object('previous_material_snapshot',jsonb_build_object('erasedBy','AF-D22'),'new_material_snapshot',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='public.data_export_requests' then p:=jsonb_build_object('active_export_attempt_id',null,
  'export_revoked_at',coalesce(nullif(t->'export_revoked_at','null'::jsonb),to_jsonb((select requested_at from private.closure_executions_v5 where generation=g and account_id=a))));
 elsif r='private.need_publication_decisions' then p:=jsonb_build_object('public_geography_snapshot',jsonb_build_object('erasedBy','AF-D22'),'public_media_refs','[]'::jsonb,'reviewer_provenance','{}'::jsonb,'service_provenance',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.preselection_qa_questions' then p:=jsonb_build_object('question_text','Sadržaj uklonjen pri zatvaranju naloga.');
 elsif r='private.preselection_qa_answer_versions' then p:=jsonb_build_object('answer_text','Sadržaj uklonjen pri zatvaranju naloga.');
 elsif r in('private.preselection_qa_policy_decisions','private.preselection_qa_materiality_decisions') then
  if exists(select 1 from private.qa_ai_commands q where q.account_id<>a and
   (case when r='private.preselection_qa_policy_decisions' then q.policy_decision_id else q.materiality_decision_id end)=(t->>'id')::uuid
   and not exists(select 1 from private.closure_executions_v5 e join private.closure_actions_v5 ac on ac.generation=e.generation
    where e.account_id=q.account_id and ac.kind='RELATIONAL_REDACT' and ac.state='VERIFIED')) then return null;end if;
  p:=jsonb_build_object('service_provenance',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.response_application_snapshots' then p:=jsonb_build_object('worker_skills','[]'::jsonb,'worker_tools','[]'::jsonb,'worker_licenses','[]'::jsonb,'worker_vehicles','[]'::jsonb);
 elsif r in('public.marketplace_responses','public.marketplace_response_versions') then
  if exists(select 1 from public.agreements x where x.selected_response_id=coalesce(t->>'response_id',t->>'id')::uuid and private.closure_erasure_agreement_protected_v5(x.id)) then return null;end if;
  p:=jsonb_build_object('scope_note','');if t?'bounded_message' then p:=p||jsonb_build_object('bounded_message','');end if;
 elsif r='public.agreement_messages' then
  -- A selected Support copy survives in its immutable scoped snapshot. The
  -- original ordinary chat row does not need the same plaintext forever.
  p:=jsonb_build_object('body','Sadržaj uklonjen pri zatvaranju naloga.','photo_asset_ids','[]'::jsonb);
 elsif r='private.group_messages_v5' then p:=jsonb_build_object('body','Sadržaj uklonjen pri zatvaranju naloga.');
 elsif r in('public.agreement_versions','public.agreement_change_proposals') then
  if private.closure_erasure_agreement_protected_v5((t->>'agreement_id')::uuid) then return null;end if;
  k:=case when r='public.agreement_versions' then 'terms' else 'proposed_terms' end;
  if exists(select 1 from private.closure_scope_sources_v5 where account_id=a and generation=g and agreement_id=(t->>'agreement_id')::uuid
   and source_kind=case when r='public.agreement_versions' then 'VERSION' else 'PROPOSAL' end
   and source_id=case when r='public.agreement_versions' then t->>'version' else t->>'id' end and scope_author=a) then
   terms:=(t->k)||jsonb_build_object('scope_note','');p:=jsonb_build_object(k,terms);
  end if;
  if r='public.agreement_change_proposals' and t->>'proposed_by_account_id'=a::text then p:=p||jsonb_build_object('reason','Sadržaj uklonjen pri zatvaranju naloga.');end if;
  if p='{}'::jsonb then return null;end if;
 elsif r='public.agreement_execution' then
  -- The source problem itself is an unresolved evidence exception.
  if t->'problem_opened_at'<>'null'::jsonb then return null;end if;
  p:=jsonb_build_object('problem_narrative',null);
 elsif r='private.agreement_location_points' then return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);
 elsif r='public.user_activity_events' then
  if t->>'recipient_user_id'=a::text then return jsonb_build_object('operation','DELETE','patch','{}'::jsonb);end if;
  p:=jsonb_build_object('payload',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.marketplace_audit_log' then p:=jsonb_build_object('detail',jsonb_build_object('erasedBy','AF-D22'));
 elsif r='private.retention_holds' then
  if t->'active'='true'::jsonb then return null;end if;
  p:=jsonb_build_object('hold_key','AF-D22:'||(t->>'id'));
 elsif r='private.ai_test_accounts_v5' then
  if t->'retired_at'='null'::jsonb then p:=jsonb_build_object('retired_at',(select requested_at from private.closure_executions_v5 where generation=g and account_id=a));end if;
 elsif r='private.support_operator_grants_v5' then
  if t->'active'='true'::jsonb then p:=jsonb_build_object('active',false,'revision',(t->>'revision')::integer+1,'updated_at',(select requested_at from private.closure_executions_v5 where generation=g and account_id=a));end if;
 end if;
 -- Content-derived request hashes are no longer original-content proofs after
 -- erasure. Policy/document/source-program digests and charged units are kept.
 foreach k in array array['request_hash','input_hash','input_sha256','text_sha256','semantic_hash','content_fingerprint',
  'question_fingerprint','answer_fingerprint','context_hash','body_hash','body_sha256','completion_hash','source_hash','base_hash',
  'canonical_fingerprint','private_materiality_marker','content_hash','evaluation_result_hash','need_edit_base_fingerprint'] loop
  if t?k and jsonb_typeof(t->k)='string' then p:=p||jsonb_build_object(k,h);end if;
 end loop;
 -- These JSON command results are private source copies, not immutable legal
 -- terms. Keep identity/state columns for anti-replay, never old narrative JSON.
 if r in('private.requester_identity_commands','private.worker_ai_saves','private.need_draft_save_commands',
  'private.ai_need_turn_commands','private.worker_ai_turns','private.qa_ai_commands',
  'private.need_edit_commands','private.need_publish_commands','private.response_submit_commands','private.response_withdraw_commands',
  'private.response_revision_resolution_commands','private.remaining_search_close_commands','private.preselection_qa_commands',
  'private.account_block_commands','private.retention_jobs','private.support_commands_v5','private.support_grant_commands_v5') then
  foreach k in array array['receipt','result'] loop
   if t?k and t->k<>'null'::jsonb then p:=p||jsonb_build_object(k,jsonb_build_object('erasedBy','AF-D22'));end if;
  end loop;
 end if;
 if p='{}'::jsonb or t@>p then return null;end if;
 return jsonb_build_object('operation','UPDATE','patch',p);
end $f$;

-- Preserve all legacy generation constraints. A missing legal policy identifier
-- is admitted only for the explicit owner event-bound technical adapter.
alter table private.closure_executions_v5 alter column policy_id drop not null;
alter table private.closure_executions_v5 add constraint closure_policy_identity146 check(
 (policy_id is not null and binding->>'adapterVersion' is distinct from 'OWNER_AF_D22_EVENT_ERASURE_V1')
 or (policy_id is null and binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1'
  and binding->>'provenance'='OWNER_AF_D22' and binding->>'trigger'='CLOSURE_REQUESTED'));
alter table private.closure_actions_v5 drop constraint closure_actions_v5_kind_check;
alter table private.closure_actions_v5 drop constraint closure_actions_v5_evidence_check;
alter table private.closure_actions_v5 add constraint closure_kind146 check(kind in('STORAGE_DELETE','RELATIONAL_REDACT','AUTH_IDENTITY_ERASE'));
alter table private.closure_actions_v5 add constraint closure_evidence146 check(evidence in('STORAGE_OBJECT_ABSENT','RELATIONAL_ORDINARY_CONTENT_ERASED','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED'));
do $shape$ declare c record;n integer:=0;begin
 for c in select conname,pg_get_constraintdef(oid) d from pg_constraint where conrelid='private.closure_actions_v5'::regclass and contype='c' loop
  if strpos(c.d,'object_path IS NOT NULL')>0 and strpos(c.d,'AUTH_IDENTITY_ERASE')>0 then
   n:=n+1;execute format('alter table private.closure_actions_v5 drop constraint %I',c.conname);
  end if;
 end loop;
 if n<>1 then raise exception 'ERASURE_ACTION_SHAPE_DRIFT';end if;
end $shape$;
alter table private.closure_actions_v5 add constraint closure_action_shape146 check(
 (kind='STORAGE_DELETE' and bucket in('profile-media','data-export-artifacts') and object_path is not null)
 or(kind in('RELATIONAL_REDACT','AUTH_IDENTITY_ERASE') and bucket is null and object_path is null));
create unique index closure_one_redaction146 on private.closure_actions_v5(generation) where kind='RELATIONAL_REDACT';

-- Wrap only trigger functions already admitted by the exact145 inventory, on
-- the finite relation list above. Normal writes take the entire original body.
-- The certificate covers exactly one locked old row and one fixed new patch.
do $guards$ declare f record;d text;needle text;prefix text;n integer;begin
 for f in select distinct p.oid,p.oid::regprocedure sig,p.prosrc,p.prolang
 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
 where not t.tgisinternal and t.tgrelid in(select unnest(private.closure_redaction_relations_v5())::regclass)
 and (t.tgtype & 1)=1 loop
  if f.prolang<>(select oid from pg_language where lanname='plpgsql') then raise exception 'ERASURE_TRIGGER_LANGUAGE_DRIFT';end if;
  select (regexp_match(f.prosrc,'\m(begin)\M','i'))[1] into needle;
  if needle is null then raise exception 'ERASURE_TRIGGER_BODY_DRIFT';end if;
  insert into erasure146_trigger_predecessors values(f.sig,md5(f.prosrc));
  prefix:=needle||E'\n if auth.role()=''service_role'' then\n  if TG_OP in (''UPDATE'',''DELETE'') and private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),case when TG_OP=''UPDATE'' then to_jsonb(NEW) else null end) then\n   if TG_OP=''DELETE'' then return OLD;end if;return NEW;\n  end if;\n end if;\n';
  d:=pg_get_functiondef(f.oid);
  -- Replace the first executable BEGIN in prosrc only, never function metadata.
  d:=replace(d,f.prosrc,regexp_replace(f.prosrc,'\mBEGIN\M',prefix,'i'));
  execute d;
 end loop;
end $guards$;

create function private.closure_erasure_lock_v5(a uuid) returns void language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if a is null then raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023';end if;
 -- Support acquires this global private-test barrier before any involved owner,
 -- quota, source row or media lock. Never invert operator and closure locks.
 perform pg_advisory_xact_lock(private.support_operator_key_v5());
 perform pg_advisory_xact_lock(private.closure_account_key(a));
 perform pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||a::text,0));
end $f$;

--144 required any account hold because its only deletion adapter retained all
-- relational history. AF22 uses the exact same object-scope protection in both
-- the action planner and Storage trigger. The legacy branch remains unchanged.
do $photo_hold$ declare d text;needle text;begin
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='private.agreement_photo_storage_guard_v5()'::regprocedure)
  is distinct from '8b182e1817cfdfdafb620fe92296bf51' then raise exception 'ERASURE_PHOTO_STORAGE_PREDECESSOR_DRIFT';end if;
 d:=pg_get_functiondef('private.agreement_photo_storage_guard_v5()'::regprocedure);
 needle:=$a$if exists(select 1 from private.media_evidence_refs_v5 where asset_id=a.id) or exists(select 1 from private.retention_holds where account_id=a.account_id and active)$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_PHOTO_STORAGE_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,$a$if case when e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1'
  then private.closure_erasure_media_protected_v5(a.account_id,old.name)
  else exists(select 1 from private.media_evidence_refs_v5 where asset_id=a.id) or exists(select 1 from private.retention_holds where account_id=a.account_id and active) end$a$);
end $photo_hold$;

create function private.closure_erasure_hard_blockers_v5(a uuid) returns text[] language sql stable security definer set search_path=pg_catalog as $f$
 select coalesce(array_agg(c order by ord),'{}') from unnest(private.closure_blockers_v5(a)) with ordinality x(c,ord)
 where c not in('MEDIA_EVIDENCE_POLICY_NOT_READY','SUPPORT_RETENTION_POLICY_NOT_READY')
 and (c<>'RETENTION_HOLD' or exists(select 1 from private.retention_holds where account_id=a and active and conversation_id is null));
$f$;

create function private.closure_erasure_binding_v5() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare s text;b jsonb;begin
 select sha256 into s from private.closure_erasure_source_v5 where singleton;
 if s is null or s is distinct from private.closure_source_digest_v5() or private.retention_ai_source_ready() is distinct from true then return null;end if;
 b:=jsonb_build_object('adapterVersion','OWNER_AF_D22_EVENT_ERASURE_V1','provenance','OWNER_AF_D22','trigger','CLOSURE_REQUESTED',
  'sourceSha256',s,'authAction','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED','mediaAction','DELETE_UNPROTECTED_OWNED_OBJECTS',
  'relationalAction','ERASE_ORDINARY_PERSONAL_CONTENT','exceptionAction','SCOPED_REVIEW_REQUIRED','legalPolicyAttested',false);
 return b||jsonb_build_object('sha256',encode(extensions.digest(convert_to(b::text,'UTF8'),'sha256'),'hex'));
end $f$;

create function private.closure_erasure_assert_current_v5(e private.closure_executions_v5) returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare b jsonb;begin
 if e.account_id is null or e.state<>'EXECUTING' or e.binding->>'adapterVersion' is distinct from 'OWNER_AF_D22_EVENT_ERASURE_V1' then raise exception 'CLOSURE_GENERATION_STALE' using errcode='40001';end if;
 b:=private.closure_erasure_binding_v5();
 if b is null or b->>'sha256' is distinct from e.policy_sha256 or b is distinct from e.binding then raise exception 'CLOSURE_POLICY_CHANGED' using errcode='55000';end if;
 if cardinality(private.closure_erasure_hard_blockers_v5(e.account_id))>0 then raise exception 'CLOSURE_BLOCKED' using errcode='55000';end if;
end $f$;

--144's exact Storage guard calls the established current-generation verifier.
-- Compose AF22 here too; otherwise real photo DELETE would still demand the
-- unrelated retained-subject legal-policy adapter. Legacy logic is unchanged.
do $current$ declare d text;needle text;begin
 if (select md5(prosrc) from pg_proc where oid='private.closure_assert_current_v5(private.closure_executions_v5)'::regprocedure)<>'022e084d818befcf390178d620b0eef6' then raise exception 'ERASURE_CURRENT_PREDECESSOR_DRIFT';end if;
 d:=pg_get_functiondef('private.closure_assert_current_v5(private.closure_executions_v5)'::regprocedure);
 needle:=E'begin\n if e.account_id is null';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_CURRENT_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,E'begin\n if e.binding->>''adapterVersion''=''OWNER_AF_D22_EVENT_ERASURE_V1'' then perform private.closure_erasure_assert_current_v5(e);return;end if;\n if e.account_id is null');
end $current$;

-- Fixed relation/patch executor. Only the generation/attempt crosses the RPC;
-- one transaction edits at most100 rows of one compiled relation. The query
-- filters already-cleared rows before LIMIT, so repeated calls make progress.
create function public.rpc_redact_account_closure_step_service(p_account_id uuid,p_generation uuid,p_action_id uuid,p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare e private.closure_executions_v5;act private.closure_actions_v5;s private.closure_redaction_steps_v5;
 r record;plan jsonb;where_sql text;rel regclass;sets text;cnt integer:=0;more boolean;finished boolean;next_row jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 perform private.closure_erasure_lock_v5(p_account_id);
 select * into e from private.closure_executions_v5 where account_id=p_account_id and generation=p_generation;
 perform private.closure_erasure_assert_current_v5(e);
 select * into act from private.closure_actions_v5 where id=p_action_id and generation=e.generation and account_id=e.account_id for update;
 if not found or act.kind<>'RELATIONAL_REDACT' or p_attempt_id is null or act.attempt_id is distinct from p_attempt_id or act.state='PENDING' then raise exception 'CLOSURE_ATTEMPT_STALE' using errcode='40001';end if;
 if exists(select 1 from private.closure_actions_v5 where generation=e.generation and kind='STORAGE_DELETE' and state<>'VERIFIED') then raise exception 'CLOSURE_STORAGE_NOT_CLEAN' using errcode='55000';end if;
 select * into s from private.closure_redaction_steps_v5 where action_id=act.id and state='PENDING' order by ordinal limit 1 for update;
 if found then
  where_sql:=private.closure_redaction_scope_v5(s.relation_name);rel:=s.relation_name::regclass;
  if where_sql is null then raise exception 'ERASURE_RELATION_NOT_ADMITTED';end if;
  for r in execute format('select t.ctid as row_ctid,to_jsonb(t) as row_json from %s t where (%s) and private.closure_redaction_patch_v5($2,to_jsonb(t),$1,$3) is not null order by t.ctid limit 100 for update of t',rel,where_sql) using e.account_id,s.relation_name,e.generation loop
   plan:=private.closure_redaction_patch_v5(s.relation_name,r.row_json,e.account_id,e.generation);
   if plan is null then continue;end if;
   insert into private.closure_redaction_certificate_v5 values(pg_backend_pid(),txid_current(),e.account_id,e.generation,act.id,rel::oid,plan->>'operation',
    encode(extensions.digest(convert_to(r.row_json::text,'UTF8'),'sha256'),'hex'),plan->'patch');
   if plan->>'operation'='DELETE' then
    execute format('delete from %s where ctid=$1',rel) using r.row_ctid;
   elsif plan->>'operation'='UPDATE' then
    select string_agg(format('%I=(jsonb_populate_record(NULL::%s,$2)).%I',k,rel,k),',' order by k) into sets from jsonb_object_keys(plan->'patch') k;
    execute format('update %s as target set %s where ctid=$1 returning to_jsonb(target)',rel,sets) into next_row using r.row_ctid,plan->'patch';
    if rel='public.needs'::regclass and plan->'patch'@>'{"approximate_lat":null,"approximate_lng":null}'::jsonb and next_row->'approx_geog' is distinct from 'null'::jsonb then raise exception 'ERASURE_GENERATED_LOCATION_NOT_CLEAN';end if;
   else raise exception 'ERASURE_PATCH_INVALID';end if;
   delete from private.closure_redaction_certificate_v5 where backend_pid=pg_backend_pid() and transaction_id=txid_current();cnt:=cnt+1;
  end loop;
  execute format('select exists(select 1 from %s t where (%s) and private.closure_redaction_patch_v5($2,to_jsonb(t),$1,$3) is not null)',rel,where_sql) into more using e.account_id,s.relation_name,e.generation;
  if not more and rel='public.ai_structured_facts'::regclass and exists(select 1 from public.ai_structured_facts f where account_id=e.account_id and not exists(select 1 from private.retention_holds h where h.account_id=e.account_id and h.active and h.conversation_id=f.conversation_id)) then raise exception 'ERASURE_FOREIGN_REFERENCE';end if;
  update private.closure_redaction_steps_v5 set affected_rows=affected_rows+cnt,state=case when more then 'PENDING' else 'VERIFIED' end,verified_at=case when more then null else clock_timestamp() end where action_id=act.id and ordinal=s.ordinal;
 end if;
 finished:=not exists(select 1 from private.closure_redaction_steps_v5 where action_id=act.id and state<>'VERIFIED');
 if finished and act.state<>'VERIFIED' then update private.closure_actions_v5 set state='VERIFIED',verified_at=clock_timestamp(),evidence='RELATIONAL_ORDINARY_CONTENT_ERASED' where id=act.id;end if;
 return jsonb_build_object('accountId',e.account_id,'generation',e.generation,'actionId',act.id,'attemptId',act.attempt_id,'kind','RELATIONAL_REDACT',
  'state',case when finished then 'VERIFIED' else 'DISPATCHED' end,'rowsChanged',cnt,'completedSteps',(select count(*) from private.closure_redaction_steps_v5 where action_id=act.id and state='VERIFIED'),
  'totalSteps',cardinality(private.closure_redaction_relations_v5()),'authoritative',true);
end $f$;

create or replace function public.rpc_review_account_closure_execution(p_expected_user_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=private.support_auth_v5(p_expected_user_id);b jsonb;r private.account_closure_requests;codes text[];begin
 perform private.closure_erasure_lock_v5(u);
 select * into r from private.account_closure_requests where account_id=u;b:=private.closure_erasure_binding_v5();codes:=private.closure_erasure_hard_blockers_v5(u);
 return jsonb_build_object('accountId',u,'requestId',r.id,'revision',coalesce(r.revision,0),
  'ready',b is not null and cardinality(codes)=0 and r.id is not null and r.revision<2147483646 and not private.closure_account_restricted(u),
  'policySha256',b->>'sha256','blockers',to_jsonb(codes),'code',case when b is null then 'CLOSURE_POLICY_NOT_READY' when r.id is null then 'CLOSURE_PREPARATION_REQUIRED' when cardinality(codes)>0 then 'CLOSURE_BLOCKED' else null end,
  'adapterVersion','OWNER_AF_D22_EVENT_ERASURE_V1','retainedDatasets',null,'exceptions',to_jsonb(private.closure_erasure_exceptions_v5(u)),
  'authAction','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED','mediaAction','DELETE_UNPROTECTED_OWNED_OBJECTS','relationalAction','ERASE_ORDINARY_PERSONAL_CONTENT','authoritative',true);
end $f$;

create or replace function public.rpc_start_account_closure_execution(p_expected_user_id uuid,p_request_id uuid,p_expected_revision integer,p_client_request_id uuid,p_policy_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();b jsonb;r private.account_closure_requests;e private.closure_executions_v5;c private.closure_start_commands_v5;h text;receipt jsonb;redaction_id uuid;begin
 if u is null or u is distinct from p_expected_user_id or auth.role() is distinct from 'authenticated' then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='42501';end if;
 if p_request_id is null or p_client_request_id is null or p_expected_revision is null or p_expected_revision<1 or p_expected_revision>=2147483646 or coalesce(p_policy_sha256,'')!~'^[a-f0-9]{64}$' then raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023';end if;
 perform private.closure_erasure_lock_v5(u);
 h:=encode(extensions.digest(jsonb_build_array(u,p_request_id,p_expected_revision,p_policy_sha256)::text,'sha256'),'hex');
 select * into c from private.closure_start_commands_v5 where account_id=u and client_request_id=p_client_request_id;
 if found then if c.input_sha256<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023';end if;return c.receipt||jsonb_build_object('idempotentReplay',true);end if;
 -- Exact existing metadata replay survives Auth erasure. Only a fresh start
 -- requires a still-live human session, as in every narrative-producing seam.
 perform private.support_auth_v5(p_expected_user_id);
 select * into r from private.account_closure_requests where account_id=u;
 if r.id is distinct from p_request_id or r.revision is distinct from p_expected_revision then raise exception 'CLOSURE_REVISION_CONFLICT' using errcode='40001';end if;
 if private.closure_account_restricted(u) then raise exception 'ACCOUNT_CLOSING' using errcode='42501';end if;
 b:=private.closure_erasure_binding_v5();
 if b is null or b->>'sha256' is distinct from p_policy_sha256 then raise exception 'CLOSURE_POLICY_NOT_READY' using errcode='55000';end if;
 if cardinality(private.closure_erasure_hard_blockers_v5(u))>0 then raise exception 'CLOSURE_BLOCKED' using errcode='55000';end if;
 insert into private.closure_executions_v5(account_id,request_id,policy_id,policy_sha256,binding) values(u,r.id,null,p_policy_sha256,b) returning * into e;
 update private.account_closure_requests set state='EXECUTING',revision=revision+1,updated_at=clock_timestamp() where account_id=u;
 -- Freeze field attribution before any hash/content is changed. Only source
 -- identities are retained here; no free text or original-content hash copy.
 insert into private.closure_scope_sources_v5(account_id,generation,agreement_id,source_kind,source_id,scope_author)
 select u,e.generation,v.agreement_id,'VERSION',v.version::text,private.closure_erasure_scope_author_v5(v.agreement_id,v.version)
 from public.agreement_versions v join public.agreements ag on ag.id=v.agreement_id where u in(ag.requester_account_id,ag.worker_account_id)
 union all
 select u,e.generation,p.agreement_id,'PROPOSAL',p.id::text,
 coalesce((select ss.scope_author from private.closure_scope_sources_v5 ss join private.closure_executions_v5 ce on ce.generation=ss.generation
  where ss.agreement_id=p.agreement_id and ss.source_kind='PROPOSAL' and ss.source_id=p.id::text and ss.scope_author is not null order by ce.requested_at,ss.generation limit 1),
 case when jsonb_typeof(p.proposed_terms->'scope_note') is distinct from 'string' or v.agreement_id is null then null
  when p.proposed_terms->'scope_note' is not distinct from v.terms->'scope_note' then private.closure_erasure_scope_author_v5(p.agreement_id,p.base_version) else p.proposed_by_account_id end
 )
 from public.agreement_change_proposals p join public.agreements ag on ag.id=p.agreement_id left join public.agreement_versions v on v.agreement_id=p.agreement_id and v.version=p.base_version where u in(ag.requester_account_id,ag.worker_account_id);
 insert into private.closure_actions_v5(generation,account_id,kind,bucket,object_path)
 select e.generation,u,'STORAGE_DELETE',x.bucket,x.path from (
  select bucket_id bucket,name path from storage.objects where split_part(name,'/',1)=u::text
  union select 'profile-media',storage_path from private.owned_media_assets where account_id=u and storage_path is not null
  union select 'profile-media',storage_path from private.agreement_photo_uploads_v5 where account_id=u and storage_path is not null
  union select 'data-export-artifacts',object_path from private.data_export_artifacts where account_id=u) x
 where x.bucket<>'profile-media' or not private.closure_erasure_media_protected_v5(u,x.path);
 insert into private.closure_actions_v5(generation,account_id,kind) values(e.generation,u,'RELATIONAL_REDACT') returning id into redaction_id;
 insert into private.closure_redaction_steps_v5(action_id,account_id,generation,ordinal,relation_name)
 select redaction_id,u,e.generation,ord,rn from unnest(private.closure_redaction_relations_v5()) with ordinality x(rn,ord);
 insert into private.closure_actions_v5(generation,account_id,kind) values(e.generation,u,'AUTH_IDENTITY_ERASE');
 receipt:=jsonb_build_object('accountId',u,'requestId',r.id,'generation',e.generation,'state','EXECUTING','clientRequestId',p_client_request_id,'policySha256',p_policy_sha256,'idempotentReplay',false,'authoritative',true);
 insert into private.closure_start_commands_v5 values(u,p_client_request_id,h,receipt);return receipt;
end $f$;

create function private.closure_erasure_progress_v5(e private.closure_executions_v5) returns jsonb language sql stable security definer set search_path=pg_catalog as $f$
 select jsonb_build_object('accountId',e.account_id,'requestId',e.request_id,'generation',e.generation,'state',e.state,'policySha256',e.policy_sha256,
 'adapterVersion','OWNER_AF_D22_EVENT_ERASURE_V1','ordinaryContentErased',exists(select 1 from private.closure_actions_v5 where generation=e.generation and kind='RELATIONAL_REDACT' and state='VERIFIED'),
 'completedSteps',(select count(*) from private.closure_redaction_steps_v5 where generation=e.generation and state='VERIFIED'),
 'totalSteps',cardinality(private.closure_redaction_relations_v5()),'exceptions',to_jsonb(private.closure_erasure_exceptions_v5(e.account_id)),'authoritative',true);
$f$;

create function private.closure_erasure_refresh_steps_v5(e private.closure_executions_v5) returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.closure_redaction_steps_v5;remaining boolean;begin
 -- A peer may finish erasing a shared decision, or an explicitly scoped hold
 -- may be resolved separately. Recheck compiled predicates before the Auth
 -- boundary; a previously deferred row never becomes silently "already done".
 for s in select * from private.closure_redaction_steps_v5 where generation=e.generation and state='VERIFIED' order by ordinal loop
  execute format('select exists(select 1 from %s t where (%s) and private.closure_redaction_patch_v5($2,to_jsonb(t),$1,$3) is not null)',s.relation_name::regclass,private.closure_redaction_scope_v5(s.relation_name)) into remaining using e.account_id,s.relation_name,e.generation;
  if remaining then
   update private.closure_redaction_steps_v5 set state='PENDING',verified_at=null where action_id=s.action_id and ordinal=s.ordinal;
   update private.closure_actions_v5 set state='DISPATCHED',verified_at=null,evidence=null where id=s.action_id and state='VERIFIED';
  end if;
 end loop;
end $f$;

create or replace function public.rpc_claim_account_closure_action_service(p_account_id uuid,p_generation uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare e private.closure_executions_v5;a private.closure_actions_v5;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if p_account_id is null or p_generation is null then raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023';end if;
 perform private.closure_erasure_lock_v5(p_account_id);
 select * into e from private.closure_executions_v5 where account_id=p_account_id and generation=p_generation;
 if not found then raise exception 'CLOSURE_GENERATION_STALE' using errcode='40001';end if;
 if e.state='CLOSED' then return jsonb_build_object('kind','CLOSED','receipt',e.receipt);end if;
 if e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' then perform private.closure_erasure_assert_current_v5(e);else perform private.closure_assert_current_v5(e);end if;
 update private.closure_executions_v5 set last_checked_at=clock_timestamp() where account_id=e.account_id;
 if e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' and not exists(select 1 from private.closure_actions_v5 where generation=e.generation and kind='STORAGE_DELETE' and state<>'VERIFIED')
 and not private.closure_auth_dispatched_v5(e.account_id) then perform private.closure_erasure_refresh_steps_v5(e);end if;
 select * into a from private.closure_actions_v5 where generation=e.generation and state<>'VERIFIED' order by case kind when 'STORAGE_DELETE' then 0 when 'RELATIONAL_REDACT' then 1 else 2 end,id limit 1;
 if not found then return jsonb_build_object('kind','FINALIZE','accountId',e.account_id,'generation',e.generation);end if;
 if a.kind='AUTH_IDENTITY_ERASE' and e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' and cardinality(private.closure_erasure_exceptions_v5(e.account_id))>0 then
  return jsonb_build_object('kind','EXCEPTIONS_PENDING','progress',private.closure_erasure_progress_v5(e));end if;
 return private.closure_action_document_v5(a,e);
end $f$;

create or replace function public.rpc_dispatch_account_closure_action_service(p_account_id uuid,p_generation uuid,p_action_id uuid,p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare e private.closure_executions_v5;a private.closure_actions_v5;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 perform private.closure_erasure_lock_v5(p_account_id);
 select * into e from private.closure_executions_v5 where account_id=p_account_id and generation=p_generation;
 if e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' then perform private.closure_erasure_assert_current_v5(e);else perform private.closure_assert_current_v5(e);end if;
 select * into a from private.closure_actions_v5 where id=p_action_id and generation=e.generation and account_id=p_account_id;
 if not found or p_attempt_id is null or a.attempt_id is distinct from p_attempt_id then raise exception 'CLOSURE_ATTEMPT_STALE' using errcode='40001';end if;
 if a.state<>'PENDING' then return jsonb_build_object('admitted',false,'action',private.closure_action_document_v5(a,e));end if;
 if a.kind='STORAGE_DELETE' and a.bucket='profile-media' and private.closure_erasure_media_protected_v5(p_account_id,a.object_path) then raise exception 'CLOSURE_SCOPED_EXCEPTION' using errcode='55000';end if;
 if a.kind in('RELATIONAL_REDACT','AUTH_IDENTITY_ERASE') and exists(select 1 from private.closure_actions_v5 where generation=e.generation and kind='STORAGE_DELETE' and state<>'VERIFIED') then raise exception 'CLOSURE_STORAGE_NOT_CLEAN' using errcode='55000';end if;
 if a.kind='AUTH_IDENTITY_ERASE' then
  if exists(select 1 from storage.objects where owner_id=p_account_id::text or split_part(name,'/',1)=p_account_id::text) then raise exception 'CLOSURE_STORAGE_NOT_CLEAN' using errcode='55000';end if;
  if e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' and (
   cardinality(private.closure_erasure_exceptions_v5(p_account_id))>0
   or not exists(select 1 from private.closure_actions_v5 where generation=e.generation and kind='RELATIONAL_REDACT' and state='VERIFIED')
   or exists(select 1 from private.closure_redaction_steps_v5 where generation=e.generation and state<>'VERIFIED')) then raise exception 'CLOSURE_RELATIONAL_NOT_CLEAN' using errcode='55000';end if;
 end if;
 update private.closure_actions_v5 set state='DISPATCHED',dispatched_at=clock_timestamp() where id=a.id returning * into a;
 return jsonb_build_object('admitted',true,'action',private.closure_action_document_v5(a,e));
end $f$;

-- External completion stays the exact131 positive Storage/Auth verifier. A
-- caller cannot manufacture relational evidence by calling that endpoint.
do $complete$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.rpc_complete_account_closure_action_service(uuid,uuid,uuid,uuid,text)'::regprocedure);
 needle:=$a$ if p_evidence is distinct from (case a.kind$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_COMPLETE_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,E' if a.kind=''RELATIONAL_REDACT'' then raise exception ''CLOSURE_EVIDENCE_INVALID'' using errcode=''22023'';end if;\n'||needle);
end $complete$;

create or replace function public.rpc_finalize_account_closure_service(p_account_id uuid,p_generation uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare e private.closure_executions_v5;v_receipt jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 perform private.closure_erasure_lock_v5(p_account_id);
 select * into e from private.closure_executions_v5 where account_id=p_account_id and generation=p_generation;
 if not found then raise exception 'CLOSURE_GENERATION_STALE' using errcode='40001';end if;
 if e.state='CLOSED' then return e.receipt;end if;
 if e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' then
  perform private.closure_erasure_assert_current_v5(e);
  if cardinality(private.closure_erasure_exceptions_v5(p_account_id))>0 or exists(select 1 from private.closure_redaction_steps_v5 where generation=e.generation and state<>'VERIFIED')
  or not exists(select 1 from private.closure_actions_v5 where generation=e.generation and kind='RELATIONAL_REDACT' and state='VERIFIED') then raise exception 'CLOSURE_RELATIONAL_NOT_CLEAN' using errcode='55000';end if;
 else perform private.closure_assert_current_v5(e);end if;
 if exists(select 1 from private.closure_actions_v5 where generation=e.generation and state<>'VERIFIED')
 or exists(select 1 from storage.objects where owner_id=p_account_id::text or split_part(name,'/',1)=p_account_id::text)
 or not exists(select 1 from auth.users where id=p_account_id and deleted_at is not null)
 or exists(select 1 from auth.sessions where user_id=p_account_id) then raise exception 'CLOSURE_EVIDENCE_INCOMPLETE' using errcode='55000';end if;
 v_receipt:=jsonb_build_object('accountId',e.account_id,'requestId',e.request_id,'generation',e.generation,'state','CLOSED','closedAt',clock_timestamp(),'policySha256',e.policy_sha256,
 'authOutcome','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED','mediaOutcome','OWNED_OBJECTS_DELETED',
 'relationalOutcome',case when e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' then 'ORDINARY_PERSONAL_CONTENT_ERASED' else 'RETAINED_RESTRICTED' end,
 'retainedDatasets',case when e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' then '[]'::jsonb else e.binding#>'{execution,datasets}' end,'authoritative',true);
 if e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' then v_receipt:=v_receipt||jsonb_build_object('adapterVersion','OWNER_AF_D22_EVENT_ERASURE_V1','pseudonymousAuditRetained',true,'exceptions','[]'::jsonb);end if;
 update private.closure_executions_v5 set state='CLOSED',closed_at=(v_receipt->>'closedAt')::timestamptz,receipt=v_receipt where account_id=p_account_id;
 update private.account_closure_requests set state='CLOSED',revision=revision+1,closed_at=(v_receipt->>'closedAt')::timestamptz,execution_receipt=v_receipt,updated_at=clock_timestamp() where account_id=p_account_id;
 return v_receipt;
end $f$;

do $read_progress$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.rpc_read_account_closure_execution(uuid,uuid)'::regprocedure);
 needle:=$a$case when e.state='CLOSED' then e.receipt else jsonb_build_object$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_READ_PREDECESSOR_DRIFT';end if;
 execute replace(d,needle,$a$case when e.state='CLOSED' then e.receipt when e.binding->>'adapterVersion'='OWNER_AF_D22_EVENT_ERASURE_V1' then private.closure_erasure_progress_v5(e) else jsonb_build_object$a$);
end $read_progress$;

create or replace function public.rpc_list_account_closure_work_service(p_limit integer) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare b jsonb;result jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if p_limit is null or p_limit<1 or p_limit>8 then raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023';end if;
 b:=private.closure_erasure_binding_v5();if b is null then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('accountId',x.account_id,'generation',x.generation)),'[]') into result from(
 select e.account_id,e.generation from private.closure_executions_v5 e where e.state='EXECUTING' and e.policy_sha256=b->>'sha256'
 and cardinality(private.closure_erasure_hard_blockers_v5(e.account_id))=0
 and (exists(select 1 from private.closure_actions_v5 where generation=e.generation and kind in('STORAGE_DELETE','RELATIONAL_REDACT') and state<>'VERIFIED') or cardinality(private.closure_erasure_exceptions_v5(e.account_id))=0)
 order by coalesce(e.last_checked_at,e.requested_at),e.account_id limit p_limit) x;return result;
end $f$;

create function private.closure_auth_dispatched_v5(a uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $f$
 select exists(select 1 from private.closure_executions_v5 e join private.closure_actions_v5 ac on ac.generation=e.generation
 where e.account_id=a and ac.account_id=a and ac.kind='AUTH_IDENTITY_ERASE' and ac.state in('DISPATCHED','VERIFIED'))
 or exists(select 1 from private.account_closure_requests where account_id=a and state='CLOSED');
$f$;
create or replace function private.support_safe_exit_v5(a uuid,b uuid default null) returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid;begin
 perform pg_advisory_xact_lock(private.support_operator_key_v5());
 for u in select distinct v from unnest(array[a,b]) v where v is not null order by v loop
  perform pg_advisory_xact_lock_shared(private.closure_account_key(u));
  -- AF22 partial erasure retains a real rights/support exit until the exact Auth
  -- producer has been dispatched. Reads and opaque cancellation remain separate.
  if private.closure_auth_dispatched_v5(u) or exists(select 1 from private.closure_executions_v5 where account_id=u and binding->>'adapterVersion' is distinct from 'OWNER_AF_D22_EVENT_ERASURE_V1') then raise exception 'ACCOUNT_CLOSING' using errcode='42501';end if;
 end loop;
end $f$;

create function private.closure_support_source_fence_v5(a uuid,k text,i uuid) returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare own uuid;peer uuid;n public.needs;m public.agreement_messages;gm private.group_messages_v5;g public.agreements;begin
 perform pg_advisory_xact_lock(private.support_operator_key_v5());
 -- Authenticate visibility before resolving another owner's barrier. The
 -- original reference routine repeats its visibility/revision checks afterward.
 if k='TASK' then
  select * into n from public.needs where id=i;
  if not found or not(n.requester_account_id=a or n.status in('PUBLISHED','SELECTION') or rls_private.need_participant_can_read(n.id)) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
  own:=n.requester_account_id;
 elsif k='AGREEMENT' then
  select * into g from public.agreements where id=i;
  if not found or a not in(g.requester_account_id,g.worker_account_id) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;
  own:=g.requester_account_id;peer:=g.worker_account_id;
 elsif k='AGREEMENT_MESSAGE' then
  select * into m from public.agreement_messages where id=i;select * into g from public.agreements where id=m.agreement_id;
  if g.id is null or a not in(g.requester_account_id,g.worker_account_id) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;own:=m.sender_account_id;
 elsif k='GROUP_MESSAGE' then
  select * into gm from private.group_messages_v5 where id=i;
  if not found or not exists(select 1 from private.group_message_visibility_v5 where message_id=i and account_id=a)
  or not exists(select 1 from private.group_conversations_v5 gr where gr.id=gm.group_id and private.group_member_v5(gr,a)) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;own:=gm.sender_account_id;
 elsif k='TASK_REVIEW' then
  if not exists(select 1 from private.ai_task_reviews where id=i and account_id=a) then raise exception 'SUPPORT_REFERENCE_NOT_AVAILABLE' using errcode='42501';end if;own:=a;
 elsif k<>'SAFETY_REPORT' then raise exception 'SUPPORT_REFERENCE_INVALID' using errcode='22023';end if;
 -- A source already closing cannot be copied anew. Existing stored snapshots,
 -- their owned reads and freeform rights submissions do not call this fence.
 if own is not null then perform private.closure_assert_open(own,peer);end if;
end $f$;

do $support$ declare d text;needle text;begin
 d:=pg_get_functiondef('private.support_reference_v5(uuid,jsonb)'::regprocedure);
 needle:=$a$ k:=v->>'kind';i:=(v->>'id')::uuid;rev:=(v->>'revision')::integer;$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_SUPPORT_REFERENCE_DRIFT';end if;
 execute replace(d,needle,needle||E'\n perform private.closure_support_source_fence_v5(a,k,i);');
 d:=pg_get_functiondef('private.support_allowed_actions_v5(private.support_cases_v5,uuid,integer)'::regprocedure);
 needle:=$a$exists(select 1 from private.closure_executions_v5 where account_id in(u,c.account_id)) or exists(select 1 from private.account_closure_requests where account_id in(u,c.account_id) and state in('EXECUTING','CLOSED'))$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_SUPPORT_CAPABILITIES_DRIFT';end if;
 execute replace(d,needle,$a$private.closure_auth_dispatched_v5(u) or private.closure_auth_dispatched_v5(c.account_id) or exists(select 1 from private.closure_executions_v5 where account_id in(u,c.account_id) and binding->>'adapterVersion' is distinct from 'OWNER_AF_D22_EVENT_ERASURE_V1')$a$);
 -- Grant revocation and read markers formerly took closure before operator.
 -- Move only their first barrier, preserving exact command/session semantics.
 d:=pg_get_functiondef('public.rpc_support_set_operator_service_v5(uuid,boolean,integer,uuid)'::regprocedure);
 needle:=' if p_active then perform private.support_safe_exit_v5(p_account_id);';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_SUPPORT_GRANT_DRIFT';end if;
 execute replace(d,needle,E' perform pg_advisory_xact_lock(private.support_operator_key_v5());\n'||needle);
 d:=pg_get_functiondef('public.rpc_support_mark_read_v5(uuid,uuid,text)'::regprocedure);
 needle:=' perform pg_advisory_xact_lock_shared(private.closure_account_key(u));g:=';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_SUPPORT_READ_MARKER_DRIFT';end if;
 execute replace(d,needle,E' perform pg_advisory_xact_lock_shared(private.support_operator_key_v5());\n if private.closure_auth_dispatched_v5(u) then raise exception ''ACCOUNT_CLOSING'' using errcode=''42501'';end if;\n'||needle);
 -- Safety writes share the same producer ordering before139 media capture.
 d:=pg_get_functiondef('private.support_safety_closure_v5()'::regprocedure);
 needle:='private.support_safe_exit_v5(new.reporter_account_id)';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_SAFETY_CAPTURE_DRIFT';end if;
 execute replace(d,needle,'private.support_safe_exit_v5(new.reporter_account_id,new.target_account_id)');
end $support$;

update private.closure_dataset_catalog_v5 set relations=relations||array['private.closure_redaction_certificate_v5','private.closure_redaction_steps_v5','private.closure_scope_sources_v5'] where data_class='COMMAND_LEDGERS';
comment on table private.closure_scope_sources_v5 is 'AF-D22 minimal per-field Agreement source attribution, captured before any erasure. No narrative/hash snapshot; not a new legal hold or retention duration.';
comment on table private.closure_erasure_source_v5 is 'Exact technical source admission for the approved AF-D22 closure event. This is not legal document activation or a retention policy review.';

do $export$ declare catalog jsonb;d text;needle text;begin
 catalog:=private.data_export_dataset_catalog();
 if jsonb_array_length(catalog)<>50 then raise exception 'ERASURE_EXPORT_PREDECESSOR_DRIFT';end if;
 catalog:=catalog||'[{"key":"ownErasureSteps","dataClass":"COMMAND_LEDGERS","fields":["generation","ordinal","state","rowsChanged","verifiedAt"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"}]'::jsonb;
 execute format('create or replace function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $catalog$ select %L::jsonb $catalog$',catalog::text);
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure);
 needle:='from private.agreement_photo_uploads_v5 t where t.account_id=p_account_id),';
 if length(d)-length(replace(d,needle,''))<>length(needle) or strpos(d,'''OWN_ACCOUNT_V5_7''')=0 then raise exception 'ERASURE_EXPORT_PREDECESSOR_DRIFT';end if;
 execute replace(replace(d,needle,$rows$from private.agreement_photo_uploads_v5 t where t.account_id=p_account_id
union all
select 'ownErasureSteps',jsonb_build_object('generation',t.generation,'ordinal',t.ordinal,'state',t.state,'rowsChanged',t.affected_rows,'verifiedAt',t.verified_at) from private.closure_redaction_steps_v5 t where t.account_id=p_account_id),$rows$),'''OWN_ACCOUNT_V5_7''','''OWN_ACCOUNT_V5_8''');
 d:=pg_get_functiondef('private.data_export_policy_binding()'::regprocedure);
 if strpos(d,'''OWN_ACCOUNT_V5_7''')=0 or strpos(d,'jsonb_array_length(m->''datasets'')<>50')=0 then raise exception 'ERASURE_EXPORT_BINDING_DRIFT';end if;
 execute replace(replace(d,'''OWN_ACCOUNT_V5_7''','''OWN_ACCOUNT_V5_8'''),'jsonb_array_length(m->''datasets'')<>50','jsonb_array_length(m->''datasets'')<>51');
end $export$;

do $acl$ declare f record;begin
 for f in select oid::regprocedure sig from pg_proc where pronamespace='private'::regnamespace and proname in(
  'closure_redaction_allowed_v5','closure_redaction_relations_v5','closure_erasure_media_protected_v5','closure_erasure_agreement_protected_v5',
  'closure_erasure_scope_author_v5','closure_erasure_exceptions_v5','closure_redaction_scope_v5','closure_redaction_patch_v5',
  'closure_erasure_lock_v5','closure_erasure_hard_blockers_v5','closure_erasure_binding_v5','closure_erasure_assert_current_v5',
  'closure_erasure_progress_v5','closure_erasure_refresh_steps_v5','closure_auth_dispatched_v5','closure_support_source_fence_v5') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $acl$;
-- Existing invoker triggers may run under service_role. This one predicate
-- reads only an unforgeable current-transaction certificate and returns false
-- without it; it exposes no case/content/table and grants no mutation itself.
grant execute on function private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb) to service_role;
revoke all on function public.rpc_redact_account_closure_step_service(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_redact_account_closure_step_service(uuid,uuid,uuid,uuid) to service_role;

-- Extend the exact145 predecessor helper list, never accept an arbitrary
-- changed source. The retained P3 trigger roster is rebound function by function
-- from captured predecessor hashes to these reviewed certificate wrappers.
do $source$ declare d text;needle text;extra text[];sig text;begin
 d:=pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure);
 needle:='''public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])'']';
 extra:=array[
 'private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb)','private.closure_redaction_relations_v5()',
 'private.closure_erasure_media_protected_v5(uuid,text)','private.closure_erasure_agreement_protected_v5(uuid)',
 'private.closure_erasure_scope_author_v5(uuid,integer)','private.closure_erasure_exceptions_v5(uuid)',
 'private.closure_redaction_scope_v5(text)','private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)',
 'private.closure_erasure_lock_v5(uuid)','private.closure_erasure_hard_blockers_v5(uuid)','private.closure_erasure_binding_v5()',
 'private.closure_erasure_assert_current_v5(private.closure_executions_v5)','private.closure_erasure_progress_v5(private.closure_executions_v5)',
 'private.closure_erasure_refresh_steps_v5(private.closure_executions_v5)','private.closure_auth_dispatched_v5(uuid)','private.closure_support_source_fence_v5(uuid,text,uuid)',
 'public.rpc_redact_account_closure_step_service(uuid,uuid,uuid,uuid)','public.rpc_review_account_closure_execution(uuid)',
 'public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)','public.rpc_claim_account_closure_action_service(uuid,uuid)',
 'public.rpc_dispatch_account_closure_action_service(uuid,uuid,uuid,uuid)','public.rpc_complete_account_closure_action_service(uuid,uuid,uuid,uuid,text)',
 'public.rpc_finalize_account_closure_service(uuid,uuid)','public.rpc_read_account_closure_execution(uuid,uuid)',
 'public.rpc_list_account_closure_work_service(integer)','public.handle_uskoci_auth_user_updated()',
 'private.closure_assert_current_v5(private.closure_executions_v5)'];
 if length(d)-length(replace(d,needle,''))<>length(needle) or strpos(d,'having count(*)=45')=0 then raise exception 'ERASURE_DIGEST_PREDECESSOR_DRIFT';end if;
 foreach sig in array extra loop if to_regprocedure(sig) is null then raise exception 'ERASURE_HELPER_MISSING';end if;end loop;
 execute replace(replace(d,needle,'''public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])'','||(select string_agg(quote_literal(x),',' order by ord) from unnest(extra) with ordinality t(x,ord))||']'),'having count(*)=45','having count(*)='||(45+cardinality(extra))::text);
end $source$;

-- Program metadata is part of source admission, not just prosrc. A changed
-- SECURITY DEFINER/search_path/ACL or table RLS setting must close erasure too.
-- The finite helper roster is captured from the exact72-entry definition above.
do $program$ declare d text;arr text;sig text[];body text;needle text;begin
 select prosrc into d from pg_proc where oid='private.closure_source_digest_v5()'::regprocedure;
 arr:=(regexp_match(d,'unnest\(array\[([\s\S]*?)\]\) signature'))[1];
 if arr is null then raise exception 'ERASURE_PROGRAM_ROSTER_DRIFT';end if;
 select array_agg(m[1] order by ord) into sig from regexp_matches(arr,'''([^'']+)''','g') with ordinality as t(m,ord);
 if cardinality(sig)<>72 or (select count(distinct x) from unnest(sig) x)<>72 then raise exception 'ERASURE_PROGRAM_ROSTER_DRIFT';end if;
 sig:=sig||array['private.closure_source_digest_v5()','private.closure_erasure_program_digest_v5()'];
 body:=format($body$
 select encode(extensions.digest(convert_to(jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'source',md5(p.prosrc),'owner',p.proowner,'acl',p.proacl::text,'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'language',p.prolang,'config',p.proconfig,'args',p.proargtypes::text,'result',p.prorettype) order by p.oid::regprocedure::text)
 from pg_proc p where p.oid in(select to_regprocedure(x) from unnest(%L::text[]) x)
 or p.oid in(select tgfoid from pg_trigger where not tgisinternal and tgrelid in(select unnest(private.closure_redaction_relations_v5())::regclass))),
 'tables',(select jsonb_agg(jsonb_build_array(c.oid::regclass::text,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) order by c.oid::regclass::text)
 from pg_class c where c.relnamespace in('private'::regnamespace,'public'::regnamespace) and c.relkind in('r','p'))
 )::text,'UTF8'),'sha256'),'hex')
 $body$,sig);
 execute format('create function private.closure_erasure_program_digest_v5() returns text language sql stable security definer set search_path=pg_catalog as %L',body);
 revoke all on function private.closure_erasure_program_digest_v5() from public,anon,authenticated,service_role;
 d:=pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure);
 needle:=$a$private.closure_schema_digest_v5_139()||':'||$a$;
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'ERASURE_PROGRAM_DIGEST_DRIFT';end if;
 execute replace(d,needle,$a$private.closure_schema_digest_v5_139()||':'||private.closure_erasure_program_digest_v5()||':'||$a$);
end $program$;

do $rebind$ declare old_sha text;new_sha text;d text;f record;new_md5 text;begin
 select source_sha,ready_definition into strict old_sha,d from erasure146_predecessor;
 if (select sha256 from private.closure_source_v5 where singleton) is distinct from old_sha or length(d)-length(replace(d,old_sha,''))<>length(old_sha) then raise exception 'ERASURE_SOURCE_BINDING_INVALID';end if;
 for f in select * from erasure146_trigger_predecessors loop
  if strpos(d,f.body_md5)>0 then
   select md5(prosrc) into strict new_md5 from pg_proc where oid=f.signature;
   d:=replace(d,f.body_md5,new_md5);
  end if;
 end loop;
 new_sha:=private.closure_source_digest_v5();if new_sha is null then raise exception 'ERASURE_SOURCE_BINDING_INVALID';end if;
 update private.closure_source_v5 set sha256=new_sha where singleton;
 insert into private.closure_erasure_source_v5 values(true,new_sha);
 execute replace(d,old_sha,new_sha);
 if private.retention_ai_source_ready() is distinct from true or private.closure_erasure_binding_v5() is null then raise exception 'ERASURE_SOURCE_NOT_READY';end if;
end $rebind$;

notify pgrst,'reload schema';
commit;
