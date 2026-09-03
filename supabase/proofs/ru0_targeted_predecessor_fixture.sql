-- Disposable RU-0 predecessor fixture.
--
-- This file exists ONLY on the proof branch. It is not a production migration.
-- It mirrors the exact RU-0 authority surface verified read-only on the live
-- CLEAN predecessor while avoiding reliance on the non-replayable historical
-- zateceno-state migration chain.

\set ON_ERROR_STOP on

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public authorization postgres;
create schema private authorization postgres;
grant usage on schema public to anon, authenticated, service_role;

-- A completely empty local Supabase project has no migration ledger until the
-- CLI applies its first migration. The canonical live ledger shape was verified
-- read-only before this harness was built, so recreate that shape explicitly.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text,
  created_by text,
  idempotency_key text unique,
  rollback text[]
);

-- Recreate the predecessor migration ledger contract: exactly 56 entries with
-- the verified live head 20260901114029. These rows are disposable proof-only.
truncate table supabase_migrations.schema_migrations;
do $ledger$
declare
  i integer;
begin
  for i in 1..55 loop
    insert into supabase_migrations.schema_migrations(version, name)
    values ('202608' || to_char(i, 'FM00000000'), 'ru0_fixture_' || i);
  end loop;
  insert into supabase_migrations.schema_migrations(version, name)
  values ('20260901114029', 'clean_ai_fact_supersession_and_human_correction');
end
$ledger$;

-- Minimal business relations touched or asserted by RU-0/runtime proof.
create table public.app_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  city text not null default '',
  phone text not null default '',
  active_mode text not null default 'requester',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.app_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  kind text not null,
  display_name text not null default '',
  unique(account_id, kind)
);

create table public.needs (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_account_id uuid not null references auth.users(id),
  requester_profile_id uuid not null references public.app_profiles(id),
  status text not null default 'DRAFT',
  title text not null,
  description text not null,
  category text not null,
  mode text not null,
  published_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.ai_conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references auth.users(id),
  purpose text not null,
  status text not null default 'OPEN',
  bound_need_id uuid references public.needs(id),
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz
);

create table public.ai_action_proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id),
  account_id uuid not null references auth.users(id),
  action_kind text not null,
  payload jsonb not null,
  status text not null default 'PROPOSED',
  decided_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

create table public.ai_structured_facts (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid references auth.users(id),
  conversation_id uuid references public.ai_conversations(id),
  subject_need_id uuid references public.needs(id),
  fact_key text,
  fact_value jsonb,
  status text,
  source text,
  scope text,
  created_at timestamptz not null default statement_timestamp()
);

create table public.ai_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references auth.users(id),
  conversation_id uuid not null references public.ai_conversations(id),
  role text not null,
  body text not null,
  safety text,
  created_at timestamptz not null default statement_timestamp()
);

create table public.user_activity_events (
  id uuid primary key default extensions.gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id),
  recipient_role text not null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default statement_timestamp()
);

create table public.notification_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.user_activity_events(id),
  recipient_user_id uuid not null references auth.users(id),
  recipient_role text not null,
  channel text not null,
  state text not null,
  title text not null,
  body text not null,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

create table public.agreements (
  id uuid primary key default extensions.gen_random_uuid()
);

create table public.agreement_versions (
  agreement_id uuid not null references public.agreements(id),
  version integer not null,
  primary key (agreement_id, version)
);

alter table public.needs enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_action_proposals enable row level security;
alter table public.notification_deliveries enable row level security;

-- Broad predecessor policies deliberately mirror the live RU-0 gaps.
create policy needs_owner_read on public.needs
  for select to authenticated
  using (requester_account_id = (select auth.uid()));
create policy needs_owner_update on public.needs
  for update to authenticated
  using (requester_account_id = (select auth.uid()))
  with check (requester_account_id = (select auth.uid()));

create policy ai_conversations_own on public.ai_conversations
  for all to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

create policy ai_proposals_own on public.ai_action_proposals
  for all to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

create policy deliveries_own on public.notification_deliveries
  for select to authenticated
  using (recipient_user_id = (select auth.uid()));
create policy deliveries_mark_read on public.notification_deliveries
  for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_conversations to authenticated, service_role;
grant select, insert, update, delete on public.ai_action_proposals to authenticated, service_role;
grant select, insert, update, delete on public.notification_deliveries to authenticated, service_role;
grant select, update on public.needs to authenticated;
grant select, insert, update, delete on public.needs to service_role;

-- Auth trigger needed by the rollback-only owner/attacker proof.
create or replace function public.handle_uskoci_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
begin
  insert into public.app_accounts(id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'RU0 Proof User')
  );
  insert into public.app_profiles(account_id, kind, display_name)
  values (new.id, 'REQUESTER', coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'RU0 Proof User'));
  return new;
end
$fn$;

create or replace function public.handle_uskoci_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
begin
  return new;
end
$fn$;

create trigger ru0_fixture_auth_created
after insert on auth.users
for each row execute function public.handle_uskoci_auth_user_created();

-- Exact legacy signatures that RU-0 must retire.
create or replace function public.rpc_ai_propose_fact(
  p_conversation_id uuid, p_fact_key text, p_fact_value jsonb,
  p_source text, p_scope text, p_confidence numeric default null,
  p_evidence text default null
) returns uuid
language plpgsql security definer set search_path = pg_catalog
as $fn$ begin return extensions.gen_random_uuid(); end $fn$;

