-- PREPARED ONLY: no application or verification performed. Exact definition pins below
-- are from the parent's metadata-only live readback. Includes the isolated
-- technical closure roster transition; no policy duration or activation changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $pre$ begin
 if (select md5(pg_get_functiondef(oid)) from pg_proc where oid=to_regprocedure('public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)')) is distinct from '1b0ee1adeb41d9eed168b0aea4db934c' then raise exception 'LOCATION_AI_PREDECESSOR_DRIFT' using errcode='PT409',detail='public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)';end if;
 if (select md5(pg_get_functiondef(oid)) from pg_proc where oid=to_regprocedure('private.ai_need_turn_status(uuid,uuid,uuid)')) is distinct from 'f3fd671c15642b37aa8c9d7182dcb3df' then raise exception 'LOCATION_AI_PREDECESSOR_DRIFT' using errcode='PT409',detail='private.ai_need_turn_status(uuid,uuid,uuid)';end if;
 if (select md5(pg_get_functiondef(oid)) from pg_proc where oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)')) is distinct from 'ff2be465f91497787558d9d1a5cecdba' then raise exception 'LOCATION_AI_PREDECESSOR_DRIFT' using errcode='PT409',detail='public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)';end if;
 if (select md5(pg_get_functiondef(oid)) from pg_proc where oid=to_regprocedure('private.need_location_review_document(uuid)')) is distinct from '244eaa9446dbf43b36d0b8fa7dfa7837' then raise exception 'LOCATION_AI_PREDECESSOR_DRIFT' using errcode='PT409',detail='private.need_location_review_document(uuid)';end if;
 if to_regprocedure('private.ai_location_context_valid(jsonb)') is not null then raise exception 'LOCATION_AI_ALREADY_PRESENT' using errcode='PT409';end if;
 if to_regprocedure('private.ai_location_request_hash(uuid,text,jsonb)') is not null then raise exception 'LOCATION_AI_ALREADY_PRESENT' using errcode='PT409';end if;
 if to_regprocedure('private.ai_location_review_matches(uuid,jsonb)') is not null then raise exception 'LOCATION_AI_ALREADY_PRESENT' using errcode='PT409';end if;
 if to_regprocedure('private.ai_location_turn_document(uuid,uuid,uuid)') is not null then raise exception 'LOCATION_AI_ALREADY_PRESENT' using errcode='PT409';end if;
 if to_regprocedure('private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb)') is not null then raise exception 'LOCATION_AI_ALREADY_PRESENT' using errcode='PT409';end if;
 if to_regprocedure('public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb)') is not null then raise exception 'LOCATION_AI_ALREADY_PRESENT' using errcode='PT409';end if;
 if to_regprocedure('public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)') is not null then raise exception 'LOCATION_AI_ALREADY_PRESENT' using errcode='PT409';end if;
 if to_regprocedure('public.rpc_ai_read_need_location_turn_v1(uuid,uuid)') is not null then raise exception 'LOCATION_AI_ALREADY_PRESENT' using errcode='PT409';end if;
 if to_regprocedure('public.rpc_ai_read_need_location_turn_v1_service(uuid,uuid,uuid)') is not null then raise exception 'LOCATION_AI_ALREADY_PRESENT' using errcode='PT409';end if;
end $pre$;
-- AI-LOCATION-01: bounded technical inventory transition, no legal policy update.
-- Hold the existing closure rows still while this transaction checks and rebinds
-- the reviewed program. Nothing here executes erasure or retention work.
lock table private.closure_executions_v5,private.closure_source_v5,private.closure_erasure_source_v5 in share row exclusive mode;
create temporary table location_ai_cert_before(
 certified text,program text,source_def text,program_def text,ready_def text,ready_masked text,
 old_claim_acl text,old_status_acl text) on commit drop;
