// Exact-source local Auth/Postgres plus unchanged production review client.
// Publication fixtures are SQL-only; no live/provider/device claim.
import {assert,randomUUID,env,sha,q,sql,rows,ok,denied,requester,worker,anon,requesterId,workerId,
 login,actor,apply,prove,pass,agreement,wp,prefs,lockedRace} from './closure_runtime.mjs';
import {loadPreV3Clients} from './client_runtime.mjs';
const same=x=>JSON.parse(JSON.stringify(x));
const accepted=async p=>{const r=await p;assert.equal(r.ok,true,r.kod);return r.podatak;};
const args=(id,target=workerId,rating=5,tags=['RELIABLE'],key=randomUUID())=>({p_agreement_id:id,p_target_account_id:target,p_rating:rating,p_tags:tags,p_client_request_id:key});
const receive=(p,client=requester)=>client.rpc('rpc_submit_agreement_review',p);
const reviewEvents=id=>rows(`select * from public.user_activity_events where entity_id=${q(id)}::uuid and event_type='REVIEW_RECEIVED' order by id`);
const reviews=id=>rows(`select * from private.agreement_reviews where agreement_id=${q(id)}::uuid order by id`);
async function complete(label){const a=await agreement(label);await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:a.id}));
 await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:a.id}));return a;}
