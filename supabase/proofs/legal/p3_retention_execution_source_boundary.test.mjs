import { historicalSource108Fixture } from '../historical_source108_fixture.mjs';
import assert from 'node:assert/strict';
import {ownedIntakeForward} from '../../../scripts/ci/owned-intake-source.mjs';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve,sep} from 'node:path';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {readP3RetentionPredecessorPlan as readCurrentPlan} from './p3_retention_schedule_predecessor.mjs';
import {retentionExecutionBoundary,retentionExecutionForward} from './p3_retention_execution_source_boundary.mjs';

// This historical planner intentionally remains closed to the larger integration source.
const readP3RetentionPredecessorPlan = (root) => root ? readCurrentPlan(root) : historicalSource108Fixture(readCurrentPlan);
test('expanded current source is rejected by the unchanged SQL108 boundary', () => {
  const current = readCurrentPlan();
  assert.ok(current.source_migration_count > 108);
  assert.throws(() => retentionExecutionBoundary(current), /W03_EXACT_SOURCE108_REQUIRED/);
});

test('exact full source108 is admitted before unchanged original registry assertions at104',()=>{
  const plan=readP3RetentionPredecessorPlan(),boundary=retentionExecutionBoundary(plan);
  assert.equal(plan.source_migration_count,108);
  assert.deepEqual(boundary.fullPlan,plan);
  assert.equal(boundary.predecessorPlan.source_migration_count,104);
  assert.equal(boundary.predecessorPlan.source_inventory.length,104);
  assert.deepEqual([...boundary.predecessorPlan.pending_successors,boundary.next,...boundary.deferredSuccessors],plan.pending_successors);
  assert.equal(boundary.next.file,retentionExecutionForward);
  assert.equal(boundary.predecessorPlan.source_inventory.at(-1).file,'20260910153005_clean_p2_export_delivery_authority.sql');
});

test('missing, extra, unknown, reordered or altered suffix identities fail before registry replay',()=>{
  const plan=readP3RetentionPredecessorPlan();
  for(const count of [103,104,105,106,107,109])assert.throws(()=>retentionExecutionBoundary({...plan,source_migration_count:count}));
  for(const field of ['pending_successors','source_inventory']){
    const changed=structuredClone(plan);changed[field].at(-1).file='20260910162956_unknown.sql';
    assert.throws(()=>retentionExecutionBoundary(changed));
    const reordered=structuredClone(plan);reordered[field].splice(-2,2,...reordered[field].slice(-2).reverse());
    assert.throws(()=>retentionExecutionBoundary(reordered));
  }
  for(const index of [-2,-1])for(const field of ['md5']){
    const changed=structuredClone(plan);changed.pending_successors.at(index)[field]='changed';
    assert.throws(()=>retentionExecutionBoundary(changed));
  }
});

for(const mutation of ['missing','changed','unknown'])test('full admission rejects '+mutation+' SQL105 before any original registry write',()=>historicalSource108Fixture(sourceRoot => {
  const root=mkdtempSync(join(tmpdir(),'p3-execution-admission-'));
  assert.ok(root.startsWith(resolve(tmpdir())+sep)&&basename(root).startsWith('p3-execution-admission-'));
  try{
    const predecessor='supabase/proofs/legal/p3_retention_schedule_predecessor_files.json';
    const admitted=JSON.parse(readFileSync(join(sourceRoot,predecessor),'utf8'));
    const paths=[predecessor,'supabase/proofs/legal/p3_retention_schedule_files.json',
      admitted.d03.manifest,admitted.ai_draft.manifest,'supabase/migrations/MIGRATION_PROVENANCE.json',
      ...readdirSync(join(sourceRoot,'supabase/migrations')).filter(x=>x.endsWith('.sql')).map(x=>'supabase/migrations/'+x)];
    for(const path of paths){const target=join(root,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(sourceRoot,path),target);}
    assert.equal(retentionExecutionBoundary(readP3RetentionPredecessorPlan(root)).fullPlan.source_migration_count,108);
    const target=join(root,'supabase/migrations',retentionExecutionForward);
    if(mutation==='missing')rmSync(target);
    if(mutation==='changed')writeFileSync(target,'-- altered SQL105 bytes\n');
    if(mutation==='unknown')renameSync(target,join(dirname(target),'20260910162956_unknown.sql'));
    assert.throws(()=>retentionExecutionBoundary(readP3RetentionPredecessorPlan(root)),/SOURCE_PROVENANCE_INVENTORY_MISMATCH|PENDING_MD5_CHANGED/);
  }finally{rmSync(root,{recursive:true,force:true});}
}));

