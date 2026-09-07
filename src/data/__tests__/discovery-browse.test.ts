import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PrilikeCursor, PrilikeStrana } from '../../contracts/discovery';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { createDiscoveryBrowse } from '../discoveryBrowse';

let mockSession: { user: { id: string } | null; accountRevision: number; sessionEpoch: number };
let mockIntent = 'uskocer';
let mockFocused = true;
let mockSource: { otvorenePrilikeStrana: jest.Mock };
const mockHandlers = new Set<(state: string) => void>();
const mockRemove = jest.fn();
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, { get(target, key) {
    return key === 'AppState' ? { addEventListener: (_event: string, handler: (state: string) => void) => {
      mockHandlers.add(handler);
      return { remove: () => { mockRemove(); mockHandlers.delete(handler); } };
    } } : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => (() => void) | void) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
import { useDiscoveryBrowse } from '../../hooks/useDiscoveryBrowse';

const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cursor = (n: number): PrilikeCursor => ({ createdAt: '2026-09-07T10:00:00.123456+00:00', id: uuid(n) });
function item(n: number, title = `Zadatak ${n}`): PrilikaProjekcija {
  return { id: uuid(n), naslov: title, statusTekst: 'Traži ponude', podrucjeTekst: 'Centar', vremeTekst: 'Fleksibilno',
    pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [],
    narucilacProfilId: uuid(200), narucilacIme: '', narucilacOcena: null, priblizno: null };
}
const page = (items: PrilikaProjekcija[], nextCursor: PrilikeCursor | null = null): PrilikeStrana => ({ items, nextCursor });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function settle() { for (let n = 0; n < 12; n++) await Promise.resolve(); }

describe('actual discovery page-window model', () => {
  const models: Array<ReturnType<typeof createDiscoveryBrowse>> = [];
  function model(load: jest.Mock, isCurrent = () => true) {
    const result = createDiscoveryBrowse(load, isCurrent); models.push(result); return result;
  }
  afterEach(() => { models.splice(0).forEach(value => value.stop()); jest.useRealTimers(); });

  it('captures initial/more double taps synchronously and retains one in-flight request', async () => {
    const first = deferred<PrilikeStrana>(), second = deferred<PrilikeStrana>();
    const load = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const browse = model(load);
    browse.start(); browse.start(); void browse.refresh(); void browse.loadMore();
    expect(browse.snapshot()).toMatchObject({ refreshing: true, loadingMore: false });
    await settle(); expect(load).toHaveBeenCalledTimes(1);
    first.resolve(page([item(1)], cursor(90))); await settle();
    const more = browse.loadMore(); void browse.loadMore(); void browse.refresh();
    await settle(); expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[1][0]).toMatchObject({ cursor: cursor(90), limit: 30 });
    second.resolve(page([item(2)])); await more;
    expect(browse.snapshot()).toMatchObject({ initialized: true, refreshing: false, loadingMore: false, error: null });
    expect(browse.snapshot().items.map(value => value.id)).toEqual([uuid(1), uuid(2)]);
  });

  it('keeps initial failure distinct from an empty read and recovers through refresh', async () => {
    const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([]));
    const browse = model(load); browse.start(); await settle();
    expect(browse.snapshot()).toMatchObject({ items: [], initialized: false, error: 'refresh', refreshing: false });
    await browse.refresh();
    expect(browse.snapshot()).toMatchObject({ items: [], initialized: true, error: null });
  });

  it('preserves the loaded window on more failure and retries exactly that cursor with a fresh signal', async () => {
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([item(2)]));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore();
    expect(browse.snapshot()).toMatchObject({ items: [item(1)], nextCursor: cursor(90), error: 'more', loadingMore: false });
    await browse.loadMore();
    expect(load.mock.calls[1][0].cursor).toEqual(load.mock.calls[2][0].cursor);
    expect(load.mock.calls[1][0].signal).not.toBe(load.mock.calls[2][0].signal);
    expect(browse.snapshot()).toMatchObject({ items: [item(1), item(2)], nextCursor: null, error: null });
  });

  it('rebuilds the same loaded page window atomically on Back/focus and uses fresh cursors', async () => {
    const head = deferred<PrilikeStrana>(), tail = deferred<PrilikeStrana>();
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(2)], cursor(80)))
      .mockReturnValueOnce(head.promise).mockReturnValueOnce(tail.promise);
    const browse = model(load); browse.start(); await settle(); await browse.loadMore();
    browse.stop(); browse.start(); await settle();
    expect(browse.snapshot()).toMatchObject({ items: [item(1), item(2)], refreshing: true });
    expect(load.mock.calls[2][0].cursor).toBeUndefined();
    head.resolve(page([item(3)], cursor(95))); await settle();
    expect(load.mock.calls[3][0].cursor).toEqual(cursor(95));
    expect(browse.snapshot().items).toEqual([item(1), item(2)]);
    tail.resolve(page([item(4)], cursor(85))); await settle();
    expect(browse.snapshot()).toMatchObject({ items: [item(3), item(4)], nextCursor: cursor(85), refreshing: false });
  });

  it('keeps the prior complete window if its refresh fails halfway and retries from the head', async () => {
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(2)], cursor(80)))
      .mockResolvedValueOnce(page([item(3)], cursor(95))).mockRejectedValueOnce(new Error('tail offline'))
      .mockResolvedValueOnce(page([item(4)], cursor(94))).mockResolvedValueOnce(page([item(5)]));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore(); await browse.refresh();
    expect(browse.snapshot()).toMatchObject({ items: [item(1), item(2)], nextCursor: cursor(80), error: 'refresh' });
    await browse.refresh();
    expect(load.mock.calls[4][0].cursor).toBeUndefined();
    expect(browse.snapshot().items).toEqual([item(4), item(5)]);
  });

  it.each(['success', 'failure'] as const)('ignores a late noncooperating %s after blur and re-entry', async outcome => {
    const old = deferred<PrilikeStrana>(), fresh = deferred<PrilikeStrana>();
    const load = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const browse = model(load); browse.start(); await settle();
    browse.stop(); expect(load.mock.calls[0][0].signal.aborted).toBe(true);
    browse.start(); await settle(); fresh.resolve(page([item(2)])); await settle();
    if (outcome === 'success') old.resolve(page([item(1)])); else old.reject(new Error('old failure'));
    await settle();
    expect(browse.snapshot()).toMatchObject({ items: [item(2)], initialized: true, error: null, refreshing: false });
  });

  it('rejects a completion when the current actor changes before any component rerender', async () => {
    let current = true;
    const pending = deferred<PrilikeStrana>();
    const browse = model(jest.fn().mockReturnValue(pending.promise), () => current);
    browse.start(); await settle(); current = false; pending.resolve(page([item(1)])); await settle();
    expect(browse.snapshot().items).toEqual([]);
    expect(browse.snapshot().initialized).toBe(false);
  });

  it('times out a hung read, aborts its signal and allows retry while the old transport remains unresolved', async () => {
    jest.useFakeTimers();
    const old = deferred<PrilikeStrana>();
    const load = jest.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([item(2)]));
    const browse = model(load); browse.start(); await settle();
    await jest.advanceTimersByTimeAsync(20000);
    expect(load.mock.calls[0][0].signal.aborted).toBe(true);
    expect(browse.snapshot()).toMatchObject({ refreshing: false, error: 'refresh', initialized: false });
    await browse.refresh();
    old.resolve(page([item(1)])); await settle();
    expect(browse.snapshot()).toMatchObject({ items: [item(2)], error: null });
  });

  it('uses one 20s budget for a multi-page Back refresh, preserves the complete old window and rearms retry', async () => {
    jest.useFakeTimers();
    const head = deferred<PrilikeStrana>(), tail = deferred<PrilikeStrana>(), retryHead = deferred<PrilikeStrana>();
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(2)], cursor(80))).mockReturnValueOnce(head.promise)
      .mockReturnValueOnce(tail.promise).mockReturnValueOnce(retryHead.promise).mockResolvedValueOnce(page([item(5)]));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore();
    const refresh = browse.refresh(); await settle();
    await jest.advanceTimersByTimeAsync(15000);
    head.resolve(page([item(3)], cursor(95))); await settle();
    expect(load).toHaveBeenCalledTimes(4);
    expect(load.mock.calls[2][0].signal).toBe(load.mock.calls[3][0].signal);
    await jest.advanceTimersByTimeAsync(4999);
    expect(browse.snapshot()).toMatchObject({ items: [item(1), item(2)], refreshing: true });
    await jest.advanceTimersByTimeAsync(1); await refresh;
    expect(load.mock.calls[3][0].signal.aborted).toBe(true);
    expect(browse.snapshot()).toMatchObject({ items: [item(1), item(2)], nextCursor: cursor(80), refreshing: false, error: 'refresh' });
    const retry = browse.refresh(); await settle();
    await jest.advanceTimersByTimeAsync(15000);
    expect(browse.snapshot().refreshing).toBe(true);
    retryHead.resolve(page([item(4)], cursor(94))); await retry;
    tail.resolve(page([item(99)])); await settle();
    expect(browse.snapshot()).toMatchObject({ items: [item(4), item(5)], refreshing: false, error: null });
  });

  it('gives load-more its own 20s budget and leaves the same cursor available for manual retry', async () => {
    jest.useFakeTimers();
    const hung = deferred<PrilikeStrana>();
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockReturnValueOnce(hung.promise).mockResolvedValueOnce(page([item(2)]));
    const browse = model(load); browse.start(); await settle();
    const more = browse.loadMore(); await settle(); await jest.advanceTimersByTimeAsync(20000); await more;
    expect(browse.snapshot()).toMatchObject({ items: [item(1)], nextCursor: cursor(90), loadingMore: false, error: 'more' });
    expect(load.mock.calls[1][0].signal.aborted).toBe(true);
    await browse.loadMore(); hung.resolve(page([item(99)])); await settle();
    expect(load.mock.calls[2][0].cursor).toEqual(cursor(90));
    expect(browse.snapshot()).toMatchObject({ items: [item(1), item(2)], error: null });
  });

  it('deduplicates repeated item IDs across pages while preserving the shared list/map item order', async () => {
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(1, 'Osvežen naslov'), item(2)]));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore();
    expect(browse.snapshot().items).toEqual([item(1, 'Osvežen naslov'), item(2)]);
  });

  it('refuses the same next cursor without changing the committed window', async () => {
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(2)], cursor(90)));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore();
    expect(browse.snapshot()).toMatchObject({ items: [item(1)], nextCursor: cursor(90), error: 'more' });
  });

  it('refuses a cursor cycle across separate load-more calls', async () => {
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(2)], cursor(80))).mockResolvedValueOnce(page([item(1)], cursor(90)));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore(); await browse.loadMore();
    expect(browse.snapshot()).toMatchObject({ items: [item(1), item(2)], nextCursor: cursor(80), error: 'more' });
  });

  it('refuses a different cursor that moves toward newer rows instead of advancing', async () => {
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(2)], cursor(95)));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore();
    expect(browse.snapshot()).toMatchObject({ items: [item(1)], nextCursor: cursor(90), error: 'more' });
  });

  it('accepts a genuinely older microsecond even when its UUID is larger', async () => {
    const older = { ...cursor(95), createdAt: '2026-09-07T10:00:00.123455+00:00' };
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(2)], older));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore();
    expect(browse.snapshot()).toMatchObject({ items: [item(1), item(2)], nextCursor: older, error: null });
  });

  it('recognizes equal instants with different timezone offsets before comparing UUID progress', async () => {
    const sameInstantNewerId = { ...cursor(95), createdAt: '2026-09-07T12:00:00.123456+02:00' };
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(2)], sameInstantNewerId));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore();
    expect(browse.snapshot()).toMatchObject({ items: [item(1)], nextCursor: cursor(90), error: 'more' });
  });

  it.each([
    { createdAt: 'not-a-date', id: uuid(80) },
    { createdAt: '2026-02-30T10:00:00Z', id: uuid(80) },
    { createdAt: '2026-09-07T24:00:00Z', id: uuid(80) },
    { createdAt: '2026-09-07T10:00:00+25:00', id: uuid(80) },
    { createdAt: '2026-09-07T10:00:00.1234567Z', id: uuid(80) },
    { createdAt: `${cursor(80).createdAt}\n`, id: uuid(80) },
    { createdAt: cursor(80).createdAt, id: `${uuid(80)}\n` },
    { createdAt: cursor(80).createdAt, id: 'not-a-uuid' },
  ])('rejects invalid initial cursor material without committing its page: %j', async invalid => {
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], invalid)).mockResolvedValueOnce(page([item(2)]));
    const browse = model(load); browse.start(); await settle();
    expect(browse.snapshot()).toMatchObject({ items: [], initialized: false, nextCursor: null, error: 'refresh' });
    await browse.refresh();
    expect(browse.snapshot()).toMatchObject({ items: [item(2)], initialized: true, error: null });
  });

  it('compares UUIDs in canonical lowercase and rejects case-only fake progression', async () => {
    const lowercase = { ...cursor(90), id: '10000000-0000-4000-8000-0000000000af' };
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], { ...lowercase, id: lowercase.id.toUpperCase() }))
      .mockResolvedValueOnce(page([item(2)], lowercase));
    const browse = model(load); browse.start(); await settle();
    expect(browse.snapshot().nextCursor).toEqual(lowercase);
    await browse.loadMore();
    expect(load.mock.calls[1][0].cursor).toEqual(lowercase);
    expect(browse.snapshot()).toMatchObject({ items: [item(1)], nextCursor: lowercase, error: 'more' });
  });

  it('treats padded fractional spellings as the same instant and uses only the UUID tie-break', async () => {
    const first = { ...cursor(90), createdAt: '2026-09-07T10:00:00.1Z' };
    const olderId = { ...cursor(80), createdAt: '2026-09-07T12:00:00.100000+02:00' };
    const load = jest.fn().mockResolvedValueOnce(page([item(1)], first)).mockResolvedValueOnce(page([item(2)], olderId));
    const browse = model(load); browse.start(); await settle(); await browse.loadMore();
    expect(browse.snapshot()).toMatchObject({ items: [item(1), item(2)], nextCursor: olderId, error: null });
  });
});

