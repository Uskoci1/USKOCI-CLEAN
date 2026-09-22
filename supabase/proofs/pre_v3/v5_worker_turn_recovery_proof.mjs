// Actual loopback Auth/PostgREST/Postgres140→141. Provider responses only are
// synthetic; VM executes exact current Worker Edge/shared source (hash recorded).
// No production target, gateway deployment, document, policy activation or audio.
import {assert,sql,rows,prove,pass,apply,actor,service,anon,ok,denied,randomUUID,q,lockedRace,env} from './closure_runtime.mjs';
import {loadWorkerRecoveryHandler} from '../ai/worker_recovery_edge_runtime.mjs';
const file='20260913022110_clean_v5_worker_turn_restart_recovery.sql';
const fresh=a=>ok(a.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}));
const ids=(a,s,key)=>({p_account_id:a.id,p_conversation_id:s.conversationId,p_client_request_id:key});
const ownerIds=(a,s,key)=>({p_expected_user_id:a.id,p_conversation_id:s.conversationId,p_client_request_id:key});
const claim=(a,s,key,text='Synthetic Worker message')=>ok(service.rpc('rpc_claim_worker_ai_turn_service',{...ids(a,s,key),p_text:text}));
const recover=(a,s,key)=>ok(a.client.rpc('rpc_read_worker_ai_turn_recovery',ownerIds(a,s,key)));
const cancel=(a,s,key)=>ok(a.client.rpc('rpc_cancel_worker_ai_turn',ownerIds(a,s,key)));
const dispatch=(a,s,key,t)=>ok(service.rpc('rpc_dispatch_worker_ai_turn_service',{...ids(a,s,key),p_attempt_id:t.attemptId}));
const output={assistantMessage:'Synthetic owned profile response.',safety:'ALLOW',patch:{bio:'Synthetic candidate biography'}};
const complete=(a,s,key,t)=>service.rpc('rpc_complete_worker_ai_turn_service',{...ids(a,s,key),p_attempt_id:t.attemptId,p_output:output});
const read=(a,s)=>ok(a.client.rpc('rpc_read_worker_ai',{p_conversation_id:s.conversationId}));
const actorClaims=a=>`select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:a.id,role:'authenticated'}))},true);`;
const serviceClaims=`select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.role','service_role',true);`;
const callSql=(name,values)=>`select public.${name}(${values.map(v=>q(v)+'::uuid').join(',')})`;
async function closedHttp(p){const r=await p;await denied(Promise.resolve(r),'ACCOUNT_CLOSING');assert.equal(r.status,403);assert.equal(r.error.code,'42501');assert.equal(r.data,null);}
// Direct authenticated-role SQL tests only the RPC body, separately from the
// actual HTTP pre-request denial. Its transaction cannot change the fixture.
const directOwnerRead=(a,name,values)=>JSON.parse(sql(`begin;set local role authenticated;set local request.jwt.claim.sub=${q(a.id)};set local request.jwt.claims=${q(JSON.stringify({sub:a.id,role:'authenticated'}))};${callSql(name,values)};rollback;`));
const msgCount=s=>Number(sql(`select count(*) from public.ai_messages where conversation_id=${q(s.conversationId)}`));
await prove('V5_WORKER_TURN_RESTART_RECOVERY','v5-worker-turn-recovery-report.json',async report=>{
 const legacy=await actor('worker141-legacy'),ls=await fresh(legacy),lk=randomUUID(),lt=(await claim(legacy,ls,lk)).turn;
 const oldSource=sql('select sha256 from private.closure_source_v5 where singleton');
 const policies=sql("select md5(coalesce(jsonb_agg(to_jsonb(p) order by id),'[]')::text) from private.retention_policy_sets p");
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');
 await apply(report,file,140);
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');assert.notEqual(sql('select sha256 from private.closure_source_v5 where singleton'),oldSource);
 assert.equal(sql("select md5(coalesce(jsonb_agg(to_jsonb(p) order by id),'[]')::text) from private.retention_policy_sets p"),policies);
 assert.equal(sql('select private.closure_binding_v5() is null'),'t');assert.equal(sql('select private.data_export_policy_binding() is null'),'t');
 const lr=await recover(legacy,ls,lk);assert.equal(lr.providerDispatched,true);assert.equal(lr.canCancel,false);assert.equal((await dispatch(legacy,ls,lk,lt)).dispatched,false);
 assert.equal((await cancel(legacy,ls,lk)).cancelled,false);assert.equal((await claim(legacy,ls,lk)).acquired,false);
 assert.equal(sql(`select private.retention_ai_candidate(${q(ls.conversationId)}) is null`),'t');
 pass(report,'EXACT140_REBIND_LEGACY_DISPATCH_CONSERVATIVE_NO_RETRY_NO_POLICY_CHANGE_NO_WORKER_RETENTION_WIDENING');
 const a=await actor('worker141-owner'),b=await actor('worker141-other'),s=await fresh(a),key=randomUUID();
 for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},'private.worker_ai_turns','SELECT,INSERT,UPDATE,DELETE')`),'f');
 await denied(anon.rpc('rpc_read_worker_ai_turn_recovery',ownerIds(a,s,key)));await denied(service.rpc('rpc_read_worker_ai_turn_recovery',ownerIds(a,s,key)));
 await denied(b.client.rpc('rpc_read_worker_ai_turn_recovery',ownerIds(b,s,key)),'WORKER_AI_DENIED');
 await denied(a.client.rpc('rpc_cancel_worker_ai_turn',ownerIds(b,s,key)),'AUTH_REQUIRED');
 await denied(a.client.rpc('rpc_dispatch_worker_ai_turn_service',{...ids(a,s,key),p_attempt_id:randomUUID()}));
 const absent=await recover(a,s,key);assert.equal(Object.keys(absent).length,12);assert.equal(absent.turn,null);assert.equal(absent.retryAllowed,true);
 assert.deepEqual(await recover(a,s,key),absent);assert.equal(msgCount(s),0);
 const late=await lockedRace(actorClaims(a)+callSql('rpc_cancel_worker_ai_turn',[a.id,s.conversationId,key]),()=>claim(a,s,key));
 assert.equal(late.acquired,false);assert.equal(late.turn.state,'FAILED');assert.equal(msgCount(s),0);
 const tombstone=await recover(a,s,key);assert.equal(tombstone.cancelled,true);assert.equal(tombstone.canCancel,false);assert.equal(tombstone.retryAllowed,false);
 assert.deepEqual(await cancel(a,s,key),tombstone);assert.equal((await claim(a,s,key,'Late different body')).acquired,false);
 assert.equal(sql(`select body_hash=repeat('0',64) and not provider_dispatched and cancelled_at is not null from private.worker_ai_turns where turn_id=${q(late.turn.turnId)}`),'t');
 pass(report,'OWNED_ABSENT_READ_PRIVATE_ACL_EXPECTED_ACCOUNT_CANCEL_TOMBSTONE_OBSERVED_LATE_CLAIM_NO_PLAINTEXT');
 const key2=randomUUID(),t2=(await claim(a,s,key2)).turn;
 const cancelledMessage=sql(`select user_message_id from private.worker_ai_turns where turn_id=${q(t2.turnId)}`);assert.match(cancelledMessage,/^[0-9a-f-]{36}$/);
 const providerContext=()=>ok(service.rpc('rpc_read_worker_ai_context_service',{p_account_id:a.id,p_conversation_id:s.conversationId}));
 assert.ok((await providerContext()).messages.some(m=>m.id===cancelledMessage));
 await denied(complete(a,s,key2,t2),'WORKER_AI_TURN_STALE'); // provider dispatch is a required canonical fence
 const cancelledDispatch=await lockedRace(actorClaims(a)+callSql('rpc_cancel_worker_ai_turn',[a.id,s.conversationId,key2]),()=>dispatch(a,s,key2,t2));
 assert.equal(cancelledDispatch.dispatched,false);assert.equal(cancelledDispatch.turn.state,'FAILED');
 assert.ok((await read(a,s)).messages.some(m=>m.id===cancelledMessage));assert.ok(!(await providerContext()).messages.some(m=>m.id===cancelledMessage));
 await denied(complete(a,s,key2,t2),'WORKER_AI_TURN_STALE');
 const edited=await ok(a.client.rpc('rpc_patch_worker_ai',{p_conversation_id:s.conversationId,p_expected_revision:s.revision,p_patch:{bio:'Manual after confirmed cancellation'}}));
 assert.equal(edited.revision,s.revision+1);assert.equal(edited.candidate.bio,'Manual after confirmed cancellation');
 pass(report,'CLAIMED_CANCEL_OBSERVED_DISPATCH_RACE_NO_EARLY_OR_LATE_COMPLETION_MANUAL_EDIT_ONLY_AFTER_TERMINAL');
 const key3=randomUUID(),t3=(await claim(a,s,key3)).turn;
 const nextContext=await providerContext();assert.ok(!nextContext.messages.some(m=>m.id===cancelledMessage));assert.ok(nextContext.messages.some(m=>m.role==='USER'));
 pass(report,'CANCELLED_EXACT_USER_MESSAGE_KEPT_IN_OWN_HISTORY_EXCLUDED_FROM_NEXT_PROVIDER_CONTEXT_NO_FK_OR_HEURISTIC_BACKFILL');
 const dispatchSql=serviceClaims+callSql('rpc_dispatch_worker_ai_turn_service',[a.id,s.conversationId,key3,t3.attemptId]);
 const lostCancel=await lockedRace(dispatchSql,()=>cancel(a,s,key3));assert.equal(lostCancel.cancelled,false);assert.equal(lostCancel.providerDispatched,true);assert.equal(lostCancel.canCancel,false);
 assert.equal((await dispatch(a,s,key3,t3)).dispatched,false);assert.equal((await claim(a,s,key3)).acquired,false);
 await denied(service.rpc('rpc_claim_worker_ai_turn_service',{...ids(a,s,key3),p_text:'Changed replay'}),'WORKER_AI_REQUEST_CONFLICT');
 sql(`update private.worker_ai_turns set lease_expires_at=clock_timestamp()-interval '1 second' where turn_id=${q(t3.turnId)}`);
 const unknown=await recover(a,s,key3);assert.equal(unknown.turn.state,'UNKNOWN_OUTCOME');assert.equal(unknown.canCancel,false);assert.equal(unknown.retryAllowed,false);
 await denied(service.rpc('rpc_claim_worker_ai_turn_service',{...ids(a,s,randomUUID()),p_text:'Another message'}),'WORKER_AI_TURN_PENDING');
 await denied(a.client.rpc('rpc_patch_worker_ai',{p_conversation_id:s.conversationId,p_expected_revision:edited.revision,p_patch:{bio:'Forbidden'}}),'WORKER_AI_TURN_PENDING');
 await denied(complete(a,s,key3,t3),'WORKER_AI_TURN_STALE');
 await ok(a.client.rpc('rpc_abandon_worker_ai',{p_conversation_id:s.conversationId}));assert.equal((await recover(a,s,key3)).conversationStatus,'ABANDONED');
 assert.equal((await dispatch(a,s,key3,t3)).dispatched,false);await denied(complete(a,s,key3,t3),'WORKER_AI_TURN_STALE');
 const next=await fresh(a);assert.notEqual(next.conversationId,s.conversationId);
 await denied(a.client.rpc('rpc_read_worker_ai_turn_recovery',ownerIds(a,next,key3)),'WORKER_AI_REQUEST_CONFLICT');
 assert.equal((await claim(a,s,key3)).acquired,false);assert.equal((await read(a,s)).status,'ABANDONED');assert.equal(sql(`select private.retention_ai_candidate(${q(s.conversationId)}) is null`),'t');
 pass(report,'DISPATCH_ONCE_UNKNOWN_EXPIRED_NO_RECHARGE_SUCCESSOR_OR_MANUAL_CHANGE_EXPLICIT_ABANDON_NO_RESURRECTION');
 const f=await actor('worker141-terminal'),fs=await fresh(f),fk=randomUUID(),ft=(await claim(f,fs,fk)).turn;
 assert.equal((await dispatch(f,fs,fk,ft)).dispatched,true);
 await ok(service.rpc('rpc_fail_worker_ai_turn_service',{...ids(f,fs,fk),p_attempt_id:ft.attemptId}));
 assert.equal((await recover(f,fs,fk)).turn.state,'FAILED');await denied(complete(f,fs,fk,ft),'WORKER_AI_TURN_STALE');assert.equal((await claim(f,fs,fk)).acquired,false);
 const fk2=randomUUID(),ft2=(await claim(f,fs,fk2)).turn;assert.equal((await dispatch(f,fs,fk2,ft2)).dispatched,true);
 const completed=await ok(complete(f,fs,fk2,ft2));assert.equal(completed.state,'SUCCEEDED');assert.deepEqual(await ok(complete(f,fs,fk2,ft2)),completed);
 assert.equal((await cancel(f,fs,fk2)).cancelled,false);assert.equal((await recover(f,fs,fk2)).turn.state,'SUCCEEDED');
 pass(report,'AUTHORITATIVE_FAILED_UNLOCKS_NEW_EXPLICIT_TURN_SUCCEEDED_CANONICAL_TEXT_AND_IMMUTABLE_COMPLETION_REPLAY');
 // Real canonical closure PREPARE locks, no synthetic policy admission. The
 // execution review correctly remains blocked on a dispatched unknown workflow.
 const c=await actor('worker141-closure'),cs=await fresh(c),ck=randomUUID();
 const closureCommand=`select public.rpc_prepare_account_closure(${q(c.id)}::uuid,0,${q(randomUUID())}::uuid)`;
 const afterPrep=await lockedRace(actorClaims(c)+closureCommand,()=>claim(c,cs,ck));assert.equal(afterPrep.acquired,true);
 const ck2=randomUUID();await cancel(c,cs,ck);const ct=(await claim(c,cs,ck2)).turn;
 const prepAfterDispatch=await lockedRace(serviceClaims+callSql('rpc_dispatch_worker_ai_turn_service',[c.id,cs.conversationId,ck2,ct.attemptId]),()=>c.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:c.id}));
 const cp=await ok(Promise.resolve(prepAfterDispatch));assert.ok(cp.blockers.includes('PENDING_WORKFLOW'));assert.equal(cp.ready,false);
 // Restriction is a labelled privileged state fixture, not an execution/binding
 // bypass. It checks the shared121 barrier without activating missing policy.
 const closureBefore=rows(`select state,closed_at from private.account_closure_requests where account_id=${q(c.id)}`)[0];assert.ok(closureBefore);
 const turnRows=()=>rows(`select * from private.worker_ai_turns where account_id=${q(c.id)} order by turn_id`),turnsBefore=turnRows(),recoveryBefore=await recover(c,cs,ck2);
 const budgetHash=()=>sql("select md5(jsonb_build_object('budget',(select to_jsonb(b) from private.ai_test_budget_v5 b where singleton),'reservations',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from private.ai_test_reservations_v5 r))::text)"),budgetBefore=budgetHash();
 try{
  const restricted=await lockedRace(`select pg_advisory_xact_lock(private.closure_account_key(${q(c.id)}));update private.account_closure_requests set state='READY' where account_id=${q(c.id)}`,()=>service.rpc('rpc_claim_worker_ai_turn_service',{...ids(c,cs,randomUUID()),p_text:'Forbidden restricted'}));
  await denied(Promise.resolve(restricted),'ACCOUNT_CLOSING');await denied(service.rpc('rpc_dispatch_worker_ai_turn_service',{...ids(c,cs,ck2),p_attempt_id:ct.attemptId}),'ACCOUNT_CLOSING');
  await closedHttp(c.client.rpc('rpc_read_worker_ai_turn_recovery',ownerIds(c,cs,ck2)));
  const lowerRead=directOwnerRead(c,'rpc_read_worker_ai_turn_recovery',[c.id,cs.conversationId,ck2]);
  assert.equal(lowerRead.canCancel,false);assert.equal(lowerRead.retryAllowed,false);assert.equal(lowerRead.authoritative,true);
 }finally{sql(`update private.account_closure_requests set state=${q(closureBefore.state)},closed_at=${closureBefore.closed_at?q(closureBefore.closed_at)+'::timestamptz':'null'} where account_id=${q(c.id)}`);}
 assert.deepEqual(turnRows(),turnsBefore);assert.equal(budgetHash(),budgetBefore);
 const recoveryAfter=await recover(c,cs,ck2);for(const key of ['accountId','conversationId','clientRequestId','providerDispatched','cancelled','authoritative'])assert.equal(recoveryAfter[key],recoveryBefore[key]);
 assert.equal(recoveryAfter.turn.turnId,recoveryBefore.turn.turnId);assert.equal(recoveryAfter.providerDispatched,true);
 pass(report,'CLOSED_CALLER_HTTP403_NO_PAYLOAD_DIRECT_AUTHENTICATED_SQL_NO_CANCEL_EXACT_TURN_DISPATCH_AND_BUDGET_AFTER_RESTORE');
 pass(report,'CANONICAL_CLOSURE_PREPARE_DISPATCH_BOTH_OBSERVED_LOCK_ORDERS_PENDING_BLOCKER_RESTRICTED_CLAIM_DISPATCH_DENIAL');
 const catalog=JSON.parse(sql('select private.data_export_dataset_catalog()'));assert.equal(catalog.length,42);
 assert.deepEqual(catalog.find(d=>d.key==='workerAiTurns').fields,['cancelledAt','conversationId','createdAt','id','state']);
 const fixture={delivery:{datasets:catalog.map(d=>({key:d.key,mode:'INCLUDE',fields:d.fields}))}};
 const project=aid=>JSON.parse(sql(`select private.data_export_snapshot(${q(aid)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(fixture))}::jsonb,clock_timestamp())`));
 const exported=project(a.id);assert.equal(exported.projectionVersion,'OWN_ACCOUNT_V5_5');assert.equal(Object.keys(exported.datasets).length,42);
 const entry=exported.datasets.workerAiTurns.find(t=>t.id===late.turn.turnId);assert.ok(entry.cancelledAt);assert.deepEqual(Object.keys(entry).sort(),['cancelledAt','conversationId','createdAt','id','state']);
 assert.ok(!project(b.id).datasets.workerAiTurns.some(t=>t.id===entry.id));
 assert.equal(sql(`select 'private.worker_ai_turns'=any(relations) from private.closure_dataset_catalog_v5 where data_class='AI_VOLATILE'`),'t');
 for(const mutation of ['alter table private.worker_ai_turns add column proof141_drift text','alter table public.ai_messages disable trigger pre_v3_closure_ai_message']){
  assert.equal(sql(`begin;${mutation};select private.retention_ai_source_ready();rollback;`),'f');
 }
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
 pass(report,'OWNED42_EXPORT_CANCELLATION_ONLY_NO_PROVIDER_PROVENANCE_FOREIGN_ROWS_OR_POLICY_ACTIVATION_EXACT_SOURCE_DRIFT_CLOSED');
 const e=await actor('worker141-edge'),es=await fresh(e),ek=randomUUID(),token=(await ok(e.client.auth.getSession())).session.access_token;
 const cancelledEdgeKey=randomUUID();await claim(e,es,cancelledEdgeKey,'SYNTHETIC_CANCELLED_DO_NOT_SEND');await cancel(e,es,cancelledEdgeKey);
 assert.ok((await read(e,es)).messages.some(m=>m.body==='SYNTHETIC_CANCELLED_DO_NOT_SEND'));
 const canonicalBefore=rows(`select bio,profile_status from public.app_profiles where account_id=${q(e.id)} and kind='WORKER'`);
 const budget=rows('select * from private.ai_test_budget_v5 where singleton')[0];
 sql(`insert into private.ai_test_accounts_v5(account_id) values(${q(e.id)});update private.ai_test_budget_v5 set enabled=true,reserved_microusd=0,price_valid_until=least(clock_timestamp()+interval '1 hour','2027-01-01T00:00:00Z') where singleton`);
 let calls=0,mode='SUCCEEDED';const providerBodies=[];const origin=new URL(env.RU5_DEVICE_SUPABASE_URL).origin;
 const config={SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,
 AI_PROVIDER:'gemini',GEMINI_MODEL:'gemini-3.8-flash',GEMINI_API_KEY:'SYNTHETIC_ONLY_NEVER_SENT_TO_NETWORK',USKOCI_GEMINI_PAID_TEST_ENABLED:'true'};
 const runtime=loadWorkerRecoveryHandler({env:n=>config[n],fetch:async(url,init)=>{
  if(String(url).startsWith('https://generativelanguage.googleapis.com/')){calls++;providerBodies.push(String(init.body));assert.ok(!String(init.body).includes('SYNTHETIC_CANCELLED_DO_NOT_SEND'));if(mode==='UNKNOWN')throw new Error('SYNTHETIC_UNKNOWN_IO');
   const payload='data: '+JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}]})+'\n\n';
   return new Response(payload,{headers:{'Content-Type':'text/event-stream'}});
  }
  assert.equal(new URL(url).origin,origin);return fetch(url,init);
 }});
 const invoke=(session,key)=>runtime.handler(new Request('https://worker-edge.proof.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify({conversationId:session.conversationId,clientRequestId:key,text:'Synthetic Worker message'})}));
 try{
  const response=await invoke(es,ek);assert.equal(response.status,200);const events=(await response.text()).trim().split('\n\n').map(x=>JSON.parse(x.slice(6)));
  assert.equal(events.at(-1).kind,'final');assert.equal(calls,1);assert.deepEqual((await recover(e,es,ek)).turn,events.at(-1).turn);assert.equal(msgCount(es),3);assert.ok(providerBodies.every(body=>!body.includes('SYNTHETIC_CANCELLED_DO_NOT_SEND')));
  assert.equal((await read(e,es)).candidate.bio,output.patch.bio);assert.deepEqual(rows(`select bio,profile_status from public.app_profiles where account_id=${q(e.id)} and kind='WORKER'`),canonicalBefore);
  assert.equal(sql(`select count(*) from public.ai_structured_facts where conversation_id=${q(es.conversationId)}`),'0');assert.equal((await(await invoke(es,ek)).json()).state,'SUCCEEDED');assert.equal(calls,1);
  const unknownKey=randomUUID();mode='UNKNOWN';const unknownResponse=await invoke(es,unknownKey);assert.equal(unknownResponse.status,200);await unknownResponse.text();
  assert.equal(calls,2);assert.ok(providerBodies.every(body=>!body.includes('SYNTHETIC_CANCELLED_DO_NOT_SEND')));const unknownRecovery=await recover(e,es,unknownKey);assert.equal(unknownRecovery.providerDispatched,true);assert.equal(unknownRecovery.retryAllowed,false);
  // PKG-039 settles definite handler failure; dispatch/budget remain consumed, with no same-key replay.
  assert.equal(unknownRecovery.state,'FAILED');
  assert.equal((await(await invoke(es,unknownKey)).json()).state,'FAILED');assert.equal(calls,2);
  assert.equal(sql(`select count(*) from private.ai_test_reservations_v5 where account_id=${q(e.id)}`),'2');
  assert.equal(sql(`select reserved_microusd from private.ai_test_budget_v5 where singleton`),'500000');
  report.actualEdgeSourceHashes=runtime.sourceHashes;report.edgeSourceBinding=runtime.sourceBinding;report.syntheticProviderDispatches=calls;report.providerResponseStubbed=true;report.actualEdgeGateway=false;
  pass(report,'CURRENT141_ACTUAL_EDGE_AUTH_BUDGET_DISPATCH_CANONICAL_PROFILE_LOST_REPLY_SETTLED_FAILURE_NO_SECOND_PROVIDER_RESERVATION');
 }finally{
  sql(`delete from private.ai_test_reservations_v5 where account_id=${q(e.id)};delete from private.ai_test_accounts_v5 where account_id=${q(e.id)};
   update private.ai_test_budget_v5 set enabled=${budget.enabled},reserved_microusd=${budget.reserved_microusd},price_valid_until=${q(budget.price_valid_until)} where singleton`);
 }
});
