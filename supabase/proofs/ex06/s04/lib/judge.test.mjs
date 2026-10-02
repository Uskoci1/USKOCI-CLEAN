// EX-06 S04: offline tests of the verdict mechanics (no database): what counts as "reached", the expected wave, the verdict of a worker case, a check and a probe, the result and the exit code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedWaves, exitCodeOf, judgeCase, resultLine, resultOf, row, scopeSentence, sortedUnique, summarize, visibleInInbox, workerFacts} from './judge.mjs';

const n = (channel, state, suppressionReason = null) => ({channel, state, suppressionReason});
const reachedWorker = {deliveries: [{round: 1, status: 'READY'}], events: [{id: 'e1'}], notifications: [n('IN_APP', 'CREATED'), n('PUSH', 'SUPPRESSED', 'PUSH_OFF')], cause: {observed: true}};
const blockedWorker = {deliveries: [{round: 1, status: 'READY'}], events: [{id: 'e2'}], notifications: [n('IN_APP', 'SUPPRESSED', 'ACCOUNT_BLOCKED'), n('PUSH', 'SUPPRESSED', 'ACCOUNT_BLOCKED')], cause: {observed: true}};
const untouchedWorker = {deliveries: [], events: [], notifications: [], cause: {observed: true}};

test('sortedUnique and row compare structurally', () => {
  assert.deepEqual(sortedUnique(['b', 'a', 'b']), ['a', 'b']);
  assert.deepEqual(row('x', [1, 2], [1, 2]), {field: 'x', expected: [1, 2], actual: [1, 2], ok: true});
  assert.equal(row('x', true, false).ok, false);
});

test('a notification is visible in the Inbox when its IN_APP row is not SUPPRESSED (the rule of rpc_list_inbox)', () => {
  assert.equal(visibleInInbox([n('IN_APP', 'CREATED')]), true);
  assert.equal(visibleInInbox([n('IN_APP', 'EXPIRED')]), true, 'an EXPIRED row is still listed');
  assert.equal(visibleInInbox([n('IN_APP', 'SUPPRESSED', 'CATEGORY_OFF')]), false);
  assert.equal(visibleInInbox([n('PUSH', 'CREATED')]), false, 'a push row is not the Inbox');
  assert.equal(visibleInInbox([]), false);
  assert.equal(visibleInInbox(undefined), false);
});

test('workerFacts: delivered, reached (an event the person can see) and the suppression reasons', () => {
  const a = workerFacts(reachedWorker);
  assert.deepEqual([a.delivered, a.reached, a.visible, a.events, a.deliveryRows], [true, true, true, 1, 1]);
  assert.deepEqual(a.inApp, ['CREATED']);
  assert.deepEqual(a.push, ['SUPPRESSED:PUSH_OFF']);
  const b = workerFacts(blockedWorker);
  assert.deepEqual([b.delivered, b.reached, b.visible], [true, false, false]);
  assert.deepEqual(b.suppressionReasons, ['ACCOUNT_BLOCKED']);
  const c = workerFacts(untouchedWorker);
  assert.deepEqual([c.delivered, c.reached, c.events], [false, false, 0]);
  assert.deepEqual(workerFacts(null), workerFacts(undefined));
  // an event without a visible IN_APP row is not "reached" even if the event exists
  assert.equal(workerFacts({deliveries: [], events: [{id: 'x'}], notifications: [n('PUSH', 'CREATED')]}).reached, false);
});

test('expectedWaves: best score first, ties by profile id, chunked by the configured sizes', () => {
  const eligible = [{profileId: 'b', score: 90}, {profileId: 'a', score: 90}, {profileId: 'c', score: 99.8}, {profileId: 'd', score: 80}, {profileId: 'e', score: 70}];
  assert.deepEqual(expectedWaves(eligible, [2, 2, 10]), [['c', 'a'], ['b', 'd'], ['e']]);
  assert.deepEqual(expectedWaves(eligible, [5]), [['c', 'a', 'b', 'd', 'e']]);
  assert.deepEqual(expectedWaves([], [5, 5]), []);
  assert.deepEqual(expectedWaves(eligible, [1]), [['c']], 'the waves stop where the configured sizes stop');
});

