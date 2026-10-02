// EX05-S01 UPDATED COPY AND EXTENSION - the P4 exact-message resolver and the opaque push transport on the POST-B24, POST-VOICE-B1 disposable chain, for TEXT, PHOTO and VOICE message
// events and for a push-ON / in-app-OFF recipient. Disposable local Auth / PostgREST / Postgres / the ACTUAL Edge handler source with Expo INTERCEPTED (synthetic provider answers only):
// no provider call, no DEV, no device, no certificate move.
// Frozen originals (NOT edited, kept as history): supabase/proofs/chat/exact_message_event_resolver_proof.mjs (13 checks, run 36339724742) and
// supabase/proofs/chat/push_event_transport_proof.mjs (10 checks, run 36345502344; line 215 asserts SQLSTATE 40001 for a stale lease). WHY a copy: both install their candidate on the chain
// and restore the catalog afterwards, so neither can run on a chain where the resolver (ledger 207), the transport bridge (ledger 210), B24 and Voice B1 are ALREADY applied; the transport
// proof's 40001 assertion is wrong on DEV today (rpc_begin_push_send raises PT409, md5 fc76b344...); and neither has a photo or a voice case or an in-app-OFF recipient. THE DIFF, all of it:
//   * no install, no restore, no mutation-of-the-candidate refusals, no source-hash admission of earlier reports (the originals still run at their position in the same workflow);
//   * 40001 -> PT409 (code, message and HTTP 409): begin with a never-issued lease, begin with an expired lease, complete with a foreign lease, and the ACTUAL Edge handler failing closed
//     (HTTP 503, no provider call, the attempt stays SEND_LEASED) when the begin conflicts;
//   * added (EX05-S01 scope): the begin receipt, the Edge push copy and data, the resolver target and the B3b windows v1/v2 for a TEXT, a PHOTO and a VOICE event;
//   * added and RECORDED, never asserted (EX05 scope gap G22): a push-ON / in-app-OFF recipient: does the resolver serve the exact target, what does the displayed-ACK mark, does the exact
//     window still open. The classifier (lib/findings.mjs) names the finding; a reproduced gap is a finding for the owner, never a red build;
//   * added: the device, rotation and preference revision conflicts are PT409 through the real PostgREST.
// Every check runs even after an earlier one failed (lib/runner.mjs).
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadPushHandler} from '../notifications/n09_push_transport_runtime.mjs';
import {createProofHarness, assertChainFacts, CHAIN_FACTS_SQL} from './lib/harness.mjs';
import {expectConflictResult} from './lib/runner.mjs';
import {createFixtures, commandKey} from './lib/fixtures.mjs';
import {createVoiceFixtures} from './lib/voice_fixtures.mjs';
import {classifyInAppOffPush, FAIL_ON_UNEXPECTED} from './lib/findings.mjs';
import {SQL} from './lib/sql_snippets.mjs';

const {assert, sql, rows, q, ok, anon, service, env, randomUUID} = rt;
const SOURCES = ['supabase/proofs/ex05_s01/ex05_s01_push_proof.mjs', 'supabase/proofs/ex05_s01/lib/runner.mjs', 'supabase/proofs/ex05_s01/lib/harness.mjs',
  'supabase/proofs/ex05_s01/lib/fixtures.mjs', 'supabase/proofs/ex05_s01/lib/voice_fixtures.mjs', 'supabase/proofs/ex05_s01/lib/sql_snippets.mjs', 'supabase/proofs/ex05_s01/lib/findings.mjs',
  'supabase/proofs/notifications/n09_push_transport_runtime.mjs', 'supabase/functions/uskoci-push-transport/index.ts', 'supabase/functions/_shared/pushNotificationCopy.mjs',
  'supabase/proofs/chat/voice_m4a_fixture.mjs', 'supabase/proofs/pre_v3/closure_runtime.mjs'];
