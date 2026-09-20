// Proof-only135 diagnostics. The RPC itself has its original transport/deadline.
// A post-error database sample cannot establish the failed session's prior wait.
import {execFile} from 'node:child_process';
import {performance} from 'node:perf_hooks';

export const QA_RPC_PHASES=Object.freeze(['ANSWER_CLAIM','ANSWER_DISPATCH','ANSWER_COMPLETE',
 'COMPETING_CLAIM','COMPETING_DISPATCH','COMPETING_COMPLETE','ANSWER_SUBMIT','COMPETING_SUBMIT',
 'MATERIAL_CLAIM','MATERIAL_DISPATCH','MATERIAL_COMPLETE','MATERIAL_SUBMIT','PUBLIC_FEED']);
export const QA_RPC_LIMITS=Object.freeze({phases:13,observerMs:1000,observerBytes:65536,sessions:12,locks:8,blockingPids:8});
const phases=new Set(QA_RPC_PHASES),states=new Set(['active','idle','idle in transaction','idle in transaction (aborted)','fastpath function call','disabled']);
const types=new Set(['relation','page','tuple','transactionid','virtualxid','object','userlock','advisory','applytransaction','spectoken','frozenid']);
const modes=new Set(['AccessShareLock','RowShareLock','RowExclusiveLock','ShareUpdateExclusiveLock','ShareLock','ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock','SIReadLock']);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const pid=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const wait=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_ ]{0,63}$/.test(v)?v:null;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)?v:null;
export function sanitizeQaRpcSnapshot(raw){
 if(!record(raw)||!Array.isArray(raw.sessions))return null;
 return{scope:'POST_ERROR_UNCORRELATED_DATABASE_SAMPLE',failedSessionIdentified:false,
  sessions:raw.sessions.slice(0,QA_RPC_LIMITS.sessions).flatMap(v=>{
   if(!record(v)||!pid(v.pid)||!states.has(v.state))return[];
   return[{pid:v.pid,state:v.state,waitEventType:wait(v.wait_event_type),waitEvent:wait(v.wait_event),
    applicationName:['PostgREST','postgrest','psql','pg_cron'].includes(v.application_name)?v.application_name:null,
    applicationNameSha256:digest(v.application_name_sha256),
    queryId:typeof v.query_id==='string'&&/^-?[0-9]{1,20}$/.test(v.query_id)?v.query_id:null,
    blockingPids:[...new Set((Array.isArray(v.blocking_pids)?v.blocking_pids:[]).filter(pid))].slice(0,QA_RPC_LIMITS.blockingPids),
    locks:(Array.isArray(v.locks)?v.locks:[]).slice(0,QA_RPC_LIMITS.locks).flatMap(l=>!record(l)||!types.has(l.locktype)||!modes.has(l.mode)||typeof l.granted!=='boolean'?[]:
     [{locktype:l.locktype,mode:l.mode,granted:l.granted,relationOid:pid(l.relation_oid)?l.relation_oid:null}])}];
  })};
}
// All returned strings are generated metadata or fixed labels. Never SELECT
// query, role config, JWT claims, user identifiers, rows, arguments or SQL plans.
export const QA_RPC_OBSERVER_SQL=`begin read only;set local statement_timeout='1s';
 select jsonb_build_object('sessions',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
  select a.pid,a.state,a.wait_event_type,a.wait_event,
   case when a.application_name in ('PostgREST','postgrest','psql','pg_cron') then a.application_name else null end application_name,
   encode(extensions.digest(convert_to(a.application_name,'UTF8'),'sha256'),'hex') application_name_sha256,
   a.query_id::text query_id,pg_blocking_pids(a.pid) blocking_pids,
   (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select l.locktype,l.mode,l.granted,l.relation relation_oid
    from pg_locks l where l.pid=a.pid order by l.granted,l.locktype,l.mode,l.relation limit 8) x) locks
  from pg_stat_activity a where a.datname=current_database() and a.pid<>pg_backend_pid() and a.backend_type='client backend'
  order by (a.wait_event_type='Lock') desc nulls last,(a.state='active') desc nulls last,a.pid limit 12) r));rollback;`;

export function observeQaRpcDatabase({databaseUrl,execute=execFile,setTimer=setTimeout,clearTimer=clearTimeout}){
 return new Promise(resolve=>{
  let done=false,child;const controller=new AbortController();
  const finish=value=>{if(done)return;done=true;clearTimer(timer);controller.abort();resolve(value);};
  const timer=setTimer(()=>{finish({status:'UNAVAILABLE'});try{child?.kill();}catch{}},QA_RPC_LIMITS.observerMs);
  try{
   child=execute('psql',[databaseUrl,'-X','-q','-v','ON_ERROR_STOP=1','-At'],
    {encoding:'utf8',timeout:QA_RPC_LIMITS.observerMs,maxBuffer:QA_RPC_LIMITS.observerBytes,signal:controller.signal,
     env:{...process.env,PGAPPNAME:'uskoci-proof135-post-error'}},(error,stdout)=>{
     if(done)return;if(error){finish({status:'UNAVAILABLE'});return;}
     try{const snapshot=sanitizeQaRpcSnapshot(JSON.parse(stdout));finish(snapshot?{status:'CAPTURED',...snapshot}:{status:'UNAVAILABLE'});}
     catch{finish({status:'UNAVAILABLE'});}
    });
   child.stdin.on('error',()=>{});child.stdin.end(QA_RPC_OBSERVER_SQL);
  }catch{finish({status:'UNAVAILABLE'});}
 });
}

export function safeQaRpcCode(error){
 const match=typeof error?.message==='string'?/^LOCAL_RPC:([A-Z0-9]{5}):/.exec(error.message):null;
 return match?match[1]:error?.code==='ERR_ASSERTION'?'ASSERTION_FAILED':'PROOF_FAILURE';
}
// Only synthetic tests inject a clock or observer; the actual proof uses the
// loopback-guarded closure_runtime database URL and the real psql adapter above.
export function createObservedQaRpc({report,databaseUrl,now=()=>performance.now(),observe=observeQaRpcDatabase}){
 const used=new Set();
 return async function observedQaRpc(phase,invoke){
  if(!phases.has(phase)||used.has(phase)||used.size>=QA_RPC_LIMITS.phases||typeof invoke!=='function')throw new Error('QA_RPC_PHASE_INVALID');
  used.add(phase);const start=now(),entry={phase,status:'RUNNING',elapsedMilliseconds:0,code:null};
  (report.qaRpcDiagnostics??=[]).push(entry);
  try{const result=await invoke();entry.status='SUCCEEDED';return result;}
  catch(error){entry.status='FAILED';entry.code=safeQaRpcCode(error);
   if(entry.code==='57014'){
    // Preserve the exact primary error even if the diagnostic transport fails.
    entry.elapsedMilliseconds=Math.max(0,Math.round(now()-start));
    try{entry.postErrorSnapshot=await observe({databaseUrl});}catch{entry.postErrorSnapshot={status:'UNAVAILABLE'};}
   }
   throw error;
  }finally{if(entry.status!=='FAILED'||entry.code!=='57014')entry.elapsedMilliseconds=Math.max(0,Math.round(now()-start));}
 };
}
