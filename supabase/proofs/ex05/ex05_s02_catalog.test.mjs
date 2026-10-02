// Offline tests of the catalog, the verdict function, the findings, the controls and the report admission of the EX-05 S02 proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as C from './ex05_s02_catalog.mjs';
import {STATEMENTS, GATES, KINDS} from './ex05_s02_sql.mjs';
import {loadPins, classifyFunction, classifyTrigger, censusDiff, fidelityVerdict, b24Targets} from './ex05_s02_pins.mjs';

const catalog = C.buildCatalog();
const byId = id => catalog.find(spec => spec.id === id);
const SHA = 'a'.repeat(40);

test('the catalog is complete, well formed and every statement and gate exists', () => {
  assert.equal(catalog.length, 17 + 2 * 9);
  assert.deepEqual(C.validateCatalog(catalog, {statements: STATEMENTS, gates: GATES}), []);
  assert.equal(new Set(catalog.map(spec => spec.id)).size, catalog.length);
  assert.equal(C.buildCatalog({kinds: ['voice']}).length, 17 + 9);
  assert.throws(() => C.agreementScenarios('text'), /BAD_KIND/);
});

test('exactly the pre-registered scenarios expect a deadlock, each with a finding or a control, the victim with the shorter deadlock timeout', () => {
  const deadlocks = catalog.filter(spec => spec.expect.class === 'DEADLOCK');
  assert.deepEqual(deadlocks.map(spec => spec.id).sort(), [
    'NC_A_INVERTED_CANCEL_VS_SEND_PHOTO', 'NC_A_INVERTED_CANCEL_VS_SEND_VOICE',
    'T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE', 'T1B_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_CANCEL',
    'T2A_CANCEL_READY_VS_COMPLETE_RETRY_COMPLETE_FIRST_VICTIM_COMPLETE', 'T2B_CANCEL_READY_VS_COMPLETE_RETRY_COMPLETE_FIRST_VICTIM_CANCEL']);
  for (const spec of deadlocks) {
    assert.ok(spec.finding || spec.control, spec.id);
    const victim = [spec.first, spec.second].find(part => part.name === spec.expect.victim);
    const other = [spec.first, spec.second].find(part => part.name !== spec.expect.victim);
    assert.ok(victim.deadlockMs < other.deadlockMs, spec.id);
    assert.equal(spec.secondBlockedBy, 'first');
  }
  assert.deepEqual(catalog.filter(spec => spec.finding === 'RC02-F1').map(spec => spec.id.slice(0, 3)), ['T1A', 'T1B']);
  assert.deepEqual(catalog.filter(spec => spec.finding === 'RC02-F2').map(spec => spec.id.slice(0, 3)), ['T2A', 'T2B']);
});

test('the controls are named, one positive for the task path and one negative for each upload family', () => {
  const controls = catalog.filter(spec => spec.control);
  assert.deepEqual(controls.map(spec => [spec.control.type, spec.control.mutation]), [
    ['POSITIVE', 'TASK_CANCEL_TAKES_THE_CONVERSATION_ROW_FIRST'],
    ['NEGATIVE', 'AGREEMENT_UPLOAD_SERVICE_TAKES_THE_UPLOAD_ROW_BEFORE_THE_ADVISORY_LOCK'],
    ['NEGATIVE', 'AGREEMENT_UPLOAD_SERVICE_TAKES_THE_UPLOAD_ROW_BEFORE_THE_ADVISORY_LOCK']]);
  assert.equal(byId('PC1_ORDERED_COPY_OF_CANCEL_VS_REMOVE_NO_DEADLOCK').second.stmt, 'taskCancelConvFirst');
  assert.equal(byId('NC_A_INVERTED_CANCEL_VS_SEND_PHOTO').second.stmt, 'agrCancelInverted');
});

test('the closure interleavings use a fresh owner and the last one of each family cleans up or comes last', () => {
  for (const id of ['CL1_CLOSURE_PREPARE_WAITS_FOR_A_PARKED_CANCEL', 'CL2A_CANCEL_WAITS_FOR_THE_CLOSURE_KEY_THEN_PROCEEDS', 'CL2B_CANCEL_REFUSED_ACCOUNT_CLOSING_AFTER_THE_KEY']) assert.equal(byId(id).fresh, 'owner');
  assert.equal(byId('CL2B_CANCEL_REFUSED_ACCOUNT_CLOSING_AFTER_THE_KEY').cleanup, 'closureRequest');
  assert.equal(byId('CL2A_CANCEL_WAITS_FOR_THE_CLOSURE_KEY_THEN_PROCEEDS').release, 'rollback');
  for (const kind of ['PHOTO', 'VOICE']) {
    const group = catalog.filter(spec => spec.group === 'AGREEMENT_' + kind);
    assert.equal(group.at(-1).id, 'CL3_CLOSURE_PREPARE_WAITS_FOR_A_PARKED_SEND_' + kind);
    assert.equal(group.length, 9);
  }
});

