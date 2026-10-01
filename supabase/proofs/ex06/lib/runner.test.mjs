// Offline tests of the corpus runner (lib/runner.mjs) against a scripted fake fixture factory: `node --test supabase/proofs/ex06/lib/`.
// Two kinds of test. (1) the BOOKKEEPING of a run: a matcher that agrees with the corpus passes with positive and negative assertions, a matcher that disagrees produces findings with the
// body md5s. (2) one FAILING-FIXTURE test per hazard the review found: a null or NOT_FOUND matcher result, a wave that did nothing, a product refusal, a direct fallback, a fixture the product
// dropped, a SMOKE run, a capped run, a warning that can never fire. Each of them must end as a harness error, a finding or a non-PASS result, never as a green run.
process.env.EX06_QUIET = '1';
import assert from 'node:assert/strict';
import test from 'node:test';
import {PINS} from './pins.mjs';
import {CANARY_CORPUS, SMOKE_CORPUS, normaliseCorpus} from './corpus.mjs';
import {BODY_KEYS, HarnessFailure, assertMatchShape, assertWaveShape, checkAssertions, finalizeResult, matcherBodiesOf, newReport, runCanary, runCase} from './runner.mjs';
import {STAND_IN_REGISTRY as REGISTRY, agreeing, fakeFixtures} from './test_support.mjs';

const BODIES = matcherBodiesOf(Object.fromEntries(PINS.map(pin => [pin.name, pin.md5])));
const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);

async function run(corpusRaw, configure, {label = 'SMOKE', rebase = null, needPath = 'product', cap = null} = {}) {
  const report = newReport();
  const corpus = normaliseCorpus(corpusRaw, {registry: REGISTRY, label});
  Object.assign(report.corpus, {label, totalCases: corpus.totalCases, buildable: corpus.cases.length, skipped: corpus.skipped, cap, capped: cap !== null && cap < corpus.cases.length});
  const fixtures = [];
  for (const item of corpus.cases.slice(0, cap ?? Infinity)) {
    const fx = configure(item);
    fixtures.push(fx);
    report.cases.push(await runCase(fx, item, {report, matcherBodies: BODIES, nowMs: NOW, rebase, corpusLabel: label, needPath}));
    report.corpus.ran += 1;
  }
  checkAssertions(report);
  return {report, fixtures, exitCode: finalizeResult(report), strictExitCode: finalizeResult(report, {strict: true})};
}

const cleanRun = (label = 'SMOKE') => run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id}), {label});

// ------------------------------------------------------------------ bookkeeping
test('a matcher that agrees with the SMOKE corpus: SMOKE_ONLY (never PASS), exit 0, positive and negative assertions, controls, derived invariants, fixtures retired per case', async () => {
  const {report, fixtures, exitCode} = await cleanRun('SMOKE');
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.harnessErrors, []);
  assert.equal(report.result, 'SMOKE_ONLY');
  assert.notEqual(report.result, 'PASS');
  assert.equal(exitCode, 0);
  const a = report.assertions;
  assert.ok(a.matcher > 20 && a.positive > 0 && a.negative > 0 && a.distinct > 5 && a.preconditions > 10 && a.controls >= 15 && a.derived.positive > 0 && a.derived.negative > 0, JSON.stringify(a));
  assert.deepEqual(report.warnings.filter(text => !text.includes('no negative that S03 can assert')), []);
  assert.deepEqual(fixtures.map(fx => fx.calls.workers.length), [4, 4, 6]);
  assert.ok(fixtures.every(fx => fx.calls.marks === 1 && fx.calls.retired.length === 1 && fx.calls.waves === 1 && fx.calls.parked === 1));
  assert.deepEqual(report.cases.map(item => item.status), ['PASS', 'PASS', 'PASS']);
  const unfit = report.cases[0].workers.find(worker => worker.label === 'unfit');
  assert.ok(unfit.rows.every(row => row.verdict === 'PASS') && unfit.rows.length === 6);
  assert.equal(report.paths.product, 3);
  assert.equal(report.paths.direct, 0);
});

test('the same clean run on a contract-corpus label is PASS only when every buildable case ran; a capped run, or one with a case that did not run, is PARTIAL', async () => {
  const clean = await cleanRun('CORPUS');
  assert.equal(clean.report.result, 'PASS');
  const capped = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id}), {label: 'CORPUS', cap: 2});
  assert.equal(capped.report.corpus.capped, true);
  assert.equal(capped.report.result, 'PARTIAL');
  const unrun = newReport();
  Object.assign(unrun.corpus, {label: 'CORPUS', totalCases: 5, buildable: 5, ran: 3, skipped: [{id: 'x'}, {id: 'y'}]});
  finalizeResult(unrun);
  assert.equal(unrun.result, 'PARTIAL');
});

