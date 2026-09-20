// Actual disposable Auth/PostgREST/Postgres/Storage143→144. No provider or live.
// Real JPEG sanitation/readback; quota and closure rows are synthetic fixtures.
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import * as magick from '@imagemagick/magick-wasm';import {sanitizeImage} from '../../functions/_shared/mediaImageSanitizer.mjs';
import {assert,sql,rows,prove,pass,apply,login,agreement,requester,requesterId,worker,workerId,service,anon,actor,ok,denied,randomUUID,q,lockedRace,env} from './closure_runtime.mjs';
const file='20260913065130_clean_v5_agreement_private_photos.sql';
const require=createRequire(import.meta.url);await magick.initializeImageMagick(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm')));
const original=magick.ImageMagick.read(magick.MagickColors.Green,100,50,i=>{i.setAttribute('comment','PRIVATE_ORIGINAL_METADATA');return i.write(magick.MagickFormat.Png,b=>new Uint8Array(b));});
const image=sanitizeImage(original,'image/png',magick),sha=createHash('sha256').update(image.bytes).digest('hex'),inputSha=createHash('sha256').update(original).digest('hex');
const R={id:requesterId,client:requester},W={id:workerId,client:worker};
async function session(a){const s=(await a.client.auth.getSession()).data.session;assert.ok(s);const j=JSON.parse(Buffer.from(s.access_token.split('.')[1],'base64url').toString());assert.equal(j.sub,a.id);assert.ok(j.session_id);return j.session_id;}
const serviceSql="select set_config('request.jwt.claim.role','service_role',true);select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);";
const args=async(a,g,op,key=randomUUID(),input={},version=1)=>({p_account_id:a.id,p_session_id:await session(a),p_operation:op,p_agreement_id:g,p_version:version,p_key:key,p_input:input});
const call=(c)=>service.rpc('rpc_agreement_photo_upload_service_v5',c);
const serviceStatement=c=>serviceSql+`select public.rpc_agreement_photo_upload_service_v5(${q(c.p_account_id)}::uuid,${q(c.p_session_id)}::uuid,${q(c.p_operation)},${q(c.p_agreement_id)}::uuid,${c.p_version},${q(c.p_key)}::uuid,${q(JSON.stringify(c.p_input))}::jsonb)`;
const newClaim=async(a,g,key=randomUUID())=>args(a,g,'CLAIM',key,{sha256:inputSha,byteSize:original.length,contentType:'image/png'});
async function stage(a,g,c){return ok(call(await args(a,g,'STAGE',c.receipt.clientRequestId,{attemptId:c.attemptId,sha256:sha,width:image.width,height:image.height,byteSize:image.bytes.length})));}
async function finish(a,g,c){
 const dispatched=await ok(call(await args(a,g,'DISPATCH',c.receipt.clientRequestId)));assert.equal(dispatched.acquired,true);
 assert.equal((await ok(call(await args(a,g,'DISPATCH',c.receipt.clientRequestId)))).acquired,false);
 await ok(service.storage.from('profile-media').upload(c.path,image.bytes,{contentType:'image/jpeg',upsert:false}));
 const blob=await ok(service.storage.from('profile-media').download(c.path));assert.equal(createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex'),sha);
 return ok(call(await args(a,g,'SETTLE',c.receipt.clientRequestId,{sha256:sha,outcome:'STORED'})));
}
async function upload(a,g){const c=await ok(call(await newClaim(a,g)));return finish(a,g,await stage(a,g,c));}
const sendArgs=(a,g,ids,key=randomUUID(),body='',version=1)=>({p_expected_user_id:a.id,p_agreement_id:g,p_expected_version:version,p_client_message_id:key,p_body:body,p_asset_ids:ids});
const send=(a,c)=>a.client.rpc('rpc_send_agreement_photo_message_v5',c);
const meta=(a,g,ids)=>a.client.rpc('rpc_read_agreement_photo_messages_v5',{p_expected_user_id:a.id,p_agreement_id:g,p_message_ids:ids});
const byteArgs=async(a,g,asset,message=null)=>({p_account_id:a.id,p_session_id:await session(a),p_agreement_id:g,p_asset_id:asset,p_message_id:message});
const byteRead=c=>service.rpc('rpc_agreement_photo_read_service_v5',c);
async function sendStatement(a,c){const claims=JSON.stringify({sub:a.id,role:'authenticated',session_id:await session(a)});
 return `select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claims',${q(claims)},true);select public.rpc_send_agreement_photo_message_v5(${q(a.id)}::uuid,${q(c.p_agreement_id)}::uuid,${c.p_expected_version},${q(c.p_client_message_id)},${q(c.p_body)},array[${c.p_asset_ids.map(x=>q(x)+'::uuid').join(',')}])`;
}
async function block(value){const b=await ok(requester.rpc('rpc_get_account_block',{p_target_account_id:workerId}));return ok(requester.rpc('rpc_set_account_block',{p_target_account_id:workerId,p_blocked:value,p_expected_revision:b.revision,p_client_request_id:randomUUID()}));}
await prove('V5_AGREEMENT_PRIVATE_PHOTOS','v5-agreement-photos-report.json',async report=>{
 report.actualStorage=false;report.actualMediaEdge=false;
 const oldWriters=rows("select oid::regprocedure::text signature,md5(prosrc) sha from pg_proc where oid in('public.rpc_send_agreement_message(uuid,text)'::regprocedure,'public.rpc_send_agreement_message_v2(uuid,uuid,text,text)'::regprocedure) order by oid::regprocedure::text");
 const oldPolicy=sql("select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from private.retention_policy_sets t");
 await apply(report,file,143);await login();
 assert.deepEqual(rows("select oid::regprocedure::text signature,md5(prosrc) sha from pg_proc where oid in('public.rpc_send_agreement_message(uuid,text)'::regprocedure,'public.rpc_send_agreement_message_v2(uuid,uuid,text,text)'::regprocedure) order by oid::regprocedure::text"),oldWriters);
 assert.equal(sql("select relrowsecurity and relforcerowsecurity from pg_class where oid='private.agreement_photo_uploads_v5'::regclass"),'t');
 for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},'private.agreement_photo_uploads_v5','SELECT,INSERT,UPDATE,DELETE')`),'f');
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
 assert.equal(sql('select jsonb_array_length(private.data_export_dataset_catalog())'),'50');assert.equal(sql('select private.data_export_policy_binding() is null and private.closure_binding_v5() is null'),'t');
 assert.equal(sql("select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')::text) from private.retention_policy_sets t"),oldPolicy);
 const g=(await agreement('144 private photograph message')).id,foreign=await actor('photo144-foreign');
 const c=await newClaim(R,g);for(const client of [anon,requester,worker])await denied(client.rpc('rpc_agreement_photo_upload_service_v5',c));
 await denied(call({...c,p_session_id:randomUUID()}),'AUTH_REQUIRED');await denied(call({...c,p_account_id:foreign.id,p_session_id:await session(foreign)}),'MEDIA_NOT_FOUND');
 pass(report,'EXACT143_FORWARD_PRIVATE_FORCE_RLS_SERVICE_PROTOCOL_UNCHANGED_TEXT_WRITERS50_EXPORT_NO_POLICY_OR_DURATION_SEED');

 const first=await upload(R,g),second=await upload(R,g);report.actualStorage=true;
 const publicRead=await fetch(env.RU5_DEVICE_SUPABASE_URL+'/storage/v1/object/public/profile-media/'+first.path,{redirect:'error'});assert.equal(publicRead.ok,false);void publicRead.body?.cancel();
 assert.ok((await anon.storage.from('profile-media').download(first.path)).error);assert.ok((await worker.storage.from('profile-media').download(first.path)).error);
 const own=await ok(byteRead(await byteArgs(R,g,first.receipt.assetId)));assert.equal(own.path,first.path);
 await denied(byteRead(await byteArgs(W,g,first.receipt.assetId)),'MEDIA_NOT_FOUND');await denied(byteRead(await byteArgs(foreign,g,first.receipt.assetId)),'MEDIA_NOT_FOUND');
 const cmd=sendArgs(R,g,[first.receipt.assetId,second.receipt.assetId]),pair=await Promise.all([ok(send(R,cmd)),ok(send(R,cmd))]);assert.deepEqual(pair[0],pair[1]);const m=pair[0];
 assert.deepEqual(m,{messageId:m.messageId,agreementId:g,agreementVersion:1,clientMessageId:cmd.p_client_message_id,body:'',assetIds:cmd.p_asset_ids});
 assert.equal(sql(`select count(*) from public.user_activity_events where dedupe_key=${q('agreement_message:'+m.messageId)}`),'1');
 await denied(send(R,{...cmd,p_asset_ids:[...cmd.p_asset_ids].reverse()}),'MEDIA_COMMAND_CONFLICT');await denied(send(R,{...cmd,p_body:'changed'}),'MEDIA_COMMAND_CONFLICT');
 await denied(send(W,sendArgs(W,g,cmd.p_asset_ids)),'MEDIA_NOT_EDITABLE');await denied(send(R,sendArgs(R,g,[first.receipt.assetId,first.receipt.assetId])),'MEDIA_INPUT_INVALID');
 await denied(send(R,sendArgs(R,g,Array.from({length:7},()=>randomUUID()))),'MEDIA_INPUT_INVALID');
 for(const client of [anon,service])await denied(client.rpc('rpc_send_agreement_photo_message_v5',cmd));
 const text=await ok(requester.rpc('rpc_send_agreement_message_v2',{p_expected_user_id:requesterId,p_agreement_id:g,p_client_message_id:randomUUID(),p_body:'Existing text writer remains canonical'}));
 const metadata=await ok(meta(W,g,[m.messageId,text]));assert.deepEqual(metadata.messages[0].assetIds,cmd.p_asset_ids);assert.equal(metadata.messages[0].photos.length,2);assert.deepEqual(metadata.messages[1].photos,[]);
 assert.ok(!JSON.stringify(metadata).includes(first.path));assert.ok(!JSON.stringify(metadata).includes(sha));assert.equal(sql(`select read_at is null from public.agreement_messages where id=${q(m.messageId)}`),'t');
 await denied(meta(foreign,g,[m.messageId]),'MEDIA_NOT_FOUND');await denied(meta(W,g,[m.messageId,randomUUID()]),'MEDIA_NOT_FOUND');
 assert.equal((await ok(byteRead(await byteArgs(W,g,first.receipt.assetId,m.messageId)))).path,first.path);
 pass(report,'REAL_SANITIZED_STORAGE_OWN_UNATTACHED_PREVIEW_PHOTO_ONLY_CANONICAL_MESSAGE_EXACT_ORDERED_REPLAY_ONE_EVENT_BILATERAL_MINIMAL_METADATA');

 const tomb=await newClaim(R,g),cancelArgs={...tomb,p_operation:'CANCEL',p_input:{}};
 const cancelled=await ok(lockedRace(serviceStatement(cancelArgs),()=>call(tomb)));assert.equal(cancelled.receipt.state,'CANCELLED');assert.equal(cancelled.acquired,false);
 const late=await ok(call(await newClaim(R,g))),lateStage=await stage(R,g,late);await ok(call(await args(R,g,'DISPATCH',late.receipt.clientRequestId)));
 const cancel=await ok(call(await args(R,g,'CANCEL',late.receipt.clientRequestId)));assert.equal(cancel.receipt.state,'CANCELLED');
 assert.ok(JSON.parse(sql(`select to_jsonb(private.closure_blockers_v5(${q(requesterId)}::uuid))`)).includes('MEDIA_UPLOAD_PENDING'));
 await ok(service.storage.from('profile-media').upload(lateStage.path,image.bytes,{contentType:'image/jpeg',upsert:false}));
 const settled=await ok(call(await args(R,g,'SETTLE',late.receipt.clientRequestId,{sha256:sha,outcome:'STORED'})));assert.equal(settled.receipt.state,'CANCELLED');assert.equal(settled.dispatchOutcome,'STORED');
 await denied(send(R,sendArgs(R,g,[late.receipt.assetId])),'MEDIA_NOT_EDITABLE');assert.equal((await ok(call(tomb))).receipt.state,'CANCELLED');
 const race=await upload(R,g),raceCommand=sendArgs(R,g,[race.receipt.assetId]);
 const attachmentWon=await ok(lockedRace(await sendStatement(R,raceCommand),async()=>call(await args(R,g,'CANCEL',race.receipt.clientRequestId))));
 assert.equal(attachmentWon.receipt.state,'READY');assert.ok(attachmentWon.receipt.attachedMessageId);
 const cancelWin=await upload(R,g),cancelWinArgs=await args(R,g,'CANCEL',cancelWin.receipt.clientRequestId);
 await denied(lockedRace(serviceStatement(cancelWinArgs),()=>send(R,sendArgs(R,g,[cancelWin.receipt.assetId]))),'MEDIA_NOT_EDITABLE');
 pass(report,'OBSERVED_ABSENT_CANCEL_LATE_CLAIM_ATTACH_CANCEL_BOTH_ORDERS_DISPATCH_UNKNOWN_QUIESCENCE_AND_LATE_STORE_NO_RESURRECTION');

 const versioned=await upload(W,g);await denied(send(W,sendArgs(W,g,[versioned.receipt.assetId],randomUUID(),'Wrong version',2)),'MEDIA_VERSION_CONFLICT');
 await block(true);try{
  await denied(call(await newClaim(R,g)),'INTERACTION_BLOCKED');await denied(send(W,sendArgs(W,g,[versioned.receipt.assetId])),'INTERACTION_BLOCKED');
  assert.equal((await ok(meta(W,g,[m.messageId]))).messages[0].photos.length,2);
  assert.equal((await ok(byteRead(await byteArgs(W,g,first.receipt.assetId,m.messageId)))).path,first.path);
 }finally{await block(false);}
 const proposal=await ok(requester.rpc('rpc_propose_agreement_change_v2',{p_agreement_id:g,p_expected_version:1,p_patch:{price_rsd:4777},p_reason:'Actual new accepted version',p_client_request_id:randomUUID()}));
 assert.equal((await ok(worker.rpc('rpc_respond_agreement_change',{p_proposal_id:proposal,p_accept:true}))).agreementVersion,2);
 assert.equal((await ok(meta(W,g,[m.messageId]))).messages[0].agreementVersion,1);assert.equal((await ok(byteRead(await byteArgs(W,g,first.receipt.assetId,m.messageId)))).sha256,sha);
 await denied(send(W,sendArgs(W,g,[versioned.receipt.assetId])),'MEDIA_VERSION_CONFLICT');
 await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:g}));await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:g}));
 assert.deepEqual(await ok(send(R,cmd)),m);assert.equal((await ok(meta(W,g,[m.messageId]))).messages[0].agreementVersion,1);
 assert.equal((await ok(byteRead(await byteArgs(W,g,first.receipt.assetId,m.messageId)))).sha256,sha);await denied(call(await newClaim(R,g)),'MEDIA_NOT_EDITABLE');
 pass(report,'CURRENT_VERSION_BLOCK_FUTURE_SEND_ONLY_TERMINAL_AND_BLOCKED_CANONICAL_HISTORY_REMAINS_BILATERAL_NO_NEW_CONTACT');

 const before=rows(`select version from storage.objects where bucket_id='profile-media' and name=${q(first.path)}`)[0].version;
 const changed=new Uint8Array(image.bytes);changed[changed.length-4]^=1;
 assert.ok((await service.storage.from('profile-media').upload(first.path,changed,{contentType:'image/jpeg',upsert:true})).error);
 assert.ok((await service.storage.from('profile-media').move(first.path,first.path+'.other')).error);
 assert.ok((await service.storage.from('profile-media').remove([first.path])).error);
 assert.equal(rows(`select version from storage.objects where bucket_id='profile-media' and name=${q(first.path)}`)[0].version,before);
 assert.equal(createHash('sha256').update(new Uint8Array(await(await ok(service.storage.from('profile-media').download(first.path))).arrayBuffer())).digest('hex'),sha);
 assert.throws(()=>sql(`update private.agreement_photo_uploads_v5 set storage_path=storage_path||'.changed' where id=${q(first.receipt.assetId)}`));
 assert.throws(()=>sql(`update public.agreement_messages set photo_asset_ids='{}' where id=${q(m.messageId)}`));
 pass(report,'ACTUAL_STORAGE_UPSERT_MOVE_DELETE_DENIED_OLD_VERSION_AND_DOWNLOADED_SHA_PRESERVED_IMMUTABLE_MESSAGE_LINK');

 const payload={channel:'LEGAL_PRIVACY',topic:'PRIVACY_RIGHTS',title:'Selected message photograph',body:'I explicitly select this one message',desiredOutcome:null,context:null,evidence:[{kind:'AGREEMENT_MESSAGE',id:m.messageId,revision:1}]};
 const support=await ok(worker.rpc('rpc_support_submit_v5',{p_expected_user_id:workerId,p_client_request_id:randomUUID(),p_kind:'CREATE',p_case_id:null,p_expected_revision:null,p_payload_text:JSON.stringify(payload)}));
 const selected=await ok(worker.rpc('rpc_support_detail_v5',{p_expected_user_id:workerId,p_case_id:support.caseId,p_after_sequence:'0'}));assert.equal(selected.evidence[0].reference.content.media.length,2);
 const caseArgs={p_account_id:workerId,p_session_id:await session(W),p_case_id:support.caseId,p_asset_id:first.receipt.assetId};assert.equal((await ok(service.rpc('rpc_support_media_service_v5',caseArgs))).path,first.path);
 await denied(service.rpc('rpc_support_media_service_v5',{...caseArgs,p_asset_id:versioned.receipt.assetId}),'SUPPORT_REFERENCE_NOT_AVAILABLE');
 await denied(service.rpc('rpc_support_media_service_v5',{...caseArgs,p_account_id:foreign.id,p_session_id:await session(foreign)}),'SUPPORT_REFERENCE_NOT_AVAILABLE');
 assert.ok(JSON.parse(sql(`select to_jsonb(private.closure_blockers_v5(${q(requesterId)}::uuid))`)).includes('MEDIA_EVIDENCE_POLICY_NOT_READY'));
 pass(report,'EXPLICIT_ONE_MESSAGE_SUPPORT_SNAPSHOT_ONLY_SELECTED_PHOTOS_OWNER_CASE_AND_SESSION_NO_ADJACENT_OR_WHOLE_CHAT_GRANT');

 const g2=(await agreement('144 rate scope')).id,used=Number(sql(`select count(*) from private.agreement_photo_uploads_v5 where account_id=${q(workerId)} and admitted_at>clock_timestamp()-interval '24 hours'`));
 sql(`insert into private.agreement_photo_uploads_v5(account_id,agreement_id,agreement_version,client_request_id,state,input_sha256,input_bytes,input_type,admitted_at)
 select ${q(workerId)}::uuid,${q(g2)}::uuid,1,gen_random_uuid(),'PROCESSING',${q(inputSha)},${original.length},'image/png',clock_timestamp()-interval '2 minutes' from generate_series(1,${120-used})`);
 await denied(call(await newClaim(W,g2)),'MEDIA_RATE_LIMITED');
 const minuteUsed=Number(sql(`select count(*) from private.agreement_photo_uploads_v5 where account_id=${q(requesterId)} and admitted_at>clock_timestamp()-interval '1 minute'`));assert.ok(minuteUsed<=11);
 sql(`insert into private.agreement_photo_uploads_v5(account_id,agreement_id,agreement_version,client_request_id,state,input_sha256,input_bytes,input_type,admitted_at)
 select ${q(requesterId)}::uuid,${q(g2)}::uuid,1,gen_random_uuid(),'PROCESSING',${q(inputSha)},${original.length},'image/png',clock_timestamp() from generate_series(1,${11-minuteUsed})`);
 const rateRace=await Promise.all([call(await newClaim(R,g2)),call(await newClaim(R,g2))]);assert.equal(rateRace.filter(x=>!x.error).length,1);assert.equal(rateRace.find(x=>x.error).error.message,'MEDIA_RATE_LIMITED');
 const untouched=await args(R,g2,'CANCEL');await ok(call(untouched));const countBefore=sql(`select count(*) from private.agreement_photo_uploads_v5 where account_id=${q(requesterId)} and admitted_at is not null`);
 await ok(call(untouched));assert.equal(sql(`select count(*) from private.agreement_photo_uploads_v5 where account_id=${q(requesterId)} and admitted_at is not null`),countBefore);
 const priorClosure=rows(`select * from private.account_closure_requests where account_id=${q(workerId)}`)[0];
 try{
  const closes=`select pg_advisory_xact_lock(private.closure_account_key(${q(workerId)}::uuid));insert into private.account_closure_requests(account_id,state,revision) values(${q(workerId)}::uuid,'READY',1) on conflict(account_id) do update set state='READY'`;
  await denied(lockedRace(closes,async()=>call(await newClaim(W,g2))),'ACCOUNT_CLOSING');
 }finally{
  if(priorClosure)sql(`update private.account_closure_requests set state=${q(priorClosure.state)} where account_id=${q(workerId)}`);
  else sql(`delete from private.account_closure_requests where account_id=${q(workerId)}`);
 }
 const catalog=JSON.parse(sql('select private.data_export_dataset_catalog()')),config={delivery:{datasets:catalog.map(d=>({key:d.key,mode:'INCLUDE',fields:d.fields}))}};
 const snap=a=>JSON.parse(sql(`select private.data_export_snapshot(${q(a)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(config))}::jsonb,clock_timestamp())`));
 const ownExport=snap(requesterId),otherExport=snap(foreign.id);assert.equal(ownExport.projectionVersion,'OWN_ACCOUNT_V5_7');assert.ok(ownExport.datasets.ownAgreementPhotos.some(x=>x.id===first.receipt.assetId));
 assert.deepEqual(ownExport.datasets.ownAgreementMessages.find(x=>x.id===m.messageId).assetIds,cmd.p_asset_ids);assert.ok(!JSON.stringify(otherExport).includes(first.receipt.assetId));
 for(const photo of ownExport.datasets.ownAgreementPhotos){assert.equal(photo.bytesIncluded,false);assert.ok(!Object.keys(photo).some(k=>/path|sha|key|attempt|input|session/i.test(k)));}
 assert.equal(sql('select private.data_export_policy_binding() is null and private.closure_binding_v5() is null'),'t');
 pass(report,'ATOMIC120_ROLLING_ACCOUNT_SAFETY_QUOTA_REPLAY_NO_EXTRA_ADMISSION_OWN50_FIELD_ALLOWLIST_EXPORT_NO_PIXELS_OR_TRANSFER_SECRETS');
});
