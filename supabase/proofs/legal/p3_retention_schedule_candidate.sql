-- P3 retention schedule registry: physically verified technical data-class
-- inventory of the CLEAN stack plus a trusted, versioned retention policy
-- boundary. Ported from donor rc2_024 (with its publisher ambiguity repair
-- folded in) onto CLEAN authority (inline auth check, statement_timestamp,
-- private.audit_marketplace, advisory lock on publish, private schema).
-- Seeds ONLY data classes whose surfaces exist in this repository and the
-- live project. Seeds NO retention period, deletion rule, exception, legal
-- basis or counsel-approved policy. No purge or deletion worker is admitted.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $precondition$
begin
  if to_regclass('private.retention_data_classes') is not null
     or to_regclass('private.retention_policy_sets') is not null
     or to_regclass('private.retention_policy_rules') is not null then
    raise exception 'P3_RETENTION_TABLES_ALREADY_EXIST';
  end if;
  if to_regprocedure('public.rpc_get_retention_policy_status()') is not null
     or to_regprocedure('public.rpc_publish_retention_policy(text,text,timestamptz,jsonb)') is not null then
    raise exception 'P3_RETENTION_FUNCTIONS_ALREADY_EXIST';
  end if;
  if to_regprocedure('private.audit_marketplace(uuid,text,text,uuid,integer,jsonb)') is null then
    raise exception 'P3_PREDECESSOR_AUDIT_MISSING' using detail='private.audit_marketplace';
  end if;
  -- Every seeded data class cites a surface that must physically exist.
  if to_regclass('public.app_accounts') is null or to_regclass('public.app_profiles') is null
     or to_regclass('public.needs') is null or to_regclass('public.need_sensitive') is null
     or to_regclass('public.marketplace_responses') is null or to_regclass('private.preselection_qa_questions') is null
     or to_regclass('public.agreements') is null or to_regclass('public.agreement_messages') is null
     or to_regclass('public.notification_deliveries') is null or to_regclass('public.ai_conversations') is null
     or to_regclass('private.need_publish_commands') is null or to_regclass('private.marketplace_audit_log') is null then
    raise exception 'P3_PREDECESSOR_DATA_SURFACES_MISSING';
  end if;
end
$precondition$;

