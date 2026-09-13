-- V5 Worker restart recovery. IDs only on device; existing128 profile authority.
-- No provider activation, policy change, new duration, or retention dataset.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Pin the exact128 writers and the exact140 readiness body, allowing only its
-- single reviewed139 inventory literal. A drifted body cannot be rebound.
do $pre$
declare old_sha text; body text;
begin
 select sha256 into strict old_sha from private.closure_source_v5 where singleton;
 if old_sha is distinct from private.closure_source_digest_v5() or private.retention_ai_source_ready() is distinct from true then raise exception 'WORKER_RECOVERY_SOURCE140_REQUIRED';end if;
 select prosrc into strict body from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if length(body)-length(replace(body,old_sha,''))<>length(old_sha) or md5(replace(body,old_sha,'__SOURCE139_SHA256__'))<>'75b560d9a71baa045f8e7f80cd77aada' then raise exception 'WORKER_RECOVERY_SOURCE140_DRIFT';end if;
 if (select md5(prosrc) from pg_proc where oid='public.rpc_claim_worker_ai_turn_service(uuid,uuid,uuid,text)'::regprocedure) is distinct from 'b44b65674c5466548d9ca69e5b8aa1df'
 or (select md5(prosrc) from pg_proc where oid='public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb)'::regprocedure) is distinct from '6d2c27c972357a5566e4cd82ac80e3f3' then raise exception 'WORKER_RECOVERY_SOURCE128_DRIFT';end if;
 if (select md5(prosrc) from pg_proc where oid='public.rpc_read_worker_ai_context_service(uuid,uuid)'::regprocedure) is distinct from 'cb97c6d602c2061e4e7ba46ba3d1585f' then raise exception 'WORKER_RECOVERY_CONTEXT128_DRIFT';end if;
end $pre$;

-- Existing rows are conservatively unknown dispatch; this is not billed usage.
alter table private.worker_ai_turns add column provider_dispatched boolean not null default true;
alter table private.worker_ai_turns alter column provider_dispatched set default false;
alter table private.worker_ai_turns add column cancelled_at timestamptz;
-- No incoming FK into the P3 message dataset; the reviewed Worker sidecar is
-- excluded by140. Only the canonical claim writer sets this exact owned ID.
alter table private.worker_ai_turns add column user_message_id uuid;
alter table private.worker_ai_turns add constraint worker_ai_turn_cancelled_fence check(cancelled_at is null or (state='FAILED' and not provider_dispatched and completion_hash is null));

create function private.worker_ai_turn_recovery_v5(aid uuid,cid uuid,request_id uuid) returns jsonb
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
 'canCancel',editable and (not present or (t.state='PROCESSING' and not t.provider_dispatched and t.cancelled_at is null)),
 'retryAllowed',editable and not present and s.safety in('ALLOW','CLARIFY') and s.base_hash=private.worker_ai_source_hash(aid)
 and not exists(select 1 from private.worker_ai_turns x where x.conversation_id=cid and x.state='PROCESSING'),'authoritative',true);
end $f$;

create function public.rpc_read_worker_ai_turn_recovery(p_expected_user_id uuid,p_conversation_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
begin
 if auth.uid() is null or p_expected_user_id is distinct from auth.uid() then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_conversation_id is null or p_client_request_id is null then raise exception 'WORKER_AI_ID_REQUIRED' using errcode='22023';end if;
 return private.worker_ai_turn_recovery_v5(auth.uid(),p_conversation_id,p_client_request_id);
end $f$;

create function public.rpc_cancel_worker_ai_turn(p_expected_user_id uuid,p_conversation_id uuid,p_client_request_id uuid) returns jsonb
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
  if t.state='PROCESSING' and not t.provider_dispatched and t.cancelled_at is null then
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

create function public.rpc_dispatch_worker_ai_turn_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; t private.worker_ai_turns; parent_open boolean;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 perform private.closure_assert_open(p_account_id);
 if p_client_request_id is null or p_attempt_id is null then raise exception 'WORKER_AI_ID_REQUIRED' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||p_account_id::text||p_client_request_id::text,0));
 select * into s from private.worker_ai_sessions where account_id=p_account_id and conversation_id=p_conversation_id for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501';end if;
 perform 1 from public.ai_conversations where id=p_conversation_id and account_id=p_account_id and purpose='PROFILE' and status='OPEN' for update;parent_open:=found;
 select * into t from private.worker_ai_turns where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if not found or t.conversation_id is distinct from p_conversation_id or t.attempt_id is distinct from p_attempt_id then raise exception 'WORKER_AI_DENIED' using errcode='42501';end if;
 if t.state<>'PROCESSING' or t.provider_dispatched or t.cancelled_at is not null or t.lease_expires_at<=clock_timestamp()
 or t.source_revision<>s.revision or not parent_open or s.safety not in('ALLOW','CLARIFY') or s.base_hash is distinct from private.worker_ai_source_hash(p_account_id)
 then return jsonb_build_object('dispatched',false,'turn',private.worker_ai_turn_document(t.turn_id));end if;
 update private.worker_ai_turns set provider_dispatched=true where turn_id=t.turn_id;
 return jsonb_build_object('dispatched',true,'turn',private.worker_ai_turn_document(t.turn_id));
