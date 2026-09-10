import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPendingSourcePlan } from './pending_source_plan.mjs';
import { readP3RetentionPredecessorPlan } from './p3_retention_schedule_predecessor.mjs';

const definitions = [
  ['P1', 'legal/p1_legal_consent'], ['P4', 'legal/p4_processor_map'],
  ['D0140A', 'policy/d0140a_bundle_registration'], ['P3', 'legal/p3_retention_schedule'],
];
const options = (domain, prefix, root = process.cwd()) => ({ root, domain,
  unitManifest: `supabase/proofs/${prefix}_files.json`,
  predecessorManifest: `supabase/proofs/${prefix}_predecessor_files.json` });

for (const [domain, prefix] of definitions) {
  test(`${domain}: validated predecessor + unit + suffix is the exact whole source inventory`, () => {
    const plan = readPendingSourcePlan(options(domain, prefix));
    const unit = JSON.parse(readFileSync(`supabase/proofs/${prefix}_files.json`));
    assert.equal(plan.source_migration_count, plan.expected_predecessor_count + 1 + plan.pending_successor_count);
    assert.equal(plan.source_inventory[plan.expected_predecessor_count].file, unit.forward_file);
    assert.deepEqual(plan.pending_successors.map(entry => entry.file), plan.source_inventory.slice(plan.expected_predecessor_count + 1).map(entry => entry.file));
    assert.ok(plan.source_inventory.every(entry => /^[0-9a-f]{64}$/.test(entry.sha256) && entry.bytes > 0));
  });
}
test('shared reader retains the previously admitted P3 plan exactly', () => {
  assert.deepEqual(readPendingSourcePlan(options('P3', 'legal/p3_retention_schedule')), readP3RetentionPredecessorPlan());
});
for (const [key, replacement] of [
  ['raw_sha256', '0'.repeat(64)], ['raw_bytes', 1], ['raw_md5', '0'.repeat(32)],
  ['classification', 'NOT_ADMITTED'], ['live_applied', true], ['name', 'other_name'], ['version', '20990101000000'],
]) {
  test(`an incorrect successor ${key} is rejected by every reader before SQL`, () => {
    const root = mkdtempSync(join(tmpdir(), 'uskoci-inventory-'));
    try {
      cpSync('supabase/migrations', join(root, 'supabase/migrations'), { recursive: true });
      cpSync('supabase/proofs', join(root, 'supabase/proofs'), { recursive: true });
      const file = join(root, 'supabase/migrations/MIGRATION_PROVENANCE.json');
      const provenance = JSON.parse(readFileSync(file));
      provenance.pending_forward_migrations.at(-1)[key] = replacement;
      writeFileSync(file, JSON.stringify(provenance));
      for (const [domain, prefix] of definitions) assert.throws(() => readPendingSourcePlan(options(domain, prefix, root)));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
