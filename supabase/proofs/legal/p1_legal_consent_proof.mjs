// P1 legal consent ledger — authenticated disposable proof. Loopback only.
// Real local Auth/PostgREST commands plus role-scoped psql transactions with
// one observed same-key lock interleaving. Fixture legal documents are
// proof-only rows inserted by the disposable superuser; no real Terms/Privacy
// content, URL or provider is involved. No production or device call.
import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {readP1LegalPredecessorPlan} from './p1_legal_consent_predecessor.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const plan=readP1LegalPredecessorPlan();
const out=env.P1_ARTIFACT_DIR||'artifacts/p1-legal-consent';mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('supabase/proofs/legal/p1_legal_consent_files.json','utf8'));
const forward=`supabase/migrations/${manifest.forward_file}`,bytes=readFileSync(forward);
assert.deepEqual(bytes,readFileSync(manifest.candidate_file));
assert.equal(bytes.length,manifest.bytes);
assert.equal(createHash('md5').update(bytes).digest('hex'),manifest.md5);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
const report={unit:'P1_LEGAL_CONSENT',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  live_access:false,live_promotion:false,provider_called:false,mobile_proof:false,legal_content_real:false,
  fixture_boundary:'REAL_LOCAL_AUTH_POSTGREST_AND_ROLE_SCOPED_PSQL_TRANSACTIONS',
  candidate:manifest,predecessor_plan:plan,checks:[],lock_interleavings:[]};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options),admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const wid=env.RU5_DEVICE_WORKER_USER_ID,rid=env.RU5_DEVICE_REQUESTER_USER_ID;
