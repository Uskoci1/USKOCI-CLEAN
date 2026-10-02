// Offline WIRING test of ex06b_passes.mjs: the real S03 fixtures and runner, the real S02 corpus v1 and the additive corpus v1.1, and the real pass runner of the proof, against the SIMULATED backend of the S03 harness
// (lib/sim_backend.mjs). The simulation's matcher oracle is the PREDECESSOR (the PKG-031b regular expressions); for the "candidate" the test loads a PATCHED COPY of the simulation in which only the hidden-kind
// function is replaced by the independent model of the candidate (ex06b_lib.kindsOf over the twelve rows of the generated candidate). It proves the pipeline end to end: the corpus v1.1 loads and runs through the product
// path, the findings of the predecessor are EXACTLY the written fail-before set, the candidate leaves none, the difference between the two passes is EXACTLY the written flips (T-031 of the S02 corpus and the
// v1.1 cases), a pass that did not cover its cases is refused, and mutants of the candidate (the stem left in, no Cyrillic fold) are caught. It is NOT evidence about the SQL or the chain: the CI proof is.
// node --test supabase/proofs/ex06/ex06b_passes.test.mjs
process.env.EX06_QUIET = '1';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test, {after} from 'node:test';
import {createFixtures} from './lib/fixtures.mjs';
import {normaliseCorpus} from './lib/corpus.mjs';
import {loadCorpus} from './lib/s02_adapter.mjs';
import {registryFromSource} from './lib/test_support.mjs';
import * as lib from './ex06b_lib.mjs';
import {REBASE_MAX_AGE_MS, createPassRunner, localDate} from './ex06b_passes.mjs';

