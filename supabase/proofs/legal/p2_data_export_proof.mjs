// P2 data-export request ledger — authenticated disposable proof. Loopback
// only. Real local Auth/PostgREST commands plus role-scoped psql transactions
// with two observed per-account lock interleavings. No export artifact is
// generated or delivered; no production or device call.
import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {readP2ExportPredecessorPlan} from './p2_data_export_predecessor.mjs';
import {deliveryBoundary} from './p2_export_delivery_source_boundary.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const boundary=deliveryBoundary(readP2ExportPredecessorPlan()),plan=boundary.predecessorPlan;
const out=env.P2_ARTIFACT_DIR||'artifacts/p2-data-export';mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('supabase/proofs/legal/p2_data_export_files.json','utf8'));
const forward=`supabase/migrations/${manifest.forward_file}`,bytes=readFileSync(forward);
assert.deepEqual(bytes,readFileSync(manifest.candidate_file));
assert.equal(bytes.length,manifest.bytes);
assert.equal(createHash('md5').update(bytes).digest('hex'),manifest.md5);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
const report={unit:'P2_DATA_EXPORT',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  live_access:false,live_promotion:false,provider_called:false,mobile_proof:false,legal_content_real:false,export_artifact_generated:false,
  fixture_boundary:'REAL_LOCAL_AUTH_POSTGREST_AND_ROLE_SCOPED_PSQL_TRANSACTIONS',
  candidate:manifest,predecessor_plan:plan,full_source_plan:boundary.fullPlan,intentional_next_delivery_forward:boundary.next,checks:[],lock_interleavings:[]};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options),admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const wid=env.RU5_DEVICE_WORKER_USER_ID,rid=env.RU5_DEVICE_REQUESTER_USER_ID;
