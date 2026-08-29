create table if not exists public.marketplace_responses (
  id uuid primary key default extensions.gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  worker_account_id uuid not null references auth.users(id) on delete restrict,
  worker_profile_id uuid not null references public.app_profiles(id) on delete restrict,
  response_kind text not null check (response_kind in ('APPLICATION','OFFER')),
  status text not null check (status in
    ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED','NOT_SELECTED','WITHDRAWN','EXPIRED','STALE')),
  submitted_against_need_revision integer not null check (submitted_against_need_revision >= 1),
  current_version integer not null default 1 check (current_version >= 1),
  covered_slots integer not null default 1 check (covered_slots between 1 and 50),
  price_rsd integer not null check (price_rsd > 0),
  proposed_start_at timestamptz,
  proposed_end_at timestamptz,
  scope_note text not null default '',
  bounded_message text not null default '' check (char_length(bounded_message) <= 1000),
  submitted_at timestamptz,
  viewed_at timestamptz,
  selected_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check ((proposed_start_at is null and proposed_end_at is null)
      or (proposed_start_at is not null and proposed_end_at is not null and proposed_start_at < proposed_end_at))
);

create unique index if not exists marketplace_responses_one_live_per_worker_need
  on public.marketplace_responses (need_id, worker_account_id)
  where status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED');

create index if not exists marketplace_responses_need_idx
  on public.marketplace_responses (need_id, status, created_at desc);

create table if not exists public.marketplace_response_versions (
  response_id uuid not null references public.marketplace_responses(id) on delete cascade,
  version integer not null check (version >= 1),
  need_revision integer not null check (need_revision >= 1),
  price_rsd integer not null check (price_rsd > 0),
  covered_slots integer not null check (covered_slots between 1 and 50),
  proposed_start_at timestamptz,
  proposed_end_at timestamptz,
  scope_note text not null default '',
  content_hash text not null check (char_length(content_hash) >= 16),
  created_at timestamptz not null default statement_timestamp(),
  primary key (response_id, version)
);

comment on column public.marketplace_responses.submitted_against_need_revision is
  'M02: na koju reviziju Potrebe se prijava odnosi. Bez toga izbor nije atomski.';
comment on column public.marketplace_response_versions.content_hash is
  'M02: izbor se vezuje za tacan hash uslova te verzije.';