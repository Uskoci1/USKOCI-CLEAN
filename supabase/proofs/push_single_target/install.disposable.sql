-- DISPOSABLE IMPLEMENTATION CANDIDATE ONLY. Not a DEV migration or complete recertification package.
-- No admission, delivery, provider call or registration is created by installation.
begin;
do $guard$
declare r record;
begin
 if current_user<>'postgres' or current_setting('uskoci.single_target_disposable',true) is distinct from 'SINGLE_TARGET_V1'
 then raise exception 'DISPOSABLE_PROOF_CONTEXT_REQUIRED'; end if;
 if exists(select 1 from pg_attribute where attrelid='public.notification_push_attempts'::regclass and attname in ('single_target_admission','single_target_claimed_at','single_target_authorization_id') and not attisdropped)
 then raise exception 'SINGLE_TARGET_ALREADY_INSTALLED'; end if;
 for r in select * from (values
('private.push_session_valid(uuid,uuid)','3454eb7040f3dab3cb0c35b512b46859'),
('private.push_suppression(notification_deliveries)','0e0277608bf40f3cccc3575a77b1c23d'),
('rpc_begin_push_send(uuid,uuid)','fc76b3444e312e589255cccb2b0749c0'),
('rpc_claim_push_transport(text)','8059dcbd47489ffba239c951e233dc02'),
('rpc_complete_push_transport(uuid,uuid,text,text)','705df6b9fc3c7d9ef032ee33c3f5951c'),
('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','3891fe77d38af04e06cfe4c9e4abb96f'),
('private.closure_redaction_relations_v5()','ba362b6d0045d06e6207fc0a8f0592d4'),
('private.closure_redaction_scope_v5(text)','aec26bb057ec0022245a5d8641a47585')) pins(signature,expected_md5) loop
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.expected_md5
  then raise exception 'SINGLE_TARGET_PREDECESSOR_DRIFT: %',r.signature; end if;
 end loop;
