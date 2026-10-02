// EX05-S01: the voice upload fixtures (the service protocol CLAIM -> STAGE -> DISPATCH -> a real Storage object -> SETTLE, then the authenticated send), copied from the frozen
// voice_b1_feature_proof.mjs and factored so that the voice proof and the resolver/transport proof drive the SAME path. `rt` and `fx` (lib/fixtures.mjs) are injected.
// The M4A is the structural fixture of voice_m4a_fixture.mjs: a complete, internally consistent mono AAC-LC container with opaque synthetic access units. It is NOT decoded or native audio.
import {createHash, randomUUID} from 'node:crypto';
import {m4aFixture} from '../../chat/voice_m4a_fixture.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const VOICE_BUCKET = 'agreement-voice';
export const VOICE_UPLOAD_RPC = 'rpc_agreement_voice_upload_service_v1';
export const VOICE_READ_RPC = 'rpc_agreement_voice_read_service_v1';
export const voiceKey = () => 'voice_' + randomUUID().replaceAll('-', '');

export function createVoiceFixtures(rt, fx) {
  const {assert, ok, service} = rt;
  const audio = Buffer.from(m4aFixture({durationMs: 4200})), audioSha = sha256(audio), audioMs = 4200;
  const otherAudio = Buffer.from(m4aFixture({durationMs: 2600})), otherSha = sha256(otherAudio);

  const claimInput = (sha = audioSha, bytes = audio.length, type = 'audio/mp4') => ({sha256: sha, byteSize: bytes, contentType: type});
  const stageInput = (transfer, sha = audioSha, bytes = audio.length, ms = audioMs) => ({attemptId: transfer.attemptId, sha256: sha, byteSize: bytes, durationMs: ms});
  const svcArgs = async (who, operation, key, agreementId, input = {}, version = 1) => ({p_account_id: who.id, p_session_id: await fx.sessionOf(who), p_operation: operation,
    p_agreement_id: agreementId, p_version: version, p_key: key, p_input: input});
  const svcRaw = async (who, operation, key, agreementId, input = {}, version = 1) => service.rpc(VOICE_UPLOAD_RPC, await svcArgs(who, operation, key, agreementId, input, version));
  const svc = async (who, operation, key, agreementId, input = {}, version = 1) => ok(svcRaw(who, operation, key, agreementId, input, version));

  /** The complete upload of one voice message body: claim, stage, dispatch, a real private Storage object, settle STORED. Returns {key, path, transfer} (transfer.receipt.assetId is the asset). */
  async function fullUpload(who, agreementId, {withStorage = true} = {}) {
    const key = randomUUID();
    const claimed = await svc(who, 'CLAIM', key, agreementId, claimInput()); assert.equal(claimed.acquired, true);
    const staged = await svc(who, 'STAGE', key, agreementId, stageInput(claimed)); assert.equal(staged.receipt.state, 'STAGED');
    const dispatched = await svc(who, 'DISPATCH', key, agreementId); assert.equal(dispatched.acquired, true);
    if (withStorage) {
      const uploaded = await service.storage.from(VOICE_BUCKET).upload(staged.path, audio, {contentType: 'audio/mp4', upsert: false});
      assert.ifError(uploaded.error);
    }
    const settled = await svc(who, 'SETTLE', key, agreementId, {sha256: audioSha, outcome: 'STORED'});
    assert.equal(settled.receipt.state, 'READY');
    return {key, path: staged.path, transfer: settled};
  }
  const sendVoice = (who, agreementId, assetId, key = voiceKey(), version = 1) => who.client.rpc('rpc_send_agreement_voice_message_v1',
    {p_expected_user_id: who.id, p_agreement_id: agreementId, p_expected_version: version, p_client_message_id: key, p_asset_id: assetId});

  return {audio, audioSha, audioMs, otherAudio, otherSha, claimInput, stageInput, svcArgs, svcRaw, svc, fullUpload, sendVoice};
}
