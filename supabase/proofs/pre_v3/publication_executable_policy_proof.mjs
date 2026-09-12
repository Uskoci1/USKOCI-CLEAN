import {assert,rows,sql,prove,pass,apply,login,requester,service,ok,rp,requesterId,randomUUID,q} from './closure_runtime.mjs';
import {migrationSnapshotQuery} from './history_snapshot.mjs';
import {locationCases,syntheticNonlocationFacts} from '../policy/publication_fixtures.mjs';

await prove('PRE_V3_PUBLICATION_EXECUTABLE_POLICY','publication-executable-policy-report.json',async report=>{
  await apply(report,'20260912194000_clean_pre_v3_publication_executable_policy.sql',124);
  await login();
  const history=rows(migrationSnapshotQuery());assert.equal(history.length,125);report.historyCount=125;
  const bundle=rows("select id,review_provenance from private.publication_policy_bundles where policy_id='RS_PUBLICATION_POLICY_MINIMUM' and jurisdiction='RS' and version=1")[0];
  const doc=rows(`select private.publication_policy_document(${q(bundle.id)}::uuid) document`)[0].document;
  assert.equal(doc.schemaVersion,'USKOCI_PUBLICATION_POLICY_V1');assert.equal(doc.rules.length,16);
  assert.match(bundle.review_provenance.evaluatorContentSha256,/^[0-9a-f]{64}$/);
  const r1=doc.rules.find(r=>r.ruleId==='RS-MIN-001');assert.deepEqual(r1.outcomes,['ALLOW']);assert.deepEqual(r1.safeReasonCodes,['CLEAR_CONCRETE_TASK']);
  const r15=doc.rules.find(r=>r.ruleId==='RS-MIN-015');assert.deepEqual(r15.outcomes,[]);assert.deepEqual(r15.safeReasonCodes,[]);
  assert.equal(bundle.review_provenance.legal_certification,false);
  pass(report,'EXECUTABLE_POLICY_DOCUMENT_EXACTLY_BOUND_TO_OWNER_APPROVED_SIXTEEN_RULE_MINIMUM');

  const conversationId=await ok(requester.rpc('rpc_ai_open_need_conversation_v2'));
  const loc=locationCases.find(x=>x.id==='route-complete-reordered').value;
  const review0=await ok(requester.rpc('rpc_get_need_location_review',{p_conversation_id:conversationId}));
  const locationSaved=await ok(requester.rpc('rpc_save_need_location_review',{p_conversation_id:conversationId,p_expected_revision:review0.revision,p_confirmed:true,p_value:loc}));
  assert.equal(locationSaved.saved,true);
  // W03 deliberately revoked the historical direct apply RPC. Exercise the
  // current leased claim -> complete service authority exactly as production Edge does.
  const turnKey=randomUUID();
  const userMessage='Treba mi neko sutra da prenese ormar iz sobe u kombi.';
  const proposals=syntheticNonlocationFacts.map(([key,value])=>({key,value,displayValue:typeof value==='object'?JSON.stringify(value):String(value),evidence:'Disposable owner-policy proof',confidence:1}));
  const claimed=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{
    p_account_id:requesterId,p_conversation_id:conversationId,p_client_request_id:turnKey,p_user_message:userMessage
  }));
  assert.equal(claimed.turn.state,'PROCESSING');assert.ok(claimed.claim?.attemptId);
  const completed=await ok(service.rpc('rpc_ai_complete_need_turn_v2_service',{
    p_account_id:requesterId,p_conversation_id:conversationId,p_client_request_id:turnKey,p_attempt_id:claimed.claim.attemptId,
    p_user_message:userMessage,p_assistant_message:'Razumem. Proverite podatke pre čuvanja.',p_safety:'ALLOW',p_proposals:proposals
  }));
  assert.equal(completed.state,'SUCCEEDED');assert.equal(completed.receipt.proposedCount,proposals.length);
  let review=await ok(requester.rpc('rpc_ai_need_review_v2',{p_conversation_id:conversationId}));
  for(const fact of review.facts) if(fact.status!=='CONFIRMED') await ok(requester.rpc('rpc_ai_confirm_fact',{p_fact_id:fact.id}));
  review=await ok(requester.rpc('rpc_ai_need_review_v2',{p_conversation_id:conversationId}));
  assert.ok(review.facts.every(f=>f.status==='CONFIRMED'));
  const saved=await ok(requester.rpc('rpc_save_need_draft_from_review',{p_conversation_id:conversationId,p_requester_profile_id:rp,p_client_request_id:'policy-draft-'+randomUUID()}));
  assert.equal(saved.status,'DRAFT');assert.equal(saved.authoritative,true);
  const need=rows(`select id,revision,status,task_country_code from public.needs where id=${q(saved.needId)}::uuid`)[0];
  assert.equal(need.status,'DRAFT');assert.equal(need.task_country_code,'RS');
  const context=await ok(requester.rpc('rpc_get_need_publication_context',{p_need_id:need.id,p_expected_revision:need.revision}));
  assert.equal(context.kind,'READY');assert.equal(context.authoritativeDecision,false);assert.equal(context.location.complete,true);
  assert.equal(context.binding.policyBundleId,bundle.id);assert.equal(context.binding.policyId,'RS_PUBLICATION_POLICY_MINIMUM');assert.equal(context.binding.policyVersion,1);assert.equal(context.binding.jurisdiction,'RS');
  assert.equal(context.policy.schemaVersion,'USKOCI_PUBLICATION_POLICY_V1');assert.equal(context.policy.rules.length,16);
  assert.ok(!JSON.stringify(context.publicNeed).includes('exactAddress'));assert.ok(!JSON.stringify(context.publicNeed).includes('accessNotes'));
  pass(report,'ACTUAL_AUTH_AI_REVIEW_LOCATION_CONFIRMATION_DRAFT_PRODUCES_READY_OWNER_POLICY_CONTEXT_WITHOUT_PRIVATE_LOCATION_LEAK');

  const decision=await ok(service.rpc('rpc_record_need_publication_decision_service',{
    p_need_id:need.id,p_expected_revision:need.revision,p_policy_id:'RS_PUBLICATION_POLICY_MINIMUM',p_jurisdiction:'RS',
    p_outcome:'ALLOW',p_rule_ids:['RS-MIN-001'],p_decision_source:'PUBLICATION_EVALUATOR_V1',
    p_safe_reason_codes:['CLEAR_CONCRETE_TASK'],p_provider_ref:'DISPOSABLE_OWNER_POLICY_PROOF',p_model_ref:'NO_REAL_PROVIDER_CALLED',
    p_reviewer_provenance:{},p_service_provenance:{evaluationContext:context.binding}
  }));
  assert.equal(decision.outcome,'ALLOW');assert.equal(decision.publishable,true);assert.equal(decision.authoritative,true);
  assert.equal(decision.policyBundleId,bundle.id);assert.equal(decision.needId,need.id);assert.equal(decision.needRevision,need.revision);
  const published=await ok(requester.rpc('rpc_publish_need_canonical',{
    p_need_id:need.id,p_expected_revision:need.revision,p_decision_sequence:decision.decisionSequence,
    p_response_deadline:null,p_client_request_id:'policy-publish-'+randomUUID()
  }));
  assert.equal(published.status,'PUBLISHED');assert.equal(published.authoritative,true);
  assert.equal(sql(`select status from public.needs where id=${q(need.id)}::uuid`),'PUBLISHED');
  pass(report,'OWNER_APPROVED_RS_MINIMUM_ACCEPTS_CLEAR_TASK_DECISION_AND_CANONICAL_PUBLISH_PATH');

  const stored=rows(`select outcome,rule_ids,safe_reason_codes,provider_ref,model_ref from private.need_publication_decisions where need_id=${q(need.id)}::uuid order by decision_sequence`);
  assert.equal(stored.length,1);assert.deepEqual(stored[0].rule_ids,['RS-MIN-001']);assert.deepEqual(stored[0].safe_reason_codes,['CLEAR_CONCRETE_TASK']);
  assert.equal(stored[0].provider_ref,'DISPOSABLE_OWNER_POLICY_PROOF');
  assert.deepEqual(rows(migrationSnapshotQuery()),history);
  report.actualAuth=true;report.actualDatabase=true;report.actualClientAuthority=true;report.realProviderCalled=false;
  report.limitations=['Decision content is deterministic disposable proof input, not a real OpenAI publication evaluator response.','Exact Edge evaluator transport remains separately tested; production provider configuration must be proven after rollout.','Owner product-policy approval is not external legal certification.'];
});
