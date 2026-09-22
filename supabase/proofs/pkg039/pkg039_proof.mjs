// Actual disposable Auth/REST/SQL. No remote target or provider invocation.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
const {assert,sql,rows,q,ok,denied,randomUUID,service,env,lockedRace}=rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const mode=process.argv[2],path=env.PRE_V3_ARTIFACT_DIR+'/pkg039-report.json';
const report=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):
 {package:'PKG-039',sourceSha:env.GITHUB_SHA,disposableDbOnly:true,providerCalls:0,checks:[]};
const sha=x=>createHash('sha256').update(x).digest('hex');
const save=()=>writeFileSync(path,JSON.stringify(report,null,2)+'\n');
const pass=name=>{report.checks.push({mode,name,result:'PASS'});save();console.log('PASS '+name);};
const closure=()=>rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,private.retention_ai_source_ready() ready")[0];
const surface=()=>sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n').filter(Boolean);
const candidate='supabase/candidates/pkg039a_intake_failure_settlement.sql';
if(mode==='replay'){
 const text=readFileSync('supabase/candidates/pkg038a_review_registry_limit.sql','utf8');
 assert.equal(sha(text.replace(/\n$/,'')),'db37458e063955135ff5ef233d1411b2f3f9cd27e6a71ce9fe9620ca783fe914');
 sql(text);report.closureBefore=closure();assert.equal(report.closureBefore.live,report.closureBefore.certified);
 assert.equal(report.closureBefore.ready,true);pass('EXACT_PKG038_PREDECESSOR_READY');process.exit(0);
}
if(mode==='apply'){
 const before=surface(),c=closure(),text=readFileSync(candidate,'utf8');report.migrationTextSha256=sha(text.replace(/\n$/,''));
 assert.throws(()=>sql(text.replace('17baf5705063e2c65059a9cf43310be8','0'.repeat(32))),/PKG039A_PREDECESSOR_DRIFT/);
 assert.deepEqual(surface(),before);pass('WRONG_PREDECESSOR_REFUSED');
 assert.throws(()=>sql(text.replace("b text:=$b$and state='PROCESSING'", "b text:=$b$and state in ('PROCESSING','SUCCEEDED')")),/PKG039A_BODY_MISMATCH/);
 assert.deepEqual(surface(),before);pass('TAMPERED_SUCCESS_OVERWRITE_REFUSED');sql(text);
 assert.throws(()=>sql(text),/PKG039A_ALREADY_APPLIED/);pass('APPLY_ONCE');
 const after=surface(),removed=before.filter(x=>!after.includes(x)),added=after.filter(x=>!before.includes(x));
 assert.equal(removed.length,1);assert.equal(added.length,1);assert.match(added[0],/rpc_ai_fail_need_turn_v2_service/);
 report.surfaceRemoved=removed;report.surfaceAdded=added;pass('ONLY_FAILURE_FUNCTION_CHANGED');
 assert.deepEqual(closure(),c);report.closureAfter=closure();pass('CERTIFICATE_UNCHANGED_READY');process.exit(0);
}
assert.ok(['before','after'].includes(mode));
const owner=await rt.actor('pkg039-'+mode),other=await rt.actor('pkg039-foreign-'+mode);
const identity=x=>({p_account_id:owner.id,p_conversation_id:x.cid,p_client_request_id:x.key,p_attempt_id:x.attempt});
async function intake(dispatched=true){
 sql("update private.ai_need_turn_commands set attempt_times='{}' where account_id="+q(owner.id));
 const cid=await ok(owner.client.rpc('rpc_ai_open_need_conversation_v2')),key=randomUUID(),message='Synthetic PKG039 input';
 const claim=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{p_account_id:owner.id,p_conversation_id:cid,p_client_request_id:key,p_user_message:message}));
 const x={cid,key,message,attempt:claim.claim.attemptId};
 if(dispatched)assert.equal(await ok(service.rpc('rpc_ai_dispatch_need_turn_v2_service',identity(x))),true);
 return x;
}
const fail=x=>ok(service.rpc('rpc_ai_fail_need_turn_v2_service',identity(x)));
const complete=x=>service.rpc('rpc_ai_complete_need_turn_v2_service',{...identity(x),p_user_message:x.message,p_assistant_message:'Synthetic confirmed answer.',p_safety:'ALLOW',p_proposals:[]});
const reclaim=x=>ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{p_account_id:owner.id,p_conversation_id:x.cid,p_client_request_id:x.key,p_user_message:x.message}));
const read=x=>ok(owner.client.rpc('rpc_ai_read_need_turn_v2',{p_conversation_id:x.cid,p_client_request_id:x.key}));
const stored=x=>rows('select state,attempt_id,provider_dispatched,request_hash,cancelled_at from private.ai_need_turn_commands where account_id='+q(owner.id)+' and client_request_id='+q(x.key))[0];
const x=await intake(),initial=stored(x),ended=await fail(x);
if(mode==='before'){
 assert.equal(ended.state,'PROCESSING');assert.equal(ended.retryAllowed,false);assert.deepEqual(stored(x),initial);
 pass('DISPATCHED_FAILURE_REMAINS_BLOCKING_BEFORE');process.exit(0);
}
assert.equal(ended.state,'FAILED');assert.equal(ended.retryAllowed,false);
assert.deepEqual(stored(x),{...initial,state:'FAILED'});assert.equal((await reclaim(x)).claim,null);
assert.equal((await ok(complete(x))).state,'FAILED');assert.equal(sql('select count(*) from public.ai_messages where conversation_id='+q(x.cid)),'0');
assert.equal((await fail(x)).state,'FAILED');pass('FAILED_DISPATCH_RETAINS_IDENTITY_NO_REPLAY_NO_LATE_OUTPUT');
const next=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{p_account_id:owner.id,p_conversation_id:x.cid,p_client_request_id:randomUUID(),p_user_message:'Explicit next input'}));
assert.equal(next.turn.state,'PROCESSING');assert.ok(next.claim);pass('NEW_EXPLICIT_TURN_CAN_CONTINUE');
const pre=await intake(false),pf=await fail(pre);assert.equal(pf.state,'FAILED');assert.equal(pf.retryAllowed,true);pass('PRE_DISPATCH_EXISTING_STATUS_PRESERVED');
const wrong=await intake();const same=await ok(service.rpc('rpc_ai_fail_need_turn_v2_service',{...identity(wrong),p_attempt_id:randomUUID()}));assert.equal(same.state,'PROCESSING');
await denied(service.rpc('rpc_ai_fail_need_turn_v2_service',{...identity(wrong),p_account_id:other.id}),'CONVERSATION_NOT_FOUND');
await denied(owner.client.rpc('rpc_ai_fail_need_turn_v2_service',identity(wrong)));
assert.equal((await read(wrong)).state,'PROCESSING');pass('WRONG_ATTEMPT_FOREIGN_OWNER_CLIENT_AUTHORITY_REFUSED');
const success=await intake(),finished=await ok(complete(success));assert.equal(finished.state,'SUCCEEDED');assert.deepEqual(await fail(success),finished);pass('LOST_SUCCESS_ACK_CANNOT_BE_OVERWRITTEN');
const cancelled=await intake(false);await ok(owner.client.rpc('rpc_ai_cancel_need_turn_v2',{p_conversation_id:cancelled.cid,p_client_request_id:cancelled.key}));
const beforeCancel=stored(cancelled);await fail(cancelled);assert.deepEqual(stored(cancelled),beforeCancel);pass('OWNER_CANCELLATION_PRESERVED');
const failSql=t=>'select public.rpc_ai_fail_need_turn_v2_service('+[owner.id,t.cid,t.key,t.attempt].map(v=>q(v)+'::uuid').join(',')+')';
const completeSql=t=>'select public.rpc_ai_complete_need_turn_v2_service('+[owner.id,t.cid,t.key,t.attempt].map(v=>q(v)+'::uuid').join(',')+','+q(t.message)+",'Synthetic confirmed answer.','ALLOW','[]'::jsonb)";
const raceFailed=await intake();assert.equal((await lockedRace(failSql(raceFailed),()=>ok(complete(raceFailed)))).state,'FAILED');
const raceSuccess=await intake();assert.equal((await lockedRace(completeSql(raceSuccess),()=>fail(raceSuccess))).state,'SUCCEEDED');
pass('OBSERVED_LOCK_RACES_BOTH_ORDERS_PRESERVE_FIRST_TERMINAL_RESULT');

