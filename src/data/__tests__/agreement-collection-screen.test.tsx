import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockRead = jest.fn(), mockNavigate = jest.fn();
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
const mockSource = { mojiDogovori: () => mockRead() };
const mockListeners = new Set<(state: string) => void>();
const mockApp = { currentState: 'active', addEventListener: (_: string, fn: (state: string) => void) => {
  mockListeners.add(fn); return { remove: () => mockListeners.delete(fn) };
} };
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, {
  get(target, key) { return key === 'AppState' ? mockApp : Reflect.get(target, key); },
}); });
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../ui/v2/AgreementCollectionPresentation', () => ({ AgreementCollectionPresentation: 'Agreements' }));
import Screen from '../../app/(app)/dogovori';
let tree: ReactTestRenderer;
const props = () => tree.root.findByType('Agreements' as React.ElementType).props;
const render = async () => act(async () => { tree = create(<Screen />); });
const update = async () => act(async () => tree.update(<Screen />));
const deferred = () => { let resolve!: (rows: any[]) => void; const promise = new Promise<any[]>(done => { resolve = done; }); return { resolve, promise }; };
beforeEach(() => {
  jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {});
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockApp.currentState = 'active';
  mockRead.mockReset().mockImplementation(async () => [{ id: 'owned', verzija: 1 }]); mockNavigate.mockReset();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test('uses the existing owned read and opens the actual Agreement once', async () => {
  await render(); const shown = props(); await act(async () => { shown.onOpen(shown.items[0]); shown.onOpen(shown.items[0]); });
  expect(mockRead).toHaveBeenCalledTimes(1); expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'owned' } });
});
test('account ABA drops late private rows, old navigation and old filters', async () => {
  const late = deferred(); mockRead.mockReturnValueOnce(late.promise); await render(); const old = props();
  await act(async () => { old.onSection('history'); old.onConfirmationOnly(true); });
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await update();
  mockSession = { user: { id: 'account-a' }, accountRevision: 3 }; await update();
  await act(async () => { late.resolve([{ id: 'retired-private' }]); old.onCalendar(); old.onSection('all'); });
  expect(props().items).toEqual([{ id: 'owned', verzija: 1 }]); expect(props().section).toBe('active');
  expect(props().confirmationOnly).toBe(false); expect(mockNavigate).not.toHaveBeenCalled();
});
test('refresh rejects a retained card even when the same Agreement ID returns at a new version', async () => {
  await render(); const old = props(); mockRead.mockResolvedValueOnce([{ id: 'owned', verzija: 2 }]);
  await act(async () => props().onRefresh()); await act(async () => old.onOpen(old.items[0]));
  expect(mockNavigate).not.toHaveBeenCalled(); await act(async () => props().onOpen(props().items[0]));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});
test('refresh and retained card press in the same React batch cannot navigate', async () => {
  await render(); const old = props();
  await act(async () => { old.onRefresh(); old.onOpen(old.items[0]); });
  expect(mockNavigate).not.toHaveBeenCalled();
});
test('blur rejects actions and returning focus rereads and clears the navigation latch', async () => {
  await render(); const old = props(); await act(async () => old.onCalendar()); mockNavigate.mockClear();
  mockFocused = false; await update(); await act(async () => { old.onProfile(); old.onRefresh(); });
  expect(mockRead).toHaveBeenCalledTimes(1); mockFocused = true; await update();
  await act(async () => { old.onOpen(old.items[0]); props().onOpen(props().items[0]); });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(mockNavigate).toHaveBeenCalledTimes(1);
});
test('background and an unfinished foreground refresh reject old actions', async () => {
  await render(); const old = props(); mockApp.currentState = 'background';
  await act(async () => { mockListeners.forEach(listener => listener('background')); old.onTasks(); });
  expect(tree.root.findAllByType('Agreements' as React.ElementType)).toHaveLength(0);
  expect(mockNavigate).not.toHaveBeenCalled(); const pending = deferred(); mockRead.mockReturnValueOnce(pending.promise);
  mockApp.currentState = 'active'; await act(async () => mockListeners.forEach(listener => listener('active')));
  expect(props().items).toEqual([]); await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).not.toHaveBeenCalled();
});
test('batched background and foreground retire the old read even with the same account', async () => {
  const late = deferred(); mockRead.mockReturnValueOnce(late.promise); await render(); const old = props();
  await act(async () => {
    mockApp.currentState = 'background'; mockListeners.forEach(listener => listener('background'));
    mockApp.currentState = 'active'; mockListeners.forEach(listener => listener('active'));
    old.onCalendar();
  });
  await act(async () => late.resolve([{ id: 'old-private' }]));
  expect(props().items).toEqual([{ id: 'owned', verzija: 1 }]); expect(mockNavigate).not.toHaveBeenCalled();
});
test('bounded read rejects a late result; explicit retry recovers without exposing raw errors', async () => {
  const late = deferred(); mockRead.mockReturnValueOnce(late.promise); await render();
  await act(async () => jest.advanceTimersByTime(15_001)); expect(props().loading).toBe(false); expect(props().error).toBe(true);
  await act(async () => late.resolve([{ id: 'late-private' }])); expect(props().items).toEqual([]);
  await act(async () => props().onRefresh()); expect(props().error).toBe(false); expect(props().items[0].id).toBe('owned');
});
test('intent change resets filters while retaining actual owned-read authority', async () => {
  await render(); const old = props(); await act(async () => old.onSection('history')); mockIntent = 'uskocer'; await update();
  expect(props().section).toBe('active'); expect(props().requester).toBe(false);
  await act(async () => old.onTasks()); expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => props().onTasks()); expect(mockNavigate).toHaveBeenCalledWith('/prilike');
});
