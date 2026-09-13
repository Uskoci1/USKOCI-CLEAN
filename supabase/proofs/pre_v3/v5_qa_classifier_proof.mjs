// Actual disposable Auth/RPC/SQL authority. Only Gemini's response is synthetic.
// The policy activation and budget reset are labelled disposable fixtures.
import {createHash} from 'node:crypto';
import {assert,rows,sql,prove,pass,apply,login,need,actor,requester,anon,service,ok,denied,requesterId,randomUUID,q,lockedRace,env} from './closure_runtime.mjs';
import {renderQaPolicyCandidate} from '../../../scripts/render-qa-policy-bundle.mjs';
import {loadQaClassifierHandler} from '../ai/qa_classifier_edge_runtime.mjs';
const hash=s=>createHash('sha256').update(s.trim()).digest('hex');
const input=(a,n,text='Da li postoji lift?',qid=null,key=randomUUID())=>({p_account_id:a.id,p_type:qid?'ANSWER':'ASK',p_need_id:n,p_need_revision:1,p_question_id:qid,p_text:text,p_client_request_id:key});
const owner={id:requesterId,client:requester};
const clientArgs=i=>{const {p_account_id,...rest}=i;return {...rest,p_expected_user_id:p_account_id};};
const cancelArgs=i=>{const {p_text,...rest}=clientArgs(i);return {...rest,p_text_sha256:hash(p_text)};};
const claim=i=>ok(service.rpc('rpc_claim_qa_classification_service',i));
const dispatchArgs=(i,c)=>({p_account_id:i.p_account_id,p_need_id:i.p_need_id,p_client_request_id:i.p_client_request_id,p_attempt_id:c.claim.attemptId});
const dispatch=(i,c)=>ok(service.rpc('rpc_dispatch_qa_classification_service',dispatchArgs(i,c)));
const output=(i,material=false)=>({outcome:material?'CLARIFY':'ALLOW',materiality:i.p_type==='ASK'?null:material?'MATERIAL':'NON_MATERIAL',ruleIds:[material?'QA-MATERIAL-CHANGE':'QA-SAFE-CLARIFICATION'],safeReasonCodes:[material?'TASK_TERMS_CHANGE':'SAFE_PUBLIC_CLARIFICATION']});
const complete=(i,c,o=output(i))=>ok(service.rpc('rpc_complete_qa_classification_service',{...dispatchArgs(i,c),p_output:o}));
const read=(a,i)=>ok(a.client.rpc('rpc_read_qa_classification',{p_expected_user_id:a.id,p_need_id:i.p_need_id,p_client_request_id:i.p_client_request_id}));
const cancel=(a,i)=>ok(a.client.rpc('rpc_cancel_qa_classification',cancelArgs(i)));
const submit=(a,i)=>ok(a.client.rpc('rpc_submit_classified_preselection_qa',clientArgs(i)));
const asActor=a=>`select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claim.role','authenticated',true);`;
const sqlWrite=(a,i,cancelled)=>`${asActor(a)}select public.${cancelled?'rpc_cancel_qa_classification':'rpc_submit_classified_preselection_qa'}(${q(a.id)}::uuid,${q(i.p_type)},${q(i.p_need_id)}::uuid,1,${i.p_question_id?q(i.p_question_id)+'::uuid':'null'},${q(cancelled?hash(i.p_text):i.p_text)},${q(i.p_client_request_id)}::uuid)`;
async function worker(label){const a=await actor(label);sql(`insert into public.app_profiles(account_id,kind,display_name,profile_status) values(${q(a.id)}::uuid,'WORKER','Disposable classifier worker','ACTIVE') on conflict(account_id,kind) do update set profile_status='ACTIVE'`);return a;}
const questionCount=n=>Number(sql(`select count(*) from private.preselection_qa_questions where need_id=${q(n)}::uuid`));
async function ready(i){const c=await claim(i);assert.ok(c.claim);assert.equal(await dispatch(i,c),true);assert.equal((await complete(i,c)).state,'READY');return c;}

