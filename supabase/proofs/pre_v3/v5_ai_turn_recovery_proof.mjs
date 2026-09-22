// Actual disposable Auth/PostgREST/Postgres, exact132 source. Only provider
// output is synthetic. No live credentials/provider/network fallback is allowed.
import {assert,sql,prove,pass,apply,actor,service,anon,ok,denied,randomUUID,q,lockedRace,env} from './closure_runtime.mjs';
import {loadOwnedIntakeHandler} from '../ai/owned_intake_edge_runtime.mjs';
import {createDisposableAiBudgetFixture} from './disposable_ai_budget_fixture.mjs';
const file='20260912233901_clean_v5_ai_turn_restart_recovery.sql';
const ids=(a,cid,key)=>({p_account_id:a.id,p_conversation_id:cid,p_client_request_id:key});
const clientIds=(cid,key)=>({p_conversation_id:cid,p_client_request_id:key});
const claim=(a,cid,key,text='SYNTHETIC pending message')=>ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{...ids(a,cid,key),p_user_message:text}));
const recover=(a,cid,key)=>ok(a.client.rpc('rpc_ai_recover_need_turn_v2',clientIds(cid,key)));
const cancel=(a,cid,key)=>ok(a.client.rpc('rpc_ai_cancel_need_turn_v2',clientIds(cid,key)));
const dispatch=(a,cid,key,attempt)=>ok(service.rpc('rpc_ai_dispatch_need_turn_v2_service',{...ids(a,cid,key),p_attempt_id:attempt}));
const fresh=a=>ok(a.client.rpc('rpc_ai_open_need_conversation_v2'));
const resetRate=a=>sql(`update private.ai_need_turn_commands set attempt_times='{}' where account_id=${q(a.id)}::uuid`);
const count=cid=>Number(sql(`select count(*) from public.ai_messages where conversation_id=${q(cid)}::uuid`));
const complete=(a,cid,key,attempt)=>ok(service.rpc('rpc_ai_complete_need_turn_v2_service',{...ids(a,cid,key),p_attempt_id:attempt,
 p_user_message:'SYNTHETIC pending message',p_assistant_message:'SYNTHETIC response',p_safety:'ALLOW',p_proposals:[]}));
const asActor=a=>`select set_config('request.jwt.claim.sub',${q(a.id)},true);`;

