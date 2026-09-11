import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useFocusedResource } from '../../hooks/useFocusedResource';

let mockSession = { user: { id: 'account-a' }, accountRevision: 1, sessionEpoch: 1 };
const mockRemove = jest.fn();
let mockAppState = 'active';
let mockStateListener: ((state: string) => void) | undefined;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return key === 'AppState' ? { get currentState() { return mockAppState; }, addEventListener: (_event: string, listener: (state: string) => void) => { mockStateListener = listener; return { remove: mockRemove }; } } : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => 'narucilac', ulogaSada: () => 'narucilac' }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function Probe({ load }: { load: () => Promise<string[]> }) {
  return React.createElement('Snapshot', useFocusedResource(load));
}
let tree: ReactTestRenderer;
const snapshot = () => tree.root.findByType('Snapshot' as React.ElementType).props;
beforeEach(() => {
  jest.clearAllMocks(); mockAppState = 'active'; mockStateListener = undefined;
  mockSession = { user: { id: 'account-a' }, accountRevision: 1, sessionEpoch: 1 };
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('focused hook account incarnation', () => {
  it.each(['success', 'failure'] as const)('rejects stale %s after batched A→B→A and starts a new owned read', async result => {
    const old = deferred<string[]>();
    const fresh = deferred<string[]>();
    const load = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    await act(async () => { tree = create(<Probe load={load} />); });
    mockSession = { user: { id: 'account-b' }, accountRevision: 2, sessionEpoch: 2 };
    mockSession = { user: { id: 'account-a' }, accountRevision: 3, sessionEpoch: 3 };
    await act(async () => {
      if (result === 'success') old.resolve(['old private data']);
      else old.reject(new Error('old offline failure'));
    });
    expect(snapshot()).toMatchObject({ data: null, error: false });
    await act(async () => tree.update(<Probe load={load} />));
    expect(load).toHaveBeenCalledTimes(2);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    await act(async () => fresh.resolve(['fresh private data']));
    expect(snapshot()).toMatchObject({ data: ['fresh private data'], error: false, loading: false });
  });

  it('retains its current read state and focus subscription during same-account token refresh', async () => {
    const load = jest.fn().mockResolvedValue(['current data']);
    await act(async () => { tree = create(<Probe load={load} />); });
    mockSession = { ...mockSession, sessionEpoch: 2 };
    await act(async () => tree.update(<Probe load={load} />));
    expect(snapshot()).toMatchObject({ data: ['current data'], loading: false });
    expect(load).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});


it('clears background data, ignores the in-flight result, and only reloads on foreground', async () => {
  const initial = deferred<string[]>(), resumed = deferred<string[]>();
  const load = jest.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(resumed.promise);
  await act(async () => { tree = create(<Probe load={load} />); });
  await act(async () => { mockAppState = 'background'; mockStateListener?.('background'); });
  await act(async () => initial.resolve(['late background data']));
  expect(snapshot()).toMatchObject({ data: null, loading: true });
  await act(async () => snapshot().refresh()); expect(load).toHaveBeenCalledTimes(1);
  await act(async () => { mockAppState = 'active'; mockStateListener?.('active'); });
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => resumed.resolve(['fresh foreground data']));
  expect(snapshot()).toMatchObject({ data: ['fresh foreground data'], loading: false });
  await act(async () => { mockAppState = 'inactive'; mockStateListener?.('inactive'); });
  expect(snapshot()).toMatchObject({ data: null, loading: true });
});

it('does not begin an initial read while the application is already backgrounded', async () => {
  mockAppState = 'background'; const load = jest.fn().mockResolvedValue(['fresh']);
  await act(async () => { tree = create(<Probe load={load} />); });
  expect(load).not.toHaveBeenCalled();
  await act(async () => { mockAppState = 'active'; mockStateListener?.('active'); });
  expect(load).toHaveBeenCalledTimes(1);
  expect(snapshot()).toMatchObject({ data: ['fresh'], loading: false });
});