const workerCase = {id: 'R-test', kind: 'WORKER', scenario: 'reach', worker: 'w', title: 't', requirement: 'r', cause: {text: 'named cause'}, expect: {delivered: false, reached: false}, findingId: 'F5'};
const scenariosWith = obs => ({reach: {status: 'OK', obs: {workers: {w: obs}}}});

test('a worker case PASSES when the expectation holds and the named cause was observed', () => {
  const result = judgeCase(workerCase, scenariosWith(untouchedWorker));
  assert.equal(result.verdict, 'PASS');
  assert.deepEqual(result.rows.map(item => item.ok), [true, true, true]);
  assert.equal(result.rows[0].kind, 'PRECONDITION');
});

test('a worker case is a FINDING when the product reaches the worker, and carries the finding id and the failing rows', () => {
  const result = judgeCase(workerCase, scenariosWith(reachedWorker));
  assert.equal(result.verdict, 'FINDING');
  assert.equal(result.findingId, 'F5');
  assert.deepEqual(result.failed.map(item => item.field), ['delivered', 'reached']);
  assert.equal(result.actualFacts.reached, true);
});

test('a worker case whose named cause was NOT observed is a HARNESS_ERROR, never a pass: a negative without its cause proves nothing', () => {
  const result = judgeCase(workerCase, scenariosWith({...untouchedWorker, cause: {observed: false, detail: 'the block row is missing'}}));
  assert.equal(result.verdict, 'HARNESS_ERROR');
  assert.match(result.reason, /named cause was not observed/);
});

test('a control that is not reached is a HARNESS_ERROR (the pipeline delivers nothing: every negative would pass vacuously)', () => {
  const control = {id: 'R00', kind: 'WORKER', scenario: 'reach', worker: 'w', title: 'c', requirement: 'r', control: true, expect: {delivered: true, reached: true}};
  assert.equal(judgeCase(control, scenariosWith(reachedWorker)).verdict, 'PASS');
  const broken = judgeCase(control, scenariosWith(untouchedWorker));
  assert.equal(broken.verdict, 'HARNESS_ERROR');
  assert.match(broken.reason, /control/);
});

test('a documented product contract is DOCUMENTED, not a finding, and only when the actual values equal the documented ones', () => {
  const documented = {id: 'C01', kind: 'WORKER', scenario: 'reach', worker: 'w', title: 't', requirement: 'r', cause: {text: 'cap'}, expect: {delivered: false},
    documented: {text: 'capacity is enforced when applying (owner-visible split)', expect: {delivered: true}}};
  assert.equal(judgeCase(documented, scenariosWith(untouchedWorker)).verdict, 'PASS');
  const doc = judgeCase(documented, scenariosWith(reachedWorker));
  assert.equal(doc.verdict, 'DOCUMENTED');
  assert.match(doc.documented, /owner-visible split/);
  const strict = {...documented, documented: {text: 'x', expect: {delivered: true, reached: false}}};
  assert.equal(judgeCase(strict, scenariosWith(reachedWorker)).verdict, 'FINDING', 'reached is true, so the documented contract does not hold');
});

test('a case of a scenario that did not run is NOT_RUN with the scenario error', () => {
  const result = judgeCase(workerCase, {reach: {status: 'HARNESS_ERROR', error: 'FIXTURE_NOT_APPLIED:status'}});
  assert.equal(result.verdict, 'NOT_RUN');
  assert.match(result.reason, /FIXTURE_NOT_APPLIED:status/);
  assert.equal(judgeCase(workerCase, {}).verdict, 'NOT_RUN');
  assert.equal(judgeCase(workerCase, scenariosWith(undefined)).verdict, 'NOT_RUN', 'the worker is missing from the observation');
});

