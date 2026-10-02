// EX-06 S04: the scenario drivers run END TO END against the simulated world (world_sim.mjs: the product as read from its DEV bodies), judged by the real catalogue. Two worlds: AS_BUILT (the
// findings F5 ... F12 are expected) and FIXED (every proposed fix applied). They prove the drivers and the judge fit together and that the proof can both pass and fail; they say nothing about
// what the chain does: the CI run does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES, SCENARIO_IDS} from './cases.mjs';
import {judgeCase, resultOf, summarize} from './judge.mjs';
import {ALL_FIXES, AS_BUILT_VERDICTS} from './reference_obs.mjs';
import {runScenarios, scenarioMap} from './runner.mjs';
import {BASE_FACTS, SCENARIOS} from './scenarios.mjs';
import {World} from './world_sim.mjs';
import {createDb} from './db.mjs';
import {createApi} from './api.mjs';
import {createFixtures} from '../../lib/fixtures.mjs';
import {fakeRuntime} from '../../lib/test_support.mjs';

async function runAll({fixes = [], world = new World({fixes}), only = null, mutate = null} = {}) {
  const ctx = world.context();
  if (mutate) mutate(world, ctx);
  const results = await runScenarios(ctx, SCENARIOS, {only});
  const scenarios = scenarioMap(results);
  const judged = CASES.map(def => ({...judgeCase(def, scenarios), title: def.title}));
  const summary = summarize(judged, {harnessErrors: [], scenarios: results.map(item => ({id: item.id, status: item.status, optional: item.optional})), chain: {verdict: 'EQUAL'}});
  return {world, ctx, results, scenarios, judged, summary, byId: Object.fromEntries(judged.map(item => [item.id, item]))};
}

test('the scenarios are the scenarios of the catalogue, in order, and the optional ones are exactly the three that rest on unproved fixture paths', () => {
  assert.deepEqual(SCENARIOS.map(item => item.id), [...SCENARIO_IDS]);
  assert.deepEqual(SCENARIOS.filter(item => item.optional).map(item => item.id), ['calendar', 'search', 'revision']);
  assert.equal(BASE_FACTS['need.task_country_code'], 'RS');
  for (const scenario of SCENARIOS) assert.equal(typeof scenario.run, 'function', scenario.id);
});

test('AS_BUILT: every scenario runs and the judge reproduces the predicted verdict of every case and probe', async () => {
  const run = await runAll();
  for (const item of run.results) assert.equal(item.status, 'OK', `${item.id}: ${item.error}`);
  for (const [id, verdict] of Object.entries(AS_BUILT_VERDICTS)) assert.equal(run.byId[id].verdict, verdict, `${id}: ${run.byId[id].reason ?? JSON.stringify((run.byId[id].failed ?? run.byId[id].rows ?? []).filter(row => !row.ok))}`);
  assert.deepEqual(run.summary.findingIds, ['F10', 'F11', 'F12', 'F5', 'F6', 'F7', 'F8', 'F9']);
  assert.equal(resultOf(run.summary), 'FINDINGS');
  assert.equal(run.summary.cases.HARNESS_ERROR + run.summary.probes.HARNESS_ERROR, 0);
});

test('FIXED: with every proposed fix applied the same drivers find nothing and refute every probe the fixes touch', async () => {
  const run = await runAll({fixes: ALL_FIXES});
  for (const item of run.results) assert.equal(item.status, 'OK', `${item.id}: ${item.error}`);
  for (const [id, verdict] of Object.entries(AS_BUILT_VERDICTS)) {
    const expected = verdict === 'FINDING' ? 'PASS' : verdict === 'CONFIRMED' && !['PF', 'PH'].includes(id) ? 'REFUTED' : verdict;
    assert.equal(run.byId[id].verdict, expected, `${id}: ${run.byId[id].reason ?? JSON.stringify((run.byId[id].failed ?? run.byId[id].rows ?? []).filter(row => !row.ok))}`);
  }
  assert.deepEqual(run.summary.findingIds, []);
  assert.equal(resultOf(run.summary), 'PASS');
});

