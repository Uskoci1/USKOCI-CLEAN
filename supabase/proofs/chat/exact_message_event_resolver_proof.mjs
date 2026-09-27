// P4 SOURCE ONLY / NOT RUN. Dedicated loopback fixture, never a DEV replay.
// Prerequisite: unchanged B3 predecessor workflow through A1, B3a and B3b.
// A future dedicated runner must always tear down its complete disposable stack.
// This harness restores the full catalog by removing only its additive RPC even
// on failure. It never rebinds certificates; fixture rows remain until teardown.
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {migrationSnapshotQuery} from '../pre_v3/history_snapshot.mjs';

const env = process.env;
const signature = 'public.rpc_resolve_activity_message_v1(uuid,uuid)';
const candidatePath = 'supabase/candidates/chat_p4_exact_message_event_resolver.sql';
const harnessPath = 'supabase/proofs/chat/exact_message_event_resolver_proof.mjs';
const surfacePath = 'supabase/proofs/pkg023/pkg023_surface.sql';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const digest = value => createHash('sha256').update(value).digest('hex');
const jsonDigest = value => digest(JSON.stringify(value));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {unit: 'CHAT_P4_EXACT_MESSAGE_EVENT_RESOLVER', result: 'FAIL', checks: [],
  actualAuth: false, actualDatabase: false, liveAccess: false, providerCalls: 0,
  storageCalls: 0, deviceProven: false, clientWired: false, pushTransportProven: false,
  certificateMoved: null, sourceArtifactHashes: {}, catalogRestored: false};
let rt, baseline, outputDirectory, stage = 'LOCAL_TARGET_ADMISSION';
const originalConsole = {log: console.log, warn: console.warn, error: console.error};
const pass = name => report.checks.push({name, result: 'PASS'});

function catalog() {
  return {
    state: rt.rows(`select private.closure_source_digest_v5() digest,
      (select to_jsonb(c) from private.closure_source_v5 c where singleton) certificate,
      (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure,
      private.retention_ai_source_ready() ready, private.closure_erasure_binding_v5() binding,
      pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness_definition,
      (select jsonb_agg(to_jsonb(c) order by c.data_class) from private.closure_dataset_catalog_v5 c) datasets,
      (select jsonb_agg(to_jsonb(p) order by p.pubname) from pg_publication p) publications,
      (select jsonb_agg(to_jsonb(p) order by p.pubname,p.schemaname,p.tablename) from pg_publication_tables p) publication_tables,
      (select jsonb_agg(jsonb_build_array(p.oid,md5(to_jsonb(p)::text)) order by p.oid)
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in('public','private','rls_private')
          and p.oid is distinct from to_regprocedure(${rt.q(signature)})) other_function_metadata,
      (select jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relreplident) order by c.oid)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in('public','private','rls_private') and c.relkind in('r','p')) table_authority`)[0],
    surface: rt.sql(readFileSync(surfacePath, 'utf8')).split('\n').filter(Boolean),
    history: rt.rows(migrationSnapshotQuery()),
  };
}

function unchangedReadState() {
  // Only hashes are compared in memory; neither rows, identifiers nor content
  // enter an uploaded artifact. Read_at is included in each full-row hash.
  return Object.fromEntries(['agreement_messages', 'user_activity_events',
    'notification_deliveries', 'notification_push_attempts'].map(name => [name,
    rt.sql(`select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'[]')) from public.${name} r`)]));
}

async function readOnlyCall(actor, eventId, expected = actor.id) {
  const before = unchangedReadState();
  const response = await actor.client.rpc('rpc_resolve_activity_message_v1', {
    p_expected_user_id: expected, p_event_id: eventId,
  }).abortSignal(AbortSignal.timeout(10000));
  assert.deepEqual(unchangedReadState(), before);
  return response;
}

async function unavailable(actor, eventId) {
  const response = await readOnlyCall(actor, eventId);
  assert.equal(response.error, null);
  assert.deepEqual(response.data, {schema: 'ACTIVITY_MESSAGE_TARGET_V1', accountId: actor.id,
    kind: 'UNAVAILABLE', authoritative: true});
}

async function target(actor, eventId, agreementId, messageId, role) {
  const response = await readOnlyCall(actor, eventId);
  assert.equal(response.error, null);
  assert.deepEqual(response.data, {schema: 'ACTIVITY_MESSAGE_TARGET_V1', accountId: actor.id,
    kind: 'AGREEMENT_MESSAGE', eventId, agreementId, messageId, role, authoritative: true});
  return response.data;
}