test('the registered final states are single states: no scenario accepts two outcomes of the same session class', () => {
  for (const spec of catalog) {
    assert.ok(spec.expect.final && Object.keys(spec.expect.final).length >= 2, spec.id);
    assert.ok(typeof spec.why === 'undefined' || spec.why.length > 0);
  }
  assert.deepEqual(byId('T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE').expect.final, {rows: 1, state: 'READY', selected: false, inRefs: false});
  assert.deepEqual(byId('T2B_CANCEL_READY_VS_COMPLETE_RETRY_COMPLETE_FIRST_VICTIM_CANCEL').expect.final, {rows: 1, state: 'READY', selected: true, inRefs: true});
});

test('matchPartial compares exactly where it matters and accepts {$oneOf}', () => {
  assert.deepEqual(C.matchPartial({a: 1, b: {c: [1, 2]}}, {a: 1, b: {c: [1, 2]}}), []);
  assert.deepEqual(C.matchPartial({a: 1, extra: 5}, {a: 1}), []);
  assert.equal(C.matchPartial({a: 2}, {a: 1}).length, 1);
  assert.equal(C.matchPartial({b: {c: [1]}}, {b: {c: [1, 2]}}).length, 1);
  assert.equal(C.matchPartial(null, {a: 1}).length, 1);
  assert.deepEqual(C.matchPartial({s: 'BLOCKED'}, {s: {$oneOf: ['NOT_READY', 'BLOCKED']}}), []);
  assert.equal(C.matchPartial({s: 'READY'}, {s: {$oneOf: ['NOT_READY', 'BLOCKED']}}).length, 1);
  assert.deepEqual(C.matchPartial({s: null}, {s: null}), []);
  assert.deepEqual(C.matchPartial({}, {s: null}), []);
  assert.equal(C.matchPartial({s: 'x'}, {s: null}).length, 1);
  assert.deepEqual(C.matchPartial(true, true), []);
  assert.equal(C.matchPartial(false, true).length, 1);
});

// ---- verdicts on synthetic runs --------------------------------------------------------------------------------------------------
const okOutcome = result => ({ok: true, exitCode: 0, results: result === undefined ? {} : {x: result}, sqlstate: null, message: null});
const failOutcome = (sqlstate, message, extra = {}) => ({ok: false, exitCode: 3, results: {}, sqlstate, message, ...extra});
const edgeTwo = {edges: [{waiterPid: 1, mode: 'ShareLock', on: 'transaction 5', holderPid: 2}, {waiterPid: 2, mode: 'ShareLock', on: 'transaction 6', holderPid: 1}]};
const goodRun = (spec, over = {}) => {
  const outcomes = {H: okOutcome()};
  for (const part of [spec.first, spec.second].filter(Boolean)) outcomes[part.name] = okOutcome();
  const run = {id: spec.id, outcomes, edges: [{waiter: spec.first.name, blockedBy: ['H']}, ...(spec.second ? [{waiter: spec.second.name, blockedBy: [spec.secondBlockedBy === 'gate' ? 'H' : spec.first.name]}] : [])],
    final: spec.expect.final, error: null, cleanupError: null, deadlockSettable: true};
  if (spec.secondBlockedBy === 'free') run.edges[1] = {waiter: spec.second.name, blockedBy: [], note: 'NOT_BLOCKED_ANSWERED_WHILE_THE_GATE_WAS_HELD'};
  for (const [name, partial] of Object.entries(spec.expect.results ?? {})) if (outcomes[name]) outcomes[name].results = {x: partial};
  for (const [name, keys] of Object.entries(spec.expect.errors ?? {})) { const [state, message] = keys[0].split(':'); outcomes[name] = failOutcome(state, message); }
  if (spec.expect.class === 'DEADLOCK') {
    outcomes[spec.expect.victim] = failOutcome('40P01', 'deadlock detected', edgeTwo);
  }
  // the registered results of a victim are not produced
  return {...run, ...over};
};
const resolveFinal = value => value;

test('every catalog scenario is judged AS_EXPECTED on its own registered outcome (the registration is consistent with itself)', () => {
  for (const spec of catalog) {
    const run = goodRun(spec);
    run.final = JSON.parse(JSON.stringify(spec.expect.final), (key, value) => (value && value.$oneOf ? value.$oneOf[0] : value));
    const verdict = C.judge(spec, run);
    assert.deepEqual(verdict.problems, [], spec.id);
    assert.equal(verdict.observedClass, spec.expect.class, spec.id);
  }
  void resolveFinal;
});

