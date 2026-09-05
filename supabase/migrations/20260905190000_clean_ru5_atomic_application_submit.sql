-- USKOČI RU-5 / P0C-02 — ATOMIC APPLICATION SUBMIT
--
-- Forward-only hardening of the existing canonical rpc_submit_response contract.
-- Scope is deliberately narrow:
--   * current RU-1 Worker readiness
--   * covered slots <= current Worker team capacity and remaining Need capacity
--   * MY_PRICE exact requester-price equality
--   * immutable private submit snapshot for future candidate/selection projections
--   * one canonical RESPONSE_RECEIVED event per newly committed Application version
--
-- Existing responses/versions are never rewritten or backfilled. Historical rows
-- without a P0C-02 snapshot remain LEGACY_UNPROVEN by absence.
-- D0140 production ALLOW, RU-4B activation, monetization, calendar hard-conflict
-- authority and bounded-note policy are intentionally NOT activated or invented here.

begin;

do $p0c02_preflight$
declare
  v_submit text;
begin
  if to_regprocedure(
       'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)'
     ) is null then
    raise exception 'RU5_P0C02_PREDECESSOR_MISMATCH: rpc_submit_response missing';
  end if;

  if to_regclass('private.response_submit_commands') is null
     or to_regclass('public.marketplace_response_versions') is null
     or to_regclass('public.need_selections') is null then
    raise exception 'RU5_P0C02_PREDECESSOR_MISMATCH: response authority tables missing';
  end if;

  v_submit := pg_get_functiondef(
    'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure
  );

  if position('response_submit_commands' in v_submit) = 0
     or position('IDEMPOTENCY_KEY_REUSED' in v_submit) = 0
     or position('private.match_detail' in v_submit) = 0 then
    raise exception 'RU5_P0C02_PREDECESSOR_MISMATCH: submit authority drift';
  end if;
end
$p0c02_preflight$;

create table if not exists private.response_application_snapshots (
  response_id uuid not null,
  response_version integer not null check (response_version >= 1),
  snapshot_schema text not null
    check (snapshot_schema in ('APPLICATION_V1_SELF_DECLARED')),
  worker_profile_id uuid not null,
  worker_team_capacity integer not null
    check (worker_team_capacity between 1 and 50),
  covered_slots integer not null check (covered_slots between 1 and 50),
  need_required_slots integer not null check (need_required_slots between 1 and 50),
  need_selected_slots_before_submit integer not null
    check (need_selected_slots_before_submit between 0 and 50),
  need_remaining_slots_before_submit integer not null
    check (need_remaining_slots_before_submit between 1 and 50),
  pricing_mode text not null check (pricing_mode in ('FASTEST','MY_PRICE','OFFERS')),
  requester_price_rsd integer,
  worker_skills text[] not null default array[]::text[],
  worker_tools text[] not null default array[]::text[],
  worker_licenses text[] not null default array[]::text[],
  worker_vehicles text[] not null default array[]::text[],
  created_at timestamptz not null default statement_timestamp(),
  primary key (response_id, response_version),
  foreign key (response_id, response_version)
    references public.marketplace_response_versions(response_id, version)
    on delete cascade,
  foreign key (worker_profile_id)
    references public.app_profiles(id)
    on delete restrict,
  check (
    requester_price_rsd is null
    or requester_price_rsd > 0
  )
);

alter table private.response_application_snapshots enable row level security;
revoke all on table private.response_application_snapshots
  from public, anon, authenticated, service_role;

comment on table private.response_application_snapshots is
  'RU-5 P0C-02 private per-version Application snapshot. New submit versions only; absent historical rows are LEGACY_UNPROVEN. No client/raw public read authority.';

