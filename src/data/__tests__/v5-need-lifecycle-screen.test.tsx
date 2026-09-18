import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PotrebaProjekcija } from '../../contracts/projections';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', N = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mockSession = { user: { id: A }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
let mockForeground = 'active';
const mockListeners = new Set<(state: string) => void>();
const mockStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
const mockService = { cancelNeed: jest.fn(), deleteDraftNeed: jest.fn(), readCommandReceipt: jest.fn() };
const mockSource = { mojePotrebe: jest.fn() }, mockReplace = jest.fn(), mockPush = jest.fn(), mockActive = jest.fn(), mockRefresh = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...args: unknown[]) => mockStorage.getItem(...args), setItem: (...args: unknown[]) => mockStorage.setItem(...args),
  removeItem: (...args: unknown[]) => mockStorage.removeItem(...args),
} }));
jest.mock('../needLifecycleClientService', () => ({ needLifecycleClientService: {
  cancelNeed: (...args: unknown[]) => mockService.cancelNeed(...args), deleteDraftNeed: (...args: unknown[]) => mockService.deleteDraftNeed(...args),
  readCommandReceipt: (...args: unknown[]) => mockService.readCommandReceipt(...args),
} }));
jest.mock('../supabaseClient', () => ({ supabase: {} }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent, useIzvor: () => mockSource }));
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'View') return 'View';
  if (key === 'AppState') return { get currentState() { return mockForeground; }, addEventListener: (_name: string, listener: (state: string) => void) => {
    mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
  } };
  return Reflect.get(target, key);
} }); });
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { NeedLifecycleActions } from '../../ui/needs/NeedLifecycleActions';
let tree: ReactTestRenderer, need: PotrebaProjekcija, disabled = false;
const command = { needId: N, expectedRevision: 3, action: 'DELETE_DRAFT', reason: '' };
const receipt = { needId: N, revision: 3, deleted: true, idempotentReplay: false };
const success = { ok: true, podatak: receipt }, unknown = { ok: false, kod: 'UNKNOWN_OUTCOME', poruka: 'Ishod nije potvrđen.' };
const page = () => <NeedLifecycleActions need={need} disabled={disabled} onActiveChange={mockActive} onRefresh={mockRefresh} />;
const render = async () => { await act(async () => { tree = create(page()); }); };
const action = (label: string) => tree.root.findByProps({ label }).props;
const tap = async (label: string) => { await act(async () => action(label).onPress()); };
const refresh = async () => { await act(async () => tree.update(page())); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  jest.clearAllMocks(); for (const group of [mockStorage, mockService, mockSource]) for (const fn of Object.values(group)) fn.mockReset();
  mockSession = { user: { id: A }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockForeground = 'active'; disabled = false;
  need = { id: N, revizija: 3, stanje: 'NACRT', naslov: 'Pregledani zadatak', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2 } } as PotrebaProjekcija;
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined); mockStorage.removeItem.mockResolvedValue(undefined);
  mockService.deleteDraftNeed.mockResolvedValue(success); mockService.cancelNeed.mockResolvedValue({ ok: true, podatak: { needId: N, revision: 3, status: 'CANCELLED', affectedResponses: 2, idempotentReplay: false } });
  mockService.readCommandReceipt.mockResolvedValue({ ok: true, podatak: { state: 'NOT_CONFIRMED' } }); mockSource.mojePotrebe.mockResolvedValue([]);
});
afterEach(async () => { await act(async () => tree?.unmount()); mockListeners.clear(); });
it('reviews consequences, persists the frozen identity first and deduplicates retained final taps', async () => {
  await render(); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled(); await tap('Obriši nacrt');
  const wait = deferred<void>(); mockStorage.setItem.mockReturnValue(wait.promise); const send = action('Obriši nacrt').onPress;
  await act(async () => { send(); send(); }); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled();
  expect(JSON.parse(mockStorage.setItem.mock.calls[0][1])).toEqual(command);
  await act(async () => wait.resolve()); expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1); expect(mockService.deleteDraftNeed).toHaveBeenCalledWith(N, 3, '');
  expect(mockSource.mojePotrebe).toHaveBeenCalledTimes(1); expect(action('Moji zadaci')).toBeDefined(); expect(mockReplace).not.toHaveBeenCalled();
  await tap('Moji zadaci'); expect(mockStorage.removeItem).toHaveBeenCalledTimes(1); expect(mockReplace).toHaveBeenCalledWith('/potrebe');
});
it('keeps cancellation separate from deleting a published Task', async () => {
  need = { ...need, stanje: 'OBJAVLJENA' }; await render();
  expect(tree.root.findAllByProps({ label: 'Obriši nacrt' })).toHaveLength(0);
  await tap('Otkazivanje zadatka'); await tap('Otkaži zadatak');
  expect(mockService.cancelNeed).toHaveBeenCalledWith(N, 3, ''); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled();
});
it('offers the existing Agreement path when places are already agreed', async () => {
  need = { ...need, pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } }; await render();
  expect(tree.root.findAllByProps({ label: 'Otkazivanje zadatka' })).toHaveLength(0);
  await tap('Otvori moje Dogovore'); expect(mockPush).toHaveBeenCalledWith('/dogovori');
  expect(mockService.cancelNeed).not.toHaveBeenCalled();
});
it('does not send after choosing Odustani or while another route action is busy', async () => {
  await render(); await tap('Obriši nacrt'); const retained = action('Obriši nacrt').onPress;
  disabled = true; await refresh(); await act(async () => retained()); expect(mockStorage.setItem).not.toHaveBeenCalled();
  disabled = false; await refresh(); await tap('Odustani'); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled();
});
it('storage failure cannot become an untracked destructive command', async () => {
  mockStorage.setItem.mockRejectedValue(new Error('DISK_FULL')); await render(); await tap('Obriši nacrt'); await tap('Obriši nacrt');
  expect(mockService.deleteDraftNeed).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
it('retires confirmation after Odustani and does not let an old cancel discard an unknown command', async () => {
  await render(); await tap('Obriši nacrt'); const oldSend = action('Obriši nacrt').onPress;
  await tap('Odustani'); await act(async () => oldSend()); expect(mockStorage.setItem).not.toHaveBeenCalled();
  await tap('Obriši nacrt'); const oldCancel = action('Odustani').onPress;
  mockService.deleteDraftNeed.mockResolvedValue(unknown); await tap('Obriši nacrt'); await act(async () => oldCancel());
  expect(action('Proveri ishod')).toBeDefined(); expect(tree.root.findAllByProps({ label: 'Obriši nacrt' })).toHaveLength(0);
});
it('unknown command requires successful readback before an explicit identical retry', async () => {
  mockService.deleteDraftNeed.mockResolvedValueOnce(unknown); await render(); await tap('Obriši nacrt'); await tap('Obriši nacrt');
  expect(action('Ponovi isti zahtev').disabled).toBe(true); await tap('Ponovi isti zahtev'); expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1);
  await tap('Proveri ishod'); expect(mockService.readCommandReceipt).toHaveBeenCalledWith(command);
  expect(action('Ponovi isti zahtev').disabled).toBe(false); expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1);
  await tap('Ponovi isti zahtev'); expect(mockService.deleteDraftNeed.mock.calls).toEqual([[N, 3, ''], [N, 3, '']]);
});
it('failed readback never licenses retry and missing list rows do not prove deletion', async () => {
  mockService.deleteDraftNeed.mockResolvedValue(unknown); mockService.readCommandReceipt.mockResolvedValue({ ok: false, kod: 'READ_FAILED', poruka: 'Nedostupno.' });
  await render(); await tap('Obriši nacrt'); await tap('Obriši nacrt'); await tap('Proveri ishod'); await tap('Ponovi isti zahtev');
  expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1); expect(mockSource.mojePotrebe).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ label: 'Moji zadaci' })).toHaveLength(0);
});
it('restores opaque command after recreation with a read only, even if current Need revision changed', async () => {
  need = { ...need, revizija: 4 }; mockStorage.getItem.mockResolvedValue(JSON.stringify(command));
  mockService.readCommandReceipt.mockResolvedValue({ ok: true, podatak: { state: 'CONFIRMED', confirmation: { action: 'DELETE_DRAFT', receipt: { ...receipt, idempotentReplay: true } } } });
  await render(); expect(mockService.readCommandReceipt).toHaveBeenCalledWith(command);
  expect(mockService.deleteDraftNeed).not.toHaveBeenCalled(); expect(action('Moji zadaci')).toBeDefined();
});
it.each(['corrupt', JSON.stringify({ ...command, needId: A }), JSON.stringify({ ...command, reason: 'private reason' })])(
  'corrupt or cross-Task restore stays fail closed: %s', async raw => {
    mockStorage.getItem.mockResolvedValue(raw); await render(); expect(action('Ponovo proveri prethodni zahtev')).toBeDefined();
    expect(mockService.readCommandReceipt).not.toHaveBeenCalled(); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ label: 'Obriši nacrt' })).toHaveLength(0);
  });
