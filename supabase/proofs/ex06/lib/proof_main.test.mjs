// Offline END-TO-END test of the proof orchestration (lib/proof_main.mjs): the REAL fixtures, runner, S02 adapter, pins and report writers run against a SIMULATED backend
// (lib/sim_backend.mjs), so wiring mistakes that the unit tests (which fake one layer at a time) cannot see surface here: a wrong property name, a SQL shape the fixtures send, a report
// field the renderer needs. The simulation is not evidence about the chain and its matcher oracle is written for the test; what this proves is that the harness runs end to end, that its
// guards fire when the pipeline is broken on purpose, and that the files it writes are complete. `node --test supabase/proofs/ex06/lib/*.test.mjs`.
process.env.EX06_QUIET = '1';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {annotationsFor, resultLine} from './compare.mjs';
import {extensionResultLine, runExtensionReport} from './extension_report.mjs';
import {runProof} from './proof_main.mjs';
import {createSimulatedBackend} from './sim_backend.mjs';
import {CORPUS_PATH, registryFromSource} from './test_support.mjs';

const registry = registryFromSource();
const corpusFile = fileURLToPath(new URL(CORPUS_PATH, import.meta.url));
const START = Date.UTC(2026, 9, 1, 12, 0, 0);

/** A run against the simulated backend. Only an explicit EX06_CORPUS exists as a corpus file: the repository's default path does not decide the run. */
async function proof({env = {}, quirks = {}, foreignWorkers = 2, fixtureOptions = {}} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ex06-'));
  const backend = createSimulatedBackend({quirks, foreignWorkers, startMs: START});
  const full = {EX06_ARTIFACT_DIR: dir, PRE_V3_ARTIFACT_DIR: dir, GITHUB_SHA: 'a'.repeat(40), ...env};
  const result = await runProof({rt: backend.rt, env: full, registry, fixtureOptions: {flow: backend.flow, reloadDelayMs: 0, ...fixtureOptions}, nowMs: START, exists: path => path === env.EX06_CORPUS || path === dir});
  return {...result, backend, dir};
}

test('SMOKE corpus end to end: the canary passes, three cases run, the result is SMOKE_ONLY (never PASS), the report files are written and the foreign workers are put back', async () => {
  const {report, exitCode, backend, dir} = await proof();
  assert.deepEqual(report.harnessErrors, []);
  assert.equal(report.canary.status, 'PASS');
  assert.equal(report.corpus.label, 'SMOKE');
  assert.equal(report.corpus.ran, 3);
  assert.equal(report.result, 'SMOKE_ONLY');
  assert.equal(exitCode, 0);
  assert.ok(report.warnings.some(text => text.includes('SMOKE')));
  for (const file of ['ex06-s03-report.json', 'ex06-s03-report.md', 'ex06-catalog-before-extension.json']) assert.ok(existsSync(join(dir, file)), file);
  assert.equal(JSON.parse(readFileSync(join(dir, 'ex06-s03-report.json'), 'utf8')).result, 'SMOKE_ONLY');
  const foreign = [...backend.state.profiles.values()].filter(p => p.display_name.startsWith('Foreign'));
  assert.equal(foreign.length, 2);
  assert.ok(foreign.every(p => p.profile_status === 'ACTIVE' && p.available_now === true), 'the workers that were on the chain are back as they were');
  assert.equal(report.foreign.parkedWorkers >= 2 && report.foreign.restored >= 2, true);
  const fixtures = [...backend.state.profiles.values()].filter(p => p.kind === 'WORKER' && !p.display_name.startsWith('Foreign') && p.profile_status === 'ACTIVE');
  assert.deepEqual(fixtures, [], 'every fixture worker was retired');
  assert.equal(backend.state.schedule.size, 0, 'every fixture task left the dispatch schedule');
});