async function denied(actor, eventId, expected, code = '28000') {
  const response = await readOnlyCall(actor, eventId, expected);
  assert.ok(response.error);
  assert.equal(response.data, null);
  assert.equal(response.error.code, code);
}

async function changed(statement, restore, check) {
  rt.sql(statement);
  try { await check(); } finally { rt.sql(restore); }
}

async function agreement(requester, worker) {
  const {rows, sql, q, ok} = rt;
  const profile = (actor, kind) => rows(`select id from public.app_profiles
    where account_id=${q(actor.id)} and kind=${q(kind)}`)[0].id;
  const rp = profile(requester, 'REQUESTER'), wp = profile(worker, 'WORKER');
  sql(`update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${q(wp)}`);
  await ok(worker.client.rpc('rpc_complete_worker_profile', {p_profile_id: wp}));
  const needId = randomUUID();
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
    values(${q(needId)},${q(requester.id)},${q(rp)},'PUBLISHED','P4 disposable task','Resolver proof',
      'PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
  const offer = await ok(worker.client.rpc('rpc_submit_response', {
    p_need_id: needId, p_need_revision: 1, p_worker_profile_id: wp, p_covered_slots: 1,
    p_price_rsd: 3000, p_proposed_start_at: null, p_proposed_end_at: null,
    p_scope_note: null, p_client_request_id: randomUUID(),
  }));
  return ok(requester.client.rpc('rpc_select_response', {
    p_need_id: needId, p_need_revision: offer.needRevision, p_response_id: offer.responseId,
    p_response_version: offer.version, p_content_hash: offer.contentHash, p_client_request_id: randomUUID(),
  }));
}

async function currentSession(actor) {
  const result = await actor.client.auth.getSession();
  assert.equal(result.error, null);
  const session = result.data.session;
  assert.ok(session?.access_token);
  const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(claims.sub, actor.id); assert.equal(claims.role, 'authenticated');
  assert.match(claims.session_id, uuidPattern);
  assert.equal(rt.sql(`select private.push_session_valid(${rt.q(actor.id)},${rt.q(claims.session_id)})`), 't');
  return {session, id: claims.session_id};
}

try {
  // No clients, filesystem output or queries precede independent local admission.
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  assert.equal(env.DB_URL, env.RU5_DEVICE_DB_URL);
  for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) assert.equal(env[key], undefined);
  assert.equal(env.PRE_V3_ARTIFACT_DIR, '/tmp/chat-p4-private');
  assert.equal(env.P4_ARTIFACT_DIR, '/tmp/chat-p4-artifacts');
  assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
  outputDirectory = env.P4_ARTIFACT_DIR;
  mkdirSync(outputDirectory, {recursive: true});
  report.sourceSha = env.GITHUB_SHA;
  stage = 'EXACT_SOURCE_AND_PREDECESSOR_REPORTS';
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), env.GITHUB_SHA);
  report.sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {encoding: 'utf8'}).trim();
  for (const path of [candidatePath, harnessPath, surfacePath,
    '.github/workflows/chat-p4-exact-message-proof.yml',
    'supabase/proofs/pre_v3/closure_runtime.mjs', 'supabase/proofs/pre_v3/history_snapshot.mjs',
    'supabase/proofs/ru5_device_ui_local_guard.mjs']) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', env.GITHUB_SHA + ':' + path]));
    report.sourceArtifactHashes[path] = digest(bytes);
  }
  for (const file of ['chat-b3-a1-preparation.json', 'chat-b3a-report.json', 'chat-b3b-report.json']) {
    const prior = JSON.parse(readFileSync(env.PRE_V3_ARTIFACT_DIR + '/' + file, 'utf8'));
    assert.equal(prior.result, 'PASS'); assert.equal(prior.sourceSha, env.GITHUB_SHA);
    assert.equal(prior.actualAuth, true); assert.equal(prior.actualDatabase, true);
    assert.equal(prior.liveAccess, false); assert.equal(prior.providerCalled, false);
    assert.equal(prior.providerCalls, 0); assert.equal(prior.storageCalls, 0);
    assert.ok(prior.checks.length > 0 && prior.checks.every(check => check.result === 'PASS'));
  }
  pass('EXACT_COMMIT_BYTES_AND_ADMITTED_B3_PREDECESSOR');
  // Shared runtime errors can contain SQL/claims. They remain private in memory.
  console.log = console.warn = console.error = () => {};
  rt = await import('../pre_v3/closure_runtime.mjs');
  const {sql, rows, q, ok} = rt;
  stage = 'CERTIFIED_CATALOG_BASELINE';
  assert.equal(sql(`select to_regprocedure(${q(signature)}) is null`), 't');
  baseline = catalog(); report.actualDatabase = true;
  assert.equal(baseline.state.ready, true);
  assert.equal(baseline.state.digest, baseline.state.certificate.sha256);
  assert.equal(baseline.state.digest, baseline.state.erasure.sha256);
  assert.equal(baseline.state.digest, baseline.state.binding.sourceSha256);
  report.catalogBeforeSha256 = jsonDigest(baseline);
  const candidate = readFileSync(candidatePath, 'utf8');
  const intact = () => assert.deepEqual(catalog(), baseline);
  stage = 'CANDIDATE_MUTATION_GATES';
  const post = 'do $post$';
  for (const [source, expected] of [
    [candidate.replace('66773994698c60b9fab919f2a9fda93a', '0'.repeat(32)), /CHAT_P4_PREDECESSOR_DRIFT/],
    [candidate.replace("'messageId',target_message", "'messageId', target_message"), /CHAT_P4_FUNCTION_MISMATCH/],
    ...['parallel safe', 'security invoker', 'set search_path=public', 'strict'].map(change =>
      [candidate.replace(post, `alter function ${signature} ${change};\n${post}`), /CHAT_P4_FUNCTION_MISMATCH/]),
    [candidate.replace(post, `grant execute on function ${signature} to anon;\n${post}`), /CHAT_P4_FUNCTION_MISMATCH/],
  ]) {
    assert.notEqual(source, candidate);
    assert.throws(() => sql(source), expected); intact();
  }
  pass('BODY_AUTHORITY_METADATA_MUTATIONS_REFUSE_AND_ROLL_BACK');
  stage = 'INSTALL_ONE_ADDITIVE_RPC';
  sql(candidate);
  assert.throws(() => sql(candidate), /CHAT_P4_ALREADY_APPLIED/);
  const installed = catalog();
  assert.deepEqual(installed.state, baseline.state); assert.deepEqual(installed.history, baseline.history);
  assert.deepEqual(baseline.surface.filter(line => !installed.surface.includes(line)), []);
  const added = installed.surface.filter(line => !baseline.surface.includes(line));
  assert.equal(added.length, 1);
  assert.ok(added[0].startsWith('function:public.rpc_resolve_activity_message_v1('));
  pass('ONE_ADDITIVE_RPC_NO_CERTIFICATE_SCHEMA_PUBLICATION_OR_EXISTING_FUNCTION_CHANGE');

  stage = 'FOUR_REAL_AUTH_ACTORS_TWO_DISJOINT_AGREEMENTS';
  const requester = await rt.actor('p4-requester'), worker = await rt.actor('p4-worker');
  const stranger = await rt.actor('p4-stranger'), foreignWorker = await rt.actor('p4-foreign-worker');
  const actors = [requester, worker, stranger, foreignWorker];
  actors.forEach(actor => assert.match(actor.id, uuidPattern));
  assert.equal(new Set(actors.map(actor => actor.id)).size, 4);
  const sessions = await Promise.all(actors.map(currentSession));
  const agreementId = await agreement(requester, worker), foreignAgreementId = await agreement(stranger, foreignWorker);
  assert.notEqual(agreementId, foreignAgreementId); report.actualAuth = true;
  report.fixtureCounts = {actors: 4, agreements: 2, admittedSessions: 4};
  // Wait for the notified REST schema, not for an assumed fixed delay. Only the
  // documented missing-function code is retryable; other failures stay failures.
  stage = 'REST_SCHEMA_ADMISSION';
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await readOnlyCall(requester, randomUUID());
    if (!result.error) { assert.equal(result.data.kind, 'UNAVAILABLE'); ready = true; break; }
    assert.equal(result.error.code, 'PGRST202'); await pause(100);
  }
  assert.equal(ready, true);
  const send = (actor, id = agreementId) => ok(actor.client.rpc('rpc_send_agreement_message_v2', {
    p_expected_user_id: actor.id, p_agreement_id: id, p_client_message_id: randomUUID(), p_body: 'Disposable exact target',
  }));
  const eventFor = messageId => {
    const events = rows(`select id,recipient_user_id,recipient_role,entity_version,payload,dedupe_key
      from public.user_activity_events where dedupe_key=${q('agreement_message:' + messageId)}`);
    assert.equal(events.length, 1); assert.match(events[0].id, uuidPattern); return events[0];
  };
  const messageId = await send(worker), ownMessageId = await send(requester);
  const foreignMessageId = await send(foreignWorker, foreignAgreementId);
  const event = eventFor(messageId), ownEvent = eventFor(ownMessageId), foreignEvent = eventFor(foreignMessageId);
  assert.equal(event.recipient_user_id, requester.id); assert.equal(ownEvent.recipient_user_id, worker.id);
  stage = 'EXACT_TEXT_TARGETS_BOTH_DIRECTIONS_AND_FOREIGN_EXCLUSION';
  await target(requester, event.id, agreementId, messageId, 'REQUESTER');
  await target(worker, ownEvent.id, agreementId, ownMessageId, 'WORKER');
  await target(stranger, foreignEvent.id, foreignAgreementId, foreignMessageId, 'REQUESTER');
  await unavailable(worker, event.id); await unavailable(stranger, event.id);
  await unavailable(requester, foreignEvent.id); await unavailable(requester, randomUUID());
  await unavailable(requester, null);
  await denied(requester, event.id, worker.id);
  await denied(requester, event.id, null);
  for (const client of [rt.anon, rt.service]) {
    const response = await readOnlyCall({client, id: requester.id}, event.id);
    assert.ok(response.error); assert.equal(response.data, null);
  }
  pass('CANONICAL_TEXT_TARGETS_FOREIGN_UNKNOWN_EXPECTED_ACCOUNT_ANON_SERVICE_REFUSALS');

  stage = 'CANONICAL_LINKAGE_CORRUPTION_REFUSALS';
  const eventWhere = `where id=${q(event.id)}`;
  for (const [assignment, restore] of [
    [`recipient_user_id=${q(stranger.id)}`, `recipient_user_id=${q(requester.id)}`],
    ["recipient_role='WORKER'", "recipient_role='REQUESTER'"],
    ["event_type='EXECUTION_STATE_CHANGED'", "event_type='MESSAGE_RECEIVED'"],
    ["entity_type='NEED'", "entity_type='AGREEMENT'"],
    [`entity_id=${q(foreignAgreementId)}`, `entity_id=${q(agreementId)}`],
    [`entity_version=${event.entity_version + 1}`, `entity_version=${event.entity_version}`],
    [`dedupe_key=${q('proof:' + randomUUID())}`, `dedupe_key=${q(event.dedupe_key)}`],
    ...[{}, {message_id: 42}, {message_id: 'invalid'}, {message_id: randomUUID()},
      {message_id: foreignMessageId}, {message_id: ownMessageId}].map(payload =>
      [`payload=${q(JSON.stringify(payload))}::jsonb`, `payload=${q(JSON.stringify(event.payload))}::jsonb`]),
  ]) await changed(`update public.user_activity_events set ${assignment} ${eventWhere}`,
    `update public.user_activity_events set ${restore} ${eventWhere}`, () => unavailable(requester, event.id));
  // Payload and dedupe together still cannot turn an outgoing/foreign message
  // into an incoming one. Use the existing event's unique key only after moving
  // the competing fixture event aside; restore it in the same transaction.
  for (const wrong of [ownMessageId, foreignMessageId]) {
    const wrongEvent = wrong === ownMessageId ? ownEvent : foreignEvent;
    const moved = 'proof:' + randomUUID();
    await changed(`begin;update public.user_activity_events set dedupe_key=${q(moved)} where id=${q(wrongEvent.id)};
      update public.notification_deliveries set dedupe_key=${q(moved + ':in_app')} where event_id=${q(wrongEvent.id)} and channel='IN_APP';
      update public.user_activity_events set dedupe_key=${q('agreement_message:' + wrong)},payload=jsonb_build_object('message_id',${q(wrong)}::text) ${eventWhere};
      update public.notification_deliveries set dedupe_key=${q('agreement_message:' + wrong + ':in_app')} where event_id=${q(event.id)} and channel='IN_APP';commit;`,
    `begin;update public.user_activity_events set dedupe_key=${q(event.dedupe_key)},payload=${q(JSON.stringify(event.payload))}::jsonb ${eventWhere};
      update public.notification_deliveries set dedupe_key=${q(event.dedupe_key + ':in_app')} where event_id=${q(event.id)} and channel='IN_APP';
      update public.user_activity_events set dedupe_key=${q(wrongEvent.dedupe_key)} where id=${q(wrongEvent.id)};
      update public.notification_deliveries set dedupe_key=${q(wrongEvent.dedupe_key + ':in_app')} where event_id=${q(wrongEvent.id)} and channel='IN_APP';commit;`,
    () => unavailable(requester, event.id));
  }
  await changed(`begin;update public.user_activity_events set recipient_user_id=${q(stranger.id)} ${eventWhere};
    update public.notification_deliveries set recipient_user_id=${q(stranger.id)} where event_id=${q(event.id)} and channel='IN_APP';commit;`,
    `begin;update public.user_activity_events set recipient_user_id=${q(requester.id)} ${eventWhere};
    update public.notification_deliveries set recipient_user_id=${q(requester.id)} where event_id=${q(event.id)} and channel='IN_APP';commit;`,
    () => unavailable(stranger, event.id));
  await target(requester, event.id, agreementId, messageId, 'REQUESTER');
  pass('EVENT_ROLE_TYPE_VERSION_CANONICAL_DEDUPE_PAYLOAD_SENDER_AND_AGREEMENT_LINKS');

  stage = 'SYNTHETIC_DELIVERY_STATE_LINK_AND_EXPIRY_MATRIX';
  const deliveries = rows(`select * from public.notification_deliveries where event_id=${q(event.id)} and channel='IN_APP'`);
  assert.equal(deliveries.length, 1); const delivery = deliveries[0];
  assert.equal(delivery.state, 'CREATED'); assert.equal(delivery.suppression_reason, null);
  const deliveryWhere = `where id=${q(delivery.id)}`;
  // Synthetic policy matrix only: these SQL mutations do not claim that the
  // current IN_APP writer or ACK canonically produces every admitted state.
  for (const state of ['CREATED', 'SENT', 'DELIVERED', 'READ', 'QUEUED', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'EXPIRED', 'SUPPRESSED']) {
    const allowed = ['CREATED', 'SENT', 'DELIVERED', 'READ', 'EXPIRED'].includes(state);
    await changed(`update public.notification_deliveries set state=${q(state)},suppression_reason=${state === 'SUPPRESSED' ? "'IN_APP_OFF'" : 'null'} ${deliveryWhere}`,
      `update public.notification_deliveries set state='CREATED',suppression_reason=null ${deliveryWhere}`,
      () => allowed ? target(requester, event.id, agreementId, messageId, 'REQUESTER') : unavailable(requester, event.id));
  }
  for (const [assignment, restore] of [
    ["suppression_reason='IN_APP_OFF'", 'suppression_reason=null'],
    [`recipient_user_id=${q(stranger.id)}`, `recipient_user_id=${q(requester.id)}`],
    ["recipient_role='WORKER'", "recipient_role='REQUESTER'"],
    [`event_id=${q(ownEvent.id)}`, `event_id=${q(event.id)}`],
    ["channel='PUSH'", "channel='IN_APP'"],
    [`dedupe_key=${q('proof:' + randomUUID())}`, `dedupe_key=${q(delivery.dedupe_key)}`],
  ]) await changed(`update public.notification_deliveries set ${assignment} ${deliveryWhere}`,
    `update public.notification_deliveries set ${restore} ${deliveryWhere}`, () => unavailable(requester, event.id));
  for (const state of ['CREATED', 'EXPIRED']) {
    for (const expiry of ["clock_timestamp()-interval '1 second'", "clock_timestamp()+interval '1 hour'"]) {
      await changed(`update public.notification_deliveries set state=${q(state)},expires_at=${expiry} ${deliveryWhere}`,
        `update public.notification_deliveries set state='CREATED',expires_at=null ${deliveryWhere}`,
        () => target(requester, event.id, agreementId, messageId, 'REQUESTER'));
    }
    await changed(`update public.notification_deliveries set state=${q(state)},suppression_reason='IN_APP_OFF' ${deliveryWhere}`,
      `update public.notification_deliveries set state='CREATED',suppression_reason=null ${deliveryWhere}`,
      () => unavailable(requester, event.id));
  }
  pass('SYNTHETIC_NINE_STATE_ALLOWLIST_EXPIRED_HISTORY_LINK_AND_SUPPRESSION_MATRIX');

  stage = 'OLD_EQUAL_TIME_TARGET_B3B_CHAIN_AND_LATER_ARRIVAL';
  sql(`insert into public.agreement_messages(id,agreement_id,agreement_version,sender_account_id,body,created_at)
    select gen_random_uuid(),${q(agreementId)},1,${q(worker.id)},'Disposable later fixture',
      (select created_at from public.agreement_messages where id=${q(messageId)})+interval '1 microsecond'
    from generate_series(1,121)`);
  sql(`update public.agreement_messages set created_at=(select created_at from public.agreement_messages where id=${q(messageId)})
    where id=${q(ownMessageId)}`);
  const linked = await target(requester, event.id, agreementId, messageId, 'REQUESTER');
  const beforeWindow = unchangedReadState();
  const window = await ok(requester.client.rpc('rpc_read_agreement_message_window_v1', {
    p_expected_user_id: requester.id, p_agreement_id: linked.agreementId,
    p_target_message_id: linked.messageId, p_before_count: 0, p_after_count: 0,
  }));
  assert.equal(window.targetMessageId, messageId); assert.equal(window.messages.length, 1);
  assert.equal(window.messages[0].messageId, messageId); assert.deepEqual(unchangedReadState(), beforeWindow);
  await send(worker); await target(requester, event.id, agreementId, messageId, 'REQUESTER');
  pass('OLDER_THAN_LATEST_PAGE_EQUAL_TIMESTAMPS_LATER_ARRIVAL_AND_EXACT_B3B_WINDOW');

  stage = 'PHOTO_EVENT_BODY_FREE_TARGET_NO_STORAGE_IO';
  const assetId = randomUUID(), outputHash = 'b'.repeat(64);
  sql(`insert into private.agreement_photo_uploads_v5(id,account_id,agreement_id,agreement_version,client_request_id,state,
    input_sha256,input_bytes,input_type,admitted_at,sanitized_sha256,storage_path,width,height,byte_size,dispatch_state,dispatch_outcome)
    values(${q(assetId)},${q(worker.id)},${q(agreementId)},1,${q(randomUUID())},'READY',${q('a'.repeat(64))},12,'image/jpeg',clock_timestamp(),
      ${q(outputHash)},${q(worker.id + '/agreement-v5/' + assetId + '/' + outputHash + '.jpg')},10,10,12,'SETTLED','STORED')`);
  const photo = await ok(worker.client.rpc('rpc_send_agreement_photo_message_v5', {
    p_expected_user_id: worker.id, p_agreement_id: agreementId, p_expected_version: 1,
    p_client_message_id: randomUUID(), p_body: '', p_asset_ids: [assetId],
  }));
  const photoEvent = eventFor(photo.messageId);
  await target(requester, photoEvent.id, agreementId, photo.messageId, 'REQUESTER');
  pass('CANONICAL_PHOTO_EVENT_RETURNS_ONLY_THE_EXACT_TARGET_ALLOWLIST');

  stage = 'DELETED_EXACT_MESSAGE_DOES_NOT_FALL_BACK';
  const removedMessage = await send(worker), removedEvent = eventFor(removedMessage);
  sql(`delete from public.agreement_messages where id=${q(removedMessage)}`);
  await unavailable(requester, removedEvent.id);
  await target(requester, event.id, agreementId, messageId, 'REQUESTER');
  pass('MISSING_EXACT_MESSAGE_UNAVAILABLE_WITH_OTHER_HISTORY_PRESENT');

  stage = 'CANONICAL_HISTORY_ACK_RPC';
  // Canonical flow, independent of the synthetic matrix: ACK changes e.read_at,
  // never delivery.state. Cancellation then expires both read and unread IN_APP
  // deliveries. Neither transition removes the event's exact historical target.
  const beforeAck = unchangedReadState();
  const ack = await ok(requester.client.rpc('rpc_mark_displayed_agreement_messages_v1', {
    p_expected_user_id: requester.id, p_agreement_id: agreementId, p_message_ids: [messageId],
  }));
  stage = 'CANONICAL_HISTORY_ACK_RECEIPT_AND_READ_STATE';
  assert.deepEqual(ack, {schema: 'AGREEMENT_MESSAGE_READ_V1', accountId: requester.id, agreementId,
    displayedMessageIds: [messageId], markedEventCount: 1, authoritative: true});
  const afterAck = unchangedReadState();
  assert.notEqual(afterAck.user_activity_events, beforeAck.user_activity_events);
  for (const name of ['agreement_messages', 'notification_deliveries', 'notification_push_attempts']) {
    assert.equal(afterAck[name], beforeAck[name]);
  }
  const readAt = rows(`select read_at from public.user_activity_events ${eventWhere}`)[0].read_at;
  assert.ok(readAt);
  assert.equal(rows(`select read_at from public.user_activity_events where id=${q(photoEvent.id)}`)[0].read_at, null);
  const photoDeliveryWhere = `where event_id=${q(photoEvent.id)} and channel='IN_APP'`;
  assert.equal(sql(`select state from public.notification_deliveries ${deliveryWhere}`), 'CREATED');
  assert.equal(sql(`select state from public.notification_deliveries ${photoDeliveryWhere}`), 'CREATED');
  stage = 'CANONICAL_HISTORY_READ_TEXT_TARGET_BEFORE_CANCEL';
  await target(requester, event.id, agreementId, messageId, 'REQUESTER');
  stage = 'CANONICAL_HISTORY_CANCEL_RPC';
  await ok(requester.client.rpc('rpc_cancel_agreement', {p_agreement_id: agreementId, p_reason: 'Disposable P4 history proof'}));
  stage = 'CANONICAL_HISTORY_CANCELLED_AND_EXPIRED_DELIVERY_STATE';
  assert.equal(sql(`select status from public.agreements where id=${q(agreementId)}`), 'CANCELLED');
  assert.equal(sql(`select state from public.notification_deliveries ${deliveryWhere}`), 'EXPIRED');
  assert.equal(sql(`select state from public.notification_deliveries ${photoDeliveryWhere}`), 'EXPIRED');
  const beforeHistory = unchangedReadState();
  stage = 'CANONICAL_HISTORY_INBOX_RPC';
  const inbox = await ok(requester.client.rpc('rpc_list_inbox', {
    p_role: 'REQUESTER', p_limit: 100, p_before_at: null, p_before_id: null,
  }));
  for (const [historicalEvent, historicalMessage, kind] of [
    [event.id, messageId, 'TEXT'], [photoEvent.id, photo.messageId, 'PHOTO'],
  ]) {
    stage = kind === 'TEXT' ? 'CANONICAL_HISTORY_TEXT_INBOX_VISIBILITY' : 'CANONICAL_HISTORY_PHOTO_INBOX_VISIBILITY';
    assert.ok(inbox.items.some(item => item.id === historicalEvent));
    stage = kind === 'TEXT' ? 'CANONICAL_HISTORY_TEXT_EXACT_TARGET' : 'CANONICAL_HISTORY_PHOTO_EXACT_TARGET';
    const exact = await target(requester, historicalEvent, agreementId, historicalMessage, 'REQUESTER');
    stage = kind === 'TEXT' ? 'CANONICAL_HISTORY_TEXT_B3B_WINDOW' : 'CANONICAL_HISTORY_PHOTO_B3B_WINDOW';
    const historicalWindow = await ok(requester.client.rpc('rpc_read_agreement_message_window_v1', {
      p_expected_user_id: requester.id, p_agreement_id: exact.agreementId,
      p_target_message_id: exact.messageId, p_before_count: 0, p_after_count: 0,
    }));
    assert.equal(historicalWindow.targetMessageId, historicalMessage);
    assert.equal(historicalWindow.messages.length, 1);
    assert.equal(historicalWindow.messages[0].messageId, historicalMessage);
    assert.equal(historicalWindow.messages[0].kind, kind);
    if (kind === 'PHOTO') assert.equal(historicalWindow.messages[0].photos[0].assetId, assetId);
  }
  stage = 'CANONICAL_HISTORY_READ_STATE_UNCHANGED';
  assert.deepEqual(unchangedReadState(), beforeHistory);
  assert.equal(rows(`select read_at from public.user_activity_events ${eventWhere}`)[0].read_at, readAt);
  assert.equal(rows(`select read_at from public.user_activity_events where id=${q(photoEvent.id)}`)[0].read_at, null);
  pass('CANONICAL_ACK_THEN_CANCEL_INBOX_EXPIRED_READ_TEXT_UNREAD_PHOTO_EXACT_B3B_WINDOWS');
  stage = 'HISTORICAL_TARGET_BOTH_ACCOUNT_CLOSURE_FENCES';
  for (const actor of [requester, worker]) {
    stage = actor === requester ? 'HISTORICAL_TARGET_CALLER_CLOSURE_FENCE' : 'HISTORICAL_TARGET_COUNTERPART_CLOSURE_FENCE';
    await changed(`insert into private.account_closure_requests(account_id,state,revision) values(${q(actor.id)},'READY',1)`,
      `delete from private.account_closure_requests where account_id=${q(actor.id)}`,
      async () => { await unavailable(requester, event.id); await unavailable(requester, photoEvent.id); });
  }
  pass('HISTORICAL_TEXT_AND_PHOTO_TARGETS_STILL_REQUIRE_BOTH_ACCOUNTS_OPEN');

  stage = 'EXPIRED_BANNED_AND_REVOKED_REAL_SESSION';
  const requesterSession = sessions[0];
  const originalExpiry = rows(`select not_after from auth.sessions where id=${q(requesterSession.id)}`)[0].not_after;
  await changed(`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=${q(requesterSession.id)}`,
    `update auth.sessions set not_after=${originalExpiry === null ? 'null' : q(originalExpiry)} where id=${q(requesterSession.id)}`,
    () => denied(requester, event.id, requester.id));
  await changed(`update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=${q(requester.id)}`,
    `update auth.users set banned_until=null where id=${q(requester.id)}`,
    () => denied(requester, event.id, requester.id));
  const retired = rt.make();
  await ok(retired.auth.setSession({access_token: requesterSession.session.access_token, refresh_token: requesterSession.session.refresh_token}));
  await ok(requester.client.auth.signOut());
  await denied({client: retired, id: requester.id}, event.id, requester.id);
  pass('EXPIRED_BANNED_AND_RETIRED_REAL_LOCAL_SESSIONS_FAIL_WITHOUT_READ_EFFECTS');
  stage = 'FINAL_UNCHANGED_CERTIFICATE_AND_SURFACE';
  assert.deepEqual(catalog(), installed);
} catch {
  // Deliberately never serialize errors: SDK/SQL/assertion messages can contain
  // supplied IDs, private rows, SQL parameters or authentication material.
  report.failureStage = stage;
} finally {
  if (baseline) {
    try {
      // Baseline proved this name absent. Also handle a connection failure just
      // after COMMIT, when the caller could not observe successful installation.
      rt.sql(`drop function if exists ${signature};notify pgrst,'reload schema';`);
      const finalCatalog = catalog();
      report.certificateMoved = jsonDigest([finalCatalog.state.certificate, finalCatalog.state.erasure])
        !== jsonDigest([baseline.state.certificate, baseline.state.erasure]);
      report.catalogRestored = jsonDigest(finalCatalog) === jsonDigest(baseline);
      report.catalogAfterSha256 = jsonDigest(finalCatalog);
      assert.equal(report.certificateMoved, false); assert.equal(report.catalogRestored, true);
      assert.equal(rt.sql(`select to_regprocedure(${rt.q(signature)}) is null`), 't');
      pass('INDEPENDENT_CONNECTION_FULL_CATALOG_AND_CERTIFICATE_RESTORED');
    } catch { report.cleanupFailed = true; }
  }
  Object.assign(console, originalConsole);
  if (!report.failureStage && !report.cleanupFailed && report.catalogRestored) report.result = 'PASS';
  else process.exitCode = 1;
  if (outputDirectory) {
    try { writeFileSync(outputDirectory + '/chat-p4-exact-message-report.json', JSON.stringify(report, null, 2) + '\n'); }
    catch { process.exitCode = 1; report.result = 'FAIL'; }
  }
  process.stdout.write(report.result + ' CHAT_P4_EXACT_MESSAGE_EVENT_RESOLVER' + (report.failureStage ? ' ' + report.failureStage : '') + '\n');
}
