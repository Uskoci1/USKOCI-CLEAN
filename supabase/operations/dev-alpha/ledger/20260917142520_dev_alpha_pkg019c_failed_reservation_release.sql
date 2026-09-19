-- PKG-019C: a capture that failed without ever producing usage must give its hold back.
--
-- PKG-019B settled a hold against measured usage. A failed operation records no usage, so
-- nothing ever settled it and the hold stayed locked forever. Eight failed speech attempts
-- were holding 1 600 000 microUSD of a 5 000 000 ceiling against zero real spend.
--
-- Owner approved 2026-09-17 with strict limits: release to zero ONLY where it is proven
-- there is no usage row; keep the reservation and audit row; do not touch admission, the
-- STT cap, the initial reservation amount or the existing successful settlement; and a
-- failed operation that does have usage must never be treated as FAILED_NO_USAGE.
--
-- The postconditions are relational rather than hard-coded. An earlier attempt pinned the
-- MEASURED count to a number read minutes before, the owner kept using the app, and the
-- migration correctly refused itself rather than write against a stale picture.

create temp table pkg019c_before on commit drop as
select count(*) as releasable,
       coalesce(sum(max_cost_microusd), 0) as releasable_microusd,
       (select reserved_microusd from private.ai_test_budget_v5) as reserved,
       (select count(*) from private.ai_test_reservations_v5) as rows_total,
       (select count(*) from private.ai_test_reservations_v5 where settlement_basis = 'CONSERVATIVE_ESTIMATE_UNMEASURED') as estimates
  from private.ai_test_reservations_v5 r
 where r.settled_microusd is null
   and r.created_at < statement_timestamp() - interval '5 minutes'
   and not exists (select 1 from private.ai_test_usage_v5 u where u.operation_id = r.operation_id);

DO $pre$
DECLARE v_with_usage bigint;
BEGIN
  select count(*) into v_with_usage from private.ai_test_reservations_v5 r
   where r.settled_microusd is null
     and exists (select 1 from private.ai_test_usage_v5 u where u.operation_id = r.operation_id);
  IF v_with_usage <> 0 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: % unsettled reservations carry usage and must not be released', v_with_usage;
  END IF;
  IF (select releasable from pkg019c_before) = 0 THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: nothing is releasable; review before reapplying';
  END IF;
END
$pre$;

alter table private.ai_test_reservations_v5
  drop constraint if exists ai_test_reservations_v5_settlement_check;
alter table private.ai_test_reservations_v5
  add constraint ai_test_reservations_v5_settlement_check check (
    (settled_microusd is null and settlement_basis is null and settled_at is null)
    or (settled_microusd between 0 and max_cost_microusd
        and settlement_basis in ('MEASURED', 'CONSERVATIVE_ESTIMATE_UNMEASURED', 'FAILED_NO_USAGE')
        and settled_at is not null));

