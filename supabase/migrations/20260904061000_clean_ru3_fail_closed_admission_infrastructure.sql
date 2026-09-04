-- USKOČI RU-3 — D-0140 FAIL-CLOSED ADMISSION/PUBLISH INFRASTRUCTURE
--
-- IMPORTANT: this migration contains ZERO substantive legal/safety rules and
-- seeds ZERO ACTIVE policy bundles. It is intentionally incapable of producing
-- a production ALLOW until reviewed policy content is supplied in a later,
-- separately reviewed forward migration.
--
-- Predecessor: 60 / 20260903222333_clean_ru2_ai_fact_transition_guard

begin;

do $ru3_predecessor$
declare
  v_count integer;
  v_head text;
  v_need_count bigint;
  v_need_fp text;
begin
  select count(*),max(version) into v_count,v_head
    from supabase_migrations.schema_migrations;
  if v_count<>60 or v_head<>'20260903222333' then
    raise exception using errcode='55000',
      message=format('RU3_PREDECESSOR_MISMATCH: expected 60/20260903222333, got %s/%s',v_count,coalesce(v_head,'<null>'));
  end if;

  if to_regclass('public.needs') is null
     or to_regclass('public.need_geography') is null
     or to_regclass('public.need_requirement_details') is null
     or to_regclass('public.need_sensitive') is null
     or to_regprocedure('private.dispatch_next_wave(uuid)') is null
     or to_regprocedure('private.enqueue_dispatch(uuid,timestamp with time zone)') is null
     or to_regprocedure('public.rpc_save_need_draft_from_review(uuid,uuid,text)') is null then
    raise exception 'RU3_PREDECESSOR_OBJECT_MISMATCH' using errcode='55000';
  end if;

  if position('LEGACY_RPC_RETIRED' in pg_get_functiondef('public.rpc_publish_need(uuid,timestamp with time zone)'::regprocedure))=0
     or position('PACKAGE_4_NOT_READY' in pg_get_functiondef('public.rpc_ai_publish_need(uuid,uuid)'::regprocedure))=0 then
    raise exception 'RU3_LEGACY_PUBLISH_PREDECESSOR_MISMATCH' using errcode='55000';
  end if;

  if to_regclass('private.publication_policy_bundles') is not null
     or to_regclass('private.need_publication_decisions') is not null
     or to_regprocedure('public.rpc_publish_admitted_need(uuid,integer,text,timestamp with time zone)') is not null then
    raise exception 'RU3_ALREADY_PARTIALLY_PRESENT' using errcode='55000';
  end if;
end
$ru3_predecessor$;

create temporary table ru3_preserved_business_state (
  need_count bigint not null,
  need_fingerprint text not null,
  dispatch_schedule_count bigint not null
) on commit drop;

insert into ru3_preserved_business_state
select
  (select count(*) from public.needs),
  (select md5(coalesce(string_agg(to_jsonb(n)::text,E'\n' order by n.id),'')) from public.needs n),
  (select count(*) from private.dispatch_schedule);

-- ---------------------------------------------------------------------------
-- B05: versioned policy-bundle metadata. Migration-owned only.
-- No client/service raw DML and no production seed in this migration.
-- ---------------------------------------------------------------------------
create table private.publication_policy_bundles (
  id uuid primary key default extensions.gen_random_uuid(),
  jurisdiction text not null,
  bundle_version text not null,
  status text not null default 'DRAFT',
  review_status text not null default 'UNREVIEWED',
  content_hash text,
  reviewed_at timestamptz,
  reviewed_by text,
  provenance_ref text,
  created_at timestamptz not null default statement_timestamp(),
  check (char_length(btrim(jurisdiction)) between 2 and 32),
  check (char_length(btrim(bundle_version)) between 1 and 120),
  check (status in ('DRAFT','ACTIVE','RETIRED','DISABLED')),
  check (review_status in ('UNREVIEWED','NEEDS_LEGAL_REVIEW','REVIEWED')),
  check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  check (reviewed_by is null or char_length(btrim(reviewed_by)) between 1 and 240),
  check (provenance_ref is null or char_length(btrim(provenance_ref)) between 1 and 1000),
  check (
    status<>'ACTIVE'
    or (
      review_status='REVIEWED'
      and content_hash is not null
      and reviewed_at is not null
      and reviewed_by is not null
      and provenance_ref is not null
    )
  ),
  unique(jurisdiction,bundle_version)
);

