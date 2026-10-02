// EX05-S01 UPDATED COPY - text chat on the POST-B24, POST-VOICE-B1 disposable chain. Disposable local Auth / PostgREST / Postgres only: no provider, no Storage, no DEV, no device.
// Frozen originals (NOT edited, kept as history): supabase/proofs/notifications/d03_message_retry_proof.mjs (stable client message id, 40001) and supabase/proofs/pkg050/pkg050_proof.mjs
// (broad mark-read). WHY a copy: the d03 proof applies its own forward file at history 85 and asserts SQLSTATE 40001 at five sites (lines 155, 156, 165, 177, 182); on a chain that carries
// B24 the same call answers PT409 (HTTP 409), and the original cannot run there at all (it applies the candidate it proves). THE DIFF against the originals, all of it:
//   * no apply, no predecessor, no history-count assertion (the chain is already post-everything); accounts come from rt.actor, not from the RU5 device fixture;
//   * 40001 -> PT409 (code AND message AND HTTP 409 through the real PostgREST) at every conflict site, and the psql stderr check of the held-lock case reads PT409, never 40001;
//   * the two lifecycle lock-order checks (message-first / completion-first) are NOT copied: Voice B1 and B24 did not touch the lifecycle writers and the originals still prove them at
//     their position; replaced by one non-concurrent terminal check (replay acknowledges the original, a new message is refused);
//   * added: the B3c invalidation cache counts text and photo inserts and is visible to the parties only; the broad mark-read of pkg050 on the final chain.
// Every check runs even after an earlier one failed (lib/runner.mjs), so one CI run reports every broken assertion. Source: lib/*.mjs are unit-tested offline.
import {execFile} from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createProofHarness, assertChainFacts, CHAIN_FACTS_SQL} from './lib/harness.mjs';
import {expectConflictResult, expectErrorResult} from './lib/runner.mjs';
import {createFixtures, commandKey, UUID_PATTERN} from './lib/fixtures.mjs';
import {SQL} from './lib/sql_snippets.mjs';

const {assert, sql, rows, q, ok, anon, service, env, randomUUID} = rt;
const SOURCES = ['supabase/proofs/ex05_s01/ex05_s01_text_proof.mjs', 'supabase/proofs/ex05_s01/lib/runner.mjs', 'supabase/proofs/ex05_s01/lib/harness.mjs',
  'supabase/proofs/ex05_s01/lib/fixtures.mjs', 'supabase/proofs/ex05_s01/lib/sql_snippets.mjs', 'supabase/proofs/pre_v3/closure_runtime.mjs'];
const h = createProofHarness({rt, unit: 'EX05_S01_TEXT', reportName: 'ex05-s01-text-report.json', sources: SOURCES});
const fx = createFixtures(rt);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

await h.sourceCheck();
if (!(await h.requireChain('CHAIN_IS_THE_POST_B24_POST_VOICE_STATE', async () => assertChainFacts(JSON.parse(sql(CHAIN_FACTS_SQL)))))) process.exit(h.finish());
h.beginCatalogGuard();

let party, agreementId, otherAgreementId, requester, worker, stranger;
const FIXTURE = 'FIXTURE_THREE_REAL_ACCOUNTS_TWO_REAL_AGREEMENTS';
await h.check(FIXTURE, async () => {
  party = await fx.prepareParty('ex05-text'); ({requester, worker, stranger} = party);
  agreementId = await fx.agreementOf(party, 'EX05-S01 text one');
  otherAgreementId = await fx.agreementOf(party, 'EX05-S01 text two');
  assert.match(agreementId, UUID_PATTERN); assert.notEqual(agreementId, otherAgreementId);
});
const REQ = {requires: [FIXTURE]};
const send = (who, id, key, body, expected = who.id) => fx.sendText(who, id, key, body, expected);
const counts = () => rows(SQL.messageCounts())[0];
const grew = (before, n) => assert.deepEqual(counts(), {messages: before.messages + n, message_events: before.message_events + n, message_deliveries: before.message_deliveries + n * 2});
const snapshot = () => sql(SQL.readStateDigest());
const lastUuid = text => { const found = text.split(/\r?\n/).filter(line => UUID_PATTERN.test(line)); assert.ok(found.length > 0, 'NO_UUID_IN_PSQL_OUTPUT'); return found.at(-1); };

