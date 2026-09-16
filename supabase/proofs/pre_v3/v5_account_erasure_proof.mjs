// All Auth/RPC/Storage below is real and loopback-only via closure_runtime.
// No synthetic retention/legal activation, provider call or live target.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as magick from '@imagemagick/magick-wasm';
import {sanitizeImage} from '../../functions/_shared/mediaImageSanitizer.mjs';
import {assert,randomUUID,sql,rows,q,ok,denied,anon,service,actor,make,prove,apply,pass,env,lockedRace} from './closure_runtime.mjs';
import {migrationSnapshotQuery} from './history_snapshot.mjs';
import {loadClosureWorker} from './v5_closure_edge_runtime.mjs';
import {seedContentCopies,assertContentCopiesErased,seedVerifiedExport} from './v5_erasure_content_fixtures.mjs';
import {seedBusinessCopies,assertBusinessCopiesAfterOwner,assertBusinessCopiesAfterBoth} from './v5_erasure_business_fixtures.mjs';
const file='20260913081147_clean_v5_event_bound_account_erasure.sql';
const digest=x=>createHash('sha256').update(x).digest('hex');
const snapshot=table=>sql(`select encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text,'UTF8'),'sha256'),'hex') from ${table} t`);
const accountSnapshot=id=>({account:rows(`select encode(extensions.digest(convert_to(to_jsonb(t)::text,'UTF8'),'sha256'),'hex') sha from public.app_accounts t where id=${q(id)}::uuid`),
 profiles:rows(`select id,encode(extensions.digest(convert_to(to_jsonb(t)::text,'UTF8'),'sha256'),'hex') sha from public.app_profiles t where account_id=${q(id)}::uuid order by id`)});
const globalTables=['private.retention_policy_sets','private.retention_policy_rules','private.legal_document_versions',
 'private.publication_policy_bundles','private.publication_policy_rule_refs','private.ai_test_budget_v5','private.ai_test_reservations_v5','private.ai_test_accounts_v5'];
const globals=()=>Object.fromEntries(globalTables.map(t=>[t,snapshot(t)]));
const prep=a=>ok(a.client.rpc('rpc_prepare_account_closure',{p_expected_user_id:a.id,p_expected_revision:0,p_client_request_id:randomUUID()}));
const review=a=>ok(a.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:a.id}));
const actionArgs=(a,g,x)=>({p_account_id:a.id,p_generation:g,p_action_id:x.actionId,p_attempt_id:x.attemptId});
const claim=(a,g)=>ok(service.rpc('rpc_claim_account_closure_action_service',{p_account_id:a.id,p_generation:g}));
const serviceClaims="select set_config('request.jwt.claim.role','service_role',true);select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);";
async function humanClaims(a){
 const session=(await ok(a.client.auth.getSession())).session;
 const jwt=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
 assert.equal(jwt.sub,a.id);assert.ok(jwt.session_id);
 return `select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:a.id,role:'authenticated',session_id:jwt.session_id}))},true);`;
}
const startSql=c=>`select public.rpc_start_account_closure_execution(${q(c.p_expected_user_id)}::uuid,${q(c.p_request_id)}::uuid,${c.p_expected_revision},${q(c.p_client_request_id)}::uuid,${q(c.p_policy_sha256)})`;
const privacyArgs=a=>({p_expected_user_id:a.id,p_client_request_id:randomUUID(),p_kind:'CREATE',p_case_id:null,p_expected_revision:null,
 p_payload_text:JSON.stringify({channel:'LEGAL_PRIVACY',topic:'PRIVACY_RIGHTS',title:'Disposable rights request',body:'AF22 preserved scoped evidence',desiredOutcome:null,context:null,evidence:[]})});
const supportSql=c=>`select public.rpc_support_submit_v5(${q(c.p_expected_user_id)}::uuid,${q(c.p_client_request_id)}::uuid,'CREATE',null,null,${q(c.p_payload_text)})`;
async function beginErasure(a){await prep(a);const r=await review(a);assert.equal(r.ready,true);
 const args={p_expected_user_id:a.id,p_request_id:r.requestId,p_expected_revision:r.revision,p_client_request_id:randomUUID(),p_policy_sha256:r.policySha256};
 const started=await ok(a.client.rpc('rpc_start_account_closure_execution',args));return{generation:started.generation,args};}
async function completeOrdinary(a,g,invoke){
 let next=await claim(a,g);
 for(let i=0;next.kind==='STORAGE_DELETE'&&i<8;i++){
  const r=await invoke(a,g);assert.equal(r.status,200);assert.equal((await r.json()).kind,'STEP_VERIFIED');next=await claim(a,g);
 }
 assert.equal(next.kind,'RELATIONAL_REDACT');
 if(next.state==='PENDING')await ok(service.rpc('rpc_dispatch_account_closure_action_service',actionArgs(a,g,next)));
 const total=Number(sql('select cardinality(private.closure_redaction_relations_v5())'));let finished=false;
 for(let i=0;i<total+25;i++){
  const r=await ok(service.rpc('rpc_redact_account_closure_step_service',actionArgs(a,g,next)));
  assert.ok(r.rowsChanged<=100);assert.equal(r.generation,g);assert.equal(r.accountId,a.id);
  if(r.state==='VERIFIED'){finished=true;break;}
 }
 assert.ok(finished,'BOUNDED_DISPOSABLE_ORDINARY_ERASURE_COMPLETE');return claim(a,g);
}

