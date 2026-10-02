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
