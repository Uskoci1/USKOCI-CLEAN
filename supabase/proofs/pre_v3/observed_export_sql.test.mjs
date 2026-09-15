// Synthetic process/clock transports only: no database, provider, Storage or CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {OBSERVED_SQL_LIMITS as limits,ObservedSqlError,createObservedSqlRunner,createSqlStateCollector,
 sanitizeSqlObservation,sanitizeSqlSettings,safeSqlFailure,restoreObservedSql,observeSqlActivity} from './observed_export_sql.mjs';

const secret='PRIVATE_PAYLOAD_TOKEN_PASSWORD';
const settings={jit:true,jit_above_cost:100000,jit_inline_above_cost:500000,jit_optimize_above_cost:500000,plan_cache_mode:'auto',server_version_num:170004};
const lock={locktype:'relation',mode:'AccessExclusiveLock',relation_oid:12345,relation:'private.retention_policy_sets'};
const activity={pid:100,state:'active',wait_event_type:'Lock',wait_event:'relation',blocking_pids:[101],requested_locks:[lock],
 blockers:[{pid:101,state:'idle in transaction',wait_event_type:'Client',wait_event:'ClientRead',held_conflicting_relations:[{...lock,mode:'AccessShareLock'}]}]};
const observed=(a=activity)=>({settings,activity:[a]});
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function clock(){
 let time=0,next=0;const timers=new Map(),requested=[];
 return{now:()=>time,requested,setTimer(fn,ms){const id=++next;requested.push(ms);timers.set(id,{at:time+ms,fn});return id;},clearTimer(id){timers.delete(id);},
  async advance(ms){const target=time+ms;await flush();let steps=0;
   for(;;){const pending=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0]);if(!pending.length)break;
    assert.ok(++steps<1000,'Synthetic clock bounded');const [id,timer]=pending[0];timers.delete(id);time=timer.at;timer.fn();await flush();
   }time=target;await flush();},size:()=>timers.size};
}
function fixture({observeActivity=async()=>observed(),killThrows=false}={}){
 const report={},time=clock(),child=new EventEmitter(),calls=[];child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();
 child.stdin.end=body=>{child.input=body;};child.kills=[];child.kill=signal=>{child.kills.push(signal);if(killThrows)throw new Error(secret);return false;};
 const sql=createObservedSqlRunner({databaseUrl:'postgresql://proof:'+secret+'@127.0.0.1:54322/postgres',report,...time,observeActivity,
  spawnProcess:(...args)=>{calls.push(args);return child;}});
 return{report,time,child,calls,sql};
}
const close=(f,output='1',status=0)=>{f.child.stdout.emit('data',Buffer.from(output));f.child.emit('close',status);};
const containsNoPrivate=value=>assert.ok(!JSON.stringify(value).includes(secret));

test('observation projection bounds every collection and excludes query, identities and arbitrary nested data',()=>{
 const raw={...activity,query:secret,usename:secret,client_addr:secret,backend_start:secret,
  blocking_pids:[101,101,...Array.from({length:30},(_,i)=>102+i),-1,secret],
  requested_locks:[{...lock,query:secret},...Array.from({length:20},()=>({...lock,relation:'private.'+secret+'://url'}))],
  blockers:Array.from({length:20},(_,i)=>({...activity,pid:200+i,query:secret,held_conflicting_relations:Array(20).fill({...lock,query:secret})}))};
 const safe=sanitizeSqlObservation([raw,{...raw,pid:999}]);
 assert.equal(safe.pid,100);assert.equal(safe.blockingPids.length,8);assert.equal(safe.requestedLocks.length,8);assert.equal(safe.blockers.length,8);
 assert.equal(safe.requestedLocks[0].relation,'private.retention_policy_sets');assert.equal(safe.requestedLocks[1].relation,null);
 assert.ok(safe.blockers.every(b=>b.heldConflictingRelations.length===8));containsNoPrivate(safe);
 assert.equal(sanitizeSqlObservation([{...activity,pid:secret}]),null);assert.equal(sanitizeSqlObservation([{...activity,state:secret}]),null);
 assert.equal(sanitizeSqlObservation({activity:[raw]}),null);
 assert.deepEqual(sanitizeSqlObservation([{...activity,requested_locks:[{...lock,mode:secret}],wait_event:secret+'://query'}]).requestedLocks,[]);
});

