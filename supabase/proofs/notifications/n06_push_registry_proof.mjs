import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const out=env.N06_ARTIFACT_DIR||'artifacts/notifications-n06';mkdirSync(out,{recursive:true});
const path=fileURLToPath(new URL('./n06_push_registry_candidate.sql',import.meta.url));
const report={unit:'N06_PUSH_DEVICE_REGISTRY',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  candidate_sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),live_access:false,live_promotion:false,
  push_provider_called:false,mobile_proof:false,checks:[]};
let current='PREFLIGHT';
const check=(name)=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
function sql(q){try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At','-c',q],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{throw new Error('LOCAL_SQL_FAILED');}}
const ok=async(p)=>{const r=await p;if(r.error)throw new Error('AUTH_RPC_FAILED');return r.data;};
const token=()=>`ExpoPushToken[synthetic_${randomUUID().replaceAll('-','')}]`;
const get=(c,t)=>ok(c.rpc('rpc_get_push_device',{p_expo_push_token:t}));
const set=(c,t,revision,active=true,platform='ANDROID')=>c.rpc('rpc_set_push_device',{p_expo_push_token:t,p_platform:platform,p_active:active,p_expected_revision:revision});
const snapshot=()=>sql("select coalesce(jsonb_agg(to_jsonb(d) order by id),'[]'::jsonb) from public.notification_push_devices d");
async function deny(p){const before=snapshot();assert.ok((await p()).error);assert.equal(snapshot(),before);}
try {
  check('REAL_AUTH_AND_DISPOSABLE_CANDIDATE');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'79');
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',path],{stdio:'pipe'});
  for(const [c,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,env.RU5_DEVICE_WORKER_USER_ID],[requester,env.RU5_DEVICE_REQUESTER_EMAIL,env.RU5_DEVICE_REQUESTER_USER_ID]]){
    await ok(c.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
    assert.equal((await ok(c.auth.getUser())).user.id,id);
  }
  pass();
  check('AUTH_FORMAT_PLATFORM_AND_CAS_VALIDATION');
  const t=token();assert.deepEqual(await get(worker,t),{exists:false,revision:0,active:false});
  await deny(()=>set(anon,t,0));await deny(()=>set(worker,t,-1));await deny(()=>set(worker,t,null));
  for(const bad of ['', 'plain-token', 'ExpoPushToken[]', 'ExpoPushToken[x]\nprivate', null]) await deny(()=>set(worker,bad,0));
  await deny(()=>set(worker,t,0,true,'WEB'));await deny(()=>set(worker,t,0,null));pass();
  check('CONCURRENT_REGISTRATION_IS_ONE_ACKNOWLEDGED_REVISION');
  const registered=await Promise.all([ok(set(worker,t,0)),ok(set(worker,t,0))]);
  assert.deepEqual(registered[0],registered[1]);assert.equal(registered[0].revision,1);assert.equal(registered[0].active,true);
  assert.ok(!('expo_push_token'in registered[0]));assert.ok(!('user_id'in registered[0]));
  assert.equal(sql('select count(*) from public.notification_push_devices'),'1');pass();
  check('OWNER_READ_NO_DIRECT_MUTATIONS_OR_FOREIGN_REVOCATION');
  assert.deepEqual(await get(requester,t),{exists:false,revision:0,active:false});
  assert.equal((await ok(requester.from('notification_push_devices').select('id'))).length,0);
  await deny(()=>requester.from('notification_push_devices').update({active:false}).eq('id',registered[0].id));
  await deny(()=>worker.from('notification_push_devices').update({active:false}).eq('id',registered[0].id));
  await deny(()=>worker.from('notification_push_devices').delete().eq('id',registered[0].id));
  await deny(()=>worker.from('notification_push_devices').insert({expo_push_token:token(),platform:'ANDROID',user_id:env.RU5_DEVICE_WORKER_USER_ID}));
  await deny(()=>set(requester,t,1,false));pass();
  check('REVOKE_REPLAY_AND_LATE_ENABLE_CANNOT_RESURRECT');
  const revoked=await ok(set(worker,t,1,false));assert.equal(revoked.revision,2);assert.equal(revoked.active,false);
  assert.deepEqual(await ok(set(worker,t,1,false)),revoked);
  await deny(()=>set(worker,t,0,true));await deny(()=>set(worker,t,1,true));
  const enabled=await ok(set(worker,t,2,true));assert.equal(enabled.revision,3);pass();
  check('UNSEEN_REVOKE_TOMBSTONE_REJECTS_IN_FLIGHT_INITIAL_ENABLE');
  const unseen=token();assert.equal((await ok(set(worker,unseen,0,false))).revision,1);
  await deny(()=>set(worker,unseen,0,true));assert.equal((await get(worker,unseen)).active,false);pass();
  check('CROSS_ACCOUNT_TOKEN_REBIND_IS_ATOMIC_AND_STALES_OLD_OWNER');
  const rebound=await ok(set(requester,t,0,true,'IOS'));assert.equal(rebound.revision,1);
  assert.equal((await get(worker,t)).active,false);assert.equal((await get(worker,t)).revision,4);
  await deny(()=>set(worker,t,3,true));
  assert.equal(sql('select count(*) from public.notification_push_devices where active'),'1');
  const unique=sql("select count(*) from (select expo_push_token from public.notification_push_devices where active group by expo_push_token having count(*)>1) x");
  assert.equal(unique,'0');pass();
  check('CONCURRENT_DIFFERENT_OWNER_CLAIMS_NEVER_DUPLICATE_ACTIVE_TOKEN');
  const raced=token();await Promise.all([ok(set(worker,raced,0)),ok(set(requester,raced,0))]);
  const a=await get(worker,raced),b=await get(requester,raced);assert.notEqual(a.active,b.active);
  assert.equal(Number(a.revision)+Number(b.revision),3);pass();
  check('REGISTRY_NEVER_OPT_INS_SENDS_OR_ACTIVATES_FEATURES');
  assert.equal(sql('select count(*) from public.notification_preferences where push_enabled'),'0');
  for(const table of ['public.notification_push_attempts','public.notification_deliveries','public.user_activity_events',
    'private.publication_policy_bundles','private.need_publication_decisions','private.preselection_qa_questions','private.preselection_qa_commands'])
    assert.equal(sql(`select count(*) from ${table}`),'0');
  assert.equal(sql("select count(*) from public.needs where mode='FASTEST'"),'0');
  assert.equal(sql("select count(*) from public.need_selections where selection_mode='AUTO_FILL'"),'0');
  assert.equal(sql("select has_function_privilege('anon','public.rpc_set_push_device(text,text,boolean,bigint)','EXECUTE')"),'f');
  assert.equal(sql("select has_function_privilege('service_role','public.rpc_set_push_device(text,text,boolean,bigint)','EXECUTE')"),'f');
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));assert.equal(report.migration_history_count,79);
  pass();report.result='PASS';console.log('PASS N06_PUSH_REGISTRY_AUTHENTICATED_PROOF');
}catch(error){report.result='FAIL';report.failed_check=current;console.error('FAIL N06',current,error.message);process.exitCode=1;
}finally{writeFileSync(`${out}/proof-report.json`,JSON.stringify(report,null,2)+'\n');}
