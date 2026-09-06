-- USKOČI RU-5 aggregate reconciliation — retire FASTEST/AUTO_FILL
--
-- Frozen authority:
--   RU-2: "Do not restore FASTEST/AUTO_FILL"
--   RU-5: "FASTEST/AUTO_FILL retired"
--
-- Scope:
--   * no business-row rewrite and no historical backfill;
--   * reject future FASTEST Need/AI/Application state;
--   * reject future AUTO_FILL Selection state;
--   * preserve MY_PRICE and OFFERS;
--   * preserve P0D-02/P0D-03 Selection/Povezivanje behavior for supported modes.
--
-- Explicit non-scope:
--   bounded-note policy, Application AI, calendar authority, Agreement snapshot V2,
--   shared Dogovor, D0140/RU-4B activation, monetization, HITNO.

begin;

do $ru5_fastest_preflight$
declare
  v_select_def text;
begin
  if to_regclass('private.connection_activations') is null
     or to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)') is null
     or to_regprocedure('private.validate_need_v2_fact(text,jsonb)') is null then
    raise exception 'RU5_FASTEST_RETIREMENT_PREDECESSOR_MISMATCH' using errcode='55000';
  end if;

  if exists (select 1 from public.needs where mode='FASTEST') then
    raise exception 'RU5_FASTEST_RETIREMENT_ABORT: existing FASTEST Need rows require explicit reconciliation' using errcode='55000';
  end if;

  if exists (
    select 1
      from public.ai_structured_facts
     where fact_schema_version='NEED_FACT_V2'
       and fact_key='need.price_mode'
       and superseded_at is null
       and fact_value='"FASTEST"'::jsonb
  ) then
    raise exception 'RU5_FASTEST_RETIREMENT_ABORT: active FASTEST V2 facts require explicit reconciliation' using errcode='55000';
  end if;

  if exists (
    select 1
      from private.response_application_snapshots
     where pricing_mode='FASTEST'
  ) then
    raise exception 'RU5_FASTEST_RETIREMENT_ABORT: FASTEST Application snapshots require explicit reconciliation' using errcode='55000';
  end if;

  if exists (
    select 1
      from public.need_selections
     where selection_mode='AUTO_FILL'
  ) then
    raise exception 'RU5_FASTEST_RETIREMENT_ABORT: AUTO_FILL Selections require explicit reconciliation' using errcode='55000';
  end if;

  v_select_def := pg_get_functiondef(
    'public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure
  );
  if position('private.connection_activations' in v_select_def)=0
     or position('private.selection_commands' in v_select_def)=0
     or position('IDEMPOTENCY_KEY_REUSED' in v_select_def)=0 then
    raise exception 'RU5_FASTEST_RETIREMENT_PREDECESSOR_MISMATCH: P0D-02/P0D-03 guards missing'
      using errcode='55000';
  end if;
end
$ru5_fastest_preflight$;

-- Preserve the proven V2 validator as an internal predecessor implementation and
-- put the retirement rule in front of it. This avoids rewriting unrelated typed
-- fact validation while making FASTEST fail closed at the canonical validator.
alter function private.validate_need_v2_fact(text,jsonb)
  rename to validate_need_v2_fact_pre_fastest_retirement;

revoke all on function private.validate_need_v2_fact_pre_fastest_retirement(text,jsonb)
from public, anon, authenticated, service_role;

create function private.validate_need_v2_fact(p_key text,p_value jsonb)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
begin
  if p_key='need.price_mode'
     and jsonb_typeof(p_value)='string'
     and p_value#>>'{}'='FASTEST' then
    raise exception 'V2_PRICE_MODE_RETIRED'
      using errcode='22023', detail='FASTEST';
  end if;

  perform private.validate_need_v2_fact_pre_fastest_retirement(p_key,p_value);
end
$function$;

revoke all on function private.validate_need_v2_fact(text,jsonb)
from public, anon, authenticated, service_role;

comment on function private.validate_need_v2_fact(text,jsonb) is
'RU5_FASTEST_RETIRED: canonical V2 validator rejects FASTEST then delegates all other typed validation to the frozen proven predecessor implementation.';

-- Defense in depth: even privileged/internal writers cannot persist new V2 FASTEST facts.
alter table public.ai_structured_facts
  add constraint ai_structured_facts_fastest_retired_check
  check (
    not (
      fact_schema_version='NEED_FACT_V2'
      and fact_key='need.price_mode'
      and fact_value='"FASTEST"'::jsonb
    )
  );

-- New canonical Needs may use only current pricing modes.
alter table public.needs
  drop constraint needs_mode_check;

alter table public.needs
  add constraint needs_mode_check
  check (mode in ('MY_PRICE','OFFERS'));

-- New immutable Application snapshots may only bind current pricing modes.
alter table private.response_application_snapshots
  drop constraint response_application_snapshots_pricing_mode_check;

alter table private.response_application_snapshots
  add constraint response_application_snapshots_pricing_mode_check
  check (pricing_mode in ('MY_PRICE','OFFERS'));

-- AUTO_FILL is retired. Historical rows would have aborted preflight rather than
-- being silently rewritten; the current live predecessor has none.
alter table public.need_selections
  drop constraint need_selections_selection_mode_check;

alter table public.need_selections
  add constraint need_selections_selection_mode_check
  check (selection_mode in ('REQUESTER_SELECTS','BIDDING'));

do $ru5_fastest_postflight$
declare
  v_needs_check text;
  v_snapshot_check text;
  v_selection_check text;
begin
  perform private.validate_need_v2_fact('need.price_mode','"OFFERS"'::jsonb);
  perform private.validate_need_v2_fact('need.price_mode','"MY_PRICE"'::jsonb);

  begin
    perform private.validate_need_v2_fact('need.price_mode','"FASTEST"'::jsonb);
    raise exception 'RU5_FASTEST_RETIREMENT_POSTFLIGHT: FASTEST unexpectedly accepted' using errcode='55000';
  exception
    when sqlstate '22023' then
      null;
  end;

  select pg_get_constraintdef(oid)
    into v_needs_check
    from pg_constraint
   where conrelid='public.needs'::regclass
     and conname='needs_mode_check';

  select pg_get_constraintdef(oid)
    into v_snapshot_check
    from pg_constraint
   where conrelid='private.response_application_snapshots'::regclass
     and conname='response_application_snapshots_pricing_mode_check';

  select pg_get_constraintdef(oid)
    into v_selection_check
    from pg_constraint
   where conrelid='public.need_selections'::regclass
     and conname='need_selections_selection_mode_check';

  if position('FASTEST' in coalesce(v_needs_check,''))>0
     or position('FASTEST' in coalesce(v_snapshot_check,''))>0
     or position('AUTO_FILL' in coalesce(v_selection_check,''))>0 then
    raise exception 'RU5_FASTEST_RETIREMENT_POSTFLIGHT: retired modes remain admissible'
      using errcode='55000';
  end if;

  if exists (select 1 from public.needs where mode='FASTEST')
     or exists (
       select 1 from public.ai_structured_facts
       where fact_schema_version='NEED_FACT_V2'
         and fact_key='need.price_mode'
         and fact_value='"FASTEST"'::jsonb
     )
     or exists (
       select 1 from private.response_application_snapshots
       where pricing_mode='FASTEST'
     )
     or exists (
       select 1 from public.need_selections where selection_mode='AUTO_FILL'
     ) then
    raise exception 'RU5_FASTEST_RETIREMENT_POSTFLIGHT: retired state exists'
      using errcode='55000';
  end if;
end
$ru5_fastest_postflight$;

commit;