test('a CHECK case is PASS when every row is ok and FINDING otherwise (with the failing rows)', () => {
  const check = {id: 'W-test', kind: 'CHECK', scenario: 'waves', title: 't', requirement: 'r', findingId: null, evaluate: obs => [row('size', 5, obs.size), row('twice', 0, obs.twice)]};
  assert.equal(judgeCase(check, {waves: {status: 'OK', obs: {size: 5, twice: 0}}}).verdict, 'PASS');
  const bad = judgeCase(check, {waves: {status: 'OK', obs: {size: 6, twice: 0}}});
  assert.equal(bad.verdict, 'FINDING');
  assert.deepEqual(bad.failed.map(item => item.field), ['size']);
  // an evaluator that throws on a malformed observation is a HARNESS_ERROR, not a pass
  const broken = judgeCase({...check, evaluate: () => { throw new Error('obs.x is undefined'); }}, {waves: {status: 'OK', obs: {}}});
  assert.equal(broken.verdict, 'HARNESS_ERROR');
  assert.match(broken.reason, /obs\.x is undefined/);
  // a check with no rows at all proves nothing
  assert.equal(judgeCase({...check, evaluate: () => []}, {waves: {status: 'OK', obs: {}}}).verdict, 'HARNESS_ERROR');
});

test('a CHECK row marked as a PRECONDITION that fails is a HARNESS_ERROR (the scenario did not build what the check needs), not a FINDING', () => {
  const check = {id: 'T-pre', kind: 'CHECK', scenario: 'waves', title: 't', requirement: 'r', evaluate: obs => [row('precondition: three workers were reached', 3, obs.reached, {kind: 'PRECONDITION'}), row('nothing is pending', 0, obs.pending)]};
  assert.equal(judgeCase(check, {waves: {status: 'OK', obs: {reached: 3, pending: 0}}}).verdict, 'PASS');
  const finding = judgeCase(check, {waves: {status: 'OK', obs: {reached: 3, pending: 2}}});
  assert.equal(finding.verdict, 'FINDING');
  assert.deepEqual(finding.failed.map(item => item.field), ['nothing is pending']);
  const broken = judgeCase(check, {waves: {status: 'OK', obs: {reached: 0, pending: 0}}});
  assert.equal(broken.verdict, 'HARNESS_ERROR');
  assert.match(broken.reason, /precondition failed: precondition: three workers were reached/);
});

test('a PROBE returns CONFIRMED, REFUTED or NOT_REACHED with the requirement verdict', () => {
  const probe = {id: 'PX', kind: 'PROBE', scenario: 'ticks', title: 't', inference: 'i', requirement: 'r', findingId: 'F11', decide: obs => ({result: obs.seen ? 'CONFIRMED' : 'REFUTED', requirement: obs.seen ? 'NOT_MET' : 'MET', rows: [row('seen', true, obs.seen)], note: 'n'})};
  const confirmed = judgeCase(probe, {ticks: {status: 'OK', obs: {seen: true}}});
  assert.deepEqual([confirmed.verdict, confirmed.requirement, confirmed.findingId], ['CONFIRMED', 'NOT_MET', 'F11']);
  const refuted = judgeCase(probe, {ticks: {status: 'OK', obs: {seen: false}}});
  assert.deepEqual([refuted.verdict, refuted.requirement, refuted.findingId], ['REFUTED', 'MET', null], 'no finding id when the requirement is met');
  const unreached = judgeCase({...probe, decide: () => ({result: 'NOT_REACHED', requirement: 'NOT_APPLICABLE', rows: [], note: 'the chain cannot reach it'})}, {ticks: {status: 'OK', obs: {}}});
  assert.equal(unreached.verdict, 'NOT_REACHED');
  assert.equal(judgeCase(probe, {ticks: {status: 'HARNESS_ERROR', error: 'boom'}}).verdict, 'NOT_RUN');
  const malformed = judgeCase({...probe, decide: () => ({result: 'MAYBE', requirement: 'MET', rows: []})}, {ticks: {status: 'OK', obs: {}}});
  assert.equal(malformed.verdict, 'HARNESS_ERROR', 'a probe may only answer CONFIRMED, REFUTED or NOT_REACHED');
});

