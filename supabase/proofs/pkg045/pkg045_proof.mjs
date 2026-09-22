// PKG-045: column privacy + actual Auth/PostgREST + unchanged real client readers.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {readSourceAdapters} from '../../../scripts/task_detail_read_preflight.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const pins=JSON.parse(readFileSync('docs/implementation/v5-ai-first/pkg045/FUNCTION_PINS_20260922.json','utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex');
const report={package:'PKG-045',sourceSha:env.GITHUB_SHA,disposableOnly:true,providerCalls:0,checks:[]};
const save=()=>writeFileSync(env.PRE_V3_ARTIFACT_DIR+'/pkg045-report.json',JSON.stringify(report,null,2)+'\n');
const pass=name=>{report.checks.push({name,result:'PASS'});save();console.log('PASS '+name);};
const closure=()=>rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,private.retention_ai_source_ready() ready")[0];
// Include column ACLs: the historical general surface omits those.
const surface=()=>[...sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n'),
 ...rows("select attname,attacl::text from pg_attribute where attrelid='public.needs'::regclass and attnum>0 and not attisdropped order by attnum").map(x=>'column-acl:'+JSON.stringify(x))];
sql(readFileSync('supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql','utf8'));
report.closureBefore=closure();assert.equal(report.closureBefore.ready,true);assert.equal(report.closureBefore.live,report.closureBefore.certified);
report.dependencyBefore=rows(`select oid::regprocedure::text signature,md5(prosrc) raw_md5,md5(replace(prosrc,E'\\r\\n',E'\\n')) lf_md5 from pg_proc where oid in (${pins.dependencies.map(p=>q(p.signature)+'::regprocedure').join(',')})`);
const baselineSurface=surface();pass('EXACT_PREDECESSOR_REPLAY_AND_READY_CLOSURE');
const owner=await rt.actor('pkg045-owner'), stranger=await rt.actor('pkg045-stranger'), participant=await rt.actor('pkg045-participant'), otherWorld=await rt.actor('pkg045-other-world');
const profile=(a,kind)=>sql(`select id from public.app_profiles where account_id=${q(a.id)} and kind=${q(kind)}`);
const ownerProfile=profile(owner,'REQUESTER'), workerProfile=profile(participant,'WORKER');
const ids={public:randomUUID(),draft:randomUUID(),historical:randomUUID(),selection:randomUUID()}, response=randomUUID(), selected=randomUUID(), selection=randomUUID();
let fixture=`begin;set local session_replication_role=replica;
  insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values(${q(otherWorld.id)},'SYNTHETIC_ACCEPTANCE_FIXTURE','Disposable privacy proof','pkg045');
  update public.app_profiles set display_name='Proof person',city='Novi Sad',profile_status='ACTIVE',skills='{ciscenje}',team_capacity=3,available_now=true where account_id in(${q(owner.id)},${q(participant.id)});`;
for(const [label,id] of Object.entries(ids)) fixture+=`
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,price_basis,requester_price_rsd,
    required_slots,revision,schedule_kind,published_at,approximate_city,approximate_area,approximate_lat,approximate_lng,task_country_code,task_timezone,execution_location_mode,
    remaining_search_close_reason,remaining_search_closed_by_account_id,remaining_search_closed_at)
  values(${q(id)},${q(owner.id)},${q(ownerProfile)},${q(label==='draft'?'DRAFT':label==='historical'?'COMPLETED':label==='selection'?'SELECTION':'PUBLISHED')},
    ${q('Privacy '+label)},'Disposable fixture','PROOF','MY_PRICE','PER_PERSON',3000,3,2,'FLEXIBLE',statement_timestamp(),'Novi Sad','Liman',45.25,19.83,'RS','Europe/Belgrade','STATIONARY',
    ${label==='selection'?"'PRIVATE_REASON_DO_NOT_EXPOSE'":'null'},${label==='selection'?q(owner.id):'null'},${label==='selection'?'statement_timestamp()':'null'});
  insert into public.need_geography(need_id,public_topology) values(${q(id)},'{"mode":"STATIONARY","start":{"city":"Novi Sad","area":"Liman"}}');
  insert into public.need_requirement_details(need_id,critical_conditions) values(${q(id)},'{Heavy boxes}');`;
