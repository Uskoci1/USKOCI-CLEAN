-- 15b: dopuna needs do FINALNE donor seme.
-- Prvi clean set je kopiran iz rane definicije tabele; sema je kasnije
-- evoluirala i te izmene su kanonski relevantne.

-- HITNO: stanje zivi na Potrebi, ne u zasebnom modelu.
alter table public.needs
  add column if not exists urgent boolean not null default false,
  add column if not exists urgent_activated_at timestamptz,
  add column if not exists urgent_expires_at timestamptz,
  add column if not exists urgent_policy_version text,
  add column if not exists minimum_experience_years integer
    check (minimum_experience_years is null or minimum_experience_years between 0 and 60),
  add column if not exists execution_location_mode text not null default 'STATIONARY';

-- Rezim izvrsenja odredjuje sta radijus uopste znaci.
alter table public.needs drop constraint if exists needs_execution_location_mode_chk;
alter table public.needs add constraint needs_execution_location_mode_chk
  check (execution_location_mode in ('STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED','REMOTE'));

-- Hitnost mora imati rok; bez roka bi bila trajno stanje.
alter table public.needs drop constraint if exists needs_urgent_window_chk;
alter table public.needs add constraint needs_urgent_window_chk
  check (not urgent or (urgent_activated_at is not null and urgent_expires_at is not null
                        and urgent_expires_at > urgent_activated_at));

-- TODAY_FLEXIBLE je neophodan: bez njega HITNO kapija ne prolazi za Potrebu
-- bez tacnog starts_at, a to je najcesci hitan slucaj.
alter table public.needs drop constraint if exists needs_schedule_kind_check;
alter table public.needs add constraint needs_schedule_kind_check
  check (schedule_kind in ('FIXED_WINDOW','FLEXIBLE','REMOTE_ANYTIME',
                           'TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE'));

create index if not exists needs_urgent_open_idx
  on public.needs (urgent_expires_at)
  where urgent and status in ('PUBLISHED','SELECTION');

comment on column public.needs.execution_location_mode is
  'Odredjuje znacenje radijusa: STATIONARY oko tacke, POINT_TO_POINT oko polazista, MULTI_STOP oko prve stanice, AREA_BASED oko centroida, REMOTE bez geografije.';
comment on column public.needs.urgent_expires_at is
  'Hitnost istice sama. Nije trajno stanje.';
