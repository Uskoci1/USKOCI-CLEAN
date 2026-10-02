CREATE OR REPLACE FUNCTION private.ai_need_turn_status(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
end $function$
