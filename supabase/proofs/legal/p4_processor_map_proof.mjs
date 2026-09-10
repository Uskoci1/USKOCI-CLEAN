// P4 processor map registry — authenticated disposable proof. Loopback only.
// Real local Auth/PostgREST commands plus role-scoped psql transactions with
// one observed publish lock interleaving. Fixture map rows are proof-only,
// clearly labeled, with https://proof.invalid URLs; no counsel content, no
// production or device call.
import assert from 'node:assert/strict';
import { replayPendingDomain } from './pending_domain_replay.mjs';
import {execFile,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {readP4ProcessorPredecessorPlan} from './p4_processor_map_predecessor.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const plan=readP4ProcessorPredecessorPlan();
const out=env.P4_ARTIFACT_DIR||'artifacts/p4-processor-map';mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('supabase/proofs/legal/p4_processor_map_files.json','utf8'));
const forward=`supabase/migrations/${manifest.forward_file}`,bytes=readFileSync(forward);
assert.deepEqual(bytes,readFileSync(manifest.candidate_file));
assert.equal(bytes.length,manifest.bytes);
assert.equal(createHash('md5').update(bytes).digest('hex'),manifest.md5);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
const report={unit:'P4_PROCESSOR_MAP',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  live_access:false,live_promotion:false,provider_called:false,mobile_proof:false,legal_content_real:false,
  fixture_boundary:'REAL_LOCAL_AUTH_POSTGREST_AND_ROLE_SCOPED_PSQL_TRANSACTIONS',
  candidate:manifest,predecessor_plan:plan,checks:[],lock_interleavings:[]};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const rid=env.RU5_DEVICE_REQUESTER_USER_ID;assert.match(String(rid),/^[0-9a-f-]{36}$/i);
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
const status=client=>client.rpc('rpc_get_processor_map_status');
const publish=(client,args)=>client.rpc('rpc_publish_processor_map',{p_map_version:'v1-proof',p_counsel_reference:'PROOF FIXTURE - not counsel',p_effective_at:new Date(Date.now()-60000).toISOString(),p_entries:[],...args});
const entry=(code,extra={})=>({providerCode:code,legalEntityName:`PROOF ENTITY ${code}`,legalRole:'PROCESSOR',purpose:'PROOF fixture purpose text, not a legal statement',
  dataCategories:['PROOF_CATEGORY'],processingRegions:'PROOF-REGION',crossBorderTransfer:false,transferMechanism:'PROOF fixture',dpaReference:'PROOF fixture',
  privacyNoticeUrl:`https://proof.invalid/${code.toLowerCase()}`,retentionDeletionTerms:'PROOF fixture',subprocessorTerms:'PROOF fixture',legalBasisReference:'PROOF fixture',...extra});
