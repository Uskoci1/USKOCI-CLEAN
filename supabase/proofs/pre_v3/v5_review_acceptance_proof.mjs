// Actual disposable Auth/Postgres authority proof. Provider results below are
// explicitly synthetic, exercise B06, and never call a live LLM or STT provider.
import {assert,rows,sql,prove,pass,apply,login,requester,worker,anon,service,ok,denied,requesterId,randomUUID,q,lockedRace} from './closure_runtime.mjs';
import {migrationSnapshotQuery} from './history_snapshot.mjs';
import {locationCases,syntheticNonlocationFacts} from '../policy/publication_fixtures.mjs';

const file='20260912213702_clean_v5_review_acceptance.sql';
const args=(review,key=randomUUID())=>({p_review_id:review.reviewId,p_displayed_content_digest:review.displayedContentDigest,p_client_request_id:key});
const accept=(review,key)=>requester.rpc('rpc_accept_ai_task_review',args(review,key));
const read=rid=>ok(requester.rpc('rpc_read_ai_task_review',{p_review_id:rid}));
const review=async(cid,location)=>{
 const l=await ok(requester.rpc('rpc_get_need_location_review',{p_conversation_id:cid}));
 return ok(requester.rpc('rpc_prepare_ai_task_review',{p_conversation_id:cid,p_response_deadline:null,p_location:{expectedRevision:l.revision,value:location}}));
};
async function conversation(){
 const cid=await ok(requester.rpc('rpc_ai_open_need_conversation_v2'));
 const key=randomUUID(),message='Disposable V5 request: potrebna pomoć za prenos ormara.';
 const claim=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{p_account_id:requesterId,p_conversation_id:cid,p_client_request_id:key,p_user_message:message}));
 await ok(service.rpc('rpc_ai_complete_need_turn_v2_service',{p_account_id:requesterId,p_conversation_id:cid,p_client_request_id:key,
  p_attempt_id:claim.claim.attemptId,p_user_message:message,p_assistant_message:'Predlog zadatka je spreman za pregled.',p_safety:'ALLOW',
  p_proposals:syntheticNonlocationFacts.map(([key,value])=>({key,value,displayValue:String(value),evidence:'Disposable V5 input',confidence:1}))}));
 return cid;
}
const claim=(r,c,binding)=>service.rpc('rpc_claim_ai_task_review_evaluation_service',{p_account_id:requesterId,p_review_id:r.reviewId,p_need_id:c.needId,p_need_revision:c.needRevision,p_binding:binding});
const completeArgs=(r,attempt,patch={})=>({p_account_id:requesterId,p_review_id:r.reviewId,p_attempt_id:attempt,p_outcome:'ALLOW',p_rule_ids:['RS-MIN-001'],
 p_safe_reason_codes:['CLEAR_CONCRETE_TASK'],p_provider_ref:'DISPOSABLE_V5_PROOF',p_model_ref:'NO_REAL_PROVIDER',p_not_ready_code:null,...patch});
const complete=(r,a,patch)=>service.rpc('rpc_complete_ai_task_review_evaluation_service',completeArgs(r,a,patch));
const publish=c=>requester.rpc('rpc_publish_accepted_ai_task_review',{p_review_id:c.reviewId,p_client_request_id:c.clientRequestId});
const context=c=>ok(requester.rpc('rpc_get_need_publication_context',{p_need_id:c.needId,p_expected_revision:c.needRevision}));

