#!/usr/bin/env bash
set -uo pipefail
artifact_dir="${RU5_DEVICE_ARTIFACT_DIR:?}"
mkdir -p "$artifact_dir"
printf 'run=%s\nsha=%s\n' "${GITHUB_RUN_ID:?}" "${GITHUB_SHA:?}" > "$artifact_dir/proof-build.txt"
sha256sum android/app/build/outputs/apk/release/app-release.apk >> "$artifact_dir/proof-build.txt"
python3 scripts/n04_android_inbox_journey.py > "$artifact_dir/proof.log" 2>&1
status=$?
if [[ "$status" -ne 0 ]]; then
  timeout 20s adb exec-out screencap -p > "$artifact_dir/FAILURE_last_screen.png" 2>/dev/null || true
  timeout 20s adb shell uiautomator dump /sdcard/n04-failure.xml >/dev/null 2>&1 || true
  timeout 20s adb shell cat /sdcard/n04-failure.xml > "$artifact_dir/FAILURE_last_screen.xml" 2>/dev/null || true
fi
cat "$artifact_dir/proof.log"
exit "$status"