test('settings accept only finite numeric values, boolean jit, supported plan mode and numeric server version',()=>{
 const safe=sanitizeSqlSettings({...settings,query:secret,connectionString:secret});
 assert.equal(safe.source,'SAME_DATABASE_OBSERVER_SESSION');assert.equal(Object.keys(safe).length,7);containsNoPrivate(safe);
 for(const patch of [{jit:'on'},{jit_above_cost:NaN},{jit_inline_above_cost:Infinity},{jit_optimize_above_cost:'100'},
  {plan_cache_mode:secret},{server_version_num:'170004'},{server_version_num:0}])assert.equal(sanitizeSqlSettings({...settings,...patch}),null);
 assert.equal(sanitizeSqlSettings({...settings,jit_above_cost:-1,plan_cache_mode:'force_custom_plan'}).jit_above_cost,-1);
});

test('SQLSTATE parser survives split lines while rejecting payload-bearing and overlong stderr',()=>{
 const parser=createSqlStateCollector();parser.push(Buffer.from('ERROR:  57'));parser.push(Buffer.from('014\r\n'));
 parser.push(Buffer.from(secret.repeat(1000)+'\nERROR:  23505 '+secret+'\nERROR:  lowercase\n'));
 assert.equal(parser.finish(),'57014');
 const malformed=createSqlStateCollector();malformed.push(Buffer.from('ERROR:  '+secret+'\nERROR:  22000 '+secret));assert.equal(malformed.finish(),null);
 const fatal=createSqlStateCollector();fatal.push(Buffer.from('FATAL:  28000'));assert.equal(fatal.finish(),'28000');
});

test('observer actual process boundary applies1s/64KiB/abort and selects only bounded metadata plus explicit settings',async()=>{
 const controller=new AbortController();let input,args;
 const value=await observeSqlActivity({databaseUrl:'synthetic:'+secret,applicationName:'uskoci-proof136-test',signal:controller.signal,
  execute:(...call)=>{args=call;const child={stdin:new EventEmitter()};child.stdin.end=sql=>{input=sql;queueMicrotask(()=>call[3](null,JSON.stringify(observed())));};return child;}});
 assert.deepEqual(value,observed());assert.equal(args[2].timeout,1000);assert.equal(args[2].maxBuffer,65536);assert.equal(args[2].signal,controller.signal);
 assert.equal(args[2].env.PGAPPNAME,'uskoci-proof136-test-watch');assert.equal(args[0],'psql');
 assert.match(input,/pg_stat_activity/);assert.match(input,/pg_blocking_pids/);assert.match(input,/pg_locks/);assert.match(input,/limit 8/);
 for(const setting of Object.keys(settings))assert.ok(input.includes("current_setting('"+setting+"')"));
 assert.ok(!/\b(?:query|query_id|usename|client_addr|backend_start)\b/.test(input));assert.ok(!input.includes(secret));assert.ok(!/set (?:jit|plan_cache_mode)/i.test(input));
});

test('observer subprocess and JSON failures expose no raw stderr, connection or result body',async()=>{
 for(const [error,stdout] of [[Object.assign(new Error(secret),{stderr:secret}),null],[null,secret]]){
  await assert.rejects(observeSqlActivity({databaseUrl:'synthetic:'+secret,applicationName:'uskoci-proof136-test',signal:new AbortController().signal,
   execute:(...args)=>{const child={stdin:new EventEmitter()};child.stdin.end=()=>queueMicrotask(()=>args[3](error,stdout));return child;}}),
  error=>{assert.equal(error.message,'SQL_OBSERVER_UNAVAILABLE');containsNoPrivate(error.message);return true;});
 }
});