fixture+=`insert into public.need_sensitive(need_id,exact_address,access_notes) values(${q(ids.public)},'PRIVATE_DISPOSABLE_ADDRESS','Disposable access note');`;
fixture+=`
  insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots)
  values(${q(response)},${q(ids.public)},${q(participant.id)},${q(workerProfile)},'APPLICATION','STALE_REVIEW_REQUIRED',1,1,3000,1),
    (${q(selected)},${q(ids.historical)},${q(participant.id)},${q(workerProfile)},'APPLICATION','SELECTED',2,1,3000,1);
  insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,content_hash)
  values(${q(response)},1,1,3000,1,repeat('a',64)),(${q(selected)},1,2,3000,1,repeat('b',64));
  insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode,status)
  values(${q(selection)},${q(ids.historical)},2,${q(owner.id)},${q(selection)},1,${q(selected)},${q(participant.id)},${q(workerProfile)},'REQUESTER_SELECTS','SELECTED');
  commit;`;
sql(fixture);
// This is an actual exploitable column read, not a grep or fabricated public UI claim.
const exploit=c=>c.from('needs').select('id,requester_account_id,remaining_search_closed_by_account_id,remaining_search_close_reason').eq('id',ids.selection).single();
const exposed=await ok(exploit(stranger.client));
assert.equal(exposed.remaining_search_close_reason,'PRIVATE_REASON_DO_NOT_EXPOSE');assert.equal(exposed.requester_account_id,owner.id);
pass('BEFORE_SAME_WORLD_STRANGER_CAN_READ_INTERNAL_COLUMNS');
const oldDetail=(c,id)=>c.from('needs').select('id,revision,title,status,description,covered_slots,selectable_application_count,marketplace_responses(id),need_geography(public_topology),need_requirement_details(critical_conditions),price_basis,requester_price_rsd,required_slots').eq('id',id).maybeSingle();
const cases=[[owner,ids.public],[stranger,ids.public],[owner,ids.draft],[stranger,ids.draft],[participant,ids.historical],[stranger,ids.historical],[otherWorld,ids.public],[stranger,ids.selection]];
const old=await Promise.all(cases.map(([a,id])=>ok(oldDetail(a.client,id))));
const relatedReads=()=>Promise.all([owner,stranger,participant].map(async a=>({
 sensitive:await ok(a.client.from('need_sensitive').select('need_id,exact_address,access_notes').eq('need_id',ids.public)),
 versions:await ok(a.client.from('marketplace_response_versions').select('response_id,version,price_rsd').eq('response_id',response))
})));
const oldRelated=await relatedReads();assert.equal(oldRelated[0].sensitive[0].exact_address,'PRIVATE_DISPOSABLE_ADDRESS');
assert.deepEqual(oldRelated[1].sensitive,[]);assert.deepEqual(oldRelated[2].sensitive,[]);
assert.equal(oldRelated[0].versions.length,1);assert.equal(oldRelated[2].versions.length,1);assert.deepEqual(oldRelated[1].versions,[]);
const ownerPage=await ok(owner.client.rpc('rpc_list_my_needs_page',{p_scope:'ALL',p_limit:100}));
const events=[
 [owner,'NEED',ids.draft,'REQUESTER'],[stranger,'NEED',ids.public,'WORKER'],
 [owner,'RESPONSE',response,'REQUESTER'],[participant,'RESPONSE',response,'WORKER'],
 [stranger,'CLARIFICATION',randomUUID(),'WORKER'],[stranger,'NEED',ids.draft,'WORKER'],
 [otherWorld,'NEED',ids.public,'WORKER'],
].map(([actor,type,entity,role])=>({actor,type,entity,role,id:randomUUID()}));
sql('begin;set local session_replication_role=replica;'+events.map(e=>`
 insert into public.user_activity_events(id,recipient_user_id,recipient_role,event_type,entity_type,entity_id,payload,dedupe_key)
 values(${q(e.id)},${q(e.actor.id)},${q(e.role)},'OPPORTUNITY_AVAILABLE',${q(e.type)},${q(e.entity)},${q(JSON.stringify({needId:ids.public}))},${q(e.id)});
 insert into public.notification_deliveries(event_id,recipient_user_id,recipient_role,channel,state,title,body,dedupe_key)
 values(${q(e.id)},${q(e.actor.id)},${q(e.role)},'IN_APP','CREATED','Proof','Proof',${q(e.id)});`).join('\n')+'commit;');
