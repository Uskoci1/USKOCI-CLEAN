// Disposable localhost Auth/Postgres only. No real provider, account or spend.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {assert,randomUUID,sql,rows,q,ok,denied,service,anon,actor,prove,pass,env,lockedRace} from '../pre_v3/closure_runtime.mjs';

const path='supabase/candidates/pkg026_ai_test_cap_optional.sql';
const candidate=readFileSync(path,'utf8');
const apply=body=>execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1'],
  {input:body,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:90000});
const total=()=>Number(sql('select reserved_microusd from private.ai_test_budget_v5 where singleton'));
const certificate=()=>rows(`select private.closure_source_digest_v5() live,
  (select sha256 from private.closure_source_v5 where singleton) source,
  (select sha256 from private.closure_erasure_source_v5 where singleton) erasure,
  private.retention_ai_source_ready() ready, private.closure_erasure_binding_v5() is not null binding`)[0];
const reserve=p=>ok(service.rpc('rpc_ai_test_budget_reserve_service',p));
const parameter=(account,kind='LLM',operation=randomUUID())=>({p_account_id:account,p_operation_id:operation,
  p_kind:kind,p_max_cost_microusd:kind==='LLM'?250000:200000});
const history=()=>rows(`select to_jsonb(r) value from private.ai_test_reservations_v5 r order by operation_id`);
const usage=()=>rows('select to_jsonb(u) value from private.ai_test_usage_v5 u order by operation_id');
const refuses=(body,code)=>{
  let failure;try{apply(body);}catch(e){failure=e;}
  assert.ok(failure,'EXPECTED_CANDIDATE_REFUSAL');
  assert.ok(String(failure.stderr).includes(code),String(failure.stderr).slice(-1500));
};

