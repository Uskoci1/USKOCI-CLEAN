// Offline tests of the TOTAL adapter of the S02 contract corpus (lib/s02_adapter.mjs), run against the REAL corpus file supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json and the real
// need-fact registry (src/contracts/needFactsV2.ts): `node --test supabase/proofs/ex06/lib/*.test.mjs`. No database, no network, no dependency.
// The counts below are a TRIPWIRE: when S02 gains or loses a case, a key or an expectation, this test fails until the adapter has decided what the new thing means and the numbers (and
// README_S03.md) are updated. A new key can never be dropped silently: the adapter throws S02_KEY_UNKNOWN.
process.env.EX06_QUIET = '1';
import assert from 'node:assert/strict';
import test from 'node:test';
import {CONTROL_RESTRICTED, normaliseCorpus, referenceWorkerPlan} from './corpus.mjs';
import {ACTIVATION_PLACEHOLDER_SKILL, CASE_KEYS, EXPECT_KEYS, KIND_KEYS, PROFILE_KEYS, REFERENCE_TASK_KEYS, REVIEW_KEYS, ROOT_KEYS, TASK_EXPECTED_KEYS, WORKER_EXPECTED_KEYS, WORKER_ROW_KEYS,
  adaptS02, factValue, loadCorpus} from './s02_adapter.mjs';
import {availabilityFor, computeRebase, materialiseTimes, parseIso, utcOffsetMinutes} from './timeutil.mjs';
import {CORPUS_PATH, STAND_IN_REGISTRY, readText, registryFromSource} from './test_support.mjs';

const registry = registryFromSource();
const rawText = readText(CORPUS_PATH);
const fresh = () => JSON.parse(rawText);
const adapted = adaptS02(fresh(), {registry});

// ------------------------------------------------------------------ the tripwire: what the adapter does with the real corpus
test('the real need-fact registry is read from src/contracts/needFactsV2.ts (every key the S02 facts use is in it)', () => {
  assert.ok(Object.keys(registry).length >= 22);
  for (const key of ['need.title', 'need.starts_at', 'need.task_geography', 'need.price_basis', 'need.exact_address']) assert.ok(key in registry, key);
  assert.equal(registry['need.starts_at'].valueType, 'TIMESTAMPTZ');
  assert.equal(registry['need.people_needed'].requiredForDraft, true);
});

test('TRIPWIRE: the S02 corpus adapts to 37 buildable cases, 29 skipped with a reason (16 WORKER family, 13 TASK that publish no task); 150 reference-worker rows: 109 built, 41 not', () => {
  assert.equal(adapted.totalCases, 66);
  assert.equal(adapted.cases.length, 37);
  assert.equal(adapted.skipped.length, 29);
  assert.deepEqual(adapted.counts.cases, {total: 66, task: 50, worker: 16, mapped: 37, skipped: 29});
  assert.deepEqual(adapted.counts.workers, {rows: 150, built: 109, skipped: 41});
  assert.equal(adapted.cases.length + adapted.skipped.length, adapted.totalCases, 'ran + skipped == total');
  assert.equal(adapted.skipped.filter(item => item.family === 'WORKER').length, 16);
  assert.deepEqual(adapted.skipped.filter(item => item.family === 'TASK').map(item => item.id), ['T-016', 'T-017', 'T-018', 'T-019', 'T-020', 'T-021', 'T-033', 'T-034', 'T-035', 'T-039', 'T-040', 'T-045', 'T-049']);
  assert.ok(adapted.skipped.every(item => typeof item.reason === 'string' && item.reason.length > 20), 'every skipped case carries a reason');
  assert.equal(adapted.id, 'EX06_CONTRACT_CORPUS');
  assert.equal(adapted.version, 1);
  assert.equal(adapted.clock.nowUtc, '2026-10-05T08:00:00Z');
});

