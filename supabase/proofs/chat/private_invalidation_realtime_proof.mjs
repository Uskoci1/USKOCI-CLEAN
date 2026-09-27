// Disposable wire proof / NOT DEPLOYABLE. Prior run failed before its first
// known-message witness; bounded diagnostics below distinguish the next failure.
// The distinct admission never rebinds certificates. The workflow MUST discard
// the entire local stack after this phase, including every failure path.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';

const env = process.env;
const candidatePath = 'supabase/candidates/chat_b3c_private_invalidation.sql';
const harnessPath = 'supabase/proofs/chat/private_invalidation_realtime_proof.mjs';
const workflowPath = '.github/workflows/chat-b3c-invalidation-proof.yml';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const hashJson = value => sha256(JSON.stringify(value));
const report = {
  unit: 'CHAT_B3C_PRIVATE_INVALIDATION_REALTIME', result: 'FAIL', sourceSha: null,
  actualAuth: false, actualDatabase: false, incomingStreamProven: false,
  disposableOnly: true, liveAccess: false, providerCalled: false, providerCalls: 0,
  storageCalls: 0, deviceProven: false, deploymentReady: false, certificateMoved: null,
  admission: 'LOCAL_ONLY_EPHEMERAL_REALTIME', fixtureCommitted: false,
  certifiedErasureProven: false, teardownRequired: true, checks: [], sourceArtifactHashes: {},
  knownMessageWatermarks: 0, heartbeatBarriers: 0, channelsClosed: false,
  messageAttempts: [],
  sourceEvidence: {
    cliVersion: '2.116.0', realtimeVersion: '2.129.3',
    realtimeCommit: '91812f42c4653ed55270e0bf4df6e9530de7966e',
    cliImagePin: 'https://github.com/supabase/cli/blob/v2.116.0/apps/cli-go/pkg/config/templates/Dockerfile#L14',
    asynchronousPostgresAdmission: 'https://github.com/supabase/realtime/blob/91812f42c4653ed55270e0bf4df6e9530de7966e/lib/realtime_web/channels/realtime_channel.ex#L349',
    internalPublicationCreation: 'https://github.com/supabase/realtime/blob/91812f42c4653ed55270e0bf4df6e9530de7966e/lib/realtime/tenants/replication_connection.ex#L235',
    cdcSlotPreparation: 'https://github.com/supabase/realtime/blob/91812f42c4653ed55270e0bf4df6e9530de7966e/lib/extensions/postgres_cdc_rls/replications.ex#L10',
  },
  // Finite ordered-message witnesses, not a claim that silence alone proves denial.
  observationContract: 'KNOWN_MESSAGE_WATERMARKS_AND_LIVE_SOCKET_HEARTBEATS',
};
let stage = 'LOCAL_TARGET_ADMISSION';
let operation = 'ADMISSION';
let outputDirectory;
let rt;
let createClient;
let baseline;
let installed;
let fixture;
let wireFault = false;
let shuttingDown = false;
const observers = [];
const authActors = [];
let actorSessions;
let lastMessageWal;
let readySlotName;
let cancelBounded;
const cancelled = new Promise((_, reject) => { cancelBounded = reject; });
// The workflow's outer timeout first requests ordinary finally cleanup. Its
// hard-kill fallback is followed by destruction of the disposable stack.
cancelled.catch(() => {});
process.once('SIGTERM', () => {
  wireFault = true;
  cancelBounded(new Error('PROOF_TERMINATED'));
});

