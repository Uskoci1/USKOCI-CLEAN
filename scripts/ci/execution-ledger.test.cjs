const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const LEDGER = path.join(ROOT, 'docs/implementation/execution/EXECUTION_LEDGER.jsonl');
const ALLOWED = new Set([
  'NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'IMPLEMENTED', 'IMPLEMENTED_PENDING_VERIFICATION',
  'DONE_UNVERIFIED', 'DONE_VERIFIED', 'BLOCKED', 'STALE', 'REVERIFY_REQUIRED',
  'REGRESSION_DETECTED', 'MISSING_PROOF', 'SUPERSEDED',
]);
const REQUIRED = [
  'schemaVersion', 'eventId', 'eventType', 'recordedAt', 'packageId', 'packageName', 'gapIds', 'goal',
  'startStatus', 'branch', 'pr', 'baseSha', 'branchHeadShaAtRuntimeProof', 'candidateSha', 'treeSha',
  'workWindow', 'changedFiles', 'touched', 'originalRepro', 'preFix', 'postFix', 'positiveScenario',
  'positiveResult', 'guards', 'typescript', 'build', 'tests', 'fullRegression', 'ci', 'artifacts',
  'migrationProof', 'liveDbProof', 'edgeProof', 'deviceProof', 'providerProof', 'resolved', 'stillOpen',
  'status', 'notDoneVerifiedReason', 'proofFreshness', 'invalidationReason', 'nextSafeStep', 'evidence',
];

function readLedger() {
  const lines = fs.readFileSync(LEDGER, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`Execution Ledger line ${index + 1} is not valid JSON: ${error.message}`); }
  });
}
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function sha(value) { return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value); }
function checkNA(name, value) {
  assert.ok(value && typeof value === 'object', `${name} must be an object`);
  assert.ok(nonEmptyString(value.result), `${name}.result is required`);
  if (value.result === 'N/A') assert.ok(nonEmptyString(value.reason), `${name} N/A requires a reason`);
}

const events = readLedger();
const receipts = events.filter(event => event.eventType === 'PACKAGE_RECEIPT');

test('Execution Ledger has unique append-only event ids and only allowed package statuses', () => {
  assert.ok(events.length > 0, 'ledger is empty');
  const ids = new Set();
  for (const event of events) {
    assert.ok(nonEmptyString(event.eventId), 'eventId is required');
    assert.equal(ids.has(event.eventId), false, `duplicate eventId ${event.eventId}`);
    ids.add(event.eventId);
    if (event.packageId) assert.ok(ALLOWED.has(event.status), `${event.packageId} has unsupported status ${event.status}`);
    assert.notEqual(event.status, 'DONE', 'generic DONE is forbidden');
  }
});

test('retroactive bootstrap contains PKG-002, PKG-003, PKG-005 and PKG-009 receipts', () => {
  const packages = new Set(receipts.map(receipt => receipt.packageId));
  for (const id of ['PKG-002', 'PKG-003', 'PKG-005', 'PKG-009']) assert.ok(packages.has(id), `${id} receipt missing`);
});

