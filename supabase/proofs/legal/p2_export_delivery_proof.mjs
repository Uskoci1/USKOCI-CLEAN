// Exact SQL104 + actual current worker/download handlers against real loopback
// Auth/PostgREST/Storage. Policies are explicit disposable fixtures, never legal
// content. No READY/storage success is fabricated through SQL or mocked RPCs.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {loadExportHandler} from './data_export_edge_runtime.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);assert.equal(env.P2_DELIVERY_DISPOSABLE_PROOF,'1');
const origin=new URL(url).origin,out=env.P2_DELIVERY_ARTIFACT_DIR||(env.P2_ARTIFACT_DIR||'artifacts/p2-data-export')+'/delivery';
mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('supabase/proofs/legal/p2_export_delivery_files.json','utf8'));
const sourcePath='supabase/migrations/'+manifest.forward_file,source=readFileSync(sourcePath);
const digest=(x,algorithm='sha256')=>createHash(algorithm).update(x).digest('hex');
assert.deepEqual(source,readFileSync(manifest.candidate_file));assert.equal(source.length,manifest.bytes);assert.equal(digest(source),manifest.sha256);assert.equal(digest(source,'md5'),manifest.md5);
const report={unit:'P2_EXPORT_DELIVERY',source_sha:env.GITHUB_SHA??null,run_id:env.GITHUB_RUN_ID??null,result:'RUNNING',checks:[],lock_interleavings:[],
  live_access:false,live_promotion:false,legal_content_real:false,policy_activated_live:false,mocked_rpc_responses:false,mocked_storage:false,
  ready_fixture_sql:false,auth_fixture:'EXISTING_LOOPBACK_REQUESTER_WORKER',policy_fixture:'EXPLICIT_SYNTHETIC_P1_P3_DELIVERY_REVIEW',
  actual_handler:true,edge_gateway_proven:false,physical_device_proven:false,production_scheduler_wired:false,
  binary_media_export:false,full_account_completeness_claim:false,technical_scope:'REVIEWED_COMPILED_JSON_FIELDS_ONLY',
  input_sha256:{[sourcePath]:digest(source)},transport_counts:{auth:0,rpc:0,storage:0},cleanup_transport:[],candidate:manifest};
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
function sql(query){try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:24*1024*1024}).trim();}
catch(e){report.failed_sql={state:String(e.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNAVAILABLE',query_sha256:digest(query)};throw new Error('DISPOSABLE_SQL_FAILED');}}
const rows=query=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (${query}) x`));
const hashTable=(table,where='true',remove=[])=>{const value=`to_jsonb(t)-array[${remove.map(q).join(',')}]::text[]`;return sql(`select md5(coalesce(jsonb_agg(${value} order by (${value})::text),'[]'::jsonb)::text) from ${table} t where ${where}`);};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options),owner=createClient(url,env.RU5_DEVICE_ANON_KEY,options),other=createClient(url,env.RU5_DEVICE_ANON_KEY,options),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const rid=env.RU5_DEVICE_REQUESTER_USER_ID,wid=env.RU5_DEVICE_WORKER_USER_ID;
for(const id of [rid,wid])assert.match(id,/^[0-9a-f-]{36}$/i);
const ok=async value=>{const r=await value;if(r.error)throw new Error('LOCAL_AUTH_RPC_'+String(r.error.code??'FAILED'));return r.data;};
async function rejected(value,message){const r=await value;assert.ok(r.error,'EXPECTED_REJECTION');if(message)assert.equal(r.error.message,message);return r.error;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(value){let timer;try{return await Promise.race([value,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('GLOBAL_WORK_BLOCKED_BY_OTHER_ACCOUNT')),8000);})]);}finally{clearTimeout(timer);}}
let current='PREFLIGHT',ownerToken,otherToken,policyId,privacyId,policy,policyRowsBefore,privacyRowsBefore,historyBefore,oldRequests;
const check=name=>{current=name;console.log('START_CHECK '+name);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log('PASS_CHECK '+current);};
const request=client=>ok(client.rpc('rpc_request_data_export',{p_client_request_id:'p2-delivery-'+randomUUID()}));
const status=()=>ok(owner.rpc('rpc_get_data_export_status'));
const claim=id=>ok(admin.rpc('rpc_claim_data_export',{p_receipt_id:id,p_account_id:rid}));
const revoke=id=>ok(owner.rpc('rpc_revoke_data_export_download',{p_receipt_id:id}));
async function clearRequested(client){const s=await ok(client.rpc('rpc_get_data_export_status'));if(s.request?.status==='REQUESTED')await ok(client.rpc('rpc_cancel_data_export',{p_receipt_id:s.request.receiptId}));else assert.notEqual(s.request?.status,'PROCESSING','UNEXPECTED_EXISTING_PROCESSING_FIXTURE');}
function reviewDelivery(patch={}){
  policy={...policy,...patch};delete policy.contentSha256;
  sql(`update private.retention_policy_sets set export_delivery=${q(JSON.stringify(policy))}::jsonb where id=${q(policyId)};
       update private.retention_policy_sets set export_delivery=export_delivery||jsonb_build_object('contentSha256',encode(extensions.digest(convert_to(export_delivery::text,'UTF8'),'sha256'),'hex')) where id=${q(policyId)}`);
}
const safeErrorToken=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)?value:value==null?null:'UNRECOGNIZED';
const safeHttpStatus=value=>/^[1-5][0-9]{2}$/.test(String(value))?Number(value):null;
async function observeCleanupResponse(u,init,response){
  // Safe transport diagnostics only: no request IDs, paths, headers, messages,
  // private row values, JWTs or arbitrary upstream bodies enter the report.
  if(u.pathname.startsWith('/storage/v1/object/')&&!response.ok){
    let body;try{body=await response.clone().json();}catch{body=null;}
    report.cleanup_transport.push({check:current,stage:'STORAGE_ERROR',method:init.method,status:response.status,
      code:safeErrorToken(body?.code),error:safeErrorToken(body?.error),statusCode:safeHttpStatus(body?.statusCode),httpStatusCode:safeHttpStatus(body?.httpStatusCode)});
  }
  if(u.pathname.endsWith('/rpc_complete_data_export_cleanup')){
    let body;try{body=await response.clone().json();}catch{body=null;}
    const sent=JSON.parse(init.body);
    report.cleanup_transport.push({check:current,stage:'CLEANUP_COMPLETE',status:response.status,submittedDeleted:sent.p_deleted===true,
      returnedDeleted:typeof body?.deleted==='boolean'?body.deleted:null,errorCode:safeErrorToken(body?.code)});
  }
}
async function handler(kind,token,body,intercept){
  const runtime=loadExportHandler(kind,{env:name=>({SUPABASE_URL:url,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY})[name],
    fetch:async(target,init)=>{const u=new URL(target);assert.equal(u.origin,origin);assert.ok(['/auth/v1/user','/rest/v1/rpc/','/storage/v1/object/'].some(p=>u.pathname.startsWith(p)),'UNDECLARED_LOCAL_TRANSPORT');
      const channel=u.pathname.startsWith('/auth/')?'auth':u.pathname.startsWith('/rest/')?'rpc':'storage';report.transport_counts[channel]++;
      assert.equal(init.redirect,'error');const response=await fetch(target,init);
      if(kind==='worker'&&(body.action==='cleanup'||body.action==='tick'))await observeCleanupResponse(u,init,response);
      if(intercept)await intercept(u,init,response);return response;}});
  Object.assign(report.input_sha256,runtime.sourceHashes);
  return runtime.handler(new Request(origin+'/functions/v1/uskoci-data-export-'+kind,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));
}
async function prepare(id,intercept){const r=await handler('worker',ownerToken,{action:'prepare',receiptId:id},intercept);assert.equal(r.status,200);return r.json();}
async function downloaded(id,generation,token=ownerToken){return handler('download',token,{receiptId:id,artifactGeneration:generation});}
async function awaitExpired(iso){const deadline=Date.parse(iso)+100;while(Date.now()<deadline)await sleep(Math.min(500,deadline-Date.now()));}
async function cleanup(id){const r=await handler('worker',ownerToken,{action:'cleanup',receiptId:id});assert.equal(r.status,200,'CLEANUP_HANDLER_HTTP_STATUS');await r.arrayBuffer();}
const children=[];
async function holdAccount(label,accountId=rid){
  const child=spawn('psql',[db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});children.push(child);
  const ready=new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('LOCK_HOLDER_TIMEOUT')),10000);child.stdout.on('data',b=>{text+=b.toString();if(text.includes('P2_HELD')){clearTimeout(timer);resolve();}});});
  child.stdin.write(`set application_name=${q(label)};begin;select pg_advisory_xact_lock(hashtextextended('uskoci:data-export:'||${q(accountId)},0));select 'P2_HELD';\n`);await ready;
  return async()=>{child.stdin.end('rollback;\n');await new Promise(resolve=>child.once('exit',resolve));};
}
async function waitBlocked(label,minimum){for(let i=0;i<80;i++){const n=Number(sql(`select count(*) from pg_stat_activity a where a.pid<>pg_backend_pid() and exists(select 1 from pg_stat_activity h where h.application_name=${q(label)} and h.pid=any(pg_blocking_pids(a.pid)))`));if(n>=minimum)return n;await sleep(50);}throw new Error('EXPECTED_ACCOUNT_LOCK_NOT_OBSERVED');}

try{
  check('EXACT_SOURCE103_TO104_PRESERVES_OLD_REQUESTS_ACLS_AND_HISTORY');
  assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')),103);
  historyBefore=hashTable('supabase_migrations.schema_migrations');oldRequests=hashTable('public.data_export_requests');
  const aclBefore=rows("select oid::regprocedure::text signature,proacl::text acl from pg_proc where oid in ('public.rpc_get_data_export_status()'::regprocedure,'public.rpc_request_data_export(text)'::regprocedure,'public.rpc_cancel_data_export(uuid)'::regprocedure,'private.marketplace_tick(integer,timestamptz)'::regprocedure) order by signature");
  policyRowsBefore=hashTable('private.retention_policy_sets');privacyRowsBefore=hashTable('private.legal_document_versions');
  sql(source.toString('utf8'));
  sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(manifest.forward_version)},${q(manifest.forward_name)},array[${q(source.toString('utf8'))}]);notify pgrst,'reload schema'`);
  assert.equal(hashTable('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),historyBefore);
  assert.equal(hashTable('public.data_export_requests','true',['active_export_attempt_id','export_attempt_count','export_next_attempt_at','export_revoked_at']),oldRequests);
  assert.equal(hashTable('private.retention_policy_sets','true',['export_delivery']),policyRowsBefore);
  assert.equal(hashTable('private.legal_document_versions'),privacyRowsBefore);
  assert.deepEqual(rows("select oid::regprocedure::text signature,proacl::text acl from pg_proc where oid in ('public.rpc_get_data_export_status()'::regprocedure,'public.rpc_request_data_export(text)'::regprocedure,'public.rpc_cancel_data_export(uuid)'::regprocedure,'private.marketplace_tick(integer,timestamptz)'::regprocedure) order by signature"),aclBefore);
  assert.equal(sql("select public=false and file_size_limit=8388608 and allowed_mime_types=array['application/json']::text[] from storage.buckets where id='data-export-artifacts'"),'t');
  assert.equal(sql('select count(*) from private.data_export_artifacts'),'0');
  assert.ok(Number(sql("select count(*) from public.data_export_requests where status='READY'"))>0,'PREDECESSOR_LEGACY_READY_FIXTURE_REQUIRED');
  assert.equal(sql("select count(*) from public.data_export_requests where status='READY' and private.data_export_descriptor(id,account_id) is not null"),'0');
  report.original_source103_history_unchanged=true;pass();

  check('REAL_FIXTURE_AUTH_AND_CLOSED_PRIVATE_SERVICE_SURFACES');
  for(const [client,email,id] of [[owner,env.RU5_DEVICE_REQUESTER_EMAIL,rid],[other,env.RU5_DEVICE_WORKER_EMAIL,wid]]){
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  ownerToken=(await ok(owner.auth.getSession())).session.access_token;otherToken=(await ok(other.auth.getSession())).session.access_token;
  let ready=false;for(let i=0;i<80;i++){const r=await admin.rpc('rpc_claim_data_export',{p_receipt_id:randomUUID(),p_account_id:rid});if(!r.error){assert.deepEqual(r.data,{kind:'NONE'});ready=true;break;}await sleep(100);}assert.ok(ready);
  await clearRequested(owner);await clearRequested(other);
  for(const client of [owner,other,anon])await rejected(client.rpc('rpc_claim_data_export',{p_receipt_id:null,p_account_id:null}));
  const closed=rows("select p.oid::regprocedure::text signature,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (p.proname like 'data_export_%' or p.proname='revoke_data_export_receipt')");
  assert.ok(closed.length>=7);for(const entry of closed)assert.deepEqual([entry.anon,entry.authenticated,entry.service],[false,false,false]);
  pass();

  check('MISSING_REVIEWED_DELIVERY_POLICY_NEVER_CLAIMS_OR_EXPOSES_ARTIFACT');
  let draft=await request(owner);
  assert.deepEqual(await claim(draft.receiptId),{kind:'NOT_READY',code:'EXPORT_POLICY_NOT_READY'});
  assert.equal((await status()).downloadAvailable,false);assert.equal((await status()).fulfillment,null);
  assert.equal((await prepare(draft.receiptId)).kind,'NOT_READY');
  assert.equal(sql('select count(*) from private.data_export_artifacts'),'0');
  pass();

  check('EXPLICIT_SYNTHETIC_P1_P3_POLICY_AND_COMPILED_FIELD_ADMISSION');
  assert.equal(sql('select count(*) from private.retention_policy_sets where retired_at is null'),'0','PREDECESSOR_POLICY_NOT_INERT');
  assert.equal(sql("select count(*) from private.legal_document_versions where document_kind='PRIVACY' and is_active"),'0');
  privacyId=randomUUID();
  sql(`insert into private.legal_document_versions(id,document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values(${q(privacyId)},'PRIVACY',${q('P2_DISPOSABLE_'+randomUUID())},${q('a'.repeat(64))},'https://proof.invalid/privacy',clock_timestamp()-interval '1 second',clock_timestamp()-interval '1 second',true)`);
  const classes=rows('select code from private.retention_data_classes where active and required order by code');
  const published=await ok(admin.rpc('rpc_publish_retention_policy',{p_policy_version:'P2_DISPOSABLE_'+randomUUID(),p_counsel_reference:'DISPOSABLE_SYNTHETIC_ONLY_NOT_LEGAL_CONTENT',p_effective_at:new Date(Date.now()-1000).toISOString(),p_rules:classes.map(x=>({dataClass:x.code,purpose:'DISPOSABLE synthetic export purpose',retentionPeriod:'DISPOSABLE test only',deletionTrigger:'DISPOSABLE synthetic trigger',exceptionRule:'DISPOSABLE explicit test fixture',legalBasis:'DISPOSABLE no actual legal basis'}))}));
  policyId=published.policyId;assert.equal(published.executionAdmitted,false);
  const catalog=JSON.parse(sql('select private.data_export_dataset_catalog()'));
  assert.equal(catalog.length,18);assert.equal(new Set(catalog.map(x=>x.dataClass)).size,14);
  policy={schemaVersion:'USKOCI_EXPORT_DELIVERY_V1',projectionVersion:'OWN_ACCOUNT_V1',privacyDocumentId:privacyId,privacyContentSha256:'a'.repeat(64),artifactLifetimeSeconds:20,snapshotLifetimeSeconds:22,downloadLifetimeSeconds:3,cleanupMode:'DELETE_EXPORT_COPY',snapshotCleanupMode:'DELETE_TEMP_SNAPSHOT',datasets:catalog.map(x=>({key:x.key,mode:'INCLUDE',fields:x.fields}))};
  reviewDelivery();assert.notEqual(sql('select private.data_export_policy_binding() is null'),'t');
  const original=structuredClone(policy);
  for(const patch of [{schemaVersion:null},{downloadLifetimeSeconds:0},{cleanupMode:null},{projectionVersion:'ARBITRARY_SQL'},{datasets:policy.datasets.slice(1)},
    {datasets:policy.datasets.map((d,i)=>i?d:{...d,fields:['id','encrypted_password']})},
    {datasets:policy.datasets.map(d=>d.key==='mediaMetadata'?{...d,fields:['name']}:d)}]){
    reviewDelivery({...original,...patch});assert.deepEqual(await claim(draft.receiptId),{kind:'NOT_READY',code:'EXPORT_POLICY_NOT_READY'});
  }
  reviewDelivery(original);pass();

  check('ACTUAL_WORKER_UPLOAD_READBACK_READY_AND_ACTUAL_DOWNLOAD_BYTES');
  const made=await prepare(draft.receiptId);assert.deepEqual(made,{receiptId:draft.receiptId,kind:'READY'});
  let s=await status(),descriptor=s.fulfillment;
  assert.equal(s.request.status,'READY');assert.equal(s.downloadAvailable,true);assert.equal(descriptor.artifactAvailable,true);
  const response=await downloaded(draft.receiptId,descriptor.artifactGeneration);assert.equal(response.status,200);
  const archive=Buffer.from(await response.arrayBuffer());assert.equal(archive.length,descriptor.byteLength);assert.equal(digest(archive),descriptor.sha256);assert.equal(digest(archive,'md5'),descriptor.md5);
  const parsed=JSON.parse(archive.toString('utf8'));assert.equal(parsed.accountId,rid);assert.equal(parsed.receiptId,draft.receiptId);assert.equal(parsed.datasets.account.length,1);assert.equal(parsed.datasets.account[0].id,rid);
  for(const media of parsed.datasets.mediaMetadata)assert.equal(media.bytesIncluded,false);
  assert.equal(parsed.datasets.profiles.length,Number(sql(`select count(*) from public.app_profiles where account_id=${q(rid)}`)));assert.ok(parsed.datasets.profiles.length>=2,'BOTH_INTENTS_EXPORTED');
  assert.ok(!archive.includes(Buffer.from(env.RU5_DEVICE_SERVICE_ROLE_KEY)));assert.ok(!archive.includes(Buffer.from(ownerToken)));assert.ok(!archive.includes(Buffer.from(otherToken)));
  assert.ok(!archive.includes(Buffer.from(env.RU5_DEVICE_WORKER_EMAIL)),'FOREIGN_ACCOUNT_EMAIL_EXPORTED');
  for(const key of ['encrypted_password','refresh_token','raw_app_meta_data','raw_user_meta_data','downloadGrantId','objectPath'])assert.ok(!archive.includes(Buffer.from('"'+key+'"')));
  report.actual_worker_storage_upload_readback=true;report.actual_authenticated_download_bytes=true;report.archive={bytes:archive.length,sha256:descriptor.sha256,md5:descriptor.md5,datasets:Object.keys(parsed.datasets).length};
  pass();

  check('FOREIGN_ANON_DIRECT_STORAGE_AND_STALE_GENERATION_DENIED');
  const path=rid+'/'+draft.receiptId+'/'+descriptor.artifactGeneration+'.json';
  for(const client of [owner,other,anon]){const result=await client.storage.from('data-export-artifacts').download(path);assert.ok(result.error,'DIRECT_EXPORT_STORAGE_READ_ALLOWED');}
  const foreign=await downloaded(draft.receiptId,descriptor.artifactGeneration,otherToken);assert.notEqual(foreign.status,200);assert.ok(!(await foreign.text()).includes(rid));
  await rejected(other.rpc('rpc_authorize_data_export_download',{p_receipt_id:draft.receiptId,p_artifact_generation:descriptor.artifactGeneration}),'DATA_EXPORT_REQUEST_NOT_FOUND');
  await rejected(owner.rpc('rpc_authorize_data_export_download',{p_receipt_id:draft.receiptId,p_artifact_generation:randomUUID()}),'EXPORT_GENERATION_STALE');
  const anonResult=await handler('download','invalid-token-at-least-sixteen',{receiptId:draft.receiptId,artifactGeneration:descriptor.artifactGeneration});assert.notEqual(anonResult.status,200);
  pass();

  check('DOWNLOAD_GRANT_ROTATION_EXPIRY_AND_REVOCATION_RECHECK');
  const g1=await ok(owner.rpc('rpc_authorize_data_export_download',{p_receipt_id:draft.receiptId,p_artifact_generation:descriptor.artifactGeneration}));
  const g2=await ok(owner.rpc('rpc_authorize_data_export_download',{p_receipt_id:draft.receiptId,p_artifact_generation:descriptor.artifactGeneration}));
  await rejected(admin.rpc('rpc_resolve_data_export_download',{p_receipt_id:draft.receiptId,p_download_grant_id:g1.downloadGrantId,p_account_id:rid}),'EXPORT_GRANT_EXPIRED');
  await awaitExpired(g2.expiresAt);
  await rejected(admin.rpc('rpc_resolve_data_export_download',{p_receipt_id:draft.receiptId,p_download_grant_id:g2.downloadGrantId,p_account_id:rid}),'EXPORT_GRANT_EXPIRED');
  assert.equal((await revoke(draft.receiptId)).revoked,true);assert.equal((await revoke(draft.receiptId)).idempotentReplay,true);
  assert.equal((await status()).downloadAvailable,false);assert.notEqual((await downloaded(draft.receiptId,descriptor.artifactGeneration)).status,200);
  pass();

  check('ACTUAL_EXACT_OBJECT_CLEANUP_AFTER_WRITER_LEASE_AND_SNAPSHOT_PURGE');
  await awaitExpired(descriptor.artifactExpiresAt);await cleanup(draft.receiptId);
  const absent=await admin.storage.from('data-export-artifacts').download(path);
  report.cleanup_transport.push({check:current,stage:'INDEPENDENT_STORAGE_READBACK',missing:!!absent.error,statusCode:safeHttpStatus(absent.error?.statusCode),errorCode:safeErrorToken(absent.error?.code)});
  assert.ok(absent.error,'EXACT_OBJECT_STILL_PRESENT');
  assert.equal(sql(`select deleted_at is not null from private.data_export_artifacts where id=${q(descriptor.artifactGeneration)}`),'t','CLEANUP_ABSENCE_NOT_ATTESTED');
  const snapshotDeadline=sql(`select snapshot_expires_at::text from private.data_export_artifacts where id=${q(descriptor.artifactGeneration)}`);await awaitExpired(snapshotDeadline);
  const maintenance=JSON.parse(sql('select private.data_export_maintenance(100)'));assert.equal(maintenance.storageDeletionPerformed,false);
  assert.equal(sql(`select snapshot_text is null from private.data_export_artifacts where id=${q(descriptor.artifactGeneration)}`),'t');
  report.actual_storage_cleanup_readback=true;pass();

  check('LATE_REAL_UPLOAD_TO_RETIRED_EXACT_GENERATION_IS_RECONCILED');
  const previousCleanup=rows(`select cleanup_attempt_id,cleanup_next_at,deleted_at from private.data_export_artifacts where id=${q(descriptor.artifactGeneration)}`)[0];
  assert.ok(previousCleanup.cleanup_next_at);assert.ok(previousCleanup.deleted_at);
  // Model an already-issued remote upload committing after the first absence proof.
  // Real service Storage IO uses the identical retired path and original bytes.
  await ok(admin.storage.from('data-export-artifacts').upload(path,archive,{contentType:'application/json',upsert:false}));
  const lateBytes=Buffer.from(await (await ok(admin.storage.from('data-export-artifacts').download(path))).arrayBuffer());assert.equal(digest(lateBytes),descriptor.sha256);
  assert.equal((await status()).downloadAvailable,false);assert.notEqual((await downloaded(draft.receiptId,descriptor.artifactGeneration)).status,200);
  assert.deepEqual(await ok(admin.rpc('rpc_claim_data_export_cleanup',{p_receipt_id:draft.receiptId,p_account_id:rid})),{kind:'NONE'});
  await awaitExpired(previousCleanup.cleanup_next_at);await cleanup(draft.receiptId);
  assert.ok((await admin.storage.from('data-export-artifacts').download(path)).error);
  const reconciled=rows(`select cleanup_attempt_id,cleanup_next_at,cleanup_lease_until,cleanup_deleted,deleted_at from private.data_export_artifacts where id=${q(descriptor.artifactGeneration)}`)[0];
  assert.notEqual(reconciled.cleanup_attempt_id,previousCleanup.cleanup_attempt_id);assert.equal(reconciled.cleanup_lease_until,null);assert.equal(reconciled.cleanup_deleted,true);
  assert.ok(Date.parse(reconciled.deleted_at)>Date.parse(previousCleanup.deleted_at));assert.ok(Date.parse(reconciled.cleanup_next_at)>Date.parse(reconciled.deleted_at));
  await rejected(admin.rpc('rpc_complete_data_export_cleanup',{p_receipt_id:draft.receiptId,p_artifact_generation:descriptor.artifactGeneration,p_cleanup_attempt_id:previousCleanup.cleanup_attempt_id,p_deleted:true}),'EXPORT_ATTEMPT_STALE');
  const replay=await ok(admin.rpc('rpc_complete_data_export_cleanup',{p_receipt_id:draft.receiptId,p_artifact_generation:descriptor.artifactGeneration,p_cleanup_attempt_id:reconciled.cleanup_attempt_id,p_deleted:true}));assert.equal(replay.deleted,true);
  assert.equal(sql(`select cleanup_next_at::text from private.data_export_artifacts where id=${q(descriptor.artifactGeneration)}`),sql(`select ${q(reconciled.cleanup_next_at)}::timestamptz::text`));
  report.actual_late_storage_commit_reconciled=true;report.cleanup_reconciliation_seconds=60;pass();

  check('SHORTER_CONFIGURED_SNAPSHOT_RETENTION_KEEPS_VERIFIED_ARTIFACT_AVAILABLE');
  reviewDelivery({artifactLifetimeSeconds:20,snapshotLifetimeSeconds:1,downloadLifetimeSeconds:3});draft=await request(owner);
  assert.equal((await prepare(draft.receiptId)).kind,'READY');s=await status();
  const shorter=rows(`select lease_until,snapshot_expires_at,artifact_expires_at from private.data_export_artifacts where id=${q(s.fulfillment.artifactGeneration)}`)[0];
  assert.ok(Date.parse(shorter.snapshot_expires_at)<Date.parse(shorter.artifact_expires_at));await awaitExpired(shorter.snapshot_expires_at);
  // A completed worker no longer needs its temporary SQL snapshot; physical bytes
  // remain available until their independently configured artifact deadline.
  JSON.parse(sql('select private.data_export_maintenance(100)'));
  assert.equal(sql(`select snapshot_text is null from private.data_export_artifacts where id=${q(s.fulfillment.artifactGeneration)}`),'t');
  const independent=await downloaded(draft.receiptId,s.fulfillment.artifactGeneration);assert.equal(independent.status,200);await independent.arrayBuffer();
  await revoke(draft.receiptId);pass();

  check('UNCERTAIN_REAL_COMPLETION_DOES_NOT_DELETE_COMMITTED_ARTIFACT');
  reviewDelivery({artifactLifetimeSeconds:20,snapshotLifetimeSeconds:22});draft=await request(owner);let dropped=false;
  const uncertain=await prepare(draft.receiptId,async(u,init,response)=>{if(!dropped&&u.pathname.endsWith('/rpc_complete_data_export')&&response.ok){dropped=true;await response.arrayBuffer();throw new Error('INJECTED_POSTCOMMIT_DISCONNECT');}});
  assert.ok(dropped);assert.equal(uncertain.kind,'NOT_READY');s=await status();assert.equal(s.request.status,'READY');assert.equal(s.downloadAvailable,true);
  const stillPresent=await downloaded(draft.receiptId,s.fulfillment.artifactGeneration);assert.equal(stillPresent.status,200);await stillPresent.arrayBuffer();
  report.injected_postcommit_disconnect=true;await revoke(draft.receiptId);pass();

  check('STALE_ATTEMPT_RECLAIM_CANNOT_COMMIT_OR_REVOKE_WINNER');
  reviewDelivery({artifactLifetimeSeconds:2,snapshotLifetimeSeconds:3,downloadLifetimeSeconds:1});draft=await request(owner);const first=await claim(draft.receiptId);assert.equal(first.kind,'CLAIMED');
  await awaitExpired(first.leaseExpiresAt);reviewDelivery({artifactLifetimeSeconds:20,snapshotLifetimeSeconds:22,downloadLifetimeSeconds:3});
  const next=await claim(draft.receiptId);assert.equal(next.kind,'CLAIMED');assert.notEqual(first.attemptId,next.attemptId);assert.notEqual(first.objectPath,next.objectPath);
  await rejected(admin.rpc('rpc_complete_data_export',{p_receipt_id:draft.receiptId,p_attempt_id:first.attemptId,p_byte_length:first.byteLength,p_sha256:first.sha256}),'EXPORT_ATTEMPT_STALE');
  await rejected(admin.rpc('rpc_fail_data_export',{p_receipt_id:draft.receiptId,p_attempt_id:first.attemptId,p_failure_code:'EXPORT_WORKER_FAILED',p_retryable:true}),'EXPORT_ATTEMPT_STALE');
  assert.equal(sql(`select active_export_attempt_id::text from public.data_export_requests where id=${q(draft.receiptId)}`),next.attemptId);
  await rejected(admin.rpc('rpc_complete_data_export',{p_receipt_id:draft.receiptId,p_attempt_id:next.attemptId,p_byte_length:next.byteLength+1,p_sha256:next.sha256}),'EXPORT_ARTIFACT_MISMATCH');
  await revoke(draft.receiptId);pass();

  check('POLICY_CHANGE_BETWEEN_PHYSICAL_STORAGE_VERIFY_AND_READY_IS_CLOSED');
  draft=await request(owner);let changed=false;
  const oldFetch=async(u,init,response)=>{if(!changed&&u.pathname.startsWith('/storage/v1/object/')&&init.method==='GET'&&response.ok){changed=true;reviewDelivery({downloadLifetimeSeconds:4});}};
  const stale=await prepare(draft.receiptId,oldFetch);assert.ok(changed);assert.equal(stale.kind,'NOT_READY');assert.equal((await status()).downloadAvailable,false);assert.notEqual((await status()).request.status,'READY');
  await revoke(draft.receiptId);reviewDelivery({downloadLifetimeSeconds:3});pass();

  check('OBSERVED_CANCEL_CLAIM_SHARE_EXISTING_ACCOUNT_SERIALIZATION');
  for(const claimFirst of [false,true]){
    draft=await request(owner);const label='p2-delivery-holder-'+randomUUID(),release=await holdAccount(label);
    const doClaim=()=>admin.rpc('rpc_claim_data_export',{p_receipt_id:draft.receiptId,p_account_id:rid}),doCancel=()=>owner.rpc('rpc_cancel_data_export',{p_receipt_id:draft.receiptId});
    const first=Promise.resolve(claimFirst?doClaim():doCancel());await waitBlocked(label,1);const second=Promise.resolve(claimFirst?doCancel():doClaim());const blocked=await waitBlocked(label,2);await release();
    const [a,b]=await Promise.all([first,second]);if(claimFirst){assert.equal(a.error,null);assert.equal(a.data.kind,'CLAIMED');assert.equal(b.error?.message,'DATA_EXPORT_REQUEST_NOT_CANCELLABLE');await revoke(draft.receiptId);}else{assert.equal(a.error,null);assert.equal(a.data.status,'CANCELLED');assert.equal(b.error,null);assert.equal(b.data.kind,'NONE');}
    report.lock_interleavings.push({case:claimFirst?'CLAIM_THEN_CANCEL':'CANCEL_THEN_CLAIM',observed_waiters:blocked});
  }
  pass();

  check('GLOBAL_PREPARE_AND_CLEANUP_SKIP_BUSY_ACCOUNT_AND_PROGRESS_OTHER_OWNER');
  reviewDelivery({artifactLifetimeSeconds:2,snapshotLifetimeSeconds:1,downloadLifetimeSeconds:1});
  draft=await request(owner);const otherDraft=await request(other);
  const label='p2-global-holder-'+randomUUID(),release=await holdAccount(label);let winner;
  try{
    winner=await bounded(ok(admin.rpc('rpc_claim_data_export',{p_receipt_id:null,p_account_id:null})));
    assert.equal(winner.kind,'CLAIMED');assert.equal(winner.accountId,wid);assert.equal(winner.receiptId,otherDraft.receiptId);
    assert.equal(sql(`select status from public.data_export_requests where id=${q(draft.receiptId)}`),'REQUESTED');
    await ok(other.rpc('rpc_revoke_data_export_download',{p_receipt_id:otherDraft.receiptId}));await awaitExpired(winner.leaseExpiresAt);
    let cleanupOwner;
    const tick=await bounded(handler('worker',env.RU5_DEVICE_SERVICE_ROLE_KEY,{action:'tick'},async(u,init,response)=>{
      if(u.pathname.endsWith('/rpc_claim_data_export_cleanup')&&response.ok)cleanupOwner=(await response.clone().json()).accountId;
    }));
    assert.equal(tick.status,200);assert.deepEqual(await tick.json(),{kind:'TICK_COMPLETED'});assert.equal(cleanupOwner,wid);
    assert.equal(sql(`select deleted_at is not null from private.data_export_artifacts where id=${q(winner.attemptId)}`),'t');
  }finally{await release();}
  await ok(owner.rpc('rpc_cancel_data_export',{p_receipt_id:draft.receiptId}));
  report.global_busy_account_skipped=true;report.actual_internal_tick_handler=true;pass();

  check('OVERSIZED_OLDEST_SNAPSHOT_IS_NOT_TRUNCATED_OR_GLOBAL_STARVATION');
  reviewDelivery({artifactLifetimeSeconds:20,snapshotLifetimeSeconds:1,downloadLifetimeSeconds:3});
  const largeConversation=randomUUID();
  // Explicit disposable owned data fixture, using real unchanged row constraints.
  // There is no patched snapshot function, row-count cap, or fabricated READY.
  sql(`insert into public.ai_conversations(id,account_id,purpose) values(${q(largeConversation)},${q(rid)},'PROFILE');
    insert into public.ai_messages(account_id,conversation_id,role,body)
      select ${q(rid)},${q(largeConversation)},'USER',repeat('x',4000) from generate_series(1,2200)`);
  try{
    draft=await request(owner);const later=await request(other);
    assert.deepEqual(await claim(draft.receiptId),{kind:'NOT_READY',code:'EXPORT_SNAPSHOT_TOO_LARGE'});
    assert.equal(sql(`select count(*) from private.data_export_artifacts where receipt_id=${q(draft.receiptId)}`),'0');
    const next=await ok(admin.rpc('rpc_claim_data_export',{p_receipt_id:null,p_account_id:null}));
    assert.equal(next.kind,'CLAIMED');assert.equal(next.receiptId,later.receiptId);assert.equal(next.accountId,wid);assert.ok(next.byteLength<8388608);
    assert.equal(sql(`select export_attempt_count from public.data_export_requests where id=${q(draft.receiptId)}`),'0');
    await ok(other.rpc('rpc_revoke_data_export_download',{p_receipt_id:later.receiptId}));
    await ok(owner.rpc('rpc_cancel_data_export',{p_receipt_id:draft.receiptId}));
  }finally{sql(`delete from public.ai_messages where conversation_id=${q(largeConversation)};delete from public.ai_conversations where id=${q(largeConversation)}`);}
  report.oversized_snapshot_never_truncated=true;report.global_oversized_account_skipped=true;pass();

  check('FINAL_HISTORY_RESTORED_INERT_POLICY_AND_NO_FALSE_SCHEDULER_CLAIM');
  sql(`update private.retention_policy_sets set retired_at=clock_timestamp(),export_delivery=null where id=${q(policyId)};update private.legal_document_versions set is_active=false,retired_at=clock_timestamp() where id=${q(privacyId)}`);
  assert.equal(hashTable('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),historyBefore);
  assert.equal(hashTable('private.retention_policy_sets',`id<>${q(policyId)}`,['export_delivery']),policyRowsBefore);assert.equal(hashTable('private.legal_document_versions',`id<>${q(privacyId)}`),privacyRowsBefore);
  assert.equal(sql('select private.data_export_policy_binding() is null'),'t');
  assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"),'0');
  assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')),104);
  report.history_count=104;report.policy_fixture_restored_inert=true;report.production_scheduler_wired=false;pass();
  report.result='PASS';
}catch(error){report.result='FAIL';report.failed_check=current;report.failure=error?.code==='ERR_ASSERTION'?'ASSERTION_FAILED':/^[A-Z0-9_]{1,96}$/.test(String(error.message))?error.message:'UNEXPECTED_PROOF_ERROR';
  const location=String(error?.stack??'').match(/p2_export_delivery_proof\.mjs:(\d+):(\d+)/);
  if(location)report.failure_location={file:'supabase/proofs/legal/p2_export_delivery_proof.mjs',line:Number(location[1]),column:Number(location[2])};
  process.exitCode=1;}
finally{
  for(const child of children)if(child.exitCode===null)child.stdin.end('rollback;\n');
  for(const client of [owner,other,admin,anon])await client.auth.stopAutoRefresh();
  writeFileSync(out+'/proof-report.json',JSON.stringify(report,null,2)+'\n');console.log(report.result+' P2_EXPORT_DELIVERY');
}
