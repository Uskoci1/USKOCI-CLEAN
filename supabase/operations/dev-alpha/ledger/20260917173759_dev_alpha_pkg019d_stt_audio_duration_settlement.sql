-- PKG-019D: a successful speech session settles against the audio it actually sent.
--
-- The provider sends no usageMetadata on the live transcription stream (proven by probe
-- on 2026-09-17), so a successful STT session could never settle and kept its full
-- 200 000 microUSD hold. About 24 voice messages would have filled the ceiling.
--
-- What IS measured: the bridge counts exactly the PCM bytes it forwards to the provider.
-- What IS published (ai.google.dev pricing, gemini-3.5-transcribe-live, paid tier):
--   input  $3.50 per 1M tokens, billed at 25 tokens per second of audio
--   output $21.00 per 1M tokens of text
-- Output tokens are not reported, so they are bounded conservatively: the larger of
-- Google's own stated 175 tokens per minute and one token per two transcript characters,
-- which overstates real tokenisation. The result can overstate cost, never understate it.
--
-- The basis is named for what it is - AUDIO_DURATION_AT_PUBLISHED_RATE - so it can never
-- be read as provider-reported MEASURED usage.
--
-- Unchanged: the ceiling, the STT cap, the reserve/admission RPC, and every historical
-- row. The three existing unsettled STT holds have no measured audio and are left alone.

DO $pre$
BEGIN
  IF (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='rpc_ai_test_budget_reserve_service') <> '6cd527442c55a96a81bf885084755451' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: admission RPC changed'; END IF;
  IF (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='rpc_ai_test_budget_report_service') <> 'd11f2625c54e4c7716bcbf645a6e3ec7' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: report RPC changed since preflight'; END IF;
END
$pre$;

create temp table pkg019d_before on commit drop as
select (select reserved_microusd from private.ai_test_budget_v5) as reserved,
       (select count(*) from private.ai_test_reservations_v5) as rows_total,
       (select count(*) from private.ai_test_reservations_v5 where settled_microusd is null) as unsettled;

alter table private.ai_test_reservations_v5
  add column if not exists measured_audio_bytes bigint,
  add column if not exists measured_transcript_chars integer;

alter table private.ai_test_reservations_v5
  drop constraint if exists ai_test_reservations_v5_settlement_check;
alter table private.ai_test_reservations_v5
  add constraint ai_test_reservations_v5_settlement_check check (
    (settled_microusd is null and settlement_basis is null and settled_at is null)
    or (settled_microusd between 0 and max_cost_microusd
        and settlement_basis in ('MEASURED', 'CONSERVATIVE_ESTIMATE_UNMEASURED', 'FAILED_NO_USAGE', 'AUDIO_DURATION_AT_PUBLISHED_RATE')
        and settled_at is not null));

alter table private.ai_test_reservations_v5
  drop constraint if exists ai_test_reservations_v5_audio_measure_check;
alter table private.ai_test_reservations_v5
  add constraint ai_test_reservations_v5_audio_measure_check check (
    (settlement_basis = 'AUDIO_DURATION_AT_PUBLISHED_RATE')
      = (measured_audio_bytes is not null and measured_audio_bytes > 0 and measured_transcript_chars is not null));

-- 16 kHz, 16-bit mono PCM is 32 000 bytes per second.
create or replace function private.ai_test_stt_price_microusd(p_audio_bytes bigint, p_transcript_chars integer)
returns bigint language sql immutable security definer set search_path = 'pg_catalog' as $fn$
  select ceil(
    -- input: seconds x 25 tokens x 3.50 microUSD per token
    (greatest(p_audio_bytes, 0)::numeric / 32000.0) * 25 * 3.50
    -- output: conservative token bound x 21.00 microUSD per token
    + greatest(ceil((greatest(p_audio_bytes, 0)::numeric / 32000.0) / 60.0 * 175), ceil(greatest(p_transcript_chars, 0)::numeric / 2.0)) * 21.00
  )::bigint;
$fn$;
revoke all on function private.ai_test_stt_price_microusd(bigint, integer) from public;

