-- USKOČI RU-3 / B07 — canonical admitted Need publish transaction
-- PROOF CANDIDATE / FAIL-CLOSED.
-- This unit seeds no D-0140 policy content, creates no ALLOW decision, and
-- does not modify the B06 service writer that currently rejects ALLOW.
-- A publish can succeed only when an exact current ALLOW decision already
-- exists for the exact current Need fingerprint and reviewed active bundle.

create table if not exists private.need_publish_commands (
  requester_account_id uuid not null references auth.users(id) on delete restrict,
  client_request_id text not null,
  request_hash text not null,

  need_id uuid not null references public.needs(id) on delete restrict,
  expected_revision integer not null,
  decision_id uuid not null
    references private.need_publication_decisions(id) on delete restrict,
  decision_sequence bigint not null
    references private.need_publication_decisions(decision_sequence) on delete restrict,
  canonical_fingerprint text not null,
  policy_bundle_id uuid not null
    references private.publication_policy_bundles(id) on delete restrict,
  response_deadline timestamptz,

  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),

  primary key (requester_account_id, client_request_id),
  constraint need_publish_commands_request_id_length
    check (char_length(btrim(client_request_id)) between 8 and 200),
  constraint need_publish_commands_request_hash_hex
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint need_publish_commands_revision_positive
    check (expected_revision > 0),
  constraint need_publish_commands_sequence_positive
    check (decision_sequence > 0),
  constraint need_publish_commands_fingerprint_hex
    check (canonical_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint need_publish_commands_result_object
    check (jsonb_typeof(result) = 'object')
);

create index if not exists need_publish_commands_need_idx
  on private.need_publish_commands(need_id, expected_revision, created_at desc);

alter table private.need_publish_commands enable row level security;
alter table private.need_publish_commands force row level security;
revoke all on table private.need_publish_commands
  from public, anon, authenticated, service_role;

