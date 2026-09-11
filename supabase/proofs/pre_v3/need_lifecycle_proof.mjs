// Actual production client/controller -> local Auth/PostgREST/SQL. The existing
// W03 Edge handler is executed with synthetic provider output, not a real AI call.
// A separate child process restores the same account and reads both saved Needs.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {loadOwnedIntakeHandler} from '../ai/owned_intake_edge_runtime.mjs';
import {loadPreV3Clients} from './client_runtime.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const make=()=>createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const ok=async p=>{const r=await p;if(r.error)throw new Error('LOCAL_RPC:'+r.error.code+':'+String(r.error.message).slice(0,120));return r.data;};
const accepted=async p=>{const r=await p;assert.equal(r.ok,true,r.kod);return r.podatak;};
const denied=async(p,message)=>{const r=await p;assert.ok(r.error,'EXPECTED_DENIAL');if(message)assert.equal(r.error.message,message);};
const plain=x=>JSON.parse(JSON.stringify(x));
// No provider/native gateway or AsyncStorage claim is made by a process-level backend restore.
if(process.argv.includes('--cold-restore')){
 const request=JSON.parse(env.PRE_V3_COLD_CONTEXT),client=make();
 const restored=await ok(client.auth.setSession(JSON.parse(env.PRE_V3_COLD_SESSION)));
 assert.equal(restored.user.id,request.accountId);
 const state={user:{id:restored.user.id},accountRevision:17};
 const runtime=loadPreV3Clients({client:()=>client,session:()=>state,sourceSha:env.GITHUB_SHA});
 const intake=runtime.load('src/data/aiNeedV2Production.ts').aiNeedV2Production;
 for(const item of request.needs){
  const conversation=await intake.loadConversation(item.conversationId);
  assert.equal(conversation.status,'COMPLETED');assert.equal(conversation.review.boundNeedId,item.needId);
 }
 const needs=await ok(client.from('needs').select('id,requester_account_id,title,status').in('id',request.needs.map(x=>x.needId)).order('id'));
 assert.equal(needs.length,2);assert.equal(new Set(needs.map(x=>x.id)).size,2);
 for(const item of needs){assert.equal(item.requester_account_id,request.accountId);assert.equal(item.status,'DRAFT');
  assert.equal(item.title,request.needs.find(x=>x.needId===item.id).title);}
 process.stdout.write(JSON.stringify({result:'PASS',separateProcess:true,needs:needs.length,accountRestored:true}));
 process.exit(0);
}
const out=env.PRE_V3_ARTIFACT_DIR??'artifacts/pre-v3';mkdirSync(out,{recursive:true});
const report={unit:'PRE_V3_NEED_LIFECYCLE_SECOND_TASK',result:'RUNNING',sourceSha:env.GITHUB_SHA,
 actualAuth:true,actualDatabase:true,actualClient:true,actualController:true,actualEdgeHandler:true,
 mockedRpcResponses:false,providerOutputSynthetic:true,providerCalled:false,liveAccess:false,
 deviceProven:false,nativeStorageProven:false,edgeGatewayProven:false,checks:[],migrations:[]};
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=s=>{try{return execFileSync('psql',[db,'-X','-q','-v','ON_ERROR_STOP=1','-At'],
 {input:s,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}).trim();}
 catch(e){throw new Error('LOCAL_SQL:'+String(e.stderr).slice(0,300));}};