end $guard$;
alter table public.notification_push_attempts
 add column single_target_admission jsonb,
 add column single_target_claimed_at timestamptz,
 add column single_target_authorization_id uuid,
 add constraint push_single_target_shape_v1 check (single_target_admission is null or coalesce(
 (jsonb_typeof(single_target_admission)='object')
 and (single_target_admission ?& array['schema','authorizationId','recipientAccountId','recipientRole','eventId','eventType','deviceId','deviceRevision','boundSessionId','expiresAt','receiptDeadline'])
 and (single_target_admission - array['schema','authorizationId','recipientAccountId','recipientRole','eventId','eventType','deviceId','deviceRevision','boundSessionId','expiresAt','receiptDeadline'] = '{}'::jsonb)
 and (single_target_admission->>'schema'='PUSH_SINGLE_TARGET_V1')
 and (single_target_admission->>'eventType'='MESSAGE_RECEIVED')
 and (single_target_admission->>'recipientRole' in ('REQUESTER','WORKER'))
 and (jsonb_typeof(single_target_admission->'authorizationId')='string' and single_target_admission->>'authorizationId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 and (jsonb_typeof(single_target_admission->'recipientAccountId')='string' and single_target_admission->>'recipientAccountId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 and (jsonb_typeof(single_target_admission->'eventId')='string' and single_target_admission->>'eventId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 and (jsonb_typeof(single_target_admission->'deviceId')='string' and single_target_admission->>'deviceId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 and (jsonb_typeof(single_target_admission->'boundSessionId')='string' and single_target_admission->>'boundSessionId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 and (jsonb_typeof(single_target_admission->'deviceRevision')='number' and single_target_admission->>'deviceRevision' ~ '^[0-9]+$')
 and (jsonb_typeof(single_target_admission->'expiresAt')='string' and isfinite((single_target_admission->>'expiresAt')::timestamptz))
 and (jsonb_typeof(single_target_admission->'receiptDeadline')='string' and isfinite((single_target_admission->>'receiptDeadline')::timestamptz)),false)),
 add constraint push_single_target_claim_shape_v1 check(single_target_claimed_at is null or single_target_admission is not null),
 add constraint push_single_target_authorization_v1 unique(single_target_authorization_id),
 add constraint push_single_target_authorization_shape_v1 check (
   (single_target_admission is null and single_target_authorization_id is null)
   or (single_target_admission is not null and single_target_authorization_id is not null
    and single_target_authorization_id::text=single_target_admission->>'authorizationId'));

CREATE OR REPLACE FUNCTION public.rpc_claim_push_transport(p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare d public.notification_deliveries%rowtype; a public.notification_push_attempts%rowtype; v_now timestamptz:=clock_timestamp(); why text; dev record; num integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('SEND','RECEIPT') then raise exception 'INVALID_PUSH_ACTION' using errcode='22023'; end if;
 -- Cross-isolate dispatch throttle and SKIP LOCKED delivery ownership. No
 -- in-memory limit is mistaken for a project-wide limiter.
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0)) then return jsonb_build_object('kind','NONE'); end if;
 if (select count(*) from public.notification_push_attempts where lease_until>v_now)>=6 then return jsonb_build_object('kind','NONE'); end if;
 if (select count(*) from public.notification_push_attempts where last_claimed_at>v_now-interval '1 second')>=60 then return jsonb_build_object('kind','NONE'); end if;
 for d in select * from public.notification_deliveries x where x.channel='PUSH' and not exists(select 1 from public.notification_push_attempts admitted where admitted.delivery_id=x.id and admitted.single_target_admission is not null) and
  ((p_kind='SEND' and x.push_started_at is null and x.state in ('CREATED','QUEUED','FAILED_RETRYABLE') and not exists(select 1 from public.notification_push_attempts z where z.delivery_id=x.id))
   or exists(select 1 from public.notification_push_attempts z where z.delivery_id=x.id and
    ((p_kind='SEND' and z.transport_state in ('PENDING','RETRYABLE','SEND_LEASED','SEND_STARTED')) or (p_kind='RECEIPT' and z.transport_state in ('TICKET_PENDING','RECEIPT_LEASED')))
    and (z.next_attempt_at<=v_now or z.lease_until<=v_now)))
  order by case x.priority when 'HIGH' then 0 else 1 end,x.created_at,x.id limit 64 for update skip locked loop
  if d.push_started_at is null and p_kind='SEND' then
   why:=private.push_suppression(d);
   if why is not null then update public.notification_deliveries set state='SUPPRESSED',suppression_reason=why,push_started_at=v_now where id=d.id; continue; end if;
   -- Historical attempts are not reinterpreted or resent by the new transport.
   if exists(select 1 from public.notification_push_attempts where delivery_id=d.id) then continue; end if;
   num:=0;
   for dev in select * from public.notification_push_devices x where x.user_id=d.recipient_user_id and x.active and x.bound_revision=x.revision and private.push_session_valid(x.user_id,x.bound_session_id) and x.platform in ('IOS','ANDROID') order by x.id loop
    num:=num+1;
    insert into public.notification_push_attempts(delivery_id,device_id,attempt_no,outcome,transport_state,device_revision,next_attempt_at)
    values(d.id,dev.id,num,'QUEUED','PENDING',dev.revision,v_now);
   end loop;
   update public.notification_deliveries set push_started_at=v_now,queued_at=v_now,state=case when num=0 then 'SUPPRESSED' else 'QUEUED' end,suppression_reason=case when num=0 then 'NO_ACTIVE_DEVICE' else null end where id=d.id;
  end if;
  -- Losing a worker after begin may have produced a real push. Never resend it.
  update public.notification_push_attempts set transport_state='UNKNOWN',outcome='FATAL',error_code='SEND_OUTCOME_UNKNOWN',lease_id=null,lease_until=null where delivery_id=d.id and transport_state='SEND_STARTED' and lease_until<=v_now;
  update public.notification_push_attempts set transport_state='PENDING',lease_id=null,lease_until=null where delivery_id=d.id and transport_state='SEND_LEASED' and lease_until<=v_now;
  update public.notification_push_attempts set transport_state='TICKET_PENDING',lease_id=null,lease_until=null where delivery_id=d.id and transport_state='RECEIPT_LEASED' and lease_until<=v_now;
  update public.notification_push_attempts set transport_state='UNKNOWN',outcome='FATAL',error_code='RECEIPT_UNAVAILABLE',lease_id=null,lease_until=null where delivery_id=d.id and transport_state='TICKET_PENDING' and ticket_received_at<=v_now-interval '24 hours';
  select * into a from public.notification_push_attempts where delivery_id=d.id and next_attempt_at<=v_now and
   ((p_kind='SEND' and transport_state in ('PENDING','RETRYABLE') and send_count<3) or (p_kind='RECEIPT' and transport_state='TICKET_PENDING')) order by attempt_no limit 1 for update;
  if not found then continue; end if;
  if p_kind='SEND' then
   why:=private.push_suppression(d);
   if why is not null then update public.notification_push_attempts set transport_state='SUPPRESSED',outcome='FATAL',error_code=why where id=a.id; continue; end if;
   select * into dev from public.notification_push_devices x where x.id=a.device_id and x.user_id=d.recipient_user_id and x.active and x.revision=a.device_revision and x.bound_revision=x.revision and private.push_session_valid(x.user_id,x.bound_session_id);
   if not found then update public.notification_push_attempts set transport_state='SUPPRESSED',outcome='FATAL',error_code='DEVICE_CHANGED' where id=a.id; continue; end if;
  end if;
  update public.notification_push_attempts set transport_state=case when p_kind='SEND' then 'SEND_LEASED' else 'RECEIPT_LEASED' end,lease_id=extensions.gen_random_uuid(),lease_until=v_now+interval '90 seconds',next_attempt_at=v_now,last_claimed_at=v_now where id=a.id returning * into a;
  return jsonb_build_object('kind',p_kind,'attemptId',a.id,'leaseId',a.lease_id,'leaseExpiresAt',a.lease_until,'ticketId',a.provider_ticket_id);
 end loop;
 return jsonb_build_object('kind','NONE');
end $function$;
CREATE OR REPLACE FUNCTION public.rpc_begin_push_send(p_attempt_id uuid, p_lease_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
    raise exception 'PUSH_LEASE_STALE' using errcode='PT409';
  end if;

  select * into dev from public.notification_push_devices where id=a.device_id;
  if a.single_target_admission is not null then
    if a.single_target_claimed_at is null or a.send_count<>0
       or ((a.single_target_admission->>'expiresAt')::timestamptz>clock_timestamp()) is not true
       or a.device_id::text is distinct from a.single_target_admission->>'deviceId'
       or a.device_revision::text is distinct from a.single_target_admission->>'deviceRevision'
       or dev.bound_session_id::text is distinct from a.single_target_admission->>'boundSessionId'
       or d.event_id::text is distinct from a.single_target_admission->>'eventId'
       or d.recipient_user_id::text is distinct from a.single_target_admission->>'recipientAccountId'
       or d.recipient_role is distinct from a.single_target_admission->>'recipientRole'
       or not exists(select 1 from public.user_activity_events e where e.id=d.event_id and e.event_type='MESSAGE_RECEIVED')
    then why:='SINGLE_TARGET_EXPIRED_OR_CHANGED'; end if;
  end if;
  why:=coalesce(why,private.push_suppression(d));
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
CREATE OR REPLACE FUNCTION public.rpc_complete_push_transport(p_attempt_id uuid, p_lease_id uuid, p_result text, p_ticket_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare a public.notification_push_attempts%rowtype; d public.notification_deliveries%rowtype; token text; receipt boolean; v_now timestamptz:=clock_timestamp(); next_state text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_result is null or p_result not in ('TICKET','PROVIDER_ACCEPTED','DEVICE_NOT_REGISTERED','RETRYABLE','RECEIPT_RATE_EXCEEDED','FATAL','UNKNOWN','RECEIPT_PENDING') or
  (p_result='TICKET' and (p_ticket_id is null or p_ticket_id!~'^[A-Za-z0-9_-]{1,200}$')) or (p_result<>'TICKET' and p_ticket_id is not null) then raise exception 'INVALID_PUSH_RESULT' using errcode='22023'; end if;
 select x.expo_push_token into token from public.notification_push_devices x join public.notification_push_attempts y on y.device_id=x.id where y.id=p_attempt_id;
 if token is not null then perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||token,0)); end if;
 select x.* into d from public.notification_deliveries x join public.notification_push_attempts y on y.delivery_id=x.id where y.id=p_attempt_id for update of x;
 select * into a from public.notification_push_attempts where id=p_attempt_id for update;
 if not found or a.lease_id is distinct from p_lease_id or a.lease_until<=clock_timestamp() or a.transport_state not in ('SEND_STARTED','RECEIPT_LEASED') then raise exception 'PUSH_LEASE_STALE' using errcode='PT409'; end if;
 receipt:=a.transport_state='RECEIPT_LEASED';
 if (receipt and (p_result='TICKET' or a.provider_ticket_id is null)) or (not receipt and p_result in ('PROVIDER_ACCEPTED','RECEIPT_PENDING','RECEIPT_RATE_EXCEEDED'))
 or (p_result='TICKET' and p_ticket_id=any(a.rejected_ticket_ids)) then raise exception 'INVALID_PUSH_RESULT' using errcode='22023'; end if;
 -- A documented receipt MessageRateExceeded is a known rejection of this
 -- message, unlike HTTP429 while merely looking up a receipt. Only the former
 -- permits a new send, with current-device/consent revalidation and max3 sends.
 next_state:=case p_result when 'TICKET' then 'TICKET_PENDING' when 'PROVIDER_ACCEPTED' then 'PROVIDER_ACCEPTED' when 'DEVICE_NOT_REGISTERED' then 'FINAL' when 'UNKNOWN' then 'UNKNOWN' when 'RECEIPT_PENDING' then 'TICKET_PENDING' when 'RECEIPT_RATE_EXCEEDED' then case when a.send_count<3 then 'RETRYABLE' else 'FINAL' end when 'RETRYABLE' then case when receipt then 'TICKET_PENDING' when a.send_count<3 then 'RETRYABLE' else 'FINAL' end else 'FINAL' end;
 -- A one-shot admission never regains send permission, including known provider throttles.
 if a.single_target_admission is not null and next_state='RETRYABLE' then next_state:='FINAL'; end if;
 update public.notification_push_attempts set transport_state=next_state,
  outcome=case when next_state='PROVIDER_ACCEPTED' then 'OK' when next_state='RETRYABLE' then 'RETRYABLE' when next_state in ('TICKET_PENDING') then 'QUEUED' else 'FATAL' end,
  error_code=case when p_result in ('TICKET','PROVIDER_ACCEPTED') then null else p_result end,
  rejected_ticket_ids=case when p_result='RECEIPT_RATE_EXCEEDED' and next_state='RETRYABLE' then array_append(rejected_ticket_ids,provider_ticket_id) else rejected_ticket_ids end,
  provider_ticket_id=case when p_result='TICKET' then p_ticket_id when p_result='RECEIPT_RATE_EXCEEDED' and next_state='RETRYABLE' then null else provider_ticket_id end,
  ticket_received_at=case when p_result='TICKET' then v_now when p_result='RECEIPT_RATE_EXCEEDED' and next_state='RETRYABLE' then null else ticket_received_at end,
  receipt_checked_at=case when receipt then v_now else receipt_checked_at end,
  next_attempt_at=case when next_state='TICKET_PENDING' then v_now+interval '15 minutes' when next_state='RETRYABLE' then v_now+make_interval(secs=>power(2,a.send_count)::integer*30) else null end,
  lease_id=null,lease_until=null where id=a.id;
 if p_result='DEVICE_NOT_REGISTERED' then
  -- Token rebind / revoke / re-registration changes revision. An old provider
  -- result must never disable a different user's or a newer registration.
  update public.notification_push_devices set active=false,revision=revision+1,bound_session_id=null,bound_revision=null
  where id=a.device_id and user_id=d.recipient_user_id and revision=a.device_revision and active;
 end if;
 if p_result='TICKET' and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE') then update public.notification_deliveries set state='SENT',sent_at=coalesce(sent_at,v_now) where id=d.id; end if;
 -- DELIVERED and delivered_at are deliberately never written by this adapter.
 return jsonb_build_object('attemptId',a.id,'state',next_state);
end $function$;
-- SOURCE CANDIDATE FOR DISPOSABLE PROOF ONLY. No DEV application or authorization is performed by this file.
-- The existing attempt is the durable admission. Its existing delivery/device ownership and erasure scope remain.
create function private.admit_push_single_target_v1(
 p_admission_id uuid, p_authorization_id uuid, p_recipient_user_id uuid, p_recipient_role text,
 p_event_id uuid, p_delivery_id uuid, p_device_id uuid, p_device_revision bigint,
 p_bound_session_id uuid, p_expires_at timestamptz, p_receipt_deadline timestamptz
) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $body$
declare d public.notification_deliveries%rowtype; dev public.notification_push_devices%rowtype;
 a public.notification_push_attempts%rowtype; meta jsonb; why text; v_now timestamptz:=clock_timestamp();
begin
 if current_user<>'postgres' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_admission_id is null or p_authorization_id is null or p_recipient_user_id is null
  or p_recipient_role is null or p_recipient_role not in ('REQUESTER','WORKER')
  or p_event_id is null or p_delivery_id is null or p_device_id is null or p_device_revision is null or p_device_revision<0
  or p_bound_session_id is null or p_expires_at is null or p_receipt_deadline is null
  or not isfinite(p_expires_at) or not isfinite(p_receipt_deadline)
  or p_receipt_deadline<=p_expires_at or p_receipt_deadline>p_expires_at+interval '24 hours'
 then raise exception 'INVALID_PUSH_ADMISSION' using errcode='22023'; end if;
 meta:=jsonb_build_object('schema','PUSH_SINGLE_TARGET_V1','authorizationId',p_authorization_id,
  'recipientAccountId',p_recipient_user_id,'recipientRole',p_recipient_role,'eventId',p_event_id,
  'eventType','MESSAGE_RECEIVED','deviceId',p_device_id,'deviceRevision',p_device_revision,
  'boundSessionId',p_bound_session_id,'expiresAt',p_expires_at,'receiptDeadline',p_receipt_deadline);
 -- Admission and claim share the existing cross-isolate serializer; no provider/token lock is held here.
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0)) then return jsonb_build_object('kind','BUSY'); end if;
 select * into d from public.notification_deliveries where id=p_delivery_id for update;
 if not found then raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
 select * into a from public.notification_push_attempts where id=p_admission_id for update;
 if found then
  if a.delivery_id<>p_delivery_id or a.device_id is distinct from p_device_id or a.single_target_admission is distinct from meta
  then raise exception 'PUSH_ADMISSION_CONFLICT' using errcode='PT409'; end if;
  return jsonb_build_object('kind','EXISTING','admissionId',a.id,'state',a.transport_state);
 end if;
 if p_expires_at<=clock_timestamp() or d.channel<>'PUSH' or d.push_started_at is not null
  or d.state not in ('CREATED','QUEUED','FAILED_RETRYABLE')
  or d.event_id<>p_event_id or d.recipient_user_id<>p_recipient_user_id or d.recipient_role<>p_recipient_role
  or exists(select 1 from public.notification_push_attempts where delivery_id=d.id)
  or not exists(select 1 from public.user_activity_events e where e.id=p_event_id
   and e.recipient_user_id=p_recipient_user_id and e.recipient_role=p_recipient_role and e.event_type='MESSAGE_RECEIVED')
 then raise exception 'PUSH_TARGET_UNAVAILABLE' using errcode='PT409'; end if;
 why:=private.push_suppression(d);
 if why is not null then raise exception 'PUSH_TARGET_SUPPRESSED' using errcode='PT409'; end if;
 select * into dev from public.notification_push_devices where id=p_device_id;
 if not found or dev.user_id<>p_recipient_user_id or not dev.active or dev.platform not in ('ANDROID','IOS')
  or dev.revision<>p_device_revision or dev.bound_revision is distinct from dev.revision
  or dev.bound_session_id is distinct from p_bound_session_id or not private.push_session_valid(dev.user_id,dev.bound_session_id)
 then raise exception 'PUSH_DEVICE_CHANGED' using errcode='PT409'; end if;
 insert into public.notification_push_attempts(id,delivery_id,device_id,attempt_no,outcome,transport_state,device_revision,next_attempt_at,single_target_admission,single_target_authorization_id)
 values(p_admission_id,d.id,dev.id,1,'QUEUED','PENDING',dev.revision,v_now,meta,p_authorization_id);
 return jsonb_build_object('kind','ADMITTED','admissionId',p_admission_id);
