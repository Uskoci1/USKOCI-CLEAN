-- USKOČI RU-5 / P0D-01 — REQUESTER CANDIDATE PROJECTION
--
-- Read-only Requester projection over existing Application/version/profile/snapshot
-- authority. This migration does not mutate response state and does not change
-- rpc_select_response, Selection, Agreement, calendar, Povezivanje or monetization.

begin;

do $p0d01_preflight$
begin
  if to_regclass('public.marketplace_responses') is null
     or to_regclass('public.marketplace_response_versions') is null
     or to_regclass('public.needs') is null
     or to_regclass('public.need_selections') is null
     or to_regclass('private.response_application_snapshots') is null then
    raise exception 'RU5_P0D01_PREDECESSOR_MISMATCH: candidate source tables missing';
  end if;

  if to_regprocedure('public.rpc_get_public_profile(uuid)') is null
     or to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)') is null
     or to_regprocedure('private.match_detail(uuid,uuid)') is null then
    raise exception 'RU5_P0D01_PREDECESSOR_MISMATCH: profile/match/selection authority missing';
  end if;
end
$p0d01_preflight$;

create or replace function public.rpc_list_need_candidates(p_need_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_actor uuid := auth.uid();
  v_need public.needs;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;
  if p_need_id is null then
    raise exception using errcode='22023', message='NEED_ID_REQUIRED';
  end if;

  select n.* into v_need
  from public.needs n
  where n.id = p_need_id;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception using errcode='42501', message='NOT_REQUESTER';
  end if;

  select coalesce(sum(s.covered_slots),0)::integer
  into v_selected_slots
  from public.need_selections s
  where s.need_id = p_need_id
    and s.status = 'SELECTED';

  v_remaining_slots := greatest(coalesce(v_need.required_slots,1) - v_selected_slots, 0);

  with candidate_rows as (
    select
      r.id as response_id,
      r.worker_profile_id,
      r.status as raw_response_status,
      r.current_version,
      r.submitted_against_need_revision,
      r.submitted_at,
      v.need_revision as version_need_revision,
      v.content_hash,
      v.price_rsd,
      v.covered_slots,
      v.proposed_start_at,
      v.proposed_end_at,
      v.scope_note,
      snap.snapshot_schema,
      snap.worker_team_capacity,
      snap.worker_skills,
      snap.worker_tools,
      snap.worker_licenses,
      snap.worker_vehicles,
      public.rpc_get_public_profile(r.worker_profile_id) as public_profile,
      private.match_detail(p_need_id,r.worker_profile_id) as match_detail,
      exists(
        select 1
        from public.agreements a
        where a.selected_response_id = r.id
      ) as has_agreement
    from public.marketplace_responses r
    left join public.marketplace_response_versions v
      on v.response_id = r.id
     and v.version = r.current_version
    left join private.response_application_snapshots snap
      on snap.response_id = r.id
     and snap.response_version = r.current_version
    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), classified as (
    select
      c.*,
      case
        when c.has_agreement or c.raw_response_status = 'SELECTED' then 'SELECTED'
        when c.raw_response_status = 'WITHDRAWN' then 'WITHDRAWN'
        when c.raw_response_status in ('NOT_SELECTED','EXPIRED') then 'CLOSED'
        -- ACTIVE is the existing full-capacity execution state produced by
        -- rpc_select_response. It is not a terminal candidate lifecycle state;
        -- non-selected Applications under a full ACTIVE Need project as FULL.
        when coalesce(v_need.status,'') in ('DRAFT','COMPLETED','CANCELLED','EXPIRED','ARCHIVED') then 'CLOSED'
        when v_need.response_deadline is not null
             and v_need.response_deadline <= statement_timestamp() then 'CLOSED'
        when c.raw_response_status in ('STALE','STALE_REVIEW_REQUIRED')
          or c.current_version is null
          or c.content_hash is null
          or c.version_need_revision is distinct from v_need.revision
          or c.submitted_against_need_revision is distinct from v_need.revision
          or coalesce((c.match_detail->>'responseAllowed')::boolean,false) is not true
          then 'STALE'
        when v_remaining_slots <= 0 then 'FULL'
        when c.covered_slots > v_remaining_slots then 'OVERFILL'
        when c.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then 'SELECTABLE'
        else 'CLOSED'
      end as candidate_state
    from candidate_rows c
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'responseId', c.response_id,
        'workerProfileId', c.worker_profile_id,
        'needRevision', v_need.revision,
        'responseNeedRevision', c.version_need_revision,
        'version', c.current_version,
        'contentHash', c.content_hash,
        'state', c.candidate_state,
        'canSelect', c.candidate_state = 'SELECTABLE',
        'priceRsd', c.price_rsd,
        'coveredSlots', c.covered_slots,
        'remainingSlots', v_remaining_slots,
        'proposedStartAt', c.proposed_start_at,
        'proposedEndAt', c.proposed_end_at,
        'scopeNote', coalesce(c.scope_note,''),
        'publicProfile', c.public_profile,
        'applicationEvidence', case
          when c.snapshot_schema is null then jsonb_build_object(
            'schema','LEGACY_UNPROVEN',
            'teamCapacity',null,
            'skills',null,
            'tools',null,
            'licenses',null,
            'vehicles',null
          )
          else jsonb_build_object(
            'schema',c.snapshot_schema,
            'teamCapacity',c.worker_team_capacity,
            'skills',to_jsonb(c.worker_skills),
            'tools',to_jsonb(c.worker_tools),
            'licenses',to_jsonb(c.worker_licenses),
            'vehicles',to_jsonb(c.worker_vehicles)
          )
        end
      )
      order by c.submitted_at asc nulls last, c.response_id
    ),
    '[]'::jsonb
  )
  into v_result
  from classified c;

  return v_result;
end;
$function$;

revoke all on function public.rpc_list_need_candidates(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.rpc_list_need_candidates(uuid) to authenticated;

comment on function public.rpc_list_need_candidates(uuid) is
  'RU-5 P0D-01 requester-owner candidate projection. Maps raw Application/version/profile/snapshot authority to SELECTABLE/STALE/OVERFILL/SELECTED/WITHDRAWN/CLOSED/FULL without response mutation. Exact version/hash is returned for later selection binding. No ranking policy, calendar commitment, Povezivanje activation or selection semantic ledger is created here.';

do $p0d01_postconditions$
declare
  v_def text;
begin
  if not has_function_privilege('authenticated','public.rpc_list_need_candidates(uuid)','EXECUTE')
     or has_function_privilege('anon','public.rpc_list_need_candidates(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.rpc_list_need_candidates(uuid)','EXECUTE') then
    raise exception 'RU5_P0D01_POSTCONDITION_FAILED: projection grants';
  end if;

  v_def := pg_get_functiondef('public.rpc_list_need_candidates(uuid)'::regprocedure);
  if position('requester_account_id <> v_actor' in v_def)=0
     or position('SELECTABLE' in v_def)=0
     or position('LEGACY_UNPROVEN' in v_def)=0
     or position('contentHash' in v_def)=0 then
    raise exception 'RU5_P0D01_POSTCONDITION_FAILED: projection markers';
  end if;

  if has_table_privilege('authenticated','public.marketplace_responses','UPDATE')
     or has_table_privilege('authenticated','public.marketplace_responses','INSERT')
     or has_table_privilege('authenticated','public.marketplace_response_versions','INSERT') then
    raise exception 'RU5_P0D01_POSTCONDITION_FAILED: direct response write exposure';
  end if;
end
$p0d01_postconditions$;

commit;
