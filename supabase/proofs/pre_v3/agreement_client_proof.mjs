// Actual bounded production Agreement client against real local Auth/RPC/SQL.
// Reuses existing immediate selection contract; no V3 UI or production provider call.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {loadPreV3Clients} from './client_runtime.mjs';
const env=process.env;assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
const out=env.PRE_V3_ARTIFACT_DIR??'artifacts/pre-v3';mkdirSync(out,{recursive:true});
const report={unit:'PRE_V3_AGREEMENT_CLIENT_REPLAY',result:'RUNNING',sourceSha:env.GITHUB_SHA,
 actualAuth:true,actualDatabase:true,actualClient:true,mockedRpcResponses:false,providerCalled:false,liveAccess:false,deviceProven:false,
 sqlPublishedFixtures:true,checks:[],migrations:[]};
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=s=>{try{return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}).trim();}catch(e){throw new Error('LOCAL_SQL:'+String(e.stderr).slice(0,500));}};
const rows=s=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${s}) r`));
const ok=async p=>{const r=await p;if(r.error)throw new Error('LOCAL_RPC:'+r.error.code+':'+r.error.message);return r.data;};
const denied=async(p,reason)=>{const r=await p;assert.ok(r.error,'EXPECTED_DENIAL:'+reason);if(reason)assert.equal(r.error.message,reason);};
const pass=name=>{report.checks.push({name,result:'PASS'});console.log('PASS '+name);};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const requester=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
const worker=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
const outsider=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
const service=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
let wp,rp,workerId=env.RU5_DEVICE_WORKER_USER_ID,requesterId=env.RU5_DEVICE_REQUESTER_USER_ID;
const read=id=>ok(requester.rpc('rpc_get_agreement_workspace',{p_agreement_id:id}));
const state=id=>rows(`select a.status,a.current_version,x.state,x.agreement_version,x.worker_marked_done_at,x.completed_at
 from public.agreements a join public.agreement_execution x on x.agreement_id=a.id where a.id=${q(id)}::uuid`)[0];
const countProposals=id=>Number(sql(`select count(*) from public.agreement_change_proposals where agreement_id=${q(id)}::uuid`));
const propose=(id,version,patch={price_rsd:4321,scope_note:'PRIVATE_SCOPE_TEST'},client=requester,key=randomUUID())=>client.rpc('rpc_propose_agreement_change_v2',{
 p_agreement_id:id,p_expected_version:version,p_patch:patch,p_reason:'PRIVATE_REASON_TEST',p_client_request_id:key});
const respond=(pid,accept=true,client=worker)=>client.rpc('rpc_respond_agreement_change',{p_proposal_id:pid,p_accept:accept});
const withdraw=(pid,client=requester)=>client.rpc('rpc_withdraw_agreement_change',{p_proposal_id:pid});
async function agreement(label,start=null,end=null){
 const id=randomUUID(),ts=x=>x===null?'null':q(x)+'::timestamptz';
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
 approximate_city,approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,response_deadline,published_at)
 values(${q(id)}::uuid,${q(requesterId)}::uuid,${q(rp)}::uuid,'PUBLISHED',${q('PRE-V3 '+label)},'Disposable SQL fixture',
 'PROOF','Novi Sad','Liman','OFFERS',1,${q(start?'FIXED_WINDOW':'FLEXIBLE')},${ts(start)},${ts(end)},statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
 const app=await ok(worker.rpc('rpc_submit_response',{p_need_id:id,p_need_revision:1,p_worker_profile_id:wp,p_covered_slots:1,
 p_price_rsd:3000,p_proposed_start_at:start,p_proposed_end_at:end,p_scope_note:null,p_client_request_id:randomUUID()}));
 const aid=await ok(requester.rpc('rpc_select_response',{p_need_id:id,p_need_revision:app.needRevision,p_response_id:app.responseId,
 p_response_version:app.version,p_content_hash:app.contentHash,p_client_request_id:randomUUID()}));
 assert.match(aid,/^[0-9a-f-]{36}$/);return aid;
}
const accepted=async p=>{const r=await p;assert.equal(r.ok,true,r.kod);return r.podatak;};
const same=x=>JSON.parse(JSON.stringify(x));
const userScope={accountId:requesterId,accountRevision:1},workerScope={accountId:workerId,accountRevision:1};
const rr=loadPreV3Clients({sourceSha:env.GITHUB_SHA,client:()=>requester,session:()=>({user:{id:requesterId},accountRevision:1})});
const wr=loadPreV3Clients({sourceSha:env.GITHUB_SHA,client:()=>worker,session:()=>({user:{id:workerId},accountRevision:1})});
const R=rr.load('src/data/agreementClientService.ts').agreementChangeService;
const W=wr.load('src/data/agreementClientService.ts').agreementChangeService;
try{
 const history=rows('select * from supabase_migrations.schema_migrations order by version');assert.equal(history.length,114);
 const file='20260911213000_clean_pre_v3_agreement_replay_guards.sql',path='supabase/migrations/'+file,b=readFileSync(path);
 assert.deepEqual(b,execFileSync('git',['show',env.GITHUB_SHA+':'+path]));sql(b.toString());
 sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(file.slice(0,14))},${q(file.slice(15,-4))},array[${q(b.toString())}]);notify pgrst,'reload schema'`);
 report.migrations.push({file,sha256:createHash('sha256').update(b).digest('hex')});
 assert.deepEqual(rows("select * from supabase_migrations.schema_migrations where version<'20260911213000' order by version"),history);
 await new Promise(r=>setTimeout(r,1200));
 await ok(requester.auth.signInWithPassword({email:env.RU5_DEVICE_REQUESTER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 await ok(worker.auth.signInWithPassword({email:env.RU5_DEVICE_WORKER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 rp=rows(`select id from public.app_profiles where account_id=${q(requesterId)}::uuid and kind='REQUESTER'`)[0].id;
 wp=(await ok(worker.rpc('rpc_get_worker_profile_for_edit',{}))).id;
 const id=await agreement('actual client actions');
 const first=await accepted(R.read(id,userScope));assert.equal(first.actions.canProposeChange,true);
 assert.equal(first.actions.authoritative,true);assert.equal(first.terms.priceRsd,3000);assert.equal(first.terms.scopeNote,''); // The selected empty scope is canonical, not an invented null.
 const command={dogovorId:id,ocekivanaVerzija:1,clientRequestId:randomUUID(),izmena:{cenaIznos:4321,obim:'Privatan dogovoreni obim'},razlog:'Privatan razlog'};
 const proposal=await accepted(R.propose(command,userScope));
 assert.deepEqual(same(await accepted(R.propose(command,userScope))),same(proposal));
 const wSnapshot=await accepted(W.read(id,workerScope));assert.equal(wSnapshot.actions.canRespondChange,true);assert.equal(wSnapshot.actions.canMarkWorkDone,false);
 assert.equal(wSnapshot.proposals.length,1);assert.equal(wSnapshot.proposals[0].proposalId,proposal.proposalId);
 const pending=await accepted(R.read(id,userScope));assert.equal(pending.actions.canWithdrawChange,true);assert.equal(pending.actions.canConfirmCompletion,false);
 await denied(worker.rpc('rpc_mark_work_done',{p_agreement_id:id}),'AGREEMENT_CHANGE_PENDING');
 const decision=await accepted(W.respond(wSnapshot.proposals[0],true,workerScope));assert.equal(decision.agreementVersion,2);
 const after=await accepted(W.read(id,workerScope));assert.equal(after.terms.priceRsd,4321);assert.equal(after.proposals.length,0);assert.equal(after.actions.canMarkWorkDone,true);
 pass('ACTUAL_TYPED_CLIENT_SNAPSHOT_ACTIONS_PENDING_COMPLETION_BARRIER_AND_ACCEPTANCE');
 await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:id}));
 const done=await accepted(R.read(id,userScope));assert.equal(done.actions.canProposeChange,false);assert.equal(done.actions.canRespondChange,false);
 const beforeReplay=rows(`select a.current_version,a.status,x.state,x.worker_marked_done_at,x.completed_at,
 (select count(*) from public.agreement_change_proposals p where p.agreement_id=a.id) proposals,
 (select count(*) from public.agreement_versions v where v.agreement_id=a.id) versions
 from public.agreements a join public.agreement_execution x on x.agreement_id=a.id where a.id=${q(id)}::uuid`);
 for(let i=0;i<2;i++){
  assert.deepEqual(same(await accepted(R.propose(command,userScope))),same(proposal));
  assert.deepEqual(same(await accepted(W.respond(wSnapshot.proposals[0],true,workerScope))),same(decision));
 }
 assert.equal((await R.propose({...command,clientRequestId:randomUUID(),ocekivanaVerzija:2},userScope)).ok,false);
 assert.equal((await R.propose({...command,izmena:{cenaIznos:4322}},userScope)).ok,false);
 assert.deepEqual(rows(`select a.current_version,a.status,x.state,x.worker_marked_done_at,x.completed_at,
 (select count(*) from public.agreement_change_proposals p where p.agreement_id=a.id) proposals,
 (select count(*) from public.agreement_versions v where v.agreement_id=a.id) versions
 from public.agreements a join public.agreement_execution x on x.agreement_id=a.id where a.id=${q(id)}::uuid`),beforeReplay);
 pass('IMMUTABLE_ACCEPTED_REPLAY_SURVIVES_DONE_WITHOUT_NEW_PROPOSAL_VERSION_OR_STATE_WRITE');
 await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:id}));
 assert.deepEqual(same(await accepted(R.propose(command,userScope))),same(proposal));
 assert.deepEqual(same(await accepted(W.respond(wSnapshot.proposals[0],true,workerScope))),same(decision));
 assert.equal((await accepted(R.read(id,userScope))).agreementStatus,'COMPLETED');
 const second=await agreement('withdraw replay');
 const withdrawCommand={...command,dogovorId:second,clientRequestId:randomUUID()};
 const withdrawId=(await accepted(R.propose(withdrawCommand,userScope))).proposalId;
 const withdrawReceipt=await accepted(R.withdraw(withdrawId,userScope));assert.equal(withdrawReceipt.idempotentReplay,false);
 assert.equal((await accepted(R.withdraw(withdrawId,userScope))).idempotentReplay,true);
 assert.equal((await accepted(R.read(second,userScope))).actions.canProposeChange,true);
 assert.equal((await W.withdraw(withdrawId,workerScope)).ok,false);
 const final=rows(`select p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated
 from pg_proc p where p.oid in('public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)'::regprocedure,
 'public.rpc_respond_agreement_change(uuid,boolean)'::regprocedure,'public.rpc_withdraw_agreement_change(uuid)'::regprocedure)`);
 assert.equal(final.length,3);assert.ok(final.every(x=>x.prosecdef&&x.proconfig.includes('search_path=pg_catalog')&&!x.anon&&x.authenticated));
 pass('COMPLETED_REPLAY_AND_WITHDRAW_IDEMPOTENCY_WITHOUT_PERMISSION_EXPANSION');
 report.productionClientHashes={...rr.sourceHashes,...wr.sourceHashes};report.historyCount=115;report.result='PASS';
}catch(error){report.result='FAIL';report.failure=String(error.message).slice(0,500);process.exitCode=1;console.error('FAIL '+report.failure);}
finally{writeFileSync(out+'/agreement-client-report.json',JSON.stringify(report,null,2)+'\n');console.log(report.result+' PRE_V3_AGREEMENT_CLIENT_REPLAY');}
