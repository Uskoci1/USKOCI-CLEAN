-- ==============================================================================
-- REPAIR: SERVER AUTHORITATIVE MUTATION BOUNDARY
-- Fixes premature migration 20260830173000 and completes authority boundary.
-- ==============================================================================

-- ============================================================
-- A. REVERT AGREEMENT FK DAMAGE
-- Restore ON DELETE RESTRICT + NOT NULL on agreements party columns.
-- Account closure is a separate lifecycle/privacy package.
-- ============================================================

-- First ensure no NULLs crept in (should be impossible since no accounts
-- were deleted between the SET NULL migration and now, but be safe).
do $$ begin
  if exists (select 1 from public.agreements
              where requester_account_id is null
                 or requester_profile_id is null
                 or worker_account_id is null
                 or worker_profile_id is null) then
    raise exception 'AGREEMENTS_HAS_NULL_PARTY — cannot restore NOT NULL safely';
  end if;
end $$;

alter table public.agreements drop constraint if exists agreements_requester_account_id_fkey;
alter table public.agreements drop constraint if exists agreements_requester_profile_id_fkey;
alter table public.agreements drop constraint if exists agreements_worker_account_id_fkey;
alter table public.agreements drop constraint if exists agreements_worker_profile_id_fkey;

alter table public.agreements alter column requester_account_id set not null;
alter table public.agreements alter column requester_profile_id set not null;
alter table public.agreements alter column worker_account_id set not null;
alter table public.agreements alter column worker_profile_id set not null;

alter table public.agreements
  add constraint agreements_requester_account_id_fkey
  foreign key (requester_account_id) references auth.users(id) on delete restrict;

alter table public.agreements
  add constraint agreements_requester_profile_id_fkey
  foreign key (requester_profile_id) references public.app_profiles(id) on delete restrict;

alter table public.agreements
  add constraint agreements_worker_account_id_fkey
  foreign key (worker_account_id) references auth.users(id) on delete restrict;

alter table public.agreements
  add constraint agreements_worker_profile_id_fkey
  foreign key (worker_profile_id) references public.app_profiles(id) on delete restrict;


-- ============================================================
-- B. APP_PROFILES — CLASSIFIED AUTHORITY GUARD
-- SERVER_DERIVED: profile_status, rating_worker, rating_requester, account_type
--   → explicit rejection on unauthorized mutation.
-- SELF_DECLARED: skills, tools, licenses, vehicles, years_experience, team_capacity
--   → client freely edits; matcher treats as unverified evidence.
-- ============================================================

create or replace function private.guard_profile_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  token text := current_setting('uskoci.profile_mutation', true);
begin
  if tg_op = 'INSERT' then
    -- Server-derived fields are forced to safe defaults on INSERT regardless
    -- of what the client sends. No exception needed: creation is cooperative.
    new.profile_status := 'ACTIVE';
    new.account_type   := 'INDIVIDUAL';
    new.rating_requester := null;
    new.rating_worker    := null;
    return new;
  end if;

  -- UPDATE path: reject unauthorized mutation of SERVER_DERIVED fields.
  if token is null then
    if new.profile_status is distinct from old.profile_status then
      raise exception using errcode='42501',
        message='PROFILE_STATUS_IS_SERVER_DERIVED';
    end if;
    if new.account_type is distinct from old.account_type then
      raise exception using errcode='42501',
        message='ACCOUNT_TYPE_IS_SERVER_DERIVED';
    end if;
    if new.rating_requester is distinct from old.rating_requester then
      raise exception using errcode='42501',
        message='RATING_REQUESTER_IS_SERVER_DERIVED';
    end if;
    if new.rating_worker is distinct from old.rating_worker then
      raise exception using errcode='42501',
        message='RATING_WORKER_IS_SERVER_DERIVED';
    end if;
  end if;

  -- SELF_DECLARED fields (skills, tools, licenses, vehicles,
  -- years_experience, team_capacity) pass through freely.
  return new;
end;
$$;

-- Trigger already exists from 20260830173000; re-create to be explicit.
drop trigger if exists guard_profile_write_trg on public.app_profiles;
create trigger guard_profile_write_trg
  before insert or update on public.app_profiles
  for each row execute function private.guard_profile_write();


-- ============================================================
-- C. WORKER_MATCH_PREFERENCES — CROSS-USER BINDING CLOSURE
-- Enforce worker_profile_id ownership on both INSERT and UPDATE.
-- A worker must never repoint their preferences to another profile.
-- ============================================================