create unique index publication_policy_one_active_per_jurisdiction
  on private.publication_policy_bundles(jurisdiction)
  where status='ACTIVE';

alter table private.publication_policy_bundles enable row level security;
alter table private.publication_policy_bundles force row level security;
revoke all on table private.publication_policy_bundles from public,anon,authenticated,service_role;

create table private.publication_policy_rules (
  bundle_id uuid not null references private.publication_policy_bundles(id) on delete cascade,
  rule_id text not null,
  rule_version text not null,
  rule_spec jsonb not null,
  rule_hash text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  primary key(bundle_id,rule_id),
  check (char_length(btrim(rule_id)) between 1 and 160),
  check (char_length(btrim(rule_version)) between 1 and 120),
  check (jsonb_typeof(rule_spec)='object'),
  check (rule_hash ~ '^[0-9a-f]{64}$')
);

alter table private.publication_policy_rules enable row level security;
alter table private.publication_policy_rules force row level security;
revoke all on table private.publication_policy_rules from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Canonical Need publication snapshot/fingerprint.
-- Exact private values never leave the private helper; only a one-way hash marker
-- participates so a private material change invalidates a prior admission.
-- ---------------------------------------------------------------------------
create or replace function private.need_publication_snapshot(p_need_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  n public.needs%rowtype;
  v_geo jsonb;
  v_conditions text[];
  v_private_hash text;
begin
  select * into n from public.needs where id=p_need_id;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;

  select g.public_topology into v_geo
    from public.need_geography g where g.need_id=n.id;
  select d.critical_conditions into v_conditions
    from public.need_requirement_details d where d.need_id=n.id;

  select encode(extensions.digest(
      convert_to(jsonb_build_object(
        'exactAddress',coalesce(s.exact_address,''),
        'accessNotes',coalesce(s.access_notes,'')
      )::text,'UTF8'),'sha256'),'hex')
    into v_private_hash
    from public.need_sensitive s where s.need_id=n.id;

  return jsonb_build_object(
    'needId',n.id,
    'revision',n.revision,
    'requesterAccountId',n.requester_account_id,
    'requesterProfileId',n.requester_profile_id,
    'title',n.title,
    'description',n.description,
    'category',n.category,
    'priceMode',n.mode,
    'requesterPriceRsd',n.requester_price_rsd,
    'scheduleKind',n.schedule_kind,
    'startsAt',n.starts_at,
    'endsAt',n.ends_at,
    'peopleNeeded',n.required_slots,
    'requiredSkills',to_jsonb(n.required_skills),
    'requiredTools',to_jsonb(n.required_tools),
    'requiredVehicles',to_jsonb(n.required_vehicles),
    'requiredLicenses',to_jsonb(n.required_licenses),
    'minimumExperienceYears',n.minimum_experience_years,
    'verifiedIdentityRequired',n.verified_identity_required,
    'executionLocationMode',n.execution_location_mode,
    'approximateCity',n.approximate_city,
    'approximateArea',n.approximate_area,
    'approximateLat',n.approximate_lat,
    'approximateLng',n.approximate_lng,
    'publicGeography',coalesce(v_geo,'null'::jsonb),
    'criticalConditions',to_jsonb(coalesce(v_conditions,'{}'::text[])),
    'publicPhotoPaths',to_jsonb(n.public_photo_paths),
    'privateMaterialHash',coalesce(v_private_hash,'NONE')
  );
end
$function$;

create or replace function private.need_publication_fingerprint(p_need_id uuid)
returns text
language sql
security definer
set search_path to 'pg_catalog'
as $function$
  select encode(extensions.digest(
    convert_to(private.need_publication_snapshot(p_need_id)::text,'UTF8'),
    'sha256'
  ),'hex');
$function$;

revoke all on function private.need_publication_snapshot(uuid) from public,anon,authenticated,service_role;
revoke all on function private.need_publication_fingerprint(uuid) from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- B06: append-only exact publication decisions. Raw rows are never client API.
-- ---------------------------------------------------------------------------
create table private.need_publication_decisions (
  id uuid primary key default extensions.gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  need_revision integer not null check (need_revision>=1),
  need_fingerprint text not null check (need_fingerprint ~ '^[0-9a-f]{64}$'),
  bundle_id uuid not null references private.publication_policy_bundles(id) on delete restrict,
  outcome text not null check (outcome in ('ALLOW','CLARIFY','REVIEW','BLOCK')),
  reason_codes text[] not null,
  rule_ids text[] not null,
  evaluator_version text not null,
  decision_request_id text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  check (cardinality(reason_codes) between 1 and 50),
  check (cardinality(rule_ids) between 1 and 100),
  check (char_length(btrim(evaluator_version)) between 1 and 240),
  check (char_length(btrim(decision_request_id)) between 8 and 200),
  unique(need_id,decision_request_id)
);

create index need_publication_decision_current_idx
  on private.need_publication_decisions
  (need_id,need_revision,need_fingerprint,bundle_id,created_at desc,id desc);

alter table private.need_publication_decisions enable row level security;
alter table private.need_publication_decisions force row level security;
revoke all on table private.need_publication_decisions from public,anon,authenticated,service_role;

create or replace function private.guard_publication_decision_immutable()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
begin
  raise exception 'PUBLICATION_DECISION_IMMUTABLE' using errcode='42501';
end
$function$;

create trigger need_publication_decision_immutable_trg
before update or delete on private.need_publication_decisions
for each row execute function private.guard_publication_decision_immutable();

revoke all on function private.guard_publication_decision_immutable() from public,anon,authenticated,service_role;

create or replace function public.rpc_record_need_publication_decision_service(
  p_need_id uuid,
  p_expected_revision integer,
  p_expected_fingerprint text,
  p_bundle_id uuid,
  p_outcome text,
  p_reason_codes text[],
  p_rule_ids text[],
  p_evaluator_version text,
  p_client_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  n public.needs%rowtype;
  b private.publication_policy_bundles%rowtype;
  v_fp text;
  v_reason_codes text[];
  v_rule_ids text[];
  v_rule_count integer;
  v_hash text;
  v_existing private.need_publication_decisions%rowtype;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_expected_revision is null or p_expected_revision<1
     or p_expected_fingerprint is null or p_expected_fingerprint !~ '^[0-9a-f]{64}$'
     or p_bundle_id is null
     or p_outcome not in ('ALLOW','CLARIFY','REVIEW','BLOCK')
     or coalesce(char_length(btrim(p_evaluator_version)),0)<1
     or char_length(btrim(p_evaluator_version))>240
     or coalesce(char_length(btrim(p_client_request_id)),0)<8
     or char_length(btrim(p_client_request_id))>200 then
    raise exception 'PUBLICATION_DECISION_INPUT_INVALID' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(x) order by btrim(x)),'{}'::text[])
    into v_reason_codes
    from unnest(coalesce(p_reason_codes,'{}'::text[])) x
   where nullif(btrim(x),'') is not null;
  select coalesce(array_agg(distinct btrim(x) order by btrim(x)),'{}'::text[])
    into v_rule_ids
    from unnest(coalesce(p_rule_ids,'{}'::text[])) x
   where nullif(btrim(x),'') is not null;

  if cardinality(v_reason_codes)<1 or cardinality(v_reason_codes)>50
     or cardinality(v_rule_ids)<1 or cardinality(v_rule_ids)>100 then
    raise exception 'PUBLICATION_DECISION_EVIDENCE_REQUIRED' using errcode='22023';
  end if;

  select * into n from public.needs where id=p_need_id for share;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if n.status<>'DRAFT' or n.revision<>p_expected_revision then
    raise exception 'NEED_NOT_CURRENT_DRAFT' using errcode='P0001';
  end if;

  v_fp:=private.need_publication_fingerprint(n.id);
  if v_fp is distinct from p_expected_fingerprint then
    raise exception 'PUBLICATION_FINGERPRINT_STALE' using errcode='P0001';
  end if;

  select * into b
    from private.publication_policy_bundles
   where id=p_bundle_id;
  if not found
     or b.status<>'ACTIVE'
     or b.review_status<>'REVIEWED'
     or b.reviewed_at is null
     or b.reviewed_by is null
     or b.provenance_ref is null
     or b.content_hash is null then
    raise exception 'POLICY_BUNDLE_NOT_REVIEWED_ACTIVE' using errcode='P0001';
  end if;

  select count(distinct r.rule_id) into v_rule_count
    from private.publication_policy_rules r
   where r.bundle_id=b.id
     and r.enabled
     and r.rule_id=any(v_rule_ids);
  if v_rule_count<>cardinality(v_rule_ids) then
    raise exception 'PUBLICATION_RULE_REFERENCE_INVALID' using errcode='P0001';
  end if;

  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'needId',n.id,
    'revision',p_expected_revision,
    'fingerprint',v_fp,
    'bundleId',b.id,
    'outcome',p_outcome,
    'reasonCodes',to_jsonb(v_reason_codes),
    'ruleIds',to_jsonb(v_rule_ids),
    'evaluatorVersion',btrim(p_evaluator_version)
  )::text,'UTF8'),'sha256'),'hex');

  select * into v_existing
    from private.need_publication_decisions
   where need_id=n.id and decision_request_id=btrim(p_client_request_id);
  if found then
    if v_existing.request_hash<>v_hash then
      raise exception 'CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_DECISION' using errcode='22023';
    end if;
    return jsonb_build_object(
      'decisionId',v_existing.id,'outcome',v_existing.outcome,
      'needId',v_existing.need_id,'revision',v_existing.need_revision,
      'idempotentReplay',true,'authoritative',true
    );
  end if;

  insert into private.need_publication_decisions(
    need_id,need_revision,need_fingerprint,bundle_id,outcome,reason_codes,rule_ids,
    evaluator_version,decision_request_id,request_hash
  ) values (
    n.id,n.revision,v_fp,b.id,p_outcome,v_reason_codes,v_rule_ids,
    btrim(p_evaluator_version),btrim(p_client_request_id),v_hash
  ) returning id into v_id;

  return jsonb_build_object(
    'decisionId',v_id,'outcome',p_outcome,'needId',n.id,'revision',n.revision,
    'idempotentReplay',false,'authoritative',true
  );
