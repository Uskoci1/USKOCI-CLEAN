// Local Android extension after the unchanged N04 and NAV physical proof.
// Deliberately NOT a full canonical migration-history replay.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {readD03ChatSourceAdmission} from './d03_chat_device_source_admission.mjs';
import {createHash} from 'node:crypto';

const env=process.env,out=env.RU5_DEVICE_ARTIFACT_DIR;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
assert.equal(env.RU5_DEVICE_PACKAGE,'rs.uskoci.n04proof');
assert.equal(env.RU5_DEVICE_PROOF_DIR,'/tmp/uskoci-ru5-device-ui');
assert.equal(realpathSync(env.RU5_DEVICE_PROOF_DIR),env.RU5_DEVICE_PROOF_DIR);
const apiTarget=new URL(env.RU5_DEVICE_SUPABASE_URL),dbTarget=new URL(env.RU5_DEVICE_DB_URL);
assert.equal(apiTarget.origin,'http://127.0.0.1:54321');assert.ok(['','/'].includes(apiTarget.pathname));
assert.equal(apiTarget.search,'');assert.equal(apiTarget.hash,'');assert.equal(apiTarget.username,'');assert.equal(apiTarget.password,'');
assert.equal(dbTarget.protocol,'postgresql:');assert.equal(dbTarget.host,'127.0.0.1:54322');assert.equal(dbTarget.pathname,'/postgres');
assert.equal(dbTarget.username,'postgres');assert.equal(dbTarget.search,'');assert.equal(dbTarget.hash,'');
assert.match(readFileSync(join(env.RU5_DEVICE_PROOF_DIR,'supabase/config.toml'),'utf8'),/^project_id\s*=\s*"uskoci-ru5-device-ui"\s*$/m);
const uuid=value=>{assert.match(String(value),/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);return value;};
const agreement=uuid(env.N04_AGREEMENT_ID),need=uuid(env.RU5_DEVICE_NEED_ID);
const worker=uuid(env.RU5_DEVICE_WORKER_USER_ID),requester=uuid(env.RU5_DEVICE_REQUESTER_USER_ID);
const sql=query=>execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-v','ON_ERROR_STOP=1','-At','-c',query],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const rows=query=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));