test('judge: every deviation is a named problem', () => {
  const spec = byId('A2_CANCEL_FIRST_THEN_SEND_VOICE');
  const base = () => goodRun(spec);
  const problems = run => C.judge(spec, run).problems;
  assert.deepEqual(problems(base()), []);
  assert.ok(problems({...base(), error: 'STEP_TIMEOUT:x'}).some(line => line.startsWith('SCENARIO_ERROR')));
  assert.ok(problems({...base(), cleanupError: 'x'}).some(line => line.startsWith('CLEANUP_ERROR')));
  assert.ok(problems({...base(), outcomes: {...base().outcomes, H: failOutcome('57014', 'x')}}).some(line => line.startsWith('GATE_SESSION_FAILED')));
  const noSend = base(); delete noSend.outcomes.SEND;
  assert.ok(problems(noSend).some(line => line === 'NO_OUTCOME:SEND'));
  const wrongError = base(); wrongError.outcomes.SEND = failOutcome('42501', 'MEDIA_NOT_FOUND');
  assert.ok(problems(wrongError).some(line => line.startsWith('UNEXPECTED_ERROR:SEND:42501:MEDIA_NOT_FOUND')));
  const noError = base(); noError.outcomes.SEND = okOutcome({});
  assert.ok(problems(noError).some(line => line.startsWith('EXPECTED_ERROR_MISSING:SEND')));
  const serialization = base(); serialization.outcomes.SEND = failOutcome('40001', 'MEDIA_COMMAND_CONFLICT');
  assert.ok(problems(serialization).some(line => line.startsWith('SQLSTATE_40001_OBSERVED:SEND')));
  const deadlock = base(); deadlock.outcomes.CANCEL = failOutcome('40P01', 'deadlock detected', edgeTwo);
  assert.ok(problems(deadlock).some(line => line.startsWith('UNEXPECTED_DEADLOCK')));
  assert.ok(problems({...base(), final: {...spec.expect.final, state: 'READY'}}).some(line => line.startsWith('FINAL_STATE_MISMATCH:final.state')));
  assert.ok(problems({...base(), final: null}).includes('FINAL_STATE_NOT_READ'));
  assert.ok(problems({...base(), edges: [base().edges[0]]}).some(line => line.startsWith('WAITS_NOT_OBSERVED')));
  assert.ok(problems({...base(), edges: [base().edges[0], {waiter: 'SEND', blockedBy: []}]}).some(line => line.startsWith('EDGE_WITHOUT_A_HOLDER')));
});

test('judge: a registered deadlock needs exactly one victim with a two-process cycle, a surviving partner and the registered victim', () => {
  const spec = byId('T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE');
  const base = () => goodRun(spec);
  assert.deepEqual(C.judge(spec, base()).problems, []);
  assert.equal(C.judge(spec, base()).victim, 'REMOVE');
  const none = base(); none.outcomes.REMOVE = okOutcome({ready: true});
  const noDeadlock = C.judge(spec, none);
  assert.equal(noDeadlock.verdict, 'UNEXPECTED');
  assert.ok(noDeadlock.problems.some(line => line.startsWith('CLASS_MISMATCH:expected DEADLOCK, observed SERIALIZED')));
  const both = base(); both.outcomes.CANCEL = failOutcome('40P01', 'deadlock detected', edgeTwo);
  assert.ok(C.judge(spec, both).problems.some(line => line.startsWith('EXPECTED_EXACTLY_ONE_VICTIM')));
  const survivorFailed = base(); survivorFailed.outcomes.CANCEL = failOutcome('42501', 'MEDIA_NOT_EDITABLE');
  assert.ok(C.judge(spec, survivorFailed).problems.some(line => line === 'SURVIVOR_FAILED:CANCEL'));
  const noEdges = base(); noEdges.outcomes.REMOVE = failOutcome('40P01', 'deadlock detected', {edges: []});
  assert.ok(C.judge(spec, noEdges).problems.includes('DEADLOCK_DETAIL_WITHOUT_TWO_EDGES'));
  const three = base(); three.outcomes.REMOVE = failOutcome('40P01', 'deadlock detected', {edges: [{waiterPid: 1, holderPid: 2}, {waiterPid: 2, holderPid: 3}]});
  assert.ok(C.judge(spec, three).problems.includes('DEADLOCK_EDGES_ARE_NOT_A_TWO_PROCESS_CYCLE'));
  const wrongVictim = base(); wrongVictim.outcomes.REMOVE = okOutcome({}); wrongVictim.outcomes.CANCEL = failOutcome('40P01', 'deadlock detected', edgeTwo);
  assert.ok(C.judge(spec, wrongVictim).problems.some(line => line.startsWith('WRONG_VICTIM')));
  assert.ok(!C.judge(spec, {...wrongVictim, deadlockSettable: false}).problems.some(line => line.startsWith('WRONG_VICTIM')));
});

