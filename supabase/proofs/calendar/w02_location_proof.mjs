// Actual location clients -> local SDK/Auth/PostgREST -> existing V2 facts and
// canonical reviewed draft. No OS GPS or geocoder. The non-location AI proposal
// and published status fixtures below are explicitly synthetic, NOT W03/UI proof.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';
import { proveResolvedLocation } from './w02_resolved_location_proof.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL,out=env.W02_CALENDAR_ARTIFACT_DIR;
assertLocalDeviceProofTargets(url,db);assert.ok(out);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const owner=createClient(url,env.RU5_DEVICE_ANON_KEY,options),worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options),fixtureService=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const third=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const report={unit:'W02_LOCATION',source_sha:env.GITHUB_SHA,result:'RUNNING',checks:[],input_sha256:{},live_access:false,live_promotion:false,
  mocked_rpc_responses:false,location_fixture_sql:false,synthetic_nonlocation_ai_facts:true,published_status_fixture_sql:true,
  gps_permission_requested:false,geocoder_called:false,provider_activated:false,ui_journey:false};
const q=x=>`'${String(x).replaceAll("'","''")}'`;
function sql(x){try{return execFileSync('psql',[db,'-X','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],{input:x,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
catch(error){report.sql_failure={code:String(error.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNKNOWN',query_sha256:createHash('sha256').update(x).digest('hex')};throw new Error('LOCAL_SQL_FAILED');}}
const rows=x=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${x}) r`));
const ok=async promise=>{const r=await promise;if(r.error){report.rpc_failure={code:r.error.code,known_message:['LOCATION_INPUT_INVALID','LOCATION_VERSION_CONFLICT','LOCATION_REVIEW_NOT_EDITABLE'].includes(r.error.message)?r.error.message:'REDACTED'};throw new Error('RPC_FAILED');}return r.data;};
const value=async promise=>{const r=await promise;if(!r.ok){report.client_failure={code:r.kod};throw new Error('CLIENT_FAILED');}return r.podatak;};
let stage='SETUP';const children=[];
const begin=name=>{stage=name;console.log('START '+name);};
const pass=()=>{report.checks.push({name:stage,result:'PASS'});console.log('PASS '+stage);};
const hash=table=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x`);
function linked(client,id){
  const state={user:{id},accountRevision:1},cache=new Map();
  const paths={'./locationClientService':'src/data/locationClientService.ts','../lib/location':'src/lib/location.ts',
    '../lib/market':'src/lib/market.ts','./market':'src/lib/market.ts','./marketClientService':'src/data/marketClientService.ts',
    './serverReceipt':'src/data/serverReceipt.ts','./locationResolver':'src/data/locationResolver.ts'};
  function load(name){
    const path=paths[name];assert.ok(path,'UNEXPECTED_DEPENDENCY');if(cache.has(path))return cache.get(path).exports;
    const source=readFileSync(path,'utf8');report.input_sha256[path]=createHash('sha256').update(source).digest('hex');
    const module={exports:{}};cache.set(path,module);
    const binding=name=>name==='./supabaseClient'?{supabaseKlijent:()=>client}:name==='../store/sesija'?{sesijaSada:()=>state}:load(name);
    const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    new Function('require','module','exports',code)(binding,module,module.exports);return module.exports;
  }
  return {...load('./marketClientService'),...load('./locationClientService'),...load('./locationResolver'),state};
}
const remote={taskCountryCode:'RS',geography:{mode:'REMOTE'},exactAddress:null,accessNotes:null,resolvedLocation:null};
const manual={taskCountryCode:'RS',geography:{mode:'STATIONARY',start:{city:'Novi Sad',area:'Liman'}},exactAddress:'ISOLATED PRIVATE ADDRESS 12',accessNotes:'ISOLATED PRIVATE ACCESS\nSecond line',resolvedLocation:null};
const review=(client,id)=>value(client.needLocationClientService.read(id));
async function save(client,id,input,revision){const previous=await review(client,id);return value(client.needLocationClientService.save({conversationId:id,
  expectedRevision:revision??previous.revision,value:input,confirmed:true}));}
const open=()=>ok(owner.rpc('rpc_ai_open_need_conversation_v2'));
let ownerProfile;
async function completeDraft(conversation){
  // Existing service writer supplies only SIX unrelated synthetic facts. The
  // location fact comes exclusively from the actual human-confirmation client.
  const sample=[['need.title','W02 Manual location proof'],['need.description','Explicit isolated draft from normal reviewed save'],
    ['need.category','PROOF'],['need.price_mode','OFFERS'],['need.schedule_kind','FLEXIBLE'],['need.people_needed',1]];
  await ok(fixtureService.rpc('rpc_ai_apply_interview_turn_v2_service',{p_account_id:env.RU5_DEVICE_REQUESTER_USER_ID,
    p_conversation_id:conversation,p_user_message:'W02_SYNTHETIC_NONLOCATION_INPUT',p_assistant_message:'W02_SYNTHETIC_NONLOCATION_FIXTURE',p_safety:'REVIEW',
    p_proposals:sample.map(([key,v])=>({key,value:v,displayValue:String(v),evidence:'Explicit synthetic nonlocation fixture',confidence:1}))}));
  const doc=await ok(owner.rpc('rpc_ai_need_review_v2',{p_conversation_id:conversation}));
  for(const fact of doc.facts)if(fact.status!=='CONFIRMED')await ok(owner.rpc('rpc_ai_confirm_fact',{p_fact_id:fact.id}));
  const r=await ok(owner.rpc('rpc_save_need_draft_from_review',{p_conversation_id:conversation,p_requester_profile_id:ownerProfile,p_client_request_id:'w02-location-'+randomUUID()}));
  assert.equal(r.status,'DRAFT');assert.equal(r.authoritative,true);return r.needId;
}
function publishFixture(id){
  // Public projection requires a public parent. This labelled SQL status change
  // is NOT an approved publication evaluator and never writes location fields.
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    update public.needs set status='PUBLISHED',published_at=statement_timestamp(),response_deadline=statement_timestamp()+interval '2 days' where id=${q(id)}::uuid;commit;`);
}
try{
  for(const [client,email,id] of [[owner,env.RU5_DEVICE_REQUESTER_EMAIL,env.RU5_DEVICE_REQUESTER_USER_ID],
    [worker,env.RU5_DEVICE_WORKER_EMAIL,env.RU5_DEVICE_WORKER_USER_ID]]){
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  await ok(third.auth.signUp({email:'w02-location-third-'+randomUUID()+'@example.test',password:randomUUID()+'Aa9!'}));
  const a=linked(owner,env.RU5_DEVICE_REQUESTER_USER_ID),b=linked(worker,env.RU5_DEVICE_WORKER_USER_ID);
  ownerProfile=(await ok(owner.from('app_profiles').select('id').eq('account_id',env.RU5_DEVICE_REQUESTER_USER_ID).eq('kind','REQUESTER').single())).id;
  const preserved=Object.fromEntries(['private.worker_calendar_events','private.response_application_snapshots',
    'public.profile_availability_rules','public.profile_availability_windows'].map(t=>[t,hash(t)]));

  begin('COUNTRY_METADATA_IS_AUTHENTICATED_BUILDING_ONLY_AND_LEGACY_WORKER_STAYS_UNKNOWN');
  const marketRows=await value(a.marketClientService.list());
  assert.deepEqual(marketRows,[{countryCode:'RS',productStatus:'BUILDING',defaultCurrencyCode:'RSD',defaultLanguageTag:'sr-Latn-RS',defaultTimezone:'Europe/Belgrade'}]);
  assert.ok((await anon.rpc('rpc_list_location_markets')).error);
  const oldWorker=await value(b.workerLocationClientService.read());
  assert.equal(oldWorker.operatingCountryCode,null);
  const countryConfigHash=hash('private.location_market_configs');
  const profileWithoutCountry=JSON.parse(sql(`select to_jsonb(p)-'updated_at' from public.app_profiles p where id=${q(oldWorker.profileId)}::uuid`));
  const rawProfileCountry=await worker.from('app_profiles').update({operating_country_code:'RS'}).eq('id',oldWorker.profileId);
  assert.ok(rawProfileCountry.error);
  assert.deepEqual(JSON.parse(sql(`select to_jsonb(p)-'updated_at' from public.app_profiles p where id=${q(oldWorker.profileId)}::uuid`)),profileWithoutCountry);
  pass();

  begin('MANUAL_LOCATION_STARTS_EMPTY_AND_SAVES_CONFIRMED_V2_FACTS');
  const conversation=await open(),empty=await review(a,conversation);
  assert.deepEqual(empty.value,{taskCountryCode:null,geography:null,exactAddress:null,accessNotes:null,resolvedLocation:null});assert.equal(empty.confirmed,false);
  const first=await save(a,conversation,manual);assert.deepEqual(first.review.value,manual);assert.equal(first.review.confirmed,true);
  const facts=await ok(owner.from('ai_structured_facts').select('fact_key,scope,source,status,confirmed_by_user_id').eq('conversation_id',conversation).is('superseded_at',null));
  assert.equal(facts.length,4);for(const f of facts){assert.equal(f.source,'EXPLICIT_USER_ANSWER');assert.equal(f.scope,'NEED_DRAFT');assert.equal(f.status,'CONFIRMED');assert.equal(f.confirmed_by_user_id,env.RU5_DEVICE_REQUESTER_USER_ID);}
  pass();

  begin('EXPLICIT_COUNTRY_CANNOT_BE_GUESSED_ERASED_OR_SET_TO_AN_UNAVAILABLE_MARKET');
  for(const country of [undefined,null,'SRB','ZZ','BA']){
    const invalidCountry={...manual,taskCountryCode:country};
    if(country===undefined)delete invalidCountry.taskCountryCode;
    assert.ok((await owner.rpc('rpc_save_need_location_review',{p_conversation_id:conversation,p_expected_revision:first.review.revision,p_confirmed:true,p_value:invalidCountry})).error);
  }
  assert.deepEqual(await review(a,conversation),first.review);
  pass();

  begin('REPEATED_SAVE_IS_NOOP_AND_CORRECTION_PRESERVES_HISTORY');
  const replay=await save(a,conversation,manual,empty.revision);assert.equal(replay.idempotentReplay,true);assert.equal(replay.review.revision,first.review.revision);
  const old=await ok(owner.from('ai_structured_facts').select('id,fact_value,source').eq('conversation_id',conversation).eq('fact_key','need.exact_address').is('superseded_at',null).single());
  const changed={...manual,exactAddress:'ISOLATED PRIVATE NEW ADDRESS'};
  const second=await save(a,conversation,changed);
  const history=await ok(owner.from('ai_structured_facts').select('id,fact_value,source,superseded_at,superseded_by').eq('id',old.id).single());
  assert.deepEqual(history.fact_value,old.fact_value);assert.equal(history.source,old.source);assert.ok(history.superseded_at);assert.ok(history.superseded_by);
  const stale=await a.needLocationClientService.save({conversationId:conversation,expectedRevision:first.review.revision,confirmed:true,value:manual});
  assert.equal(stale.ok,false);assert.equal(stale.kod,'LOCATION_VERSION_CONFLICT');assert.deepEqual(await review(a,conversation),second.review);pass();

  begin('WRONG_ACCOUNT_AND_MALFORMED_DIRECT_RPC_CANNOT_MUTATE_OR_READ');
  assert.ok((await third.rpc('rpc_get_need_location_review',{p_conversation_id:conversation})).error);
  assert.ok((await anon.rpc('rpc_get_need_location_review',{p_conversation_id:conversation})).error);
  assert.deepEqual(await ok(third.from('ai_structured_facts').select('id,fact_value').eq('conversation_id',conversation)),[]);
  const invalid=[{...manual,accountId:env.RU5_DEVICE_WORKER_USER_ID},
    {...manual,geography:{mode:null}},{...manual,geography:{mode:'STATIONARY',start:{city:42}}},
    {...manual,geography:{mode:'STATIONARY',start:{city:'Novi Sad',exactAddress:'PUBLIC LEAK'}}},
    {...manual,geography:{mode:'STATIONARY',start:{city:'Novi Sad'},coordinates:[45.123456,19.123456]}},
    {...remote,exactAddress:'REMOTE PRIVATE ADDRESS'}];
  for(const p_value of invalid){assert.ok((await owner.rpc('rpc_save_need_location_review',{p_conversation_id:conversation,p_expected_revision:second.review.revision,p_confirmed:true,p_value})).error);}
  assert.ok((await owner.rpc('rpc_save_need_location_review',{p_conversation_id:conversation,p_expected_revision:second.review.revision,p_confirmed:false,p_value:manual})).error);
  assert.deepEqual(await review(a,conversation),second.review);pass();

  begin('TWO_OBSERVED_LOCATION_EDITS_SERIALIZE_WITHOUT_LOST_UPDATES');
  const child=spawn('psql',[db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});children.push(child);
  let stdout='';child.stdout.on('data',x=>{stdout+=x;});child.stderr.resume();
  const finished=new Promise(resolve=>child.on('close',resolve));
  child.stdin.write(`begin;select id from public.ai_conversations where id=${q(conversation)}::uuid for update;select 'HOLD_READY';\n`);
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<100&&!stdout.includes('HOLD_READY');i++)await delay(40);assert.ok(stdout.includes('HOLD_READY'));
  const pending=['A','B'].map(suffix=>owner.rpc('rpc_save_need_location_review',{p_conversation_id:conversation,p_expected_revision:second.review.revision,
    p_confirmed:true,p_value:{...manual,exactAddress:'ISOLATED EDIT '+suffix}}).then(x=>x));
  let waiters=0;
  for(let i=0;i<100;i++){waiters=Number(sql("select count(*) from pg_stat_activity where wait_event_type='Lock' and query ilike '%rpc_save_need_location_review%' and pid<>pg_backend_pid()"));if(waiters>=2)break;await delay(40);}
  assert.ok(waiters>=2);report.observed_waiters=waiters;child.stdin.end('commit;\n\\q\n');await finished;
  const results=await Promise.all(pending);assert.equal(results.filter(x=>!x.error).length,1);assert.equal(results.find(x=>x.error).error.message,'LOCATION_VERSION_CONFLICT');pass();

  begin('MANUAL_REVIEW_MATERIALIZES_THROUGH_EXISTING_DRAFT_AUTHORITY');
  await save(a,conversation,manual);
  const draft=await completeDraft(conversation);
  const stored=await ok(owner.from('needs').select('id,status,task_country_code,task_timezone,approximate_city,approximate_lat,approximate_lng,execution_location_mode').eq('id',draft).single());
  assert.equal(stored.status,'DRAFT');assert.equal(stored.approximate_city,'Novi Sad');assert.equal(stored.approximate_lat,null);assert.equal(stored.approximate_lng,null);
  assert.equal(stored.execution_location_mode,'STATIONARY');assert.equal(stored.task_country_code,'RS');assert.equal(stored.task_timezone,'Europe/Belgrade');
  assert.deepEqual((await ok(owner.from('need_geography').select('public_topology').eq('need_id',draft).single())).public_topology,manual.geography);
  assert.equal((await ok(owner.from('need_sensitive').select('exact_address').eq('need_id',draft).single())).exact_address,manual.exactAddress);
  const locked=await review(a,conversation);assert.equal(locked.editable,false);
  assert.equal((await a.needLocationClientService.save({conversationId:conversation,expectedRevision:locked.revision,confirmed:true,value:manual})).kod,'LOCATION_REVIEW_NOT_EDITABLE');pass();

  begin('PUBLIC_PROJECTION_NEVER_EXPOSES_PRIVATE_ADDRESS_OR_ACCESS_NOTES');
  publishFixture(draft);
  const publicNeed=await ok(third.from('needs').select('*').eq('id',draft).single());
  const publicGeo=await ok(third.from('need_geography').select('public_topology').eq('need_id',draft).single());
  assert.deepEqual(publicGeo.public_topology,manual.geography);
  for(const privateText of [manual.exactAddress,manual.accessNotes])assert.ok(!JSON.stringify([publicNeed,publicGeo]).includes(privateText));
  assert.deepEqual(await ok(third.from('need_sensitive').select('*').eq('need_id',draft)),[]);
  assert.deepEqual(await ok(worker.from('need_sensitive').select('*').eq('need_id',draft)),[]);pass();

  begin('COUNTRY_PERSISTS_IN_OWNED_EDIT_REVIEW_AND_CANNOT_BE_DIRECTLY_ERASED');
  const edit=await ok(owner.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:draft}));
  const editReview=await review(a,edit.conversationId);
  assert.equal(editReview.value.taskCountryCode,'RS');assert.equal(editReview.confirmed,true);
  const material=JSON.parse(sql(`select private.need_full_edit_snapshot(${q(draft)}::uuid)`));
  assert.equal(material.taskCountryCode,'RS');assert.equal(material.taskTimezone,'Europe/Belgrade');
  const clearCountry=await owner.from('needs').update({task_country_code:null,task_timezone:null}).eq('id',draft).select('id');
  // Published rows are hidden by the existing DRAFT-only UPDATE policy. RLS
  // may deny with zero affected rows rather than reaching the write trigger.
  assert.ok(clearCountry.error || (Array.isArray(clearCountry.data) && clearCountry.data.length===0));
  assert.deepEqual(JSON.parse(sql(`select private.need_full_edit_snapshot(${q(draft)}::uuid)`)),material);
  const changedLocation={...manual,geography:{mode:'STATIONARY',start:{city:'Novi Sad',area:'Centar'}}};
  await save(a,edit.conversationId,changedLocation);
  const updated=await ok(owner.rpc('rpc_confirm_need_edit_from_review_v2',{p_need_id:draft,p_expected_revision:edit.revision,
    p_conversation_id:edit.conversationId,p_client_request_id:'w02-country-edit-'+randomUUID()}));
  assert.equal(updated.status,'DRAFT');
  const changedNeed=await ok(owner.from('needs').select('task_country_code,task_timezone,approximate_area').eq('id',draft).single());
  assert.deepEqual(changedNeed,{task_country_code:'RS',task_timezone:'Europe/Belgrade',approximate_area:'Centar'});
  // DRAFT is visible to the UPDATE policy, so the canonical write guard itself
  // must refuse clearing country outside the reviewed command authority.
  const draftSnapshot=JSON.parse(sql(`select private.need_full_edit_snapshot(${q(draft)}::uuid)`));
  const clearDraftCountry=await owner.from('needs').update({task_country_code:null,task_timezone:null}).eq('id',draft).select('id');
  assert.ok(clearDraftCountry.error);
  assert.deepEqual(JSON.parse(sql(`select private.need_full_edit_snapshot(${q(draft)}::uuid)`)),draftSnapshot);
  publishFixture(draft);
  pass();

  begin('WORKER_MANUAL_CITY_AND_RADIUS_USE_EXISTING_PRIVATE_GEO_PREFERENCES');
  const initial=await value(b.workerLocationClientService.read());
  let w=await value(b.workerLocationClientService.save({expectedRevision:initial.revision,confirmed:true,
    value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:25,approximatePosition:{latitude:45.25,longitude:19.83}}}));
  const manualWorker={operatingCountryCode:'RS',city:'Novi Sad',radiusKm:25,approximatePosition:null};
  w=await value(b.workerLocationClientService.save({expectedRevision:w.location.revision,confirmed:true,value:manualWorker}));
  assert.deepEqual(w.location.approximatePosition,null);assert.equal(w.location.operatingCountryCode,'RS');
  const coords=await ok(worker.from('worker_match_preferences').select('approximate_lat,approximate_lng').eq('worker_profile_id',w.location.profileId).single());
  assert.deepEqual(coords,{approximate_lat:null,approximate_lng:null});
  assert.deepEqual(await ok(third.from('worker_match_preferences').select('*').eq('worker_profile_id',w.location.profileId)),[]);
  assert.equal((await value(b.workerLocationClientService.save({expectedRevision:initial.revision,confirmed:true,value:manualWorker}))).idempotentReplay,true);
  assert.equal((await b.workerLocationClientService.save({expectedRevision:initial.revision,confirmed:true,value:{...manualWorker,city:'Other city'}})).kod,'LOCATION_VERSION_CONFLICT');
  const invalidPosition=await worker.rpc('rpc_save_worker_location',{p_expected_revision:w.location.revision,p_confirmed:true,
    p_value:{...manualWorker,approximatePosition:{latitude:45.251234,longitude:19.831234}}});assert.ok(invalidPosition.error);
  report.worker_profile_id=w.location.profileId;pass();

  begin('WORKER_COUNTRY_WRITE_REJECTS_OLD_CLIENT_ERASURE_AND_UNKNOWN_MARKET');
  const stableWorker=await value(b.workerLocationClientService.read());
  const {operatingCountryCode:omittedCountry,...legacyWorkerValue}=manualWorker;
  for(const p_value of [legacyWorkerValue,{...manualWorker,operatingCountryCode:null},{...manualWorker,operatingCountryCode:'ZZ'}]){
    assert.ok((await worker.rpc('rpc_save_worker_location',{p_expected_revision:stableWorker.revision,p_confirmed:true,p_value})).error);
  }
  assert.deepEqual(await value(b.workerLocationClientService.read()),stableWorker);
  assert.equal(hash('private.location_market_configs'),countryConfigHash);
  pass();

  begin('MATCHING_CONSUMES_MANUAL_CITY_AND_REMOTE_NEEDS_WITHOUT_GPS');
  const match=JSON.parse(sql(`select private.match_detail(${q(draft)}::uuid,${q(report.worker_profile_id)}::uuid)`));
  assert.ok(!match.dispatchBlockers.includes('OUTSIDE_PREFERRED_RADIUS'));assert.ok(match.reasonCodes.includes('START_PROXIMITY_MATCH'));
  const remoteConversation=await open();await save(a,remoteConversation,remote);
  const remoteDraft=await completeDraft(remoteConversation);publishFixture(remoteDraft);
  const remoteNeed=await ok(third.from('needs').select('approximate_city,approximate_lat,approximate_lng,execution_location_mode').eq('id',remoteDraft).single());
  assert.deepEqual(remoteNeed,{approximate_city:'',approximate_lat:null,approximate_lng:null,execution_location_mode:'REMOTE'});
  assert.deepEqual(await ok(owner.from('need_sensitive').select('*').eq('need_id',remoteDraft)),[]);
  const remoteMatch=JSON.parse(sql(`select private.match_detail(${q(remoteDraft)}::uuid,${q(report.worker_profile_id)}::uuid)`));
  assert.ok(remoteMatch.reasonCodes.includes('REMOTE_LOCATION_NOT_REQUIRED'));assert.ok(!remoteMatch.dispatchBlockers.includes('OUTSIDE_PREFERRED_RADIUS'));pass();

  begin('REMOTE_CONVERSION_SUPERSEDES_PRIVATE_FACTS_WITHOUT_DELETING_HISTORY');
  const c=await open();await save(a,c,manual);await save(a,c,remote);
  const currentFacts=await ok(owner.from('ai_structured_facts').select('fact_key').eq('conversation_id',c).is('superseded_at',null));
  assert.deepEqual(currentFacts.map(x=>x.fact_key).sort(),['need.task_country_code','need.task_geography']);
  const oldPrivate=await ok(owner.from('ai_structured_facts').select('id,superseded_at').eq('conversation_id',c).eq('fact_key','need.exact_address'));
  assert.equal(oldPrivate.length,1);assert.ok(oldPrivate[0].superseded_at);pass();

  begin('MANUAL_PATH_DOES_NOT_SELECT_PROVIDER_OR_CHANGE_CALENDAR_SNAPSHOTS');
  assert.deepEqual(await a.createLocationResolver().search({city:'Novi Sad'}),{status:'PROVIDER_ACTIVATION_BLOCKED'});
  for(const [table,before] of Object.entries(preserved))assert.equal(hash(table),before);
  report.calendar_and_application_snapshots_unchanged=true;
  for(const signature of ['private.need_location_review_document(uuid)','private.worker_location_document(uuid)',
    'private.normalize_task_geography(jsonb)','private.normalize_need_location(jsonb)']){
    for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE')`),'f');
  }
  pass();
  // Original 14 checks above retain their own mutation boundary. The separate
  // resolved-location report includes a real Response/Selection/Agreement.
  await proveResolvedLocation({owner,worker,third,anon,fixtureService,a,open,save,review,completeDraft,publishFixture,ok,sql,q,env,out});
  report.resolved_location_proof_passed=true;report.result='PASS';
}catch(error){report.result='FAIL';report.failed_stage=stage;report.error_type=error?.code==='ERR_ASSERTION'?'ASSERTION':error?.message==='LOCAL_SQL_FAILED'?'LOCAL_SQL':'CLIENT_OR_RPC';
  report.failed_source_line=Number(error?.stack?.match(/w02_location_proof\.mjs:(\d+):/)?.[1])||null;}
finally{
  for(const child of children)if(child.exitCode===null)child.kill();
  for(const c of [owner,worker,third,anon,fixtureService])await c.auth.stopAutoRefresh();
  writeFileSync(out+'/location-proof-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(report.result+' W02_LOCATION '+(report.failed_stage??''));
  if(report.result!=='PASS')process.exitCode=1;
}
