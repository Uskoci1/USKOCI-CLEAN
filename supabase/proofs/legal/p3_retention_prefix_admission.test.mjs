// Synthetic future files exist only in an owned temp directory and are never applied.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { readP3RetentionPredecessorPlan } from './p3_retention_schedule_predecessor.mjs';

const unit = JSON.parse(readFileSync('supabase/proofs/legal/p3_retention_schedule_files.json', 'utf8'));
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'uskoci-p3-prefix-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(resolve('supabase'), join(root, 'supabase'), { recursive: true });
  const path = join(root, 'supabase/migrations/MIGRATION_PROVENANCE.json');
  const provenance = JSON.parse(readFileSync(path, 'utf8'));
  const save = () => writeFileSync(path, JSON.stringify(provenance));
  const append = (version = '20261231000000') => {
    const name = 'synthetic_future_prefix_test';
    const file = `${version}_${name}.sql`;
    const bytes = Buffer.from('-- SYNTHETIC TEST ONLY; never executed.\nselect 1;\n');
    writeFileSync(join(root, 'supabase/migrations', file), bytes);
    const entry = { version, name, file, classification: 'PENDING_FORWARD_MIGRATION', live_applied: false,
      raw_md5: digest('md5', bytes), raw_sha256: digest('sha256', bytes), raw_bytes: bytes.length };
    provenance.pending_forward_migrations.push(entry); save();
    return entry;
  };
  return { root, provenance, save, append };
}

test('later pending migrations are validated but never added to the P3 predecessor or verified prefix', t => {
  const before = readP3RetentionPredecessorPlan();
  const f = fixture(t); const later = f.append();
  const after = readP3RetentionPredecessorPlan(f.root);
  assert.equal(after.proof_scope, 'HISTORICAL_PLUS_UNIT_PREFIX');
  assert.equal(after.expected_predecessor_count, before.expected_predecessor_count);
  assert.equal(after.expected_post_unit_count, before.expected_post_unit_count);
  assert.equal(after.expected_post_unit_count, after.expected_predecessor_count + 1);
  assert.equal(after.source_migration_count, before.source_migration_count + 1);
  assert.deepEqual(after.pending_predecessors, before.pending_predecessors);
  assert.deepEqual(after.unapplied_successors.at(-1), {
    file: later.file, version: later.version, name: later.name, md5: later.raw_md5,
  });
  assert.ok(!after.pending_predecessors.some(entry => entry.file === later.file));
});

test('multiple successors remain explicitly outside the proof scope', t => {
  const f = fixture(t); const first = f.append(); const second = f.append('20261231000100');
  const plan = readP3RetentionPredecessorPlan(f.root);
  assert.deepEqual(plan.unapplied_successors.slice(-2).map(entry => entry.file), [first.file, second.file]);
  assert.equal(plan.source_migration_count, plan.expected_post_unit_count + plan.unapplied_successors.length);
});

for (const [field, changed, expected] of [
  ['raw_md5', '0'.repeat(32), /PENDING_MD5_CHANGED/],
  ['raw_sha256', '0'.repeat(64), /PENDING_SHA256_CHANGED/],
  ['raw_bytes', 1, /PENDING_BYTES_CHANGED/],
  ['live_applied', true, /PENDING_ENTRY_MARKED_LIVE/],
  ['classification', 'LIVE', /PENDING_CLASSIFICATION_INVALID/],
  ['version', '20260101000000', /PENDING_IDENTITY_MISMATCH/],
]) test(`a later pending ${field} mismatch still fails closed`, t => {
  const f = fixture(t); const entry = f.append(); entry[field] = changed; f.save();
  assert.throws(() => readP3RetentionPredecessorPlan(f.root), expected);
});

test('an undeclared future SQL file is still refused', t => {
  const f = fixture(t); f.append(); f.provenance.pending_forward_migrations.pop(); f.save();
  assert.throws(() => readP3RetentionPredecessorPlan(f.root), /SOURCE_PROVENANCE_INVENTORY_MISMATCH/);
});

test('changed earlier pending bytes are refused before any SQL execution', t => {
  const f = fixture(t);
  const earlier = f.provenance.pending_forward_migrations.find(entry => entry.version < unit.forward_version);
  assert.ok(earlier);
  writeFileSync(join(f.root, 'supabase/migrations', earlier.file), '-- changed synthetic copy\n');
  assert.throws(() => readP3RetentionPredecessorPlan(f.root), /PENDING_MD5_CHANGED/);
});

test('a changed historical migration cannot be admitted by adding a future file', t => {
  const f = fixture(t); f.append();
  const first = f.provenance.live_history_snapshot.entries[0];
  const file = first.file ?? `${first.version}_${first.name}.sql`;
  writeFileSync(join(f.root, 'supabase/migrations', file), '-- changed historical test copy\n');
  assert.throws(() => readP3RetentionPredecessorPlan(f.root), /UNKNOWN_MISSING_OR_CHANGED_LIVE87_SOURCE/);
});

test('the runtime report compares the applied unit prefix, never the entire future repository', () => {
  const proof = readFileSync('supabase/proofs/legal/p3_retention_schedule_proof.mjs', 'utf8');
  assert.ok(proof.includes('assert.equal(report.migration_history_count,plan.expected_post_unit_count);'));
  assert.ok(proof.includes('report.unapplied_successors=plan.unapplied_successors.map(entry=>entry.file);'));
  assert.ok(!proof.includes('assert.equal(report.migration_history_count,plan.source_migration_count);'));
  const workflow = readFileSync('.github/workflows/p3-retention-schedule-proof.yml', 'utf8');
  assert.ok(workflow.includes('r.migration_history_count!==r.predecessor_plan.expected_post_unit_count'));
  assert.ok(workflow.includes('r.predecessor_plan.source_migration_count!==r.migration_history_count+r.unapplied_successors.length'));
});
