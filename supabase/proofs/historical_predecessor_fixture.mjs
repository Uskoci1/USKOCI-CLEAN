// Test-only reconstruction of a frozen admission boundary. Never a migration/apply plan.
// Copy exact retained SQL bytes; preserve the frozen inventory digests and planner guards.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export function historicalPredecessorFixture(kind, run) {
  assert.ok(kind === 'ai' || kind === 'completion', 'UNKNOWN_HISTORICAL_FIXTURE');
  const root = mkdtempSync(join(tmpdir(), 'uskoci-historical-source-'));
  const prefix = resolve(tmpdir(), 'uskoci-historical-source-');
  try {
    const unitPath = kind === 'ai' ? 'supabase/proofs/ai/ai_draft_authority_files.json'
      : 'supabase/proofs/completion/p0e_completion_guards_files.json';
    const admittedPath = kind === 'ai' ? 'supabase/proofs/ai/ai_draft_authority_predecessor_files.json'
      : 'supabase/proofs/completion/p0e_completion_guards_predecessor_files.json';
    const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
    const unit = readJson(unitPath), admitted = readJson(admittedPath);
    const files = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort();
    const historical = files.slice(0, admitted.historical_file_count);
    const inventory = historical.map(file => `${createHash('md5').update(readFileSync('supabase/migrations/' + file)).digest('hex')}  ${file}\n`).join('');
    assert.equal(createHash('sha256').update(inventory).digest('hex'), admitted.historical_inventory_sha256,
      'HISTORICAL_FIXTURE_BYTES_CHANGED');
    const selected = new Set([...historical, unit.forward_file, admitted.d03.forward_file]);
    const copy = path => { mkdirSync(dirname(join(root, path)), { recursive: true }); cpSync(path, join(root, path)); };
    for (const file of selected) copy('supabase/migrations/' + file);
    const manifests = [unitPath, admittedPath, 'supabase/proofs/notifications/d03_message_retry_files.json',
      'supabase/proofs/ai/ai_draft_authority_files.json'];
    for (const path of new Set(manifests)) {
      copy(path);
      const candidate = readJson(path).candidate_file;
      if (candidate) copy(candidate);
    }
    // This derived fixture is NOT live state. Preserve each original metadata row.
    const provenance = readJson('supabase/migrations/MIGRATION_PROVENANCE.json');
    const fileOf = row => row.file ?? `${row.version}_${row.name}.sql`;
    provenance.live_history_snapshot.entries = provenance.live_history_snapshot.entries.filter(row => selected.has(fileOf(row)));
    provenance.live_history_snapshot.migration_count = provenance.live_history_snapshot.entries.length;
    provenance.pending_forward_migrations = provenance.pending_forward_migrations.filter(row => selected.has(row.file));
    writeFileSync(join(root, 'supabase/migrations/MIGRATION_PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n');
    return run(root);
  } finally {
    assert.ok(resolve(root).startsWith(prefix) && resolve(root) !== prefix, 'TEMP_CLEANUP_BOUNDARY');
    rmSync(root, { recursive: true, force: true });
  }
}