test('TRIPWIRE: 80 corpus expectations are reported UNCONSUMED (never dropped), with the leaf counts: 897 present, 545 consumed, 352 not consumed; 47 key paths mapped, 60 ignored with a reason', () => {
  assert.equal(adapted.unconsumed.total, 80);
  assert.deepEqual(adapted.unconsumed.byKey, {busy: 2, applicationTimeBlockers: 7, 'eligibility:NOT_PUBLISHABLE': 18, 'eligibility:NO_PUBLISHED_NEED': 21, 'referenceTasks[].expect': 32});
  assert.deepEqual(adapted.leaves, {present: 897, consumed: 545, unconsumed: 352, validatedOnly: 109, assertable: 436});
  assert.equal(adapted.leaves.consumed + adapted.leaves.unconsumed, adapted.leaves.present);
  assert.equal(adapted.leaves.validatedOnly + adapted.leaves.assertable, adapted.leaves.consumed, 'consumed = validated at load only (the eligibility class, 109 built workers) + asserted against the chain (4 fields each = 436)');
  assert.equal(adapted.leaves.assertable, adapted.counts.workers.built * 4);
  assert.equal(Object.keys(adapted.keyCoverage.mapped).length, 47);
  assert.equal(Object.keys(adapted.keyCoverage.ignored).length, 60);
  for (const path of Object.keys(adapted.keyCoverage.ignored)) assert.ok(adapted.keyCoverage.ignoredReasons[path]?.length > 10, path + ' is ignored without a reason');
  assert.deepEqual(adapted.unconsumed.list.filter(item => item.key === 'busy').map(item => `${item.caseId}/${item.worker}`), ['T-002/does-not-fit', 'T-028/does-not-fit']);
  assert.ok(adapted.unconsumed.list.filter(item => item.key === 'applicationTimeBlockers').every(item => item.value.includes('TEAM_CAPACITY_EXCEEDED')));
  for (const item of adapted.unconsumed.list) assert.ok(item.reason.length > 20 && item.caseId, JSON.stringify(item));
});

test('every IGNORED key of every table has a reason, and no key is both mapped and ignored', () => {
  for (const [name, table] of Object.entries({ROOT_KEYS, CASE_KEYS, TASK_EXPECTED_KEYS, WORKER_EXPECTED_KEYS, REVIEW_KEYS, KIND_KEYS, WORKER_ROW_KEYS, PROFILE_KEYS, EXPECT_KEYS, REFERENCE_TASK_KEYS})) {
    for (const [key, rule] of Object.entries(table)) assert.ok((rule.use === 'MAPPED') !== (typeof rule.ignore === 'string' && rule.ignore.length > 10), `${name}.${key}`);
  }
});

test('a NEW key anywhere in the corpus throws S02_KEY_UNKNOWN (root, case, expected, review, kind, worker row, profile, expect, reference task, WORKER expected): nothing is dropped silently', () => {
  const taskCase = raw => raw.cases.find(item => item.id === 'T-001');
  const workerCase = raw => raw.cases.find(item => item.id === 'W-001');
  const places = {
    'corpus.newThing': raw => { raw.newThing = 1; }, 'case.newThing': raw => { taskCase(raw).newThing = 1; }, 'case.expected(TASK).newThing': raw => { taskCase(raw).expected.newThing = 1; },
    'case.expected.review.newThing': raw => { taskCase(raw).expected.review.newThing = 1; }, 'case.expected.kind.newThing': raw => { taskCase(raw).expected.kind.newThing = 1; },
    'case.referenceWorkers[].newThing': raw => { taskCase(raw).referenceWorkers[0].newThing = 1; }, 'case.referenceWorkers[].profile.newThing': raw => { taskCase(raw).referenceWorkers[0].profile.newThing = 1; },
    'case.referenceWorkers[].expect.newThing': raw => { taskCase(raw).referenceWorkers[0].expect.newThing = 1; }, 'case.expected(WORKER).newThing': raw => { workerCase(raw).expected.newThing = 1; },
    'case.referenceTasks[].newThing': raw => { workerCase(raw).referenceTasks[0].newThing = 1; },
    'skipped case worker row': raw => { raw.cases.find(item => item.id === 'T-016').referenceWorkers[0].profile.newThing = 1; },
  };
  for (const [name, mutate] of Object.entries(places)) {
    const raw = fresh();
    mutate(raw);
    assert.throws(() => adaptS02(raw, {registry}), /S02_KEY_UNKNOWN.*newThing/, name);
  }
});