const validUuid=v=>{assert.match(String(v),/^[0-9a-f-]{36}$/i);return v;};validUuid(wid);validUuid(rid);
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(query){
  try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],
    {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
  catch(error){
    const code=String(error.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNAVAILABLE';
    report.failed_sql={sqlstate:code,query_sha256:createHash('sha256').update(query).digest('hex')};
    throw new Error(`DISPOSABLE_SQL_FAILED_${code}`);
  }
}
function sqlState(query){try{sql(query);return 'OK';}catch(error){return String(error.message).replace('DISPOSABLE_SQL_FAILED_','');}}
const rows=query=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));
const ok=async promise=>{const r=await promise;if(r.error)throw new Error(`AUTH_RPC_FAILED:${r.error.code??''}:${r.error.message??''}`);return r.data;};
async function rejected(promise,code,message){const r=await promise;assert.ok(r.error,'expected rejection');
  if(code)assert.equal(r.error.code,code);if(message)assert.equal(r.error.message,message);return r.error;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let current='PREFLIGHT';
const check=name=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
const tableHash=(table,where='true')=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x where ${where}`);
const status=client=>client.rpc('rpc_get_data_export_status');
const request=(client,key)=>client.rpc('rpc_request_data_export',{p_client_request_id:key});
const cancel=(client,id)=>client.rpc('rpc_cancel_data_export',{p_receipt_id:id});
const requestsOf=uid=>rows(`select id,client_request_id,status,cancelled_at is not null cancelled,completed_at is not null completed from public.data_export_requests where account_id=${q(uid)} order by requested_at,id`);
const auditCount=(uid,type)=>sql(`select count(*) from private.marketplace_audit_log where actor_user_id=${q(uid)} and event_type=${q(type)}`);
const EMPTY={hasRequest:false,request:null,downloadAvailable:false,serverFulfillmentRequired:true,externalDsrChannelReady:false};
function asyncSql(application,query){return new Promise(resolve=>{
  execFile('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At','-c',
    `set application_name=${q(application)};set statement_timeout='20s';${query}`],{encoding:'utf8',maxBuffer:1024*1024},
    (error,stdout,stderr)=>resolve({success:!error,stdout,stderr}));
});}
const authSql=(uid,query)=>`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(uid)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:uid,role:'authenticated'}))},true);${query};commit;`;
async function waitActivity(application,condition){
  for(let i=0;i<80;i++){
    if(sql(`select count(*) from pg_stat_activity where application_name=${q(application)} and (${condition})`)==='1')return;
    await sleep(50);
  }
  assert.fail(`expected controlled transaction state was not observed for ${application}`);
}
async function waitBlockedBy(holder,waiter){
  for(let i=0;i<80;i++){
    const observed=rows(`select w.pid waiter_pid,w.wait_event_type,w.wait_event,h.pid holder_pid,h.wait_event holder_wait_event,
      h.pid=any(pg_blocking_pids(w.pid)) blocked_by_holder,
      (select string_agg(l.locktype||':'||l.mode,',') from pg_locks l where l.pid=w.pid and not l.granted) pending_locks
      from pg_stat_activity w cross join pg_stat_activity h
      where w.application_name=${q(waiter)} and h.application_name=${q(holder)}`)[0];
    if(observed?.wait_event_type==='Lock'&&observed.blocked_by_holder&&observed.holder_wait_event==='PgSleep')return observed;
    await sleep(50);
  }
  assert.fail(`${waiter} was not observed blocked by ${holder}`);
}
const jsonLine=stdout=>JSON.parse(stdout.split(/\r?\n/).filter(line=>line.trim().startsWith('{')).at(-1));
let history,predecessorCount;
try{
  check('PREFLIGHT_LIVE87_PREDECESSOR_WITHOUT_EXPORT_OBJECTS');
  predecessorCount=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(predecessorCount,plan.expected_predecessor_count);
  assert.equal(sql("select to_regclass('public.data_export_requests') is null"),'t');
  assert.equal(sql("select to_regprocedure('public.rpc_request_data_export(text)') is null"),'t');
  for(const [c,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,wid],[requester,env.RU5_DEVICE_REQUESTER_EMAIL,rid]]){
    await ok(c.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(c.auth.getUser())).user.id,id);
  }
  report.predecessor_history_count=predecessorCount;pass();

  {
  check('EXACT_FORWARD_APPLY_PRESERVES_ALL87_HISTORY_AND_CLOSES_TABLE');
  history=tableHash('supabase_migrations.schema_migrations');
  const before=rows('select to_jsonb(m) metadata from supabase_migrations.schema_migrations m order by version');
  report.original_full_history_sha256=createHash('sha256').update(JSON.stringify(before)).digest('hex');
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',forward],{stdio:'pipe'});
  sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(manifest.forward_version)},${q(manifest.forward_name)},array[${q(bytes.toString('utf8'))}])`);
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),history);
  assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${q(manifest.forward_version)}`),manifest.md5);
  const after=rows('select to_jsonb(m) metadata from supabase_migrations.schema_migrations m where version<>'+q(manifest.forward_version)+' order by version');
  report.after_original_full_history_sha256=createHash('sha256').update(JSON.stringify(after)).digest('hex');
  assert.equal(report.after_original_full_history_sha256,report.original_full_history_sha256);
  assert.equal(sql('select count(*) from public.data_export_requests'),'0');
  const acl=rows(`select c.relname,c.relrowsecurity rls,c.relforcerowsecurity forced,
    has_table_privilege('anon',c.oid,'SELECT') anon_select,has_table_privilege('authenticated',c.oid,'SELECT') auth_select,
    has_table_privilege('authenticated',c.oid,'INSERT') auth_insert,has_table_privilege('authenticated',c.oid,'UPDATE') auth_update,has_table_privilege('authenticated',c.oid,'DELETE') auth_delete
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='data_export_requests'`);
  assert.equal(acl.length,1);assert.equal(acl[0].rls,true);assert.equal(acl[0].forced,true);
  for(const k of ['anon_select','auth_select','auth_insert','auth_update','auth_delete'])assert.equal(acl[0][k],false,k);
  const fn=rows(`select p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec,has_function_privilege('service_role',p.oid,'EXECUTE') service_exec,md5(p.prosrc) prosrc_md5
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('rpc_get_data_export_status','rpc_request_data_export','rpc_cancel_data_export') order by 1`);
  assert.deepEqual(fn.map(f=>[f.proname,f.prosecdef,f.anon_exec,f.auth_exec,f.service_exec]),[
    ['rpc_cancel_data_export',true,false,true,false],['rpc_get_data_export_status',true,false,true,false],['rpc_request_data_export',true,false,true,false]]);
  report.new_functions=fn;report.table_acl=acl;
  sql("notify pgrst,'reload schema'");let ready=false;
  for(let i=0;i<60;i++){const r=await status(requester);if(!r.error&&r.data&&r.data.hasRequest===false){ready=true;break;}await sleep(100);}
  assert.ok(ready,'rpc_get_data_export_status not visible through PostgREST');
  report.exact_forward_file_applied_disposable=true;report.original_predecessor_full_history_unchanged=true;pass();
  }

  {
  check('STATUS_WITHOUT_REQUEST_IS_HONEST_AND_ROLE_BOUNDED');
  assert.deepEqual(await ok(status(requester)),EMPTY);
  assert.deepEqual(await ok(status(worker)),EMPTY);
  await rejected(status(anon));await rejected(status(admin));
  await rejected(request(anon,'p2-anon-request-000000000001'));await rejected(request(admin,'p2-service-request-00000001'));
  await rejected(cancel(anon,randomUUID()));await rejected(cancel(admin,randomUUID()));
  assert.equal(sql('select count(*) from public.data_export_requests'),'0');
  pass();
  }

  const KEY='p2-requester-export-000001';
  let firstReceipt;
  {
  check('REQUEST_RECORDS_ONCE_REPLAYS_VALIDATES_KEYS_AND_AUDITS');
  firstReceipt=await ok(request(requester,KEY));
  assert.equal(firstReceipt.status,'REQUESTED');assert.equal(firstReceipt.idempotentReplay,false);assert.equal(firstReceipt.downloadAvailable,false);assert.equal(firstReceipt.serverFulfillmentRequired,true);
  validUuid(firstReceipt.receiptId);assert.equal(firstReceipt.clientRequestId,KEY);
  const replay=await ok(request(requester,KEY));
  assert.equal(replay.idempotentReplay,true);assert.equal(replay.receiptId,firstReceipt.receiptId);assert.equal(replay.requestedAt,firstReceipt.requestedAt);
  for(const key of [null,'','short','a'.repeat(97),'bad key','bad/key'])await rejected(request(requester,key),'22023','INVALID_CLIENT_REQUEST_ID');
  const evs=requestsOf(rid);assert.equal(evs.length,1);assert.equal(evs[0].id,firstReceipt.receiptId);assert.equal(evs[0].status,'REQUESTED');
  assert.equal(auditCount(rid,'DATA_EXPORT_REQUESTED'),'1');
  const s=await ok(status(requester));
  assert.equal(s.hasRequest,true);assert.equal(s.request.receiptId,firstReceipt.receiptId);assert.equal(s.request.status,'REQUESTED');assert.equal(s.request.kind,'ACCESS_EXPORT');assert.equal(s.request.source,'IN_APP_AUTHENTICATED');
  assert.equal(s.downloadAvailable,false);assert.equal(s.serverFulfillmentRequired,true);assert.equal(s.externalDsrChannelReady,false);
  assert.deepEqual(await ok(status(worker)),EMPTY);
  pass();
  }

  let secondReceipt;
  {
  check('SECOND_OPEN_REQUEST_REFUSED_UNTIL_TERMINAL_AND_ONE_OPEN_INDEX_HOLDS');
  await rejected(request(requester,'p2-requester-export-000002'),'55000','DATA_EXPORT_REQUEST_ALREADY_OPEN');
  sql(`update public.data_export_requests set status='PROCESSING',updated_at=statement_timestamp() where id=${q(firstReceipt.receiptId)}`);
  await rejected(request(requester,'p2-requester-export-000002'),'55000','DATA_EXPORT_REQUEST_ALREADY_OPEN');
  await rejected(cancel(requester,firstReceipt.receiptId),'55000','DATA_EXPORT_REQUEST_NOT_CANCELLABLE');
  assert.equal(sqlState(`insert into public.data_export_requests(account_id,client_request_id) values(${q(rid)},'p2-trusted-duplicate-open-01')`),'23505');
  assert.equal(sqlState(`update public.data_export_requests set status='READY' where id=${q(firstReceipt.receiptId)}`),'23514','READY requires completed_at');
  sql(`update public.data_export_requests set status='READY',completed_at=statement_timestamp(),updated_at=statement_timestamp() where id=${q(firstReceipt.receiptId)}`);
  assert.equal((await ok(status(requester))).request.status,'READY');
  assert.equal((await ok(status(requester))).downloadAvailable,false,'READY at this boundary still exposes no download');
  secondReceipt=await ok(request(requester,'p2-requester-export-000002'));
  assert.equal(secondReceipt.idempotentReplay,false);assert.equal(secondReceipt.status,'REQUESTED');
  assert.equal(requestsOf(rid).length,2);
  assert.equal((await ok(status(requester))).request.receiptId,secondReceipt.receiptId,'status projects the latest request');
  pass();
  }

  {
  check('CANCEL_IS_OWNER_ONLY_IDEMPOTENT_AND_STATE_BOUND');
  await rejected(cancel(worker,secondReceipt.receiptId),'P0002','DATA_EXPORT_REQUEST_NOT_FOUND');
  await rejected(cancel(requester,randomUUID()),'P0002','DATA_EXPORT_REQUEST_NOT_FOUND');
  await rejected(cancel(requester,null),'22023','INVALID_RECEIPT_ID');
  await rejected(cancel(requester,firstReceipt.receiptId),'55000','DATA_EXPORT_REQUEST_NOT_CANCELLABLE');
  const cancelled=await ok(cancel(requester,secondReceipt.receiptId));
  assert.equal(cancelled.status,'CANCELLED');assert.equal(cancelled.idempotentReplay,false);assert.ok(cancelled.cancelledAt);
  const replay=await ok(cancel(requester,secondReceipt.receiptId));
  assert.equal(replay.idempotentReplay,true);assert.equal(replay.cancelledAt,cancelled.cancelledAt);
  assert.equal(auditCount(rid,'DATA_EXPORT_CANCELLED'),'1');
  const s=await ok(status(requester));assert.equal(s.request.status,'CANCELLED');assert.ok(s.request.cancelledAt);
  const third=await ok(request(requester,'p2-requester-export-000003'));
  assert.equal(third.idempotentReplay,false);assert.equal(requestsOf(rid).length,3);
  assert.equal(requestsOf(rid).filter(r=>r.status==='REQUESTED').length,1);
  pass();
  }

  {
  check('DIRECT_TABLE_ACCESS_REMAINS_DENIED_FOR_AUTHENTICATED');
  const settled=tableHash('public.data_export_requests');
  {const sel=await requester.from('data_export_requests').select('id');assert.ok(sel.error||sel.data?.length===0,'direct select must be denied or empty');}
  const ins=await requester.from('data_export_requests').insert({account_id:rid,client_request_id:'p2-direct-insert-00000001'}).select('id');
  assert.ok(ins.error||ins.data?.length===0,'direct insert must be denied');
  const upd=await requester.from('data_export_requests').update({status:'READY',completed_at:new Date().toISOString()}).eq('account_id',rid).select('id');
  assert.ok(upd.error||upd.data?.length===0,'direct update must be denied');
  const del=await requester.from('data_export_requests').delete().eq('account_id',rid).select('id');
  assert.ok(del.error||del.data?.length===0,'direct delete must be denied');
  assert.equal(tableHash('public.data_export_requests'),settled);
  pass();
  }

  {
  check('OBSERVED_LOCKS_SAME_ACCOUNT_DIFFERENT_KEYS_ONE_OPEN_AND_SAME_KEY_ONE_REPLAY');
  assert.equal(requestsOf(wid).length,0);
  const holderApp='p2-holder-request',waiterApp='p2-waiter-request';
  const holder=asyncSql(holderApp,authSql(wid,`select public.rpc_request_data_export('p2-worker-export-key-a-001');select pg_sleep(3)`));
  await waitActivity(holderApp,"wait_event='PgSleep'");
  const waiter=asyncSql(waiterApp,authSql(wid,`select public.rpc_request_data_export('p2-worker-export-key-b-001')`));
  const observed=await waitBlockedBy(holderApp,waiterApp);report.lock_interleavings.push({case:'DIFFERENT_KEYS_HOLDER_WAITER',...observed});
  const [h,w]=await Promise.all([holder,waiter]);
  assert.ok(h.success,'holder request failed');assert.ok(!w.success,'different-key waiter must be refused while a request is open');
  assert.match(String(w.stderr),/DATA_EXPORT_REQUEST_ALREADY_OPEN/);
  const hr=jsonLine(h.stdout);assert.equal(hr.idempotentReplay,false);assert.equal(hr.status,'REQUESTED');
  assert.equal(requestsOf(wid).length,1);
  assert.equal((await ok(cancel(worker,hr.receiptId))).status,'CANCELLED');
  const holder2App='p2-holder-request-2',waiter2App='p2-waiter-request-2';
  const holder2=asyncSql(holder2App,authSql(wid,`select public.rpc_request_data_export('p2-worker-export-key-c-001');select pg_sleep(3)`));
  await waitActivity(holder2App,"wait_event='PgSleep'");
  const waiter2=asyncSql(waiter2App,authSql(wid,`select public.rpc_request_data_export('p2-worker-export-key-c-001')`));
  const observed2=await waitBlockedBy(holder2App,waiter2App);report.lock_interleavings.push({case:'SAME_KEY_HOLDER_WAITER',...observed2});
  const [h2,w2]=await Promise.all([holder2,waiter2]);assert.ok(h2.success,'holder2 failed');assert.ok(w2.success,'same-key waiter must replay');
  const hr2=jsonLine(h2.stdout),wr2=jsonLine(w2.stdout);
  assert.equal(hr2.idempotentReplay,false);assert.equal(wr2.idempotentReplay,true);assert.equal(wr2.receiptId,hr2.receiptId);
  assert.equal(requestsOf(wid).length,2);assert.equal(requestsOf(wid).filter(r=>r.status==='REQUESTED').length,1);
  assert.equal(auditCount(wid,'DATA_EXPORT_REQUESTED'),'2');
  pass();
  }

  {
  check('FINAL_FINGERPRINTS_HISTORY_AND_NO_ARTIFACT');
  // Prove P2 completely at its own position, then replay every later pending
  // source and prove that the export boundary remains byte/behavior stable.
  const requesterStatusBefore=await ok(status(requester));
  const workerStatusBefore=await ok(status(worker));
  const exportRowsBefore=tableHash('public.data_export_requests');
  const functions=()=>rows(`select p.proname,p.prosecdef,p.proacl,p.proconfig,md5(p.prosrc) body
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('rpc_get_data_export_status','rpc_request_data_export','rpc_cancel_data_export') order by 1`);
  const functionsBefore=functions();assert.equal(functionsBefore.length,3);
  const tableSecurity=()=>rows(`select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='data_export_requests'`);
  const securityBefore=tableSecurity();assert.equal(securityBefore.length,1);
  const appliedSuccessors=[];
  for(const successor of plan.pending_successors){
    assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version=${q(successor.version)}`),'0');
    const file=`supabase/migrations/${successor.file}`,suffixBytes=readFileSync(file);
    assert.equal(createHash('md5').update(suffixBytes).digest('hex'),successor.md5);
    execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',file],{stdio:'pipe'});
    sql(`insert into supabase_migrations.schema_migrations(version,name,statements)
      values(${q(successor.version)},${q(successor.name)},array[${q(suffixBytes.toString('utf8'))}])`);
    assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${q(successor.version)}`),successor.md5);
    appliedSuccessors.push(successor);
  }
  sql("notify pgrst,'reload schema'");
  assert.deepEqual(await ok(status(requester)),requesterStatusBefore,'EXPORT_REQUESTER_STATUS_CHANGED_BY_SUCCESSOR');
  assert.deepEqual(await ok(status(worker)),workerStatusBefore,'EXPORT_WORKER_STATUS_CHANGED_BY_SUCCESSOR');
  assert.equal(tableHash('public.data_export_requests'),exportRowsBefore,'EXPORT_ROWS_CHANGED_BY_SUCCESSOR');
  assert.deepEqual(functions(),functionsBefore,'EXPORT_FUNCTIONS_OR_GRANTS_CHANGED_BY_SUCCESSOR');
  assert.deepEqual(tableSecurity(),securityBefore,'EXPORT_TABLE_SECURITY_CHANGED_BY_SUCCESSOR');
  report.successor_replay={applied:appliedSuccessors,count:appliedSuccessors.length,
    export_projection_unchanged:true,export_rows_unchanged:true,export_functions_and_grants_unchanged:true,export_security_unchanged:true};
  const newlyApplied=[manifest.forward_version,...appliedSuccessors.map(item=>item.version)];
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version not in (${newlyApplied.map(q).join(',')})`),history);
  report.successor_replay.original_history_unchanged=true;
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(report.migration_history_count,predecessorCount+1+appliedSuccessors.length);
  assert.equal(report.migration_history_count,plan.source_migration_count);
  assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname ~* 'export_(generate|build|deliver|artifact)'"),'0','no artifact generator may be admitted');
  report.request_rows={requester:requestsOf(rid).length,worker:requestsOf(wid).length};
  pass();
  }
  report.result='PASS';
}catch(error){
  report.result='FAIL';report.failed_check=current;
  report.failure=error?.code==='ERR_ASSERTION'?`ASSERTION:${String(error.message).slice(0,200)}`:String(error.message).slice(0,200);
  process.exitCode=1;
}finally{
  writeFileSync(`${out}/proof-report.json`,`${JSON.stringify(report,null,2)}\n`);
  console.log(`${report.result} P2_DATA_EXPORT`);
}
