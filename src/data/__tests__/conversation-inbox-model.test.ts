import type { ConversationInboxItem, ConversationInboxPage } from '../../contracts/conversationInbox';
import type { ConversationInboxPort } from '../conversationInboxClientService';
import type { Ishod } from '../ports';
import { createConversationInboxModel } from '../conversationInboxModel';

const account = '10000000-0000-4000-8000-000000000001';
const snapshot = '2026-10-02T12:00:00.123456Z';
const freshSnapshot = '2026-10-02T13:00:00.123456Z';
const uuid = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number): ConversationInboxItem => ({
  kind: 'AGREEMENT', id: uuid(n), routeAgreementId: uuid(n),
  task: { id: uuid(100 + n), title: `Zadatak ${n}` }, counterpart: null,
  lastMessage: { id: uuid(200 + n), createdAt: `2026-10-02T10:${String(59 - n).padStart(2, '0')}:00.123456Z`,
    mine: false, kind: 'TEXT', preview: `Poruka ${n}` }, unreadMessageCount: null,
});
const page = (items: ConversationInboxItem[], more = false, at = snapshot): ConversationInboxPage => ({
  schema: 'MY_CONVERSATIONS_PAGE_V1', accountId: account, authoritative: true,
  asOf: freshSnapshot, snapshotAt: at, items,
  nextCursor: more ? { snapshotAt: at, lastAt: items.at(-1)!.lastMessage.createdAt,
    kind: items.at(-1)!.kind, id: items.at(-1)!.id } : null,
});
const ok = (podatak: ConversationInboxPage): Ishod<ConversationInboxPage> => ({ ok: true, podatak });
const failure = (kod: string): Ishod<ConversationInboxPage> => ({ ok: false, kod, poruka: 'Nije učitano.' });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function setup() {
  let current = true;
  const list = jest.fn<ReturnType<ConversationInboxPort['list']>, Parameters<ConversationInboxPort['list']>>();
  const model = createConversationInboxModel({ list }, () => current);
  return { model, list, changeAccount: () => { current = false; } };
}

test('first failure is not empty success; only the exact current row can open', async () => {
  const { model, list } = setup();
  list.mockResolvedValueOnce(failure('CONVERSATION_INBOX_TRANSPORT_UNAVAILABLE'));
  await model.start();
  expect(model.snapshot()).toMatchObject({ page: null, error: 'load', stale: true });
  list.mockResolvedValueOnce(ok(page([])));
  await model.refresh();
  expect(model.snapshot()).toMatchObject({ page: { items: [] }, error: null, stale: false });
  const item = row(1); list.mockResolvedValueOnce(ok(page([item]))); await model.refresh();
  expect(model.canOpen(item)).toBe(true);
  expect(model.canOpen({ ...item })).toBe(false);
});

test('short Back preserves depth and rows until a whole fresh chain settles', async () => {
  const { model, list } = setup(); const a = row(1), b = row(2);
  const first = page([a], true), second = page([b], true);
  list.mockResolvedValueOnce(ok(first)).mockResolvedValueOnce(ok(second));
  await model.start(); await model.more();
  expect(list.mock.calls[1][0]).toEqual(first.nextCursor);
  expect(model.snapshot().loadedPages).toBe(2);
  model.stop(); expect(model.snapshot().page?.items).toEqual([a,b]); expect(model.canOpen(a)).toBe(false);
  const a2 = { ...a }, b2 = { ...b }, next = deferred<Ishod<ConversationInboxPage>>();
  const firstFresh = page([a2], true, freshSnapshot);
  list.mockResolvedValueOnce(ok(firstFresh)).mockReturnValueOnce(next.promise);
  const returning = model.start(); await flush();
  expect(list.mock.calls[2][0]).toBeNull(); expect(list.mock.calls[3][0]).toEqual(firstFresh.nextCursor);
  expect(model.snapshot().page?.items).toEqual([a,b]); expect(model.snapshot().refreshing).toBe(true);
  expect(model.canOpen(a)).toBe(false);
  next.resolve(ok(page([b2], false, freshSnapshot))); await returning;
  expect(model.snapshot().page?.items[0]).toBe(a2); expect(model.snapshot().page?.items[1]).toBe(b2);
  expect(model.snapshot().loadedPages).toBe(2); expect(model.canOpen(a2)).toBe(true);
  expect(model.canOpen(a)).toBe(false);
});

