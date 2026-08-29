-- 09 — M05 / M06 / M07: životni ciklus Dogovora
--
-- M05  prihvaćena izmena ODMAH aktivira v+1. Stara verzija ostaje nepromenljiva.
--      Nema petlje potvrda.
-- M06  otkazivanje je JEDNOSTRANO i oslobađa SAMO tu alokaciju.
-- M07  Uskočer označi završetak → server otvara prozor od 48h.
--      Naručilac potvrđuje ili prijavljuje problem, i može NEZAVISNO.
--      Bez problema i po isteku — serverski tick zatvara sam.
--
-- Sat je serverski. Klijent ga nikad ne računa.

create or replace function public.fn_is_party(p_agreement_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.agreements a
     where a.id = p_agreement_id
       and (a.requester_account_id = p_uid or a.worker_account_id = p_uid)
  );
$fn$;

revoke all on function public.fn_is_party(uuid, uuid) from public, anon;

-- ------------------------------------------------------------------- M05

create or replace function public.rpc_propose_agreement_change(
  p_agreement_id      uuid,
  p_expected_version  integer,
  p_terms             jsonb,
  p_content_hash      text,
  p_client_request_id text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid       uuid := auth.uid();
  v_agr     public.agreements%rowtype;
  v_new_ver integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select * into v_agr from public.agreements where id = p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  if not public.fn_is_party(p_agreement_id, uid) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;

  if v_agr.status <> 'CONFIRMED' then
    raise exception 'AGREEMENT_NOT_ACTIVE' using errcode = 'P0001', detail = v_agr.status;
  end if;

  -- Optimistična kontrola: predlog na staru verziju se odbija.
  if v_agr.current_version <> p_expected_version then
    raise exception 'VERSION_CONFLICT' using
      errcode = 'P0001',
      hint = 'Dogovor je u međuvremenu promenjen. Osvežite pa pokušajte ponovo.';
  end if;

  -- Idempotencija po zahtevu.
  select version into v_new_ver from public.agreement_versions
   where agreement_id = p_agreement_id
     and terms->>'client_request_id' = p_client_request_id;
  if found then
    return v_new_ver;
  end if;

  v_new_ver := v_agr.current_version + 1;

  insert into public.agreement_versions
    (agreement_id, version, status, terms, content_hash, supersedes_version, created_by_account_id)
  values
    (p_agreement_id, v_new_ver, 'CONFIRMED',
     p_terms || jsonb_build_object('client_request_id', p_client_request_id),
     p_content_hash, v_agr.current_version, uid);

  -- Stara verzija se ne menja — samo se označi da je nadjačana.
  update public.agreement_versions
     set status = 'SUPERSEDED'
   where agreement_id = p_agreement_id
     and version = v_agr.current_version;

  update public.agreements
     set current_version = v_new_ver, updated_at = statement_timestamp()
   where id = p_agreement_id;

  return v_new_ver;
end;
$fn$;

revoke all on function public.rpc_propose_agreement_change(uuid,integer,jsonb,text,text) from public, anon;
grant execute on function public.rpc_propose_agreement_change(uuid,integer,jsonb,text,text) to authenticated;

-- ------------------------------------------------------------------- M06

create or replace function public.rpc_cancel_agreement(
  p_agreement_id uuid,
  p_reason       text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid   uuid := auth.uid();
  v_agr public.agreements%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_agr from public.agreements where id = p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  if not public.fn_is_party(p_agreement_id, uid) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;

  if v_agr.status = 'COMPLETED' then
    raise exception 'ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  -- Jednostrano. Ne traži se saglasnost druge strane.
  update public.agreements
     set status = 'CANCELLED', updated_at = statement_timestamp()
   where id = p_agreement_id;

  update public.agreement_execution
     set state = 'CANCELLED', updated_at = statement_timestamp()
   where agreement_id = p_agreement_id;

  -- Oslobađa se SAMO ovo mesto. Potreba se vraća u prikupljanje ako ima praznog.
  update public.needs n
     set status = case when n.status = 'ACTIVE' then 'SELECTION' else n.status end,
         updated_at = statement_timestamp()
   where n.id = v_agr.need_id
     and public.fn_need_covered_slots(n.id) < n.required_slots;
end;
$fn$;

revoke all on function public.rpc_cancel_agreement(uuid,text) from public, anon;
grant execute on function public.rpc_cancel_agreement(uuid,text) to authenticated;

-- ------------------------------------------------------------------- M07

create or replace function public.rpc_mark_work_done(p_agreement_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid   uuid := auth.uid();
  v_agr public.agreements%rowtype;
  v_dl  timestamptz;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select * into v_agr from public.agreements where id = p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Samo Uskočer označava da je završio. Naručilac ima svoj put.
  if v_agr.worker_account_id <> uid then
    raise exception 'NOT_WORKER' using errcode = '42501';
  end if;

  if v_agr.status <> 'CONFIRMED' then
    raise exception 'AGREEMENT_NOT_ACTIVE' using errcode = 'P0001', detail = v_agr.status;
  end if;

  -- Prozor postavlja SERVER svojim satom.
  v_dl := statement_timestamp() + interval '48 hours';

  update public.agreement_execution
     set state = 'AWAITING_REQUESTER',
         worker_marked_done_at = statement_timestamp(),
         requester_deadline_at = v_dl,
         updated_at = statement_timestamp()
   where agreement_id = p_agreement_id;

  return v_dl;
end;
$fn$;

revoke all on function public.rpc_mark_work_done(uuid) from public, anon;
grant execute on function public.rpc_mark_work_done(uuid) to authenticated;

create or replace function public.rpc_confirm_completion(p_agreement_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid   uuid := auth.uid();
  v_agr public.agreements%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select * into v_agr from public.agreements where id = p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_agr.requester_account_id <> uid then
    raise exception 'NOT_REQUESTER' using errcode = '42501';
  end if;

  if v_agr.status = 'COMPLETED' then
    raise exception 'ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  -- Naručilac može i pre nego što Uskočer bilo šta označi.
  update public.agreements
     set status = 'COMPLETED', updated_at = statement_timestamp()
   where id = p_agreement_id;

  update public.agreement_execution
     set state = 'COMPLETED',
         completed_at = statement_timestamp(),
         requester_deadline_at = null,
         updated_at = statement_timestamp()
   where agreement_id = p_agreement_id;
end;
$fn$;

revoke all on function public.rpc_confirm_completion(uuid) from public, anon;
grant execute on function public.rpc_confirm_completion(uuid) to authenticated;

create or replace function public.rpc_report_problem(p_agreement_id uuid, p_narrative text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid uuid := auth.uid();
  v_rows integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  if coalesce(btrim(p_narrative), '') = '' then
    raise exception 'NARRATIVE_REQUIRED' using errcode = 'P0001';
  end if;

  if not public.fn_is_party(p_agreement_id, uid) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;

  -- Otvoren problem BLOKIRA automatsko zatvaranje po isteku prozora.
  update public.agreement_execution
     set problem_opened_at = coalesce(problem_opened_at, statement_timestamp()),
         updated_at = statement_timestamp()
   where agreement_id = p_agreement_id
     and state <> 'COMPLETED';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'NOT_OPEN' using errcode = 'P0001';
  end if;
end;
$fn$;

revoke all on function public.rpc_report_problem(uuid,text) from public, anon;
grant execute on function public.rpc_report_problem(uuid,text) to authenticated;

-- Serverski tick. Zatvara ono čemu je prozor istekao i nije blokirano problemom.
-- NE zavisi od otvorenog ekrana — poziva ga raspoređivač, ne klijent.
create or replace function public.rpc_tick_auto_completion()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer := 0;
begin
  with due as (
    select e.agreement_id
      from public.agreement_execution e
     where e.state = 'AWAITING_REQUESTER'
       and e.problem_opened_at is null
       and e.requester_deadline_at is not null
       and e.requester_deadline_at <= statement_timestamp()
  ), zatvoreni as (
    update public.agreement_execution e
       set state = 'COMPLETED',
           completed_at = statement_timestamp(),
           requester_deadline_at = null,
           updated_at = statement_timestamp()
      from due
     where e.agreement_id = due.agreement_id
    returning e.agreement_id
  )
  update public.agreements a
     set status = 'COMPLETED', updated_at = statement_timestamp()
    from zatvoreni z
   where a.id = z.agreement_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

-- Namerno bez grant-a korisnicima: ovo poziva raspoređivač servisnim ključem.
revoke all on function public.rpc_tick_auto_completion() from public, anon, authenticated;

comment on function public.rpc_tick_auto_completion is
  'M07: serverski tick. Ne sme da bude dostupan klijentu — poziva ga scheduler.';
