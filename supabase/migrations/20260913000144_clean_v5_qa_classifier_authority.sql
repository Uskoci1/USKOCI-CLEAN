-- V5 Q&A semantic classifier: existing RU4B writers remain canonical.
-- No provider/model setting, active policy, plaintext input or live decision seeded.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table private.qa_ai_commands(
 id uuid primary key default gen_random_uuid(),account_id uuid not null,client_request_id uuid not null,
 command_type text not null check(command_type in('ASK','ANSWER')),need_id uuid not null,need_revision integer not null check(need_revision>0),question_id uuid,
 text_sha256 text not null check(text_sha256 ~ '^[a-f0-9]{64}$'),request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 content_fingerprint text,source_hash text,policy_bundle_id uuid,policy_hash text,
 state text not null check(state in('PROCESSING','READY','REJECTED','STALE','COMMITTED','CANCELLED')),
 attempt_id uuid,lease_expires_at timestamptz,provider_dispatched boolean not null default false,
 outcome text check(outcome in('ALLOW','CLARIFY','REVIEW','BLOCK')),materiality text check(materiality in('NON_MATERIAL','MATERIAL')),
 rule_ids text[] not null default '{}',safe_reason_codes text[] not null default '{}',policy_decision_id uuid,materiality_decision_id uuid,
 output_hash text,receipt jsonb,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(account_id,client_request_id),check((command_type='ASK')=(question_id is null)),
 check((state='COMMITTED')=(receipt is not null)),
 check(state<>'READY' or(outcome='ALLOW' and(command_type='ASK' or materiality='NON_MATERIAL')))
);
create index qa_ai_commands_need_idx on private.qa_ai_commands(need_id,need_revision,state);
alter table private.qa_ai_commands enable row level security;alter table private.qa_ai_commands force row level security;
revoke all on private.qa_ai_commands from public,anon,authenticated,service_role;
create trigger qa_ai_closure_guard before insert or update on private.qa_ai_commands for each row execute function private.closure_guard_owned_write('ACCOUNT','account_id');

create function private.qa_ai_input_hash(t text,n uuid,r integer,q uuid,h text) returns text
language sql immutable set search_path=pg_catalog as $f$
 select encode(extensions.digest(convert_to(jsonb_build_object('type',t,'needId',n,'revision',r,'questionId',q,'textSha256',h)::text,'UTF8'),'sha256'),'hex');
