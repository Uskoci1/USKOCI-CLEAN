/**
 * P6-10: a touch on a task or place bucket answers at once (the bucket's halo), while the exact read that fills the card is on its way; a read that does not
 * apply takes the halo away, the newest touch keeps it, and the DEV package traces the milliseconds to the halo and to the card data.
 */
let mockPackage: string | undefined = 'rs.uskoci.dev';
jest.mock('expo-constants', () => ({ __esModule: true, default: { get expoConfig() { return { android: { package: mockPackage } }; } } }));
jest.mock('../discoveryV1ClientTransport', () => ({ createDiscoveryV1SupabaseTransport: () => ({}) }));
jest.mock('../discoveryV1OverlayOwner', () => ({ createDiscoveryV1ExistingOverlayLoaders: () => ({}), discoveryV1OverlayRelation: () => ({ kind: 'NONE' }) }));
const mockCoordinator: any = {};
jest.mock('../discoveryV1RouteCoordinator', () => ({ createDiscoveryV1RouteCoordinator: () => mockCoordinator }));
const mockBridge: { props: any } = { props: null };
jest.mock('../discoveryV1PresentationBridge', () => ({ DiscoveryV1PresentationBridge: (props: any) => { mockBridge.props = props; return null; } }));
jest.mock('../../ui/system/StateView', () => ({ StateView: () => null }));

import { act, create } from 'react-test-renderer';
import { DiscoveryV1Screen } from '../../ui/v2/discovery/DiscoveryV1Screen';

const marker = (kind: 'TASK' | 'PLACE' | 'CLUSTER', key: string): any => ({ kind, key, point: { lat: 45.25, lng: 19.83 }, taskCount: 1,
  ...(kind === 'TASK' ? { taskId: '11111111-1111-4111-8111-111111111111' } : {}), ...(kind === 'CLUSTER' ? { memberBounds: [19.7, 45.1, 20, 45.4] } : {}) });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const flush = () => act(async () => { await new Promise(done => setTimeout(done, 0)); });

let selectedKey: string | null;
let info: jest.SpyInstance;
const traced = () => info.mock.calls.map(call => String(call[0])).filter(line => line.includes('"pin"'));

beforeEach(() => {
  mockPackage = 'rs.uskoci.dev'; selectedKey = null; mockBridge.props = null;
  info = jest.spyOn(console, 'info').mockImplementation(() => {});
  mockCoordinator.restore = jest.fn(async () => ({ kind: 'applied' }));
  mockCoordinator.retire = jest.fn();
  mockCoordinator.selectMarker = jest.fn();
  mockCoordinator.snapshot = () => ({ screen: { active: true, view: { id: 'view' }, items: [], mapMarkers: [] }, view: { id: 'view' }, overlay: null, search: null, selectedMarkerKey: selectedKey, loadingMore: false });
});
afterEach(() => info.mockRestore());

const render = async () => {
  let tree: any;
  await act(async () => {
    tree = create(<DiscoveryV1Screen source={{} as any} scopeKey="scope" initialView={{} as any} isCurrent={() => true} onPersistView={() => {}}
      onOpen={() => {}} onProfile={() => {}} onNew={() => {}} onNotifications={() => {}} />);
  });
  await flush();
  return tree;
};
const touch = (bucket: any) => act(async () => { mockBridge.props.actions.onSelectMarker(bucket); });
const halo = () => mockBridge.props.selectedMarkerKey;

test('a touched task bucket shows its halo before the read answers, and keeps it when the card lands', async () => {
  const read = deferred<any>();
  mockCoordinator.selectMarker = jest.fn(() => read.promise);
  const tree = await render();
  expect(halo()).toBeNull();
  await touch(marker('TASK', 'task:a'));
  expect(halo()).toBe('task:a');                          // the read has not answered yet
  await act(async () => { selectedKey = 'task:a'; read.resolve({ kind: 'TASK', applied: true, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBe('task:a');                          // the coordinator's own selection has taken over
  const lines = traced();
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^\[USKOCI_P6_TRACE\] \["pin","\d{1,4}\/\d{1,4}"\]$/);
  await act(async () => { tree.unmount(); });
});

test('a read that does not apply takes the halo away again, and a cluster is navigation only', async () => {
  const read = deferred<any>();
  mockCoordinator.selectMarker = jest.fn(() => read.promise);
  const tree = await render();
  await touch(marker('PLACE', 'place:a'));
  expect(halo()).toBe('place:a');
  await act(async () => { read.resolve({ kind: 'PLACE', applied: false, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBeNull();
  expect(traced()).toHaveLength(0);                       // nothing was selected, so nothing is timed
  mockCoordinator.selectMarker = jest.fn(async () => ({ kind: 'CLUSTER', bounds: [19.7, 45.1, 20, 45.4], snapshot: {} }));
  await touch(marker('CLUSTER', 'cluster:a'));
  expect(halo()).toBeNull();
  await flush();
  expect(halo()).toBeNull();
  expect(traced()).toHaveLength(0);
  await act(async () => { tree.unmount(); });
});

test('a stale read gives the halo up, and the newest touch keeps it when an older read finishes late', async () => {
  const first = deferred<any>(), second = deferred<any>();
  mockCoordinator.selectMarker = jest.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  const tree = await render();
  await touch(marker('TASK', 'task:a'));
  await touch(marker('TASK', 'task:b'));
  expect(halo()).toBe('task:b');
  await act(async () => { first.resolve({ kind: 'stale' }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBe('task:b');                          // the older read's end does not take the newer halo away
  expect(traced()).toHaveLength(0);
  await act(async () => { selectedKey = 'task:b'; second.resolve({ kind: 'TASK', applied: true, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(halo()).toBe('task:b');
  expect(traced()).toHaveLength(1);
  await act(async () => { tree.unmount(); });
});

test('a store build traces nothing and still answers the touch', async () => {
  mockPackage = 'rs.uskoci';
  const read = deferred<any>();
  mockCoordinator.selectMarker = jest.fn(() => read.promise);
  const tree = await render();
  await touch(marker('TASK', 'task:a'));
  expect(halo()).toBe('task:a');
  await act(async () => { selectedKey = 'task:a'; read.resolve({ kind: 'TASK', applied: true, snapshot: {} }); await Promise.resolve(); });
  await flush();
  expect(traced()).toHaveLength(0);
  await act(async () => { tree.unmount(); });
});