create or replace function public.rpc_submit_response(
  p_need_id uuid,
  p_need_revision integer,
  p_worker_profile_id uuid,
  p_covered_slots integer,
  p_price_rsd integer,
  p_proposed_start_at timestamptz,
  p_proposed_end_at timestamptz,
  p_scope_note text,
  p_client_request_id text
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  u uuid := auth.uid();
  n public.needs;
  v_profile public.app_profiles;
  v_resp public.marketplace_responses;
  v_command private.response_submit_commands;
  v_match jsonb;
  v_content_hash text;
  v_request_hash text;
  v_result jsonb;
  v_version integer;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
begin
  if u is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception using errcode='22023', message='INVALID_CLIENT_REQUEST_ID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(u::text || ':' || p_client_request_id, 7241)
  );

  -- Bind only the semantic client command. Server-derived profile/Need snapshot
  -- intentionally does not enter the request hash, so a retry after a committed
  -- response replays the exact first result even if current context later moves.
  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'workerProfileId', p_worker_profile_id,
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(p_scope_note, '')
  )::text, 'UTF8')), 'hex');

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  -- Shared mutation lock order remains Need first.
  select * into n
    from public.needs
   where id = p_need_id
   for update;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id
   for update;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if n.status not in ('PUBLISHED','SELECTION') then
    raise exception using errcode='22023', message='NEED_NOT_OPEN';
  end if;

  if n.requester_account_id = u then
    raise exception using errcode='42501', message='OWN_NEED';
  end if;

  if n.response_deadline is not null
     and n.response_deadline <= statement_timestamp() then
    raise exception using errcode='22023', message='RESPONSE_WINDOW_EXPIRED';
  end if;

  if n.revision is distinct from p_need_revision then
    raise exception using errcode='P0001', message='STALE_REVIEW_REQUIRED';
  end if;

  -- Lock the current Worker profile after the Need. ACTIVE alone is not enough
  -- for legacy rows: P0C-02 rechecks the exact RU-1 minimum readiness facts.
  select * into v_profile
    from public.app_profiles p
   where p.id = p_worker_profile_id
   for update;

  if not found
     or v_profile.account_id <> u
     or v_profile.kind <> 'WORKER' then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  if v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or char_length(btrim(v_profile.city)) < 2
     or cardinality(v_profile.skills) < 1 then
    raise exception using errcode='P0001', message='WORKER_PROFILE_NOT_READY';
  end if;

  select coalesce(sum(s.covered_slots), 0)::integer
    into v_selected_slots
    from public.need_selections s
   where s.need_id = n.id
     and s.status = 'SELECTED';

  v_remaining_slots := greatest(0, n.required_slots - v_selected_slots);

  if v_remaining_slots < 1 then
    raise exception using errcode='P0001', message='NEED_FULL';
  end if;

  if p_covered_slots is null or p_covered_slots < 1 then
    raise exception using errcode='22023', message='INVALID_COVERED_SLOTS';
  end if;

  if p_covered_slots > v_profile.team_capacity then
    raise exception using
      errcode='22023',
      message='TEAM_CAPACITY_EXCEEDED',
      detail=format('covered=%s,teamCapacity=%s', p_covered_slots, v_profile.team_capacity);
  end if;

  if p_covered_slots > v_remaining_slots then
    raise exception using
      errcode='22023',
      message='NEED_REMAINING_CAPACITY_EXCEEDED',
      detail=format('covered=%s,remaining=%s', p_covered_slots, v_remaining_slots);
  end if;

  if p_price_rsd is null or p_price_rsd <= 0 then
    raise exception using errcode='22023', message='INVALID_PRICE';
  end if;

  if n.mode = 'MY_PRICE' then
    if n.requester_price_rsd is null or n.requester_price_rsd <= 0 then
      raise exception using errcode='P0001', message='FIXED_PRICE_NOT_READY';
    end if;
    if p_price_rsd <> n.requester_price_rsd then
      raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
    end if;
  end if;

  if (p_proposed_start_at is null) <> (p_proposed_end_at is null)
     or (
       p_proposed_start_at is not null
       and p_proposed_end_at is not null
       and p_proposed_start_at >= p_proposed_end_at
     ) then
    raise exception using errcode='22023', message='INVALID_PROPOSED_INTERVAL';
  end if;

  if exists (
    select 1
      from public.marketplace_responses r
     where r.need_id = p_need_id
       and r.worker_account_id = u
       and (
         r.status = 'SELECTED'
         or exists (
           select 1
             from public.agreements a
            where a.selected_response_id = r.id
              and a.status in ('CONFIRMED','SUPERSEDED','COMPLETED')
         )
       )
  ) then
    raise exception using errcode='P0001', message='RESPONSE_ALREADY_SELECTED';
  end if;

  v_match := private.match_detail(p_need_id, p_worker_profile_id);
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception using
      errcode='P0001',
      message='WORKER_NOT_ELIGIBLE',
      detail=coalesce((v_match->'hardBlockers')::text, '[]');
  end if;

  select * into v_resp
    from public.marketplace_responses r
   where r.need_id = p_need_id
     and r.worker_account_id = u
     and r.status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
   order by r.created_at desc
   limit 1
   for update;

  -- Content identity includes the server-derived self-declared capability/team
  -- snapshot. It is not public trust/verification and is never copied into the
  -- global public profile DTO.
  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', n.revision,
    'pricingMode', n.mode,
    'priceRsd', p_price_rsd,
    'coveredSlots', p_covered_slots,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(btrim(p_scope_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', to_jsonb(v_profile.tools),
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', to_jsonb(v_profile.vehicles)
  )::text, 'UTF8')), 'hex');

  if v_resp.id is null then
    insert into public.marketplace_responses (
      need_id, worker_account_id, worker_profile_id, response_kind, status,
      submitted_against_need_revision, current_version, covered_slots,
      price_rsd, proposed_start_at, proposed_end_at, scope_note, submitted_at
    ) values (
      p_need_id, u, p_worker_profile_id, 'OFFER', 'SUBMITTED', n.revision, 1,
      p_covered_slots, p_price_rsd, p_proposed_start_at, p_proposed_end_at,
      coalesce(p_scope_note, ''), statement_timestamp()
    )
    returning * into v_resp;
    v_version := 1;
  else
    v_version := v_resp.current_version + 1;
    update public.marketplace_responses
       set current_version = v_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = n.revision,
           covered_slots = p_covered_slots,
           price_rsd = p_price_rsd,
           proposed_start_at = p_proposed_start_at,
           proposed_end_at = p_proposed_end_at,
           scope_note = coalesce(p_scope_note, ''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null
     where id = v_resp.id
     returning * into v_resp;
  end if;

  insert into public.marketplace_response_versions (
    response_id, version, need_revision, covered_slots, price_rsd,
    proposed_start_at, proposed_end_at, scope_note, content_hash
  ) values (
    v_resp.id, v_version, n.revision, p_covered_slots, p_price_rsd,
    p_proposed_start_at, p_proposed_end_at, coalesce(p_scope_note, ''),
    v_content_hash
  );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_resp.id, v_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, p_covered_slots,
    n.required_slots, v_selected_slots, v_remaining_slots,
    n.mode, n.requester_price_rsd,
    v_profile.skills, v_profile.tools, v_profile.licenses, v_profile.vehicles
  );

  update public.opportunity_deliveries
     set status = 'RESPONDED',
         responded_at = statement_timestamp()
   where need_id = p_need_id
     and need_revision = n.revision
     and worker_account_id = u
     and status in ('READY','SEEN');

  v_result := jsonb_build_object(
    'responseId', v_resp.id,
    'applicationId', v_resp.id,
    'version', v_version,
    'needRevision', n.revision,
    'contentHash', v_content_hash,
    'status', v_resp.status,
    'pricingMode', n.mode,
    'coveredSlots', p_covered_slots,
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'authoritative', true,
    'idempotentReplay', false
  );

  insert into private.response_submit_commands (
    worker_account_id, client_request_id, request_hash,
    response_id, response_version, result
  ) values (
    u, p_client_request_id, v_request_hash,
    v_resp.id, v_version, v_result
  );

  perform private.emit_event(
    n.requester_account_id,
    'REQUESTER',
    'RESPONSE_RECEIVED',
    'RESPONSE',
    v_resp.id,
    v_version,
    'Nova prijava',
    'Imate novu prijavu za Potrebu.',
    'response-received:' || v_resp.id::text || ':' || v_version::text,
    'NORMAL',
    jsonb_build_object(
      'needId', n.id,
      'responseId', v_resp.id,
      'responseVersion', v_version
    ),
    null
  );

  return v_result;