test('the real S02 corpus end to end: 37 cases run on the product path, every precondition read back, nothing is a harness error, the unconsumed expectations and the skipped cases are reported', async () => {
  const {report, exitCode, dir} = await proof({env: {EX06_CORPUS: corpusFile, EX06_REQUIRE_CORPUS: '1'}});
  assert.deepEqual(report.harnessErrors, [], JSON.stringify(report.harnessErrors.slice(0, 3)));
  assert.equal(report.canary.status, 'PASS');
  assert.equal(report.corpus.label, 'CORPUS');
  assert.equal(report.corpus.id, 'EX06_CONTRACT_CORPUS');
  assert.equal(report.corpus.totalCases, 66);
  assert.equal(report.corpus.buildable, 37);
  assert.equal(report.corpus.ran, 37);
  assert.equal(report.corpus.skipped.length, 29);
  assert.equal(report.corpus.unconsumed.total, 80);
  // six cases ask for AVAILABLE_NOW_AND_SCHEDULED and store no window (T-003 T-006 T-007 T-008 T-026 T-027): the shape is not built, so the run is PARTIAL, never a quiet PASS or FINDINGS
  assert.equal(report.result, 'PARTIAL');
  assert.equal(exitCode, 0);
  assert.deepEqual(report.cases.filter(item => item.shapeDegraded).map(item => item.id), ['T-003', 'T-006', 'T-007', 'T-008', 'T-026', 'T-027']);
  assert.deepEqual(report.cases.filter(item => item.positiveOnly).map(item => item.id), ['T-004', 'T-005', 'T-036']);
  assert.deepEqual(report.corpus.positiveOnly.map(item => item.id), ['T-004', 'T-005', 'T-036'], 'the explicit opt-outs are listed with their reasons');
  assert.ok(report.corpus.positiveOnly.every(item => /applicationTimeBlockers \["TEAM_CAPACITY_EXCEEDED"\]/.test(item.reason)));
  assert.deepEqual(report.scope, {totalCases: 66, buildable: 37, ran: 37, skipped: 29, compared: 37, refused: 0, errored: 0, unasserted: 0, positiveOnly: 3, shapeDegraded: 6, leavesPresent: 897, leavesCompared: 436});
  assert.deepEqual([report.corpus.compared, report.corpus.refused, report.corpus.errored, report.corpus.leavesComparedAtRun], [37, 0, 0, 436]);
  assert.equal(report.paths.product, 37);
  assert.equal(report.paths.direct, 0);
  assert.equal(report.degradedCases.length, 0);
  assert.ok(report.auth.accountsCreated > 190 && report.auth.retries === 0 && report.auth.failures === 0, JSON.stringify(report.auth));
  assert.equal(report.activeBackends, null, 'nothing was aborted, so no backend was diagnosed');
  assert.ok(report.assertions.matcher > 300 && report.assertions.positive > 100 && report.assertions.negative > 100 && report.assertions.preconditions > 200, JSON.stringify(report.assertions));
  assert.ok(report.assertions.controls >= 37 * 5 && report.assertions.derived.positive > 50 && report.assertions.kinds.checked === 37, JSON.stringify(report.assertions));
  assert.ok(report.cases.every(item => ['PASS', 'FINDING', 'POSITIVE_ONLY', 'SHAPE_DEGRADED'].includes(item.status)));
  assert.ok(report.cases.filter(item => ['T-004', 'T-005', 'T-036'].includes(item.id)).every(item => item.status === 'POSITIVE_ONLY'), 'a positive-only case is never a plain PASS');
  assert.ok(report.cases.filter(item => item.shapeDegraded && item.status !== 'FINDING').every(item => item.status === 'SHAPE_DEGRADED'), 'a SHAPE_DEGRADED case is never a plain PASS');
  assert.ok(report.findings.filter(item => item.kind === 'SHAPE_DEGRADED_WORKER').every(item => ['T-003', 'T-006', 'T-007', 'T-008', 'T-026', 'T-027'].includes(item.caseId)));
  assert.ok(report.cases.every(item => item.interval === null || /^2026-10-0[2-9]|^2026-10-[1-3]/.test(item.interval.startsAt)), 'the S02 windows were rebased against the CI clock');
  assert.equal(report.corpus.rebase.ciNowUtc, '2026-10-01T12:00:00Z');
  assert.equal(report.digest.unchanged, true);
  const line = resultLine(report);
  assert.ok(line.startsWith('RESULT ' + report.result) && line.includes('cases ran 37/66') && line.includes('skipped 29') && line.includes('unconsumed 80'), line);
  assert.ok(line.includes('scope: PARTIAL on 37 of 66 cases, 0 refused, 29 skipped, 436 of 897 leaves compared') && line.includes('positive-only 3, SHAPE_DEGRADED 6'), line);
  const markdown = readFileSync(join(dir, 'ex06-s03-report.md'), 'utf8');
  for (const part of ['## Canary', '## Pin gate', '## Expected versus actual', '## Cases not run', '## Corpus expectations NOT consumed by S03', '## How each task was built', 'T-001', 'W-001', 'CALENDAR_CONFLICT',
    '**Scope: PARTIAL on 37 of 66 cases, 0 refused, 29 skipped, 436 of 897 leaves compared**', '## POSITIVE_ONLY cases', '## SHAPE_DEGRADED cases', '## Cases refused by the product path (NOT compared)',
    'actually compared with the chain at run time 436', 'Auth accounts created through the proof adapter: ']) assert.ok(markdown.includes(part), part);
  assert.ok(annotationsFor(report).some(text => text.startsWith('::error::') && text.includes('PARTIAL: 37 of 66 cases compared') && text.includes('SHAPE_DEGRADED 6')));
  assert.ok(markdown.length < 900000, 'the step summary limit');
  // the designed S03 findings of the corpus (A3: radius predicted by city names, a stem false positive) show up as findings, not as errors
  const t31 = report.findings.filter(item => item.caseId === 'T-031');
  assert.ok(t31.some(item => item.field.startsWith('hidden kinds')), 'T-031: the unclassified expected kind meets the stems');
  assert.ok(t31.some(item => item.worker === 'does-not-fit' && item.note?.includes('source-reading prediction')), 'T-031: the corpus recorded a prediction that differs');
});

