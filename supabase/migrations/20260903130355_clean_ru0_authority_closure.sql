-- RU-0 Authority Closure.
--
-- Forward-only from the physically verified CLEAN predecessor:
--   56 migrations / 20260901114029_clean_ai_fact_supersession_and_human_correction
--
-- Data preservation: this migration performs no business-row INSERT, UPDATE,
-- or DELETE. Exact row counts for every affected business table are captured
-- after write serialization and verified before commit.
--
-- Concurrency/failure behavior: affected tables are write-serialized and all
-- DDL/grants/policies/function replacements are one transaction. Any failed
-- predecessor or postcondition assertion rolls the whole migration back.
--
-- Rollback policy: no destructive down migration is supplied. A failed apply
-- is transactionally residue-free; a successful production apply is reversed,
-- if ever required, only by a separately reviewed forward migration.

begin;

do $ru0_predecessor$
declare
  v_count integer;
  v_head text;
begin
  select count(*), max(version)
    into v_count, v_head
    from supabase_migrations.schema_migrations;

  if v_count <> 56
     or v_head <> '20260901114029' then
    raise exception using
      errcode = '55000',
      message = format(
        'RU0_PREDECESSOR_MISMATCH: expected 56/20260901114029, got %s/%s',
        v_count,
        coalesce(v_head, '<null>')
      );
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef) <> 35
     or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'private' and p.prosecdef) <> 23 then
    raise exception 'RU0_PREDECESSOR_MISMATCH: SECURITY DEFINER inventory drift';
  end if;

  if not exists (
       select 1 from pg_policies
        where schemaname = 'public' and tablename = 'ai_conversations'
          and policyname = 'ai_conversations_own' and cmd = 'ALL'
     )
     or not exists (
       select 1 from pg_policies
        where schemaname = 'public' and tablename = 'ai_action_proposals'
          and policyname = 'ai_proposals_own' and cmd = 'ALL'
     )
     or not exists (
       select 1 from pg_policies
        where schemaname = 'public' and tablename = 'notification_deliveries'
          and policyname = 'deliveries_mark_read' and cmd = 'UPDATE'
     ) then
    raise exception 'RU0_PREDECESSOR_MISMATCH: expected broad mutation policy is absent';
  end if;

  if not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'rpc_ai_propose_fact'
          and pg_get_function_identity_arguments(p.oid) =
            'p_conversation_id uuid, p_fact_key text, p_fact_value jsonb, p_source text, p_scope text, p_confidence numeric, p_evidence text'
          and p.prosecdef
          and has_function_privilege('authenticated', p.oid, 'execute')
     )
     or not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'rpc_publish_need'
          and pg_get_function_identity_arguments(p.oid) =
            'p_need_id uuid, p_response_deadline timestamp with time zone'
          and p.prosecdef
          and has_function_privilege('authenticated', p.oid, 'execute')
     )
     or not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'rpc_propose_agreement_change'
          and pg_get_function_identity_arguments(p.oid) =
            'p_agreement_id uuid, p_expected_version integer, p_terms jsonb, p_content_hash text, p_client_request_id text'
          and p.prosecdef
          and has_function_privilege('authenticated', p.oid, 'execute')
     ) then
    raise exception 'RU0_PREDECESSOR_MISMATCH: legacy RPC authority drift';
  end if;
end
$ru0_predecessor$;

lock table public.ai_conversations,
           public.ai_action_proposals,
           public.needs,
           public.notification_deliveries
  in share row exclusive mode;

create temporary table ru0_preserved_row_counts (
  relation_name text primary key,
  row_count bigint not null
) on commit drop;

insert into ru0_preserved_row_counts(relation_name, row_count) values
  ('public.ai_conversations',       (select count(*) from public.ai_conversations)),
  ('public.ai_action_proposals',    (select count(*) from public.ai_action_proposals)),
  ('public.ai_structured_facts',    (select count(*) from public.ai_structured_facts)),
  ('public.needs',                  (select count(*) from public.needs)),
  ('public.notification_deliveries',(select count(*) from public.notification_deliveries)),
  ('public.agreements',             (select count(*) from public.agreements)),
  ('public.agreement_versions',     (select count(*) from public.agreement_versions));

