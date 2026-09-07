import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PrilikaProjekcija } from '../../contracts/projections';

let mockId: string | string[] | undefined = 'task-a';
let mockAccountId: string | undefined = 'account-a';
let mockEpoch = 1;
let mockAccountRevision = 1;
let mockIntent: 'uskocer' | 'narucilac' = 'uskocer';
let mockFocused = true;
const mockLoad = jest.fn();
const mockSource = { prilika: mockLoad };
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockAppListeners = new Set<(value: string) => void>();

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AppState') return { addEventListener: (_event: string, callback: (value: string) => void) => {
      mockAppListeners.add(callback); return { remove: () => mockAppListeners.delete(callback) };
    } };
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon' }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: mockAccountId ? { id: mockAccountId } : null, sessionEpoch: mockEpoch, accountRevision: mockAccountRevision }),
  sesijaSada: () => ({ user: mockAccountId ? { id: mockAccountId } : null, sessionEpoch: mockEpoch, accountRevision: mockAccountRevision }),
}));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent, useIzvor: () => mockSource }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button', Card: 'Card' }));

import Detail from '../../app/(app)/prilike/[id]';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const detail = (id = 'task-a'): PrilikaProjekcija => ({
  id, naslov: `Zadatak ${id}`, statusTekst: 'Traži ponude', primaNovePrijave: true, rokZaPrijaveIso: null, podrucjeTekst: 'Centar, Novi Sad', vremeTekst: 'Fleksibilno',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: ['Alat'],
  narucilacProfilId: 'requester-a', narucilacIme: '', narucilacOcena: null, priblizno: null,
});
let tree: ReactTestRenderer | undefined;
async function render() { await act(async () => { tree = create(<Detail />); }); }
async function update() { await act(async () => { tree!.update(<Detail />); }); }
const text = () => tree!.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const buttons = (label: string) => tree!.root.findAllByProps({ label });
const back = () => tree!.root.findByProps({ accessibilityLabel: 'Nazad na Zadatke' }).props.onPress();

beforeEach(() => {
  jest.clearAllMocks(); mockLoad.mockReset(); mockAppListeners.clear();
  mockId = 'task-a'; mockAccountId = 'account-a'; mockEpoch = 1; mockAccountRevision = 1; mockIntent = 'uskocer'; mockFocused = true;
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); tree = undefined; jest.useRealTimers(); });

