-- 16b: ispravka migracije 16 pre nego sto bilo sta zavisi od nje.
--
-- Dve greske u 16, obe potvrdjene protiv FINALNE donor semantike:
--  (1) PostGIS je otisao u public. Donor ga schema-kvalifikuje kao extensions.ST_*.
--  (2) Radnicka geografija je bila na app_profiles u numeric(9,6) — puna preciznost
--      na redu profila. Donor je drzi na worker_match_preferences u numeric(6,2)/(7,2),
--      isto grubo kao Potrebu. Puna preciznost bi bila kucna adresa radnika.

drop index if exists public.app_profiles_base_geog_idx;
drop index if exists public.needs_approx_geog_idx;
alter table public.app_profiles
  drop column if exists base_geog,
  drop column if exists base_lat,
  drop column if exists base_lng;
alter table public.needs drop column if exists approx_geog;

drop extension if exists postgis cascade;
create schema if not exists extensions;
create extension postgis with schema extensions;

alter table public.needs
  add column approx_geog extensions.geography(Point,4326)
  generated always as (
    case when approximate_lat is not null and approximate_lng is not null
      then extensions.ST_SetSRID(
             extensions.ST_MakePoint(approximate_lng::double precision, approximate_lat::double precision),
             4326)::extensions.geography
    end
  ) stored;

create index needs_approx_geog_idx
  on public.needs using gist (approx_geog)
  where status = 'PUBLISHED';

-- Vlasnik radnickih matching preferenci. Donorova finalna forma, RSD varijanta.
create table public.worker_match_preferences (
  worker_profile_id uuid primary key references public.app_profiles(id) on delete cascade,
  worker_account_id uuid not null references auth.users(id) on delete cascade,
  timezone text not null default 'Europe/Belgrade',
  approximate_lat numeric(6,2),
  approximate_lng numeric(7,2),
  approximate_geog extensions.geography(Point,4326)
    generated always as (
      case when approximate_lat is not null and approximate_lng is not null
        then extensions.ST_SetSRID(
               extensions.ST_MakePoint(approximate_lng::double precision, approximate_lat::double precision),
               4326)::extensions.geography
      end
    ) stored,
  proactive_notifications boolean not null default true,
  same_day_urgent_notifications boolean not null default true,
  buffer_minutes integer not null default 30 check (buffer_minutes between 0 and 180),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint wmp_lat_chk check (approximate_lat is null or approximate_lat between -90 and 90),
  constraint wmp_lng_chk check (approximate_lng is null or approximate_lng between -180 and 180)
);

create index worker_match_preferences_geog_idx
  on public.worker_match_preferences using gist (approximate_geog)
  where approximate_geog is not null;

alter table public.worker_match_preferences enable row level security;

create policy wmp_own_select on public.worker_match_preferences
  for select to authenticated using (worker_account_id = auth.uid());
create policy wmp_own_insert on public.worker_match_preferences
  for insert to authenticated with check (
    worker_account_id = auth.uid()
    and exists (select 1 from public.app_profiles p
                where p.id = worker_profile_id and p.account_id = auth.uid() and p.kind = 'WORKER')
  );
create policy wmp_own_update on public.worker_match_preferences
  for update to authenticated using (worker_account_id = auth.uid())
  with check (worker_account_id = auth.uid());

create trigger wmp_updated_at before update on public.worker_match_preferences
  for each row execute function private.set_updated_at();

comment on table public.worker_match_preferences is
  'Vlasnik radnicke geografije i notifikacionih preferenci za dispatch. Koordinate su NAMERNO grube (~1km), isto kao kod Potrebe. Vidljivo samo vlasniku.';
