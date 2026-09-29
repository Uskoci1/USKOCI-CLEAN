#!/usr/bin/env bash
# Runs inside the emulator step of .github/workflows/p6-native-journey.yml.
# Preserves the UI driver's exit status and collects read-only Android diagnostics; no Auth, RPC or business-state
# fallback is permitted here. The disposable server, fixture accounts and APK are prepared by the workflow.
set -uo pipefail
set +e
d="${P6N_ARTIFACT_DIR:-artifacts/p6-native}"
mkdir -p "$d"
apk=/tmp/p6-native-apk/USKOCI-P6-NATIVE-x86_64.apk
printf 'run=%s\nsha=%s\njourney=%s\napk_run=%s\n' "${GITHUB_RUN_ID:-local}" "${GITHUB_SHA:-unknown}" "${P6N_JOURNEY:-probe}" "${P6N_APK_RUN:-?}" > "$d/proof-build.txt"
sha256sum "$apk" >> "$d/proof-build.txt"

adb wait-for-device
adb install -r "$apk" > "$d/install.log" 2>&1
if [[ $? -ne 0 ]]; then cat "$d/install.log"; echo "FAIL P6_NATIVE_APK_INSTALL"; exit 1; fi
adb shell settings put system pointer_location 0
adb shell getprop ro.build.version.sdk > "$d/device-sdk.txt"
adb shell wm size > "$d/display-size.txt"
adb shell wm density > "$d/display-density.txt"
adb logcat -c
adb logcat -v threadtime > "$d/logcat.txt" 2>&1 &
logcat_pid=$!

python3 scripts/p6_native_journey.py > "$d/proof.log" 2>&1
status=$?

sleep 2
kill "$logcat_pid" 2>/dev/null
adb shell dumpsys meminfo rs.uskoci.dev > "$d/meminfo-final.txt" 2>&1
grep -E "ANR in|FATAL EXCEPTION|Application Not Responding|am_anr|Process rs.uskoci.dev has died" "$d/logcat.txt" > "$d/logcat-fatal.txt" 2>/dev/null
printf 'fatal_lines=%s\n' "$(wc -l < "$d/logcat-fatal.txt" 2>/dev/null || echo 0)" >> "$d/proof-build.txt"
if [[ "$status" -ne 0 ]]; then
  echo "DIAGNOSTIC original_driver_exit=$status" >> "$d/proof.log"
  timeout 20s adb exec-out screencap -p > "$d/FAILURE_last_screen.png" 2>/dev/null || true
  timeout 20s adb shell uiautomator dump /sdcard/p6-failure.xml > "$d/FAILURE_dump.txt" 2>&1 || true
  timeout 20s adb shell cat /sdcard/p6-failure.xml > "$d/FAILURE_last_screen.xml" 2>/dev/null || true
  timeout 20s adb shell dumpsys window windows > "$d/FAILURE_window_windows.txt" 2>&1 || true
fi
tail -n 120 "$d/proof.log"
exit "$status"
