// SQL105 only, following the original P3 registry proof and exact source104.
// Real loopback Auth/PostgREST and PostgreSQL transactions. The one-second
// disposable fixture is deliberately NOT a legal retention period.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const baseOut=env.P3_ARTIFACT_DIR||'artifacts/p3-retention-schedule',out=baseOut+'/retention-execution';
mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('supabase/proofs/legal/p3_retention_execution_files.json','utf8'));
const sourcePath='supabase/migrations/'+manifest.forward_file,source=readFileSync(sourcePath);
const digest=(v,algorithm='sha256')=>createHash(algorithm).update(v).digest('hex');
assert.deepEqual(source,readFileSync(manifest.candidate_file));assert.equal(source.length,manifest.bytes);
assert.equal(digest(source),manifest.sha256);assert.equal(digest(source,'md5'),manifest.md5);
assert.equal(manifest.expected_predecessor_count,104);assert.equal(manifest.expected_history_count,105);
const report={unit:'P3_RETENTION_EXECUTION',source_sha:env.GITHUB_SHA??null,run_id:env.GITHUB_RUN_ID??null,result:'RUNNING',
  checks:[],lock_interleavings:[],candidate:manifest,input_sha256:{[sourcePath]:digest(source)},
  live_access:false,live_promotion:false,provider_called:false,mobile_proof:false,legal_content_real:false,policy_activated_live:false,
  mocked_rpc_responses:false,mocked_database:false,storage_called:false,account_closure_proven:false,all_data_classes_executable:false,
  technical_scope:'P3_AI_ABANDONED_UNBOUND_V1',fixture_boundary:'REAL_LOCAL_AUTH_POSTGREST_AND_ROLE_SCOPED_PSQL',
  app_abandonment_journey_proven:false,abandonment_anchor:'EXPLICIT_DISPOSABLE_SQL_STATUS_TRANSITION',
  policy_fixture:'DISPOSABLE_SYNTHETIC_ONLY_NOT_LEGAL_CONTENT',legacy_origin_backfilled:false};
for(const path of ['supabase/proofs/legal/p3_retention_execution_proof.mjs','supabase/proofs/legal/p3_retention_execution_files.json',
  'supabase/proofs/legal/p3_retention_execution_source_boundary.mjs'])report.input_sha256[path]=digest(readFileSync(path));
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(query,timeout=25000){try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],
  {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:24*1024*1024,timeout}).trim();}
