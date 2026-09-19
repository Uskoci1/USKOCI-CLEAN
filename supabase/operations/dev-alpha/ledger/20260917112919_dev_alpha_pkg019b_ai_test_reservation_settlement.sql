-- PKG-019B: reservations are worst-case holds that were never released.
-- Owner approved 2026-09-17. The ceiling, the worst-case reservation constraint, the
-- reserve/admission principle and every historical reservation identity stay untouched.

DO $pre$
DECLARE v_ceiling bigint; v_reserved bigint; v_rows bigint; v_sum bigint; v_usage bigint; v_cols bigint;
BEGIN
  select ceiling_microusd, reserved_microusd into v_ceiling, v_reserved from private.ai_test_budget_v5 where singleton;
  select count(*), coalesce(sum(max_cost_microusd),0) into v_rows, v_sum from private.ai_test_reservations_v5;
  select count(*) into v_usage from private.ai_test_usage_v5;
  select count(*) into v_cols from information_schema.columns
    where table_schema='private' and table_name='ai_test_reservations_v5'
      and column_name in ('settled_microusd','settlement_basis','settled_at');

  IF v_ceiling <> 5000000 OR v_reserved <> 5000000 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: budget is % / %, expected 5000000 / 5000000', v_reserved, v_ceiling; END IF;
  IF v_rows <> 20 OR v_sum <> 5000000 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: reservations are % rows summing %, expected 20 / 5000000', v_rows, v_sum; END IF;
  IF v_usage <> 1 THEN RAISE EXCEPTION 'PRECONDITION_FAILED: expected exactly 1 measured usage row, found %', v_usage; END IF;
  IF v_cols <> 0 THEN RAISE EXCEPTION 'PRECONDITION_FAILED: settlement columns already exist'; END IF;
  IF (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='rpc_ai_test_record_usage_service') <> '0cee88305ac38bc78f2c341583aa5d0e' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: the usage RPC changed since preflight'; END IF;
END
$pre$;

alter table private.ai_test_reservations_v5
  add column if not exists settled_microusd bigint,
  add column if not exists settlement_basis text,
  add column if not exists settled_at timestamptz;

alter table private.ai_test_reservations_v5
  drop constraint if exists ai_test_reservations_v5_settlement_check;
alter table private.ai_test_reservations_v5
  add constraint ai_test_reservations_v5_settlement_check check (
    (settled_microusd is null and settlement_basis is null and settled_at is null)
    or (settled_microusd between 0 and max_cost_microusd
        and settlement_basis in ('MEASURED', 'CONSERVATIVE_ESTIMATE_UNMEASURED')
        and settled_at is not null));

create or replace function private.ai_test_price_microusd(p_prompt_tokens integer, p_output_tokens integer)
returns bigint language sql immutable security definer set search_path = 'pg_catalog' as $fn$
  select ceil(coalesce(p_prompt_tokens,0) * 0.75 + coalesce(p_output_tokens,0) * 3.75)::bigint;
$fn$;
revoke all on function private.ai_test_price_microusd(integer, integer) from public;

create or replace function public.rpc_ai_test_record_usage_service(p_operation_id uuid, p_model text, p_prompt_tokens integer, p_output_tokens integer, p_total_tokens integer)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $function$
declare
  v_reservation private.ai_test_reservations_v5;
  v_existing private.ai_test_usage_v5;
  v_cost bigint;
  v_released bigint := 0;
  v_settled boolean := false;
