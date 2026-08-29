-- 16: PostGIS temelj za bounded KNN pretragu.
--
-- Kljucno pravilo privatnosti: javna geometrija se izvodi iz VEC GRUBIH
-- approximate_lat/lng (numeric(6,2)/(7,2), ~1km rezolucija). Tacna lokacija iz
-- need_sensitive NIKAD ne ulazi u ovaj indeks — inace bi KNN curio adresu.

create extension if not exists postgis;

-- Radnicka bazna tacka i svezina dostupnosti.
-- available_now_expires_at je referenciran u donorovom jeftinom filteru, a
-- nedostajao je u clean semi.
alter table public.app_profiles
  add column if not exists base_lat numeric(9,6),
  add column if not exists base_lng numeric(9,6),
  add column if not exists available_now_expires_at timestamptz;

-- Generisana geografija: ne moze da se razidje sa izvornim kolonama.
alter table public.app_profiles
  add column if not exists base_geog geography(Point,4326)
  generated always as (
    case when base_lat is not null and base_lng is not null
      then ST_SetSRID(ST_MakePoint(base_lng::double precision, base_lat::double precision), 4326)::geography
    end
  ) stored;

alter table public.needs
  add column if not exists approx_geog geography(Point,4326)
  generated always as (
    case when approximate_lat is not null and approximate_lng is not null
      then ST_SetSRID(ST_MakePoint(approximate_lng::double precision, approximate_lat::double precision), 4326)::geography
    end
  ) stored;

-- GiST indeksi nose KNN. Bez njih bi pretraga bila sekvencijalna.
create index if not exists app_profiles_base_geog_idx
  on public.app_profiles using gist (base_geog)
  where profile_status = 'ACTIVE' and kind = 'WORKER';

create index if not exists needs_approx_geog_idx
  on public.needs using gist (approx_geog)
  where status = 'PUBLISHED';

-- Jeftini filter gadja ove kolone; indeks ih drzi jeftinim.
create index if not exists app_profiles_available_idx
  on public.app_profiles (available_now, available_now_expires_at)
  where kind = 'WORKER' and profile_status = 'ACTIVE';

comment on column public.needs.approx_geog is
  'Izvedeno iz GRUBIH approximate_lat/lng. Tacna lokacija iz need_sensitive nikad ne ulazi ovde.';
comment on column public.app_profiles.available_now_expires_at is
  'Svezina dostupnosti. Jeftini filter odbacuje istekle bez deep matcha.';
