import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertDomainSnapshotAfterSuccessors, readAdmittedSuccessorDelta } from './pending_domain_replay.mjs';

// PKG-013: a later intentional successor may change a domain's security state only
// through a recorded delta with provenance; everything unrecorded still fails.
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plan = { source_migration_count: 147, pending_successors: [
  { file: '20260912130000_clean_pre_v3_account_closure_preparation.sql', md5: 'a'.repeat(32) },
  { file: '20260912222338_clean_v5_owner_safety_legal_reads.sql', md5: 'b'.repeat(32) },
] };
const before = { security: '[{"proname":"rpc_get_legal_bundle"}]', columnGrants: '[["private","legal_document_versions","id",null]]', policies: '[]' };
const after = { ...before, columnGrants: '[["private","legal_document_versions","id","{authenticated=r/postgres}"]]' };
const delta = { unit: 'P1_LEGAL_CONSENT', source_migration_count: 147,
  attributed_successors: [{ file: plan.pending_successors[1].file, md5: plan.pending_successors[1].md5 }],
  changed: { columnGrants: { before_sha256: digest(before.columnGrants), after_sha256: digest(after.columnGrants) } } };

test('without a manifest the comparison is strict and the divergence is attached for evidence', () => {
  assert.deepEqual(assertDomainSnapshotAfterSuccessors({ before, after: before, plan }).admitted_changed_keys, []);
  let caught = null;
  try { assertDomainSnapshotAfterSuccessors({ before, after, plan }); } catch (error) { caught = error; }
  assert.match(caught.message, /DOMAIN_STATE_SECURITY_OR_RPC_CHANGED_BY_SUCCESSOR:columnGrants/);
  assert.deepEqual(caught.divergence.keys, ['columnGrants']);
  assert.equal(caught.divergence.after.columnGrants, after.columnGrants);
  assert.equal(caught.divergence.after_sha256.columnGrants, digest(after.columnGrants));
});

test('a recorded delta admits exactly the recorded change and nothing else', () => {
  const verdict = assertDomainSnapshotAfterSuccessors({ before, after, plan, admittedDelta: delta });
  assert.deepEqual(verdict.admitted_changed_keys, ['columnGrants']);
  assert.deepEqual(verdict.unchanged_keys, ['security', 'policies']);
  assert.deepEqual(verdict.attributed_successors, [plan.pending_successors[1].file]);
  const otherAfter = { ...after, columnGrants: after.columnGrants.replace('authenticated', 'anon') };
  assert.throws(() => assertDomainSnapshotAfterSuccessors({ before, after: otherAfter, plan, admittedDelta: delta }), /ADMITTED_DELTA_AFTER_MISMATCH:columnGrants/);
  const secondKey = { ...after, policies: '[{"policyname":"x"}]' };
  assert.throws(() => assertDomainSnapshotAfterSuccessors({ before, after: secondKey, plan, admittedDelta: delta }), /DOMAIN_STATE_SECURITY_OR_RPC_CHANGED_BY_SUCCESSOR:policies/);
  assert.throws(() => assertDomainSnapshotAfterSuccessors({ before, after, plan: { ...plan, source_migration_count: 146 }, admittedDelta: delta }), /ADMITTED_DELTA_SOURCE_COUNT_MISMATCH/);
  const otherMd5 = { ...plan, pending_successors: [plan.pending_successors[0], { ...plan.pending_successors[1], md5: 'c'.repeat(32) }] };
  assert.throws(() => assertDomainSnapshotAfterSuccessors({ before, after, plan: otherMd5, admittedDelta: delta }), /ADMITTED_DELTA_SUCCESSOR_IDENTITY/);
  const missing = { ...plan, pending_successors: [plan.pending_successors[0]] };
  assert.throws(() => assertDomainSnapshotAfterSuccessors({ before, after, plan: missing, admittedDelta: delta }), /ADMITTED_DELTA_SUCCESSOR_NOT_PENDING/);
  assert.throws(() => assertDomainSnapshotAfterSuccessors({ before, after: before, plan, admittedDelta: delta }), /ADMITTED_DELTA_AFTER_MISMATCH/);
});

test('a manifest must name its successors and changed keys; a missing file means strict mode', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uskoci-delta-'));
  try {
    assert.equal(readAdmittedSuccessorDelta(join(dir, 'absent.json')), null);
    writeFileSync(join(dir, 'empty.json'), JSON.stringify({ unit: 'X', attributed_successors: [], changed: {} }));
    assert.throws(() => readAdmittedSuccessorDelta(join(dir, 'empty.json')), /ADMITTED_DELTA_INCOMPLETE/);
    writeFileSync(join(dir, 'nochange.json'), JSON.stringify({ unit: 'X', attributed_successors: [{ file: 'a.sql', md5: 'a' }], changed: {} }));
    assert.throws(() => readAdmittedSuccessorDelta(join(dir, 'nochange.json')), /ADMITTED_DELTA_EMPTY/);
    writeFileSync(join(dir, 'ok.json'), JSON.stringify(delta));
    assert.equal(readAdmittedSuccessorDelta(join(dir, 'ok.json')).unit, 'P1_LEGAL_CONSENT');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
