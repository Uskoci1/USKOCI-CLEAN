-- P2 technical export delivery. No legal/retention policy, dataset admission or activation is seeded.
-- One existing request ledger; private attempt records carry immutable artifacts, not a second request model.
-- READY is a trusted worker physical-Storage attestation; SQL cannot prove external bytes.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $pre$ begin
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_get_data_export_status()')) is distinct from '2a5b380fbca98fd34a12feef91030020' then raise exception 'P2_DELIVERY_PREDECESSOR_DRIFT' using detail='public.rpc_get_data_export_status()'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_request_data_export(text)')) is distinct from '551e16c2f8a4e364ff32bc21f337ad60' then raise exception 'P2_DELIVERY_PREDECESSOR_DRIFT' using detail='public.rpc_request_data_export(text)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_cancel_data_export(uuid)')) is distinct from '553d65046fdf1d867ba9811d70b37e41' then raise exception 'P2_DELIVERY_PREDECESSOR_DRIFT' using detail='public.rpc_cancel_data_export(uuid)'; end if;
if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.marketplace_tick(integer,timestamptz)')) is distinct from '6630ca5871c01d9bc5c2673497114e01' then raise exception 'P2_DELIVERY_PREDECESSOR_DRIFT' using detail='private.marketplace_tick(integer,timestamptz)'; end if;
if to_regclass('private.retention_policy_sets') is null or to_regclass('private.legal_document_versions') is null then raise exception 'P2_DELIVERY_POLICY_OWNER_MISSING'; end if;
end $pre$;
create temporary table p2_delivery_old_acl on commit drop as select oid,proacl from pg_proc where oid in (to_regprocedure('public.rpc_get_data_export_status()'),to_regprocedure('public.rpc_request_data_export(text)'),to_regprocedure('public.rpc_cancel_data_export(uuid)'),to_regprocedure('private.marketplace_tick(integer,timestamptz)'));

alter table private.retention_policy_sets add column export_delivery jsonb null
 check(export_delivery is null or (jsonb_typeof(export_delivery)='object' and octet_length(export_delivery::text)<=65536));
comment on column private.retention_policy_sets.export_delivery is 'Optional reviewed typed P2 delivery binding; NULL is closed. Same P3 policy owner, no parallel policy registry. Content digest and active P1 Privacy provenance are required; no values are seeded.';

create table private.data_export_artifacts(
 id uuid primary key default gen_random_uuid(),
 receipt_id uuid not null references public.data_export_requests(id) on delete restrict,
 account_id uuid not null references public.app_accounts(id) on delete restrict,
 attempt_number integer not null check(attempt_number between 1 and 5),
 policy_id uuid not null references private.retention_policy_sets(id) on delete restrict,
 policy_sha256 text not null check(policy_sha256~'^[0-9a-f]{64}$'),
 policy_binding jsonb not null check(jsonb_typeof(policy_binding)='object'),
 snapshot_text text null,
 byte_length bigint not null check(byte_length between 1 and 8388608),
 sha256 text not null check(sha256~'^[0-9a-f]{64}$'),
 md5 text not null check(md5~'^[0-9a-f]{32}$'),
 object_path text not null unique,
 created_at timestamptz not null default clock_timestamp(),
 lease_until timestamptz not null,
 artifact_expires_at timestamptz not null,
 snapshot_expires_at timestamptz not null,
 verified_at timestamptz null,
 download_grant_id uuid null,
 download_grant_expires_at timestamptz null,
 cleanup_not_before timestamptz not null,
 cleanup_attempt_id uuid null,
 cleanup_lease_until timestamptz null,
 cleanup_next_at timestamptz null,
 cleanup_deleted boolean null,
 deleted_at timestamptz null,
 constraint export_artifact_path_bound check(object_path=account_id::text||'/'||receipt_id::text||'/'||id::text||'.json'),
 constraint export_artifact_snapshot_identity check(snapshot_text is null or (octet_length(snapshot_text)=byte_length and md5(snapshot_text)=md5 and encode(extensions.digest(convert_to(snapshot_text,'UTF8'),'sha256'),'hex')=sha256)),
 constraint export_artifact_grant_pair check((download_grant_id is null)=(download_grant_expires_at is null)),
 unique(receipt_id,attempt_number)
);
alter table private.data_export_artifacts enable row level security;
alter table private.data_export_artifacts force row level security;
revoke all on private.data_export_artifacts from public,anon,authenticated,service_role;
alter table public.data_export_requests
 add column active_export_attempt_id uuid null references private.data_export_artifacts(id) on delete restrict,
 add column export_attempt_count integer not null default 0 check(export_attempt_count between 0 and 5),
 add column export_next_attempt_at timestamptz null,
 add column export_revoked_at timestamptz null;
