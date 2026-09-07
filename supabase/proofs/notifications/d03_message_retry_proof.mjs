// D03 authenticated stable-message proof. Disposable loopback only.
import assert from 'node:assert/strict';
import {execFileSync,execFile} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {createClient} from '@supabase/supabase-js';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const out=env.D03_ARTIFACT_DIR||'artifacts/d03-message-retry';mkdirSync(out,{recursive:true});
const report={unit:'D03_MESSAGE_RETRY',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  live_access:false,live_promotion:false,provider_called:false,mobile_proof:false,checks:[]};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const outsider=createClient(url,env.RU5_DEVICE_ANON_KEY,options),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const manifest=JSON.parse(readFileSync('supabase/proofs/notifications/d03_message_retry_files.json','utf8'));
const forward=`supabase/migrations/${manifest.forward_file}`,bytes=readFileSync(forward);
assert.deepEqual(bytes,readFileSync(manifest.candidate_file));
assert.equal(bytes.length,manifest.bytes);assert.equal(createHash('md5').update(bytes).digest('hex'),manifest.md5);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);report.forward=manifest;
const wid=env.RU5_DEVICE_WORKER_USER_ID,rid=env.RU5_DEVICE_REQUESTER_USER_ID;
const validUuid=v=>{assert.match(String(v),/^[0-9a-f-]{36}$/i);return v;};validUuid(wid);validUuid(rid);
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(query){try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At','-c',query],
  {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{throw new Error('DISPOSABLE_SQL_FAILED');}}
const rows=query=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));
const ok=async promise=>{const r=await promise;if(r.error)throw new Error('AUTH_RPC_FAILED');return r.data;};
async function rejected(promise,code,message){const r=await promise;assert.ok(r.error);if(code)assert.equal(r.error.code,code);if(message)assert.equal(r.error.message,message);return r.error;}
const owner=c=>c===worker?wid:rid;
const send=(c,agreement,key,body,expected=owner(c))=>c.rpc('rpc_send_agreement_message_v2',{
  p_expected_user_id:expected,p_agreement_id:agreement,p_client_message_id:key,p_body:body});
const snapshot=()=>Object.fromEntries(['agreement_messages','user_activity_events','notification_deliveries']
  .map(table=>[table,sql(`select count(*)||':'||md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from public.${table} x`)]));
