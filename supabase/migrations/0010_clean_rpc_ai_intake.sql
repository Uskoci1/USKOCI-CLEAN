-- 10 — R02: AI intake
--
-- Lanac koji ovo sprovodi na nivou baze:
--   AI_PROPOSED → HUMAN_CONFIRMED → CANONICAL_SAVED
--
-- Dve stvari koje AI ne može ni da pokuša:
--   1) da upiše status CONFIRMED — to radi samo rpc_ai_confirm_fact;
--   2) da objavi Potrebu iz nepotvrđenih činjenica — objava proverava svaku.
--
-- Ispravka POTISKUJE staru činjenicu. Zato chat i live kartica mogu da budu
-- dve projekcije istog stanja, a ne dva stanja.

create or replace function public.rpc_ai_open_conversation(p_purpose text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_purpose not in ('NEED_INTAKE','APPLICATION','PROFILE') then
    raise exception 'BAD_PURPOSE' using errcode = 'P0001';
  end if;

  insert into public.ai_conversations (account_id, purpose)
  values (uid, p_purpose)
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.rpc_ai_open_conversation(text) from public, anon;
grant execute on function public.rpc_ai_open_conversation(text) to authenticated;

-- AI predlaže. Nikad ne potvrđuje.
create or replace function public.rpc_ai_propose_fact(
  p_conversation_id uuid,
  p_fact_key        text,
  p_fact_value      jsonb,
  p_source          text,
  p_scope           text,
  p_confidence      numeric default null,
  p_evidence        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid    uuid := auth.uid();
  v_conv public.ai_conversations%rowtype;
  v_old  uuid;
  v_new  uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select * into v_conv from public.ai_conversations
   where id = p_conversation_id for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_conv.account_id <> uid then raise exception 'NOT_OWNER' using errcode = '42501'; end if;
  if v_conv.status <> 'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode = 'P0001'; end if;

  if p_source not in ('EXPLICIT_USER_ANSWER','CONFIRMED_PROFILE','AI_INFERENCE','SYSTEM_DERIVED') then
    raise exception 'BAD_SOURCE' using errcode = 'P0001';
  end if;

  -- Zaključak bez osnova se ne prima. Bez ovoga se ne može proveriti
  -- odakle je AI nešto izveo.
  if p_source = 'AI_INFERENCE' and coalesce(btrim(p_evidence), '') = '' then
    raise exception 'EVIDENCE_REQUIRED' using
      errcode = 'P0001',
      hint = 'AI zaključak mora da nosi citat iz razgovora.';
  end if;

  -- Ispravka: prethodna živa činjenica za isti ključ se POTISKUJE.
  select id into v_old from public.ai_structured_facts
   where conversation_id = p_conversation_id
     and fact_key = p_fact_key
     and superseded_at is null;

  insert into public.ai_structured_facts
    (account_id, conversation_id, subject_need_id, fact_key, fact_value,
     status, source, scope, confidence, evidence_excerpt)
  values
    (uid, p_conversation_id, v_conv.bound_need_id, p_fact_key, p_fact_value,
     -- Ovde NIKAD ne stoji CONFIRMED.
     'NEEDS_CONFIRMATION', p_source, p_scope, p_confidence, p_evidence)
  returning id into v_new;

  if v_old is not null then
    update public.ai_structured_facts
       set superseded_at = statement_timestamp(), superseded_by = v_new
     where id = v_old;
  end if;

  return v_new;
end;
$fn$;

revoke all on function public.rpc_ai_propose_fact(uuid,text,jsonb,text,text,numeric,text) from public, anon;
grant execute on function public.rpc_ai_propose_fact(uuid,text,jsonb,text,text,numeric,text) to authenticated;

-- Jedino mesto na kome činjenica postaje potvrđena.
create or replace function public.rpc_ai_confirm_fact(p_fact_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid    uuid := auth.uid();
  v_fact public.ai_structured_facts%rowtype;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select * into v_fact from public.ai_structured_facts where id = p_fact_id for update;
  if not found then raise exception 'FACT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_fact.account_id <> uid then raise exception 'NOT_OWNER' using errcode = '42501'; end if;

  -- Potisnuta činjenica se ne može potvrditi — to bi vratilo staru vrednost.
  if v_fact.superseded_at is not null then
    raise exception 'SUPERSEDED' using
      errcode = 'P0001',
      hint = 'Taj podatak je u međuvremenu izmenjen.';
  end if;

  update public.ai_structured_facts
     set status = 'CONFIRMED',
         source = 'EXPLICIT_USER_ANSWER',
         confirmed_by_user_id = uid,
         confirmed_at = statement_timestamp()
   where id = p_fact_id;

  return p_fact_id;
end;
$fn$;

revoke all on function public.rpc_ai_confirm_fact(uuid) from public, anon;
grant execute on function public.rpc_ai_confirm_fact(uuid) to authenticated;

-- CANONICAL_SAVED.
-- Potreba se pravi iz POTVRĐENOG nacrta, ne iz istorije poruka.
create or replace function public.rpc_ai_publish_need(
  p_conversation_id uuid,
  p_profile_id      uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid       uuid := auth.uid();
  v_conv    public.ai_conversations%rowtype;
  v_need_id uuid;
  v_missing text;
  v_val     jsonb;
  k         text;
  obavezno  text[] := array['naslov','datum','vreme','polaziste','odrediste','osoba'];
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;

  select * into v_conv from public.ai_conversations
   where id = p_conversation_id for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_conv.account_id <> uid then raise exception 'NOT_OWNER' using errcode = '42501'; end if;
  if v_conv.bound_need_id is not null then
    return v_conv.bound_need_id;  -- idempotentno
  end if;

  -- Svaka obavezna činjenica mora da postoji I da je potvrđena od čoveka.
  foreach k in array obavezno loop
    select f.fact_value into v_val
      from public.ai_structured_facts f
     where f.conversation_id = p_conversation_id
       and f.fact_key = k
       and f.superseded_at is null
       and f.status = 'CONFIRMED';
    if not found then
      v_missing := coalesce(v_missing || ', ', '') || k;
    end if;
  end loop;

  if v_missing is not null then
    raise exception 'UNCONFIRMED_FACTS' using
      errcode = 'P0001',
      detail = v_missing,
      hint = 'Sve obavezne podatke morate potvrditi pre objave.';
  end if;

  insert into public.needs (
    requester_account_id, requester_profile_id, status,
    title, description, category,
    approximate_area, schedule_kind, required_slots, mode, revision, published_at
  )
  select
    uid, p_profile_id, 'PUBLISHED',
    coalesce(f.fact_value ->> 'naslov', 'Potreba'),
    coalesce(f.fact_value ->> 'opis', ''),
    coalesce(f.fact_value ->> 'kategorija', 'Ostalo'),
    coalesce(f.fact_value ->> 'polaziste', ''),
    'FLEXIBLE',
    -- Broj ljudi dolazi kao ljudski tekst ("2 osobe"), ne kao broj.
    -- Direktan cast bi pukao; zato se cifre izvlače, a rezultat drži
    -- u granicama koje tabela dozvoljava.
    least(50, greatest(1,
      coalesce(nullif(regexp_replace(coalesce(f.fact_value ->> 'osoba', ''), '\D', '', 'g'), '')::integer, 1)
    )),
    'OFFERS', 1, statement_timestamp()
  from (
    select jsonb_object_agg(x.fact_key, x.fact_value) as fact_value
      from public.ai_structured_facts x
     where x.conversation_id = p_conversation_id
       and x.superseded_at is null
       and x.status = 'CONFIRMED'
  ) f
  returning id into v_need_id;

  update public.ai_conversations
     set bound_need_id = v_need_id,
         status = 'COMPLETED',
         completed_at = statement_timestamp()
   where id = p_conversation_id;

  -- Činjenice ostaju vezane za objavljenu Potrebu — trag odakle je nastala.
  update public.ai_structured_facts
     set subject_need_id = v_need_id
   where conversation_id = p_conversation_id
     and superseded_at is null;

  return v_need_id;
end;
$fn$;

revoke all on function public.rpc_ai_publish_need(uuid,uuid) from public, anon;
grant execute on function public.rpc_ai_publish_need(uuid,uuid) to authenticated;

comment on function public.rpc_ai_publish_need is
  'R02 CANONICAL_SAVED: objavljuje iz potvrđenog nacrta, nikad iz istorije poruka.';
