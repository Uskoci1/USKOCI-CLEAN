import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DiscoveryV1OwnerRequest } from '../discoveryV1Owner';
import { taskRelationIndex } from '../taskRelation';

// The P6 route unmounts its screen on blur and rebuilds it from the saved view on focus. This drives the REAL route, screen, coordinator and owners
// over a fake server through that whole cycle: the return must show the same list (read depth restored) and never the error state. The fake server
// answers the way the database does: it echoes a MAP request's bounds through double precision at 15 significant digits, while the map's own
// viewport (what the screen persists) carries 16-17 digits.
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const AT = '2026-09-29T05:00:00.000000Z', EX = '2026-09-29T05:30:00.000000Z', A = 'a'.repeat(32), B = 'b'.repeat(32);
let mockFocused = true;
const mockSource = { odnosiPremaZadacima: jest.fn(async (ids: readonly string[]) => taskRelationIndex([], ids)) };
const mockRouter = { navigate: jest.fn() };
const mockTransportCalls: DiscoveryV1OwnerRequest[] = [];
let mockTransport: (request: DiscoveryV1OwnerRequest) => Promise<unknown>;

jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockRouter.navigate(...args) },
  useLocalSearchParams: () => ({}),
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
jest.mock('../../hooks/useDiscoveryWorkArea', () => ({ useDiscoveryWorkArea: () => ({ target: null, handled: jest.fn(), retire: jest.fn() }) }));
jest.mock('../discoveryV1ClientTransport', () => ({ createDiscoveryV1SupabaseTransport: () => (request: any) => mockTransport(request) }));
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn(async () => null) } }));
jest.mock('../needUrgencyClientService', () => ({ readNeedUrgencies: jest.fn(async () => new Map()) }));
jest.mock('../discoveryV1PresentationBridge', () => ({ DiscoveryV1PresentationBridge: 'Bridge' }));

import { DiscoveryV1Route } from '../../ui/v2/discovery/DiscoveryV1Route';

const rowId = (n: number) => `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`;
const anchor = () => ({ version: 'DISCOVERY_V1', filterKey: A, timeAt: AT, publishedThrough: AT, expiresAt: EX });
const item = (n: number): any => ({ id: rowId(n), revision: 1, sortAt: AT, publishedAt: AT, title: `Task ${n}`, category: 'Selidbe', status: 'PUBLISHED', urgent: false,
  scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, executionLocationMode: 'STATIONARY', taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  verifiedIdentityRequired: false, approximateCity: 'Novi Sad', approximateArea: 'Liman', pin: { lat: Number((45.25 + (n % 10) / 100).toFixed(2)), lng: 19.83, precision: 'COARSE_1KM' },
  requiredSlots: 1, coveredSlots: 0, requiredSkills: [], requiredTools: [], requiredVehicles: [], requiredLicenses: [], minimumExperienceYears: null,
  priceMode: 'OFFERS', requesterPriceRsd: null, priceBasis: null, requesterProfileId: PROFILE, responseDeadline: null, acceptsApplications: true,
  publicTopology: null, criticalConditions: null });

/** `select jsonb_build_array('19.371235347487277'::numeric::double precision)` answers 19.3712353474873 (extra_float_digits is 0). */
const databaseEcho = (bounds: readonly number[]) => bounds.map(value => Number(value.toPrecision(15)));
/** What the native map reports for its visible area: 16-17 significant digits, which no server echo reproduces. */
const NATIVE_BOUNDS = [19.371235347487277, 44.85134028015267, 21.899999999999999, 45.796000000000006];
const CANONICAL_BOUNDS = [19.371235, 44.85134, 21.9, 45.796];

/** A server of 100 tasks in pages of 50 with a whole-bounds hint, answering the way the SQL does (coverage echoes the request). */
function server(request: DiscoveryV1OwnerRequest): unknown {
  mockTransportCalls.push(request);
  if (request.mode === 'MAP') {
    return { version: 'DISCOVERY_V1', mode: 'MAP', asOf: AT, filterKey: A, anchor: anchor(), coverageBounds: databaseEcho(request.bounds), effectiveGrid: 8,
      wholeBounds: [19.5, 44.7, 21.9, 45.4], buckets: [{ kind: 'TASK', key: 'task:' + rowId(0), point: { lat: 45.25, lng: 19.83 }, taskId: rowId(0) }],
      counts: { kind: 'exact_live', observedAt: AT, mapped: 100, withoutPoint: 0 } };
  }
  if (request.mode === 'PAGE') {
    const start = request.after ? Number((request.after as any).id.slice(-12)) : 0;
    const rows = Array.from({ length: 50 }, (_, i) => item(start + i));
    const more = start + 50 < 100;
    return { version: 'DISCOVERY_V1', mode: 'PAGE', asOf: AT, filterKey: A, anchor: anchor(), items: rows, hasMore: more,
      nextCursor: more ? { scopeKey: B, section: 0, sortAt: AT, id: rowId(start + 49) } : null,
      counts: { kind: 'exact_live', observedAt: AT, mapped: 100, listed: 100, inArea: 100, withoutPoint: 0, undated: 0 },
      availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['OFFERS'] } };
  }
  if (request.mode === 'EXACT_PUBLIC') {
    return { version: 'DISCOVERY_V1', mode: 'EXACT_PUBLIC', asOf: AT, items: [item(Number(request.needId.slice(-12)) - 1)], hasMore: false, nextCursor: null };
  }
  throw new Error('UNEXPECTED_MODE');
}

