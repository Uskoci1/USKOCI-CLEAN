// EX05-S01 UPDATED COPY - voice messages (Voice B1, ledger 215) on the disposable chain that carries the EXACT DEV APPLICATION FILE. Disposable local Auth / PostgREST / Postgres / Storage
// only: no provider, no DEV, no device, and the audio is a structural M4A fixture (opaque access units), NOT decoded or native audio.
// Frozen original (NOT edited, kept as history): supabase/proofs/chat/voice_b1_feature_proof.mjs (16 checks, run 36786883950 on the B1-a CANDIDATE chain). WHY a copy: the original applies
// supabase/candidates/chat_voice_b1a_feature_chain.sql itself and asserts the chain is UNCERTIFIED afterwards, so it cannot run on the chain DEV actually has (the ONE-statement
// chat_voice_b1_dev_application.sql, applied after B24 Part 2); the DEV-application proofs (36784486016, 36785614498, 36788595185: 17/17, closures, export, support, Edge) never repeat
// the upload / send / read behaviour, and the original checks every refusal by MESSAGE only (rt.denied), which cannot see the conflict code. THE DIFF, all of it:
//   * no candidate apply, no predecessor-drift check, no "UNCERTIFIED until B1-b" check: replaced by "the certificate is BOUND after the DEV application" (ready, live == certified, binding);
//   * every conflict is checked as code PT409 + message + HTTP 409 through the real PostgREST (lib/runner.mjs expectConflictResult): claim with other input, stale version, same-key send
//     with another asset or version, settle after a rejected outcome;
//   * the other refusals additionally assert their SQLSTATE where the DEV body fixes it (42501 MEDIA_NOT_FOUND / MEDIA_NOT_EDITABLE, 22023 MEDIA_INPUT_INVALID, 28000 AUTH_CONTEXT_CHANGED);
//   * added: the B3c invalidation cache counts a voice insert.
// What this does NOT show (README): the hosted Deno runtime, a real HTTP/JWT call to the Edge voice operations, a real recorder file, a real account closure after the re-bind.
// Every check runs even after an earlier one failed (lib/runner.mjs).
import * as rt from '../pre_v3/closure_runtime.mjs';
import {createProofHarness, assertChainFacts, CHAIN_FACTS_SQL} from './lib/harness.mjs';
import {expectConflictResult, expectErrorResult} from './lib/runner.mjs';
import {createFixtures, commandKey, UUID_PATTERN} from './lib/fixtures.mjs';
import {createVoiceFixtures, sha256, VOICE_BUCKET, VOICE_UPLOAD_RPC, VOICE_READ_RPC, voiceKey} from './lib/voice_fixtures.mjs';
import {SQL} from './lib/sql_snippets.mjs';

const {assert, sql, rows, q, ok, denied, anon, service, env, randomUUID} = rt;
const SOURCES = ['supabase/proofs/ex05_s01/ex05_s01_voice_proof.mjs', 'supabase/proofs/ex05_s01/lib/runner.mjs', 'supabase/proofs/ex05_s01/lib/harness.mjs',
  'supabase/proofs/ex05_s01/lib/fixtures.mjs', 'supabase/proofs/ex05_s01/lib/voice_fixtures.mjs', 'supabase/proofs/ex05_s01/lib/sql_snippets.mjs',
  'supabase/proofs/chat/voice_m4a_fixture.mjs', 'supabase/proofs/pre_v3/closure_runtime.mjs'];
const h = createProofHarness({rt, unit: 'EX05_S01_VOICE', reportName: 'ex05-s01-voice-report.json', sources: SOURCES});
const fx = createFixtures(rt);
const vf = createVoiceFixtures(rt, fx);
let storageCalls = 0;
const PAGE2 = 'public.rpc_read_agreement_messages_page_v2(uuid,uuid,integer,timestamptz,uuid)';
const WINDOW2 = 'public.rpc_read_agreement_message_window_v2(uuid,uuid,uuid,integer,integer)';
const SEND_VOICE = 'public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)';
const MESSAGE_KEYS_V2 = ['agreementVersion', 'body', 'clientMessageId', 'createdAt', 'kind', 'messageId', 'mine', 'photos', 'senderAccountId', 'voice'];
const MESSAGE_KEYS_V1 = MESSAGE_KEYS_V2.filter(key => key !== 'voice');

