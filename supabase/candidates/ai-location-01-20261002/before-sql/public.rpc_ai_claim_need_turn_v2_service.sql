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
end $function$
