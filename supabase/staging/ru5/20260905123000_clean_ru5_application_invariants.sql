-- USKOCI RU-5 / P0C-02..04
-- Application integrity candidate. PROOF BRANCH ONLY until disposable runtime proof is green.
-- Reconciled against live-71 / 20260905070046. No historical ApplicationVersion is rewritten.

begin;

alter table public.marketplace_response_versions
  add column if not exists snapshot_schema text,
  add column if not exists worker_context_snapshot jsonb,
  add column if not exists snapshot_hash text;

alter table public.marketplace_response_versions
  drop constraint if exists marketplace_response_versions_ru5_snapshot_check;

alter table public.marketplace_response_versions
  add constraint marketplace_response_versions_ru5_snapshot_check
  check (
    (snapshot_schema is null and worker_context_snapshot is null and snapshot_hash is null)
    or
    (
      snapshot_schema = 'RU5_WORKER_CONTEXT_V1'
      and jsonb_typeof(worker_context_snapshot) = 'object'
      and snapshot_hash ~ '^[0-9a-f]{64}$'
    )
  );

create or replace function private.ru5_text_intersection(
  p_left text[],
  p_right text[]
)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(array_agg(v order by v), '{}'::text[])
  from (
    select distinct x as v
    from unnest(coalesce(p_left, '{}'::text[])) as x
    where x = any(coalesce(p_right, '{}'::text[]))
  ) s;
$function$;

revoke all on function private.ru5_text_intersection(text[],text[])
  from public, anon, authenticated, service_role;