test('a matcher that lets an unfit worker through is a FINDING with the body md5s, exit 0 (exit 2 when strict), never a harness failure', async () => {
  const wrong = (label, caseId) => (label === 'unfit' && caseId === 'smoke-missing-van' ? {hardBlockers: [], dispatchBlockers: [], dispatchEligible: true, responseAllowed: true, reasonCodes: [], score: 70} : agreeing(label, caseId));
  const {report, exitCode, strictExitCode} = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, outcome: wrong, delivered: ['fit', 'unfit']}), {label: 'CORPUS'});
  assert.equal(report.result, 'FINDINGS');
  assert.equal(exitCode, 0);
  assert.equal(strictExitCode, 2);
  assert.deepEqual(report.findings.map(item => `${item.caseId}/${item.worker}/${item.field}`).sort(),
    ['smoke-missing-van/unfit/delivery', 'smoke-missing-van/unfit/dispatchEligible', 'smoke-missing-van/unfit/event', 'smoke-missing-van/unfit/hardBlockers', 'smoke-missing-van/unfit/responseAllowed']);
  assert.match(report.findings[0].bodiesShort, /matchDetail:38c7894a/);
  assert.match(report.findings[0].bodiesShort, /matchDetailForCalendarInterval:781956ca/);
  assert.equal(report.findings[0].materialisation, 'PRODUCT_PATH');
  assert.equal(report.cases[1].status, 'FINDING');
  assert.equal(report.cases[0].status, 'PASS');
});

test('BODY_KEYS names every body on the dispatch path, match_detail and dispatch_tick included', () => {
  for (const name of ['private.match_detail', 'private.dispatch_tick', 'private.match_detail_for_calendar_interval', 'private.dispatch_next_wave', 'private.emit_event', 'private.push_suppression']) assert.ok(name in BODY_KEYS, name);
  assert.equal(BODIES.matchDetail, '38c7894a');
  assert.equal(BODIES.dispatchTick, 'e568b033');
});

test('a fit worker that is not reached (no delivery, no event) is a finding on both fields, once (the derived invariant does not repeat it); a wrong hidden kind of the STORED task is a finding', async () => {
  const {report} = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, delivered: [], kinds: item.id === 'smoke-fit-tool' ? ['SELIDBE_PREVOZ'] : null}), {label: 'CORPUS'});
  const fit = report.findings.filter(item => item.worker === 'fit' && item.caseId === 'smoke-fit-tool').map(item => `${item.field}:${item.kind ?? 'CORPUS'}`).sort();
  assert.deepEqual(fit, ['delivery:CORPUS', 'event:CORPUS']);
  const kinds = report.findings.find(item => item.field.startsWith('hidden kinds of the stored task') && item.caseId === 'smoke-fit-tool');
  assert.deepEqual(kinds.expected, ['FIZICKI_POSLOVI']);
  assert.deepEqual(kinds.actual, ['SELIDBE_PREVOZ']);
  assert.ok(report.assertions.kinds.checked >= 3 && report.assertions.kinds.mismatched === 1);
});

test('derived invariants fire for what no expectation asserts: an eligible worker the wave did not reach, a worker reached that is not eligible, an event without a delivery', async () => {
  const native = {synthetic: true, cases: [{id: 'c1', expectedFacts: {'need.title': 't', 'need.description': 'd', 'need.category': 'c', 'need.price_mode': 'OFFERS', 'need.schedule_kind': 'FLEXIBLE', 'need.people_needed': 1,
    'need.required_skills': ['a'], 'need.task_country_code': 'RS', 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}}}, expectedEligibility: {fit: {hardBlockers: []}}}]};
  const eligibleNotDelivered = await run(native, item => fakeFixtures({caseId: item.id, delivered: []}), {label: 'SMOKE'});
  assert.ok(eligibleNotDelivered.report.findings.some(item => item.kind === 'ELIGIBLE_NOT_DELIVERED' && item.worker === 'fit'));
  const deliveredNotEligible = await run(native, item => fakeFixtures({caseId: item.id, alsoDeliver: ['unfit']}), {label: 'SMOKE'});
  assert.ok(deliveredNotEligible.report.findings.some(item => item.kind === 'DELIVERED_BUT_NOT_ELIGIBLE' && item.worker === 'unfit'));
  assert.equal(deliveredNotEligible.report.result, 'SMOKE_ONLY');
});

test('a fixture that cannot be built is a HARNESS_ERROR (exit 1), the case entry says where, and the fixtures are still retired (half-built workers included, by the mark)', async () => {
  const {report, fixtures, exitCode} = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, failWorker: item.id === 'smoke-missing-van' ? 'unknown' : null}), {label: 'CORPUS'});
  assert.equal(report.result, 'HARNESS_BROKEN');
  assert.equal(exitCode, 1);
  assert.equal(report.cases[1].status, 'HARNESS_ERROR');
  assert.equal(report.cases[1].step, 'workers');
  assert.match(report.cases[1].error, /FIXTURE_WORKER_FAILED/);
  assert.deepEqual(fixtures[1].calls.workers, ['fit', 'unfit']);
  assert.equal(fixtures[1].calls.retired.length, 1);
  assert.equal(report.cases[0].status, 'PASS');
});

