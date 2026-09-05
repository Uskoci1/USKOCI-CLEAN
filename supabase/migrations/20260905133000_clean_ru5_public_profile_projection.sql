begin;

create or replace function public.rpc_get_public_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.app_profiles;
  v_completed bigint := 0;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_profile_id is null then
    raise exception 'PROFILE_ID_REQUIRED' using errcode = '22023';
  end if;

  select p.*
  into v_profile
  from public.app_profiles p
  where p.id = p_profile_id
    and p.profile_status = 'ACTIVE'
    and p.kind in ('REQUESTER', 'WORKER');

  if not found then
    return null;
  end if;

  if v_profile.kind = 'REQUESTER' then
    select count(*)
    into v_completed
    from public.agreements a
    where a.requester_profile_id = v_profile.id
      and a.status = 'COMPLETED';
  else
    select count(*)
    into v_completed
    from public.agreements a
    where a.worker_profile_id = v_profile.id
      and a.status = 'COMPLETED';
  end if;

  return jsonb_build_object(
    'profileId', v_profile.id,
    'role', v_profile.kind,
    'displayName', nullif(btrim(v_profile.display_name), ''),
    'avatarPath', v_profile.avatar_path,
    'city', nullif(btrim(v_profile.city), ''),
    'publicSummary', jsonb_build_object(
      'headline', case when v_profile.kind = 'WORKER' then nullif(btrim(v_profile.headline), '') else null end,
      'bio', case when v_profile.kind = 'WORKER' then nullif(btrim(v_profile.bio), '') else null end
    ),
    'trust', jsonb_build_object(
      'ratingAverage', null,
      'reviewCount', null,
      'completedCount', v_completed,
      'identityVerified', false,
      'ratingAvailable', false,
      'reviewsAvailable', false,
      'identityVerificationAvailable', false
    )
  );
end;
$$;

revoke all on function public.rpc_get_public_profile(uuid) from public, anon, authenticated;
grant execute on function public.rpc_get_public_profile(uuid) to authenticated;

comment on function public.rpc_get_public_profile(uuid) is
  'RU-5 P0C-01 candidate: authenticated public-safe ACTIVE role-profile projection. Raw app_profiles RLS remains owner-only. No phone/email/exact location, operational capability inventory, cached rating, review fabrication, matcher score, verification evidence, or hidden safety data. Role-scoped completed count is derived only from canonical COMPLETED agreements.';

commit;
