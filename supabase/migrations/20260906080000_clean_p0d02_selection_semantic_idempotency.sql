-- USKOČI P0D-02 — SELECTION SEMANTIC IDEMPOTENCY
--
-- Frozen forward blueprint authority:
--   P0D-02 selection_semantic_idempotency
--
-- Scope:
--   * bind Requester + client request ID to the exact Selection semantic payload;
--   * same key + same payload returns the same authoritative Agreement;
--   * same key + different payload raises IDEMPOTENCY_KEY_REUSED;
--   * serialize concurrent retries of one logical command;
--   * preserve historical Selection/Agreement rows without request-hash backfill.
--
-- Explicit non-scope:
--   calendar hard-conflict authority, Povezivanje, Agreement/Dogovor redesign,
--   D0140/RU-4B activation, monetization, Application AI, ranking, note policy.

begin;

do $p0d02_preflight$
begin
  if md5(pg_get_functiondef('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure))
       <> 'ea1c1c40783dbfb9eeab527c128f9dd0' then
    raise exception 'P0D02_PREDECESSOR_MISMATCH: rpc_select_response';
  end if;
  if to_regclass('private.selection_commands') is not null then
    raise exception 'P0D02_PREDECESSOR_MISMATCH: selection_commands already exists';
  end if;
  if to_regclass('private.response_submit_commands') is null then
    raise exception 'P0D02_PREDECESSOR_MISMATCH: reference command receipt missing';
  end if;
end
$p0d02_preflight$;

create table private.selection_commands (
  requester_account_id uuid not null references auth.users(id) on delete restrict,
  client_request_id text not null,
  request_hash text not null,
  need_id uuid not null references public.needs(id) on delete restrict,
  need_revision integer not null,
  response_id uuid not null,
  response_version integer not null,
  response_content_hash text not null,
  covered_slots integer not null,
  selection_id uuid not null references public.need_selections(id) on delete restrict,
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint selection_commands_pkey primary key (requester_account_id, client_request_id),
  constraint selection_commands_client_request_id_check
    check (char_length(btrim(client_request_id)) between 8 and 200),
  constraint selection_commands_request_hash_check check (char_length(request_hash) = 64),
  constraint selection_commands_need_revision_check check (need_revision >= 1),
  constraint selection_commands_response_version_check check (response_version >= 1),
  constraint selection_commands_response_content_hash_check check (char_length(response_content_hash) = 64),
  constraint selection_commands_covered_slots_check check (covered_slots between 1 and 50),
  constraint selection_commands_response_version_fkey
    foreign key (response_id, response_version)
    references public.marketplace_response_versions(response_id, version) on delete restrict,
  constraint selection_commands_selection_key unique (selection_id),
  constraint selection_commands_agreement_key unique (agreement_id)
);

alter table private.selection_commands enable row level security;
revoke all on table private.selection_commands from public, anon, authenticated, service_role;

comment on table private.selection_commands is
  'P0D-02 internal durable Selection command receipts. Actor+client key is bound to an exact semantic request hash and authoritative Selection/Agreement result. No direct API role access.';

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
  v_requested_ver public.marketplace_response_versions%rowtype;
  v_profile public.app_profiles%rowtype;
  v_command private.selection_commands%rowtype;
  v_selection_id uuid;
  v_agreement_id uuid;
  v_covered integer;
  v_terms jsonb;
  v_match jsonb;
  v_request_hash text;
  v_legacy_selection public.need_selections%rowtype;
  v_legacy_agreement_id uuid;
  v_legacy_response_version integer;
  v_legacy_content_hash text;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode = '22023';
  end if;

  -- Response versions are immutable. Reading the requested version before the
  -- command-receipt lookup lets the semantic fingerprint bind covered slots as
  -- required by the frozen P0D-02 contract. Missing/different versions produce
  -- a different fingerprint and are still validated by the normal path below.
  select * into v_requested_ver
    from public.marketplace_response_versions
   where response_id = p_response_id
     and version = p_response_version;

  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'requesterAccountId', uid,
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'responseId', p_response_id,
    'responseVersion', p_response_version,
    'contentHash', p_content_hash,
    'coveredSlots', v_requested_ver.covered_slots
  )::text, 'UTF8')), 'hex');

  -- One logical Requester command is serialized before any replay/business
  -- decision. This is the same narrow command pattern already proven by
  -- rpc_submit_response; it is not a new generic framework.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':' || p_client_request_id, 7242)
  );

  select * into v_command
    from private.selection_commands c
   where c.requester_account_id = uid
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_command.agreement_id;
  end if;

  -- Historical Selection rows intentionally have no fabricated request hash.
  -- Preserve their authoritative replay only when the immutable Selection +
  -- Agreement v1 evidence agrees with the caller's exact known payload.
  select s.*,
         a.id,
         nullif(av.terms->>'response_version','')::integer,
         av.content_hash
    into v_legacy_selection,
         v_legacy_agreement_id,
         v_legacy_response_version,
         v_legacy_content_hash
    from public.need_selections s
    join public.agreements a on a.selection_id = s.id
    left join public.agreement_versions av
      on av.agreement_id = a.id and av.version = 1
   where s.need_id = p_need_id
     and s.client_request_id = p_client_request_id;

  if found then
    if v_legacy_selection.selected_by_account_id <> uid then
      raise exception 'NOT_REQUESTER' using errcode = '42501';
    end if;
    if v_legacy_selection.need_revision <> p_need_revision
       or v_legacy_selection.response_id is distinct from p_response_id
       or (v_requested_ver.response_id is not null
           and v_legacy_selection.covered_slots <> v_requested_ver.covered_slots)
       or (v_legacy_response_version is not null
           and v_legacy_response_version <> p_response_version)
       or (v_legacy_content_hash is not null
           and v_legacy_content_hash <> p_content_hash) then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_legacy_agreement_id;
  end if;

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

  insert into private.selection_commands(
    requester_account_id, client_request_id, request_hash,
    need_id, need_revision, response_id, response_version,
    response_content_hash, covered_slots, selection_id, agreement_id
  ) values (
    uid, p_client_request_id, v_request_hash,
    p_need_id, p_need_revision, p_response_id, p_response_version,
    p_content_hash, v_ver.covered_slots, v_selection_id, v_agreement_id
  );

  return v_agreement_id;