end $f$;

create or replace function public.rpc_claim_worker_ai_turn_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_text text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; t private.worker_ai_turns; hash text; message_id uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 if p_client_request_id is null or p_text is null or length(btrim(p_text)) not between 1 and 4000
 then raise exception 'WORKER_AI_INPUT_INVALID' using errcode='22023'; end if;
 hash:=encode(extensions.digest(p_text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||p_account_id::text||p_client_request_id::text,0));
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=p_account_id for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into t from private.worker_ai_turns where account_id=p_account_id and client_request_id=p_client_request_id;
 if found then
  if t.conversation_id<>p_conversation_id then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001'; end if;
  if t.cancelled_at is not null then return jsonb_build_object('acquired',false,'turn',private.worker_ai_turn_document(t.turn_id));end if;
  if t.body_hash<>hash then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001'; end if;
  return jsonb_build_object('acquired',false,'turn',private.worker_ai_turn_document(t.turn_id));
 end if;
 perform public.rpc_read_worker_ai_context_service(p_account_id,p_conversation_id);
 perform 1 from public.ai_conversations where id=p_conversation_id for update;
 if exists(select 1 from private.worker_ai_turns where conversation_id=p_conversation_id and state='PROCESSING')
 then raise exception 'WORKER_AI_TURN_PENDING' using errcode='55000'; end if;
 if (select count(*) from private.worker_ai_turns where account_id=p_account_id and created_at>clock_timestamp()-interval '1 minute')>=6
 then raise exception 'WORKER_AI_RATE_LIMITED' using errcode='55000'; end if;
 insert into private.worker_ai_turns(account_id,conversation_id,client_request_id,body_hash,source_revision,state,lease_expires_at)
 values(p_account_id,p_conversation_id,p_client_request_id,hash,s.revision,'PROCESSING',clock_timestamp()+interval '60 seconds') returning * into t;
 insert into public.ai_messages(account_id,conversation_id,role,body) values(p_account_id,p_conversation_id,'USER',p_text) returning id into message_id;
 update private.worker_ai_turns set user_message_id=message_id where turn_id=t.turn_id;
 return jsonb_build_object('acquired',true,'turn',private.worker_ai_turn_document(t.turn_id));
end $f$;

create or replace function public.rpc_read_worker_ai_context_service(p_account_id uuid,p_conversation_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare doc jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=p_account_id)
 then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 doc:=private.worker_ai_document(p_conversation_id);
 if doc is null or doc->>'status'<>'OPEN' or doc->>'safety' in ('BLOCK','REVIEW') or doc->'stale'='true'::jsonb then raise exception 'WORKER_AI_NOT_EDITABLE' using errcode='55000'; end if;
 -- Keep owned history intact. Only the exact USER message attached by a new
 -- claim and subsequently cancelled before dispatch is excluded from provider
 -- context. Legacy rows have no fabricated timestamp-based association.
 return jsonb_set(doc-array['review','saved'],'{messages}',coalesce((
  select jsonb_agg(m.value order by m.ordinality) from jsonb_array_elements(doc->'messages') with ordinality m(value,ordinality)
  where not exists(select 1 from private.worker_ai_turns t where t.account_id=p_account_id and t.conversation_id=p_conversation_id
   and t.cancelled_at is not null and t.user_message_id=(m.value->>'id')::uuid)), '[]'::jsonb));
end $f$;

