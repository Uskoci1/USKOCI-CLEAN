// EX-06 S04: offline tests of the case catalogue against hand-built observations of two worlds (AS_BUILT = the product as read from its DEV bodies, FIXED = every proposed fix applied), plus
// mutation tests: ONE changed fact must flip exactly the case that names it. A case that cannot fail would be vacuous; these tests are what shows it can.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES, CASE_IDS, FINDINGS, REQUIRED_SCENARIOS, SCENARIO_BODIES, SCENARIO_IDS, bodiesOf} from './cases.mjs';
import {S04_PINS} from './pins.mjs';
import {judgeCase, summarize, resultOf} from './judge.mjs';
import {ALL_FIXES, AS_BUILT_VERDICTS as AS_BUILT, referenceScenarios, worker, reachedParts} from './reference_obs.mjs';

const verdicts = scenarios => Object.fromEntries(CASES.map(def => [def.id, judgeCase(def, scenarios)]));
const clone = value => JSON.parse(JSON.stringify(value));

test('the catalogue is well formed: unique ids, a requirement for every entry, a cause for every negative, the evaluator for every check and probe', () => {
  assert.equal(new Set(CASE_IDS).size, CASE_IDS.length);
  assert.ok(CASES.length >= 50, 'the catalogue covers the lifecycle: ' + CASES.length);
  for (const def of CASES) {
    assert.ok(['WORKER', 'CHECK', 'PROBE'].includes(def.kind), def.id);
    assert.ok(typeof def.title === 'string' && def.title.length > 10, def.id + ' title');
    assert.ok(typeof def.requirement === 'string' && def.requirement.length > 5, def.id + ' requirement');
    assert.match(def.title + def.requirement, /^[\x20-\x7e]+$/, def.id + ' is ASCII');
    if (def.kind === 'WORKER') {
      assert.ok(def.expect && Object.keys(def.expect).length > 0, def.id + ' expects something');
      for (const key of Object.keys(def.expect)) assert.ok(['delivered', 'reached', 'events', 'visible', 'deliveryRows'].includes(key), def.id + ' expect key ' + key);
      assert.ok(def.control === true || (def.cause && def.cause.text), def.id + ' is a control or names its cause');
      if (!def.pick) assert.ok(typeof def.worker === 'string' && def.worker.length > 0, def.id);
    }
    if (def.kind === 'CHECK') assert.equal(typeof def.evaluate, 'function', def.id);
    if (def.kind === 'PROBE') {
      assert.equal(typeof def.decide, 'function', def.id);
      assert.ok(def.inference && def.requirement, def.id);
      assert.match(def.title, /^probe \(/, def.id + ' is labelled a probe');
    }
  }
});

test('every scenario of the proof has a case and every case names a known scenario', () => {
  for (const id of REQUIRED_SCENARIOS) assert.ok(SCENARIO_IDS.includes(id), 'unknown scenario ' + id);
  for (const id of SCENARIO_IDS) assert.ok(REQUIRED_SCENARIOS.includes(id), 'no case reads the scenario ' + id);
  assert.equal(SCENARIO_IDS.at(-1), 'push', 'the push scenario runs last: its claim closes the pending push rows of every earlier scenario');
});

test('the findings catalogue: every id a case can raise exists with a title, a summary and a proposed fix as text; every finding is raised by some case', () => {
  const raised = new Set(CASES.map(def => def.findingId).filter(Boolean));
  for (const id of raised) assert.ok(FINDINGS[id], 'finding ' + id + ' is not described');
  for (const id of Object.keys(FINDINGS)) {
    assert.ok(raised.has(id), id + ' is described but no case raises it');
    const finding = FINDINGS[id];
    assert.match(id, /^F\d+$/);
    for (const key of ['title', 'summary', 'proposedFix']) assert.ok(typeof finding[key] === 'string' && finding[key].length > 20, id + ' ' + key);
    assert.ok(['major', 'minor'].includes(finding.severity), id);
    assert.equal(typeof finding.ownerDecision, 'boolean', id);
    assert.match(finding.proposedFix, /^[\x20-\x7e]+$/, id + ' proposed fix is plain ASCII text');
    assert.ok(!/create or replace function/i.test(finding.proposedFix), id + ': a proposed fix is text, never a function body');
  }
  assert.deepEqual(Object.keys(FINDINGS), ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);
});


test('AS_BUILT: the predicted verdicts, case by case (the findings the author expects are exactly F5 ... F12)', () => {
  const result = verdicts(referenceScenarios([]));
  assert.deepEqual(Object.keys(AS_BUILT).sort(), [...CASE_IDS].sort(), 'every case has a prediction');
  for (const [id, verdict] of Object.entries(AS_BUILT)) assert.equal(result[id].verdict, verdict, id + ' ' + (result[id].reason ?? JSON.stringify(result[id].failed ?? result[id].rows?.filter(item => !item.ok))));
  const summary = summarize(Object.values(result).map(item => ({...item, findingId: item.findingId})), {harnessErrors: [], scenarios: SCENARIO_IDS.map(id => ({id, status: 'OK'})), chain: {verdict: 'EQUAL'}});
  assert.deepEqual(summary.findingIds, ['F10', 'F11', 'F12', 'F5', 'F6', 'F7', 'F8', 'F9']);
  assert.equal(resultOf(summary), 'FINDINGS');
  // the probes whose requirement is not met
  for (const id of ['PA', 'PB', 'PC', 'PD1', 'PD2', 'PD3', 'PE']) assert.equal(result[id].requirement, 'NOT_MET', id);
  for (const id of ['PF', 'PH']) assert.equal(result[id].requirement, 'NOT_APPLICABLE', id);
});

test('FIXED: with every proposed fix applied every finding case passes and every probe is refuted (the cases can pass)', () => {
  const result = verdicts(referenceScenarios(ALL_FIXES));
  for (const [id, verdict] of Object.entries(AS_BUILT)) {
    const expected = verdict === 'FINDING' ? 'PASS' : verdict === 'CONFIRMED' && !['PF', 'PH'].includes(id) ? 'REFUTED' : verdict;
    assert.equal(result[id].verdict, expected, id + ' ' + (result[id].reason ?? ''));
  }
  const summary = summarize(Object.values(result), {harnessErrors: [], scenarios: SCENARIO_IDS.map(id => ({id, status: 'OK'})), chain: {verdict: 'EQUAL'}});
  assert.deepEqual(summary.findingIds, []);
  assert.equal(resultOf(summary), 'PASS');
});

test('each finding flips on its own fix: a world where only F5 is fixed passes R14 and keeps every other finding', () => {
  for (const [fix, caseIds] of Object.entries({F5: ['R14'], F9: ['T03b'], F10: ['T04b']})) {
    const result = verdicts(referenceScenarios([fix]));
    for (const id of caseIds) assert.equal(result[id].verdict, 'PASS', fix + ' fixes ' + id);
    const others = Object.entries(AS_BUILT).filter(([id, verdict]) => verdict === 'FINDING' && !caseIds.includes(id)).map(([id]) => id);
    for (const id of others) assert.equal(result[id].verdict, 'FINDING', fix + ' leaves ' + id);
  }
  const probeFix = {F11: 'PA', F6: 'PB', F7: 'PC', F12: 'PE'};
  for (const [fix, id] of Object.entries(probeFix)) {
    assert.equal(verdicts(referenceScenarios([fix]))[id].verdict, 'REFUTED', fix + ' refutes ' + id);
    assert.equal(verdicts(referenceScenarios([]))[id].verdict, 'CONFIRMED');
  }
  assert.equal(verdicts(referenceScenarios(['F8']))['PD1'].verdict, 'REFUTED');
  assert.equal(verdicts(referenceScenarios(['F8']))['PD2'].verdict, 'REFUTED');
  assert.equal(verdicts(referenceScenarios(['F9']))['PD3'].verdict, 'REFUTED');
});

function mutate(mutator, fixes = []) {
  const scenarios = clone(referenceScenarios(fixes));
  mutator(scenarios);
  return verdicts(scenarios);
}

test('mutation: a product that delivers to a paused worker makes R01 a FINDING and nothing else', () => {
  const result = mutate(s => { Object.assign(s.reach.obs.workers.paused, reachedParts(1)); });
  assert.equal(result.R01.verdict, 'FINDING');
  assert.deepEqual(result.R01.failed.map(item => item.field), ['delivered', 'reached']);
  for (const id of ['R02', 'R03', 'R05', 'R07']) assert.equal(result[id].verdict, 'PASS', id);
});

test('mutation: a control that is not reached is a HARNESS_ERROR, not a quiet pass of the negatives', () => {
  const result = mutate(s => { Object.assign(s.reach.obs.workers['control-a'], worker('control-a')); });
  assert.equal(result.R00a.verdict, 'HARNESS_ERROR');
});

test('mutation: a negative whose cause was not observed is a HARNESS_ERROR', () => {
  const result = mutate(s => { s.reach.obs.workers.paused.cause = {observed: false, detail: 'available_now is still true'}; });
  assert.equal(result.R01.verdict, 'HARNESS_ERROR');
  assert.match(result.R01.reason, /available_now is still true/);
});

test('mutation: the blocked worker whose notification is NOT suppressed (the product reaches a blocked person) makes R11 a FINDING', () => {
  const result = mutate(s => { Object.assign(s.reach.obs.workers['blocked-by-worker'], reachedParts(1)); });
  assert.equal(result.R11.verdict, 'FINDING');
  assert.equal(result.R12.verdict, 'PASS');
});

test('mutation: wave order. A wave that reaches the wrong worker makes W01 a FINDING', () => {
  const result = mutate(s => { const [first, second] = s.waves.obs.actual; s.waves.obs.actual[0] = [...first.slice(0, 4), second[0]]; s.waves.obs.actual[1] = [first[4], ...second.slice(1)]; });
  assert.equal(result.W01.verdict, 'FINDING');
  assert.equal(result.W03.verdict, 'PASS');
});

test('mutation: wave size. A wave larger than its batch makes W02 a FINDING', () => {
  const result = mutate(s => { s.waves.obs.waves[0].inserted = 6; });
  assert.equal(result.W02.verdict, 'FINDING');
});

test('mutation: a duplicate delivery the database accepts makes W06 a FINDING; a replayed emit that adds an event makes W05 a FINDING', () => {
  assert.equal(mutate(s => { s.waves.obs.duplicateInsert.refused = false; }).W06.verdict, 'FINDING');
  assert.equal(mutate(s => { s.waves.obs.eventReplay.nilReturned = false; s.waves.obs.eventReplay.eventsAfter = 13; }).W05.verdict, 'FINDING');
  assert.equal(mutate(s => { s.waves.obs.totals.events = 13; }).W04.verdict, 'FINDING');
  assert.equal(mutate(s => { s.waves.obs.totals.distinctWorkers = 11; }).W03.verdict, 'FINDING');
});

test('mutation: tick idempotency. A second tick that creates a delivery makes I01 a FINDING; a requeue that duplicates makes I02 a FINDING; a re-sent expired delivery makes I03 a FINDING', () => {
  assert.equal(mutate(s => { s.ticks.obs.steps.s2.tick.processed = 1; s.ticks.obs.steps.s2.counts.deliveries = 4; }).I01.verdict, 'FINDING');
  assert.equal(mutate(s => { s.ticks.obs.steps.s4.counts.deliveries = 6; s.ticks.obs.steps.s4.counts.events = 6; }).I02.verdict, 'FINDING');
  assert.equal(mutate(s => { s.ticks.obs.steps.s6.counts.events = 5; s.ticks.obs.steps.s6.tick.sent = 1; }).I03.verdict, 'FINDING');
  assert.equal(mutate(s => { s.ticks.obs.workers.A.events = 2; }).I05.verdict, 'FINDING');
  assert.equal(mutate(s => { s.ticks.obs.workers.B.deliveries = 2; }).I04.verdict, 'FINDING');
});

test('mutation: closing the dispatch. A pending row that survives an expiry, a wave that sends after a cancellation, a requeue that brings a cancelled task back', () => {
  assert.equal(mutate(s => { s.expiry.obs.after.pending = [{channel: 'PUSH', state: 'CREATED', n: 1}]; }).T01.verdict, 'FINDING');
  assert.equal(mutate(s => { s.cancel.obs.waveAfter = {status: 'SENT', reason: null, inserted: 1}; }).T02.verdict, 'FINDING');
  assert.equal(mutate(s => { s.cancel.obs.requeue.scheduleQueued = true; }).T02.verdict, 'FINDING');
  assert.equal(mutate(s => { s.fill.obs.lateWorker = {deliveries: 1, events: 1}; }).T03.verdict, 'FINDING');
  assert.equal(mutate(s => { s.revision.obs.waveWhileDraft = {status: 'SENT', reason: null, inserted: 2}; }).T05.verdict, 'FINDING');
  assert.equal(mutate(s => { s.search.obs.requeueAfterClose.scheduleQueued = true; }).T04.verdict, 'FINDING');
  assert.equal(mutate(s => { s.target.obs.lateWorker = {deliveries: 1, events: 1}; }).C03.verdict, 'FINDING');
});

test('mutation: a closing case whose precondition fails (nothing was pending before) is a HARNESS_ERROR, never a quiet pass and never a finding about the product', () => {
  const result = mutate(s => { s.expiry.obs.before.pending = []; });
  assert.equal(result.T01.verdict, 'HARNESS_ERROR');
  assert.match(result.T01.reason, /precondition failed: precondition: pending IN_APP and PUSH rows existed before/);
  assert.equal(mutate(s => { s.ticks.obs.steps.s1.dueBefore = 0; }).I01.verdict, 'HARNESS_ERROR');
  assert.equal(mutate(s => { s.target.obs.applications = 2; }).C03.verdict, 'HARNESS_ERROR');
  assert.equal(mutate(s => { s.search.obs.afterCancel.requeued = false; }).T04b.verdict, 'HARNESS_ERROR');
  assert.equal(mutate(s => { s.ticks.obs.skillsEdited = false; }).I05.verdict, 'HARNESS_ERROR');
});

test('mutation: probes. A manual edit that requeues refutes PA; a sender gate that re-reads refutes PD3; an Inbox that hides stale tasks refutes PE; a gate that inherits refutes PC', () => {
  assert.equal(mutate(s => { s.requeue.obs.steps.afterManualEdit.nextRunAt = '2026-10-02T09:00:00.000Z'; s.requeue.obs.steps.afterManualEdit.attempts = 0; }).PA.verdict, 'REFUTED');
  assert.equal(mutate(s => { s.push.obs.workers.stale.suppressionAfter = 'NEED_NOT_OPEN'; }).PD3.verdict, 'REFUTED');
  assert.equal(mutate(s => { for (const state of s.resolver.obs.states) state.kind = state.name === 'live, eligible' ? 'OPPORTUNITY' : 'UNAVAILABLE'; }).PE.verdict, 'REFUTED');
  assert.equal(mutate(s => { s.push.obs.workers.inherit.suppressionBefore = '<null>'; }).PC.verdict, 'REFUTED');
  assert.equal(mutate(s => { s.reach.obs.workers['blocked-by-worker'].deliveries = []; s.reach.obs.workers['blocked-by-requester'].deliveries = []; s.reach.obs.workers.closure.deliveries = []; s.reach.obs.workers['opportunities-off'].deliveries = []; }).PB.verdict, 'REFUTED');
});

test('mutation: a probe the chain cannot reach is NOT_REACHED, never CONFIRMED by default (the control of PE did not resolve; the requeue writer did not requeue)', () => {
  assert.equal(mutate(s => { s.resolver.obs.states[0].kind = 'UNAVAILABLE'; }).PE.verdict, 'NOT_REACHED');
  assert.equal(mutate(s => { s.requeue.obs.steps.afterRequeueWriter.nextRunAt = '2026-10-02T11:00:00.000Z'; }).PA.verdict, 'NOT_REACHED');
});

test('a scenario that failed turns every case that reads it into NOT_RUN and the result into HARNESS_BROKEN', () => {
  const scenarios = referenceScenarios([]);
  scenarios.ticks = {status: 'HARNESS_ERROR', error: 'FIXTURE_NOT_APPLIED:team_capacity'};
  const result = verdicts(scenarios);
  for (const id of ['I01', 'I02', 'I03', 'I04', 'I05', 'PH']) assert.equal(result[id].verdict, 'NOT_RUN', id);
  const summary = summarize(Object.values(result), {harnessErrors: [], scenarios: SCENARIO_IDS.map(id => ({id, status: scenarios[id].status})), chain: {verdict: 'EQUAL'}});
  assert.equal(resultOf(summary), 'HARNESS_BROKEN');
});

test('PE reads four scenarios: when one of them did not run the probe is NOT_RUN', () => {
  const scenarios = referenceScenarios([]);
  scenarios.cancel = {status: 'HARNESS_ERROR', error: 'x'};
  assert.equal(verdicts(scenarios).PE.verdict, 'NOT_RUN');
});

test('every probe and every scenario names the function bodies it ran against, and every name is a pin of the table', () => {
  const names = new Set(S04_PINS.map(pin => pin.name));
  for (const def of CASES.filter(item => item.kind === 'PROBE')) {
    assert.ok(Array.isArray(def.bodies) && def.bodies.length >= 2, def.id + ' lists the bodies it ran against');
    for (const name of def.bodies) assert.ok(names.has(name), def.id + ' names an unpinned function ' + name);
  }
  for (const id of SCENARIO_IDS) {
    assert.ok(Array.isArray(SCENARIO_BODIES[id]) && SCENARIO_BODIES[id].length >= 3, id + ' lists the bodies it depends on');
    for (const name of SCENARIO_BODIES[id]) assert.ok(names.has(name), id + ' names an unpinned function ' + name);
  }
  assert.deepEqual(bodiesOf(CASES.find(item => item.id === 'PC')), CASES.find(item => item.id === 'PC').bodies);
  const r01 = bodiesOf(CASES.find(item => item.id === 'R01'));
  assert.ok(r01.includes('private.dispatch_next_wave') && r01.includes('private.match_detail_without_calendar'), 'a worker case inherits the bodies of its scenario');
  const pe = bodiesOf(CASES.find(item => item.id === 'PE'));
  assert.ok(pe.includes('public.rpc_resolve_activity_event'));
});
