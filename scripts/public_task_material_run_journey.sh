#!/usr/bin/env bash
set -uo pipefail
artifact_dir="${RU5_DEVICE_ARTIFACT_DIR:?}"
mkdir -p "$artifact_dir"

# Retain the original 10 Inbox +17 navigation +16 W04/W05 recovery observations before the new slice.
bash scripts/task_detail_run_journey.sh
status=$?
cp "$artifact_dir/proof.log" "$artifact_dir/public-task-material-proof.log"
copy_status=$?
if [[ "$status" -eq 0 && "$copy_status" -ne 0 ]]; then status=$copy_status; fi

# Source was frozen before proof-only prebuild overrides. The APK and actual
# generated app/package metadata are recorded here without credential values.
if [[ "$status" -eq 0 ]]; then
  node <<'NODE' >> "$artifact_dir/public-task-material-proof.log" 2>&1
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const hash = raw => createHash('sha256').update(raw).digest('hex');
const dir = process.env.RU5_DEVICE_ARTIFACT_DIR;
const frozen = JSON.parse(fs.readFileSync(path.join(dir, 'public-task-material-source.json'), 'utf8'));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(head, process.env.GITHUB_SHA); assert.equal(frozen.sourceSha, head);
assert.equal(process.env.RU5_DEVICE_PACKAGE, 'rs.uskoci.n04proof');
for (const entry of frozen.source) {
  const canonical = execFileSync('git', ['show', `HEAD:${entry.path}`], { maxBuffer: 64 * 1024 * 1024 });
  assert.equal(canonical.length, entry.bytes); assert.equal(hash(canonical), entry.sha256);
  if (!['app.json', 'package.json'].includes(entry.path)) {
    assert.deepEqual(fs.readFileSync(entry.path), canonical, `Unexpected build source change: ${entry.path}`);
  }
}
const metadata = file => { const raw = fs.readFileSync(file); return { path: file, bytes: raw.length, sha256: hash(raw) }; };
const originalApp = JSON.parse(execFileSync('git', ['show', 'HEAD:app.json'], { encoding: 'utf8' }));
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
originalApp.expo.android = originalApp.expo.android || {};
originalApp.expo.android.package = 'rs.uskoci.n04proof';
originalApp.expo.name = 'USKOČI MATERIAL PROOF';
assert.deepEqual(app, originalApp, 'Only explicit proof app identity may differ');
const originalPackage = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], { encoding: 'utf8' }));
const builtPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scriptChanges = [];
for (const key of new Set([...Object.keys(originalPackage.scripts || {}), ...Object.keys(builtPackage.scripts || {})])) {
  if (originalPackage.scripts?.[key] === builtPackage.scripts?.[key]) continue;
  assert.ok(['android', 'ios'].includes(key), 'Unexpected prebuild package script change');
  assert.equal(builtPackage.scripts[key], `expo run:${key}`);
  scriptChanges.push(key);
}
assert.deepEqual({ ...builtPackage, scripts: undefined }, { ...originalPackage, scripts: undefined },
  'Prebuild must not change package dependencies or other material');
const report = {
  sourceSha: head, runId: process.env.GITHUB_RUN_ID, package: process.env.RU5_DEVICE_PACKAGE,
  apk: metadata('android/app/build/outputs/apk/release/app-release.apk'), source: frozen.source,
  proofAppConfig: { ...metadata('app.json'), package: app.expo.android.package, name: app.expo.name },
  proofPackage: { ...metadata('package.json'), allowedScriptChanges: scriptChanges, dependenciesUnchanged: true },
  sourceBoundary: 'Canonical Git bytes, verified clean before prebuild; app identity and generated Android/iOS package scripts are recorded separately.',
  databaseBoundary: 'Historical79 plus explicit N02/N03 candidates; not full live87 replay.',
};
fs.writeFileSync(path.join(dir, 'public-task-material-build.json'), JSON.stringify(report, null, 2) + '\n');
console.log('PASS PUBLIC_TASK_MATERIAL_BUILD exact_source canonical_prebuild_inputs explicit_generated_overrides actual_apk_hash');
NODE
  status=$?
fi

seeded=0
if [[ "$status" -eq 0 ]]; then
  node scripts/public_task_material_proof.mjs seed >> "$artifact_dir/public-task-material-proof.log" 2>&1
  status=$?
  if [[ "$status" -eq 0 ]]; then seeded=1; fi
fi
if [[ "$status" -eq 0 ]]; then
  python3 scripts/public_task_material_android_journey.py >> "$artifact_dir/public-task-material-proof.log" 2>&1
  status=$?
fi
# A failed UI journey must still expose unexpected business effects after seed.
if [[ "$seeded" -eq 1 ]]; then
  node scripts/public_task_material_proof.mjs postflight >> "$artifact_dir/public-task-material-proof.log" 2>&1
  postflight_status=$?
  if [[ "$status" -eq 0 ]]; then status=$postflight_status; fi
fi
if [[ "$status" -eq 0 ]]; then
  python3 scripts/public_task_material_validate.py >> "$artifact_dir/public-task-material-proof.log" 2>&1
  status=$?
fi
if [[ "$status" -ne 0 ]]; then
  timeout 20s adb exec-out screencap -p > "$artifact_dir/MATERIAL_FAILURE_last_screen.png" 2>/dev/null || true
  timeout 20s adb shell uiautomator dump /sdcard/public-task-material-failure.xml >/dev/null 2>&1 || true
  timeout 20s adb shell cat /sdcard/public-task-material-failure.xml > "$artifact_dir/MATERIAL_FAILURE_last_screen.xml" 2>/dev/null || true
fi
cat "$artifact_dir/public-task-material-proof.log"
exit "$status"
