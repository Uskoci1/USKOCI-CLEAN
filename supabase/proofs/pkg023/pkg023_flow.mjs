// PKG-023 proof helpers. Disposable Auth/Postgres only: the real RPC authority with synthetic facts.
// No provider is called and nothing here can reach a hosted project (closure_runtime.mjs refuses
// any target that is not the local proof stack).
import {assert,rows,sql,ok,service,actor,randomUUID,q} from '../pre_v3/closure_runtime.mjs';
import {locationFixture} from '../policy/publication_fixtures.mjs';
export {assert,rows,sql,ok,service,actor,randomUUID,q};

export const FACTS={title:'PKG023 disposable task',description:'Treba mi neko sutra da prenese ormar iz sobe u kombi.',
 category:'PROOF',priceMode:'OFFERS',priceRsd:null,scheduleKind:'FLEXIBLE',people:1};
// 45.251234 N, 19.831234 E: the coarse grid reads 45.25 / 19.83, the ~100 m grid 45.251 / 19.831.
export const PIN={slot:'start',latitudeE6:45251234,longitudeE6:19831234,origin:{kind:'MANUAL_PIN'}};
export const stationary=(pin=PIN)=>locationFixture({mode:'STATIONARY',start:{city:'Novi Sad'}},[pin]);
export const remote=()=>locationFixture({mode:'REMOTE'},null);

export async function profile(a,kind){
 let p=await ok(a.client.from('app_profiles').select('id').eq('account_id',a.id).eq('kind',kind).maybeSingle());
 if(!p)p=await ok(a.client.from('app_profiles').insert({account_id:a.id,kind,display_name:'PKG023 disposable person',skills:[],tools:[],vehicles:[],bio:''}).select('id').single());
 return p.id;
}
const identity=(a,cid,key)=>({p_account_id:a.id,p_conversation_id:cid,p_client_request_id:key});
export async function conversation(a,facts={}){
 const f={...FACTS,...facts},cid=await ok(a.client.rpc('rpc_ai_open_need_conversation_v2')),key=randomUUID(),message='PKG023 disposable request';
 const claim=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{...identity(a,cid,key),p_user_message:message}));assert.ok(claim.claim);
 assert.equal(await ok(service.rpc('rpc_ai_dispatch_need_turn_v2_service',{...identity(a,cid,key),p_attempt_id:claim.claim.attemptId})),true);
 const pairs=[['need.title',f.title],['need.description',f.description],['need.category',f.category],['need.price_mode',f.priceMode],
  ['need.schedule_kind',f.scheduleKind],['need.people_needed',f.people]];
 if(f.priceRsd!==null)pairs.push(['need.price_rsd',f.priceRsd]);
 await ok(service.rpc('rpc_ai_complete_need_turn_v2_service',{...identity(a,cid,key),p_attempt_id:claim.claim.attemptId,p_user_message:message,
  p_assistant_message:'PKG023 synthetic proposal',p_safety:'ALLOW',
  p_proposals:pairs.map(([key,value])=>({key,value,displayValue:String(value),evidence:'PKG023 disposable input',confidence:1}))}));
 return cid;
}
export async function review(a,cid,location){
 const l=await ok(a.client.rpc('rpc_get_need_location_review',{p_conversation_id:cid}));
 return ok(a.client.rpc('rpc_prepare_ai_task_review',{p_conversation_id:cid,p_response_deadline:null,p_location:{expectedRevision:l.revision,value:location}}));
}
export const accept=(a,r,key=randomUUID())=>ok(a.client.rpc('rpc_accept_ai_task_review',
 {p_review_id:r.reviewId,p_displayed_content_digest:r.displayedContentDigest,p_client_request_id:key}));
export const context=(a,c)=>ok(a.client.rpc('rpc_get_need_publication_context',{p_need_id:c.needId,p_expected_revision:c.needRevision}));
export const claimEvaluation=(a,r,c,binding)=>service.rpc('rpc_claim_ai_task_review_evaluation_service',
 {p_account_id:a.id,p_review_id:r.reviewId,p_need_id:c.needId,p_need_revision:c.needRevision,p_binding:binding});
export async function evaluate(a,r,c){
 const ctx=await context(a,c);assert.equal(ctx.kind,'READY','publication context: '+JSON.stringify({kind:ctx.kind,code:ctx.code}));
 const claim=await ok(claimEvaluation(a,r,c,ctx.binding));assert.equal(claim.acquired,true);
 return ok(service.rpc('rpc_complete_ai_task_review_evaluation_service',{p_account_id:a.id,p_review_id:r.reviewId,p_attempt_id:claim.attemptId,p_outcome:'ALLOW',
  p_rule_ids:['RS-MIN-001'],p_safe_reason_codes:['CLEAR_CONCRETE_TASK'],p_provider_ref:'DISPOSABLE_PKG023',p_model_ref:'NO_REAL_PROVIDER',p_not_ready_code:null}));
}
export const publish=(a,c)=>a.client.rpc('rpc_publish_accepted_ai_task_review',{p_review_id:c.reviewId,p_client_request_id:c.clientRequestId});
/** The whole real path: a conversation, a review with a location, the accepted draft, the evaluation, the publication. */
export async function publishedTask(a,{facts={},location=stationary()}={}){
 const cid=await conversation(a,facts),r=await review(a,cid,location);assert.equal(r.canAccept,true,'review cannot be accepted');
 const c=await accept(a,r);await evaluate(a,r,c);const receipt=await ok(publish(a,c));assert.equal(receipt.state,'PUBLISHED');
 return {needId:c.needId,needRevision:c.needRevision,conversationId:cid};
}
export async function readyWorker(b){
 const wp=await profile(b,'WORKER');
 await ok(b.client.from('app_profiles').update({display_name:'PKG023 disposable worker',skills:['Proof'],tools:[],vehicles:['Kombi'],licenses:[]}).eq('id',wp));
 const loc=await ok(b.client.rpc('rpc_get_worker_location',{}));
 await ok(b.client.rpc('rpc_save_worker_location',{p_expected_revision:loc.revision,
  p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85}},p_confirmed:true}));
 await ok(b.client.rpc('rpc_complete_worker_profile',{p_profile_id:wp}));
 return wp;
}
export const apply=(b,wp,task,price=3000)=>ok(b.client.rpc('rpc_submit_response',{p_need_id:task.needId,p_need_revision:task.needRevision,p_worker_profile_id:wp,
 p_covered_slots:1,p_price_rsd:price,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:randomUUID()}));
export const select=(a,task,app)=>ok(a.client.rpc('rpc_select_response',{p_need_id:task.needId,p_need_revision:app.needRevision,p_response_id:app.responseId,
 p_response_version:app.version,p_content_hash:app.contentHash,p_client_request_id:randomUUID()}));
export const fingerprint=needId=>JSON.parse(sql(`select private.need_publication_fingerprint_snapshot(${q(needId)}::uuid)`));
export const needRow=needId=>rows(`select n.id,n.status,n.revision,n.approximate_lat::text,n.approximate_lng::text,to_jsonb(n) as doc,
 s.exact_lat::text,s.exact_lng::text,s.resolved_location from public.needs n left join public.need_sensitive s on s.need_id=n.id where n.id=${q(needId)}::uuid`)[0];