test('a fact key the registry does not know, a value of the wrong type, a free-text shape the adapter does not know and an unknown city are all refused', () => {
  const mutate = patch => { const raw = fresh(); patch(raw.cases.find(item => item.id === 'T-001')); return raw; };
  assert.throws(() => adaptS02(mutate(task => { task.expected.facts['need.nonsense'] = 'x'; }), {registry}), /CASE_FACT_KEY_UNKNOWN/);
  assert.throws(() => adaptS02(mutate(task => { task.expected.facts['need.people_needed'] = '1'; }), {registry}), /CASE_FACT_VALUE_TYPE/);
  assert.throws(() => adaptS02(mutate(task => { task.expected.facts['need.title'] = {free: true, somethingElse: ['x']}; }), {registry}), /S02_FACT_SHAPE_UNKNOWN/);
  assert.throws(() => adaptS02(mutate(task => { task.expected.facts['need.required_skills'] = {free: false, canonicalItems: ['x']}; }), {registry}), /S02_FACT_SHAPE_UNKNOWN/);
  assert.throws(() => adaptS02(mutate(task => { task.expected.facts['need.task_geography'].start.city = 'Kragujevac'; }), {registry}), /EX06_CITY_UNKNOWN/);
  assert.throws(() => adaptS02(mutate(task => { task.referenceWorkers[0].profile.city = 'Kragujevac'; }), {registry}), /EX06_CITY_UNKNOWN/);
  assert.throws(() => adaptS02(mutate(task => { delete task.expected.facts['need.people_needed']; }), {registry}), /CASE_REQUIRED_FACTS_MISSING/);
  assert.throws(() => adaptS02(mutate(task => { task.expected.facts['need.description'] = {free: true, mustMentionAnyOf: ['pisi na pera@primer.rs']}; }), {registry}), /CASE_PERSONAL_DATA_PATTERN/);
  assert.throws(() => adaptS02(mutate(task => { task.expected.facts['need.access_notes'] = {free: true, mustMentionAnyOf: []}; }), {registry}), /S02_FACT_SHAPE_UNKNOWN/);
  assert.throws(() => factValue('need.category', {free: true, mustMentionAnyOf: ['x']}, 'where'), /S02_FREE_TEXT_FACT_UNSUPPORTED/);
});

test('the corpus must not contradict itself: an eligibility class that disagrees with its booleans, an unknown capability that the profile declares, an unknown shape or status are refused', () => {
  const row = (raw, id, index) => raw.cases.find(item => item.id === id).referenceWorkers[index];
  let raw = fresh();
  row(raw, 'T-001', 0).expect.eligibility = 'HARD_BLOCKED';
  assert.throws(() => adaptS02(raw, {registry}), /S02_ELIGIBILITY_INCONSISTENT/);
  raw = fresh();
  row(raw, 'T-001', 0).expect.eligibility = 'NOT_PUBLISHABLE';
  assert.throws(() => adaptS02(raw, {registry}), /S02_ELIGIBILITY_UNEXPECTED/);
  raw = fresh();
  row(raw, 'T-001', 0).expect.eligibility = 'SOMETIMES';
  assert.throws(() => adaptS02(raw, {registry}), /S02_ELIGIBILITY_UNKNOWN/);
  raw = fresh();
  row(raw, 'T-001', 2).unknownCapability = ['tools'];
  row(raw, 'T-001', 2).profile.tools = ['ekser'];
  assert.throws(() => adaptS02(raw, {registry}), /S02_UNKNOWN_CAPABILITY_INCONSISTENT/);
  raw = fresh();
  row(raw, 'T-001', 2).unknownCapability = ['luck'];
  assert.throws(() => adaptS02(raw, {registry}), /S02_UNKNOWN_CAPABILITY_VALUE/);
  raw = fresh();
  row(raw, 'T-001', 0).profile.availability = 'SOMETIMES';
  assert.throws(() => adaptS02(raw, {registry}), /S02_AVAILABILITY_SHAPE_UNKNOWN/);
  raw = fresh();
  row(raw, 'T-001', 0).profile.profileStatus = 'SUSPENDED';
  assert.throws(() => adaptS02(raw, {registry}), /S02_PROFILE_STATUS_UNKNOWN/);
  raw = fresh();
  row(raw, 'T-001', 0).shape = 'ALMOST_FITS';
  assert.throws(() => adaptS02(raw, {registry}), /S02_SHAPE_UNKNOWN/);
  raw = fresh();
  delete row(raw, 'T-001', 0).expect.dispatchBlockers;
  assert.throws(() => adaptS02(raw, {registry}), /S02_EXPECT_INCOMPLETE/);
  raw = fresh();
  row(raw, 'T-001', 0).profile.busy = 'SOMETIMES';
  assert.throws(() => adaptS02(raw, {registry}), /S02_BUSY_UNKNOWN/);
});

