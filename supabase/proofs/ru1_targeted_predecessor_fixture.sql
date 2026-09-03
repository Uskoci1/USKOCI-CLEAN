-- Disposable RU-1 predecessor fixture.
-- Mirrors only the live Worker-readiness authority surface verified read-only
-- at 57 / 20260903160812. Proof-only; never a production migration.
\set ON_ERROR_STOP on

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public authorization postgres;
create schema private authorization postgres;
grant usage on schema public to anon, authenticated, service_role;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text, created_by text,
  idempotency_key text unique, rollback text[]
);
truncate table supabase_migrations.schema_migrations;
do $ledger$ declare i integer; begin
  for i in 1..56 loop
    insert into supabase_migrations.schema_migrations(version,name)
    values ('202608' || to_char(i,'FM00000000'), 'ru1_fixture_' || i);
  end loop;
  insert into supabase_migrations.schema_migrations(version,name)
  values ('20260903160812','clean_ru0_authority_closure');
end $ledger$;

create table public.app_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, full_name text not null default '', city text not null default '',
  phone text not null default '', active_mode text not null default 'requester',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.app_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  kind text not null, display_name text not null default '', city text not null default '',
  headline text not null default '', bio text not null default '', avatar_path text,
  account_type text not null default 'INDIVIDUAL', profile_status text not null default 'ACTIVE',
  years_experience integer not null default 0, portfolio jsonb not null default '[]'::jsonb,
  skills text[] not null default array[]::text[], radius_km integer not null default 15,
  available_now boolean not null default false, team_capacity integer not null default 1,
  tools text[] not null default array[]::text[], licenses text[] not null default array[]::text[],
  vehicles text[] not null default array[]::text[], exclusions text[] not null default array[]::text[],
  minimum_fee_rsd integer not null default 0, rating_requester numeric, rating_worker numeric,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  available_now_expires_at timestamptz,
  constraint app_profiles_account_id_kind_key unique(account_id,kind),
  constraint app_profiles_kind_check check (kind = any(array['REQUESTER'::text,'WORKER'::text])),
  constraint app_profiles_status_check check (profile_status = any(array['DRAFT'::text,'ACTIVE'::text,'SUSPENDED'::text,'CLOSED'::text])),
  constraint app_profiles_account_type_check check (account_type = any(array['INDIVIDUAL'::text,'TEAM'::text,'COMPANY'::text])),
  constraint app_profiles_years_check check (years_experience >= 0 and years_experience <= 80),
  constraint app_profiles_radius_check check (radius_km >= 1 and radius_km <= 200),
  constraint app_profiles_capacity_check check (team_capacity >= 1 and team_capacity <= 50),
  constraint app_profiles_minimum_fee_check check (minimum_fee_rsd >= 0 and minimum_fee_rsd <= 10000000)
);
alter table public.app_profiles enable row level security;
create policy app_profiles_select_own on public.app_profiles for select to authenticated using ((select auth.uid()) = account_id);
create policy app_profiles_insert_own on public.app_profiles for insert to authenticated with check ((select auth.uid()) = account_id);
create policy app_profiles_update_own on public.app_profiles for update to authenticated using ((select auth.uid()) = account_id) with check ((select auth.uid()) = account_id);
grant select,insert,update,delete on table public.app_profiles to anon, authenticated, service_role;

create or replace function public.metadata_text_array(value jsonb) returns text[] language sql immutable set search_path to '' as $function$
  select coalesce(array_agg(item), array[]::text[])
  from jsonb_array_elements_text(case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end) as item;
$function$;

create or replace function private.guard_profile_write() returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $function$
declare token text := current_setting('uskoci.profile_mutation', true); begin
  if tg_op = 'INSERT' then
    new.profile_status := 'ACTIVE'; new.account_type := 'INDIVIDUAL'; new.rating_requester := null; new.rating_worker := null; return new;
  end if;
  if token is null then
    if new.profile_status is distinct from old.profile_status then raise exception using errcode='42501', message='PROFILE_STATUS_IS_SERVER_DERIVED'; end if;
    if new.account_type is distinct from old.account_type then raise exception using errcode='42501', message='ACCOUNT_TYPE_IS_SERVER_DERIVED'; end if;
    if new.rating_requester is distinct from old.rating_requester then raise exception using errcode='42501', message='RATING_REQUESTER_IS_SERVER_DERIVED'; end if;
    if new.rating_worker is distinct from old.rating_worker then raise exception using errcode='42501', message='RATING_WORKER_IS_SERVER_DERIVED'; end if;
  end if; return new;
