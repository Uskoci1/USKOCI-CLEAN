// EX05-S01 UPDATED COPY - the bounded history (B3a), the displayed-ID acknowledgement (B3a) and the exact message window (B3b) on the POST-VOICE-B1 disposable chain. Disposable local Auth /
// PostgREST / Postgres only: no provider, no Storage, no DEV, no device.
// Frozen originals (NOT edited, kept as history): supabase/proofs/chat/private_history_read_proof.mjs (B3a, 11 checks) and supabase/proofs/chat/message_window_proof.mjs (B3b, 7 checks), run
// 36312570701 on be72a1bd (2026-09-27, chain through A1; they run again UNCHANGED at their position in the same workflow). WHY a copy: Voice B1 (ledger 215) REWROTE both V1 readers
// (rpc_read_agreement_messages_page_v1, DEV md5 7e69fba7...; rpc_read_agreement_message_window_v1, md5 706735a0..., the pre-voice pin 9ae403a4... is still in the P4 resolver candidate) so that
// a voice row reaches an old build as a TEXT notice. The originals apply the B3 candidates themselves (they cannot run on this chain) and never saw the rewritten bodies. THE DIFF, all of it:
//   * no candidate apply, no predecessor or body-drift refusal, no additive-surface check, no certificate-unchanged-by-the-candidate check;
//   * the two global full-table dumps (noReadEffects: every message, event and delivery of the database) are replaced by md5 digests of the same tables (lib/sql_snippets.mjs readStateDigest),
//     and the per-event snapshot is scoped to the fixture accounts: the chain database holds the rows of every earlier proof and a dump could exceed the 1 MiB child-process buffer;
//   * the observed-lock race of the restricted-account check is replaced by a sequential one (a READY closure request makes the pre-request guard refuse the call: ACCOUNT_CLOSING);
//   * the participant NOT NULL negative checks (assertCanonicalParticipantGuards) are not copied: they test the agreements table, which Voice B1 did not touch;
//   * B3a and B3b run on TWO separate party sets (the originals were two processes): a check of each ends by signing one account out, which would otherwise fail the later checks.
// Every check runs even after an earlier one failed (lib/runner.mjs).
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createProofHarness, assertChainFacts, CHAIN_FACTS_SQL} from './lib/harness.mjs';
import {expectErrorResult} from './lib/runner.mjs';
import {createFixtures, commandKey} from './lib/fixtures.mjs';
import {SQL} from './lib/sql_snippets.mjs';

const {assert, sql, rows, q, ok, denied, anon, randomUUID} = rt;
const SOURCES = ['supabase/proofs/ex05_s01/ex05_s01_readers_proof.mjs', 'supabase/proofs/ex05_s01/lib/runner.mjs', 'supabase/proofs/ex05_s01/lib/harness.mjs',
  'supabase/proofs/ex05_s01/lib/fixtures.mjs', 'supabase/proofs/ex05_s01/lib/sql_snippets.mjs', 'supabase/proofs/pre_v3/closure_runtime.mjs'];
const h = createProofHarness({rt, unit: 'EX05_S01_READERS', reportName: 'ex05-s01-readers-report.json', sources: SOURCES});
const fx = createFixtures(rt);
const V1_KEYS = ['messageId', 'agreementVersion', 'senderAccountId', 'clientMessageId', 'body', 'createdAt', 'kind', 'mine', 'photos'].sort();

await h.sourceCheck();
if (!(await h.requireChain('CHAIN_IS_THE_POST_B24_POST_VOICE_STATE', async () => assertChainFacts(JSON.parse(sql(CHAIN_FACTS_SQL)))))) process.exit(h.finish());
h.beginCatalogGuard();

const idsOf = page => page.messages.map(message => message.messageId);
const cursorOf = message => ({createdAt: message.createdAt, messageId: message.messageId});
const digest = () => sql(SQL.readStateDigest());
const eventRead = id => rows(`select read_at from public.user_activity_events where dedupe_key=${q('agreement_message:' + id)}`)[0]?.read_at ?? null;

