// EX05-S01 UPDATED COPY - the task group conversation (text only) on the POST-B24, POST-VOICE-B1 disposable chain. Disposable local Auth / PostgREST / Postgres only.
// Frozen original (NOT edited, kept as history): supabase/proofs/pre_v3/v5_group_conversation_proof.mjs, a link of the pkg010 chain (newest run 36095780738 on 3fdbe559, 2026-09-25).
// WHY a copy: the original applies migration 20260913002405 at history 136 (it cannot run on a later chain), builds its Agreements on the global RU5 accounts, and ends with the export
// catalog size 39 and the projection version OWN_ACCOUNT_V5_2, both moved since (Voice B1: 52 datasets). The group functions themselves were not touched by B24 (conflicts use SQLSTATE
// 22023, never a retried code; read-only DEV scan 2026-10-02: no group function mentions 40001 or PT409) and not by Voice B1, so the assertion that matters here is that the BEHAVIOUR is
// unchanged on the final chain. THE DIFF against the original, all of it:
//   * no apply, no predecessor, no history count; accounts from rt.actor, a 3-slot need with real offers and selections;
//   * the observed-lock RACES (lockedRace: replacement admission, pair-block, cancellation cutoff, closure mark-read) are NOT copied (the originals still prove them at their position and
//     nothing since touched the group writers); the same boundaries are asserted SEQUENTIALLY;
//   * the closure check is the pre-request guard only (a READY closure request makes group reads and mark-read fail with ACCOUNT_CLOSING); a REAL account closure of a group member
//     after Voice B1 is NOT run here (declared in the README: only the export projection and the catalog are checked);
//   * the export check keeps the author-only group datasets and the field allowlist, and drops the size and version literals;
//   * added, as RECORDED observations (not asserted): a group send emits no event, no delivery and no invalidation row (EX05 scope gap G16) - the classifier names the finding.
// Every check runs even after an earlier one failed (lib/runner.mjs).
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createProofHarness, assertChainFacts, CHAIN_FACTS_SQL} from './lib/harness.mjs';
import {expectErrorResult} from './lib/runner.mjs';
import {createFixtures, UUID_PATTERN} from './lib/fixtures.mjs';
import {classifyGroupNotifications, FAIL_ON_UNEXPECTED} from './lib/findings.mjs';
import {SQL} from './lib/sql_snippets.mjs';

const {assert, sql, rows, q, ok, denied, anon, service, randomUUID} = rt;
const SOURCES = ['supabase/proofs/ex05_s01/ex05_s01_group_proof.mjs', 'supabase/proofs/ex05_s01/lib/runner.mjs', 'supabase/proofs/ex05_s01/lib/harness.mjs',
  'supabase/proofs/ex05_s01/lib/fixtures.mjs', 'supabase/proofs/ex05_s01/lib/sql_snippets.mjs', 'supabase/proofs/ex05_s01/lib/findings.mjs', 'supabase/proofs/pre_v3/closure_runtime.mjs'];
const h = createProofHarness({rt, unit: 'EX05_S01_GROUP', reportName: 'ex05-s01-group-report.json', sources: SOURCES});
const fx = createFixtures(rt);

await h.sourceCheck();
if (!(await h.requireChain('CHAIN_IS_THE_POST_B24_POST_VOICE_STATE', async () => assertChainFacts(JSON.parse(sql(CHAIN_FACTS_SQL)))))) process.exit(h.finish());
h.beginCatalogGuard();

