-- N06 narrow Expo device registry. PROOF CANDIDATE ONLY, NOT LIVE.
-- Existing table stays the owner. Registration never opts a user into push.
begin;
alter table public.notification_push_devices add column revision bigint not null default 0 check(revision>=0);
-- Fail on ambiguous legacy active ownership; do not silently clean production data.
create unique index push_device_active_token_owner_idx on public.notification_push_devices(expo_push_token) where active;

create function public.rpc_get_push_device(p_expo_push_token text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $read$
declare v_uid uuid:=auth.uid(); d public.notification_push_devices%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_expo_push_token is null or p_expo_push_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$' then
    raise exception 'INVALID_PUSH_TOKEN' using errcode='22023'; end if;
  select * into d from public.notification_push_devices where user_id=v_uid and expo_push_token=p_expo_push_token;
  if not found then return jsonb_build_object('exists',false,'revision',0,'active',false); end if;
  return jsonb_build_object('exists',true,'id',d.id,'revision',d.revision,'active',d.active,'platform',d.platform,'lastSeenAt',d.last_seen_at);
end
$read$;

create function public.rpc_set_push_device(
  p_expo_push_token text,p_platform text,p_active boolean,p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $write$
declare v_uid uuid:=auth.uid(); d public.notification_push_devices%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_expo_push_token is null or p_expo_push_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$'
     or p_platform is null or p_platform not in ('IOS','ANDROID') or p_active is null
     or p_expected_revision is null or p_expected_revision<0 then
    raise exception 'INVALID_PUSH_REGISTRATION' using errcode='22023'; end if;
  -- Serialize the transport address across users, including initial insert and
  -- account switches. A lock-hash collision only serializes unrelated tokens.
  perform pg_advisory_xact_lock(hashtextextended('uskoci:push-token:'||p_expo_push_token,0));
  select * into d from public.notification_push_devices
    where user_id=v_uid and expo_push_token=p_expo_push_token for update;
  if found then
    -- Exact retry returns the original acknowledged revision. A delayed enable
    -- cannot cross a later revoke or cross-account rebinding revision.
    if d.revision=p_expected_revision+1 and d.active=p_active and d.platform=p_platform then
      return jsonb_build_object('id',d.id,'revision',d.revision,'active',d.active,'platform',d.platform,'lastSeenAt',d.last_seen_at);
    end if;
    if d.revision<>p_expected_revision then raise exception 'PUSH_REVISION_CONFLICT' using errcode='40001'; end if;
  elsif p_expected_revision<>0 then
    raise exception 'PUSH_REVISION_CONFLICT' using errcode='40001';
  end if;
  if p_active then
    -- One Expo address must never deliver two logged-in accounts' notifications.
    -- No foreign row or identifier is returned to this authenticated caller.
    update public.notification_push_devices set active=false,revision=revision+1
      where expo_push_token=p_expo_push_token and user_id<>v_uid and active;
  end if;
  if d.id is null then
    -- Revoking an unseen token creates an inactive tombstone: late revision-0
    -- registration must fail instead of resurrecting after logout.
    insert into public.notification_push_devices(user_id,expo_push_token,platform,active,revision)
      values(v_uid,p_expo_push_token,p_platform,p_active,1) returning * into d;
  else
    update public.notification_push_devices set platform=p_platform,active=p_active,
      revision=revision+1,last_seen_at=statement_timestamp() where id=d.id returning * into d;
  end if;
  return jsonb_build_object('id',d.id,'revision',d.revision,'active',d.active,'platform',d.platform,'lastSeenAt',d.last_seen_at);
end
$write$;

drop policy if exists push_devices_own on public.notification_push_devices;
create policy push_devices_owner_read on public.notification_push_devices
  for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.notification_push_devices from public,anon,authenticated;
grant select on public.notification_push_devices to authenticated;
revoke all on function public.rpc_get_push_device(text) from public,anon,service_role;
revoke all on function public.rpc_set_push_device(text,text,boolean,bigint) from public,anon,service_role;
grant execute on function public.rpc_get_push_device(text) to authenticated;
grant execute on function public.rpc_set_push_device(text,text,boolean,bigint) to authenticated;
commit;
