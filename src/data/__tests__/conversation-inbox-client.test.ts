const accountId = '10000000-0000-4000-8000-000000000001';
const otherAccountId = '10000000-0000-4000-8000-000000000002';
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let mockAccount: string | null = accountId, mockRevision = 1;
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { createConversationInboxClientService, decodeConversationInboxPage } from '../conversationInboxClientService';
import type { ConversationInboxItem } from '../../contracts/conversationInbox';

const snapshotAt = '2026-10-03T12:01:00.123456+00:00';
const row = (n = 1, createdAt = '2026-10-03T12:00:00.000001+00:00'): ConversationInboxItem => ({
  kind: 'AGREEMENT', id: id(n), routeAgreementId: id(n), task: { id: id(100 + n), title: 'Pomoć oko selidbe' },
  counterpart: { profileId: id(50), displayName: 'Sagovornik' },
  lastMessage: { id: id(200 + n), createdAt, mine: true, kind: 'TEXT', preview: 'Dogovoreno.' }, unreadMessageCount: null,
});
const page = (items: readonly ConversationInboxItem[] = [row()]) => ({
  schema: 'MY_CONVERSATIONS_PAGE_V1', accountId, authoritative: true, asOf: snapshotAt, snapshotAt, items, nextCursor: null as unknown,
});
const cursor = (item: ConversationInboxItem) => ({ snapshotAt, lastAt: item.lastMessage.createdAt, kind: item.kind, id: item.id });
beforeEach(() => { mockAccount = accountId; mockRevision = 1; jest.clearAllMocks(); });