let tree: ReactTestRenderer | undefined;
const bridge = () => tree!.root.findAllByType('Bridge' as unknown as React.ElementType)[0];
const errorState = () => tree!.root.findAllByProps({ title: 'Zadaci trenutno nisu dostupni' });
const flush = async () => { for (let i = 0; i < 80; i++) await act(async () => { await Promise.resolve(); }); };
const modes = () => mockTransportCalls.map(request => request.mode);
let info: jest.SpyInstance;
const traced = () => info.mock.calls.map(call => String(call[0])).filter(line => line.startsWith('[USKOCI_P6_TRACE]'));
beforeEach(() => {
  mockFocused = true; mockTransportCalls.length = 0; mockTransport = async request => server(request); mockRouter.navigate.mockClear();
  info = jest.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; info.mockRestore(); });

test('the database echo of native viewport bounds is a different double, so the fake server proves the trap', () => {
  expect(databaseEcho(NATIVE_BOUNDS)).not.toEqual(NATIVE_BOUNDS);
  expect(databaseEcho(CANONICAL_BOUNDS)).toEqual(CANONICAL_BOUNDS);
});

test('a return from another screen rebuilds the same list, restores its read depth and never shows the error state', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  expect(bridge()).toBeDefined();
  expect(bridge().props.snapshot.items).toHaveLength(50);
  // The first visit: no camera yet, so the map is seeded over the world and then read over the server's whole bounds.
  expect(modes()).toEqual(['PAGE', 'MAP', 'MAP']);
  expect(bridge().props.snapshot.mapWholeBounds).toEqual([19.5, 44.7, 21.9, 45.4]);
  expect(traced()).toEqual(['[USKOCI_P6_TRACE] ["restored","50/1"]']);

  // The person reads a second page, the map reports where it is, and the list is scrolled deep at the full stop.
  await act(async () => { bridge().props.actions.onNextPage(); });
  await flush();
  expect(bridge().props.snapshot.items).toHaveLength(100);
  const settled = { center: [20.6, 45.3], zoom: 8, bounds: NATIVE_BOUNDS };
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, viewport: settled, sheet: 'full', listOffset: 4200 }); });
  await flush();
  expect(bridge().props.snapshot.view).toMatchObject({ pages: 2, sheet: 'full', listOffset: 4200 });

  // Another screen comes in front: the screen is retired ...
  mockFocused = false;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  expect(tree!.root.findAllByType('Bridge' as unknown as React.ElementType)).toHaveLength(0);

  // ... and on the way back it is rebuilt from the saved view, the map read over the camera's own bounds.
  mockTransportCalls.length = 0;
  mockFocused = true;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  expect(errorState()).toHaveLength(0);
  expect(bridge()).toBeDefined();
  expect(bridge().props.snapshot.items).toHaveLength(100);
  expect(bridge().props.snapshot.view).toMatchObject({ pages: 2, sheet: 'full', listOffset: 4200, viewport: settled });
  expect(modes()).toEqual(['PAGE', 'MAP', 'PAGE']);
  expect((mockTransportCalls[1] as any).bounds).toEqual(CANONICAL_BOUNDS);
  expect(bridge().props.snapshot.mapMarkers).toHaveLength(1);
});

test('clearing a filter reads the map again over the camera the person left, without the error state', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  expect(modes()).toEqual(['PAGE', 'MAP', 'MAP']);
  const settled = { center: [20.6, 45.3], zoom: 8, bounds: NATIVE_BOUNDS };
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, viewport: settled }); });
  await flush();

  // Remote work has no place: the list alone is read again.
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, where: 'remote' }); });
  await flush();
  expect(errorState()).toHaveLength(0);
  expect(modes()).toEqual(['PAGE']);

  // Clearing it reads the list and the map over the same viewport the person left.
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, where: 'any' }); });
  await flush();
  expect(errorState()).toHaveLength(0);
  expect(modes()).toEqual(['PAGE', 'MAP']);
  expect((mockTransportCalls[1] as any).bounds).toEqual(CANONICAL_BOUNDS);
  expect(bridge().props.snapshot.items).toHaveLength(50);
  expect(bridge().props.snapshot.mapMarkers).toHaveLength(1);
});

test('settling the map on a native viewport reads the list and the map over that area', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.actions.onArea(NATIVE_BOUNDS); });
  await flush();
  expect(errorState()).toHaveLength(0);
  expect(modes().sort()).toEqual(['MAP', 'PAGE']);
  const map = mockTransportCalls.find(request => request.mode === 'MAP') as any, listed = mockTransportCalls.find(request => request.mode === 'PAGE') as any;
  expect(map.bounds).toEqual(CANONICAL_BOUNDS);
  expect(listed.scope).toEqual({ kind: 'AREA', bounds: CANONICAL_BOUNDS });
  expect(bridge().props.snapshot.mapMarkers).toHaveLength(1);
});