create temporary table ru0_preserved_function_hashes (
  function_oid oid primary key,
  function_identity text not null,
  definition_md5 text not null
) on commit drop;

insert into ru0_preserved_function_hashes(function_oid, function_identity, definition_md5)
select p.oid,
       p.oid::regprocedure::text,
       md5(pg_get_functiondef(p.oid))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'private')
   and p.prosecdef
   and not (
     n.nspname = 'public'
     and p.proname in (
       'rpc_ai_propose_fact',
       'rpc_publish_need',
       'rpc_propose_agreement_change'
     )
   );

-- AI conversations/proposals become read projections for authenticated users.
-- The Edge/service writer keeps its explicit table authority.
drop policy if exists ai_conversations_own on public.ai_conversations;
create policy ai_conversations_owner_read on public.ai_conversations
  for select to authenticated
  using (account_id = (select auth.uid()));

revoke all on table public.ai_conversations from public, anon, authenticated;
grant select on table public.ai_conversations to authenticated;
grant select, insert, update, delete on table public.ai_conversations to service_role;

drop policy if exists ai_proposals_own on public.ai_action_proposals;
create policy ai_action_proposals_owner_read on public.ai_action_proposals
  for select to authenticated
  using (account_id = (select auth.uid()));

revoke all on table public.ai_action_proposals from public, anon, authenticated;
grant select on table public.ai_action_proposals to authenticated;
grant select, insert, update, delete on table public.ai_action_proposals to service_role;

-- Direct owner UPDATE is restricted to drafts. Published/selection/later state
-- changes remain RPC/trigger-owned and cannot be smuggled through raw UPDATE.
drop policy if exists needs_owner_update on public.needs;
create policy needs_owner_update on public.needs
  for update to authenticated
  using (
    requester_account_id = (select auth.uid())
    and status = 'DRAFT'
  )
  with check (
    requester_account_id = (select auth.uid())
    and status = 'DRAFT'
  );

-- Deliveries are server-owned projections. Authenticated users retain own-read
-- but have no direct delivery mutation path.
drop policy if exists deliveries_mark_read on public.notification_deliveries;
drop policy if exists deliveries_own on public.notification_deliveries;
create policy notification_deliveries_owner_read on public.notification_deliveries
  for select to authenticated
  using (recipient_user_id = (select auth.uid()));

revoke all on table public.notification_deliveries from public, anon, authenticated;
grant select on table public.notification_deliveries to authenticated;
grant select, insert, update, delete on table public.notification_deliveries to service_role;

-- Legacy AI proposal authority is retired. AI writes remain exclusively behind
-- rpc_ai_apply_interview_turn_service and the service_role grant.
create or replace function public.rpc_ai_propose_fact(
  p_conversation_id uuid,
  p_fact_key text,
  p_fact_value jsonb,
  p_source text,
  p_scope text,
  p_confidence numeric default null,
  p_evidence text default null
) returns uuid
language plpgsql
security invoker
set search_path = pg_catalog
as $fn$
begin
  raise exception using
    errcode = '42501',
    message = 'LEGACY_RPC_RETIRED',
    hint = 'AI proposals are written only by the service-owned interview turn command.';
end
$fn$;

revoke all on function public.rpc_ai_propose_fact(uuid,text,jsonb,text,text,numeric,text)
  from public, anon, authenticated, service_role;

