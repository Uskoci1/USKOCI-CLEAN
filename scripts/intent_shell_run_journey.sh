#!/usr/bin/env bash
set -uo pipefail
artifact_dir="${RU5_DEVICE_ARTIFACT_DIR:?}"
mkdir -p "$artifact_dir"
printf 'run=%s\nsha=%s\npackage=%s\n' "${GITHUB_RUN_ID:?}" "${GITHUB_SHA:?}" "${RU5_DEVICE_PACKAGE:?}" > "$artifact_dir/proof-build.txt"
sha256sum android/app/build/outputs/apk/release/app-release.apk >> "$artifact_dir/proof-build.txt"
sha256sum scripts/intent_shell_android_journey.py scripts/intent_shell_discovery_fixture.mjs scripts/n04_android_inbox_journey.py scripts/ru5_android_device_ui_journey.py >> "$artifact_dir/proof-build.txt"

# Preserve all original N04 checks and ten PNG/XML pairs before adding a new Need.
python3 scripts/n04_android_inbox_journey.py > "$artifact_dir/proof-inbox.log" 2>&1
status=$?
if [[ "$status" -eq 0 ]]; then
  node scripts/intent_shell_discovery_fixture.mjs > "$artifact_dir/proof-fixture.log" 2>&1
  status=$?
fi
if [[ "$status" -eq 0 ]]; then
  python3 scripts/intent_shell_android_journey.py > "$artifact_dir/proof-navigation.log" 2>&1
  status=$?
fi
if [[ "$status" -ne 0 ]]; then
  timeout 20s adb exec-out screencap -p > "$artifact_dir/FAILURE_last_screen.png" 2>/dev/null || true
  timeout 20s adb shell uiautomator dump /sdcard/navigation-failure.xml >/dev/null 2>&1 || true
  timeout 20s adb shell cat /sdcard/navigation-failure.xml > "$artifact_dir/FAILURE_last_screen.xml" 2>/dev/null || true
fi
cat "$artifact_dir"/proof-inbox.log "$artifact_dir"/proof-fixture.log "$artifact_dir"/proof-navigation.log > "$artifact_dir/proof.log" 2>/dev/null || true
cat "$artifact_dir/proof.log"
exit "$status"
