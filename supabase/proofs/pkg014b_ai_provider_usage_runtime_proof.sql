-- USKOČI PKG-014B — rollback-only disposable runtime proof.
-- Requires the current canonical AI test budget authority plus the source candidate
-- supabase/candidates/pkg014b_ai_provider_usage.sql.
-- No Edge deploy, no provider call, no canonical DEV mutation. Every row below is
-- synthetic, created inside this transaction and discarded by the final rollback.
\set ON_ERROR_STOP on

begin;

do $seed$
declare
  v_account uuid := gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values (v_account,'authenticated','authenticated',
    'pkg014b-proof-'||v_account::text||'@proof.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name','PKG014B Proof Account'),
    statement_timestamp(),statement_timestamp());
  perform set_config('uskoci.pkg014b_account',v_account::text,true);
  perform set_config('uskoci.pkg014b_admitted',gen_random_uuid()::text,true);
  perform set_config('uskoci.pkg014b_unreserved',gen_random_uuid()::text,true);

  -- The reservation writer is deliberately closed by default, so the proof opens the
  -- same three gates a real operator opens, rather than bypassing the writer. All three
  -- are synthetic and vanish with the rollback.
  --   1. the writer refuses any caller whose JWT role is not service_role
  perform set_config('request.jwt.claim.role','service_role',true);
  --   2. the $5 batch ships disabled
  update private.ai_test_budget_v5 set enabled = true where singleton;
  --   3. only an admitted account may reserve
  insert into private.ai_test_accounts_v5(account_id) values (v_account);

  -- Snapshot the budget the verified engine owns, so the proof can show it never moved.
  perform set_config('uskoci.pkg014b_reserved_before',
    (select reserved_microusd::text from private.ai_test_budget_v5 where singleton),true);
end
$seed$;

-- 1. Usage may not be recorded for a call that was never admitted.
do $no_reservation$
declare
  v_unreserved uuid := current_setting('uskoci.pkg014b_unreserved')::uuid;
  v_refused boolean := false;
begin
  begin
    perform public.rpc_ai_test_record_usage_service(v_unreserved,'gemini-3.8-flash',10,20,30);
  exception when sqlstate '42501' then v_refused := true;
  end;
  if not v_refused then raise exception 'PKG014B_USAGE_WITHOUT_RESERVATION_ACCEPTED'; end if;
  if exists(select 1 from private.ai_test_usage_v5 where operation_id=v_unreserved) then
    raise exception 'PKG014B_REFUSED_WRITE_LEFT_A_ROW';
  end if;
end
$no_reservation$;

-- 2. A real admission, then the counts the provider reported for it.
do $record$
declare
  v_account uuid := current_setting('uskoci.pkg014b_account')::uuid;
  v_op uuid := current_setting('uskoci.pkg014b_admitted')::uuid;
  v_reservation jsonb;
  v_receipt jsonb;
begin
  -- The existing reservation writer, unchanged, admits the call.
  v_reservation := public.rpc_ai_test_budget_reserve_service(v_account,v_op,'LLM',250000::bigint);
  if (v_reservation->>'admitted')::boolean is distinct from true then
    raise exception 'PKG014B_RESERVATION_NOT_ADMITTED';
  end if;

  v_receipt := public.rpc_ai_test_record_usage_service(v_op,'gemini-3.8-flash',1234,567,1801);
  if (v_receipt->>'recorded')::boolean is distinct from true
     or (v_receipt->>'promptTokens')::int <> 1234 or (v_receipt->>'outputTokens')::int <> 567
     or (v_receipt->>'totalTokens')::int <> 1801
     or (v_receipt->>'authoritative')::boolean is distinct from true then
    raise exception 'PKG014B_RECORD_RECEIPT_INVALID';
  end if;
  if (select account_id from private.ai_test_usage_v5 where operation_id=v_op) <> v_account then
    raise exception 'PKG014B_USAGE_ACCOUNT_MISMATCH';
  end if;
end
$record$;

-- 3. Replaying identical counts is a no-op; different counts are refused rather than
--    silently overwriting what the provider first reported.
do $idempotent$
declare
  v_op uuid := current_setting('uskoci.pkg014b_admitted')::uuid;
  v_receipt jsonb;
  v_conflict boolean := false;
begin
  v_receipt := public.rpc_ai_test_record_usage_service(v_op,'gemini-3.8-flash',1234,567,1801);
  if (v_receipt->>'recorded')::boolean is distinct from false then
    raise exception 'PKG014B_REPLAY_NOT_IDEMPOTENT';
  end if;
  begin
    perform public.rpc_ai_test_record_usage_service(v_op,'gemini-3.8-flash',9999,1,10000);
  exception when sqlstate '55000' then v_conflict := true;
  end;
  if not v_conflict then raise exception 'PKG014B_OVERWRITE_ACCEPTED'; end if;
  if (select prompt_tokens from private.ai_test_usage_v5 where operation_id=v_op) <> 1234 then
    raise exception 'PKG014B_FIRST_REPORT_OVERWRITTEN';
  end if;
  if (select count(*) from private.ai_test_usage_v5) <> 1 then
    raise exception 'PKG014B_USAGE_ROW_COUNT_INVALID';
  end if;