// ---- the group call helpers (copied from the original) ----
const context = (who, id, after = null) => ok(who.client.rpc('rpc_read_group_context_v5', {p_expected_user_id: who.id, p_agreement_id: id, p_management_after_id: after}));
const sendArgs = (who, groupId, body, key = randomUUID()) => ({p_expected_user_id: who.id, p_group_id: groupId, p_client_request_id: key, p_body: body});
const send = (who, groupId, body, key) => ok(who.client.rpc('rpc_send_group_message_v5', sendArgs(who, groupId, body, key)));
const sendRaw = (who, groupId, body, key) => who.client.rpc('rpc_send_group_message_v5', sendArgs(who, groupId, body, key));
const messages = (who, groupId, after = null, before = null) => ok(who.client.rpc('rpc_read_group_messages_v5', {p_expected_user_id: who.id, p_group_id: groupId, p_after_sequence: after, p_before_sequence: before}));
const ids = page => page.messages.map(message => message.messageId);
const count = groupId => Number(sql(SQL.groupMessageCount(groupId)));
const granted = (messageId, who) => sql(SQL.groupVisibilityGranted(messageId, who.id)) === 't';
const blockOf = async (who, other, value) => {
  const state = await ok(who.client.rpc('rpc_get_account_block', {p_target_account_id: other.id}));
  return ok(who.client.rpc('rpc_set_account_block', {p_target_account_id: other.id, p_blocked: value, p_expected_revision: state.revision, p_client_request_id: randomUUID()}));
};
const application = (who, needId) => ok(who.client.rpc('rpc_submit_response', {p_need_id: needId, p_need_revision: 1, p_worker_profile_id: who.profileId, p_covered_slots: 1,
  p_price_rsd: 8123, p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: 'PRIVATE_TERMS_ONLY_' + who.id, p_client_request_id: randomUUID()}));
const selectArgs = (needId, offer) => ({p_need_id: needId, p_need_revision: offer.needRevision, p_response_id: offer.responseId, p_response_version: offer.version, p_content_hash: offer.contentHash, p_client_request_id: randomUUID()});
let party, R, A, B, C, D, E, outsider, needId, aid, bid, cid, did, eid, g, one, two, three, key, afterUnblock;
const selectFor = async who => ok(R.client.rpc('rpc_select_response', selectArgs(needId, await application(who, needId))));

const FIXTURE = 'FIXTURE_ONE_REQUESTER_TWO_INDEPENDENT_WORKERS_ONE_THREE_SLOT_NEED_ONE_GROUP';
await h.check(FIXTURE, async () => {
  party = await fx.prepareParty('ex05-group'); R = party.requester; outsider = party.stranger;
  A = {...party.worker, profileId: party.workerProfile};
  [B, C, D, E] = [await fx.prepareExtraWorker('ex05-group-b'), await fx.prepareExtraWorker('ex05-group-c'), await fx.prepareExtraWorker('ex05-group-d'), await fx.prepareExtraWorker('ex05-group-e')];
  needId = fx.publishNeed(party, 'EX05-S01 group main', 3);
  aid = await selectFor(A);
  assert.equal((await context(A, aid)).available, false, 'one selected worker is not a group');
  await ok(R.client.rpc('rpc_send_agreement_message_v2', {p_expected_user_id: R.id, p_agreement_id: aid, p_client_message_id: 'ex05-bilateral-' + randomUUID().slice(0, 8), p_body: 'PRIVATE_BILATERAL_NOT_GROUP_HISTORY'}));
  bid = await selectFor(B);
  const initial = await context(A, aid); g = initial.group.groupId;
  assert.match(g, UUID_PATTERN); assert.equal(initial.available, true); assert.equal(initial.group.members.length, 3);
});
const REQ = {requires: [FIXTURE]};

