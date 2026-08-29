-- G1: dogadjaji i notifikacije.
-- Kanonski tok: domenski dogadjaj -> durable event -> delivery -> preference
--               -> push attempt -> provider -> rezultat.
-- Dispatch NIKAD ne sme da ima razbacanu push logiku; on samo emituje dogadjaj.
--
-- Registar dogadjaja je donorov finalni skup MINUS AGREEMENT_CONFIRMATION_REQUIRED,
-- koji je penzionisan sa M02/M10 (nema trece potvrde).

create table if not exists public.user_activity_events (
  id uuid primary key default extensions.gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('REQUESTER','WORKER')),
  event_type text not null check (event_type in (
    'OPPORTUNITY_AVAILABLE',
    'RESPONSE_RECEIVED','RESPONSE_UPDATED','RESPONSE_VIEWED','RESPONSE_SHORTLISTED',
    'RESPONSE_SELECTED','RESPONSE_NOT_SELECTED','RESPONSE_STALE','RESPONSE_WITHDRAWN',
    'RESPONSE_EXPIRED',
    'NEED_REVISED','NEED_CANCELLED',
    'AGREEMENT_VERSION_CHANGED','AGREEMENT_CHANGE_PROPOSED','AGREEMENT_CHANGE_REJECTED',
    'EXECUTION_STATE_CHANGED','COMPLETION_REQUIRED',
    'MESSAGE_RECEIVED','PRIVATE_ACCESS_GRANTED',
    'RECOVERY_OPENED','REVIEW_RECEIVED'
  )),
  entity_type text not null check (entity_type in ('NEED','RESPONSE','AGREEMENT')),
  entity_id uuid not null,
  entity_version integer,
  urgency text not null default 'NORMAL' check (urgency in ('NORMAL','HITNO')),
  payload jsonb not null default '{}',
  -- Idempotencija. Kod nosi reviziju, pa materijalna izmena legitimno pravi nov dogadjaj.
  dedupe_key text not null unique,
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists activity_recipient_idx
  on public.user_activity_events (recipient_user_id, recipient_role, created_at desc);

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_context text not null check (role_context in ('REQUESTER','WORKER')),
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default false,
  opportunities_enabled boolean not null default true,
  responses_enabled boolean not null default true,
  dogovor_enabled boolean not null default true,
  execution_enabled boolean not null default true,
  recovery_enabled boolean not null default true,
  account_enabled boolean not null default true,
  -- Tihi sati postoje u donoru; prenose se kakvi jesu.
  quiet_hours_enabled boolean not null default false,
  quiet_start time without time zone,
  quiet_end time without time zone,
  quiet_timezone text not null default 'Europe/Belgrade',
  -- NOVO: HITNO NE zaobilazi tihe sate osim ako korisnik to izricito ukljuci.
  urgent_overrides_quiet_hours boolean not null default false,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (user_id, role_context)
);

comment on column public.notification_preferences.urgent_overrides_quiet_hours is
  'Podrazumevano false. HITNO postuje tihe sate dok korisnik izricito ne ukljuci.';

create table if not exists public.notification_push_devices (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('IOS','ANDROID','WEB')),
  active boolean not null default true,
  last_seen_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (user_id, expo_push_token)
);

create index if not exists push_devices_user_idx
  on public.notification_push_devices (user_id) where active;

create table if not exists public.notification_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.user_activity_events(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('REQUESTER','WORKER')),
  channel text not null check (channel in ('IN_APP','PUSH')),
  -- HITNO ima visi prioritet, ali to ne znaci zaobilazenje preference.
  priority text not null default 'NORMAL' check (priority in ('NORMAL','HIGH')),
  state text not null check (state in
    ('CREATED','QUEUED','SENT','DELIVERED','FAILED_RETRYABLE','FAILED_FINAL','EXPIRED','READ','SUPPRESSED')),
  suppression_reason text,
  title text not null,
  body text not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default statement_timestamp(),
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  expires_at timestamptz,
  check (state <> 'SUPPRESSED' or suppression_reason is not null)
);

create index if not exists notification_recipient_idx
  on public.notification_deliveries (recipient_user_id, recipient_role, state, created_at desc);

create index if not exists notification_queue_idx
  on public.notification_deliveries (state, priority, created_at)
  where state in ('CREATED','QUEUED','FAILED_RETRYABLE');

create table if not exists public.notification_push_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  delivery_id uuid not null references public.notification_deliveries(id) on delete cascade,
  device_id uuid references public.notification_push_devices(id) on delete set null,
  attempt_no integer not null check (attempt_no >= 1),
  provider text not null default 'EXPO_PUSH',
  provider_ticket_id text,
  outcome text not null check (outcome in ('QUEUED','OK','RETRYABLE','FATAL')),
  error_code text,
  created_at timestamptz not null default statement_timestamp(),
  unique (delivery_id, attempt_no)
);

-- RLS: korisnik vidi samo svoje.
alter table public.user_activity_events    enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries  enable row level security;
alter table public.notification_push_devices enable row level security;
alter table public.notification_push_attempts enable row level security;

create policy events_own on public.user_activity_events
  for select to authenticated using (recipient_user_id = auth.uid());

create policy prefs_own on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy deliveries_own on public.notification_deliveries
  for select to authenticated using (recipient_user_id = auth.uid());

create policy deliveries_mark_read on public.notification_deliveries
  for update to authenticated
  using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

create policy push_devices_own on public.notification_push_devices
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pokusaji slanja su interni; korisnik ih ne vidi.
create policy push_attempts_none on public.notification_push_attempts
  for select to authenticated using (false);