await h.sourceCheck();
if (!(await h.requireChain('CHAIN_IS_THE_POST_B24_POST_VOICE_STATE', async () => assertChainFacts(JSON.parse(sql(CHAIN_FACTS_SQL)))))) process.exit(h.finish());
h.beginCatalogGuard();

const closure = () => rows(`select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,
  private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5() binding`)[0];
const exists = signature => sql(`select (to_regprocedure(${q(signature)}) is not null)::text`) === 'true';
const eventRead = id => rows(`select read_at from public.user_activity_events where dedupe_key=${q('agreement_message:' + id)}`)[0]?.read_at ?? null;

let party, requester, worker, stranger, agreementId, otherAgreementId;
const FIXTURE = 'FIXTURE_REAL_ACCOUNTS_AND_TWO_AGREEMENTS';
await h.check(FIXTURE, async () => {
  party = await fx.prepareParty('ex05-voice'); ({requester, worker, stranger} = party);
  agreementId = await fx.agreementOf(party, 'EX05-S01 voice one'); otherAgreementId = await fx.agreementOf(party, 'EX05-S01 voice two');
});
const REQ = {requires: [FIXTURE]};
const page = (who, version = 'v2', cursor = null, limit = 50, agreement = agreementId) => who.client.rpc(`rpc_read_agreement_messages_page_${version}`,
  {p_expected_user_id: who.id, p_agreement_id: agreement, p_limit: limit, p_before_created_at: cursor?.createdAt ?? null, p_before_id: cursor?.messageId ?? null});
const windowOf = (who, target, version = 'v2', before = 24, after = 25, agreement = agreementId) => who.client.rpc(`rpc_read_agreement_message_window_${version}`,
  {p_expected_user_id: who.id, p_agreement_id: agreement, p_target_message_id: target, p_before_count: before, p_after_count: after});

await h.check('TABLE_BUCKET_AND_FUNCTION_AUTHORITY_ARE_EXACT', async () => {
  assert.equal(sql("select relrowsecurity::text||relforcerowsecurity::text from pg_class where oid='private.agreement_voice_uploads_v1'::regclass"), 'truetrue');
  for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(sql(`select has_table_privilege(${q(role)},'private.agreement_voice_uploads_v1','SELECT,INSERT,UPDATE,DELETE')::text`), 'false');
  assert.deepEqual(rows("select public,file_size_limit,allowed_mime_types from storage.buckets where id='agreement-voice'"), [{public: false, file_size_limit: 4194304, allowed_mime_types: ['audio/mp4']}]);
  const acl = signature => sql(`select has_function_privilege('anon',${q(signature)},'EXECUTE')::text||has_function_privilege('authenticated',${q(signature)},'EXECUTE')::text||has_function_privilege('service_role',${q(signature)},'EXECUTE')::text`);
  assert.equal(acl('public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)'), 'falsefalsetrue');
  assert.equal(acl('public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)'), 'falsefalsetrue');
  for (const signature of [PAGE2, WINDOW2, SEND_VOICE, 'public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)', 'public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)'])
    assert.equal(acl(signature), 'falsetruefalse', signature);
});

await h.check('CERTIFICATE_IS_BOUND_AFTER_THE_DEV_APPLICATION_NOT_UNCERTIFIED', async () => {
  const state = closure();
  assert.equal(state.ready, true); assert.equal(state.live, state.certified);
  assert.ok(state.binding && state.binding.sourceSha256 === state.live, 'the erasure binding carries the live digest');
  assert.equal(exists(SEND_VOICE), true);
});