// Execute the actual proof helper, replacing only local SQL transport/time.
const proofSource=readFileSync('supabase/proofs/legal/p3_retention_execution_proof.mjs','utf8');
const cronSource=proofSource.split('// BEGIN_LOCAL_CRON_ISOLATION:')[1].split('\n').slice(1).join('\n').split('// END_LOCAL_CRON_ISOLATION')[0];
function cronHarness(options={}){
  let time=0,polls=0,reads=0;
  const original={jobid:7,schedule:'* * * * *',command:'select private.marketplace_tick(25);',nodename:'localhost',
    nodeport:5432,database:'postgres',username:'postgres',active:options.active??true,jobname:'uskoci_marketplace_tick',...options.definition};
  let definition=structuredClone(original);const writes=[],report={};
  // SQL rows are JSON; normalize only the VM realm prototypes, preserving all keys/values.
  const json=value=>JSON.parse(JSON.stringify(value));
  const context={assert:{...assert,deepEqual:(actual,expected,message)=>assert.deepEqual(json(actual),json(expected),message)},assertLocalDeviceProofTargets,report,structuredClone,
    url:options.url??'http://127.0.0.1:54321',db:'postgresql://postgres:disposable@127.0.0.1:54322/postgres',
    q:value=>"'"+String(value).replaceAll("'","''")+"'",Date:{now:()=>time},
    sleep:async ms=>{time+=ms;},
    rows:query=>{
      reads++;
      if(query.includes('to_jsonb(j) definition'))return [{definition:structuredClone(definition)}];
      assert.ok(query.includes("jobid='7'::bigint"),'only exact named job is inspected');
      if(query.includes('pg_stat_activity'))return options.backends?.(polls)??[];
      polls++;return options.runs?.(polls)??[];
    },
    sql:query=>{
      reads++;
      if(query.includes("current_setting('cron.log_run')"))return options.logRun??'on';
      assert.match(query,/^begin;set local lock_timeout='5s';select cron\.alter_job\(job_id:='7'::bigint,\s+active:=(true|false)\);commit;$/);
      assert.ok(!/update cron\.job|unschedule|cron\.schedule|pg_terminate|pg_cancel|grant /i.test(query));
      const active=query.match(/active:=(true|false)/)[1]==='true';writes.push(active);definition.active=active;
      if(options.pauseAckFails&&!active)throw new Error('PAUSE_ACK_UNKNOWN');
      return '';
    }};
  runInNewContext(cronSource+'\nglobalThis.operations={pauseLocalCron,restoreLocalCron};',context);
  return {original,writes,report,operations:context.operations,definition:()=>definition,
    replaceDefinition:value=>{definition=value;},reads:()=>reads,time:()=>time,polls:()=>polls};
}

