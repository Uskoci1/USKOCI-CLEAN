// N08 authenticated preference invariant proof; disposable loopback only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
const anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const service=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const candidate='supabase/proofs/notifications/n08_preferences_candidate.sql';
const manifest=JSON.parse(readFileSync('supabase/proofs/notifications/n08_preferences_files.json','utf8'));
const candidateBytes=readFileSync(candidate);
assert.equal(manifest.file,candidate);
assert.equal(manifest.sha256,createHash('sha256').update(candidateBytes).digest('hex'));
assert.equal(manifest.md5,createHash('md5').update(candidateBytes).digest('hex'));
assert.equal(manifest.bytes,candidateBytes.length);
report.candidate=manifest;
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
const rows=query=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));
const get=(client,role='WORKER')=>ok(client.rpc('rpc_get_notification_preferences',{p_role:role}));
const set=(client,settings,revision,role='WORKER')=>client.rpc('rpc_set_notification_preferences',
  {p_role:role,p_settings:settings,p_expected_revision:revision});
async function rejected(promise,code){const result=await promise;assert.ok(result.error);if(code)assert.equal(result.error.code,code);return result.error;}
const defaultSettings={in_app_enabled:true,push_enabled:false,opportunities_enabled:true,responses_enabled:true,
  dogovor_enabled:true,execution_enabled:true,recovery_enabled:true,account_enabled:true,quiet_hours_enabled:false,
  quiet_start:null,quiet_end:null,quiet_timezone:'Europe/Belgrade',urgent_overrides_quiet_hours:false};
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
    role_context:'WORKER',push_enabled:true,quiet_hours_enabled:true,quiet_start:'22:00',quiet_end:'08:00',
    quiet_timezone:'USKOCI_INVALID_TIMEZONE'}));
  const prefs=await ok(worker.from('notification_preferences')
    .select('role_context,quiet_hours_enabled,quiet_start,quiet_end,quiet_timezone,push_enabled').single());
  assert.equal(prefs.quiet_timezone,'USKOCI_INVALID_TIMEZONE');
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
    push_enabled:true};
  pass();
  check('CANDIDATE_ABORTS_ON_INVALID_LEGACY_ROW_WITHOUT_PARTIAL_DDL');
  const invalidRows=sql("select md5(jsonb_agg(to_jsonb(p))::text) from public.notification_preferences p");
  let refused=false;
  try{execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',candidate],{stdio:'pipe'});}
  catch(error){refused=String(error.stderr).includes('N08_EXISTING_INVALID_PREFERENCES');}
  assert.equal(refused,true);
  assert.equal(sql("select count(*) from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='revision'"),'0');
  assert.equal(sql("select to_regprocedure('public.rpc_get_notification_preferences(text)') is null"),'t');
  assert.equal(sql("select md5(jsonb_agg(to_jsonb(p))::text) from public.notification_preferences p"),invalidRows);
  assert.deepEqual(snapshot(),before);pass();
  check('PREDECESSOR_RECOVERS_AFTER_OWNER_REMOVES_INVALID_PREFERENCE');
  await ok(worker.from('notification_preferences').delete().eq('role_context','WORKER'));
  await ok(message('N08_PRIVATE_RECOVERY_CANARY'));
  assert.equal(sql('select count(*) from public.notification_preferences'),'0');
  assert.equal(sql('select count(*) from public.notification_push_attempts'),'0');
  pass();
  console.log('PASS N08_PREDECESSOR_REPRODUCTION');

  check('EXACT_CANDIDATE_PRESERVES_VALID_LEGACY_ROW_AND_HISTORY');
  await ok(worker.from('notification_preferences').insert({user_id:env.RU5_DEVICE_WORKER_USER_ID,
    role_context:'WORKER',...defaultSettings}));
  const legacy=sql("select md5(jsonb_agg(to_jsonb(p))::text) from public.notification_preferences p");
  const history=sql("select md5(jsonb_agg(to_jsonb(m) order by version)::text) from supabase_migrations.schema_migrations m");
  const noEffects=snapshot();
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',candidate],{stdio:'pipe'});
  assert.equal(sql("select md5(jsonb_agg(to_jsonb(p)-'revision')::text) from public.notification_preferences p"),legacy);
  assert.equal(sql('select revision from public.notification_preferences'),'0');
  sql("notify pgrst,'reload schema'");
  let ready=false;
  for(let i=0;i<40;i++){
    const response=await worker.rpc('rpc_get_notification_preferences',{p_role:'WORKER'});
    if(!response.error){ready=true;break;}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'new RPC is served after disposable schema reload');
  assert.deepEqual(snapshot(),noEffects);pass();

  check('OWNER_DEFAULT_READ_HAS_NO_WRITE_OR_OPT_IN');
  const existing=await get(worker);assert.equal(existing.exists,true);assert.equal(existing.revision,0);
  assert.deepEqual(existing.settings,defaultSettings);
  for(const [client,role] of [[requester,'REQUESTER'],[requester,'WORKER'],[worker,'REQUESTER']]){
    const result=await get(client,role);
    assert.deepEqual(result,{exists:false,roleContext:role,revision:0,updatedAt:null,settings:defaultSettings});
  }
  assert.equal(sql('select count(*) from public.notification_preferences'),'1');pass();

  check('AUTH_ROLE_PAYLOAD_TIMEZONE_AND_TIME_INVARIANTS');
  await rejected(anon.rpc('rpc_get_notification_preferences',{p_role:'WORKER'}));
  await rejected(anon.rpc('rpc_set_notification_preferences',{p_role:'WORKER',p_settings:defaultSettings,p_expected_revision:0}));
  for(const role of [null,'worker','ADMIN']){
    await rejected(worker.rpc('rpc_get_notification_preferences',{p_role:role}),'22023');
    await rejected(set(worker,defaultSettings,0,role),'22023');
  }
  const withoutPush={...defaultSettings};delete withoutPush.push_enabled;
  const invalid=[null,[],{},withoutPush,{...defaultSettings,user_id:env.RU5_DEVICE_REQUESTER_USER_ID},
    {...defaultSettings,revision:1},{...defaultSettings,push_enabled:'true'},
    {...defaultSettings,dogovor_enabled:null},{...defaultSettings,quiet_timezone:'USKOCI_INVALID_TIMEZONE'},
    {...defaultSettings,quiet_timezone:'N08/Invalid_Zone'},{...defaultSettings,quiet_timezone:null},
    {...defaultSettings,quiet_hours_enabled:true},
    {...defaultSettings,quiet_start:'24:00'},{...defaultSettings,quiet_start:'12:60'},
    {...defaultSettings,quiet_start:'12:00+01'},{...defaultSettings,quiet_end:12},
    {...defaultSettings,quiet_end:'08:00:00.1234567'}];
  for(const payload of invalid)await rejected(set(worker,payload,0),'22023');
  for(const revision of [null,-1,'9223372036854775807'])await rejected(set(worker,defaultSettings,revision),'22023');
  await rejected(set(worker,defaultSettings,99),'40001');
  assert.deepEqual(await get(worker),existing);
  assert.deepEqual(snapshot(),noEffects);pass();

  check('FIRST_WRITE_COMPLETE_PAYLOAD_RETRY_AND_REVOCATION_BOUNDARIES');
  const enabled={...defaultSettings,push_enabled:true,quiet_start:'22:00',quiet_end:'08:00'};
  const first=await ok(set(worker,enabled,0));assert.equal(first.revision,1);
  assert.equal(first.settings.quiet_start,'22:00:00');
  assert.deepEqual(await ok(set(worker,enabled,0)),first);
  await rejected(set(worker,{...enabled,responses_enabled:false},0),'40001');
  const revoked=await ok(set(worker,{...first.settings,push_enabled:false},1));assert.equal(revoked.revision,2);
  await rejected(set(worker,enabled,0),'40001');
  await rejected(set(worker,enabled,1),'40001');
  assert.deepEqual(await get(worker),revoked);
  const emptyFirst=await ok(set(requester,defaultSettings,0,'REQUESTER'));assert.equal(emptyFirst.revision,1);
  assert.deepEqual(await ok(set(requester,defaultSettings,0,'REQUESTER')),emptyFirst);
  assert.equal((await get(requester,'WORKER')).exists,false);pass();

  check('CONCURRENT_DISTINCT_COMMANDS_ONE_WINNER_IDENTICAL_COMMANDS_ONE_REVISION');
  let state=await get(worker);
  const race=await Promise.all([set(worker,{...state.settings,responses_enabled:false},state.revision),
    set(worker,{...state.settings,opportunities_enabled:false},state.revision)]);
  assert.equal(race.filter(r=>!r.error).length,1);assert.equal(race.filter(r=>r.error?.code==='40001').length,1);
  const winner=await get(worker);assert.equal(winner.revision,state.revision+1);
  const repeated={...winner.settings,recovery_enabled:false};
  const identical=await Promise.all([ok(set(worker,repeated,winner.revision)),ok(set(worker,repeated,winner.revision))]);
  assert.deepEqual(identical[0],identical[1]);assert.equal(identical[0].revision,winner.revision+1);
  assert.deepEqual(await get(worker),identical[0]);pass();

  check('DIRECT_DML_OTHER_ACCOUNT_AND_SERVICE_REVISION_BOUNDARIES');
  assert.deepEqual(await ok(requester.from('notification_preferences').select('*').eq('user_id',env.RU5_DEVICE_WORKER_USER_ID)),[]);
  for(const client of [worker,requester]){
    await rejected(client.from('notification_preferences').update({quiet_timezone:'USKOCI_INVALID_TIMEZONE'}).eq('user_id',env.RU5_DEVICE_WORKER_USER_ID));
    await rejected(client.from('notification_preferences').delete().eq('user_id',env.RU5_DEVICE_WORKER_USER_ID));
    await rejected(client.from('notification_preferences').insert({user_id:env.RU5_DEVICE_WORKER_USER_ID,role_context:'REQUESTER'}));
  }
  const stable=await get(worker);
  await ok(set(requester,{...defaultSettings,dogovor_enabled:false},0,'WORKER'));
  assert.deepEqual(await get(worker),stable);
  await rejected(service.from('notification_preferences').update({quiet_timezone:'USKOCI_INVALID_TIMEZONE'}).eq('user_id',env.RU5_DEVICE_WORKER_USER_ID),'22023');
  await rejected(service.from('notification_preferences').update({quiet_hours_enabled:true,quiet_start:null}).eq('user_id',env.RU5_DEVICE_WORKER_USER_ID),'22023');
  await rejected(service.from('notification_preferences').update({role_context:'REQUESTER'}).eq('user_id',env.RU5_DEVICE_WORKER_USER_ID),'22023');
  await rejected(service.from('notification_preferences').delete().eq('user_id',env.RU5_DEVICE_WORKER_USER_ID));
  assert.deepEqual(await get(worker),stable);
  await ok(service.from('notification_preferences').update({account_enabled:false,revision:0,updated_at:'2000-01-01T00:00:00Z'})
    .eq('user_id',env.RU5_DEVICE_WORKER_USER_ID).eq('role_context','WORKER'));
  const trusted=await get(worker);assert.equal(trusted.revision,stable.revision+1);
  assert.ok(Date.parse(trusted.updatedAt)>Date.parse('2000-01-02T00:00:00Z'));
  await rejected(set(worker,stable.settings,stable.revision),'40001');
  assert.deepEqual(snapshot(),noEffects);pass();

  check('REAL_COUNTERPART_MESSAGES_RESPECT_PREFERENCES_AND_KEEP_INBOX_TRUTH');
  let seen=(await ok(worker.rpc('rpc_list_inbox',{p_role:'WORKER'}))).unreadCount;
  const scenarios=[
    ['PUSH_OFF',defaultSettings,null,'PUSH_OFF'],
    ['CATEGORY_OFF',{...defaultSettings,push_enabled:true,dogovor_enabled:false},'CATEGORY_OFF','CATEGORY_OFF'],
    ['QUIET_HOURS',{...defaultSettings,push_enabled:true,quiet_hours_enabled:true,quiet_start:'00:00',quiet_end:'00:00'},null,'QUIET_HOURS'],
    ['NORMAL_NEVER_USES_URGENT_OVERRIDE',{...defaultSettings,push_enabled:true,quiet_hours_enabled:true,quiet_start:'00:00',quiet_end:'00:00',urgent_overrides_quiet_hours:true},null,'QUIET_HOURS'],
    ['ELIGIBLE_IS_NOT_SENT',{...defaultSettings,push_enabled:true},null,null],
    ['ALL_CHANNELS_OFF',{...defaultSettings,in_app_enabled:false},'IN_APP_OFF','PUSH_OFF'],
  ];
  for(const [name,settings,inAppReason,pushReason] of scenarios){
    const beforePreference=snapshot();const currentState=await get(worker);
    await ok(set(worker,settings,currentState.revision));
    assert.deepEqual(snapshot(),beforePreference,'settings do not rewrite history');
    const messageId=await ok(message(`N08_PRIVATE_${name}`));
    assert.match(messageId,/^[0-9a-f-]{36}$/i);
    const events=rows(`select id from public.user_activity_events where event_type='MESSAGE_RECEIVED' and payload->>'message_id'='${messageId}'`);
    assert.equal(events.length,1);
    const deliveries=rows(`select channel,state,suppression_reason,title,body from public.notification_deliveries where event_id='${events[0].id}'`);
    assert.equal(deliveries.length,2);
    for(const [channel,reason] of [['IN_APP',inAppReason],['PUSH',pushReason]]){
      const delivery=deliveries.find(d=>d.channel===channel);assert.ok(delivery);
      assert.equal(delivery.state,reason?'SUPPRESSED':'CREATED');assert.equal(delivery.suppression_reason,reason);
      assert.ok(!`${delivery.title}${delivery.body}`.includes('N08_PRIVATE_'));
    }
    const inbox=await ok(worker.rpc('rpc_list_inbox',{p_role:'WORKER'}));
    assert.equal(inbox.unreadCount,++seen);assert.ok(inbox.items.some(i=>i.id===events[0].id));
  }
  pass();

  check('FINAL_PRIVILEGES_FINGERPRINTS_HISTORY_AND_FORBIDDEN_ACTIVATION');
  assert.equal(sql("select md5(jsonb_agg(to_jsonb(m) order by version)::text) from supabase_migrations.schema_migrations m"),history);
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'84');
  for(const role of ['anon','authenticated']){
    for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE'])
      assert.equal(sql(`select has_table_privilege('${role}','public.notification_preferences','${privilege}')`),'f');
  }
  assert.equal(sql("select has_table_privilege('service_role','public.notification_preferences','DELETE')"),'f');
  for(const name of ['rpc_get_notification_preferences(text)','rpc_set_notification_preferences(text,jsonb,bigint)']){
    assert.equal(sql(`select has_function_privilege('authenticated','public.${name}','EXECUTE')`),'t');
    for(const role of ['anon','service_role'])assert.equal(sql(`select has_function_privilege('${role}','public.${name}','EXECUTE')`),'f');
  }
  report.unchanged_engine=rows("select proname,md5(prosrc) prosrc_md5 from pg_proc where oid in ('private.in_quiet_hours(public.notification_preferences)'::regprocedure,'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)'::regprocedure,'public.rpc_send_agreement_message(uuid,text)'::regprocedure) order by proname");
  assert.deepEqual(report.unchanged_engine.map(x=>x.prosrc_md5).sort(),['386e00eb4a7645addffac95fde09bea7','8da91a4736e09b10872bd1240d6e0c8c','d9a3733814e3101a3941284c07dc2bed'].sort());
  report.new_functions=rows("select n.nspname,p.proname,md5(p.prosrc) prosrc_md5,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where proname in ('rpc_get_notification_preferences','rpc_set_notification_preferences','notification_preferences_write_guard','notification_preferences_settings') order by proname");
  assert.equal(report.new_functions.length,4);assert.ok(report.new_functions.every(f=>f.proconfig?.includes('search_path=pg_catalog')));
  for(const table of ['private.publication_policy_bundles','private.need_publication_decisions','private.preselection_qa_questions','private.preselection_qa_commands'])assert.equal(sql(`select count(*) from ${table}`),'0');
  assert.equal(sql('select count(*) from public.notification_push_attempts'),'0');
  assert.equal(sql('select count(*) from public.notification_push_devices where active'),'0');
  assert.equal(sql("select count(*) from public.notification_deliveries where state in ('SENT','DELIVERED')"),'0');
  assert.equal(sql("select count(*) from public.needs where mode='FASTEST'"),'0');
  assert.equal(sql("select count(*) from public.need_selections where selection_mode='AUTO_FILL'"),'0');
  assert.equal(sql("select count(*) from private.connection_activations where policy_key='REQUESTER_SELECTION_V1' and policy_version=1 and platform_cost_rsd=0 and beneficiary_account_id=requester_account_id"),'1');
  report.migration_history_count=84;report.candidate_applied_disposable=true;pass();
  report.result='PASS';console.log('PASS N08_NOTIFICATION_PREFERENCES');
}catch(error){report.result='FAIL';report.failed_check=current;
  report.error=error instanceof assert.AssertionError?'ASSERTION_FAILED':error.message;
  throw error;
}finally{writeFileSync(`${out}/proof-report.json`,JSON.stringify(report,null,2)+'\n');}