end;
$function$;

revoke all on function public.rpc_submit_response(
  uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.rpc_submit_response(
  uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text
) to authenticated;

comment on function public.rpc_submit_response(
  uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text
) is
  'RU-5 P0C-02 atomic Application submit: durable replay, exact RU-1 readiness, team/remaining capacity, MY_PRICE equality, private per-version self-declared snapshot and deduplicated RESPONSE_RECEIVED event. D0140/RU-4B/monetization/calendar/note-policy activation excluded.';

do $p0c02_postconditions$
declare
  v_submit text;
begin
  if not has_function_privilege(
       'authenticated',
       'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)',
       'EXECUTE'
     ) then
    raise exception 'RU5_P0C02_POSTCONDITION_FAILED: submit grants';
  end if;

  if has_table_privilege('authenticated', 'public.marketplace_responses', 'INSERT')
     or has_table_privilege('authenticated', 'public.marketplace_response_versions', 'INSERT')
     or has_table_privilege('authenticated', 'private.response_application_snapshots', 'SELECT')
     or has_table_privilege('authenticated', 'private.response_application_snapshots', 'INSERT')
     or has_table_privilege('service_role', 'private.response_application_snapshots', 'INSERT') then
    raise exception 'RU5_P0C02_POSTCONDITION_FAILED: direct write/private snapshot exposure';
  end if;

  v_submit := pg_get_functiondef(
    'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure
  );

  if position('WORKER_PROFILE_NOT_READY' in v_submit) = 0
     or position('TEAM_CAPACITY_EXCEEDED' in v_submit) = 0
     or position('NEED_REMAINING_CAPACITY_EXCEEDED' in v_submit) = 0
     or position('FIXED_PRICE_MISMATCH' in v_submit) = 0
     or position('response_application_snapshots' in v_submit) = 0
     or position('RESPONSE_RECEIVED' in v_submit) = 0 then
    raise exception 'RU5_P0C02_POSTCONDITION_FAILED: submit contract markers';
  end if;
end
$p0c02_postconditions$;

commit;
