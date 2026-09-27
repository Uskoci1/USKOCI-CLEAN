// Exact B3c application candidate: disposable-only atomic install + full closure.
// No DEV endpoint, application approval, provider, Storage or device claim.
// Canonical closure fixtures/worker checks are copied unchanged from the proved
// disposable recertification harness. This run installs the FINAL candidate bytes.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {invalidationCatalogSnapshot} from './private_invalidation_catalog_snapshot.mjs';
const env=process.env;
const candidatePath='supabase/candidates/chat_b3c_private_invalidation_dev_application.sql';
const originalCandidatePath='supabase/candidates/chat_b3c_private_invalidation.sql';
const harnessPath='supabase/proofs/chat/private_invalidation_dev_application_proof.mjs';
const workflowPath='.github/workflows/chat-b3c-dev-application-proof.yml';
const snapshotPath='supabase/proofs/chat/private_invalidation_catalog_snapshot.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const hashJson=value=>hash(JSON.stringify(value));
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const report={
 unit:'CHAT_B3C_EXACT_APPLICATION_AND_ERASURE',result:'FAIL',sourceSha:null,
 actualAuth:false,actualDatabase:false,disposableOnly:true,liveAccess:false,
 providerCalled:false,providerCalls:0,storageCalls:0,deviceProven:false,
 incomingStreamProven:false,devCertificateMoved:false,disposableCertificateMoved:false,
 certifiedErasureProven:false,deploymentReady:false,teardownRequired:true,
 checks:[],refusals:[],laterDriftChecks:[],sourceArtifactHashes:{},closures:[],
 fixtureContract:'CANONICAL_MESSAGES_AND_CANCEL_THEN_EXPLICIT_SYNTHETIC_RESIDUAL_CACHE',
};
let stage='LOCAL_TARGET_ADMISSION',operation='ADMISSION',outputDirectory,rt,baseline,expectedFinal,foreign,foreignBaseline;
const actors=[];
const snapshot=()=>invalidationCatalogSnapshot(rt);
function pass(name) { report.checks.push({name, result: 'PASS'}); console.log('PASS CHAT_B3C_' + name); }
function fail(error) {
  const diagnostic = {stage, operation};
  if (error?.code === 'ERR_ASSERTION') diagnostic.kind = 'ASSERTION';
  else if (['ETIMEDOUT', 'ENOENT', 'ENOBUFS'].includes(error?.code)) diagnostic.kind = error.code;
  else diagnostic.kind = 'LOCAL_PROOF_FAILURE';
  const stderr = String(error?.stderr ?? '').slice(0, 4096);
  const state = stderr.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5})(?:\s|$)/)?.[1];
  const location = stderr.match(/(chat_b3c_private_invalidation_dev_application\.sql):(\d+):/);
  if (state) diagnostic.sqlState = state;
  if (location) diagnostic.sqlLine = Number(location[2]);
  const rpcFailure = String(error?.message ?? '').match(/^LOCAL_RPC:([A-Z0-9]{5}):([A-Z][A-Z0-9_]{0,95})$/);
  if (rpcFailure) { diagnostic.rpcSqlState = rpcFailure[1]; diagnostic.rpcCode = rpcFailure[2]; }
  if (!report.failure) report.failure = diagnostic;
  else (report.finalCheckFailures ??= []).push(diagnostic);
  process.exitCode = 1;
  console.error('FAIL CHAT_B3C_' + stage);
}
async function bounded(promise, milliseconds = 20000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('LOCAL_OPERATION_TIMEOUT')), milliseconds);
  })]); } finally { clearTimeout(timer); }
}
const rpc = async (client, name, args) => {
  assert.match(name, /^rpc_[a-z0-9_]+$/); operation = name.toUpperCase();
  return bounded(rt.ok(client.rpc(name, args)));
};