// ------------------------------------------------------------------ the matcher result is shape-validated
const quiet = {synthetic: true, cases: [{id: 'c1', expectedFacts: {'need.title': 't', 'need.description': 'd', 'need.category': 'c', 'need.price_mode': 'OFFERS', 'need.schedule_kind': 'FLEXIBLE',
  'need.people_needed': 1, 'need.required_skills': ['a'], 'need.task_country_code': 'RS', 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}}}}]};

test('a null matcher result is a HARNESS_ERROR at the match step, never a vacuous pass of the negative expectations', async () => {
  const {report, exitCode} = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, matchPatch: () => null}), {label: 'CORPUS'});
  assert.equal(report.result, 'HARNESS_BROKEN');
  assert.equal(exitCode, 1);
  assert.ok(report.cases.every(item => item.status === 'HARNESS_ERROR' && item.step === 'match'));
  assert.match(report.cases[0].error, /MATCH_SHAPE_INVALID/);
  assert.equal(report.assertions.matcher, 0);
});

test('the NEED_NOT_FOUND / WORKER_PROFILE_NOT_FOUND early shape of match_detail is a HARNESS_ERROR', async () => {
  const notFound = {responseAllowed: false, dispatchEligible: false, hardBlockers: ['NEED_NOT_FOUND']};
  const {report} = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, matchPatch: () => notFound}), {label: 'CORPUS'});
  assert.equal(report.result, 'HARNESS_BROKEN');
  assert.match(report.cases[0].error, /NEED_NOT_FOUND/);
  assert.throws(() => assertMatchShape({...notFound, hardBlockers: ['WORKER_PROFILE_NOT_FOUND']}, {profileId: 'p', id: 'a'}), /WORKER_PROFILE_NOT_FOUND/);
});

test('assertMatchShape: identity, array and boolean types, a finite score and the matcher invariants are all required', () => {
  const ok = {workerProfileId: 'p', workerAccountId: 'a', hardBlockers: [], dispatchBlockers: ['X'], reasonCodes: [], responseAllowed: true, dispatchEligible: false, score: 12.5};
  assert.equal(assertMatchShape(ok, {profileId: 'p', id: 'a'}), ok);
  for (const [patch, pattern] of [[{workerProfileId: 'q'}, /workerProfileId/], [{workerAccountId: 'b'}, /workerAccountId/], [{dispatchBlockers: 'X'}, /dispatchBlockers/], [{responseAllowed: 'yes'}, /responseAllowed/],
    [{score: null}, /score/], [{hardBlockers: ['Y']}, /responseAllowed disagrees/], [{dispatchBlockers: []}, /dispatchEligible disagrees/]]) {
    assert.throws(() => assertMatchShape({...ok, ...patch}, {profileId: 'p', id: 'a'}), pattern);
  }
});

test('derived workers that all get the same answer mean the profile variation had no effect: FIXTURE_NOT_DISCRIMINATING is a harness error, not a finding', async () => {
  const sameForAll = (_label, caseId) => ({...agreeing('fit', caseId), dispatchBlockers: ['OUTSIDE_AVAILABILITY'], dispatchEligible: false});
  const {report} = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, outcome: sameForAll}), {label: 'CORPUS'});
  assert.equal(report.result, 'HARNESS_BROKEN');
  assert.ok(report.cases.every(item => item.step === 'match' && /FIXTURE_NOT_DISCRIMINATING/.test(item.error)));
  assert.deepEqual(report.findings, []);
});

// ------------------------------------------------------------------ the wave result is shape-validated
test('a wave that returns null, STOPPED with a reason, or STOPPED/WAVES_EXHAUSTED is a HARNESS_ERROR at the wave step (every delivery:false would otherwise pass)', async () => {
  for (const [name, wave, pattern] of [['null', () => null, /WAVE_SHAPE_INVALID/],
    ['NEED_NOT_OPEN', () => ({status: 'STOPPED', reason: 'NEED_NOT_OPEN', inserted: 0}), /WAVE_DID_NOT_RUN.*NEED_NOT_OPEN/],
    ['WAVES_EXHAUSTED', () => ({status: 'STOPPED', reason: 'WAVES_EXHAUSTED', inserted: 0}), /WAVE_DID_NOT_RUN.*WAVES_EXHAUSTED/],
    ['SLOTS_FILLED', () => ({status: 'STOPPED', reason: 'SLOTS_FILLED', inserted: 0}), /WAVE_DID_NOT_RUN/]]) {
    const {report, exitCode} = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, wave}), {label: 'CORPUS'});
    assert.equal(report.result, 'HARNESS_BROKEN', name);
    assert.equal(exitCode, 1);
    assert.ok(report.cases.every(item => item.step === 'wave'), name);
    assert.match(report.cases[0].error, pattern, name);
  }
});