-- Technical data-class inventory. required = the policy must cover it before
-- it can be ready; active = the surfaces exist in the current stack.
create table private.retention_data_classes (
  code text primary key,
  description text not null,
  required boolean not null default true,
  active boolean not null default true,
  updated_at timestamptz not null default statement_timestamp(),
  constraint retention_data_class_code_chk check (code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  constraint retention_data_class_description_chk check (char_length(btrim(description)) between 5 and 500),
  constraint retention_data_class_required_active_chk check (not required or active)
);
alter table private.retention_data_classes enable row level security;
alter table private.retention_data_classes force row level security;
revoke all on table private.retention_data_classes from public, anon, authenticated;
comment on table private.retention_data_classes is
  'P3 physically verified technical data-class inventory of the CLEAN stack. Trusted operations maintain it; no client role can read or write. It is not a retention policy.';

insert into private.retention_data_classes(code,description,required,active) values
  ('ACCOUNT_IDENTITY','Account identity and authentication-linked account state (auth.users, public.app_accounts).',true,true),
  ('PROFILE_DATA','Profile data, availability rules and windows, worker match preferences (app_profiles, profile_availability_rules, profile_availability_windows, worker_match_preferences).',true,true),
  ('NEED_PUBLIC','Public Zadatak content, requirement details, revision events and the typed fact registry (needs, need_requirement_details, private.need_revision_events, private.need_fact_registry).',true,true),
  ('NEED_SENSITIVE','Private Zadatak details, geography and contact/location access grants behind the private-access boundary (need_sensitive, need_geography, access_grants).',true,true),
  ('RESPONSES_SELECTION','Prijava content, versions, application snapshots and selection state (marketplace_responses, marketplace_response_versions, private.response_application_snapshots, need_selections).',true,true),
  ('PRESELECTION_QA','Pre-Dogovor clarification questions, answer versions and their decisions (private.preselection_qa_questions, preselection_qa_answer_versions, preselection_qa_materiality_decisions).',true,true),
  ('AGREEMENT_CORE','Dogovor versions, change proposals, execution and recovery state, Povezivanje activation receipts (agreements, agreement_versions, agreement_change_proposals, agreement_execution, private.connection_activations).',true,true),
  ('AGREEMENT_MESSAGES','Private Dogovor message history (agreement_messages).',true,true),
  ('LEGAL_CONSENT','Versioned Terms/Privacy acceptance evidence and legal document coordinates (account_legal_acceptance_events and private.legal_document_versions, pending forward P1).',true,true),
  ('NOTIFICATION_DELIVERY','Notification preferences, deliveries, push devices and attempts, opportunity dispatch (notification_preferences, notification_deliveries, notification_push_devices, notification_push_attempts, opportunity_deliveries, dispatch_rounds, private.dispatch_schedule).',true,true),
  ('AI_VOLATILE','AI interview conversations, messages, structured facts and action proposals (ai_conversations, ai_messages, ai_structured_facts, ai_action_proposals).',true,true),
  ('MEDIA_OBJECTS','Profile media objects in the private profile-media Storage bucket.',true,true),
  ('COMMAND_LEDGERS','Server-side idempotent command ledgers with request ids and payload snapshots (private need draft/edit/publish, response submit/withdraw/resolution, selection and remaining-search command tables, need_publication_decisions).',true,true),
  ('AUDIT_SECURITY_LOGS','Authoritative mutation audit and user activity events (private.marketplace_audit_log, user_activity_events).',true,true);

-- Trusted policy versions. Exactly one active (unretired) policy at a time.
create table private.retention_policy_sets (
  id uuid primary key default gen_random_uuid(),
  policy_version text not null unique,
  counsel_reference text not null,
  effective_at timestamptz not null,
  retired_at timestamptz null,
  published_at timestamptz not null default statement_timestamp(),
  constraint retention_policy_version_chk check (char_length(btrim(policy_version)) between 1 and 80),
  constraint retention_policy_counsel_chk check (char_length(btrim(counsel_reference)) between 3 and 500),
  constraint retention_policy_dates_chk check (retired_at is null or retired_at>effective_at)
);
create unique index retention_policy_one_active_uq on private.retention_policy_sets((true)) where retired_at is null;
alter table private.retention_policy_sets enable row level security;
alter table private.retention_policy_sets force row level security;
revoke all on table private.retention_policy_sets from public, anon, authenticated;
comment on table private.retention_policy_sets is
  'P3 trusted retention schedule versions. The migration seeds no legal schedule; publication is a trusted-server act.';

create table private.retention_policy_rules (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references private.retention_policy_sets(id) on delete restrict,
  data_class text not null references private.retention_data_classes(code) on delete restrict,
  purpose text not null,
  retention_period_text text not null,
  deletion_trigger text not null,
  exception_rule text not null,
  legal_basis_reference text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint retention_rule_purpose_chk check (char_length(btrim(purpose)) between 10 and 1000),
  constraint retention_rule_period_chk check (char_length(btrim(retention_period_text)) between 2 and 500),
  constraint retention_rule_trigger_chk check (char_length(btrim(deletion_trigger)) between 5 and 1000),
  constraint retention_rule_exception_chk check (char_length(btrim(exception_rule)) between 3 and 2000),
  constraint retention_rule_legal_basis_chk check (char_length(btrim(legal_basis_reference)) between 5 and 1000),
  constraint retention_rule_class_uq unique(policy_id,data_class)
);
create index retention_policy_rules_policy_idx on private.retention_policy_rules(policy_id,data_class);
alter table private.retention_policy_rules enable row level security;
alter table private.retention_policy_rules force row level security;
revoke all on table private.retention_policy_rules from public, anon, authenticated;
comment on table private.retention_policy_rules is
  'P3 category -> purpose -> period -> deletion trigger -> exception -> legal basis schedule rules. No row is seeded by migration.';

-- Authenticated readiness projection. Fail-closed until one active policy
-- covers every active required data class. Execution is never admitted here.
create function public.rpc_get_retention_policy_status()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  u uuid:=auth.uid();
  p private.retention_policy_sets%rowtype;
  active_count integer;
  required_count integer;
  rule_count integer;
  missing jsonb;
  rules jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select count(*) into required_count from private.retention_data_classes d where d.active and d.required;
  select count(*) into active_count from private.retention_policy_sets x where x.retired_at is null and x.effective_at<=statement_timestamp();
  if active_count=0 then
    return jsonb_build_object('ready',false,'reason','RETENTION_POLICY_NOT_PUBLISHED','requiredDataClasses',required_count,'executionAdmitted',false);
  end if;
  if active_count<>1 then
    return jsonb_build_object('ready',false,'reason','RETENTION_POLICY_AMBIGUOUS','requiredDataClasses',required_count,'executionAdmitted',false);
  end if;
  select * into p from private.retention_policy_sets x where x.retired_at is null and x.effective_at<=statement_timestamp() order by x.effective_at desc limit 1;
  select count(*) into rule_count
  from private.retention_policy_rules r join private.retention_data_classes d on d.code=r.data_class
  where r.policy_id=p.id and d.active and d.required;
  select coalesce(jsonb_agg(d.code order by d.code),'[]'::jsonb) into missing
  from private.retention_data_classes d
  where d.active and d.required and not exists(select 1 from private.retention_policy_rules r where r.policy_id=p.id and r.data_class=d.code);
  if rule_count<>required_count then
    return jsonb_build_object('ready',false,'reason','RETENTION_POLICY_INCOMPLETE','policyVersion',p.policy_version,
      'requiredDataClasses',required_count,'coveredDataClasses',rule_count,'missingDataClasses',missing,'executionAdmitted',false);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('dataClass',r.data_class,'purpose',r.purpose,'retentionPeriod',r.retention_period_text,
    'deletionTrigger',r.deletion_trigger,'exceptionRule',r.exception_rule,'legalBasis',r.legal_basis_reference) order by r.data_class),'[]'::jsonb)
  into rules from private.retention_policy_rules r where r.policy_id=p.id;
  return jsonb_build_object('ready',true,'reason',null,'policyVersion',p.policy_version,'effectiveAt',p.effective_at,'counselReference',p.counsel_reference,
    'rules',rules,'requiredDataClasses',required_count,'coveredDataClasses',rule_count,'executionAdmitted',false);
