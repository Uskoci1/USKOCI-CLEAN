-- USKOCI RU-5 / P0C-01 + P0C-03 + P0C-05
-- Public-safe profile + own-Application + Requester Candidate DTO candidate. PROOF BRANCH ONLY.
-- Raw requester reads of Application rows/versions are removed; Worker own reads remain.

begin;

create or replace function public.rpc_get_public_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_profile public.app_profiles%rowtype;
  v_completed integer := 0;
  v_rating numeric;
begin
  select * into v_profile
  from public.app_profiles
  where id = p_profile_id
    and profile_status = 'ACTIVE';

  if not found then
    return null;
  end if;

  if v_profile.kind = 'WORKER' then
    select count(*)::integer into v_completed
    from public.agreements a
    where a.worker_profile_id = v_profile.id
      and a.status = 'COMPLETED';
    v_rating := v_profile.rating_worker;
  elsif v_profile.kind = 'REQUESTER' then
    select count(*)::integer into v_completed
    from public.agreements a
    where a.requester_profile_id = v_profile.id
      and a.status = 'COMPLETED';
    v_rating := v_profile.rating_requester;
  else
    return null;
  end if;

  return jsonb_build_object(
    'profileId', v_profile.id,
    'role', v_profile.kind,
    'displayName', nullif(btrim(v_profile.display_name), ''),
    -- profile-media is private; raw storage paths are not a public-media DTO.
    'avatarUrl', null,
    'city', nullif(btrim(v_profile.city), ''),
    'bio', nullif(btrim(v_profile.bio), ''),
    'ratingAverage', v_rating,
    -- No canonical review owner exists in live-71; never invent a review count.
    'reviewCount', null,
    'completedCount', v_completed,
    -- Identity verification remains fail-closed until its precise current owner exists.
    'verificationStatus', null,
    'authoritative', true
  );
end;
$function$;

revoke all on function public.rpc_get_public_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_get_public_profile(uuid)
  to anon, authenticated;

create or replace function public.rpc_visible_need_response_counts(p_need_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  select coalesce(jsonb_object_agg(x.need_id::text, x.visible_count), '{}'::jsonb)
  into v_result
  from (
    select n.id as need_id,
           case
             when v_uid is not null and n.requester_account_id = v_uid then
               count(r.id) filter (where r.status <> 'DRAFT')
             when v_uid is not null then
               count(r.id) filter (where r.status <> 'DRAFT' and r.worker_account_id = v_uid)
             else 0
           end::integer as visible_count
    from public.needs n
    left join public.marketplace_responses r on r.need_id = n.id
    where n.id = any(coalesce(p_need_ids, '{}'::uuid[]))
    group by n.id, n.requester_account_id
  ) x;

  return coalesce(v_result, '{}'::jsonb);
end;
$function$;

revoke all on function public.rpc_visible_need_response_counts(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_visible_need_response_counts(uuid[])
  to anon, authenticated;

create or replace function public.rpc_list_my_applications()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'responseId', r.id,
    'needId', r.need_id,
    'title', n.title,
    'description', n.description,
    'needRevision', n.revision,
    'submittedNeedRevision', r.submitted_against_need_revision,
    'version', r.current_version,
    'status', r.status,
    'changedNeed', (r.status in ('STALE','STALE_REVIEW_REQUIRED') or n.revision <> r.submitted_against_need_revision),
    'priceRsd', r.price_rsd,
    'coveredSlots', r.covered_slots,
    'note', nullif(btrim(r.scope_note), ''),
    'area', n.approximate_area,
    'city', n.approximate_city,
    'startsAt', n.starts_at,
    'remainingSearchClosedAt', n.remaining_search_closed_at,
    'snapshotSchema', coalesce(v.snapshot_schema, 'LEGACY_UNPROVEN'),
    'snapshotHash', case when v.snapshot_schema = 'RU5_WORKER_CONTEXT_V1' then v.snapshot_hash else null end,
    'authoritative', true
  ) order by r.submitted_at desc nulls last, r.id desc), '[]'::jsonb)
  into v_rows
  from public.marketplace_responses r
  join public.needs n on n.id = r.need_id
  left join public.marketplace_response_versions v
    on v.response_id = r.id and v.version = r.current_version
  where r.worker_account_id = v_uid;

  return v_rows;
end;
$function$;

revoke all on function public.rpc_list_my_applications()
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_list_my_applications()
  to authenticated;

