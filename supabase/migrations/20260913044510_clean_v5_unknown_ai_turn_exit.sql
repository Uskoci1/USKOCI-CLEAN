-- Candidate142: explicit owner-approved exit from an unknown dispatched AI turn.
-- Cancellation fences local writes, not provider processing; preserve every
-- dispatch/attempt and conservative reservation. No refund, retry, or new policy.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $pre$
declare old_sha text; body text;
begin
 select sha256 into strict old_sha from private.closure_source_v5 where singleton;
 if old_sha is distinct from private.closure_source_digest_v5() or private.retention_ai_source_ready() is distinct from true then raise exception 'AI_EXIT_SOURCE141_REQUIRED';end if;
 select prosrc into strict body from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if length(body)-length(replace(body,old_sha,''))<>length(old_sha) or md5(replace(body,old_sha,'__SOURCE139_SHA256__'))<>'75b560d9a71baa045f8e7f80cd77aada' then raise exception 'AI_EXIT_SOURCE140_DRIFT';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_recover_need_turn_v2(uuid,uuid)')) is distinct from '3fb459cf89e236d7a93d45a8b838ead5' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_ai_recover_need_turn_v2';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_cancel_need_turn_v2(uuid,uuid)')) is distinct from '094a00e7e59c0294ed83223d8e6073fd' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_ai_cancel_need_turn_v2';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)')) is distinct from 'd7d715011629a51789b211af7d44d5e8' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_ai_complete_need_turn_v2_service';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid)')) is distinct from 'fa90211a3fb9297eeebc74463845c7ca' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_ai_dispatch_need_turn_v2_service';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)')) is distinct from '0a858dacc6b7bb14891c664bfe0b34ad' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_ai_claim_need_turn_v2_service';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.worker_ai_turn_recovery_v5(uuid,uuid,uuid)')) is distinct from '565c479ce546c60b5b82b82707565496' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='private.worker_ai_turn_recovery_v5';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_cancel_worker_ai_turn(uuid,uuid,uuid)')) is distinct from '757fd9ca2758e334c0bc5c0773f0ef69' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_cancel_worker_ai_turn';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb)')) is distinct from 'a06cd4076ba9aa026a63072e7262f0ef' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_complete_worker_ai_turn_service';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid)')) is distinct from '05c6f257e25baec1ea39abbc4246b36f' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_dispatch_worker_ai_turn_service';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_claim_worker_ai_turn_service(uuid,uuid,uuid,text)')) is distinct from 'd7265c97e8f6d323ac5f8af73c8094e0' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_claim_worker_ai_turn_service';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_read_worker_ai_context_service(uuid,uuid)')) is distinct from 'b8f5fd2236ec50c8b3d0ee1d45c9c850' then raise exception 'AI_EXIT_PREDECESSOR_DRIFT' using detail='public.rpc_read_worker_ai_context_service';end if;
 -- The matched141 closure digest above covers the exact constraints and rows'
 -- schema. Require both named validated predecessor checks before replacing.
 if (select count(*) from pg_constraint where contype='c' and convalidated and
  ((conrelid='private.ai_need_turn_commands'::regclass and conname='ai_need_turn_cancelled_check')
   or (conrelid='private.worker_ai_turns'::regclass and conname='worker_ai_turn_cancelled_fence')))<>2 then raise exception 'AI_EXIT_CONSTRAINT_DRIFT';end if;
end $pre$;
alter table private.ai_need_turn_commands drop constraint ai_need_turn_cancelled_check;
alter table private.ai_need_turn_commands add constraint ai_need_turn_cancelled_check check(cancelled_at is null or (state='FAILED' and receipt is null));
alter table private.worker_ai_turns drop constraint worker_ai_turn_cancelled_fence;
alter table private.worker_ai_turns add constraint worker_ai_turn_cancelled_fence check(cancelled_at is null or (state='FAILED' and completion_hash is null));

