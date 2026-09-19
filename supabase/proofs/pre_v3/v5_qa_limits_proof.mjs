// Real disposable SQL/Auth proof. All accepted-content authority rows below
// are conspicuously synthetic fixtures; no classifier or paid provider is used.
import {assert,rows,sql,prove,pass,apply,login,need,actor,requester,anon,service,ok,denied,requesterId,randomUUID,q,lockedRace} from './closure_runtime.mjs';
const check=(a,n,text,subject='QUESTION',qid=null)=>service.rpc('rpc_check_preselection_qa_limits_service',{p_actor_account_id:a,p_subject_kind:subject,p_need_id:n,p_need_revision:1,p_question_id:qid,p_text:text});
const ask=(a,n,text,key=randomUUID())=>a.client.rpc('rpc_ru4b_ask_preselection_question',{p_need_id:n,p_expected_revision:1,p_question_text:text,p_request_id:key});
async function worker(label){
 const a=await actor(label),p=await ok(a.client.rpc('rpc_get_worker_profile_for_edit',{}));
 await ok(a.client.from('app_profiles').update({display_name:'Disposable QA worker',skills:['Proof']}).eq('id',p.id));
 const location=await ok(a.client.rpc('rpc_get_worker_location',{}));
 await ok(a.client.rpc('rpc_save_worker_location',{p_expected_revision:location.revision,p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85}},p_confirmed:true}));
 await ok(a.client.rpc('rpc_complete_worker_profile',{p_profile_id:p.id}));return a;
}
const fixture=(a,n,text,age='2 hours')=>`insert into private.preselection_qa_questions(need_id,need_revision,asker_account_id,question_text,question_fingerprint,created_at) values(${q(n)}::uuid,1,${q(a)}::uuid,${q(text)},${q('a'.repeat(64))},clock_timestamp()-interval ${q(age)})`;
await prove('V5_APPROVED_QA_LIMITS','v5-qa-limits-report.json',async report=>{
 await apply(report,'20260913000109_clean_v5_approved_qa_limits.sql',133);await login();
 report.policyFixture='SYNTHETIC_DISPOSABLE_EXACT_CONTENT_ALLOW_NOT_PROVIDER_OR_RELEASE_APPROVAL';
 const a=await worker('qa134-a'),b=await worker('qa134-b'),n=need('QA numeric'),n2=need('QA second task');
 const c=await ok(a.client.rpc('rpc_read_preselection_qa_context',{p_expected_user_id:a.id,p_need_id:n}));assert.equal(c.canAsk,true);assert.equal(c.questionMaxChars,500);assert.equal(c.answerMaxChars,1000);assert.equal(c.ratePolicyState,'READY');
 const signature='public.rpc_check_preselection_qa_limits_service(uuid,text,uuid,integer,uuid,text)';
 for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE')`),'f');assert.equal(sql(`select has_function_privilege('service_role',${q(signature)},'EXECUTE')`),'t');
 await denied(anon.rpc('rpc_check_preselection_qa_limits_service',{p_actor_account_id:a.id,p_subject_kind:'QUESTION',p_need_id:n,p_need_revision:1,p_question_id:null,p_text:'Test'}));
 assert.equal((await ok(check(a.id,n,'č'.repeat(500)))).ready,true);await denied(check(a.id,n,'č'.repeat(501)),'QA_QUESTION_TOO_LONG');
 await denied(ask(a,n,'No exact classifier decision exists'),'PRESELECTION_QA_POLICY_NOT_READY');
 assert.equal(sql(`select count(*) from private.preselection_qa_questions where asker_account_id=${q(a.id)}::uuid`),'0');
 await denied(check(requesterId,n,'Own question'),'REQUESTER_CANNOT_ASK_OWN_TASK');
 pass(report,'APPROVED_CHARACTER_LIMITS_UNICODE_SERVICE_ONLY_PREFLIGHT_NO_QUOTA_OR_ALLOW_CREATED');

 const bundle=randomUUID(),policy='DISPOSABLE_QA_134_'+randomUUID(),rule='DISPOSABLE-QA-ONLY';
 sql(`insert into private.publication_policy_bundles(id,policy_id,version,jurisdiction,is_reviewed,is_complete,is_active,reviewed_at,activated_at,review_provenance)
 values(${q(bundle)}::uuid,${q(policy)},1,'RS',true,true,true,clock_timestamp(),clock_timestamp(),'{"syntheticDisposable134":true}');
 insert into private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance) values(${q(bundle)}::uuid,${q(rule)},'{"syntheticDisposable134":true}');`);
 const allow=(id,text)=>sql(`insert into private.preselection_qa_policy_decisions(subject_kind,need_id,need_revision,content_fingerprint,policy_bundle_id,policy_id,policy_version,jurisdiction,rule_ids,rule_provenance_snapshot,outcome,decision_source,service_provenance,decision_identity)
 values('QUESTION',${q(id)}::uuid,1,private.ru4b_content_fingerprint('QUESTION',${q(id)}::uuid,1,null,${q(text)}),${q(bundle)}::uuid,${q(policy)},1,'RS',array[${q(rule)}],'[]','ALLOW','DISPOSABLE_134_SQL','{"synthetic":true}',encode(extensions.digest(convert_to(${q(randomUUID())},'UTF8'),'sha256'),'hex'))`);
 try{
  const text='Da li postoji lift?',key=randomUUID();allow(n,text);
  const first=await Promise.all([ok(ask(a,n,text,key)),ok(ask(a,n,text,key))]);assert.equal(first[0].questionId,first[1].questionId);
  assert.equal(sql(`select count(*) from private.preselection_qa_questions where asker_account_id=${q(a.id)}::uuid`),'1');
  await denied(ask(a,n,'Sledeće pitanje'),'QA_ASK_COOLDOWN');
  await denied(ask(a,n,'Changed content',key),'IDEMPOTENCY_KEY_REUSED');
  await denied(check(b.id,n,'  DA   LI POSTOJI LIFT? '),'QA_DUPLICATE_QUESTION');
  assert.equal((await ok(check(b.id,n2,text))).ready,true);
  await denied(requester.rpc('rpc_ru4b_answer_preselection_question',{p_question_id:first[0].questionId,p_answer_text:'č'.repeat(1001),p_request_id:randomUUID()}),'QA_ANSWER_TOO_LONG');
  assert.equal((await ok(check(requesterId,n,'č'.repeat(1000),'ANSWER',first[0].questionId))).ready,true);
  pass(report,'REAL_CANONICAL_SAME_KEY_CONCURRENCY_ONE_QUESTION_COOLDOWN_NORMALIZED_DUPLICATE_CROSS_ACCOUNT_ANSWER_LIMIT');

  const taskActor=await worker('qa134-task'),accountActor=await worker('qa134-account');
  for(let i=0;i<3;i++)sql(fixture(taskActor.id,n,`Task window fixture ${i}`));
  await denied(check(taskActor.id,n,'Fourth task question'),'QA_TASK_DAILY_LIMIT');
  for(let i=0;i<10;i++)sql(fixture(accountActor.id,n2,`Account window fixture ${i}`));
  await denied(check(accountActor.id,n,'Eleventh account question'),'QA_ACCOUNT_DAILY_LIMIT');
  sql(`update private.preselection_qa_questions set created_at=clock_timestamp()-interval '25 hours' where asker_account_id in(${q(taskActor.id)}::uuid,${q(accountActor.id)}::uuid)`);
  assert.equal((await ok(check(taskActor.id,n,'Fresh task window'))).ready,true);assert.equal((await ok(check(accountActor.id,n,'Fresh account window'))).ready,true);
  for(let i=0;i<9;i++)sql(fixture(a.id,n2,`Replay quota fixture ${i}`));
  const count=sql(`select count(*) from private.preselection_qa_questions where asker_account_id=${q(a.id)}::uuid`);
  assert.equal(count,'10');assert.equal((await ok(ask(a,n,text,key))).idempotentReplay,true);
  assert.equal(sql(`select count(*) from private.preselection_qa_questions where asker_account_id=${q(a.id)}::uuid`),count);
  pass(report,'ROLLING_ACCOUNT_TEN_TASK_THREE_EXPIRED_ROWS_EXCLUDED_REPLAY_STILL_SUCCEEDS_WITHOUT_COUNT');

  const race=await worker('qa134-race');for(let i=0;i<9;i++)sql(fixture(race.id,n2,`Race quota fixture ${i}`));
  await denied(lockedRace(`select pg_advisory_xact_lock(hashtextextended('uskoci:qa-rate-v5:'||${q(race.id)},9134));${fixture(race.id,n2,'Race tenth')}`,()=>check(race.id,n,'Concurrent eleventh')),'QA_ACCOUNT_DAILY_LIMIT');
  const dupText='Concurrent duplicate question';
  await denied(lockedRace(`select pg_advisory_xact_lock(hashtextextended('uskoci:qa-duplicate-v5:'||${q(n)}||':1',9135));${fixture(a.id,n,dupText)}`,()=>check(b.id,n,dupText.toUpperCase())),'QA_DUPLICATE_QUESTION');
  const cross=await worker('qa134-cross'),left='Parallel question A',right='Parallel question B';allow(n2,left);allow(n2,right);
  const outcomes=await Promise.all([ask(cross,n2,left),ask(cross,n2,right)]);assert.equal(outcomes.filter(x=>!x.error).length,1);assert.equal(outcomes.find(x=>x.error).error.message,'QA_ASK_COOLDOWN');
  assert.equal(sql(`select count(*) from private.preselection_qa_questions where asker_account_id=${q(cross.id)}::uuid`),'1');
  pass(report,'OBSERVED_SQL_LOCK_RACES_RECHECK_COMMITTED_COUNTS_AND_DUPLICATES_DIFFERENT_KEYS_ADMIT_ONE');
 }finally{sql(`update private.publication_policy_bundles set is_active=false where id=${q(bundle)}::uuid`);}
 assert.equal(sql(`select is_active from private.publication_policy_bundles where id=${q(bundle)}::uuid`),'f');
 pass(report,'SYNTHETIC_POLICY_DEACTIVATED_NO_PRODUCTION_AUTHORITY_OR_PROVIDER_USED');
});