const START = Date.UTC(2026, 9, 1, 12, 0, 0);
const here = path => fileURLToPath(new URL(path, import.meta.url));
const registry = registryFromSource();
const corpusV1Text = readFileSync(here('../ai/corpus/ex06_contract_corpus_v1.json'), 'utf8');
const corpusV11 = JSON.parse(readFileSync(here('s06/ex06_contract_corpus_v1_1.json'), 'utf8'));
const corpusV1 = loadCorpus(JSON.parse(corpusV1Text), {registry, label: 'CORPUS', normaliseNative: normaliseCorpus});
const normalisedV11 = normaliseCorpus(corpusV11, {registry, label: 'CORPUS'});
const rows = lib.registryRowsOf(readFileSync(here('../../candidates/ex06b_alias_registry.sql'), 'utf8'));
const oldStems = lib.parseOldBody(readFileSync(here('s06/ex06b_work_kinds_v5_dev_body.txt'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

// ------------------------------------------------------------------ the simulation with a replaceable hidden-kind function
const libDir = here('lib/') ;
const workDir = mkdtempSync(join(tmpdir(), 'ex06b-sim-'));
after(() => rmSync(workDir, {recursive: true, force: true}));
async function loadPatchedSimulation() {
  let source = readFileSync(join(libDir, 'sim_backend.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const definition = /export function workKinds\(values\) \{[\s\S]*?\n\}\n/;
  assert.ok(definition.test(source), 'the simulation defines workKinds the way this test expects');
  source = source.replace(definition, () => 'export function workKinds(values) { return globalThis.__EX06B_KINDS(values); }\n');
  source = source.replaceAll("from './", () => `from '${pathToFileURL(libDir).href}`);
  const file = join(workDir, 'sim_backend_patched.mjs');
  writeFileSync(file, source);
  return import(pathToFileURL(file).href);
}
const simulation = await loadPatchedSimulation();
const MODELS = {
  old: values => lib.oldKindsOf(values, oldStems),
  new: values => lib.kindsOf(values, rows),
  // mutants of the candidate
  stemLeftIn: values => lib.kindsOf(values, (() => { const copy = clone(rows); copy.find(row => row.key === 'work_kind:MONTAZA_NAMESTAJA').value.stems.push('sklapanj'); return copy; })()),
  noCyrillic: values => lib.oldKindsOf(values, lib.stemsOf(rows)),
};
function setup({model = 'old', quirks = {}, corpus = corpusV1, expectedCases, clock = {now: START}, shareRebase} = {}) {
  globalThis.__EX06B_KINDS = MODELS[model];
  const backend = simulation.createSimulatedBackend({startMs: START, quirks});
  const fx = createFixtures(backend.rt, {needPath: 'product', flow: backend.flow, reloadDelayMs: 0});
  const records = [];
  const pass = createPassRunner({fx, corpus, registry, sourceSha: 'a'.repeat(40), bodyMd5: () => 'sim0sim0sim0sim0sim0sim0sim0sim0', now: () => clock.now, record: (label, summary, findingKeys) => records.push({label, summary, findingKeys}),
    ...(expectedCases === undefined ? {} : {expectedCases}), ...(shareRebase === undefined ? {} : {shareRebase})});
  return {backend, fx, pass, records, clock};
}
const run = async (model, corpus, options = {}, label = 'pass') => setup({model, corpus, ...options}).pass(label, options.pass ?? {});

// ------------------------------------------------------------------ the corpus v1.1 on the predecessor and on the candidate
test('the corpus v1.1 loads, every case runs through the product path, and the findings of the PREDECESSOR are exactly the written fail-before set', async () => {
  const first = await run('old', normalisedV11, {}, 'before-v11');
  assert.equal(Object.keys(first.outcomes).length, 8);
  assert.deepEqual(lib.coverageProblems({outcomes: first.outcomes, summary: first.summary, expectedCases: 8}), []);
  assert.deepEqual(first.findings, lib.failBeforeFindings(corpusV11));
  assert.equal(first.findings.length, 39);
  assert.deepEqual(first.summary.productPath, {product: 8, direct: 0}, 'every task went through the product path');
  // the bypass of the exclusion case is listed, nothing else is bypassed
  assert.ok(first.summary.bypasses.some(item => item.caseId === 'T-108'));
  // the workers are exactly the written ones plus the derived fit and unfit and the harness control
  assert.deepEqual(Object.keys(first.outcomes['T-105'].workers).sort(), ['accusative-ikeu', 'control-restricted', 'fit', 'instrumental-ikeom', 'locative-ikei', 'other-kind', 'unfit']);
  // the derived fit worker (the exact text) is eligible and delivered on the predecessor, which is why the case is anchored; the alias workers are not
  assert.equal(first.outcomes['T-105'].workers.fit.delivery, true);
  assert.equal(first.outcomes['T-105'].workers['locative-ikei'].delivery, false);
  assert.equal(first.outcomes['T-105'].wave.inserted, 1);
  assert.equal(first.outcomes['T-108'].workers['excluded-in-cyrillic'].delivery, true, 'the Cyrillic exclusion is not an exclusion before');
  assert.equal(first.outcomes['T-108'].workers['excluded-in-latin'].delivery, false);
  assert.equal(first.outcomes['T-107'].workers['other-unknown'].delivery, false);
  assert.equal(first.outcomes['T-107'].workers['same-text-other-case'].delivery, true);
});

test('the same corpus on the CANDIDATE model leaves no finding, and the difference to the predecessor is exactly the written flips (eligibility, blockers, delivery, event, +30 / -30 points, the number of deliveries)', async () => {
  const before = await run('old', normalisedV11, {}, 'before-v11'), after = await run('new', normalisedV11, {}, 'after-v11');
  assert.deepEqual(after.findings, []);
  const flips = lib.checkFlips(lib.diffOutcomes(before.outcomes, after.outcomes), lib.v11IntendedFlips(corpusV11));
  assert.deepEqual([flips.unintended, flips.missing], [[], []]);
  assert.equal(flips.matched.length, lib.v11IntendedFlips(corpusV11).length);
  assert.equal(after.outcomes['T-105'].wave.inserted, 4);
  assert.equal(after.outcomes['T-106'].workers['furniture-assembler'].delivery, false);
  assert.equal(after.outcomes['T-108'].workers['excluded-in-cyrillic'].hardBlockers[0], 'PROFILE_EXCLUSION');
  // the STAYS case and the unchanged workers are identical
  assert.deepEqual(lib.diffOutcomes({'T-107': before.outcomes['T-107']}, {'T-107': after.outcomes['T-107']}), []);
});

test('MUTATION: a candidate that keeps the Latin behaviour but not the Cyrillic fold, or that fixes nothing, leaves the written fail-before findings in place (the proof would fail)', async () => {
  const noCyrillic = await run('noCyrillic', normalisedV11, {}, 'mutant-v11');
  assert.ok(noCyrillic.findings.length > 0 && noCyrillic.findings.every(key => lib.failBeforeFindings(corpusV11).includes(key)));
  assert.ok(noCyrillic.findings.includes('T-101|latin-skill|dispatchEligible') && noCyrillic.findings.includes('T-108|excluded-in-cyrillic|hardBlockers') && !noCyrillic.findings.includes('T-104|canonical-skill|dispatchEligible'),
    'the IKEA and dialect stems work, the Cyrillic cases still fail');
  const unchanged = await run('old', normalisedV11, {}, 'mutant-old-v11');
  assert.equal(unchanged.findings.length, 39);
});

// ------------------------------------------------------------------ the S02 corpus v1 (37 cases): F2 closed, nothing else moves
test('the S02 corpus v1 on the predecessor reproduces F2 (the three T-031 findings); on the candidate the only differences are the written T-031 flips, F2 is closed and nothing else moves', async () => {
  const before = await run('old', corpusV1, {}, 'before-v1'), after = await run('new', corpusV1, {}, 'after-v1');
  assert.equal(Object.keys(before.outcomes).length, 37);
  assert.deepEqual(lib.coverageProblems({outcomes: before.outcomes, summary: before.summary, expectedCases: 37}), []);
  for (const key of lib.V1_FINDINGS_CLOSED) assert.ok(before.findings.includes(key), 'F2 reproduced: ' + key);
  const flips = lib.checkFlips(lib.diffOutcomes(before.outcomes, after.outcomes), lib.V1_INTENDED_FLIPS);
  assert.deepEqual([flips.unintended, flips.missing], [[], []]);
  assert.equal(flips.matched.length, lib.V1_INTENDED_FLIPS.length);
  const closed = before.findings.filter(key => !after.findings.includes(key)), added = after.findings.filter(key => !before.findings.includes(key));
  assert.deepEqual([...closed].sort(), [...lib.V1_FINDINGS_CLOSED].sort());
  assert.deepEqual(added, []);
  assert.equal(before.outcomes['T-031'].workers['does-not-fit'].delivery, true);
  assert.equal(after.outcomes['T-031'].workers['does-not-fit'].delivery, false);
  assert.deepEqual(after.outcomes['T-031'].workers['does-not-fit'].dispatchBlockers, ['SERVICE_NOT_IN_WORK_PROFILE']);
  assert.equal(before.outcomes['T-031'].wave.inserted - after.outcomes['T-031'].wave.inserted, 1);
  // every other case: identical outcomes
  const others = Object.keys(before.outcomes).filter(id => id !== 'T-031');
  assert.deepEqual(lib.diffOutcomes(Object.fromEntries(others.map(id => [id, before.outcomes[id]])), Object.fromEntries(others.map(id => [id, after.outcomes[id]]))), []);
  // the full details of every worker were captured, the unchanged ones are identical (the simulated detail has no score components: the detail algebra is tested with realistic details elsewhere)
  assert.equal(Object.keys(before.details).length, Object.values(before.outcomes).reduce((sum, item) => sum + Object.keys(item.workers).length, 0));
  const sameDetails = Object.keys(before.details).filter(key => key !== 'T-031|does-not-fit');
  assert.deepEqual(lib.corpusDetailProblems(Object.fromEntries(sameDetails.map(key => [key, before.details[key]])), Object.fromEntries(sameDetails.map(key => [key, after.details[key]])), {}), []);
});

test('MUTATION: a candidate that leaves the stem sklapanj in does not close F2 (the T-031 flips are missing), and a candidate that breaks another Latin text is an unintended flip', async () => {
  const before = await run('old', corpusV1, {}, 'before-v1');
  const stemLeftIn = await run('stemLeftIn', corpusV1, {}, 'mutant-v1');
  const flips = lib.checkFlips(lib.diffOutcomes(before.outcomes, stemLeftIn.outcomes), lib.V1_INTENDED_FLIPS);
  assert.equal(flips.matched.length, 0);
  assert.equal(flips.missing.length, lib.V1_INTENDED_FLIPS.length);
  // an extra stem in the model: a Latin skill of the corpus now names a kind it did not name
  MODELS.extra = values => lib.kindsOf(values, (() => { const copy = clone(rows); copy.find(row => row.key === 'work_kind:DOSTAVA').value.stems.push('stana'); return copy; })());
  const extra = await run('extra', corpusV1, {}, 'mutant-extra-v1');
  const extraFlips = lib.checkFlips(lib.diffOutcomes(before.outcomes, extra.outcomes), lib.V1_INTENDED_FLIPS);
  assert.ok(extraFlips.unintended.length > 0 || extra.findings.join() !== before.findings.join(), 'an unwritten classification change is visible to the pass analysis');
  delete MODELS.extra;
});

// ------------------------------------------------------------------ the pass runner itself
test('two passes on an unchanged simulation are identical (outcomes, details, findings), so a difference between two compared passes means something', async () => {
  const {pass} = setup({model: 'old', corpus: normalisedV11});
  const first = await pass('first', {canary: false}), second = await pass('second', {canary: false});
  assert.deepEqual(lib.diffOutcomes(first.outcomes, second.outcomes), []);
  assert.deepEqual(lib.corpusDetailProblems(first.details, second.details, {}), []);
  assert.deepEqual(first.findings, second.findings);
});

test('the pass puts everything back: no fixture worker stays active, the workers that were on the chain before are restored as they were', async () => {
  const {pass, backend} = setup({model: 'old', corpus: normalisedV11});
  await pass('only', {canary: true});
  const active = [...backend.state.profiles.values()].filter(profile => profile.kind === 'WORKER' && profile.profile_status === 'ACTIVE' && !profile.display_name.startsWith('Foreign'));
  assert.deepEqual(active, []);
  const foreign = [...backend.state.profiles.values()].filter(profile => profile.display_name.startsWith('Foreign'));
  assert.ok(foreign.length === 2 && foreign.every(profile => profile.profile_status === 'ACTIVE' && profile.available_now === true));
});

test('a pass in which EVERY case is refused by the product path is refused by the coverage guard (never compared as "identical"); a subset pass counts its own cases', async () => {
  const refused = setup({model: 'old', corpus: normalisedV11, quirks: {refuseCorpusPublishEvery: 1}});
  await assert.rejects(() => refused.pass('refused', {canary: false}), /THE_PASS_DID_NOT_COVER_WHAT_IT_CLAIMS/);
  const {pass} = setup({model: 'old', corpus: corpusV1});
  const subset = await pass('subset', {caseIds: ['T-031'], canary: false});
  assert.deepEqual(Object.keys(subset.outcomes), ['T-031']);
  assert.deepEqual(subset.findings.filter(key => !key.startsWith('T-031')), []);
  await assert.rejects(() => setup({model: 'old', corpus: normalisedV11, expectedCases: 9}).pass('wrong-count', {canary: false}), /THE_PASS_DID_NOT_COVER_WHAT_IT_CLAIMS/);
});

test('one rebase serves every pass: the stored times of the S02 cases are the same in two passes started minutes apart, and a rebase older than three hours is refused', async () => {
  const clock = {now: START};
  const {pass} = setup({model: 'old', corpus: corpusV1, clock});
  const first = await pass('first', {caseIds: ['T-001', 'T-002', 'T-007'], canary: false});
  clock.now += 7 * 60000;
  const second = await pass('second', {caseIds: ['T-001', 'T-002', 'T-007'], canary: false});
  assert.deepEqual(lib.corpusTimeProblems(first.times, second.times, {referenceRebase: first.summary.rebase, otherRebase: second.summary.rebase}), []);
  assert.ok(first.summary.rebase && first.summary.rebase.deltaMs === second.summary.rebase.deltaMs);
  clock.now += REBASE_MAX_AGE_MS;
  await assert.rejects(() => pass('late', {caseIds: ['T-001'], canary: false}), /REBASE_TOO_OLD/);
  assert.equal(localDate(Date.UTC(2026, 9, 1, 22, 30)), '2026-10-02', 'the Belgrade calendar date is recorded per pass');
  // without sharing, two passes started apart would carry different stored times (the false verdict the shared rebase prevents)
  const unshared = {now: START}, other = setup({model: 'old', corpus: corpusV1, clock: unshared, shareRebase: false});
  const a = await other.pass('a', {caseIds: ['T-001', 'T-002'], canary: false});
  unshared.now += 90 * 60000;
  const b = await other.pass('b', {caseIds: ['T-001', 'T-002'], canary: false});
  assert.ok(lib.corpusTimeProblems(a.times, b.times, {referenceRebase: a.summary.rebase, otherRebase: b.summary.rebase}).length > 0);
});
