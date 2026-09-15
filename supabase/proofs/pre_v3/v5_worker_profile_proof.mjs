// Disposable Auth/Postgres PROFILE proof; all AI outputs explicitly synthetic.
// No live provider, task-fact reuse, policy activation or publication occurs.
import {assert,rows,sql,prove,pass,apply,actor,anon,service,ok,denied,randomUUID,q,lockedRace} from './closure_runtime.mjs';
const file='20260912220506_clean_v5_owned_worker_profile.sql';
const prepare=(a,s,activate=true)=>ok(a.client.rpc('rpc_prepare_worker_ai_review',{p_conversation_id:s.conversationId,p_expected_revision:s.revision,p_activate:activate}));
const read=(a,cid)=>ok(a.client.rpc('rpc_read_worker_ai',{p_conversation_id:cid}));
const save=(a,r,key=randomUUID())=>a.client.rpc('rpc_save_worker_ai_review',{p_review_id:r.reviewId,p_displayed_digest:r.displayedContentDigest,p_client_request_id:key});
const patch=(a,s,value)=>ok(a.client.rpc('rpc_patch_worker_ai',{p_conversation_id:s.conversationId,p_expected_revision:s.revision,p_patch:value}));
const identity=(a,s,key)=>({p_account_id:a.id,p_conversation_id:s.conversationId,p_client_request_id:key});

