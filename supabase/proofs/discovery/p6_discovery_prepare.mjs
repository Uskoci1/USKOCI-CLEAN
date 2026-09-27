// Historical disposable baseline only. Not a P6 apply or certificate repair.
// PKG045b is replayed verbatim, including its historical certificate movement.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';
const env = process.env;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
assert.equal(env.DB_URL, env.RU5_DEVICE_DB_URL);
assert.equal(env.P6_HISTORICAL_PKG045_REPLAY, '1', 'Explicit historical baseline replay admission is required');
assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
assert.ok(env.PRE_V3_ARTIFACT_DIR);
const out = env.PRE_V3_ARTIFACT_DIR; mkdirSync(out, { recursive: true });
assert.equal(out, '/tmp/p6-discovery-private');
assert.equal(env.P6_PUBLIC_ARTIFACT_DIR, '/tmp/p6-discovery-evidence');
mkdirSync(env.P6_PUBLIC_ARTIFACT_DIR, { recursive: true });
const artifacts = ['supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql',
  'supabase/candidates/pkg045a_task_read_contract.sql', 'supabase/candidates/pkg045b_task_column_privileges.sql'];
const report = { unit: 'P6_HISTORICAL_PKG045_PREPARATION', result: 'FAIL', sourceSha: env.GITHUB_SHA,
  disposableOnly: true, liveAccess: false, providerCalled: false, historicalCertificateReplay: true,
  p6CertificateRebind: false, sourceArtifactHashes: {}, checks: [] };
let stage = 'SOURCE_BINDING';
function sql(source) {
  try { return execFileSync('psql', [env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
    { input: source, encoding: 'utf8', timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch (error) {
    const sqlState = String(error.stderr ?? '').match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/)?.[1];
    const failure = new Error('P6_LOCAL_PREPARATION_SQL_FAILED');
    if (sqlState) failure.sqlState = sqlState;
    throw failure;
  }
}
const closure = () => JSON.parse(sql(`select jsonb_build_object('digest',private.closure_source_digest_v5(),
 'certificate',(select sha256 from private.closure_source_v5 where singleton),
 'erasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
 'binding',private.closure_erasure_binding_v5()->>'sourceSha256','ready',private.retention_ai_source_ready())`));
try {
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), env.GITHUB_SHA);
  for (const path of [...artifacts, 'supabase/proofs/discovery/p6_discovery_prepare.mjs', '.github/workflows/p6-discovery-page-proof.yml']) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', `${env.GITHUB_SHA}:${path}`]));
    report.sourceArtifactHashes[path] = createHash('sha256').update(bytes).digest('hex');
  }
  stage = 'BASELINE_BEFORE'; report.before = closure(); assert.equal(report.before.ready, true);
  assert.equal(report.before.digest, report.before.certificate); assert.equal(report.before.digest, report.before.erasure);
  for (const [index, path] of artifacts.entries()) {
    stage = ['REPLAY_PKG042A', 'REPLAY_PKG045A', 'REPLAY_PKG045B'][index]; sql(readFileSync(path, 'utf8'));
  }
  stage = 'BASELINE_AFTER'; report.after = closure(); assert.equal(report.after.ready, true);
  assert.equal(report.after.digest, report.after.certificate); assert.equal(report.after.digest, report.after.erasure);
  assert.equal(report.after.digest, report.after.binding);
  stage = 'GRANTS_AND_COVERAGE';
  const boundary = JSON.parse(sql(`select jsonb_build_object(
    'wholeRow',has_table_privilege('authenticated','public.needs','SELECT'),
    'privateAccount',has_column_privilege('authenticated','public.needs','requester_account_id','SELECT'),
    'privateCloseReason',has_column_privilege('authenticated','public.needs','remaining_search_close_reason','SELECT'),
    'publicId',has_column_privilege('authenticated','public.needs','id','SELECT'),
    'coverage',(select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid='public.covered_slots(public.needs)'::regprocedure))`));
  assert.deepEqual(boundary, { wholeRow: false, privateAccount: false, privateCloseReason: false, publicId: true,
    coverage: 'cbeb8f2a3da7d08965ef0386cfc437ba' });
  report.checks = ['EXACT_GIT_BYTES', 'HISTORICAL_042A_045A_045B', 'PUBLIC_COLUMN_BOUNDARY', 'CANONICAL_COVERAGE', 'READY_HISTORICAL_BASELINE'];
  report.result = 'PASS';
} catch (error) {
  report.failure = { stage, category: 'PREPARATION_REFUSED',
    ...(typeof error.sqlState === 'string' && /^[0-9A-Z]{5}$/.test(error.sqlState) ? { sqlState: error.sqlState } : {}) };
  process.exitCode = 1;
}
finally {
  writeFileSync(join(out, 'p6-preparation.json'), `${JSON.stringify(report, null, 2)}\n`);
  // Explicit public projection: no SQL stdout, stack, source bytes, rows or IDs.
  const receipt = { unit: report.unit, result: report.result, sourceSha: report.sourceSha,
    disposableOnly: true, liveAccess: false, providerCalled: false, historicalCertificateReplay: true,
    p6CertificateRebind: false, sourceArtifactHashes: report.sourceArtifactHashes,
    checks: report.checks, ...(report.failure ? { failure: report.failure } : {}) };
  writeFileSync(join(env.P6_PUBLIC_ARTIFACT_DIR, 'p6-preparation-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`${report.result} P6_HISTORICAL_PKG045_PREPARATION`);
}
