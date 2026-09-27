const accountId = '10000000-0000-4000-8000-000000000001';
const agreementId = '20000000-0000-4000-8000-000000000001';
const otherId = '20000000-0000-4000-8000-000000000002';
let mockActivity = 'active';
let mockSession = { session: { user: { id: accountId } }, accountRevision: 1, sessionEpoch: 1 };
const mockListeners = new Set<(state: string) => void>();
const mockClient = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => mockClient() }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return {
      get currentState() { return mockActivity; },
      addEventListener: (_: string, callback: (state: string) => void) => {
        mockListeners.add(callback); return { remove: () => mockListeners.delete(callback) };
      },
    };
    return Reflect.get(target, key);
  } });
});

import { createAgreementInvalidationService, isAgreementInvalidation, subscribeAgreementInvalidations,
  type AgreementInvalidationScope, type AgreementInvalidationTransport } from '../agreementInvalidationService';

const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
const event = (revision = 1, eventType = 'INSERT') => ({ schema: 'public', table: 'agreement_invalidations_v1',
  eventType, commit_timestamp: '2026-09-27T20:00:00.123456+00:00', errors: [],
  new: { agreement_id: agreementId, revision }, old: {} as Record<string, unknown> });
function fixture() {
  let owned = true, activity = 'active';
  let owner = { accountId: accountId as string | null, accountRevision: 1, sessionEpoch: 1 };
  const changes = new Map<string, (value: unknown) => void>();
  let system: (value: unknown) => void = () => {}, status: (value: string) => void = () => {};
  const listeners = new Set<(state: string) => void>();
  const remove = jest.fn<unknown, []>().mockImplementation(() => Promise.resolve());
  const change = jest.fn((type: 'INSERT' | 'UPDATE', _id: string, callback: (value: unknown) => void) => { changes.set(type, callback); });
  const subscribe = jest.fn((callback: (value: string) => void) => { status = callback; });
  const channel: AgreementInvalidationTransport = { change, subscribe, remove, system: callback => { system = callback; } };
  const open = jest.fn(() => channel), refresh = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  const listen = createAgreementInvalidationService({ open, owner: () => owner, activity: () => activity,
    onActivity: callback => { listeners.add(callback); return { remove: () => { listeners.delete(callback); } }; } });
  const scope: AgreementInvalidationScope = { accountId, accountRevision: 1, sessionEpoch: 1, agreementId,
    refresh, isCurrent: () => owned };
  return { open, refresh, channel, remove, change, subscribe, listeners, scope,
    start: (patch: Partial<AgreementInvalidationScope> = {}) => listen({ ...scope, ...patch }),
    changeOwner: (patch: Partial<typeof owner>) => { owner = { ...owner, ...patch }; },
    setOwned: (value: boolean) => { owned = value; },
    activity: (value: string) => { activity = value; for (const listener of [...listeners]) listener(value); },
    emit: (value: unknown = event(), type = 'INSERT') => changes.get(type)?.(value),
    status: (value: string) => status(value), system: (value: unknown) => system(value),
  };
}
const stops: (() => void)[] = [];
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockListeners.clear(); mockActivity = 'active';
  mockSession = { session: { user: { id: accountId } }, accountRevision: 1, sessionEpoch: 1 }; });
afterEach(async () => { for (const stop of stops.splice(0)) stop(); await flush(); jest.useRealTimers(); });

it.each([
  null, [], { ...event(), schema: 'private' }, { ...event(), table: 'agreement_messages' },
  { ...event(), eventType: 'DELETE' }, { ...event(), commit_timestamp: 'bad' },
  { ...event(), errors: ['untrusted'] }, { ...event(), new: { agreement_id: otherId, revision: 1 } },
  { ...event(), new: { agreement_id: agreementId, revision: 1, body: 'private' } },
  { ...event(), new: { agreement_id: agreementId, revision: 0 } },
  { ...event(), new: { agreement_id: agreementId, revision: '1' } },
  { ...event(), new: { agreement_id: agreementId, revision: Number.MAX_SAFE_INTEGER + 1 } },
  { ...event(), old: null }, { ...event(), old: { agreement_id: otherId } },
  { ...event(), old: { body: 'private' } }, { ...event(), body: 'private' },
])('rejects malformed, foreign or non-body-free wire envelope %#', async value => {
  expect(isAgreementInvalidation(value, agreementId)).toBe(false);
  const f = fixture(); stops.push(f.start()); f.emit(value); await flush();
  expect(f.refresh).not.toHaveBeenCalled();
});

