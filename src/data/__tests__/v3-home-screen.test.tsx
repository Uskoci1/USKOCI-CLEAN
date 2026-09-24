import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mockSession = { user: { id: A }, accountRevision: 1 };
let mockFocused = true;
let mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
const mockSource = { mojePotrebe: jest.fn(), mojePrijave: jest.fn(), mojiDogovori: jest.fn(), paznjaZaPocetnu: jest.fn() };
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) };
  if (key === 'useWindowDimensions') return () => mockWindow;
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
import { StyleSheet } from 'react-native';
import { sys } from '../../ui/system/tokens';
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
  mockWindow = { width: 390, height: 844, scale: 3, fontScale: 1 };
  mockSource.mojePotrebe.mockResolvedValue([]); mockSource.mojePrijave.mockResolvedValue([]); mockSource.mojiDogovori.mockResolvedValue([]);
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [], more: 0, asOf: '2026-09-22T10:00:00Z' });
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('offers both things a person can start before any read has answered, and they go where they say', async () => {
  const wait = deferred<never[]>(); mockSource.mojePotrebe.mockReturnValue(wait.promise);
  await render();
  await act(async () => action('Objavi zadatak').onPress()); expect(mockRouter.navigate).toHaveBeenCalledWith('/nova');
  await act(async () => tree.unmount()); await render();
  await act(async () => action('Uskoči i zaradi').onPress()); expect(mockRouter.navigate).toHaveBeenCalledWith('/zadaci');
  await act(async () => wait.resolve([]));
});

// Owner's information architecture, 2026-09-23: Početna is the overview. My own tasks and my applications are two
// counted front doors instead of a preview of their rows, and the one next Dogovor says what I am to it.
it('shows one account on both sides at once, as two counted doors and the next Dogovor, with no mode anywhere', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  mockSource.mojiDogovori.mockResolvedValue([agreement('g-a', 'narucilac'), agreement('g-c', 'uskocer')]);
  await render();
  const copy = text();
  expect(copy).toContain('Moji zadaci'); expect(copy).toContain('1 aktivan');
  expect(copy).toContain('Moje prijave'); expect(copy).toContain('1 aktivna');
  expect(copy).toContain('Sledeći Dogovor'); expect(copy).toContain('Tvoj zadatak');
  expect(copy).not.toContain('Objavio si'); expect(copy).not.toContain('Uskočio si');
  // One next Dogovor; the other is one tab away, and no "Svi Dogovori" link repeats the tab.
  expect(tree.root.findAll(node => String(node.type) === 'Press' && String(node.props.accessibilityLabel).startsWith('Dogovor g-c'))).toHaveLength(0);
  expect(copy).not.toContain('Svi Dogovori');
  await act(async () => row('Dogovor g-a').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/dogovor/[id]', params: { id: 'g-a' } });
});

it('a row only navigates, and to the exact place: a waiting choice opens its candidates, the two doors open my lists', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman', { brojPrijava: 2, brojPrijavaZaIzbor: 2 })]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'need:orman:applications', title: '2 prijave', detail: 'Moj orman · čeka tvoj izbor',
    target: { kind: 'CANDIDATES', needId: 'orman' } }], more: 0, asOf: '2026-09-22T10:00:00Z' });
  await render();
  expect(text()).toContain('Čeka te');
  await act(async () => row('2 prijave').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/kandidati', params: { id: 'orman' } });
  // The door counts by the list's own rule; that the task waits for a choice is said once, under "Čeka te".
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan');
  await act(async () => tree.unmount()); await render();
  await act(async () => row('Moji zadaci').onPress());
  expect(mockRouter.navigate).toHaveBeenLastCalledWith('/potrebe');
  await act(async () => tree.unmount()); await render();
  await act(async () => row('Moje prijave').onPress());
  expect(mockRouter.navigate).toHaveBeenLastCalledWith('/moje-prijave');
});

