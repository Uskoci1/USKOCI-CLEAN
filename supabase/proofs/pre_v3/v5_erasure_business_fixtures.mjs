// Disposable fixtures only; closure_runtime rejects non-loopback targets.
// The Task inserts and Q&A READY decisions below are explicitly privileged
// test seeds, never claimed to be approved publication/classification journeys.
// Agreement selection/change/completion use real Auth RPCs; all constraints and
// triggers remain enabled. No policy, provider flag or budget ledger is changed.
import {assert,sql,rows,q,randomUUID,ok,actor} from './closure_runtime.mjs';

const rowHash=(table,where)=>sql(`select encode(extensions.digest(convert_to(to_jsonb(t)::text,'UTF8'),'sha256'),'hex') from ${table} t where ${where}`);
const qaDecision=id=>rows(`select * from private.preselection_qa_policy_decisions where id=${q(id)}::uuid`)[0];
const qaCommand=id=>rows(`select * from private.qa_ai_commands where id=${q(id)}::uuid`)[0];
const versions=id=>rows(`select * from public.agreement_versions where agreement_id=${q(id)}::uuid order by version`);
const proposal=id=>rows(`select * from public.agreement_change_proposals where id=${q(id)}::uuid`)[0];
const erased={erasedBy:'AF-D22'};

async function requesterProfile(a){
 const p=await ok(a.client.rpc('rpc_get_requester_profile_for_edit',{}));
 await ok(a.client.rpc('rpc_save_requester_profile',{p_expected_revision:p.revision,p_display_name:'Disposable146 requester',p_client_request_id:randomUUID()}));
 const result=rows(`select id from public.app_profiles where account_id=${q(a.id)}::uuid and kind='REQUESTER'`);
 assert.equal(result.length,1);return result[0].id;
}
function publishedNeed(a,profileId,label){
 const id=randomUUID();
 // task_country_code/task_timezone writes need the confirmed-review region token (W02 guard),
 // exactly as the qa_classifier, qa_owner_activation and unknown_ai_turn_exit proofs publish theirs.
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);select set_config('uskoci.need_region','CONFIRMED_REVIEW',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
   approximate_city,approximate_area,mode,execution_location_mode,task_country_code,task_timezone,required_slots,schedule_kind,response_deadline,published_at)
  values(${q(id)}::uuid,${q(a.id)}::uuid,${q(profileId)}::uuid,'PUBLISHED',${q(label)},'Disposable146 privileged Task seed',
   'PROOF','Novi Sad','Liman','OFFERS','REMOTE','RS','Europe/Belgrade',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
 return id;
}
async function completeWorker(a){
 const p=await ok(a.client.rpc('rpc_get_worker_profile_for_edit',{}));
 await ok(a.client.from('app_profiles').update({display_name:'Disposable146 Worker A',skills:['Proof']}).eq('id',p.id));
 const location=await ok(a.client.rpc('rpc_get_worker_location',{}));
 await ok(a.client.rpc('rpc_save_worker_location',{p_expected_revision:location.revision,p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85}},p_confirmed:true}));
 await ok(a.client.rpc('rpc_complete_worker_profile',{p_profile_id:p.id}));return p.id;
}

