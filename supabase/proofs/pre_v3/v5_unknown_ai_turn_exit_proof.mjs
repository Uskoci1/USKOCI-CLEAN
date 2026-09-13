// Actual isolated Auth/PostgREST/Postgres141→142. Output values are synthetic;
// no provider/Edge call, live policy, refund, or production target is used.
import {assert,sql,rows,prove,pass,apply,actor,service,anon,ok,denied,randomUUID,q,lockedRace} from './closure_runtime.mjs';
const file='20260913044510_clean_v5_unknown_ai_turn_exit.sql';
const actorClaims=a=>`select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:a.id,role:'authenticated'}))},true);`;
const serviceClaims=`select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.role','service_role',true);`;
const uuidArgs=values=>values.map(v=>q(v)+'::uuid').join(',');
const callSql=(name,values)=>`select public.${name}(${uuidArgs(values)})`;
const taskText='Synthetic142 Task message';
const taskIds=(a,cid,key)=>({p_account_id:a.id,p_conversation_id:cid,p_client_request_id:key});
const taskOwner=(cid,key)=>({p_conversation_id:cid,p_client_request_id:key});
const taskFresh=a=>ok(a.client.rpc('rpc_ai_open_need_conversation_v2'));
const taskClaim=(a,cid,key,text=taskText)=>ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{...taskIds(a,cid,key),p_user_message:text}));
const taskRead=(a,cid,key)=>ok(a.client.rpc('rpc_ai_recover_need_turn_v2',taskOwner(cid,key)));
const taskCancel=(a,cid,key)=>ok(a.client.rpc('rpc_ai_cancel_need_turn_v2',taskOwner(cid,key)));
const taskDispatch=(a,cid,key,attempt)=>ok(service.rpc('rpc_ai_dispatch_need_turn_v2_service',{...taskIds(a,cid,key),p_attempt_id:attempt}));
const taskComplete=(a,cid,key,attempt)=>ok(service.rpc('rpc_ai_complete_need_turn_v2_service',{...taskIds(a,cid,key),p_attempt_id:attempt,
 p_user_message:taskText,p_assistant_message:'Synthetic142 Task output.',p_safety:'ALLOW',p_proposals:[]}));