test('successful real-shaped result remains caller-only; bounded diagnostics retain repeated sample timing and safe settings',async()=>{
 const f=fixture();const promise=f.sql('SNAPSHOT_FULL','select '+secret);await f.time.advance(750);close(f,'  {"data":"'+secret+'"}\n');
 assert.equal(await promise,'{"data":"'+secret+'"}');const d=f.report.sqlDiagnostics[0];
 assert.equal(d.status,'SUCCEEDED');assert.equal(d.elapsedMilliseconds,750);assert.equal(d.observations.length,1);
 assert.equal(d.observations[0].sampleCount,3);assert.equal(d.observations[0].elapsedMilliseconds,250);assert.equal(d.observations[0].lastSeenElapsedMilliseconds,750);
 assert.equal(d.settings.jit,true);containsNoPrivate(f.report);assert.equal(f.time.size(),0);
 assert.ok(f.calls[0][1].includes('VERBOSITY=sqlstate'));assert.match(f.calls[0][2].env.PGAPPNAME,/^uskoci-proof136-snapshot_full-[a-f0-9]{8}$/);
 assert.equal(f.child.input,"set statement_timeout='20s';\nselect "+secret);assert.ok(f.time.requested.includes(20000));
});

test('20s deadline settles even when process kill emits no close and observer never returns',async()=>{
 for(const killThrows of [false,true]){
  let signal;const f=fixture({killThrows,observeActivity:options=>{signal=options.signal;return new Promise(()=>{});}});
  const promise=f.sql('SNAPSHOT_FULL','select '+secret),failure=assert.rejects(promise,error=>{
   assert.ok(error instanceof ObservedSqlError);assert.equal(error.code,'ETIMEDOUT');assert.equal(error.operation,'SNAPSHOT_FULL');containsNoPrivate(error.message);return true;
  });
  await f.time.advance(20000);await failure;
  assert.deepEqual(f.child.kills,['SIGKILL']);assert.equal(signal.aborted,true);assert.equal(f.time.size(),0);
  assert.equal(f.report.sqlDiagnostics[0].elapsedMilliseconds,20000);assert.equal(f.report.sqlDiagnostics[0].status,'TIMED_OUT');containsNoPrivate(f.report);
 }
});

test('server statement timeout SQLSTATE differs from a process deadline without retaining stderr',async()=>{
 const f=fixture(),promise=f.sql('SNAPSHOT_FULL','select '+secret),failure=assert.rejects(promise,error=>{
  assert.equal(error.code,'PROCESS_EXIT');assert.equal(error.exitStatus,3);assert.equal(error.sqlState,'57014');containsNoPrivate(error.message);return true;
 });
 f.child.stderr.emit('data',Buffer.from(secret+'\nERROR:  57014\n'));close(f,secret,3);await failure;
 assert.deepEqual(f.report.sqlDiagnostics[0].failure,{operation:'SNAPSHOT_FULL',code:'PROCESS_EXIT',exitStatus:3,sqlState:'57014'});containsNoPrivate(f.report);
});

test('stdout is bounded to1MiB and an overflow stops even a process that never acknowledges kill',async()=>{
 const f=fixture(),promise=f.sql('SNAPSHOT_FULL','select '+secret),failure=assert.rejects(promise,{code:'ENOBUFS'});
 f.child.stdout.emit('data',Buffer.alloc(limits.stdoutBytes+1,65));await failure;
 assert.deepEqual(f.child.kills,['SIGKILL']);assert.equal(f.report.sqlDiagnostics[0].status,'FAILED');containsNoPrivate(f.report);assert.equal(f.time.size(),0);
});

test('observer failures and invalid observations never mask a successful SQL result',async()=>{
 for(const observeActivity of [async()=>{throw new Error(secret);},async()=>({settings:{...settings,jit:secret},activity:[{pid:secret,query:secret}]})]){
  const f=fixture({observeActivity}),promise=f.sql('BIND_FULL','select '+secret);await f.time.advance(500);close(f,'null');
  assert.equal(await promise,'null');assert.equal(f.report.sqlDiagnostics[0].status,'SUCCEEDED');assert.deepEqual(f.report.sqlDiagnostics[0].observations,[]);
  containsNoPrivate(f.report);
 }
});

