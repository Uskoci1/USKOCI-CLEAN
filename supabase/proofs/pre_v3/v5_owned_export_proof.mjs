// Exact136 SQL + real current worker/download handlers on disposable Auth,
// PostgREST and Storage. Fixtures are synthetic; no live retention/legal policy.
import {assert,rows,sql,prove,pass,apply,login,agreement,requester,worker,anon,service,ok,denied,requesterId,workerId,randomUUID,q,env} from './closure_runtime.mjs';
import {loadExportHandler} from '../legal/data_export_edge_runtime.mjs';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bind=()=>JSON.parse(sql('select coalesce(private.data_export_policy_binding(),\'null\'::jsonb)'));
const snapshot=(a,b)=>JSON.parse(sql(`select private.data_export_snapshot(${q(a)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(b))}::jsonb,clock_timestamp())`));
await prove('V5_OWNED_EXPORT_PROJECTION','v5-owned-export-report.json',async report=>{
 await apply(report,'20260913001000_clean_v5_owned_export_projection.sql',135);await login();report.actualStorage=true;report.actualExportHandlers=true;
 report.policyFixture='SYNTHETIC_DISPOSABLE_NOT_RETENTION_OR_LEGAL_RELEASE_APPROVAL';
 const catalog=JSON.parse(sql('select private.data_export_dataset_catalog()'));assert.equal(catalog.length,37);assert.equal(new Set(catalog.map(x=>x.dataClass)).size,15);
 const required=rows('select code from private.retention_data_classes where active and required order by code').map(x=>x.code);
 assert.deepEqual([...new Set(catalog.map(x=>x.dataClass))].sort(),required);
 for(const entry of rows("select oid::regprocedure::text signature from pg_proc where pronamespace='private'::regnamespace and proname like 'data_export_%'"))for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(entry.signature)},'EXECUTE')`),'f');
 assert.equal(bind(),null);pass(report,'COMPILED37_DATASETS15_REQUIRED_CLASSES_OLD_BINDING_CLOSED_NO_NEW_CLIENT_GRANTS');

 const pair=rows(`select a.id,a.need_id as "needId" from public.agreements a where a.requester_account_id=${q(requesterId)}::uuid and a.worker_account_id=${q(workerId)}::uuid and not exists(select 1 from private.agreement_reviews r where r.agreement_id=a.id) order by a.created_at limit 1`)[0]??await agreement('export136 reviews');
 const ownReview=randomUUID(),peerReview=randomUUID();
 sql(`insert into private.agreement_reviews(id,agreement_id,reviewer_account_id,target_account_id,rating,tags,client_request_id,input_hash) values
 (${q(ownReview)},${q(pair.id)},${q(requesterId)},${q(workerId)},5,'{}',${q(randomUUID())},${q('a'.repeat(64))}),
 (${q(peerReview)},${q(pair.id)},${q(workerId)},${q(requesterId)},1,'{}',${q(randomUUID())},${q('b'.repeat(64))});
 insert into private.safety_reports(reporter_account_id,target_account_id,need_id,category,reason,narrative,client_request_id,input_hash) values
 (${q(requesterId)},${q(workerId)},${q(pair.needId)},'OTHER','OWN_EXPORT_REASON','OWN_EXPORT_NARRATIVE',${q(randomUUID())},${q('a'.repeat(64))}),
 (${q(workerId)},${q(requesterId)},${q(pair.needId)},'OTHER','PEER_EXPORT_SECRET_REASON','PEER_EXPORT_SECRET_NARRATIVE',${q(randomUUID())},${q('b'.repeat(64))});`);
 const a=await ok(requester.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()})),b=await ok(worker.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()}));
 const candidate={displayName:'OWN_EXPORT_CANDIDATE',bio:'Own worker bio',skills:['painting',{secret:'NESTED_SECRET'}],tools:[],licenses:[],vehicles:[],teamCapacity:1,
  location:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85,secret:'COORDINATE_SECRET'},providerKey:'PROVIDER_SECRET'},
  availability:{timezone:'Europe/Belgrade',availableNow:false,rules:[],windows:[],secret:'AVAILABILITY_SECRET'},providerPayload:{key:'WHOLE_ENVELOPE_SECRET'}};
 sql(`update private.worker_ai_sessions set candidate=${q(JSON.stringify(candidate))}::jsonb where conversation_id=${q(a.conversationId)}::uuid;
 update private.worker_ai_sessions set candidate=candidate||'{"displayName":"PEER_EXPORT_SECRET_CANDIDATE"}'::jsonb where conversation_id=${q(b.conversationId)}::uuid`);
 const review=randomUUID(),cross=randomUUID(),profile=rows(`select id from public.app_profiles where account_id=${q(requesterId)}::uuid order by kind limit 1`)[0].id;
 const envelope={draftId:pair.needId,draftRevision:1,publicProjection:[
  {key:'need.title',value:'OWN_REVIEW_TITLE',displayValue:'Own review title',status:'CONFIRMED',secret:'FACT_SECRET'},
  {key:'need.task_geography',value:{mode:'ROUTE',start:{label:'Own start',city:'Novi Sad',area:'Liman',provider:'GEOGRAPHY_SECRET'},end:{label:'Own end'},waypoints:[{label:'OWN_WAYPOINT',secret:'WAYPOINT_SECRET'}]},status:'CONFIRMED'},
  {key:'provider.secret',value:'UNKNOWN_FACT_SECRET'}],ownerPrivateProjection:[
  {key:'need.exact_address',value:'OWN_PRIVATE_ADDRESS',displayValue:'Own private address',status:'CONFIRMED'},
  {key:'need.resolved_location',value:{points:[{slot:'START',latitudeE6:45250000,longitudeE6:19850000,address:'OWN_POINT_ADDRESS',accessNotes:'Own access',origin:{providerHint:'POINT_ORIGIN_SECRET'}}],geographyHash:'GEOGRAPHY_HASH_SECRET'},status:'CONFIRMED'}],providerKey:'REVIEW_PROVIDER_SECRET'};
 sql(`insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at) values
 (${q(review)},${q(requesterId)},${q(a.conversationId)},${q(profile)},${q('a'.repeat(64))},'{}',${q(JSON.stringify(envelope))}::jsonb,clock_timestamp()+interval '15 minutes'),
 (${q(cross)},${q(requesterId)},${q(b.conversationId)},${q(profile)},${q('b'.repeat(64))},'{}','{"publicProjection":[{"key":"need.title","value":"CROSS_PARENT_SECRET"}]}',clock_timestamp()+interval '15 minutes');
 insert into private.worker_ai_reviews(account_id,conversation_id,revision,base_hash,envelope,expires_at) values
 (${q(requesterId)},${q(a.conversationId)},1,${q('c'.repeat(64))},${q(JSON.stringify({profile:candidate,activate:false,secret:'WORKER_REVIEW_SECRET'}))}::jsonb,clock_timestamp()+interval '15 minutes');
 insert into private.owned_media_assets(account_id,scope,profile_id,client_request_id,input_sha256,input_bytes,input_type) values
 (${q(requesterId)},'AVATAR',${q(profile)},${q(randomUUID())},${q('d'.repeat(64))},3,'image/jpeg');
 insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd) values
 (${q(randomUUID())},${q(requesterId)},'LLM',250000),(${q(randomUUID())},${q(workerId)},'LLM',250000);
 insert into private.qa_ai_commands(account_id,client_request_id,command_type,need_id,need_revision,text_sha256,request_hash,state) values
 (${q(requesterId)},${q(randomUUID())},'ASK',${q(pair.needId)},1,${q('e'.repeat(64))},${q('f'.repeat(64))},'CANCELLED');`);

 const oldPolicies=rows('select id,retired_at from private.retention_policy_sets where retired_at is null');
 const oldPrivacy=rows("select id,is_active from private.legal_document_versions where document_kind='PRIVACY' and is_active");
 const privacy=randomUUID();let policyId,delivery;
 function reviewDelivery(patch={}){const value={...delivery,...patch};delete value.contentSha256;sql(`update private.retention_policy_sets set export_delivery=${q(JSON.stringify(value))}::jsonb where id=${q(policyId)}::uuid;
 update private.retention_policy_sets set export_delivery=export_delivery||jsonb_build_object('contentSha256',encode(extensions.digest(convert_to(export_delivery::text,'UTF8'),'sha256'),'hex')) where id=${q(policyId)}::uuid`);}
 try{
  sql(`update private.retention_policy_sets set retired_at=greatest(clock_timestamp(),effective_at+interval '1 second') where retired_at is null;
   update private.legal_document_versions set is_active=false where document_kind='PRIVACY' and is_active;
   insert into private.legal_document_versions(id,document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values
   (${q(privacy)},'PRIVACY',${q('V5_DISPOSABLE_'+randomUUID())},${q('a'.repeat(64))},'https://proof.invalid/privacy',clock_timestamp()-interval '1 second',clock_timestamp()-interval '1 second',true)`);
  const policy=await ok(service.rpc('rpc_publish_retention_policy',{p_policy_version:'V5_EXPORT_DISPOSABLE_'+randomUUID(),p_counsel_reference:'DISPOSABLE_SYNTHETIC_NO_LEGAL_CONTENT',p_effective_at:new Date(Date.now()-1000).toISOString(),p_rules:required.map(code=>({dataClass:code,purpose:'Disposable export test',retentionPeriod:'Synthetic only',deletionTrigger:'Synthetic only',exceptionRule:'Synthetic only',legalBasis:'Not real legal content'}))}));policyId=policy.policyId;
  delivery={schemaVersion:'USKOCI_EXPORT_DELIVERY_V2',projectionVersion:'OWN_ACCOUNT_V5_1',projectionSha256:sql('select private.data_export_projection_sha_v5()'),privacyDocumentId:privacy,privacyContentSha256:'a'.repeat(64),artifactLifetimeSeconds:600,snapshotLifetimeSeconds:600,downloadLifetimeSeconds:60,cleanupMode:'DELETE_EXPORT_COPY',snapshotCleanupMode:'DELETE_TEMP_SNAPSHOT',datasets:catalog.map(x=>({key:x.key,mode:'INCLUDE',fields:x.fields}))};
  reviewDelivery();assert.ok(bind());
  for(const patch of [{schemaVersion:'USKOCI_EXPORT_DELIVERY_V1'},{projectionVersion:'OWN_ACCOUNT_V1'},{projectionSha256:'0'.repeat(64)},
   {datasets:delivery.datasets.slice(1)},{datasets:delivery.datasets.map(d=>d.key==='workerAiDrafts'?{...d,fields:['profile','providerPayload']}:d)},
   {datasets:delivery.datasets.map(d=>d.key==='ownedMediaAssets'?{...d,fields:['id','scope']}:d)}]){reviewDelivery(patch);assert.equal(bind(),null);}
  reviewDelivery();
  const originalCatalog=sql("select pg_get_functiondef('private.data_export_dataset_catalog()'::regprocedure)");
  try{sql("create or replace function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $$ select '[]'::jsonb $$");assert.equal(bind(),null);}finally{sql(originalCatalog);}
  const originalScalar=sql("select pg_get_functiondef('private.data_export_scalar_v5(jsonb,text)'::regprocedure)");
  try{sql("create or replace function private.data_export_scalar_v5(v jsonb,t text) returns jsonb language sql immutable set search_path=pg_catalog as $$ select 'null'::jsonb $$");assert.equal(bind(),null);}finally{sql(originalScalar);}
  assert.ok(bind(),'Exact compiled sanitizer restoration restores the reviewed hash');
  const rule=rows(`select * from private.retention_policy_rules where policy_id=${q(policyId)}::uuid and data_class='AGREEMENT_REVIEWS'`)[0];
  sql(`delete from private.retention_policy_rules where id=${q(rule.id)}::uuid`);assert.equal(bind(),null);
  sql(`insert into private.retention_policy_rules select (jsonb_populate_record(null::private.retention_policy_rules,${q(JSON.stringify(rule))}::jsonb)).*`);assert.ok(bind());
  pass(report,'REVIEWED_V2_BINDING_EXACT_CATALOG_SOURCE_HASH_REQUIRED_CLASS_AND_UNKNOWN_FIELD_DRIFT_CLOSED');

  const doc=snapshot(requesterId,bind()),bytes=JSON.stringify(doc);
  assert.equal(doc.schemaVersion,'USKOCI_DATA_EXPORT_V2');assert.equal(doc.projectionVersion,'OWN_ACCOUNT_V5_1');assert.equal(Object.keys(doc.datasets).length,37);
  assert.ok(doc.datasets.ownAgreementReviews.some(x=>x.id===ownReview));assert.ok(!doc.datasets.ownAgreementReviews.some(x=>x.id===peerReview));
  for(const text of ['OWN_EXPORT_NARRATIVE','OWN_EXPORT_CANDIDATE','OWN_REVIEW_TITLE','OWN_PRIVATE_ADDRESS'])assert.ok(bytes.includes(text),text);
  for(const secret of ['PEER_EXPORT_SECRET','NESTED_SECRET','COORDINATE_SECRET','PROVIDER_SECRET','AVAILABILITY_SECRET','WHOLE_ENVELOPE_SECRET','FACT_SECRET','UNKNOWN_FACT_SECRET','CROSS_PARENT_SECRET','WORKER_REVIEW_SECRET','GEOGRAPHY_SECRET','WAYPOINT_SECRET','POINT_ORIGIN_SECRET','GEOGRAPHY_HASH_SECRET'])assert.ok(!bytes.includes(secret),secret);
  const ownTaskReview=doc.datasets.taskAiReviews.find(x=>x.id===review);
  assert.equal(ownTaskReview.publicFacts.find(x=>x.key==='need.task_geography').value.waypoints[0].label,'OWN_WAYPOINT');
  const point=ownTaskReview.privateFacts.find(x=>x.key==='need.resolved_location').value.points[0];
  assert.equal(point.address,'OWN_POINT_ADDRESS');assert.equal(point.latitudeE6,45250000);assert.equal(point.longitudeE6,19850000);
  for(const key of ['input_sha256','providerPayload','textSha256','request_hash','operation_id','client_request_id','snapshot_text','raw_user_meta_data'])assert.ok(!bytes.includes('"'+key+'"'));
  for(const media of doc.datasets.ownedMediaAssets)assert.equal(media.bytesIncluded,false);
  for(const allocation of doc.datasets.testAllocations)assert.equal(allocation.measuredProviderCharge,false);
  assert.equal(doc.datasets.testAllocations.length,Number(sql(`select count(*) from private.ai_test_reservations_v5 where account_id=${q(requesterId)}::uuid`)));
  reviewDelivery({datasets:delivery.datasets.map(d=>d.key==='ownSafetyReports'?{key:d.key,mode:'EXCLUDE',reasonCode:'DISPOSABLE_REVIEWED_OMISSION'}:d.key==='workerAiDrafts'?{...d,fields:['conversationId','revision']}:d)});
  const limited=snapshot(requesterId,bind());assert.equal(limited.datasets.ownSafetyReports,undefined);assert.ok(limited.reviewedOmissions.some(x=>x.key==='ownSafetyReports'));
  assert.ok(limited.datasets.workerAiDrafts.every(x=>Object.keys(x).sort().join(',')==='conversationId,revision'));reviewDelivery();
  pass(report,'TWO_ACCOUNT_OWN_AUTHOR_REVIEW_ONLY_PRIVATE_PARENT_JOIN_TYPED_NESTED_ALLOWLIST_REVIEWED_INCLUDE_EXCLUDE');

  const current=await ok(requester.rpc('rpc_get_data_export_status',{}));
  if(current.request?.status==='REQUESTED')await ok(requester.rpc('rpc_cancel_data_export',{p_receipt_id:current.request.receiptId}));
  assert.notEqual(current.request?.status,'PROCESSING','Unexpected previous active export');
  const request=await ok(requester.rpc('rpc_request_data_export',{p_client_request_id:'v5-export-'+randomUUID()}));
  const ownerToken=(await ok(requester.auth.getSession())).session.access_token,peerToken=(await ok(worker.auth.getSession())).session.access_token;
  const origin=new URL(env.RU5_DEVICE_SUPABASE_URL).origin;
  async function handler(kind,token,body){const runtime=loadExportHandler(kind,{env:name=>({SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY})[name],fetch:async(target,init)=>{assert.equal(new URL(target).origin,origin);return fetch(target,init);}});return runtime.handler(new Request(origin+'/functions/v1/export',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));}
  const prepared=await handler('worker',ownerToken,{action:'prepare',receiptId:request.receiptId});assert.equal(prepared.status,200);assert.equal((await prepared.json()).kind,'READY');
  const status=await ok(requester.rpc('rpc_get_data_export_status',{}));assert.equal(status.downloadAvailable,true);assert.equal(status.request.status,'READY');
  const downloaded=await handler('download',ownerToken,{receiptId:request.receiptId,artifactGeneration:status.fulfillment.artifactGeneration});assert.equal(downloaded.status,200);
  const archive=Buffer.from(await downloaded.arrayBuffer());assert.equal(hash(archive),status.fulfillment.sha256);assert.equal(archive.length,status.fulfillment.byteLength);
  assert.equal(JSON.parse(archive.toString()).datasets.ownAgreementReviews.some(x=>x.id===peerReview),false);
  const foreign=await handler('download',peerToken,{receiptId:request.receiptId,artifactGeneration:status.fulfillment.artifactGeneration});assert.notEqual(foreign.status,200);
  for(const client of [requester,worker,anon])await denied(client.storage.from('data-export-artifacts').download(`${requesterId}/${request.receiptId}/${status.fulfillment.artifactGeneration}.json`));
  await denied(worker.rpc('rpc_authorize_data_export_download',{p_receipt_id:request.receiptId,p_artifact_generation:status.fulfillment.artifactGeneration}),'DATA_EXPORT_REQUEST_NOT_FOUND');
  pass(report,'ACTUAL_REQUEST_CURRENT_WORKER_STORAGE_UPLOAD_READBACK_READY_HASHED_DOWNLOAD_FOREIGN_AND_DIRECT_STORAGE_DENIED');
 }finally{
  if(policyId)sql(`update private.retention_policy_sets set retired_at=greatest(clock_timestamp(),effective_at+interval '1 second') where id=${q(policyId)}::uuid`);
  sql(`update private.legal_document_versions set is_active=false where id=${q(privacy)}::uuid`);
  for(const p of oldPolicies)sql(`update private.retention_policy_sets set retired_at=null where id=${q(p.id)}::uuid`);
  for(const p of oldPrivacy)sql(`update private.legal_document_versions set is_active=true where id=${q(p.id)}::uuid`);
 }
 pass(report,'SYNTHETIC_POLICY_AND_PRIVACY_POINTERS_RETIRED_PREDECESSOR_POINTERS_RESTORED_NO_LIVE_ACTIVATION');
});