// ============ B3a: bounded history and the exact displayed-ID read ============
let a, aAgreement, aOther, requester, worker, stranger;
const A_FIXTURE = 'FIXTURE_B3A_THREE_REAL_ACCOUNTS_TWO_REAL_AGREEMENTS';
await h.check(A_FIXTURE, async () => {
  a = await fx.prepareParty('ex05-readers-a'); ({requester, worker, stranger} = a);
  aAgreement = await fx.agreementOf(a, 'EX05-S01 readers history'); aOther = await fx.agreementOf(a, 'EX05-S01 readers other agreement');
});
const page = (who = requester, cursor = null, limit = 50, id = aAgreement) => who.client.rpc('rpc_read_agreement_messages_page_v1',
  {p_expected_user_id: who.id, p_agreement_id: id, p_limit: limit, p_before_created_at: cursor?.createdAt ?? null, p_before_id: cursor?.messageId ?? null});
const mark = (messageIds, who = requester, id = aAgreement) => who.client.rpc('rpc_mark_displayed_agreement_messages_v1', {p_expected_user_id: who.id, p_agreement_id: id, p_message_ids: messageIds});
const sendA = (who, body, id = aAgreement) => ok(fx.sendText(who, id, commandKey('rd'), body));
const eventSnapshot = () => rows(`select id,read_at from public.user_activity_events where recipient_user_id in (${q(requester.id)},${q(worker.id)}) order by id`);

let historyIds, expected, newest, older, oldest, firstRow, arrived, aMsg, bMsg, ownMsg, foreignMsg, photoAsset, photo;
await h.check('B3A_EMPTY_NEWEST_OLDER_TIED_MICROSECOND_PAGES_AND_LATER_NEWEST_REFRESH', async () => {
  const empty = await ok(page()); assert.deepEqual(empty.messages, []); assert.equal(empty.olderCursor, null);
  historyIds = Array.from({length: 121}, () => randomUUID());
  sql(SQL.insertHistoryFixture({agreementId: aAgreement, senderId: worker.id, ids: historyIds, bodyPrefix: 'History fixture '}));
  expected = rows(`select id from public.agreement_messages where agreement_id=${q(aAgreement)} order by created_at,id`).map(item => item.id);
  newest = await ok(page());
  assert.equal(newest.schema, 'AGREEMENT_MESSAGES_PAGE_V1'); assert.deepEqual(idsOf(newest), expected.slice(-50));
  assert.equal(newest.accountId, requester.id); assert.equal(newest.agreementId, aAgreement); assert.equal(newest.authoritative, true);
  arrived = await sendA(worker, 'Arrival after the first page');
  older = await ok(page(requester, newest.olderCursor)); oldest = await ok(page(requester, older.olderCursor));
  assert.deepEqual([...idsOf(oldest), ...idsOf(older), ...idsOf(newest)], expected); assert.equal(oldest.olderCursor, null);
  assert.equal(new Set([...idsOf(oldest), ...idsOf(older), ...idsOf(newest)]).size, 121);
  assert.equal((await ok(page())).messages.at(-1).messageId, arrived);
  assert.equal((await ok(page(requester, null, 1))).messages.length, 1);
  firstRow = oldest.messages[0];
  assert.deepEqual((await ok(page(requester, {createdAt: firstRow.createdAt, messageId: firstRow.messageId}))).messages, []);
}, {requires: [A_FIXTURE]});

await h.check('B3A_CURSOR_LIMIT_SCOPE_EXPECTED_ACCOUNT_AND_ANON_REFUSALS', async () => {
  await denied(page(requester, null, 0), 'CHAT_CURSOR_INVALID'); await denied(page(requester, null, 51), 'CHAT_CURSOR_INVALID');
  await denied(page(requester, {createdAt: null, messageId: firstRow.messageId}), 'CHAT_CURSOR_INVALID');
  await denied(page(requester, {createdAt: firstRow.createdAt, messageId: randomUUID()}), 'CHAT_CURSOR_INVALID');
  await denied(page(requester, {createdAt: 'infinity', messageId: firstRow.messageId}), 'CHAT_CURSOR_INVALID');
  await denied(page(stranger), 'MEDIA_NOT_FOUND');
  await denied(requester.client.rpc('rpc_read_agreement_messages_page_v1', {p_expected_user_id: worker.id, p_agreement_id: aAgreement}), 'AUTH_CONTEXT_CHANGED');
  await denied(anon.rpc('rpc_read_agreement_messages_page_v1', {p_expected_user_id: requester.id, p_agreement_id: aAgreement}));
}, {requires: [A_FIXTURE, 'B3A_EMPTY_NEWEST_OLDER_TIED_MICROSECOND_PAGES_AND_LATER_NEWEST_REFRESH']});

