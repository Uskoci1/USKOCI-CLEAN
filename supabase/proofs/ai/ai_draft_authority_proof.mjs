// Actual Auth/PostgREST and observed PostgreSQL row-lock proof. Loopback only.
// Provider output is represented by explicit service-writer fixtures here.
// This is NOT an actual provider call or production/Android evidence.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const uuid=value=>{assert.match(String(value),/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);return value;};
const ownerId=uuid(env.RU5_DEVICE_REQUESTER_USER_ID),outsiderId=uuid(env.RU5_DEVICE_WORKER_USER_ID);
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const owner=createClient(url,env.RU5_DEVICE_ANON_KEY,opts),outsider=createClient(url,env.RU5_DEVICE_ANON_KEY,opts);
const anon=createClient(url,env.RU5_DEVICE_ANON_KEY,opts),service=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,opts);
const out=env.AI_AUTHORITY_ARTIFACT_DIR||'artifacts/ai-draft-authority';mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('supabase/proofs/ai/ai_draft_authority_files.json','utf8'));
const bytes=readFileSync(manifest.file),forward=`supabase/migrations/${manifest.forward_file}`;
assert.equal(bytes.length,manifest.bytes);
assert.equal(createHash('md5').update(bytes).digest('hex'),manifest.md5);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
assert.deepEqual(readFileSync(forward),bytes);
const report={unit:'AI_DRAFT_AUTHORITY',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  live_access:false,live_promotion:false,provider_called:false,provider_response_stubbed:true,mobile_proof:false,
  fixture_boundary:'REAL_LOCAL_AUTH_POSTGREST_AND_ROLE_SCOPED_PSQL_TRANSACTIONS',candidate:manifest,checks:[]};