test('a wave that is not the first of the task, a batch smaller than the expected deliveries, and a round row that disagrees are harness errors', async () => {
  const second = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, wave: base => ({...base, round: 2})}), {label: 'CORPUS'});
  assert.match(second.report.cases[0].error, /WAVE_NOT_FIRST/);
  const two = {synthetic: true, cases: [{...quiet.cases[0], id: 'two', expectedEligibility: {fit: {delivery: true}}, referenceWorkers: {second: {profileFrom: 'fit', expect: {delivery: true}}}}]};
  const small = await run(two, item => fakeFixtures({caseId: item.id, delivered: ['fit', 'second'], wave: base => ({...base, batchSize: 1, inserted: 1})}), {label: 'SMOKE'});
  assert.match(small.report.cases[0].error, /WAVE_FULL.*batchSize 1 is smaller than the 2 workers/);
  const noReason = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, delivered: [], rounds: () => [{round_no: 1, status: 'STOPPED', stop_reason: 'SOMETHING_ELSE', batch_size: 5}]}), {label: 'CORPUS'});
  assert.match(noReason.report.cases[0].error, /WAVE_ROUND_INCONSISTENT/);
  const twoRounds = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, rounds: base => [...base, ...base]}), {label: 'CORPUS'});
  assert.match(twoRounds.report.cases[0].error, /WAVE_ROUND_INCONSISTENT/);
  const lost = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, wave: base => ({...base, inserted: base.inserted + 1})}), {label: 'CORPUS'});
  assert.equal(lost.report.result, 'HARNESS_BROKEN');
});

test('assertWaveShape: SENT needs inserted > 0, STOPPED needs inserted 0 and no reason, the batch must cover the expected deliveries', () => {
  const sent = {status: 'SENT', round: 1, policyWaveNo: 1, inserted: 2, batchSize: 5};
  assert.equal(assertWaveShape(sent, {expectedDeliveries: 2}), sent);
  assert.equal(assertWaveShape({status: 'STOPPED', round: 1, policyWaveNo: 1, inserted: 0, batchSize: 5}).status, 'STOPPED');
  assert.throws(() => assertWaveShape({...sent, inserted: 0}), /WAVE_SHAPE_INVALID/);
  assert.throws(() => assertWaveShape({...sent, status: 'STOPPED'}), /WAVE_SHAPE_INVALID/);
  assert.throws(() => assertWaveShape(sent, {expectedDeliveries: 6}), /WAVE_FULL/);
  assert.throws(() => assertWaveShape({...sent, policyWaveNo: 2}), /WAVE_NOT_FIRST/);
  assert.throws(() => assertWaveShape(undefined), /WAVE_SHAPE_INVALID/);
  assert.ok(new HarnessFailure('X', 'y') instanceof Error);
});

test('a full wave that left an eligible fixture worker out is WAVE_FULL (a stray worker crowded it)', async () => {
  const {report} = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, delivered: ['fit'], outcome: (label, caseId) => (label === 'unknown' ? {...agreeing('fit', caseId)} : agreeing(label, caseId)),
    wave: base => ({...base, inserted: 5, batchSize: 5})}), {label: 'CORPUS'});
  assert.equal(report.result, 'HARNESS_BROKEN');
});

// ------------------------------------------------------------------ the product path, the direct path and the read-back
test('a READY case the product path refuses is a FINDING (PRODUCT_PATH_REFUSED_READY_CASE), not a silent fallback and not a harness error; a refusal at an infrastructure step is a harness error', async () => {
  const refused = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, refuseAt: item.id === 'smoke-fit-tool' ? 'publish' : null}), {label: 'CORPUS'});
  assert.deepEqual(refused.report.harnessErrors, []);
  assert.equal(refused.report.findings.length, 1);
  assert.ok(refused.report.findings.every(item => item.kind === 'PRODUCT_PATH_REFUSED_READY_CASE' && item.caseId === 'smoke-fit-tool' && /refused at publish/.test(item.actual)));
  assert.equal(refused.report.cases[0].status, 'PRODUCT_PATH_REFUSED');
  assert.equal(refused.report.cases[0].step, 'publish');
  assert.equal(refused.report.cases[1].status, 'PASS');
  assert.equal(refused.report.result, 'FINDINGS');
  assert.ok(refused.fixtures[0].calls.waves === 0 && refused.fixtures[0].calls.retired.length === 1, 'no wave ran on a task the product did not publish, and the fixtures were retired');
  const everyCase = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, refuseAt: 'publish'}), {label: 'CORPUS'});
  assert.equal(everyCase.report.result, 'HARNESS_BROKEN', 'a run in which the product refuses every case asserts nothing: it is vacuous');
  const timedOut = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, refuseAt: 'review', refuseMessage: 'LOCAL_RPC:20:TimeoutError: The operation was aborted due to timeout'}), {label: 'CORPUS'});
  assert.equal(timedOut.report.result, 'HARNESS_BROKEN', 'a call that timed out is the harness or the chain failing, not the product refusing a task');
  assert.deepEqual(timedOut.report.findings, []);
  const infra = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, refuseAt: 'provider_turns'}), {label: 'CORPUS'});
  assert.equal(infra.report.result, 'HARNESS_BROKEN');
  assert.ok(infra.report.cases.every(item => item.status === 'HARNESS_ERROR' && item.step === 'task'));
});

