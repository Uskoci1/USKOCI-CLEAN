import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mockSession = { user: { id: A }, accountRevision: 1 };
let mockFocused = true;
const mockSource = { mojePotrebe: jest.fn(), mojePrijave: jest.fn(), mojiDogovori: jest.fn(), paznjaZaPocetnu: jest.fn() };
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
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
  jest.clearAllMocks(); mockSession = { user: { id: A }, accountRevision: 1 }; mockFocused = true;
  mockSource.mojePotrebe.mockResolvedValue([]); mockSource.mojePrijave.mockResolvedValue([]); mockSource.mojiDogovori.mockResolvedValue([]);
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [], more: 0, asOf: '2026-09-22T10:00:00Z' });
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
  mockSource.mojePotrebe.mockResolvedValue([need('orman', { brojPrijava: 2, brojPrijavaZaIzbor: 2 })]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'need:orman:applications', title: '2 prijave', detail: 'Moj orman · čeka tvoj izbor',
    target: { kind: 'CANDIDATES', needId: 'orman' } }], more: 0, asOf: '2026-09-22T10:00:00Z' });
  await render();
  expect(text()).toContain('Čeka te');
  await act(async () => row('2 prijave').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/kandidati', params: { id: 'orman' } });
  await act(async () => tree.unmount()); await render();
  await act(async () => row('Tuđ polica').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'polica' } });
});

it('names the completed Dogovori that wait for my rating once, with the count written once, and opens the Dogovori', async () => {
  mockSource.mojiDogovori.mockResolvedValue([{ ...agreement('d1', 'uskocer'), stanje: 'COMPLETED', ocenaMoguca: true },
    { ...agreement('d2', 'uskocer'), stanje: 'COMPLETED', ocenaMoguca: true }]);
  await render();
  // Seen on the emulator 2026-09-23 as "2 2 završena Dogovora": the count was written by plural() and again in front of it.
  expect(text()).toContain('2 završena Dogovora čekaju tvoju ocenu'); expect(text()).not.toContain('2 2 ');
  expect(text()).toContain('Nemaš zakazan Dogovor.');
  await act(async () => row('2 završena Dogovora čekaju tvoju ocenu').onPress());
  expect(mockRouter.navigate).toHaveBeenCalled();
});

it('a section that failed says so and offers the read again; it is never drawn as nothing', async () => {
  mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENT_LIST_FAILED')); mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  expect(text()).toContain('Dogovori trenutno nisu učitani.'); expect(text()).not.toContain('Nemaš aktivan Dogovor.');
  expect(text()).toContain('Moj orman');
  await act(async () => action('Pokušaj ponovo').onPress()); expect(mockSource.mojiDogovori).toHaveBeenCalledTimes(2);
});

it('four failed reads are a failed screen, not an empty account', async () => {
  for (const read of Object.values(mockSource)) read.mockRejectedValue(new Error('READ_FAILED'));
  await render();
  expect(text()).toContain('trenutno nisu učitani'); expect(text()).not.toContain('Ovde će stajati');
  expect(action('Objavi zadatak')).toBeDefined();
});

it('PKG-042: server attention remains visible with its full total when all three preview reads fail', async () => {
  for (const read of [mockSource.mojePotrebe, mockSource.mojePrijave, mockSource.mojiDogovori]) read.mockRejectedValue(new Error('READ_FAILED'));
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'application:server:stale', title: 'Zadatak je izmenjen',
    detail: 'Pregledaj uslove', target: { kind: 'APPLICATION', applicationId: 'server' } }], more: 12, asOf: '2026-09-22T10:00:00Z' });
  await render();
  expect(text()).toContain('Zadatak je izmenjen'); expect(text()).toMatch(/I još\s+12/);
  expect(tree.root.findAll(node => String(node.type) === 'T').some(node => node.props.children === 13)).toBe(true);
  expect(text()).not.toContain('Tvoj prvi korak.');
  await act(async () => row('Zadatak je izmenjen').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'server' } });
});

it('PKG-042: attention failure is explicit and never replaced with conclusions from old lists', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('old', { brojPrijava: 2, brojPrijavaZaIzbor: 2 })]);
  mockSource.paznjaZaPocetnu.mockRejectedValue(new Error('PRIVATE_BACKEND_ERROR'));
  await render();
  expect(text()).toContain('Podaci o obavezama trenutno nisu učitani.');
  expect(text()).not.toContain('čeka tvoj izbor'); expect(text()).not.toContain('PRIVATE_BACKEND_ERROR');
  expect(text()).toContain('Moj old');
  await act(async () => action('Pokušaj ponovo').onPress());
  expect(mockSource.paznjaZaPocetnu).toHaveBeenCalledTimes(2);
});

it('PKG-042: a known empty aggregate suppresses obsolete locally inferred attention', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('old', { brojPrijava: 7, brojPrijavaZaIzbor: 2 })]);
  await render();
  expect(mockSource.paznjaZaPocetnu).toHaveBeenCalledTimes(1);
  expect(text()).not.toContain('Čeka te'); expect(text()).toContain('Moj old');
});

it('PKG-042: a late private attention result from the previous account cannot appear after switching accounts', async () => {
  const late = deferred<unknown>(); mockSource.paznjaZaPocetnu.mockReturnValueOnce(late.promise);
  await render();
  mockSession = { user: { id: B }, accountRevision: 2 };
  await act(async () => tree.update(<Pocetna />));
  await act(async () => late.resolve({ rows: [{ id: 'private-a', title: 'PRIVATE_A_TASK', detail: '',
    target: { kind: 'NEED', needId: A } }], more: 0, asOf: '2026-09-22T10:00:00Z' }));
  expect(text()).not.toContain('PRIVATE_A_TASK'); expect(text()).toContain('Tvoj prvi korak.');
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

it('returning Home enables current navigation while its silent refresh waits, without reviving a retired callback', async () => {
  await render();
  const retired = action('Uskoči i zaradi').onPress;
  await act(async () => { mockFocused = false; tree.update(<Pocetna />); });
  const wait = deferred<never[]>(); mockSource.mojePotrebe.mockReturnValue(wait.promise);
  try {
    await act(async () => { mockFocused = true; tree.update(<Pocetna />); });
    expect(mockSource.mojePotrebe).toHaveBeenCalledTimes(2);
    await act(async () => retired());
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await act(async () => action('Uskoči i zaradi').onPress());
    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith('/mapa');
  } finally {
    await act(async () => wait.resolve([]));
  }
});