await h.check('SEND_WRITES_ONE_MESSAGE_ONE_BODY_FREE_EVENT_AND_TWO_DELIVERIES', async () => {
  const before = counts(), body = 'EX05_PRIVATE_BODY_ONE';
  const id = await ok(send(worker, agreementId, commandKey('first'), '  ' + body + '  '));
  assert.match(id, UUID_PATTERN); grew(before, 1);
  assert.equal(sql('select body from public.agreement_messages where id=' + q(id)), body, 'the stored body is the trimmed text');
  const event = fx.eventOf(id);
  assert.equal(event.recipient_user_id, requester.id); assert.equal(event.recipient_role, 'REQUESTER'); assert.deepEqual(event.payload, {message_id: id});
  assert.ok(!JSON.stringify(event).includes(body), 'the event is body-free');
  const inApp = fx.deliveryOf(event.id, 'IN_APP'), push = fx.deliveryOf(event.id, 'PUSH');
  assert.equal(inApp.state, 'CREATED'); assert.equal(inApp.suppression_reason, null);
  assert.equal(push.state, 'SUPPRESSED'); assert.equal(push.suppression_reason, 'PUSH_OFF', 'no preference row anywhere: push defaults to off');
  assert.ok(!JSON.stringify(rows('select title,body from public.notification_deliveries where event_id=' + q(event.id))).includes('EX05_PRIVATE'), 'no delivery text carries the message');
}, REQ);

await h.check('SAME_COMMAND_REPLAYS_THE_ORIGINAL_UUID_AND_THE_KEY_IS_SENDER_GLOBAL', async () => {
  const before = counts(), key = commandKey('retry');
  const id = await ok(send(requester, agreementId, key, '  EX05_PRIVATE_SAME_COMMAND  '));
  const after = snapshot();
  assert.equal(await ok(send(requester, agreementId, key, 'EX05_PRIVATE_SAME_COMMAND')), id);
  assert.equal(snapshot(), after, 'a replay writes nothing: no row, no event, no delivery'); grew(before, 1);
  const counterpart = await ok(send(worker, agreementId, key, 'EX05_PRIVATE_COUNTERPART'));
  assert.notEqual(counterpart, id, 'the same key text from the other participant is another command'); grew(before, 2);
  assert.equal(await ok(send(worker, agreementId, key, 'EX05_PRIVATE_COUNTERPART')), counterpart);
  const event = rows(SQL.eventOfMessage(id));
  assert.equal(event.length, 1); assert.equal(event[0].recipient_user_id, worker.id);
}, REQ);

await h.check('CHANGED_BODY_OR_AGREEMENT_FOR_THE_SAME_KEY_IS_PT409_NEVER_40001', async () => {
  const key = commandKey('conflict'), id = await ok(send(requester, agreementId, key, 'EX05_PRIVATE_SAME'));
  const stable = snapshot();
  expectConflictResult(await send(requester, agreementId, key, 'EX05_PRIVATE_DIFFERENT'), 'MESSAGE_COMMAND_CONFLICT');
  expectConflictResult(await send(requester, otherAgreementId, key, 'EX05_PRIVATE_SAME'), 'MESSAGE_COMMAND_CONFLICT');
  assert.equal(snapshot(), stable, 'a conflict writes nothing');
  assert.equal(await ok(send(requester, agreementId, key, 'EX05_PRIVATE_SAME')), id, 'the original command is still acknowledged');
}, REQ);