const h = createProofHarness({rt, unit: 'EX05_S01_PUSH', reportName: 'ex05-s01-push-report.json', sources: SOURCES});
const fx = createFixtures(rt);
const vf = createVoiceFixtures(rt, fx);
const BEGIN_KEYS = ['kind', 'attemptId', 'leaseId', 'leaseExpiresAt', 'expoPushToken', 'priority', 'eventType'];
const COPY = {title: 'Nova poruka u Dogovoru', body: 'Imaš novu poruku.'};
const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
const LOCAL_RPCS = ['/rest/v1/rpc/rpc_claim_push_transport', '/rest/v1/rpc/rpc_begin_push_send', '/rest/v1/rpc/rpc_complete_push_transport', '/rest/v1/rpc/rpc_record_push_readiness'];
let storageCalls = 0, syntheticProviderCalls = 0;

await h.sourceCheck();
if (!(await h.requireChain('CHAIN_IS_THE_POST_B24_POST_VOICE_STATE', async () => assertChainFacts(JSON.parse(sql(CHAIN_FACTS_SQL)))))) process.exit(h.finish());
h.beginCatalogGuard();

const rpc = (client, name, args) => ok(client.rpc(name, args).abortSignal(AbortSignal.timeout(10000)));
const raw = (client, name, args) => client.rpc(name, args).abortSignal(AbortSignal.timeout(10000));
const isolate = () => sql(SQL.isolatePushTransport()); // closes the disposable fixtures' old transport only: no network send
const inAppState = () => JSON.parse(sql(SQL.readStateInApp()));
const claim = async () => { const leased = await rpc(service, 'rpc_claim_push_transport', {p_kind: 'SEND'}); assert.equal(leased.kind, 'SEND', 'a SEND lease was expected'); return leased; };
const beginOf = value => rpc(service, 'rpc_begin_push_send', {p_attempt_id: value.attemptId, p_lease_id: value.leaseId});
const resolve = (who, eventId) => rpc(who.client, 'rpc_resolve_activity_message_v1', {p_expected_user_id: who.id, p_event_id: eventId});
const windowOf = (who, version, agreementId, messageId) => rpc(who.client, `rpc_read_agreement_message_window_${version}`,
  {p_expected_user_id: who.id, p_agreement_id: agreementId, p_target_message_id: messageId, p_before_count: 0, p_after_count: 0});

let party, requester, worker, stranger, g, device, token;
const FIXTURE = 'FIXTURE_REAL_ACCOUNTS_ONE_AGREEMENT_ONE_ACTIVE_SESSION_BOUND_SYNTHETIC_DEVICE_PUSH_ON';
await h.check(FIXTURE, async () => {
  party = await fx.prepareParty('ex05-push'); ({requester, worker, stranger} = party);
  g = await fx.agreementOf(party, 'EX05-S01 push');
  token = 'ExpoPushToken[synthetic_' + randomUUID().replaceAll('-', '') + ']';
  device = await rpc(requester.client, 'rpc_set_push_device_owned', {p_expected_user_id: requester.id, p_expo_push_token: token, p_platform: 'ANDROID', p_active: true, p_expected_revision: 0});
  assert.equal(device.sessionBound, true);
  await rt.prefs(requester.client, requester.id, 'REQUESTER', {push_enabled: true, quiet_hours_enabled: false});
});
const REQ = {requires: [FIXTURE]};

/** One message of the given kind from the worker to the requester after every older push row was closed: its event is the only CREATED push delivery. */
async function sendKind(kind) {
  isolate();
  let messageId;
  if (kind === 'TEXT') messageId = await ok(fx.sendText(worker, g, commandKey('push-text'), 'EX05_PRIVATE_PUSH_TEXT'));
  else if (kind === 'PHOTO') messageId = (await ok(fx.sendPhoto(worker, g, [fx.photoFixtureRow(worker, g)]))).messageId;
  else { const upload = await vf.fullUpload(worker, g); storageCalls += 1; messageId = (await ok(vf.sendVoice(worker, g, upload.transfer.receipt.assetId))).messageId; }
  const event = fx.eventOf(messageId);
  assert.equal(event.recipient_user_id, requester.id); assert.equal(event.recipient_role, 'REQUESTER');
  return {kind, messageId, eventId: event.id};
}
const claimed = async kind => { const item = await sendKind(kind); return {...item, leased: await claim()}; };