create or replace function public.rpc_ai_test_release_unused_reservation_service(p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $function$
declare
  v_reservation private.ai_test_reservations_v5;
  v_rows integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_operation_id is null then raise exception 'AI_RELEASE_INPUT_INVALID' using errcode = '22023'; end if;

  select * into v_reservation from private.ai_test_reservations_v5 where operation_id = p_operation_id;
  if not found then raise exception 'AI_RELEASE_NO_RESERVATION' using errcode = '42501'; end if;

  -- A failed operation that nevertheless produced usage is a real call. It settles through
  -- the measured path and must never be recorded as FAILED_NO_USAGE.
  if exists (select 1 from private.ai_test_usage_v5 where operation_id = p_operation_id) then
    return jsonb_build_object('operationId', p_operation_id, 'released', false,
      'code', 'AI_RELEASE_REFUSED_USAGE_EXISTS', 'releasedMicrousd', 0,
      'settlementBasis', v_reservation.settlement_basis, 'settledMicrousd', v_reservation.settled_microusd);
  end if;

  if v_reservation.settled_microusd is not null then
    return jsonb_build_object('operationId', p_operation_id, 'released', false,
      'code', 'AI_RELEASE_ALREADY_SETTLED', 'releasedMicrousd', 0,
      'settlementBasis', v_reservation.settlement_basis, 'settledMicrousd', v_reservation.settled_microusd);
  end if;

  -- The same singleton lock the reservation writer and the measured settlement take.
  perform 1 from private.ai_test_budget_v5 where singleton for update;
  update private.ai_test_reservations_v5
     set settled_microusd = 0, settlement_basis = 'FAILED_NO_USAGE', settled_at = statement_timestamp()
   where operation_id = p_operation_id and settled_microusd is null;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('operationId', p_operation_id, 'released', false,
      'code', 'AI_RELEASE_ALREADY_SETTLED', 'releasedMicrousd', 0);
  end if;

  update private.ai_test_budget_v5
     set reserved_microusd = greatest(0, reserved_microusd - v_reservation.max_cost_microusd) where singleton;

  return jsonb_build_object('operationId', p_operation_id, 'released', true,
    'code', 'AI_RELEASE_DONE', 'releasedMicrousd', v_reservation.max_cost_microusd,
    'settlementBasis', 'FAILED_NO_USAGE', 'settledMicrousd', 0);
end
$function$;

revoke all on function public.rpc_ai_test_release_unused_reservation_service(uuid) from public;
grant execute on function public.rpc_ai_test_release_unused_reservation_service(uuid) to service_role;

-- One-time release of the holds already stuck. Only rows with no usage at all, and only
-- those older than five minutes, so nothing in flight can be released.
update private.ai_test_reservations_v5 r
   set settled_microusd = 0, settlement_basis = 'FAILED_NO_USAGE', settled_at = statement_timestamp()
 where r.settled_microusd is null
   and r.created_at < statement_timestamp() - interval '5 minutes'
   and not exists (select 1 from private.ai_test_usage_v5 u where u.operation_id = r.operation_id);

update private.ai_test_budget_v5 b
   set reserved_microusd = (select coalesce(sum(coalesce(r.settled_microusd, r.max_cost_microusd)), 0)
                              from private.ai_test_reservations_v5 r)
 where b.singleton;

DO $post$
DECLARE b record; v_ceiling bigint; v_reserved bigint; v_rows bigint; v_failed bigint;
        v_measured bigint; v_estimate bigint; v_sum bigint; v_bad bigint; v_nonzero bigint;
        v_usage_backed bigint; v_stale bigint;
BEGIN
  select * into b from pkg019c_before;
  select ceiling_microusd, reserved_microusd into v_ceiling, v_reserved from private.ai_test_budget_v5 where singleton;
  select count(*), count(*) filter (where settlement_basis='FAILED_NO_USAGE'),
         count(*) filter (where settlement_basis='MEASURED'),
         count(*) filter (where settlement_basis='CONSERVATIVE_ESTIMATE_UNMEASURED'),
         coalesce(sum(coalesce(settled_microusd, max_cost_microusd)),0)
    into v_rows, v_failed, v_measured, v_estimate, v_sum from private.ai_test_reservations_v5;
  select count(*) into v_bad from private.ai_test_reservations_v5 r
   where r.settlement_basis = 'FAILED_NO_USAGE'
     and exists (select 1 from private.ai_test_usage_v5 u where u.operation_id = r.operation_id);
  select count(*) into v_nonzero from private.ai_test_reservations_v5
   where settlement_basis = 'FAILED_NO_USAGE' and settled_microusd <> 0;
  select count(*) into v_usage_backed from private.ai_test_usage_v5 u
    join private.ai_test_reservations_v5 r on r.operation_id = u.operation_id
   where r.settlement_basis = 'MEASURED';
  select count(*) into v_stale from private.ai_test_reservations_v5 r
   where r.settled_microusd is null
     and r.created_at < statement_timestamp() - interval '5 minutes'
     and not exists (select 1 from private.ai_test_usage_v5 u where u.operation_id = r.operation_id);

  IF v_ceiling <> 5000000 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: the ceiling moved'; END IF;
  IF v_rows <> b.rows_total THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: rows went from % to %', b.rows_total, v_rows; END IF;
  IF v_failed <> b.releasable THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: released % but % were releasable', v_failed, b.releasable; END IF;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: % rows marked FAILED_NO_USAGE despite having usage', v_bad; END IF;
  IF v_nonzero <> 0 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: % released rows are not zero', v_nonzero; END IF;
  IF v_stale <> 0 THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: % stale unusable holds survived', v_stale; END IF;
  IF v_measured <> v_usage_backed THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: % MEASURED rows but % backed by usage', v_measured, v_usage_backed; END IF;
  IF v_estimate <> b.estimates THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: estimates changed from % to %', b.estimates, v_estimate; END IF;
  IF v_reserved <> v_sum THEN RAISE EXCEPTION 'POSTCONDITION_FAILED: reserved % <> settled sum %', v_reserved, v_sum; END IF;
  IF v_reserved <> b.reserved - b.releasable_microusd THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: reserved is % but % - % was expected', v_reserved, b.reserved, b.releasable_microusd; END IF;
  IF (select count(*) from private.ai_test_reservations_v5 where kind='STT' and max_cost_microusd=200000)
     <> (select count(*) from private.ai_test_reservations_v5 where kind='STT') THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: an STT cap was rewritten'; END IF;
  IF (select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='rpc_ai_test_budget_reserve_service') <> '6cd527442c55a96a81bf885084755451' THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: admission logic was modified'; END IF;
END
$post$;