end $body$;
revoke all on function private.admit_push_single_target_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;

create function public.rpc_claim_push_single_target(p_admission_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $body$
declare a public.notification_push_attempts%rowtype; d public.notification_deliveries%rowtype;
 dev public.notification_push_devices%rowtype; why text; v_now timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_admission_id is null then raise exception 'INVALID_PUSH_ADMISSION' using errcode='22023'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0)) then return jsonb_build_object('kind','NONE'); end if;
 v_now:=clock_timestamp();
 if (select count(*) from public.notification_push_attempts where lease_until>v_now)>=6
  or (select count(*) from public.notification_push_attempts where last_claimed_at>v_now-interval '1 second')>=60
 then return jsonb_build_object('kind','NONE'); end if;
 select x.* into d from public.notification_deliveries x join public.notification_push_attempts y on y.delivery_id=x.id
  where y.id=p_admission_id and y.single_target_admission is not null for update of x;
 if not found then return jsonb_build_object('kind','NONE'); end if;
 select * into a from public.notification_push_attempts where id=p_admission_id for update;
 -- Never return a previously granted lease, even if no begin/provider call occurred.
 if not found or a.single_target_admission is null or a.single_target_claimed_at is not null
  or a.transport_state<>'PENDING' or a.send_count<>0 or a.lease_id is not null
 then return jsonb_build_object('kind','NONE'); end if;
 v_now:=clock_timestamp();
 why:=private.push_suppression(d);
 if why is null and ((a.single_target_admission->>'expiresAt')::timestamptz<=v_now
  or d.push_started_at is not null or d.event_id::text<>a.single_target_admission->>'eventId'
  or d.recipient_user_id::text<>a.single_target_admission->>'recipientAccountId'
  or d.recipient_role<>a.single_target_admission->>'recipientRole') then why:='SINGLE_TARGET_EXPIRED_OR_CHANGED'; end if;
 select * into dev from public.notification_push_devices where id=a.device_id;
 if why is null and (dev.id is null or not dev.active or dev.user_id<>d.recipient_user_id
  or dev.revision<>a.device_revision or dev.bound_revision is distinct from dev.revision
  or dev.bound_session_id::text is distinct from a.single_target_admission->>'boundSessionId'
  or not private.push_session_valid(dev.user_id,dev.bound_session_id)) then why:='DEVICE_CHANGED'; end if;
 if why is not null then
  update public.notification_push_attempts set single_target_claimed_at=v_now,transport_state='SUPPRESSED',outcome='FATAL',error_code=why,next_attempt_at=null where id=a.id;
  return jsonb_build_object('kind','NONE');
 end if;
 update public.notification_deliveries set push_started_at=v_now,queued_at=v_now,state='QUEUED' where id=d.id;
 update public.notification_push_attempts set single_target_claimed_at=v_now,transport_state='SEND_LEASED',
  lease_id=extensions.gen_random_uuid(),lease_until=least(v_now+interval '90 seconds',(single_target_admission->>'expiresAt')::timestamptz),
  next_attempt_at=null,last_claimed_at=v_now where id=a.id returning * into a;
 return jsonb_build_object('kind','SEND','attemptId',a.id,'leaseId',a.lease_id,'leaseExpiresAt',a.lease_until,'ticketId',null);
