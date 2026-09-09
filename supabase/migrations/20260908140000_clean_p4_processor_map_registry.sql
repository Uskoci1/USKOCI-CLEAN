-- P4 processor/subprocessor map registry: physically verified technical
-- provider inventory of the CLEAN stack plus a trusted, versioned legal map
-- boundary. Ported from donor rc2_025 onto CLEAN authority (inline auth check,
-- statement_timestamp, private.audit_marketplace, advisory lock on publish).
-- Seeds ONLY the technical inventory evidenced in this repository and the live
-- project. Seeds NO legal role, DPA term, processing region, transfer
-- mechanism, legal basis or counsel-approved map. Runtime provider gating is
-- not admitted here.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $precondition$
begin
  if to_regclass('private.processor_provider_inventory') is not null
     or to_regclass('private.processor_map_sets') is not null
     or to_regclass('private.processor_map_entries') is not null then
    raise exception 'P4_PROCESSOR_TABLES_ALREADY_EXIST';
  end if;
  if to_regprocedure('public.rpc_get_processor_map_status()') is not null
     or to_regprocedure('public.rpc_publish_processor_map(text,text,timestamptz,jsonb)') is not null then
    raise exception 'P4_PROCESSOR_FUNCTIONS_ALREADY_EXIST';
  end if;
  if to_regprocedure('private.audit_marketplace(uuid,text,text,uuid,integer,jsonb)') is null then
    raise exception 'P4_PREDECESSOR_AUDIT_MISSING' using detail='private.audit_marketplace';
  end if;
  -- The seeded inventory cites these predecessor surfaces as physical evidence.
  if to_regclass('public.notification_push_devices') is null
     or to_regclass('public.notification_push_attempts') is null
     or to_regclass('public.ai_conversations') is null then
    raise exception 'P4_PREDECESSOR_EVIDENCE_TABLES_MISSING';
  end if;
end
$precondition$;