test('the root of the corpus is checked: the id, synthetic text, no claimed run, the clock, the case counts, the shape and eligibility vocabularies and the work kinds', () => {
  const broken = patch => { const raw = fresh(); patch(raw); return () => adaptS02(raw, {registry}); };
  assert.throws(broken(raw => { raw.corpusId = 'OTHER'; }), /S02_CORPUS_ID/);
  assert.throws(broken(raw => { raw.synthetic = false; }), /CORPUS_NOT_SYNTHETIC/);
  assert.throws(broken(raw => { raw.providerCalls = 3; }), /S02_CORPUS_CLAIMS_A_RUN/);
  assert.throws(broken(raw => { raw.runAgainstMatcher = true; }), /S02_CORPUS_CLAIMS_A_RUN/);
  assert.throws(broken(raw => { raw.clock.localTime = '11:00:00'; }), /S02_CLOCK_INCONSISTENT/);
  assert.throws(broken(raw => { raw.clock.timeZone = 'UTC'; }), /S02_CLOCK_INVALID/);
  assert.throws(broken(raw => { raw.caseCount.total = 67; }), /S02_CASE_COUNT_MISMATCH/);
  assert.throws(broken(raw => { raw.availabilityShapes.SOMETIMES = 'x'; }), /S02_AVAILABILITY_SHAPES_CHANGED/);
  assert.throws(broken(raw => { raw.referenceWorkerShapes.push('ALMOST_FITS'); }), /S02_WORKER_SHAPES_CHANGED/);
  assert.throws(broken(raw => { raw.eligibilityValues.push('MAYBE'); }), /S02_ELIGIBILITY_VALUES_CHANGED/);
  assert.throws(broken(raw => { raw.cases[0].family = 'OTHER'; raw.caseCount.task = 49; }), /S02_CASE_COUNT_MISMATCH/, 'a case of a family that is neither TASK nor WORKER cannot make the counts add up');
  assert.throws(broken(raw => { raw.cases.find(item => item.id === 'T-001').expected.kind.expected = 'GARDENING'; }), /S02_KIND_UNKNOWN/);
  assert.throws(broken(raw => { raw.cases.find(item => item.id === 'T-001').expected.review.state = 'MAYBE'; }), /S02_REVIEW_STATE_UNKNOWN/);
  assert.throws(broken(raw => { raw.cases.push({...raw.cases[0]}); raw.caseCount.total = 67; raw.caseCount.task = 51; }), /CASE_ID_DUPLICATE/);
  assert.throws(broken(raw => { raw.cases = []; }), /CORPUS_EMPTY/);
  assert.throws(() => adaptS02(fresh(), {}), /CORPUS_REGISTRY_REQUIRED/);
});

// ------------------------------------------------------------------ what the adapter makes of a case
const caseById = id => adapted.cases.find(item => item.id === id);
const worker = (id, label) => caseById(id).referenceWorkers.find(item => item.label === label);

test('T-001: facts are the synthetic text of the S02 facts, kinds are the expected kind, the three reference workers carry their profile, city and expectation, the corpus text of the turns is never copied', () => {
  const t1 = caseById('T-001');
  assert.equal(t1.expectedFacts['need.category'], 'Čišćenje stana');
  assert.deepEqual(t1.expectedFacts['need.required_skills'], ['čišćenje stana']);
  assert.equal(t1.expectedFacts['need.title'], 'EX-06 proba: čišćenje');
  assert.deepEqual(t1.expectedKinds, ['CISCENJE']);
  assert.equal(t1.expectedFacts['need.starts_at'], '2026-10-10T09:00:00+02:00', 'absolute times stay absolute until the rebase at run time');
  assert.deepEqual(t1.referenceWorkers.map(item => item.label), ['fits', 'does-not-fit', 'unknown-capability']);
  assert.deepEqual(worker('T-001', 'fits').profile, {skills: ['čišćenje stana'], tools: [], vehicles: [], licenses: [], radiusKm: 25, teamCapacity: 1, availability: {shape: 'AVAILABLE_NOW_AND_SCHEDULED'}, location: {city: 'Novi Sad'}, status: 'ACTIVE'});
  assert.equal(worker('T-001', 'does-not-fit').profile.location.city, 'Niš');
  assert.deepEqual(worker('T-001', 'does-not-fit').expect, {responseAllowed: true, dispatchEligible: false, hardBlockers: [], dispatchBlockers: ['OUTSIDE_PREFERRED_RADIUS']});
  const unknown = worker('T-001', 'unknown-capability');
  assert.deepEqual([unknown.profile.skills, unknown.profile.skillsAfterActivation, unknown.profile.status], [[ACTIVATION_PLACEHOLDER_SKILL], [], 'ACTIVE'], 'activate-then-clear for an ACTIVE worker with no skills');
  assert.deepEqual(unknown.annotations.unknownCapability, ['skills']);
  const raw = fresh();
  const everyFact = JSON.stringify(adapted.cases.map(item => item.expectedFacts));
  for (const item of raw.cases) for (const turn of item.turns ?? []) assert.ok(!everyFact.includes(turn.text), 'the message text of ' + item.id + ' is not copied into any fixture');
});