await h.check('SERVICE_PROTOCOL_IS_SERVICE_ROLE_ONLY_AND_SESSION_BOUND', async () => {
  const request = await vf.svcArgs(requester, 'CLAIM', randomUUID(), agreementId, vf.claimInput());
  for (const client of [anon, requester.client, worker.client]) await denied(client.rpc(VOICE_UPLOAD_RPC, request));
  await denied(service.rpc(VOICE_UPLOAD_RPC, {...request, p_session_id: randomUUID()}), 'AUTH_REQUIRED');
  await denied(service.rpc(VOICE_UPLOAD_RPC, {...request, p_account_id: stranger.id, p_session_id: await fx.sessionOf(stranger)}), 'MEDIA_NOT_FOUND');
  await denied(service.rpc(VOICE_UPLOAD_RPC, {...request, p_operation: 'BOGUS'}), 'MEDIA_INPUT_INVALID');
}, REQ);

await h.check('CLAIM_VALIDATES_AND_IS_IDEMPOTENT_AND_ITS_CONFLICTS_ARE_PT409', async () => {
  const key = randomUUID();
  const a = await vf.svc(requester, 'CLAIM', key, agreementId, vf.claimInput()); assert.equal(a.acquired, true); assert.equal(a.receipt.state, 'PROCESSING');
  assert.equal(a.receipt.voice, null); assert.equal(a.path, null);
  const b = await vf.svc(requester, 'CLAIM', key, agreementId, vf.claimInput()); assert.equal(b.acquired, false); assert.equal(b.receipt.assetId, a.receipt.assetId);
  expectConflictResult(await vf.svcRaw(requester, 'CLAIM', key, agreementId, vf.claimInput(vf.otherSha, vf.otherAudio.length)), 'MEDIA_COMMAND_CONFLICT');
  // A stale version is refused by the Agreement context first; the stored-command check catches a same-key call that names another version without writing.
  expectConflictResult(await vf.svcRaw(requester, 'CLAIM', key, agreementId, vf.claimInput(), 2), 'MEDIA_VERSION_CONFLICT');
  expectConflictResult(await vf.svcRaw(requester, 'READ', key, agreementId, {}, 2), 'MEDIA_COMMAND_CONFLICT');
  for (const bad of [vf.claimInput(vf.audioSha, vf.audio.length, 'audio/mpeg'), vf.claimInput(vf.audioSha, 4194305), vf.claimInput('x'.repeat(64)), {...vf.claimInput(), extra: 1}, {}])
    expectErrorResult(await vf.svcRaw(requester, 'CLAIM', randomUUID(), agreementId, bad), {code: '22023', message: 'MEDIA_INPUT_INVALID'});
  expectConflictResult(await vf.svcRaw(requester, 'CLAIM', randomUUID(), agreementId, vf.claimInput(), 9), 'MEDIA_VERSION_CONFLICT');
  expectErrorResult(await vf.svcRaw(stranger, 'CLAIM', randomUUID(), agreementId, vf.claimInput()), {code: '42501', message: 'MEDIA_NOT_FOUND'});
  await vf.svc(requester, 'CANCEL', key, agreementId);
  assert.equal((await vf.svc(requester, 'READ', key, agreementId)).receipt.state, 'CANCELLED');
}, REQ);