$f$;
-- Public projection is an explicit allowlist. Exact address, access notes,
-- coordinates, contact/actor IDs, photographs and profile data never enter it.
create function private.qa_ai_source(nid uuid,rev integer,qid uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare n public.needs;q private.preselection_qa_questions;b private.publication_policy_bundles;task_bundle uuid;
 qa_policy jsonb;task_policy jsonb;answer_text text;answer_version integer;conditions text[];public_task jsonb;material jsonb;policy_hash text;
begin
 select * into n from public.needs where id=nid;
 if not found or n.revision<>rev or n.status not in('PUBLISHED','ACTIVE') then return null;end if;
 if qid is not null then
  select * into q from private.preselection_qa_questions where id=qid and need_id=nid and need_revision=rev;
  if not found or q.status in('IGNORED','REPORTED') then return null;end if;
  select a.answer_text,a.answer_version into answer_text,answer_version from private.preselection_qa_answer_versions a where a.question_id=q.id order by a.answer_version desc limit 1;
 end if;
 select * into b from private.publication_policy_bundles where id=private.current_publication_policy_bundle('PRESELECTION_QA_V1',n.task_country_code,statement_timestamp());
 if b.id is null then return null;end if;
 qa_policy:=private.publication_policy_document(b.id);
 task_bundle:=private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM',n.task_country_code,statement_timestamp());
 task_policy:=private.publication_policy_document(task_bundle);
 if qa_policy is null or task_policy is null then return null;end if;
 policy_hash:=encode(extensions.digest(convert_to(jsonb_build_object('qa',qa_policy,'taskSafety',task_policy)::text,'UTF8'),'sha256'),'hex');
 select critical_conditions into conditions from public.need_requirement_details where need_id=n.id;
 public_task:=jsonb_build_object('title',n.title,'description',n.description,'category',n.category,'scheduleKind',n.schedule_kind,
  'startsAt',n.starts_at,'endsAt',n.ends_at,'requiredSlots',n.required_slots,'priceMode',n.mode,'requesterPriceRsd',n.requester_price_rsd,
  'requiredSkills',to_jsonb(coalesce(n.required_skills,'{}'::text[])),'requiredTools',to_jsonb(coalesce(n.required_tools,'{}'::text[])),
  'requiredVehicles',to_jsonb(coalesce(n.required_vehicles,'{}'::text[])),'requiredLicenses',to_jsonb(coalesce(n.required_licenses,'{}'::text[])),
  'minimumExperienceYears',n.minimum_experience_years,'verifiedIdentityRequired',coalesce(n.verified_identity_required,false),
  'criticalConditions',to_jsonb(coalesce(conditions,'{}'::text[])),
  'publicGeography',(private.need_publication_fingerprint_snapshot(n.id)->'publicGeography')-ARRAY['approximateLat','approximateLng']);
 material:=jsonb_build_object('needId',n.id,'revision',n.revision,'status',n.status,'marker',private.need_edit_base_marker(n.id),
  'question',case when qid is null then null else to_jsonb(q) end,'answerVersion',answer_version,'answerText',answer_text,
  'policyBundle',b.id,'taskPolicyBundle',task_bundle,'policyHash',policy_hash);
 return jsonb_build_object('sourceHash',encode(extensions.digest(convert_to(material::text,'UTF8'),'sha256'),'hex'),
  'policyBundleId',b.id,'policyHash',policy_hash,'policy',qa_policy,'taskSafetyPolicy',task_policy,'publicTask',public_task,
  'question',case when qid is null then null else jsonb_build_object('text',q.question_text,'answerText',answer_text,'answerVersion',answer_version) end);
end $f$;

create function private.qa_ai_status(a uuid,nid uuid,k uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare c private.qa_ai_commands;
begin
 select * into c from private.qa_ai_commands where account_id=a and client_request_id=k;
 if found and c.need_id<>nid then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';end if;
 return jsonb_build_object('accountId',a,'needId',nid,'clientRequestId',k,'classificationId',c.id,'type',c.command_type,'needRevision',c.need_revision,
  'questionId',c.question_id,'textSha256',c.text_sha256,'state',coalesce(c.state,'ABSENT'),'outcome',c.outcome,'materiality',c.materiality,
  'safeReasonCodes',coalesce(c.safe_reason_codes,'{}'::text[]),'canCancel',c.id is null or c.state in('PROCESSING','READY'),
  'receipt',c.receipt,'authoritative',true);
end $f$;
create function public.rpc_read_qa_classification(p_expected_user_id uuid,p_need_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_need_id is null or p_client_request_id is null then raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 return private.qa_ai_status(auth.uid(),p_need_id,p_client_request_id);
end $f$;

create function public.rpc_claim_qa_classification_service(p_account_id uuid,p_type text,p_need_id uuid,p_need_revision integer,p_question_id uuid,p_text text,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c private.qa_ai_commands;src jsonb;h text;input_hash text;subject text;checked jsonb;
begin
 if p_account_id is null or p_need_id is null or p_client_request_id is null or p_need_revision is null or p_need_revision<1
 or p_type not in('ASK','ANSWER') or p_type is null or (p_type='ASK')<>(p_question_id is null) then raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 h:=encode(extensions.digest(convert_to(btrim(coalesce(p_text,'')),'UTF8'),'sha256'),'hex');input_hash:=private.qa_ai_input_hash(p_type,p_need_id,p_need_revision,p_question_id,h);
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('v5-qa:'||p_account_id::text||':'||p_client_request_id::text,0));
 select * into c from private.qa_ai_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if found then
  if c.request_hash<>input_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';end if;
  return jsonb_build_object('status',private.qa_ai_status(p_account_id,p_need_id,p_client_request_id),'claim',null);
 end if;
 perform private.qa_ai_assert_actor(p_account_id,p_need_id,p_need_revision,p_question_id,p_type);
 subject:=case when p_type='ASK' then 'QUESTION' else 'ANSWER' end;
 checked:=public.rpc_check_preselection_qa_limits_service(p_account_id,subject,p_need_id,p_need_revision,p_question_id,p_text);
 src:=private.qa_ai_source(p_need_id,p_need_revision,p_question_id);
 if src is null then raise exception 'PRESELECTION_QA_POLICY_NOT_READY' using errcode='55000';end if;
 insert into private.qa_ai_commands(account_id,client_request_id,command_type,need_id,need_revision,question_id,text_sha256,request_hash,content_fingerprint,
  source_hash,policy_bundle_id,policy_hash,state,attempt_id,lease_expires_at)
 values(p_account_id,p_client_request_id,p_type,p_need_id,p_need_revision,p_question_id,h,input_hash,
  private.ru4b_content_fingerprint(subject,p_need_id,p_need_revision,p_question_id,p_text),src->>'sourceHash',(src->>'policyBundleId')::uuid,src->>'policyHash','PROCESSING',gen_random_uuid(),clock_timestamp()+interval '60 seconds') returning * into c;
 return jsonb_build_object('status',private.qa_ai_status(p_account_id,p_need_id,p_client_request_id),'claim',jsonb_build_object('attemptId',c.attempt_id,'leaseExpiresAt',c.lease_expires_at,
  'context',jsonb_build_object('schemaVersion','PRESELECTION_QA_CLASSIFIER_V1','type',p_type,'sourceHash',c.source_hash,'policyHash',c.policy_hash,
   'policy',src->'policy','taskSafetyPolicy',src->'taskSafetyPolicy','publicTask',src->'publicTask','question',src->'question')));
end $f$;

create function private.qa_ai_assert_actor(a uuid,nid uuid,rev integer,qid uuid,t text) returns void
language plpgsql security definer set search_path=pg_catalog as $f$
declare n public.needs;q private.preselection_qa_questions;
begin
 -- Match publication's policy-before-parent lock order, including policy insert
 -- phantoms. Parent UPDATE fences new FK children; existing material rows lock.
 lock table private.publication_policy_bundles,private.publication_policy_rule_refs in share mode;
 if t='ANSWER' then select * into q from private.preselection_qa_questions where id=qid and need_id=nid for update;
  if not found or q.need_revision<>rev or q.status in('IGNORED','REPORTED') then raise exception 'QUESTION_NOT_ANSWERABLE' using errcode='42501';end if;end if;
 select * into n from public.needs where id=nid for update;
 if not found or n.revision<>rev or n.status not in('PUBLISHED','ACTIVE') then raise exception 'STALE_NEED_REVISION' using errcode='42501';end if;
 perform 1 from public.need_geography where need_id=nid for share;
 perform 1 from public.need_sensitive where need_id=nid for share;
 perform 1 from public.need_requirement_details where need_id=nid for share;
 perform private.closure_assert_open(a,n.requester_account_id);
 if t='ASK' then
  perform 1 from public.app_profiles where account_id=a and kind='WORKER' and profile_status='ACTIVE' for share;
  if a=n.requester_account_id or not found then raise exception 'ACTIVE_WORKER_REQUIRED' using errcode='42501';end if;
  perform private.ru4b_assert_block_authority_ready(a,n.requester_account_id);
 else
  if a<>n.requester_account_id then raise exception 'NOT_NEED_OWNER' using errcode='42501';end if;
  perform private.ru4b_assert_block_authority_ready(q.asker_account_id,a);
 end if;
end $f$;

create function public.rpc_dispatch_qa_classification_service(p_account_id uuid,p_need_id uuid,p_client_request_id uuid,p_attempt_id uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog as $f$
declare c private.qa_ai_commands;src jsonb;
begin
 if p_account_id is null or p_need_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('v5-qa:'||p_account_id::text||':'||p_client_request_id::text,0));
 select * into c from private.qa_ai_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if not found or c.need_id<>p_need_id or c.attempt_id is distinct from p_attempt_id or c.state<>'PROCESSING' or c.provider_dispatched or c.lease_expires_at<=clock_timestamp() then return false;end if;
 perform private.qa_ai_assert_actor(c.account_id,c.need_id,c.need_revision,c.question_id,c.command_type);
 src:=private.qa_ai_source(c.need_id,c.need_revision,c.question_id);
 if src->>'sourceHash' is distinct from c.source_hash then update private.qa_ai_commands set state='STALE',updated_at=clock_timestamp() where id=c.id;return false;end if;
 update private.qa_ai_commands set provider_dispatched=true,updated_at=clock_timestamp() where id=c.id;return true;
end $f$;

create function public.rpc_cancel_qa_classification(p_expected_user_id uuid,p_type text,p_need_id uuid,p_need_revision integer,p_question_id uuid,p_text_sha256 text,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a uuid:=auth.uid();c private.qa_ai_commands;input_hash text;context_value jsonb;prior jsonb;prior_receipt jsonb;
begin
 if a is null or a is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_need_id is null or p_client_request_id is null or p_need_revision is null or p_need_revision<1 or p_type is null or p_type not in('ASK','ANSWER')
 or (p_type='ASK')<>(p_question_id is null) or p_text_sha256 is null or p_text_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 perform private.closure_assert_open(a);perform pg_advisory_xact_lock(hashtextextended('v5-qa:'||a::text||':'||p_client_request_id::text,0));
 input_hash:=private.qa_ai_input_hash(p_type,p_need_id,p_need_revision,p_question_id,p_text_sha256);
 -- Match the retained canonical command lock as well. If a direct RU4B writer
 -- already won, return its immutable receipt instead of claiming cancellation.
 perform pg_advisory_xact_lock(hashtextextended(a::text||E'\n'||p_client_request_id::text,case when p_type='ASK' then 4412 else 4413 end));
 prior:=public.rpc_read_preselection_qa_command(a,p_need_id,p_client_request_id);
 if prior->'found'='true'::jsonb then
  if prior#>>'{command,type}'<>p_type or prior#>>'{command,textSha256}'<>p_text_sha256
   or(prior#>>'{command,needRevision}')::integer<>p_need_revision
   or(p_type='ANSWER' and prior#>>'{command,receipt,questionId}'<>p_question_id::text) then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';end if;
  prior_receipt:=prior#>'{command,receipt}';
 end if;
 select * into c from private.qa_ai_commands where account_id=a and client_request_id=p_client_request_id for update;
 if found then
  if c.request_hash<>input_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';end if;
  if c.state='COMMITTED' then return private.qa_ai_status(a,p_need_id,p_client_request_id);
  elsif prior_receipt is not null then update private.qa_ai_commands set state='COMMITTED',receipt=prior_receipt,updated_at=clock_timestamp() where id=c.id;
  elsif c.state in('PROCESSING','READY') then update private.qa_ai_commands set state='CANCELLED',updated_at=clock_timestamp() where id=c.id;end if;
 else
  if prior_receipt is null then
  context_value:=public.rpc_read_preselection_qa_context(a,p_need_id);
  if p_type='ASK' and(context_value->>'mode'<>'PUBLIC' or context_value->'activeWorker'<>'true'::jsonb)
   or p_type='ANSWER' and(context_value->>'mode'<>'OWNER' or not exists(select 1 from private.preselection_qa_questions where id=p_question_id and need_id=p_need_id))
   then raise exception 'QA_INPUT_INVALID' using errcode='42501';end if;end if;
  insert into private.qa_ai_commands(account_id,client_request_id,command_type,need_id,need_revision,question_id,text_sha256,request_hash,state)
  values(a,p_client_request_id,p_type,p_need_id,p_need_revision,p_question_id,p_text_sha256,input_hash,'CANCELLED');
  if prior_receipt is not null then update private.qa_ai_commands set state='COMMITTED',receipt=prior_receipt where account_id=a and client_request_id=p_client_request_id;end if;
 end if;
 return private.qa_ai_status(a,p_need_id,p_client_request_id);
end $f$;

-- ALLOW is admitted only through exact135 provenance, never for a Task bundle.
do $enable_exact_writer$
declare definition text;anchor text;
begin
 definition:=pg_get_functiondef('private.rpc_ru4b_record_policy_decision_service(text,uuid,integer,uuid,text,uuid,text,text[],text,jsonb)'::regprocedure);
 anchor:='if p_outcome=''ALLOW'' then raise exception ''RU4B_ALLOW_NOT_ENABLED'' using errcode=''P0001''; end if;';
 if position(anchor in definition)=0 then raise exception 'QA_POLICY_WRITER_PREDECESSOR_DRIFT';end if;
 execute replace(definition,anchor,$guard$
 if p_outcome='ALLOW' and not exists(select 1 from private.qa_ai_commands c join private.publication_policy_bundles b on b.id=c.policy_bundle_id
  where c.id::text=p_service_provenance->>'classificationId' and c.state='PROCESSING' and c.provider_dispatched
   and p_decision_source='GEMINI_QA_V5' and c.need_id=p_need_id and c.need_revision=p_need_revision
   and c.question_id is not distinct from p_question_id and c.content_fingerprint=p_content_fingerprint
   and c.policy_bundle_id=p_policy_bundle_id and b.policy_id='PRESELECTION_QA_V1'
   and c.source_hash=p_service_provenance->>'sourceHash' and c.policy_hash=p_service_provenance->>'policyHash')
 then raise exception 'RU4B_ALLOW_NOT_ENABLED' using errcode='P0001';end if;
 $guard$);
end $enable_exact_writer$;

create function public.rpc_complete_qa_classification_service(p_account_id uuid,p_need_id uuid,p_client_request_id uuid,p_attempt_id uuid,p_output jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c private.qa_ai_commands;src jsonb;doc jsonb;rule jsonb;item jsonb;rules text[];reasons text[];outcome_value text;materiality_value text;
 policy_id uuid;materiality_id uuid;output_digest text;source_provenance jsonb;
begin
 if p_account_id is null or p_need_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 perform private.closure_assert_open(p_account_id);perform pg_advisory_xact_lock(hashtextextended('v5-qa:'||p_account_id::text||':'||p_client_request_id::text,0));
 select * into c from private.qa_ai_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if not found or c.need_id<>p_need_id or c.attempt_id is distinct from p_attempt_id then raise exception 'QA_CLASSIFICATION_NOT_FOUND' using errcode='42501';end if;
 if jsonb_typeof(p_output) is distinct from 'object' or p_output-ARRAY['outcome','materiality','ruleIds','safeReasonCodes']<>'{}'::jsonb
 or not(p_output ?& ARRAY['outcome','materiality','ruleIds','safeReasonCodes']) then raise exception 'QA_CLASSIFICATION_INVALID' using errcode='22023';end if;
 output_digest:=encode(extensions.digest(convert_to(p_output::text,'UTF8'),'sha256'),'hex');
 if c.state<>'PROCESSING' then
  if c.output_hash is not null and c.output_hash<>output_digest then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';end if;
  return private.qa_ai_status(p_account_id,p_need_id,p_client_request_id);end if;
 if not c.provider_dispatched then raise exception 'QA_CLASSIFICATION_NOT_DISPATCHED' using errcode='42501';end if;
 perform private.qa_ai_assert_actor(c.account_id,c.need_id,c.need_revision,c.question_id,c.command_type);
 src:=private.qa_ai_source(c.need_id,c.need_revision,c.question_id);
 if c.lease_expires_at<=clock_timestamp() or src->>'sourceHash' is distinct from c.source_hash then
  update private.qa_ai_commands set state='STALE',output_hash=output_digest,updated_at=clock_timestamp() where id=c.id;
  return private.qa_ai_status(p_account_id,p_need_id,p_client_request_id);end if;
 doc:=src->'policy';outcome_value:=p_output->>'outcome';materiality_value:=p_output->>'materiality';
 if outcome_value is null or outcome_value not in('ALLOW','CLARIFY','REVIEW','BLOCK')
 or(c.command_type='ASK' and p_output->'materiality'<>'null'::jsonb)
 or(c.command_type='ANSWER' and(materiality_value is null and outcome_value<>'REVIEW' or materiality_value is not null and materiality_value not in('NON_MATERIAL','MATERIAL')))
 or jsonb_typeof(p_output->'ruleIds') is distinct from 'array' or jsonb_array_length(p_output->'ruleIds') not between 1 and 64
 or jsonb_typeof(p_output->'safeReasonCodes') is distinct from 'array' or jsonb_array_length(p_output->'safeReasonCodes')>64
 then raise exception 'QA_CLASSIFICATION_INVALID' using errcode='22023';end if;
 select array_agg(value order by value) into rules from jsonb_array_elements_text(p_output->'ruleIds');
 select coalesce(array_agg(value order by value),'{}'::text[]) into reasons from jsonb_array_elements_text(p_output->'safeReasonCodes');
 if cardinality(rules)<>(select count(distinct x) from unnest(rules)x) or cardinality(reasons)<>(select count(distinct x) from unnest(reasons)x)
 then raise exception 'QA_CLASSIFICATION_INVALID' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(p_output->'ruleIds') loop
  if jsonb_typeof(item)<>'string' then raise exception 'QA_CLASSIFICATION_INVALID' using errcode='22023';end if;
  select value into rule from jsonb_array_elements(doc->'rules') where value->>'ruleId'=item#>>'{}';
  if rule is null or not(rule->'outcomes' ? outcome_value) then raise exception 'QA_CLASSIFICATION_INVALID' using errcode='22023';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_output->'safeReasonCodes') loop
  if jsonb_typeof(item)<>'string' or not exists(select 1 from jsonb_array_elements(doc->'rules') r where r->>'ruleId'=any(rules) and r->'safeReasonCodes' ? (item#>>'{}'))
  then raise exception 'QA_CLASSIFICATION_INVALID' using errcode='22023';end if;
 end loop;
 if materiality_value='MATERIAL' and outcome_value='ALLOW' then raise exception 'QA_CLASSIFICATION_INVALID' using errcode='22023';end if;
 source_provenance:=jsonb_build_object('classificationId',c.id,'sourceHash',c.source_hash,'policyHash',c.policy_hash,'provider','GEMINI','model','gemini-3.8-flash');
 policy_id:=private.rpc_ru4b_record_policy_decision_service(case when c.command_type='ASK' then 'QUESTION' else 'ANSWER' end,
  c.need_id,c.need_revision,c.question_id,c.content_fingerprint,c.policy_bundle_id,outcome_value,reasons,'GEMINI_QA_V5',source_provenance);
 if c.command_type='ANSWER' and materiality_value is not null then materiality_id:=private.rpc_ru4b_record_materiality_decision_service(c.question_id,c.need_id,c.need_revision,c.content_fingerprint,materiality_value,'GEMINI_QA_V5',source_provenance);end if;
 update private.qa_ai_commands set state=case when outcome_value='ALLOW' and(c.command_type='ASK' or materiality_value='NON_MATERIAL') then 'READY' else 'REJECTED' end,
  outcome=outcome_value,materiality=materiality_value,rule_ids=rules,safe_reason_codes=reasons,policy_decision_id=policy_id,materiality_decision_id=materiality_id,output_hash=output_digest,updated_at=clock_timestamp() where id=c.id;
 return private.qa_ai_status(p_account_id,p_need_id,p_client_request_id);
end $f$;

-- Retained direct RU4B RPCs must also enforce classifier source freshness.
do $bind_decision_readers$
declare definition text;anchor text;
begin
 definition:=pg_get_functiondef('private.ru4b_has_exact_policy_allow(text,uuid,integer,uuid,text)'::regprocedure);
 anchor:='and d.outcome=''ALLOW''';if position(anchor in definition)=0 then raise exception 'QA_ALLOW_READER_DRIFT';end if;
 execute replace(definition,anchor,anchor||$guard$
 and (d.decision_source<>'GEMINI_QA_V5' or exists(select 1 from private.qa_ai_commands c where c.policy_decision_id=d.id and c.state in('READY','COMMITTED')
  and c.source_hash=(private.qa_ai_source(c.need_id,c.need_revision,c.question_id)->>'sourceHash')))
 $guard$);
 definition:=pg_get_functiondef('private.ru4b_exact_materiality(uuid,uuid,integer,text)'::regprocedure);
 anchor:='and d.answer_fingerprint=p_answer_fingerprint';if position(anchor in definition)=0 then raise exception 'QA_MATERIALITY_READER_DRIFT';end if;
 execute replace(definition,anchor,anchor||$guard$
 and (d.decision_source<>'GEMINI_QA_V5' or exists(select 1 from private.qa_ai_commands c where c.materiality_decision_id=d.id and c.state in('READY','REJECTED','COMMITTED')
  and c.source_hash=(private.qa_ai_source(c.need_id,c.need_revision,c.question_id)->>'sourceHash')))
 $guard$);
end $bind_decision_readers$;

create function public.rpc_submit_classified_preselection_qa(p_expected_user_id uuid,p_type text,p_need_id uuid,p_need_revision integer,p_question_id uuid,p_text text,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a uuid:=auth.uid();c private.qa_ai_commands;h text;src jsonb;result jsonb;
begin
 if a is null or a is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 h:=private.qa_ai_input_hash(p_type,p_need_id,p_need_revision,p_question_id,encode(extensions.digest(convert_to(btrim(coalesce(p_text,'')),'UTF8'),'sha256'),'hex'));
 perform private.closure_assert_open(a);perform pg_advisory_xact_lock(hashtextextended('v5-qa:'||a::text||':'||p_client_request_id::text,0));
 -- Retained direct writer takes this before its Need/question locks.
 perform pg_advisory_xact_lock(hashtextextended(a::text||E'\n'||p_client_request_id::text,case when p_type='ASK' then 4412 else 4413 end));
 select * into c from private.qa_ai_commands where account_id=a and client_request_id=p_client_request_id for update;
 if not found or c.request_hash<>h then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';end if;
 if c.state='COMMITTED' then return private.qa_ai_status(a,p_need_id,p_client_request_id);end if;
 if c.state<>'READY' then return private.qa_ai_status(a,p_need_id,p_client_request_id);end if;
 perform private.qa_ai_assert_actor(a,c.need_id,c.need_revision,c.question_id,c.command_type);
 src:=private.qa_ai_source(c.need_id,c.need_revision,c.question_id);
 if src->>'sourceHash' is distinct from c.source_hash then update private.qa_ai_commands set state='STALE',updated_at=clock_timestamp() where id=c.id;
  return private.qa_ai_status(a,p_need_id,p_client_request_id);end if;
 -- Canonical RPC repeats all gates and emits its event in this transaction.
 begin
  if c.command_type='ASK' then result:=public.rpc_ru4b_ask_preselection_question(c.need_id,c.need_revision,p_text,p_client_request_id);
  else result:=public.rpc_ru4b_answer_preselection_question(c.question_id,p_text,p_client_request_id);end if;
 exception when others then
  if sqlerrm not in('QA_QUESTION_TOO_LONG','QA_ANSWER_TOO_LONG','QA_ACCOUNT_DAILY_LIMIT','QA_TASK_DAILY_LIMIT','QA_ASK_COOLDOWN','QA_DUPLICATE_QUESTION',
   'STALE_NEED_REVISION','QUESTION_STALE_AFTER_NEED_REVISION','QUESTION_NOT_ANSWERABLE','NEED_NOT_PUBLIC','INTERACTION_BLOCKED','ACTIVE_WORKER_REQUIRED') then raise;end if;
  update private.qa_ai_commands set state='REJECTED',safe_reason_codes=array[sqlerrm],updated_at=clock_timestamp() where id=c.id;
  return private.qa_ai_status(a,p_need_id,p_client_request_id);
 end;
 update private.qa_ai_commands set state='COMMITTED',receipt=result,updated_at=clock_timestamp() where id=c.id;
 return private.qa_ai_status(a,p_need_id,p_client_request_id);
end $f$;

revoke all on function private.qa_ai_input_hash(text,uuid,integer,uuid,text),private.qa_ai_source(uuid,integer,uuid),private.qa_ai_status(uuid,uuid,uuid),private.qa_ai_assert_actor(uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.rpc_read_qa_classification(uuid,uuid,uuid),public.rpc_cancel_qa_classification(uuid,text,uuid,integer,uuid,text,uuid),
 public.rpc_submit_classified_preselection_qa(uuid,text,uuid,integer,uuid,text,uuid),public.rpc_claim_qa_classification_service(uuid,text,uuid,integer,uuid,text,uuid),
 public.rpc_dispatch_qa_classification_service(uuid,uuid,uuid,uuid),public.rpc_complete_qa_classification_service(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rpc_read_qa_classification(uuid,uuid,uuid),public.rpc_cancel_qa_classification(uuid,text,uuid,integer,uuid,text,uuid),public.rpc_submit_classified_preselection_qa(uuid,text,uuid,integer,uuid,text,uuid) to authenticated;
grant execute on function public.rpc_claim_qa_classification_service(uuid,text,uuid,integer,uuid,text,uuid),public.rpc_dispatch_qa_classification_service(uuid,uuid,uuid,uuid),public.rpc_complete_qa_classification_service(uuid,uuid,uuid,uuid,jsonb) to service_role;
-- Keep unknown producer work in the existing closure barrier. The owner may
-- explicitly cancel/fence it; timeout alone never means quiescence.
do $closure_producer$
declare definition text;anchor text;
begin
 definition:=pg_get_functiondef('private.closure_blockers_v5(uuid)'::regprocedure);
 anchor:='or exists(select 1 from private.worker_ai_turns where account_id=a and state=''PROCESSING'')';
 if position(anchor in definition)=0 then raise exception 'QA_CLOSURE_PREDECESSOR_DRIFT';end if;
 execute replace(definition,anchor,anchor||E'\n or exists(select 1 from private.qa_ai_commands where account_id=a and state=''PROCESSING'')');
end $closure_producer$;
-- Existing metadata class; this activates neither retention nor a legal policy.
update private.closure_dataset_catalog_v5 set relations=array_append(relations,'private.qa_ai_commands') where data_class='COMMAND_LEDGERS';
update private.closure_source_v5 set sha256=private.closure_source_digest_v5() where singleton;
notify pgrst,'reload schema';commit;
