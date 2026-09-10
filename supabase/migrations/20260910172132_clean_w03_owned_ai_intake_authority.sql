-- W03 owned intake command receipts. Existing AI facts and DRAFT writers remain owners.
-- Technical attempt deadlines are not legal retention policy. No content/policy is seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- PREDECESSOR_BODY_GUARDS (generated from exact preceding source before freeze).
-- EXACT_BODY_GUARDS_START
do $body_pre$ begin
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_open_need_conversation_v2()')) is distinct from '666dfd22350499b54c3402b1c59e7bf1' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='public.rpc_ai_open_need_conversation_v2()';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)')) is distinct from '4c0c5c2a0b1894edf5cec19acd404516' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)')) is distinct from '4badd267bc5a25417651e842ae02583a' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_save_need_draft_from_review(uuid,uuid,text)')) is distinct from '39666a26707701d0f142bcdd4f926ef3' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='public.rpc_save_need_draft_from_review(uuid,uuid,text)';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_need_review_v2(uuid)')) is distinct from '1e6b3f195bb47e09a7bb7887f087b9cd' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='public.rpc_ai_need_review_v2(uuid)';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.retention_ai_source_ready()')) is distinct from 'f5339ad7d679c6f00c2f41f630bcec2f' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='private.retention_ai_source_ready()';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.guard_retention_ai_origin()')) is distinct from 'bd6a0fdc6c3dbb96844424dd7714e01a' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='private.guard_retention_ai_origin()';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.guard_retention_ai_child()')) is distinct from 'a4ccc5f48bdcca189510405e297c5ef3' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='private.guard_retention_ai_child()';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_confirm_fact(uuid)')) is distinct from '35e50ca2b24974eb67ce9b4f95877a8a' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='public.rpc_ai_confirm_fact(uuid)';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_correct_fact_v2(uuid,jsonb,text)')) is distinct from '7089c169bb62c64ff7687e9c25ff59cf' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='public.rpc_ai_correct_fact_v2(uuid,jsonb,text)';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_correct_fact(uuid,text)')) is distinct from 'feace031221c8e7c3a63614753891640' then raise exception 'W03_PREDECESSOR_BODY_DRIFT' using detail='public.rpc_ai_correct_fact(uuid,text)';end if;
end $body_pre$;
-- EXACT_BODY_GUARDS_END
do $pre$ begin
 if to_regprocedure('private.retention_ai_candidate(uuid)') is null
 or not exists(select 1 from pg_attribute where attrelid='public.ai_conversations'::regclass and attname='retention_unbound_origin' and not attisdropped)
 then raise exception 'W03_SOURCE105_REQUIRED';end if;
 if not has_function_privilege('service_role','public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)','EXECUTE')
 or not has_function_privilege('service_role','public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)','EXECUTE')
 or has_table_privilege('authenticated','public.ai_conversations','UPDATE')
 then raise exception 'W03_PREDECESSOR_ACL_DRIFT';end if;
end $pre$;
create temporary table w03_prior_acl on commit drop as
 select oid,proacl from pg_proc where pronamespace in('public'::regnamespace,'private'::regnamespace);

-- Hashes, identifiers and receipts only. No prompt, response prose or secrets.
-- Deliberately no parent FK: P3's reviewed child topology is unchanged. Every
-- access rechecks the existing owned parent; a deleted parent cannot be revived.
create table private.ai_need_open_commands(
 account_id uuid not null,client_request_id uuid not null,conversation_id uuid not null unique,
 created_at timestamptz not null default clock_timestamp(),primary key(account_id,client_request_id)
);
create table private.ai_need_turn_commands(
 account_id uuid not null,client_request_id uuid not null,conversation_id uuid not null,
 turn_id uuid not null unique default gen_random_uuid(),request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),
 state text not null check(state in('PROCESSING','SUCCEEDED','FAILED')),
 context_hash text null check(context_hash is null or context_hash~'^[0-9a-f]{64}$'),
 attempt_id uuid null,lease_expires_at timestamptz null,receipt jsonb null,
 attempt_times timestamptz[] not null default '{}'::timestamptz[] check(cardinality(attempt_times)<=6),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 primary key(account_id,client_request_id),
 check((state='SUCCEEDED')=(receipt is not null)),
 check(receipt is null or (jsonb_typeof(receipt)='object' and octet_length(receipt::text)<=4096)),
 check(state<>'PROCESSING' or (attempt_id is not null and lease_expires_at is not null and context_hash is not null))
);
create index ai_need_turn_commands_conversation_idx on private.ai_need_turn_commands(conversation_id,state,lease_expires_at);
alter table private.ai_need_open_commands enable row level security;
alter table private.ai_need_open_commands force row level security;
alter table private.ai_need_turn_commands enable row level security;
alter table private.ai_need_turn_commands force row level security;
revoke all on table private.ai_need_open_commands,private.ai_need_turn_commands from public,anon,authenticated,service_role;
comment on table private.ai_need_turn_commands is
 'W03 persist-once receipt ledger, not a second conversation/fact model. Metadata retention requires separately reviewed policy; no automatic purge duration is invented.';