it('"Moje aktivnosti" is no longer a destination: nothing on Početna leads there', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]); mockSource.mojePrijave.mockResolvedValue([application('polica')]);
  await render();
  expect(text()).not.toContain('Moje aktivnosti'); expect(text()).not.toContain('Vidi sve');
  // Every press on the screen, each on a fresh screen (one navigation per focus is the guard's rule).
  const labels = tree.root.findAll(node => String(node.type) === 'Press' && typeof node.props.onPress === 'function').map(node => String(node.props.accessibilityLabel));
  expect(labels.length).toBeGreaterThanOrEqual(5);
  for (const label of labels) {
    await act(async () => tree.unmount()); await render();
    await act(async () => row(label).onPress());
  }
  expect(mockRouter.navigate).toHaveBeenCalledTimes(labels.length);
  expect(mockRouter.navigate).not.toHaveBeenCalledWith('/moje-aktivnosti');
});

it('the start tiles carry no arrow and the screen no tagline', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  expect(tree.root.findAll(node => String(node.type) === 'ArrowRight')).toHaveLength(0);
  expect(text()).not.toContain('Manje obaveza');
});

const tile = (label: string) => StyleSheet.flatten(tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label)[0].props.style);
it('the earn tile never leaves "i" alone at a line end, and says what it does in three words', async () => {
  await render();
  // A no-break space binds "i" to "zaradi"; the spoken name stays plain.
  expect(text()).toContain('Uskoči i\u00A0zaradi'); expect(text()).not.toContain('Uskoči i zaradi');
  expect(tile('Uskoči i zaradi')).toBeDefined(); expect(text()).toContain('Nađi posao blizu');
  expect(text()).not.toContain('Pronađi posao blizu');
});

it.each([
  ['side by side on a 390 px phone at normal text', 390, 1, false],
  ['side by side at text scale 1.2', 390, 1.2, false],
  // Android reports its "Large" setting as 1.2999999523: the rounded scale must still stack (emulator, 2026-09-24).
  ['stacked at Android\'s Large text (1.2999999523)', 390, 1.2999999523, true],
  ['stacked on a 320 px phone', 320, 1, true],
])('the start tiles are %s', async (_name, width, fontScale, stacked) => {
  mockWindow = { width, height: 844, scale: 3, fontScale };
  await render();
  for (const label of ['Objavi zadatak', 'Uskoči i zaradi']) {
    const style = tile(label);
    expect([label, style.flexDirection ?? 'column']).toEqual([label, stacked ? 'row' : 'column']);
    if (stacked) expect(style.minHeight).toBeGreaterThanOrEqual(72);
    expect(style.justifyContent ?? 'flex-start').toBe('flex-start');
  }
});

// Critique B1/B20 (2026-09-24): one orange fill on the screen (the publish tile); what waits is a pale band with no
// orange outline; rows are at least 64 tall.
it('rows on Početna are at least 64 tall, and the publish tile is the one orange surface: nothing else wears an orange edge', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  mockSource.mojiDogovori.mockResolvedValue([completed('d1'), completed('d2')]);
  await render();
  expect(tile('Moji zadaci. 1 aktivan').minHeight).toBeGreaterThanOrEqual(64);
  expect(tile('Moje prijave. Još nemaš prijavu').minHeight).toBeGreaterThanOrEqual(64);
  expect(tile('Objavi zadatak').backgroundColor).toBe(sys.color.orange);
  // The card edge is `cardLine` since round 2c (the faint `line` left the white tile almost without an edge).
  expect(tile('Uskoči i zaradi')).toMatchObject({ backgroundColor: sys.color.surface, borderColor: sys.color.cardLine });
  const strip = tile('Oceni 2 završena Dogovora');
  expect(strip.backgroundColor).toBe(sys.color.orangeSoft); expect(strip.borderWidth ?? 0).toBe(0);
});

const completed = (id: string) => ({ ...agreement(id, 'uskocer'), stanje: 'COMPLETED', ocenaMoguca: true });