test('distinct observations and total SQL operations are capped without retaining unseen payloads',async()=>{
 let count=0;const f=fixture({observeActivity:async()=>observed({...activity,pid:++count+100})}),promise=f.sql('SNAPSHOT_FULL','select '+secret);
 await f.time.advance(5000);close(f);await promise;
 const d=f.report.sqlDiagnostics[0];assert.equal(d.observations.length,12);assert.equal(d.droppedDistinctObservations,8);containsNoPrivate(f.report);
 const report={},sql=createObservedSqlRunner({databaseUrl:'local-synthetic-only',report,spawnProcess:()=>{
  const f=fixture();queueMicrotask(()=>close(f));return f.child;
 }});
 for(let i=0;i<limits.operations;i++)assert.equal(await sql('ALLOCATION_COUNT','select1'),'1');
 await assert.rejects(sql('ALLOCATION_COUNT','select1'),/SQL_DIAGNOSTIC_OPERATION_LIMIT/);assert.equal(report.sqlDiagnostics.length,32);
});

test('operation labels and process failures cannot smuggle query text, payloads or raw environment into the report',async()=>{
 const f=fixture();await assert.rejects(f.sql(secret,'select '+secret),/SQL_DIAGNOSTIC_OPERATION_INVALID/);assert.equal(f.calls.length,0);
 const report={},sql=createObservedSqlRunner({databaseUrl:'synthetic',report,spawnProcess:()=>{throw Object.assign(new Error(secret),{code:secret,stderr:secret});}});
 await assert.rejects(sql('BIND_FULL','select '+secret),error=>{assert.equal(error.code,'PROCESS_EXIT');containsNoPrivate(error.message);return true;});
 containsNoPrivate(report);containsNoPrivate(safeSqlFailure(new Error(secret)));containsNoPrivate(new ObservedSqlError(secret,secret,secret,secret).message);
});

test('every restoration is attempted and the exact primary failure survives two cleanup failures',async()=>{
 const report={},attempted=[],primary=new ObservedSqlError('SNAPSHOT_FULL','ETIMEDOUT',null),cleanup=new ObservedSqlError('RETIRE_FIXTURE_POLICY','PROCESS_EXIT',3,'55P03');
 const run=async()=>{let failure=null;try{throw primary;}catch(error){failure=error;throw error;}finally{
  await restoreObservedSql([
   {operation:'RETIRE_FIXTURE_POLICY',run:async()=>{attempted.push(1);throw cleanup;}},
   {operation:'RETIRE_FIXTURE_PRIVACY',run:async()=>{attempted.push(2);throw new Error(secret);}},
   {operation:'RESTORE_PREDECESSOR_POLICY',run:async()=>{attempted.push(3);}},
   {operation:'RESTORE_PREDECESSOR_PRIVACY',run:async()=>{attempted.push(4);}},
  ],report,failure);
 }};
 await assert.rejects(run(),error=>error===primary);assert.deepEqual(attempted,[1,2,3,4]);assert.equal(report.sqlCleanupFailures.length,2);
 assert.deepEqual(report.sqlPrimaryFailure,safeSqlFailure(primary));assert.equal(report.sqlCleanupFailures[0].sqlState,'55P03');containsNoPrivate(report);
});

test('cleanup failure after a successful body fails the proof after trying the remaining cleanup',async()=>{
 const report={},first=new Error(secret);let restored=false;
 await assert.rejects(restoreObservedSql([
  {operation:'RETIRE_FIXTURE_POLICY',run:async()=>{throw first;}},
  {operation:'RETIRE_FIXTURE_PRIVACY',run:async()=>{restored=true;}},
 ],report),error=>error===first);
 assert.equal(restored,true);assert.equal(report.sqlPrimaryFailure,undefined);assert.equal(report.sqlCleanupFailures[0].code,'PROOF_FAILURE');containsNoPrivate(report);
});