end $body$;
revoke all on function public.rpc_claim_push_single_target(uuid) from public,anon,authenticated;
grant execute on function public.rpc_claim_push_single_target(uuid) to service_role;

create function public.rpc_claim_push_single_target_receipt(p_admission_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $body$
declare a public.notification_push_attempts%rowtype; d public.notification_deliveries%rowtype; v_now timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_admission_id is null then raise exception 'INVALID_PUSH_ADMISSION' using errcode='22023'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0)) then return jsonb_build_object('kind','NONE'); end if;
 v_now:=clock_timestamp();
 if (select count(*) from public.notification_push_attempts where lease_until>v_now)>=6
  or (select count(*) from public.notification_push_attempts where last_claimed_at>v_now-interval '1 second')>=60
 then return jsonb_build_object('kind','NONE'); end if;
 select x.* into d from public.notification_deliveries x join public.notification_push_attempts y on y.delivery_id=x.id
  where y.id=p_admission_id and y.single_target_admission is not null for update of x;
 if not found then return jsonb_build_object('kind','NONE'); end if;
 select * into a from public.notification_push_attempts where id=p_admission_id for update;
 if not found or a.single_target_admission is null or a.single_target_claimed_at is null then return jsonb_build_object('kind','NONE'); end if;
 v_now:=clock_timestamp();
 -- Expired sends never return to PENDING. This is target-only retirement, not a scan of backlog.
 if a.transport_state in ('SEND_LEASED','SEND_STARTED') and a.lease_until<=v_now then
  update public.notification_push_attempts set transport_state=case when a.transport_state='SEND_STARTED' then 'UNKNOWN' else 'FINAL' end,
   outcome='FATAL',error_code=case when a.transport_state='SEND_STARTED' then 'SEND_OUTCOME_UNKNOWN' else 'ADMISSION_LEASE_EXPIRED' end,
   lease_id=null,lease_until=null,next_attempt_at=null where id=a.id;
  return jsonb_build_object('kind','NONE');
 end if;
 if a.transport_state not in ('TICKET_PENDING','RECEIPT_LEASED') then return jsonb_build_object('kind','NONE'); end if;
 if (a.single_target_admission->>'receiptDeadline')::timestamptz<=v_now or a.ticket_received_at<=v_now-interval '24 hours' then
  update public.notification_push_attempts set transport_state='UNKNOWN',outcome='FATAL',error_code='RECEIPT_UNAVAILABLE',lease_id=null,lease_until=null,next_attempt_at=null where id=a.id;
  return jsonb_build_object('kind','NONE');
 end if;
 if a.transport_state='RECEIPT_LEASED' and a.lease_until>v_now then return jsonb_build_object('kind','NONE'); end if;
 if a.send_count<>1 or a.provider_ticket_id is null or (a.transport_state='TICKET_PENDING' and a.next_attempt_at>v_now)
 then return jsonb_build_object('kind','NONE'); end if;
 update public.notification_push_attempts set transport_state='RECEIPT_LEASED',lease_id=extensions.gen_random_uuid(),
  lease_until=least(v_now+interval '90 seconds',(single_target_admission->>'receiptDeadline')::timestamptz),last_claimed_at=v_now
  where id=a.id returning * into a;
 return jsonb_build_object('kind','RECEIPT','attemptId',a.id,'leaseId',a.lease_id,'leaseExpiresAt',a.lease_until,'ticketId',a.provider_ticket_id);
