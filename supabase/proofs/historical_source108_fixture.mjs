// Test-only frozen PR101 SQL108 boundary. Never a current integration or deployment plan.
// Source: 1138d4f727735519b15d9b834bf261954e8013fe: supabase/migrations/MD5_MANIFEST.txt.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

const LAST = '20260910214845_clean_dispatch_need_lock_order.sql';
const INVENTORY_SHA256 = '5e8b987de52bf700937cc536f063eca105398bd4c98e86dc4de6cae20f400130';

export function historicalSource108Fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'uskoci-frozen108-'));
  try {
    const files = readdirSync('supabase/migrations').filter(file => file.endsWith('.sql') && file <= LAST).sort();
    assert.equal(files.length, 108, 'FROZEN108_FILE_COUNT_CHANGED');
    const inventory = files.map(file => `${createHash('md5').update(readFileSync('supabase/migrations/' + file)).digest('hex')}  ${file}\n`).join('');
    assert.equal(createHash('sha256').update(inventory).digest('hex'), INVENTORY_SHA256, 'FROZEN108_BYTES_CHANGED');
    const selected = new Set(files);
    const copy = path => {
      assert.ok(path.startsWith('supabase/') && !path.split('/').includes('..'), 'FIXTURE_PATH_OUTSIDE_SOURCE');
      mkdirSync(dirname(join(root, path)), { recursive: true });
      cpSync(path, join(root, path));
    };
    for (const file of files) copy('supabase/migrations/' + file);
    function copyManifests(directory) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = directory + '/' + entry.name;
        if (entry.isDirectory()) copyManifests(path);
        else if (entry.isFile() && entry.name.endsWith('_files.json')) {
          copy(path);
          const candidate = JSON.parse(readFileSync(path, 'utf8')).candidate_file;
          if (candidate) copy(candidate);
        }
      }
    }
    copyManifests('supabase/proofs');
    const provenance = JSON.parse(readFileSync('supabase/migrations/MIGRATION_PROVENANCE.json', 'utf8'));
    // The frozen historical87 snapshot is untouched. Only later candidate rows are excluded from this test fixture.
    provenance.pending_forward_migrations = provenance.pending_forward_migrations.filter(row => selected.has(row.file));
    writeFileSync(join(root, 'supabase/migrations/MIGRATION_PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n');
    writeFileSync(join(root, 'supabase/migrations/MD5_MANIFEST.txt'), inventory);
    return run(root);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'uskoci-frozen108-'), 'FIXTURE_CLEANUP_BOUNDARY');
    rmSync(root, { recursive: true, force: true });
  }
}