-- Technical inventory: what the stack can physically route data through.
-- active = adapter/platform present in the deployed stack;
-- required_current = the legal map must cover it before it can be ready.
create table private.processor_provider_inventory (
  code text primary key,
  display_name text not null,
  technical_purpose text not null,
  physical_evidence text not null,
  required_current boolean not null default false,
  active boolean not null default false,
  updated_at timestamptz not null default statement_timestamp(),
  constraint processor_provider_code_chk check (code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  constraint processor_provider_name_chk check (char_length(btrim(display_name)) between 2 and 120),
  constraint processor_provider_purpose_chk check (char_length(btrim(technical_purpose)) between 10 and 1000),
  constraint processor_provider_evidence_chk check (char_length(btrim(physical_evidence)) between 10 and 1000),
  constraint processor_provider_required_active_chk check (not required_current or active)
);
alter table private.processor_provider_inventory enable row level security;
alter table private.processor_provider_inventory force row level security;
revoke all on table private.processor_provider_inventory from public, anon, authenticated;
comment on table private.processor_provider_inventory is
  'P4 physically verified technical provider inventory of the CLEAN stack. Trusted operations maintain it; no client role can read or write. It is not a legal processor map.';

insert into private.processor_provider_inventory(code,display_name,technical_purpose,physical_evidence,required_current,active) values
  ('SUPABASE_PLATFORM','Supabase',
   'Primary cloud platform: Postgres database, Auth, PostgREST API, Storage and Edge Functions runtime for every client call.',
   'Live CLEAN project leqcwgzvjsxugfgzdmth (Postgres 17) with the uskoci-ai-interview Edge function deployed and one private Storage bucket profile-media; the app has no other backend.',
   true,true),
  ('OPENAI_AI','OpenAI',
   'External AI provider adapter for the AI interview turn (Responses API).',
   'supabase/functions/uskoci-ai-interview/index.ts callOpenAI posts to https://api.openai.com/v1/responses. Runtime selection depends on the AI_PROVIDER and OPENAI_API_KEY secrets, which this unit cannot read, so coverage is required fail-safe until authorized operations retire the unused adapter.',
   true,true),
  ('GOOGLE_GEMINI_AI','Google Gemini',
   'External AI provider adapter for the AI interview turn (generateContent API).',
   'supabase/functions/uskoci-ai-interview/index.ts callGemini posts to generativelanguage.googleapis.com and is the default route when GEMINI_API_KEY and GEMINI_MODEL are set without AI_PROVIDER. Runtime selection is not readable by this unit, so coverage is required fail-safe.',
   true,true),
  ('EXPO_PUSH','Expo Push',
   'Push transport candidate for Expo push tickets and receipts.',
   'notification_push_devices and notification_push_attempts exist (N06/N07 registry) but no Edge function or job in this repository calls exp.host; the transport is not admitted, so this provider processes no personal data yet.',
   false,false);

-- Trusted legal map versions. Exactly one active (unretired) map at a time.
create table private.processor_map_sets (
  id uuid primary key default gen_random_uuid(),
  map_version text not null unique,
  counsel_reference text not null,
  effective_at timestamptz not null,
  retired_at timestamptz null,
  published_at timestamptz not null default statement_timestamp(),
  constraint processor_map_version_chk check (char_length(btrim(map_version)) between 1 and 80),
  constraint processor_map_counsel_chk check (char_length(btrim(counsel_reference)) between 3 and 500),
  constraint processor_map_dates_chk check (retired_at is null or retired_at>effective_at)
);
create unique index processor_map_one_active_uq on private.processor_map_sets((true)) where retired_at is null;
alter table private.processor_map_sets enable row level security;
alter table private.processor_map_sets force row level security;
revoke all on table private.processor_map_sets from public, anon, authenticated;
comment on table private.processor_map_sets is
  'P4 trusted processor/subprocessor map versions. The migration seeds no legal map; publication is a trusted-server act.';

create table private.processor_map_entries (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references private.processor_map_sets(id) on delete restrict,
  provider_code text not null references private.processor_provider_inventory(code) on delete restrict,
  legal_entity_name text not null,
  legal_role text not null,
  purpose text not null,
  data_categories jsonb not null,
  processing_regions text not null,
  cross_border_transfer boolean not null,
  transfer_mechanism text not null,
  dpa_reference text not null,
  privacy_notice_url text not null,
  retention_deletion_terms text not null,
  subprocessor_terms text not null,
  legal_basis_reference text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint processor_entry_provider_uq unique(map_id,provider_code),
  constraint processor_entry_legal_entity_chk check (char_length(btrim(legal_entity_name)) between 2 and 300),
  constraint processor_entry_role_chk check (legal_role in ('PROCESSOR','SUBPROCESSOR','INDEPENDENT_CONTROLLER')),
  constraint processor_entry_purpose_chk check (char_length(btrim(purpose)) between 10 and 2000),
  constraint processor_entry_categories_chk check (jsonb_typeof(data_categories)='array' and jsonb_array_length(data_categories)>0),
  constraint processor_entry_regions_chk check (char_length(btrim(processing_regions)) between 2 and 1000),
  constraint processor_entry_transfer_chk check (char_length(btrim(transfer_mechanism)) between 2 and 2000),
  constraint processor_entry_dpa_chk check (char_length(btrim(dpa_reference)) between 2 and 2000),
  constraint processor_entry_privacy_url_chk check (privacy_notice_url ~ '^https://[^[:space:]]+$' and char_length(privacy_notice_url)<=2000),
  constraint processor_entry_retention_chk check (char_length(btrim(retention_deletion_terms)) between 3 and 2000),
  constraint processor_entry_subprocessor_chk check (char_length(btrim(subprocessor_terms)) between 3 and 2000),
  constraint processor_entry_legal_basis_chk check (char_length(btrim(legal_basis_reference)) between 3 and 2000)
);
create index processor_map_entries_map_idx on private.processor_map_entries(map_id,provider_code);
alter table private.processor_map_entries enable row level security;
alter table private.processor_map_entries force row level security;
revoke all on table private.processor_map_entries from public, anon, authenticated;
comment on table private.processor_map_entries is
  'P4 trusted per-provider legal/contract map rows. No row is seeded by migration.';

-- Authenticated readiness projection. Fail-closed until one active map covers
-- every active required provider. Never admits a runtime provider gate.
create function public.rpc_get_processor_map_status()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  u uuid:=auth.uid();
  p private.processor_map_sets%rowtype;
  active_count integer;
  technical_count integer;
  required_count integer;
  covered_count integer;
  missing jsonb;
  mapped jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select count(*) into technical_count from private.processor_provider_inventory x;
  select count(*) into required_count from private.processor_provider_inventory x where x.active and x.required_current;
  select count(*) into active_count from private.processor_map_sets x where x.retired_at is null and x.effective_at<=statement_timestamp();

  if active_count=0 then
    return jsonb_build_object('ready',false,'reason','PROCESSOR_MAP_NOT_PUBLISHED',
      'technicalProviderCount',technical_count,'requiredCurrentProviders',required_count,'runtimeProviderGateAdmitted',false);
  end if;
  if active_count<>1 then
    return jsonb_build_object('ready',false,'reason','PROCESSOR_MAP_AMBIGUOUS',
      'technicalProviderCount',technical_count,'requiredCurrentProviders',required_count,'runtimeProviderGateAdmitted',false);
  end if;

  select * into p from private.processor_map_sets x
  where x.retired_at is null and x.effective_at<=statement_timestamp()
  order by x.effective_at desc limit 1;

  select count(*) into covered_count
  from private.processor_provider_inventory i
  where i.active and i.required_current
    and exists(select 1 from private.processor_map_entries e where e.map_id=p.id and e.provider_code=i.code);

  select coalesce(jsonb_agg(i.code order by i.code),'[]'::jsonb) into missing
  from private.processor_provider_inventory i
  where i.active and i.required_current
    and not exists(select 1 from private.processor_map_entries e where e.map_id=p.id and e.provider_code=i.code);

  if covered_count<>required_count then
    return jsonb_build_object('ready',false,'reason','PROCESSOR_MAP_INCOMPLETE','mapVersion',p.map_version,
      'technicalProviderCount',technical_count,'requiredCurrentProviders',required_count,'coveredCurrentProviders',covered_count,
      'missingProviders',missing,'runtimeProviderGateAdmitted',false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'providerCode',e.provider_code,'providerDisplayName',i.display_name,'legalEntityName',e.legal_entity_name,
    'legalRole',e.legal_role,'purpose',e.purpose,'dataCategories',e.data_categories,'processingRegions',e.processing_regions,
    'crossBorderTransfer',e.cross_border_transfer,'transferMechanism',e.transfer_mechanism,'dpaReference',e.dpa_reference,
    'privacyNoticeUrl',e.privacy_notice_url,'retentionDeletionTerms',e.retention_deletion_terms,
    'subprocessorTerms',e.subprocessor_terms,'legalBasisReference',e.legal_basis_reference
  ) order by i.display_name),'[]'::jsonb) into mapped
  from private.processor_map_entries e
  join private.processor_provider_inventory i on i.code=e.provider_code
  where e.map_id=p.id and i.active;

  return jsonb_build_object('ready',true,'reason',null,'mapVersion',p.map_version,'effectiveAt',p.effective_at,
    'counselReference',p.counsel_reference,'technicalProviderCount',technical_count,'requiredCurrentProviders',required_count,
    'coveredCurrentProviders',covered_count,'providers',mapped,'runtimeProviderGateAdmitted',false);