test('a capped run is PARTIAL and says so; a corpus that is required but missing is a harness error, not a SMOKE run', async () => {
  const capped = await proof({env: {EX06_CORPUS: corpusFile, EX06_MAX_CASES: '3'}});
  assert.equal(capped.report.corpus.ran, 3);
  assert.equal(capped.report.corpus.capped, true);
  assert.equal(capped.report.result, 'PARTIAL');
  assert.ok(annotationsFor(capped.report).some(line => line.startsWith('::error::') && line.includes('PARTIAL')));
  const bad = await proof({env: {EX06_CORPUS: corpusFile, EX06_MAX_CASES: '0'}});
  assert.equal(bad.report.result, 'HARNESS_BROKEN');
  assert.ok(bad.report.harnessErrors.some(item => /CASE_CAP_INVALID/.test(item.message)));
  const required = await proof({env: {EX06_REQUIRE_CORPUS: '1'}});
  assert.equal(required.report.result, 'HARNESS_BROKEN');
  assert.ok(required.report.harnessErrors.some(item => /CORPUS_REQUIRED_BUT_MISSING/.test(item.message)));
  assert.equal(required.exitCode, 1);
});

test('a canary that disagrees is a harness error that stops the run before any corpus case (never a finding), and the foreign workers are still put back', async () => {
  const {report, exitCode, backend} = await proof({quirks: {ignoreTools: true}});
  assert.equal(report.result, 'HARNESS_BROKEN');
  assert.equal(exitCode, 1);
  assert.equal(report.canary.status, 'FAILED');
  assert.ok(report.harnessErrors.some(item => /CANARY_FAILED/.test(item.message)));
  assert.equal(report.corpus.ran, 0);
  assert.deepEqual(report.findings, [], 'canary disagreements are not findings');
  assert.ok([...backend.state.profiles.values()].filter(p => p.display_name.startsWith('Foreign')).every(p => p.profile_status === 'ACTIVE'));
});

test('a product path that refuses to publish fails the canary (a harness error) instead of falling back to a direct insert', async () => {
  const {report, backend} = await proof({quirks: {refusePublish: true}});
  assert.equal(report.result, 'HARNESS_BROKEN');
  assert.equal(report.canary.status, 'FAILED');
  assert.ok(report.canary.problems.some(text => /PRODUCT_PATH_REFUSED_READY_CASE/.test(text)));
  assert.equal(backend.state.needs.size > 0, true);
  assert.ok(![...backend.state.needs.values()].some(need => need.status === 'PUBLISHED'), 'nothing was published by a direct insert');
});

