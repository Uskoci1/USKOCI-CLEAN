const accountId = '11111111-1111-4111-8111-111111111111';
const agreementId = '22222222-2222-4222-8222-222222222222';
const assetId = '33333333-3333-4333-8333-333333333333';
const clientRequestId = '44444444-4444-4444-8444-444444444444';
const messageId = '55555555-5555-4555-8555-555555555555';
let mockAccount = accountId, mockRevision = 0;
const mockInvoke = jest.fn(), mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ functions: { invoke: (...args: unknown[]) => mockInvoke(...args) }, rpc: (...args: unknown[]) => mockRpc(...args) }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
import { agreementPhotoClientService as service, decodeAgreementUpload, decodeAgreementPhotoMessage } from '../agreementPhotoClientService';
const ref = { agreementId, agreementVersion: 3, clientRequestId };
const photo = { assetId, width: 1600, height: 1200, byteSize: 123, contentType: 'image/jpeg' as const };
const ready = () => ({ ...ref, accountId, assetId, state: 'READY', attachedMessageId: null, photo, authoritative: true });
const message = () => ({ messageId, agreementVersion: 3, clientMessageId: 'photo_message_key', body: '', assetIds: [assetId], photos: [photo] });
beforeEach(() => { jest.clearAllMocks(); mockAccount = accountId; mockRevision = 0; });
it('uploads only selected bytes with exact Agreement/version/key and no client account override', async () => {
  mockInvoke.mockResolvedValue({ data: ready(), error: null }); const bytes = new ArrayBuffer(8);
  expect(await service.upload(ref, bytes)).toEqual({ ok: true, podatak: ready() });
  expect(mockInvoke).toHaveBeenCalledWith('uskoci-media', { body: bytes, headers: { 'x-media-operation': 'agreement-upload',
    'Content-Type': 'image/jpeg', 'x-media-target': agreementId, 'x-media-version': '3', 'x-media-request-id': clientRequestId }, signal: undefined });
});
it.each([
  { accountId: messageId }, { agreementId: messageId }, { agreementVersion: 4 }, { clientRequestId: messageId },
  { secret: 'private drift' }, { assetId: null }, { state: 'STAGED' }, { photo: { ...photo, url: 'https://private.invalid' } },
  { photo: { ...photo, assetId: messageId } }, { photo: { ...photo, width: 1601 } }, { attachedMessageId: 'invalid' },
])('rejects cross-scope and malformed upload receipt %#', patch => expect(decodeAgreementUpload({ ...ready(), ...patch }, accountId, ref)).toBeNull());
it('distinguishes owned ABSENT from CANCELLED stable tombstone and attached receipt', async () => {
  const absent = { ...ready(), assetId: null, state: 'ABSENT', photo: null };
  mockInvoke.mockResolvedValueOnce({ data: absent, error: null });
  expect(await service.read(ref)).toEqual({ ok: true, podatak: absent });
  const tombstone = { ...ready(), state: 'CANCELLED', photo: null };
  mockInvoke.mockResolvedValueOnce({ data: tombstone, error: null });
  expect(await service.cancel(ref)).toEqual({ ok: true, podatak: tombstone });
  expect(mockInvoke.mock.calls.map(call => call[1].headers['x-media-operation'])).toEqual(['agreement-upload-read', 'agreement-upload-cancel']);
  expect(decodeAgreementUpload({ ...ready(), attachedMessageId: messageId }, accountId, ref)?.attachedMessageId).toBe(messageId);
  expect(decodeAgreementUpload({ ...tombstone, attachedMessageId: messageId }, accountId, ref)).toBeNull();
});
it('does not turn transport unknown into ABSENT, expose raw errors, or replay a write', async () => {
  mockInvoke.mockRejectedValue(new Error('secret upstream body'));
  const result = await service.upload(ref, new ArrayBuffer(1));
  expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain('secret'); expect(mockInvoke).toHaveBeenCalledTimes(1);
});
it('fences a late receipt after same-account session incarnation changes', async () => {
  mockInvoke.mockImplementation(async () => { mockRevision = 2; return { data: ready(), error: null }; });
  expect(await service.read(ref)).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('joins attachment metadata only to exact already-read message/version/body/key, without public paths', async () => {
  mockRpc.mockResolvedValue({ data: { accountId, agreementId, messages: [message()], authoritative: true }, error: null });
  const row = { id: messageId, dogovorVerzija: 3, clientMessageId: 'photo_message_key', posiljalacAccountId: accountId,
    posiljalacIme: 'Ja', moja: true, telo: '', vremeTekst: '12:00', procitano: null };
  expect(await service.messages(agreementId, [row], { accountId, accountRevision: 0 })).toEqual([{ ...row, fotografije: [photo] }]);
  expect(mockRpc).toHaveBeenCalledWith('rpc_read_agreement_photo_messages_v5', { p_expected_user_id: accountId, p_agreement_id: agreementId, p_message_ids: [messageId] });
  await expect(service.messages(agreementId, [{ ...row, telo: 'other body' }], { accountId, accountRevision: 0 })).rejects.toThrow('AGREEMENT_PHOTO_MESSAGE_CONFLICT');
  await expect(service.messages(agreementId, [{ ...row, dogovorVerzija: 4 }], { accountId, accountRevision: 0 })).rejects.toThrow('AGREEMENT_PHOTO_MESSAGE_CONFLICT');
});
it('admits old text-only/null-key metadata and rejects reordered or extra photo fields', () => {
  expect(decodeAgreementPhotoMessage({ ...message(), clientMessageId: null, assetIds: [], photos: [], body: 'Old text' })).not.toBeNull();
  expect(decodeAgreementPhotoMessage({ ...message(), assetIds: [clientRequestId] })).toBeNull();
  expect(decodeAgreementPhotoMessage({ ...message(), photos: [{ ...photo, ownerAccountId: accountId }] })).toBeNull();
});
it('reads bounded unretired owner upload inventory without choosing, uploading or sending it', async () => {
  const envelope = { accountId, agreementId, uploads: [ready()], authoritative: true };
  mockInvoke.mockResolvedValue({ data: envelope, error: null }); expect(await service.list(agreementId)).toEqual({ ok: true, podatak: [ready()] });
  expect(mockInvoke.mock.calls[0][1]).toEqual({ body: { agreementId }, headers: { 'x-media-operation': 'agreement-upload-list' }, signal: undefined });
  for (const uploads of [[ready(), ready()], [{ ...ready(), accountId: messageId }], [{ ...ready(), attachedMessageId: messageId }],
    [{ ...ready(), state: 'FAILED', photo: null }]]) {
    mockInvoke.mockResolvedValue({ data: { ...envelope, uploads }, error: null }); expect((await service.list(agreementId)).ok).toBe(false);
  }
  expect(mockRpc).not.toHaveBeenCalled();
});
it('batches canonical history at fifty IDs and fails the entire projection on a foreign message receipt', async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({ id: `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`,
    dogovorVerzija: 1, clientMessageId: null, posiljalacAccountId: accountId, posiljalacIme: 'Ja', moja: true,
    telo: `Text ${i}`, vremeTekst: '12:00', procitano: null }));
  mockRpc.mockImplementation(async (_name, args) => ({ error: null, data: { accountId, agreementId, authoritative: true,
    messages: args.p_message_ids.map((id: string) => { const row = rows.find(r => r.id === id)!;
      return { messageId: id, agreementVersion: 1, clientMessageId: null, body: row.telo, assetIds: [], photos: [] }; }) } }));
  expect(await service.messages(agreementId, rows, { accountId, accountRevision: 0 })).toHaveLength(51);
  expect(mockRpc.mock.calls.map(call => call[1].p_message_ids.length)).toEqual([50, 1]);
  mockRpc.mockResolvedValue({ error: null, data: { accountId, agreementId, authoritative: true, messages: [{ ...message(), messageId }] } });
  await expect(service.messages(agreementId, [rows[0]], { accountId, accountRevision: 0 })).rejects.toThrow('AGREEMENT_PHOTO_MESSAGE_CONFLICT');
});