test('findings and controls are derived from the verdicts, never from the run alone', () => {
  const verdicts = catalog.map(spec => C.judge(spec, goodRun(spec, {final: JSON.parse(JSON.stringify(spec.expect.final), (key, value) => (value && value.$oneOf ? value.$oneOf[0] : value))})));
  const findings = C.buildFindings(catalog, verdicts);
  assert.deepEqual(findings.map(f => [f.id, f.status]), [['RC02-F1', 'REPRODUCED'], ['RC02-F2', 'REPRODUCED'], ['AGREEMENT-PATH', 'NO_INVERSION_OBSERVED']]);
  const refuted = verdicts.map(v => (v.id.startsWith('T1A') ? {...v, observedClass: 'SERIALIZED', verdict: 'UNEXPECTED'} : v));
  assert.equal(C.buildFindings(catalog, refuted)[0].status, 'NOT_REPRODUCED');
  const missing = verdicts.filter(v => !v.id.startsWith('T1B'));
  assert.equal(C.buildFindings(catalog, missing)[0].status, 'INCONCLUSIVE');
  const agreementBroken = verdicts.map(v => (v.id === 'A1_SEND_FIRST_THEN_CANCEL_PHOTO' ? {...v, verdict: 'UNEXPECTED'} : v));
  assert.equal(C.buildFindings(catalog, agreementBroken)[2].status, 'SEE_VERDICTS');
  const onlyTask = catalog.filter(spec => spec.id.startsWith('T3'));
  const filtered = C.buildFindings(onlyTask, verdicts.filter(v => v.id.startsWith('T3')));
  assert.deepEqual(filtered.map(f => [f.id, f.status]), [['RC02-F1', 'NOT_RUN'], ['RC02-F2', 'NOT_RUN'], ['AGREEMENT-PATH', 'NOT_RUN']]);
  const controls = C.controlsSummary(catalog, verdicts);
  assert.equal(controls.length, 3);
  assert.ok(controls.every(control => control.detected && control.redUnderTheRealSiblingRegistration === null));
  const withRuns = C.controlsSummary(catalog, verdicts, goodRuns());
  assert.ok(withRuns.every(control => control.detected && control.redUnderTheRealSiblingRegistration === true));
  assert.deepEqual(withRuns.map(control => control.sibling), ['T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE', 'A1_SEND_FIRST_THEN_CANCEL_PHOTO', 'A1_SEND_FIRST_THEN_CANCEL_VOICE']);
  // a control whose scratch copy changed nothing is NOT red under the registration of the real function: the injected mutation is not what flipped the outcome
  const unchanged = goodRuns();
  unchanged.set('NC_A_INVERTED_CANCEL_VS_SEND_VOICE', {...goodRun(byId('A1_SEND_FIRST_THEN_CANCEL_VOICE')), id: 'NC_A_INVERTED_CANCEL_VS_SEND_VOICE', outcomes: {H: okOutcome(), SEND: okOutcome(), CANCELINV: okOutcome({receipt: {state: 'READY'}})}, final: {rows: 1, state: 'READY', attached: true, cancelled: false, messages: 1}});
  const mutationKilled = C.controlsSummary(catalog, verdicts, unchanged).find(control => control.id === 'NC_A_INVERTED_CANCEL_VS_SEND_VOICE');
  assert.equal(mutationKilled.redUnderTheRealSiblingRegistration, false);
  assert.equal(mutationKilled.detected, false);
  const blindHarness = verdicts.map(v => (v.id.startsWith('NC_A') ? {...v, observedClass: 'SERIALIZED', verdict: 'UNEXPECTED'} : v));
  assert.deepEqual(C.controlsSummary(catalog, blindHarness).filter(control => !control.detected).map(control => control.id), ['NC_A_INVERTED_CANCEL_VS_SEND_PHOTO', 'NC_A_INVERTED_CANCEL_VS_SEND_VOICE']);
  const orderNotTheCause = verdicts.map(v => (v.id.startsWith('PC1') ? {...v, observedClass: 'DEADLOCK', verdict: 'UNEXPECTED'} : v));
  assert.equal(C.controlsSummary(catalog, orderNotTheCause).find(control => control.type === 'POSITIVE').detected, false);
});