end
$idempotent$;

-- 4. Malformed input is refused before anything is written.
do $rejections$
declare
  v_op uuid := current_setting('uskoci.pkg014b_admitted')::uuid;
  v_null boolean := false;
  v_negative boolean := false;
begin
  begin perform public.rpc_ai_test_record_usage_service(v_op,'gemini-3.8-flash',null,1,1);
  exception when sqlstate '22023' then v_null := true; end;
  begin perform public.rpc_ai_test_record_usage_service(v_op,'gemini-3.8-flash',-1,1,1);
  exception when sqlstate '22023' then v_negative := true; end;
  if not v_null or not v_negative then raise exception 'PKG014B_MALFORMED_USAGE_ACCEPTED'; end if;
end
$rejections$;

-- 5. Accounting never touches the verified budget engine.
do $budget_untouched$
declare
  v_before bigint := current_setting('uskoci.pkg014b_reserved_before')::bigint;
begin
  if (select ceiling_microusd from private.ai_test_budget_v5 where singleton) <> 5000000 then
    raise exception 'PKG014B_CEILING_CHANGED';
  end if;
  -- One reservation was made by this proof, and nothing else moved the counter.
  if (select reserved_microusd from private.ai_test_budget_v5 where singleton) <> v_before + 250000 then
    raise exception 'PKG014B_RESERVED_MOVED_BY_ACCOUNTING';
  end if;
  if to_regprocedure('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)') is null then
    raise exception 'PKG014B_RESERVATION_WRITER_MISSING';
  end if;
end
$budget_untouched$;

-- 6. The report answers the owner's fields, and says UNKNOWN rather than zero for money.
do $report$
declare
  v jsonb := public.rpc_ai_test_budget_report_service();
begin
  if (v->>'callsWithReportedUsage')::int <> 1 then raise exception 'PKG014B_REPORT_USAGE_COUNT_INVALID'; end if;
  if (v->>'inputTokens')::bigint <> 1234 or (v->>'outputTokens')::bigint <> 567 then
    raise exception 'PKG014B_REPORT_TOKENS_INVALID';
  end if;
  -- Real spend must be null, meaning UNKNOWN. A zero here would be a lie.
  if v->'realSpendUsd' <> 'null'::jsonb then raise exception 'PKG014B_REPORT_INVENTED_A_COST'; end if;
  if (v->>'internalTestBudgetCapUsd')::numeric <> 5.00 then raise exception 'PKG014B_REPORT_CAP_INVALID'; end if;
  if (v->>'capIsACallCounter')::boolean is distinct from true then raise exception 'PKG014B_REPORT_CAP_SEMANTICS_LOST'; end if;
  if (v->>'remainingAllowedCalls')::int
     <> ((select (ceiling_microusd - reserved_microusd)/250000 from private.ai_test_budget_v5 where singleton)) then
    raise exception 'PKG014B_REPORT_REMAINING_INVALID';
  end if;
  if (v->>'authoritative')::boolean is distinct from true then raise exception 'PKG014B_REPORT_NOT_AUTHORITATIVE'; end if;
end
$report$;

-- 7. No client role may record usage or read the report.
set local role authenticated;
do $client_denied$
declare
  v_op uuid := current_setting('uskoci.pkg014b_admitted')::uuid;
  v_write boolean := false;
  v_read boolean := false;
begin
  begin perform public.rpc_ai_test_record_usage_service(v_op,'gemini-3.8-flash',1,1,2);
  exception when insufficient_privilege then v_write := true; end;
  begin perform public.rpc_ai_test_budget_report_service();
  exception when insufficient_privilege then v_read := true; end;
  if not v_write or not v_read then raise exception 'PKG014B_CLIENT_REACHED_USAGE_FUNCTIONS'; end if;
end
$client_denied$;
reset role;

do $acl_guard$
begin
  if has_table_privilege('anon','private.ai_test_usage_v5','SELECT')
     or has_table_privilege('authenticated','private.ai_test_usage_v5','SELECT')
     or has_table_privilege('service_role','private.ai_test_usage_v5','SELECT') then
    raise exception 'PKG014B_USAGE_TABLE_LEAKED';
  end if;
  if not has_function_privilege('service_role','public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.rpc_ai_test_budget_report_service()','EXECUTE') then
    raise exception 'PKG014B_SERVICE_FUNCTIONS_MISSING';
  end if;
end
$acl_guard$;

rollback;

select 'PASS PKG014B_AI_PROVIDER_USAGE reservation_required recorded first_report_wins idempotent_replay overwrite_refused malformed_refused budget_untouched report_fields unknown_not_zero client_denied acl' as result;