test('the special cases: T-010 exclusion bypass, T-046 years of experience bypass, T-031 source-reading prediction annotation and an unclassified expected kind, T-002 and T-028 calendar-busy workers not built', () => {
  assert.deepEqual(worker('T-010', 'does-not-fit').profile.bypass, {exclusions: ['montaža nameštaja']});
  assert.deepEqual(worker('T-046', 'fits').profile.bypass, {yearsExperience: 6});
  assert.equal(caseById('T-046').expectedFacts['need.minimum_experience_years'], 5);
  assert.deepEqual(caseById('T-046').expectedKinds, [], 'unclassified = the function must return nothing');
  assert.deepEqual(caseById('T-031').expectedKinds, []);
  assert.equal(worker('T-031', 'does-not-fit').annotations.sourceReadingPrediction.dispatchEligible, true);
  assert.deepEqual(worker('T-031', 'does-not-fit').expect.dispatchBlockers, ['SERVICE_NOT_IN_WORK_PROFILE'], 'the corpus expectation is kept, the prediction is only an annotation');
  for (const id of ['T-002', 'T-028']) {
    const busy = worker(id, 'does-not-fit');
    assert.match(busy.skip, /busy OVERLAPS_TASK_WINDOW: UNCONSUMED/);
    assert.deepEqual(busy.expect.hardBlockers, ['CALENDAR_CONFLICT'], 'the expectation is present, and unverified');
    assert.equal(busy.profile.busy, undefined);
  }
  const consumed = adaptS02(fresh(), {registry, consumeBusy: true});
  assert.equal(consumed.cases.find(item => item.id === 'T-002').referenceWorkers.find(item => item.label === 'does-not-fit').profile.busy, 'OVERLAPS_TASK_WINDOW');
  assert.equal(consumed.cases.find(item => item.id === 'T-002').referenceWorkers.find(item => item.label === 'does-not-fit').skip, null);
  assert.equal(consumed.unconsumed.byKey.busy, undefined);
  assert.deepEqual(worker('T-004', 'does-not-fit').expect, {responseAllowed: true, dispatchEligible: true, hardBlockers: [], dispatchBlockers: []}, 'TEAM_CAPACITY_EXCEEDED is application-time: the matcher expectation stays');
  assert.equal(worker('T-004', 'does-not-fit').unconsumed[0].key, 'applicationTimeBlockers');
});

test('every adapted case builds a plan with the harness control, an eligible-worker anchor, and a negative that names its cause (the control for the three cases whose corpus negatives are application-time only)', () => {
  const noCorpusNegative = [];
  for (const item of adapted.cases) {
    const plan = referenceWorkerPlan(item);
    assert.equal(plan.filter(entry => entry.control).length, 1, item.id);
    assert.ok(plan.some(entry => !entry.control && !entry.skip && entry.expect.dispatchEligible === true), item.id + ' has no eligible-worker anchor');
    const corpusNegative = plan.some(entry => !entry.control && !entry.skip && (entry.expect.hardBlockers.length || entry.expect.dispatchBlockers.length));
    if (!corpusNegative) noCorpusNegative.push(item.id);
    assert.equal(plan.find(entry => entry.control).label, CONTROL_RESTRICTED.label);
    assert.equal(plan.find(entry => entry.control).profile.status, 'DRAFT');
    assert.equal(plan.find(entry => entry.control).profile.skillsAfterActivation, undefined);
  }
  assert.deepEqual(noCorpusNegative, ['T-004', 'T-005', 'T-036']);
  // ... and those three, and only those, are marked positiveOnly BY THE ADAPTER with the corpus's own reason (applicationTimeBlockers): explicit, listed, never silently accepted
  assert.deepEqual(adapted.cases.filter(item => item.positiveOnly).map(item => item.id), noCorpusNegative);
  for (const id of noCorpusNegative) {
    const reason = caseById(id).positiveOnlyReason;
    assert.match(reason, /applicationTimeBlockers \["TEAM_CAPACITY_EXCEEDED"\]/, id);
    assert.match(reason, /not by match_detail or the dispatch wave/, id);
  }
  assert.ok(adapted.cases.filter(item => !item.positiveOnly).every(item => item.positiveOnlyReason === null));
});