create or replace function public.rpc_ai_test_settle_audio_service(p_operation_id uuid, p_audio_bytes bigint, p_transcript_chars integer)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $function$
declare
  v_reservation private.ai_test_reservations_v5;
  v_cost bigint;
  v_rows integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_operation_id is null or p_audio_bytes is null or p_transcript_chars is null
     or p_audio_bytes <= 0 or p_transcript_chars < 0 then
    raise exception 'AI_AUDIO_SETTLE_INPUT_INVALID' using errcode = '22023';
  end if;

  select * into v_reservation from private.ai_test_reservations_v5 where operation_id = p_operation_id;
  if not found then raise exception 'AI_AUDIO_SETTLE_NO_RESERVATION' using errcode = '42501'; end if;
  if v_reservation.kind <> 'STT' then
    return jsonb_build_object('operationId', p_operation_id, 'settled', false, 'code', 'AI_AUDIO_SETTLE_NOT_STT', 'releasedMicrousd', 0);
  end if;
  -- Provider-reported usage always wins over a duration-based settlement.
  if exists (select 1 from private.ai_test_usage_v5 where operation_id = p_operation_id) then
    return jsonb_build_object('operationId', p_operation_id, 'settled', false, 'code', 'AI_AUDIO_SETTLE_USAGE_EXISTS', 'releasedMicrousd', 0);
  end if;
  if v_reservation.settled_microusd is not null then
    return jsonb_build_object('operationId', p_operation_id, 'settled', false, 'code', 'AI_AUDIO_SETTLE_ALREADY_SETTLED',
      'releasedMicrousd', 0, 'settlementBasis', v_reservation.settlement_basis, 'settledMicrousd', v_reservation.settled_microusd);
  end if;

  v_cost := least(private.ai_test_stt_price_microusd(p_audio_bytes, p_transcript_chars), v_reservation.max_cost_microusd);

  perform 1 from private.ai_test_budget_v5 where singleton for update;
  update private.ai_test_reservations_v5
     set settled_microusd = v_cost, settlement_basis = 'AUDIO_DURATION_AT_PUBLISHED_RATE', settled_at = statement_timestamp(),
         measured_audio_bytes = p_audio_bytes, measured_transcript_chars = p_transcript_chars
   where operation_id = p_operation_id and settled_microusd is null;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('operationId', p_operation_id, 'settled', false, 'code', 'AI_AUDIO_SETTLE_ALREADY_SETTLED', 'releasedMicrousd', 0);
  end if;

  update private.ai_test_budget_v5
     set reserved_microusd = greatest(0, reserved_microusd - (v_reservation.max_cost_microusd - v_cost)) where singleton;

  return jsonb_build_object('operationId', p_operation_id, 'settled', true, 'code', 'AI_AUDIO_SETTLED',
    'settledMicrousd', v_cost, 'releasedMicrousd', v_reservation.max_cost_microusd - v_cost,
    'audioSeconds', round(p_audio_bytes::numeric / 32000.0, 2), 'settlementBasis', 'AUDIO_DURATION_AT_PUBLISHED_RATE');
end
$function$;
revoke all on function public.rpc_ai_test_settle_audio_service(uuid, bigint, integer) from public;
grant execute on function public.rpc_ai_test_settle_audio_service(uuid, bigint, integer) to service_role;

create or replace function public.rpc_ai_test_budget_report_service()
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $function$
declare
  v_budget private.ai_test_budget_v5;
  v_calls integer; v_with_usage integer; v_prompt bigint; v_output bigint;
  v_measured_calls integer; v_measured_microusd bigint;
  v_estimated_calls integer; v_estimated_microusd bigint;
  v_audio_calls integer; v_audio_microusd bigint; v_audio_bytes bigint;
  v_failed_calls integer; v_unsettled integer;
