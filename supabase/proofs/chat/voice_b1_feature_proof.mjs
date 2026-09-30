// Chat voice B1-a proof. Disposable local Auth / PostgREST / Postgres / Storage only; no provider, no DEV, no device.
// Requires the replayed admitted chain through B3b (the workflow stages 01-21). This script applies ONLY the B1-a candidate to that disposable database
// (it is UNCERTIFIED afterwards by design) and then drives the real upload, send and read paths with real sessions and a real Storage round trip.
// Every check runs even after an earlier one failed, so one CI run reports every broken assertion.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import { m4aFixture } from './voice_m4a_fixture.mjs';
const { assert, sql, rows, q, randomUUID, ok, denied, env, service, anon } = rt;
const candidatePath = 'supabase/candidates/chat_voice_b1a_feature_chain.sql';
const sources = [candidatePath, 'supabase/proofs/chat/voice_b1_feature_proof.mjs', 'supabase/proofs/chat/voice_m4a_fixture.mjs',
  'supabase/proofs/pre_v3/closure_runtime.mjs'];
const report = rt.report('CHAT_VOICE_B1A_FEATURE_CHAIN');
report.providerCalls = 0; report.devAccess = false; report.certificateMoved = false; report.sourceArtifactHashes = {};
const failures = [];
async function check(name, fn) {
  try { await fn(); rt.pass(report, name); }
  catch (e) { failures.push({ name, message: String(e && e.message || e).slice(0, 900) }); console.error('FAIL ' + name + ': ' + String(e && e.message || e).slice(0, 900)); }
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = signature => sql(`select (to_regprocedure(${q(signature)}) is not null)::text`) === 'true';
const closure = () => rows(`select private.closure_source_digest_v5() live,
  (select sha256 from private.closure_source_v5 where singleton) certified, private.retention_ai_source_ready() ready,
  private.closure_erasure_binding_v5() binding`)[0];

const audio = Buffer.from(m4aFixture({ durationMs: 4200 })), audioSha = sha256(audio), audioMs = 4200;
const otherAudio = Buffer.from(m4aFixture({ durationMs: 2600 })), otherSha = sha256(otherAudio);
const PAGE2 = 'public.rpc_read_agreement_messages_page_v2(uuid,uuid,integer,timestamptz,uuid)';
const WINDOW2 = 'public.rpc_read_agreement_message_window_v2(uuid,uuid,uuid,integer,integer)';
const UPLOAD = 'public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)';
const MESSAGE_KEYS_V2 = ['agreementVersion', 'body', 'clientMessageId', 'createdAt', 'kind', 'messageId', 'mine', 'photos', 'senderAccountId', 'voice'];
const MESSAGE_KEYS_V1 = MESSAGE_KEYS_V2.filter(key => key !== 'voice');

await check('SOURCE_BYTES_EQUAL_THE_TESTED_COMMIT', async () => {
  for (const path of sources) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', env.GITHUB_SHA + ':' + path]), 'SOURCE_BYTES_DIFFER:' + path);
    report.sourceArtifactHashes[path] = sha256(bytes);
  }
});

