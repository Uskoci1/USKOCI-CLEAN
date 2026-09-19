-- V5 D0144: voluntary foreground Worker snapshot in one active physical
-- Agreement. Requesting never starts GPS. No tracking, route or ETA authority.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table private.agreement_location_commands (
 actor_account_id uuid not null references public.app_accounts(id),
 client_request_id uuid not null, agreement_id uuid not null references public.agreements(id),
 agreement_version integer not null check(agreement_version>0),
 kind text not null check(kind in('REQUEST','SHARE')),
 state text not null check(state in('COMMITTED','CANCELLED')),
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'), semantic_hash text,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_account_id,client_request_id),
 check((state='COMMITTED')=(semantic_hash is not null))
);
create index agreement_location_context_idx on private.agreement_location_commands(agreement_id,agreement_version,kind,created_at desc) where state='COMMITTED';
create table private.agreement_location_points (
 actor_account_id uuid not null, client_request_id uuid not null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy_meters double precision not null check(accuracy_meters>=0 and accuracy_meters<'Infinity'::float8),
 captured_at timestamptz not null check(isfinite(captured_at)),
 shared_at timestamptz not null default clock_timestamp(),
 primary key(actor_account_id,client_request_id),
 foreign key(actor_account_id,client_request_id) references private.agreement_location_commands(actor_account_id,client_request_id)
);
alter table private.agreement_location_commands enable row level security;
alter table private.agreement_location_commands force row level security;
alter table private.agreement_location_points enable row level security;
alter table private.agreement_location_points force row level security;
revoke all on private.agreement_location_commands,private.agreement_location_points from public,anon,authenticated,service_role;
comment on table private.agreement_location_points is 'D0144 exact voluntary Worker device point. NEED_SENSITIVE private data like existing exact location grants; never public/profile/group/AI/push. Device timestamp is not verified travel or execution evidence. Existing policy binding owns retention; no duration invented.';
create trigger agreement_location_command_closure before insert or update on private.agreement_location_commands
 for each row execute function private.closure_guard_owned_write('ACCOUNT','actor_account_id');
create trigger agreement_location_point_closure before insert or update on private.agreement_location_points
 for each row execute function private.closure_guard_owned_write('ACCOUNT','actor_account_id');

create function private.agreement_location_receipt(c private.agreement_location_commands)
returns jsonb language sql immutable set search_path=pg_catalog as $f$
 select jsonb_build_object('agreementId',c.agreement_id,'agreementVersion',c.agreement_version,
 'clientRequestId',c.client_request_id,'kind',c.kind,'state',c.state,'inputSha256',c.input_hash,'recordedAt',c.created_at,'authoritative',true);
$f$;

create function public.rpc_read_agreement_location_command(p_expected_user_id uuid,p_agreement_id uuid,p_client_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); c private.agreement_location_commands;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_expected_user_id is distinct from u then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='42501'; end if;
 select * into c from private.agreement_location_commands where actor_account_id=u and agreement_id=p_agreement_id and client_request_id=p_client_request_id;
 return jsonb_build_object('found',found,'command',case when found then private.agreement_location_receipt(c) else null end);
end; $f$;

create function public.rpc_read_agreement_current_location(p_expected_user_id uuid,p_agreement_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); a public.agreements; e public.agreement_execution; can_use boolean; point jsonb; requested timestamptz;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_expected_user_id is distinct from u then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='42501'; end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id);
 if not found then raise exception 'AGREEMENT_NOT_AVAILABLE' using errcode='42501'; end if;
 select * into e from public.agreement_execution where agreement_id=a.id;
 can_use:=coalesce(a.status='CONFIRMED' and e.agreement_version=a.current_version and e.state in('CONFIRMED','AWAITING_REQUESTER')
   and e.mode in('PHYSICAL','PICKUP_DELIVERY') and private.safety_grant_valid(a.requester_account_id,a.worker_account_id,clock_timestamp()),false);
 if can_use then
  select c.created_at into requested from private.agreement_location_commands c
   where c.agreement_id=a.id and c.agreement_version=a.current_version and c.kind='REQUEST' and c.state='COMMITTED'
   and private.safety_grant_valid(a.requester_account_id,a.worker_account_id,c.created_at) order by c.created_at desc,c.client_request_id desc limit 1;
  select jsonb_build_object('latitude',p.latitude,'longitude',p.longitude,'accuracyMeters',p.accuracy_meters,
   'capturedAt',p.captured_at,'sharedAt',p.shared_at) into point
   from private.agreement_location_points p join private.agreement_location_commands c using(actor_account_id,client_request_id)
   where c.agreement_id=a.id and c.agreement_version=a.current_version and c.state='COMMITTED' and c.kind='SHARE'
   and c.actor_account_id=a.worker_account_id and private.safety_grant_valid(a.requester_account_id,a.worker_account_id,p.shared_at)
   order by p.shared_at desc,p.client_request_id desc limit 1;
 end if;
 return jsonb_build_object('agreementId',a.id,'agreementVersion',a.current_version,'role',case when u=a.worker_account_id then 'WORKER' else 'REQUESTER' end,
  'canShare',can_use and u=a.worker_account_id,'canRequest',can_use and u=a.requester_account_id,
  'requestedAt',requested,'point',point,'authoritative',true);
