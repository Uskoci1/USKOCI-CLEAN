// Source-only runner. The actual handler test replaces every environment value
// and fetch with synthetic fixtures; it has no provider or database connection.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = resolve(root, 'proof-out/ai-edge-context');
mkdirSync(output, { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(root, 'supabase/proofs/ai/ai_edge_context_files.json'), 'utf8'));
const report = {
  status: 'RUNNING',
  boundary: 'ACTUAL_EDGE_HANDLER_MOCKED_TRANSPORT',
  actualProviderCalled: false,
  databaseConnected: false,
  edgeDeployed: false,
  sourceCommit: null,
  sourceWorktreeDirty: null,
  files: [],
};
try {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  assert.equal(head.status, 0);
  report.sourceCommit = head.stdout.trim();
  const state = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  assert.equal(state.status, 0);
  report.sourceWorktreeDirty = Boolean(state.stdout.trim());
  for (const file of manifest.files) {
    const bytes = readFileSync(resolve(root, file.path));
    const actual = {
      path: file.path, bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    assert.deepEqual(actual, file, `FROZEN_SOURCE_CHANGED:${file.path}`);
    report.files.push(actual);
  }
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'supabase/proofs/ai/ai_edge_context.test.mjs'], {
    cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  writeFileSync(resolve(output, 'handler-tests.tap'), result.stdout ?? '');
  // Assertion diagnostics contain only the synthetic fixtures in the test file.
  writeFileSync(resolve(output, 'handler-tests.stderr.log'), result.stderr ?? '');
  assert.equal(result.status, 0, 'ACTUAL_HANDLER_TESTS_FAILED');
  const passed = result.stdout.match(/^# pass (\d+)$/m);
  const failed = result.stdout.match(/^# fail (\d+)$/m);
  assert.ok(passed && failed, 'TEST_TOTALS_MISSING');
  assert.equal(Number(failed[1]), 0);
  report.testsPassed = Number(passed[1]);
  report.testsFailed = Number(failed[1]);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error instanceof Error ? error.message : 'SOURCE_PROOF_FAILED';
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(output, 'proof-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
