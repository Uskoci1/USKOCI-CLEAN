#!/usr/bin/env bash
set -euo pipefail

: "${DB_URL:?DB_URL is required}"
: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"

OWNER="00000000-0000-4000-8000-00000000c401"
NEED_A="00000000-0000-4000-8000-00000000c4a1"
NEED_B="00000000-0000-4000-8000-00000000c4b1"
NEED_C="00000000-0000-4000-8000-00000000c4c1"
psql_base=(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1)

wait_for_gate_sleep() {
  local app="$1"
  local i count
  for i in $(seq 1 50); do
    count="$(${psql_base[@]} -c "select count(*) from pg_stat_activity where application_name='${app}' and state='active' and wait_event='PgSleep';")"
    [[ "$count" == "1" ]] && return 0
    sleep 0.1
  done
  echo "gate ${app} did not reach PgSleep" >&2
  return 1
}

wait_for_two_lock_waiters() {
  local app1="$1" app2="$2"
  local i count
  for i in $(seq 1 40); do
    count="$(${psql_base[@]} -c "select count(*) from pg_stat_activity where application_name in ('${app1}','${app2}') and state='active' and wait_event_type='Lock';")"
    if [[ "$count" == "2" ]]; then
      echo "TRUE_CONCURRENCY_WAITERS ${app1} ${app2} count=2"
      return 0
    fi
    sleep 0.1
  done
  ${psql_base[@]} -c "select application_name,state,coalesce(wait_event_type,''),coalesce(wait_event,'') from pg_stat_activity where application_name in ('${app1}','${app2}') order by application_name;" >&2 || true
  echo "did not observe two concurrent lock waiters for ${app1}/${app2}" >&2
  return 1
}

run_revise() {
  local app="$1" need="$2" key="$3" reason="$4" log="$5"
  PGAPPNAME="$app" psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 >"$log" 2>&1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${OWNER}',true);
select set_config('request.jwt.claims','',true);
select public.rpc_revise_need_to_draft('${need}'::uuid,1,'${key}','${reason}');
commit;
SQL
}

assert_postconditions() {
  local need="$1"
  local status revision commands events dispatch
  status="$(${psql_base[@]} -c "select status from public.needs where id='${need}'::uuid;")"
  revision="$(${psql_base[@]} -c "select revision from public.needs where id='${need}'::uuid;")"
  commands="$(${psql_base[@]} -c "select count(*) from private.need_revision_commands where need_id='${need}'::uuid;")"
  events="$(${psql_base[@]} -c "select count(*) from private.need_revision_events where need_id='${need}'::uuid;")"
  dispatch="$(${psql_base[@]} -c "select count(*) from private.dispatch_schedule where need_id='${need}'::uuid;")"
  [[ "$status" == "DRAFT" ]] || { echo "unexpected status for ${need}: ${status}" >&2; return 1; }
  [[ "$revision" == "2" ]] || { echo "unexpected revision for ${need}: ${revision}" >&2; return 1; }
  [[ "$commands" == "1" ]] || { echo "unexpected command count for ${need}: ${commands}" >&2; return 1; }
  [[ "$events" == "1" ]] || { echo "unexpected revision-event count for ${need}: ${events}" >&2; return 1; }
  [[ "$dispatch" == "0" ]] || { echo "dispatch still scheduled for ${need}: ${dispatch}" >&2; return 1; }
}

"${psql_base[@]}" -f "$GITHUB_WORKSPACE/supabase/proofs/ru4_concurrency_setup.sql" | tee /tmp/ru4-concurrency-setup.log
grep -F "PASS RU4_CONCURRENCY_SETUP bounded=3" /tmp/ru4-concurrency-setup.log >/dev/null

# A — same key, same payload: one command + one exact idempotent replay.
KEY_A="ru4-concurrent-same-0001"
APP_A1="ru4_same_a"
APP_A2="ru4_same_b"
GATE_A="ru4_gate_same"
PGAPPNAME="$GATE_A" psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 >/tmp/ru4-gate-a.log 2>&1 <<SQL &
begin;
select pg_advisory_xact_lock(hashtextextended('${OWNER}' || E'\n' || '${KEY_A}',4104));
select pg_sleep(5);
commit;
SQL
gate_a=$!
wait_for_gate_sleep "$GATE_A"
set +e
run_revise "$APP_A1" "$NEED_A" "$KEY_A" "same payload" /tmp/ru4-a1.log & pid_a1=$!
run_revise "$APP_A2" "$NEED_A" "$KEY_A" "same payload" /tmp/ru4-a2.log & pid_a2=$!
set -e
wait_for_two_lock_waiters "$APP_A1" "$APP_A2"
wait "$gate_a"
set +e
wait "$pid_a1"; rc_a1=$?
wait "$pid_a2"; rc_a2=$?
set -e
[[ "$rc_a1" == "0" && "$rc_a2" == "0" ]] || { cat /tmp/ru4-a1.log /tmp/ru4-a2.log >&2; exit 1; }
cat /tmp/ru4-a1.log /tmp/ru4-a2.log >/tmp/ru4-a-combined.log
grep -F '"idempotentReplay": false' /tmp/ru4-a-combined.log >/dev/null
grep -F '"idempotentReplay": true' /tmp/ru4-a-combined.log >/dev/null
assert_postconditions "$NEED_A"
echo "PASS RU4_CONCURRENCY same_key_same_payload one_revision_one_replay"