test('a probe may read several scenarios', () => {
  const probe = {id: 'PE', kind: 'PROBE', scenario: 'a', scenarios: ['a', 'b'], title: 't', inference: 'i', requirement: 'r', decide: obs => ({result: 'CONFIRMED', requirement: 'MET', rows: [row('both', 2, Object.keys(obs).length)]})};
  const ok = judgeCase(probe, {a: {status: 'OK', obs: {x: 1}}, b: {status: 'OK', obs: {y: 2}}});
  assert.equal(ok.verdict, 'CONFIRMED');
  const partial = judgeCase(probe, {a: {status: 'OK', obs: {x: 1}}, b: {status: 'HARNESS_ERROR', error: 'e'}});
  assert.equal(partial.verdict, 'NOT_RUN');
});

const results = [
  {id: 'A', kind: 'WORKER', verdict: 'PASS'}, {id: 'B', kind: 'WORKER', verdict: 'FINDING', findingId: 'F5'}, {id: 'C', kind: 'CHECK', verdict: 'DOCUMENTED'},
  {id: 'D', kind: 'CHECK', verdict: 'NOT_RUN'}, {id: 'E', kind: 'PROBE', verdict: 'CONFIRMED', requirement: 'NOT_MET', findingId: 'F9'}, {id: 'F', kind: 'PROBE', verdict: 'REFUTED', requirement: 'MET'},
  {id: 'G', kind: 'PROBE', verdict: 'NOT_REACHED', requirement: 'NOT_APPLICABLE'},
];

test('summarize counts every verdict and lists the findings (cases that are FINDING, probes whose requirement is NOT_MET)', () => {
  const summary = summarize(results, {harnessErrors: [], scenarios: [{id: 's', status: 'OK'}], chain: {verdict: 'EQUAL'}});
  assert.deepEqual(summary.cases, {total: 4, PASS: 1, FINDING: 1, DOCUMENTED: 1, NOT_RUN: 1, HARNESS_ERROR: 0});
  assert.deepEqual(summary.probes, {total: 3, CONFIRMED: 1, REFUTED: 1, NOT_REACHED: 1, NOT_RUN: 0, HARNESS_ERROR: 0, requirementNotMet: 1});
  assert.deepEqual(summary.findingIds, ['F5', 'F9']);
  assert.equal(summary.notRun, 1);
});

test('the result: HARNESS_BROKEN > CHAIN_DIFFERS > FINDINGS > PASS, and a case or scenario that did not run is never a silent pass', () => {
  const base = {harnessErrors: [], scenarios: [{id: 's', status: 'OK'}], chain: {verdict: 'EQUAL'}};
  const decided = results.filter(item => item.verdict !== 'NOT_RUN');
  assert.equal(resultOf(summarize([{id: 'A', kind: 'WORKER', verdict: 'PASS'}], base)), 'PASS');
  assert.equal(resultOf(summarize(decided, base)), 'FINDINGS');
  assert.equal(resultOf(summarize(decided, {...base, chain: {verdict: 'DIFFERS'}})), 'CHAIN_DIFFERS');
  assert.equal(resultOf(summarize(decided, {...base, chain: {verdict: 'DIFFERS_SUPPORTING_ONLY'}})), 'FINDINGS', 'report mode: supporting differences are loud elsewhere but do not change the result');
  assert.equal(resultOf(summarize(decided, {...base, harnessErrors: [{where: 'x', message: 'y'}], chain: {verdict: 'DIFFERS'}})), 'HARNESS_BROKEN');
  assert.equal(resultOf(summarize(decided, {...base, scenarios: [{id: 's', status: 'HARNESS_ERROR'}]})), 'HARNESS_BROKEN');
  assert.equal(resultOf(summarize([{id: 'A', kind: 'WORKER', verdict: 'HARNESS_ERROR'}], base)), 'HARNESS_BROKEN');
  assert.equal(resultOf(summarize([{id: 'A', kind: 'WORKER', verdict: 'PASS'}, {id: 'B', kind: 'WORKER', verdict: 'NOT_RUN'}], base)), 'HARNESS_BROKEN', 'a case that did not run without a scenario error is a harness problem');
  assert.equal(resultOf(summarize([{id: 'A', kind: 'WORKER', verdict: 'PASS'}, {id: 'P', kind: 'PROBE', verdict: 'NOT_REACHED', requirement: 'NOT_APPLICABLE'}], base)), 'PASS', 'a probe the chain cannot reach is reported, it is not a failure');
});

