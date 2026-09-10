#!/usr/bin/env bash
# Preserve the real UI driver's exit status; collect read-only Android diagnostics.
# No Auth, RPC, navigation, or business-state fallback is permitted here.
set -uo pipefail
set +e
artifact_dir="${RU5_DEVICE_ARTIFACT_DIR:-artifacts/ru5-device-ui}"
mkdir -p "$artifact_dir"
printf 'run=%s\nsha=%s\n' "${GITHUB_RUN_ID:-local}" "${GITHUB_SHA:-unknown}" > "$artifact_dir/proof-build.txt"
if [[ -f android/app/build/outputs/apk/release/app-release.apk ]]; then
  sha256sum android/app/build/outputs/apk/release/app-release.apk >> "$artifact_dir/proof-build.txt"
fi

python3 scripts/ru5_android_device_ui_journey.py > "$artifact_dir/proof.log" 2>&1
status=$?
if [[ "$status" -eq 0 && "${RU5_DEVICE_CORE106:-0}" = "1" ]]; then
  N04_AGREEMENT_ID="$(python3 -c 'import json,os; print(json.load(open(os.environ["RU5_DEVICE_ARTIFACT_DIR"]+"/core-selection.json"))["agreementId"])')"
  export N04_AGREEMENT_ID
  node supabase/proofs/notifications/d03_chat_device_fixture.mjs > "$artifact_dir/core-d03-admission.log" 2>&1
  status=$?
  cat "$artifact_dir/core-d03-admission.log" >> "$artifact_dir/proof.log"
  if [[ "$status" -eq 0 ]]; then
    python3 scripts/d03_chat_android_journey.py > "$artifact_dir/core-d03.log" 2>&1
    status=$?
    cat "$artifact_dir/core-d03.log" >> "$artifact_dir/proof.log"
  fi
fi
sha256sum scripts/ru5_android_device_ui_journey.py scripts/intent_shell_android_journey.py scripts/d03_chat_android_journey.py scripts/d03_chat_keyboard_bounds.py scripts/d03_chat_local_rest.py supabase/proofs/ru5_device_ui_fixture.mjs supabase/proofs/notifications/d03_chat_device_fixture.mjs >> "$artifact_dir/proof-build.txt"
if [[ "$status" -ne 0 ]]; then
  echo "DIAGNOSTIC original_driver_exit=$status" >> "$artifact_dir/proof.log"
  timeout 20s adb exec-out screencap -p > "$artifact_dir/FAILURE_last_screen.png" 2>/dev/null || true
  timeout 20s adb shell uiautomator dump /sdcard/ru5-failure.xml > "$artifact_dir/FAILURE_dump.txt" 2>&1 || true
  timeout 20s adb shell cat /sdcard/ru5-failure.xml > "$artifact_dir/FAILURE_last_screen.xml" 2>/dev/null || true
  timeout 20s adb shell dumpsys window displays > "$artifact_dir/FAILURE_window_displays.txt" 2>&1 || true
  timeout 20s adb shell dumpsys window windows > "$artifact_dir/FAILURE_window_windows.txt" 2>&1 || true
  timeout 20s adb shell wm size > "$artifact_dir/FAILURE_display_size.txt" 2>&1 || true
  timeout 20s adb shell wm density > "$artifact_dir/FAILURE_display_density.txt" 2>&1 || true
fi
cat "$artifact_dir/proof.log"
exit "$status"
