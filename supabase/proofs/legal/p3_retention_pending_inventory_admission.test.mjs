// Pure source-admission tests. Synthetic future files are written only into
// an owned temp copy and are never applied to any database.
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
  const root = mkdtempSync(join(tmpdir(), 'uskoci-p3-pending-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(resolve('supabase'), join(root, 'supabase'), { recursive: true });
  const provenancePath = join(root, 'supabase/migrations/MIGRATION_PROVENANCE.json');
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
  const save = () => writeFileSync(provenancePath, JSON.stringify(provenance));
  const append = (version = '20261231000000') => {
    const name = 'synthetic_future_pending_test';
    const file = `${version}_${name}.sql`;
    const bytes = Buffer.from('-- SYNTHETIC TEST ONLY; never executed.\nselect 1;\n');
    writeFileSync(join(root, 'supabase/migrations', file), bytes);
    const entry = {
      version,
      name,
      file,
      classification: 'PENDING_FORWARD_MIGRATION',
      live_applied: false,
      raw_md5: digest('md5', bytes),
      raw_sha256: digest('sha256', bytes),
      raw_bytes: bytes.length,
    };
    provenance.pending_forward_migrations.push(entry);
    save();
    return entry;
  };
  return { root, provenance, save, append };
}

test('a later pending migration is fully fingerprinted and remains an ordered replay successor', t => {
  const before = readP3RetentionPredecessorPlan();
  const f = fixture(t);
  const later = f.append();
  const after = readP3RetentionPredecessorPlan(f.root);
  assert.equal(after.expected_predecessor_count, before.expected_predecessor_count);
  assert.equal(after.source_migration_count, before.source_migration_count + 1);
  assert.equal(after.pending_successor_count, before.pending_successor_count + 1);
  assert.deepEqual(after.pending_successors.at(-1), {
    file: later.file,
    version: later.version,
    name: later.name,
    md5: later.raw_md5,
  });
  assert.ok(!after.pending_predecessors.some(entry => entry.file === later.file));
});

for (const [field, changed, expected] of [
  ['raw_md5', '0'.repeat(32), /PENDING_MD5_CHANGED/],
  ['raw_sha256', '0'.repeat(64), /PENDING_SHA256_CHANGED/],
  ['raw_bytes', 1, /PENDING_BYTES_CHANGED/],
  ['live_applied', true, /PENDING_ENTRY_MARKED_LIVE/],
  ['classification', 'LIVE', /PENDING_CLASSIFICATION_INVALID/],
  ['version', '20260101000000', /PENDING_IDENTITY_MISMATCH/],
]) {
  test(`a later pending ${field} mismatch fails before any database operation`, t => {
    const f = fixture(t);
    const entry = f.append();
    entry[field] = changed;
    f.save();
    assert.throws(() => readP3RetentionPredecessorPlan(f.root), expected);
  });
}

test('an undeclared future SQL file is refused', t => {
  const f = fixture(t);
  f.append();
  f.provenance.pending_forward_migrations.pop();
  f.save();
  assert.throws(() => readP3RetentionPredecessorPlan(f.root), /SOURCE_PROVENANCE_INVENTORY_MISMATCH/);
});

test('changed earlier pending bytes are refused even when later successors are valid', t => {
  const f = fixture(t);
  f.append();
  const earlier = f.provenance.pending_forward_migrations.find(entry => String(entry.version) < String(unit.forward_version));
  assert.ok(earlier);
  writeFileSync(join(f.root, 'supabase/migrations', earlier.file), '-- changed synthetic copy\n');
  assert.throws(() => readP3RetentionPredecessorPlan(f.root), /PENDING_(MD5|SHA256|BYTES)_CHANGED/);
});

test('changed historical source cannot be hidden by adding a valid future pending file', t => {
  const f = fixture(t);
  f.append();
  const first = f.provenance.live_history_snapshot.entries[0];
  const file = first.file ?? `${first.version}_${first.name}.sql`;
  writeFileSync(join(f.root, 'supabase/migrations', file), '-- changed historical test copy\n');
  assert.throws(() => readP3RetentionPredecessorPlan(f.root), /UNKNOWN_MISSING_OR_CHANGED_LIVE87_SOURCE/);
});

test('runtime proof still replays successors instead of weakening to source-only admission', () => {
  const proof = readFileSync('supabase/proofs/legal/p3_retention_schedule_proof.mjs', 'utf8');
  const workflow = readFileSync('.github/workflows/p3-retention-schedule-proof.yml', 'utf8');
  assert.match(proof, /for\s*\(\s*const\s+successor\s+of\s+plan\.pending_successors\s*\)/);
  assert.match(proof, /retention_projection_unchanged\s*:\s*true/);
  assert.match(proof, /retention_rows_unchanged\s*:\s*true/);
  assert.match(proof, /retention_functions_and_grants_unchanged\s*:\s*true/);
  assert.match(workflow, /r\.successor_replay\.count\s*!==\s*r\.predecessor_plan\.pending_successor_count/);
  assert.match(workflow, /r\.migration_history_count\s*!==\s*r\.predecessor_plan\.source_migration_count/);
});