it('server stale rejection needs a fresh review and cannot force replay', async () => {
  mockService.deleteDraftNeed.mockResolvedValue({ ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: 'Osveži zadatak.' });
  await render(); await tap('Obriši nacrt'); await tap('Obriši nacrt');
  expect(tree.root.findAllByProps({ label: 'Ponovi isti zahtev' })).toHaveLength(0); await tap('Učitaj aktuelni zadatak');
  expect(mockRefresh).toHaveBeenCalledTimes(1); expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1);
});
it.each(['blur', 'account', 'background'])('fences pending persistence and retained handlers after %s', async change => {
  const wait = deferred<void>(); mockStorage.setItem.mockReturnValue(wait.promise);
  await render(); await tap('Obriši nacrt'); const send = action('Obriši nacrt').onPress; await act(async () => send());
  if (change === 'blur') { mockFocused = false; await refresh(); }
  else if (change === 'account') { mockSession = { user: { id: N }, accountRevision: 2 }; await refresh(); }
  else { await act(async () => { mockForeground = 'background'; for (const listener of mockListeners) listener('background'); }); }
  await act(async () => { wait.resolve(); send(); }); expect(mockService.deleteDraftNeed).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
it('late receipt after blur cannot refresh collection or navigate; refocus restores via readback', async () => {
  const wait = deferred<typeof success>(); mockService.deleteDraftNeed.mockReturnValue(wait.promise);
  await render(); await tap('Obriši nacrt'); await tap('Obriši nacrt'); mockFocused = false; await refresh();
  await act(async () => wait.resolve(success)); expect(mockSource.mojePotrebe).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
  mockStorage.getItem.mockResolvedValue(JSON.stringify(command)); mockFocused = true; await refresh();
  expect(mockService.readCommandReceipt).toHaveBeenCalledWith(command); expect(mockService.deleteDraftNeed).toHaveBeenCalledTimes(1);
});
it('retained final callback cannot accept an unseen newer Need revision', async () => {
  await render(); await tap('Obriši nacrt'); const send = action('Obriši nacrt').onPress;
  need = { ...need, revizija: 4 }; await refresh(); await act(async () => send()); expect(mockStorage.setItem).not.toHaveBeenCalled();
});