await h.check('B3A_EXACT_IDS_ONLY_NO_PARTIAL_BATCH_WRITES_NO_OTHER_RECIPIENT_OR_EVENT_SWEEP_AND_IDEMPOTENT_REPLAY', async () => {
  aMsg = await sendA(worker, 'Displayed A'); bMsg = await sendA(worker, 'Not displayed B'); ownMsg = await sendA(requester, 'Own message'); foreignMsg = await sendA(worker, 'Other Agreement', aOther);
  const untouched = eventSnapshot(), globalBefore = digest();
  for (const bad of [null, [], [aMsg, aMsg], [aMsg, null], historyIds.slice(0, 51)]) await denied(mark(bad), 'CHAT_DISPLAYED_IDS_INVALID');
  await denied(mark([[aMsg, bMsg]]));
  await denied(mark([aMsg, randomUUID()]), 'CHAT_MESSAGE_NOT_AVAILABLE'); await denied(mark([aMsg, foreignMsg]), 'CHAT_MESSAGE_NOT_AVAILABLE');
  const foreignRow = (await ok(page(requester, null, 50, aOther))).messages[0];
  await denied(page(requester, {createdAt: foreignRow.createdAt, messageId: foreignRow.messageId}), 'CHAT_CURSOR_INVALID');
  await denied(mark([aMsg], stranger), 'MEDIA_NOT_FOUND');
  await denied(requester.client.rpc('rpc_mark_displayed_agreement_messages_v1', {p_expected_user_id: worker.id, p_agreement_id: aAgreement, p_message_ids: [aMsg]}), 'AUTH_CONTEXT_CHANGED');
  await denied(anon.rpc('rpc_mark_displayed_agreement_messages_v1', {p_expected_user_id: requester.id, p_agreement_id: aAgreement, p_message_ids: [aMsg]}));
  assert.deepEqual(eventSnapshot(), untouched); assert.equal(digest(), globalBefore, 'every refused batch changed nothing in the database');
  assert.deepEqual(await ok(mark([aMsg, ownMsg])), {schema: 'AGREEMENT_MESSAGE_READ_V1', accountId: requester.id, agreementId: aAgreement, displayedMessageIds: [aMsg, ownMsg], markedEventCount: 1, authoritative: true});
  assert.ok(eventRead(aMsg)); assert.equal(eventRead(bMsg), null); assert.equal(eventRead(ownMsg), null); assert.equal(eventRead(foreignMsg), null); assert.equal(eventRead(arrived), null);
  assert.equal((await ok(mark([aMsg]))).markedEventCount, 0);
  const changed = eventSnapshot().filter(row => JSON.stringify(row) !== JSON.stringify(untouched.find(previous => previous.id === row.id)));
  assert.equal(changed.length, 1);
  assert.equal(sql(`select count(*) from public.agreement_messages where agreement_id=${q(aAgreement)} and read_at is not null`), '0');
  assert.equal((await ok(mark([ownMsg], worker))).markedEventCount, 1); assert.ok(eventRead(ownMsg)); assert.equal(eventRead(bMsg), null);
}, {requires: [A_FIXTURE, 'B3A_EMPTY_NEWEST_OLDER_TIED_MICROSECOND_PAGES_AND_LATER_NEWEST_REFRESH']});

await h.check('B3A_SUPPRESSED_MISSING_IN_APP_AND_MISMATCHED_EVENT_LINKS_REMAIN_UNREAD', async () => {
  const suppressed = await sendA(worker, 'Suppressed in-app delivery'), missing = await sendA(worker, 'No in-app delivery'), mismatch = await sendA(worker, 'Wrong event-message link');
  sql(`update public.notification_deliveries d set state='SUPPRESSED',suppression_reason='DISPOSABLE_PROOF' from public.user_activity_events e
      where e.id=d.event_id and e.dedupe_key=${q('agreement_message:' + suppressed)} and d.channel='IN_APP';
    delete from public.notification_deliveries d using public.user_activity_events e where e.id=d.event_id and e.dedupe_key=${q('agreement_message:' + missing)} and d.channel='IN_APP';
    update public.user_activity_events set payload=jsonb_build_object('message_id',${q(bMsg)}::uuid) where dedupe_key=${q('agreement_message:' + mismatch)};`);
  assert.equal((await ok(mark([suppressed, missing, mismatch]))).markedEventCount, 0);
  for (const id of [suppressed, missing, mismatch]) assert.equal(eventRead(id), null);
}, {requires: [A_FIXTURE, 'B3A_EXACT_IDS_ONLY_NO_PARTIAL_BATCH_WRITES_NO_OTHER_RECIPIENT_OR_EVENT_SWEEP_AND_IDEMPOTENT_REPLAY']});

