// EX-06E bounded Lifecycle Recovery proof. Disposable loopback Auth/Postgres only; never canonical DEV.\n// Harness note: live79 exports RU5_* through GITHUB_ENV; no sidecar env.sh is required.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createFixtures} from './lib/fixtures.mjs';

assert.equal(process.env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(process.env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const {q,rows,sql,ok,randomUUID}=rt;
const fx=createFixtures(rt,{needPath:'product'});
const outDir=process.env.EX06E_ARTIFACT_DIR ?? 'artifacts/ex06e';
fs.mkdirSync(outDir,{recursive:true});

const FACTS={
  'need.title':'EX06E lifecycle recovery',
  'need.description':'Sintetički zadatak za bounded lifecycle recovery proof.',
  'need.category':'Fizicki poslovi',
  'need.required_skills':['fizicki poslovi'],
  'need.required_tools':[],
  'need.required_vehicles':[],
  'need.required_licenses':[],
  'need.price_mode':'OFFERS',
  'need.schedule_kind':'FLEXIBLE',
  'need.people_needed':2,
  'need.task_country_code':'RS',
  'need.task_geography':{mode:'STATIONARY',start:{city:'Novi Sad'}},
};
const WORKER={skills:['fizicki poslovi'],tools:[],vehicles:[],licenses:[],radiusKm:15};

const report={package:'EX-06E Lifecycle Recovery',sourceSha:process.env.GITHUB_SHA??null,scenarios:[],certificate:null,catalog:null};
const state=id=>rows(`select n.status,n.required_slots,public.fn_need_covered_slots(n.id) covered_slots,
  n.remaining_search_closed_at,n.response_deadline,n.schedule_kind,n.starts_at,n.ends_at
  from public.needs n where n.id=${q(id)}::uuid`)[0];
const schedule=id=>rows(`select next_run_at,attempts,last_status,last_reason from private.dispatch_schedule where need_id=${q(id)}::uuid`)[0]??null;
const deliveries=id=>Number(rows(`select count(*)::integer c from public.opportunity_deliveries where need_id=${q(id)}::uuid and status in('READY','SEEN')`)[0]?.c??0);
const timeAllowed=id=>sql(`select private.need_search_time_admitted_v1(${q(id)}::uuid,statement_timestamp())::text`)==='true';

async function requester(label){return fx.createRequester({label:'ex06e-'+label,world:'REAL'});}
async function worker(label){return fx.createWorker({...WORKER,label:'ex06e-'+label});}
async function task(owner,label,people=2){
  const made=await fx.createNeedFromFacts(owner,{...FACTS,'need.title':'EX06E '+label,'need.people_needed':people});
  const back=fx.readBackNeed(made.needId,made.intent);
  assert.deepEqual(back.mismatches,[]);
  return {needId:made.needId,needRevision:Number(back.row.revision),revision:Number(back.row.revision),requiredSlots:Number(back.row.required_slots)};
}
async function apply(w,t,slots=1,window=null){
  const a=await fx.submitApplication(w,t,{slots,price:3000,proposedStartAt:window?.start??null,proposedEndAt:window?.end??null});
  assert.equal(a.ok,true,JSON.stringify(a));
  return a.data;
}
async function select(owner,t,a){return fx.selectResponse(owner,t,a);}
async function cancel(person,agreementId){await ok(person.client.rpc('rpc_cancel_agreement',{p_agreement_id:agreementId,p_reason:'EX06E lifecycle proof'}));}
async function close(owner,t){
  return ok(owner.client.rpc('rpc_close_remaining_search',{p_need_id:t.needId,p_expected_revision:t.revision,
    p_client_request_id:'ex06e-close-'+randomUUID(),p_reason:'EX06E lifecycle proof'}));
}
async function reopen(owner,t,key='ex06e-reopen-'+randomUUID()){
  return ok(owner.client.rpc('rpc_reopen_remaining_search',{p_need_id:t.needId,p_expected_revision:t.revision,p_client_request_id:key,p_reason:'EX06E lifecycle proof'}));
}
function wave(id){return fx.runWave(id);}
function markResult(name,data){report.scenarios.push({name,status:'PASS',...data});}
async function scoped(name,fn){
  const mark=fx.mark();
  try{const data=await fn();markResult(name,data);}
  finally{fx.retireSince(mark);}
}

const certBefore=fx.closureState();
const catalogBefore=sql(`select md5(string_agg(x,'\\n' order by x)) from (
  select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||md5(replace(p.prosrc,E'\\r','')) x
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private')
) s`);
const schedulers=fx.pauseSchedulers();
const foreign=fx.parkForeign({schedule:true});

try{
  await scoped('2->1 OPEN searches missing 1',async()=>{
    const o=await requester('s1-r'),a=await worker('s1-a'),b=await worker('s1-b'),c=await worker('s1-c');
    const t=await task(o,'s1');
    const app=await apply(a,t,1);await select(o,t,app);
    const before=state(t.needId);assert.equal(Number(before.covered_slots),1);assert.equal(before.remaining_search_closed_at,null);
    const w=wave(t.needId);
    assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),1);assert.ok(Number(w.inserted)>0);
    return {coverage:Number(before.covered_slots),remaining:Number(w.remainingSlots),inserted:Number(w.inserted),spares:[b.id,c.id]};
  });

  await scoped('2->1 OPEN cancel searches missing 2',async()=>{
    const o=await requester('s2-r'),a=await worker('s2-a'),b=await worker('s2-b'),c=await worker('s2-c');
    const t=await task(o,'s2');
    const app=await apply(a,t,1);const agreementId=await select(o,t,app);
    await cancel(a,agreementId);
    const after=state(t.needId);assert.equal(after.status,'SELECTION');assert.equal(Number(after.covered_slots),0);assert.equal(after.remaining_search_closed_at,null);
    assert.ok(schedule(t.needId),'cancellation must queue open admitted search');
    const w=wave(t.needId);assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),2);assert.ok(Number(w.inserted)>0);
    return {coverage:Number(after.covered_slots),remaining:Number(w.remainingSlots),queued:true,inserted:Number(w.inserted),spares:[b.id,c.id]};
  });

  await scoped('2->2 one cancel searches missing 1',async()=>{
    const o=await requester('s3-r'),a=await worker('s3-a'),b=await worker('s3-b'),c=await worker('s3-c');
    const t=await task(o,'s3');
    const aa=await apply(a,t,1);const ab=await apply(b,t,1);
    const agreementA=await select(o,t,aa);await select(o,t,ab);
    assert.equal(state(t.needId).status,'ACTIVE');assert.equal(Number(state(t.needId).covered_slots),2);
    await cancel(a,agreementA);
    const after=state(t.needId);assert.equal(after.status,'SELECTION');assert.equal(Number(after.covered_slots),1);assert.ok(schedule(t.needId));
    const w=wave(t.needId);assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),1);assert.ok(Number(w.inserted)>0);
    return {coverage:Number(after.covered_slots),remaining:Number(w.remainingSlots),queued:true,inserted:Number(w.inserted),spare:c.id};
  });

  await scoped('2->1 CLOSED cancel keeps human authority and ZERO automatic matching',async()=>{
    const o=await requester('s4-r'),a=await worker('s4-a'),b=await worker('s4-b'),c=await worker('s4-c');
    const t=await task(o,'s4');
    const app=await apply(a,t,1);const agreementId=await select(o,t,app);
    const closed=await close(o,t);assert.equal(closed.remainingSearchClosed,true);assert.equal(Number(closed.closedRemainingSlots),1);
    assert.equal(schedule(t.needId),null);
    await cancel(a,agreementId);
    const after=state(t.needId);assert.equal(after.status,'SELECTION');assert.equal(Number(after.covered_slots),0);assert.ok(after.remaining_search_closed_at);
    assert.equal(schedule(t.needId),null,'closed search cancellation must not enqueue');
    const beforeDeliveries=deliveries(t.needId);
    const w=wave(t.needId);assert.equal(w.status,'STOPPED');assert.equal(w.reason,'REMAINING_SEARCH_CLOSED');assert.equal(Number(w.inserted),0);
    assert.equal(deliveries(t.needId),beforeDeliveries);
    return {coverage:Number(after.covered_slots),closed:true,queued:false,waveReason:w.reason,newDeliveries:0,spares:[b.id,c.id],needId:t.needId,owner:o,t};
  });

  await scoped('CLOSED + missing -> canonical reopen -> only missing capacity',async()=>{
    const o=await requester('s5-r'),a=await worker('s5-a'),b=await worker('s5-b'),c=await worker('s5-c');
    const t=await task(o,'s5');
    const app=await apply(a,t,1);const agreementId=await select(o,t,app);
    await close(o,t);await cancel(a,agreementId);
    const closed=state(t.needId);assert.equal(Number(closed.covered_slots),0);assert.ok(closed.remaining_search_closed_at);assert.equal(schedule(t.needId),null);
    const key='ex06e-reopen-'+randomUUID();
    const receipt=await reopen(o,t,key);
    assert.equal(receipt.authoritative,true);assert.equal(receipt.remainingSearchClosed,false);assert.equal(Number(receipt.reopenedRemainingSlots),2);assert.equal(receipt.idempotentReplay,false);
    const replay=await reopen(o,t,key);assert.equal(replay.idempotentReplay,true);assert.equal(Number(replay.reopenedRemainingSlots),2);
    const opened=state(t.needId);assert.equal(opened.remaining_search_closed_at,null);assert.ok(schedule(t.needId));
    const w=wave(t.needId);assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),2);assert.ok(Number(w.inserted)>0);
    return {receipt:{remaining:Number(receipt.reopenedRemainingSlots),replay:replay.idempotentReplay},coverage:Number(opened.covered_slots),remaining:Number(w.remainingSlots),inserted:Number(w.inserted),spares:[b.id,c.id]};
  });

  await scoped('time guard: expired accepted window +24h does not revive matching',async()=>{
    const o=await requester('time-expired-r'),a=await worker('time-expired-a'),b=await worker('time-expired-b');
    const t=await task(o,'time-expired');
    const app=await apply(a,t,2);const agreementId=await select(o,t,app);
    // Labelled time fixture: no product writer can create a newly-published past window. Only clock facts are moved.
    sql(`begin;set local session_replication_role=replica;
      update public.needs set schedule_kind='FIXED_WINDOW',starts_at=statement_timestamp()-interval '27 hours',ends_at=statement_timestamp()-interval '26 hours' where id=${q(t.needId)}::uuid;
      update public.agreement_versions set terms=jsonb_set(jsonb_set(terms,'{proposed_start_at}',to_jsonb((statement_timestamp()-interval '27 hours')::text),true),
        '{proposed_end_at}',to_jsonb((statement_timestamp()-interval '26 hours')::text),true)
      where agreement_id=${q(agreementId)}::uuid and version=(select current_version from public.agreements where id=${q(agreementId)}::uuid);
      commit;`);
    assert.equal(timeAllowed(t.needId),false);
    await cancel(a,agreementId);
    const after=state(t.needId);assert.equal(after.status,'SELECTION');assert.equal(Number(after.covered_slots),0);assert.equal(schedule(t.needId),null);
    const w=wave(t.needId);assert.equal(w.status,'STOPPED');assert.equal(w.reason,'SEARCH_WINDOW_CLOSED');assert.equal(Number(w.inserted),0);
    return {timeAdmitted:false,queued:false,waveReason:w.reason,spare:b.id};
  });

  await scoped('time guard: cancellation inside 24h replacement window may recover missing capacity',async()=>{
    const o=await requester('time-open-r'),a=await worker('time-open-a'),b=await worker('time-open-b');
    const t=await task(o,'time-open');
    const app=await apply(a,t,2);const agreementId=await select(o,t,app);
    sql(`begin;set local session_replication_role=replica;
      update public.needs set schedule_kind='FIXED_WINDOW',starts_at=statement_timestamp()-interval '3 hours',ends_at=statement_timestamp()-interval '2 hours' where id=${q(t.needId)}::uuid;
      update public.agreement_versions set terms=jsonb_set(jsonb_set(terms,'{proposed_start_at}',to_jsonb((statement_timestamp()-interval '3 hours')::text),true),
        '{proposed_end_at}',to_jsonb((statement_timestamp()-interval '2 hours')::text),true)
      where agreement_id=${q(agreementId)}::uuid and version=(select current_version from public.agreements where id=${q(agreementId)}::uuid);
      commit;`);
    await cancel(a,agreementId);
    assert.equal(timeAllowed(t.needId),true);assert.ok(schedule(t.needId));
    const w=wave(t.needId);assert.equal(w.status,'SENT');assert.equal(Number(w.remainingSlots),2);assert.ok(Number(w.inserted)>0);
    return {timeAdmitted:true,queued:true,remaining:Number(w.remainingSlots),spare:b.id};
  });

  await scoped('response_deadline remains a guard only, not a new V1 feature',async()=>{
    const o=await requester('deadline-r'),a=await worker('deadline-a');
    const t=await task(o,'deadline');
    const app=await apply(a,t,1);const agreementId=await select(o,t,app);
    sql(`begin;set local session_replication_role=replica;update public.needs set response_deadline=statement_timestamp()-interval '1 minute' where id=${q(t.needId)}::uuid;commit;`);
    assert.equal(timeAllowed(t.needId),false);
    await cancel(a,agreementId);
    assert.equal(schedule(t.needId),null);
    const w=wave(t.needId);assert.equal(w.status,'STOPPED');assert.equal(w.reason,'SEARCH_WINDOW_CLOSED');
    return {timeAdmitted:false,queued:false,waveReason:w.reason};
  });

  // Direct client mutation remains forbidden; REOPEN is the only new writer.
  await scoped('remaining_search state stays server-owned',async()=>{
    const o=await requester('guard-r'),a=await worker('guard-a');
    const t=await task(o,'guard');
    const app=await apply(a,t,1);await select(o,t,app);await close(o,t);
    const res=await o.client.from('needs').update({remaining_search_closed_at:null}).eq('id',t.needId).select('id');
    assert.ok(res.error,'direct clear must fail');
    assert.match(String(res.error.message),/REMAINING_SEARCH_STATE_IS_SERVER_OWNED/);
    return {directMutationDenied:true};
  });

  const certAfter=fx.closureState();
  report.certificate={before:certBefore,after:certAfter,unchanged:JSON.stringify(certBefore)===JSON.stringify(certAfter)};
  assert.equal(report.certificate.unchanged,true);
  const catalogAfter=sql(`select md5(string_agg(x,'\\n' order by x)) from (
    select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||md5(replace(p.prosrc,E'\\r','')) x
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private')
  ) s`);
  // Candidate itself is already present for the whole proof, so catalog must remain stable while scenarios write only data.
  report.catalog={before:catalogBefore,after:catalogAfter,unchanged:catalogBefore===catalogAfter};assert.equal(report.catalog.unchanged,true);
  report.schedulers=schedulers;report.result='PASS';
} finally {
  try{fx.parkAll();fx.restoreForeign(foreign);}catch{}
}

fs.writeFileSync(outDir+'/ex06e-lifecycle-recovery-report.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS EX06E_LIFECYCLE_RECOVERY '+JSON.stringify({scenarios:report.scenarios.length,certificate:report.certificate?.unchanged,catalog:report.catalog?.unchanged}));
