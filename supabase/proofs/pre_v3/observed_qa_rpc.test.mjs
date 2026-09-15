// Synthetic process, clock and RPC transports; no database, provider or CI call.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {QA_RPC_PHASES,QA_RPC_LIMITS,QA_RPC_OBSERVER_SQL,sanitizeQaRpcSnapshot,observeQaRpcDatabase,
 createObservedQaRpc,safeQaRpcCode} from './observed_qa_rpc.mjs';

const secret='PRIVATE_TEXT_JWT_PASSWORD';
const activity={pid:41,state:'active',wait_event_type:'Lock',wait_event:'transactionid',application_name:'PostgREST',
 application_name_sha256:'a'.repeat(64),query_id:'9223372036854775807',blocking_pids:[42],
 locks:[{locktype:'transactionid',mode:'ShareLock',granted:false,relation_oid:null}]};
const raw={sessions:[activity]};
const noSecret=x=>assert.ok(!JSON.stringify(x).includes(secret));
function transport({body=JSON.stringify(raw),error=null,neverFinish=false}={}){
 let callback,args,input,timer,cleared=0;const child={stdin:new EventEmitter(),kill:()=>false};
 child.stdin.end=value=>{input=value;if(!neverFinish)queueMicrotask(()=>callback(error,body));};
 return{get args(){return args;},get input(){return input;},get cleared(){return cleared;},fire:()=>timer(),late:()=>callback(null,JSON.stringify(raw)),
  options:{databaseUrl:'postgresql://proof:'+secret+'@127.0.0.1:54322/postgres',
   execute:(...a)=>{args=a;callback=a[3];return child;},
   setTimer:(fn,ms)=>{assert.equal(ms,1000);timer=fn;return 1;},clearTimer:id=>{assert.equal(id,1);cleared++;}}};
}

test('post-error DTO bounds arrays and removes expressions, application payloads and all unknown fields',()=>{
 const value={sessions:Array.from({length:30},(_,i)=>({...activity,pid:41+i,query:secret,usename:secret,client_addr:secret,
  application_name:secret,query_id:secret,blocking_pids:[42,42,-1,secret,...Array.from({length:30},(_,j)=>50+j)],
  locks:Array.from({length:30},()=>({...activity.locks[0],query:secret,relation_name:secret}))}))};
 const safe=sanitizeQaRpcSnapshot(value);noSecret(safe);
 assert.equal(safe.scope,'POST_ERROR_UNCORRELATED_DATABASE_SAMPLE');assert.equal(safe.failedSessionIdentified,false);
 assert.equal(safe.sessions.length,12);assert.equal(safe.sessions[0].blockingPids.length,8);assert.equal(safe.sessions[0].locks.length,8);
 assert.equal(safe.sessions[0].applicationName,null);assert.equal(safe.sessions[0].queryId,null);
 assert.deepEqual(sanitizeQaRpcSnapshot({sessions:[{...activity,pid:0},{...activity,state:secret}]}).sessions,[]);
 assert.equal(sanitizeQaRpcSnapshot(null),null);assert.equal(sanitizeQaRpcSnapshot({sessions:secret}),null);
 const rejected=sanitizeQaRpcSnapshot({sessions:[{...activity,wait_event:secret+'://url',application_name_sha256:secret,
  locks:[{...activity.locks[0],mode:secret},{...activity.locks[0],granted:'true'}]}]}).sessions[0];
 assert.equal(rejected.waitEvent,null);assert.equal(rejected.applicationNameSha256,null);assert.deepEqual(rejected.locks,[]);
});

test('real observer adapter has an independent1s/64KiB bound and SELECT-only transaction with no query text',async()=>{
 const f=transport(),value=await observeQaRpcDatabase(f.options);assert.equal(value.status,'CAPTURED');
 assert.equal(f.args[0],'psql');assert.equal(f.args[2].timeout,1000);assert.equal(f.args[2].maxBuffer,65536);
 assert.equal(f.args[2].env.PGAPPNAME,'uskoci-proof135-post-error');assert.equal(f.args[2].signal.aborted,true);
 assert.equal(f.cleared,1);assert.equal(f.input,QA_RPC_OBSERVER_SQL);noSecret(f.input);noSecret(value);
 assert.match(f.input,/^begin read only;set local statement_timeout='1s';/);assert.match(f.input,/rollback;$/);
 assert.match(f.input,/a\.query_id::text/);assert.match(f.input,/pg_blocking_pids/);assert.match(f.input,/limit 12/);assert.match(f.input,/limit 8/);
 assert.ok(!/\b(?:query|usename|client_addr|update|insert|delete|alter|create|drop|analyze|jwt|claims)\b/i.test(f.input));
});

test('observer deadline returns even without subprocess callback; late output never changes evidence',async()=>{
 const f=transport({neverFinish:true}),pending=observeQaRpcDatabase(f.options);f.fire();
 const value=await pending;assert.deepEqual(value,{status:'UNAVAILABLE'});assert.equal(f.args[2].signal.aborted,true);
 f.late();assert.deepEqual(value,{status:'UNAVAILABLE'});assert.equal(f.cleared,1);
});

