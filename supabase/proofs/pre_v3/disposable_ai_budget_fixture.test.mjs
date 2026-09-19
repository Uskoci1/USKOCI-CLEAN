// Synthetic SQL lifecycle only. Real Auth/SQL/127 admission remains in132/145.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDisposableAiBudgetFixture} from './disposable_ai_budget_fixture.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const accountId=id(900),operationId=id(901),stamp='2026-09-01T00:00:00+00:00';
const env={RU5_DEVICE_SUPABASE_URL:'http://127.0.0.1:54321',RU5_DEVICE_DB_URL:'postgresql://postgres:synthetic@127.0.0.1:54322/postgres'};
const clone=x=>structuredClone(x);
function exhausted(){return{
 budget:[{singleton:true,enabled:false,ceiling_microusd:5000000,reserved_microusd:5000000,price_valid_until:'2020-01-01T00:00:00+00:00'}],
 accounts:[{account_id:id(1),admitted_at:stamp,retired_at:null},{account_id:id(2),admitted_at:stamp,retired_at:stamp}],
 reservations:Array.from({length:21},(_,i)=>({id:id(10+i),operation_id:id(100+i),account_id:id(i%2+1),
  kind:i<16?'LLM':'STT',max_cost_microusd:i<16?250000:200000,created_at:stamp})),
};}
function fake(initial=exhausted()){
 let state=clone(initial);const calls=[];const faults={};
 const sql=s=>{
  calls.push(s);if(s.startsWith('select jsonb_build_object'))return JSON.stringify(state);
  assert.match(s,/^begin;/);assert.match(s,/lock table private\.ai_test_budget_v5,private\.ai_test_accounts_v5,private\.ai_test_reservations_v5 in access exclusive mode/);
  const guard=/is distinct from '((?:''|[^'])*)'::jsonb/.exec(s);assert.ok(guard);
  if(faults.beforeCompare){faults.beforeCompare(state);delete faults.beforeCompare;}
  assert.deepEqual(state,JSON.parse(guard[1].replaceAll("''","'")),'Synthetic transaction snapshot mismatch');
  if(faults.setupBefore&& !s.includes('jsonb_populate_recordset'))throw faults.setupBefore;
  if(s.includes('jsonb_populate_recordset')){
   const restored={};for(const [name,table] of Object.entries({budget:'ai_test_budget_v5',accounts:'ai_test_accounts_v5',reservations:'ai_test_reservations_v5'})){
    const match=new RegExp(`null::private\\.${table},'((?:''|[^'])*)'::jsonb`).exec(s);assert.ok(match);
    restored[name]=JSON.parse(match[1].replaceAll("''","'"));
   }state=restored;
  }else{
   const expiry=/price_valid_until='([^']+)'::timestamptz/.exec(s)[1];
   const admitted=/values\('([^']+)'::uuid,'([^']+)'::timestamptz\)/.exec(s);
   state={budget:[{...state.budget[0],enabled:true,reserved_microusd:0,price_valid_until:expiry}],
    accounts:[{account_id:admitted[1],admitted_at:admitted[2],retired_at:null}],reservations:[]};
   if(faults.setupAfter)throw faults.setupAfter;
  }return '';
 };
 return{sql,calls,faults,get state(){return state;},addReservation(overrides={}){
  state.reservations.push({id:id(902),operation_id:operationId,account_id:accountId,kind:'LLM',max_cost_microusd:250000,created_at:stamp,...overrides});
  state.budget[0].reserved_microusd=state.reservations.reduce((sum,r)=>sum+r.max_cost_microusd,0);
 }};
}
const create=f=>createDisposableAiBudgetFixture({sql:f.sql,env,accountId,operationId});
const mutations=f=>f.calls.filter(s=>s.startsWith('begin;'));