catch(e){report.failed_sql={state:String(e.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNAVAILABLE',query_sha256:digest(query)};throw new Error('DISPOSABLE_SQL_FAILED_'+report.failed_sql.state);}}
const rows=(query,timeout)=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (${query}) x`,timeout));
const tableHash=(table,where='true',remove=[])=>{const value=`to_jsonb(t)-array[${remove.map(q).join(',')}]::text[]`;
  return sql(`select md5(coalesce(jsonb_agg(${value} order by (${value})::text),'[]'::jsonb)::text) from ${table} t where ${where}`);};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const owner=createClient(url,env.RU5_DEVICE_ANON_KEY,options),other=createClient(url,env.RU5_DEVICE_ANON_KEY,options),
  anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options),admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const rid=env.RU5_DEVICE_REQUESTER_USER_ID,wid=env.RU5_DEVICE_WORKER_USER_ID;
for(const id of [rid,wid])assert.match(id,/^[0-9a-f-]{36}$/i);
const ok=async value=>{const r=await value;if(r.error)throw new Error('LOCAL_AUTH_RPC_'+String(r.error.code??'FAILED')+':'+String(r.error.message??'').slice(0,80));return r.data;};
async function rejected(value,message){const r=await value;assert.ok(r.error,'EXPECTED_REJECTION');if(message)assert.equal(r.error.message,message);return r.error;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const status=()=>ok(owner.rpc('rpc_get_retention_execution_status'));
const claim=(accountId=rid)=>ok(admin.rpc('rpc_claim_retention_job',{p_account_id:accountId}));
const execute=j=>ok(admin.rpc('rpc_execute_retention_job',{p_job_id:j.jobId,p_attempt_id:j.attemptId}));
const hold=(accountId,conversationId,key,active,revision)=>ok(admin.rpc('rpc_set_retention_hold',{
  p_account_id:accountId,p_conversation_id:conversationId,p_hold_key:key,p_active:active,p_expected_revision:revision}));
const serviceSql=query=>`begin;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.role','service_role',true);${query};commit;`;
function expectSqlRejection(query,code){try{sql(query);assert.fail('EXPECTED_SQL_REJECTION');}catch(e){assert.equal(e.message,'DISPOSABLE_SQL_FAILED_'+code);delete report.failed_sql;}}
const fixtureIds=[],children=[];
function conversation({account=rid,purpose='NEED_INTAKE',status:state='ABANDONED',messages=1,safety='ALLOW',proposed=[],body='P3 disposable raw message',bound=null}={}){
  const id=randomUUID();fixtureIds.push(id);
  sql(`insert into public.ai_conversations(id,account_id,purpose,status,bound_need_id) values(${q(id)},${q(account)},${q(purpose)},'OPEN',${bound?q(bound):'null'});
    insert into public.ai_messages(account_id,conversation_id,role,body,safety,proposed_fact_ids)
      select ${q(account)},${q(id)},'USER',${q(body)},${q(safety)},array[${proposed.map(q).join(',')}]::uuid[] from generate_series(1,${messages});
    update public.ai_conversations set status=${q(state)} where id=${q(id)}`);
  return id;
}
const exists=id=>sql(`select exists(select 1 from public.ai_conversations where id=${q(id)})`)==='t';
const candidate=id=>sql(`select private.retention_ai_candidate(${q(id)}) is not null`)==='t';
const retryNow=id=>sql(`update private.retention_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=${q(id)}`);
function assertClaim(j,id){
  if(j.kind!=='CLAIMED')report.failed_claim={kind:j.kind,code:j.code??null,target_exists:exists(id),
    jobs:rows(`select status,attempt_number,last_code,lease_until>clock_timestamp() lease_active,
      next_attempt_at>clock_timestamp() retry_not_due from private.retention_jobs where conversation_id=${q(id)}`)};
  assert.equal(j.kind,'CLAIMED');assert.equal(j.dataset,'AI_ABANDONED_UNBOUND');
  assert.equal(sql(`select conversation_id from private.retention_jobs where id=${q(j.jobId)}`),id);return j;}
async function due(){await sleep(1200);}
let binding,policyId,privacyId,current='PREFLIGHT',historyBefore,oldPolicyRows,oldPolicyHash,oldPrivacyHash,oldGeneralStatus,
  oldFunctions,oldSecurity,oldDomainHashes,legacy,early,second,heldInitially,holdInitialKey,protectedIds=[],policyOriginal;
const check=name=>{current=name;console.log('START_CHECK '+name);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log('PASS_CHECK '+current);};
function review(patch={}){
  binding={...binding,...patch};delete binding.contentSha256;
  sql(`update private.retention_policy_sets set retention_execution=${q(JSON.stringify(binding))}::jsonb where id=${q(policyId)};
    update private.retention_policy_sets set retention_execution=retention_execution||jsonb_build_object('contentSha256',encode(extensions.digest(convert_to(retention_execution::text,'UTF8'),'sha256'),'hex')) where id=${q(policyId)}`);
}
const functionState=()=>rows(`select oid::regprocedure::text signature,proacl::text acl,proconfig,md5(prosrc) body from pg_proc where oid in (
  'public.rpc_get_retention_policy_status()'::regprocedure,'public.rpc_publish_retention_policy(text,text,timestamptz,jsonb)'::regprocedure,
  'public.rpc_get_data_export_status()'::regprocedure,'private.marketplace_tick(integer,timestamptz)'::regprocedure) order by signature`);
const security=()=>rows(`select oid::regclass::text relation,relacl::text acl,relrowsecurity,relforcerowsecurity from pg_class where oid in(
  'private.retention_policy_sets'::regclass,'private.retention_policy_rules'::regclass,'private.retention_data_classes'::regclass,
  'public.ai_conversations'::regclass,'public.ai_messages'::regclass,'public.ai_structured_facts'::regclass,'public.ai_action_proposals'::regclass) order by relation`);
const domainTables=['public.needs','public.need_sensitive','public.need_geography','public.ai_structured_facts','public.ai_action_proposals',
  'private.need_draft_save_commands','private.need_edit_commands','private.need_publish_commands','public.agreements','public.agreement_messages',
  'public.account_legal_acceptance_events','public.data_export_requests','private.data_export_artifacts'];
async function holder(label,account,extra=''){
  const child=spawn('psql',[db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});children.push(child);
  const ready=new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('LOCK_HOLDER_TIMEOUT')),8000);
    child.once('error',reject);child.stdout.on('data',b=>{text+=b.toString();if(text.includes('P3_HELD')){clearTimeout(timer);resolve();}});});
  child.stdin.write(`set application_name=${q(label)};begin;select pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||${q(account)},0));
    select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.role','service_role',true);${extra};select 'P3_HELD';\n`);
  await ready;return async()=>{const ended=new Promise(resolve=>child.once('exit',resolve));child.stdin.end('commit;\n');await ended;};
}
async function waitBlocked(label){for(let i=0;i<80;i++){
  const observed=rows(`select w.pid waiter_pid,h.pid holder_pid,w.wait_event_type,w.wait_event,
    h.pid=any(pg_blocking_pids(w.pid)) blocked_by_holder from pg_stat_activity w cross join pg_stat_activity h
    where h.application_name=${q(label)} and w.pid<>h.pid and h.pid=any(pg_blocking_pids(w.pid))`)[0];
  if(observed?.wait_event_type==='Lock'&&observed.blocked_by_holder)return observed;await sleep(50);
}throw new Error('EXPECTED_HOLD_EXECUTE_LOCK_NOT_OBSERVED');}
async function bounded(value){let timer;try{return await Promise.race([value,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('OTHER_ACCOUNT_PROGRESS_TIMEOUT')),8000);})]);}finally{clearTimeout(timer);}}

