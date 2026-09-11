import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
assert.ok(env.N05_AUTHORITY_CANDIDATE === undefined || env.N05_AUTHORITY_CANDIDATE === '1','UNKNOWN_N05_MODE');
const authorityMode=env.N05_AUTHORITY_CANDIDATE === '1';
const uuid=(v)=>{assert.match(String(v),/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);return v;};
const workerId=uuid(env.RU5_DEVICE_WORKER_USER_ID),requesterId=uuid(env.RU5_DEVICE_REQUESTER_USER_ID),needId=uuid(env.RU5_DEVICE_NEED_ID);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const outsider=createClient(url,env.RU5_DEVICE_ANON_KEY,options),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const out=env.N05_ARTIFACT_DIR||'artifacts/notifications-n05';mkdirSync(out,{recursive:true});
const path=fileURLToPath(new URL(authorityMode?'../../migrations/20260911035330_clean_m05_agreement_change_authority.sql':'./n05_agreement_change_candidate.sql',import.meta.url));
const report={unit:authorityMode?'M05_AGREEMENT_CHANGE_AUTHORITY':'N05_AGREEMENT_CHANGE_EVENTS',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  candidate_sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),live_access:false,live_promotion:false,
  push_provider_called:false,mobile_proof:false,checks:[]};
let current='PREFLIGHT';let fault=false;
const check=(name)=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
function sql(query){try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At','-c',query],
  {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{throw new Error('DISPOSABLE_SQL_FAILED');}}
const rows=(q)=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${q}) x`));
const ok=async(p)=>{const r=await p;if(r.error)throw new Error('AUTH_RPC_FAILED');return r.data;};
const commandProcs="'public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)'::regprocedure,'public.rpc_respond_agreement_change(uuid,boolean)'::regprocedure";
const privileges=()=>rows(`select oid::regprocedure::text signature,prosecdef,proconfig,proacl from pg_proc where oid in (${commandProcs}) order by oid`);
function snapshot(){return ['agreements','agreement_versions','agreement_execution','agreement_change_proposals','user_activity_events','notification_deliveries']
  .map(name=>sql(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb) from public.${name} x`));}
async function reject(client,name,args){const before=snapshot();assert.ok((await client.rpc(name,args)).error);assert.deepEqual(snapshot(),before);}
function installFault(){sql(`create function private.n05_event_fault() returns trigger language plpgsql as $f$
  begin if new.event_type in ('AGREEMENT_CHANGE_PROPOSED','AGREEMENT_CHANGE_REJECTED','AGREEMENT_VERSION_CHANGED') then raise exception 'N05_FORCED_EVENT_FAILURE';end if;return new;end $f$;
  create trigger n05_event_fault before insert on public.user_activity_events for each row execute function private.n05_event_fault();`);fault=true;}
