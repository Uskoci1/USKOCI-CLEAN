const accountId = '10000000-0000-4000-8000-000000000001';
const otherAccountId = '10000000-0000-4000-8000-000000000002';
const agreementId = '20000000-0000-4000-8000-000000000001';
const assetId = '40000000-0000-4000-8000-000000000001';
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let mockAccount: string | null = accountId, mockRevision = 0;
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { compareAgreementMessageCursors, createAgreementMessageHistoryService, decodeAgreementDisplayedMessagesReceipt,
  decodeAgreementMessageHistoryPage, decodeAgreementMessageWindow } from '../agreementMessageHistoryService';

const photo = { assetId, width: 1600, height: 1200, byteSize: 1024, contentType: 'image/jpeg' };
const row = (n = 1) => ({ messageId: id(n), agreementVersion: 2, senderAccountId: accountId, clientMessageId: 'message_retry_1',
  body: `Message ${n}`, createdAt: `2026-09-27T12:00:00.${String(n).padStart(6, '0')}+00:00`, kind: 'TEXT', mine: true, photos: [] as unknown[] });
const boundary = (n: number) => ({ messageId: id(n), createdAt: row(n).createdAt });
const page = (numbers = [1, 2]) => ({ schema: 'AGREEMENT_MESSAGES_PAGE_V1', accountId, agreementId,
  messages: numbers.map(row), olderCursor: null as unknown, asOf: '2026-09-27T13:00:00.123456+00:00', authoritative: true });
const window = (numbers = [1, 2, 3]) => ({ schema: 'AGREEMENT_MESSAGE_WINDOW_V1', accountId, agreementId, targetMessageId: id(2),
  messages: numbers.map(row), beforeCursor: null as unknown, afterCursor: null as unknown, asOf: page().asOf, authoritative: true });
const receipt = (ids = [id(1), id(2)]) => ({ schema: 'AGREEMENT_MESSAGE_READ_V1', accountId, agreementId,
  displayedMessageIds: ids, markedEventCount: 1, authoritative: true });
const rpc = jest.fn(), service = createAgreementMessageHistoryService(rpc);
beforeEach(() => { jest.clearAllMocks(); rpc.mockReset(); mockAccount = accountId; mockRevision = 0; });