const readEvents=()=>Promise.all(events.map(e=>ok(e.actor.client.rpc('rpc_resolve_activity_event',{p_event_id:e.id}))));
const oldEvents=await readEvents();
assert.deepEqual(oldEvents.map(x=>x.kind),['OWN_NEED','OPPORTUNITY','CANDIDATES','APPLICATIONS','OPPORTUNITY','UNAVAILABLE','UNAVAILABLE']);
const list=c=>ok(c.rpc('rpc_list_open_tasks_v3',{p_limit:200}));
const beforeList=await list(stranger.client);
assert.ok(beforeList.items.some(x=>x.id===ids.public));
assert.equal(old[3],null);assert.equal(old[5],null);assert.equal(old[6],null);assert.equal(old[4].covered_slots,1);
pass('BEFORE_LEGITIMATE_PUBLIC_OWNER_PARTICIPANT_WORLD_BOUNDARIES');
const atext=readFileSync('supabase/candidates/pkg045a_task_read_contract.sql','utf8'),btext=readFileSync('supabase/candidates/pkg045b_task_column_privileges.sql','utf8');
report.candidates={a:sha(atext.replace(/\n$/,'')),b:sha(btext.replace(/\n$/,''))};
assert.throws(()=>sql(atext.replace(pins.functions[0].before,'0'.repeat(32))),/PKG045A_PREDECESSOR_DRIFT/);assert.deepEqual(surface(),baselineSurface);
assert.throws(()=>sql(atext.replace("'description', n.description", "'description', n.title")),/PKG045_BODY_MISMATCH/);assert.deepEqual(surface(),baselineSurface);
pass('A_PREDECESSOR_AND_BODY_TAMPER_FAIL_ATOMICALLY');
sql(atext);assert.throws(()=>sql(atext),/PKG045A_PREDECESSOR_DRIFT/);
await new Promise(r=>setTimeout(r,1500));
const afterASurface=surface();
const compareProjection=(legacy,next)=>{if(legacy===null){assert.equal(next,null);return;}for(const key of Object.keys(legacy))assert.deepEqual(next[key],legacy[key],key);};
for(let i=0;i<cases.length;i++) {
  const [a,id]=cases[i];compareProjection(old[i],await ok(a.client.rpc('rpc_read_task',{p_need_id:id})));
  assert.deepEqual(await ok(oldDetail(a.client,id)),old[i]);
}
const ownList=await ok(owner.client.rpc('rpc_list_my_tasks'));assert.equal(ownList.length,4);
assert.deepEqual(await ok(stranger.client.rpc('rpc_list_my_tasks')),[]);
assert.deepEqual((await list(stranger.client)).items,beforeList.items);
assert.deepEqual((await ok(owner.client.rpc('rpc_list_my_needs_page',{p_scope:'ALL',p_limit:100}))).items,ownerPage.items);
assert.deepEqual(await readEvents(),oldEvents);
assert.deepEqual(await relatedReads(),oldRelated);
assert.deepEqual(await ok(exploit(stranger.client)),exposed); // A is additive, never claim privacy fixed here.
pass('A_NEW_READERS_EQUIVALENT_OLD_APK_STILL_WORKS_PRIVACY_NOT_YET_CLOSED');
// Only the declared reader/resolver functions, no row policies, tables or columns changed by A.
const removedA=baselineSurface.filter(x=>!afterASurface.includes(x)),addedA=afterASurface.filter(x=>!baselineSurface.includes(x));
assert.equal(removedA.length,3);assert.ok(removedA.every(x=>/^function:public\.(rpc_list_my_needs_page|rpc_resolve_activity_event|rpc_list_open_tasks_v3)\(/.test(x)));
assert.equal(addedA.length,6);assert.ok(addedA.every(x=>/^function:public\.(is_my_task|rpc_read_task|rpc_list_my_tasks|rpc_list_my_needs_page|rpc_resolve_activity_event|rpc_list_open_tasks_v3)\(/.test(x)));
report.surfaceA={removed:removedA,added:addedA};assert.deepEqual(closure(),report.closureBefore);pass('A_ONLY_READER_FUNCTIONS_CHANGED_CERTIFICATE_UNCHANGED');
assert.throws(()=>sql(btext.replace(pins.policyPredecessors[0].digest,'0'.repeat(32))),/PKG045B_POLICY_DRIFT/);
assert.deepEqual(surface(),afterASurface);assert.deepEqual(closure(),report.closureBefore);
assert.throws(()=>sql(btext.replace('execute replace(definition,old_digest,new_digest);','perform 1;')),/PKG045B_REBIND_INCOMPLETE/);
assert.deepEqual(surface(),afterASurface);assert.deepEqual(closure(),report.closureBefore);
pass('B_POLICY_DRIFT_AND_INCOMPLETE_REBIND_ROLL_BACK_GRANTS_AND_CERTIFICATE');
sql(btext);assert.throws(()=>sql(btext),/PKG045B_ALREADY_RESTRICTED/);await new Promise(r=>setTimeout(r,1500));
for(const role of [owner,stranger,participant,otherWorld]) await denied(exploit(role.client));
for(const column of ['requester_account_id','remaining_search_closed_by_account_id','remaining_search_close_reason']) {
  await denied(stranger.client.from('needs').select('alias:'+column).eq('id',ids.public));
  await denied(stranger.client.from('needs').select('id').eq(column,column.endsWith('reason')?'PRIVATE_REASON_DO_NOT_EXPOSE':owner.id));
  await denied(stranger.client.from('needs').select('id').order(column));
}
const wildcard=await stranger.client.from('needs').select('*').eq('id',ids.public);
if(!wildcard.error) for(const r of wildcard.data) for(const key of ['requester_account_id','remaining_search_closed_by_account_id','remaining_search_close_reason']) assert.ok(!Object.hasOwn(r,key));
await denied(rt.anon.from('needs').select('id,title'));
await denied(rt.anon.rpc('rpc_read_task',{p_need_id:ids.public}));await denied(rt.anon.rpc('rpc_list_my_tasks'));
pass('B_DIRECT_ALIAS_FILTER_ORDER_WILDCARD_ANONYMOUS_DISCLOSURES_BLOCKED');
for(let i=0;i<cases.length;i++) {
  const [a,id]=cases[i],next=await ok(a.client.rpc('rpc_read_task',{p_need_id:id}));compareProjection(old[i],next);
  if(next) assert.ok(!JSON.stringify(next).includes('PRIVATE_REASON_DO_NOT_EXPOSE'));
}
assert.deepEqual(await ok(owner.client.rpc('rpc_list_my_tasks')),ownList);
assert.deepEqual(await ok(stranger.client.rpc('rpc_list_my_tasks')),[]);
assert.deepEqual((await list(stranger.client)).items,beforeList.items);
assert.deepEqual((await ok(owner.client.rpc('rpc_list_my_needs_page',{p_scope:'ALL',p_limit:100}))).items,ownerPage.items);
assert.deepEqual((await ok(stranger.client.rpc('rpc_list_my_needs_page'))).items,[]);
assert.deepEqual(await readEvents(),oldEvents);
await denied(stranger.client.rpc('rpc_resolve_activity_event',{p_event_id:events[0].id}));
assert.equal(await ok(stranger.client.rpc('is_my_task',{p_need_id:ids.public})),false);
assert.equal(await ok(owner.client.rpc('is_my_task',{p_need_id:ids.public})),true);
pass('B_OWNER_PAGING_AND_NOTIFICATION_TARGETS_RETAIN_IDENTITY_AND_VISIBILITY');
assert.deepEqual(await relatedReads(),oldRelated);
pass('B_DEPENDENT_RESPONSE_VERSIONS_AND_EXACT_ADDRESS_OWNER_BOUNDARIES_RETAINED');
const map=await ok(stranger.client.rpc('rpc_list_open_tasks_v3',{p_bbox:{west:19.7,south:45.1,east:19.9,north:45.4},p_filters:{remote:'EXCLUDE'}}));
assert.ok(map.items.some(x=>x.id===ids.public));
assert.ok(!(await list(otherWorld.client)).items.some(x=>x.id===ids.public));
pass('B_PUBLIC_DETAIL_OWNER_DRAFT_HISTORY_COUNTS_EMBEDS_LIST_MAP_WORLD_PARITY');
const join=c=>c.from('marketplace_responses').select('id,current_version,submitted_against_need_revision,needs!inner(id,revision,mode,requester_price_rsd,price_basis,required_slots)')
 .eq('id',response).eq('current_version',1).eq('needs.revision',2).maybeSingle();
const pricing=await ok(join(participant.client));assert.equal(pricing.needs.price_basis,'PER_PERSON');assert.equal(pricing.needs.requester_price_rsd,3000);assert.equal(pricing.needs.required_slots,3);
assert.equal(await ok(participant.client.from('marketplace_responses').select('id,needs!inner(id,revision)').eq('id',response).eq('needs.revision',1).maybeSingle()),null);
assert.deepEqual(await ok(stranger.client.from('needs').select('remaining_search_closed_at').eq('id',ids.public).single()),{remaining_search_closed_at:null});
pass('B_REVISION_BOUND_APPLICATION_PRICE_JOIN_AND_REMAINING_SEARCH_KEEP_WORKING');
// Execute the actual TypeScript adapters, including public profile and urgency reads.
const ownerAdapters=readSourceAdapters(resolve('.'),owner.client,owner.id), publicAdapters=readSourceAdapters(resolve('.'),stranger.client,stranger.id);
assert.equal((await ownerAdapters.needService.mojePotrebe()).length,4);
assert.equal((await ownerAdapters.needService.potreba(ids.draft)).id,ids.draft);
assert.equal(await publicAdapters.needService.potreba(ids.draft),null);
assert.equal((await publicAdapters.baseline.prilika(ids.public)).osnovaCene,'PER_PERSON');
assert.equal((await publicAdapters.needService.potreba(ids.public)).brojPrijavaZaIzbor,null);
report.clientSourceHashes=ownerAdapters.sources;pass('B_EXACT_CLIENT_READERS_OVER_REAL_AUTH_REST');
await denied(oldDetail(owner.client,ids.public));
await denied(owner.client.from('needs').select('id').eq('requester_account_id',owner.id));
report.rollout='A preserves installed APK; B requires compatible APK rollout AND fresh explicit certificate-movement approval. No fallback to broad reads.';
pass('B_OLD_APK_BREAK_CONFIRMED_AND_ROLLOUT_GATE_RECORDED');
sql(`insert into private.account_closure_requests(account_id,state,revision) values(${q(owner.id)},'READY',1),(${q(stranger.id)},'READY',1);`);
await denied(owner.client.rpc('rpc_list_my_tasks'));await denied(owner.client.rpc('rpc_read_task',{p_need_id:ids.draft}));
await denied(stranger.client.rpc('rpc_read_task',{p_need_id:ids.public}));await denied(stranger.client.rpc('rpc_list_open_tasks_v3'));
await denied(owner.client.rpc('rpc_list_my_needs_page'));await denied(owner.client.rpc('is_my_task',{p_need_id:ids.draft}));
pass('B_RESTRICTED_ACCOUNTS_CANNOT_USE_DIRECT_OR_ELEVATED_READERS');
const afterB=surface(),removedB=afterASurface.filter(x=>!afterB.includes(x)),addedB=afterB.filter(x=>!afterASurface.includes(x));
const policyNames=pins.policyPredecessors.map(p=>'policy:public.'+p.relname+'.'+p.polname+':');
assert.ok([...removedB,...addedB].every(x=>x.startsWith('table:public.needs:')||x.startsWith('column-acl:')||x.startsWith('function:private.retention_ai_source_ready(')||policyNames.some(name=>x.startsWith(name))));
assert.equal(addedB.filter(x=>x.startsWith('policy:')).length,5);
report.surfaceB={removed:removedB,added:addedB};
report.functionPins=rows(`select oid::regprocedure::text signature,md5(prosrc) md5,prosecdef,proacl::text,proconfig from pg_proc where oid in (${pins.functions.map(p=>q(p.signature)+'::regprocedure').join(',')})`);
report.closureAfter=closure();assert.notEqual(report.closureAfter.live,report.closureBefore.live);
assert.equal(report.closureAfter.live,report.closureAfter.certified);assert.equal(report.closureAfter.ready,true);
assert.equal(sql("select private.closure_erasure_binding_v5()->>'sourceSha256'"),report.closureAfter.live);
pass('B_ONLY_REVIEWED_ACL_POLICY_AND_READINESS_CONSTANT_CHANGE_NEW_CERTIFICATE_READY');
// Actual erasure worker on a newly created disposable account with a draft and a private address.
// No DEV data, no provider calls, no time-travel/retention bypass.
const closing=await rt.actor('pkg045-closure'), closingProfile=profile(closing,'REQUESTER'), closingNeed=randomUUID(), marker='PKG045_ERASE_'+randomUUID();
sql(`begin;set local session_replication_role=replica;
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode)
 values(${q(closingNeed)},${q(closing.id)},${q(closingProfile)},'DRAFT',${q(marker)},${q(marker)},'PROOF','OFFERS');
 insert into public.need_sensitive(need_id,exact_address,access_notes) values(${q(closingNeed)},${q(marker)},${q(marker)});commit;`);
await ok(closing.client.rpc('rpc_prepare_account_closure',{p_expected_user_id:closing.id,p_expected_revision:0,p_client_request_id:randomUUID()}));
const ready=await ok(closing.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:closing.id}));
assert.equal(ready.ready,true);
const started=await ok(closing.client.rpc('rpc_start_account_closure_execution',{p_expected_user_id:closing.id,p_request_id:ready.requestId,
 p_expected_revision:ready.revision,p_client_request_id:randomUUID(),p_policy_sha256:ready.policySha256}));
