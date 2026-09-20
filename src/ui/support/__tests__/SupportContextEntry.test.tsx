import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const C = '20000000-0000-4000-8000-000000000001', R = '30000000-0000-4000-8000-000000000001';
let mockSession = { user: { id: A }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
let mockAppState = 'active'; const mockListeners = new Set<(value: string) => void>();
const mockFind = jest.fn(), mockPush = jest.fn();
jest.mock('../../../data/supportCaseClientService', () => ({ supportCaseClientService: { findContext: (...args: unknown[]) => mockFind(...args) } }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (fn: () => void) => require('react').useEffect(() => mockFocused ? fn() : undefined, [fn, mockFocused]) }));
jest.mock('react-native', () => { const rn = jest.requireActual('react-native'); return new Proxy(rn, { get(target, key) {
  if (key === 'AppState') return { get currentState() { return mockAppState; },
    addEventListener: (_: string, listener: (value: string) => void) => { mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) }; } };
  return Reflect.get(target, key);
} }); });
jest.mock('../../settings/SettingsPresentation', () => ({ SettingsAction: 'Action', SettingsPanel: 'Panel', SettingsText: 'T' }));
import { SupportContextEntry } from '../SupportContextEntry';
let tree: ReactTestRenderer, allowed = true, disabled = false, previewText: string | undefined, authority = 0;
const element = () => { const renderedAuthority = authority; return <SupportContextEntry
  reference={{ kind: previewText === undefined ? 'TASK_REVIEW' : 'AGREEMENT_MESSAGE', id: R, revision: previewText === undefined ? null : 2 }}
  label="Zatraži pregled podrške" canAct={() => allowed && authority === renderedAuthority} disabled={disabled} previewText={previewText} />; };