// The Edge handler is the ACTUAL source (n09_push_transport_runtime.mjs transpiles supabase/functions/uskoci-push-transport/index.ts); Expo is intercepted and answers synthetically;
// the four literal RPC URLs are remapped to the admitted local API (the handler keeps its strict https Supabase origin admission).
const edgeEnv = exact => key => ({SUPABASE_URL: 'https://p4-proof.supabase.co', SUPABASE_SERVICE_ROLE_KEY: env.RU5_DEVICE_SERVICE_ROLE_KEY, EXPO_PUSH_TRANSPORT_ENABLED: 'true',
  EXPO_PUSH_MESSAGE_TARGET_ENABLED: exact ? 'true' : 'false'})[key];
const edgeFetch = ({onBegin = null, expo = null} = {}) => async (address, init) => {
  if (address === EXPO_SEND) {
    const messages = JSON.parse(init.body); assert.equal(messages.length, 1);
    assert.ok(expo, 'UNEXPECTED_PROVIDER_CALL'); syntheticProviderCalls += 1; return expo(messages[0]);
  }
  const parsed = new URL(address);
  assert.equal(parsed.origin, 'https://p4-proof.supabase.co'); assert.ok(LOCAL_RPCS.includes(parsed.pathname), 'UNEXPECTED_EDGE_URL ' + parsed.pathname); assert.equal(parsed.search, '');
  if (onBegin && parsed.pathname.endsWith('rpc_begin_push_send')) onBegin(JSON.parse(init.body));
  return fetch(new URL(parsed.pathname, env.RU5_DEVICE_SUPABASE_URL), {...init, redirect: 'error'});
};
const tick = runtime => runtime.handler(new Request('https://synthetic-worker.test', {method: 'POST', headers: {apikey: env.RU5_DEVICE_SERVICE_ROLE_KEY}, body: '{"action":"tick"}'}));
const ticket = () => new Response(JSON.stringify({data: [{status: 'ok', id: 'synthetic_ticket_' + randomUUID().replaceAll('-', '')}]}));

const begun = {};
await h.check('BEGIN_RECEIPT_CARRIES_ONLY_THE_OPAQUE_EVENT_ID_FOR_TEXT_PHOTO_AND_VOICE_AND_OTHER_EVENTS_KEEP_THE_A1_SHAPE', async () => {
  for (const kind of ['TEXT', 'PHOTO', 'VOICE']) {
    const item = await claimed(kind), noRead = inAppState();
    const result = await beginOf(item.leased);
    assert.deepEqual(Object.keys(result).sort(), [...BEGIN_KEYS, 'eventId'].sort(), kind);
    assert.equal(result.eventId, item.eventId); assert.equal(result.eventType, 'MESSAGE_RECEIVED'); assert.equal(result.expoPushToken, token);
    assert.equal(result.attemptId, item.leased.attemptId); assert.equal(result.leaseId, item.leased.leaseId); assert.equal(result.leaseExpiresAt, item.leased.leaseExpiresAt);
    assert.ok(!JSON.stringify(result).includes(item.messageId) && !JSON.stringify(result).includes(g), 'no message id and no Agreement id');
    assert.deepEqual(inAppState(), noRead, 'begin has no read and no in-app effect');
    begun[kind] = {messageId: item.messageId, eventId: item.eventId};
  }
  for (const client of [anon, requester.client, stranger.client]) {
    const response = await client.rpc('rpc_begin_push_send', {p_attempt_id: randomUUID(), p_lease_id: randomUUID()});
    assert.equal(response.data, null); assert.equal(response.error?.code, '42501');
  }
  isolate();
  sql(SQL.emitExecutionEvent(requester.id, g, 'p4-push:' + randomUUID()));
  const other = await claim(), receipt = await beginOf(other);
  assert.deepEqual(Object.keys(receipt).sort(), [...BEGIN_KEYS].sort());
  assert.equal(receipt.eventType, 'EXECUTION_STATE_CHANGED'); assert.equal(Object.hasOwn(receipt, 'eventId'), false);
}, REQ);