await h.check('AUTHORITY_PRIVATE_TABLES_FORCE_RLS_NO_ROLE_GRANTS_FUNCTIONS_AUTHENTICATED_ONLY_AND_NO_FOREIGN_GRANTS_OR_PRIVATE_TERMS', async () => {
  for (const table of ['group_conversations_v5', 'group_memberships_v5', 'group_messages_v5', 'group_message_visibility_v5']) {
    assert.equal(sql(`select relrowsecurity from pg_class where oid=${q('private.' + table)}::regclass`), 't');
    for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(sql(`select has_table_privilege(${q(role)},${q('private.' + table)},'SELECT,INSERT,UPDATE,DELETE')`), 'f');
  }
  for (const client of [anon, service]) await denied(client.rpc('rpc_read_group_context_v5', {p_expected_user_id: A.id, p_agreement_id: aid}));
  for (const fn of rows("select oid::regprocedure::text as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'rpc_%group%_v5'"))
    for (const role of ['anon', 'service_role']) assert.equal(sql(`select has_function_privilege(${q(role)},${q(fn.signature)},'EXECUTE')`), 'f', fn.signature);
  await denied(outsider.client.rpc('rpc_read_group_messages_v5', {p_expected_user_id: outsider.id, p_group_id: g}), 'GROUP_NOT_AVAILABLE');
  await denied(B.client.rpc('rpc_read_group_context_v5', {p_expected_user_id: B.id, p_agreement_id: aid}), 'GROUP_NOT_AVAILABLE');
  await denied(A.client.rpc('rpc_read_group_messages_v5', {p_expected_user_id: B.id, p_group_id: g}), 'AUTH_CONTEXT_CHANGED');
  const initial = await context(A, aid);
  assert.equal(initial.group.management, null); assert.equal(initial.group.managementNextId, null);
  assert.equal((await context(B, bid)).group.groupId, g); assert.equal((await context(R, aid)).group.management.length, 2);
  assert.ok(!JSON.stringify(initial).includes('PRIVATE_TERMS_ONLY') && !JSON.stringify(initial).includes('executionState'));
  assert.equal(count(g), 0); assert.ok(!JSON.stringify(await messages(A, g)).includes('PRIVATE_BILATERAL_NOT_GROUP_HISTORY'), 'the bilateral history is not group history');
}, REQ);

await h.check('EXACT_ACTOR_KEY_REPLAY_RECOVERY_NEW_ADMISSION_NO_HISTORY_BACKFILL_READ_DOES_NOT_MARK_OR_GRANT', async () => {
  key = randomUUID();
  one = await send(A, g, 'Group message before third member', key); two = await send(B, g, 'Second early message');
  const replay = await send(A, g, 'Group message before third member', key);
  assert.equal(replay.messageId, one.messageId); assert.equal(replay.idempotentReplay, true); assert.equal(count(g), 2);
  expectErrorResult(await sendRaw(A, g, 'Changed body', key), {code: '22023', message: 'GROUP_MESSAGE_KEY_REUSED'});
  const recovered = await ok(A.client.rpc('rpc_read_group_command_v5', {p_expected_user_id: A.id, p_group_id: g, p_client_request_id: key}));
  assert.equal(recovered.receipt.messageId, one.messageId);
  assert.equal((await ok(B.client.rpc('rpc_read_group_command_v5', {p_expected_user_id: B.id, p_group_id: g, p_client_request_id: key}))).found, false, 'a key belongs to its sender');
  await denied(A.client.rpc('rpc_read_group_command_v5', {p_expected_user_id: A.id, p_group_id: g, p_client_request_id: null}), 'GROUP_MESSAGE_INVALID');
  cid = await selectFor(C);
  assert.deepEqual(ids(await messages(C, g)), []); assert.equal(granted(one.messageId, C), false); assert.equal(granted(two.messageId, C), false);
  three = await send(C, g, 'Third member after admission');
  assert.ok(ids(await messages(A, g)).includes(three.messageId)); assert.deepEqual(ids(await messages(C, g)), [three.messageId]);
  const unreadBefore = (await context(R, aid)).group.unreadCount; await messages(R, g);
  assert.equal((await context(R, aid)).group.unreadCount, unreadBefore, 'reading does not mark');
  const marked = await ok(R.client.rpc('rpc_mark_group_messages_read_v5', {p_expected_user_id: R.id, p_group_id: g, p_message_ids: [one.messageId]}));
  assert.equal(marked.markedCount, 1); assert.equal((await context(R, aid)).group.unreadCount, unreadBefore - 1);
  const hidden = await ok(C.client.rpc('rpc_mark_group_messages_read_v5', {p_expected_user_id: C.id, p_group_id: g, p_message_ids: [one.messageId]}));
  assert.equal(hidden.markedCount, 0); assert.equal(granted(one.messageId, C), false);
}, REQ);

