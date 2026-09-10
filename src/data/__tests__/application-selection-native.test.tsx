import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockTask = jest.fn(), mockNeed = jest.fn(), mockProfile = jest.fn(), mockSubmit = jest.fn(), mockSelect = jest.fn(), mockCandidates = jest.fn(), mockApplications = jest.fn(), mockPublic = jest.fn();
const mockSource = { prilika: mockTask, potreba: mockNeed, mojRadnikProfil: mockProfile, podnesiPrijavu: mockSubmit,
  izaberiPrijavu: mockSelect, prijaveZaPotrebu: mockCandidates, mojePrijave: mockApplications, javniProfil: mockPublic };
const mockLinkQuery = jest.fn();
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
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({
  from: () => { const builder = { select: () => builder, eq: () => builder, maybeSingle: mockLinkQuery }; return builder; },
}) }));
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
  mockLinkQuery.mockResolvedValue({ data: null, error: null });
  mockSelect.mockResolvedValue({ ok: true, podatak: { dogovorId: agreement } }); mockPublic.mockResolvedValue(null);
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });
async function offer() { await render(); await edit('Cena za ponuđeni obim (RSD)', '4500'); await edit('Ljudi', '2'); }
async function selection() { mockRole = 'narucilac'; await render(Candidates); await tap('Pogledaj ponudu: Milan'); await tap('Pregledaj povezivanje'); }