test('validateCatalog rejects malformed registrations', () => {
  const ctxs = {statements: STATEMENTS, gates: GATES};
  const clone = spec => JSON.parse(JSON.stringify(spec));
  const check = (spec, expected) => assert.ok(C.validateCatalog([spec], ctxs).some(line => line.startsWith(expected)), expected + ' for ' + JSON.stringify(C.validateCatalog([spec], ctxs)));
  const t1 = clone(byId('T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE'));
  check({...t1, gate: {key: 'nope'}}, 'UNKNOWN_GATE');
  check({...t1, first: {...t1.first, stmt: 'nope'}}, 'UNKNOWN_STATEMENT');
  check({...t1, second: {...t1.second, name: 'H'}}, 'BAD_SESSION_NAME');
  check({...t1, second: {...t1.second, name: t1.first.name}}, 'SAME_SESSION_NAME');
  check({...t1, secondBlockedBy: 'gate'}, 'DEADLOCK_NEEDS_TWO_QUEUED_CALLERS');
  check({...t1, expect: {...t1.expect, victim: 'NOBODY'}}, 'VICTIM_IS_NOT_A_SESSION');
  check({...t1, first: {...t1.first, deadlockMs: 20000}}, 'VICTIM_MUST_HAVE_THE_SHORTER_DEADLOCK_TIMEOUT');
  check({...t1, finding: undefined}, 'DEADLOCK_WITHOUT_FINDING_OR_CONTROL');
  check({...t1, expect: {...t1.expect, final: undefined}}, 'NO_FINAL_STATE_EXPECTATION');
  check({...t1, release: 'later'}, 'BAD_RELEASE');
  check({...t1, expect: {...t1.expect, class: 'MAYBE'}}, 'BAD_EXPECTED_CLASS');
  check({...t1, title: 'short'}, 'TITLE_TOO_SHORT');
  check({...t1, id: 'lower'}, 'BAD_ID');
  const t3 = clone(byId('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED'));
  check({...t3, first: {...t3.first, deadlockMs: 3000}}, 'SERIALIZED_SCENARIO_SETS_A_VICTIM_TIMEOUT');
  check({...t3, finding: 'RC02-F1'}, 'FINDING_WITHOUT_DEADLOCK');
  check({...t3, secondBlockedBy: 'nobody'}, 'BAD_SECOND_BLOCKED_BY');
  check({...t3, second: undefined}, 'SECOND_BLOCKED_BY_WITHOUT_SECOND');
  check({...t3, control: {type: 'NEGATIVE', mutation: 'x'}}, 'NEGATIVE_CONTROL_MUST_DEADLOCK');
  const nc = clone(byId('NC_A_INVERTED_CANCEL_VS_SEND_VOICE'));
  check({...nc, control: {type: 'POSITIVE', mutation: 'x'}}, 'POSITIVE_CONTROL_MUST_NOT_DEADLOCK');
  check({...nc, control: {type: 'SIDEWAYS', mutation: 'x'}}, 'BAD_CONTROL_TYPE');
  assert.ok(C.validateCatalog([t1, t1], ctxs).some(line => line.startsWith('DUPLICATE_ID')));
});

// ---- the admission of a finished report ------------------------------------------------------------------------------------------
const goodRuns = () => new Map(catalog.map(spec => [spec.id, goodRun(spec, {final: JSON.parse(JSON.stringify(spec.expect.final), (key, value) => (value && value.$oneOf ? value.$oneOf[0] : value))})]));
function goodReport() {
  const runs = goodRuns();
  const verdicts = catalog.map(spec => C.judge(spec, runs.get(spec.id)));
  const interleavings = catalog.map((spec, index) => ({id: spec.id, expectedClass: spec.expect.class, observedClass: verdicts[index].observedClass, victim: verdicts[index].victim,
    verdict: verdicts[index].verdict, problems: [], errors: verdicts[index].errors, edges: [{waiter: spec.first.name}, ...(spec.second ? [{waiter: spec.second.name}] : [])],
    ...(spec.expect.class === 'DEADLOCK' ? {deadlock: {edges: edgeTwo.edges}} : {})}));
  return {unit: C.UNIT, label: C.LABEL, sourceSha: SHA, result: 'PASS', failures: [], devAccess: false, providerCalls: 0, deviceProven: false, notProved: [...C.NOT_PROVED],
    chainFidelity: {verdict: 'DEV_FAITHFUL', checked: 42, equal: 42, converted: 7}, interleavings, controls: C.controlsSummary(catalog, verdicts, runs), findings: C.buildFindings(catalog, verdicts),
    contract: ['TASK_COMPLETE_UNSETTLED', 'TASK_STAGE_STALE_ATTEMPT'].map(id => ({id, verdict: 'PASS', observed: {status: 409, code: 'PT409', message: 'X'}})), scenarioErrors: []};
}

test('a complete report is admitted and says what it found', () => {
  const admitted = C.admitReport(goodReport(), {catalog, sourceSha: SHA});
  assert.equal(admitted.interleavings, catalog.length);
  assert.deepEqual(admitted.findings, ['RC02-F1:REPRODUCED', 'RC02-F2:REPRODUCED', 'AGREEMENT-PATH:NO_INVERSION_OBSERVED']);
});