// Copy updated 2026-09-24 (critique A1): the strip used to say "2 završena Dogovora čekaju tvoju ocenu"; it now leads
// with the verb. Two due still open the Dogovori, where each one waits.
it('names the completed Dogovori that wait for my rating once, verb first, with the count written once, and opens the Dogovori', async () => {
  mockSource.mojiDogovori.mockResolvedValue([completed('d1'), completed('d2')]);
  await render();
  // Seen on the emulator 2026-09-23 as "2 2 završena Dogovora": the count was written by plural() and again in front of it.
  expect(text()).toContain('Oceni 2 završena Dogovora'); expect(text()).not.toContain('2 2 ');
  // It waits for me, so it stands under "Čeka te"; with no next Dogovor there is no empty "Nemaš zakazan Dogovor." line.
  expect(text()).toContain('Čeka te'); expect(text()).not.toContain('Nemaš zakazan Dogovor'); expect(text()).not.toContain('Sledeći Dogovor');
  expect(row('Oceni 2 završena Dogovora').accessibilityHint).toBe('Otvara Dogovore.');
  await act(async () => row('Oceni 2 završena Dogovora').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/dogovori');
});

// Critique A1 (2026-09-24): the strip opened the Dogovori list, four taps from the rating. With exactly one due, the
// Dogovori read has already named it, so the rating opens directly, as the Dogovor screen itself opens it.
it('with exactly one Dogovor waiting for my rating, opens that rating in one tap', async () => {
  mockSource.mojiDogovori.mockResolvedValue([completed('d1'), { ...agreement('rated', 'uskocer'), stanje: 'COMPLETED', ocenaMoguca: false }]);
  await render();
  expect(text()).toContain('Oceni završen Dogovor');
  expect(row('Oceni završen Dogovor').accessibilityHint).toBe('Otvara ocenu saradnje.');
  await act(async () => row('Oceni završen Dogovor').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
  // Round 2c (verifier vf, must 1): the rating is told it was opened from Početna, so its way back names Početna.
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/oceni-dogovor', params: { agreementId: 'd1', from: 'pocetna' } });
});

it.each([[5, 'Oceni 5 završenih Dogovora'], [21, 'Oceni 21 završen Dogovor'], [22, 'Oceni 22 završena Dogovora']])(
  'writes %i due ratings in the Serbian form', async (count, expected) => {
    mockSource.mojiDogovori.mockResolvedValue(Array.from({ length: count }, (_, index) => completed(`d${index}`)));
    await render();
    expect(text()).toContain(expected);
  });

it('a section that failed says so and offers the read again; it is never drawn as nothing', async () => {
  mockSource.mojiDogovori.mockRejectedValue(new Error('AGREEMENT_LIST_FAILED')); mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  expect(text()).toContain('Dogovori trenutno nisu učitani.'); expect(text()).not.toContain('Nemaš aktivan Dogovor.');
  expect(text()).toContain('1 aktivan');
  await act(async () => action('Pokušaj ponovo').onPress()); expect(mockSource.mojiDogovori).toHaveBeenCalledTimes(2);
});

it('four failed reads are a failed screen, not an empty account, and the two doors never say zero', async () => {
  for (const read of Object.values(mockSource)) read.mockRejectedValue(new Error('READ_FAILED'));
  await render();
  expect(text()).toContain('trenutno nisu učitani'); expect(text()).not.toContain('Šta rešavamo');
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. Trenutno nisu učitani');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Trenutno nisu učitane');
  expect(text()).not.toMatch(/\b0\b/); expect(text()).not.toContain('Još nemaš');
  expect(action('Objavi zadatak')).toBeDefined();
});

it('one failed side says it is not loaded while the other is counted', async () => {
  mockSource.mojePrijave.mockRejectedValue(new Error('APPLICATIONS_FAILED')); mockSource.mojePotrebe.mockResolvedValue([need('orman'), need('nacrt', { stanje: 'NACRT' })]);
  await render();
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan · 1 nacrt');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Trenutno nisu učitane');
});

