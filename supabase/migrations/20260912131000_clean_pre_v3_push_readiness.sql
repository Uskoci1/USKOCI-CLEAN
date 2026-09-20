-- PRE-V3 P11: one observed transport readiness authority; candidate122, NOT LIVE.
-- No deployment, scheduler, provider call or fabricated success is seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table private.push_runtime_readiness (
 singleton boolean primary key default true check(singleton),
 sender_version text not null check(sender_version='PRE_V3_PUSH_READINESS_V1'),
 observation text not null check(observation in('PROBE_ENABLED','PROBE_DISABLED','TICK_OK','TICK_DEGRADED','TICK_FAILED')),
 observed_at timestamptz not null,
 last_success_at timestamptz,
 check(last_success_at is null or last_success_at<=observed_at)
);
alter table private.push_runtime_readiness enable row level security;
alter table private.push_runtime_readiness force row level security;
revoke all on private.push_runtime_readiness from public,anon,authenticated,service_role;
comment on table private.push_runtime_readiness is 'Last bounded service-only runtime observation, not source-exists proof. Empty/stale = UNKNOWN. A healthy empty tick is transport readiness, never Expo/device delivery proof.';
create function public.rpc_record_push_readiness(p_sender_version text,p_observation text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare t timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_sender_version is distinct from 'PRE_V3_PUSH_READINESS_V1' or p_observation is null
 or p_observation not in('PROBE_ENABLED','PROBE_DISABLED','TICK_OK','TICK_DEGRADED','TICK_FAILED') then
  raise exception 'PUSH_READINESS_INPUT_INVALID' using errcode='22023'; end if;
 -- Timestamp AFTER serialization, so concurrent reports cannot move observed_at
 -- backwards or put last_success_at beyond a newer failed/disabled observation.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:push-runtime-readiness',11122));t:=clock_timestamp();
 insert into private.push_runtime_readiness(singleton,sender_version,observation,observed_at,last_success_at)
 values(true,p_sender_version,p_observation,t,case when p_observation='TICK_OK' then t end)
 on conflict(singleton) do update set sender_version=excluded.sender_version,observation=excluded.observation,observed_at=excluded.observed_at,
  last_success_at=case when excluded.observation='TICK_OK' then excluded.observed_at else private.push_runtime_readiness.last_success_at end;
 return jsonb_build_object('recorded',true,'observation',p_observation,'observedAt',t,'authoritative',true);
end;
$f$;
create function public.rpc_get_push_readiness()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare r private.push_runtime_readiness; t timestamptz:=statement_timestamp(); fresh boolean; expired boolean; overdue boolean; state text; reason text;
begin
 if auth.uid() is null and auth.role() is distinct from 'service_role' then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into r from private.push_runtime_readiness where singleton;
 fresh:=r.observed_at is not null and r.observed_at<=t and r.observed_at>t-interval '300 seconds';
 -- Existence uses existing partial lease/delivery indexes; no per-user lists,
 -- token/attempt IDs or full backlog counts escape through the read model.
 expired:=exists(select 1 from public.notification_push_attempts where lease_until<=t);
 overdue:=exists(select 1 from public.notification_deliveries where channel='PUSH' and state in('CREATED','QUEUED','FAILED_RETRYABLE')
  and created_at<t-interval '15 minutes' and (expires_at is null or expires_at>t));
 if not fresh then state:='UNKNOWN';reason:=case when r.observed_at is null then 'NO_RUNTIME_OBSERVATION' else 'STALE_RUNTIME_OBSERVATION' end;
 elsif r.observation='PROBE_DISABLED' then state:='NOT_READY';reason:='DEPLOYMENT_DISABLED';
 elsif expired or overdue then state:='DEGRADED';reason:=case when expired then 'EXPIRED_LEASE' else 'OVERDUE_BACKLOG' end;
 elsif r.observation in('TICK_DEGRADED','TICK_FAILED') then state:='DEGRADED';reason:='LAST_TICK_UNHEALTHY';
 elsif r.observation='TICK_OK' and r.last_success_at=r.observed_at then state:='OPERATIONAL';reason:='HEALTHY_TRANSPORT_TICK';
 else state:='UNKNOWN';reason:='SUCCESSFUL_TICK_NOT_OBSERVED';end if;
 return jsonb_build_object('state',state,'reason',reason,'checkedAt',t,'observedAt',r.observed_at,'lastSuccessAt',r.last_success_at,
  'freshnessSeconds',300,'overdueWindowSeconds',900,'fresh',fresh,'senderVersion',r.sender_version,
  'senderDeployment',case when fresh then 'RUNTIME_OBSERVED' else 'UNKNOWN' end,
  'senderConfiguration',case when not fresh then 'UNKNOWN' when r.observation='PROBE_DISABLED' then 'DISABLED' else 'ENABLED' end,
  'expiredLease',expired,'overdueBacklog',overdue,'evidenceScope','TRANSPORT_ONLY','authoritative',true);
end;
$f$;
revoke all on function public.rpc_record_push_readiness(text,text),public.rpc_get_push_readiness() from public,anon,authenticated,service_role;
grant execute on function public.rpc_record_push_readiness(text,text) to service_role;
grant execute on function public.rpc_get_push_readiness() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
