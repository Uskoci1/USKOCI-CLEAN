// Dedicated loopback Auth/Postgres + actual Edge; Expo is intercepted synthetic IO.
// Never admit DEV URLs, upload credentials/fixtures, rebind a certificate or claim device delivery.
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {migrationSnapshotQuery} from '../pre_v3/history_snapshot.mjs';
import {loadPushHandler} from '../notifications/n09_push_transport_runtime.mjs';

const env=process.env;
const beginSignature='public.rpc_begin_push_send(uuid,uuid)';
const targetSignature='public.rpc_resolve_activity_message_v1(uuid,uuid)';
const candidatePath='supabase/candidates/chat_p4_push_event_transport.sql';
const resolverPath='supabase/candidates/chat_p4_exact_message_event_resolver.sql';
const harnessPath='supabase/proofs/chat/push_event_transport_proof.mjs';
const workflowPath='.github/workflows/chat-p4-push-transport-proof.yml';
const surfacePath='supabase/proofs/pkg023/pkg023_surface.sql';
const hash=value=>createHash('sha256').update(value).digest('hex');
const jsonHash=value=>hash(JSON.stringify(value));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report={unit:'CHAT_P4_PUSH_EVENT_TRANSPORT',result:'FAIL',sourceSha:null,sourceArtifactHashes:{},checks:[],
 actualAuth:false,actualDatabase:false,actualEdgeHandler:false,providerCalls:0,syntheticProviderCalls:0,
 storageCalls:0,liveAccess:false,disposableOnly:true,clientWired:false,deviceProven:false,
 certificateMoved:null,catalogRestored:false,teardownRequired:true};
let rt,baseline,oldBegin,oldComment,outputDirectory,stage='LOCAL_TARGET_ADMISSION';
const originalConsole={log:console.log,warn:console.warn,error:console.error};
const pass=name=>report.checks.push({name,result:'PASS'});

function catalog(){
 return {
  state:rt.rows(`select private.closure_source_digest_v5() digest,
   (select to_jsonb(c) from private.closure_source_v5 c where singleton) certificate,
   (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure,
   private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5() binding,
   pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness_definition,
   (select jsonb_agg(to_jsonb(c) order by data_class) from private.closure_dataset_catalog_v5 c) datasets,
   (select jsonb_agg(to_jsonb(p) order by pubname) from pg_publication p) publications,
   (select jsonb_agg(to_jsonb(p) order by pubname,schemaname,tablename) from pg_publication_tables p) publication_tables,
   (select jsonb_agg(jsonb_build_array(p.oid,md5(to_jsonb(p)::text),obj_description(p.oid,'pg_proc')) order by p.oid)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in('public','private','rls_private')
      and p.oid<>to_regprocedure(${rt.q(beginSignature)})
      and p.oid is distinct from to_regprocedure(${rt.q(targetSignature)})) other_function_metadata,
   (select to_jsonb(p)-'prosrc' from pg_proc p where oid=to_regprocedure(${rt.q(beginSignature)})) begin_metadata,
   (select jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relreplident) order by c.oid)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in('public','private','rls_private') and c.relkind in('r','p')) table_authority`)[0],
  surface:rt.sql(readFileSync(surfacePath,'utf8')).split(/\r?\n/).filter(Boolean),
  history:rt.rows(migrationSnapshotQuery()),
 };
}
const dataState=()=>Object.fromEntries(['agreement_messages','user_activity_events','notification_deliveries',
 'notification_push_devices','notification_push_attempts'].map(table=>[table,
 rt.sql(`select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.${table} r`)]));
const readState=()=>Object.fromEntries(['agreement_messages','user_activity_events','notification_deliveries'].map(table=>[table,
 rt.sql(`select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.${table} r
 ${table==='notification_deliveries'?"where channel='IN_APP'":''}`)]));
const rpc=(client,name,args)=>rt.ok(client.rpc(name,args).abortSignal(AbortSignal.timeout(10000)));
const claim=()=>rpc(rt.service,'rpc_claim_push_transport',{p_kind:'SEND'});
const begin=value=>rpc(rt.service,'rpc_begin_push_send',{p_attempt_id:value.attemptId,p_lease_id:value.leaseId});
const beginKeys=['kind','attemptId','leaseId','leaseExpiresAt','expoPushToken','priority','eventType'];

