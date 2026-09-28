import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const NEED = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const mockSource = { otvorenePrilike: jest.fn(), otvorenaPrilika: jest.fn(), odnosiPremaZadacima: jest.fn() };
let mockFocused = true;
let mockParams: Record<string, unknown> = { publishedNeedId: NEED, publishedRevision: '1' };
let mockHookCall = 0;
let mockRows: Record<string, unknown>[] = [];
let mockLoading = false, mockError = false;
let mockCollectionLoad: (signal: AbortSignal) => Promise<Record<string, unknown>[]>;
const mockPending: (() => void)[] = [];
const mockRefresh = jest.fn(async () => {});
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
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: (load: typeof mockCollectionLoad) => {
  mockHookCall++;
  if (mockHookCall % 2) mockCollectionLoad = load;
  return mockHookCall % 2 ? { data: mockRows, loading: mockLoading, refreshing: false, error: mockError, refresh: mockRefresh }
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
  mockHookCall = 0; mockRows = []; mockPending.length = 0; mockLoading = false; mockError = false;
  mockSource.otvorenaPrilika.mockReset().mockImplementation(() => new Promise(resolve => {
    mockPending.push(() => resolve({ item: mockRows.find(row => row.id === NEED)
      ? { ...mockRows.find(row => row.id === NEED), revision: 1 } : null, asOf: '2026-09-27T18:00:00Z' }));
  }));
  mockSource.otvorenePrilike.mockReset();
  mockRefresh.mockReset().mockImplementation(async () => {}); mockRelationsRefresh.mockClear(); mockRouter.navigate.mockClear(); mockRouter.replace.mockClear();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('a publication read retired by blur is retried on fresh focus, then selects only the public point', async () => {
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await render(); expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(1);
  mockFocused = false; await update();
  await finishRead(); expect(discovery().publicationFocus).toBeUndefined();
  mockFocused = true; await update(); expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(2);
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
  expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(2);
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
  expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(1);
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
  expect(mockSource.otvorenaPrilika).not.toHaveBeenCalled();
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
  expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(2);
  await act(async () => { mockPending.splice(1, 1)[0](); await Promise.resolve(); });
  expect(discovery().publicationFocus).toMatchObject({ id: NEED, kind: 'map' });
  const accepted = discovery().view;
  await finishRead();
  expect(discovery().view).toBe(accepted);
  await appState('background'); await appState('active');
  // A completed landing is not another camera command, but foreground membership is revalidated.
  expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(3);
  await finishRead();expect(discovery().view).toBe(accepted);
});

test('a read that completes in the background cannot consume the foreground landing', async () => {
  mockRows = [{ id: NEED, priblizno: null }];
  await render(); await appState('inactive'); await finishRead();
  expect(discovery().publicationFocus).toBeUndefined();
  await appState('active'); expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(2);
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
  await act(async () => oldRetry());
  expect(discovery().publicationFocus).toBeUndefined();
  expect(discovery().publicationUnavailable).toBeUndefined();
  expect(discovery().view.query).toBe('police');
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  await appState('background'); await appState('active');
  expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(1);
});

test('opening another destination while publication waits consumes its automatic landing', async () => {
  mockRows = [{ id: NEED, priblizno: { lat: 44.8, lng: 20.4 } }];
  await render();
  await act(async () => discovery().onProfile());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/profil');
  mockFocused = false; await update(); await finishRead();
  mockFocused = true; await update();
  expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(1);
  expect(discovery().publicationFocus).toBeUndefined();
});

test.each(['loading', 'error'])('exact publication lands independently of a %s collection without claiming a total', async state => {
  mockLoading = state === 'loading'; mockError = state === 'error';
  mockSource.otvorenaPrilika.mockResolvedValue({ item: { id: NEED, revision: 1, priblizno: { lat: 44.8, lng: 20.4 } }, asOf: '2026-09-27T18:00:00Z' });
  await render();
  expect(discovery().publicationFocus).toMatchObject({ id: NEED, kind: 'map' });
  expect(discovery().items).toHaveLength(1);
  expect(discovery().collectionStatus).toBe(state);
  expect(discovery().loading).toBe(false); expect(discovery().error).toBe(false);
  await act(async () => discovery().onOpen(discovery().items[0]));
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: NEED } });
});