create or replace function public.rpc_ai_recover_need_turn_v2(p_conversation_id uuid,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a uuid:=auth.uid();c public.ai_conversations;t private.ai_need_turn_commands;turn_value jsonb;
begin
 if a is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 turn_value:=private.ai_need_turn_status(a,p_conversation_id,p_client_request_id);
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=a;
 select * into t from private.ai_need_turn_commands where account_id=a and client_request_id=p_client_request_id;
 return jsonb_build_object('accountId',a,'conversationId',c.id,'clientRequestId',p_client_request_id,'conversationStatus',c.status,
  'turn',turn_value,'providerDispatched',coalesce(t.provider_dispatched,false),'cancelled',t.cancelled_at is not null,
  'canCancel',c.status='OPEN' and not private.closure_account_restricted(a) and t.cancelled_at is null
  and (t.turn_id is null or t.state='PROCESSING' or (not t.provider_dispatched and t.state='FAILED')),
  'authoritative',true);
end $f$;

create or replace function public.rpc_ai_cancel_need_turn_v2(p_conversation_id uuid,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a uuid:=auth.uid();c public.ai_conversations;t private.ai_need_turn_commands;
begin
 if a is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 if p_client_request_id is null then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';end if;
 perform private.closure_assert_open(a);
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||a::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=a for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 select * into t from private.ai_need_turn_commands where account_id=a and client_request_id=p_client_request_id for update;
 if found and t.conversation_id<>c.id then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 if t.cancelled_at is not null then return public.rpc_ai_recover_need_turn_v2(c.id,p_client_request_id);end if;
 if c.status<>'OPEN' or t.state='SUCCEEDED' or (t.provider_dispatched and t.state<>'PROCESSING') then
  return public.rpc_ai_recover_need_turn_v2(c.id,p_client_request_id);end if;
 if t.turn_id is null then
  -- Tombstone a request not yet visible to readback. A delayed Edge claim sees
  -- this same account/key under the same lock and can never obtain an attempt.
  insert into private.ai_need_turn_commands(account_id,conversation_id,client_request_id,request_hash,state,cancelled_at)
  values(a,c.id,p_client_request_id,repeat('0',64),'FAILED',clock_timestamp());
 else
  update private.ai_need_turn_commands set state='FAILED',cancelled_at=clock_timestamp(),updated_at=clock_timestamp()
  where account_id=a and client_request_id=p_client_request_id;
 end if;
 return public.rpc_ai_recover_need_turn_v2(c.id,p_client_request_id);
end $f$;

create or replace function public.rpc_ai_complete_need_turn_v2_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,
 p_user_message text,p_assistant_message text,p_safety text,p_proposals jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;t private.ai_need_turn_commands;raw jsonb;receipt_value jsonb;hash_value text;now_at timestamptz;
begin
 if p_account_id is null or p_conversation_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 hash_value:=encode(extensions.digest(convert_to(jsonb_build_object('conversationId',c.id,'text',btrim(p_user_message))::text,'UTF8'),'sha256'),'hex');
 if not found or t.conversation_id<>c.id or t.request_hash<>hash_value then raise exception 'AI_REQUEST_ID_REUSED' using errcode='22023';end if;
 if t.state='SUCCEEDED' then return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);end if;
 if t.state<>'PROCESSING' or t.attempt_id<>p_attempt_id or not t.provider_dispatched or t.cancelled_at is not null then return private.ai_need_turn_status(p_account_id,c.id,p_client_request_id);end if;
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

create or replace function private.worker_ai_turn_recovery_v5(aid uuid,cid uuid,request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; t private.worker_ai_turns; parent_status text; editable boolean; present boolean;
begin
 select * into s from private.worker_ai_sessions where account_id=aid and conversation_id=cid;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501';end if;
 select status into parent_status from public.ai_conversations where id=cid and account_id=aid and purpose='PROFILE';
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501';end if;
 select * into t from private.worker_ai_turns where account_id=aid and client_request_id=request_id;present:=found;
 if present and t.conversation_id is distinct from cid then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001';end if;
 editable:=parent_status='OPEN' and not private.closure_account_restricted(aid);
 return jsonb_build_object('schemaVersion','WORKER_PROFILE_V1','accountId',aid,'conversationId',cid,'profileId',s.profile_id,
 'conversationStatus',parent_status,'clientRequestId',request_id,'turn',case when present then private.worker_ai_turn_document(t.turn_id) else null end,
 'providerDispatched',case when present then t.provider_dispatched else false end,'cancelled',case when present then t.cancelled_at is not null else false end,
 'canCancel',editable and (not present or (t.state='PROCESSING' and t.cancelled_at is null)),
 'retryAllowed',editable and not present and s.safety in('ALLOW','CLARIFY') and s.base_hash=private.worker_ai_source_hash(aid)
 and not exists(select 1 from private.worker_ai_turns x where x.conversation_id=cid and x.state='PROCESSING'),'authoritative',true);
end $f$;

create or replace function public.rpc_cancel_worker_ai_turn(p_expected_user_id uuid,p_conversation_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); s private.worker_ai_sessions; t private.worker_ai_turns;
begin
 if u is null or p_expected_user_id is distinct from u then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_conversation_id is null or p_client_request_id is null then raise exception 'WORKER_AI_ID_REQUIRED' using errcode='22023';end if;
 perform private.closure_assert_open(u);
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||u::text||p_client_request_id::text,0));
 select * into s from private.worker_ai_sessions where account_id=u and conversation_id=p_conversation_id for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501';end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and account_id=u and purpose='PROFILE' and status='OPEN' for update;
 if not found then return private.worker_ai_turn_recovery_v5(u,p_conversation_id,p_client_request_id);end if;
 select * into t from private.worker_ai_turns where account_id=u and client_request_id=p_client_request_id for update;
 if found then
  if t.conversation_id is distinct from p_conversation_id then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001';end if;
  if t.state='PROCESSING' and t.cancelled_at is null then
   update private.worker_ai_turns set state='FAILED',cancelled_at=clock_timestamp() where turn_id=t.turn_id;
  end if;
 else
  -- Absent is only a read observation. The tombstone fences an HTTP claim still
  -- in flight and stores no message; the same opaque key can never be reused.
  insert into private.worker_ai_turns(account_id,conversation_id,client_request_id,body_hash,source_revision,state,lease_expires_at,cancelled_at)
  values(u,p_conversation_id,p_client_request_id,repeat('0',64),s.revision,'FAILED',clock_timestamp(),clock_timestamp());
 end if;
 return private.worker_ai_turn_recovery_v5(u,p_conversation_id,p_client_request_id);
