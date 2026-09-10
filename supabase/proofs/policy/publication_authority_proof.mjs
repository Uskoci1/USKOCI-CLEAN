// Actual Auth/PostgREST/SQL authority proof on the existing loopback disposable.
// Synthetic policy is explicitly reviewed ONLY here. No external provider,
// direct decision INSERT, fake published status, or SQL location fixture.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {readD0140aPredecessorPlan} from './d0140a_bundle_registration_predecessor.mjs';
import {publicationBoundary,publicationForward} from './publication_source_boundary.mjs';
import {locationCases,syntheticNonlocationFacts} from './publication_fixtures.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
assert.equal(env.W05_DISPOSABLE_PROOF,'1','EXPLICIT_DISPOSABLE_MODE_REQUIRED');
const boundary=publicationBoundary(readD0140aPredecessorPlan());
const out=(env.D0140A_ARTIFACT_DIR||'artifacts/d0140a-bundle-registration')+'/w05';
mkdirSync(out,{recursive:true});
const report={unit:'W05_PUBLICATION_AUTHORITY',source_sha:env.GITHUB_SHA??null,run_id:env.GITHUB_RUN_ID??null,
  result:'RUNNING',checks:[],input_sha256:{},source_inventory:boundary.fullPlan.source_inventory,
  live_access:false,live_promotion:false,provider_called:false,legal_content_real:false,
  policy_activated_live:false,policy_fixture:'EXPLICIT_SYNTHETIC_DISPOSABLE_REVIEW_ONLY',
  mocked_rpc_responses:false,location_fixture_sql:false,published_status_fixture_sql:false,
  decision_insert_fixture_sql:false,synthetic_nonlocation_ai_facts:true,device_ui_proven:false};
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
const digest=(algorithm,value)=>createHash(algorithm).update(value).digest('hex');
let stage='PREFLIGHT';
const begin=name=>{stage=name;console.log('START_W05 '+name);};
const pass=()=>{delete report.last_sql_error;delete report.last_rpc_error;report.checks.push({name:stage,result:'PASS'});console.log('PASS_W05 '+stage);};
function sql(query) {
  try{return execFileSync('psql',[db,'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],
    {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
  catch(error){const code=String(error.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNKNOWN';
    report.last_sql_error={sqlstate:code,query_sha256:digest('sha256',query)};
    throw new Error('LOCAL_SQL_'+code);}
}
function sqlState(query){try{sql(query);return 'OK';}catch(error){return error.message.replace('LOCAL_SQL_','');}}
const tableHash=(table,where='true')=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x where ${where}`);
const ok=async(promise,operation='RPC_OR_SDK')=>{
  const invocation=new Error();
  const caller=Array.from(String(invocation.stack).matchAll(/publication_authority_proof\.mjs:(\d+):/g))[1];
  const r=await promise;
  if(r.error){report.last_rpc_error={operation,caller_line:caller?Number(caller[1]):null,code:r.error.code,
    message:/^[A-Z0-9_]+$/.test(r.error.message)?r.error.message:'REDACTED'};throw new Error('LOCAL_RPC_FAILED');}
  return r.data;
};
const reject=async(promise,code,message)=>{const r=await promise;assert.ok(r.error,'EXPECTED_RPC_REJECTION');if(code)assert.equal(r.error.code,code);if(message)assert.equal(r.error.message,message);return r.error;};
const localFetch=(input,init)=>{
  const target=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  assert.equal(target.origin,new URL(url).origin,'NONLOCAL_HTTP_REFUSED');
  assert.match(target.pathname,/^\/(auth|rest)\/v1(?:\/|$)/);
  return fetch(input,{...init,redirect:'error'});
};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:localFetch}};
const owner=createClient(url,env.RU5_DEVICE_ANON_KEY,options),other=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options),service=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const ownerId=env.RU5_DEVICE_REQUESTER_USER_ID;
assert.match(String(ownerId),/^[0-9a-f-]{36}$/i);
const children=[];
let ownerProfile,bundle,originalPolicy,originalRefs,history,preserved;
const needIds=[];
const snapshot=nid=>digest('sha256',sql(`select jsonb_build_object(
  'need',(select to_jsonb(n) from public.needs n where id=${q(nid)}),
  'sensitive',(select to_jsonb(n) from public.need_sensitive n where need_id=${q(nid)}),
  'geography',(select to_jsonb(n) from public.need_geography n where need_id=${q(nid)}),
  'decisions',(select coalesce(jsonb_agg(to_jsonb(n) order by decision_sequence),'[]') from private.need_publication_decisions n where need_id=${q(nid)}),
  'commands',(select coalesce(jsonb_agg(to_jsonb(n) order by created_at,client_request_id),'[]') from private.need_publish_commands n where need_id=${q(nid)}),
  'dispatch',(select to_jsonb(n) from private.dispatch_schedule n where need_id=${q(nid)}))::text`));
const context=(draft,client=owner)=>client.rpc('rpc_get_need_publication_context',{p_need_id:draft.needId,p_expected_revision:draft.revision});
const record=(draft,ctx,patch={})=>service.rpc('rpc_record_need_publication_decision_service',{
  p_need_id:draft.needId,p_expected_revision:draft.revision,p_policy_id:'RS_PUBLICATION_POLICY_MINIMUM',p_jurisdiction:'RS',
  p_outcome:'ALLOW',p_rule_ids:['RS-MIN-001'],p_decision_source:'PUBLICATION_EVALUATOR_V1',p_safe_reason_codes:['TEST_ALLOW'],
  p_provider_ref:'DISPOSABLE_FIXTURE',p_model_ref:'NO_PROVIDER_CALLED',p_reviewer_provenance:{},p_service_provenance:{evaluationContext:ctx.binding},...patch});
const publish=(draft,sequence,key='w05-publish-'+randomUUID(),deadline=null,client=owner)=>client.rpc('rpc_publish_need_canonical',{
  p_need_id:draft.needId,p_expected_revision:draft.revision,p_decision_sequence:sequence,p_response_deadline:deadline,p_client_request_id:key});
async function saveLocation(cid,value) {
  const previous=await ok(owner.rpc('rpc_get_need_location_review',{p_conversation_id:cid}),'READ_LOCATION_REVIEW');
  const saved=await ok(owner.rpc('rpc_save_need_location_review',{p_conversation_id:cid,p_expected_revision:previous.revision,p_confirmed:true,p_value:value}),'SAVE_CONFIRMED_LOCATION_REVIEW');
  assert.equal(saved.saved,true);return saved;
}
async function createDraft(location=locationCases.at(-1).value) {
  const cid=await ok(owner.rpc('rpc_ai_open_need_conversation_v2'));
  await saveLocation(cid,location);
  await ok(service.rpc('rpc_ai_apply_interview_turn_v2_service',{p_account_id:ownerId,p_conversation_id:cid,
    p_user_message:'W05_SYNTHETIC_NONLOCATION_FIXTURE',p_assistant_message:'W05_SYNTHETIC_NONLOCATION_FIXTURE',p_safety:'REVIEW',
    p_proposals:syntheticNonlocationFacts.map(([key,value])=>({key,value,displayValue:String(value),evidence:'Explicit synthetic nonlocation fixture',confidence:1}))}));
  const doc=await ok(owner.rpc('rpc_ai_need_review_v2',{p_conversation_id:cid}));
  for(const fact of doc.facts)if(fact.status!=='CONFIRMED')await ok(owner.rpc('rpc_ai_confirm_fact',{p_fact_id:fact.id}));
  const draft=await ok(owner.rpc('rpc_save_need_draft_from_review',{p_conversation_id:cid,p_requester_profile_id:ownerProfile,p_client_request_id:'w05-draft-'+randomUUID()}));
  assert.equal(draft.status,'DRAFT');assert.equal(draft.authoritative,true);
  const n=await ok(owner.from('needs').select('revision').eq('id',draft.needId).single());
  needIds.push(draft.needId);return {...draft,revision:n.revision,conversationId:cid};
}
async function edit(draft) {
  const opened=await ok(owner.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:draft.needId}),'OPEN_OWNED_EDIT_CONVERSATION');
  const conversation=await ok(owner.from('ai_conversations').select('status,bound_need_id').eq('id',opened.conversationId).single());
  assert.equal(conversation.status,'OPEN');assert.equal(conversation.bound_need_id,draft.needId);
  return opened;
}
async function changeFact(cid,key,value) {
  const fact=await ok(owner.from('ai_structured_facts').select('id').eq('conversation_id',cid).eq('fact_key',key).is('superseded_at',null).single());
  await ok(owner.rpc('rpc_ai_correct_fact_v2',{p_fact_id:fact.id,p_value:value,p_display_value:String(value)}));
}
const confirmEdit=(draft,opened,key='w05-edit-'+randomUUID())=>owner.rpc('rpc_confirm_need_edit_from_review_v2',{
  p_need_id:draft.needId,p_expected_revision:opened.revision,p_conversation_id:opened.conversationId,p_client_request_id:key});
async function correctPrivateAccess(draft,accessNotes) {
  const opened=await edit(draft);
  const current=await ok(owner.rpc('rpc_get_need_location_review',{p_conversation_id:opened.conversationId}),'READ_PRIVATE_CORRECTION_BASE');
  await saveLocation(opened.conversationId,{...current.value,accessNotes});
  const saved=await ok(confirmEdit(draft,opened),'CONFIRM_PRIVATE_CORRECTION');
  assert.equal(saved.revision,draft.revision+1);assert.equal(saved.status,'DRAFT');assert.equal(saved.requiresReadmission,true);
  return {...draft,revision:saved.revision};
}
async function rawTitle(draft,title) {
  const data=await ok(owner.from('needs').update({title}).eq('id',draft.needId).select('id,revision,title'),'OWNER_RAW_DRAFT_TITLE');
  assert.equal(data.length,1,'DRAFT_UPDATE_FILTERED');assert.equal(data[0].revision,draft.revision);assert.equal(data[0].title,title);
}
function activateMetadata() {
  sql(`update private.publication_policy_bundles set is_reviewed=true,is_complete=true,is_active=true,
    reviewed_at=statement_timestamp(),activated_at=statement_timestamp() where id=${q(bundle)}`);
}
function reviewFixtureDigest() {
  // This is the explicit TEST-ONLY review act, never an automatic production
  // trigger. Independently reconstructs the normalized executable document.
  sql(`update private.publication_policy_bundles b set review_provenance=review_provenance||jsonb_build_object(
    'evaluatorContentSha256',encode(extensions.digest(convert_to(((review_provenance->'evaluatorPolicy')||jsonb_build_object('rules',(
      select jsonb_agg(jsonb_build_object('ruleId',r.rule_id,'instructions',r.rule_provenance#>>'{evaluation,instructions}',
      'outcomes',r.rule_provenance#>'{evaluation,outcomes}','safeReasonCodes',r.rule_provenance#>'{evaluation,safeReasonCodes}') order by r.rule_id)
      from private.publication_policy_rule_refs r where r.bundle_id=b.id)))::text,'UTF8'),'sha256'),'hex')) where b.id=${q(bundle)}`);
}
function seedSyntheticPolicy() {
  const head={schemaVersion:'USKOCI_PUBLICATION_POLICY_V1',instructions:'DISPOSABLE TEST ONLY. Classify synthetic fixtures using these synthetic rules. No production legal content.'};
  sql(`update private.publication_policy_bundles set review_provenance=review_provenance||jsonb_build_object('evaluatorPolicy',${q(JSON.stringify(head))}::jsonb,'testBoundary','DISPOSABLE_SYNTHETIC_ONLY') where id=${q(bundle)};
    update private.publication_policy_rule_refs set rule_provenance=rule_provenance||jsonb_build_object('evaluation',jsonb_build_object(
      'instructions','DISPOSABLE TEST ONLY '||rule_id,'outcomes',case when rule_id='RS-MIN-015' then '[]'::jsonb else '["ALLOW","CLARIFY","REVIEW","BLOCK"]'::jsonb end,
      'safeReasonCodes','["TEST_ALLOW","TEST_CLARIFY","TEST_REVIEW","TEST_BLOCK"]'::jsonb)) where bundle_id=${q(bundle)};`);
  reviewFixtureDigest();activateMetadata();
}
async function heldContext(draft,needOnly=false) {
  const child=spawn('psql',[db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});children.push(child);
  let output='';
  const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CONTEXT_LOCK_TIMEOUT')),10000);
    child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.includes('W05_CONTEXT_HELD')){clearTimeout(timer);resolve();}});
    child.once('exit',code=>{if(code!==0){clearTimeout(timer);reject(new Error('CONTEXT_LOCK_SESSION_FAILED'));}});});
  child.stdin.write(`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(ownerId)},true);
    select set_config('request.jwt.claims',${q(JSON.stringify({sub:ownerId,role:'authenticated'}))},true);
    ${needOnly?`select id from public.needs where id=${q(draft.needId)} for update`:`select public.rpc_get_need_publication_context(${q(draft.needId)},${draft.revision})->>'kind'`};select 'W05_CONTEXT_HELD';\n`);
  await ready;
  return async()=>{child.stdin.end('rollback;\n');await new Promise(resolve=>child.once('exit',resolve));};
}
try {
  begin('EXACT_SOURCE102_OLD_D0140_INVARIANTS_THEN_EXACT_SQL103');
  const prior=JSON.parse(readFileSync((env.D0140A_ARTIFACT_DIR||'artifacts/d0140a-bundle-registration')+'/proof-report.json'));
  assert.equal(prior.result,'PASS');assert.equal(prior.source_sha,report.source_sha);assert.equal(prior.checks.length,6);
  assert.equal(prior.migration_history_count,102);assert.equal(prior.successor_replay.domain_state_security_and_projection_unchanged,true);
  assert.deepEqual(prior.full_source_plan,boundary.fullPlan);
  history=sql("select jsonb_agg(to_jsonb(m) order by version)::text from supabase_migrations.schema_migrations m");
  assert.equal(JSON.parse(history).length,102);
  const beforeAcl=sql("select jsonb_agg(jsonb_build_array(oid,proacl) order by oid)::text from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace)");
  preserved=Object.fromEntries(['private.worker_calendar_events','private.response_application_snapshots','public.profile_availability_rules','public.profile_availability_windows','private.location_market_configs','public.agreements'].map(table=>[table,tableHash(table)]));
  const file='supabase/migrations/'+publicationForward,bytes=readFileSync(file),entry=boundary.fullPlan.source_inventory.at(-1);
  assert.equal(digest('md5',bytes),boundary.next.md5);assert.equal(digest('sha256',bytes),entry.sha256);assert.equal(bytes.length,entry.bytes);
  try{execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-f',file],{stdio:'pipe'});}catch(error){const stderr=String(error.stderr);report.apply_failure={sqlstate:stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNKNOWN',line:Number(stderr.match(/\.sql:(\d+):/)?.[1])||null};throw new Error('EXACT_SQL103_APPLY_FAILED');}
  sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(boundary.next.version)},${q(boundary.next.name)},array[${q(bytes.toString('utf8'))}])`);
  const oldOids=JSON.parse(beforeAcl).map(([oid])=>oid).join(',');
  assert.equal(sql(`select jsonb_agg(jsonb_build_array(oid,proacl) order by oid)::text from pg_proc where oid in (${oldOids})`),beforeAcl,'PREDECESSOR_ACL_CHANGED');
  sql("notify pgrst,'reload schema'");
  for(let i=0;i<30;i++){const r=await anon.rpc('rpc_get_need_publication_context',{p_need_id:randomUUID(),p_expected_revision:1});if(r.error?.code!=='PGRST202')break;await new Promise(resolve=>setTimeout(resolve,100));}
  report.forward={...entry,version:boundary.next.version};report.old_d0140_six_checks_before_intentional_forward=true;
  for(const path of [file,'supabase/proofs/policy/publication_authority_proof.mjs','supabase/proofs/policy/publication_fixtures.mjs','supabase/proofs/policy/publication_source_boundary.mjs','supabase/proofs/policy/d0140a_bundle_registration_proof.mjs','supabase/functions/uskoci-publication-evaluate/index.ts','src/contracts/publication.ts','.github/workflows/d0140a-bundle-registration-proof.yml'])report.input_sha256[path]=digest('sha256',readFileSync(path));
  pass();

  begin('REAL_AUTH_OWNER_FOREIGN_ANON_AND_CLOSED_WRITER_ACLS');
  for(const [client,email,id] of [[owner,env.RU5_DEVICE_REQUESTER_EMAIL,ownerId],[other,env.RU5_DEVICE_WORKER_EMAIL,env.RU5_DEVICE_WORKER_USER_ID]]){
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  ownerProfile=(await ok(owner.from('app_profiles').select('id').eq('account_id',ownerId).eq('kind','REQUESTER').single())).id;
  const draft=await createDraft();
  await reject(context(draft,anon));await reject(context(draft,other),'42501','NEED_NOT_OWNED');
  await reject(context({...draft,revision:2}),'40001','NEED_REVISION_STALE');
  await reject(owner.rpc('rpc_get_need_publication_context',{p_need_id:draft.needId,p_expected_revision:1,p_owner:ownerId}));
  await reject(owner.rpc('rpc_record_need_publication_decision_service',{p_need_id:draft.needId,p_expected_revision:1,p_policy_id:'RS_PUBLICATION_POLICY_MINIMUM',p_jurisdiction:'RS',p_outcome:'ALLOW',p_rule_ids:['RS-MIN-001'],p_decision_source:'PUBLICATION_EVALUATOR_V1'}));
  const newSignatures=['private.publication_policy_document(uuid)','private.need_publication_location_readiness(uuid)','private.need_publication_context(uuid,integer,uuid)','private.need_edit_base_marker(uuid)','private.guard_need_edit_base_marker()'];
  for(const signature of newSignatures)for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE')`),'f');
  assert.equal(sql("select has_function_privilege('authenticated','public.rpc_get_need_publication_context(uuid,integer)','EXECUTE')"),'t');
  assert.equal(sql("select has_function_privilege('service_role','public.rpc_get_need_publication_context(uuid,integer)','EXECUTE')"),'f');
  pass();

  begin('INACTIVE_AND_METADATA_ONLY_POLICIES_NEVER_PERSIST_FAKE_DECISIONS');
  bundle=sql("select id from private.publication_policy_bundles where policy_id='RS_PUBLICATION_POLICY_MINIMUM' and jurisdiction='RS' and version=1");
  originalPolicy=JSON.parse(sql(`select to_jsonb(b) from private.publication_policy_bundles b where id=${q(bundle)}`));
  originalRefs=JSON.parse(sql(`select jsonb_agg(to_jsonb(r) order by rule_id) from private.publication_policy_rule_refs r where bundle_id=${q(bundle)}`));
  const unchanged=snapshot(draft.needId);
  assert.equal((await ok(context(draft))).code,'POLICY_NOT_READY');
  await reject(record(draft,{binding:{}}),'P0001','PUBLICATION_CONTEXT_NOT_READY');
  assert.equal(snapshot(draft.needId),unchanged);
  activateMetadata();assert.equal((await ok(context(draft))).code,'POLICY_CONTENT_NOT_READY');
  await reject(record(draft,{binding:{}}),'P0001','PUBLICATION_CONTEXT_NOT_READY');assert.equal(snapshot(draft.needId),unchanged);
  pass();

  begin('ALL_EXISTING_LOCATION_SLOTS_GATE_PUBLICATION_AND_PARTIAL_DRAFTS_REMAIN_VALID');
  const physical=[];
  for(const sample of locationCases){const d=await createDraft(sample.value);physical.push({sample,d});const c=await ok(context(d));
    if(sample.missing.length){assert.equal(c.code,'LOCATION_INCOMPLETE');assert.deepEqual(c.missingSlots,sample.missing);
      const before=snapshot(d.needId);await reject(publish(d,1),'P0001','PUBLICATION_CONTEXT_NOT_READY');assert.equal(snapshot(d.needId),before);}
    else assert.equal(c.code,'POLICY_CONTENT_NOT_READY');
  }
  report.location_cases=locationCases.map(x=>({id:x.id,missingSlots:x.missing}));pass();

  begin('REVIEWED_EXECUTABLE_CONTENT_DIGEST_SHAPE_AND_MODIFIER_BOUNDARIES');
  seedSyntheticPolicy();let ready=await ok(context(draft));assert.equal(ready.kind,'READY');assert.equal(ready.authoritativeDecision,false);
  assert.equal(ready.policy.rules.length,16);assert.deepEqual(ready.policy.rules.find(x=>x.ruleId==='RS-MIN-015').outcomes,[]);
  assert.equal(Object.keys(ready.publicNeed).length,18);assert.equal('exactAddress' in ready.publicNeed,false);
  const ruleSql=`where bundle_id=${q(bundle)} and rule_id='RS-MIN-001'`;
  const initialRule=sql(`select rule_provenance::text from private.publication_policy_rule_refs ${ruleSql}`);
  sql(`update private.publication_policy_rule_refs set rule_provenance=jsonb_set(rule_provenance,'{evaluation,instructions}','"Changed without renewed review"'::jsonb) ${ruleSql}`);
  assert.equal((await ok(context(draft))).code,'POLICY_CONTENT_NOT_READY');
  reviewFixtureDigest();assert.equal((await ok(context(draft))).kind,'READY');
  await reject(record(draft,ready),'40001','PUBLICATION_CONTEXT_STALE');
  for(const instruction of ['BAD\u0001CONTROL','BAD\u007fCONTROL','x'.repeat(4001)]){
    sql(`update private.publication_policy_rule_refs set rule_provenance=jsonb_set(rule_provenance,'{evaluation,instructions}',${q(JSON.stringify(instruction))}::jsonb) ${ruleSql}`);
    reviewFixtureDigest();assert.equal((await ok(context(draft))).code,'POLICY_CONTENT_NOT_READY');
  }
  sql(`update private.publication_policy_rule_refs set rule_provenance=${q(initialRule)}::jsonb ${ruleSql}`);reviewFixtureDigest();
  const allRules=sql(`select jsonb_agg(jsonb_build_object('rule_id',rule_id,'rule_provenance',rule_provenance))::text from private.publication_policy_rule_refs where bundle_id=${q(bundle)}`);
  sql(`update private.publication_policy_rule_refs set rule_provenance=jsonb_set(rule_provenance,'{evaluation,outcomes}','[]') where bundle_id=${q(bundle)}`);
  reviewFixtureDigest();assert.equal((await ok(context(draft))).code,'POLICY_CONTENT_NOT_READY');
  sql(`update private.publication_policy_rule_refs r set rule_provenance=x.rule_provenance from jsonb_to_recordset(${q(allRules)}::jsonb) x(rule_id text,rule_provenance jsonb) where r.bundle_id=${q(bundle)} and r.rule_id=x.rule_id`);reviewFixtureDigest();
  pass();

  begin('EVALUATOR_CONTEXT_STALE_PUBLIC_PRIVATE_POLICY_AND_COUNTRY_IS_ATOMIC');
  ready=await ok(context(draft));await rawTitle(draft,'Same revision changed public text');
  let before=snapshot(draft.needId);await reject(record(draft,ready),'40001','PUBLICATION_CONTEXT_STALE');assert.equal(snapshot(draft.needId),before);
  const pd=physical.find(x=>x.sample.id==='stationary-zero-valid').d;
  const privateContext=await ok(context(pd));
  before=snapshot(pd.needId);
  await reject(owner.from('need_sensitive').update({access_notes:'Forbidden raw private write'}).eq('need_id',pd.needId).select('need_id'),'42501');
  assert.equal(snapshot(pd.needId),before,'FORBIDDEN_PRIVATE_WRITE_CHANGED_STATE');
  const revisedPrivate=await correctPrivateAccess(pd,'Private material changed through confirmed review');
  before=snapshot(pd.needId);await reject(record(pd,privateContext),'40001','NEED_REVISION_STALE');assert.equal(snapshot(pd.needId),before);
  await reject(record(revisedPrivate,privateContext),'40001','PUBLICATION_CONTEXT_STALE');assert.equal(snapshot(pd.needId),before);
  const current=await ok(context(revisedPrivate));assert.notEqual(current.binding.privateMaterialityMarker,privateContext.binding.privateMaterialityMarker);
  for(const patch of [{taskCountryCode:'BA'},{taskTimezone:'UTC'},{needId:randomUUID()},{needRevision:current.binding.needRevision+1},{policyContentSha256:'0'.repeat(64)}]){
    await reject(record(revisedPrivate,{binding:{...current.binding,...patch}}),'40001','PUBLICATION_CONTEXT_STALE');assert.equal(snapshot(pd.needId),before);
  }
  sql(`update private.publication_policy_bundles set review_provenance=review_provenance||'{"review_epoch":"SECOND_DISPOSABLE_REVIEW"}'::jsonb where id=${q(bundle)}`);
  await reject(record(revisedPrivate,current),'40001','PUBLICATION_CONTEXT_STALE');assert.equal(snapshot(pd.needId),before);
  pass();

  begin('CONTEXT_LOCKS_POLICY_PHANTOMS_CONFIG_NEED_AND_PRIVATE_MATERIAL');
  // Remote drafts legitimately omit need_sensitive; use the existing physical
  // draft after its canonical private correction to test a real locked row.
  const lockDraft=revisedPrivate;
  assert.equal(sql(`select count(*) from public.need_sensitive where need_id=${q(lockDraft.needId)}`),'1','PRIVATE_LOCK_FIXTURE_ROW_MISSING');
  assert.equal((await ok(context(lockDraft))).kind,'READY');
  const release=await heldContext(lockDraft);
  report.lock_attempts=[];
  try{
    for(const [operation,statement] of [
      ['POLICY_BUNDLE_UPDATE',`update private.publication_policy_bundles set is_active=false where id=${q(bundle)}`],
      ['POLICY_RULE_UPDATE',`update private.publication_policy_rule_refs set rule_provenance=rule_provenance||'{"race":true}' where bundle_id=${q(bundle)}`],
      ['POLICY_RULE_PHANTOM_INSERT',`insert into private.publication_policy_rule_refs(bundle_id,rule_id) values(${q(bundle)},'TEST-PHANTOM')`],
      ['MARKET_CONFIG_UPDATE',"update private.location_market_configs set product_status='BUILDING' where country_code='RS'"],
      ['NEED_PUBLIC_UPDATE',`update public.needs set title='BLOCKED CONCURRENT CHANGE' where id=${q(lockDraft.needId)}`],
      ['NEED_PRIVATE_UPDATE',`update public.need_sensitive set access_notes='BLOCKED CONCURRENT PRIVATE' where need_id=${q(lockDraft.needId)}`],
    ]){
      const sqlstate=sqlState(`begin;set local lock_timeout='150ms';${statement};rollback;`);
      report.lock_attempts.push({operation,sqlstate});
      assert.equal(sqlstate,'55P03','CONCURRENT_CONTEXT_WRITE_WAS_NOT_LOCKED_'+operation);
    }
  }finally{await release();}
  report.lock_interleavings=6;pass();

  begin('POLICY_EXPIRY_DURING_NEED_LOCK_WAIT_IS_CHECKED_AFTER_WAIT');
  sql(`update private.publication_policy_bundles set effective_until=clock_timestamp()+interval '3 seconds' where id=${q(bundle)}`);
  const releaseNeed=await heldContext(draft,true);
  const waiting=context(draft).then(value=>value);
  try{
    for(let i=0;i<50&&sql("select count(*) from pg_stat_activity where state='active' and wait_event_type='Lock' and query like '%rpc_get_need_publication_context%'")==='0';i++)await new Promise(resolve=>setTimeout(resolve,50));
    assert.notEqual(sql("select count(*) from pg_stat_activity where state='active' and wait_event_type='Lock' and query like '%rpc_get_need_publication_context%'"),'0','AUTH_CONTEXT_DID_NOT_QUEUE');
    for(let i=0;i<80&&sql(`select clock_timestamp()>effective_until from private.publication_policy_bundles where id=${q(bundle)}`)!=='t';i++)await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(sql(`select clock_timestamp()>effective_until from private.publication_policy_bundles where id=${q(bundle)}`),'t');
  }finally{await releaseNeed();}
  assert.equal((await ok(waiting)).code,'POLICY_NOT_READY');
  sql(`update private.publication_policy_bundles set effective_until=null where id=${q(bundle)}`);
  pass();

  begin('STRICT_RULE_OUTCOME_REASON_MEMBERSHIP_APPEND_ONLY_AND_SEMANTIC_RETRY');
  ready=await ok(context(draft));const beforeDecision=snapshot(draft.needId);
  for(const patch of [{p_outcome:'UNKNOWN'},{p_rule_ids:[]},{p_rule_ids:['RS-MIN-001','RS-MIN-001']},
    {p_rule_ids:['RS-MIN-999']},{p_rule_ids:['RS-MIN-015']},{p_safe_reason_codes:['RAW_UNAPPROVED_REASON']},
    {p_safe_reason_codes:['TEST_ALLOW','TEST_ALLOW']},{p_decision_source:'CLIENT'},{p_service_provenance:{evaluationContext:ready.binding,extra:true}}]){
    await reject(record(draft,ready,patch));assert.equal(snapshot(draft.needId),beforeDecision);
  }
  const clarify=await ok(record(draft,ready,{p_outcome:'CLARIFY',p_safe_reason_codes:['TEST_CLARIFY']}));
  assert.equal(clarify.publishable,false);assert.equal(clarify.authoritative,true);
  await reject(publish(draft,clarify.decisionSequence),'P0001','PUBLICATION_DECISION_NOT_ALLOW');
  const allowed=await ok(record(draft,ready));assert.equal(allowed.publishable,true);assert.equal(allowed.outcome,'ALLOW');
  assert.ok(Date.parse(allowed.decisionAt));assert.deepEqual(allowed.ruleIds,['RS-MIN-001']);assert.deepEqual(allowed.safeReasonCodes,['TEST_ALLOW']);
  assert.deepEqual(await ok(record(draft,ready)),allowed);
  assert.equal(sql(`select count(*) from private.need_publication_decisions where need_id=${q(draft.needId)}`),'2');
  assert.notEqual(sqlState(`update private.need_publication_decisions set outcome='BLOCK' where id=${q(allowed.decisionId)}`),'OK');
  const staleDraft=await createDraft(),staleReady=await ok(context(staleDraft)),staleDecision=await ok(record(staleDraft,staleReady));
  await rawTitle(staleDraft,'Same revision edit after stored ALLOW');
  before=snapshot(staleDraft.needId);await reject(publish(staleDraft,staleDecision.decisionSequence),'40001','PUBLICATION_DECISION_CONTEXT_STALE');assert.equal(snapshot(staleDraft.needId),before);
  pass();

  begin('EXPLICIT_CANONICAL_PUBLISH_AND_RECEIPT_REPLAY_AFTER_DEADLINE_NO_REDISPATCH');
  const deadline=sql("select (clock_timestamp()+interval '5 seconds')::text");
  const key='w05-publish-'+randomUUID();
  await reject(publish(draft,allowed.decisionSequence,key,deadline,other),'42501','NEED_NOT_OWNED');
  const receipt=await ok(publish(draft,allowed.decisionSequence,key,deadline));assert.equal(receipt.status,'PUBLISHED');assert.equal(receipt.idempotentReplay,false);
  assert.equal(sql(`select count(*) from private.dispatch_schedule where need_id=${q(draft.needId)}`),'1');
  const publishedSnapshot=snapshot(draft.needId);
  for(let i=0;i<80&&sql(`select clock_timestamp()>${q(deadline)}::timestamptz`)!=='t';i++)await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(sql(`select clock_timestamp()>${q(deadline)}::timestamptz`),'t','SERVER_DEADLINE_NOT_ELAPSED');
  sql(`update private.publication_policy_bundles set is_active=false where id=${q(bundle)}`);
  assert.deepEqual(await ok(publish(draft,allowed.decisionSequence,key,deadline)),{...receipt,idempotentReplay:true});
  assert.equal(snapshot(draft.needId),publishedSnapshot);
  await reject(publish(draft,allowed.decisionSequence,'w05-new-key-'+randomUUID(),deadline),'22023','RESPONSE_DEADLINE_INVALID');
  await reject(publish(draft,allowed.decisionSequence,key,null),'22023','IDEMPOTENCY_KEY_REUSED');activateMetadata();
  pass();

  begin('SAVED_DRAFT_CORRECTION_BASE_CONTEXT_AND_SERVER_OWNED_MARKER');
  const d=await createDraft(),opened=await edit(d);assert.equal(opened.status,'DRAFT');
  const marker=await ok(owner.from('ai_conversations').select('need_edit_base_fingerprint').eq('id',opened.conversationId).single());
  assert.match(marker.need_edit_base_fingerprint,/^[0-9a-f]{64}$/);
  const normal=await ok(owner.from('ai_conversations').select('need_edit_base_fingerprint').eq('id',d.conversationId).single());assert.equal(normal.need_edit_base_fingerprint,null);
  const spoof=await owner.from('ai_conversations').update({need_edit_base_fingerprint:'0'.repeat(64)}).eq('id',opened.conversationId).select('id');
  assert.ok(spoof.error||spoof.data.length===0);assert.deepEqual(await ok(owner.from('ai_conversations').select('need_edit_base_fingerprint').eq('id',opened.conversationId).single()),marker);
  await changeFact(opened.conversationId,'need.title','Correction from saved DRAFT');
  await rawTitle(d,'Concurrent same revision owner correction');before=snapshot(d.needId);
  await reject(confirmEdit(d,opened),'40001','STALE_REVIEW_REQUIRED');assert.equal(snapshot(d.needId),before);
  const fresh=await edit(d);await changeFact(fresh.conversationId,'need.title','Accepted current DRAFT correction');
  const correctionKey='w05-edit-'+randomUUID();const edited=await ok(confirmEdit(d,fresh,correctionKey));
  assert.equal(edited.status,'DRAFT');assert.equal(edited.revision,d.revision+1);assert.equal(edited.requiresReadmission,true);
  assert.deepEqual(await ok(confirmEdit(d,fresh,correctionKey)),{...edited,idempotentReplay:true});
  const privateDraft=physical.find(x=>x.sample.id==='route-complete-reordered').d,privateEdit=await edit(privateDraft);
  await changeFact(privateEdit.conversationId,'need.title','Private stale correction');
  await correctPrivateAccess(privateDraft,'Concurrent private context through second confirmed editor');
  before=snapshot(privateDraft.needId);await reject(confirmEdit(privateDraft,privateEdit),'40001','STALE_REVIEW_REQUIRED');assert.equal(snapshot(privateDraft.needId),before);
  pass();

  begin('DRAFT_EDITOR_BASE_REMAINS_BOUND_ACROSS_PUBLICATION');
  const crossing=await createDraft(),oldEditor=await edit(crossing);
  await changeFact(oldEditor.conversationId,'need.title','Stale editor before concurrent publication');
  await rawTitle(crossing,'Current material B before evaluation and publication');
  const crossingDecision=await ok(record(crossing,await ok(context(crossing))));
  await ok(publish(crossing,crossingDecision.decisionSequence));
  before=snapshot(crossing.needId);await reject(confirmEdit(crossing,oldEditor),'40001','STALE_REVIEW_REQUIRED');assert.equal(snapshot(crossing.needId),before);
  const unchangedBase=await createDraft(),compatibleEditor=await edit(unchangedBase);
  await changeFact(compatibleEditor.conversationId,'need.title','Compatible editor with unchanged publication base');
  const compatibleDecision=await ok(record(unchangedBase,await ok(context(unchangedBase))));
  await ok(publish(unchangedBase,compatibleDecision.decisionSequence));
  const compatibleResult=await ok(confirmEdit(unchangedBase,compatibleEditor));assert.equal(compatibleResult.status,'DRAFT');assert.equal(compatibleResult.revision,2);
  pass();

  begin('PUBLISHED_EDIT_UNPUBLISHES_AND_REQUIRES_CURRENT_REVISION_READMISSION');
  const reopened=await edit(draft);assert.equal(reopened.status,'PUBLISHED');await changeFact(reopened.conversationId,'need.title','Material correction after publication');
  const changedPublished=await ok(confirmEdit(draft,reopened));assert.equal(changedPublished.status,'DRAFT');assert.equal(changedPublished.revision,2);
  assert.equal(changedPublished.requiresReadmission,true);assert.equal(sql(`select count(*) from private.dispatch_schedule where need_id=${q(draft.needId)}`),'0');
  before=snapshot(draft.needId);await reject(publish({...draft,revision:2},allowed.decisionSequence),'P0001','PUBLICATION_DECISION_SCOPE_MISMATCH');assert.equal(snapshot(draft.needId),before);
  const incomplete=physical.find(x=>x.sample.id==='route-missing-end').d,correct=await edit(incomplete);
  await saveLocation(correct.conversationId,locationCases.find(x=>x.id==='route-complete-reordered').value);
  const completed=await ok(confirmEdit(incomplete,correct));assert.equal((await ok(context({...incomplete,revision:completed.revision}))).kind,'READY');
  pass();

  begin('FINAL_HISTORY_POLICY_RESTORATION_PRIVATE_SECURITY_AND_UNRELATED_DOMAINS');
  sql(`update private.publication_policy_bundles set is_active=false,is_reviewed=${originalPolicy.is_reviewed},is_complete=${originalPolicy.is_complete},
    reviewed_at=${originalPolicy.reviewed_at?q(originalPolicy.reviewed_at):'null'},activated_at=null,
    review_provenance=${q(JSON.stringify(originalPolicy.review_provenance))}::jsonb where id=${q(bundle)};
    update private.publication_policy_rule_refs r set rule_provenance=x.rule_provenance from jsonb_to_recordset(${q(JSON.stringify(originalRefs))}::jsonb) x(rule_id text,rule_provenance jsonb)
    where r.bundle_id=${q(bundle)} and r.rule_id=x.rule_id;`);
  assert.equal(sql('select count(*) from private.publication_policy_bundles where is_active'),'0');
  assert.equal(sql(`select private.publication_policy_document(${q(bundle)}) is null`),'t');
  assert.equal(sql(`select jsonb_agg(to_jsonb(m) order by version)::text from supabase_migrations.schema_migrations m where version<>${q(boundary.next.version)}`),history);
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'103');
  assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${q(boundary.next.version)}`),boundary.next.md5);
  for(const [table,hash] of Object.entries(preserved))assert.equal(tableHash(table),hash,table);
  const privateTables=['publication_policy_bundles','publication_policy_rule_refs','need_publication_decisions','need_publish_commands','need_edit_commands','need_revision_events'];
  for(const table of privateTables){assert.equal(sql(`select relrowsecurity from pg_class where oid=${q('private.'+table)}::regclass`),'t');
    assert.equal(sql(`select relforcerowsecurity from pg_class where oid=${q('private.'+table)}::regclass`),['need_publish_commands','need_edit_commands','need_revision_events'].includes(table)?'t':'f');
    for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+table)},'INSERT,UPDATE,DELETE')`),'f');}
  assert.equal(sql("select count(*) from private.publication_policy_rule_refs where rule_provenance ? 'evaluation'"),'0');
  report.history_count=103;report.original_source102_history_unchanged=true;report.policy_fixture_restored_inert=true;
  report.unrelated_calendar_application_market_rows_unchanged=true;report.synthetic_need_count=needIds.length;
  pass();report.result='PASS';
}catch(error){report.result='FAIL';report.failed_stage=stage;
  report.failure_category=error?.code==='ERR_ASSERTION'?'ASSERTION':/^[A-Z0-9_]+$/.test(error.message)?error.message:'SAFE_EXECUTION_FAILURE';
  report.failed_source_line=report.last_rpc_error?.caller_line??(Number(error?.stack?.match(/publication_authority_proof\.mjs:(\d+):/)?.[1])||null);
  process.exitCode=1;
}finally{
  for(const child of children)if(child.exitCode===null)child.kill();
  for(const client of [owner,other,anon,service])await client.auth.stopAutoRefresh();
  writeFileSync(out+'/publication-proof-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(report.result+' W05_PUBLICATION_AUTHORITY');
}
