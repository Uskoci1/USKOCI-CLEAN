// Offline WIRING test of ex06a_passes.mjs: the real S03 fixtures and runner, the real S02 corpus and the real pass runner of the proof, against the SIMULATED backend of the S03 harness
// (lib/sim_backend.mjs, whose matcher oracle is the PREDECESSOR). It shows that the pass runner works end to end, that the fixture adjustment reaches exactly the written list of workers, that every
// pass asserts its own coverage (so a vacuous pass, e.g. one in which every case is refused, is not a pass), that the full match_detail of every worker is captured, that two passes on an unchanged
// chain are identical (so a difference means something), and that a flip in the matcher is seen by outcomeOf/diffOutcomes/checkFlips exactly as INTENDED_FLIPS expects.
// The "candidate" here is an EMULATION (the published task gets a window), not the SQL: it proves the pipeline, never the function. node --test supabase/proofs/ex06/ex06a_passes.test.mjs
process.env.EX06_QUIET = '1';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createFixtures} from './lib/fixtures.mjs';
import {normaliseCorpus} from './lib/corpus.mjs';
import {loadCorpus} from './lib/s02_adapter.mjs';
import {createSimulatedBackend} from './lib/sim_backend.mjs';
import {registryFromSource} from './lib/test_support.mjs';
import * as lib from './ex06a_lib.mjs';
import {createPassRunner} from './ex06a_passes.mjs';

const START = Date.UTC(2026, 9, 1, 12, 0, 0);
const registry = registryFromSource();
const corpusText = readFileSync(fileURLToPath(new URL('../ai/corpus/ex06_contract_corpus_v1.json', import.meta.url)), 'utf8');
const corpus = loadCorpus(JSON.parse(corpusText), {registry, label: 'CORPUS', normaliseNative: normaliseCorpus});
const T = ['T-003', 'T-006'];
const pick = (outcomes, ids) => Object.fromEntries(ids.map(id => [id, outcomes[id]]));

function setup({emulateCandidate = false, quirks = {}, augment, corpusOverride = corpus, startMs = START, clock = {now: START}, liveStateDate = false, shareRebase, readStored} = {}) {
  const backend = createSimulatedBackend({startMs, quirks});
  let flow = backend.flow;
  if (emulateCandidate) {
    // The candidate, emulated at the simulation level: a published window-less TOMORROW task is given tomorrow 09-17 and a WEEK task the last day of its week (Sunday, the whole day): the
    // simulation's availability model only knows windows inside ONE local day. The real derivation (a whole day, the week) is proved by the matrix of the CI proof, not here.
    flow = {...backend.flow, publish: async (a, accepted) => {
      const result = await backend.flow.publish(a, accepted);
      const need = backend.state.needs.get(accepted.needId);
      if (need && lib.FLEXIBLE_KINDS.includes(need.schedule_kind) && !need.starts_at && !need.ends_at) {
        const today = lib.localParts(START, lib.BELGRADE).date;
        const [day, from, to] = need.schedule_kind === 'TOMORROW_FLEXIBLE' ? [lib.addDays(today, 1), '09:00:00', '17:00:00'] : [lib.addDays(today, 7 - lib.isoDow(today)), '00:00:00', '23:59:00'];
        need.starts_at = new Date(lib.localToMs(day, from, lib.BELGRADE)).toISOString();
        need.ends_at = new Date(lib.localToMs(day, to, lib.BELGRADE)).toISOString();
        need.emulatedWindow = true;   // the product itself stores NO window: only the emulation of the candidate does (readStored reports what the product stored)
      }
      return result;
    }};
  }
  const real = createFixtures(backend.rt, {needPath: 'product', flow, reloadDelayMs: 0});
  // The simulated match_detail has no liveStateDate (the real one carries the local date of needs.starts_at at the worker zone): when asked, add it, so the clock dependence of the full detail is visible offline
  const fx = liveStateDate ? {...real, readMatch: (needId, profileId) => {
    const match = real.readMatch(needId, profileId), need = backend.state.needs.get(needId);
    return {...match, liveStateDate: need?.starts_at ? lib.localParts(Date.parse(need.starts_at), lib.BELGRADE).date : null};
  }} : real;
  const records = [];
  const readStoredNeed = readStored ?? (needId => {
    const need = backend.state.needs.get(needId);
    return {schedule_kind: need.schedule_kind, starts_at: need.emulatedWindow ? null : need.starts_at, ends_at: need.emulatedWindow ? null : need.ends_at, published_at: need.published_at, task_timezone: need.task_timezone ?? null};
  });
  const corpusPass = createPassRunner({fx, corpus: corpusOverride, registry, sourceSha: 'a'.repeat(40), bodyMd5: () => 'sim0sim0sim0sim0sim0sim0sim0sim0', randomUUID, now: () => clock.now, readStoredNeed,
    record: (label, summary) => records.push({label, summary}), ...(augment ? {augment} : {}), ...(shareRebase === undefined ? {} : {shareRebase}),
    sleep: async ms => { clock.now += ms; backend.state.tick = Math.round((clock.now - startMs) / 1000); }});
  return {backend, fx, corpusPass, records, clock, setClock: ms => { clock.now = ms; backend.state.tick = Math.round((ms - startMs) / 1000); }};
}