it('preserves separate conversations with the same person, caller-sent preview and unknown private unread status', () => {
  const rows = [row(2), row(1)];
  expect(decodeConversationInboxPage(page(rows), accountId)?.items).toEqual(rows);
  expect(decodeConversationInboxPage(page([]), accountId)?.items).toEqual([]);
  expect(decodeConversationInboxPage({ ...page(), items: null }, accountId)).toBeNull();
});
it('uses microseconds before UUID and accepts an equivalent timezone spelling without rounding a cursor', () => {
  const newer = row(1, '2026-10-03T14:00:00.000002+02:00'), older = row(9);
  const raw = { ...page([newer, older]), nextCursor: cursor(older) };
  expect(decodeConversationInboxPage(raw, accountId, { limit: 2 })?.nextCursor).toEqual(cursor(older));
  expect(decodeConversationInboxPage(page([older, newer]), accountId)).toBeNull();
  expect(decodeConversationInboxPage(page([older]), accountId, { cursor: cursor(newer) })).not.toBeNull();
  expect(decodeConversationInboxPage(page([newer]), accountId, { cursor: cursor(newer) })).toBeNull();
});
it('honors server C-collation kind ordering and UUID ordering at equal timestamps', () => {
  const group: ConversationInboxItem = { ...row(1), kind: 'GROUP', counterpart: null, unreadMessageCount: 2 };
  expect(decodeConversationInboxPage(page([group, row(2), row(1)]), accountId)).not.toBeNull();
  expect(decodeConversationInboxPage(page([row(2), group]), accountId)).toBeNull();
});
it.each([
  { accountId: otherAccountId }, { authoritative: false }, { schema: 'INBOX_PAGE_V1' },
  { asOf: '2026-02-30T12:00:00Z' }, { snapshotAt: '2026-10-03T12:02:00Z' },
  { items: [row(), row()] }, { signedUrl: 'https://example.invalid/private' },
])('rejects a wrong owner, malformed authority/date or duplicate/private extra envelope %#', patch => {
  expect(decodeConversationInboxPage({ ...page(), ...patch }, accountId)).toBeNull();
});
it('requires continuation to match the final displayed row and immutable snapshot, not an arbitrary valid UUID', () => {
  expect(decodeConversationInboxPage({ ...page(), nextCursor: cursor(row(2)) }, accountId, { limit: 1 })).toBeNull();
  expect(decodeConversationInboxPage({ ...page(), nextCursor: cursor(row()) }, accountId)).toBeNull();
  expect(decodeConversationInboxPage({ ...page(), nextCursor: { ...cursor(row()), lastAt: 'infinity' } }, accountId, { limit: 1 })).toBeNull();
  expect(decodeConversationInboxPage({ ...page(), nextCursor: { ...cursor(row()), snapshotAt: '2026-10-03T12:01:01Z' } }, accountId, { limit: 1 })).toBeNull();
  expect(decodeConversationInboxPage(page(), accountId, { cursor: { ...cursor(row(2)), snapshotAt: '2026-10-03T12:02:00Z' } })).toBeNull();
});
it('rejects privacy violations while keeping genuine nullable counterpart/group unread and media kind semantics', () => {
  const voice = { ...row(), counterpart: null, lastMessage: { ...row().lastMessage, kind: 'VOICE' as const, preview: null } };
  expect(decodeConversationInboxPage(page([voice]), accountId)?.items[0]).toEqual(voice);
  const group = { ...row(), kind: 'GROUP' as const, counterpart: null };
  expect(decodeConversationInboxPage(page([group]), accountId)?.items[0].unreadMessageCount).toBeNull();
  expect(decodeConversationInboxPage(page([{ ...voice, lastMessage: { ...voice.lastMessage, preview: 'Transcript' } }]), accountId)).toBeNull();
  expect(decodeConversationInboxPage(page([{ ...row(), unreadMessageCount: 1 }]), accountId)).toBeNull();
  expect(decodeConversationInboxPage(page([{ ...group, counterpart: row().counterpart }]), accountId)).toBeNull();
  expect(decodeConversationInboxPage(page([{ ...group, lastMessage: voice.lastMessage }]), accountId)).toBeNull();
  expect(decodeConversationInboxPage(page([{ ...row(), routeAgreementId: id(99) }]), accountId)).toBeNull();
  expect(decodeConversationInboxPage(page([{ ...row(), lastMessage: { ...row().lastMessage, objectPath: 'private/audio.m4a' } } as ConversationInboxItem]), accountId)).toBeNull();
});
it('bounds Unicode codepoints rather than UTF-16 units, and rejects unpaired surrogates', () => {
  const withPreview = (preview: string) => page([{ ...row(), lastMessage: { ...row().lastMessage, preview } }]);
  expect(decodeConversationInboxPage(withPreview('🟢'.repeat(240)), accountId)).not.toBeNull();
  expect(decodeConversationInboxPage(withPreview('🟢'.repeat(241)), accountId)).toBeNull();
  expect(decodeConversationInboxPage(withPreview('\ud800'), accountId)).toBeNull();
  expect(decodeConversationInboxPage(withPreview('\t\n'), accountId)).not.toBeNull();
});
it('captures the account and cursor before await, passes expected-user identity and performs no ACK', async () => {
  const scope = { accountId, accountRevision: 1 }, before = cursor(row(2));
  const rpc = jest.fn(async () => { scope.accountId = otherAccountId; before.id = id(1); return { data: page(), error: null }; });
  const service = createConversationInboxClientService(scope, { rpc });
  expect(await service.list(before)).toMatchObject({ ok: true });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('rpc_list_my_conversations_v1', { p_expected_user_id: accountId, p_limit: 30, p_cursor: cursor(row(2)) }, undefined);
});
it('discards completed data after account switch, focus retirement or cancellation', async () => {
  const scope = { accountId, accountRevision: 1 };
  let current = true;
  const switched = createConversationInboxClientService(scope, { rpc: async () => { mockRevision++; return { data: page(), error: null }; } });
  expect(await switched.list()).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  mockRevision = 1;
  const retired = createConversationInboxClientService(scope, { isCurrent: () => current, rpc: async () => { current = false; return { data: page(), error: null }; } });
  expect(await retired.list()).toMatchObject({ ok: false, kod: 'CONVERSATION_INBOX_CANCELLED' });
  const controller = new AbortController(), rpc = jest.fn(); controller.abort();
  expect(await createConversationInboxClientService(scope, { rpc }).list(null, controller.signal)).toMatchObject({ ok: false, kod: 'CONVERSATION_INBOX_CANCELLED' });
  expect(rpc).not.toHaveBeenCalled();
});
it('retains only the helper-proven SDK no-response class; server denial, exception and malformed receipt remain fail-closed', async () => {
  const call = (rpc: () => Promise<unknown>) => createConversationInboxClientService({ accountId, accountRevision: 1 }, { rpc }).list();
  expect(await call(async () => ({ status: 0, data: null, error: { code: '', message: 'Transport text' } }))).toMatchObject({ kod: 'CONVERSATION_INBOX_TRANSPORT_UNAVAILABLE' });
  expect(await call(async () => ({ status: 403, data: null, error: { message: 'ACCOUNT_CLOSING' } }))).toMatchObject({ kod: 'ACCOUNT_CLOSING' });
  expect(await call(async () => { throw new Error('Network unavailable?'); })).toMatchObject({ kod: 'CONVERSATION_INBOX_UNCONFIRMED' });
  expect(await call(async () => ({ error: null, data: page([{ ...row(), unreadMessageCount: 3 }]) }))).toMatchObject({ kod: 'CONVERSATION_INBOX_INVALID_RESPONSE' });
});