const candidate = readFileSync(candidatePath, 'utf8');
let before;
await check('PREDECESSOR_IS_CERTIFIED_AND_DRIFT_ROLLS_BACK', async () => {
  before = closure();
  assert.equal(before.ready, true); assert.equal(before.live, before.certified);
  assert.equal(exists('public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)'), false);
  assert.throws(() => sql(candidate.replace('912f1c7e4df9c8c933351f45bd1fa1c5', '0'.repeat(32))), /VOICE_B1A_PREDECESSOR_DRIFT/);
  assert.equal(sql("select (to_regclass('private.agreement_voice_uploads_v1') is null)::text"), 'true');
  assert.equal(sql("select (not exists(select 1 from storage.buckets where id='agreement-voice'))::text"), 'true');
  assert.deepEqual(closure(), before);
});
await check('CANDIDATE_APPLIES_ONCE_AND_REFUSES_A_SECOND_APPLICATION', async () => {
  sql(candidate);
  assert.throws(() => sql(candidate), /VOICE_B1A_ALREADY_APPLIED/);
  await pause(1800);
});
await check('TABLE_BUCKET_AND_FUNCTION_AUTHORITY_ARE_EXACT', async () => {
  assert.equal(sql("select relrowsecurity::text||relforcerowsecurity::text from pg_class where oid='private.agreement_voice_uploads_v1'::regclass"), 'truetrue');
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(sql(`select has_table_privilege(${q(role)},'private.agreement_voice_uploads_v1','SELECT,INSERT,UPDATE,DELETE')::text`), 'false');
  assert.deepEqual(rows("select public,file_size_limit,allowed_mime_types from storage.buckets where id='agreement-voice'"),
    [{ public: false, file_size_limit: 4194304, allowed_mime_types: ['audio/mp4'] }]);
  const acl = sig => sql(`select has_function_privilege('anon',${q(sig)},'EXECUTE')::text||has_function_privilege('authenticated',${q(sig)},'EXECUTE')::text||has_function_privilege('service_role',${q(sig)},'EXECUTE')::text`);
  assert.equal(acl(UPLOAD), 'falsefalsetrue');
  assert.equal(acl('public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)'), 'falsefalsetrue');
  for (const sig of [PAGE2, WINDOW2, 'public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)',
    'public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)', 'public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)'])
    assert.equal(acl(sig), 'falsetruefalse');
});
await check('CERTIFICATE_IS_UNCERTIFIED_UNTIL_B1B_AND_THE_CHANGE_IS_IN_THE_SCHEMA_DIGEST', async () => {
  const after = closure();
  report.closureAfterCandidate = { ready: after.ready, bindingNull: after.binding === null, liveMovedFromCertified: after.live !== after.certified };
  assert.notEqual(after.live, before.certified);
  assert.equal(after.certified, before.certified);
});

// Fixtures: two real accounts on one real Agreement, a stranger, and the session ids the service protocol needs.
const requester = await rt.actor('voice-b1a-requester'), worker = await rt.actor('voice-b1a-worker'), stranger = await rt.actor('voice-b1a-stranger');
const profile = (actor, kind) => rows(`select id from public.app_profiles where account_id=${q(actor.id)} and kind=${q(kind)}`)[0].id;
const requesterProfile = profile(requester, 'REQUESTER'), workerProfile = profile(worker, 'WORKER');
sql(`update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${q(workerProfile)}`);
await ok(worker.client.rpc('rpc_complete_worker_profile', { p_profile_id: workerProfile }));
async function makeAgreement(label) {
  const needId = randomUUID();
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
    values(${q(needId)},${q(requester.id)},${q(requesterProfile)},'PUBLISHED',${q(label)},'Disposable voice proof',
      'PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
  const offer = await ok(worker.client.rpc('rpc_submit_response', { p_need_id: needId, p_need_revision: 1, p_worker_profile_id: workerProfile,
    p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: null, p_client_request_id: randomUUID() }));
  return ok(requester.client.rpc('rpc_select_response', { p_need_id: needId, p_need_revision: offer.needRevision, p_response_id: offer.responseId,
    p_response_version: offer.version, p_content_hash: offer.contentHash, p_client_request_id: randomUUID() }));
}
const agreementId = await makeAgreement('Voice B1a'), otherAgreementId = await makeAgreement('Voice B1a other');
async function session(actor) {
  const s = (await actor.client.auth.getSession()).data.session; assert.ok(s);
  const claims = JSON.parse(Buffer.from(s.access_token.split('.')[1], 'base64url').toString());
  assert.equal(claims.sub, actor.id); assert.ok(claims.session_id); return claims.session_id;
}
const svcArgs = async (actor, operation, key, input = {}, version = 1, agreement = agreementId) => ({
  p_account_id: actor.id, p_session_id: await session(actor), p_operation: operation, p_agreement_id: agreement, p_version: version, p_key: key, p_input: input });
const svc = async (actor, operation, key, input = {}, version = 1, agreement = agreementId) =>
  ok(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(actor, operation, key, input, version, agreement)));
