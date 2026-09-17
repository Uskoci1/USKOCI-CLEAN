-- USKOČI PKG-015 / GAP-0018
-- SOURCE CANDIDATE ONLY. This file is intentionally outside supabase/migrations.
-- It must not be applied to canonical DEV until it is promoted as a forward-only
-- migration and the package/disposable-schema gates authorize that promotion.
--
-- Purpose: record, for every account on a non-production project, which lineage it
-- has and why, with an append-only history of every reclassification. Today nothing
-- in the schema distinguishes a synthetic proof fixture from the owner's real
-- account, so "is this row test data?" has no answer that survives a session.
--
-- This is a REGISTRY, not a gate. It deliberately changes NO domain behaviour:
-- reputation, ranking, dispatch, notification, billing and visibility are untouched.
-- Whether the engine should *enforce* isolation is a separate, larger question that
-- PKG-015 documents as a finding rather than smuggling into a registry.
--
-- It is also NOT a cleanup: no existing row is deleted, rewritten or reassigned.
-- Classifying data and removing it are different decisions; removal stays with
-- PKG-023 where the owner placed it.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $pkg015_preflight$
begin
  if to_regclass('auth.users') is null or to_regnamespace('private') is null then
    raise exception 'PKG015_PREDECESSOR_MISMATCH: canonical account authority is incomplete'
      using errcode = '55000';
  end if;
  if to_regclass('private.account_lineage_v5') is not null
     or to_regclass('private.account_lineage_events_v5') is not null
     or to_regprocedure('public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)') is not null then
    raise exception 'PKG015_ALREADY_PRESENT' using errcode = '55000';
  end if;
end
$pkg015_preflight$;