export async function seedBusinessCopies(a,b,canary){
 assert.notEqual(a.id,b.id);assert.ok(typeof canary==='string'&&canary.length>0&&canary.length<350);
 const scopeA=canary+' / Worker A original scope',scopeB='Worker-independent B scope '+randomUUID();
 const reasonPriceB='B price reason '+randomUUID(),reasonScopeB='B changed scope reason '+randomUUID();
 const workerProfileId=await completeWorker(a),requesterProfileId=await requesterProfile(b);
 const needId=publishedNeed(b,requesterProfileId,'Disposable146 Agreement field lineage');
 const response=await ok(a.client.rpc('rpc_submit_response',{p_need_id:needId,p_need_revision:1,p_worker_profile_id:workerProfileId,p_covered_slots:1,
  p_price_rsd:3123,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:scopeA,p_client_request_id:randomUUID()}));
 const agreementId=await ok(b.client.rpc('rpc_select_response',{p_need_id:needId,p_need_revision:response.needRevision,p_response_id:response.responseId,
  p_response_version:response.version,p_content_hash:response.contentHash,p_client_request_id:randomUUID()}));
 const priceProposalId=await ok(b.client.rpc('rpc_propose_agreement_change_v2',{p_agreement_id:agreementId,p_expected_version:1,
  p_patch:{price_rsd:4123},p_reason:reasonPriceB,p_client_request_id:randomUUID()}));
 assert.equal((await ok(a.client.rpc('rpc_respond_agreement_change',{p_proposal_id:priceProposalId,p_accept:true}))).agreementVersion,2);
 const scopeProposalId=await ok(b.client.rpc('rpc_propose_agreement_change_v2',{p_agreement_id:agreementId,p_expected_version:2,
  p_patch:{scope_note:scopeB},p_reason:reasonScopeB,p_client_request_id:randomUUID()}));
 assert.equal((await ok(a.client.rpc('rpc_respond_agreement_change',{p_proposal_id:scopeProposalId,p_accept:true}))).agreementVersion,3);
 const beforeVersions=versions(agreementId),beforePrice=proposal(priceProposalId),beforeScope=proposal(scopeProposalId);
 assert.deepEqual(beforeVersions.map(v=>v.terms.scope_note),[scopeA,scopeA,scopeB]);
 assert.deepEqual(beforeVersions.map(v=>v.terms.price_rsd),[3123,4123,4123]);
 assert.equal(beforePrice.proposed_by_account_id,b.id);assert.equal(beforePrice.proposed_terms.scope_note,scopeA);
 assert.equal(beforeScope.proposed_by_account_id,b.id);assert.equal(beforeScope.proposed_terms.scope_note,scopeB);
 assert.deepEqual(rows(`select version,private.closure_erasure_scope_author_v5(agreement_id,version) author
  from public.agreement_versions where agreement_id=${q(agreementId)}::uuid order by version`),[{version:1,author:a.id},{version:2,author:a.id},{version:3,author:b.id}]);
 await ok(a.client.rpc('rpc_mark_work_done',{p_agreement_id:agreementId}));
 await ok(b.client.rpc('rpc_confirm_completion',{p_agreement_id:agreementId}));
 assert.equal(sql(`select status='COMPLETED' and current_version=3 from public.agreements where id=${q(agreementId)}::uuid`),'t');
 assert.equal(sql(`select status='COMPLETED' from public.needs where id=${q(needId)}::uuid`),'t');
 assert.equal(sql(`select private.closure_erasure_agreement_protected_v5(${q(agreementId)}::uuid)`),'f');

 // A third real account owns this Task: policy-decision attribution must follow
 // the exact A/B command references, not accidentally succeed by Task ownership.
 const qaOwner=await actor('erasure146-qa-source-owner'),qaProfile=await requesterProfile(qaOwner);
 const qaNeedId=publishedNeed(qaOwner,qaProfile,'Disposable146 shared decision source');
 const policy=rows(`select id,policy_id,version,jurisdiction from private.publication_policy_bundles
  where policy_id='PRESELECTION_QA_V1' and jurisdiction='RS' order by version,id limit 1`)[0];
 assert.ok(policy,'EXISTING_DISPOSABLE_QA_POLICY_FK_REQUIRED');
 const policyBefore=rowHash('private.publication_policy_bundles',`id=${q(policy.id)}::uuid`);
 const uniqueDecisionId=randomUUID(),sharedDecisionId=randomUUID(),uniqueCommandId=randomUUID(),sharedACommandId=randomUUID(),sharedBCommandId=randomUUID();
 const uniqueText=canary+' / unique A question',sharedText=canary+' / shared decision question';
 const decisionSeeds=[{id:uniqueDecisionId,text:uniqueText},{id:sharedDecisionId,text:sharedText}];
 const commandSeeds=[{id:uniqueCommandId,account:a.id,decision:uniqueDecisionId,text:uniqueText},
  {id:sharedACommandId,account:a.id,decision:sharedDecisionId,text:sharedText},{id:sharedBCommandId,account:b.id,decision:sharedDecisionId,text:sharedText}];
 sql(`begin;
  ${decisionSeeds.map(x=>`insert into private.preselection_qa_policy_decisions(id,subject_kind,need_id,need_revision,question_id,
   content_fingerprint,policy_bundle_id,policy_id,policy_version,jurisdiction,rule_ids,rule_provenance_snapshot,outcome,decision_source,service_provenance,decision_identity)
   values(${q(x.id)}::uuid,'QUESTION',${q(qaNeedId)}::uuid,1,null,
    private.ru4b_content_fingerprint('QUESTION',${q(qaNeedId)}::uuid,1,null,${q(x.text)}),${q(policy.id)}::uuid,${q(policy.policy_id)},${policy.version},${q(policy.jurisdiction)},
    (select array_agg(rule_id order by rule_id) from private.publication_policy_rule_refs where bundle_id=${q(policy.id)}::uuid),'[]','ALLOW','DISPOSABLE146_NOT_CLASSIFIED',
    jsonb_build_object('disposableFixture',true,'sourceHash',${q(x.text)}),encode(extensions.digest(convert_to(${q(x.id)},'UTF8'),'sha256'),'hex'));`).join('\n')}
  ${commandSeeds.map(x=>`insert into private.qa_ai_commands(id,account_id,client_request_id,command_type,need_id,need_revision,question_id,text_sha256,
   request_hash,content_fingerprint,source_hash,policy_bundle_id,policy_hash,state,provider_dispatched,outcome,rule_ids,policy_decision_id)
   select ${q(x.id)}::uuid,${q(x.account)}::uuid,${q(randomUUID())}::uuid,'ASK',${q(qaNeedId)}::uuid,1,null,
    encode(extensions.digest(convert_to(${q(x.text)},'UTF8'),'sha256'),'hex'),
    private.qa_ai_input_hash('ASK',${q(qaNeedId)}::uuid,1,null,encode(extensions.digest(convert_to(${q(x.text)},'UTF8'),'sha256'),'hex')),
    d.content_fingerprint,encode(extensions.digest(convert_to(${q(x.id)},'UTF8'),'sha256'),'hex'),d.policy_bundle_id,${q('d'.repeat(64))},'READY',false,'ALLOW',d.rule_ids,d.id
   from private.preselection_qa_policy_decisions d where d.id=${q(x.decision)}::uuid;`).join('\n')}
  commit;`);
 assert.equal(rowHash('private.publication_policy_bundles',`id=${q(policy.id)}::uuid`),policyBefore);
 await ok(qaOwner.client.rpc('rpc_cancel_need',{p_need_id:qaNeedId,p_need_revision:1,p_reason:'Disposable146 terminal QA context'}));
 const uniqueBefore=qaDecision(uniqueDecisionId),sharedBefore=qaDecision(sharedDecisionId),peerCommandBefore=qaCommand(sharedBCommandId);
 const ownerCommandsBefore=[uniqueCommandId,sharedACommandId].map(qaCommand);
 for(const c of [...ownerCommandsBefore,peerCommandBefore]){assert.equal(c.state,'READY');assert.equal(c.receipt,null);assert.equal(c.provider_dispatched,false);}
 assert.equal(uniqueBefore.question_id,null);assert.equal(sharedBefore.question_id,null);
 assert.equal(sql(`select count(*) from private.qa_ai_commands where policy_decision_id=${q(uniqueDecisionId)}::uuid`),'1');
 assert.equal(sql(`select count(distinct account_id) from private.qa_ai_commands where policy_decision_id=${q(sharedDecisionId)}::uuid`),'2');
 assert.equal(sql(`select cardinality(private.closure_erasure_hard_blockers_v5(${q(a.id)}::uuid))`),'0');
 assert.equal(sql(`select cardinality(private.closure_erasure_hard_blockers_v5(${q(b.id)}::uuid))`),'0');
 const exceptions=JSON.parse(sql(`select to_jsonb(private.closure_erasure_exceptions_v5(${q(a.id)}::uuid))`));
 assert.ok(exceptions.includes('SHARED_DECISION_REVIEW_REQUIRED'));
 return {fixtureKind:'PRIVILEGED_TASK_AND_QA_SEEDS_REAL_AGREEMENT_RPCS',agreementId,agreementVersion:3,needId,responseId:response.responseId,
  requesterAccountId:b.id,workerAccountId:a.id,priceProposalId,scopeProposalId,scopeA,scopeB,reasonPriceB,reasonScopeB,
  beforeVersions:versions(agreementId),beforePrice:proposal(priceProposalId),beforeScope:proposal(scopeProposalId),
  ownerNeedBefore:rowHash('public.needs',`id=${q(needId)}::uuid`),qaOwnerId:qaOwner.id,qaNeedId,
  qaNeedBefore:rowHash('public.needs',`id=${q(qaNeedId)}::uuid`),uniqueDecisionId,sharedDecisionId,uniqueCommandId,sharedACommandId,sharedBCommandId,
  uniqueBefore,sharedBefore,peerCommandBefore,ownerCommandsBefore,policyId:policy.id,policyBefore};
}

