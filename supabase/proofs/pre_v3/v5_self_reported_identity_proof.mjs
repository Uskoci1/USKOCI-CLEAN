// Actual disposable Auth/RPC/SQL. Historical true fixtures are created under
// predecessor144, before applying145. Provider outputs are explicitly synthetic.
import {assert,rows,sql,prove,pass,apply,actor,anon,service,ok,denied,randomUUID,q} from './closure_runtime.mjs';
import {locationCases,syntheticNonlocationFacts} from '../policy/publication_fixtures.mjs';
const file='20260913080237_clean_v5_self_reported_identity_requirement.sql';
const unavailable='IDENTITY_VERIFICATION_UNAVAILABLE';
const location=locationCases.find(x=>x.id==='remote-exempt').value;
const factProposal=value=>({key:'need.verified_identity_required',value,displayValue:value?'Da':'Ne',evidence:'Synthetic145 explicit input',confidence:1});
const acceptArgs=(r,key=randomUUID())=>({p_review_id:r.reviewId,p_displayed_content_digest:r.displayedContentDigest,p_client_request_id:key});
const identity=(a,cid,key)=>({p_account_id:a.id,p_conversation_id:cid,p_client_request_id:key});
async function profile(a,kind){
 let p=await ok(a.client.from('app_profiles').select('id').eq('account_id',a.id).eq('kind',kind).maybeSingle());
 if(!p)p=await ok(a.client.from('app_profiles').insert({account_id:a.id,kind,display_name:'Disposable self-reported person',skills:[],tools:[],vehicles:[],bio:''}).select('id').single());
 return p.id;
}
async function prepare(a,cid){
 const l=await ok(a.client.rpc('rpc_get_need_location_review',{p_conversation_id:cid}));
 return ok(a.client.rpc('rpc_prepare_ai_task_review',{p_conversation_id:cid,p_response_deadline:null,p_location:{expectedRevision:l.revision,value:location}}));
}
async function turn(a,verified){
 const cid=await ok(a.client.rpc('rpc_ai_open_need_conversation_v2')),key=randomUUID(),message='Synthetic145 Task with explicit identity requirement';
 const claim=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{...identity(a,cid,key),p_user_message:message}));assert.ok(claim.claim);
 assert.equal(await ok(service.rpc('rpc_ai_dispatch_need_turn_v2_service',{...identity(a,cid,key),p_attempt_id:claim.claim.attemptId})),true);
 const proposals=syntheticNonlocationFacts.map(([key,value])=>({key,value,displayValue:String(value),evidence:'Synthetic145 ordinary input',confidence:1}));
 if(verified!==undefined)proposals.push(factProposal(verified));
 const request=()=>service.rpc('rpc_ai_complete_need_turn_v2_service',{...identity(a,cid,key),p_attempt_id:claim.claim.attemptId,p_user_message:message,
  p_assistant_message:'Synthetic145 complete proposal',p_safety:'ALLOW',p_proposals:proposals});
 return{cid,key,request};
}
async function evaluate(a,r,c){
 const ctx=await ok(a.client.rpc('rpc_get_need_publication_context',{p_need_id:c.needId,p_expected_revision:c.needRevision}));assert.equal(ctx.kind,'READY');
 const claim=await ok(service.rpc('rpc_claim_ai_task_review_evaluation_service',{p_account_id:a.id,p_review_id:r.reviewId,p_need_id:c.needId,p_need_revision:c.needRevision,p_binding:ctx.binding}));
 assert.equal(claim.acquired,true);
 return ok(service.rpc('rpc_complete_ai_task_review_evaluation_service',{p_account_id:a.id,p_review_id:r.reviewId,p_attempt_id:claim.attemptId,p_outcome:'ALLOW',
  p_rule_ids:['RS-MIN-001'],p_safe_reason_codes:['CLEAR_CONCRETE_TASK'],p_provider_ref:'DISPOSABLE145',p_model_ref:'NO_REAL_PROVIDER',p_not_ready_code:null}));
}
const publish=(a,c)=>a.client.rpc('rpc_publish_accepted_ai_task_review',{p_review_id:c.reviewId,p_client_request_id:c.clientRequestId});
const liveFact=(cid)=>rows(`select id,fact_value,source,status from public.ai_structured_facts where conversation_id=${q(cid)}::uuid and fact_key='need.verified_identity_required' and superseded_at is null`)[0];