create or replace function private.guard_wmp_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode='28000', message='AUTH_REQUIRED';
  end if;

  -- worker_account_id must always match the caller
  if new.worker_account_id is distinct from uid then
    raise exception using errcode='42501',
      message='WMP_ACCOUNT_MUST_BE_CALLER';
  end if;

  -- On UPDATE, worker_account_id is immutable
  if tg_op = 'UPDATE' and new.worker_account_id is distinct from old.worker_account_id then
    raise exception using errcode='42501',
      message='WMP_ACCOUNT_IMMUTABLE';
  end if;

  -- worker_profile_id must be owned by the caller and be a WORKER profile
  if not exists (
    select 1 from public.app_profiles p
     where p.id = new.worker_profile_id
       and p.account_id = uid
       and p.kind = 'WORKER'
  ) then
    raise exception using errcode='42501',
      message='WMP_PROFILE_NOT_OWNED_BY_CALLER';
  end if;

  -- On UPDATE, worker_profile_id is immutable (PK-like semantics)
  if tg_op = 'UPDATE' and new.worker_profile_id is distinct from old.worker_profile_id then
    raise exception using errcode='42501',
      message='WMP_PROFILE_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_wmp_write_trg on public.worker_match_preferences;
create trigger guard_wmp_write_trg
  before insert or update on public.worker_match_preferences
  for each row execute function private.guard_wmp_write();

revoke all on function private.guard_wmp_write()
  from public, anon, authenticated;


-- ============================================================
-- D. NEED / HITNO SERVER-OWNED METADATA
-- Extend guard_need_write to protect urgent*, published_at,
-- response_deadline from direct client mutation, and add
-- approximate_city, approximate_area, public_photo_paths
-- to the material revision list.
-- ============================================================

create or replace function private.guard_need_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  token text := current_setting('uskoci.need_lifecycle', true);
  material boolean;
begin
  -- Profile ownership check (unchanged from P1)
  if not exists (
    select 1 from public.app_profiles p
     where p.id = new.requester_profile_id
       and p.account_id = new.requester_account_id
       and p.kind = 'REQUESTER'
  ) then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT'
       and not (new.status = 'PUBLISHED' and token = 'PUBLISH') then
      raise exception using errcode='22023', message='NEED_MUST_START_AS_DRAFT';
    end if;
    -- On INSERT, server-owned metadata must be defaults unless RPC sets them
    if token is null then
      new.urgent := false;
      new.urgent_activated_at := null;
      new.urgent_expires_at := null;
      new.urgent_policy_version := null;
      new.published_at := null;
      new.response_deadline := null;
    end if;
    return new;
  end if;

  -- Terminal domain truth is immutable. The only tolerated housekeeping change
  -- is urgent=true -> false (plus the normal updated_at trigger), so expiry of
  -- an old urgency projection can never wedge the marketplace cron.
  if old.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
     and (
       (to_jsonb(new) - array['urgent','updated_at'])
         is distinct from
       (to_jsonb(old) - array['urgent','updated_at'])
       or (not coalesce(old.urgent, false) and coalesce(new.urgent, false))
     ) then
    raise exception using errcode='22023', message='NEED_TERMINAL_IMMUTABLE';
  end if;

  if new.requester_account_id <> old.requester_account_id then
    raise exception using errcode='42501', message='NEED_OWNER_IMMUTABLE';
  end if;

  -- Status transition enforcement (unchanged from P1)
  if new.status is distinct from old.status then
    if not (
         (token = 'PUBLISH'
          and old.status = 'DRAFT' and new.status = 'PUBLISHED')
      or (token = 'SELECT'
          and old.status in ('PUBLISHED','SELECTION')
          and new.status in ('SELECTION','ACTIVE'))
      or (token = 'CANCEL_NEED'
          and old.status in ('DRAFT','PUBLISHED','SELECTION')
          and new.status = 'CANCELLED')
      or (token = 'CANCEL_AGREEMENT'
          and old.status in ('ACTIVE','SELECTION')
          and new.status = 'SELECTION')
      or (token = 'EXPIRE'
          and old.status in ('PUBLISHED','SELECTION')
          and new.status = 'EXPIRED')
    ) then
      raise exception using errcode='22023', message='NEED_STATUS_TRANSITION_REQUIRES_RPC';
    end if;
  end if;

  -- SERVER-OWNED METADATA PROTECTION (NEW in this migration)
  -- These fields may only be changed by RPCs that set a lifecycle token.
  if token is null then
    if new.urgent is distinct from old.urgent then
      raise exception using errcode='42501', message='URGENT_IS_SERVER_OWNED';
    end if;
    if new.urgent_activated_at is distinct from old.urgent_activated_at then
      raise exception using errcode='42501', message='URGENT_ACTIVATED_AT_IS_SERVER_OWNED';
    end if;
    if new.urgent_expires_at is distinct from old.urgent_expires_at then
      raise exception using errcode='42501', message='URGENT_EXPIRES_AT_IS_SERVER_OWNED';
    end if;
    if new.urgent_policy_version is distinct from old.urgent_policy_version then
      raise exception using errcode='42501', message='URGENT_POLICY_VERSION_IS_SERVER_OWNED';
    end if;
    if new.published_at is distinct from old.published_at then
      raise exception using errcode='42501', message='PUBLISHED_AT_IS_SERVER_OWNED';
    end if;
    if new.response_deadline is distinct from old.response_deadline then
      raise exception using errcode='42501', message='RESPONSE_DEADLINE_IS_SERVER_OWNED';
    end if;
  end if;

  -- Material revision check — extended with approximate_city,
  -- approximate_area, public_photo_paths, response_deadline.
  material :=
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
    or new.required_slots is distinct from old.required_slots
    or new.mode is distinct from old.mode
    or new.requester_price_rsd is distinct from old.requester_price_rsd
    or new.required_skills is distinct from old.required_skills
    or new.required_tools is distinct from old.required_tools
    or new.required_vehicles is distinct from old.required_vehicles
    or new.required_licenses is distinct from old.required_licenses
    or new.minimum_experience_years is distinct from old.minimum_experience_years
    or new.verified_identity_required is distinct from old.verified_identity_required
    or new.schedule_kind is distinct from old.schedule_kind
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.execution_location_mode is distinct from old.execution_location_mode
    or new.approximate_lat is distinct from old.approximate_lat
    or new.approximate_lng is distinct from old.approximate_lng
    -- NEW material fields:
    or new.approximate_city is distinct from old.approximate_city
    or new.approximate_area is distinct from old.approximate_area
    or new.public_photo_paths is distinct from old.public_photo_paths
    or new.response_deadline is distinct from old.response_deadline;

  if material then
    if old.status in ('PUBLISHED','SELECTION') then
      new.revision := old.revision + 1;
    end if;
  elsif new.revision is distinct from old.revision then
    raise exception using errcode='22023', message='REVISION_BUMP_WITHOUT_MATERIAL_CHANGE';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_need_write()
  from public, anon, authenticated;