create or replace function public.rpc_complete_worker_ai_turn_service(p_account_id uuid,p_conversation_id uuid,p_client_request_id uuid,p_attempt_id uuid,p_output jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare s private.worker_ai_sessions; t private.worker_ai_turns; hash text; next_candidate jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 perform private.closure_assert_open(p_account_id);
 select * into s from private.worker_ai_sessions where conversation_id=p_conversation_id and account_id=p_account_id for update;
 if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 select * into t from private.worker_ai_turns where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if not found or t.conversation_id is distinct from p_conversation_id or t.attempt_id is distinct from p_attempt_id then raise exception 'WORKER_AI_DENIED' using errcode='42501'; end if;
 hash:=encode(extensions.digest(p_output::text,'sha256'),'hex');
 if t.state='SUCCEEDED' then
  if t.completion_hash is distinct from hash then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001'; end if;
  return private.worker_ai_turn_document(t.turn_id);
 end if;
 if t.state<>'PROCESSING' or not t.provider_dispatched or t.cancelled_at is not null or t.lease_expires_at<clock_timestamp() or t.source_revision<>s.revision
 then raise exception 'WORKER_AI_TURN_STALE' using errcode='40001'; end if;
 perform public.rpc_read_worker_ai_context_service(p_account_id,p_conversation_id);
 perform 1 from public.ai_conversations where id=p_conversation_id for update;
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
revoke all on function public.rpc_read_worker_ai_turn_recovery(uuid,uuid,uuid),public.rpc_cancel_worker_ai_turn(uuid,uuid,uuid),public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_read_worker_ai_turn_recovery(uuid,uuid,uuid),public.rpc_cancel_worker_ai_turn(uuid,uuid,uuid) to authenticated;
grant execute on function public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid) to service_role;

-- The existing owned Worker command dataset gains its cancellation timestamp,
-- matching the already exported Task cancellation metadata. No provider dispatch
-- provenance, text, request key, dataset or audience is added.
do $export$
declare catalog jsonb; d text; needle text; replacement text; idx integer;
begin
 catalog:=private.data_export_dataset_catalog();
 select ordinality::integer-1 into strict idx from jsonb_array_elements(catalog) with ordinality j(v,ordinality) where v->>'key'='workerAiTurns';
 if jsonb_array_length(catalog)<>42 or catalog->idx->'fields' is distinct from '["conversationId","createdAt","id","state"]'::jsonb
 or catalog->idx->>'ownershipFilter' is distinct from 't.account_id=REQUEST_ACCOUNT' then raise exception 'WORKER_RECOVERY_EXPORT139_DRIFT';end if;
 catalog:=jsonb_set(catalog,array[idx::text,'fields'],'["cancelledAt","conversationId","createdAt","id","state"]'::jsonb);
 execute format('create or replace function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $catalog$ select %L::jsonb $catalog$',catalog::text);
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure);
 needle:=$old$select 'workerAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'createdAt',t.created_at) as value from private.worker_ai_turns t where t.account_id=p_account_id$old$;
 replacement:=$new$select 'workerAiTurns' as key,jsonb_build_object('id',t.turn_id,'conversationId',t.conversation_id,'state',t.state,'createdAt',t.created_at,'cancelledAt',t.cancelled_at) as value from private.worker_ai_turns t where t.account_id=p_account_id$new$;
 if length(d)-length(replace(d,needle,''))<>length(needle) or length(d)-length(replace(d,'''OWN_ACCOUNT_V5_4''',''))<>length('''OWN_ACCOUNT_V5_4''') then raise exception 'WORKER_RECOVERY_EXPORT139_DRIFT';end if;
 execute replace(replace(d,needle,replacement),'''OWN_ACCOUNT_V5_4''','''OWN_ACCOUNT_V5_5''');
 d:=pg_get_functiondef('private.data_export_policy_binding()'::regprocedure);
 if length(d)-length(replace(d,'''OWN_ACCOUNT_V5_4''',''))<>length('''OWN_ACCOUNT_V5_4''') then raise exception 'WORKER_RECOVERY_EXPORT139_DRIFT';end if;
 execute replace(d,'''OWN_ACCOUNT_V5_4''','''OWN_ACCOUNT_V5_5''');
end $export$;

-- Advance only the reviewed technical inventory. No policy row or policy hash is
-- changed: any previous closure binding stays stale until separately reviewed.
-- The140 relation/trigger/helper allowlist and all sidecar exclusions are intact.
do $rebind$
declare old_sha text; new_sha text; definition text;
begin
 select sha256 into strict old_sha from private.closure_source_v5 where singleton;
 new_sha:=private.closure_source_digest_v5();
 definition:=pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
 if length(definition)-length(replace(definition,old_sha,''))<>length(old_sha) then raise exception 'WORKER_RECOVERY_SOURCE_BINDING_INVALID';end if;
 update private.closure_source_v5 set sha256=new_sha where singleton;
 execute replace(definition,old_sha,new_sha);
 if private.retention_ai_source_ready() is distinct from true or private.closure_source_digest_v5() is distinct from new_sha then raise exception 'WORKER_RECOVERY_SOURCE_NOT_READY';end if;
end $rebind$;
notify pgrst,'reload schema';
commit;