create or replace function public.rpc_list_requester_candidates(p_need_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_need public.needs%rowtype;
  v_covered integer;
  v_remaining integer;
  v_rows jsonb := '[]'::jsonb;
  rec record;
  v_match jsonb;
  v_state text;
  v_reason text;
  v_snapshot jsonb;
  v_schema text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_need
  from public.needs
  where id = p_need_id;

  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_need.requester_account_id <> v_uid then
    raise exception 'NOT_REQUESTER' using errcode = '42501';
  end if;

  v_covered := public.fn_need_covered_slots(p_need_id);
  v_remaining := greatest(v_need.required_slots - v_covered, 0);

  for rec in
    select r.id,
           r.status,
           r.worker_account_id,
           r.worker_profile_id,
           r.current_version,
           r.submitted_against_need_revision,
           r.covered_slots,
           r.price_rsd,
           r.proposed_start_at,
           r.proposed_end_at,
           v.need_revision as version_need_revision,
           v.content_hash,
           v.scope_note,
           v.snapshot_schema,
           v.worker_context_snapshot,
           v.snapshot_hash,
           p.display_name,
           p.city,
           p.rating_worker
    from public.marketplace_responses r
    join public.marketplace_response_versions v
      on v.response_id = r.id and v.version = r.current_version
    join public.app_profiles p on p.id = r.worker_profile_id
    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
    order by r.submitted_at asc nulls last, r.id asc
  loop
    v_match := private.match_detail(p_need_id, rec.worker_profile_id);
    v_schema := coalesce(rec.snapshot_schema, 'LEGACY_UNPROVEN');
    v_snapshot := case
      when rec.snapshot_schema = 'RU5_WORKER_CONTEXT_V1' then rec.worker_context_snapshot
      else null
    end;

    v_reason := null;
    if rec.status = 'SELECTED' then
      v_state := 'SELECTED';
    elsif rec.status = 'WITHDRAWN' then
      v_state := 'WITHDRAWN';
    elsif rec.status in ('STALE','STALE_REVIEW_REQUIRED')
       or rec.submitted_against_need_revision <> v_need.revision
       or rec.version_need_revision <> v_need.revision then
      v_state := 'STALE_REVIEW_REQUIRED';
      v_reason := 'NEED_REVISION_CHANGED';
    elsif rec.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
       and v_need.status in ('PUBLISHED','SELECTION')
       and (v_need.response_deadline is null or v_need.response_deadline > statement_timestamp())
       and coalesce((v_match->>'responseAllowed')::boolean, false)
       and rec.covered_slots <= v_remaining then
      v_state := 'SELECTABLE';
    else
      v_state := 'CLOSED';
      if v_need.status not in ('PUBLISHED','SELECTION') then
        v_reason := 'NEED_NOT_OPEN';
      elsif v_need.response_deadline is not null and v_need.response_deadline <= statement_timestamp() then
        v_reason := 'RESPONSE_WINDOW_EXPIRED';
      elsif not coalesce((v_match->>'responseAllowed')::boolean, false) then
        v_reason := 'WORKER_NO_LONGER_ELIGIBLE';
      elsif rec.covered_slots > v_remaining then
        v_reason := 'OVERFILL';
      else
        v_reason := 'RESPONSE_NOT_SELECTABLE';
      end if;
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'responseId', rec.id,
      'version', rec.current_version,
      'contentHash', rec.content_hash,
      'needRevision', rec.version_need_revision,
      'candidateState', v_state,
      'notSelectableReason', v_reason,
      'workerProfileId', rec.worker_profile_id,
      'displayName', coalesce(v_snapshot->>'displayName', nullif(btrim(rec.display_name), '')),
      'city', coalesce(v_snapshot->>'city', nullif(btrim(rec.city), '')),
      'ratingAverage', rec.rating_worker,
      'priceRsd', rec.price_rsd,
      'pricingMode', v_need.mode,
      'coveredSlots', rec.covered_slots,
      'remainingSlots', v_remaining,
      'proposedStartAt', rec.proposed_start_at,
      'proposedEndAt', rec.proposed_end_at,
      -- Legacy free text is intentionally not projected. V1 note passed RU-5 policy at write time.
      'note', case when rec.snapshot_schema = 'RU5_WORKER_CONTEXT_V1' then nullif(btrim(rec.scope_note), '') else null end,
      'snapshotSchema', v_schema,
      'snapshotHash', case when rec.snapshot_schema = 'RU5_WORKER_CONTEXT_V1' then rec.snapshot_hash else null end,
      'resourceSummary', case
        when rec.snapshot_schema = 'RU5_WORKER_CONTEXT_V1' then jsonb_build_object(
          'matchedSkills', coalesce(v_snapshot->'matchedSkills', '[]'::jsonb),
          'matchedTools', coalesce(v_snapshot->'matchedTools', '[]'::jsonb),
          'matchedLicenses', coalesce(v_snapshot->'matchedLicenses', '[]'::jsonb),
          'matchedVehicles', coalesce(v_snapshot->'matchedVehicles', '[]'::jsonb),
          'yearsExperienceAtSubmit', v_snapshot->'yearsExperienceAtSubmit'
        )
        else null
      end,
      'teamSummary', case
        when rec.snapshot_schema = 'RU5_WORKER_CONTEXT_V1' then jsonb_build_object(
          'teamCapacityAtSubmit', v_snapshot->'teamCapacityAtSubmit',
          'coveredSlots', v_snapshot->'coveredSlots'
        )
        else null
      end,
      'authoritative', true
    ));
  end loop;

  return v_rows;
end;
$function$;

revoke all on function public.rpc_list_requester_candidates(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_list_requester_candidates(uuid)
  to authenticated;

-- Requester must use the canonical safe Candidate DTO. Raw Application rows remain
-- readable only by their Worker owner. This prevents legacy scope_note/version data
-- from becoming an alternate preselection privacy API.
drop policy if exists responses_requester_read on public.marketplace_responses;

drop policy if exists response_versions_read on public.marketplace_response_versions;
drop policy if exists response_versions_worker_read on public.marketplace_response_versions;
create policy response_versions_worker_read
on public.marketplace_response_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.marketplace_responses r
    where r.id = marketplace_response_versions.response_id
      and r.worker_account_id = auth.uid()
  )
);

comment on function public.rpc_get_public_profile(uuid) is
  'RU-5 P0C-01 public-safe ACTIVE role profile DTO. No raw app_profiles RLS broadening; no private storage path/contact/evidence.';
comment on function public.rpc_list_my_applications() is
  'RU-5 P0C-03 authenticated Worker own-Application DTO preserving RU-4 stale lifecycle while removing client-side raw joins.';
comment on function public.rpc_list_requester_candidates(uuid) is
  'RU-5 P0C-05 Requester-owned Need candidate DTO with canonical SELECTABLE state and LEGACY_UNPROVEN snapshot handling.';
comment on function public.rpc_visible_need_response_counts(uuid[]) is
  'RU-5 compatibility projection preserving viewer-scoped Need response counts after raw Requester Application reads are closed.';

commit;