const taskCompleteSql=(a,cid,key,attempt)=>serviceClaims+`select public.rpc_ai_complete_need_turn_v2_service(${uuidArgs([a.id,cid,key,attempt])},${q(taskText)},'Synthetic142 Task output.','ALLOW','[]'::jsonb)`;
const workerOutput={assistantMessage:'Synthetic142 Worker output.',safety:'ALLOW',patch:{bio:'Synthetic142 candidate'}};
const workerFresh=a=>ok(a.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}));
const workerIds=(a,s,key)=>({p_account_id:a.id,p_conversation_id:s.conversationId,p_client_request_id:key});
const workerOwner=(a,s,key)=>({p_expected_user_id:a.id,p_conversation_id:s.conversationId,p_client_request_id:key});
const workerClaim=(a,s,key,text='Synthetic142 Worker message')=>ok(service.rpc('rpc_claim_worker_ai_turn_service',{...workerIds(a,s,key),p_text:text}));
const workerRead=(a,s,key)=>ok(a.client.rpc('rpc_read_worker_ai_turn_recovery',workerOwner(a,s,key)));
const workerCancel=(a,s,key)=>ok(a.client.rpc('rpc_cancel_worker_ai_turn',workerOwner(a,s,key)));
const workerDispatch=(a,s,key,t)=>ok(service.rpc('rpc_dispatch_worker_ai_turn_service',{...workerIds(a,s,key),p_attempt_id:t.attemptId}));
const workerComplete=(a,s,key,t)=>ok(service.rpc('rpc_complete_worker_ai_turn_service',{...workerIds(a,s,key),p_attempt_id:t.attemptId,p_output:workerOutput}));
const workerCompleteSql=(a,s,key,t)=>serviceClaims+`select public.rpc_complete_worker_ai_turn_service(${uuidArgs([a.id,s.conversationId,key,t.attemptId])},${q(JSON.stringify(workerOutput))}::jsonb)`;
const history=cid=>rows(`select id,role,body,safety from public.ai_messages where conversation_id=${q(cid)} order by sequence_no`);
const facts=cid=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from public.ai_structured_facts t where conversation_id=${q(cid)}`);
const budgetHash=()=>sql("select md5(jsonb_build_object('budget',(select to_jsonb(b) from private.ai_test_budget_v5 b where singleton),'reservations',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from private.ai_test_reservations_v5 r))::text)");
const taskEvidence=(a,key)=>rows(`select provider_dispatched,attempt_id,request_hash,context_hash,attempt_times,lease_expires_at from private.ai_need_turn_commands where account_id=${q(a.id)} and client_request_id=${q(key)}`)[0];
const workerEvidence=(a,key)=>rows(`select provider_dispatched,attempt_id,body_hash,source_revision,lease_expires_at,user_message_id from private.worker_ai_turns where account_id=${q(a.id)} and client_request_id=${q(key)}`)[0];

await prove('V5_UNKNOWN_AI_TURN_EXIT','v5-unknown-ai-turn-exit-report.json',async report=>{
 const oldSource=sql('select sha256 from private.closure_source_v5 where singleton');
 const policies=sql("select md5(coalesce(jsonb_agg(to_jsonb(p) order by id),'[]')::text) from private.retention_policy_sets p");
 const beforeBudget=budgetHash();await apply(report,file,141);
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');assert.notEqual(sql('select sha256 from private.closure_source_v5 where singleton'),oldSource);
 assert.equal(sql("select md5(coalesce(jsonb_agg(to_jsonb(p) order by id),'[]')::text) from private.retention_policy_sets p"),policies);assert.equal(budgetHash(),beforeBudget);
 assert.equal(sql('select private.closure_binding_v5() is null'),'t');assert.equal(sql('select private.data_export_policy_binding() is null'),'t');
 report.providerOutputsSynthetic=true;report.actualEdgeGateway=false;
 const a=await actor('exit142-task'),w=await actor('exit142-worker'),b=await actor('exit142-other');
 for(const role of ['anon','authenticated','service_role'])for(const table of ['private.ai_need_turn_commands','private.worker_ai_turns','private.ai_test_reservations_v5'])
  assert.equal(sql(`select has_table_privilege(${q(role)},${q(table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');
 for(const signature of ['public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)','public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb)']){
  for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE')`),'f');
  assert.equal(sql(`select has_function_privilege('service_role',${q(signature)},'EXECUTE')`),'t');
 }
 pass(report,'EXACT141_AND140_SOURCE_SEAL_PRIVATE_ACL_CONSTRAINT_ONLY_REFRESH_NO_BUDGET_OR_POLICY_CHANGE');

 const cid=await taskFresh(a),key=randomUUID();
 await denied(anon.rpc('rpc_ai_cancel_need_turn_v2',taskOwner(cid,key)));await denied(service.rpc('rpc_ai_cancel_need_turn_v2',taskOwner(cid,key)));
 await denied(b.client.rpc('rpc_ai_cancel_need_turn_v2',taskOwner(cid,key)),'CONVERSATION_NOT_FOUND');
 const absent=await taskRead(a,cid,key);assert.equal(absent.turn.state,'ABSENT');assert.equal(absent.canCancel,true);assert.equal(Object.keys(absent).length,9);
 const lateClaim=await lockedRace(actorClaims(a)+callSql('rpc_ai_cancel_need_turn_v2',[cid,key]),()=>taskClaim(a,cid,key));
 assert.equal(lateClaim.claim,null);assert.equal((await taskRead(a,cid,key)).cancelled,true);assert.equal(history(cid).length,0);
 const preKey=randomUUID(),pre=(await taskClaim(a,cid,preKey)).claim;
 assert.equal((await taskComplete(a,cid,preKey,pre.attemptId)).state,'PROCESSING');assert.equal(history(cid).length,0);
 const cancelledDispatch=await lockedRace(actorClaims(a)+callSql('rpc_ai_cancel_need_turn_v2',[cid,preKey]),()=>taskDispatch(a,cid,preKey,pre.attemptId));
 assert.equal(cancelledDispatch,false);assert.equal((await taskComplete(a,cid,preKey,pre.attemptId)).state,'FAILED');
 const preRead=await taskRead(a,cid,preKey);assert.equal(preRead.providerDispatched,false);assert.equal(preRead.cancelled,true);assert.deepEqual(await taskCancel(a,cid,preKey),preRead);
 await denied(a.client.rpc('rpc_ai_recover_need_turn_v2',taskOwner(await taskFresh(a),key)),'AI_REQUEST_ID_REUSED');
 pass(report,'TASK_ABSENT_AND_PREDISPATCH_BEHAVIOR_PRESERVED_REAL_CLAIM_DISPATCH_LOCK_RACES_NO_EARLY_MATERIALIZATION');

 // Synthetic published Task fixture, then the actual owned edit-conversation RPC.
 // This is the previously trapped bound-edit path; no publication policy is seeded.
 const needId=randomUUID(),profile=rows(`select id from public.app_profiles where account_id=${q(a.id)} and kind='REQUESTER'`)[0].id;
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
 values(${q(needId)},${q(a.id)},${q(profile)},'PUBLISHED','Synthetic142 bound task','Synthetic task remains unchanged','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',clock_timestamp()+interval '2 days',clock_timestamp());commit;`);
 const edit=await ok(a.client.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:needId})),ek=randomUUID(),ec=(await taskClaim(a,edit.conversationId,ek)).claim;
 await denied(a.client.rpc('rpc_ai_abandon_need_conversation_v2',{p_conversation_id:edit.conversationId}),'CONVERSATION_NOT_ABANDONABLE');
 const budget=rows('select * from private.ai_test_budget_v5 where singleton')[0];
 const reserve=async(a,attempt)=>{const r=await ok(service.rpc('rpc_ai_test_budget_reserve_service',{p_account_id:a.id,p_operation_id:attempt,p_kind:'LLM',p_max_cost_microusd:250000}));assert.equal(r.admitted,true);return r;};
 sql(`insert into private.ai_test_accounts_v5(account_id) values(${q(a.id)}),(${q(w.id)});update private.ai_test_budget_v5 set enabled=true,reserved_microusd=0,price_valid_until=least(clock_timestamp()+interval '1 hour','2027-01-01T00:00:00Z') where singleton`);
 try{
  await reserve(a,ec.attemptId);assert.equal(await taskDispatch(a,edit.conversationId,ek,ec.attemptId),true);
  // Expiry only labels an unknown outcome; it never authorizes retry/refund.
  sql(`update private.ai_need_turn_commands set lease_expires_at=clock_timestamp()-interval '1 second' where account_id=${q(a.id)} and client_request_id=${q(ek)}`);
  const beforeNeed=sql(`select to_jsonb(n)::text from public.needs n where id=${q(needId)}`),beforeFacts=facts(edit.conversationId),beforeMessages=history(edit.conversationId),savedBudget=budgetHash(),evidence=taskEvidence(a,ek);
  const available=await taskRead(a,edit.conversationId,ek);assert.equal(available.providerDispatched,true);assert.equal(available.canCancel,true);assert.equal(available.turn.state,'PROCESSING');assert.equal(available.turn.retryAllowed,false);
  const late=await lockedRace(actorClaims(a)+callSql('rpc_ai_cancel_need_turn_v2',[edit.conversationId,ek]),()=>taskComplete(a,edit.conversationId,ek,ec.attemptId));
  assert.equal(late.state,'FAILED');assert.equal(late.receipt,null);assert.equal(late.retryAllowed,false);
  const recovered=await taskRead(a,edit.conversationId,ek);assert.equal(recovered.cancelled,true);assert.equal(recovered.providerDispatched,true);assert.equal(recovered.canCancel,false);
  assert.deepEqual(await taskRead(a,edit.conversationId,ek),recovered);assert.deepEqual(await taskCancel(a,edit.conversationId,ek),recovered);
  assert.deepEqual(taskEvidence(a,ek),evidence);assert.equal(budgetHash(),savedBudget);assert.deepEqual(history(edit.conversationId),beforeMessages);assert.equal(facts(edit.conversationId),beforeFacts);
  assert.equal(sql(`select to_jsonb(n)::text from public.needs n where id=${q(needId)}`),beforeNeed);
  assert.equal((await taskClaim(a,edit.conversationId,ek)).claim,null);assert.equal(await taskDispatch(a,edit.conversationId,ek,ec.attemptId),false);
  assert.equal((await ok(service.rpc('rpc_ai_test_budget_reserve_service',{p_account_id:a.id,p_operation_id:ec.attemptId,p_kind:'LLM',p_max_cost_microusd:250000}))).admitted,false);assert.equal(budgetHash(),savedBudget);
  pass(report,'TASK_BOUND_EDIT_CANCEL_WINS_OBSERVED_LATE_COMPLETE_RACE_NO_FACT_MESSAGE_NEED_CHANGE_RESTART_SAME_KEY_RESERVED_COST_PRESERVED');

  const successKey=randomUUID(),success=(await taskClaim(a,edit.conversationId,successKey)).claim;await reserve(a,success.attemptId);
  const dispatchThenCancel=await lockedRace(serviceClaims+callSql('rpc_ai_dispatch_need_turn_v2_service',[a.id,edit.conversationId,successKey,success.attemptId]),()=>taskCancel(a,edit.conversationId,successKey));
  assert.equal(dispatchThenCancel.cancelled,true);assert.equal(dispatchThenCancel.providerDispatched,true);assert.equal((await taskComplete(a,edit.conversationId,successKey,success.attemptId)).state,'FAILED');
  const wonKey=randomUUID(),won=(await taskClaim(a,edit.conversationId,wonKey)).claim;assert.equal(await taskDispatch(a,edit.conversationId,wonKey,won.attemptId),true);
  const completionWins=await lockedRace(taskCompleteSql(a,edit.conversationId,wonKey,won.attemptId),()=>taskCancel(a,edit.conversationId,wonKey));
  assert.equal(completionWins.cancelled,false);assert.equal(completionWins.canCancel,false);assert.equal(completionWins.turn.state,'SUCCEEDED');assert.ok(completionWins.turn.receipt.userMessageId);assert.ok(completionWins.turn.receipt.assistantMessageId);
  assert.deepEqual(await taskComplete(a,edit.conversationId,wonKey,won.attemptId),completionWins.turn);assert.deepEqual((await taskRead(a,edit.conversationId,wonKey)).turn,completionWins.turn);
  assert.equal(history(edit.conversationId).length,beforeMessages.length+2);
  pass(report,'TASK_DISPATCH_FIRST_CAN_STILL_EXIT_COMPLETION_FIRST_RETURNS_ACTUAL_IMMUTABLE_RECEIPT_WITHOUT_NEW_PROVIDER_WORK');

  const s=await workerFresh(w),wk=randomUUID();
  await denied(b.client.rpc('rpc_cancel_worker_ai_turn',workerOwner(b,s,wk)),'WORKER_AI_DENIED');
  await denied(w.client.rpc('rpc_cancel_worker_ai_turn',workerOwner(b,s,wk)),'AUTH_REQUIRED');
  const wa=await workerRead(w,s,wk);assert.equal(Object.keys(wa).length,12);assert.equal(wa.canCancel,true);assert.equal(wa.turn,null);
  const wl=await lockedRace(actorClaims(w)+callSql('rpc_cancel_worker_ai_turn',[w.id,s.conversationId,wk]),()=>workerClaim(w,s,wk));
  assert.equal(wl.acquired,false);assert.equal((await workerRead(w,s,wk)).cancelled,true);assert.equal(history(s.conversationId).length,0);
  const wp=randomUUID(),wpt=(await workerClaim(w,s,wp)).turn;
  const blockedDispatch=await lockedRace(actorClaims(w)+callSql('rpc_cancel_worker_ai_turn',[w.id,s.conversationId,wp]),()=>workerDispatch(w,s,wp,wpt));assert.equal(blockedDispatch.dispatched,false);
  assert.equal((await workerComplete(w,s,wp,wpt)).state,'FAILED');assert.equal((await workerRead(w,s,wp)).providerDispatched,false);
  const ownedBefore=await ok(w.client.rpc('rpc_read_worker_ai',{p_conversation_id:s.conversationId}));
  pass(report,'WORKER_ABSENT_AND_PREDISPATCH_CANCEL_EXACT_ACCOUNT_TOMBSTONE_AND_LATE_DISPATCH_BEHAVIOR_PRESERVED');

  const postKey=randomUUID(),pt=(await workerClaim(w,s,postKey,'Synthetic142 cancelled Worker content')).turn;await reserve(w,pt.attemptId);
  assert.equal((await workerDispatch(w,s,postKey,pt)).dispatched,true);const workerBudget=budgetHash(),workerSaved=workerEvidence(w,postKey),workerHistory=history(s.conversationId);
  const cancelledMessage=workerSaved.user_message_id;assert.ok(cancelledMessage);
  const workerLate=await lockedRace(actorClaims(w)+callSql('rpc_cancel_worker_ai_turn',[w.id,s.conversationId,postKey]),()=>workerComplete(w,s,postKey,pt));
  assert.equal(workerLate.state,'FAILED');const wr=await workerRead(w,s,postKey);assert.equal(wr.cancelled,true);assert.equal(wr.providerDispatched,true);assert.equal(wr.canCancel,false);assert.equal(wr.retryAllowed,false);
  assert.deepEqual(await workerRead(w,s,postKey),wr);assert.deepEqual(await workerCancel(w,s,postKey),wr);assert.deepEqual(workerEvidence(w,postKey),workerSaved);assert.equal(budgetHash(),workerBudget);
  assert.deepEqual(history(s.conversationId),workerHistory);assert.deepEqual((await ok(w.client.rpc('rpc_read_worker_ai',{p_conversation_id:s.conversationId}))).candidate,ownedBefore.candidate);
  const providerContext=await ok(service.rpc('rpc_read_worker_ai_context_service',{p_account_id:w.id,p_conversation_id:s.conversationId}));assert.ok(!providerContext.messages.some(m=>m.id===cancelledMessage));
  assert.equal((await workerClaim(w,s,postKey,'Changed cancelled input')).acquired,false);assert.equal((await workerDispatch(w,s,postKey,pt)).dispatched,false);assert.equal((await workerComplete(w,s,postKey,pt)).state,'FAILED');
  const manual=await ok(w.client.rpc('rpc_patch_worker_ai',{p_conversation_id:s.conversationId,p_expected_revision:ownedBefore.revision,p_patch:{bio:'Manual after authoritative142 cancellation'}}));assert.equal(manual.candidate.bio,'Manual after authoritative142 cancellation');
  pass(report,'WORKER_POSTDISPATCH_CANCEL_WINS_OBSERVED_COMPLETION_RACE_RESTART_COST_AND_HISTORY_PRESERVED_EXACT_CONTEXT_EXCLUSION_MANUAL_EDIT_UNLOCK');

  const orderedKey=randomUUID(),ordered=(await workerClaim(w,s,orderedKey)).turn;
  const dispatchFirst=await lockedRace(serviceClaims+callSql('rpc_dispatch_worker_ai_turn_service',[w.id,s.conversationId,orderedKey,ordered.attemptId]),()=>workerCancel(w,s,orderedKey));
  assert.equal(dispatchFirst.cancelled,true);assert.equal(dispatchFirst.providerDispatched,true);assert.equal((await workerComplete(w,s,orderedKey,ordered)).state,'FAILED');
  const expiredKey=randomUUID(),et=(await workerClaim(w,s,expiredKey)).turn;assert.equal((await workerDispatch(w,s,expiredKey,et)).dispatched,true);
  sql(`update private.worker_ai_turns set lease_expires_at=clock_timestamp()-interval '1 second' where turn_id=${q(et.turnId)}`);
  const unknown=await workerRead(w,s,expiredKey);assert.equal(unknown.turn.state,'UNKNOWN_OUTCOME');assert.equal(unknown.canCancel,true);assert.equal(unknown.providerDispatched,true);
  assert.equal((await workerCancel(w,s,expiredKey)).cancelled,true);assert.equal((await workerComplete(w,s,expiredKey,et)).state,'FAILED');
  const wonWorkerKey=randomUUID(),ww=(await workerClaim(w,s,wonWorkerKey)).turn;await reserve(w,ww.attemptId);assert.equal((await workerDispatch(w,s,wonWorkerKey,ww)).dispatched,true);
  const workerWin=await lockedRace(workerCompleteSql(w,s,wonWorkerKey,ww),()=>workerCancel(w,s,wonWorkerKey));assert.equal(workerWin.cancelled,false);assert.equal(workerWin.canCancel,false);assert.equal(workerWin.turn.state,'SUCCEEDED');
  assert.deepEqual(await workerComplete(w,s,wonWorkerKey,ww),workerWin.turn);assert.deepEqual((await workerRead(w,s,wonWorkerKey)).turn,workerWin.turn);
  assert.equal((await ok(w.client.rpc('rpc_read_worker_ai',{p_conversation_id:s.conversationId}))).candidate.bio,workerOutput.patch.bio);
  assert.equal(sql(`select count(*) from private.ai_test_reservations_v5 where account_id in(${q(a.id)},${q(w.id)})`),'4');assert.equal(sql('select reserved_microusd from private.ai_test_budget_v5 where singleton'),'1000000');
  pass(report,'WORKER_EXPIRED_UNKNOWN_CAN_EXIT_COMPLETION_FIRST_RETURNS_REAL_RECEIPT_ALL_FOUR_RESERVATIONS_UNREFUNDED');

  const catalog=JSON.parse(sql('select private.data_export_dataset_catalog()'));assert.equal(catalog.length,42);
  const fixture={delivery:{datasets:catalog.map(d=>({key:d.key,mode:'INCLUDE',fields:d.fields}))}};
  const project=aid=>JSON.parse(sql(`select private.data_export_snapshot(${q(aid)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(fixture))}::jsonb,clock_timestamp())`));
  const taskExport=project(a.id),workerExport=project(w.id),foreign=project(b.id);
  const te=taskExport.datasets.taskAiTurns.find(t=>t.id===late.turnId),we=workerExport.datasets.workerAiTurns.find(t=>t.id===pt.turnId);
  for(const entry of [te,we]){assert.ok(entry.cancelledAt);assert.equal(entry.state,'FAILED');assert.deepEqual(Object.keys(entry).sort(),['cancelledAt','conversationId','createdAt','id','state']);}
  assert.ok(!foreign.datasets.taskAiTurns.some(t=>t.id===te.id));assert.ok(!foreign.datasets.workerAiTurns.some(t=>t.id===we.id));
  for(const c of [edit.conversationId,s.conversationId])assert.equal(sql(`select private.retention_ai_candidate(${q(c)}) is null`),'t');
  assert.equal(sql('select private.retention_ai_source_ready()'),'t');assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
  assert.equal(sql("begin;alter table private.worker_ai_turns add column proof142_drift text;select private.retention_ai_source_ready();rollback;"),'f');
  pass(report,'OWNED_CANCELLED_TERMINAL_EXPORT_ONLY_EXISTING_FIELDS_FOREIGN_DENIAL_EXACT140_SEAL_NO_RETENTION_WIDENING');
 }finally{
  // Restore only these labelled disposable budget fixtures; product cancellation
  // above never deletes/refunds a reservation or rotates an operation ID.
  sql(`delete from private.ai_test_reservations_v5 where account_id in(${q(a.id)},${q(w.id)});delete from private.ai_test_accounts_v5 where account_id in(${q(a.id)},${q(w.id)});
   update private.ai_test_budget_v5 set enabled=${budget.enabled},reserved_microusd=${budget.reserved_microusd},price_valid_until=${q(budget.price_valid_until)} where singleton`);
 }

 const closed=await actor('exit142-closure'),cc=await taskFresh(closed),ck=randomUUID(),ct=(await taskClaim(closed,cc,ck)).claim;
 assert.equal(await taskDispatch(closed,cc,ck,ct.attemptId),true);
 await ok(closed.client.rpc('rpc_prepare_account_closure',{p_expected_user_id:closed.id,p_expected_revision:0,p_client_request_id:randomUUID()}));
 const reviewAfterCancel=await lockedRace(actorClaims(closed)+callSql('rpc_ai_cancel_need_turn_v2',[cc,ck]),()=>closed.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:closed.id}));
 const reviewReceipt=await ok(Promise.resolve(reviewAfterCancel));assert.equal(reviewReceipt.ready,false);assert.ok(!reviewReceipt.blockers.includes('PENDING_WORKFLOW'));
 const closedKey=randomUUID(),closedTurn=(await taskClaim(closed,cc,closedKey)).claim;assert.equal(await taskDispatch(closed,cc,closedKey,closedTurn.attemptId),true);
 const restricted=await lockedRace(`select pg_advisory_xact_lock(private.closure_account_key(${q(closed.id)}));update private.account_closure_requests set state='READY' where account_id=${q(closed.id)}`,
  ()=>closed.client.rpc('rpc_ai_cancel_need_turn_v2',taskOwner(cc,closedKey)));
 await denied(Promise.resolve(restricted),'ACCOUNT_CLOSING');assert.equal((await taskRead(closed,cc,closedKey)).canCancel,false);
 await denied(service.rpc('rpc_ai_complete_need_turn_v2_service',{...taskIds(closed,cc,closedKey),p_attempt_id:closedTurn.attemptId,p_user_message:taskText,p_assistant_message:'Forbidden closure result',p_safety:'ALLOW',p_proposals:[]}),'ACCOUNT_CLOSING');
  assert.equal(history(cc).length,0);
 const cw=await actor('exit142-worker-closure'),cws=await workerFresh(cw),cwk=randomUUID(),cwt=(await workerClaim(cw,cws,cwk)).turn;
 assert.equal((await workerDispatch(cw,cws,cwk,cwt)).dispatched,true);
 await ok(cw.client.rpc('rpc_prepare_account_closure',{p_expected_user_id:cw.id,p_expected_revision:0,p_client_request_id:randomUUID()}));
 const wrAfter=await lockedRace(actorClaims(cw)+callSql('rpc_cancel_worker_ai_turn',[cw.id,cws.conversationId,cwk]),()=>cw.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:cw.id}));
 assert.ok(!(await ok(Promise.resolve(wrAfter))).blockers.includes('PENDING_WORKFLOW'));
 const cwk2=randomUUID(),cwt2=(await workerClaim(cw,cws,cwk2)).turn;assert.equal((await workerDispatch(cw,cws,cwk2,cwt2)).dispatched,true);
 const workerHistory=history(cws.conversationId);
 const wrDenied=await lockedRace(`select pg_advisory_xact_lock(private.closure_account_key(${q(cw.id)}));update private.account_closure_requests set state='READY' where account_id=${q(cw.id)}`,
  ()=>cw.client.rpc('rpc_cancel_worker_ai_turn',workerOwner(cw,cws,cwk2)));
 await denied(Promise.resolve(wrDenied),'ACCOUNT_CLOSING');assert.equal((await workerRead(cw,cws,cwk2)).canCancel,false);
 await denied(service.rpc('rpc_complete_worker_ai_turn_service',{...workerIds(cw,cws,cwk2),p_attempt_id:cwt2.attemptId,p_output:workerOutput}),'ACCOUNT_CLOSING');assert.deepEqual(history(cws.conversationId),workerHistory);
 pass(report,'TASK_AND_WORKER_ACTUAL_CLOSURE_BOTH_LOCK_ORDERS_CANCEL_RELEASES_PENDING_ONLY_RESTRICTED_COMPLETION_DENIED_NO_LATE_DATA');
});
