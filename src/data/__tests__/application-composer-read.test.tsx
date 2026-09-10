import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockTask = jest.fn(), mockNeed = jest.fn(), mockProfile = jest.fn(), mockSubmit = jest.fn(), mockSelect = jest.fn(), mockCandidates = jest.fn(), mockApplications = jest.fn(), mockPublic = jest.fn();
const mockSource = { prilika: mockTask, potreba: mockNeed, mojRadnikProfil: mockProfile, podnesiPrijavu: mockSubmit,
  izaberiPrijavu: mockSelect, prijaveZaPotrebu: mockCandidates, mojePrijave: mockApplications, javniProfil: mockPublic };
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
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });
async function offer() { await render(); await edit('Cena za ponuđeni obim (RSD)', '4500'); await edit('Ljudi', '2'); }
async function selection() { mockRole = 'narucilac'; await render(Candidates); await tap('Pogledaj ponudu: Milan'); await tap('Pregledaj povezivanje'); }


it('rearms read and Retry after returning to the same retained tab', async () => {
  mockNeed.mockResolvedValue({ ...need(), naslov: 'Restored task' });
  mockTask.mockRejectedValueOnce(new Error('first outage')).mockRejectedValueOnce(new Error('second outage'))
    .mockResolvedValueOnce({ ...need(), naslov: 'Restored task', primaNovePrijave: true });
  await render(); await tap('Nazad na zadatak');
  mockFocused = false; await update(); expect(mockTask).toHaveBeenCalledTimes(1);
  mockFocused = true; await update(); expect(mockTask).toHaveBeenCalledTimes(2);
  expect(text()).toContain('Podatke za prijavu trenutno nije moguće učitati');
  const retry = press('Pokušajte ponovo'); await act(async () => { retry(); retry(); });
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
  const retry = press('Pokušajte ponovo'); await act(async () => { retry(); retry(); });
  expect(mockTask).toHaveBeenCalledTimes(2); expect(press('Pošalji ovu Prijavu')).toBeDefined(); expect(mockSubmit).not.toHaveBeenCalled();
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