await h.check('AUTH_PARTY_AND_ACCOUNT_SWITCH_BOUNDARIES', async () => {
  const stable = snapshot(), refused = result => { assert.ok(result.error, 'EXPECTED_REFUSAL'); assert.ok(result.data === null || result.data === undefined); };
  refused(await send({client: anon, id: requester.id}, agreementId, commandKey('anon'), 'private'));
  refused(await send({client: service, id: requester.id}, agreementId, commandKey('service'), 'private'));
  expectErrorResult(await send(stranger, agreementId, commandKey('stranger'), 'private'), {code: '42501', message: 'NOT_PARTY'});
  for (const expected of [requester.id, null]) expectErrorResult(await send(worker, agreementId, commandKey('switch'), 'private', expected), {code: '28000', message: 'AUTH_CONTEXT_CHANGED'});
  expectErrorResult(await send(requester, randomUUID(), commandKey('absent'), 'private'), {code: 'P0002', message: 'AGREEMENT_NOT_FOUND'});
  assert.equal(snapshot(), stable);
  assert.deepEqual(await ok(stranger.client.from('agreement_messages').select('id')), [], 'a stranger reads no message row');
}, REQ);

await h.check('KEY_BODY_AND_UNICODE_BOUNDARIES_RETAIN_NO_FAILED_COMMAND', async () => {
  const stable = snapshot();
  for (const key of [null, '', 'short', 'a'.repeat(201), 'bad/key-value', 'ex05-valid-key\n', 'ex05-valid-key\r', 'ex05-valid-key ', '_ex05-key-value'])
    expectErrorResult(await send(requester, agreementId, key, 'private'), {code: '22023', message: 'INVALID_CLIENT_MESSAGE_ID'});
  for (const body of [null, '', '   ']) expectErrorResult(await send(requester, agreementId, commandKey('empty'), body), {code: 'P0001', message: 'MESSAGE_REQUIRED'});
  for (const body of ['a'.repeat(2001), '😀'.repeat(2001)]) expectErrorResult(await send(requester, agreementId, commandKey('long'), body), {code: '22001', message: 'MESSAGE_TOO_LONG'});
  for (const body of ['\0', '\uD800', '\uDC00']) assert.ok((await send(requester, agreementId, commandKey('unicode'), body)).error, 'invalid unicode must be refused');
  assert.equal(snapshot(), stable, 'a refused command is retained nowhere');
  const before = counts(), unicode = await ok(send(requester, agreementId, commandKey('uni2000'), '😀'.repeat(2000)));
  assert.match(unicode, UUID_PATTERN); grew(before, 1);
  assert.equal(sql('select char_length(body) from public.agreement_messages where id=' + q(unicode)), '2000');
}, REQ);

await h.check('CONCURRENT_RETRIES_REPLAY_ONCE_AND_A_CONCURRENT_CHANGE_IS_ONE_SUCCESS_AND_ONE_PT409', async () => {
  let before = counts();
  const same = commandKey('race-same');
  const pair = await Promise.all([ok(send(requester, agreementId, same, 'EX05_PRIVATE_RACE')), ok(send(requester, agreementId, same, 'EX05_PRIVATE_RACE'))]);
  assert.equal(pair[0], pair[1]); grew(before, 1);
  before = counts();
  const different = commandKey('race-different');
  const results = await Promise.all([send(requester, agreementId, different, 'EX05_PRIVATE_LEFT'), send(requester, agreementId, different, 'EX05_PRIVATE_RIGHT')]);
  assert.equal(results.filter(result => !result.error).length, 1, 'exactly one of two different bodies for one key wins');
  expectConflictResult(results.find(result => result.error), 'MESSAGE_COMMAND_CONFLICT'); grew(before, 1);
}, REQ);