await prove('PRE_V3_REVIEWS_AUTHORITY','reviews-authority-report.json',async report=>{
 await apply(report,'20260912100000_clean_pre_v3_reviews_authority.sql',119);await login();
 for(const [c,id] of [[requester,requesterId],[worker,workerId]]) for(const role of ['REQUESTER','WORKER'])
  await prefs(c,id,role,{in_app_enabled:true,push_enabled:true,dogovor_enabled:true,quiet_hours_enabled:false});
 const stranger=await actor('review-outsider');
 let session={user:{id:requesterId},accountRevision:1},loseAck=false,switchAfter=false;
 const transport={rpc:async(name,input)=>{const r=await requester.rpc(name,input);
  if(name==='rpc_submit_agreement_review'&&loseAck){loseAck=false;throw new Error('DISPOSABLE_LOST_ACK');}
  if(switchAfter){switchAfter=false;session={user:{id:workerId},accountRevision:session.accountRevision+1};}return r;}};
 const loader=loadPreV3Clients({sourceSha:sha,client:()=>transport,session:()=>session});
 const module=loader.load('src/data/reviewsClientService.ts'),client=module.reviewsClientService;
 const newAccount=await ok(stranger.client.rpc('rpc_get_account_reputation',{p_account_id:stranger.id}));
 assert.equal(newAccount.reviewCount,0);assert.equal(newAccount.averageRating,null);assert.equal(newAccount.state,'NO_REVIEWS');
 assert.equal(module.accountReputationLabel(newAccount),'Još nema ocena');
 const freshIdentity=await ok(stranger.client.rpc('rpc_get_requester_profile_for_edit',{}));
 const freshPublic=await ok(requester.rpc('rpc_get_public_profile',{p_profile_id:freshIdentity.profileId}));
 assert.equal(freshPublic.trust.reviewCount,0);assert.equal(freshPublic.trust.ratingAverage,null);
 assert.equal(freshPublic.trust.reviewsAvailable,true);assert.equal(freshPublic.trust.ratingAvailable,false);
 const active=await agreement('review active');
 assert.equal((await accepted(client.context(active.id))).eligible,false);
 await denied(receive(args(active.id)),'REVIEW_NOT_COMPLETED');
 await denied(receive(args(active.id,requesterId)),'REVIEW_INPUT_INVALID');
 await denied(receive(args(active.id,stranger.id)),'REVIEW_NOT_ALLOWED');
 await denied(receive(args(active.id),stranger.client),'REVIEW_NOT_ALLOWED');
 await denied(stranger.client.rpc('rpc_get_my_agreement_review',{p_agreement_id:active.id}),'REVIEW_NOT_ALLOWED');
 await denied(receive(args(active.id),anon));
 assert.equal(reviews(active.id).length,0);assert.equal(reviewEvents(active.id).length,0);
 pass(report,'EMPTY_ACCOUNT_NOT_ZERO_RATING_COMPLETED_ONLY_SELF_OUTSIDER_WRONG_TARGET_AND_ANON_DENIAL');

 const first=await complete('bilateral review');
 const input={agreementId:first.id,targetAccountId:workerId,rating:5,tags:['RELIABLE','ON_TIME'],clientRequestId:randomUUID()};
 loseAck=true;assert.equal((await client.submit(input)).kod,'REVIEW_OUTCOME_UNKNOWN');
 const recovered=await accepted(client.context(first.id));assert.equal(recovered.eligible,false);assert.equal(recovered.review.clientRequestId,input.clientRequestId);
 const receipt=await accepted(client.submit({...input,tags:['ON_TIME','RELIABLE']}));assert.equal(receipt.idempotentReplay,true);
 assert.equal(receipt.reviewId,recovered.review.reviewId);assert.equal(reviews(first.id).length,1);assert.equal(reviewEvents(first.id).length,1);
 await denied(receive(args(first.id,workerId,4,['ON_TIME','RELIABLE'],input.clientRequestId)),'REQUEST_ID_REUSED');
 await denied(receive(args(active.id,workerId,5,['ON_TIME','RELIABLE'],input.clientRequestId)),'REQUEST_ID_REUSED');
 await denied(receive(args(first.id,workerId,5,['ON_TIME','RELIABLE'])),'REVIEW_ALREADY_SUBMITTED');
 await denied(receive(args(first.id,workerId,1,[])),'REVIEW_ALREADY_SUBMITTED');
 const workerBefore=await ok(worker.rpc('rpc_get_my_agreement_review',{p_agreement_id:first.id}));
 assert.equal(workerBefore.review,null);assert.equal(workerBefore.eligible,true);
 assert.equal(Object.keys(workerBefore).some(x=>/reciprocal|counterpartReviewed|peerReview/i.test(x)),false);
 const back=await ok(receive(args(first.id,requesterId,4,[]),worker));assert.notEqual(back.reviewId,receipt.reviewId);
 assert.equal(reviews(first.id).length,2);assert.equal(reviewEvents(first.id).length,2);
 const one=reviewEvents(first.id).find(e=>e.recipient_user_id===workerId);
 assert.deepEqual(one.payload,{});assert.equal(one.entity_type,'AGREEMENT');assert.equal(one.recipient_role,'WORKER');
 assert.equal(sql(`select count(*) from public.user_activity_events where dedupe_key=${q('agreement-review:'+receipt.reviewId)}`),'1');
 await prefs(worker,workerId,'WORKER',{in_app_enabled:true,dogovor_enabled:true});
 const inbox=await ok(worker.rpc('rpc_list_inbox',{p_role:'WORKER',p_limit:100}));
 const item=inbox.items.find(x=>x.id===one.id);assert.ok(item);assert.equal(item.family,'dogovor');
 assert.equal(JSON.stringify(item).includes('RELIABLE'),false);assert.equal(JSON.stringify(item).includes('ON_TIME'),false);
 assert.deepEqual(await ok(worker.rpc('rpc_resolve_activity_event',{p_event_id:one.id})),{kind:'AGREEMENT',id:first.id,role:'WORKER'});
 await denied(requester.rpc('rpc_resolve_activity_event',{p_event_id:one.id}),'EVENT_NOT_FOUND');
 assert.throws(()=>sql(`update private.agreement_reviews set rating=1 where id=${q(receipt.reviewId)}::uuid`),/REVIEW_IMMUTABLE/);
 assert.throws(()=>sql(`delete from private.agreement_reviews where id=${q(receipt.reviewId)}::uuid`),/REVIEW_IMMUTABLE/);
 assert.equal(reviews(first.id).find(r=>r.id===receipt.reviewId).rating,5);
 pass(report,'ACTUAL_CLIENT_LOST_ACK_READBACK_IMMUTABLE_KEYED_REPLAY_BILATERAL_ONCE_EVENT_SAFE_INBOX_AND_TARGET');

 // Same two real accounts use the opposite product intents. Prepare only the
 // second worker through its existing single-authority profile/location/availability RPCs.
 const aw=await ok(requester.rpc('rpc_get_worker_profile_for_edit',{}));
 await ok(requester.from('app_profiles').update({display_name:'Dual role review proof',skills:['Proof'],tools:['ProofTool']}).eq('id',aw.id));
 const location=await ok(requester.rpc('rpc_get_worker_location',{}));
 await ok(requester.rpc('rpc_save_worker_location',{p_expected_revision:location.revision,p_confirmed:true,
  p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:50,approximatePosition:{latitude:45.25,longitude:19.83}}}));
 const available=await ok(requester.rpc('rpc_get_worker_availability',{}));
 await ok(requester.rpc('rpc_save_worker_availability',{p_expected_revision:available.revision,
  p_value:{timezone:'Europe/Belgrade',availableNow:true,rules:[],windows:[]}}));
 await ok(requester.rpc('rpc_complete_worker_profile',{p_profile_id:aw.id}));
 const br=await ok(worker.rpc('rpc_get_requester_profile_for_edit',{}));const reverseNeed=randomUUID();
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
 values(${q(reverseNeed)}::uuid,${q(workerId)}::uuid,${q(br.profileId)}::uuid,'PUBLISHED','Review reverse role','Disposable SQL fixture','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
 const app=await ok(requester.rpc('rpc_submit_response',{p_need_id:reverseNeed,p_need_revision:1,p_worker_profile_id:aw.id,p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:randomUUID()}));
 const reverse=await ok(worker.rpc('rpc_select_response',{p_need_id:reverseNeed,p_need_revision:app.needRevision,p_response_id:app.responseId,p_response_version:app.version,p_content_hash:app.contentHash,p_client_request_id:randomUUID()}));
 await ok(requester.rpc('rpc_mark_work_done',{p_agreement_id:reverse}));await ok(worker.rpc('rpc_confirm_completion',{p_agreement_id:reverse}));
 await ok(receive(args(reverse,requesterId,2,[]),worker));await ok(receive(args(reverse,workerId,3,[])));
 const ar=await accepted(client.reputation(requesterId)),bw=await accepted(client.reputation(workerId));
 assert.equal(ar.reviewCount,2);assert.equal(ar.averageRating,3);assert.equal(bw.reviewCount,2);assert.equal(bw.averageRating,4);
 const asWorker=await ok(requester.rpc('rpc_get_public_profile',{p_profile_id:wp}));
 const asRequester=await ok(requester.rpc('rpc_get_public_profile',{p_profile_id:br.profileId}));
 for(const p of [asWorker,asRequester]){assert.equal(p.trust.ratingAverage,4);assert.equal(p.trust.reviewCount,2);assert.equal(p.trust.reviewsAvailable,true);}
 pass(report,'ONE_ACCOUNT_REPUTATION_ACROSS_BOTH_ACTUAL_PRODUCT_ROLES_AND_EXISTING_PUBLIC_PROFILE_PROJECTIONS');

 const invalid=await complete('hostile review');
 for(const value of [0,6,1.5,null,'4',true,{},[],1e20]) await denied(receive(args(invalid.id,workerId,value,[])),'REVIEW_INPUT_INVALID');
 for(const value of [null,{},'RELIABLE',['INVALID'],[null],[3],['RELIABLE','RELIABLE'],['RELIABLE','ON_TIME','CAREFUL','RESPECTFUL'],[['CAREFUL']]])
  await denied(receive(args(invalid.id,workerId,5,value)),'REVIEW_TAGS_INVALID');
 assert.equal(reviews(invalid.id).length,0);assert.equal(reviewEvents(invalid.id).length,0);
 const racing=await Promise.all([2,4].map(v=>receive(args(invalid.id,workerId,v,[]))));
 assert.equal(racing.filter(r=>!r.error).length,1);assert.equal(racing.find(r=>r.error).error.message,'REVIEW_ALREADY_SUBMITTED');
 assert.equal(reviews(invalid.id).length,1);assert.equal(reviewEvents(invalid.id).length,1);
 const duplicate=await complete('same key concurrent review'),duplicateArgs=args(duplicate.id);
 const replayRace=await Promise.all([receive(duplicateArgs),receive(duplicateArgs)]);
 assert.ok(replayRace.every(r=>!r.error));assert.equal(replayRace[0].data.reviewId,replayRace[1].data.reviewId);
 assert.deepEqual(replayRace.map(r=>r.data.idempotentReplay).sort(),[false,true]);
 assert.equal(reviewEvents(duplicate.id).length,1);
 const expected=rows(`select count(*)::integer n,round(avg(rating),2)::float8 average from private.agreement_reviews where target_account_id=${q(workerId)}::uuid`)[0];
 const current=await accepted(client.reputation(workerId));assert.equal(current.reviewCount,expected.n);assert.equal(current.averageRating,expected.average);
 assert.deepEqual(same(await accepted(client.reputation(workerId))),same(current));
 pass(report,'HOSTILE_JSON_NUMERIC_AND_TAG_TYPES_SECOND_REVIEW_CONCURRENT_DUPLICATE_AND_DETERMINISTIC_AGGREGATE');

 const blocked=await complete('review remains available after safety block');
 const blockState=await ok(requester.rpc('rpc_get_account_block',{p_target_account_id:workerId}));
 const statement=`set local role authenticated;select set_config('request.jwt.claims',${q(JSON.stringify({sub:requesterId,role:'authenticated'}))},true);
 select public.rpc_set_account_block(${q(workerId)}::uuid,true,${blockState.revision},${q(randomUUID())}::uuid)`;
 const blockedReceipt=await ok(lockedRace(statement,()=>receive(args(blocked.id,workerId,1,[]))));
 assert.equal(reviews(blocked.id).length,1);const blockedEvent=reviewEvents(blocked.id)[0];
 assert.equal(blockedEvent.recipient_user_id,workerId);assert.deepEqual(blockedEvent.payload,{});
 const deliveries=rows(`select state,suppression_reason from public.notification_deliveries where event_id=${q(blockedEvent.id)}::uuid`);
 assert.equal(deliveries.length,2);assert.ok(deliveries.every(d=>d.state==='SUPPRESSED'&&d.suppression_reason==='ACCOUNT_BLOCKED'));
 assert.equal((await ok(worker.rpc('rpc_list_inbox',{p_role:'WORKER',p_limit:100}))).items.some(x=>x.id===blockedEvent.id),false);
 assert.equal((await accepted(client.context(blocked.id))).review.reviewId,blockedReceipt.reviewId);
 await denied(requester.rpc('rpc_get_account_reputation',{p_account_id:workerId}),'REPUTATION_NOT_AVAILABLE');
 assert.equal(await ok(requester.rpc('rpc_get_public_profile',{p_profile_id:wp})),null);
 const safety=await ok(requester.rpc('rpc_submit_safety_report',{p_target_account_id:workerId,p_need_id:blocked.needId,p_agreement_id:blocked.id,p_category:'OTHER',p_reason:'Private test',p_narrative:'PRIVATE_REVIEW_SAFETY',p_client_request_id:randomUUID()}));assert.equal(safety.received,true);
 const blockedNow=await ok(requester.rpc('rpc_get_account_block',{p_target_account_id:workerId}));
 await ok(requester.rpc('rpc_set_account_block',{p_target_account_id:workerId,p_blocked:false,p_expected_revision:blockedNow.revision,p_client_request_id:randomUUID()}));
 assert.equal((await ok(worker.rpc('rpc_list_inbox',{p_role:'WORKER',p_limit:100}))).items.some(x=>x.id===blockedEvent.id),false);
 pass(report,'OBSERVED_BLOCK_RACE_PRESERVES_COMPLETED_REVIEW_SUPPRESSES_DELIVERY_HIDES_PUBLIC_READ_AND_KEEPS_PRIVATE_REPORT');

 switchAfter=true;assert.equal((await client.context(first.id)).kod,'AUTH_ACCOUNT_CHANGED');
 session={user:{id:requesterId},accountRevision:session.accountRevision+1};
 assert.equal((await accepted(client.context(first.id))).review.reviewId,receipt.reviewId);
 for(const role of ['anon','authenticated','service_role'])
  assert.equal(sql(`select has_table_privilege(${q(role)},'private.agreement_reviews','SELECT,INSERT,UPDATE,DELETE')`),'f');
 const functions=rows(`select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p where p.oid in('public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid)'::regprocedure,'public.rpc_get_my_agreement_review(uuid)'::regprocedure,'public.rpc_get_account_reputation(uuid)'::regprocedure)`);
 assert.equal(functions.length,3);assert.ok(functions.every(p=>p.prosecdef&&p.proconfig.includes('search_path=pg_catalog')&&!p.anon&&p.authenticated&&!p.service));
 assert.equal(sql("select relrowsecurity and relforcerowsecurity from pg_class where oid='private.agreement_reviews'::regclass"),'t');
 assert.equal(sql("select count(*) from private.agreement_reviews r where (select count(*) from public.user_activity_events e where e.dedupe_key='agreement-review:'||r.id::text)<>1"),'0');
 assert.equal(sql("select count(*) from public.user_activity_events where event_type='REVIEW_RECEIVED' and payload<>'{}'::jsonb"),'0');
 report.aggregatePlan=JSON.parse(sql(`explain(format json) select count(*),avg(rating) from private.agreement_reviews where target_account_id=${q(workerId)}::uuid`));
 report.productionClientHashes=loader.sourceHashes;report.actualClient=true;report.mockedRpcResponses=false;
 pass(report,'ACCOUNT_FENCE_PRIVATE_RLS_MINIMAL_EXECUTE_EXACT_CLIENT_SOURCE_AND_ONE_GENERIC_EVENT_PER_PERSISTED_REVIEW');
});