# B — same key, different payload: exactly one succeeds; the other is rejected.
KEY_B="ru4-concurrent-diff-0001"
APP_B1="ru4_diff_a"
APP_B2="ru4_diff_b"
GATE_B="ru4_gate_diff"
PGAPPNAME="$GATE_B" psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 >/tmp/ru4-gate-b.log 2>&1 <<SQL &
begin;
select pg_advisory_xact_lock(hashtextextended('${OWNER}' || E'\n' || '${KEY_B}',4104));
select pg_sleep(5);
commit;
SQL
gate_b=$!
wait_for_gate_sleep "$GATE_B"
set +e
run_revise "$APP_B1" "$NEED_B" "$KEY_B" "payload one" /tmp/ru4-b1.log & pid_b1=$!
run_revise "$APP_B2" "$NEED_B" "$KEY_B" "payload two" /tmp/ru4-b2.log & pid_b2=$!
set -e
wait_for_two_lock_waiters "$APP_B1" "$APP_B2"
wait "$gate_b"
set +e
wait "$pid_b1"; rc_b1=$?
wait "$pid_b2"; rc_b2=$?
set -e
if ! { [[ "$rc_b1" == "0" && "$rc_b2" != "0" ]] || [[ "$rc_b1" != "0" && "$rc_b2" == "0" ]]; }; then
  cat /tmp/ru4-b1.log /tmp/ru4-b2.log >&2
  echo "same-key/different-payload expected exactly one success" >&2
  exit 1
fi
cat /tmp/ru4-b1.log /tmp/ru4-b2.log >/tmp/ru4-b-combined.log
grep -F 'IDEMPOTENCY_KEY_REUSED' /tmp/ru4-b-combined.log >/dev/null
assert_postconditions "$NEED_B"
echo "PASS RU4_CONCURRENCY same_key_different_payload rejected_reuse"

# C — different keys, same task: row lock serializes the revision boundary.
KEY_C1="ru4-concurrent-need-0001"
KEY_C2="ru4-concurrent-need-0002"
APP_C1="ru4_need_a"
APP_C2="ru4_need_b"
GATE_C="ru4_gate_need"
PGAPPNAME="$GATE_C" psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 >/tmp/ru4-gate-c.log 2>&1 <<SQL &
begin;
select id from public.needs where id='${NEED_C}'::uuid for update;
select pg_sleep(5);
commit;
SQL
gate_c=$!
wait_for_gate_sleep "$GATE_C"
set +e
run_revise "$APP_C1" "$NEED_C" "$KEY_C1" "first key" /tmp/ru4-c1.log & pid_c1=$!
run_revise "$APP_C2" "$NEED_C" "$KEY_C2" "second key" /tmp/ru4-c2.log & pid_c2=$!
set -e
wait_for_two_lock_waiters "$APP_C1" "$APP_C2"
wait "$gate_c"
set +e
wait "$pid_c1"; rc_c1=$?
wait "$pid_c2"; rc_c2=$?
set -e
if ! { [[ "$rc_c1" == "0" && "$rc_c2" != "0" ]] || [[ "$rc_c1" != "0" && "$rc_c2" == "0" ]]; }; then
  cat /tmp/ru4-c1.log /tmp/ru4-c2.log >&2
  echo "different-key/same-task expected exactly one success" >&2
  exit 1
fi
cat /tmp/ru4-c1.log /tmp/ru4-c2.log >/tmp/ru4-c-combined.log
grep -F 'STALE_REVIEW_REQUIRED' /tmp/ru4-c-combined.log >/dev/null
assert_postconditions "$NEED_C"
echo "PASS RU4_CONCURRENCY different_key_same_need single_revision"

echo "PASS RU4_TRUE_CONCURRENCY_PROVEN waiters_observed=2x3 no_double_revision no_duplicate_command no_dispatch"
