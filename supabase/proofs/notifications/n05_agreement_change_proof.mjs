import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const uuid=(v)=>{assert.match(String(v),/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);return v;};
const workerId=uuid(env.RU5_DEVICE_WORKER_USER_ID),requesterId=uuid(env.RU5_DEVICE_REQUESTER_USER_ID),needId=uuid(env.RU5_DEVICE_NEED_ID);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const outsider=createClient(url,env.RU5_DEVICE_ANON_KEY,options),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const out=env.N05_ARTIFACT_DIR||'artifacts/notifications-n05';mkdirSync(out,{recursive:true});
const path=fileURLToPath(new URL('./n05_agreement_change_candidate.sql',import.meta.url));
const report={unit:'N05_AGREEMENT_CHANGE_EVENTS',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
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
  assert.ok((await requester.from('user_activity_events').update({payload:{}}).eq('id',observed[0].id)).error);
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
} catch(error) {report.result='FAIL';report.failed_check=current;console.error('FAIL N05',current,error.message);process.exitCode=1;
} finally {if(fault)removeFault();writeFileSync(`${out}/proof-report.json`,JSON.stringify(report,null,2)+'\n');}
