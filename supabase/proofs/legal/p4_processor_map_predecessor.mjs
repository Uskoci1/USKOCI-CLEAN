// Reconstruct the exact live87 predecessor plus any earlier pending forward files
// on a disposable loopback target. Importing the inventory reader performs no
// database or network operation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readPendingSourcePlan } from './pending_source_plan.mjs';
import { fileURLToPath } from 'node:url';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');

export function readP4ProcessorPredecessorPlan(root = process.cwd()) {
  return readPendingSourcePlan({ root, domain: 'P4',
    unitManifest: 'supabase/proofs/legal/p4_processor_map_files.json',
    predecessorManifest: 'supabase/proofs/legal/p4_processor_map_predecessor_files.json' });
}

function applyDisposablePredecessor() {
  const env = process.env;
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  const plan = readP4ProcessorPredecessorPlan();
  const out = env.P4_ARTIFACT_DIR || 'artifacts/p4-processor-map';
  mkdirSync(out, { recursive: true });
  const report = { result: 'RUNNING', source_sha: env.GITHUB_SHA ?? null,
    live_access: false, provider_called: false, plan };
  const quote = value => `'${String(value).replaceAll("'", "''")}'`;
  const sql = query => execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const history = where => sql(`select coalesce(jsonb_agg(to_jsonb(m) order by version),'[]'::jsonb)::text
    from supabase_migrations.schema_migrations m where ${where}`);
  const bodyMd5 = signature => sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${quote(signature)})`);
  let stage = 'ORIGINAL_HISTORY_PREFLIGHT';
  try {
    const before = history('true');
    assert.equal(JSON.parse(before).length, plan.historical_predecessor_count - 2, 'UNEXPECTED_LIVE85_BASELINE');
    report.original_full_history_sha256 = digest('sha256', before);
    const applied = [];
    for (const dep of [plan.d03, plan.ai_draft]) {
      const { forward_file, forward_version, forward_name, md5 } = dep;
      stage = `EXACT_FORWARD_APPLY:${forward_name}`;
      assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version=${quote(forward_version)}`), '0');
      const file = `supabase/migrations/${forward_file}`, bytes = readFileSync(file);
      execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-f', file], { stdio: 'pipe' });
      stage = `HISTORY_RECORD:${forward_name}`;
      sql(`insert into supabase_migrations.schema_migrations(version,name,statements)
        values(${quote(forward_version)},${quote(forward_name)},array[${quote(bytes.toString('utf8'))}])`);
      assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(forward_version)}`), md5);
      for (const [signature, expected] of Object.entries(dep.resulting_body_md5)) {
        assert.equal(bodyMd5(signature), expected, `DEPENDENCY_BODY_MISMATCH:${signature}`);
      }
      applied.push({ forward_version, forward_name, md5 });
    }

    stage = 'LIVE87_POSTFLIGHT';
    assert.equal(history(`version not in (${applied.map(a => quote(a.forward_version)).join(',')})`), before,
      'ORIGINAL_FULL_HISTORY_CHANGED');
    assert.equal(sql("select to_regclass('private.processor_map_sets') is null"), 't', 'PROCESSOR_TABLE_UNEXPECTEDLY_PRESENT');
    assert.equal(sql("select to_regprocedure('public.rpc_publish_processor_map(text,text,timestamptz,jsonb)') is null"), 't', 'PROCESSOR_RPC_UNEXPECTEDLY_PRESENT');

    const appliedPending = [];
    for (const dep of plan.pending_predecessors) {
      stage = `PENDING_PREDECESSOR_APPLY:${dep.name}`;
      assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version=${quote(dep.version)}`), '0');
      const file = `supabase/migrations/${dep.file}`, bytes = readFileSync(file);
      assert.equal(digest('md5', bytes), dep.md5, `PENDING_PREDECESSOR_BYTES_CHANGED:${dep.file}`);
      execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-f', file], { stdio: 'pipe' });
      stage = `PENDING_PREDECESSOR_HISTORY_RECORD:${dep.name}`;
      sql(`insert into supabase_migrations.schema_migrations(version,name,statements)
        values(${quote(dep.version)},${quote(dep.name)},array[${quote(bytes.toString('utf8'))}])`);
      assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(dep.version)}`), dep.md5);
      appliedPending.push(dep);
    }

    stage = 'ORDERED_PREDECESSOR_STACK_POSTFLIGHT';
    const excluded = [...applied.map(a => a.forward_version), ...appliedPending.map(a => a.version)];
    assert.equal(history(`version not in (${excluded.map(quote).join(',')})`), before,
      'ORIGINAL_BASE_HISTORY_CHANGED_AFTER_PENDING_PREDECESSORS');
    assert.equal(sql("select to_regclass('private.processor_map_sets') is null"), 't', 'PROCESSOR_TABLE_UNEXPECTEDLY_PRESENT_AFTER_PENDING_PREDECESSORS');
    assert.equal(sql("select to_regprocedure('public.rpc_publish_processor_map(text,text,timestamptz,jsonb)') is null"), 't', 'PROCESSOR_RPC_UNEXPECTEDLY_PRESENT_AFTER_PENDING_PREDECESSORS');
    sql("notify pgrst,'reload schema'");
    const after = history('true');
    assert.equal(JSON.parse(after).length, plan.expected_predecessor_count);
    report.applied_dependencies = applied;
    report.applied_pending_predecessors = appliedPending;
    report.original_full_history_unchanged = true;
    report.final_full_history_sha256 = digest('sha256', after);
    report.final_history_count = JSON.parse(after).length;
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL';
    report.failure = 'DISPOSABLE_PREDECESSOR_RECONSTRUCTION_FAILED';
    report.failed_stage = stage;
    report.failure_category = error?.code === 'ERR_ASSERTION' ? 'POSTFLIGHT_MISMATCH' : 'DISPOSABLE_SQL_FAILED';
    process.exitCode = 1;
  } finally {
    writeFileSync(`${out}/predecessor-integration-report.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.result} P4_PROCESSOR_PREDECESSOR_INTEGRATION`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--inspect') console.log(JSON.stringify(readP4ProcessorPredecessorPlan(), null, 2));
  else applyDisposablePredecessor();
}
