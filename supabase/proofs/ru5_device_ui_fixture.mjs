import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from './ru5_device_ui_local_guard.mjs';


async function legacyFixture(env) {
const url = env.RU5_DEVICE_SUPABASE_URL;
const anonKey = env.RU5_DEVICE_ANON_KEY;
const serviceRoleKey = env.RU5_DEVICE_SERVICE_ROLE_KEY;
const dbUrl = env.RU5_DEVICE_DB_URL;
const githubEnv = env.GITHUB_ENV;

assert.ok(url, 'RU5_DEVICE_SUPABASE_URL required');
assert.ok(anonKey, 'RU5_DEVICE_ANON_KEY required');
assert.ok(serviceRoleKey, 'RU5_DEVICE_SERVICE_ROLE_KEY required');
assert.ok(dbUrl, 'RU5_DEVICE_DB_URL required');
assert.ok(githubEnv, 'GITHUB_ENV required');

assertLocalDeviceProofTargets(url, dbUrl);

const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const requester = createClient(url, anonKey, options);
const worker = createClient(url, anonKey, options);
const fixtureAdmin = createClient(url, serviceRoleKey, options);

const runId = randomUUID();
const requesterEmail = `ru5-device-requester-${runId}@proof.invalid`;
const workerEmail = `ru5-device-worker-${runId}@proof.invalid`;
const password = `Ru5Device${randomUUID().replaceAll('-', '')}Aa1`;
const needTitle = `RU5 device journey ${runId.slice(0, 8)}`;

function psql(sql) {
  return execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function createRealAccount(client, email, metadata) {
  const signed = await client.auth.signUp({ email, password, options: { data: metadata } });
  if (signed.error) throw new Error(`SIGNUP_FAILED:${signed.error.message}`);
  assert.ok(signed.data.user?.id, 'signup user id missing');
  if (!signed.data.session) {
    const confirmed = await fixtureAdmin.auth.admin.updateUserById(signed.data.user.id, { email_confirm: true });
    if (confirmed.error) throw new Error(`FIXTURE_CONFIRM_FAILED:${confirmed.error.message}`);
  }
  return signed.data.user;
}

const requesterUser = await createRealAccount(requester, requesterEmail, {
  first_name: 'RU5', last_name: 'Requester', city: 'Novi Sad',
});
const workerUser = await createRealAccount(worker, workerEmail, {
  first_name: 'RU5', last_name: 'Worker', city: 'Novi Sad', skills: ['Proof'],
});
assert.notEqual(requesterUser.id, workerUser.id, 'two distinct accounts required');

const requesterLogin = await requester.auth.signInWithPassword({ email: requesterEmail, password });
if (requesterLogin.error) throw requesterLogin.error;
const workerLogin = await worker.auth.signInWithPassword({ email: workerEmail, password });
if (workerLogin.error) throw workerLogin.error;

const requesterProfiles = await requester.from('app_profiles').select('id,kind,profile_status').eq('account_id', requesterUser.id);
if (requesterProfiles.error) throw requesterProfiles.error;
const requesterProfile = requesterProfiles.data.find((p) => p.kind === 'REQUESTER');
assert.equal(requesterProfile?.profile_status, 'ACTIVE', 'requester profile must be active');

const workerProfiles = await worker.from('app_profiles').select('id,kind,profile_status').eq('account_id', workerUser.id);
if (workerProfiles.error) throw workerProfiles.error;
const workerProfile = workerProfiles.data.find((p) => p.kind === 'WORKER');
assert.ok(workerProfile?.id, 'worker profile missing');

const update = await worker.from('app_profiles').update({
  display_name: 'RU5 Device Worker', city: 'Novi Sad', skills: ['Proof'], tools: ['ProofTool'],
  available_now: true, radius_km: 50,
}).eq('id', workerProfile.id);
if (update.error) throw update.error;
const activate = await worker.rpc('rpc_complete_worker_profile', { p_profile_id: workerProfile.id });
if (activate.error) throw activate.error;

const needId = randomUUID();
psql(`
begin;
select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(
  id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,mode,required_slots,response_deadline,published_at
) values (
  '${needId}'::uuid,'${requesterUser.id}'::uuid,'${requesterProfile.id}'::uuid,
  'PUBLISHED','${needTitle}','Disposable physical Android emulator UI proof','PROOF',
  'Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp()
);
select set_config('uskoci.need_lifecycle','',true);
commit;
`);

console.log(`::add-mask::${password}`);
appendFileSync(githubEnv, [
  `RU5_DEVICE_REQUESTER_EMAIL=${requesterEmail}`,
  `RU5_DEVICE_WORKER_EMAIL=${workerEmail}`,
  `RU5_DEVICE_PASSWORD=${password}`,
  `RU5_DEVICE_NEED_ID=${needId}`,
  `RU5_DEVICE_NEED_TITLE=${needTitle}`,
  `RU5_DEVICE_REQUESTER_USER_ID=${requesterUser.id}`,
  `RU5_DEVICE_WORKER_USER_ID=${workerUser.id}`,
  '',
].join('\n'));

console.log(`PASS RU5_DEVICE_UI_FIXTURE two_real_auth_accounts worker_active need=${needId} bounded_note_not_configured production_not_touched`);

}

export function validateCoreFixture(env) {
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
  assert.equal(env.RU5_DEVICE_CORE106,'1');assert.equal(env.RU5_DEVICE_PACKAGE,'rs.uskoci.n04proof');
  assert.equal(env.RU5_DEVICE_PROOF_DIR,'/tmp/uskoci-ru5-device-ui');
  assert.equal(env.RU5_DEVICE_ARTIFACT_DIR,'artifacts/ru5-device-ui');assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
}
export function coreLocation() {
  const geography={mode:'STATIONARY',start:{city:'Novi Sad',area:'Liman'}};
  return {taskCountryCode:'RS',geography,exactAddress:null,accessNotes:null,
    resolvedLocation:{version:1,binding:{taskCountryCode:'RS',geography,exactAddress:null},
      points:[{slot:'start',latitudeE6:45251234,longitudeE6:19831234,origin:{kind:'MANUAL_PIN'}}]}};
}
export async function prepareCore105(env=process.env) {
  validateCoreFixture(env); // Before credentials, files or SQL.
  const out=env.RU5_DEVICE_ARTIFACT_DIR;mkdirSync(out,{recursive:true});
  const q=x=>"'"+String(x).replaceAll("'","''")+"'";
  const sql=query=>{try{return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-v','ON_ERROR_STOP=1','-At'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000}).trim();}catch{throw new Error('CORE_FIXTURE_SQL_FAILED');}};
  const hash=table=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x`);
  const security=()=>sql(`select md5(jsonb_build_object('functions',(select jsonb_agg(jsonb_build_array(p.oid,p.prosrc,p.proacl,p.proconfig) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')),'triggers',(select jsonb_agg(jsonb_build_array(t.oid,t.tgenabled,pg_get_triggerdef(t.oid)) order by t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')),'rls',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','private')))::text)`);
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'105');
  const securityBefore=security(),history=hash('supabase_migrations.schema_migrations');
  const baseline={publication:hash('private.publication_policy_bundles'),decisions:hash('private.need_publication_decisions'),retention:hash('private.retention_policy_sets'),markets:hash('private.location_market_configs')};
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const requester=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options),worker=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options),service=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
  const ok=async promise=>{const caller=Array.from((new Error().stack??'').matchAll(/ru5_device_ui_fixture\.mjs:(\d+):(\d+)/g))[1]?.[1]??'unknown';
    const r=await promise;if(r.error){console.error('CORE_FIXTURE_RPC_FAILED source_line='+caller+' sqlstate='+(/^[A-Z0-9]{5}$/.test(r.error.code??'')?r.error.code:'UNAVAILABLE'));throw new Error('CORE_FIXTURE_AUTH_RPC_FAILED');}return r.data;};
  for(const [client,email,id] of [[requester,env.RU5_DEVICE_REQUESTER_EMAIL,env.RU5_DEVICE_REQUESTER_USER_ID],[worker,env.RU5_DEVICE_WORKER_EMAIL,env.RU5_DEVICE_WORKER_USER_ID]]) {
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  const wl=await ok(worker.rpc('rpc_get_worker_location'));
  const savedLocation=await ok(worker.rpc('rpc_save_worker_location',{p_expected_revision:wl.revision,p_confirmed:true,
    p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:50,approximatePosition:{latitude:45.25,longitude:19.83}}}));
  assert.equal(savedLocation.location.operatingCountryCode,'RS');
  // Reuse the existing W02 owner review + service synthetic NON-location facts
  // at its admitted source105, before106 closes the old unowned turn writer.
  const conversationId=await ok(requester.rpc('rpc_ai_open_need_conversation_v2'));
  const review=await ok(requester.rpc('rpc_get_need_location_review',{p_conversation_id:conversationId}));
  const saved=await ok(requester.rpc('rpc_save_need_location_review',{p_conversation_id:conversationId,p_expected_revision:review.revision,p_confirmed:true,p_value:coreLocation()}));
  assert.equal(saved.review.confirmed,true);
  const nonce=randomUUID().slice(0,8),title=`Core native ${nonce}`;
  const start=new Date();start.setUTCDate(start.getUTCDate()+7);start.setUTCHours(8,0,0,0);const end=new Date(start.getTime()+2*3600000);
  const facts=[['need.title',title],['need.description','Disposable native journey. Synthetic precondition; no actual publication or provider proof.'],['need.category','PROOF'],['need.price_mode','OFFERS'],['need.schedule_kind','FIXED_WINDOW'],['need.people_needed',1],['need.starts_at',start.toISOString()],['need.ends_at',end.toISOString()]];
  await ok(service.rpc('rpc_ai_apply_interview_turn_v2_service',{p_account_id:env.RU5_DEVICE_REQUESTER_USER_ID,p_conversation_id:conversationId,
    p_user_message:'CORE_SYNTHETIC_PRECONDITION',p_assistant_message:'CORE_SYNTHETIC_PRECONDITION',p_safety:'REVIEW',
    p_proposals:facts.map(([key,value])=>({key,value,displayValue:String(value),evidence:'Synthetic disposable precondition only',confidence:1}))}));
  const reviewed=await ok(requester.rpc('rpc_ai_need_review_v2',{p_conversation_id:conversationId}));
  for(const f of reviewed.facts)if(f.status!=='CONFIRMED')await ok(requester.rpc('rpc_ai_confirm_fact',{p_fact_id:f.id}));
  const profile=await ok(requester.from('app_profiles').select('id').eq('kind','REQUESTER').eq('account_id',env.RU5_DEVICE_REQUESTER_USER_ID).single());
  const receipt=await ok(requester.rpc('rpc_save_need_draft_from_review',{p_conversation_id:conversationId,p_requester_profile_id:profile.id,p_client_request_id:'core-draft-'+randomUUID()}));
  assert.equal(receipt.status,'DRAFT');assert.equal(receipt.authoritative,true);
  const needId=receipt.needId;assert.match(needId,/^[a-f0-9-]{36}$/);
  // EXACT existing W02 publishFixture mechanism: labelled disposable status
  // precondition only. No policy/DDL/ACL/RLS change, no auth.uid shortcut.
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);update public.needs set status='PUBLISHED',published_at=statement_timestamp(),response_deadline=statement_timestamp()+interval '2 days' where id=${q(needId)}::uuid;commit;`);
  const need=await ok(worker.from('needs').select('id,status,revision,task_country_code,task_timezone,starts_at,ends_at,approximate_lat,approximate_lng,need_geography(public_topology)').eq('id',needId).single());
  assert.equal(need.task_country_code,'RS');assert.equal(need.task_timezone,'Europe/Belgrade');assert.equal(need.status,'PUBLISHED');
  assert.equal(Date.parse(need.starts_at),start.getTime());assert.equal(Date.parse(need.ends_at),end.getTime());
  assert.equal(need.approximate_lat,45.25);assert.equal(need.approximate_lng,19.83);assert.deepEqual(need.need_geography.public_topology,coreLocation().geography);
  assert.deepEqual(await ok(worker.from('need_sensitive').select('*').eq('need_id',needId)),[]);
  for(const table of ['marketplace_responses','need_selections','agreements'])assert.equal(sql(`select count(*) from public.${table} where need_id=${q(needId)}::uuid`),'0');
  assert.equal(security(),securityBefore);assert.equal(hash('supabase_migrations.schema_migrations'),history);
  for(const [key,table] of Object.entries({publication:'private.publication_policy_bundles',decisions:'private.need_publication_decisions',retention:'private.retention_policy_sets',markets:'private.location_market_configs'}))assert.equal(hash(table),baseline[key]);
  const report={result:'PASS',sourceSha:env.GITHUB_SHA,localOnly:true,preparationHistory:105,nativeHistoryRequired:106,
    syntheticFixturePrecondition:true,publicationProof:false,productionPolicyActivation:false,providerProof:false,aiProof:false,
    realOwnerLocationReview:true,realOwnerWorkerCountry:true,securityUnchanged:true,baseline,needId,needTitle:title,searchToken:nonce,
    requesterId:env.RU5_DEVICE_REQUESTER_USER_ID,workerId:env.RU5_DEVICE_WORKER_USER_ID,needRevision:need.revision,
    startAt:start.toISOString(),endAt:end.toISOString(),publicPoint:{lat:45.25,lng:19.83}};
  writeFileSync(join(out,'core-fixture.json'),JSON.stringify(report,null,2)+'\n');
  appendFileSync(env.GITHUB_ENV,`RU5_DEVICE_NEED_ID=${needId}\nRU5_DEVICE_NEED_TITLE=${title}\n`);
  console.log('PASS CORE_NATIVE_FIXTURE_105 real_owner_location synthetic_published_precondition no_native_commands');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const mode=process.argv[2]??'legacy79';
  try { if(mode==='legacy79')await legacyFixture(process.env);else if(mode==='core105')await prepareCore105();else throw new Error('UNKNOWN_FIXTURE_MODE'); }
  catch { console.error('RU5_DEVICE_FIXTURE_FAILED');process.exitCode=1; }
}