test('each fix alone flips exactly the cases and probes it names', async () => {
  const table = {F5: ['R14'], F9: ['T03b', 'PD3'], F10: ['T04b'], F11: ['PA'], F6: ['PB'], F7: ['PC'], F12: ['PE'], F8: ['PD1', 'PD2']};
  const base = await runAll();
  for (const [fix, ids] of Object.entries(table)) {
    const fixed = await runAll({fixes: [fix]});
    for (const id of ids) assert.notEqual(fixed.byId[id].verdict, base.byId[id].verdict, `${fix} should change ${id}`);
    const changed = Object.keys(AS_BUILT_VERDICTS).filter(id => fixed.byId[id].verdict !== base.byId[id].verdict);
    // consequences that follow from the fix itself: F6 frees the slots (the controls move up to wave 1; they are controls, their verdict is unchanged), and F9 expires the pending rows of a filled
    // task, so the quiet-hours claim of probe (d2) has nothing left to suppress
    const incidental = {F6: ['R00a', 'R00b'], F9: ['PD2']}[fix] ?? [];
    for (const id of changed) assert.ok(ids.includes(id) || incidental.includes(id), `${fix} changed ${id}, which it does not name`);
  }
});

test('the product defects the drivers should see are really seen: a paused worker that the product delivers to is a FINDING of R01, a control that is not reached is a harness error', async () => {
  const delivered = await runAll({mutate: world => {
    const original = world.cheap.bind(world);
    world.cheap = (need, w) => (w.label === 's04-paused' ? true : original(need, w));
    const match = world.match.bind(world);
    world.match = (need, w) => { const m = match(need, w); return w.label === 's04-paused' ? {...m, dispatchEligible: true, dispatchBlockers: m.dispatchBlockers} : m; };
  }});
  assert.equal(delivered.byId.R01.verdict, 'FINDING');
  const silent = await runAll({mutate: world => { const original = world.cheap.bind(world); world.cheap = (need, w) => (w.label === 's04-control-a' ? false : original(need, w)); }});
  assert.equal(silent.byId.R00a.verdict, 'HARNESS_ERROR');
  assert.equal(resultOf(silent.summary), 'HARNESS_BROKEN');
});

test('a failing OPTIONAL scenario (the booking fixture) leaves the rest intact and the result PARTIAL', async () => {
  const run = await runAll({world: new World({failScenario: 'calendar'})});
  assert.equal(run.scenarios.calendar.status, 'HARNESS_ERROR');
  assert.match(run.scenarios.calendar.error, /EX06_BOOKING_APPLICATION_REFUSED/);
  assert.equal(run.byId.C05.verdict, 'NOT_RUN');
  assert.equal(run.byId.C04.verdict, 'NOT_RUN');
  assert.equal(run.byId.R14.verdict, 'FINDING', 'the other scenarios are untouched');
  assert.deepEqual(run.summary.optionalFailed, ['calendar']);
  assert.equal(resultOf(run.summary), 'PARTIAL');
});

test('a failing REQUIRED scenario is a broken harness: its cases are NOT_RUN and the run does not pretend', async () => {
  const run = await runAll({mutate: world => {
    const original = world.fx.createRequester;
    world.fx.createRequester = async spec => { if (String(spec.label).includes('ticks')) throw new Error('simulated: the Auth sign-in failed'); return original(spec); };
  }});
  assert.equal(run.scenarios.ticks.status, 'HARNESS_ERROR');
  assert.match(run.scenarios.ticks.error, /Auth sign-in failed/);
  for (const id of ['I01', 'I02', 'I03', 'I04', 'I05', 'PH']) assert.equal(run.byId[id].verdict, 'NOT_RUN', id);
  assert.equal(resultOf(run.summary), 'HARNESS_BROKEN');
});

test('a fixture that was not stored is a scenario error, never a finding', async () => {
  const run = await runAll({mutate: world => { world.fx.readBackWorker = worker => ({row: {}, mismatches: worker.label.includes('paused') ? [{field: 'available_now', expected: false, actual: true}] : []}); }});
  assert.equal(run.scenarios.reach.status, 'HARNESS_ERROR');
  assert.match(run.scenarios.reach.error, /FIXTURE_NOT_APPLIED:available_now/);
  assert.equal(run.byId.R01.verdict, 'NOT_RUN');
  assert.equal(run.byId.R14.verdict, 'NOT_RUN');
});

