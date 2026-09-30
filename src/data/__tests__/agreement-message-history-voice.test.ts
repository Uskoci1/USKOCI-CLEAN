// Voice messages B2-a (2026-09-30): the history decoders and the service learn the V2 read contract (kind VOICE and a voice object) without
// changing one byte of the V1 behaviour. V2 is reachable only when the build flag says the backend carries it; until then nothing calls it.
const accountId = '10000000-0000-4000-8000-000000000001';
const otherAccountId = '10000000-0000-4000-8000-000000000002';
const agreementId = '20000000-0000-4000-8000-000000000001';
const assetId = '40000000-0000-4000-8000-000000000001';
const voiceAssetId = '40000000-0000-4000-8000-0000000000aa';
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let mockAccount: string | null = accountId, mockRevision = 0;
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { createAgreementMessageHistoryService, decodeAgreementMessageHistoryPage, decodeAgreementMessageWindow } from '../agreementMessageHistoryService';
import { voiceMessagesBuilt, VOICE_MESSAGES_BUILT } from '../voiceMessagesGate';

const photo = { assetId, width: 1600, height: 1200, byteSize: 1024, contentType: 'image/jpeg' };
const voice = { assetId: voiceAssetId, durationMs: 4200, byteSize: 2353, contentType: 'audio/mp4' };
const createdAt = (n: number) => `2026-09-27T12:00:00.${String(n).padStart(6, '0')}+00:00`;
const text = (n = 1) => ({ messageId: id(n), agreementVersion: 2, senderAccountId: accountId, clientMessageId: 'message_retry_1',
  body: `Message ${n}`, createdAt: createdAt(n), kind: 'TEXT', mine: true, photos: [] as unknown[], voice: null as unknown });
const photoRow = (n = 2) => ({ ...text(n), kind: 'PHOTO', body: '', photos: [photo] });
const voiceRow = (n = 3) => ({ ...text(n), kind: 'VOICE', body: '', clientMessageId: 'voice_retry_001', voice });
const asOf = '2026-09-27T13:00:00.123456+00:00';
const page2 = (rows: unknown[] = [text(1), photoRow(2), voiceRow(3)]) => ({ schema: 'AGREEMENT_MESSAGES_PAGE_V2', accountId, agreementId,
  messages: rows, olderCursor: null as unknown, asOf, authoritative: true });
const window2 = (rows: unknown[] = [text(1), voiceRow(2), text(3)]) => ({ schema: 'AGREEMENT_MESSAGE_WINDOW_V2', accountId, agreementId,
  targetMessageId: id(2), messages: rows, beforeCursor: null as unknown, afterCursor: null as unknown, asOf, authoritative: true });
const v2 = { voice: true } as const;
const rpc = jest.fn();
beforeEach(() => { jest.clearAllMocks(); rpc.mockReset(); mockAccount = accountId; mockRevision = 0; });

