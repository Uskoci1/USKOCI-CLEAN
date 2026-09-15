// Actual loopback-only disposable Postgres/Auth/Storage proof of source131.
// Every policy row and retention number below is explicitly SYNTHETIC TEST DATA.
import {createHash} from 'node:crypto';
import {assert,randomUUID,sql,rows,q,ok,denied,anon,service,actor,make,prove,apply,pass,lockedRace,env} from './closure_runtime.mjs';
import {loadClosureWorker} from './v5_closure_edge_runtime.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const prep=a=>ok(a.client.rpc('rpc_prepare_account_closure',{p_expected_user_id:a.id,p_expected_revision:0,p_client_request_id:randomUUID()}));
const review=a=>ok(a.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:a.id}));
const startArgs=(a,r,key=randomUUID())=>({p_expected_user_id:a.id,p_request_id:r.requestId,p_expected_revision:r.revision,p_client_request_id:key,p_policy_sha256:r.policySha256});
const claim=(a,g)=>service.rpc('rpc_claim_account_closure_action_service',{p_account_id:a.id,p_generation:g});
const dispatch=(a,g,x)=>service.rpc('rpc_dispatch_account_closure_action_service',{p_account_id:a.id,p_generation:g,p_action_id:x.actionId,p_attempt_id:x.attemptId});
await prove('V5_POLICY_BOUND_ACCOUNT_CLOSURE','v5-account-closure-execution-report.json',async report=>{
 await apply(report,'20260912230039_clean_v5_policy_bound_closure.sql',130);
 report.actualStorage=true;report.policyFixture='SYNTHETIC_DISPOSABLE_NOT_LEGAL_CONTENT_OR_PRODUCTION_APPROVAL';
 const a=await actor('closure131'),b=await actor('closure131-other');
 const mirroredEmail='closure-mirror-'+randomUUID()+'@proof.invalid';
 await ok(service.auth.admin.updateUserById(a.id,{email:mirroredEmail}));
 assert.equal(sql(`select email from public.app_accounts where id=${q(a.id)}`+'::uuid'),mirroredEmail);
 await prep(a);await prep(b);
 const initial=await review(a);assert.equal(initial.ready,false);assert.equal(initial.code,'CLOSURE_POLICY_NOT_READY');
 assert.equal(sql('select count(*) from private.closure_executions_v5'),'0');
 const signatures=['public.rpc_claim_account_closure_action_service(uuid,uuid)','public.rpc_dispatch_account_closure_action_service(uuid,uuid,uuid,uuid)',
 'public.rpc_complete_account_closure_action_service(uuid,uuid,uuid,uuid,text)','public.rpc_finalize_account_closure_service(uuid,uuid)'];
 for(const signature of signatures){for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE')`),'f');assert.equal(sql(`select has_function_privilege('service_role',${q(signature)},'EXECUTE')`),'t');}
 for(const table of ['closure_dataset_catalog_v5','closure_executions_v5','closure_actions_v5','closure_start_commands_v5','closure_source_v5']){
  assert.equal(sql(`select relrowsecurity and relforcerowsecurity from pg_class where oid=${q('private.'+table)}::regclass`),'t');
  for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');}
 await denied(anon.rpc('rpc_review_account_closure_execution',{p_expected_user_id:a.id}));
 await denied(b.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:a.id}),'AUTH_CONTEXT_CHANGED');
 assert.equal(rows('select data_class from private.closure_dataset_catalog_v5').length,15);
 for(const name of ['private.ai_task_reviews','private.ai_task_review_commands','private.ai_test_accounts_v5','private.ai_test_reservations_v5','private.worker_ai_sessions','private.worker_ai_turns','private.worker_ai_reviews','private.worker_ai_saves','private.owned_media_assets'])assert.equal(sql(`select exists(select 1 from private.closure_dataset_catalog_v5 where ${q(name)}=any(relations))`),'t');
 pass(report,'DEFAULT_CLOSED_ZERO_EXECUTIONS_SERVICE_ONLY_PRIVATE_RLS_COMPLETE_126_TO_130_MAPPING');
 const activeLegal=rows('select id from private.legal_document_versions where is_active');
 const activePolicy=rows('select id,retired_at from private.retention_policy_sets where retired_at is null');
 const pid=randomUUID(),termsId=randomUUID(),privacyId=randomUUID();
 const oldBudget=sql('select reserved_microusd from private.ai_test_budget_v5 where singleton');
 try{
  sql(`update private.legal_document_versions set is_active=false where is_active;
   insert into private.legal_document_versions(id,document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values
   (${q(termsId)}::uuid,'TERMS',${q('SYNTHETIC_CLOSURE_'+termsId)},${q(digest('SYNTHETIC_TERMS_'+termsId))},'https://proof.invalid/terms',statement_timestamp()-interval '1 minute',statement_timestamp()-interval '1 minute',true),
   (${q(privacyId)}::uuid,'PRIVACY',${q('SYNTHETIC_CLOSURE_'+privacyId)},${q(digest('SYNTHETIC_PRIVACY_'+privacyId))},'https://proof.invalid/privacy',statement_timestamp()-interval '1 minute',statement_timestamp()-interval '1 minute',true);
   update private.retention_policy_sets set retired_at=greatest(clock_timestamp(),effective_at+interval '1 second') where retired_at is null;
   insert into private.retention_policy_sets(id,policy_version,counsel_reference,effective_at) values(${q(pid)}::uuid,${q('SYNTHETIC_CLOSURE_'+pid)},'DISPOSABLE TEST ONLY NO APPROVAL',statement_timestamp()-interval '1 minute');
   insert into private.retention_policy_rules(policy_id,data_class,purpose,retention_period_text,deletion_trigger,exception_rule,legal_basis_reference)
   select ${q(pid)}::uuid,code,'Synthetic disposable proof','Synthetic 86400 seconds','Synthetic closure request','Synthetic hold blocks all dispatch','Synthetic test basis only' from private.retention_data_classes where active and required;
   with binding as(select jsonb_build_object('schemaVersion',1,'adapterVersion','V5_RETAINED_SUBJECT_CLOSURE_V1','sourceSha256',(select sha256 from private.closure_source_v5),
    'privacyDocumentId',${q(privacyId)},'privacyContentSha256',${q(digest('SYNTHETIC_PRIVACY_'+privacyId))},'authAction','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED','mediaAction','DELETE_OWNED_OBJECTS',
    'datasets',(select jsonb_agg(jsonb_build_object('dataClass',data_class,'action','RETAIN_RESTRICTED','retentionSeconds',86400,'trigger','CLOSURE_REQUESTED',
      'ruleSha256',encode(extensions.digest(convert_to(to_jsonb(r)::text,'UTF8'),'sha256'),'hex')) order by data_class) from private.retention_policy_rules r where policy_id=${q(pid)}::uuid)) value)
   update private.retention_policy_sets set account_closure_execution=binding.value||jsonb_build_object('contentSha256',encode(extensions.digest(convert_to(binding.value::text,'UTF8'),'sha256'),'hex')) from binding where id=${q(pid)}::uuid;`);
  const bound=await review(a);assert.equal(bound.ready,true);assert.match(bound.policySha256,/^[a-f0-9]{64}$/);
  // Hash change cannot silently reinterpret a reviewed execution rule.
  const saved=sql(`select account_closure_execution::text from private.retention_policy_sets where id=${q(pid)}::uuid`);
  sql(`update private.retention_policy_sets set account_closure_execution=jsonb_set(account_closure_execution,'{authAction}','"HARD_DELETE"') where id=${q(pid)}::uuid`);
  assert.equal((await review(a)).ready,false);
  sql(`update private.retention_policy_sets set account_closure_execution=${q(saved)}::jsonb where id=${q(pid)}::uuid`);
  const hold=await ok(service.rpc('rpc_set_retention_hold',{p_account_id:a.id,p_conversation_id:null,p_hold_key:'CLOSURE_131_FIXTURE',p_active:true,p_expected_revision:0}));
  assert.equal((await review(a)).ready,false);
  await denied(a.client.rpc('rpc_start_account_closure_execution',startArgs(a,bound)),'CLOSURE_BLOCKED');
  await ok(service.rpc('rpc_set_retention_hold',{p_account_id:a.id,p_conversation_id:null,p_hold_key:'CLOSURE_131_FIXTURE',p_active:false,p_expected_revision:hold.revision}));
  // Actual existing Storage API stores bytes before closure. No storage.objects SQL deletion.
  const objectPath=`${a.id}/closure131-${randomUUID()}.jpg`,bytes=new Uint8Array([255,216,255,217]);
  await ok(service.storage.from('profile-media').upload(objectPath,bytes,{contentType:'image/jpeg',upsert:false}));
  const oldSession=(await ok(a.client.auth.getSession())).session;assert.ok(oldSession);
  const r=await review(a),args=startArgs(a,r),started=await Promise.all([ok(a.client.rpc('rpc_start_account_closure_execution',args)),ok(a.client.rpc('rpc_start_account_closure_execution',args))]);
  assert.deepEqual(started.map(x=>x.idempotentReplay).sort(),[false,true]);const g=started[0].generation;
  assert.equal(started[1].generation,g);assert.equal(sql(`select count(*) from private.closure_executions_v5 where account_id=${q(a.id)}::uuid`),'1');
  await denied(a.client.rpc('rpc_start_account_closure_execution',{...args,p_expected_revision:args.p_expected_revision+1}),'REQUEST_ID_REUSED');
  await denied(b.client.rpc('rpc_start_account_closure_execution',args),'AUTH_CONTEXT_CHANGED');
  const own=await ok(a.client.rpc('rpc_read_account_closure_execution',{p_expected_user_id:a.id,p_client_request_id:args.p_client_request_id}));assert.equal(own.found,true);assert.equal(own.execution.generation,g);
  assert.equal((await ok(b.client.rpc('rpc_read_account_closure_execution',{p_expected_user_id:b.id,p_client_request_id:args.p_client_request_id}))).found,false);
  await denied(a.client.rpc('rpc_get_account_closure',{p_expected_user_id:a.id}),'ACCOUNT_CLOSING');
  const noNewStorage=await a.client.storage.from('profile-media').upload(`${a.id}/after-closure.jpg`,bytes,{contentType:'image/jpeg'});assert.ok(noNewStorage.error);
  assert.ok((await service.auth.admin.updateUserById(a.id,{email:'blocked-'+randomUUID()+'@proof.invalid'})).error);
  assert.equal(sql(`select email from public.app_accounts where id=${q(a.id)}`+'::uuid'),mirroredEmail);
  await denied(claim(b,g),'CLOSURE_GENERATION_STALE');
  const x=await ok(claim(a,g));assert.equal(x.kind,'STORAGE_DELETE');assert.equal(x.objectPath,objectPath);
  await denied(dispatch(a,g,{...x,attemptId:randomUUID()}),'CLOSURE_ATTEMPT_STALE');
  await denied(service.rpc('rpc_complete_account_closure_action_service',{p_account_id:a.id,p_generation:g,p_action_id:x.actionId,p_attempt_id:x.attemptId,p_evidence:'STORAGE_OBJECT_ABSENT'}),'CLOSURE_ATTEMPT_STALE');
  const laterHold=await lockedRace(`select pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||${q(a.id)},0));update private.retention_holds set active=true,revision=revision+1 where account_id=${q(a.id)}::uuid and hold_key='CLOSURE_131_FIXTURE'`,()=>dispatch(a,g,x));
  assert.equal(laterHold.error?.message,'CLOSURE_BLOCKED');assert.equal(sql(`select state from private.closure_actions_v5 where id=${q(x.actionId)}::uuid`),'PENDING');
  sql(`update private.retention_holds set active=false,revision=revision+1 where account_id=${q(a.id)}::uuid and hold_key='CLOSURE_131_FIXTURE'`);
  pass(report,'REAL_START_SAME_KEY_RACE_OWN_READBACK_GLOBAL_API_AND_STORAGE_FENCE_HOLD_LOCK_RACE_STALE_ATTEMPT_DENIAL');

  const calls=[];let loseStorageAck=true;
  const runtime=loadClosureWorker({env:n=>({USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED:'true',SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY})[n],
   fetch:async(url,init)=>{assert.equal(new URL(url).origin,new URL(env.RU5_DEVICE_SUPABASE_URL).origin);calls.push({method:init.method,kind:new URL(url).pathname.startsWith('/storage/')?'storage':new URL(url).pathname.startsWith('/auth/')?'auth':'rpc'});
    const response=await fetch(url,init);if(loseStorageAck&&init.method==='DELETE'&&new URL(url).pathname.startsWith('/storage/')){loseStorageAck=false;void response.body?.cancel();throw new Error('SYNTHETIC_LOST_ACK_AFTER_REAL_STORAGE_DELETE');}return response;}});
  const invoke=()=>runtime.handler(new Request('http://127.0.0.1/closure',{method:'POST',headers:{authorization:`Bearer ${env.RU5_DEVICE_SERVICE_ROLE_KEY}`,'content-type':'application/json'},body:JSON.stringify({accountId:a.id,generation:g})}));
  const unknown=await invoke();assert.equal(unknown.status,409);assert.equal(sql(`select state from private.closure_actions_v5 where id=${q(x.actionId)}::uuid`),'DISPATCHED');
  assert.equal((await(await invoke()).json()).kind,'STEP_VERIFIED');assert.equal(calls.filter(c=>c.method==='DELETE'&&c.kind==='storage').length,1);
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='profile-media' and name=${q(objectPath)}`),'0');
  const missing=await service.storage.from('profile-media').download(objectPath);assert.ok(missing.error);
  assert.equal((await(await invoke()).json()).kind,'STEP_VERIFIED');assert.equal(calls.filter(c=>c.method==='DELETE'&&c.kind==='auth').length,1);
  assert.equal(sql(`select deleted_at is not null and coalesce(encrypted_password,'')='' and coalesce(raw_user_meta_data,'{}')='{}' and coalesce(raw_app_meta_data,'{}')='{}' from auth.users where id=${q(a.id)}::uuid`),'t');
  assert.equal(sql(`select count(*) from auth.sessions where user_id=${q(a.id)}::uuid`),'0');
  const closed=await(await invoke()).json();assert.equal(closed.state,'CLOSED');assert.equal(closed.authOutcome,'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED');assert.equal(closed.relationalOutcome,'RETAINED_RESTRICTED');assert.equal(closed.retainedDatasets.length,15);
  assert.deepEqual(await(await invoke()).json(),closed);
  assert.equal(sql(`select count(*) from public.app_accounts where id=${q(a.id)}::uuid`),'1');
  assert.equal(sql('select reserved_microusd from private.ai_test_budget_v5 where singleton'),oldBudget);
  assert.equal(sql(`select email from public.app_accounts where id=${q(a.id)}`+'::uuid'),mirroredEmail);
  const receiptRead=await ok(a.client.rpc('rpc_read_account_closure_execution',{p_expected_user_id:a.id,p_client_request_id:args.p_client_request_id}));assert.equal(receiptRead.execution.state,'CLOSED');
  const unexpired=await fetch(env.RU5_DEVICE_SUPABASE_URL+'/rest/v1/rpc/rpc_get_account_closure',{method:'POST',headers:{apikey:env.RU5_DEVICE_ANON_KEY,authorization:`Bearer ${oldSession.access_token}`,'content-type':'application/json'},body:JSON.stringify({p_expected_user_id:a.id})});
  assert.equal(unexpired.status,403);assert.equal((await unexpired.json()).message,'ACCOUNT_CLOSING');
  assert.ok((await make().auth.refreshSession({refresh_token:oldSession.refresh_token})).error);
  report.workerSourceHashes=runtime.sourceHashes;report.actualAuthIdentityErasedSubjectRetained=true;report.actualStorageObjectDeleted=true;
  pass(report,'REAL_STORAGE_DELETE_LOST_ACK_READ_ONLY_RECOVERY_ONE_DELETE_REAL_AUTH_SOFT_ERASURE_EMPTY_METADATA_ZERO_SESSIONS_OLD_JWT_FENCED_REFRESH_DENIED_EXACT_CLOSED_REPLAY');
 }finally{
  sql(`update private.retention_policy_sets set retired_at=greatest(clock_timestamp(),effective_at+interval '1 second') where id=${q(pid)}::uuid;
   update private.legal_document_versions set is_active=false where id in(${q(termsId)}::uuid,${q(privacyId)}::uuid)`);
  if(activePolicy.length)sql(`update private.retention_policy_sets set retired_at=null where id in(${activePolicy.map(x=>q(x.id)+'::uuid').join(',')})`);
  if(activeLegal.length)sql(`update private.legal_document_versions set is_active=true where id in(${activeLegal.map(x=>q(x.id)+'::uuid').join(',')})`);
 }
 report.productionActivation=false;report.limitations=['Synthetic policy only; real RC2 numeric retention binding remains unavailable and closed.','Relational rows retained only by explicit reviewed finite rules; no invented hard cascade.','Unsettled legacy export producer blocks closure; expiry is not quiescence.'];
 pass(report,'ORIGINAL_POLICY_POINTERS_RESTORED_NO_LIVE_ACTIVATION_NO_GLOBAL_AI_BUDGET_RESET');
});