test('a direct materialisation makes the case DEGRADED: listed with the dropped facts, counted apart, the result is PARTIAL, and the finding carries the materialisation', async () => {
  const wrong = (label, caseId) => (label === 'unfit' ? {...agreeing('fit', caseId)} : agreeing(label, caseId));
  const {report} = await run(SMOKE_CORPUS, item => (item.id === 'smoke-unknown-capability' ? fakeFixtures({caseId: item.id})
    : fakeFixtures({caseId: item.id, materialisation: 'DIRECT_INSERT_PUBLISHED', droppedFacts: ['need.price_basis'], outcome: wrong, delivered: ['fit', 'unfit']})), {label: 'CORPUS', needPath: 'auto'});
  assert.equal(report.degradedCases.length, 2);
  assert.deepEqual(report.degradedCases[0].dropped, ['need.price_basis']);
  assert.ok(report.assertions.matcher > 0, 'the product-path case is counted as an ordinary assertion');
  assert.ok(report.assertions.degraded > 10, 'the degraded cases are counted apart');
  assert.equal(report.cases[0].degraded, true);
  assert.equal(report.cases[2].degraded, false);
  assert.deepEqual(report.paths, {product: 1, direct: 2});
  assert.ok(report.findings.length > 0 && report.findings.every(item => item.materialisation === 'DIRECT_INSERT_PUBLISHED'));
  assert.equal(report.result, 'PARTIAL');
  assert.ok(report.warnings.some(text => /DEGRADED/.test(text)));
});

test('a fact the product does not carry (verified identity) is written by the labelled direct insert and counted as UNREACHABLE_STATE, apart from the ordinary assertions', async () => {
  const identity = {synthetic: true, cases: [{...quiet.cases[0], id: 'idc', expectedFacts: {...quiet.cases[0].expectedFacts, 'need.verified_identity_required': true}, expectedEligibility: {fit: {hardBlockers: []}}}]};
  const {report, fixtures} = await run(identity, item => fakeFixtures({caseId: item.id, materialisation: 'DIRECT_INSERT_PUBLISHED'}), {label: 'SMOKE'});
  assert.deepEqual(fixtures[0].calls.paths, ['direct']);
  assert.equal(report.unreachableCases.length, 1);
  assert.equal(report.cases[0].unreachable, true);
  assert.equal(report.degradedCases.length, 1, 'a direct materialisation is DEGRADED too, and says it is also unreachable');
  assert.equal(report.degradedCases[0].unreachable, true);
  assert.equal(report.assertions.matcher, 0);
  assert.equal(report.assertions.degraded, 0, 'counted in ONE bucket: unreachable');
  assert.ok(report.assertions.unreachable > 0);
});

test('a fixture the product did not apply is a harness error FIXTURE_NOT_APPLIED:<field> (task or worker), not a worker blocked for the wrong reason', async () => {
  const task = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, needBack: base => ({...base, mismatches: [{field: 'required_vehicles', expected: ['kombi'], actual: []}]})}), {label: 'CORPUS'});
  assert.equal(task.report.result, 'HARNESS_BROKEN');
  assert.match(task.report.cases[0].error, /FIXTURE_NOT_APPLIED:required_vehicles/);
  assert.equal(task.report.cases[0].step, 'readback');
  const worker = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, workerBack: (_w, base) => ({...base, mismatches: [{field: 'available_now', expected: true, actual: false}]})}), {label: 'CORPUS'});
  assert.match(worker.report.cases[0].error, /FIXTURE_NOT_APPLIED:available_now/);
});

test('the declared coordinates must reach the matcher: a null distance on a non-remote task, or a distance that is not the haversine of the stored coordinates, is a harness error; REMOTE reads null', async () => {
  const missing = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, matchPatch: (_l, match) => ({...match, distanceToStartKm: null})}), {label: 'CORPUS'});
  assert.match(missing.report.cases[0].error, /DISTANCE_NOT_AS_DECLARED/);
  const wrong = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, distance: 12}), {label: 'CORPUS'});
  assert.match(wrong.report.cases[0].error, /DISTANCE_NOT_AS_DECLARED/);
  const remote = {synthetic: true, cases: [{...quiet.cases[0], id: 'rem', expectedFacts: {...quiet.cases[0].expectedFacts, 'need.task_geography': {mode: 'REMOTE'}}, expectedEligibility: {fit: {hardBlockers: []}}}]};
  const ok = await run(remote, item => fakeFixtures({caseId: item.id}), {label: 'SMOKE'});
  assert.deepEqual(ok.report.harnessErrors, []);
  assert.equal(ok.report.cases[0].workers.find(worker => worker.label === 'fit').distance.source, 'REMOTE');
});