function assertSourceDriftClosed(){
 const drift=[
  'alter table public.needs add column disposable_erasure_unowned_copy text',
  'alter table public.needs disable trigger needs_guard_write',
  'create trigger disposable_erasure_extra_trigger before update on public.needs for each row execute function private.guard_need_write()',
  'alter function private.closure_redaction_patch_v5(text,jsonb,uuid,uuid) set search_path=public',
  "grant execute on function private.closure_redaction_patch_v5(text,jsonb,uuid,uuid) to authenticated",
  'alter table private.closure_redaction_certificate_v5 disable row level security',
  "do $drift$ declare d text;begin d:=pg_get_functiondef('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)'::regprocedure);execute replace(d,'-- Support command receipts','-- Disposable changed source. Support command receipts');end $drift$"
 ];
 for(const change of drift){
  assert.equal(sql(`begin;${change};select private.closure_erasure_binding_v5() is null;rollback;`),'t');
  assert.equal(sql('select private.closure_erasure_binding_v5() is not null'),'t');
 }
}

await prove('V5_EVENT_BOUND_ACCOUNT_ERASURE','v5-account-erasure-report.json',async report=>{
 report.coverage='ACTUAL_AUTH_STORAGE_ORDINARY_CONTENT_COPY_ERASURE';
 report.coverageBoundary='Finite canaries and witnessed races below; no legal policy certification or claim that every arbitrary historical JSON shape is erased.';
 report.remainingAuthorCoverage=[];
 const priorHistory=rows(migrationSnapshotQuery());assert.equal(priorHistory.length,145);
 const priorGlobals=globals(),priorBusiness=Object.fromEntries(['public.app_accounts','public.app_profiles','public.needs','public.agreements','public.agreement_versions'].map(t=>[t,snapshot(t)]));
 const priorSeal=sql('select sha256 from private.closure_source_v5 where singleton');
 assert.equal(sql('select private.closure_source_digest_v5()'),priorSeal);
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');
 //145 adds no relation or column; compare the entire declared144 inventory with
 // actual145 column names rather than relying on a count or fake schema fixture.
 report.predecessor145Catalog=rows(`select n.nspname||'.'||c.relname relation,
  (select count(*) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) column_count,
  (select count(*) from pg_constraint k where k.conrelid=c.oid and k.contype='f') foreign_key_count,
  (select count(*) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) trigger_count,
  c.relrowsecurity rls,c.relforcerowsecurity force_rls,
  md5(coalesce((select jsonb_agg(jsonb_build_array(a.attname,a.atttypid::regtype::text,a.attnotnull,a.attgenerated) order by a.attnum)::text from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'[]')) columns_md5
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private') and c.relkind='r' order by n.nspname,c.relname`);
 const inventory=JSON.parse(readFileSync('docs/implementation/v5-ai-first/AF22_CLOSURE_INVENTORY_144.json','utf8'));
 const actualColumns=rows(`select n.nspname||'.'||c.relname relation,array_agg(a.attname::text order by a.attname) columns
  from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
  where n.nspname in('public','private') and c.relkind='r' group by n.nspname,c.relname order by n.nspname,c.relname`);
 assert.deepEqual(actualColumns,inventory.relations.map(r=>({relation:r.relation,columns:[...r.declaredCurrentColumns].sort()})).sort((a,b)=>a.relation<b.relation?-1:1));
 await apply(report,file,145);
 assert.deepEqual(rows(migrationSnapshotQuery(file.slice(0,14))),priorHistory);
 assert.deepEqual(globals(),priorGlobals);
 for(const [table,sha] of Object.entries(priorBusiness))assert.equal(snapshot(table),sha,table);
 assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
 assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_erasure_source_v5 where singleton'),'t');
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');
 assertSourceDriftClosed();
 for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},'private.closure_redaction_certificate_v5','INSERT,UPDATE,DELETE')`),'f');
 pass(report,'ACTUAL_145_HISTORY_CATALOG_AND_SEAL_146_APPLY_PRESERVES_EXISTING_ROWS_POLICIES_AND_BUDGET');
 pass(report,'EXTRA_COLUMN_TRIGGER_DISABLED_TRIGGER_BODY_CONFIG_ACL_RLS_DRIFT_CLOSES_EVENT_BINDING_AND_ROLLBACK_RESTORES');

 const a=await actor('erasure146-clean'),peer=await actor('erasure146-peer'),canary='AF22 clean '+randomUUID();
 const identity=await ok(a.client.rpc('rpc_get_requester_profile_for_edit',{})),identityKey=randomUUID();
 const saved=await ok(a.client.rpc('rpc_save_requester_profile',{p_expected_revision:identity.revision,p_display_name:canary,p_client_request_id:identityKey}));
 assert.equal(saved.identity.displayName,canary);
 assert.equal(sql(`select receipt#>>'{identity,displayName}' from private.requester_identity_commands where account_id=${q(a.id)}::uuid and client_request_id=${q(identityKey)}::uuid`),canary);
 const peerBefore=accountSnapshot(peer.id),globalsBeforeClosure=globals();
 const copies=await seedContentCopies(a,canary),exportCopy=seedVerifiedExport(a,canary);
 report.disposableContentFixture={privileged:true,providerCalled:false,factRows:copies.factCount,exportPolicyActivated:false};
 await ok(service.storage.from('data-export-artifacts').upload(exportCopy.path,Buffer.from(exportCopy.text),{contentType:'application/json',upsert:false}));
 // Valid1x1 PNG through actual Storage API. No asset/evidence linkage exists;
 // this is deliberately an ordinary owned object, not a protected photograph.
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
 const objectPath=`${a.id}/erasure146-${randomUUID()}.png`;
 await ok(service.storage.from('profile-media').upload(objectPath,bytes,{contentType:'image/png',upsert:false}));
 const downloaded=await ok(service.storage.from('profile-media').download(objectPath));assert.equal(digest(Buffer.from(await downloaded.arrayBuffer())),digest(bytes));
 const oldSession=(await ok(a.client.auth.getSession())).session;assert.ok(oldSession);
 const originalAuthEmail=oldSession.user.email;assert.ok(originalAuthEmail);
 const originalAuthPhone=sql(`select coalesce(phone,'') from auth.users where id=${q(a.id)}::uuid`);
 await prep(a);const ready=await review(a);
 assert.equal(ready.ready,true);assert.equal(ready.adapterVersion,'OWNER_AF_D22_EVENT_ERASURE_V1');assert.deepEqual(ready.exceptions,[]);
 assert.equal(ready.retainedDatasets,null);assert.equal(ready.authAction,'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED');
 assert.equal(ready.mediaAction,'DELETE_UNPROTECTED_OWNED_OBJECTS');assert.equal(ready.relationalAction,'ERASE_ORDINARY_PERSONAL_CONTENT');
 const signature='public.rpc_redact_account_closure_step_service(uuid,uuid,uuid,uuid)';
 for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE')`),'f');
 assert.equal(sql(`select has_function_privilege('service_role',${q(signature)},'EXECUTE')`),'t');
 await denied(peer.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:a.id}),'AUTH_CONTEXT_CHANGED');
 const args={p_expected_user_id:a.id,p_request_id:ready.requestId,p_expected_revision:ready.revision,p_client_request_id:randomUUID(),p_policy_sha256:ready.policySha256};
 const started=await ok(a.client.rpc('rpc_start_account_closure_execution',args)),g=started.generation;
 assert.deepEqual(Object.keys(started).sort(),['accountId','requestId','generation','state','clientRequestId','policySha256','idempotentReplay','authoritative'].sort());
 assert.equal(started.state,'EXECUTING');assert.equal(started.idempotentReplay,false);
 assert.deepEqual(await ok(a.client.rpc('rpc_start_account_closure_execution',args)),{...started,idempotentReplay:true});
 await denied(a.client.rpc('rpc_start_account_closure_execution',{...args,p_expected_revision:args.p_expected_revision+1}),'REQUEST_ID_REUSED');
 assert.equal(sql(`select count(*) from private.closure_executions_v5 where account_id=${q(a.id)}::uuid`),'1');
 const ownRead=()=>ok(a.client.rpc('rpc_read_account_closure_execution',{p_expected_user_id:a.id,p_client_request_id:args.p_client_request_id}));
 const begun=await ownRead();assert.equal(begun.execution.generation,g);assert.equal(begun.execution.ordinaryContentErased,false);
 // A service REST/GUC caller cannot mint the private exact-row certificate.
 assert.throws(()=>sql(`begin;${serviceClaims}set local role service_role;select set_config('uskoci.account_erasure','true',true);
  update public.app_profiles set display_name='FORGED_ERASURE' where account_id=${q(a.id)};commit;`));
 assert.equal(sql(`select count(*) from public.app_profiles where account_id=${q(a.id)} and display_name='FORGED_ERASURE'`),'0');
 pass(report,'REAL_AUTH_CANONICAL_PROFILE_AND_COMMAND_COPY_REAL_STORAGE_OWNER_EVENT_BINDING_EXACT_START_REPLAY');

 const calls=[];let loseStorageAck=true;
 const runtime=loadClosureWorker({env:name=>({USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED:'true',SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,
  SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY})[name],
  fetch:async(url,init)=>{
   const parsed=new URL(url);assert.equal(parsed.origin,new URL(env.RU5_DEVICE_SUPABASE_URL).origin);
   const kind=parsed.pathname.startsWith('/storage/')?'storage':parsed.pathname.startsWith('/auth/')?'auth':'rpc';
   calls.push({method:init.method,kind});const response=await fetch(url,init);
   if(loseStorageAck&&init.method==='DELETE'&&kind==='storage'){loseStorageAck=false;void response.body?.cancel();throw new Error('SYNTHETIC_LOST_ACK_AFTER_REAL_STORAGE_DELETE');}
   return response;
  }});
 const invoke=(who=a,generation=g)=>runtime.handler(new Request('http://127.0.0.1/closure',{method:'POST',headers:{authorization:`Bearer ${env.RU5_DEVICE_SERVICE_ROLE_KEY}`,'content-type':'application/json'},body:JSON.stringify({accountId:who.id,generation})}));
 const storage=await claim(a,g);assert.equal(storage.kind,'STORAGE_DELETE');assert.ok([objectPath,exportCopy.path].includes(storage.objectPath));
 assert.equal((await invoke()).status,409);
 assert.equal(sql(`select state from private.closure_actions_v5 where id=${q(storage.actionId)}::uuid`),'DISPATCHED');
 const storageRecovered=await invoke();assert.equal(storageRecovered.status,200);assert.equal((await storageRecovered.json()).kind,'STEP_VERIFIED');
 assert.equal(calls.filter(x=>x.kind==='storage'&&x.method==='DELETE').length,1);
 const secondStorage=await claim(a,g);assert.equal(secondStorage.kind,'STORAGE_DELETE');assert.notEqual(secondStorage.objectPath,storage.objectPath);
 assert.ok([objectPath,exportCopy.path].includes(secondStorage.objectPath));
 const secondDeleted=await invoke();assert.equal(secondDeleted.status,200);assert.equal((await secondDeleted.json()).kind,'STEP_VERIFIED');
 assert.equal(calls.filter(x=>x.kind==='storage'&&x.method==='DELETE').length,2);
 assert.equal(sql(`select count(*) from storage.objects where bucket_id='profile-media' and name=${q(objectPath)}`),'0');
 assert.equal(sql(`select count(*) from storage.objects where bucket_id='data-export-artifacts' and name=${q(exportCopy.path)}`),'0');
 assert.ok((await service.storage.from('profile-media').download(objectPath)).error);
 assert.equal(calls.filter(x=>x.kind==='auth'&&x.method==='DELETE').length,0);
 pass(report,'ACTUAL_STORAGE_TWO_OBJECTS_LOST_ACK_RECONCILIATION_ONE_DELETE_PER_OBJECT_NO_AUTH_BEFORE_RELATIONAL_STAGE');

 const relational=await claim(a,g);assert.equal(relational.kind,'RELATIONAL_REDACT');assert.equal(relational.bucket,null);assert.equal(relational.objectPath,null);
 await denied(anon.rpc('rpc_redact_account_closure_step_service',actionArgs(a,g,relational)));
 const dispatched=await ok(service.rpc('rpc_dispatch_account_closure_action_service',actionArgs(a,g,relational)));assert.equal(dispatched.admitted,true);
 const total=Number(sql('select cardinality(private.closure_redaction_relations_v5())'));let previous=0,finished=false,rowsChanged=0;
 // One empty relation still needs positive enumeration. This bound is only for
 // this small clean fixture; no time-based or partial-progress success exists.
 for(let step=0;step<total+20;step++){
  const result=await ok(service.rpc('rpc_redact_account_closure_step_service',actionArgs(a,g,relational)));
  assert.deepEqual(Object.keys(result).sort(),['accountId','generation','actionId','attemptId','kind','state','rowsChanged','completedSteps','totalSteps','authoritative'].sort());
  assert.equal(result.accountId,a.id);assert.equal(result.generation,g);assert.equal(result.actionId,relational.actionId);assert.equal(result.attemptId,relational.attemptId);
  assert.equal(result.kind,'RELATIONAL_REDACT');assert.equal(result.authoritative,true);assert.equal(result.totalSteps,total);
  assert.ok(result.rowsChanged>=0&&result.rowsChanged<=100);assert.ok(result.completedSteps>=previous);previous=result.completedSteps;rowsChanged+=result.rowsChanged;
  assert.equal(sql(`select deleted_at is null from auth.users where id=${q(a.id)}::uuid`),'t');
  if(result.state==='VERIFIED'){assert.equal(result.completedSteps,total);finished=true;break;}
  assert.equal(result.state,'DISPATCHED');
 }
 assert.equal(finished,true);assert.ok(rowsChanged>=3);
 assert.equal(sql(`select count(*) from private.closure_redaction_certificate_v5`),'0');
 assert.equal(sql(`select count(*) from private.closure_redaction_steps_v5 where generation=${q(g)}::uuid and state<>'VERIFIED'`),'0');
 assert.deepEqual(rows(`select email,phone,full_name,city from public.app_accounts where id=${q(a.id)}::uuid`),[{email:'',phone:'',full_name:'',city:''}]);
 assert.equal(sql(`select bool_and(display_name='' and city='' and headline='' and bio='' and avatar_path is null and profile_status='CLOSED') from public.app_profiles where account_id=${q(a.id)}::uuid`),'t');
 assert.deepEqual(rows(`select receipt from private.requester_identity_commands where account_id=${q(a.id)}::uuid and client_request_id=${q(identityKey)}::uuid`),[{receipt:{erasedBy:'AF-D22'}}]);
 assertContentCopiesErased(a,copies);
 assert.equal(sql(`select count(*) from private.data_export_artifacts where id=${q(exportCopy.assetId)}`),'0');
 assert.equal(sql(`select active_export_attempt_id is null and export_revoked_at is not null from public.data_export_requests where id=${q(exportCopy.requestId)}`),'t');
 assert.deepEqual(accountSnapshot(peer.id),peerBefore);assert.deepEqual(globals(),globalsBeforeClosure);
 const progress=await ownRead();assert.equal(progress.execution.ordinaryContentErased,true);assert.deepEqual(progress.execution.exceptions,[]);
 pass(report,'RELATIONAL_205_SELF_FK_CHAIN_GENERATED_GEOGRAPHY_REASON_REVIEW_COMMAND_WORKER_EXPORT_COPIES_ERASED_PEER_UNCHANGED');

 const auth=await invoke();assert.equal(auth.status,200);assert.equal((await auth.json()).kind,'STEP_VERIFIED');
 assert.equal(calls.filter(x=>x.kind==='auth'&&x.method==='DELETE').length,1);
 // GoTrue soft deletion (admin DELETE with should_soft_delete) does not blank the
 // contact columns: email and phone become one-way tokens derived from the user id
 // (SoftDeleteUser/obfuscateValue, phone truncated to15 characters), so even an
 // originally empty phone is stored as a token. The erasure contract proven here is
 // that no original contact value survives: the phone is empty or a token that
 // differs from the original and is not a phone number.
 const authState=rows(`select deleted_at is not null deleted,coalesce(encrypted_password,'')='' password_empty,
  coalesce(raw_user_meta_data,'{}'::jsonb)='{}'::jsonb user_meta_empty,coalesce(raw_app_meta_data,'{}'::jsonb)='{}'::jsonb app_meta_empty,
  strpos(coalesce(email,''),${q(originalAuthEmail)})=0 email_obfuscated,
  coalesce(phone,'')='' or (phone<>${q(originalAuthPhone)} and phone !~ '^\+?[0-9]{5,}$') phone_erased,coalesce(phone,'')<>'' phone_token
  from auth.users where id=${q(a.id)}::uuid`)[0];
 report.authSoftErasure={deleted:authState?.deleted===true,passwordEmpty:authState?.password_empty===true,userMetaEmpty:authState?.user_meta_empty===true,
  appMetaEmpty:authState?.app_meta_empty===true,emailObfuscated:authState?.email_obfuscated===true,phoneErased:authState?.phone_erased===true,
  phoneObfuscationToken:authState?.phone_token===true,originalPhoneEmpty:originalAuthPhone===''};
 assert.equal(authState?.deleted,true,'AUTH_SOFT_DELETE_TIMESTAMP_MISSING');
 assert.equal(authState?.password_empty,true,'AUTH_SOFT_DELETE_PASSWORD_NOT_CLEARED');
 assert.equal(authState?.user_meta_empty,true,'AUTH_SOFT_DELETE_USER_METADATA_NOT_CLEARED');
 assert.equal(authState?.app_meta_empty,true,'AUTH_SOFT_DELETE_APP_METADATA_NOT_CLEARED');
 assert.equal(authState?.email_obfuscated,true,'AUTH_SOFT_DELETE_EMAIL_NOT_OBFUSCATED');
 assert.equal(authState?.phone_erased,true,'AUTH_SOFT_DELETE_PHONE_NOT_ERASED');
 assert.equal(sql(`select count(*) from auth.identities where user_id=${q(a.id)}::uuid`),'0','AUTH_SOFT_DELETE_IDENTITIES_REMAIN');
 assert.equal(sql(`select count(*) from auth.sessions where user_id=${q(a.id)}::uuid`),'0','AUTH_SOFT_DELETE_SESSIONS_REMAIN');
 const response=await invoke();assert.equal(response.status,200);const closed=await response.json();
 assert.equal(closed.state,'CLOSED');assert.equal(closed.relationalOutcome,'ORDINARY_PERSONAL_CONTENT_ERASED');assert.equal(closed.adapterVersion,'OWNER_AF_D22_EVENT_ERASURE_V1');
 assert.equal(closed.pseudonymousAuditRetained,true);assert.deepEqual(closed.retainedDatasets,[]);assert.deepEqual(closed.exceptions,[]);
 assert.deepEqual(await(await invoke()).json(),closed);assert.deepEqual((await ownRead()).execution,closed);
 assert.deepEqual(await ok(a.client.rpc('rpc_start_account_closure_execution',args)),{...started,idempotentReplay:true});
 assert.equal(sql(`select count(*) from public.app_accounts where id=${q(a.id)}::uuid`),'1');assert.deepEqual(accountSnapshot(peer.id),peerBefore);assert.deepEqual(globals(),globalsBeforeClosure);
 const oldJwt=await fetch(env.RU5_DEVICE_SUPABASE_URL+'/rest/v1/rpc/rpc_get_account_closure',{method:'POST',headers:{apikey:env.RU5_DEVICE_ANON_KEY,authorization:`Bearer ${oldSession.access_token}`,'content-type':'application/json'},body:JSON.stringify({p_expected_user_id:a.id})});
 assert.equal(oldJwt.status,403);const deniedBody=await oldJwt.json();assert.equal(deniedBody.code,'42501');assert.equal(deniedBody.message,'ACCOUNT_CLOSING');
 assert.ok((await make().auth.refreshSession({refresh_token:oldSession.refresh_token})).error);
 report.workerSourceHashes=runtime.sourceHashes;report.actualStorage=true;report.actualStorageObjectDeleted=true;
 report.actualAuthIdentityErasedSubjectRetained=true;report.relationalCleanFixtureVerified=true;report.providerCalled=false;
 pass(report,'ACTUAL_AUTH_SOFT_ERASURE_ZERO_SESSIONS_OLD_JWT_403_REFRESH_DENIED_EXACT_NEW_CLOSED_REPLAY');

 const hardHold=await actor('erasure146-account-hold');
 await ok(service.rpc('rpc_set_retention_hold',{p_account_id:hardHold.id,p_conversation_id:null,p_hold_key:'DISPOSABLE146_'+randomUUID(),p_active:true,p_expected_revision:0}));
 await prep(hardHold);const hardReview=await review(hardHold);assert.equal(hardReview.ready,false);assert.ok(hardReview.blockers.includes('RETENTION_HOLD'));
 assert.equal(sql(`select count(*) from private.closure_executions_v5 where account_id=${q(hardHold.id)}`),'0');
 const pendingOwner=await actor('erasure146-pending-ai'),pendingCid=await ok(pendingOwner.client.rpc('rpc_ai_open_need_conversation_v2')),pendingKey=randomUUID();
 const pendingArgs={p_account_id:pendingOwner.id,p_conversation_id:pendingCid,p_client_request_id:pendingKey};
 const pendingTurn=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{...pendingArgs,p_user_message:'Disposable pending producer'}));assert.ok(pendingTurn.claim);
 assert.equal(await ok(service.rpc('rpc_ai_dispatch_need_turn_v2_service',{...pendingArgs,p_attempt_id:pendingTurn.claim.attemptId})),true);
 await prep(pendingOwner);const pendingReview=await review(pendingOwner);assert.equal(pendingReview.ready,false);assert.ok(pendingReview.blockers.includes('PENDING_WORKFLOW'));
 assert.equal(sql(`select count(*) from private.closure_executions_v5 where account_id=${q(pendingOwner.id)}`),'0');
 pass(report,'ACCOUNT_WIDE_HOLD_AND_UNKNOWN_DISPATCHED_AI_PRODUCER_KEEP_ORIGINAL_HARD_BLOCKERS');

 const held=await actor('erasure146-held'),holdCanary='HELD_'+randomUUID();
 const heldCopies=await seedContentCopies(held,holdCanary),holdKey='DISPOSABLE146_'+randomUUID();
 await ok(service.rpc('rpc_set_retention_hold',{p_account_id:held.id,p_conversation_id:heldCopies.cid,p_hold_key:holdKey,p_active:true,p_expected_revision:0}));
 const hb=await beginErasure(held),rights=privacyArgs(held);
 // Real rights intake stays available during partial execution; its selected
 // evidence is not silently mistaken for an ordinary completed erasure.
 const rightReceipt=await ok(held.client.rpc('rpc_support_submit_v5',rights));assert.equal(rightReceipt.state,'COMMITTED');
 const hnext=await completeOrdinary(held,hb.generation,invoke);assert.equal(hnext.kind,'EXCEPTIONS_PENDING');
 assert.ok(hnext.progress.exceptions.includes('SCOPED_EVIDENCE_REVIEW_REQUIRED'));assert.equal(hnext.progress.ordinaryContentErased,true);
 assert.equal(sql(`select count(*) from public.ai_structured_facts where conversation_id=${q(heldCopies.cid)}`),String(heldCopies.factCount));
 assert.equal(sql(`select envelope->>'privateCopy' from private.ai_task_reviews where id=${q(heldCopies.reviewIds[0])}`),holdCanary);
 assert.equal(sql(`select published->>'privateCopy' from private.ai_task_review_commands where review_id=${q(heldCopies.reviewIds[2])}`),holdCanary);
 assert.equal(sql(`select bool_and(display_name='') from public.app_profiles where account_id=${q(held.id)}`),'t');
 assert.equal(sql(`select count(*) from public.need_sensitive where need_id=${q(heldCopies.needId)}`),'0');
 assert.equal(sql(`select count(*) from private.support_events_v5 where case_id=${q(rightReceipt.caseId)} and body='AF22 preserved scoped evidence'`),'1');
 assert.equal(sql(`select deleted_at is null from auth.users where id=${q(held.id)}`),'t');
 await denied(service.rpc('rpc_finalize_account_closure_service',{p_account_id:held.id,p_generation:hb.generation}));
 pass(report,'EXACT_CONVERSATION_HOLD_PRESERVES_LINKED_REVIEW_GRAPH_RIGHTS_EXIT_REMAINS_ORDINARY_OTHER_COPIES_ERASED_AUTH_BLOCKED');

 const raceOwner=await actor('erasure146-races'),raceIdentity=await ok(raceOwner.client.rpc('rpc_get_requester_profile_for_edit'));
 await prep(raceOwner);const raceReview=await review(raceOwner),rc={p_expected_user_id:raceOwner.id,p_request_id:raceReview.requestId,p_expected_revision:raceReview.revision,p_client_request_id:randomUUID(),p_policy_sha256:raceReview.policySha256};
 await denied(lockedRace(await humanClaims(raceOwner)+startSql(rc),()=>raceOwner.client.rpc('rpc_save_requester_profile',{
  p_expected_revision:raceIdentity.revision,p_display_name:'Late source narrative',p_client_request_id:randomUUID()})),'ACCOUNT_CLOSING');
 const raceGeneration=sql(`select generation from private.closure_executions_v5 where account_id=${q(raceOwner.id)}`);
 const authCandidate=await completeOrdinary(raceOwner,raceGeneration,invoke);assert.equal(authCandidate.kind,'AUTH_IDENTITY_ERASE');
 const supportFirst=privacyArgs(raceOwner);
 await denied(lockedRace(await humanClaims(raceOwner)+supportSql(supportFirst),()=>service.rpc('rpc_dispatch_account_closure_action_service',actionArgs(raceOwner,raceGeneration,authCandidate))),'CLOSURE_RELATIONAL_NOT_CLEAN');
 assert.equal(sql(`select state from private.closure_actions_v5 where id=${q(authCandidate.actionId)}`),'PENDING');
 assert.equal((await claim(raceOwner,raceGeneration)).kind,'EXCEPTIONS_PENDING');

 const dispatchOwner=await actor('erasure146-dispatch'),db=await beginErasure(dispatchOwner),dispatchAction=await completeOrdinary(dispatchOwner,db.generation,invoke);
 const dispatchStatement=serviceClaims+`select public.rpc_dispatch_account_closure_action_service(${q(dispatchOwner.id)}::uuid,${q(db.generation)}::uuid,${q(dispatchAction.actionId)}::uuid,${q(dispatchAction.attemptId)}::uuid)`;
 await denied(lockedRace(dispatchStatement,()=>dispatchOwner.client.rpc('rpc_support_submit_v5',privacyArgs(dispatchOwner))),'ACCOUNT_CLOSING');
 // Intent only: no Auth HTTP call was made for this deliberately unknown
 // producer fixture. It is not claimed as a completed closure.
 assert.equal(sql(`select deleted_at is null from auth.users where id=${q(dispatchOwner.id)}`),'t');
 assert.equal(sql(`select count(*) from private.support_cases_v5 where account_id=${q(dispatchOwner.id)}`),'0');
 pass(report,'OBSERVED_CLOSURE_PROFILE_WRITE_AND_SUPPORT_CREATE_AUTH_DISPATCH_BOTH_ORDERS_NO_LATE_NARRATIVE');

 const ba=await actor('erasure146-terms-a'),bb=await actor('erasure146-terms-b');
 const business=await seedBusinessCopies(ba,bb,'BUSINESS146_'+randomUUID());
 const heldCid=await ok(ba.client.rpc('rpc_ai_open_need_conversation_v2'));
 sql(`insert into public.ai_messages(account_id,conversation_id,role,body,safety) values(${q(ba.id)},${q(heldCid)},'USER','BUSINESS_SCOPED_HOLD','ALLOW')`);
 await ok(service.rpc('rpc_set_retention_hold',{p_account_id:ba.id,p_conversation_id:heldCid,p_hold_key:'DISPOSABLE146_'+randomUUID(),p_active:true,p_expected_revision:0}));
 // An ordinary unattached photograph from this actual terminal Agreement is a
 // labelled historical READY seed. Its bytes are genuinely decoded/reencoded.
 const require=createRequire(import.meta.url);await magick.initializeImageMagick(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm')));
 const photo=sanitizeImage(bytes,'image/png',magick),photoId=randomUUID(),photoHash=digest(photo.bytes),photoPath=`${ba.id}/agreement-v5/${photoId}/${photoHash}.jpg`;
 sql(`insert into private.agreement_photo_uploads_v5(id,account_id,agreement_id,agreement_version,client_request_id,state,input_sha256,input_bytes,input_type,
  admitted_at,sanitized_sha256,storage_path,width,height,byte_size,dispatch_state,dispatch_outcome)
  values(${q(photoId)},${q(ba.id)},${q(business.agreementId)},${business.agreementVersion},${q(randomUUID())},'READY',${q(digest(bytes))},${bytes.length},'image/png',
   clock_timestamp(),${q(photoHash)},${q(photoPath)},${photo.width},${photo.height},${photo.bytes.length},'SETTLED','STORED');`);
 await ok(service.storage.from('profile-media').upload(photoPath,photo.bytes,{contentType:'image/jpeg',upsert:false}));
 const actualPhoto=await ok(service.storage.from('profile-media').download(photoPath));assert.equal(digest(Buffer.from(await actualPhoto.arrayBuffer())),photoHash);
 assert.ok((await service.storage.from('profile-media').remove([photoPath])).error,'OPEN_ACCOUNT_PRIVATE_PHOTO_DELETE_MUST_BE_DENIED');
 assert.equal(sql(`select private.closure_erasure_media_protected_v5(${q(ba.id)},${q(photoPath)})`),'f');
 const beforePhotoDeletes=calls.filter(x=>x.kind==='storage'&&x.method==='DELETE').length;
 const ca=await beginErasure(ba),pa=await completeOrdinary(ba,ca.generation,invoke);assert.equal(pa.kind,'EXCEPTIONS_PENDING');
 assertBusinessCopiesAfterOwner(ba,bb,business);
 assert.equal(calls.filter(x=>x.kind==='storage'&&x.method==='DELETE').length,beforePhotoDeletes+1);
 assert.equal(sql(`select count(*) from storage.objects where name=${q(photoPath)}`),'0');
 assert.equal(sql(`select count(*) from private.agreement_photo_uploads_v5 where id=${q(photoId)}`),'0');
 assert.equal(sql(`select body from public.ai_messages where conversation_id=${q(heldCid)}`),'BUSINESS_SCOPED_HOLD');
 const cb=await beginErasure(bb),pb=await completeOrdinary(bb,cb.generation,invoke);assert.equal(pb.kind,'AUTH_IDENTITY_ERASE');
 assertBusinessCopiesAfterBoth(ba,bb,business);
 const aAgain=await claim(ba,ca.generation);assert.equal(aAgain.kind,'EXCEPTIONS_PENDING');
 assert.ok(!aAgain.progress.exceptions.includes('SHARED_DECISION_REVIEW_REQUIRED'));
 pass(report,'ACTUAL_UNRELATED_SCOPED_AI_HOLD_DOES_NOT_BLOCK_ORDINARY_PHOTO_STORAGE_DELETE_SHARED_TERMS_AND_QA_CONVERGE');

 const op=await actor('erasure146-operator-evidence'),caseAuthor=await actor('erasure146-case-author');
 // Explicit immutable evidence fixtures: one real case, with an own-authored
 // operator reply. No operator grant is activated or metadata privilege inferred.
 const ownCase=await ok(caseAuthor.client.rpc('rpc_support_submit_v5',privacyArgs(caseAuthor)));
 sql(`insert into private.support_events_v5(case_id,sequence,actor_account_id,author_role,kind,body)
  values(${q(ownCase.caseId)},2,${q(op.id)},'OPERATOR','OPERATOR_REPLY','OPERATOR_OWN_NARRATIVE146')`);
 assert.deepEqual(JSON.parse(sql(`select to_jsonb(private.closure_erasure_exceptions_v5(${q(op.id)}))`)),['SCOPED_EVIDENCE_REVIEW_REQUIRED']);
 const oe=await beginErasure(op),onext=await completeOrdinary(op,oe.generation,invoke);assert.equal(onext.kind,'EXCEPTIONS_PENDING');
 assert.equal(sql(`select body from private.support_events_v5 where actor_account_id=${q(op.id)}`),'OPERATOR_OWN_NARRATIVE146');
 assert.equal(sql(`select deleted_at is null from auth.users where id=${q(op.id)}`),'t');
 // Foreign case TASK snapshot ownership is resolved through the actual source
 // author, not the case owner, and remains explicit after source redaction.
 const copied=await actor('erasure146-copy-source'),copiedData=await seedContentCopies(copied,'COPY_SOURCE146_'+randomUUID());
 const eventId=ownCase.receipt.eventId,evidenceSnapshot=JSON.stringify({kind:'TASK',id:copiedData.needId,revision:1,content:{title:'COPIED_PRIVATE146'}});
 sql(`insert into private.support_evidence_v5(case_id,event_id,submitted_by_account_id,source_kind,source_id,source_revision,snapshot,snapshot_sha256)
  values(${q(ownCase.caseId)},${q(eventId)},${q(caseAuthor.id)},'TASK',${q(copiedData.needId)},1,${q(evidenceSnapshot)}::jsonb,${q(digest(evidenceSnapshot))})`);
 assert.deepEqual(JSON.parse(sql(`select to_jsonb(private.closure_erasure_exceptions_v5(${q(copied.id)}))`)),['SCOPED_EVIDENCE_REVIEW_REQUIRED']);
 await prep(copied);const cr=await review(copied),cc={p_expected_user_id:copied.id,p_request_id:cr.requestId,p_expected_revision:cr.revision,p_client_request_id:randomUUID(),p_policy_sha256:cr.policySha256};
 const lateCopy=privacyArgs(copied);lateCopy.p_payload_text=JSON.stringify({...JSON.parse(lateCopy.p_payload_text),context:{kind:'TASK',id:copiedData.needId,revision:1}});
 await denied(lockedRace(await humanClaims(copied)+startSql(cc),()=>copied.client.rpc('rpc_support_submit_v5',lateCopy)),'ACCOUNT_CLOSING');
 const ce={generation:sql(`select generation from private.closure_executions_v5 where account_id=${q(copied.id)}`)};
 const cnext=await completeOrdinary(copied,ce.generation,invoke);assert.equal(cnext.kind,'EXCEPTIONS_PENDING');
 assertContentCopiesErased(copied,copiedData);
 assert.equal(sql(`select snapshot#>>'{content,title}' from private.support_evidence_v5 where source_id=${q(copiedData.needId)}`),'COPIED_PRIVATE146');
 assert.equal(sql(`select deleted_at is null from auth.users where id=${q(copied.id)}`),'t');
 const firstSource=await actor('erasure146-source-first'),firstNeed=randomUUID(),firstProfile=rows(`select id from public.app_profiles where account_id=${q(firstSource.id)} and kind='REQUESTER'`)[0].id;
 sql(`insert into public.needs(id,requester_account_id,requester_profile_id,title,description,category,mode) values(${q(firstNeed)},${q(firstSource.id)},${q(firstProfile)},'BEFORE_CLOSURE_SNAPSHOT146','Owned ordinary content','PROOF','OFFERS')`);
 await prep(firstSource);const fr=await review(firstSource),fc={p_expected_user_id:firstSource.id,p_request_id:fr.requestId,p_expected_revision:fr.revision,p_client_request_id:randomUUID(),p_policy_sha256:fr.policySha256};
 const firstCopy=privacyArgs(firstSource);firstCopy.p_payload_text=JSON.stringify({...JSON.parse(firstCopy.p_payload_text),context:{kind:'TASK',id:firstNeed,revision:1}});
 const firstStarted=await ok(lockedRace(await humanClaims(firstSource)+supportSql(firstCopy),()=>firstSource.client.rpc('rpc_start_account_closure_execution',fc)));
 assert.equal(firstStarted.state,'EXECUTING');assert.equal(sql(`select context#>>'{content,title}' from private.support_cases_v5 where account_id=${q(firstSource.id)}`),'BEFORE_CLOSURE_SNAPSHOT146');
 assert.ok(JSON.parse(sql(`select to_jsonb(private.closure_erasure_exceptions_v5(${q(firstSource.id)}))`)).includes('SCOPED_EVIDENCE_REVIEW_REQUIRED'));
 assert.deepEqual(globals(),globalsBeforeClosure);
 assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');
 pass(report,'OWN_OPERATOR_NARRATIVE_AND_OWN_SOURCE_IN_FOREIGN_CASE_ARE_SCOPED_EXCEPTIONS_NOT_FALSE_CLOSED');
 pass(report,'OBSERVED_SOURCE_SNAPSHOT_CAPTURE_CLOSURE_BOTH_ORDERS_PRESERVES_PRIOR_EVIDENCE_REJECTS_LATE_COPY');
});