end; $f$;

-- One command lock serializes write, exact replay and explicit cancellation.
-- Cancellation can tombstone an absent request, fencing a late packet after
-- app restart without persisting coordinates on the device.
create function public.rpc_write_agreement_current_location(p_expected_user_id uuid,p_agreement_id uuid,p_agreement_version integer,
 p_client_request_id uuid,p_kind text,p_input_sha256 text,p_point jsonb,p_cancel boolean default false)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); a public.agreements; e public.agreement_execution; c private.agreement_location_commands;
 h text; lat double precision; lon double precision; accuracy double precision; captured timestamptz;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_expected_user_id is distinct from u then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='42501'; end if;
 if p_agreement_id is null or p_agreement_version is null or p_agreement_version<1 or p_client_request_id is null
 or p_kind is null or p_kind not in('REQUEST','SHARE') or p_input_sha256 is null or p_input_sha256 !~ '^[0-9a-f]{64}$' or p_cancel is null
 then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id);
 if not found then raise exception 'AGREEMENT_NOT_AVAILABLE' using errcode='42501'; end if;
 perform private.closure_assert_open(a.requester_account_id,a.worker_account_id);
 perform pg_advisory_xact_lock(hashtextextended('uskoci:location-command:'||u::text||':'||p_client_request_id::text,138));
 select * into c from private.agreement_location_commands where actor_account_id=u and client_request_id=p_client_request_id;
 if found then
  if c.agreement_id<>a.id or c.agreement_version<>p_agreement_version or c.kind<>p_kind or c.input_hash<>p_input_sha256
  then raise exception 'LOCATION_KEY_REUSED' using errcode='22023'; end if;
  if p_cancel or c.state='CANCELLED' then return private.agreement_location_receipt(c); end if;
 end if;
 if p_cancel then
  insert into private.agreement_location_commands(actor_account_id,client_request_id,agreement_id,agreement_version,kind,state,input_hash)
  values(u,p_client_request_id,a.id,p_agreement_version,p_kind,'CANCELLED',p_input_sha256) returning * into c;
  return private.agreement_location_receipt(c);
 end if;
 if p_kind='REQUEST' then
  if p_point is not null then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
 else
  if p_point is null or jsonb_typeof(p_point)<>'object' or (select count(*) from jsonb_object_keys(p_point))<>4
  or not p_point ?& array['latitude','longitude','accuracyMeters','capturedAt']
  or jsonb_typeof(p_point->'latitude')<>'number' or jsonb_typeof(p_point->'longitude')<>'number'
  or jsonb_typeof(p_point->'accuracyMeters')<>'number' or jsonb_typeof(p_point->'capturedAt')<>'string'
  then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
  begin
   lat:=(p_point->>'latitude')::double precision;lon:=(p_point->>'longitude')::double precision;
   accuracy:=(p_point->>'accuracyMeters')::double precision;captured:=(p_point->>'capturedAt')::timestamptz;
  exception when others then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end;
  if not(lat between -90 and 90) or not(lon between -180 and 180) or not(accuracy>=0 and accuracy<'Infinity'::float8) or not isfinite(captured)
  then raise exception 'LOCATION_INPUT_INVALID' using errcode='22023'; end if;
 end if;
 h:=encode(extensions.digest(jsonb_build_object('agreement',a.id,'version',p_agreement_version,'kind',p_kind,'point',p_point)::text,'sha256'),'hex');
 if c.actor_account_id is not null then
  if c.semantic_hash<>h then raise exception 'LOCATION_KEY_REUSED' using errcode='22023'; end if;
  return private.agreement_location_receipt(c);
 end if;
 select * into a from public.agreements where id=a.id for update;
 select * into e from public.agreement_execution where agreement_id=a.id for update;
 perform private.safety_assert_pair(a.requester_account_id,a.worker_account_id);
 if a.current_version<>p_agreement_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if a.status<>'CONFIRMED' or e.agreement_id is null or e.agreement_version<>a.current_version
 or e.state not in('CONFIRMED','AWAITING_REQUESTER') or e.mode not in('PHYSICAL','PICKUP_DELIVERY')
 then raise exception 'LOCATION_NOT_AVAILABLE' using errcode='42501'; end if;
 if (p_kind='SHARE' and u<>a.worker_account_id) or (p_kind='REQUEST' and u<>a.requester_account_id)
 then raise exception 'LOCATION_NOT_AVAILABLE' using errcode='42501'; end if;
 insert into private.agreement_location_commands(actor_account_id,client_request_id,agreement_id,agreement_version,kind,state,input_hash,semantic_hash)
 values(u,p_client_request_id,a.id,a.current_version,p_kind,'COMMITTED',p_input_sha256,h) returning * into c;
 if p_kind='SHARE' then
  insert into private.agreement_location_points(actor_account_id,client_request_id,latitude,longitude,accuracy_meters,captured_at)
  values(u,p_client_request_id,lat,lon,accuracy,captured);
 end if;
 return private.agreement_location_receipt(c);
