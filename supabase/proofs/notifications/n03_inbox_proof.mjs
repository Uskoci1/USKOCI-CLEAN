import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash,randomUUID } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,dbUrl=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,dbUrl);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const anonymous=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const uuid=(v)=>{assert.match(String(v),/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);return v;};
const workerId=uuid(env.RU5_DEVICE_WORKER_USER_ID),requesterId=uuid(env.RU5_DEVICE_REQUESTER_USER_ID);
const needId=uuid(env.RU5_DEVICE_NEED_ID);
const path=fileURLToPath(new URL('./n03_inbox_candidate.sql',import.meta.url));
const out=env.N03_ARTIFACT_DIR||'artifacts/notifications-n03';
mkdirSync(out,{recursive:true});
const report={unit:'N03_EVENT_INBOX',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  candidate_sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),
  live_access:false,live_promotion:false,push_provider_called:false,mobile_proof:false,checks:[]};
let current='PREFLIGHT';
function psql(sql){try{return execFileSync('psql',[dbUrl,'-X','-v','ON_ERROR_STOP=1','-At','-c',sql],
  {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{throw new Error('LOCAL_SQL_FAILED');}}
async function ok(p){const r=await p;if(r.error)throw new Error('AUTHENTICATED_REQUEST_FAILED');return r.data;}
const check=(n)=>{current=n;console.log(`START_CHECK ${n}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
const list=(client,args={})=>ok(client.rpc('rpc_list_inbox',args));
const deliverySnapshot=()=>psql('select coalesce(json_agg(d order by id),\'[]\'::json) from public.notification_deliveries d');
function emit(recipient,role='WORKER',entity=needId){
  return uuid(psql(`select private.emit_event('${uuid(recipient)}','${role}','NEED_REVISED','NEED',
    '${uuid(entity)}',1,'Zadatak je izmenjen','Proverite aktuelne informacije.',
    'n03:${randomUUID()}','NORMAL','{}'::jsonb)`));
}
try{
  check('DISPOSABLE_APPLY_AND_REAL_AUTH');
  assert.equal(psql('select count(*) from supabase_migrations.schema_migrations'),'79');
  execFileSync('psql',[dbUrl,'-X','-v','ON_ERROR_STOP=1','-f',path],{stdio:'pipe'});
  for(const [client,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,workerId],
    [requester,env.RU5_DEVICE_REQUESTER_EMAIL,requesterId]]){
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
    assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  pass();
  check('EMPTY_IS_AUTHORIZED_SERVER_TRUTH');
  const empty=await list(worker);
  assert.deepEqual(empty.items,[]);assert.equal(empty.unreadCount,0);assert.equal(empty.hasMore,false);
  assert.ok((await anonymous.rpc('rpc_list_inbox')).error);
  for(const args of [{p_role:'ADMIN'},{p_limit:0},{p_limit:101},{p_before_id:randomUUID()}])
    assert.ok((await worker.rpc('rpc_list_inbox',args)).error);
  pass();

  check('ONE_EVENT_TWO_CHANNELS_ROLE_AND_SAFE_COPY');
  await ok(worker.from('notification_preferences').upsert({user_id:workerId,role_context:'WORKER',
    in_app_enabled:false,push_enabled:false},{onConflict:'user_id,role_context'}));
  const ids=[emit(workerId),emit(workerId),emit(workerId)];
  const otherRole=emit(workerId,'REQUESTER');
  const foreign=emit(requesterId,'REQUESTER');
  // Equal-timestamp fixtures force UUID tie-break pagination to be exercised.
  psql(`update public.user_activity_events set created_at='2026-01-01T12:00:00Z'
    where recipient_user_id='${workerId}';`);
  const all=await list(worker);
  assert.equal(all.items.length,4);assert.equal(all.unreadCount,4);
  assert.equal(psql(`select count(*) from public.notification_deliveries where recipient_user_id='${workerId}'`),'8');
  assert.equal((await list(worker,{p_role:'WORKER'})).items.length,3);
  assert.equal((await list(worker,{p_role:'REQUESTER'})).items.length,1);
  for(const item of all.items){
    assert.equal(item.title,'Zadatak je izmenjen');assert.equal(item.body,'Proverite aktuelne informacije.');
    assert.equal(item.readAt,null);assert.ok(!('payload'in item));assert.ok(!('recipient_user_id'in item));
  }
  assert.equal((await list(requester)).items.length,1);
  pass();

  check('KEYSET_PAGINATION_NO_DUPLICATE_OR_SKIP');
  const first=await list(worker,{p_limit:2});assert.equal(first.hasMore,true);
  const last=first.items.at(-1);
  const second=await list(worker,{p_limit:2,p_before_at:last.occurredAt,p_before_id:last.id});
  assert.equal(second.hasMore,false);
  const collected=[...first.items,...second.items].map(x=>x.id);
  assert.equal(new Set(collected).size,4);assert.deepEqual(collected,all.items.map(x=>x.id));
  pass();

  check('OWNER_ONLY_IDEMPOTENT_READ_NO_DELIVERY_MUTATION');
  const beforeDelivery=deliverySnapshot();
  assert.ok((await requester.rpc('rpc_mark_activity_event_read',{p_event_id:ids[0]})).error);
  assert.ok((await worker.rpc('rpc_mark_activity_event_read',{p_event_id:foreign})).error);
  assert.ok((await anonymous.rpc('rpc_mark_activity_event_read',{p_event_id:ids[0]})).error);
  const reads=await Promise.all([worker.rpc('rpc_mark_activity_event_read',{p_event_id:ids[0]}),
    worker.rpc('rpc_mark_activity_event_read',{p_event_id:ids[0]})]);
  assert.ok(reads.every(r=>!r.error));assert.equal(reads[0].data,reads[1].data);
  assert.equal(await ok(worker.rpc('rpc_mark_activity_event_read',{p_event_id:ids[0]})),reads[0].data);
  assert.equal((await list(worker)).unreadCount,3);assert.equal(deliverySnapshot(),beforeDelivery);
  assert.ok((await worker.from('user_activity_events').update({read_at:null}).eq('id',ids[0])).error);
  assert.ok((await worker.from('notification_deliveries').update({state:'READ'}).eq('event_id',ids[0])).error);
  pass();

  check('MARK_ALL_ROLE_AND_CUTOFF_KEEP_NEW_ARRIVALS_UNREAD');
  const fresh=emit(workerId);
  const boundary='2026-01-02T00:00:00Z';
  assert.equal(await ok(worker.rpc('rpc_mark_inbox_read',{p_through:boundary,p_role:'WORKER'})),2);
  assert.equal(await ok(worker.rpc('rpc_mark_inbox_read',{p_through:boundary,p_role:'WORKER'})),0);
  const unread=(await list(worker)).items.filter(x=>x.readAt===null).map(x=>x.id).sort();
  assert.deepEqual(unread,[fresh,otherRole].sort());
  assert.equal((await list(requester)).unreadCount,1);
  assert.equal(deliverySnapshot()===beforeDelivery,false); // New event created two new deliveries, not read mutations.
  const afterArrival=deliverySnapshot();
  assert.equal(await ok(worker.rpc('rpc_mark_inbox_read',{p_through:boundary})),1);
  assert.equal(deliverySnapshot(),afterArrival);
  for(const args of [{p_through:'2999-01-01T00:00:00Z'},{p_through:null},{p_through:boundary,p_role:'ADMIN'}])
    assert.ok((await worker.rpc('rpc_mark_inbox_read',args)).error);
  pass();

  check('TAP_REAUTHORIZES_ENTITY_NO_PAYLOAD_ROUTE_TRUST');
  const target=await ok(worker.rpc('rpc_resolve_activity_event',{p_event_id:ids[0]}));
  assert.deepEqual(target,{kind:'OPPORTUNITY',id:needId,role:'WORKER'});
  assert.deepEqual(await ok(requester.rpc('rpc_resolve_activity_event',{p_event_id:foreign})),
    {kind:'OWN_NEED',id:needId,role:'REQUESTER'});
  assert.ok((await requester.rpc('rpc_resolve_activity_event',{p_event_id:ids[0]})).error);
  const stale=emit(workerId,'WORKER',randomUUID());
  psql(`update public.user_activity_events set payload='{"route":"/admin","agreement_id":"${randomUUID()}"}'::jsonb where id='${stale}'`);
  assert.deepEqual(await ok(worker.rpc('rpc_resolve_activity_event',{p_event_id:stale})),{kind:'UNAVAILABLE'});
  pass();

  check('REAL_APPLICATION_AND_AGREEMENT_TARGET_BINDINGS');
  const need=await ok(worker.from('needs').select('revision').eq('id',needId).single());
  const profile=await ok(worker.from('app_profiles').select('id').eq('account_id',workerId).eq('kind','WORKER').single());
  const response=await ok(worker.rpc('rpc_submit_response',{p_need_id:needId,p_need_revision:need.revision,
    p_worker_profile_id:uuid(profile.id),p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,
    p_proposed_end_at:null,p_scope_note:null,p_client_request_id:`n03-submit-${randomUUID()}`}));
  const responseId=uuid(response.responseId);
  const responseEvent=uuid(psql(`select private.emit_event('${workerId}','WORKER','RESPONSE_VIEWED',
    'RESPONSE','${responseId}',${Number(response.version)},'Prijava je pregledana','Proverite prijavu.',
    'n03-response:${randomUUID()}','NORMAL','{}'::jsonb)`));
  assert.deepEqual(await ok(worker.rpc('rpc_resolve_activity_event',{p_event_id:responseEvent})),
    {kind:'APPLICATIONS',id:responseId,role:'WORKER'});
  const candidateEvent=uuid(psql(`select private.emit_event('${requesterId}','REQUESTER','RESPONSE_RECEIVED',
    'RESPONSE','${responseId}',${Number(response.version)},'Nova prijava','Proverite prijavu.',
    'n03-candidate:${randomUUID()}','NORMAL','{}'::jsonb)`));
  assert.deepEqual(await ok(requester.rpc('rpc_resolve_activity_event',{p_event_id:candidateEvent})),
    {kind:'CANDIDATES',id:needId,role:'REQUESTER'});
  const agreementId=uuid(await ok(requester.rpc('rpc_select_response',{p_need_id:needId,p_need_revision:need.revision,
    p_response_id:responseId,p_response_version:response.version,p_content_hash:response.contentHash,
    p_client_request_id:`n03-select-${randomUUID()}`})));
  assert.deepEqual(await ok(worker.rpc('rpc_resolve_activity_event',{p_event_id:responseEvent})),
    {kind:'AGREEMENT',id:agreementId,role:'WORKER'});
  const agreementEvent=uuid(psql(`select private.emit_event('${workerId}','WORKER','MESSAGE_RECEIVED',
    'AGREEMENT','${agreementId}',1,'Nova poruka','Otvorite Dogovor.',
    'n03-agreement:${randomUUID()}','NORMAL','{}'::jsonb)`));
  assert.deepEqual(await ok(worker.rpc('rpc_resolve_activity_event',{p_event_id:agreementEvent})),
    {kind:'AGREEMENT',id:agreementId,role:'WORKER'});
  pass();

  check('FINAL_PRIVILEGES_AND_NO_ACTIVATION');
  for(const fn of ['rpc_list_inbox(text,integer,timestamptz,uuid)','rpc_mark_activity_event_read(uuid)',
    'rpc_mark_inbox_read(timestamptz,text)','rpc_resolve_activity_event(uuid)']){
    assert.equal(psql(`select has_function_privilege('anon','public.${fn}','EXECUTE')`),'f');
    assert.equal(psql(`select has_function_privilege('authenticated','public.${fn}','EXECUTE')`),'t');
  }
  assert.equal(psql("select prosecdef from pg_proc where oid='public.rpc_resolve_activity_event(uuid)'::regprocedure"),'f');
  assert.equal(psql('select count(*) from public.notification_push_attempts'),'0');
  assert.equal(psql('select count(*) from private.connection_activations'),'1');
  assert.equal(psql('select count(*) from private.connection_activations where platform_cost_rsd<>0'),'0');
  assert.equal(psql('select count(*) from private.publication_policy_bundles'),'0');
  assert.equal(psql('select count(*) from private.preselection_qa_questions'),'0');
  assert.equal(psql('select count(*) from supabase_migrations.schema_migrations'),'79');
  report.migration_history_count=79;pass();report.result='PASS';
  console.log('PASS N03_INBOX_AUTHENTICATED_PROOF');
}catch(error){
  report.result='FAIL';report.failed_check=current;
  report.failure_type=error instanceof assert.AssertionError?'ASSERTION':'OPERATION';
  console.error(`FAIL N03_INBOX_AUTHENTICATED_PROOF check=${current} type=${report.failure_type}`);process.exitCode=1;
}finally{writeFileSync(`${out}/proof-report.json`,`${JSON.stringify(report,null,2)}\n`);}
