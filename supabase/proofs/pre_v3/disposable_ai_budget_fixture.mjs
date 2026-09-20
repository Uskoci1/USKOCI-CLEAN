// Proof-only isolation of127's deliberately exhausted predecessor fixture.
// Every real RPC still uses the unchanged singleton, allowlist and reservation
// writer. No production import, provider transport, refund or policy change.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';

const tables={budget:'private.ai_test_budget_v5',accounts:'private.ai_test_accounts_v5',reservations:'private.ai_test_reservations_v5'};
const snapshotSql=`select jsonb_build_object(
 'budget',(select coalesce(jsonb_agg(to_jsonb(t) order by singleton),'[]') from ${tables.budget} t),
 'accounts',(select coalesce(jsonb_agg(to_jsonb(t) order by account_id),'[]') from ${tables.accounts} t),
 'reservations',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from ${tables.reservations} t))`;
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const instant=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const keys=(v,expected)=>v&&typeof v==='object'&&!Array.isArray(v)&&isDeepStrictEqual(Object.keys(v).sort(),[...expected].sort());
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const check=(condition,code)=>assert.ok(condition,code);

function validate(value){
 check(keys(value,['budget','accounts','reservations']),'BUDGET_FIXTURE_SNAPSHOT_INVALID');
 check(Array.isArray(value.budget)&&value.budget.length===1&&Array.isArray(value.accounts)&&value.accounts.length<=1000
  &&Array.isArray(value.reservations)&&value.reservations.length<=1000,'BUDGET_FIXTURE_SNAPSHOT_INVALID');
 const b=value.budget[0];
 check(keys(b,['singleton','enabled','ceiling_microusd','reserved_microusd','price_valid_until'])&&b.singleton===true
  &&typeof b.enabled==='boolean'&&b.ceiling_microusd===5000000&&integer(b.reserved_microusd)&&b.reserved_microusd<=5000000
  &&instant(b.price_valid_until)&&Date.parse(b.price_valid_until)<=Date.parse('2027-01-01T00:00:00Z'),'BUDGET_FIXTURE_ROW_INVALID');
 for(const a of value.accounts)check(keys(a,['account_id','admitted_at','retired_at'])&&uuid(a.account_id)&&instant(a.admitted_at)
  &&(a.retired_at===null||instant(a.retired_at)&&Date.parse(a.retired_at)>=Date.parse(a.admitted_at)),'BUDGET_FIXTURE_ACCOUNT_INVALID');
 for(const r of value.reservations)check(keys(r,['id','operation_id','account_id','kind','max_cost_microusd','created_at'])&&uuid(r.id)&&uuid(r.operation_id)&&uuid(r.account_id)
  &&instant(r.created_at)&&((r.kind==='LLM'&&r.max_cost_microusd===250000)||(r.kind==='STT'&&r.max_cost_microusd===200000)),'BUDGET_FIXTURE_RESERVATION_INVALID');
 check(new Set(value.accounts.map(a=>a.account_id)).size===value.accounts.length
  &&new Set(value.reservations.map(r=>r.id)).size===value.reservations.length
  &&new Set(value.reservations.map(r=>r.operation_id)).size===value.reservations.length,'BUDGET_FIXTURE_DUPLICATE');
 return value;
}

/** Lifecycle stays within each caller's try/finally, preserving its original
 * failure. Setup/restore each compare the full state again under table locks.
 * Unknown rows abort cleanup; they are never deleted to obtain a passing test.
 */
