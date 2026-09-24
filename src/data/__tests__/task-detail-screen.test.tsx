import React from 'react';
// The public Task now shows the requester's photograph in the card that opens their profile, so
// this suite renders `publicPhoto` on every pass instead of only when the profile sheet is open.
jest.mock('../../ui/media/ContextPhotos', () => ({ NeedPhotos: 'NeedPhotos', ProfilePhoto: 'ProfilePhoto' }));
// PKG-047: the screen resolves a safety target through the production client; this suite is about the task detail,
// so the entry stays absent here and the client module is never loaded.
jest.mock('../../ui/safety/useSafetyEntry', () => ({ useSafetyEntry: () => undefined }));
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PrilikaProjekcija } from '../../contracts/projections';

let mockId: string | string[] | undefined = 'task-a';
let mockAccountId: string | undefined = 'account-a';
let mockEpoch = 1;
let mockAccountRevision = 1;
let mockIntent: 'uskocer' | 'narucilac' = 'uskocer';
let mockFocused = true;
import { taskRelationIndex } from '../taskRelation';
const mockLoad = jest.fn(), mockRelations = jest.fn();
// My relation to the task is read beside it, for this task alone (PKG-023b).
const mockSource = { prilika: mockLoad, odnosiPremaZadacima: mockRelations };
// The server answers about the ids it was asked and no others, so the double never does either.
const relatesAs = (...rows: { needId: string }[]) => async (ids: readonly string[]) =>
  taskRelationIndex(rows.filter(row => ids.includes(row.needId)), ids);
const owner = (needId: string) => ({ needId, relation: 'OWNER', applicationId: null, applicationState: null, agreementId: null });
const applicant = (needId: string, applicationState: string, agreementId: string | null = null) =>
  ({ needId, relation: 'APPLIED', applicationId: 'application-a', applicationState, agreementId });
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
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));

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
const back = () => tree!.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress();

