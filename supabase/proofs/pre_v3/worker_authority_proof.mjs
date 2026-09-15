// Exact-source, disposable Auth/Postgres proof. Never targets the live project.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
const out=env.PRE_V3_ARTIFACT_DIR??'artifacts/pre-v3';mkdirSync(out,{recursive:true});
const report={result:'RUNNING',sourceSha:env.GITHUB_SHA,unit:'PRE_V3_WORKER_SINGLE_AUTHORITY',
  actualDatabase:true,actualAuth:true,liveAccess:false,providerCalled:false,deviceProven:false,checks:[],migrations:[]};
const hash=x=>createHash('sha256').update(x).digest('hex');
const lit=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=q=>execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-v','ON_ERROR_STOP=1','-At'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000,maxBuffer:12*1024*1024}).trim();
const rows=q=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${q}) r`));
const ok=async request=>{const r=await request;if(r.error)throw new Error('LOCAL_RPC_FAILED:'+r.error.code+':'+r.error.message);return r.data;};
const denied=async(request,code)=>{const r=await request;assert.ok(r.error,'EXPECTED_DENIAL:'+(code??'NO_CODE'));if(code)assert.equal(r.error.message,code);};
const check=name=>{report.checks.push({name,result:'PASS'});console.log('PASS '+name);};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const anon=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
async function actor(label){
 const email=`pre-v3-${label}-${randomUUID()}@proof.invalid`,password=randomUUID()+'Aa8!';
 const user=await ok(admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Disposable '+label,city:'Novi Sad'}}));
 const client=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);await ok(client.auth.signInWithPassword({email,password}));
 const p=await ok(client.rpc('rpc_get_worker_profile_for_edit',{}));return{client,id:user.user.id,profile:p};
}
try {
 const original=rows('select * from supabase_migrations.schema_migrations order by version');assert.equal(original.length,108);
 report.predecessorHistorySha256=hash(JSON.stringify(original));
 for(const file of ['20260911174500_clean_pre_v3_worker_capacity.sql','20260911174600_clean_pre_v3_worker_single_authority.sql']) {
  const path='supabase/migrations/'+file,bytes=readFileSync(path);assert.deepEqual(bytes,execFileSync('git',['show',`${env.GITHUB_SHA}:${path}`]));
  sql(bytes.toString('utf8'));
  sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${lit(file.slice(0,14))},${lit(file.slice(15,-4))},array[${lit(bytes.toString('utf8'))}])`);
  report.migrations.push({file,sha256:hash(bytes)});
 }
 assert.deepEqual(rows("select * from supabase_migrations.schema_migrations where version<'20260911174500' order by version"),original);
 sql("notify pgrst,'reload schema'");await new Promise(r=>setTimeout(r,1200));
 check('EXACT108_HISTORY_PRESERVED_FORWARD_ONLY');
 const A=await actor('a'),B=await actor('b');
 assert.notEqual(A.id,B.id);assert.equal(A.profile.account_id,A.id);assert.equal(A.profile.team_capacity,1);
 let cap=await ok(A.client.rpc('rpc_get_worker_capacity',{}));assert.equal(cap.revision,A.profile.capacity_revision);
 const first=await ok(A.client.rpc('rpc_save_worker_capacity',{p_expected_revision:cap.revision,p_team_capacity:3}));
 assert.equal(first.capacity.teamCapacity,3);assert.equal(first.idempotentReplay,false);
 const replay=await ok(A.client.rpc('rpc_save_worker_capacity',{p_expected_revision:cap.revision,p_team_capacity:3}));assert.equal(replay.idempotentReplay,true);
 await denied(A.client.rpc('rpc_save_worker_capacity',{p_expected_revision:cap.revision,p_team_capacity:4}),'WORKER_CAPACITY_VERSION_CONFLICT');
 for(const value of [0,-1,51,1.5,null,'3',[],{},true,1e100])
  await denied(A.client.rpc('rpc_save_worker_capacity',{p_expected_revision:first.capacity.revision,p_team_capacity:value}),'WORKER_CAPACITY_INPUT_INVALID');
 await denied(anon.rpc('rpc_save_worker_capacity',{p_expected_revision:first.capacity.revision,p_team_capacity:4}));
 const race=await Promise.all([4,5].map(value=>A.client.rpc('rpc_save_worker_capacity',{p_expected_revision:first.capacity.revision,p_team_capacity:value})));
 assert.equal(race.filter(r=>!r.error).length,1);assert.equal(race.find(r=>r.error).error.message,'WORKER_CAPACITY_VERSION_CONFLICT');
 cap=await ok(A.client.rpc('rpc_get_worker_capacity',{}));assert.ok([4,5].includes(cap.teamCapacity));
 assert.equal((await ok(B.client.rpc('rpc_get_worker_capacity',{}))).teamCapacity,1);
 check('CAPACITY_OWNER_BOUNDS_REPLAY_STALE_AND_CONCURRENT_CAS');
 for(const patch of [{city:'Beograd'},{radius_km:60},{available_now:true},{team_capacity:6}])
  await denied(A.client.from('app_profiles').update(patch).eq('id',A.profile.id));
 await ok(A.client.from('app_profiles').update({display_name:'New own identity',skills:['Proof']}).eq('id',A.profile.id));
 const foreign=await B.client.from('app_profiles').update({display_name:'FORBIDDEN'}).eq('id',A.profile.id).select('id');
 assert.ok(foreign.error || foreign.data.length===0);
 assert.equal((await ok(A.client.rpc('rpc_get_worker_profile_for_edit',{}))).display_name,'New own identity');
 check('GENERIC_PROTECTED_WRITES_DENIED_IDENTITY_EDIT_PRESERVED');
 let geo=await ok(A.client.rpc('rpc_get_worker_location',{}));
 const wantedGeo={operatingCountryCode:'RS',city:'Zemun',radiusKm:25,approximatePosition:{latitude:44.85,longitude:20.4}};
 await denied(A.client.rpc('rpc_save_worker_location',{p_expected_revision:geo.revision,p_value:wantedGeo,p_confirmed:false}),'LOCATION_CONFIRMATION_REQUIRED');
 const savedGeo=await ok(A.client.rpc('rpc_save_worker_location',{p_expected_revision:geo.revision,p_value:wantedGeo,p_confirmed:true}));
 assert.equal(savedGeo.location.city,'Zemun');
 await denied(A.client.rpc('rpc_save_worker_location',{p_expected_revision:geo.revision,p_value:{...wantedGeo,city:'Novi Sad'},p_confirmed:true}),'LOCATION_VERSION_CONFLICT');
 const stored=rows(`select p.city,p.radius_km,p.operating_country_code,w.approximate_lat,w.approximate_lng,
  extensions.st_y(w.approximate_geog::extensions.geometry) lat,extensions.st_x(w.approximate_geog::extensions.geometry) lng
  from public.app_profiles p join public.worker_match_preferences w on w.worker_profile_id=p.id where p.id=${lit(A.profile.id)}::uuid`)[0];
 assert.deepEqual(stored,{city:'Zemun',radius_km:25,operating_country_code:'RS',approximate_lat:44.85,approximate_lng:20.4,lat:44.85,lng:20.4});
 const view=await ok(A.client.rpc('rpc_get_worker_profile_for_edit',{}));assert.equal(view.city,stored.city);assert.equal(view.radius_km,stored.radius_km);
 await denied(A.client.from('worker_match_preferences').update({approximate_lat:45}).eq('worker_profile_id',A.profile.id),'PROFILE_LOCATION_REQUIRES_REVIEW');
 const noDelete=await A.client.from('worker_match_preferences').delete().eq('worker_profile_id',A.profile.id).select('worker_profile_id');
 assert.ok(noDelete.error || (Array.isArray(noDelete.data)&&noDelete.data.length===0),'DELETE_MUST_NOT_CHANGE_PREFS');
 assert.equal(Number(sql(`select count(*) from public.worker_match_preferences where worker_profile_id=${lit(A.profile.id)}::uuid`)),1);
 check('CONFIRMED_LOCATION_DISPLAY_EQUALS_MATCHING_GEOGRAPHY');
 let avail=await ok(A.client.rpc('rpc_get_worker_availability',{}));
 const ruleId=randomUUID(),windowId=randomUUID();
 const wantedAvailability={timezone:'UTC',availableNow:true,
  rules:[{id:ruleId,weekdays:[1,3],startTime:'08:00:00',endTime:'18:00:00',startsOn:'2026-01-01',endsOn:null,label:'Rule',active:true}],
  windows:[{id:windowId,startsAt:'2030-01-01T08:00:00Z',endsAt:'2030-01-01T10:00:00Z',state:'UNAVAILABLE',label:'Exception'}]};
 const savedAvail=await ok(A.client.rpc('rpc_save_worker_availability',{p_expected_revision:avail.revision,p_value:wantedAvailability}));
 assert.equal(savedAvail.availability.availableNow,true);assert.equal(savedAvail.availability.timezone,'UTC');
 assert.equal(savedAvail.availability.rules[0].id,ruleId);assert.equal(savedAvail.availability.windows[0].id,windowId);
 await denied(A.client.rpc('rpc_save_worker_availability',{p_expected_revision:avail.revision,p_value:{...wantedAvailability,availableNow:false}}),'AVAILABILITY_VERSION_CONFLICT');
 assert.equal((await ok(A.client.rpc('rpc_save_worker_availability',{p_expected_revision:avail.revision,p_value:wantedAvailability}))).idempotentReplay,true);
 await denied(A.client.from('worker_match_preferences').update({timezone:'Europe/Belgrade'}).eq('worker_profile_id',A.profile.id),'PROFILE_AVAILABILITY_REQUIRES_REVIEW');
 await denied(A.client.from('profile_availability_rules').delete().eq('profile_id',A.profile.id));
 await denied(A.client.from('profile_availability_windows').delete().eq('profile_id',A.profile.id));
 assert.equal((await ok(A.client.rpc('rpc_get_worker_location',{}))).revision,savedGeo.location.revision);
 assert.equal((await ok(A.client.rpc('rpc_get_worker_profile_for_edit',{}))).available_now,true);
 check('AVAILABILITY_RULES_EXCEPTIONS_REPLAY_STALE_AND_NO_SECOND_WRITER');
 // Canonical mutations cannot leave a usable bypass token for the next REST call.
 await denied(A.client.from('app_profiles').update({radius_km:99}).eq('id',A.profile.id),'PROFILE_LOCATION_REQUIRES_REVIEW');
 await denied(A.client.from('app_profiles').update({team_capacity:8}).eq('id',A.profile.id),'PROFILE_CAPACITY_REQUIRES_REVIEW');
 check('SUBSEQUENT_REST_CALLS_CANNOT_REUSE_MUTATION_TOKEN');
 // Different canonical fact groups serialize on the same row without erasing
 // each other's unrelated facts or falsely sharing a content revision.
 geo=await ok(A.client.rpc('rpc_get_worker_location',{}));avail=await ok(A.client.rpc('rpc_get_worker_availability',{}));
 const changedGeo={...wantedGeo,radiusKm:30};const changedAvail={...wantedAvailability,availableNow:false};
 const both=await Promise.all([
  A.client.rpc('rpc_save_worker_location',{p_expected_revision:geo.revision,p_value:changedGeo,p_confirmed:true}),
  A.client.rpc('rpc_save_worker_availability',{p_expected_revision:avail.revision,p_value:changedAvail})]);
 both.forEach(r=>assert.equal(r.error,null));
 assert.equal((await ok(A.client.rpc('rpc_get_worker_location',{}))).radiusKm,30);
 assert.equal((await ok(A.client.rpc('rpc_get_worker_availability',{}))).availableNow,false);
 check('CONCURRENT_LOCATION_AVAILABILITY_PRESERVE_EACH_OTHER');
 report.result='PASS';report.historyCount=Number(sql('select count(*) from supabase_migrations.schema_migrations'));assert.equal(report.historyCount,110);
} catch(error){report.result='FAIL';report.failure=String(error.message).slice(0,500);process.exitCode=1;console.error('FAIL '+report.failure);}
finally {writeFileSync(out+'/worker-authority-report.json',JSON.stringify(report,null,2)+'\n');console.log(report.result+' PRE_V3_WORKER_SINGLE_AUTHORITY');}