test('the corpus the pass runner loads is exactly the pinned one (file, 37 buildable cases, the id list)', () => {
  assert.deepEqual(lib.corpusPinProblems({path: lib.CORPUS_PIN.path, text: corpusText, ids: corpus.cases.map(item => item.id)}), []);
});

test('a full pass on the predecessor: 37 cases covered, none refused, F1 and F3 reproduced, the adjustment reaches exactly the written workers, the full detail of every worker is captured, everything is put back', async () => {
  const {backend, corpusPass, records} = setup();
  const first = await corpusPass('before');
  assert.equal(Object.keys(first.outcomes).length, corpus.cases.length);
  assert.equal(corpus.cases.length, 37);
  assert.deepEqual(lib.corpusCoverageProblems({outcomes: first.outcomes, summary: first.summary, expectedCases: 37}), []);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].summary.problems, []);
  assert.deepEqual(lib.adjustedList(first.summary.adjustedWorkers), lib.adjustedList(lib.EXPECTED_ADJUSTED_WORKERS.map(([caseId, worker]) => ({caseId, worker}))), 'exactly the five written workers');
  for (const id of T) {
    assert.equal(first.outcomes[id].workers.fits.dispatchEligible, false, 'F1 on the predecessor ' + id);
    assert.deepEqual(first.outcomes[id].workers.fits.dispatchBlockers, ['OUTSIDE_AVAILABILITY']);
    assert.deepEqual(first.outcomes[id].wave.inserted, 0);
  }
  for (const [id, label] of [['T-003', 'unknown-capability'], ['T-006', 'does-not-fit'], ['T-006', 'unknown-capability']]) {
    assert.deepEqual(first.outcomes[id].workers[label].dispatchBlockers, ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY'], `F3 ${id} ${label}`);
  }
  assert.ok(first.findings.includes('T-003|fits|dispatchEligible') && first.findings.includes('T-006|fits|dispatchEligible'), 'the corpus findings F1 are listed');
  for (const key of lib.FINDINGS_CLOSED) assert.ok(first.findings.includes(key), 'a finding the candidate is meant to close is present before: ' + key);
  // the full detail of every worker of every case was read (before the wave)
  const workerKeys = Object.entries(first.outcomes).flatMap(([id, item]) => Object.keys(item.workers).map(label => `${id}|${label}`));
  assert.deepEqual(Object.keys(first.details).sort(), workerKeys.sort());
  assert.ok(Object.values(first.details).every(detail => Array.isArray(detail.dispatchBlockers) && 'responseAllowed' in detail));
  const active = [...backend.state.profiles.values()].filter(p => p.kind === 'WORKER' && p.profile_status === 'ACTIVE' && !p.display_name.startsWith('Foreign'));
  assert.deepEqual(active, [], 'every fixture worker was retired');
  const foreign = [...backend.state.profiles.values()].filter(p => p.display_name.startsWith('Foreign'));
  assert.ok(foreign.length === 2 && foreign.every(p => p.profile_status === 'ACTIVE' && p.available_now === true), 'the workers that were on the chain before are back as they were');
});