if(env.RU5_DEVICE_CORE106==='1') {
  const marketplace=env.AI_REVIEW_SCOPE==='marketplace';
  const nativeBoundary=marketplace?await (await import('../../../scripts/ai_review_fixture.mjs')).admitMarketplaceNativeBoundary(env):null;
  const historyRequired=marketplace?108:106;
  const fixture=JSON.parse(readFileSync(join(out,'core-fixture.json'),'utf8'));
  const core=JSON.parse(readFileSync(join(out,'core-selection.json'),'utf8'));
  const admission=JSON.parse(readFileSync('artifacts/ai-review-device/ai-review-admission.json','utf8'));
  for(const report of [fixture,core,admission])assert.equal(report.sourceSha,env.GITHUB_SHA);
  assert.equal(core.result,'PASS');assert.equal(core.actualNativeApply,true);assert.equal(core.actualNativeSelect,true);assert.equal(core.actualNativeMapSelection,true);
  assert.equal(core.agreementId,agreement);assert.equal(core.needId,need);assert.equal(core.requesterId,requester);assert.equal(core.workerId,worker);
  assert.equal(admission.historyCount,106);assert.equal(admission.localOnly,true);assert.equal(fixture.productionPolicyActivation,false);
  if(marketplace) {
    const bytes=readFileSync(join(out,'marketplace-publication.json')),publication=JSON.parse(bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.publicationSha256);
    assert.equal(publication.result,'PASS');assert.equal(publication.sourceSha,env.GITHUB_SHA);assert.equal(publication.needId,need);
    assert.equal(publication.requesterId,requester);assert.equal(publication.workerId,worker);
    assert.equal(publication.historyCount,108);assert.deepEqual(publication.nativeBoundary,nativeBoundary);
    assert.equal(core.historyCount,108);assert.equal(fixture.nativeHistoryRequired,108);
    assert.equal(publication.actualB06,true);assert.equal(publication.actualB07,true);assert.equal(publication.actualNativePins,true);
    assert.equal(publication.productionPolicyActivation,false);assert.equal(fixture.publicationProof,true);assert.equal(core.publicationProof,true);
    assert.equal(core.terms.covered_slots,3);assert.equal(fixture.requiredSlots,3);
  } else {assert.equal(fixture.publicationProof,false);assert.equal(core.publicationProof,false);}
  const before=rows('select count(*)::int count,max(version) head,md5(jsonb_agg(to_jsonb(m) order by version)::text) full_metadata_md5 from supabase_migrations.schema_migrations m')[0];
  assert.equal(before.count,historyRequired);
  assert.equal(sql(`select count(*) from public.agreements where id='${agreement}' and need_id='${need}' and requester_account_id='${requester}' and worker_account_id='${worker}' and status='CONFIRMED'`),'1');
  assert.equal(sql(`select count(*) from public.agreement_messages where agreement_id='${agreement}'`),'0');
  assert.equal(sql(`select count(*) from private.connection_activations where agreement_id='${agreement}' and response_content_hash='${core.responseHash}' and response_version=${core.responseVersion} and platform_cost_rsd=0 and policy_key='REQUESTER_SELECTION_V1' and state='SATISFIED'`),'1');
  const sources=readD03ChatSourceAdmission(); // Validate frozen raw bytes/candidates; do not reapply any source.
  assert.equal(sql("select md5(prosrc) from pg_proc where oid='public.rpc_send_agreement_message_v2(uuid,uuid,text,text)'::regprocedure"),'8020a93751f4915bffff0fac5524ad64');
  assert.equal(sql("select md5(prosrc) from pg_proc where oid='public.rpc_send_agreement_message(uuid,text)'::regprocedure"),'d9a3733814e3101a3941284c07dc2bed');
  const report={result:'PASS',sourceSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,localOnly:true,liveAccess:false,providerCalled:false,
    fullCanonicalHistoryReplay:true,nativeBoundary:`EXACT${historyRequired}_UI_CREATED_CORE_AGREEMENT`,...(nativeBoundary?{successorAdmission:nativeBoundary}:{}),agreementId:agreement,requesterId:requester,workerId:worker,
    historyBefore:before,historyAfter:before,alreadyApplied:[...sources.alreadyApplied,...sources.additions],applied:[],
    messageEventsBefore:Number(sql("select count(*) from public.user_activity_events where event_type='MESSAGE_RECEIVED'")),
    publicationProof:core.publicationProof,productionPolicyActivation:false,coreSelection:core};
  writeFileSync(join(out,'d03-native-db-boundary.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`PASS D03_NATIVE_CORE${historyRequired}_ADMISSION actual_UI_agreement no_DDL history_unchanged`);
} else {
const inbox=readFileSync(join(out,'proof-inbox.log'),'utf8'),navigation=readFileSync(join(out,'proof-navigation.log'),'utf8');
assert.ok(inbox.includes('PASS N04_PHYSICAL_INBOX'));assert.ok(navigation.includes('PASS PHYSICAL_INTENT_SHELL'));
const n04=['INBOX_requester_one_event','INBOX_role_empty','INBOX_requester_read_all','INBOX_bell_zero','INBOX_worker_selection_unread','INBOX_selection_opens_real_agreement','INBOX_selection_read_confirmed','INBOX_next_page_available','INBOX_second_page_loaded','INBOX_worker_read_all'];
const nav=['NAV_requester_tasks','NAV_requester_new_task','NAV_requester_agreements','NAV_requester_profile','NAV_profile_back','NAV_inbox','NAV_inbox_back','NAV_same_account_worker_discovery','NAV_same_account_worker_profile','NAV_signed_out','NAV_second_account_requester_empty','NAV_second_account_profile','NAV_second_account_worker_discovery','NAV_task_detail','NAV_task_detail_back','NAV_worker_applications','NAV_worker_agreements'];
for(const name of [...n04,...nav])for(const extension of ['png','xml'])assert.ok(existsSync(join(out,`${name}.${extension}`)));
// Complete the inherited N04 business postflight BEFORE D03 can change status.
assert.equal(sql(`select count(*) from public.marketplace_responses r join public.app_profiles p on p.id=r.worker_profile_id where r.need_id='${need}' and p.account_id='${worker}' and r.price_rsd=3000 and r.covered_slots=1`),'1');
assert.equal(sql(`select count(*) from public.need_selections s join public.marketplace_responses r on r.id=s.response_id where r.need_id='${need}' and s.status='SELECTED'`),'1');
assert.equal(sql(`select count(*) from public.agreements where id='${agreement}' and need_id='${need}' and requester_account_id='${requester}' and worker_account_id='${worker}' and status='CONFIRMED'`),'1');
assert.equal(sql(`select count(*) from private.connection_activations where agreement_id='${agreement}' and requester_account_id='${requester}' and beneficiary_account_id='${requester}' and worker_account_id='${worker}' and activation_reason='SELECTION' and units=1 and platform_cost_rsd=0 and state='SATISFIED' and policy_key='REQUESTER_SELECTION_V1' and policy_version=1`),'1');
assert.equal(sql('select count(*) from public.user_activity_events where read_at is null'),'0');
assert.equal(sql('select count(*) from public.notification_deliveries where read_at is not null'),'0');
assert.equal(sql('select count(*) from public.notification_push_attempts'),'0');
assert.equal(sql('select count(*) from public.agreement_messages'),'0');
const history=()=>rows('select count(*)::int count,max(version) head,md5(jsonb_agg(to_jsonb(m) order by version)::text) full_metadata_md5 from supabase_migrations.schema_migrations m')[0];
const beforeHistory=history();assert.equal(beforeHistory.count,79);assert.equal(beforeHistory.head,'20260906141409');
const business=()=>rows("select (select count(*) from public.marketplace_responses)::int responses,(select count(*) from public.need_selections)::int selections,(select count(*) from public.agreements)::int agreements,(select count(*) from public.user_activity_events)::int events,(select count(*) from public.notification_deliveries)::int deliveries")[0];
const beforeBusiness=business();
console.log('PASS D03_NATIVE_PREDECESSOR_POSTFLIGHT ten_N04 seventeen_NAV selection_agreement_zero_rsd history79_plus_unrecorded_N02_N03');

const {alreadyApplied,additions}=readD03ChatSourceAdmission();
const report={sourceSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,localOnly:true,liveAccess:false,providerCalled:false,
  fullCanonicalHistoryReplay:false,nativeBoundary:'historical79 + exact N02/N03 fixture extensions + exact N01/N05/N06/N08/D03 extensions; no added history rows',
  predecessorPhysical:{n04:n04.length,navigation:nav.length,businessPostflight:'PASS'},agreementId:agreement,requesterId:requester,workerId:worker,
  historyBefore:beforeHistory,alreadyApplied,applied:[]};
try{
  for(const source of additions){
    execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-v','ON_ERROR_STOP=1','-f',`supabase/migrations/${source.file}`],{stdio:'pipe'});
    report.applied.push({...source,historyRowAdded:false});
  }
  report.historyAfter=history();assert.deepEqual(report.historyAfter,beforeHistory);assert.deepEqual(business(),beforeBusiness);
  assert.equal(sql("select md5(prosrc) from pg_proc where oid='public.rpc_send_agreement_message_v2(uuid,uuid,text,text)'::regprocedure"),'8020a93751f4915bffff0fac5524ad64');
  assert.equal(sql("select md5(prosrc) from pg_proc where oid='public.rpc_send_agreement_message(uuid,text)'::regprocedure"),'d9a3733814e3101a3941284c07dc2bed');
  sql("notify pgrst,'reload schema'");
  report.result='PASS';console.log('PASS D03_NATIVE_EXACT_ADMISSION history79_unchanged seven_explicit_extensions no_production_no_provider');
}catch(error){report.result='FAIL';throw error;}
finally{writeFileSync(join(out,'d03-native-db-boundary.json'),JSON.stringify(report,null,2)+'\n');}

}
