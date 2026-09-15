-- Candidate132: restart recovery retains only opaque client coordinates. No new
-- plaintext/audio table, provider, retention period, or automatic retry.
begin;
do $predecessor$
begin
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.ai_need_turn_status(uuid,uuid,uuid)'))
  is distinct from 'aea94388a5e1c6e86b1c31991e71c339'
 or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)'))
  is distinct from '38992cb3f756e990d58925e38864050d'
 or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)'))
  is distinct from '9d013de7796f6ffe79add04bbb043b2c'
 then raise exception 'AI_RECOVERY_PREDECESSOR_DRIFT';end if;
end $predecessor$;
-- Existing in-flight commands predate dispatch evidence. Treat them conservatively.
alter table private.ai_need_turn_commands add column provider_dispatched boolean not null default true;
alter table private.ai_need_turn_commands alter column provider_dispatched set default false;
alter table private.ai_need_turn_commands add column cancelled_at timestamptz;
alter table private.ai_need_turn_commands add constraint ai_need_turn_cancelled_check
 check(cancelled_at is null or (state='FAILED' and not provider_dispatched and receipt is null));

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
  'receipt',t.receipt);
end $f$;

create or replace function public.rpc_ai_claim_need_turn_v2_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_user_message text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
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
end $f$;

create or replace function public.rpc_ai_fail_need_turn_v2_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if p_account_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 perform 1 from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 update private.ai_need_turn_commands set state='FAILED',updated_at=clock_timestamp()
 where account_id=p_account_id and client_request_id=p_client_request_id and conversation_id=p_conversation_id
 and state='PROCESSING' and attempt_id=p_attempt_id and not provider_dispatched and cancelled_at is null;
 return private.ai_need_turn_status(p_account_id,p_conversation_id,p_client_request_id);
end $f$;


create function public.rpc_ai_dispatch_need_turn_v2_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;t private.ai_need_turn_commands;
begin
 if p_account_id is null or p_conversation_id is null or p_client_request_id is null or p_attempt_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22023';end if;
 perform private.closure_assert_open(p_account_id);
 perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=p_account_id for update;
 if not found or c.purpose<>'NEED_INTAKE' or c.fact_schema_version<>'NEED_FACT_V2' then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002';end if;
 select * into t from private.ai_need_turn_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if not found or t.conversation_id<>c.id or t.attempt_id is distinct from p_attempt_id
 or t.state<>'PROCESSING' or t.cancelled_at is not null or t.provider_dispatched or c.status<>'OPEN'
 or t.lease_expires_at<=clock_timestamp() or t.context_hash is distinct from (private.ai_need_turn_context(c.id)->>'sha256') then return false;end if;
 update private.ai_need_turn_commands set provider_dispatched=true,updated_at=clock_timestamp()
 where account_id=p_account_id and client_request_id=p_client_request_id;
 return true;
end $f$;

create function public.rpc_ai_recover_need_turn_v2(p_conversation_id uuid,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare a uuid:=auth.uid();c public.ai_conversations;t private.ai_need_turn_commands;turn_value jsonb;
begin
 if a is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 turn_value:=private.ai_need_turn_status(a,p_conversation_id,p_client_request_id);
 select * into c from public.ai_conversations where id=p_conversation_id and account_id=a;
 select * into t from private.ai_need_turn_commands where account_id=a and client_request_id=p_client_request_id;
 return jsonb_build_object('accountId',a,'conversationId',c.id,'clientRequestId',p_client_request_id,'conversationStatus',c.status,
  'turn',turn_value,'providerDispatched',coalesce(t.provider_dispatched,false),'cancelled',t.cancelled_at is not null,
  'canCancel',c.status='OPEN' and t.cancelled_at is null and (t.turn_id is null or (not t.provider_dispatched and t.state in('PROCESSING','FAILED'))),
  'authoritative',true);
end $f$;

create function public.rpc_ai_cancel_need_turn_v2(p_conversation_id uuid,p_client_request_id uuid)
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
 if c.status<>'OPEN' or coalesce(t.provider_dispatched,false) or t.state='SUCCEEDED' then
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

revoke all on function public.rpc_ai_recover_need_turn_v2(uuid,uuid),public.rpc_ai_cancel_need_turn_v2(uuid,uuid),
 public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_ai_recover_need_turn_v2(uuid,uuid),public.rpc_ai_cancel_need_turn_v2(uuid,uuid) to authenticated;
grant execute on function public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid) to service_role;
-- Advance the reviewed technical inventory only. Previously bound policy SHA
-- stays stale until separate policy review/binding; this activates no retention.
update private.closure_source_v5 set sha256=private.closure_source_digest_v5() where singleton;
notify pgrst,'reload schema';
commit;