beforeEach(() => {
  jest.clearAllMocks(); mockLoad.mockReset(); mockAppListeners.clear();
  mockRelations.mockReset().mockImplementation(relatesAs());
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
    const press = buttons('Pokušaj ponovo')[0].props.onPress;
    await act(async () => { press(); press(); }); expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Učitavamo zadatak');
    await act(async () => retry.resolve(detail()));
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(1);
  });

  it('shows where the job is as an approximate pin, and shows no map when there is no point', async () => {
    // Until 2026-09-20 the place was four words of text on the screen where a person decides
    // whether a job is near enough to take. The point is deliberately coarse; the exact address
    // belongs to the Dogovor, so `coarse` must stay on and the pin must not be draggable.
    mockLoad.mockResolvedValue({ ...detail(), priblizno: { lat: 45.2671, lng: 19.8335 } });
    await render();
    // V41 names the section "Mesto zadatka" (2026-09-23); it was "Gde je".
    expect(text()).toContain('Mesto zadatka');
    expect(text()).toContain('Približno područje. Tačna adresa se deli tek u Dogovoru.');
    const map = tree!.root.findByProps({ coarse: true });
    expect(map.props.position).toEqual({ latitude: 45.2671, longitude: 19.8335 });
    expect(map.props.disabled).toBe(true);

    await act(async () => { tree!.unmount(); }); tree = undefined;
    mockLoad.mockResolvedValue(detail());
    await render();
    expect(text()).not.toContain('Mesto zadatka');
    expect(tree!.root.findAllByProps({ coarse: true })).toHaveLength(0);
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
    await act(async () => buttons('Pokušaj ponovo')[0].props.onPress());
    expect(text()).not.toContain('Poslednji učitani podaci'); expect(buttons('Sastavi prijavu')).toHaveLength(1);
  });

  it('removes cached detail when a successful refresh says the row is unavailable', async () => {
    mockLoad.mockResolvedValueOnce(detail()).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));
    await render(); await act(async () => mockAppListeners.forEach(listener => listener('active')));
    expect(text()).toContain('Zadatak nije dostupan'); expect(text()).not.toContain('Zadatak task-a');
    await act(async () => buttons('Pokušaj ponovo')[0].props.onPress());
    expect(text()).not.toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(0);
  });

  it.each([false, undefined])('fails closed for task-level availability %s', async primaNovePrijave => {
    mockLoad.mockResolvedValue({ ...detail(), primaNovePrijave }); await render();
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(0);
    expect(text()).toContain('Nove prijave trenutno nisu dostupne');
  });

  // Owner step 5b (2026-09-24): when applying is not possible the screen says why, from what this route already read, and
  // leads back to the other tasks once, through the same navigation fence as every other press.
  it('says why applying is not possible from the facts it read, and leads back to Zadaci once', async () => {
    mockLoad.mockResolvedValue({ ...detail(), rokZaPrijaveIso: '2000-01-01T00:00:00Z' }); await render();
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
    expect(text()).toMatch(/Rok za prijave je prošao 1\. jan\.? 2000/); expect(text()).not.toContain('Prijave do');
    const other = buttons('Drugi zadaci')[0].props.onPress;
    await act(async () => { other(); other(); });
    expect(mockRouter.navigate.mock.calls).toEqual([['/zadaci']]);
    await act(async () => { tree?.unmount(); });
    mockLoad.mockResolvedValue({ ...detail(), primaNovePrijave: false, pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 } }); await render();
    expect(text()).toContain('Sva mesta su popunjena'); expect(text()).not.toContain('Rok za prijave');
    // An unreadable deadline is not named as one.
    await act(async () => { tree?.unmount(); });
    mockLoad.mockResolvedValue({ ...detail(), rokZaPrijaveIso: 'invalid' }); await render();
    expect(text()).toContain('Nove prijave trenutno nisu dostupne'); expect(text()).not.toContain('Rok za prijave');
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

  // Owner decision 1 (2026-09-19). Whether I may apply used to be decided by the mode of the app: in
  // the requester mode an open task told the person to go and change the mode in Profil. It is decided
  // by what I am to this task, read from my own tasks and my own applications.
  it('a flip of the retired app mode changes nothing: the task stays, and the application action still opens the composer', async () => {
    mockLoad.mockResolvedValue(detail());
    await render(); const oldPress = buttons('Sastavi prijavu')[0].props.onPress;
    mockIntent = 'narucilac'; await update();
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(1);
    await act(async () => oldPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/prilike/[id]/prijava', params: { id: 'task-a' } });
  });

  it('the same account opens its own task and then somebody else\u2019s, with no mode in between: one offers my view, the other an application', async () => {
    mockRelations.mockImplementation(relatesAs(owner('task-a'))); mockLoad.mockResolvedValue(detail());
    await render();
    expect(mockRelations).toHaveBeenCalledWith(['task-a']);
    expect(buttons('Sastavi prijavu')).toHaveLength(0); expect(text()).toContain('Ovo je tvoj zadatak.');
    await act(async () => buttons('Otvori svoj zadatak')[0].props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: 'task-a' } });
    await act(async () => { tree?.unmount(); });
    mockId = 'task-b'; mockLoad.mockResolvedValue(detail('task-b')); await render();
    expect(text()).not.toContain('Ovo je tvoj zadatak.'); expect(buttons('Sastavi prijavu')).toHaveLength(1);
  });

  it('a task I already applied to offers my application, and my Dogovor once I am chosen; never a second application', async () => {
    mockRelations.mockImplementation(relatesAs(applicant('task-a', 'SUBMITTED'))); mockLoad.mockResolvedValue(detail());
    await render(); expect(buttons('Sastavi prijavu')).toHaveLength(0);
    await act(async () => buttons('Pogledaj svoju prijavu')[0].props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'application-a' } });
    await act(async () => { tree?.unmount(); });
    mockRelations.mockImplementation(relatesAs(applicant('task-a', 'SELECTED', 'agreement-a'))); await render();
    await act(async () => buttons('Otvori Dogovor')[0].props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'agreement-a' } });
  });

  it('a relation that could not be read never becomes a licence to apply', async () => {
    mockRelations.mockRejectedValue(new Error('TASK_RELATIONS_READ_FAILED')); mockLoad.mockResolvedValue(detail());
    await render();
    expect(text()).toContain('Zadatak task-a'); expect(buttons('Sastavi prijavu')).toHaveLength(0); expect(buttons('Proveri ponovo')).toHaveLength(1);
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
    expect(mockRouter.replace.mock.calls).toEqual([['/zadaci']]);
  });

  it('keeps Back available while loading', async () => {
    mockLoad.mockReturnValue(new Promise(() => {})); await render();
    expect(text()).toContain('Učitavamo zadatak');
    expect(buttons('Sastavi prijavu')).toHaveLength(0);
    await act(async () => back()); expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('bounds a hanging read and ignores the expired result after explicit retry', async () => {
    jest.useFakeTimers();
    const old = deferred<PrilikaProjekcija>();
    mockLoad.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...detail(), naslov: 'Sveži Zadatak' });
    await render();
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(text()).toContain('Zadatak trenutno nije moguće učitati');
    await act(async () => buttons('Pokušaj ponovo')[0].props.onPress());
    expect(text()).toContain('Sveži Zadatak');
    await act(async () => old.resolve({ ...detail(), naslov: 'Istekli Zadatak' }));
    expect(text()).not.toContain('Istekli Zadatak');
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