create or replace function public.rpc_publish_need_canonical(
  p_need_id uuid,
  p_expected_revision integer,
  p_decision_sequence bigint,
  p_response_deadline timestamptz,
  p_client_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id, ''));
  v_request_payload jsonb;
  v_request_hash text;
  v_existing private.need_publish_commands%rowtype;
  v_need public.needs%rowtype;
  v_decision private.need_publication_decisions%rowtype;
  v_bundle private.publication_policy_bundles%rowtype;
  v_fp jsonb;
  v_public_media text[];
  v_rule_count integer;
  v_rule_snapshot jsonb;
  v_result jsonb;
  v_now timestamptz := statement_timestamp();
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_need_id is null or p_expected_revision is null or p_decision_sequence is null then
    raise exception 'PUBLISH_ID_REVISION_DECISION_REQUIRED' using errcode='22004';
  end if;
  if p_expected_revision <= 0 or p_decision_sequence <= 0 then
    raise exception 'PUBLISH_REVISION_DECISION_INVALID' using errcode='22023';
  end if;
  if char_length(v_request_id) < 8 or char_length(v_request_id) > 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;
  if p_response_deadline is not null and p_response_deadline <= v_now then
    raise exception 'RESPONSE_DEADLINE_INVALID' using errcode='22023';
  end if;

  v_request_payload := jsonb_build_object(
    'needId', p_need_id,
    'expectedRevision', p_expected_revision,
    'decisionSequence', p_decision_sequence,
    'responseDeadline', p_response_deadline
  );
  v_request_hash := encode(
    extensions.digest(convert_to(v_request_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor::text || E'\n' || v_request_id, 0)
  );

  select * into v_existing
    from private.need_publish_commands c
   where c.requester_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_need
    from public.needs n
   where n.id = p_need_id
   for update;
  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode='P0002';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception 'NEED_NOT_OWNED' using errcode='42501';
  end if;
  if v_need.status <> 'DRAFT' then
    raise exception 'NEED_NOT_DRAFT' using errcode='P0001';
  end if;
  if v_need.revision <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='40001';
  end if;

  v_fp := private.need_publication_fingerprint_snapshot(p_need_id);
  if (v_fp->>'needRevision')::integer <> p_expected_revision then
    raise exception 'NEED_REVISION_STALE' using errcode='40001';
  end if;
  v_public_media := array(
    select jsonb_array_elements_text(v_fp->'publicMediaRefs')
  );

  select * into v_decision
    from private.need_publication_decisions d
   where d.decision_sequence = p_decision_sequence;
  if not found then
    raise exception 'PUBLICATION_DECISION_NOT_FOUND' using errcode='P0002';
  end if;
  if v_decision.need_id <> p_need_id
     or v_decision.need_revision <> p_expected_revision then
    raise exception 'PUBLICATION_DECISION_SCOPE_MISMATCH' using errcode='P0001';
  end if;
  if v_decision.canonical_fingerprint <> v_fp->>'canonicalFingerprint'
     or v_decision.private_materiality_marker <> v_fp->>'privateMaterialityMarker'
     or v_decision.public_geography_snapshot is distinct from v_fp->'publicGeography'
     or v_decision.public_media_refs is distinct from v_public_media then
    raise exception 'PUBLICATION_DECISION_FINGERPRINT_STALE' using errcode='P0001';
  end if;

  if exists (
    select 1
      from private.need_publication_decisions newer
     where newer.need_id = p_need_id
       and newer.need_revision = p_expected_revision
       and newer.decision_sequence > v_decision.decision_sequence
  ) then
    raise exception 'PUBLICATION_DECISION_STALE' using errcode='P0001';
  end if;

  if v_decision.outcome <> 'ALLOW' then
    raise exception 'PUBLICATION_DECISION_NOT_ALLOW' using errcode='P0001';
  end if;

  if not private.publication_policy_bundle_ready(
       v_decision.policy_bundle_id,
       v_decision.jurisdiction,
       v_now
     ) then
    raise exception 'POLICY_BUNDLE_NOT_READY' using errcode='P0001';
  end if;

  if private.current_publication_policy_bundle(
       v_decision.policy_id,
       v_decision.jurisdiction,
       v_now
     ) is distinct from v_decision.policy_bundle_id then
    raise exception 'PUBLICATION_POLICY_STALE' using errcode='P0001';
  end if;

  select * into v_bundle
    from private.publication_policy_bundles b
   where b.id = v_decision.policy_bundle_id;
  if not found
     or v_bundle.policy_id <> v_decision.policy_id
     or v_bundle.version <> v_decision.policy_version
     or v_bundle.jurisdiction <> v_decision.jurisdiction then
    raise exception 'PUBLICATION_POLICY_PROVENANCE_MISMATCH' using errcode='P0001';
  end if;

  select count(*)::integer,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'ruleId', r.rule_id,
               'provenance', r.rule_provenance
             ) order by r.rule_id
           ),
           '[]'::jsonb
         )
    into v_rule_count, v_rule_snapshot
    from private.publication_policy_rule_refs r
   where r.bundle_id = v_decision.policy_bundle_id
     and r.rule_id = any(v_decision.rule_ids);

  if v_rule_count <> cardinality(v_decision.rule_ids)
     or v_rule_snapshot is distinct from v_decision.rule_provenance_snapshot then
    raise exception 'PUBLICATION_POLICY_RULE_PROVENANCE_STALE' using errcode='P0001';
  end if;

  perform set_config('uskoci.need_lifecycle', 'PUBLISH', true);
  update public.needs n
     set status = 'PUBLISHED',
         published_at = v_now,
         response_deadline = p_response_deadline
   where n.id = p_need_id
     and n.status = 'DRAFT'
     and n.revision = p_expected_revision
  returning n.* into v_need;
  perform set_config('uskoci.need_lifecycle', '', true);

  if not found then
    raise exception 'NEED_PUBLISH_CONFLICT' using errcode='40001';
  end if;

  if not exists (
    select 1 from private.dispatch_schedule s where s.need_id = p_need_id
  ) then
    raise exception 'DISPATCH_SCHEDULE_MISSING' using errcode='P0001';
  end if;

  v_result := jsonb_build_object(
    'needId', v_need.id,
    'status', v_need.status,
    'publishedAt', v_need.published_at,
    'responseDeadline', v_need.response_deadline,
    'idempotentReplay', false
  );

  insert into private.need_publish_commands(
    requester_account_id,
    client_request_id,
    request_hash,
    need_id,
    expected_revision,
    decision_id,
    decision_sequence,
    canonical_fingerprint,
    policy_bundle_id,
    response_deadline,
    result
  ) values (
    v_actor,
    v_request_id,
    v_request_hash,
    p_need_id,
    p_expected_revision,
    v_decision.id,
    v_decision.decision_sequence,
    v_decision.canonical_fingerprint,
    v_decision.policy_bundle_id,
    p_response_deadline,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.rpc_publish_need_canonical(
  uuid,integer,bigint,timestamptz,text
) from public, anon, authenticated, service_role;
grant execute on function public.rpc_publish_need_canonical(
  uuid,integer,bigint,timestamptz,text
) to authenticated;

comment on table private.need_publish_commands is
  'RU-3 B07 server-owned semantic idempotency receipts for canonical admitted Need publish. No direct client/service table access.';
comment on function public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text) is
  'USER_COMMAND RU-3 B07. Owner-only DRAFT->PUBLISHED transaction requiring exact latest ALLOW decision, exact current reviewed active policy bundle/fingerprint/rule provenance, and atomic dispatch schedule.';

