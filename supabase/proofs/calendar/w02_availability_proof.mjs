// Actual typed editor -> SDK/Auth/PostgREST -> existing availability tables.
// Only published Needs and lock-observation setup below use labelled SQL fixtures.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL,out=env.W02_CALENDAR_ARTIFACT_DIR;
assertLocalDeviceProofTargets(url,db);assert.ok(out);
const config={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,config),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,config),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,config);
const report={unit:'W02_AVAILABILITY',source_sha:env.GITHUB_SHA,result:'RUNNING',checks:[],input_sha256:{},
  live_access:false,live_promotion:false,mocked_rpc_responses:false,availability_fixture_sql:false,
  published_need_fixture_sql:true,ui_connected:false,provider_activation:false,calendar_unchanged:false};
const q=x=>`'${String(x).replaceAll("'","''")}'`;
const sql=x=>{try{return execFileSync('psql',[db,'-X','-At','-v','ON_ERROR_STOP=1'],{input:x,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}catch{throw new Error('LOCAL_SQL_FAILED');}};
const ok=async p=>{const r=await p;assert.equal(r.error,null,'AUTH_OR_RPC_REFUSED');return r.data;};
const value=async p=>{const r=await p;assert.equal(r.ok,true,'ACTUAL_CLIENT_REFUSED');return r.podatak;};
const delay=ms=>new Promise(done=>setTimeout(done,ms));
let stage='SETUP',children=[];
const begin=name=>{stage=name;console.log('START '+name);};
const pass=()=>{report.checks.push({name:stage,result:'PASS'});console.log('PASS '+stage);};
function linked(client,userId){
  const state={user:{id:userId},accountRevision:1},cache=new Map();
  const paths={'./workerAvailabilityClientService':'src/data/workerAvailabilityClientService.ts','./serverReceipt':'src/data/serverReceipt.ts',
    '../lib/workerAvailability':'src/lib/workerAvailability.ts','./calendarTime':'src/lib/calendarTime.ts'};
  function load(name){
    const path=paths[name];assert.ok(path,'UNEXPECTED_CLIENT_DEPENDENCY');if(cache.has(path))return cache.get(path).exports;
    const source=readFileSync(path,'utf8');report.input_sha256[path]=createHash('sha256').update(source).digest('hex');
    const module={exports:{}};cache.set(path,module);
    const require=name=>name==='./supabaseClient'?{supabaseKlijent:()=>client}:name==='../store/sesija'?{sesijaSada:()=>state}:load(name);
    const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    new Function('require','module','exports',compiled)(require,module,module.exports);return module.exports;
  }
  return {service:load('./workerAvailabilityClientService').workerAvailabilityClientService,state};
}
let current,profile,requesterProfile;
const fresh=async service=>value(service.read());
const material=doc=>({timezone:doc.timezone,availableNow:doc.availableNow,rules:doc.rules,windows:doc.windows});
async function save(service,input){const old=await fresh(service);return (await value(service.save({expectedRevision:old.revision,value:input}))).availability;}
const newRule=(day=1,start='08:00:00',end='18:00:00')=>({id:randomUUID(),weekdays:[day],startTime:start,endTime:end,startsOn:'2026-01-01',endsOn:null,label:'Isolated recurring',active:true});
const newWindow=(s,e,state='AVAILABLE')=>({id:randomUUID(),startsAt:s,endsAt:e,state,label:'Isolated exception'});
function need(start,end,kind='FIXED_WINDOW'){
  const id=randomUUID(),time=x=>x===null?'null':q(x)+'::timestamptz';
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,
      mode,required_slots,schedule_kind,starts_at,ends_at,response_deadline,published_at,execution_location_mode)
    values(${q(id)}::uuid,${q(env.RU5_DEVICE_REQUESTER_USER_ID)}::uuid,${q(requesterProfile)}::uuid,'PUBLISHED','W02 AVAILABILITY TEST',
      'Explicit isolated SQL fixture, not publication proof','PROOF','Novi Sad','Liman','OFFERS',1,${q(kind)},${time(start)},${time(end)},
      statement_timestamp()+interval '2 days',statement_timestamp(),'REMOTE');commit;`);return id;
}
const fit=(s,e)=>sql(`select private.schedule_fit(${q(profile)}::uuid,${q(s)}::timestamptz,${q(e)}::timestamptz,
  (select timezone from public.worker_match_preferences where worker_profile_id=${q(profile)}::uuid))`)==='t';
const match=id=>JSON.parse(sql(`select private.match_detail(${q(id)}::uuid,${q(profile)}::uuid)`));
const dispatch=id=>sql(`select private.dispatch_cheap_candidate_admitted(${q(id)}::uuid,${q(profile)}::uuid)`)==='t';
try{
  for(const [client,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,env.RU5_DEVICE_WORKER_USER_ID],
    [requester,env.RU5_DEVICE_REQUESTER_EMAIL,env.RU5_DEVICE_REQUESTER_USER_ID]]){
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  const editor=linked(worker,env.RU5_DEVICE_WORKER_USER_ID),other=linked(requester,env.RU5_DEVICE_REQUESTER_USER_ID);
  current=await fresh(editor.service);profile=current.profileId;
  requesterProfile=sql(`select id from public.app_profiles where account_id=${q(env.RU5_DEVICE_REQUESTER_USER_ID)}::uuid and kind='REQUESTER'`);
  const calendarBefore=sql(`select coalesce(jsonb_agg(to_jsonb(c) order by agreement_id),'[]') from private.worker_calendar_events c`);
  const monday=new Date();monday.setUTCDate(monday.getUTCDate()+60);monday.setUTCHours(0,0,0,0);
  monday.setUTCDate(monday.getUTCDate()+(8-monday.getUTCDay())%7);
  const at=hours=>new Date(monday.getTime()+hours*3600000).toISOString();
  const base={timezone:'UTC',availableNow:false,rules:[newRule()],windows:[]};

  begin('ACTUAL_EDITOR_SAVE_READ_AND_IDENTICAL_RETRY');
  const original=current;
  current=await save(editor.service,base);assert.equal(current.availableNow,false);assert.equal(current.rules.length,1);
  const replay=await value(editor.service.save({expectedRevision:original.revision,value:base}));
  assert.equal(replay.idempotentReplay,true);assert.equal(replay.availability.revision,current.revision);
  assert.deepEqual(await fresh(editor.service),current);pass();

  begin('STALE_AND_INVALID_WRITES_PRESERVE_CURRENT_STATE');
  const stale=await editor.service.save({expectedRevision:'0'.repeat(64),value:{...base,availableNow:true}});
  assert.equal(stale.ok,false);assert.equal(stale.kod,'AVAILABILITY_VERSION_CONFLICT');
  for(const patch of [{timezone:'Invalid/Timezone'},{rules:[{...base.rules[0],startsOn:'2026-02-30'}]},
    {rules:[{...base.rules[0],weekdays:[1,1]}]},{profileId:other.state.user.id}]){
    const r=await worker.rpc('rpc_save_worker_availability',{p_expected_revision:current.revision,p_value:{...base,...patch}});
    assert.ok(r.error,'MALFORMED_WRITE_ACCEPTED');assert.deepEqual(await fresh(editor.service),current);
  }pass();

  begin('OWNER_RLS_ANON_AND_FOREIGN_ITEM_NEGATIVES');
  assert.ok((await anon.rpc('rpc_get_worker_availability')).error);
  assert.deepEqual(await ok(requester.from('profile_availability_rules').select('id').eq('profile_id',profile)),[]);
  const raw=await worker.from('profile_availability_rules').insert({id:randomUUID(),profile_id:profile,weekdays:[1],start_time:'08:00',end_time:'09:00',starts_on:'2026-01-01'});
  assert.ok(raw.error,'RAW_WRITE_BYPASS');
  const otherDoc=await fresh(other.service);
  const foreign=await other.service.save({expectedRevision:otherDoc.revision,value:base});
  assert.equal(foreign.ok,false);assert.equal(foreign.kod,'AVAILABILITY_ITEM_INVALID');
  assert.deepEqual(await fresh(editor.service),current);
  const outsider=createClient(url,env.RU5_DEVICE_ANON_KEY,config);
  await ok(outsider.auth.signUp({email:'w02-availability-third-'+randomUUID()+'@example.test',password:randomUUID()+'Aa!9'}));
  assert.deepEqual(await ok(outsider.from('profile_availability_windows').select('id').eq('profile_id',profile)),[]);
  assert.deepEqual(await ok(outsider.from('profile_availability_rules').select('id').eq('profile_id',profile)),[]);
  await outsider.auth.stopAutoRefresh();pass();

  begin('FUTURE_OFF_MATCHES_REAL_WEEKLY_SCHEDULE');
  const scheduled=need(at(9),at(10));
  assert.equal(fit(at(9),at(10)),true);assert.equal(dispatch(scheduled),true);
  assert.equal(match(scheduled).dispatchEligible,true);
  assert.ok(!match(scheduled).dispatchBlockers.includes('CURRENT_AVAILABILITY_PAUSED'));
  const outside=need(at(19),at(20));assert.equal(dispatch(outside),false);assert.equal(match(outside).responseAllowed,true);pass();

  begin('PERSONAL_EXCEPTION_OVERRIDES_WEEKLY_AND_LIVE_INTENT');
  current=await save(editor.service,{...base,availableNow:true,windows:[newWindow(at(9.5),at(10.5),'UNAVAILABLE')]});
  assert.equal(fit(at(9),at(10)),false);assert.equal(dispatch(scheduled),false);
  assert.equal(match(scheduled).responseAllowed,true,'Availability must not hide manual browsing');
  assert.equal(fit(at(8),at(9.5)),true,'Half-open boundary must not overlap');pass();

  begin('FLEXIBLE_FUTURE_WINDOW_NEEDS_SOME_AVAILABILITY_NOT_ALL_DAY');
  const flexible=need(at(0),at(24),'FLEXIBLE');
  assert.equal(dispatch(flexible),true);assert.equal(match(flexible).dispatchEligible,true);
  current=await save(editor.service,{...base,rules:[],windows:[]});
  assert.equal(dispatch(flexible),false);assert.equal(match(flexible).responseAllowed,true);pass();

  begin('ADJACENT_RULES_COMBINE_GAPS_DO_NOT_AND_WINDOWS_CROSS_MIDNIGHT');
  current=await save(editor.service,{...base,rules:[newRule(1,'08:00','10:00'),newRule(1,'10:00','12:00')]});
  assert.equal(fit(at(8),at(12)),true);
  current=await save(editor.service,{...base,rules:[newRule(1,'08:00','10:00'),newRule(1,'10:01','12:00')]});
  assert.equal(fit(at(8),at(12)),false);
  current=await save(editor.service,{...base,rules:[],windows:[newWindow(at(23),at(26))]});
  assert.equal(fit(at(23.5),at(25.5)),true);pass();

  begin('RECURRING_TIMEZONE_FOLLOWS_BOTH_DST_TRANSITIONS');
  current=await save(editor.service,{...base,timezone:'Europe/Belgrade',rules:[{...newRule(0,'01:00','04:00'),startsOn:'2026-01-01'}]});
  assert.equal(fit('2027-03-28T00:00:00Z','2027-03-28T02:00:00Z'),true);
  assert.equal(fit('2027-03-28T00:00:00Z','2027-03-28T02:01:00Z'),false);
  assert.equal(fit('2026-10-24T23:00:00Z','2026-10-25T03:00:00Z'),true);pass();

  begin('AVAILABLE_NOW_PERSISTS_BUT_IS_NOT_FUTURE_SCHEDULE_OR_BOOKING');
  current=await save(editor.service,{...base,availableNow:true,rules:[],windows:[]});
  const immediate=need(null,null,'TODAY_FLEXIBLE');assert.equal(dispatch(immediate),true);
  await ok(worker.from('app_profiles').update({available_now:true,available_now_expires_at:'2000-01-01T00:00:00Z'}).eq('id',profile));
  assert.equal(sql(`select available_now_expires_at is null from public.app_profiles where id=${q(profile)}::uuid`),'t');
  const expired=JSON.parse(sql('select private.expire_lifecycle(statement_timestamp())'));
  assert.equal(expired.availabilityExpired,0);assert.equal((await fresh(editor.service)).availableNow,true);
  assert.equal(dispatch(scheduled),false,'ON must not invent future availability');
  const now=new Date(),later=new Date(now.getTime()+3600000),earlier=new Date(now.getTime()-3600000);
  current=await save(editor.service,{...base,availableNow:true,rules:[],windows:[newWindow(earlier.toISOString(),later.toISOString(),'UNAVAILABLE')]});
  assert.equal(dispatch(immediate),false);
  current=await save(editor.service,{...base,availableNow:false,rules:[],windows:[]});
  assert.equal(dispatch(immediate),false);assert.equal(match(immediate).responseAllowed,true);pass();

  begin('TWO_OBSERVED_CONCURRENT_EDITS_CANNOT_LOSE_UPDATE');
  current=await save(editor.service,base);
  const child=spawn('psql',[db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});children.push(child);
  let lockOut='';child.stdout.on('data',x=>{lockOut+=x;});child.stderr.resume();
  const finished=new Promise(resolve=>child.on('close',resolve));
  child.stdin.write(`begin;select id from public.app_profiles where id=${q(profile)}::uuid for update;select 'HOLD_READY';\n`);
  for(let i=0;!lockOut.includes('HOLD_READY')&&i<100;i++)await delay(40);
  assert.ok(lockOut.includes('HOLD_READY'));
  const commands=[{...base,availableNow:true},{...base,rules:[{...base.rules[0],label:'Second editor'}]}];
  const pending=commands.map(p_value=>worker.rpc('rpc_save_worker_availability',{p_expected_revision:current.revision,p_value}).then(x=>x));
  let waiters=0;
  for(let i=0;i<150;i++){
    waiters=Number(sql("select count(*) from pg_stat_activity where wait_event_type='Lock' and query ilike '%rpc_save_worker_availability%' and pid<>pg_backend_pid()"));
    if(waiters>=2)break;await delay(40);
  }
  assert.ok(waiters>=2,'TWO_WAITERS_NOT_OBSERVED');report.observed_waiters=waiters;
  child.stdin.end('commit;\n\\q\n');await finished;
  const results=await Promise.all(pending);assert.equal(results.filter(x=>!x.error).length,1);
  assert.equal(results.find(x=>x.error).error.message,'AVAILABILITY_VERSION_CONFLICT');
  current=await fresh(editor.service);pass();

  begin('AVAILABILITY_EDITS_NEVER_MUTATE_AGREEMENT_CALENDAR');
  assert.equal(sql(`select coalesce(jsonb_agg(to_jsonb(c) order by agreement_id),'[]') from private.worker_calendar_events c`),calendarBefore);
  report.calendar_unchanged=true;
  for(const signature of ['private.worker_available_periods(uuid,timestamptz,timestamptz,text)',
    'private.worker_dispatch_time_admitted(uuid,uuid)','private.worker_availability_document(uuid)']){
    assert.equal(sql(`select has_function_privilege('authenticated',${q(signature)},'EXECUTE')`),'f');
    assert.equal(sql(`select has_function_privilege('anon',${q(signature)},'EXECUTE')`),'f');
  }
  await save(editor.service,material(original));pass();
  report.result='PASS';
}catch(error){report.result='FAIL';report.failed_stage=stage;report.error_type=error?.code==='ERR_ASSERTION'?'ASSERTION':error?.message==='LOCAL_SQL_FAILED'?'LOCAL_SQL':'CLIENT_OR_RPC';}
finally{
  for(const child of children)if(child.exitCode===null)child.kill();
  for(const client of [worker,requester,anon])await client.auth.stopAutoRefresh();
  writeFileSync(out+'/availability-proof-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(report.result+' W02_AVAILABILITY '+(report.failed_stage??''));
  if(report.result!=='PASS')process.exitCode=1;
}