// Serbian counts take three shapes by the last two digits (plural.ts): a final 1 but not 11, a final 2–4 but not
// 12–14, and everything else. 1 is covered above; 2, 5, 11 and 21 are the other edges.
it.each([
  [2, 'Moji zadaci. 2 aktivna · 2 nacrta', 'Moje prijave. 2 aktivne', 'Moje prijave. 2 prijave'],
  [5, 'Moji zadaci. 5 aktivnih · 5 nacrta', 'Moje prijave. 5 aktivnih', 'Moje prijave. 5 prijava'],
  [11, 'Moji zadaci. 11 aktivnih · 11 nacrta', 'Moje prijave. 11 aktivnih', 'Moje prijave. 11 prijava'],
  [21, 'Moji zadaci. 21 aktivan · 21 nacrt', 'Moje prijave. 21 aktivna', 'Moje prijave. 21 prijava'],
])('the two doors write %i in its Serbian form', async (count, tasks, applications, waiting) => {
  const many = <Row,>(make: (index: number) => Row) => Array.from({ length: count }, (_, index) => make(index));
  mockSource.mojePotrebe.mockResolvedValue([...many(index => need(`a${index}`)), ...many(index => need(`d${index}`, { stanje: 'NACRT' }))]);
  mockSource.mojePrijave.mockResolvedValue(many(index => application(`p${index}`)));
  await render();
  expect(row('Moji zadaci').accessibilityLabel).toBe(tasks);
  expect(row('Moje prijave').accessibilityLabel).toBe(applications);
  // Applications that all wait for me are named by their number, never as "Nema aktivnih prijava".
  mockSource.mojePrijave.mockResolvedValue(many(index => ({ ...application(`w${index}`), traziPaznju: true })));
  await act(async () => tree.unmount()); await render();
  expect(row('Moje prijave').accessibilityLabel).toBe(waiting);
});

it('PKG-042: server attention remains visible with its full total when all three preview reads fail', async () => {
  for (const read of [mockSource.mojePotrebe, mockSource.mojePrijave, mockSource.mojiDogovori]) read.mockRejectedValue(new Error('READ_FAILED'));
  mockSource.paznjaZaPocetnu.mockResolvedValue({ rows: [{ id: 'application:server:stale', title: 'Zadatak je izmenjen',
    detail: 'Pregledaj uslove', target: { kind: 'APPLICATION', applicationId: 'server' } }], more: 12, asOf: '2026-09-22T10:00:00Z' });
  await render();
  expect(text()).toContain('Zadatak je izmenjen'); expect(text()).toMatch(/I još\s+12/);
  expect(tree.root.findAll(node => String(node.type) === 'T').some(node => node.props.children === 13)).toBe(true);
  expect(text()).not.toContain('Šta rešavamo');
  await act(async () => row('Zadatak je izmenjen').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: 'server' } });
});

it('PKG-042: attention failure is explicit and never replaced with conclusions from old lists', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('old', { brojPrijava: 2, brojPrijavaZaIzbor: 2 })]);
  mockSource.paznjaZaPocetnu.mockRejectedValue(new Error('PRIVATE_BACKEND_ERROR'));
  await render();
  expect(text()).toContain('Podaci o obavezama trenutno nisu učitani.');
  expect(text()).not.toContain('čeka tvoj izbor'); expect(text()).not.toContain('PRIVATE_BACKEND_ERROR');
  // "Čeka te" stays unavailable, and the door does not stand in for it: it counts the list, never what waits.
  expect(text()).not.toContain('čeka izbor');
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan');
  await act(async () => action('Pokušaj ponovo').onPress());
  expect(mockSource.paznjaZaPocetnu).toHaveBeenCalledTimes(2);
});

it('PKG-042: a known empty aggregate suppresses obsolete locally inferred attention', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('old', { brojPrijava: 7, brojPrijavaZaIzbor: 2 })]);
  mockSource.mojePrijave.mockResolvedValue([{ ...application('stara'), traziPaznju: true }]);
  await render();
  expect(mockSource.paznjaZaPocetnu).toHaveBeenCalledTimes(1);
  expect(text()).not.toContain('Čeka te'); expect(text()).toContain('1 aktivan');
  // Neither door contradicts the known empty list with a count of its own of what waits.
  expect(text()).not.toContain('čeka izbor'); expect(text()).not.toContain('čeka te');
  expect(row('Moji zadaci').accessibilityLabel).toBe('Moji zadaci. 1 aktivan');
  // The application is in the list's own "Čeka te" set, not in "Aktivne": the door names it without calling it inactive.
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. 1 prijava');
});