end
$function$;

revoke all on function public.rpc_record_need_publication_decision_service(uuid,integer,text,uuid,text,text[],text[],text,text)
from public,anon,authenticated,service_role;
grant execute on function public.rpc_record_need_publication_decision_service(uuid,integer,text,uuid,text,text[],text[],text,text)
to service_role;

-- User-safe state projection: no internal rule payload/reasoning is exposed.
create or replace function public.rpc_need_publication_state(p_need_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  n public.needs%rowtype;
  b private.publication_policy_bundles%rowtype;
  d private.need_publication_decisions%rowtype;
  v_fp text;
  v_has_stale boolean:=false;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into n from public.needs where id=p_need_id;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if n.requester_account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;

  v_fp:=private.need_publication_fingerprint(n.id);

  select * into b
    from private.publication_policy_bundles
   where status='ACTIVE' and review_status='REVIEWED'
   order by created_at desc,id desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'needId',n.id,'needRevision',n.revision,'needStatus',n.status,
      'outcome','REVIEW','reasonCodes',jsonb_build_array('POLICY_BUNDLE_NOT_READY'),
      'canPublish',false,'decisionCurrent',false,'authoritative',true
    );
  end if;

  select * into d
    from private.need_publication_decisions x
   where x.need_id=n.id
     and x.need_revision=n.revision
     and x.need_fingerprint=v_fp
     and x.bundle_id=b.id
   order by x.created_at desc,x.id desc
   limit 1;

  if not found then
    select exists(
      select 1 from private.need_publication_decisions x
       where x.need_id=n.id and x.need_revision=n.revision and x.bundle_id=b.id
    ) into v_has_stale;
    return jsonb_build_object(
      'needId',n.id,'needRevision',n.revision,'needStatus',n.status,
      'outcome','REVIEW',
      'reasonCodes',case when v_has_stale then jsonb_build_array('ADMISSION_STALE') else jsonb_build_array('ADMISSION_REQUIRED') end,
      'canPublish',false,'decisionCurrent',false,'authoritative',true
    );
  end if;

  return jsonb_build_object(
    'needId',n.id,'needRevision',n.revision,'needStatus',n.status,
    'outcome',d.outcome,'reasonCodes',to_jsonb(d.reason_codes),
    'canPublish',(n.status='DRAFT' and d.outcome='ALLOW'),
    'decisionCurrent',true,'decisionAt',d.created_at,'authoritative',true
  );
