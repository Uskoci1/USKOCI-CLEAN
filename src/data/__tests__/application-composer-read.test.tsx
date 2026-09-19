import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockTask = jest.fn(), mockNeed = jest.fn(), mockProfile = jest.fn(), mockSubmit = jest.fn(), mockSelect = jest.fn(), mockCandidates = jest.fn(), mockApplications = jest.fn(), mockPublic = jest.fn();
const mockViewed = jest.fn();
const mockSource = { prilika: mockTask, potreba: mockNeed, mojRadnikProfil: mockProfile, podnesiPrijavu: mockSubmit,
  izaberiPrijavu: mockSelect, prijaveZaPotrebu: mockCandidates, mojePrijave: mockApplications, javniProfil: mockPublic, oznaciPrijavuVidjenom: mockViewed };
const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
let mockId: string | undefined = '10000000-0000-4000-8000-000000000001', mockFocused = true, mockRole = 'uskocer';
let mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    // Native virtualization is a boundary here; render its initial viewport.
    if (key === 'FlatList') return (props: any) => require('react').createElement('FlatList', props,
      props.ListHeaderComponent,
      ...(props.data.length ? props.data.slice(0, props.initialNumToRender).map((item: any, index: number) =>
        require('react').createElement(require('react').Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item, index }))) : [props.ListEmptyComponent]),
      props.ListFooterComponent);
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, useReducedMotion: () => true, FadeIn: { duration: () => ({}) } }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => mockRole, ulogaSada: () => mockRole }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', CalendarBlank: 'Icon' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }) } }));
import Composer from '../../app/(app)/prilike/[id]/prijava';
import Candidates from '../../app/(app)/potrebe/[id]/kandidati';
const need = () => ({ id: mockId, revizija: 3, naslov: 'Unos ormara', podrucjeTekst: 'Liman 2, Novi Sad', vremeTekst: '20. sept · 10–11h',
  stanje: 'CEKA_PRIJAVE', pokrivenost: { ukupno: 3, preostalo: 3, popunjeno: 0 }, rezimCene: 'OFFERS', taskTimezone: 'Europe/Belgrade',
  schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-20T08:00:00.123456Z', endsAt: '2026-09-20T09:00:00.654321Z' } });
const k = () => ({ prijavaId: '10000000-0000-4000-8000-000000000003', radnikProfilId: '10000000-0000-4000-8000-000000000002',
  potrebaRevizija: 3, verzija: 2, hash: 'a'.repeat(64), ime: 'Milan', inicijali: 'M', ocenaTekst: '—', recenzijeTekst: '0 završenih',
  cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, preostaloMesta: 3,
  dolazakTekst: '20. sept · 10h', prevozTekst: 'Kombi', napomena: 'Dolazimo sa trakama.', stanje: 'SELECTABLE', mozeIzabrati: true,
  predlozeniPocetak: '2026-09-20T08:00:00Z', predlozeniKraj: '2026-09-20T09:00:00Z',
  dokazPrijave: { sema: 'APPLICATION_V1_SELF_DECLARED', kapacitetTima: 2, vestine: ['Nošenje'], alati: ['Trake'], vozila: ['Kombi'], licence: [] }, razlogPreporuke: null });
const agreement = '10000000-0000-4000-8000-000000000004';
let tree: ReactTestRenderer | undefined, screen: React.ElementType = Composer;
const text = () => tree!.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const press = (label: string) => tree!.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0]?.props.onPress;
const tap = async (label: string) => { const fn = press(label); expect(fn).toBeDefined(); await act(async () => { fn(); }); };
const edit = async (label: string, value: string) => { await act(async () => {
  tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === label)[0].props.onChangeText(value);
}); };
const render = async (component = Composer) => { screen = component; await act(async () => { tree = create(React.createElement(screen)); }); };
const update = async () => { await act(async () => { tree!.update(React.createElement(screen)); }); };
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true; mockRole = 'uskocer'; mockId = '10000000-0000-4000-8000-000000000001';
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 }; mockRouter.canGoBack.mockReturnValue(true);
  mockNeed.mockResolvedValue(need()); mockTask.mockResolvedValue({ ...need(), primaNovePrijave: true, rokZaPrijaveIso: null });
  mockProfile.mockResolvedValue({ id: '10000000-0000-4000-8000-000000000002', stanje: 'ACTIVE' });
  mockCandidates.mockResolvedValue([k()]); mockApplications.mockResolvedValue([]);
  mockSubmit.mockResolvedValue({ ok: true, podatak: { prijavaId: k().prijavaId, verzija: 2, hash: k().hash } });
  mockSelect.mockResolvedValue({ ok: true, podatak: { dogovorId: agreement } }); mockPublic.mockResolvedValue(null);
  mockViewed.mockResolvedValue({ ok: true, podatak: null });
  mockStorage.clear();
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });
async function offer() { await render(); await edit('Ukupna cena za ljude koje dovodiš (RSD)', '4500'); await edit('Ljudi', '2'); }
async function selection() { mockRole = 'narucilac'; await render(Candidates); await tap('Pogledaj ponudu: Milan'); await tap('Pregledaj povezivanje'); }