await prove('PKG026_OPTIONAL_AI_RESERVATION_CAP','pkg026-optional-cap-report.json',async report=>{
  report.providerCalled=false;report.liveAccess=false;report.disposableDbOnly=true;
  const owner=await actor('pkg026-owner'),other=await actor('pkg026-other');
  sql(`update private.ai_test_budget_v5 set enabled=true,
       reserved_microusd=(select coalesce(sum(coalesce(settled_microusd,max_cost_microusd)),0) from private.ai_test_reservations_v5)
       where singleton;
       insert into private.ai_test_accounts_v5(account_id) values(${q(owner.id)}::uuid);`);
  while(total()+250000<=5000000) assert.equal((await reserve(parameter(owner.id))).admitted,true);
  const retry=parameter(owner.id), beforeHistory=history(), beforeUsage=usage(), beforeTotal=total(), beforeCert=certificate();
  assert.equal(beforeCert.ready,true);assert.equal(beforeCert.binding,true);
  // Same required behavior deliberately fails before the candidate, with the exact budget reason.
  const before=await reserve(retry);
  assert.equal(before.code,'AI_TEST_BUDGET_EXHAUSTED');assert.equal(before.admitted,false);
  assert.throws(()=>assert.equal(before.admitted,true));
  assert.deepEqual(history(),beforeHistory);assert.equal(total(),beforeTotal);
  pass(report,'BEFORE_NEW_TURN_ADMISSION_FAILS_WITH_EXHAUSTED_INTERNAL_CAP');

  // Force a postcondition failure after DDL/config/rebinding, proving atomic rollback.
  const broken=candidate.replace('3cadd9345025fd962fc64cab085f29f7','00000000000000000000000000000000');
  assert.notEqual(broken,candidate);
  refuses(broken,'PKG026_RESULT_BODY_MISMATCH');
  assert.equal(sql("select exists(select 1 from pg_attribute where attrelid='private.ai_test_budget_v5'::regclass and attname='reservation_cap_enforced' and not attisdropped)"),'f');
  assert.deepEqual(certificate(),beforeCert);assert.deepEqual(history(),beforeHistory);assert.equal(total(),beforeTotal);
  pass(report,'BAD_TRANSPORT_OR_RESULT_PIN_ROLLS_BACK_SCHEMA_POLICY_AND_CERTIFICATES');

  // No unreviewed baseline may be silently certified by the candidate.
  sql('alter table private.ai_test_budget_v5 add column pkg026_unreviewed integer');
  assert.equal(certificate().ready,false);
  refuses(candidate,'PKG026_CLOSURE_NOT_READY');
  sql('alter table private.ai_test_budget_v5 drop column pkg026_unreviewed');
  assert.deepEqual(certificate(),beforeCert);
  pass(report,'UNREVIEWED_CLOSURE_DRIFT_IS_REFUSED');

  apply(candidate);
  const afterCert=certificate();
  assert.equal(afterCert.ready,true);assert.equal(afterCert.binding,true);
  assert.equal(afterCert.source,afterCert.live);assert.equal(afterCert.erasure,afterCert.live);
  assert.notEqual(afterCert.live,beforeCert.live);
  assert.equal(total(),beforeTotal);assert.deepEqual(history(),beforeHistory);assert.deepEqual(usage(),beforeUsage);
  assert.equal(sql('select reservation_cap_enforced from private.ai_test_budget_v5 where singleton'),'f');
  pass(report,'EXACT_CANDIDATE_PRESERVES_EVERY_HISTORICAL_RECORD_AND_REBINDS_CLOSURE');

  const after=await reserve(retry);
  assert.equal(after.admitted,true);assert.equal(after.code,'AI_TEST_RESERVED');
  for(let i=0;i<4;i++) assert.equal((await reserve(parameter(owner.id))).admitted,true);
  const speech=parameter(owner.id,'STT');assert.equal((await reserve(speech)).admitted,true);
  assert.ok(total()>5000000);
  assert.equal((await reserve(retry)).admitted,false);assert.equal((await reserve(retry)).code,'AI_TEST_OPERATION_REPLAY');
  pass(report,'AFTER_TEXT_AND_SPEECH_ADMIT_BEYOND_FIVE_DOLLARS_WITHOUT_REPLAY_SPEND');

  const raceInput=parameter(owner.id), raceBefore=total();
  const race=await lockedRace('select singleton from private.ai_test_budget_v5 where singleton for update',
    ()=>Promise.all([reserve(raceInput),reserve(raceInput)]));
  assert.equal(race.filter(x=>x.admitted).length,1);assert.equal(race.filter(x=>x.replay&&!x.admitted).length,1);
  assert.equal(total(),raceBefore+250000);
  await denied(service.rpc('rpc_ai_test_budget_reserve_service',{...raceInput,p_account_id:other.id}),'AI_TEST_OPERATION_CONFLICT');
  for(const client of [anon,owner.client,other.client]) await denied(client.rpc('rpc_ai_test_budget_reserve_service',parameter(owner.id)));
  assert.equal((await reserve(parameter(other.id))).code,'AI_TEST_ACCOUNT_NOT_ADMITTED');
  await denied(service.rpc('rpc_ai_test_budget_reserve_service',{...parameter(owner.id),p_max_cost_microusd:0}),'AI_TEST_RESERVATION_INVALID');
  sql(`update private.ai_test_accounts_v5 set retired_at=statement_timestamp() where account_id=${q(owner.id)}::uuid`);
  assert.equal((await reserve(parameter(owner.id))).code,'AI_TEST_ACCOUNT_NOT_ADMITTED');
  sql(`update private.ai_test_accounts_v5 set retired_at=null where account_id=${q(owner.id)}::uuid`);
  sql('update private.ai_test_budget_v5 set enabled=false where singleton');
  assert.equal((await reserve(parameter(owner.id))).code,'AI_TEST_BUDGET_NOT_READY');
  sql("update private.ai_test_budget_v5 set enabled=true,price_valid_until='2020-01-01T00:00:00Z' where singleton");
  assert.equal((await reserve(parameter(owner.id))).code,'AI_TEST_BUDGET_NOT_READY');
  sql("update private.ai_test_budget_v5 set price_valid_until='2027-01-01T00:00:00Z' where singleton");
  pass(report,'OBSERVED_RACE_AUTH_ACCOUNT_RETIREMENT_INPUT_ENABLE_AND_EXPIRY_GUARDS_SURVIVE');

  const measuredBefore=total();
  const measuredArgs={p_operation_id:retry.p_operation_id,p_model:'pkg026-disposable-usage',p_prompt_tokens:1200,p_output_tokens:300,p_total_tokens:1500};
  const measured=await ok(service.rpc('rpc_ai_test_record_usage_service',measuredArgs));
  assert.equal(measured.settledMicrousd,2025);assert.equal(total(),measuredBefore-250000+2025);
  await ok(service.rpc('rpc_ai_test_record_usage_service',measuredArgs));assert.equal(total(),measuredBefore-250000+2025);
  const audioBefore=total();
  const audio=await ok(service.rpc('rpc_ai_test_settle_audio_service',{p_operation_id:speech.p_operation_id,p_audio_bytes:32000,p_transcript_chars:5}));
  assert.equal(audio.code,'AI_AUDIO_SETTLED');assert.equal(total(),audioBefore-200000+audio.settledMicrousd);
  assert.equal(total(),Number(sql('select sum(coalesce(settled_microusd,max_cost_microusd)) from private.ai_test_reservations_v5')));
  const status=await ok(service.rpc('rpc_ai_test_budget_report_service'));
  assert.equal(status.reservationCapEnforced,false);assert.equal(status.internalTestBudgetCapUsd,null);
  assert.equal(status.remainingAllowedCalls,null);assert.equal(status.capIsACallCounter,false);assert.equal(status.realSpendUsd,null);
  assert.ok(status.measuredCalls>0);assert.ok(status.unsettledReservations>0);
  pass(report,'MEASURED_AND_AUDIO_ACCOUNTING_STILL_SETTLE_ONCE_AND_REPORT_CAP_DISABLED_TRUTHFULLY');

  // Future drift must still disable erasure readiness; these are disposable-only tamper probes.
  sql('alter table private.ai_test_budget_v5 add column pkg026_future_drift integer');
  assert.equal(certificate().ready,false);assert.equal(certificate().binding,false);
  sql('alter table private.ai_test_budget_v5 drop column pkg026_future_drift');
  assert.deepEqual(certificate(),afterCert);
  refuses(candidate,'PKG026_ALREADY_APPLIED');assert.deepEqual(certificate(),afterCert);
  report.beforeReservedMicrousd=beforeTotal;report.afterReservedMicrousd=total();
  report.oldUnsettledRowsUnmodified=true;report.newInferencePerformed=false;
  pass(report,'CERTIFICATION_REMAINS_FAIL_CLOSED_AND_CANDIDATE_REPLAY_IS_REFUSED');
});