it('PKG-042: a late private attention result from the previous account cannot appear after switching accounts', async () => {
  const late = deferred<unknown>(); mockSource.paznjaZaPocetnu.mockReturnValueOnce(late.promise);
  await render();
  mockSession = { user: { id: B }, accountRevision: 2 };
  await act(async () => tree.update(<Pocetna />));
  await act(async () => late.resolve({ rows: [{ id: 'private-a', title: 'PRIVATE_A_TASK', detail: '',
    target: { kind: 'NEED', needId: A } }], more: 0, asOf: '2026-09-22T10:00:00Z' }));
  expect(text()).not.toContain('PRIVATE_A_TASK'); expect(text()).toContain('Šta rešavamo');
});

it('an empty account is greeted once, and its two doors say there is nothing yet, without zero statistics', async () => {
  await render();
  expect(text()).toContain('Šta rešavamo'); expect(text()).not.toContain('0');
  // "Zadatak" is the product's noun, in the same words as the empty "Moji zadaci" list the door opens.
  expect(text()).toContain('Još nemaš Zadatak'); expect(text()).toContain('Još nemaš prijavu');
});

it('the first-run greeting stands under the tiles, so nothing above them moves when the reads answer', async () => {
  const wait = deferred<never[]>(); mockSource.mojePotrebe.mockReturnValue(wait.promise);
  await render();
  // The first thing in the scroll view holds the two tiles, before the reads answer and after.
  const tilesFirst = () => (tree.root.findByType('ScrollView' as React.ElementType).children[0] as ReactTestInstance)
    .findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === 'Objavi zadatak').length === 1;
  expect(text()).not.toContain('Šta rešavamo'); expect(tilesFirst()).toBe(true);
  await act(async () => wait.resolve([]));
  expect(text()).toContain('Šta rešavamo'); expect(tilesFirst()).toBe(true);
});

it('the greeting belongs to a first run only: once something exists, the tiles come first', async () => {
  mockSource.mojePrijave.mockResolvedValue([{ ...application('stara'), stanje: 'WITHDRAWN' }]);
  await render();
  expect(text()).not.toContain('Šta rešavamo');
  expect(row('Moje prijave').accessibilityLabel).toBe('Moje prijave. Nema aktivnih prijava');
});

it('a failed refresh never claims an empty account and keeps both new start tiles available', async () => {
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  await render();
  for (const read of Object.values(mockSource)) read.mockRejectedValue(new Error('READ_FAILED'));
  const refresh = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props.onRefresh;
  await act(async () => refresh());
  expect(text()).toContain('trenutno nisu učitani');
  expect(text()).not.toContain('Šta rešavamo');
  expect(action('Objavi zadatak')).toBeDefined(); expect(action('Uskoči i zaradi')).toBeDefined();
  await act(async () => action('Uskoči i zaradi').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/zadaci');
});

it('logout of A and login of B never shows A, and a late answer for A cannot paint over B', async () => {
  const late = deferred<unknown[]>(); mockSource.mojePotrebe.mockReturnValueOnce(late.promise);
  await render();
  mockSession = { user: { id: B }, accountRevision: 2 }; mockSource.mojePotrebe.mockResolvedValue([need('b-task')]);
  await act(async () => tree.update(<Pocetna />));
  // A's late list holds two tasks, B's one: only B's count may stand.
  await act(async () => late.resolve([need('a-private'), need('a-second')]));
  expect(text()).not.toContain('2 aktivna'); expect(text()).toContain('1 aktivan');
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
    expect(mockRouter.navigate).toHaveBeenCalledWith('/zadaci');
  } finally {
    await act(async () => wait.resolve([]));
  }
});