create function private.ai_need_turn_context(p_conversation_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;history jsonb;facts jsonb;provider_facts jsonb;binding jsonb;material jsonb;
begin
 select * into c from public.ai_conversations where id=p_conversation_id;
 if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.sequence_no),'[]'::jsonb) into history from
  (select id,role,body,safety,sequence_no from public.ai_messages where conversation_id=c.id order by sequence_no desc limit 40) m;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'fact_key',f.fact_key,'fact_value',f.fact_value,
  'value_type',f.value_type,'display_value',f.display_value,'fact_schema_version',f.fact_schema_version,
  'status',f.status,'source',f.source,'created_at',f.created_at) order by f.created_at,f.id),'[]'::jsonb)
 into facts from public.ai_structured_facts f where f.conversation_id=c.id and f.superseded_at is null;
 if jsonb_array_length(facts)>64 then raise exception 'AI_CONTEXT_TOO_LARGE' using errcode='22001';end if;
 binding:=jsonb_build_object('conversationId',c.id,'accountId',c.account_id,'status',c.status,
  'boundNeedId',c.bound_need_id,'schema',c.fact_schema_version,'editBase',c.need_edit_base_fingerprint);
 material:=jsonb_build_object('binding',binding,'history',history,'facts',facts);
 if octet_length(material::text)>524288 then raise exception 'AI_CONTEXT_TOO_LARGE' using errcode='22001';end if;
 -- The full material hash fences manual edits, but the private witness never
 -- leaves SQL. Only the current AI-proposable registry reaches the provider.
 select coalesce(jsonb_agg(f.value-'id' order by f.ordinality),'[]'::jsonb) into provider_facts
 from jsonb_array_elements(facts) with ordinality f(value,ordinality)
 join private.need_fact_registry r on r.fact_key=f.value->>'fact_key'
 where f.value->>'fact_key'<>'need.resolved_location';
 return jsonb_build_object('sha256',encode(extensions.digest(convert_to(material::text,'UTF8'),'sha256'),'hex'),
  'context',jsonb_build_object('schemaVersion','NEED_FACT_V2',
  'history',(select coalesce(jsonb_agg(h.value-'id'-'safety' order by h.position),'[]'::jsonb) from jsonb_array_elements(history) with ordinality h(value,position)),
  'activeFacts',provider_facts));
end $f$;

create function private.ai_need_turn_status(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;t private.ai_need_turn_commands;ready boolean;now_at timestamptz;state_value text;
begin
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for share;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2'
 then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 if p_client_request_id is null then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';end if;
 now_at:=clock_timestamp();
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id;
 if found and t.conversation_id<>c.id then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 ready:=c.status='OPEN' and not exists(select 1 from private.ai_need_turn_commands x where x.conversation_id=c.id
  and x.client_request_id<>p_client_request_id and x.state='PROCESSING' and x.lease_expires_at>now_at);
 state_value:=case when t.turn_id is null then 'ABSENT'
  when t.state='PROCESSING' and (t.lease_expires_at<=now_at or c.status<>'OPEN') then 'FAILED' else t.state end;
 return jsonb_build_object('conversationId',c.id,'clientRequestId',p_client_request_id,'state',state_value,'turnId',t.turn_id,
  'retryAllowed',ready and state_value in('ABSENT','FAILED'),'receipt',t.receipt);
end $f$;

create function public.rpc_ai_open_need_conversation_owned_v2(p_client_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare actor uuid:=auth.uid();cid uuid;replayed boolean:=false;
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 if p_client_request_id is null then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||actor::text,0));
 select conversation_id into cid from private.ai_need_open_commands where account_id=actor and client_request_id=p_client_request_id;
 if found then
  replayed:=true;
  if not exists(select 1 from public.ai_conversations where id=cid and account_id=actor and purpose='NEED_INTAKE' and fact_schema_version='NEED_FACT_V2')
  then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 else
  if (select count(*) from private.ai_need_open_commands where account_id=actor and created_at>clock_timestamp()-interval '1 minute')>=6
  then raise exception 'AI_RATE_LIMITED' using errcode='P0001';end if;
  cid:=public.rpc_ai_open_need_conversation_v2();
  insert into private.ai_need_open_commands(account_id,client_request_id,conversation_id) values(actor,p_client_request_id,cid);
 end if;
 return jsonb_build_object('conversationId',cid,'clientRequestId',p_client_request_id,'authoritative',true,'idempotentReplay',replayed);