await h.check('STALE_AND_EXPIRED_LEASES_ARE_PT409_THROUGH_REAL_POSTGREST_AND_THE_ACTUAL_EDGE_FAILS_CLOSED_WITHOUT_A_PROVIDER_CALL', async () => {
  const a = await claimed('TEXT');
  expectConflictResult(await raw(service, 'rpc_begin_push_send', {p_attempt_id: a.leased.attemptId, p_lease_id: randomUUID()}), 'PUSH_LEASE_STALE');
  sql(SQL.expireAttemptLease(a.leased.attemptId));
  expectConflictResult(await raw(service, 'rpc_begin_push_send', {p_attempt_id: a.leased.attemptId, p_lease_id: a.leased.leaseId}), 'PUSH_LEASE_STALE');
  const b = await claimed('TEXT');
  expectConflictResult(await raw(service, 'rpc_complete_push_transport', {p_attempt_id: b.leased.attemptId, p_lease_id: randomUUID(), p_result: 'FATAL', p_ticket_id: null}), 'PUSH_LEASE_STALE');
  // The ACTUAL Edge handler: the lease expires between its claim and its begin; the begin answers 409, the handler fails closed.
  await sendKind('TEXT');
  let attemptId = null, providerMessage = null;
  const runtime = loadPushHandler({env: edgeEnv(true), fetch: edgeFetch({onBegin: body => { attemptId = body.p_attempt_id; sql(SQL.expireAttemptLease(body.p_attempt_id)); }, expo: message => { providerMessage = message; return ticket(); }})});
  const response = await tick(runtime);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), {code: 'PUSH_UNAVAILABLE'});
  assert.equal(providerMessage, null, 'a conflicting begin never reaches the provider');
  assert.ok(attemptId, 'the handler reached begin');
  assert.deepEqual(rows(SQL.attemptState(attemptId)), [{transport_state: 'SEND_LEASED', send_count: 0}], 'the attempt did not advance to SEND_STARTED');
}, REQ);

await h.check('ACTUAL_EDGE_SENDS_THE_NEUTRAL_COPY_AND_THE_EXACT_TARGET_DATA_FOR_TEXT_PHOTO_AND_VOICE_AND_THE_LEGACY_DATA_WHEN_THE_FLAG_IS_OFF', async () => {
  for (const [kind, exact] of [['TEXT', false], ['TEXT', true], ['PHOTO', true], ['VOICE', true]]) {
    const item = await sendKind(kind), before = inAppState();
    let captured = null;
    const runtime = loadPushHandler({env: edgeEnv(exact), fetch: edgeFetch({expo: message => { captured = message; return ticket(); }})});
    const response = await tick(runtime);
    assert.equal(response.status, 200, kind + (exact ? ' exact' : ' legacy')); assert.equal((await response.json()).send, 'TICKET_PENDING');
    assert.deepEqual(captured, {to: token, ...COPY, data: exact ? {kind: 'INBOX', eventType: 'MESSAGE_RECEIVED', eventId: item.eventId} : {kind: 'INBOX'}, channelId: 'default', sound: 'default', priority: 'normal', ttl: 0},
      kind + (exact ? ' exact' : ' legacy'));
    assert.deepEqual(inAppState(), before, 'a transport tick has no read and no in-app effect');
  }
}, REQ);