assert.equal(started.state,'EXECUTING');
const {loadClosureWorker}=await import('../pre_v3/v5_closure_edge_runtime.mjs');
const runtime=loadClosureWorker({env:name=>({USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED:'true',SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,
 SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY})[name],
 fetch:async(url,init)=>{assert.equal(new URL(url).origin,'http://127.0.0.1:54321');return fetch(url,init);}});
let closed=null,calls=0;
for(;calls<400&&!closed;calls++) {
 const result=await runtime.handler(new Request('http://127.0.0.1/closure',{method:'POST',headers:{apikey:env.RU5_DEVICE_SERVICE_ROLE_KEY,'content-type':'application/json'},
 body:JSON.stringify({accountId:closing.id,generation:started.generation})}));
 assert.equal(result.status,200);const value=await result.json();if(value.state==='CLOSED')closed=value;
}
assert.ok(closed,'CLOSURE_NOT_COMPLETE');assert.equal(closed.relationalOutcome,'ORDINARY_PERSONAL_CONTENT_ERASED');assert.deepEqual(closed.exceptions,[]);
assert.equal(sql(`select deleted_at is not null from auth.users where id=${q(closing.id)}`),'t');
assert.equal(sql(`select count(*) from public.needs where title=${q(marker)} or description=${q(marker)}`),'0');
assert.equal(sql(`select count(*) from public.need_sensitive where exact_address=${q(marker)} or access_notes=${q(marker)}`),'0');
report.closureWorker={calls,state:closed.state,relationalOutcome:closed.relationalOutcome,syntheticLocalAccountOnly:true};
assert.deepEqual(closure(),report.closureAfter);pass('B_REAL_CLOSURE_WORKER_ERASES_DRAFT_AND_PRIVATE_ADDRESS_ON_NEW_CERTIFICATE');
report.result='PASS';save();