await prove('V5_REVIEW_ACCEPTANCE','v5-review-acceptance-report.json',async report=>{
 await apply(report,file,125); await login(); const history=rows(migrationSnapshotQuery());assert.equal(history.length,126);
 const acl=rows(`select relname,relrowsecurity from pg_class where oid in('private.ai_task_reviews'::regclass,'private.ai_task_review_commands'::regclass)`);
 assert.ok(acl.every(x=>x.relrowsecurity));
 for(const role of ['anon','authenticated','service_role']) for(const table of ['ai_task_reviews','ai_task_review_commands'])
  assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');
 const serviceFn='public.rpc_claim_ai_task_review_evaluation_service(uuid,uuid,uuid,integer,jsonb)';
 assert.equal(sql(`select has_function_privilege('authenticated',${q(serviceFn)},'EXECUTE')`),'f');
 assert.equal(sql(`select has_function_privilege('anon',${q(serviceFn)},'EXECUTE')`),'f');
 assert.equal(sql(`select has_function_privilege('service_role',${q(serviceFn)},'EXECUTE')`),'t');
 pass(report,'PRIVATE_RLS_TABLES_NO_CLIENT_OR_SERVICE_DIRECT_ACCESS_SERVICE_CLAIM_EXECUTE_ONLY');

 const cid=await conversation(),loc=structuredClone(locationCases.find(x=>x.id==='route-complete-reordered').value);
 loc.exactAddress='PRIVATE_V5_ADDRESS_SENTINEL';loc.accessNotes='PRIVATE_V5_ACCESS_SENTINEL';loc.resolvedLocation.binding.exactAddress=loc.exactAddress;
 loc.resolvedLocation.points[0].origin={kind:'PROVIDER_CANDIDATE',providerHint:'locationiq',candidateHint:'DISPOSABLE_CANDIDATE'};
 const before=sql(`select count(*) from public.needs where requester_account_id=${q(requesterId)}::uuid`);
 const r0=await review(cid,loc);assert.equal(r0.canAccept,true);assert.match(r0.displayedContentDigest,/^[a-f0-9]{64}$/);
 assert.equal(r0.draftId,null);assert.equal(r0.draftRevision,0);assert.deepEqual(await review(cid,loc),r0);
 assert.ok(!JSON.stringify(r0.publicProjection).includes('PRIVATE_V5_'));assert.ok(!JSON.stringify(r0.publicProjection).includes('latitudeE6'));
 assert.ok(JSON.stringify(r0.ownerPrivateProjection).includes('PRIVATE_V5_ADDRESS_SENTINEL'));
 assert.equal(sql(`select count(*) from public.ai_structured_facts where conversation_id=${q(cid)}::uuid and status='CONFIRMED'`),'0');
 assert.equal(sql(`select count(*) from public.needs where requester_account_id=${q(requesterId)}::uuid`),before);
 assert.equal((await read(r0.reviewId)).command,null);
 await denied(worker.rpc('rpc_read_ai_task_review',{p_review_id:r0.reviewId}),'TASK_REVIEW_NOT_FOUND');
 await denied(worker.rpc('rpc_accept_ai_task_review',args(r0)),'TASK_REVIEW_NOT_FOUND');
 await denied(anon.rpc('rpc_read_ai_task_review',{p_review_id:r0.reviewId}));
 await denied(requester.rpc('rpc_accept_ai_task_review',{...args(r0),p_displayed_content_digest:'0'.repeat(64)}),'TASK_REVIEW_DIGEST_MISMATCH');
 assert.throws(()=>sql(`update private.ai_task_reviews set envelope=envelope where id=${q(r0.reviewId)}::uuid`),/TASK_REVIEW_IMMUTABLE/);
 pass(report,'PREPARE_AND_READ_DO_NOT_ACCEPT_OR_CREATE_DRAFT_IMMUTABLE_OWNER_REVIEW_PRIVATE_PUBLIC_BOUNDARY');

 const fact=rows(`select id from public.ai_structured_facts where conversation_id=${q(cid)}::uuid and fact_key='need.title' and superseded_at is null`)[0];
 await ok(requester.rpc('rpc_ai_correct_fact_v2',{p_fact_id:fact.id,p_value:'Ispravljen isti zadatak',p_display_value:'Ispravljen isti zadatak'}));
 await denied(accept(r0),'TASK_REVIEW_STALE');
 await denied(requester.rpc('rpc_prepare_ai_task_review',{p_conversation_id:cid,p_response_deadline:null,p_location:{expectedRevision:'0'.repeat(64),value:loc}}),'LOCATION_VERSION_CONFLICT');
 const r1=await review(cid,loc),bundle=rows(`select id,review_provenance from private.publication_policy_bundles where id=private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM','RS',clock_timestamp())`)[0];
 await denied(lockedRace(`update private.publication_policy_bundles set review_provenance=review_provenance||'{"disposableV5Race":true}'::jsonb where id=${q(bundle.id)}::uuid`,()=>accept(r1)),'TASK_REVIEW_POLICY_STALE');
 sql(`update private.publication_policy_bundles set review_provenance=${q(JSON.stringify(bundle.review_provenance))}::jsonb where id=${q(bundle.id)}::uuid`);
 const r=await review(cid,loc);
 const closureBefore=rows(`select state from private.account_closure_requests where account_id=${q(requesterId)}::uuid`)[0];
 assert.ok(closureBefore,'P10 predecessor closure fixture is required');
 await denied(lockedRace(`select pg_advisory_xact_lock(private.closure_account_key(${q(requesterId)}::uuid));update private.account_closure_requests set state='EXECUTING' where account_id=${q(requesterId)}::uuid`,()=>accept(r)),'ACCOUNT_CLOSING');
 sql(`update private.account_closure_requests set state=${q(closureBefore.state)} where account_id=${q(requesterId)}::uuid`);
 pass(report,'STALE_FACT_GEOGRAPHY_REVISION_AND_OBSERVED_POLICY_CLOSURE_RACES_REJECT_UNSEEN_ACCEPTANCE');

 // Expired review row is an explicitly synthetic privileged fixture. Production
 // callers cannot edit review timestamps or create such a row.
 const expiredId=randomUUID();
 sql(`insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,created_at,expires_at)
 select ${q(expiredId)}::uuid,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,clock_timestamp()-interval '20 minutes',clock_timestamp()-interval '1 minute'
 from private.ai_task_reviews where id=${q(r.reviewId)}::uuid`);
 await denied(requester.rpc('rpc_accept_ai_task_review',{...args(r),p_review_id:expiredId}),'TASK_REVIEW_EXPIRED');
 const key=randomUUID(),accepted=await Promise.all([ok(accept(r,key)),ok(accept(r,key))]);
 assert.deepEqual(accepted[0],accepted[1]);const c=accepted[0];assert.equal(c.state,'ACCEPTED');
 assert.equal(sql(`select count(*) from private.ai_task_review_commands where review_id=${q(r.reviewId)}::uuid`),'1');
 assert.equal(sql(`select count(*) from private.need_draft_save_commands where conversation_id=${q(cid)}::uuid`),'1');
 assert.equal(sql(`select count(*) from public.ai_structured_facts where conversation_id=${q(cid)}::uuid and superseded_at is null and status<>'CONFIRMED'`),'0');
 const recovered=await read(r.reviewId);assert.deepEqual(recovered.review,r);assert.deepEqual(recovered.command,c);
 assert.deepEqual(await ok(requester.rpc('rpc_read_latest_ai_task_review',{p_conversation_id:cid})),recovered);
 assert.deepEqual(await ok(accept(r,key)),c);
 pass(report,'EXPIRED_REVIEW_DENIED_CONCURRENT_FINAL_ACCEPT_EXACTLY_ONE_DRAFT_DURABLE_COMPLETED_CONVERSATION_RECOVERY');

 const cid2=await conversation(),r2=await review(cid2,locationCases.find(x=>x.id==='remote-exempt').value);
 await denied(accept(r2,key),'IDEMPOTENCY_KEY_REUSED');
 assert.equal((await read(r2.reviewId)).command,null);
 const ctx=await context(c);assert.equal(ctx.kind,'READY');
 const claims=await Promise.all([ok(claim(r,c,ctx.binding)),ok(claim(r,c,ctx.binding))]);
 assert.equal(claims.filter(x=>x.acquired).length,1);const attempt=claims.find(x=>x.acquired).attemptId;
 assert.equal((await ok(claim(r,c,ctx.binding))).acquired,false);
 await denied(requester.rpc('rpc_complete_ai_task_review_evaluation_service',completeArgs(r,attempt)));
 const decisions=await Promise.all([ok(complete(r,attempt)),ok(complete(r,attempt))]);assert.deepEqual(decisions[0],decisions[1]);
 assert.equal(decisions[0].decision.outcome,'ALLOW');
 await denied(complete(r,attempt,{p_outcome:'BLOCK'}),'IDEMPOTENCY_KEY_REUSED');
 assert.equal(sql(`select count(*) from private.need_publication_decisions where need_id=${q(c.needId)}::uuid`),'1');
 assert.equal((await ok(claim(r,c,ctx.binding))).command.state,'EVALUATED');
 pass(report,'SAME_KEY_CHANGED_REVIEW_DENIED_ONE_DURABLE_EVALUATOR_CLAIM_ONE_B06_DECISION_CHANGED_COMPLETION_DENIED');

 const receipts=await Promise.all([ok(publish(c)),ok(publish(c))]);assert.deepEqual(receipts[0],receipts[1]);
 assert.equal(receipts[0].state,'PUBLISHED');assert.equal(receipts[0].published.needId,c.needId);
 assert.equal(sql(`select status from public.needs where id=${q(c.needId)}::uuid`),'PUBLISHED');
 assert.equal(sql(`select count(*) from private.need_publish_commands where need_id=${q(c.needId)}::uuid`),'1');
 assert.equal(sql(`select count(*) from private.dispatch_schedule where need_id=${q(c.needId)}::uuid`),'1');
 assert.equal((await ok(worker.from('needs').select('id,title').eq('id',c.needId))).length,1);
 assert.equal((await ok(worker.from('need_sensitive').select('need_id').eq('need_id',c.needId))).length,0);
 assert.deepEqual((await read(r.reviewId)).command,receipts[0]);
 pass(report,'ALLOW_FINALIZE_CONCURRENT_REPLAY_ONE_CANONICAL_PUBLICATION_DISPATCH_SECOND_ACCOUNT_READ_NO_PRIVATE_GRANT');

 const edit=await ok(requester.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:c.needId}));
 const editTitle=rows(`select id from public.ai_structured_facts where conversation_id=${q(edit.conversationId)}::uuid and fact_key='need.title' and superseded_at is null`)[0];
 await ok(requester.rpc('rpc_ai_correct_fact_v2',{p_fact_id:editTitle.id,p_value:'V5 uređivanje istog zadatka',p_display_value:'V5 uređivanje istog zadatka'}));
 const editReview=await ok(requester.rpc('rpc_prepare_ai_task_review',{p_conversation_id:edit.conversationId,p_response_deadline:null,p_location:null}));
 assert.equal(editReview.draftId,c.needId);assert.equal(editReview.draftRevision,1);assert.equal(editReview.canAccept,true);
 assert.equal(sql(`select revision from public.needs where id=${q(c.needId)}::uuid`),'1');
 const competing=await ok(requester.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:c.needId}));
 const competingReview=await ok(requester.rpc('rpc_prepare_ai_task_review',{p_conversation_id:competing.conversationId,p_response_deadline:null,p_location:null}));
 const editKey=randomUUID(),edited=await Promise.all([ok(accept(editReview,editKey)),ok(accept(editReview,editKey))]);
 assert.deepEqual(edited[0],edited[1]);const editCommand=edited[0];assert.equal(editCommand.needId,c.needId);assert.equal(editCommand.needRevision,2);
 await denied(accept(competingReview),'TASK_REVIEW_STALE');
 assert.equal(sql(`select count(*) from private.need_edit_commands where need_id=${q(c.needId)}::uuid and client_request_id=${q('v5-edit:'+editReview.reviewId)}`),'1');
 const editContext=await context(editCommand),editClaim=await ok(claim(editReview,editCommand,editContext.binding));
 await ok(complete(editReview,editClaim.attemptId));const editedPublished=await ok(publish(editCommand));
 assert.equal(editedPublished.state,'PUBLISHED');assert.equal(editedPublished.needId,c.needId);assert.equal(editedPublished.needRevision,2);
 assert.deepEqual((await ok(worker.from('needs').select('id,title,revision').eq('id',c.needId)))[0],{id:c.needId,title:'V5 uređivanje istog zadatka',revision:2});
 pass(report,'BOUND_EDIT_SINGLE_ACCEPT_REUSES_SAME_NEED_CANONICAL_REVISION_WRITER_STALE_COMPETING_REVIEW_DENIED_REPUBLISH_READBACK');

 const c2=await ok(accept(r2)),ctx2=await context(c2),claim2=await ok(claim(r2,c2,ctx2.binding));
 // A lost provider result has no synthetic receipt and no reclaim permission.
 sql(`update private.ai_task_review_commands set lease_expires_at=clock_timestamp()-interval '1 second' where review_id=${q(r2.reviewId)}::uuid`);
 assert.equal((await read(r2.reviewId)).command.state,'UNKNOWN_OUTCOME');
 assert.equal((await ok(claim(r2,c2,ctx2.binding))).acquired,false);
 await denied(complete(r2,claim2.attemptId),'TASK_REVIEW_ATTEMPT_STALE');
 await denied(publish(c2),'PUBLICATION_DECISION_NOT_ALLOW');
 assert.equal(sql(`select count(*) from private.need_publication_decisions where need_id=${q(c2.needId)}::uuid`),'0');
 pass(report,'UNKNOWN_PROVIDER_OUTCOME_NEVER_RECLAIMS_OR_PUBLISHES_LATE_ATTEMPT_FENCED');
 assert.deepEqual(rows(migrationSnapshotQuery()),history);
 report.actualAuth=true;report.actualDatabase=true;report.realProviderCalled=false;report.publicationAndSecondAccountRead=true;
 report.limitations=['Provider decisions are synthetic SQL fixture inputs, not real LLM classification.','Expiry and unknown-attempt tests use labelled privileged disposable time fixtures.','No live database, live provider, STT, native or physical-device claim is made.'];
});