test('every way a report can be incomplete or red is refused', () => {
  const refuse = (change, expected) => {
    const report = goodReport();
    change(report);
    assert.throws(() => C.admitReport(report, {catalog, sourceSha: SHA}), error => error.message.includes(expected), expected);
  };
  refuse(r => { r.unit = 'X'; }, 'UNIT');
  refuse(r => { r.label = 'EX-05 S02'; }, 'LABEL');
  refuse(r => { r.label = r.label.replace('NOT DEV', 'DEV'); }, 'LABEL');
  refuse(r => { r.sourceSha = 'b'.repeat(40); }, 'SOURCE_SHA');
  refuse(r => { r.result = 'FAIL'; }, 'RESULT_NOT_PASS');
  refuse(r => { r.failures = ['x']; }, 'FAILURES_PRESENT');
  refuse(r => { r.devAccess = true; }, 'ACCESS_FLAGS');
  refuse(r => { r.providerCalls = 1; }, 'ACCESS_FLAGS');
  refuse(r => { r.notProved = []; }, 'NOT_PROVED_MISSING');
  refuse(r => { r.chainFidelity.verdict = 'NOT_DEV_FAITHFUL'; }, 'CHAIN_NOT_DEV_FAITHFUL');
  refuse(r => { r.contract = []; }, 'PT409_CONTRACT');
  refuse(r => { r.contract[0].observed.code = '40001'; }, 'PT409_CONTRACT');
  refuse(r => { r.contract[0].observed.status = 500; }, 'PT409_CONTRACT');
  refuse(r => { r.contract[1].verdict = 'FAIL'; }, 'PT409_CONTRACT');
  refuse(r => { r.interleavings.pop(); }, 'MISSING_INTERLEAVING');
  refuse(r => { r.interleavings[0].verdict = 'UNEXPECTED'; }, 'NOT_AS_EXPECTED');
  refuse(r => { r.interleavings[4].observedClass = 'DEADLOCK'; }, 'CLASS:');
  refuse(r => { r.interleavings[4].edges = []; }, 'NO_OBSERVED_WAITS');
  refuse(r => { r.interleavings[4].errors = {SEND: '40001:MEDIA_COMMAND_CONFLICT'}; }, 'SQLSTATE_40001');
  refuse(r => { delete r.interleavings[0].deadlock; }, 'DEADLOCK_WITHOUT_EDGES');
  refuse(r => { r.controls[1].detected = false; }, 'CONTROLS');
  refuse(r => { r.controls[1].redUnderTheRealSiblingRegistration = null; }, 'CONTROLS');
  refuse(r => { r.controls[2].redUnderTheRealSiblingRegistration = false; }, 'CONTROLS');
  refuse(r => { r.controls.pop(); }, 'CONTROLS');
  refuse(r => { r.findings = []; }, 'FINDINGS');
  refuse(r => { r.scenarioErrors = ['x']; }, 'SCENARIO_ERRORS');
});

test('a filtered run is admitted for the filtered scenarios only and then needs no controls or findings', () => {
  const report = goodReport();
  const only = ['T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED'];
  report.interleavings = report.interleavings.filter(item => only.includes(item.id));
  report.controls = [];
  report.findings = [];
  assert.equal(C.admitReport(report, {catalog, sourceSha: SHA, filter: only}).interleavings, 1);
  assert.throws(() => C.admitReport(report, {catalog, sourceSha: SHA}), /MISSING_INTERLEAVING/);
});

test('the markdown summary leads with the label and the findings, and lists every interleaving', () => {
  const text = C.renderMarkdown(goodReport());
  assert.ok(text.startsWith('## EX-05 S02 / RC-02: lock-order proof on a DISPOSABLE CHAIN'));
  assert.ok(text.indexOf('### Findings') < text.indexOf('### Interleavings'));
  assert.ok(text.includes('RC02-F1: REPRODUCED'));
  for (const spec of catalog) assert.ok(text.includes('| ' + spec.id + ' |'), spec.id);
  assert.ok(text.includes('### Not proved'));
  assert.ok(/^[\x09\x0a\x20-\x7e]+$/.test(text));
});

test('a partial run (pin gate only, or filtered) never reads as the full proof: notice, result label and first markdown line', () => {
  const full = goodReport();
  assert.equal(C.partialNotice(full), null);
  assert.equal(C.resultLabel(full), 'PASS');
  assert.ok(!C.renderMarkdown(full).includes('PARTIAL RUN'));
  const pinGate = {...full, pinGateOnly: true, filter: []};
  assert.match(C.partialNotice(pinGate), /^PARTIAL RUN \(pin gate only\).*NOT the proof\.$/);
  assert.equal(C.resultLabel(pinGate), 'PASS_PARTIAL');
  assert.equal(C.resultLabel({...pinGate, result: 'FAIL'}), 'FAIL_PARTIAL');
  const filtered = {...full, filter: ['T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED', 'T4_CANCEL_FIRST_THEN_COMPLETE_RETRY_SERIALIZED']};
  assert.match(C.partialNotice(filtered), /^PARTIAL RUN \(EX05_ONLY=T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED,T4_CANCEL_FIRST_THEN_COMPLETE_RETRY_SERIALIZED\)/);
  assert.equal(C.resultLabel(filtered), 'PASS_PARTIAL');
  for (const partial of [pinGate, filtered]) {
    const text = C.renderMarkdown(partial);
    assert.ok(text.startsWith('**PARTIAL RUN ('), 'the notice is the very first line');
    assert.ok(text.includes('RESULT PASS_PARTIAL.'));
    assert.ok(text.indexOf('PARTIAL RUN') < text.indexOf('## EX-05 S02'));
    assert.ok(/^[\x09\x0a\x20-\x7e]+$/.test(text));
  }
  assert.equal(C.resultLabel({}), 'UNKNOWN');
  assert.equal(C.partialNotice(undefined), null);
});