export function createDisposableAiBudgetFixture({sql,env,accountId,operationId}){
 assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
 check(uuid(accountId)&&uuid(operationId),'BUDGET_FIXTURE_IDENTITY_INVALID');
 const read=()=>{let value;try{value=JSON.parse(sql(snapshotSql));}catch{throw new Error('BUDGET_FIXTURE_SNAPSHOT_READ_FAILED');}return validate(value);};
 const before=read(),beforeDigest=digest(before);
 check(!before.accounts.some(a=>a.account_id===accountId)&&!before.reservations.some(r=>r.account_id===accountId||r.operation_id===operationId),'BUDGET_FIXTURE_IDENTITY_ALREADY_EXISTS');
 const admittedAt=new Date().toISOString(),expiresAt=new Date(Math.min(Date.now()+3600000,Date.parse('2027-01-01T00:00:00Z'))).toISOString();
 check(Date.parse(expiresAt)>Date.parse(admittedAt),'BUDGET_FIXTURE_PRICE_WINDOW_EXPIRED');
 const fixtureAccount={account_id:accountId,admitted_at:admittedAt,retired_at:null};
 const fixtureBudget={...before.budget[0],enabled:true,reserved_microusd:0,price_valid_until:expiresAt};
 // PostgreSQL emits timestamptz as +00:00, while JS uses Z. Compare these
 // timestamps by instant; keep the unmodified original JSON for exact restore.
 const sameInstant=(a,b)=>Date.parse(a)===Date.parse(b);
 let entered=false;
 const transact=(expected,body)=>sql(`begin;
 lock table ${tables.budget},${tables.accounts},${tables.reservations} in access exclusive mode;
 do $fixture$ begin if (${snapshotSql}) is distinct from ${quote(JSON.stringify(expected))}::jsonb then raise exception 'BUDGET_FIXTURE_CONCURRENT_STATE';end if;end $fixture$;
 ${body}
 commit;`);
 function current(){
  const value=read(),b=value.budget[0];
  check(value.reservations.reduce((sum,r)=>sum+r.max_cost_microusd,0)===b.reserved_microusd,'BUDGET_FIXTURE_GLOBAL_SUM_MISMATCH');
  check(b.enabled===true&&sameInstant(b.price_valid_until,expiresAt)&&value.accounts.length===1&&value.accounts[0].account_id===accountId
   &&sameInstant(value.accounts[0].admitted_at,admittedAt)&&value.accounts[0].retired_at===null
   &&value.reservations.length<=1&&value.reservations.every(r=>r.account_id===accountId&&r.operation_id===operationId&&r.kind==='LLM'&&r.max_cost_microusd===250000),
  'BUDGET_FIXTURE_UNEXPECTED_CURRENT_STATE');
  return value;
 }
 return {
  summary:{priorReservedMicrousd:before.budget[0].reserved_microusd,priorReservationCount:before.reservations.length,
   priorReservationSumMicrousd:before.reservations.reduce((sum,r)=>sum+r.max_cost_microusd,0),priorAccountCount:before.accounts.length,
   priorEnabled:before.budget[0].enabled,
   //136 adds two export projection rows without charging its predecessor's
   // singleton. Preserve that historical fixture exactly, never certify it as
   // real127 consumption. Our isolated actual127 counter MUST equal its sum.
   priorFixtureLedgerMismatch:before.reservations.reduce((sum,r)=>sum+r.max_cost_microusd,0)!==before.budget[0].reserved_microusd,
   numericSqlJsonVerified:true,isolatedDisposableLedger:true},
  enter(){
   check(!entered,'BUDGET_FIXTURE_ALREADY_ENTERED');
   // Set before dispatch: an uncertain SQL ACK is reconciled against the exact
   // original/fixture shapes in restore, never retried as another setup.
   entered=true;
   transact(before,`delete from ${tables.reservations};delete from ${tables.accounts};
    update ${tables.budget} set enabled=true,reserved_microusd=0,price_valid_until=${quote(fixtureBudget.price_valid_until)}::timestamptz where singleton;
    insert into ${tables.accounts}(account_id,admitted_at) values(${quote(accountId)}::uuid,${quote(fixtureAccount.admitted_at)}::timestamptz);`);
   const value=current();check(value.reservations.length===0&&value.budget[0].reserved_microusd===0,'BUDGET_FIXTURE_NOT_EMPTY');
  },
  assertReserved(){
   check(entered,'BUDGET_FIXTURE_NOT_ENTERED');const value=current();
   check(value.reservations.length===1&&value.budget[0].reserved_microusd===250000,'BUDGET_FIXTURE_EXPECTED_ONE_REAL_RESERVATION');
  },
  restore(){
   const value=read();
   if(isDeepStrictEqual(value,before)){entered=false;return;}
   check(entered,'BUDGET_FIXTURE_NOT_ENTERED');current();
   transact(value,`delete from ${tables.reservations};delete from ${tables.accounts};delete from ${tables.budget};
    insert into ${tables.budget} select * from jsonb_populate_recordset(null::${tables.budget},${quote(JSON.stringify(before.budget))}::jsonb);
    insert into ${tables.accounts} select * from jsonb_populate_recordset(null::${tables.accounts},${quote(JSON.stringify(before.accounts))}::jsonb);
    insert into ${tables.reservations} select * from jsonb_populate_recordset(null::${tables.reservations},${quote(JSON.stringify(before.reservations))}::jsonb);`);
   const restored=read();check(isDeepStrictEqual(restored,before)&&digest(restored)===beforeDigest,'BUDGET_FIXTURE_RESTORE_MISMATCH');entered=false;
  },
 };
}
