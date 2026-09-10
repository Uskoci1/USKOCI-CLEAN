-- N09: transport on the existing event/delivery/attempt ledger. No event backfill,
-- opt-in, provider call, legal-policy seed or scheduler credential is performed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $guard$
begin
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)')) is distinct from '8da91a4736e09b10872bd1240d6e0c8c'
 or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_get_push_device(text)')) is distinct from 'df3deab04eee429c8bedaf636916791f'
 or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_set_push_device(text,text,boolean,bigint)')) is distinct from '3b97a22d4066a0287d214a56b10d7188'
 or (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_set_notification_preferences(uuid,text,jsonb,bigint)')) is distinct from '34a307e2c38ff341581229f3726af680'
 or (select count(*) from pg_attribute where attrelid='public.notification_push_attempts'::regclass and attnum>0 and not attisdropped)<>9
 then raise exception 'N09_PREDECESSOR_MISMATCH'; end if;
end $guard$;

alter table public.notification_push_devices
 add column bound_session_id uuid,
 add column bound_revision bigint;
-- No FK into Auth-owned sessions, and no DML against Auth tables. Removed
-- sessions invalidate transport on the next claim/begin, including old JWTs.
alter table public.notification_deliveries add column push_started_at timestamptz;
alter table public.notification_push_attempts
 add column transport_state text check(transport_state in ('PENDING','SEND_LEASED','SEND_STARTED','TICKET_PENDING','RECEIPT_LEASED','PROVIDER_ACCEPTED','RETRYABLE','FINAL','UNKNOWN','SUPPRESSED')),
 add column device_revision bigint,
 add column send_count integer not null default 0 check(send_count between 0 and 3),
 add column lease_id uuid,
 add column lease_until timestamptz,
 add column next_attempt_at timestamptz,
 add column ticket_received_at timestamptz,
 add column receipt_checked_at timestamptz;
alter table public.notification_push_attempts add column last_claimed_at timestamptz;
alter table public.notification_push_attempts add column rejected_ticket_ids text[] not null default '{}'
 check(cardinality(rejected_ticket_ids)<=2 and array_position(rejected_ticket_ids,null) is null);
create unique index notification_transport_device_once on public.notification_push_attempts(delivery_id,device_id) where transport_state is not null;
create unique index notification_transport_ticket_once on public.notification_push_attempts(provider,provider_ticket_id) where transport_state is not null and provider_ticket_id is not null;
create index notification_transport_ready on public.notification_push_attempts(transport_state,next_attempt_at) where transport_state in ('PENDING','RETRYABLE','TICKET_PENDING','SEND_LEASED','SEND_STARTED','RECEIPT_LEASED');
create index notification_transport_leases on public.notification_push_attempts(lease_until) where lease_until is not null;
create index notification_transport_claim_rate on public.notification_push_attempts(last_claimed_at) where last_claimed_at is not null;
revoke all on public.notification_push_attempts from public,anon,authenticated;
comment on column public.notification_push_attempts.transport_state is 'Expo ticket acceptance and APNs/FCM provider receipt are not evidence of physical device delivery. UNKNOWN sends are never automatically replayed.';

create function private.push_session_valid(p_user uuid,p_session uuid)
returns boolean language sql volatile security definer set search_path=pg_catalog as $fn$
 select p_session is not null and exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=p_session and s.user_id=p_user and (s.not_after is null or s.not_after>clock_timestamp())
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()));
$fn$;
create function public.rpc_set_push_device_owned(p_expected_user_id uuid,p_expo_push_token text,p_platform text,p_active boolean,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare u uuid:=auth.uid(); sid uuid; result jsonb; d public.notification_push_devices%rowtype;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then raise exception 'AUTH_REQUIRED' using errcode='28000'; end;
 if not private.push_session_valid(u,sid) then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_expo_push_token is null or length(p_expo_push_token)>256 then raise exception 'INVALID_PUSH_REGISTRATION' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:push-user:'||u::text,0));
 perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||p_expo_push_token,0));
 if not private.push_session_valid(u,sid) then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into d from public.notification_push_devices where user_id=u and expo_push_token=p_expo_push_token;
 if p_active and not coalesce(d.active and d.bound_revision=d.revision and private.push_session_valid(d.user_id,d.bound_session_id),false) and (select count(*) from public.notification_push_devices where user_id=u and active and bound_revision=revision and private.push_session_valid(user_id,bound_session_id))>=10 then raise exception 'PUSH_DEVICE_LIMIT' using errcode='22023'; end if;
 -- A replay cannot silently rebind a different login incarnation.
 if d.revision=p_expected_revision+1 and d.active=p_active and d.platform=p_platform
 and p_active and (d.bound_session_id is distinct from sid or d.bound_revision is distinct from d.revision) then raise exception 'PUSH_REVISION_CONFLICT' using errcode='40001'; end if;
 result:=public.rpc_set_push_device(p_expo_push_token,p_platform,p_active,p_expected_revision);
 update public.notification_push_devices set bound_session_id=case when p_active then sid else null end,
 bound_revision=case when p_active then revision else null end where id=(result->>'id')::uuid;
 return result||jsonb_build_object('sessionBound',p_active);
