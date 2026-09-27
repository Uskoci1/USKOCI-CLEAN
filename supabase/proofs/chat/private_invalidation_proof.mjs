// B3c disposable SQL/Auth harness SOURCE ONLY / NOT RUN / NOT DEPLOYABLE.
// No websocket, DEV, provider, Storage IO or certificate application proof.
// The exact SQL file owns BEGIN/ROLLBACK; never apply the candidate separately.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {migrationSnapshotQuery} from '../pre_v3/history_snapshot.mjs';

const env = process.env;
const candidatePath = 'supabase/candidates/chat_b3c_private_invalidation.sql';
const proofPath = 'supabase/proofs/chat/chat_b3c_private_invalidation_proof.sql';
const harnessPath = 'supabase/proofs/chat/private_invalidation_proof.mjs';
const workflowPath = '.github/workflows/chat-b3c-invalidation-proof.yml';
const surfacePath = 'supabase/proofs/pkg023/pkg023_surface.sql';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = value => createHash('sha256').update(value).digest('hex');
const jsonDigest = value => digest(JSON.stringify(value));
const report = {
  unit: 'CHAT_B3C_PRIVATE_INVALIDATION_SQL', result: 'FAIL', sourceSha: null, sourceTree: null,
  actualAuth: false, actualDatabase: false, sqlAuthenticatedRoles: false,
  disposableOnly: true, liveAccess: false, providerCalled: false, providerCalls: 0,
  storageCalls: 0, deviceProven: false, incomingStreamProven: false,
  certificateMoved: null, deploymentReady: false, checks: [], sourceArtifactHashes: {},
  predecessor: 'live79 + source147 through PKG-050 + A1 + B3a/B3b; PKG-051/P0 excluded',
  rollback: {checked: false, catalogUnchanged: false, fixtureStateUnchanged: null},
};
let stage = 'LOCAL_TARGET_ADMISSION';
let outputDirectory;
let rt;
let baseline;
let fixtureBaseline;
let fixture;
const proofApplication = 'uskoci-chat-b3c-proof-' + process.pid;

function pass(name) {
  report.checks.push({name, result: 'PASS'});
  console.log('PASS CHAT_B3C_' + name);
}

// Reports contain only these fixed stage names, hashes, booleans and bounded
// numeric/SQLSTATE diagnostics. Never serialize an Error, SQL, JWT, actor or URL.
function failStage() {
  if (report.failureStage) report.rollbackFailureStage = stage;
  else report.failureStage = stage;
  process.exitCode = 1;
  console.error('FAIL CHAT_B3C_' + stage);
}

function catalogSnapshot() {
  const state = rt.rows(`select
    private.closure_source_digest_v5() as digest,
    (select to_jsonb(c) from private.closure_source_v5 c where singleton) as certificate,
    (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) as erasure,
    private.retention_ai_source_ready() as ready,
    private.closure_erasure_binding_v5() as binding,
    pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) as readiness_definition,
    (select jsonb_agg(to_jsonb(c) order by c.data_class) from private.closure_dataset_catalog_v5 c) as datasets,
    (select jsonb_agg(jsonb_build_array(p.oid,md5(to_jsonb(p)::text)) order by p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private','rls_private')) as function_metadata,
    (select jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relreplident) order by c.oid)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in('public','private','rls_private') and c.relkind in('r','p')) as table_authority,
    (select jsonb_agg(to_jsonb(p) order by p.pubname) from pg_publication p) as publications,
    (select jsonb_agg(to_jsonb(p) order by p.pubname,p.schemaname,p.tablename) from pg_publication_tables p) as publication_tables,
    to_regclass('public.agreement_invalidations_v1') is null as candidate_absent`)[0];
  return {
    state,
    surface: rt.sql(readFileSync(surfacePath, 'utf8')),
    history: rt.rows(migrationSnapshotQuery()),
  };
}