await h.check('STAGE_BINDS_THE_CLAIM_AND_DISPATCH_IS_EXACTLY_ONCE_AND_SETTLE_AFTER_REJECTION_IS_PT409', async () => {
  const key = randomUUID(), c = await vf.svc(requester, 'CLAIM', key, agreementId, vf.claimInput());
  for (const bad of [vf.stageInput(c, vf.otherSha), vf.stageInput(c, vf.audioSha, vf.audio.length + 1), vf.stageInput(c, vf.audioSha, vf.audio.length, 299), vf.stageInput(c, vf.audioSha, vf.audio.length, 300001),
    {...vf.stageInput(c), attemptId: randomUUID()}, {...vf.stageInput(c), extra: true}])
    expectErrorResult(await vf.svcRaw(requester, 'STAGE', key, agreementId, bad), {code: '22023', message: 'MEDIA_INPUT_INVALID'});
  const s = await vf.svc(requester, 'STAGE', key, agreementId, vf.stageInput(c));
  assert.equal(s.path, `${requester.id}/agreement-voice-v1/${c.receipt.assetId}/${vf.audioSha}.m4a`); assert.equal(s.durationMs, vf.audioMs); assert.equal(s.byteSize, vf.audio.length);
  assert.equal((await vf.svc(requester, 'STAGE', key, agreementId, vf.stageInput(c))).receipt.state, 'STAGED');
  assert.equal((await vf.svc(requester, 'DISPATCH', key, agreementId)).acquired, true); assert.equal((await vf.svc(requester, 'DISPATCH', key, agreementId)).acquired, false);
  expectErrorResult(await vf.svcRaw(requester, 'SETTLE', key, agreementId, {sha256: vf.otherSha, outcome: 'STORED'}), {code: '22023', message: 'MEDIA_INPUT_INVALID'});
  const failed = await vf.svc(requester, 'SETTLE', key, agreementId, {sha256: vf.audioSha, outcome: 'REJECTED'}); assert.equal(failed.receipt.state, 'FAILED');
  expectConflictResult(await vf.svcRaw(requester, 'SETTLE', key, agreementId, {sha256: vf.audioSha, outcome: 'STORED'}), 'MEDIA_COMMAND_CONFLICT');
}, REQ);

let first;
await h.check('REAL_STORAGE_ROUND_TRIP_IS_PRIVATE_IMMUTABLE_AND_SETTLES_READY', async () => {
  first = await vf.fullUpload(requester, agreementId); storageCalls += 2;
  const blob = await ok(service.storage.from(VOICE_BUCKET).download(first.path)); storageCalls += 1;
  assert.equal(sha256(new Uint8Array(await blob.arrayBuffer())), vf.audioSha);
  const publicRead = await fetch(env.RU5_DEVICE_SUPABASE_URL + '/storage/v1/object/public/' + VOICE_BUCKET + '/' + first.path, {redirect: 'error'}); storageCalls += 1;
  assert.equal(publicRead.ok, false); void publicRead.body?.cancel();
  for (const client of [anon, requester.client, worker.client]) {
    assert.ok((await client.storage.from(VOICE_BUCKET).download(first.path)).error, 'CLIENT_DOWNLOAD_MUST_FAIL');
    assert.ok((await client.storage.from(VOICE_BUCKET).upload(`${requester.id}/agreement-voice-v1/${randomUUID()}/x.m4a`, vf.audio, {contentType: 'audio/mp4'})).error, 'CLIENT_UPLOAD_MUST_FAIL');
    storageCalls += 2;
  }
  assert.ok((await service.storage.from(VOICE_BUCKET).upload(first.path, vf.otherAudio, {contentType: 'audio/mp4', upsert: true})).error, 'OVERWRITE_MUST_FAIL');
  await service.storage.from(VOICE_BUCKET).remove([first.path]); // the guard refuses the delete; whatever the API answers, the object must still be there
  assert.equal(sha256(new Uint8Array(await (await ok(service.storage.from(VOICE_BUCKET).download(first.path))).arrayBuffer())), vf.audioSha); storageCalls += 3;
  const list = await vf.svc(requester, 'LIST', randomUUID(), agreementId); // LIST ignores the key
  assert.ok(list.uploads.some(item => item.assetId === first.transfer.receipt.assetId && item.state === 'READY'));
}, REQ);