begin
  if p_operation_id is null or p_model is null
     or p_prompt_tokens is null or p_output_tokens is null or p_total_tokens is null
     or p_prompt_tokens < 0 or p_output_tokens < 0 or p_total_tokens < 0 then
    raise exception 'AI_USAGE_INPUT_INVALID' using errcode = '22023';
  end if;

  select * into v_reservation from private.ai_test_reservations_v5 where operation_id = p_operation_id;
  if not found then
    raise exception 'AI_USAGE_NO_RESERVATION' using errcode = '42501';
  end if;

  select * into v_existing from private.ai_test_usage_v5 where operation_id = p_operation_id;
  if found then
    if v_existing.prompt_tokens = p_prompt_tokens and v_existing.output_tokens = p_output_tokens
       and v_existing.total_tokens = p_total_tokens and v_existing.model = btrim(p_model) then
      -- Replay. Nothing is recorded and nothing is released a second time.
      return jsonb_build_object('operationId', p_operation_id, 'recorded', false,
        'promptTokens', v_existing.prompt_tokens, 'outputTokens', v_existing.output_tokens,
        'totalTokens', v_existing.total_tokens, 'authoritative', true,
        'settledMicrousd', v_reservation.settled_microusd, 'releasedMicrousd', 0);
    end if;
    raise exception 'AI_USAGE_ALREADY_RECORDED' using errcode = '55000';
  end if;

  insert into private.ai_test_usage_v5(operation_id, account_id, model, prompt_tokens, output_tokens, total_tokens)
    values (p_operation_id, v_reservation.account_id, btrim(p_model), p_prompt_tokens, p_output_tokens, p_total_tokens);

  -- Settle the worst-case hold down to what the provider actually charged. Same
  -- singleton lock the reservation writer takes, so the two cannot interleave.
  v_cost := least(private.ai_test_price_microusd(p_prompt_tokens, p_output_tokens), v_reservation.max_cost_microusd);
  perform 1 from private.ai_test_budget_v5 where singleton for update;
  update private.ai_test_reservations_v5
     set settled_microusd = v_cost, settlement_basis = 'MEASURED', settled_at = statement_timestamp()
   where operation_id = p_operation_id and settled_microusd is null;
  get diagnostics v_settled = row_count;
  if v_settled then
    v_released := v_reservation.max_cost_microusd - v_cost;
    update private.ai_test_budget_v5
       set reserved_microusd = greatest(0, reserved_microusd - v_released) where singleton;
  else
    v_cost := v_reservation.settled_microusd;
  end if;

  return jsonb_build_object('operationId', p_operation_id, 'recorded', true,
    'promptTokens', p_prompt_tokens, 'outputTokens', p_output_tokens,
    'totalTokens', p_total_tokens, 'authoritative', true,
    'settledMicrousd', v_cost, 'releasedMicrousd', v_released);
end
$function$;

-- Reporting must never let an estimate read as a measurement.
create or replace function public.rpc_ai_test_budget_report_service()
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $function$
declare
  v_budget private.ai_test_budget_v5;
  v_calls integer; v_with_usage integer; v_prompt bigint; v_output bigint;
  v_measured_calls integer; v_measured_microusd bigint;
  v_estimated_calls integer; v_estimated_microusd bigint;
  v_unsettled integer;
begin
  select * into v_budget from private.ai_test_budget_v5 where singleton;
  select count(*) into v_calls from private.ai_test_reservations_v5;
  select count(*), coalesce(sum(prompt_tokens),0), coalesce(sum(output_tokens),0)
    into v_with_usage, v_prompt, v_output from private.ai_test_usage_v5;
  select count(*) filter (where settlement_basis='MEASURED'),
         coalesce(sum(settled_microusd) filter (where settlement_basis='MEASURED'),0),
         count(*) filter (where settlement_basis='CONSERVATIVE_ESTIMATE_UNMEASURED'),
         coalesce(sum(settled_microusd) filter (where settlement_basis='CONSERVATIVE_ESTIMATE_UNMEASURED'),0),
         count(*) filter (where settled_microusd is null)
    into v_measured_calls, v_measured_microusd, v_estimated_calls, v_estimated_microusd, v_unsettled
    from private.ai_test_reservations_v5;

  return jsonb_build_object(
    'providerCalls', v_calls,
    'callsWithReportedUsage', v_with_usage,
    'callsWithoutReportedUsage', v_calls - v_with_usage,
    'inputTokens', case when v_with_usage = 0 then null else v_prompt end,
    'outputTokens', case when v_with_usage = 0 then null else v_output end,
    -- MEASURED: provider usage metadata priced at the published introductory rates.
    'measuredCalls', v_measured_calls,
    'measuredSpendUsd', case when v_measured_calls = 0 then null else round(v_measured_microusd / 1000000.0, 6) end,
    -- ESTIMATE: no provider usage exists for these calls. This figure settles their old
    -- reservation and is NOT a measurement of provider spend.
    'unmeasuredCalls', v_estimated_calls,
    'unmeasuredProvisionUsd', case when v_estimated_calls = 0 then null else round(v_estimated_microusd / 1000000.0, 6) end,
    'unmeasuredBasis', case when v_estimated_calls = 0 then null else
      'CONSERVATIVE_ESTIMATE_UNMEASURED: these calls predate provider usage capture. The figure exists only to settle their reservation and must never be read as measured provider spend.' end,
    'unsettledReservations', v_unsettled,
    'realSpendUsd', null,
    'realSpendBasis', case when v_estimated_calls = 0
      then 'MEASURED: every call has provider usage metadata priced at the published rates'
      else 'UNKNOWN in total: ' || v_measured_calls || ' call(s) are MEASURED from provider usage metadata, ' || v_estimated_calls || ' predate usage capture and are UNMEASURED. The provider billing console remains authoritative.' end,
    'internalTestBudgetCapUsd', round(v_budget.ceiling_microusd / 1000000.0, 2),
    'internalTestBudgetReservedUsd', round(v_budget.reserved_microusd / 1000000.0, 2),
    'remainingAllowedCalls', (v_budget.ceiling_microusd - v_budget.reserved_microusd) / 250000,
    'capIsACallCounter', true,
    'priceValidUntil', v_budget.price_valid_until,
    'authoritative', true);