// Worker already has terminal failure semantics; prove them against the same
// DEV-equivalent schema before the Edge starts using them on transport failures.
const workerOwner=await rt.actor('pkg039-worker');
const session=await ok(workerOwner.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}));
const workerKey=randomUUID(),wid={p_account_id:workerOwner.id,p_conversation_id:session.conversationId,p_client_request_id:workerKey};
const wc=await ok(service.rpc('rpc_claim_worker_ai_turn_service',{...wid,p_text:'Synthetic worker input'}));
const wi={...wid,p_attempt_id:wc.turn.attemptId};
assert.equal((await ok(service.rpc('rpc_dispatch_worker_ai_turn_service',wi))).dispatched,true);
const wf=await ok(service.rpc('rpc_fail_worker_ai_turn_service',wi));assert.equal(wf.state,'FAILED');assert.equal(wf.retryAllowed,false);
await denied(service.rpc('rpc_complete_worker_ai_turn_service',{...wi,p_output:{assistantMessage:'Late',safety:'ALLOW',patch:{}}}),'WORKER_AI_TURN_STALE');
assert.equal((await ok(service.rpc('rpc_claim_worker_ai_turn_service',{...wid,p_text:'Synthetic worker input'}))).acquired,false);
const wn=await ok(service.rpc('rpc_claim_worker_ai_turn_service',{...wid,p_client_request_id:randomUUID(),p_text:'Next explicit worker input'}));
const ni={...wid,p_client_request_id:wn.turn.clientRequestId,p_attempt_id:wn.turn.attemptId};
assert.equal((await ok(service.rpc('rpc_dispatch_worker_ai_turn_service',ni))).dispatched,true);
const ws=await ok(service.rpc('rpc_complete_worker_ai_turn_service',{...ni,p_output:{assistantMessage:'Confirmed',safety:'ALLOW',patch:{}}}));
assert.equal(ws.state,'SUCCEEDED');assert.deepEqual(await ok(service.rpc('rpc_fail_worker_ai_turn_service',ni)),ws);
pass('WORKER_REAL_FAILURE_REPLAY_NEXT_TURN_AND_LOST_SUCCESS_ACK');
assert.deepEqual(closure(),report.closureAfter);pass('SCENARIOS_LEAVE_CERTIFICATE_READY');
