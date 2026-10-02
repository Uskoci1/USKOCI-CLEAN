// EX05-S01 offline unit tests of the shared proof harness. The proof runtime (supabase/proofs/pre_v3/closure_runtime.mjs) is injected, so a fake stands in for it here:
// no database, no Auth, no environment. What is tested: source binding, the catalog guard, the chain preconditions, the report and the exit code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProofHarness, sourceBytesFacts, catalogDigestSql, CHAIN_FACTS_SQL, assertChainFacts, EXPECTED_CHAIN_FACTS,
} from './harness.mjs';

const sha = 'a'.repeat(40);
const makeFakeRt = (answers = {}) => ({
  sha, out: '/tmp/ex05-private', env: {EX05_S01_ARTIFACT_DIR: '/tmp/ex05-s01-artifacts'},
  q: value => "'" + String(value).replaceAll("'", "''") + "'",
  report: unit => ({unit, result: 'RUNNING', sourceSha: sha, sourceTree: 'b'.repeat(40), actualAuth: true, actualDatabase: true, liveAccess: false, providerCalled: false, deviceProven: false, checks: [], migrations: []}),
  sql: query => { for (const [needle, value] of Object.entries(answers)) if (query.includes(needle)) return typeof value === 'function' ? value(query) : value; throw new Error('UNEXPECTED_SQL ' + query.slice(0, 60)); },
});
const fakeIo = (files = {}, committed = {}) => {
  const written = [];
  return {written, readFile: path => Buffer.from(files[path] ?? ''), gitShow: (commit, path) => { assert.equal(commit, sha); return Buffer.from(committed[path] ?? files[path] ?? ''); },
    mkdir: () => undefined, writeFile: (path, text) => written.push({path, text})};
};

test('sourceBytesFacts returns a sha256 per source and refuses a working-tree file that differs from the committed bytes', () => {
  const io = fakeIo({'a.mjs': 'one', 'b.mjs': 'two'});
  const facts = sourceBytesFacts(io, sha, ['a.mjs', 'b.mjs']);
  assert.deepEqual(Object.keys(facts), ['a.mjs', 'b.mjs']);
  assert.ok(Object.values(facts).every(hash => /^[a-f0-9]{64}$/.test(hash)));
  const drifted = fakeIo({'a.mjs': 'one'}, {'a.mjs': 'different'});
  assert.throws(() => sourceBytesFacts(drifted, sha, ['a.mjs']), /SOURCE_BYTES_DIFFER:a\.mjs/);
});

test('the catalog digest query is one read-only statement over functions, table authority, the certificate triple and the publication', () => {
  const sql = catalogDigestSql();
  for (const needle of ['pg_proc', 'pg_class', 'closure_source_v5', 'closure_erasure_source_v5', 'pg_publication_tables', 'pg_policies', 'md5']) assert.ok(sql.includes(needle), needle);
  assert.ok(!/\b(insert|update|delete|drop|create|alter|grant|revoke)\b/i.test(sql), 'read-only');
  assert.ok(!sql.includes(';'));
});

test('the chain facts query reads the facts the proofs assume and the assertion names each missing one', () => {
  for (const key of Object.keys(EXPECTED_CHAIN_FACTS)) assert.ok(CHAIN_FACTS_SQL.includes("'" + key + "'"), key);
  assert.doesNotThrow(() => assertChainFacts({...EXPECTED_CHAIN_FACTS}));
  assert.throws(() => assertChainFacts({...EXPECTED_CHAIN_FACTS, sendV2ConflictIsPt409: false}), /sendV2ConflictIsPt409/);
  assert.throws(() => assertChainFacts({...EXPECTED_CHAIN_FACTS, chat40001Functions: ['public.rpc_x']}), /chat40001Functions/);
  assert.throws(() => assertChainFacts({...EXPECTED_CHAIN_FACTS, certificateReady: false}), /certificateReady/);
  assert.throws(() => assertChainFacts({}), /sendV2ConflictIsPt409/);
});