describe('actual useDiscoveryBrowse ownership and lifecycle', () => {
  let tree: ReactTestRenderer | undefined;
  let current: ReturnType<typeof useDiscoveryBrowse>;
  function Probe() { current = useDiscoveryBrowse(); return null; }
  beforeEach(() => {
    mockFocused = true; mockIntent = 'uskocer'; mockHandlers.clear(); mockRemove.mockClear();
    mockSession = { user: { id: 'account-a' }, accountRevision: 1, sessionEpoch: 1 };
    mockSource = { otvorenePrilikeStrana: jest.fn() };
  });
  afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

  it.each(['success', 'failure'] as const)('rejects old %s through batched A→B→A and exposes only the new incarnation', async outcome => {
    const old = deferred<PrilikeStrana>(), fresh = deferred<PrilikeStrana>();
    mockSource.otvorenePrilikeStrana.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    await act(async () => { tree = create(React.createElement(Probe)); });
    mockSession = { user: { id: 'account-b' }, accountRevision: 2, sessionEpoch: 2 };
    mockSession = { user: { id: 'account-a' }, accountRevision: 3, sessionEpoch: 3 };
    await act(async () => { if (outcome === 'success') old.resolve(page([item(1)])); else old.reject(new Error('stale')); });
    expect(current!.items).toEqual([]);
    await act(async () => tree!.update(React.createElement(Probe)));
    expect(current!.scope).toBe('account-a:3:uskocer');
    expect(mockSource.otvorenePrilikeStrana).toHaveBeenCalledTimes(2);
    await act(async () => fresh.resolve(page([item(2)])));
    expect(current!.items).toEqual([item(2)]);
  });

  it('clears old-account and old-intent windows and does not read for a guest', async () => {
    mockSource.otvorenePrilikeStrana.mockResolvedValueOnce(page([item(1)])).mockResolvedValueOnce(page([item(2)]));
    await act(async () => { tree = create(React.createElement(Probe)); });
    expect(current!.items).toEqual([item(1)]);
    mockSession = { user: { id: 'account-b' }, accountRevision: 2, sessionEpoch: 2 };
    mockIntent = 'narucilac';
    await act(async () => tree!.update(React.createElement(Probe)));
    expect(current!.scope).toBe('account-b:2:narucilac');
    expect(current!.items).toEqual([item(2)]);
    mockSession = { user: null, accountRevision: 3, sessionEpoch: 3 };
    await act(async () => tree!.update(React.createElement(Probe)));
    expect(current!.items).toEqual([]);
    expect(mockSource.otvorenePrilikeStrana).toHaveBeenCalledTimes(2);
  });

  it('refreshes on foreground and Back, removes blurred subscriptions and keeps same-account token refresh stable', async () => {
    mockSource.otvorenePrilikeStrana.mockResolvedValueOnce(page([item(1)], cursor(90)))
      .mockResolvedValueOnce(page([item(2)])).mockResolvedValueOnce(page([item(3)], cursor(95)))
      .mockResolvedValueOnce(page([item(4)])).mockResolvedValueOnce(page([item(5)]));
    await act(async () => { tree = create(React.createElement(Probe)); });
    await act(async () => current!.loadMore());
    mockSession = { ...mockSession, sessionEpoch: 2 };
    await act(async () => tree!.update(React.createElement(Probe)));
    expect(mockSource.otvorenePrilikeStrana).toHaveBeenCalledTimes(2);
    mockFocused = false;
    await act(async () => tree!.update(React.createElement(Probe)));
    expect(mockHandlers.size).toBe(0);
    mockFocused = true;
    await act(async () => tree!.update(React.createElement(Probe)));
    expect(current!.items).toEqual([item(3), item(4)]);
    expect(mockSource.otvorenePrilikeStrana).toHaveBeenCalledTimes(4);
    await act(async () => { mockHandlers.forEach(handler => handler('active')); });
    expect(current!.items).toEqual([item(5)]);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