const claimInput = (sha = audioSha, bytes = audio.length, type = 'audio/mp4') => ({ sha256: sha, byteSize: bytes, contentType: type });
const stageInput = (transfer, sha = audioSha, bytes = audio.length, ms = audioMs) => ({ attemptId: transfer.attemptId, sha256: sha, byteSize: bytes, durationMs: ms });
async function fullUpload(actor, agreement = agreementId) {
  const key = randomUUID();
  const claimed = await svc(actor, 'CLAIM', key, claimInput(), 1, agreement); assert.equal(claimed.acquired, true);
  const staged = await svc(actor, 'STAGE', key, stageInput(claimed), 1, agreement); assert.equal(staged.receipt.state, 'STAGED');
  const dispatched = await svc(actor, 'DISPATCH', key, {}, 1, agreement); assert.equal(dispatched.acquired, true);
  const uploaded = await service.storage.from('agreement-voice').upload(staged.path, audio, { contentType: 'audio/mp4', upsert: false });
  assert.ifError(uploaded.error);
  const settled = await svc(actor, 'SETTLE', key, { sha256: audioSha, outcome: 'STORED' }, 1, agreement);
  assert.equal(settled.receipt.state, 'READY'); return { key, path: staged.path, transfer: settled };
}
const sendVoice = (actor, assetId, key = 'voice_' + randomUUID().replaceAll('-', ''), version = 1, agreement = agreementId) =>
  actor.client.rpc('rpc_send_agreement_voice_message_v1', { p_expected_user_id: actor.id, p_agreement_id: agreement, p_expected_version: version,
    p_client_message_id: key, p_asset_id: assetId });
const page = (actor, version = 'v2', cursor = null, limit = 50, agreement = agreementId) =>
  actor.client.rpc(`rpc_read_agreement_messages_page_${version}`, { p_expected_user_id: actor.id, p_agreement_id: agreement, p_limit: limit,
    p_before_created_at: cursor?.createdAt ?? null, p_before_id: cursor?.messageId ?? null });
const windowOf = (actor, target, version = 'v2', before = 24, after = 25, agreement = agreementId) =>
  actor.client.rpc(`rpc_read_agreement_message_window_${version}`, { p_expected_user_id: actor.id, p_agreement_id: agreement, p_target_message_id: target,
    p_before_count: before, p_after_count: after });
const eventRead = id => rows(`select read_at from public.user_activity_events where dedupe_key=${q('agreement_message:' + id)}`)[0]?.read_at ?? null;