await prove('V5_AI_TURN_RESTART_RECOVERY','v5-ai-turn-recovery-report.json',async report=>{
 await apply(report,file,131);const a=await actor('restart-owner'),b=await actor('restart-outsider');
 report.providerResponseStubbed=true;report.actualEdgeGateway=false;report.fixtureLeaseAndRateClock=true;
 const cid=await fresh(a),key=randomUUID();
 for(const role of ['anon','authenticated','service_role'])
  assert.equal(sql(`select has_table_privilege(${q(role)},'private.ai_need_turn_commands','SELECT,INSERT,UPDATE,DELETE')`),'f');
 await denied(anon.rpc('rpc_ai_recover_need_turn_v2',clientIds(cid,key)));
 await denied(service.rpc('rpc_ai_recover_need_turn_v2',clientIds(cid,key)));
 await denied(b.client.rpc('rpc_ai_recover_need_turn_v2',clientIds(cid,key)),'CONVERSATION_NOT_FOUND');
 await denied(b.client.rpc('rpc_ai_cancel_need_turn_v2',clientIds(cid,key)),'CONVERSATION_NOT_FOUND');
 await denied(a.client.rpc('rpc_ai_dispatch_need_turn_v2_service',{...ids(a,cid,key),p_attempt_id:randomUUID()}));
 const absent=await recover(a,cid,key);assert.equal(absent.turn.state,'ABSENT');assert.equal(absent.canCancel,true);
 assert.equal(Object.keys(absent).length,9);assert.equal(absent.accountId,a.id);assert.equal(count(cid),0);
 assert.deepEqual(await recover(a,cid,key),absent); // read creates no command/message/provider work
 assert.equal(sql(`select count(*) from private.ai_need_turn_commands where account_id=${q(a.id)}::uuid`),'0');
 pass(report,'OWNED_READ_ONLY_OPAQUE_RECOVERY_NO_TABLE_GRANT_NO_MESSAGE_WRITE_FOREIGN_DENIAL');

 // Cancel ABSENT first while real service claim blocks on the shared account
 // lock. Missing readback never licenses a replacement key or late provider call.
 const lateClaim=await lockedRace(`${asActor(a)}select public.rpc_ai_cancel_need_turn_v2(${q(cid)}::uuid,${q(key)}::uuid)`,()=>claim(a,cid,key));
 assert.equal(lateClaim.claim,null);assert.equal(lateClaim.turn.retryAllowed,false);
 const tombstone=await recover(a,cid,key);assert.equal(tombstone.cancelled,true);assert.equal(tombstone.canCancel,false);
 assert.deepEqual(await cancel(a,cid,key),tombstone);
 assert.equal((await claim(a,cid,key,'A delayed different input')).claim,null);assert.equal(count(cid),0);
 await denied(a.client.rpc('rpc_ai_recover_need_turn_v2',clientIds(await fresh(a),key)),'AI_REQUEST_ID_REUSED');
 pass(report,'ABSENT_CANCEL_TOMBSTONE_REAL_LOCK_WAIT_FENCES_LATE_CLAIM_REPLAY_DIFFERENT_INPUT_AND_CROSS_CONVERSATION');

 resetRate(a);const before=await fresh(a),beforeKey=randomUUID(),beforeClaim=await claim(a,before,beforeKey),attempt=beforeClaim.claim.attemptId;
 const afterCancelDispatch=await lockedRace(`${asActor(a)}select public.rpc_ai_cancel_need_turn_v2(${q(before)}::uuid,${q(beforeKey)}::uuid)`,
  ()=>dispatch(a,before,beforeKey,attempt));
 assert.equal(afterCancelDispatch,false);assert.equal((await complete(a,before,beforeKey,attempt)).state,'FAILED');assert.equal(count(before),0);
 pass(report,'CLAIMED_BEFORE_DISPATCH_CANCEL_WINS_REAL_LOCK_WAIT_LATE_COMPLETION_CANNOT_MATERIALIZE');

 const after=await fresh(a),afterKey=randomUUID(),afterClaim=await claim(a,after,afterKey),afterAttempt=afterClaim.claim.attemptId;
 const dispatchSql=`select public.rpc_ai_dispatch_need_turn_v2_service(${q(a.id)}::uuid,${q(after)}::uuid,${q(afterKey)}::uuid,${q(afterAttempt)}::uuid)`;
 const cancelLost=await lockedRace(dispatchSql,()=>cancel(a,after,afterKey));
 assert.equal(cancelLost.providerDispatched,true);assert.equal(cancelLost.cancelled,false);assert.equal(cancelLost.canCancel,false);
 assert.equal(await dispatch(a,after,afterKey,afterAttempt),false);
 await ok(service.rpc('rpc_ai_fail_need_turn_v2_service',{...ids(a,after,afterKey),p_attempt_id:afterAttempt}));
 sql(`update private.ai_need_turn_commands set lease_expires_at=clock_timestamp()-interval '1 second' where account_id=${q(a.id)}::uuid and client_request_id=${q(afterKey)}::uuid`);
 const expired=await recover(a,after,afterKey);assert.equal(expired.turn.state,'PROCESSING');assert.equal(expired.turn.retryAllowed,false);
 const replay=await claim(a,after,afterKey);assert.equal(replay.claim,null);assert.equal(replay.turn.turnId,afterClaim.turn.turnId);
 const competing=await claim(a,after,randomUUID());assert.equal(competing.claim,null);assert.equal(competing.turn.retryAllowed,false);
 await denied(service.rpc('rpc_ai_claim_need_turn_v2_service',{...ids(a,after,afterKey),p_user_message:'Changed replay'}),'AI_REQUEST_ID_REUSED');
 assert.equal(count(after),0);
 pass(report,'DISPATCH_WINS_REAL_LOCK_WAIT_EXPIRED_UNKNOWN_HAS_NO_RECLAIM_SUCCESSOR_OR_RETRYABLE_FAIL');

 // A positively persisted terminal failure is different from an expired
 // PROCESSING row. Its old attempt/key can neither complete nor be reclaimed;
 // a client may retire this UUID and let the user compose another message.
 assert.equal((await complete(a,after,afterKey,afterAttempt)).state,'FAILED');
 const terminal=await recover(a,after,afterKey);
 assert.equal(terminal.turn.state,'FAILED');assert.equal(terminal.providerDispatched,true);assert.equal(terminal.turn.retryAllowed,false);
 assert.equal((await claim(a,after,afterKey)).claim,null);
 assert.equal((await complete(a,after,afterKey,afterAttempt)).state,'FAILED');assert.equal(count(after),0);
 pass(report,'PERSISTED_TERMINAL_FAILURE_CANNOT_RECLAIM_OR_COMPLETE_LATE_UNLIKE_UNRESOLVED_PROCESSING');

 await ok(a.client.rpc('rpc_ai_abandon_need_conversation_v2',{p_conversation_id:after}));
 assert.equal((await complete(a,after,afterKey,afterAttempt)).state,'FAILED');
 assert.equal((await recover(a,after,afterKey)).conversationStatus,'ABANDONED');assert.equal(count(after),0);
 resetRate(a);const notSent=await fresh(a),notSentKey=randomUUID(),notSentClaim=await claim(a,notSent,notSentKey);
 const failed=await ok(service.rpc('rpc_ai_fail_need_turn_v2_service',{...ids(a,notSent,notSentKey),p_attempt_id:notSentClaim.claim.attemptId}));
 assert.equal(failed.retryAllowed,true);const retry=await claim(a,notSent,notSentKey);
 assert.equal(retry.turn.turnId,notSentClaim.turn.turnId);assert.notEqual(retry.claim.attemptId,notSentClaim.claim.attemptId);
 assert.equal(await dispatch(a,notSent,notSentKey,notSentClaim.claim.attemptId),false);
 await cancel(a,notSent,notSentKey);
 pass(report,'ABANDON_FENCES_LATE_COMPLETION_PRE_PROVIDER_FAILURE_EXPLICIT_SAME_KEY_RETRY_OLD_ATTEMPT_DENIED');

 resetRate(a);const edgeCid=await fresh(a),edgeKey=randomUUID(),token=(await ok(a.client.auth.getSession())).session.access_token;
 let providerCalls=0,budgetCalls=0;const origin=new URL(env.RU5_DEVICE_SUPABASE_URL).origin;
 //127 intentionally leaves a full, expired, disabled ledger. Isolate only the
 // disposable test state; preserve and restore every original row exactly.
 const budgetFixture=createDisposableAiBudgetFixture({sql,env,accountId:a.id,operationId:edgeKey});
 report.disposableBudgetFixture=budgetFixture.summary;
 const edgeEnv={SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,AI_PROVIDER:'gemini',GEMINI_API_KEY:'SYNTHETIC_NON_SECRET',GEMINI_MODEL:'gemini-3.8-flash',
  USKOCI_GEMINI_PAID_TEST_ENABLED:'true'};
 const runtime=loadOwnedIntakeHandler({env:name=>edgeEnv[name],fetch:async(input,init={})=>{
  const target=new URL(String(input));
  if(target.href==='https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent'){
   providerCalls++;assert.equal((await recover(a,edgeCid,edgeKey)).providerDispatched,true);
   assert.equal(budgetCalls,1);
   assert.equal(sql(`select count(*) from private.ai_test_reservations_v5 where account_id=${q(a.id)}::uuid and operation_id=${q(edgeKey)}::uuid and kind='LLM' and max_cost_microusd=250000`),'1');
   return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({safety:'ALLOW',assistantMessage:'SYNTHETIC response',facts:[],
    dialogue:{next:'ANSWER',questionKey:'',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'}})}]},finishReason:'STOP'}]}),{headers:{'Content-Type':'application/json'}});
  }
  assert.equal(target.origin,origin);assert.ok(target.pathname==='/auth/v1/user'||target.pathname.startsWith('/rest/v1/'));
  if(target.pathname==='/rest/v1/rpc/rpc_ai_test_budget_reserve_service'){
   budgetCalls++;assert.deepEqual(JSON.parse(init.body),{p_account_id:a.id,p_operation_id:edgeKey,p_kind:'LLM',p_max_cost_microusd:250000});
  }
  return fetch(input,init);
 }});
 const invoke=()=>runtime.handler(new Request('https://synthetic-handler.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({conversationId:edgeCid,clientRequestId:edgeKey,text:'SYNTHETIC canonical recovery text'})}));
 let primaryFailure;
 try{
  budgetFixture.enter();
  const result=await invoke();assert.equal(result.status,200);const receipt=await result.json();assert.equal(receipt.state,'SUCCEEDED');
  const durable=await recover(a,edgeCid,edgeKey);assert.deepEqual(durable.turn,receipt);
  const messages=await ok(a.client.from('ai_messages').select('id,body,role').eq('conversation_id',edgeCid));
  assert.equal(messages.length,2);assert.equal(messages.find(m=>m.id===receipt.receipt.userMessageId).body,'SYNTHETIC canonical recovery text');
  budgetFixture.assertReserved();
  // Replaying the durable result remains readable after paid admission closes.
  edgeEnv.USKOCI_GEMINI_PAID_TEST_ENABLED='false';
  assert.deepEqual(await(await invoke()).json(),receipt);assert.equal(providerCalls,1);assert.equal(budgetCalls,1);assert.equal(count(edgeCid),2);
  assert.equal((await cancel(a,edgeCid,edgeKey)).cancelled,false);
  budgetFixture.assertReserved();
  report.actualEdgeSourceHashes=runtime.sourceHashes;
  pass(report,'LATEST_ACTUAL_EDGE_AUTH_BUDGET_DISPATCH_CAS_SQL_CANONICAL_HISTORY_LOST_RECEIPT_RECOVERY_ONE_SYNTHETIC_PROVIDER_CALL');
 }catch(error){primaryFailure=error;throw error;}
 finally{
  try{
   budgetFixture.restore();
  }catch(error){report.fixtureCleanupFailed=true;if(!primaryFailure)throw error;}
 }
 assert.equal(sql(`select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton`),'t');
 pass(report,'TECHNICAL_CLOSURE_SOURCE_INVENTORY_REFRESH_WITHOUT_POLICY_ACTIVATION');
});
