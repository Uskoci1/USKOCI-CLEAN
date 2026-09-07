#!/usr/bin/env bash
set -uo pipefail
artifact_dir="${RU5_DEVICE_ARTIFACT_DIR:?}"
mkdir -p "$artifact_dir"
# This reuses the actual ten N04 and seventeen NAV journeys without modification.
bash scripts/intent_shell_run_journey.sh
status=$?
if [[ "$status" -eq 0 ]]; then
  node supabase/proofs/notifications/d03_chat_device_fixture.mjs > "$artifact_dir/proof-d03-admission.log" 2>&1
  status=$?
fi
if [[ "$status" -eq 0 ]]; then
  python3 scripts/d03_chat_android_journey.py > "$artifact_dir/proof-d03-chat.log" 2>&1
  status=$?
fi
sha256sum scripts/d03_chat_android_journey.py scripts/d03_chat_local_rest.py scripts/d03_chat_outbox_observer.py supabase/proofs/notifications/d03_chat_device_fixture.mjs supabase/migrations/20260907110000_clean_d03_message_retry.sql >> "$artifact_dir/proof-build.txt"
if [[ "$status" -ne 0 ]]; then
  timeout 20s adb exec-out screencap -p > "$artifact_dir/FAILURE_d03_last_screen.png" 2>/dev/null || true
  timeout 20s adb shell uiautomator dump /sdcard/d03-failure.xml >/dev/null 2>&1 || true
  timeout 20s adb shell cat /sdcard/d03-failure.xml > "$artifact_dir/FAILURE_d03_last_screen.xml" 2>/dev/null || true
fi
cat "$artifact_dir"/proof-inbox.log "$artifact_dir"/proof-fixture.log "$artifact_dir"/proof-navigation.log "$artifact_dir"/proof-d03-admission.log "$artifact_dir"/proof-d03-chat.log > "$artifact_dir/proof.log" 2>/dev/null || true
cat "$artifact_dir/proof.log"
exit "$status"
