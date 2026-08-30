-- ==============================================================================
-- PACKAGE C: SERVER AUTHORITATIVE MUTATION BOUNDARY
-- Resolves unauthorized client-side spoofing of critical state.
-- ==============================================================================

-- 1. app_profiles Guard
-- Prevents clients from updating protected fields (profile_status, team_capacity, etc.)
create or replace function private.guard_profile_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  token text := current_setting('uskoci.profile_mutation', true);
begin
  if token is null then
    if tg_op = 'UPDATE' then
      new.profile_status := old.profile_status;
      new.account_type := old.account_type;
      new.team_capacity := old.team_capacity;
      new.rating_requester := old.rating_requester;
      new.rating_worker := old.rating_worker;
      new.years_experience := old.years_experience;
    elsif tg_op = 'INSERT' then
      new.profile_status := 'ACTIVE';
      new.account_type := 'INDIVIDUAL';
      new.team_capacity := 1;
      new.rating_requester := null;
      new.rating_worker := null;
      new.years_experience := 0;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_write_trg on public.app_profiles;
create trigger guard_profile_write_trg
  before insert or update on public.app_profiles
  for each row execute function private.guard_profile_write();

-- 2. ai_structured_facts Guard
-- Prevents clients from spoofing AI facts. They can only transition the status.
create or replace function private.guard_ai_fact_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
begin
  if current_setting('uskoci.ai_mutation', true) is null then
    if new.fact_key is distinct from old.fact_key or
       new.fact_value is distinct from old.fact_value or
       new.source is distinct from old.source or
       new.evidence_excerpt is distinct from old.evidence_excerpt then
      raise exception using errcode='42501', message='CANNOT_MUTATE_FACT_CONTENT';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_ai_fact_write_trg on public.ai_structured_facts;
create trigger guard_ai_fact_write_trg
  before update on public.ai_structured_facts
  for each row execute function private.guard_ai_fact_write();

-- 3. ai_action_proposals Guard
create or replace function private.guard_ai_proposal_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
begin
  if current_setting('uskoci.ai_mutation', true) is null then
    if new.action_type is distinct from old.action_type or
       new.payload is distinct from old.payload or
       new.evidence_excerpt is distinct from old.evidence_excerpt then
      raise exception using errcode='42501', message='CANNOT_MUTATE_PROPOSAL_CONTENT';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_ai_proposal_write_trg on public.ai_action_proposals;
create trigger guard_ai_proposal_write_trg
  before update on public.ai_action_proposals
  for each row execute function private.guard_ai_proposal_write();

-- 4. Unblock Account Deletion (Agreements FKs)
-- Drop the restrictive foreign keys and replace them with ON DELETE SET NULL.
-- Also requires dropping the NOT NULL constraint to allow NULL on deletion.

alter table public.agreements drop constraint if exists agreements_requester_account_id_fkey;
alter table public.agreements drop constraint if exists agreements_requester_profile_id_fkey;
alter table public.agreements drop constraint if exists agreements_worker_account_id_fkey;
alter table public.agreements drop constraint if exists agreements_worker_profile_id_fkey;

alter table public.agreements alter column requester_account_id drop not null;
alter table public.agreements alter column requester_profile_id drop not null;
alter table public.agreements alter column worker_account_id drop not null;
alter table public.agreements alter column worker_profile_id drop not null;

alter table public.agreements
  add constraint agreements_requester_account_id_fkey
  foreign key (requester_account_id) references auth.users(id) on delete set null;

alter table public.agreements
  add constraint agreements_requester_profile_id_fkey
  foreign key (requester_profile_id) references public.app_profiles(id) on delete set null;

alter table public.agreements
  add constraint agreements_worker_account_id_fkey
  foreign key (worker_account_id) references auth.users(id) on delete set null;

alter table public.agreements
  add constraint agreements_worker_profile_id_fkey
  foreign key (worker_profile_id) references public.app_profiles(id) on delete set null;