test('a calendar-busy worker (when busy is consumed) is booked over the task window before the matcher is read; a busy worker on a task without a window is a harness error', async () => {
  const busy = {synthetic: true, cases: [{...quiet.cases[0], id: 'busy', expectedFacts: {...quiet.cases[0].expectedFacts, 'need.schedule_kind': 'FIXED_WINDOW', 'need.starts_at': '@now+2d', 'need.ends_at': '@now+2d+2h'},
    expectedEligibility: {fit: {hardBlockers: [], dispatchEligible: true}}, referenceWorkers: {booked: {profileFrom: 'fit', profile: {busy: 'OVERLAPS_TASK_WINDOW'},
      expect: {hardBlockersInclude: ['CALENDAR_CONFLICT'], responseAllowed: false, dispatchEligible: false, delivery: false, event: false}}}}]};
  const outcome = (label, caseId) => (label === 'booked' ? {...agreeing('fit', caseId), hardBlockers: ['CALENDAR_CONFLICT'], dispatchEligible: false, responseAllowed: false} : agreeing(label, caseId));
  const {report, fixtures} = await run(busy, item => fakeFixtures({caseId: item.id, outcome}), {label: 'SMOKE'});
  assert.deepEqual(report.harnessErrors, []);
  assert.deepEqual(fixtures[0].calls.booked.map(item => item.label), ['booked']);
  assert.match(fixtures[0].calls.booked[0].interval.startsAt, /^2026-10-03T12:00:00Z$/);
  const noWindow = {synthetic: true, cases: [{...busy.cases[0], expectedFacts: {...quiet.cases[0].expectedFacts}}]};
  const failed = await run(noWindow, item => fakeFixtures({caseId: item.id, outcome}), {label: 'SMOKE'});
  assert.match(failed.report.cases[0].error, /BUSY_NEEDS_A_TASK_WINDOW/);
});

test('a stray ACTIVE worker that is still on the chain after parkForeign is FOREIGN_WORKERS_CROWD_WAVE', async () => {
  const {report} = await run(SMOKE_CORPUS, item => fakeFixtures({caseId: item.id, foreignActive: 2}), {label: 'CORPUS'});
  assert.match(report.cases[0].error, /FOREIGN_WORKERS_CROWD_WAVE/);
});

// ------------------------------------------------------------------ times: rebase and the future check
test('absolute corpus times are rebased against the CI clock before any fixture is built; a window that is not in the future is a harness error CASE_TIME_NOT_FUTURE', async () => {
  const dated = {synthetic: true, cases: [{...quiet.cases[0], id: 'dated', expectedFacts: {...quiet.cases[0].expectedFacts, 'need.schedule_kind': 'FIXED_WINDOW', 'need.starts_at': '2026-10-06T14:00:00+02:00',
    'need.ends_at': '2026-10-06T16:00:00+02:00'}, expectedEligibility: {fit: {hardBlockers: []}}}]};
  const rebase = {deltaMs: -4 * 86400000, ciNowUtc: '2026-10-01T12:00:00Z', corpusNowUtc: '2026-10-05T12:00:00Z', deltaHours: -96};
  const ok = await run(dated, item => fakeFixtures({caseId: item.id}), {label: 'SMOKE', rebase});
  assert.deepEqual(ok.report.harnessErrors, []);
  assert.equal(ok.report.cases[0].interval.startsAt, '2026-10-02T14:00:00+02:00');
  assert.deepEqual(ok.report.cases[0].rebased, ['need.starts_at', 'need.ends_at']);
  const spec = ok.fixtures[0].calls.specs.find(item => item.label === 'fit').spec;
  assert.ok(spec.interval.startMs > NOW && spec.interval.endMs - spec.interval.startMs === 2 * 3600000);
  assert.deepEqual(spec.availability, {shape: 'AVAILABLE_NOW_AND_SCHEDULED'});
  const stale = await run(dated, item => fakeFixtures({caseId: item.id}), {label: 'SMOKE', rebase: null, needPath: 'product'});
  const old = {synthetic: true, cases: [{...dated.cases[0], expectedFacts: {...dated.cases[0].expectedFacts, 'need.starts_at': '2020-10-06T14:00:00+02:00', 'need.ends_at': '2020-10-06T16:00:00+02:00'}}]};
  const aged = await run(old, item => fakeFixtures({caseId: item.id}), {label: 'SMOKE', rebase: null});
  assert.equal(aged.report.cases[0].status, 'HARNESS_ERROR');
  assert.equal(aged.report.cases[0].step, 'time');
  assert.match(aged.report.cases[0].error, /CASE_TIME_NOT_FUTURE/);
  assert.equal(stale.report.cases[0].status, 'PASS', 'the unrebased 2026-10-06 window is still in the future of the test clock');
});

