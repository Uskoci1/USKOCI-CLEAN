// Reconstruct the exact live87 predecessor plus any earlier pending forward files
// on a disposable loopback target. Importing the inventory reader performs no
// database or network operation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');

export function readP2ExportPredecessorPlan(root = process.cwd()) {
  const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const unit = readJson('supabase/proofs/legal/p2_data_export_files.json');
  const admitted = readJson('supabase/proofs/legal/p2_data_export_predecessor_files.json');
  const provenance = readJson('supabase/migrations/MIGRATION_PROVENANCE.json');
  const source = readdirSync(resolve(root, 'supabase/migrations'))
    .filter(name => name.endsWith('.sql')).sort().map(file => {
      assert.match(file, /^\d{14}_[a-z0-9_]+\.sql$/);
      const bytes = readFileSync(resolve(root, 'supabase/migrations', file));
      assert.ok(!bytes.includes(13), `SOURCE_CR_BYTE:${file}`);
      return { file, md5: digest('md5', bytes), sha256:digest('sha256',bytes), bytes:bytes.length };
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

  // The frozen historical digest remains live87. Earlier pending files are a
  // separate ordered forward stack and must not be folded into that digest.
  const liveFiles = new Set(liveEntries.map(entry => entry.file ?? `${entry.version}_${entry.name}.sql`));
  const historical = source.filter(entry => liveFiles.has(entry.file));
  const inventoryText = historical.map(entry => `${entry.md5}  ${entry.file}\n`).join('');
  assert.equal(digest('sha256', inventoryText), admitted.historical_inventory_sha256,
    'UNKNOWN_MISSING_OR_CHANGED_LIVE87_SOURCE');
  assert.equal(historical.length, admitted.historical_file_count);

  const unitPendingIndex = pendingEntries.findIndex(entry => entry.file === unit.forward_file);
  assert.ok(unitPendingIndex >= 0, 'P2_PENDING_PROVENANCE_MISSING');
  const pendingPredecessors = pendingEntries.slice(0, unitPendingIndex).map(entry => {
    assert.equal(entry.live_applied, false, `PENDING_PREDECESSOR_MARKED_LIVE:${entry.file}`);
    assert.ok(String(entry.version) < String(unit.forward_version), `PENDING_PREDECESSOR_ORDER_INVALID:${entry.file}`);
    const current = source.find(candidate => candidate.file === entry.file);
    assert.ok(current, `PENDING_PREDECESSOR_FILE_MISSING:${entry.file}`);
    assert.equal(current.md5, entry.raw_md5, `PENDING_PREDECESSOR_MD5_CHANGED:${entry.file}`);
    assert.equal(current.sha256,entry.raw_sha256,'PENDING_SHA256_CHANGED:'+entry.file);
    assert.equal(current.bytes,entry.raw_bytes,'PENDING_BYTES_CHANGED:'+entry.file);
    return {
      file: entry.file,
      version: String(entry.version),
      name: entry.name,
      md5: entry.raw_md5,
    };
  });

  // Later admitted forwards remain a separate ordered suffix. P2 is proved
  // at its own position first, then each successor is replayed and checked
  // not to mutate export rows, projection, grants or original history.
  const pendingSuccessors = pendingEntries.slice(unitPendingIndex + 1).map(entry => {
    assert.equal(entry.live_applied, false, `PENDING_SUCCESSOR_MARKED_LIVE:${entry.file}`);
    assert.ok(String(entry.version) > String(unit.forward_version), `PENDING_SUCCESSOR_ORDER_INVALID:${entry.file}`);
    const current = source.find(candidate => candidate.file === entry.file);
    assert.ok(current, `PENDING_SUCCESSOR_FILE_MISSING:${entry.file}`);
    assert.equal(current.md5, entry.raw_md5, `PENDING_SUCCESSOR_MD5_CHANGED:${entry.file}`);
    assert.equal(current.sha256,entry.raw_sha256,'PENDING_SHA256_CHANGED:'+entry.file);
    assert.equal(current.bytes,entry.raw_bytes,'PENDING_BYTES_CHANGED:'+entry.file);
    return { file: entry.file, version: String(entry.version), name: entry.name, md5: entry.raw_md5 };
  });

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

function applyDisposablePredecessor() {
  const env = process.env;
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  const plan = readP2ExportPredecessorPlan(); // Refuse unknown source before any SQL.
  const out = env.P2_ARTIFACT_DIR || 'artifacts/p2-data-export';
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
    // N07/N08 proofs leave the disposable at live85 before this integration step.
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
    assert.equal(sql("select to_regclass('public.data_export_requests') is null"), 't', 'EXPORT_TABLE_UNEXPECTEDLY_PRESENT');
    assert.equal(sql("select to_regprocedure('public.rpc_request_data_export(text)') is null"), 't', 'EXPORT_RPC_UNEXPECTEDLY_PRESENT');

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
    assert.equal(sql("select to_regclass('public.data_export_requests') is null"), 't', 'EXPORT_TABLE_UNEXPECTEDLY_PRESENT_AFTER_PENDING_PREDECESSORS');
    assert.equal(sql("select to_regprocedure('public.rpc_request_data_export(text)') is null"), 't', 'EXPORT_RPC_UNEXPECTEDLY_PRESENT_AFTER_PENDING_PREDECESSORS');
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
    console.log(`${report.result} P2_EXPORT_PREDECESSOR_INTEGRATION`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--inspect') console.log(JSON.stringify(readP2ExportPredecessorPlan(), null, 2));
  else applyDisposablePredecessor();
}