function fixtureSnapshot() {
  const accountIds = [fixture.requester_id, fixture.worker_id, fixture.stranger_id, fixture.foreign_worker_id];
  const sessionIds = [fixture.requester_session, fixture.worker_session, fixture.stranger_session];
  const agreementIds = [fixture.agreement_id, fixture.foreign_agreement_id];
  const list = values => values.map(rt.q).join(',');
  // Compare retained fixture data only in memory. No identities or content enter the report.
  return rt.rows(`select
    (select jsonb_agg(jsonb_build_array(a.id,md5(to_jsonb(a)::text)) order by a.id)
      from public.agreements a where a.id in(${list(agreementIds)})) as agreements,
    (select jsonb_agg(jsonb_build_array(m.id,md5(to_jsonb(m)::text)) order by m.id)
      from public.agreement_messages m where m.agreement_id in(${list(agreementIds)})) as messages,
    (select jsonb_agg(jsonb_build_array(u.id,u.banned_until,u.deleted_at) order by u.id)
      from auth.users u where u.id in(${list(accountIds)})) as accounts,
    (select jsonb_agg(jsonb_build_array(s.id,s.user_id,s.not_after) order by s.id)
      from auth.sessions s where s.id in(${list(sessionIds)})) as sessions`)[0];
}

async function localSession(actor) {
  const result = await actor.client.auth.getSession();
  assert.equal(result.error, null);
  const session = result.data.session;
  assert.ok(session?.access_token);
  const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(claims.sub, actor.id);
  assert.equal(claims.role, 'authenticated');
  assert.match(claims.session_id, uuidPattern);
  assert.ok(Number.isFinite(claims.exp) && claims.exp * 1000 > Date.now());
  assert.equal(rt.sql(`select private.push_session_valid(${rt.q(actor.id)},${rt.q(claims.session_id)})`), 't');
  return claims.session_id;
}

async function agreement(requester, worker, label) {
  const profile = (actor, kind) => {
    const rows = rt.rows(`select id from public.app_profiles where account_id=${rt.q(actor.id)} and kind=${rt.q(kind)}`);
    assert.equal(rows.length, 1);
    assert.match(rows[0].id, uuidPattern);
    return rows[0].id;
  };
  const requesterProfile = profile(requester, 'REQUESTER');
  const workerProfile = profile(worker, 'WORKER');
  rt.sql(`update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${rt.q(workerProfile)}`);
  await rt.ok(worker.client.rpc('rpc_complete_worker_profile', {p_profile_id: workerProfile}));
  const needId = randomUUID();
  // Exact existing B3 disposable published-Need fixture pattern; no trigger disabling.
  rt.sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
    values(${rt.q(needId)},${rt.q(requester.id)},${rt.q(requesterProfile)},'PUBLISHED',${rt.q(label)},
      'Disposable B3c proof','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',
      statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
  const offer = await rt.ok(worker.client.rpc('rpc_submit_response', {
    p_need_id: needId, p_need_revision: 1, p_worker_profile_id: workerProfile,
    p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: null, p_proposed_end_at: null,
    p_scope_note: null, p_client_request_id: randomUUID(),
  }));
  const id = await rt.ok(requester.client.rpc('rpc_select_response', {
    p_need_id: needId, p_need_revision: offer.needRevision, p_response_id: offer.responseId,
    p_response_version: offer.version, p_content_hash: offer.contentHash, p_client_request_id: randomUUID(),
  }));
  assert.match(id, uuidPattern);
  return id;
}

function runSqlProof() {
  const keys = ['requester_id', 'requester_session', 'worker_id', 'worker_session',
    'stranger_id', 'stranger_session', 'agreement_id', 'foreign_agreement_id'];
  const childEnv = {...env, PGAPPNAME: proofApplication,
    PGOPTIONS: '-c statement_timeout=30000 -c lock_timeout=5000', PSQL_HISTORY: '/dev/null'};
  const args = [env.RU5_DEVICE_DB_URL, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
    '-v', 'ECHO=none', '-v', 'VERBOSITY=sqlstate', '-v', 'b3c_local_target_attested=true'];
  for (const key of keys) {
    assert.match(fixture[key], uuidPattern);
    const variable = 'USKOCI_B3C_' + key.toUpperCase();
    childEnv[variable] = fixture[key];
    // psql supports repeated -c meta-commands followed by -f. Session IDs remain
    // in child environment/memory, never command arguments or a generated file.
    // https://www.postgresql.org/docs/current/app-psql.html
    args.push('-c', '\\getenv ' + key + ' ' + variable);
  }
  args.push('-f', resolve(proofPath));
  let output = '';
  try {
    output = execFileSync('psql', args, {env: childEnv, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 524288, killSignal: 'SIGKILL'});
    report.sqlExit = 0;
    assert.equal(output.split(/\r?\n/).filter(line => line === 'CHAT_B3C_SQL_PROOF_ROLLED_BACK').length, 1);
    report.sqlRollbackMarker = true;
  } catch (error) {
    if (Number.isInteger(error?.status)) report.sqlExit = error.status;
    else if (report.sqlExit !== 0) report.sqlExit = null;
    report.sqlProcessCode = ['ENOENT', 'ETIMEDOUT', 'ENOBUFS'].includes(error?.code) ? error.code : 'PROCESS_OR_ASSERTION';
    const diagnostic = String(error?.stderr ?? '').slice(0, 4096);
    const state = diagnostic.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5})(?:\s|$)/)?.[1];
    const location = diagnostic.match(/(chat_b3c_private_invalidation(?:_proof)?\.sql):(\d+):/);
    if (state) report.sqlState = state;
    if (location) report.sqlLocation = {file: location[1], line: Number(location[2])};
    throw new Error('CHAT_B3C_SQL_DID_NOT_COMPLETE');
  } finally {
    output = '';
    for (const key of keys) delete childEnv['USKOCI_B3C_' + key.toUpperCase()];
  }
}