const render = async () => { await act(async () => { tree = create(element()); }); };
const update = async () => { await act(async () => tree.update(element())); };
const press = () => tree.root.findByType('Action' as React.ElementType).props.onPress;
const ok = (caseId: string | null) => ({ ok: true, podatak: { accountId: A, caseId, authoritative: true } });
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; }
beforeEach(() => { jest.clearAllMocks(); mockFind.mockReset(); mockFind.mockResolvedValue(ok(null));
  mockSession = { user: { id: A }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockAppState = 'active'; allowed = true; disabled = false; previewText = undefined; authority = 0; });
afterEach(async () => { await act(async () => tree?.unmount()); expect(mockListeners.size).toBe(0); });
it.each([null, C])('reads the existing owned case before routing with only opaque identifiers (%s)', async caseId => {
  mockFind.mockResolvedValue(ok(caseId)); await render(); expect(mockFind).not.toHaveBeenCalled();
  await act(async () => press()()); expect(mockFind).toHaveBeenCalledTimes(1);
  expect(mockFind.mock.calls[0]).toEqual(['TASK_REVIEW', R, { accountId: A, accountRevision: 1, isCurrent: expect.any(Function) }]);
  expect(mockPush).toHaveBeenCalledWith(caseId ? { pathname: '/podrska/[id]', params: { id: C } }
    : { pathname: '/podrska/novi', params: { contextKind: 'TASK_REVIEW', contextId: R } });
  expect(mockFind.mock.calls[0][2].isCurrent()).toBe(false);
});
it('serializes duplicate taps and blocks the retained callback even before navigation blur arrives', async () => {
  const held = deferred(); mockFind.mockReturnValue(held.promise); await render(); const retained = press();
  await act(async () => { retained(); retained(); }); expect(mockFind).toHaveBeenCalledTimes(1);
  await act(async () => held.resolve(ok(C))); await act(async () => retained()); expect(mockFind).toHaveBeenCalledTimes(1); expect(mockPush).toHaveBeenCalledTimes(1);
});
it.each(['blur', 'account', 'ABA', 'parent guard', 'disabled', 'background'] as const)('drops a late context read after %s', async change => {
  const held = deferred(); mockFind.mockReturnValue(held.promise); await render(); const retained = press(); await act(async () => retained());
  if (change === 'blur') { mockFocused = false; await update(); }
  else if (change === 'account') { mockSession = { user: { id: B }, accountRevision: 2 }; await update(); }
  else if (change === 'ABA') { mockSession = { user: { id: A }, accountRevision: 3 }; await update(); }
  else if (change === 'parent guard') allowed = false;
  else if (change === 'disabled') { disabled = true; await update(); }
  else await act(async () => { mockAppState = 'background'; mockListeners.forEach(fn => fn('background')); });
  await act(async () => { retained(); held.resolve(ok(C)); }); expect(mockPush).not.toHaveBeenCalled(); expect(mockFind).toHaveBeenCalledTimes(1);
});
// Owner decision 1 (2026-09-19): the app has no global mode. This used to be a row of the table above.
it('a flip of the retired app mode drops nothing: the context read in flight still opens support', async () => {
  const held = deferred(); mockFind.mockReturnValue(held.promise); await render(); const retained = press(); await act(async () => retained());
  mockIntent = 'uskocer'; await update();
  await act(async () => { held.resolve(ok(C)); }); expect(mockPush).toHaveBeenCalledTimes(1); expect(mockFind).toHaveBeenCalledTimes(1);
});
it('two background cycles release only their own listener and never reuse a previous foreground read', async () => {
  const held = deferred(); await render();
  for (let i = 0; i < 2; i++) {
    mockFind.mockReturnValue(held.promise); await act(async () => press()());
    await act(async () => { mockAppState = 'background'; mockListeners.forEach(fn => fn('background')); });
    await act(async () => { mockAppState = 'active'; mockListeners.forEach(fn => fn('active')); });
  }
  await act(async () => held.resolve(ok(C))); expect(mockPush).not.toHaveBeenCalled();
  expect(tree.root.findByType('Action' as React.ElementType).props.disabled).toBe(false);
});
it('shows a bounded service failure and does not infer ABSENT or navigate automatically', async () => {
  mockFind.mockResolvedValue({ ok: false, poruka: 'Nije dostupno.' }); await render(); await act(async () => press()());
  expect(mockPush).not.toHaveBeenCalled(); expect(tree.root.findByType('T' as React.ElementType).props.children).toBe('Nije dostupno.');
  expect(mockFind).toHaveBeenCalledTimes(1);
});
it('a retained callback from the previous focus cannot acquire the new focus lease', async () => {
  await render(); const retained = press(); mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => retained()); expect(mockFind).not.toHaveBeenCalled();
  await act(async () => press()()); expect(mockFind).toHaveBeenCalledTimes(1);
});
it('drops a lookup from replaced parent authority but releases the same screen busy indicator for an explicit fresh read', async () => {
  const held = deferred(); mockFind.mockReturnValueOnce(held.promise); await render(); await act(async () => press()());
  expect(tree.root.findByType('Action' as React.ElementType).props.disabled).toBe(true);
  authority++; await update(); await act(async () => held.resolve(ok(C))); expect(mockPush).not.toHaveBeenCalled();
  expect(tree.root.findByType('Action' as React.ElementType).props.disabled).toBe(false);
  expect(mockFind).toHaveBeenCalledTimes(1);
  await act(async () => press()()); expect(mockFind).toHaveBeenCalledTimes(2); expect(mockPush).toHaveBeenCalledTimes(1);
});
it('previews only the chosen message and performs no lookup until the explicit continuation', async () => {
  previewText = 'Samo namerno izabrana privatna poruka.'; await render(); await act(async () => press()());
  expect(mockFind).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('T' as React.ElementType).some(n => n.props.children === previewText)).toBe(true);
  await act(async () => tree.root.findByProps({ label: 'Nastavi sa izabranom porukom' }).props.onPress());
  expect(mockFind).toHaveBeenCalledWith('AGREEMENT_MESSAGE', R, expect.any(Object));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/podrska/novi', params: { contextKind: 'AGREEMENT_MESSAGE', contextId: R, contextRevision: '2' } });
  expect(JSON.stringify(mockPush.mock.calls)).not.toContain(previewText);
});
it.each(['cancel', 'blur/focus', 'ABA', 'changed text'] as const)('a selected message continuation is invalid after %s', async change => {
  previewText = 'Izabrana poruka'; await render(); await act(async () => press()());
  const retained = tree.root.findByProps({ label: 'Nastavi sa izabranom porukom' }).props.onPress;
  if (change === 'cancel') await act(async () => tree.root.findByProps({ label: 'Odustani od izbora poruke' }).props.onPress());
  else if (change === 'blur/focus') { mockFocused = false; await update(); mockFocused = true; await update(); }
  else { if (change === 'ABA') mockSession = { user: { id: A }, accountRevision: 3 }; else previewText = 'Druga prikazana poruka'; await update(); }
  await act(async () => retained()); expect(mockFind).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Panel' as React.ElementType)).toHaveLength(0);
});
