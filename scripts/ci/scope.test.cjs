'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classify, makePlan, testArguments, DOMAINS, W02 } = require('./scope.cjs');

test('location-only work does not rerun Auth, export or retention', () => {
  assert.deepEqual(classify(['src/data/locationResolver.ts']), ['location']);
  assert.deepEqual(classify(['supabase/migrations/20260910120000_clean_w02_owned_location.sql']), ['location', 'capability']);
});
test('unknown SQL and shared security changes are conservative', () => {
  for (const path of ['supabase/migrations/20260910120100_unknown.sql', 'src/data/serverReceipt.ts', 'src/store/sesija.ts'])
    assert.deepEqual(classify([path]), DOMAINS);
});
test('availability includes its immediate booking invariant, not unrelated legal proofs', () => {
  assert.deepEqual(classify(['src/data/workerAvailabilityClientService.ts']), ['calendar', 'availability']);
});
test('known SQL domains are routed without assuming every migration is an export change', () => {
  for (const [suffix, expected] of [['p1_legal', 'consent'], ['p2_data_export', 'export'], ['p3_retention', 'retention'], ['p4_processor', 'processors'], ['d0140a_policy', 'policy']]) {
    assert.deepEqual(classify([`supabase/migrations/20260910120000_clean_${suffix}.sql`]), [expected]);
  }
});
test('draft and final plans retain the same domain classification', () => {
  assert.deepEqual(makePlan(['src/contracts/location.ts']).domains, ['location']);
});
test('full milestone always retains every domain and migration integrity', () => {
  const plan = makePlan([], { full: true });
  assert.deepEqual(plan.domains, DOMAINS); assert.equal(plan.mode, 'full'); assert.equal(plan.migrationRequired, true);
});
test('unknown comparison base fails towards full checks rather than an empty pass', () => {
  const plan = makePlan([], { unknownBase: true });
  assert.equal(plan.mode, 'full'); assert.deepEqual(plan.domains, DOMAINS); assert.equal(plan.migrationRequired, true);
});
test('ordinary client change does not require migration integrity', () => {
  assert.equal(makePlan(['src/data/locationClientService.ts']).migrationRequired, false);
  assert.equal(makePlan(['supabase/migrations/MD5_MANIFEST.txt']).migrationRequired, true);
});
test('dependency/build changes run full regression once in the source job', () => {
  assert.equal(makePlan(['package-lock.json']).mode, 'full');
  assert.deepEqual(classify(['package-lock.json']), DOMAINS);
});
test('targeted selection keeps critical boundaries plus changed and domain tests', () => {
  const tracked = ['src/store/__tests__/session-epoch.test.ts', 'src/data/__tests__/w02-location-client.test.ts', 'src/data/locationResolver.ts', 'src/data/__tests__/p2-data-export-client.test.ts'];
  const args = testArguments(makePlan(['src/data/locationResolver.ts']), tracked);
  assert.ok(args.includes(tracked[0])); assert.ok(args.includes(tracked[1])); assert.ok(args.includes(tracked[2])); assert.ok(!args.includes(tracked[3]));
});
test('deleted source is not passed as a nonexistent Jest source, critical tests remain', () => {
  const args = testArguments(makePlan(['src/data/locationResolver.ts']), ['src/store/__tests__/session-epoch.test.ts']);
  assert.ok(!args.includes('src/data/locationResolver.ts')); assert.ok(args.includes('src/store/__tests__/session-epoch.test.ts'));
});
test('an empty scope is not reported as successful testing', () => {
  assert.throws(() => testArguments(makePlan([]), []), /NO_TARGETED/);
});
test('push transport source keeps its actual Auth/SQL proof and affected clients selected', () => {
  for (const path of ['supabase/functions/uskoci-push-transport/index.ts',
    'supabase/proofs/notifications/n09_push_transport_proof.mjs',
    '.github/workflows/notifications-n06-push-registry-proof.yml',
    'src/ui/notifications/PushRuntime.tsx', 'src/data/pushDeviceClientService.ts',
    'src/app/(app)/profil/obavestenja.tsx']) assert.deepEqual(classify([path]), ['push'], path);
  assert.deepEqual(classify(['src/data/authClientService.ts']), ['auth', 'push']);
  assert.deepEqual(classify(['supabase/migrations/20260910193029_clean_n09_expo_push_transport.sql']), ['auth', 'push']);
  const paths = ['src/data/__tests__/auth-client.test.ts', 'src/data/__tests__/push-runtime.test.tsx',
    'src/data/__tests__/native-push-device.test.ts', 'src/data/__tests__/push-preferences-native.test.tsx'];
  const args = testArguments(makePlan([], { domain: 'push' }), paths);
  for (const path of paths) assert.ok(args.includes(path), path);
});

test('invalid domain cannot silently turn off tests', () => assert.throws(() => makePlan([], { domain: 'skip-all' }), /UNKNOWN/));
test('manual W02 runs retain every sub-domain', () => assert.deepEqual(makePlan([], { domain: 'w02' }).domains, W02));
test('workflow changes select their own runtime verification at batch boundary', () => {
  assert.ok(classify(['.github/workflows/w01-auth-recovery-proof.yml']).includes('auth'));
  assert.deepEqual(classify(['.github/workflows/w02-calendar-authority-proof.yml']), W02);
});