test('explicit refresh resets to one page; exhausted fresh chain may shrink safely', async () => {
  const { model, list } = setup();
  list.mockResolvedValueOnce(ok(page([row(1)], true))).mockResolvedValueOnce(ok(page([row(2)])));
  await model.start(); await model.more();
  list.mockResolvedValueOnce(ok(page([row(1)], true, freshSnapshot))); await model.refresh();
  expect(model.snapshot().loadedPages).toBe(1); expect(model.snapshot().page?.items).toHaveLength(1);
  model.stop(); list.mockResolvedValueOnce(ok(page([], false, freshSnapshot))); await model.start();
  expect(model.snapshot()).toMatchObject({ loadedPages: 1, page: { items: [], nextCursor: null }, stale: false });
});

test.each(['stop', 'forget', 'account'] as const)('%s fences late success, aborts where applicable, and never opens retained rows', async kind => {
  const { model, list, changeAccount } = setup(); const a = row(1);
  list.mockResolvedValueOnce(ok(page([a], true))); await model.start();
  const pending = deferred<Ishod<ConversationInboxPage>>(); list.mockReturnValueOnce(pending.promise);
  const reading = model.more(); const signal = list.mock.calls[1][1]!;
  if (kind === 'account') changeAccount(); else model[kind]();
  expect(model.canOpen(a)).toBe(false);
  if (kind !== 'account') expect(signal.aborted).toBe(true);
  if (kind !== 'stop') expect(model.snapshot().page).toBeNull();
  pending.resolve(ok(page([row(2)]))); await reading;
  expect(model.snapshot().page?.items).toEqual(kind === 'stop' ? [a] : undefined);
  expect(signal.aborted).toBe(true);
});

test('a fresh request wins even if old transport ignores abort', async () => {
  const { model, list } = setup(); const old = deferred<Ishod<ConversationInboxPage>>();
  list.mockReturnValueOnce(old.promise); const started = model.start();
  const oldSignal = list.mock.calls[0][1]!; const a = row(1);
  list.mockResolvedValueOnce(ok(page([a]))); await model.refresh();
  expect(oldSignal.aborted).toBe(true);
  old.resolve(ok(page([row(2)]))); await started;
  expect(model.snapshot().page?.items).toEqual([a]); expect(model.canOpen(a)).toBe(true);
});

test.each(['CONVERSATION_INBOX_INVALID_RESPONSE', 'AUTH_CONTEXT_CHANGED', 'ACCOUNT_CLOSING',
  'CONVERSATION_INBOX_UNCONFIRMED', 'INBOX_CURSOR_INVALID'])('semantic failure %s removes old rows', async code => {
  const { model, list } = setup(); const a = row(1);
  list.mockResolvedValueOnce(ok(page([a]))); await model.start();
  list.mockResolvedValueOnce(failure(code)); await model.refresh();
  expect(model.snapshot()).toMatchObject({ page: null, loadedPages: 0, stale: true, error: 'refresh', errorCode: code });
  expect(model.canOpen(a)).toBe(false);
});

test('transport retention is explicit; arbitrary thrown offline failure is not retained', async () => {
  const { model, list } = setup(); const a = row(1);
  list.mockResolvedValueOnce(ok(page([a]))); await model.start();
  list.mockResolvedValueOnce(failure('CONVERSATION_INBOX_TRANSPORT_UNAVAILABLE')); await model.refresh();
  expect(model.snapshot().page?.items).toEqual([a]); expect(model.canOpen(a)).toBe(false);
  list.mockRejectedValueOnce(new Error('offline')); await model.refresh();
  expect(model.snapshot()).toMatchObject({ page: null, errorCode: 'CONVERSATION_INBOX_UNCONFIRMED' });
});

test('page transport retry atomically rebuilds old depth plus requested page; repeated more never overlaps', async () => {
  const { model, list } = setup(); const a = row(1), b = row(2);
  list.mockResolvedValueOnce(ok(page([a], true))); await model.start();
  const pending = deferred<Ishod<ConversationInboxPage>>(); list.mockReturnValueOnce(pending.promise);
  const reading = model.more(); await model.more(); expect(list).toHaveBeenCalledTimes(2);
  pending.resolve(failure('CONVERSATION_INBOX_TRANSPORT_UNAVAILABLE')); await reading;
  expect(model.snapshot()).toMatchObject({ loadedPages: 1, error: 'page', stale: true });
  const newer = { ...a }, second = deferred<Ishod<ConversationInboxPage>>();
  list.mockResolvedValueOnce(ok(page([newer], true, freshSnapshot))).mockReturnValueOnce(second.promise);
  const retry = model.more(); await flush();
  expect(list.mock.calls[2][0]).toBeNull(); expect(model.snapshot().page?.items[0]).toBe(a);
  second.resolve(ok(page([b], false, freshSnapshot))); await retry;
  expect(model.snapshot().page?.items).toEqual([newer,b]); expect(model.snapshot().loadedPages).toBe(2);
  expect(model.canOpen(newer)).toBe(true);
});