it('admits only a validated body-free hint and accepts a later cache revision reset', async () => {
  const f = fixture(); stops.push(f.start());
  const update = { ...event(8, 'UPDATE'), old: { agreement_id: agreementId, revision: 7 } };
  expect(isAgreementInvalidation(update, agreementId)).toBe(true);
  f.emit(update, 'UPDATE'); await flush(); expect(f.refresh).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(2_000);
  f.emit(event(1)); await flush(); expect(f.refresh).toHaveBeenCalledTimes(2);
  expect(f.refresh.mock.calls).toEqual([[], []]);
});

it('never polls or reads before a hint and opens exactly two filtered change listeners', async () => {
  const f = fixture(); stops.push(f.start()); await jest.advanceTimersByTimeAsync(60_000);
  expect(f.refresh).not.toHaveBeenCalled(); expect(f.open).toHaveBeenCalledTimes(1);
  expect(f.change.mock.calls.map(call => call.slice(0, 2))).toEqual([['INSERT', agreementId], ['UPDATE', agreementId]]);
  expect(f.subscribe).toHaveBeenCalledTimes(1);
});

it('coalesces same-turn join/system/arrival hints but preserves one trailing read for an in-flight arrival', async () => {
  const f = fixture(), first = deferred(); f.refresh.mockReturnValueOnce(first.promise); stops.push(f.start());
  f.status('SUBSCRIBED'); f.status('SUBSCRIBED');
  f.system({ extension: 'postgres_changes', status: 'ok' }); f.emit();
  await flush(); expect(f.refresh).toHaveBeenCalledTimes(1);
  f.system({ extension: 'postgres_changes', status: 'ok' }); f.emit(event(2, 'UPDATE'), 'UPDATE');
  await jest.advanceTimersByTimeAsync(5_000); expect(f.refresh).toHaveBeenCalledTimes(1);
  first.resolve(); await flush(); expect(f.refresh).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(60_000); expect(f.refresh).toHaveBeenCalledTimes(2);
});

it('catches up on SDK reconnect without creating another channel or treating errors as message payloads', async () => {
  const f = fixture(); stops.push(f.start()); f.status('SUBSCRIBED'); await flush();
  await jest.advanceTimersByTimeAsync(2_000);
  f.status('CHANNEL_ERROR'); f.status('TIMED_OUT'); f.status('CLOSED');
  f.system({ extension: 'postgres_changes', status: 'error' }); f.system({ extension: 'broadcast', status: 'ok' });
  await flush(); expect(f.refresh).toHaveBeenCalledTimes(1);
  f.status('SUBSCRIBED'); f.system({ extension: 'postgres_changes', status: 'ok' });
  await flush(); expect(f.refresh).toHaveBeenCalledTimes(2);
  expect(f.open).toHaveBeenCalledTimes(1); expect(f.subscribe).toHaveBeenCalledTimes(1); expect(f.remove).not.toHaveBeenCalled();
});

it.each(['owner', 'accountABA', 'session', 'focus', 'stop', 'background'])('retires queued and retained callbacks on %s', async reason => {
  const f = fixture(), stop = f.start(); stops.push(stop); f.emit();
  if (reason === 'owner') f.changeOwner({ accountId: otherId });
  else if (reason === 'accountABA') f.changeOwner({ accountRevision: 3 });
  else if (reason === 'session') f.changeOwner({ sessionEpoch: 2 });
  else if (reason === 'focus') f.setOwned(false);
  else if (reason === 'background') f.activity('inactive');
  else stop();
  await flush(); expect(f.refresh).not.toHaveBeenCalled(); expect(f.remove).toHaveBeenCalledTimes(1);
  f.changeOwner({ accountId, accountRevision: 1, sessionEpoch: 1 }); f.setOwned(true); f.activity('active');
  f.status('SUBSCRIBED'); f.system({ extension: 'postgres_changes', status: 'ok' }); f.emit(event(2));
  await jest.advanceTimersByTimeAsync(60_000);
  expect(f.refresh).not.toHaveBeenCalled(); expect(f.open).toHaveBeenCalledTimes(1); expect(f.listeners.size).toBe(0);
});

