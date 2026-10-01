import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { OwnTasksPage, OwnTasksPageRequest } from '../ownTasksPage';
const mockNavigate = jest.fn();
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockFocused = true;
type Read = { request: OwnTasksPageRequest; resolve: (page: OwnTasksPage) => void; reject: (error: Error) => void };
let reads: Read[] = [];
const mockSource = { mojePotrebe: jest.fn(), mojePotrebeStrana: (request: OwnTasksPageRequest) => new Promise<OwnTasksPage>((resolve, reject) => { reads.push({ request, resolve, reject }); }) };
const mockListeners = new Set<(state: string) => void>();
const mockApp = { currentState: 'active', addEventListener: (_: string, fn: (state: string) => void) => { mockListeners.add(fn); return { remove: () => mockListeners.delete(fn) }; } };
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args), canGoBack: () => false, replace: jest.fn(), back: jest.fn() },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return key === 'AppState' ? mockApp : Reflect.get(target, key); } }); });
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected Supabase access in route test'); } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('../ownTasksPagedGate', () => ({ ownTasksPagedBuilt: () => true }));
jest.mock('../../ui/v2/MarketplacePresentation', () => ({ MarketplacePresentation: 'Marketplace' }));
import Owned from '../../app/(app)/potrebe';

/**
 * EX-04 S1 (A09): the route of "Moji zadaci" in a paged build. The set follows the section and "Treba moja radnja"; a search or the price filter reads
 * the rest of the set; nothing from another set, another account or another focus is ever shown or opened.
 */
const COUNTS = { total: 5, active: 3, waiting: 1, drafts: 1, history: 1 };
const task = (id: string) => ({ id, naslov: `Zadatak ${id}` });
const page = (ids: string[], hasMore: boolean, counts: typeof COUNTS | null = null): OwnTasksPage => ({
  items: ids.map(task) as any, hasMore, counts, asOf: '2026-10-01T08:00:00.000000+00:00', cursor: ids.length ? { at: `t-${ids[ids.length - 1]}`, id: ids[ids.length - 1] } : null });