test('observer failures, oversized transport errors and malformed JSON never expose stderr or connection',async()=>{
 for(const spec of [{error:Object.assign(new Error(secret),{stderr:secret,code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'})},
  {body:secret},{body:'{"sessions":"'+secret+'"}'}]){
  const f=transport(spec),result=await observeQaRpcDatabase(f.options);assert.deepEqual(result,{status:'UNAVAILABLE'});noSecret(result);
 }
 const f=transport();const value=await observeQaRpcDatabase({...f.options,execute:()=>{throw new Error(secret);}});
 assert.deepEqual(value,{status:'UNAVAILABLE'});assert.equal(f.cleared,1);
});

test('phase success returns exact private result only to caller and does not sample or retry',async()=>{
 let time=10,reads=0,calls=0;const report={},privateResult={text:secret};
 const run=createObservedQaRpc({report,databaseUrl:secret,now:()=>time,observe:async()=>{reads++;}});
 assert.equal(await run('ANSWER_CLAIM',async()=>{calls++;time=42.7;return privateResult;}),privateResult);
 assert.deepEqual(report.qaRpcDiagnostics,[{phase:'ANSWER_CLAIM',status:'SUCCEEDED',elapsedMilliseconds:33,code:null}]);
 assert.equal(calls,1);assert.equal(reads,0);noSecret(report);
});

test('57014 preserves exact original Error, excludes observer time and records bounded post-error sample',async()=>{
 let time=0,calls=0,reads=0;const report={},error=new Error('LOCAL_RPC:57014:'+secret);
 const run=createObservedQaRpc({report,databaseUrl:secret,now:()=>time,observe:async()=>{reads++;time=4100;return {status:'CAPTURED',...sanitizeQaRpcSnapshot(raw)};}});
 await assert.rejects(run('ANSWER_SUBMIT',async()=>{calls++;time=3100;throw error;}),e=>e===error);
 assert.equal(calls,1);assert.equal(reads,1);assert.equal(report.qaRpcDiagnostics[0].elapsedMilliseconds,3100);
 assert.equal(report.qaRpcDiagnostics[0].code,'57014');assert.equal(report.qaRpcDiagnostics[0].postErrorSnapshot.failedSessionIdentified,false);noSecret(report);
});

test('diagnostic rejection never replaces the exact primary server failure',async()=>{
 const error=new Error('LOCAL_RPC:57014:'+secret),report={};
 const run=createObservedQaRpc({report,databaseUrl:secret,observe:async()=>{throw new Error(secret);}});
 await assert.rejects(run('COMPETING_SUBMIT',async()=>{throw error;}),e=>e===error);
 assert.deepEqual(report.qaRpcDiagnostics[0].postErrorSnapshot,{status:'UNAVAILABLE'});noSecret(report);
});

test('non57014 exceptions neither sample nor replay and retain only safe error categories',async()=>{
 for(const [error,code] of [[new Error('LOCAL_RPC:42501:'+secret),'42501'],[new Error('LOCAL_SQL:ETIMEDOUT:'+secret),'PROOF_FAILURE'],
  [Object.assign(new Error(secret),{code:'ERR_ASSERTION'}),'ASSERTION_FAILED'],[new Error('LOCAL_RPC:'+secret+':x'),'PROOF_FAILURE']]){
  let calls=0;const report={},run=createObservedQaRpc({report,databaseUrl:secret,observe:async()=>assert.fail('No diagnostic read')});
  await assert.rejects(run('PUBLIC_FEED',async()=>{calls++;throw error;}),e=>e===error);
  assert.equal(calls,1);assert.equal(report.qaRpcDiagnostics[0].code,code);assert.equal(safeQaRpcCode(error),code);noSecret(report);
 }
});

test('phase roster is finite, each operation runs once, unknown and duplicate labels cannot invoke RPC',async()=>{
 assert.equal(QA_RPC_PHASES.length,13);assert.equal(QA_RPC_LIMITS.phases,13);const report={},run=createObservedQaRpc({report,databaseUrl:secret});
 for(const phase of QA_RPC_PHASES)await run(phase,async()=>true);
 for(const phase of ['ANSWER_CLAIM',secret])await assert.rejects(run(phase,async()=>assert.fail('Not admitted')),/QA_RPC_PHASE_INVALID/);
 assert.equal(report.qaRpcDiagnostics.length,13);noSecret(report);
});

test('actual proof wraps each affected RPC once, retains all assertions and primary-error cleanup semantics',()=>{
 const proof=readFileSync(new URL('./v5_qa_classifier_proof.mjs',import.meta.url),'utf8');
 for(const phase of QA_RPC_PHASES)assert.equal(proof.split("observedRpc('"+phase+"'").length-1,1,phase);
 assert.match(proof,/assert\.ok\(ac\.claim\)/);assert.match(proof,/assert\.ok\(cc\.claim\)/);
 assert.match(proof,/publicAnswer\.receipt\.answerVersion,1/);assert.match(proof,/private\.preselection_qa_answer_versions/);
 assert.match(proof,/assert\.equal\(mr\.materiality,'MATERIAL'\)/);assert.match(proof,/assert\.ok\(!JSON\.stringify\(feed\)\.includes\(a\.id\)\)/);
 assert.match(proof,/catch\(error\)\{primaryError=error;throw error;\}/);assert.match(proof,/throw primaryError\?\?error/);
 assert.match(proof,/finally\{\s*try\{sql\(`update private\.publication_policy_bundles set is_active=false/);
});
