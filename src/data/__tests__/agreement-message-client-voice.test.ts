// Voice messages B2-a (2026-09-30): the send command and service learn the voice message (one READY voice asset, empty body, no photos).
const accountId = '10000000-0000-4000-8000-000000000001';
const agreementId = '20000000-0000-4000-8000-000000000001';
const assetId = '40000000-0000-4000-8000-0000000000aa';
const photoAssetId = '40000000-0000-4000-8000-000000000001';
const messageId = '30000000-0000-4000-8000-000000000001';
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { AgreementMessageError, validMessageVoice } from '../../contracts/agreementMessages';
import { captureAgreementMessage, createAgreementMessageService } from '../agreementMessageClientService';

const voiceCommand = { accountId, agreementId, clientMessageId: 'voice_retry_0001', body: '', voice: { agreementVersion: 2, assetId } };
const receipt = { messageId, agreementId, agreementVersion: 2, clientMessageId: 'voice_retry_0001', voiceAssetId: assetId };
const rpc = jest.fn();
const service = createAgreementMessageService(rpc);
beforeEach(() => { rpc.mockReset(); });
const code = async (work: () => unknown) => { try { await work(); } catch (error) { return (error as AgreementMessageError).code; } return null; };

it('validates the voice intent: exactly a version and one well-formed asset id', () => {
  expect(validMessageVoice({ agreementVersion: 2, assetId })).toBe(true);
  for (const bad of [null, undefined, 'x', [], {}, { agreementVersion: 2 }, { assetId }, { agreementVersion: 0, assetId }, { agreementVersion: 2147483648, assetId },
    { agreementVersion: 1.5, assetId }, { agreementVersion: 2, assetId: `${assetId}\n` }, { agreementVersion: 2, assetId: 'not-a-uuid' }, { agreementVersion: 2, assetId, extra: 1 },
    { agreementVersion: 2, assetId: [assetId] }]) expect(validMessageVoice(bad)).toBe(false);
});
it('captures a voice command frozen and unchanged, with an empty body', () => {
  const captured = captureAgreementMessage(voiceCommand);
  expect(captured).toEqual(voiceCommand);
  expect(Object.isFrozen(captured)).toBe(true); expect(Object.isFrozen(captured.voice)).toBe(true);
  expect(captureAgreementMessage({ ...voiceCommand, body: '   ' }).body).toBe('');
});
it.each([
  ['a body next to a voice asset', { body: 'words' }], ['photos next to a voice asset', { photos: { agreementVersion: 2, assetIds: [photoAssetId] } }],
  ['a malformed voice asset', { voice: { agreementVersion: 2, assetId: 'bad' } }], ['a zero version', { voice: { agreementVersion: 0, assetId } }],
  ['a voice object with an extra key', { voice: { agreementVersion: 2, assetId, url: 'https://private.invalid' } }],
])('refuses %s', async (_name, patch) => {
  expect(await code(() => captureAgreementMessage({ ...voiceCommand, ...patch } as never))).toBe('INVALID_MESSAGE');
});
it('an empty command without photos or voice is still invalid', async () => {
  expect(await code(() => captureAgreementMessage({ accountId, agreementId, clientMessageId: 'plain_retry_0001', body: '' }))).toBe('INVALID_MESSAGE');
});
it('sends through the voice function with the exact arguments and accepts only an exactly echoed receipt', async () => {
  rpc.mockResolvedValue({ data: receipt, error: null });
  expect(await service.send(voiceCommand)).toEqual({ messageId });
  expect(rpc).toHaveBeenCalledWith('rpc_send_agreement_voice_message_v1', { p_expected_user_id: accountId, p_agreement_id: agreementId,
    p_expected_version: 2, p_client_message_id: 'voice_retry_0001', p_asset_id: assetId });
});
it.each([
  ['another Agreement', { agreementId: '20000000-0000-4000-8000-000000000002' }], ['another version', { agreementVersion: 3 }],
  ['another message key', { clientMessageId: 'voice_retry_0002' }], ['another asset', { voiceAssetId: photoAssetId }],
  ['a malformed message id', { messageId: 'nope' }], ['an extra key', { body: '' }],
])('treats a receipt echoing %s as invalid, never as sent', async (_name, patch) => {
  rpc.mockResolvedValue({ data: { ...receipt, ...patch }, error: null });
  expect(await code(() => service.send(voiceCommand))).toBe('INVALID_RESPONSE');
});
it.each([
  [null], ['a string'], [{ ...receipt, messageId: undefined }],
])('treats a missing or non-object receipt as invalid %#', async data => {
  rpc.mockResolvedValue({ data, error: null });
  expect(await code(() => service.send(voiceCommand))).toBe('INVALID_RESPONSE');
});
it.each([
  ['PT409', 'CONFLICT'], ['40001', 'CONFLICT'], ['28000', 'AUTH_CONTEXT_CHANGED'], ['42501', 'NOT_AVAILABLE'], ['22023', 'INVALID_MESSAGE'], ['XX000', 'UNAVAILABLE'],
])('maps the server error %s to %s', async (serverCode, expected) => {
  rpc.mockResolvedValue({ data: null, error: { code: serverCode, message: 'MEDIA_ANY' } });
  expect(await code(() => service.send(voiceCommand))).toBe(expected);
});
it('a transport failure is an unknown outcome, never a rejection of the intent', async () => {
  rpc.mockRejectedValue(new Error('network'));
  expect(await code(() => service.send(voiceCommand))).toBe('UNAVAILABLE');
});
it('text and photo sends are unchanged by the voice branch', async () => {
  rpc.mockResolvedValue({ data: messageId, error: null });
  expect(await service.send({ accountId, agreementId, clientMessageId: 'plain_retry_0001', body: 'Zdravo' })).toEqual({ messageId });
  expect(rpc.mock.calls[0][0]).toBe('rpc_send_agreement_message_v2');
  rpc.mockResolvedValue({ data: { messageId, agreementId, agreementVersion: 2, clientMessageId: 'photo_retry_0001', body: '', assetIds: [photoAssetId] }, error: null });
  expect(await service.send({ accountId, agreementId, clientMessageId: 'photo_retry_0001', body: '', photos: { agreementVersion: 2, assetIds: [photoAssetId] } })).toEqual({ messageId });
  expect(rpc.mock.calls[1][0]).toBe('rpc_send_agreement_photo_message_v5');
});