function psql(input) {
 return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
   '-v','ECHO=none','-v','VERBOSITY=sqlstate','-f','-'],{
   input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:90000,maxBuffer:524288,killSignal:'SIGKILL',
   env:{...env,PSQL_HISTORY:'/dev/null',PGAPPNAME:'uskoci-b3c-application-'+process.pid,
     PGOPTIONS:'-c statement_timeout=60000 -c lock_timeout=5000'}});
}
function application({tamper='',rollback=false}={}) {
 operation='EXACT_APPLICATION_SQL';
 const file=resolve(candidatePath).replaceAll('\\','/');
 assert.ok(!/[\r\n']/.test(file));
 return psql(`begin;\n${tamper}\n\\ir '${file}'\n${rollback?'rollback':'commit'};\nselect 'CHAT_B3C_APPLICATION_COMPLETED';\n`);
}
function refuses(name,tamper='',requiredWitness=null) {
 const before=hashJson(snapshot());let refused=false;
 try {application({tamper});} catch(error) {
   refused=error?.status!==0&&/ERROR:\s+(55000|P0001)(?:\s|$)/.test(String(error?.stderr??''));
   if(requiredWitness)refused=refused&&String(error?.stdout??'').split(/\r?\n/).includes(requiredWitness);
 }
 assert.equal(refused,true);assert.equal(hashJson(snapshot()),before);
 report.refusals.push({name,refused:true,completeCatalogUnchanged:true});
}
async function actor(label) {
  const value = await bounded(rt.actor(label));
  assert.match(value.id, uuidPattern); actors.push(value); return value;
}
async function agreement(requester, worker) {
  const profile = (person, kind) => {
    const found = rt.rows(`select id from public.app_profiles where account_id=${rt.q(person.id)} and kind=${rt.q(kind)}`);
    assert.equal(found.length, 1); assert.match(found[0].id, uuidPattern); return found[0].id;
  };
  const requesterProfile = profile(requester, 'REQUESTER'), workerProfile = profile(worker, 'WORKER');
  rt.sql(`update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${rt.q(workerProfile)}`);
  await rpc(worker.client, 'rpc_complete_worker_profile', {p_profile_id: workerProfile});
  const needId = randomUUID();
  rt.sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
    values(${rt.q(needId)},${rt.q(requester.id)},${rt.q(requesterProfile)},'PUBLISHED','B3c disposable erasure task',
      'Disposable fixture','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',
      statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
  const response = await rpc(worker.client, 'rpc_submit_response', {
    p_need_id: needId, p_need_revision: 1, p_worker_profile_id: workerProfile, p_covered_slots: 1,
    p_price_rsd: 3000, p_proposed_start_at: null, p_proposed_end_at: null,
    p_scope_note: null, p_client_request_id: randomUUID(),
  });
  const id = await rpc(requester.client, 'rpc_select_response', {
    p_need_id: needId, p_need_revision: response.needRevision, p_response_id: response.responseId,
    p_response_version: response.version, p_content_hash: response.contentHash, p_client_request_id: randomUUID(),
  });
  assert.match(id, uuidPattern);
  return {id, needId, requester, worker};
}
async function send(person, id, body) {
  const message = await rpc(person.client, 'rpc_send_agreement_message_v2', {
    p_expected_user_id: person.id, p_agreement_id: id, p_client_message_id: randomUUID(), p_body: body,
  });
  assert.match(message, uuidPattern); return message;
}
const cacheCount = id => Number(rt.sql(`select count(*) from public.agreement_invalidations_v1 where agreement_id=${rt.q(id)}`));
function foreignSnapshot() {
  const people = [foreign.requester.id, foreign.worker.id].map(rt.q).join(',');
  return rt.rows(`select
    (select md5(to_jsonb(a)::text) from public.agreements a where id=${rt.q(foreign.id)}) agreement,
    (select md5(coalesce(jsonb_agg(to_jsonb(m) order by id),'[]')::text) from public.agreement_messages m where agreement_id=${rt.q(foreign.id)}) messages,
    (select to_jsonb(c) from public.agreement_invalidations_v1 c where agreement_id=${rt.q(foreign.id)}) cache,
    (select md5(jsonb_agg(to_jsonb(a) order by id)::text) from public.app_accounts a where id in(${people})) accounts,
    (select md5(jsonb_agg(to_jsonb(p) order by id)::text) from public.app_profiles p where account_id in(${people})) profiles,
    (select jsonb_agg(jsonb_build_array(id,deleted_at,banned_until) order by id) from auth.users where id in(${people})) identities`)[0];
}
async function closingFixture(role) {
  const requester = await actor('b3c-close-' + role.toLowerCase() + '-requester');
  const worker = await actor('b3c-close-' + role.toLowerCase() + '-worker');
  const subject = role === 'REQUESTER' ? requester : worker;
  const peer = role === 'REQUESTER' ? worker : requester;
  const item = await agreement(requester, worker);
  const canary = 'B3C_ERASE_THIS_' + randomUUID(), peerBody = 'B3C_PEER_RETAIN_' + randomUUID();
  await send(subject, item.id, canary); const peerMessage = await send(peer, item.id, peerBody);
  assert.equal(cacheCount(item.id), 1);
  await rpc(subject.client, 'rpc_cancel_agreement', {p_agreement_id: item.id, p_reason: canary});
  assert.equal(cacheCount(item.id), 0);
  const need = rt.rows(`select status,revision from public.needs where id=${rt.q(item.needId)}`)[0];
  if (need.status !== 'CANCELLED') await rpc(requester.client, 'rpc_cancel_need', {
    p_need_id: item.needId, p_need_revision: need.revision, p_reason: 'Disposable closure fixture',
  });
  // Canonical cancellation already proved cleanup. A separately labelled residual
  // cache row makes the erasure DELETE non-vacuous; no trigger/guard is disabled.
  rt.sql(`insert into public.agreement_invalidations_v1(agreement_id,revision) values(${rt.q(item.id)},1)`);
  assert.equal(cacheCount(item.id), 1);
  assert.equal(rt.sql(`select count(*) from public.agreement_messages where agreement_id=${rt.q(item.id)} and body like ${rt.q('%' + canary + '%')}`), '2');
  return {...item, role, subject, peer, canary, peerBody, peerMessage};
}

async function close(item, runtime) {
  const who = item.subject;
  const ready = await rpc(who.client, 'rpc_review_account_closure_execution', {p_expected_user_id: who.id});
  assert.equal(ready.ready, true); assert.deepEqual(ready.blockers, []); assert.deepEqual(ready.exceptions, []);
  assert.equal(ready.adapterVersion, 'OWNER_AF_D22_EVENT_ERASURE_V1');
  const args = {p_expected_user_id: who.id, p_request_id: ready.requestId, p_expected_revision: ready.revision,
    p_client_request_id: randomUUID(), p_policy_sha256: ready.policySha256};
  const started = await rpc(who.client, 'rpc_start_account_closure_execution', args);
  assert.equal(started.state, 'EXECUTING'); assert.match(started.generation, uuidPattern);
  const replay = await rpc(who.client, 'rpc_start_account_closure_execution', args);
  assert.equal(replay.generation, started.generation);
  assert.equal(cacheCount(item.id), 1);
  const total = Number(rt.sql('select cardinality(private.closure_redaction_relations_v5())'));
  assert.ok(Number.isInteger(total) && total > 0 && total < 200);
  let closed, calls = 0;
  for (; calls < total + 40 && !closed; calls++) {
    operation = 'EXACT_CLOSURE_WORKER_STEP';
    const response = await bounded(runtime.handler(new Request('http://127.0.0.1/closure', {
      method: 'POST', headers: {apikey: env.RU5_DEVICE_SERVICE_ROLE_KEY, 'content-type': 'application/json'},
      body: JSON.stringify({accountId: who.id, generation: started.generation}),
    })), 30000);
    const value = await response.json();
    if (response.status !== 200) {
      report.closureFailureResponse = {status: response.status, call: calls + 1,
        code: typeof value?.code === 'string' && /^[A-Z][A-Z0-9_]{0,95}$/.test(value.code) ? value.code : 'UNCLASSIFIED'};
    }
    assert.equal(response.status, 200);
    assert.ok(['RELATIONAL_PROGRESS', 'STEP_VERIFIED'].includes(value.kind) || value.state === 'CLOSED');
    if (value.state === 'CLOSED') closed = value;
  }
  assert.ok(closed); assert.equal(closed.authoritative, true);
  operation = 'VERIFY_CLOSED_CONTENT_AUTH_AND_CACHE';
  assert.equal(closed.relationalOutcome, 'ORDINARY_PERSONAL_CONTENT_ERASED'); assert.deepEqual(closed.exceptions, []);
  assert.equal(closed.authOutcome, 'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED');
  assert.equal(cacheCount(item.id), 0);
  const step = rt.rows(`select state,affected_rows from private.closure_redaction_steps_v5
    where account_id=${rt.q(who.id)} and generation=${rt.q(started.generation)}
      and relation_name='public.agreement_invalidations_v1'`);
  assert.deepEqual(step, [{state: 'VERIFIED', affected_rows: 1}]);
  assert.equal(rt.sql(`select count(*) from public.agreement_messages where body like ${rt.q('%' + item.canary + '%')}`), '0');
  assert.equal(rt.sql(`select body=${rt.q(item.peerBody)} from public.agreement_messages where id=${rt.q(item.peerMessage)}`), 't');
  assert.equal(rt.sql(`select deleted_at is not null and raw_user_meta_data='{}'::jsonb and raw_app_meta_data='{}'::jsonb from auth.users where id=${rt.q(who.id)}`), 't');
  assert.equal(rt.sql(`select email='' and full_name='' from public.app_accounts where id=${rt.q(who.id)}`), 't');
  assert.equal(rt.sql(`select count(*) from auth.sessions where user_id=${rt.q(who.id)}`), '0');
  // The original session must receive a canonical Auth/closure refusal from
  // the existing exact message reader. A network error or terminal-cache false
  // is not a session-fence witness. A healthy unrelated call brackets the denial.
  const oldSession = await bounded(who.client.rpc('rpc_read_agreement_message_window_v1', {
    p_expected_user_id: who.id, p_agreement_id: item.id, p_target_message_id: item.peerMessage,
  }));
  assert.ok((oldSession.error?.code === '28000' && oldSession.error?.message === 'AUTH_REQUIRED')
    || (oldSession.error?.code === '42501' && oldSession.error?.message === 'ACCOUNT_CLOSING'));
  const healthy = await rpc(foreign.worker.client, 'rpc_read_agreement_message_window_v1', {
    p_expected_user_id: foreign.worker.id, p_agreement_id: foreign.id, p_target_message_id: foreign.message,
  });
  assert.equal(healthy.targetMessageId, foreign.message);
  assert.equal(hashJson(foreignSnapshot()), hashJson(foreignBaseline));
  assert.equal(hashJson(snapshot()), hashJson(expectedFinal));
  report.closures.push({role: item.role, result: 'CLOSED', calls, redactionSteps: total,
    canonicalStartReplayedWithoutNewGeneration: true, syntheticResidualCacheRowsErased: 1,
    erasureStepVerified: true, ownMessageAndCancelReasonErased: true, peerMessagePreserved: true,
    authIdentitySoftErased: true, sessionsRemaining: 0, oldSessionCannotRead: true, unrelatedAgreementUnchanged: true});
  pass(item.role + '_FULL_CANONICAL_CLOSURE_ERASES_OWNED_CONTENT_AND_CACHE');
}

try {
  // The runtime/worker imports and all filesystem output follow target admission.
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  assert.equal(env.DB_URL, env.RU5_DEVICE_DB_URL);
  for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) assert.equal(env[key], undefined);
  assert.equal(env.PRE_V3_ARTIFACT_DIR, '/tmp/chat-b3c-private');
  assert.equal(env.B3C_ARTIFACT_DIR, '/tmp/chat-b3c-artifacts');
  assert.equal(env.RU5_DEVICE_PROOF_DIR, '/tmp/uskoci-ru5-device-ui');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
  outputDirectory = env.B3C_ARTIFACT_DIR; report.sourceSha = env.GITHUB_SHA;
  stage = 'EXACT_SOURCE_AND_PROVEN_CATALOG_HANDOFF';
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), env.GITHUB_SHA);
  report.sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {encoding: 'utf8'}).trim();

  for(const path of [candidatePath,originalCandidatePath,harnessPath,workflowPath,snapshotPath,
    'supabase/proofs/chat/private_invalidation_proof.mjs','supabase/proofs/chat/chat_b3c_private_invalidation_proof.sql',
    'supabase/proofs/chat/private_invalidation_closure_proof.mjs','.github/workflows/chat-b3c-invalidation-proof.yml',
    'supabase/candidates/discovery_p0_exact_public_landing.sql','supabase/candidates/chat_p4_exact_message_event_resolver.sql',
    'supabase/candidates/worker_profile_licenses_owned_projection.sql',
    'supabase/proofs/pkg023/pkg023_surface.sql','supabase/proofs/pre_v3/closure_runtime.mjs',
    'supabase/proofs/pre_v3/history_snapshot.mjs','supabase/proofs/ru5_device_ui_local_guard.mjs',
    'supabase/proofs/pre_v3/v5_closure_edge_runtime.mjs','supabase/functions/_shared/data-export.ts',
    'supabase/functions/uskoci-account-closure-worker/closure.ts','supabase/functions/uskoci-account-closure-worker/index.ts']) {
    const bytes=readFileSync(path);
    assert.deepEqual(bytes,execFileSync('git',['show',env.GITHUB_SHA+':'+path]));
    report.sourceArtifactHashes[path]=hash(bytes);
  }
  const original=readFileSync(originalCandidatePath,'utf8').replaceAll('\r\n','\n');
  const applicationSource=readFileSync(candidatePath,'utf8').replaceAll('\r\n','\n');
  const fragment=original.slice(original.indexOf("set local lock_timeout="),original.indexOf('-- NO COMMIT here.'));
  const embedded=applicationSource.split('  execute $b3c_install$\n')[1]?.split('$b3c_install$;')[0];
  assert.equal(embedded,fragment);
  assert.equal(applicationSource.includes("current_setting('uskoci.chat_b3c_disposable_proof'"),false);
  report.provedInstallFragmentIdentical=true;
  const previous=JSON.parse(readFileSync(outputDirectory+'/chat-b3c-report.json','utf8'));
  assert.equal(previous.result,'PASS');assert.equal(previous.sourceSha,env.GITHUB_SHA);
  assert.equal(previous.sourceArtifactHashes[originalCandidatePath],report.sourceArtifactHashes[originalCandidatePath]);
  assert.deepEqual(previous.rollback,{checked:true,catalogUnchanged:true,fixtureStateUnchanged:true});
  assert.equal(previous.checks.length,5);assert.ok(previous.checks.every(c=>c.result==='PASS'));
  rt=await import('../pre_v3/closure_runtime.mjs');
  assert.equal(rt.sql("select md5(prosrc) from pg_proc where oid='public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)'::regprocedure"),'602113d52d64c775893752ff74bfc324');
  assert.equal(rt.sql("select md5(prosrc) from pg_proc where oid='public.rpc_get_worker_profile_for_edit()'::regprocedure"),'61e77f00205f93704af5951c112f38d3');
  assert.equal(rt.sql("select md5(prosrc) from pg_proc where oid='public.rpc_resolve_activity_message_v1(uuid,uuid)'::regprocedure"),'1769346f2fbf4a70ccf53b47614d2c0f');
  baseline=snapshot();expectedFinal=baseline;report.actualDatabase=true;
  assert.equal(baseline.state.candidate_present,false);assert.equal(baseline.state.ready,true);
  assert.equal(baseline.state.source.sha256,baseline.state.digest);
  assert.equal(baseline.state.erasure.sha256,baseline.state.digest);
  assert.equal(baseline.state.binding.sourceSha256,baseline.state.digest);
  report.catalogBeforeSha256=hashJson(baseline);
  pass('EXACT_SOURCE_AND_IDENTICAL_PROVED_INSTALL_FRAGMENT');

  stage='PREDECESSOR_REFUSALS';
  refuses('CERTIFICATES_DISAGREE',"update private.closure_erasure_source_v5 set sha256=repeat('0',64) where singleton;");
  refuses('UNREVIEWED_TABLE','create table private.chat_b3c_unreviewed_source(id integer);');
  refuses('READINESS_METADATA_CHANGED','alter function private.retention_ai_source_ready() cost 4321;');
  refuses('AUTH_PREDECESSOR_METADATA_CHANGED','alter function private.support_auth_v5(uuid) cost 4321;');
  refuses('PUBLICATION_FLAGS_CHANGED',"alter publication supabase_realtime set(publish='insert');");
  pass('PREDECESSOR_REFUSALS_PRESERVE_COMPLETE_CATALOG');

  stage='CANONICAL_EXECUTING_CLOSURE_REFUSAL';
  const blocker=await actor('b3c-install-closure-guard');
  await rpc(blocker.client,'rpc_prepare_account_closure',{p_expected_user_id:blocker.id,p_expected_revision:0,p_client_request_id:randomUUID()});
  const blockerReview=await rpc(blocker.client,'rpc_review_account_closure_execution',{p_expected_user_id:blocker.id});
  assert.equal(blockerReview.ready,true);
  const session=await bounded(blocker.client.auth.getSession());assert.equal(session.error,null);
  const claims=JSON.parse(Buffer.from(session.data.session.access_token.split('.')[1],'base64url').toString('utf8'));
  assert.equal(claims.sub,blocker.id);assert.match(claims.session_id,uuidPattern);
  const activeClosure=`do $claims$ begin perform set_config('request.jwt.claims',${rt.q(JSON.stringify(claims))},true);end $claims$;
    set local role authenticated;
    do $start$ begin perform public.rpc_start_account_closure_execution(${rt.q(blocker.id)},${rt.q(blockerReview.requestId)},
      ${Number(blockerReview.revision)},${rt.q(randomUUID())},${rt.q(blockerReview.policySha256)});end $start$;
    reset role;
    do $witness$ begin if not exists(select 1 from private.closure_executions_v5
      where account_id=${rt.q(blocker.id)} and state='EXECUTING') then raise exception 'PROOF_START_DID_NOT_EXECUTE';end if;end $witness$;
    select 'CHAT_B3C_EXECUTING_CLOSURE_ESTABLISHED';`;
  const beforeClosures=rt.sql('select count(*) from private.closure_executions_v5');
  refuses('CANONICAL_EXECUTING_CLOSURE',activeClosure,'CHAT_B3C_EXECUTING_CLOSURE_ESTABLISHED');
  assert.equal(rt.sql('select count(*) from private.closure_executions_v5'),beforeClosures);
  pass('EXECUTING_CLOSURE_REFUSAL_ROLLS_BACK_CANONICAL_START');

  stage='EXACT_APPLICATION_ROLLBACK';
  assert.ok(application({rollback:true}).includes('CHAT_B3C_APPLICATION_COMPLETED'));
  assert.equal(hashJson(snapshot()),hashJson(baseline));report.atomicRollbackPreservesCatalog=true;
  pass('EXACT_APPLICATION_ROLLBACK_PRESERVES_COMPLETE_CATALOG');

  stage='EXACT_APPLICATION_COMMIT';
  assert.ok(application().includes('CHAT_B3C_APPLICATION_COMPLETED'));
  const certified=snapshot(),before=baseline.state,after=certified.state;
  assert.equal(after.candidate_present,true);assert.equal(after.ready,true);
  assert.notEqual(after.digest,before.digest);assert.equal(after.binding.sourceSha256,after.digest);
  assert.deepEqual(after.source,{...before.source,sha256:after.digest});
  assert.deepEqual(after.erasure,{...before.erasure,sha256:after.digest});
  assert.equal(after.readiness_definition,before.readiness_definition.replace(before.source.sha256,after.digest));
  assert.deepEqual(after.readiness_metadata,{...before.readiness_metadata,
    prosrc:before.readiness_metadata.prosrc.replace(before.source.sha256,after.digest)});
  assert.deepEqual(certified.history,baseline.history);
  expectedFinal=certified;report.disposableCertificateMoved=true;report.catalogCertifiedSha256=hashJson(certified);
  report.application={sourceBefore:before.digest,sourceAfter:after.digest,certificatePlacesChanged:3,
    readinessConstantOnly:true,readinessMetadataOtherwiseUnchanged:true,migrationHistoryUnchanged:true,
    exactDeltaGuardPassedAtomically:true,ready:true,bindingMatches:true};
  pass('ATOMIC_INSTALL_AND_EXACT_THREE_CERTIFICATE_BINDINGS');
  refuses('ALREADY_INSTALLED');
  pass('REPEATED_APPLICATION_REFUSED_WITHOUT_CATALOG_CHANGE');

  stage='CANONICAL_TERMINAL_AND_SYNTHETIC_RESIDUAL_FIXTURES';
  foreign=await agreement(await actor('b3c-untouched-requester'),await actor('b3c-untouched-worker'));
  foreign.message=await send(foreign.worker,foreign.id,'Unrelated disposable message '+randomUUID());
  foreignBaseline=foreignSnapshot();
  const closing=[await closingFixture('REQUESTER'),await closingFixture('WORKER')];
  assert.equal(new Set(actors.map(a=>a.id)).size,7);
  assert.equal(hashJson(snapshot()),hashJson(expectedFinal));
  report.actualAuth=true;report.fixtureCounts={actors:7,agreements:3,closingAccounts:2,syntheticResidualCacheRows:2};
  for(const item of closing)await rpc(item.subject.client,'rpc_prepare_account_closure',{
    p_expected_user_id:item.subject.id,p_expected_revision:0,p_client_request_id:randomUUID()});
  const visible=await bounded(foreign.worker.client.from('agreement_invalidations_v1').select('agreement_id,revision').eq('agreement_id',foreign.id));
  assert.equal(visible.error,null);assert.deepEqual(visible.data,[{agreement_id:foreign.id,revision:1}]);
  const denied=await bounded(closing[0].subject.client.from('agreement_invalidations_v1').select('agreement_id,revision').eq('agreement_id',foreign.id));
  assert.equal(denied.error,null);assert.deepEqual(denied.data,[]);
  report.actualAuthenticatedRowVisibility=true;
  pass('CANONICAL_CLEANUP_AUTHENTICATED_VISIBILITY_AND_RESIDUAL_ERASURE_FIXTURES');

  stage='LATER_DRIFT_FAILS_CLOSED';
  for(const [name,change] of [
    ['UNREVIEWED_TABLE','create table private.chat_b3c_later_source(id integer)'],
    ['POLICY_CHANGED','alter policy agreement_invalidations_read_v1 on public.agreement_invalidations_v1 using(true)'],
    ['PUBLICATION_DELETE_ENABLED',"alter publication supabase_realtime set(publish='insert,update,delete')"],
    ['FUNCTION_METADATA_CHANGED','alter function private.agreement_message_invalidate_v1() cost 4321'],
  ]) {
    assert.equal(rt.sql(`begin;${change};select private.retention_ai_source_ready()::text||':'||(private.closure_erasure_binding_v5() is null)::text;rollback;`),'false:true');
    assert.equal(hashJson(snapshot()),hashJson(expectedFinal));
    report.laterDriftChecks.push({name,readinessFalse:true,bindingNull:true,rollbackUnchanged:true});
  }
  pass('LATER_SOURCE_DRIFT_INVALIDATES_READINESS_AND_BINDING');
  const {loadClosureWorker} = await import('../pre_v3/v5_closure_edge_runtime.mjs');
  const allowedAccounts = new Set(closing.map(item => item.subject.id));
  const allowedRpc = new Set(['rpc_claim_account_closure_action_service', 'rpc_dispatch_account_closure_action_service',
    'rpc_redact_account_closure_step_service', 'rpc_complete_account_closure_action_service', 'rpc_finalize_account_closure_service']);
  const runtime = loadClosureWorker({env: name => ({USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED: 'true',
    SUPABASE_URL: env.RU5_DEVICE_SUPABASE_URL, SUPABASE_ANON_KEY: env.RU5_DEVICE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.RU5_DEVICE_SERVICE_ROLE_KEY})[name], fetch: async (url, init) => {
      const parsed = new URL(url); assert.equal(parsed.origin, new URL(env.RU5_DEVICE_SUPABASE_URL).origin);
      assert.equal(parsed.search, '');
      const name = parsed.pathname.replace('/rest/v1/rpc/', '');
      const id = parsed.pathname.replace('/auth/v1/admin/users/', '');
      assert.ok((parsed.pathname === '/rest/v1/rpc/' + name && allowedRpc.has(name) && init.method === 'POST')
        || (parsed.pathname === '/auth/v1/admin/users/' + id && allowedAccounts.has(id) && ['GET', 'DELETE'].includes(init.method)));
      return fetch(url, init);
    }});
  for (const [path, value] of Object.entries(runtime.sourceHashes)) assert.equal(value, report.sourceArtifactHashes[path]);
  for (const item of closing) { stage = item.role + '_FULL_CLOSURE'; await close(item, runtime); }
  report.certifiedErasureProven = true;
  assert.equal(hashJson(foreignSnapshot()), hashJson(foreignBaseline));
  pass('CLOSED_SESSION_REFUSAL_AND_UNRELATED_AGREEMENT_UNCHANGED');
} catch(error) {fail(error);}
finally {
 if(expectedFinal) {
   stage='FINAL_CERTIFIED_CATALOG_CHECK';
   try {
     const final=snapshot();report.catalogFinalSha256=hashJson(final);
     report.finalCatalogUnchangedSinceApplication=hashJson(final)===hashJson(expectedFinal);
     report.finalReadiness=final.state.ready;
     assert.equal(report.finalCatalogUnchangedSinceApplication,true);
     assert.equal(report.finalReadiness,true);
     if(foreignBaseline)assert.equal(hashJson(foreignSnapshot()),hashJson(foreignBaseline));
     if(report.certifiedErasureProven)pass('FINAL_CERTIFIED_CATALOG_PUBLICATION_AND_HISTORY_UNCHANGED');
   } catch(error){fail(error);}
 }
 if(!report.failure&&report.certifiedErasureProven&&report.disposableCertificateMoved
    &&report.finalCatalogUnchangedSinceApplication&&report.closures.length===2)report.result='PASS';
 else process.exitCode=1;
 if(outputDirectory) {
   try {writeFileSync(outputDirectory+'/chat-b3c-application-report.json',JSON.stringify(report,null,2)+'\n');}
   catch {process.exitCode=1;console.error('FAIL CHAT_B3C_APPLICATION_REPORT_WRITE');}
 }
 console.log(report.result+' CHAT_B3C_EXACT_APPLICATION_AND_ERASURE');
}