do $ru3_b07_postconditions$
begin
  if exists (select 1 from private.need_publish_commands) then
    raise exception 'RU3_B07_POSTCONDITION_FAILED: migration seeded publish command rows';
  end if;

  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='private'
       and c.relname='need_publish_commands'
       and c.relrowsecurity
  ) then
    raise exception 'RU3_B07_POSTCONDITION_FAILED: command receipt RLS missing';
  end if;

  if has_table_privilege('anon','private.need_publish_commands','SELECT')
     or has_table_privilege('authenticated','private.need_publish_commands','SELECT')
     or has_table_privilege('service_role','private.need_publish_commands','SELECT')
     or has_table_privilege('anon','private.need_publish_commands','INSERT')
     or has_table_privilege('authenticated','private.need_publish_commands','INSERT')
     or has_table_privilege('service_role','private.need_publish_commands','INSERT')
     or has_table_privilege('authenticated','private.need_publish_commands','UPDATE')
     or has_table_privilege('authenticated','private.need_publish_commands','DELETE') then
    raise exception 'RU3_B07_POSTCONDITION_FAILED: command receipt table exposed';
  end if;

  if has_function_privilege(
       'anon',
       'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamp with time zone,text)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B07_POSTCONDITION_FAILED: canonical publish grants wrong';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.rpc_publish_need(uuid,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception 'RU3_B07_POSTCONDITION_FAILED: legacy publish reopened';
  end if;

  if position(
       'PACKAGE_4_NOT_READY'
       in pg_get_functiondef('public.rpc_ai_publish_need(uuid,uuid)'::regprocedure)
     ) = 0 then
    raise exception 'RU3_B07_POSTCONDITION_FAILED: legacy AI publish not fail closed';
  end if;

  if position(
       'RU3_ALLOW_NOT_ENABLED'
       in pg_get_functiondef(
         'public.rpc_record_need_publication_decision_service(uuid,integer,text,text,text,text[],text,text[],text,text,jsonb,jsonb)'::regprocedure
       )
     ) = 0 then
    raise exception 'RU3_B07_POSTCONDITION_FAILED: B06 ALLOW writer gate changed';
  end if;
end
$ru3_b07_postconditions$;
