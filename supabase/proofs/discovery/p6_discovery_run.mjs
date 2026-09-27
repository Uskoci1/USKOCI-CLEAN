// Exact-source, local-only P6 SQL proof runner. No Auth/provider/DEV client.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';
const env = process.env;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
assert.equal(env.DB_URL, env.RU5_DEVICE_DB_URL);
assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
assert.ok(env.PRE_V3_ARTIFACT_DIR);
const out = env.PRE_V3_ARTIFACT_DIR; mkdirSync(out, { recursive: true });
assert.equal(out, '/tmp/p6-discovery-private');
assert.equal(env.P6_PUBLIC_ARTIFACT_DIR, '/tmp/p6-discovery-evidence');
mkdirSync(env.P6_PUBLIC_ARTIFACT_DIR, { recursive: true });
const paths = ['supabase/candidates/p6_discovery_page.sql', 'supabase/proofs/discovery/p6_discovery_page_proof.sql',
  'supabase/proofs/discovery/p6_discovery_parity_vectors.mjs', 'supabase/proofs/discovery/p6_discovery_prepare.mjs',
  'supabase/proofs/discovery/p6_discovery_run.mjs', '.github/workflows/p6-discovery-page-proof.yml',
  'src/data/marketplaceView.ts', 'src/lib/calendarTime.ts', 'src/lib/location.ts', 'src/lib/market.ts',
  'src/ui/calendar/calendarPresentation.ts', 'package.json', 'package-lock.json'];
const expected = ['CURRENT_CLIENT_ORACLE_208_VECTORS', 'HELPERS_AND_INVOKER_ENVELOPE',
  '1004_ROWS_TIES_MICROSECONDS_SCOPES_EXACT_ALLOWLIST', 'ZERO_ONE_AND_STRICT_CURSOR_ANCHOR_REFUSALS',
  'AUTH_AND_ANON_REFUSALS', 'COVERAGE_WITH_RESTRICTED_COLUMNS', 'EXISTING_AUTHORITY_UNCHANGED', 'ROLLBACK_NO_RPC_OR_FIXTURES_RETAINED'];
const report = { unit: 'P6_DISCOVERY_PAGE', sourceSha: env.GITHUB_SHA, result: 'FAIL', actualDatabase: false,
  sqlAuthenticatedRoles: false, actualAuth: false, postgrestProven: false, liveAccess: false,
  providerCalled: false, providerCalls: 0, storageCalls: 0, deviceProven: false, queryCostProven: false,
  completeDiscoveryProven: false, certificateChangedByP6: false, sourceArtifactHashes: {}, checks: [] };
let stage = 'SOURCE_BINDING';
try {
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), env.GITHUB_SHA);
  for (const path of paths) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', `${env.GITHUB_SHA}:${path}`]));
    report.sourceArtifactHashes[path] = createHash('sha256').update(bytes).digest('hex');
  }
  const prepared = JSON.parse(readFileSync(join(out, 'p6-preparation.json'), 'utf8'));
  assert.equal(prepared.result, 'PASS'); assert.equal(prepared.sourceSha, env.GITHUB_SHA);
  assert.equal(prepared.liveAccess, false); assert.equal(prepared.providerCalled, false);
  stage = 'OFFLINE_ORACLE';
  const vectors = execFileSync(process.execPath, ['supabase/proofs/discovery/p6_discovery_parity_vectors.mjs'],
    { encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal((vectors.match(/^do \$p6_vector\$/gm) ?? []).length, 208);
  for (const path of paths.filter(path => path.startsWith('src/'))) {
    assert.ok(vectors.includes(`-- SHA256 ${report.sourceArtifactHashes[path]} ${path}`));
  }
  const vectorPath = join(out, 'p6-vectors.sql'); writeFileSync(vectorPath, vectors);
  report.generatedVectorsSha256 = createHash('sha256').update(vectors).digest('hex');
  writeFileSync(join(env.P6_PUBLIC_ARTIFACT_DIR, 'p6-oracle-manifest.json'), `${JSON.stringify({ assertionCount: 208,
    generatedSqlSha256: report.generatedVectorsSha256,
    sourceArtifactHashes: Object.fromEntries(paths.filter(path => path.startsWith('src/')).map(path => [path, report.sourceArtifactHashes[path]])) }, null, 2)}\n`);
  stage = 'DISPOSABLE_SQL';
  const ran = spawnSync('psql', [env.DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-v', 'p6_disposable=SOURCE_ONLY_ROLLBACK',
    '-v', `p6_vectors_path=${vectorPath}`, '-f', 'supabase/proofs/discovery/p6_discovery_page_proof.sql'],
  { encoding: 'utf8', timeout: 15 * 60_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = `${ran.stdout ?? ''}${ran.stderr ?? ''}`; writeFileSync(join(out, 'p6-sql.log'), log);
  // Only typed SQLSTATE, a known source path/line and a source-allowlisted P6
  // code leave the private log. No PostgreSQL message, query, detail or context.
  const diagnostic = {};
  const errorLine = String(ran.stderr ?? '').split(/\r?\n/).find(line => /(?:ERROR|FATAL):\s+[0-9A-Z]{5}:/.test(line));
  if (errorLine) {
    diagnostic.sqlState = errorLine.match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/)[1];
    const sources = ['supabase/candidates/p6_discovery_page.sql', 'supabase/proofs/discovery/p6_discovery_page_proof.sql'];
    const allowedCodes = new Set(sources.flatMap(path => [...readFileSync(path, 'utf8').matchAll(/raise exception '(P6_[A-Z0-9_]+)/gi)].map(match => match[1])));
    for (let index = 1; index <= 208; index++) allowedCodes.add(`P6_CLIENT_PARITY_${index}`);
    const code = errorLine.match(/(?:ERROR|FATAL):\s+[0-9A-Z]{5}:\s+(P6_[A-Z0-9_]+)\b/)?.[1];
    if (code && allowedCodes.has(code)) diagnostic.code = code;
    const origin = errorLine.match(/^psql:(.+):([0-9]{1,6}):\s+(?:ERROR|FATAL):/);
    if (origin) {
      const path = sources.find(path => resolve(path) === resolve(origin[1]));
      const line = Number(origin[2]);
      if (path && line >= 1 && line <= readFileSync(path, 'utf8').split('\n').length) {
        diagnostic.source = path; diagnostic.line = line;
      }
    }
    report.sqlDiagnostic = diagnostic;
  }
  const lines = log.split(/\r?\n/);
  report.actualDatabase = lines.includes('PASS P6_HELPERS_AND_INVOKER_ENVELOPE');
  report.checks = expected.map(name => ({ name, result: lines.includes(`PASS P6_${name}`) ? 'PASS' : 'NOT_PASSED' }));
  assert.equal(ran.status, 0, 'P6_SQL_PROOF_FAILED'); assert.ok(report.checks.every(check => check.result === 'PASS'));
  report.sqlAuthenticatedRoles = true; report.result = 'PASS';
} catch { report.failure = { stage, category: 'PROOF_REFUSED' }; process.exitCode = 1; }
finally {
  writeFileSync(join(out, 'p6-discovery-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  // report contains only fixed contract fields, bounded verdicts and source hashes.
  // The generated SQL and PostgreSQL output remain exclusively in the private dir.
  writeFileSync(join(env.P6_PUBLIC_ARTIFACT_DIR, 'p6-discovery-receipt.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.result} P6_DISCOVERY_PAGE`);
}