async function verifyRollback() {
  // A terminated psql connection may take a moment to retire on the server.
  let remaining = 1;
  for (let attempt = 0; attempt < 20; attempt++) {
    remaining = Number(rt.sql(`select count(*) from pg_stat_activity where application_name=${rt.q(proofApplication)}`));
    if (remaining === 0) break;
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  assert.equal(remaining, 0);
  const after = catalogSnapshot();
  report.rollback.checked = true;
  report.rollback.catalogUnchanged = jsonDigest(after) === jsonDigest(baseline);
  report.certificateMoved = jsonDigest([after.state.certificate, after.state.erasure])
    !== jsonDigest([baseline.state.certificate, baseline.state.erasure]);
  report.catalogAfterSha256 = jsonDigest(after);
  if (fixtureBaseline) report.rollback.fixtureStateUnchanged = jsonDigest(fixtureSnapshot()) === jsonDigest(fixtureBaseline);
  assert.equal(report.rollback.catalogUnchanged, true);
  if (fixtureBaseline) assert.equal(report.rollback.fixtureStateUnchanged, true);
  pass('INDEPENDENT_CONNECTION_CATALOG_CERTIFICATE_AND_FIXTURE_ROLLBACK');
}

try {
  // No runtime import, filesystem output, client creation or database query may
  // precede target admission. The shared runtime repeats the same local guard.
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  assert.equal(env.DB_URL, env.RU5_DEVICE_DB_URL);
  // Inherited libpq host-address/service/options settings must not redirect or
  // alter the shared runtime's otherwise explicit loopback connection.
  for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) assert.equal(env[key], undefined);
  assert.equal(env.PRE_V3_ARTIFACT_DIR, '/tmp/chat-b3c-private');
  assert.equal(env.B3C_ARTIFACT_DIR, '/tmp/chat-b3c-artifacts');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
  outputDirectory = env.B3C_ARTIFACT_DIR;
  mkdirSync(outputDirectory, {recursive: true});
  report.sourceSha = env.GITHUB_SHA;
  stage = 'EXACT_SOURCE_AND_PREDECESSOR_REPORTS';
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), env.GITHUB_SHA);
  report.sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {encoding: 'utf8'}).trim();
  for (const path of [candidatePath, proofPath, harnessPath, workflowPath, surfacePath,
    'supabase/proofs/pre_v3/closure_runtime.mjs', 'supabase/proofs/pre_v3/history_snapshot.mjs',
    'supabase/proofs/ru5_device_ui_local_guard.mjs']) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', env.GITHUB_SHA + ':' + path]));
    report.sourceArtifactHashes[path] = digest(bytes);
  }
  for (const name of ['chat-b3-a1-preparation.json', 'chat-b3a-report.json', 'chat-b3b-report.json']) {
    const prepared = JSON.parse(readFileSync(env.PRE_V3_ARTIFACT_DIR + '/' + name, 'utf8'));
    assert.equal(prepared.result, 'PASS'); assert.equal(prepared.sourceSha, env.GITHUB_SHA);
    assert.equal(prepared.actualAuth, true); assert.equal(prepared.actualDatabase, true);
    assert.equal(prepared.liveAccess, false); assert.equal(prepared.providerCalled, false);
    assert.equal(prepared.providerCalls, 0); assert.equal(prepared.storageCalls, 0);
    assert.equal(prepared.deviceProven, false);
    assert.ok(prepared.checks.length > 0 && prepared.checks.every(check => check.result === 'PASS'));
  }
  pass('EXACT_SOURCE_AND_ADMITTED_B3_PREDECESSOR_REPORTS');
  rt = await import('../pre_v3/closure_runtime.mjs');
  stage = 'PREDECESSOR_CATALOG';
  baseline = catalogSnapshot();
  report.actualDatabase = true;
  assert.equal(baseline.state.candidate_absent, true);
  assert.equal(baseline.state.ready, true);
  assert.equal(baseline.state.digest, baseline.state.certificate.sha256);
  assert.equal(baseline.state.digest, baseline.state.erasure.sha256);
  assert.equal(baseline.state.digest, baseline.state.binding.sourceSha256);
  report.catalogBeforeSha256 = jsonDigest(baseline);
  pass('CERTIFIED_PREDECESSOR_AND_ABSENT_B3C');

  stage = 'FOUR_LOCAL_AUTH_ACTORS_AND_DISJOINT_AGREEMENTS';
  const requester = await rt.actor('b3c-requester');
  const worker = await rt.actor('b3c-worker');
  const stranger = await rt.actor('b3c-stranger');
  const foreignWorker = await rt.actor('b3c-foreign-worker');
  for (const actor of [requester, worker, stranger, foreignWorker]) assert.match(actor.id, uuidPattern);
  assert.equal(new Set([requester.id, worker.id, stranger.id, foreignWorker.id]).size, 4);
  fixture = {requester_id: requester.id, worker_id: worker.id, stranger_id: stranger.id,
    foreign_worker_id: foreignWorker.id,
    agreement_id: await agreement(requester, worker, 'B3c main Agreement'),
    foreign_agreement_id: await agreement(stranger, foreignWorker, 'B3c unrelated Agreement'),
    requester_session: await localSession(requester), worker_session: await localSession(worker),
    stranger_session: await localSession(stranger)};
  assert.notEqual(fixture.agreement_id, fixture.foreign_agreement_id);
  assert.equal(jsonDigest(catalogSnapshot()), jsonDigest(baseline));
  fixtureBaseline = fixtureSnapshot();
  assert.equal(fixtureBaseline.messages, null);
  report.actualAuth = true;
  report.fixtureCounts = {actors: 4, agreements: 2, admittedSessions: 3};
  pass('FOUR_REAL_LOCAL_ACTORS_TWO_DISJOINT_AGREEMENTS_THREE_CURRENT_SESSIONS');

  stage = 'EXACT_SQL_FILE_WITH_ENVIRONMENT_ONLY_SESSION_IDS';
  runSqlProof();
  report.sqlAuthenticatedRoles = true;
  pass('EXACT_SQL_FILE_AUTHORIZATION_METADATA_MUTATIONS_AND_ROLLBACK_MARKER');
} catch {
  failStage();
} finally {
  if (baseline) {
    const failedStage = stage;
    stage = 'INDEPENDENT_ROLLBACK_CHECK';
    try { await verifyRollback(); } catch { failStage(); }
    stage = failedStage;
  }
  if (!report.failureStage && report.sqlRollbackMarker && report.rollback.checked
    && report.rollback.catalogUnchanged && report.rollback.fixtureStateUnchanged) report.result = 'PASS';
  else process.exitCode = 1;
  if (outputDirectory) {
    try { writeFileSync(outputDirectory + '/chat-b3c-report.json', JSON.stringify(report, null, 2) + '\n'); }
    catch { process.exitCode = 1; report.result = 'FAIL'; console.error('FAIL CHAT_B3C_REPORT_WRITE'); }
  }
  fixture = undefined;
  fixtureBaseline = undefined;
  console.log(report.result + ' CHAT_B3C_PRIVATE_INVALIDATION_SQL');
}
