-- Environment-specific OWNER AF-D20/26 configuration, not a schema migration.
-- Target: canonical DEV/ALPHA leqcwgzvjsxugfgzdmth only.
-- Run only after this exact QA identity was created through ordinary Auth and
-- its email confirmation was independently observed. No owner account admitted.
-- USD5 is the existing shared internal reservation ceiling, not measured billing.
-- No reset/refund, provider call, function, grant or policy activation is performed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $configure$
declare
  v_qa uuid;
  v_budget private.ai_test_budget_v5%rowtype;
  v_changed integer;
begin
  -- Resolve the actual ordinary Auth identity by its unique approved mailbox.
  -- The label is a fixture constraint, never an application privilege claim.
  select u.id into strict v_qa from auth.users u
    where lower(u.email)=lower('msljivic031+uskoci-qa@gmail.com')
      and u.raw_user_meta_data->>'full_name'='USKOCI TEST INTERNAL QA'
      and u.deleted_at is null and u.email_confirmed_at is not null;

  -- Same account-before-budget order as the canonical reservation RPC.
  perform pg_advisory_xact_lock_shared(private.closure_account_key(v_qa));
  lock table private.ai_test_budget_v5, private.ai_test_accounts_v5,
    private.ai_test_reservations_v5 in access exclusive mode;

  select * into strict v_budget from private.ai_test_budget_v5 where singleton;
  if v_budget.enabled is distinct from false
    or v_budget.ceiling_microusd is distinct from 5000000::bigint
    or v_budget.reserved_microusd is distinct from 0::bigint
    or v_budget.price_valid_until is distinct from '2027-01-01T00:00:00Z'::timestamptz
    or statement_timestamp() >= v_budget.price_valid_until
    or exists(select 1 from private.ai_test_accounts_v5)
    or exists(select 1 from private.ai_test_reservations_v5)
  then raise exception 'DEV_QA_BUDGET_EXPECTED_STATE_CHANGED'; end if;

  perform 1 from auth.users u where u.id=v_qa
    and lower(u.email)=lower('msljivic031+uskoci-qa@gmail.com')
    and u.raw_user_meta_data->>'full_name'='USKOCI TEST INTERNAL QA'
    and u.deleted_at is null and u.email_confirmed_at is not null for share;
  if not found then raise exception 'DEV_QA_CONFIRMED_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.app_accounts a where a.id=v_qa)
    or private.closure_account_restricted(v_qa)
  then raise exception 'DEV_QA_ACCOUNT_NOT_AVAILABLE'; end if;

  insert into private.ai_test_accounts_v5(account_id) values(v_qa);
  update private.ai_test_budget_v5 set enabled=true
    where singleton and enabled=false and ceiling_microusd=5000000
      and reserved_microusd=0
      and price_valid_until='2027-01-01T00:00:00Z'::timestamptz;
  get diagnostics v_changed = row_count;
  if v_changed<>1
    or (select count(*) from private.ai_test_accounts_v5)<>1
    or not exists(select 1 from private.ai_test_accounts_v5
      where account_id=v_qa and retired_at is null)
    or exists(select 1 from private.ai_test_reservations_v5)
    or not exists(select 1 from private.ai_test_budget_v5 where singleton
      and enabled and ceiling_microusd=5000000 and reserved_microusd=0
      and reserved_microusd=(select coalesce(sum(max_cost_microusd),0)
        from private.ai_test_reservations_v5)
      and price_valid_until='2027-01-01T00:00:00Z'::timestamptz)
    or private.closure_account_restricted(v_qa)
  then raise exception 'DEV_QA_BUDGET_POSTCONDITION_FAILED'; end if;
end
$configure$;
commit;