test('the adjusted fixture is narrow (one rule on tomorrow weekday 09-17; Sunday for the week) in the workers the product path really built', async () => {
  const {backend, corpusPass} = setup();
  await corpusPass('before', {caseIds: T, canary: false});
  const ruled = [...backend.state.profiles.values()].filter(p => p.kind === 'WORKER' && p.rules.length > 0);
  assert.equal(ruled.length, 5, 'exactly the five adjusted workers carry a rule (nobody else is given one)');
  for (const p of ruled) assert.equal(p.rules.length, 1, 'one rule only');
  const signature = p => JSON.stringify([p.rules[0].weekdays, p.rules[0].startTime, p.rules[0].endTime]);
  // the pass clock is a Thursday: tomorrow is Friday (T-003: fits, does-not-fit, control); the week worker is on Sunday, the whole day (T-006: fits, control)
  assert.equal(ruled.filter(p => signature(p) === JSON.stringify([[5], '09:00:00', '17:00:00'])).length, 3);
  assert.equal(ruled.filter(p => signature(p) === JSON.stringify([[0], '00:00:00', '23:59:00'])).length, 2);
});

test('two passes on an unchanged chain are identical (outcomes and full details), and the unmodified S03 fixture equals the adjusted one on the predecessor', async () => {
  const {corpusPass} = setup();
  const first = await corpusPass('before');
  const second = await corpusPass('again');
  assert.deepEqual(lib.diffOutcomes(first.outcomes, second.outcomes), []);
  assert.deepEqual(lib.corpusDetailProblems(first.details, second.details, {}), []);
  assert.deepEqual(first.findings, second.findings);
  const vanilla = await corpusPass('vanilla', {caseIds: T, augment: false, canary: false});
  assert.deepEqual(vanilla.summary.adjustedWorkers, []);
  assert.deepEqual(lib.diffOutcomes(pick(first.outcomes, T), vanilla.outcomes), []);
});

test('an emulated candidate: the written intended flips happen and are seen; the rest of the corpus is identical; the vanilla fixture still cannot be admitted', async () => {
  const before = await setup().corpusPass('before');
  const {corpusPass} = setup({emulateCandidate: true});
  const after = await corpusPass('after');
  const flips = lib.checkFlips(lib.diffOutcomes(before.outcomes, after.outcomes), lib.INTENDED_FLIPS);
  // The simulation is not the function: its gate does not require an ACTIVE profile, so the DRAFT control sees the emulated window (the SQL gate returns false for it: the matrix of the CI proof
  // pins that). That is the only difference the simulation adds; all 21 written flips are seen.
  assert.equal(flips.matched.length, lib.INTENDED_FLIPS.length, 'every written flip is seen: ' + JSON.stringify(flips.missing));
  assert.deepEqual(flips.missing, []);
  assert.deepEqual(flips.unintended.map(diff => `${diff.caseId}|${diff.worker}|${diff.field}`).sort(), ['T-003|control-restricted|dispatchBlockers', 'T-003|control-restricted|score', 'T-006|control-restricted|dispatchBlockers', 'T-006|control-restricted|score'],
    'only the DRAFT control of the two cases differs beyond the written flips (a simulation artefact)');
  for (const id of T) {
    assert.equal(after.outcomes[id].workers.fits.dispatchEligible, true);
    assert.equal(after.outcomes[id].workers.fits.delivery, true);
    assert.equal(after.outcomes[id].wave.inserted, 1);
  }
  const removed = before.findings.filter(key => !after.findings.includes(key));
  assert.deepEqual([...removed].sort().filter(key => !key.includes('control-restricted')), [...lib.FINDINGS_CLOSED].sort(), 'the findings that go are exactly F1 (five) and the three paused-code disagreements of F3');
  // the other cases are untouched
  const others = corpus.cases.map(item => item.id).filter(id => !T.includes(id));
  assert.deepEqual(lib.diffOutcomes(pick(before.outcomes, others), pick(after.outcomes, others)), []);
  // the unmodified S03 fixture (live intent, no rule) is not admitted by the emulated candidate either: the window exists but nothing in it is declared
  const vanilla = await corpusPass('after-vanilla', {caseIds: T, augment: false, canary: false});
  for (const id of T) assert.equal(vanilla.outcomes[id].workers.fits.dispatchEligible, false);
});