// BEGIN_LOCAL_CRON_ISOLATION: executed only after the existing disposable guard.
// pg_cron records starting/connecting/sending/running invocations. Pausing its
// exact job does not by itself prove that an already-started backend has exited.
let originalCron=null;
const cronDefinition=(timeout=5000)=>{
  const found=rows("select to_jsonb(j) definition from cron.job j where jobname='uskoci_marketplace_tick'",timeout);
  assert.equal(found.length,1,'LOCAL_CRON_EXACT_JOB_REQUIRED');return found[0].definition;
};
function setCronActive(expected,active){
  assert.deepEqual(cronDefinition(),expected,'LOCAL_CRON_DEFINITION_CHANGED');
  // The supported extension API checks job ownership; postgres need not have
  // direct cron.job UPDATE. Omitted schedule/command/database/username stay intact.
  sql(`begin;set local lock_timeout='5s';select cron.alter_job(job_id:=${q(expected.jobid)}::bigint,
    active:=${active?'true':'false'});commit;`);
  assert.deepEqual(cronDefinition(),{...expected,active},'LOCAL_CRON_DEFINITION_CHANGED');
}
async function pauseLocalCron(){
  assertLocalDeviceProofTargets(url,db);
  assert.equal(sql("select current_setting('cron.log_run')"),'on','LOCAL_CRON_RUN_LOG_REQUIRED');
  const found=cronDefinition();
  assert.equal(found.jobname,'uskoci_marketplace_tick');
  assert.equal(found.command,'select private.marketplace_tick(25);');
  assert.equal(found.schedule,'* * * * *');assert.equal(found.database,'postgres');
  assert.equal(found.username,'postgres');assert.equal(typeof found.active,'boolean');
  assert.ok(Number.isSafeInteger(found.jobid)&&found.jobid>0,'LOCAL_CRON_JOB_ID_INVALID');
  // Set restoration ownership before the first write, including an uncertain
  // psql acknowledgement. Never replace its command/schedule or recreate a job.
  originalCron=structuredClone(found);
  report.local_scheduler={definition:originalCron,paused:false,drained:false,restored:false,
    drain_timeout_ms:15000,quiet_window_ms:1500};
  if(found.active)setCronActive(found,false);
  report.local_scheduler.paused=true;
  const deadline=Date.now()+15000;let quietSince=null;
  const remaining=()=>{const ms=deadline-Date.now();if(ms<=0)throw new Error('LOCAL_CRON_DRAIN_TIMEOUT');return Math.min(ms,5000);};
  while(Date.now()<deadline){
    assert.deepEqual(cronDefinition(remaining()),{...originalCron,active:false},'LOCAL_CRON_DEFINITION_CHANGED');
    const runs=rows(`select runid::text,job_pid,status from cron.job_run_details
      where jobid=${q(found.jobid)}::bigint and end_time is null and status not in('succeeded','failed')`,remaining());
    const backends=rows(`select pid,state from pg_stat_activity where pid<>pg_backend_pid()
      and datname=${q(found.database)} and usename=${q(found.username)} and state is distinct from 'idle'
      and (query=${q(found.command)} or pid in(select job_pid from cron.job_run_details
        where jobid=${q(found.jobid)}::bigint and end_time is null and status not in('succeeded','failed')))`,remaining());
    report.local_scheduler.last_observed={runs,backends};
    if(!runs.length&&!backends.length){
      quietSince??=Date.now();
      if(Date.now()-quietSince>=1500){report.local_scheduler.drained=true;return;}
    }else quietSince=null;
    await sleep(Math.min(200,remaining()));
  }
  throw new Error('LOCAL_CRON_DRAIN_TIMEOUT');
}
function restoreLocalCron(){
  if(!originalCron)return;
  assertLocalDeviceProofTargets(url,db);
  const found=cronDefinition();
  if(found.active===originalCron.active)assert.deepEqual(found,originalCron,'LOCAL_CRON_DEFINITION_CHANGED');
  else{
    assert.deepEqual(found,{...originalCron,active:false},'LOCAL_CRON_DEFINITION_CHANGED');
    setCronActive(found,originalCron.active);
  }
  assert.deepEqual(cronDefinition(),originalCron,'LOCAL_CRON_RESTORE_FAILED');
  report.local_scheduler.restored=true;
}
// END_LOCAL_CRON_ISOLATION