-- ============================================================
-- E. AI FACTS — AUTHORITATIVE TRANSITION SEMANTICS
-- Immutable content. Valid status transitions only.
-- Server-derived confirmed_by_user_id and confirmed_at.
-- ============================================================

create or replace function private.guard_ai_fact_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  uid uuid := auth.uid();
begin
  -- Internal RPCs bypass all checks
  if current_setting('uskoci.ai_mutation', true) is not null then
    return new;
  end if;

  -- Ownership check: caller must own the fact
  if new.account_id is distinct from uid then
    raise exception using errcode='42501', message='FACT_NOT_OWNED_BY_CALLER';
  end if;

  -- Immutable content fields
  if new.fact_key is distinct from old.fact_key then
    raise exception using errcode='42501', message='FACT_KEY_IMMUTABLE';
  end if;
  if new.fact_value is distinct from old.fact_value then
    raise exception using errcode='42501', message='FACT_VALUE_IMMUTABLE';
  end if;
  if new.source is distinct from old.source then
    raise exception using errcode='42501', message='FACT_SOURCE_IMMUTABLE';
  end if;
  if new.evidence_excerpt is distinct from old.evidence_excerpt then
    raise exception using errcode='42501', message='FACT_EVIDENCE_IMMUTABLE';
  end if;
  if new.scope is distinct from old.scope then
    raise exception using errcode='42501', message='FACT_SCOPE_IMMUTABLE';
  end if;
  if new.confidence is distinct from old.confidence then
    raise exception using errcode='42501', message='FACT_CONFIDENCE_IMMUTABLE';
  end if;
  if new.conversation_id is distinct from old.conversation_id then
    raise exception using errcode='42501', message='FACT_CONVERSATION_IMMUTABLE';
  end if;
  if new.subject_need_id is distinct from old.subject_need_id then
    raise exception using errcode='42501', message='FACT_SUBJECT_IMMUTABLE';
  end if;

  -- Status transition enforcement
  if new.status is distinct from old.status then
    if not (
      (old.status in ('NEEDS_CONFIRMATION','INFERRED','UNKNOWN')
       and new.status = 'CONFIRMED')
    ) then
      raise exception using errcode='22023',
        message='INVALID_FACT_STATUS_TRANSITION',
        detail = old.status || ' -> ' || new.status;
    end if;

    -- Server-derive confirmation metadata
    new.confirmed_by_user_id := uid;
    new.confirmed_at := statement_timestamp();
  end if;

  -- Reject fabrication: cannot set confirmed_* without transitioning to CONFIRMED
  if new.status = old.status then
    if new.confirmed_at is distinct from old.confirmed_at
       or new.confirmed_by_user_id is distinct from old.confirmed_by_user_id then
      raise exception using errcode='42501',
        message='CONFIRMED_METADATA_REQUIRES_STATUS_TRANSITION';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger already exists; re-create to ensure correct binding
