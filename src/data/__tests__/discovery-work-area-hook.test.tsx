import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceView } from '../marketplaceView';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
let mockAccount: string | null = A, mockRevision = 1, mockSource: object = {};
const mockRead = jest.fn();
jest.mock('../locationClientService', () => ({ workerLocationClientService: { read: () => mockRead() } }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));
jest.mock('../../store/uloga', () => ({ izvorSada: () => mockSource }));
import { useDiscoveryWorkArea, WORK_AREA_CAMERA_WAIT_MS } from '../../hooks/useDiscoveryWorkArea';
const location = () => ({ accountId: A, profileId: B, revision: 'v1', operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20,
  approximatePosition: { latitude: 45.25, longitude: 19.83 } });
const ok = (value = location()) => ({ ok: true, podatak: value });
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
let focus: object | null, view: MarketplaceView, publication: boolean, tree: ReactTestRenderer;
const focusRef: { current: object | null } = { current: null };
let result: ReturnType<typeof useDiscoveryWorkArea>;
function Harness() { result = useDiscoveryWorkArea({ accountId: mockAccount, accountRevision: mockRevision, source: mockSource,
  focus, focusRef, view, publication }); return null; }
const render = async () => act(async () => { focusRef.current = focus; tree = create(<Harness />); });
const update = async () => act(async () => { focusRef.current = focus; tree.update(<Harness />); });
beforeEach(() => { jest.useFakeTimers(); mockAccount = A; mockRevision = 1; mockSource = {}; focus = {}; publication = false;
  view = { ...initialMarketplaceView(), mode: 'map' }; mockRead.mockReset().mockResolvedValue(ok()); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });
it('makes one optional read, returns only camera bounds and never edits the view', async () => {
  const old = JSON.stringify(view); await render(); expect(mockRead).toHaveBeenCalledTimes(1);
  expect(result.target?.bounds).toHaveLength(4); expect(Object.keys(result.target!)).toEqual(['key', 'bounds']);
  expect(JSON.stringify(view)).toBe(old); await update(); expect(mockRead).toHaveBeenCalledTimes(1);
});
it.each(['signed-out', 'unfocused', 'publication', 'viewport', 'query', 'remote'] as const)('does not seed or read for %s', async condition => {
  if (condition === 'signed-out') mockAccount = null;
  if (condition === 'unfocused') focus = null;
  if (condition === 'publication') publication = true;
  if (condition === 'viewport') view.viewport = { center: [19, 45], zoom: 12, bounds: [18, 44, 20, 46] };
  if (condition === 'query') view.query = 'montaža';
  if (condition === 'remote') view.where = 'remote';
  await render(); expect(mockRead).not.toHaveBeenCalled(); expect(result.target).toBeNull();
});
it('a newer explicit user intent retires a delayed answer synchronously', async () => {
  const read = deferred(); mockRead.mockReturnValue(read.promise); await render();
  await act(async () => { result.retire(); read.resolve(ok()); }); expect(result.target).toBeNull();
  focus = null; await update(); focus = {}; await update(); expect(mockRead).toHaveBeenCalledTimes(1);
});
it('the optional read times out once without blocking anything or accepting its later result', async () => {
  const read = deferred(); mockRead.mockReturnValue(read.promise); await render();
  await act(async () => { jest.advanceTimersByTime(WORK_AREA_CAMERA_WAIT_MS); });
  await act(async () => read.resolve(ok())); expect(result.target).toBeNull();
  await update(); expect(mockRead).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});
it.each(['blur', 'publication', 'account-aba', 'source'] as const)('a %s transition fences an old result', async condition => {
  const read = deferred(); mockRead.mockReturnValue(read.promise); await render();
  if (condition === 'blur') { focus = null; await update(); }
  if (condition === 'publication') { publication = true; await update(); }
  if (condition === 'account-aba') mockRevision += 2;
  if (condition === 'source') mockSource = {};
  await act(async () => read.resolve(ok())); expect(result.target).toBeNull();
});
it('no point, failed read and foreign account are optional absence, not a fabricated camera', async () => {
  for (const value of [{ ok: false }, ok({ ...location(), accountId: B }), ok({ ...location(), approximatePosition: null } as any)]) {
    mockRead.mockResolvedValue(value); await render(); expect(result.target).toBeNull(); await act(async () => tree.unmount());
  }
  mockRead.mockRejectedValue(new Error('offline')); await render(); expect(result.target).toBeNull();
});
it('consumes only the named request; a consumed request cannot replay on later focus', async () => {
  await render(); const key = result.target!.key;
  await act(async () => result.handled('old')); expect(result.target?.key).toBe(key);
  await act(async () => result.handled(key)); expect(result.target).toBeNull();
  focus = null; await update(); focus = {}; await update(); expect(mockRead).toHaveBeenCalledTimes(1);
});
it('the previous account callback cannot retire a later account request', async () => {
  await render(); const oldRetire = result.retire, oldHandled = result.handled, oldKey = result.target!.key;
  mockAccount = B; mockRevision++; mockRead.mockResolvedValue(ok({ ...location(), accountId: B })); await update();
  const next = result.target; expect(next).not.toBeNull();
  await act(async () => { oldRetire(); oldHandled(oldKey); }); expect(result.target).toBe(next);
});
it('an automatic viewport observation after the read started does not masquerade as a user pan', async () => {
  const read = deferred(); mockRead.mockReturnValue(read.promise); await render();
  view = { ...view, viewport: { center: [20, 44], zoom: 8, bounds: [19, 43, 21, 45] } }; await update();
  await act(async () => read.resolve(ok())); expect(result.target).not.toBeNull();
});
it('blur fences the old reader before React renders its new focus prop', async () => {
  const read = deferred(); mockRead.mockReturnValue(read.promise); await render(); focusRef.current = null;
  await act(async () => read.resolve(ok())); expect(result.target).toBeNull();
});
