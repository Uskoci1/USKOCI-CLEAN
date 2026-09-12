-- V5 AF-01/02: one explicit acceptance of an immutable owner-visible review.
-- Existing fact/location, DRAFT, B06 decision and B07 publication remain writers.
-- Review expiry (15 min) and evaluator lease (60 sec) are technical freshness
-- bounds, not a retention policy. No scheduler, provider or policy activation.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $pre$ begin
 if to_regprocedure('private.closure_assert_open(uuid,uuid)') is null
 or to_regprocedure('private.need_publication_context(uuid,integer,uuid)') is null
 or to_regprocedure('public.rpc_save_need_draft_from_review(uuid,uuid,text)') is null
 or private.publication_policy_document(private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM','RS',clock_timestamp())) is null
 then raise exception 'V5_SOURCE125_REQUIRED'; end if;
end $pre$;

-- Capture the immutable edit base for every status admitted by the existing
-- edit opener. Historical published conversations with NULL bases stay stale;
-- they must be reopened, never silently rebased over a newer Task revision.
do $edit_base$ declare d text; new_guard_hash text;
begin
 if (select md5(prosrc) from pg_proc where oid='private.guard_need_edit_base_marker()'::regprocedure)
  is distinct from '033e9307815212049bdf083c7083959b'
 or (select md5(prosrc) from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure)
  is distinct from 'f5339ad7d679c6f00c2f41f630bcec2f' then raise exception 'V5_EDIT_BASE_PREDECESSOR_DRIFT'; end if;
 d:=pg_get_functiondef('private.guard_need_edit_base_marker()'::regprocedure);
 if strpos(d,$n$if found and n.status='DRAFT' then$n$)=0 then raise exception 'V5_EDIT_BASE_PREDECESSOR_DRIFT'; end if;
 execute replace(d,$n$if found and n.status='DRAFT' then$n$,$n$if found and n.status in('DRAFT','PUBLISHED','SELECTION') then$n$);
 select md5(prosrc) into new_guard_hash from pg_proc where oid='private.guard_need_edit_base_marker()'::regprocedure;
 -- P3 still requires its exact trigger topology. Admit this checked body only;
 -- no retention policy, duration, job or source relation is activated here.
 d:=pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
 execute replace(d,'guard_need_edit_base_marker:033e9307815212049bdf083c7083959b',
  'guard_need_edit_base_marker:'||new_guard_hash);
end $edit_base$;

-- Private bounded review snapshots are never a public projection. No parent FK
-- is introduced into P3's AI child topology. Every read rechecks the owned parent.
create table private.ai_task_reviews (
 id uuid primary key default extensions.gen_random_uuid(), account_id uuid not null,
 conversation_id uuid not null, requester_profile_id uuid not null,
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 policy_binding jsonb not null, envelope jsonb not null,
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 check(jsonb_typeof(envelope)='object' and octet_length(envelope::text)<=131072),
 check(expires_at>created_at)
);
create index ai_task_reviews_owned_latest on private.ai_task_reviews(account_id,conversation_id,created_at desc,id);
create table private.ai_task_review_commands (
 review_id uuid primary key references private.ai_task_reviews(id), account_id uuid not null,
 client_request_id uuid not null, need_id uuid not null, need_revision integer not null check(need_revision>0),
 state text not null check(state in ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED')),
 attempt_id uuid, lease_expires_at timestamptz, evaluation_binding jsonb,
 evaluation jsonb, evaluation_result_hash text, published jsonb, created_at timestamptz not null default clock_timestamp(),
 unique(account_id,client_request_id),
 check((state in ('EVALUATED','PUBLISHED'))=(evaluation is not null)),
 check((state='PUBLISHED')=(published is not null)),
 check(state<>'EVALUATING' or (attempt_id is not null and lease_expires_at is not null and evaluation_binding is not null))
);
alter table private.ai_task_reviews enable row level security;
alter table private.ai_task_review_commands enable row level security;
revoke all on private.ai_task_reviews,private.ai_task_review_commands from public,anon,authenticated,service_role;

create function private.ai_task_review_immutable() returns trigger language plpgsql set search_path=pg_catalog as $f$
begin raise exception 'TASK_REVIEW_IMMUTABLE' using errcode='55000'; end $f$;
create trigger ai_task_review_immutable before update on private.ai_task_reviews
 for each row execute function private.ai_task_review_immutable();

create function private.ai_task_review_source(cid uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $f$
 select jsonb_build_object('conversation',jsonb_build_object('id',c.id,'accountId',c.account_id,
  'purpose',c.purpose,'status',c.status,'boundNeedId',c.bound_need_id,'schemaVersion',c.fact_schema_version,'editBase',c.need_edit_base_fingerprint),
  'need',case when c.bound_need_id is null then null else (select jsonb_build_object('id',n.id,'revision',n.revision,'status',n.status,
    'marker',private.need_edit_base_marker(n.id)) from public.needs n where n.id=c.bound_need_id) end,
  'facts',coalesce((select jsonb_agg(to_jsonb(f) order by f.fact_key,f.id) from public.ai_structured_facts f
   where f.conversation_id=c.id and f.superseded_at is null),'[]'::jsonb),
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sequence',m.sequence_no,'safety',m.safety)
   order by m.sequence_no) from public.ai_messages m where m.conversation_id=c.id),'[]'::jsonb),
  'turns',coalesce((select jsonb_agg(jsonb_build_object('id',t.turn_id,'state',t.state,'attempt',t.attempt_id)
   order by t.turn_id) from private.ai_need_turn_commands t where t.conversation_id=c.id),'[]'::jsonb))
 from public.ai_conversations c where c.id=cid;