function pass(name) {
  report.checks.push({name, result: 'PASS'});
  console.log('PASS CHAT_B3C_REALTIME_' + name);
}
function errorKind(error) {
  // Never copy arbitrary error messages, details, hints, stack, payload or codes.
  if (error?.code === 'ERR_ASSERTION') return 'ASSERTION';
  for (const name of ['BOUNDED_OPERATION_TIMEOUT', 'PROOF_TERMINATED', 'WITNESS_TIMEOUT']) {
    if (error?.message === name) return name;
  }
  if (typeof error?.message === 'string' && error.message.startsWith('LOCAL_SQL:')) return 'SQL_PROCESS_FAILURE';
  if (error instanceof TypeError) return 'TYPE_ERROR';
  return 'OTHER_FAILURE';
}
function safeRpcCode(code) {
  return ['28000', '42501', '55000', '22023', '22001', '22P02', 'P0001', 'P0002',
    '40001', '40P01', '23503', '23505', '42703', '42883', '42P01', '57014',
    'PGRST116', 'PGRST202', 'PGRST301', 'PGRST302'].includes(code) ? code : 'OTHER_OR_ABSENT';
}
function fail(error) {
  const diagnostic = {operation, kind: errorKind(error)};
  if (report.failureStage) {
    (report.cleanupFailureStages ??= []).push(stage);
    (report.cleanupFailureDiagnostics ??= []).push({stage, ...diagnostic});
  } else {
    report.failureStage = stage;
    report.failureDiagnostic = diagnostic;
  }
  process.exitCode = 1;
  console.error('FAIL CHAT_B3C_REALTIME_' + stage);
}
async function bounded(promise, milliseconds = 15000, cleanup = false) {
  let timer;
  try {
    return await Promise.race([promise, ...(cleanup ? [] : [cancelled]), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('BOUNDED_OPERATION_TIMEOUT')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
async function waitFor(predicate, interval = 25) {
  const deadline = Date.now() + 15000;
  while (!predicate()) {
    assert.equal(wireFault, false);
    if (Date.now() >= deadline) throw new Error('WITNESS_TIMEOUT');
    await new Promise(done => setTimeout(done, interval));
  }
  assert.equal(wireFault, false);
}
function certificates() {
  operation = 'READ_CERTIFICATE_AND_SURFACE_SNAPSHOT';
  return rt.rows(`select
    (select to_jsonb(c) from private.closure_source_v5 c where singleton) source,
    (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure,
    pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness_definition,
    private.closure_source_digest_v5() digest,
    private.closure_schema_digest_v5_139() schema_digest,
    private.closure_erasure_program_digest_v5() erasure_program_digest,
    private.retention_ai_source_ready() ready,
    private.closure_erasure_binding_v5() binding,
    (select jsonb_agg(to_jsonb(p) order by pubname) from pg_publication p) publications,
    (select jsonb_agg(to_jsonb(p) order by pubname,schemaname,tablename) from pg_publication_tables p) publication_tables,
    (select jsonb_object_agg(p.oid::regprocedure::text,md5(to_jsonb(p)::text)) from pg_proc p
      where p.oid in(select to_regprocedure(signature) from unnest(array[
        'public.rpc_agreement_invalidation_visible_v1(uuid)',
        'private.agreement_message_invalidate_v1()',
        'private.agreement_invalidation_cleanup_v1()',
        'private.agreement_invalidation_surface_v1()']::text[]) signature)) invalidation_function_metadata,
    to_regclass('public.agreement_invalidations_v1') is not null candidate_present`)[0];
}
function certificateIdentity(state) {
  return hashJson([state.source, state.erasure, state.readiness_definition]);
}
function surfaceComparisons(state) {
  const publications = Array.isArray(state.publications) ? state.publications : [];
  const tables = Array.isArray(state.publication_tables) ? state.publication_tables : [];
  const targetTables = tables.filter(row => row.pubname === 'supabase_realtime');
  const publication = publications.find(row => row.pubname === 'supabase_realtime');
  return {
    sourceCertificateUnchanged: hashJson(state.source) === hashJson(baseline.source),
    erasureCertificateUnchanged: hashJson(state.erasure) === hashJson(baseline.erasure),
    readinessDefinitionUnchanged: state.readiness_definition === baseline.readiness_definition,
    candidatePresent: state.candidate_present === true,
    readinessFalse: state.ready === false,
    bindingNull: state.binding === null,
    digestValid: typeof state.digest === 'string' && /^[a-f0-9]{64}$/.test(state.digest),
    digestDiffersFromCertified: state.digest !== baseline.digest,
    soleExpectedPublishedTable: targetTables.length === 1 && targetTables[0].schemaname === 'public'
      && targetTables[0].tablename === 'agreement_invalidations_v1',
    rawMessagesUnpublished: !tables.some(row => row.tablename === 'agreement_messages'),
    publicationInsertUpdateOnly: publication?.pubinsert === true && publication?.pubupdate === true
      && publication?.pubdelete === false && publication?.pubtruncate === false && publication?.puballtables === false,
    ...(installed ? {
      sourceDigestUnchangedSinceInstall: state.digest === installed.digest,
      schemaDigestUnchangedSinceInstall: state.schema_digest === installed.schema_digest,
      erasureProgramDigestUnchangedSinceInstall: state.erasure_program_digest === installed.erasure_program_digest,
      invalidationFunctionMetadataUnchangedSinceInstall: hashJson(state.invalidation_function_metadata) === hashJson(installed.invalidation_function_metadata),
      publicationsUnchangedSinceInstall: hashJson(state.publications) === hashJson(installed.publications),
      publicationTablesUnchangedSinceInstall: hashJson(state.publication_tables) === hashJson(installed.publication_tables),
      completeSnapshotUnchangedSinceInstall: hashJson(state) === hashJson(installed),
    } : {}),
  };
}
function verifyUncertified(state) {
  operation = 'ASSERT_UNCERTIFIED_SURFACE';
  assert.equal(certificateIdentity(state), certificateIdentity(baseline));
  assert.equal(state.candidate_present, true);
  assert.equal(state.ready, false);
  assert.equal(state.binding, null);
  assert.match(state.digest, /^[a-f0-9]{64}$/);
  assert.notEqual(state.digest, baseline.digest);
  const tables = state.publication_tables.filter(row => row.pubname === 'supabase_realtime');
  assert.equal(tables.length, 1);
  assert.equal(tables[0].schemaname, 'public');
  assert.equal(tables[0].tablename, 'agreement_invalidations_v1');
  assert.ok(!state.publication_tables.some(row => row.tablename === 'agreement_messages'));
  const publication = state.publications.find(row => row.pubname === 'supabase_realtime');
  for (const flag of ['pubinsert', 'pubupdate']) assert.equal(publication[flag], true);
  for (const flag of ['pubdelete', 'pubtruncate', 'puballtables']) assert.equal(publication[flag], false);
}

function publicationDelta(before, after) {
  const previous = new Map(before.publications.map(row => [row.pubname, row]));
  const current = new Map(after.publications.map(row => [row.pubname, row]));
  const safeName = value => /^[a-z][a-z0-9_]{0,62}$/.test(value) ? value : 'UNEXPECTED_CATALOG_NAME';
  return {
    added: [...current.keys()].filter(name => !previous.has(name)).map(safeName),
    removed: [...previous.keys()].filter(name => !current.has(name)).map(safeName),
    changed: [...previous.keys()].filter(name => current.has(name) && hashJson(previous.get(name)) !== hashJson(current.get(name))).map(safeName),
    addedTableNames: after.publication_tables.filter(row => !before.publication_tables.some(old => hashJson(old) === hashJson(row)))
      .map(row => ({publication: safeName(row.pubname), schema: safeName(row.schemaname), table: safeName(row.tablename)})),
  };
}
function subscriptionRegistrations() {
  if (rt.sql("select to_regclass('realtime.subscription') is not null") !== 't') return {tablePresent: false};
  const expected = authActors.map((actor, index) => `(${index + 1},${rt.q(actor.id)}::uuid,${rt.q(actorSessions[index].id)}::uuid)`).join(',');
  const rows = rt.rows(`with expected(observer,account_id,session_id) as (values ${expected})
    select e.observer,count(s.id)::integer registered_rows,
      coalesce(bool_and(s.claims->>'role'='authenticated' and s.claims_role='authenticated'::regrole),false) authenticated_role,
      coalesce(bool_and(s.claims->>'session_id'=e.session_id::text),false) exact_session,
      coalesce(bool_and(cardinality(s.filters)=0),false) no_client_filter,
      private.push_session_valid(e.account_id,e.session_id) current_session_valid
    from expected e left join realtime.subscription s
      on s.entity='public.agreement_invalidations_v1'::regclass and s.claims->>'sub'=e.account_id::text
    group by e.observer,e.account_id,e.session_id order by e.observer`);
  const total = Number(rt.sql("select count(*) from realtime.subscription where entity='public.agreement_invalidations_v1'::regclass"));
  return {tablePresent: true, totalTargetRegistrations: total, observers: rows,
    exactlyFourCurrentSessionRegistrations: total === 4 && rows.length === 4 && rows.every(row => row.registered_rows === 1
      && row.authenticated_role && row.exact_session && row.no_client_filter && row.current_session_valid)};
}
function replicationState(watermark = null) {
  // Never consume/advance a slot or call realtime.list_changes: only the real
  // Realtime poller may process WAL. LSNs and database/PID identities stay private.
  const slots = rt.rows(`select slot_name,plugin,active,temporary,
      confirmed_flush_lsn is not null cursor_present,
      ${watermark ? `confirmed_flush_lsn>=${rt.q(watermark)}::pg_lsn` : 'null::boolean'} cursor_past_message
    from pg_replication_slots where database=current_database() and slot_type='logical' order by slot_name`);
  const cdc = slots.filter(slot => slot.plugin === 'wal2json');
  const selected = cdc.length === 1 ? cdc[0] : null;
  if (!readySlotName && selected?.cursor_present) readySlotName = selected.slot_name;
  return {walLevelLogical: rt.sql("select current_setting('wal_level')='logical'") === 't',
    logicalSlotCount: slots.length, cdcSlotCount: cdc.length,
    cdcSlotPrepared: cdc.length === 1 && selected.cursor_present && selected.temporary,
    sameCdcSlot: selected ? selected.slot_name === readySlotName : false,
    cdcSlotActiveAtSample: selected?.active === true,
    cdcCursorPastMessage: watermark ? selected?.cursor_past_message === true : null,
    broadcastSlotPrepared: slots.some(slot => slot.plugin === 'pgoutput' && slot.active && slot.cursor_present),
  };
}
async function admitRealtimeInitialization() {
  operation = 'WAIT_REALTIME_REGISTRATIONS_AND_PREPARED_CDC_SLOT';
  // SUBSCRIBED admits only the channel join in the pinned server. Wait for its
  // separate PostgreSQL OK, exact database registrations and an already-created
  // logical slot BEFORE inserting the first known message. No longer timeout.
  await waitFor(() => {
    report.registrationAdmission = subscriptionRegistrations();
    report.replicationAdmission = replicationState();
    return observers.every(observer => observer.postgresReady) && report.registrationAdmission.exactlyFourCurrentSessionRegistrations
      && report.replicationAdmission.walLevelLogical && report.replicationAdmission.cdcSlotPrepared
      && report.replicationAdmission.broadcastSlotPrepared;
  }, 250);
  operation = 'ATTEST_SERVICE_INITIALIZATION_PUBLICATION_DELTA';
  const warmed = certificates();
  report.initializationPublicationDelta = publicationDelta(installed, warmed);
  const delta = report.initializationPublicationDelta;
  assert.deepEqual(delta.removed, []);
  assert.deepEqual(delta.changed, []); // Never permit an edit to any preexisting publication.
  assert.ok(delta.added.length <= 1 && delta.added.every(name => name === 'supabase_realtime_messages_publication'));
  assert.ok(installed.publication_tables.every(row => warmed.publication_tables.some(current => hashJson(row) === hashJson(current))));
  assert.ok(delta.addedTableNames.every(row => row.publication === 'supabase_realtime_messages_publication'
    && row.schema === 'realtime' && (row.table === 'messages' || /^messages_[0-9_]+$/.test(row.table))));
  const internal = rt.rows(`select not p.puballtables and p.pubinsert and p.pubupdate and p.pubdelete and p.pubtruncate
      and not p.pubviaroot as exact_flags,
      (select count(*) from pg_publication_rel r where r.prpubid=p.oid)=1
      and exists(select 1 from pg_publication_rel r where r.prpubid=p.oid
        and r.prrelid='realtime.messages'::regclass and r.prattrs is null and r.prqual is null)
      and not exists(select 1 from pg_publication_namespace n where n.pnpubid=p.oid) as exact_membership
    from pg_publication p where p.pubname='supabase_realtime_messages_publication'`);
  assert.equal(internal.length, 1);
  report.internalPublicationAdmission = {exactFlags: internal[0].exact_flags, exactMembership: internal[0].exact_membership};
  assert.equal(internal[0].exact_flags, true);
  assert.equal(internal[0].exact_membership, true);
  verifyUncertified(warmed);
  // All certificates, application publication entries, schemas, program/source
  // digests and function metadata must be byte-identical across initialization.
  assert.equal(hashJson({...warmed, publications: installed.publications, publication_tables: installed.publication_tables}), hashJson(installed));
  installed = warmed;
  report.initializationAdmittedBeforeFirstMessage = true;
}

function psql(args, input) {
  // Both wrappers reject connection overrides before IO. Diagnostics stay in memory.
  return execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-q', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '-v', 'ECHO=none', '-v', 'VERBOSITY=sqlstate', ...args], {
    input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000,
    maxBuffer: 524288, killSignal: 'SIGKILL', env: {...env, PSQL_HISTORY: '/dev/null',
      PGAPPNAME: 'uskoci-chat-b3c-wire-' + process.pid,
      PGOPTIONS: '-c statement_timeout=30000 -c lock_timeout=5000'},
  });
}
function rejectOrdinaryInvocation() {
  for (const args of [[], ['-c', "set uskoci.chat_b3c_disposable_proof='UNREVIEWED_MODE'"]]) {
    let denied = false;
    try { psql([...args, '-f', resolve(candidatePath)]); }
    catch (error) {
      denied = error?.status !== 0 && /ERROR:\s+55000(?:\s|$)/.test(String(error?.stderr ?? ''));
    }
    assert.equal(denied, true);
    assert.equal(hashJson(certificates()), hashJson(baseline));
  }
}
function installEphemeralFixture() {
  // This psql driver does not rewrite or strip candidate bytes. \ir executes the
  // committed exact file. Connection admission precedes any application SQL.
  const candidate = resolve(candidatePath).replaceAll('\\', '/');
  assert.ok(!/[\r\n']/.test(candidate));
  const driver = `select :'HOST'='127.0.0.1' and :'PORT'='54322'
    and :'DBNAME'='postgres' and current_user='postgres' as local_target
\\gset
\\if :local_target
\\else
  \\quit 3
\\endif
begin;
set local uskoci.chat_b3c_disposable_proof='LOCAL_ONLY_EPHEMERAL_REALTIME';
\\ir '${candidate}'
notify pgrst,'reload schema';
commit;
select 'CHAT_B3C_EPHEMERAL_UNCERTIFIED_COMMITTED';
`;
  const output = psql(['-f', '-'], driver);
  assert.equal(output.split(/\r?\n/).filter(line => line === 'CHAT_B3C_EPHEMERAL_UNCERTIFIED_COMMITTED').length, 1);
  report.fixtureCommitted = true;
  installed = certificates();
  report.installedSurfaceComparisons = surfaceComparisons(installed);
  verifyUncertified(installed);
}

async function session(actor) {
  const result = await bounded(actor.client.auth.getSession());
  assert.equal(result.error, null);
  const token = result.data.session?.access_token;
  assert.equal(typeof token, 'string');
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(claims.sub, actor.id);
  assert.equal(claims.role, 'authenticated');
  assert.match(claims.session_id, uuidPattern);
  assert.ok(Number.isFinite(claims.exp) && claims.exp * 1000 > Date.now() + 300000);
  assert.equal(rt.sql(`select private.push_session_valid(${rt.q(actor.id)},${rt.q(claims.session_id)})`), 't');
  return {token, id: claims.session_id, claims};
}
async function agreement(requester, worker, label) {
  const profile = (actor, kind) => {
    const values = rt.rows(`select id from public.app_profiles where account_id=${rt.q(actor.id)} and kind=${rt.q(kind)}`);
    assert.equal(values.length, 1);
    assert.match(values[0].id, uuidPattern);
    return values[0].id;
  };
  const requesterProfile = profile(requester, 'REQUESTER');
  const workerProfile = profile(worker, 'WORKER');
  rt.sql(`update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${rt.q(workerProfile)}`);
  await bounded(rt.ok(worker.client.rpc('rpc_complete_worker_profile', {p_profile_id: workerProfile})));
  const needId = randomUUID();
  rt.sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
    values(${rt.q(needId)},${rt.q(requester.id)},${rt.q(requesterProfile)},'PUBLISHED',${rt.q(label)},
      'Disposable B3c websocket proof','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',
      statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
  const offer = await bounded(rt.ok(worker.client.rpc('rpc_submit_response', {
    p_need_id: needId, p_need_revision: 1, p_worker_profile_id: workerProfile,
    p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: null, p_proposed_end_at: null,
    p_scope_note: null, p_client_request_id: randomUUID(),
  })));
  const id = await bounded(rt.ok(requester.client.rpc('rpc_select_response', {
    p_need_id: needId, p_need_revision: offer.needRevision, p_response_id: offer.responseId,
    p_response_version: offer.version, p_content_hash: offer.contentHash, p_client_request_id: randomUUID(),
  })));
  assert.match(id, uuidPattern);
  return id;
}

function eventKey(agreementId, revision) { return agreementId + '/' + revision; }
function rejectWire(observer, kind) {
  wireFault = true;
  report.wireFailure ??= {observer: observer.index, kind};
}
function acceptEvent(observer, payload) {
  observer.receivedCallbacks++;
  let admission = 'SCHEMA_AND_TABLE';
  try {
    assert.equal(payload.schema, 'public');
    assert.equal(payload.table, 'agreement_invalidations_v1');
    admission = 'EVENT_TYPE_INSERT_OR_UPDATE';
    assert.ok(['INSERT', 'UPDATE'].includes(payload.eventType)); // Any DELETE is a leak.
    admission = 'SERVER_ERRORS_EMPTY';
    assert.ok(!payload.errors || payload.errors.length === 0);
    admission = 'COMMIT_TIMESTAMP_VALID';
    assert.ok(Number.isFinite(Date.parse(payload.commit_timestamp)));
    admission = 'NEW_EXACT_BODY_FREE_KEYS';
    assert.deepEqual(Object.keys(payload.new).sort(), ['agreement_id', 'revision']);
    admission = 'POSITIVE_AGREEMENT_MEMBERSHIP';
    assert.equal(payload.new.agreement_id, observer.agreementId); // No client filter used.
    admission = 'NEW_REVISION_POSITIVE_SAFE_INTEGER';
    assert.ok(Number.isSafeInteger(payload.new.revision) && payload.new.revision > 0);
    admission = 'OLD_RECORD_OBJECT';
    assert.ok(payload.old && typeof payload.old === 'object' && !Array.isArray(payload.old));
    const oldKeys = Object.keys(payload.old ?? {});
    admission = 'OLD_BODY_FREE_KEYS';
    assert.ok(oldKeys.every(key => key === 'agreement_id' || key === 'revision'));
    admission = 'OLD_AGREEMENT_MEMBERSHIP';
    if (oldKeys.includes('agreement_id')) assert.equal(payload.old.agreement_id, observer.agreementId);
    admission = 'OLD_REVISION_SAFE_INTEGER';
    if (oldKeys.includes('revision')) assert.ok(Number.isSafeInteger(payload.old.revision));
    const key = eventKey(payload.new.agreement_id, payload.new.revision);
    admission = 'REVOKED_SESSION_EVENT_DENIED';
    assert.equal(observer.denyAll, false);
    admission = 'FORBIDDEN_EVENT_REVISION_DENIED';
    assert.equal(observer.denied.has(key), false);
    admission = 'CALLBACK_COUNT_BOUND';
    observer.count++;
    assert.ok(observer.count <= 100);
    // Retain only the validated body-free witness, never the complete payload.
    observer.seen.set(key, payload.eventType);
  } catch { rejectWire(observer, admission); }
}
async function observe(actor, actorSession, agreementId) {
  const observer = {agreementId, count: 0, seen: new Map(), denied: new Set(), denyAll: false,
    status: 'CONNECTING', heartbeats: 0, receivedCallbacks: 0, index: observers.length + 1,
    postgresReady: false, accountId: actor.id, sessionId: actorSession.id, actualClaims: actorSession.claims};
  observers.push(observer);
  // This callback freezes a real issued JWT. A manual setAuth alone would be
  // overwritten by SupabaseClient's accessToken callback on later heartbeats.
  observer.client = createClient(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_ANON_KEY, {
    accessToken: async () => actorSession.token,
    realtime: {logger: () => {}, heartbeatIntervalMs: 60000, heartbeatCallback: status => {
      if (status === 'ok') observer.heartbeats++;
      if (!shuttingDown && ['error', 'timeout'].includes(status)) rejectWire(observer, 'HEARTBEAT_FAILED');
    }},
  });
  // Complete real-token admission before creating the channel join payload.
  await bounded(observer.client.realtime.setAuth(actorSession.token));
  observer.channel = observer.client.channel('b3c-wire-' + randomUUID()).on('postgres_changes', {
    event: '*', schema: 'public', table: 'agreement_invalidations_v1',
  }, payload => acceptEvent(observer, payload)).on('system', {}, payload => {
    // Pinned Realtime v2.129.3 sends this only AFTER its SQL subscription insert.
    // Ignore free-text message/channel fields, which may contain private values.
    if (payload?.extension === 'postgres_changes') {
      if (payload.status === 'ok') observer.postgresReady = true;
      else if (payload.status === 'error') rejectWire(observer, 'POSTGRES_REGISTRATION_SYSTEM_ERROR');
    }
  });
  // PostgreSQL row policies authorize this stream. Do not invent private
  // broadcast admission or use a client Agreement filter as an authorization test.
  observer.channel.subscribe(status => {
    observer.status = ['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) ? status : 'OTHER';
    if (!shuttingDown && observer.status !== 'SUBSCRIBED') rejectWire(observer, 'CHANNEL_' + observer.status);
  }, 15000);
  await waitFor(() => observer.status === 'SUBSCRIBED');
  assert.equal(actor.id.length, 36);
  return observer;
}
function revision(id) {
  const values = rt.rows(`select revision from public.agreement_invalidations_v1 where agreement_id=${rt.q(id)}`);
  return values.length ? Number(values[0].revision) : 0;
}
async function authenticatedCacheDiagnostics(id, expectedRevision) {
  report.firstMessageAuthenticatedReads = [];
  for (const observer of observers) {
    const expectedVisible = observer.agreementId === id;
    const diagnostic = {observer: observer.index, expectedVisible};
    report.firstMessageAuthenticatedReads.push(diagnostic);
    // Actual issued JWT through the HTTP Data API; no service client and no body.
    const result = await bounded(observer.client.from('agreement_invalidations_v1')
      .select('agreement_id,revision').eq('agreement_id', id));
    diagnostic.httpAccepted = !result.error;
    diagnostic.httpStatus = Number.isInteger(result.status) && result.status >= 100 && result.status <= 599 ? result.status : null;
    if (result.error) diagnostic.httpCode = safeRpcCode(result.error.code);
    diagnostic.httpExpectedVisibility = !result.error && Array.isArray(result.data) && (expectedVisible
      ? result.data.length === 1 && result.data[0].agreement_id === id && Number(result.data[0].revision) === expectedRevision
      : result.data.length === 0);
    // Independently reproduce Realtime's JSON-only claim context using the same
    // actual issued claims. Unlike the old SQL proof, do NOT set legacy singular
    // request.jwt.claim.sub/role GUCs. No claims or row identities leave memory.
    const output = psql([], `begin;
      do $claims$ begin perform set_config('request.jwt.claims',${rt.q(JSON.stringify(observer.actualClaims))},true);end $claims$;
      set local role authenticated;
      select json_build_object(
        'uidMatches',coalesce(auth.uid()=${rt.q(observer.accountId)}::uuid,false),
        'roleMatches',auth.role()='authenticated',
        'sessionClaimMatches',auth.jwt()->>'session_id'=${rt.q(observer.sessionId)},
        'expectedVisibility',(select count(*) from public.agreement_invalidations_v1
          where agreement_id=${rt.q(id)} and revision=${expectedRevision})=${expectedVisible ? 1 : 0});
      rollback;`);
    diagnostic.jsonOnlyClaims = JSON.parse(output.trim());
  }
}
async function send(actor, id, receivers) {
  operation = 'SEND_READ_CACHE_REVISION_BEFORE';
  const attempt = {ordinal: report.messageAttempts.length + 1,
    agreementScope: id === fixture.main ? 'MAIN' : 'FOREIGN',
    phase: operation, expectedReceivers: receivers.length,
    callbacksAtStart: observers.reduce((total, observer) => total + observer.receivedCallbacks, 0)};
  report.messageAttempts.push(attempt);
  const next = revision(id) + 1;
  attempt.expectedRevision = Number.isSafeInteger(next) && next <= 100 ? next : null;
  const clientId = randomUUID();
  const body = 'Disposable B3c known message ' + randomUUID();
  operation = attempt.phase = 'SEND_CANONICAL_RPC';
  const result = await bounded(actor.client.rpc('rpc_send_agreement_message_v2', {
    p_expected_user_id: actor.id, p_agreement_id: id, p_client_message_id: clientId, p_body: body,
  }));
  attempt.rpcAccepted = !result.error;
  attempt.rpcStatus = Number.isInteger(result.status) && result.status >= 100 && result.status <= 599 ? result.status : null;
  if (result.error) attempt.rpcCode = safeRpcCode(result.error.code);
  assert.equal(attempt.rpcAccepted, true);
  const messageId = result.data;
  operation = attempt.phase = 'SEND_VALIDATE_RETURNED_MESSAGE_ID';
  attempt.returnedMessageIdValid = typeof messageId === 'string' && uuidPattern.test(messageId);
  assert.match(messageId, uuidPattern);
  operation = attempt.phase = 'SEND_VERIFY_CACHE_ADVANCEMENT';
  const actualRevision = revision(id);
  attempt.cacheRevisionAfter = Number.isSafeInteger(actualRevision) && actualRevision <= 100 ? actualRevision : null;
  attempt.cacheAdvancedAsExpected = actualRevision === next;
  assert.equal(actualRevision, next);
  operation = attempt.phase = 'SEND_VERIFY_CANONICAL_MESSAGE_PERSISTED';
  const persisted = rt.sql(`select exists(select 1 from public.agreement_messages
    where id=${rt.q(messageId)} and agreement_id=${rt.q(id)}
      and client_message_id=${rt.q(clientId)} and body=${rt.q(body)})`);
  attempt.canonicalMessagePersisted = persisted === 't';
  assert.equal(persisted, 't');
  lastMessageWal = rt.sql('select pg_current_wal_lsn()::text');
  assert.match(lastMessageWal, /^[0-9A-F]+\/[0-9A-F]+$/);
  if (attempt.ordinal === 1) {
    operation = attempt.phase = 'SEND_DIAGNOSE_ACTUAL_AUTHENTICATED_CACHE_READS';
    await authenticatedCacheDiagnostics(id, next);
  }
  const key = eventKey(id, next);
  operation = attempt.phase = 'SEND_WAIT_POSITIVE_RECEIVER_WITNESSES';
  await waitFor(() => {
    attempt.positiveReceiverWitnesses = receivers.filter(observer => observer.seen.get(key) === (next === 1 ? 'INSERT' : 'UPDATE')).length;
    attempt.callbacksObserved = observers.reduce((total, observer) => total + observer.receivedCallbacks, 0) - attempt.callbacksAtStart;
    return attempt.positiveReceiverWitnesses === receivers.length;
  });
  attempt.phase = 'KNOWN_MESSAGE_WITNESSED';
  report.knownMessageWatermarks++;
  return next;
}
async function heartbeatBarrier() {
  operation = 'HEARTBEAT_SOCKET_ADMISSION';
  // After an ordered known-message witness, require each negative observer's
  // existing socket to answer a fresh heartbeat. A disconnected or timed-out
  // observer never earns an absence assertion. This remains a finite proof.
  const before = observers.map(observer => observer.heartbeats);
  for (const observer of observers) {
    assert.equal(observer.status, 'SUBSCRIBED');
    assert.equal(observer.client.realtime.isConnected(), true);
    await observer.client.realtime.sendHeartbeat();
  }
  operation = 'HEARTBEAT_WAIT_FRESH_ACKNOWLEDGEMENTS';
  await waitFor(() => observers.every((observer, index) => observer.heartbeats > before[index]));
  report.heartbeatBarriers++;
}

try {
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  assert.equal(env.DB_URL, env.RU5_DEVICE_DB_URL);
  for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) assert.equal(env[key], undefined);
  assert.equal(env.PRE_V3_ARTIFACT_DIR, '/tmp/chat-b3c-private');
  assert.equal(env.B3C_ARTIFACT_DIR, '/tmp/chat-b3c-artifacts');
  assert.equal(env.RU5_DEVICE_PROOF_DIR, '/tmp/uskoci-ru5-device-ui');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
  outputDirectory = env.B3C_ARTIFACT_DIR;
  report.sourceSha = env.GITHUB_SHA;
  stage = 'EXACT_SOURCE_AND_ROLLBACK_PROOF';
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), env.GITHUB_SHA);
  report.sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {encoding: 'utf8'}).trim();
  for (const path of [candidatePath, harnessPath, workflowPath,
    'supabase/proofs/chat/private_invalidation_proof.mjs',
    'supabase/proofs/chat/chat_b3c_private_invalidation_proof.sql',
    'supabase/proofs/pre_v3/closure_runtime.mjs', 'supabase/proofs/ru5_device_ui_local_guard.mjs']) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', env.GITHUB_SHA + ':' + path]));
    report.sourceArtifactHashes[path] = sha256(bytes);
  }
  const previous = JSON.parse(readFileSync(outputDirectory + '/chat-b3c-report.json', 'utf8'));
  assert.equal(previous.result, 'PASS');
  assert.equal(previous.sourceSha, env.GITHUB_SHA);
  assert.equal(previous.sourceArtifactHashes[candidatePath], report.sourceArtifactHashes[candidatePath]);
  for (const key of ['actualAuth', 'actualDatabase', 'sqlAuthenticatedRoles', 'sqlRollbackMarker', 'disposableOnly']) assert.equal(previous[key], true);
  for (const key of ['liveAccess', 'providerCalled', 'certificateMoved', 'incomingStreamProven', 'deploymentReady']) assert.equal(previous[key], false);
  assert.deepEqual(previous.rollback, {checked: true, catalogUnchanged: true, fixtureStateUnchanged: true});
  assert.equal(previous.catalogBeforeSha256, previous.catalogAfterSha256);
  assert.equal(previous.checks.length, 5);
  assert.ok(previous.checks.every(check => check.result === 'PASS'));
  pass('EXACT_SOURCE_AND_SUCCESSFUL_SQL_ROLLBACK_PREDECESSOR');
  operation = 'VERIFY_PINNED_LOCAL_REALTIME_IMAGE';
  const realtimeImages = execFileSync('docker', ['ps', '--filter', 'name=supabase_realtime', '--format', '{{.Image}}'],
    {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000}).trim().split(/\r?\n/).filter(Boolean);
  assert.equal(realtimeImages.length, 1);
  assert.match(realtimeImages[0], /^(?:[a-z0-9.:-]+\/)?supabase\/realtime:v2\.129\.3$/);
  report.actualRealtimeImageMatchesPinnedSource = true;
  rt = await import('../pre_v3/closure_runtime.mjs');
  ({createClient} = await import('@supabase/supabase-js'));
  stage = 'CERTIFIED_PREDECESSOR_AND_ORDINARY_REFUSAL';
  baseline = certificates();
  report.actualDatabase = true;
  assert.equal(baseline.candidate_present, false);
  assert.equal(baseline.ready, true);
  assert.equal(baseline.digest, baseline.source.sha256);
  assert.equal(baseline.digest, baseline.erasure.sha256);
  assert.equal(baseline.digest, baseline.binding.sourceSha256);
  rejectOrdinaryInvocation();
  pass('MISSING_AND_UNKNOWN_ADMISSION_REFUSED_WITHOUT_CATALOG_CHANGE');

  stage = 'FOUR_ACTORS_AND_TWO_DISJOINT_AGREEMENTS';
  for (const name of ['requester', 'worker', 'stranger', 'foreign-worker']) authActors.push(await bounded(rt.actor('b3c-wire-' + name)));
  const [requester, worker, stranger, foreignWorker] = authActors;
  assert.equal(new Set(authActors.map(actor => actor.id)).size, 4);
  const sessions = actorSessions = await Promise.all(authActors.map(session));
  fixture = {main: await agreement(requester, worker, 'B3c wire main'),
    foreign: await agreement(stranger, foreignWorker, 'B3c wire unrelated')};
  assert.notEqual(fixture.main, fixture.foreign);
  assert.equal(hashJson(certificates()), hashJson(baseline));
  report.actualAuth = true;
  report.fixtureCounts = {actors: 4, agreements: 2, admittedSessions: 4};
  stage = 'COMMITTED_UNCERTIFIED_LOOPBACK_FIXTURE';
  installEphemeralFixture();
  pass('COMMITTED_FIXTURE_WITH_UNCHANGED_CERTIFICATES_AND_FALSE_READINESS');
  stage = 'REAL_AUTHENTICATED_SUBSCRIPTIONS';
  const [requesterView, workerView, strangerView, foreignView] = await Promise.all(authActors.map((actor, index) =>
    observe(actor, sessions[index], index < 2 ? fixture.main : fixture.foreign)));
  await admitRealtimeInitialization();
  pass('FOUR_REAL_AUTHENTICATED_UNFILTERED_POSTGRES_SUBSCRIPTIONS');

  stage = 'PARTICIPANTS_INSERT_UPDATE_AND_STRANGER_EXCLUSION';
  await send(worker, fixture.main, [requesterView, workerView]);
  await send(foreignWorker, fixture.foreign, [strangerView, foreignView]);
  await send(worker, fixture.main, [requesterView, workerView]);
  await send(foreignWorker, fixture.foreign, [strangerView, foreignView]);
  await heartbeatBarrier();
  pass('BODY_FREE_INSERT_UPDATE_AND_TWO_WAY_MEMBERSHIP_EXCLUSION');

  stage = 'EXPIRED_SESSION_ON_EXISTING_SOCKET';
  const expiredRevision = revision(fixture.main) + 1;
  requesterView.denied.add(eventKey(fixture.main, expiredRevision));
  assert.equal(rt.sql(`select not_after is null from auth.sessions where id=${rt.q(sessions[0].id)}`), 't');
  rt.sql(`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=${rt.q(sessions[0].id)}`);
  assert.equal(rt.sql(`select private.push_session_valid(${rt.q(requester.id)},${rt.q(sessions[0].id)})`), 'f');
  await send(worker, fixture.main, [workerView]);
  await send(foreignWorker, fixture.foreign, [strangerView, foreignView]);
  await heartbeatBarrier();
  rt.sql(`update auth.sessions set not_after=null where id=${rt.q(sessions[0].id)}`);
  await send(worker, fixture.main, [requesterView, workerView]);
  await heartbeatBarrier();
  pass('EXPIRED_SESSION_DENIED_BETWEEN_POSITIVE_MESSAGE_WATERMARKS');

  stage = 'REVOKED_SESSION_ON_EXISTING_SOCKET';
  const requesterCount = requesterView.count;
  requesterView.denyAll = true;
  rt.sql(`delete from auth.sessions where id=${rt.q(sessions[0].id)}`);
  assert.equal(rt.sql(`select private.push_session_valid(${rt.q(requester.id)},${rt.q(sessions[0].id)})`), 'f');
  await send(worker, fixture.main, [workerView]);
  await send(foreignWorker, fixture.foreign, [strangerView, foreignView]);
  await heartbeatBarrier();
  assert.equal(requesterView.count, requesterCount);
  pass('REVOKED_SESSION_DENIED_AFTER_KNOWN_MESSAGE_AND_SOCKET_WITNESSES');

  stage = 'CLOSURE_PER_EVENT_AUTHORIZATION';
  const closedRevision = revision(fixture.foreign) + 1;
  for (const observer of [strangerView, foreignView]) observer.denied.add(eventKey(fixture.foreign, closedRevision));
  // The writer suppresses invalidations for closing parties. An explicitly
  // owner-only body-free update is required to test RLS on an actual WAL event;
  // a rejected send or absent cache change alone is not a wire-denial witness.
  rt.sql(`begin;
    insert into private.account_closure_requests(account_id,state,revision) values(${rt.q(foreignWorker.id)},'READY',1);
    update public.agreement_invalidations_v1 set revision=revision+1 where agreement_id=${rt.q(fixture.foreign)};
    commit;`);
  assert.equal(revision(fixture.foreign), closedRevision);
  const deniedSend = await bounded(foreignWorker.client.rpc('rpc_send_agreement_message_v2', {
    p_expected_user_id: foreignWorker.id, p_agreement_id: fixture.foreign,
    p_client_message_id: randomUUID(), p_body: 'Disposable closure refusal fixture',
  }));
  assert.equal(deniedSend.error?.code, '42501');
  assert.equal(revision(fixture.foreign), closedRevision);
  await send(worker, fixture.main, [workerView]);
  await heartbeatBarrier();
  // Restore only the disposable admission fixture, never run the uncertified
  // erasure engine. The later known message also detects delayed forbidden rows.
  rt.sql(`delete from private.account_closure_requests where account_id=${rt.q(foreignWorker.id)}`);
  await send(foreignWorker, fixture.foreign, [strangerView, foreignView]);
  await heartbeatBarrier();
  pass('CLOSING_PARTY_AND_COUNTERPART_DENIED_FOR_AN_ACTUAL_BODY_FREE_EVENT');

  stage = 'CANONICAL_LIFECYCLE_DELETE_NONLEAK';
  await bounded(rt.ok(worker.client.rpc('rpc_cancel_agreement', {
    p_agreement_id: fixture.main, p_reason: 'Disposable B3c lifecycle wire proof',
  })));
  assert.equal(revision(fixture.main), 0);
  await send(foreignWorker, fixture.foreign, [strangerView, foreignView]);
  await heartbeatBarrier();
  assert.equal(requesterView.count, requesterCount);
  assert.equal(wireFault, false);
  pass('CANONICAL_CACHE_DELETE_NOT_PUBLISHED_WITH_LATER_MESSAGE_WITNESS');
  report.incomingStreamProven = true;
} catch (error) { fail(error); }
finally {
  const originalStage = stage;
  if (report.fixtureCommitted && actorSessions) {
    try {
      report.finalRegistrationState = subscriptionRegistrations();
      report.replicationAfterLastMessage = replicationState(lastMessageWal);
    } catch (error) { report.replicationDiagnosticFailure = errorKind(error); }
  }
  report.observersBeforeClose = observers.map(observer => ({
    observer: observer.index, status: observer.status,
    postgresReady: observer.postgresReady,
    connected: observer.client?.realtime.isConnected() === true,
    callbacksReceived: Math.min(observer.receivedCallbacks, 1000),
    bodyFreeEventsValidated: Math.min(observer.count, 100),
    heartbeatAcknowledgements: Math.min(observer.heartbeats, 1000),
  }));
  stage = 'CLOSE_ALL_CHANNELS';
  operation = 'UNSUBSCRIBE_AND_DISCONNECT';
  shuttingDown = true;
  try {
    const closed = await Promise.allSettled(observers.map(async observer => {
      try {
        if (observer.channel) assert.equal(await bounded(observer.client.removeChannel(observer.channel), 3000, true), 'ok');
      } finally {
        if (observer.client) await bounded(observer.client.realtime.disconnect(), 3000, true);
      }
    }));
    assert.ok(closed.every(result => result.status === 'fulfilled'));
    report.channelsClosed = true;
  } catch (error) {
    fail(error);
  }
  // No raw client errors, JWTs, IDs, message bodies, URLs or service responses
  // enter this report. The workflow separately records actual stack teardown.
  if (baseline) {
    stage = 'FINAL_CERTIFICATE_AND_UNCERTIFIED_SURFACE_CHECK';
    try {
      const after = certificates();
      report.certificateMoved = certificateIdentity(after) !== certificateIdentity(baseline);
      report.finalSurfaceComparisons = surfaceComparisons(after);
      if (installed) report.finalPublicationDelta = publicationDelta(installed, after);
      report.finalReadiness = after.ready;
      report.certificateIdentitySha256 = certificateIdentity(after);
      // Whitelisted snapshot field names only; no values, relation identities,
      // function definitions or publication contents enter failure diagnostics.
      if (installed) report.changedSnapshotFields = [
        'source', 'erasure', 'readiness_definition', 'digest', 'schema_digest',
        'erasure_program_digest', 'ready', 'binding', 'publications',
        'publication_tables', 'invalidation_function_metadata', 'candidate_present',
      ].filter(key => hashJson(after[key]) !== hashJson(installed[key]));
      operation = 'ASSERT_CERTIFICATE_IDENTITY_UNCHANGED';
      assert.equal(report.certificateMoved, false);
      if (after.candidate_present) {
        verifyUncertified(after);
        operation = 'ASSERT_COMPLETE_INSTALLED_SNAPSHOT_UNCHANGED';
        if (installed) assert.equal(hashJson(after), hashJson(installed));
      } else {
        operation = 'ASSERT_COMPLETE_BASELINE_SNAPSHOT_UNCHANGED';
        assert.equal(hashJson(after), hashJson(baseline));
      }
      pass('FINAL_CERTIFICATES_READINESS_DEFINITION_AND_SURFACE_UNCHANGED');
    } catch (error) { fail(error); }
  }
  stage = originalStage;
  report.validatedBodyFreeEvents = observers.reduce((total, observer) => total + observer.count, 0);
  if (!report.failureStage && !wireFault && report.incomingStreamProven && report.channelsClosed
    && report.fixtureCommitted && report.certificateMoved === false && report.finalReadiness === false) report.result = 'PASS';
  else { report.incomingStreamProven = false; process.exitCode = 1; }
  if (outputDirectory) {
    try { writeFileSync(outputDirectory + '/chat-b3c-realtime-report.json', JSON.stringify(report, null, 2) + '\n'); }
    catch { process.exitCode = 1; console.error('FAIL CHAT_B3C_REALTIME_REPORT_WRITE'); }
  }
  console.log(report.result + ' CHAT_B3C_PRIVATE_INVALIDATION_REALTIME');
}