await prove('V5_DURABLE_QA_CLASSIFIER','v5-qa-classifier-report.json',async report=>{
 await apply(report,'20260913000144_clean_v5_qa_classifier_authority.sql',134);await login();
 const a=await worker('qa135-a'),b=await worker('qa135-b'),n=need('QA135 canonical'),first=input(a,n);
 assert.equal((await read(a,first)).state,'ABSENT');
 for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},'private.qa_ai_commands','SELECT,INSERT,UPDATE,DELETE')`),'f');
 await denied(anon.rpc('rpc_read_qa_classification',{p_expected_user_id:a.id,p_need_id:n,p_client_request_id:first.p_client_request_id}));
 await denied(b.client.rpc('rpc_read_qa_classification',{p_expected_user_id:a.id,p_need_id:n,p_client_request_id:first.p_client_request_id}),'AUTH_CONTEXT_CHANGED');
 await denied(service.rpc('rpc_claim_qa_classification_service',first),'PRESELECTION_QA_POLICY_NOT_READY');
 assert.equal(sql('select count(*) from private.qa_ai_commands'),'0');
 sql(renderQaPolicyCandidate());const bundle=sql("select id from private.publication_policy_bundles where policy_id='PRESELECTION_QA_V1' and jurisdiction='RS' and version=1");
 assert.equal(sql(`select is_active or is_reviewed from private.publication_policy_bundles where id=${q(bundle)}::uuid`),'f');
 await denied(service.rpc('rpc_claim_qa_classification_service',first),'PRESELECTION_QA_POLICY_NOT_READY');
 pass(report,'PRIVATE_METADATA_OWNED_ABSENT_NO_GRANTS_PREPARED_POLICY_INACTIVE_AND_UNREVIEWED');
 // Activate exact owner-rule artifact only inside the disposable database.
 sql(`update private.publication_policy_bundles set is_reviewed=true,is_active=true,reviewed_at=clock_timestamp(),activated_at=clock_timestamp(),review_provenance=review_provenance||'{"disposable135Fixture":true}'::jsonb where id=${q(bundle)}::uuid`);
 report.policyFixture='PREPARED_OWNER_RULES_DISPOSABLE_REVIEW_ACTIVATION_NOT_LIVE';
 try{
  await denied(service.rpc('rpc_claim_qa_classification_service',input(a,n,'Kontakt: private@example.com')));
  const c=await claim(first);assert.ok(c.claim);assert.equal(c.claim.context.publicTask.title,'PRE-V3 QA135 canonical');
  assert.equal((await claim(first)).claim,null);await denied(service.rpc('rpc_claim_qa_classification_service',{...first,p_text:'Changed body'}),'IDEMPOTENCY_KEY_REUSED');
  assert.equal(await ok(service.rpc('rpc_dispatch_qa_classification_service',{...dispatchArgs(first,c),p_attempt_id:randomUUID()})),false);
  assert.equal(await dispatch(first,c),true);assert.equal(await dispatch(first,c),false);
  sql(`update private.qa_ai_commands set lease_expires_at=clock_timestamp()-interval '1 second' where id=${q(c.status.classificationId)}::uuid`);
  assert.equal((await claim(first)).claim,null);assert.equal((await complete(first,c)).state,'STALE');assert.equal(questionCount(n),0);
  pass(report,'DETERMINISTIC_FLOOR_EXACT_KEY_HASH_ONE_DISPATCH_EXPIRED_LEASE_NO_RECLAIM_NO_PUBLIC_WRITE');

  const tomb=input(a,n,'Opaque tombstone');const late=await lockedRace(sqlWrite(a,tomb,true),()=>claim(tomb));assert.equal(late.status.state,'CANCELLED');assert.equal(late.claim,null);
  const pending=input(a,n,'Cancellation after dispatch'),pc=await claim(pending);assert.equal(await dispatch(pending,pc),true);
  assert.equal((await lockedRace(sqlWrite(a,pending,true),()=>complete(pending,pc))).state,'CANCELLED');
  assert.equal((await submit(a,pending)).state,'CANCELLED');assert.equal((await claim(pending)).claim,null);
  assert.equal(sql(`select provider_dispatched from private.qa_ai_commands where id=${q(pc.status.classificationId)}::uuid`),'t');assert.equal(questionCount(n),0);
  pass(report,'OBSERVED_ABSENT_CANCEL_VS_CLAIM_AND_POSTDISPATCH_CANCEL_VS_COMPLETE_NO_RESURRECTION');

  const selected=input(a,n,'Da li zgrada ima lift?');await ready(selected);
  const won=await lockedRace(sqlWrite(a,selected,false),()=>cancel(a,selected));assert.equal(won.state,'COMMITTED');const qid=won.receipt.questionId;
  assert.equal((await submit(a,selected)).receipt.questionId,qid);assert.equal(questionCount(n),1);
  assert.equal(sql(`select count(*) from public.user_activity_events where entity_id=${q(qid)}::uuid`),'1');
  const original=await ok(a.client.rpc('rpc_read_preselection_qa_command',{p_expected_user_id:a.id,p_need_id:n,p_client_request_id:selected.p_client_request_id}));assert.equal(original.command.receipt.questionId,qid);
  const cancelled=input(b,n,'Cancel already reviewed');await ready(cancelled);
  assert.equal((await lockedRace(sqlWrite(b,cancelled,true),()=>submit(b,cancelled))).state,'CANCELLED');assert.equal(questionCount(n),1);
  await denied(b.client.rpc('rpc_ru4b_ask_preselection_question',{p_need_id:n,p_expected_revision:1,p_question_text:cancelled.p_text,p_request_id:cancelled.p_client_request_id}),'PRESELECTION_QA_POLICY_NOT_READY');
  pass(report,'OBSERVED_SUBMIT_CANCEL_BOTH_ORDERS_CANONICAL_RECEIPT_WINS_ONE_QUESTION_EVENT_CANCELLED_DECISION_NOT_REUSABLE');

  const answer=input(owner,n,'Da, postoji lift.',qid);await ready(answer);
  const competing=input(owner,n,'Lift je dostupan.',qid);await ready(competing);
  const publicAnswer=await submit(owner,answer);assert.equal(publicAnswer.state,'COMMITTED');assert.equal(publicAnswer.receipt.answerVersion,1);
  assert.equal((await submit(owner,competing)).state,'STALE');assert.equal(sql(`select count(*) from private.preselection_qa_answer_versions where question_id=${q(qid)}::uuid`),'1');
  const material=input(owner,n,'Menjam cenu na 9000 dinara.',qid),mc=await claim(material);assert.equal(await dispatch(material,mc),true);
  const before=sql(`select private.need_edit_base_marker(${q(n)}::uuid)`),agreements=sql('select count(*) from public.agreements');
  const mr=await complete(material,mc,output(material,true));assert.equal(mr.state,'REJECTED');assert.equal(mr.materiality,'MATERIAL');assert.equal((await submit(owner,material)).state,'REJECTED');
  assert.equal(sql(`select private.need_edit_base_marker(${q(n)}::uuid)`),before);assert.equal(sql('select count(*) from public.agreements'),agreements);
  const feed=await ok(b.client.rpc('rpc_ru4b_public_preselection_qa',{p_need_id:n}));assert.ok(!JSON.stringify(feed).includes(a.id));
  pass(report,'ANSWER_SINGLE_VERSION_COMPETING_REVIEW_STALE_MATERIAL_TASK_EDIT_ONLY_AGREEMENTS_UNCHANGED');

  const limitActor=await worker('qa135-final-rate'),i1=input(limitActor,n,'First prepared question'),i2=input(limitActor,n,'Second prepared question');await ready(i1);await ready(i2);
  assert.equal((await submit(limitActor,i1)).state,'COMMITTED');const limited=await submit(limitActor,i2);assert.equal(limited.state,'REJECTED');assert.deepEqual(limited.safeReasonCodes,['QA_ASK_COOLDOWN']);
  const drift=input(b,n,'Policy source drift'),dc=await claim(drift);assert.equal(await dispatch(drift,dc),true);
  sql(`update private.publication_policy_bundles set is_active=false where id=${q(bundle)}::uuid`);assert.equal((await complete(drift,dc)).state,'STALE');
  sql(`update private.publication_policy_bundles set is_active=true where id=${q(bundle)}::uuid`);
  pass(report,'FINAL_CANONICAL_RATE_RECHECK_CHANGED_POLICY_SOURCE_REJECT_WITHOUT_SECOND_PROVIDER');

  const ea=await worker('qa135-edge'),en=need('QA135 Edge'),ei=input(ea,en,'Da li je ulaz pristupacan?');
  sql(`insert into public.need_geography(need_id,public_topology) values(${q(en)}::uuid,'{"mode":"STATIONARY","start":{"city":"Novi Sad","area":"Liman"}}'::jsonb) on conflict(need_id) do update set public_topology=excluded.public_topology`);
  const token=(await ok(ea.client.auth.getSession())).session.access_token,origin=new URL(env.RU5_DEVICE_SUPABASE_URL).origin;
  // Save/restore the exhausted predecessor budget fixture; no real spend exists.
  const savedBudget=rows('select * from private.ai_test_budget_v5')[0],savedReservations=rows('select * from private.ai_test_reservations_v5');
  sql(`delete from private.ai_test_reservations_v5;update private.ai_test_budget_v5 set reserved_microusd=0,enabled=true;insert into private.ai_test_accounts_v5(account_id) values(${q(ea.id)}::uuid)`);
  let providerCalls=0;
  try{
   const e={SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,AI_PROVIDER:'gemini',GEMINI_API_KEY:'SYNTHETIC_NO_SECRET',GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',USKOCI_QA_CLASSIFIER_ENABLED:'true'};
   const runtime=loadQaClassifierHandler({env:name=>e[name],fetch:async(request,init={})=>{
    const target=new URL(String(request));if(target.hostname==='generativelanguage.googleapis.com'){
     providerCalls++;const command=await read(ea,ei);assert.equal(command.state,'PROCESSING');assert.equal(sql(`select provider_dispatched from private.qa_ai_commands where id=${q(command.classificationId)}::uuid`),'t');
     for(const secret of [ea.id,en,ei.p_client_request_id,'sourceHash','policyHash'])assert.ok(!String(init.body).includes(secret));
     return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output(ei))}]}}]}),{headers:{'Content-Type':'application/json'}});
    }
    assert.equal(target.origin,origin);assert.ok(target.pathname==='/auth/v1/user'||target.pathname.startsWith('/rest/v1/'));return fetch(request,init);
   }});
   const invoke=()=>runtime.handler(new Request('https://synthetic-handler.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({type:'ASK',needId:en,needRevision:1,questionId:null,text:ei.p_text,clientRequestId:ei.p_client_request_id})}));
   const r=await invoke();assert.equal(r.status,200);const receipt=await r.json();assert.equal(receipt.state,'COMMITTED');assert.deepEqual(await read(ea,ei),receipt);
   assert.deepEqual(await(await invoke()).json(),receipt);assert.equal(providerCalls,1);assert.equal(questionCount(en),1);
   assert.equal(sql('select reserved_microusd from private.ai_test_budget_v5'),'250000');assert.equal(sql('select count(*) from private.ai_test_reservations_v5'),'1');report.actualEdgeSourceHashes=runtime.sourceHashes;
  }finally{sql(`delete from private.ai_test_reservations_v5;insert into private.ai_test_reservations_v5 select * from jsonb_populate_recordset(null::private.ai_test_reservations_v5,${q(JSON.stringify(savedReservations))}::jsonb);update private.ai_test_budget_v5 set enabled=${savedBudget.enabled},reserved_microusd=${savedBudget.reserved_microusd};delete from private.ai_test_accounts_v5 where account_id=${q(ea.id)}::uuid`);}
  pass(report,'LATEST_ACTUAL_HANDLER_AUTH_SQL_CLAIM_DISPATCH_BUDGET_CANONICAL_WRITE_RECOVERY_ONE_SYNTHETIC_GEMINI');
 }finally{sql(`update private.publication_policy_bundles set is_active=false where id=${q(bundle)}::uuid`);}
 assert.equal(sql("select 'private.qa_ai_commands'=any(relations) from private.closure_dataset_catalog_v5 where data_class='COMMAND_LEDGERS'"),'t');
 assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'),'t');
 pass(report,'POLICY_FIXTURE_DEACTIVATED_CLOSURE_METADATA_INVENTORY_EXACT_NO_LIVE_ACTIVATION');
});
