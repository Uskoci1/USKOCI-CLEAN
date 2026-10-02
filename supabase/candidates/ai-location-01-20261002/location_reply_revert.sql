-- Admission rollback, not destructive uninstallation. Restore baseline Edge
-- first, and disable location client admission. Read wrappers/status projection
-- remain so completed/pending operations can be reconciled without replay.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table private.closure_executions_v5,private.closure_source_v5,private.closure_erasure_source_v5 in share row exclusive mode;
create temporary table location_ai_revert_cert(certified text,ready_def text,ready_masked text) on commit drop;
do $cert_pre$ declare old_sha text;ready text;begin
 select sha256 into strict old_sha from private.closure_source_v5 where singleton;
 if old_sha is distinct from private.closure_source_digest_v5()
 or old_sha is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
 or private.retention_ai_source_ready() is distinct from true
 or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from old_sha
 or exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then raise exception 'LOCATION_AI_REVERT_CERT_NOT_READY' using errcode='PT409';end if;
 select prosrc into strict ready from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if length(ready)-length(replace(ready,old_sha,''))<>64 then raise exception 'LOCATION_AI_REVERT_READY_DRIFT' using errcode='PT409';end if;
 insert into location_ai_revert_cert values(old_sha,pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure),md5(replace(ready,old_sha,'<CERTIFIED>')));
end $cert_pre$;
do $roster_pre$ begin
 if (select md5(prosrc) from pg_proc where oid='private.closure_source_digest_v5()'::regprocedure) is distinct from 'f562ce85e73cf6c981d784fde7a785d0' then raise exception 'LOCATION_AI_REVERT_ROSTER_DRIFT' using errcode='PT409';end if;
 if (select md5(prosrc) from pg_proc where oid='private.closure_erasure_program_digest_v5()'::regprocedure) is distinct from '02a2926d1b6cff5a2c9f5b3497b61377' then raise exception 'LOCATION_AI_REVERT_ROSTER_DRIFT' using errcode='PT409';end if;
end $roster_pre$;
do $pre$ begin
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)')) is distinct from '55cefa33785d35f5df0b87918f096b52' then raise exception 'LOCATION_AI_REVERT_DRIFT' using errcode='PT409';end if;
 if exists(select 1 from private.ai_need_turn_commands where state='PROCESSING') then raise exception 'LOCATION_AI_REVERT_INFLIGHT' using errcode='PT409';end if;
end $pre$;
CREATE OR REPLACE FUNCTION public.rpc_ai_claim_need_turn_v2_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_user_message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c public.ai_conversations;t private.ai_need_turn_commands;request_hash_value text;ctx jsonb;now_at timestamptz;attempt uuid;turn jsonb;
begin
 if p_account_id is null or p_conversation_id is null or p_client_request_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 if p_user_message is null or char_length(btrim(p_user_message)) not between 1 and 4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023';end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 now_at:=clock_timestamp();
 request_hash_value:=encode(extensions.digest(convert_to(jsonb_build_object('conversationId',c.id,'text',btrim(p_user_message))::text,'UTF8'),'sha256'),'hex');
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if found and t.conversation_id<>c.id then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 if t.cancelled_at is not null then
  if t.request_hash<>repeat('0',64) and t.request_hash<>request_hash_value then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
  return jsonb_build_object('turn',private.ai_need_turn_status(p_account_id,c.id,p_client_request_id),'claim',null);
 end if;
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
end $function$;
revoke execute on function public.rpc_ai_claim_need_location_turn_v1_service(uuid,uuid,uuid,text,jsonb),
 public.rpc_ai_complete_need_location_turn_v1_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,text) from service_role;
-- Keep read wrappers and status receipt projection; never strip or delete saved receipt metadata.
do $cert_post$ declare b record;new_sha text;ready text;begin
 select * into strict b from location_ai_revert_cert;new_sha:=private.closure_source_digest_v5();
 if new_sha is null or new_sha=b.certified then raise exception 'LOCATION_AI_REVERT_DIGEST_INVALID' using errcode='PT409';end if;
 update private.closure_source_v5 set sha256=new_sha where singleton and sha256=b.certified;
 if not found then raise exception 'LOCATION_AI_REVERT_CERT_CAS_FAILED' using errcode='PT409';end if;
 update private.closure_erasure_source_v5 set sha256=new_sha where singleton and sha256=b.certified;
 if not found then raise exception 'LOCATION_AI_REVERT_CERT_CAS_FAILED' using errcode='PT409';end if;
 execute replace(b.ready_def,b.certified,new_sha);
 select prosrc into strict ready from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if md5(replace(ready,new_sha,'<CERTIFIED>')) is distinct from b.ready_masked
 or private.closure_source_digest_v5() is distinct from new_sha
 or private.retention_ai_source_ready() is distinct from true
 or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from new_sha then raise exception 'LOCATION_AI_REVERT_REBIND_FAILED' using errcode='PT409';end if;
end $cert_post$;
notify pgrst,'reload schema';
commit;