test('export delivery UI, file adapters and proof files select the export domain', () => {
  for (const path of ['src/app/(app)/profil/izvoz.tsx', 'src/lib/dataExportFile.native.ts',
    'src/lib/__tests__/data-export-file-web.test.ts', 'src/data/dataExportDeliveryService.ts',
    'supabase/proofs/legal/data_export_edge.test.mjs', 'supabase/proofs/legal/p2_export_delivery_proof.mjs']) {
    assert.ok(classify([path]).includes('export'), path);
  }
  const tracked = ['src/data/__tests__/p2-data-export-delivery-client.test.ts',
    'src/data/__tests__/data-export-screen.test.tsx', 'src/lib/__tests__/data-export-file-native.test.ts',
    'src/lib/__tests__/data-export-file-web.test.ts', 'src/data/__tests__/profile-hub.test.tsx'];
  const args = testArguments(makePlan([], { domain: 'export' }), tracked);
  for (const path of tracked) assert.ok(args.includes(path), path);
  for (const path of ['other/src/app/(app)/profil/izvoz.tsx', 'src/app/(app)/profil/izvoz.tsx.bak'])
    assert.ok(!classify([path]).includes('export'), path);
});

test('retention execution and privacy receipt tests stay in the retention domain', () => {
  for (const path of ['src/contracts/retentionPolicy.ts', 'src/data/retentionPolicyClientService.ts',
    'src/app/(app)/profil/privatnost.tsx',
    'src/app/(app)/profil.tsx', 'src/app/(app)/_layout.tsx',
    'src/data/__tests__/privacy-retention-screen.test.tsx',
    'supabase/proofs/legal/p3_retention_execution_proof.mjs',
    'supabase/proofs/legal/p3_retention_execution_source_boundary.mjs',
    'supabase/migrations/20260910162955_clean_p3_retention_execution_authority.sql']) {
    assert.ok(classify([path]).includes('retention'), path);
  }
  const tracked = ['src/data/__tests__/p3-retention-policy-client.test.ts',
    'src/data/__tests__/privacy-retention-screen.test.tsx', 'src/data/__tests__/profile-hub.test.tsx'];
  const args = testArguments(makePlan([], { domain: 'retention' }), tracked);
  for (const path of tracked) assert.ok(args.includes(path), path);
  for (const path of ['other/src/app/(app)/profil/privatnost.tsx', 'src/app/(app)/profil/privatnost.tsx.bak'])
    assert.ok(!classify([path]).includes('retention'), path);
  assert.deepEqual(classify(['src/app/(app)/profil.tsx']), ['export', 'retention', 'push']);
  assert.deepEqual(classify(['src/app/(app)/_layout.tsx']), DOMAINS);
});

// Real Git comparison and real Actions event payloads, not a mocked classifier.
const { fromEnvironment } = require('./scope.cjs');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
test('draft, ready, release and source mismatch use the actual event and checkout', () => {
  const directory = mkdtempSync(join(tmpdir(), 'uskoci-ci-scope-'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const eventPath = join(directory, 'event.json');
  const env = { GITHUB_EVENT_PATH: eventPath, GITHUB_SHA: head, GITHUB_EVENT_NAME: 'pull_request', CI_LEVEL: 'fast' };
  try {
    writeFileSync(eventPath, JSON.stringify({ pull_request: { draft: true, base: { sha: head } } }));
    assert.equal(fromEnvironment(env).runDomains, false);
    writeFileSync(eventPath, JSON.stringify({ pull_request: { draft: false, base: { sha: head } } }));
    assert.equal(fromEnvironment(env).runDomains, true);
    assert.deepEqual(fromEnvironment({ ...env, CI_LEVEL: 'release' }).domains, DOMAINS);
    assert.throws(() => fromEnvironment({ ...env, GITHUB_SHA: '0'.repeat(40) }), /CHECKOUT_SOURCE_MISMATCH/);
    writeFileSync(eventPath, JSON.stringify({ pull_request: { draft: false, base: { sha: 'not-a-sha' } } }));
    assert.equal(fromEnvironment(env).mode, 'full');
    assert.deepEqual(fromEnvironment(env).domains, DOMAINS);
    writeFileSync(eventPath, JSON.stringify({ before: head }));
    assert.equal(fromEnvironment({ ...env, GITHUB_EVENT_NAME: 'push' }).runDomains, false);
    assert.equal(fromEnvironment({ ...env, GITHUB_EVENT_NAME: 'workflow_dispatch', CI_LEVEL: 'domain' }).runDomains, true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('capability names are substrings while ports.ts is an exact filename suffix', () => {
  for (const path of ['other/capabilityResource.ts', 'other/CapabilityContract.ts', 'other/workerProfileExtra.ts', 'other/capabilityTerms.ts', 'other/ports.ts']) {
    assert.ok(classify([path]).includes('capability'));
  }
  for (const path of ['other/ports.ts.bak', 'other/ports.tsx', 'other/portsXts']) {
    assert.ok(!classify([path]).includes('capability'));
  }
});