await h.check('B3A_EXPLICIT_TEXT_PHOTO_KIND_ORDERED_PRIVATE_METADATA_AND_PHOTO_EVENT_ID', async () => {
  photoAsset = fx.photoFixtureRow(worker, aAgreement);
  photo = await ok(fx.sendPhoto(worker, aAgreement, [photoAsset]));
  const photoRow = (await ok(page())).messages.find(item => item.messageId === photo.messageId);
  assert.equal(photoRow.kind, 'PHOTO'); assert.equal(photoRow.body, '');
  assert.deepEqual(photoRow.photos, [{assetId: photoAsset, width: 10, height: 10, byteSize: 12, contentType: 'image/jpeg'}]);
  assert.deepEqual(Object.keys(photoRow).sort(), V1_KEYS);
  const textRow = (await ok(page())).messages.find(item => item.messageId === bMsg); assert.equal(textRow.kind, 'TEXT'); assert.deepEqual(textRow.photos, []);
  assert.equal((await ok(mark([photo.messageId]))).markedEventCount, 1);
}, {requires: [A_FIXTURE, 'B3A_EXACT_IDS_ONLY_NO_PARTIAL_BATCH_WRITES_NO_OTHER_RECIPIENT_OR_EVENT_SWEEP_AND_IDEMPOTENT_REPLAY']});

await h.check('B3A_RESTRICTED_ACCOUNT_REFUSES_THE_EXACT_READ_WITHOUT_EVENT_MUTATION', async () => {
  const closingMessage = await sendA(worker, 'Unread while the requester closes');
  assert.equal(rows(`select account_id from private.account_closure_requests where account_id=${q(requester.id)}`).length, 0);
  const before = eventSnapshot();
  sql(SQL.insertClosureRequest(requester.id));
  try {
    expectErrorResult(await mark([closingMessage]), {message: 'ACCOUNT_CLOSING'});
    assert.deepEqual(eventSnapshot(), before); assert.equal(eventRead(closingMessage), null);
  } finally { sql(SQL.deleteClosureRequest(requester.id)); }
}, {requires: [A_FIXTURE, 'B3A_EXACT_IDS_ONLY_NO_PARTIAL_BATCH_WRITES_NO_OTHER_RECIPIENT_OR_EVENT_SWEEP_AND_IDEMPOTENT_REPLAY']});

await h.check('B3A_BOTH_CANONICAL_MEMBERS_READ_AND_ACK_EXACT_EVENTS_OUTSIDER_REFUSED_WITHOUT_READ_CHANGE', async () => {
  const forWorker = await sendA(requester, 'Displayed by the worker', aOther), forRequester = await sendA(worker, 'Displayed by the requester', aOther);
  for (const [member, displayed] of [[worker, forWorker], [requester, forRequester]]) {
    const beforeRefusal = eventSnapshot();
    await denied(page(stranger, null, 50, aOther), 'MEDIA_NOT_FOUND'); await denied(mark([displayed], stranger, aOther), 'MEDIA_NOT_FOUND');
    assert.deepEqual(eventSnapshot(), beforeRefusal);
    assert.ok(idsOf(await ok(page(member, null, 50, aOther))).includes(displayed)); assert.deepEqual(eventSnapshot(), beforeRefusal);
    assert.equal((await ok(mark([displayed], member, aOther))).markedEventCount, 1);
    const changed = eventSnapshot().filter(row => JSON.stringify(row) !== JSON.stringify(beforeRefusal.find(old => old.id === row.id)));
    assert.equal(changed.length, 1); assert.ok(eventRead(displayed));
  }
  assert.deepEqual(rows(`select requester_account_id,worker_account_id from public.agreements where id=${q(aOther)}`), [{requester_account_id: requester.id, worker_account_id: worker.id}]);
}, {requires: [A_FIXTURE, 'B3A_EXACT_IDS_ONLY_NO_PARTIAL_BATCH_WRITES_NO_OTHER_RECIPIENT_OR_EVENT_SWEEP_AND_IDEMPOTENT_REPLAY']});