end; $function$;
revoke all on function private.guard_profile_write() from public, anon, authenticated, service_role;
create trigger guard_profile_write_trg before insert or update on public.app_profiles for each row execute function private.guard_profile_write();

create or replace function public.rpc_complete_worker_profile(p_profile_id uuid) returns void language plpgsql security definer set search_path to 'pg_catalog' as $function$
declare v_uid uuid := auth.uid(); v_profile public.app_profiles%rowtype; begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into v_profile from public.app_profiles where id=p_profile_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;
  if v_profile.account_id<>v_uid or v_profile.kind<>'WORKER' then raise exception 'NOT_WORKER_PROFILE_OWNER' using errcode='42501'; end if;
  if v_profile.profile_status='SUSPENDED' then raise exception 'PROFILE_SUSPENDED' using errcode='P0001'; end if;
  if char_length(btrim(v_profile.display_name))<2 then raise exception 'DISPLAY_NAME_REQUIRED' using errcode='P0001'; end if;
  if char_length(btrim(v_profile.city))<2 then raise exception 'CITY_REQUIRED' using errcode='P0001'; end if;
  if cardinality(v_profile.skills)<1 then raise exception 'SKILL_REQUIRED' using errcode='P0001'; end if;
  update public.app_profiles set profile_status='ACTIVE' where id=p_profile_id;
end; $function$;
revoke all on function public.rpc_complete_worker_profile(uuid) from public, anon, authenticated, service_role;
grant execute on function public.rpc_complete_worker_profile(uuid) to authenticated, service_role;

create or replace function public.handle_uskoci_auth_user_created() returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  profile_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(coalesce(new.email,''), '@', 1), 'USKOČI korisnik');
  profile_city text := coalesce(nullif(trim(new.raw_user_meta_data->>'city'), ''), 'Novi Sad');
  profile_phone text := coalesce(nullif(trim(new.phone), ''), nullif(trim(new.raw_user_meta_data->>'phone'), ''), '');
  initial_mode text := case when new.raw_user_meta_data->>'mode' = 'worker' then 'worker' else 'requester' end;
  initial_skills text[] := public.metadata_text_array(new.raw_user_meta_data->'skills');
begin
  insert into public.app_accounts(id,email,full_name,city,phone,active_mode,onboarding_complete)
  values(new.id,coalesce(new.email,''),profile_name,profile_city,profile_phone,initial_mode,false);
  insert into public.app_profiles(account_id,kind,display_name,city,headline,bio,radius_km,available_now)
  values(new.id,'REQUESTER',profile_name,profile_city,'Tražim pouzdanu pomoć uz jasan dogovor.','Novi član USKOČI zajednice.',10,false);
  insert into public.app_profiles(account_id,kind,display_name,city,headline,bio,skills,radius_km,available_now)
  values(new.id,'WORKER',profile_name,profile_city,'Spreman da uskočim kada se dogovor jasno postavi.','Dostupan za poslove koji odgovaraju profilu i kalendaru.',initial_skills,15,false);
  return new;
end; $function$;
create trigger on_uskoci_auth_user_created after insert on auth.users for each row execute function public.handle_uskoci_auth_user_created();

do $seed_existing$ declare u uuid := extensions.gen_random_uuid(); begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values (u,'authenticated','authenticated','ru1-existing-'||u::text||'@fixture.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Existing Worker','city','Novi Sad','skills','[]'::jsonb),statement_timestamp(),statement_timestamp());
  if not exists (select 1 from public.app_profiles where account_id=u and kind='WORKER' and profile_status='ACTIVE') then raise exception 'RU1_FIXTURE_EXISTING_WORKER_NOT_ACTIVE'; end if;
end $seed_existing$;

do $fixture_assert$ begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 57 or (select max(version) from supabase_migrations.schema_migrations) <> '20260903160812' then raise exception 'RU1_FIXTURE_FAILED: migration ledger'; end if;
end $fixture_assert$;