end
$function$;

-- One-time settlement of the twenty holds already taken. Identities are not rewritten:
-- only the three new settlement columns are filled.
update private.ai_test_reservations_v5 r
   set settled_microusd = least(private.ai_test_price_microusd(u.prompt_tokens, u.output_tokens), r.max_cost_microusd),
       settlement_basis = 'MEASURED',
       settled_at = statement_timestamp()
  from private.ai_test_usage_v5 u
 where u.operation_id = r.operation_id and r.settled_microusd is null;

update private.ai_test_reservations_v5 r
   set settled_microusd = least(2 * (select private.ai_test_price_microusd(u.prompt_tokens, u.output_tokens)
                                       from private.ai_test_usage_v5 u order by u.recorded_at limit 1),
                                r.max_cost_microusd),
       settlement_basis = 'CONSERVATIVE_ESTIMATE_UNMEASURED',
       settled_at = statement_timestamp()
 where r.settled_microusd is null;

update private.ai_test_budget_v5 b
   set reserved_microusd = (select coalesce(sum(coalesce(r.settled_microusd, r.max_cost_microusd)), 0)
                              from private.ai_test_reservations_v5 r)
 where b.singleton;

DO $post$
DECLARE v_ceiling bigint; v_reserved bigint; v_rows bigint; v_unsettled bigint;
        v_measured bigint; v_estimated bigint; v_sum bigint;
BEGIN
  select ceiling_microusd, reserved_microusd into v_ceiling, v_reserved from private.ai_test_budget_v5 where singleton;
  select count(*), count(*) filter (where settled_microusd is null),
         count(*) filter (where settlement_basis='MEASURED'),
         count(*) filter (where settlement_basis='CONSERVATIVE_ESTIMATE_UNMEASURED'),
         coalesce(sum(settled_microusd),0)
    into v_rows, v_unsettled, v_measured, v_estimated, v_sum
    from private.ai_test_reservations_v5;

  IF v_ceiling <> 5000000 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: the ceiling moved'; END IF;
  IF v_rows <> 20 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: reservation rows are now %', v_rows; END IF;
  IF v_unsettled <> 0 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: % unsettled', v_unsettled; END IF;
  IF v_measured <> 1 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: MEASURED count is %, expected 1', v_measured; END IF;
  IF v_estimated <> 19 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: estimate count is %, expected 19', v_estimated; END IF;
  IF v_reserved <> v_sum THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: reserved % does not equal settled sum %', v_reserved, v_sum; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_test_budget_v5_ceiling_microusd_check')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ai_test_reservations_v5_check') THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: a welded guard constraint was dropped'; END IF;
  IF (select count(*) from private.ai_test_reservations_v5 where kind='LLM' and max_cost_microusd=250000) <> 20 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: a worst-case reservation amount was rewritten'; END IF;
  IF (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='rpc_ai_test_budget_reserve_service') <> '6cd527442c55a96a81bf885084755451' THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: the reserve/admission RPC was modified'; END IF;
END
$post$;