test('the error of one read stays until a later read applies, and only then goes away', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  expect(bridge().props.error).toBe(false);
  mockTransport = async () => { throw new Error('DISCOVERY_V1_READ_FAILED'); };
  await act(async () => { bridge().props.actions.onArea(NATIVE_BOUNDS); });
  await flush();
  expect(bridge().props.error).toBe(true);
  expect(traced()).toContain('[USKOCI_P6_TRACE] ["read-failed","DISCOVERY_V1_READ_FAILED"]');

  // A change that reads nothing (the sheet moved) does not pretend the failed read succeeded.
  mockTransport = async request => server(request);
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, sheet: 'full' }); });
  await flush();
  expect(bridge().props.error).toBe(true);

  // The next read that applies clears it.
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.onView({ ...bridge().props.snapshot.view, where: 'remote' }); });
  await flush();
  expect(modes()).toEqual(['PAGE']);
  expect(bridge().props.error).toBe(false);
  expect(bridge().props.snapshot.items).toHaveLength(50);
});

test('a return that cannot read the map still ends in the honest error state with a way to try again', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  mockFocused = false;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  mockTransport = async request => { if (request.mode === 'MAP') throw new Error('DISCOVERY_V1_READ_FAILED'); return server(request); };
  mockFocused = true;
  await act(async () => { tree!.update(<DiscoveryV1Route />); });
  await flush();
  const shown = errorState();
  expect(shown.length).toBeGreaterThan(0);
  expect(shown[0].props.primary.label).toBe('Pokušaj ponovo');
  expect(traced()).toContain('[USKOCI_P6_TRACE] ["restore-failed","DISCOVERY_V1_READ_FAILED"]');
});

test('a cluster tap reads nothing itself, a task reads its exact row, a place reads its members', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  mockTransportCalls.length = 0;
  const cluster = { kind: 'CLUSTER', key: 'cluster:1', point: { lat: 45.25, lng: 19.83 }, taskCount: 5, distinctPointCount: 3, memberBounds: [19.8, 45.2, 19.9, 45.3] };
  await act(async () => { bridge().props.actions.onSelectMarker(cluster); });
  await flush();
  expect(mockTransportCalls).toHaveLength(0);
  expect(bridge().props.error).toBe(false);

  const task = { kind: 'TASK', key: 'task:' + rowId(0), point: { lat: 45.25, lng: 19.83 }, taskId: rowId(0) };
  await act(async () => { bridge().props.actions.onSelectMarker(task); });
  await flush();
  expect(modes()).toEqual(['EXACT_PUBLIC']);
  expect(bridge().props.snapshot.peek).toMatchObject({ kind: 'TASK', item: { id: rowId(0) } });
  expect(bridge().props.selectedMarkerKey).toBe(task.key);

  mockTransportCalls.length = 0;
  const place = { kind: 'PLACE', key: 'place:45.25:19.83', point: { lat: 45.25, lng: 19.83 }, taskCount: 30 };
  await act(async () => { bridge().props.actions.onSelectMarker(place); });
  await flush();
  expect(modes()).toEqual(['PAGE']);
  expect((mockTransportCalls[0] as any).scope).toEqual({ kind: 'POINT_MEMBERS', point: { lat: 45.25, lng: 19.83 } });
  expect(bridge().props.snapshot.peek).toMatchObject({ kind: 'PLACE' });
  expect(bridge().props.selectedMarkerKey).toBe(place.key);
});

test('a settled region that is not the person\'s own reads the map alone and keeps the list, the peek and the error state as they are', async () => {
  await act(async () => { tree = create(<DiscoveryV1Route />); });
  await flush();
  const task = { kind: 'TASK', key: 'task:' + rowId(0), point: { lat: 45.25, lng: 19.83 }, taskId: rowId(0) };
  await act(async () => { bridge().props.actions.onSelectMarker(task); });
  await flush();
  const listBefore = bridge().props.snapshot.items, peekBefore = bridge().props.snapshot.peek;
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.actions.onViewportSettled(NATIVE_BOUNDS); });
  await flush();
  expect(modes()).toEqual(['MAP']);
  expect((mockTransportCalls[0] as any).bounds).toEqual(CANONICAL_BOUNDS);
  expect(bridge().props.snapshot.items).toEqual(listBefore);
  expect(bridge().props.snapshot.peek).toEqual(peekBefore);
  expect(bridge().props.selectedMarkerKey).toBe(task.key);
  expect(bridge().props.snapshot.view.area).toBeNull();
  expect(bridge().props.error).toBe(false);
  // The same region again is where the map already is.
  mockTransportCalls.length = 0;
  await act(async () => { bridge().props.actions.onViewportSettled(NATIVE_BOUNDS); });
  await flush();
  expect(mockTransportCalls).toHaveLength(0);
});