function removeFault(){sql('drop trigger n05_event_fault on public.user_activity_events;drop function private.n05_event_fault();');fault=false;}
function event(type,proposal,recipient,version){
  const matches=rows(`select * from public.user_activity_events where event_type='${type}' and payload->>'proposal_id'='${uuid(proposal)}'`);
  assert.equal(matches.length,1);const e=matches[0];
  assert.equal(e.recipient_user_id,recipient);assert.equal(e.recipient_role,recipient===workerId?'WORKER':'REQUESTER');
  assert.equal(e.entity_type,'AGREEMENT');assert.equal(e.entity_id,agreementId);assert.equal(e.entity_version,version);
  assert.deepEqual(e.payload,{proposal_id:proposal});
  const delivery=rows(`select title,body,channel,state,suppression_reason from public.notification_deliveries where event_id='${e.id}'`);
  assert.equal(delivery.length,2);
  for(const d of delivery){assert.ok(!JSON.stringify(d).includes('PRIVATE_CANARY'));assert.ok(!JSON.stringify(d).includes('4321'));
    assert.equal(d.state,'SUPPRESSED');assert.equal(d.suppression_reason,d.channel==='PUSH'?'PUSH_OFF':'IN_APP_OFF');}
  return e;
}
let agreementId;
try {
  if(authorityMode) await proveAuthority();
  else {
  check('REAL_AUTH_APPLICATION_SELECTION_AND_GUARDED_APPLY');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'79');
  for(const [client,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,workerId],[requester,env.RU5_DEVICE_REQUESTER_EMAIL,requesterId]]) {
    await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
    assert.equal((await ok(client.auth.getUser())).user.id,id);
    await ok(client.from('notification_preferences').upsert({user_id:id,role_context:id===workerId?'WORKER':'REQUESTER',in_app_enabled:false,push_enabled:false},
      {onConflict:'user_id,role_context'}));
  }
  const email=`n05-outsider-${randomUUID()}@proof.invalid`;
  const outsiderUser=await ok(admin.auth.admin.createUser({email,password:env.RU5_DEVICE_PASSWORD,email_confirm:true}));
  await ok(outsider.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
  assert.notEqual(outsiderUser.user.id,workerId);assert.notEqual(outsiderUser.user.id,requesterId);
  const profile=await ok(worker.from('app_profiles').select('id').eq('account_id',workerId).eq('kind','WORKER').single());
  const need=await ok(worker.from('needs').select('revision').eq('id',needId).single());
  const response=await ok(worker.rpc('rpc_submit_response',{p_need_id:needId,p_need_revision:need.revision,p_worker_profile_id:profile.id,
    p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:`n05-submit-${randomUUID()}`}));
  agreementId=uuid(await ok(requester.rpc('rpc_select_response',{p_need_id:needId,p_need_revision:need.revision,p_response_id:response.responseId,
    p_response_version:response.version,p_content_hash:response.contentHash,p_client_request_id:`n05-select-${randomUUID()}`})));
  const beforePrivileges=privileges();
  const emitter=sql("select md5(prosrc) from pg_proc where oid='private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)'::regprocedure");
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',path],{stdio:'pipe'});
  assert.deepEqual(privileges(),beforePrivileges);
  assert.equal(sql("select md5(prosrc) from pg_proc where oid='private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)'::regprocedure"),emitter);
  pass();

  const propose={p_agreement_id:agreementId,p_expected_version:1,p_patch:{price_rsd:4321,scope_note:'PRIVATE_CANARY_SCOPE'},
    p_reason:'PRIVATE_CANARY_REASON',p_client_request_id:`n05-propose-${randomUUID()}`};
  check('AUTH_PARTICIPANT_STALE_DENIAL_HAS_NO_EVENT');
  await reject(anon,'rpc_propose_agreement_change_v2',propose);
  await reject(outsider,'rpc_propose_agreement_change_v2',propose);
  await reject(worker,'rpc_propose_agreement_change_v2',{...propose,p_expected_version:999});
  pass();
  check('PROPOSAL_EVENT_FAILURE_ROLLS_BACK_COMMAND');
  installFault();await reject(worker,'rpc_propose_agreement_change_v2',propose);removeFault();pass();
  check('PROPOSAL_COUNTERPART_ATOMICITY_REPLAY_AND_PRIVACY');
  const proposals=await Promise.all([ok(worker.rpc('rpc_propose_agreement_change_v2',propose)),ok(worker.rpc('rpc_propose_agreement_change_v2',propose))]);
  assert.equal(proposals[0],proposals[1]);const proposalId=uuid(proposals[0]);
  event('AGREEMENT_CHANGE_PROPOSED',proposalId,requesterId,1);
  const observed=await ok(requester.from('user_activity_events').select('id').eq('event_type','AGREEMENT_CHANGE_PROPOSED'));
  assert.equal(observed.length,1);
  assert.equal((await ok(outsider.from('user_activity_events').select('id'))).length,0);
  const beforeDirectWrite=snapshot();
  const direct=await requester.from('user_activity_events').update({payload:{tampered:true}}).eq('id',observed[0].id).select('id');
  assert.ok(direct.error || direct.data?.length===0,'RLS must deny affected rows even if PostgREST returns HTTP success');
  assert.deepEqual(snapshot(),beforeDirectWrite);
  pass();
  check('RESPOND_AUTH_AND_REJECTION_EVENT_ROLLBACK');
  const rejectArgs={p_proposal_id:proposalId,p_accept:false};
  await reject(worker,'rpc_respond_agreement_change',rejectArgs);
  await reject(outsider,'rpc_respond_agreement_change',rejectArgs);
  await reject(anon,'rpc_respond_agreement_change',rejectArgs);
  await reject(requester,'rpc_respond_agreement_change',{...rejectArgs,p_accept:null});
  installFault();await reject(requester,'rpc_respond_agreement_change',rejectArgs);removeFault();pass();
  check('REJECT_EVENT_TO_PROPOSER_AND_IDEMPOTENCY');
  await Promise.all([ok(requester.rpc('rpc_respond_agreement_change',rejectArgs)),ok(requester.rpc('rpc_respond_agreement_change',rejectArgs))]);
  event('AGREEMENT_CHANGE_REJECTED',proposalId,workerId,1);
  assert.equal(sql(`select current_version from public.agreements where id='${agreementId}'`),'1');
  await reject(requester,'rpc_respond_agreement_change',{...rejectArgs,p_accept:true});pass();
  check('REVERSE_PARTY_PROPOSAL_AND_ACCEPT_FAILURE_FULL_ROLLBACK');
  const second=uuid(await ok(requester.rpc('rpc_propose_agreement_change_v2',{...propose,p_client_request_id:`n05-reverse-${randomUUID()}`})));
  event('AGREEMENT_CHANGE_PROPOSED',second,workerId,1);
  const acceptArgs={p_proposal_id:second,p_accept:true};
  installFault();await reject(worker,'rpc_respond_agreement_change',acceptArgs);removeFault();pass();
  check('ACCEPT_NEW_VERSION_EVENT_TO_PROPOSER_AND_REPLAY');
  const accepted=await Promise.all([ok(worker.rpc('rpc_respond_agreement_change',acceptArgs)),ok(worker.rpc('rpc_respond_agreement_change',acceptArgs))]);
  assert.equal(accepted[0].agreementVersion,2);assert.equal(accepted[1].agreementVersion,2);
  event('AGREEMENT_VERSION_CHANGED',second,requesterId,2);
  assert.equal(sql(`select count(*) from public.agreement_versions where agreement_id='${agreementId}'`),'2');
  assert.equal(sql(`select agreement_version from public.agreement_execution where agreement_id='${agreementId}'`),'2');
  await reject(worker,'rpc_respond_agreement_change',{...acceptArgs,p_accept:false});pass();
  check('PREDECESSOR_GUARD_AND_FINAL_ZERO_ACTIVATION');
  assert.throws(()=>execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',path],{stdio:'pipe'}));
  assert.deepEqual(privileges(),beforePrivileges);
  assert.equal(sql('select count(*) from public.notification_push_attempts'),'0');
  for(const table of ['private.publication_policy_bundles','private.need_publication_decisions','private.preselection_qa_questions','private.preselection_qa_commands'])
    assert.equal(sql(`select count(*) from ${table}`),'0');
  assert.equal(sql("select count(*) from public.needs where mode='FASTEST'"),'0');
  assert.equal(sql("select count(*) from public.need_selections where selection_mode='AUTO_FILL'"),'0');
  assert.equal(sql("select count(*) from private.connection_activations where policy_key='REQUESTER_SELECTION_V1' and policy_version=1 and platform_cost_rsd=0 and beneficiary_account_id=requester_account_id"),'1');
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));assert.equal(report.migration_history_count,79);
  pass();report.result='PASS';console.log('PASS N05_AGREEMENT_CHANGE_AUTHENTICATED_PROOF');
  }
} catch(error) {report.result='FAIL';report.failed_check=current;
  if(authorityMode){
    report.failure_category=error?.code==='ERR_ASSERTION'?'ASSERTION':'EXECUTION';
    report.failure_line=String(error?.stack??'').match(/n05_agreement_change_proof\.mjs:(\d+):\d+/)?.[1]??null;
    report.sqlstate=String(error?.stderr??'').match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??null;
    console.error('FAIL M05_AGREEMENT_CHANGE_AUTHORITY '+current);
  }else console.error('FAIL N05',current,error.message);
  process.exitCode=1;
} finally {if(fault)removeFault();writeFileSync(`${out}/proof-report.json`,JSON.stringify(report,null,2)+'\n');}

