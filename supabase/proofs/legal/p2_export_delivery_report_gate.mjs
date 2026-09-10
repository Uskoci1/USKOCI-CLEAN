import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = process.env.P2_ARTIFACT_DIR || 'artifacts/p2-data-export';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const prior = read(base + '/proof-report.json');
assert.equal(prior.result, 'PASS');
assert.equal(prior.source_sha, process.env.GITHUB_SHA);
assert.equal(prior.full_source_plan.source_migration_count, 108);
assert.equal(prior.predecessor_plan.source_migration_count, 103);
assert.equal(prior.migration_history_count, 103);
assert.equal(prior.intentional_next_delivery_forward.file, '20260910153005_clean_p2_export_delivery_authority.sql');
assert.deepEqual(prior.deferred_authority_successors.map(x => x.file), ['20260910162955_clean_p3_retention_execution_authority.sql','20260910172132_clean_w03_owned_ai_intake_authority.sql','20260910193029_clean_n09_expo_push_transport.sql','20260910214845_clean_dispatch_need_lock_order.sql']);
assert.equal(prior.checks.length, 9);
assert.ok(prior.checks.every(check => check.result === 'PASS'));

const report = read((process.env.P2_DELIVERY_ARTIFACT_DIR || base + '/delivery') + '/proof-report.json');
assert.equal(report.result, 'PASS');
assert.equal(report.source_sha, process.env.GITHUB_SHA);
assert.equal(report.history_count, 104);
const checks = [
  'EXACT_SOURCE103_TO104_PRESERVES_OLD_REQUESTS_ACLS_AND_HISTORY',
  'REAL_FIXTURE_AUTH_AND_CLOSED_PRIVATE_SERVICE_SURFACES',
  'MISSING_REVIEWED_DELIVERY_POLICY_NEVER_CLAIMS_OR_EXPOSES_ARTIFACT',
  'EXPLICIT_SYNTHETIC_P1_P3_POLICY_AND_COMPILED_FIELD_ADMISSION',
  'ACTUAL_WORKER_UPLOAD_READBACK_READY_AND_ACTUAL_DOWNLOAD_BYTES',
  'FOREIGN_ANON_DIRECT_STORAGE_AND_STALE_GENERATION_DENIED',
  'DOWNLOAD_GRANT_ROTATION_EXPIRY_AND_REVOCATION_RECHECK',
  'ACTUAL_EXACT_OBJECT_CLEANUP_AFTER_WRITER_LEASE_AND_SNAPSHOT_PURGE',
  'LATE_REAL_UPLOAD_TO_RETIRED_EXACT_GENERATION_IS_RECONCILED',
  'SHORTER_CONFIGURED_SNAPSHOT_RETENTION_KEEPS_VERIFIED_ARTIFACT_AVAILABLE',
  'UNCERTAIN_REAL_COMPLETION_DOES_NOT_DELETE_COMMITTED_ARTIFACT',
  'STALE_ATTEMPT_RECLAIM_CANNOT_COMMIT_OR_REVOKE_WINNER',
  'POLICY_CHANGE_BETWEEN_PHYSICAL_STORAGE_VERIFY_AND_READY_IS_CLOSED',
  'OBSERVED_CANCEL_CLAIM_SHARE_EXISTING_ACCOUNT_SERIALIZATION',
  'GLOBAL_PREPARE_AND_CLEANUP_SKIP_BUSY_ACCOUNT_AND_PROGRESS_OTHER_OWNER',
  'OVERSIZED_OLDEST_SNAPSHOT_IS_NOT_TRUNCATED_OR_GLOBAL_STARVATION',
  'FINAL_HISTORY_RESTORED_INERT_POLICY_AND_NO_FALSE_SCHEDULER_CLAIM',
];
assert.deepEqual(report.checks, checks.map(name => ({ name, result: 'PASS' })));
for (const key of ['original_source103_history_unchanged', 'actual_handler', 'actual_worker_storage_upload_readback',
  'actual_authenticated_download_bytes', 'actual_storage_cleanup_readback', 'actual_late_storage_commit_reconciled',
  'global_busy_account_skipped', 'actual_internal_tick_handler', 'oversized_snapshot_never_truncated',
  'global_oversized_account_skipped', 'policy_fixture_restored_inert']) assert.equal(report[key], true, key);
for (const key of ['live_access', 'live_promotion', 'legal_content_real', 'policy_activated_live', 'mocked_rpc_responses',
  'mocked_storage', 'ready_fixture_sql', 'edge_gateway_proven', 'physical_device_proven',
  'production_scheduler_wired', 'binary_media_export', 'full_account_completeness_claim']) assert.equal(report[key], false, key);
assert.equal(report.lock_interleavings.length, 2);
assert.deepEqual(report.lock_interleavings.map(x => x.case), ['CANCEL_THEN_CLAIM', 'CLAIM_THEN_CANCEL']);
assert.ok(report.lock_interleavings.every(x => Number(x.observed_waiters) > 0));
for (const channel of ['auth', 'rpc', 'storage']) assert.ok(report.transport_counts[channel] > 0, channel);
const candidate = read('supabase/proofs/legal/p2_export_delivery_files.json');
assert.deepEqual(report.candidate, candidate);
for (const path of ['supabase/migrations/' + candidate.forward_file, 'supabase/functions/_shared/data-export.ts',
  'supabase/functions/uskoci-data-export-worker/index.ts', 'supabase/functions/uskoci-data-export-download/index.ts']) {
  assert.equal(report.input_sha256[path], createHash('sha256').update(readFileSync(path)).digest('hex'), path);
}
console.log('PASS P2_EXPORT_DELIVERY_RETAINED_REPORT_GATE');