it('rearms read and Retry after returning to the same retained tab', async () => {
  mockNeed.mockResolvedValue({ ...need(), naslov: 'Restored task' });
  mockTask.mockRejectedValueOnce(new Error('first outage')).mockRejectedValueOnce(new Error('second outage'))
    .mockResolvedValueOnce({ ...need(), naslov: 'Restored task', primaNovePrijave: true });
  await render(); await tap('Nazad na zadatak');
  mockFocused = false; await update(); expect(mockTask).toHaveBeenCalledTimes(1);
  mockFocused = true; await update(); expect(mockTask).toHaveBeenCalledTimes(2);
  expect(text()).toContain('Podatke za prijavu trenutno nije moguće učitati');
  const retry = press('Pokušaj ponovo'); await act(async () => { retry(); retry(); });
  expect(mockTask).toHaveBeenCalledTimes(3); expect(press('Pošalji ovu Prijavu')).toBeDefined();
  expect(text()).toContain('Restored task'); expect(mockSubmit).not.toHaveBeenCalled();
});
it('ignores a late blurred read and revalidates next focus', async () => {
  const d = deferred(); mockTask.mockReturnValueOnce(d.promise).mockRejectedValueOnce(new Error('current outage'));
  await render(); mockFocused = false; await update();
  await act(async () => d.resolve({ ...need(), naslov: 'Late private context' }));
  expect(text()).not.toContain('Late private context'); expect(press('Pošalji ovu Prijavu')).toBeUndefined();
  mockFocused = true; await update(); expect(mockTask).toHaveBeenCalledTimes(2);
  expect(text()).toContain('Podatke za prijavu trenutno nije moguće učitati'); expect(mockSubmit).not.toHaveBeenCalled();
});
it('recovers the actual composer from a rejected detail read without leaking errors or mutating', async () => {
  mockTask.mockRejectedValueOnce(new Error('private transport detail')).mockResolvedValueOnce({ ...need(), primaNovePrijave: true });
  await render(); expect(text()).toContain('Podatke za prijavu trenutno nije moguće učitati'); expect(text()).not.toContain('private');
  const retry = press('Pokušaj ponovo'); await act(async () => { retry(); retry(); });
  expect(mockTask).toHaveBeenCalledTimes(2); expect(press('Pošalji ovu Prijavu')).toBeDefined(); expect(mockSubmit).not.toHaveBeenCalled();
});
it('refuses a submission when the authoritative task gate says remaining search is closed', async () => {
  mockTask.mockResolvedValue({ ...need(), primaNovePrijave: false, rokZaPrijaveIso: null });
  await offer();
  const send = press('Pošalji ovu Prijavu'); expect(send).toBeDefined();
  await act(async () => { send(); });
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(text()).toContain('Proveri aktuelni Zadatak i aktivan radni profil.');
});
it('treats the closed remaining search server rejection as a known refusal that can be reset after refresh', async () => {
  mockSubmit.mockResolvedValue({ ok: false, kod: 'NEED_REMAINING_SEARCH_CLOSED', poruka: 'Zadatak više ne prima nove prijave. Osveži Zadatak.' });
  await offer(); await tap('Pošalji ovu Prijavu');
  expect(mockSubmit).toHaveBeenCalledTimes(1); expect(text()).toContain('Zadatak više ne prima nove prijave');
  await tap('Proveri ishod');
  expect(press('Pregledaj uslove i uredi novu ponudu')).toBeDefined(); expect(mockSubmit).toHaveBeenCalledTimes(1);
});
it('shows successful unavailability and a single real detail fallback navigation', async () => {
  mockTask.mockResolvedValue(null); mockRouter.canGoBack.mockReturnValue(false); await render();
  expect(text()).toContain('Podaci za prijavu nisu dostupni'); expect(press('Pošalji ovu Prijavu')).toBeUndefined();
  const back = press('Nazad na zadatak'); await act(async () => { back(); back(); });
  expect(mockRouter.replace.mock.calls).toEqual([[{ pathname: '/prilike/[id]', params: { id: mockId } }]]);
});
it('keeps Back usable while read is unfinished', async () => {
  mockTask.mockReturnValue(new Promise(() => {})); await render(); await tap('Nazad na zadatak');
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockSubmit).not.toHaveBeenCalled();
});
it('does not start an invalid route read or remain loading', async () => {
  mockId = undefined; await render(); expect(mockTask).not.toHaveBeenCalled();
  expect(text()).toContain('Podaci za prijavu nisu dostupni'); expect(text()).not.toContain('Učitavamo');
});
describe('PKG-006 durable application command identity (GAP-0031)', () => {
  const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default as { setItem: jest.Mock; removeItem: jest.Mock };
  const JOURNAL = () => `uskoci.application.command.v1.owner-a.${mockId}`;
  const unconfirmed = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' };
  const field = (label: string) => tree!.root.findAll(node => String(node.type) === 'TextInput' && node.props.accessibilityLabel === label)[0].props;
  const remount = async () => { await act(async () => tree?.unmount()); tree = undefined; await render(); };
  it('a lost ACK survives a route remount: the original command is restored, never resent automatically, retried with the same key and payload, and cleared on the receipt', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await tap('Pošalji ovu Prijavu');
    const original = mockSubmit.mock.calls[0][0];
    expect([...mockStorage.keys()]).toEqual([JOURNAL()]);
    expect(mockStorage.get(JOURNAL())).not.toMatch(/Milan|4\.500|Unos ormara/);
    expect(AsyncStorage.setItem.mock.invocationCallOrder[0]).toBeLessThan(mockSubmit.mock.invocationCallOrder[0]);
    await remount();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(press('Ponovi istu Prijavu')).toBeDefined(); expect(press('Pošalji ovu Prijavu')).toBeUndefined();
    expect(text()).toContain('Sačuvana je ista ponuda za proveru ishoda');
    expect(field('Ukupna cena za ljude koje dovodiš (RSD)').value).toBe('4500'); expect(field('Ljudi').value).toBe('2'); expect(field('Ljudi').editable).toBe(false);
    await tap('Ponovi istu Prijavu');
    expect(mockSubmit).toHaveBeenCalledTimes(2); expect(mockSubmit.mock.calls[1][0]).toEqual(original);
    expect(mockSubmit.mock.calls[1][0].clientRequestId).toBe(original.clientRequestId);
    expect(text()).toContain('Prijava je poslata.'); expect(mockStorage.size).toBe(0);
    await remount();
    expect(press('Pošalji ovu Prijavu')).toBeDefined(); expect(press('Ponovi istu Prijavu')).toBeUndefined();
  });
  it('the identity is journaled before the send; a storage failure prevents the send and keeps the composer editable', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full details'));
    await offer(); await tap('Pošalji ovu Prijavu');
    expect(mockSubmit).not.toHaveBeenCalled(); expect(text()).toContain('nije sačuvan na uređaju'); expect(text()).not.toContain('disk full details');
    expect(press('Pošalji ovu Prijavu')).toBeDefined(); expect(field('Ljudi').editable).toBe(true);
    await tap('Pošalji ovu Prijavu');
    expect(mockSubmit).toHaveBeenCalledTimes(1); expect(text()).toContain('Prijava je poslata.');
  });
  it('another account cannot see or erase the pending command; the same account restores it after a later incarnation', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await tap('Pošalji ovu Prijavu');
    const key = JOURNAL();
    mockAccount = { user: { id: 'owner-b' }, accountRevision: 1 };
    await remount();
    expect(press('Ponovi istu Prijavu')).toBeUndefined(); expect(press('Pošalji ovu Prijavu')).toBeDefined();
    expect(mockStorage.has(key)).toBe(true); expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 };
    await remount();
    expect(press('Ponovi istu Prijavu')).toBeDefined(); expect(mockSubmit).toHaveBeenCalledTimes(1);
  });
  it('a journal read that lands after an account change is not applied', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await tap('Pošalji ovu Prijavu');
    const held = deferred();
    const AsyncStorageMock = jest.requireMock('@react-native-async-storage/async-storage').default as { getItem: jest.Mock };
    AsyncStorageMock.getItem.mockReturnValueOnce(held.promise);
    await act(async () => tree?.unmount()); tree = undefined;
    await act(async () => { tree = create(React.createElement(Composer)); });
    mockAccount = { user: { id: 'owner-b' }, accountRevision: 1 };
    await act(async () => { tree!.update(React.createElement(Composer)); held.resolve(mockStorage.get(JOURNAL()) ?? null); });
    expect(press('Ponovi istu Prijavu')).toBeUndefined(); expect(mockSubmit).toHaveBeenCalledTimes(1);
  });
  it('a corrupt journal value is discarded without stranding the composer', async () => {
    mockStorage.set(JOURNAL(), '{"version":1,"accountId":"owner-a","needId":"garbage"}');
    await render();
    expect(press('Ponovi istu Prijavu')).toBeUndefined(); expect(AsyncStorage.removeItem).toHaveBeenCalledWith(JOURNAL());
    expect(text()).toContain('nije čitljiv');
    await edit('Ukupna cena za ljude koje dovodiš (RSD)', '4500'); await edit('Ljudi', '2'); await tap('Pošalji ovu Prijavu');
    expect(mockSubmit).toHaveBeenCalledTimes(1); expect(text()).toContain('Prijava je poslata.');
  });
  it('a known refusal of the retried command permits a reset that clears the journal; an unknown outcome keeps it', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await tap('Pošalji ovu Prijavu');
    await remount();
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await tap('Ponovi istu Prijavu');
    expect(mockStorage.has(JOURNAL())).toBe(true); expect(press('Pregledaj uslove i uredi novu ponudu')).toBeUndefined();
    await tap('Proveri ishod');
    mockSubmit.mockResolvedValueOnce({ ok: false, kod: 'NEED_REVISION_MISMATCH', poruka: 'Zadatak je promenjen.' });
    await tap('Ponovi istu Prijavu');
    expect(text()).toContain('Zadatak je promenjen'); expect(mockStorage.has(JOURNAL())).toBe(true);
    // The reset appears only after an explicit readback, exactly as for any known refusal.
    expect(press('Pregledaj uslove i uredi novu ponudu')).toBeUndefined();
    await tap('Proveri ishod'); expect(mockStorage.has(JOURNAL())).toBe(true);
    await tap('Pregledaj uslove i uredi novu ponudu');
    expect(mockStorage.size).toBe(0); expect(press('Pošalji ovu Prijavu')).toBeDefined();
  });
  it('a malformed receipt from the retried command stays unconfirmed and keeps the journal', async () => {
    mockSubmit.mockResolvedValueOnce(unconfirmed);
    await offer(); await tap('Pošalji ovu Prijavu');
    await remount();
    mockSubmit.mockResolvedValueOnce({ ok: false, kod: 'APPLICATION_SELECTION_INVALID_RECEIPT', poruka: 'Server nije vratio potpunu potvrdu radnje.' });
    await tap('Ponovi istu Prijavu');
    expect(text()).not.toContain('Prijava je poslata.'); expect(mockStorage.has(JOURNAL())).toBe(true);
    expect(press('Proveri ishod')).toBeDefined(); expect(press('Pregledaj uslove i uredi novu ponudu')).toBeUndefined();
  });
});