await prove('V5_SELF_REPORTED_IDENTITY','v5-self-reported-identity-report.json',async report=>{
 assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'144');
 const a=await actor('identity145-owner'),b=await actor('identity145-worker'),pid=await profile(a,'REQUESTER');
 const cancellable=randomUUID();sql(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,schedule_kind,verified_identity_required)
 values(${q(cancellable)}::uuid,${q(a.id)}::uuid,${q(pid)}::uuid,'DRAFT','Historical145 cancellation','Synthetic predecessor144 fixture','PROOF','OFFERS',1,'FLEXIBLE',true)`);
 report.providerResponseStubbed=true;report.historicalFixturesPreparedAtHistory=144;
 const unbound=await turn(a,true);await ok(unbound.request());const oldReady=await prepare(a,unbound.cid);assert.equal(oldReady.canAccept,true);
 const materialized=await turn(a,true);await ok(materialized.request());const oldMaterialReview=await prepare(a,materialized.cid);
 const oldCommand=await ok(a.client.rpc('rpc_accept_ai_task_review',acceptArgs(oldMaterialReview)));await evaluate(a,oldMaterialReview,oldCommand);
 const undispatched=await turn(a,true);await ok(undispatched.request());const acceptedReview=await prepare(a,undispatched.cid);
 const acceptedBefore145=await ok(a.client.rpc('rpc_accept_ai_task_review',acceptArgs(acceptedReview)));
 assert.equal(sql(`select verified_identity_required and status='DRAFT' from public.needs where id=${q(oldCommand.needId)}::uuid`),'t');
 const oldFact=liveFact(unbound.cid),oldEnvelope=sql(`select envelope::text from private.ai_task_reviews where id=${q(oldReady.reviewId)}::uuid`);
 const preserved=rows("select oid::regprocedure::text signature,md5(prosrc) hash,proacl::text acl from pg_proc where oid in('private.validate_need_v2_fact(text,jsonb)'::regprocedure,'private.identity_admitted(uuid)'::regprocedure,'public.rpc_complete_worker_profile(uuid)'::regprocedure,'public.rpc_get_public_profile(uuid)'::regprocedure) order by oid::regprocedure::text");
 await apply(report,file,144);
 assert.deepEqual(rows("select oid::regprocedure::text signature,md5(prosrc) hash,proacl::text acl from pg_proc where oid in('private.validate_need_v2_fact(text,jsonb)'::regprocedure,'private.identity_admitted(uuid)'::regprocedure,'public.rpc_complete_worker_profile(uuid)'::regprocedure,'public.rpc_get_public_profile(uuid)'::regprocedure) order by oid::regprocedure::text"),preserved);
 assert.deepEqual(liveFact(unbound.cid),oldFact);assert.equal(sql(`select envelope::text from private.ai_task_reviews where id=${q(oldReady.reviewId)}::uuid`),oldEnvelope);
 for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},'private.guard_unavailable_identity_requirement_v5()','EXECUTE')`),'f');
 const replay=await ok(a.client.rpc('rpc_accept_ai_task_review',acceptArgs(oldMaterialReview,oldCommand.clientRequestId)));
 assert.equal(replay.state,'EVALUATED');assert.equal(replay.needId,oldCommand.needId);assert.equal(replay.evaluation.decision.outcome,'ALLOW');
 const acceptedReplay=await ok(a.client.rpc('rpc_accept_ai_task_review',acceptArgs(acceptedReview,acceptedBefore145.clientRequestId)));
 assert.deepEqual(acceptedReplay,acceptedBefore145);
 pass(report,'EXACT144_HISTORY_TRUE_FACT_AND_REVIEW_PRESERVED_SHARED_VALIDATOR_IDENTITY_BADGE_ACTIVATION_BODIES_ACLS_UNCHANGED');

 const freshReview=await prepare(a,unbound.cid);assert.equal(freshReview.canAccept,false);assert.notEqual(freshReview.reviewId,oldReady.reviewId);
 assert.equal(freshReview.publicProjection.find(f=>f.key==='need.verified_identity_required').value,true);
 assert.deepEqual(await prepare(a,unbound.cid),freshReview);
 await denied(a.client.rpc('rpc_accept_ai_task_review',acceptArgs(oldReady)),unavailable);
 await denied(a.client.rpc('rpc_accept_ai_task_review',acceptArgs(freshReview)),unavailable);
 await denied(b.client.rpc('rpc_read_ai_task_review',{p_review_id:freshReview.reviewId}),'TASK_REVIEW_NOT_FOUND');
 await denied(anon.rpc('rpc_prepare_ai_task_review',{p_conversation_id:unbound.cid,p_response_deadline:null,p_location:null}));
 assert.equal(sql(`select count(*) from private.ai_task_review_commands where review_id in(${q(oldReady.reviewId)}::uuid,${q(freshReview.reviewId)}::uuid)`),'0');
 pass(report,'OLD_READY_NOT_REUSED_TRUE_REVIEW_VISIBLE_NOT_ACCEPTABLE_PRIOR_AND_NEW_ACCEPT_DENIED_NO_DRAFT_FOREIGN_READ_DENIED');

 const context=await ok(a.client.rpc('rpc_get_need_publication_context',{p_need_id:acceptedBefore145.needId,p_expected_revision:1}));
 assert.equal(context.kind,'READY');
 await denied(service.rpc('rpc_claim_ai_task_review_evaluation_service',{p_account_id:a.id,p_review_id:acceptedReview.reviewId,
  p_need_id:acceptedBefore145.needId,p_need_revision:1,p_binding:context.binding}),unavailable);
 assert.equal(sql(`select state='ACCEPTED' and attempt_id is null and evaluation_binding is null from private.ai_task_review_commands where review_id=${q(acceptedReview.reviewId)}::uuid`),'t');
 const acceptedEdit=await ok(a.client.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:acceptedBefore145.needId}));
 assert.equal(liveFact(acceptedEdit.conversationId).fact_value,true);
 assert.throws(()=>sql(`insert into public.ai_structured_facts(account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
  confidence,confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value)
  select account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,confidence,null,confirmed_at,fact_schema_version,value_type,display_value
  from public.ai_structured_facts where id=${q(liveFact(acceptedEdit.conversationId).id)}::uuid`),/IDENTITY_VERIFICATION_UNAVAILABLE/);
 pass(report,'PRIOR_ACCEPTED_TRUE_CANNOT_ACQUIRE_EVALUATION_NO_ATTEMPT_CAN_OPEN_EXACT_OWNED_EDIT');

 const rejected=await turn(a,true);await denied(rejected.request(),unavailable);
 assert.equal(sql(`select count(*) from public.ai_structured_facts where conversation_id=${q(rejected.cid)}::uuid`),'0');
 const cancelled=await ok(a.client.rpc('rpc_ai_cancel_need_turn_v2',{p_conversation_id:rejected.cid,p_client_request_id:rejected.key}));
 assert.equal(cancelled.cancelled,true);assert.equal(cancelled.providerDispatched,true);assert.equal(cancelled.turn.retryAllowed,false);
 await denied(a.client.rpc('rpc_ai_correct_fact_v2',{p_fact_id:oldFact.id,p_value:true,p_display_value:'Da'}),unavailable);
 await denied(b.client.rpc('rpc_ai_correct_fact_v2',{p_fact_id:oldFact.id,p_value:false,p_display_value:'Ne'}));
 await ok(a.client.rpc('rpc_ai_correct_fact_v2',{p_fact_id:oldFact.id,p_value:false,p_display_value:'Ne'}));
 assert.equal(liveFact(unbound.cid).fact_value,false);
 const corrected=await prepare(a,unbound.cid);assert.equal(corrected.canAccept,true);
 assert.equal(sql(`select fact_value='true'::jsonb and superseded_at is not null from public.ai_structured_facts where id=${q(oldFact.id)}::uuid`),'t');
 pass(report,'NEW_AI_TRUE_ATOMIC_REJECTION_NO_PARTIAL_FACTS_POSTDISPATCH_CANCEL_NO_RETRY_EXPLICIT_FALSE_SUPERSEDES_WITH_HISTORY');

 await denied(publish(a,oldCommand),unavailable);
 assert.equal(sql(`select status='DRAFT' and verified_identity_required from public.needs where id=${q(oldCommand.needId)}::uuid`),'t');
 const edit=await ok(a.client.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:oldCommand.needId})),inherited=liveFact(edit.conversationId);
 assert.equal(inherited.fact_value,true);assert.equal(inherited.source,'SYSTEM_DERIVED');
 const editReview=await prepare(a,edit.conversationId);assert.equal(editReview.canAccept,false);
 await denied(a.client.rpc('rpc_accept_ai_task_review',acceptArgs(editReview)),unavailable);
 await ok(a.client.rpc('rpc_ai_correct_fact_v2',{p_fact_id:inherited.id,p_value:false,p_display_value:'Ne'}));
 const regular=await prepare(a,edit.conversationId);assert.equal(regular.canAccept,true);
 const accepted=await ok(a.client.rpc('rpc_accept_ai_task_review',acceptArgs(regular)));assert.equal(accepted.needId,oldCommand.needId);assert.equal(accepted.needRevision,2);
 await evaluate(a,regular,accepted);const published=await ok(publish(a,accepted));assert.equal(published.state,'PUBLISHED');
 assert.equal(sql(`select not verified_identity_required and status='PUBLISHED' from public.needs where id=${q(accepted.needId)}::uuid`),'t');
 pass(report,'OLD_EVALUATED_TRUE_DRAFT_CANNOT_PUBLISH_OWNED_EDIT_COPIES_HISTORICAL_TRUE_EXPLICIT_FALSE_CANONICAL_REVIEW_PUBLISH_SAME_NEED');

 const wp=await profile(b,'WORKER');await ok(b.client.from('app_profiles').update({display_name:'Disposable self-reported worker',skills:['Proof'],tools:[],vehicles:['Kombi'],licenses:[]}).eq('id',wp));
 const loc=await ok(b.client.rpc('rpc_get_worker_location',{}));
 await ok(b.client.rpc('rpc_save_worker_location',{p_expected_revision:loc.revision,p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85}},p_confirmed:true}));
 await ok(b.client.rpc('rpc_complete_worker_profile',{p_profile_id:wp}));
 const pub=await ok(a.client.rpc('rpc_get_public_profile',{p_profile_id:wp}));assert.equal(pub.trust.identityVerified,false);assert.equal(pub.trust.identityVerificationAvailable,false);
 assert.equal(sql(`select private.identity_admitted(${q(b.id)}::uuid)`),'f');
 const app=await ok(b.client.rpc('rpc_submit_response',{p_need_id:accepted.needId,p_need_revision:2,p_worker_profile_id:wp,p_covered_slots:1,p_price_rsd:3000,
  p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:randomUUID()}));
 const agreementId=await ok(a.client.rpc('rpc_select_response',{p_need_id:accepted.needId,p_need_revision:app.needRevision,p_response_id:app.responseId,p_response_version:app.version,p_content_hash:app.contentHash,p_client_request_id:randomUUID()}));
 assert.equal(sql(`select requester_account_id=${q(a.id)}::uuid and worker_account_id=${q(b.id)}::uuid from public.agreements where id=${q(agreementId)}::uuid`),'t');
 pass(report,'SELF_REPORTED_PROFILE_OPTIONAL_VEHICLE_NO_KG_SEATS_NO_BADGE_ACTUAL_FALSE_TASK_APPLICATION_AND_SELECTION');

 const ordinary=await turn(a,undefined);await ok(ordinary.request());
 assert.equal(liveFact(ordinary.cid),undefined);
 const ordinaryReview=await prepare(a,ordinary.cid);assert.equal(ordinaryReview.canAccept,true);
 const ordinaryCommand=await ok(a.client.rpc('rpc_accept_ai_task_review',acceptArgs(ordinaryReview)));
 assert.equal(sql(`select verified_identity_required=false from public.needs where id=${q(ordinaryCommand.needId)}::uuid`),'t');
 pass(report,'ORDINARY_AI_WITHOUT_IDENTITY_FACT_ACCEPTS_CANONICAL_DEFAULT_FALSE_WITHOUT_EXTRA_CONFIRMATION');

 // A historical true Need is still cancellable and its personal history is not
 // erased or silently normalized by145. This fixture predates145, unlike newtrue.
 await ok(a.client.rpc('rpc_cancel_need',{p_need_id:cancellable,p_need_revision:1,p_reason:'Synthetic145 owner cancellation'}));
 assert.equal(sql(`select status='CANCELLED' and verified_identity_required from public.needs where id=${q(cancellable)}::uuid`),'t');
 // New true inserts are rejected even through a privileged legacy materializer.
 assert.throws(()=>sql(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,schedule_kind,verified_identity_required)
 values(${q(randomUUID())}::uuid,${q(a.id)}::uuid,${q(pid)}::uuid,'DRAFT','Unsupported145','Synthetic fixture','PROOF','OFFERS',1,'FLEXIBLE',true)`),/IDENTITY_VERIFICATION_UNAVAILABLE/);
 const readyBefore=sql("select md5(prosrc) from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure");
 assert.equal(sql("begin;alter function private.guard_ai_fact_schema() set search_path=public;select private.retention_ai_source_ready();rollback;"),'f');
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
 assert.equal(sql('select jsonb_array_length(private.data_export_dataset_catalog())'),'50');
 assert.equal(sql("select md5(prosrc) from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure"),readyBefore);
 pass(report,'PRIVILEGED_NEW_TRUE_DENIED_SOURCE_SEAL_READY_EXACT_RETENTION_TRIGGER_ADMISSION_EXPORT50_NO_NEW_POLICY');
});