const counts=()=>rows("select (select count(*) from public.agreement_messages)::int messages,(select count(*) from public.user_activity_events where event_type='MESSAGE_RECEIVED')::int message_events,(select count(*) from public.notification_deliveries d join public.user_activity_events e on e.id=d.event_id where e.event_type='MESSAGE_RECEIVED')::int message_deliveries")[0];
function grew(before,n){assert.deepEqual(counts(),{messages:before.messages+n,message_events:before.message_events+n,message_deliveries:before.message_deliveries+n*2});}
let current='PREFLIGHT',fault=false,history;
const check=name=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
function asyncSql(application,query){return new Promise(resolve=>{
  execFile('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At','-c',
    `set application_name=${q(application)};set statement_timeout='8s';${query}`],{encoding:'utf8',maxBuffer:1024*1024},
    (error,stdout,stderr)=>resolve({success:!error,stdout,stderr}));
});}
const authSql=(uid,query)=>`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(uid)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:uid,role:'authenticated'}))},true);${query};commit;`;
const v2Sql=(agreement,key,body)=>`select public.rpc_send_agreement_message_v2(${q(rid)},${q(agreement)},${q(key)},${q(body)})`;
async function waitActivity(application,condition){
  for(let i=0;i<40;i++){
    if(sql(`select count(*) from pg_stat_activity where application_name=${q(application)} and (${condition})`)==='1')return;
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  assert.fail('expected controlled transaction state was not observed');
}
async function waitAdvisoryContention(holder,waiter){
  for(let i=0;i<40;i++){
    const observed=rows(`select w.wait_event_type,w.wait_event,
      h.wait_event holder_wait_event,h.pid=any(pg_blocking_pids(w.pid)) blocked_by_holder,
      exists(select 1 from pg_locks l where l.pid=w.pid and l.locktype='advisory' and not l.granted) advisory_lock_pending
      from pg_stat_activity w cross join pg_stat_activity h
      where w.application_name=${q(waiter)} and h.application_name=${q(holder)}`)[0];
    if(observed?.wait_event_type==='Lock'&&observed.wait_event==='advisory'
      &&observed.holder_wait_event==='PgSleep'&&observed.blocked_by_holder&&observed.advisory_lock_pending)return observed;
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  assert.fail('same-key waiter was not observed blocked by the holder advisory lock');
}
const lastSqlUuid=result=>validUuid(result.stdout.split(/\r?\n/).filter(line=>/^[0-9a-f-]{36}$/i.test(line)).at(-1));
// Same narrowly scoped disposable Need seed used by the admitted device proof;
// response and selection still run through actual authenticated domain RPCs.
async function anotherAgreement(){
  const need=randomUUID();
  const rp=await ok(requester.from('app_profiles').select('id').eq('account_id',rid).eq('kind','REQUESTER').single());
  const wp=await ok(worker.from('app_profiles').select('id').eq('account_id',wid).eq('kind','WORKER').single());
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,response_deadline,published_at) values(${q(need)},${q(rid)},${q(rp.id)},'PUBLISHED','D03 disposable fixture','D03 scoped concurrency fixture','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
  const response=await ok(worker.rpc('rpc_submit_response',{p_need_id:need,p_need_revision:1,p_worker_profile_id:wp.id,
    p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:`d03-submit-${randomUUID()}`}));
  return validUuid(await ok(requester.rpc('rpc_select_response',{p_need_id:need,p_need_revision:1,p_response_id:response.responseId,
    p_response_version:response.version,p_content_hash:response.contentHash,p_client_request_id:`d03-select-${randomUUID()}`})));
}
try{
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'85');
  for(const [c,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,wid],[requester,env.RU5_DEVICE_REQUESTER_EMAIL,rid]]){
    await ok(c.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(c.auth.getUser())).user.id,id);
  }
  const outsiderEmail=`d03-outsider-${randomUUID()}@proof.invalid`,password=`D03${randomUUID()}Aa1`;
  const outsiderUser=(await ok(admin.auth.admin.createUser({email:outsiderEmail,password,email_confirm:true}))).user;
  await ok(outsider.auth.signInWithPassword({email:outsiderEmail,password}));assert.equal((await ok(outsider.auth.getUser())).user.id,outsiderUser.id);
  const agreement=(await ok(requester.from('agreements').select('id').single())).id;
  const second=await anotherAgreement();
  {
  check('PREDECESSOR_REPEATED_SEND_CREATES_DISTINCT_MESSAGES_AND_EVENTS');
  const beforeLegacy=counts();
  const legacy=()=>requester.rpc('rpc_send_agreement_message',{p_agreement_id:agreement,p_body:'D03_PRIVATE_RETRY_INTENT'});
  const firstLegacy=validUuid(await ok(legacy())),secondLegacy=validUuid(await ok(legacy()));assert.notEqual(firstLegacy,secondLegacy);grew(beforeLegacy,2);
  report.predecessor={message_columns:rows("select attname,format_type(atttypid,atttypmod) type from pg_attribute where attrelid='public.agreement_messages'::regclass and attnum>0 and not attisdropped order by attnum"),
    n01_body_md5:sql("select md5(prosrc) from pg_proc where oid='public.rpc_send_agreement_message(uuid,text)'::regprocedure"),repeat_created_messages:2,repeat_created_events:2};
  assert.equal(report.predecessor.message_columns.length,7);assert.equal(report.predecessor.n01_body_md5,'d9a3733814e3101a3941284c07dc2bed');pass();
  }

  {
  check('EXACT_FORWARD_APPLY_PRESERVES_ALL85_HISTORY_AND_OLD_MESSAGE_ROWS');
  history=sql("select md5(jsonb_agg(to_jsonb(m) order by version)::text) from supabase_migrations.schema_migrations m");
  const oldMessages=sql("select md5(jsonb_agg(to_jsonb(m) order by id)::text) from public.agreement_messages m");
  const oldCounts=counts();
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',forward],{stdio:'pipe'});
  sql(`insert into supabase_migrations.schema_migrations(version,name) values(${q(manifest.forward_version)},${q(manifest.forward_name)})`);
  assert.equal(sql("select md5(jsonb_agg(to_jsonb(m)-'client_message_id' order by id)::text) from public.agreement_messages m"),oldMessages);
  assert.equal(sql('select count(*) from public.agreement_messages where client_message_id is not null'),'0');assert.deepEqual(counts(),oldCounts);
  sql("notify pgrst,'reload schema'");let ready=false;
  for(let i=0;i<40;i++){const r=await send(requester,agreement,'d03-ready-key','',rid);if(r.error?.message==='MESSAGE_REQUIRED'){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(ready);pass();
  }

  {
  check('AUTHENTICATED_OWNER_COUNTERPART_OUTSIDER_AND_TOKEN_SWITCH_BOUNDARIES');
  const stable=snapshot();
  await rejected(send(anon,agreement,'d03-anon-key','private',rid));
  await rejected(send(admin,agreement,'d03-service-key','private',rid));
  await rejected(send(outsider,agreement,'d03-outsider-key','private',outsiderUser.id),'42501','NOT_PARTY');
  for(const expected of [rid,null])await rejected(send(worker,agreement,'d03-account-switch','private',expected),'28000','AUTH_CONTEXT_CHANGED');
  await rejected(send(requester,randomUUID(),'d03-absent-agreement','private'),'P0002','AGREEMENT_NOT_FOUND');
  assert.deepEqual(snapshot(),stable);assert.deepEqual(await ok(outsider.from('agreement_messages').select('id')),[]);pass();
  }

  {
  check('STRICT_KEY_BODY_AND_UNICODE_BOUNDARIES_RETAIN_NO_FAILED_COMMAND');
  const stable=snapshot();
  for(const key of [null,'','short','a'.repeat(201),'bad/key-value','d03-valid-key\n','d03-valid-key\r','d03-valid-key ','_d03-key-value'])
    await rejected(send(requester,agreement,key,'private'),'22023','INVALID_CLIENT_MESSAGE_ID');
  for(const body of [null,'','   '])await rejected(send(requester,agreement,'d03-empty-body',body),'P0001','MESSAGE_REQUIRED');
  for(const body of ['a'.repeat(2001),'😀'.repeat(2001)])await rejected(send(requester,agreement,'d03-too-long',body),'22001','MESSAGE_TOO_LONG');
  for(const body of ['\0','\uD800','\uDC00'])await rejected(send(requester,agreement,'d03-invalid-unicode',body));
  assert.deepEqual(snapshot(),stable);
  const before=counts();const unicode=await ok(send(requester,agreement,'d03-unicode-2000','😀'.repeat(2000)));validUuid(unicode);grew(before,1);
  assert.equal(sql(`select char_length(body) from public.agreement_messages where id=${q(unicode)}`),'2000');pass();
  }

  {
  check('SAME_IMMUTABLE_COMMAND_ACKNOWLEDGES_ONCE_FOR_BOTH_PARTICIPANTS');
  const before=counts();
  const id=validUuid(await ok(send(requester,agreement,'d03-stable-retry','  D03_PRIVATE_SAME_COMMAND  ')));
  const after=snapshot();assert.equal(await ok(send(requester,agreement,'d03-stable-retry','D03_PRIVATE_SAME_COMMAND')),id);assert.deepEqual(snapshot(),after);grew(before,1);
  const counterpart=validUuid(await ok(send(worker,agreement,'d03-stable-retry','D03_PRIVATE_COUNTERPART')));assert.notEqual(counterpart,id);grew(before,2);
  assert.equal(await ok(send(worker,agreement,'d03-stable-retry','D03_PRIVATE_COUNTERPART')),counterpart);
  for(const client of [worker,requester])assert.equal((await ok(client.from('agreement_messages').select('id').eq('id',id).single())).id,id);
  const event=rows(`select id,payload,recipient_user_id from public.user_activity_events where event_type='MESSAGE_RECEIVED' and payload->>'message_id'=${q(id)}`);
  assert.equal(event.length,1);assert.equal(event[0].recipient_user_id,wid);assert.deepEqual(event[0].payload,{message_id:id});assert.ok(!JSON.stringify(event).includes('D03_PRIVATE'));
  assert.ok(!JSON.stringify(rows(`select title,body from public.notification_deliveries where event_id=${q(event[0].id)}`)).includes('D03_PRIVATE'));
  report.safe_acknowledgment={messageId:id,identicalRetryMessageId:id,counterpartMessageId:counterpart};pass();
  }

  {
  check('GLOBAL_SENDER_KEY_REJECTS_CHANGED_BODY_OR_AGREEMENT');
  const stable=snapshot();await rejected(send(requester,agreement,'d03-stable-retry','different'),'40001','MESSAGE_COMMAND_CONFLICT');
  await rejected(send(requester,second,'d03-stable-retry','D03_PRIVATE_SAME_COMMAND'),'40001','MESSAGE_COMMAND_CONFLICT');
  assert.deepEqual(snapshot(),stable);pass();
  }

  {
  check('OBSERVED_ADVISORY_CONTENTION_REPLAYS_ONCE_OR_REJECTS_CHANGED_BODY');
  let before=counts();const same=await Promise.all([ok(send(requester,agreement,'d03-concurrent-same','D03_PRIVATE_RACE')),ok(send(requester,agreement,'d03-concurrent-same','D03_PRIVATE_RACE'))]);
  assert.equal(same[0],same[1]);grew(before,1);before=counts();
  const different=await Promise.all([send(requester,agreement,'d03-concurrent-different','D03_PRIVATE_LEFT'),send(requester,agreement,'d03-concurrent-different','D03_PRIVATE_RIGHT')]);
  assert.equal(different.filter(r=>!r.error).length,1);assert.equal(different.filter(r=>r.error?.code==='40001').length,1);grew(before,1);
  report.command_lock_contention=[];
  for(const changedBody of [false,true]){
    const suffix=changedBody?'conflict':'identical',key=`d03-held-${suffix}`;
    const holder=`d03-key-holder-${suffix}`,waiter=`d03-key-waiter-${suffix}`,body='D03_PRIVATE_HELD_COMMAND';
    before=counts();
    const held=asyncSql(holder,authSql(rid,`${v2Sql(agreement,key,body)};select pg_sleep(2)`));
    await waitActivity(holder,"wait_event='PgSleep'");
    const waiting=asyncSql(waiter,authSql(rid,v2Sql(agreement,key,changedBody?'D03_PRIVATE_CHANGED_COMMAND':body)));
    const observed=await waitAdvisoryContention(holder,waiter);
    const committed=await held;assert.ok(committed.success);const originalId=lastSqlUuid(committed);
    const acknowledged=await waiting;
    if(changedBody){assert.equal(acknowledged.success,false);assert.match(acknowledged.stderr,/40001/);assert.match(acknowledged.stderr,/MESSAGE_COMMAND_CONFLICT/);}
    else{assert.ok(acknowledged.success);assert.equal(lastSqlUuid(acknowledged),originalId);}
    grew(before,1);
    assert.deepEqual(rows(`select id,body from public.agreement_messages where sender_account_id=${q(rid)} and client_message_id=${q(key)}`),[{id:originalId,body}]);
    report.command_lock_contention.push({payload:changedBody?'CHANGED':'IDENTICAL',observed,
      outcome:changedBody?'40001_MESSAGE_COMMAND_CONFLICT':'ORIGINAL_UUID',message_delta:1,event_delta:1,delivery_delta:2});
  }
  pass();
  }

  {
  check('EVENT_FAILURE_ROLLS_BACK_MESSAGE_KEY_AND_DELIVERY_THEN_RETRY_SUCCEEDS');
  const stable=snapshot(),before=counts();
  sql("create function private.d03_fault() returns trigger language plpgsql as $f$ begin raise exception 'D03_FORCED_EVENT_FAILURE';end $f$;create trigger d03_fault before insert on public.user_activity_events for each row execute function private.d03_fault();");fault=true;
  await rejected(send(requester,agreement,'d03-atomic-retry','D03_PRIVATE_ATOMIC'));
  assert.deepEqual(snapshot(),stable);assert.equal(sql("select count(*) from public.agreement_messages where client_message_id='d03-atomic-retry'"),'0');
  sql('drop trigger d03_fault on public.user_activity_events;drop function private.d03_fault()');fault=false;
  const id=await ok(send(requester,agreement,'d03-atomic-retry','D03_PRIVATE_ATOMIC'));assert.equal(await ok(send(requester,agreement,'d03-atomic-retry','D03_PRIVATE_ATOMIC')),id);grew(before,1);pass();
  }

  {
  check('MESSAGE_FIRST_SERIALIZES_LIFECYCLE_THEN_TERMINAL_REPLAY_ACKNOWLEDGES');
  const before=counts();const held=asyncSql('d03-message-hold',authSql(rid,`${v2Sql(agreement,'d03-lifecycle-message-first','D03_PRIVATE_MESSAGE_FIRST')};select pg_sleep(2)`));
  await waitActivity('d03-message-hold',"wait_event='PgSleep'");
  const completed=asyncSql('d03-completion-wait',authSql(rid,`select public.rpc_confirm_completion(${q(agreement)})`));
  await waitActivity('d03-completion-wait',"wait_event_type='Lock'");
  assert.ok((await held).success);assert.ok((await completed).success);grew(before,1);
  assert.equal(sql(`select status from public.agreements where id=${q(agreement)}`),'COMPLETED');
  const id=sql("select id from public.agreement_messages where client_message_id='d03-lifecycle-message-first'");
  const stable=snapshot();assert.equal(await ok(send(requester,agreement,'d03-lifecycle-message-first','D03_PRIVATE_MESSAGE_FIRST')),id);
  await rejected(send(requester,agreement,'d03-terminal-new','new'),'P0001','CHAT_NOT_AVAILABLE');assert.deepEqual(snapshot(),stable);pass();
  }

  {
  check('LIFECYCLE_FIRST_BLOCKS_NEW_MESSAGE_UNTIL_READ_ONLY_STATE_IS_VISIBLE');
  const prior=validUuid(await ok(send(requester,second,'d03-before-completion','D03_PRIVATE_BEFORE_COMPLETION')));
  const stable=snapshot();
  const held=asyncSql('d03-completion-hold',authSql(rid,`select public.rpc_confirm_completion(${q(second)});select pg_sleep(2)`));
  await waitActivity('d03-completion-hold',"wait_event='PgSleep'");
  const waiting=asyncSql('d03-message-wait',authSql(rid,v2Sql(second,'d03-after-completion','D03_PRIVATE_AFTER_COMPLETION')));
  await waitActivity('d03-message-wait',"wait_event_type='Lock'");
  assert.ok((await held).success);const denied=await waiting;assert.equal(denied.success,false);assert.match(denied.stderr,/CHAT_NOT_AVAILABLE/);
  assert.equal(await ok(send(requester,second,'d03-before-completion','D03_PRIVATE_BEFORE_COMPLETION')),prior);assert.deepEqual(snapshot(),stable);
  report.lifecycle_lock_order={message_first:'COMPLETION_WAITED_THEN_COMMITTED',completion_first:'MESSAGE_WAITED_THEN_CHAT_NOT_AVAILABLE',terminal_exact_retry:'ORIGINAL_UUID_NO_NEW_EVENT'};pass();
  }

  {
  check('FINAL_DML_RLS_FUNCTION_HISTORY_AND_GATES_PRESERVED');
  const stable=snapshot();
  for(const client of [worker,requester,outsider,anon]){
    await rejected(client.from('agreement_messages').insert({agreement_id:second,agreement_version:1,sender_account_id:rid,body:'D03_PRIVATE_DIRECT',client_message_id:'d03-direct-insert'}));
    const update=await client.from('agreement_messages').update({body:'D03_PRIVATE_DIRECT',client_message_id:'d03-direct-update'}).eq('agreement_id',second);
    const remove=await client.from('agreement_messages').delete().eq('agreement_id',second);
    if(client!==anon){assert.ok(update.error);assert.ok(remove.error);} // anon has no row policy; zero-row DML is also denied authority.
  }
  assert.deepEqual(snapshot(),stable);
  assert.equal(sql(`select md5(jsonb_agg(to_jsonb(m) order by version)::text) from supabase_migrations.schema_migrations m where version<>${q(manifest.forward_version)}`),history);
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'86');
  assert.equal(sql("select md5(prosrc) from pg_proc where oid='public.rpc_send_agreement_message(uuid,text)'::regprocedure"),'d9a3733814e3101a3941284c07dc2bed');
  report.new_function=rows("select md5(prosrc) body_md5,prosecdef,proconfig from pg_proc where oid='public.rpc_send_agreement_message_v2(uuid,uuid,text,text)'::regprocedure")[0];
  assert.equal(report.new_function.prosecdef,true);assert.deepEqual(report.new_function.proconfig,['search_path=pg_catalog']);
  for(const role of ['anon','service_role'])assert.equal(sql(`select has_function_privilege('${role}','public.rpc_send_agreement_message_v2(uuid,uuid,text,text)','EXECUTE')`),'f');
  assert.equal(sql("select has_function_privilege('authenticated','public.rpc_send_agreement_message_v2(uuid,uuid,text,text)','EXECUTE')"),'t');
  for(const table of ['private.publication_policy_bundles','private.need_publication_decisions','private.preselection_qa_questions','private.preselection_qa_commands','public.notification_push_attempts'])assert.equal(sql(`select count(*) from ${table}`),'0');
  assert.equal(sql("select count(*) from public.notification_deliveries where state in ('SENT','DELIVERED')"),'0');
  assert.equal(sql("select count(*) from public.needs where mode='FASTEST'"),'0');assert.equal(sql("select count(*) from public.need_selections where selection_mode='AUTO_FILL'"),'0');
  assert.equal(sql("select count(*) from private.connection_policy_versions where platform_cost_rsd<>0"),'0');assert.equal(sql("select value->>'enabled' from private.marketplace_config where key='urgent_activation_policy'"),'false');
  report.migration_history_count=86;report.original85_history_unchanged=true;report.old_message_rows_preserved_on_apply=true;report.exact_forward_file_applied_disposable=true;pass();
  }
  report.result='PASS';console.log('PASS D03_MESSAGE_RETRY');
}catch(error){report.result='FAIL';report.failed_check=current;report.error=error instanceof assert.AssertionError?'ASSERTION_FAILED':error.message;throw error;}
finally{if(fault)sql('drop trigger d03_fault on public.user_activity_events;drop function private.d03_fault()');writeFileSync(`${out}/proof-report.json`,JSON.stringify(report,null,2)+'\n');}
