// EX05-S01 UPDATED COPY - private photo messages in an Agreement chat on the POST-B24, POST-VOICE-B1 disposable chain. Disposable local Auth / PostgREST / Postgres / Storage only.
// Frozen original (NOT edited, kept as history): supabase/proofs/pre_v3/v5_agreement_photos_proof.mjs, a link of the pkg010 chain (workflow pkg010-system-contracts-proof.yml; the
// newest run 36095780738 on 3fdbe559 is from 2026-09-25, before B24 and Voice B1). WHY a copy: the original applies migration 20260913065130 at history 143 (it cannot run on a later
// chain), asserts the export catalog size 50 and the projection version OWN_ACCOUNT_V5_7 (both moved since), asserts closure_binding_v5() is null (it is bound since the Voice B1
// application), and checks every refusal by MESSAGE only (rt.denied): a post-B24 chain answers the same conflicts with PT409, which that style cannot see. THE DIFF, all of it:
//   * no apply, no predecessor, no history count, no old-writer md5 pins, no catalog-size or projection-version or binding-null assertion; accounts from rt.actor;
//   * every conflict is checked as code PT409 + message + HTTP 409 (lib/runner.mjs expectConflictResult), covering all four PT409 sites of rpc_agreement_photo_upload_service_v5
//     (key moved to another Agreement, CLAIM with other input, STAGE with other parameters, SETTLE with another outcome) and agreement_photo_context_v5 (stale version);
//   * the observed-lock RACES (lockedRace) are NOT copied: the cancel lock order is EX05-S02 (RC-02); the sequential cancel / late-store / no-resurrection assertions are kept;
//     the closure fence is checked sequentially (a READY closure request refuses the claim with ACCOUNT_CLOSING);
//   * the export check keeps the own-author projection, the field allowlist and "no pixels, no transfer secrets", and drops the size and version literals.
// Every check runs even after an earlier one failed (lib/runner.mjs).
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createProofHarness, assertChainFacts, CHAIN_FACTS_SQL} from './lib/harness.mjs';
import {expectConflictResult, expectErrorResult} from './lib/runner.mjs';
import {createFixtures, commandKey, UUID_PATTERN} from './lib/fixtures.mjs';
import {SQL} from './lib/sql_snippets.mjs';

const {assert, sql, rows, q, ok, denied, anon, service, env, randomUUID} = rt;
const SOURCES = ['supabase/proofs/ex05_s01/ex05_s01_photo_proof.mjs', 'supabase/proofs/ex05_s01/lib/runner.mjs', 'supabase/proofs/ex05_s01/lib/harness.mjs',
  'supabase/proofs/ex05_s01/lib/fixtures.mjs', 'supabase/proofs/ex05_s01/lib/sql_snippets.mjs', 'supabase/proofs/pre_v3/closure_runtime.mjs'];
const h = createProofHarness({rt, unit: 'EX05_S01_PHOTO', reportName: 'ex05-s01-photo-report.json', sources: SOURCES});
const fx = createFixtures(rt);
const PHOTO_RPC = 'rpc_agreement_photo_upload_service_v5';
const BUCKET = 'profile-media';
let storageCalls = 0;

await h.sourceCheck();
if (!(await h.requireChain('CHAIN_IS_THE_POST_B24_POST_VOICE_STATE', async () => assertChainFacts(JSON.parse(sql(CHAIN_FACTS_SQL)))))) process.exit(h.finish());
h.beginCatalogGuard();