test('a wave that returns nothing is a harness error at the wave step, and a moved certificate or catalog is a harness error at the end', async () => {
  const wave = await proof({quirks: {waveNull: true}});
  assert.equal(wave.report.result, 'HARNESS_BROKEN');
  assert.equal(wave.report.canary.status, 'FAILED');
  assert.ok(wave.report.canary.problems.some(text => /WAVE_SHAPE_INVALID/.test(text)));
  const moved = await proof({quirks: {certificateMovesAfter: true}});
  assert.equal(moved.report.digest.unchanged, false);
  assert.ok(moved.report.harnessErrors.some(item => item.where === 'certificate'));
  assert.equal(moved.report.result, 'HARNESS_BROKEN');
  const catalog = await proof({quirks: {catalogMoves: true}});
  assert.ok(catalog.report.harnessErrors.some(item => item.where === 'catalog' && /changed while the harness ran/.test(item.message)), 'the catalog moved between the baseline and the end: the harness must only write data');
  assert.equal(catalog.report.result, 'HARNESS_BROKEN');
  const inconsistent = await proof({quirks: {certificateInconsistent: true}});
  assert.equal(inconsistent.report.digest.startConsistent, false);
  assert.ok(inconsistent.report.harnessErrors.some(item => /CERTIFICATE_NOT_CONSISTENT_AT_THE_START/.test(item.message)));
  assert.equal(inconsistent.report.corpus.ran, 0);
});