// ------------------------------------------------------------------ VAC-4 / VAC-5 at the level of the pass runner: a vacuous pass is not a pass
test('VAC-4 mutation: a pass in which EVERY case is refused by the product path compares as identical to another such pass, and is nevertheless refused by the coverage guard', async () => {
  const {corpusPass} = setup({quirks: {refuseCorpusPublishEvery: 1}});
  await assert.rejects(() => corpusPass('refused-before'), /THE_PASS_DID_NOT_COVER_WHAT_IT_CLAIMS/);
  // the same two refused passes, compared the way the proof compares passes: no difference at all (the vacuity), which is why the coverage guard exists
  const refused = Object.fromEntries(corpus.cases.map(item => [item.id, {id: item.id, refused: true, wave: null, rounds: [], workers: {}}]));
  assert.deepEqual(lib.diffOutcomes(refused, JSON.parse(JSON.stringify(refused))), []);
  assert.ok(lib.corpusCoverageProblems({outcomes: refused, summary: {statuses: {PRODUCT_PATH_REFUSED: 37}}, expectedCases: 37}).length > 0);
});
test('VAC-4 mutation: a pass over a smaller corpus (one case fewer) is refused by the coverage guard', async () => {
  const smaller = {...corpus, cases: corpus.cases.filter(item => item.id !== 'T-050')};
  const {corpusPass} = setup({corpusOverride: smaller});
  await assert.rejects(() => corpusPass('smaller'), /THE_PASS_DID_NOT_COVER_WHAT_IT_CLAIMS/);
});
test('VAC-5 mutation: a fixture adjustment that also touches a NONE_DECLARED worker (or any worker the list does not name) is refused', async () => {
  const everyone = (spec, kind, newId, context) => {
    const out = lib.augmentSpec(spec, kind, newId, context);
    if (out !== spec || !lib.FLEXIBLE_KINDS.includes(kind) || spec.interval || !spec.availability) return out;
    return {...spec, availability: {timezone: lib.BELGRADE, availableNow: false, windows: [], rules: [{id: newId(), weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00:00', endTime: '23:59:00', startsOn: '2026-01-01', endsOn: null, label: 'mutant', active: true}]}};
  };
  const {corpusPass} = setup({augment: everyone});
  await assert.rejects(() => corpusPass('adjusted-too-much'), /THE_PASS_DID_NOT_COVER_WHAT_IT_CLAIMS/);
  const nothing = () => 'unused';
  const {corpusPass: none} = setup({augment: (spec) => { nothing(); return spec; }});
  await assert.rejects(() => none('adjusted-nothing'), /THE_PASS_DID_NOT_COVER_WHAT_IT_CLAIMS/);
});

// ------------------------------------------------------------------ vacuity 2: the full detail does not depend on the clock of the pass
// private.match_detail carries liveStateDate = the local date of needs.starts_at, and the corpus rebase shifts every absolute starts_at by (the pass clock - the corpus clock). With a rebase per pass the
// stored starts_at of a case moved by the minutes between two passes, and the comparison reported a change of liveStateDate whenever a local midnight fell between two shifted starts: a false verdict that
// depended on the time of day. The simulated detail has no liveStateDate; the setup adds it (liveStateDate: true), so the effect is visible here.
// The case that shows it: T-001 starts 119 h after the corpus clock (2026-10-10T09:00+02:00 against 2026-10-05T08:00Z). At this base clock its rebased start is 23:50 local on 2026-10-12; 25 minutes
// later a per-pass rebase puts it at 00:15 on the 13th.
const STRADDLE = Date.parse('2026-10-12T21:50:00Z') - 119 * lib.HOUR;
async function twoPasses(t1, gapMs, options = {}) {
  const ctx = setup({startMs: t1, clock: {now: t1}, liveStateDate: true, ...options});
  const first = await ctx.corpusPass('first');
  ctx.setClock(t1 + gapMs);
  const second = await ctx.corpusPass('second');
  return {ctx, first, second};
}
const timeProblems = (a, b) => lib.corpusTimeProblems(a.times, b.times, {referenceRebase: a.summary.rebase, otherRebase: b.summary.rebase});
test('vacuity 2: with ONE rebase for every pass the stored times and the full detail of two passes agree, at clocks just before and after a local midnight and across a midnight between the passes', async () => {
  const local = (date, time) => lib.localToMs(date, time, lib.BELGRADE);
  const pairs = [[STRADDLE, 25], [local('2026-10-15', '23:30:00'), 35], [local('2026-10-15', '23:30:00'), 90], [local('2026-10-16', '00:05:00'), 25], [local('2026-10-16', '00:50:00'), 90], [local('2026-10-16', '18:00:00'), 90], [local('2027-03-27', '23:30:00'), 35]];
  for (const [t1, minutes] of pairs) {
    const {first, second} = await twoPasses(t1, minutes * lib.MINUTE);
    assert.deepEqual(timeProblems(first, second), [], `${lib.iso(t1)} + ${minutes} min: the stored times`);
    assert.deepEqual(lib.corpusDetailProblems(first.details, second.details, {}), [], `${lib.iso(t1)} + ${minutes} min: the full detail`);
    assert.deepEqual(lib.diffOutcomes(first.outcomes, second.outcomes), [], `${lib.iso(t1)} + ${minutes} min: the outcomes`);
    assert.deepEqual(first.summary.rebase, second.summary.rebase, 'the very same rebase');
    assert.ok(Object.values(first.details).some(detail => detail.liveStateDate !== null), 'the simulated detail does carry a liveStateDate for the cases with a stored time');
  }
});
test('vacuity 2 mutation: a rebase PER PASS gives the false verdict (liveStateDate and the stored times differ) at a clock where a local midnight falls between the two shifted starts', async () => {
  const {first, second} = await twoPasses(STRADDLE, 25 * lib.MINUTE, {shareRebase: false});
  assert.ok(lib.corpusDetailProblems(first.details, second.details, {}).some(item => /^T-001\|fits: UNINTENDED_FIELD_CHANGED liveStateDate/.test(item)), 'the full-detail comparison would have failed');
  assert.ok(timeProblems(first, second).some(item => /^CORPUS_REBASE_DIFFERS/.test(item)) && timeProblems(first, second).some(item => /^CORPUS_TIMES_DIFFER T-001 starts_at/.test(item)), 'and the time guard names the cause');
  assert.equal(first.details['T-001|fits'].liveStateDate, '2026-10-12');
  assert.equal(second.details['T-001|fits'].liveStateDate, '2026-10-13');
  // the same pair with the shared rebase is clean
  const shared = await twoPasses(STRADDLE, 25 * lib.MINUTE);
  assert.deepEqual(lib.corpusDetailProblems(shared.first.details, shared.second.details, {}), []);
  assert.equal(shared.first.details['T-001|fits'].liveStateDate, shared.second.details['T-001|fits'].liveStateDate);
});
test('a shared rebase that has grown too old is refused (the stored starts must stay a day ahead of the pass)', async () => {
  const ctx = setup();
  await ctx.corpusPass('first', {caseIds: T, canary: false});
  ctx.setClock(START + 2 * lib.HOUR);
  await ctx.corpusPass('still fine', {caseIds: T, canary: false});
  ctx.setClock(START + 4 * lib.HOUR);
  await assert.rejects(() => ctx.corpusPass('late', {caseIds: T, canary: false}), /REBASE_TOO_OLD/);
});

// ------------------------------------------------------------------ vacuity 4: what the pass asserts, in the PROOF
test('vacuity 4b: the product path of the two evidence cases is recorded and asserted (T-003 and T-006 are materialised by the product path)', async () => {
  const {corpusPass} = setup();
  const first = await corpusPass('before', {caseIds: T, canary: false});
  assert.deepEqual(first.summary.productPathEvidence, [{id: 'T-003', materialisation: 'PRODUCT_PATH', degraded: false}, {id: 'T-006', materialisation: 'PRODUCT_PATH', degraded: false}]);
  assert.equal(lib.productPathProblems([{id: 'T-003', materialisation: 'DIRECT', degraded: true}, {id: 'T-006', materialisation: 'PRODUCT_PATH', degraded: false}]).length, 1);
});
test('vacuity 4c: the assumptions behind the narrow fixture rule are asserted by the pass: a stored window, a foreign task zone, another schedule kind and a publication day that is not the pass-clock day fail the pass', async () => {
  const withStored = patch => {
    const ctx = setup({readStored: needId => {
      const need = ctx.backend.state.needs.get(needId);
      return {schedule_kind: need.schedule_kind, starts_at: null, ends_at: null, published_at: need.published_at, task_timezone: null, ...patch};
    }});
    return ctx;
  };
  const refusedFor = async (patch, pattern) => assert.rejects(() => withStored(patch).corpusPass('before', {caseIds: T, canary: false}),
    error => /THE_PASS_DID_NOT_COVER_WHAT_IT_CLAIMS/.test(error.message) && error.actual.some(item => pattern.test(item)), JSON.stringify(patch));
  await refusedFor({starts_at: '2026-10-02T08:00:00Z', ends_at: '2026-10-02T16:00:00Z'}, /NARROW_FIXTURE_THE_PRODUCT_STORED_A_WINDOW/);
  await refusedFor({task_timezone: 'America/New_York'}, /NARROW_FIXTURE_TASK_ZONE/);
  await refusedFor({schedule_kind: 'FLEXIBLE'}, /NARROW_FIXTURE_SCHEDULE_KIND/);
  await refusedFor({published_at: '2026-09-29T10:00:00Z'}, /NARROW_FIXTURE_ANCHOR_DAY_MOVED/);
  await refusedFor({published_at: null}, /NARROW_FIXTURE_NOT_PUBLISHED/);
  // the same facts are no problem for a pass that does not adjust anything (the assumptions are those of the adjustment)
  const vanilla = await withStored({starts_at: '2026-10-02T08:00:00Z', ends_at: '2026-10-02T16:00:00Z'}).corpusPass('vanilla', {caseIds: T, augment: false, canary: false});
  assert.deepEqual(vanilla.summary.adjustedWorkers, []);
  // and a pass whose clock is on another local day than the publication (the simulated publication stays on the start day) is refused
  const moved = setup();
  moved.clock.now = START + 14 * lib.HOUR;
  await assert.rejects(() => moved.corpusPass('before', {caseIds: T, canary: false}), error => error.actual?.some(item => /NARROW_FIXTURE_ANCHOR_DAY_MOVED/.test(item)));
  assert.throws(() => createPassRunner({fx: {}, corpus, registry, bodyMd5: () => 'x', randomUUID}), /READ_STORED_NEED_REQUIRED/);
});
