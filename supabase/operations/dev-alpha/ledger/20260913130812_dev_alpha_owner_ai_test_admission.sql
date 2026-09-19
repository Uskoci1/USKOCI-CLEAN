-- Environment-specific DEV/ALPHA admission authorized by the owner.
-- This does not change the existing USD 5 reservation ceiling and performs no provider call.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $configure$
declare
  v_owner uuid;
  v_budget private.ai_test_budget_v5%rowtype;
begin
  select distinct t.account_id into strict v_owner
  from private.ai_need_turn_commands t
  join public.ai_conversations c
    on c.id=t.conversation_id and c.account_id=t.account_id
  where t.updated_at >= statement_timestamp() - interval '20 minutes'
    and t.state='FAILED'
    and not t.provider_dispatched
    and t.cancelled_at is null
    and c.purpose='NEED_INTAKE'
    and c.fact_schema_version='NEED_FACT_V2'
    and c.status='OPEN'
    and exists(select 1 from auth.users u where u.id=t.account_id and u.deleted_at is null)
    and exists(select 1 from public.app_accounts a where a.id=t.account_id);

  perform pg_advisory_xact_lock_shared(private.closure_account_key(v_owner));
  lock table private.ai_test_budget_v5, private.ai_test_accounts_v5,
    private.ai_test_reservations_v5 in access exclusive mode;

  select * into strict v_budget from private.ai_test_budget_v5 where singleton;
  if not v_budget.enabled
    or v_budget.ceiling_microusd is distinct from 5000000::bigint
    or v_budget.reserved_microusd is distinct from 0::bigint
    or statement_timestamp() >= v_budget.price_valid_until
    or (select count(*) from private.ai_test_accounts_v5 where retired_at is null)<>1
    or exists(select 1 from private.ai_test_reservations_v5)
    or private.closure_account_restricted(v_owner)
  then raise exception 'DEV_OWNER_AI_ADMISSION_EXPECTED_STATE_CHANGED'; end if;

  insert into private.ai_test_accounts_v5(account_id) values(v_owner)
  on conflict (account_id) do update set retired_at=null;

  if not exists(select 1 from private.ai_test_accounts_v5 where account_id=v_owner and retired_at is null)
    or (select count(*) from private.ai_test_accounts_v5 where retired_at is null)<>2
    or exists(select 1 from private.ai_test_reservations_v5)
    or not exists(select 1 from private.ai_test_budget_v5 where singleton and enabled
      and ceiling_microusd=5000000 and reserved_microusd=0)
    or private.closure_account_restricted(v_owner)
  then raise exception 'DEV_OWNER_AI_ADMISSION_POSTCONDITION_FAILED'; end if;
end
$configure$;
commit;