do $cert_pre$ declare ready text;begin
 if md5(pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure)) is distinct from '8a99d5e1246f5f6cfe07d3f927c2f3ac' then raise exception 'LOCATION_AI_CERT_BODY_DRIFT' using errcode='PT409',detail='private.closure_source_digest_v5';end if;
 if md5(pg_get_functiondef('private.closure_erasure_program_digest_v5()'::regprocedure)) is distinct from 'a98bd71c6457f54c8fec50affcfa3b7e' then raise exception 'LOCATION_AI_CERT_BODY_DRIFT' using errcode='PT409',detail='private.closure_erasure_program_digest_v5';end if;
 if md5(pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure)) is distinct from 'f8fb9f2e24f2432b302d7ee87c83a814' then raise exception 'LOCATION_AI_CERT_BODY_DRIFT' using errcode='PT409',detail='private.retention_ai_source_ready';end if;
 if md5(pg_get_functiondef('private.closure_erasure_binding_v5()'::regprocedure)) is distinct from '6c1b9fa576fcba9754f19be2ecdf0fb5' then raise exception 'LOCATION_AI_CERT_BODY_DRIFT' using errcode='PT409',detail='private.closure_erasure_binding_v5';end if;
 if private.closure_source_digest_v5() is distinct from '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431'
 or (select sha256 from private.closure_source_v5 where singleton) is distinct from '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431'
 or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431'
 or private.closure_erasure_program_digest_v5() is distinct from '2fe2edc126edc9a9b08b4e3cfce758ff928c99d377a0df3b04bd49961cc4a078'
 or private.retention_ai_source_ready() is distinct from true
 or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431'
 then raise exception 'LOCATION_AI_CERT_PREDECESSOR_DRIFT' using errcode='PT409';end if;
 if exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then raise exception 'LOCATION_AI_CLOSURE_INFLIGHT' using errcode='PT409';end if;
 select prosrc into strict ready from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if length(ready)-length(replace(ready,'0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431',''))<>64 then raise exception 'LOCATION_AI_READY_CONSTANT_DRIFT' using errcode='PT409';end if;
 insert into location_ai_cert_before values('0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431','2fe2edc126edc9a9b08b4e3cfce758ff928c99d377a0df3b04bd49961cc4a078',
 pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure),pg_get_functiondef('private.closure_erasure_program_digest_v5()'::regprocedure),
 pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure),md5(replace(ready,'0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431','<CERTIFIED>')),
 (select proacl::text from pg_proc where oid='public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)'::regprocedure),
 (select proacl::text from pg_proc where oid='private.ai_need_turn_status(uuid,uuid,uuid)'::regprocedure));
