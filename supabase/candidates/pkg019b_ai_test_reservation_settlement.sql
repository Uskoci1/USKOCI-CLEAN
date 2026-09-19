-- PKG-019B: reservations are worst-case holds that were never released.
--
-- The guard itself is sound: it holds 250 000 microUSD before a call so two accounts
-- cannot each spend the ceiling, and it refuses when the hold would exceed it. What was
-- missing is the other half - settling the hold against what the call actually cost.
-- A real call measured 1 526 microUSD, so every hold overstated reality by 164x and the
-- counter reached its ceiling at about three cents of true spend.
--
-- This adds the missing release. It does NOT touch a single constraint: the ceiling
-- stays welded at 5 000 000 and the per-call hold stays welded at 250 000, so the
-- pre-call safety property is unchanged. Nothing is deleted.
--
-- STATUS: written and reviewed, NOT APPLIED. The session guard refused it as a
-- modification of a shared resource.

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

-- One place that knows the price. These are the introductory Gemini rates, $0.75 per 1M
-- input and $3.75 per 1M output, which is exactly why the budget row carries
-- price_valid_until 2027-01-01. One token of input is 0.75 microUSD.
create or replace function private.ai_test_price_microusd(p_prompt_tokens integer, p_output_tokens integer)
returns bigint language sql immutable security definer set search_path = 'pg_catalog' as $fn$
  select ceil(coalesce(p_prompt_tokens,0) * 0.75 + coalesce(p_output_tokens,0) * 3.75)::bigint;
$fn$;
revoke all on function private.ai_test_price_microusd(integer, integer) from public;

-- Recording real usage now settles the hold, in the same transaction, under the same
-- singleton lock the reservation writer uses. First settlement wins; a replay cannot
-- release twice.
create or replace function public.rpc_ai_test_record_usage_service(p_operation_id uuid, p_model text, p_prompt_tokens integer, p_output_tokens integer, p_total_tokens integer)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $function$
declare
  v_reservation private.ai_test_reservations_v5;
  v_existing private.ai_test_usage_v5;
  v_cost bigint;
  v_released bigint := 0;
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
      return jsonb_build_object('operationId', p_operation_id, 'recorded', false,
        'promptTokens', v_existing.prompt_tokens, 'outputTokens', v_existing.output_tokens,
        'totalTokens', v_existing.total_tokens, 'authoritative', true,
        'settledMicrousd', v_reservation.settled_microusd, 'released', false);
    end if;
    raise exception 'AI_USAGE_ALREADY_RECORDED' using errcode = '55000';
  end if;

  insert into private.ai_test_usage_v5(operation_id, account_id, model, prompt_tokens, output_tokens, total_tokens)
    values (p_operation_id, v_reservation.account_id, btrim(p_model), p_prompt_tokens, p_output_tokens, p_total_tokens);

  if v_reservation.settled_microusd is null then
    v_cost := least(private.ai_test_price_microusd(p_prompt_tokens, p_output_tokens), v_reservation.max_cost_microusd);
    perform 1 from private.ai_test_budget_v5 where singleton for update;
    update private.ai_test_reservations_v5
       set settled_microusd = v_cost, settlement_basis = 'MEASURED', settled_at = statement_timestamp()
     where operation_id = p_operation_id and settled_microusd is null;
    if found then
      v_released := v_reservation.max_cost_microusd - v_cost;
      update private.ai_test_budget_v5
         set reserved_microusd = greatest(0, reserved_microusd - v_released) where singleton;
    end if;
  end if;

  return jsonb_build_object('operationId', p_operation_id, 'recorded', true,
    'promptTokens', p_prompt_tokens, 'outputTokens', p_output_tokens,
    'totalTokens', p_total_tokens, 'authoritative', true,
    'settledMicrousd', v_cost, 'releasedMicrousd', v_released);
end
$function$;

-- Settle the twenty holds already taken. The one call with provider usage metadata is
-- settled as MEASURED. The nineteen that predate the capture have no reliable usage, so
-- they are NOT presented as measurements: each is settled at twice the measured call and
-- labelled CONSERVATIVE_ESTIMATE_UNMEASURED, which releases less than the truth rather
-- than more.
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
DECLARE v_ceiling bigint; v_reserved bigint; v_rows bigint; v_unsettled bigint; v_measured bigint;
BEGIN
  select ceiling_microusd, reserved_microusd into v_ceiling, v_reserved from private.ai_test_budget_v5 where singleton;
  select count(*), count(*) filter (where settled_microusd is null),
         count(*) filter (where settlement_basis = 'MEASURED')
    into v_rows, v_unsettled, v_measured from private.ai_test_reservations_v5;

  IF v_ceiling <> 5000000 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: the ceiling moved, it must not'; END IF;
  IF v_rows <> 20 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: reservation rows changed from 20 to %', v_rows; END IF;
  IF v_unsettled <> 0 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: % reservations left unsettled', v_unsettled; END IF;
  IF v_measured <> 1 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: expected exactly 1 MEASURED settlement, found %', v_measured; END IF;
  IF v_reserved >= 5000000 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: the counter is still full'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_test_budget_v5_ceiling_microusd_check')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_test_reservations_v5_check') THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: a welded guard constraint was dropped';
  END IF;
END
$post$;