test('a harness with passing checks writes a PASS report with the flags that say what was NOT touched, and does not set a failing exit code', async () => {
  const io = fakeIo({'p.mjs': 'x'});
  const rt = makeFakeRt({[catalogDigestSql().slice(0, 40)]: 'same'});
  const lines = [];
  const harness = createProofHarness({rt, unit: 'EX05_S01_TEST', reportName: 'ex05-s01-test-report.json', sources: ['p.mjs'], io, print: line => lines.push(line), printError: line => lines.push(line)});
  await harness.sourceCheck();
  await harness.check('ONE', async () => undefined);
  const exit = harness.finish();
  assert.equal(exit, 0);
  assert.equal(io.written.length, 1);
  assert.match(io.written[0].path, /ex05-s01-test-report\.json$/);
  const report = JSON.parse(io.written[0].text);
  assert.equal(report.result, 'PASS'); assert.equal(report.unit, 'EX05_S01_TEST');
  assert.equal(report.providerCalls, 0); assert.equal(report.devAccess, false); assert.equal(report.certificateMoved, false); assert.equal(report.deviceProven, false);
  assert.equal(report.sourceSha, sha); assert.ok(report.sourceArtifactHashes['p.mjs']);
  assert.deepEqual(report.checks.map(c => c.name), ['SOURCE_BYTES_EQUAL_THE_TESTED_COMMIT', 'ONE']);
  assert.ok(lines.some(line => /^PASS EX05_S01_TEST/.test(line)));
});

test('a failing check makes the exit code 1 and the report FAIL with the failure listed, and later checks still run', async () => {
  const io = fakeIo();
  const harness = createProofHarness({rt: makeFakeRt(), unit: 'EX05_S01_TEST', reportName: 'r.json', sources: [], io, print: () => undefined, printError: () => undefined});
  await harness.check('BROKEN', async () => { throw new Error('no'); });
  await harness.check('LATER', async () => undefined);
  assert.equal(harness.finish(), 1);
  const report = JSON.parse(io.written[0].text);
  assert.equal(report.result, 'FAIL'); assert.deepEqual(report.failures, [{name: 'BROKEN', message: 'no'}]);
  assert.equal(report.checks.length, 2);
});

test('the catalog guard passes when the digest is unchanged and fails the unit when a function body moved', async () => {
  const needle = catalogDigestSql().slice(0, 40);
  let value = 'digest-1';
  const rt = makeFakeRt({[needle]: () => value});
  const io = fakeIo();
  const harness = createProofHarness({rt, unit: 'U', reportName: 'r.json', sources: [], io, print: () => undefined, printError: () => undefined});
  harness.beginCatalogGuard();
  await harness.catalogGuardCheck();
  value = 'digest-2';
  const moved = createProofHarness({rt, unit: 'U', reportName: 'r2.json', sources: [], io, print: () => undefined, printError: () => undefined});
  value = 'digest-1'; moved.beginCatalogGuard(); value = 'digest-2';
  await moved.catalogGuardCheck();
  assert.equal(harness.finish(), 0);
  assert.equal(moved.finish(), 1);
  assert.match(JSON.parse(io.written[1].text).failures[0].message, /CATALOG_MOVED/);
});

test('requireChain stops the whole unit at once when the assumed predecessor state is absent', async () => {
  const io = fakeIo();
  const harness = createProofHarness({rt: makeFakeRt(), unit: 'U', reportName: 'r.json', sources: [], io, print: () => undefined, printError: () => undefined});
  const proceed = await harness.requireChain('CHAIN_IS_THE_POST_B24_POST_VOICE_STATE', async () => { throw new Error('chain lacks voice'); });
  assert.equal(proceed, false);
  assert.equal(harness.finish(), 1);
  const report = JSON.parse(io.written[0].text);
  assert.equal(report.result, 'FAIL');
  assert.match(report.failures[0].message, /chain lacks voice/);
  const ok = await createProofHarness({rt: makeFakeRt(), unit: 'U', reportName: 'r.json', sources: [], io: fakeIo(), print: () => undefined, printError: () => undefined})
    .requireChain('CHAIN', async () => undefined);
  assert.equal(ok, true);
});
