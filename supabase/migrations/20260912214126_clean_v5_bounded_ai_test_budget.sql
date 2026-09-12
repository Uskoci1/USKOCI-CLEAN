-- Owner-authorized V5 provider TEST ceiling. This is not platform pricing.
-- Closed by default: an operator must enable this exact $5 batch and admit test accounts.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table private.ai_test_budget_v5 (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  ceiling_microusd bigint not null default 5000000 check (ceiling_microusd = 5000000),
  reserved_microusd bigint not null default 0 check (reserved_microusd between 0 and 5000000),
  price_valid_until timestamptz not null default '2027-01-01T00:00:00Z'
    check (price_valid_until <= '2027-01-01T00:00:00Z'::timestamptz)
);
insert into private.ai_test_budget_v5(singleton) values (true);

create table private.ai_test_accounts_v5 (
  account_id uuid primary key,
  admitted_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz,
  check (retired_at is null or retired_at >= admitted_at)
);

create table private.ai_test_reservations_v5 (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  account_id uuid not null,
  kind text not null check (kind in ('LLM', 'STT')),
  max_cost_microusd bigint not null,
  created_at timestamptz not null default statement_timestamp(),
  check ((kind = 'LLM' and max_cost_microusd = 250000)
    or (kind = 'STT' and max_cost_microusd = 200000))
);
comment on table private.ai_test_reservations_v5 is
  'Conservative allocated maximum, not measured provider billing. No transcript/audio/token/secret. No automatic refunds after failed or uncertain I/O.';

alter table private.ai_test_budget_v5 enable row level security;
alter table private.ai_test_accounts_v5 enable row level security;
alter table private.ai_test_reservations_v5 enable row level security;
revoke all on private.ai_test_budget_v5, private.ai_test_accounts_v5, private.ai_test_reservations_v5
  from public, anon, authenticated, service_role;

create function public.rpc_ai_test_budget_reserve_service(
  p_account_id uuid, p_operation_id uuid, p_kind text, p_max_cost_microusd bigint
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private
as $function$
declare
  v_budget private.ai_test_budget_v5%rowtype;
  v_existing private.ai_test_reservations_v5%rowtype;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_account_id is null or p_operation_id is null or p_kind not in ('LLM','STT') or p_kind is null
    or p_max_cost_microusd is distinct from case p_kind when 'LLM' then 250000::bigint when 'STT' then 200000::bigint end then
    raise exception 'AI_TEST_RESERVATION_INVALID';
  end if;

  -- Match existing closure ordering before the global budget row. A closing
  -- account cannot acquire a fresh provider operation.
  perform pg_advisory_xact_lock_shared(private.closure_account_key(p_account_id));
  -- Every reservation shares this row, so different accounts cannot each spend $5.
  select * into strict v_budget from private.ai_test_budget_v5 where singleton for update;
  select * into v_existing from private.ai_test_reservations_v5 where operation_id = p_operation_id;
  if found then
    if v_existing.account_id <> p_account_id or v_existing.kind <> p_kind
      or v_existing.max_cost_microusd <> p_max_cost_microusd then
      raise exception 'AI_TEST_OPERATION_CONFLICT';
    end if;
    -- Admission is deliberately false: a retry may read its existing receipt but cannot call a provider again.
    return jsonb_build_object('admitted',false,'reservationId',v_existing.id,'replay',true,'code','AI_TEST_OPERATION_REPLAY');
  end if;

  if not v_budget.enabled or statement_timestamp() >= v_budget.price_valid_until then
    return jsonb_build_object('admitted',false,'reservationId',null,'replay',false,'code','AI_TEST_BUDGET_NOT_READY');
  end if;
  if not exists(select 1 from private.ai_test_accounts_v5 where account_id=p_account_id and retired_at is null)
    or not exists(select 1 from auth.users where id=p_account_id and deleted_at is null)
    or private.closure_account_restricted(p_account_id) then
    return jsonb_build_object('admitted',false,'reservationId',null,'replay',false,'code','AI_TEST_ACCOUNT_NOT_ADMITTED');
  end if;
  if v_budget.reserved_microusd + p_max_cost_microusd > v_budget.ceiling_microusd then
    return jsonb_build_object('admitted',false,'reservationId',null,'replay',false,'code','AI_TEST_BUDGET_EXHAUSTED');
  end if;

  insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd)
    values(p_operation_id,p_account_id,p_kind,p_max_cost_microusd) returning id into v_id;
  update private.ai_test_budget_v5 set reserved_microusd=reserved_microusd+p_max_cost_microusd where singleton;
  return jsonb_build_object('admitted',true,'reservationId',v_id,'replay',false,'code','AI_TEST_RESERVED');
end
$function$;
revoke all on function public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint) to service_role;
commit;
