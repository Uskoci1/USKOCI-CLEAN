-- USKOČI RU-5 — MANUAL SELECTION ELIGIBILITY REVALIDATION
--
-- Forward-only safety repair admitted after P0D-01 live closure.
-- Scope is deliberately narrow:
--   1) rpc_select_response rechecks the current RU-1 minimum Worker readiness
--      and current team_capacity at the exact selection boundary;
--   2) rpc_list_need_candidates uses the same current readiness/team-capacity
--      facts so an invalid legacy Application is no longer projected SELECTABLE.
--
-- This migration does NOT rewrite historical Applications/Selections/Agreements,
-- does NOT add Selection idempotency semantics, calendar hard-conflict authority,
-- Povezivanje, monetization, D0140/RU-4B activation, note policy or Application AI.

begin;

do $selection_revalidation_preflight$
begin
  if to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)') is null then
    raise exception 'RU5_SELECTION_REVALIDATION_PREDECESSOR_MISMATCH: selection RPC missing';
  end if;
  if to_regprocedure('public.rpc_list_need_candidates(uuid)') is null then
    raise exception 'RU5_SELECTION_REVALIDATION_PREDECESSOR_MISMATCH: candidate projection missing';
  end if;
  if to_regprocedure('private.match_detail(uuid,uuid)') is null
     or to_regclass('public.app_profiles') is null then
    raise exception 'RU5_SELECTION_REVALIDATION_PREDECESSOR_MISMATCH: worker authority missing';
  end if;
end
$selection_revalidation_preflight$;