test('a case with no negative and no applicationTimeBlockers reason is NOT marked positive-only (the runner refuses it as UNDISCRIMINATING_CASE); the marker needs its reason', () => {
  const raw = fresh();
  for (const row of raw.cases.find(item => item.id === 'T-004').referenceWorkers) row.expect.applicationTimeBlockers = [];
  const mutated = adaptS02(raw, {registry});
  assert.equal(mutated.cases.find(item => item.id === 'T-004').positiveOnly, false, 'with no reason in the corpus nothing opts the case out');
  assert.equal(mutated.cases.filter(item => item.positiveOnly).length, 2);
  const native = patch => ({synthetic: true, cases: [{id: 'p1', expectedFacts: caseById('T-001').expectedFacts, expectedEligibility: {fit: {hardBlockers: []}}, ...patch}]});
  assert.throws(() => normaliseCorpus(native({positiveOnly: true}), {registry}), /POSITIVE_ONLY_NEEDS_A_REASON/);
  assert.throws(() => normaliseCorpus(native({positiveOnly: true, positiveOnlyReason: 'too short'}), {registry}), /POSITIVE_ONLY_NEEDS_A_REASON/);
  assert.throws(() => normaliseCorpus(native({positiveOnlyReason: 'a reason without the flag, twenty characters'}), {registry}), /POSITIVE_ONLY_REASON_WITHOUT_FLAG/);
  assert.equal(normaliseCorpus(native({positiveOnly: true, positiveOnlyReason: 'the corpus names no negative: twenty characters'}), {registry}).cases[0].positiveOnly, true);
});

test('TRIPWIRE: a READY case whose ignored publication / review keys contradict READY throws S02_READY_CASE_CONTRADICTS (it would be published on a synthetic ALLOW and claim a state the product does not hold)', () => {
  const run = patch => { const raw = fresh(); patch(raw.cases.find(item => item.id === 'T-001')); return () => adaptS02(raw, {registry}); };
  assert.throws(run(task => { task.expected.publicationOutcome = {outcome: 'BLOCK', rule: 'RS-MIN-007'}; }), /S02_READY_CASE_CONTRADICTS.*publicationOutcome "BLOCK"/);
  assert.throws(run(task => { task.expected.publicationOutcome = {outcome: 'REVIEW'}; }), /S02_READY_CASE_CONTRADICTS/);
  assert.throws(run(task => { task.expected.review.missingRequired = ['need.price_mode']; }), /S02_READY_CASE_CONTRADICTS.*missingRequired/);
  assert.throws(run(task => { task.expected.review.canPublishFromAiAlone = true; }), /S02_READY_CASE_CONTRADICTS.*canPublishFromAiAlone/);
  assert.throws(run(task => { task.expected.review.humanConfirmationRequired = false; }), /S02_READY_CASE_CONTRADICTS.*humanConfirmationRequired/);
  assert.doesNotThrow(run(task => { task.expected.publicationOutcome = {outcome: 'ALLOW', rule: 'RS-MIN-001'}; task.expected.review.missingRequired = []; }), 'ALLOW and an empty list are what READY means');
  // a case that publishes nothing keeps its BLOCK / REVIEW outcome without a tripwire (it is skipped, with the reason)
  assert.ok(adapted.skipped.some(item => item.id === 'T-016'));
});

