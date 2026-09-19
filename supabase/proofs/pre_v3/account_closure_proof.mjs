// P10 preparation proof: actual disposable Auth/Postgres and production client.
// Reserved EXECUTING states below are SQL GUARD FIXTURES only. They are NOT
// approved legal policy, a reachable READY transition, or real closure execution.
import {assert,randomUUID,sha,q,sql,rows,ok,denied,requester,worker,anon,service,requesterId,workerId,
 login,actor,apply,prove,pass,agreement,need,submit,command,wp,prefs,lockedRace} from './closure_runtime.mjs';
import {loadPreV3Clients} from './client_runtime.mjs';
const args=(id,revision=0,key=randomUUID())=>({p_expected_user_id:id,p_expected_revision:revision,p_client_request_id:key});
const prepare=(client,id,revision=0,key=randomUUID())=>client.rpc('rpc_prepare_account_closure',args(id,revision,key));
const state=(client,id)=>ok(client.rpc('rpc_get_account_closure',{p_expected_user_id:id}));
const accepted=async p=>{const r=await p;assert.equal(r.ok,true,r.kod);return r.podatak;};
const send=(id,key=randomUUID())=>requester.rpc('rpc_send_agreement_message_v2',{p_expected_user_id:requesterId,p_agreement_id:id,p_client_message_id:key,p_body:'Closure ordinary message'});
const restrict=id=>`select pg_advisory_xact_lock(private.closure_account_key(${q(id)}::uuid));update private.account_closure_requests set state='EXECUTING' where account_id=${q(id)}::uuid`;
const restore=(id,to='BLOCKED')=>sql(`update private.account_closure_requests set state=${q(to)} where account_id=${q(id)}::uuid`);
await prove('PRE_V3_ACCOUNT_CLOSURE_PREPARATION','account-closure-report.json',async report=>{
 await apply(report,'20260912130000_clean_pre_v3_account_closure_preparation.sql',120);await login();
 report.executionAdmitted=false;report.authClosureProven=false;report.mediaCleanupProven=false;
 report.restrictedStateFixturesOnly=true;report.closedAccountCount=0;
 const policyBefore=rows(`select (select count(*) from private.legal_document_versions) legal,(select count(*) from private.retention_policy_sets) retention`);
 const fresh=await actor('closure-empty'),outsider=await actor('closure-outsider');
 assert.equal((await state(fresh.client,fresh.id)).request,null);
 const key=randomUUID(),first=await ok(prepare(fresh.client,fresh.id,0,key));
 assert.equal(first.state,'NOT_READY');assert.equal(first.canExecute,false);assert.equal(first.restricted,false);
 assert.ok(first.preparation.notReadyReasons.includes('CLOSURE_EXECUTION_NOT_READY'));
 assert.equal(first.preparation.executionReady,false);assert.equal(first.preparation.authClosureReady,false);
 assert.deepEqual(first.preparation.blockers,[]);
 const replay=await Promise.all([ok(prepare(fresh.client,fresh.id,0,key)),ok(prepare(fresh.client,fresh.id,0,key))]);
 assert.ok(replay.every(x=>x.idempotentReplay&&x.requestId===first.requestId&&x.revision===1));
 await denied(prepare(fresh.client,fresh.id,1,key),'REQUEST_ID_REUSED');
 await denied(prepare(fresh.client,fresh.id,0),'CLOSURE_REVISION_CONFLICT');
 await denied(prepare(outsider.client,fresh.id),'AUTH_CONTEXT_CHANGED');await denied(prepare(anon,fresh.id));
 for(const revision of [-1,2147483647,null]) await denied(prepare(fresh.client,fresh.id,revision),'CLOSURE_INPUT_INVALID');
 await denied(fresh.client.rpc('rpc_prepare_account_closure',{...args(fresh.id,1),p_client_request_id:null}),'CLOSURE_INPUT_INVALID');
 const concurrent=await Promise.all([prepare(fresh.client,fresh.id,1),prepare(fresh.client,fresh.id,1)]);
 assert.equal(concurrent.filter(x=>x.error===null).length,1);assert.equal(concurrent.filter(x=>x.error?.message==='CLOSURE_REVISION_CONFLICT').length,1);
 assert.equal((await state(fresh.client,fresh.id)).revision,2);
 const own=await ok(fresh.client.rpc('rpc_get_account_closure_receipt',{p_expected_user_id:fresh.id,p_client_request_id:key}));
 assert.equal(own.found,true);assert.equal(own.receipt.revision,1);
 const isolated=await ok(outsider.client.rpc('rpc_get_account_closure_receipt',{p_expected_user_id:outsider.id,p_client_request_id:key}));
 assert.equal(isolated.found,false);assert.equal(isolated.receipt,null);
 assert.equal(sql(`select count(*) from private.account_closure_requests where account_id=${q(fresh.id)}::uuid`),'1');
 pass(report,'OWNED_NOT_READY_NO_FAKE_READY_CAS_KEYED_REPLAY_CONCURRENT_PREPARE_AND_ACCOUNT_ISOLATION');

 let session={user:{id:fresh.id},accountRevision:1},loseAck=true,switchAccount=false;
 const transport={rpc:async(name,input)=>{const r=await fresh.client.rpc(name,input);
  if(name==='rpc_prepare_account_closure'&&loseAck){loseAck=false;throw new Error('DISPOSABLE_LOST_ACK');}
  if(switchAccount){switchAccount=false;session={user:{id:outsider.id},accountRevision:2};}return r;}};
 const loader=loadPreV3Clients({sourceSha:sha,client:()=>transport,session:()=>session});
 const client=loader.load('src/data/accountClosureClientService.ts').accountClosureClientService;
 const ck=randomUUID();assert.equal((await client.prepare({expectedRevision:2,clientRequestId:ck})).kod,'CLOSURE_OUTCOME_UNKNOWN');
 const recovered=await accepted(client.readReceipt(ck));assert.equal(recovered.found,true);assert.equal(recovered.receipt.revision,3);
 assert.equal((await accepted(client.read())).revision,3);
 switchAccount=true;assert.equal((await client.read()).kod,'AUTH_ACCOUNT_CHANGED');
 assert.equal(sql(`select count(*) from private.account_closure_commands where account_id=${q(fresh.id)}::uuid and client_request_id=${q(ck)}::uuid`),'1');
 pass(report,'ACTUAL_PRODUCTION_CLIENT_LOST_ACK_OWNED_LEDGER_READBACK_AND_LATE_ACCOUNT_FENCE');

 const active=await agreement('closure ordinary'),completion=await agreement('closure completion'),cancellation=await agreement('closure cancellation'),problem=await agreement('closure recovery');
 const selectedNeed=need('closure selection'),application=await submit(selectedNeed),newNeed=need('closure new application');
 const review=await agreement('closure review entitlement');await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:review.id}));
 await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:review.id}));
 const blocked=await ok(prepare(requester,requesterId));assert.equal(blocked.state,'BLOCKED');assert.ok(blocked.preparation.blockers.includes('ACTIVE_AGREEMENT'));
 const workerPrep=await ok(prepare(worker,workerId));assert.ok(workerPrep.preparation.blockers.includes('ACTIVE_AGREEMENT'));
 sql(`insert into public.need_sensitive(need_id,exact_address) values(${q(active.needId)}::uuid,'PRIVATE_CLOSURE_ADDRESS_SENTINEL')`);
 await ok(requester.rpc('rpc_set_contact_grant',{p_agreement_id:active.id,p_channel:'EXACT_LOCATION',p_granted:true}));
 const oldKey=randomUUID(),oldMessage=await ok(send(active.id,oldKey));
 // These SQL rows exercise the restriction barrier, not preparation eligibility.
 await denied(lockedRace(restrict(requesterId),()=>worker.rpc('rpc_submit_response',command(newNeed))),'ACCOUNT_CLOSING');restore(requesterId);
 await denied(lockedRace(restrict(requesterId),()=>requester.rpc('rpc_select_response',{p_need_id:selectedNeed,p_need_revision:application.needRevision,
  p_response_id:application.responseId,p_response_version:application.version,p_content_hash:application.contentHash,p_client_request_id:randomUUID()})),'ACCOUNT_CLOSING');restore(requesterId);
 await denied(lockedRace(restrict(requesterId),()=>send(active.id)),'ACCOUNT_CLOSING');
 assert.equal(await ok(send(active.id,oldKey)),oldMessage);
 await denied(worker.rpc('rpc_reveal_contact',{p_agreement_id:active.id,p_channel:'EXACT_LOCATION'}),'NO_ACTIVE_GRANT');
 assert.equal((await ok(worker.from('need_sensitive').select('need_id').eq('need_id',active.needId))).length,0);
 assert.equal(await ok(requester.rpc('rpc_get_public_profile',{p_profile_id:wp})),null);
 await denied(worker.rpc('rpc_get_account_reputation',{p_account_id:requesterId}),'REPUTATION_NOT_AVAILABLE');
 assert.equal((await ok(requester.rpc('rpc_get_my_agreement_review',{p_agreement_id:review.id}))).eligible,false);
 await denied(requester.rpc('rpc_submit_agreement_review',{p_agreement_id:review.id,p_target_account_id:workerId,p_rating:5,p_tags:[],p_client_request_id:randomUUID()}),'ACCOUNT_CLOSING');
 // Counterpart may still review its completed work; no receipt is pushed to a
 // restricted target, no public reputation or reciprocal private state exposed.
 await ok(worker.rpc('rpc_submit_agreement_review',{p_agreement_id:review.id,p_target_account_id:requesterId,p_rating:5,p_tags:[],p_client_request_id:randomUUID()}));
 assert.equal(sql(`select count(*) from public.notification_deliveries d join public.user_activity_events e on e.id=d.event_id
 where e.entity_id=${q(review.id)}::uuid and e.event_type='REVIEW_RECEIVED' and d.state<>'SUPPRESSED'`),'0');
 pass(report,'OBSERVED_ACCOUNT_BARRIER_VS_APPLICATION_SELECTION_MESSAGE_CONTACT_PUBLIC_PROFILE_AND_REVIEW_BOUNDARIES');

 await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:completion.id}));await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:completion.id}));
 assert.equal(sql(`select status from public.agreements where id=${q(completion.id)}::uuid`),'COMPLETED');
 const messagesBefore=sql(`select count(*) from public.agreement_messages where agreement_id=${q(problem.id)}::uuid`);
 await ok(worker.rpc('rpc_report_problem',{p_agreement_id:problem.id,p_narrative:'PRIVATE_CLOSURE_PROBLEM_SENTINEL'}));
 assert.equal(sql(`select count(*) from public.agreement_messages where agreement_id=${q(problem.id)}::uuid`),messagesBefore);
 await ok(requester.rpc('rpc_cancel_agreement',{p_agreement_id:cancellation.id,p_reason:'PRIVATE_CLOSURE_CANCEL_SENTINEL'}));
 assert.equal(sql(`select status from public.agreements where id=${q(cancellation.id)}::uuid`),'CANCELLED');
 await ok(worker.rpc('rpc_submit_safety_report',{p_target_account_id:requesterId,p_need_id:problem.needId,p_agreement_id:problem.id,
  p_category:'UNSAFE_WORK',p_reason:'Private closure report',p_narrative:'PRIVATE_CLOSURE_REPORT_SENTINEL',p_client_request_id:randomUUID()}));
 await denied(prepare(requester,requesterId,blocked.revision),'ACCOUNT_CLOSING');
 restore(requesterId);
 const workerCancellation=await agreement('worker closure cancellation');
 sql('begin;'+restrict(workerId)+';commit;');
 await ok(worker.rpc('rpc_cancel_agreement',{p_agreement_id:workerCancellation.id,p_reason:'Worker safe cancellation'}));
 assert.equal(sql(`select status from public.agreements where id=${q(workerCancellation.id)}::uuid`),'CANCELLED');restore(workerId);
 pass(report,'RESTRICTED_STAGE_COMPLETION_CANCELLATION_BOTH_PARTIES_RECOVERY_AND_PRIVATE_SAFETY_ESCAPE');

 sql("update public.notification_deliveries set state='EXPIRED' where channel='PUSH'");
 await prefs(worker,workerId,'WORKER',{push_enabled:true,in_app_enabled:true,dogovor_enabled:true,quiet_hours_enabled:false});
 await ok(worker.rpc('rpc_set_push_device_owned',{p_expected_user_id:workerId,p_expo_push_token:'ExpoPushToken[pre_v3_closure_test_token]',p_platform:'ANDROID',p_active:true,p_expected_revision:0}));
 await ok(send(active.id));const claim=await ok(service.rpc('rpc_claim_push_transport',{p_kind:'SEND'}));assert.equal(claim.kind,'SEND');
 const begun=await ok(lockedRace(restrict(workerId),()=>service.rpc('rpc_begin_push_send',{p_attempt_id:claim.attemptId,p_lease_id:claim.leaseId})));
 assert.equal(begun.kind,'SUPPRESSED');restore(workerId);
 await denied(lockedRace(restrict(workerId),()=>worker.rpc('rpc_set_push_device_owned',{p_expected_user_id:workerId,
  p_expo_push_token:'ExpoPushToken[pre_v3_closure_new_token]',p_platform:'ANDROID',p_active:true,p_expected_revision:0})),'ACCOUNT_CLOSING');restore(workerId);
 assert.equal(sql(`select count(*) from public.notification_push_devices where expo_push_token='ExpoPushToken[pre_v3_closure_new_token]'`),'0');
 pass(report,'OBSERVED_PUSH_DEVICE_AND_QUEUED_PRE_PROVIDER_RESTRICTION_RACES_NO_PROVIDER_SEND');

 // Preparation waits behind a real ordinary write transaction, not a fabricated
 // timeout race. Once released, it reads current obligations before producing
 // a safe NOT_READY/BLOCKED receipt. No authority is inferred from the wait.
 const before=await state(requester,requesterId);
 const write=`select set_config('request.jwt.claims',${q(JSON.stringify({sub:requesterId,role:'authenticated'}))},true);set local role authenticated;
 select public.rpc_send_agreement_message_v2(${q(requesterId)}::uuid,${q(active.id)}::uuid,${q(randomUUID())},'Closure serialized write')`;
 const after=await ok(lockedRace(write,()=>prepare(requester,requesterId,before.revision)));
 assert.equal(after.revision,before.revision+1);assert.equal(after.state,'BLOCKED');assert.equal(after.canExecute,false);
 const priv=rows(`select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='private' and c.relname in('account_closure_requests','account_closure_commands')`);
 assert.equal(priv.length,2);assert.ok(priv.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 for(const name of ['account_closure_requests','account_closure_commands']) for(const role of ['anon','authenticated','service_role'])
  assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+name)},'SELECT,INSERT,UPDATE,DELETE')`),'f');
 for(const signature of ['rpc_get_account_closure(uuid)','rpc_prepare_account_closure(uuid,integer,uuid)','rpc_get_account_closure_receipt(uuid,uuid)']) {
  assert.equal(sql(`select has_function_privilege('authenticated',${q('public.'+signature)},'EXECUTE')`),'t');
  assert.equal(sql(`select has_function_privilege('anon',${q('public.'+signature)},'EXECUTE')`),'f');
  assert.equal(sql(`select prosecdef and proconfig @> array['search_path=pg_catalog'] from pg_proc where oid=${q('public.'+signature)}::regprocedure`),'t');
 }
 assert.deepEqual(rows(`select (select count(*) from private.legal_document_versions) legal,(select count(*) from private.retention_policy_sets) retention`),policyBefore);
 assert.equal(sql(`select count(*) from private.account_closure_requests where state='CLOSED'`),'0');
 assert.equal(sql(`select count(*) from auth.users where id in(${q(fresh.id)}::uuid,${q(requesterId)}::uuid,${q(workerId)}::uuid)`),'3');
 assert.equal(sql(`select has_function_privilege('authenticated','public.rpc_send_agreement_message(uuid,text)','EXECUTE')`),'t');
 assert.equal(sql(`select count(*) from public.user_activity_events where payload::text like '%PRIVATE_CLOSURE_%'`),'0');
 report.productionClientHashes=loader.sourceHashes;
 report.limitations=['Preparation and restricted-stage guards only; policy-bound execution adapter is absent.',
  'EXECUTING rows were disposable SQL guard fixtures, not a public READY/EXECUTING transition proof.',
  'No actual account deletion, Auth closure, media cleanup, live write, provider or handset proof.'];
 pass(report,'OBSERVED_PREPARATION_AFTER_ORDINARY_WRITE_PRIVATE_RLS_MINIMAL_EXECUTE_NO_POLICY_OR_AUTH_MUTATION');
});
