create table if not exists public.needs (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_account_id uuid not null references auth.users(id) on delete restrict,
  requester_profile_id uuid not null references public.app_profiles(id) on delete restrict,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PUBLISHED','SELECTION','ACTIVE','COMPLETED','CANCELLED','EXPIRED','ARCHIVED')),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  description text not null check (char_length(btrim(description)) between 1 and 6000),
  category text not null check (char_length(btrim(category)) between 1 and 120),
  approximate_city text not null default '',
  approximate_area text not null default '',
  approximate_lat numeric(6,2),
  approximate_lng numeric(7,2),
  schedule_kind text not null default 'FLEXIBLE'
    check (schedule_kind in ('FIXED_WINDOW','FLEXIBLE','REMOTE_ANYTIME')),
  starts_at timestamptz,
  ends_at timestamptz,
  required_slots integer not null default 1 check (required_slots between 1 and 50),
  mode text not null check (mode in ('FASTEST','MY_PRICE','OFFERS')),
  requester_price_rsd integer check (requester_price_rsd is null or requester_price_rsd > 0),
  required_skills text[] not null default '{}',
  required_tools text[] not null default '{}',
  required_vehicles text[] not null default '{}',
  verified_identity_required boolean not null default false,
  urgent boolean not null default false,
  public_photo_paths text[] not null default '{}',
  revision integer not null default 1 check (revision >= 1),
  published_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists needs_requester_idx on public.needs (requester_account_id, created_at desc);
create index if not exists needs_open_idx on public.needs (status, published_at desc) where status = 'PUBLISHED';

create table if not exists public.need_sensitive (
  need_id uuid primary key references public.needs(id) on delete cascade,
  exact_address text not null default '',
  access_notes text not null default '',
  exact_lat numeric(9,6),
  exact_lng numeric(9,6),
  updated_at timestamptz not null default statement_timestamp()
);

create table if not exists public.need_selections (
  id uuid primary key default extensions.gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  need_revision integer not null check (need_revision >= 1),
  selected_by_account_id uuid not null references auth.users(id) on delete restrict,
  client_request_id text not null check (char_length(btrim(client_request_id)) between 8 and 200),
  covered_slots integer not null check (covered_slots between 1 and 50),
  created_at timestamptz not null default statement_timestamp(),
  unique (need_id, client_request_id)
);

comment on column public.needs.revision is 'Izbor se vezuje za tacnu reviziju. Materijalna izmena je dize.';
comment on column public.needs.approximate_lat is 'Namerno gruba geografija. Tacna lokacija je u need_sensitive.';
comment on column public.need_selections.client_request_id is 'Idempotencija: isti zahtev ne sme da napravi dva izbora.';