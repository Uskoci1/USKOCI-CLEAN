#!/usr/bin/env bash
set -euo pipefail

: "${DB_URL:?DB_URL is required}"

OWNER="00000000-0000-4000-8000-00000000b071"
NEED_A="00000000-0000-4000-8000-00000000b0a1"
NEED_B="00000000-0000-4000-8000-00000000b0b1"
NEED_C="00000000-0000-4000-8000-00000000b0c1"
DEADLINE_1="2099-01-01T12:00:00Z"
DEADLINE_2="2099-01-01T13:00:00Z"

psql_base=(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1)

wait_for_gate_sleep() {
  local app="$1"
  local i count
  for i in $(seq 1 40); do
    count="$(${psql_base[@]} -c "select count(*) from pg_stat_activity where application_name='${app}' and state='active' and wait_event='PgSleep';")"
    if [[ "$count" == "1" ]]; then
      return 0
    fi
    sleep 0.1
  done
  echo "gate ${app} did not reach PgSleep after acquiring its lock" >&2
  return 1
}

wait_for_two_lock_waiters() {
  local app1="$1"
  local app2="$2"
  local i count
  for i in $(seq 1 30); do
    count="$(${psql_base[@]} -c "select count(*) from pg_stat_activity where application_name in ('${app1}','${app2}') and state='active' and wait_event_type='Lock';")"
    if [[ "$count" == "2" ]]; then
      echo "TRUE_CONCURRENCY_WAITERS ${app1} ${app2} count=2"
      return 0
    fi
    sleep 0.1
  done
  echo "did not observe two concurrent lock waiters for ${app1}/${app2}" >&2
  ${psql_base[@]} -c "select application_name,state,coalesce(wait_event_type,''),coalesce(wait_event,'') from pg_stat_activity where application_name in ('${app1}','${app2}') order by application_name;" >&2 || true
  return 1
}

run_publish() {
  local app="$1"
  local need="$2"
  local seq="$3"
  local deadline="$4"
  local key="$5"
  local log="$6"

  PGAPPNAME="$app" psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 >"$log" 2>&1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${OWNER}',true);
select set_config('request.jwt.claims','',true);
select public.rpc_publish_need_canonical(
  '${need}'::uuid,
  1,
  ${seq}::bigint,
  '${deadline}'::timestamptz,
  '${key}'
);
commit;
SQL
}

assert_need_postconditions() {
  local need="$1"
  local expected_receipts="$2"
  local status receipts dispatch
  status="$(${psql_base[@]} -c "select status from public.needs where id='${need}'::uuid;")"
  receipts="$(${psql_base[@]} -c "select count(*) from private.need_publish_commands where need_id='${need}'::uuid;")"
  dispatch="$(${psql_base[@]} -c "select count(*) from private.dispatch_schedule where need_id='${need}'::uuid;")"
  [[ "$status" == "PUBLISHED" ]] || { echo "unexpected status for ${need}: ${status}" >&2; return 1; }
  [[ "$receipts" == "$expected_receipts" ]] || { echo "unexpected receipt count for ${need}: ${receipts}" >&2; return 1; }
  [[ "$dispatch" == "1" ]] || { echo "unexpected dispatch count for ${need}: ${dispatch}" >&2; return 1; }
}

"${psql_base[@]}" -f "$GITHUB_WORKSPACE/supabase/proofs/ru3_b07_concurrency_setup.sql" | tee /tmp/ru3-b07-concurrency-setup.log
grep -F "PASS RU3_B07_CONCURRENCY_SETUP" /tmp/ru3-b07-concurrency-setup.log >/dev/null

