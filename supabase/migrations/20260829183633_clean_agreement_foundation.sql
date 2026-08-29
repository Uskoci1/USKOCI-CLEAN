-- Dve namerne razlike u odnosu na donor:
-- 1) status NEMA AWAITING_CONFIRMATIONS (M02/M10: nema trece potvrde)
-- 2) tabela agreement_confirmations se NE kreira (postojala je samo za nju)

create table if not exists public.agreements (
  id uuid primary key default extensions.gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete restrict,
  selection_id uuid not null unique references public.need_selections(id) on delete restrict,
  selected_response_id uuid not null unique references public.marketplace_responses(id) on delete restrict,
  requester_account_id uuid not null references auth.users(id) on delete restrict,
  requester_profile_id uuid not null references public.app_profiles(id) on delete restrict,
  worker_account_id uuid not null references auth.users(id) on delete restrict,
  worker_profile_id uuid not null references public.app_profiles(id) on delete restrict,
  current_version integer not null default 1 check (current_version >= 1),
  status text not null default 'CONFIRMED'
    check (status in ('CONFIRMED','SUPERSEDED','CANCELLED','COMPLETED')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index if not exists agreements_requester_idx on public.agreements (requester_account_id, created_at desc);
create index if not exists agreements_worker_idx on public.agreements (worker_account_id, created_at desc);

create table if not exists public.agreement_versions (
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  version integer not null check (version >= 1),
  status text not null check (status in ('CONFIRMED','SUPERSEDED','CANCELLED')),
  terms jsonb not null,
  content_hash text not null check (char_length(content_hash) >= 16),
  supersedes_version integer,
  created_by_account_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key (agreement_id, version),
  check (supersedes_version is null or supersedes_version < version)
);

create table if not exists public.agreement_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  agreement_version integer not null check (agreement_version >= 1),
  sender_account_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default statement_timestamp(),
  read_at timestamptz
);

create index if not exists agreement_messages_agreement_idx
  on public.agreement_messages (agreement_id, created_at);

create table if not exists public.agreement_execution (
  agreement_id uuid primary key references public.agreements(id) on delete cascade,
  agreement_version integer not null check (agreement_version >= 1),
  mode text not null default 'PHYSICAL'
    check (mode in ('PHYSICAL','REMOTE','PICKUP_DELIVERY')),
  state text not null default 'CONFIRMED'
    check (state in ('CONFIRMED','AWAITING_REQUESTER','COMPLETED','CANCELLED')),
  worker_marked_done_at timestamptz,
  requester_deadline_at timestamptz,
  problem_opened_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  check (state <> 'AWAITING_REQUESTER' or requester_deadline_at is not null)
);

create index if not exists agreement_execution_due_idx
  on public.agreement_execution (requester_deadline_at)
  where state = 'AWAITING_REQUESTER' and problem_opened_at is null;

comment on table public.agreement_execution is
  'M07: bez merdevina Krenuo/Stigao. Prozor drzi server, ne telefon.';