end $fn$;

create function public.rpc_get_push_device_owned(p_expected_user_id uuid,p_expo_push_token text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare u uuid:=auth.uid(); sid uuid; d public.notification_push_devices%rowtype; result jsonb;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then raise exception 'AUTH_REQUIRED' using errcode='28000'; end;
 if not private.push_session_valid(u,sid) then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_expo_push_token is null or length(p_expo_push_token)>256 then raise exception 'INVALID_PUSH_TOKEN' using errcode='22023'; end if;
 result:=public.rpc_get_push_device(p_expo_push_token);
 select * into d from public.notification_push_devices where user_id=u and expo_push_token=p_expo_push_token;
 return result||jsonb_build_object('sessionBound',coalesce(d.active and d.bound_session_id=sid and d.bound_revision=d.revision,false));
end $fn$;

create function public.rpc_revoke_push_session(p_expected_user_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare u uuid:=auth.uid(); sid uuid; d record; n integer:=0;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then raise exception 'AUTH_REQUIRED' using errcode='28000'; end;
 if sid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:push-user:'||u::text,0));
 for d in select id,expo_push_token from public.notification_push_devices where user_id=u and bound_session_id=sid order by expo_push_token loop
  perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||d.expo_push_token,0));
  update public.notification_push_devices set active=false,revision=revision+1,bound_session_id=null,bound_revision=null where id=d.id and user_id=u and bound_session_id=sid;
  if found then n:=n+1; end if;
 end loop;
 return jsonb_build_object('userId',u,'revoked',true);
end $fn$;