SEQ_A="$(${psql_base[@]} -c "select decision_sequence from private.need_publication_decisions where need_id='${NEED_A}'::uuid order by decision_sequence desc limit 1;")"
SEQ_B="$(${psql_base[@]} -c "select decision_sequence from private.need_publication_decisions where need_id='${NEED_B}'::uuid order by decision_sequence desc limit 1;")"
SEQ_C="$(${psql_base[@]} -c "select decision_sequence from private.need_publication_decisions where need_id='${NEED_C}'::uuid order by decision_sequence desc limit 1;")"
[[ -n "$SEQ_A" && -n "$SEQ_B" && -n "$SEQ_C" ]] || { echo "missing synthetic ALLOW decision sequence" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Case A: same key + same payload. Both sessions are forced to overlap by a
# third transaction holding the exact advisory lock used by the RPC.
# Expected: one publish, one idempotent replay, one receipt, one dispatch.
# ---------------------------------------------------------------------------
KEY_A="ru3-b07-concurrent-same-0001"
APP_A1="ru3_b07_same_a"
APP_A2="ru3_b07_same_b"
GATE_A="ru3_b07_gate_same"

PGAPPNAME="$GATE_A" psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 >/tmp/ru3-b07-gate-a.log 2>&1 <<SQL &
begin;
select pg_advisory_xact_lock(hashtextextended('${OWNER}' || E'\n' || '${KEY_A}',0));
select pg_sleep(5);
commit;
SQL
gate_a=$!
wait_for_gate_sleep "$GATE_A"

set +e
run_publish "$APP_A1" "$NEED_A" "$SEQ_A" "$DEADLINE_1" "$KEY_A" /tmp/ru3-b07-a1.log &
pid_a1=$!
run_publish "$APP_A2" "$NEED_A" "$SEQ_A" "$DEADLINE_1" "$KEY_A" /tmp/ru3-b07-a2.log &
pid_a2=$!
set -e
wait_for_two_lock_waiters "$APP_A1" "$APP_A2"
wait "$gate_a"
set +e
wait "$pid_a1"; rc_a1=$?
wait "$pid_a2"; rc_a2=$?
set -e
[[ "$rc_a1" == "0" && "$rc_a2" == "0" ]] || {
  cat /tmp/ru3-b07-a1.log /tmp/ru3-b07-a2.log >&2
  echo "same-key/same-payload expected both calls to succeed" >&2
  exit 1
}
cat /tmp/ru3-b07-a1.log /tmp/ru3-b07-a2.log >/tmp/ru3-b07-a-combined.log
grep -F '"idempotentReplay": false' /tmp/ru3-b07-a-combined.log >/dev/null
grep -F '"idempotentReplay": true' /tmp/ru3-b07-a-combined.log >/dev/null
assert_need_postconditions "$NEED_A" 1

echo "PASS RU3_B07_CONCURRENCY same_key_same_payload one_publish_one_replay"

# ---------------------------------------------------------------------------
# Case B: same key + different payload. The same advisory-lock gate proves both
# calls are in flight before release.
# Expected: one publish, one IDEMPOTENCY_KEY_REUSED, one receipt, one dispatch.
# ---------------------------------------------------------------------------
KEY_B="ru3-b07-concurrent-diff-0001"
APP_B1="ru3_b07_diff_a"
APP_B2="ru3_b07_diff_b"
GATE_B="ru3_b07_gate_diff"

PGAPPNAME="$GATE_B" psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 >/tmp/ru3-b07-gate-b.log 2>&1 <<SQL &
begin;
select pg_advisory_xact_lock(hashtextextended('${OWNER}' || E'\n' || '${KEY_B}',0));
select pg_sleep(5);
commit;
SQL
gate_b=$!
wait_for_gate_sleep "$GATE_B"

set +e
run_publish "$APP_B1" "$NEED_B" "$SEQ_B" "$DEADLINE_1" "$KEY_B" /tmp/ru3-b07-b1.log &
pid_b1=$!
run_publish "$APP_B2" "$NEED_B" "$SEQ_B" "$DEADLINE_2" "$KEY_B" /tmp/ru3-b07-b2.log &
pid_b2=$!
set -e
wait_for_two_lock_waiters "$APP_B1" "$APP_B2"
wait "$gate_b"
set +e
wait "$pid_b1"; rc_b1=$?
wait "$pid_b2"; rc_b2=$?
set -e
if ! { [[ "$rc_b1" == "0" && "$rc_b2" != "0" ]] || [[ "$rc_b1" != "0" && "$rc_b2" == "0" ]]; }; then
  cat /tmp/ru3-b07-b1.log /tmp/ru3-b07-b2.log >&2
  echo "same-key/different-payload expected exactly one success" >&2
  exit 1
fi
cat /tmp/ru3-b07-b1.log /tmp/ru3-b07-b2.log >/tmp/ru3-b07-b-combined.log
grep -F 'IDEMPOTENCY_KEY_REUSED' /tmp/ru3-b07-b-combined.log >/dev/null
assert_need_postconditions "$NEED_B" 1

echo "PASS RU3_B07_CONCURRENCY same_key_different_payload rejected_reuse"

# ---------------------------------------------------------------------------
# Case C: different keys + same Need. A third transaction holds the Need row,
# forcing both authenticated sessions to reach the row-lock boundary together.
# Expected: one publish, one NEED_NOT_DRAFT, one receipt, one dispatch.
# ---------------------------------------------------------------------------
KEY_C1="ru3-b07-concurrent-need-0001"
KEY_C2="ru3-b07-concurrent-need-0002"
APP_C1="ru3_b07_need_a"
APP_C2="ru3_b07_need_b"
GATE_C="ru3_b07_gate_need"

PGAPPNAME="$GATE_C" psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 >/tmp/ru3-b07-gate-c.log 2>&1 <<SQL &
begin;
select id from public.needs where id='${NEED_C}'::uuid for update;
select pg_sleep(5);
commit;
SQL
gate_c=$!
wait_for_gate_sleep "$GATE_C"

set +e
run_publish "$APP_C1" "$NEED_C" "$SEQ_C" "$DEADLINE_1" "$KEY_C1" /tmp/ru3-b07-c1.log &
pid_c1=$!
run_publish "$APP_C2" "$NEED_C" "$SEQ_C" "$DEADLINE_1" "$KEY_C2" /tmp/ru3-b07-c2.log &
pid_c2=$!
set -e
wait_for_two_lock_waiters "$APP_C1" "$APP_C2"
wait "$gate_c"
set +e
wait "$pid_c1"; rc_c1=$?
wait "$pid_c2"; rc_c2=$?
set -e
if ! { [[ "$rc_c1" == "0" && "$rc_c2" != "0" ]] || [[ "$rc_c1" != "0" && "$rc_c2" == "0" ]]; }; then
  cat /tmp/ru3-b07-c1.log /tmp/ru3-b07-c2.log >&2
  echo "different-key/same-Need expected exactly one success" >&2
  exit 1
fi
cat /tmp/ru3-b07-c1.log /tmp/ru3-b07-c2.log >/tmp/ru3-b07-c-combined.log
grep -F 'NEED_NOT_DRAFT' /tmp/ru3-b07-c-combined.log >/dev/null
assert_need_postconditions "$NEED_C" 1

echo "PASS RU3_B07_CONCURRENCY different_key_same_need single_publish"

echo "PASS RU3_B07_TRUE_CONCURRENCY_PROVEN waiters_observed=2x3 no_duplicate_publish no_duplicate_dispatch"
