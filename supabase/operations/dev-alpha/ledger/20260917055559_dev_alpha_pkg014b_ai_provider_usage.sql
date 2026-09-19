-- USKOCI PKG-014B - DEV operational migration.
-- Applied to canonical DEV/ALPHA leqcwgzvjsxugfgzdmth on 2026-09-17 on the owner's
-- instruction of 2026-09-17 point 4: capture provider usageMetadata before any budget
-- ceiling decision. The ceiling is NOT raised here.
--
-- Source of these bytes: supabase/candidates/pkg014b_ai_provider_usage.sql at da5165a,
-- proven by CI run 35187265948 (replay to head 147, additive-surface diff, eleven named
-- runtime checks, TypeScript, 225 suites / 4324 tests).
--
-- Recorded as a DEV operational migration for the same reason as PKG-015: a new source
-- file would force a re-freeze of the admission manifest across 25 proof files.
--
-- Deliberately ADDITIVE. private.ai_test_budget_v5 and private.ai_test_reservations_v5
-- belong to the verified budget engine and are NOT altered: no column is added, no
-- function of theirs is replaced, and the ceiling stays at the reviewed constant. Usage
-- is recorded in its own table keyed by the same operation id, so accounting can never
-- change an admission decision. There is no DROP, DELETE, TRUNCATE, ALTER or
-- CREATE OR REPLACE of any pre-existing object here.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $pkg014b_preflight$
begin
  if to_regclass('private.ai_test_reservations_v5') is null
     or to_regclass('private.ai_test_budget_v5') is null then
    raise exception 'PKG014B_PREDECESSOR_MISMATCH: the AI test budget authority is incomplete'
      using errcode = '55000';
  end if;
  if to_regclass('private.ai_test_usage_v5') is not null
     or to_regprocedure('public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)') is not null then
    raise exception 'PKG014B_ALREADY_PRESENT' using errcode = '55000';
  end if;
end
$pkg014b_preflight$;

create table private.ai_test_usage_v5 (
  operation_id uuid primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  model text not null check (length(btrim(model)) between 1 and 100),
  prompt_tokens integer not null check (prompt_tokens >= 0 and prompt_tokens <= 10000000),
  output_tokens integer not null check (output_tokens >= 0 and output_tokens <= 10000000),
  total_tokens integer not null check (total_tokens >= 0 and total_tokens <= 20000000),
  recorded_at timestamptz not null default clock_timestamp()
);

create index ai_test_usage_v5_account_idx on private.ai_test_usage_v5 (account_id, recorded_at desc);

alter table private.ai_test_usage_v5 enable row level security;
alter table private.ai_test_usage_v5 force row level security;
revoke all on table private.ai_test_usage_v5 from public, anon, authenticated, service_role;

comment on table private.ai_test_usage_v5 is
  'PKG-014B provider-reported token counts per real AI call, keyed by the operation id the reservation uses. Counts only, never content. Accounting, never authorization.';

create function public.rpc_ai_test_record_usage_service(
  p_operation_id uuid,
  p_model text,
  p_prompt_tokens integer,
  p_output_tokens integer,
  p_total_tokens integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_reservation private.ai_test_reservations_v5;
  v_existing private.ai_test_usage_v5;
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
        'totalTokens', v_existing.total_tokens, 'authoritative', true);
    end if;
    raise exception 'AI_USAGE_ALREADY_RECORDED' using errcode = '55000';
  end if;

  insert into private.ai_test_usage_v5(operation_id, account_id, model, prompt_tokens, output_tokens, total_tokens)
    values (p_operation_id, v_reservation.account_id, btrim(p_model), p_prompt_tokens, p_output_tokens, p_total_tokens);

  return jsonb_build_object('operationId', p_operation_id, 'recorded', true,
    'promptTokens', p_prompt_tokens, 'outputTokens', p_output_tokens,
    'totalTokens', p_total_tokens, 'authoritative', true);
end
$function$;

revoke all on function public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer) to service_role;

comment on function public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer) is
  'PKG-014B service-only recorder of provider-reported token counts for an already admitted call. First write wins; it never writes to the reservation or the budget.';

create function public.rpc_ai_test_budget_report_service()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_budget private.ai_test_budget_v5;
  v_calls integer;
  v_with_usage integer;
  v_prompt bigint;
  v_output bigint;
begin
  select * into v_budget from private.ai_test_budget_v5 where singleton;
  select count(*) into v_calls from private.ai_test_reservations_v5;
  select count(*), coalesce(sum(prompt_tokens),0), coalesce(sum(output_tokens),0)
    into v_with_usage, v_prompt, v_output from private.ai_test_usage_v5;

  return jsonb_build_object(
    'providerCalls', v_calls,
    'callsWithReportedUsage', v_with_usage,
    'callsWithoutReportedUsage', v_calls - v_with_usage,
    'inputTokens', case when v_with_usage = 0 then null else v_prompt end,
    'outputTokens', case when v_with_usage = 0 then null else v_output end,
    'realSpendUsd', null,
    'realSpendBasis', 'UNKNOWN: token counts are recorded here, but no approved price table exists in this database; the provider billing console is authoritative',
    'internalTestBudgetCapUsd', round(v_budget.ceiling_microusd / 1000000.0, 2),
    'internalTestBudgetReservedUsd', round(v_budget.reserved_microusd / 1000000.0, 2),
    'remainingAllowedCalls', (v_budget.ceiling_microusd - v_budget.reserved_microusd) / 250000,
    'capIsACallCounter', true,
    'priceValidUntil', v_budget.price_valid_until,
    'authoritative', true);
end
$function$;

revoke all on function public.rpc_ai_test_budget_report_service() from public, anon, authenticated, service_role;
grant execute on function public.rpc_ai_test_budget_report_service() to service_role;

comment on function public.rpc_ai_test_budget_report_service() is
  'PKG-014B authoritative AI test budget report: real provider calls, recorded input and output tokens, the internal cap and the remaining allowed calls. Real spend is null, meaning UNKNOWN, because no price table exists here.';

do $pkg014b_postcondition$
begin
  if to_regclass('private.ai_test_usage_v5') is null
     or to_regprocedure('public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)') is null
     or to_regprocedure('public.rpc_ai_test_budget_report_service()') is null then
    raise exception 'PKG014B_POSTCONDITION_FAILED: usage recording incomplete';
  end if;
  if has_table_privilege('anon', 'private.ai_test_usage_v5', 'SELECT')
     or has_table_privilege('authenticated', 'private.ai_test_usage_v5', 'SELECT')
     or has_table_privilege('service_role', 'private.ai_test_usage_v5', 'SELECT') then
    raise exception 'PKG014B_POSTCONDITION_FAILED: usage table leaked to a role';
  end if;
  if has_function_privilege('anon', 'public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rpc_ai_test_budget_report_service()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.rpc_ai_test_budget_report_service()', 'EXECUTE') then
    raise exception 'PKG014B_POSTCONDITION_FAILED: usage function ACL mismatch';
  end if;
  if (select ceiling_microusd from private.ai_test_budget_v5 where singleton) <> 5000000 then
    raise exception 'PKG014B_POSTCONDITION_FAILED: budget ceiling changed';
  end if;
  if to_regprocedure('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)') is null then
    raise exception 'PKG014B_POSTCONDITION_FAILED: reservation writer missing';
  end if;
end
$pkg014b_postcondition$;