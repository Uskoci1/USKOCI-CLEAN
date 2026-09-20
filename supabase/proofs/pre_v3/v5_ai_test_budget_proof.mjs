// Actual disposable Auth/Postgres proof of the owner-authorized global $5 TEST cap.
// No real provider calls, prices charged, audio, transcripts, live configuration or production data.
import {assert,rows,sql,prove,pass,apply,login,requester,worker,anon,service,ok,denied,
  requesterId,workerId,randomUUID,q,lockedRace} from './closure_runtime.mjs';
import {migrationSnapshotQuery} from './history_snapshot.mjs';

const file='20260912214126_clean_v5_bounded_ai_test_budget.sql';
const parameters=(account=requesterId,operation=randomUUID(),kind='LLM')=>({p_account_id:account,p_operation_id:operation,
  p_kind:kind,p_max_cost_microusd:kind==='LLM'?250000:200000});
const reserve=input=>ok(service.rpc('rpc_ai_test_budget_reserve_service',input));
const total=()=>Number(sql('select reserved_microusd from private.ai_test_budget_v5 where singleton'));

await prove('V5_GLOBAL_AI_TEST_BUDGET','v5-ai-test-budget-report.json',async report=>{
  await apply(report,file,126);await login();const history=rows(migrationSnapshotQuery());assert.equal(history.length,127);
  const tables=['ai_test_budget_v5','ai_test_accounts_v5','ai_test_reservations_v5'];
  for(const table of tables){
    assert.equal(sql(`select relrowsecurity from pg_class where oid=${q('private.'+table)}::regclass`),'t');
    for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.'+table)},'SELECT,INSERT,UPDATE,DELETE')`),'f');
  }
  const signature='public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)';
  for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE')`),'f');
  assert.equal(sql(`select has_function_privilege('service_role',${q(signature)},'EXECUTE')`),'t');
  for(const client of [anon,requester,worker])await denied(client.rpc('rpc_ai_test_budget_reserve_service',parameters()));
  assert.equal((await reserve(parameters())).code,'AI_TEST_BUDGET_NOT_READY');assert.equal(total(),0);
  pass(report,'PRIVATE_RLS_NO_DIRECT_GRANTS_SERVICE_RPC_ONLY_DEFAULT_CLOSED_NO_IMPLICIT_TEST_SPEND');

  // Explicitly privileged disposable operator fixture; not production activation.
  sql('update private.ai_test_budget_v5 set enabled=true where singleton');
  assert.equal((await reserve(parameters())).code,'AI_TEST_ACCOUNT_NOT_ADMITTED');assert.equal(total(),0);
  sql(`insert into private.ai_test_accounts_v5(account_id) values(${q(requesterId)}::uuid),(${q(workerId)}::uuid)`);
  const input=parameters(),race=await Promise.all([reserve(input),reserve(input)]);
  assert.equal(race.filter(x=>x.admitted).length,1);assert.equal(race.filter(x=>x.replay&&!x.admitted).length,1);
  assert.equal(race[0].reservationId,race[1].reservationId);assert.equal(total(),250000);
  const receipt=await reserve(input);assert.equal(receipt.admitted,false);assert.equal(receipt.replay,true);
  await denied(service.rpc('rpc_ai_test_budget_reserve_service',{...input,p_account_id:workerId}),'AI_TEST_OPERATION_CONFLICT');
  await denied(service.rpc('rpc_ai_test_budget_reserve_service',{...input,p_kind:'STT',p_max_cost_microusd:200000}),'AI_TEST_OPERATION_CONFLICT');
  for(const changed of [{p_max_cost_microusd:1},{p_max_cost_microusd:null},{p_kind:'ANY'},{p_operation_id:null},{p_account_id:null}])
    await denied(service.rpc('rpc_ai_test_budget_reserve_service',{...parameters(),...changed}),'AI_TEST_RESERVATION_INVALID');
  assert.equal(total(),250000);
  pass(report,'ALLOWLIST_REQUIRED_SAME_OPERATION_RACE_ONE_RESERVATION_REPLAY_NOT_ADMITTED_CROSS_ACTOR_KIND_COST_CONFLICT');

  sql(`update private.ai_test_accounts_v5 set retired_at=statement_timestamp() where account_id=${q(workerId)}::uuid`);
  assert.equal((await reserve(parameters(workerId))).code,'AI_TEST_ACCOUNT_NOT_ADMITTED');assert.equal(total(),250000);
  sql(`update private.ai_test_accounts_v5 set retired_at=null where account_id=${q(workerId)}::uuid`);
  const closureBefore=rows(`select state from private.account_closure_requests where account_id=${q(requesterId)}::uuid`)[0];
  assert.ok(closureBefore,'EXPECTED_PREDECESSOR_CLOSURE_FIXTURE');
  const closing=await lockedRace(`select pg_advisory_xact_lock(private.closure_account_key(${q(requesterId)}::uuid));update private.account_closure_requests set state='EXECUTING' where account_id=${q(requesterId)}::uuid`,
    ()=>reserve(parameters()));
  assert.equal(closing.code,'AI_TEST_ACCOUNT_NOT_ADMITTED');assert.equal(total(),250000);
  sql(`update private.account_closure_requests set state=${q(closureBefore.state)} where account_id=${q(requesterId)}::uuid`);
  pass(report,'OBSERVED_CLOSURE_LOCK_RACE_RECHECKS_ACCOUNT_BEFORE_RESERVATION');
  // Reservations remain allocated even without provider success. Nothing refunds uncertain I/O.
  for(let i=0;i<5;i++)assert.equal((await reserve(parameters(i%2?requesterId:workerId,randomUUID(),'STT'))).admitted,true);
  for(let i=0;i<14;i++)assert.equal((await reserve(parameters(i%2?workerId:requesterId))).admitted,true);
  assert.equal(total(),4750000);
  const crossAccount=await lockedRace('select singleton from private.ai_test_budget_v5 where singleton for update',
    ()=>Promise.all([reserve(parameters(requesterId)),reserve(parameters(workerId))]));
  assert.equal(crossAccount.filter(x=>x.admitted).length,1);
  assert.equal(crossAccount.filter(x=>x.code==='AI_TEST_BUDGET_EXHAUSTED').length,1);
  assert.equal(total(),5000000);
  assert.equal(Number(sql('select sum(max_cost_microusd) from private.ai_test_reservations_v5')),5000000);
  for(const account of [requesterId,workerId])for(const kind of ['LLM','STT']){
    const deniedBudget=await reserve(parameters(account,randomUUID(),kind));assert.equal(deniedBudget.admitted,false);
    assert.equal(deniedBudget.code,'AI_TEST_BUDGET_EXHAUSTED');
  }
  assert.equal(total(),5000000);assert.equal((await reserve(input)).replay,true);
  pass(report,'RETIRED_ACCOUNT_DENIED_BOTH_PROVIDERS_SHARE_GLOBAL_CEILING_OBSERVED_CROSS_ACCOUNT_LOCK_RACE_EXACT_FIVE_DOLLARS');

  sql("update private.ai_test_budget_v5 set price_valid_until='2020-01-01T00:00:00Z' where singleton");
  assert.equal((await reserve(parameters())).code,'AI_TEST_BUDGET_NOT_READY');
  assert.equal(total(),5000000);sql('update private.ai_test_budget_v5 set enabled=false where singleton');
  assert.deepEqual(rows(migrationSnapshotQuery()),history);
  report.globalCeilingMicrousd=5000000;report.allocatedMicrousd=total();report.actualProviderSpendMeasured=false;
  report.productionActivation=false;report.realProviderCalled=false;
  report.limitations=['Operator enable and admitted account rows are disposable fixtures only.',
    'Allocated maximum is a conservative budget reservation, not a billed amount or successful provider proof.',
    'No release, delete, refund or retention policy is inferred for the private operational ledger.'];
  pass(report,'PRICE_REVISION_EXPIRY_FAILS_CLOSED_BUDGET_REMAINS_ALLOCATED_NO_PROVIDER_OR_LIVE_CONFIG');
});