await h.check('RESOLVER_SERVES_THE_EXACT_TARGET_FOR_TEXT_PHOTO_AND_VOICE_AND_BOTH_WINDOWS_OPEN_WITHOUT_ACKNOWLEDGING', async () => {
  for (const kind of ['TEXT', 'PHOTO', 'VOICE']) {
    const item = begun[kind]; assert.ok(item, 'the begin check recorded the ' + kind + ' message');
    const before = inAppState();
    assert.deepEqual(await resolve(requester, item.eventId), {schema: 'ACTIVITY_MESSAGE_TARGET_V1', accountId: requester.id, kind: 'AGREEMENT_MESSAGE', eventId: item.eventId,
      agreementId: g, messageId: item.messageId, role: 'REQUESTER', authoritative: true}, kind);
    for (const other of [stranger, worker]) assert.deepEqual(await resolve(other, item.eventId), {schema: 'ACTIVITY_MESSAGE_TARGET_V1', accountId: other.id, kind: 'UNAVAILABLE', authoritative: true}, kind + ' foreign');
    const v2 = await windowOf(requester, 'v2', g, item.messageId);
    assert.equal(v2.targetMessageId, item.messageId); assert.equal(v2.messages.length, 1); assert.equal(v2.messages[0].kind, kind);
    const v1 = await windowOf(requester, 'v1', g, item.messageId);
    assert.equal(v1.messages.length, 1); assert.equal(v1.messages[0].kind, kind === 'VOICE' ? 'TEXT' : kind, 'an old build shows a voice message as a text notice');
    assert.deepEqual(inAppState(), before, kind + ': resolve and both windows read without acknowledging');
  }
}, {requires: [FIXTURE, 'BEGIN_RECEIPT_CARRIES_ONLY_THE_OPAQUE_EVENT_ID_FOR_TEXT_PHOTO_AND_VOICE_AND_OTHER_EVENTS_KEEP_THE_A1_SHAPE']});

// G22 (EX05 scope): push ON, in-app OFF. emit_event creates the IN_APP delivery SUPPRESSED (IN_APP_OFF) and the PUSH delivery CREATED; the resolver and the displayed-ACK both need an IN_APP
// delivery that is not suppressed. RECORDED, not asserted: what the server actually does today.
await h.characterize('G22_PUSH_ON_IN_APP_OFF_RECIPIENT_EXACT_TARGET_AND_ACK_ARE_RECORDED', async () => {
  await rt.prefs(requester.client, requester.id, 'REQUESTER', {in_app_enabled: false, push_enabled: true, dogovor_enabled: true, quiet_hours_enabled: false});
  try {
    const item = await sendKind('TEXT');
    const inApp = fx.deliveryOf(item.eventId, 'IN_APP'), push = fx.deliveryOf(item.eventId, 'PUSH');
    const begin = push.state === 'CREATED' ? await beginOf(await claim()) : null;
    const resolver = await resolve(requester, item.eventId);
    const ack = await rpc(requester.client, 'rpc_mark_displayed_agreement_messages_v1', {p_expected_user_id: requester.id, p_agreement_id: g, p_message_ids: [item.messageId]});
    const exact = await windowOf(requester, 'v2', g, item.messageId);
    return {preferences: {inAppEnabled: false, pushEnabled: true, dogovorEnabled: true},
      inApp: {state: inApp.state, suppressionReason: inApp.suppression_reason}, push: {state: push.state, suppressionReason: push.suppression_reason},
      begin: begin === null ? null : {kind: begin.kind, eventType: begin.eventType, eventIdPresent: typeof begin.eventId === 'string'},
      resolver: {kind: resolver.kind}, ack: {markedEventCount: ack.markedEventCount},
      window: {targetMatches: exact.targetMessageId === item.messageId && exact.messages.length === 1},
      eventReadAtSet: rows(SQL.eventOfMessage(item.messageId))[0].read_at !== null};
  } finally { await rt.prefs(requester.client, requester.id, 'REQUESTER', {in_app_enabled: true, push_enabled: true}); }
}, {requires: [FIXTURE], classify: classifyInAppOffPush, failOn: FAIL_ON_UNEXPECTED});

