// Proof-only136 SQL diagnostics. No product imports, implicit network target,
// query text, result bytes, stderr, credentials or payloads enter the report.
import {spawn,execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
export const OBSERVED_SQL_LIMITS=Object.freeze({queryMs:20000,observerMs:1000,pollMs:250,stdoutBytes:1024*1024,observerBytes:65536,stderrLineBytes:128,
 observations:12,blockingPids:8,locks:8,blockers:8,operations:32});
const operations=new Set(['BIND_FULL','SNAPSHOT_FULL','ALLOCATION_COUNT','LIMITED_POLICY_UPDATE','BIND_LIMITED','SNAPSHOT_LIMITED','RESTORE_FULL_DELIVERY',
 'RETIRE_FIXTURE_POLICY','RETIRE_FIXTURE_PRIVACY','RESTORE_PREDECESSOR_POLICY','RESTORE_PREDECESSOR_PRIVACY',
 'DIAG_SOURCE_BINDING','DIAG_PLAN_ORIGINAL','DIAG_PLAN_MATERIALIZED','DIAG_EXECUTE_ORIGINAL','DIAG_EXECUTE_MATERIALIZED','DIAG_EXECUTE_FUNCTION_LOCAL_JIT_OFF']);
const integer=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const record=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null;
const state=new Set(['active','idle','idle in transaction','idle in transaction (aborted)','fastpath function call','disabled']);
const modes=new Set(['AccessShareLock','RowShareLock','RowExclusiveLock','ShareUpdateExclusiveLock','ShareLock','ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock','SIReadLock']);
const lockTypes=new Set(['relation','page','tuple','transactionid','virtualxid','object','userlock','advisory','applytransaction','spectoken','frozenid']);
const wait=v=>v===null?null:typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_ ]{0,63}$/.test(v)?v:undefined;
const relation=v=>typeof v==='string'&&/^(public|private|storage|auth|cron|supabase_migrations|pg_catalog)\.[a-z_][a-z0-9_]{0,62}$/.test(v)?v:null;
function locks(raw){return (Array.isArray(raw)?raw:[]).slice(0,OBSERVED_SQL_LIMITS.locks).flatMap(value=>{
 const v=record(value);if(!v||!lockTypes.has(v.locktype)||!modes.has(v.mode))return[];
 return[{locktype:v.locktype,mode:v.mode,relationOid:integer(v.relation_oid)?v.relation_oid:null,relation:relation(v.relation)}];
});}
function activity(value){const v=record(value);if(!v||!integer(v.pid)||!state.has(v.state))return null;
 return{pid:v.pid,state:v.state,waitEventType:wait(v.wait_event_type)??null,waitEvent:wait(v.wait_event)??null};}
export function sanitizeSqlObservation(raw){
 const v=Array.isArray(raw)?record(raw[0]):null,a=activity(v);if(!v||!a)return null;
 return{...a,blockingPids:[...new Set((Array.isArray(v.blocking_pids)?v.blocking_pids:[]).filter(integer))].slice(0,OBSERVED_SQL_LIMITS.blockingPids),
  requestedLocks:locks(v.requested_locks),blockers:(Array.isArray(v.blockers)?v.blockers:[]).slice(0,OBSERVED_SQL_LIMITS.blockers).flatMap(x=>{
   const b=activity(x);return b?[{...b,heldConflictingRelations:locks(x.held_conflicting_relations)}]:[];
  })};
}
export function sanitizeSqlSettings(raw){
 const v=record(raw),numeric=['jit_above_cost','jit_inline_above_cost','jit_optimize_above_cost'];
 if(!v||typeof v.jit!=='boolean'||!numeric.every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]))||
  !['auto','force_generic_plan','force_custom_plan'].includes(v.plan_cache_mode)||!integer(v.server_version_num))return null;
 return{source:'SAME_DATABASE_OBSERVER_SESSION',jit:v.jit,...Object.fromEntries(numeric.map(k=>[k,v[k]])),
  plan_cache_mode:v.plan_cache_mode,server_version_num:v.server_version_num};
}
// psql VERBOSITY=sqlstate produces severity plus a five-character SQLSTATE.
// Retain only that token; discard overlong/unrecognized lines and all other stderr.
export function createSqlStateCollector(){
 let line='',discard=false,sqlState=null;
 const consume=()=>{if(!discard){const match=/^(?:ERROR|FATAL|PANIC):\s+([0-9A-Z]{5})\s*$/.exec(line);if(match)sqlState=match[1];}line='';discard=false;};
 return{push(chunk){for(const byte of Buffer.from(chunk)){
  if(byte===10){consume();continue;}if(discard)continue;
  if(line.length>=OBSERVED_SQL_LIMITS.stderrLineBytes){line='';discard=true;continue;}line+=String.fromCharCode(byte);
 }},finish(){consume();return sqlState;}};
}
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function observerQuery(application){return `select jsonb_build_object('settings',jsonb_build_object(
 'jit',current_setting('jit')::boolean,'jit_above_cost',current_setting('jit_above_cost')::numeric,
 'jit_inline_above_cost',current_setting('jit_inline_above_cost')::numeric,'jit_optimize_above_cost',current_setting('jit_optimize_above_cost')::numeric,
 'plan_cache_mode',current_setting('plan_cache_mode'),'server_version_num',current_setting('server_version_num')::integer),
 'activity',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
 select a.pid,a.state,a.wait_event_type,a.wait_event,pg_blocking_pids(a.pid) blocking_pids,
 (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select l.locktype,l.mode,l.relation as relation_oid,
  n.nspname||'.'||c.relname as relation from pg_locks l left join pg_class c on c.oid=l.relation left join pg_namespace n on n.oid=c.relnamespace
  where l.pid=a.pid and not l.granted order by l.locktype,l.mode,l.relation limit 8) x) requested_locks,
 (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select b.pid,b.state,b.wait_event_type,b.wait_event,
  (select coalesce(jsonb_agg(to_jsonb(y)),'[]') from (select h.locktype,h.mode,h.relation as relation_oid,n.nspname||'.'||c.relname as relation
   from pg_locks h left join pg_class c on c.oid=h.relation left join pg_namespace n on n.oid=c.relnamespace
   where h.pid=b.pid and h.granted and h.relation in(select w.relation from pg_locks w where w.pid=a.pid and not w.granted)
   order by h.locktype,h.mode,h.relation limit 8) y) held_conflicting_relations
  from pg_stat_activity b where b.pid=any(pg_blocking_pids(a.pid)) order by b.pid limit 8) x) blockers
 from pg_stat_activity a where a.application_name=${quote(application)} limit 1) r))`;}