-- One row per classified account. An account with no row is UNCLASSIFIED, which is
-- a real and reportable state, never silently equivalent to either test or real.
create table private.account_lineage_v5 (
  account_id uuid primary key references auth.users(id) on delete cascade,
  lineage text not null check (lineage in
    ('OWNER_PERSONAL','OWNER_BUSINESS','DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR','REAL_USER')),
  reason text not null check (length(btrim(reason)) between 3 and 500),
  source_ref text not null check (length(btrim(source_ref)) between 3 and 200),
  revision integer not null default 1 check (revision >= 1),
  admitted_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

alter table private.account_lineage_v5 enable row level security;
alter table private.account_lineage_v5 force row level security;
revoke all on table private.account_lineage_v5 from public, anon, authenticated, service_role;

comment on table private.account_lineage_v5 is
  'PKG-015 operator-set lineage of each account on a non-production project. Registry only: it gates no domain behaviour. An absent row means UNCLASSIFIED.';

-- Append-only history. A reclassification must never quietly overwrite the record
-- of what the account used to be, or who said so.
create table private.account_lineage_events_v5 (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  from_lineage text,
  to_lineage text not null,
  reason text not null,
  source_ref text not null,
  revision integer not null,
  recorded_at timestamptz not null default clock_timestamp()
);

create index account_lineage_events_v5_account_idx
  on private.account_lineage_events_v5 (account_id, recorded_at desc);

alter table private.account_lineage_events_v5 enable row level security;
alter table private.account_lineage_events_v5 force row level security;
revoke all on table private.account_lineage_events_v5 from public, anon, authenticated, service_role;

comment on table private.account_lineage_events_v5 is
  'PKG-015 append-only history of every lineage admission and reclassification, including the previous value.';

-- Refuse UPDATE and DELETE on the history at the database level, so append-only is
-- a property of the schema rather than a convention anyone can forget.
create function private.account_lineage_events_append_only()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  raise exception 'ACCOUNT_LINEAGE_HISTORY_IMMUTABLE' using errcode = '55000';
end
$function$;

revoke all on function private.account_lineage_events_append_only() from public, anon, authenticated, service_role;

create trigger account_lineage_events_v5_append_only
  before update or delete on private.account_lineage_events_v5
  for each row execute function private.account_lineage_events_append_only();

-- Reads. Both are pure: they answer a question and change nothing.
create function private.account_lineage(p_account_id uuid)
returns text
language sql
stable
security definer
set search_path to 'pg_catalog'
as $function$
  select coalesce((select l.lineage from private.account_lineage_v5 l where l.account_id = p_account_id), 'UNCLASSIFIED');
$function$;

revoke all on function private.account_lineage(uuid) from public, anon, authenticated, service_role;

comment on function private.account_lineage(uuid) is
  'PKG-015 lineage of one account, or UNCLASSIFIED when no row exists. Reached only through the service read, never directly by a role.';

-- Fail-closed on purpose: an UNCLASSIFIED account is NOT reported as non-production.
-- The safe default is to treat an unknown account as if it were real, so that no
-- account is ever silently exempted from a rule that protects real users.
create function private.account_is_non_production(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog'
as $function$
  select private.account_lineage(p_account_id)
    in ('OWNER_PERSONAL','OWNER_BUSINESS','DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR');
$function$;

revoke all on function private.account_is_non_production(uuid) from public, anon, authenticated, service_role;

comment on function private.account_is_non_production(uuid) is
  'PKG-015 true only for an explicitly classified non-production account. UNCLASSIFIED and REAL_USER both return false, so an unknown account is never exempted.';

-- Service-only writer. Lineage is an operator fact about an account, never a claim
-- the account itself can make, so there is no authenticated path and no auth.uid().
create function public.rpc_admit_account_lineage_service(
  p_account_id uuid,
  p_lineage text,
  p_reason text,
  p_source_ref text,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_current private.account_lineage_v5;
  v_next integer;
begin
  if p_account_id is null or p_lineage is null or p_reason is null or p_source_ref is null
     or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'ACCOUNT_LINEAGE_INPUT_INVALID' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_account_id) then
    raise exception 'ACCOUNT_LINEAGE_ACCOUNT_NOT_FOUND' using errcode = '42501';
  end if;

  -- One writer at a time per account, so a concurrent reclassification cannot
  -- interleave and leave the history disagreeing with the current row.
  perform pg_advisory_xact_lock(hashtextextended('uskoci:account-lineage:'||p_account_id::text, 150));

  select * into v_current from private.account_lineage_v5 where account_id = p_account_id for update;

  if not found then
    if p_expected_revision <> 0 then
      raise exception 'ACCOUNT_LINEAGE_REVISION_CONFLICT' using errcode = '40001';
    end if;
    v_next := 1;
    insert into private.account_lineage_v5(account_id, lineage, reason, source_ref, revision)
      values (p_account_id, p_lineage, btrim(p_reason), btrim(p_source_ref), v_next);
  else
    if v_current.revision <> p_expected_revision then
      raise exception 'ACCOUNT_LINEAGE_REVISION_CONFLICT' using errcode = '40001';
    end if;
    -- An identical restatement is a no-op rather than a new revision, so replaying
    -- the same admission never inflates the history.
    if v_current.lineage = p_lineage and v_current.reason = btrim(p_reason)
       and v_current.source_ref = btrim(p_source_ref) then
      return jsonb_build_object('accountId', p_account_id, 'lineage', v_current.lineage,
        'reason', v_current.reason, 'sourceRef', v_current.source_ref,
        'revision', v_current.revision, 'changed', false, 'authoritative', true);
    end if;
    v_next := v_current.revision + 1;
    update private.account_lineage_v5
       set lineage = p_lineage, reason = btrim(p_reason), source_ref = btrim(p_source_ref),
           revision = v_next, updated_at = clock_timestamp()
     where account_id = p_account_id;
  end if;

  insert into private.account_lineage_events_v5(account_id, from_lineage, to_lineage, reason, source_ref, revision)
    values (p_account_id, v_current.lineage, p_lineage, btrim(p_reason), btrim(p_source_ref), v_next);

  return jsonb_build_object('accountId', p_account_id, 'lineage', p_lineage,
    'reason', btrim(p_reason), 'sourceRef', btrim(p_source_ref),
    'revision', v_next, 'changed', true, 'authoritative', true);
end
$function$;

revoke all on function public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_admit_account_lineage_service(uuid,text,text,text,integer) to service_role;

comment on function public.rpc_admit_account_lineage_service(uuid,text,text,text,integer) is
  'PKG-015 service-only lineage admission and reclassification with optimistic revision control and an append-only history entry. Registry only: gates no domain behaviour.';

-- Read-back for an operator, service only, so classification can be audited without
-- granting table access to anything.
create function public.rpc_read_account_lineage_service(p_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v private.account_lineage_v5;
begin
  if p_account_id is null then
    raise exception 'ACCOUNT_LINEAGE_INPUT_INVALID' using errcode = '22023';
  end if;
  select * into v from private.account_lineage_v5 where account_id = p_account_id;
  if not found then
    return jsonb_build_object('accountId', p_account_id, 'lineage', 'UNCLASSIFIED',
      'revision', 0, 'nonProduction', false, 'authoritative', true);
  end if;
  return jsonb_build_object('accountId', v.account_id, 'lineage', v.lineage, 'reason', v.reason,
    'sourceRef', v.source_ref, 'revision', v.revision,
    'nonProduction', private.account_is_non_production(v.account_id),
    'admittedAt', v.admitted_at, 'updatedAt', v.updated_at, 'authoritative', true);
end
$function$;

revoke all on function public.rpc_read_account_lineage_service(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_read_account_lineage_service(uuid) to service_role;

comment on function public.rpc_read_account_lineage_service(uuid) is
  'PKG-015 service-only authoritative read of one account lineage; UNCLASSIFIED with revision 0 when absent.';

do $pkg015_postcondition$
begin
  if to_regclass('private.account_lineage_v5') is null
     or to_regclass('private.account_lineage_events_v5') is null
     or to_regprocedure('public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)') is null
     or to_regprocedure('public.rpc_read_account_lineage_service(uuid)') is null
     or to_regprocedure('private.account_lineage(uuid)') is null
     or to_regprocedure('private.account_is_non_production(uuid)') is null then
    raise exception 'PKG015_POSTCONDITION_FAILED: registry incomplete';
  end if;

  -- No client role may read or write the registry, and no client role may call the
  -- service writer. Lineage is operator metadata; a client has no business in it.
  if has_table_privilege('anon', 'private.account_lineage_v5', 'SELECT')
     or has_table_privilege('authenticated', 'private.account_lineage_v5', 'SELECT')
     or has_table_privilege('service_role', 'private.account_lineage_v5', 'SELECT')
     or has_table_privilege('authenticated', 'private.account_lineage_events_v5', 'SELECT')
     or has_table_privilege('service_role', 'private.account_lineage_events_v5', 'INSERT') then
    raise exception 'PKG015_POSTCONDITION_FAILED: lineage registry leaked to a role';
  end if;
  if has_function_privilege('anon', 'public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)', 'EXECUTE') then
    raise exception 'PKG015_POSTCONDITION_FAILED: admission writer ACL mismatch';
  end if;
  if has_function_privilege('anon', 'public.rpc_read_account_lineage_service(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rpc_read_account_lineage_service(uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.rpc_read_account_lineage_service(uuid)', 'EXECUTE') then
    raise exception 'PKG015_POSTCONDITION_FAILED: lineage read ACL mismatch';
  end if;

  -- A new function grants EXECUTE to PUBLIC unless revoked. These three are
  -- internal helpers and must not be reachable by any role directly.
  if has_function_privilege('anon', 'private.account_lineage(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.account_lineage(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.account_lineage(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.account_is_non_production(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.account_is_non_production(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.account_lineage_events_append_only()', 'EXECUTE') then
    raise exception 'PKG015_POSTCONDITION_FAILED: internal helper reachable by a role';
  end if;

  -- The history must be append-only at the schema level, not by convention.
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'private.account_lineage_events_v5'::regclass
      and t.tgname = 'account_lineage_events_v5_append_only' and not t.tgisinternal) then
    raise exception 'PKG015_POSTCONDITION_FAILED: history is not append-only';
  end if;
end
$pkg015_postcondition$;

commit;
