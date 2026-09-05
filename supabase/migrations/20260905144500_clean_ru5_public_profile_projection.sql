-- RU-5 / P0C-01 — public-safe profile projection.
-- Proof-branch candidate only until disposable authenticated proof is green.
-- Governing invariant: do not broaden raw app_profiles RLS.

create or replace function public.rpc_public_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $function$
declare
  p public.app_profiles%rowtype;
  completed_count bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_profile_id is null then
    return null;
  end if;

  select *
    into p
    from public.app_profiles
   where id = p_profile_id
     and profile_status = 'ACTIVE'
     and kind in ('REQUESTER', 'WORKER');

  if not found then
    return null;
  end if;

  select count(distinct a.id)
    into completed_count
    from public.agreements a
    join public.agreement_execution e on e.agreement_id = a.id
   where e.completed_at is not null
     and (
       (p.kind = 'REQUESTER' and a.requester_profile_id = p.id)
       or
       (p.kind = 'WORKER' and a.worker_profile_id = p.id)
     );

  return jsonb_build_object(
    'profileId', p.id,
    'role', p.kind,
    'displayName', p.display_name,
    'avatarUrl', null,
    'city', p.city,
    'headline', nullif(p.headline, ''),
    'bio', nullif(p.bio, ''),
    'completedWorkCount', completed_count,
    'reputation', jsonb_build_object(
      'available', false,
      'ratingAverage', null,
      'reviewCount', null
    ),
    'identityVerified', false,
    'publicCapabilities', null
  );
end;
$function$;

revoke all on function public.rpc_public_profile(uuid) from public;
revoke all on function public.rpc_public_profile(uuid) from anon;
grant execute on function public.rpc_public_profile(uuid) to authenticated;