await h.check('PLAYBACK_AUTHORIZATION_NAMES_THE_EXACT_OBJECT_FOR_THE_RIGHT_PEOPLE_ONLY', async () => {
  const assetId = first.transfer.receipt.assetId;
  const read = who => async (asset, message = null) => service.rpc(VOICE_READ_RPC, {p_account_id: who.id, p_session_id: await fx.sessionOf(who), p_agreement_id: agreementId, p_asset_id: asset, p_message_id: message});
  assert.deepEqual(await ok(await read(requester)(assetId)), {assetId, agreementId, messageId: null, bucket: VOICE_BUCKET, path: first.path, sha256: vf.audioSha, contentType: 'audio/mp4',
    byteSize: vf.audio.length, durationMs: vf.audioMs, authoritative: true});
  await denied(await read(worker)(assetId), 'MEDIA_NOT_FOUND'); await denied(await read(stranger)(assetId), 'MEDIA_NOT_FOUND');
  const anonymous = {p_account_id: requester.id, p_session_id: randomUUID(), p_agreement_id: agreementId, p_asset_id: assetId, p_message_id: null};
  await denied(service.rpc(VOICE_READ_RPC, anonymous), 'AUTH_REQUIRED'); await denied(anon.rpc(VOICE_READ_RPC, anonymous));
}, {requires: [FIXTURE, 'REAL_STORAGE_ROUND_TRIP_IS_PRIVATE_IMMUTABLE_AND_SETTLES_READY']});

let sent, unsent;
await h.check('SEND_IS_ATOMIC_IDEMPOTENT_AND_EVERY_WRONG_CASE_IS_REFUSED_WITH_ITS_CODE', async () => {
  const assetId = first.transfer.receipt.assetId, key = voiceKey();
  const pair = await Promise.all([ok(vf.sendVoice(requester, agreementId, assetId, key)), ok(vf.sendVoice(requester, agreementId, assetId, key))]);
  assert.deepEqual(pair[0], pair[1]); sent = pair[0];
  assert.deepEqual(Object.keys(sent).sort(), ['agreementId', 'agreementVersion', 'clientMessageId', 'messageId', 'voiceAssetId']);
  assert.equal(sent.voiceAssetId, assetId); assert.equal(sent.clientMessageId, key);
  assert.equal(sql(`select count(*) from public.user_activity_events where dedupe_key=${q('agreement_message:' + sent.messageId)}`), '1');
  assert.equal(sql(`select count(*) from public.agreement_messages where sender_account_id=${q(requester.id)} and client_message_id=${q(key)}`), '1');
  assert.equal(sql(`select attached_message_id from private.agreement_voice_uploads_v1 where id=${q(assetId)}`), sent.messageId);
  const other = await vf.fullUpload(requester, agreementId); storageCalls += 1; const otherAsset = other.transfer.receipt.assetId;
  expectConflictResult(await vf.sendVoice(requester, agreementId, otherAsset, key), 'MEDIA_COMMAND_CONFLICT');
  expectConflictResult(await vf.sendVoice(requester, agreementId, assetId, key, 2), 'MEDIA_COMMAND_CONFLICT');
  expectConflictResult(await vf.sendVoice(requester, agreementId, otherAsset, undefined, 2), 'MEDIA_VERSION_CONFLICT');
  expectErrorResult(await vf.sendVoice(worker, agreementId, otherAsset), {code: '42501', message: 'MEDIA_NOT_EDITABLE'});
  expectErrorResult(await vf.sendVoice(stranger, agreementId, otherAsset), {code: '42501', message: 'MEDIA_NOT_FOUND'});
  expectErrorResult(await vf.sendVoice(requester, agreementId, assetId), {code: '42501', message: 'MEDIA_NOT_EDITABLE'});
  expectErrorResult(await vf.sendVoice(requester, agreementId, randomUUID()), {code: '42501', message: 'MEDIA_NOT_EDITABLE'});
  expectErrorResult(await vf.sendVoice(requester, agreementId, otherAsset, 'bad key'), {code: '22023', message: 'MEDIA_INPUT_INVALID'});
  expectErrorResult(await requester.client.rpc('rpc_send_agreement_voice_message_v1', {p_expected_user_id: worker.id, p_agreement_id: agreementId, p_expected_version: 1,
    p_client_message_id: voiceKey(), p_asset_id: otherAsset}), {code: '28000', message: 'AUTH_CONTEXT_CHANGED'});
  assert.ok((await anon.rpc('rpc_send_agreement_voice_message_v1', {p_expected_user_id: requester.id, p_agreement_id: agreementId, p_expected_version: 1, p_client_message_id: voiceKey(), p_asset_id: otherAsset})).error);
  unsent = other;
}, {requires: [FIXTURE, 'REAL_STORAGE_ROUND_TRIP_IS_PRIVATE_IMMUTABLE_AND_SETTLES_READY']});