it('sends one exact application after explicit interval review and duplicate taps', async () => {
  await offer(); await tap('Termin Prijave');
  await edit('Datum početka', '2026-09-20'); await edit('Početak', '12:00');
  await edit('Datum kraja', '2026-09-20'); await edit('Kraj', '13:00'); await tap('Potvrdi termin');
  expect(mockSubmit).not.toHaveBeenCalled(); expect(text()).toContain('12:00–13:00');
  const send = press('Pošalji ovu Prijavu'); await act(async () => { send(); send(); });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit.mock.calls[0][0]).toMatchObject({ potrebaRevizija: 3, pokrivenaMesta: 2, cenaRsd: 4500,
    predlozeniPocetak: '2026-09-20T10:00:00.000Z', predlozeniKraj: '2026-09-20T11:00:00.000Z' });
  expect(text()).toContain('Prijava je poslata.'); expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('keeps offered price total and rejects trailing garbage or overfill', async () => {
  await offer(); expect(text()).toContain('Ne deli se automatski na osobe');
  await edit('Cena za ponuđeni obim (RSD)', '4500abc'); await tap('Pošalji ovu Prijavu');
  expect(mockSubmit).not.toHaveBeenCalled();
  await edit('Cena za ponuđeni obim (RSD)', '4500'); await edit('Ljudi', '4'); await tap('Pošalji ovu Prijavu');
  expect(mockSubmit).not.toHaveBeenCalled();
});
it('unknown submit requires readback; absence never unlocks changed fields and exact original request retries', async () => {
  mockSubmit.mockResolvedValueOnce({ ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
  await offer(); const oldSend = press('Pošalji ovu Prijavu'); await tap('Pošalji ovu Prijavu');
  await act(async () => { oldSend(); }); expect(mockSubmit).toHaveBeenCalledTimes(1);
  await edit('Cena za ponuđeni obim (RSD)', '9999');
  mockNeed.mockResolvedValue({ ...need(), revizija: 4 }); await tap('Proverite ishod');
  expect(mockApplications).toHaveBeenCalledTimes(2); expect(mockSubmit).toHaveBeenCalledTimes(1);
  await tap('Ponovi istu Prijavu'); expect(mockSubmit.mock.calls[1][0]).toEqual(mockSubmit.mock.calls[0][0]);
  expect(mockSubmit.mock.calls[1][0].cenaRsd).toBe(4500); expect(mockSubmit.mock.calls[1][0].potrebaRevizija).toBe(3);
});
it('late application response after blur cannot navigate and in-flight request remains fenced on refocus', async () => {
  const d = deferred(); mockSubmit.mockReturnValueOnce(d.promise); await offer(); await tap('Pošalji ovu Prijavu');
  mockFocused = false; await update(); mockFocused = true; await update();
  expect(mockSubmit).toHaveBeenCalledTimes(1); expect(press('Ponovi istu Prijavu')).toBeUndefined();
  await act(async () => d.resolve({ ok: true, podatak: { prijavaId: k().prijavaId, verzija: 2, hash: k().hash } }));
  expect(mockRouter.replace).not.toHaveBeenCalled(); await tap('Proverite ishod');
  expect(text()).toContain('Prijava je poslata.');
});
it('old-account completion and retained callbacks cannot send or navigate after A→B→A', async () => {
  const d = deferred(); mockSubmit.mockReturnValueOnce(d.promise); await offer(); const old = press('Pošalji ovu Prijavu'); await tap('Pošalji ovu Prijavu');
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update();
  await act(async () => { old(); d.resolve({ ok: true, podatak: { prijavaId: k().prijavaId, verzija: 2, hash: k().hash } }); });
  expect(mockSubmit).toHaveBeenCalledTimes(1); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(text()).not.toContain('Prijava je poslata.');
});
it('shows specific candidate evidence, then confirms once and opens the exact existing Agreement route', async () => {
  mockRole = 'narucilac'; await render(Candidates);
  expect(press('Izaberi ovu Prijavu')).toBeUndefined(); expect(mockSelect).not.toHaveBeenCalled();
  await tap('Pogledaj ponudu: Milan'); expect(text()).toContain('Nošenje · Trake · Kombi');
  expect(text()).toContain('Sačuvana samoizjava'); await tap('Pregledaj povezivanje');
  expect(text()).toContain('Jedan izbor sklapa Dogovor'); const choose = press('Izaberi ovu Prijavu');
  await act(async () => { choose(); choose(); }); expect(mockSelect).toHaveBeenCalledTimes(1);
  expect(mockSelect.mock.calls[0][0]).toMatchObject({ potrebaRevizija: 3, prijavaVerzija: 2, prijavaHash: k().hash, mesta: 2 });
  await tap('Otvori Dogovor'); expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: agreement } });
});
it('stale candidate/Need read pair does not expose selection', async () => {
  mockCandidates.mockResolvedValue([{ ...k(), potrebaRevizija: 2 }]); mockRole = 'narucilac'; await render(Candidates);
  expect(text()).toContain('Zadatak se upravo promenio'); expect(press('Pogledaj ponudu: Milan')).toBeUndefined(); expect(mockSelect).not.toHaveBeenCalled();
});
it('shows a legitimate STALE offer beside a current offer and permits choosing only the current one', async () => {
  mockRole = 'narucilac';
  mockCandidates.mockResolvedValue([
    { ...k(), prijavaId: agreement, ime: 'Ranija ponuda', stanje: 'STALE', mozeIzabrati: false, verzija: 1, potrebaRevizija: 3 }, k(),
  ]);
  await render(Candidates);
  expect(press('Pogledaj ponudu: Ranija ponuda')).toBeDefined(); expect(press('Pogledaj ponudu: Milan')).toBeDefined();
  await tap('Pogledaj ponudu: Ranija ponuda'); expect(text()).toContain('Potrebna nova provera');
  expect(press('Pregledaj povezivanje')).toBeUndefined(); expect(press('Izaberi ovu Prijavu')).toBeUndefined();
  await tap('Nazad na zadatak'); await tap('Pogledaj ponudu: Milan'); await tap('Pregledaj povezivanje'); await tap('Izaberi ovu Prijavu');
  expect(mockSelect).toHaveBeenCalledTimes(1); expect(mockSelect.mock.calls[0][0]).toMatchObject({ prijavaId: k().prijavaId, potrebaRevizija: 3 });
});
it('retains exact selection on unknown even when fresh candidate state is SELECTED', async () => {
  mockSelect.mockResolvedValueOnce({ ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
  await selection(); await tap('Izaberi ovu Prijavu');
  mockCandidates.mockResolvedValue([{ ...k(), stanje: 'SELECTED', mozeIzabrati: false }]); await tap('Proverite ishod');
  await tap('Ponovi isti izbor'); expect(mockSelect.mock.calls[1][0]).toEqual(mockSelect.mock.calls[0][0]);
  await tap('Otvori Dogovor'); expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: agreement } });
});
it('selection late write on another account never reveals or opens its Agreement', async () => {
  const d = deferred(); mockSelect.mockReturnValueOnce(d.promise); await selection(); const stale = press('Izaberi ovu Prijavu');
  await tap('Izaberi ovu Prijavu'); mockAccount = { user: { id: 'owner-b' }, accountRevision: 2 }; await update();
  await act(async () => { d.resolve({ ok: true, podatak: { dogovorId: agreement } }); stale(); });
  expect(mockSelect).toHaveBeenCalledTimes(1); expect(press('Otvori Dogovor')).toBeUndefined(); expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('same-row callback retained before an explicit refresh cannot select its old revision', async () => {
  await selection(); const stale = press('Izaberi ovu Prijavu');
  mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => stale()); expect(mockSelect).not.toHaveBeenCalled();
});
it('binds displayed fixed price to the same Need revision and prevents editing that price', async () => {
  mockNeed.mockResolvedValue({ ...need(), rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' } });
  mockTask.mockResolvedValue({ ...need(), primaNovePrijave: true, rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' } });
  await render(); await edit('Cena za ponuđeni obim (RSD)', '9999'); await tap('Pošalji ovu Prijavu');
  expect(mockSubmit.mock.calls[0][0]).toMatchObject({ cenaRsd: 6000, potrebaRevizija: 3, predlozeniPocetak: null, predlozeniKraj: null });
});
it('rejects newly elapsed deadline on tap and exposes a fresh read, without dispatch', async () => {
  mockTask.mockResolvedValue({ ...need(), primaNovePrijave: true, rokZaPrijaveIso: '2020-01-01T00:00:00Z' });
  await offer(); await tap('Pošalji ovu Prijavu'); expect(mockSubmit).not.toHaveBeenCalled();
  expect(text()).toContain('Rok za prijave je istekao'); expect(press('Osveži Zadatak')).toBeDefined();
});
it('public profile panel uses the real public port and drops a late prior-account response', async () => {
  const d = deferred(); mockPublic.mockReturnValueOnce(d.promise); await selection(); await tap('Javni profil');
  expect(mockPublic).toHaveBeenCalledWith(k().radnikProfilId);
  mockAccount = { user: { id: 'owner-b' }, accountRevision: 2 }; await update();
  await act(async () => d.resolve({ profilId: k().radnikProfilId, ime: 'Late prior-account profile', poverenje: {} }));
  expect(text()).not.toContain('Late prior-account profile');
});
it('a retained reset callback cannot discard a later successful selection receipt', async () => {
  mockSelect.mockResolvedValueOnce({ ok: false, kod: 'CALENDAR_RECHECK_REQUIRED', poruka: 'Proverite kalendar.' });
  await selection(); await tap('Izaberi ovu Prijavu'); await tap('Proverite ishod');
  const oldReset = press('Pregledaj aktuelne prijave'); expect(oldReset).toBeDefined();
  await tap('Ponovi isti izbor'); await act(async () => oldReset());
  expect(press('Otvori Dogovor')).toBeDefined(); expect(mockCandidates).toHaveBeenCalledTimes(2);
});
it('passes all received candidates to native virtualization with a bounded initial viewport', async () => {
  mockRole = 'narucilac'; mockCandidates.mockResolvedValue(Array.from({ length: 600 }, (_, index) => ({ ...k(), prijavaId: `application-${index}`, ime: `Osoba ${index}` })));
  await render(Candidates);
  const list = tree!.root.findAll(node => String(node.type) === 'FlatList')[0];
  expect(list.props.data).toHaveLength(600); expect(list.props.initialNumToRender).toBe(8);
  expect(press('Pogledaj ponudu: Osoba 0')).toBeDefined(); expect(press('Pogledaj ponudu: Osoba 599')).toBeUndefined();
});
it('owned readback can replay only the frozen request when Need visibility closes after unknown submit', async () => {
  mockSubmit.mockResolvedValueOnce({ ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Proverite ishod.' });
  await offer(); await tap('Pošalji ovu Prijavu'); mockTask.mockResolvedValue(null); mockNeed.mockResolvedValue(null);
  await tap('Proverite ishod'); expect(mockApplications).toHaveBeenCalledTimes(2);
  await tap('Ponovi istu Prijavu'); expect(mockSubmit.mock.calls[1][0]).toEqual(mockSubmit.mock.calls[0][0]);
  expect(text()).toContain('Prijava je poslata.');
});

it('reopens an already selected application using its exact owned Agreement link', async () => {
  mockRole = 'narucilac'; mockCandidates.mockResolvedValue([{ ...k(), stanje: 'SELECTED', mozeIzabrati: false }]);
  mockLinkQuery.mockResolvedValue({ data: { need_id: mockId, response_id: k().prijavaId, status: 'SELECTED', agreements: { id: agreement, need_id: mockId, selected_response_id: k().prijavaId } }, error: null });
  await render(Candidates); await tap('Pogledaj ponudu: Milan'); expect(mockLinkQuery).toHaveBeenCalledTimes(1);
  await tap('Otvori Dogovor'); expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: agreement } });
  expect(mockSelect).not.toHaveBeenCalled();
});
it('missing selected link remains read-only and can be explicitly reread', async () => {
  mockRole = 'narucilac'; mockCandidates.mockResolvedValue([{ ...k(), stanje: 'SELECTED', mozeIzabrati: false }]);
  await render(Candidates); await tap('Pogledaj ponudu: Milan'); expect(press('Otvori Dogovor')).toBeUndefined();
  expect(text()).toContain('Veza sa Dogovorom trenutno nije dostupna');
  mockLinkQuery.mockResolvedValue({ data: { need_id: mockId, response_id: k().prijavaId, status: 'SELECTED', agreements: { id: agreement, need_id: mockId, selected_response_id: k().prijavaId } }, error: null });
  await tap('Proveri Dogovor'); expect(mockLinkQuery).toHaveBeenCalledTimes(2); expect(press('Otvori Dogovor')).toBeDefined();
  expect(mockSelect).not.toHaveBeenCalled();
});
it.each(['application', 'candidates'] as const)('bounds %s context read at 15 seconds and ignores its late generation', async surface => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  try {
    const late = deferred();
    if (surface === 'application') mockTask.mockReturnValueOnce(late.promise);
    else { mockRole = 'narucilac'; mockNeed.mockReturnValueOnce(late.promise); }
    await render(surface === 'application' ? Composer : Candidates);
    expect(text()).toContain('Učitavamo aktuelne podatke');
    await act(async () => { await jest.advanceTimersByTimeAsync(15001); });
    expect(text()).not.toContain('Učitavamo aktuelne podatke'); expect(press('Pokušajte ponovo')).toBeDefined();
    mockNeed.mockResolvedValue({ ...need(), naslov: 'Aktuelan pregled' });
    await tap('Pokušajte ponovo'); expect(text()).toContain('Aktuelan pregled');
    await act(async () => late.resolve({ ...need(), naslov: 'Zakasneli stari pregled', primaNovePrijave: true }));
    expect(text()).not.toContain('Zakasneli stari pregled'); expect(text()).toContain('Aktuelan pregled');
    expect(mockSubmit).not.toHaveBeenCalled(); expect(mockSelect).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
