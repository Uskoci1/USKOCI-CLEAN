-- PRE-V3 P02: additive owner/revision-bound capacity over the existing column.
-- Source admission only; deploy this before the new client; enforcement is P03.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
begin
  if to_regprocedure('public.rpc_save_worker_location(text,jsonb,boolean)') is null
    or to_regprocedure('public.rpc_save_worker_availability(text,jsonb)') is null
    or not exists(select 1 from pg_attribute where attrelid='public.app_profiles'::regclass and attname='team_capacity' and not attisdropped)
  then raise exception 'PRE_V3_WORKER_PREDECESSOR_MISSING'; end if;
end;
$preflight$;

create function private.worker_capacity_document(pid uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $function$
  with material as (
    select jsonb_build_object('accountId',p.account_id,'profileId',p.id,'teamCapacity',p.team_capacity,
      'status',p.profile_status) as doc
    from public.app_profiles p where p.id=pid and p.kind='WORKER'
  ) select (doc-'status')||jsonb_build_object('revision',encode(extensions.digest(doc::text,'sha256'),'hex')) from material;
$function$;
revoke all on function private.worker_capacity_document(uuid) from public,anon,authenticated,service_role;

create function public.rpc_get_worker_capacity()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $function$
declare p public.app_profiles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER';
  if not found then raise exception 'WORKER_PROFILE_REQUIRED' using errcode='55000'; end if;
  if p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  return private.worker_capacity_document(p.id);
end;
$function$;
revoke all on function public.rpc_get_worker_capacity() from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_worker_capacity() to authenticated;

-- One snapshot supplies existing edit fields plus authoritative allocation and
-- revision. It intentionally does not expose private matching-preference data.
create function public.rpc_get_worker_profile_for_edit()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $function$
declare p public.app_profiles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER';
  if not found then return null; end if;
  if p.profile_status not in ('DRAFT','ACTIVE','SUSPENDED') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  return jsonb_build_object('id',p.id,'account_id',p.account_id,'kind',p.kind,
    'display_name',p.display_name,'city',p.city,'bio',p.bio,'skills',p.skills,'tools',p.tools,
    'vehicles',p.vehicles,'profile_status',p.profile_status,'available_now',p.available_now,
    'radius_km',p.radius_km,'team_capacity',p.team_capacity,
    'capacity_revision',private.worker_capacity_document(p.id)->>'revision');
end;
$function$;
revoke all on function public.rpc_get_worker_profile_for_edit() from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_worker_profile_for_edit() to authenticated;

-- jsonb avoids PostgreSQL coercing a decimal or numeric string into an integer
-- before the function can validate it. Existing profile bound remains 1..50.
create function public.rpc_save_worker_capacity(p_expected_revision text,p_team_capacity jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $function$
declare p public.app_profiles; before_doc jsonb; wanted integer; prior_token text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_team_capacity) is distinct from 'number' then
    raise exception 'WORKER_CAPACITY_INPUT_INVALID' using errcode='22023';
  end if;
  if (p_team_capacity#>>'{}')::numeric <> trunc((p_team_capacity#>>'{}')::numeric)
    or (p_team_capacity#>>'{}')::numeric not between 1 and 50 then
    raise exception 'WORKER_CAPACITY_INPUT_INVALID' using errcode='22023';
  end if;
  wanted:=(p_team_capacity#>>'{}')::integer;
  -- Existing submit/selection also lock this profile. No second allocation model.
  select * into p from public.app_profiles where account_id=auth.uid() and kind='WORKER' for update;
  if not found then raise exception 'WORKER_PROFILE_REQUIRED' using errcode='55000'; end if;
  if p.profile_status not in ('DRAFT','ACTIVE') then raise exception 'WORKER_PROFILE_RESTRICTED' using errcode='42501'; end if;
  before_doc:=private.worker_capacity_document(p.id);
  if p.team_capacity=wanted then
    return jsonb_build_object('saved',true,'idempotentReplay',true,'capacity',before_doc);
  end if;
  if before_doc->>'revision'<>p_expected_revision then
    raise exception 'WORKER_CAPACITY_VERSION_CONFLICT' using errcode='40001';
  end if;
  prior_token:=current_setting('uskoci.profile_mutation',true);
  perform set_config('uskoci.profile_mutation','CAPACITY_REVIEW',true);
  update public.app_profiles set team_capacity=wanted where id=p.id;
  perform set_config('uskoci.profile_mutation',coalesce(prior_token,''),true);
  return jsonb_build_object('saved',true,'idempotentReplay',false,'capacity',private.worker_capacity_document(p.id));
end;
$function$;
revoke all on function public.rpc_save_worker_capacity(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.rpc_save_worker_capacity(text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