$f$;

create function private.ai_task_review_policy(country text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare b private.publication_policy_bundles; refs jsonb; policy jsonb; market jsonb;
begin
 select to_jsonb(m) into market from private.location_market_configs m where m.country_code=country;
 select * into b from private.publication_policy_bundles where id=private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM',country,statement_timestamp());
 if b.id is not null then
  policy:=private.publication_policy_document(b.id);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.rule_id),'[]'::jsonb) into refs from private.publication_policy_rule_refs r where bundle_id=b.id;
 end if;
 return jsonb_build_object('country',country,'market',market,'bundleId',b.id,'version',b.version,
  'contentSha256',case when b.id is null or policy is null then null else
    encode(extensions.digest(convert_to(jsonb_build_object('bundle',to_jsonb(b),'ruleRefs',refs,'policy',policy)::text,'UTF8'),'sha256'),'hex') end);
end $f$;

create function private.ai_task_review_command_document(rid uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $f$
 select jsonb_build_object('reviewId',c.review_id,'clientRequestId',c.client_request_id,'needId',c.need_id,
  'needRevision',c.need_revision,'state',case when c.state='EVALUATING' and c.lease_expires_at<statement_timestamp()
   then 'UNKNOWN_OUTCOME' else c.state end,'evaluation',c.evaluation,'published',c.published,'authoritative',true)
 from private.ai_task_review_commands c where c.review_id=rid;
$f$;

create function public.rpc_prepare_ai_task_review(p_conversation_id uuid,p_response_deadline timestamptz default null,p_location jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); c public.ai_conversations; n public.needs; profile_id uuid; source jsonb; source_fingerprint text;
 old_location jsonb; location jsonb; review jsonb; facts jsonb:='[]'; item jsonb; k text; val jsonb;
 missing jsonb; policy jsonb; envelope jsonb; rid uuid:=extensions.gen_random_uuid(); expires timestamptz:=clock_timestamp()+interval '15 minutes';
 geo_keys text[]:=array['need.task_country_code','need.task_geography','need.exact_address','need.access_notes','need.resolved_location'];
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform private.closure_assert_open(u);
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
 select * into c from public.ai_conversations where id=p_conversation_id for update;
 if not found or c.account_id<>u then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 if c.status<>'OPEN' or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2'
 then raise exception 'TASK_REVIEW_NOT_EDITABLE' using errcode='55000'; end if;
 if c.bound_need_id is not null then
  -- Match the canonical edit writer's conversation -> Need lock order.
  select * into n from public.needs where id=c.bound_need_id for update;
  if not found or n.requester_account_id<>u then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
  if n.status not in('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='55000'; end if;
  if c.need_edit_base_fingerprint is distinct from private.need_edit_base_marker(n.id) then raise exception 'TASK_REVIEW_STALE' using errcode='40001'; end if;
 end if;
 select id into profile_id from public.app_profiles where account_id=u and kind='REQUESTER' and profile_status='ACTIVE' for share;
 if profile_id is null then raise exception 'REQUESTER_PROFILE_NOT_READY' using errcode='42501'; end if;
 if p_response_deadline is not null and p_response_deadline<=clock_timestamp() then raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023'; end if;
 source:=private.ai_task_review_source(c.id);
 source_fingerprint:=encode(extensions.digest(source::text,'sha256'),'hex');
 review:=public.rpc_ai_need_review_v2(c.id);
 if jsonb_array_length(review->'facts')>22 then raise exception 'TASK_REVIEW_INPUT_INVALID' using errcode='22023'; end if;
 old_location:=private.need_location_review_document(c.id);
 if p_location is not null and p_location<>'null'::jsonb then
  if jsonb_typeof(p_location)<>'object' or p_location-array['expectedRevision','value']<>'{}'::jsonb
   or not(p_location ?& array['expectedRevision','value']) or p_location->>'expectedRevision' is distinct from old_location->>'revision'
  then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='40001'; end if;
  location:=private.normalize_need_location(p_location->'value');
 elsif old_location#>>'{value,taskCountryCode}' is not null and old_location#>'{value,geography}'<>'null'::jsonb then
  location:=private.normalize_need_location(old_location->'value');
 end if;
 for item in select x from jsonb_array_elements(review->'facts') x loop
  k:=item->>'key'; perform private.validate_need_v2_fact(k,item->'value');
  if location is not null and k=any(geo_keys) then continue; end if;
  facts:=facts||jsonb_build_array(item-array['schemaVersion','valueType','requiredForDraft','material','evidence']);
 end loop;
 if location is not null then
  foreach k in array geo_keys loop
   val:=location->case k when 'need.task_country_code' then 'taskCountryCode' when 'need.task_geography' then 'geography'
    when 'need.exact_address' then 'exactAddress' when 'need.access_notes' then 'accessNotes' else 'resolvedLocation' end;
   if val is null or val='null'::jsonb then continue; end if;
   item:=null;
   if p_location is null or p_location='null'::jsonb then
    select f into item from jsonb_array_elements(review->'facts') f where f->>'key'=k and f->'value'=val;
   end if;
   facts:=facts||jsonb_build_array(jsonb_build_object('id',item->'id','key',k,'value',val,
    'displayValue',case when k='need.resolved_location' then 'Privatne tačke lokacije' when k='need.task_geography'
     then case when val->>'mode'='REMOTE' then 'Rad na daljinu' else coalesce(val#>>'{start,city}',val#>>'{serviceArea,city}',val->>'mode') end
     else val#>>'{}' end,'status',coalesce(item->>'status','NEEDS_CONFIRMATION'),'source',coalesce(item->>'source','EXPLICIT_USER_ANSWER'),
    'privacyClass',case when k in('need.exact_address','need.access_notes','need.resolved_location') then 'PRIVATE' else 'PUBLIC' end));
  end loop;
 end if;
 select coalesce(jsonb_agg(r.fact_key order by r.fact_key),'[]'::jsonb) into missing from private.need_fact_registry r
  where r.required_for_draft and not exists(select 1 from jsonb_array_elements(facts) f where f->>'key'=r.fact_key and f->>'status'<>'UNKNOWN');
 policy:=private.ai_task_review_policy(location->>'taskCountryCode');
 -- Identical refreshes reuse the same immutable review without extending expiry.
 select r.envelope into envelope from private.ai_task_reviews r where r.account_id=u and r.conversation_id=c.id
  and r.source_hash=source_fingerprint and r.policy_binding=policy and r.expires_at>clock_timestamp()
  and r.envelope->'location' is not distinct from coalesce(location,'null'::jsonb)
  and (r.envelope->>'responseDeadline')::timestamptz is not distinct from p_response_deadline
  order by r.created_at desc,r.id limit 1;
 if found then return envelope; end if;
 envelope:=jsonb_build_object('reviewId',rid,'accountId',u,'conversationId',c.id,'schemaVersion','NEED_FACT_V2',
  'draftId',c.bound_need_id,'draftRevision',coalesce(n.revision,0),
  'factsRevision',source_fingerprint,'sourceTurnRevision',coalesce((select max(sequence_no) from public.ai_messages where conversation_id=c.id),0),
  'geographyRevision',old_location->>'revision','expiresAt',expires,'responseDeadline',p_response_deadline,
  'publicProjection',coalesce((select jsonb_agg(f order by f->>'key') from jsonb_array_elements(facts) f where f->>'privacyClass'='PUBLIC'),'[]'::jsonb),
  'ownerPrivateProjection',coalesce((select jsonb_agg(f order by f->>'key') from jsonb_array_elements(facts) f where f->>'privacyClass'='PRIVATE'),'[]'::jsonb),
  'location',location,'missingRequired',missing,'safety',review->>'safety',
  'canAccept',jsonb_array_length(missing)=0 and location is not null and review->>'safety'<>'BLOCK'
   and not exists(select 1 from private.ai_need_turn_commands where conversation_id=c.id and state='PROCESSING'));
 envelope:=envelope||jsonb_build_object('displayedContentDigest',encode(extensions.digest(jsonb_build_object('envelope',envelope,'policy',policy)::text,'sha256'),'hex'));
 insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at)
 values(rid,u,c.id,profile_id,source_fingerprint,policy,envelope,expires);
 return envelope;
end $f$;

create function public.rpc_read_ai_task_review(p_review_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare r private.ai_task_reviews;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into r from private.ai_task_reviews where id=p_review_id and account_id=auth.uid();
 if not found or not exists(select 1 from public.ai_conversations where id=r.conversation_id and account_id=auth.uid())
 then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 return jsonb_build_object('review',r.envelope,'command',private.ai_task_review_command_document(r.id));
end $f$;
create function public.rpc_read_latest_ai_task_review(p_conversation_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare rid uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if not exists(select 1 from public.ai_conversations where id=p_conversation_id and account_id=auth.uid())
 then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 -- A committed owner command wins over a newer abandoned/prefetched review.
 select r.id into rid from private.ai_task_reviews r left join private.ai_task_review_commands c on c.review_id=r.id
 where r.account_id=auth.uid() and r.conversation_id=p_conversation_id order by (c.review_id is not null) desc,r.created_at desc,r.id limit 1;
 if rid is null then return null; end if;
 return public.rpc_read_ai_task_review(rid);
end $f$;

create function public.rpc_accept_ai_task_review(p_review_id uuid,p_displayed_content_digest text,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); r private.ai_task_reviews; c public.ai_conversations; cmd private.ai_task_review_commands;
 source_hash text; f record; saved jsonb; n public.needs;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_client_request_id is null or p_displayed_content_digest is null or p_displayed_content_digest !~ '^[a-f0-9]{64}$'
 then raise exception 'TASK_REVIEW_INPUT_INVALID' using errcode='22023'; end if;
 perform private.closure_assert_open(u);
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:task-review-command:'||u::text||':'||p_client_request_id::text,126));
 select * into r from private.ai_task_reviews where id=p_review_id and account_id=u;
 if not found then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 if r.envelope->>'displayedContentDigest'<>p_displayed_content_digest then raise exception 'TASK_REVIEW_DIGEST_MISMATCH' using errcode='40001'; end if;
 select * into c from public.ai_conversations where id=r.conversation_id and account_id=u for update;
 if not found then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 select * into cmd from private.ai_task_review_commands where account_id=u and client_request_id=p_client_request_id;
 if found and cmd.review_id<>r.id then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
 if exists(select 1 from private.ai_task_review_commands where review_id=r.id) then return private.ai_task_review_command_document(r.id); end if;
 if r.expires_at<=clock_timestamp() then raise exception 'TASK_REVIEW_EXPIRED' using errcode='40001'; end if;
 if c.bound_need_id is not null then
  select * into n from public.needs where id=c.bound_need_id for update;
  if not found or n.requester_account_id<>u then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
  if n.id is distinct from (r.envelope->>'draftId')::uuid or n.revision is distinct from (r.envelope->>'draftRevision')::integer
  then raise exception 'TASK_REVIEW_STALE' using errcode='40001'; end if;
 end if;
 source_hash:=encode(extensions.digest(private.ai_task_review_source(c.id)::text,'sha256'),'hex');
 if source_hash<>r.source_hash then raise exception 'TASK_REVIEW_STALE' using errcode='40001'; end if;
 if r.policy_binding is distinct from private.ai_task_review_policy(r.envelope#>>'{location,taskCountryCode}')
 then raise exception 'TASK_REVIEW_POLICY_STALE' using errcode='40001'; end if;
 if r.envelope->'canAccept' is distinct from 'true'::jsonb then raise exception 'TASK_REVIEW_INCOMPLETE' using errcode='22023'; end if;
 -- Acceptance is confined to the exact server-stored IDs and normalized geography
 -- displayed by this review. No client loop or new/unseen AI turn can be accepted.
 perform public.rpc_save_need_location_review(c.id,r.envelope->>'geographyRevision',r.envelope->'location',true);
 for f in select id from public.ai_structured_facts where conversation_id=c.id and superseded_at is null
  and fact_key not in('need.task_country_code','need.task_geography','need.exact_address','need.access_notes','need.resolved_location') order by fact_key loop
  perform public.rpc_ai_confirm_fact(f.id);
 end loop;
 if c.bound_need_id is null then
  saved:=public.rpc_save_need_draft_from_review(c.id,r.requester_profile_id,'v5-draft:'||r.id::text);
 else
  saved:=public.rpc_confirm_need_edit_from_review_v2(c.bound_need_id,(r.envelope->>'draftRevision')::integer,c.id,'v5-edit:'||r.id::text);
 end if;
 insert into private.ai_task_review_commands(review_id,account_id,client_request_id,need_id,need_revision,state)
 values(r.id,u,p_client_request_id,(saved->>'needId')::uuid,(saved->>'revision')::integer,'ACCEPTED');
 return private.ai_task_review_command_document(r.id);
end $f$;

-- Durable service claim replaces isolate-local locking for this new UX command.
-- A timed-out provider attempt is UNKNOWN and cannot be silently retried.
create function public.rpc_claim_ai_task_review_evaluation_service(p_account_id uuid,p_review_id uuid,p_need_id uuid,p_need_revision integer,p_binding jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare r private.ai_task_reviews; c private.ai_task_review_commands; ctx jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
 select * into r from private.ai_task_reviews where id=p_review_id and account_id=p_account_id;
 if not found then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 select * into c from private.ai_task_review_commands where review_id=r.id and account_id=p_account_id for update;
 if not found or c.need_id is distinct from p_need_id or c.need_revision is distinct from p_need_revision
 then raise exception 'TASK_REVIEW_COMMAND_MISMATCH' using errcode='42501'; end if;
 if c.state<>'ACCEPTED' then return jsonb_build_object('acquired',false,'attemptId',null,'command',private.ai_task_review_command_document(r.id)); end if;
 if r.policy_binding is distinct from private.ai_task_review_policy(r.envelope#>>'{location,taskCountryCode}')
 then raise exception 'TASK_REVIEW_POLICY_STALE' using errcode='40001'; end if;
 ctx:=private.need_publication_context(c.need_id,c.need_revision,p_account_id);
 if ctx->>'kind'<>'READY' or ctx->'binding' is distinct from p_binding then raise exception 'TASK_REVIEW_STALE' using errcode='40001'; end if;
 update private.ai_task_review_commands set state='EVALUATING',attempt_id=extensions.gen_random_uuid(),
  lease_expires_at=clock_timestamp()+interval '60 seconds',evaluation_binding=p_binding where review_id=r.id returning * into c;
 return jsonb_build_object('acquired',true,'attemptId',c.attempt_id,'command',private.ai_task_review_command_document(r.id));
end $f$;

create function public.rpc_complete_ai_task_review_evaluation_service(p_account_id uuid,p_review_id uuid,p_attempt_id uuid,
 p_outcome text,p_rule_ids text[],p_safe_reason_codes text[],p_provider_ref text,p_model_ref text,p_not_ready_code text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare r private.ai_task_reviews; c private.ai_task_review_commands; decision jsonb; result_hash text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
 select * into r from private.ai_task_reviews where id=p_review_id and account_id=p_account_id;
 if not found then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 select * into c from private.ai_task_review_commands where review_id=r.id and account_id=p_account_id for update;
 if not found or c.attempt_id is distinct from p_attempt_id then raise exception 'TASK_REVIEW_ATTEMPT_STALE' using errcode='40001'; end if;
 result_hash:=encode(extensions.digest(jsonb_build_object('outcome',p_outcome,'rules',p_rule_ids,'reasons',p_safe_reason_codes,
  'provider',p_provider_ref,'model',p_model_ref,'notReady',p_not_ready_code)::text,'sha256'),'hex');
 if c.state in('EVALUATED','PUBLISHED') then
  if c.evaluation_result_hash is distinct from result_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
  return c.evaluation;
 end if;
 if c.state<>'EVALUATING' or c.lease_expires_at<=clock_timestamp() then raise exception 'TASK_REVIEW_ATTEMPT_STALE' using errcode='40001'; end if;
 if r.policy_binding is distinct from private.ai_task_review_policy(r.envelope#>>'{location,taskCountryCode}')
 then raise exception 'TASK_REVIEW_POLICY_STALE' using errcode='40001'; end if;
 if p_not_ready_code is not null then
  if p_not_ready_code not in('EVALUATOR_UNAVAILABLE','EVALUATOR_INVALID_RESPONSE','RATE_LIMITED')
   or p_outcome is not null then raise exception 'TASK_REVIEW_INPUT_INVALID' using errcode='22023'; end if;
  decision:=jsonb_build_object('kind','NOT_READY','needId',c.need_id,'needRevision',c.need_revision,'authoritativeDecision',false,'code',p_not_ready_code);
 else
  decision:=jsonb_build_object('kind','DECISION','decision',public.rpc_record_need_publication_decision_service(c.need_id,c.need_revision,
   c.evaluation_binding->>'policyId',c.evaluation_binding->>'jurisdiction',p_outcome,p_rule_ids,'PUBLICATION_EVALUATOR_V1',p_safe_reason_codes,
   p_provider_ref,p_model_ref,'{}'::jsonb,jsonb_build_object('evaluationContext',c.evaluation_binding)));
 end if;
 update private.ai_task_review_commands set state='EVALUATED',evaluation=decision,evaluation_result_hash=result_hash where review_id=r.id;
 return decision;
end $f$;

create function public.rpc_publish_accepted_ai_task_review(p_review_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); r private.ai_task_reviews; c private.ai_task_review_commands; v_published jsonb;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform private.closure_assert_open(u);
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs,private.location_market_configs in share mode;
 select * into r from private.ai_task_reviews where id=p_review_id and account_id=u;
 if not found then raise exception 'TASK_REVIEW_NOT_FOUND' using errcode='42501'; end if;
 select * into c from private.ai_task_review_commands where review_id=r.id and account_id=u for update;
 if not found or c.client_request_id is distinct from p_client_request_id then raise exception 'TASK_REVIEW_COMMAND_MISMATCH' using errcode='42501'; end if;
 if c.state='PUBLISHED' then return private.ai_task_review_command_document(r.id); end if;
 if c.state<>'EVALUATED' or c.evaluation#>>'{decision,outcome}' is distinct from 'ALLOW' then raise exception 'PUBLICATION_DECISION_NOT_ALLOW' using errcode='55000'; end if;
 if r.policy_binding is distinct from private.ai_task_review_policy(r.envelope#>>'{location,taskCountryCode}')
 then raise exception 'TASK_REVIEW_POLICY_STALE' using errcode='40001'; end if;
 v_published:=public.rpc_publish_need_canonical(c.need_id,c.need_revision,(c.evaluation#>>'{decision,decisionSequence}')::bigint,
  (r.envelope->>'responseDeadline')::timestamptz,'v5-publish:'||r.id::text);
 update private.ai_task_review_commands set state='PUBLISHED',published=v_published where review_id=r.id;
 return private.ai_task_review_command_document(r.id);
end $f$;

revoke all on function private.ai_task_review_immutable(),private.ai_task_review_source(uuid),private.ai_task_review_policy(text),private.ai_task_review_command_document(uuid) from public,anon,authenticated,service_role;
revoke all on function public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb),public.rpc_read_ai_task_review(uuid),public.rpc_read_latest_ai_task_review(uuid),public.rpc_accept_ai_task_review(uuid,text,uuid),public.rpc_publish_accepted_ai_task_review(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb),public.rpc_read_ai_task_review(uuid),public.rpc_read_latest_ai_task_review(uuid),public.rpc_accept_ai_task_review(uuid,text,uuid),public.rpc_publish_accepted_ai_task_review(uuid,uuid) to authenticated;
revoke all on function public.rpc_claim_ai_task_review_evaluation_service(uuid,uuid,uuid,integer,jsonb),public.rpc_complete_ai_task_review_evaluation_service(uuid,uuid,uuid,text,text[],text[],text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.rpc_claim_ai_task_review_evaluation_service(uuid,uuid,uuid,integer,jsonb),public.rpc_complete_ai_task_review_evaluation_service(uuid,uuid,uuid,text,text[],text[],text,text,text) to service_role;
commit;