// The held-lock case runs in plain psql (no PostgREST): a holder transaction keeps the sender-global advisory lock, a waiter with the same key is OBSERVED blocked on it, and after the
// holder commits the waiter either replays the original (identical body) or is refused with PT409 (changed body). Ported from d03_message_retry_proof.mjs lines 166-185.
function asyncSql(application, query) {
  return new Promise(resolve => {
    execFile('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At', '-c',
      `set application_name=${q(application)};set statement_timeout='8s';${query}`], {encoding: 'utf8', maxBuffer: 1024 * 1024},
    (error, stdout, stderr) => resolve({success: !error, stdout, stderr}));
  });
}
async function waitActivity(application, condition) {
  for (let i = 0; i < 40; i++) {
    if (sql(`select count(*) from pg_stat_activity where application_name=${q(application)} and (${condition})`) === '1') return;
    await pause(40);
  }
  assert.fail('expected controlled transaction state was not observed');
}
async function waitAdvisoryContention(holder, waiter) {
  for (let i = 0; i < 40; i++) {
    const observed = rows(`select w.wait_event_type,w.wait_event,h.wait_event holder_wait_event,h.pid=any(pg_blocking_pids(w.pid)) blocked_by_holder,
      exists(select 1 from pg_locks l where l.pid=w.pid and l.locktype='advisory' and not l.granted) advisory_lock_pending
      from pg_stat_activity w cross join pg_stat_activity h where w.application_name=${q(waiter)} and h.application_name=${q(holder)}`)[0];
    if (observed?.wait_event_type === 'Lock' && observed.wait_event === 'advisory' && observed.holder_wait_event === 'PgSleep' && observed.blocked_by_holder && observed.advisory_lock_pending) return observed;
    await pause(40);
  }
  assert.fail('same-key waiter was not observed blocked by the holder advisory lock');
}
await h.check('HELD_ADVISORY_LOCK_WAITER_REPLAYS_OR_GETS_PT409_IN_SQL', async () => {
  for (const changedBody of [false, true]) {
    const suffix = changedBody ? 'conflict' : 'identical', key = commandKey('held-' + suffix), body = 'EX05_PRIVATE_HELD_COMMAND';
    const holder = 'ex05-key-holder-' + suffix, waiter = 'ex05-key-waiter-' + suffix, before = counts();
    const held = asyncSql(holder, SQL.authenticatedStatement(requester.id, SQL.sendV2Statement(requester.id, agreementId, key, body) + ';select pg_sleep(2)'));
    await waitActivity(holder, "wait_event='PgSleep'");
    const waiting = asyncSql(waiter, SQL.authenticatedStatement(requester.id, SQL.sendV2Statement(requester.id, agreementId, key, changedBody ? 'EX05_PRIVATE_CHANGED_COMMAND' : body)));
    await waitAdvisoryContention(holder, waiter);
    const committed = await held; assert.ok(committed.success, 'the holder commits'); const originalId = lastUuid(committed.stdout);
    const acknowledged = await waiting;
    if (changedBody) {
      assert.equal(acknowledged.success, false);
      assert.match(acknowledged.stderr, /PT409/); assert.match(acknowledged.stderr, /MESSAGE_COMMAND_CONFLICT/); assert.doesNotMatch(acknowledged.stderr, /40001/);
    } else { assert.ok(acknowledged.success); assert.equal(lastUuid(acknowledged.stdout), originalId); }
    grew(before, 1);
    assert.deepEqual(rows(SQL.messageByKey(requester.id, key)), [{id: originalId, body}]);
  }
}, REQ);

await h.check('EVENT_FAILURE_ROLLS_BACK_MESSAGE_KEY_AND_DELIVERY_THEN_RETRY_SUCCEEDS', async () => {
  const stable = snapshot(), before = counts(), key = commandKey('atomic');
  sql(SQL.faultTriggerInstall());
  try {
    assert.ok((await send(requester, agreementId, key, 'EX05_PRIVATE_ATOMIC')).error, 'the forced event failure must fail the send');
    assert.equal(snapshot(), stable, 'message, key and deliveries roll back together');
    assert.deepEqual(rows(SQL.messageByKey(requester.id, key)), []);
  } finally { sql(SQL.faultTriggerRemove()); }
  const id = await ok(send(requester, agreementId, key, 'EX05_PRIVATE_ATOMIC'));
  assert.equal(await ok(send(requester, agreementId, key, 'EX05_PRIVATE_ATOMIC')), id); grew(before, 1);
}, REQ);

await h.check('TERMINAL_AGREEMENT_REPLAYS_THE_ORIGINAL_AND_REFUSES_A_NEW_MESSAGE', async () => {
  const key = commandKey('terminal'), id = await ok(send(requester, otherAgreementId, key, 'EX05_PRIVATE_BEFORE_COMPLETION'));
  await ok(worker.client.rpc('rpc_mark_work_done', {p_agreement_id: otherAgreementId}));
  await ok(requester.client.rpc('rpc_confirm_completion', {p_agreement_id: otherAgreementId}));
  assert.equal(sql('select status from public.agreements where id=' + q(otherAgreementId)), 'COMPLETED');
  const stable = snapshot();
  assert.equal(await ok(send(requester, otherAgreementId, key, 'EX05_PRIVATE_BEFORE_COMPLETION')), id, 'a replay acknowledges the original after the Agreement became read-only');
  assert.equal(snapshot(), stable);
  expectErrorResult(await send(requester, otherAgreementId, commandKey('terminal-new'), 'new'), {code: 'P0001', message: 'CHAT_NOT_AVAILABLE'});
  assert.equal(snapshot(), stable);
}, REQ);