create function public.rpc_get_push_session_device(p_expected_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare u uuid:=auth.uid(); sid uuid; d public.notification_push_devices%rowtype; n integer;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then raise exception 'AUTH_REQUIRED' using errcode='28000'; end;
 if not private.push_session_valid(u,sid) then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select count(*) into n from public.notification_push_devices where user_id=u and active and bound_session_id=sid and bound_revision=revision;
 if n<>1 then return jsonb_build_object('kind',case when n=0 then 'NONE' else 'AMBIGUOUS' end); end if;
 select * into d from public.notification_push_devices where user_id=u and active and bound_session_id=sid and bound_revision=revision;
 return jsonb_build_object('kind','DEVICE','id',d.id,'revision',d.revision,'expoPushToken',d.expo_push_token,'platform',d.platform);
end $fn$;

create function public.rpc_rotate_push_device_owned(p_expected_user_id uuid,p_previous_device_id uuid,p_previous_revision bigint,p_expo_push_token text,p_platform text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare u uuid:=auth.uid(); sid uuid; old_device public.notification_push_devices%rowtype; next_device public.notification_push_devices%rowtype; token text; result jsonb;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then raise exception 'AUTH_REQUIRED' using errcode='28000'; end;
 if not private.push_session_valid(u,sid) then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_previous_device_id is null or p_previous_revision is null or p_previous_revision<1 or p_expo_push_token is null or length(p_expo_push_token)>256 or p_expo_push_token!~'^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$' or p_platform is null or p_platform not in ('IOS','ANDROID') then raise exception 'INVALID_PUSH_REGISTRATION' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:push-user:'||u::text,0));
 select * into old_device from public.notification_push_devices where id=p_previous_device_id and user_id=u;
 if not found or not old_device.active or old_device.revision<>p_previous_revision or old_device.bound_revision is distinct from old_device.revision or old_device.bound_session_id is distinct from sid then raise exception 'PUSH_REVISION_CONFLICT' using errcode='40001'; end if;
 if old_device.expo_push_token=p_expo_push_token or old_device.platform<>p_platform then raise exception 'INVALID_PUSH_REGISTRATION' using errcode='22023'; end if;
 for token in select x from unnest(array[old_device.expo_push_token,p_expo_push_token]) x order by x loop
  perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||token,0));
 end loop;
 -- Legacy N06 writers do not take the user lock; recheck after both token locks.
 select * into old_device from public.notification_push_devices where id=p_previous_device_id for update;
 if not old_device.active or old_device.revision<>p_previous_revision or old_device.bound_revision is distinct from old_device.revision or old_device.bound_session_id is distinct from sid then raise exception 'PUSH_REVISION_CONFLICT' using errcode='40001'; end if;
 select * into next_device from public.notification_push_devices where user_id=u and expo_push_token=p_expo_push_token;
 if not private.push_session_valid(u,sid) then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform public.rpc_set_push_device(old_device.expo_push_token,old_device.platform,false,p_previous_revision);
 update public.notification_push_devices set bound_session_id=null,bound_revision=null where id=old_device.id;
 result:=public.rpc_set_push_device(p_expo_push_token,p_platform,true,coalesce(next_device.revision,0));
 update public.notification_push_devices set bound_session_id=sid,bound_revision=revision where id=(result->>'id')::uuid;
 return result||jsonb_build_object('sessionBound',true,'previousDeviceId',old_device.id,'previousRevision',p_previous_revision+1);
end $fn$;

-- Explicit seam for a future account-closure owner. This does not implement or
-- activate account closure. Ban/delete and actual session removal also fail shut.
create function public.rpc_retire_push_account(p_account_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $fn$
declare d record;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_account_id is null then raise exception 'INVALID_ACCOUNT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:push-user:'||p_account_id::text,0));
 for d in select id,expo_push_token from public.notification_push_devices where user_id=p_account_id and active order by expo_push_token loop
  perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||d.expo_push_token,0));
  update public.notification_push_devices set active=false,revision=revision+1,bound_session_id=null,bound_revision=null where id=d.id and user_id=p_account_id and active;
 end loop;
end $fn$;

create function private.push_suppression(p_delivery public.notification_deliveries)
returns text language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare p public.notification_preferences%rowtype; e public.user_activity_events%rowtype; enabled boolean; local_time time;
begin
 if p_delivery.channel<>'PUSH' or p_delivery.state in ('SUPPRESSED','EXPIRED','READ','DELIVERED','FAILED_FINAL') then return 'DELIVERY_CLOSED'; end if;
 if p_delivery.expires_at<=clock_timestamp() then return 'EXPIRED'; end if;
 select * into e from public.user_activity_events where id=p_delivery.event_id;
 if not found or e.recipient_user_id<>p_delivery.recipient_user_id or e.recipient_role<>p_delivery.recipient_role then return 'EVENT_UNAVAILABLE'; end if;
 select * into p from public.notification_preferences where user_id=p_delivery.recipient_user_id and role_context=p_delivery.recipient_role;
 if not found or not p.push_enabled then return 'PUSH_OFF'; end if;
 enabled:=case private.category_of_event(e.event_type) when 'opportunities' then p.opportunities_enabled when 'responses' then p.responses_enabled when 'dogovor' then p.dogovor_enabled when 'execution' then p.execution_enabled when 'recovery' then p.recovery_enabled else p.account_enabled end;
 if not enabled then return 'CATEGORY_OFF'; end if;
 -- Preserve the emitter's inclusive and overnight quiet-hours semantics, but
 -- re-evaluate the wall clock after the begin RPC's potentially blocking locks.
 local_time:=(clock_timestamp() at time zone p.quiet_timezone)::time;
 if p.quiet_hours_enabled and (case when p.quiet_start<p.quiet_end then local_time between p.quiet_start and p.quiet_end else local_time>=p.quiet_start or local_time<=p.quiet_end end)
 and not(e.urgency='HITNO' and p.urgent_overrides_quiet_hours) then return 'QUIET_HOURS'; end if;
 return null;