end $cert_pre$;
create function private.ai_location_context_valid(v jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $f$
declare p jsonb;a jsonb;
begin
 if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>40000
 or (select count(*) from jsonb_object_keys(v))<>9
 or not(v ?& array['version','promptToken','reviewRevision','slot','phase','question','query','proposal','alternatives'])
 or v->'version'<>'1'::jsonb
 or jsonb_typeof(v->'promptToken')<>'string' or v->>'promptToken'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 or jsonb_typeof(v->'reviewRevision')<>'string' or v->>'reviewRevision'!~'^[0-9a-f]{64}$'
 or jsonb_typeof(v->'slot')<>'string' or v->>'slot'!~'^(start|end|serviceArea|waypoints/([0-9]|1[0-9]))$'
 or jsonb_typeof(v->'phase') is distinct from 'string' or coalesce(v->>'phase','') not in('PROPOSAL','AMBIGUOUS','UNRESOLVED')
 or jsonb_typeof(v->'question')<>'string' or char_length(btrim(v->>'question')) not between 1 and 300
 or jsonb_typeof(v->'query')<>'string' or char_length(v->>'query')>1000
 or jsonb_typeof(v->'alternatives')<>'array' or jsonb_array_length(v->'alternatives')>20 then return false;end if;
 p:=v->'proposal';
 if (v->>'phase'='PROPOSAL') is distinct from (p<>'null'::jsonb) then return false;end if;
 if p<>'null'::jsonb and (jsonb_typeof(p)<>'object' or (select count(*) from jsonb_object_keys(p))<>2
 or not(p ?& array['id','label']) or jsonb_typeof(p->'id')<>'string'
 or p->>'id'!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 or jsonb_typeof(p->'label')<>'string' or char_length(btrim(p->>'label')) not between 1 and 1000) then return false;end if;
 if v->>'phase'='AMBIGUOUS' and jsonb_array_length(v->'alternatives')<2
 or v->>'phase'='UNRESOLVED' and jsonb_array_length(v->'alternatives')<>0 then return false;end if;
 for a in select value from jsonb_array_elements(v->'alternatives') loop
  if jsonb_typeof(a)<>'object' or (select count(*) from jsonb_object_keys(a))<>2 or not(a ?& array['id','label'])
  or jsonb_typeof(a->'id')<>'string' or char_length(btrim(a->>'id')) not between 1 and 160
  or jsonb_typeof(a->'label')<>'string' or char_length(btrim(a->>'label')) not between 1 and 1000 then return false;end if;
 end loop;
 return (select count(*)=count(distinct value->>'id') from jsonb_array_elements(v->'alternatives'));
exception when others then return false;
end $f$;

create function private.ai_location_request_hash(cid uuid,body text,ctx jsonb) returns text
language sql immutable set search_path=pg_catalog as $f$
 select encode(extensions.digest(convert_to(case when ctx is null
 then jsonb_build_object('conversationId',cid,'text',btrim(body))
 else jsonb_build_object('conversationId',cid,'text',btrim(body),'mode','locationReply','locationContext',ctx) end::text,'UTF8'),'sha256'),'hex');
$f$;

create function private.ai_location_review_matches(cid uuid,ctx jsonb) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare r jsonb;geo jsonb;s text;
begin
 r:=private.need_location_review_document(cid);geo:=r#>'{value,geography}';s:=ctx->>'slot';
 if r->>'revision' is distinct from ctx->>'reviewRevision' or r->'editable' is distinct from 'true'::jsonb then return false;end if;
 if s like 'waypoints/%' then
  return coalesce(jsonb_typeof(geo->'waypoints')='array' and (split_part(s,'/',2))::integer<jsonb_array_length(geo->'waypoints'),false);
 end if;
 return coalesce(geo ? s and geo->s<>'null'::jsonb,false);
end $f$;

create function private.ai_location_turn_document(aid uuid,cid uuid,rid uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare normal jsonb;binding jsonb;
begin
 normal:=private.ai_need_turn_status(aid,cid,rid);
 select receipt->'location' into binding from private.ai_need_turn_commands
 where account_id=aid and conversation_id=cid and client_request_id=rid and state='SUCCEEDED';
 return jsonb_build_object('turn',normal,'location',binding);
end $f$;

create function public.rpc_ai_read_need_location_turn_v1(p_conversation_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare aid uuid:=auth.uid();
begin
 if aid is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 return private.ai_location_turn_document(aid,p_conversation_id,p_client_request_id);
end $f$;

create function public.rpc_ai_read_need_location_turn_v1_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $f$
 select private.ai_location_turn_document(p_account_id,p_conversation_id,p_client_request_id);
$f$;

create or replace function private.ai_need_turn_status(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;t private.ai_need_turn_commands;ready boolean;state_value text;
begin
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for share;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2'
 then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 if p_client_request_id is null then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';end if;
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id;
 if found and t.conversation_id<>c.id then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 -- Expiry/abort is not proof that a provider request did not run. Only a known
 -- pre-dispatch failure is retryable, and every unresolved turn blocks successors.
 ready:=c.status='OPEN' and not exists(select 1 from private.ai_need_turn_commands x where x.conversation_id=c.id
  and x.client_request_id<>p_client_request_id and x.state='PROCESSING');
 state_value:=case when t.turn_id is null then 'ABSENT' else t.state end;
 return jsonb_build_object('conversationId',c.id,'clientRequestId',p_client_request_id,'state',state_value,'turnId',t.turn_id,
  'retryAllowed',ready and (state_value='ABSENT' or (state_value='FAILED' and not t.provider_dispatched and t.cancelled_at is null)),
  'receipt',t.receipt-'location');
end $f$;
create or replace function private.ai_claim_need_turn_context_v1(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_user_message text,p_location_context jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;t private.ai_need_turn_commands;request_hash_value text;ctx jsonb;now_at timestamptz;attempt uuid;turn jsonb;
begin
 if p_account_id is null or p_conversation_id is null or p_client_request_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 if p_user_message is null or char_length(btrim(p_user_message)) not between 1 and 4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023';end if;
 if p_location_context is not null and not private.ai_location_context_valid(p_location_context) then raise exception 'LOCATION_CONTEXT_INVALID' using errcode='PT409';end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 now_at:=clock_timestamp();
 request_hash_value:=private.ai_location_request_hash(c.id,p_user_message,p_location_context);
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if found and t.conversation_id<>c.id then raise exception 'AI_REQUEST_ID_REUSED' using errcode=case when p_location_context is null then '22023' else 'PT409' end;end if;
 if t.cancelled_at is not null then
  if t.request_hash<>repeat('0',64) and t.request_hash<>request_hash_value then raise exception 'AI_REQUEST_ID_REUSED' using errcode=case when p_location_context is null then '22023' else 'PT409' end;end if;
  return jsonb_build_object('turn',private.ai_need_turn_status(p_account_id,c.id,p_client_request_id),'claim',null);
 end if;
 if found and (t.conversation_id<>c.id or t.request_hash<>request_hash_value) then raise exception 'AI_REQUEST_ID_REUSED' using errcode=case when p_location_context is null then '22023' else 'PT409' end;end if;
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
 if p_location_context is not null and not private.ai_location_review_matches(c.id,p_location_context) then raise exception 'LOCATION_VERSION_CONFLICT' using errcode='PT409';end if;
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
create or replace function public.rpc_ai_claim_need_turn_v2_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_user_message text) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $f$
 select private.ai_claim_need_turn_context_v1(p_account_id,p_conversation_id,p_client_request_id,p_user_message,null);
$f$;
create function public.rpc_ai_claim_need_location_turn_v1_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_user_message text,p_location_context jsonb) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $f$
begin
 if p_location_context is null then raise exception 'LOCATION_CONTEXT_INVALID' using errcode='PT409';end if;
 return private.ai_claim_need_turn_context_v1(p_account_id,p_conversation_id,p_client_request_id,p_user_message,p_location_context);
end $f$;
create function public.rpc_ai_complete_need_location_turn_v1_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,
 p_user_message text,p_assistant_message text,p_safety text,p_proposals jsonb,p_location_context jsonb,p_location_action text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;t private.ai_need_turn_commands;raw jsonb;receipt_value jsonb;hash_value text;now_at timestamptz;
begin
 if p_account_id is null or p_conversation_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 if p_location_context is null or not private.ai_location_context_valid(p_location_context) or p_location_action is null or p_location_action not in('CONFIRM_DISPLAYED','CORRECT','CLARIFY','CONTINUE') then raise exception 'LOCATION_CONTEXT_INVALID' using errcode='PT409';end if;
 if p_location_action='CONFIRM_DISPLAYED' and (p_location_context->>'phase'<>'PROPOSAL' or p_location_context->'proposal'='null'::jsonb or p_proposals is distinct from '[]'::jsonb or p_safety is distinct from 'ALLOW') then raise exception 'LOCATION_CONFIRMATION_INVALID' using errcode='PT409';end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 hash_value:=private.ai_location_request_hash(c.id,p_user_message,p_location_context);
 if not found or t.conversation_id<>c.id or t.request_hash<>hash_value then raise exception 'AI_REQUEST_ID_REUSED' using errcode='PT409';end if;
 if t.state='SUCCEEDED' then return private.ai_location_turn_document(p_account_id,c.id,p_client_request_id);end if;
 if t.state<>'PROCESSING' or t.attempt_id<>p_attempt_id or not t.provider_dispatched or t.cancelled_at is not null then return private.ai_location_turn_document(p_account_id,c.id,p_client_request_id);end if;
 now_at:=clock_timestamp();
 if c.status<>'OPEN' or t.lease_expires_at<=now_at or not private.ai_location_review_matches(c.id,p_location_context) or t.context_hash is distinct from (private.ai_need_turn_context(c.id)->>'sha256') then
  update private.ai_need_turn_commands set state='FAILED',updated_at=now_at where account_id=p_account_id and client_request_id=p_client_request_id;
  return private.ai_location_turn_document(p_account_id,c.id,p_client_request_id);
 end if;
 -- Existing V2 writer owns proposal validation, supersession, provenance and messages.
 raw:=public.rpc_ai_apply_interview_turn_v2_service(p_account_id,c.id,p_user_message,p_assistant_message,p_safety,p_proposals);
 receipt_value:=jsonb_build_object('userMessageId',raw->'userMessageId','assistantMessageId',raw->'assistantMessageId',
  'proposedCount',raw->'proposedCount','safety',raw->'safety','schemaVersion',raw->'schemaVersion','authoritative',raw->'authoritative');
 if raw->>'conversationId' is distinct from c.id::text or raw->>'schemaVersion' is distinct from 'NEED_FACT_V2'
  or raw->'authoritative' is distinct from 'true'::jsonb or raw->>'userMessageId' is null or raw->>'assistantMessageId' is null
  or (raw->>'proposedCount')::integer not between 0 and 12
 then raise exception 'AI_TURN_RECEIPT_INVALID' using errcode='P0001';end if;
 receipt_value:=receipt_value||jsonb_build_object('location',jsonb_build_object('version',1,
  'promptToken',p_location_context->'promptToken','reviewRevision',p_location_context->'reviewRevision','slot',p_location_context->'slot',
  'proposalId',p_location_context#>'{proposal,id}','action',p_location_action));
 update private.ai_need_turn_commands set state='SUCCEEDED',receipt=receipt_value,updated_at=clock_timestamp()
 where account_id=p_account_id and client_request_id=p_client_request_id;
 return private.ai_location_turn_document(p_account_id,c.id,p_client_request_id);
end $f$;
revoke all on function private.ai_location_context_valid(jsonb),
 private.ai_location_request_hash(uuid,text,jsonb),
 private.ai_location_review_matches(uuid,jsonb),
 private.ai_location_turn_document(uuid,uuid,uuid),
 private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb),
 public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb),
 public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text),
 public.rpc_ai_read_need_location_turn_v1(uuid,uuid),
 public.rpc_ai_read_need_location_turn_v1_service(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb),
 public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text),
 public.rpc_ai_read_need_location_turn_v1_service(uuid,uuid,uuid) to service_role;
grant execute on function public.rpc_ai_read_need_location_turn_v1(uuid,uuid) to authenticated;

-- Extend only the two explicit function inventories: 9 new helpers/RPCs and 2 changed legacy functions.
CREATE OR REPLACE FUNCTION private.closure_source_digest_v5()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select encode(extensions.digest(convert_to(private.closure_schema_digest_v5_139()||':'||private.closure_erasure_program_digest_v5()||':'||private.agreement_invalidation_surface_v1()||':'||private.agreement_voice_surface_v1()||':'||string_agg(signature||':'||md5(p.prosrc),E'\n' order by signature),'UTF8'),'sha256'),'hex')
 from unnest(array['private.capture_agreement_media_v5(uuid,integer,boolean)','private.capture_case_media_v5(text,uuid,bigint,uuid,uuid,uuid,uuid)',
 'private.media_owner_protected_v5(uuid)','private.media_evidence_key_v5(uuid)','private.closure_blockers_v5(uuid)','private.resolve_media_snapshot_v5(uuid,jsonb)',
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
 'public.rpc_closure_api_guard()',
 'private.agreement_photo_key_v5(uuid)','private.agreement_photo_context_v5(uuid,uuid,integer,boolean)',
 'private.agreement_photo_document_v5(private.agreement_photo_uploads_v5)','private.agreement_photo_transfer_v5(private.agreement_photo_uploads_v5)',
 'private.agreement_photo_message_guard_v5()','private.agreement_photo_link_guard_v5()','private.agreement_photo_asset_guard_v5()','private.agreement_photo_storage_guard_v5()',
 'public.rpc_agreement_photo_upload_service_v5(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.rpc_agreement_photo_read_service_v5(uuid,uuid,uuid,uuid,uuid)',
 'public.rpc_send_agreement_photo_message_v5(uuid,uuid,integer,text,text,uuid[])','public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])','private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb)','private.closure_redaction_relations_v5()','private.closure_erasure_media_protected_v5(uuid,text)','private.closure_erasure_agreement_protected_v5(uuid)','private.closure_erasure_scope_author_v5(uuid,integer)','private.closure_erasure_exceptions_v5(uuid)','private.closure_redaction_scope_v5(text)','private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','private.closure_erasure_lock_v5(uuid)','private.closure_erasure_hard_blockers_v5(uuid)','private.closure_erasure_binding_v5()','private.closure_erasure_assert_current_v5(private.closure_executions_v5)','private.closure_erasure_progress_v5(private.closure_executions_v5)','private.closure_erasure_refresh_steps_v5(private.closure_executions_v5)','private.closure_auth_dispatched_v5(uuid)','private.closure_support_source_fence_v5(uuid,text,uuid)','public.rpc_redact_account_closure_step_service(uuid,uuid,uuid,uuid)','public.rpc_review_account_closure_execution(uuid)','public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)','public.rpc_claim_account_closure_action_service(uuid,uuid)','public.rpc_dispatch_account_closure_action_service(uuid,uuid,uuid,uuid)','public.rpc_complete_account_closure_action_service(uuid,uuid,uuid,uuid,text)','public.rpc_finalize_account_closure_service(uuid,uuid)','public.rpc_read_account_closure_execution(uuid,uuid)','public.rpc_list_account_closure_work_service(integer)','public.handle_uskoci_auth_user_updated()','private.closure_assert_current_v5(private.closure_executions_v5)',
 'public.rpc_agreement_invalidation_visible_v1(uuid)','private.agreement_message_invalidate_v1()',
 'private.agreement_invalidation_cleanup_v1()','private.agreement_invalidation_surface_v1()','private.agreement_voice_key_v1(uuid)','private.agreement_voice_context_v1(uuid,uuid,integer,boolean)','private.agreement_voice_document_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_transfer_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_message_guard_v1()','private.agreement_voice_link_guard_v1()','private.agreement_voice_asset_guard_v1()','private.agreement_voice_storage_guard_v1()','public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)','public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)','private.agreement_voice_surface_v1()','private.ai_location_context_valid(jsonb)','private.ai_location_request_hash(uuid,text,jsonb)','private.ai_location_review_matches(uuid,jsonb)','private.ai_location_turn_document(uuid,uuid,uuid)','private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb)','public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb)','public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)','public.rpc_ai_read_need_location_turn_v1(uuid,uuid)','public.rpc_ai_read_need_location_turn_v1_service(uuid,uuid,uuid)','public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)','private.ai_need_turn_status(uuid,uuid,uuid)']) signature
 join pg_proc p on p.oid=to_regprocedure(signature) having count(*)=99
$function$;
CREATE OR REPLACE FUNCTION private.closure_erasure_program_digest_v5()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select encode(extensions.digest(convert_to(jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'source',md5(p.prosrc),'owner',p.proowner,'acl',p.proacl::text,'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'language',p.prolang,'config',p.proconfig,'args',p.proargtypes::text,'result',p.prorettype) order by p.oid::regprocedure::text)
 from pg_proc p where p.oid in(select to_regprocedure(x) from unnest('{"private.capture_agreement_media_v5(uuid,integer,boolean)","private.capture_case_media_v5(text,uuid,bigint,uuid,uuid,uuid,uuid)",private.media_owner_protected_v5(uuid),private.media_evidence_key_v5(uuid),private.closure_blockers_v5(uuid),"private.resolve_media_snapshot_v5(uuid,jsonb)",private.support_auth_v5(uuid),private.support_operator_key_v5(),"private.support_command_key_v5(uuid,uuid)","private.support_safe_exit_v5(uuid,uuid)",private.support_operator_revision_v5(uuid),private.support_immutable_v5(),private.support_case_guard_v5(),"private.support_command_document_v5(uuid,uuid)","public.rpc_support_read_command_v5(uuid,uuid)","public.rpc_support_cancel_command_v5(uuid,uuid)","private.support_reference_v5(uuid,jsonb)","private.support_capture_media_v5(uuid,integer,jsonb)","private.support_safety_case_v5(private.safety_reports,boolean)",private.support_safety_capture_v5(),private.support_safety_closure_v5(),private.support_event_document_v5(private.support_events_v5),private.support_decision_document_v5(private.support_decisions_v5),"private.support_allowed_actions_v5(private.support_cases_v5,uuid,integer)","public.rpc_support_set_operator_service_v5(uuid,boolean,integer,uuid)","public.rpc_support_submit_v5(uuid,uuid,text,uuid,integer,text)",public.rpc_support_capabilities_v5(uuid),"public.rpc_support_inbox_v5(uuid,text,text)","public.rpc_support_detail_v5(uuid,uuid,text)","public.rpc_support_mark_read_v5(uuid,uuid,text)","public.rpc_support_find_context_v5(uuid,text,uuid)","public.rpc_support_media_service_v5(uuid,uuid,uuid,uuid)",public.rpc_closure_api_guard(),private.agreement_photo_key_v5(uuid),"private.agreement_photo_context_v5(uuid,uuid,integer,boolean)",private.agreement_photo_document_v5(private.agreement_photo_uploads_v5),private.agreement_photo_transfer_v5(private.agreement_photo_uploads_v5),private.agreement_photo_message_guard_v5(),private.agreement_photo_link_guard_v5(),private.agreement_photo_asset_guard_v5(),private.agreement_photo_storage_guard_v5(),"public.rpc_agreement_photo_upload_service_v5(uuid,uuid,text,uuid,integer,uuid,jsonb)","public.rpc_agreement_photo_read_service_v5(uuid,uuid,uuid,uuid,uuid)","public.rpc_send_agreement_photo_message_v5(uuid,uuid,integer,text,text,uuid[])","public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])","private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb)",private.closure_redaction_relations_v5(),"private.closure_erasure_media_protected_v5(uuid,text)",private.closure_erasure_agreement_protected_v5(uuid),"private.closure_erasure_scope_author_v5(uuid,integer)",private.closure_erasure_exceptions_v5(uuid),private.closure_redaction_scope_v5(text),"private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)",private.closure_erasure_lock_v5(uuid),private.closure_erasure_hard_blockers_v5(uuid),private.closure_erasure_binding_v5(),private.closure_erasure_assert_current_v5(private.closure_executions_v5),private.closure_erasure_progress_v5(private.closure_executions_v5),private.closure_erasure_refresh_steps_v5(private.closure_executions_v5),private.closure_auth_dispatched_v5(uuid),"private.closure_support_source_fence_v5(uuid,text,uuid)","public.rpc_redact_account_closure_step_service(uuid,uuid,uuid,uuid)",public.rpc_review_account_closure_execution(uuid),"public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)","public.rpc_claim_account_closure_action_service(uuid,uuid)","public.rpc_dispatch_account_closure_action_service(uuid,uuid,uuid,uuid)","public.rpc_complete_account_closure_action_service(uuid,uuid,uuid,uuid,text)","public.rpc_finalize_account_closure_service(uuid,uuid)","public.rpc_read_account_closure_execution(uuid,uuid)",public.rpc_list_account_closure_work_service(integer),public.handle_uskoci_auth_user_updated(),private.closure_assert_current_v5(private.closure_executions_v5),private.closure_source_digest_v5(),private.closure_erasure_program_digest_v5(),private.agreement_voice_key_v1(uuid),"private.agreement_voice_context_v1(uuid,uuid,integer,boolean)",private.agreement_voice_document_v1(private.agreement_voice_uploads_v1),private.agreement_voice_transfer_v1(private.agreement_voice_uploads_v1),private.agreement_voice_message_guard_v1(),private.agreement_voice_link_guard_v1(),private.agreement_voice_asset_guard_v1(),private.agreement_voice_storage_guard_v1(),"public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)","public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)","public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)",private.agreement_voice_surface_v1(),private.ai_location_context_valid(jsonb),"private.ai_location_request_hash(uuid,text,jsonb)","private.ai_location_review_matches(uuid,jsonb)","private.ai_location_turn_document(uuid,uuid,uuid)","private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb)","public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb)","public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text)","public.rpc_ai_read_need_location_turn_v1(uuid,uuid)","public.rpc_ai_read_need_location_turn_v1_service(uuid,uuid,uuid)","public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)","private.ai_need_turn_status(uuid,uuid,uuid)"}'::text[]) x)
 or p.oid in(select tgfoid from pg_trigger where not tgisinternal and tgrelid in(select unnest(private.closure_redaction_relations_v5())::regclass))),
 'tables',(select jsonb_agg(jsonb_build_array(c.oid::regclass::text,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) order by c.oid::regclass::text)
 from pg_class c where c.relnamespace in('private'::regnamespace,'public'::regnamespace) and c.relkind in('r','p')),
 'triggerState',(select jsonb_agg(jsonb_build_array(t.tgrelid::regclass::text,t.tgname,t.tgenabled) order by t.tgrelid::regclass::text,t.tgname)
 from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal
 and (c.relnamespace in('private'::regnamespace,'public'::regnamespace) or t.tgrelid='storage.objects'::regclass))
 )::text,'UTF8'),'sha256'),'hex')
 $function$;