function isolate(){
 // Deliberately close old disposable fixture transport only. No network send.
 rt.sql(`update public.notification_deliveries set state='SUPPRESSED',suppression_reason='SYNTHETIC_FIXTURE_ISOLATION'
  where channel='PUSH';update public.notification_push_attempts set transport_state='FINAL',outcome='FATAL',
  lease_id=null,lease_until=null where transport_state is not null;`);
}

async function agreement(requester,worker){
 const {q,rows,sql}=rt;
 const profile=(actor,kind)=>rows(`select id from public.app_profiles where account_id=${q(actor.id)} and kind=${q(kind)}`)[0].id;
 const rp=profile(requester,'REQUESTER'),wp=profile(worker,'WORKER'),needId=randomUUID();
 sql(`update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${q(wp)}`);
 await rpc(worker.client,'rpc_complete_worker_profile',{p_profile_id:wp});
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
   approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
  values(${q(needId)},${q(requester.id)},${q(rp)},'PUBLISHED','P4 push disposable task','Transport proof',
   'PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
 const offer=await rpc(worker.client,'rpc_submit_response',{p_need_id:needId,p_need_revision:1,p_worker_profile_id:wp,
  p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:randomUUID()});
 return rpc(requester.client,'rpc_select_response',{p_need_id:needId,p_need_revision:offer.needRevision,
  p_response_id:offer.responseId,p_response_version:offer.version,p_content_hash:offer.contentHash,p_client_request_id:randomUUID()});
}

try{
 assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
 assert.equal(env.DB_URL,env.RU5_DEVICE_DB_URL);
 for(const key of ['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS'])assert.equal(env[key],undefined);
 assert.equal(env.PRE_V3_ARTIFACT_DIR,'/tmp/chat-p4-private');
 assert.equal(env.P4_ARTIFACT_DIR,'/tmp/chat-p4-artifacts');
 assert.equal(env.P4_PUSH_ARTIFACT_DIR,'/tmp/chat-p4-push-artifacts');
 assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
 outputDirectory=env.P4_PUSH_ARTIFACT_DIR;mkdirSync(outputDirectory,{recursive:true});report.sourceSha=env.GITHUB_SHA;
 stage='EXACT_SOURCE_AND_P4_PREDECESSOR_PROOF';
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),env.GITHUB_SHA);
 report.sourceTree=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
 for(const path of [candidatePath,resolverPath,harnessPath,workflowPath,surfacePath,
  'supabase/candidates/20260926175504_clean_notification_push_event_type.sql',
  'supabase/functions/uskoci-push-transport/index.ts','supabase/functions/_shared/pushNotificationCopy.mjs',
  'supabase/proofs/notifications/n09_push_transport_runtime.mjs','supabase/proofs/chat/exact_message_event_resolver_proof.mjs',
  '.github/workflows/chat-p4-exact-message-proof.yml','supabase/proofs/pre_v3/closure_runtime.mjs',
  'supabase/proofs/pre_v3/history_snapshot.mjs','supabase/proofs/ru5_device_ui_local_guard.mjs']){
  const bytes=readFileSync(path);assert.deepEqual(bytes,execFileSync('git',['show',env.GITHUB_SHA+':'+path]));
  report.sourceArtifactHashes[path]=hash(bytes);
 }
 const prior=JSON.parse(readFileSync(env.P4_ARTIFACT_DIR+'/chat-p4-exact-message-report.json','utf8'));
 assert.equal(prior.result,'PASS');assert.equal(prior.sourceSha,env.GITHUB_SHA);
 for(const key of ['actualAuth','actualDatabase','catalogRestored'])assert.equal(prior[key],true);
 for(const key of ['liveAccess','deviceProven','pushTransportProven','certificateMoved'])assert.equal(prior[key],false);
 assert.equal(prior.providerCalls,0);assert.equal(prior.storageCalls,0);assert.equal(prior.checks.length,13);
 assert.ok(prior.checks.every(check=>check.result==='PASS'));assert.equal(prior.catalogBeforeSha256,prior.catalogAfterSha256);
 pass('EXACT_COMMIT_BYTES_AND_THIRTEEN_CHECK_P4_PREDECESSOR');
 console.log=console.warn=console.error=()=>{};
 rt=await import('../pre_v3/closure_runtime.mjs');
 const {sql,rows,q}=rt;
 stage='CERTIFIED_BASELINE_AND_P4_PREPARATION';
 assert.equal(sql(`select to_regprocedure(${q(targetSignature)}) is null`),'t');
 baseline=catalog();report.actualDatabase=true;
 assert.equal(baseline.state.ready,true);assert.equal(baseline.state.digest,baseline.state.certificate.sha256);
 assert.equal(baseline.state.digest,baseline.state.erasure.sha256);assert.equal(baseline.state.digest,baseline.state.binding.sourceSha256);
 report.catalogBeforeSha256=jsonHash(baseline);
 oldBegin=sql(`select pg_get_functiondef(${q(beginSignature)}::regprocedure)`);
 oldComment=rows(`select obj_description(${q(beginSignature)}::regprocedure,'pg_proc') value`)[0].value;
 sql(readFileSync(resolverPath,'utf8'));const before=catalog();assert.deepEqual(before.state,baseline.state);
 assert.deepEqual(before.history,baseline.history);const dataBefore=dataState();
 const candidate=readFileSync(candidatePath,'utf8');
 stage='MUTATED_CANDIDATE_REFUSALS';
 for(const [mutated,reason] of [
  [candidate.replace('f946246b96985efefa26e2bd560cc897','0'.repeat(32)),/CHAT_P4_PUSH_A1_PREDECESSOR_DRIFT/],
  [candidate.replace("'eventId',v_event_id","'eventId', v_event_id"),/CHAT_P4_PUSH_FUNCTION_BODY_CHANGED/],
  ...['security invoker','parallel safe','strict','set search_path=public'].map(change=>
   [candidate.replace('do $post$',`alter function ${beginSignature} ${change};\ndo $post$`),/CHAT_P4_PUSH_FUNCTION_METADATA_CHANGED/]),
  [candidate.replace('do $post$',`grant execute on function ${beginSignature} to authenticated;\ndo $post$`),/CHAT_P4_PUSH_FUNCTION_METADATA_CHANGED/],
 ]){
  assert.notEqual(mutated,candidate);assert.throws(()=>sql(mutated),reason);
  assert.deepEqual(catalog(),before);assert.deepEqual(dataState(),dataBefore);
 }
 pass('SOURCE_BODY_AUTHORITY_CONFIG_MUTATIONS_ABORT_WITH_CATALOG_AND_DATA_RESTORED');
 stage='INSTALL_TRANSPORT_CANDIDATE_AND_METADATA_INVARIANCE';
 sql(candidate);assert.throws(()=>sql(candidate),/CHAT_P4_PUSH_A1_PREDECESSOR_DRIFT/);
 const installed=catalog();assert.deepEqual(installed.state,before.state);assert.deepEqual(installed.history,before.history);
 assert.deepEqual(dataState(),dataBefore);
 const removed=before.surface.filter(line=>!installed.surface.includes(line)),added=installed.surface.filter(line=>!before.surface.includes(line));
 assert.equal(removed.length,1);assert.equal(added.length,1);
 assert.ok([...removed,...added].every(line=>line.startsWith('function:public.rpc_begin_push_send(')));
 assert.equal(sql(`select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid=${q(beginSignature)}::regprocedure`),'ea801be7205a8b07c7c94e20af3bd90e');
 report.beginBodyMd5='ea801be7205a8b07c7c94e20af3bd90e';
 pass('ONLY_BEGIN_BODY_CHANGED_NO_DATA_HISTORY_SCHEMA_ACL_OR_CERTIFICATE_DELTA');

 stage='REAL_AUTH_AND_CANONICAL_MESSAGE_FIXTURE';
 const requester=await rt.actor('p4-push-requester'),worker=await rt.actor('p4-push-worker'),stranger=await rt.actor('p4-push-stranger');
 for(const actor of [requester,worker,stranger])assert.equal((await rt.ok(actor.client.auth.getUser())).user.id,actor.id);
 const agreementId=await agreement(requester,worker);report.actualAuth=true;
 report.fixtureCounts={actors:3,agreements:1};
 const token='ExpoPushToken[synthetic_'+randomUUID().replaceAll('-','')+']';
 const device=await rpc(requester.client,'rpc_set_push_device_owned',{p_expected_user_id:requester.id,p_expo_push_token:token,
  p_platform:'ANDROID',p_active:true,p_expected_revision:0});assert.equal(device.sessionBound,true);
 await rt.prefs(requester.client,requester.id,'REQUESTER',{push_enabled:true,quiet_hours_enabled:false});
 sql("notify pgrst,'reload schema'");
 let ready=false;
 for(let attempt=0;attempt<30;attempt++){
  const response=await requester.client.rpc('rpc_resolve_activity_message_v1',{p_expected_user_id:requester.id,p_event_id:randomUUID()});
  if(!response.error){assert.equal(response.data.kind,'UNAVAILABLE');ready=true;break;}
  assert.equal(response.error.code,'PGRST202');await pause(100);
 }
 assert.equal(ready,true);
 const fixture=async()=>{
  isolate();
  const messageId=await rpc(worker.client,'rpc_send_agreement_message_v2',{p_expected_user_id:worker.id,
   p_agreement_id:agreementId,p_client_message_id:randomUUID(),p_body:'SYNTHETIC PRIVATE BODY'});
  const event=rows(`select id,recipient_user_id,recipient_role from public.user_activity_events where dedupe_key=${q('agreement_message:'+messageId)}`);
  assert.equal(event.length,1);assert.equal(event[0].recipient_user_id,requester.id);assert.equal(event[0].recipient_role,'REQUESTER');
  return {messageId,eventId:event[0].id};
 };
 const claimed=async()=>{const item=await fixture();const leased=await claim();assert.equal(leased.kind,'SEND');return {...item,leased};};
 const fresh=await claimed();const noRead=readState();
 const begun=await begin(fresh.leased);
 assert.deepEqual(Object.keys(begun).sort(),[...beginKeys,'eventId'].sort());assert.equal(begun.eventId,fresh.eventId);
 assert.equal(begun.eventType,'MESSAGE_RECEIVED');assert.equal(begun.expoPushToken,token);
 assert.equal(begun.attemptId,fresh.leased.attemptId);assert.equal(begun.leaseId,fresh.leased.leaseId);
 assert.equal(begun.leaseExpiresAt,fresh.leased.leaseExpiresAt);assert.deepEqual(readState(),noRead);
 for(const client of [rt.anon,requester.client,stranger.client]){
  const response=await client.rpc('rpc_begin_push_send',{p_attempt_id:fresh.leased.attemptId,p_lease_id:fresh.leased.leaseId});
  assert.equal(response.data,null);assert.equal(response.error?.code,'42501');
 }
 pass('REAL_AUTH_SERVICE_ONLY_BEGIN_EXACT_MESSAGE_EVENT_AND_NO_READ_EFFECT');

 stage='NON_MESSAGE_RECEIPT_REMAINS_A1';isolate();
 const otherEvent=sql(`select private.emit_event(${q(requester.id)},'REQUESTER','EXECUTION_STATE_CHANGED','AGREEMENT',
  ${q(agreementId)},1,'SYNTHETIC PRIVATE TITLE','SYNTHETIC PRIVATE BODY',${q('p4-push:'+randomUUID())})`);
 assert.match(otherEvent,/^[a-f0-9-]{36}$/);const otherClaim=await claim();assert.equal(otherClaim.kind,'SEND');
 const otherBegin=await begin(otherClaim);assert.deepEqual(Object.keys(otherBegin).sort(),beginKeys.sort());
 assert.equal(otherBegin.eventType,'EXECUTION_STATE_CHANGED');assert.equal(Object.hasOwn(otherBegin,'eventId'),false);
 pass('NON_MESSAGE_EVENT_HAS_EXACT_UNCHANGED_A1_RECEIPT');

 stage='FOREIGN_ROLE_AND_DELETED_EVENT_REFUSALS';
 for(const change of ['recipient','role','deleted']){
  const item=await claimed();
  if(change==='recipient')sql(`update public.user_activity_events set recipient_user_id=${q(stranger.id)} where id=${q(item.eventId)}`);
  if(change==='role')sql(`update public.user_activity_events set recipient_role='WORKER' where id=${q(item.eventId)}`);
  if(change==='deleted')sql(`delete from public.user_activity_events where id=${q(item.eventId)}`);
  assert.deepEqual(await begin(item.leased),{kind:'SUPPRESSED'});
 }
 assert.deepEqual(await begin({attemptId:randomUUID(),leaseId:randomUUID()}),{kind:'SUPPRESSED'});
 pass('FOREIGN_RECIPIENT_WRONG_ROLE_DELETED_AND_UNKNOWN_EVENT_FAIL_CLOSED');

 stage='LEASE_DEVICE_SESSION_AND_PREFERENCE_REFUSALS';
 for(const change of ['lease','device','session','preference']){
  const item=await claimed();
  if(change==='lease'){
   const result=await rt.service.rpc('rpc_begin_push_send',{p_attempt_id:item.leased.attemptId,p_lease_id:randomUUID()});
   assert.equal(result.data,null);assert.equal(result.error?.code,'40001');
  }else{
   let restore;
   if(change==='device'){
    sql(`update public.notification_push_devices set active=false where id=${q(device.id)}`);
    restore=()=>sql(`update public.notification_push_devices set active=true where id=${q(device.id)}`);
   }else if(change==='session'){
    const row=rows(`select bound_session_id from public.notification_push_devices where id=${q(device.id)}`)[0];
    const old=rows(`select not_after from auth.sessions where id=${q(row.bound_session_id)}`)[0].not_after;
    sql(`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=${q(row.bound_session_id)}`);
    restore=()=>sql(`update auth.sessions set not_after=${old===null?'null':q(old)} where id=${q(row.bound_session_id)}`);
   }else{
    await rt.prefs(requester.client,requester.id,'REQUESTER',{push_enabled:false});
    restore=()=>rt.prefs(requester.client,requester.id,'REQUESTER',{push_enabled:true});
   }
   try{assert.deepEqual(await begin(item.leased),{kind:'SUPPRESSED'});}finally{await restore();}
  }
 }
 pass('STALE_LEASE_CHANGED_DEVICE_EXPIRED_AUTH_SESSION_AND_DISABLED_PREFERENCE_REFUSE');

 stage='ACTUAL_EDGE_SQL_TO_SYNTHETIC_PROVIDER_TO_AUTHENTICATED_EXACT_WINDOW';
 for(const enabled of ['false','true']){
  const item=await fixture(),beforeRead=readState();let captured=null;
  const runtime=loadPushHandler({env:key=>({SUPABASE_URL:'https://p4-proof.supabase.co',
   SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,EXPO_PUSH_TRANSPORT_ENABLED:'true',
   EXPO_PUSH_MESSAGE_TARGET_ENABLED:enabled})[key],fetch:async(address,init)=>{
    if(address==='https://exp.host/--/api/v2/push/send'){
     const messages=JSON.parse(init.body);assert.equal(messages.length,1);captured=messages[0];
     assert.deepEqual(captured,{to:token,title:'Nova poruka u Dogovoru',body:'Imaš novu poruku.',
      data:enabled==='true'?{kind:'INBOX',eventType:'MESSAGE_RECEIVED',eventId:item.eventId}:{kind:'INBOX'},
      channelId:'default',sound:'default',priority:'normal',ttl:0});
     report.syntheticProviderCalls++;return new Response(JSON.stringify({data:[{status:'ok',id:'synthetic_ticket'}]}));
    }
    // The actual handler validates a canonical HTTPS Supabase origin. The proof
    // remaps only its four literal RPCs to the admitted local API; never fetch Expo.
    const parsed=new URL(address);assert.equal(parsed.origin,'https://p4-proof.supabase.co');
    assert.ok(['/rest/v1/rpc/rpc_claim_push_transport','/rest/v1/rpc/rpc_begin_push_send',
     '/rest/v1/rpc/rpc_complete_push_transport','/rest/v1/rpc/rpc_record_push_readiness'].includes(parsed.pathname));
    assert.equal(parsed.search,'');return fetch(new URL(parsed.pathname,env.RU5_DEVICE_SUPABASE_URL),{...init,redirect:'error'});
   }});
  // The load adapter keeps the actual handler's strict origin admission intact.
  assert.equal(new URL(env.RU5_DEVICE_SUPABASE_URL).origin,'http://127.0.0.1:54321');
  const response=await runtime.handler(new Request('https://synthetic-worker.test',{method:'POST',
   headers:{apikey:env.RU5_DEVICE_SERVICE_ROLE_KEY},body:'{"action":"tick"}'}));
  assert.equal(response.status,200);assert.equal((await response.json()).send,'TICKET_PENDING');assert.ok(captured);
  report.actualEdgeHandler=true;assert.deepEqual(readState(),beforeRead);
  const target=await rpc(requester.client,'rpc_resolve_activity_message_v1',{p_expected_user_id:requester.id,p_event_id:item.eventId});
  assert.deepEqual(target,{schema:'ACTIVITY_MESSAGE_TARGET_V1',accountId:requester.id,kind:'AGREEMENT_MESSAGE',
   eventId:item.eventId,agreementId,messageId:item.messageId,role:'REQUESTER',authoritative:true});
  const foreign=await rpc(stranger.client,'rpc_resolve_activity_message_v1',{p_expected_user_id:stranger.id,p_event_id:item.eventId});
  assert.deepEqual(foreign,{schema:'ACTIVITY_MESSAGE_TARGET_V1',accountId:stranger.id,kind:'UNAVAILABLE',authoritative:true});
  const window=await rpc(requester.client,'rpc_read_agreement_message_window_v1',{p_expected_user_id:requester.id,
   p_agreement_id:target.agreementId,p_target_message_id:target.messageId,p_before_count:0,p_after_count:0});
  assert.equal(window.targetMessageId,item.messageId);assert.equal(window.messages.length,1);
  assert.equal(window.messages[0].messageId,item.messageId);assert.deepEqual(readState(),beforeRead);
 }
 pass('EXACT_EDGE_OLD_AND_NEW_DATA_REAL_SQL_AUTH_RESOLVER_WINDOW_FOREIGN_REFUSAL_NO_ACK');
 stage='FINAL_CERTIFICATE_AND_INSTALLED_SURFACE';assert.deepEqual(catalog(),installed);
 pass('ALL_FIXTURE_EXERCISES_PRESERVE_INSTALLED_SCHEMA_AUTHORITY_AND_CERTIFICATE');
}catch(error){
 report.failureStage=stage;
 report.failureKind=error?.code==='ERR_ASSERTION'?'ASSERTION':'LOCAL_PROOF_FAILURE';
}finally{
 if(baseline&&oldBegin){
  try{
   rt.sql(`begin;${oldBegin};comment on function ${beginSignature} is ${oldComment===null?'null':rt.q(oldComment)};
    drop function if exists ${targetSignature};commit;notify pgrst,'reload schema';`);
   const final=catalog();report.catalogAfterSha256=jsonHash(final);
   report.catalogRestored=jsonHash(final)===jsonHash(baseline);
   report.certificateMoved=jsonHash([final.state.certificate,final.state.erasure])!==jsonHash([baseline.state.certificate,baseline.state.erasure]);
   assert.equal(report.catalogRestored,true);assert.equal(report.certificateMoved,false);
   assert.equal(rt.rows(`select obj_description(${rt.q(beginSignature)}::regprocedure,'pg_proc') value`)[0].value,oldComment);
   pass('ORIGINAL_BEGIN_RPC_COMMENT_AND_FULL_CATALOG_RESTORED_NO_CERTIFICATE_MOVE');
  }catch{report.cleanupFailed=true;}
 }
 Object.assign(console,originalConsole);
 if(!report.failureStage&&!report.cleanupFailed&&report.catalogRestored)report.result='PASS';else process.exitCode=1;
 if(outputDirectory){try{writeFileSync(outputDirectory+'/chat-p4-push-transport-report.json',JSON.stringify(report,null,2)+'\n');}
  catch{process.exitCode=1;report.result='FAIL';}}
 process.stdout.write(report.result+' CHAT_P4_PUSH_EVENT_TRANSPORT'+(report.failureStage?' '+report.failureStage:'')+'\n');
}