const lit=value=>`'${String(value).replaceAll("'","''")}'`;
function sql(query){
  try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At'],
    {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
  catch{throw new Error('DISPOSABLE_SQL_FAILED');}
}
const rows=query=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));
const ok=async promise=>{const result=await promise;if(result.error)throw new Error(`AUTH_RPC_FAILED_${result.error.code}`);return result.data;};
async function denied(promise,code,message){const result=await promise;assert.ok(result.error);if(code)assert.equal(result.error.code,code);if(message)assert.equal(result.error.message,message);return result.error;}
let current='PREFLIGHT',profileId;
const check=name=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
const active=[];
const tableHash=(table,where='true')=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x where ${where}`);
const noEffects=()=>Object.fromEntries(['public.agreements','public.marketplace_responses','public.dispatch_rounds',
  'public.opportunity_deliveries','public.user_activity_events','public.notification_deliveries',
  'private.dispatch_schedule','private.publication_policy_bundles','private.need_publication_decisions',
  'private.connection_policy_versions','public.marketplace_config'].map(table=>[table,tableHash(table)]));
const review=(conversation,client=owner)=>client.rpc('rpc_ai_need_review_v2',{p_conversation_id:conversation});
const save=(conversation,key,client=owner)=>client.rpc('rpc_save_need_draft_from_review',
  {p_conversation_id:conversation,p_requester_profile_id:profileId,p_client_request_id:key});
const turn=(conversation,safety,proposals=[])=>service.rpc('rpc_ai_apply_interview_turn_v2_service',
  {p_account_id:ownerId,p_conversation_id:conversation,p_user_message:'AI_AUTHORITY_SYNTHETIC_INPUT',
    p_assistant_message:'AI_AUTHORITY_SYNTHETIC_PROVIDER_FIXTURE',p_safety:safety,p_proposals:proposals});
const sample=[['need.title','Lektura kratkog teksta'],['need.description','Pregled pravopisa dve strane srpskog teksta.'],
  ['need.category','pisanje'],['need.price_mode','OFFERS'],['need.schedule_kind','FLEXIBLE'],
  ['need.people_needed',1],['need.task_geography',{mode:'REMOTE'}]];
const proposals=()=>sample.map(([key,value])=>({key,value,displayValue:typeof value==='object'?'Na daljinu':String(value),
  evidence:'Synthetic disposable fixture input',confidence:0.99}));
async function ready(safety='ALLOW'){
  const conversation=uuid(await ok(owner.rpc('rpc_ai_open_need_conversation_v2')));
  await ok(turn(conversation,safety,proposals()));
  const initial=await ok(review(conversation));assert.equal(initial.canSaveDraft,false);
  for(const fact of initial.facts)await ok(owner.rpc('rpc_ai_confirm_fact',{p_fact_id:fact.id}));
  return conversation;
}
const scoped=conversation=>Object.fromEntries([
  ['needs','public.needs',`id in (select bound_need_id from public.ai_conversations where id=${lit(conversation)}::uuid)`],
  ['conversation','public.ai_conversations',`id=${lit(conversation)}::uuid`],
  ['facts','public.ai_structured_facts',`conversation_id=${lit(conversation)}::uuid`],
  ['messages','public.ai_messages',`conversation_id=${lit(conversation)}::uuid`],
  ['commands','private.need_draft_save_commands',`conversation_id=${lit(conversation)}::uuid`],
].map(([name,table,where])=>[name,tableHash(table,where)]));
function startTransaction(name,role,statement,{sleep=0}={}){
  assert.match(name,/^ai_auth_[a-z0-9_]+$/);assert.ok(['authenticated','service_role'].includes(role));
  const query=`set application_name=${lit(name)}; set statement_timeout='20s'; set lock_timeout='15s'; begin;
    set local role ${role}; select set_config('request.jwt.claims',${lit(JSON.stringify({role,sub:role==='authenticated'?ownerId:null}))},true);
    select set_config('request.jwt.claim.sub',${lit(role==='authenticated'?ownerId:'')},true);
    ${statement}; ${sleep?`select pg_sleep(${sleep});`:''} commit;`;
  const child=spawn('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],{stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  const completed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve({code,stdout,stderr}));});
  active.push(child);child.stdin.end(query);return {name,child,completed};
}
const state=name=>rows(`select pid,state,wait_event_type,wait_event,pg_blocking_pids(pid) as blockers from pg_stat_activity where application_name=${lit(name)}`)[0];
async function sleeping(name){
  for(let i=0;i<70;i++){const s=state(name);if(s?.wait_event==='PgSleep')return s;await new Promise(r=>setTimeout(r,100));}
  throw new Error('HOLDER_SLEEP_NOT_OBSERVED');
}
async function waiting(holderName,waiterName){
  for(let i=0;i<50;i++){
    const holder=state(holderName),waiter=state(waiterName);
    if(holder?.wait_event==='PgSleep'&&waiter?.wait_event_type==='Lock'&&waiter.blockers.includes(holder.pid)){
      const pending=rows(`select locktype,mode,granted from pg_locks where pid=${Number(waiter.pid)} and not granted`);
      assert.ok(pending.length);return {holder,waiter,pending};
    }
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('ROW_LOCK_CONTENTION_NOT_OBSERVED');
}
const saveSql=(conversation,key)=>`select public.rpc_save_need_draft_from_review(${lit(conversation)}::uuid,${lit(profileId)}::uuid,${lit(key)})`;
const blockSql=conversation=>`select public.rpc_ai_apply_interview_turn_v2_service(${lit(ownerId)}::uuid,${lit(conversation)}::uuid,'AI_AUTHORITY_LOCK_INPUT','AI_AUTHORITY_LOCK_BLOCK','BLOCK','[]'::jsonb)`;
const wireJson=result=>JSON.parse(result.stdout.split(/\r?\n/).find(line=>line.startsWith('{')&&line.includes('"needId"')));
const sqlDenied=(result,message)=>{assert.notEqual(result.code,0);assert.match(result.stderr,new RegExp(`P0001: ${message}`));};

try{
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'85');
  for(const [client,email,id] of [[owner,env.RU5_DEVICE_REQUESTER_EMAIL,ownerId],[outsider,env.RU5_DEVICE_WORKER_EMAIL,outsiderId]]){
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
    assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  profileId=uuid((await ok(owner.from('app_profiles').select('id').eq('account_id',ownerId).eq('kind','REQUESTER').single())).id);
  const unaffected=noEffects();
  const history=tableHash('supabase_migrations.schema_migrations');
  const allFunctions=()=>rows("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,md5(p.prosrc) body_md5,p.prosecdef,p.proconfig,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.oid not in ('public.rpc_ai_need_review_v2(uuid)'::regprocedure,'public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure) order by n.nspname,p.proname,args");
  const unchangedFunctions=allFunctions(),registry=tableHash('private.need_fact_registry');
  const targetAuthority=()=>rows("select p.oid::regprocedure::text signature,p.prosecdef,p.proleakproof,p.provolatile,p.proparallel,p.proconfig,p.proacl::text acl,p.proowner::regrole::text owner,p.prorettype::regtype::text result_type,p.proargnames,p.proargmodes from pg_proc p where p.oid in ('public.rpc_ai_need_review_v2(uuid)'::regprocedure,'public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure) order by signature");
  const authorityBefore=targetAuthority();report.target_authority_before=authorityBefore;

  check('PREDECESSOR_CONFIRMED_FACTS_THEN_BLOCK_DIRECT_SAVE_BYPASSES_UI');
  const legacyBlocked=await ready();await ok(turn(legacyBlocked,'BLOCK'));
  const beforeReview=await ok(review(legacyBlocked));assert.equal(beforeReview.canSaveDraft,true);
  assert.equal(rows(`select safety from public.ai_messages where conversation_id=${lit(legacyBlocked)}::uuid and role='ASSISTANT' order by sequence_no desc limit 1`)[0].safety,'BLOCK');
  const legacyKey=`ai-authority-predecessor-${randomUUID()}`;
  const oldReceipt=await ok(save(legacyBlocked,legacyKey));assert.equal(oldReceipt.status,'DRAFT');
  assert.equal(sql(`select count(*) from public.needs where id=${lit(oldReceipt.needId)}::uuid and status='DRAFT'`),'1');
  report.predecessor={latest_persisted_safety:'BLOCK',review_can_save:true,authenticated_direct_save:'SUCCEEDED',
    conversation_id:legacyBlocked,receipt:oldReceipt};pass();

  check('EXACT_TWO_RPC_FORWARD_APPLY_PRESERVES_ALL85_HISTORY_AND_ENGINE');
  const beforeApply=scoped(legacyBlocked);
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',forward],{stdio:'pipe'});
  sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${lit(manifest.forward_version)},${lit(manifest.forward_name)},array[${lit(bytes.toString('utf8'))}])`);
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${lit(manifest.forward_version)}`),history);
  assert.deepEqual(scoped(legacyBlocked),beforeApply);assert.deepEqual(allFunctions(),unchangedFunctions);
  assert.deepEqual(targetAuthority(),authorityBefore,'target RPC ACL/search path/owner/security modes unchanged');
  assert.equal(tableHash('private.need_fact_registry'),registry);assert.deepEqual(noEffects(),unaffected);
  sql("notify pgrst,'reload schema'");
  let refreshed=false;
  for(let i=0;i<40;i++){const r=await review(legacyBlocked);if(!r.error&&r.data.safety==='BLOCK'){refreshed=true;break;}await new Promise(r=>setTimeout(r,250));}
  assert.ok(refreshed);report.exact_forward_file_applied_disposable=true;report.original85_full_history_unchanged=true;pass();

  check('REAPPLY_WRONG_PREDECESSOR_REFUSES_WITHOUT_PARTIAL_FUNCTION_CHANGE');
  let refused=false;
  try{execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',forward],{stdio:'pipe'});}
  catch(error){refused=String(error.stderr).includes('AI_DRAFT_PREDECESSOR_FUNCTION_MISMATCH');}
  assert.equal(refused,true);
  for(const [signature,digest] of Object.entries(manifest.candidate_body_md5))
    assert.equal(sql(`select md5(prosrc) from pg_proc where oid=${lit(signature)}::regprocedure`),digest);
  assert.deepEqual(allFunctions(),unchangedFunctions);assert.deepEqual(scoped(legacyBlocked),beforeApply);pass();

  check('PRIOR_SUCCESSFUL_ACK_AFTER_BLOCK_REPLAYS_WITHOUT_NEW_DRAFT');
  const before=scoped(legacyBlocked);assert.deepEqual(await ok(save(legacyBlocked,legacyKey)),oldReceipt);
  await denied(save(legacyBlocked,`ai-authority-new-${randomUUID()}`),'P0001','CONVERSATION_CLOSED');
  assert.deepEqual(scoped(legacyBlocked),before);pass();

  check('PERSISTED_BLOCK_REVIEW_AND_DIRECT_NEW_SAVE_DENY_WITH_NO_PARTIAL_ROWS');
  const blocked=await ready();await ok(turn(blocked,'BLOCK'));
  const blockedReview=await ok(review(blocked));assert.equal(blockedReview.safety,'BLOCK');assert.equal(blockedReview.canSaveDraft,false);
  assert.deepEqual(blockedReview.missingRequired,[]);
  const blockedBefore=scoped(blocked),blockedKey=`ai-authority-block-${randomUUID()}`;
  const allOwnerNeedsBefore=tableHash('public.needs',`requester_account_id=${lit(ownerId)}::uuid`);
  const ownerNeedCountBefore=sql(`select count(*) from public.needs where requester_account_id=${lit(ownerId)}::uuid`);
  for(let i=0;i<2;i++)await denied(save(blocked,blockedKey),'P0001','AI_NEED_DRAFT_BLOCKED');
  assert.deepEqual(scoped(blocked),blockedBefore);report.blocked_projection=blockedReview;
  assert.equal(tableHash('public.needs',`requester_account_id=${lit(ownerId)}::uuid`),allOwnerNeedsBefore,'no orphan Need can escape conversation-bound snapshot');
  assert.equal(sql(`select count(*) from public.needs where requester_account_id=${lit(ownerId)}::uuid`),ownerNeedCountBefore);
  report.blocked_all_owner_needs={before_count:Number(ownerNeedCountBefore),after_count:Number(ownerNeedCountBefore),before_hash:allOwnerNeedsBefore,after_hash:allOwnerNeedsBefore};
  pass();

  check('HUMAN_CONFIRM_CORRECT_CANNOT_ERASE_BLOCK_BUT_NEW_ALLOW_CAN_RECOVER');
  const countFact=blockedReview.facts.find(f=>f.key==='need.people_needed');
  await ok(owner.rpc('rpc_ai_correct_fact_v2',{p_fact_id:countFact.id,p_value:2,p_display_value:'2 osobe'}));
  await ok(owner.rpc('rpc_ai_confirm_fact',{p_fact_id:blockedReview.facts.find(f=>f.key==='need.title').id}));
  assert.equal((await ok(review(blocked))).safety,'BLOCK');
  await denied(save(blocked,blockedKey),'P0001','AI_NEED_DRAFT_BLOCKED');
  await ok(turn(blocked,'ALLOW'));
  assert.equal((await ok(review(blocked))).canSaveDraft,true);
  const recovered=await ok(save(blocked,blockedKey));
  assert.equal(sql(`select required_slots from public.needs where id=${lit(recovered.needId)}::uuid`),'2');
  assert.deepEqual(await ok(save(blocked,blockedKey)),recovered);pass();

  check('NULL_CANNOT_CLEAR_PRIOR_BLOCK_AND_UNSUPPORTED_SAFETY_CANNOT_PERSIST');
  const invalid=await ready();await ok(turn(invalid,'BLOCK'));await ok(turn(invalid,null));
  const invalidReview=await ok(review(invalid));assert.equal(invalidReview.safety,'BLOCK');assert.equal(invalidReview.canSaveDraft,false);
  const unchanged=scoped(invalid);
  await denied(turn(invalid,'UNSUPPORTED'),'22023','SAFETY_DECISION_INVALID');
  await denied(service.from('ai_messages').insert({account_id:ownerId,conversation_id:invalid,role:'ASSISTANT',body:'AI_AUTHORITY_INVALID_SAFETY',safety:'UNSUPPORTED'}),'23514');
  assert.deepEqual(scoped(invalid),unchanged);
  await denied(save(invalid,`ai-authority-null-${randomUUID()}`),'P0001','AI_NEED_DRAFT_BLOCKED');
  report.null_safety_semantics='Latest supported ASSISTANT decision is retained; no supported decision falls back to REVIEW. REVIEW permits a confirmed DRAFT, never publication.';pass();

  check('LATEST_BLOCK_AFTER_FIRST40_MESSAGES_IS_AUTHORITATIVE');
  const long=await ready();for(let i=0;i<20;i++)await ok(turn(long,'ALLOW'));await ok(turn(long,'BLOCK'));
  const messageCount=Number(sql(`select count(*) from public.ai_messages where conversation_id=${lit(long)}::uuid`));assert.ok(messageCount>40);
  const longReview=await ok(review(long));assert.equal(longReview.safety,'BLOCK');assert.equal(longReview.canSaveDraft,false);
  await denied(save(long,`ai-authority-long-${randomUUID()}`),'P0001','AI_NEED_DRAFT_BLOCKED');report.long_conversation_messages=messageCount;pass();

  check('ALLOW_CLARIFY_REVIEW_AND_NO_DECISION_KEEP_EXISTING_CONFIRMED_DRAFT_RULES');
  report.non_block_results=[];
  const empty=uuid(await ok(owner.rpc('rpc_ai_open_need_conversation_v2')));
  const emptyReview=await ok(review(empty));assert.equal(emptyReview.safety,'REVIEW');assert.equal(emptyReview.canSaveDraft,false);
  for(const safety of ['ALLOW','CLARIFY','REVIEW',null]){
    const conversation=await ready(safety),r=await ok(review(conversation));assert.equal(r.safety,safety??'REVIEW');assert.equal(r.canSaveDraft,true);
    const key=`ai-authority-allow-${randomUUID()}`,receipt=await ok(save(conversation,key));
    assert.equal(receipt.status,'DRAFT');assert.equal(receipt.revision,1);
    assert.deepEqual(await ok(save(conversation,key)),receipt);report.non_block_results.push({input_safety:safety,projection_safety:r.safety,status:receipt.status});
  }pass();

  check('AUTH_OTHER_ACCOUNT_DIRECT_DML_AND_SERVICE_BOUNDARIES_PRESERVED');
  await denied(review(invalid,outsider),'42501','NOT_OWNER');
  await denied(save(invalid,`ai-authority-other-${randomUUID()}`,outsider),'42501','NOT_OWNER');
  await denied(review(invalid,anon),'42501');await denied(save(invalid,`ai-authority-anon-${randomUUID()}`,anon),'42501');
  await denied(review(invalid,service),'28000','AUTH_REQUIRED');
  await denied(save(invalid,`ai-authority-service-${randomUUID()}`,service),'28000','AUTH_REQUIRED');
  await denied(owner.rpc('rpc_ai_apply_interview_turn_v2_service',{p_account_id:ownerId,p_conversation_id:invalid,p_user_message:'x',p_assistant_message:'x',p_safety:'ALLOW',p_proposals:[]}),'42501');
  await denied(owner.from('ai_messages').insert({account_id:ownerId,conversation_id:invalid,role:'ASSISTANT',body:'x',safety:'ALLOW'}),'42501');
  await denied(owner.from('ai_structured_facts').update({status:'CONFIRMED'}).eq('conversation_id',invalid),'42501');
  assert.equal((await ok(outsider.from('ai_messages').select('id').eq('conversation_id',invalid))).length,0);
  assert.equal((await ok(outsider.from('ai_structured_facts').select('id').eq('conversation_id',invalid))).length,0);pass();

  report.lock_interleavings=[];
  check('OBSERVED_BLOCK_WRITER_FIRST_FORCES_WAITING_SAVE_TO_DENY');
  const writerFirst=await ready();
  const holder=startTransaction('ai_auth_block_holder','service_role',blockSql(writerFirst),{sleep:6});await sleeping(holder.name);
  const waiter=startTransaction('ai_auth_save_waiter','authenticated',saveSql(writerFirst,`ai-authority-wait-${randomUUID()}`));
  const observed=await waiting(holder.name,waiter.name);
  assert.equal((await holder.completed).code,0);sqlDenied(await waiter.completed,'AI_NEED_DRAFT_BLOCKED');
  assert.equal(sql(`select count(*) from private.need_draft_save_commands where conversation_id=${lit(writerFirst)}::uuid`),'0');
  assert.equal((await ok(review(writerFirst))).safety,'BLOCK');
  report.lock_interleavings.push({case:'BLOCK_WRITER_THEN_SAVE',...observed,result:'AI_NEED_DRAFT_BLOCKED_NO_DRAFT'});pass();

  check('OBSERVED_SAVE_FIRST_PRESERVES_SUCCESS_AND_REJECTS_LATE_BLOCK_TURN');
  const saveFirst=await ready();const countBefore=sql(`select count(*) from public.ai_messages where conversation_id=${lit(saveFirst)}::uuid`);
  const saveHolder=startTransaction('ai_auth_save_holder','authenticated',saveSql(saveFirst,`ai-authority-first-${randomUUID()}`),{sleep:6});await sleeping(saveHolder.name);
  const blockWaiter=startTransaction('ai_auth_block_waiter','service_role',blockSql(saveFirst));
  const secondObserved=await waiting(saveHolder.name,blockWaiter.name);
  const saved=await saveHolder.completed;assert.equal(saved.code,0);assert.equal(wireJson(saved).status,'DRAFT');
  sqlDenied(await blockWaiter.completed,'CONVERSATION_CLOSED');
  assert.equal(sql(`select count(*) from public.ai_messages where conversation_id=${lit(saveFirst)}::uuid`),countBefore);
  report.lock_interleavings.push({case:'SAVE_THEN_LATE_BLOCK_WRITER',...secondObserved,result:'ONE_DRAFT_LATE_TURN_REJECTED'});pass();

  check('OBSERVED_BLOCK_WRITER_FORCES_REVIEW_TO_WAIT_FOR_COHERENT_SAFETY_AND_FACTS');
  const reviewRace=await ready();
  const reviewHolder=startTransaction('ai_auth_review_holder','service_role',blockSql(reviewRace),{sleep:6});await sleeping(reviewHolder.name);
  const reviewWaiter=startTransaction('ai_auth_review_waiter','authenticated',`select public.rpc_ai_need_review_v2(${lit(reviewRace)}::uuid)`);
  const reviewObserved=await waiting(reviewHolder.name,reviewWaiter.name);
  assert.equal((await reviewHolder.completed).code,0);const rr=await reviewWaiter.completed;assert.equal(rr.code,0);
  const projection=JSON.parse(rr.stdout.split(/\r?\n/).find(line=>line.startsWith('{')&&line.includes('"canSaveDraft"')));
  assert.equal(projection.safety,'BLOCK');assert.equal(projection.canSaveDraft,false);assert.deepEqual(projection.missingRequired,[]);
  report.lock_interleavings.push({case:'BLOCK_WRITER_THEN_REVIEW',...reviewObserved,result:'BLOCK_NOT_SAVEABLE_WITH_CONFIRMED_FACTS'});pass();

  check('OBSERVED_MATERIAL_PROPOSAL_WRITER_REVIEW_SEES_NEW_SAFETY_AND_PENDING_FACT');
  const factsRace=await ready();
  const pendingProposal=[{key:'need.people_needed',value:2,displayValue:'2 osobe',evidence:'Synthetic changed-count input',confidence:0.99}];
  const factsSql=`select public.rpc_ai_apply_interview_turn_v2_service(${lit(ownerId)}::uuid,${lit(factsRace)}::uuid,'AI_AUTHORITY_CHANGED_COUNT','AI_AUTHORITY_CLARIFICATION','CLARIFY',${lit(JSON.stringify(pendingProposal))}::jsonb)`;
  const factsHolder=startTransaction('ai_auth_facts_holder','service_role',factsSql,{sleep:6});await sleeping(factsHolder.name);
  const factsWaiter=startTransaction('ai_auth_facts_waiter','authenticated',`select public.rpc_ai_need_review_v2(${lit(factsRace)}::uuid)`);
  const factsObserved=await waiting(factsHolder.name,factsWaiter.name);
  assert.equal((await factsHolder.completed).code,0);const fr=await factsWaiter.completed;assert.equal(fr.code,0);
  const coherent=JSON.parse(fr.stdout.split(/\r?\n/).find(line=>line.startsWith('{')&&line.includes('"canSaveDraft"')));
  assert.equal(coherent.safety,'CLARIFY');assert.equal(coherent.canSaveDraft,false);
  assert.deepEqual(coherent.missingRequired,['need.people_needed']);
  const pendingPeople=coherent.facts.filter(f=>f.key==='need.people_needed');assert.equal(pendingPeople.length,1);
  assert.equal(pendingPeople[0].value,2);assert.equal(pendingPeople[0].status,'NEEDS_CONFIRMATION');
  report.lock_interleavings.push({case:'MATERIAL_WRITER_THEN_REVIEW',...factsObserved,result:'NEW_CLARIFY_AND_PENDING_FACT_IN_SAME_REVIEW'});pass();

  check('FINAL_EXACT_FUNCTIONS_ACLS_HISTORY_AND_NO_UNRELATED_EFFECTS');
  for(const [signature,digest] of Object.entries({...manifest.candidate_body_md5,...manifest.unchanged_body_md5}))
    assert.equal(sql(`select md5(prosrc) from pg_proc where oid=${lit(signature)}::regprocedure`),digest);
  assert.deepEqual(allFunctions(),unchangedFunctions);assert.equal(tableHash('private.need_fact_registry'),registry);
  assert.deepEqual(targetAuthority(),authorityBefore);report.target_authority_after=targetAuthority();
  assert.deepEqual(noEffects(),unaffected);
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${lit(manifest.forward_version)}`),history);
  assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${lit(manifest.forward_version)}`),manifest.md5);
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));assert.equal(report.migration_history_count,86);
  report.original85_full_history_unchanged=true;report.unchanged_writer_and_publish_functions=true;
  report.review_and_save_fingerprints=rows("select p.oid::regprocedure::text signature,md5(p.prosrc) body_md5,p.prosecdef,p.proconfig,p.proacl::text acl from pg_proc p where p.oid in ('public.rpc_ai_need_review_v2(uuid)'::regprocedure,'public.rpc_save_need_draft_from_review(uuid,uuid,text)'::regprocedure)");
  report.limitations=['No actual provider request or mobile/device execution.','Existing human fact-first then conversation lock versus writer/save conversation-first lock order is unchanged; global AI deadlock freedom is not claimed.','Edge still uses first40 transcript slice and has no durable turn request key.','Fallback REVIEW permits a confirmed DRAFT under existing semantics; this is not publication approval.'];
  pass();report.result='PASS';console.log('PASS AI_DRAFT_AUTHORITY');
}catch(error){report.result='FAIL';report.failed_check=current;console.error('FAIL AI_DRAFT_AUTHORITY',current,error.message);process.exitCode=1;}
finally{for(const child of active)if(child.exitCode===null)child.kill('SIGTERM');writeFileSync(`${out}/proof-report.json`,JSON.stringify(report,null,2)+'\n');}