export function assertBusinessCopiesAfterOwner(a,b,f){
 const vs=versions(f.agreementId),price=proposal(f.priceProposalId),scope=proposal(f.scopeProposalId);
 assert.deepEqual(vs.map(v=>v.terms.scope_note),['','',f.scopeB]);
 assert.deepEqual(vs.map(v=>v.terms.price_rsd),[3123,4123,4123]);
 for(let i=0;i<2;i++){
  assert.deepEqual(vs[i].terms,{...f.beforeVersions[i].terms,scope_note:''});
  assert.notEqual(vs[i].content_hash,f.beforeVersions[i].content_hash);
 }
 assert.deepEqual(vs[2],f.beforeVersions[2]);
 assert.equal(price.proposed_terms.scope_note,'');assert.equal(price.reason,f.reasonPriceB);assert.equal(price.proposed_by_account_id,b.id);
 assert.deepEqual(scope,f.beforeScope);
 assert.equal(sql(`select scope_note='' from public.marketplace_responses where id=${q(f.responseId)}::uuid`),'t');
 assert.equal(sql(`select bool_and(scope_note='') from public.marketplace_response_versions where response_id=${q(f.responseId)}::uuid`),'t');
 assert.equal(rowHash('public.needs',`id=${q(f.needId)}::uuid`),f.ownerNeedBefore);
 const attribution=rows(`select source_kind,source_id,scope_author from private.closure_scope_sources_v5
  where account_id=${q(a.id)}::uuid and agreement_id=${q(f.agreementId)}::uuid order by source_kind,source_id`);
 const expected=[['VERSION','1',a.id],['VERSION','2',a.id],['VERSION','3',b.id],['PROPOSAL',f.priceProposalId,a.id],['PROPOSAL',f.scopeProposalId,b.id]]
  .map(([source_kind,source_id,scope_author])=>({source_kind,source_id,scope_author})).sort((x,y)=>(x.source_kind+x.source_id).localeCompare(y.source_kind+y.source_id));
 assert.deepEqual(attribution,expected);
 const unique=qaDecision(f.uniqueDecisionId);assert.deepEqual(unique.service_provenance,erased);assert.notEqual(unique.content_fingerprint,f.uniqueBefore.content_fingerprint);
 assert.deepEqual(qaDecision(f.sharedDecisionId),f.sharedBefore,'shared decision remains byte-equivalent while B still owns an unsettled copy');
 assert.deepEqual(qaCommand(f.sharedBCommandId),f.peerCommandBefore,'A closure must not rewrite B command/READY result');
 for(const [id,decision] of [[f.uniqueCommandId,f.uniqueDecisionId],[f.sharedACommandId,f.sharedDecisionId]]){
  const c=qaCommand(id);assert.equal(c.account_id,a.id);assert.equal(c.policy_decision_id,decision);assert.equal(c.state,'READY');assert.equal(c.receipt,null);assert.equal(c.provider_dispatched,false);
  const prior=f.ownerCommandsBefore.find(x=>x.id===id);assert.ok(prior);
  for(const key of ['text_sha256','request_hash','content_fingerprint','source_hash'])assert.notEqual(c[key],prior[key],key);
 }
 assert.equal(rowHash('public.needs',`id=${q(f.qaNeedId)}::uuid`),f.qaNeedBefore);
 assert.equal(rowHash('private.publication_policy_bundles',`id=${q(f.policyId)}::uuid`),f.policyBefore);
}

