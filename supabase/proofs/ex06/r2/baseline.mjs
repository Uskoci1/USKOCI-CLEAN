// Reproduce the original closed-search retry before the combined candidate and after exact code revert.
import assert from 'node:assert/strict';
import fs from 'node:fs';
assert.equal(process.env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(process.env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
assert.equal(process.env.RU5_DEVICE_DB_URL,process.env.DB_URL);
const rt=await import('../../pre_v3/closure_runtime.mjs');
const {createFixtures}=await import('../lib/fixtures.mjs');
const fx=createFixtures(rt,{needPath:'product'}),{q,sql,ok,randomUUID}=rt;
const phase=process.argv[2];assert.ok(['before','after-revert'].includes(phase));
const record={phase,result:'RUNNING'};const path=process.env.EX06E_R2_DIR+'/baseline-'+phase+'.json';
fx.pauseSchedulers();const foreign=fx.parkForeign({schedule:true});
try{
 const o=await fx.createRequester({label:'r2-'+phase,world:'REAL'});
 const spec={skills:['fizicki poslovi'],tools:[],vehicles:[],licenses:[],radiusKm:15};
 const a=await fx.createWorker({...spec,label:'r2-baseline-a-'+phase});await fx.createWorker({...spec,label:'r2-baseline-b-'+phase});
 const made=await fx.createNeedFromFacts(o,{'need.title':'R2 baseline','need.description':'Sintetički prenos kutije za lifecycle proof.',
 'need.category':'Fizicki poslovi','need.required_skills':['fizicki poslovi'],'need.price_mode':'OFFERS','need.schedule_kind':'FLEXIBLE',
 'need.people_needed':2,'need.task_country_code':'RS','need.task_geography':{mode:'STATIONARY',start:{city:'Novi Sad'}}});
 assert.equal(made.materialisation,'PRODUCT_PATH');const back=fx.readBackNeed(made.needId,made.intent);assert.deepEqual(back.mismatches,[]);
 const t={needId:made.needId,needRevision:Number(back.row.revision)};
 const app=await fx.submitApplication(a,t,{slots:1});assert.equal(app.ok,true);
 const id=await fx.selectResponse(o,t,app.data);
 await ok(o.client.rpc('rpc_close_remaining_search',{p_need_id:t.needId,p_expected_revision:t.needRevision,p_client_request_id:'r2-baseline-'+randomUUID(),p_reason:'R2 baseline'}));
 await ok(a.client.rpc('rpc_cancel_agreement',{p_agreement_id:id,p_reason:'R2 baseline'}));
 // Labelled local scheduler isolation, never DEV.
 sql(`delete from private.dispatch_schedule where need_id<>${q(t.needId)}::uuid`);
 assert.equal(fx.readSchedule(t.needId).queued,true);
 const tick=fx.runTick(null,25),state=fx.readSchedule(t.needId);
 assert.equal(Number(tick.failed),1);assert.equal(state.lastStatus,'ERROR');assert.match(state.lastReason,/NEED_REMAINING_SEARCH_CLOSED/);
 Object.assign(record,{result:'PASS_EXPECTED_OLD_FAILURE',tick,closedTargetRetryReproduced:true});
}finally{try{fx.parkAll();fx.restoreForeign(foreign);}finally{fs.writeFileSync(path,JSON.stringify(record,null,2)+'\n');}}
console.log('PASS original closed-search failure reproduced '+phase);
