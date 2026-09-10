#!/usr/bin/env bash
set -uo pipefail
artifact_dir="${RU5_DEVICE_ARTIFACT_DIR:?}"
test "$artifact_dir" = 'artifacts/ai-review-device' || exit 1
mkdir -p "$artifact_dir"
native_history=106
if [[ "${AI_REVIEW_SCOPE:-intake}" = 'marketplace' ]]; then native_history=108; fi
printf 'run=%s\nsha=%s\npackage=%s\nprovider_proof=false\ngateway_proof=false\nnative_db=exact%s\n' "${GITHUB_RUN_ID:?}" "${GITHUB_SHA:?}" "${RU5_DEVICE_PACKAGE:?}" "$native_history" > "$artifact_dir/ai-proof-build.txt"
sha256sum android/app/build/outputs/apk/release/app-release.apk >> "$artifact_dir/ai-proof-build.txt"
sha256sum scripts/ai_review_android_journey.py scripts/ai_review_fixture.mjs scripts/ai_review_local_rest.py scripts/ai_review_edge_server.mjs scripts/ai_review_run_journey.sh .github/workflows/ai-review-mobile-proof.yml supabase/functions/uskoci-ai-interview/index.ts supabase/migrations/20260910172132_clean_w03_owned_ai_intake_authority.sql >> "$artifact_dir/ai-proof-build.txt"
if [[ "${AI_REVIEW_SCOPE:-intake}" = 'marketplace' ]]; then
  printf 'scope=marketplace\nreviews_proven=false\n' >> "$artifact_dir/ai-proof-build.txt"
  sha256sum scripts/ru5_android_device_ui_journey.py scripts/d03_chat_android_journey.py supabase/proofs/notifications/d03_chat_device_fixture.mjs supabase/functions/uskoci-publication-evaluate/index.ts src/ui/location/NeedLocationForm.tsx src/ui/location/LocationPointEditor.tsx src/ui/location/ResolvedPinMap.tsx src/ui/v2/NeedPresentation.tsx src/data/publicationClientService.ts >> "$artifact_dir/ai-proof-build.txt"
fi

node scripts/ai_review_edge_server.mjs > "$artifact_dir/ai-adapter.log" 2>&1 &
adapter_pid=$!
trap 'kill "$adapter_pid" 2>/dev/null || true; wait "$adapter_pid" 2>/dev/null || true' EXIT
status=1
for attempt in $(seq 1 30); do
  if grep -Fq 'READY AI_REVIEW_LOOPBACK_ADAPTER' "$artifact_dir/ai-adapter.log"; then status=0; break; fi
  kill -0 "$adapter_pid" 2>/dev/null || break
  sleep 1
done
if [[ "$status" -eq 0 ]]; then
  python3 -B scripts/ai_review_android_journey.py > "$artifact_dir/ai-proof.log" 2>&1
  status=$?
fi
if [[ "$status" -ne 0 ]]; then
  timeout 20s adb exec-out screencap -p > "$artifact_dir/AI_FAILURE_last_screen.png" 2>/dev/null || true
  timeout 20s adb shell uiautomator dump /sdcard/ai-review-failure.xml >/dev/null 2>&1 || true
  timeout 20s adb shell cat /sdcard/ai-review-failure.xml > "$artifact_dir/AI_FAILURE_last_screen.xml" 2>/dev/null || true
fi
cat "$artifact_dir/ai-proof.log" 2>/dev/null || true
exit "$status"
