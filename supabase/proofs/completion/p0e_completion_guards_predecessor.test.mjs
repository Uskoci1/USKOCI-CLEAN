// Pure source-admission tests: no database, network or environment side effects.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readP0eCompletionPredecessorPlan } from './p0e_completion_guards_predecessor.mjs';
import { historicalPredecessorFixture } from '../historical_predecessor_fixture.mjs';

const unit = JSON.parse(readFileSync('supabase/proofs/completion/p0e_completion_guards_files.json', 'utf8'));
const md5 = bytes => createHash('md5').update(bytes).digest('hex');

test('plan admits exactly the frozen live87 fixture plus one pending forward file', () => historicalPredecessorFixture('completion', root => {
  const plan = readP0eCompletionPredecessorPlan(root);
  assert.equal(plan.historical_predecessor_count, 87);
  assert.equal(plan.source_migration_count, 88);
  assert.equal(plan.expected_predecessor_count, 87);
  assert.equal(plan.source_inventory.at(-1).file, unit.forward_file);
}));
test('historical completion planner rejects the larger current integration source', () => {
  assert.throws(() => readP0eCompletionPredecessorPlan(), /UNKNOWN_MISSING_OR_CHANGED_PREDECESSOR_SOURCE/);
});

test('candidate and forward bytes are identical and match the manifest digests', () => {
  const forward = readFileSync(`supabase/migrations/${unit.forward_file}`);
  const candidate = readFileSync(unit.candidate_file);
  assert.deepEqual(forward, candidate);
  assert.equal(forward.length, unit.bytes);
  assert.equal(md5(forward), unit.md5);
  assert.equal(createHash('sha256').update(forward).digest('hex'), unit.sha256);
  assert.ok(!forward.includes(13), 'forward file must be LF only');
});

test('forward file guards the exact live87 predecessor bodies it replaces', () => {
  const text = readFileSync(`supabase/migrations/${unit.forward_file}`, 'utf8');
  for (const [signature, expected] of Object.entries(unit.predecessor_body_md5)) {
    assert.ok(text.includes(`'${signature}'::regprocedure`), `missing guard for ${signature}`);
    for (const digest of [].concat(expected)) assert.ok(text.includes(`'${digest}'`), `missing predecessor md5 ${digest} for ${signature}`);
  }
  assert.ok(text.includes("to_regclass('public.worker_calendar_commitments') is not null"));
  assert.ok(!/\bneed_id\s+uuid\s*;/.test(text), 'ambiguous need_id variable must not be declared');
});

test('provenance declares the unit as pending and not live', () => {
  const provenance = JSON.parse(readFileSync('supabase/migrations/MIGRATION_PROVENANCE.json', 'utf8'));
  const pending = provenance.pending_forward_migrations.find(entry => entry.file === unit.forward_file);
  assert.ok(pending, 'pending entry missing');
  assert.equal(pending.classification, 'PENDING_FORWARD_MIGRATION');
  assert.equal(pending.live_applied, false);
  assert.equal(pending.raw_md5, unit.md5);
  assert.equal(pending.predecessor_live_migration_count, 87);
  assert.equal(pending.predecessor_live_head, '20260907135905');
});