await h.check('FOREIGN_RECIPIENT_WRONG_ROLE_DELETED_EVENT_UNKNOWN_ATTEMPT_DEVICE_SESSION_AND_PREFERENCE_REFUSE_AT_BEGIN', async () => {
  for (const change of ['recipient', 'role', 'deleted']) {
    const item = await claimed('TEXT');
    if (change === 'recipient') sql(SQL.changeEventRecipient(item.eventId, stranger.id));
    if (change === 'role') sql(SQL.changeEventRole(item.eventId, 'WORKER'));
    if (change === 'deleted') sql(SQL.deleteEvent(item.eventId));
    assert.deepEqual(await beginOf(item.leased), {kind: 'SUPPRESSED'}, change);
  }
  assert.deepEqual(await beginOf({attemptId: randomUUID(), leaseId: randomUUID()}), {kind: 'SUPPRESSED'}, 'an unknown attempt');
  for (const change of ['device', 'session', 'preference']) {
    const item = await claimed('TEXT');
    let restore;
    if (change === 'device') { sql(SQL.deactivateDevice(device.id)); restore = async () => sql(SQL.reactivateDevice(device.id)); }
    else if (change === 'session') {
      const sessionId = rows(SQL.deviceSessionId(device.id))[0].bound_session_id, notAfter = rows(SQL.sessionNotAfter(sessionId))[0].not_after;
      sql(SQL.expireSession(sessionId)); restore = async () => sql(SQL.restoreSession(sessionId, notAfter));
    } else { await rt.prefs(requester.client, requester.id, 'REQUESTER', {push_enabled: false}); restore = () => rt.prefs(requester.client, requester.id, 'REQUESTER', {push_enabled: true}); }
    try { assert.deepEqual(await beginOf(item.leased), {kind: 'SUPPRESSED'}, change); } finally { await restore(); }
  }
}, REQ);

await h.check('PUSH_DEVICE_ROTATION_AND_PREFERENCE_REVISION_CONFLICTS_ARE_PT409_WITH_HTTP_409', async () => {
  expectConflictResult(await raw(requester.client, 'rpc_set_push_device_owned', {p_expected_user_id: requester.id, p_expo_push_token: token, p_platform: 'ANDROID', p_active: true, p_expected_revision: 99}), 'PUSH_REVISION_CONFLICT');
  expectConflictResult(await raw(requester.client, 'rpc_rotate_push_device_owned', {p_expected_user_id: requester.id, p_previous_device_id: device.id, p_previous_revision: 99,
    p_expo_push_token: 'ExpoPushToken[synthetic_' + randomUUID().replaceAll('-', '') + ']', p_platform: 'ANDROID'}), 'PUSH_REVISION_CONFLICT');
  const current = await rpc(requester.client, 'rpc_get_notification_preferences', {p_expected_user_id: requester.id, p_role: 'REQUESTER'});
  expectConflictResult(await raw(requester.client, 'rpc_set_notification_preferences', {p_expected_user_id: requester.id, p_role: 'REQUESTER', p_expected_revision: current.revision + 41, p_settings: current.settings}),
    'NOTIFICATION_PREFERENCES_REVISION_CONFLICT');
  const after = await rpc(requester.client, 'rpc_get_notification_preferences', {p_expected_user_id: requester.id, p_role: 'REQUESTER'});
  assert.equal(after.revision, current.revision, 'a refused write changes nothing');
}, REQ);

h.setFlag('storageCalls', storageCalls); h.setFlag('syntheticProviderCalls', syntheticProviderCalls); h.setFlag('actualEdgeHandler', true);
await h.catalogGuardCheck();
process.exitCode = h.finish();