test('exact public row outside the collection is shown once and overrides an older same-ID snapshot', async () => {
  mockRows = [{ id: NEED, naslov: 'Stari naslov', priblizno: null }, { id: 'other', priblizno: null }];
  mockSource.otvorenaPrilika.mockResolvedValue({ item: { id: NEED, revision: 1, naslov: 'Aktuelan naslov', priblizno: null }, asOf: '2026-09-27T18:00:00Z' });
  await render();
  expect(discovery().items.map((row: { id: string }) => row.id)).toEqual([NEED, 'other']);
  expect(discovery().items[0].naslov).toBe('Aktuelan naslov');
  expect(discovery().publicationFocus).toMatchObject({ kind: 'list' });
});

test.each([0, 2])('a different public revision %s cannot prove the published handoff', async revision => {
  mockSource.otvorenaPrilika.mockResolvedValue({ item: { id: NEED, revision, priblizno: null }, asOf: '2026-09-27T18:00:00Z' });
  await render(); expect(discovery().publicationUnavailable).toBe('error');
  expect(discovery().publicationFocus).toBeUndefined(); expect(discovery().items).toEqual([]);
});

test('retired exact read receives abort and cannot inject a public row after navigation', async () => {
  mockRows = [{ id: NEED, priblizno: null }]; await render();
  const signal = mockSource.otvorenaPrilika.mock.calls[0][1].signal;
  mockFocused = false; await update(); expect(signal.aborted).toBe(true);
  await finishRead(); expect(discovery().publicationFocus).toBeUndefined();
});

test('an exact read failure stays separate from the available collection and can retry', async () => {
  mockRows = [{ id: 'other', priblizno: null }];
  mockSource.otvorenaPrilika.mockRejectedValueOnce(new Error('offline'));
  await render(); expect(discovery().publicationUnavailable).toBe('error');
  expect(discovery().error).toBe(false); expect(discovery().items).toEqual(mockRows);
  mockRows.push({ id: NEED, priblizno: null });
  await act(async () => discovery().onRefresh()); await finishRead();
  expect(discovery().publicationFocus).toMatchObject({ id: NEED, kind: 'list' });
});

test('a failed collection refresh cannot erase the independently confirmed publication row', async () => {
  mockError = true;
  mockSource.otvorenaPrilika.mockResolvedValue({item:{id:NEED,revision:1,naslov:'Potvrđen zadatak',priblizno:null},asOf:'2026-09-27T18:00:00Z'});
  await render();
  expect(discovery().items[0].naslov).toBe('Potvrđen zadatak');
  mockSource.otvorenePrilike.mockRejectedValueOnce(new Error('offline'));
  // FocusedResource records failure but resolves its Promise<void>; completion is not a receipt.
  mockRefresh.mockImplementationOnce(async()=>{
    try { await mockCollectionLoad(new AbortController().signal); }
    catch { mockError=true;mockLoading=false;mockRows=[]; }
  });
  await act(async()=>discovery().onRefresh());await update();
  expect(mockSource.otvorenePrilike).toHaveBeenCalledTimes(1);
  expect(discovery().items.map((item:{id:string})=>item.id)).toEqual([NEED]);
  expect(discovery().items[0].naslov).toBe('Potvrđen zadatak');
  expect(discovery().collectionStatus).toBe('error');
  expect(discovery().loading).toBe(false);expect(discovery().error).toBe(false);
});

test('a collection started before the exact answer cannot replace it merely by finishing later',async()=>{
  mockLoading=true;await render();
  let finish!:(rows:Record<string,unknown>[])=>void;
  mockSource.otvorenePrilike.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
  const collection=mockCollectionLoad(new AbortController().signal);
  mockRows=[{id:NEED,naslov:'Tačan javni red',priblizno:null}];await finishRead();
  const older=[{id:NEED,naslov:'Raniji spisak',priblizno:null}];
  await act(async()=>{finish(older);mockRows=await collection;mockLoading=false;tree.update(<Zadaci/>);});
  expect(discovery().items).toHaveLength(1);
  expect(discovery().items[0].naslov).toBe('Tačan javni red');
});