test('every package receipt carries the minimum execution/proof contract', () => {
  for (const receipt of receipts) {
    for (const field of REQUIRED) assert.ok(Object.prototype.hasOwnProperty.call(receipt, field), `${receipt.packageId} missing ${field}`);
    assert.equal(receipt.schemaVersion, 1, `${receipt.packageId} unexpected schemaVersion`);
    assert.ok(ALLOWED.has(receipt.startStatus), `${receipt.packageId} invalid startStatus`);
    assert.ok(ALLOWED.has(receipt.status), `${receipt.packageId} invalid final status`);
    assert.ok(Array.isArray(receipt.gapIds), `${receipt.packageId} gapIds must be an array`);
    // A package that closes no numbered GAP (e.g. a presentation rebuild over a verified engine) must say so explicitly.
    assert.ok(receipt.gapIds.length > 0 || nonEmptyString(receipt.gapIdsNote), `${receipt.packageId} gapIds required (or a gapIdsNote explaining why none)`);
    assert.ok(Array.isArray(receipt.changedFiles), `${receipt.packageId} changedFiles must be an array`);
    assert.ok(Array.isArray(receipt.touched), `${receipt.packageId} touched must be an array`);
    assert.ok(Array.isArray(receipt.resolved), `${receipt.packageId} resolved must be an array`);
    assert.ok(Array.isArray(receipt.stillOpen), `${receipt.packageId} stillOpen must be an array`);
    assert.ok(Array.isArray(receipt.evidence) && receipt.evidence.length > 0, `${receipt.packageId} evidence required`);
    assert.ok(nonEmptyString(receipt.goal), `${receipt.packageId} goal required`);
    assert.ok(nonEmptyString(receipt.originalRepro?.description), `${receipt.packageId} original repro required`);
    assert.ok(Array.isArray(receipt.originalRepro?.evidence) && receipt.originalRepro.evidence.length > 0, `${receipt.packageId} original repro evidence required`);
    assert.ok(nonEmptyString(receipt.preFix?.result), `${receipt.packageId} PRE-FIX result required`);
    assert.ok(nonEmptyString(receipt.postFix?.result), `${receipt.packageId} POST-FIX result required`);
    assert.ok(nonEmptyString(receipt.positiveScenario?.description), `${receipt.packageId} positive scenario required`);
    assert.ok(nonEmptyString(receipt.positiveResult?.result), `${receipt.packageId} positive result required`);
    assert.ok(sha(receipt.baseSha), `${receipt.packageId} invalid baseSha`);
    assert.ok(sha(receipt.branchHeadShaAtRuntimeProof), `${receipt.packageId} invalid branchHeadShaAtRuntimeProof`);
    assert.ok(sha(receipt.candidateSha), `${receipt.packageId} invalid candidateSha`);
    assert.ok(sha(receipt.treeSha), `${receipt.packageId} invalid treeSha`);
    assert.equal(typeof receipt.pr, 'number', `${receipt.packageId} PR must be numeric`);
    for (const name of ['security', 'replayIdempotency', 'accountSession', 'privacy']) checkNA(`${receipt.packageId}.guards.${name}`, receipt.guards?.[name]);
    for (const name of ['typescript', 'build', 'tests', 'fullRegression', 'migrationProof', 'liveDbProof', 'edgeProof', 'deviceProof', 'providerProof']) checkNA(`${receipt.packageId}.${name}`, receipt[name]);
    assert.ok(nonEmptyString(receipt.nextSafeStep), `${receipt.packageId} nextSafeStep required`);
    if (receipt.status !== 'DONE_VERIFIED') assert.ok(nonEmptyString(receipt.notDoneVerifiedReason), `${receipt.packageId} non-DONE_VERIFIED receipt requires reason`);
  }
});

test('DONE_VERIFIED receipts satisfy the universal exact-candidate rule', () => {
  for (const receipt of receipts.filter(item => item.status === 'DONE_VERIFIED')) {
    assert.equal(receipt.preFix.result, 'FAIL', `${receipt.packageId} must retain a PRE-FIX FAIL witness`);
    assert.equal(receipt.postFix.result, 'PASS', `${receipt.packageId} original repro is not POST-FIX PASS`);
    assert.equal(receipt.positiveResult.result, 'PASS', `${receipt.packageId} positive scenario is not PASS`);
    for (const name of ['security', 'replayIdempotency', 'accountSession', 'privacy']) {
      const value = receipt.guards[name];
      assert.ok(value.result === 'PASS' || value.result === 'N/A', `${receipt.packageId}.${name} must be PASS or justified N/A`);
      if (value.result === 'N/A') assert.ok(nonEmptyString(value.reason), `${receipt.packageId}.${name} N/A requires reason`);
    }
    assert.equal(receipt.ci?.conclusion, 'success', `${receipt.packageId} completion CI is not success`);
    assert.equal(receipt.ci?.testedCandidateSha, receipt.candidateSha, `${receipt.packageId} CI is not bound to candidateSha`);
    assert.equal(receipt.ci?.testedTreeSha, receipt.treeSha, `${receipt.packageId} CI tree is not bound to treeSha`);
    assert.equal(receipt.proofFreshness?.candidateSha, receipt.candidateSha, `${receipt.packageId} proof freshness candidate mismatch`);
    assert.equal(receipt.proofFreshness?.treeSha, receipt.treeSha, `${receipt.packageId} proof freshness tree mismatch`);
    assert.equal(receipt.proofFreshness?.relevantSourceChangedAfterProof, false, `${receipt.packageId} relevant source changed after proof`);
    assert.equal(receipt.stillOpen.length, 0, `${receipt.packageId} cannot be DONE_VERIFIED with open package items`);
    assert.equal(receipt.notDoneVerifiedReason, null, `${receipt.packageId} DONE_VERIFIED must not carry a failure reason`);
  }
});

test('PKG-003 cannot be promoted while GAP-0015 lacks provider-independent bootstrap proof', () => {
  const receipt = [...receipts].reverse().find(item => item.packageId === 'PKG-003');
  assert.ok(receipt, 'PKG-003 receipt missing');
  if (receipt.stillOpen.includes('GAP-0015')) assert.notEqual(receipt.status, 'DONE_VERIFIED');
});