it('retains exact microsecond cursors and message identity without inventing personal read receipts', async () => {
  rpc.mockResolvedValue({ data: { ...page(), olderCursor: boundary(1) }, error: null });
  const result = await service.page(agreementId, { limit: 2, before: boundary(3) });
  expect(result).toMatchObject({ ok: true, podatak: { olderCursor: boundary(1), messages: [
    { id: id(1), dogovorVerzija: 2, clientMessageId: 'message_retry_1', posiljalacAccountId: accountId, moja: true,
      createdAt: row(1).createdAt, procitano: null, fotografije: [], kind: 'TEXT' }, { id: id(2) }], asOf: page().asOf } });
  expect(rpc).toHaveBeenCalledWith('rpc_read_agreement_messages_page_v1', { p_expected_user_id: accountId, p_agreement_id: agreementId,
    p_limit: 2, p_before_created_at: row(3).createdAt, p_before_id: id(3) }, undefined);
});
it('requests only the bounded newest page and treats a validated empty array as the boundary', async () => {
  rpc.mockResolvedValue({ data: page([]), error: null });
  expect(await service.page(agreementId)).toMatchObject({ ok: true, podatak: { messages: [], olderCursor: null } });
  expect(rpc).toHaveBeenCalledWith('rpc_read_agreement_messages_page_v1', { p_expected_user_id: accountId, p_agreement_id: agreementId,
    p_limit: 50, p_before_created_at: null, p_before_id: null }, undefined);
  expect(decodeAgreementMessageHistoryPage({ ...page([]), messages: null }, accountId, agreementId)).toBeNull();
  expect(decodeAgreementMessageHistoryPage({ ...page([]), olderCursor: boundary(1) }, accountId, agreementId)).toBeNull();
});
it('orders equivalent offset instants and microseconds before considering UUID ties', () => {
  expect(compareAgreementMessageCursors(boundary(1), boundary(2))).toBeLessThan(0);
  expect(compareAgreementMessageCursors({ ...boundary(1), messageId: id(9) }, boundary(2))).toBeLessThan(0);
  expect(compareAgreementMessageCursors({ createdAt: '2026-09-27T14:00:00.000001+02:00', messageId: id(1) }, boundary(1))).toBe(0);
  expect(compareAgreementMessageCursors(boundary(1), { ...boundary(1), messageId: id(2) })).toBeLessThan(0);
  expect(compareAgreementMessageCursors({ ...boundary(1), createdAt: '2026-09-27T12:00:00.1Z' },
    { ...boundary(1), createdAt: '2026-09-27T12:00:00.100000+00:00' })).toBe(0);
});
it.each([
  { accountId: otherAccountId }, { agreementId: otherAccountId }, { schema: 'UNTRUSTED' }, { authoritative: false },
  { privateUrl: 'https://private.invalid' }, { asOf: '2026-02-30T12:00:00Z' }, { messages: [row(2), row(1)] },
  { messages: [row(1), row(1)] }, { olderCursor: boundary(2) }, { olderCursor: { ...boundary(1), createdAt: '2026-09-27T12:00:00.000Z' } },
  { olderCursor: { ...boundary(1), url: 'private' } }, { messages: Array.from({ length: 51 }, (_, n) => row(n)) },
])('rejects malformed, foreign, oversized or imprecisely anchored page envelopes %#', patch => {
  expect(decodeAgreementMessageHistoryPage({ ...page(), ...patch }, accountId, agreementId)).toBeNull();
});
it.each([
  { messageId: 'bad' }, { messageId: `${id(1)}\n` }, { agreementVersion: 0 }, { agreementVersion: 2147483648 }, { senderAccountId: 'bad' },
  { senderAccountId: otherAccountId }, { mine: false }, { mine: 'true' }, { clientMessageId: 'too_short\n' },
  { clientMessageId: undefined }, { body: '' }, { body: 'a'.repeat(2001) }, { body: '\ud800' }, { body: 'bad\0body' },
  { createdAt: 'infinity' }, { createdAt: '2026-09-27T12:00:00.0000001Z' }, { createdAt: '2026-02-30T12:00:00Z' },
  { createdAt: `${row(1).createdAt}\n` },
  { kind: 'VOICE' }, { kind: 'PHOTO' }, { photos: [photo] }, { read_at: '2026-09-27T12:00:00Z' },
])('rejects invalid canonical message projection %#', patch => {
  expect(decodeAgreementMessageHistoryPage({ ...page([1]), messages: [{ ...row(), ...patch }] }, accountId, agreementId)).toBeNull();
});
it('admits legacy keys, counterpart identity, historical versions and bounded PHOTO metadata', () => {
  const value = { ...page([1]), messages: [{ ...row(), agreementVersion: 1, senderAccountId: otherAccountId, mine: false,
    clientMessageId: null, kind: 'PHOTO', body: '', photos: [photo] }] };
  expect(decodeAgreementMessageHistoryPage(value, accountId, agreementId)?.messages[0]).toMatchObject({ dogovorVerzija: 1,
    posiljalacAccountId: otherAccountId, moja: false, clientMessageId: null, fotografije: [photo], procitano: null });
});
it.each([
  { photos: [{ ...photo, url: 'private' }] }, { photos: [{ ...photo, width: 1601 }] }, { photos: [{ ...photo, height: 0 }] },
  { photos: [{ ...photo, byteSize: 5242881 }] }, { photos: [{ ...photo, contentType: 'image/png' }] },
  { photos: [{ ...photo, assetId: `${assetId}\n` }] }, { photos: [photo, photo] },
  { photos: Array.from({ length: 7 }, (_, n) => ({ ...photo, assetId: id(n) })) },
])('uses existing photo allowlist and refuses malformed, duplicate or oversized photo arrays %#', ({ photos }) => {
  expect(decodeAgreementMessageHistoryPage({ ...page([1]), messages: [{ ...row(), kind: 'PHOTO', photos }] }, accountId, agreementId)).toBeNull();
});
it('rejects rows equal to or newer than the exclusive before tuple and a cursor on an underfull page', () => {
  expect(decodeAgreementMessageHistoryPage(page(), accountId, agreementId, { before: boundary(2) })).toBeNull();
  expect(decodeAgreementMessageHistoryPage(page(), accountId, agreementId, { before: boundary(1) })).toBeNull();
  expect(decodeAgreementMessageHistoryPage({ ...page(), olderCursor: boundary(1) }, accountId, agreementId)).toBeNull();
  const tied = { ...page(), messages: [row(1), { ...row(2), createdAt: row(1).createdAt }] };
  expect(decodeAgreementMessageHistoryPage(tied, accountId, agreementId)).not.toBeNull();
  expect(decodeAgreementMessageHistoryPage({ ...tied, messages: [...tied.messages].reverse() }, accountId, agreementId)).toBeNull();
});
it('captures cursor and account objects before awaits so caller mutation cannot retarget the receipt', async () => {
  const before = boundary(3), scope = { accountId, accountRevision: 0 };
  rpc.mockImplementation(async () => { before.createdAt = row(1).createdAt; scope.accountId = otherAccountId; return { data: page(), error: null }; });
  expect(await service.page(agreementId, { before }, scope)).toMatchObject({ ok: true });
  expect(rpc.mock.calls[0][1].p_before_created_at).toBe(row(3).createdAt);
});