test('a foreign schedule row that a tick would claim is a scenario error (the isolation holds or the run says so)', async () => {
  const run = await runAll({mutate: world => { world.db.deleteOtherSchedules = () => {}; world.schedule.set('need-of-another-stage', {nextRunAt: 0, lockedUntil: null, attempts: 0, lastStatus: null, lastReason: null}); }, only: ['target']});
  assert.equal(run.scenarios.target.status, 'HARNESS_ERROR');
  assert.match(run.scenarios.target.error, /FOREIGN_SCHEDULE_ROWS_REMAIN/);
});

test('every scenario cleans up after itself: no task stays open, no worker stays active, no schedule row is left', async () => {
  const run = await runAll();
  assert.equal([...run.world.needs.values()].filter(need => ['DRAFT', 'PUBLISHED', 'SELECTION', 'ACTIVE'].includes(need.status)).length, 0);
  assert.equal([...run.world.profiles.values()].filter(profile => profile.status === 'ACTIVE').length, 0);
  assert.equal(run.world.schedule.size, 0);
  for (const item of run.results) assert.equal(item.cleanupError, null, item.id);
});

test('evidence is recorded per scenario (the ledger of every main task, the tick steps, the claim)', async () => {
  const run = await runAll();
  for (const item of run.results) assert.ok(item.evidence.length > 0, item.id + ' recorded no evidence');
  assert.ok(run.results.find(item => item.id === 'waves').evidence.some(entry => entry.label === 'waves'));
  assert.ok(run.results.find(item => item.id === 'push').evidence.some(entry => entry.label === 'push'));
});

test('the window scenario waits when the local clock is within the midnight guard, and builds "tomorrow" from the stored publication instant', async () => {
  const world = new World({startMs: Date.parse('2026-10-02T21:52:00.000Z')});   // 23:52 in Belgrade
  const run = await runAll({world, only: ['window']});
  assert.equal(run.scenarios.window.status, 'OK', run.scenarios.window.error);
  assert.ok(world.clock >= Date.parse('2026-10-02T22:03:00.000Z'), 'the clock moved past local midnight by the guard');
  const derived = run.scenarios.window.obs.tomorrow.derived;
  assert.equal(derived.zone, 'Europe/Belgrade');
  assert.equal(derived.tomorrow, '2026-10-04', 'published after midnight on Saturday 3 October: tomorrow is Sunday the 4th');
});

test('the drivers use only methods the real seams have (fx of the S03 fixtures, db, api)', async () => {
  const world = new World();
  const used = {fx: new Set(), db: new Set(), api: new Set()};
  for (const key of Object.keys(used)) {
    world[key] = new Proxy(world[key], {get(target, prop, receiver) { if (typeof prop === 'string' && !['then', 'toJSON'].includes(prop)) used[key].add(prop); return Reflect.get(target, prop, receiver); }});
  }
  const ctx = {...world.context(), fx: world.fx, db: world.db, api: world.api};
  await runScenarios(ctx, SCENARIOS);
  const realFx = Object.keys(createFixtures(fakeRuntime().rt));
  const realDb = Object.keys(createDb({rows: () => [], sql: () => ''}));
  const realApi = Object.keys(createApi({ok: async value => value, randomUUID: () => 'u', service: {}}));
  for (const name of used.fx) assert.ok(realFx.includes(name), 'fx.' + name + ' does not exist in lib/fixtures.mjs');
  for (const name of used.db) assert.ok(realDb.includes(name), 'db.' + name + ' does not exist in lib/db.mjs');
  for (const name of used.api) assert.ok(realApi.includes(name), 'api.' + name + ' does not exist in lib/api.mjs');
  assert.ok(used.fx.size >= 15 && used.db.size >= 15 && used.api.size >= 8, `the scenarios exercise the seams: ${used.fx.size} fx, ${used.db.size} db, ${used.api.size} api`);
});

test('the simulated world implements every method of the real seams the scenarios do not even call (so the seams stay in step)', () => {
  const world = new World();
  const realDb = Object.keys(createDb({rows: () => [], sql: () => ''}));
  const realApi = Object.keys(createApi({ok: async value => value, randomUUID: () => 'u', service: {}}));
  for (const name of realDb) assert.ok(name in world.db, 'the simulated db lacks ' + name);
  for (const name of realApi) assert.ok(name in world.api, 'the simulated api lacks ' + name);
});
