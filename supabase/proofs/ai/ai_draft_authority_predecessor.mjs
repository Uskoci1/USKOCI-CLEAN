// Reconstruct only admitted source dependencies on a disposable loopback target.
// Importing the inventory reader performs no database or network operation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
export function readAiAuthorityPredecessorPlan(root = process.cwd()) {
  const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const ai = readJson('supabase/proofs/ai/ai_draft_authority_files.json');
  const admitted = readJson('supabase/proofs/ai/ai_draft_authority_predecessor_files.json');
  const provenance = readJson('supabase/migrations/MIGRATION_PROVENANCE.json');
  const source = readdirSync(resolve(root, 'supabase/migrations'))
    .filter(name => name.endsWith('.sql')).sort().map(file => {
      assert.match(file, /^\d{14}_[a-z0-9_]+\.sql$/);
      const bytes = readFileSync(resolve(root, 'supabase/migrations', file));
      assert.ok(!bytes.includes(13), `SOURCE_CR_BYTE:${file}`);
      return { file, md5: digest('md5', bytes) };
    });
  const declared = [...provenance.live_history_snapshot.entries.map(entry =>
    entry.file ?? `${entry.version}_${entry.name}.sql`),
  ...provenance.pending_forward_migrations.map(entry => entry.file)];
  assert.deepEqual(source.map(entry => entry.file), declared, 'SOURCE_PROVENANCE_INVENTORY_MISMATCH');
  assert.equal(provenance.live_history_snapshot.migration_count, provenance.live_history_snapshot.entries.length);
  assert.equal(source.find(entry => entry.file === ai.forward_file)?.md5, ai.md5);
  const historical = source.filter(entry => ![ai.forward_file, admitted.d03.forward_file].includes(entry.file));
  const inventoryText = historical.map(entry => `${entry.md5}  ${entry.file}\n`).join('');
  assert.equal(digest('sha256', inventoryText), admitted.historical_inventory_sha256,
    'UNKNOWN_MISSING_OR_CHANGED_PREDECESSOR_SOURCE');
  assert.equal(historical.length, admitted.historical_file_count);
  let d03 = null;
  if (source.some(entry => entry.file === admitted.d03.forward_file)) {
    const current = readJson('supabase/proofs/notifications/d03_message_retry_files.json');
    for (const key of ['forward_file', 'forward_version', 'forward_name', 'bytes', 'md5', 'sha256']) {
      assert.equal(current[key], admitted.d03[key], `D03_FROZEN_MANIFEST_CHANGED:${key}`);
    }
    const bytes = readFileSync(resolve(root, 'supabase/migrations', current.forward_file));
    assert.deepEqual(bytes, readFileSync(resolve(root, current.candidate_file)));
    assert.equal(bytes.length, current.bytes);
    assert.equal(digest('md5', bytes), current.md5);
    assert.equal(digest('sha256', bytes), current.sha256);
    d03 = admitted.d03;
  }
  assert.equal(source.length, historical.length + (d03 ? 1 : 0) + 1);
  return {
    source_migration_count: source.length,
    historical_predecessor_count: historical.length,
    expected_predecessor_count: source.length - 1,
    historical_inventory_sha256: admitted.historical_inventory_sha256,
    source_inventory: source,
    d03,
  };
}

function applyDisposablePredecessor() {
  const env = process.env;
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  const plan = readAiAuthorityPredecessorPlan(); // Refuse unknown source before any SQL.
  const out = env.AI_AUTHORITY_ARTIFACT_DIR || 'artifacts/ai-draft-authority';
  mkdirSync(out, { recursive: true });
  const report = { result: 'RUNNING', source_sha: env.GITHUB_SHA ?? null,
    live_access: false, provider_called: false, plan };
  const quote = value => `'${String(value).replaceAll("'", "''")}'`;
  const sql = query => execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const history = where => sql(`select coalesce(jsonb_agg(to_jsonb(m) order by version),'[]'::jsonb)::text
    from supabase_migrations.schema_migrations m where ${where}`);
  let stage = 'ORIGINAL_HISTORY_PREFLIGHT';
  try {
    const before = history('true');
    assert.equal(JSON.parse(before).length, plan.historical_predecessor_count);
    report.original_full_history_sha256 = digest('sha256', before);
    if (plan.d03) {
      const { forward_file, forward_version, forward_name, md5 } = plan.d03;
      assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version=${quote(forward_version)}`), '0');
      const file = `supabase/migrations/${forward_file}`, bytes = readFileSync(file);
      stage = 'EXACT_D03_FORWARD_APPLY';
      execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-f', file], { stdio: 'pipe' });
      stage = 'D03_HISTORY_RECORD_AND_POSTFLIGHT';
      sql(`insert into supabase_migrations.schema_migrations(version,name,statements)
        values(${quote(forward_version)},${quote(forward_name)},array[${quote(bytes.toString('utf8'))}])`);
      assert.equal(history(`version<>${quote(forward_version)}`), before, 'ORIGINAL_FULL_HISTORY_CHANGED');
      assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(forward_version)}`), md5);
      assert.equal(sql("select md5(prosrc) from pg_proc where oid=to_regprocedure('public.rpc_send_agreement_message_v2(uuid,uuid,text,text)')"), '8020a93751f4915bffff0fac5524ad64');
      assert.equal(sql("select md5(prosrc) from pg_proc where oid='public.rpc_send_agreement_message(uuid,text)'::regprocedure"), 'd9a3733814e3101a3941284c07dc2bed');
      report.d03_exact_file_applied = true;
      report.d03_recorded_statement_md5 = md5;
      sql("notify pgrst,'reload schema'");
    } else {
      report.d03_exact_file_applied = false;
    }
    const after = history('true');
    assert.equal(JSON.parse(after).length, plan.expected_predecessor_count);
    report.original_full_history_unchanged = true;
    report.final_full_history_sha256 = digest('sha256', after);
    report.final_history_count = JSON.parse(after).length;
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL';
    // Preserve the failed boundary without emitting connection strings or SQL.
    report.failure = 'DISPOSABLE_PREDECESSOR_RECONSTRUCTION_FAILED';
    report.failed_stage = stage;
    report.failure_category = error?.code === 'ERR_ASSERTION' ? 'POSTFLIGHT_MISMATCH' : 'DISPOSABLE_SQL_FAILED';
    process.exitCode = 1;
  } finally {
    writeFileSync(`${out}/predecessor-integration-report.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.result} AI_DRAFT_PREDECESSOR_INTEGRATION`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--inspect') console.log(JSON.stringify(readAiAuthorityPredecessorPlan(), null, 2));
  else applyDisposablePredecessor();
}