create or replace function public.rpc_publish_need(
  p_need_id uuid, p_response_deadline timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $fn$ begin return jsonb_build_object('legacy', true); end $fn$;

create or replace function public.rpc_propose_agreement_change(
  p_agreement_id uuid, p_expected_version integer, p_terms jsonb,
  p_content_hash text, p_client_request_id text
) returns integer
language plpgsql security definer set search_path = pg_catalog
as $fn$ begin return p_expected_version + 1; end $fn$;

grant execute on function public.rpc_ai_propose_fact(uuid,text,jsonb,text,text,numeric,text) to authenticated;
grant execute on function public.rpc_publish_need(uuid,timestamptz) to authenticated;
grant execute on function public.rpc_propose_agreement_change(uuid,integer,jsonb,text,text) to authenticated;

-- The service writer is an actual positive side-effect proof: it persists a
-- USER+ASSISTANT pair under SECURITY DEFINER and returns authoritative=true.
create or replace function public.rpc_ai_apply_interview_turn_service(
  p_account_id uuid,
  p_conversation_id uuid,
  p_user_message text,
  p_assistant_message text,
  p_safety text,
  p_proposals jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
begin
  insert into public.ai_messages(account_id, conversation_id, role, body, safety)
  values
    (p_account_id, p_conversation_id, 'USER', p_user_message, p_safety),
    (p_account_id, p_conversation_id, 'ASSISTANT', p_assistant_message, p_safety);
  return jsonb_build_object('authoritative', true);
end
$fn$;

-- Exact v2 Agreement signatures preserved by RU-0.
create or replace function public.rpc_propose_agreement_change_v2(
  p_agreement_id uuid, p_expected_version integer, p_patch jsonb,
  p_reason text, p_client_request_id text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $fn$ begin return jsonb_build_object('ok', true); end $fn$;

create or replace function public.rpc_respond_agreement_change(
  p_proposal_id uuid, p_accept boolean
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $fn$ begin return jsonb_build_object('ok', true); end $fn$;

-- Remaining authenticated allowlist. One overload per name is intentional so
-- the postcondition compares an exact 25-name array.
do $allowlist$
declare
  fn text;
  names text[] := array[
    'covered_slots','rpc_activate_urgent','rpc_ai_confirm_fact','rpc_ai_correct_fact',
    'rpc_ai_open_conversation','rpc_ai_publish_need','rpc_cancel_agreement',
    'rpc_cancel_need','rpc_complete_worker_profile','rpc_confirm_completion',
    'rpc_delete_draft_need','rpc_get_agreement_workspace','rpc_list_my_agreements',
    'rpc_mark_response_viewed','rpc_mark_work_done','rpc_report_problem',
    'rpc_reveal_contact','rpc_select_response','rpc_send_agreement_message',
    'rpc_set_contact_grant','rpc_submit_response','rpc_urgent_activation_preview',
    'rpc_withdraw_response'
  ];
begin
  foreach fn in array names loop
    execute format(
      'create function public.%I() returns jsonb language sql security definer set search_path = pg_catalog as %L',
      fn,
      'select jsonb_build_object(''ok'', true)'
    );
  end loop;
end
$allowlist$;

-- Six non-authenticated public SECURITY DEFINER server helpers complete the
-- verified public predecessor inventory of 35.
create function public.fn_is_party() returns boolean
language sql security definer set search_path = pg_catalog as $$ select true $$;
create function public.fn_need_covered_slots() returns integer
language sql security definer set search_path = pg_catalog as $$ select 0 $$;
create function public.rls_auto_enable() returns void
language sql security definer set search_path = pg_catalog as $$ select $$;
create function public.rpc_tick_auto_completion() returns jsonb
language sql security definer set search_path = pg_catalog as $$ select '{}'::jsonb $$;

-- 23 private SECURITY DEFINER helpers; names are synthetic but cardinality and
-- authority shape match the live predecessor. No proof behavior depends on them.
do $private_helpers$
declare
  i integer;
begin
  for i in 1..23 loop
    execute format(
      'create function private.ru0_helper_%s() returns void language sql security definer set search_path = pg_catalog as %L',
      to_char(i, 'FM00'),
      'select'
    );
  end loop;
end
$private_helpers$;

-- Predecessor execution shape: authenticated can reach all public SD functions
-- before RU-0; private helpers are also intentionally broad so RU-0 proves they
-- become non-API callable.
grant execute on all functions in schema public to authenticated, service_role;
grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;

-- Assertions make fixture drift explicit instead of silently weakening proof.
do $fixture_assert$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 56
     or (select max(version) from supabase_migrations.schema_migrations) <> '20260901114029' then
    raise exception 'RU0_FIXTURE_FAILED: migration ledger';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.prosecdef) <> 35 then
    raise exception 'RU0_FIXTURE_FAILED: public SECURITY DEFINER count';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='private' and p.prosecdef) <> 23 then
    raise exception 'RU0_FIXTURE_FAILED: private SECURITY DEFINER count';
  end if;
end
$fixture_assert$;