// G16 (EX05 scope): the group has no notification, realtime or media path. RECORDED, not asserted: one group send by a current member and the row-count deltas around it.
await h.characterize('G16_A_GROUP_SEND_EMITS_NO_EVENT_NO_DELIVERY_AND_NO_INVALIDATION_ROW', async () => {
  const beforeCounts = rows(SQL.notificationCounts())[0], beforeGroup = count(g);
  await send(B, g, 'EX05 G16 probe');
  const afterCounts = rows(SQL.notificationCounts())[0];
  return {messagesAdded: count(g) - beforeGroup, eventsAdded: afterCounts.events - beforeCounts.events, deliveriesAdded: afterCounts.deliveries - beforeCounts.deliveries,
    invalidationRowsAdded: afterCounts.invalidations - beforeCounts.invalidations};
}, {requires: [FIXTURE, 'EXACT_ACTOR_KEY_REPLAY_RECOVERY_NEW_ADMISSION_NO_HISTORY_BACKFILL_READ_DOES_NOT_MARK_OR_GRANT'], classify: classifyGroupNotifications, failOn: FAIL_ON_UNEXPECTED});

await h.check('CANCELLED_MEMBER_KEEPS_PAST_ONLY_REPLACEMENT_SEES_ONLY_LATER_MESSAGES_AND_COMPLETED_MEMBER_CONTINUES', async () => {
  await ok(R.client.rpc('rpc_cancel_agreement', {p_agreement_id: aid, p_reason: 'EX05-S01 group membership cutoff'}));
  const four = await send(R, g, 'After first participant cancellation');
  assert.ok(!ids(await messages(A, g)).includes(four.messageId)); assert.ok(ids(await messages(A, g)).includes(three.messageId));
  const former = await context(A, aid);
  assert.equal(former.group.canSend, false); assert.deepEqual(former.group.members, []); assert.equal(former.group.management, null);
  await denied(A.client.rpc('rpc_send_group_message_v5', sendArgs(A, g, 'Former member cannot send')), 'GROUP_READ_ONLY');
  assert.equal((await send(A, g, 'Group message before third member', key)).messageId, one.messageId, 'a replay by a former member still acknowledges the original');
  did = await selectFor(D);
  const joinMessage = await send(R, g, 'Message after replacement admission');
  assert.deepEqual(ids(await messages(D, g)), [joinMessage.messageId]); assert.equal(granted(four.messageId, D), false);
  assert.deepEqual((await context(A, aid)).group.members, []);
  await ok(B.client.rpc('rpc_mark_work_done', {p_agreement_id: bid})); await ok(R.client.rpc('rpc_confirm_completion', {p_agreement_id: bid}));
  assert.equal((await context(B, bid)).group.canSend, true);
  const completed = await send(B, g, 'Completed participant may coordinate until Task terminal');
  assert.ok(granted(completed.messageId, D));
}, {requires: [FIXTURE, 'EXACT_ACTOR_KEY_REPLAY_RECOVERY_NEW_ADMISSION_NO_HISTORY_BACKFILL_READ_DOES_NOT_MARK_OR_GRANT']});

await h.check('PAIR_BLOCK_BARRIERS_AND_FUTURE_AUDIENCE_ONLY_UNBLOCK_NO_BACKFILL_OTHERS_CONTINUE', async () => {
  await blockOf(B, C, true);
  const pairGap = await send(C, g, 'Hidden from blocked peer');
  assert.equal(granted(pairGap.messageId, B), false); assert.equal(granted(pairGap.messageId, R), true);
  const reverseGap = await send(B, g, 'Hidden in other direction'); assert.equal(granted(reverseGap.messageId, C), false);
  await blockOf(B, C, false);
  assert.ok(!ids(await messages(B, g)).includes(pairGap.messageId)); assert.ok(!ids(await messages(C, g)).includes(reverseGap.messageId));
  await blockOf(R, C, true);
  const beforeDenied = count(g);
  await denied(C.client.rpc('rpc_send_group_message_v5', sendArgs(C, g, 'Requester-blocked send')), 'GROUP_READ_ONLY'); assert.equal(count(g), beforeDenied);
  const ownerGap = await send(R, g, 'Requester message unavailable to blocked participant'); assert.equal(granted(ownerGap.messageId, C), false);
  const continuing = await send(D, g, 'Other participants continue'); assert.equal(granted(continuing.messageId, R), true);
  await blockOf(R, C, false);
  assert.ok(!ids(await messages(C, g)).includes(ownerGap.messageId), 'unblock does not backfill');
  afterUnblock = await send(R, g, 'Fresh message after unblock'); assert.equal(granted(afterUnblock.messageId, C), true);
}, {requires: [FIXTURE, 'EXACT_ACTOR_KEY_REPLAY_RECOVERY_NEW_ADMISSION_NO_HISTORY_BACKFILL_READ_DOES_NOT_MARK_OR_GRANT', 'CANCELLED_MEMBER_KEEPS_PAST_ONLY_REPLACEMENT_SEES_ONLY_LATER_MESSAGES_AND_COMPLETED_MEMBER_CONTINUES']});