drop trigger if exists guard_ai_fact_write_trg on public.ai_structured_facts;
create trigger guard_ai_fact_write_trg
  before update on public.ai_structured_facts
  for each row execute function private.guard_ai_fact_write();


-- ============================================================
-- F. AI PROPOSALS — AUTHORITATIVE TRANSITION SEMANTICS
-- Uses correct column name action_kind (not action_type).
-- Immutable content. Valid transitions only.
-- Server-derived decided_at.
-- ============================================================

create or replace function private.guard_ai_proposal_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  uid uuid := auth.uid();
begin
  -- Internal RPCs bypass all checks
  if current_setting('uskoci.ai_mutation', true) is not null then
    return new;
  end if;

  -- Ownership check
  if new.account_id is distinct from uid then
    raise exception using errcode='42501', message='PROPOSAL_NOT_OWNED_BY_CALLER';
  end if;

  -- Immutable content fields
  if new.action_kind is distinct from old.action_kind then
    raise exception using errcode='42501', message='PROPOSAL_ACTION_KIND_IMMUTABLE';
  end if;
  if new.payload is distinct from old.payload then
    raise exception using errcode='42501', message='PROPOSAL_PAYLOAD_IMMUTABLE';
  end if;
  if new.conversation_id is distinct from old.conversation_id then
    raise exception using errcode='42501', message='PROPOSAL_CONVERSATION_IMMUTABLE';
  end if;

  -- Status transition enforcement
  if new.status is distinct from old.status then
    if not (
      (old.status = 'PROPOSED' and new.status in ('CONFIRMED','REJECTED'))
    ) then
      raise exception using errcode='22023',
        message='INVALID_PROPOSAL_STATUS_TRANSITION',
        detail = old.status || ' -> ' || new.status;
    end if;

    -- Server-derive decision timestamp
    new.decided_at := statement_timestamp();
  end if;

  -- Reject fabrication: cannot set decided_at without transitioning status
  if new.status = old.status then
    if new.decided_at is distinct from old.decided_at then
      raise exception using errcode='42501',
        message='DECIDED_AT_REQUIRES_STATUS_TRANSITION';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger already exists; re-create with correct binding
drop trigger if exists guard_ai_proposal_write_trg on public.ai_action_proposals;
create trigger guard_ai_proposal_write_trg
  before update on public.ai_action_proposals
  for each row execute function private.guard_ai_proposal_write();


-- ============================================================
-- Revoke direct execute on all new guard functions
-- ============================================================
revoke all on function private.guard_profile_write()
  from public, anon, authenticated;
revoke all on function private.guard_wmp_write()
  from public, anon, authenticated;
revoke all on function private.guard_ai_fact_write()
  from public, anon, authenticated;
revoke all on function private.guard_ai_proposal_write()
  from public, anon, authenticated;


-- ============================================================
-- COMMENTS
-- ============================================================
comment on function private.guard_profile_write() is
  'Server-authoritative boundary for app_profiles. Rejects mutation of profile_status, account_type, rating_requester, rating_worker. Allows SELF_DECLARED fields (skills, tools, licenses, vehicles, years_experience, team_capacity).';

comment on function private.guard_wmp_write() is
  'Cross-user binding closure for worker_match_preferences. Enforces worker_profile_id ownership and immutability on both INSERT and UPDATE.';

comment on function private.guard_need_write() is
  'Need lifecycle guard. Status transitions require RPC lifecycle token. Server-owned metadata (urgent*, published_at, response_deadline) is protected. Material revision fields include approximate_city, approximate_area, public_photo_paths, response_deadline.';

comment on function private.guard_ai_fact_write() is
  'AI fact authoritative transition guard. Content is immutable. Only valid status transitions (NEEDS_CONFIRMATION/INFERRED/UNKNOWN -> CONFIRMED). Server-derives confirmed_by_user_id and confirmed_at.';

comment on function private.guard_ai_proposal_write() is
  'AI proposal authoritative transition guard. Content is immutable. Only valid transitions (PROPOSED -> CONFIRMED/REJECTED). Server-derives decided_at.';
