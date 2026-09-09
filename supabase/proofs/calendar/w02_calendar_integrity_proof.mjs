// Current app data adapters -> real Auth/PostgREST -> Agreement/calendar. The
// published Needs below are explicitly isolated SQL fixtures, NOT UI publication
// proof. No live target, synthetic provider success, or implicit write retry.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';
import { readP3RetentionPredecessorPlan } from '../legal/p3_retention_schedule_predecessor.mjs';

const env=process.env, url=env.RU5_DEVICE_SUPABASE_URL, db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const out=env.W02_CALENDAR_ARTIFACT_DIR;
assert.ok(out);
const plan=readP3RetentionPredecessorPlan();
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const q=value=>`'${String(value).replaceAll("'","''")}'`;
const uid=value=>{assert.match(value,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);return value;};
const requesterId=uid(env.RU5_DEVICE_REQUESTER_USER_ID),workerId=uid(env.RU5_DEVICE_WORKER_USER_ID);
const report={unit:'W02_CALENDAR_INTERVAL_INTEGRITY',source_sha:env.GITHUB_SHA,checks:[],
  live_access:false,live_promotion:false,external_provider_called:false,visual_design_changed:false,
  fixture_sql_used:true,ui_journey_proven:false,mocked_rpc_responses:false,input_sha256:{},lock_observations:[]};
