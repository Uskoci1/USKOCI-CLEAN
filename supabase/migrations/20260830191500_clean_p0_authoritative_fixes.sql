-- PROVENANCE CLASSIFICATION: RECORDED_STATEMENT_RECONSTRUCTION
-- Source: live supabase_migrations.schema_migrations.statements for
--         20260830191500_clean_p0_authoritative_fixes.
-- This file preserves the seven recorded SQL statements in their recorded order.
-- It is NOT claimed to reproduce the original migration file byte-for-byte.
-- Legacy manifest MD5 c4f62aa4521410dd3f85934bb98474a7 was not reproduced.
-- Never rewrite the already-applied remote migration history to substitute this file.

-- Migration: 20260830191500_clean_p0_authoritative_fixes.sql
-- Description:
-- 1. Fixes rpc_ai_publish_need: aggregates structured facts correctly, separates Pricing Mode (FASTEST, MY_PRICE, OFFERS) from Route Mode (STATIONARY, POINT_TO_POINT, etc.), eliminating constraint violation.
-- 2. Fixes rpc_report_problem: persists problem_narrative and problem_opened_by durably in agreement_execution and records system dispute entry in agreement_messages.

-- 1. Add durable problem columns to agreement_execution
alter table public.agreement_execution
  add column if not exists problem_narrative text,
  add column if not exists problem_opened_by uuid references auth.users(id) on delete set null;

-- 2. Correct rpc_report_problem to persist narrative & system message
create or replace function public.rpc_report_problem(p_agreement_id uuid, p_narrative text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare
  uid uuid := auth.uid();
  v_rows integer;
  v_agr public.agreements%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if coalesce(btrim(p_narrative), '') = '' then raise exception 'NARRATIVE_REQUIRED' using errcode = 'P0001'; end if;
  if not public.fn_is_party(p_agreement_id, uid) then raise exception 'NOT_PARTY' using errcode = '42501'; end if;

  select * into v_agr from public.agreements where id = p_agreement_id;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  update public.agreement_execution
     set problem_opened_at = coalesce(problem_opened_at, statement_timestamp()),
         problem_narrative = coalesce(problem_narrative, p_narrative),
         problem_opened_by = coalesce(problem_opened_by, uid),
         updated_at = statement_timestamp()
   where agreement_id = p_agreement_id and state <> 'COMPLETED';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'NOT_OPEN' using errcode = 'P0001'; end if;

  -- Record dispute entry in agreement_messages so counterparty sees it in chat
  insert into public.agreement_messages (
    agreement_id, agreement_version, sender_account_id, body
  ) values (
    p_agreement_id, v_agr.current_version, uid, '⚠️ Prijavljen problem: ' || p_narrative
  );
end;
$fn$;

revoke all on function public.rpc_report_problem(uuid,text) from public, anon;

grant execute on function public.rpc_report_problem(uuid,text) to authenticated;

-- 3. Correct rpc_ai_publish_need: structured fact aggregation and clean mode mapping
create or replace function public.rpc_ai_publish_need(p_conversation_id uuid, p_profile_id uuid)
  returns uuid language plpgsql security definer
  set search_path = public, pg_temp
  as $fn$
  declare
    uid uuid := auth.uid();
    v_conv public.ai_conversations%rowtype;
    v_need_id uuid;
    v_missing text;
    v_val jsonb;
    k text;
    obavezno text[] := array['naslov','datum','vreme','polaziste','odrediste','osoba'];
    v_facts jsonb;
    v_title text;
    v_desc text;
    v_cat text;
    v_area text;
    v_slots integer;
    v_raw_mode text;
    v_mode text;
    v_raw_price integer;
    v_price integer;
    v_raw_loc text;
    v_loc_mode text;
  begin
    if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
    select * into v_conv from public.ai_conversations where id = p_conversation_id for update;
    if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002'; end if;
    if v_conv.account_id <> uid then raise exception 'NOT_OWNER' using errcode = '42501'; end if;
    if v_conv.bound_need_id is not null then return v_conv.bound_need_id; end if;

    -- Validate required facts
    foreach k in array obavezno loop
      select f.fact_value into v_val from public.ai_structured_facts f
       where f.conversation_id = p_conversation_id and f.fact_key = k
         and f.superseded_at is null and f.status = 'CONFIRMED';
      if not found then v_missing := coalesce(v_missing || ', ', '') || k; end if;
    end loop;

    if v_missing is not null then
      raise exception 'UNCONFIRMED_FACTS' using errcode = 'P0001', detail = v_missing,
        hint = 'Sve obavezne podatke morate potvrditi pre objave.';
    end if;

    -- Aggregate all confirmed facts into jsonb object
    select jsonb_object_agg(f.fact_key, f.fact_value) into v_facts
      from public.ai_structured_facts f
     where f.conversation_id = p_conversation_id
       and f.superseded_at is null
       and f.status = 'CONFIRMED';

    v_title := coalesce(nullif(trim(v_facts ->> 'naslov'), ''), 'Potreba');
    v_desc := coalesce(v_facts ->> 'opis', '');
    v_cat := coalesce(nullif(trim(v_facts ->> 'kategorija'), ''), 'Ostalo');
    v_area := coalesce(v_facts ->> 'polaziste', '');
    v_slots := least(50, greatest(1,
      coalesce(nullif(regexp_replace(coalesce(v_facts ->> 'osoba', ''), '\D', '', 'g'), '')::integer, 1)));

    -- Pricing mode resolution
    v_raw_mode := upper(trim(coalesce(v_facts ->> 'mode', '')));
    v_raw_price := nullif(regexp_replace(coalesce(v_facts ->> 'cena', ''), '\D', '', 'g'), '')::integer;
    if v_raw_mode in ('FASTEST', 'MY_PRICE', 'OFFERS') then
      v_mode := v_raw_mode;
    elsif v_raw_price is not null and v_raw_price > 0 then
      v_mode := 'MY_PRICE';
    else
      v_mode := 'OFFERS';
    end if;
    v_price := case when v_mode = 'MY_PRICE' then v_raw_price else null end;

    -- Execution location mode resolution
    v_raw_loc := upper(trim(coalesce(v_facts ->> 'execution_location_mode', '')));
    if v_raw_loc in ('STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE') then
      v_loc_mode := v_raw_loc;
    elsif coalesce(v_facts ->> 'odrediste', '') <> '' and coalesce(v_facts ->> 'odrediste', '') <> coalesce(v_facts ->> 'polaziste', '') then
      v_loc_mode := 'POINT_TO_POINT';
    else
      v_loc_mode := 'STATIONARY';
    end if;

    -- Set lifecycle token to allow insert
    perform set_config('uskoci.need_lifecycle', 'PUBLISH', true);

    insert into public.needs (
      requester_account_id,
      requester_profile_id,
      status,
      title,
      description,
      category,
      approximate_area,
      schedule_kind,
      required_slots,
      mode,
      requester_price_rsd,
      execution_location_mode,
      revision,
      published_at
    ) values (
      uid,
      p_profile_id,
      'PUBLISHED',
      v_title,
      v_desc,
      v_cat,
      v_area,
      'FLEXIBLE',
      v_slots,
      v_mode,
      v_price,
      v_loc_mode,
      1,
      statement_timestamp()
    )
    returning id into v_need_id;

    update public.ai_conversations
       set bound_need_id = v_need_id,
           status = 'PUBLISHED'
     where id = p_conversation_id;

    return v_need_id;
  end;
$fn$;

revoke all on function public.rpc_ai_publish_need(uuid,uuid) from public, anon;

grant execute on function public.rpc_ai_publish_need(uuid,uuid) to authenticated;