end;
$function$;
revoke all on function public.rpc_get_retention_policy_status() from public, anon, service_role;
grant execute on function public.rpc_get_retention_policy_status() to authenticated;

-- Trusted-server publication of one complete policy version. Atomic: any
-- invalid rule or missing required coverage rolls the whole publication back.
create function public.rpc_publish_retention_policy(
  p_policy_version text,
  p_counsel_reference text,
  p_effective_at timestamptz,
  p_rules jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  p private.retention_policy_sets%rowtype;
  item jsonb;
  data_class_code text;
  required_count integer;
  covered_count integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'TRUSTED_SERVER_REQUIRED' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_policy_version,'')))<1 or char_length(btrim(p_policy_version))>80 then raise exception 'RETENTION_POLICY_VERSION_INVALID' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_counsel_reference,'')))<3 or char_length(btrim(p_counsel_reference))>500 then raise exception 'RETENTION_COUNSEL_REFERENCE_REQUIRED' using errcode='22023'; end if;
  if p_effective_at is null then raise exception 'RETENTION_EFFECTIVE_AT_REQUIRED' using errcode='22023'; end if;
  if p_rules is null or jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules)=0 then raise exception 'RETENTION_RULES_REQUIRED' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('uskoci:retention-policy-publish',0));
  if exists(select 1 from private.retention_policy_sets x where x.retired_at is null) then
    raise exception 'RETENTION_ACTIVE_POLICY_ALREADY_EXISTS' using errcode='55000';
  end if;

  insert into private.retention_policy_sets(policy_version,counsel_reference,effective_at)
  values(btrim(p_policy_version),btrim(p_counsel_reference),p_effective_at) returning * into p;

  for item in select value from jsonb_array_elements(p_rules) loop
    data_class_code:=upper(btrim(coalesce(item->>'dataClass','')));
    if not exists(select 1 from private.retention_data_classes d where d.code=data_class_code and d.active) then
      raise exception 'RETENTION_DATA_CLASS_INVALID' using errcode='22023', detail=data_class_code;
    end if;
    insert into private.retention_policy_rules(policy_id,data_class,purpose,retention_period_text,deletion_trigger,exception_rule,legal_basis_reference)
    values(p.id,data_class_code,btrim(coalesce(item->>'purpose','')),btrim(coalesce(item->>'retentionPeriod','')),
      btrim(coalesce(item->>'deletionTrigger','')),btrim(coalesce(item->>'exceptionRule','')),btrim(coalesce(item->>'legalBasis','')));
  end loop;

  select count(*) into required_count from private.retention_data_classes d where d.active and d.required;
  select count(*) into covered_count
  from private.retention_policy_rules r join private.retention_data_classes d on d.code=r.data_class
  where r.policy_id=p.id and d.active and d.required;
  if covered_count<>required_count then
    raise exception 'RETENTION_POLICY_REQUIRED_COVERAGE_MISSING' using errcode='23514';
  end if;

  perform private.audit_marketplace(null,'RETENTION_POLICY_PUBLISHED','SYSTEM',p.id,null,
    jsonb_build_object('policyVersion',p.policy_version,'requiredDataClasses',required_count,'coveredDataClasses',covered_count));

  return jsonb_build_object('policyId',p.id,'policyVersion',p.policy_version,'requiredDataClasses',required_count,
    'coveredDataClasses',covered_count,'executionAdmitted',false);
end;
$function$;
revoke all on function public.rpc_publish_retention_policy(text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.rpc_publish_retention_policy(text,text,timestamptz,jsonb) to service_role;

comment on function public.rpc_get_retention_policy_status() is
  'P3: authenticated readiness of the trusted retention schedule; fail-closed until one active policy covers every active required data class; execution never admitted here.';
comment on function public.rpc_publish_retention_policy(text,text,timestamptz,jsonb) is
  'P3: trusted-server atomic publication of one complete policy version; refuses a second active policy; audits RETENTION_POLICY_PUBLISHED.';

commit;