await h.check('DATABASE_GUARDS_FREEZE_MESSAGE_ASSET_AND_OBJECT', async () => {
  const assetId = first.transfer.receipt.assetId;
  assert.throws(() => sql(`update public.agreement_messages set voice_asset_id=null where id=${q(sent.messageId)}`), /MEDIA_MESSAGE_IMMUTABLE/);
  assert.throws(() => sql(`update public.agreement_messages set body='changed' where id=${q(sent.messageId)}`), /MEDIA_MESSAGE_IMMUTABLE/);
  assert.throws(() => sql(`delete from private.agreement_voice_uploads_v1 where id=${q(assetId)}`), /MEDIA_ASSET_IMMUTABLE/);
  assert.throws(() => sql(`update private.agreement_voice_uploads_v1 set state='FAILED' where id=${q(assetId)}`), /MEDIA_ASSET_IMMUTABLE/);
  assert.throws(() => sql(`update private.agreement_voice_uploads_v1 set storage_path=storage_path||'x' where id=${q(assetId)}`), /MEDIA_ASSET_IMMUTABLE|violates check constraint/);
  assert.throws(() => sql(`delete from storage.objects where bucket_id='agreement-voice' and name=${q(first.path)}`), /MEDIA_ASSET_IMMUTABLE|permission denied|Direct deletion from storage tables is not allowed/);
  assert.throws(() => sql(`update storage.objects set name=name||'x' where bucket_id='agreement-voice' and name=${q(first.path)}`), /MEDIA_ASSET_IMMUTABLE|permission denied|not allowed/);
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='agreement-voice' and name=${q(first.path)}`), '1');
  // The kind-exclusive check: a voice row never has a body or photos; a text row never lacks both.
  assert.throws(() => sql(`insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,client_message_id,body,voice_asset_id)
    values(${q(agreementId)},1,${q(requester.id)},${q(voiceKey())},'text',${q(unsent.transfer.receipt.assetId)})`), /agreement_messages_body_media_check|MEDIA_/);
  assert.throws(() => sql(`insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,client_message_id,body)
    values(${q(agreementId)},1,${q(requester.id)},${q(commandKey('emptytext'))},'')`), /agreement_messages_body_media_check/);
}, {requires: [FIXTURE, 'SEND_IS_ATOMIC_IDEMPOTENT_AND_EVERY_WRONG_CASE_IS_REFUSED_WITH_ITS_CODE']});

await h.check('HISTORY_V2_CARRIES_KIND_VOICE_AND_EXACT_METADATA', async () => {
  const p = await ok(page(worker)); assert.equal(p.schema, 'AGREEMENT_MESSAGES_PAGE_V2');
  const row = p.messages.find(item => item.messageId === sent.messageId); assert.ok(row);
  assert.equal(row.kind, 'VOICE'); assert.equal(row.body, ''); assert.deepEqual(row.photos, []);
  assert.deepEqual(row.voice, {assetId: first.transfer.receipt.assetId, durationMs: vf.audioMs, byteSize: vf.audio.length, contentType: 'audio/mp4'});
  assert.deepEqual(Object.keys(row).sort(), MESSAGE_KEYS_V2); assert.equal(row.mine, false);
  assert.equal((await ok(page(requester))).messages.find(item => item.messageId === sent.messageId).mine, true);
  const w = await ok(windowOf(worker, sent.messageId)); assert.equal(w.schema, 'AGREEMENT_MESSAGE_WINDOW_V2'); assert.equal(w.targetMessageId, sent.messageId);
  assert.deepEqual(w.messages.find(item => item.messageId === sent.messageId).voice, row.voice);
  await denied(page(stranger), 'MEDIA_NOT_FOUND'); await denied(windowOf(stranger, sent.messageId), 'MEDIA_NOT_FOUND');
  await denied(windowOf(worker, randomUUID()), 'CHAT_MESSAGE_NOT_AVAILABLE');
  await denied(anon.rpc('rpc_read_agreement_messages_page_v2', {p_expected_user_id: worker.id, p_agreement_id: agreementId}));
}, {requires: [FIXTURE, 'SEND_IS_ATOMIC_IDEMPOTENT_AND_EVERY_WRONG_CASE_IS_REFUSED_WITH_ITS_CODE']});

await h.check('HISTORY_V1_SHOWS_AN_OLD_BUILD_A_TEXT_NOTICE_WITH_THE_EXACT_V1_KEY_SET', async () => {
  const p = await ok(page(worker, 'v1')); assert.equal(p.schema, 'AGREEMENT_MESSAGES_PAGE_V1');
  const row = p.messages.find(item => item.messageId === sent.messageId); assert.ok(row);
  assert.equal(row.kind, 'TEXT'); assert.equal(row.body, 'Glasovna poruka. Ažuriraj aplikaciju da je poslušaš.'); assert.deepEqual(row.photos, []);
  assert.deepEqual(Object.keys(row).sort(), MESSAGE_KEYS_V1);
  for (const message of p.messages) assert.ok(['TEXT', 'PHOTO'].includes(message.kind) && message.body !== undefined && !('voice' in message));
  const w = await ok(windowOf(worker, sent.messageId, 'v1')); assert.equal(w.schema, 'AGREEMENT_MESSAGE_WINDOW_V1');
  assert.equal(w.messages.find(item => item.messageId === sent.messageId).kind, 'TEXT');
  assert.deepEqual(Object.keys(p).sort(), ['accountId', 'agreementId', 'asOf', 'authoritative', 'messages', 'olderCursor', 'schema']);
}, {requires: [FIXTURE, 'SEND_IS_ATOMIC_IDEMPOTENT_AND_EVERY_WRONG_CASE_IS_REFUSED_WITH_ITS_CODE']});

await h.check('PAGING_TEXT_PHOTO_AND_VOICE_STAY_ORDERED_AND_ACKNOWLEDGEMENT_IS_KIND_AGNOSTIC', async () => {
  const text = await ok(fx.sendText(requester, agreementId, commandKey('between'), 'Text between voice messages'));
  const photo = await ok(fx.sendPhoto(worker, agreementId, [fx.photoFixtureRow(worker, agreementId)]));
  const last = await ok(vf.sendVoice(worker, agreementId, (await vf.fullUpload(worker, agreementId)).transfer.receipt.assetId)); storageCalls += 1;
  const full = await ok(page(requester));
  const order = rows(`select id from public.agreement_messages where agreement_id=${q(agreementId)} order by created_at,id`).map(item => item.id);
  assert.deepEqual(full.messages.map(item => item.messageId), order);
  assert.deepEqual(full.messages.map(item => item.kind).filter((kind, index, all) => all.indexOf(kind) === index).sort(), ['PHOTO', 'TEXT', 'VOICE']);
  const newest = await ok(page(requester, 'v2', null, 2)); assert.deepEqual(newest.messages.map(item => item.messageId), order.slice(-2));
  const older = await ok(page(requester, 'v2', newest.olderCursor, 2)); assert.deepEqual(older.messages.map(item => item.messageId), order.slice(-4, -2));
  const mark = messageIds => requester.client.rpc('rpc_mark_displayed_agreement_messages_v1', {p_expected_user_id: requester.id, p_agreement_id: agreementId, p_message_ids: messageIds});
  const receipt = await ok(mark([last.messageId, photo.messageId, text]));
  assert.equal(receipt.markedEventCount, 2); assert.ok(eventRead(last.messageId)); assert.ok(eventRead(photo.messageId)); assert.equal(eventRead(text), null);
}, {requires: [FIXTURE, 'SEND_IS_ATOMIC_IDEMPOTENT_AND_EVERY_WRONG_CASE_IS_REFUSED_WITH_ITS_CODE']});

await h.check('B3C_INVALIDATION_COUNTS_A_VOICE_INSERT_AND_A_REPLAY_ADDS_NOTHING', async () => {
  const revision = () => rows(SQL.invalidationRevision(agreementId))[0].revision;
  const before = revision(), key = voiceKey();
  const upload = await vf.fullUpload(worker, agreementId); storageCalls += 1;
  await ok(vf.sendVoice(worker, agreementId, upload.transfer.receipt.assetId, key));
  assert.equal(revision(), before + 1, 'a voice message counts like any message insert');
  await ok(vf.sendVoice(worker, agreementId, upload.transfer.receipt.assetId, key));
  assert.equal(revision(), before + 1, 'a replay inserts no row');
  const seen = await ok(requester.client.from('agreement_invalidations_v1').select('agreement_id,revision').eq('agreement_id', agreementId));
  assert.deepEqual(seen, [{agreement_id: agreementId, revision: before + 1}]);
}, {requires: [FIXTURE, 'SEND_IS_ATOMIC_IDEMPOTENT_AND_EVERY_WRONG_CASE_IS_REFUSED_WITH_ITS_CODE']});

await h.check('SENDER_GLOBAL_KEY_IS_ONE_COMMAND_SPACE_ACROSS_TEXT_PHOTO_AND_VOICE_AND_A_CROSS_KIND_REUSE_IS_PT409', async () => {
  // text, photo and voice writers take the same advisory lock key ('uskoci:message:' || sender || ':' || client_message_id) and read the same sender-global key: one key is one command.
  const textKey = commandKey('cross-text');
  await ok(fx.sendText(worker, agreementId, textKey, 'EX05_PRIVATE_CROSS_TEXT'));
  const voiceAsset = (await vf.fullUpload(worker, agreementId)).transfer.receipt.assetId; storageCalls += 1;
  const photoAsset = fx.photoFixtureRow(worker, agreementId);
  expectConflictResult(await vf.sendVoice(worker, agreementId, voiceAsset, textKey), 'MEDIA_COMMAND_CONFLICT');
  expectConflictResult(await fx.sendPhoto(worker, agreementId, [photoAsset], textKey), 'MEDIA_COMMAND_CONFLICT');
  const sentVoiceKey = voiceKey();
  await ok(vf.sendVoice(worker, agreementId, voiceAsset, sentVoiceKey));
  expectConflictResult(await fx.sendText(worker, agreementId, sentVoiceKey, 'EX05_PRIVATE_REUSE'), 'MESSAGE_COMMAND_CONFLICT');
  expectConflictResult(await fx.sendPhoto(worker, agreementId, [photoAsset], sentVoiceKey), 'MEDIA_COMMAND_CONFLICT');
}, {requires: [FIXTURE, 'SEND_IS_ATOMIC_IDEMPOTENT_AND_EVERY_WRONG_CASE_IS_REFUSED_WITH_ITS_CODE']});

await h.check('UPLOAD_RATE_LIMIT_IS_SIX_PER_MINUTE_PER_ACCOUNT_NOT_PER_AGREEMENT', async () => {
  const recent = Number(sql(`select count(*) from private.agreement_voice_uploads_v1 where account_id=${q(worker.id)} and admitted_at>clock_timestamp()-interval '1 minute'`));
  for (let index = recent; index < 6; index++) await vf.svc(worker, 'CLAIM', randomUUID(), agreementId, vf.claimInput());
  expectErrorResult(await vf.svcRaw(worker, 'CLAIM', randomUUID(), agreementId, vf.claimInput()), {code: '54000', message: 'MEDIA_RATE_LIMITED'});
  const other = await vf.svcRaw(worker, 'CLAIM', randomUUID(), otherAgreementId, vf.claimInput());
  assert.ok(other.error, 'the limit is per account, not per Agreement');
}, REQ);

h.setFlag('storageCalls', storageCalls);
await h.catalogGuardCheck();
process.exitCode = h.finish();