const validUuid=v=>{assert.match(String(v),/^[0-9a-f-]{36}$/i);return v;};validUuid(wid);validUuid(rid);
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(query){
  try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],
    {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
  catch(error){
    const code=String(error.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNAVAILABLE';
    report.failed_sql={sqlstate:code,query_sha256:createHash('sha256').update(query).digest('hex')};
    throw new Error(`DISPOSABLE_SQL_FAILED_${code}`);
  }
}
function sqlState(query){try{sql(query);return 'OK';}catch(error){return String(error.message).replace('DISPOSABLE_SQL_FAILED_','');}}
const rows=query=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));
const ok=async promise=>{const r=await promise;if(r.error)throw new Error(`AUTH_RPC_FAILED:${r.error.code??''}:${r.error.message??''}`);return r.data;};
async function rejected(promise,code,message){const r=await promise;assert.ok(r.error,'expected rejection');
  if(code)assert.equal(r.error.code,code);if(message)assert.equal(r.error.message,message);return r.error;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let current='PREFLIGHT';
const check=name=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
const tableHash=(table,where='true')=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x where ${where}`);
const bundle=client=>client.rpc('rpc_get_legal_bundle');
const accept=(client,key)=>client.rpc('rpc_accept_legal_bundle',{p_client_request_id:key});
const acceptances=uid=>rows(`select id,request_id,terms_document_id,terms_version_label,terms_content_sha256,privacy_document_id,privacy_version_label,privacy_content_sha256,acceptance_context from public.account_legal_acceptance_events where account_id=${q(uid)} order by accepted_at`);
const sha=text=>createHash('sha256').update(text).digest('hex');
const publish=(kind,label,content)=>sql(`insert into private.legal_document_versions(document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values(${q(kind)},${q(label)},${q(sha(content))},${q('https://proof.invalid/legal/'+kind.toLowerCase()+'/'+label)},statement_timestamp()-interval '1 minute',statement_timestamp()-interval '1 minute',true) returning id`).split(/\r?\n/)[0];
function asyncSql(application,query){return new Promise(resolve=>{
  execFile('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At','-c',
    `set application_name=${q(application)};set statement_timeout='20s';${query}`],{encoding:'utf8',maxBuffer:1024*1024},
    (error,stdout,stderr)=>resolve({success:!error,stdout,stderr}));
});}
const authSql=(uid,query)=>`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(uid)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:uid,role:'authenticated'}))},true);${query};commit;`;
async function waitActivity(application,condition){
  for(let i=0;i<80;i++){
    if(sql(`select count(*) from pg_stat_activity where application_name=${q(application)} and (${condition})`)==='1')return;
    await sleep(50);
  }
  assert.fail(`expected controlled transaction state was not observed for ${application}`);
}
async function waitBlockedBy(holder,waiter){
  for(let i=0;i<80;i++){
    const observed=rows(`select w.pid waiter_pid,w.wait_event_type,w.wait_event,h.pid holder_pid,h.wait_event holder_wait_event,
      h.pid=any(pg_blocking_pids(w.pid)) blocked_by_holder,
      (select string_agg(l.locktype||':'||l.mode,',') from pg_locks l where l.pid=w.pid and not l.granted) pending_locks
      from pg_stat_activity w cross join pg_stat_activity h
      where w.application_name=${q(waiter)} and h.application_name=${q(holder)}`)[0];
    if(observed?.wait_event_type==='Lock'&&observed.blocked_by_holder&&observed.holder_wait_event==='PgSleep')return observed;
    await sleep(50);
  }
  assert.fail(`${waiter} was not observed blocked by ${holder}`);
}
const jsonLine=stdout=>JSON.parse(stdout.split(/\r?\n/).filter(line=>line.trim().startsWith('{')).at(-1));
let history,predecessorCount;
try{
  check('PREFLIGHT_LIVE87_PREDECESSOR_WITHOUT_LEGAL_OBJECTS');
  predecessorCount=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(predecessorCount,plan.expected_predecessor_count);
  assert.equal(sql("select to_regclass('private.legal_document_versions') is null"),'t');
  assert.equal(sql("select to_regclass('public.account_legal_acceptance_events') is null"),'t');
  assert.equal(sql("select to_regprocedure('public.rpc_get_legal_bundle()') is null"),'t');
  for(const [c,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,wid],[requester,env.RU5_DEVICE_REQUESTER_EMAIL,rid]]){
    await ok(c.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(c.auth.getUser())).user.id,id);
  }
  report.predecessor_history_count=predecessorCount;pass();

  {
  check('EXACT_FORWARD_APPLY_PRESERVES_ALL87_HISTORY_AND_CLOSES_TABLES');
  history=tableHash('supabase_migrations.schema_migrations');
  const before=rows('select to_jsonb(m) metadata from supabase_migrations.schema_migrations m order by version');
  report.original_full_history_sha256=createHash('sha256').update(JSON.stringify(before)).digest('hex');
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',forward],{stdio:'pipe'});
  sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(manifest.forward_version)},${q(manifest.forward_name)},array[${q(bytes.toString('utf8'))}])`);
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),history);
  assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${q(manifest.forward_version)}`),manifest.md5);
  const after=rows('select to_jsonb(m) metadata from supabase_migrations.schema_migrations m where version<>'+q(manifest.forward_version)+' order by version');
  report.after_original_full_history_sha256=createHash('sha256').update(JSON.stringify(after)).digest('hex');
  assert.equal(report.after_original_full_history_sha256,report.original_full_history_sha256);
  const acl=rows(`select c.relname,c.relrowsecurity rls,c.relforcerowsecurity forced,
    has_table_privilege('anon',c.oid,'SELECT') anon_select,has_table_privilege('authenticated',c.oid,'SELECT') auth_select,
    has_table_privilege('authenticated',c.oid,'INSERT') auth_insert,has_table_privilege('authenticated',c.oid,'UPDATE') auth_update,has_table_privilege('authenticated',c.oid,'DELETE') auth_delete
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname,c.relname) in (('private','legal_document_versions'),('public','account_legal_acceptance_events')) order by 1`);
  assert.equal(acl.length,2);
  for(const r of acl){assert.equal(r.rls,true);assert.equal(r.forced,true);for(const k of ['anon_select','auth_select','auth_insert','auth_update','auth_delete'])assert.equal(r[k],false,`${r.relname}.${k}`);}
  const fn=rows(`select p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec,has_function_privilege('service_role',p.oid,'EXECUTE') service_exec,md5(p.prosrc) prosrc_md5
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('rpc_get_legal_bundle','rpc_accept_legal_bundle') order by 1`);
  assert.deepEqual(fn.map(f=>[f.proname,f.prosecdef,f.anon_exec,f.auth_exec,f.service_exec]),[
    ['rpc_accept_legal_bundle',true,false,true,false],['rpc_get_legal_bundle',true,true,true,false]]);
  report.new_functions=fn;report.table_acl=acl;
  sql("notify pgrst,'reload schema'");let ready=false;
  for(let i=0;i<60;i++){const r=await bundle(anon);if(!r.error&&r.data&&r.data.ready===false){ready=true;break;}await sleep(100);}
  assert.ok(ready,'rpc_get_legal_bundle not visible through PostgREST');
  report.exact_forward_file_applied_disposable=true;report.original_predecessor_full_history_unchanged=true;pass();
  }

  {
  check('FAIL_CLOSED_WITHOUT_PUBLISHED_DOCUMENTS_FOR_ANON_AND_AUTHENTICATED');
  for(const c of [anon,requester,worker]){
    const s=await ok(bundle(c));assert.deepEqual(s,{ready:false,acceptedCurrentBundle:false,documents:[],reason:'LEGAL_DOCUMENTS_NOT_PUBLISHED'});
  }
  await rejected(accept(requester,'p1-accept-before-publish-0001'),'55000','LEGAL_DOCUMENTS_NOT_PUBLISHED');
  assert.equal(sql('select count(*) from public.account_legal_acceptance_events'),'0');
  await rejected(accept(anon,'p1-accept-anon-0000000001'));
  await rejected(accept(admin,'p1-accept-service-000000001'));
  pass();
  }

  const TERMS_V1='PROOF TERMS v1 — disposable fixture text, not real legal content';
  const PRIVACY_V1='PROOF PRIVACY v1 — disposable fixture text, not real legal content';
  {
  check('PUBLICATION_ONLY_THROUGH_TRUSTED_PATH_AND_REGISTRY_CONSTRAINTS_HOLD');
  const attempt=await requester.from('legal_document_versions').insert({document_kind:'TERMS',version_label:'x',content_sha256:sha('x'),public_url:'https://proof.invalid/x',published_at:new Date().toISOString(),effective_at:new Date().toISOString(),is_active:true}).select('id');
  assert.ok(attempt.error,'authenticated must not publish legal documents');
  assert.equal(sqlState(`insert into private.legal_document_versions(document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values('TERMS','bad-sha','nothex','https://proof.invalid/t',statement_timestamp(),statement_timestamp(),true)`),'23514');
  assert.equal(sqlState(`insert into private.legal_document_versions(document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values('TERMS','bad-url',${q(sha('x'))},'http://insecure.invalid/t',statement_timestamp(),statement_timestamp(),true)`),'23514');
  assert.equal(sqlState(`insert into private.legal_document_versions(document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values('COOKIES','v1',${q(sha('x'))},'https://proof.invalid/c',statement_timestamp(),statement_timestamp(),true)`),'23514');
  assert.equal(sqlState(`insert into private.legal_document_versions(document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active,retired_at) values('TERMS','active-retired',${q(sha('x'))},'https://proof.invalid/t',statement_timestamp(),statement_timestamp(),true,statement_timestamp())`),'23514');
  const termsV1=validUuid(publish('TERMS','v1-proof',TERMS_V1));
  assert.equal(sqlState(`insert into private.legal_document_versions(document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values('TERMS','v1b-proof',${q(sha('other'))},'https://proof.invalid/t2',statement_timestamp(),statement_timestamp(),true)`),'23505');
  const privacyV1=validUuid(publish('PRIVACY','v1-proof',PRIVACY_V1));
  report.fixture_documents={termsV1,privacyV1,content_real:false};pass();
  }

  {
  check('READY_BUNDLE_VISIBLE_TO_ANON_AND_NOT_ACCEPTED_YET');
  const s=await ok(bundle(anon));
  assert.equal(s.ready,true);assert.equal(s.acceptedCurrentBundle,false);assert.equal(s.reason,null);
  assert.deepEqual(s.documents.map(d=>[d.kind,d.version,d.sha256]),[['TERMS','v1-proof',sha(TERMS_V1)],['PRIVACY','v1-proof',sha(PRIVACY_V1)]]);
  for(const d of s.documents){assert.match(d.url,/^https:\/\//);assert.ok(d.publishedAt&&d.effectiveAt);}
  const r=await ok(bundle(requester));assert.equal(r.ready,true);assert.equal(r.acceptedCurrentBundle,false);
  pass();
  }

  const KEY='p1-requester-accept-000001';
  let firstReceipt;
  {
  check('ACCEPTANCE_RECORDS_EXACT_SNAPSHOT_AUDIT_AND_PER_ACCOUNT_STATUS');
  firstReceipt=await ok(accept(requester,KEY));
  assert.equal(firstReceipt.accepted,true);assert.equal(firstReceipt.idempotentReplay,false);
  assert.equal(firstReceipt.termsSha256,sha(TERMS_V1));assert.equal(firstReceipt.privacySha256,sha(PRIVACY_V1));
  assert.equal(firstReceipt.termsVersion,'v1-proof');assert.equal(firstReceipt.privacyVersion,'v1-proof');
  const evs=acceptances(rid);assert.equal(evs.length,1);
  assert.equal(evs[0].request_id,KEY);assert.equal(evs[0].terms_content_sha256,sha(TERMS_V1));assert.equal(evs[0].privacy_content_sha256,sha(PRIVACY_V1));
  assert.equal(evs[0].acceptance_context,'ACCOUNT_TERMS_PRIVACY_ACK');
  const audit=rows(`select event_type,entity_type,entity_id,detail from private.marketplace_audit_log where actor_user_id=${q(rid)} and event_type='LEGAL_BUNDLE_ACCEPTED'`);
  assert.equal(audit.length,1);assert.equal(audit[0].entity_type,'SYSTEM');assert.equal(audit[0].entity_id,evs[0].id);assert.equal(audit[0].detail.termsSha256,sha(TERMS_V1));
  assert.equal((await ok(bundle(requester))).acceptedCurrentBundle,true);
  assert.equal((await ok(bundle(worker))).acceptedCurrentBundle,false);
  assert.equal((await ok(bundle(anon))).acceptedCurrentBundle,false);
  pass();
  }

  {
  check('REPLAY_KEY_AND_ROLE_BOUNDARIES_RETAIN_ONE_ROW');
  const settled=tableHash('public.account_legal_acceptance_events');
  const replay=await ok(accept(requester,KEY));
  assert.equal(replay.idempotentReplay,true);assert.equal(replay.acceptedAt,firstReceipt.acceptedAt);assert.equal(replay.termsSha256,firstReceipt.termsSha256);
  for(const key of [null,'','short','a'.repeat(97),'bad key','bad/key','p1-key\n0000000000000'])await rejected(accept(requester,key),'22023','INVALID_CLIENT_REQUEST_ID');
  await rejected(accept(anon,'p1-anon-accept-0000000001'));
  await rejected(accept(admin,'p1-service-accept-000000001'));
  assert.equal(tableHash('public.account_legal_acceptance_events'),settled);
  {const sel=await requester.from('account_legal_acceptance_events').select('id');assert.ok(sel.error||sel.data?.length===0,'direct select must be denied or empty');}
  const direct=await requester.from('account_legal_acceptance_events').insert({account_id:rid,request_id:'p1-direct-insert-0000001',terms_document_id:report.fixture_documents.termsV1,terms_version_label:'x',terms_content_sha256:sha('x'),privacy_document_id:report.fixture_documents.privacyV1,privacy_version_label:'x',privacy_content_sha256:sha('x')}).select('id');
  assert.ok(direct.error||direct.data?.length===0,'direct acceptance insert must be denied');
  assert.equal(tableHash('public.account_legal_acceptance_events'),settled);
  pass();
  }

  {
  check('NEW_TERMS_VERSION_INVALIDATES_ACCEPTANCE_AND_REJECTS_OLD_KEY_ON_NEW_BUNDLE');
  const TERMS_V2='PROOF TERMS v2 — disposable fixture text, not real legal content';
  sql(`update private.legal_document_versions set is_active=false,retired_at=statement_timestamp() where document_kind='TERMS' and version_label='v1-proof'`);
  const termsV2=validUuid(publish('TERMS','v2-proof',TERMS_V2));
  const s=await ok(bundle(requester));assert.equal(s.ready,true);assert.equal(s.acceptedCurrentBundle,false);
  assert.deepEqual(s.documents.map(d=>[d.kind,d.version]),[['TERMS','v2-proof'],['PRIVACY','v1-proof']]);
  await rejected(accept(requester,KEY),'22023','LEGAL_ACCEPTANCE_REQUEST_REUSED_FOR_DIFFERENT_BUNDLE');
  assert.equal(acceptances(rid).length,1);
  const second=await ok(accept(requester,'p1-requester-accept-000002'));
  assert.equal(second.idempotentReplay,false);assert.equal(second.termsVersion,'v2-proof');assert.equal(second.termsSha256,sha(TERMS_V2));
  const evs=acceptances(rid);assert.equal(evs.length,2);assert.equal(evs[1].terms_document_id,termsV2);assert.equal(evs[0].terms_document_id,report.fixture_documents.termsV1);
  assert.equal((await ok(bundle(requester))).acceptedCurrentBundle,true);
  report.reacceptance={termsV2,history_rows:2};pass();
  }

  {
  check('OBSERVED_LOCK_SAME_KEY_CONCURRENT_ACCEPT_YIELDS_ONE_ROW_AND_ONE_REPLAY');
  const key='p1-worker-concurrent-00001';
  assert.equal(acceptances(wid).length,0);
  const holderApp='p1-holder-accept',waiterApp='p1-waiter-accept';
  const holder=asyncSql(holderApp,authSql(wid,`select public.rpc_accept_legal_bundle(${q(key)});select pg_sleep(3)`));
  await waitActivity(holderApp,"wait_event='PgSleep'");
  const waiter=asyncSql(waiterApp,authSql(wid,`select public.rpc_accept_legal_bundle(${q(key)})`));
  const observed=await waitBlockedBy(holderApp,waiterApp);report.lock_interleavings.push({case:'SAME_KEY_HOLDER_WAITER',...observed});
  const [h,w]=await Promise.all([holder,waiter]);assert.ok(h.success,'holder failed');assert.ok(w.success,'waiter failed');
  const hr=jsonLine(h.stdout),wr=jsonLine(w.stdout);
  assert.equal(hr.idempotentReplay,false);assert.equal(wr.idempotentReplay,true);assert.equal(wr.acceptedAt,hr.acceptedAt);
  assert.equal(acceptances(wid).length,1);
  assert.equal(sql(`select count(*) from private.marketplace_audit_log where actor_user_id=${q(wid)} and event_type='LEGAL_BUNDLE_ACCEPTED'`),'1');
  pass();
  }

  {
  check('FINAL_FINGERPRINTS_HISTORY_AND_NO_REAL_CONTENT');
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),history);
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(report.migration_history_count,predecessorCount+1);
  assert.equal(report.migration_history_count,plan.source_migration_count);
  report.fixture_rows={documents:Number(sql('select count(*) from private.legal_document_versions')),acceptances:Number(sql('select count(*) from public.account_legal_acceptance_events'))};
  assert.equal(sql("select count(*) from private.legal_document_versions where public_url not like 'https://proof.invalid/%'"),'0');
  pass();
  }
  report.result='PASS';
}catch(error){
  report.result='FAIL';report.failed_check=current;
  report.failure=error?.code==='ERR_ASSERTION'?`ASSERTION:${String(error.message).slice(0,200)}`:String(error.message).slice(0,200);
  process.exitCode=1;
}finally{
  writeFileSync(`${out}/proof-report.json`,`${JSON.stringify(report,null,2)}\n`);
  console.log(`${report.result} P1_LEGAL_CONSENT`);
}