create or replace function private.ru5_validate_preselection_note(p_note text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_note text := btrim(coalesce(p_note, ''));
begin
  if char_length(v_note) > 1000 then
    raise exception 'PRESELECTION_NOTE_TOO_LONG'
      using errcode = '22023', detail = 'max_chars=1000';
  end if;

  if v_note = '' then
    return '';
  end if;

  -- Email address.
  if v_note ~* '[[:alnum:]._%+\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}' then
    raise exception 'PRESELECTION_NOTE_BLOCKED'
      using errcode = '22023', detail = 'EMAIL';
  end if;

  -- URL / web destination. The generic domain branch is intentionally limited
  -- to common public suffixes to avoid classifying ordinary dotted prose as URL.
  if v_note ~* '(https?://|www\.|[[:alnum:]_-]+\.(com|rs|net|org|io|me|co|info|biz)(/|[[:space:]]|$))' then
    raise exception 'PRESELECTION_NOTE_BLOCKED'
      using errcode = '22023', detail = 'URL';
  end if;

  -- Social handle.
  if v_note ~* '(^|[[:space:]])@[[:alnum:]_.]{3,}' then
    raise exception 'PRESELECTION_NOTE_BLOCKED'
      using errcode = '22023', detail = 'SOCIAL_HANDLE';
  end if;

  -- Phone/contact number: Serbian local/mobile prefixes, international +/00,
  -- or an explicit contact-app label followed by digits. This avoids treating
  -- ordinary dates or prices as phone numbers.
  if v_note ~* '((\+|00)[0-9][0-9 ()/\.\-]{6,}[0-9])'
     or v_note ~* '(^|[^0-9])0(6[0-9]|1[0-9]|2[0-9]|3[0-9])[ ()/\.\-]*[0-9][0-9 ()/\.\-]{4,}[0-9]([^0-9]|$)'
     or v_note ~* '\m(telefon|tel|viber|whatsapp|telegram)\M.{0,24}[0-9]' then
    raise exception 'PRESELECTION_NOTE_BLOCKED'
      using errcode = '22023', detail = 'PHONE';
  end if;

  -- Payment instructions / external payment rails. Generic discussion of price
  -- remains allowed; actionable payment destinations are not.
  if v_note ~* '\m(iban|swift|paypal|payoneer|revolut)\M'
     or v_note ~* '\m(broj[[:space:]]+računa|broj[[:space:]]+racuna)\M'
     or v_note ~* '\m(uplati|uplatite|pošalji[[:space:]]+novac|posalji[[:space:]]+novac|pošaljite[[:space:]]+novac|posaljite[[:space:]]+novac)\M.{0,24}\m(na|račun|racun|kartic)\M' then
    raise exception 'PRESELECTION_NOTE_BLOCKED'
      using errcode = '22023', detail = 'PAYMENT_INSTRUCTIONS';
  end if;

  -- Recognizable exact private street-address forms. Coarse city/area remains
  -- a structured Need/Profile fact; exact address belongs behind Dogovor grant.
  if v_note ~* '\m(ulica|ul\.?|bulevar|bul\.?|trg|avenija|av\.?)\M.{1,80}[0-9]{1,4}[[:alpha:]]?' then
    raise exception 'PRESELECTION_NOTE_BLOCKED'
      using errcode = '22023', detail = 'EXACT_ADDRESS';
  end if;

  return v_note;
end;
$function$;

revoke all on function private.ru5_validate_preselection_note(text)
  from public, anon, authenticated, service_role;

create or replace function private.ru5_guard_application_terms()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_need public.needs%rowtype;
  v_profile public.app_profiles%rowtype;
  v_remaining integer;
begin
  select * into v_need
  from public.needs
  where id = new.need_id;

  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_profile
  from public.app_profiles
  where id = new.worker_profile_id;

  if not found or v_profile.kind <> 'WORKER' then
    raise exception 'WORKER_PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if new.covered_slots is null or new.covered_slots < 1 then
    raise exception 'INVALID_COVERED_SLOTS' using errcode = '22023';
  end if;

  if new.covered_slots > v_profile.team_capacity then
    raise exception 'TEAM_CAPACITY_EXCEEDED'
      using errcode = '22023',
            detail = format('covered=%s team_capacity=%s', new.covered_slots, v_profile.team_capacity);
  end if;

  v_remaining := greatest(v_need.required_slots - public.fn_need_covered_slots(v_need.id), 0);
  if v_remaining < 1 then
    raise exception 'NEED_FULL' using errcode = 'P0001';
  end if;

  if new.covered_slots > v_remaining then
    raise exception 'COVERED_SLOTS_EXCEED_REMAINING'
      using errcode = '22023',
            detail = format('covered=%s remaining=%s', new.covered_slots, v_remaining);
  end if;

  if new.price_rsd is null or new.price_rsd <= 0 then
    raise exception 'INVALID_PRICE' using errcode = '22023';
  end if;

  if v_need.mode = 'MY_PRICE' then
    if v_need.requester_price_rsd is null then
      raise exception 'FIXED_PRICE_AMOUNT_MISSING' using errcode = '55000';
    end if;
    if new.price_rsd <> v_need.requester_price_rsd then
      raise exception 'FIXED_PRICE_MISMATCH'
        using errcode = '22023',
              detail = format('expected=%s actual=%s', v_need.requester_price_rsd, new.price_rsd);
    end if;
  end if;

  new.scope_note := private.ru5_validate_preselection_note(new.scope_note);
  return new;
end;
$function$;

revoke all on function private.ru5_guard_application_terms()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_ru5_guard_application_terms on public.marketplace_responses;
create trigger trg_ru5_guard_application_terms
before insert or update of need_id, worker_profile_id, covered_slots, price_rsd, scope_note
on public.marketplace_responses
for each row
execute function private.ru5_guard_application_terms();

create or replace function private.ru5_freeze_application_worker_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_response public.marketplace_responses%rowtype;
  v_need public.needs%rowtype;
  v_profile public.app_profiles%rowtype;
  v_snapshot jsonb;
begin
  select * into v_response
  from public.marketplace_responses
  where id = new.response_id;

  if not found then
    raise exception 'RESPONSE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_need
  from public.needs
  where id = v_response.need_id;

  if not found then
    raise exception 'NEED_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_profile
  from public.app_profiles
  where id = v_response.worker_profile_id;

  if not found or v_profile.kind <> 'WORKER' then
    raise exception 'WORKER_PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  new.scope_note := private.ru5_validate_preselection_note(new.scope_note);

  v_snapshot := jsonb_build_object(
    'profileId', v_profile.id,
    'displayName', nullif(btrim(v_profile.display_name), ''),
    'city', nullif(btrim(v_profile.city), ''),
    'profileStatusAtSubmit', v_profile.profile_status,
    'teamCapacityAtSubmit', v_profile.team_capacity,
    'coveredSlots', new.covered_slots,
    'matchedSkills', private.ru5_text_intersection(v_profile.skills, v_need.required_skills),
    'matchedTools', private.ru5_text_intersection(v_profile.tools, v_need.required_tools),
    'matchedLicenses', private.ru5_text_intersection(v_profile.licenses, v_need.required_licenses),
    'matchedVehicles', private.ru5_text_intersection(v_profile.vehicles, v_need.required_vehicles),
    'yearsExperienceAtSubmit',
      case
        when coalesce(v_need.minimum_experience_years, 0) > 0 then v_profile.years_experience
        else null
      end
  );

  new.snapshot_schema := 'RU5_WORKER_CONTEXT_V1';
  new.worker_context_snapshot := v_snapshot;
  new.snapshot_hash := encode(digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');
  return new;
end;
$function$;

revoke all on function private.ru5_freeze_application_worker_context()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_ru5_freeze_application_worker_context on public.marketplace_response_versions;
create trigger trg_ru5_freeze_application_worker_context
before insert on public.marketplace_response_versions
for each row
execute function private.ru5_freeze_application_worker_context();

create or replace function private.ru5_guard_application_snapshot_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if old.snapshot_schema is not null
     and (
       new.snapshot_schema is distinct from old.snapshot_schema
       or new.worker_context_snapshot is distinct from old.worker_context_snapshot
       or new.snapshot_hash is distinct from old.snapshot_hash
     ) then
    raise exception 'APPLICATION_WORKER_SNAPSHOT_IMMUTABLE'
      using errcode = '55000';
  end if;
  return new;
end;
$function$;

revoke all on function private.ru5_guard_application_snapshot_immutable()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_ru5_guard_application_snapshot_immutable on public.marketplace_response_versions;
create trigger trg_ru5_guard_application_snapshot_immutable
before update of snapshot_schema, worker_context_snapshot, snapshot_hash
on public.marketplace_response_versions
for each row
execute function private.ru5_guard_application_snapshot_immutable();

comment on column public.marketplace_response_versions.snapshot_schema is
  'RU-5 immutable Worker-context snapshot schema. NULL means LEGACY_UNPROVEN; never backfill unverifiable history.';
comment on column public.marketplace_response_versions.worker_context_snapshot is
  'RU-5 public-safe task-relevant Worker context frozen when this Application version is inserted.';
comment on column public.marketplace_response_versions.snapshot_hash is
  'SHA-256 of canonical jsonb text for RU-5 Worker-context snapshot.';

commit;