let current='SETUP';
const children=new Set();
const check=name=>{current=name;console.log('START_CHECK '+name);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log('PASS_CHECK '+current);};
function sql(query){
  try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
  catch{throw new Error('ISOLATED_SQL_FAILED');}
}
const ok=async promise=>{const result=await promise;assert.equal(result.error,null,'REAL_RPC_REFUSED');return result.data;};
const row=(id)=>JSON.parse(sql(`select row_to_json(e)::text from private.worker_calendar_events e where agreement_id=${q(uid(id))}::uuid`));
const day=number=>new Date(Date.now()+(16+number)*86400000).toISOString();
const addHour=(start,hours=1)=>new Date(Date.parse(start)+hours*3600000).toISOString();
const rangeFrom=day(-1),rangeTo=day(20);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){if(predicate())return;await delay(40);}
  throw new Error(label);
}
function session(initial){
  const child=spawn('psql',[db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
  children.add(child);
  let stdout='',stderr='';
  child.stdout.on('data',data=>{stdout+=data;});child.stderr.on('data',data=>{stderr+=data;});
  const done=new Promise(resolve=>child.on('close',code=>{children.delete(child);resolve({code,stdout,stderr});}));
  child.stdin.write(initial+'\n');
  return {child,done,output:()=>stdout};
}
let profile,requesterProfile;
async function need(start,end,label){
  const id=randomUUID();
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,response_deadline,published_at)
    values(${q(id)}::uuid,${q(requesterId)}::uuid,${q(requesterProfile)}::uuid,'PUBLISHED',${q('W02 isolated '+label)},
      'Explicit disposable test fixture','PROOF','Novi Sad','Liman','OFFERS',1,'FIXED_WINDOW',
      ${q(start)}::timestamptz,${q(end)}::timestamptz,statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
  return id;
}
const applyCommand=(id,s,e)=>({p_need_id:id,p_need_revision:1,p_worker_profile_id:profile,p_covered_slots:1,
  p_price_rsd:3000,p_proposed_start_at:s,p_proposed_end_at:e,p_scope_note:null,p_client_request_id:'w02-app-'+randomUUID()});
async function apply(id,s=null,e=null){return ok(worker.rpc('rpc_submit_response',applyCommand(id,s,e)));}
const selection=(id,r)=>({p_need_id:id,p_need_revision:r.needRevision,p_response_id:r.responseId,
  p_response_version:r.version,p_content_hash:r.contentHash,p_client_request_id:'w02-selection-'+randomUUID()});
const select=command=>requester.rpc('rpc_select_response',command);
async function proposal(id,version,patch){return uid(await ok(requester.rpc('rpc_propose_agreement_change_v2',{
  p_agreement_id:id,p_expected_version:version,p_patch:patch,p_reason:'Isolated calendar proof',p_client_request_id:'w02-change-'+randomUUID(),
})));}
const respond=(id,accept)=>worker.rpc('rpc_respond_agreement_change',{p_proposal_id:id,p_accept:accept});
const cancel=id=>ok(requester.rpc('rpc_cancel_agreement',{p_agreement_id:id,p_reason:'End isolated calendar scenario'}));
function connectedCalendar(client,userId){
  const state={user:{id:userId},accountRevision:1};
  const allowed={
    './serverReceipt':'src/data/serverReceipt.ts',
    '../lib/calendarTime':'src/lib/calendarTime.ts',
    './workerCalendarClientService':'src/data/workerCalendarClientService.ts',
  };
  const cache=new Map();
  const load=name=>{
    const path=allowed[name];assert.ok(path,'UNEXPECTED_PROOF_MODULE');
    if(cache.has(path))return cache.get(path).exports;
    const source=readFileSync(path,'utf8');report.input_sha256[path]=createHash('sha256').update(source).digest('hex');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const module={exports:{}};cache.set(path,module);
    const require=name=>{
      if(name==='./supabaseClient')return {supabaseKlijent:()=>client};
      if(name==='../store/sesija')return {sesijaSada:()=>state};
      return load(name);
    };
    new Function('require','module','exports',compiled)(require,module,module.exports);
    return module.exports;
  };
  return {service:load('./workerCalendarClientService').workerCalendarClientService,state};
}
try{
  for(const [client,email,id]of[[requester,env.RU5_DEVICE_REQUESTER_EMAIL,requesterId],[worker,env.RU5_DEVICE_WORKER_EMAIL,workerId]]){
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
    assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  profile=uid(sql(`select id from public.app_profiles where account_id=${q(workerId)}::uuid and kind='WORKER'`));
  requesterProfile=uid(sql(`select id from public.app_profiles where account_id=${q(requesterId)}::uuid and kind='REQUESTER'`));
  const linked=connectedCalendar(worker,workerId),other=connectedCalendar(requester,requesterId);
  const calendar=async()=>{const value=await linked.service.readRange(rangeFrom,rangeTo);assert.equal(value.ok,true);return value.podatak;};

  check('FIXED_TASK_DEFAULT_FROZEN_WITHOUT_MUTATING_APPLICATION');
  const start=day(0),end=addHour(start);
  const n=await need(start,end,'fixed-default'),r=await apply(n),command=selection(n,r);
  const before=sql(`select to_jsonb(v)::text from public.marketplace_response_versions v where response_id=${q(uid(r.responseId))}::uuid and version=${r.version}`);
  const a=uid(await ok(select(command)));
  const workspace=await ok(requester.rpc('rpc_get_agreement_workspace',{p_agreement_id:a}));
  assert.equal(Date.parse(workspace.terms.proposed_start_at),Date.parse(start));
  assert.equal(Date.parse(workspace.terms.proposed_end_at),Date.parse(end));
  assert.equal(workspace.terms.schedule_source,'NEED_FIXED_WINDOW');
  assert.equal(row(a).state,'BLOCKING');
  assert.equal(sql(`select to_jsonb(v)::text from public.marketplace_response_versions v where response_id=${q(r.responseId)}::uuid and version=${r.version}`),before);
  assert.equal(await ok(select(command)),a);
  assert.equal((await calendar()).events.filter(e=>e.agreementId===a).length,1);
  report.application_snapshot_unchanged=true;pass();

  check('PROPOSED_INTERVAL_NOT_PARENT_INTERVAL_CONTROLS_BOOKING');
  const alternateStart=day(1),alternateEnd=addHour(alternateStart);
  const n2=await need(start,end,'alternative-time');
  const r2=await apply(n2,alternateStart,alternateEnd);
  const a2=uid(await ok(select(selection(n2,r2))));
  assert.equal(Date.parse(row(a2).starts_at),Date.parse(alternateStart));
  assert.equal((await ok(requester.rpc('rpc_get_agreement_workspace',{p_agreement_id:a2}))).terms.schedule_source,'APPLICATION_PROPOSAL');
  const freeNeed=await need(day(2),addHour(day(2)),'proposal-conflicts');
  const bad=await worker.rpc('rpc_submit_response',applyCommand(freeNeed,start,end));
  assert.equal(bad.error?.message,'WORKER_NOT_ELIGIBLE');
  assert.ok(JSON.parse(bad.error.details).includes('CALENDAR_CONFLICT'));
  assert.equal(sql(`select count(*) from public.marketplace_responses where need_id=${q(freeNeed)}::uuid`),'0');pass();

  check('COMPLETION_RELEASE_AND_REPLAY_NEVER_REBOOK');
  await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:a}));
  assert.equal(row(a).state,'BLOCKING','Worker completion alone is not final completion');
  const completion=await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:a}));
  assert.equal(completion.state,'COMPLETED');assert.equal(row(a).state,'RELEASED');
  assert.ok(!(await calendar()).events.some(e=>e.agreementId===a));
  assert.equal(await ok(select(command)),a);assert.equal(row(a).state,'RELEASED');
  const replacement=await need(start,end,'reuse-completed');
  const a3=uid(await ok(select(selection(replacement,await apply(replacement)))));
  assert.equal(row(a3).state,'BLOCKING');await cancel(a3);pass();

  check('INVALID_ACCEPTED_SCHEDULE_CANNOT_CHANGE_CURRENT_VERSION');
  const original=row(a2);
  for(const patch of [
    {proposed_start_at:'infinity',proposed_end_at:'infinity'},
    {proposed_start_at:'now',proposed_end_at:'tomorrow'},
    {proposed_start_at:'2026-02-30T12:00:00Z',proposed_end_at:'2026-03-03T12:00:00Z'},
    {proposed_start_at:'2026-12-01T12:00:00',proposed_end_at:'2026-12-01T13:00:00'},
    {proposed_start_at:123456,proposed_end_at:123457},
    {proposed_start_at:null},
    {proposed_start_at:'',proposed_end_at:''},
  ]){
    const p=await proposal(a2,1,patch);
    const result=await respond(p,true);
    assert.equal(result.error?.message,'AGREEMENT_CALENDAR_INTERVAL_INVALID');
    assert.equal(row(a2).agreement_version,1);assert.equal(row(a2).starts_at,original.starts_at);
    assert.equal(sql(`select count(*) from public.agreement_versions where agreement_id=${q(a2)}::uuid`),'1');
    await ok(respond(p,false));
  }
  assert.equal((await worker.rpc('rpc_get_worker_calendar',{p_from:'-infinity',p_to:'infinity'})).error?.message,'CALENDAR_RANGE_INVALID');
  await cancel(a2);pass();

  check('OBSERVED_WORKER_FENCE_SERIALIZES_TWO_REAL_SELECTIONS');
  const raceStart=day(3),raceEnd=addHour(raceStart);
  const nA=await need(raceStart,raceEnd,'observed-race-a'),nB=await need(raceStart,raceEnd,'observed-race-b');
  const cA=selection(nA,await apply(nA)),cB=selection(nB,await apply(nB));
  const blocker=session(`begin;set application_name='w02-proof-fence';select worker_profile_id from private.worker_calendar_serialization
    where worker_profile_id=${q(profile)}::uuid for update;select 'W02_FENCE_HELD';`);
  await until(()=>blocker.output().includes('W02_FENCE_HELD'),'FENCE_NOT_HELD');
  const running=Promise.all([select(cA),select(cB)]);
  let waits=0;
  try{
    await until(()=>{waits=Number(sql("select count(*) from pg_stat_activity where wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0 and query like '%rpc_select_response%' and application_name<>'w02-proof-fence'"));return waits>=2;},'TWO_SELECTION_LOCK_WAITS_NOT_OBSERVED');
    report.lock_observations.push({scenario:'TWO_AUTH_RPC_SELECTIONS',blocked_calls:waits});
  }finally{blocker.child.stdin.end('rollback;\n\\q\n');await blocker.done;}
  const race=await running;
  assert.equal(race.filter(x=>!x.error).length,1);assert.equal(race.filter(x=>x.error).length,1);
  const loser=race.find(x=>x.error).error;
  assert.ok(loser.message==='WORKER_CALENDAR_CONFLICT'||loser.message==='WORKER_NO_LONGER_ELIGIBLE');
  const winner=uid(race.find(x=>!x.error).data);assert.equal(row(winner).state,'BLOCKING');
  assert.equal(sql(`select count(*) from public.agreements where need_id in (${q(nA)}::uuid,${q(nB)}::uuid)`),'1');
  await cancel(winner);pass();

  check('STALE_REPEATABLE_READ_CANNOT_BYPASS_CALENDAR_FENCE');
  const sA=day(4),sB=day(5);
  const rrNeed=await need(sA,addHour(sA),'rr-stale'),freshNeed=await need(sB,addHour(sB),'rr-fresh');
  const rrCommand=selection(rrNeed,await apply(rrNeed)),freshCommand=selection(freshNeed,await apply(freshNeed));
  const stale=session(`\\set VERBOSITY verbose
    begin isolation level repeatable read;set local role authenticated;
    select set_config('request.jwt.claim.sub',${q(requesterId)},true);
    select count(*) from public.agreements;select 'W02_SNAPSHOT_READY';`);
  await until(()=>stale.output().includes('W02_SNAPSHOT_READY'),'RR_SNAPSHOT_NOT_READY');
  const fresh=uid(await ok(select(freshCommand)));
  stale.child.stdin.end(`select public.rpc_select_response(${q(rrCommand.p_need_id)}::uuid,1,
    ${q(rrCommand.p_response_id)}::uuid,${rrCommand.p_response_version},${q(rrCommand.p_content_hash)},${q(rrCommand.p_client_request_id)});commit;\n\\q\n`);
  const staleResult=await stale.done;
  assert.notEqual(staleResult.code,0);assert.ok(staleResult.stderr.includes('40001'),'Expected serialization failure, not a stale committed booking');
  assert.equal(sql(`select count(*) from public.agreements where need_id=${q(rrNeed)}::uuid`),'0');
  const retry=uid(await ok(select(rrCommand))); // explicit owner retry on a new snapshot
  assert.equal(row(retry).state,'BLOCKING');
  await cancel(fresh);await cancel(retry);report.repeatable_read_sqlstate='40001';pass();

  check('ACTUAL_TYPESCRIPT_CLIENT_OWNERSHIP_AND_PRIVATE_API_BOUNDARY');
  const own=await calendar();assert.equal(own.authoritative,true);
  const otherRead=await other.service.readRange(rangeFrom,rangeTo);assert.equal(otherRead.ok,true);assert.deepEqual(otherRead.podatak.events,[]);
  linked.state.user=null;linked.state.accountRevision++;
  assert.equal((await linked.service.readRange(rangeFrom,rangeTo)).kod,'AUTH_REQUIRED');
  for(const role of ['anon','authenticated','service_role']){
    for(const permission of ['SELECT','INSERT','UPDATE','DELETE']){
      assert.equal(sql(`select has_table_privilege(${q(role)},'private.worker_calendar_serialization',${q(permission)})`),'f');
    }
    for(const proc of ['private.agreement_calendar_interval(jsonb)','private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz)']){
      assert.equal(sql(`select has_function_privilege(${q(role)},${q(proc)},'EXECUTE')`),'f');
    }
  }
  report.actual_client_verified=true;pass();

  check('FULL_SOURCE_HISTORY_AND_ZERO_PLATFORM_FEE_PRESERVED');
  assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')),plan.source_migration_count);
  assert.equal(sql('select count(*) from private.connection_activations where platform_cost_rsd<>0'),'0');
  assert.equal(sql("select count(*) from private.worker_calendar_events e join public.agreements a on a.id=e.agreement_id where e.state='BLOCKING' and (a.status<>'CONFIRMED' or e.agreement_version<>a.current_version)"),'0');
  report.source_migration_count=plan.source_migration_count;pass();report.result='PASS';
}catch(error){
  report.result='FAIL';report.failed_check=current;
  report.failure_category=error?.code==='ERR_ASSERTION'?'ASSERTION':(error instanceof Error?error.name:'UNKNOWN');
  console.error('FAIL W02_CALENDAR_INTERVAL_INTEGRITY '+current);process.exitCode=1;
}finally{
  for(const child of children){child.stdin.end('rollback;\n\\q\n');child.kill();}
  writeFileSync(`${out}/integrity-proof-report.json`,JSON.stringify(report,null,2)+'\n');
  console.log(report.result+' W02_CALENDAR_INTERVAL_INTEGRITY');
}
