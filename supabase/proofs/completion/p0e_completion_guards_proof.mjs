// P0E completion truth guards — authenticated disposable proof. Loopback only.
// Real local Auth/PostgREST commands plus role-scoped psql transactions with
// observed PostgreSQL row-lock contention. No production, provider or device call.
import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {readP0eCompletionPredecessorPlan} from './p0e_completion_guards_predecessor.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const plan=readP0eCompletionPredecessorPlan();
const out=env.P0E_ARTIFACT_DIR||'artifacts/p0e-completion-guards';mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('supabase/proofs/completion/p0e_completion_guards_files.json','utf8'));
const forward=`supabase/migrations/${manifest.forward_file}`,bytes=readFileSync(forward);
assert.deepEqual(bytes,readFileSync(manifest.candidate_file));
assert.equal(bytes.length,manifest.bytes);
assert.equal(createHash('md5').update(bytes).digest('hex'),manifest.md5);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
const report={unit:'P0E_COMPLETION_GUARDS',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  live_access:false,live_promotion:false,provider_called:false,mobile_proof:false,
  fixture_boundary:'REAL_LOCAL_AUTH_POSTGREST_AND_ROLE_SCOPED_PSQL_TRANSACTIONS',
  candidate:manifest,predecessor_plan:plan,checks:[],lock_interleavings:[]};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const outsider=createClient(url,env.RU5_DEVICE_ANON_KEY,options),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
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
const rows=query=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));
const ok=async promise=>{const r=await promise;if(r.error)throw new Error(`AUTH_RPC_FAILED:${r.error.code??''}:${r.error.message??''}`);return r.data;};
async function rejected(promise,code,message){const r=await promise;assert.ok(r.error,'expected rejection');
  if(code)assert.equal(r.error.code,code);if(message)assert.equal(r.error.message,message);return r.error;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let current='PREFLIGHT';
const check=name=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=extra=>{report.checks.push({name:current,result:'PASS',...(extra||{})});console.log(`PASS_CHECK ${current}`);};
const bodyMd5=signature=>sql(`select md5(prosrc) from pg_proc where oid=to_regprocedure(${q(signature)})`);
const tableHash=(table,where='true')=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x where ${where}`);
const execution=id=>rows(`select state,requester_deadline_at,worker_marked_done_at,completed_at,problem_opened_at,problem_narrative,problem_opened_by,agreement_version from public.agreement_execution where agreement_id=${q(id)}`)[0];
const agreementStatus=id=>sql(`select status from public.agreements where id=${q(id)}`);
const needStatus=id=>sql(`select status from public.needs where id=${q(id)}`);
const events=(id,type)=>rows(`select recipient_user_id,recipient_role,payload,dedupe_key from public.user_activity_events where entity_type='AGREEMENT' and entity_id=${q(id)} and event_type=${q(type)}`);
const messages=id=>Number(sql(`select count(*) from public.agreement_messages where agreement_id=${q(id)}`));
const rowsOf=id=>({execution:execution(id),status:agreementStatus(id),messages:messages(id),
  events:['COMPLETION_REQUIRED','EXECUTION_STATE_CHANGED','RECOVERY_OPENED'].map(t=>[t,events(id,t).length])});
const mark=(client,id)=>client.rpc('rpc_mark_work_done',{p_agreement_id:id});
const confirm=(client,id)=>client.rpc('rpc_confirm_completion',{p_agreement_id:id});
const problem=(client,id,narrative)=>client.rpc('rpc_report_problem',{p_agreement_id:id,p_narrative:narrative});
const cancel=(client,id)=>client.rpc('rpc_cancel_agreement',{p_agreement_id:id,p_reason:'P0E disposable cancellation fixture'});
const pastDeadline=id=>sql(`update public.agreement_execution set requester_deadline_at=statement_timestamp()-interval '1 hour' where agreement_id=${q(id)} and state='AWAITING_REQUESTER'`);
function asyncSql(application,query){return new Promise(resolve=>{
  execFile('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At','-c',
    `set application_name=${q(application)};set statement_timeout='20s';${query}`],{encoding:'utf8',maxBuffer:1024*1024},
    (error,stdout,stderr)=>resolve({success:!error,stdout,stderr}));
});}
const authSql=(uid,query)=>`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(uid)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:uid,role:'authenticated'}))},true);${query};commit;`;
const serviceSql=query=>`begin;set local role service_role;${query};commit;`;
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
// Same narrowly scoped disposable Need seed used by admitted proofs; response and
// selection run through the actual authenticated domain RPCs.
async function anotherAgreement(){
  const need=randomUUID();
  const rp=await ok(requester.from('app_profiles').select('id').eq('account_id',rid).eq('kind','REQUESTER').single());
  const wp=await ok(worker.from('app_profiles').select('id').eq('account_id',wid).eq('kind','WORKER').single());
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,response_deadline,published_at) values(${q(need)},${q(rid)},${q(rp.id)},'PUBLISHED','P0E disposable fixture','P0E completion guard fixture','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
  const response=await ok(worker.rpc('rpc_submit_response',{p_need_id:need,p_need_revision:1,p_worker_profile_id:wp.id,
    p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:`p0e-submit-${randomUUID()}`}));
  const agreement=validUuid(await ok(requester.rpc('rpc_select_response',{p_need_id:need,p_need_revision:1,p_response_id:response.responseId,
    p_response_version:response.version,p_content_hash:response.contentHash,p_client_request_id:`p0e-select-${randomUUID()}`})));
  assert.equal(agreementStatus(agreement),'CONFIRMED');assert.equal(execution(agreement).state,'CONFIRMED');
  return {agreement,need};
}
let history,predecessorCount;
try{
  check('PREFLIGHT_LIVE87_PREDECESSOR_AND_REAL_ACCOUNTS');
  predecessorCount=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(predecessorCount,plan.expected_predecessor_count);
  for(const [signature,expected] of Object.entries(manifest.predecessor_body_md5))assert.ok([].concat(expected).includes(bodyMd5(signature)),`PREDECESSOR_BODY:${signature}`);
  for(const [c,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,wid],[requester,env.RU5_DEVICE_REQUESTER_EMAIL,rid]]){
    await ok(c.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(c.auth.getUser())).user.id,id);
  }
  const outsiderEmail=`p0e-outsider-${randomUUID()}@proof.invalid`,password=`P0E${randomUUID()}Aa1`;
  const outsiderUser=(await ok(admin.auth.admin.createUser({email:outsiderEmail,password,email_confirm:true}))).user;
  await ok(outsider.auth.signInWithPassword({email:outsiderEmail,password}));assert.equal((await ok(outsider.auth.getUser())).user.id,outsiderUser.id);
  report.predecessor_history_count=predecessorCount;pass();

  const A=await anotherAgreement(),B=await anotherAgreement(),C=await anotherAgreement();
  {
  check('PREDECESSOR_REPRODUCES_DEADLINE_EXTENSION_RESURRECTION_AND_DUPLICATE_PROBLEM');
  const d1=await ok(mark(worker,A.agreement));await sleep(1200);const d2=await ok(mark(worker,A.agreement));
  assert.ok(Date.parse(d2)>Date.parse(d1),'predecessor must extend the deadline on replay');
  await ok(cancel(requester,B.agreement));assert.equal(agreementStatus(B.agreement),'CANCELLED');
  const resurrected=await confirm(requester,B.agreement);assert.equal(resurrected.error,null,'predecessor must accept completion of a cancelled Agreement');
  assert.equal(agreementStatus(B.agreement),'COMPLETED');assert.equal(execution(B.agreement).state,'COMPLETED');
  await ok(problem(worker,C.agreement,'P0E predecessor problem narrative one'));await ok(problem(worker,C.agreement,'P0E predecessor problem narrative two'));
  assert.equal(messages(C.agreement),2);
  report.predecessor={deadline_extended_on_replay:true,cancelled_agreement_resurrected:true,duplicate_problem_messages:2,
    body_md5:Object.fromEntries(Object.keys(manifest.predecessor_body_md5).map(s=>[s,bodyMd5(s)]))};pass();
  }

  {
  check('EXACT_FORWARD_APPLY_PRESERVES_ALL87_HISTORY_AND_EXISTING_ROWS');
  history=tableHash('supabase_migrations.schema_migrations');
  const before=rows('select to_jsonb(m) metadata from supabase_migrations.schema_migrations m order by version');
  report.original_full_history_sha256=createHash('sha256').update(JSON.stringify(before)).digest('hex');
  const executionRows=tableHash('public.agreement_execution'),agreementRows=tableHash('public.agreements'),messageRows=tableHash('public.agreement_messages');
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',forward],{stdio:'pipe'});
  sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(manifest.forward_version)},${q(manifest.forward_name)},array[${q(bytes.toString('utf8'))}])`);
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),history);
  assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${q(manifest.forward_version)}`),manifest.md5);
  for(const [signature,expected] of Object.entries(manifest.candidate_body_md5))assert.equal(bodyMd5(signature),expected,signature);
  assert.equal(tableHash('public.agreement_execution'),executionRows);assert.equal(tableHash('public.agreements'),agreementRows);assert.equal(tableHash('public.agreement_messages'),messageRows);
  const after=rows('select to_jsonb(m) metadata from supabase_migrations.schema_migrations m where version<>'+q(manifest.forward_version)+' order by version');
  report.after_original_full_history_sha256=createHash('sha256').update(JSON.stringify(after)).digest('hex');
  assert.equal(report.after_original_full_history_sha256,report.original_full_history_sha256);
  sql("notify pgrst,'reload schema'");let ready=false;
  for(let i=0;i<60;i++){const r=await problem(worker,C.agreement,'P0E readiness probe narrative');if(!r.error&&r.data&&r.data.idempotentReplay===true){ready=true;break;}await sleep(100);}
  assert.ok(ready,'new rpc_report_problem contract not visible through PostgREST');assert.equal(messages(C.agreement),2);
  report.exact_forward_file_applied_disposable=true;report.original_predecessor_full_history_unchanged=true;pass();
  }

  const D=await anotherAgreement();
  {
  check('MARK_DONE_ONCE_THEN_EXACT_REPLAY_WITHOUT_UPDATE_OR_SECOND_EVENT');
  assert.equal(events(D.agreement,'COMPLETION_REQUIRED').length,0);
  const d1=await ok(mark(worker,D.agreement));const snapshot=rowsOf(D.agreement);
  assert.equal(snapshot.execution.state,'AWAITING_REQUESTER');assert.equal(Date.parse(snapshot.execution.requester_deadline_at),Date.parse(d1));
  assert.equal(Math.round((Date.parse(d1)-Date.parse(snapshot.execution.worker_marked_done_at))/3600000),48);
  await sleep(1200);const d2=await ok(mark(worker,D.agreement));assert.equal(d2,d1);
  assert.deepEqual(rowsOf(D.agreement),snapshot);
  const ev=events(D.agreement,'COMPLETION_REQUIRED');assert.equal(ev.length,1);assert.equal(ev[0].recipient_user_id,rid);assert.equal(ev[0].recipient_role,'REQUESTER');
  assert.equal(Date.parse(ev[0].payload.requesterDeadlineAt),Date.parse(d1));
  report.mark_done={deadline:d1,replay_deadline:d2,events:1};pass();
  }

  {
  check('MARK_DONE_AUTHORITY_AND_ABSENCE_BOUNDARIES_RETAIN_STATE');
  const snapshot=rowsOf(D.agreement);
  await rejected(mark(requester,D.agreement),'42501','ONLY_WORKER_CAN_MARK_DONE');
  await rejected(mark(outsider,D.agreement),'42501','ONLY_WORKER_CAN_MARK_DONE');
  await rejected(mark(anon,D.agreement));await rejected(mark(admin,D.agreement),'28000','AUTH_REQUIRED');
  await rejected(mark(worker,randomUUID()),'P0002','AGREEMENT_NOT_FOUND');
  assert.deepEqual(rowsOf(D.agreement),snapshot);pass();
  }

  const E=await anotherAgreement();
  {
  check('REQUESTER_CONFIRMS_FROM_CONFIRMED_AND_FROM_AWAITING_THEN_REPLAY_IS_IDEMPOTENT');
  const fromConfirmed=await ok(confirm(requester,E.agreement));
  assert.equal(fromConfirmed.state,'COMPLETED');assert.equal(fromConfirmed.idempotentReplay,false);assert.equal(fromConfirmed.needCompleted,true);
  assert.equal(agreementStatus(E.agreement),'COMPLETED');assert.equal(execution(E.agreement).state,'COMPLETED');assert.equal(needStatus(E.need),'COMPLETED');
  const fromAwaiting=await ok(confirm(requester,D.agreement));
  assert.equal(fromAwaiting.state,'COMPLETED');assert.equal(fromAwaiting.idempotentReplay,false);assert.equal(fromAwaiting.problemWasPreviouslyReported,false);
  assert.equal(execution(D.agreement).requester_deadline_at,null);assert.equal(needStatus(D.need),'COMPLETED');
  const settled=rowsOf(D.agreement);
  const replay=await ok(confirm(requester,D.agreement));assert.equal(replay.idempotentReplay,true);assert.equal(replay.state,'COMPLETED');
  assert.equal(replay.completedAt,fromAwaiting.completedAt);assert.deepEqual(rowsOf(D.agreement),settled);
  for(const id of [D.agreement,E.agreement]){const ev=events(id,'EXECUTION_STATE_CHANGED');assert.equal(ev.length,1);assert.equal(ev[0].recipient_user_id,wid);assert.equal(ev[0].recipient_role,'WORKER');}
  report.confirm={from_confirmed:fromConfirmed,from_awaiting:fromAwaiting,replay};pass();
  }

  const F=await anotherAgreement();
  {
  check('CONFIRM_AUTHORITY_BOUNDARIES_RETAIN_STATE');
  const snapshot=rowsOf(F.agreement);
  await rejected(confirm(worker,F.agreement),'42501','ONLY_REQUESTER_CAN_CONFIRM_COMPLETION');
  await rejected(confirm(outsider,F.agreement),'42501','ONLY_REQUESTER_CAN_CONFIRM_COMPLETION');
  await rejected(confirm(anon,F.agreement));await rejected(confirm(admin,F.agreement),'28000','AUTH_REQUIRED');
  await rejected(confirm(requester,randomUUID()),'P0002','AGREEMENT_NOT_FOUND');
  assert.deepEqual(rowsOf(F.agreement),snapshot);pass();
  }

  {
  check('CANCELLED_AGREEMENT_NEVER_RESURRECTS_THROUGH_MARK_CONFIRM_OR_PROBLEM');
  await ok(cancel(requester,F.agreement));assert.equal(agreementStatus(F.agreement),'CANCELLED');
  const snapshot=rowsOf(F.agreement);
  await rejected(mark(worker,F.agreement),'P0001','AGREEMENT_CANCELLED');
  await rejected(confirm(requester,F.agreement),'P0001','AGREEMENT_CANCELLED');
  await rejected(problem(worker,F.agreement,'P0E problem after cancellation'),'P0001','AGREEMENT_NOT_REPORTABLE');
  await rejected(problem(requester,F.agreement,'P0E problem after cancellation'),'P0001','AGREEMENT_NOT_REPORTABLE');
  assert.deepEqual(rowsOf(F.agreement),snapshot);assert.equal(agreementStatus(F.agreement),'CANCELLED');assert.equal(execution(F.agreement).state,'CANCELLED');pass();
  }

  const G=await anotherAgreement();
  {
  check('PROBLEM_RECORDED_ONCE_WITHOUT_DUPLICATE_MESSAGE_OR_EVENT_AND_NARRATIVE_PRESERVED');
  const first=await ok(problem(worker,G.agreement,'  P0E first narrative  '));assert.equal(first.idempotentReplay,false);assert.equal(first.noAutomaticFaultOrDebt,true);
  const settled=rowsOf(G.agreement);assert.equal(settled.messages,1);assert.equal(settled.execution.problem_narrative,'P0E first narrative');assert.equal(settled.execution.problem_opened_by,wid);
  const second=await ok(problem(requester,G.agreement,'P0E second narrative from the other party'));assert.equal(second.idempotentReplay,true);
  assert.equal(second.problemOpenedAt,first.problemOpenedAt);assert.deepEqual(rowsOf(G.agreement),settled);
  const ev=events(G.agreement,'RECOVERY_OPENED');assert.equal(ev.length,1);assert.equal(ev[0].recipient_user_id,rid);assert.deepEqual(ev[0].payload,{reportedByRole:'WORKER'});
  await rejected(problem(worker,G.agreement,''),'22023','NARRATIVE_REQUIRED');await rejected(problem(worker,G.agreement,'   '),'22023','NARRATIVE_REQUIRED');
  await rejected(problem(worker,G.agreement,'a'.repeat(4001)),'22023','NARRATIVE_TOO_LONG');
  await rejected(problem(outsider,G.agreement,'P0E outsider narrative'),'42501','NOT_PARTY');await rejected(problem(anon,G.agreement,'P0E anon narrative'));
  assert.deepEqual(rowsOf(G.agreement),settled);assert.equal(agreementStatus(G.agreement),'CONFIRMED');pass();
  }

  const H=await anotherAgreement();
  {
  check('OPEN_PROBLEM_BLOCKS_AUTO_COMPLETION_BUT_NOT_EXPLICIT_REQUESTER_COMPLETION');
  await ok(mark(worker,H.agreement));await ok(problem(requester,H.agreement,'P0E problem before the deadline'));
  assert.equal(pastDeadline(H.agreement),'UPDATE 1');
  sql(serviceSql('select public.rpc_tick_auto_completion()'));
  assert.equal(execution(H.agreement).state,'AWAITING_REQUESTER');assert.equal(agreementStatus(H.agreement),'CONFIRMED');
  const explicit=await ok(confirm(requester,H.agreement));assert.equal(explicit.state,'COMPLETED');assert.equal(explicit.problemWasPreviouslyReported,true);
  assert.equal(agreementStatus(H.agreement),'COMPLETED');assert.equal(execution(H.agreement).problem_narrative,'P0E problem before the deadline');
  report.problem_blocks_auto={tick_skipped_open_problem:true,explicit_completion:explicit};pass();
  }

  const I=await anotherAgreement();
  {
  check('SERVICE_TICK_COMPLETES_DUE_AWAITING_AND_LATER_EXPLICIT_CONFIRM_IS_REPLAY');
  await ok(mark(worker,I.agreement));assert.equal(pastDeadline(I.agreement),'UPDATE 1');
  sql(serviceSql('select public.rpc_tick_auto_completion()'));
  assert.equal(agreementStatus(I.agreement),'COMPLETED');assert.equal(execution(I.agreement).state,'COMPLETED');assert.equal(needStatus(I.need),'COMPLETED');
  const settled=rowsOf(I.agreement);const replay=await ok(confirm(requester,I.agreement));assert.equal(replay.idempotentReplay,true);assert.deepEqual(rowsOf(I.agreement),settled);
  report.auto_completion={emits_worker_event:events(I.agreement,'EXECUTION_STATE_CHANGED').length>0,note:'service tick path predates this unit and emits no worker event; explicit confirm replay adds none'};pass();
  }

  const J=await anotherAgreement();
  {
  check('OBSERVED_LOCK_SERVICE_TICK_HOLDER_VERSUS_REQUESTER_CONFIRM_WAITER_CONVERGES_ONCE');
  await ok(mark(worker,J.agreement));assert.equal(pastDeadline(J.agreement),'UPDATE 1');
  const holderApp='p0e-holder-tick',waiterApp='p0e-waiter-confirm';
  const holder=asyncSql(holderApp,serviceSql('select public.rpc_tick_auto_completion();select pg_sleep(3)'));
  await waitActivity(holderApp,"wait_event='PgSleep'");
  const waiter=asyncSql(waiterApp,authSql(rid,`select public.rpc_confirm_completion(${q(J.agreement)})`));
  const observed=await waitBlockedBy(holderApp,waiterApp);report.lock_interleavings.push({case:'TICK_HOLDER_CONFIRM_WAITER',...observed});
  const [h,w]=await Promise.all([holder,waiter]);assert.ok(h.success,'tick holder failed');assert.ok(w.success,'confirm waiter failed');
  const result=jsonLine(w.stdout);assert.equal(result.state,'COMPLETED');assert.equal(result.idempotentReplay,true);
  assert.equal(agreementStatus(J.agreement),'COMPLETED');assert.equal(sql(`select count(*) from public.agreement_execution where agreement_id=${q(J.agreement)} and state='COMPLETED' and completed_at is not null`),'1');
  assert.equal(events(J.agreement,'EXECUTION_STATE_CHANGED').length,0);pass();
  }

  const K=await anotherAgreement();
  {
  check('OBSERVED_LOCK_REQUESTER_CONFIRM_HOLDER_VERSUS_SERVICE_TICK_WAITER_CONVERGES_ONCE');
  await ok(mark(worker,K.agreement));assert.equal(pastDeadline(K.agreement),'UPDATE 1');
  const holderApp='p0e-holder-confirm',waiterApp='p0e-waiter-tick';
  const holder=asyncSql(holderApp,authSql(rid,`select public.rpc_confirm_completion(${q(K.agreement)});select pg_sleep(3)`));
  await waitActivity(holderApp,"wait_event='PgSleep'");
  const waiter=asyncSql(waiterApp,serviceSql('select public.rpc_tick_auto_completion()'));
  const observed=await waitBlockedBy(holderApp,waiterApp);report.lock_interleavings.push({case:'CONFIRM_HOLDER_TICK_WAITER',...observed});
  const [h,w]=await Promise.all([holder,waiter]);assert.ok(h.success,'confirm holder failed');assert.ok(w.success,'tick waiter failed');
  const result=jsonLine(h.stdout);assert.equal(result.state,'COMPLETED');assert.equal(result.idempotentReplay,false);
  // The tick that waited on the confirm lock must re-check and skip the row: no overwrite, no over-count.
  assert.equal(w.stdout.split(/\r?\n/).map(l=>l.trim()).filter(l=>/^\d+$/.test(l)).at(-1),'0','tick must skip the row completed under its lock wait');
  assert.equal(agreementStatus(K.agreement),'COMPLETED');
  assert.equal(sql(`select count(*) from public.agreement_execution where agreement_id=${q(K.agreement)} and state='COMPLETED' and completed_at=${q(result.completedAt)}::timestamptz`),'1');
  assert.equal(events(K.agreement,'EXECUTION_STATE_CHANGED').length,1);pass();
  }

  {
  check('DIRECT_TABLE_WRITES_REMAIN_DENIED_FOR_AUTHENTICATED_PARTIES');
  const settled=rowsOf(G.agreement);
  const attempt=await requester.from('agreement_execution').update({state:'COMPLETED'}).eq('agreement_id',G.agreement).select('agreement_id');
  assert.ok(attempt.error||attempt.data?.length===0,'direct execution mutation must be denied');
  const attempt2=await worker.from('agreements').update({status:'COMPLETED'}).eq('id',G.agreement).select('id');
  assert.ok(attempt2.error||attempt2.data?.length===0,'direct agreement mutation must be denied');
  assert.deepEqual(rowsOf(G.agreement),settled);pass();
  }

  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(report.migration_history_count,predecessorCount+1);
  assert.equal(report.migration_history_count,plan.source_migration_count);
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),history);
  report.result='PASS';
}catch(error){
  report.result='FAIL';report.failed_check=current;
  report.failure=error?.code==='ERR_ASSERTION'?`ASSERTION:${String(error.message).slice(0,200)}`:String(error.message).slice(0,200);
  process.exitCode=1;
}finally{
  writeFileSync(`${out}/proof-report.json`,`${JSON.stringify(report,null,2)}\n`);
  console.log(`${report.result} P0E_COMPLETION_GUARDS`);
}