end $f$;

create function public.rpc_ai_read_need_turn_v2(p_conversation_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 return private.ai_need_turn_status(auth.uid(),p_conversation_id,p_client_request_id);
end $f$;

create function public.rpc_ai_claim_need_turn_v2_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_user_message text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;t private.ai_need_turn_commands;request_hash_value text;ctx jsonb;now_at timestamptz;attempt uuid;turn jsonb;
begin
 if p_account_id is null or p_conversation_id is null or p_client_request_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 if p_user_message is null or char_length(btrim(p_user_message)) not between 1 and 4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 now_at:=clock_timestamp();
 request_hash_value:=encode(extensions.digest(convert_to(jsonb_build_object('conversationId',c.id,'text',btrim(p_user_message))::text,'UTF8'),'sha256'),'hex');
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if found and (t.conversation_id<>c.id or t.request_hash<>request_hash_value) then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 turn:=private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);
 if not (turn->>'retryAllowed')::boolean then
  if t.turn_id is null then
   insert into private.ai_need_turn_commands(account_id,client_request_id,conversation_id,request_hash,state)
   values(p_account_id,p_client_request_id,c.id,request_hash_value,'FAILED');
   turn:=private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);
  end if;
  return jsonb_build_object('turn',turn,'claim',null);
 end if;
 if (select count(*) from private.ai_need_turn_commands x cross join lateral unnest(x.attempt_times) a(started)
  where x.account_id=p_account_id and a.started>now_at-interval '1 minute')>=6
 then raise exception 'AI_RATE_LIMITED' using errcode='P0001';end if;
 ctx:=private.ai_need_turn_context(c.id);attempt:=gen_random_uuid();
 if t.turn_id is null then
  insert into private.ai_need_turn_commands(account_id,client_request_id,conversation_id,request_hash,state,context_hash,attempt_id,lease_expires_at,attempt_times)
  values(p_account_id,p_client_request_id,c.id,request_hash_value,'PROCESSING',ctx->>'sha256',attempt,now_at+interval '90 seconds',array[now_at]);
 else
  update private.ai_need_turn_commands set state='PROCESSING',context_hash=ctx->>'sha256',attempt_id=attempt,
   lease_expires_at=now_at+interval '90 seconds',updated_at=now_at,
   attempt_times=array(select x from unnest(attempt_times) x where x>now_at-interval '1 minute')||array[now_at]
  where account_id=p_account_id and client_request_id=p_client_request_id;
 end if;
 return jsonb_build_object('turn',private.ai_need_turn_status(p_account_id,c.id,p_client_request_id),
  'claim',jsonb_build_object('attemptId',attempt,'leaseExpiresAt',now_at+interval '90 seconds','context',ctx->'context'));
end $f$;

create function public.rpc_ai_complete_need_turn_v2_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,
 p_user_message text,p_assistant_message text,p_safety text,p_proposals jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;t private.ai_need_turn_commands;raw jsonb;receipt_value jsonb;hash_value text;now_at timestamptz;
