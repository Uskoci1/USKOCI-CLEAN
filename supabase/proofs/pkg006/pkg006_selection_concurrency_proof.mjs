// USKOČI PKG-006 / GAP-0023 — exact-head disposable concurrency proof.
// Actual local Postgres/Auth through the shared pre-V3 runtime: the two real
// fixture accounts plus one canonically activated second Worker. Published Needs
// are explicit SQL fixtures (as in the W02 calendar proof), never UI publication.
// Proves, on the replayed 147-file history: application submit replay/denial,
// same-key concurrent Selection, one-seat races, observed Need row-lock waits,
// two-Worker capacity (no over-allocation, one Agreement per accepted Selection),
// Worker capacity CAS, and overlapping-interval Selection/application conflicts.
// No production project, provider or device is accessed.
import {assert,rows,sql,prove,pass,login,worker,requester,workerId,requesterId,ok,denied,actor,randomUUID,q,lockedRace} from '../pre_v3/closure_runtime.mjs';
import * as rt from '../pre_v3/closure_runtime.mjs';

const iso=ms=>new Date(Date.now()+ms).toISOString();
const count=s=>Number(sql(s));
const revision=id=>Number(sql(`select revision from public.needs where id=${q(id)}::uuid`));
function fixture(label,slots,start=null,end=null){
 const id=randomUUID();
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,response_deadline,published_at)
 values(${q(id)}::uuid,${q(requesterId)}::uuid,${q(rt.rp)}::uuid,'PUBLISHED',${q('PKG006 '+label)},'Disposable concurrency proof','PROOF','Novi Sad','Liman','OFFERS',${slots},
  ${start?"'FIXED_WINDOW'":"'FLEXIBLE'"},${start?q(start)+'::timestamptz':'null'},${end?q(end)+'::timestamptz':'null'},statement_timestamp()+interval '2 days',statement_timestamp());
 select set_config('uskoci.need_lifecycle','',true);commit;`);
 return id;
}
const submitArgs=(pid,id,o={})=>({p_need_id:id,p_need_revision:revision(id),p_worker_profile_id:pid,p_covered_slots:o.slots??1,p_price_rsd:o.price??3000,
 p_proposed_start_at:o.start??null,p_proposed_end_at:o.end??null,p_scope_note:o.note??null,p_client_request_id:o.key??randomUUID()});
const selectArgs=(id,a,key=randomUUID())=>({p_need_id:id,p_need_revision:a.needRevision,p_response_id:a.responseId,p_response_version:a.version,p_content_hash:a.contentHash,p_client_request_id:key});
const agreements=id=>count(`select count(*) from public.agreements where need_id=${q(id)}::uuid`);
const selections=id=>count(`select count(*) from public.need_selections where need_id=${q(id)}::uuid and status='SELECTED'`);
const covered=id=>count(`select public.fn_need_covered_slots(${q(id)}::uuid)`);
const commands=id=>count(`select count(*) from private.selection_commands where need_id=${q(id)}::uuid`);
const outcome=r=>r.error?{ok:false,code:r.error.message,detail:String(r.error.details??'')}:{ok:true,data:r.data};
const split=results=>({w:results.filter(r=>r.ok),l:results.filter(r=>!r.ok)});
const submit=(client,pid,id,o)=>ok(client.rpc('rpc_submit_response',submitArgs(pid,id,o)));
const select=(id,a,key)=>ok(requester.rpc('rpc_select_response',selectArgs(id,a,key)));
// Canonical activation of an additional Worker, exactly as the identity proof (144) does it.
async function newWorker(label,capacity){
 const a=await actor(label);
 let p=await ok(a.client.from('app_profiles').select('id').eq('account_id',a.id).eq('kind','WORKER').maybeSingle());
 if(!p)p=await ok(a.client.from('app_profiles').insert({account_id:a.id,kind:'WORKER',display_name:'PKG006 '+label,skills:[],tools:[],vehicles:[],bio:''}).select('id').single());
 await ok(a.client.from('app_profiles').update({display_name:'PKG006 '+label,skills:['Proof'],tools:[],vehicles:['Kombi'],licenses:[]}).eq('id',p.id));
 const loc=await ok(a.client.rpc('rpc_get_worker_location',{}));
 await ok(a.client.rpc('rpc_save_worker_location',{p_expected_revision:loc.revision,p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:15,approximatePosition:{latitude:45.25,longitude:19.85}},p_confirmed:true}));
 await ok(a.client.rpc('rpc_complete_worker_profile',{p_profile_id:p.id}));
 const cap=await ok(a.client.rpc('rpc_get_worker_capacity',{}));
 await ok(a.client.rpc('rpc_save_worker_capacity',{p_expected_revision:cap.revision,p_team_capacity:capacity}));
 return {...a,pid:p.id};
}

await prove('PKG006_APPLICATION_SELECTION_CONCURRENCY','pkg006-proof-report.json',async report=>{
 await login();
 const history=sql("select count(*)::text||'/'||max(version) from supabase_migrations.schema_migrations");
 assert.equal(history,'147/20260913081242');report.history=history;
 for(const object of["to_regprocedure('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)') is not null",
  "to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)') is not null","to_regclass('private.selection_commands') is not null",
  "to_regprocedure('public.rpc_save_worker_capacity(text,jsonb)') is not null","to_regclass('private.worker_calendar_events') is not null"])assert.equal(sql(`select ${object}`),'t',object);
 pass(report,'EXACT_HEAD_HISTORY_147_AND_AUTHORITY_OBJECTS');

 // 1. Application submit: same key + same payload replays the original receipt; any changed payload is denied; parallel same-key sends create one application.
 const n1=fixture('submit-replay',2),key=randomUUID();
 const r1=await submit(worker,rt.wp,n1,{key});assert.equal(r1.idempotentReplay,false);
 const r2=await submit(worker,rt.wp,n1,{key});
 assert.equal(r2.responseId,r1.responseId);assert.equal(r2.contentHash,r1.contentHash);assert.equal(r2.version,r1.version);assert.equal(r2.idempotentReplay,true);
 await denied(worker.rpc('rpc_submit_response',submitArgs(rt.wp,n1,{key,price:3001})),'IDEMPOTENCY_KEY_REUSED');
 await denied(worker.rpc('rpc_submit_response',submitArgs(rt.wp,n1,{key,note:'changed'})),'IDEMPOTENCY_KEY_REUSED');
 assert.equal(count(`select count(*) from public.marketplace_responses where need_id=${q(n1)}::uuid`),1);
 const n1b=fixture('submit-parallel',2),keyB=randomUUID();
 const parallel=(await Promise.all([0,1].map(()=>worker.rpc('rpc_submit_response',submitArgs(rt.wp,n1b,{key:keyB}))))).map(outcome);
 assert.ok(parallel.every(x=>x.ok),JSON.stringify(parallel));assert.equal(parallel[0].data.responseId,parallel[1].data.responseId);
 assert.equal(count(`select count(*) from public.marketplace_responses where need_id=${q(n1b)}::uuid`),1);
 pass(report,'SUBMIT_SAME_KEY_SAME_PAYLOAD_REPLAYS_CHANGED_PAYLOAD_DENIED_PARALLEL_ONE_APPLICATION');

 // 2. Same key + same payload concurrent Selection commits one Agreement and one command receipt.
 const n2=fixture('select-same-key',1),a2=await submit(worker,rt.wp,n2),sameKey=randomUUID();
 const same=(await Promise.all([0,1].map(()=>requester.rpc('rpc_select_response',selectArgs(n2,a2,sameKey))))).map(outcome);
 assert.ok(same.every(x=>x.ok),JSON.stringify(same));assert.equal(same[0].data,same[1].data);
 assert.equal(commands(n2),1);assert.equal(selections(n2),1);assert.equal(agreements(n2),1);
 pass(report,'CONCURRENT_SAME_KEY_SAME_PAYLOAD_SELECTION_ONE_AGREEMENT');

 // 3. Different keys race for one seat: exactly one commits.
 const n3=fixture('select-one-seat',1),a3=await submit(worker,rt.wp,n3);
 const race=(await Promise.all([0,1].map(()=>requester.rpc('rpc_select_response',selectArgs(n3,a3))))).map(outcome);
 const r3=split(race);assert.equal(r3.w.length,1,JSON.stringify(race));assert.equal(r3.l.length,1);
 assert.ok(['NEED_NOT_OPEN','RESPONSE_NOT_SELECTABLE','OVERFILL','RESPONSE_ALREADY_SELECTED'].includes(r3.l[0].code),r3.l[0].code);
 assert.equal(agreements(n3),1);assert.equal(selections(n3),1);assert.equal(covered(n3),1);report.oneSeatLoser=r3.l[0].code;
 pass(report,'CONCURRENT_DIFFERENT_KEYS_ONE_SEAT_EXACTLY_ONE_WINNER');

 // 4. The Need row lock is the serialization point: a held lock is observed as a real wait, then the Selection completes.
 const n4=fixture('select-lock',1),a4=await submit(worker,rt.wp,n4);
 const locked=await lockedRace(`select 1 from public.needs where id=${q(n4)}::uuid for update`,()=>requester.rpc('rpc_select_response',selectArgs(n4,a4)));
 assert.ok(!locked.error,JSON.stringify(locked.error));assert.equal(agreements(n4),1);
 pass(report,'NEED_ROW_LOCK_SERIALIZES_SELECTION_OBSERVED_WAIT');

 // 5. Two Workers: remaining capacity is re-checked at Selection (OVERFILL), a one-seat race has one winner,
 //    and a two-slot Need yields one Agreement per accepted Selection.
 const B=await newWorker('worker-b',2);
 const n5=fixture('overfill',2);
 const a5a=await submit(worker,rt.wp,n5,{slots:1}),a5b=await submit(B.client,B.pid,n5,{slots:2});
 await select(n5,a5a);
 await denied(requester.rpc('rpc_select_response',selectArgs(n5,a5b)),'OVERFILL');
 assert.equal(agreements(n5),1);assert.equal(covered(n5),1);
 const n6=fixture('two-workers-one-seat',1);
 const a6a=await submit(worker,rt.wp,n6),a6b=await submit(B.client,B.pid,n6);
 const race6=(await Promise.all([selectArgs(n6,a6a),selectArgs(n6,a6b)].map(args=>requester.rpc('rpc_select_response',args)))).map(outcome);
 const r6=split(race6);assert.equal(r6.w.length,1,JSON.stringify(race6));
 assert.ok(['NEED_NOT_OPEN','RESPONSE_NOT_SELECTABLE','OVERFILL'].includes(r6.l[0].code),r6.l[0].code);
 assert.equal(agreements(n6),1);assert.equal(covered(n6),1);report.twoWorkersLoser=r6.l[0].code;
 const n7=fixture('one-agreement-per-selection',2);
 const a7a=await submit(worker,rt.wp,n7),a7b=await submit(B.client,B.pid,n7);
 const g7a=await select(n7,a7a),g7b=await select(n7,a7b);
 assert.notEqual(g7a,g7b);assert.equal(agreements(n7),2);assert.equal(selections(n7),2);assert.equal(covered(n7),2);
 pass(report,'TWO_WORKERS_NO_OVER_ALLOCATION_ONE_AGREEMENT_PER_ACCEPTED_SELECTION');

 // 6. Worker capacity CAS: a stale revision is denied; capacity lowered after applying blocks the Selection.
 const cap=await ok(worker.rpc('rpc_get_worker_capacity',{}));
 const up=await ok(worker.rpc('rpc_save_worker_capacity',{p_expected_revision:cap.revision,p_team_capacity:2}));
 const n8=fixture('capacity-cas',2),a8=await submit(worker,rt.wp,n8,{slots:2});
 const down=await ok(worker.rpc('rpc_save_worker_capacity',{p_expected_revision:up.capacity.revision,p_team_capacity:1}));
 assert.equal(down.idempotentReplay,false);
 await denied(worker.rpc('rpc_save_worker_capacity',{p_expected_revision:up.capacity.revision,p_team_capacity:3}),'WORKER_CAPACITY_VERSION_CONFLICT');
 await denied(requester.rpc('rpc_select_response',selectArgs(n8,a8)),'TEAM_CAPACITY_EXCEEDED');
 assert.equal(agreements(n8),0);
 await ok(worker.rpc('rpc_save_worker_capacity',{p_expected_revision:down.capacity.revision,p_team_capacity:2}));
 pass(report,'WORKER_CAPACITY_CAS_STALE_REVISION_DENIED_LOWERED_CAPACITY_BLOCKS_SELECTION');

 // 7. Overlapping fixed intervals: concurrent Selections of the same Worker yield one Agreement; the application path is blocked afterwards.
 const s=iso(3*864e5),e=iso(3*864e5+2*36e5);
 const nA=fixture('calendar-a',1,s,e),nB=fixture('calendar-b',1,s,e);
 const aA=await submit(worker,rt.wp,nA,{start:s,end:e}),aB=await submit(worker,rt.wp,nB,{start:s,end:e});
 const cal=(await Promise.all([selectArgs(nA,aA),selectArgs(nB,aB)].map(args=>requester.rpc('rpc_select_response',args)))).map(outcome);
 const rc=split(cal);assert.equal(rc.w.length,1,JSON.stringify(cal));
 assert.ok(rc.l[0].code==='WORKER_CALENDAR_CONFLICT'||(rc.l[0].code==='WORKER_NO_LONGER_ELIGIBLE'&&rc.l[0].detail.includes('CALENDAR_CONFLICT')),rc.l[0].code+' '+rc.l[0].detail);
 assert.equal(agreements(nA)+agreements(nB),1);
 assert.equal(count(`select count(*) from private.worker_calendar_events where worker_account_id=${q(workerId)}::uuid and state='BLOCKING'`),1);
 const nC=fixture('calendar-c',1,s,e);
 const blocked=outcome(await worker.rpc('rpc_submit_response',submitArgs(rt.wp,nC,{start:s,end:e})));
 assert.ok(!blocked.ok&&blocked.code==='WORKER_NOT_ELIGIBLE'&&blocked.detail.includes('CALENDAR_CONFLICT'),JSON.stringify(blocked));
 report.calendarLoser=rc.l[0].code;
 pass(report,'CONCURRENT_OVERLAPPING_SELECTIONS_ONE_WINNER_APPLICATION_PATH_BLOCKED');

 // 8. Invariant over every proof Need: never more covered slots than required, and one Agreement per accepted Selection.
 const bad=rows(`select n.id,n.required_slots,public.fn_need_covered_slots(n.id) covered,
  (select count(*) from public.agreements a where a.need_id=n.id) agreements,
  (select count(*) from public.need_selections s where s.need_id=n.id and s.status='SELECTED') selected
  from public.needs n where n.title like 'PKG006 %' and (public.fn_need_covered_slots(n.id)>n.required_slots
   or (select count(*) from public.agreements a where a.need_id=n.id)<>(select count(*) from public.need_selections s where s.need_id=n.id and s.status='SELECTED'))`);
 assert.deepEqual(bad,[]);
 report.proofNeeds=count("select count(*) from public.needs where title like 'PKG006 %'");
 pass(report,'NO_OVER_ALLOCATION_AND_ONE_AGREEMENT_PER_SELECTION_INVARIANT');
});