await prove('V5_WORKER_PROFILE','v5-worker-profile-report.json',async report=>{
 await apply(report,file,127);
 const owner=await actor('worker-ai-owner'),other=await actor('worker-ai-other');
 // Auth normally bootstraps DRAFT profiles. This privileged disposable fixture
 // simulates an older account with a missing worker profile, exercising the same
 // canonical bootstrap path as the retained manual editor. No live row is used.
 sql(`delete from public.app_profiles where account_id=${q(owner.id)}::uuid and kind='WORKER'`);
 for(const table of ['worker_ai_sessions','worker_ai_turns','worker_ai_reviews','worker_ai_saves']){
  assert.equal(sql(`select relrowsecurity from pg_class where oid=${q('private.'+table)}::regclass`),'t');
  for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');
 }
 assert.equal(sql(`select has_function_privilege('authenticated','public.rpc_complete_worker_ai_turn_service(uuid,uuid,uuid,uuid,jsonb)','EXECUTE')`),'f');
 await denied(anon.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}));
 const openKey=randomUUID(),s=await ok(owner.client.rpc('rpc_open_worker_ai',{p_client_request_id:openKey}));
 assert.equal(s.schemaVersion,'WORKER_PROFILE_V1');assert.equal(s.revision,0);assert.equal(s.status,'OPEN');
 assert.deepEqual(await ok(owner.client.rpc('rpc_open_worker_ai',{p_client_request_id:openKey})),s);
 assert.equal(sql(`select count(*) from public.app_profiles where account_id=${q(owner.id)}::uuid and kind='WORKER'`),'0');
 assert.equal(sql(`select purpose from public.ai_conversations where id=${q(s.conversationId)}::uuid`),'PROFILE');
 await denied(other.client.rpc('rpc_read_worker_ai',{p_conversation_id:s.conversationId}),'WORKER_AI_DENIED');
 await denied(other.client.rpc('rpc_patch_worker_ai',{p_conversation_id:s.conversationId,p_expected_revision:0,p_patch:{bio:'forbidden'}}),'WORKER_AI_DENIED');
 await denied(service.rpc('rpc_read_worker_ai_context_service',{p_account_id:other.id,p_conversation_id:s.conversationId}),'WORKER_AI_DENIED');
 pass(report,'OWNED_PROFILE_SCHEMA_PRIVATE_ACL_IDEMPOTENT_OPEN_DOES_NOT_CREATE_CANONICAL_PROFILE');

 const key=randomUUID(),args={...identity(owner,s,key),p_text:'SYNTHETIC: prenosim stvari, imamo alat i kombi, nas troje radimo u Beogradu.'};
 const claims=await Promise.all([ok(service.rpc('rpc_claim_worker_ai_turn_service',args)),ok(service.rpc('rpc_claim_worker_ai_turn_service',args))]);
 assert.equal(claims.filter(c=>c.acquired).length,1);assert.equal(claims[0].turn.turnId,claims[1].turn.turnId);
 await denied(service.rpc('rpc_claim_worker_ai_turn_service',{...args,p_text:'Different replay'}),'WORKER_AI_REQUEST_CONFLICT');
 await denied(owner.client.rpc('rpc_patch_worker_ai',{p_conversation_id:s.conversationId,p_expected_revision:0,p_patch:{bio:'Concurrent candidate'}}),'WORKER_AI_TURN_PENDING');
 const output={assistantMessage:'Predlog radnog profila je pripremljen. Pregledajte podatke zajedno.',safety:'ALLOW',patch:{
  displayName:'Disposable V5 Worker',bio:'Owner supplied profile',skills:['Prenos stvari'],tools:['Ručni alat'],vehicles:['Kombi'],licenses:['Samostalno navedena licenca'],teamCapacity:3,
  location:{operatingCountryCode:'RS',city:'Beograd',radiusKm:25},availability:{availableNow:true,ruleChanges:[{
   ruleId:null,weekdays:[0,1,2,3,4,5,6],value:{startTime:'09:00',endTime:'17:00',startsOn:'2026-01-01',endsOn:null,label:'Svaki dan',active:true}}],
   windowsUpsert:[{id:null,startsAt:'2026-11-05T08:00:00Z',endsAt:'2026-11-05T16:00:00Z',state:'UNAVAILABLE',label:'Postojeći izuzetak'}]}}};
 const completedArgs={...identity(owner,s,key),p_attempt_id:claims[0].turn.attemptId,p_output:output};
 await denied(service.rpc('rpc_complete_worker_ai_turn_service',{...completedArgs,p_attempt_id:null}),'WORKER_AI_DENIED');
 await denied(service.rpc('rpc_complete_worker_ai_turn_service',{...completedArgs,p_output:{...output,patch:{'need.title':'Wrong domain'}}}),'WORKER_AI_PATCH_INVALID');
 await denied(service.rpc('rpc_complete_worker_ai_turn_service',{...completedArgs,p_output:{...output,patch:{location:{approximatePosition:{latitude:44.81,longitude:20.46}}}}}),'WORKER_AI_PATCH_INVALID');
 const completed=await ok(service.rpc('rpc_complete_worker_ai_turn_service',completedArgs));assert.equal(completed.state,'SUCCEEDED');
 assert.deepEqual(await ok(service.rpc('rpc_complete_worker_ai_turn_service',completedArgs)),completed);
 await denied(service.rpc('rpc_complete_worker_ai_turn_service',{...completedArgs,p_output:{...output,assistantMessage:'Changed replay'}}),'WORKER_AI_REQUEST_CONFLICT');
 let next=await read(owner,s.conversationId);
 assert.equal(next.candidate.teamCapacity,3);assert.equal(next.candidate.location.approximatePosition,null);
 assert.equal(next.messages.length,2);assert.equal(sql(`select count(*) from public.ai_structured_facts where conversation_id=${q(s.conversationId)}::uuid`),'0');
 assert.equal(sql(`select count(*) from public.app_profiles where account_id=${q(owner.id)}::uuid and kind='WORKER'`),'0');
 pass(report,'ONE_CLAIM_REAL_OWNED_MESSAGES_TYPED_PROFILE_PATCH_NO_NEED_FACTS_NO_COORDINATE_INVENTION_EXACT_COMPLETION_REPLAY');

 const oldRule=next.candidate.availability.rules[0],oldWindows=next.candidate.availability.windows;
 next=await patch(owner,next,{availability:{ruleChanges:[{ruleId:oldRule.id,weekdays:[0,6],value:{startTime:'10:00',endTime:'14:00',startsOn:'2026-01-01',endsOn:null,label:'Vikend',active:true}}]}});
 assert.deepEqual(next.candidate.availability.rules.find(r=>r.id===oldRule.id).weekdays,[1,2,3,4,5]);
 assert.deepEqual(next.candidate.availability.rules.find(r=>r.id!==oldRule.id).weekdays,[0,6]);assert.deepEqual(next.candidate.availability.windows,oldWindows);
 await denied(owner.client.rpc('rpc_patch_worker_ai',{p_conversation_id:s.conversationId,p_expected_revision:null,p_patch:{bio:'No CAS'}}),'WORKER_AI_STALE');
 await denied(owner.client.rpc('rpc_patch_worker_ai',{p_conversation_id:s.conversationId,p_expected_revision:next.revision,p_patch:{verifiedIdentity:true}}),'WORKER_AI_PATCH_INVALID');
 await denied(owner.client.rpc('rpc_patch_worker_ai',{p_conversation_id:s.conversationId,p_expected_revision:next.revision,p_patch:{availability:{ruleChanges:[{ruleId:oldRule.id,weekdays:[0],value:null}]}}}),'WORKER_AI_RULE_STALE');
 const staleReview=await prepare(owner,next);next=await patch(owner,next,{bio:'Reviewed new biography'});
 await denied(save(owner,staleReview),'WORKER_AI_STALE');
 const r=await prepare(owner,next);assert.equal(r.canAccept,true);assert.equal(r.activate,true);assert.match(r.displayedContentDigest,/^[0-9a-f]{64}$/);
 assert.deepEqual(await prepare(owner,next),r);assert.equal(sql(`select count(*) from public.app_profiles where account_id=${q(owner.id)}::uuid and kind='WORKER'`),'0');
 assert.throws(()=>sql(`update private.worker_ai_reviews set envelope=envelope where id=${q(r.reviewId)}::uuid`),/TASK_REVIEW_IMMUTABLE/);
 await denied(save(other,r),'WORKER_AI_DENIED');await denied(owner.client.rpc('rpc_save_worker_ai_review',{p_review_id:r.reviewId,p_displayed_digest:'0'.repeat(64),p_client_request_id:randomUUID()}),'WORKER_AI_DENIED');
 pass(report,'WEEKEND_EDIT_PRESERVES_WEEKDAYS_AND_DATED_EXCEPTIONS_SINGLE_IMMUTABLE_REVIEW_NO_PREFETCH_ACCEPT');

 const saveKey=randomUUID(),receipts=await Promise.all([ok(save(owner,r,saveKey)),ok(save(owner,r,saveKey))]);assert.deepEqual(receipts[0],receipts[1]);
 assert.equal(receipts[0].profileStatus,'ACTIVE');assert.equal(receipts[0].profileId,s.profileId);
 const after=await read(owner,s.conversationId);assert.equal(after.status,'COMPLETED');assert.deepEqual(after.saved,receipts[0]);
 assert.deepEqual(await ok(save(owner,r,randomUUID())),receipts[0]);
 const profile=rows(`select id,display_name,bio,skills,tools,vehicles,licenses,team_capacity,profile_status,available_now,operating_country_code,city,radius_km
 from public.app_profiles where id=${q(s.profileId)}::uuid`)[0];
 assert.equal(profile.team_capacity,3);assert.equal(profile.available_now,true);assert.equal(profile.operating_country_code,'RS');assert.equal(profile.city,'Beograd');
 assert.deepEqual(profile.skills,['Prenos stvari']);assert.deepEqual(profile.licenses,['Samostalno navedena licenca']);
 assert.equal(sql(`select count(*) from public.profile_availability_rules where profile_id=${q(s.profileId)}::uuid`),'2');
 assert.equal(sql(`select count(*) from public.profile_availability_windows where profile_id=${q(s.profileId)}::uuid`),'1');
 assert.equal(sql(`select count(*) from private.worker_ai_saves where review_id=${q(r.reviewId)}::uuid`),'1');
 pass(report,'PARALLEL_SINGLE_ACCEPT_ATOMIC_CANONICAL_IDENTITY_RESOURCES_LOCATION_AVAILABILITY_CAPACITY_ACTIVATION_LOST_RESPONSE_RECOVERY');

 let edit=await ok(owner.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}));assert.equal(edit.profileId,s.profileId);assert.equal(edit.profileStatus,'ACTIVE');
 edit=await patch(owner,edit,{teamCapacity:2});const er=await prepare(owner,edit,false);
 await denied(save(owner,er,saveKey),'WORKER_AI_REQUEST_CONFLICT');
 await denied(lockedRace(`update public.app_profiles set bio='Concurrent canonical owner edit' where id=${q(s.profileId)}::uuid`,()=>save(owner,er)),'WORKER_AI_STALE');
 assert.equal(sql(`select team_capacity from public.app_profiles where id=${q(s.profileId)}::uuid`),'3');
 assert.equal((await read(owner,edit.conversationId)).stale,true);
 await ok(owner.client.rpc('rpc_abandon_worker_ai',{p_conversation_id:edit.conversationId}));
 edit=await ok(owner.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}));
 const pendingKey=randomUUID(),pendingArgs={...identity(owner,edit,pendingKey),p_text:'SYNTHETIC pending attempt'};
 const pending=await ok(service.rpc('rpc_claim_worker_ai_turn_service',pendingArgs));
 sql(`update private.worker_ai_turns set lease_expires_at=clock_timestamp()-interval '1 second' where turn_id=${q(pending.turn.turnId)}::uuid`);
 const replay=await ok(service.rpc('rpc_claim_worker_ai_turn_service',pendingArgs));assert.equal(replay.acquired,false);assert.equal(replay.turn.state,'UNKNOWN_OUTCOME');
 await denied(service.rpc('rpc_complete_worker_ai_turn_service',{...identity(owner,edit,pendingKey),p_attempt_id:pending.turn.attemptId,p_output:output}),'WORKER_AI_TURN_STALE');
 await denied(service.rpc('rpc_claim_worker_ai_turn_service',{...identity(owner,edit,randomUUID()),p_text:'No new provider while unknown'}),'WORKER_AI_TURN_PENDING');
 await denied(owner.client.rpc('rpc_prepare_worker_ai_review',{p_conversation_id:edit.conversationId,p_expected_revision:edit.revision,p_activate:false}),'WORKER_AI_TURN_PENDING');
 await ok(owner.client.rpc('rpc_abandon_worker_ai',{p_conversation_id:edit.conversationId}));
 await denied(service.rpc('rpc_read_worker_ai_context_service',{p_account_id:owner.id,p_conversation_id:edit.conversationId}),'WORKER_AI_NOT_EDITABLE');
 const fresh=await ok(owner.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}));assert.notEqual(fresh.conversationId,edit.conversationId);
 await denied(service.rpc('rpc_complete_worker_ai_turn_service',{...identity(owner,edit,pendingKey),p_attempt_id:pending.turn.attemptId,p_output:output}),'WORKER_AI_TURN_STALE');
 assert.equal((await read(owner,edit.conversationId)).status,'ABANDONED');assert.equal((await read(owner,fresh.conversationId)).revision,0);
 const lateKey=randomUUID(),late=await ok(service.rpc('rpc_claim_worker_ai_turn_service',{...identity(owner,fresh,lateKey),p_text:'SYNTHETIC cancel before completion'}));
 await ok(owner.client.rpc('rpc_abandon_worker_ai',{p_conversation_id:fresh.conversationId}));
 await denied(service.rpc('rpc_complete_worker_ai_turn_service',{...identity(owner,fresh,lateKey),p_attempt_id:late.turn.attemptId,p_output:output}),'WORKER_AI_NOT_EDITABLE');
 assert.equal((await read(owner,fresh.conversationId)).status,'ABANDONED');
 pass(report,'BOUND_PROFILE_EDIT_SOURCE_RACE_NO_PARTIAL_SAVE_UNKNOWN_PROVIDER_NO_RECLAIM_NO_LATE_COMPLETION_ABANDON_FENCES_SPEECH');

 const raceOwner=await actor('worker-ai-two-reviews');let race=await ok(raceOwner.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}));
 const initialCanonical=sql(`select to_jsonb(p)::text from public.app_profiles p where id=${q(race.profileId)}::uuid`);
 race=await patch(raceOwner,race,{displayName:'Disposable race',skills:['Test veština']});
 const activateReview=await prepare(raceOwner,race,true),draftReview=await prepare(raceOwner,race,false);
 assert.notEqual(activateReview.reviewId,draftReview.reviewId);
 assert.equal(sql(`select to_jsonb(p)::text from public.app_profiles p where id=${q(race.profileId)}::uuid`),initialCanonical);
 const competing=await Promise.all([save(raceOwner,activateReview),save(raceOwner,draftReview)]);
 assert.equal(competing.filter(r=>r.error===null).length,1);assert.equal(competing.find(r=>r.error)?.error.message,'WORKER_AI_NOT_EDITABLE');
 assert.equal(sql(`select count(*) from private.worker_ai_saves where account_id=${q(raceOwner.id)}::uuid`),'1');
 assert.equal(sql(`select count(*) from public.app_profiles where account_id=${q(raceOwner.id)}::uuid and kind='WORKER'`),'1');
 const restricted=await ok(raceOwner.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()})),restrictedReview=await prepare(raceOwner,restricted,false);
 // Administrative status is deliberately a privileged fixture. No status RPC,
 // policy, trigger definition or source ACL is changed by this proof.
 sql(`begin;set local session_replication_role='replica';update public.app_profiles set profile_status='SUSPENDED' where id=${q(race.profileId)}::uuid;commit;`);
 await denied(save(raceOwner,restrictedReview),'WORKER_AI_STALE');
 await ok(raceOwner.client.rpc('rpc_abandon_worker_ai',{p_conversation_id:restricted.conversationId}));
 await denied(raceOwner.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}),'WORKER_PROFILE_RESTRICTED');
 assert.equal(sql(`select profile_status from public.app_profiles where id=${q(race.profileId)}::uuid`),'SUSPENDED');
 pass(report,'TWO_DIFFERENT_REVIEW_IDS_ONE_CANONICAL_ACCEPT_EXISTING_DRAFT_UNCHANGED_ON_PREPARE_RESTRICTED_PROFILE_NO_ACTIVATION');
});