begin
 if p_account_id is null or p_conversation_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 hash_value:=encode(extensions.digest(convert_to(jsonb_build_object('conversationId',c.id,'text',btrim(p_user_message))::text,'UTF8'),'sha256'),'hex');
 if not found or t.conversation_id<>c.id or t.request_hash<>hash_value then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 if t.state='SUCCEEDED' then return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);end if;
 if t.state<>'PROCESSING' or t.attempt_id<>p_attempt_id then return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);end if;
 now_at:=clock_timestamp();
 if c.status<>'OPEN' or t.lease_expires_at<=now_at or t.context_hash is distinct from (private.ai_need_turn_context(c.id)->>'sha256') then
  update private.ai_need_turn_commands set state='FAILED',updated_at=now_at where account_id=p_account_id and client_request_id=p_client_request_id;
  return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);
 end if;
 -- Existing V2 writer owns proposal validation, supersession, provenance and messages.
 raw:=public.rpc_ai_apply_interview_turn_v2_service(p_account_id,c.id,p_user_message,p_assistant_message,p_safety,p_proposals);
 receipt_value:=jsonb_build_object('userMessageId',raw->'userMessageId','assistantMessageId',raw->'assistantMessageId',
  'proposedCount',raw->'proposedCount','safety',raw->'safety','schemaVersion',raw->'schemaVersion','authoritative',raw->'authoritative');
 if raw->>'conversationId' is distinct from c.id::text or raw->>'schemaVersion' is distinct from 'NEED_FACT_V2'
  or raw->'authoritative' is distinct from 'true'::jsonb or raw->>'userMessageId' is null or raw->>'assistantMessageId' is null
  or (raw->>'proposedCount')::integer not between 0 and 12
 then raise exception 'AI_TURN_RECEIPT_INVALID' using errcode='P0001';end if;
 update private.ai_need_turn_commands set state='SUCCEEDED',receipt=receipt_value,updated_at=clock_timestamp()
 where account_id=p_account_id and client_request_id=p_client_request_id;
 return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);
end $f$;

create function public.rpc_ai_fail_need_turn_v2_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if p_account_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 perform 1 from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 update private.ai_need_turn_commands set state='FAILED',updated_at=clock_timestamp()
 where account_id=p_account_id and client_request_id=p_client_request_id and conversation_id=p_conversation_id
 and state='PROCESSING' and attempt_id=p_attempt_id;
 return private.ai_need_turn_status(p_account_id,p_conversation_id,p_client_request_id);
end $f$;