it('reads an exact old-message window with no opposite-side refill', async () => {
  rpc.mockResolvedValue({ data: { ...window(), beforeCursor: boundary(1), afterCursor: boundary(3) }, error: null });
  expect(await service.window(agreementId, id(2), { beforeCount: 1, afterCount: 1 })).toMatchObject({ ok: true,
    podatak: { targetMessageId: id(2), beforeCursor: boundary(1), afterCursor: boundary(3) } });
  expect(rpc).toHaveBeenCalledWith('rpc_read_agreement_message_window_v1', { p_expected_user_id: accountId, p_agreement_id: agreementId,
    p_target_message_id: id(2), p_before_count: 1, p_after_count: 1 }, undefined);
  expect(decodeAgreementMessageWindow(window([2, 3]), accountId, agreementId, id(2), { beforeCount: 1, afterCount: 1 })).not.toBeNull();
  expect(decodeAgreementMessageWindow(window([2, 3, 4]), accountId, agreementId, id(2), { beforeCount: 1, afterCount: 1 })).toBeNull();
});
it('admits a target-only window with both continuation cursors at the same exact target', () => {
  expect(decodeAgreementMessageWindow({ ...window([2]), beforeCursor: boundary(2), afterCursor: boundary(2) },
    accountId, agreementId, id(2), { beforeCount: 0, afterCount: 0 })).toMatchObject({ messages: [{ id: id(2) }],
    beforeCursor: boundary(2), afterCursor: boundary(2) });
});
it.each([
  { targetMessageId: id(9) }, { messages: [] }, { messages: [row(1), row(3)] }, { messages: [row(1), row(2), row(2)] },
  { beforeCursor: boundary(2) }, { afterCursor: boundary(2) }, { beforeCursor: boundary(1) }, { afterCursor: boundary(3) },
  { olderCursor: null }, { authoritative: false }, { accountId: otherAccountId },
])('rejects targetless, foreign, duplicated or inconsistent exact windows %#', patch => {
  expect(decodeAgreementMessageWindow({ ...window(), ...patch }, accountId, agreementId, id(2))).toBeNull();
});