end
$function$;

revoke all on function public.rpc_need_publication_state(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_need_publication_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- B07: canonical owner publish command. Existing Need lifecycle trigger owns
-- DRAFT->PUBLISHED and the existing enqueue trigger owns marketplace dispatch.
-- ---------------------------------------------------------------------------
create table private.need_publish_commands (
  account_id uuid not null references auth.users(id) on delete cascade,
  client_request_id text not null,
  need_id uuid not null references public.needs(id) on delete cascade,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  decision_id uuid not null references private.need_publication_decisions(id) on delete restrict,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(account_id,client_request_id),
  check (char_length(btrim(client_request_id)) between 8 and 200)
);

alter table private.need_publish_commands enable row level security;
alter table private.need_publish_commands force row level security;
revoke all on table private.need_publish_commands from public,anon,authenticated,service_role;

create or replace function public.rpc_publish_admitted_need(
  p_need_id uuid,
  p_expected_revision integer,
  p_client_request_id text,
  p_response_deadline timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  n public.needs%rowtype;
  b private.publication_policy_bundles%rowtype;
  d private.need_publication_decisions%rowtype;
  c private.need_publish_commands%rowtype;
  v_fp text;
  v_hash text;
  v_result jsonb;
  v_valid_rules integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_expected_revision is null or p_expected_revision<1
     or coalesce(char_length(btrim(p_client_request_id)),0)<8
     or char_length(btrim(p_client_request_id))>200 then
    raise exception 'PUBLISH_INPUT_INVALID' using errcode='22023';
  end if;
  if p_response_deadline is not null and p_response_deadline<=statement_timestamp() then
    raise exception 'DEADLINE_IN_PAST' using errcode='22023';
  end if;

  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'needId',p_need_id,
    'expectedRevision',p_expected_revision,
    'responseDeadline',p_response_deadline
  )::text,'UTF8'),'sha256'),'hex');

  select * into c
    from private.need_publish_commands
   where account_id=v_uid and client_request_id=btrim(p_client_request_id)
   for update;
  if found then
    if c.need_id<>p_need_id or c.request_hash<>v_hash then
      raise exception 'CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_PUBLISH' using errcode='22023';
    end if;
    return c.result || jsonb_build_object('idempotentReplay',true);
  end if;

  select * into n from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if n.requester_account_id<>v_uid then raise exception 'NOT_OWNER' using errcode='42501'; end if;
  if n.status<>'DRAFT' then raise exception 'NEED_NOT_DRAFT' using errcode='P0001'; end if;
  if n.revision<>p_expected_revision then raise exception 'NEED_REVISION_STALE' using errcode='P0001'; end if;

  v_fp:=private.need_publication_fingerprint(n.id);

  select * into b
    from private.publication_policy_bundles
   where status='ACTIVE' and review_status='REVIEWED'
   order by created_at desc,id desc
   limit 1;
  if not found then raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001'; end if;

  select * into d
    from private.need_publication_decisions x
   where x.need_id=n.id
     and x.need_revision=n.revision
     and x.need_fingerprint=v_fp
     and x.bundle_id=b.id
   order by x.created_at desc,x.id desc
   limit 1;
  if not found then raise exception 'ADMISSION_REQUIRED_OR_STALE' using errcode='P0001'; end if;
  if d.outcome<>'ALLOW' then
    raise exception 'PUBLICATION_NOT_ALLOWED' using errcode='P0001',detail=d.outcome;
  end if;

  select count(distinct r.rule_id) into v_valid_rules
    from private.publication_policy_rules r
   where r.bundle_id=b.id and r.enabled and r.rule_id=any(d.rule_ids);
  if v_valid_rules<>cardinality(d.rule_ids) then
    raise exception 'ADMISSION_RULES_NO_LONGER_CURRENT' using errcode='P0001';
  end if;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  update public.needs
     set status='PUBLISHED',
         published_at=statement_timestamp(),
         response_deadline=coalesce(p_response_deadline,response_deadline)
   where id=n.id
   returning * into n;

  if not exists(select 1 from private.dispatch_schedule s where s.need_id=n.id) then
    raise exception 'PUBLISH_DISPATCH_ENQUEUE_FAILED' using errcode='55000';
  end if;

  v_result:=jsonb_build_object(
    'needId',n.id,'status',n.status,'revision',n.revision,
    'responseDeadline',n.response_deadline,'decisionId',d.id,
    'idempotentReplay',false,'authoritative',true
  );

  insert into private.need_publish_commands(
    account_id,client_request_id,need_id,request_hash,decision_id,result
  ) values (
    v_uid,btrim(p_client_request_id),n.id,v_hash,d.id,v_result
  );

  return v_result;
