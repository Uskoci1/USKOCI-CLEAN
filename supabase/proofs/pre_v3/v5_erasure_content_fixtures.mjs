// Disposable PostgreSQL fixture rows, not production entrypoints or legal policy.
// Constraints, triggers, RLS authority and actual erasure RPCs remain enabled.
import {assert,sql,rows,q,randomUUID,ok} from './closure_runtime.mjs';

export async function seedContentCopies(a,canary){
 const cid=await ok(a.client.rpc('rpc_ai_open_need_conversation_v2'));
 const profile=rows(`select id from public.app_profiles where account_id=${q(a.id)}::uuid and kind='REQUESTER'`)[0].id;
 const needId=randomUUID(),reviewIds=[],workerReview=randomUUID(),factIds=Array.from({length:205},()=>randomUUID());
 const turnKey=randomUUID(),saveKey=randomUUID();
 const worker=await ok(a.client.rpc('rpc_open_worker_ai',{p_client_request_id:randomUUID()})),workerCid=worker.conversationId;
 sql(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,
  approximate_city,approximate_area,approximate_lat,approximate_lng,remaining_search_close_reason)
  values(${q(needId)},${q(a.id)},${q(profile)},'DRAFT',${q(canary)},${q(canary)},'PROOF','OFFERS',${q(canary)},${q(canary)},45.25,19.85,${q(canary)});
  insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng)
  values(${q(needId)},${q(canary)},${q(canary)},45.250001,19.850001);
  insert into public.ai_messages(account_id,conversation_id,role,body,safety) values(${q(a.id)},${q(cid)},'USER',${q(canary)},'ALLOW');
  insert into public.ai_action_proposals(account_id,conversation_id,action_kind,payload)
  values(${q(a.id)},${q(cid)},'DISPOSABLE_ERASURE_CANARY',jsonb_build_object('note',${q(canary)}));`);
 assert.equal(sql(`select approx_geog is not null from public.needs where id=${q(needId)}`),'t');
 // Reversed insertion order makes a referenced target precede its referrer by
 // physical ctid. The chain spans >2 batches, not just an implementation mirror.
 sql(`insert into public.ai_structured_facts(id,account_id,conversation_id,fact_key,fact_value,status,source,scope,display_value,evidence_excerpt,superseded_at,fact_schema_version)
  values ${factIds.map(id=>`(${q(id)},${q(a.id)},${q(cid)},'need.title',to_jsonb(${q(canary)}::text),'INFERRED','AI_INFERENCE','NEED_DRAFT',${q(canary)},${q(canary)},clock_timestamp(),'NEED_FACT_V2')`).join(',')};
  update public.ai_structured_facts f set superseded_by=x.target from (values ${factIds.slice(1).map((id,i)=>`(${q(id)}::uuid,${q(factIds[i])}::uuid)`).join(',')}) x(id,target) where f.id=x.id;
  insert into private.ai_need_turn_commands(account_id,conversation_id,client_request_id,request_hash,state,receipt)
  values(${q(a.id)},${q(cid)},${q(turnKey)},${q('1'.repeat(64))},'SUCCEEDED',jsonb_build_object('copy',${q(canary)}));`);
 for(const state of ['ACCEPTED','EVALUATED','PUBLISHED']){
  const id=randomUUID();reviewIds.push(id);
  sql(`insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at)
   values(${q(id)},${q(a.id)},${q(cid)},${q(profile)},${q('2'.repeat(64))},'{}',jsonb_build_object('privateCopy',${q(canary)}),clock_timestamp()+interval '1 hour');
   insert into private.ai_task_review_commands(review_id,account_id,client_request_id,need_id,need_revision,state,evaluation,published)
   values(${q(id)},${q(a.id)},${q(randomUUID())},${q(needId)},1,${q(state)},
    ${state==='ACCEPTED'?'null':`jsonb_build_object('privateCopy',${q(canary)})`},${state==='PUBLISHED'?`jsonb_build_object('privateCopy',${q(canary)})`:'null'});`);
 }
 sql(`update private.worker_ai_sessions set candidate=jsonb_build_object('bio',${q(canary)}) where conversation_id=${q(workerCid)};
  insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,base_hash,envelope,expires_at)
  values(${q(workerReview)},${q(a.id)},${q(workerCid)},0,${q('4'.repeat(64))},jsonb_build_object('bio',${q(canary)}),clock_timestamp()+interval '1 hour');
  insert into private.worker_ai_saves(review_id,account_id,client_request_id,receipt)
  values(${q(workerReview)},${q(a.id)},${q(saveKey)},jsonb_build_object('bio',${q(canary)}));`);
 return {cid,workerCid,needId,reviewIds,workerReview,turnKey,factCount:factIds.length};
}

export function assertContentCopiesErased(a,f){
 for(const table of ['public.ai_structured_facts','public.ai_messages','public.ai_action_proposals'])
  assert.equal(sql(`select count(*) from ${table} where account_id=${q(a.id)}::uuid`),'0',table);
 assert.equal(sql(`select count(*) from public.need_sensitive where need_id=${q(f.needId)}::uuid`),'0');
 assert.deepEqual(rows(`select title,description,approximate_city,approximate_area,approximate_lat,approximate_lng,
  approx_geog,remaining_search_close_reason from public.needs where id=${q(f.needId)}::uuid`),[{
  title:'Obrisan zadatak',description:'Sadržaj uklonjen pri zatvaranju naloga.',approximate_city:'',approximate_area:'',
  approximate_lat:null,approximate_lng:null,approx_geog:null,remaining_search_close_reason:null}]);
 for(const id of f.reviewIds){
  assert.deepEqual(rows(`select envelope from private.ai_task_reviews where id=${q(id)}`),[{envelope:{erasedBy:'AF-D22'}}]);
  const c=rows(`select state,evaluation,published from private.ai_task_review_commands where review_id=${q(id)}`)[0];
  assert.deepEqual(c.evaluation,c.state==='ACCEPTED'?null:{erasedBy:'AF-D22'});
  assert.deepEqual(c.published,c.state==='PUBLISHED'?{erasedBy:'AF-D22'}:null);
 }
 assert.deepEqual(rows(`select receipt from private.ai_need_turn_commands where account_id=${q(a.id)} and client_request_id=${q(f.turnKey)}`),[{receipt:{erasedBy:'AF-D22'}}]);
 assert.deepEqual(rows(`select candidate from private.worker_ai_sessions where conversation_id=${q(f.workerCid)}`),[{candidate:{erasedBy:'AF-D22'}}]);
 assert.deepEqual(rows(`select envelope from private.worker_ai_reviews where id=${q(f.workerReview)}`),[{envelope:{erasedBy:'AF-D22'}}]);
 assert.deepEqual(rows(`select receipt from private.worker_ai_saves where review_id=${q(f.workerReview)}`),[{receipt:{erasedBy:'AF-D22'}}]);
}

export function seedVerifiedExport(a,canary){
 // Reuses an existing predecessor policy ID only to satisfy the historical FK.
 // Does not activate it or claim that this synthetic snapshot was policy-approved.
 const policy=rows('select id from private.retention_policy_sets order by published_at,id limit 1')[0];
 assert.ok(policy,'PREDECESSOR_DISPOSABLE_POLICY_REFERENCE_REQUIRED');
 const requestId=randomUUID(),assetId=randomUUID(),path=`${a.id}/${requestId}/${assetId}.json`,text=JSON.stringify({privateCopy:canary});
 sql(`insert into public.data_export_requests(id,account_id,client_request_id,status,completed_at,export_attempt_count)
  values(${q(requestId)},${q(a.id)},${q(randomUUID())},'READY',clock_timestamp(),1);
  insert into private.data_export_artifacts(id,receipt_id,account_id,attempt_number,policy_id,policy_sha256,policy_binding,snapshot_text,
   byte_length,sha256,md5,object_path,lease_until,artifact_expires_at,snapshot_expires_at,cleanup_not_before,verified_at)
  values(${q(assetId)},${q(requestId)},${q(a.id)},1,${q(policy.id)},${q('5'.repeat(64))},'{}',${q(text)},octet_length(${q(text)}),
   encode(extensions.digest(convert_to(${q(text)},'UTF8'),'sha256'),'hex'),md5(${q(text)}),${q(path)},
   clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 hour',clock_timestamp());
  update public.data_export_requests set active_export_attempt_id=${q(assetId)} where id=${q(requestId)};`);
 return {requestId,assetId,path,text};
}