test('exhausted127 numeric JSON fixture isolates a real empty ledger and restores every original row and sum',()=>{
 const prior=exhausted(),f=fake(prior),fixture=create(f);
 assert.deepEqual(fixture.summary,{priorReservedMicrousd:5000000,priorReservationCount:21,priorReservationSumMicrousd:5000000,
  priorAccountCount:2,priorEnabled:false,priorFixtureLedgerMismatch:false,numericSqlJsonVerified:true,isolatedDisposableLedger:true});
 fixture.enter();assert.equal(f.state.budget[0].reserved_microusd,0);assert.equal(f.state.reservations.length,0);assert.equal(f.state.accounts.length,1);
 assert.throws(()=>fixture.assertReserved(),/EXPECTED_ONE_REAL_RESERVATION/);
 f.addReservation();fixture.assertReserved();fixture.assertReserved();fixture.restore();
 assert.deepEqual(f.state,prior);assert.equal(mutations(f).length,2);
 fixture.restore();assert.equal(mutations(f).length,2,'repeated cleanup is read-only');
});
test('non-loopback Auth or DB rejects before snapshot or mutation, without printing URLs',()=>{
 for(const changed of [{RU5_DEVICE_SUPABASE_URL:'https://example.supabase.co'},{RU5_DEVICE_DB_URL:'postgresql://postgres:PRIVATE@remote.example/postgres'}]){
  const f=fake();assert.throws(()=>createDisposableAiBudgetFixture({sql:f.sql,env:{...env,...changed},accountId,operationId}),e=>!e.message.includes('PRIVATE')&&!e.message.includes('remote.example'));
  assert.equal(f.calls.length,0);
 }
});
test('136 export-only allocations are reported separately and restored exactly, while actual fixture sum stays strict',()=>{
 const prior=exhausted();for(let i=0;i<2;i++)prior.reservations.push({id:id(500+i),operation_id:id(600+i),account_id:id(i+1),kind:'LLM',max_cost_microusd:250000,created_at:stamp});
 const f=fake(prior),fixture=create(f);assert.equal(fixture.summary.priorReservedMicrousd,5000000);
 assert.equal(fixture.summary.priorReservationSumMicrousd,5500000);assert.equal(fixture.summary.priorFixtureLedgerMismatch,true);
 fixture.enter();f.addReservation();fixture.assertReserved();fixture.restore();assert.deepEqual(f.state,prior);
});
test('string bigint, unknown columns and existing operation identity are not coerced or reset',()=>{
 for(const change of [s=>s.budget[0].reserved_microusd='5000000',s=>s.budget[0].extra='PRIVATE',
  s=>s.reservations[0].operation_id=operationId]){
  const initial=exhausted();change(initial);const f=fake(initial);assert.throws(()=>create(f),/BUDGET_FIXTURE_/);assert.equal(mutations(f).length,0);
 }
});
test('active fixture cannot claim or clean a reservation when the real counter and sum disagree',()=>{
 const f=fake(),fixture=create(f);fixture.enter();f.addReservation();f.state.budget[0].reserved_microusd=0;
 assert.throws(()=>fixture.assertReserved(),/GLOBAL_SUM_MISMATCH/);assert.throws(()=>fixture.restore(),/GLOBAL_SUM_MISMATCH/);assert.equal(mutations(f).length,1);
});
test('unknown account or operation cannot be deleted by cleanup',()=>{
 for(const tamper of [f=>f.state.accounts.push({account_id:id(999),admitted_at:stamp,retired_at:null}),
  f=>f.addReservation({operation_id:id(999)}),f=>f.addReservation({account_id:id(999)}),
  f=>{f.state.budget[0].price_valid_until='2026-12-31T00:00:00Z';}]){
  const f=fake(),fixture=create(f);fixture.enter();tamper(f);const before=clone(f.state);
  assert.throws(()=>fixture.restore(),/BUDGET_FIXTURE_UNEXPECTED_CURRENT_STATE/);
  assert.deepEqual(f.state,before);assert.equal(mutations(f).length,1);
 }
});
test('same known operation with wrong cost or duplicate reservation rejects rather than hiding ledger corruption',()=>{
 for(const mutate of [f=>f.addReservation({max_cost_microusd:1}),f=>{f.addReservation();f.addReservation({id:id(999)});}]){
  const f=fake(),fixture=create(f);fixture.enter();mutate(f);const before=clone(f.state);
  assert.throws(()=>fixture.restore(),/BUDGET_FIXTURE_(RESERVATION_INVALID|DUPLICATE)/);
  assert.deepEqual(f.state,before);assert.equal(mutations(f).length,1);
 }
});
test('setup lost ACK reconciles and restores, without a second setup or replacing the primary failure',()=>{
 const original=exhausted(),f=fake(original),fixture=create(f),primary=new Error('SYNTHETIC_SETUP_ACK_UNKNOWN');f.faults.setupAfter=primary;
 let caught;try{fixture.enter();}catch(error){caught=error;}finally{fixture.restore();}
 assert.equal(caught,primary);assert.deepEqual(f.state,original);assert.equal(mutations(f).length,2);
});
test('setup failure before commit preserves the previous snapshot without a destructive cleanup',()=>{
 const original=exhausted(),f=fake(original),fixture=create(f),primary=new Error('SYNTHETIC_SETUP_REJECTED');f.faults.setupBefore=primary;
 assert.throws(()=>fixture.enter(),e=>e===primary);fixture.restore();assert.deepEqual(f.state,original);assert.equal(mutations(f).length,1);
});
test('concurrent unknown state between snapshot and restore transaction is not overwritten',()=>{
 const f=fake(),fixture=create(f);fixture.enter();f.addReservation();
 f.faults.beforeCompare=s=>s.accounts.push({account_id:id(999),admitted_at:stamp,retired_at:null});
 assert.throws(()=>fixture.restore(),/Synthetic transaction snapshot mismatch/);assert.equal(f.state.accounts.length,2);
 assert.equal(f.state.reservations.length,1);
});
test('both actual proofs retain unchanged real127 RPC, global ledger assertion, loopback-only provider stub and primary-error finally',()=>{
 for(const filename of ['v5_ai_turn_recovery_proof.mjs','v5_self_reported_identity_proof.mjs']){
  const source=readFileSync(new URL(filename,import.meta.url),'utf8');
  for(const text of ['createDisposableAiBudgetFixture({sql,env,accountId:a.id,operationId:', 'budgetFixture.enter()',
   'budgetFixture.assertReserved()','budgetFixture.restore()','rpc_ai_test_budget_reserve_service','return fetch(input,init)',
   'generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent','if(!primaryFailure)throw error'])assert.ok(source.includes(text),text);
  assert.ok(!source.includes('reserved_microusd<=4750000'));assert.ok(!source.includes('budgetBefore.reserved_microusd+250000'));
  assert.match(source,/catch\(error\)\{primaryFailure=error;throw error;\}/);
 }
 const helper=readFileSync(new URL('./disposable_ai_budget_fixture.mjs',import.meta.url),'utf8');
 assert.ok(helper.includes('BUDGET_FIXTURE_GLOBAL_SUM_MISMATCH'));assert.ok(helper.includes('isDeepStrictEqual(restored,before)&&digest(restored)===beforeDigest'));
 assert.ok(!helper.includes('create or replace'));assert.ok(!helper.includes('fetch('));
});
