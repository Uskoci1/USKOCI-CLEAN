// Local Android extension after the unchanged N04 and NAV physical proof.
// Deliberately NOT a full canonical migration-history replay.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';

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
const digest=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
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

const n07=JSON.parse(readFileSync('supabase/proofs/notifications/n07_forward_files.json','utf8'));
function exact(file,candidate,md5,sha256){
  const bytes=readFileSync(`supabase/migrations/${file}`);
  assert.deepEqual(bytes,readFileSync(candidate));assert.equal(digest('md5',bytes),md5);assert.equal(digest('sha256',bytes),sha256);
  return {file,candidate,bytes:bytes.length,md5,sha256};
}
const alreadyApplied=n07.filter(item=>['N02','N03'].includes(item.unit)).map(item=>({...exact(item.file,item.candidate_file,item.raw_md5,item.sha256),unit:item.unit,appliedBy:'n04_inbox_device_fixture.mjs',historyRowAdded:false}));
const additions=n07.filter(item=>['N01','N05','N06'].includes(item.unit)).map(item=>({...exact(item.file,item.candidate_file,item.raw_md5,item.sha256),unit:item.unit}));
additions.push({...exact('20260907100000_clean_n08_notification_preferences.sql','supabase/proofs/notifications/n08_preferences_candidate.sql','349e81a12760af65dc4d5d98a7677333','f1829f054b79e5c2f8cba529711185a530949d371b9de552af6997ebabe0ec16'),unit:'N08'});
additions.push({...exact('20260907110000_clean_d03_message_retry.sql','supabase/proofs/notifications/d03_message_retry_candidate.sql','ea4ebf5cc6f24f103bdb9c854f55463d','f7768b8feaefa54090bfdc66a7183089dd72fda21995dcc2beeb0dd6d6494889'),unit:'D03'});
assert.equal(additions.at(-1).bytes,4277);
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