export function observeSqlActivity({databaseUrl,applicationName,signal,execute=execFile}){return new Promise((resolve,reject)=>{
 const child=execute('psql',[databaseUrl,'-X','-q','-v','ON_ERROR_STOP=1','-At'],
  {encoding:'utf8',timeout:OBSERVED_SQL_LIMITS.observerMs,maxBuffer:OBSERVED_SQL_LIMITS.observerBytes,signal,
   env:{...process.env,PGAPPNAME:applicationName+'-watch'}},(error,stdout)=>{
   if(error){reject(new Error('SQL_OBSERVER_UNAVAILABLE'));return;}
   try{resolve(JSON.parse(stdout));}catch{reject(new Error('SQL_OBSERVER_UNAVAILABLE'));}
  });
 child.stdin.on('error',()=>{});child.stdin.end("set statement_timeout='1s';"+observerQuery(applicationName));
});}
const codes=new Set(['ENOENT','EACCES','ETIMEDOUT','ENOBUFS','PROCESS_EXIT']);
export class ObservedSqlError extends Error{
 constructor(operation,code,status,sqlState=null){const safe=codes.has(code)?code:'PROCESS_EXIT',exit=Number.isInteger(status)&&status>=0&&status<=255?status:null,
  op=operations.has(operation)?operation:'UNKNOWN',state=typeof sqlState==='string'&&/^[0-9A-Z]{5}$/.test(sqlState)?sqlState:null;
  super(`LOCAL_SQL:${safe}:status=${exit??'NONE'}:operation=${op}:sqlstate=${state??'NONE'}`);this.name='ObservedSqlError';this.operation=op;this.code=safe;this.exitStatus=exit;this.sqlState=state;
 }
}
export function safeSqlFailure(error){return error instanceof ObservedSqlError?
 {operation:operations.has(error.operation)?error.operation:'UNKNOWN',code:codes.has(error.code)?error.code:'PROCESS_EXIT',exitStatus:error.exitStatus,sqlState:error.sqlState}:
 {operation:'UNKNOWN',code:error?.code==='ERR_ASSERTION'?'ASSERTION_FAILED':'PROOF_FAILURE',exitStatus:null};}
/** Injection is for synthetic unit transports only. Actual proof uses defaults
 * with closure_runtime's already loopback-guarded DB URL and real psql. */