end $fn$;

create function public.rpc_claim_push_transport(p_kind text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare d public.notification_deliveries%rowtype; a public.notification_push_attempts%rowtype; v_now timestamptz:=clock_timestamp(); why text; dev record; num integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('SEND','RECEIPT') then raise exception 'INVALID_PUSH_ACTION' using errcode='22023'; end if;
 -- Cross-isolate dispatch throttle and SKIP LOCKED delivery ownership. No
 -- in-memory limit is mistaken for a project-wide limiter.
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0)) then return jsonb_build_object('kind','NONE'); end if;
 if (select count(*) from public.notification_push_attempts where lease_until>v_now)>=6 then return jsonb_build_object('kind','NONE'); end if;
 if (select count(*) from public.notification_push_attempts where last_claimed_at>v_now-interval '1 second')>=60 then return jsonb_build_object('kind','NONE'); end if;
 for d in select * from public.notification_deliveries x where x.channel='PUSH' and
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
end $fn$;

create function public.rpc_begin_push_send(p_attempt_id uuid,p_lease_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare a public.notification_push_attempts%rowtype; d public.notification_deliveries%rowtype; dev public.notification_push_devices%rowtype; why text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select x.* into dev from public.notification_push_devices x join public.notification_push_attempts y on y.device_id=x.id where y.id=p_attempt_id;
 if not found then return jsonb_build_object('kind','SUPPRESSED'); end if;
 -- Same token-first lock order as N06 registration and provider retirement.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||dev.expo_push_token,0));
 select x.* into d from public.notification_deliveries x join public.notification_push_attempts y on y.delivery_id=x.id where y.id=p_attempt_id for update of x;
 select * into a from public.notification_push_attempts where id=p_attempt_id for update;
 if not found or a.transport_state<>'SEND_LEASED' or a.lease_id is distinct from p_lease_id or a.lease_until<=clock_timestamp() then raise exception 'PUSH_LEASE_STALE' using errcode='40001'; end if;
 select * into dev from public.notification_push_devices where id=a.device_id;
 why:=private.push_suppression(d);
 if why is null and (dev.id is null or dev.user_id<>d.recipient_user_id or not dev.active or dev.revision<>a.device_revision or dev.bound_revision is distinct from dev.revision or not private.push_session_valid(dev.user_id,dev.bound_session_id)) then why:='DEVICE_CHANGED'; end if;
 if why is not null then
  update public.notification_push_attempts set transport_state='SUPPRESSED',outcome='FATAL',error_code=why,lease_id=null,lease_until=null where id=a.id;
  return jsonb_build_object('kind','SUPPRESSED');
 end if;
 update public.notification_push_attempts set transport_state='SEND_STARTED',send_count=send_count+1 where id=a.id;
 -- No title/body/event/entity/account/private payload reaches the worker.
 return jsonb_build_object('kind','SEND','attemptId',a.id,'leaseId',a.lease_id,'leaseExpiresAt',a.lease_until,'expoPushToken',dev.expo_push_token,'priority',d.priority);
end $fn$;