await h.check('B3A_TERMINAL_HISTORY_AND_THE_CURRENT_SESSION_FENCE', async () => {
  sql(`update public.agreements set status='COMPLETED' where id=${q(aAgreement)}`);
  assert.ok((await ok(page())).messages.length > 0);
  assert.equal((await ok(mark([bMsg]))).markedEventCount, 1);
  assert.equal(sql(`select count(*) from public.agreement_messages where agreement_id=${q(aAgreement)} and read_at is not null`), '0');
  const session = (await requester.client.auth.getSession()).data.session; assert.ok(session);
  const retired = rt.make(); await ok(retired.auth.setSession({access_token: session.access_token, refresh_token: session.refresh_token}));
  await ok(requester.client.auth.signOut());
  await denied(retired.rpc('rpc_read_agreement_messages_page_v1', {p_expected_user_id: requester.id, p_agreement_id: aAgreement}), 'AUTH_REQUIRED');
  await denied(retired.rpc('rpc_mark_displayed_agreement_messages_v1', {p_expected_user_id: requester.id, p_agreement_id: aAgreement, p_message_ids: [aMsg]}), 'AUTH_REQUIRED');
}, {requires: [A_FIXTURE, 'B3A_EXACT_IDS_ONLY_NO_PARTIAL_BATCH_WRITES_NO_OTHER_RECIPIENT_OR_EVENT_SWEEP_AND_IDEMPOTENT_REPLAY']});

// ============ B3b: the exact message window ============
let b, bAgreement, bOther, bRequester, bWorker, bStranger, bIds, bExpected, bExpectedTime, oldTarget;
const B_FIXTURE = 'FIXTURE_B3B_THREE_REAL_ACCOUNTS_TWO_REAL_AGREEMENTS';
await h.check(B_FIXTURE, async () => {
  b = await fx.prepareParty('ex05-readers-b'); ({requester: bRequester, worker: bWorker, stranger: bStranger} = b);
  bAgreement = await fx.agreementOf(b, 'EX05-S01 window'); bOther = await fx.agreementOf(b, 'EX05-S01 window foreign');
});
const windowOf = (target, who = bRequester, before = 24, after = 25, id = bAgreement) => who.client.rpc('rpc_read_agreement_message_window_v1',
  {p_expected_user_id: who.id, p_agreement_id: id, p_target_message_id: target, p_before_count: before, p_after_count: after});
const sendB = (who, body, id = bAgreement) => ok(fx.sendText(who, id, commandKey('wd'), body));