test('nothing is dropped silently: a TASK-family key on a WORKER case and a WORKER-family key on a TASK case throw; the corpus must agree with itself about the blockers, not only about the booleans', () => {
  const fromId = (raw, id) => raw.cases.find(item => item.id === id);
  let raw = fresh();
  fromId(raw, 'W-001').referenceWorkers = fromId(raw, 'T-001').referenceWorkers;
  assert.throws(() => adaptS02(raw, {registry}), /S02_WORKER_CASE_HAS_REFERENCE_WORKERS.*referenceWorkers/);
  raw = fresh();
  fromId(raw, 'W-001').referenceWorkersNote = 'a note';
  assert.throws(() => adaptS02(raw, {registry}), /S02_WORKER_CASE_HAS_REFERENCE_WORKERS.*referenceWorkersNote/);
  raw = fresh();
  fromId(raw, 'W-001').expected.facts = {'need.title': 'x'};
  assert.throws(() => adaptS02(raw, {registry}), /S02_KEY_UNKNOWN.*facts/, 'expected.facts on a WORKER case is an unknown key');
  raw = fresh();
  fromId(raw, 'T-001').referenceTasks = [{label: 'x'}];
  assert.throws(() => adaptS02(raw, {registry}), /S02_TASK_CASE_HAS_REFERENCE_TASKS.*referenceTasks/);
  raw = fresh();
  fromId(raw, 'T-001').referenceAssumes = {};
  assert.throws(() => adaptS02(raw, {registry}), /S02_TASK_CASE_HAS_REFERENCE_TASKS.*referenceAssumes/);
  // ELIGIBLE with all booleans true but a hard blocker, or a dispatch blocker, is an input error (the matcher's own invariants could never produce it)
  raw = fresh();
  fromId(raw, 'T-001').referenceWorkers[0].expect.hardBlockers = ['MISSING_REQUIRED_TOOL'];
  assert.throws(() => adaptS02(raw, {registry}), /S02_ELIGIBILITY_INCONSISTENT.*responseAllowed true with hardBlockers/);
  raw = fresh();
  fromId(raw, 'T-001').referenceWorkers[0].expect.dispatchBlockers = ['OUTSIDE_AVAILABILITY'];
  assert.throws(() => adaptS02(raw, {registry}), /S02_ELIGIBILITY_INCONSISTENT.*dispatchEligible true with/);
  raw = fresh();
  const doesNotFit = fromId(raw, 'T-001').referenceWorkers[1];   // MANUAL_ONLY: responseAllowed true, dispatchEligible false, a dispatch blocker
  doesNotFit.expect.dispatchBlockers = [];
  assert.throws(() => adaptS02(raw, {registry}), /S02_ELIGIBILITY_INCONSISTENT.*dispatchEligible false with/);
  raw = fresh();
  const hard = fromId(raw, 'T-010').referenceWorkers.find(item => item.expect.eligibility === 'HARD_BLOCKED');
  hard.expect.hardBlockers = [];
  assert.throws(() => adaptS02(raw, {registry}), /S02_ELIGIBILITY_INCONSISTENT.*responseAllowed false with hardBlockers \[\]/);
});

test('the S02 absolute times rebase into the future for any CI date up to a few days before the earliest window, and a stale corpus is refused; every fit worker resolves its availability shape', () => {
  for (const ci of ['2026-10-01T12:00:00Z', '2026-10-04T23:00:00Z', '2026-10-05T08:00:00Z', '2026-10-08T00:00:00Z', '2026-10-20T12:00:00Z']) {
    const nowMs = Date.parse(ci), rebase = computeRebase({ciNowMs: nowMs, corpusNowUtc: adapted.clock.nowUtc});
    let n = 0;
    for (const item of adapted.cases) {
      const times = materialiseTimes(item.expectedFacts, {nowMs, rebase});
      for (const entry of item.referenceWorkers) {
        const resolved = availabilityFor(entry.profile.availability.shape, times.interval, {newId: () => 'id-' + (n += 1)});
        if (item.expectedFacts['need.schedule_kind'] === 'FIXED_WINDOW' && entry.profile.availability.shape === 'AVAILABLE_NOW_AND_SCHEDULED') {
          assert.equal(resolved.availability.rules.length + resolved.availability.windows.length, 1, `${item.id}/${entry.label} at ${ci}`);
        }
      }
    }
  }
  const dated = adapted.cases.find(item => item.expectedFacts['need.starts_at']);
  assert.throws(() => materialiseTimes(dated.expectedFacts, {nowMs: Date.parse('2026-12-01T00:00:00Z'), rebase: null}), /CASE_TIME_NOT_FUTURE/, 'without the rebase the corpus has aged out');
  const late = computeRebase({ciNowMs: Date.parse('2026-12-01T00:00:00Z'), corpusNowUtc: adapted.clock.nowUtc});
  assert.doesNotThrow(() => materialiseTimes(dated.expectedFacts, {nowMs: Date.parse('2026-12-01T00:00:00Z'), rebase: late}), 'the rebase keeps the lead of the window');
});