// Explicit successor mode uses the existing registered108 local preparation.
// The original historical79/N05 branch and its assertions above stay intact.
// BEGIN_M05_OBSERVED_WAITER_GRAPH
function observedResponderWaitGraph(waiters,holderPid){
  if(!Number.isInteger(holderPid)||holderPid<=0||!Array.isArray(waiters)||waiters.length!==2)return null;
  const byPid=new Map();
  for(const row of waiters){
    if(!Number.isInteger(row.waiter_pid)||row.waiter_pid<=0||row.waiter_pid===holderPid||byPid.has(row.waiter_pid)
      ||row.holder_pid!==holderPid||row.wait_event_type!=='Lock'||!Array.isArray(row.blocking_pids)||row.blocking_pids.length===0)return null;
    byPid.set(row.waiter_pid,row);
  }
  for(const row of waiters)if(row.blocking_pids.some(pid=>!Number.isInteger(pid)||pid<=0||pid===row.waiter_pid
    ||(pid!==holderPid&&!byPid.has(pid))))return null;
  const reaches=(pid,seen)=>{
    if(pid===holderPid)return true;
    if(seen.has(pid))return false;
    const next=new Set(seen);next.add(pid);
    return byPid.get(pid).blocking_pids.some(blocker=>reaches(blocker,next));
  };
  if(!waiters.every(row=>reaches(row.waiter_pid,new Set())))return null;
  return waiters.map(row=>({...row,blocker_graph_reaches_holder:true}));
}
// END_M05_OBSERVED_WAITER_GRAPH
async function proveAuthority(){
  const {admitNativeSuccessors}=await import('../../../scripts/ci/owned-intake-proof.mjs');
  const {observedDeadlock}=await import('../calendar/w02_dispatch_lock_proof.mjs');
  const q=v=>"'"+String(v).replaceAll("'","''")+"'";
  const hash=v=>createHash('sha256').update(v).digest('hex');
  const forward='supabase/migrations/20260911035330_clean_m05_agreement_change_authority.sql';
  const bytes=readFileSync(path),children=new Set(),fixtureIds=[];
  const history=()=>rows('select * from supabase_migrations.schema_migrations order by version');
  const functions=()=>rows("select (to_jsonb(p)-'prosrc')||jsonb_build_object('oid',p.oid::text,'signature',format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)),'body_md5',md5(prosrc)) as value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where pronamespace in ('public'::regnamespace,'private'::regnamespace) order by p.oid").map(x=>x.value);
  const currentVersion=id=>Number(sql(`select current_version from public.agreements where id=${q(uuid(id))}::uuid`));
  const state=id=>rows(`select status,current_version from public.agreements where id=${q(uuid(id))}::uuid`)[0];
  const scopedSnapshot=()=>['agreements','agreement_versions','agreement_execution','agreement_change_proposals',
    'user_activity_events','notification_deliveries','private.worker_calendar_events'].map(table=>{
      const relation=table.startsWith('private.')?table:'public.'+table;
      const ids=fixtureIds.map(q).join(',')||'null';
      const predicate=table==='agreements'?`id in (${ids})`:table==='user_activity_events'?`entity_id in (${ids})`
        :table==='notification_deliveries'?`event_id in(select id from public.user_activity_events where entity_id in (${ids}))`:`agreement_id in (${ids})`;
      return sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${relation} x where ${predicate}`);
    });
  const denied=async(client,name,args,message,code)=>{const before=scopedSnapshot(),r=await client.rpc(name,args);
    assert.ok(r.error,'EXPECTED_REAL_RPC_REFUSAL');if(message)assert.equal(r.error.message,message);
    if(code)assert.equal(r.error.code,code);
    assert.deepEqual(scopedSnapshot(),before);};
  const propose=(client,command)=>client.rpc('rpc_propose_agreement_change_v2',command);
  const response=(client,id,accept)=>client.rpc('rpc_respond_agreement_change',{p_proposal_id:id,p_accept:accept});
  const command=(id,patch={price_rsd:4321},version=1)=>({p_agreement_id:id,p_expected_version:version,p_patch:patch,
    p_reason:'PRIVATE_CANARY_REASON',p_client_request_id:'m05-'+randomUUID()});
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function until(predicate,label){const limit=Date.now()+15000;while(Date.now()<limit){if(predicate())return;await pause(40);}throw new Error(label);}
  function session(name,initial,deadlock='10s'){
    assert.match(name,/^m05-[a-z-]+$/);
    const child=spawn('psql',[db,'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],{stdio:['pipe','pipe','pipe']});
    children.add(child);let stdout='',stderr='';
    child.stdout.on('data',data=>{stdout+=data;});child.stderr.on('data',data=>{stderr+=data;});
    const done=new Promise(resolve=>child.on('close',code=>{children.delete(child);resolve({code,stdout,stderr});}));
    child.stdin.write(`begin;set local application_name=${q(name)};set local statement_timeout='25s';set local deadlock_timeout=${q(deadlock)};${initial}\n`);
    return {child,done,output:()=>stdout,send:s=>child.stdin.write(s+'\n'),finish:s=>child.stdin.end(s+'\n')};
  }
  const actor=id=>`set local role authenticated;select set_config('request.jwt.claim.sub',${q(uuid(id))},true);`;
  const respondSql=(id,accept)=>`select public.rpc_respond_agreement_change(${q(uuid(id))}::uuid,${accept});`;
  const pid=name=>Number(sql(`select coalesce((select pid from pg_stat_activity where application_name=${q(name)}),0)`));
  const lock=(waiter,holder)=>rows(`select pid as waiter_pid,${holder} as holder_pid,wait_event_type,
    ${holder}=any(pg_blocking_pids(pid)) as blocked_by_holder from pg_stat_activity where pid=${waiter}`)[0];
  const awaitLock=async(name,holder)=>{await until(()=>{const p=pid(name);return p>0&&lock(p,holder)?.blocked_by_holder;},'M05_LOCK_NOT_OBSERVED');return lock(pid(name),holder);};
  let workerProfile,requesterProfile;
  async function agreement(label){
    const need=randomUUID();
    sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
      insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
        approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
      values(${q(need)}::uuid,${q(requesterId)}::uuid,${q(requesterProfile)}::uuid,'PUBLISHED',${q('M05 fixture '+label)},
        'DISPOSABLE SQL FIXTURE, NOT PUBLICATION UI','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',
        statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
    const r=await ok(worker.rpc('rpc_submit_response',{p_need_id:need,p_need_revision:1,p_worker_profile_id:workerProfile,
      p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:'Original scope',p_client_request_id:'m05-app-'+randomUUID()}));
    const id=uuid(await ok(requester.rpc('rpc_select_response',{p_need_id:need,p_need_revision:r.needRevision,
      p_response_id:r.responseId,p_response_version:r.version,p_content_hash:r.contentHash,p_client_request_id:'m05-select-'+randomUUID()})));
    fixtureIds.push(id);return id;
  }
  const cancel=id=>ok(requester.rpc('rpc_cancel_agreement',{p_agreement_id:id,p_reason:'End disposable M05 scenario'}));
  report.lock_interleavings=[];report.actual_auth=false;report.mocked_rpc_responses=false;report.fixture_sql_used=true;
  report.provider_called=false;report.history_predecessor_count=108;report.source_migration_count=109;
  report.input_sha256={[forward]:hash(bytes),'supabase/proofs/notifications/n05_agreement_change_proof.mjs':hash(readFileSync(fileURLToPath(import.meta.url)))};
  try{
    check('REGISTERED108_REAL_AUTH_AND_ORIGINAL_PROPOSAL_FIXTURES');
    const predecessor=admitNativeSuccessors(env);
    assert.equal(predecessor.history_count,108);assert.equal(predecessor.source_sha,env.GITHUB_SHA);
    report.registered108_admission_sha256=hash(readFileSync(env.RU5_DEVICE_ARTIFACT_DIR+'/native-successors-admission.json'));
    assert.deepEqual(bytes,execFileSync('git',['show',`${env.GITHUB_SHA}:${forward}`]));
    assert.equal(Math.trunc(Number(sql('show server_version_num'))/10000),17);
    const oldHistory=history();assert.equal(oldHistory.length,108);
    for(const [client,email,id] of [[worker,env.RU5_DEVICE_WORKER_EMAIL,workerId],[requester,env.RU5_DEVICE_REQUESTER_EMAIL,requesterId]]){
      await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
      assert.equal((await ok(client.auth.getUser())).user.id,id);
      await ok(client.from('notification_preferences').upsert({user_id:id,role_context:id===workerId?'WORKER':'REQUESTER',in_app_enabled:false,push_enabled:false},{onConflict:'user_id,role_context'}));
    }
    report.actual_auth=true;
    const outsiderEmail='m05-outsider-'+randomUUID()+'@proof.invalid';
    await ok(admin.auth.admin.createUser({email:outsiderEmail,password:env.RU5_DEVICE_PASSWORD,email_confirm:true}));
    await ok(outsider.auth.signInWithPassword({email:outsiderEmail,password:env.RU5_DEVICE_PASSWORD}));
    workerProfile=uuid(sql(`select id from public.app_profiles where account_id=${q(workerId)}::uuid and kind='WORKER'`));
    requesterProfile=uuid(sql(`select id from public.app_profiles where account_id=${q(requesterId)}::uuid and kind='REQUESTER'`));
    const legacy=await agreement('legacy-invalid');
    const legacyInvalid=[];
    for(const patch of [{price_rsd:-1},{scope_note:{}},{currency:'EUR'},{proposed_start_at:'now',proposed_end_at:'tomorrow'}])
      legacyInvalid.push(uuid(await ok(propose(requester,command(legacy,patch)))));
    const cycle=await agreement('old-cycle');
    const p1=uuid(await ok(propose(worker,command(cycle,{price_rsd:4000})))),p2=uuid(await ok(propose(requester,command(cycle,{price_rsd:5000}))));
    report.observed_predecessor_bodies=functions().filter(x=>['public.rpc_propose_agreement_change_v2(uuid, integer, jsonb, text, text)',
      'public.rpc_respond_agreement_change(uuid, boolean)'].includes(x.signature)).map(x=>({signature:x.signature,body_md5:x.body_md5}));
    assert.deepEqual(report.observed_predecessor_bodies.map(x=>x.body_md5).sort(),['1e7189bfb0f3baca51f24aca820d62c2','0bbfc5fd26c97bc5fe953561c2330c49'].sort());pass();

    check('ORIGINAL_SIBLING_ACCEPTANCE_DEADLOCK_ROLLS_BACK');
    const unchanged=scopedSnapshot();
    const a=session('m05-old-first',`select id from public.agreements where id=${q(cycle)}::uuid for update;select 'PARENT_HELD';`);
    await until(()=>a.output().includes('PARENT_HELD'),'M05_PARENT_NOT_HELD');const firstPid=pid('m05-old-first');
    const b=session('m05-old-second',actor(workerId)+respondSql(p2,true),'50ms');
    const waiting=await awaitLock('m05-old-second',firstPid),secondPid=pid('m05-old-second');
    a.finish(actor(requesterId)+respondSql(p1,true)+'rollback;\n\\q');
    const failure=await b.done,success=await a.done;
    assert.notEqual(failure.code,0);assert.equal(success.code,0);
    report.lock_interleavings.push({case:'ORIGINAL_SIBLING_ACCEPTANCES',initial_wait:waiting,...observedDeadlock(failure.stderr,firstPid,secondPid)});
    assert.deepEqual(scopedSnapshot(),unchanged);report.original_deadlock_rolled_back=true;pass();

    check('EXACT109_FORWARD_PRESERVES_HISTORY_ROWS_AND_FUNCTION_METADATA');
    const beforeFunctions=functions(),beforeRows=scopedSnapshot();
    execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',path],{stdio:'pipe',timeout:30000});
    assert.deepEqual(history(),oldHistory);assert.deepEqual(scopedSnapshot(),beforeRows);
    const changed=functions();assert.equal(changed.length,beforeFunctions.length);
    const allowed=new Set(report.observed_predecessor_bodies.map(x=>x.signature));
    const changedBodies=[];
    for(const before of beforeFunctions){const after=changed.find(x=>x.oid===before.oid);assert.ok(after);
      const signature=before.signature;
      if(allowed.has(signature)){assert.deepEqual({...after,body_md5:before.body_md5},before);changedBodies.push({signature,body_md5:after.body_md5});}
      else assert.deepEqual(after,before);
    }
    assert.equal(changedBodies.length,2);report.current_bodies=changedBodies;
    const version='20260911035330',name='clean_m05_agreement_change_authority';
    sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(version)},${q(name)},array[${q(bytes.toString('utf8'))}])`);
    const registered=history();assert.equal(registered.length,109);assert.deepEqual(registered.slice(0,108),oldHistory);
    assert.equal(hash(registered.at(-1).statements[0]),hash(bytes));
    report.candidate_applied=true;report.fixture_rows_preserved_at_apply=true;
    report.original_function_metadata_preserved=true;report.only_two_named_bodies_changed=true;
    sql("notify pgrst,'reload schema'");pass();

    check('SEMANTIC_REQUEST_REPLAY_AND_STABLE_PRIOR_RESULT_VERSIONS');
    agreementId=await agreement('semantic-replay');
    const original=command(agreementId,{price_rsd:4321,scope_note:'PRIVATE_CANARY_SCOPE'});
    const first=uuid(await ok(propose(requester,original))),beforeReplay=scopedSnapshot();
    assert.equal(await ok(propose(requester,{...original,p_reason:'  PRIVATE_CANARY_REASON  ',p_patch:{...original.p_patch,currency:'RSD'}})),first);
    assert.deepEqual(scopedSnapshot(),beforeReplay);
    for(const delta of [{p_patch:{price_rsd:9999}},{p_reason:'Other reason'},{p_expected_version:2}])
      await denied(requester,'rpc_propose_agreement_change_v2',{...original,...delta},'CHANGE_REQUEST_ID_REUSED');
    const rejected=uuid(await ok(propose(requester,command(agreementId,{scope_note:'Rejected'}))));
    assert.equal((await ok(response(worker,rejected,false))).agreementVersion,1);
    assert.equal((await ok(response(worker,first,true))).agreementVersion,2);event('AGREEMENT_VERSION_CHANGED',first,requesterId,2);
    const second=uuid(await ok(propose(requester,command(agreementId,{price_rsd:5432},2))));
    assert.equal((await ok(response(worker,second,true))).agreementVersion,3);
    const stable=scopedSnapshot();assert.equal(await ok(propose(requester,original)),first);
    assert.equal((await ok(response(worker,first,true))).agreementVersion,2);
    assert.equal((await ok(response(worker,rejected,false))).agreementVersion,1);
    assert.deepEqual(scopedSnapshot(),stable);report.semantic_replay_bound=true;report.prior_result_versions_stable=true;pass();

    check('CANONICAL_TERMS_AND_LEGACY_PENDING_ACCEPTANCE_FAIL_CLOSED');
    const validation=await agreement('validation'),base=command(validation);
    for(const bad of [null,{},[],1])await denied(requester,'rpc_propose_agreement_change_v2',{...base,p_patch:bad},'CHANGE_PATCH_REQUIRED');
    for(const expected of [null,0])await denied(requester,'rpc_propose_agreement_change_v2',{...base,p_expected_version:expected},'VERSION_REQUIRED');
    for(const price of [null,-1,0,1.5,2147483648,'3000',true])await denied(requester,'rpc_propose_agreement_change_v2',{...base,p_patch:{price_rsd:price}},'INVALID_PRICE');
    for(const scope of [null,{},[]])await denied(requester,'rpc_propose_agreement_change_v2',{...base,p_patch:{scope_note:scope}},'CHANGE_SCOPE_INVALID');
    for(const currency of [null,1,'EUR','rsd'])await denied(requester,'rpc_propose_agreement_change_v2',{...base,p_patch:{currency}},'CHANGE_CURRENCY_INVALID');
    for(const patch of [{proposed_start_at:'infinity',proposed_end_at:'infinity'},{proposed_start_at:'now',proposed_end_at:'tomorrow'},
      {proposed_start_at:'2026-12-01T12:00:00',proposed_end_at:'2026-12-01T13:00:00'},
      {proposed_start_at:'2026-12-01T12:00:00Z',proposed_end_at:null},{proposed_start_at:123,proposed_end_at:456}])
      await denied(requester,'rpc_propose_agreement_change_v2',{...base,p_patch:patch},'AGREEMENT_CALENDAR_INTERVAL_INVALID');
    await denied(requester,'rpc_propose_agreement_change_v2',{...base,p_patch:{covered_slots:2}},'UNSUPPORTED_CHANGE_FIELD');
    for(const p of legacyInvalid){await denied(worker,'rpc_respond_agreement_change',{p_proposal_id:p,p_accept:true});await ok(response(worker,p,false));}
    const extremes=uuid(await ok(propose(requester,command(validation,{price_rsd:2147483647,scope_note:'s'.repeat(5001),currency:'RSD'}))));
    assert.equal((await ok(response(worker,extremes,true))).agreementVersion,2);
    const instant=command(validation,{proposed_start_at:'2099-01-01T12:00:00.000001Z',proposed_end_at:'2099-01-01T12:00:00.000002Z'},2);
    const sameInstant=uuid(await ok(propose(requester,instant))),unchangedInstant=scopedSnapshot();
    assert.equal(await ok(propose(requester,{...instant,p_patch:{proposed_start_at:'2099-01-01T13:00:00.000001+01:00',proposed_end_at:'2099-01-01T13:00:00.000002+01:00'}})),sameInstant);
    assert.deepEqual(scopedSnapshot(),unchangedInstant);report.canonical_terms_guarded=true;report.legacy_rows_not_rewritten=true;pass();

    check('REAL_AUTH_COUNTERPART_EVENT_ROLLBACK_AND_PRIVATE_PAYLOAD');
    const authAgreement=await agreement('auth-event'),authCommand=command(authAgreement),beforeFault=scopedSnapshot();
    // RU0 denies anon EXECUTE before the function's internal Auth guard.
    await denied(anon,'rpc_propose_agreement_change_v2',authCommand,undefined,'42501');
    await denied(outsider,'rpc_propose_agreement_change_v2',authCommand,'NOT_PARTY');
    await denied(requester,'rpc_propose_agreement_change_v2',{...authCommand,p_expected_version:999},'VERSION_CONFLICT');
    installFault();await denied(requester,'rpc_propose_agreement_change_v2',authCommand);removeFault();assert.deepEqual(scopedSnapshot(),beforeFault);
    const authProposal=uuid(await ok(propose(requester,authCommand)));agreementId=authAgreement;event('AGREEMENT_CHANGE_PROPOSED',authProposal,workerId,1);
    for(const client of [requester,outsider,anon])await denied(client,'rpc_respond_agreement_change',{p_proposal_id:authProposal,p_accept:true});
    await denied(worker,'rpc_respond_agreement_change',{p_proposal_id:authProposal,p_accept:null},'DECISION_REQUIRED');
    installFault();await denied(worker,'rpc_respond_agreement_change',{p_proposal_id:authProposal,p_accept:true});removeFault();
    assert.equal(currentVersion(authAgreement),1);await ok(response(worker,authProposal,true));event('AGREEMENT_VERSION_CHANGED',authProposal,requesterId,2);
    assert.deepEqual(await ok(outsider.from('agreement_change_proposals').select('id').eq('agreement_id',authAgreement)),[]);
    report.real_auth_and_event_privacy_preserved=true;pass();

    check('SIBLING_ACCEPTANCES_LOCK_AGREEMENT_BEFORE_ANY_PROPOSAL');
    const fresh=await agreement('fixed-cycle');
    const f1=uuid(await ok(propose(worker,command(fresh,{price_rsd:4000})))),f2=uuid(await ok(propose(requester,command(fresh,{price_rsd:5000}))));
    const firstSession=session('m05-new-first',`select id from public.agreements where id=${q(fresh)}::uuid for update;select 'PARENT_HELD';`);
    await until(()=>firstSession.output().includes('PARENT_HELD'),'M05_PARENT_NOT_HELD');
    const secondSession=session('m05-new-second',actor(workerId)+respondSql(f2,true),'50ms');
    const parentWait=await awaitLock('m05-new-second',pid('m05-new-first'));
    // The blocked responder must not already own f2. This NOWAIT would fail
    // under the old proposal-first body, before the parent holder can proceed.
    sql(`begin;select id from public.agreement_change_proposals where id=${q(f2)}::uuid for update nowait;rollback;`);
    firstSession.finish(actor(requesterId)+respondSql(f1,true)+'commit;\n\\q');
    const win=await firstSession.done,lose=await secondSession.done;
    assert.equal(win.code,0);assert.notEqual(lose.code,0);assert.ok(lose.stderr.includes('PROPOSAL_NOT_PENDING'));assert.ok(!lose.stderr.includes('40P01'));
    assert.equal(currentVersion(fresh),2);assert.equal(sql(`select status from public.agreement_change_proposals where id=${q(f2)}::uuid`),'SUPERSEDED');
    report.lock_interleavings.push({case:'SIBLING_ACCEPTANCES',parent_wait:parentWait,waiting_responder_holds_no_proposal:true,winner_version:2,loser:'PROPOSAL_NOT_PENDING'});pass();

    check('SAME_PROPOSAL_CONCURRENT_ACCEPTANCE_HAS_ONE_VERSION_AND_EVENT');
    const dup=await agreement('duplicate-accept'),dp=uuid(await ok(propose(requester,command(dup))));
    const holder=session('m05-duplicate-holder',`select id from public.agreements where id=${q(dup)}::uuid for update;select 'PARENT_HELD';`);
    await until(()=>holder.output().includes('PARENT_HELD'),'M05_PARENT_NOT_HELD');
    assert.ok(holder.output().includes(dup));
    assert.equal(sql(`select agreement_id from public.agreement_change_proposals where id=${q(dp)}::uuid`),dup);
    const holderPid=pid('m05-duplicate-holder');
    const running=Promise.all([response(worker,dp,true),response(worker,dp,true)]);let waits=[];
    await until(()=>{
      const observed=observedResponderWaitGraph(rows(`select pid as waiter_pid,${holderPid} as holder_pid,wait_event_type,
        pg_blocking_pids(pid) as blocking_pids from pg_stat_activity where state='active' and wait_event_type='Lock'
        and query like '%rpc_respond_agreement_change%'`),holderPid);
      if(!observed)return false;waits=observed;return true;
    },'M05_TWO_AUTH_WAITERS_NOT_OBSERVED');
    holder.finish('rollback;\n\\q');assert.equal((await holder.done).code,0);
    const pair=await running;for(const r of pair){assert.equal(r.error,null);assert.equal(r.data.agreementVersion,2);}
    assert.equal(sql(`select count(*) from public.agreement_versions where agreement_id=${q(dup)}::uuid`),'2');
    agreementId=dup;event('AGREEMENT_VERSION_CHANGED',dp,requesterId,2);
    report.lock_interleavings.push({case:'SAME_PROPOSAL_ACCEPTANCES',target_agreement_id:dup,target_proposal_id:dp,
      observed_waiters:waits,version_count:2,event_count:1});pass();

    check('CANCELLED_AND_COMPLETED_DENY_NEW_WORK_BUT_REPLAY_PRIOR_RESULTS');
    for(const terminal of ['CANCELLED','COMPLETED']){
      const id=await agreement(terminal),original=command(id),accepted=uuid(await ok(propose(requester,original)));
      await ok(response(worker,accepted,true));
      const pending=uuid(await ok(propose(requester,command(id,{price_rsd:5000},2))));
      if(terminal==='CANCELLED')await cancel(id);else await ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:id}));
      assert.equal(state(id).status,terminal);const before=scopedSnapshot();
      assert.equal(await ok(propose(requester,original)),accepted);
      assert.equal((await ok(response(worker,accepted,true))).agreementVersion,2);
      assert.deepEqual(scopedSnapshot(),before);
      await denied(requester,'rpc_propose_agreement_change_v2',command(id,{price_rsd:6000},2),'AGREEMENT_NOT_ACTIVE');
      for(const accept of [true,false])await denied(worker,'rpc_respond_agreement_change',{p_proposal_id:pending,p_accept:accept},'AGREEMENT_NOT_ACTIVE');
      assert.equal(state(id).status,terminal);
    }
    report.terminal_replay_read_only=true;pass();

    check('FINAL_REGISTERED109_ORIGINAL_HISTORY_AND_CALENDAR_EVENT_AUTHORITY');
    for(const id of fixtureIds)if(state(id).status==='CONFIRMED')await cancel(id);
    const finalHistory=history();assert.equal(finalHistory.length,109);assert.deepEqual(finalHistory.slice(0,108),oldHistory);
    assert.equal(hash(finalHistory.at(-1).statements[0]),report.candidate_sha256);
    assert.equal(sql(`select count(*) from private.worker_calendar_events where agreement_id in (${fixtureIds.map(q).join(',')}) and state='BLOCKING'`),'0');
    assert.equal(sql('select count(*) from private.connection_activations where platform_cost_rsd<>0'),'0');
    assert.equal(sql('select count(*) from public.notification_push_attempts'),'0');
    assert.deepEqual(functions(),changed);report.migration_history_count=109;report.original_history_preserved=true;
    report.fixture_blocking_calendar_events=0;report.platform_fee_rsd=0;pass();report.result='PASS';
    console.log('PASS M05_AGREEMENT_CHANGE_AUTHORITY');
  }finally{for(const child of children){child.stdin.end('rollback;\n\\q\n');child.kill();}}
}