export function assertBusinessCopiesAfterBoth(a,b,f){
 assert.equal(sql(`select exists(select 1 from private.closure_executions_v5 e join private.closure_actions_v5 ac on ac.generation=e.generation
  where e.account_id=${q(a.id)}::uuid and ac.kind='RELATIONAL_REDACT' and ac.state='VERIFIED')`),'t');
 assert.deepEqual(versions(f.agreementId).map(v=>v.terms.scope_note),['','','']);
 for(const id of [f.priceProposalId,f.scopeProposalId]){
  const p=proposal(id);assert.equal(p.proposed_terms.scope_note,'');assert.equal(p.reason,'Sadržaj uklonjen pri zatvaranju naloga.');assert.equal(p.proposed_by_account_id,b.id);
 }
 const shared=qaDecision(f.sharedDecisionId);assert.deepEqual(shared.service_provenance,erased);assert.notEqual(shared.content_fingerprint,f.sharedBefore.content_fingerprint);
 assert.deepEqual(qaDecision(f.uniqueDecisionId).service_provenance,erased);
 const peer=qaCommand(f.sharedBCommandId);assert.equal(peer.account_id,b.id);assert.equal(peer.policy_decision_id,f.sharedDecisionId);assert.equal(peer.state,'READY');assert.equal(peer.receipt,null);
 assert.equal(rowHash('public.needs',`id=${q(f.qaNeedId)}::uuid`),f.qaNeedBefore);
 assert.equal(rowHash('private.publication_policy_bundles',`id=${q(f.policyId)}::uuid`),f.policyBefore);
}