test('the label and the not-proved list say what the run is and is not', () => {
  assert.ok(C.LABEL.includes('DISPOSABLE CHAIN') && C.LABEL.includes('NOT DEV') && C.LABEL.includes('NOT a device'));
  assert.ok(C.NOT_PROVED.some(line => line.includes('canonical DEV')));
  assert.ok(C.NOT_PROVED.some(line => line.includes('closure erasure')));
  assert.ok(C.NOT_PROVED.some(line => line.includes('A fix')));
  assert.ok(Object.values(KINDS).length === 2);
});

// ---- pins ------------------------------------------------------------------------------------------------------------------------
test('the committed pins are valid and complete for what the analysis relies on', () => {
  const pins = loadPins();
  assert.equal(Object.keys(pins.functions).length, 42);
  assert.equal(Object.keys(pins.triggers).length, 11);
  assert.equal(pins.census.writers.length, 14);
  for (const sig of ['public.rpc_cancel_media_upload(uuid,uuid)', 'public.rpc_remove_task_photo(uuid,uuid)', 'public.rpc_complete_media_upload_service(uuid,uuid,text)', 'private.media_assert_task_edit(uuid,uuid)',
    'private.closure_assert_open(uuid,uuid)', 'private.agreement_voice_context_v1(uuid,uuid,integer,boolean)', 'private.agreement_photo_context_v5(uuid,uuid,integer,boolean)']) assert.equal(pins.functions[sig].core, true, sig);
  assert.equal(b24Targets(pins).length, 7);
  assert.equal(pins.devRead.ledgerCount, 221);
  assert.equal(pins.devRead.certifiedDigest, '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431');
  const text = readFileSync('supabase/proofs/ex05/ex05_s02_pins.json', 'utf8');
  assert.ok(!text.includes('\r') && /^[\x09\x0a\x20-\x7e]+$/.test(text));
  const broken = JSON.parse(text);
  broken.functions['public.rpc_cancel_media_upload(uuid,uuid)'].md5 = 'xyz';
  assert.throws(() => loadPins(JSON.stringify(broken)), /PINS_INVALID:MD5/);
  broken.functions['public.rpc_cancel_media_upload(uuid,uuid)'].md5 = '0'.repeat(32);
  broken.functions['public.rpc_cancel_media_upload(uuid,uuid)'].preB24Md5 = '0'.repeat(32);
  assert.throws(() => loadPins(JSON.stringify(broken)), /PINS_INVALID:PRE_B24/);
});