test('a differing pin downgrades the evidence label and is reported, but never fails the run', async () => {
  const wave = '0'.repeat(32);
  const {report, exitCode} = await proof({quirks: {pinMd5: {'private.dispatch_next_wave': wave}}});
  assert.match(report.evidenceLabel, /^MATCH\/DISPATCH\/EVENT FUNCTION BODIES != DEV \(1 of 11 pins differ or are missing/);
  assert.equal(report.pinGate.different.length, 1);
  assert.equal(report.pinRows.find(row => row.name === 'private.dispatch_next_wave').verdict, 'DIFFERENT');
  assert.equal(report.pinRows.find(row => row.name === 'public.rpc_begin_push_send').verdict, 'READ_AFTER_EXTENSION');
  assert.equal(report.pinRows.find(row => row.name === 'private.closure_source_digest_v5').verdict, 'EQUAL');
  assert.equal(exitCode, 0);
  assert.equal(report.chain.dependencyBodies['private.schedule_fit'].length, 1);
  assert.equal(report.chain.configRows.length, 3);
  assert.ok(report.chain.catalog.sha256.length === 64 && report.chain.catalog.functions >= 1);
});

test('the second section: the 12th pin and the objects the extension changed are read AFTER the proof, against the proof\'s own report and catalog file', async () => {
  const first = await proof();
  const env = {EX06_ARTIFACT_DIR: first.dir, PRE_V3_ARTIFACT_DIR: first.dir, GITHUB_SHA: 'a'.repeat(40)};
  const plain = runExtensionReport({rt: createSimulatedBackend({startMs: START}).rt, env});
  assert.equal(plain.report.result, 'READ');
  assert.equal(plain.exitCode, 0);
  assert.deepEqual(plain.report.changed, {added: [], removed: [], changed: []}, 'nothing changed on an unextended chain');
  assert.equal(plain.report.label, 'MATCH/DISPATCH/EVENT FUNCTION BODIES == DEV (11 pins equal at the proof point (chain without the extension) + the 12th equal after the extension (different chain state); helper functions, config rows and triggers not pinned)',
    'the 11 were read in another chain state and are not re-read: the label says so and is never a bare "== DEV (12 pins)"');
  assert.ok(!/== DEV \(12 pins/.test(plain.report.label));
  const extended = runExtensionReport({rt: createSimulatedBackend({startMs: START, quirks: {catalogExtension: true, pinMd5: {'public.rpc_begin_push_send': 'b8e7537d453069c82bc1f7a7ee6fb10a'}}}).rt, env});
  assert.equal(extended.report.result, 'READ');
  assert.deepEqual(extended.report.changed.added, ['function:private.platform_price_add_version(p text)']);
  assert.deepEqual(extended.report.changed.changed.map(item => item.name), ['function:private.match_detail(nid uuid, pid uuid)']);
  assert.match(extended.report.label, /^MATCH\/DISPATCH\/EVENT FUNCTION BODIES != DEV \(1 of 12 pins differ or are missing: 0 of 11 at the proof point \(chain without the extension\), 1 of 1 after the extension \(different chain state\); /);
  assert.equal(extended.report.pinRows[0].verdict, 'DIFFERENT');
  assert.match(extended.report.pinRows[0].explanation, /KNOWN_PREDECESSOR: source147 body/);
  const markdown = readFileSync(join(first.dir, 'ex06-s03-extension-report.md'), 'utf8');
  for (const part of ['## The 12th pin', '## Objects the extension changed', 'ADDED function:private.platform_price_add_version', 'CHANGED function:private.match_detail', 'Certificate after the extension']) assert.ok(markdown.includes(part), part);
  assert.match(extensionResultLine(extended.report), /^EXTENSION_RESULT READ \| MATCH.* \| changed \+1 -0 ~1 \| stages 0$/);
  const lonely = runExtensionReport({rt: createSimulatedBackend({startMs: START}).rt, env: {EX06_ARTIFACT_DIR: mkdtempSync(join(tmpdir(), 'ex06-')), GITHUB_SHA: 'a'.repeat(40)}});
  assert.equal(lonely.report.result, 'READ');
  assert.ok(lonely.report.warnings.some(text => /first section report was not found/.test(text)) && lonely.report.warnings.some(text => /catalog file of the first section was not found/.test(text)));
  assert.match(lonely.report.label, /^12TH PIN ONLY/);
});

test('the diagnostic direct path makes every case DEGRADED and the result PARTIAL, and says so at the top of the report', async () => {
  const {report} = await proof({env: {EX06_CORPUS: corpusFile, EX06_NEED_PATH: 'auto', EX06_MAX_CASES: '4'}});
  assert.equal(report.needPath, 'auto');
  assert.ok(report.warnings.some(text => /diagnostic mode/.test(text)));
  assert.equal(report.paths.direct, 0, 'the product path works in the simulation, so auto never needs the fallback');
  assert.equal(report.result, 'PARTIAL', 'a capped run is partial');
});

// ------------------------------------------------------------------ round 3: the run must not read as a green light when it is not one
test('an "everyone eligible" matcher that appears after the canary does not survive the corpus: every negative the corpus names is a finding, the result is not PASS', async () => {
  // the canary runs first on the first 7 tasks; from the 8th task on the stub drops every gate except a DRAFT profile
  const {report, exitCode} = await proof({env: {EX06_CORPUS: corpusFile, EX06_REQUIRE_CORPUS: '1'}, quirks: {everyoneEligibleFromNeed: 8}});
  assert.equal(report.canary.status, 'PASS', 'the canary ran before the stub');
  assert.notEqual(report.result, 'PASS');
  assert.equal(exitCode, 0, 'findings are findings, not a broken harness');
  assert.ok(report.findings.length > 100, 'every named negative of the corpus disagrees: ' + report.findings.length);
  assert.ok(report.cases.filter(item => item.status === 'FINDING').length >= 30);
  assert.ok(report.findings.some(item => item.field === 'hardBlockers') && report.findings.some(item => item.field === 'dispatchBlockers'));
  // the three explicit positive-only cases are the ones a stub cannot fail: they are listed as POSITIVE_ONLY and counted, never a plain PASS
  assert.ok(report.cases.filter(item => ['T-004', 'T-005', 'T-036'].includes(item.id)).every(item => item.status === 'POSITIVE_ONLY'));
  assert.equal(report.scope.positiveOnly, 3);
});

test('a corpus case that the corpus gives no negative for and that is NOT explicitly positive-only is a harness error (UNDISCRIMINATING_CASE): an S02 edit cannot quietly turn a case into one an "everyone eligible" matcher passes', async () => {
  const raw = JSON.parse(readFileSync(corpusFile, 'utf8'));
  for (const row of raw.cases.find(item => item.id === 'T-004').referenceWorkers) row.expect.applicationTimeBlockers = [];   // the corpus no longer says why there is no negative
  const dir = mkdtempSync(join(tmpdir(), 'ex06-corpus-'));
  const mutated = join(dir, 'mutated.json');
  writeFileSync(mutated, JSON.stringify(raw));
  const {report, exitCode} = await proof({env: {EX06_CORPUS: mutated, EX06_REQUIRE_CORPUS: '1', EX06_MAX_CASES: '6'}});
  assert.equal(report.result, 'HARNESS_BROKEN');
  assert.equal(exitCode, 1);
  const t4 = report.cases.find(item => item.id === 'T-004');
  assert.equal(t4.status, 'HARNESS_ERROR');
  assert.match(t4.error, /UNDISCRIMINATING_CASE.*the harness control does not count/);
  assert.equal(report.cases.find(item => item.id === 'T-001').status, 'PASS');
});

test('a run in which the product refuses part of the corpus after a passing canary is PARTIAL with the refusals listed and NOT compared (never a quiet FINDINGS): scope = compared + refused', async () => {
  const {report, exitCode, dir} = await proof({env: {EX06_CORPUS: corpusFile, EX06_REQUIRE_CORPUS: '1'}, quirks: {refuseCorpusPublishEvery: 2}});
  assert.equal(report.canary.status, 'PASS');
  assert.equal(report.result, 'PARTIAL');
  assert.equal(exitCode, 0);
  assert.ok(report.scope.refused >= 15 && report.scope.compared >= 15, JSON.stringify(report.scope));
  assert.equal(report.scope.compared + report.scope.refused, 37);
  assert.equal(report.findings.filter(item => item.kind === 'PRODUCT_PATH_REFUSED_READY_CASE').length, report.scope.refused);
  assert.ok(report.cases.filter(item => item.status === 'PRODUCT_PATH_REFUSED').every(item => item.step === 'publish' && item.materialisation === 'PRODUCT_PATH_REFUSED'));
  const line = resultLine(report);
  assert.ok(line.includes(`scope: PARTIAL on ${report.scope.compared} of 66 cases, ${report.scope.refused} refused, 29 skipped`), line);
  assert.ok(annotationsFor(report).some(text => text.startsWith('::error::') && text.includes('REFUSED by the product path and NOT compared')));
  const markdown = readFileSync(join(dir, 'ex06-s03-report.md'), 'utf8');
  assert.ok(markdown.includes('## Cases refused by the product path (NOT compared)') && markdown.includes('refused at publish'));
});

test('GoTrue\'s rate limit during the run is retried with a bounded back-off and reported (no real sleeping in the test); the run is not broken by it', async () => {
  const waited = [];
  const {report} = await proof({quirks: {rateLimitedFirst: 3}, fixtureOptions: {sleep: async ms => { waited.push(ms); }}});
  assert.deepEqual(report.harnessErrors, []);
  assert.equal(report.result, 'SMOKE_ONLY');
  assert.deepEqual(waited, [30000, 30000, 30000]);
  assert.deepEqual([report.auth.retries, report.auth.rateLimited, report.auth.waitedMs, report.auth.failures], [3, 3, 90000, 0]);
  assert.ok(report.auth.accountsCreated > 20);
  assert.match(resultLine(report), /auth accounts \d+, 429 retries 3, failed 0 \|/, 'the RESULT line carries the Auth numbers of the first run');
  const exhausted = await proof({quirks: {rateLimitedFirst: 10000}, fixtureOptions: {sleep: async () => {}, authRetry: {backoffMs: 30000, maxWaitMs: 60000, maxTotalWaitMs: 60000}}});
  assert.equal(exhausted.report.result, 'HARNESS_BROKEN');
  assert.ok(exhausted.report.auth.failures >= 1 && exhausted.report.auth.retries === 2);
  assert.ok(exhausted.report.harnessErrors.some(item => /rate limit/i.test(item.message)));
});

test('a call that timed out is a harness error, and the active backends are recorded and the stuck ones terminated before the fixtures are retired (which query hung, not only that one did)', async () => {
  const stuck = {pid: 4242, usename: 'authenticator', state: 'active', age_s: 120, query: 'select public.rpc_save_worker_location(...)'};
  const young = {pid: 4243, usename: 'authenticator', state: 'active', age_s: 2, query: 'select 1'};
  const {report, exitCode, backend, dir} = await proof({quirks: {timeoutAt: 'rpc_save_worker_location', stuckBackends: [stuck, young]}});
  assert.equal(report.result, 'HARNESS_BROKEN');
  assert.equal(exitCode, 1);
  assert.ok(report.harnessErrors.some(item => /TimeoutError/.test(item.message)));
  assert.equal(report.activeBackends.backends.length, 2);
  assert.deepEqual(report.activeBackends.terminated, [4242]);
  assert.deepEqual(backend.state.terminated, [4242], 'only the backend that was stuck for a while');
  const markdown = readFileSync(join(dir, 'ex06-s03-report.md'), 'utf8');
  assert.ok(markdown.includes('## Active database backends after an aborted or timed-out call') && markdown.includes('pid 4242'));
  // no abort, no diagnosis
  const calm = await proof({quirks: {stuckBackends: [stuck]}});
  assert.equal(calm.report.activeBackends, null);
  assert.deepEqual(calm.backend.state.terminated, []);
});

test('the fixtures are read back to the CONTENT: a writer that normalised the generated rule (availability), a task the product turned urgent, and a world gate that is missing are harness errors of the canary, not findings', async () => {
  const mangled = await proof({quirks: {mangleRules: true}});
  assert.equal(mangled.report.result, 'HARNESS_BROKEN');
  assert.ok(mangled.report.harnessErrors.some(item => /FIXTURE_NOT_APPLIED:availability_rule_content/.test(item.message)), JSON.stringify(mangled.report.harnessErrors.slice(0, 2)));
  assert.deepEqual(mangled.report.findings, []);
  const urgent = await proof({quirks: {urgentNeed: true}});
  assert.equal(urgent.report.result, 'HARNESS_BROKEN');
  assert.ok(urgent.report.harnessErrors.some(item => /FIXTURE_NOT_APPLIED:urgent/.test(item.message)));
  const noGate = await proof({quirks: {noWorldGate: true}});
  assert.equal(noGate.report.result, 'HARNESS_BROKEN');
  assert.equal(noGate.report.canary.status, 'FAILED');
  assert.ok(noGate.report.canary.problems.some(text => /canary-world\/test-world\/delivery/.test(text)), JSON.stringify(noGate.report.canary.problems.slice(0, 3)));
  assert.deepEqual(noGate.report.findings, [], 'a canary disagreement is never a finding');
});

test('the labelled direct insert works under the guard of private.guard_need_write: both tokens before the insert, the geography row for a non-remote task; the simulation REFUSES an insert without the region token', async () => {
  const {report, backend} = await proof({env: {EX06_CORPUS: corpusFile, EX06_REQUIRE_CORPUS: '1', EX06_NEED_PATH: 'direct', EX06_MAX_CASES: '5'}});
  assert.deepEqual(report.harnessErrors, [], JSON.stringify(report.harnessErrors.slice(0, 2)));
  assert.equal(report.paths.direct, 5);
  assert.equal(report.result, 'PARTIAL');
  const inserts = backend.state.directInserts;
  assert.equal(inserts.length, 5);
  assert.ok(inserts.every(item => item.lifecycle && item.region), 'both tokens on every direct insert');
  assert.ok(inserts.every(item => item.geography !== null && item.geography.mode), 'a non-remote task carries its public topology');
  assert.ok(inserts[0].columns.includes('task_country_code') && inserts[0].columns.includes('task_timezone'));
  // the guard itself: the same statement without the region token is the NEED_COUNTRY_REQUIRES_CONFIRMED_REVIEW the old fixtures hit
  const statement = backend.state.sqlSeen.find(text => text.includes('insert into public.needs('));
  const without = statement.replace(/select set_config\('uskoci\.need_region', 'CONFIRMED_REVIEW', true\);/, '');
  assert.notEqual(without, statement);
  assert.throws(() => backend.rt.sql(without), /NEED_COUNTRY_REQUIRES_CONFIRMED_REVIEW/);
  const noLifecycle = statement.replace(/select set_config\('uskoci\.need_lifecycle', 'PUBLISH', true\);/, '');
  assert.throws(() => backend.rt.sql(noLifecycle), /NEED_MUST_START_AS_DRAFT/);
  assert.doesNotThrow(() => backend.rt.sql(statement));
});

// ------------------------------------------------------------------ the workflow (text checks: no YAML parser is available to the offline step)
test('the workflow: step timeouts, the Auth rate limits printed before the proof, the manual max_cases input, a path filter that follows every file the proof reads and ignores documentation', () => {
  const text = readFileSync(fileURLToPath(new URL('../../../../.github/workflows/ex06-s03-matching-proof.yml', import.meta.url)), 'utf8');
  assert.ok(!text.includes('\r'), 'LF only');
  const stepOf = title => { const start = text.indexOf('- name: ' + title); assert.ok(start >= 0, title); const next = text.indexOf('\n      - ', start + 10); return text.slice(start, next < 0 ? text.length : next); };
  const proofStep = stepOf('Corpus-driven matching proof');
  const extensionStep = stepOf('Fidelity extension for public.rpc_begin_push_send');
  assert.match(proofStep, /\n {8}timeout-minutes: 45\n/);
  assert.match(extensionStep, /\n {8}timeout-minutes: 40\n/);
  assert.match(extensionStep, /\n {8}if: always\(\)\n/);
  assert.ok(proofStep.indexOf('[auth.rate_limit]') >= 0 && proofStep.indexOf('GITHUB_STEP_SUMMARY') < proofStep.indexOf('19-ex06-s03-proof START'), 'the limits are in the summary BEFORE the proof starts');
  assert.ok(proofStep.includes('/tmp/uskoci-ru5-device-ui/supabase/config.toml') && text.includes('auth-rate-limits.txt'));
  assert.match(text, /workflow_dispatch:\n {4}inputs:\n {6}max_cases:/);
  assert.match(text, /EX06_MAX_CASES: \$\{\{ github\.event\.inputs\.max_cases \}\}/);
  const paths = [...text.slice(text.indexOf('    paths:'), text.indexOf('  workflow_dispatch:')).matchAll(/- '([^']+)'/g)].map(match => match[1]);
  for (const path of ['.github/workflows/ex06-s03-matching-proof.yml', 'supabase/proofs/ex06/**', 'supabase/proofs/ai/corpus/**', 'src/contracts/needFactsV2.ts', 'supabase/proofs/pre_v3/closure_runtime.mjs',
    'supabase/proofs/pre_v3/history_snapshot.mjs', 'supabase/proofs/ru5_device_ui_local_guard.mjs', 'supabase/proofs/ru5_device_ui_live79_env.sh', 'supabase/proofs/ex04/ts_loader.mjs',
    'supabase/proofs/pkg023/pkg023_flow.mjs', 'supabase/proofs/policy/publication_fixtures.mjs', 'docs/implementation/product-v1-closure-20260926/finalization-20260927/ex06/EX06_S01_DEV_BEFORE_BASELINE_20261001.md',
    'supabase/candidates/pkg051a_platform_price_list.sql', 'supabase/candidates/b24_nonretried_conflicts_part1.sql', 'supabase/candidates/chat_p4_push_event_transport.sql']) assert.ok(paths.includes(path), path);
  assert.ok(paths.includes('!supabase/proofs/ex06/*.md') && paths.includes('!supabase/proofs/ex06/**/*.md'), 'documentation under the harness directory does not start the job');
  assert.ok(!paths.some(path => /README|DISPOSITION/.test(path)), 'no documentation file is a trigger');
  assert.ok(paths.indexOf('supabase/proofs/ex06/**') < paths.indexOf('!supabase/proofs/ex06/*.md'), 'a negation only removes what an EARLIER pattern matched');
});
