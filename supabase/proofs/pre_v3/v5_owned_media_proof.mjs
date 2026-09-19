// Actual disposable Postgres/Auth/Storage. Real sanitized JPEG bytes. All policy
// decisions are explicit synthetic service fixtures; no Gemini/live API call.
import {assert,rows,sql,prove,pass,apply,login,worker,workerId,service,anon,ok,denied,actor,randomUUID,q,lockedRace} from './closure_runtime.mjs';
import {locationCases,syntheticNonlocationFacts} from '../policy/publication_fixtures.mjs';
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import * as magick from '@imagemagick/magick-wasm';import {sanitizeImage} from '../../functions/_shared/mediaImageSanitizer.mjs';
const require=createRequire(import.meta.url);await magick.initializeImageMagick(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm')));
const original=magick.ImageMagick.read(magick.MagickColors.Green,80,40,i=>i.write(magick.MagickFormat.Png,b=>new Uint8Array(b)));
const image=sanitizeImage(original,'image/png',magick),sha=createHash('sha256').update(image.bytes).digest('hex');
const inputSha=createHash('sha256').update(original).digest('hex');
let requester,requesterId;
const file='20260912224647_clean_v5_owned_media.sql';
const claimArgs=(account,scope,target,key=randomUUID())=>({p_account_id:account,p_scope:scope,p_target_id:target,p_client_request_id:key,
 p_input_sha256:inputSha,p_input_bytes:original.length,p_input_type:'image/png'});
const stageArgs=(account,claim)=>({p_account_id:account,p_asset_id:claim.asset.assetId,p_attempt_id:claim.attemptId,
 p_sha256:sha,p_width:image.width,p_height:image.height,p_byte_size:image.bytes.length});
async function stage(account,claim){return ok(service.rpc('rpc_stage_media_upload_service',stageArgs(account,claim)));}
async function store(account,claim,staged){
 const identity={p_account_id:account,p_asset_id:claim.asset.assetId,p_attempt_id:claim.attemptId};
 assert.equal(await ok(service.rpc('rpc_dispatch_media_upload_service',identity)),true);
 assert.equal(await ok(service.rpc('rpc_dispatch_media_upload_service',identity)),false);
 await ok(service.storage.from('profile-media').upload(staged.path,image.bytes,{contentType:'image/jpeg',upsert:false}));
 const blob=await ok(service.storage.from('profile-media').download(staged.path));assert.equal(createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex'),sha);
 await ok(service.rpc('rpc_settle_media_upload_service',{p_account_id:account,p_asset_id:claim.asset.assetId,p_storage_sha256:sha,p_outcome:'STORED'}));
 return ok(service.rpc('rpc_complete_media_upload_service',{p_account_id:account,p_asset_id:claim.asset.assetId,p_storage_sha256:sha}));
}
async function upload(account,scope,target){const c=await ok(service.rpc('rpc_claim_media_upload_service',claimArgs(account,scope,target)));return{claim:c,asset:await store(account,c,await stage(account,c))};}
async function conversation(){
 const cid=await ok(requester.rpc('rpc_ai_open_need_conversation_v2')),key=randomUUID(),message='Disposable media Task';
 const c=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{p_account_id:requesterId,p_conversation_id:cid,p_client_request_id:key,p_user_message:message}));
 await ok(service.rpc('rpc_ai_complete_need_turn_v2_service',{p_account_id:requesterId,p_conversation_id:cid,p_client_request_id:key,p_attempt_id:c.claim.attemptId,
  p_user_message:message,p_assistant_message:'SYNTHETIC task prepared',p_safety:'ALLOW',p_proposals:syntheticNonlocationFacts.map(([key,value])=>({key,value,displayValue:String(value),evidence:'Synthetic',confidence:1}))}));return cid;
}
async function review(cid){const l=await ok(requester.rpc('rpc_get_need_location_review',{p_conversation_id:cid}));return ok(requester.rpc('rpc_prepare_ai_task_review',
 {p_conversation_id:cid,p_response_deadline:null,p_location:{expectedRevision:l.revision,value:locationCases.find(x=>x.id==='remote-exempt').value}}));}
const accept=r=>requester.rpc('rpc_accept_ai_task_review',{p_review_id:r.reviewId,p_displayed_content_digest:r.displayedContentDigest,p_client_request_id:randomUUID()});

