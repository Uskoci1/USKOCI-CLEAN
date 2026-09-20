import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mockSession = { user: { id: A }, accountRevision: 1 };
const mockSource = { mojePotrebe: jest.fn(), mojePrijave: jest.fn(), mojiDogovori: jest.fn() };
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) };
  return ['View', 'ScrollView', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : String(key) }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/entry/BrandAssets', () => ({ BrandLockup: 'BrandLockup' }));
jest.mock('../../ui/home/HomeIllustration', () => ({ HomeIllustration: 'HomeIllustration' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import Pocetna from '../../app/(app)/index';

let tree: ReactTestRenderer;
const need = (id: string, patch: object = {}) => ({ id, revizija: 1, naslov: `Moj ${id}`, stanje: 'OBJAVLJENA', vremeTekst: 'sutra',
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, brojPrijava: 0, ...patch });
const application = (id: string) => ({ prijavaId: id, potrebaId: `n-${id}`, stanje: 'SUBMITTED', naslov: `Tuđ ${id}`,
  cena: { prikaz: '2.500 RSD' }, promenjenaPotreba: false, traziPaznju: false, dogovorId: null });
const agreement = (id: string, mine: 'narucilac' | 'uskocer') => ({ id, naslov: `Dogovor ${id}`, stanje: 'CONFIRMED', vremeTekst: 'danas', problemOtvoren: false,
  ucesnici: [{ id: A, ime: 'Ja', uloga: mine, viSte: true }, { id: B, ime: 'Jelena', uloga: mine === 'narucilac' ? 'uskocer' : 'narucilac', viSte: false }] });
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const action = (label: string) => tree.root.findByProps({ label }).props;
const row = (start: string) => tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith(start))[0].props;
const render = async () => { await act(async () => { tree = create(<Pocetna />); }); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: A }, accountRevision: 1 };
  mockSource.mojePotrebe.mockResolvedValue([]); mockSource.mojePrijave.mockResolvedValue([]); mockSource.mojiDogovori.mockResolvedValue([]);
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('offers both things a person can start before any read has answered, and they go where they say', async () => {
  const wait = deferred<never[]>(); mockSource.mojePotrebe.mockReturnValue(wait.promise);
  await render();
  await act(async () => action('Objavi zadatak').onPress()); expect(mockRouter.navigate).toHaveBeenCalledWith('/nova');
  await act(async () => tree.unmount()); await render();
  await act(async () => action('Uskoči i zaradi').onPress()); expect(mockRouter.navigate).toHaveBeenCalledWith('/mapa');
  await act(async () => wait.resolve([]));
});

it('shows one account on both sides at once, each row saying what I am to it, with no mode anywhere', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  mockSource.mojiDogovori.mockResolvedValue([agreement('g-a', 'narucilac'), agreement('g-c', 'uskocer')]);
  await render();
  const copy = text();
  expect(copy).toContain('Tvoj zadatak'); expect(copy).toContain('Tvoja prijava'); expect(copy).toContain('Objavio si'); expect(copy).toContain('Uskočio si');
  await act(async () => row('Dogovor g-c').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'g-c' } });
});

it('a row only navigates, and to the exact object: my task opens its candidates, my application opens that application', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman', { brojPrijava: 2 })]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  await render();
  expect(text()).toContain('Čeka te');
  await act(async () => row('2 prijave').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/kandidati', params: { id: 'orman' } });
  await act(async () => tree.unmount()); await render();
  await act(async () => row('Tuđ polica').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'polica' } });
});

it('a section that failed says so and offers the read again; it is never drawn as nothing', async () => {
  mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENT_LIST_FAILED')); mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  expect(text()).toContain('Dogovori trenutno nisu učitani.'); expect(text()).not.toContain('Nemaš aktivan Dogovor.');
  expect(text()).toContain('Moj orman');
  await act(async () => action('Pokušaj ponovo').onPress()); expect(mockSource.mojiDogovori).toHaveBeenCalledTimes(2);
});

it('three failed reads are a failed screen, not an empty account', async () => {
  for (const read of Object.values(mockSource)) read.mockRejectedValue(new Error('READ_FAILED'));
  await render();
  expect(text()).toContain('trenutno nisu učitani'); expect(text()).not.toContain('Ovde će stajati');
  expect(action('Objavi zadatak')).toBeDefined();
});

it('an empty account is told what will stand here, without zero statistics', async () => {
  await render();
  expect(text()).toContain('Ovde će stajati ono što te čeka'); expect(text()).not.toContain('0');
});

it('a failed refresh never claims an empty account and keeps both new start tiles available', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  for (const read of Object.values(mockSource)) read.mockRejectedValue(new Error('READ_FAILED'));
  const refresh = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props.onRefresh;
  await act(async () => refresh());
  expect(text()).toContain('trenutno nisu učitani');
  expect(text()).not.toContain('Tvoj prvi korak.');
  expect(action('Objavi zadatak')).toBeDefined(); expect(action('Uskoči i zaradi')).toBeDefined();
  await act(async () => action('Uskoči i zaradi').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/mapa');
});

it('logout of A and login of B never shows A, and a late answer for A cannot paint over B', async () => {
  const late = deferred<unknown[]>(); mockSource.mojePotrebe.mockReturnValueOnce(late.promise);
  await render();
  mockSession = { user: { id: B }, accountRevision: 2 }; mockSource.mojePotrebe.mockResolvedValue([need('b-task')]);
  await act(async () => tree.update(<Pocetna />));
  await act(async () => late.resolve([need('a-private')]));
  expect(text()).not.toContain('Moj a-private'); expect(text()).toContain('Moj b-task');
});
