// Existing typed profile client -> SDK/Auth/PostgREST -> existing profile guard.
// Need matching inputs below are explicit synthetic SQL fixtures; this is not an
// AI turn, publication UI journey, identity/licence verification or live proof.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL,out=env.W02_CALENDAR_ARTIFACT_DIR;
assertLocalDeviceProofTargets(url,db);assert.ok(out);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),other=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const report={unit:'W02_SHARED_CAPABILITY_VALIDATION',source_sha:env.GITHUB_SHA,result:'RUNNING',checks:[],input_sha256:{},
  live_access:false,live_promotion:false,mocked_rpc_responses:false,profile_fixture_sql:false,
  synthetic_need_fixture_sql:true,ui_journey:false,verification_activated:false,calendar_and_snapshots_unchanged:false};
const q=value=>`'${String(value).replaceAll("'","''")}'`;
const uid=value=>{assert.match(value,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);return value;};
const sql=query=>{try{return execFileSync('psql',[db,'-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
  catch {throw new Error('ISOLATED_SQL_FAILED');}};
const ok=async promise=>{const result=await promise;assert.equal(result.error,null,'ISOLATED_REQUEST_REFUSED');return result.data;};
const value=async promise=>{const result=await promise;assert.equal(result.ok,true,'ACTUAL_CLIENT_REFUSED');return result.podatak;};
const hash=table=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x`);
let stage='SETUP';
const begin=name=>{stage=name;};
const pass=()=>{report.checks.push({name:stage,result:'PASS'});console.log('PASS '+stage);};
function linked(client,id){
  const state={user:{id},accountRevision:1},cache=new Map();
  const paths={'./workerProfileClientService':'src/data/workerProfileClientService.ts','./serverReceipt':'src/data/serverReceipt.ts',
    '../lib/capabilityTerms':'src/lib/capabilityTerms.ts'};
  function load(name){
    const path=paths[name];assert.ok(path,'UNEXPECTED_DEPENDENCY');if(cache.has(path))return cache.get(path).exports;
    const source=readFileSync(path,'utf8');report.input_sha256[path]=createHash('sha256').update(source).digest('hex');
    const module={exports:{}};cache.set(path,module);
    const require=name=>name==='./supabaseClient'?{supabaseKlijent:()=>client}:name==='../store/sesija'?{sesijaSada:()=>state}:load(name);
    const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    new Function('require','module','exports',code)(require,module,module.exports);return module.exports;
  }
  return {...load('./workerProfileClientService').workerProfileClientService,state};
}
try{
  await ok(worker.auth.signUp({email:'w02-resource-'+randomUUID()+'@example.test',password:randomUUID()+'Aa9!'}));
  const accountId=uid((await ok(worker.auth.getUser())).user.id),client=linked(worker,accountId);
  await ok(other.auth.signInWithPassword({email:env.RU5_DEVICE_WORKER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
  const before=Object.fromEntries(['private.worker_calendar_events','private.response_application_snapshots','public.agreement_versions'].map(t=>[t,hash(t)]));
  const profile=(await ok(worker.from('app_profiles').select('id,profile_status').eq('account_id',accountId).eq('kind','WORKER').single()));
  const profileId=uid(profile.id);
  const read=()=>ok(worker.from('app_profiles').select('id,account_id,kind,profile_status,skills,tools,vehicles,licenses,available_now').eq('id',profileId).single());

  begin('REAL_PROFILE_SAVE_AND_READ_REUSE_EXISTING_COLUMNS');
  assert.equal(profile.profile_status,'DRAFT');
  await value(client.azurirajRadnikProfil({ime:'W02 synthetic person',grad:'Novi Sad',vestine:['  Selidbe  '],
    alati:['bušilica'],vozila:[],licence:[],radijusKm:15,zavrsi:false}));
  const saved=await read();assert.deepEqual(saved.skills,['Selidbe']);assert.deepEqual(saved.tools,['bušilica']);
  assert.deepEqual(saved.vehicles,[]);assert.deepEqual(saved.licenses,[]);assert.equal(saved.profile_status,'DRAFT');pass();

  begin('BLANK_AND_OVERSIZE_CAPABILITIES_REJECTED_BY_REAL_PROFILE_GUARD');
  for(const field of ['skills','tools','vehicles','licenses']){
    for(const malformed of [[''],['   '],[null],Array(51).fill('x'),['x'.repeat(501)]]){
      const result=await worker.from('app_profiles').update({[field]:malformed}).eq('id',profileId).select('id').single();
      assert.ok(result.error,'INVALID_DIRECT_WRITE_ACCEPTED');
      assert.ok(['V2_FACT_TYPE_INVALID','V2_FACT_ARRAY_ITEM_INVALID'].includes(result.error.message),'UNEXPECTED_VALIDATION_FAILURE');
    }
  }
  assert.deepEqual(await read(),saved);pass();

  begin('NEED_AND_PROFILE_USE_THE_SAME_EXISTING_VALUE_VALIDATOR');
  const cases=[{v:[],valid:true},{v:['selidbe'],valid:true},{v:Array(50).fill('tool'),valid:true},
    {v:[''],valid:false},{v:[null],valid:false},{v:Array(51).fill('tool'),valid:false},{v:['x'.repeat(501)],valid:false}];
  for(const field of ['skills','tools','vehicles','licenses']){
    for(const sample of cases){
      const key='need.required_'+field;
      if(sample.valid)sql(`select private.validate_need_v2_fact(${q(key)},${q(JSON.stringify(sample.v))}::jsonb)`);
      else sql(`do $check$ begin
        begin perform private.validate_need_v2_fact(${q(key)},${q(JSON.stringify(sample.v))}::jsonb);
          raise exception 'EXPECTED_V2_REJECTION';
        exception when sqlstate '22023' then null; end;
      end $check$;`);
    }
  }
  assert.equal(sql(`select position('private.validate_need_v2_fact' in prosrc)>0 from pg_proc where oid='private.guard_profile_write()'::regprocedure`),'t');pass();

  begin('EMPTY_DRAFT_IS_ALLOWED_BUT_ACTIVATION_REQUIRES_A_REAL_SKILL');
  await value(client.azurirajRadnikProfil({vestine:[],alati:[]}));
  const rejected=await client.azurirajRadnikProfil({zavrsi:true});assert.equal(rejected.ok,false);assert.equal(rejected.kod,'SKILL_REQUIRED');
  assert.equal((await read()).profile_status,'DRAFT');
  await value(client.azurirajRadnikProfil({vestine:['Selidbe'],alati:['bušilica'],zavrsi:true}));
  assert.equal((await read()).profile_status,'ACTIVE');pass();

  begin('EXISTING_MATCHER_CONSUMES_THE_CONFIRMED_RESOURCE_COLUMNS');
  const requesterId=uid(env.RU5_DEVICE_REQUESTER_USER_ID);
  const requesterProfile=uid(sql(`select id from public.app_profiles where account_id=${q(requesterId)}::uuid and kind='REQUESTER'`));
  const needId=randomUUID();
  // Explicit, isolated public Need fixture. No real publication or user demand is claimed.
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,
      mode,required_slots,schedule_kind,response_deadline,published_at,required_skills,required_tools,required_vehicles,required_licenses)
    values(${q(needId)}::uuid,${q(requesterId)}::uuid,${q(requesterProfile)}::uuid,'PUBLISHED','W02_SYNTHETIC_RESOURCE_NEED',
      'Isolated resource-consumer fixture, not a user request','PROOF','Novi Sad','OFFERS',1,'FLEXIBLE',
      statement_timestamp()+interval '2 days',statement_timestamp(),array[' selidbe '],array[' BUŠILICA '],array['W02_SYNTHETIC_VEHICLE'],array['W02_SYNTHETIC_LICENCE']);commit;`);
  const match=()=>JSON.parse(sql(`select private.match_detail(${q(needId)}::uuid,${q(profileId)}::uuid)`));
  const missing=match();
  assert.ok(missing.hardBlockers.includes('MISSING_REQUIRED_VEHICLE'));assert.ok(missing.hardBlockers.includes('MISSING_REQUIRED_LICENSE'));
  assert.ok(!missing.hardBlockers.includes('MISSING_REQUIRED_TOOL'));
  assert.ok(!missing.dispatchBlockers.includes('SERVICE_NOT_IN_WORK_PROFILE'));assert.ok(missing.reasonCodes.includes('SERVICE_MATCH'));
  await value(client.azurirajRadnikProfil({vestine:['W02_SYNTHETIC_UNRELATED_SKILL']}));
  assert.ok(match().dispatchBlockers.includes('SERVICE_NOT_IN_WORK_PROFILE'));
  await value(client.azurirajRadnikProfil({vestine:['Selidbe']}));
  await value(client.azurirajRadnikProfil({vozila:['W02_SYNTHETIC_VEHICLE'],licence:['W02_SYNTHETIC_LICENCE']}));
  const ready=match();assert.ok(!ready.hardBlockers.includes('MISSING_REQUIRED_VEHICLE'));assert.ok(!ready.hardBlockers.includes('MISSING_REQUIRED_LICENSE'));
  assert.ok(ready.reasonCodes.includes('RESOURCES_MATCH'));pass();

  begin('THIRD_ACCOUNT_CANNOT_READ_OR_WRITE_PRIVATE_PROFILE_RESOURCES');
  assert.deepEqual(await ok(other.from('app_profiles').select('id,licenses').eq('id',profileId)),[]);
  const foreign=await other.from('app_profiles').update({skills:['foreign']}).eq('id',profileId).select('id');
  assert.ok(foreign.error || foreign.data?.length===0);
  assert.deepEqual((await read()).skills,['Selidbe']);
  assert.ok((await other.rpc('rpc_complete_worker_profile',{p_profile_id:profileId})).error);pass();

  begin('PROFILE_GUARD_PRIVILEGES_AND_HISTORICAL_SNAPSHOTS_PRESERVED');
  for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},'private.guard_profile_write()','EXECUTE')`),'f');
  for(const [table,digest] of Object.entries(before))assert.equal(hash(table),digest);
  report.calendar_and_snapshots_unchanged=true;pass();report.result='PASS';
}catch(error){report.result='FAIL';report.failed_stage=stage;report.error_type=error?.code==='ERR_ASSERTION'?'ASSERTION':error?.message==='ISOLATED_SQL_FAILED'?'LOCAL_SQL':'CLIENT_OR_RPC';}
finally{
  for(const client of [worker,other])await client.auth.stopAutoRefresh();
  writeFileSync(out+'/shared-capability-proof-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(report.result+' W02_SHARED_CAPABILITY_VALIDATION '+(report.failed_stage??''));
  if(report.result!=='PASS')process.exitCode=1;
}