end;
$function$;
revoke all on function public.rpc_get_processor_map_status() from public, anon, service_role;
grant execute on function public.rpc_get_processor_map_status() to authenticated;

-- Trusted-server publication of one complete map version. Atomic: any invalid
-- entry or missing required coverage rolls the whole publication back.
create function public.rpc_publish_processor_map(
  p_map_version text,
  p_counsel_reference text,
  p_effective_at timestamptz,
  p_entries jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  p private.processor_map_sets%rowtype;
  item jsonb;
  provider_code_input text;
  legal_role_input text;
  data_categories_input jsonb;
  required_count integer;
  covered_count integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'TRUSTED_SERVER_REQUIRED' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_map_version,'')))<1 or char_length(btrim(p_map_version))>80 then raise exception 'PROCESSOR_MAP_VERSION_INVALID' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_counsel_reference,'')))<3 or char_length(btrim(p_counsel_reference))>500 then raise exception 'PROCESSOR_MAP_COUNSEL_REFERENCE_REQUIRED' using errcode='22023'; end if;
  if p_effective_at is null then raise exception 'PROCESSOR_MAP_EFFECTIVE_AT_REQUIRED' using errcode='22023'; end if;
  if p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)=0 then raise exception 'PROCESSOR_MAP_ENTRIES_REQUIRED' using errcode='22023'; end if;

  -- One publication at a time: a concurrent publisher observes the committed
  -- active map and receives the explicit refusal instead of a unique violation.
  perform pg_advisory_xact_lock(hashtextextended('uskoci:processor-map-publish',0));
  if exists(select 1 from private.processor_map_sets x where x.retired_at is null) then
    raise exception 'PROCESSOR_MAP_ACTIVE_ALREADY_EXISTS' using errcode='55000';
  end if;

  insert into private.processor_map_sets(map_version,counsel_reference,effective_at)
  values(btrim(p_map_version),btrim(p_counsel_reference),p_effective_at) returning * into p;

  for item in select value from jsonb_array_elements(p_entries) loop
    provider_code_input:=upper(btrim(coalesce(item->>'providerCode','')));
    if not exists(select 1 from private.processor_provider_inventory i where i.code=provider_code_input) then
      raise exception 'PROCESSOR_PROVIDER_UNKNOWN' using errcode='22023', detail=provider_code_input;
    end if;
    if not exists(select 1 from private.processor_provider_inventory i where i.code=provider_code_input and i.active) then
      raise exception 'PROCESSOR_PROVIDER_NOT_CURRENTLY_ACTIVE' using errcode='23514', detail=provider_code_input;
    end if;
    legal_role_input:=upper(btrim(coalesce(item->>'legalRole','')));
    if legal_role_input not in ('PROCESSOR','SUBPROCESSOR','INDEPENDENT_CONTROLLER') then
      raise exception 'PROCESSOR_LEGAL_ROLE_INVALID' using errcode='22023', detail=provider_code_input;
    end if;
    data_categories_input:=item->'dataCategories';
    if data_categories_input is null or jsonb_typeof(data_categories_input)<>'array' or jsonb_array_length(data_categories_input)=0
       or exists(select 1 from jsonb_array_elements(data_categories_input) x where jsonb_typeof(x.value)<>'string' or char_length(btrim(x.value#>>'{}'))<1) then
      raise exception 'PROCESSOR_DATA_CATEGORIES_INVALID' using errcode='22023', detail=provider_code_input;
    end if;
    if jsonb_typeof(item->'crossBorderTransfer') is distinct from 'boolean' then
      raise exception 'PROCESSOR_CROSS_BORDER_FLAG_REQUIRED' using errcode='22023', detail=provider_code_input;
    end if;

    insert into private.processor_map_entries(
      map_id,provider_code,legal_entity_name,legal_role,purpose,data_categories,processing_regions,
      cross_border_transfer,transfer_mechanism,dpa_reference,privacy_notice_url,
      retention_deletion_terms,subprocessor_terms,legal_basis_reference
    ) values(
      p.id,provider_code_input,btrim(coalesce(item->>'legalEntityName','')),legal_role_input,
      btrim(coalesce(item->>'purpose','')),data_categories_input,btrim(coalesce(item->>'processingRegions','')),
      (item->>'crossBorderTransfer')::boolean,btrim(coalesce(item->>'transferMechanism','')),
      btrim(coalesce(item->>'dpaReference','')),btrim(coalesce(item->>'privacyNoticeUrl','')),
      btrim(coalesce(item->>'retentionDeletionTerms','')),btrim(coalesce(item->>'subprocessorTerms','')),
      btrim(coalesce(item->>'legalBasisReference',''))
    );
  end loop;

  select count(*) into required_count from private.processor_provider_inventory i where i.active and i.required_current;
  select count(*) into covered_count
  from private.processor_provider_inventory i
  where i.active and i.required_current
    and exists(select 1 from private.processor_map_entries e where e.map_id=p.id and e.provider_code=i.code);
  if covered_count<>required_count then
    raise exception 'PROCESSOR_MAP_REQUIRED_COVERAGE_MISSING' using errcode='23514';
  end if;

  perform private.audit_marketplace(null,'PROCESSOR_MAP_PUBLISHED','SYSTEM',p.id,null,
    jsonb_build_object('mapVersion',p.map_version,'requiredCurrentProviders',required_count,'coveredCurrentProviders',covered_count));

  return jsonb_build_object('mapId',p.id,'mapVersion',p.map_version,'requiredCurrentProviders',required_count,
    'coveredCurrentProviders',covered_count,'runtimeProviderGateAdmitted',false);
end;
$function$;
revoke all on function public.rpc_publish_processor_map(text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.rpc_publish_processor_map(text,text,timestamptz,jsonb) to service_role;

comment on function public.rpc_get_processor_map_status() is
  'P4: authenticated readiness of the trusted processor map; fail-closed until one active map covers every active required provider; runtime provider gate never admitted here.';
comment on function public.rpc_publish_processor_map(text,text,timestamptz,jsonb) is
  'P4: trusted-server atomic publication of one complete map version; refuses a second active map; audits PROCESSOR_MAP_PUBLISHED.';

commit;