it('retires an in-flight trailing hint synchronously even if channel removal never settles', async () => {
  const f = fixture(), first = deferred(), removal = deferred();
  f.refresh.mockReturnValueOnce(first.promise); f.remove.mockReturnValue(removal.promise);
  const stop = f.start(); stops.push(stop); f.emit(); await flush(); f.emit(event(2)); await flush();
  stop(); first.resolve(); f.status('SUBSCRIBED'); await jest.advanceTimersByTimeAsync(60_000);
  expect(f.refresh).toHaveBeenCalledTimes(1); expect(f.remove).toHaveBeenCalledTimes(1);
  removal.resolve(); await flush();
});

it('keeps a rejected canonical read available for later hints without autonomous retries', async () => {
  const f = fixture(); f.refresh.mockRejectedValueOnce(new Error('offline')); stops.push(f.start());
  f.emit(); await flush(); await jest.advanceTimersByTimeAsync(60_000); expect(f.refresh).toHaveBeenCalledTimes(1);
  f.emit(event(2)); await flush(); expect(f.refresh).toHaveBeenCalledTimes(2);
});

it('does not open for an invalid scope, unowned visit or non-active app', () => {
  const f = fixture();
  for (const patch of [{ accountId: 'bad' }, { agreementId: 'bad' }, { accountRevision: -1 }, { sessionEpoch: NaN }]) stops.push(f.start(patch));
  f.setOwned(false); stops.push(f.start()); f.setOwned(true); f.activity('background'); stops.push(f.start());
  expect(f.open).not.toHaveBeenCalled(); expect(f.refresh).not.toHaveBeenCalled(); expect(f.listeners.size).toBe(0);
});

it('removes a partial registration and makes its retained callback inert', async () => {
  const f = fixture(); f.change.mockImplementationOnce((_type, _id, callback) => {
    f.channel.system = () => { throw new Error('SDK unavailable'); };
    callback(event());
  });
  stops.push(f.start()); await flush(); expect(f.remove).toHaveBeenCalledTimes(1);
  f.emit(event(2), 'UPDATE'); await flush(); expect(f.refresh).not.toHaveBeenCalled(); expect(f.listeners.size).toBe(0);
});

it('uses the existing authenticated client and exact table filters without setting shared Auth or calling an RPC', async () => {
  const on = jest.fn(), subscribe = jest.fn(), removeChannel = jest.fn().mockResolvedValue(undefined);
  const channel = { on, subscribe }, client = { channel: jest.fn(() => channel), removeChannel, rpc: jest.fn(), realtime: { setAuth: jest.fn() } };
  mockClient.mockReturnValue(client); const refresh = jest.fn().mockResolvedValue(undefined);
  const scope = { accountId, accountRevision: 1, sessionEpoch: 1, agreementId, refresh, isCurrent: () => true };
  const stop = subscribeAgreementInvalidations(scope); stops.push(stop);
  // Later caller mutation cannot retarget an existing subscription or its reread.
  scope.agreementId = otherId; scope.refresh = jest.fn().mockResolvedValue(undefined);
  expect(client.channel).toHaveBeenCalledTimes(1);
  expect(on.mock.calls.map(call => call.slice(0, 2))).toEqual([
    ['postgres_changes', { event: 'INSERT', schema: 'public', table: 'agreement_invalidations_v1', filter: 'agreement_id=eq.' + agreementId }],
    ['postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agreement_invalidations_v1', filter: 'agreement_id=eq.' + agreementId }],
    ['system', {}],
  ]);
  expect(subscribe.mock.calls[0][1]).toBe(15_000);
  on.mock.calls[0][2](event()); await flush(); expect(refresh).toHaveBeenCalledTimes(1);
  expect(scope.refresh).not.toHaveBeenCalled();
  expect(client.rpc).not.toHaveBeenCalled(); expect(client.realtime.setAuth).not.toHaveBeenCalled();
  mockActivity = 'background'; for (const listener of [...mockListeners]) listener(mockActivity);
  on.mock.calls[0][2](event(2)); await flush(); expect(refresh).toHaveBeenCalledTimes(1);
  expect(removeChannel).toHaveBeenCalledWith(channel); expect(mockListeners.size).toBe(0);
});