await h.check('CANCELLED_THIRD_MEMBER_GETS_NO_FUTURE_GRANT_AND_THE_CLOSURE_FENCE_REFUSES_READS_AND_MARK_READ', async () => {
  await ok(R.client.rpc('rpc_cancel_agreement', {p_agreement_id: cid, p_reason: 'EX05-S01 observed group cancellation'}));
  const afterCancel = await send(R, g, 'Message after cancelled membership');
  assert.equal(granted(afterCancel.messageId, C), false); assert.equal((await context(C, cid)).group.canSend, false);
  assert.ok(ids(await messages(C, g)).includes(afterUnblock.messageId), 'a cancelled member keeps the past it was granted');
  const unread = await send(R, g, 'Unread before closure fence'); assert.equal(granted(unread.messageId, D), true);
  sql(SQL.insertClosureRequest(D.id));
  try {
    const markRead = await D.client.rpc('rpc_mark_group_messages_read_v5', {p_expected_user_id: D.id, p_group_id: g, p_message_ids: [unread.messageId]});
    expectErrorResult(markRead, {message: 'ACCOUNT_CLOSING'});
    assert.equal(sql(`select read_at is null from private.group_message_visibility_v5 where account_id=${q(D.id)}::uuid and message_id=${q(unread.messageId)}::uuid`), 't', 'nothing was marked');
    const closedRead = await D.client.rpc('rpc_read_group_messages_v5', {p_expected_user_id: D.id, p_group_id: g});
    expectErrorResult(closedRead, {code: '42501', message: 'ACCOUNT_CLOSING'});
  } finally { sql(SQL.deleteClosureRequest(D.id)); }
}, {requires: [FIXTURE, 'CANCELLED_MEMBER_KEEPS_PAST_ONLY_REPLACEMENT_SEES_ONLY_LATER_MESSAGES_AND_COMPLETED_MEMBER_CONTINUES', 'PAIR_BLOCK_BARRIERS_AND_FUTURE_AUDIENCE_ONLY_UNBLOCK_NO_BACKFILL_OTHERS_CONTINUE']});

await h.check('SERVER_BOUNDED50_HISTORY_BOTH_DIRECTIONS_NO_DUPLICATES_PRIVATE_OWNER_MANAGEMENT_CURSOR', async () => {
  for (let index = 0; index < 53; index++) await send(R, g, 'Pagination ' + index);
  const latest = await messages(D, g);
  assert.equal(latest.messages.length, 50); assert.ok(latest.nextBeforeSequence); assert.equal(latest.nextAfterSequence, null);
  for (const message of latest.messages) assert.deepEqual(Object.keys(message).sort(), ['messageId', 'sequence', 'senderAccountId', 'body', 'createdAt', 'mine'].sort());
  const older = await messages(D, g, null, latest.nextBeforeSequence);
  assert.equal(new Set([...ids(latest), ...ids(older)]).size, latest.messages.length + older.messages.length);
  const forward = await messages(D, g, '0'); assert.equal(forward.messages.length, 50); assert.ok(forward.nextAfterSequence);
  const rest = await messages(D, g, forward.nextAfterSequence);
  const expected = Number(sql(`select count(*) from private.group_message_visibility_v5 v join private.group_messages_v5 m on m.id=v.message_id where m.group_id=${q(g)}::uuid and v.account_id=${q(D.id)}::uuid`));
  assert.equal(new Set([...ids(forward), ...ids(rest)]).size, expected); assert.equal(latest.messages.length + older.messages.length, expected);
  for (const patch of [{p_after_sequence: '00'}, {p_before_sequence: '0'}, {p_after_sequence: '-1'}, {p_after_sequence: '1', p_before_sequence: '3'}])
    await denied(D.client.rpc('rpc_read_group_messages_v5', {p_expected_user_id: D.id, p_group_id: g, ...patch}), 'GROUP_CURSOR_INVALID');
  const management = await context(R, did); assert.ok(management.group.management.length <= 50); assert.equal((await context(D, did)).group.management, null);
  const afterMember = management.group.management[0].agreementId, next = await context(R, did, afterMember);
  assert.ok(next.group.management.every(item => item.agreementId > afterMember));
  assert.ok(!JSON.stringify(await context(D, did)).includes('PRIVATE_TERMS_ONLY'));
}, {requires: [FIXTURE, 'CANCELLED_MEMBER_KEEPS_PAST_ONLY_REPLACEMENT_SEES_ONLY_LATER_MESSAGES_AND_COMPLETED_MEMBER_CONTINUES']});

