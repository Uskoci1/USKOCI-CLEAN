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

jest.mock('expo-router', () => ({
  router: mockRouter,
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

let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Zadaci />); });
const update = async () => act(async () => tree.update(<Zadaci />));
const discovery = () => tree.root.findByType('Discovery' as React.ElementType).props;
const finishRead = async () => act(async () => { mockPending.shift()!(); await Promise.resolve(); });
beforeEach(() => {
  mockFocused = true; mockParams = { publishedNeedId: NEED, publishedRevision: '1' };
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