const rows=s=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${s}) r`));
const pass=name=>{report.checks.push({name,result:'PASS'});console.log('PASS '+name);};
const owner=make(),other=make(),anon=make();let client=owner;
const account=env.RU5_DEVICE_REQUESTER_USER_ID,otherAccount=env.RU5_DEVICE_WORKER_USER_ID;
let session={user:{id:account},accountRevision:1},loseOpen=false,loseSend=false,loseDelete=false,providerCalls=0;
let providerTitle='Prvi Zadatak';let profile;
const runtime=loadPreV3Clients({client:()=>client,session:()=>session,sourceSha:env.GITHUB_SHA});
const intake=runtime.load('src/data/aiNeedV2Production.ts').aiNeedV2Production;
const lifecycle=runtime.load('src/data/needLifecycleClientService.ts').needLifecycleClientService;
const controller=runtime.load('src/data/needLifecycleController.ts').createNeedLifecycleController;
const origin=new URL(url).origin,key='SYNTHETIC_NON_SECRET_PROVIDER_KEY';
const edgeEnv={SUPABASE_URL:url,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,
 AI_PROVIDER:'openai',OPENAI_API_KEY:key,OPENAI_MODEL:'SYNTHETIC_PROVIDER_MODEL'};
const edge=loadOwnedIntakeHandler({env:name=>edgeEnv[name],fetch:async(input,init={})=>{
 const target=new URL(String(input));
 if(target.href==='https://api.openai.com/v1/responses'){
  assert.equal(new Headers(init.headers).get('Authorization'),'Bearer '+key);providerCalls++;
  const facts=[['need.title',providerTitle],['need.description','Pregled pravopisa dve strane.'],['need.category','pisanje'],
   ['need.price_mode','OFFERS'],['need.schedule_kind','FLEXIBLE'],['need.people_needed',1],['need.task_geography',{mode:'REMOTE'}],['need.task_country_code','RS']]
   .map(([key,value])=>({key,valueJson:JSON.stringify(value),displayValue:typeof value==='object'?'Na daljinu':String(value),
    confidence:0.9,evidence:'Kontrolisan unos za izolovani test.'}));
  return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({safety:'ALLOW',assistantMessage:'Pregledajte i potvrdite podatke.',facts})}),
   {headers:{'Content-Type':'application/json'}});
 }
 assert.equal(target.origin,origin);assert.ok(target.pathname==='/auth/v1/user'||target.pathname.startsWith('/rest/v1/'));
 return fetch(input,init);
}});
const wrapped=new Proxy(owner,{get(target,prop){
 if(prop==='rpc')return async(name,args)=>{const r=await target.rpc(name,args);
  if(name==='rpc_ai_open_need_conversation_owned_v2'&&loseOpen){loseOpen=false;throw new Error('SIMULATED_LOST_HTTP_REPLY');}
  if(name==='rpc_delete_draft_need'&&loseDelete){loseDelete=false;throw new Error('SIMULATED_LOST_HTTP_REPLY');}return r;};
 if(prop==='functions')return {invoke:async(name,{body})=>{
  assert.equal(name,'uskoci-ai-interview');const token=(await ok(owner.auth.getSession())).session.access_token;
  const response=await edge.handler(new Request('https://controlled-handler.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}));
  const data=await response.json();if(loseSend){loseSend=false;throw new Error('SIMULATED_LOST_HTTP_REPLY');}
  return response.ok?{data,error:null}:{data:null,error:{context:new Response(JSON.stringify(data),{status:response.status})}};
 }};
 const value=Reflect.get(target,prop);return typeof value==='function'?value.bind(target):value;
}});
const readReceipt=(id,revision,action,actor=owner)=>ok(actor.rpc('rpc_get_need_lifecycle_receipt',{p_need_id:id,p_need_revision:revision,p_action:action}));
function fixtureDraft(label,status='DRAFT'){
 const id=randomUUID();sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
 values(${q(id)}::uuid,${q(account)}::uuid,${q(profile)}::uuid,${q(status)},${q(label)},'Disposable terminal-command fixture','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',${status==='DRAFT'?'null':'statement_timestamp()'});commit;`);return id;
}
try{
 const history=rows('select * from supabase_migrations.schema_migrations order by version');assert.equal(history.length,113);
 const unchanged=rows("select proname,md5(pg_get_functiondef(oid)) hash from pg_proc where oid in('public.rpc_cancel_need(uuid,integer,text)'::regprocedure,'public.rpc_delete_draft_need(uuid,integer,text)'::regprocedure) order by proname");
 const file='20260911210000_clean_pre_v3_need_lifecycle_receipt.sql',path='supabase/migrations/'+file,b=readFileSync(path);
 assert.deepEqual(b,execFileSync('git',['show',`${env.GITHUB_SHA}:${path}`]));sql(b.toString());
 sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(file.slice(0,14))},${q(file.slice(15,-4))},array[${q(b.toString())}]);notify pgrst,'reload schema'`);
 report.migrations.push({file,sha256:createHash('sha256').update(b).digest('hex')});
 assert.deepEqual(rows("select * from supabase_migrations.schema_migrations where version<'20260911210000' order by version"),history);
 assert.deepEqual(rows("select proname,md5(pg_get_functiondef(oid)) hash from pg_proc where oid in('public.rpc_cancel_need(uuid,integer,text)'::regprocedure,'public.rpc_delete_draft_need(uuid,integer,text)'::regprocedure) order by proname"),unchanged);
 await new Promise(r=>setTimeout(r,1200));
 await ok(owner.auth.signInWithPassword({email:env.RU5_DEVICE_REQUESTER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 await ok(other.auth.signInWithPassword({email:env.RU5_DEVICE_WORKER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 profile=(await ok(owner.from('app_profiles').select('id').eq('account_id',account).eq('kind','REQUESTER').eq('profile_status','ACTIVE').single())).id;
 await denied(anon.rpc('rpc_get_need_lifecycle_receipt',{p_need_id:randomUUID(),p_need_revision:1,p_action:'DELETE_DRAFT'}));
 for(const args of [{p_need_revision:0},{p_action:'OTHER'},{p_need_id:null}])await denied(owner.rpc('rpc_get_need_lifecycle_receipt',{
  p_need_id:randomUUID(),p_need_revision:1,p_action:'DELETE_DRAFT',...args}),'NEED_COMMAND_INVALID_INPUT');
 assert.equal(sql("select not has_function_privilege('anon','public.rpc_get_need_lifecycle_receipt(uuid,integer,text)','EXECUTE') and not has_table_privilege('authenticated','private.marketplace_audit_log','SELECT')"),'t');
 pass('FORWARD_READ_ONLY_RECEIPT_HISTORICAL_WRITERS_UNCHANGED_PRIVATE_AUDIT_HIDDEN');
 client=wrapped;
 const firstKey=randomUUID();loseOpen=true;assert.equal((await intake.openConversation(firstKey)).ok,false);
 const open1=await accepted(intake.openConversation(firstKey));assert.equal(open1.idempotentReplay,true);
 assert.equal(Number(sql(`select count(*) from private.ai_need_open_commands where account_id=${q(account)}::uuid and client_request_id=${q(firstKey)}::uuid`)),1);
 const turn1=randomUUID();loseSend=true;assert.equal((await intake.sendMessage(open1.conversationId,'Treba lektura dva lista, rad na daljinu, ponude.',turn1)).ok,false);
 const read1=await accepted(intake.readTurn(open1.conversationId,turn1));assert.equal(read1.state,'SUCCEEDED');assert.equal(providerCalls,1);
 assert.deepEqual(plain(await accepted(intake.sendMessage(open1.conversationId,'Treba lektura dva lista, rad na daljinu, ponude.',turn1))),plain(read1));assert.equal(providerCalls,1);
 let review=await intake.loadConversation(open1.conversationId);assert.equal(review.status,'OPEN');assert.equal(review.review.canSaveDraft,false);
 const titleFact=review.facts.find(f=>f.key==='need.title');assert.ok(titleFact);
 await accepted(intake.correctFact(titleFact.id,'Prvi sačuvani Zadatak','Prvi sačuvani Zadatak'));
 review=await intake.loadConversation(open1.conversationId);
 for(const fact of review.facts)if(fact.status!=='CONFIRMED')await accepted(intake.confirmFact(fact.id));
 review=await intake.loadConversation(open1.conversationId);assert.equal(review.review.canSaveDraft,true);
 const save1Key=randomUUID(),need1=await accepted(intake.saveDraft(open1.conversationId,save1Key));
 assert.deepEqual(plain(await accepted(intake.saveDraft(open1.conversationId,save1Key))),plain(need1));
 assert.equal((await intake.loadConversation(open1.conversationId)).status,'COMPLETED');
 pass('FIRST_TASK_ACTUAL_CLIENT_EDGE_HUMAN_CORRECTION_REVIEW_SAVE_UNKNOWN_READBACK_REPLAY');
 // New Task carries a new opener key, never the terminal conversation ID. Same
 // key under simultaneous requests is one command; no automatic second opener.
 providerTitle='Drugi sačuvani Zadatak';const secondKey=randomUUID();
 const [open2,duplicate]=await Promise.all([intake.openConversation(secondKey),intake.openConversation(secondKey)]).then(rs=>rs.map(r=>{assert.equal(r.ok,true,r.kod);return r.podatak;}));
 assert.equal(open2.conversationId,duplicate.conversationId);assert.notEqual(open2.conversationId,open1.conversationId);
 assert.equal(Number(sql(`select count(*) from private.ai_need_open_commands where account_id=${q(account)}::uuid and client_request_id=${q(secondKey)}::uuid`)),1);
 const turn2=await accepted(intake.sendMessage(open2.conversationId,'Drugi zadatak, lektura, rad na daljinu, ponude.',randomUUID()));assert.equal(turn2.state,'SUCCEEDED');
 review=await intake.loadConversation(open2.conversationId);
 for(const fact of review.facts)await accepted(intake.confirmFact(fact.id));
 assert.equal((await intake.loadConversation(open2.conversationId)).review.canSaveDraft,true);
 const need2=await accepted(intake.saveDraft(open2.conversationId,randomUUID()));assert.notEqual(need1.needId,need2.needId);
 assert.equal((await intake.loadConversation(open1.conversationId)).status,'COMPLETED');
 assert.equal((await intake.sendMessage(open1.conversationId,'Ne sme otvoriti stari razgovor.',randomUUID())).ok,false);
 assert.equal((await intake.abandonConversation(open1.conversationId)).ok,false);
 const needs=await ok(owner.from('needs').select('id,requester_account_id,title,status').in('id',[need1.needId,need2.needId]));
 assert.equal(needs.length,2);assert.equal(needs.find(x=>x.id===need1.needId).title,'Prvi sačuvani Zadatak');
 assert.equal(needs.find(x=>x.id===need2.needId).title,providerTitle);assert.ok(needs.every(n=>n.requester_account_id===account&&n.status==='DRAFT'));
 assert.equal(providerCalls,2);pass('SECOND_TASK_INDEPENDENT_IDS_DOUBLE_TAP_DEDUPE_TERMINAL_FIRST_UNCHANGED');
 const authSession=(await ok(owner.auth.getSession())).session;
 const coldContext={accountId:account,needs:[{...need1,title:'Prvi sačuvani Zadatak'},{...need2,title:providerTitle}]};
 const cold=JSON.parse(execFileSync(process.execPath,['supabase/proofs/pre_v3/need_lifecycle_proof.mjs','--cold-restore'],{
  env:{...env,PRE_V3_COLD_CONTEXT:JSON.stringify(coldContext),PRE_V3_COLD_SESSION:JSON.stringify({access_token:authSession.access_token,refresh_token:authSession.refresh_token})},
  encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));assert.equal(cold.result,'PASS');report.coldRestore=cold;
 client=other;session={user:{id:otherAccount},accountRevision:2};
 assert.equal(await intake.loadConversation(open1.conversationId),null);assert.equal(await intake.loadConversation(open2.conversationId),null);
 assert.equal((await ok(other.from('needs').select('id').in('id',[need1.needId,need2.needId]))).length,0);
 client=wrapped;session={user:{id:account},accountRevision:3};
 pass('SEPARATE_PROCESS_ACCOUNT_RESTORE_AND_CROSS_ACCOUNT_RLS_ISOLATION');
 const id=fixtureDraft('P6 lost delete');let refreshes=0;
 const c=controller({account:{accountId:account,accountRevision:3},command:{action:'DELETE_DRAFT',needId:id,expectedRevision:1,reason:'Private test reason'},refreshOwnedNeeds:async captured=>{
  assert.equal(captured.accountId,account);refreshes++;await ok(owner.from('needs').select('id').eq('requester_account_id',account));}});
 loseDelete=true;await Promise.all([c.submit(),c.submit()]);assert.equal(c.snapshot().phase,'UNKNOWN_OUTCOME');assert.equal(refreshes,0);
 await c.submit();assert.equal(refreshes,0);await c.reconcile();assert.equal(c.snapshot().phase,'CONFIRMED');assert.equal(c.snapshot().confirmation.receipt.deleted,true);assert.equal(refreshes,1);
 assert.equal(Number(sql(`select count(*) from private.marketplace_audit_log where entity_id=${q(id)}::uuid and event_type='NEED_DRAFT_DELETED'`)),1);
 assert.equal((await readReceipt(id,1,'DELETE_DRAFT',other)).state,'NOT_CONFIRMED');assert.equal((await readReceipt(id,2,'DELETE_DRAFT')).state,'NOT_CONFIRMED');
 assert.equal((await readReceipt(randomUUID(),1,'DELETE_DRAFT')).state,'NOT_CONFIRMED');
 assert.equal(JSON.stringify(await readReceipt(id,1,'DELETE_DRAFT')).includes('Private test reason'),false);
 assert.equal((await accepted(lifecycle.deleteDraftNeed(id,1,'Private test reason'))).idempotentReplay,true);
 pass('ACTUAL_CONTROLLER_LOST_DELETE_REPLY_READ_ONLY_AUDIT_CONFIRMATION_ONE_DELETE_NO_LIST_INFERENCE');
 const staleId=fixtureDraft('P6 stale');const bad=await lifecycle.deleteDraftNeed(staleId,2,'');assert.equal(bad.ok,false);assert.equal(bad.kod,'STALE_REVIEW_REQUIRED');
 await denied(other.rpc('rpc_delete_draft_need',{p_need_id:staleId,p_need_revision:1,p_reason:''}),'FORBIDDEN');
 const concurrentId=fixtureDraft('P6 concurrent delete');
 const both=await Promise.all([lifecycle.deleteDraftNeed(concurrentId,1,''),lifecycle.deleteDraftNeed(concurrentId,1,'')]);both.forEach(r=>assert.equal(r.ok,true,r.kod));
 assert.equal(Number(sql(`select count(*) from private.marketplace_audit_log where entity_id=${q(concurrentId)}::uuid and event_type='NEED_DRAFT_DELETED'`)),1);
 const cancelId=fixtureDraft('P6 eligible published cancel','PUBLISHED');
 const cancelled=await Promise.all([lifecycle.cancelNeed(cancelId,1,''),lifecycle.cancelNeed(cancelId,1,'')]);cancelled.forEach(r=>assert.equal(r.ok,true,r.kod));
 assert.equal((await readReceipt(cancelId,1,'CANCEL')).state,'CONFIRMED');assert.equal((await readReceipt(cancelId,1,'CANCEL',other)).state,'NOT_CONFIRMED');
 assert.equal(Number(sql(`select count(*) from private.marketplace_audit_log where entity_id=${q(cancelId)}::uuid and event_type='NEED_CANCELLED'`)),1);
 const active=rows(`select n.id,n.revision from public.needs n join public.agreements a on a.need_id=n.id where n.requester_account_id=${q(account)}::uuid and a.status='CONFIRMED' limit 1`)[0];assert.ok(active);
 assert.equal((await lifecycle.cancelNeed(active.id,active.revision,'')).ok,false);assert.equal((await lifecycle.deleteDraftNeed(active.id,active.revision,'')).ok,false);
 assert.equal(Number(sql(`select count(*) from public.needs where id=${q(active.id)}::uuid`)),1);
 pass('STALE_OWNER_ACTIVE_AGREEMENT_BARRIERS_AND_CONCURRENT_TERMINAL_COMMANDS');
 report.productionClientHashes=runtime.sourceHashes;report.edgeSourceHashes=edge.sourceHashes;report.syntheticProviderCalls=providerCalls;
 report.historyCount=Number(sql('select count(*) from supabase_migrations.schema_migrations'));assert.equal(report.historyCount,114);
 report.secondTaskEngineProven=true;report.lifecycleControllerSqlProven=true;report.result='PASS';
}catch(error){report.result='FAIL';report.failure=String(error.message).slice(0,500);process.exitCode=1;console.error('FAIL '+report.failure);}
finally{writeFileSync(out+'/need-lifecycle-report.json',JSON.stringify(report,null,2)+'\n');console.log(report.result+' PRE_V3_NEED_LIFECYCLE_SECOND_TASK');}