-- Legacy publication is retired. The policy-fingerprint publication gate is a
-- later dependency-ordered unit; this tombstone cannot publish anything.
create or replace function public.rpc_publish_need(
  p_need_id uuid,
  p_response_deadline timestamptz default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $fn$
begin
  raise exception using
    errcode = '42501',
    message = 'LEGACY_RPC_RETIRED',
    hint = 'Publication requires the canonical reviewed publication command.';
end
$fn$;

revoke all on function public.rpc_publish_need(uuid,timestamptz)
  from public, anon, authenticated, service_role;

-- The unilateral v1 Agreement change path is retired; v2 propose/respond is
-- preserved unchanged and remains the only authenticated change protocol.
create or replace function public.rpc_propose_agreement_change(
  p_agreement_id uuid,
  p_expected_version integer,
  p_terms jsonb,
  p_content_hash text,
  p_client_request_id text
) returns integer
language plpgsql
security invoker
set search_path = pg_catalog
as $fn$
begin
  raise exception using
    errcode = '42501',
    message = 'LEGACY_RPC_RETIRED',
    hint = 'Use rpc_propose_agreement_change_v2 and rpc_respond_agreement_change.';
end
$fn$;

revoke all on function public.rpc_propose_agreement_change(uuid,integer,jsonb,text,text)
  from public, anon, authenticated, service_role;

-- Execute manifest enforcement. Private SECURITY DEFINER helpers are never
-- directly executable by API roles. Public SECURITY DEFINER functions are
-- service-capable; authenticated EXECUTE is regranted only to the explicit
-- command/projection allowlist below.
do $ru0_execute_manifest$
declare
  v_function record;
  v_authenticated_allowlist constant text[] := array[
    'covered_slots',
    'rpc_activate_urgent',
    'rpc_ai_confirm_fact',
    'rpc_ai_correct_fact',
    'rpc_ai_open_conversation',
    'rpc_ai_publish_need',
    'rpc_cancel_agreement',
    'rpc_cancel_need',
    'rpc_complete_worker_profile',
    'rpc_confirm_completion',
    'rpc_delete_draft_need',
    'rpc_get_agreement_workspace',
    'rpc_list_my_agreements',
    'rpc_mark_response_viewed',
    'rpc_mark_work_done',
    'rpc_propose_agreement_change_v2',
    'rpc_report_problem',
    'rpc_respond_agreement_change',
    'rpc_reveal_contact',
    'rpc_select_response',
    'rpc_send_agreement_message',
    'rpc_set_contact_grant',
    'rpc_submit_response',
    'rpc_urgent_activation_preview',
    'rpc_withdraw_response'
  ];
begin
  for v_function in
    select p.oid, n.nspname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated, service_role',
      v_function.oid::regprocedure
    );

    if v_function.nspname = 'public' then
      execute format(
        'grant execute on function %s to service_role',
        v_function.oid::regprocedure
      );
    end if;
  end loop;

  for v_function in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.proname = any(v_authenticated_allowlist)
  loop
    execute format(
      'grant execute on function %s to authenticated',
      v_function.oid::regprocedure
    );
  end loop;
end
$ru0_execute_manifest$;