test.each(['updated','removed'] as const)('a newer successful collection takes over the %s exact row',async kind=>{
  mockRows=[{id:NEED,naslov:'Objavljeni red',priblizno:null}];await render();await finishRead();
  const next=kind==='updated'?[{id:NEED,naslov:'Novi uslovi',priblizno:null},{id:'other',priblizno:null}]
    :[{id:'other',priblizno:null}];
  mockSource.otvorenePrilike.mockResolvedValueOnce(next);
  await act(async()=>{mockRows=await mockCollectionLoad(new AbortController().signal);tree.update(<Zadaci/>);});
  expect(discovery().items).toEqual(next);
  expect(discovery().items.some((item:{naslov?:string})=>item.naslov==='Objavljeni red')).toBe(false);
});

test('return from detail retains the exact row until revalidation without resetting the camera or list position',async()=>{
  const exact={id:NEED,revision:1,naslov:'Objavljen zadatak',priblizno:{lat:44.8,lng:20.4}};
  mockSource.otvorenaPrilika.mockResolvedValueOnce({item:exact,asOf:'2026-09-27T18:00:00Z'});
  await render();expect(discovery().items).toEqual([exact]);
  const position={...discovery().view,sheet:'full',listOffset:420,viewport:{center:[19.8,45.2],zoom:11,bounds:[19.7,45.1,19.9,45.3]}};
  await act(async()=>{discovery().onView(position);discovery().onOpen(exact);});
  mockFocused=false;await update();
  mockFocused=true;await update();
  expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(2);
  expect(discovery().items).toEqual([exact]);
  expect(discovery().view).toEqual(position);
  mockRows=[{...exact,naslov:'Ponovo pročitan'}];await finishRead();
  expect(discovery().items[0].naslov).toBe('Ponovo pročitan');
  expect(discovery().view).toEqual(position);
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
});

test('background clears the exact snapshot and resumes with a new read without repeating the completed landing',async()=>{
  const exact={id:NEED,revision:1,priblizno:{lat:44.8,lng:20.4}};
  mockSource.otvorenaPrilika.mockResolvedValueOnce({item:exact,asOf:'2026-09-27T18:00:00Z'});
  await render();const position={...discovery().view,sheet:'full',listOffset:180};
  await act(async()=>discovery().onView(position));
  await appState('background');expect(discovery().items).toEqual([]);
  await appState('active');expect(mockSource.otvorenaPrilika).toHaveBeenCalledTimes(2);
  expect(discovery().items).toEqual([]);expect(discovery().view).toEqual(position);
  mockRows=[exact];await finishRead();
  expect(discovery().items).toHaveLength(1);expect(discovery().view).toEqual(position);
});

const mockWorkArea = { target: { key: 'work-area', bounds: [19, 44, 20, 45] }, retire: jest.fn(), handled: jest.fn() };
jest.mock('../../hooks/useDiscoveryWorkArea', () => ({ useDiscoveryWorkArea: () => mockWorkArea }));
beforeEach(() => { mockWorkArea.retire.mockClear(); mockWorkArea.handled.mockClear(); });
test('P5 work-area: the route passes the optional camera without changing any applied criterion', async () => {
  mockParams = {}; await render(); const original = discovery().view;
  expect(discovery().initialWorkArea).toBe(mockWorkArea.target);
  await act(async () => discovery().onInitialWorkAreaHandled('work-area'));
  expect(mockWorkArea.handled).toHaveBeenCalledWith('work-area'); expect(discovery().view).toBe(original);
});
test('P5 work-area: explicit intent retires the seed and stale visit callbacks do not', async () => {
  mockParams = {}; await render(); const old = discovery().onUserIntent;
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => old()); expect(mockWorkArea.retire).not.toHaveBeenCalled();
  await act(async () => discovery().onUserIntent()); expect(mockWorkArea.retire).toHaveBeenCalledTimes(1);
});
test('P5 work-area: a trusted publication is never handed a competing default camera', async () => {
  await render(); expect(discovery().initialWorkArea).toBeNull();
});
