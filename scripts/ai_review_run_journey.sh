#!/usr/bin/env bash
set -uo pipefail
artifact_dir="${RU5_DEVICE_ARTIFACT_DIR:?}"
test "$artifact_dir" = 'artifacts/ai-review-device' || exit 1
mkdir -p "$artifact_dir"
printf 'run=%s\nsha=%s\npackage=%s\nprovider_proof=false\ncanonical_full_replay=false\nnative_db=historical79+N02+N03+exact_AI_two_RPC_extension\n' "${GITHUB_RUN_ID:?}" "${GITHUB_SHA:?}" "${RU5_DEVICE_PACKAGE:?}" > "$artifact_dir/ai-proof-build.txt"
sha256sum android/app/build/outputs/apk/release/app-release.apk >> "$artifact_dir/ai-proof-build.txt"
sha256sum scripts/ai_review_android_journey.py scripts/ai_review_fixture.mjs scripts/ai_review_local_rest.py scripts/ai_review_run_journey.sh .github/workflows/ai-review-mobile-proof.yml >> "$artifact_dir/ai-proof-build.txt"
sha256sum supabase/proofs/ai/ai_draft_authority_candidate.sql >> "$artifact_dir/ai-proof-build.txt"

# Original 27 and their logs/build evidence remain intact, including N04's
# actual selection/read writes. The AI owner is created only afterward.
bash scripts/intent_shell_run_journey.sh
status=$?
if [[ "$status" -eq 0 ]]; then
  node scripts/ai_review_fixture.mjs create-account > "$artifact_dir/ai-account.log" 2>&1
  status=$?
fi
if [[ "$status" -eq 0 ]]; then
  python3 -B scripts/ai_review_android_journey.py > "$artifact_dir/ai-proof.log" 2>&1
  status=$?
fi
if [[ "$status" -ne 0 ]]; then
  timeout 20s adb exec-out screencap -p > "$artifact_dir/AI_FAILURE_last_screen.png" 2>/dev/null || true
  timeout 20s adb shell uiautomator dump /sdcard/ai-review-failure.xml >/dev/null 2>&1 || true
  timeout 20s adb shell cat /sdcard/ai-review-failure.xml > "$artifact_dir/AI_FAILURE_last_screen.xml" 2>/dev/null || true
fi
cat "$artifact_dir/ai-account.log" "$artifact_dir/ai-proof.log" 2>/dev/null || true
exit "$status"