test('an OPTIONAL scenario (one that rests on a fixture path no CI run has proved yet) that fails makes the result PARTIAL, not HARNESS_BROKEN; a required one still breaks the harness', () => {
  const decided = results.filter(item => item.verdict !== 'NOT_RUN');
  const withScenario = (id, verdict, extra = {}) => ({id, kind: 'CHECK', scenario: 'opt', scenarios: ['opt'], verdict, ...extra});
  const base = {harnessErrors: [], chain: {verdict: 'EQUAL'}};
  const optionalFailed = {...base, scenarios: [{id: 's', status: 'OK'}, {id: 'opt', status: 'HARNESS_ERROR', optional: true}]};
  const summary = summarize([...decided, withScenario('X1', 'NOT_RUN', {reason: 'the scenario opt did not run'})], optionalFailed);
  assert.deepEqual(summary.optionalFailed, ['opt']);
  assert.equal(summary.notRunBlocking, 0, 'the case of the optional scenario is expected NOT_RUN');
  assert.equal(resultOf(summary), 'PARTIAL');
  assert.equal(resultOf(summarize([{id: 'A', kind: 'WORKER', verdict: 'PASS'}, withScenario('X1', 'NOT_RUN')], optionalFailed)), 'PARTIAL', 'PARTIAL wins over PASS and over FINDINGS');
  // a NOT_RUN case of a scenario that is NOT optional stays blocking
  const stray = summarize([{id: 'A', kind: 'WORKER', verdict: 'PASS'}, {id: 'B', kind: 'WORKER', scenario: 's', scenarios: ['s'], verdict: 'NOT_RUN'}], {...base, scenarios: [{id: 's', status: 'OK'}]});
  assert.equal(resultOf(stray), 'HARNESS_BROKEN');
  // a required scenario that fails is HARNESS_BROKEN even next to a failed optional one
  const both = summarize([withScenario('X1', 'NOT_RUN')], {...base, scenarios: [{id: 's', status: 'HARNESS_ERROR'}, {id: 'opt', status: 'HARNESS_ERROR', optional: true}]});
  assert.equal(resultOf(both), 'HARNESS_BROKEN');
  // a chain that differs outranks PARTIAL
  assert.equal(resultOf(summarize([{id: 'A', kind: 'WORKER', verdict: 'PASS'}], {...optionalFailed, chain: {verdict: 'DIFFERS'}})), 'CHAIN_DIFFERS');
  assert.equal(exitCodeOf('PARTIAL'), 0);
});

test('exit codes: 0 for PASS and FINDINGS, 2 for FINDINGS under strict findings, 1 for a broken harness or a chain that differs (strict)', () => {
  assert.equal(exitCodeOf('PASS'), 0);
  assert.equal(exitCodeOf('FINDINGS'), 0);
  assert.equal(exitCodeOf('FINDINGS', {strictFindings: true}), 2);
  assert.equal(exitCodeOf('HARNESS_BROKEN'), 1);
  assert.equal(exitCodeOf('CHAIN_DIFFERS'), 1);
  assert.equal(exitCodeOf('PASS', {strictFindings: true}), 0);
});

test('the scope sentence and the RESULT line carry the counts a result is never quoted without', () => {
  const summary = summarize(results, {harnessErrors: [], scenarios: [{id: 's', status: 'OK'}, {id: 't', status: 'OK'}], chain: {verdict: 'EQUAL'}});
  const text = scopeSentence(summary, 'FINDINGS');
  assert.match(text, /^FINDINGS on 3 of 4 cases decided/);
  assert.match(text, /2 findings \(F5, F9\)/);
  assert.match(text, /probes: 1 confirmed, 1 refuted, 1 not reached/);
  const line = resultLine({result: 'FINDINGS', summary, chainVerdict: 'EQUAL', auth: {accountsCreated: 12, retries: 0}});
  assert.match(line, /^RESULT FINDINGS \| chain EQUAL \| /);
  assert.match(line, /scenarios 2\/2 ok/);
  assert.match(line, /accounts 12/);
  assert.ok(!line.includes('\n'));
});