describe('W04 actual screen and focused read lifecycle', () => {
  it('shows recoverable read failure without transport details and serializes retry taps', async () => {
    const retry = deferred<PrilikaProjekcija>();
    mockLoad.mockRejectedValueOnce(new Error('secret transport internals')).mockReturnValueOnce(retry.promise);
    await render();
    expect(text()).toContain('Zadatak trenutno nije moguće učitati'); expect(text()).not.toContain('secret');
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
    const press = buttons('Pokušajte ponovo')[0].props.onPress;
    await act(async () => { press(); press(); }); expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Učitavamo zadatak');
    await act(async () => retry.resolve(detail()));
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(1);
  });

  it('opens the real composer once and never submits directly', async () => {
    mockLoad.mockResolvedValue(detail()); await render();
    const press = buttons('Sastavi prijavu')[0].props.onPress;
    await act(async () => { press(); press(); });
    expect(mockRouter.navigate.mock.calls).toEqual([[{ pathname: '/prilike/[id]/prijava', params: { id: 'task-a' } }]]);
  });

  it('retains only marked display data after a failed foreground refresh and invalidates old presses immediately', async () => {
    const refresh = deferred<PrilikaProjekcija>();
    mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(refresh.promise).mockResolvedValueOnce(detail());
    await render(); const stalePress = buttons('Sastavi prijavu')[0].props.onPress;
    await act(async () => { mockAppListeners.forEach(listener => listener('active')); stalePress(); });
    expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(buttons('Sastavi prijavu')).toHaveLength(0);
    expect(text()).toContain('Zadatak task-a'); expect(text()).toContain('Poslednji učitani podaci');
    await act(async () => refresh.reject(new Error('offline')));
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(0);
    await act(async () => buttons('Pokušajte ponovo')[0].props.onPress());
    expect(text()).not.toContain('Poslednji učitani podaci'); expect(buttons('Sastavi prijavu')).toHaveLength(1);
  });

  it('removes cached detail when a successful refresh says the row is unavailable', async () => {
    mockLoad.mockResolvedValueOnce(detail()).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));
    await render(); await act(async () => mockAppListeners.forEach(listener => listener('active')));
    expect(text()).toContain('Zadatak nije dostupan'); expect(text()).not.toContain('Zadatak task-a');
    await act(async () => buttons('Pokušajte ponovo')[0].props.onPress());
    expect(text()).not.toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(0);
  });

  it.each([false, undefined])('fails closed for task-level availability %s', async primaNovePrijave => {
    mockLoad.mockResolvedValue({ ...detail(), primaNovePrijave }); await render();
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(0);
    expect(text()).toContain('Nove prijave trenutno nisu dostupne');
  });

  it.each([undefined, 'invalid', '2000-01-01T00:00:00Z'])('never offers the composer for unknown/expired deadline %s', async rokZaPrijaveIso => {
    mockLoad.mockResolvedValue({ ...detail(), rokZaPrijaveIso }); await render();
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
  });

  it('expires the visible CTA without a network call and rejects a press before the timer paints', async () => {
    jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-07T12:00:00Z'));
    mockLoad.mockResolvedValue({ ...detail(), rokZaPrijaveIso: '2026-09-07T12:00:10Z' });
    await render(); const press = buttons('Sastavi prijavu')[0].props.onPress;
    jest.setSystemTime(new Date('2026-09-07T12:00:10Z'));
    await act(async () => press()); expect(mockRouter.navigate).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(10_000));
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('rejects a response that does not match the requested task', async () => {
    mockLoad.mockResolvedValue(detail('other-task')); await render();
    expect(text()).toContain('Zadatak nije dostupan'); expect(text()).not.toContain('other-task');
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
  });

  it('clears displayed A detail on id change and rejects A handlers', async () => {
    const b = deferred<PrilikaProjekcija>(); mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(b.promise);
    await render(); const oldPress = buttons('Sastavi prijavu')[0].props.onPress;
    mockId = 'task-b'; await update();
    expect(text()).not.toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(0);
    await act(async () => oldPress()); expect(mockRouter.navigate).not.toHaveBeenCalled();
    await act(async () => b.resolve(detail('task-b'))); expect(text()).toContain('Zadatak task-b');
  });

  it('invalidates a pending account A read when B signs in, even if A completes later', async () => {
    const a = deferred<PrilikaProjekcija>(); const b = deferred<PrilikaProjekcija>();
    mockLoad.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise); await render();
    mockAccountId = 'account-b'; mockEpoch++; await update();
    await act(async () => b.resolve({ ...detail(), naslov: 'Podaci za B' }));
    await act(async () => a.resolve({ ...detail(), naslov: 'Podaci za A' }));
    expect(text()).toContain('Podaci za B'); expect(text()).not.toContain('Podaci za A');
  });

  it('rejects the previous A read and press after A→B→A without rendering B', async () => {
    const oldRead = deferred<PrilikaProjekcija>();
    const currentRead = deferred<PrilikaProjekcija>();
    mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(currentRead.promise);
    await render(); const oldPress = buttons('Sastavi prijavu')[0].props.onPress;
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    mockAccountId = 'account-b'; mockEpoch++; mockAccountRevision++;
    mockAccountId = 'account-a'; mockEpoch++; mockAccountRevision++;
    await act(async () => oldPress());
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await update();
    await act(async () => oldRead.resolve({ ...detail(), naslov: 'Prethodna sesija A' }));
    expect(text()).not.toContain('Prethodna sesija A');
    expect(text()).not.toContain('Zadatak task-a');
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
    await act(async () => currentRead.resolve({ ...detail(), naslov: 'Nova sesija A' }));
    expect(text()).toContain('Nova sesija A');
    expect(buttons('Sastavi prijavu')).toHaveLength(1);
  });

  it('conservatively rereads W04 after same-account token refresh while identity revision stays stable', async () => {
    const refresh = deferred<PrilikaProjekcija>();
    mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(refresh.promise);
    await render(); const oldPress = buttons('Sastavi prijavu')[0].props.onPress;
    mockEpoch++;
    await act(async () => oldPress());
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await update();
    expect(mockAccountRevision).toBe(1);
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('Zadatak task-a');
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
    await act(async () => refresh.resolve(detail()));
    expect(buttons('Sastavi prijavu')).toHaveLength(1);
  });

  it('blocks pre-render account changes and clears the display cache for a new session', async () => {
    mockLoad.mockResolvedValueOnce(detail()).mockRejectedValueOnce(new Error('offline'));
    await render(); const oldPress = buttons('Sastavi prijavu')[0].props.onPress;
    mockAccountId = 'account-b'; mockEpoch++;
    await act(async () => { oldPress(); back(); });
    expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
    await update(); expect(text()).not.toContain('Zadatak task-a');
  });

  it('does not reuse a detail or press across logout and a new session for the same account', async () => {
    mockLoad.mockResolvedValueOnce(detail()).mockRejectedValueOnce(new Error('offline'));
    await render(); const oldPress = buttons('Sastavi prijavu')[0].props.onPress;
    mockAccountId = undefined; mockEpoch++;
    await act(async () => oldPress()); expect(mockRouter.navigate).not.toHaveBeenCalled();
    await update(); expect(text()).not.toContain('Zadatak task-a');
    mockAccountId = 'account-a'; mockEpoch++; await update();
    expect(text()).not.toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(0);
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  it('drops cache and application action when intent changes during a read', async () => {
    const late = deferred<PrilikaProjekcija>();
    mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(late.promise).mockRejectedValueOnce(new Error('offline'));
    await render(); const oldPress = buttons('Sastavi prijavu')[0].props.onPress;
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    mockIntent = 'narucilac'; await update();
    await act(async () => { oldPress(); late.resolve(detail()); });
    expect(text()).not.toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(0);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('invalidates reads and actions on blur and rereads on focus', async () => {
    const late = deferred<PrilikaProjekcija>();
    mockLoad.mockResolvedValueOnce(detail()).mockReturnValueOnce(late.promise).mockResolvedValueOnce({ ...detail(), naslov: 'Sveži podaci' });
    await render(); const oldPress = buttons('Sastavi prijavu')[0].props.onPress;
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    mockFocused = false; await update(); await act(async () => { oldPress(); late.resolve({ ...detail(), naslov: 'Kasni podaci' }); });
    expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(text()).not.toContain('Kasni podaci');
    expect(mockAppListeners.size).toBe(0);
    mockFocused = true; await update(); expect(text()).toContain('Sveži podaci');
    expect(buttons('Sastavi prijavu')).toHaveLength(1);
  });
  it('makes a successful unavailable read finite, with Back and retry but no application action', async () => {
    mockLoad.mockResolvedValue(null); await render();
    expect(text()).toContain('Zadatak nije dostupan');
    expect(text()).not.toContain('Učitavam');
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
    await act(async () => back());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('keeps a malformed route unavailable without querying and falls back to W03', async () => {
    mockId = ['task-a', 'task-b']; mockRouter.canGoBack.mockReturnValue(false); await render();
    expect(mockLoad).not.toHaveBeenCalled(); expect(text()).toContain('Zadatak nije dostupan');
    await act(async () => { back(); back(); });
    expect(mockRouter.replace.mock.calls).toEqual([['/prilike']]);
  });

  it('keeps Back available while loading', async () => {
    mockLoad.mockReturnValue(new Promise(() => {})); await render();
    expect(text()).toContain('Učitavamo zadatak');
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
    await act(async () => back()); expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('clears task A immediately on id B and ignores A finishing after B', async () => {
    const a = deferred<PrilikaProjekcija>(); const b = deferred<PrilikaProjekcija>();
    mockLoad.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise); await render();
    mockId = 'task-b'; await update();
    await act(async () => b.resolve(detail('task-b')));
    expect(text()).toContain('Zadatak task-b');
    await act(async () => a.resolve(detail()));
    expect(text()).not.toContain('Zadatak task-a'); expect(mockLoad.mock.calls).toEqual([['task-a'], ['task-b']]);
  });
});