let tree: ReactTestRenderer;
const props = () => tree.root.findByType('Marketplace' as React.ElementType).props;
const render = async () => act(async () => { tree = create(<Owned />); });
const answer = async (index: number, value: OwnTasksPage) => act(async () => { reads[index].resolve(value); });
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); reads = []; mockNavigate.mockReset(); mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockFocused = true; mockApp.currentState = 'active'; mockListeners.clear(); mockSource.mojePotrebe.mockReset(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('focus reads the first page of the active set and hands the presentation the tasks, the server counts and the paging', async () => {
  await render();
  expect(reads).toHaveLength(1); expect(reads[0].request).toEqual({ scope: 'ACTIVE', limit: 30, cursor: null });
  expect(props()).toMatchObject({ loading: true, error: false, items: [] }); expect(mockSource.mojePotrebe).not.toHaveBeenCalled();
  await answer(0, page(['a', 'b'], true, COUNTS));
  expect(props()).toMatchObject({ loading: false, error: false }); expect(props().items.map((item: any) => item.id)).toEqual(['a', 'b']);
  expect(props().paging).toMatchObject({ counts: COUNTS, hasMore: true, loadingMore: false, moreError: false });
});

test('the next page is read from the last task and appended; a failed one keeps the list and the same call retries it', async () => {
  await render(); await answer(0, page(['a'], true, COUNTS));
  await act(async () => props().paging.onLoadMore());
  expect(reads[1].request.cursor).toEqual({ at: 't-a', id: 'a' }); expect(props().paging.loadingMore).toBe(true);
  await act(async () => { reads[1].reject(new Error('OWN_TASKS_PAGE_UNAVAILABLE')); });
  expect(props().paging).toMatchObject({ moreError: true, loadingMore: false }); expect(props().items).toHaveLength(1); expect(props().error).toBe(false);
  await act(async () => props().paging.onLoadMore()); await answer(2, page(['b'], false));
  expect(props().items.map((item: any) => item.id)).toEqual(['a', 'b']); expect(props().paging.hasMore).toBe(false);
});

test('changing the set reads that set, and until it answers the screen is loading, never showing another set under its title', async () => {
  await render(); await answer(0, page(['a'], false, COUNTS));
  await act(async () => props().onView({ ...props().view, section: 'drafts' }));
  expect(reads[1].request.scope).toBe('DRAFTS');
  expect(props()).toMatchObject({ loading: true, items: [] });
  await answer(1, page(['d1'], false, COUNTS)); expect(props().items.map((item: any) => item.id)).toEqual(['d1']);
  await act(async () => props().onView({ ...props().view, section: 'history' })); await act(async () => props().onView({ ...props().view, section: 'all' }));
  expect(reads.map(read => read.request.scope)).toEqual(['ACTIVE', 'DRAFTS', 'HISTORY', 'ALL']);
});

test('"Treba moja radnja" reads the tasks that wait for my choice; on a draft or closed set it is empty by rule and reads nothing', async () => {
  await render(); await answer(0, page(['a'], false, COUNTS));
  await act(async () => props().onView({ ...props().view, attention: true })); expect(reads[1].request.scope).toBe('WAITING');
  await answer(1, page(['w'], false, COUNTS)); expect(props().items.map((item: any) => item.id)).toEqual(['w']);
  await act(async () => props().onView({ ...props().view, section: 'drafts' }));
  expect(reads).toHaveLength(2); expect(props()).toMatchObject({ loading: false, error: false, items: [] });
});

test('while a search or the price filter is on, the rest of the set is read without being asked; turning it off stops it', async () => {
  await render(); await answer(0, page(['a'], true, COUNTS));
  await act(async () => props().onView({ ...props().view, query: 'ormar' }));
  expect(reads).toHaveLength(2); await answer(1, page(['b'], true));
  expect(reads).toHaveLength(3); await act(async () => props().onView({ ...props().view, query: '' }));
  await answer(2, page(['c'], true)); expect(reads).toHaveLength(3);
  expect(props().items.map((item: any) => item.id)).toEqual(['a', 'b', 'c']);
  await act(async () => props().onView({ ...props().view, price: 'OFFERS' })); expect(reads).toHaveLength(4);
});

test('a task opens only from the latest read, once per visit; a stale card or a card while loading opens nothing', async () => {
  await render(); const loadingItem = { id: 'a' } as any;
  await act(async () => props().onOpen(loadingItem)); expect(mockNavigate).not.toHaveBeenCalled();
  await answer(0, page(['a', 'b'], false, COUNTS));
  await act(async () => { props().onOpen({ id: 'ghost' }); }); expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => { props().onOpen(loadingItem); props().onOpen(loadingItem); });
  expect(mockNavigate).toHaveBeenCalledTimes(1); expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: 'a' } });
});

test('a pull to refresh reads the first page again while the set stays on screen', async () => {
  await render(); await answer(0, page(['a'], true, COUNTS));
  await act(async () => props().onRefresh());
  expect(reads[1].request).toEqual({ scope: 'ACTIVE', limit: 30, cursor: null }); expect(props()).toMatchObject({ refreshing: true, loading: false }); expect(props().items).toHaveLength(1);
});

test('another account is another screen: what the first account was reading is never shown to the second, and a late answer changes nothing', async () => {
  await render();
  mockSession = { user: { id: 'account-b' }, accountRevision: 1 };
  await act(async () => tree.update(<Owned />));
  expect(reads).toHaveLength(2); expect(props()).toMatchObject({ loading: true, items: [] });
  await answer(0, page(['secret-of-a'], false, COUNTS));
  expect(props().items).toEqual([]);
  await answer(1, page(['b1'], false, COUNTS)); expect(props().items.map((item: any) => item.id)).toEqual(['b1']);
});

test('the app leaving the foreground forgets what was read; coming back reads it again from nothing', async () => {
  await render(); await answer(0, page(['a'], false, COUNTS));
  await act(async () => { mockApp.currentState = 'background'; mockListeners.forEach(listener => listener('background')); });
  expect(props()).toMatchObject({ items: [] }); expect(props().paging.counts).toBeNull();
  await act(async () => { mockApp.currentState = 'active'; mockListeners.forEach(listener => listener('active')); });
  expect(reads).toHaveLength(2); expect(props().loading).toBe(true);
});