-- Exact retired-generation tombstones remain eligible for reconciliation: a timed-out
-- remote upload can commit after a prior absence observation. No wildcard deletion.
create index export_artifact_cleanup_idx on private.data_export_artifacts((coalesce(cleanup_next_at,cleanup_not_before)),id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('data-export-artifacts','data-export-artifacts',false,8388608,array['application/json']);
-- No Storage object policy is added. Existing profile-media policies remain untouched.

create function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $fn$
 select '[{"key":"account","dataClass":"ACCOUNT_IDENTITY","fields":["activeMode","city","createdAt","email","fullName","id","phone"],"ownershipFilter":"t.id=REQUEST_ACCOUNT"},{"key":"profiles","dataClass":"PROFILE_DATA","fields":["bio","city","displayName","headline","id","kind","operatingCountryCode","skills","status"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"},{"key":"availabilityWindows","dataClass":"PROFILE_DATA","fields":["endsAt","id","label","profileId","startsAt","state"],"ownershipFilter":"p.account_id=REQUEST_ACCOUNT"},{"key":"availabilityRules","dataClass":"PROFILE_DATA","fields":["active","endTime","endsOn","id","label","profileId","startTime","startsOn","weekdays"],"ownershipFilter":"p.account_id=REQUEST_ACCOUNT"},{"key":"calendar","dataClass":"PROFILE_DATA","fields":["agreementId","endsAt","startsAt","state"],"ownershipFilter":"t.worker_account_id=REQUEST_ACCOUNT"},{"key":"needs","dataClass":"NEED_PUBLIC","fields":["countryCode","description","endsAt","executionMode","id","requiredSlots","revision","startsAt","status","timezone","title"],"ownershipFilter":"t.requester_account_id=REQUEST_ACCOUNT"},{"key":"needPrivate","dataClass":"NEED_SENSITIVE","fields":["accessNotes","exactAddress","latitude","longitude","needId","resolvedPoints"],"ownershipFilter":"n.requester_account_id=REQUEST_ACCOUNT"},{"key":"responses","dataClass":"RESPONSES_SELECTION","fields":["coveredSlots","createdAt","id","kind","message","needId","needRevision","priceRsd","scopeNote","status"],"ownershipFilter":"t.worker_account_id=REQUEST_ACCOUNT"},{"key":"ownQuestions","dataClass":"PRESELECTION_QA","fields":["createdAt","id","needId","question","status"],"ownershipFilter":"t.asker_account_id=REQUEST_ACCOUNT"},{"key":"ownAnswers","dataClass":"PRESELECTION_QA","fields":["answer","createdAt","id","questionId","version"],"ownershipFilter":"t.answered_by_account_id=REQUEST_ACCOUNT"},{"key":"agreements","dataClass":"AGREEMENT_CORE","fields":["createdAt","currentVersion","id","needId","status"],"ownershipFilter":"t.requester_account_id=REQUEST_ACCOUNT or t.worker_account_id=REQUEST_ACCOUNT"},{"key":"ownAgreementMessages","dataClass":"AGREEMENT_MESSAGES","fields":["agreementId","body","createdAt","id"],"ownershipFilter":"t.sender_account_id=REQUEST_ACCOUNT and (a.requester_account_id=REQUEST_ACCOUNT or a.worker_account_id=REQUEST_ACCOUNT)"},{"key":"consent","dataClass":"LEGAL_CONSENT","fields":["acceptedAt","id","privacySha256","privacyVersion","termsSha256","termsVersion"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"},{"key":"notifications","dataClass":"NOTIFICATION_DELIVERY","fields":["body","channel","createdAt","id","readAt","role","state","title"],"ownershipFilter":"t.recipient_user_id=REQUEST_ACCOUNT"},{"key":"aiMessages","dataClass":"AI_VOLATILE","fields":["content","conversationId","createdAt","id","role"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT and c.account_id=REQUEST_ACCOUNT"},{"key":"mediaMetadata","dataClass":"MEDIA_OBJECTS","fields":["bytesIncluded","createdAt","name"],"ownershipFilter":"t.bucket_id=''profile-media'' and split_part(t.name,''/'',1)=REQUEST_ACCOUNT::text"},{"key":"exportRequests","dataClass":"COMMAND_LEDGERS","fields":["completedAt","id","kind","requestedAt","status"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"},{"key":"ownAudit","dataClass":"AUDIT_SECURITY_LOGS","fields":["createdAt","entityId","entityType","eventType","id"],"ownershipFilter":"t.actor_user_id=REQUEST_ACCOUNT"}]'::jsonb;
$fn$;
revoke all on function private.data_export_dataset_catalog() from public,anon,authenticated,service_role;

create function private.data_export_policy_binding() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare p private.retention_policy_sets; m jsonb; d jsonb; c jsonb; seen text[]:='{}'; f jsonb; fields text[]; refs jsonb; privacy private.legal_document_versions; v_now timestamptz:=clock_timestamp();
begin
 select * into p from private.retention_policy_sets where retired_at is null and effective_at<=v_now;
 if not found then return null; end if;
 m:=p.export_delivery;
 if jsonb_typeof(m) is distinct from 'object' or m-ARRAY['schemaVersion','projectionVersion','privacyDocumentId','privacyContentSha256','contentSha256','artifactLifetimeSeconds','snapshotLifetimeSeconds','downloadLifetimeSeconds','cleanupMode','snapshotCleanupMode','datasets']<>'{}'::jsonb
 or not(m ?& ARRAY['schemaVersion','projectionVersion','privacyDocumentId','privacyContentSha256','contentSha256','artifactLifetimeSeconds','snapshotLifetimeSeconds','downloadLifetimeSeconds','cleanupMode','snapshotCleanupMode','datasets'])
 or m->>'schemaVersion' is distinct from 'USKOCI_EXPORT_DELIVERY_V1' or m->>'projectionVersion' is distinct from 'OWN_ACCOUNT_V1'
 or m->>'cleanupMode' is distinct from 'DELETE_EXPORT_COPY' or m->>'snapshotCleanupMode' is distinct from 'DELETE_TEMP_SNAPSHOT'
 or coalesce(m->>'privacyDocumentId','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 or coalesce(m->>'privacyContentSha256','')!~'^[0-9a-f]{64}$' or coalesce(m->>'contentSha256','')!~'^[0-9a-f]{64}$'
 or m->>'contentSha256' is distinct from encode(extensions.digest(convert_to((m-'contentSha256')::text,'UTF8'),'sha256'),'hex') then return null; end if;
 foreach fields slice 1 in array ARRAY[ARRAY['artifactLifetimeSeconds','2592000'],ARRAY['snapshotLifetimeSeconds','2592000'],ARRAY['downloadLifetimeSeconds','900']] loop
   if jsonb_typeof(m->fields[1]) is distinct from 'number' or (m->>fields[1])!~'^[1-9][0-9]*$' or (m->>fields[1])::numeric>(fields[2])::numeric then return null; end if;
 end loop;
 if (m->>'downloadLifetimeSeconds')::integer>(m->>'artifactLifetimeSeconds')::integer then return null; end if;
 select * into privacy from private.legal_document_versions where id=(m->>'privacyDocumentId')::uuid and document_kind='PRIVACY' and is_active and retired_at is null and effective_at<=v_now and content_sha256=m->>'privacyContentSha256';
 if not found then return null; end if;
 if exists(select 1 from private.retention_data_classes dc where dc.active and dc.required and (not exists(select 1 from private.retention_policy_rules r where r.policy_id=p.id and r.data_class=dc.code) or not exists(select 1 from jsonb_array_elements(private.data_export_dataset_catalog()) v where v->>'dataClass'=dc.code))) then return null; end if;
 if jsonb_typeof(m->'datasets') is distinct from 'array' or jsonb_array_length(m->'datasets')<>18 then return null; end if;
 for d in select value from jsonb_array_elements(m->'datasets') loop
   if jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'key') is distinct from 'string' or d->>'key'=any(seen) then return null; end if;
   select value into c from jsonb_array_elements(private.data_export_dataset_catalog()) where value->>'key'=d->>'key';
   if not found then return null; end if;seen:=array_append(seen,d->>'key');
   if d->>'mode'='EXCLUDE' then
     if d-ARRAY['key','mode','reasonCode']<>'{}'::jsonb or not(d ?& ARRAY['key','mode','reasonCode']) or jsonb_typeof(d->'reasonCode') is distinct from 'string' or d->>'reasonCode'!~'^[A-Z][A-Z0-9_]{0,63}$' or d->>'key'='account' then return null; end if;
   elsif d->>'mode'='INCLUDE' then
     if d-ARRAY['key','mode','fields']<>'{}'::jsonb or not(d ?& ARRAY['key','mode','fields']) or jsonb_typeof(d->'fields') is distinct from 'array' then return null; end if;
     if jsonb_array_length(d->'fields')<1 or jsonb_array_length(d->'fields')>64 then return null; end if;fields:='{}';
     for f in select value from jsonb_array_elements(d->'fields') loop
       if jsonb_typeof(f)<>'string' or not((c->'fields') ? (f#>>'{}')) or f#>>'{}'=any(fields) then return null; end if; fields:=array_append(fields,f#>>'{}');
     end loop;
     if d->>'key'='account' and not('id'=any(fields)) then return null; end if;
     if d->>'key'='mediaMetadata' and not('bytesIncluded'=any(fields)) then return null; end if;
   else return null; end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(r) order by data_class),'[]'::jsonb) into refs from private.retention_policy_rules r where policy_id=p.id;
 return jsonb_build_object('policyId',p.id,'policyVersion',p.policy_version,'privacyDocumentId',privacy.id,'privacyContentSha256',privacy.content_sha256,'delivery',m,
 'sha256',encode(extensions.digest(convert_to(jsonb_build_object('policy',to_jsonb(p),'rules',refs,'privacy',to_jsonb(privacy),'catalog',private.data_export_dataset_catalog())::text,'UTF8'),'sha256'),'hex'));
exception when data_exception then return null;
end $fn$;
revoke all on function private.data_export_policy_binding() from public,anon,authenticated,service_role;

create function private.data_export_snapshot(p_account_id uuid,p_receipt_id uuid,p_binding jsonb,p_cutoff timestamptz) returns text language sql stable security definer set search_path=pg_catalog as $fn$
 with configured as (select value as config from jsonb_array_elements(p_binding#>'{delivery,datasets}')),
 owned_rows as (select 'account' as key,jsonb_build_object('id',t.id,'email',t.email,'fullName',t.full_name,'city',t.city,'phone',t.phone,'activeMode',t.active_mode,'createdAt',t.created_at) as value from public.app_accounts t where t.id=p_account_id
union all
select 'profiles' as key,jsonb_build_object('id',t.id,'kind',t.kind,'displayName',t.display_name,'city',t.city,'headline',t.headline,'bio',t.bio,'status',t.profile_status,'skills',t.skills,'operatingCountryCode',t.operating_country_code) as value from public.app_profiles t where t.account_id=p_account_id
union all
select 'availabilityWindows' as key,jsonb_build_object('id',t.id,'profileId',t.profile_id,'startsAt',t.starts_at,'endsAt',t.ends_at,'state',t.availability_state,'label',t.label) as value from public.profile_availability_windows t join public.app_profiles p on p.id=t.profile_id where p.account_id=p_account_id
union all
select 'availabilityRules' as key,jsonb_build_object('id',t.id,'profileId',t.profile_id,'weekdays',t.weekdays,'startTime',t.start_time,'endTime',t.end_time,'startsOn',t.starts_on,'endsOn',t.ends_on,'active',t.active,'label',t.label) as value from public.profile_availability_rules t join public.app_profiles p on p.id=t.profile_id where p.account_id=p_account_id
union all
select 'calendar' as key,jsonb_build_object('agreementId',t.agreement_id,'startsAt',t.starts_at,'endsAt',t.ends_at,'state',t.state) as value from private.worker_calendar_events t where t.worker_account_id=p_account_id
union all
select 'needs' as key,jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'status',t.status,'revision',t.revision,'countryCode',t.task_country_code,'timezone',t.task_timezone,'executionMode',t.execution_location_mode,'startsAt',t.starts_at,'endsAt',t.ends_at,'requiredSlots',t.required_slots) as value from public.needs t where t.requester_account_id=p_account_id
union all
select 'needPrivate' as key,jsonb_build_object('needId',t.need_id,'exactAddress',t.exact_address,'accessNotes',t.access_notes,'latitude',t.exact_lat,'longitude',t.exact_lng,'resolvedPoints',coalesce((select jsonb_agg(jsonb_build_object('slot',v->'slot','latitudeE6',v->'latitudeE6','longitudeE6',v->'longitudeE6','address',v->'address','accessNotes',v->'accessNotes') order by v->>'slot') from jsonb_array_elements(t.resolved_location#>'{value,points}') v),'[]'::jsonb)) as value from public.need_sensitive t join public.needs n on n.id=t.need_id where n.requester_account_id=p_account_id
union all
select 'responses' as key,jsonb_build_object('id',t.id,'needId',t.need_id,'kind',t.response_kind,'status',t.status,'needRevision',t.submitted_against_need_revision,'priceRsd',t.price_rsd,'coveredSlots',t.covered_slots,'scopeNote',t.scope_note,'message',t.bounded_message,'createdAt',t.created_at) as value from public.marketplace_responses t where t.worker_account_id=p_account_id
union all
select 'ownQuestions' as key,jsonb_build_object('id',t.id,'needId',t.need_id,'question',t.question_text,'status',t.status,'createdAt',t.created_at) as value from private.preselection_qa_questions t where t.asker_account_id=p_account_id
union all
select 'ownAnswers' as key,jsonb_build_object('id',t.id,'questionId',t.question_id,'version',t.answer_version,'answer',t.answer_text,'createdAt',t.created_at) as value from private.preselection_qa_answer_versions t where t.answered_by_account_id=p_account_id
union all
select 'agreements' as key,jsonb_build_object('id',t.id,'needId',t.need_id,'status',t.status,'currentVersion',t.current_version,'createdAt',t.created_at) as value from public.agreements t where t.requester_account_id=p_account_id or t.worker_account_id=p_account_id
union all
select 'ownAgreementMessages' as key,jsonb_build_object('id',t.id,'agreementId',t.agreement_id,'body',t.body,'createdAt',t.created_at) as value from public.agreement_messages t join public.agreements a on a.id=t.agreement_id where t.sender_account_id=p_account_id and (a.requester_account_id=p_account_id or a.worker_account_id=p_account_id)
union all
select 'consent' as key,jsonb_build_object('id',t.id,'termsVersion',t.terms_version_label,'termsSha256',t.terms_content_sha256,'privacyVersion',t.privacy_version_label,'privacySha256',t.privacy_content_sha256,'acceptedAt',t.accepted_at) as value from public.account_legal_acceptance_events t where t.account_id=p_account_id
union all
select 'notifications' as key,jsonb_build_object('id',t.id,'role',t.recipient_role,'channel',t.channel,'state',t.state,'title',t.title,'body',t.body,'createdAt',t.created_at,'readAt',t.read_at) as value from public.notification_deliveries t where t.recipient_user_id=p_account_id
union all
select 'aiMessages' as key,jsonb_build_object('id',t.id,'conversationId',t.conversation_id,'role',t.role,'content',t.body,'createdAt',t.created_at) as value from public.ai_messages t join public.ai_conversations c on c.id=t.conversation_id where t.account_id=p_account_id and c.account_id=p_account_id
union all
select 'mediaMetadata' as key,jsonb_build_object('name',t.name,'createdAt',t.created_at,'bytesIncluded',false) as value from storage.objects t where t.bucket_id='profile-media' and split_part(t.name,'/',1)=p_account_id::text
union all
select 'exportRequests' as key,jsonb_build_object('id',t.id,'kind',t.request_kind,'status',t.status,'requestedAt',t.requested_at,'completedAt',t.completed_at) as value from public.data_export_requests t where t.account_id=p_account_id
union all
select 'ownAudit' as key,jsonb_build_object('id',t.id,'eventType',t.event_type,'entityType',t.entity_type,'entityId',t.entity_id,'createdAt',t.created_at) as value from private.marketplace_audit_log t where t.actor_user_id=p_account_id),
 projected as (select r.key,(select jsonb_object_agg(field,r.value->field order by field) from jsonb_array_elements_text(c.config->'fields') field) as value
 from owned_rows r join configured c on c.config->>'key'=r.key and c.config->>'mode'='INCLUDE'),
 grouped as (select c.config->>'key' as key,coalesce(jsonb_agg(p.value order by p.value::text) filter(where p.key is not null),'[]'::jsonb) as rows
 from configured c left join projected p on p.key=c.config->>'key' where c.config->>'mode'='INCLUDE' group by c.config->>'key')
 select jsonb_build_object('schemaVersion','USKOCI_DATA_EXPORT_V1','receiptId',p_receipt_id,'accountId',p_account_id,'snapshotAt',p_cutoff,
 'projectionVersion','OWN_ACCOUNT_V1','policy',jsonb_build_object('policyId',p_binding->'policyId','policyVersion',p_binding->'policyVersion','privacyDocumentId',p_binding->'privacyDocumentId','privacyContentSha256',p_binding->'privacyContentSha256','sha256',p_binding->'sha256'),
 'datasets',(select jsonb_object_agg(key,rows order by key) from grouped),
 'datasetCounts',(select jsonb_object_agg(key,jsonb_array_length(rows) order by key) from grouped),
 'reviewedOmissions',(select coalesce(jsonb_agg(config order by config->>'key'),'[]'::jsonb) from configured where config->>'mode'='EXCLUDE'))::text
 where exists(select 1 from public.app_accounts where id=p_account_id);
$fn$;
revoke all on function private.data_export_snapshot(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated,service_role;

create function private.data_export_descriptor(p_receipt_id uuid,p_account_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; a private.data_export_artifacts; b jsonb;
begin
 select * into r from public.data_export_requests where id=p_receipt_id and account_id=p_account_id;
 if not found or r.status<>'READY' or r.export_revoked_at is not null then return null; end if;
 select * into a from private.data_export_artifacts where id=r.active_export_attempt_id and receipt_id=r.id and account_id=r.account_id;
 if not found or a.verified_at is null or a.deleted_at is not null or a.artifact_expires_at<=clock_timestamp() then return null; end if;
 b:=private.data_export_policy_binding();if b is null or b->>'sha256'<>a.policy_sha256 then return null; end if;
 return jsonb_build_object('artifactAvailable',true,'artifactExpiresAt',a.artifact_expires_at,'byteLength',a.byte_length,'sha256',a.sha256,'md5',a.md5,'artifactGeneration',a.id);
end $fn$;
revoke all on function private.data_export_descriptor(uuid,uuid) from public,anon,authenticated,service_role;
create or replace function public.rpc_get_data_export_status()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  u uuid:=auth.uid();
  r public.data_export_requests%rowtype;
  descriptor jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into r
  from public.data_export_requests d
  where d.account_id=u
  order by d.requested_at desc, d.id desc
  limit 1;

  if r.id is null then
    return jsonb_build_object(
      'hasRequest',false,'request',null,'fulfillment',null,
      'downloadAvailable',false,'serverFulfillmentRequired',true,'externalDsrChannelReady',false
    );
  end if;

  descriptor:=private.data_export_descriptor(r.id,u);
  return jsonb_build_object(
    'hasRequest',true,
    'request',jsonb_build_object(
      'receiptId',r.id,'clientRequestId',r.client_request_id,
      'kind',r.request_kind,'source',r.request_source,'status',r.status,
      'requestedAt',r.requested_at,'updatedAt',r.updated_at,
      'cancelledAt',r.cancelled_at,'completedAt',r.completed_at,
      'failureCode',r.failure_code
    ),
    'fulfillment',descriptor,'downloadAvailable',descriptor is not null,'serverFulfillmentRequired',true,'externalDsrChannelReady',false
  );
end;
$function$;

create function private.data_export_lock(p_receipt_id uuid,p_account_id uuid default null,p_skip_locked boolean default false) returns public.data_export_requests language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; u uuid;
begin
 if p_receipt_id is null then raise exception 'INVALID_RECEIPT_ID' using errcode='22023'; end if;
 lock table private.retention_policy_sets,private.retention_policy_rules,private.retention_data_classes,private.legal_document_versions in share mode;
 select account_id into u from public.data_export_requests where id=p_receipt_id and (p_account_id is null or account_id=p_account_id);
 if not found then
   if p_skip_locked then return null; end if;
   raise exception 'DATA_EXPORT_REQUEST_NOT_FOUND' using errcode='P0002';
 end if;
 if p_skip_locked then
   if not pg_try_advisory_xact_lock(hashtextextended('uskoci:data-export:'||u::text,0)) then return null; end if;
   select * into r from public.data_export_requests where id=p_receipt_id and account_id=u for update skip locked;
   if not found then return null; end if;
 else
   perform pg_advisory_xact_lock(hashtextextended('uskoci:data-export:'||u::text,0));
   select * into r from public.data_export_requests where id=p_receipt_id and account_id=u for update;
 end if;
 if not found or not exists(select 1 from public.app_accounts where id=u) then raise exception 'DATA_EXPORT_REQUEST_NOT_FOUND' using errcode='P0002'; end if;
 return r;
end $fn$;
revoke all on function private.data_export_lock(uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function public.rpc_claim_data_export(p_receipt_id uuid default null,p_account_id uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; a private.data_export_artifacts; b jsonb; target uuid; snap text; v_now timestamptz; aid uuid:=gen_random_uuid(); global_claim boolean:=p_receipt_id is null and p_account_id is null;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 for target in select d.id from public.data_export_requests d left join private.data_export_artifacts x on x.id=d.active_export_attempt_id
 where (p_receipt_id is null or d.id=p_receipt_id) and (p_account_id is null or d.account_id=p_account_id) and d.export_revoked_at is null
 and (d.status='REQUESTED' or (d.status='PROCESSING' and x.lease_until<=clock_timestamp())) and (d.export_next_attempt_at is null or d.export_next_attempt_at<=clock_timestamp())
 order by d.requested_at,d.id limit 32 loop
 r:=private.data_export_lock(target,p_account_id,global_claim);v_now:=clock_timestamp();
 if r.id is null then continue; end if;
 if global_claim then
   select * into a from private.data_export_artifacts where id=r.active_export_attempt_id for update skip locked;
   if r.active_export_attempt_id is not null and not found then continue; end if;
 else select * into a from private.data_export_artifacts where id=r.active_export_attempt_id for update; end if;
 if r.export_revoked_at is not null or r.status not in ('REQUESTED','PROCESSING') or (r.status='PROCESSING' and (a.id is null or a.lease_until>v_now)) or r.export_next_attempt_at>v_now then continue; end if;
 if r.export_attempt_count>=5 then
   update public.data_export_requests set status='FAILED',completed_at=v_now,failure_code='EXPORT_WORKER_FAILED',updated_at=v_now,export_next_attempt_at=null where id=r.id;
   continue;
 end if;
 b:=private.data_export_policy_binding();if b is null then return jsonb_build_object('kind','NOT_READY','code','EXPORT_POLICY_NOT_READY'); end if;
 snap:=private.data_export_snapshot(r.account_id,r.id,b,v_now);
 if snap is null then
   if global_claim then continue; end if;
   return jsonb_build_object('kind','NOT_READY','code','EXPORT_ACCOUNT_UNAVAILABLE');
 end if;
 if octet_length(snap)>8388608 then
   if global_claim then continue; end if;
   return jsonb_build_object('kind','NOT_READY','code','EXPORT_SNAPSHOT_TOO_LARGE');
 end if;
 v_now:=clock_timestamp();
 if a.id is not null then update private.data_export_artifacts set cleanup_not_before=greatest(lease_until,v_now),download_grant_id=null,download_grant_expires_at=null where id=a.id; end if;
 insert into private.data_export_artifacts(id,receipt_id,account_id,attempt_number,policy_id,policy_sha256,policy_binding,snapshot_text,byte_length,sha256,md5,object_path,created_at,lease_until,artifact_expires_at,snapshot_expires_at,cleanup_not_before)
 values(aid,r.id,r.account_id,r.export_attempt_count+1,(b->>'policyId')::uuid,b->>'sha256',b,snap,octet_length(snap),encode(extensions.digest(convert_to(snap,'UTF8'),'sha256'),'hex'),md5(snap),r.account_id::text||'/'||r.id::text||'/'||aid::text||'.json',v_now,
 least(v_now+interval '120 seconds',v_now+make_interval(secs=>(b#>>'{delivery,artifactLifetimeSeconds}')::integer)),v_now+make_interval(secs=>(b#>>'{delivery,artifactLifetimeSeconds}')::integer),v_now+make_interval(secs=>(b#>>'{delivery,snapshotLifetimeSeconds}')::integer),v_now+make_interval(secs=>(b#>>'{delivery,artifactLifetimeSeconds}')::integer)) returning * into a;
 update public.data_export_requests set status='PROCESSING',completed_at=null,cancelled_at=null,failure_code=null,updated_at=v_now,active_export_attempt_id=a.id,export_attempt_count=a.attempt_number,export_next_attempt_at=null where id=r.id;
 perform private.audit_marketplace(r.account_id,'DATA_EXPORT_PROCESSING','SYSTEM',r.id,null,jsonb_build_object('attempt',a.attempt_number));
 return jsonb_build_object('kind','CLAIMED','receiptId',r.id,'accountId',r.account_id,'attemptId',a.id,'leaseExpiresAt',a.lease_until,'snapshotText',a.snapshot_text,'byteLength',a.byte_length,'sha256',a.sha256,'md5',a.md5,'bucket','data-export-artifacts','objectPath',a.object_path,'artifactExpiresAt',a.artifact_expires_at);
 end loop;
 return jsonb_build_object('kind','NONE');
end $fn$;
revoke all on function public.rpc_claim_data_export(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_claim_data_export(uuid,uuid) to service_role;

create function public.rpc_renew_data_export_lease(p_receipt_id uuid,p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; a private.data_export_artifacts; b jsonb; v_now timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 r:=private.data_export_lock(p_receipt_id,null);v_now:=clock_timestamp();
 select * into a from private.data_export_artifacts where id=p_attempt_id and receipt_id=r.id for update;
 if not found or r.active_export_attempt_id is distinct from a.id or r.status<>'PROCESSING' or r.export_revoked_at is not null or a.lease_until<=v_now or a.artifact_expires_at<=v_now then raise exception 'EXPORT_ATTEMPT_STALE' using errcode='40001'; end if;
 b:=private.data_export_policy_binding();if b is null or b->>'sha256'<>a.policy_sha256 then raise exception 'EXPORT_POLICY_CHANGED' using errcode='40001'; end if;
 update private.data_export_artifacts set lease_until=least(v_now+interval '120 seconds',artifact_expires_at) where id=a.id returning * into a;
 return jsonb_build_object('receiptId',r.id,'attemptId',a.id,'leaseExpiresAt',a.lease_until);
end $fn$;
revoke all on function public.rpc_renew_data_export_lease(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_renew_data_export_lease(uuid,uuid) to service_role;

create function public.rpc_complete_data_export(p_receipt_id uuid,p_attempt_id uuid,p_byte_length bigint,p_sha256 text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; a private.data_export_artifacts; b jsonb; v_now timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 r:=private.data_export_lock(p_receipt_id,null);v_now:=clock_timestamp();
 select * into a from private.data_export_artifacts where id=p_attempt_id and receipt_id=r.id for update;
 if not found or r.active_export_attempt_id is distinct from a.id or r.export_revoked_at is not null or a.deleted_at is not null or a.artifact_expires_at<=v_now then raise exception 'EXPORT_ATTEMPT_STALE' using errcode='40001'; end if;
 if p_byte_length is distinct from a.byte_length or p_sha256 is distinct from a.sha256 then raise exception 'EXPORT_ARTIFACT_MISMATCH' using errcode='22023'; end if;
 b:=private.data_export_policy_binding();if b is null or b->>'sha256'<>a.policy_sha256 then raise exception 'EXPORT_POLICY_CHANGED' using errcode='40001'; end if;
 if r.status='READY' and a.verified_at is not null then return jsonb_build_object('receiptId',r.id,'status','READY','artifactGeneration',a.id,'idempotentReplay',true); end if;
 if r.status<>'PROCESSING' or a.lease_until<=v_now then raise exception 'EXPORT_ATTEMPT_STALE' using errcode='40001'; end if;
 update private.data_export_artifacts set verified_at=v_now where id=a.id;
 update public.data_export_requests set status='READY',completed_at=v_now,failure_code=null,updated_at=v_now where id=r.id;
 perform private.audit_marketplace(r.account_id,'DATA_EXPORT_READY','SYSTEM',r.id,null,jsonb_build_object('attempt',a.attempt_number,'byteLength',a.byte_length));
 return jsonb_build_object('receiptId',r.id,'status','READY','artifactGeneration',a.id,'idempotentReplay',false);
end $fn$;
revoke all on function public.rpc_complete_data_export(uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.rpc_complete_data_export(uuid,uuid,bigint,text) to service_role;

create function public.rpc_fail_data_export(p_receipt_id uuid,p_attempt_id uuid,p_failure_code text,p_retryable boolean) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; a private.data_export_artifacts; retry boolean; v_now timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_failure_code is null or p_failure_code not in ('EXPORT_STORAGE_UNAVAILABLE','EXPORT_UPLOAD_FAILED','EXPORT_VERIFY_FAILED','EXPORT_WORKER_FAILED') or p_retryable is null then raise exception 'EXPORT_FAILURE_CODE_INVALID' using errcode='22023'; end if;
 r:=private.data_export_lock(p_receipt_id,null);v_now:=clock_timestamp();
 select * into a from private.data_export_artifacts where id=p_attempt_id and receipt_id=r.id for update;
 if not found or r.active_export_attempt_id is distinct from a.id or r.export_revoked_at is not null or r.status<>'PROCESSING' or a.lease_until<=v_now then raise exception 'EXPORT_ATTEMPT_STALE' using errcode='40001'; end if;
 retry:=p_retryable and r.export_attempt_count<5;
 update private.data_export_artifacts set cleanup_not_before=greatest(lease_until,v_now),download_grant_id=null,download_grant_expires_at=null where id=a.id;
 update public.data_export_requests set status=case when retry then 'REQUESTED' else 'FAILED' end,completed_at=case when retry then null else v_now end,
 failure_code=case when retry then null else p_failure_code end,export_next_attempt_at=case when retry then v_now+make_interval(secs=>30*r.export_attempt_count) else null end,updated_at=v_now where id=r.id;
 perform private.audit_marketplace(r.account_id,'DATA_EXPORT_ATTEMPT_FAILED','SYSTEM',r.id,null,jsonb_build_object('attempt',a.attempt_number,'code',p_failure_code,'retryScheduled',retry));
 return jsonb_build_object('receiptId',r.id,'status',case when retry then 'REQUESTED' else 'FAILED' end,'retryScheduled',retry);
end $fn$;
revoke all on function public.rpc_fail_data_export(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.rpc_fail_data_export(uuid,uuid,text,boolean) to service_role;

create function public.rpc_authorize_data_export_download(p_receipt_id uuid,p_artifact_generation uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; a private.data_export_artifacts; expires timestamptz; grant_id uuid:=gen_random_uuid();
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 r:=private.data_export_lock(p_receipt_id,auth.uid());
 if p_artifact_generation is null or r.active_export_attempt_id is distinct from p_artifact_generation then raise exception 'EXPORT_GENERATION_STALE' using errcode='40001'; end if;
 if private.data_export_descriptor(r.id,r.account_id) is null then raise exception 'EXPORT_NOT_READY' using errcode='55000'; end if;
 select * into a from private.data_export_artifacts where id=r.active_export_attempt_id for update;
 expires:=least(clock_timestamp()+make_interval(secs=>(a.policy_binding#>>'{delivery,downloadLifetimeSeconds}')::integer),a.artifact_expires_at);
 if expires<=clock_timestamp() then raise exception 'EXPORT_GRANT_EXPIRED' using errcode='55000'; end if;
 update private.data_export_artifacts set download_grant_id=grant_id,download_grant_expires_at=expires where id=a.id;
 perform private.audit_marketplace(r.account_id,'DATA_EXPORT_DOWNLOAD_AUTHORIZED','SYSTEM',r.id,null,'{}'::jsonb);
 return jsonb_build_object('receiptId',r.id,'downloadGrantId',grant_id,'artifactGeneration',a.id,'expiresAt',expires);
end $fn$;
revoke all on function public.rpc_authorize_data_export_download(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_authorize_data_export_download(uuid,uuid) to authenticated;

create function public.rpc_resolve_data_export_download(p_receipt_id uuid,p_download_grant_id uuid,p_account_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; a private.data_export_artifacts;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_account_id is null or p_download_grant_id is null then raise exception 'EXPORT_GRANT_EXPIRED' using errcode='55000'; end if;
 r:=private.data_export_lock(p_receipt_id,p_account_id);
 if private.data_export_descriptor(r.id,r.account_id) is null then raise exception 'EXPORT_NOT_READY' using errcode='55000'; end if;
 select * into a from private.data_export_artifacts where id=r.active_export_attempt_id for update;
 if a.download_grant_id is distinct from p_download_grant_id or a.download_grant_expires_at<=clock_timestamp() then raise exception 'EXPORT_GRANT_EXPIRED' using errcode='55000'; end if;
 return jsonb_build_object('receiptId',r.id,'accountId',r.account_id,'downloadGrantId',a.download_grant_id,'artifactGeneration',a.id,'expiresAt',least(a.download_grant_expires_at,a.artifact_expires_at),'artifactExpiresAt',a.artifact_expires_at,'bucket','data-export-artifacts','objectPath',a.object_path,'byteLength',a.byte_length,'sha256',a.sha256,'md5',a.md5);
end $fn$;
revoke all on function public.rpc_resolve_data_export_download(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_resolve_data_export_download(uuid,uuid,uuid) to service_role;

-- Receipt-scoped invalidation seam; future account closure must call it for the account.
-- It does not pretend that the currently absent account-closure authority exists.
create function private.revoke_data_export_receipt(p_receipt_id uuid,p_account_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; v_now timestamptz; next_status text;
begin
 if p_account_id is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 r:=private.data_export_lock(p_receipt_id,p_account_id);v_now:=clock_timestamp();
 if r.export_revoked_at is not null then return jsonb_build_object('receiptId',r.id,'status',r.status,'revoked',true,'idempotentReplay',true); end if;
 next_status:=case when r.status in ('REQUESTED','CANCELLED') then 'CANCELLED' else 'EXPIRED' end;
 update public.data_export_requests set export_revoked_at=v_now,status=next_status,cancelled_at=case when next_status='CANCELLED' then coalesce(cancelled_at,v_now) else null end,
 completed_at=case when next_status='EXPIRED' then coalesce(completed_at,v_now) else null end,failure_code=null,export_next_attempt_at=null,updated_at=v_now where id=r.id;
 update private.data_export_artifacts set download_grant_id=null,download_grant_expires_at=null,cleanup_not_before=greatest(lease_until,v_now) where receipt_id=r.id and deleted_at is null;
 perform private.audit_marketplace(r.account_id,'DATA_EXPORT_REVOKED','SYSTEM',r.id,null,'{}'::jsonb);
 return jsonb_build_object('receiptId',r.id,'status',next_status,'revoked',true,'idempotentReplay',false);
end $fn$;
revoke all on function private.revoke_data_export_receipt(uuid,uuid) from public,anon,authenticated,service_role;
create function public.rpc_revoke_data_export_download(p_receipt_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 return private.revoke_data_export_receipt(p_receipt_id,auth.uid());
end $fn$;
revoke all on function public.rpc_revoke_data_export_download(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_revoke_data_export_download(uuid) to authenticated;

create function public.rpc_claim_data_export_cleanup(p_receipt_id uuid default null,p_account_id uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; a private.data_export_artifacts; candidate record; token uuid:=gen_random_uuid(); v_now timestamptz; global_claim boolean:=p_receipt_id is null and p_account_id is null;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 for candidate in select x.id,x.receipt_id from private.data_export_artifacts x where (p_receipt_id is null or x.receipt_id=p_receipt_id) and (p_account_id is null or x.account_id=p_account_id)
 and x.cleanup_not_before<=clock_timestamp() and x.lease_until<=clock_timestamp()
 and (x.cleanup_lease_until is null or x.cleanup_lease_until<=clock_timestamp()) and (x.cleanup_next_at is null or x.cleanup_next_at<=clock_timestamp())
 order by coalesce(x.cleanup_next_at,x.cleanup_not_before),x.id limit 32 loop
 r:=private.data_export_lock(candidate.receipt_id,p_account_id,global_claim);v_now:=clock_timestamp();
 if r.id is null then continue; end if;
 if global_claim then select * into a from private.data_export_artifacts where id=candidate.id for update skip locked;
 else select * into a from private.data_export_artifacts where id=candidate.id for update; end if;
 if not found then continue; end if;
 if a.cleanup_not_before>v_now or a.lease_until>v_now or a.cleanup_lease_until>v_now or a.cleanup_next_at>v_now then continue; end if;
 if r.active_export_attempt_id=a.id and r.status='READY' and r.export_revoked_at is null and a.artifact_expires_at>v_now then continue; end if;
 update private.data_export_artifacts set cleanup_attempt_id=token,cleanup_deleted=null,cleanup_lease_until=v_now+interval '120 seconds',download_grant_id=null,download_grant_expires_at=null where id=a.id;
 if r.active_export_attempt_id=a.id and r.status='READY' then update public.data_export_requests set status='EXPIRED',updated_at=v_now where id=r.id; end if;
 return jsonb_build_object('kind','CLAIMED','receiptId',r.id,'accountId',r.account_id,'artifactGeneration',a.id,'cleanupAttemptId',token,'leaseExpiresAt',v_now+interval '120 seconds','bucket','data-export-artifacts','objectPath',a.object_path);
 end loop;
 return jsonb_build_object('kind','NONE');
end $fn$;
revoke all on function public.rpc_claim_data_export_cleanup(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_claim_data_export_cleanup(uuid,uuid) to service_role;

create function public.rpc_complete_data_export_cleanup(p_receipt_id uuid,p_artifact_generation uuid,p_cleanup_attempt_id uuid,p_deleted boolean) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.data_export_requests; a private.data_export_artifacts; v_now timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_deleted is null then raise exception 'EXPORT_CLEANUP_RESULT_INVALID' using errcode='22023'; end if;
 r:=private.data_export_lock(p_receipt_id,null);v_now:=clock_timestamp();
 select * into a from private.data_export_artifacts where id=p_artifact_generation and receipt_id=r.id for update;
 if not found or a.cleanup_attempt_id is distinct from p_cleanup_attempt_id or p_cleanup_attempt_id is null then raise exception 'EXPORT_ATTEMPT_STALE' using errcode='40001'; end if;
 if a.cleanup_lease_until is null and a.cleanup_deleted is not distinct from p_deleted then return jsonb_build_object('receiptId',r.id,'artifactGeneration',a.id,'deleted',p_deleted); end if;
 if a.cleanup_lease_until is null or a.cleanup_lease_until<=v_now then raise exception 'EXPORT_ATTEMPT_STALE' using errcode='40001'; end if;
 -- Sixty seconds is technical reconciliation cadence, not approved metadata retention.
 -- Keep each exact retired path eligible after an absence observation for late commits.
 update private.data_export_artifacts set deleted_at=case when p_deleted then v_now else deleted_at end,cleanup_lease_until=null,cleanup_deleted=p_deleted,
 cleanup_next_at=v_now+interval '60 seconds',
 snapshot_text=case when snapshot_expires_at<=v_now then null else snapshot_text end where id=a.id;
 perform private.audit_marketplace(r.account_id,case when p_deleted then 'DATA_EXPORT_ARTIFACT_DELETED' else 'DATA_EXPORT_CLEANUP_RETRY' end,'SYSTEM',r.id,null,'{}'::jsonb);
 return jsonb_build_object('receiptId',r.id,'artifactGeneration',a.id,'deleted',p_deleted);
end $fn$;
revoke all on function public.rpc_complete_data_export_cleanup(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.rpc_complete_data_export_cleanup(uuid,uuid,uuid,boolean) to service_role;

-- Existing cron can expire DB availability and purge only admitted temporary snapshots.
-- It cannot invoke Storage: a separately wired verified-service Edge tick is still required.
create function private.data_export_maintenance(p_batch integer default 25) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare candidate record; r public.data_export_requests; v_now timestamptz; purged integer:=0; expired integer:=0; n integer;
begin
 for candidate in select d.id,d.account_id from public.data_export_requests d where exists(select 1 from private.data_export_artifacts a where a.receipt_id=d.id and ((a.snapshot_text is not null and a.snapshot_expires_at<=clock_timestamp()) or (a.id=d.active_export_attempt_id and d.status='READY' and a.artifact_expires_at<=clock_timestamp()))) order by d.id limit greatest(1,least(coalesce(p_batch,25),100)) loop
   if not pg_try_advisory_xact_lock(hashtextextended('uskoci:data-export:'||candidate.account_id::text,0)) then continue; end if;
   select * into r from public.data_export_requests where id=candidate.id for update skip locked;if not found then continue;end if;v_now:=clock_timestamp();
   update private.data_export_artifacts set snapshot_text=null where receipt_id=r.id and snapshot_text is not null and snapshot_expires_at<=v_now and (lease_until<=v_now or verified_at is not null);
   get diagnostics n=row_count;purged:=purged+n;
   if r.status='READY' and exists(select 1 from private.data_export_artifacts where id=r.active_export_attempt_id and artifact_expires_at<=v_now) then
     update public.data_export_requests set status='EXPIRED',updated_at=v_now where id=r.id;
     update private.data_export_artifacts set download_grant_id=null,download_grant_expires_at=null where id=r.active_export_attempt_id;
     perform private.audit_marketplace(r.account_id,'DATA_EXPORT_EXPIRED','SYSTEM',r.id,null,'{}'::jsonb);expired:=expired+1;
   end if;
 end loop;
 return jsonb_build_object('expiredRequests',expired,'temporarySnapshotsPurged',purged,'storageWorkerRequired',true,'storageDeletionPerformed',false);
end $fn$;
revoke all on function private.data_export_maintenance(integer) from public,anon,authenticated,service_role;
create or replace function private.marketplace_tick(p_batch integer default 25,p_at timestamptz default statement_timestamp())
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare expiry jsonb; dispatch jsonb; completion jsonb; export_maintenance jsonb;
begin
  expiry := private.expire_lifecycle(p_at);
  dispatch := private.dispatch_tick(p_batch, p_at);
  completion := to_jsonb(public.rpc_tick_auto_completion());
  export_maintenance := private.data_export_maintenance(p_batch);
  return jsonb_build_object('at',p_at,'expiry',expiry,'dispatch',dispatch,
                            'completion',completion,'authoritative',true,'exportMaintenance',export_maintenance);
end;
$$;

do $post$ begin
 if exists(select 1 from p2_delivery_old_acl old left join pg_proc p on p.oid=old.oid where p.oid is null or p.proacl is distinct from old.proacl) then raise exception 'P2_DELIVERY_EXISTING_ACL_CHANGED'; end if;
 if (select public from storage.buckets where id='data-export-artifacts') is distinct from false then raise exception 'P2_EXPORT_BUCKET_NOT_PRIVATE'; end if;
 if exists(select 1 from private.data_export_artifacts) then raise exception 'P2_EXPORT_ARTIFACT_SEED_FORBIDDEN'; end if;
 if exists(select 1 from private.retention_policy_sets where export_delivery is not null) then raise exception 'P2_EXPORT_POLICY_SEED_FORBIDDEN'; end if;
end $post$;
commit;
