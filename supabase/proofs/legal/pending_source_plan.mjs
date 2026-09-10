// Shared extraction of the admitted P3 ordered-source reader. No SQL or network on import.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');

export function readPendingSourcePlan({ root = process.cwd(), unitManifest, predecessorManifest, domain }) {
  const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const unit = readJson(unitManifest);
  const admitted = readJson(predecessorManifest);
  const provenance = readJson('supabase/migrations/MIGRATION_PROVENANCE.json');
  const source = readdirSync(resolve(root, 'supabase/migrations'))
    .filter(name => name.endsWith('.sql')).sort().map(file => {
      assert.match(file, /^\d{14}_[a-z0-9_]+\.sql$/);
      const bytes = readFileSync(resolve(root, 'supabase/migrations', file));
      assert.ok(!bytes.includes(13), `SOURCE_CR_BYTE:${file}`);
      return {
        file,
        md5: digest('md5', bytes),
        sha256: digest('sha256', bytes),
        bytes: bytes.length,
      };
    });

  const liveEntries = provenance.live_history_snapshot.entries;
  const pendingEntries = provenance.pending_forward_migrations;
  const declared = [
    ...liveEntries.map(entry => entry.file ?? `${entry.version}_${entry.name}.sql`),
    ...pendingEntries.map(entry => entry.file),
  ];
  assert.deepEqual(source.map(entry => entry.file), declared, 'SOURCE_PROVENANCE_INVENTORY_MISMATCH');
  assert.equal(provenance.live_history_snapshot.migration_count, liveEntries.length);
  assert.equal(provenance.live_history_snapshot.migration_count, admitted.historical_file_count);
  assert.equal(provenance.live_history_snapshot.last.version, admitted.historical_live_head);

  const forward = source.find(entry => entry.file === unit.forward_file);
  assert.ok(forward, 'FORWARD_FILE_MISSING');
  assert.equal(forward.md5, unit.md5, 'FORWARD_FILE_CHANGED');
  assert.equal(forward.sha256, unit.sha256, 'FORWARD_FILE_SHA256_CHANGED');
  assert.equal(forward.bytes, unit.bytes, 'FORWARD_FILE_BYTES_CHANGED');

  // The frozen historical digest remains live87. Pending forward files are a
  // separate ordered stack and must not be folded into that digest.
  const liveFiles = new Set(liveEntries.map(entry => entry.file ?? `${entry.version}_${entry.name}.sql`));
  const historical = source.filter(entry => liveFiles.has(entry.file));
  const inventoryText = historical.map(entry => `${entry.md5}  ${entry.file}\n`).join('');
  assert.equal(digest('sha256', inventoryText), admitted.historical_inventory_sha256,
    'UNKNOWN_MISSING_OR_CHANGED_LIVE87_SOURCE');
  assert.equal(historical.length, admitted.historical_file_count);

  const unitPendingIndex = pendingEntries.findIndex(entry => entry.file === unit.forward_file);
  assert.ok(unitPendingIndex >= 0, `${domain}_PENDING_PROVENANCE_MISSING`);

  // Validate the complete declared pending inventory before any database
  // operation. A later unit is replayable only when its identity and all
  // recorded raw-byte fingerprints still match the repository source.
  const pending = pendingEntries.map(entry => {
    assert.equal(entry.classification, 'PENDING_FORWARD_MIGRATION',
      `PENDING_CLASSIFICATION_INVALID:${entry.file}`);
    assert.equal(entry.live_applied, false, `PENDING_ENTRY_MARKED_LIVE:${entry.file}`);
    assert.equal(entry.file, `${entry.version}_${entry.name}.sql`,
      `PENDING_IDENTITY_MISMATCH:${entry.file}`);
    const current = source.find(candidate => candidate.file === entry.file);
    assert.ok(current, `PENDING_FILE_MISSING:${entry.file}`);
    assert.equal(current.md5, entry.raw_md5, `PENDING_MD5_CHANGED:${entry.file}`);
    assert.equal(current.sha256, entry.raw_sha256, `PENDING_SHA256_CHANGED:${entry.file}`);
    assert.equal(current.bytes, entry.raw_bytes, `PENDING_BYTES_CHANGED:${entry.file}`);
    return {
      file: entry.file,
      version: String(entry.version),
      name: entry.name,
      md5: entry.raw_md5,
    };
  });

  assert.equal(pending[unitPendingIndex].file, unit.forward_file, `${domain}_UNIT_FILE_MISMATCH`);
  assert.equal(pending[unitPendingIndex].version, String(unit.forward_version), `${domain}_UNIT_VERSION_MISMATCH`);

  const pendingPredecessors = pending.slice(0, unitPendingIndex);
  const pendingSuccessors = pending.slice(unitPendingIndex + 1);
  for (const entry of pendingPredecessors) {
    assert.ok(entry.version < String(unit.forward_version),
      `PENDING_PREDECESSOR_ORDER_INVALID:${entry.file}`);
  }
  for (const entry of pendingSuccessors) {
    assert.ok(entry.version > String(unit.forward_version),
      `PENDING_SUCCESSOR_ORDER_INVALID:${entry.file}`);
  }

  // Later admitted forwards remain an ordered suffix. Each domain runs all
  // original assertions first, then replays this exact suffix and checks that
  // retention state, grants and original history remain intact.
  assert.equal(source.length, historical.length + pendingEntries.length);

  for (const dep of [admitted.d03, admitted.ai_draft]) {
    const current = readJson(dep.manifest);
    for (const key of ['forward_file', 'forward_version', 'forward_name', 'bytes', 'md5', 'sha256']) {
      assert.equal(current[key], dep[key], `FROZEN_DEPENDENCY_MANIFEST_CHANGED:${dep.forward_name}:${key}`);
    }
    const bytes = readFileSync(resolve(root, 'supabase/migrations', dep.forward_file));
    assert.equal(bytes.length, dep.bytes);
    assert.equal(digest('md5', bytes), dep.md5);
    assert.equal(digest('sha256', bytes), dep.sha256);
  }

  return {
    source_migration_count: source.length,
    historical_predecessor_count: historical.length,
    pending_predecessor_count: pendingPredecessors.length,
    expected_predecessor_count: historical.length + pendingPredecessors.length,
    historical_inventory_sha256: admitted.historical_inventory_sha256,
    source_inventory: source,
    pending_predecessors: pendingPredecessors,
    pending_successors: pendingSuccessors,
    pending_successor_count: pendingSuccessors.length,
    d03: admitted.d03,
    ai_draft: admitted.ai_draft,
  };
}
