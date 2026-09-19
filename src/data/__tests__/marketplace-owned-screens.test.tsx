import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockMine = jest.fn(), mockPublic = jest.fn(), mockApplied = jest.fn(), mockNavigate = jest.fn();
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
const mockSource = { mojePotrebe: (...args: unknown[]) => mockMine(...args), otvorenePrilike: (...args: unknown[]) => mockPublic(...args),
  mojePrijave: (...args: unknown[]) => mockApplied(...args) };
const mockListeners = new Set<(state: string) => void>();
const mockApp = { currentState: 'active', addEventListener: (_: string, fn: (state: string) => void) => { mockListeners.add(fn); return { remove: () => mockListeners.delete(fn) }; } };
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) }, useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return key === 'AppState' ? mockApp : Reflect.get(target, key); } }); });
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent, postaviUlogu: jest.fn() }));
jest.mock('../../ui/v2/MarketplacePresentation', () => ({ MarketplacePresentation: 'Marketplace' }));
import Owned from '../../app/(app)/potrebe';
import Public from '../../app/(app)/prilike';
import SharedMap from '../../app/(app)/mapa';
const deferred = () => { let resolve!: (rows: any[]) => void; const promise = new Promise<any[]>(done => { resolve = done; }); return { promise, resolve }; };
let tree: ReactTestRenderer, Component: typeof Owned;
const props = () => tree.root.findByType('Marketplace' as React.ElementType).props;
const render = async () => act(async () => { tree = create(<Component />); });
const update = async () => act(async () => tree.update(<Component />));
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {}); Component = Public; mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockApp.currentState = 'active'; mockMine.mockReset().mockResolvedValue([{ id: 'mine' }]); mockPublic.mockReset().mockResolvedValue([{ id: 'public' }]); mockApplied.mockReset().mockResolvedValue([]); mockNavigate.mockReset(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
test.each(['owned', 'public'])('%s uses its existing source read and actual detail route; rapid second tap navigates once', async kind => {
 Component = kind === 'owned' ? Owned : Public; await render(); const item = props().items[0]; await act(async () => { props().onOpen(item); props().onOpen(item); });
 expect(mockNavigate).toHaveBeenCalledTimes(1); expect(mockNavigate).toHaveBeenCalledWith({ pathname: kind === 'owned' ? '/potrebe/[id]/pregled' : '/prilike/[id]', params: { id: item.id } });
 expect(kind === 'owned' ? mockMine : mockPublic).toHaveBeenCalledTimes(1);
});
test('account ABA clears filters and rejects retired data/callbacks even with same account ID', async () => {
 const late = deferred(); mockPublic.mockReturnValueOnce(late.promise); await render(); const old = props(); await act(async () => old.onView({ ...old.view, query: 'old', mode: 'map' }));
 mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; await update(); mockSession = { user: { id: 'account-a' }, accountRevision: 3 }; await update();
 await act(async () => { late.resolve([{ id: 'old' }]); old.onView({ ...old.view, query: 'late' }); old.onOpen({ id: 'old' }); });
 expect(props().items).toEqual([{ id: 'public' }]); expect(props().view.query).toBe(''); expect(props().view.mode).toBe('list'); expect(mockNavigate).not.toHaveBeenCalled();
});
test('blur rejects actions and returning focus rereads/reset navigation; old callback remains invalid', async () => {
 await render(); const old = props(); mockFocused = false; await update(); await act(async () => { old.onOpen(old.items[0]); old.onView({ ...old.view, query: 'blurred' }); }); expect(mockNavigate).not.toHaveBeenCalled();
 mockFocused = true; await update(); await act(async () => { old.onOpen(old.items[0]); props().onOpen(props().items[0]); }); expect(mockNavigate).toHaveBeenCalledTimes(1); expect(mockPublic).toHaveBeenCalledTimes(2);
});
test('background actions and stale pre-refresh card cannot navigate; foreground read recovers', async () => {
 await render(); const old = props(); mockApp.currentState = 'background'; await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).not.toHaveBeenCalled();
 const pending = deferred(); mockPublic.mockReturnValueOnce(pending.promise); mockApp.currentState = 'active'; await act(async () => { mockListeners.forEach(listener => listener('active')); }); expect(props().loading).toBe(true);
 await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).not.toHaveBeenCalled(); await act(async () => pending.resolve([{ id: 'new' }])); await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).not.toHaveBeenCalled();
});
test('hung source fails at bounded deadline; late completion is ignored and explicit retry succeeds', async () => {
 const pending = deferred(); mockPublic.mockReturnValueOnce(pending.promise); await render(); await act(async () => jest.advanceTimersByTime(15_001)); expect(props().error).toBe(true); expect(props().items).toEqual([]);
 await act(async () => pending.resolve([{ id: 'late' }])); expect(props().error).toBe(true); expect(props().items).toEqual([]);
 await act(async () => props().onRefresh()); expect(props().error).toBe(false); expect(props().items).toEqual([{ id: 'public' }]);
});
// Owner decision 1 (2026-09-19). A switch of the app's mode used to empty the search, reset the map
// and retire every callback here. There is no mode now, so opening something from "the other side"
// and coming back finds the screen exactly as it was left.
test('a flip of the retired app mode resets nothing: the search stays, the new-task entry stays, and callbacks still work', async () => {
 await render(); const old = props(); await act(async () => old.onView({ ...old.view, query: 'kept query' })); mockIntent = 'uskocer'; await update();
 expect(props().view.query).toBe('kept query'); expect(typeof props().onNew).toBe('function');
 await act(async () => old.onOpen(old.items[0])); expect(mockNavigate).toHaveBeenCalledTimes(1);
});
test('discovery labels my own task and the one I applied to from my own account-scoped reads, and a failed read labels nothing', async () => {
 mockPublic.mockResolvedValue([{ id: 'mine' }, { id: 'applied' }, { id: 'other' }]);
 mockMine.mockResolvedValue([{ id: 'mine' }]); mockApplied.mockResolvedValue([{ prijavaId: 'a1', potrebaId: 'applied', stanje: 'SUBMITTED' }, { prijavaId: 'a2', potrebaId: 'other', stanje: 'WITHDRAWN' }]);
 await render();
 expect([...props().relations.owned]).toEqual(['mine']); expect([...props().relations.applied]).toEqual(['applied']);
 await act(async () => tree.unmount());
 mockMine.mockRejectedValue(new Error('READ_FAILED')); mockApplied.mockRejectedValue(new Error('READ_FAILED')); await render();
 expect(props().items).toHaveLength(3); expect(props().relations.owned.size).toBe(0); expect(props().relations.applied.size).toBe(0);
});
test.each(['narucilac', 'uskocer'])('central map opens actual public pins whatever the app last was (%s) and retains its camera across detail focus', async intent => {
 Component = SharedMap; mockIntent = intent; await render();
 expect(props().view.mode).toBe('map'); expect(mockPublic).toHaveBeenCalledTimes(1);
 const viewport = { center: [19.83, 45.25], zoom: 13, bounds: [19, 45, 20, 46] };
 await act(async () => props().onView({ ...props().view, viewport, selectedId: 'public' }));
 mockFocused = false; await update(); mockFocused = true; await update();
 expect(props().view.viewport).toEqual(viewport); expect(props().view.selectedId).toBe('public');
 await act(async () => props().onOpen(props().items[0]));
 expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/prilike/[id]', params: { id: 'public' } });
});