test.each(['snapshot', 'duplicate', 'account'] as const)('cross-page %s mismatch fails closed instead of silently merging', async kind => {
  const { model, list } = setup(); const a = row(1);
  list.mockResolvedValueOnce(ok(page([a], true))); await model.start();
  const next = page(kind === 'duplicate' ? [a] : [row(2)], false, kind === 'snapshot' ? freshSnapshot : snapshot);
  list.mockResolvedValueOnce(ok(kind === 'account' ? { ...next, accountId: uuid(999) } : next)); await model.more();
  expect(model.snapshot()).toMatchObject({ page: null, errorCode: 'CONVERSATION_INBOX_INVALID_RESPONSE' });
});

test('background forget starts again at first page without reviving the old chain', async () => {
  const { model, list } = setup();
  list.mockResolvedValueOnce(ok(page([row(1)], true))).mockResolvedValueOnce(ok(page([row(2)])));
  await model.start(); await model.more(); model.forget();
  expect(model.snapshot().page).toBeNull();
  list.mockResolvedValueOnce(ok(page([], false, freshSnapshot))); await model.start();
  expect(list.mock.calls[2][0]).toBeNull(); expect(model.snapshot().loadedPages).toBe(1);
});

test('incoming hints never cancel pagination and coalesce into one fresh chain at the new depth', async () => {
  const { model, list } = setup(); const a = row(1), b = row(2);
  list.mockResolvedValueOnce(ok(page([a], true))); await model.start();
  const older = deferred<Ishod<ConversationInboxPage>>(); list.mockReturnValueOnce(older.promise);
  const paging = model.more(), signal = list.mock.calls[1][1]!;
  const hint = model.revalidate(), sameHint = model.revalidate();
  expect(hint).toBe(sameHint); expect(list).toHaveBeenCalledTimes(2); expect(signal.aborted).toBe(false);
  const freshFirst = deferred<Ishod<ConversationInboxPage>>();
  list.mockReturnValueOnce(freshFirst.promise).mockResolvedValueOnce(ok(page([{ ...b }], false, freshSnapshot)));
  older.resolve(ok(page([b]))); await paging;
  expect(list).toHaveBeenCalledTimes(3); expect(list.mock.calls[2][0]).toBeNull();
  expect(model.snapshot().page?.items).toEqual([a,b]); expect(model.canOpen(a)).toBe(false);
  freshFirst.resolve(ok(page([{ ...a }], true, freshSnapshot))); await hint;
  expect(list).toHaveBeenCalledTimes(4); expect(model.snapshot().loadedPages).toBe(2);
  expect(model.snapshot().page?.snapshotAt).toBe(freshSnapshot);
  expect(model.canOpen(model.snapshot().page!.items[0])).toBe(true);
});

test('a hint arriving during trailing revalidation is not lost', async () => {
  const { model, list } = setup(); list.mockResolvedValueOnce(ok(page([row(1)]))); await model.start();
  const first = deferred<Ishod<ConversationInboxPage>>(), second = deferred<Ishod<ConversationInboxPage>>();
  list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValueOnce(ok(page([row(3)])));
  const reading = model.revalidate(), trailing = model.revalidate();
  first.resolve(ok(page([row(1)]))); await reading;
  expect(list).toHaveBeenCalledTimes(3);
  const latest = model.revalidate();
  second.resolve(ok(page([row(2)]))); await trailing; await latest;
  expect(list).toHaveBeenCalledTimes(4); expect(model.snapshot().page?.items[0].id).toBe(row(3).id);
});

test.each(['stop', 'forget'] as const)('%s retires a queued incoming hint without waiting for ignored abort', async method => {
  const { model, list } = setup(); const pending = deferred<Ishod<ConversationInboxPage>>();
  list.mockReturnValueOnce(pending.promise); const loading = model.start();
  const queued = model.revalidate(); model[method](); await queued;
  expect(list.mock.calls[0][1]!.aborted).toBe(true);
  pending.resolve(ok(page([row(1)]))); await loading;
  expect(list).toHaveBeenCalledTimes(1); expect(model.snapshot().page).toBeNull();
});

test('queued hint does not autonomously repeat a failed authorization read', async () => {
  const { model, list } = setup(); const pending = deferred<Ishod<ConversationInboxPage>>();
  list.mockReturnValueOnce(pending.promise); const loading = model.start(), queued = model.revalidate();
  pending.resolve(failure('AUTH_CONTEXT_CHANGED')); await loading; await queued;
  expect(list).toHaveBeenCalledTimes(1); expect(model.snapshot()).toMatchObject({ page: null, errorCode: 'AUTH_CONTEXT_CHANGED' });
});