end $body$;
revoke all on function public.rpc_claim_push_single_target_receipt(uuid) from public,anon,authenticated;
grant execute on function public.rpc_claim_push_single_target_receipt(uuid) to service_role;

create function private.revoke_push_single_target_v1(p_admission_id uuid) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $body$
declare a public.notification_push_attempts%rowtype;
begin
 if current_user<>'postgres' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0)) then return false; end if;
 perform 1 from public.notification_deliveries d join public.notification_push_attempts x on x.delivery_id=d.id
  where x.id=p_admission_id and x.single_target_admission is not null for update of d;
 select * into a from public.notification_push_attempts where id=p_admission_id for update;
 if not found or a.single_target_admission is null then return false; end if;
 -- A started/uncertain provider call cannot be cancelled or re-authorized. Preserve its evidence.
 if a.transport_state not in ('PENDING','SEND_LEASED') or a.send_count<>0 then return false; end if;
 update public.notification_push_attempts set transport_state='SUPPRESSED',outcome='FATAL',error_code='ADMISSION_REVOKED',
  single_target_claimed_at=coalesce(single_target_claimed_at,clock_timestamp()),lease_id=null,lease_until=null,next_attempt_at=null where id=a.id;
 return true;
end $body$;
revoke all on function private.revoke_push_single_target_v1(uuid) from public,anon,authenticated,service_role;

commit;