await h.check('B3B_OLD_TARGET_NEAREST_BOUNDED_WINDOW_TIES_MICROSECONDS_EDGES_ZERO_SIDES_AND_INCLUSIVE_REANCHOR', async () => {
  await denied(windowOf(randomUUID()), 'CHAT_MESSAGE_NOT_AVAILABLE');
  bIds = Array.from({length: 121}, () => randomUUID());
  sql(SQL.insertHistoryFixture({agreementId: bAgreement, senderId: bWorker.id, ids: bIds, bodyPrefix: 'Window fixture '}));
  // Qualify the timestamptz sort key: a bare created_at selects the JSONB output alias and orders serialized timestamps by string collation.
  const expectedRows = rows(`select m.id,to_jsonb(m.created_at) as created_at from public.agreement_messages m where m.agreement_id=${q(bAgreement)} order by m.created_at,m.id`);
  bExpected = expectedRows.map(row => row.id); bExpectedTime = new Map(expectedRows.map(row => [row.id, row.created_at]));
  assert.equal(bExpected.length, bIds.length); assert.deepEqual([...bExpected].sort(), [...bIds].sort());
  assert.deepEqual(bExpected.slice(0, 2), bIds.slice(0, 2).sort()); assert.deepEqual(bExpected.slice(-2), bIds.slice(-2).sort());
  assert.ok(expectedRows.some(row => /\.000001[+-]/.test(row.created_at)));
  oldTarget = bExpected[40]; const stable = digest();
  const newestPage = await ok(bRequester.client.rpc('rpc_read_agreement_messages_page_v1', {p_expected_user_id: bRequester.id, p_agreement_id: bAgreement, p_limit: 50}));
  assert.equal(idsOf(newestPage).includes(oldTarget), false);
  for (const [index, beforeCount, afterCount] of [[40, 24, 25], [0, 24, 25], [120, 24, 25], [40, 0, 0], [40, 0, 49], [80, 49, 0], [40, 3, 7]]) {
    const target = bExpected[index], result = await ok(windowOf(target, bRequester, beforeCount, afterCount));
    const low = Math.max(0, index - beforeCount), high = Math.min(bExpected.length, index + afterCount + 1);
    assert.equal(result.schema, 'AGREEMENT_MESSAGE_WINDOW_V1'); assert.equal(result.accountId, bRequester.id); assert.equal(result.agreementId, bAgreement);
    assert.equal(result.targetMessageId, target); assert.equal(result.authoritative, true); assert.equal(typeof result.asOf, 'string');
    assert.deepEqual(idsOf(result), bExpected.slice(low, high)); assert.equal(idsOf(result).filter(id => id === target).length, 1); assert.ok(result.messages.length <= 50);
    assert.deepEqual(result.beforeCursor, low > 0 ? cursorOf(result.messages[0]) : null);
    assert.deepEqual(result.afterCursor, high < bExpected.length ? cursorOf(result.messages.at(-1)) : null);
    for (const message of result.messages) {
      assert.equal(message.kind, 'TEXT'); assert.equal(message.mine, false); assert.deepEqual(message.photos, []);
      assert.equal(message.createdAt, bExpectedTime.get(message.messageId)); // raw timestamp precision, no JS Date conversion
      assert.deepEqual(Object.keys(message).sort(), V1_KEYS);
    }
  }
  const centered = await ok(windowOf(oldTarget));
  const olderPage = await ok(bRequester.client.rpc('rpc_read_agreement_messages_page_v1', {p_expected_user_id: bRequester.id, p_agreement_id: bAgreement, p_limit: 50,
    p_before_created_at: centered.beforeCursor.createdAt, p_before_id: centered.beforeCursor.messageId}));
  assert.deepEqual(idsOf(olderPage), bExpected.slice(0, 16));
  const forward = await ok(windowOf(centered.afterCursor.messageId, bRequester, 0, 49));
  assert.equal(forward.messages[0].messageId, centered.messages.at(-1).messageId);
  assert.deepEqual([...idsOf(centered), ...idsOf(forward).slice(1)], bExpected.slice(16, 115));
  assert.equal(digest(), stable, 'a window read changes nothing');
}, {requires: [B_FIXTURE]});

await h.check('B3B_INVALID_BOUNDS_TARGET_SCOPE_EXPECTED_ACCOUNT_AND_ANON_REFUSALS_NO_READ_OR_DELIVERY_EFFECTS', async () => {
  const foreign = await sendB(bWorker, 'Foreign target', bOther), unread = await sendB(bWorker, 'Unread target'), own = await sendB(bRequester, 'Own target');
  const beforeRefusals = digest();
  for (const [beforeCount, afterCount] of [[null, 1], [1, null], [-1, 1], [1, -1], [50, 0], [0, 50], [25, 25], [2147483647, 2147483647]]) await denied(windowOf(oldTarget, bRequester, beforeCount, afterCount), 'CHAT_WINDOW_INVALID');
  for (const target of [null, randomUUID(), foreign]) await denied(windowOf(target), 'CHAT_MESSAGE_NOT_AVAILABLE');
  await denied(windowOf(oldTarget, bStranger), 'MEDIA_NOT_FOUND'); await denied(windowOf(oldTarget, bRequester, 24, 25, randomUUID()), 'MEDIA_NOT_FOUND');
  await denied(bRequester.client.rpc('rpc_read_agreement_message_window_v1', {p_expected_user_id: bWorker.id, p_agreement_id: bAgreement, p_target_message_id: oldTarget}), 'AUTH_CONTEXT_CHANGED');
  await denied(anon.rpc('rpc_read_agreement_message_window_v1', {p_expected_user_id: bRequester.id, p_agreement_id: bAgreement, p_target_message_id: oldTarget}));
  assert.equal((await ok(windowOf(own, bRequester, 0, 0))).messages[0].mine, true); assert.equal((await ok(windowOf(own, bWorker, 0, 0))).messages[0].mine, false);
  await ok(windowOf(unread));
  assert.equal(digest(), beforeRefusals, 'the refusals and the read of an unread target changed nothing');
}, {requires: [B_FIXTURE, 'B3B_OLD_TARGET_NEAREST_BOUNDED_WINDOW_TIES_MICROSECONDS_EDGES_ZERO_SIDES_AND_INCLUSIVE_REANCHOR']});