await h.check('CANONICAL_INDEPENDENT_AGREEMENT_COMPLETION_AGGREGATES_TERMINAL_TASK_AND_FREEZES_GROUP_WITH_HISTORY', async () => {
  eid = await selectFor(E);
  for (const [person, agreementId] of [[D, did], [E, eid]]) { await ok(person.client.rpc('rpc_mark_work_done', {p_agreement_id: agreementId})); await ok(R.client.rpc('rpc_confirm_completion', {p_agreement_id: agreementId})); }
  const terminal = await context(D, did);
  assert.equal(terminal.group.terminal, true); assert.equal(terminal.group.canSend, false);
  assert.ok((await messages(D, g)).messages.length > 0);
  await denied(D.client.rpc('rpc_send_group_message_v5', sendArgs(D, g, 'No terminal send')), 'GROUP_READ_ONLY');
}, {requires: [FIXTURE, 'SERVER_BOUNDED50_HISTORY_BOTH_DIRECTIONS_NO_DUPLICATES_PRIVATE_OWNER_MANAGEMENT_CURSOR']});

await h.check('OWN_AUTHOR_EXPORT_HAS_GROUP_MESSAGES_AND_MEMBERSHIPS_OF_THE_AUTHOR_ONLY_WITH_THE_FIELD_ALLOWLIST', async () => {
  const catalog = JSON.parse(sql('select private.data_export_dataset_catalog()'));
  const config = {delivery: {datasets: catalog.map(d => ({key: d.key, mode: 'INCLUDE', fields: d.fields}))}};
  const snapshot = who => JSON.parse(sql(`select private.data_export_snapshot(${q(who.id)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(config))}::jsonb,clock_timestamp())`));
  const da = snapshot(A), db = snapshot(B);
  assert.ok(Object.hasOwn(da.datasets, 'ownGroupMessages') && Object.hasOwn(da.datasets, 'ownGroupMemberships'));
  assert.ok(da.datasets.ownGroupMessages.some(item => item.id === one.messageId)); assert.ok(!db.datasets.ownGroupMessages.some(item => item.id === one.messageId));
  assert.ok(da.datasets.ownGroupMemberships.some(item => item.agreementId === aid)); assert.ok(!db.datasets.ownGroupMemberships.some(item => item.agreementId === aid));
  for (const message of da.datasets.ownGroupMessages) assert.deepEqual(Object.keys(message).sort(), ['id', 'groupId', 'body', 'createdAt'].sort());
  assert.equal(sql('select sha256=private.closure_source_digest_v5() from private.closure_source_v5 where singleton'), 't');
}, {requires: [FIXTURE, 'EXACT_ACTOR_KEY_REPLAY_RECOVERY_NEW_ADMISSION_NO_HISTORY_BACKFILL_READ_DOES_NOT_MARK_OR_GRANT']});

h.setFlag('storageCalls', 0);
await h.catalogGuardCheck();
process.exitCode = h.finish();
