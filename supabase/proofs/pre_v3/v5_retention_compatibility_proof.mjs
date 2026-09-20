// Actual loopback-only139→140. One-second retention and all legal/policy rows
// below are SYNTHETIC DISPOSABLE FIXTURES, never proposed production durations.
import {spawn} from 'node:child_process';
import {assert,randomUUID,env,sql,rows,q,ok,denied,anon,service,actor,prove,apply,pass,lockedRace} from './closure_runtime.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const serviceClaims="select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);select set_config('request.jwt.claim.role','service_role',true);";
const actorClaims=a=>`select set_config('request.jwt.claims',${q(JSON.stringify({sub:a.id,role:'authenticated'}))},true);select set_config('request.jwt.claim.sub',${q(a.id)},true);select set_config('request.jwt.claim.role','authenticated',true);`;
const claim=a=>ok(service.rpc('rpc_claim_retention_job',{p_account_id:a.id}));
const execute=j=>ok(service.rpc('rpc_execute_retention_job',{p_job_id:j.jobId,p_attempt_id:j.attemptId}));
const candidate=id=>sql(`select private.retention_ai_candidate(${q(id)}::uuid) is not null`)==='t';
const exists=id=>sql(`select exists(select 1 from public.ai_conversations where id=${q(id)}::uuid)`)==='t';
const source=()=>sql('select private.retention_ai_source_ready()');
const prep=a=>ok(a.client.rpc('rpc_prepare_account_closure',{p_expected_user_id:a.id,p_expected_revision:0,p_client_request_id:randomUUID()}));
const review=a=>ok(a.client.rpc('rpc_review_account_closure_execution',{p_expected_user_id:a.id}));
const startArgs=(a,r)=>({p_expected_user_id:a.id,p_request_id:r.requestId,p_expected_revision:r.revision,p_client_request_id:randomUUID(),p_policy_sha256:r.policySha256});
function conversation(a,state='ABANDONED',safety='ALLOW'){
 const id=randomUUID();sql(`insert into public.ai_conversations(id,account_id,purpose,status,fact_schema_version) values(${q(id)},${q(a.id)},'NEED_INTAKE','OPEN','NEED_FACT_V2');
 insert into public.ai_messages(account_id,conversation_id,role,body,safety) values(${q(a.id)},${q(id)},'USER','Disposable volatile message',${q(safety)});
 update public.ai_conversations set status=${q(state)} where id=${q(id)}`);return id;
}
function assertClaim(j,id){assert.equal(j.kind,'CLAIMED');assert.equal(sql(`select conversation_id from private.retention_jobs where id=${q(j.jobId)}`),id);}
// A held real transaction for the deliberately nonblocking reverse interleaving.
// Unlike lockedRace, completion must occur before this holder releases its lock.
async function whileHeld(statement,fn){
 const child=spawn('psql',[env.RU5_DEVICE_DB_URL,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 let output='',stderr='',timer;child.stderr.on('data',b=>{stderr=(stderr+b).slice(-1200);});
 const ended=new Promise(resolve=>child.once('exit',resolve));
 const ready=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('RETENTION_HOLDER_TIMEOUT')),8000);
  child.stdout.on('data',b=>{output+=b;if(output.includes('HOLDER_READY:')){clearTimeout(timer);resolve(Number(/HOLDER_READY:(\d+)/.exec(output)[1]));}});
  child.once('error',reject);child.once('exit',code=>{if(!output.includes('HOLDER_READY:'))reject(new Error('RETENTION_HOLDER_EXIT:'+code+':'+stderr));});});
 child.stdin.write(`begin;${statement};select 'HOLDER_READY:'||pg_backend_pid();\n`);
 try{const pid=await ready;let deadline;try{return await Promise.race([fn(pid),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('RETENTION_SKIP_BLOCKED')),6000);})]);}finally{clearTimeout(deadline);}}
 finally{clearTimeout(timer);if(!child.stdin.destroyed)child.stdin.end('commit;\n');await ended;}
}
// Pause only the existing disposable scheduler, and observe that already-started
// runs have drained before admitting the synthetic retention policy.
async function pauseCron(report){
 const initial=rows("select to_jsonb(j) definition from cron.job j where jobname='uskoci_marketplace_tick'");assert.equal(initial.length,1);
 const old=initial[0].definition;assert.equal(old.command,'select private.marketplace_tick(25);');assert.equal(old.schedule,'* * * * *');assert.equal(old.database,'postgres');assert.equal(old.username,'postgres');
 const current=()=>rows(`select to_jsonb(j) definition from cron.job j where jobid=${old.jobid}`)[0]?.definition;
 report.localScheduler={paused:false,drained:false,restored:false};
 const restore=()=>{assert.deepEqual(current(),{...old,active:false});sql(`select cron.alter_job(job_id:=${old.jobid},active:=${old.active})`);assert.deepEqual(current(),old);report.localScheduler.restored=true;};
 try{
  sql(`select cron.alter_job(job_id:=${old.jobid},active:=false)`);report.localScheduler.paused=true;
  const until=Date.now()+15000;let quiet=null;
  while(Date.now()<until){assert.deepEqual(current(),{...old,active:false});
   const active=rows(`select runid from cron.job_run_details where jobid=${old.jobid} and end_time is null and status not in('succeeded','failed')`);
   const backends=rows(`select pid from pg_stat_activity where pid<>pg_backend_pid() and state is distinct from 'idle' and datname='postgres' and usename='postgres'
    and (query=${q(old.command)} or pid in(select job_pid from cron.job_run_details where jobid=${old.jobid} and end_time is null and status not in('succeeded','failed')))`);
   if(!active.length&&!backends.length){quiet??=Date.now();if(Date.now()-quiet>=1500){report.localScheduler.drained=true;return restore;}}else quiet=null;
   await pause(100);
  }throw new Error('RETENTION_CRON_DRAIN_TIMEOUT');
 }catch(error){if(report.localScheduler.paused)restore();throw error;}
}
await prove('V5_RETENTION_SOURCE_COMPATIBILITY','v5-retention-compatibility-report.json',async report=>{
 report.policyFixture='SYNTHETIC_DISPOSABLE_ONLY_NOT_LEGAL_CONTENT';report.allDataClassesExecutable=false;report.storageCalled=false;
 const restoreCron=await pauseCron(report);
 const beforePolicy=sql("select md5(coalesce(jsonb_agg(to_jsonb(p) order by id),'[]')::text) from private.retention_policy_sets p");
 const inventory=sql('select sha256 from private.closure_source_v5 where singleton');
 const oldActive=rows('select id from private.retention_policy_sets where retired_at is null');
 const oldLegal=rows('select id from private.legal_document_versions where is_active');
 let pid=null,privacy=null,terms=null;
 try{
  assert.equal(source(),'f');assert.equal(sql('select private.closure_source_digest_v5()'),inventory);
  await apply(report,'20260913014627_clean_v5_retention_source_compatibility.sql',139);
  assert.equal(source(),'t');assert.equal(sql('select private.closure_source_digest_v5()'),inventory);
  assert.equal(sql('select sha256 from private.closure_source_v5 where singleton'),inventory);
  assert.equal(sql("select md5(coalesce(jsonb_agg(to_jsonb(p) order by id),'[]')::text) from private.retention_policy_sets p"),beforePolicy);
  assert.equal(sql('select private.retention_execution_binding() is null'),'t');
  assert.deepEqual(await claim({id:randomUUID()}),{kind:'NOT_READY',code:'POLICY_NOT_READY'});
  for(const f of ['private.retention_ai_source_ready()','private.retention_ai_candidate(uuid)','private.claim_retention_job(uuid)','private.execute_retention_job(uuid,uuid)']){
   for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(f)},'EXECUTE')`),'f');}
  for(const f of ['public.rpc_claim_retention_job(uuid)','public.rpc_execute_retention_job(uuid,uuid)']){
   for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(f)},'EXECUTE')`),'f');assert.equal(sql(`select has_function_privilege('service_role',${q(f)},'EXECUTE')`),'t');}
  await denied(anon.rpc('rpc_get_retention_execution_status'));
  report.source139Sha256=inventory;pass(report,'EXACT_139_TO_140_PRIOR_SOURCE_REJECTED_NOW_READY_POLICY_UNCHANGED_CLOSED_PRIVATE_ACL');

  const a=await actor('retention140-main'),b=await actor('retention140-other'),c=await actor('retention140-closure'),d=await actor('retention140-reverse');
  const classes=rows('select code from private.retention_data_classes where active and required order by code');assert.equal(classes.length,15);
  privacy=randomUUID();terms=randomUUID();
  sql(`update private.legal_document_versions set is_active=false where is_active;
   insert into private.legal_document_versions(id,document_kind,version_label,content_sha256,public_url,published_at,effective_at,is_active) values
   (${q(privacy)},'PRIVACY',${q('SYNTHETIC140_'+privacy)},${q('b'.repeat(64))},'https://proof.invalid/privacy140',clock_timestamp()-interval '1 minute',clock_timestamp()-interval '1 minute',true),
   (${q(terms)},'TERMS',${q('SYNTHETIC140_'+terms)},${q('c'.repeat(64))},'https://proof.invalid/terms140',clock_timestamp()-interval '1 minute',clock_timestamp()-interval '1 minute',true);
   update private.retention_policy_sets set retired_at=greatest(clock_timestamp(),effective_at+interval '1 second') where retired_at is null`);
  const published=await ok(service.rpc('rpc_publish_retention_policy',{p_policy_version:'SYNTHETIC140_'+randomUUID(),p_counsel_reference:'DISPOSABLE_TEST_ONLY_NOT_LEGAL_CONTENT',p_effective_at:new Date(Date.now()-1000).toISOString(),p_rules:classes.map(x=>({dataClass:x.code,purpose:'Synthetic disposable purpose',retentionPeriod:'Synthetic test period',deletionTrigger:'Synthetic test trigger',exceptionRule:'Synthetic hold blocks',legalBasis:'Synthetic not actual legal content'}))}));
  pid=published.policyId;assert.equal(published.executionAdmitted,false);
  const binding={schemaVersion:1,adapterVersion:'P3_AI_ABANDONED_UNBOUND_V1',dataClass:'AI_VOLATILE',dataset:'AI_ABANDONED_UNBOUND',action:'DELETE',trigger:'OBSERVED_ABANDONMENT',retentionSeconds:1,privacyDocumentId:privacy,privacyContentSha256:'b'.repeat(64)};
  sql(`update private.retention_policy_sets set retention_execution=${q(JSON.stringify(binding))}::jsonb where id=${q(pid)};
   update private.retention_policy_sets set retention_execution=retention_execution||jsonb_build_object('contentSha256',encode(extensions.digest(convert_to(retention_execution::text,'UTF8'),'sha256'),'hex')) where id=${q(pid)};
   with binding as(select jsonb_build_object('schemaVersion',1,'adapterVersion','V5_RETAINED_SUBJECT_CLOSURE_V1','sourceSha256',${q(inventory)},'privacyDocumentId',${q(privacy)},'privacyContentSha256',${q('b'.repeat(64))},'authAction','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED','mediaAction','DELETE_OWNED_OBJECTS',
    'datasets',(select jsonb_agg(jsonb_build_object('dataClass',data_class,'action','RETAIN_RESTRICTED','retentionSeconds',86400,'trigger','CLOSURE_REQUESTED','ruleSha256',encode(extensions.digest(convert_to(to_jsonb(r)::text,'UTF8'),'sha256'),'hex')) order by data_class) from private.retention_policy_rules r where policy_id=${q(pid)})) value)
   update private.retention_policy_sets set account_closure_execution=binding.value||jsonb_build_object('contentSha256',encode(extensions.digest(convert_to(binding.value::text,'UTF8'),'sha256'),'hex')) from binding where id=${q(pid)}`);
  assert.equal((await ok(a.client.rpc('rpc_get_retention_execution_status'))).executionAdmitted,true);
  assert.equal(sql('select private.closure_binding_v5() is not null'),'t');
  const target=conversation(a),foreign=conversation(b);await pause(1200);
  const j=await claim(a);assertClaim(j,target);assert.ok(exists(foreign));
  const success=await execute(j);assert.equal(success.status,'SUCCEEDED');assert.equal(success.deletedMessages,1);assert.equal(exists(target),false);
  assert.deepEqual(await execute(j),{...success,idempotentReplay:true});assert.ok(exists(foreign));
  pass(report,'SYNTHETIC_POLICY_EXACT_BINDING_ONE_OWN_VOLATILE_DELETE_IMMUTABLE_REPLAY_FOREIGN_UNCHANGED');

  // Roll back each independent topology/body mutation. Even a changed sidecar
  // column is rejected by the exact139 inventory pin; no reseeding its registry.
  const drift=[
   ['EXTRA_TRIGGER',"create function private.proof140_extra() returns trigger language plpgsql as $$ begin return new;end $$;create trigger proof140_extra before insert on public.ai_messages for each row execute function private.proof140_extra()"],
   ['DISABLED_TRIGGER','alter table public.ai_messages disable trigger pre_v3_closure_ai_message'],
   ['ALTERED_TRIGGER_ARGUMENTS',"drop trigger pre_v3_closure_ai_message on public.ai_messages;create trigger pre_v3_closure_ai_message before insert on public.ai_messages for each row execute function private.closure_guard_owned_write('ACCOUNT','account_id')"],
   ['ALTERED_TRIGGER_EVENTS',"drop trigger pre_v3_closure_ai_message on public.ai_messages;create trigger pre_v3_closure_ai_message before insert or update on public.ai_messages for each row execute function private.closure_guard_owned_write('CONVERSATION','conversation_id')"],
   ['CHILD_COLUMN','alter table public.ai_messages add column proof140_extra text'],
   ['SEMANTIC_SIDECAR_COLUMN','alter table private.ai_need_turn_commands add column proof140_extra text'],
   ['CALLEE_STRICT_METADATA','alter function private.closure_assert_open(uuid,uuid) strict'],
   ['CALLEE_SEARCH_PATH','alter function private.closure_assert_open(uuid,uuid) reset all'],
   ['TRIGGER_BODY',"do $x$ begin execute replace(pg_get_functiondef('private.closure_guard_owned_write()'::regprocedure),'declare','-- PROOF140 SOURCE DRIFT'||chr(10)||'declare');end $x$"],
   ['CALLEE_BODY',"do $x$ begin execute replace(pg_get_functiondef('private.closure_account_key(uuid)'::regprocedure),'10121','10122');end $x$"]
  ];
  for(const [name,mutation] of drift){
   sql(`begin;${mutation};do $check$ declare result jsonb;begin
    if private.retention_ai_source_ready() is distinct from false then raise exception 'PROOF140_DRIFT_NOT_REJECTED';end if;
    result:=private.claim_retention_job(${q(b.id)});if result is distinct from '{"kind":"NOT_READY","code":"SOURCE_NOT_READY"}'::jsonb then raise exception 'PROOF140_DRIFT_CLAIMED';end if;end $check$;rollback;`);
   assert.equal(source(),'t');(report.rejectedSourceDrift??=[]).push(name);
  }
  pass(report,'EXTRA_DISABLED_ALTERED_ARGUMENT_EVENT_COLUMN_SIDECAR_BODY_STRICT_AND_PATH_DRIFT_FAIL_CLOSED');

  // Existing hold still fences final deletion under the same retention lock.
  const held=conversation(a);await pause(1200);const hj=await claim(a);assertClaim(hj,held);
  const holdKey='SYNTHETIC140_'+randomUUID();await ok(service.rpc('rpc_set_retention_hold',{p_account_id:a.id,p_conversation_id:held,p_hold_key:holdKey,p_active:true,p_expected_revision:0}));
  assert.equal((await execute(hj)).code,'HELD');assert.ok(exists(held));
  await ok(service.rpc('rpc_set_retention_hold',{p_account_id:a.id,p_conversation_id:held,p_hold_key:holdKey,p_active:false,p_expected_revision:1}));

  const side=await actor('retention140-sidecars');
  const creators=[
   ['ai_need_open_commands',id=>`insert into private.ai_need_open_commands(account_id,client_request_id,conversation_id) values(${q(side.id)},${q(randomUUID())},${q(id)})`],
   ['ai_need_turn_commands',id=>`insert into private.ai_need_turn_commands(account_id,client_request_id,conversation_id,request_hash,state) values(${q(side.id)},${q(randomUUID())},${q(id)},repeat('a',64),'FAILED')`],
   ['ai_task_reviews',id=>`insert into private.ai_task_reviews(account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at) values(${q(side.id)},${q(id)},${q(randomUUID())},repeat('a',64),'{}','{"privateReview":"synthetic retained"}',clock_timestamp()+interval '1 minute')`],
   ['worker_ai_sessions',id=>`insert into private.worker_ai_sessions(conversation_id,account_id,open_request_id,profile_id,base_hash,candidate) values(${q(id)},${q(side.id)},${q(randomUUID())},${q(randomUUID())},repeat('a',64),'{}')`],
   ['worker_ai_reviews',id=>`insert into private.worker_ai_reviews(account_id,conversation_id,revision,base_hash,envelope,expires_at) values(${q(side.id)},${q(id)},0,repeat('a',64),'{}',clock_timestamp()+interval '1 minute')`],
   ['owned_media_assets',id=>`insert into private.owned_media_assets(account_id,scope,conversation_id,client_request_id,input_sha256,input_bytes,input_type) values(${q(side.id)},'TASK',${q(id)},${q(randomUUID())},repeat('a',64),1,'image/jpeg')`]
  ];
  for(const [name,insert] of creators){const id=conversation(side);sql(insert(id));assert.equal(candidate(id),false);(report.excludedSemanticSidecars??=[]).push(name);}
  // Turn FK requires a session, and both are retained. Reviews' command/saves
  // FKs cannot exist without their excluded review parent.
  const session=rows(`select conversation_id from private.worker_ai_sessions where account_id=${q(side.id)} order by conversation_id limit 1`)[0].conversation_id;
  sql(`insert into private.worker_ai_turns(account_id,conversation_id,client_request_id,body_hash,source_revision,state,lease_expires_at) values(${q(side.id)},${q(session)},${q(randomUUID())},repeat('a',64),0,'PROCESSING',clock_timestamp()+interval '1 minute')`);
  assert.equal(candidate(session),false);report.excludedSemanticSidecars.push('worker_ai_turns');
  const unsafe=conversation(side,'ABANDONED','REVIEW'),open=conversation(side,'OPEN');assert.equal(candidate(unsafe),false);assert.equal(candidate(open),false);
  const pending=conversation(side,'OPEN'),pendingKey=randomUUID();
  const turn=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{p_account_id:side.id,p_conversation_id:pending,p_client_request_id:pendingKey,p_user_message:'Unresolved provider fixture'}));assert.ok(turn.claim);
  assert.equal(await ok(service.rpc('rpc_ai_dispatch_need_turn_v2_service',{p_account_id:side.id,p_conversation_id:pending,p_client_request_id:pendingKey,p_attempt_id:turn.claim.attemptId})),true);
  // Explicit SQL abandonment fixture tests protection of unknown external work;
  // it does not claim a provider call, successful turn, or native abandonment.
  sql(`update public.ai_conversations set status='ABANDONED' where id=${q(pending)}`);assert.equal(candidate(pending),false);
  assert.equal(sql(`select state='PROCESSING' and provider_dispatched from private.ai_need_turn_commands where account_id=${q(side.id)} and client_request_id=${q(pendingKey)}`),'t');
  await pause(1200);assert.deepEqual(await claim(side),{kind:'NONE'});
  pass(report,'HOLDS_AND_EVERY_NEW_SEMANTIC_SIDECAR_UNRESOLVED_WORKER_TURN_REVIEW_MEDIA_AND_SAFETY_EXCLUDED');

  const race=await actor('retention140-late-sidecar'),rid=conversation(race);await pause(1200);const rj=await claim(race);assertClaim(rj,rid);
  const key=randomUUID(),claimSql=`select public.rpc_ai_claim_need_turn_v2_service(${q(race.id)},${q(rid)},${q(key)},'Late abandoned turn')`;
  const changed=await lockedRace(serviceClaims+claimSql,()=>execute(rj));assert.equal(changed.code,'SOURCE_CHANGED');assert.ok(exists(rid));
  assert.equal(sql(`select state from private.ai_need_turn_commands where account_id=${q(race.id)} and client_request_id=${q(key)}`),'FAILED');
  assert.equal(sql(`select provider_dispatched from private.ai_need_turn_commands where account_id=${q(race.id)} and client_request_id=${q(key)}`),'f');
  const race2=await actor('retention140-delete-first'),rid2=conversation(race2);await pause(1200);const rj2=await claim(race2);assertClaim(rj2,rid2);
  const late=await lockedRace(`select private.execute_retention_job(${q(rj2.jobId)},${q(rj2.attemptId)})`,()=>service.rpc('rpc_ai_claim_need_turn_v2_service',{p_account_id:race2.id,p_conversation_id:rid2,p_client_request_id:randomUUID(),p_user_message:'Late after deletion'}));
  assert.equal(late.error?.message,'CONVERSATION_NOT_FOUND');assert.equal(exists(rid2),false);
  assert.equal(sql(`select count(*) from private.ai_need_turn_commands where conversation_id=${q(rid2)}`),'0');
  pass(report,'OBSERVED_REAL132_LATE_COMMAND_BEFORE_EXECUTE_RECHECK_BLOCKS_DELETE_DELETE_FIRST_DENIES_LATE_ATTACH');

  // Claim wins first: actual closure start must wait for the shared fence, then
  // see the committed CLAIMED job and refuse destructive admission.
  await prep(c);const cr=await review(c);assert.equal(cr.ready,true);const cid=conversation(c);await pause(1200);
  const closureBlocked=await lockedRace(`select private.claim_retention_job(${q(c.id)})`,()=>c.client.rpc('rpc_start_account_closure_execution',startArgs(c,cr)));
  assert.equal(closureBlocked.error?.message,'CLOSURE_BLOCKED');
  assert.equal(sql(`select status from private.retention_jobs where conversation_id=${q(cid)}`),'CLAIMED');
  assert.equal(sql(`select count(*) from private.closure_executions_v5 where account_id=${q(c.id)}`),'0');
  const cj=rows(`select id as "jobId",attempt_id as "attemptId" from private.retention_jobs where conversation_id=${q(cid)}`)[0];assert.equal((await execute(cj)).status,'SUCCEEDED');
  // Closure wins first under its actual SQL writer. Claim completes while the
  // exclusive closure lock is held, skips the account, and takes no retention
  // lock for it. A different account continues to make progress.
  await prep(d);const dr=await review(d);assert.equal(dr.ready,true);const did=conversation(d);await pause(1200);const da=startArgs(d,dr);
  await whileHeld(actorClaims(d)+`select public.rpc_start_account_closure_execution(${q(d.id)},${q(da.p_request_id)},${da.p_expected_revision},${q(da.p_client_request_id)},${q(da.p_policy_sha256)})`,async()=>{
   assert.deepEqual(await claim(d),{kind:'NONE'});const bj=await claim(b);assertClaim(bj,foreign);assert.equal((await execute(bj)).status,'SUCCEEDED');
  });
  assert.deepEqual(await claim(d),{kind:'NONE'});assert.ok(exists(did));assert.equal(sql(`select count(*) from private.retention_jobs where account_id=${q(d.id)}`),'0');
  const cstart=await ok(c.client.rpc('rpc_start_account_closure_execution',startArgs(c,await review(c))));assert.equal(cstart.state,'EXECUTING');
  assert.equal((await execute(cj)).idempotentReplay,true);
  pass(report,'OBSERVED_CLAIM_THEN_REAL_CLOSURE_WAIT_BLOCKED_REVERSE_REAL_CLOSURE_SKIP_NO_DEADLOCK_OTHER_ACCOUNT_PROGRESS_REPLAY');
 }finally{
  if(pid)sql(`update private.retention_policy_sets set retention_execution=null,account_closure_execution=null,retired_at=greatest(clock_timestamp(),effective_at+interval '1 second') where id=${q(pid)}`);
  if(privacy||terms)sql(`update private.legal_document_versions set is_active=false where id=any(array[${[privacy,terms].filter(Boolean).map(q).join(',')}]::uuid[])`);
  if(oldActive.length)sql(`update private.retention_policy_sets set retired_at=null where id=any(array[${oldActive.map(x=>q(x.id)).join(',')}]::uuid[])`);
  if(oldLegal.length)sql(`update private.legal_document_versions set is_active=true where id=any(array[${oldLegal.map(x=>q(x.id)).join(',')}]::uuid[])`);
  restoreCron();
 }
 assert.equal(source(),'t');assert.equal(sql('select private.retention_execution_binding() is null'),'t');assert.equal(sql('select private.closure_source_digest_v5()'),inventory);
 pass(report,'SYNTHETIC_POLICY_DEACTIVATED_PRIOR_POINTERS_SCHEDULER_RESTORED_139_DIGEST_EXACT');
});
