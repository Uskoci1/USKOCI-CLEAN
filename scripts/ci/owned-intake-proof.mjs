import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertLocalDeviceProofTargets} from '../../supabase/proofs/ru5_device_ui_local_guard.mjs';
import {readP3RetentionPredecessorPlan} from '../../supabase/proofs/legal/p3_retention_schedule_predecessor.mjs';
import {ownedIntakeSourceBoundary} from './owned-intake-source.mjs';

const hash=(bytes,kind='sha256')=>createHash(kind).update(bytes).digest('hex');
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";

// Shared by targeted W03 and the coherent native journey. Existing isolated
// environment + Auth fixture must run first;106 is applied only by its proof.
export function prepare105(env=process.env) {
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
  const boundary=ownedIntakeSourceBoundary(readP3RetentionPredecessorPlan());
  const base=env.W03_INTAKE_ARTIFACT_DIR||'artifacts/w03-owned-intake',out=base+'/predecessor105';
  mkdirSync(out,{recursive:true});
  const childEnv={...env,N07_ARTIFACT_DIR:out+'/n07',N08_ARTIFACT_DIR:out+'/n08',P3_ARTIFACT_DIR:out+'/p3'};
  for(const path of [childEnv.N07_ARTIFACT_DIR,childEnv.N08_ARTIFACT_DIR,childEnv.P3_ARTIFACT_DIR])mkdirSync(path,{recursive:true});
  const report={result:'RUNNING',source_sha:env.GITHUB_SHA??null,unit:'W03_EXACT105_PREDECESSOR',
    full_source_plan:boundary.fullPlan,predecessor_plan:boundary.predecessorPlan,
    deferred_owned_intake:boundary.next,live_access:false,provider_called:false,
    historical_behavior_reproved:false,policy_activated:false,applied_prefix:[]};
  const sql=query=>{try{return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],
    {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024,timeout:30000}).trim();}
    catch(error){report.sqlstate=String(error.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNAVAILABLE';throw new Error('DISPOSABLE_PREFIX_SQL_FAILED');}};
  const history=()=>JSON.parse(sql('select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m'));
  const run=(script,log)=>{const stdout=execFileSync(process.execPath,[script],{env:childEnv,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024,timeout:120000});writeFileSync(out+'/'+log,stdout);};
  try {
    assert.equal(history().length,79,'EXISTING_LOCAL79_FIXTURE_REQUIRED');
    run('supabase/proofs/notifications/n07_forward_promotion_proof.mjs','n07.log');
    run('supabase/proofs/notifications/n08_preferences_proof.mjs','n08.log');
    run('supabase/proofs/legal/p3_retention_schedule_predecessor.mjs','p3-predecessor.log');
    const original=history();assert.equal(original.length,boundary.fullPlan.expected_predecessor_count);
    for(const entry of boundary.predecessorPlan.source_inventory.slice(original.length)) {
      const bytes=readFileSync('supabase/migrations/'+entry.file);
      assert.equal(bytes.length,entry.bytes);assert.equal(hash(bytes),entry.sha256);assert.equal(hash(bytes,'md5'),entry.md5);
      const version=entry.file.slice(0,14),name=entry.file.slice(15,-4);
      assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version=${quote(version)}`),'0');
      sql(bytes.toString('utf8'));
      sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(bytes.toString('utf8'))}])`);
      report.applied_prefix.push(entry);
    }
    const after=history();assert.equal(after.length,105);assert.deepEqual(after.slice(0,original.length),original);
    assert.equal(hash(after.at(-1).statements[0]),boundary.manifest.predecessor105_sha256);
    assert.equal(sql('select private.retention_ai_source_ready()'),'t');
    assert.equal(sql("select count(*) from private.retention_policy_sets where retention_execution is not null"),'0');
    sql("notify pgrst,'reload schema'");
    report.history_count=105;report.original_history_unchanged=true;report.source105_compatible=true;report.result='PASS';
  } catch(error) {report.result='FAIL';report.failure=error?.code==='ERR_ASSERTION'?'PREFIX_ASSERTION_FAILED':String(error.message).split('\n')[0].slice(0,100);throw new Error('W03_PREDECESSOR105_FAILED');}
  finally {writeFileSync(out+'/proof-report.json',JSON.stringify(report,null,2)+'\n');console.log(report.result+' W03_EXACT105_PREDECESSOR');}
}

