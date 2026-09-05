-- USKOCI RU-4B — public preselection Q&A foundation.
-- Structural/fail-closed candidate only. It seeds no production PRESELECTION_QA ALLOW policy,
-- no numeric rate policy and no account-block authority.

create table if not exists private.preselection_qa_questions (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete restrict,
  need_revision integer not null check (need_revision > 0),
  asker_account_id uuid not null,
  question_text text not null check (btrim(question_text) <> ''),
  question_fingerprint text not null check (question_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'PENDING_ANSWER'
    check (status in ('PENDING_ANSWER','ANSWERED_PUBLIC','IGNORED','REPORTED')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  answered_at timestamptz,
  ignored_at timestamptz,
  reported_at timestamptz
);

create index if not exists preselection_qa_questions_need_revision_idx
  on private.preselection_qa_questions(need_id, need_revision, created_at, id);
create index if not exists preselection_qa_questions_asker_idx
  on private.preselection_qa_questions(asker_account_id, created_at, id);

create table if not exists private.preselection_qa_answer_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references private.preselection_qa_questions(id) on delete restrict,
  answer_version integer not null check (answer_version > 0),
  answer_text text not null check (btrim(answer_text) <> ''),
  answer_fingerprint text not null check (answer_fingerprint ~ '^[0-9a-f]{64}$'),
  answered_by_account_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique(question_id, answer_version)
);

create table if not exists private.preselection_qa_policy_decisions (
  id uuid primary key default gen_random_uuid(),
  subject_kind text not null check (subject_kind in ('QUESTION','ANSWER')),
  need_id uuid not null references public.needs(id) on delete restrict,
  need_revision integer not null check (need_revision > 0),
  question_id uuid references private.preselection_qa_questions(id) on delete restrict,
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  policy_bundle_id uuid not null references private.publication_policy_bundles(id) on delete restrict,
  policy_id text not null check (btrim(policy_id) <> ''),
  policy_version integer not null check (policy_version > 0),
  jurisdiction text not null check (btrim(jurisdiction) <> ''),
  rule_ids text[] not null check (cardinality(rule_ids) > 0),
  rule_provenance_snapshot jsonb not null check (jsonb_typeof(rule_provenance_snapshot) = 'array'),
  outcome text not null check (outcome in ('ALLOW','CLARIFY','REVIEW','BLOCK')),
  safe_reason_codes text[] not null default '{}'::text[],
  decision_source text not null check (btrim(decision_source) <> ''),
  service_provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(service_provenance) = 'object'),
  decision_identity text not null unique check (decision_identity ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists preselection_qa_policy_lookup_idx
  on private.preselection_qa_policy_decisions(subject_kind, need_id, need_revision, question_id, content_fingerprint, created_at desc);

create table if not exists private.preselection_qa_materiality_decisions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references private.preselection_qa_questions(id) on delete restrict,
  need_id uuid not null references public.needs(id) on delete restrict,
  need_revision integer not null check (need_revision > 0),
  answer_fingerprint text not null check (answer_fingerprint ~ '^[0-9a-f]{64}$'),
  materiality text not null check (materiality in ('NON_MATERIAL','MATERIAL')),
  decision_source text not null check (btrim(decision_source) <> ''),
  service_provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(service_provenance) = 'object'),
  decision_identity text not null unique check (decision_identity ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists preselection_qa_materiality_lookup_idx
  on private.preselection_qa_materiality_decisions(question_id, need_id, need_revision, answer_fingerprint, created_at desc);

create table if not exists private.preselection_qa_commands (
  actor_account_id uuid not null,
  request_id uuid not null,
  command_type text not null,
  semantic_hash text not null check (semantic_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  primary key(actor_account_id, request_id)
);

revoke all on table private.preselection_qa_questions from public, anon, authenticated;
revoke all on table private.preselection_qa_answer_versions from public, anon, authenticated;
revoke all on table private.preselection_qa_policy_decisions from public, anon, authenticated;
revoke all on table private.preselection_qa_materiality_decisions from public, anon, authenticated;
revoke all on table private.preselection_qa_commands from public, anon, authenticated;

create or replace function private.ru4b_content_fingerprint(
  p_subject_kind text,
  p_need_id uuid,
  p_need_revision integer,
  p_question_id uuid,
  p_text text
) returns text
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'schema','PRESELECTION_QA_CONTENT_V1',
          'subjectKind',p_subject_kind,
          'needId',p_need_id,
          'needRevision',p_need_revision,
          'questionId',p_question_id,
          'text',btrim(p_text)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function private.ru4b_public_floor_reason(p_text text)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog'
as $$
declare
  v text := btrim(coalesce(p_text,''));
begin
  if v = '' then return 'EMPTY_CONTENT'; end if;
  if v ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}' then return 'EMAIL_NOT_PUBLIC'; end if;
  if v ~* '(https?://|www\.)' then return 'OFF_PLATFORM_LINK_NOT_PUBLIC'; end if;
  if v ~* '(^|[[:space:]])@[A-Z0-9_.]{2,}' then return 'SOCIAL_HANDLE_NOT_PUBLIC'; end if;
  if v ~ '(\+?[0-9][0-9 ()/.\-]{6,}[0-9])' then return 'PHONE_NOT_PUBLIC'; end if;
  return null;
end;
$$;

-- Deliberately fail closed until the separately governed block subsystem exists.
create or replace function private.ru4b_assert_block_authority_ready(
  p_worker_account_id uuid,
  p_requester_account_id uuid
) returns void
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
begin
  raise exception 'RU4B_BLOCK_AUTHORITY_NOT_READY' using errcode='P0001';
end;
$$;

-- Deliberately fail closed until an owner/policy-approved numeric rate policy exists.
create or replace function private.ru4b_assert_rate_authority_ready(p_actor_account_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
begin
  raise exception 'RU4B_RATE_POLICY_NOT_READY' using errcode='P0001';
end;
$$;

revoke all on function private.ru4b_content_fingerprint(text,uuid,integer,uuid,text) from public, anon, authenticated;
revoke all on function private.ru4b_public_floor_reason(text) from public, anon, authenticated;
revoke all on function private.ru4b_assert_block_authority_ready(uuid,uuid) from public, anon, authenticated;
revoke all on function private.ru4b_assert_rate_authority_ready(uuid) from public, anon, authenticated;

create or replace function private.ru4b_has_exact_policy_allow(
  p_subject_kind text,
  p_need_id uuid,
  p_need_revision integer,
  p_question_id uuid,
  p_content_fingerprint text
) returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
  select exists(
    select 1
    from private.preselection_qa_policy_decisions d
    join private.publication_policy_bundles b on b.id=d.policy_bundle_id
    where d.subject_kind=p_subject_kind
      and d.need_id=p_need_id
      and d.need_revision=p_need_revision
      and d.question_id is not distinct from p_question_id
      and d.content_fingerprint=p_content_fingerprint
      and d.outcome='ALLOW'
      and b.policy_id=d.policy_id
      and b.version=d.policy_version
      and b.jurisdiction=d.jurisdiction
      and b.is_reviewed=true
      and b.is_complete=true
      and b.is_active=true
      and (b.effective_from is null or b.effective_from <= statement_timestamp())
      and (b.effective_until is null or b.effective_until > statement_timestamp())
      and not exists(
        select 1 from unnest(d.rule_ids) rid
        where not exists(
          select 1 from private.publication_policy_rule_refs r
          where r.bundle_id=b.id and r.rule_id=rid
        )
      )
  )
$$;

create or replace function private.ru4b_exact_materiality(
  p_question_id uuid,
  p_need_id uuid,
  p_need_revision integer,
  p_answer_fingerprint text
) returns text
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
  select d.materiality
  from private.preselection_qa_materiality_decisions d
  where d.question_id=p_question_id
    and d.need_id=p_need_id
    and d.need_revision=p_need_revision
    and d.answer_fingerprint=p_answer_fingerprint
  order by d.created_at desc, d.id desc
  limit 1
$$;

revoke all on function private.ru4b_has_exact_policy_allow(text,uuid,integer,uuid,text) from public, anon, authenticated;
revoke all on function private.ru4b_exact_materiality(uuid,uuid,integer,text) from public, anon, authenticated;

-- Future trusted service writer. Production ALLOW stays intentionally disabled.
create or replace function private.rpc_ru4b_record_policy_decision_service(
  p_subject_kind text,
  p_need_id uuid,
  p_need_revision integer,
  p_question_id uuid,
  p_content_fingerprint text,
  p_policy_bundle_id uuid,
  p_outcome text,
  p_safe_reason_codes text[],
  p_decision_source text,
  p_service_provenance jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_bundle private.publication_policy_bundles%rowtype;
  v_rules text[];
  v_identity text;
  v_id uuid;
begin
  if p_subject_kind not in ('QUESTION','ANSWER') then raise exception 'RU4B_POLICY_SUBJECT_INVALID' using errcode='P0001'; end if;
  if p_outcome not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then raise exception 'RU4B_POLICY_OUTCOME_INVALID' using errcode='P0001'; end if;
  if p_outcome='ALLOW' then raise exception 'RU4B_ALLOW_NOT_ENABLED' using errcode='P0001'; end if;
  select * into v_bundle from private.publication_policy_bundles where id=p_policy_bundle_id;
  if not found or not v_bundle.is_reviewed or not v_bundle.is_complete or not v_bundle.is_active then
    raise exception 'RU4B_POLICY_BUNDLE_NOT_READY' using errcode='P0001';
  end if;
  if v_bundle.effective_from is not null and v_bundle.effective_from > statement_timestamp() then raise exception 'RU4B_POLICY_BUNDLE_NOT_CURRENT' using errcode='P0001'; end if;
  if v_bundle.effective_until is not null and v_bundle.effective_until <= statement_timestamp() then raise exception 'RU4B_POLICY_BUNDLE_NOT_CURRENT' using errcode='P0001'; end if;
  select array_agg(rule_id order by rule_id) into v_rules from private.publication_policy_rule_refs where bundle_id=v_bundle.id;
  if coalesce(cardinality(v_rules),0)=0 then raise exception 'RU4B_POLICY_RULES_MISSING' using errcode='P0001'; end if;
  v_identity:=encode(extensions.digest(convert_to(jsonb_build_object(
    'subjectKind',p_subject_kind,'needId',p_need_id,'needRevision',p_need_revision,
    'questionId',p_question_id,'contentFingerprint',p_content_fingerprint,
    'policyBundleId',p_policy_bundle_id,'outcome',p_outcome,'source',p_decision_source
  )::text,'UTF8'),'sha256'),'hex');
  select id into v_id from private.preselection_qa_policy_decisions where decision_identity=v_identity;
  if found then return v_id; end if;
  insert into private.preselection_qa_policy_decisions(
    subject_kind,need_id,need_revision,question_id,content_fingerprint,
    policy_bundle_id,policy_id,policy_version,jurisdiction,rule_ids,rule_provenance_snapshot,
    outcome,safe_reason_codes,decision_source,service_provenance,decision_identity
  ) values (
    p_subject_kind,p_need_id,p_need_revision,p_question_id,p_content_fingerprint,
    v_bundle.id,v_bundle.policy_id,v_bundle.version,v_bundle.jurisdiction,v_rules,
    (select jsonb_agg(jsonb_build_object('ruleId',r.rule_id,'provenance',r.rule_provenance) order by r.rule_id) from private.publication_policy_rule_refs r where r.bundle_id=v_bundle.id),
    p_outcome,coalesce(p_safe_reason_codes,'{}'::text[]),p_decision_source,coalesce(p_service_provenance,'{}'::jsonb),v_identity
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.rpc_ru4b_record_materiality_decision_service(
  p_question_id uuid,
  p_need_id uuid,
  p_need_revision integer,
  p_answer_fingerprint text,
  p_materiality text,
  p_decision_source text,
  p_service_provenance jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare v_identity text; v_id uuid;
begin
  if p_materiality not in ('NON_MATERIAL','MATERIAL') then raise exception 'RU4B_MATERIALITY_INVALID' using errcode='P0001'; end if;
  v_identity:=encode(extensions.digest(convert_to(jsonb_build_object(
    'questionId',p_question_id,'needId',p_need_id,'needRevision',p_need_revision,
    'answerFingerprint',p_answer_fingerprint,'materiality',p_materiality,'source',p_decision_source
  )::text,'UTF8'),'sha256'),'hex');
  select id into v_id from private.preselection_qa_materiality_decisions where decision_identity=v_identity;
  if found then return v_id; end if;
  insert into private.preselection_qa_materiality_decisions(
    question_id,need_id,need_revision,answer_fingerprint,materiality,decision_source,service_provenance,decision_identity
  ) values (p_question_id,p_need_id,p_need_revision,p_answer_fingerprint,p_materiality,p_decision_source,coalesce(p_service_provenance,'{}'::jsonb),v_identity)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.rpc_ru4b_record_policy_decision_service(text,uuid,integer,uuid,text,uuid,text,text[],text,jsonb) from public, anon, authenticated;
revoke all on function private.rpc_ru4b_record_materiality_decision_service(uuid,uuid,integer,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function private.rpc_ru4b_record_policy_decision_service(text,uuid,integer,uuid,text,uuid,text,text[],text,jsonb) to service_role;
grant execute on function private.rpc_ru4b_record_materiality_decision_service(uuid,uuid,integer,text,text,text,jsonb) to service_role;

create or replace function public.rpc_ru4b_ask_preselection_question(
  p_need_id uuid,
  p_expected_revision integer,
  p_question_text text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_uid uuid:=auth.uid();
  v_need public.needs%rowtype;
  v_text text:=btrim(coalesce(p_question_text,''));
  v_floor text;
  v_fp text;
  v_semantic text;
  v_existing private.preselection_qa_commands%rowtype;
  v_question_id uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='P0001'; end if;
  if v_text='' then raise exception 'QUESTION_REQUIRED' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || E'\n' || p_request_id::text,4412));
  v_semantic:=encode(extensions.digest(convert_to(jsonb_build_object(
    'command','RU4B_ASK','needId',p_need_id,'expectedRevision',p_expected_revision,'question',v_text
  )::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from private.preselection_qa_commands where actor_account_id=v_uid and request_id=p_request_id;
  if found then
    if v_existing.command_type<>'ASK' or v_existing.semantic_hash<>v_semantic then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='P0001'; end if;
    return v_existing.result || jsonb_build_object('idempotentReplay',true);
  end if;
  select * into v_need from public.needs where id=p_need_id for share;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0001'; end if;
  if v_need.revision<>p_expected_revision then raise exception 'STALE_NEED_REVISION' using errcode='P0001'; end if;
  if v_need.status not in ('PUBLISHED','ACTIVE') then raise exception 'NEED_NOT_PUBLIC' using errcode='P0001'; end if;
  if v_need.requester_account_id=v_uid then raise exception 'REQUESTER_CANNOT_ASK_OWN_TASK' using errcode='P0001'; end if;
  if not exists(select 1 from public.app_profiles p where p.account_id=v_uid and p.kind='WORKER' and p.profile_status='ACTIVE') then
    raise exception 'ACTIVE_WORKER_REQUIRED' using errcode='P0001';
  end if;
  perform private.ru4b_assert_block_authority_ready(v_uid,v_need.requester_account_id);
  perform private.ru4b_assert_rate_authority_ready(v_uid);
  v_floor:=private.ru4b_public_floor_reason(v_text);
  if v_floor is not null then raise exception '%',v_floor using errcode='P0001'; end if;
  v_fp:=private.ru4b_content_fingerprint('QUESTION',p_need_id,p_expected_revision,null,v_text);
  if not private.ru4b_has_exact_policy_allow('QUESTION',p_need_id,p_expected_revision,null,v_fp) then
    raise exception 'PRESELECTION_QA_POLICY_NOT_READY' using errcode='P0001';
  end if;
  insert into private.preselection_qa_questions(need_id,need_revision,asker_account_id,question_text,question_fingerprint)
  values(p_need_id,p_expected_revision,v_uid,v_text,v_fp) returning id into v_question_id;
  perform private.emit_event(
    v_need.requester_account_id,'REQUESTER','CLARIFICATION_CREATED','CLARIFICATION',v_question_id,1,
    'Novo pitanje o Zadatku','Uskočer je postavio anonimno pitanje o Zadatku.',
    'ru4b:clarification:'||v_question_id::text||':created','NORMAL',
    jsonb_build_object('needId',p_need_id,'needRevision',p_expected_revision,'questionId',v_question_id),null
  );
  v_result:=jsonb_build_object('ok',true,'questionId',v_question_id,'status','PENDING_ANSWER','needRevision',p_expected_revision,'idempotentReplay',false);
  insert into private.preselection_qa_commands(actor_account_id,request_id,command_type,semantic_hash,result)
  values(v_uid,p_request_id,'ASK',v_semantic,v_result);
  return v_result;
end;
$$;

create or replace function public.rpc_ru4b_answer_preselection_question(
  p_question_id uuid,
  p_answer_text text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_uid uuid:=auth.uid();
  v_q private.preselection_qa_questions%rowtype;
  v_need public.needs%rowtype;
  v_text text:=btrim(coalesce(p_answer_text,''));
  v_floor text;
  v_fp text;
  v_materiality text;
  v_semantic text;
  v_existing private.preselection_qa_commands%rowtype;
  v_version integer;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='P0001'; end if;
  if v_text='' then raise exception 'ANSWER_REQUIRED' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || E'\n' || p_request_id::text,4413));
  v_semantic:=encode(extensions.digest(convert_to(jsonb_build_object(
    'command','RU4B_ANSWER','questionId',p_question_id,'answer',v_text
  )::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from private.preselection_qa_commands where actor_account_id=v_uid and request_id=p_request_id;
  if found then
    if v_existing.command_type<>'ANSWER' or v_existing.semantic_hash<>v_semantic then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='P0001'; end if;
    return v_existing.result || jsonb_build_object('idempotentReplay',true);
  end if;
  select * into v_q from private.preselection_qa_questions where id=p_question_id for update;
  if not found then raise exception 'QUESTION_NOT_FOUND' using errcode='P0001'; end if;
  if v_q.status in ('IGNORED','REPORTED') then raise exception 'QUESTION_NOT_ANSWERABLE' using errcode='P0001'; end if;
  select * into v_need from public.needs where id=v_q.need_id for share;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0001'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NOT_NEED_OWNER' using errcode='P0001'; end if;
  if v_need.revision<>v_q.need_revision then raise exception 'QUESTION_STALE_AFTER_NEED_REVISION' using errcode='P0001'; end if;
  if v_need.status not in ('PUBLISHED','ACTIVE') then raise exception 'NEED_NOT_PUBLIC' using errcode='P0001'; end if;
  perform private.ru4b_assert_block_authority_ready(v_q.asker_account_id,v_uid);
  v_floor:=private.ru4b_public_floor_reason(v_text);
  if v_floor is not null then raise exception '%',v_floor using errcode='P0001'; end if;
  v_fp:=private.ru4b_content_fingerprint('ANSWER',v_q.need_id,v_q.need_revision,v_q.id,v_text);
  v_materiality:=private.ru4b_exact_materiality(v_q.id,v_q.need_id,v_q.need_revision,v_fp);
  if v_materiality is null then raise exception 'RU4B_MATERIALITY_NOT_READY' using errcode='P0001'; end if;
  if v_materiality='MATERIAL' then raise exception 'RU4B_MATERIAL_REQUIRES_RU4_EDIT' using errcode='P0001'; end if;
  if not private.ru4b_has_exact_policy_allow('ANSWER',v_q.need_id,v_q.need_revision,v_q.id,v_fp) then
    raise exception 'PRESELECTION_QA_POLICY_NOT_READY' using errcode='P0001';
  end if;
  select coalesce(max(answer_version),0)+1 into v_version from private.preselection_qa_answer_versions where question_id=v_q.id;
  insert into private.preselection_qa_answer_versions(question_id,answer_version,answer_text,answer_fingerprint,answered_by_account_id)
  values(v_q.id,v_version,v_text,v_fp,v_uid);
  update private.preselection_qa_questions
    set status='ANSWERED_PUBLIC',answered_at=statement_timestamp(),updated_at=statement_timestamp()
    where id=v_q.id;
  perform private.emit_event(
    v_q.asker_account_id,'WORKER','CLARIFICATION_ANSWERED','CLARIFICATION',v_q.id,v_version,
    'Odgovor na pitanje','Naručilac je odgovorio na Vaše pitanje.',
    'ru4b:clarification:'||v_q.id::text||':answer:'||v_version::text,'NORMAL',
    jsonb_build_object('needId',v_q.need_id,'needRevision',v_q.need_revision,'questionId',v_q.id,'answerVersion',v_version),null
  );
  v_result:=jsonb_build_object('ok',true,'questionId',v_q.id,'status','ANSWERED_PUBLIC','answerVersion',v_version,'edited',v_version>1,'idempotentReplay',false);
  insert into private.preselection_qa_commands(actor_account_id,request_id,command_type,semantic_hash,result)
  values(v_uid,p_request_id,'ANSWER',v_semantic,v_result);
  return v_result;
end;
$$;

create or replace function public.rpc_ru4b_disposition_preselection_question(
  p_question_id uuid,
  p_action text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_uid uuid:=auth.uid(); v_q private.preselection_qa_questions%rowtype; v_need public.needs%rowtype;
  v_semantic text; v_existing private.preselection_qa_commands%rowtype; v_status text; v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  if p_action not in ('IGNORE','REPORT') then raise exception 'RU4B_DISPOSITION_INVALID' using errcode='P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || E'\n' || p_request_id::text,4414));
  v_semantic:=encode(extensions.digest(convert_to(jsonb_build_object('command','RU4B_DISPOSITION','questionId',p_question_id,'action',p_action)::text,'UTF8'),'sha256'),'hex');
  select * into v_existing from private.preselection_qa_commands where actor_account_id=v_uid and request_id=p_request_id;
  if found then
    if v_existing.command_type<>'DISPOSITION' or v_existing.semantic_hash<>v_semantic then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='P0001'; end if;
    return v_existing.result || jsonb_build_object('idempotentReplay',true);
  end if;
  select * into v_q from private.preselection_qa_questions where id=p_question_id for update;
  if not found then raise exception 'QUESTION_NOT_FOUND' using errcode='P0001'; end if;
  select * into v_need from public.needs where id=v_q.need_id;
  if v_need.requester_account_id<>v_uid then raise exception 'NOT_NEED_OWNER' using errcode='P0001'; end if;
  if v_q.status<>'PENDING_ANSWER' then raise exception 'QUESTION_NOT_PENDING' using errcode='P0001'; end if;
  v_status:=case when p_action='IGNORE' then 'IGNORED' else 'REPORTED' end;
  update private.preselection_qa_questions set status=v_status,updated_at=statement_timestamp(),
    ignored_at=case when p_action='IGNORE' then statement_timestamp() else ignored_at end,
    reported_at=case when p_action='REPORT' then statement_timestamp() else reported_at end
    where id=v_q.id;
  v_result:=jsonb_build_object('ok',true,'questionId',v_q.id,'status',v_status,'idempotentReplay',false);
  insert into private.preselection_qa_commands(actor_account_id,request_id,command_type,semantic_hash,result)
  values(v_uid,p_request_id,'DISPOSITION',v_semantic,v_result);
  return v_result;
end;
$$;

create or replace function public.rpc_ru4b_owner_preselection_questions(p_need_id uuid)
returns table(question_id uuid, need_revision integer, question_text text, status text, created_at timestamptz, answer_version integer, answer_text text, edited boolean)
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
  select q.id,q.need_revision,q.question_text,q.status,q.created_at,
         a.answer_version,a.answer_text,coalesce(a.answer_version>1,false)
  from private.preselection_qa_questions q
  join public.needs n on n.id=q.need_id
  left join lateral (
    select av.answer_version,av.answer_text from private.preselection_qa_answer_versions av
    where av.question_id=q.id order by av.answer_version desc limit 1
  ) a on true
  where q.need_id=p_need_id and n.requester_account_id=auth.uid()
  order by q.created_at desc,q.id desc
$$;

create or replace function public.rpc_ru4b_public_preselection_qa(p_need_id uuid)
returns table(question_id uuid, need_revision integer, question_text text, answer_version integer, answer_text text, edited boolean, answered_at timestamptz)
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
  select q.id,q.need_revision,q.question_text,a.answer_version,a.answer_text,(a.answer_version>1),q.answered_at
  from private.preselection_qa_questions q
  join public.needs n on n.id=q.need_id and n.revision=q.need_revision and n.status in ('PUBLISHED','ACTIVE')
  join lateral (
    select av.answer_version,av.answer_text from private.preselection_qa_answer_versions av
    where av.question_id=q.id order by av.answer_version desc limit 1
  ) a on true
  where q.need_id=p_need_id and q.status='ANSWERED_PUBLIC'
  order by q.answered_at,q.id
$$;

revoke all on function public.rpc_ru4b_ask_preselection_question(uuid,integer,text,uuid) from public, anon;
revoke all on function public.rpc_ru4b_answer_preselection_question(uuid,text,uuid) from public, anon;
revoke all on function public.rpc_ru4b_disposition_preselection_question(uuid,text,uuid) from public, anon;
revoke all on function public.rpc_ru4b_owner_preselection_questions(uuid) from public, anon;
revoke all on function public.rpc_ru4b_public_preselection_qa(uuid) from public, anon;
grant execute on function public.rpc_ru4b_ask_preselection_question(uuid,integer,text,uuid) to authenticated;
grant execute on function public.rpc_ru4b_answer_preselection_question(uuid,text,uuid) to authenticated;
grant execute on function public.rpc_ru4b_disposition_preselection_question(uuid,text,uuid) to authenticated;
grant execute on function public.rpc_ru4b_owner_preselection_questions(uuid) to authenticated;
grant execute on function public.rpc_ru4b_public_preselection_qa(uuid) to authenticated;

comment on table private.preselection_qa_questions is 'RU-4B private clarification owner. Asker identity never appears in public/requester projections.';
comment on table private.preselection_qa_answer_versions is 'RU-4B immutable answer history; latest version is projected with edited marker.';
comment on function public.rpc_ru4b_ask_preselection_question(uuid,integer,text,uuid) is 'RU-4B fail-closed authenticated command. Production public question creation cannot pass until block/rate authority and exact PRESELECTION_QA ALLOW policy exist.';
comment on function public.rpc_ru4b_answer_preselection_question(uuid,text,uuid) is 'RU-4B owner-only answer command. Exact NON_MATERIAL authority + exact policy ALLOW required; MATERIAL answer must go through RU-4 edit/readmission.';