end;
$function$;

revoke all on function public.rpc_select_response(uuid,integer,uuid,integer,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.rpc_select_response(uuid,integer,uuid,integer,text,text)
  to authenticated,service_role;

comment on function public.rpc_select_response(uuid,integer,uuid,integer,text,text) is
  'P0D-02 atomic Selection authority with exact Need/Application binding, current eligibility/capacity revalidation, actor+request semantic SHA-256 receipt, same-payload replay and different-payload key reuse rejection. Historical receipts are not fabricated.';

do $p0d02_postcondition$
declare
  v_def text := pg_get_functiondef('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure);
begin
  if to_regclass('private.selection_commands') is null then
    raise exception 'P0D02_POSTCONDITION: command table missing';
  end if;
  if position('IDEMPOTENCY_KEY_REUSED' in v_def) = 0
     or position('private.selection_commands' in v_def) = 0
     or position('pg_advisory_xact_lock' in v_def) = 0 then
    raise exception 'P0D02_POSTCONDITION: selection semantic receipt guard missing';
  end if;
  if has_table_privilege('anon','private.selection_commands','SELECT')
     or has_table_privilege('authenticated','private.selection_commands','SELECT')
     or has_table_privilege('service_role','private.selection_commands','SELECT') then
    raise exception 'P0D02_POSTCONDITION: direct command table read exposed';
  end if;
end
$p0d02_postcondition$;

commit;