let first; const state = {};
await check('SERVICE_PROTOCOL_IS_SERVICE_ROLE_ONLY_AND_SESSION_BOUND', async () => {
  const args = await svcArgs(requester, 'CLAIM', randomUUID(), claimInput());
  for (const client of [anon, requester.client, worker.client]) await denied(client.rpc('rpc_agreement_voice_upload_service_v1', args));
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', { ...args, p_session_id: randomUUID() }), 'AUTH_REQUIRED');
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', { ...args, p_account_id: stranger.id, p_session_id: await session(stranger) }), 'MEDIA_NOT_FOUND');
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', { ...args, p_operation: 'BOGUS' }), 'MEDIA_INPUT_INVALID');
});
await check('CLAIM_VALIDATES_AND_IS_IDEMPOTENT', async () => {
  const key = randomUUID();
  const a = await svc(requester, 'CLAIM', key, claimInput()); assert.equal(a.acquired, true); assert.equal(a.receipt.state, 'PROCESSING');
  assert.equal(a.receipt.voice, null); assert.equal(a.path, null);
  const b = await svc(requester, 'CLAIM', key, claimInput()); assert.equal(b.acquired, false); assert.equal(b.receipt.assetId, a.receipt.assetId);
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(requester, 'CLAIM', key, claimInput(otherSha, otherAudio.length))), 'MEDIA_COMMAND_CONFLICT');
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(requester, 'CLAIM', key, claimInput(), 2)), 'MEDIA_COMMAND_CONFLICT');
  for (const bad of [claimInput(audioSha, audio.length, 'audio/mpeg'), claimInput(audioSha, 4194305), claimInput('x'.repeat(64)), { ...claimInput(), extra: 1 }, {}])
    await denied(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(requester, 'CLAIM', randomUUID(), bad)), 'MEDIA_INPUT_INVALID');
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(requester, 'CLAIM', randomUUID(), claimInput(), 9)), 'MEDIA_VERSION_CONFLICT');
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(stranger, 'CLAIM', randomUUID(), claimInput())), 'MEDIA_NOT_FOUND');
  await svc(requester, 'CANCEL', key);
  assert.equal((await svc(requester, 'READ', key)).receipt.state, 'CANCELLED');
});
await check('STAGE_BINDS_THE_CLAIM_AND_DISPATCH_IS_EXACTLY_ONCE', async () => {
  const key = randomUUID(); const c = await svc(requester, 'CLAIM', key, claimInput());
  for (const bad of [stageInput(c, otherSha), stageInput(c, audioSha, audio.length + 1), stageInput(c, audioSha, audio.length, 299), stageInput(c, audioSha, audio.length, 300001),
    { ...stageInput(c), attemptId: randomUUID() }, { ...stageInput(c), extra: true }])
    await denied(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(requester, 'STAGE', key, bad)), 'MEDIA_INPUT_INVALID');
  const s = await svc(requester, 'STAGE', key, stageInput(c));
  assert.equal(s.path, `${requester.id}/agreement-voice-v1/${c.receipt.assetId}/${audioSha}.m4a`); assert.equal(s.durationMs, audioMs); assert.equal(s.byteSize, audio.length);
  assert.equal((await svc(requester, 'STAGE', key, stageInput(c))).receipt.state, 'STAGED');
  assert.equal((await svc(requester, 'DISPATCH', key)).acquired, true); assert.equal((await svc(requester, 'DISPATCH', key)).acquired, false);
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(requester, 'SETTLE', key, { sha256: otherSha, outcome: 'STORED' })), 'MEDIA_INPUT_INVALID');
  const failed = await svc(requester, 'SETTLE', key, { sha256: audioSha, outcome: 'REJECTED' }); assert.equal(failed.receipt.state, 'FAILED');
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(requester, 'SETTLE', key, { sha256: audioSha, outcome: 'STORED' })), 'MEDIA_COMMAND_CONFLICT');
});
await check('REAL_STORAGE_ROUND_TRIP_IS_PRIVATE_IMMUTABLE_AND_SETTLES_READY', async () => {
  first = await fullUpload(requester); state.first = first;
  const blob = await ok(service.storage.from('agreement-voice').download(first.path));
  assert.equal(sha256(new Uint8Array(await blob.arrayBuffer())), audioSha);
  const publicRead = await fetch(env.RU5_DEVICE_SUPABASE_URL + '/storage/v1/object/public/agreement-voice/' + first.path, { redirect: 'error' });
  assert.equal(publicRead.ok, false); void publicRead.body?.cancel();
  for (const client of [anon, requester.client, worker.client]) {
    assert.ok((await client.storage.from('agreement-voice').download(first.path)).error, 'CLIENT_DOWNLOAD_MUST_FAIL');
    assert.ok((await client.storage.from('agreement-voice').upload(`${requester.id}/agreement-voice-v1/${randomUUID()}/x.m4a`, audio, { contentType: 'audio/mp4' })).error, 'CLIENT_UPLOAD_MUST_FAIL');
  }
  assert.ok((await service.storage.from('agreement-voice').upload(first.path, otherAudio, { contentType: 'audio/mp4', upsert: true })).error, 'OVERWRITE_MUST_FAIL');
  await service.storage.from('agreement-voice').remove([first.path]); // the guard refuses the delete; whatever the API answers, the object must still be there
  assert.equal(sha256(new Uint8Array(await (await ok(service.storage.from('agreement-voice').download(first.path))).arrayBuffer())), audioSha);
  const list = await svc(requester, 'LIST', randomUUID(), {}); // LIST ignores the key
  assert.ok(list.uploads.some(u => u.assetId === first.transfer.receipt.assetId && u.state === 'READY'));
});
await check('PLAYBACK_AUTHORIZATION_NAMES_THE_EXACT_OBJECT_FOR_THE_RIGHT_PEOPLE_ONLY', async () => {
  const assetId = first.transfer.receipt.assetId;
  const read = account => async (asset, message = null, agreement = agreementId) => service.rpc('rpc_agreement_voice_read_service_v1',
    { p_account_id: account.id, p_session_id: await session(account), p_agreement_id: agreement, p_asset_id: asset, p_message_id: message });
  const own = await ok(await read(requester)(assetId));
  assert.deepEqual(own, { assetId, agreementId, messageId: null, bucket: 'agreement-voice', path: first.path, sha256: audioSha, contentType: 'audio/mp4', byteSize: audio.length, durationMs: audioMs, authoritative: true });
  await denied(await read(worker)(assetId), 'MEDIA_NOT_FOUND');
  await denied(await read(stranger)(assetId), 'MEDIA_NOT_FOUND');
  await denied(service.rpc('rpc_agreement_voice_read_service_v1', { p_account_id: requester.id, p_session_id: randomUUID(), p_agreement_id: agreementId, p_asset_id: assetId, p_message_id: null }), 'AUTH_REQUIRED');
  await denied(rt.anon.rpc('rpc_agreement_voice_read_service_v1', { p_account_id: requester.id, p_session_id: randomUUID(), p_agreement_id: agreementId, p_asset_id: assetId, p_message_id: null }));
});
let sent;
await check('SEND_IS_ATOMIC_IDEMPOTENT_AND_REFUSES_EVERY_WRONG_CASE', async () => {
  const assetId = first.transfer.receipt.assetId, key = 'voice_' + randomUUID().replaceAll('-', '');
  const pair = await Promise.all([ok(sendVoice(requester, assetId, key)), ok(sendVoice(requester, assetId, key))]);
  assert.deepEqual(pair[0], pair[1]); sent = pair[0]; state.sent = sent;
  assert.deepEqual(Object.keys(sent).sort(), ['agreementId', 'agreementVersion', 'clientMessageId', 'messageId', 'voiceAssetId']);
  assert.equal(sent.voiceAssetId, assetId); assert.equal(sent.clientMessageId, key);
  assert.equal(sql(`select count(*) from public.user_activity_events where dedupe_key=${q('agreement_message:' + sent.messageId)}`), '1');
  assert.equal(sql(`select count(*) from public.agreement_messages where sender_account_id=${q(requester.id)} and client_message_id=${q(key)}`), '1');
  assert.equal(sql(`select attached_message_id from private.agreement_voice_uploads_v1 where id=${q(assetId)}`), sent.messageId);
  const other = await fullUpload(requester);
  await denied(sendVoice(requester, other.transfer.receipt.assetId, key), 'MEDIA_COMMAND_CONFLICT');
  await denied(sendVoice(requester, assetId, key, 2), 'MEDIA_COMMAND_CONFLICT');
  await denied(sendVoice(requester, other.transfer.receipt.assetId, undefined, 2), 'MEDIA_VERSION_CONFLICT');
  await denied(sendVoice(worker, other.transfer.receipt.assetId), 'MEDIA_NOT_EDITABLE');
  await denied(sendVoice(stranger, other.transfer.receipt.assetId), 'MEDIA_NOT_FOUND');
  await denied(sendVoice(requester, assetId), 'MEDIA_NOT_EDITABLE');
  await denied(sendVoice(requester, randomUUID()), 'MEDIA_NOT_EDITABLE');
  await denied(sendVoice(requester, other.transfer.receipt.assetId, 'bad key'), 'MEDIA_INPUT_INVALID');
  await denied(requester.client.rpc('rpc_send_agreement_voice_message_v1', { p_expected_user_id: worker.id, p_agreement_id: agreementId, p_expected_version: 1,
    p_client_message_id: 'voice_' + randomUUID().replaceAll('-', ''), p_asset_id: other.transfer.receipt.assetId }), 'AUTH_CONTEXT_CHANGED');
  await denied(anon.rpc('rpc_send_agreement_voice_message_v1', { p_expected_user_id: requester.id, p_agreement_id: agreementId, p_expected_version: 1,
    p_client_message_id: 'voice_' + randomUUID().replaceAll('-', ''), p_asset_id: other.transfer.receipt.assetId }));
  state.unsent = other;
});
await check('DATABASE_GUARDS_FREEZE_MESSAGE_ASSET_AND_OBJECT', async () => {
  const assetId = first.transfer.receipt.assetId;
  assert.throws(() => sql(`update public.agreement_messages set voice_asset_id=null where id=${q(sent.messageId)}`), /MEDIA_MESSAGE_IMMUTABLE/);
  assert.throws(() => sql(`update public.agreement_messages set body='changed' where id=${q(sent.messageId)}`), /MEDIA_MESSAGE_IMMUTABLE/);
  assert.throws(() => sql(`delete from private.agreement_voice_uploads_v1 where id=${q(assetId)}`), /MEDIA_ASSET_IMMUTABLE/);
  assert.throws(() => sql(`update private.agreement_voice_uploads_v1 set state='FAILED' where id=${q(assetId)}`), /MEDIA_ASSET_IMMUTABLE/);
  assert.throws(() => sql(`update private.agreement_voice_uploads_v1 set storage_path=storage_path||'x' where id=${q(assetId)}`), /MEDIA_ASSET_IMMUTABLE|violates check constraint/);
  assert.throws(() => sql(`delete from storage.objects where bucket_id='agreement-voice' and name=${q(first.path)}`), /MEDIA_ASSET_IMMUTABLE|permission denied/);
  assert.throws(() => sql(`update storage.objects set name=name||'x' where bucket_id='agreement-voice' and name=${q(first.path)}`), /MEDIA_ASSET_IMMUTABLE|permission denied/);
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='agreement-voice' and name=${q(first.path)}`), '1');
  // The kind-exclusive check: a voice row never has a body or photos; a text row never lacks both.
  assert.throws(() => sql(`insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,client_message_id,body,voice_asset_id)
    values(${q(agreementId)},1,${q(requester.id)},${q('voice_' + randomUUID().replaceAll('-', ''))},'text',${q(state.unsent.transfer.receipt.assetId)})`), /agreement_messages_body_media_check|MEDIA_/);
  assert.throws(() => sql(`insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,client_message_id,body)
    values(${q(agreementId)},1,${q(requester.id)},${q('text_' + randomUUID().replaceAll('-', ''))},'')`), /agreement_messages_body_media_check/);
});
await check('HISTORY_V2_CARRIES_KIND_VOICE_AND_EXACT_METADATA', async () => {
  const p = await ok(page(worker)); assert.equal(p.schema, 'AGREEMENT_MESSAGES_PAGE_V2');
  const row = p.messages.find(m => m.messageId === sent.messageId); assert.ok(row);
  assert.equal(row.kind, 'VOICE'); assert.equal(row.body, ''); assert.deepEqual(row.photos, []);
  assert.deepEqual(row.voice, { assetId: first.transfer.receipt.assetId, durationMs: audioMs, byteSize: audio.length, contentType: 'audio/mp4' });
  assert.deepEqual(Object.keys(row).sort(), MESSAGE_KEYS_V2); assert.equal(row.mine, false);
  assert.equal((await ok(page(requester))).messages.find(m => m.messageId === sent.messageId).mine, true);
  const w = await ok(windowOf(worker, sent.messageId)); assert.equal(w.schema, 'AGREEMENT_MESSAGE_WINDOW_V2'); assert.equal(w.targetMessageId, sent.messageId);
  assert.deepEqual(w.messages.find(m => m.messageId === sent.messageId).voice, row.voice);
  await denied(page(stranger), 'MEDIA_NOT_FOUND'); await denied(windowOf(stranger, sent.messageId), 'MEDIA_NOT_FOUND');
  await denied(windowOf(worker, randomUUID()), 'CHAT_MESSAGE_NOT_AVAILABLE');
  await denied(rt.anon.rpc('rpc_read_agreement_messages_page_v2', { p_expected_user_id: worker.id, p_agreement_id: agreementId }));
});
await check('HISTORY_V1_SHOWS_AN_OLD_BUILD_A_TEXT_NOTICE_WITH_THE_EXACT_V1_KEY_SET', async () => {
  const p = await ok(page(worker, 'v1')); assert.equal(p.schema, 'AGREEMENT_MESSAGES_PAGE_V1');
  const row = p.messages.find(m => m.messageId === sent.messageId); assert.ok(row);
  assert.equal(row.kind, 'TEXT'); assert.equal(row.body, 'Glasovna poruka. Ažuriraj aplikaciju da je poslušaš.'); assert.deepEqual(row.photos, []);
  assert.deepEqual(Object.keys(row).sort(), MESSAGE_KEYS_V1);
  for (const message of p.messages) assert.ok(['TEXT', 'PHOTO'].includes(message.kind) && message.body !== undefined && !('voice' in message));
  const w = await ok(windowOf(worker, sent.messageId, 'v1')); assert.equal(w.schema, 'AGREEMENT_MESSAGE_WINDOW_V1');
  assert.equal(w.messages.find(m => m.messageId === sent.messageId).kind, 'TEXT');
  assert.deepEqual(Object.keys(p).sort(), ['accountId', 'agreementId', 'asOf', 'authoritative', 'messages', 'olderCursor', 'schema']);
});
await check('PAGING_TEXT_PHOTO_AND_VOICE_STAY_ORDERED_AND_ACKNOWLEDGEMENT_IS_KIND_AGNOSTIC', async () => {
  const text = await ok(requester.client.rpc('rpc_send_agreement_message_v2', { p_expected_user_id: requester.id, p_agreement_id: agreementId,
    p_client_message_id: randomUUID(), p_body: 'Text between voice messages' }));
  const assetId = randomUUID(), uploadId = randomUUID(), hashA = 'a'.repeat(64), hashB = 'b'.repeat(64);
  sql(`insert into private.agreement_photo_uploads_v5(id,account_id,agreement_id,agreement_version,client_request_id,state,input_sha256,input_bytes,input_type,admitted_at,
      sanitized_sha256,storage_path,width,height,byte_size,dispatch_state,dispatch_outcome)
    values(${q(assetId)},${q(worker.id)},${q(agreementId)},1,${q(uploadId)},'READY',${q(hashA)},12,'image/jpeg',clock_timestamp(),${q(hashB)},
      ${q(worker.id + '/agreement-v5/' + assetId + '/' + hashB + '.jpg')},10,10,12,'SETTLED','STORED');`);
  const photo = await ok(worker.client.rpc('rpc_send_agreement_photo_message_v5', { p_expected_user_id: worker.id, p_agreement_id: agreementId,
    p_expected_version: 1, p_client_message_id: randomUUID(), p_body: '', p_asset_ids: [assetId] }));
  const last = await ok(sendVoice(worker, (await fullUpload(worker)).transfer.receipt.assetId));
  const full = await ok(page(requester));
  const order = rows(`select id from public.agreement_messages where agreement_id=${q(agreementId)} order by created_at,id`).map(m => m.id);
  assert.deepEqual(full.messages.map(m => m.messageId), order);
  assert.deepEqual(full.messages.map(m => m.kind).filter((k, i, a) => a.indexOf(k) === i).sort(), ['PHOTO', 'TEXT', 'VOICE']);
  const newest = await ok(page(requester, 'v2', null, 2)); assert.deepEqual(newest.messages.map(m => m.messageId), order.slice(-2));
  const older = await ok(page(requester, 'v2', newest.olderCursor, 2)); assert.deepEqual(older.messages.map(m => m.messageId), order.slice(-4, -2));
  const mark = ids => requester.client.rpc('rpc_mark_displayed_agreement_messages_v1', { p_expected_user_id: requester.id, p_agreement_id: agreementId, p_message_ids: ids });
  const receipt = await ok(mark([last.messageId, photo.messageId, text]));
  assert.equal(receipt.markedEventCount, 2); assert.ok(eventRead(last.messageId)); assert.ok(eventRead(photo.messageId)); assert.equal(eventRead(text), null);
});
await check('UPLOAD_RATE_LIMIT_IS_SIX_PER_MINUTE_PER_ACCOUNT', async () => {
  const recent = Number(sql(`select count(*) from private.agreement_voice_uploads_v1 where account_id=${q(worker.id)} and admitted_at>clock_timestamp()-interval '1 minute'`));
  for (let i = recent; i < 6; i++) await svc(worker, 'CLAIM', randomUUID(), claimInput(), 1, agreementId);
  await denied(service.rpc('rpc_agreement_voice_upload_service_v1', await svcArgs(worker, 'CLAIM', randomUUID(), claimInput())), 'MEDIA_RATE_LIMITED');
  await svc(worker, 'CLAIM', randomUUID(), claimInput(), 1, otherAgreementId).then(() => { throw new Error('RATE_LIMIT_IS_PER_ACCOUNT_NOT_PER_AGREEMENT'); }, () => {});
});

report.failures = failures; report.result = failures.length ? 'FAIL' : 'PASS';
writeFileSync(rt.out + '/chat-voice-b1a-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(report.result + ' CHAT_VOICE_B1A_FEATURE_CHAIN (' + report.checks.length + ' passed, ' + failures.length + ' failed)');
if (failures.length) { for (const f of failures) console.error(' - ' + f.name + ': ' + f.message); process.exitCode = 1; }
