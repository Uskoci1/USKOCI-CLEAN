import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

/** Reuse the admitted ordered suffix; the caller snapshots its own real RPC,
 * tables, policies, functions and ACLs before and after the same migration bytes.
 * This harness does not apply production migrations or choose legal policy.
 */
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** PKG-013: an intentional later migration may change a domain's security or
 * projection. Such a change is admitted only through a recorded manifest that names
 * the successor files with their md5 and the exact before/after digest of every
 * changed snapshot key. Anything unrecorded still fails. No manifest = strict
 * "unchanged", exactly as before. The manifest never relabels a failed proof. */
export function readAdmittedSuccessorDelta(path) {
  if (!existsSync(path)) return null;
  const delta = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(delta.unit && Array.isArray(delta.attributed_successors) && delta.attributed_successors.length > 0, 'ADMITTED_DELTA_INCOMPLETE');
  assert.ok(delta.changed && Object.keys(delta.changed).length > 0, 'ADMITTED_DELTA_EMPTY');
  return delta;
}

/** A recorded delta may declare one named view for a changed key. STRIP_CATALOG_OID
 * removes only the catalog `oid` of each row of a JSON catalog listing: object ids of a
 * disposable database differ between builds while every security-relevant column
 * (owner, ACL, security definer, source, config) stays in the digest. Unchanged keys are
 * never normalised; they are compared exactly. */
const VIEWS = {
  EXACT: value => value,
  STRIP_CATALOG_OID: value => {
    const rows = JSON.parse(value);
    assert.ok(Array.isArray(rows), 'STRIP_CATALOG_OID_EXPECTS_CATALOG_ARRAY');
    return JSON.stringify(rows.map(row => Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'oid').sort(([a], [b]) => a.localeCompare(b)))));
  },
};
export function assertDomainSnapshotAfterSuccessors({ before, after, plan, admittedDelta = null, label = 'DOMAIN_STATE_SECURITY_OR_RPC_CHANGED_BY_SUCCESSOR' }) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const diverged = keys.filter(key => digest(before[key]) !== digest(after[key]));
  const changed = admittedDelta ? Object.keys(admittedDelta.changed) : [];
  const view = key => { const name = admittedDelta?.changed?.[key]?.view ?? 'EXACT'; assert.ok(VIEWS[name], 'ADMITTED_DELTA_UNKNOWN_VIEW:' + name); return VIEWS[name]; };
  try {
    if (admittedDelta) {
      assert.equal(admittedDelta.source_migration_count, plan.source_migration_count, 'ADMITTED_DELTA_SOURCE_COUNT_MISMATCH');
      for (const successor of admittedDelta.attributed_successors) {
        const pending = plan.pending_successors.find(entry => entry.file === successor.file);
        assert.ok(pending, 'ADMITTED_DELTA_SUCCESSOR_NOT_PENDING:' + successor.file);
        assert.equal(pending.md5, successor.md5, 'ADMITTED_DELTA_SUCCESSOR_IDENTITY:' + successor.file);
      }
      for (const key of changed) {
        assert.ok(keys.includes(key), 'ADMITTED_DELTA_UNKNOWN_KEY:' + key);
        assert.equal(digest(view(key)(before[key])), admittedDelta.changed[key].before_sha256, 'ADMITTED_DELTA_BEFORE_MISMATCH:' + key);
        assert.equal(digest(view(key)(after[key])), admittedDelta.changed[key].after_sha256, 'ADMITTED_DELTA_AFTER_MISMATCH:' + key);
      }
    }
    for (const key of keys) if (!changed.includes(key)) assert.deepEqual(after[key], before[key], `${label}:${key}`);
  } catch (error) {
    // Exact evidence for the next recorded delta; the proof stays FAIL.
    error.divergence = {
      keys: diverged,
      before_sha256: Object.fromEntries(diverged.map(key => [key, digest(before[key])])),
      after_sha256: Object.fromEntries(diverged.map(key => [key, digest(after[key])])),
      before: Object.fromEntries(diverged.map(key => [key, before[key]])),
      after: Object.fromEntries(diverged.map(key => [key, after[key]])),
    };
    throw error;
  }
  return {
    unchanged_keys: keys.filter(key => !changed.includes(key)),
    admitted_changed_keys: changed,
    admitted_delta_unit: admittedDelta ? admittedDelta.unit : null,
    attributed_successors: admittedDelta ? admittedDelta.attributed_successors.map(entry => entry.file) : [],
  };
}

/** Apply the plan's pending successors in order with exact byte identity and a registry
 * row each, then assert the original history is untouched and the registry equals the
 * plan's source count. Shared by the domain replay and by proofs that need the exact
 * current source before exercising the current client. */
export function applyPendingSuccessors({ plan, sql, db, url }) {
  assertLocalDeviceProofTargets(url, db);
  const q = value => "'" + String(value).replaceAll("'", "''") + "'";
  const original = sql("select coalesce(jsonb_agg(to_jsonb(m) order by version),'[]'::jsonb)::text from supabase_migrations.schema_migrations m");
  const originalVersions = JSON.parse(original).map(entry => q(entry.version));
  const applied = [];
  for (const next of plan.pending_successors) {
    assert.match(next.file, /^\d{14}_[a-z0-9_]+\.sql$/);
    assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version=${q(next.version)}`), '0');
    const file = `supabase/migrations/${next.file}`;
    const bytes = readFileSync(file);
    assert.equal(createHash('md5').update(bytes).digest('hex'), next.md5);
    const declared = plan.source_inventory.find(entry => entry.file === next.file);
    assert.ok(declared);
    assert.equal(bytes.length, declared.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), declared.sha256);
    execFileSync('psql', [db, '-X', '-v', 'ON_ERROR_STOP=1', '-f', file], { stdio: 'pipe' });
    sql(`insert into supabase_migrations.schema_migrations(version,name,statements)
      values(${q(next.version)},${q(next.name)},array[${q(bytes.toString('utf8'))}])`);
    assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${q(next.version)}`), next.md5);
    applied.push(next);
  }
  if (originalVersions.length) assert.equal(sql(`select coalesce(jsonb_agg(to_jsonb(m) order by version),'[]'::jsonb)::text
    from supabase_migrations.schema_migrations m where version in (${originalVersions.join(',')})`), original,
    'ORIGINAL_HISTORY_CHANGED_BY_SUCCESSOR');
  assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')), plan.source_migration_count);
  sql("notify pgrst,'reload schema'");
  return applied;
}

export async function replayPendingDomain({ plan, snapshot, sql, db, url, admittedDelta = null }) {
  assertLocalDeviceProofTargets(url, db);
  const before = await snapshot();
  const applied = applyPendingSuccessors({ plan, sql, db, url });
  const verdict = assertDomainSnapshotAfterSuccessors({ before, after: await snapshot(), plan, admittedDelta });
  return { count: applied.length, applied, original_history_unchanged: true,
    domain_state_security_and_projection_unchanged: verdict.admitted_changed_keys.length === 0,
    domain_state_matches_admitted_source: true, admitted_successor_delta: verdict };
}