let magick, original, image, sha, inputSha;
await h.check('FIXTURE_REAL_SANITIZED_IMAGE', async () => {
  magick = await import('@imagemagick/magick-wasm');
  const {sanitizeImage} = await import('../../functions/_shared/mediaImageSanitizer.mjs');
  const require = createRequire(import.meta.url);
  await magick.initializeImageMagick(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm')));
  original = magick.ImageMagick.read(magick.MagickColors.Green, 100, 50, i => { i.setAttribute('comment', 'PRIVATE_ORIGINAL_METADATA'); return i.write(magick.MagickFormat.Png, b => new Uint8Array(b)); });
  image = sanitizeImage(original, 'image/png', magick);
  sha = createHash('sha256').update(image.bytes).digest('hex'); inputSha = createHash('sha256').update(original).digest('hex');
  assert.ok(image.bytes.length > 0 && image.width > 0);
});

let party, R, W, foreign, g, g2;
const PARTY = 'FIXTURE_REAL_ACCOUNTS_AND_TWO_AGREEMENTS';
await h.check(PARTY, async () => {
  party = await fx.prepareParty('ex05-photo'); R = party.requester; W = party.worker; foreign = party.stranger;
  g = await fx.agreementOf(party, 'EX05-S01 photo one'); g2 = await fx.agreementOf(party, 'EX05-S01 photo two');
});
const REQ = {requires: ['FIXTURE_REAL_SANITIZED_IMAGE', PARTY]};

const args = async (who, agreementId, op, key = randomUUID(), input = {}, version = 1) => ({p_account_id: who.id, p_session_id: await fx.sessionOf(who), p_operation: op, p_agreement_id: agreementId, p_version: version, p_key: key, p_input: input});
const call = request => service.rpc(PHOTO_RPC, request);
const newClaim = (who, agreementId, key = randomUUID()) => args(who, agreementId, 'CLAIM', key, {sha256: inputSha, byteSize: original.length, contentType: 'image/png'});
const stage = async (who, agreementId, claimed) => ok(call(await args(who, agreementId, 'STAGE', claimed.receipt.clientRequestId,
  {attemptId: claimed.attemptId, sha256: sha, width: image.width, height: image.height, byteSize: image.bytes.length})));
async function finish(who, agreementId, staged) {
  const dispatched = await ok(call(await args(who, agreementId, 'DISPATCH', staged.receipt.clientRequestId))); assert.equal(dispatched.acquired, true);
  assert.equal((await ok(call(await args(who, agreementId, 'DISPATCH', staged.receipt.clientRequestId)))).acquired, false, 'dispatch is exactly once');
  await ok(service.storage.from(BUCKET).upload(staged.path, image.bytes, {contentType: 'image/jpeg', upsert: false})); storageCalls += 1;
  const blob = await ok(service.storage.from(BUCKET).download(staged.path)); storageCalls += 1;
  assert.equal(createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex'), sha);
  return ok(call(await args(who, agreementId, 'SETTLE', staged.receipt.clientRequestId, {sha256: sha, outcome: 'STORED'})));
}
const upload = async (who, agreementId) => finish(who, agreementId, await stage(who, agreementId, await ok(call(await newClaim(who, agreementId)))));
const sendArgs = (who, agreementId, ids, key = commandKey('photo'), body = '', version = 1) => ({p_expected_user_id: who.id, p_agreement_id: agreementId, p_expected_version: version, p_client_message_id: key, p_body: body, p_asset_ids: ids});
const send = (who, request) => who.client.rpc('rpc_send_agreement_photo_message_v5', request);
const meta = (who, agreementId, ids) => who.client.rpc('rpc_read_agreement_photo_messages_v5', {p_expected_user_id: who.id, p_agreement_id: agreementId, p_message_ids: ids});
const byteArgs = async (who, agreementId, assetId, messageId = null) => ({p_account_id: who.id, p_session_id: await fx.sessionOf(who), p_agreement_id: agreementId, p_asset_id: assetId, p_message_id: messageId});
const byteRead = request => service.rpc('rpc_agreement_photo_read_service_v5', request);
const block = async value => {
  const state = await ok(R.client.rpc('rpc_get_account_block', {p_target_account_id: W.id}));
  return ok(R.client.rpc('rpc_set_account_block', {p_target_account_id: W.id, p_blocked: value, p_expected_revision: state.revision, p_client_request_id: randomUUID()}));
};

let first, second, message, command;
await h.check('PRIVATE_TABLE_FORCE_RLS_NO_DIRECT_GRANTS_AND_SERVICE_PROTOCOL_IS_SERVICE_ONLY_AND_SESSION_BOUND', async () => {
  assert.equal(sql("select relrowsecurity and relforcerowsecurity from pg_class where oid='private.agreement_photo_uploads_v5'::regclass"), 't');
  for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(sql(`select has_table_privilege(${q(role)},'private.agreement_photo_uploads_v5','SELECT,INSERT,UPDATE,DELETE')`), 'f');
  const acl = signature => sql(`select has_function_privilege('anon',${q(signature)},'EXECUTE')::text||has_function_privilege('authenticated',${q(signature)},'EXECUTE')::text||has_function_privilege('service_role',${q(signature)},'EXECUTE')::text`);
  assert.equal(acl('public.rpc_send_agreement_photo_message_v5(uuid,uuid,integer,text,text,uuid[])'), 'falsetruefalse');
  assert.equal(acl('public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])'), 'falsetruefalse');
  assert.equal(acl('public.rpc_agreement_photo_upload_service_v5(uuid,uuid,text,uuid,integer,uuid,jsonb)'), 'falsefalsetrue');
  assert.equal(acl('public.rpc_agreement_photo_read_service_v5(uuid,uuid,uuid,uuid,uuid)'), 'falsefalsetrue');
  const claim = await newClaim(R, g);
  for (const client of [anon, R.client, W.client]) await denied(client.rpc(PHOTO_RPC, claim));
  await denied(call({...claim, p_session_id: randomUUID()}), 'AUTH_REQUIRED');
  await denied(call({...claim, p_account_id: foreign.id, p_session_id: await fx.sessionOf(foreign)}), 'MEDIA_NOT_FOUND');
}, REQ);

await h.check('REAL_SANITIZED_STORAGE_PHOTO_ONLY_CANONICAL_MESSAGE_EXACT_ORDERED_REPLAY_ONE_EVENT_BILATERAL_METADATA', async () => {
  first = await upload(R, g); second = await upload(R, g);
  const publicRead = await fetch(env.RU5_DEVICE_SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + first.path, {redirect: 'error'}); storageCalls += 1;
  assert.equal(publicRead.ok, false); void publicRead.body?.cancel();
  assert.ok((await anon.storage.from(BUCKET).download(first.path)).error); assert.ok((await W.client.storage.from(BUCKET).download(first.path)).error);
  assert.equal((await ok(byteRead(await byteArgs(R, g, first.receipt.assetId)))).path, first.path);
  // the other participant cannot read an UNATTACHED preview
  await denied(byteRead(await byteArgs(W, g, first.receipt.assetId)), 'MEDIA_NOT_FOUND');
  await denied(byteRead(await byteArgs(foreign, g, first.receipt.assetId)), 'MEDIA_NOT_FOUND');
  command = sendArgs(R, g, [first.receipt.assetId, second.receipt.assetId]);
  const pair = await Promise.all([ok(send(R, command)), ok(send(R, command))]);
  assert.deepEqual(pair[0], pair[1]); message = pair[0];
  assert.deepEqual(message, {messageId: message.messageId, agreementId: g, agreementVersion: 1, clientMessageId: command.p_client_message_id, body: '', assetIds: command.p_asset_ids});
  assert.equal(sql('select count(*) from public.user_activity_events where dedupe_key=' + q('agreement_message:' + message.messageId)), '1', 'one event');
  expectConflictResult(await send(R, {...command, p_asset_ids: [...command.p_asset_ids].reverse()}), 'MEDIA_COMMAND_CONFLICT');
  expectConflictResult(await send(R, {...command, p_body: 'changed'}), 'MEDIA_COMMAND_CONFLICT');
  expectErrorResult(await send(W, sendArgs(W, g, command.p_asset_ids)), {code: '42501', message: 'MEDIA_NOT_EDITABLE'});
  expectErrorResult(await send(R, sendArgs(R, g, [first.receipt.assetId, first.receipt.assetId])), {code: '22023', message: 'MEDIA_INPUT_INVALID'});
  expectErrorResult(await send(R, sendArgs(R, g, Array.from({length: 7}, () => randomUUID()))), {code: '22023', message: 'MEDIA_INPUT_INVALID'});
  for (const client of [anon, service]) assert.ok((await client.rpc('rpc_send_agreement_photo_message_v5', command)).error);
  const text = await ok(fx.sendText(R, g, commandKey('textwriter'), 'EX05 text writer remains canonical'));
  const metadata = await ok(meta(W, g, [message.messageId, text]));
  assert.deepEqual(metadata.messages[0].assetIds, command.p_asset_ids); assert.equal(metadata.messages[0].photos.length, 2); assert.deepEqual(metadata.messages[1].photos, []);
  assert.ok(!JSON.stringify(metadata).includes(first.path) && !JSON.stringify(metadata).includes(sha), 'metadata carries no path and no hash');
  assert.equal(sql('select read_at is null from public.agreement_messages where id=' + q(message.messageId)), 't');
  await denied(meta(foreign, g, [message.messageId]), 'MEDIA_NOT_FOUND'); await denied(meta(W, g, [message.messageId, randomUUID()]), 'MEDIA_NOT_FOUND');
  assert.equal((await ok(byteRead(await byteArgs(W, g, first.receipt.assetId, message.messageId)))).path, first.path, 'once attached, the counterpart reads the exact object');
}, REQ);

await h.check('SERVICE_PROTOCOL_CONFLICTS_ARE_PT409_AT_ALL_FOUR_SITES_AND_STALE_VERSION_IS_PT409', async () => {
  const claimKey = randomUUID(), claimed = await ok(call(await newClaim(R, g, claimKey)));
  // site 1: the key moved to another Agreement
  expectConflictResult(await call(await newClaim(R, g2, claimKey)), 'MEDIA_COMMAND_CONFLICT');
  // site 2: CLAIM with other input under the same key
  expectConflictResult(await call(await args(R, g, 'CLAIM', claimKey, {sha256: 'c'.repeat(64), byteSize: original.length, contentType: 'image/png'})), 'MEDIA_COMMAND_CONFLICT');
  // site 3: STAGE with other parameters after a STAGE
  const staged = await stage(R, g, claimed); assert.equal(staged.receipt.state, 'STAGED');
  expectConflictResult(await call(await args(R, g, 'STAGE', claimKey, {attemptId: claimed.attemptId, sha256: 'd'.repeat(64), width: image.width, height: image.height, byteSize: image.bytes.length})), 'MEDIA_COMMAND_CONFLICT');
  // site 4: SETTLE with another outcome after SETTLED
  await ok(call(await args(R, g, 'DISPATCH', claimKey)));
  await ok(service.storage.from(BUCKET).upload(staged.path, image.bytes, {contentType: 'image/jpeg', upsert: false})); storageCalls += 1;
  const settled = await ok(call(await args(R, g, 'SETTLE', claimKey, {sha256: sha, outcome: 'STORED'}))); assert.equal(settled.receipt.state, 'READY');
  expectConflictResult(await call(await args(R, g, 'SETTLE', claimKey, {sha256: sha, outcome: 'REJECTED'})), 'MEDIA_COMMAND_CONFLICT');
  // stale accepted version (agreement_photo_context_v5): the service path and the send path
  expectConflictResult(await call(await args(R, g, 'CLAIM', randomUUID(), {sha256: inputSha, byteSize: original.length, contentType: 'image/png'}, 2)), 'MEDIA_VERSION_CONFLICT');
  expectConflictResult(await send(R, sendArgs(R, g, [settled.receipt.assetId], commandKey('stale'), 'Wrong version', 2)), 'MEDIA_VERSION_CONFLICT');
}, REQ);

await h.check('CANCEL_THEN_LATE_STORE_NEVER_RESURRECTS_AND_THE_CLOSURE_BLOCKER_NAMES_THE_PENDING_UPLOAD', async () => {
  const tomb = await newClaim(R, g), cancelTomb = {...tomb, p_operation: 'CANCEL', p_input: {}};
  const cancelled = await ok(call(cancelTomb)); assert.equal(cancelled.receipt.state, 'CANCELLED'); assert.equal(cancelled.acquired, false);
  assert.equal((await ok(call(tomb))).receipt.state, 'CANCELLED', 'a claim after an absent CANCEL stays cancelled');
  const late = await ok(call(await newClaim(R, g))), lateStage = await stage(R, g, late);
  await ok(call(await args(R, g, 'DISPATCH', late.receipt.clientRequestId)));
  const cancel = await ok(call(await args(R, g, 'CANCEL', late.receipt.clientRequestId))); assert.equal(cancel.receipt.state, 'CANCELLED');
  assert.ok(JSON.parse(sql(`select to_jsonb(private.closure_blockers_v5(${q(R.id)}::uuid))`)).includes('MEDIA_UPLOAD_PENDING'));
  await ok(service.storage.from(BUCKET).upload(lateStage.path, image.bytes, {contentType: 'image/jpeg', upsert: false})); storageCalls += 1;
  const settled = await ok(call(await args(R, g, 'SETTLE', late.receipt.clientRequestId, {sha256: sha, outcome: 'STORED'})));
  assert.equal(settled.receipt.state, 'CANCELLED'); assert.equal(settled.dispatchOutcome, 'STORED');
  expectErrorResult(await send(R, sendArgs(R, g, [late.receipt.assetId])), {code: '42501', message: 'MEDIA_NOT_EDITABLE'});
}, REQ);

await h.check('BLOCK_AND_NEW_ACCEPTED_VERSION_AND_TERMINAL_KEEP_CANONICAL_HISTORY_BILATERAL_AND_REFUSE_NEW_CONTACT', async () => {
  const versioned = await upload(W, g);
  await block(true);
  try {
    expectErrorResult(await call(await newClaim(R, g)), {message: 'INTERACTION_BLOCKED'});
    expectErrorResult(await send(W, sendArgs(W, g, [versioned.receipt.assetId])), {message: 'INTERACTION_BLOCKED'});
    assert.equal((await ok(meta(W, g, [message.messageId]))).messages[0].photos.length, 2, 'blocked history stays readable');
    assert.equal((await ok(byteRead(await byteArgs(W, g, first.receipt.assetId, message.messageId)))).path, first.path);
  } finally { await block(false); }
  const proposal = await ok(R.client.rpc('rpc_propose_agreement_change_v2', {p_agreement_id: g, p_expected_version: 1, p_patch: {price_rsd: 4777}, p_reason: 'EX05-S01 new accepted version', p_client_request_id: randomUUID()}));
  assert.equal((await ok(W.client.rpc('rpc_respond_agreement_change', {p_proposal_id: proposal, p_accept: true}))).agreementVersion, 2);
  assert.equal((await ok(meta(W, g, [message.messageId]))).messages[0].agreementVersion, 1, 'the message stays bound to the version it was sent under');
  assert.equal((await ok(byteRead(await byteArgs(W, g, first.receipt.assetId, message.messageId)))).sha256, sha);
  expectConflictResult(await send(W, sendArgs(W, g, [versioned.receipt.assetId])), 'MEDIA_VERSION_CONFLICT');
  await ok(W.client.rpc('rpc_mark_work_done', {p_agreement_id: g})); await ok(R.client.rpc('rpc_confirm_completion', {p_agreement_id: g}));
  assert.deepEqual(await ok(send(R, command)), message, 'a terminal Agreement still acknowledges the original photo command');
  assert.equal((await ok(byteRead(await byteArgs(W, g, first.receipt.assetId, message.messageId)))).sha256, sha);
  expectErrorResult(await call(await newClaim(R, g)), {message: 'MEDIA_NOT_EDITABLE'});
}, {requires: ['REAL_SANITIZED_STORAGE_PHOTO_ONLY_CANONICAL_MESSAGE_EXACT_ORDERED_REPLAY_ONE_EVENT_BILATERAL_METADATA']});

await h.check('STORAGE_UPSERT_MOVE_DELETE_DENIED_OLD_VERSION_AND_HASH_PRESERVED_IMMUTABLE_MESSAGE_LINK', async () => {
  const before = rows(`select version from storage.objects where bucket_id=${q(BUCKET)} and name=${q(first.path)}`)[0].version;
  const changed = new Uint8Array(image.bytes); changed[changed.length - 4] ^= 1;
  assert.ok((await service.storage.from(BUCKET).upload(first.path, changed, {contentType: 'image/jpeg', upsert: true})).error);
  assert.ok((await service.storage.from(BUCKET).move(first.path, first.path + '.other')).error);
  assert.ok((await service.storage.from(BUCKET).remove([first.path])).error); storageCalls += 3;
  assert.equal(rows(`select version from storage.objects where bucket_id=${q(BUCKET)} and name=${q(first.path)}`)[0].version, before);
  assert.equal(createHash('sha256').update(new Uint8Array(await (await ok(service.storage.from(BUCKET).download(first.path))).arrayBuffer())).digest('hex'), sha); storageCalls += 1;
  assert.throws(() => sql(`update private.agreement_photo_uploads_v5 set storage_path=storage_path||'.changed' where id=${q(first.receipt.assetId)}`));
  assert.throws(() => sql(`update public.agreement_messages set photo_asset_ids='{}' where id=${q(message.messageId)}`));
}, {requires: ['REAL_SANITIZED_STORAGE_PHOTO_ONLY_CANONICAL_MESSAGE_EXACT_ORDERED_REPLAY_ONE_EVENT_BILATERAL_METADATA']});

await h.check('EXPLICIT_ONE_MESSAGE_SUPPORT_SNAPSHOT_GIVES_ONLY_THE_SELECTED_PHOTOS_TO_THE_OWNER_CASE_AND_SESSION', async () => {
  const payload = {channel: 'LEGAL_PRIVACY', topic: 'PRIVACY_RIGHTS', title: 'Selected message photograph', body: 'I explicitly select this one message', desiredOutcome: null, context: null,
    evidence: [{kind: 'AGREEMENT_MESSAGE', id: message.messageId, revision: 1}]};
  const support = await ok(W.client.rpc('rpc_support_submit_v5', {p_expected_user_id: W.id, p_client_request_id: randomUUID(), p_kind: 'CREATE', p_case_id: null, p_expected_revision: null, p_payload_text: JSON.stringify(payload)}));
  const selected = await ok(W.client.rpc('rpc_support_detail_v5', {p_expected_user_id: W.id, p_case_id: support.caseId, p_after_sequence: '0'}));
  assert.equal(selected.evidence[0].reference.content.media.length, 2);
  const caseArgs = {p_account_id: W.id, p_session_id: await fx.sessionOf(W), p_case_id: support.caseId, p_asset_id: first.receipt.assetId};
  assert.equal((await ok(service.rpc('rpc_support_media_service_v5', caseArgs))).path, first.path);
  const stray = await upload(W, g2);
  await denied(service.rpc('rpc_support_media_service_v5', {...caseArgs, p_asset_id: stray.receipt.assetId}), 'SUPPORT_REFERENCE_NOT_AVAILABLE');
  await denied(service.rpc('rpc_support_media_service_v5', {...caseArgs, p_account_id: foreign.id, p_session_id: await fx.sessionOf(foreign)}), 'SUPPORT_REFERENCE_NOT_AVAILABLE');
}, {requires: ['REAL_SANITIZED_STORAGE_PHOTO_ONLY_CANONICAL_MESSAGE_EXACT_ORDERED_REPLAY_ONE_EVENT_BILATERAL_METADATA']});

await h.check('ROLLING_QUOTA_IS_ENFORCED_REPLAY_ADMITS_NOTHING_EXTRA_AND_A_CLOSING_ACCOUNT_IS_REFUSED', async () => {
  const used = Number(sql(`select count(*) from private.agreement_photo_uploads_v5 where account_id=${q(W.id)} and admitted_at>clock_timestamp()-interval '24 hours'`));
  sql(`insert into private.agreement_photo_uploads_v5(account_id,agreement_id,agreement_version,client_request_id,state,input_sha256,input_bytes,input_type,admitted_at)
    select ${q(W.id)}::uuid,${q(g2)}::uuid,1,gen_random_uuid(),'PROCESSING',${q(inputSha)},${original.length},'image/png',clock_timestamp()-interval '2 minutes' from generate_series(1,${Math.max(0, 120 - used)})`);
  expectErrorResult(await call(await newClaim(W, g2)), {code: '54000', message: 'MEDIA_RATE_LIMITED'});
  const untouched = await args(R, g2, 'CANCEL'); await ok(call(untouched));
  const countBefore = sql(`select count(*) from private.agreement_photo_uploads_v5 where account_id=${q(R.id)} and admitted_at is not null`);
  await ok(call(untouched));
  assert.equal(sql(`select count(*) from private.agreement_photo_uploads_v5 where account_id=${q(R.id)} and admitted_at is not null`), countBefore, 'a replayed CANCEL admits nothing');
  const closing = Number(sql(`select count(*) from private.account_closure_requests where account_id=${q(R.id)}`));
  assert.equal(closing, 0, 'the fixture account has no closure request');
  sql(SQL.insertClosureRequest(R.id));
  try { expectErrorResult(await call(await newClaim(R, g2)), {message: 'ACCOUNT_CLOSING'}); } finally { sql(SQL.deleteClosureRequest(R.id)); }
}, REQ);

await h.check('OWN_EXPORT_HAS_THE_AUTHORS_PHOTOS_ONLY_NO_PIXELS_AND_NO_TRANSFER_SECRETS', async () => {
  const catalog = JSON.parse(sql('select private.data_export_dataset_catalog()'));
  const config = {delivery: {datasets: catalog.map(d => ({key: d.key, mode: 'INCLUDE', fields: d.fields}))}};
  const snapshot = accountId => JSON.parse(sql(`select private.data_export_snapshot(${q(accountId)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(config))}::jsonb,clock_timestamp())`));
  const own = snapshot(R.id), other = snapshot(foreign.id);
  assert.ok(Object.hasOwn(own.datasets, 'ownAgreementPhotos') && Object.hasOwn(own.datasets, 'ownAgreementMessages'));
  assert.ok(own.datasets.ownAgreementPhotos.some(item => item.id === first.receipt.assetId));
  assert.deepEqual(own.datasets.ownAgreementMessages.find(item => item.id === message.messageId).assetIds, command.p_asset_ids);
  assert.ok(!JSON.stringify(other).includes(first.receipt.assetId), 'another account sees none of it');
  for (const photo of own.datasets.ownAgreementPhotos) {
    assert.equal(photo.bytesIncluded, false);
    assert.ok(!Object.keys(photo).some(key => /path|sha|key|attempt|input|session/i.test(key)), 'no path, hash, key, attempt, input or session field');
  }
}, {requires: ['REAL_SANITIZED_STORAGE_PHOTO_ONLY_CANONICAL_MESSAGE_EXACT_ORDERED_REPLAY_ONE_EVENT_BILATERAL_METADATA']});

h.setFlag('storageCalls', storageCalls);
await h.catalogGuardCheck();
process.exitCode = h.finish();
