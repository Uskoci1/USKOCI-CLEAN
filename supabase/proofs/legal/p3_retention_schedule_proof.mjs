// P3 retention schedule registry — authenticated disposable proof. Loopback
// only. Real local Auth/PostgREST commands plus role-scoped psql transactions
// with one observed publish lock interleaving. Fixture rules are proof-only and
// clearly labeled; no counsel content, no purge execution, no production or
// device call.
import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {readP3RetentionPredecessorPlan} from './p3_retention_schedule_predecessor.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const plan=readP3RetentionPredecessorPlan();
const out=env.P3_ARTIFACT_DIR||'artifacts/p3-retention-schedule';mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('supabase/proofs/legal/p3_retention_schedule_files.json','utf8'));
const forward=`supabase/migrations/${manifest.forward_file}`,bytes=readFileSync(forward);
assert.deepEqual(bytes,readFileSync(manifest.candidate_file));
assert.equal(bytes.length,manifest.bytes);
assert.equal(createHash('md5').update(bytes).digest('hex'),manifest.md5);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
const report={unit:'P3_RETENTION_SCHEDULE',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  live_access:false,live_promotion:false,provider_called:false,mobile_proof:false,legal_content_real:false,purge_executed:false,
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
const status=client=>client.rpc('rpc_get_retention_policy_status');
const publish=(client,args)=>client.rpc('rpc_publish_retention_policy',{p_policy_version:'v1-proof',p_counsel_reference:'PROOF FIXTURE - not counsel',p_effective_at:new Date(Date.now()-60000).toISOString(),p_rules:[],...args});
const CLASSES=['ACCOUNT_IDENTITY','AGREEMENT_CORE','AGREEMENT_MESSAGES','AI_VOLATILE','AUDIT_SECURITY_LOGS','COMMAND_LEDGERS','LEGAL_CONSENT','MEDIA_OBJECTS',
  'NEED_PUBLIC','NEED_SENSITIVE','NOTIFICATION_DELIVERY','PRESELECTION_QA','PROFILE_DATA','RESPONSES_SELECTION'];
const rule=(code,extra={})=>({dataClass:code,purpose:'PROOF fixture purpose text, not a legal statement',retentionPeriod:'PROOF period',deletionTrigger:'PROOF fixture trigger',
  exceptionRule:'PROOF fixture exception',legalBasis:'PROOF fixture basis',...extra});
const fullRules=()=>CLASSES.map(code=>rule(code));
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
const publishSql=version=>`select public.rpc_publish_retention_policy(${q(version)},'PROOF FIXTURE - not counsel',statement_timestamp()-interval '1 minute',${q(JSON.stringify(fullRules()))}::jsonb)`;
let history,predecessorCount;
try{
  check('PREFLIGHT_LIVE87_PREDECESSOR_WITHOUT_RETENTION_OBJECTS');
  predecessorCount=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(predecessorCount,plan.expected_predecessor_count);
  for(const rel of ['private.retention_data_classes','private.retention_policy_sets','private.retention_policy_rules'])assert.equal(sql(`select to_regclass(${q(rel)}) is null`),'t',rel);
  assert.equal(sql("select to_regprocedure('public.rpc_get_retention_policy_status()') is null"),'t');
  await ok(requester.auth.signInWithPassword({email:env.RU5_DEVICE_REQUESTER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
  assert.equal((await ok(requester.auth.getUser())).user.id,rid);
  report.predecessor_history_count=predecessorCount;pass();

  {
  check('EXACT_FORWARD_APPLY_PRESERVES_ALL87_HISTORY_SEEDS_ONLY_DATA_CLASSES_AND_CLOSES_TABLES');
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
  const classes=rows('select code,required,active from private.retention_data_classes order by code');
  assert.deepEqual(classes.map(c=>c.code),CLASSES);
  for(const c of classes){assert.equal(c.required,true);assert.equal(c.active,true);}
  assert.equal(sql('select count(*) from private.retention_policy_sets'),'0');assert.equal(sql('select count(*) from private.retention_policy_rules'),'0');
  const acl=rows(`select c.relname,c.relrowsecurity rls,c.relforcerowsecurity forced,
    has_table_privilege('anon',c.oid,'SELECT') anon_select,has_table_privilege('authenticated',c.oid,'SELECT') auth_select,
    has_table_privilege('authenticated',c.oid,'INSERT') auth_insert,has_table_privilege('authenticated',c.oid,'UPDATE') auth_update
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('retention_data_classes','retention_policy_sets','retention_policy_rules') order by 1`);
  assert.equal(acl.length,3);
  for(const r of acl){assert.equal(r.rls,true);assert.equal(r.forced,true);for(const k of ['anon_select','auth_select','auth_insert','auth_update'])assert.equal(r[k],false,`${r.relname}.${k}`);}
  const fn=rows(`select p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec,has_function_privilege('service_role',p.oid,'EXECUTE') service_exec,md5(p.prosrc) prosrc_md5
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('rpc_get_retention_policy_status','rpc_publish_retention_policy') order by 1`);
  assert.deepEqual(fn.map(f=>[f.proname,f.prosecdef,f.anon_exec,f.auth_exec,f.service_exec]),[
    ['rpc_get_retention_policy_status',true,false,true,false],['rpc_publish_retention_policy',true,false,false,true]]);
  assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname ~* 'purge|erase|retention_(run|apply|execute)'"),'0','no purge worker may be admitted');
  report.new_functions=fn;report.table_acl=acl;report.data_classes=classes.map(c=>c.code);
  sql("notify pgrst,'reload schema'");let ready=false;
  for(let i=0;i<60;i++){const r=await status(requester);if(!r.error&&r.data&&r.data.ready===false){ready=true;break;}await sleep(100);}
  assert.ok(ready,'rpc_get_retention_policy_status not visible through PostgREST');
  report.exact_forward_file_applied_disposable=true;report.original_predecessor_full_history_unchanged=true;pass();
  }

  {
  check('STATUS_FAIL_CLOSED_NOT_PUBLISHED_WITH_ROLE_BOUNDARIES');
  const s=await ok(status(requester));
  assert.deepEqual(s,{ready:false,reason:'RETENTION_POLICY_NOT_PUBLISHED',requiredDataClasses:CLASSES.length,executionAdmitted:false});
  await rejected(status(anon));await rejected(status(admin));
  pass();
  }

  {
  check('PUBLISH_TRUSTED_ONLY_VALIDATES_EVERY_RULE_AND_ROLLS_BACK_ATOMICALLY');
  await rejected(publish(requester,{p_rules:fullRules()}));
  await rejected(publish(anon,{p_rules:fullRules()}));
  assert.equal(sqlState(authSql(rid,publishSql('v1-auth'))),'42501');
  await rejected(publish(admin,{p_policy_version:'',p_rules:fullRules()}),'22023','RETENTION_POLICY_VERSION_INVALID');
  await rejected(publish(admin,{p_counsel_reference:'x',p_rules:fullRules()}),'22023','RETENTION_COUNSEL_REFERENCE_REQUIRED');
  await rejected(publish(admin,{p_effective_at:null,p_rules:fullRules()}),'22023','RETENTION_EFFECTIVE_AT_REQUIRED');
  await rejected(publish(admin,{p_rules:[]}),'22023','RETENTION_RULES_REQUIRED');
  await rejected(publish(admin,{p_rules:[...fullRules(),rule('REVIEWS_REPUTATION')]}),'22023','RETENTION_DATA_CLASS_INVALID');
  await rejected(publish(admin,{p_rules:[rule('ACCOUNT_IDENTITY',{purpose:'short'}),...fullRules().slice(1)]}),'23514');
  await rejected(publish(admin,{p_rules:[rule('ACCOUNT_IDENTITY',{legalBasis:'x'}),...fullRules().slice(1)]}),'23514');
  await rejected(publish(admin,{p_rules:[rule('ACCOUNT_IDENTITY'),rule('ACCOUNT_IDENTITY')]}),'23505');
  await rejected(publish(admin,{p_rules:fullRules().slice(0,13)}),'23514','RETENTION_POLICY_REQUIRED_COVERAGE_MISSING');
  assert.equal(sql('select count(*) from private.retention_policy_sets'),'0','partial publication must roll back');
  assert.equal(sql('select count(*) from private.retention_policy_rules'),'0');
  assert.equal((await ok(status(requester))).reason,'RETENTION_POLICY_NOT_PUBLISHED');
  pass();
  }

  let policyId;
  {
  check('COMPLETE_FIXTURE_PUBLICATION_MAKES_STATUS_READY_WITH_AUDIT');
  const receipt=await ok(publish(admin,{p_rules:fullRules()}));
  assert.equal(receipt.policyVersion,'v1-proof');assert.equal(receipt.requiredDataClasses,CLASSES.length);assert.equal(receipt.coveredDataClasses,CLASSES.length);assert.equal(receipt.executionAdmitted,false);
  policyId=receipt.policyId;assert.match(String(policyId),/^[0-9a-f-]{36}$/i);
  const s=await ok(status(requester));
  assert.equal(s.ready,true);assert.equal(s.reason,null);assert.equal(s.policyVersion,'v1-proof');assert.equal(s.executionAdmitted,false);
  assert.deepEqual(s.rules.map(r=>r.dataClass),CLASSES);
  for(const r of s.rules){assert.match(r.purpose,/^PROOF /);assert.match(r.legalBasis,/^PROOF /);}
  const audit=rows(`select event_type,entity_type,entity_id,actor_user_id,detail from private.marketplace_audit_log where event_type='RETENTION_POLICY_PUBLISHED'`);
  assert.equal(audit.length,1);assert.equal(audit[0].entity_type,'SYSTEM');assert.equal(audit[0].entity_id,policyId);assert.equal(audit[0].actor_user_id,null);assert.equal(audit[0].detail.policyVersion,'v1-proof');
  report.fixture_policy={policyId,content_real:false};pass();
  }

  {
  check('SECOND_ACTIVE_PUBLICATION_REFUSED_RETIREMENT_REOPENS_AND_NEW_REQUIRED_CLASS_REOPENS_COVERAGE');
  await rejected(publish(admin,{p_policy_version:'v2-proof',p_rules:fullRules()}),'55000','RETENTION_ACTIVE_POLICY_ALREADY_EXISTS');
  assert.equal(sql('select count(*) from private.retention_policy_sets'),'1');
  sql(`update private.retention_policy_sets set retired_at=statement_timestamp() where id=${q(policyId)}`);
  assert.equal((await ok(status(requester))).reason,'RETENTION_POLICY_NOT_PUBLISHED');
  const v2=await ok(publish(admin,{p_policy_version:'v2-proof',p_rules:fullRules()}));
  assert.equal((await ok(status(requester))).ready,true);
  // A data class admitted later (e.g. with the reviews unit) must reopen the policy: coverage is recomputed, never cached.
  sql(`insert into private.retention_data_classes(code,description,required,active) values('REVIEWS_REPUTATION','PROOF fixture class admitted after publication',true,true)`);
  const incomplete=await ok(status(requester));
  assert.equal(incomplete.ready,false);assert.equal(incomplete.reason,'RETENTION_POLICY_INCOMPLETE');assert.deepEqual(incomplete.missingDataClasses,['REVIEWS_REPUTATION']);
  assert.equal(sqlState(`update private.retention_data_classes set active=false where code='REVIEWS_REPUTATION'`),'23514','required class cannot be inactive');
  sql(`update private.retention_data_classes set required=false,active=false where code='REVIEWS_REPUTATION'`);
  assert.equal((await ok(status(requester))).ready,true);
  sql(`update private.retention_policy_sets set retired_at=statement_timestamp() where id=${q(v2.policyId)}`);
  assert.equal(sqlState(`insert into private.retention_policy_sets(policy_version,counsel_reference,effective_at) values('dup-a','PROOF',statement_timestamp()),('dup-b','PROOF',statement_timestamp())`),'23505');
  assert.equal(sql('select count(*) from private.retention_policy_sets where retired_at is null'),'0');
  pass();
  }

  {
  check('OBSERVED_LOCK_CONCURRENT_TRUSTED_PUBLISH_CONVERGES_ON_ONE_ACTIVE_POLICY');
  const holderApp='p3-holder-publish',waiterApp='p3-waiter-publish';
  const holder=asyncSql(holderApp,serviceSql(`${publishSql('v3-proof')};select pg_sleep(3)`));
  await waitActivity(holderApp,"wait_event='PgSleep'");
  const waiter=asyncSql(waiterApp,serviceSql(publishSql('v3-proof-b')));
  const observed=await waitBlockedBy(holderApp,waiterApp);report.lock_interleavings.push({case:'PUBLISH_HOLDER_PUBLISH_WAITER',...observed});
  const [h,w]=await Promise.all([holder,waiter]);
  assert.ok(h.success,'holder publish failed');assert.ok(!w.success,'waiter publish must be refused');
  assert.match(String(w.stderr),/RETENTION_ACTIVE_POLICY_ALREADY_EXISTS/);
  assert.equal(sql('select count(*) from private.retention_policy_sets where retired_at is null'),'1');
  assert.equal(sql("select policy_version from private.retention_policy_sets where retired_at is null"),'v3-proof');
  assert.equal((await ok(status(requester))).policyVersion,'v3-proof');
  pass();
  }

  {
  check('FINAL_FINGERPRINTS_HISTORY_AND_NO_REAL_CONTENT');
  // Complete the current source stack after proving P3 at its original
  // position. A later forward is not silently omitted or treated as already
  // live; each source file and its one history entry are checked separately.
  const retentionBefore = await ok(status(requester));
  const tables = ['private.retention_data_classes','private.retention_policy_sets','private.retention_policy_rules'];
  const tableBefore = tables.map(table => tableHash(table));
  const functionsBefore = rows(`select p.proname,p.proacl,p.proconfig,md5(p.prosrc) body
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('rpc_get_retention_policy_status','rpc_publish_retention_policy') order by 1`);
  assert.equal(functionsBefore.length,2);
  const tableSecurity = () => rows(`select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'
    and c.relname in ('retention_data_classes','retention_policy_sets','retention_policy_rules') order by 1`);
  const securityBefore=tableSecurity(); assert.equal(securityBefore.length,3);
  const appliedSuccessors = [];
  for (const successor of plan.pending_successors) {
    assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version=${q(successor.version)}`),'0');
    const file = `supabase/migrations/${successor.file}`, suffixBytes = readFileSync(file);
    assert.equal(createHash('md5').update(suffixBytes).digest('hex'),successor.md5);
    execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',file],{stdio:'pipe'});
    sql(`insert into supabase_migrations.schema_migrations(version,name,statements)
      values(${q(successor.version)},${q(successor.name)},array[${q(suffixBytes.toString('utf8'))}])`);
    assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${q(successor.version)}`),successor.md5);
    appliedSuccessors.push(successor);
  }
  sql("notify pgrst,'reload schema'");
  assert.deepEqual(await ok(status(requester)),retentionBefore,'RETENTION_STATUS_CHANGED_BY_SUCCESSOR');
  assert.deepEqual(tables.map(table => tableHash(table)),tableBefore,'RETENTION_ROWS_CHANGED_BY_SUCCESSOR');
  assert.deepEqual(tableSecurity(),securityBefore,'RETENTION_TABLE_SECURITY_CHANGED_BY_SUCCESSOR');
  assert.deepEqual(rows(`select p.proname,p.proacl,p.proconfig,md5(p.prosrc) body
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('rpc_get_retention_policy_status','rpc_publish_retention_policy') order by 1`),functionsBefore,
    'RETENTION_FUNCTIONS_OR_GRANTS_CHANGED_BY_SUCCESSOR');
  report.successor_replay = { applied: appliedSuccessors, count: appliedSuccessors.length,
    retention_projection_unchanged: true, retention_rows_unchanged: true, retention_functions_and_grants_unchanged: true };

  assert.equal(sqlState(authSql(rid,'select count(*) from private.retention_policy_rules')),'42501');
  assert.equal(sqlState(authSql(rid,'select count(*) from private.retention_data_classes')),'42501');
  const newlyApplied = [manifest.forward_version,...appliedSuccessors.map(item => item.version)];
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version not in (${newlyApplied.map(q).join(',')})`),history);
  report.successor_replay.original_history_unchanged = true;
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(report.migration_history_count,predecessorCount+1+appliedSuccessors.length);
  assert.equal(report.migration_history_count,plan.source_migration_count);
  assert.equal(sql("select count(*) from private.retention_policy_rules where purpose not like 'PROOF %'"),'0');
  assert.equal(sql("select count(*) from private.retention_policy_sets where counsel_reference not like 'PROOF%'"),'0');
  pass();
  }
  report.result='PASS';
}catch(error){
  report.result='FAIL';report.failed_check=current;
  report.failure=error?.code==='ERR_ASSERTION'?`ASSERTION:${String(error.message).slice(0,200)}`:String(error.message).slice(0,200);
  process.exitCode=1;
}finally{
  writeFileSync(`${out}/proof-report.json`,`${JSON.stringify(report,null,2)}\n`);
  console.log(`${report.result} P3_RETENTION_SCHEDULE`);
}