test('every rebased S02 time is written with Belgrade\'s REAL offset at the new instant (a window moved across a DST change reads +02:00 / +01:00 as the zone does), and the instant, the duration and the lead are unchanged by it', () => {
  const offsetOf = text => (text === 'Z' ? 0 : (text[0] === '-' ? -1 : 1) * (Number(text.slice(1, 3)) * 60 + Number(text.slice(4, 6))));
  for (const ci of ['2026-10-01T12:00:00Z', '2026-10-28T10:00:00Z', '2027-03-20T09:00:00Z', '2027-04-02T09:00:00Z']) {
    const nowMs = Date.parse(ci), rebase = computeRebase({ciNowMs: nowMs, corpusNowUtc: adapted.clock.nowUtc});
    for (const item of adapted.cases.filter(entry => entry.expectedFacts['need.starts_at'])) {
      const times = materialiseTimes(item.expectedFacts, {nowMs, rebase});
      for (const key of ['need.starts_at', 'need.ends_at']) {
        const parsed = parseIso(times.facts[key]), original = parseIso(item.expectedFacts[key]);
        assert.equal(parsed.ms, original.ms + rebase.deltaMs, `${item.id} ${key} at ${ci}: the instant is the original instant shifted by the delta`);
        assert.equal(parsed.offsetMinutes, utcOffsetMinutes(parsed.ms), `${item.id} ${key} at ${ci}: ${times.facts[key]} is not Belgrade's offset at that instant`);
        assert.equal(offsetOf(parsed.offsetText), parsed.offsetMinutes);
      }
      assert.equal(times.interval.endMs - times.interval.startMs, parseIso(item.expectedFacts['need.ends_at']).ms - parseIso(item.expectedFacts['need.starts_at']).ms, 'the duration is preserved');
    }
  }
});

test('with the corpus clock and a CI clock a few days before the earliest window every window stays at least 28 hours ahead (a run of an hour does not age it out)', () => {
  const nowMs = Date.parse('2026-10-05T08:00:00Z'), rebase = computeRebase({ciNowMs: nowMs, corpusNowUtc: adapted.clock.nowUtc});
  const leads = adapted.cases.filter(item => item.expectedFacts['need.starts_at']).map(item => materialiseTimes(item.expectedFacts, {nowMs, rebase}).interval.startMs - nowMs);
  assert.ok(Math.min(...leads) >= 28 * 3600000, String(Math.min(...leads) / 3600000));
});

// ------------------------------------------------------------------ loadCorpus
test('loadCorpus: the S02 contract goes through the adapter, a harness-native corpus through normaliseCorpus, anything else is refused (the default path never picks a different contract silently)', () => {
  const viaLoader = loadCorpus(fresh(), {registry, normaliseNative: normaliseCorpus});
  assert.equal(viaLoader.cases.length, 37);
  const native = {synthetic: true, cases: [{id: 'n1', expectedFacts: {'need.title': 't', 'need.description': 'd', 'need.category': 'c', 'need.price_mode': 'OFFERS', 'need.schedule_kind': 'FLEXIBLE',
    'need.people_needed': 1, 'need.required_skills': ['a'], 'need.task_country_code': 'RS', 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}}}, expectedEligibility: {fit: {delivery: true}}}]};
  assert.equal(loadCorpus(native, {registry: STAND_IN_REGISTRY, normaliseNative: normaliseCorpus}).cases.length, 1);
  assert.throws(() => loadCorpus({corpusId: 'SOMETHING_ELSE', cases: []}, {registry, normaliseNative: normaliseCorpus}), /CORPUS_SHAPE_UNRECOGNISED/);
  assert.throws(() => loadCorpus({nothing: true}, {registry, normaliseNative: normaliseCorpus}), /CORPUS_SHAPE_UNRECOGNISED/);
  assert.throws(() => loadCorpus(native, {registry}), /CORPUS_SHAPE_UNRECOGNISED/);
});