begin
  select * into v_budget from private.ai_test_budget_v5 where singleton;
  select count(*) into v_calls from private.ai_test_reservations_v5;
  select count(*), coalesce(sum(prompt_tokens),0), coalesce(sum(output_tokens),0)
    into v_with_usage, v_prompt, v_output from private.ai_test_usage_v5;
  select count(*) filter (where settlement_basis='MEASURED'),
         coalesce(sum(settled_microusd) filter (where settlement_basis='MEASURED'),0),
         count(*) filter (where settlement_basis='CONSERVATIVE_ESTIMATE_UNMEASURED'),
         coalesce(sum(settled_microusd) filter (where settlement_basis='CONSERVATIVE_ESTIMATE_UNMEASURED'),0),
         count(*) filter (where settlement_basis='AUDIO_DURATION_AT_PUBLISHED_RATE'),
         coalesce(sum(settled_microusd) filter (where settlement_basis='AUDIO_DURATION_AT_PUBLISHED_RATE'),0),
         coalesce(sum(measured_audio_bytes) filter (where settlement_basis='AUDIO_DURATION_AT_PUBLISHED_RATE'),0),
         count(*) filter (where settlement_basis='FAILED_NO_USAGE'),
         count(*) filter (where settled_microusd is null)
    into v_measured_calls, v_measured_microusd, v_estimated_calls, v_estimated_microusd,
         v_audio_calls, v_audio_microusd, v_audio_bytes, v_failed_calls, v_unsettled
    from private.ai_test_reservations_v5;

  return jsonb_build_object(
    'providerCalls', v_calls,
    'callsWithReportedUsage', v_with_usage,
    'callsWithoutReportedUsage', v_calls - v_with_usage,
    'inputTokens', case when v_with_usage = 0 then null else v_prompt end,
    'outputTokens', case when v_with_usage = 0 then null else v_output end,
    'measuredCalls', v_measured_calls,
    'measuredSpendUsd', case when v_measured_calls = 0 then null else round(v_measured_microusd / 1000000.0, 6) end,
    'audioDurationCalls', v_audio_calls,
    'audioDurationSeconds', case when v_audio_calls = 0 then null else round(v_audio_bytes / 32000.0, 2) end,
    'audioDurationSpendUsd', case when v_audio_calls = 0 then null else round(v_audio_microusd / 1000000.0, 6) end,
    'audioDurationBasis', case when v_audio_calls = 0 then null else
      'AUDIO_DURATION_AT_PUBLISHED_RATE: measured PCM bytes sent to the provider, priced at the published gemini-3.5-transcribe-live rates with output tokens bounded conservatively. Not provider-reported usage.' end,
    'unmeasuredCalls', v_estimated_calls,
    'unmeasuredProvisionUsd', case when v_estimated_calls = 0 then null else round(v_estimated_microusd / 1000000.0, 6) end,
    'unmeasuredBasis', case when v_estimated_calls = 0 then null else
      'CONSERVATIVE_ESTIMATE_UNMEASURED: these calls predate provider usage capture. The figure exists only to settle their reservation and must never be read as measured provider spend.' end,
    'failedNoUsageCalls', v_failed_calls,
    'unsettledReservations', v_unsettled,
    'realSpendUsd', null,
    'realSpendBasis', 'UNKNOWN in total: ' || v_measured_calls || ' MEASURED from provider usage metadata, '
      || v_audio_calls || ' priced from measured audio duration at published rates, '
      || v_estimated_calls || ' UNMEASURED estimates, ' || v_unsettled || ' still unsettled. The provider billing console remains authoritative.',
    'internalTestBudgetCapUsd', round(v_budget.ceiling_microusd / 1000000.0, 2),
    'internalTestBudgetReservedUsd', round(v_budget.reserved_microusd / 1000000.0, 2),
    'remainingAllowedCalls', (v_budget.ceiling_microusd - v_budget.reserved_microusd) / 250000,
    'capIsACallCounter', true,
    'priceValidUntil', v_budget.price_valid_until,
    'authoritative', true);
end
$function$;

DO $post$
DECLARE b record;
BEGIN
  select * into b from pkg019d_before;
  IF (select ceiling_microusd from private.ai_test_budget_v5) <> 5000000 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: ceiling moved'; END IF;
  IF (select reserved_microusd from private.ai_test_budget_v5) <> b.reserved THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: reserved moved without any settlement'; END IF;
  IF (select count(*) from private.ai_test_reservations_v5) <> b.rows_total THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: rows changed'; END IF;
  IF (select count(*) from private.ai_test_reservations_v5 where settled_microusd is null) <> b.unsettled THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: a historical hold was settled'; END IF;
  IF (select count(*) from private.ai_test_reservations_v5 where settlement_basis='AUDIO_DURATION_AT_PUBLISHED_RATE') <> 0 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: something was backfilled'; END IF;
  IF (select count(*) from private.ai_test_reservations_v5 where kind='STT' and max_cost_microusd=200000) <> (select count(*) from private.ai_test_reservations_v5 where kind='STT') THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: an STT cap was rewritten'; END IF;
  IF (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='rpc_ai_test_budget_reserve_service') <> '6cd527442c55a96a81bf885084755451' THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: admission modified'; END IF;
END
$post$;