export function admitOwnedIntake(env=process.env) {
  const base=env.W03_INTAKE_ARTIFACT_DIR||'artifacts/w03-owned-intake';
  const boundary=ownedIntakeSourceBoundary(readP3RetentionPredecessorPlan());
  const prior=JSON.parse(readFileSync(base+'/predecessor105/proof-report.json','utf8'));
  assert.equal(prior.result,'PASS');assert.equal(prior.source_sha,env.GITHUB_SHA);
  assert.equal(prior.history_count,105);assert.equal(prior.original_history_unchanged,true);
  assert.equal(prior.source105_compatible,true);assert.equal(prior.live_access,false);
  assert.deepEqual(prior.full_source_plan,boundary.fullPlan);
  assert.deepEqual(prior.predecessor_plan,boundary.predecessorPlan);
  assert.deepEqual(prior.deferred_owned_intake,boundary.next);
  const report=JSON.parse(readFileSync(base+'/proof-report.json','utf8'));
  assert.equal(report.result,'PASS');assert.equal(report.unit,'W03_OWNED_NEED_INTAKE');
  assert.equal(report.source_sha,env.GITHUB_SHA);assert.equal(report.migration_history_count,106);
  assert.deepEqual(report.candidate,boundary.manifest);
  assert.deepEqual(report.checks,[
    'EXACT105_PREDECESSOR_AND106_PRESERVATION','OWNED_OPEN_STABLE_UUID_REPLAY_AND_CROSS_ACCOUNT_FENCES',
    'DUPLICATE_CLAIM_AND_COMPLETION_PERSIST_EXACTLY_ONE_PAIR','EXPIRED_ATTEMPT_CANNOT_COMMIT_AFTER_NEW_GENERATION',
    'CONTEXT_CHANGE_REQUIRES_RETRY_WITH_FRESH_SERVER_CONTEXT','OLD_SERVICE_BYPASSES_CLOSED_WITH_LEGACY_SCHEMA_PRESERVED',
    'EXPLICIT_OWNED_ABANDONMENT_FENCES_ACTIVE_TURN_AND_P3_ORIGIN','CANONICAL_DRAFT_SAVE_AND_CLOSED_RECEIPT_REPLAY_PRESERVED',
    'ACTUAL_HANDLER_AUTH_SQL_RECEIPT_WITH_SYNTHETIC_PROVIDER','ABANDON_FIRST_COMPLETION_WAIT_OBSERVED',
    'COMPLETE_FIRST_ABANDON_WAIT_OBSERVED','AUTHORITATIVE_RATE_AND_PRIVATE_LEDGER_GRANTS',
  ].map(name=>({name,result:'PASS'})));
  assert.deepEqual(report.lock_interleavings.map(x=>x.order),['COMPLETE_THEN_CONFIRM','COMPLETE_THEN_CORRECT_V2',
    'CONFIRM_THEN_COMPLETE','LEGACY_COMPLETE_THEN_CORRECT','OPTIONAL_TURN_THEN_SAVE','ABANDON_THEN_COMPLETE','COMPLETE_THEN_ABANDON']);
  for(const lock of report.lock_interleavings)assert.ok(lock.observed.length>0&&lock.observed.every(x=>x.wait_event_type==='Lock'));
  for(const key of ['actual_database_proven','actual_edge_handler','actual_edge_auth_verified','actual_edge_persisted_once',
    'original_history_unchanged','original_functions_unchanged_except_two_closed_acls_and_four_named_bodies',
    'source105_compatible','explicit_owned_abandonment_proven','retention_future_origin_not_backfilled',
    'provider_response_stubbed','lease_expiry_and_rate_window_fixture_clock_simulated'])assert.equal(report[key],true,key);
  for(const key of ['live_access','live_promotion','provider_called','mocked_rpc_responses','mocked_database','edge_gateway_proven',
    'native_journey_proven','retention_policy_activated','provider_exactly_once_claimed','open_autoabandoned'])assert.equal(report[key],false,key);
  assert.deepEqual(report.changed_body_signatures,['public.rpc_save_need_draft_from_review(uuid,uuid,text)',
    'public.rpc_ai_confirm_fact(uuid)','public.rpc_ai_correct_fact_v2(uuid,jsonb,text)','public.rpc_ai_correct_fact(uuid,text)']);
  for(const path of ['supabase/migrations/'+boundary.manifest.forward_file,'supabase/proofs/ai/owned_intake_proof.mjs',
    'supabase/proofs/ai/owned_intake_edge_runtime.mjs','supabase/functions/uskoci-ai-interview/index.ts','src/contracts/needFactsV2.ts'])
    assert.equal(report.input_sha256[path],hash(readFileSync(path)),path);
  console.log('PASS W03_OWNED_INTAKE_RETAINED_REPORT');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv[2]==='prepare105')prepare105();
  else if(process.argv[2]==='admit')admitOwnedIntake();
  else throw new Error('Use prepare105 or admit');
}