await h.check('LEGACY_BROAD_MARK_READ_SETTLES_ONLY_THE_CALLERS_OWN_MESSAGE_EVENTS', async () => {
  const g = await fx.agreementOf(party, 'EX05-S01 legacy mark read');
  await ok(send(requester, g, commandKey('l1'), 'EX05_PRIVATE_L1')); await ok(send(worker, g, commandKey('l2'), 'EX05_PRIVATE_L2')); await ok(send(worker, g, commandKey('l3'), 'EX05_PRIVATE_L3'));
  const unread = who => sql(SQL.unreadMessageEventCount(who.id, g));
  assert.equal(unread(requester), '2'); assert.equal(unread(worker), '1');
  assert.equal(await ok(requester.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: g})), 2);
  assert.equal(unread(requester), '0'); assert.equal(unread(worker), '1', 'the other participant is untouched');
  assert.equal(await ok(requester.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: g})), 0, 'reading again settles nothing');
  const refused = await stranger.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: g});
  expectErrorResult(refused, {message: 'AGREEMENT_NOT_FOUND'});
  expectErrorResult(await requester.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: null}), {message: 'INVALID_AGREEMENT'});
  assert.ok((await anon.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: g})).error);
}, REQ);

await h.check('B3C_INVALIDATION_COUNTS_TEXT_AND_PHOTO_INSERTS_AND_IS_VISIBLE_ONLY_TO_PARTIES', async () => {
  const g = await fx.agreementOf(party, 'EX05-S01 invalidation');
  assert.deepEqual(rows(SQL.invalidationRevision(g)), [], 'no cache row exists before the first message (no backfill)');
  const key = commandKey('inv');
  await ok(send(worker, g, key, 'EX05_PRIVATE_INV_ONE'));
  assert.deepEqual(rows(SQL.invalidationRevision(g)), [{revision: 1}]);
  await ok(send(requester, g, commandKey('inv2'), 'EX05_PRIVATE_INV_TWO'));
  assert.deepEqual(rows(SQL.invalidationRevision(g)), [{revision: 2}]);
  await ok(fx.sendPhoto(worker, g, [fx.photoFixtureRow(worker, g)]));
  assert.deepEqual(rows(SQL.invalidationRevision(g)), [{revision: 3}], 'a photo message counts like a text message');
  await ok(send(worker, g, key, 'EX05_PRIVATE_INV_ONE'));
  assert.deepEqual(rows(SQL.invalidationRevision(g)), [{revision: 3}], 'a replay inserts no row and so changes nothing');
  for (const who of [requester, worker]) assert.deepEqual(await ok(who.client.from('agreement_invalidations_v1').select('agreement_id,revision').eq('agreement_id', g)), [{agreement_id: g, revision: 3}]);
  assert.deepEqual(await ok(stranger.client.from('agreement_invalidations_v1').select('agreement_id,revision').eq('agreement_id', g)), [], 'row security hides it from a stranger');
  const anonymous = await anon.from('agreement_invalidations_v1').select('agreement_id,revision').eq('agreement_id', g);
  assert.ok(anonymous.error || (Array.isArray(anonymous.data) && anonymous.data.length === 0), 'anon reads nothing');
  await ok(requester.client.rpc('rpc_cancel_agreement', {p_agreement_id: g, p_reason: 'EX05-S01 invalidation cleanup'}));
  assert.deepEqual(rows(SQL.invalidationRevision(g)), [], 'the lifecycle trigger removes the cache row when the Agreement stops being active');
}, REQ);

await h.catalogGuardCheck();
process.exitCode = h.finish();