end
$function$;

revoke all on function public.rpc_publish_admitted_need(uuid,integer,text,timestamp with time zone)
from public,anon,authenticated,service_role;
grant execute on function public.rpc_publish_admitted_need(uuid,integer,text,timestamp with time zone)
to authenticated;

-- Legacy AI publisher is now fully retired from API execution; its tombstone body
-- remains as provenance. Ordinary legacy rpc_publish_need was already revoked.
revoke all on function public.rpc_ai_publish_need(uuid,uuid) from public,anon,authenticated,service_role;

comment on table private.publication_policy_bundles is
  'RU-3 D-0140 versioned policy metadata. Migration-owned only; this migration seeds no policy content and no ACTIVE bundle.';
comment on table private.publication_policy_rules is
  'RU-3 D-0140 rule registry. No substantive legal/safety rule is seeded by the infrastructure migration.';
comment on table private.need_publication_decisions is
  'RU-3 append-only exact Need revision/fingerprint/policy decision ledger; raw rows are not user API.';
comment on function public.rpc_need_publication_state(uuid) is
  'RU-3 owner-safe publication state. Missing/unreviewed/stale admission fails closed to REVIEW.';
comment on function public.rpc_publish_admitted_need(uuid,integer,text,timestamp with time zone) is
  'RU-3 canonical owner publish: current DRAFT + exact revision/fingerprint + latest exact ALLOW under current ACTIVE reviewed policy bundle; semantic idempotency; existing dispatch trigger reused.';

