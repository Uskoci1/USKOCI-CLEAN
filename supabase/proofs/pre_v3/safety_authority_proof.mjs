import {assert,randomUUID,sql,rows,q,ok,denied,requester,worker,anon,service,requesterId,workerId,wp,
 login,prove,apply,pass,need,command,submit,select,agreement,events,prefs,actor,lockedRace} from './closure_runtime.mjs';
const state=()=>ok(requester.rpc('rpc_get_account_block',{p_target_account_id:workerId}));
const set=async blocked=>{const s=await state();return ok(requester.rpc('rpc_set_account_block',{p_target_account_id:workerId,p_blocked:blocked,p_expected_revision:s.revision,p_client_request_id:randomUUID()}));};
const blockStatement=async()=>{const s=await state();return `select set_config('request.jwt.claims',${q(JSON.stringify({sub:requesterId,role:'authenticated'}))},true);set local role authenticated;
 select public.rpc_set_account_block(${q(workerId)}::uuid,true,${s.revision},${q(randomUUID())}::uuid)`;};
const send=(id,key=randomUUID(),client=requester,uid=requesterId)=>client.rpc('rpc_send_agreement_message_v2',{p_expected_user_id:uid,p_agreement_id:id,p_client_message_id:key,p_body:'Obična poruka'});
await prove('PRE_V3_SAFETY_AUTHORITY','safety-authority-report.json',async report=>{
 await apply(report,'20260912091000_clean_pre_v3_safety_authority.sql',117);
 await apply(report,'20260912091100_clean_pre_v3_safety_audit_vocabulary.sql',118);await login();
 const a=await agreement('safety escape'),b=await agreement('safety completion'),pendingNeed=need('safety selection'),pending=await submit(pendingNeed);
 const n=need('blocked new application');const beforeMessage=await ok(send(a.id,'safety-before-block-key'));
 sql(`insert into public.need_sensitive(need_id,exact_address,access_notes) values(${q(a.needId)}::uuid,'PRIVATE_ADDRESS_SENTINEL','PRIVATE_ACCESS_SENTINEL')
 on conflict(need_id) do update set exact_address=excluded.exact_address,access_notes=excluded.access_notes`);
 await ok(requester.rpc('rpc_set_contact_grant',{p_agreement_id:a.id,p_channel:'EXACT_LOCATION',p_granted:true}));
 assert.equal((await ok(worker.rpc('rpc_reveal_contact',{p_agreement_id:a.id,p_channel:'EXACT_LOCATION'}))).exactAddress,'PRIVATE_ADDRESS_SENTINEL');
 assert.equal((await ok(worker.from('need_sensitive').select('need_id').eq('need_id',a.needId))).length,1);
 const initial=await state(),key=randomUUID(),bc={p_target_account_id:workerId,p_blocked:true,p_expected_revision:initial.revision,p_client_request_id:key};
 const blocked=await ok(requester.rpc('rpc_set_account_block',bc));assert.equal(blocked.blocked,true);
 assert.equal((await ok(requester.rpc('rpc_set_account_block',bc))).idempotentReplay,true);
 await denied(requester.rpc('rpc_set_account_block',{...bc,p_blocked:false}),'REQUEST_ID_REUSED');
 await denied(requester.rpc('rpc_set_account_block',{...bc,p_client_request_id:randomUUID()}),'BLOCK_REVISION_CONFLICT');
 assert.equal((await ok(worker.rpc('rpc_get_account_block',{p_target_account_id:requesterId}))).blocked,false);
 await denied(worker.rpc('rpc_submit_response',command(n)),'INTERACTION_BLOCKED');
 await denied(worker.rpc('rpc_submit_response',command(pendingNeed,9000)),'INTERACTION_BLOCKED');
 await denied(requester.rpc('rpc_select_response',{p_need_id:pendingNeed,p_need_revision:pending.needRevision,p_response_id:pending.responseId,
  p_response_version:pending.version,p_content_hash:pending.contentHash,p_client_request_id:randomUUID()}),'INTERACTION_BLOCKED');
 await denied(send(a.id),'INTERACTION_BLOCKED');
 await denied(worker.rpc('rpc_send_agreement_message',{p_agreement_id:a.id,p_body:'Legacy bypass attempt'}),'INTERACTION_BLOCKED');
 assert.equal(await ok(send(a.id,'safety-before-block-key')),beforeMessage);
 await denied(requester.rpc('rpc_set_contact_grant',{p_agreement_id:a.id,p_channel:'EXACT_LOCATION',p_granted:true}),'INTERACTION_BLOCKED');
 await denied(worker.rpc('rpc_reveal_contact',{p_agreement_id:a.id,p_channel:'EXACT_LOCATION'}),'NO_ACTIVE_GRANT');
 assert.equal((await ok(worker.from('need_sensitive').select('need_id').eq('need_id',a.needId))).length,0);
 assert.equal(await ok(requester.rpc('rpc_get_public_profile',{p_profile_id:wp})),null);
 assert.equal(sql(`select count(*) from public.agreements where need_id=${q(pendingNeed)}::uuid`),'0');
 pass(report,'BLOCK_KEYED_CAS_NO_INCOMING_DISCLOSURE_SUBMIT_UPDATE_SELECTION_MESSAGE_AND_PRIVATE_GRANT_GUARDS');
 const privateReport={p_target_account_id:workerId,p_need_id:a.needId,p_agreement_id:a.id,p_category:'HARASSMENT',p_reason:'PRIVATE_REASON_SENTINEL',p_narrative:'PRIVATE_SAFETY_NARRATIVE_SENTINEL',p_client_request_id:randomUUID()};
 const received=await ok(requester.rpc('rpc_submit_safety_report',privateReport));
 assert.equal(received.received,true);assert.ok(!JSON.stringify(received).includes('PRIVATE_'));
 const both=await Promise.all([ok(requester.rpc('rpc_submit_safety_report',privateReport)),ok(requester.rpc('rpc_submit_safety_report',privateReport))]);
 assert.ok(both.every(x=>x.idempotentReplay&&x.reportId===received.reportId));
 assert.equal(sql(`select count(*) from private.safety_reports where id=${q(received.reportId)}::uuid`),'1');
 await denied(worker.rpc('rpc_get_my_safety_report',{p_report_id:received.reportId}),'REPORT_NOT_AVAILABLE');
 await denied(requester.rpc('rpc_submit_safety_report',{...privateReport,p_reason:'changed'}),'REQUEST_ID_REUSED');
 for(const patch of [{p_category:'UNKNOWN'},{p_reason:'x'.repeat(201)},{p_narrative:'x'.repeat(2001)},{p_target_account_id:requesterId}])
  await denied(requester.rpc('rpc_submit_safety_report',{...privateReport,...patch,p_client_request_id:randomUUID()}),'SAFETY_REPORT_INPUT_INVALID');
 const outsider=await actor('safety-outsider');
 await denied(outsider.client.rpc('rpc_submit_safety_report',{...privateReport,p_client_request_id:randomUUID()}),'SAFETY_CONTEXT_NOT_AVAILABLE');
 await denied(anon.rpc('rpc_submit_safety_report',privateReport));
 assert.equal(sql(`select count(*) from public.user_activity_events where payload::text like '%PRIVATE_SAFETY_NARRATIVE_SENTINEL%'`),'0');
 const messagesBefore=Number(sql(`select count(*) from public.agreement_messages where agreement_id=${q(a.id)}::uuid`));
 const problem=await ok(worker.rpc('rpc_report_problem',{p_agreement_id:a.id,p_narrative:'AGREEMENT_PROBLEM_NOT_PRIVATE_SAFETY_REPORT'}));
 assert.equal(problem.authoritative,true);assert.equal(Number(sql(`select count(*) from public.agreement_messages where agreement_id=${q(a.id)}::uuid`)),messagesBefore);
 assert.equal(events(a.id).filter(e=>e.event_type==='RECOVERY_OPENED').length,1);
 await ok(requester.rpc('rpc_cancel_agreement',{p_agreement_id:a.id,p_reason:'Private terminal reason'}));
 assert.equal(events(a.id).filter(e=>e.event_type==='AGREEMENT_CANCELLED').length,1);
 await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:b.id}));
 await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:b.id}));
 assert.equal(sql(`select status from public.agreements where id=${q(b.id)}::uuid`),'COMPLETED');
 pass(report,'PRIVATE_REPORT_CONTEXT_BOUNDS_REPLAY_NO_LEAKAGE_AND_ACTIVE_AGREEMENT_RECOVERY_CANCEL_COMPLETE_ESCAPE');
 const suppressed=sql(`select private.emit_event(${q(workerId)}::uuid,'WORKER','RESPONSE_VIEWED','RESPONSE',${q(pending.responseId)}::uuid,1,
 'Generic title','Generic body',${q('blocked-delivery:'+randomUUID())})`);
 assert.equal(sql(`select count(*) from public.notification_deliveries where event_id=${q(suppressed)}::uuid and state='SUPPRESSED' and suppression_reason='ACCOUNT_BLOCKED'`),'2');
 assert.ok(!(await ok(worker.rpc('rpc_list_inbox',{}))).items.some(x=>x.id===suppressed));
 await denied(worker.rpc('rpc_mark_activity_event_read',{p_event_id:suppressed}),'EVENT_NOT_FOUND');
 await set(false);
 // Old private grant must not revive: b is still completed, so use a separate active fixture.
 const g=await agreement('grant no resurrection');
 sql(`insert into public.need_sensitive(need_id,exact_address) values(${q(g.needId)}::uuid,'PRIVATE_ADDRESS_SENTINEL')`);
 await ok(requester.rpc('rpc_set_contact_grant',{p_agreement_id:g.id,p_channel:'EXACT_LOCATION',p_granted:true}));
 await set(true);await set(false);
 await denied(worker.rpc('rpc_reveal_contact',{p_agreement_id:g.id,p_channel:'EXACT_LOCATION'}),'NO_ACTIVE_GRANT');
 await ok(requester.rpc('rpc_set_contact_grant',{p_agreement_id:g.id,p_channel:'EXACT_LOCATION',p_granted:true}));
 assert.equal((await ok(worker.rpc('rpc_reveal_contact',{p_agreement_id:g.id,p_channel:'EXACT_LOCATION'}))).exactAddress,'PRIVATE_ADDRESS_SENTINEL');
 await submit(n);await ok(send(g.id));
 pass(report,'FUTURE_DELIVERY_SUPPRESSION_NO_GHOST_INBOX_UNBLOCK_AND_EXPLICIT_GRANT_RENEWAL');
 const rn=need('block race application');
 await denied(lockedRace(await blockStatement(),()=>worker.rpc('rpc_submit_response',command(rn))),'INTERACTION_BLOCKED');await set(false);
 const sn=need('block race selection'),sa=await submit(sn);
 await denied(lockedRace(await blockStatement(),()=>requester.rpc('rpc_select_response',{p_need_id:sn,p_need_revision:sa.needRevision,p_response_id:sa.responseId,
  p_response_version:sa.version,p_content_hash:sa.contentHash,p_client_request_id:randomUUID()})),'INTERACTION_BLOCKED');await set(false);
 const ma=await agreement('block race message');
 await denied(lockedRace(await blockStatement(),()=>send(ma.id)),'INTERACTION_BLOCKED');await set(false);
 assert.equal(sql(`select count(*) from public.marketplace_responses where need_id=${q(rn)}::uuid`),'0');
 assert.equal(sql(`select count(*) from public.agreements where need_id=${q(sn)}::uuid`),'0');
 assert.equal(sql(`select count(*) from public.agreement_messages where agreement_id=${q(ma.id)}::uuid`),'0');
 pass(report,'OBSERVED_POSTGRES_LOCK_WAITS_BLOCK_VS_APPLICATION_SELECTION_MESSAGE_ATOMIC_DENIAL');
 // Disposable transport fixture: close prior test pushes; no provider is called.
 sql("update public.notification_deliveries set state='EXPIRED' where channel='PUSH'");
 await prefs(worker,workerId,'WORKER',{push_enabled:true,dogovor_enabled:true,quiet_hours_enabled:false});
 await ok(worker.rpc('rpc_set_push_device_owned',{p_expected_user_id:workerId,p_expo_push_token:'ExpoPushToken[pre_v3_safety_test_token]',p_platform:'ANDROID',p_active:true,p_expected_revision:0}));
 const msg=await ok(send(ma.id));
 const claim=await ok(service.rpc('rpc_claim_push_transport',{p_kind:'SEND'}));assert.equal(claim.kind,'SEND');
 const begun=await ok(lockedRace(await blockStatement(),()=>service.rpc('rpc_begin_push_send',{p_attempt_id:claim.attemptId,p_lease_id:claim.leaseId})));
 assert.equal(begun.kind,'SUPPRESSED');
 assert.equal(sql(`select send_count from public.notification_push_attempts where id=${q(claim.attemptId)}::uuid`),'0');
 assert.equal((await ok(service.rpc('rpc_claim_push_transport',{p_kind:'SEND'}))).kind,'NONE');
 report.pushLinearization='Block serialized against begin-send transaction; already-started external sends cannot be recalled. No provider/network IO in this proof.';
 await set(false);
 for(const table of ['account_blocks','account_block_commands','safety_reports'])
  assert.equal(sql(`select has_table_privilege('authenticated','private.${table}','SELECT,INSERT,UPDATE,DELETE')`),'f');
 assert.equal(sql("select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in('account_blocks','account_block_commands','safety_reports') and not c.relrowsecurity)"),'f');
 pass(report,'QUEUED_PUSH_BLOCK_RECHECK_OBSERVED_WAIT_BEFORE_SEND_NO_PROVIDER_AND_PRIVATE_RLS');
});
