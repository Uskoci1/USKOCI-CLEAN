import {assert,randomUUID,sql,rows,q,ok,denied,requester,worker,anon,requesterId,workerId,
 login,prove,apply,pass,need,command,submit,agreement,events,prefs} from './closure_runtime.mjs';
await prove('PRE_V3_EVENT_SEMANTICS','event-semantics-report.json',async report=>{
 await apply(report,'20260912090000_clean_pre_v3_event_semantics.sql',116);await login();
 for(const [client,id,role] of [[requester,requesterId,'REQUESTER'],[worker,workerId,'WORKER']])
  await prefs(client,id,role,{in_app_enabled:true,push_enabled:true,responses_enabled:true,dogovor_enabled:true,quiet_hours_enabled:false});
 const n=need('event semantics'),key=randomUUID(),first=await submit(n,3000,key);
 assert.equal(first.version,1);assert.equal(events(first.responseId).filter(e=>e.event_type==='RESPONSE_RECEIVED').length,1);
 assert.equal((await submit(n,3000,key)).idempotentReplay,true);assert.equal(events(first.responseId).length,1);
 const updated=await submit(n,4000);assert.equal(updated.responseId,first.responseId);assert.equal(updated.version,2);
 let es=events(first.responseId);assert.deepEqual(es.map(e=>e.event_type),['RESPONSE_RECEIVED','RESPONSE_UPDATED']);
 await submit(n,4000);assert.equal(events(first.responseId).length,2);
 const concurrentKey=randomUUID();const concurrent=await Promise.all([submit(n,5000,concurrentKey),submit(n,5000,concurrentKey)]);
 assert.equal(concurrent[0].version,concurrent[1].version);assert.equal(events(first.responseId).length,3);
 await Promise.all([submit(n,6000),submit(n,7000)]);assert.equal(events(first.responseId).length,5);
 await denied(worker.rpc('rpc_submit_response',{...command(n),p_need_revision:2}),'STALE_REVIEW_REQUIRED');
 assert.equal(events(first.responseId).length,5);
 es=events(first.responseId);assert.ok(es.every(e=>e.recipient_user_id===requesterId&&e.recipient_role==='REQUESTER'&&e.entity_type==='RESPONSE'));
 assert.equal((await ok(requester.rpc('rpc_resolve_activity_event',{p_event_id:es[1].id}))).kind,'CANDIDATES');
 assert.ok((await ok(requester.rpc('rpc_list_inbox',{p_role:'REQUESTER'}))).items.filter(e=>es.some(x=>x.id===e.id)).every(e=>e.family==='responses'));
 pass(report,'FIRST_RECEIVED_REAL_UPDATE_ONLY_SAME_KEY_AND_SEMANTIC_RETRY_CONCURRENT_AND_STALE');
 for(let i=0;i<2;i++){await ok(requester.rpc('rpc_list_need_candidates',{p_need_id:n}));await ok(worker.rpc('rpc_list_my_applications',{}));}
 assert.equal(events(first.responseId).filter(e=>e.event_type==='RESPONSE_VIEWED').length,0);
 await denied(worker.rpc('rpc_mark_response_viewed',{p_response_id:first.responseId}),'NOT_REQUESTER');
 await Promise.all([ok(requester.rpc('rpc_mark_response_viewed',{p_response_id:first.responseId})),ok(requester.rpc('rpc_mark_response_viewed',{p_response_id:first.responseId}))]);
 const viewed=events(first.responseId).filter(e=>e.event_type==='RESPONSE_VIEWED');assert.equal(viewed.length,1);assert.equal(viewed[0].recipient_user_id,workerId);
 assert.equal((await ok(worker.rpc('rpc_resolve_activity_event',{p_event_id:viewed[0].id}))).kind,'APPLICATIONS');
 pass(report,'PROJECTION_READS_INERT_INTENTIONAL_FIRST_VIEW_ONCE_AND_WORKER_RECIPIENT');
 for(const [who,recipient] of [[requester,workerId],[worker,requesterId]]){
  const a=await agreement('cancel event');
  await Promise.all([ok(who.rpc('rpc_cancel_agreement',{p_agreement_id:a.id,p_reason:'PRIVATE_CANCEL_REASON'})),ok(who.rpc('rpc_cancel_agreement',{p_agreement_id:a.id,p_reason:'PRIVATE_CANCEL_REASON'}))]);
  const cancelled=events(a.id).filter(e=>e.event_type==='AGREEMENT_CANCELLED');assert.equal(cancelled.length,1);assert.equal(cancelled[0].recipient_user_id,recipient);
  assert.deepEqual(cancelled[0].payload,{agreementId:a.id,state:'CANCELLED'});
  const delivery=rows(`select channel,state,title,body from public.notification_deliveries where event_id=${q(cancelled[0].id)}::uuid`);
  assert.equal(delivery.length,2);assert.ok(delivery.every(d=>d.state==='CREATED'));assert.ok(!JSON.stringify(delivery).includes('PRIVATE_CANCEL_REASON'));
 }
 const completed=await agreement('terminal cancel');await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:completed.id}));
 await denied(requester.rpc('rpc_cancel_agreement',{p_agreement_id:completed.id,p_reason:'PRIVATE_CANCEL_REASON'}),'ALREADY_COMPLETED');
 assert.equal(events(completed.id).filter(e=>e.event_type==='AGREEMENT_CANCELLED').length,0);
 pass(report,'REQUESTER_WORKER_CANCEL_CONCURRENT_REPLAY_TERMINAL_DENIAL_AND_REASON_NOT_LEAKED');
 const editNeed=need('revision event'),app=await submit(editNeed);
 const material=JSON.parse(sql(`select private.need_material_snapshot(${q(editNeed)}::uuid)`));
 // Existing RPC accepts its bounded material shape, not later snapshot metadata.
 const allowed=['title','description','category','requiredSlots','mode','requesterPriceRsd','requiredSkills','requiredTools','requiredVehicles','requiredLicenses','minimumExperienceYears','verifiedIdentityRequired','scheduleKind','startsAt','endsAt','executionLocationMode','approximateLat','approximateLng','approximateCity','approximateArea','publicPhotoPaths','privateLocation'];
 const edit={p_need_id:editNeed,p_expected_revision:1,p_client_request_id:randomUUID(),p_material:Object.fromEntries(allowed.map(k=>[k,material[k]]))};
 edit.p_material.title='Izmenjen javni naslov';edit.p_material.privateLocation={exactAddress:'PRIVATE_LOCATION_TEST',accessNotes:'PRIVATE_ACCESS_TEST',exactLat:null,exactLng:null};
 await ok(requester.rpc('rpc_confirm_need_edit',edit));await ok(requester.rpc('rpc_confirm_need_edit',edit));
 const revised=events(app.responseId).filter(e=>e.event_type==='NEED_REVISED');assert.equal(revised.length,1);assert.equal(revised[0].recipient_user_id,workerId);
 assert.equal(revised[0].payload.needRevision,2);assert.ok(!JSON.stringify(revised).includes('PRIVATE_'));
 assert.equal((await ok(worker.rpc('rpc_resolve_activity_event',{p_event_id:revised[0].id}))).kind,'APPLICATIONS');
 assert.equal(sql(`select status from public.needs where id=${q(editNeed)}::uuid`),'DRAFT');
 await denied(worker.rpc('rpc_submit_response',{...command(editNeed),p_need_revision:1}),'NEED_NOT_OPEN');
 pass(report,'REAL_NEED_REVISION_AFFECTED_WORKER_ONCE_PRIVATE_FIELDS_ABSENT_OWN_APPLICATION_TARGET');
 await prefs(requester,requesterId,'REQUESTER',{responses_enabled:false});
 const hiddenNeed=need('suppressed'),hidden=await submit(hiddenNeed);const hiddenEvent=events(hidden.responseId)[0];
 const hiddenList=await ok(requester.rpc('rpc_list_inbox',{}));assert.ok(!hiddenList.items.some(e=>e.id===hiddenEvent.id));
 await denied(requester.rpc('rpc_mark_activity_event_read',{p_event_id:hiddenEvent.id}),'EVENT_NOT_FOUND');
 await denied(requester.rpc('rpc_resolve_activity_event',{p_event_id:hiddenEvent.id}),'EVENT_NOT_FOUND');
 await prefs(requester,requesterId,'REQUESTER',{responses_enabled:true,quiet_hours_enabled:true,quiet_start:'00:00:00',quiet_end:'00:00:00',quiet_timezone:'UTC'});
 const quiet=await submit(need('quiet'));const quietEvent=events(quiet.responseId)[0];
 assert.ok((await ok(requester.rpc('rpc_list_inbox',{}))).items.some(e=>e.id===quietEvent.id));
 assert.equal(sql(`select suppression_reason from public.notification_deliveries where event_id=${q(quietEvent.id)}::uuid and channel='PUSH'`),'QUIET_HOURS');
 const page=await ok(requester.rpc('rpc_list_inbox',{p_role:'REQUESTER',p_limit:2}));assert.equal(page.items.length,2);assert.equal(page.hasMore,true);
 const cursor=page.items.at(-1);const second=await ok(requester.rpc('rpc_list_inbox',{p_role:'REQUESTER',p_limit:2,p_before_at:cursor.occurredAt,p_before_id:cursor.id}));
 assert.ok(second.items.every(e=>!page.items.some(x=>x.id===e.id)));assert.ok([...page.items,...second.items].every(e=>e.role==='REQUESTER'));
 await denied(worker.rpc('rpc_mark_activity_event_read',{p_event_id:quietEvent.id}),'EVENT_NOT_FOUND');
 await ok(requester.rpc('rpc_mark_inbox_read',{p_role:'REQUESTER',p_through:page.asOf}));
 assert.equal(sql(`select read_at is null from public.user_activity_events where id=${q(hiddenEvent.id)}::uuid`),'t');
 await denied(anon.rpc('rpc_list_inbox',{}));
 assert.equal(sql("select private.category_of_event('CLARIFICATION_CREATED')||'/'||private.category_of_event('CLARIFICATION_ANSWERED')"),'responses/responses');
 assert.equal(sql("select count(*) from public.user_activity_events where event_type='REVIEW_RECEIVED'"),'0');
 await prefs(requester,requesterId,'REQUESTER',{quiet_hours_enabled:false});
 pass(report,'INBOX_SUPPRESSION_UNREAD_PAGINATION_READ_ALL_OWNER_INTENT_AND_QUIET_HOURS_REGRESSION');
});
