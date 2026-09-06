-- USKOČI P0D-03 — REQUESTER CONNECTION ACTIVATION V1
--
-- Frozen forward blueprint authority:
--   P0D-03 requester_connection_activation_v1
--
-- Scope:
--   * private immutable V1 Povezivanje policy + activation receipt ledger;
--   * Requester is beneficiary, reason is SELECTION, units are covered headcount;
--   * V1 platform monetary cost is exactly 0 RSD (PROMOTIONAL_FREE);
--   * new Selection-created Agreement must have a matching activation receipt
--     before the transaction may commit;
--   * preserve public rpc_select_response(uuid,integer,uuid,integer,text,text).
--
-- Data strategy:
--   * no historical Agreement is charged or backfilled;
--   * no Worker-paid credit/debit model is imported;
--   * no task/labor price is stored as platform cost.
--
-- Explicit non-scope:
--   paid checkout/balance/packages, hard calendar authority, immutable Agreement
--   snapshot V2, shared Dogovor, P0D-04 atomic closure, D0140/RU-4B activation,
--   monetization activation, Application AI, ranking, note policy.

begin;

do $p0d03_preflight$
begin
  if md5(pg_get_functiondef('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure))
       <> 'b1ca0a03ee075565c71b50f00d61dade' then
    raise exception 'P0D03_PREDECESSOR_MISMATCH: rpc_select_response';
  end if;
  if to_regclass('private.selection_commands') is null then
    raise exception 'P0D03_PREDECESSOR_MISMATCH: selection_commands missing';
  end if;
  if to_regclass('private.connection_policy_versions') is not null
     or to_regclass('private.connection_activations') is not null then
    raise exception 'P0D03_PREDECESSOR_MISMATCH: connection ledger already exists';
  end if;
end
$p0d03_preflight$;

create table private.connection_policy_versions (
  policy_key text not null,
  version integer not null,
  beneficiary_role text not null,
  activation_reason text not null,
  charge_mode text not null,
  unit_basis text not null,
  platform_cost_rsd integer not null,
  policy_snapshot jsonb not null,
  created_at timestamptz not null default statement_timestamp(),

  constraint connection_policy_versions_pkey primary key (policy_key, version),
  constraint connection_policy_versions_policy_key_nonempty check (btrim(policy_key) <> ''),
  constraint connection_policy_versions_version_positive check (version > 0),
  constraint connection_policy_versions_requester_only check (beneficiary_role = 'REQUESTER'),
  constraint connection_policy_versions_selection_only check (activation_reason = 'SELECTION'),
  constraint connection_policy_versions_promotional_free_only check (charge_mode = 'PROMOTIONAL_FREE'),
  constraint connection_policy_versions_headcount_only check (unit_basis = 'HEADCOUNT'),
  constraint connection_policy_versions_zero_cost_only check (platform_cost_rsd = 0),
  constraint connection_policy_versions_snapshot_object check (jsonb_typeof(policy_snapshot) = 'object'),
  constraint connection_policy_versions_snapshot_identity check (
    policy_snapshot->>'schema' = 'CONNECTION_POLICY_V1'
    and policy_snapshot->>'policyKey' = policy_key
    and nullif(policy_snapshot->>'version','')::integer = version
    and policy_snapshot->>'beneficiaryRole' = beneficiary_role
    and policy_snapshot->>'activationReason' = activation_reason
    and policy_snapshot->>'chargeMode' = charge_mode
    and policy_snapshot->>'unitBasis' = unit_basis
    and nullif(policy_snapshot->>'platformCostRsd','')::integer = platform_cost_rsd
  )
);

alter table private.connection_policy_versions enable row level security;
revoke all on table private.connection_policy_versions from public, anon, authenticated, service_role;

insert into private.connection_policy_versions(
  policy_key,version,beneficiary_role,activation_reason,charge_mode,unit_basis,
  platform_cost_rsd,policy_snapshot
) values (
  'REQUESTER_SELECTION_V1',1,'REQUESTER','SELECTION','PROMOTIONAL_FREE','HEADCOUNT',0,
  jsonb_build_object(
    'schema','CONNECTION_POLICY_V1',
    'policyKey','REQUESTER_SELECTION_V1',
    'version',1,
    'beneficiaryRole','REQUESTER',
    'activationReason','SELECTION',
    'chargeMode','PROMOTIONAL_FREE',
    'unitBasis','HEADCOUNT',
    'platformCostRsd',0
  )
);

comment on table private.connection_policy_versions is
  'P0D-03 immutable Povezivanje policy versions. V1 is Requester-beneficiary SELECTION with HEADCOUNT units and PROMOTIONAL_FREE platform cost 0 RSD.';

create table private.connection_activations (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_account_id uuid not null references auth.users(id) on delete restrict,
  beneficiary_account_id uuid not null references auth.users(id) on delete restrict,
  client_request_id text not null,
  request_hash text not null,
  policy_key text not null,
  policy_version integer not null,
  policy_snapshot jsonb not null,
  activation_reason text not null,
  need_id uuid not null references public.needs(id) on delete restrict,
  need_revision integer not null,
  selection_id uuid not null references public.need_selections(id) on delete restrict,
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  response_id uuid not null,
  response_version integer not null,
  response_content_hash text not null,
  worker_account_id uuid not null references auth.users(id) on delete restrict,
  worker_profile_id uuid not null references public.app_profiles(id) on delete restrict,
  units integer not null,
  platform_cost_rsd integer not null,
  state text not null,
  created_at timestamptz not null default statement_timestamp(),

  constraint connection_activations_request_key unique (requester_account_id, client_request_id),
  constraint connection_activations_selection_key unique (selection_id),
  constraint connection_activations_agreement_key unique (agreement_id),
  constraint connection_activations_policy_fkey
    foreign key (policy_key,policy_version)
    references private.connection_policy_versions(policy_key,version) on delete restrict,
  constraint connection_activations_response_version_fkey
    foreign key (response_id,response_version)
    references public.marketplace_response_versions(response_id,version) on delete restrict,
  constraint connection_activations_requester_beneficiary check (beneficiary_account_id = requester_account_id),
  constraint connection_activations_client_request_id check (char_length(btrim(client_request_id)) between 8 and 200),
  constraint connection_activations_request_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint connection_activations_response_hash check (response_content_hash ~ '^[0-9a-f]{64}$'),
  constraint connection_activations_need_revision check (need_revision > 0),
  constraint connection_activations_response_version check (response_version > 0),
  constraint connection_activations_reason check (activation_reason = 'SELECTION'),
  constraint connection_activations_units check (units between 1 and 50),
  constraint connection_activations_zero_platform_cost check (platform_cost_rsd = 0),
  constraint connection_activations_state check (state = 'SATISFIED'),
  constraint connection_activations_snapshot_object check (jsonb_typeof(policy_snapshot) = 'object')
);

alter table private.connection_activations enable row level security;
revoke all on table private.connection_activations from public, anon, authenticated, service_role;

comment on table private.connection_activations is
  'P0D-03 immutable server-only Povezivanje activation receipts. V1 records Requester-beneficiary zero-cost platform activation; it is not task price, Worker payment, wallet balance, deposit or cash.';

create or replace function private.reject_connection_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
begin
  raise exception 'CONNECTION_LEDGER_IMMUTABLE' using errcode='55000';
end;
$$;

revoke all on function private.reject_connection_ledger_mutation() from public,anon,authenticated,service_role;

create trigger connection_policy_versions_immutable_trg
before update or delete on private.connection_policy_versions
for each row execute function private.reject_connection_ledger_mutation();

create trigger connection_activations_immutable_trg
before update or delete on private.connection_activations
for each row execute function private.reject_connection_ledger_mutation();

-- New Agreements are grandfather-compatible by deployment time: this trigger is
-- created after all existing rows and only runs for future INSERTs. It is deferred
-- so rpc_select_response can insert Agreement first, then its activation receipt,
-- while still making a receipt mandatory before COMMIT.
create or replace function private.require_connection_activation_for_new_agreement()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  s public.need_selections%rowtype;
  a private.connection_activations%rowtype;
  p private.connection_policy_versions%rowtype;
begin
  select * into s from public.need_selections where id = new.selection_id;
  if not found then
    raise exception 'CONNECTION_ACTIVATION_REQUIRED' using errcode='23514', detail='selection_missing';
  end if;

  select * into a from private.connection_activations where agreement_id = new.id;
  if not found then
    raise exception 'CONNECTION_ACTIVATION_REQUIRED' using errcode='23514', detail='activation_missing';
  end if;

  select * into p
    from private.connection_policy_versions
   where policy_key=a.policy_key and version=a.policy_version;
  if not found then
    raise exception 'CONNECTION_ACTIVATION_REQUIRED' using errcode='23514', detail='policy_missing';
  end if;

  if a.requester_account_id <> new.requester_account_id
     or a.beneficiary_account_id <> new.requester_account_id
     or a.need_id <> new.need_id
     or a.selection_id <> new.selection_id
     or a.response_id <> new.selected_response_id
     or a.worker_account_id <> new.worker_account_id
     or a.worker_profile_id <> new.worker_profile_id
     or a.units <> s.covered_slots
     or a.activation_reason <> 'SELECTION'
     or a.platform_cost_rsd <> 0
     or a.state <> 'SATISFIED'
     or p.beneficiary_role <> 'REQUESTER'
     or p.activation_reason <> 'SELECTION'
     or p.charge_mode <> 'PROMOTIONAL_FREE'
     or p.unit_basis <> 'HEADCOUNT'
     or p.platform_cost_rsd <> 0
     or a.policy_snapshot <> p.policy_snapshot then
    raise exception 'CONNECTION_ACTIVATION_REQUIRED' using errcode='23514', detail='activation_binding_mismatch';
  end if;

  return null;
end;
$$;

revoke all on function private.require_connection_activation_for_new_agreement() from public,anon,authenticated,service_role;

create constraint trigger agreements_require_connection_activation_trg
after insert on public.agreements
deferrable initially deferred
for each row execute function private.require_connection_activation_for_new_agreement();

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
  v_policy private.connection_policy_versions%rowtype;
  v_selection_id uuid;
  v_agreement_id uuid;
  v_covered integer;
  v_terms jsonb;
  v_match jsonb;
  v_request_hash text;
  v_legacy_selected_by uuid;
  v_legacy_need_revision integer;
  v_legacy_response_id uuid;
  v_legacy_covered_slots integer;
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

  -- Pre-P0D-02/P0D-03 historical rows remain authoritative and are not
  -- retroactively charged or given fabricated activation receipts.
  select s.selected_by_account_id,
         s.need_revision,
         s.response_id,
         s.covered_slots,
         a.id,
         nullif(av.terms->>'response_version','')::integer,
         av.content_hash
    into v_legacy_selected_by,
         v_legacy_need_revision,
         v_legacy_response_id,
         v_legacy_covered_slots,
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
    if v_legacy_selected_by <> uid then
      raise exception 'NOT_REQUESTER' using errcode = '42501';
    end if;
    if v_legacy_need_revision <> p_need_revision
       or v_legacy_response_id is distinct from p_response_id
       or (v_requested_ver.response_id is not null
           and v_legacy_covered_slots <> v_requested_ver.covered_slots)
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
    raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode = 'P0001', hint = 'Rok za prijave je istekao.';
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
    raise exception 'OVERFILL' using errcode = 'P0001', hint = 'Ta prijava pokriva vise mesta nego sto je preostalo.'; end if;

  select * into v_policy
    from private.connection_policy_versions
   where policy_key='REQUESTER_SELECTION_V1' and version=1;
  if not found
     or v_policy.beneficiary_role <> 'REQUESTER'
     or v_policy.activation_reason <> 'SELECTION'
     or v_policy.charge_mode <> 'PROMOTIONAL_FREE'
     or v_policy.unit_basis <> 'HEADCOUNT'
     or v_policy.platform_cost_rsd <> 0 then
    raise exception 'CONNECTION_POLICY_NOT_READY' using errcode='55000';
  end if;

  insert into public.need_selections(
    need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,
    response_id,worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    p_need_id,v_need.revision,uid,p_client_request_id,v_resp.covered_slots,
    p_response_id,v_resp.worker_account_id,v_resp.worker_profile_id,
    case when v_need.mode='FASTEST' then 'AUTO_FILL' else 'REQUESTER_SELECTS' end,
    'SELECTED'
  ) returning id into v_selection_id;

  v_terms := jsonb_build_object(
    'price_rsd',v_ver.price_rsd,'covered_slots',v_ver.covered_slots,
    'proposed_start_at',v_ver.proposed_start_at,'proposed_end_at',v_ver.proposed_end_at,
    'scope_note',v_ver.scope_note,'need_revision',v_need.revision,
    'response_version',v_ver.version
  );

  insert into public.agreements(
    need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values (
    p_need_id,v_selection_id,p_response_id,v_need.requester_account_id,v_need.requester_profile_id,
    v_resp.worker_account_id,v_resp.worker_profile_id,1,'CONFIRMED'
  ) returning id into v_agreement_id;

  insert into public.agreement_versions(
    agreement_id,version,status,terms,content_hash,created_by_account_id
  ) values (v_agreement_id,1,'CONFIRMED',v_terms,v_ver.content_hash,uid);

  insert into public.agreement_execution(agreement_id,agreement_version,mode,state)
  values (
    v_agreement_id,1,
    case when v_need.schedule_kind='REMOTE_ANYTIME' then 'REMOTE' else 'PHYSICAL' end,
    'CONFIRMED'
  );

  insert into private.connection_activations(
    requester_account_id,beneficiary_account_id,client_request_id,request_hash,
    policy_key,policy_version,policy_snapshot,activation_reason,
    need_id,need_revision,selection_id,agreement_id,response_id,response_version,
    response_content_hash,worker_account_id,worker_profile_id,units,platform_cost_rsd,state
  ) values (
    uid,uid,p_client_request_id,v_request_hash,
    v_policy.policy_key,v_policy.version,v_policy.policy_snapshot,'SELECTION',
    p_need_id,p_need_revision,v_selection_id,v_agreement_id,p_response_id,p_response_version,
    p_content_hash,v_resp.worker_account_id,v_resp.worker_profile_id,v_ver.covered_slots,0,'SATISFIED'
  );

  update public.marketplace_responses
     set status='SELECTED',selected_at=statement_timestamp()
   where id=p_response_id;

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs
     set status=case when v_covered+v_resp.covered_slots >= v_need.required_slots
                     then 'ACTIVE' else 'SELECTION' end
   where id=p_need_id;

  insert into private.selection_commands(
    requester_account_id,client_request_id,request_hash,
    need_id,need_revision,response_id,response_version,
    response_content_hash,covered_slots,selection_id,agreement_id
  ) values (
    uid,p_client_request_id,v_request_hash,
    p_need_id,p_need_revision,p_response_id,p_response_version,
    p_content_hash,v_ver.covered_slots,v_selection_id,v_agreement_id
  );

  return v_agreement_id;
end;
$function$;

revoke all on function public.rpc_select_response(uuid,integer,uuid,integer,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.rpc_select_response(uuid,integer,uuid,integer,text,text)
  to authenticated,service_role;

comment on function public.rpc_select_response(uuid,integer,uuid,integer,text,text) is
  'P0D-03 Selection authority preserving P0D-02 semantic idempotency and adding immutable Requester-beneficiary V1 Povezivanje activation: reason SELECTION, HEADCOUNT units, PROMOTIONAL_FREE platform cost 0 RSD. Historical Agreements are not retroactively activated.';

do $p0d03_postcondition$
declare
  v_def text := pg_get_functiondef('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure);
begin
  if to_regclass('private.connection_policy_versions') is null
     or to_regclass('private.connection_activations') is null then
    raise exception 'P0D03_POSTCONDITION: connection ledger missing';
  end if;
  if (select count(*) from private.connection_policy_versions
       where policy_key='REQUESTER_SELECTION_V1' and version=1
         and beneficiary_role='REQUESTER' and activation_reason='SELECTION'
         and charge_mode='PROMOTIONAL_FREE' and unit_basis='HEADCOUNT'
         and platform_cost_rsd=0) <> 1 then
    raise exception 'P0D03_POSTCONDITION: exact V1 free policy missing';
  end if;
  if position('private.connection_activations' in v_def)=0
     or position('CONNECTION_POLICY_NOT_READY' in v_def)=0
     or position('private.selection_commands' in v_def)=0
     or position('pg_advisory_xact_lock' in v_def)=0 then
    raise exception 'P0D03_POSTCONDITION: Selection integration missing';
  end if;
  if has_table_privilege('anon','private.connection_activations','SELECT')
     or has_table_privilege('authenticated','private.connection_activations','SELECT')
     or has_table_privilege('service_role','private.connection_activations','SELECT')
     or has_table_privilege('anon','private.connection_policy_versions','SELECT')
     or has_table_privilege('authenticated','private.connection_policy_versions','SELECT')
     or has_table_privilege('service_role','private.connection_policy_versions','SELECT') then
    raise exception 'P0D03_POSTCONDITION: private connection ledger exposed';
  end if;
  if not exists(
    select 1 from pg_trigger
     where tgrelid='public.agreements'::regclass
       and tgname='agreements_require_connection_activation_trg'
       and not tgisinternal
  ) then
    raise exception 'P0D03_POSTCONDITION: Agreement activation invariant missing';
  end if;
end
$p0d03_postcondition$;

commit;