// ------------------------------------------------------------------ vacuity and the contract-corpus checks
test('a run that asserts nothing about any worker is vacuous (harness error); a SMOKE run with only negatives warns that no positive exists, a contract run makes it a harness error', async () => {
  const vacuous = await run(quiet, item => fakeFixtures({caseId: item.id}), {label: 'SMOKE'});
  assert.equal(vacuous.report.assertions.matcher, 0);
  assert.equal(vacuous.report.cases[0].status, 'UNASSERTED');
  assert.ok(vacuous.report.harnessErrors.some(item => item.where === 'vacuous'));
  assert.equal(vacuous.exitCode, 1);
  const negativeOnly = {synthetic: true, cases: [{...quiet.cases[0], expectedEligibility: {fit: {dispatchEligible: false, dispatchBlockersInclude: ['OUTSIDE_AVAILABILITY']}}}]};
  const warned = await run(negativeOnly, item => fakeFixtures({caseId: item.id, outcome: (label, caseId) => (label === 'fit' ? {...agreeing('fit', caseId), dispatchBlockers: ['OUTSIDE_AVAILABILITY'], dispatchEligible: false} : agreeing(label, caseId))}), {label: 'SMOKE'});
  assert.equal(warned.report.assertions.positive, 0, 'the schedule/kinds/read-back checks no longer count as positive worker assertions');
  assert.ok(warned.report.warnings.some(text => text.startsWith('No positive expectation')), 'the warning can fire');
  assert.equal(warned.exitCode, 0);
  const strictReport = newReport();
  Object.assign(strictReport.corpus, {label: 'CORPUS'});
  Object.assign(strictReport.assertions, {matcher: 5, positive: 0, negative: 5});
  checkAssertions(strictReport);
  assert.ok(strictReport.harnessErrors.some(item => /NO_POSITIVE_EXPECTATION/.test(item.message)));
  const noNegative = newReport();
  Object.assign(noNegative.corpus, {label: 'CORPUS'});
  Object.assign(noNegative.assertions, {matcher: 5, positive: 5, negative: 0});
  checkAssertions(noNegative);
  assert.ok(noNegative.harnessErrors.some(item => /NO_NEGATIVE_EXPECTATION/.test(item.message)));
});

test('in a contract corpus a case with no eligible-worker anchor, or no negative that names its cause, is a harness error (unless the case opts out on purpose)', async () => {
  const noAnchor = {synthetic: true, cases: [{...quiet.cases[0], id: 'na', expectedEligibility: {fit: {dispatchEligible: false, dispatchBlockersInclude: ['OUTSIDE_AVAILABILITY']}}}]};
  const a = await run(noAnchor, item => fakeFixtures({caseId: item.id}), {label: 'CORPUS'});
  assert.match(a.report.cases[0].error, /UNANCHORED_CASE/);
  const anchored = {...quiet.cases[0], id: 'anchor', expectedEligibility: {fit: {hardBlockers: [], dispatchEligible: true}}};
  const optedOut = {synthetic: true, cases: [anchored, {...noAnchor.cases[0], noEligibleWorker: true}]};
  const b = await run(optedOut, item => fakeFixtures({caseId: item.id, outcome: (label, caseId) => (item.id === 'na' ? {...agreeing(label, caseId), dispatchBlockers: ['OUTSIDE_AVAILABILITY'], dispatchEligible: false} : agreeing(label, caseId))}), {label: 'CORPUS'});
  assert.deepEqual(b.report.harnessErrors, []);
  const positiveOnly = {synthetic: true, cases: [{...quiet.cases[0], id: 'po', expectedEligibility: {fit: {hardBlockers: [], dispatchEligible: true}}}]};
  const c = await run(positiveOnly, item => fakeFixtures({caseId: item.id}), {label: 'CORPUS'});
  assert.deepEqual(c.report.harnessErrors.filter(item => !/NO_NEGATIVE/.test(item.message)), [], 'the harness control gives the case its negative');
  assert.ok(c.report.warnings.some(text => /no negative that S03 can assert/.test(text)));
});

