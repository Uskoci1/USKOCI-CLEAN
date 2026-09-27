-- P4 message push transport: SOURCE PREPARED / NOT SQL-PROVEN / NOT APPLIED.
-- Apply only after a disposable proof and a compatible, legacy-default Edge.
-- One existing service-only receipt gains an opaque eventId for MESSAGE_RECEIVED.
-- No message/agreement/account id, user text, URL, new relation or certificate write.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create temporary table chat_p4_push_before on commit drop as
select private.closure_source_digest_v5() digest,
  (select to_jsonb(c) from private.closure_source_v5 c where singleton) certificate,
  (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure,
  private.closure_erasure_binding_v5() binding,
  pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness_definition,
  (select to_jsonb(p)-'prosrc' from pg_proc p
    where oid=to_regprocedure('public.rpc_begin_push_send(uuid,uuid)')) begin_metadata;

do $pre$
declare certified text;
begin
  if not exists(select 1 from pg_proc p
    where oid=to_regprocedure('public.rpc_begin_push_send(uuid,uuid)')
      and md5(replace(prosrc,E'\r\n',E'\n'))='f946246b96985efefa26e2bd560cc897'
      and prosecdef and proowner='postgres'::regrole
      and proconfig=array['search_path=pg_catalog']
      and prolang=(select oid from pg_language where lanname='plpgsql')
      and provolatile='v' and not proisstrict and prokind='f' and not proretset
      and pg_get_function_result(oid)='jsonb') then
    raise exception 'CHAT_P4_PUSH_A1_PREDECESSOR_DRIFT' using errcode='55000';
  end if;
  if has_function_privilege('anon','public.rpc_begin_push_send(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.rpc_begin_push_send(uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.rpc_begin_push_send(uuid,uuid)','EXECUTE') then
    raise exception 'CHAT_P4_PUSH_SERVICE_ACL_REQUIRED' using errcode='55000';
  end if;
  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.rpc_resolve_activity_message_v1(uuid,uuid)')
    and md5(replace(prosrc,E'\r\n',E'\n'))='1769346f2fbf4a70ccf53b47614d2c0f'
    and prosecdef and proowner='postgres'::regrole
    and proconfig=array['search_path=pg_catalog']) then
    raise exception 'CHAT_P4_PUSH_EXACT_RESOLVER_REQUIRED' using errcode='55000';
  end if;
  certified:=(select digest from chat_p4_push_before);
  if certified is null or certified is distinct from (select certificate->>'sha256' from chat_p4_push_before)
    or certified is distinct from (select erasure->>'sha256' from chat_p4_push_before)
    or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from certified
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'CHAT_P4_PUSH_CLOSURE_NOT_READY' using errcode='55000';
  end if;
end
$pre$;

create or replace function public.rpc_begin_push_send(p_attempt_id uuid,p_lease_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $function$
declare
  a public.notification_push_attempts%rowtype;
  d public.notification_deliveries%rowtype;
  dev public.notification_push_devices%rowtype;
  why text;
  v_event_type text;
  v_event_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select x.* into dev
  from public.notification_push_devices x
  join public.notification_push_attempts y on y.device_id=x.id
  where y.id=p_attempt_id;
  if not found then return jsonb_build_object('kind','SUPPRESSED'); end if;

  -- Preserve the proven token-first lock ordering.
  perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||dev.expo_push_token,0));
  select x.* into d
  from public.notification_deliveries x
  join public.notification_push_attempts y on y.delivery_id=x.id
  where y.id=p_attempt_id
  for update of x;
  select * into a from public.notification_push_attempts where id=p_attempt_id for update;
  if not found or a.transport_state<>'SEND_LEASED'
     or a.lease_id is distinct from p_lease_id
     or a.lease_until<=clock_timestamp() then
    raise exception 'PUSH_LEASE_STALE' using errcode='40001';
  end if;

  select * into dev from public.notification_push_devices where id=a.device_id;
  why:=private.push_suppression(d);
  if why is null and
    (dev.id is null or dev.user_id<>d.recipient_user_id or not dev.active
     or dev.revision<>a.device_revision or dev.bound_revision is distinct from dev.revision
     or not private.push_session_valid(dev.user_id,dev.bound_session_id)) then
    why:='DEVICE_CHANGED';
  end if;
  if why is not null then
    update public.notification_push_attempts
    set transport_state='SUPPRESSED',outcome='FATAL',error_code=why,lease_id=null,lease_until=null
    where id=a.id;
    return jsonb_build_object('kind','SUPPRESSED');
  end if;

  select e.event_type,e.id into v_event_type,v_event_id
  from public.user_activity_events e
  where e.id=d.event_id
    and e.recipient_user_id=d.recipient_user_id
    and e.recipient_role=d.recipient_role;
  if v_event_type is null then
    update public.notification_push_attempts
    set transport_state='SUPPRESSED',outcome='FATAL',error_code='EVENT_UNAVAILABLE',lease_id=null,lease_until=null
    where id=a.id;
    return jsonb_build_object('kind','SUPPRESSED');
  end if;

  update public.notification_push_attempts
  set transport_state='SEND_STARTED',send_count=send_count+1
  where id=a.id;

  -- The event UUID is a recipient-bound hint, never navigation authority. The
  -- authenticated P4 resolver rechecks it after tap and returns the exact target.
  return jsonb_build_object(
    'kind','SEND',
    'attemptId',a.id,
    'leaseId',a.lease_id,
    'leaseExpiresAt',a.lease_until,
    'expoPushToken',dev.expo_push_token,
    'priority',d.priority,
    'eventType',v_event_type
  ) || case when v_event_type='MESSAGE_RECEIVED'
    then jsonb_build_object('eventId',v_event_id) else '{}'::jsonb end;
end
$function$;

-- CREATE OR REPLACE preserves the existing owner, ACL and function metadata.
-- Never repair certificate drift by moving a certified digest in this package.
do $post$
begin
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc
    where oid=to_regprocedure('public.rpc_begin_push_send(uuid,uuid)'))
      is distinct from 'ea801be7205a8b07c7c94e20af3bd90e' then
    raise exception 'CHAT_P4_PUSH_FUNCTION_BODY_CHANGED' using errcode='55000';
  end if;
  if (select to_jsonb(p)-'prosrc' from pg_proc p
      where oid=to_regprocedure('public.rpc_begin_push_send(uuid,uuid)'))
      is distinct from (select begin_metadata from chat_p4_push_before) then
    raise exception 'CHAT_P4_PUSH_FUNCTION_METADATA_CHANGED' using errcode='55000';
  end if;
  if private.closure_source_digest_v5() is distinct from (select digest from chat_p4_push_before)
    or (select to_jsonb(c) from private.closure_source_v5 c where singleton)
      is distinct from (select certificate from chat_p4_push_before)
    or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton)
      is distinct from (select erasure from chat_p4_push_before)
    or private.closure_erasure_binding_v5() is distinct from (select binding from chat_p4_push_before)
    or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure)
      is distinct from (select readiness_definition from chat_p4_push_before)
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'CHAT_P4_PUSH_CLOSURE_BOUNDARY_CHANGED' using errcode='55000';
  end if;
end
$post$;
comment on function public.rpc_begin_push_send(uuid,uuid) is
  'Service-only push begin receipt: token, lease, priority, eventType, and opaque eventId for MESSAGE_RECEIVED only. No private target IDs or user-authored content. Client resolves the event after authenticated tap.';
commit;
