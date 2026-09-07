// N08 authenticated preference invariant proof; disposable loopback only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const out=env.N08_ARTIFACT_DIR||'artifacts/notifications-n08';
mkdirSync(out,{recursive:true});
const report={unit:'N08_NOTIFICATION_PREFERENCES',source_sha:env.GITHUB_SHA||null,
  run_id:env.GITHUB_RUN_ID||null,live_access:false,live_promotion:false,
  push_provider_called:false,mobile_proof:false,checks:[]};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
let current='PREFLIGHT';
function sql(query){
  try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At','-c',query],
    {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
  catch{throw new Error('DISPOSABLE_SQL_FAILED');}
}
async function ok(promise){const result=await promise;if(result.error)throw new Error('AUTH_RPC_FAILED');return result.data;}
const check=name=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
const snapshot=()=>Object.fromEntries(['agreement_messages','user_activity_events','notification_deliveries']
  .map(name=>[name,sql(`select count(*)||':'||md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) from public.${name} t`)]));
try{
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'84');
  assert.equal(sql('select count(*) from public.notification_preferences'),'0');
  for(const [client,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,env.RU5_DEVICE_WORKER_USER_ID],
    [requester,env.RU5_DEVICE_REQUESTER_EMAIL,env.RU5_DEVICE_REQUESTER_USER_ID]]){
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
    assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  const agreement=await ok(requester.from('agreements').select('id').single());
  const message=body=>requester.rpc('rpc_send_agreement_message',{p_agreement_id:agreement.id,p_body:body});
  check('PREDECESSOR_AUTHENTICATED_INVALID_TIMEZONE_ROLLS_BACK_COUNTERPART_MESSAGE');
  await ok(worker.from('notification_preferences').upsert({user_id:env.RU5_DEVICE_WORKER_USER_ID,
    role_context:'WORKER',quiet_hours_enabled:true,quiet_start:'22:00',quiet_end:'08:00',
    quiet_timezone:'Invalid_Nonexistent_Zone'}));
  const prefs=await ok(worker.from('notification_preferences')
    .select('role_context,quiet_hours_enabled,quiet_start,quiet_end,quiet_timezone,push_enabled').single());
  assert.equal(prefs.quiet_timezone,'Invalid_Nonexistent_Zone');
  assert.equal(prefs.quiet_hours_enabled,true);
  report.predecessor_observation={preferences:prefs,
    quiet_function_md5:sql("select md5(prosrc) from pg_proc where oid='private.in_quiet_hours(public.notification_preferences)'::regprocedure"),
    emit_function_md5:sql("select md5(prosrc) from pg_proc where oid='private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)'::regprocedure")};
  const before=snapshot();
  const failed=await message('N08_PRIVATE_ROLLBACK_CANARY');
  assert.ok(failed.error,'actual counterpart command must fail on admitted malformed preferences');
  assert.equal(failed.error.code,'22023');
  assert.match(failed.error.message,/time zone.*not recognized/i);
  assert.deepEqual(snapshot(),before,'domain message/event/deliveries roll back together');
  report.reproduction={owner_write:'AUTHENTICATED_ACCEPTED',counterpart_rpc:'rpc_send_agreement_message',
    error_code:failed.error.code,error_class:'UNRECOGNIZED_TIME_ZONE',before,after:snapshot(),
    push_enabled:false};
  pass();
  check('PREDECESSOR_RECOVERS_AFTER_OWNER_REMOVES_INVALID_PREFERENCE');
  await ok(worker.from('notification_preferences').delete().eq('role_context','WORKER'));
  await ok(message('N08_PRIVATE_RECOVERY_CANARY'));
  assert.equal(sql('select count(*) from public.notification_preferences'),'0');
  assert.equal(sql('select count(*) from public.notification_push_attempts'),'0');
  pass();
  report.result='REPRODUCED';console.log('PASS N08_PREDECESSOR_REPRODUCTION');
}catch(error){report.result='FAIL';report.failed_check=current;
  report.error=error instanceof assert.AssertionError?'ASSERTION_FAILED':error.message;
  throw error;
}finally{writeFileSync(`${out}/proof-report.json`,JSON.stringify(report,null,2)+'\n');}
