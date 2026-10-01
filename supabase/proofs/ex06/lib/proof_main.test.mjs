// Offline END-TO-END test of the proof orchestration (lib/proof_main.mjs): the REAL fixtures, runner, S02 adapter, pins and report writers run against a SIMULATED backend
// (lib/sim_backend.mjs), so wiring mistakes that the unit tests (which fake one layer at a time) cannot see surface here: a wrong property name, a SQL shape the fixtures send, a report
// field the renderer needs. The simulation is not evidence about the chain and its matcher oracle is written for the test; what this proves is that the harness runs end to end, that its
// guards fire when the pipeline is broken on purpose, and that the files it writes are complete. `node --test supabase/proofs/ex06/lib/`.
process.env.EX06_QUIET = '1';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync} from 'node:fs';
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
async function proof({env = {}, quirks = {}, foreignWorkers = 2} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ex06-'));
  const backend = createSimulatedBackend({quirks, foreignWorkers, startMs: START});
  const full = {EX06_ARTIFACT_DIR: dir, PRE_V3_ARTIFACT_DIR: dir, GITHUB_SHA: 'a'.repeat(40), ...env};
  const result = await runProof({rt: backend.rt, env: full, registry, fixtureOptions: {flow: backend.flow, reloadDelayMs: 0}, nowMs: START, exists: path => path === env.EX06_CORPUS || path === dir});
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
  assert.ok(['PASS', 'FINDINGS'].includes(report.result), report.result);
  assert.equal(exitCode, 0);
  assert.equal(report.paths.product, 37);
  assert.equal(report.paths.direct, 0);
  assert.equal(report.degradedCases.length, 0);
  assert.ok(report.assertions.matcher > 300 && report.assertions.positive > 100 && report.assertions.negative > 100 && report.assertions.preconditions > 200, JSON.stringify(report.assertions));
  assert.ok(report.assertions.controls >= 37 * 5 && report.assertions.derived.positive > 50 && report.assertions.kinds.checked === 37, JSON.stringify(report.assertions));
  assert.ok(report.cases.every(item => ['PASS', 'FINDING'].includes(item.status)));
  assert.ok(report.cases.every(item => item.interval === null || /^2026-10-0[2-9]|^2026-10-[1-3]/.test(item.interval.startsAt)), 'the S02 windows were rebased against the CI clock');
  assert.equal(report.corpus.rebase.ciNowUtc, '2026-10-01T12:00:00Z');
  assert.equal(report.digest.unchanged, true);
  const line = resultLine(report);
  assert.ok(line.startsWith('RESULT ' + report.result) && line.includes('cases ran 37/66') && line.includes('skipped 29') && line.includes('unconsumed 80'), line);
  const markdown = readFileSync(join(dir, 'ex06-s03-report.md'), 'utf8');
  for (const part of ['## Canary', '## Pin gate', '## Expected versus actual', '## Cases not run', '## Corpus expectations NOT consumed by S03', '## How each task was built', 'T-001', 'W-001', 'CALENDAR_CONFLICT']) assert.ok(markdown.includes(part), part);
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
  assert.equal(plain.report.label, 'MATCH/DISPATCH/EVENT FUNCTION BODIES == DEV (12 pins; helper functions, config rows and triggers not pinned)');
  const extended = runExtensionReport({rt: createSimulatedBackend({startMs: START, quirks: {catalogExtension: true, pinMd5: {'public.rpc_begin_push_send': 'b8e7537d453069c82bc1f7a7ee6fb10a'}}}).rt, env});
  assert.equal(extended.report.result, 'READ');
  assert.deepEqual(extended.report.changed.added, ['function:private.platform_price_add_version(p text)']);
  assert.deepEqual(extended.report.changed.changed.map(item => item.name), ['function:private.match_detail(nid uuid, pid uuid)']);
  assert.match(extended.report.label, /^MATCH\/DISPATCH\/EVENT FUNCTION BODIES != DEV \(1 of 12 pins differ/);
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
