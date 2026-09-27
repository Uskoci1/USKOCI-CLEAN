import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const NEED = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const mockSource = { otvorenePrilike: jest.fn(), odnosiPremaZadacima: jest.fn() };
let mockFocused = true;
let mockParams: Record<string, unknown> = { publishedNeedId: NEED, publishedRevision: '1' };
let mockHookCall = 0;
let mockRows: Record<string, unknown>[] = [];
const mockPending: (() => void)[] = [];
const mockRefresh = jest.fn(() => new Promise<void>(resolve => { mockPending.push(resolve); }));
const mockRelationsRefresh = jest.fn(async () => {});
const mockRouter = { navigate: jest.fn(), replace: jest.fn() };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
const mockAppListeners = new Set<(state: string) => void>();
const mockAppState = { currentState: 'active', addEventListener: (_: string, listener: (state: string) => void) => {
  mockAppListeners.add(listener); return { remove: () => mockAppListeners.delete(listener) };
} };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'AppState' ? mockAppState : Reflect.get(target, key) });
});

jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockRouter.navigate(...args), replace: (...args: unknown[]) => mockRouter.replace(...args) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => (() => void) | void) => {
    const React = require('react');
    React.useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]);
  },
}));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.dev' } } }));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: ACCOUNT }, accountRevision: 1 }),
  sesijaSada: () => ({ user: { id: ACCOUNT }, accountRevision: 1 }),
}));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => {
  mockHookCall++;
  return mockHookCall % 2 ? { data: mockRows, loading: false, refreshing: false, error: false, refresh: mockRefresh }
    : { data: null, loading: false, refreshing: false, error: false, refresh: mockRelationsRefresh };
} }));
jest.mock('../../ui/v2/DiscoveryPresentation', () => ({ DiscoveryPresentation: 'Discovery' }));

import Zadaci from '../../app/(app)/zadaci';
import { rememberPublication } from '../publicationHandoff';
import type { AiTaskPublicationCommand, AiTaskReviewEnvelope } from '../aiTaskReviewClientService';

function publishedParams() {
  const reviewId = '33333333-3333-4333-8333-333333333333';
  const handoff = rememberPublication({
    review: { accountId: ACCOUNT, reviewId } as AiTaskReviewEnvelope,
    command: { authoritative: true, state: 'PUBLISHED', reviewId, needId: NEED, needRevision: 1 } as AiTaskPublicationCommand,
    publishedReadback: true,
  }, { accountId: ACCOUNT, accountRevision: 1 });
  if (!handoff) throw new Error('Expected an owned publication handoff');
  return { publishedNeedId: NEED, publishedRevision: '1', publishedHandoff: handoff.token };
}