test('a negative expectation with no named cause is refused when the corpus is loaded; reasonUnspecified:true is accepted and the worker is listed UNATTRIBUTED', async () => {
  const bare = {synthetic: true, cases: [{...quiet.cases[0], expectedEligibility: {fit: {delivery: true}, unfit: {delivery: false}}}]};
  assert.throws(() => normaliseCorpus(bare, {registry: REGISTRY}), /NEGATIVE_EXPECTATION_WITHOUT_CAUSE/);
  const marked = {synthetic: true, cases: [{...quiet.cases[0], expectedEligibility: {fit: {delivery: true}, unfit: {delivery: false, reasonUnspecified: true}}}]};
  const {report} = await run(marked, item => fakeFixtures({caseId: item.id, outcome: (label, caseId) => (label === 'unfit' ? {...agreeing('unfit', caseId), hardBlockers: ['X'], dispatchEligible: false, responseAllowed: false} : agreeing(label, caseId))}), {label: 'SMOKE'});
  assert.deepEqual(report.unattributed.map(item => `${item.caseId}/${item.worker}`), ['c1/unfit']);
});

// ------------------------------------------------------------------ the canary
test('the canary passes on a correct pipeline and a failing canary case is returned as FAILED with its problems (the caller makes it a harness error)', async () => {
  const ids = facts => ({'Kanarinac: prenos stvari': 'canary-fit-unfit', 'Kanarinac: zakazan prevoz': 'canary-scheduled', 'Kanarinac: poslovi u Novom Sadu': 'canary-radius'})[facts['need.title']];
  const good = fakeFixtures({caseId: ids});
  const passed = await runCanary(good, {registry: REGISTRY, nowMs: NOW, matcherBodies: BODIES});
  assert.equal(passed.status, 'PASS', JSON.stringify(passed.problems));
  assert.deepEqual(passed.cases.map(item => item.id), CANARY_CORPUS.cases.map(item => item.id));
  const bad = fakeFixtures({caseId: ids, outcome: (label, caseId) => (label === 'unfit' && caseId === 'canary-fit-unfit' ? agreeing('fit', caseId) : agreeing(label, caseId)), delivered: ['fit', 'unfit']});
  const failed = await runCanary(bad, {registry: REGISTRY, nowMs: NOW, matcherBodies: BODIES});
  assert.equal(failed.status, 'FAILED');
  assert.ok(failed.problems.some(text => /canary-fit-unfit\/unfit/.test(text)));
  const broken = fakeFixtures({caseId: ids, matchPatch: () => null});
  assert.equal((await runCanary(broken, {registry: REGISTRY, nowMs: NOW, matcherBodies: BODIES})).status, 'FAILED');
  const refused = fakeFixtures({caseId: ids, refuseAt: 'accept'});
  assert.equal((await runCanary(refused, {registry: REGISTRY, nowMs: NOW, matcherBodies: BODIES})).status, 'FAILED');
});

test('the canary exercises the scheduled and the radius gates on the product path', async () => {
  const ids = facts => ({'Kanarinac: prenos stvari': 'canary-fit-unfit', 'Kanarinac: zakazan prevoz': 'canary-scheduled', 'Kanarinac: poslovi u Novom Sadu': 'canary-radius'})[facts['need.title']];
  const fx = fakeFixtures({caseId: ids});
  await runCanary(fx, {registry: REGISTRY, nowMs: NOW, matcherBodies: BODIES});
  const scheduled = fx.calls.needs.find(item => item.facts['need.schedule_kind'] === 'FIXED_WINDOW');
  assert.ok(scheduled.options.interval && scheduled.options.interval.startMs > NOW);
  assert.ok(fx.calls.paths.every(path => path === 'product'));
  assert.ok(fx.calls.specs.some(item => item.label === 'far' && item.spec.location.city === 'Niš'));
});

// ------------------------------------------------------------------ result enum
test('finalizeResult: HARNESS_BROKEN beats everything, SMOKE never yields PASS, PARTIAL needs a cap, a missing case or a degraded case, FINDINGS and PASS otherwise', () => {
  const make = (patch = {}, corpus = {}) => {
    const report = newReport();
    Object.assign(report.corpus, {label: 'CORPUS', totalCases: 10, buildable: 10, ran: 10, skipped: []}, corpus);
    Object.assign(report, patch);
    return report;
  };
  const result = report => { finalizeResult(report); return report.result; };
  assert.equal(result(make()), 'PASS');
  assert.equal(result(make({findings: [{}]})), 'FINDINGS');
  assert.equal(result(make({findings: [{}]}, {capped: true})), 'PARTIAL');
  assert.equal(result(make({}, {ran: 9})), 'PARTIAL');
  assert.equal(result(make({degradedCases: [{id: 'x'}]})), 'PARTIAL');
  assert.equal(result(make({}, {label: 'SMOKE'})), 'SMOKE_ONLY');
  assert.equal(result(make({findings: [{}]}, {label: 'SMOKE'})), 'SMOKE_ONLY');
  assert.equal(result(make({harnessErrors: [{where: 'x'}]}, {label: 'SMOKE'})), 'HARNESS_BROKEN');
  assert.equal(result(make({}, {totalCases: 66, buildable: 37, ran: 37, skipped: new Array(29).fill({})})), 'PASS', 'cases skipped by design (listed with a reason) are not a missing run');
});
