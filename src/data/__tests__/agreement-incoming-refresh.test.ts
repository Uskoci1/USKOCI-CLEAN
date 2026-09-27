import { createAgreementIncomingRefresh, subscribeAgreementIncomingRefresh, type IncomingNotifications } from '../agreementIncomingRefresh';
import { publicInboxNotificationId } from '../../ui/notifications/publicInboxCopy';

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const notification = (identifier = 'incoming-1') => ({ request: { identifier, trigger: { type: 'push' },
  content: { title: 'Nova poruka u Dogovoru', body: 'Imaš novu poruku.', data: { kind: 'INBOX' } } } });
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('starts no read without a hint, deduplicates receipts, and coalesces an in-flight burst into one trailing read', async () => {
  const first = deferred<void>(), refresh = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
  const incoming = createAgreementIncomingRefresh({ refresh, isCurrent: () => true });
  await jest.advanceTimersByTimeAsync(20_000); expect(refresh).not.toHaveBeenCalled();
  incoming.hint('a'); await flush(); expect(refresh).toHaveBeenCalledTimes(1);
  incoming.hint('a'); incoming.hint('b'); incoming.hint('c');
  await jest.advanceTimersByTimeAsync(3_000); expect(refresh).toHaveBeenCalledTimes(1);
  first.resolve(); await flush(); expect(refresh).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(60_000); expect(refresh).toHaveBeenCalledTimes(2);
  incoming.hint('c'); await flush(); expect(refresh).toHaveBeenCalledTimes(2);
  incoming.stop();
});

it('throttles fresh hints, cancels the delayed read, and ignores retained callbacks after stop', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined), incoming = createAgreementIncomingRefresh({ refresh, isCurrent: () => true });
  incoming.hint('a'); await flush(); incoming.hint('b'); incoming.hint('c');
  await jest.advanceTimersByTimeAsync(1_999); expect(refresh).toHaveBeenCalledTimes(1);
  incoming.stop(); incoming.hint('d'); await jest.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('re-checks ownership before the first microtask, delayed read and pending trailing read', async () => {
  let current = true;
  const first = deferred<void>(), refresh = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
  const incoming = createAgreementIncomingRefresh({ refresh, isCurrent: () => current });
  incoming.hint('retired'); current = false; await flush(); expect(refresh).not.toHaveBeenCalled();
  current = true; incoming.hint('a'); await jest.advanceTimersByTimeAsync(2_000); expect(refresh).toHaveBeenCalledTimes(1);
  incoming.hint('b'); current = false; first.resolve(); await flush();
  await jest.advanceTimersByTimeAsync(60_000); expect(refresh).toHaveBeenCalledTimes(1);
  incoming.stop();
});

it('handles a rejected read without autonomous retries and remains usable for a later hint', async () => {
  const refresh = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const incoming = createAgreementIncomingRefresh({ refresh, isCurrent: () => true });
  incoming.hint('a'); await flush(); await jest.advanceTimersByTimeAsync(20_000);
  expect(refresh).toHaveBeenCalledTimes(1);
  incoming.hint('b'); await flush(); expect(refresh).toHaveBeenCalledTimes(2); incoming.stop();
});

function native() {
  const received = jest.fn(), dropped = jest.fn(), removeReceived = jest.fn(), removeDropped = jest.fn();
  const api: IncomingNotifications = {
    addNotificationReceivedListener: callback => { received(callback); return { remove: removeReceived }; },
    addNotificationsDroppedListener: callback => { dropped(callback); return { remove: removeDropped }; },
  };
  return { api, received, dropped, removeReceived, removeDropped };
}

it.each(['disposed', 'inactive'] as const)('does not subscribe when an async native module resolves after %s', async reason => {
  const module = deferred<IncomingNotifications>(), n = native(), refresh = jest.fn(); let current = true;
  const stop = subscribeAgreementIncomingRefresh({ load: () => module.promise, identifier: publicInboxNotificationId,
    refresh, isCurrent: () => current });
  await flush(); if (reason === 'disposed') stop(); else current = false;
  module.resolve(n.api); await flush(); expect(n.received).not.toHaveBeenCalled(); expect(n.dropped).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled(); stop();
});

it('never loads the native module for an already retired owner and contains a module failure', async () => {
  const load = jest.fn().mockRejectedValue(new Error('native unavailable')), refresh = jest.fn();
  const inactive = subscribeAgreementIncomingRefresh({ load, identifier: publicInboxNotificationId, refresh, isCurrent: () => false });
  await flush(); expect(load).not.toHaveBeenCalled(); inactive();
  const active = subscribeAgreementIncomingRefresh({ load, identifier: publicInboxNotificationId, refresh, isCurrent: () => true });
  await flush(); expect(load).toHaveBeenCalledTimes(1); expect(refresh).not.toHaveBeenCalled(); active();
});

it('uses validated notifications and dropped-message callbacks only as hints; disposed native callbacks are inert', async () => {
  const n = native(), refresh = jest.fn().mockResolvedValue(undefined);
  const stop = subscribeAgreementIncomingRefresh({ load: async () => n.api, identifier: publicInboxNotificationId, refresh, isCurrent: () => true });
  await flush(); expect(refresh).not.toHaveBeenCalled();
  const received = n.received.mock.calls[0][0] as (value: unknown) => void, dropped = n.dropped.mock.calls[0][0] as () => void;
  received({ request: { content: { data: { kind: 'INBOX', agreementId: 'untrusted' } } } });
  await flush(); expect(refresh).not.toHaveBeenCalled();
  received(notification()); await flush(); expect(refresh).toHaveBeenCalledTimes(1);
  dropped(); await jest.advanceTimersByTimeAsync(2_000); expect(refresh).toHaveBeenCalledTimes(2);
  stop(); received(notification('late')); dropped(); await jest.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledTimes(2); expect(n.removeReceived).toHaveBeenCalledTimes(1); expect(n.removeDropped).toHaveBeenCalledTimes(1);
});

it('removes a partial subscription if the second native registration throws', async () => {
  const n = native(); n.api.addNotificationsDroppedListener = () => { throw new Error('native unavailable'); };
  const refresh = jest.fn(), stop = subscribeAgreementIncomingRefresh({ load: async () => n.api,
    identifier: publicInboxNotificationId, refresh, isCurrent: () => true });
  await flush(); expect(n.removeReceived).toHaveBeenCalledTimes(1);
  (n.received.mock.calls[0][0] as (value: unknown) => void)(notification());
  await flush(); expect(refresh).not.toHaveBeenCalled(); stop();
});

it('keeps the strict public notification envelope instead of treating arbitrary data as a message', () => {
  const valid = notification(); expect(publicInboxNotificationId(valid)).toBe('incoming-1');
  expect(publicInboxNotificationId(null)).toBeNull();
  for (const content of [
    { ...valid.request.content, body: 'private message text' },
    { ...valid.request.content, data: { kind: 'INBOX', url: '/dogovor/untrusted' } },
    { ...valid.request.content, attachments: ['private-photo'] },
    { ...valid.request.content, threadIdentifier: 'agreement' },
  ]) expect(publicInboxNotificationId({ request: { ...valid.request, content } })).toBeNull();
  expect(publicInboxNotificationId({ request: { ...valid.request, trigger: { type: 'timeInterval' } } })).toBeNull();
  expect(publicInboxNotificationId({ request: { ...valid.request, trigger: { type: 'push', remoteMessage: { notification: { imageUrl: 'private' } } } } })).toBeNull();
});