const REQUIRED=['GOOGLE_GEMINI_AI','OPENAI_AI','SUPABASE_PLATFORM'];
const fullEntries=()=>REQUIRED.map(code=>entry(code));
function asyncSql(application,query){return new Promise(resolve=>{
  execFile('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At','-c',
    `set application_name=${q(application)};set statement_timeout='20s';${query}`],{encoding:'utf8',maxBuffer:1024*1024},
    (error,stdout,stderr)=>resolve({success:!error,stdout,stderr}));
});}
const serviceSql=query=>`begin;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.role','service_role',true);${query};commit;`;
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
const publishSql=version=>`select public.rpc_publish_processor_map(${q(version)},'PROOF FIXTURE - not counsel',statement_timestamp()-interval '1 minute',${q(JSON.stringify(fullEntries()))}::jsonb)`;
let history,predecessorCount;
try{
  check('PREFLIGHT_LIVE87_PREDECESSOR_WITHOUT_PROCESSOR_OBJECTS');
  predecessorCount=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(predecessorCount,plan.expected_predecessor_count);
  for(const rel of ['private.processor_provider_inventory','private.processor_map_sets','private.processor_map_entries'])assert.equal(sql(`select to_regclass(${q(rel)}) is null`),'t',rel);
  assert.equal(sql("select to_regprocedure('public.rpc_get_processor_map_status()') is null"),'t');
  await ok(requester.auth.signInWithPassword({email:env.RU5_DEVICE_REQUESTER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
  assert.equal((await ok(requester.auth.getUser())).user.id,rid);
  report.predecessor_history_count=predecessorCount;pass();

  {
  check('EXACT_FORWARD_APPLY_PRESERVES_ALL87_HISTORY_SEEDS_ONLY_TECHNICAL_INVENTORY_AND_CLOSES_TABLES');
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
  const inventory=rows('select code,required_current,active from private.processor_provider_inventory order by code');
  assert.deepEqual(inventory,[{code:'EXPO_PUSH',required_current:false,active:false},{code:'GOOGLE_GEMINI_AI',required_current:true,active:true},
    {code:'OPENAI_AI',required_current:true,active:true},{code:'SUPABASE_PLATFORM',required_current:true,active:true}]);
  assert.equal(sql('select count(*) from private.processor_map_sets'),'0');assert.equal(sql('select count(*) from private.processor_map_entries'),'0');
  const acl=rows(`select c.relname,c.relrowsecurity rls,c.relforcerowsecurity forced,
    has_table_privilege('anon',c.oid,'SELECT') anon_select,has_table_privilege('authenticated',c.oid,'SELECT') auth_select,
    has_table_privilege('authenticated',c.oid,'INSERT') auth_insert,has_table_privilege('authenticated',c.oid,'UPDATE') auth_update
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('processor_provider_inventory','processor_map_sets','processor_map_entries') order by 1`);
  assert.equal(acl.length,3);
  for(const r of acl){assert.equal(r.rls,true);assert.equal(r.forced,true);for(const k of ['anon_select','auth_select','auth_insert','auth_update'])assert.equal(r[k],false,`${r.relname}.${k}`);}
  const fn=rows(`select p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec,has_function_privilege('service_role',p.oid,'EXECUTE') service_exec,md5(p.prosrc) prosrc_md5
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('rpc_get_processor_map_status','rpc_publish_processor_map') order by 1`);
  assert.deepEqual(fn.map(f=>[f.proname,f.prosecdef,f.anon_exec,f.auth_exec,f.service_exec]),[
    ['rpc_get_processor_map_status',true,false,true,false],['rpc_publish_processor_map',true,false,false,true]]);
  report.new_functions=fn;report.table_acl=acl;report.inventory=inventory;
  sql("notify pgrst,'reload schema'");let ready=false;
  for(let i=0;i<60;i++){const r=await status(requester);if(!r.error&&r.data&&r.data.ready===false){ready=true;break;}await sleep(100);}
  assert.ok(ready,'rpc_get_processor_map_status not visible through PostgREST');
  report.exact_forward_file_applied_disposable=true;report.original_predecessor_full_history_unchanged=true;pass();
  }

  {
  check('STATUS_FAIL_CLOSED_NOT_PUBLISHED_WITH_ROLE_BOUNDARIES');
  const s=await ok(status(requester));
  assert.deepEqual(s,{ready:false,reason:'PROCESSOR_MAP_NOT_PUBLISHED',technicalProviderCount:4,requiredCurrentProviders:3,runtimeProviderGateAdmitted:false});
  await rejected(status(anon));await rejected(status(admin));
  pass();
  }

  {
  check('PUBLISH_TRUSTED_ONLY_VALIDATES_EVERY_ENTRY_AND_ROLLS_BACK_ATOMICALLY');
  await rejected(publish(requester,{p_entries:fullEntries()}));
  await rejected(publish(anon,{p_entries:fullEntries()}));
  assert.equal(sqlState(authSql(rid,publishSql('v1-auth'))),'42501');
  await rejected(publish(admin,{p_map_version:'',p_entries:fullEntries()}),'22023','PROCESSOR_MAP_VERSION_INVALID');
  await rejected(publish(admin,{p_counsel_reference:'x',p_entries:fullEntries()}),'22023','PROCESSOR_MAP_COUNSEL_REFERENCE_REQUIRED');
  await rejected(publish(admin,{p_effective_at:null,p_entries:fullEntries()}),'22023','PROCESSOR_MAP_EFFECTIVE_AT_REQUIRED');
  await rejected(publish(admin,{p_entries:[]}),'22023','PROCESSOR_MAP_ENTRIES_REQUIRED');
  await rejected(publish(admin,{p_entries:[...fullEntries(),entry('UNKNOWN_PROVIDER')]}),'22023','PROCESSOR_PROVIDER_UNKNOWN');
  await rejected(publish(admin,{p_entries:[...fullEntries(),entry('EXPO_PUSH')]}),'23514','PROCESSOR_PROVIDER_NOT_CURRENTLY_ACTIVE');
  await rejected(publish(admin,{p_entries:[entry('OPENAI_AI',{legalRole:'VENDOR'}),entry('GOOGLE_GEMINI_AI'),entry('SUPABASE_PLATFORM')]}),'22023','PROCESSOR_LEGAL_ROLE_INVALID');
  await rejected(publish(admin,{p_entries:[entry('OPENAI_AI',{dataCategories:[]}),entry('GOOGLE_GEMINI_AI'),entry('SUPABASE_PLATFORM')]}),'22023','PROCESSOR_DATA_CATEGORIES_INVALID');
  await rejected(publish(admin,{p_entries:[entry('OPENAI_AI',{crossBorderTransfer:'yes'}),entry('GOOGLE_GEMINI_AI'),entry('SUPABASE_PLATFORM')]}),'22023','PROCESSOR_CROSS_BORDER_FLAG_REQUIRED');
  await rejected(publish(admin,{p_entries:[entry('OPENAI_AI',{privacyNoticeUrl:'http://insecure.invalid'}),entry('GOOGLE_GEMINI_AI'),entry('SUPABASE_PLATFORM')]}),'23514');
  await rejected(publish(admin,{p_entries:[entry('SUPABASE_PLATFORM')]}),'23514','PROCESSOR_MAP_REQUIRED_COVERAGE_MISSING');
  assert.equal(sql('select count(*) from private.processor_map_sets'),'0','partial publication must roll back');
  assert.equal(sql('select count(*) from private.processor_map_entries'),'0');
  assert.equal((await ok(status(requester))).reason,'PROCESSOR_MAP_NOT_PUBLISHED');
  pass();
  }

  let mapId;
  {
  check('COMPLETE_FIXTURE_PUBLICATION_MAKES_STATUS_READY_WITH_AUDIT');
  const receipt=await ok(publish(admin,{p_entries:fullEntries()}));
  assert.equal(receipt.mapVersion,'v1-proof');assert.equal(receipt.requiredCurrentProviders,3);assert.equal(receipt.coveredCurrentProviders,3);assert.equal(receipt.runtimeProviderGateAdmitted,false);
  mapId=receipt.mapId;assert.match(String(mapId),/^[0-9a-f-]{36}$/i);
  const s=await ok(status(requester));
  assert.equal(s.ready,true);assert.equal(s.reason,null);assert.equal(s.mapVersion,'v1-proof');assert.equal(s.runtimeProviderGateAdmitted,false);
  assert.deepEqual(s.providers.map(p=>p.providerCode).sort(),REQUIRED);
  for(const p of s.providers){assert.match(p.privacyNoticeUrl,/^https:\/\/proof\.invalid\//);assert.equal(p.legalRole,'PROCESSOR');}
  const audit=rows(`select event_type,entity_type,entity_id,actor_user_id,detail from private.marketplace_audit_log where event_type='PROCESSOR_MAP_PUBLISHED'`);
  assert.equal(audit.length,1);assert.equal(audit[0].entity_type,'SYSTEM');assert.equal(audit[0].entity_id,mapId);assert.equal(audit[0].actor_user_id,null);assert.equal(audit[0].detail.mapVersion,'v1-proof');
  report.fixture_map={mapId,content_real:false};pass();
  }

  {
  check('SECOND_ACTIVE_PUBLICATION_REFUSED_RETIREMENT_REOPENS_AND_INCOMPLETE_COVERAGE_STAYS_CLOSED');
  await rejected(publish(admin,{p_map_version:'v2-proof',p_entries:fullEntries()}),'55000','PROCESSOR_MAP_ACTIVE_ALREADY_EXISTS');
  assert.equal(sql('select count(*) from private.processor_map_sets'),'1');
  sql(`update private.processor_map_sets set retired_at=statement_timestamp() where id=${q(mapId)}`);
  assert.equal((await ok(status(requester))).reason,'PROCESSOR_MAP_NOT_PUBLISHED');
  // A provider activated after publication must reopen the map: coverage is recomputed, never cached.
  const v2=await ok(publish(admin,{p_map_version:'v2-proof',p_entries:fullEntries()}));
  assert.equal((await ok(status(requester))).ready,true);
  sql(`update private.processor_provider_inventory set active=true,required_current=true where code='EXPO_PUSH'`);
  const incomplete=await ok(status(requester));
  assert.equal(incomplete.ready,false);assert.equal(incomplete.reason,'PROCESSOR_MAP_INCOMPLETE');assert.deepEqual(incomplete.missingProviders,['EXPO_PUSH']);
  sql(`update private.processor_provider_inventory set active=false,required_current=false where code='EXPO_PUSH'`);
  assert.equal((await ok(status(requester))).ready,true);
  sql(`update private.processor_map_sets set retired_at=statement_timestamp() where id=${q(v2.mapId)}`);
  assert.equal(sqlState(`insert into private.processor_map_sets(map_version,counsel_reference,effective_at) values('dup-a','PROOF',statement_timestamp()),('dup-b','PROOF',statement_timestamp())`),'23505');
  assert.equal(sql('select count(*) from private.processor_map_sets where retired_at is null'),'0');
  pass();
  }

  {
  check('OBSERVED_LOCK_CONCURRENT_TRUSTED_PUBLISH_CONVERGES_ON_ONE_ACTIVE_MAP');
  const holderApp='p4-holder-publish',waiterApp='p4-waiter-publish';
  const holder=asyncSql(holderApp,serviceSql(`${publishSql('v3-proof')};select pg_sleep(3)`));
  await waitActivity(holderApp,"wait_event='PgSleep'");
  const waiter=asyncSql(waiterApp,serviceSql(publishSql('v3-proof-b')));
  const observed=await waitBlockedBy(holderApp,waiterApp);report.lock_interleavings.push({case:'PUBLISH_HOLDER_PUBLISH_WAITER',...observed});
  const [h,w]=await Promise.all([holder,waiter]);
  assert.ok(h.success,'holder publish failed');assert.ok(!w.success,'waiter publish must be refused');
  assert.match(String(w.stderr),/PROCESSOR_MAP_ACTIVE_ALREADY_EXISTS/);
  assert.equal(sql('select count(*) from private.processor_map_sets where retired_at is null'),'1');
  assert.equal(sql("select map_version from private.processor_map_sets where retired_at is null"),'v3-proof');
  assert.equal((await ok(status(requester))).mapVersion,'v3-proof');
  pass();
  }

  {
  check('FINAL_FINGERPRINTS_HISTORY_AND_NO_REAL_CONTENT');
  assert.equal(sqlState(authSql(rid,'select count(*) from private.processor_map_entries')),'42501');
  assert.equal(sqlState(authSql(rid,'select count(*) from private.processor_provider_inventory')),'42501');
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),history);
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(report.migration_history_count,predecessorCount+1);
  assert.equal(report.migration_history_count + plan.pending_successor_count,plan.source_migration_count);
  assert.equal(sql("select count(*) from private.processor_map_entries where privacy_notice_url not like 'https://proof.invalid/%'"),'0');
  assert.equal(sql("select count(*) from private.processor_map_sets where counsel_reference not like 'PROOF%'"),'0');
  pass();
  }

  current='ADMITTED_SUCCESSOR_DOMAIN_INTEGRATION';
  report.successor_replay=await replayPendingDomain({plan,sql,db,url,snapshot:async()=>({
    tables: (manifest.new_tables ?? ['private.publication_policy_bundles','private.publication_policy_rule_refs']).map(table=>[table,tableHash(table)]),
    security: sql(`select coalesce(jsonb_agg(to_jsonb(p) order by n.nspname,p.proname,p.oid),'[]'::jsonb)::text
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private') and p.proname ~ 'processor'`),
    tableGrants: sql(`select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl) order by n.nspname,c.relname),'[]'::jsonb)::text
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relname ~ 'processor'`),
    columnGrants: sql(`select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,a.attacl) order by n.nspname,c.relname,a.attnum),'[]'::jsonb)::text
      from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
      where n.nspname in ('public','private') and c.relname ~ 'processor' and a.attnum>0 and not a.attisdropped`),
    policies: sql(`select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]'::jsonb)::text
      from pg_policies p where tablename ~ 'processor'`),
    projection: [await ok(status(requester))],
  })});
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(report.migration_history_count,plan.source_migration_count);
  report.result='PASS';
}catch(error){
  report.result='FAIL';report.failed_check=current;
  report.failure=error?.code==='ERR_ASSERTION'?`ASSERTION:${String(error.message).slice(0,200)}`:String(error.message).slice(0,200);
  process.exitCode=1;
}finally{
  writeFileSync(`${out}/proof-report.json`,`${JSON.stringify(report,null,2)}\n`);
  console.log(`${report.result} P4_PROCESSOR_MAP`);
}