await prove('V5_OWNED_MEDIA','v5-owned-media-report.json',async report=>{
 await apply(report,file,129);await login();
 // This stage performs four genuine intake turns. Its actor must not inherit
 // the prior19 reports' rolling quota. Never reset timestamps or relax limits.
 const owner=await actor('v5-media-requester');requester=owner.client;requesterId=owner.id;
 assert.equal(sql(`select count(*) from private.ai_need_turn_commands where account_id=${q(requesterId)}::uuid`),'0');
 assert.equal(sql(`select relrowsecurity from pg_class where oid='private.owned_media_assets'::regclass`),'t');
 for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},'private.owned_media_assets','SELECT,INSERT,UPDATE,DELETE')`),'f');
 const cid=await conversation(),key=randomUUID(),args=claimArgs(requesterId,'TASK',cid,key);
 await denied(anon.rpc('rpc_claim_media_upload_service',args));await denied(requester.rpc('rpc_claim_media_upload_service',args));
 const claims=await Promise.all([ok(service.rpc('rpc_claim_media_upload_service',args)),ok(service.rpc('rpc_claim_media_upload_service',args))]);
 assert.equal(claims.filter(c=>c.acquired).length,1);const c=claims.find(c=>c.acquired);assert.equal(Object.keys(c.asset).length,15);
 await denied(service.rpc('rpc_claim_media_upload_service',{...args,p_input_sha256:'b'.repeat(64)}),'IDEMPOTENCY_KEY_REUSED');
 await denied(service.rpc('rpc_claim_media_upload_service',{...args,p_account_id:workerId}),'MEDIA_NOT_FOUND');
 await denied(worker.rpc('rpc_read_media_upload',{p_client_request_id:key}),'MEDIA_NOT_FOUND');
 assert.equal((await ok(requester.rpc('rpc_read_media_upload',{p_client_request_id:key}))).state,'PROCESSING');
 const pending=await ok(requester.rpc('rpc_read_task_photos',{p_conversation_id:cid}));assert.equal(pending.ready,false);assert.equal(pending.photos.length,1);
 const loc=await ok(requester.rpc('rpc_get_need_location_review',{p_conversation_id:cid}));
 await denied(requester.rpc('rpc_prepare_ai_task_review',{p_conversation_id:cid,p_location:{expectedRevision:loc.revision,value:locationCases.find(x=>x.id==='remote-exempt').value}}),'PUBLIC_MEDIA_NOT_READY');
 await denied(service.rpc('rpc_stage_media_upload_service',{...stageArgs(requesterId,c),p_attempt_id:null}),'MEDIA_ATTEMPT_STALE');
 const staged=await stage(requesterId,c);await denied(service.rpc('rpc_stage_media_upload_service',{...stageArgs(requesterId,c),p_width:81}),'IDEMPOTENCY_KEY_REUSED');
 await denied(service.rpc('rpc_complete_media_upload_service',{p_account_id:requesterId,p_asset_id:c.asset.assetId,p_storage_sha256:sha}),'MEDIA_STORAGE_UNCONFIRMED');
 const ready=await store(requesterId,c,staged);assert.equal(ready.state,'READY');assert.equal(ready.ref,staged.path);
 await denied(requester.storage.from('profile-media').upload(ready.ref,image.bytes,{contentType:'image/jpeg',upsert:true}));
 await denied(requester.storage.from('profile-media').upload(`${requesterId}/v5/${randomUUID()}/${sha}.jpg`,image.bytes,{contentType:'image/jpeg'}));
 await ok(requester.storage.from('profile-media').download(ready.ref));await denied(worker.storage.from('profile-media').download(ready.ref));
 const ownerDelete=await ok(requester.storage.from('profile-media').remove([ready.ref]));assert.deepEqual(ownerDelete,[]);
 await ok(service.storage.from('profile-media').download(ready.ref));
 const selected=await ok(requester.rpc('rpc_read_task_photos',{p_conversation_id:cid}));assert.equal(selected.ready,true);assert.equal(selected.photos[0].assetId,ready.assetId);
 assert.equal(sql(`select status from public.ai_structured_facts where conversation_id=${q(cid)}::uuid and fact_key='need.public_photo_paths' and superseded_at is null`),'NEEDS_CONFIRMATION');
 pass(report,'PRIVATE_ACL_OWNED_IDEMPOTENCY_PAYLOAD_BINDING_PENDING_REVIEW_GUARD_REAL_STORAGE_IMMUTABLE_OWNER_ONLY_NO_PUBLICATION');

 const nextKey=randomUUID(),msg='SYNTHETIC next message after photograph',next=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{p_account_id:requesterId,p_conversation_id:cid,p_client_request_id:nextKey,p_user_message:msg}));
 assert.ok(!JSON.stringify(next).includes('need.public_photo_paths'));assert.ok(!JSON.stringify(next).includes(ready.ref));
 await ok(service.rpc('rpc_ai_complete_need_turn_v2_service',{p_account_id:requesterId,p_conversation_id:cid,p_client_request_id:nextKey,p_attempt_id:next.claim.attemptId,
  p_user_message:msg,p_assistant_message:'SYNTHETIC keep photographs',p_safety:'ALLOW',p_proposals:[]}));
 const fact=rows(`select id from public.ai_structured_facts where conversation_id=${q(cid)}::uuid and fact_key='need.public_photo_paths' and superseded_at is null`)[0];
 await denied(requester.rpc('rpc_ai_correct_fact_v2',{p_fact_id:fact.id,p_value:[],p_display_value:'no photos'}),'LOCATION_EDITOR_REQUIRED');
 const beforeReview=await review(cid),second=await upload(requesterId,'TASK',cid);await denied(accept(beforeReview),'TASK_REVIEW_STALE');
 const frozen=await review(cid);assert.deepEqual(frozen.publicProjection.find(x=>x.key==='need.public_photo_paths').value,[ready.ref,second.asset.ref]);
 const command=await ok(accept(frozen));assert.equal(command.state,'ACCEPTED');
 const ctx=await ok(requester.rpc('rpc_get_need_publication_context',{p_need_id:command.needId,p_expected_revision:command.needRevision}));assert.equal(ctx.kind,'READY');
 assert.deepEqual(new Set(ctx.publicNeed.publicMediaRefs),new Set([ready.ref,second.asset.ref]));
 assert.deepEqual(await ok(worker.from('needs').select('id').eq('id',command.needId)),[]);
 const evaluationClaim=await ok(service.rpc('rpc_claim_ai_task_review_evaluation_service',{p_account_id:requesterId,p_review_id:frozen.reviewId,
  p_need_id:command.needId,p_need_revision:command.needRevision,p_binding:ctx.binding}));
 const evaluated=await ok(service.rpc('rpc_complete_ai_task_review_evaluation_service',{p_account_id:requesterId,p_review_id:frozen.reviewId,p_attempt_id:evaluationClaim.attemptId,
  p_outcome:'ALLOW',p_rule_ids:['RS-MIN-001'],p_safe_reason_codes:['CLEAR_CONCRETE_TASK'],p_provider_ref:'DISPOSABLE_MEDIA_PROOF',p_model_ref:'NO_PROVIDER',p_not_ready_code:null}));
 assert.equal(evaluated.decision.outcome,'ALLOW');
 await ok(requester.rpc('rpc_publish_accepted_ai_task_review',{p_review_id:frozen.reviewId,p_client_request_id:command.clientRequestId}));
 assert.equal((await ok(worker.from('needs').select('id,public_photo_paths').eq('id',command.needId)))[0].public_photo_paths.length,2);
 const edit=await ok(requester.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:command.needId}));
 await ok(requester.rpc('rpc_remove_task_photo',{p_conversation_id:edit.conversationId,p_asset_id:ready.assetId}));
 const editReview=await review(edit.conversationId),edited=await ok(accept(editReview));assert.equal(edited.needId,command.needId);assert.equal(edited.needRevision,command.needRevision+1);
 assert.deepEqual(rows(`select public_photo_paths from public.needs where id=${q(command.needId)}::uuid`)[0].public_photo_paths,[second.asset.ref]);
 assert.equal(sql(`select count(*) from private.need_publication_decisions where need_id=${q(command.needId)}::uuid and need_revision=${edited.needRevision}`),'0');
 pass(report,'PHOTO_OMITTED_FROM_AI_CONTEXT_GENERIC_EDITOR_DENIED_REVIEW_DIGEST_STALE_CANONICAL_B06_B07_PUBLICATION_BOUND_EDIT_INVALIDATES_DECISION');

 const quota=await conversation();const quotaClaims=await Promise.all(Array.from({length:7},()=>service.rpc('rpc_claim_media_upload_service',claimArgs(requesterId,'TASK',quota))));
 assert.equal(quotaClaims.filter(r=>!r.error).length,6);assert.equal(quotaClaims.find(r=>r.error).error.message,'MEDIA_LIMIT_REACHED');
 const unknown=quotaClaims.find(r=>!r.error).data;await ok(requester.rpc('rpc_remove_task_photo',{p_conversation_id:quota,p_asset_id:unknown.asset.assetId}));
 assert.equal((await ok(service.rpc('rpc_claim_media_upload_service',claimArgs(requesterId,'TASK',quota)))).acquired,true);
 const detached=await store(requesterId,unknown,await stage(requesterId,unknown));assert.equal(detached.selected,false);
 assert.ok(!(await ok(requester.rpc('rpc_read_task_photos',{p_conversation_id:quota}))).photos.some(a=>a.assetId===detached.assetId));
 const abandon=await conversation(),late=await ok(service.rpc('rpc_claim_media_upload_service',claimArgs(requesterId,'TASK',abandon))),lateStage=await stage(requesterId,late);
 await ok(requester.rpc('rpc_ai_abandon_need_conversation_v2',{p_conversation_id:abandon}));const lateResult=await store(requesterId,late,lateStage);assert.equal(lateResult.selected,false);
 assert.equal(sql(`select count(*) from public.ai_structured_facts where conversation_id=${q(abandon)}::uuid and fact_key='need.public_photo_paths'`),'0');
 pass(report,'CONCURRENT_SIX_PHOTO_LIMIT_EXPLICIT_REMOVAL_UNKNOWN_UPLOAD_LATE_COMPLETION_NEVER_RESELECTS_OR_RESURRECTS');

 const avatarOwner=await actor('media-avatar'),pid=rows(`select id from public.app_profiles where account_id=${q(avatarOwner.id)}::uuid and kind='WORKER'`)[0].id;
 const old=await ok(avatarOwner.client.rpc('rpc_read_profile_avatar',{p_profile_id:pid}));assert.equal(old.avatarPath,null);
 const av=await upload(avatarOwner.id,'AVATAR',pid);assert.equal((await ok(avatarOwner.client.rpc('rpc_read_profile_avatar',{p_profile_id:pid}))).avatarPath,null);
 await denied(worker.rpc('rpc_apply_profile_avatar',{p_asset_id:av.asset.assetId,p_expected_avatar_path:null}),'MEDIA_NOT_FOUND');
 const applyArgs={p_asset_id:av.asset.assetId,p_expected_avatar_path:null};const receipts=await Promise.all([ok(avatarOwner.client.rpc('rpc_apply_profile_avatar',applyArgs)),ok(avatarOwner.client.rpc('rpc_apply_profile_avatar',applyArgs))]);assert.deepEqual(receipts[0],receipts[1]);
 const retired=await upload(avatarOwner.id,'AVATAR',pid);await ok(avatarOwner.client.rpc('rpc_discard_profile_avatar',{p_asset_id:retired.asset.assetId}));
 await denied(avatarOwner.client.rpc('rpc_apply_profile_avatar',{p_asset_id:retired.asset.assetId,p_expected_avatar_path:av.asset.ref}),'MEDIA_NOT_EDITABLE');
 const stale=await upload(avatarOwner.id,'AVATAR',pid);
 await ok(avatarOwner.client.rpc('rpc_clear_profile_avatar',{p_profile_id:pid,p_expected_avatar_path:av.asset.ref}));
 assert.deepEqual(await ok(avatarOwner.client.rpc('rpc_apply_profile_avatar',applyArgs)),receipts[0]);assert.equal((await ok(avatarOwner.client.rpc('rpc_read_profile_avatar',{p_profile_id:pid}))).avatarPath,null);
 await denied(avatarOwner.client.rpc('rpc_apply_profile_avatar',{p_asset_id:stale.asset.assetId,p_expected_avatar_path:null}),'MEDIA_VERSION_CONFLICT');
 pass(report,'AVATAR_STAGE_DOES_NOT_PUBLISH_ONE_DURABLE_APPLY_REPLAY_NEVER_REAPPLIES_RETIRED_CANDIDATE_AND_ABA_STALE_DENIED');
});
