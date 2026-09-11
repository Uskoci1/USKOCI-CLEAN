-- PRE-V3 P03: restrictive single-writer enforcement. Apply ONLY after P01/P02
-- compatible client rollout/old-client admission; never edit applied history.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
  if to_regprocedure('public.rpc_save_worker_capacity(text,jsonb)') is null
    or (select md5(prosrc) from pg_proc where oid='public.rpc_save_worker_location(text,jsonb,boolean)'::regprocedure)
      is distinct from 'a2869dcdfa8e6b9088d1c61bb60f8027'
    or (select md5(prosrc) from pg_proc where oid='public.rpc_save_worker_availability(text,jsonb)'::regprocedure)
      is distinct from '83eb546cf2ca5927cbefa5413ca57735'
  then raise exception 'PRE_V3_WORKER_AUTHORITY_PREDECESSOR_CHANGED'; end if;
end;
$preflight$;

-- Transform only the scoped token lifetimes of the exact preflight bodies.
-- All original validation, ownership, revisions and idempotent readback remain.
do $rewrite$
declare definition text;
begin
  definition:=pg_get_functiondef('public.rpc_save_worker_location(text,jsonb,boolean)'::regprocedure);
  definition:=replace(definition,E'  perform set_config(\'uskoci.profile_mutation\',coalesce(previous_token,\'\'),true);\n','');
  definition:=replace(definition,
    '  return jsonb_build_object(''saved'',true,''idempotentReplay'',false,''location''',
    E'  perform set_config(\'uskoci.profile_mutation\',coalesce(previous_token,\'\'),true);\n  return jsonb_build_object(\'saved\',true,\'idempotentReplay\',false,\'location\'');
  execute definition;
  definition:=pg_get_functiondef('public.rpc_save_worker_availability(text,jsonb)'::regprocedure);
  definition:=replace(definition,'zone text;','zone text; previous_token text;');
  definition:=replace(definition,'  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,timezone)',
    E'  previous_token:=current_setting(\'uskoci.profile_mutation\',true);\n  perform set_config(\'uskoci.profile_mutation\',\'AVAILABILITY_REVIEW\',true);\n  insert into public.worker_match_preferences(worker_profile_id,worker_account_id,timezone)');
  definition:=replace(definition,'  after_doc:=private.worker_availability_document(p.id);',
    E'  perform set_config(\'uskoci.profile_mutation\',coalesce(previous_token,\'\'),true);\n  after_doc:=private.worker_availability_document(p.id);');
  execute definition;
end;
$rewrite$;

-- Keep the existing guard (activation/identity/ratings/resources) unchanged.
-- This additional trigger protects only the three newly frozen fact groups.
create function private.guard_worker_fact_authority()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $function$
declare token text:=nullif(current_setting('uskoci.profile_mutation',true),'');
begin
  if new.kind<>'WORKER' or auth.role() is distinct from 'authenticated' then return new; end if;
  if tg_op='INSERT' then
    -- Structural bootstrap defaults are not user choices. Auth signup is a
    -- separate trusted trigger; unprivileged insertion cannot prefill these.
    if (new.city<>'' or new.radius_km<>15) and token is distinct from 'LOCATION_REVIEW' then
      raise exception 'PROFILE_LOCATION_REQUIRES_REVIEW' using errcode='42501';
    end if;
    if new.available_now and token is distinct from 'AVAILABILITY_REVIEW' then
      raise exception 'PROFILE_AVAILABILITY_REQUIRES_REVIEW' using errcode='42501';
    end if;
    if new.team_capacity<>1 and token is distinct from 'CAPACITY_REVIEW' then
      raise exception 'PROFILE_CAPACITY_REQUIRES_REVIEW' using errcode='42501';
    end if;
  else
    if (new.city is distinct from old.city or new.radius_km is distinct from old.radius_km)
       and token is distinct from 'LOCATION_REVIEW' then
      raise exception 'PROFILE_LOCATION_REQUIRES_REVIEW' using errcode='42501';
    end if;
    if new.available_now is distinct from old.available_now and token is distinct from 'AVAILABILITY_REVIEW' then
      raise exception 'PROFILE_AVAILABILITY_REQUIRES_REVIEW' using errcode='42501';
    end if;
    if new.team_capacity is distinct from old.team_capacity and token is distinct from 'CAPACITY_REVIEW' then
      raise exception 'PROFILE_CAPACITY_REQUIRES_REVIEW' using errcode='42501';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_worker_fact_authority() from public,anon,authenticated,service_role;
create trigger pre_v3_worker_fact_authority before insert or update on public.app_profiles
  for each row execute function private.guard_worker_fact_authority();

create function private.guard_worker_preference_authority()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $function$
declare token text:=nullif(current_setting('uskoci.profile_mutation',true),'');
begin
  if auth.role() is distinct from 'authenticated' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then
    raise exception 'WORKER_PREFERENCES_REQUIRE_AUTHORITY' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if (new.approximate_lat is not null or new.approximate_lng is not null) and token is distinct from 'LOCATION_REVIEW' then
      raise exception 'PROFILE_LOCATION_REQUIRES_REVIEW' using errcode='42501';
    end if;
    if new.timezone<>'Europe/Belgrade' and token is distinct from 'AVAILABILITY_REVIEW' then
      raise exception 'PROFILE_AVAILABILITY_REQUIRES_REVIEW' using errcode='42501';
    end if;
  else
    if (new.approximate_lat is distinct from old.approximate_lat or new.approximate_lng is distinct from old.approximate_lng)
       and token is distinct from 'LOCATION_REVIEW' then
      raise exception 'PROFILE_LOCATION_REQUIRES_REVIEW' using errcode='42501';
    end if;
    if new.timezone is distinct from old.timezone and token is distinct from 'AVAILABILITY_REVIEW' then
      raise exception 'PROFILE_AVAILABILITY_REQUIRES_REVIEW' using errcode='42501';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_worker_preference_authority() from public,anon,authenticated,service_role;
create trigger pre_v3_worker_preference_authority before insert or update or delete on public.worker_match_preferences
  for each row execute function private.guard_worker_preference_authority();

-- Existing owner RLS, allocation locks and rule/window ACLs remain intact.
notify pgrst,'reload schema';
commit;