create or replace function public.rpc_select_response(
  p_need_id uuid,
  p_need_revision integer,
  p_response_id uuid,
  p_response_version integer,
  p_content_hash text,
  p_client_request_id text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  uid uuid := auth.uid();
  v_need public.needs%rowtype;
  v_resp public.marketplace_responses%rowtype;
  v_ver public.marketplace_response_versions%rowtype;
  v_profile public.app_profiles%rowtype;
  v_selection_id uuid; v_agreement_id uuid; v_covered integer; v_terms jsonb;
  v_match jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  -- Preserve the existing Selection replay behavior in this unit. Semantic
  -- request-hash idempotency is a separately proven gap and is NOT changed here.
  select a.id into v_agreement_id
    from public.need_selections s
    join public.agreements a on a.selection_id = s.id
   where s.need_id = p_need_id and s.client_request_id = p_client_request_id;
  if found then return v_agreement_id; end if;

  select * into v_need from public.needs where id = p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_need.requester_account_id <> uid then raise exception 'NOT_REQUESTER' using errcode = '42501'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then
    raise exception 'NEED_NOT_OPEN' using errcode = 'P0001', detail = v_need.status; end if;

  if v_need.response_deadline is not null
     and v_need.response_deadline <= statement_timestamp() then
    raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode = 'P0001',
      hint = 'Rok za prijave je istekao.';
  end if;

  if v_need.revision <> p_need_revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'need_revision',
      hint = 'Potreba je izmenjena. Pogledajte prijave ponovo.'; end if;

  select * into v_resp from public.marketplace_responses where id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_resp.need_id <> p_need_id then raise exception 'RESPONSE_NEED_MISMATCH' using errcode = 'P0001'; end if;
  if v_resp.status not in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then
    raise exception 'RESPONSE_NOT_SELECTABLE' using errcode = 'P0001', detail = v_resp.status; end if;

  if v_resp.current_version <> p_response_version then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_version',
      hint = 'Uskocer je izmenio prijavu. Proverite je ponovo.'; end if;

  select * into v_ver from public.marketplace_response_versions
   where response_id = p_response_id and version = p_response_version;
  if not found then raise exception 'RESPONSE_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ver.content_hash <> p_content_hash then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'content_hash',
      hint = 'Uslovi prijave su izmenjeni.'; end if;
  if v_ver.need_revision <> v_need.revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_need_revision'; end if;

  -- P0C-02 established the current RU-1 minimum at Application submit. Selection
  -- must repeat the same minimum for legacy ACTIVE rows and for profile changes
  -- made after submit. The row lock keeps these facts stable through Agreement
  -- creation in this transaction.
  select * into v_profile
    from public.app_profiles p
   where p.id = v_resp.worker_profile_id
   for share;

  if not found
     or v_profile.kind <> 'WORKER'
     or v_profile.account_id <> v_resp.worker_account_id
     or v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or char_length(btrim(v_profile.city)) < 2
     or cardinality(v_profile.skills) < 1 then
    raise exception 'WORKER_PROFILE_NOT_READY' using errcode = 'P0001',
      hint = 'Uskocer vise nema vazeci spreman profil za izbor.';
  end if;

  if v_ver.covered_slots > v_profile.team_capacity then
    raise exception 'TEAM_CAPACITY_EXCEEDED' using errcode = 'P0001',
      detail = format('covered=%s,teamCapacity=%s', v_ver.covered_slots, v_profile.team_capacity),
      hint = 'Prijava pokriva vise ljudi nego sto trenutni tim Uskocera podrzava.';
  end if;

  -- Existing hard capability revalidation remains authoritative for identity,
  -- tools, licenses, vehicles, experience, exclusions and own-Need protection.
  v_match := private.match_detail(p_need_id, v_resp.worker_profile_id);
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception 'WORKER_NO_LONGER_ELIGIBLE' using errcode = 'P0001',
      detail = coalesce((v_match->'hardBlockers')::text,'[]'),
      hint = 'Uskocer vise ne ispunjava uslove Potrebe.';
  end if;

  v_covered := public.fn_need_covered_slots(p_need_id);
  if v_covered + v_resp.covered_slots > v_need.required_slots then
    raise exception 'OVERFILL' using errcode = 'P0001',
      hint = 'Ta prijava pokriva vise mesta nego sto je preostalo.'; end if;

  insert into public.need_selections
    (need_id, need_revision, selected_by_account_id, client_request_id, covered_slots,
     response_id, worker_account_id, worker_profile_id, selection_mode, status)
  values (p_need_id, v_need.revision, uid, p_client_request_id, v_resp.covered_slots,
     p_response_id, v_resp.worker_account_id, v_resp.worker_profile_id,
     case when v_need.mode = 'FASTEST' then 'AUTO_FILL' else 'REQUESTER_SELECTS' end,
     'SELECTED')
  returning id into v_selection_id;

  v_terms := jsonb_build_object(
    'price_rsd', v_ver.price_rsd, 'covered_slots', v_ver.covered_slots,
    'proposed_start_at', v_ver.proposed_start_at, 'proposed_end_at', v_ver.proposed_end_at,
    'scope_note', v_ver.scope_note, 'need_revision', v_need.revision,
    'response_version', v_ver.version);

  insert into public.agreements
    (need_id, selection_id, selected_response_id, requester_account_id, requester_profile_id,
     worker_account_id, worker_profile_id, current_version, status)
  values (p_need_id, v_selection_id, p_response_id, v_need.requester_account_id, v_need.requester_profile_id,
     v_resp.worker_account_id, v_resp.worker_profile_id, 1, 'CONFIRMED')
  returning id into v_agreement_id;

  insert into public.agreement_versions
    (agreement_id, version, status, terms, content_hash, created_by_account_id)
  values (v_agreement_id, 1, 'CONFIRMED', v_terms, v_ver.content_hash, uid);

  insert into public.agreement_execution (agreement_id, agreement_version, mode, state)
  values (v_agreement_id, 1,
    case when v_need.schedule_kind = 'REMOTE_ANYTIME' then 'REMOTE' else 'PHYSICAL' end, 'CONFIRMED');

  update public.marketplace_responses
     set status = 'SELECTED', selected_at = statement_timestamp()
   where id = p_response_id;

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs
     set status = case when v_covered + v_resp.covered_slots >= v_need.required_slots
                       then 'ACTIVE' else 'SELECTION' end
   where id = p_need_id;

  return v_agreement_id;
end;
$function$;

-- Preserve the predecessor execution boundary exactly.
revoke all on function public.rpc_select_response(uuid,integer,uuid,integer,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.rpc_select_response(uuid,integer,uuid,integer,text,text)
  to authenticated,service_role;

comment on function public.rpc_select_response(uuid,integer,uuid,integer,text,text) is
  'RU-5 manual Selection authority. Exact Need/Application revision+version+hash binding, current hard eligibility, current RU-1 minimum readiness, current team-capacity and remaining-capacity revalidation. Existing Selection replay semantics are intentionally unchanged in this unit.';

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
      p.profile_status as current_profile_status,
      p.display_name as current_display_name,
      p.city as current_city,
      p.skills as current_skills,
      p.team_capacity as current_team_capacity,
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
    left join public.app_profiles p
      on p.id = r.worker_profile_id
     and p.kind = 'WORKER'
    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), classified as (
    select
      c.*,
      case
        when c.has_agreement or c.raw_response_status = 'SELECTED' then 'SELECTED'
        when c.raw_response_status = 'WITHDRAWN' then 'WITHDRAWN'
        when c.raw_response_status in ('NOT_SELECTED','EXPIRED') then 'CLOSED'
        when coalesce(v_need.status,'') in ('DRAFT','COMPLETED','CANCELLED','EXPIRED','ARCHIVED') then 'CLOSED'
        when v_need.response_deadline is not null
             and v_need.response_deadline <= statement_timestamp() then 'CLOSED'
        -- Reuse existing STALE for a current capability/readiness drift. No new
        -- product state is introduced by this safety repair.
        when c.current_profile_status is distinct from 'ACTIVE'
          or char_length(btrim(coalesce(c.current_display_name,''))) < 2
          or char_length(btrim(coalesce(c.current_city,''))) < 2
          or cardinality(coalesce(c.current_skills,'{}'::text[])) < 1
          or c.current_team_capacity is null
          or c.covered_slots > c.current_team_capacity
          or c.raw_response_status in ('STALE','STALE_REVIEW_REQUIRED')
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
  'RU-5 requester-owner Candidate Projection aligned to Selection current RU-1 readiness/team-capacity revalidation. Invalid legacy/current-drift Applications project as existing STALE; no new product state or response mutation.';

do $selection_revalidation_postconditions$
declare
  v_select_def text;
  v_candidates_def text;
begin
  if not has_function_privilege('authenticated','public.rpc_select_response(uuid,integer,uuid,integer,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.rpc_select_response(uuid,integer,uuid,integer,text,text)','EXECUTE')
     or has_function_privilege('anon','public.rpc_select_response(uuid,integer,uuid,integer,text,text)','EXECUTE') then
    raise exception 'RU5_SELECTION_REVALIDATION_POSTCONDITION_FAILED: selection grants';
  end if;

  if not has_function_privilege('authenticated','public.rpc_list_need_candidates(uuid)','EXECUTE')
     or has_function_privilege('anon','public.rpc_list_need_candidates(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.rpc_list_need_candidates(uuid)','EXECUTE') then
    raise exception 'RU5_SELECTION_REVALIDATION_POSTCONDITION_FAILED: candidate grants';
  end if;

  v_select_def := pg_get_functiondef('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure);
  v_candidates_def := pg_get_functiondef('public.rpc_list_need_candidates(uuid)'::regprocedure);

  if position('WORKER_PROFILE_NOT_READY' in v_select_def)=0
     or position('TEAM_CAPACITY_EXCEEDED' in v_select_def)=0
     or position('for share' in lower(v_select_def))=0 then
    raise exception 'RU5_SELECTION_REVALIDATION_POSTCONDITION_FAILED: selection markers';
  end if;

  if position('current_team_capacity' in v_candidates_def)=0
     or position('current_skills' in v_candidates_def)=0
     or position("then 'STALE'" in v_candidates_def)=0 then
    raise exception 'RU5_SELECTION_REVALIDATION_POSTCONDITION_FAILED: candidate markers';
  end if;

  if has_table_privilege('authenticated','public.marketplace_responses','INSERT')
     or has_table_privilege('authenticated','public.marketplace_responses','UPDATE')
     or has_table_privilege('authenticated','public.marketplace_response_versions','INSERT') then
    raise exception 'RU5_SELECTION_REVALIDATION_POSTCONDITION_FAILED: direct response write exposure';
  end if;
end
$selection_revalidation_postconditions$;

commit;
