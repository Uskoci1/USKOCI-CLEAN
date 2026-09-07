#!/usr/bin/env bash
set -uo pipefail
artifact_dir="${RU5_DEVICE_ARTIFACT_DIR:?}"
mkdir -p "$artifact_dir"

# Preserve all original Inbox, three-zone and two-account observations first.
bash scripts/intent_shell_run_journey.sh
status=$?
sha256sum scripts/task_detail_android_journey.py scripts/task_detail_local_rest.py scripts/task_detail_deadline_fixture.mjs >> "$artifact_dir/proof-build.txt"
: > "$artifact_dir/proof-detail.log"
if [[ "$status" -eq 0 ]]; then
  python3 scripts/task_detail_android_journey.py > "$artifact_dir/proof-detail.log" 2>&1
  status=$?
fi
if [[ "$status" -ne 0 ]]; then
  timeout 20s adb exec-out screencap -p > "$artifact_dir/DETAIL_FAILURE_last_screen.png" 2>/dev/null || true
  timeout 20s adb shell uiautomator dump /sdcard/detail-failure.xml >/dev/null 2>&1 || true
  timeout 20s adb shell cat /sdcard/detail-failure.xml > "$artifact_dir/DETAIL_FAILURE_last_screen.xml" 2>/dev/null || true
fi
cat "$artifact_dir/proof-detail.log" >> "$artifact_dir/proof.log"
cat "$artifact_dir/proof-detail.log"
exit "$status"