do $ru3_postconditions$
declare
  v_before ru3_preserved_business_state%rowtype;
  v_need_count bigint;
  v_need_fp text;
  v_dispatch_count bigint;
begin
  select * into v_before from ru3_preserved_business_state;
  select count(*),md5(coalesce(string_agg(to_jsonb(n)::text,E'\n' order by n.id),''))
    into v_need_count,v_need_fp from public.needs n;
  select count(*) into v_dispatch_count from private.dispatch_schedule;

  if v_need_count<>v_before.need_count or v_need_fp<>v_before.need_fingerprint then
    raise exception 'RU3_POSTCONDITION_EXISTING_NEEDS_CHANGED';
  end if;
  if v_dispatch_count<>v_before.dispatch_schedule_count then
    raise exception 'RU3_POSTCONDITION_DISPATCH_CHANGED';
  end if;

  if exists(select 1 from private.publication_policy_bundles)
     or exists(select 1 from private.publication_policy_rules)
     or exists(select 1 from private.need_publication_decisions)
     or exists(select 1 from private.need_publish_commands) then
    raise exception 'RU3_POSTCONDITION_POLICY_OR_COMMAND_SEEDED';
  end if;

  if has_table_privilege('authenticated','private.publication_policy_bundles','SELECT')
     or has_table_privilege('service_role','private.publication_policy_bundles','INSERT')
     or has_table_privilege('authenticated','private.need_publication_decisions','SELECT')
     or has_table_privilege('service_role','private.need_publication_decisions','INSERT') then
    raise exception 'RU3_POSTCONDITION_RAW_POLICY_AUTHORITY_EXPOSED';
  end if;

  if has_function_privilege('authenticated',
       'public.rpc_record_need_publication_decision_service(uuid,integer,text,uuid,text,text[],text[],text,text)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.rpc_record_need_publication_decision_service(uuid,integer,text,uuid,text,text[],text[],text,text)','EXECUTE') then
    raise exception 'RU3_POSTCONDITION_DECISION_WRITER_GRANTS';
  end if;

  if not has_function_privilege('authenticated','public.rpc_need_publication_state(uuid)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.rpc_publish_admitted_need(uuid,integer,text,timestamp with time zone)','EXECUTE')
     or has_function_privilege('anon',
       'public.rpc_publish_admitted_need(uuid,integer,text,timestamp with time zone)','EXECUTE') then
    raise exception 'RU3_POSTCONDITION_USER_COMMAND_GRANTS';
  end if;

  if has_function_privilege('authenticated','public.rpc_publish_need(uuid,timestamp with time zone)','EXECUTE')
     or has_function_privilege('authenticated','public.rpc_ai_publish_need(uuid,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.rpc_ai_publish_need(uuid,uuid)','EXECUTE') then
    raise exception 'RU3_POSTCONDITION_LEGACY_PUBLISH_EXPOSURE';
  end if;
end
$ru3_postconditions$;

commit;