export function createObservedSqlRunner({databaseUrl,report,spawnProcess=spawn,observeActivity=observeSqlActivity,now=Date.now,
 setTimer=setTimeout,clearTimer=clearTimeout}){
 if(typeof databaseUrl!=='string'||!databaseUrl||!record(report))throw new Error('SQL_DIAGNOSTIC_CONFIGURATION_INVALID');
 let count=0;
 return async function observedSql(operation,query){
  if(!operations.has(operation)||typeof query!=='string')throw new Error('SQL_DIAGNOSTIC_OPERATION_INVALID');
  if(++count>OBSERVED_SQL_LIMITS.operations)throw new Error('SQL_DIAGNOSTIC_OPERATION_LIMIT');
  const started=now(),elapsed=()=>Math.max(0,now()-started),entry={operation,ordinal:count,status:'RUNNING',elapsedMilliseconds:0,observations:[]};
  (report.sqlDiagnostics??=[]).push(entry);
  const applicationName='uskoci-proof136-'+operation.toLowerCase().slice(0,24)+'-'+randomUUID().slice(0,8);
  let child,closed=false,exitStatus=null,code=null,stdoutBytes=0,stdout=[],finish;
  const stderr=createSqlStateCollector();
  const exited=new Promise(resolve=>{finish=resolve;});const observerAbort=new AbortController();
  const completed=(status,error)=>{if(closed)return;closed=true;exitStatus=Number.isInteger(status)?status:null;
   if(error&&!code)code=codes.has(error.code)?error.code:'PROCESS_EXIT';entry.elapsedMilliseconds=elapsed();finish();};
  const stop=reason=>{if(closed||code)return;code=reason;
   try{child?.kill('SIGKILL');}catch{}finally{completed(null);}};
  // Same20s wall-clock bound as the original execFileSync adapter. Server-side
  //20s additionally prevents abandoned psql from leaving an unbounded SQL run.
  const timer=setTimer(()=>stop('ETIMEDOUT'),OBSERVED_SQL_LIMITS.queryMs);
  try{
   child=spawnProcess('psql',[databaseUrl,'-X','-q','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-At'],{stdio:['pipe','pipe','pipe'],env:{...process.env,PGAPPNAME:applicationName}});
   child.once('error',error=>completed(null,error));child.once('close',status=>completed(status));
   child.stdout.on('data',chunk=>{if(closed)return;const bytes=Buffer.from(chunk);stdoutBytes+=bytes.length;
    if(stdoutBytes>OBSERVED_SQL_LIMITS.stdoutBytes){stdout=[];stop('ENOBUFS');return;}stdout.push(bytes);});
   child.stderr.on('data',chunk=>stderr.push(chunk));child.stdin.on('error',()=>{});child.stdin.end("set statement_timeout='20s';\n"+query);
   const seen=new Map();
   while(!closed){
    let pollTimer;try{await Promise.race([exited,new Promise(resolve=>{pollTimer=setTimer(resolve,OBSERVED_SQL_LIMITS.pollMs);})]);}
    finally{if(pollTimer!==undefined)clearTimer(pollTimer);}if(closed)break;
    // The observer has its own1s/64KiB cap and is aborted when the primary SQL
    // exits. No observation can extend the20s query deadline or mask its result.
    const observation=Promise.resolve().then(()=>observeActivity({databaseUrl,applicationName,signal:observerAbort.signal})).then(raw=>{
     const settings=sanitizeSqlSettings(raw?.settings);if(settings&&!closed)entry.settings??=settings;
     return sanitizeSqlObservation(raw?.activity);
    }).catch(()=>{
     if(!closed)entry.observerUnavailable=true;return null;
    });
    const safe=await Promise.race([observation,exited.then(()=>null)]);if(closed)break;
    if(safe){const key=JSON.stringify(safe),known=seen.get(key);
     if(known){known.sampleCount++;known.lastSeenElapsedMilliseconds=elapsed();}
     else if(entry.observations.length<OBSERVED_SQL_LIMITS.observations){const sample={elapsedMilliseconds:elapsed(),lastSeenElapsedMilliseconds:elapsed(),sampleCount:1,...safe};seen.set(key,sample);entry.observations.push(sample);}
     else entry.droppedDistinctObservations=(entry.droppedDistinctObservations??0)+1;
    }
   }
   await exited;
   if(code||exitStatus!==0){const error=new ObservedSqlError(operation,code??'PROCESS_EXIT',exitStatus,stderr.finish());entry.status=error.code==='ETIMEDOUT'?'TIMED_OUT':'FAILED';entry.failure=safeSqlFailure(error);throw error;}
   entry.status='SUCCEEDED';return Buffer.concat(stdout).toString('utf8').trim();
  }catch(error){
   if(!closed){stop('PROCESS_EXIT');entry.elapsedMilliseconds=elapsed();}
   const safe=error instanceof ObservedSqlError?error:new ObservedSqlError(operation,error?.code??'PROCESS_EXIT',null);
   entry.status=safe.code==='ETIMEDOUT'?'TIMED_OUT':'FAILED';entry.failure=safeSqlFailure(safe);throw safe;
  }finally{clearTimer(timer);observerAbort.abort();}
 };
}
/** Attempt every fixture restoration, retaining a previously thrown primary
 * failure. Metadata contains only static operations and sanitized codes. */
export async function restoreObservedSql(cleanups,report,primaryFailure=null){
 let first=null;
 for(const cleanup of cleanups){
  if(!operations.has(cleanup.operation))throw new Error('SQL_DIAGNOSTIC_OPERATION_INVALID');
  try{await cleanup.run();}catch(error){first??=error;(report.sqlCleanupFailures??=[]).push({...safeSqlFailure(error),operation:cleanup.operation});}
 }
 if(primaryFailure){report.sqlPrimaryFailure=safeSqlFailure(primaryFailure);return;}
 if(first)throw first;
}