let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Zadaci />); });
const update = async () => act(async () => tree.update(<Zadaci />));
const discovery = () => tree.root.findByType('Discovery' as React.ElementType).props;
const finishRead = async () => act(async () => { mockPending.shift()!(); await Promise.resolve(); });
beforeEach(() => {
  mockAppState.currentState = 'active'; mockAppListeners.clear();
  mockFocused = true; mockParams = publishedParams();
  mockHookCall = 0; mockRows = []; mockPending.length = 0;
  mockRefresh.mockClear(); mockRelationsRefresh.mockClear(); mockRouter.navigate.mockClear(); mockRouter.replace.mockClear();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('a publication read retired by blur is retried on fresh focus, then selects only the public point', async () => {
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await render(); expect(mockRefresh).toHaveBeenCalledTimes(1);
  mockFocused = false; await update();
  await finishRead(); expect(discovery().publicationFocus).toBeUndefined();
  mockFocused = true; await update(); expect(mockRefresh).toHaveBeenCalledTimes(2);
  await finishRead();
  expect(discovery().publicationFocus).toMatchObject({ id: NEED, kind: 'map' });
  expect(discovery().view).toMatchObject({ selectedId: NEED, sheet: 'peek', area: null, query: '' });
});

test('missing public row remains honest and a later explicit refresh can reveal its list card', async () => {
  await render(); await finishRead();
  expect(discovery().publicationUnavailable).toBe('missing');
  expect(discovery().publicationFocus).toBeUndefined();
  mockRows = [{ id: NEED, priblizno: null, detalji: { rezimLokacije: 'REMOTE' } }];
  await act(async () => discovery().onRefresh());
  expect(mockRefresh).toHaveBeenCalledTimes(2);
  await finishRead();
  expect(discovery().publicationUnavailable).toBeUndefined();
  expect(discovery().publicationFocus).toMatchObject({ id: NEED, kind: 'list' });
  expect(discovery().view).toMatchObject({ selectedId: null, sheet: 'full', area: null });
});

test.each(['map', 'list'])('a newer search owns the screen before a delayed publication %s landing', async kind => {
  mockRows = [{ id: NEED, priblizno: kind === 'map' ? { lat: 44.8, lng: 20.4 } : null }];
  await render();
  const next = { ...discovery().view, query: 'police', area: [19.7, 45.1, 19.9, 45.3], sheet: 'full', listOffset: 220 };
  await act(async () => {
    discovery().onUserIntent?.();
    discovery().onView(next);
  });
  await finishRead();
  expect(discovery().view).toEqual(next);
  expect(discovery().publicationFocus).toBeUndefined();
  mockFocused = false; await update(); mockFocused = true; await update();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(discovery().view).toEqual(next);
});

test('automatic viewport observations do not retire the requested publication landing', async () => {
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await render();
  await act(async () => discovery().onView({ ...discovery().view,
    viewport: { center: [19.8, 45.2], zoom: 10, bounds: [19.7, 45.1, 19.9, 45.3] } }));
  await finishRead();
  expect(discovery().publicationFocus).toMatchObject({ id: NEED, kind: 'map' });
});

test('a callback from a departed visit cannot retire the new visit publication', async () => {
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await render(); const oldIntent = discovery().onUserIntent;
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => oldIntent?.());
  await finishRead(); expect(discovery().publicationFocus).toBeUndefined();
  await finishRead(); expect(discovery().publicationFocus).toMatchObject({ id: NEED, kind: 'map' });
});

test('URL publication identifiers alone never create a trusted landing', async () => {
  mockParams = { publishedNeedId: NEED, publishedRevision: '1' };
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await render();
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(discovery().publicationFocus).toBeUndefined();
  expect(discovery().onOpenPublishedTask).toBeUndefined();
});

const appState = async (state: string) => act(async () => {
  mockAppState.currentState = state;
  for (const listener of mockAppListeners) listener(state);
});

test('foreground publication uses its fresh read without waiting for the suspended attempt', async () => {
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await render();
  await appState('background'); await appState('active');
  expect(mockRefresh).toHaveBeenCalledTimes(2);
  await act(async () => { mockPending.splice(1, 1)[0](); await Promise.resolve(); });
  expect(discovery().publicationFocus).toMatchObject({ id: NEED, kind: 'map' });
  const accepted = discovery().view;
  await finishRead();
  expect(discovery().view).toBe(accepted);
  await appState('background'); await appState('active');
  expect(mockRefresh).toHaveBeenCalledTimes(2);
});

test('a read that completes in the background cannot consume the foreground landing', async () => {
  mockRows = [{ id: NEED, priblizno: null }];
  await render(); await appState('inactive'); await finishRead();
  expect(discovery().publicationFocus).toBeUndefined();
  await appState('active'); expect(mockRefresh).toHaveBeenCalledTimes(2);
  await finishRead(); expect(discovery().publicationFocus).toMatchObject({ id: NEED, kind: 'list' });
});

test('a stale missing-row retry cannot rearm a landing superseded by the person', async () => {
  await render(); await finishRead();
  const oldRetry = discovery().onRefresh;
  expect(discovery().publicationUnavailable).toBe('missing');
  await act(async () => {
    discovery().onUserIntent();
    discovery().onView({ ...discovery().view, query: 'police' });
  });
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await act(async () => oldRetry()); await finishRead();
  expect(discovery().publicationFocus).toBeUndefined();
  expect(discovery().publicationUnavailable).toBeUndefined();
  expect(discovery().view.query).toBe('police');
  await appState('background'); await appState('active');
  expect(mockRefresh).toHaveBeenCalledTimes(2);
});

test('opening another destination while publication waits consumes its automatic landing', async () => {
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await render();
  await act(async () => discovery().onProfile());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/profil');
  mockFocused = false; await update(); await finishRead();
  mockFocused = true; await update();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(discovery().publicationFocus).toBeUndefined();
});