it('ACKs only the captured measured IDs and accepts zero newly marked events', async () => {
  const ids = [id(1), id(2)];
  rpc.mockImplementation(async () => { ids.push(id(3)); return { data: { ...receipt(), markedEventCount: 0 }, error: null }; });
  expect(await service.markDisplayed(agreementId, ids)).toEqual({ ok: true, podatak: { accountId, agreementId,
    displayedMessageIds: [id(1), id(2)], markedEventCount: 0, authoritative: true } });
  expect(rpc).toHaveBeenCalledWith('rpc_mark_displayed_agreement_messages_v1', { p_expected_user_id: accountId,
    p_agreement_id: agreementId, p_message_ids: [id(1), id(2)] }, undefined);
});
it.each([
  { displayedMessageIds: [id(1)] }, { displayedMessageIds: [id(2), id(1)] }, { displayedMessageIds: [id(1), id(3)] },
  { displayedMessageIds: [id(1), id(1)] }, { markedEventCount: -1 }, { markedEventCount: 1.5 }, { markedEventCount: 3 },
  { accountId: otherAccountId }, { agreementId: otherAccountId }, { authoritative: false }, { schema: 'LEGACY_READ' }, { read_at: 'private' },
])('rejects partial, expanded or foreign ACK receipts %#', patch => {
  expect(decodeAgreementDisplayedMessagesReceipt({ ...receipt(), ...patch }, accountId, agreementId, [id(1), id(2)])).toBeNull();
});
it('refuses invalid limits, cursor halves, window budgets and displayed batches before RPC', async () => {
  const reads = [service.page('bad'), service.page(agreementId, { limit: 0 }), service.page(agreementId, { limit: 51 }),
    service.page(agreementId, { before: { createdAt: row(1).createdAt } as never }), service.page(agreementId, { before: { ...boundary(1), createdAt: 'infinity' } }),
    service.window(agreementId, 'bad'), service.window(agreementId, id(1), { beforeCount: -1 }),
    service.window(agreementId, id(1), { beforeCount: 25, afterCount: 25 }), service.window(agreementId, id(1), { beforeCount: 2_147_483_647 }),
    service.markDisplayed(agreementId, []), service.markDisplayed(agreementId, [id(1), id(1)]),
    service.markDisplayed(agreementId, Array.from({ length: 51 }, (_, n) => id(n))), service.markDisplayed(agreementId, [null] as never)];
  expect((await Promise.all(reads)).every(value => !value.ok && value.kod === 'CHAT_HISTORY_INPUT_INVALID')).toBe(true);
  expect(rpc).not.toHaveBeenCalled();
});
it.each(['page', 'window', 'markDisplayed'] as const)('fences %s completion after same-account revision changes', async method => {
  rpc.mockImplementation(async () => { mockRevision++; return { data: method === 'page' ? page() : method === 'window' ? window() : receipt(), error: null }; });
  const result = method === 'page' ? await service.page(agreementId) : method === 'window' ? await service.window(agreementId, id(2)) : await service.markDisplayed(agreementId, [id(1), id(2)]);
  expect(result).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('does not issue stale-account or unauthenticated requests', async () => {
  expect(await service.page(agreementId, {}, { accountId: otherAccountId, accountRevision: 0 })).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  mockAccount = null;
  expect(await service.page(agreementId)).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
  expect(rpc).not.toHaveBeenCalled();
});
it('passes read cancellation to transport and rejects a result arriving after cancellation', async () => {
  const abort = new AbortController();
  rpc.mockImplementation(async () => { abort.abort(); return { data: page(), error: null }; });
  expect(await service.page(agreementId, { signal: abort.signal })).toMatchObject({ ok: false, kod: 'CHAT_HISTORY_CANCELLED' });
  expect(rpc.mock.calls[0][2]).toBe(abort.signal);
  expect(await service.window(agreementId, id(2), { signal: abort.signal })).toMatchObject({ ok: false, kod: 'CHAT_HISTORY_CANCELLED' });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('returns only allowlisted server failures and does not fall back to a broad ACK or table read', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'CHAT_MESSAGE_NOT_AVAILABLE' } })
    .mockResolvedValueOnce({ data: null, error: { message: 'secret backend payload' } });
  expect(await service.window(agreementId, id(2))).toMatchObject({ ok: false, kod: 'CHAT_MESSAGE_NOT_AVAILABLE' });
  const result = await service.markDisplayed(agreementId, [id(1)]);
  expect(result).toMatchObject({ ok: false, kod: 'CHAT_HISTORY_UNCONFIRMED' });
  expect(JSON.stringify(result)).not.toContain('secret'); expect(rpc).toHaveBeenCalledTimes(2);
});
it('bounds a missing ACK receipt without automatic replay', async () => {
  jest.useFakeTimers();
  try {
    rpc.mockImplementation(() => new Promise(() => {}));
    const pending = service.markDisplayed(agreementId, [id(1)]);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({ ok: false, kod: 'CHAT_HISTORY_UNCONFIRMED' });
    expect(rpc).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