end $f$;

create or replace function public.rpc_complete_worker_ai_turn_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,p_output jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; t private.worker_ai_turns; hash text; next_candidate jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||p_account_id::text||p_client_request_id::text,0));
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=p_account_id for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and account_id=p_account_id and purpose='PROFILE' for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501';end if;
 select * into t from private.worker_ai_turns where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if not found or t.conversation_id is distinct from p_conversation_id or t.attempt_id is distinct from p_attempt_id then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 if t.cancelled_at is not null then return private.worker_ai_turn_document(t.turn_id);end if;
 hash:=encode(extensions.digest(p_output::text,'sha256'),'hex');
 if t.state='SUCCEEDED' then
  if t.completion_hash is distinct from hash then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001'; end if;
  return private.worker_ai_turn_document(t.turn_id);
 end if;
 if t.state<>'PROCESSING' or not t.provider_dispatched or t.cancelled_at is not null or t.lease_expires_at<clock_timestamp() or t.source_revision<>s.revision
 then raise exception 'WORKER_AI_TURN_STALE' using errcode='40001'; end if;
 perform public.rpc_read_worker_ai_context_service(p_account_id,p_conversation_id);
 if jsonb_typeof(p_output) is distinct from 'object' or p_output-array['assistantMessage','safety','patch']<>'{}'::jsonb
  or not(p_output?&array['assistantMessage','safety','patch'])
  or jsonb_typeof(p_output->'assistantMessage') is distinct from 'string'
  or length(btrim(p_output->>'assistantMessage')) not between 1 and 1200
  or coalesce(p_output->>'safety','') not in ('ALLOW','CLARIFY','REVIEW','BLOCK')
 then raise exception 'WORKER_AI_OUTPUT_INVALID' using errcode='22023'; end if;
 next_candidate:=private.worker_ai_patch(s.candidate,p_output->'patch',s.profile_id,s.account_id,false);
 if p_output->>'safety' in ('BLOCK','REVIEW') then next_candidate:=s.candidate; end if;
 update private.worker_ai_sessions set candidate=next_candidate,revision=revision+1,safety=p_output->>'safety' where conversation_id=p_conversation_id;
 insert into public.ai_messages(account_id,conversation_id,role,body,safety)
 values(p_account_id,p_conversation_id,'ASSISTANT',p_output->>'assistantMessage',p_output->>'safety');
 update private.worker_ai_turns set state='SUCCEEDED',completion_hash=hash where turn_id=t.turn_id;
 return private.worker_ai_turn_document(t.turn_id);
end $f$;

revoke all on function private.worker_ai_turn_recovery_v5(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.rpc_ai_recover_need_turn_v2(uuid,uuid),public.rpc_ai_cancel_need_turn_v2(uuid,uuid),
 public.rpc_cancel_worker_ai_turn(uuid,uuid,uuid),public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb),
 public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rpc_ai_recover_need_turn_v2(uuid,uuid),public.rpc_ai_cancel_need_turn_v2(uuid,uuid),public.rpc_cancel_worker_ai_turn(uuid,uuid,uuid) to authenticated;
grant execute on function public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb),public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb) to service_role;
-- Only the technical constraint digest changes.142 neither widens P3 candidates
-- nor edits retention/closure/export policy.141 cancellation fields already exist.
do $rebind$
declare old_sha text; new_sha text; definition text;
begin
 select sha256 into strict old_sha from private.closure_source_v5 where singleton;
 new_sha:=private.closure_source_digest_v5();
 definition:=pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
 if length(definition)-length(replace(definition,old_sha,''))<>length(old_sha) then raise exception 'AI_EXIT_SOURCE_BINDING_INVALID';end if;
 update private.closure_source_v5 set sha256=new_sha where singleton;
 execute replace(definition,old_sha,new_sha);
 if private.retention_ai_source_ready() is distinct from true or private.closure_source_digest_v5() is distinct from new_sha then raise exception 'AI_EXIT_SOURCE_NOT_READY';end if;
end $rebind$;
notify pgrst,'reload schema';
commit;