create function public.rpc_complete_push_transport(p_attempt_id uuid,p_lease_id uuid,p_result text,p_ticket_id text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare a public.notification_push_attempts%rowtype; d public.notification_deliveries%rowtype; token text; receipt boolean; v_now timestamptz:=clock_timestamp(); next_state text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_result is null or p_result not in ('TICKET','PROVIDER_ACCEPTED','DEVICE_NOT_REGISTERED','RETRYABLE','RECEIPT_RATE_EXCEEDED','FATAL','UNKNOWN','RECEIPT_PENDING') or
  (p_result='TICKET' and (p_ticket_id is null or p_ticket_id!~'^[A-Za-z0-9_-]{1,200}$')) or (p_result<>'TICKET' and p_ticket_id is not null) then raise exception 'INVALID_PUSH_RESULT' using errcode='22023'; end if;
 select x.expo_push_token into token from public.notification_push_devices x join public.notification_push_attempts y on y.device_id=x.id where y.id=p_attempt_id;
 if token is not null then perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||token,0)); end if;
 select x.* into d from public.notification_deliveries x join public.notification_push_attempts y on y.delivery_id=x.id where y.id=p_attempt_id for update of x;
 select * into a from public.notification_push_attempts where id=p_attempt_id for update;
 if not found or a.lease_id is distinct from p_lease_id or a.lease_until<=clock_timestamp() or a.transport_state not in ('SEND_STARTED','RECEIPT_LEASED') then raise exception 'PUSH_LEASE_STALE' using errcode='40001'; end if;
 receipt:=a.transport_state='RECEIPT_LEASED';
 if (receipt and (p_result='TICKET' or a.provider_ticket_id is null)) or (not receipt and p_result in ('PROVIDER_ACCEPTED','RECEIPT_PENDING','RECEIPT_RATE_EXCEEDED'))
 or (p_result='TICKET' and p_ticket_id=any(a.rejected_ticket_ids)) then raise exception 'INVALID_PUSH_RESULT' using errcode='22023'; end if;
 -- A documented receipt MessageRateExceeded is a known rejection of this
 -- message, unlike HTTP429 while merely looking up a receipt. Only the former
 -- permits a new send, with current-device/consent revalidation and max3 sends.
 next_state:=case p_result when 'TICKET' then 'TICKET_PENDING' when 'PROVIDER_ACCEPTED' then 'PROVIDER_ACCEPTED' when 'DEVICE_NOT_REGISTERED' then 'FINAL' when 'UNKNOWN' then 'UNKNOWN' when 'RECEIPT_PENDING' then 'TICKET_PENDING' when 'RECEIPT_RATE_EXCEEDED' then case when a.send_count<3 then 'RETRYABLE' else 'FINAL' end when 'RETRYABLE' then case when receipt then 'TICKET_PENDING' when a.send_count<3 then 'RETRYABLE' else 'FINAL' end else 'FINAL' end;
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
end $fn$;

-- N06 remains the unchanged inner registry writer. Only the session-bound
-- definer wrappers may call it; a still-valid JWT from a revoked session must
-- not bypass their post-lock session check and retire a newer token owner.
revoke execute on function public.rpc_set_push_device(text,text,boolean,bigint) from authenticated;
revoke all on function private.push_session_valid(uuid,uuid),private.push_suppression(public.notification_deliveries) from public,anon,authenticated,service_role;
revoke all on function public.rpc_get_push_device_owned(uuid,text),public.rpc_set_push_device_owned(uuid,text,text,boolean,bigint),public.rpc_revoke_push_session(uuid),public.rpc_get_push_session_device(uuid),public.rpc_rotate_push_device_owned(uuid,uuid,bigint,text,text) from public,anon,service_role;
grant execute on function public.rpc_get_push_device_owned(uuid,text),public.rpc_set_push_device_owned(uuid,text,text,boolean,bigint),public.rpc_revoke_push_session(uuid),public.rpc_get_push_session_device(uuid),public.rpc_rotate_push_device_owned(uuid,uuid,bigint,text,text) to authenticated;
revoke all on function public.rpc_retire_push_account(uuid),public.rpc_claim_push_transport(text),public.rpc_begin_push_send(uuid,uuid),public.rpc_complete_push_transport(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.rpc_retire_push_account(uuid),public.rpc_claim_push_transport(text),public.rpc_begin_push_send(uuid,uuid),public.rpc_complete_push_transport(uuid,uuid,text,text) to service_role;
commit;