end; $f$;

revoke all on function private.agreement_location_receipt(private.agreement_location_commands) from public,anon,authenticated,service_role;
revoke all on function public.rpc_read_agreement_location_command(uuid,uuid,uuid),public.rpc_read_agreement_current_location(uuid,uuid),
 public.rpc_write_agreement_current_location(uuid,uuid,integer,uuid,text,text,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.rpc_read_agreement_location_command(uuid,uuid,uuid),public.rpc_read_agreement_current_location(uuid,uuid),
 public.rpc_write_agreement_current_location(uuid,uuid,integer,uuid,text,text,jsonb,boolean) to authenticated;
-- Extend existing reviewed classes, without seeding a duration or policy. The
-- requester does not export the worker's point as if it were their own data.
update private.closure_dataset_catalog_v5 set relations=array_append(relations,'private.agreement_location_commands') where data_class='COMMAND_LEDGERS';
update private.closure_dataset_catalog_v5 set relations=array_append(relations,'private.agreement_location_points') where data_class='NEED_SENSITIVE';
do $export$ declare catalog jsonb;definition text;needle text;replacement text;
begin
 catalog:=private.data_export_dataset_catalog();
 if jsonb_array_length(catalog)<>39 or exists(select 1 from jsonb_array_elements(catalog) x where x->>'key' in('ownLocationSnapshots','ownLocationCommands'))
 then raise exception 'LOCATION_EXPORT_PREDECESSOR_DRIFT';end if;
 catalog:=catalog||'[{"key":"ownLocationSnapshots","dataClass":"NEED_SENSITIVE","fields":["agreementId","agreementVersion","latitude","longitude","accuracyMeters","capturedAt","sharedAt"],"ownershipFilter":"t.actor_account_id=REQUEST_ACCOUNT and a.worker_account_id=REQUEST_ACCOUNT"},{"key":"ownLocationCommands","dataClass":"COMMAND_LEDGERS","fields":["agreementId","agreementVersion","kind","state","createdAt"],"ownershipFilter":"t.actor_account_id=REQUEST_ACCOUNT and REQUEST_ACCOUNT in(a.requester_account_id,a.worker_account_id)"}]'::jsonb;
 execute format('create or replace function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $catalog$ select %L::jsonb $catalog$',catalog::text);
 definition:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure);
 needle:='from private.group_memberships_v5 t where t.account_id=p_account_id),';
 if length(definition)-length(replace(definition,needle,''))<>length(needle) or strpos(definition,'''OWN_ACCOUNT_V5_2''')=0 then raise exception 'LOCATION_EXPORT_PREDECESSOR_DRIFT';end if;
 replacement:=$rows$from private.group_memberships_v5 t where t.account_id=p_account_id
union all
select 'ownLocationSnapshots' as key,jsonb_build_object('agreementId',c.agreement_id,'agreementVersion',c.agreement_version,
 'latitude',t.latitude,'longitude',t.longitude,'accuracyMeters',t.accuracy_meters,'capturedAt',t.captured_at,'sharedAt',t.shared_at) as value
 from private.agreement_location_points t join private.agreement_location_commands c using(actor_account_id,client_request_id)
 join public.agreements a on a.id=c.agreement_id where t.actor_account_id=p_account_id and a.worker_account_id=p_account_id and c.kind='SHARE' and c.state='COMMITTED'
union all
select 'ownLocationCommands' as key,jsonb_build_object('agreementId',t.agreement_id,'agreementVersion',t.agreement_version,'kind',t.kind,'state',t.state,'createdAt',t.created_at) as value
 from private.agreement_location_commands t join public.agreements a on a.id=t.agreement_id where t.actor_account_id=p_account_id and p_account_id in(a.requester_account_id,a.worker_account_id)),$rows$;
 execute replace(replace(definition,needle,replacement),'''OWN_ACCOUNT_V5_2''','''OWN_ACCOUNT_V5_3''');
 definition:=pg_get_functiondef('private.data_export_policy_binding()'::regprocedure);
 if strpos(definition,'''OWN_ACCOUNT_V5_2''')=0 or strpos(definition,'jsonb_array_length(m->''datasets'')<>39')=0 then raise exception 'LOCATION_EXPORT_PREDECESSOR_DRIFT';end if;
 execute replace(replace(definition,'''OWN_ACCOUNT_V5_2''','''OWN_ACCOUNT_V5_3'''),'jsonb_array_length(m->''datasets'')<>39','jsonb_array_length(m->''datasets'')<>41');
end $export$;
update private.closure_source_v5 set sha256=private.closure_source_digest_v5() where singleton;
notify pgrst,'reload schema';
commit;
