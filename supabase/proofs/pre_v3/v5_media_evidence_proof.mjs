// Actual disposable139 Postgres/Auth/Storage. Sanitized photographs are genuine
// bytes; initial published Need/media rows are explicitly synthetic SQL fixtures.
// Acceptance, report/problem, hold, physical deletion and owner ACL use real APIs.
import {assert,rows,sql,q,ok,denied,anon,service,actor,worker,workerId,wp,login,randomUUID,prove,apply,pass,lockedRace} from './closure_runtime.mjs';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import * as magick from '@imagemagick/magick-wasm';import {sanitizeImage} from '../../functions/_shared/mediaImageSanitizer.mjs';
const require=createRequire(import.meta.url);await magick.initializeImageMagick(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm')));
const original=magick.ImageMagick.read(magick.MagickColors.Orange,48,32,i=>i.write(magick.MagickFormat.Png,b=>new Uint8Array(b)));
const picture=sanitizeImage(original,'image/png',magick),hash=b=>createHash('sha256').update(b).digest('hex'),sha=hash(picture.bytes);
const scalar=s=>JSON.parse(sql(s));
async function owner(label){const a=await actor(label);sql(`insert into public.app_profiles(account_id,kind,display_name,city) values(${q(a.id)},'REQUESTER','Evidence proof owner','Novi Sad') on conflict(account_id,kind) do update set display_name='Evidence proof owner',city='Novi Sad'`);a.profileId=rows(`select id from public.app_profiles where account_id=${q(a.id)} and kind='REQUESTER'`)[0].id;return a;}
async function asset(a){const id=randomUUID(),cid=await ok(a.client.rpc('rpc_ai_open_need_conversation_v2',{})),path=`${a.id}/v5/${id}/${sha}.jpg`;
 await ok(service.storage.from('profile-media').upload(path,picture.bytes,{contentType:'image/jpeg',upsert:false}));
 sql(`insert into private.owned_media_assets(id,account_id,scope,conversation_id,client_request_id,input_sha256,input_bytes,input_type,state,dispatch_state,dispatch_outcome,sanitized_sha256,storage_path,width,height,byte_size)
 values(${q(id)},${q(a.id)},'TASK',${q(cid)},${q(randomUUID())},${q(hash(original))},${original.length},'image/png','READY','SETTLED','STORED',${q(sha)},${q(path)},${picture.width},${picture.height},${picture.bytes.length})`);
 return{id,cid,path};}
function task(a,photos){const id=randomUUID();sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at,public_photo_paths)
 values(${q(id)},${q(a.id)},${q(a.profileId)},'PUBLISHED','Evidence139 task','Synthetic media evidence fixture','PROOF','Novi Sad','Liman','OFFERS',2,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp(),array[${photos.map(p=>q(p.path)).join(',')}]::text[]);commit;`);return id;}
async function application(id){return ok(worker.rpc('rpc_submit_response',{p_need_id:id,p_need_revision:1,p_worker_profile_id:wp,p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:randomUUID()}));}
const selectArgs=(id,p)=>({p_need_id:id,p_need_revision:p.needRevision,p_response_id:p.responseId,p_response_version:p.version,p_content_hash:p.contentHash,p_client_request_id:randomUUID()});
const selection=(a,id,p)=>ok(a.client.rpc('rpc_select_response',selectArgs(id,p)));
const snapshot=id=>rows(`select * from private.agreement_media_snapshots_v5 where agreement_id=${q(id)} order by agreement_version`);
const refs=id=>rows(`select source_kind,source_id,source_version from private.media_evidence_refs_v5 where asset_id=${q(id)} order by source_kind,source_id,source_version`);
const readBytes=async p=>hash(new Uint8Array(await(await ok(service.storage.from('profile-media').download(p.path))).arrayBuffer()));
const reportArgs=(a,nid,aid=null)=>({p_target_account_id:a.id,p_need_id:nid,p_agreement_id:aid,p_category:'OTHER',p_reason:'Private evidence context',p_narrative:'PRIVATE_REPORT_139_NEVER_OWNER_EXPORT',p_client_request_id:randomUUID()});
const holdArgs=(a,cid,key='SYNTHETIC_EVIDENCE_139')=>({p_account_id:a.id,p_conversation_id:cid,p_hold_key:key,p_active:true,p_expected_revision:0});
const asActor=a=>`select set_config('request.jwt.claims',${q(JSON.stringify({sub:a.id,role:'authenticated'}))},true);select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claim.role','authenticated',true);`;
const asService=`select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.role','service_role',true);`;

await prove('V5_MEDIA_EVIDENCE','v5-media-evidence-report.json',async report=>{
 await login();const A=await owner('evidence139-owner'),B=await owner('evidence139-unrelated'),C=await owner('evidence139-catchup');
 const historical=await asset(A),hn=task(A,[historical]),ha=await selection(A,hn,await application(hn));
 const uncertain=await asset(C),cn=task(C,[uncertain]);const oldReport=await ok(worker.rpc('rpc_submit_safety_report',reportArgs(C,cn)));
 await apply(report,'20260913005720_clean_v5_media_evidence_protection.sql',138);report.actualStorage=true;report.sqlPublishedFixtures=true;
 assert.equal(snapshot(ha)[0].state,'RESOLVED');assert.deepEqual(snapshot(ha)[0].assets.map(x=>x.assetId),[historical.id]);assert.equal(snapshot(ha)[0].assets[0].sha256,sha);
 assert.equal(refs(historical.id).filter(x=>x.source_kind==='AGREEMENT_VERSION').length,1);
 assert.equal(sql(`select count(*) from private.media_evidence_gaps_v5 where source_id=${q(oldReport.reportId)} and account_id=${q(C.id)}`),'1');
 assert.equal(refs(uncertain.id).length,0,'Historical report must not invent today\'s photograph as its original attachment');
 assert.ok((await service.storage.from('profile-media').remove([uncertain.path])).error);assert.equal(await readBytes(uncertain),sha);
 for(const table of ['agreement_media_snapshots_v5','media_evidence_refs_v5','media_evidence_gaps_v5']){
  assert.equal(sql(`select relrowsecurity and relforcerowsecurity from pg_class where oid=${q('private.'+table)}::regclass`),'t');
  for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');
  assert.equal(sql(`select exists(select 1 from private.closure_dataset_catalog_v5 where ${q('private.'+table)}=any(relations))`),'t');
 }
 for(const fn of rows("select oid::regprocedure::text signature from pg_proc where pronamespace='private'::regnamespace and (proname like '%media%_v5' or proname='media_evidence_immutable_v5')"))for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(fn.signature)},'EXECUTE')`),'f');
 pass(report,'EXACT_ACCEPTED_REVISION_BACKFILL_PRIVATE_RLS_NO_GRANTS_HISTORICAL_REPORT_UNPROVEN_CLOSED_NO_INVENTED_ASSET');

 const selected=await asset(A),extra=await asset(A),nid=task(A,[selected]),app=await application(nid),args=selectArgs(nid,app);
 const aid=await ok(A.client.rpc('rpc_select_response',args));assert.equal(await ok(A.client.rpc('rpc_select_response',args)),aid);
 const originalSnapshot=snapshot(aid)[0];assert.deepEqual(originalSnapshot.assets.map(x=>x.assetId),[selected.id]);assert.equal(originalSnapshot.need_revision,1);
 const resolve=(a,paths)=>scalar(`select private.resolve_media_snapshot_v5(${q(a.id)},${q(JSON.stringify(paths))}::jsonb)`);
 assert.equal(resolve(A,[selected.path]).resolved,true);assert.equal(resolve(B,[selected.path]).resolved,false);
 for(const malformed of [null,{},true,selected.path,0,[null],[true],[1],[{path:selected.path}],[[selected.path]],[selected.path,selected.path],Array(7).fill(selected.path),[selected.path+'-unknown']])assert.equal(resolve(A,malformed).resolved,false);
 assert.deepEqual(resolve(A,[]),{resolved:true,assets:[]});
 assert.equal(refs(extra.id).length,0);assert.equal(refs(selected.id).length,1);
 // Detachment is a presentation selection bit, not erasure. The ordinary parent
 // Task edit lock remains authoritative once any Agreement has existed.
 sql(`update private.owned_media_assets set selected=false where id=${q(selected.id)}`);
 assert.equal(sql(`select selected from private.owned_media_assets where id=${q(selected.id)}`),'f');
 assert.deepEqual(snapshot(aid)[0],originalSnapshot);
 for(const mutation of [
  `update private.owned_media_assets set storage_path=${q(extra.path+'-redirect')} where id=${q(selected.id)}`,
  `update private.owned_media_assets set sanitized_sha256=${q('0'.repeat(64))} where id=${q(selected.id)}`,
  `update private.owned_media_assets set account_id=${q(B.id)} where id=${q(selected.id)}`,
  `delete from private.owned_media_assets where id=${q(selected.id)}`,
  `delete from private.media_evidence_refs_v5 where asset_id=${q(selected.id)}`,
  `update private.agreement_media_snapshots_v5 set assets='[]' where agreement_id=${q(aid)}`
 ])assert.throws(()=>sql(mutation),/MEDIA_EVIDENCE_IMMUTABLE/);
 // Actual API attempts to delete, replace or move immutable protected bytes fail.
 const stored=()=>rows(`select id,bucket_id,name,owner_id,version,metadata from storage.objects where bucket_id='profile-media' and name=${q(selected.path)}`)[0];
 const originalStored=stored();
 for(const attempt of [()=>service.storage.from('profile-media').remove([selected.path]),
  ()=>service.storage.from('profile-media').upload(selected.path,picture.bytes,{contentType:'image/jpeg',upsert:true}),
  ()=>service.storage.from('profile-media').move(selected.path,selected.path+'-moved')]){
  assert.ok((await attempt()).error);assert.deepEqual(stored(),originalStored);assert.equal(await readBytes(selected),sha);
 }
 assert.ok((await service.storage.from('profile-media').download(selected.path+'-moved')).error);
 assert.deepEqual(await ok(A.client.storage.from('profile-media').remove([selected.path])),[]);
 await denied(B.client.storage.from('profile-media').download(selected.path));await denied(anon.storage.from('profile-media').download(selected.path));
 const deleted=await ok(service.storage.from('profile-media').remove([extra.path]));assert.equal(deleted.length,1);
 assert.ok((await service.storage.from('profile-media').download(extra.path)).error);
 sql(`insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
 select agreement_id,2,'CONFIRMED',terms,content_hash,created_by_account_id from public.agreement_versions where agreement_id=${q(aid)} and version=1`);
 assert.deepEqual(snapshot(aid)[1].assets,originalSnapshot.assets);assert.equal(refs(selected.id).filter(x=>x.source_kind==='AGREEMENT_VERSION').length,2);
 pass(report,'REAL_SELECTION_REPLAY_IMMUTABLE_ACCEPTED_PHOTO_DETACH_PRESERVES_DERIVATIVE_DELETE_REPLACE_MOVE_DENIED_UNRELATED_OBJECT_DELETES');

 await ok(worker.rpc('rpc_report_problem',{p_agreement_id:aid,p_narrative:'Synthetic bilateral problem'}));
 const safety=await ok(worker.rpc('rpc_submit_safety_report',reportArgs(A,nid,aid)));
 assert.ok(refs(selected.id).some(x=>x.source_kind==='AGREEMENT_PROBLEM'&&x.source_id===aid));
 assert.ok(refs(selected.id).some(x=>x.source_kind==='SAFETY_REPORT'&&x.source_id===safety.reportId));
 sql(`update private.safety_reports set status='RESOLVED' where id=${q(safety.reportId)}`);
 await ok(A.client.rpc('rpc_cancel_agreement',{p_agreement_id:aid,p_reason:'Synthetic terminal preservation'}));
 assert.ok((await service.storage.from('profile-media').remove([selected.path])).error);assert.equal(await readBytes(selected),sha);
 const peerView=await A.client.rpc('rpc_get_my_safety_report',{p_report_id:safety.reportId});assert.ok(peerView.error);
 const held=await asset(B),h=await ok(service.rpc('rpc_set_retention_hold',holdArgs(B,held.cid)));
 assert.ok(refs(held.id).some(x=>x.source_kind==='RETENTION_HOLD'&&x.source_id===h.holdId));
 await ok(service.rpc('rpc_set_retention_hold',{...holdArgs(B,held.cid),p_active:false,p_expected_revision:h.revision}));
 assert.ok((await service.storage.from('profile-media').remove([held.path])).error);assert.equal(await readBytes(held),sha);
 pass(report,'ACTUAL_BILATERAL_PROBLEM_PRIVATE_REPORT_TERMINAL_CASE_AND_HOLD_RELEASE_DO_NOT_INVENT_EVIDENCE_EXPIRY');

 const D=await owner('evidence139-race'),racePhoto=await asset(D),rn=task(D,[racePhoto]),rp=await application(rn),ra=selectArgs(rn,rp);
 const captureSql=`${asActor(D)}select public.rpc_select_response(${q(rn)},1,${q(rp.responseId)},${rp.version},${q(rp.contentHash)},${q(ra.p_client_request_id)})`;
 const raced=await lockedRace(captureSql,()=>service.storage.from('profile-media').remove([racePhoto.path]));
 assert.ok(raced.error);assert.equal(await readBytes(racePhoto),sha);assert.equal(refs(racePhoto.id).length,1);
 const E=await owner('evidence139-holdrace'),holdPhoto=await asset(E),holdKey='SYNTHETIC_EVIDENCE_RACE_139';
 const holdSql=`${asService}select public.rpc_set_retention_hold(${q(E.id)},null,${q(holdKey)},true,0)`;
 assert.ok((await lockedRace(holdSql,()=>service.storage.from('profile-media').remove([holdPhoto.path]))).error);assert.equal(await readBytes(holdPhoto),sha);
 const futureHeld=await asset(E);assert.ok(refs(futureHeld.id).some(x=>x.source_kind==='RETENTION_HOLD'));
 pass(report,'OBSERVED_REAL_SELECTION_STORAGE_DELETE_AND_HOLD_DELETE_LOCK_RACES_FUTURE_HELD_ASSET_CAPTURE');

 const untouched=await owner('evidence139-unaffected');
 assert.equal(sql(`select private.media_owner_protected_v5(${q(untouched.id)})`),'f');
 for(const a of [A,B,C,D,E]){
  const review=await ok(a.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:a.id}));
  assert.equal(review.ready,false);assert.ok(review.blockers.includes('MEDIA_EVIDENCE_POLICY_NOT_READY'));
  assert.ok(!JSON.stringify(review).includes(safety.reportId));assert.ok(!JSON.stringify(review).includes('PRIVATE_REPORT'));
 }
 assert.ok(!(await ok(untouched.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:untouched.id}))).blockers.includes('MEDIA_EVIDENCE_POLICY_NOT_READY'));
 assert.equal(sql('select private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)'),'t');
 const guard=sql("select pg_get_functiondef('private.guard_media_evidence_storage_v5()'::regprocedure)");
 try{sql(guard.replace('MEDIA_EVIDENCE_POLICY_NOT_READY','SYNTHETIC_GUARD_DRIFT'));assert.equal(sql('select private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)'),'f');}finally{sql(guard);}
 assert.equal(sql('select private.closure_source_digest_v5()=(select sha256 from private.closure_source_v5 where singleton)'),'t');
 const catalog=scalar('select private.data_export_dataset_catalog()');assert.equal(catalog.length,42);assert.equal(new Set(catalog.map(x=>x.dataClass)).size,15);
 const projection={delivery:{datasets:catalog.map(x=>({key:x.key,mode:'INCLUDE',fields:x.fields}))}};
 const doc=a=>scalar(`select private.data_export_snapshot(${q(a.id)},${q(randomUUID())},${q(JSON.stringify(projection))}::jsonb,clock_timestamp())`);
 const exported=doc(A),own=exported.datasets.ownAcceptedTaskMedia,foreign=doc(untouched).datasets.ownAcceptedTaskMedia;
 assert.equal(exported.projectionVersion,'OWN_ACCOUNT_V5_4');assert.ok(own.some(x=>x.agreementId===aid));assert.deepEqual(foreign,[]);
 const media=own.find(x=>x.agreementId===aid);assert.equal(media.bytesIncluded,false);assert.deepEqual(media.assets,[{assetId:selected.id,width:picture.width,height:picture.height,byteSize:picture.bytes.length}]);
 for(const forbidden of ['path','sha256','sourceId','sourceKind','sourceVersion','holdKey','narrative'])assert.ok(!JSON.stringify(own).includes('"'+forbidden+'"'));
 assert.ok(!JSON.stringify(exported).includes(safety.reportId));assert.ok(!JSON.stringify(exported).includes('PRIVATE_REPORT_139_NEVER_OWNER_EXPORT'));
 projection.delivery.datasets=projection.delivery.datasets.map(x=>x.key==='ownAcceptedTaskMedia'?{key:x.key,mode:'EXCLUDE',reasonCode:'SYNTHETIC_ONLY'}:x);
 assert.equal(doc(A).datasets.ownAcceptedTaskMedia,undefined);
 pass(report,'PRECISE_OWNER_CLOSURE_BLOCKER_STORAGE_TRIGGER_SOURCE_BOUND42_DATASETS15_CLASSES_OWN_ALLOWLIST_NO_PRIVATE_CASE_EXPORT_REVIEWED_EXCLUDE');

 // A generic, otherwise valid synthetic closure policy does not authorize the
 // separate D0141 evidence lifetime. Prove this beyond the default policy gate.
 const priorLegal=rows('select id from private.legal_document_versions where is_active'),priorPolicies=rows('select id from private.retention_policy_sets where retired_at is null');
 const pid=randomUUID(),terms=randomUUID(),privacy=randomUUID();
 try{
  sql(`update private.legal_document_versions set is_active=false where is_active;
   insert into private.legal_document_versions(id,document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values
   (${q(terms)},'TERMS',${q('SYNTHETIC_MEDIA139_'+terms)},${q(hash('TEST_TERMS_'+terms))},'https://proof.invalid/terms',statement_timestamp()-interval '1 minute',statement_timestamp()-interval '1 minute',true),
   (${q(privacy)},'PRIVACY',${q('SYNTHETIC_MEDIA139_'+privacy)},${q(hash('TEST_PRIVACY_'+privacy))},'https://proof.invalid/privacy',statement_timestamp()-interval '1 minute',statement_timestamp()-interval '1 minute',true);
   update private.retention_policy_sets set retired_at=greatest(clock_timestamp(),effective_at+interval '1 second') where retired_at is null;
   insert into private.retention_policy_sets(id,policy_version,counsel_reference,effective_at) values(${q(pid)},${q('SYNTHETIC_MEDIA139_'+pid)},'DISPOSABLE ONLY NO APPROVAL',statement_timestamp()-interval '1 minute');
   insert into private.retention_policy_rules(policy_id,data_class,purpose,retention_period_text,deletion_trigger,exception_rule,legal_basis_reference)
   select ${q(pid)},code,'Synthetic only','Synthetic86400seconds','Synthetic closure','Synthetic evidence closed','Synthetic only' from private.retention_data_classes where active and required;
   with b as(select jsonb_build_object('schemaVersion',1,'adapterVersion','V5_RETAINED_SUBJECT_CLOSURE_V1','sourceSha256',(select sha256 from private.closure_source_v5),
    'privacyDocumentId',${q(privacy)},'privacyContentSha256',${q(hash('TEST_PRIVACY_'+privacy))},'authAction','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED','mediaAction','DELETE_OWNED_OBJECTS',
    'datasets',(select jsonb_agg(jsonb_build_object('dataClass',data_class,'action','RETAIN_RESTRICTED','retentionSeconds',86400,'trigger','CLOSURE_REQUESTED',
    'ruleSha256',encode(extensions.digest(convert_to(to_jsonb(r)::text,'UTF8'),'sha256'),'hex')) order by data_class) from private.retention_policy_rules r where policy_id=${q(pid)})) value)
   update private.retention_policy_sets set account_closure_execution=b.value||jsonb_build_object('contentSha256',encode(extensions.digest(convert_to(b.value::text,'UTF8'),'sha256'),'hex')) from b where id=${q(pid)}`);
  for(const a of [B,untouched])await ok(a.client.rpc('rpc_prepare_account_closure',{p_expected_user_id:a.id,p_expected_revision:0,p_client_request_id:randomUUID()}));
  const clear=await ok(untouched.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:untouched.id}));assert.equal(clear.ready,true);
  const blocked=await ok(B.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:B.id}));assert.deepEqual(blocked.blockers,['MEDIA_EVIDENCE_POLICY_NOT_READY']);assert.equal(blocked.code,'CLOSURE_BLOCKED');assert.equal(blocked.ready,false);assert.ok(blocked.policySha256);
  await denied(B.client.rpc('rpc_start_account_closure_execution',{p_expected_user_id:B.id,p_request_id:blocked.requestId,p_expected_revision:blocked.revision,p_client_request_id:randomUUID(),p_policy_sha256:blocked.policySha256}),'CLOSURE_BLOCKED');
  assert.equal(sql(`select count(*) from private.closure_executions_v5 where account_id=${q(B.id)}`),'0');
  // A pre-existing/forged service queue generation cannot bypass the fresh
  // evidence check at either claim or dispatch. No physical worker is invoked.
  const generation=randomUUID(),actionId=randomUUID(),attempt=randomUUID();
  sql(`insert into private.closure_executions_v5(account_id,request_id,generation,policy_id,policy_sha256,binding)
   values(${q(B.id)},${q(blocked.requestId)},${q(generation)},${q(pid)},${q(blocked.policySha256)},private.closure_binding_v5());
   insert into private.closure_actions_v5(id,generation,account_id,kind,bucket,object_path,attempt_id)
   values(${q(actionId)},${q(generation)},${q(B.id)},'STORAGE_DELETE','profile-media',${q(held.path)},${q(attempt)})`);
  await denied(service.rpc('rpc_claim_account_closure_action_service',{p_account_id:B.id,p_generation:generation}),'CLOSURE_BLOCKED');
  await denied(service.rpc('rpc_dispatch_account_closure_action_service',{p_account_id:B.id,p_generation:generation,p_action_id:actionId,p_attempt_id:attempt}),'CLOSURE_BLOCKED');
  assert.equal(sql(`select state from private.closure_actions_v5 where id=${q(actionId)}`),'PENDING');assert.equal(await readBytes(held),sha);
  pass(report,'VALID_SYNTHETIC_GENERIC_CLOSURE_POLICY_UNAFFECTED_OWNER_READY_EVIDENCE_OWNER_START_CLAIM_DISPATCH_CLOSED_NO_BYTES_DELETED');
 }finally{
  sql(`update private.retention_policy_sets set retired_at=greatest(clock_timestamp(),effective_at+interval '1 second') where id=${q(pid)};
   update private.legal_document_versions set is_active=false where id in(${q(terms)},${q(privacy)})`);
  for(const p of priorPolicies)sql(`update private.retention_policy_sets set retired_at=null where id=${q(p.id)}`);
  for(const p of priorLegal)sql(`update private.legal_document_versions set is_active=true where id=${q(p.id)}`);
 }
 report.policyActivated=false;report.providerCalled=false;report.limitations=['No evidence retention/release policy is supplied or activated. Protected accounts remain closed to destructive closure.','Catch-up without an exact historical media context is explicitly unresolved; no bytes or old attachment identity are fabricated.','Storage API proof does not authorize or claim protection against an out-of-band object-store administrator.'];
});
