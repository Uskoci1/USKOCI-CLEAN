// Pure source admission checks: no database client or provider is created.
import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { readAiAuthorityPredecessorPlan } from './ai_draft_authority_predecessor.mjs';

function fixture(run) {
  const prefix = resolve(tmpdir(), 'uskoci-ai-predecessor-');
  const root = mkdtempSync(prefix);
  try {
    cpSync('supabase/migrations', join(root, 'supabase/migrations'), { recursive: true });
    mkdirSync(join(root, 'supabase/proofs/ai'), { recursive: true });
    for (const name of ['ai_draft_authority_files.json', 'ai_draft_authority_predecessor_files.json']) {
      cpSync(`supabase/proofs/ai/${name}`, join(root, 'supabase/proofs/ai', name));
    }
    if (existsSync('supabase/proofs/notifications/d03_message_retry_files.json')) {
      mkdirSync(join(root, 'supabase/proofs/notifications'), { recursive: true });
      for (const name of ['d03_message_retry_files.json', 'd03_message_retry_candidate.sql']) {
        cpSync(`supabase/proofs/notifications/${name}`, join(root, 'supabase/proofs/notifications', name));
      }
    }
    return run(root);
  } finally {
    assert.ok(resolve(root).startsWith(prefix) && resolve(root) !== prefix, 'TEMP_CLEANUP_BOUNDARY');
    rmSync(root, { recursive: true, force: true });
  }
}

test('current source/provenance derives the complete predecessor and exact optional D03', () => {
  const plan = readAiAuthorityPredecessorPlan();
  assert.equal(plan.source_migration_count, plan.source_inventory.length);
  assert.equal(plan.expected_predecessor_count + 1, plan.source_migration_count);
  assert.equal(plan.expected_predecessor_count, plan.historical_predecessor_count + (plan.d03 ? 1 : 0));
});
test('unknown additional migration refuses source admission before any database operation', () => fixture(root => {
  writeFileSync(join(root, 'supabase/migrations/20990101000000_unadmitted.sql'), 'select 1;\n');
  assert.throws(() => readAiAuthorityPredecessorPlan(root), /SOURCE_PROVENANCE_INVENTORY_MISMATCH/);
}));
test('missing historical migration refuses source admission', () => fixture(root => {
  const first = readdirSync(join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort()[0];
  unlinkSync(join(root, 'supabase/migrations', first));
  assert.throws(() => readAiAuthorityPredecessorPlan(root), /SOURCE_PROVENANCE_INVENTORY_MISMATCH/);
}));
test('changed historical SQL bytes refuse source admission even with unchanged names', () => fixture(root => {
  const first = readdirSync(join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort()[0];
  const path = join(root, 'supabase/migrations', first);
  writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('\n-- changed disposable test bytes\n')]));
  assert.throws(() => readAiAuthorityPredecessorPlan(root), /UNKNOWN_MISSING_OR_CHANGED_PREDECESSOR_SOURCE/);
}));
test('missing provenance record cannot be hidden by matching physical file count', () => fixture(root => {
  const path = join(root, 'supabase/migrations/MIGRATION_PROVENANCE.json');
  const provenance = JSON.parse(readFileSync(path, 'utf8'));
  provenance.live_history_snapshot.entries.shift();
  writeFileSync(path, JSON.stringify(provenance));
  assert.throws(() => readAiAuthorityPredecessorPlan(root), /SOURCE_PROVENANCE_INVENTORY_MISMATCH/);
}));