await h.check('B3B_BOTH_CANONICAL_MEMBERS_READ_THE_WINDOW_OUTSIDER_REFUSED_WITHOUT_READ_OR_DELIVERY_EFFECT', async () => {
  const before = digest();
  await denied(windowOf(oldTarget, bStranger), 'MEDIA_NOT_FOUND');
  for (const member of [bRequester, bWorker]) assert.equal((await ok(windowOf(oldTarget, member, 0, 0))).targetMessageId, oldTarget);
  assert.equal(digest(), before);
  assert.deepEqual(rows(`select requester_account_id,worker_account_id from public.agreements where id=${q(bAgreement)}`), [{requester_account_id: bRequester.id, worker_account_id: bWorker.id}]);
}, {requires: [B_FIXTURE, 'B3B_OLD_TARGET_NEAREST_BOUNDED_WINDOW_TIES_MICROSECONDS_EDGES_ZERO_SIDES_AND_INCLUSIVE_REANCHOR']});

await h.check('B3B_EXACT_PHOTO_TARGET_ALLOWLIST_AND_BAD_ATTACHMENT_REFUSAL_WITHOUT_ACKNOWLEDGEMENT', async () => {
  const assetId = fx.photoFixtureRow(bWorker, bAgreement);
  const bPhoto = await ok(fx.sendPhoto(bWorker, bAgreement, [assetId]));
  const state = digest(), photoPage = await ok(windowOf(bPhoto.messageId, bRequester, 0, 0)), photoRow = photoPage.messages[0];
  assert.equal(photoRow.kind, 'PHOTO'); assert.equal(photoRow.body, ''); assert.equal(photoRow.messageId, bPhoto.messageId);
  assert.deepEqual(photoRow.photos, [{assetId, width: 10, height: 10, byteSize: 12, contentType: 'image/jpeg'}]);
  assert.deepEqual(Object.keys(photoRow).sort(), V1_KEYS); assert.equal(digest(), state);
  // Corrupt only the disposable attachment link, preserving table constraints.
  sql(`begin;set local session_replication_role=replica;update private.agreement_photo_uploads_v5 set attached_message_id=${q(oldTarget)} where id=${q(assetId)};commit;`);
  try { await denied(windowOf(bPhoto.messageId), 'MEDIA_MESSAGE_LINK_INCOMPLETE'); assert.equal(digest(), state); }
  finally { sql(`begin;set local session_replication_role=replica;update private.agreement_photo_uploads_v5 set attached_message_id=${q(bPhoto.messageId)} where id=${q(assetId)};commit;`); }
}, {requires: [B_FIXTURE, 'B3B_OLD_TARGET_NEAREST_BOUNDED_WINDOW_TIES_MICROSECONDS_EDGES_ZERO_SIDES_AND_INCLUSIVE_REANCHOR']});

await h.check('B3B_LATER_COMMITTED_ARRIVAL_TERMINAL_HISTORY_AND_A_RETIRED_SESSION', async () => {
  const earlier = await ok(windowOf(oldTarget)), arrival = await sendB(bWorker, 'Later arrival');
  const afterArrival = digest(), later = await ok(windowOf(oldTarget));
  assert.deepEqual(idsOf(later), idsOf(earlier)); assert.equal(later.targetMessageId, oldTarget);
  assert.equal((await ok(windowOf(arrival, bRequester, 0, 0))).targetMessageId, arrival); assert.equal(digest(), afterArrival);
  sql(`update public.agreements set status='COMPLETED' where id=${q(bAgreement)}`);
  const terminal = digest(); assert.equal((await ok(windowOf(oldTarget))).targetMessageId, oldTarget); assert.equal(digest(), terminal);
  const session = (await bRequester.client.auth.getSession()).data.session; assert.ok(session);
  const retired = rt.make(); await ok(retired.auth.setSession({access_token: session.access_token, refresh_token: session.refresh_token}));
  await ok(bRequester.client.auth.signOut());
  const afterLogout = digest();
  await denied(retired.rpc('rpc_read_agreement_message_window_v1', {p_expected_user_id: bRequester.id, p_agreement_id: bAgreement, p_target_message_id: oldTarget}), 'AUTH_REQUIRED');
  assert.equal(digest(), afterLogout);
}, {requires: [B_FIXTURE, 'B3B_BOTH_CANONICAL_MEMBERS_READ_THE_WINDOW_OUTSIDER_REFUSED_WITHOUT_READ_OR_DELIVERY_EFFECT']});

await h.catalogGuardCheck();
process.exitCode = h.finish();
