import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

/** Reuse the admitted ordered suffix; the caller snapshots its own real RPC,
 * tables, policies, functions and ACLs before and after the same migration bytes.
 * This harness does not apply production migrations or choose legal policy.
 */
export async function replayPendingDomain({ plan, snapshot, sql, db, url }) {
  assertLocalDeviceProofTargets(url, db);
  const q = value => "'" + String(value).replaceAll("'", "''") + "'";
  const before = await snapshot();
  const applied = [];
  for (const next of plan.pending_successors) {
    assert.match(next.file, /^\d{14}_[a-z0-9_]+\.sql$/);
    assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version=${q(next.version)}`), '0');
    const file = `supabase/migrations/${next.file}`;
    const bytes = readFileSync(file);
    assert.equal(createHash('md5').update(bytes).digest('hex'), next.md5);
    execFileSync('psql', [db, '-X', '-v', 'ON_ERROR_STOP=1', '-f', file], { stdio: 'pipe' });
    sql(`insert into supabase_migrations.schema_migrations(version,name,statements)
      values(${q(next.version)},${q(next.name)},array[${q(bytes.toString('utf8'))}])`);
    assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${q(next.version)}`), next.md5);
    applied.push(next);
  }
  sql("notify pgrst,'reload schema'");
  assert.deepEqual(await snapshot(), before, 'DOMAIN_STATE_SECURITY_OR_RPC_CHANGED_BY_SUCCESSOR');
  return { count: applied.length, applied, domain_state_security_and_projection_unchanged: true };
}
