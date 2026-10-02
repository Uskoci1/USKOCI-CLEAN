#!/usr/bin/env bash
# EX-07 S03: runs INSIDE the emulator step of .github/workflows/ex07-s03-auth-callbacks-proof.yml (a single-line `script:` calls this
# file, because the emulator action runs each line of a multi-line script as its own command).
# Preserves the driver's exit status and collects only SANITIZED diagnostics. The driver's own logcat capture (logcat.private.txt)
# is the thing the proof searches for credentials: it is never copied and never uploaded.
set -uo pipefail
set +e
d="${EX07_OUT:-artifacts/ex07-s03-native}"
mkdir -p "$d"
export EX07_OUT="$d"
apk="${EX07_S03_APK:-/tmp/ex07-s03-apk/USKOCI-EX07-S03-x86_64.apk}"
export EX07_S03_APK="$apk"
printf 'run=%s\nsha=%s\napk_run=%s\n' "${GITHUB_RUN_ID:-local}" "${GITHUB_SHA:-unknown}" "${GITHUB_RUN_ID:-local}" > "$d/proof-build.txt"
sha256sum "$apk" >> "$d/proof-build.txt"

adb wait-for-device
# A disposable emulator is the only device this proof drives; anything else attached is refused by the driver itself.
adb devices > "$d/devices.txt" 2>&1
adb shell getprop ro.build.version.sdk > "$d/device-sdk.txt" 2>&1
adb shell wm size > "$d/display-size.txt" 2>&1

python3 supabase/proofs/ex07/s03/s03_android_proof.py > "$d/proof.log" 2>&1
status=$?

if [[ "$status" -ne 0 ]]; then
  echo "DIAGNOSTIC driver_exit=$status" >> "$d/proof.log"
  timeout 20s adb exec-out screencap -p > "$d/FAILURE_last_screen.png" 2>/dev/null || true
fi
# A credential visible on screen (assertion E15) withholds every picture, including the failure one.
if grep -q '"screenshotsWithheld": true' "$d/native-report.json" 2>/dev/null; then rm -f "$d"/*.png; fi
# The log carries statuses, tags and fingerprints only (the driver redacts); still drop anything credential-shaped before printing.
grep -v -E 'eyJ[A-Za-z0-9_-]{8,}\.|access_token=|refresh_token=' "$d/proof.log" | tail -n 160
exit "$status"