do $cert_rebind$
declare before_row record;new_sha text;new_source text;new_program text;ready text;
begin
 select * into strict before_row from location_ai_cert_before;
 if (select proacl::text from pg_proc where oid='public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)'::regprocedure) is distinct from before_row.old_claim_acl
 or (select proacl::text from pg_proc where oid='private.ai_need_turn_status(uuid,uuid,uuid)'::regprocedure) is distinct from before_row.old_status_acl
 then raise exception 'LOCATION_AI_LEGACY_ACL_DRIFT' using errcode='PT409';end if;
 new_sha:=private.closure_source_digest_v5();
 if new_sha is null or new_sha=before_row.certified then raise exception 'LOCATION_AI_DIGEST_NOT_CHANGED' using errcode='PT409';end if;
 new_source:=pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure);
 new_program:=pg_get_functiondef('private.closure_erasure_program_digest_v5()'::regprocedure);
 -- Transaction-local inverse: removing ONLY the new roster entries must restore
 -- the exact old certified source/program. No broader runtime access is granted.
 execute before_row.source_def;execute before_row.program_def;
 if private.closure_source_digest_v5() is distinct from before_row.certified
 or private.closure_erasure_program_digest_v5() is distinct from before_row.program
 then raise exception 'LOCATION_AI_UNREVIEWED_CERT_DELTA' using errcode='PT409';end if;
 execute new_source;execute new_program;
 if private.closure_source_digest_v5() is distinct from new_sha then raise exception 'LOCATION_AI_DIGEST_UNSTABLE' using errcode='PT409';end if;
 update private.closure_source_v5 set sha256=new_sha where singleton and sha256=before_row.certified;
 if not found then raise exception 'LOCATION_AI_CERT_CAS_FAILED' using errcode='PT409';end if;
 update private.closure_erasure_source_v5 set sha256=new_sha where singleton and sha256=before_row.certified;
 if not found then raise exception 'LOCATION_AI_CERT_CAS_FAILED' using errcode='PT409';end if;
 execute replace(before_row.ready_def,before_row.certified,new_sha);
 select prosrc into strict ready from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if md5(replace(ready,new_sha,'<CERTIFIED>')) is distinct from before_row.ready_masked
 or private.closure_source_digest_v5() is distinct from new_sha
 or (select sha256 from private.closure_source_v5 where singleton) is distinct from new_sha
 or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from new_sha
 or private.retention_ai_source_ready() is distinct from true
 or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from new_sha
 or private.closure_erasure_binding_v5()->'legalPolicyAttested' is distinct from 'false'::jsonb
 then raise exception 'LOCATION_AI_REBIND_INCOMPLETE' using errcode='PT409';end if;
end $cert_rebind$;
notify pgrst,'reload schema';
commit;
