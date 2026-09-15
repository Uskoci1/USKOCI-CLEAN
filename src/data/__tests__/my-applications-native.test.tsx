import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockRead = jest.fn(), mockWithdraw = jest.fn(), mockResolve = jest.fn(), mockInterval = jest.fn(), mockAlert = jest.fn();
const mockSource = { mojePrijave: mockRead, povuciPrijavu: mockWithdraw };
const mockRouter = { navigate: jest.fn(), push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockFocused = true, mockRole = 'uskocer';
let mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 };
let mockState = 'active';
const mockListeners = new Set<(state: string) => void>();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'Alert') return { alert: mockAlert };
    if (key === 'AppState') return { currentState: mockState, addEventListener: (_: string, listener: any) => {
      mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
    } };
    if (key === 'FlatList') return (props: any) => require('react').createElement('FlatList', props, props.ListHeaderComponent,
      ...(props.data.length ? props.data.slice(0, props.initialNumToRender).map((item: any) => require('react').createElement(require('react').Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item }))) : [props.ListEmptyComponent]));
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => mockRole, ulogaSada: () => mockRole }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'Bell' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('phosphor-react-native', () => ({ User: 'Icon' }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../ru4Production', () => ({ ru4Production: { resolveChangedApplication: (...args: any[]) => mockResolve(...args) } }));
jest.mock('../myApplicationsClientService', () => ({ readExistingApplicationInterval: (...args: any[]) => mockInterval(...args) }));
import Screen from '../../app/(app)/moje-prijave';
const row = (overrides: any = {}) => ({ prijavaId: '10000000-0000-4000-8000-000000000001', potrebaId: '10000000-0000-4000-8000-000000000002',
  potrebaRevizija: 4, prijavaRevizija: 4, prijavaVerzija: 2, stanje: 'SUBMITTED', naslov: 'Unos ormara', opis: 'Dvoje ljudi i trake.',
  cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' }, pokrivaMesta: 2, napomena: 'Sa trakama.', podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: '20. septembar · 10–11h', dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...overrides });
const stale = () => row({ stanje: 'STALE_REVIEW_REQUIRED', prijavaRevizija: 3, promenjenaPotreba: true, mozePovuci: false, traziPaznju: true });
const interval = { start: '2026-09-20T10:00:00.123456Z', end: '2026-09-20T11:00:00.654321Z' };
let mockRows: any[] = [], tree: ReactTestRenderer | undefined;
const text = () => tree!.root.findAll(n => String(n.type) === 'T').flatMap(n => n.children.filter(c => typeof c === 'string')).join(' ');
const press = (label: string) => tree!.root.findAll(n => String(n.type) === 'Press' && n.props.accessibilityLabel === label)[0]?.props.onPress;
const tap = async (label: string) => { const f = press(label); expect(f).toBeDefined(); await act(async () => f()); };
const edit = async (label: string, value: string) => { await act(async () => tree!.root.findAll(n => String(n.type) === 'TextInput' && n.props.accessibilityLabel === label)[0].props.onChangeText(value)); };
const render = async () => { await act(async () => { tree = create(<Screen />); }); };
const update = async () => { await act(async () => tree!.update(<Screen />)); };
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { resolve, promise }; };
const confirm = () => mockAlert.mock.calls.at(-1)![2].find((b: any) => b.text === 'Povuci').onPress;
const background = async (state: string) => { await act(async () => { mockState = state; mockListeners.forEach(f => f(state)); }); };
async function review() { mockRows = [stale()]; await render(); await tap('Pregledaj izmene: Unos ormara'); }
async function editing() { await review(); await tap('Izmeni prijavu'); }
beforeEach(() => {
  jest.clearAllMocks(); mockFocused = true; mockState = 'active'; mockRole = 'uskocer'; mockAccount = { user: { id: 'owner-a' }, accountRevision: 1 };
  mockRows = [row()]; mockRead.mockImplementation(async () => mockRows);
  mockWithdraw.mockImplementation(async () => { mockRows = [row({ stanje: 'WITHDRAWN', mozePovuci: false })]; return { ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }; });
  mockResolve.mockImplementation(async () => { mockRows = [row({ prijavaVerzija: 3 })]; return { ok: true, podatak: { status: 'SUBMITTED', version: 3 } }; });
  mockInterval.mockResolvedValue({ ok: true, podatak: interval });
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; jest.useRealTimers(); });
it('renders the real empty state and uses the existing discovery route', async () => {
  mockRows = []; await render(); expect(text()).toContain('Tvoja sledeća prilika.'); await tap('Istraži zadatke'); expect(mockRouter.navigate).toHaveBeenCalledWith('/prilike');
});
it('filters actual attention, active and finished rows without changing their status', async () => {
  mockRows = [row(), stale(), row({ prijavaId: 'closed', naslov: 'Završena ponuda', stanje: 'CLOSED', mozePovuci: false })];
  mockRows[1].prijavaId = 'stale'; await render(); await tap('Čeka te'); expect(text()).toContain('Potrebna nova provera'); expect(text()).not.toContain('Završena ponuda');
  await tap('Aktivne'); expect(text()).toContain('Poslata'); expect(text()).not.toContain('Potrebna nova provera');
  await tap('Završene'); expect(text()).toContain('Završena ponuda');
});
it('routes only a selected row to its exact existing Agreement', async () => {
  mockRows = [row({ stanje: 'SELECTED', dogovorId: 'agreement-123', mozePovuci: false, traziPaznju: true })]; await render();
  const old = press('Otvori Dogovor: Unos ormara'); await tap('Otvori Dogovor: Unos ormara'); expect(mockRouter.push).toHaveBeenCalledWith('/dogovor/agreement-123');
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update(); await act(async () => old()); expect(mockRouter.push).toHaveBeenCalledTimes(1);
});
it('requires a visible stale review, then KEEP preserves null-ignored fields and exact versions', async () => {
  mockRows = [stale()]; await render(); expect(press('Zadrži prijavu')).toBeUndefined(); await tap('Pregledaj izmene: Unos ormara');
  expect(text()).toContain('Dvoje ljudi i trake.'); expect(text()).toContain('20. septembar');
  const keep = press('Zadrži prijavu'); await act(async () => { keep(); keep(); }); expect(mockResolve).toHaveBeenCalledTimes(1);
  expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'KEEP', ocekivanaVerzija: 2, ocekivanaPotrebaRevizija: 4, cenaRsd: null, napomena: null });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(text()).toContain('Prijava je usklađena');
});
it('updates price, people and note while preserving the exact existing interval including microseconds', async () => {
  await editing(); expect(mockInterval).toHaveBeenCalledWith(stale()); expect(text()).toContain('Ponuđeni termin ostaje nepromenjen');
  await edit('Cena ponude (RSD)', '5600'); await edit('Broj ljudi', '3'); await edit('Napomena uz ponudu', '  Donosimo nove trake.  ');
  await tap('Sačuvaj izmenjenu prijavu'); expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'UPDATE', cenaRsd: 5600, pokrivenaMesta: 3,
    napomena: 'Donosimo nove trake.', predlozeniPocetak: interval.start, predlozeniKraj: interval.end });
});
it('shows distinct microsecond endpoints with an honest unknown timezone and the existing people plural', async () => {
  mockRows = [stale()]; mockRows[0].pokrivaMesta = 12;
  mockInterval.mockResolvedValue({ ok: true, podatak: { start: '2026-09-20T10:00:00.000001Z', end: '2026-09-20T10:00:00.000009Z' } });
  await render(); await tap('Pregledaj izmene: Unos ormara'); await tap('Izmeni prijavu');
  expect(text()).toContain('10:00:00.000001'); expect(text()).toContain('10:00:00.000009');
  expect(text()).toContain('UTC · zona nije navedena'); expect(text()).toContain('12 osoba'); expect(text()).not.toContain('12 osobe');
});
it('does not infer a missing interval as null and refuses editing after an interval read failure', async () => {
  mockInterval.mockResolvedValue({ ok: false, kod: 'CHANGED', poruka: 'private raw error' }); await editing();
  expect(press('Sačuvaj izmenjenu prijavu')).toBeUndefined(); expect(text()).toContain('Sačuvani termin nije potvrđen'); expect(text()).not.toContain('private raw'); expect(mockResolve).not.toHaveBeenCalled();
});
it('accepts an explicitly read null interval without inventing a time', async () => {
  mockInterval.mockResolvedValue({ ok: true, podatak: { start: null, end: null } }); await editing(); await tap('Sačuvaj izmenjenu prijavu');
  expect(mockResolve.mock.calls[0][0]).toMatchObject({ predlozeniPocetak: null, predlozeniKraj: null, napomena: 'Sa trakama.' });
});
it('rejects trailing price garbage and fractional people instead of silently coercing', async () => {
  await editing(); await edit('Cena ponude (RSD)', '5000x'); await tap('Sačuvaj izmenjenu prijavu'); expect(mockResolve).not.toHaveBeenCalled();
  await edit('Cena ponude (RSD)', '5000'); await edit('Broj ljudi', '1.5'); await tap('Sačuvaj izmenjenu prijavu'); expect(mockResolve).not.toHaveBeenCalled();
});
it('withdraws only after explicit confirmation, fences double taps, and reads before success', async () => {
  await render(); await tap('Povuci prijavu: Unos ormara'); expect(mockWithdraw).not.toHaveBeenCalled(); const send = confirm();
  await act(async () => { send(); send(); }); expect(mockWithdraw).toHaveBeenCalledTimes(1); expect(mockWithdraw.mock.calls[0][0]).toMatchObject({ potrebaRevizija: 4, prijavaVerzija: 2, razlog: null });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(text()).toContain('Sačuvano stanje: Prijava je povučena.');
});
it('stale WITHDRAW uses its actual revision-resolution authority', async () => {
  mockResolve.mockResolvedValue({ ok: true, podatak: { status: 'WITHDRAWN', version: 2 } }); await review(); await tap('Povuci izmenjenu prijavu'); await act(async () => confirm()());
  expect(mockWithdraw).not.toHaveBeenCalled(); expect(mockResolve.mock.calls[0][0]).toMatchObject({ akcija: 'WITHDRAW', ocekivanaVerzija: 2, ocekivanaPotrebaRevizija: 4 });
});
it.each(['blur', 'account', 'intent', 'background', 'refresh'])('retires an open withdrawal confirmation after %s', async change => {
  await render(); await tap('Povuci prijavu: Unos ormara'); const old = confirm();
  if (change === 'blur') { mockFocused = false; await update(); mockFocused = true; await update(); }
  if (change === 'account') { mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update(); }
  if (change === 'intent') { mockRole = 'narucilac'; await update(); }
  if (change === 'background') { await background('background'); expect(text()).not.toContain('Unos ormara'); await background('active'); }
  if (change === 'refresh') { await act(async () => tree!.root.findByType('FlatList' as any).props.onRefresh()); }
  await act(async () => old()); expect(mockWithdraw).not.toHaveBeenCalled();
});
it('retires retained review actions when that review is closed and reopened', async () => {
  await review(); const old = press('Zadrži prijavu'); await tap('Zatvori pregled izmena'); await tap('Pregledaj izmene: Unos ormara'); await act(async () => old()); expect(mockResolve).not.toHaveBeenCalled();
});
it('unknown UPDATE requires readback then retries the identical immutable payload and key', async () => {
  mockResolve.mockResolvedValue({ ok: false, kod: 'NETWORK', poruka: 'secret backend text' }); await editing(); await edit('Cena ponude (RSD)', '5600');
  const oldSave = press('Sačuvaj izmenjenu prijavu'); await tap('Sačuvaj izmenjenu prijavu'); expect(press('Ponovi isti zahtev')).toBeUndefined();
  expect(text()).not.toContain('secret backend text'); await act(async () => oldSave()); expect(mockResolve).toHaveBeenCalledTimes(1);
  mockRows = [stale()]; mockRows[0].potrebaRevizija = 5; await tap('Proveri sačuvano stanje'); await tap('Ponovi isti zahtev');
  expect(mockResolve.mock.calls[1][0]).toEqual(mockResolve.mock.calls[0][0]); expect(mockResolve.mock.calls[1][0].ocekivanaPotrebaRevizija).toBe(4);
});
it('known stale rejection permits a new reviewed intent only after readback', async () => {
  mockResolve.mockResolvedValueOnce({ ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: 'raw data' }); await review(); await tap('Zadrži prijavu');
  expect(press('Pregledaj aktuelnu prijavu')).toBeUndefined(); await tap('Proveri sačuvano stanje'); await tap('Pregledaj aktuelnu prijavu');
  await tap('Pregledaj izmene: Unos ormara'); await tap('Zadrži prijavu'); expect(mockResolve.mock.calls[1][0].clientRequestId).not.toBe(mockResolve.mock.calls[0][0].clientRequestId);
});
it('a malformed receipt cannot fabricate success or unlock a changed command', async () => {
  mockResolve.mockResolvedValue({ ok: true, podatak: { status: 'SUBMITTED', version: 2 } }); await review(); await tap('Zadrži prijavu');
  expect(text()).toContain('Ishod radnje nije potvrđen'); expect(text()).not.toContain('Prijava je usklađena'); expect(mockRead).toHaveBeenCalledTimes(1);
});
it('a valid receipt plus failed readback says refresh is needed without an optimistic card', async () => {
  await render(); mockRead.mockRejectedValueOnce(new Error('private server path')); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  expect(text()).toContain('Server je potvrdio radnju, ali lista nije učitana'); expect(text()).not.toContain('Sačuvano stanje: Prijava je povučena.'); expect(text()).not.toContain('private server');
  await tap('Proveri sačuvano stanje'); expect(text()).toContain('Sačuvano stanje: Prijava je povučena.');
});
it('bounds a hanging initial read; retry works and its late result cannot replace the current list', async () => {
  jest.useFakeTimers(); const d = deferred(); mockRead.mockReturnValueOnce(d.promise); await render(); await act(async () => jest.advanceTimersByTime(15001));
  expect(text()).toContain('Prijave nisu učitane'); await tap('Pokušajte ponovo'); await act(async () => d.resolve([row({ naslov: 'Retired private row' })]));
  expect(text()).toContain('Unos ormara'); expect(text()).not.toContain('Retired private row');
});
it('bounds a hanging write, discards its late completion and reuses the same key after owned read', async () => {
  jest.useFakeTimers(); const d = deferred(); mockWithdraw.mockReturnValueOnce(d.promise); await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  await act(async () => jest.advanceTimersByTime(15001)); expect(text()).toContain('Ishod radnje nije potvrđen');
  await tap('Proveri sačuvano stanje'); await act(async () => d.resolve({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }));
  expect(text()).not.toContain('Sačuvano stanje: Prijava je povučena.'); await tap('Ponovi isti zahtev'); expect(mockWithdraw.mock.calls[1][0]).toEqual(mockWithdraw.mock.calls[0][0]);
});
it('late interval read after blur cannot reopen the editor', async () => {
  const d = deferred(); mockInterval.mockReturnValueOnce(d.promise); await review(); await tap('Izmeni prijavu'); mockFocused = false; await update(); mockFocused = true; await update();
  await act(async () => d.resolve({ ok: true, podatak: interval })); expect(press('Sačuvaj izmenjenu prijavu')).toBeUndefined();
});
it('refocus while a write is pending waits for settlement and then permits explicit readback', async () => {
  const d = deferred(); mockWithdraw.mockReturnValueOnce(d.promise); await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  mockFocused = false; await update(); mockFocused = true; await update(); await tap('Proveri sačuvano stanje'); expect(mockRead).toHaveBeenCalledTimes(2);
  mockRows = [row({ stanje: 'WITHDRAWN', mozePovuci: false })]; await act(async () => d.resolve({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }));
  await tap('Proveri sačuvano stanje'); expect(mockRead).toHaveBeenCalledTimes(3); expect(text()).toContain('Sačuvano stanje: Prijava je povučena.');
});
it('a late read from the prior account incarnation never reveals its rows', async () => {
  const d = deferred(); mockRead.mockReturnValueOnce(d.promise); await render(); mockRows = [row({ naslov: 'Current account' })];
  mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update(); await act(async () => d.resolve([row({ naslov: 'Private old account' })]));
  expect(text()).toContain('Current account'); expect(text()).not.toContain('Private old account');
});
it('a pending write from the prior account incarnation cannot replace the current list or issue a read', async () => {
  const d = deferred(); mockWithdraw.mockReturnValueOnce(d.promise); await render(); await tap('Povuci prijavu: Unos ormara'); await act(async () => confirm()());
  mockRows = [row({ naslov: 'Current account' })]; mockAccount = { user: { id: 'owner-a' }, accountRevision: 3 }; await update();
  await act(async () => d.resolve({ ok: true, podatak: { stanje: 'WITHDRAWN', verzija: 2 } }));
  expect(mockRead).toHaveBeenCalledTimes(2); expect(text()).toContain('Current account'); expect(text()).not.toContain('Sačuvano stanje: Prijava je povučena.');
});
it('a confirmed command with a different fresh offer shows actual state and allows explicit review without claiming a matching offer', async () => {
  mockResolve.mockImplementationOnce(async () => { mockRows = [row({ prijavaVerzija: 3, cena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' } })]; return { ok: true, podatak: { status: 'SUBMITTED', version: 3 } }; });
  await review(); await tap('Zadrži prijavu'); expect(text()).not.toContain('Prijava je usklađena'); expect(text()).toContain('6.000 RSD');
  await tap('Pregledaj aktuelnu prijavu'); expect(press('Proveri sačuvano stanje')).toBeUndefined(); expect(mockResolve).toHaveBeenCalledTimes(1);
});
