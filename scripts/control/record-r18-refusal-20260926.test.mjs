import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvidence, updateTracker, SOURCE, RUN, BRANCH } from './record-r18-refusal-20260926.mjs';

// Synthetic recorder fixtures only; these numbers are never release evidence.
const names = [
  'a SQLSTATE-bound refusal is settled immediately',
  'shows allowlisted eligibility guidance and correction links',
  'a known refusal of the retried command permits a reset',
  'eligibility message without proof plus a fresh collection read cannot release',
  'reused key plus a fresh collection read cannot release',
];
const suite = n => ({ success: true, numFailedTests: 0, numFailedTestSuites: 0, numPassedTests: n,
  numPassedTestSuites: n === 139 ? 4 : 321, numPendingTests: 0,
  testResults: [{ assertionResults: names.map(fullName => ({ fullName, status: 'passed' })) }] });
const make = () => [
  { id: RUN, head_sha: SOURCE, head_branch: BRANCH, status: 'completed', conclusion: 'success' },
  suite(139), suite(6334),
  { result: 'PASS', sourceSha: SOURCE, history: '147/20260913081242', liveAccess: false,
    providerCalled: false, checks: Array.from({ length: 9 }, () => ({ result: 'PASS' })) },
  '147/20260913081242',
];
test('records only the bound completed proof and explicit device/deployment limits', () => {
  const r = validateEvidence(...make());
  assert.equal(r.status, 'CLIENT_CI_PASS_DEVICE_PENDING');
  assert.equal(r.full.passedTests, 6334);
  assert.equal(r.devApplied, false);
  assert.equal(r.deviceTestPerformed, false);
});
for (const [label, mutate] of [
  ['wrong source', x => { x[0].head_sha = 'other'; }],
  ['unfinished proof', x => { x[0].status = 'in_progress'; }],
  ['failed run', x => { x[0].conclusion = 'failure'; }],
  ['failed focused test', x => { x[1].numFailedTests = 1; }],
  ['failed full test', x => { x[2].success = false; }],
  ['missing original regression', x => { x[1].testResults[0].assertionResults.pop(); }],
  ['live database touched', x => { x[3].liveAccess = true; }],
  ['provider touched', x => { x[3].providerCalled = true; }],
  ['different SQL source', x => { x[3].sourceSha = 'wrong'; }],
  ['failed SQL check', x => { x[3].checks[0].result = 'FAIL'; }],
  ['schema misrepresented', x => { x[4] = '202/20260924202023'; }],
]) test('rejects ' + label, () => {
  const args = make(); mutate(args);
  assert.throws(() => validateEvidence(...args));
});
test('changes B09 only and leaves device evidence and unrelated facts intact', () => {
  const rows = { redovi: [
    { id: 'B09', problem: 'Earlier distinct finding. R18-E01/E02: old', sledece: 'Earlier next step',
      telefon: { stanje: 'DELIMIČNO', dokaz: 'old' } },
    { id: 'P04', problem: 'Push is open' },
  ], blokade: [{ id: 'B10', sada: 'OPEN' }] };
  const r = updateTracker(rows, validateEvidence(...make()));
  assert.equal(rows.redovi[0].sledece, 'Earlier next step');
  assert.deepEqual(r.redovi[1], rows.redovi[1]);
  assert.deepEqual(r.blokade, rows.blokade);
  assert.deepEqual(r.redovi[0].telefon, rows.redovi[0].telefon);
  assert.ok(r.redovi[0].problem.startsWith('Earlier distinct finding. '));
  assert.throws(() => updateTracker(r, validateEvidence(...make())));
});