do $ru0_postconditions$
declare
  v_actual_authenticated text[];
  v_expected_authenticated constant text[] := array[
    'covered_slots',
    'rpc_activate_urgent',
    'rpc_ai_confirm_fact',
    'rpc_ai_correct_fact',
    'rpc_ai_open_conversation',
    'rpc_ai_publish_need',
    'rpc_cancel_agreement',
    'rpc_cancel_need',
    'rpc_complete_worker_profile',
    'rpc_confirm_completion',
    'rpc_delete_draft_need',
    'rpc_get_agreement_workspace',
    'rpc_list_my_agreements',
    'rpc_mark_response_viewed',
    'rpc_mark_work_done',
    'rpc_propose_agreement_change_v2',
    'rpc_report_problem',
    'rpc_respond_agreement_change',
    'rpc_reveal_contact',
    'rpc_select_response',
    'rpc_send_agreement_message',
    'rpc_set_contact_grant',
    'rpc_submit_response',
    'rpc_urgent_activation_preview',
    'rpc_withdraw_response'
  ];
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef) <> 32
     or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'private' and p.prosecdef) <> 23 then
    raise exception 'RU0_POSTCONDITION_FAILED: unexpected SECURITY DEFINER inventory';
  end if;

  if exists (
       select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private')
          and p.prosecdef
          and has_function_privilege('anon', p.oid, 'execute')
     )
     or exists (
       select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private'
          and p.prosecdef
          and (
            has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute')
          )
     ) then
    raise exception 'RU0_POSTCONDITION_FAILED: helper execute surface exceeds manifest';
  end if;

  if exists (
       select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private')
          and p.prosecdef
          and not exists (
            select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
             where c like 'search_path=%'
          )
     ) then
    raise exception 'RU0_POSTCONDITION_FAILED: SECURITY DEFINER without fixed search_path';
  end if;

  select coalesce(array_agg(p.proname order by p.proname), array[]::text[])
    into v_actual_authenticated
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and has_function_privilege('authenticated', p.oid, 'execute');

  if v_actual_authenticated <> v_expected_authenticated then
    raise exception using
      errcode = '55000',
      message = 'RU0_POSTCONDITION_FAILED: authenticated SECURITY DEFINER allowlist mismatch',
      detail = format('actual=%s', v_actual_authenticated);
  end if;

  if exists (
       select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prosecdef
          and not has_function_privilege('service_role', p.oid, 'execute')
     ) then
    raise exception 'RU0_POSTCONDITION_FAILED: service_role lost a public server command';
  end if;

  if has_table_privilege('anon', 'public.ai_conversations', 'SELECT')
     or has_table_privilege('anon', 'public.ai_conversations', 'INSERT')
     or has_table_privilege('anon', 'public.ai_conversations', 'UPDATE')
     or has_table_privilege('anon', 'public.ai_conversations', 'DELETE')
     or has_table_privilege('authenticated', 'public.ai_conversations', 'INSERT')
     or has_table_privilege('authenticated', 'public.ai_conversations', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ai_conversations', 'DELETE')
     or not has_table_privilege('authenticated', 'public.ai_conversations', 'SELECT')
     or not has_table_privilege('service_role', 'public.ai_conversations', 'SELECT')
     or not has_table_privilege('service_role', 'public.ai_conversations', 'INSERT')
     or not has_table_privilege('service_role', 'public.ai_conversations', 'UPDATE')
     or not has_table_privilege('service_role', 'public.ai_conversations', 'DELETE')
     or has_table_privilege('anon', 'public.ai_action_proposals', 'SELECT')
     or has_table_privilege('anon', 'public.ai_action_proposals', 'INSERT')
     or has_table_privilege('anon', 'public.ai_action_proposals', 'UPDATE')
     or has_table_privilege('anon', 'public.ai_action_proposals', 'DELETE')
     or has_table_privilege('authenticated', 'public.ai_action_proposals', 'INSERT')
     or has_table_privilege('authenticated', 'public.ai_action_proposals', 'UPDATE')
     or has_table_privilege('authenticated', 'public.ai_action_proposals', 'DELETE')
     or not has_table_privilege('authenticated', 'public.ai_action_proposals', 'SELECT')
     or not has_table_privilege('service_role', 'public.ai_action_proposals', 'SELECT')
     or not has_table_privilege('service_role', 'public.ai_action_proposals', 'INSERT')
     or not has_table_privilege('service_role', 'public.ai_action_proposals', 'UPDATE')
     or not has_table_privilege('service_role', 'public.ai_action_proposals', 'DELETE')
     or has_table_privilege('anon', 'public.notification_deliveries', 'SELECT')
     or has_table_privilege('anon', 'public.notification_deliveries', 'INSERT')
     or has_table_privilege('anon', 'public.notification_deliveries', 'UPDATE')
     or has_table_privilege('anon', 'public.notification_deliveries', 'DELETE')
     or has_table_privilege('authenticated', 'public.notification_deliveries', 'INSERT')
     or has_table_privilege('authenticated', 'public.notification_deliveries', 'UPDATE')
     or has_table_privilege('authenticated', 'public.notification_deliveries', 'DELETE')
     or not has_table_privilege('authenticated', 'public.notification_deliveries', 'SELECT')
     or not has_table_privilege('service_role', 'public.notification_deliveries', 'SELECT')
     or not has_table_privilege('service_role', 'public.notification_deliveries', 'INSERT')
     or not has_table_privilege('service_role', 'public.notification_deliveries', 'UPDATE')
     or not has_table_privilege('service_role', 'public.notification_deliveries', 'DELETE') then
    raise exception 'RU0_POSTCONDITION_FAILED: table privilege boundary mismatch';
  end if;

  if exists (
       select 1 from pg_policies
        where schemaname = 'public'
          and tablename in ('ai_conversations','ai_action_proposals','notification_deliveries')
          and cmd <> 'SELECT'
     )
     or not exists (
       select 1 from pg_policies
        where schemaname = 'public' and tablename = 'needs'
          and policyname = 'needs_owner_update' and cmd = 'UPDATE'
          and position('DRAFT' in coalesce(qual, '')) > 0
          and position('DRAFT' in coalesce(with_check, '')) > 0
     ) then
    raise exception 'RU0_POSTCONDITION_FAILED: RLS mutation boundary mismatch';
  end if;

  if exists (
       select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'rpc_ai_propose_fact',
            'rpc_publish_need',
            'rpc_propose_agreement_change'
          )
          and (
            p.prosecdef
            or has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute')
          )
     ) then
    raise exception 'RU0_POSTCONDITION_FAILED: a retired legacy RPC remains executable';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.rpc_respond_agreement_change(uuid,boolean)',
       'execute'
     ) then
    raise exception 'RU0_POSTCONDITION_FAILED: preserved narrow authority path was lost';
  end if;

  if (select row_count from ru0_preserved_row_counts where relation_name = 'public.ai_conversations')
       <> (select count(*) from public.ai_conversations)
     or (select row_count from ru0_preserved_row_counts where relation_name = 'public.ai_action_proposals')
       <> (select count(*) from public.ai_action_proposals)
     or (select row_count from ru0_preserved_row_counts where relation_name = 'public.ai_structured_facts')
       <> (select count(*) from public.ai_structured_facts)
     or (select row_count from ru0_preserved_row_counts where relation_name = 'public.needs')
       <> (select count(*) from public.needs)
     or (select row_count from ru0_preserved_row_counts where relation_name = 'public.notification_deliveries')
       <> (select count(*) from public.notification_deliveries)
     or (select row_count from ru0_preserved_row_counts where relation_name = 'public.agreements')
       <> (select count(*) from public.agreements)
     or (select row_count from ru0_preserved_row_counts where relation_name = 'public.agreement_versions')
       <> (select count(*) from public.agreement_versions) then
    raise exception 'RU0_POSTCONDITION_FAILED: business-row count changed';
  end if;

  if (select count(*) from ru0_preserved_function_hashes) <> 55
     or exists (
       select 1
         from ru0_preserved_function_hashes h
         left join pg_proc p on p.oid = h.function_oid
        where p.oid is null
           or not p.prosecdef
           or md5(pg_get_functiondef(p.oid)) <> h.definition_md5
     ) then
    raise exception 'RU0_POSTCONDITION_FAILED: preserved function definition changed';
  end if;
end
$ru0_postconditions$;

comment on function public.rpc_ai_propose_fact(uuid,text,jsonb,text,text,numeric,text) is
  'RU-0 RETIRED: fail-closed SECURITY INVOKER tombstone; no API-role EXECUTE.';
comment on function public.rpc_publish_need(uuid,timestamptz) is
  'RU-0 RETIRED: fail-closed SECURITY INVOKER tombstone; publication awaits the canonical policy gate.';
comment on function public.rpc_propose_agreement_change(uuid,integer,jsonb,text,text) is
  'RU-0 RETIRED: fail-closed SECURITY INVOKER tombstone; v2 propose/respond is authoritative.';

commit;
