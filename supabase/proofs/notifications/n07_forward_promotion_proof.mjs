// Exact forward-file apply and authenticated coexistence; never production.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const uuid=v=>{assert.match(String(v),/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);return v;};
const workerId=uuid(env.RU5_DEVICE_WORKER_USER_ID),requesterId=uuid(env.RU5_DEVICE_REQUESTER_USER_ID),needId=uuid(env.RU5_DEVICE_NEED_ID);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const out=env.N07_ARTIFACT_DIR||'artifacts/notifications-n07';mkdirSync(out,{recursive:true});
const report={unit:'N07_FORWARD_NOTIFICATION_ADMISSION',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  live_access:false,live_promotion:false,push_provider_called:false,mobile_proof:false,checks:[],applied_disposable:[]};
let current='PREFLIGHT',fault=false;
const check=name=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
function sql(q){try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At','-c',q],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{throw new Error('DISPOSABLE_SQL_FAILED');}}
const rows=q=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${q}) x`));
const ok=async(p)=>{const r=await p;if(r.error)throw new Error('AUTH_RPC_FAILED');return r.data;};
const snapshot=()=>['agreement_messages','user_activity_events','notification_deliveries'].map(name=>sql(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb) from public.${name} x`));
try {
  check('EXACT_FIVE_FORWARD_FILES_APPLY_TO_LIVE79_PREDECESSOR');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'79');
  const provenance=JSON.parse(readFileSync('supabase/migrations/MIGRATION_PROVENANCE.json','utf8'));
  // Immutable source-byte inventory, not a claim that files are still pending
  // in a future session. The historical disposable proof remains reproducible.
  const pending=JSON.parse(readFileSync('supabase/proofs/notifications/n07_forward_files.json','utf8'));
  const registered=[...provenance.pending_forward_migrations,...provenance.live_history_snapshot.entries];
  assert.deepEqual(pending.map(x=>x.unit),['N01','N02','N03','N05','N06']);
  for(const [index,item] of pending.entries()){
    assert.ok(registered.some(entry=>(entry.file||`${entry.version}_${entry.name}.sql`)===item.file));
    assert.match(item.file,/^20260907\d{6}_clean_n\d{2}_[a-z_]+\.sql$/);
    const bytes=readFileSync(`supabase/migrations/${item.file}`);
    assert.equal(createHash('md5').update(bytes).digest('hex'),item.raw_md5);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
    const original=readFileSync(item.candidate_file,'utf8');
    const prefix=`-- Forward admission of canonical ${item.unit}; NOT LIVE until approved promotion.\n-- Embedded candidate comments below are retained pre-admission provenance.\n`;
    assert.equal(bytes.toString('utf8'),prefix+original,'no semantic drift from unit proof');
    execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',`supabase/migrations/${item.file}`],{stdio:'pipe'});
    assert.match(item.version,/^\d{14}$/);assert.match(item.name,/^[a-z0-9_]+$/);
    sql(`insert into supabase_migrations.schema_migrations(version,name) values('${item.version}','${item.name}')`);
    assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')),80+index);
    report.applied_disposable.push({file:item.file,md5:item.raw_md5,sha256:item.sha256,history_count:80+index});
  }
  pass();
  check('REAL_AUTH_SELECTION_MESSAGE_CHANGE_AND_REJECTION_COEXIST');
  for(const [c,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,workerId],[requester,env.RU5_DEVICE_REQUESTER_EMAIL,requesterId]]){
    await ok(c.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(c.auth.getUser())).user.id,id);
  }
  const profile=await ok(worker.from('app_profiles').select('id').eq('account_id',workerId).eq('kind','WORKER').single());
  const need=await ok(worker.from('needs').select('revision').eq('id',needId).single());
  const response=await ok(worker.rpc('rpc_submit_response',{p_need_id:needId,p_need_revision:need.revision,p_worker_profile_id:profile.id,
    p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:`n07-submit-${randomUUID()}`}));
  const selection={p_need_id:needId,p_need_revision:need.revision,p_response_id:response.responseId,p_response_version:response.version,
    p_content_hash:response.contentHash,p_client_request_id:`n07-select-${randomUUID()}`};
  const agreementId=uuid(await ok(requester.rpc('rpc_select_response',selection)));
  const messageId=uuid(await ok(requester.rpc('rpc_send_agreement_message',{p_agreement_id:agreementId,p_body:'PRIVATE_N07_CANARY_MESSAGE'})));
  const proposed={p_agreement_id:agreementId,p_expected_version:1,p_patch:{price_rsd:4321},p_reason:'PRIVATE_N07_CANARY_REASON',p_client_request_id:`n07-propose-${randomUUID()}`};
  const proposalId=uuid(await ok(requester.rpc('rpc_propose_agreement_change_v2',proposed)));
  const accepted=await ok(worker.rpc('rpc_respond_agreement_change',{p_proposal_id:proposalId,p_accept:true}));assert.equal(accepted.agreementVersion,2);
  const reverse=uuid(await ok(worker.rpc('rpc_propose_agreement_change_v2',{...proposed,p_expected_version:2,p_patch:{price_rsd:4500},p_client_request_id:`n07-reverse-${randomUUID()}`})));
  await ok(requester.rpc('rpc_respond_agreement_change',{p_proposal_id:reverse,p_accept:false}));
  const events=rows('select * from public.user_activity_events');assert.equal(events.length,7);
  assert.deepEqual(events.filter(e=>e.event_type==='MESSAGE_RECEIVED').map(e=>e.payload),[{message_id:messageId}]);
  assert.deepEqual(events.filter(e=>e.event_type==='RESPONSE_SELECTED').map(e=>e.payload),[{agreement_id:agreementId,need_id:needId}]);
  assert.ok(!JSON.stringify(rows('select title,body from public.notification_deliveries')).includes('PRIVATE_N07_CANARY'));
  pass();
  check('EVENT_INBOX_OWNER_READ_UNREAD_AND_CURRENT_AGREEMENT_TARGETS');
  const inbox=await ok(worker.rpc('rpc_list_inbox',{p_role:'WORKER'}));assert.equal(inbox.items.length,4);assert.equal(inbox.unreadCount,4);
  assert.equal((await ok(requester.rpc('rpc_list_inbox',{p_role:'REQUESTER'}))).items.length,3);
  for(const item of inbox.items){
    assert.deepEqual(await ok(worker.rpc('rpc_resolve_activity_event',{p_event_id:item.id})),{kind:'AGREEMENT',id:agreementId,role:'WORKER'});
  }
  const reads=await Promise.all([ok(worker.rpc('rpc_mark_activity_event_read',{p_event_id:inbox.items[0].id})),ok(worker.rpc('rpc_mark_activity_event_read',{p_event_id:inbox.items[0].id}))]);
  assert.equal(reads[0],reads[1]);assert.ok((await requester.rpc('rpc_mark_activity_event_read',{p_event_id:inbox.items[0].id})).error);
  await ok(worker.rpc('rpc_mark_inbox_read',{p_through:inbox.asOf,p_role:'WORKER'}));
  assert.equal((await ok(worker.rpc('rpc_list_inbox',{p_role:'WORKER'}))).unreadCount,0);
  assert.equal(sql('select count(*) from public.notification_deliveries where read_at is not null'),'0');
  assert.ok((await anon.rpc('rpc_list_inbox')).error);
  assert.ok((await worker.from('user_activity_events').update({read_at:null}).eq('id',inbox.items[0].id)).error);
  pass();
  check('PUSH_REGISTRY_REVOKE_DOES_NOT_OPT_IN_OR_SEND');
  const token=`ExpoPushToken[n07_${randomUUID().replaceAll('-','')}]`;
  const registration={p_expo_push_token:token,p_platform:'ANDROID',p_active:true,p_expected_revision:0};
  const device=await ok(worker.rpc('rpc_set_push_device',registration));assert.equal(device.revision,1);
  await ok(worker.rpc('rpc_set_push_device',{...registration,p_active:false,p_expected_revision:1}));
  assert.ok((await worker.rpc('rpc_set_push_device',registration)).error);
  assert.equal(sql('select count(*) from public.notification_preferences where push_enabled'),'0');
  assert.equal(sql("select count(*) from public.notification_deliveries where channel='PUSH' and (state<>'SUPPRESSED' or suppression_reason<>'PUSH_OFF')"),'0');
  assert.equal(sql('select count(*) from public.notification_push_attempts'),'0');pass();
  check('COMBINED_EVENT_FAILURE_ROLLBACK_AND_SELECTION_REPLAY');
  const before=snapshot();
  sql("create function private.n07_fault() returns trigger language plpgsql as $f$ begin raise exception 'N07_FORCED_EVENT_FAILURE';end $f$; create trigger n07_fault before insert on public.user_activity_events for each row execute function private.n07_fault();");fault=true;
  assert.ok((await worker.rpc('rpc_send_agreement_message',{p_agreement_id:agreementId,p_body:'ROLLBACK_CANARY'})).error);
  assert.deepEqual(snapshot(),before);
  sql('drop trigger n07_fault on public.user_activity_events;drop function private.n07_fault()');fault=false;
  assert.equal(await ok(requester.rpc('rpc_select_response',selection)),agreementId);assert.deepEqual(snapshot(),before);pass();
  check('FINAL_PRIVILEGES_PROVENANCE_AND_FORBIDDEN_ACTIVATION_POSTFLIGHT');
  for(const table of ['private.publication_policy_bundles','private.need_publication_decisions','private.preselection_qa_questions','private.preselection_qa_commands']) assert.equal(sql(`select count(*) from ${table}`),'0');
  assert.equal(sql("select count(*) from public.needs where mode='FASTEST'"),'0');assert.equal(sql("select count(*) from public.need_selections where selection_mode='AUTO_FILL'"),'0');
  assert.equal(sql("select count(*) from private.connection_activations where policy_key='REQUESTER_SELECTION_V1' and policy_version=1 and platform_cost_rsd=0 and beneficiary_account_id=requester_account_id"),'1');
  for(const table of ['user_activity_events','notification_deliveries','notification_push_devices']){
    for(const privilege of ['INSERT','UPDATE','DELETE']) assert.equal(sql(`select has_table_privilege('authenticated','public.${table}','${privilege}')`),'f');
  }
  report.function_fingerprints=rows("select oid::regprocedure::text signature,md5(prosrc) prosrc_md5,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname in ('rpc_send_agreement_message','rpc_select_response','rpc_list_inbox','rpc_mark_activity_event_read','rpc_mark_inbox_read','rpc_resolve_activity_event','rpc_propose_agreement_change_v2','rpc_respond_agreement_change','rpc_get_push_device','rpc_set_push_device') order by proname");
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));assert.equal(report.migration_history_count,84);
  pass();report.result='PASS';console.log('PASS N07_FORWARD_NOTIFICATION_ADMISSION');
}catch(error){report.result='FAIL';report.failed_check=current;console.error('FAIL N07',current,error.message);process.exitCode=1;
}finally{if(fault)sql('drop trigger n07_fault on public.user_activity_events;drop function private.n07_fault()');writeFileSync(`${out}/proof-report.json`,JSON.stringify(report,null,2)+'\n');}