test('the pin classification and the fidelity verdict', () => {
  const pins = loadPins();
  const equal = sig => ({md5: pins.functions[sig].md5, secdef: pins.functions[sig].secdef !== false, config: 'search_path=pg_catalog'});
  const sigs = Object.keys(pins.functions);
  const classify = (override = {}) => sigs.map(sig => classifyFunction(sig, pins.functions[sig], sig in override ? override[sig] : equal(sig)));
  const triggers = (override = {}) => Object.entries(pins.triggers).map(([name, pin]) => classifyTrigger(name, pin, name in override ? override[name] : pin.md5));
  const census = censusDiff(pins.census.writers, pins.census.writers);
  const converted = b24Targets(pins).map(item => ({sig: item.sig, sites: 1, md5After: item.devMd5}));
  const cancel = 'public.rpc_cancel_media_upload(uuid,uuid)';
  const before = classify(Object.fromEntries(b24Targets(pins).map(item => [item.sig, {md5: item.preMd5, secdef: true, config: 'search_path=pg_catalog'}])));
  assert.equal(before.filter(item => item.status === 'EXPECTED_PRE_B24').length, 7);
  const base = {pins, before, after: classify(), triggers: triggers(), census, converted, certificate: {unchangedByConversion: true}, remaining40001: []};
  const good = fidelityVerdict(base);
  assert.equal(good.verdict, 'DEV_FAITHFUL');
  assert.equal(good.equal, 42);
  assert.equal(good.expectedPreB24, 7);
  assert.equal(good.triggersEqual, 11);
  // a core body that differs, a missing one, a context difference, metadata
  const differentCore = fidelityVerdict({...base, after: classify({[cancel]: {md5: '0'.repeat(32), secdef: true, config: 'search_path=pg_catalog'}})});
  assert.equal(differentCore.verdict, 'NOT_DEV_FAITHFUL');
  assert.ok(differentCore.problems.includes('DIFFERENT:' + cancel));
  assert.equal(fidelityVerdict({...base, after: classify({[cancel]: null})}).problems[0], 'MISSING:' + cancel);
  const contextSig = 'private.closure_guard_owned_write()';
  assert.equal(pins.functions[contextSig].core, false);
  const context = fidelityVerdict({...base, after: classify({[contextSig]: {md5: '1'.repeat(32), secdef: true, config: 'search_path=pg_catalog'}})});
  assert.equal(context.verdict, 'DEV_FAITHFUL');
  assert.deepEqual(context.warnings, ['DIFFERENT:' + contextSig]);
  assert.ok(fidelityVerdict({...base, after: classify({[cancel]: {...equal(cancel), secdef: false}})}).problems.includes('METADATA_DIFFERENT:' + cancel));
  assert.equal(classifyFunction('private.closure_account_key(uuid)', pins.functions['private.closure_account_key(uuid)'], {md5: pins.functions['private.closure_account_key(uuid)'].md5, secdef: false, config: 'search_path=pg_catalog'}).metadata, 'EQUAL');
  // conversion, triggers, census, certificate, 40001
  assert.ok(fidelityVerdict({...base, converted: converted.slice(1)}).problems.some(line => line.startsWith('CONVERSION_NOT_EQUAL_TO_DEV:')));
  assert.ok(fidelityVerdict({...base, converted: converted.map((entry, index) => (index ? entry : {...entry, md5After: '2'.repeat(32)}))}).problems.some(line => line.startsWith('CONVERTED_BODY_DIFFERS_FROM_DEV:')));
  const coreTrigger = 'private.agreement_voice_uploads_v1.agreement_voice_asset_guard_v1';
  assert.ok(fidelityVerdict({...base, triggers: triggers({[coreTrigger]: '3'.repeat(32)})}).problems.includes('TRIGGER_DIFFERENT:' + coreTrigger));
  assert.ok(fidelityVerdict({...base, triggers: triggers({[coreTrigger]: null})}).problems.includes('TRIGGER_MISSING:' + coreTrigger));
  const contextTrigger = 'public.agreement_messages.pre_v3_safety_message';
  const softer = fidelityVerdict({...base, triggers: triggers({[contextTrigger]: '4'.repeat(32)})});
  assert.equal(softer.verdict, 'DEV_FAITHFUL');
  assert.deepEqual(softer.warnings, ['TRIGGER_DIFFERENT:' + contextTrigger]);
  assert.ok(fidelityVerdict({...base, census: censusDiff([...pins.census.writers, 'public.rpc_expire_media'], pins.census.writers)}).problems.some(line => line.startsWith('CENSUS_DIFFERS')));
  assert.deepEqual(censusDiff(pins.census.writers.slice(1), pins.census.writers).missingOnChain, [pins.census.writers[0]]);
  assert.ok(fidelityVerdict({...base, certificate: {unchangedByConversion: false}}).problems.includes('CERTIFICATE_MOVED_BY_THE_CONVERSION'));
  assert.ok(fidelityVerdict({...base, remaining40001: ['public.rpc_cancel_media_upload(uuid,uuid)']}).problems.some(line => line.startsWith('SQLSTATE_40001_LEFT_IN')));
});

test('a registered deadlock must be a cycle between the two callers themselves, not between other processes', () => {
  const spec = byId('T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE');
  const run = goodRun(spec);
  run.outcomes.REMOVE = failOutcome('40P01', 'deadlock detected', {edges: [{waiterPid: 11, mode: 'ShareLock', on: 'transaction 5', holderPid: 12}, {waiterPid: 12, mode: 'ShareLock', on: 'transaction 6', holderPid: 11}]});
  assert.deepEqual(C.judge(spec, {...run, pids: {H: 10, REMOVE: 11, CANCEL: 12}}).problems, []);
  assert.deepEqual(C.judge(spec, {...run, pids: {H: 10, REMOVE: 12, CANCEL: 11}}).problems, []);
  assert.ok(C.judge(spec, {...run, pids: {H: 10, REMOVE: 11, CANCEL: 99}}).problems.includes('DEADLOCK_CYCLE_IS_NOT_BETWEEN_THE_TWO_CALLERS'));
  assert.ok(C.judge(spec, {...run, pids: {H: 10, REMOVE: 98, CANCEL: 99}}).problems.includes('DEADLOCK_CYCLE_IS_NOT_BETWEEN_THE_TWO_CALLERS'));
});
