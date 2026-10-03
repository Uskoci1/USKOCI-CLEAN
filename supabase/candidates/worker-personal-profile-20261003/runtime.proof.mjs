// Disposable real Auth/PostgREST and SQL fixtures; no provider, device, live DB or push transport.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as rt from '../../proofs/pre_v3/closure_runtime.mjs';
const {assert,sql,rows,q,randomUUID,ok,denied,env}=rt;
const dir='supabase/candidates/worker-personal-profile-20261003/';
const manifest=JSON.parse(readFileSync(dir+'manifest.json','utf8'));
const candidate=readFileSync(dir+'candidate.sql','utf8');
const report={unit:'WPP01',result:'RUNNING',sourceSha:env.GITHUB_SHA,disposableOnly:true,actualAuth:true,
 actualPostgrest:true,actualDatabase:true,providerCalls:0,pushSends:0,liveAccess:false,checks:[]};
const write=()=>writeFileSync(env.WPP01_ARTIFACT_DIR+'/report.json',JSON.stringify(report,null,2)+'\n');
const pass=name=>{report.checks.push({name,result:'PASS'});write();console.log('PASS '+name);};
const snapshot=()=>rows("select p.oid,p.oid::regprocedure::text as signature,md5(p.prosrc) as body,to_jsonb(p)-'prosrc' as metadata,obj_description(p.oid,'pg_proc') as comment from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by p.oid");
const closure=()=>rows("select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,(select sha256 from private.closure_source_v5 where singleton) as certificate,(select sha256 from private.closure_erasure_source_v5 where singleton) as erasure,private.retention_ai_source_ready() as ready")[0];
try{
 const baseline=snapshot(),cert=closure();assert.equal(cert.ready,true);
 // Last-function preimage tamper forces rollback even after earlier body replacements.
 assert.throws(()=>sql(candidate.replace(manifest.functions.at(-1).before_md5,'0'.repeat(32))),/WPP01_PREIMAGE_DRIFT/);
 assert.deepEqual(snapshot(),baseline);assert.deepEqual(closure(),cert);
 pass('WPP01_DRIFT_ABORTS_ALL_EIGHT_BODY_CHANGES_ATOMICALLY');
 const profileOutput=execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1','-v','wpp01_local_attested=true','-f',dir+'profile-review.proof.sql'],
  {encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:90000,maxBuffer:2**20});
 for(const expected of ['WPP01_LEGACY_UNCHANGED_KEYS_SAVE_AND_REPLAY_PRESERVE_STORED_FIELDS',
 'WPP01_LEGACY_RETIRED_FIELD_CHANGE_REFUSED_BEFORE_ANY_CANONICAL_WRITE',
 'WPP01_SOURCE_HASH_INVALIDATES_UNSAVED_REVIEW_HISTORICAL_RECEIPT_STAYS_EXACT']){
  assert.ok(profileOutput.includes('PASS '+expected));pass(expected);
 }
 assert.deepEqual(snapshot(),baseline);assert.deepEqual(closure(),cert);
 pass('WPP01_REVIEW_PROOF_ROLLS_BACK_CANDIDATE_AND_TEMP_FUNCTIONS');
 sql(candidate);
 const actual=snapshot();
 assert.deepEqual(actual.map(r=>r.oid),baseline.map(r=>r.oid));
 const changed=[];
 actual.forEach((r,i)=>{assert.deepEqual(r.metadata,baseline[i].metadata);assert.equal(r.comment,baseline[i].comment);if(r.body!==baseline[i].body)changed.push(r);});
 assert.equal(changed.length,8);
 for(const p of manifest.functions)assert.equal(sql("select md5(prosrc) from pg_proc where oid=to_regprocedure("+q(p.signature)+")"),p.after_md5);
 assert.deepEqual(closure(),cert);pass('WPP01_EXACT_EIGHT_FUNCTION_DELTA_CERTIFICATES_AND_METADATA_UNCHANGED');

 const requester=await rt.actor('wpp01-requester'),worker=await rt.actor('wpp01-worker');
 const pid=(a,kind)=>rows("select id from public.app_profiles where account_id="+q(a.id)+" and kind="+q(kind))[0].id;
 const rp=pid(requester,'REQUESTER'),wp=pid(worker,'WORKER');
 const readyWorker=async(actor,profile)=>{
  sql("update public.app_profiles set city='Novi Sad',skills=array['Fizicki poslovi'],tools=array[]::text[],vehicles=array[]::text[],licenses=array[]::text[] where id="+q(profile));
  await ok(actor.client.rpc('rpc_complete_worker_profile',{p_profile_id:profile}));
  assert.equal(sql("select team_capacity from public.app_profiles where id="+q(profile)),'1');
  const av=rows("select private.worker_availability_document("+q(profile)+"::uuid) as doc")[0].doc;
  const {profileId,accountId,revision,...available}=av;
  available.availableNow=true;
  available.rules=[{id:randomUUID(),weekdays:[0,1,2,3,4,5,6],startTime:'00:00',endTime:'24:00',
   startsOn:'2026-01-01',endsOn:null,label:'Disposable WPP01 availability',active:true}];
  await ok(actor.client.rpc('rpc_save_worker_availability',{p_expected_revision:revision,p_value:available}));
 };
 await readyWorker(worker,wp);
 const makeNeed=(label,{slots=3,mode='OFFERS',basis=null,price=null,licenses=['Retired requirement'],tools=[],vehicles=[]}={})=>{
  const id=randomUUID();
  sql("begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,mode,price_basis,requester_price_rsd,required_slots,schedule_kind,required_skills,required_tools,required_vehicles,required_licenses,response_deadline,published_at) values("+
   [q(id),q(requester.id),q(rp),"'PUBLISHED'",q('WPP01 '+label),"'Disposable fixture'","'PROOF'","'Novi Sad'",q(mode),basis?q(basis):'null',price??'null',slots,"'FLEXIBLE'","array['Fizicki poslovi']",q('{'+tools.join(',')+'}')+'::text[]',q('{'+vehicles.join(',')+'}')+'::text[]',q('{'+licenses.join(',')+'}')+'::text[]',"statement_timestamp()+interval '2 days'","statement_timestamp()"].join(',')+");commit;");
  return id;
 };
 const args=(nid,slots=3,price=3000,key=randomUUID())=>({p_need_id:nid,p_need_revision:1,p_worker_profile_id:wp,p_covered_slots:slots,p_price_rsd:price,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:'Per-offer people commitment',p_client_request_id:key});
 const nid=makeNeed('three people');
 const match=rows("select private.match_detail_without_calendar("+q(nid)+"::uuid,"+q(wp)+"::uuid) as detail,private.dispatch_cheap_candidate_admitted("+q(nid)+"::uuid,"+q(wp)+"::uuid) as cheap")[0];
 assert.equal(match.detail.responseAllowed,true);assert.equal(match.cheap,true);assert.ok(!match.detail.hardBlockers.includes('MISSING_REQUIRED_LICENSE'));
 pass('WPP01_LICENSE_MISMATCH_NO_LONGER_BLOCKS_FULL_OR_CHEAP_MATCHER');
 await denied(worker.client.rpc('rpc_submit_response',args(nid,4)),'NEED_REMAINING_CAPACITY_EXCEEDED');
 await denied(worker.client.rpc('rpc_submit_response',args(nid,0)),'INVALID_COVERED_SLOTS');
 const command=args(nid),offer=await ok(worker.client.rpc('rpc_submit_response',command));
 const replay=await ok(worker.client.rpc('rpc_submit_response',command));
 assert.equal(offer.coveredSlots,3);assert.equal(replay.idempotentReplay,true);assert.equal(replay.contentHash,offer.contentHash);
 const snap=rows("select worker_team_capacity,covered_slots from private.response_application_snapshots where response_id="+q(offer.responseId))[0];
 assert.deepEqual(snap,{worker_team_capacity:1,covered_slots:3});
 pass('WPP01_PROFILE_ONE_CAN_OFFER_THREE_BOUND_AND_SNAPSHOT_TRUTH_PRESERVED');
 const candidates=await ok(requester.client.rpc('rpc_list_need_candidates',{p_need_id:nid}));
 const page=await ok(requester.client.rpc('rpc_list_need_candidates_page',{p_need_id:nid,p_limit:10,p_after_at:null,p_after_id:null}));
 assert.equal(candidates.length,1);assert.equal(page.items.length,1);
 const {sortAt,...item}=page.items[0];assert.deepEqual(item,candidates[0]);assert.equal(item.state,'SELECTABLE');assert.equal(item.coveredSlots,3);
 pass('WPP01_PAGED_UNPAGED_CANDIDATE_PARITY_SELECTABLE_THREE');
 const selection={p_need_id:nid,p_need_revision:offer.needRevision,p_response_id:offer.responseId,p_response_version:offer.version,p_content_hash:offer.contentHash,p_client_request_id:randomUUID()};
 const agreement=await ok(requester.client.rpc('rpc_select_response',selection));
 assert.deepEqual(await ok(requester.client.rpc('rpc_select_response',selection)),agreement);
 assert.equal(sql("select public.fn_need_covered_slots("+q(nid)+"::uuid)"),'3');
 pass('WPP01_SELECT_THREE_WITH_PROFILE_ONE_EXACT_REPLAY_NO_OVERFILL');
 const second=await rt.actor('wpp01-second-worker'),sp=pid(second,'WORKER');await readyWorker(second,sp);
 const competing=makeNeed('remaining slots after selection');
 const large=await ok(worker.client.rpc('rpc_submit_response',args(competing)));
 const small=await ok(second.client.rpc('rpc_submit_response',{...args(competing,1),p_worker_profile_id:sp}));
 const selectArgs=(task,offer)=>({p_need_id:task,p_need_revision:offer.needRevision,p_response_id:offer.responseId,
  p_response_version:offer.version,p_content_hash:offer.contentHash,p_client_request_id:randomUUID()});
 await ok(requester.client.rpc('rpc_select_response',selectArgs(competing,small)));
 const afterOne=await ok(requester.client.rpc('rpc_list_need_candidates',{p_need_id:competing}));
 const afterPage=await ok(requester.client.rpc('rpc_list_need_candidates_page',{p_need_id:competing,p_limit:10,p_after_at:null,p_after_id:null}));
 assert.deepEqual(afterPage.items.map(({sortAt,...item})=>item),afterOne);
 assert.equal(afterOne.find(item=>item.responseId===large.responseId).state,'OVERFILL');
 await denied(requester.client.rpc('rpc_select_response',selectArgs(competing,large)),'OVERFILL');
 assert.equal(sql("select public.fn_need_covered_slots("+q(competing)+"::uuid)"),'1');
 pass('WPP01_SELECTION_OVERFILL_REFUSED_WITH_REMAINING_SLOT_STATE_PARITY');
 for(const [basis,good,bad] of [['TOTAL',3000,1000],['PER_PERSON',9000,3000]]){
  const task=makeNeed('price '+basis,{mode:'MY_PRICE',basis,price:3000});
  await denied(worker.client.rpc('rpc_submit_response',args(task,3,bad)),'FIXED_PRICE_MISMATCH');
  if(basis==='TOTAL')await denied(worker.client.rpc('rpc_submit_response',args(task,1,3000)),'TOTAL_PRICE_REQUIRES_ALL_SLOTS');
  const accepted=await ok(worker.client.rpc('rpc_submit_response',args(task,3,good)));assert.equal(accepted.coveredSlots,3);
 }
 pass('WPP01_TOTAL_AND_PER_PERSON_PRICE_AUTHORITY_UNCHANGED');
 for(const [field,code] of [['tools','MISSING_REQUIRED_TOOL'],['vehicles','MISSING_REQUIRED_VEHICLE']]){
  const task=makeNeed('retained '+field,{[field]:['RequiredResource']});
  const m=rows("select private.match_detail_without_calendar("+q(task)+"::uuid,"+q(wp)+"::uuid) as detail,private.dispatch_cheap_candidate_admitted("+q(task)+"::uuid,"+q(wp)+"::uuid) as cheap")[0];
  assert.equal(m.detail.responseAllowed,false);assert.ok(m.detail.hardBlockers.includes(code));assert.equal(m.cheap,false);
 }
 pass('WPP01_TOOL_AND_VEHICLE_GATES_REMAIN_IN_BOTH_MATCHERS');
 // Privileged synthetic revision fixture, unchanged public RPC performs actual reconfirmation.
 for(const action of ['KEEP','UPDATE']){
  const task=makeNeed('stale '+action),first=await ok(worker.client.rpc('rpc_submit_response',args(task)));
  sql("begin;set local session_replication_role=replica;update public.needs set revision=2 where id="+q(task)+";update public.marketplace_responses set status='STALE_REVIEW_REQUIRED' where id="+q(first.responseId)+";commit;");
  const resolve={p_response_id:first.responseId,p_expected_response_version:first.version,p_expected_need_revision:2,p_client_request_id:randomUUID(),p_action:action,p_covered_slots:3,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:'Per-offer people commitment'};
  const next=await ok(worker.client.rpc('rpc_resolve_stale_response_after_need_edit',resolve));
  assert.equal(next.status,'SUBMITTED');
  assert.equal(sql("select covered_slots from public.marketplace_responses where id="+q(first.responseId)),'3');
 }
 pass('WPP01_STALE_KEEP_AND_UPDATE_ACCEPT_PER_OFFER_PEOPLE');
 sql(readFileSync(dir+'revert.sql','utf8'));
 assert.deepEqual(snapshot(),baseline);assert.deepEqual(closure(),cert);
 pass('WPP01_EXACT_FUNCTION_REVERT_CERTIFICATES_UNCHANGED');
 report.result='PASS';write();
}catch(error){report.result='FAIL';report.failure=String(error.message).slice(0,900);write();console.error('FAIL WPP01 '+report.failure);process.exitCode=1;}
