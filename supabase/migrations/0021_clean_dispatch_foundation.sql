-- 17a: tabele, konfiguracija i indeksi za isporuku prilika.
-- Donorov finalni oblik (r24 + P1), RSD varijanta, plus dva polja za dokazivost budzeta.

alter table public.needs
  add column if not exists required_licenses text[] not null default '{}';

create schema if not exists private;

create table if not exists private.marketplace_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default statement_timestamp()
);
alter table private.marketplace_config enable row level security;
-- Namerno bez politika: konfiguraciju cita samo service_role kroz SECURITY DEFINER.

create table public.dispatch_rounds (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  need_revision integer not null,
  round_no integer not null check (round_no >= 1),
  urgency text not null check (urgency in ('NORMAL','URGENT')),
  batch_size integer not null check (batch_size > 0),
  target_responses integer not null check (target_responses > 0),
  -- Dodato u odnosu na donora: bez ovoga se ne moze dokazati koji je budzet vazio.
  candidate_limit_used integer not null check (candidate_limit_used between 1 and 10000),
  budget_source text not null default 'FIXED'
    check (budget_source in ('FIXED','ADAPTIVE_FLOOR','ADAPTIVE_COMPUTED','ADAPTIVE_CAPPED')),
  status text not null default 'SENT' check (status in ('PLANNED','SENT','STOPPED','EXPIRED')),
  stop_reason text,
  deadline_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint dispatch_rounds_need_round_uq unique (need_id, need_revision, round_no)
);

create table public.opportunity_deliveries (
  id uuid primary key default gen_random_uuid(),
  worker_account_id uuid not null references auth.users(id) on delete cascade,
  worker_profile_id uuid not null references public.app_profiles(id) on delete cascade,
  need_id uuid not null references public.needs(id) on delete cascade,
  need_revision integer not null,
  dispatch_round_id uuid references public.dispatch_rounds(id) on delete set null,
  match_score numeric(6,2) not null default 0,
  score_components jsonb not null default '{}',
  reason_codes text[] not null default '{}',
  status text not null default 'READY'
    check (status in ('READY','SEEN','DECLINED','RESPONDED','EXPIRED')),
  expires_at timestamptz,
  seen_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  -- Jedina odbrana od duplog delivery-ja/push-a.
  constraint opportunity_deliveries_once_per_revision_uq
    unique (worker_account_id, need_id, need_revision)
);

create index dispatch_rounds_need_idx
  on public.dispatch_rounds (need_id, need_revision, round_no desc);
create index dispatch_rounds_open_deadline_idx
  on public.dispatch_rounds (deadline_at)
  where status = 'SENT';

create index opportunity_deliveries_worker_inbox_idx
  on public.opportunity_deliveries (worker_account_id, status, created_at desc);
create index opportunity_deliveries_need_idx
  on public.opportunity_deliveries (need_id, need_revision);
create index opportunity_deliveries_expiry_idx
  on public.opportunity_deliveries (expires_at)
  where status in ('READY','SEEN');

alter table public.dispatch_rounds enable row level security;
alter table public.opportunity_deliveries enable row level security;

-- dispatch_rounds: namerno bez politika. Motorna evidencija, ne korisnicka projekcija.
create policy od_worker_select on public.opportunity_deliveries
  for select to authenticated using (worker_account_id = auth.uid());

create trigger od_updated_at before update on public.opportunity_deliveries
  for each row execute function private.set_updated_at();

insert into private.marketplace_config (key, value) values
('dispatch_normal', jsonb_build_object(
  'waveSizes', jsonb_build_array(5,5,10,20),
  'candidateLimit', 40,
  'targetResponses', 3,
  'windowMinutes', 15,
  'fallbackToFixedWaves', true,
  'candidateBudget', jsonb_build_object(
    'baseLimit', 40,
    'hardMaxLimit', 120,
    'maxRoutingCallsPerWave', 20,
    'avgCoveragePerResponse', 1.3,
    'responseRate', 0.25,
    'safetyFactor', 3.0,
    '_note', 'EXPERIMENTAL_DEFAULT'
  ))),
('dispatch_urgent', jsonb_build_object(
  'waveSizes', jsonb_build_array(10,10,20),
  'candidateLimit', 40,
  'targetResponses', 3,
  'windowMinutes', 3,
  'fallbackToFixedWaves', true,
  'candidateBudget', jsonb_build_object(
    'baseLimit', 40,
    'hardMaxLimit', 120,
    'maxRoutingCallsPerWave', 20,
    'avgCoveragePerResponse', 1.3,
    'responseRate', 0.35,
    'safetyFactor', 3.0,
    '_note', 'EXPERIMENTAL_DEFAULT'
  )))
on conflict (key) do nothing;

comment on column public.dispatch_rounds.budget_source is
  'FIXED = donorov fiksni candidateLimit. ADAPTIVE_* = O-1 budzet: FLOOR pod 40, COMPUTED izracunat, CAPPED odsecen na hardMaxLimit.';
comment on constraint opportunity_deliveries_once_per_revision_uq
  on public.opportunity_deliveries is
  'Jedna isporuka po (radnik, Potreba, revizija). Invarijanta protiv duplog push-a.';