test('local scheduler isolation drains starting/running job and backend before fixtures, then restores exact row',async()=>{
  const h=cronHarness({runs:n=>n<3?[{runid:'91',job_pid:42,status:n===1?'starting':'running'}]:[],
    backends:n=>n<4?[{pid:42,state:'active'}]:[]});
  try{
    await h.operations.pauseLocalCron();
    assert.equal(h.report.local_scheduler.drained,true);assert.equal(h.definition().active,false);
    assert.ok(h.polls()>=11);assert.ok(h.time()<15000);
  }finally{h.operations.restoreLocalCron();}
  assert.deepEqual(h.writes,[false,true]);assert.deepEqual(h.definition(),h.original);
  assert.equal(h.report.local_scheduler.restored,true);
});
test('already inactive exact local job remains inactive without any mutation',async()=>{
  const h=cronHarness({active:false});try{await h.operations.pauseLocalCron();}finally{h.operations.restoreLocalCron();}
  assert.deepEqual(h.writes,[]);assert.deepEqual(h.definition(),h.original);
});
test('nonterminal exact invocation times out before fixtures and still restores active state',async()=>{
  const h=cronHarness({runs:()=>[{runid:'92',job_pid:null,status:'starting'}]});let fixtures=false;
  try{await assert.rejects(async()=>{await h.operations.pauseLocalCron();fixtures=true;},/LOCAL_CRON_DRAIN_TIMEOUT/);}
  finally{h.operations.restoreLocalCron();}
  assert.equal(fixtures,false);assert.equal(h.report.local_scheduler.drained,false);assert.equal(h.report.local_scheduler.restored,true);
  assert.deepEqual(h.writes,[false,true]);assert.ok(h.time()<=15200);
});
test('running backend prevents readiness even if cron already recorded terminal status',async()=>{
  const h=cronHarness({backends:()=>[{pid:43,state:'active'}]});
  try{await assert.rejects(h.operations.pauseLocalCron(),/LOCAL_CRON_DRAIN_TIMEOUT/);}
  finally{h.operations.restoreLocalCron();}
  assert.equal(h.report.local_scheduler.drained,false);assert.deepEqual(h.writes,[false,true]);
});
test('nonlocal target, altered named command and disabled run log reject before scheduler mutation',async()=>{
  for(const options of [{url:'https://project.supabase.co'},{definition:{command:'select other_tick();'}},{logRun:'off'}]){
    const h=cronHarness(options);await assert.rejects(h.operations.pauseLocalCron());h.operations.restoreLocalCron();assert.deepEqual(h.writes,[]);
    if(options.url)assert.equal(h.reads(),0);
  }
});
test('uncertain pause acknowledgement is restored from actual row instead of assuming no write',async()=>{
  const h=cronHarness({pauseAckFails:true});
  try{await assert.rejects(h.operations.pauseLocalCron(),/PAUSE_ACK_UNKNOWN/);}finally{h.operations.restoreLocalCron();}
  assert.deepEqual(h.writes,[false,true]);assert.deepEqual(h.definition(),h.original);
});
test('an unrelated definition change is never overwritten by restoration',async()=>{
  const h=cronHarness();await h.operations.pauseLocalCron();h.replaceDefinition({...h.definition(),schedule:'0 * * * *'});
  assert.throws(()=>h.operations.restoreLocalCron(),/LOCAL_CRON_DEFINITION_CHANGED/);
  assert.deepEqual(h.writes,[false]);assert.equal(h.report.local_scheduler.restored,false);
});
test('failure after isolation restores scheduler while preserving the original failure',async()=>{
  const h=cronHarness();
  await assert.rejects(async()=>{try{await h.operations.pauseLocalCron();throw new Error('ORIGINAL_ASSERTION');}
    finally{h.operations.restoreLocalCron();}},/ORIGINAL_ASSERTION/);
  assert.equal(h.report.local_scheduler.restored,true);assert.deepEqual(h.definition(),h.original);
  assert.match(proofSource,/try\{\s+await pauseLocalCron\(\);/);
  assert.match(proofSource,/if\(report\.result!=='FAIL'\)\{report\.failed_check='LOCAL_CRON_RESTORE'/);
  assert.match(proofSource,/check\('EXISTING_MARKETPLACE_TICK_INVOKES_ADAPTER_AND_PRESERVES_EXPORT_OWNER'\)/);
  assert.match(proofSource,/assert\.equal\(report\.checks\.length,16\)/);
});