it('the build flag is exactly "1" and nothing else', () => {
  expect(VOICE_MESSAGES_BUILT).toBe('1');
  expect(voiceMessagesBuilt('1')).toBe(true);
  for (const other of [undefined, '', '0', 'true', 1, true, ' 1', '1 ']) expect(voiceMessagesBuilt(other)).toBe(false);
});
it('decodes TEXT, PHOTO and VOICE rows of a V2 page with the exact voice projection and no read receipt', () => {
  const decoded = decodeAgreementMessageHistoryPage(page2(), accountId, agreementId, v2);
  expect(decoded?.messages.map(row => row.kind)).toEqual(['TEXT', 'PHOTO', 'VOICE']);
  expect(decoded?.messages[2]).toMatchObject({ id: id(3), kind: 'VOICE', telo: '', fotografije: [], moja: true, procitano: null,
    clientMessageId: 'voice_retry_001', glas: { assetId: voiceAssetId, trajanjeMs: 4200, velicina: 2353 } });
  expect(decoded?.messages[0].glas).toBeUndefined();
  expect(decoded?.messages[1].glas).toBeUndefined();
});
it('V2 requires exactly the ten keys: a missing voice key or any extra key rejects the page', () => {
  const { voice: _missing, ...without } = text(1);
  expect(decodeAgreementMessageHistoryPage(page2([without]), accountId, agreementId, v2)).toBeNull();
  expect(decodeAgreementMessageHistoryPage(page2([{ ...text(1), url: 'https://private.invalid' }]), accountId, agreementId, v2)).toBeNull();
});
it.each([
  ['a body on a voice row', { body: 'spoken words' }], ['photos on a voice row', { photos: [photo] }], ['no voice object', { voice: null }],
  ['an extra voice key', { voice: { ...voice, url: 'https://private.invalid' } }], ['a missing voice key', { voice: { assetId: voiceAssetId, durationMs: 4200, byteSize: 2353 } }],
  ['a duration below 300 ms', { voice: { ...voice, durationMs: 299 } }], ['a duration above 5 minutes', { voice: { ...voice, durationMs: 300001 } }],
  ['a fractional duration', { voice: { ...voice, durationMs: 1000.5 } }], ['a size of zero', { voice: { ...voice, byteSize: 0 } }],
  ['a size above 4 MiB', { voice: { ...voice, byteSize: 4194305 } }], ['another content type', { voice: { ...voice, contentType: 'audio/mpeg' } }],
  ['a malformed asset id', { voice: { ...voice, assetId: `${voiceAssetId}\n` } }], ['a non-object voice', { voice: 'audio' }],
])('rejects a voice row with %s', (_name, patch) => {
  expect(decodeAgreementMessageHistoryPage(page2([{ ...voiceRow(3), ...patch }]), accountId, agreementId, v2)).toBeNull();
});
it.each([
  ['TEXT with a voice object', { ...text(1), voice }], ['PHOTO with a voice object', { ...photoRow(2), voice }],
  ['an unknown kind', { ...text(1), kind: 'VIDEO' }], ['TEXT without a body', { ...text(1), body: '' }],
])('rejects %s in a V2 page', (_name, row) => {
  expect(decodeAgreementMessageHistoryPage(page2([row]), accountId, agreementId, v2)).toBeNull();
});
it('keeps the flavours apart: V1 never admits VOICE or the V2 schema, V2 never admits the V1 schema', () => {
  expect(decodeAgreementMessageHistoryPage(page2(), accountId, agreementId)).toBeNull();
  const { voice: _v, ...v1Text } = text(1);
  const v1 = { ...page2([v1Text]), schema: 'AGREEMENT_MESSAGES_PAGE_V1' };
  expect(decodeAgreementMessageHistoryPage(v1, accountId, agreementId)?.messages[0].kind).toBe('TEXT');
  expect(decodeAgreementMessageHistoryPage(v1, accountId, agreementId, v2)).toBeNull();
  expect(decodeAgreementMessageHistoryPage({ ...page2([v1Text]) }, accountId, agreementId)).toBeNull();
});
it('decodes a V2 window around a voice message and rejects the V1 schema name', () => {
  const decoded = decodeAgreementMessageWindow(window2(), accountId, agreementId, id(2), { ...v2, beforeCount: 1, afterCount: 1 });
  expect(decoded?.messages[1]).toMatchObject({ id: id(2), kind: 'VOICE', glas: { trajanjeMs: 4200 } });
  expect(decodeAgreementMessageWindow({ ...window2(), schema: 'AGREEMENT_MESSAGE_WINDOW_V1' }, accountId, agreementId, id(2), { ...v2, beforeCount: 1, afterCount: 1 })).toBeNull();
  expect(decodeAgreementMessageWindow(window2(), accountId, agreementId, id(2), { beforeCount: 1, afterCount: 1 })).toBeNull();
});
it('the service reads the V2 functions when the build carries voice and the V1 functions otherwise; acknowledgement is one function for both', async () => {
  const on = createAgreementMessageHistoryService(rpc, { voice: true }), off = createAgreementMessageHistoryService(rpc, { voice: false });
  rpc.mockResolvedValue({ data: page2([voiceRow(3)]), error: null });
  expect(await on.page(agreementId, { limit: 1 })).toMatchObject({ ok: true, podatak: { messages: [{ kind: 'VOICE' }] } });
  expect(rpc.mock.calls[0][0]).toBe('rpc_read_agreement_messages_page_v2');
  rpc.mockResolvedValue({ data: window2(), error: null });
  expect(await on.window(agreementId, id(2), { beforeCount: 1, afterCount: 1 })).toMatchObject({ ok: true });
  expect(rpc.mock.calls[1][0]).toBe('rpc_read_agreement_message_window_v2');
  rpc.mockResolvedValue({ data: page2([voiceRow(3)]), error: null });
  expect(await off.page(agreementId, { limit: 1 })).toMatchObject({ ok: false });
  expect(rpc.mock.calls[2][0]).toBe('rpc_read_agreement_messages_page_v1');
  rpc.mockResolvedValue({ data: { schema: 'AGREEMENT_MESSAGE_READ_V1', accountId, agreementId, displayedMessageIds: [id(3)], markedEventCount: 1, authoritative: true }, error: null });
  expect(await on.markDisplayed(agreementId, [id(3)])).toMatchObject({ ok: true });
  expect(rpc.mock.calls[3][0]).toBe('rpc_mark_displayed_agreement_messages_v1');
});
it('a service built without an explicit choice follows the compile-time flag, which is off in tests', async () => {
  const defaulted = createAgreementMessageHistoryService(rpc);
  rpc.mockResolvedValue({ data: { ...page2([]), schema: 'AGREEMENT_MESSAGES_PAGE_V1' }, error: null });
  expect(await defaulted.page(agreementId)).toMatchObject({ ok: true });
  expect(rpc.mock.calls[0][0]).toBe('rpc_read_agreement_messages_page_v1');
});
