// EX-06E bounded Lifecycle Recovery proof. Disposable loopback only, never canonical DEV.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createFixtures} from './lib/fixtures.mjs';
import {verifyClosedSearchMutationDenied} from './ex06e_mutation_verifier.mjs';

// Guard BEFORE importing the runtime that constructs database/Auth clients.
assert.equal(process.env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(process.env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
assert.equal(process.env.RU5_DEVICE_DB_URL,process.env.DB_URL);
const rt=await import('../pre_v3/closure_runtime.mjs');
const {q,rows,sql,ok,randomUUID}=rt;
const fx=createFixtures(rt,{needPath:'product'});
const outDir=process.env.EX06E_ARTIFACT_DIR ?? 'artifacts/ex06e';
fs.mkdirSync(outDir,{recursive:true});
const FACTS={
  'need.title':'EX06E lifecycle recovery',
  'need.description':'Sintetički zadatak za bounded lifecycle recovery proof.',
  'need.category':'Fizicki poslovi', 'need.required_skills':['fizicki poslovi'],
  'need.price_mode':'OFFERS', 'need.schedule_kind':'FLEXIBLE', 'need.people_needed':2,
  'need.task_country_code':'RS', 'need.task_geography':{mode:'STATIONARY',start:{city:'Novi Sad'}},
};
const WORKER={skills:['fizicki poslovi'],tools:[],vehicles:[],licenses:[],radiusKm:15};
const report={package:'EX-06E Lifecycle Recovery',sourceSha:process.env.GITHUB_SHA??null,
  result:'RUNNING',scenarios:[],certificate:null,catalog:null,
  limits:['Disposable SQL/Auth/PostgREST; not live DEV, provider or physical-phone proof.',
    'Time fixtures are labelled; no 24-hour post-execution extension is implemented or proved.']};
const checkpoint=()=>fs.writeFileSync(outDir+'/ex06e-lifecycle-recovery-report.json',JSON.stringify(report,null,2)+'\n');
const state=id=>rows(`select n.id,n.status,n.required_slots,public.fn_need_covered_slots(n.id) covered_slots,
  n.remaining_search_closed_at,n.response_deadline,n.schedule_kind,n.starts_at,n.ends_at
  from public.needs n where n.id=${q(id)}::uuid`)[0];
const schedule=id=>rows(`select next_run_at,attempts,last_status,last_reason from private.dispatch_schedule where need_id=${q(id)}::uuid`)[0]??null;
const deliveries=id=>Number(rows(`select count(*)::integer c from public.opportunity_deliveries where need_id=${q(id)}::uuid and status in('READY','SEEN')`)[0]?.c??0);
const opportunities=id=>Number(rows(`select count(*)::integer c from public.user_activity_events where entity_type='NEED' and entity_id=${q(id)}::uuid and event_type='OPPORTUNITY_AVAILABLE'`)[0]?.c??0);
const timeAllowed=id=>sql(`select private.need_search_time_admitted_v1(${q(id)}::uuid,statement_timestamp())::text`)==='true';
const closedSnapshot=id=>rows(`select n.id,md5(to_jsonb(n)::text) need_hash,n.remaining_search_closed_at,
  public.fn_need_covered_slots(n.id) covered_slots,n.required_slots,
  exists(select 1 from private.dispatch_schedule s where s.need_id=n.id) queued
  from public.needs n where n.id=${q(id)}::uuid`)[0];
const call=(client,name,args)=>client.rpc(name,args).abortSignal(AbortSignal.timeout(20000));
async function requester(label){return fx.createRequester({label:'ex06e-'+label,world:'REAL'});}
async function worker(label){return fx.createWorker({...WORKER,label:'ex06e-'+label});}
async function task(owner,label,people=2){
  const made=await fx.createNeedFromFacts(owner,{...FACTS,'need.title':'EX06E '+label,'need.people_needed':people});
  assert.equal(made.materialisation,'PRODUCT_PATH');
  const back=fx.readBackNeed(made.needId,made.intent);assert.deepEqual(back.mismatches,[]);
  return {needId:made.needId,needRevision:Number(back.row.revision),revision:Number(back.row.revision),requiredSlots:Number(back.row.required_slots)};
}
async function apply(w,t,slots=1){
  const a=await fx.submitApplication(w,t,{slots,price:3000});assert.equal(a.ok,true,'APPLICATION_REFUSED');return a.data;
}
async function select(owner,t,a){return fx.selectResponse(owner,t,a);}
async function cancel(person,id){await ok(call(person.client,'rpc_cancel_agreement',{p_agreement_id:id,p_reason:'EX06E lifecycle proof'}));}
const closeArgs=(t,key='ex06e-close-'+randomUUID())=>({p_need_id:t.needId,p_expected_revision:t.revision,p_client_request_id:key,p_reason:'EX06E lifecycle proof'});
async function close(owner,t){return ok(call(owner.client,'rpc_close_remaining_search',closeArgs(t)));}
const reopenArgs=(t,key='ex06e-reopen-'+randomUUID())=>closeArgs(t,key);
async function reopen(owner,t,key){return ok(call(owner.client,'rpc_reopen_remaining_search',reopenArgs(t,key)));}
function wave(id){return fx.runWave(id);}
async function denied(client,name,args,message){
  const result=await call(client,name,args);assert.ok(result.error,'EXPECTED_REFUSAL_MISSING');assert.equal(result.error.message,message);return result.error.code;
}
async function scoped(name,fn){
  const mark=fx.mark();
  try{
    const data=await fn();
    // Return only plain observations, NEVER actor objects or SDK clients/session state.
    const plain=JSON.parse(JSON.stringify(data));
    report.scenarios.push({name,status:'PASS',...plain});checkpoint();console.log('PASS '+name);
  }catch(error){
    report.scenarios.push({name,status:'FAIL',errorKind:error?.name??'Error'});report.result='FAIL';checkpoint();throw error;
  }finally{fx.retireSince(mark);}
}
const catalogHash=()=>sql(`select md5(string_agg(x,E'\\n' order by x)) from (
  select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||md5(replace(p.prosrc,E'\\r','')) x
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private')) s`);
const certBefore=fx.closureState(),catalogBefore=catalogHash();
const schedulers=fx.pauseSchedulers(),foreign=fx.parkForeign({schedule:true});checkpoint();
try{
  await scoped('2->1 OPEN searches missing 1',async()=>{
    const o=await requester('s1-r'),a=await worker('s1-a'),b=await worker('s1-b'),c=await worker('s1-c');
    const t=await task(o,'s1');await select(o,t,await apply(a,t));
    const before=state(t.needId);assert.equal(Number(before.covered_slots),1);assert.equal(before.remaining_search_closed_at,null);
    const w=wave(t.needId);assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),1);assert.ok(Number(w.inserted)>0);
    return {coverage:1,remaining:1,inserted:Number(w.inserted),spares:[b.id,c.id]};
  });
  await scoped('2->1 OPEN cancel searches missing 2',async()=>{
    const o=await requester('s2-r'),a=await worker('s2-a'),b=await worker('s2-b'),c=await worker('s2-c');
    const t=await task(o,'s2'),id=await select(o,t,await apply(a,t));await cancel(a,id);
    const after=state(t.needId);assert.equal(after.status,'SELECTION');assert.equal(Number(after.covered_slots),0);assert.equal(after.remaining_search_closed_at,null);
    assert.ok(schedule(t.needId));const w=wave(t.needId);assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),2);assert.ok(Number(w.inserted)>0);
    return {coverage:0,remaining:2,queued:true,inserted:Number(w.inserted),spares:[b.id,c.id]};
  });
  await scoped('2->2 one cancel searches missing 1',async()=>{
    const o=await requester('s3-r'),a=await worker('s3-a'),b=await worker('s3-b'),c=await worker('s3-c');
    const t=await task(o,'s3'),aa=await apply(a,t),ab=await apply(b,t);
    const id=await select(o,t,aa),unaffected=await select(o,t,ab);
    assert.equal(state(t.needId).status,'ACTIVE');assert.equal(Number(state(t.needId).covered_slots),2);
    const original=sql(`select md5(to_jsonb(a)::text) from public.agreements a where id=${q(unaffected)}::uuid`);
    await cancel(a,id);const after=state(t.needId);assert.equal(after.status,'SELECTION');assert.equal(Number(after.covered_slots),1);assert.ok(schedule(t.needId));
    assert.equal(sql(`select md5(to_jsonb(a)::text) from public.agreements a where id=${q(unaffected)}::uuid`),original);
    const w=wave(t.needId);assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),1);assert.ok(Number(w.inserted)>0);
    return {coverage:1,remaining:1,unaffectedAgreementUnchanged:true,inserted:Number(w.inserted),spare:c.id};
  });
  await scoped('2->1 CLOSED cancel keeps human authority and ZERO automatic matching',async()=>{
    const o=await requester('s4-r'),a=await worker('s4-a'),b=await worker('s4-b'),c=await worker('s4-c');
    const t=await task(o,'s4'),id=await select(o,t,await apply(a,t));
    const closed=await close(o,t);assert.equal(closed.remainingSearchClosed,true);assert.equal(Number(closed.closedRemainingSlots),1);assert.equal(schedule(t.needId),null);
    const closedAt=state(t.needId).remaining_search_closed_at;await cancel(a,id);
    const after=state(t.needId);assert.equal(after.status,'SELECTION');assert.equal(Number(after.covered_slots),0);assert.equal(after.remaining_search_closed_at,closedAt);assert.equal(schedule(t.needId),null);
    const count=deliveries(t.needId),events=opportunities(t.needId),w=wave(t.needId);
    assert.equal(w.status,'STOPPED');assert.equal(w.reason,'REMAINING_SEARCH_CLOSED');assert.equal(Number(w.inserted),0);
    // Explicit disposable stale queue fixture: the scheduler must delete it without ERROR/backoff.
    sql(`select private.enqueue_dispatch(${q(t.needId)}::uuid,statement_timestamp())`);assert.ok(schedule(t.needId));
    const tick=fx.runTick(null,25);assert.equal(Number(tick.failed),0);assert.ok(Number(tick.stopped)>=1);assert.equal(schedule(t.needId),null);
    const repeat=fx.runTick(null,25);assert.equal(Number(repeat.failed),0);assert.equal(schedule(t.needId),null);
    assert.equal(deliveries(t.needId),count);assert.equal(opportunities(t.needId),events);
    return {coverage:0,closed:true,closedAtPreserved:true,queued:false,newDeliveries:0,newOpportunityEvents:0,staleQueueRecovery:{first:tick,repeat,scheduleGone:true},spares:[b.id,c.id]};
  });
  await scoped('CLOSED + missing -> canonical reopen -> only missing capacity',async()=>{
    const o=await requester('s5-r'),a=await worker('s5-a'),b=await worker('s5-b'),c=await worker('s5-c');
    const t=await task(o,'s5'),id=await select(o,t,await apply(a,t));await close(o,t);
    const initial=closedSnapshot(t.needId);
    await denied(b.client,'rpc_reopen_remaining_search',reopenArgs(t),'NEED_NOT_OWNED');
    await denied(o.client,'rpc_reopen_remaining_search',{...reopenArgs(t),p_expected_revision:t.revision+1},'STALE_REVIEW_REQUIRED');
    assert.deepEqual(closedSnapshot(t.needId),initial);
    const firstKey='ex06e-one-'+randomUUID(),one=await reopen(o,t,firstKey);
    assert.equal(one.authoritative,true);assert.equal(Number(one.reopenedRemainingSlots),1);assert.equal(Number(state(t.needId).covered_slots),1);
    // Closing again is a NEW user decision. An OLD successful reopen receipt must not execute again.
    await close(o,t);const reclosed=closedSnapshot(t.needId);
    const oldReplay=await reopen(o,t,firstKey);assert.equal(oldReplay.idempotentReplay,true);assert.deepEqual(closedSnapshot(t.needId),reclosed);
    await cancel(a,id);assert.equal(Number(state(t.needId).covered_slots),0);assert.ok(state(t.needId).remaining_search_closed_at);assert.equal(schedule(t.needId),null);
    const key='ex06e-two-'+randomUUID(),receipt=await reopen(o,t,key),replay=await reopen(o,t,key);
    assert.equal(receipt.authoritative,true);assert.equal(receipt.remainingSearchClosed,false);assert.equal(Number(receipt.reopenedRemainingSlots),2);assert.equal(receipt.idempotentReplay,false);assert.equal(replay.idempotentReplay,true);
    const opened=state(t.needId);assert.equal(opened.remaining_search_closed_at,null);assert.ok(schedule(t.needId));
    const w=wave(t.needId);assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),2);assert.ok(Number(w.inserted)>0);
    return {partialReopenRemaining:1,afterCancelRemaining:2,oldReplayDidNotReopen:true,nonOwnerDenied:true,staleRevisionDenied:true,inserted:Number(w.inserted),spares:[b.id,c.id]};
  });
  await scoped('time guard: expired execution window does not revive matching',async()=>{
    const o=await requester('time-expired-r'),a=await worker('time-expired-a'),b=await worker('time-expired-b'),t=await task(o,'time-expired');
    await fx.setCapacity(a,2);const id=await select(o,t,await apply(a,t,2));
    // Labelled time fixture: move time facts only; never run this against DEV.
    sql(`begin;set local session_replication_role=replica;
      update public.needs set schedule_kind='FIXED_WINDOW',starts_at=statement_timestamp()-interval '27 hours',ends_at=statement_timestamp()-interval '26 hours' where id=${q(t.needId)}::uuid;
      update public.agreement_versions set terms=jsonb_set(jsonb_set(terms,'{proposed_start_at}',to_jsonb((statement_timestamp()-interval '27 hours')::text),true),'{proposed_end_at}',to_jsonb((statement_timestamp()-interval '26 hours')::text),true)
      where agreement_id=${q(id)}::uuid and version=(select current_version from public.agreements where id=${q(id)}::uuid);commit;`);
    assert.equal(timeAllowed(t.needId),false);await cancel(a,id);
    assert.equal(state(t.needId).status,'SELECTION');assert.equal(Number(state(t.needId).covered_slots),0);assert.equal(schedule(t.needId),null);
    const w=wave(t.needId);assert.equal(w.status,'STOPPED');assert.equal(w.reason,'SEARCH_WINDOW_CLOSED');assert.equal(Number(w.inserted),0);
    const events=opportunities(t.needId);sql(`select private.enqueue_dispatch(${q(t.needId)}::uuid,statement_timestamp())`);
    const tick=fx.runTick(null,25);assert.equal(Number(tick.failed),0);assert.equal(schedule(t.needId),null);assert.equal(opportunities(t.needId),events);
    return {timeAdmitted:false,queued:false,waveReason:w.reason,staleQueueStopped:true,spare:b.id};
  });
  await scoped('time guard: a still-future execution window permits missing-capacity recovery',async()=>{
    const o=await requester('time-open-r'),a=await worker('time-open-a'),b=await worker('time-open-b'),t=await task(o,'time-open');
    await fx.setCapacity(a,2);const id=await select(o,t,await apply(a,t,2));
    const startsAt=new Date(Date.now()+5*60_000).toISOString(),endsAt=new Date(Date.now()+55*60_000).toISOString();
    await fx.setAvailability(b,{timezone:'Europe/Belgrade',availableNow:true,rules:[],windows:[{id:randomUUID(),startsAt,endsAt,state:'AVAILABLE',label:'EX06E replacement window'}]});
    sql(`begin;set local session_replication_role=replica;
      update public.needs set schedule_kind='FIXED_WINDOW',starts_at=${q(startsAt)}::timestamptz,ends_at=${q(endsAt)}::timestamptz where id=${q(t.needId)}::uuid;
      update public.agreement_versions set terms=jsonb_set(jsonb_set(terms,'{proposed_start_at}',to_jsonb(${q(startsAt)}::text),true),'{proposed_end_at}',to_jsonb(${q(endsAt)}::text),true)
      where agreement_id=${q(id)}::uuid and version=(select current_version from public.agreements where id=${q(id)}::uuid);commit;`);
    await cancel(a,id);assert.equal(timeAllowed(t.needId),true);assert.ok(schedule(t.needId));
    const w=wave(t.needId);assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),2);assert.ok(Number(w.inserted)>0);
    return {timeAdmitted:true,queued:true,remaining:2,window:{startsAt,endsAt},spare:b.id};
  });
  await scoped('response_deadline remains a guard only, not a new V1 feature',async()=>{
    const o=await requester('deadline-r'),a=await worker('deadline-a'),t=await task(o,'deadline'),id=await select(o,t,await apply(a,t));
    sql(`begin;set local session_replication_role=replica;update public.needs set response_deadline=statement_timestamp()-interval '1 minute' where id=${q(t.needId)}::uuid;commit;`);
    assert.equal(timeAllowed(t.needId),false);await cancel(a,id);assert.equal(schedule(t.needId),null);
    const w=wave(t.needId);assert.equal(w.status,'STOPPED');assert.equal(w.reason,'SEARCH_WINDOW_CLOSED');
    return {timeAdmitted:false,queued:false,waveReason:w.reason};
  });
  await scoped('remaining_search state stays server-owned',async()=>{
    const o=await requester('guard-r'),a=await worker('guard-a'),t=await task(o,'guard');await select(o,t,await apply(a,t));await close(o,t);
    // A SELECT-visible row need not be UPDATE-visible. Prove both the actual subject and non-mutation.
    const owned=await ok(call(o.client,'rpc_read_task',{p_need_id:t.needId}));assert.equal(owned.id,t.needId);assert.ok(owned.remaining_search_closed_at);
    const before=closedSnapshot(t.needId),events=opportunities(t.needId),count=deliveries(t.needId);
    const res=await o.client.from('needs').update({remaining_search_closed_at:null}).eq('id',t.needId).select('id').abortSignal(AbortSignal.timeout(20000));
    const observation=verifyClosedSearchMutationDenied(res,before,closedSnapshot(t.needId));
    const readback=await ok(call(o.client,'rpc_read_task',{p_need_id:t.needId}));assert.equal(readback.id,t.needId);assert.equal(readback.remaining_search_closed_at,owned.remaining_search_closed_at);
    assert.equal(opportunities(t.needId),events);assert.equal(deliveries(t.needId),count);
    return {...observation,ownedReadbackConfirmed:true,newOpportunityEvents:0,newDeliveries:0};
  });
  const certAfter=fx.closureState(),catalogAfter=catalogHash();
  report.certificate={before:certBefore,after:certAfter,unchanged:JSON.stringify(certBefore)===JSON.stringify(certAfter)};assert.equal(report.certificate.unchanged,true);
  report.catalog={before:catalogBefore,after:catalogAfter,unchanged:catalogBefore===catalogAfter};assert.equal(report.catalog.unchanged,true);
  report.result='PASS';
}catch(error){report.result='FAIL';throw error;}
finally{
  try{fx.parkAll();fx.restoreForeign(foreign);}catch(error){report.cleanup='FAILED';report.result='FAIL';throw error;}finally{checkpoint();}
}
console.log('PASS EX06E_LIFECYCLE_RECOVERY '+JSON.stringify({scenarios:report.scenarios.length,certificate:report.certificate.unchanged,catalog:report.catalog.unchanged}));