try{
  await pauseLocalCron();
  {
  check('PREFLIGHT_REAL_SOURCE104_AND_ORIGINAL_REGISTRY_REPORT');
  const priorPath=baseOut+'/proof-report.json',prior=JSON.parse(readFileSync(priorPath,'utf8'));
  assert.equal(prior.unit,'P3_RETENTION_SCHEDULE');assert.equal(prior.result,'PASS');assert.equal(prior.migration_history_count,104);
  assert.equal(prior.source_sha,env.GITHUB_SHA??null);assert.equal(prior.predecessor_plan.source_migration_count,104);
  assert.equal(prior.full_source_plan.source_migration_count,108);
  assert.deepEqual(prior.deferred_authority_successors.map(x=>x.file),['20260910172132_clean_w03_owned_ai_intake_authority.sql','20260910193029_clean_n09_expo_push_transport.sql','20260910214845_clean_dispatch_need_lock_order.sql']);
  assert.equal(prior.successor_replay.additive_extension.sha256,'502972ad434df78a9a6126879370af6e52f3e4700c4711da8b515a78b7012d6a');
  report.prior_registry_report_sha256=digest(readFileSync(priorPath));
  assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')),104);
  assert.equal(sql("select md5(statements[1]) from supabase_migrations.schema_migrations where version='20260910153005'"),'3ed748517ea4a4cb3d83fcc57db6ac86');
  for(const table of ['private.retention_holds','private.retention_jobs','private.retention_scan_cursors'])assert.equal(sql(`select to_regclass(${q(table)}) is null`),'t');
  assert.equal(sql("select count(*) from pg_attribute where attrelid='private.retention_policy_sets'::regclass and attname='retention_execution' and not attisdropped"),'0');
  for(const [client,email,id] of [[owner,env.RU5_DEVICE_REQUESTER_EMAIL,rid],[other,env.RU5_DEVICE_WORKER_EMAIL,wid]]){
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(client.auth.getUser())).user.id,id);
  }
  oldGeneralStatus=await ok(owner.rpc('rpc_get_retention_policy_status'));
  assert.equal(oldGeneralStatus.executionAdmitted,false);
  oldPolicyRows=rows('select * from private.retention_policy_sets order by id');
  assert.ok(oldPolicyRows.every(p=>p.counsel_reference.startsWith('PROOF')),'ONLY_KNOWN_SYNTHETIC_PREDECESSOR_POLICIES_ALLOWED');
  assert.equal(oldPolicyRows.filter(p=>p.retired_at===null).length,1);
  assert.equal(oldPolicyRows.find(p=>p.retired_at===null).policy_version,'v3-proof');
  assert.equal(sql("select count(*) from private.legal_document_versions where document_kind='PRIVACY' and is_active"),'0');
  historyBefore=tableHash('supabase_migrations.schema_migrations');oldPolicyHash=tableHash('private.retention_policy_sets');oldPrivacyHash=tableHash('private.legal_document_versions');
  oldFunctions=functionState();oldSecurity=security();oldDomainHashes=domainTables.map(t=>tableHash(t));
  legacy=randomUUID();fixtureIds.push(legacy);
  sql(`insert into public.ai_conversations(id,account_id,purpose,status) values(${q(legacy)},${q(rid)},'NEED_INTAKE','ABANDONED')`);
  report.predecessor_history_count=104;pass();

  }
  {
  check('EXACT_FORWARD_ADDITIVE_ONLY_PRESERVES_HISTORY_ACLS_POLICY_AND_LEGACY_ROWS');
  const aiBefore=tableHash('public.ai_conversations'),messagesBefore=tableHash('public.ai_messages');
  sql(source.toString('utf8'));
  sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(manifest.forward_version)},${q(manifest.forward_name)},array[${q(source.toString('utf8'))}]);notify pgrst,'reload schema'`);
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),historyBefore);
  assert.equal(tableHash('private.retention_policy_sets','true',['retention_execution']),oldPolicyHash);
  assert.equal(tableHash('public.ai_conversations','true',['retention_unbound_origin','retention_abandoned_at']),aiBefore);
  assert.equal(tableHash('public.ai_messages'),messagesBefore);
  assert.equal(sql('select count(*) from public.ai_conversations where retention_unbound_origin or retention_abandoned_at is not null'),'0');
  assert.equal(sql('select count(*) from private.retention_policy_sets where retention_execution is not null'),'0');
  const column=rows("select format_type(atttypid,atttypmod) type,attnotnull,atthasdef from pg_attribute where attrelid='private.retention_policy_sets'::regclass and attname='retention_execution' and not attisdropped");
  assert.deepEqual(column,[{type:'jsonb',attnotnull:false,atthasdef:false}]);
  const after=functionState();assert.equal(after.length,oldFunctions.length);
  for(let i=0;i<after.length;i++)assert.deepEqual(after[i].signature.startsWith('private.marketplace_tick(')?{...after[i],body:oldFunctions[i].body}:after[i],oldFunctions[i]);
  assert.deepEqual(security(),oldSecurity);assert.equal(sql('select private.retention_ai_source_ready()'),'t');
  assert.equal(sql('select count(*) from private.retention_jobs'),'0');assert.equal(sql('select count(*) from private.retention_holds'),'0');
  let visible=false;for(let i=0;i<80;i++){const r=await owner.rpc('rpc_get_retention_execution_status');if(!r.error){visible=true;break;}await sleep(100);}assert.ok(visible);
  report.original_source104_history_unchanged=true;report.original_columns_and_grants_preserved=true;pass();

  }
  {
  check('REAL_AUTH_PRIVATE_TABLES_AND_SERVICE_ONLY_COMMAND_BOUNDARIES');
  await rejected(anon.rpc('rpc_get_retention_execution_status'));await rejected(admin.rpc('rpc_get_retention_execution_status'));
  for(const client of [owner,other,anon]){
    await rejected(client.rpc('rpc_claim_retention_job',{p_account_id:rid}));
    await rejected(client.rpc('rpc_execute_retention_job',{p_job_id:randomUUID(),p_attempt_id:randomUUID()}));
    await rejected(client.rpc('rpc_set_retention_hold',{p_account_id:rid,p_conversation_id:null,p_hold_key:'p3-forbidden',p_active:true,p_expected_revision:0}));
  }
  const acl=rows("select relname,relrowsecurity,relforcerowsecurity,has_table_privilege('anon',oid,'SELECT') anon,has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') authenticated,has_table_privilege('service_role',oid,'SELECT,INSERT,UPDATE,DELETE') service from pg_class where oid in('private.retention_jobs'::regclass,'private.retention_holds'::regclass,'private.retention_scan_cursors'::regclass) order by relname");
  assert.equal(acl.length,3);for(const a of acl)assert.deepEqual([a.relrowsecurity,a.relforcerowsecurity,a.anon,a.authenticated,a.service],[true,true,false,false,false]);
  const privateAcl=rows("select proname,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,has_function_privilege('service_role',oid,'EXECUTE') service from pg_proc where pronamespace='private'::regnamespace and proname in('guard_retention_ai_origin','guard_retention_ai_child','retention_ai_source_ready','retention_execution_binding','retention_ai_candidate','claim_retention_job','execute_retention_job','retention_maintenance')");
  assert.equal(privateAcl.length,8);for(const a of privateAcl)assert.deepEqual([a.anon,a.authenticated,a.service],[false,false,false]);
  expectSqlRejection(`begin;set local role authenticated;select set_config('request.jwt.claim.role','service_role',true);select public.rpc_claim_retention_job(null);rollback;`,'42501');
  report.service_only_commands_proven=true;pass();

  }
  {
  check('MISSING_EXECUTABLE_BINDING_STAYS_CLOSED_WITH_NO_JOB_OR_DELETION');
  early=conversation();second=conversation();heldInitially=conversation();holdInitialKey='p3-initial-'+randomUUID();
  await due();await hold(rid,heldInitially,holdInitialKey,true,0);
  const s=await status();assert.equal(s.executionAdmitted,false);assert.equal(s.datasets[0].reason,'POLICY_NOT_READY');
  assert.equal(s.engineVersion,'P3_AI_ABANDONED_UNBOUND_V1');assert.equal(s.storageCleanup,'NOT_APPLICABLE');
  assert.equal(s.unsupportedDataClasses.includes('AI_VOLATILE'),false);assert.equal(s.unsupportedDataClasses.length,13);
  assert.deepEqual(await claim(),{kind:'NOT_READY',code:'POLICY_NOT_READY'});
  assert.equal(sql('select count(*) from private.retention_jobs'),'0');assert.ok(exists(early));
  assert.equal((await ok(owner.rpc('rpc_get_retention_policy_status'))).executionAdmitted,false);pass();

  }
  {
  check('EXPLICIT_SYNTHETIC_TYPED_POLICY_STRICT_HASH_PRIVACY_AND_COVERAGE_BINDING');
  sql("update private.retention_policy_sets set retired_at=clock_timestamp() where retired_at is null and policy_version='v3-proof'");
  privacyId=randomUUID();
  sql(`insert into private.legal_document_versions(id,document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active)
    values(${q(privacyId)},'PRIVACY',${q('P3_DISPOSABLE_'+randomUUID())},${q('b'.repeat(64))},'https://proof.invalid/p3-privacy',clock_timestamp()-interval '1 second',clock_timestamp()-interval '1 second',true)`);
  const classes=rows('select code from private.retention_data_classes where active and required order by code');
  const receipt=await ok(admin.rpc('rpc_publish_retention_policy',{p_policy_version:'P3_DISPOSABLE_'+randomUUID(),p_counsel_reference:'DISPOSABLE_SYNTHETIC_ONLY_NOT_LEGAL_CONTENT',
    p_effective_at:new Date(Date.now()-1000).toISOString(),p_rules:classes.map(x=>({dataClass:x.code,purpose:'DISPOSABLE synthetic retention purpose',retentionPeriod:'DISPOSABLE only',deletionTrigger:'DISPOSABLE synthetic trigger',exceptionRule:'DISPOSABLE controlled fixture',legalBasis:'DISPOSABLE not actual legal content'}))}));
  policyId=receipt.policyId;assert.equal(receipt.executionAdmitted,false);
  binding={schemaVersion:1,adapterVersion:'P3_AI_ABANDONED_UNBOUND_V1',dataClass:'AI_VOLATILE',dataset:'AI_ABANDONED_UNBOUND',action:'DELETE',trigger:'OBSERVED_ABANDONMENT',retentionSeconds:1,privacyDocumentId:privacyId,privacyContentSha256:'b'.repeat(64)};
  review();policyOriginal=structuredClone(binding);assert.equal((await status()).executionAdmitted,true);
  const invalid=[{schemaVersion:'1'},{adapterVersion:'ARBITRARY'},{dataset:'ALL_AI'},{action:'ANONYMIZE'},{trigger:'PARSE_PROSE'},
    {retentionSeconds:0},{retentionSeconds:-1},{retentionSeconds:1.5},{retentionSeconds:'1'},{retentionSeconds:2147483648},
    {privacyDocumentId:randomUUID()},{privacyContentSha256:'c'.repeat(64)},{extraSql:'DELETE FROM auth.users'}];
  for(const patch of invalid){binding=structuredClone(policyOriginal);review(patch);assert.equal((await status()).executionAdmitted,false);assert.equal((await claim()).kind,'NOT_READY');}
  binding=structuredClone(policyOriginal);review();
  sql(`update private.retention_policy_sets set retention_execution=retention_execution||jsonb_build_object('contentSha256',${q('0'.repeat(64))}) where id=${q(policyId)}`);
  assert.equal((await status()).executionAdmitted,false);review();
  sql(`update private.legal_document_versions set is_active=false where id=${q(privacyId)}`);assert.equal((await status()).executionAdmitted,false);
  sql(`update private.legal_document_versions set is_active=true where id=${q(privacyId)}`);
  const missing=rows(`select * from private.retention_policy_rules where policy_id=${q(policyId)} and data_class='NEED_PUBLIC'`)[0];
  sql(`delete from private.retention_policy_rules where id=${q(missing.id)}`);assert.equal((await status()).executionAdmitted,false);
  sql(`insert into private.retention_policy_rules select * from jsonb_populate_record(null::private.retention_policy_rules,${q(JSON.stringify(missing))}::jsonb)`);
  const ready=await status();assert.equal(ready.executionAdmitted,true);assert.equal(ready.datasets[0].reason,null);assert.equal(ready.policyVersion,receipt.policyVersion);
  report.narrow_typed_adapter_only=true;pass();

  }
  {
  check('OBSERVED_ORIGIN_NO_BACKFILL_ACTIVE_BOUND_FACT_PROPOSAL_AND_REPLAY_EVIDENCE_PROTECTED');
  assert.equal(candidate(legacy),false);
  const active=conversation({status:'OPEN'}),completed=conversation({status:'COMPLETED'}),otherPurpose=conversation({purpose:'PROFILE'}),unsafe=conversation({safety:'REVIEW'}),proposed=conversation({proposed:[randomUUID()]}),large=conversation({messages:101});
  protectedIds.push(legacy,active,completed,otherPurpose,unsafe,proposed,large);
  const boundNeed=rows(`select id,requester_profile_id from public.needs where requester_account_id=${q(rid)} order by id limit 1`)[0];
  assert.ok(boundNeed,'EXISTING_REQUESTER_NEED_FIXTURE_REQUIRED');
  const bound=conversation({bound:boundNeed.id});sql(`update public.ai_conversations set bound_need_id=null where id=${q(bound)}`);
  const facts=conversation({status:'OPEN'});
  sql(`insert into public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value,status,source,scope) values(${q(rid)},${q(facts)},'p3.disposable','"fixture"'::jsonb,'NEEDS_CONFIRMATION','EXPLICIT_USER_ANSWER','NEED_DRAFT');update public.ai_conversations set status='ABANDONED' where id=${q(facts)}`);
  const proposal=conversation({status:'OPEN'});
  sql(`insert into public.ai_action_proposals(account_id,conversation_id,action_kind,payload) values(${q(rid)},${q(proposal)},'P3_DISPOSABLE','{}');update public.ai_conversations set status='ABANDONED' where id=${q(proposal)}`);
  const replay=conversation();
  sql(`insert into private.need_draft_save_commands(account_id,client_request_id,request_hash,conversation_id,requester_profile_id,need_id,result) values(${q(rid)},${q('p3-disposable-'+randomUUID())},${q('d'.repeat(64))},${q(replay)},${q(boundNeed.requester_profile_id)},${q(boundNeed.id)},'{"proofOnly":true}')`);
  protectedIds.push(bound,facts,proposal,replay);
  for(const id of protectedIds)assert.equal(candidate(id),false,id);
  sql(`delete from public.ai_structured_facts where conversation_id=${q(facts)};delete from public.ai_action_proposals where conversation_id=${q(proposal)};
    update public.ai_conversations set retention_unbound_origin=true,retention_abandoned_at='2000-01-01Z' where id in(${q(bound)},${q(facts)},${q(proposal)},${q(legacy)})`);
  for(const id of [bound,facts,proposal,legacy])assert.equal(candidate(id),false);
  const anchor=sql(`select retention_abandoned_at from public.ai_conversations where id=${q(early)}`);
  sql(`update public.ai_conversations set retention_abandoned_at='2000-01-01Z' where id=${q(early)}`);assert.equal(sql(`select retention_abandoned_at from public.ai_conversations where id=${q(early)}`),anchor);
  report.active_bound_and_evidence_rows_protected=true;pass();

  }
  {
  check('DETERMINISTIC_DUE_CLAIM_HOLD_SKIP_AND_CONCURRENT_SINGLE_INTENT');
  const j=assertClaim(await claim(),early),k=assertClaim(await claim(),second);
  assert.equal((await claim()).kind,'NONE');
  const concurrent=conversation();await due();
  const pair=await Promise.all([claim(),claim()]);assert.deepEqual(pair.map(x=>x.kind).sort(),['CLAIMED','NONE']);
  const concurrentJob=assertClaim(pair.find(x=>x.kind==='CLAIMED'),concurrent);
  assert.equal(sql(`select count(*) from private.retention_jobs where conversation_id=${q(concurrent)}`),'1');
  report.claims_single_job_per_target=true;
  // Over one bounded scan of held rows cannot starve a later valid candidate.
  const scanIds=Array.from({length:101},()=>randomUUID()),scanKey='p3-scan-'+randomUUID();fixtureIds.push(...scanIds);
  sql(`insert into public.ai_conversations(id,account_id,purpose,status) select x,${q(wid)},'NEED_INTAKE','ABANDONED' from unnest(array[${scanIds.map(q).join(',')}]::uuid[]) x`);
  await hold(wid,null,scanKey,true,0);const later=conversation();await due();
  const scanned=await claim(null);assert.equal(scanned.kind,'NONE');
  const cursor=rows("select * from private.retention_scan_cursors where scope_id='00000000-0000-0000-0000-000000000000'")[0];assert.ok(cursor.conversation_id);
  const progressed=assertClaim(await claim(null),later);assert.equal((await execute(progressed)).status,'SUCCEEDED');
  sql(`delete from public.ai_conversations where id in(${scanIds.map(q).join(',')})`);
  await hold(wid,null,scanKey,false,1);report.bounded_scan_fair_progress=true;
  report.initial_jobs=[j,k,concurrentJob];pass();

  }
  {
  check('ACTUAL_ATOMIC_DELETE_MESSAGES_AND_EXACT_ATTEMPT_REPLAY');
  for(const j of report.initial_jobs){const id=sql(`select conversation_id from private.retention_jobs where id=${q(j.jobId)}`),r=await execute(j);
    assert.equal(r.status,'SUCCEEDED');assert.equal(r.deletedConversation,true);assert.equal(r.deletedMessages,1);assert.equal(exists(id),false);
    assert.equal(sql(`select count(*) from public.ai_messages where conversation_id=${q(id)}`),'0');
    assert.deepEqual(await execute(j),{...r,idempotentReplay:true});
  }
  for(const id of protectedIds)assert.ok(exists(id));assert.ok(exists(heldInitially));
  delete report.initial_jobs;report.actual_disposable_delete=true;report.exact_attempt_replay_proven=true;pass();

  }
  {
  check('HOLD_AFTER_CLAIM_WINS_REVISION_REPLAY_RELEASE_AND_RECLAIM_FENCE');
  const id=conversation();await due();const j=assertClaim(await claim(),id),key='p3-after-'+randomUUID();
  const h=await hold(rid,id,key,true,0);assert.equal(h.revision,1);assert.deepEqual(await hold(rid,id,key,true,0),{...h,idempotentReplay:true});
  await rejected(admin.rpc('rpc_set_retention_hold',{p_account_id:rid,p_conversation_id:id,p_hold_key:key,p_active:false,p_expected_revision:0}),'RETENTION_HOLD_REVISION_STALE');
  const r=await execute(j);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'HELD');assert.ok(exists(id));
  const released=await hold(rid,id,key,false,1);assert.equal(released.revision,2);retryNow(j.jobId);
  const newer=assertClaim(await claim(),id);assert.equal(newer.jobId,j.jobId);assert.notEqual(newer.attemptId,j.attemptId);
  await rejected(admin.rpc('rpc_execute_retention_job',{p_job_id:j.jobId,p_attempt_id:j.attemptId}),'RETENTION_ATTEMPT_STALE');
  assert.equal((await execute(newer)).status,'SUCCEEDED');
  report.post_claim_hold_precedence=true;report.reclaimed_attempt_fenced=true;pass();

  }
  {
  check('LATE_CHILD_ACTIVITY_INVALIDATES_SOURCE_AND_PERMANENTLY_RETIRES_CANDIDATE');
  const id=conversation();await due();const j=assertClaim(await claim(),id);
  sql(`update public.ai_messages set body='P3 disposable later activity' where conversation_id=${q(id)}`);
  const r=await execute(j);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'SOURCE_CHANGED');assert.ok(exists(id));assert.equal(candidate(id),false);
  sql(`update public.ai_conversations set status='OPEN' where id=${q(id)};update public.ai_conversations set status='ABANDONED',retention_unbound_origin=true where id=${q(id)}`);
  assert.equal(candidate(id),false);protectedIds.push(id);
  report.late_source_change_protected=true;pass();

  }
  {
  check('POLICY_CHANGE_EXPIRED_LEASE_AND_BOUNDED_RETRY_EXHAUSTION');
  const id=conversation();await due();let j=assertClaim(await claim(),id);
  review({retentionSeconds:2});assert.equal((await execute(j)).code,'POLICY_CHANGED');assert.ok(exists(id));
  binding=structuredClone(policyOriginal);review();retryNow(j.jobId);j=assertClaim(await claim(),id);
  sql(`update private.retention_jobs set lease_until=clock_timestamp()-interval '1 second' where id=${q(j.jobId)}`);
  assert.equal((await execute(j)).code,'LEASE_EXPIRED');assert.ok(exists(id));
  for(let attempt=3;attempt<=5;attempt++){retryNow(j.jobId);j=assertClaim(await claim(),id);
    assert.equal(Number(sql(`select attempt_number from private.retention_jobs where id=${q(j.jobId)}`)),attempt);
    sql(`update private.retention_jobs set lease_until=clock_timestamp()-interval '1 second' where id=${q(j.jobId)}`);assert.equal((await execute(j)).code,'LEASE_EXPIRED');}
  assert.equal(sql(`select next_attempt_at is null from private.retention_jobs where id=${q(j.jobId)}`),'t');assert.equal((await claim()).kind,'NONE');
  protectedIds.push(id);report.policy_rechecked=true;report.lease_and_retry_limit_proven=true;pass();

  }
  {
  check('DELETE_FAILURE_ROLLS_BACK_PARENT_AND_MESSAGES_BEFORE_RETRY');
  const id=conversation({messages:2});await due();const j=assertClaim(await claim(),id);
  sql(`alter table private.retention_jobs add constraint p3_disposable_success_failure check(not(id=${q(j.jobId)} and status='SUCCEEDED'))`);
  const failed=await execute(j);assert.equal(failed.status,'FAILED');assert.equal(failed.code,'EXECUTION_FAILED');assert.ok(exists(id));
  assert.equal(sql(`select count(*) from public.ai_messages where conversation_id=${q(id)}`),'2');
  sql('alter table private.retention_jobs drop constraint p3_disposable_success_failure');
  retryNow(j.jobId);const retry=assertClaim(await claim(),id);assert.notEqual(retry.attemptId,j.attemptId);
  const result=await execute(retry);assert.equal(result.status,'SUCCEEDED');assert.equal(result.deletedMessages,2);
  report.atomic_failure_rollback_proven=true;pass();

  }
  {
  check('OBSERVED_HOLD_TRANSACTION_BLOCKS_EXECUTE_AND_OTHER_ACCOUNT_PROGRESS_CONTINUES');
  const id=conversation(),otherId=conversation({account:wid});await due();const j=assertClaim(await claim(),id);
  const label='p3-hold-'+randomUUID(),key='p3-race-'+randomUUID();
  const release=await holder(label,rid,`select public.rpc_set_retention_hold(${q(rid)},${q(id)},${q(key)},true,0)`);
  let execution;try{
    execution=execute(j);report.lock_interleavings.push({case:'COMMITTED_HOLD_BEFORE_WAITING_EXECUTION',...await waitBlocked(label)});
    const otherJob=assertClaim(await bounded(claim(null)),otherId);assert.equal((await bounded(execute(otherJob))).status,'SUCCEEDED');
  }finally{await release();}
  const r=await execution;assert.equal(r.code,'HELD');assert.ok(exists(id));protectedIds.push(id);
  // Reverse order has a different, explicit result: a scoped hold waits for
  // the successful deletion transaction and is then refused for a gone row.
  const reverseId=conversation();await due();const reverseJob=assertClaim(await claim(),reverseId);
  const reverseLabel='p3-execute-'+randomUUID(),reverseKey='p3-after-delete-'+randomUUID();
  const releaseExecution=await holder(reverseLabel,rid,`select public.rpc_execute_retention_job(${q(reverseJob.jobId)},${q(reverseJob.attemptId)})`);
  let waitingHold;try{
    assert.ok(exists(reverseId),'DELETE_MUST_REMAIN_UNCOMMITTED_WHILE_HOLDER_OPEN');
    waitingHold=admin.rpc('rpc_set_retention_hold',{p_account_id:rid,p_conversation_id:reverseId,p_hold_key:reverseKey,p_active:true,p_expected_revision:0}).then(value=>value);
    report.lock_interleavings.push({case:'COMMITTED_EXECUTE_BEFORE_WAITING_SCOPED_HOLD',...await waitBlocked(reverseLabel)});
  }finally{await releaseExecution();}
  await rejected(waitingHold,'RETENTION_TARGET_NOT_FOUND');assert.equal(exists(reverseId),false);
  assert.equal(sql(`select status from private.retention_jobs where id=${q(reverseJob.jobId)}`),'SUCCEEDED');
  assert.equal(sql(`select count(*) from private.retention_holds where account_id=${q(rid)} and hold_key=${q(reverseKey)}`),'0');
  report.post_delete_hold_rejected=true;
  report.observed_hold_lock=true;report.other_account_progress=true;pass();

  }
  {
  check('UNADMITTED_SOURCE_EXTENSION_FAILS_CLOSED_WITHOUT_ARBITRARY_DELETE');
  const id=conversation();await due();const j=assertClaim(await claim(),id);
  sql('alter table public.ai_messages add column p3_disposable_unadmitted text null');
  const s=await status();assert.equal(s.executionAdmitted,false);assert.equal(s.datasets[0].reason,'SOURCE_NOT_READY');
  assert.deepEqual(await claim(),{kind:'NOT_READY',code:'SOURCE_NOT_READY'});assert.equal((await execute(j)).code,'SOURCE_CHANGED');assert.ok(exists(id));
  sql('alter table public.ai_messages drop column p3_disposable_unadmitted');assert.equal((await status()).executionAdmitted,true);
  retryNow(j.jobId);const next=assertClaim(await claim(),id);
  sql(`create function private.p3_disposable_unadmitted_trigger() returns trigger language plpgsql as $p3$ begin return null;end $p3$;
    create trigger p3_disposable_unadmitted after delete on public.ai_messages for each statement execute function private.p3_disposable_unadmitted_trigger()`);
  assert.equal((await status()).datasets[0].reason,'SOURCE_NOT_READY');assert.equal((await execute(next)).code,'SOURCE_CHANGED');assert.ok(exists(id));
  sql('drop trigger p3_disposable_unadmitted on public.ai_messages;drop function private.p3_disposable_unadmitted_trigger()');
  retryNow(j.jobId);const inherited=assertClaim(await claim(),id);
  sql('create table private.p3_disposable_inheritance () inherits(public.ai_messages)');
  assert.equal((await status()).datasets[0].reason,'SOURCE_NOT_READY');assert.equal((await execute(inherited)).code,'SOURCE_CHANGED');assert.ok(exists(id));
  sql('drop table private.p3_disposable_inheritance');assert.equal((await status()).executionAdmitted,true);
  retryNow(j.jobId);const changedAttributes=assertClaim(await claim(),id);
  const schemaTrigger=sql("select pg_get_triggerdef(oid,true) from pg_trigger where tgrelid='public.ai_structured_facts'::regclass and tgname='guard_ai_fact_schema_trg'");
  sql(`begin;drop trigger guard_ai_fact_schema_trg on public.ai_structured_facts;
    create trigger guard_ai_fact_schema_trg before insert or update of fact_key on public.ai_structured_facts for each row execute function private.guard_ai_fact_schema();commit;`);
  assert.equal((await status()).datasets[0].reason,'SOURCE_NOT_READY');assert.equal((await execute(changedAttributes)).code,'SOURCE_CHANGED');assert.ok(exists(id));
  sql(`begin;drop trigger guard_ai_fact_schema_trg on public.ai_structured_facts;${schemaTrigger};commit;`);assert.equal((await status()).executionAdmitted,true);
  retryNow(j.jobId);assert.equal((await execute(assertClaim(await claim(),id))).status,'SUCCEEDED');
  await rejected(admin.rpc('rpc_execute_retention_job',{p_job_id:randomUUID(),p_attempt_id:randomUUID()}),'RETENTION_JOB_NOT_FOUND');
  report.unadmitted_source_closed=true;pass();

  }
  {
  check('EXISTING_MARKETPLACE_TICK_INVOKES_ADAPTER_AND_PRESERVES_EXPORT_OWNER');
  const id=conversation();await due();const before=domainTables.map(t=>tableHash(t)),jobs=tableHash('private.retention_jobs');
  // Execute the actual scheduler in a transaction, assert its real delete, then
  // roll back the entire scheduler call so unrelated baseline lifecycle rows
  // are unchanged. Actual committed deletion was already proven above.
  const output=sql(`begin;select private.marketplace_tick(1,statement_timestamp());select not exists(select 1 from public.ai_conversations where id=${q(id)});rollback;`).split('\n');
  const tick=JSON.parse(output.find(line=>line.startsWith('{')));assert.equal(tick.authoritative,true);
  for(const key of ['expiry','dispatch','completion','exportMaintenance','retentionMaintenance'])assert.ok(key in tick);
  assert.equal(tick.retentionMaintenance.deletedConversations,1);assert.equal(tick.retentionMaintenance.storageCleanup,'NOT_APPLICABLE');assert.ok(output.includes('t'));
  assert.ok(exists(id));assert.equal(tableHash('private.retention_jobs'),jobs);assert.deepEqual(domainTables.map(t=>tableHash(t)),before);
  assert.equal((await execute(assertClaim(await claim(),id))).status,'SUCCEEDED');report.existing_tick_wiring_proven=true;report.scheduler_fixture_rolled_back=true;pass();

  }
  {
  check('RESTORE_SYNTHETIC_POLICY_INERT_FINAL_HISTORY_SECURITY_AND_MINIMAL_AUDIT');
  sql(`update private.retention_policy_sets set retention_execution=null,retired_at=clock_timestamp() where id=${q(policyId)};
    update private.legal_document_versions set is_active=false,retired_at=clock_timestamp() where id=${q(privacyId)};
    update private.retention_policy_sets set retired_at=null where policy_version='v3-proof' and counsel_reference like 'PROOF%';
    delete from public.ai_conversations where id in(${fixtureIds.map(q).join(',')})`);
  assert.equal(tableHash('private.retention_policy_sets',`id<>${q(policyId)}`,['retention_execution']),oldPolicyHash);
  assert.equal(tableHash('private.legal_document_versions',`id<>${q(privacyId)}`),oldPrivacyHash);
  assert.deepEqual(await ok(owner.rpc('rpc_get_retention_policy_status')),oldGeneralStatus);
  assert.equal((await status()).executionAdmitted,false);assert.equal((await status()).datasets[0].reason,'POLICY_NOT_READY');
  assert.equal(sql('select count(*) from private.retention_policy_sets where retention_execution is not null'),'0');
  assert.equal(sql('select count(*) from private.retention_holds where active and conversation_id is null'),'0');
  report.no_active_account_holds=true;
  assert.deepEqual(domainTables.map(t=>tableHash(t)),oldDomainHashes);assert.deepEqual(security(),oldSecurity);
  const after=functionState();for(let i=0;i<after.length;i++)assert.deepEqual(after[i].signature.startsWith('private.marketplace_tick(')?{...after[i],body:oldFunctions[i].body}:after[i],oldFunctions[i]);
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),historyBefore);
  assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations where version=${q(manifest.forward_version)}`),manifest.md5);
  const audit=rows("select event_type,actor_user_id,detail from private.marketplace_audit_log where event_type in('RETENTION_JOB_CLAIMED','RETENTION_HOLD_SET','RETENTION_HOLD_RELEASED','RETENTION_DELETE_COMPLETED','RETENTION_DELETE_DEFERRED')");
  assert.ok(audit.length>0);for(const row of audit){assert.equal(row.actor_user_id,null);for(const key of Object.keys(row.detail))assert.ok(['attempt','policyId','dataset','revision','deletedMessages','code'].includes(key));}
  assert.equal(sql("select count(*) from pg_proc where proname='p3_disposable_unadmitted_trigger'"),'0');
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));assert.equal(report.migration_history_count,105);
  report.original_domain_rows_unchanged=true;report.policy_fixture_restored_inert=true;report.minimal_audit_proven=true;
  report.execution_job_counts=rows('select status,count(*)::integer count from private.retention_jobs group by status order by status');
  pass();assert.equal(report.checks.length,16);report.result='PASS';
  }
}catch(error){report.result='FAIL';report.failed_check=current;report.failure=String(error.message).slice(0,220);
  const frame=String(error.stack??'').match(/p3_retention_execution_proof\.mjs:(\d+):(\d+)/);
  if(frame)report.failure_location={file:'supabase/proofs/legal/p3_retention_execution_proof.mjs',line:Number(frame[1]),column:Number(frame[2])};
  process.exitCode=1;
}finally{
  for(const child of children)if(child.exitCode===null)child.kill();
  const primarySqlFailure=report.failed_sql;
  try{restoreLocalCron();}catch(error){
    // Preserve the original failed stage instead of replacing it with cleanup.
    report.scheduler_restore_failure='LOCAL_CRON_RESTORE_FAILED';
    if(report.failed_sql!==primarySqlFailure){report.scheduler_restore_sql=report.failed_sql;
      if(primarySqlFailure)report.failed_sql=primarySqlFailure;else delete report.failed_sql;}
    if(report.result!=='FAIL'){report.failed_check='LOCAL_CRON_RESTORE';report.failure='LOCAL_CRON_RESTORE_FAILED';}
    report.result='FAIL';process.exitCode=1;
  }
  writeFileSync(out+'/proof-report.json',JSON.stringify(report,null,2)+'\n');console.log(report.result+' P3_RETENTION_EXECUTION');
}
