// EX05-S01 offline unit tests of the pure check runner and the result expectations. No database, no network, no environment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRunner, sanitizeMessage, describeResult, expectErrorResult, expectConflictResult, CONFLICT_CODE, MAX_MESSAGE,
} from './runner.mjs';

const silent = () => undefined;
const make = () => createRunner({unit: 'UNIT_TEST', print: silent, printError: silent});

test('a passing check is recorded as PASS and the unit passes only when nothing failed or was skipped', async () => {
  const run = make();
  await run.check('A', async () => undefined);
  const summary = run.summary();
  assert.equal(summary.result, 'PASS');
  assert.deepEqual(summary.checks, [{name: 'A', result: 'PASS', kind: 'BEHAVIOUR'}]);
  assert.equal(summary.passed, 1); assert.equal(summary.failed, 0); assert.equal(summary.skipped, 0);
});

test('every check runs even after an earlier one failed, and the failure is listed with its name', async () => {
  const run = make();
  await run.check('FIRST', async () => { throw new Error('first broke'); });
  await run.check('SECOND', async () => undefined);
  const summary = run.summary();
  assert.equal(summary.result, 'FAIL');
  assert.equal(summary.passed, 1); assert.equal(summary.failed, 1);
  assert.deepEqual(summary.failures, [{name: 'FIRST', message: 'first broke'}]);
});

test('a check that requires a failed or skipped check is SKIPPED with the reason, and the unit still fails', async () => {
  const run = make();
  await run.check('FIXTURE', async () => { throw new Error('no fixture'); });
  await run.check('DEPENDENT', async () => { throw new Error('must not run'); }, {requires: ['FIXTURE']});
  await run.check('CHAINED', async () => { throw new Error('must not run'); }, {requires: ['DEPENDENT']});
  const summary = run.summary();
  assert.equal(summary.result, 'FAIL');
  assert.deepEqual(summary.checks.map(c => [c.name, c.result]), [['FIXTURE', 'FAIL'], ['DEPENDENT', 'SKIPPED'], ['CHAINED', 'SKIPPED']]);
  assert.match(summary.checks[1].reason, /requires FIXTURE/);
  assert.equal(summary.skipped, 2);
});

test('requiring an unknown check is a harness error, not a silent pass', async () => {
  const run = make();
  await assert.rejects(() => run.check('X', async () => undefined, {requires: ['NEVER_DECLARED']}), /UNKNOWN_REQUIRED_CHECK/);
});

test('a duplicate check name is refused', async () => {
  const run = make();
  await run.check('SAME', async () => undefined);
  await assert.rejects(() => run.check('SAME', async () => undefined), /DUPLICATE_CHECK_NAME/);
});

test('a unit with no passing check never reports PASS', () => {
  assert.equal(make().summary().result, 'FAIL');
});

test('characterize stores the observation and the classifier finding, and a thrown error is a harness FAIL', async () => {
  const run = make();
  await run.characterize('OBS', async () => ({kind: 'UNAVAILABLE'}), {classify: observation => 'FINDING_' + observation.kind});
  await run.characterize('BROKEN', async () => { throw new Error('harness down'); });
  const summary = run.summary();
  assert.deepEqual(summary.observations.OBS, {observation: {kind: 'UNAVAILABLE'}, finding: 'FINDING_UNAVAILABLE'});
  assert.equal(summary.checks.find(c => c.name === 'OBS').result, 'RECORDED');
  assert.equal(summary.checks.find(c => c.name === 'BROKEN').result, 'FAIL');
  assert.equal(summary.result, 'FAIL');
});

test('a classifier that reports an UNEXPECTED finding turns the recorded check into a FAIL', async () => {
  const run = make();
  await run.characterize('ODD', async () => ({x: 1}), {classify: () => 'UNEXPECTED_SHAPE', failOn: ['UNEXPECTED_SHAPE']});
  assert.equal(run.summary().checks[0].result, 'FAIL');
  assert.match(run.summary().failures[0].message, /UNEXPECTED_SHAPE/);
});

test('failure messages are truncated and never carry a JWT or a Supabase key', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz0123456789';
  const text = sanitizeMessage(new Error('token ' + jwt + ' key sb_secret_abcdefghijklmnop and ' + 'x'.repeat(2000)));
  assert.ok(text.length <= MAX_MESSAGE);
  assert.ok(!text.includes('eyJhbGci')); assert.ok(!text.includes('sb_secret_abc'));
  assert.match(text, /\[jwt\]/); assert.match(text, /\[key\]/);
  assert.equal(sanitizeMessage('plain'), 'plain');
  assert.equal(sanitizeMessage(undefined), 'undefined');
});

test('describeResult names code, message and status but never the data', () => {
  const text = describeResult({data: {secret: 'PRIVATE_TEXT'}, error: {code: 'PT409', message: 'MESSAGE_COMMAND_CONFLICT'}, status: 409});
  assert.equal(text, 'code=PT409 message=MESSAGE_COMMAND_CONFLICT status=409');
  assert.ok(!text.includes('PRIVATE_TEXT'));
  assert.equal(describeResult({data: {a: 1}, error: null, status: 200}), 'no error status=200');
  assert.equal(describeResult(undefined), 'no result');
});

test('expectConflictResult accepts exactly PT409 with the message and the HTTP 409, and rejects 40001 and every other code', () => {
  const good = {data: null, error: {code: CONFLICT_CODE, message: 'MESSAGE_COMMAND_CONFLICT'}, status: 409};
  assert.doesNotThrow(() => expectConflictResult(good, 'MESSAGE_COMMAND_CONFLICT'));
  assert.doesNotThrow(() => expectConflictResult({...good, status: undefined}, 'MESSAGE_COMMAND_CONFLICT'), 'a client that does not expose the status is tolerated');
  assert.throws(() => expectConflictResult({...good, error: {...good.error, code: '40001'}}, 'MESSAGE_COMMAND_CONFLICT'), /PT409/);
  assert.throws(() => expectConflictResult({...good, error: {...good.error, code: 'P0001'}}, 'MESSAGE_COMMAND_CONFLICT'), /PT409/);
  assert.throws(() => expectConflictResult({...good, error: {...good.error, message: 'OTHER'}}, 'MESSAGE_COMMAND_CONFLICT'), /MESSAGE_COMMAND_CONFLICT/);
  assert.throws(() => expectConflictResult({...good, status: 400}, 'MESSAGE_COMMAND_CONFLICT'), /409/);
  assert.throws(() => expectConflictResult({data: {ok: 1}, error: null, status: 200}, 'MESSAGE_COMMAND_CONFLICT'), /error/);
  assert.throws(() => expectConflictResult({...good, data: {leaked: true}}, 'MESSAGE_COMMAND_CONFLICT'), /data/);
});

test('expectErrorResult checks code and message independently and refuses a successful result', () => {
  const refused = {data: null, error: {code: '42501', message: 'NOT_PARTY'}, status: 403};
  assert.doesNotThrow(() => expectErrorResult(refused, {code: '42501', message: 'NOT_PARTY'}));
  assert.doesNotThrow(() => expectErrorResult(refused, {message: 'NOT_PARTY'}));
  assert.doesNotThrow(() => expectErrorResult(refused, {code: '42501'}));
  assert.throws(() => expectErrorResult(refused, {code: '28000'}), /28000/);
  assert.throws(() => expectErrorResult({data: 'x', error: null}, {code: '42501'}), /error/);
});
