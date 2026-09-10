import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const base=process.env.P3_ARTIFACT_DIR||'artifacts/p3-retention-schedule';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const priorPath=base+'/proof-report.json',prior=read(priorPath);
assert.equal(prior.result,'PASS');
assert.equal(prior.source_sha,process.env.GITHUB_SHA);
assert.equal(prior.full_source_plan.source_migration_count,107);
assert.equal(prior.full_source_plan.source_inventory.length,107);
assert.equal(prior.predecessor_plan.source_migration_count,104);
assert.deepEqual(prior.deferred_authority_successors.map(x=>x.file),['20260910172132_clean_w03_owned_ai_intake_authority.sql','20260910193029_clean_n09_expo_push_transport.sql']);
assert.equal(prior.migration_history_count,104);
assert.equal(prior.intentional_next_execution_forward.file,'20260910162955_clean_p3_retention_execution_authority.sql');
assert.equal(prior.checks.length,8);
assert.ok(prior.checks.every(check=>check.result==='PASS'));
assert.equal(prior.purge_executed,false);
for(const file of prior.full_source_plan.source_inventory){
  const path='supabase/migrations/'+file.file;
  assert.equal(sha(path),file.sha256,path);
  assert.equal(readFileSync(path).length,file.bytes,path);
}

const report=read(base+'/retention-execution/proof-report.json');
assert.equal(report.result,'PASS');
assert.equal(report.unit,'P3_RETENTION_EXECUTION');
assert.equal(report.source_sha,process.env.GITHUB_SHA);
assert.equal(report.prior_registry_report_sha256,sha(priorPath));
assert.equal(report.predecessor_history_count,104);
assert.equal(report.migration_history_count,105);
assert.equal(report.technical_scope,'P3_AI_ABANDONED_UNBOUND_V1');
assert.equal(report.fixture_boundary,'REAL_LOCAL_AUTH_POSTGREST_AND_ROLE_SCOPED_PSQL');
assert.equal(report.policy_fixture,'DISPOSABLE_SYNTHETIC_ONLY_NOT_LEGAL_CONTENT');
assert.equal(report.abandonment_anchor,'EXPLICIT_DISPOSABLE_SQL_STATUS_TRANSITION');
const checks=[
  'PREFLIGHT_REAL_SOURCE104_AND_ORIGINAL_REGISTRY_REPORT',
  'EXACT_FORWARD_ADDITIVE_ONLY_PRESERVES_HISTORY_ACLS_POLICY_AND_LEGACY_ROWS',
  'REAL_AUTH_PRIVATE_TABLES_AND_SERVICE_ONLY_COMMAND_BOUNDARIES',
  'MISSING_EXECUTABLE_BINDING_STAYS_CLOSED_WITH_NO_JOB_OR_DELETION',
  'EXPLICIT_SYNTHETIC_TYPED_POLICY_STRICT_HASH_PRIVACY_AND_COVERAGE_BINDING',
  'OBSERVED_ORIGIN_NO_BACKFILL_ACTIVE_BOUND_FACT_PROPOSAL_AND_REPLAY_EVIDENCE_PROTECTED',
  'DETERMINISTIC_DUE_CLAIM_HOLD_SKIP_AND_CONCURRENT_SINGLE_INTENT',
  'ACTUAL_ATOMIC_DELETE_MESSAGES_AND_EXACT_ATTEMPT_REPLAY',
  'HOLD_AFTER_CLAIM_WINS_REVISION_REPLAY_RELEASE_AND_RECLAIM_FENCE',
  'LATE_CHILD_ACTIVITY_INVALIDATES_SOURCE_AND_PERMANENTLY_RETIRES_CANDIDATE',
  'POLICY_CHANGE_EXPIRED_LEASE_AND_BOUNDED_RETRY_EXHAUSTION',
  'DELETE_FAILURE_ROLLS_BACK_PARENT_AND_MESSAGES_BEFORE_RETRY',
  'OBSERVED_HOLD_TRANSACTION_BLOCKS_EXECUTE_AND_OTHER_ACCOUNT_PROGRESS_CONTINUES',
  'UNADMITTED_SOURCE_EXTENSION_FAILS_CLOSED_WITHOUT_ARBITRARY_DELETE',
  'EXISTING_MARKETPLACE_TICK_INVOKES_ADAPTER_AND_PRESERVES_EXPORT_OWNER',
  'RESTORE_SYNTHETIC_POLICY_INERT_FINAL_HISTORY_SECURITY_AND_MINIMAL_AUDIT',
];
assert.deepEqual(report.checks,checks.map(name=>({name,result:'PASS'})));
for(const key of ['original_source104_history_unchanged','original_columns_and_grants_preserved',
  'service_only_commands_proven','narrow_typed_adapter_only','active_bound_and_evidence_rows_protected',
  'claims_single_job_per_target','bounded_scan_fair_progress','actual_disposable_delete','exact_attempt_replay_proven',
  'post_claim_hold_precedence','reclaimed_attempt_fenced','late_source_change_protected','policy_rechecked',
  'lease_and_retry_limit_proven','atomic_failure_rollback_proven','observed_hold_lock','other_account_progress',
  'unadmitted_source_closed','existing_tick_wiring_proven','scheduler_fixture_rolled_back',
  'original_domain_rows_unchanged','policy_fixture_restored_inert','minimal_audit_proven','no_active_account_holds',
  'post_delete_hold_rejected'])assert.equal(report[key],true,key);
for(const key of ['live_access','live_promotion','provider_called','mobile_proof','legal_content_real',
  'policy_activated_live','mocked_rpc_responses','mocked_database','storage_called',
  'account_closure_proven','all_data_classes_executable','legacy_origin_backfilled','app_abandonment_journey_proven'])assert.equal(report[key],false,key);
assert.deepEqual(report.lock_interleavings.map(lock=>lock.case),[
  'COMMITTED_HOLD_BEFORE_WAITING_EXECUTION','COMMITTED_EXECUTE_BEFORE_WAITING_SCOPED_HOLD']);
for(const lock of report.lock_interleavings){
  assert.equal(lock.wait_event_type,'Lock');
  assert.equal(lock.blocked_by_holder,true);
  assert.ok(Number(lock.waiter_pid)>0);
  assert.ok(Number(lock.holder_pid)>0);
  assert.notEqual(lock.waiter_pid,lock.holder_pid);
}
const candidate=read('supabase/proofs/legal/p3_retention_execution_files.json');
assert.deepEqual(report.candidate,candidate);
for(const path of ['supabase/migrations/'+candidate.forward_file,
  'supabase/proofs/legal/p3_retention_execution_proof.mjs',
  'supabase/proofs/legal/p3_retention_execution_files.json',
  'supabase/proofs/legal/p3_retention_execution_source_boundary.mjs'])assert.equal(report.input_sha256[path],sha(path),path);
console.log('PASS P3_RETENTION_EXECUTION_RETAINED_REPORT_GATE');