create function public.rpc_ai_abandon_need_conversation_v2(p_conversation_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare actor uuid:=auth.uid();c public.ai_conversations;replayed boolean;
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||actor::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=actor for update;
 if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 if c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' or c.bound_need_id is not null
 or c.need_edit_base_fingerprint is not null or c.status not in('OPEN','ABANDONED')
 then raise exception 'CONVERSATION_NOT_ABANDONABLE' using errcode='P0001';end if;
 replayed:=c.status='ABANDONED';
 if not replayed then
  update public.ai_conversations set status='ABANDONED' where id=c.id;
  update private.ai_need_turn_commands set state='FAILED',updated_at=clock_timestamp() where conversation_id=c.id and state='PROCESSING';
 end if;
 return jsonb_build_object('conversationId',c.id,'status','ABANDONED','authoritative',true,'idempotentReplay',replayed);
end $f$;

-- The old legacy writer predates schemaVersion and can otherwise append an
-- empty-proposal V2 turn. Keep its implementation, admit only its original schema.
create function public.rpc_ai_apply_legacy_need_turn_service(p_account_id uuid,p_conversation_id uuid,
 p_user_message text,p_assistant_message text,p_safety text,p_proposals jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;
begin
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'LEGACY_TEXT_V1' or c.status<>'OPEN'
 then raise exception 'LEGACY_CONVERSATION_REQUIRED' using errcode='P0001';end if;
 return public.rpc_ai_apply_interview_turn_service(p_account_id,p_conversation_id,p_user_message,p_assistant_message,p_safety,p_proposals);
end $f$;

-- W03_REVIEW_GUARD_START
create or replace function public.rpc_save_need_draft_from_review(
  p_conversation_id uuid,
  p_requester_profile_id uuid,
  p_client_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_conv public.ai_conversations%rowtype;
  v_profile public.app_profiles%rowtype;
  v_facts jsonb;
  v_snapshot jsonb;
  v_missing text[];
  v_hash text;
  v_existing private.need_draft_save_commands%rowtype;
  v_need_id uuid;
  v_result jsonb;
  v_title text;
  v_description text;
  v_category text;
  v_mode text;
  v_price integer;
  v_schedule_kind text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_slots integer;
  v_skills text[];
  v_tools text[];
  v_vehicles text[];
  v_licenses text[];
  v_min_exp integer;
  v_verified boolean;
  v_photos text[];
  v_conditions text[];
  v_geo jsonb;
  v_exec_mode text;
  v_start jsonb;
  v_service jsonb;
  v_city text;
  v_area text;
  v_exact_address text;
  v_access_notes text;
  v_key text;
  v_value jsonb;
  v_safety text;
  v_country text; v_timezone text; v_region_token text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_conversation_id is null or p_requester_profile_id is null then raise exception 'DRAFT_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_client_request_id)),0)<8 or char_length(btrim(p_client_request_id))>200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id
   for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if v_conv.fact_schema_version<>'NEED_FACT_V2' then raise exception 'LEGACY_CONVERSATION_NOT_CANONICAL_SAVE_ELIGIBLE' using errcode='P0001'; end if;

  select * into v_profile
    from public.app_profiles
   where id=p_requester_profile_id
   for share;
  if not found or v_profile.account_id<>v_uid or v_profile.kind<>'REQUESTER' or v_profile.profile_status<>'ACTIVE' then
    raise exception 'REQUESTER_PROFILE_NOT_READY' using errcode='42501';
  end if;

  if exists (
    select 1 from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version<>'NEED_FACT_V2'
  ) then
    raise exception 'MIXED_SCHEMA_CONVERSATION_NOT_SAVE_ELIGIBLE' using errcode='P0001';
  end if;

  for v_key,v_value in
    select fact_key,fact_value
      from public.ai_structured_facts
     where conversation_id=p_conversation_id
       and superseded_at is null
       and fact_schema_version='NEED_FACT_V2'
       and status='CONFIRMED'
  loop
    perform private.validate_need_v2_fact(v_key,v_value);
  end loop;

  select coalesce(jsonb_object_agg(fact_key,fact_value),'{}'::jsonb)
    into v_facts
    from public.ai_structured_facts
   where conversation_id=p_conversation_id
     and superseded_at is null
     and fact_schema_version='NEED_FACT_V2'
     and status='CONFIRMED';

  select array_agg(r.fact_key order by r.fact_key)
    into v_missing
    from private.need_fact_registry r
   where r.required_for_draft
     and not (v_facts ? r.fact_key);

  if cardinality(coalesce(v_missing,'{}'::text[]))>0 then
    raise exception 'REQUIRED_CONFIRMED_FACTS_MISSING'
      using errcode='P0001',detail=array_to_string(v_missing,',');
  end if;

  v_title:=v_facts->>'need.title';
  v_description:=v_facts->>'need.description';
  v_category:=v_facts->>'need.category';
  v_mode:=v_facts->>'need.price_mode';
  if v_facts ? 'need.price_rsd' then v_price:=(v_facts->>'need.price_rsd')::integer; end if;
  if v_mode='MY_PRICE' and v_price is null then raise exception 'MY_PRICE_AMOUNT_REQUIRED' using errcode='P0001'; end if;
  if v_mode<>'MY_PRICE' then v_price:=null; end if;

  v_schedule_kind:=v_facts->>'need.schedule_kind';
  if v_facts ? 'need.starts_at' then v_starts_at:=(v_facts->>'need.starts_at')::timestamptz; end if;
  if v_facts ? 'need.ends_at' then v_ends_at:=(v_facts->>'need.ends_at')::timestamptz; end if;
  if v_schedule_kind='FIXED_WINDOW' and (v_starts_at is null or v_ends_at is null or v_ends_at<=v_starts_at) then
    raise exception 'FIXED_WINDOW_BOUNDS_REQUIRED' using errcode='P0001';
  end if;

  v_slots:=(v_facts->>'need.people_needed')::integer;

  select coalesce(array_agg(value),'{}'::text[]) into v_skills from jsonb_array_elements_text(coalesce(v_facts->'need.required_skills','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_tools from jsonb_array_elements_text(coalesce(v_facts->'need.required_tools','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_vehicles from jsonb_array_elements_text(coalesce(v_facts->'need.required_vehicles','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_licenses from jsonb_array_elements_text(coalesce(v_facts->'need.required_licenses','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_photos from jsonb_array_elements_text(coalesce(v_facts->'need.public_photo_paths','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_conditions from jsonb_array_elements_text(coalesce(v_facts->'need.critical_conditions','[]'::jsonb));

  if v_facts ? 'need.minimum_experience_years' then v_min_exp:=(v_facts->>'need.minimum_experience_years')::integer; end if;
  v_verified:=case when v_facts ? 'need.verified_identity_required' then (v_facts->>'need.verified_identity_required')::boolean else false end;

  v_country:=private.require_location_country(v_facts->'need.task_country_code');
  select default_timezone into v_timezone from private.location_market_configs where country_code=v_country;
  v_geo:=v_facts->'need.task_geography';
  v_exec_mode:=v_geo->>'mode';
  v_start:=coalesce(v_geo->'start','null'::jsonb);
  v_service:=coalesce(v_geo->'serviceArea','null'::jsonb);
  v_city:=coalesce(nullif(btrim(v_start->>'city'),''),nullif(btrim(v_service->>'city'),''));
  v_area:=coalesce(nullif(btrim(v_start->>'area'),''),nullif(btrim(v_service->>'area'),''));
  if v_exec_mode='REMOTE' then
    v_city:=''; v_area:='';
  end if;

  if v_facts ? 'need.exact_address' then v_exact_address:=v_facts->>'need.exact_address'; end if;
  if v_facts ? 'need.access_notes' then v_access_notes:=v_facts->>'need.access_notes'; end if;

  v_snapshot:=jsonb_build_object(
    'conversationId',p_conversation_id,
    'requesterProfileId',p_requester_profile_id,
    'confirmedFacts',v_facts
  );
  v_hash:=encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex');

  select * into v_existing
    from private.need_draft_save_commands
   where account_id=v_uid
     and client_request_id=btrim(p_client_request_id)
   for update;

  if found then
    if v_existing.request_hash<>v_hash then
      raise exception 'CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT' using errcode='22023';
    end if;
    return v_existing.result;
  end if;

  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;
  if v_conv.bound_need_id is not null then raise exception 'CONVERSATION_ALREADY_BOUND' using errcode='P0001'; end if;

  if exists(select 1 from public.ai_structured_facts where conversation_id=p_conversation_id
    and superseded_at is null and status<>'CONFIRMED') then
    raise exception 'EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION' using errcode='P0001';
  end if;

  -- Successful semantic-command replay above remains an acknowledgment only.
  -- For every new DRAFT, recheck safety under the same conversation lock used
  -- by the service writer; a prior committed BLOCK cannot race past this gate.
  -- Ignore null/unsupported rows so they cannot clear an earlier BLOCK.
  -- No supported decision retains the existing conservative REVIEW fallback.
  select coalesce((
    select m.safety from public.ai_messages m
     where m.conversation_id=p_conversation_id
       and m.role='ASSISTANT'
       and m.safety in ('ALLOW','CLARIFY','REVIEW','BLOCK')
     order by m.sequence_no desc
     limit 1
  ),'REVIEW') into v_safety;
  if v_safety='BLOCK' then
    raise exception 'AI_NEED_DRAFT_BLOCKED' using errcode='P0001';
  end if;

  v_region_token:=current_setting('uskoci.need_region',true);
  perform set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(
    requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,schedule_kind,starts_at,ends_at,required_slots,
    mode,requester_price_rsd,required_skills,required_tools,required_vehicles,
    required_licenses,verified_identity_required,minimum_experience_years,
    execution_location_mode,public_photo_paths,task_country_code,task_timezone
  ) values (
    v_uid,p_requester_profile_id,'DRAFT',v_title,v_description,v_category,
    coalesce(v_city,''),coalesce(v_area,''),v_schedule_kind,v_starts_at,v_ends_at,v_slots,
    v_mode,v_price,v_skills,v_tools,v_vehicles,v_licenses,v_verified,v_min_exp,
    v_exec_mode,v_photos,v_country,v_timezone
  )
  returning id into v_need_id;
  perform set_config('uskoci.need_region',coalesce(v_region_token,''),true);

  insert into public.need_geography(need_id,public_topology)
  values(v_need_id,v_geo);

  if v_exact_address is not null or v_access_notes is not null then
    insert into public.need_sensitive(need_id,exact_address,access_notes)
    values(v_need_id,coalesce(v_exact_address,''),coalesce(v_access_notes,''));
  end if;

  perform private.materialize_resolved_location(v_need_id,p_conversation_id);

  if cardinality(v_conditions)>0 then
    insert into public.need_requirement_details(need_id,critical_conditions)
    values(v_need_id,v_conditions);
  end if;

  update public.ai_structured_facts
     set subject_need_id=v_need_id
   where conversation_id=p_conversation_id
     and fact_schema_version='NEED_FACT_V2';

  update public.ai_conversations
     set bound_need_id=v_need_id,status='COMPLETED',completed_at=statement_timestamp()
   where id=p_conversation_id;

  v_result:=jsonb_build_object(
    'needId',v_need_id,
    'status','DRAFT',
    'revision',1,
    'conversationId',p_conversation_id,
    'authoritative',true
  );

  insert into private.need_draft_save_commands(
    account_id,client_request_id,request_hash,conversation_id,requester_profile_id,need_id,result
  ) values (
    v_uid,btrim(p_client_request_id),v_hash,p_conversation_id,p_requester_profile_id,v_need_id,v_result
  );

  return v_result;
end
$function$;
-- W03_REVIEW_GUARD_END

-- W03_HUMAN_LOCK_ORDER_START
create or replace function public.rpc_ai_confirm_fact(p_fact_id uuid)
returns uuid language plpgsql security definer set search_path to 'pg_catalog'
as $function$
declare v_uid uuid:=auth.uid(); v_fact public.ai_structured_facts%rowtype; v_conv public.ai_conversations%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into v_fact from public.ai_structured_facts where id=p_fact_id;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_fact.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  select * into v_conv from public.ai_conversations where id=v_fact.conversation_id for update;
  if not found or v_conv.account_id<>v_uid then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_fact from public.ai_structured_facts where id=p_fact_id and conversation_id=v_conv.id for update;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_fact.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_fact.fact_key='need.resolved_location' then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;
  if v_fact.superseded_at is not null then raise exception 'SUPERSEDED' using errcode='P0001'; end if;

  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;
  if v_fact.status='CONFIRMED' then
    if v_fact.confirmed_at is null or v_fact.confirmed_by_user_id is null then raise exception 'CONFIRMED_PROVENANCE_INVALID' using errcode='P0001'; end if;
    return p_fact_id;
  end if;
  update public.ai_structured_facts set status='CONFIRMED',confirmed_at=statement_timestamp(),confirmed_by_user_id=v_uid where id=p_fact_id;
  return p_fact_id;
end;
$function$;

create or replace function public.rpc_ai_correct_fact_v2(
  p_fact_id uuid,
  p_value jsonb,
  p_display_value text
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_old public.ai_structured_facts%rowtype;
  v_conv public.ai_conversations%rowtype;
  v_display text:=nullif(btrim(p_display_value),'');
  v_new_id uuid:=extensions.gen_random_uuid();
  v_previous_ids uuid[];
  v_value_type text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if v_display is null or char_length(v_display)>1000 then raise exception 'V2_FACT_DISPLAY_INVALID' using errcode='22023'; end if;

  select * into v_old from public.ai_structured_facts where id=p_fact_id;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  select * into v_conv from public.ai_conversations where id=v_old.conversation_id for update;
  if not found or v_conv.account_id<>v_uid then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_old from public.ai_structured_facts where id=p_fact_id and conversation_id=v_conv.id for update;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_old.fact_key='need.resolved_location' then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;
  if v_old.superseded_at is not null then raise exception 'SUPERSEDED' using errcode='P0001'; end if;
  if v_old.fact_schema_version<>'NEED_FACT_V2' then raise exception 'V2_FACT_REQUIRED' using errcode='P0001'; end if;
  if v_old.scope<>'NEED_DRAFT' then raise exception 'FACT_SCOPE_NOT_EDITABLE' using errcode='P0001'; end if;


  if v_conv.purpose<>'NEED_INTAKE' or v_conv.status<>'OPEN' or v_conv.fact_schema_version<>'NEED_FACT_V2' then
    raise exception 'CONVERSATION_NOT_EDITABLE' using errcode='P0001';
  end if;

  select value_type into v_value_type from private.need_fact_registry where fact_key=v_old.fact_key;
  if not found then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023'; end if;
  perform private.validate_need_v2_fact(v_old.fact_key,p_value);

  with superseded as (
    update public.ai_structured_facts
       set superseded_at=statement_timestamp(),superseded_by=null
     where conversation_id=v_old.conversation_id
       and fact_key=v_old.fact_key
       and superseded_at is null
     returning id
  )
  select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

  insert into public.ai_structured_facts(
    id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
    confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,
    fact_schema_version,value_type,display_value
  ) values (
    v_new_id,v_uid,v_old.conversation_id,v_old.subject_need_id,v_old.fact_key,p_value,
    'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,null,v_uid,statement_timestamp(),
    'NEED_FACT_V2',v_value_type,v_display
  );

  if cardinality(v_previous_ids)>0 then
    update public.ai_structured_facts set superseded_by=v_new_id where id=any(v_previous_ids);
  end if;

  return v_new_id;
end
$function$;

create or replace function public.rpc_ai_correct_fact(p_fact_id uuid,p_value text)
returns uuid language plpgsql security definer set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid(); v_old public.ai_structured_facts%rowtype; v_conv public.ai_conversations%rowtype;
  v_value text:=nullif(btrim(p_value),''); v_new_id uuid:=extensions.gen_random_uuid(); v_previous_ids uuid[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if v_value is null or char_length(v_value)>2000 then raise exception 'FACT_VALUE_INVALID' using errcode='22023'; end if;
  select * into v_old from public.ai_structured_facts where id=p_fact_id;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  select * into v_conv from public.ai_conversations where id=v_old.conversation_id for update;
  if not found or v_conv.account_id<>v_uid then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_old from public.ai_structured_facts where id=p_fact_id and conversation_id=v_conv.id for update;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if v_old.superseded_at is not null then raise exception 'SUPERSEDED' using errcode='P0001'; end if;
  if v_old.scope<>'NEED_DRAFT' then raise exception 'FACT_SCOPE_NOT_EDITABLE' using errcode='P0001'; end if;

  if v_conv.purpose<>'NEED_INTAKE' or v_conv.status<>'OPEN' then raise exception 'CONVERSATION_NOT_EDITABLE' using errcode='P0001'; end if;

  with superseded as (
    update public.ai_structured_facts set superseded_at=statement_timestamp(),superseded_by=null
     where conversation_id=v_old.conversation_id and fact_key=v_old.fact_key and superseded_at is null
     returning id
  ) select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

  insert into public.ai_structured_facts(
    id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at
  ) values (
    v_new_id,v_uid,v_old.conversation_id,v_old.subject_need_id,v_old.fact_key,to_jsonb(v_value),'CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',1,null,v_uid,statement_timestamp()
  );
  if cardinality(v_previous_ids)>0 then update public.ai_structured_facts set superseded_by=v_new_id where id=any(v_previous_ids); end if;
  return v_new_id;
end;
$function$;
-- W03_HUMAN_LOCK_ORDER_END

revoke all on function private.ai_need_turn_context(uuid),private.ai_need_turn_status(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.rpc_ai_open_need_conversation_owned_v2(uuid),public.rpc_ai_read_need_turn_v2(uuid,uuid),
 public.rpc_ai_abandon_need_conversation_v2(uuid),public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text),
 public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb),
 public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid),
 public.rpc_ai_apply_legacy_need_turn_service(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rpc_ai_open_need_conversation_owned_v2(uuid),public.rpc_ai_read_need_turn_v2(uuid,uuid),
 public.rpc_ai_abandon_need_conversation_v2(uuid) to authenticated;
grant execute on function public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text),
 public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb),
 public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid),
 public.rpc_ai_apply_legacy_need_turn_service(uuid,uuid,text,text,text,jsonb) to service_role;
-- Preserve the original materializer byte-for-byte, but remove the unclaimed
-- PostgREST bypass. Only owner-executed completion can invoke its private entry.
revoke all on function public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;

do $post$ begin
 if exists(select 1 from w03_prior_acl a join pg_proc p on p.oid=a.oid
  where a.oid not in('public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure,
  'public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)'::regprocedure) and p.proacl is distinct from a.proacl)
 then raise exception 'W03_UNRELATED_ACL_CHANGED';end if;
 if has_function_privilege('service_role','public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)','EXECUTE')
 or has_function_privilege('service_role','public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)','EXECUTE')
 or has_table_privilege('authenticated','private.ai_need_turn_commands','SELECT')
 then raise exception 'W03_AUTHORITY_EXPOSED';end if;
end $post$;
notify pgrst,'reload schema';
commit;
