import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const NEED = '22222222-3333-4444-8555-666666666666';
const ACCOUNT = '11111111-2222-4333-8444-555555555555';
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const CONVERSATION = '55555555-6666-4777-8888-999999999999';
let mockId = NEED, mockIntent = 'narucilac', mockFocused = true;
let mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
const mockNeed = jest.fn(), mockSearch = jest.fn(), mockClose = jest.fn(), mockEdit = jest.fn();
const mockEvaluate = jest.fn(), mockPublish = jest.fn(), mockAlert = jest.fn();
const mockSource = { potreba: (...args: unknown[]) => mockNeed(...args) };
const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockAppListeners = new Set<(state: string) => void>();
const mockAppState = { currentState: 'active', addEventListener: (_: string, fn: (state: string) => void) => {
  mockAppListeners.add(fn); return { remove: () => mockAppListeners.delete(fn) };
} };
// A fresh installation has no pending terminal command. Publication itself is
// exercised by v5-review-screen; this suite verifies the saved-Task bridge.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined),
} }));
jest.mock('../../data', () => ({ aiNeedV2Izvor: { openEditConversation: (...args: unknown[]) => mockEdit(...args) } }));
jest.mock('../ru4Production', () => ({ ru4Production: {
  remainingSearchState: (...args: unknown[]) => mockSearch(...args), closeRemainingSearch: (...args: unknown[]) => mockClose(...args),
} }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('Unexpected transport'); } }));
jest.mock('../publicationClientService', () => ({ ...jest.requireActual('../publicationClientService'), publicationClientService: {
  evaluate: (...args: unknown[]) => mockEvaluate(...args), publish: (...args: unknown[]) => mockPublish(...args),
} }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent, useIzvor: () => mockSource }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Alert') return { alert: mockAlert };
    if (key === 'AppState') return mockAppState;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', CaretRight: 'Icon', Clock: 'Icon', MapPin: 'Icon', PencilSimple: 'Icon', UserMinus: 'Icon', Users: 'Icon', Wallet: 'Icon', Lightning: 'Icon', PaperPlaneTilt: 'Icon' , ChatsCircle: 'Icon', ArrowsLeftRight: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button', Card: 'Card' }));
import Review from '../../app/(app)/potrebe/[id]/pregled';

function need(revizija = 7, stanje = 'NACRT') {
  return { id: NEED, revizija, stanje, naslov: 'Pregledani Zadatak', opis: 'Opis', podrucjeTekst: 'Novi Sad',
    vremeTekst: 'Po dogovoru', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [], brojPrijava: 0 };
}
const ok = (podatak: unknown) => ({ ok: true, podatak });
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Review />); }); };
const update = async () => { await act(async () => tree.update(<Review />)); };
const button = (label: string) => tree.root.findByProps({ label });
const press = (accessibilityLabel: string) => tree.root.findByProps({ accessibilityLabel });
const texts = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const tap = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
const confirmation = () => mockAlert.mock.calls[mockAlert.mock.calls.length - 1][2][1].onPress;
const confirm = async () => { const action = confirmation(); await act(async () => { action(); }); };
const readback = async () => { await act(async () => { await press('Pokušaj ponovo').props.onPress(); }); };
async function appState(state: string) { await act(async () => { mockAppState.currentState = state;
  [...mockAppListeners].forEach(listener => listener(state)); }); }
beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [mockNeed, mockSearch, mockClose, mockEdit, mockEvaluate, mockPublish]) mock.mockReset();
  mockId = NEED; mockIntent = 'narucilac'; mockFocused = true; mockAppState.currentState = 'active'; mockAppListeners.clear();
  mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockNeed.mockResolvedValue(need()); mockSearch.mockResolvedValue({ closed: false, closedAt: null });
  mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true })); mockClose.mockResolvedValue(ok(null));
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

describe('V5 saved Task enters the same single acceptance review', () => {
  it('opens the authoritative owned review without a provider call, publication or extra confirmation', async () => {
    await render(); expect(mockEdit).not.toHaveBeenCalled();
    await tap('Pregledaj za objavu');
    expect(mockEdit).toHaveBeenCalledWith(NEED);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pregled-zadatka', params: { conversationId: CONVERSATION } });
    expect(mockEvaluate).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled(); expect(mockAlert).not.toHaveBeenCalled();
  });
  it('keeps manual conversation editing available without a separate draft confirmation', async () => {
    await render(); await tap('Izmeni nacrt');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
    expect(mockAlert).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
  });
  it('serializes retained double taps and navigates only after an exact server receipt', async () => {
    const pending = deferred(); mockEdit.mockReturnValueOnce(pending.promise); await render();
    const action = button('Pregledaj za objavu').props.onPress;
    await act(async () => { action(); action(); });
    expect(mockEdit).toHaveBeenCalledTimes(1); expect(mockRouter.push).not.toHaveBeenCalled();
    await act(async () => pending.resolve(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true })));
    expect(mockRouter.push).toHaveBeenCalledTimes(1); expect(mockPublish).not.toHaveBeenCalled();
  });
  it.each([
    ['foreign Task', { needId: OTHER }], ['missing conversation', { conversationId: null }],
    ['invalid conversation', { conversationId: 'not-a-uuid' }], ['missing authority', { authoritative: false }],
    ['unsupported status', { needStatus: 'CANCELLED' }], ['invalid revision', { revision: 0 }],
  ])('rejects %s in a successful-looking open receipt', async (_, patch) => {
    mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true, ...patch }));
    await render(); await tap('Pregledaj za objavu');
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(texts()).toContain('Otvaranje izmene nije potvrđeno'); expect(mockPublish).not.toHaveBeenCalled();
  });
  it.each([{ revision: 8 }, { needStatus: 'PUBLISHED' }])('requires a fresh read if Task revision or draft status changed: %j', async patch => {
    mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true, ...patch }));
    await render(); await tap('Pregledaj za objavu');
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(texts()).toContain('Zadatak je promenjen');
  });
  it.each(['account before render', 'account incarnation', 'blur and return', 'background and return', 'route'])('retires a retained review callback after %s', async reason => {
    await render(); const retained = button('Pregledaj za objavu').props.onPress;
    if (reason === 'account before render') mockSession = { user: { id: OTHER }, accountRevision: 2 };
    else if (reason === 'account incarnation') mockSession = { user: { id: ACCOUNT }, accountRevision: 3 };
    else if (reason === 'blur and return') { mockFocused = false; await update(); mockFocused = true; await update(); }
    else if (reason === 'background and return') { await appState('background'); await appState('active'); }
    else { mockId = OTHER; mockNeed.mockResolvedValue({ ...need(), id: OTHER }); await update(); }
    await act(async () => retained()); expect(mockEdit).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  });
  it.each(['account', 'blur', 'background'] as const)('ignores a late server-opened review after %s changes', async reason => {
    const pending = deferred(); mockEdit.mockReturnValueOnce(pending.promise); await render(); await tap('Pregledaj za objavu');
    if (reason === 'account') { mockSession = { user: { id: OTHER }, accountRevision: 2 }; await update(); }
    else if (reason === 'blur') { mockFocused = false; await update(); } else await appState('background');
    await act(async () => pending.resolve(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true })));
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
  });
  it.each(['rejected', 'thrown'])('requires readback after an unknown open outcome: %s', async kind => {
    if (kind === 'rejected') mockEdit.mockResolvedValueOnce({ ok: false, kod: 'UNKNOWN', poruka: 'Otvaranje nije potvrđeno.' });
    else mockEdit.mockRejectedValueOnce(new Error('private SQL secret'));
    await render(); await tap('Pregledaj za objavu');
    expect(mockRouter.push).not.toHaveBeenCalled(); expect(texts()).not.toContain('private SQL');
    expect(tree.root.findAllByProps({ label: 'Pregledaj za objavu' })).toHaveLength(0);
    await readback(); await tap('Pregledaj za objavu'); expect(mockEdit).toHaveBeenCalledTimes(2);
  });
  it.each(['Need', 'remaining search'] as const)('bounds a hanging %s read and retires its late result', async source => {
    jest.useFakeTimers(); const pending = deferred();
    if (source === 'Need') mockNeed.mockReturnValueOnce(pending.promise); else mockSearch.mockReturnValueOnce(pending.promise);
    await render(); await act(async () => { jest.advanceTimersByTime(15_000); });
    expect(texts()).toContain('Učitavanje traje predugo');
    mockNeed.mockResolvedValue({ ...need(8), naslov: 'Sveže učitani Zadatak' }); await readback();
    await act(async () => pending.resolve(source === 'Need' ? { ...need(), naslov: 'Zastareli Zadatak' } : { closed: true }));
    expect(texts()).toContain('Sveže učitani Zadatak'); expect(texts()).not.toContain('Zastareli Zadatak');
    mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 8, needStatus: 'DRAFT', authoritative: true }));
    await tap('Pregledaj za objavu'); expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });
  it('gates the owner review by requester intent and validates route before reads', async () => {
    mockId = 'invalid'; await render(); expect(mockNeed).not.toHaveBeenCalled();
    mockId = NEED; mockIntent = 'radnik'; await update();
    expect(tree.root.findAllByProps({ label: 'Pregledaj za objavu' })).toHaveLength(0);
  });
  it('preserves partial-search closure with one confirmed command and actual reread', async () => {
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    await render(); await tap('Ne traži više nikoga'); expect(mockClose).not.toHaveBeenCalled(); mockSearch.mockResolvedValue({ closed: true });
    const action = confirmation(); await act(async () => { action(); action(); });
    expect(mockClose).toHaveBeenCalledTimes(1); expect(mockClose).toHaveBeenCalledWith(NEED, 7, expect.any(String)); expect(mockNeed).toHaveBeenCalledTimes(2);
  });
  it.each(['edit', 'remaining search'] as const)('retires retained published %s confirmation on blur', async action => {
    mockNeed.mockResolvedValue(action === 'edit' ? need(7, 'OBJAVLJENA')
      : { ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    await render(); await tap(action === 'edit' ? 'Izmeni Zadatak' : 'Ne traži više nikoga');
    const retained = confirmation(); mockFocused = false; await update(); mockFocused = true; await update();
    await act(async () => retained()); expect(mockEdit).not.toHaveBeenCalled(); expect(mockClose).not.toHaveBeenCalled();
  });
});

describe('V2 saved Need presentation', () => {
  it('shows authoritative detail values and every location/requirement on explicit disclosure', async () => {
    mockNeed.mockResolvedValue({ ...need(), opis: 'Čćšžđ '.repeat(800), rezimCene: 'OFFERS', taskCountryCode: 'RS',
      vremeTekst: '10. sep 2026 · 18:00 – 10. sep 2026 · 19:00 (Europe/Belgrade)',
      schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-10T16:00:00Z', endsAt: '2026-09-10T17:00:00Z' },
      detalji: { kategorija: 'Prevoz', geografija: { mode: 'MULTI_STOP', start: { city: 'Novi Sad' },
        waypoints: [{ city: 'Beočin' }, { city: 'Petrovaradin' }], end: { city: 'Kamenica' } }, rezimLokacije: 'MULTI_STOP',
        zahtevi: { vestine: [], alati: ['Alat, jedan', 'Alat, jedan'], vozila: [], dozvole: ['B kategorija'],
          bitniUslovi: ['Bez lifta'], iskustvoGodina: 3, potvrdjenIdentitet: true } } });
    await render();
    expect(texts()).toContain('Prevoz'); expect(texts()).toContain('Tražim ponude');
    expect(texts()).toContain('19:00'); expect(texts()).toContain('Čćšžđ '.repeat(800));
    expect(texts()).not.toContain('Petrovaradin');
    await act(async () => press('Mesto izvršenja').props.onPress());
    for (const value of ['Stanica 1', 'Stanica 2', 'Odredište', 'Beočin', 'Petrovaradin', 'Kamenica', 'RS']) expect(texts()).toContain(value);
    await act(async () => press('Svi uslovi').props.onPress());
    expect(texts()).not.toContain('Petrovaradin');
    for (const value of ['• Alat, jedan', 'B kategorija', 'Bez lifta', '3 god.', 'Potreban je potvrđen identitet']) expect(texts()).toContain(value);
    expect(mockEvaluate).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
    expect(texts()).not.toContain('Revizija 7');
  });
  it('keeps one primary review action outside the scroll with bottom safe area', async () => {
    await render(); const action = button('Pregledaj za objavu');
    let parent = action.parent;
    while (parent) { expect(parent.type).not.toBe('ScrollView'); parent = parent.parent; }
    expect(tree.root.findByType('SafeAreaView' as React.ElementType).props.edges).toEqual(['top', 'bottom']);
    expect(tree.root.findAllByProps({ label: 'Pregledaj za objavu' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ label: 'Pogledaj prijave' })).toHaveLength(0);
    expect(texts()).not.toContain('HITNO'); expect(texts()).toContain('Otvori pitanja i odgovore');
  });
  it('does not display a raw transport secret attached outside the public projection', async () => {
    mockNeed.mockResolvedValue({ ...need(), need_sensitive: { exact_address: 'SECRET address', exact_lat: 45.123456 }, resolved_location: 'SECRET pin' });
    await render(); await act(async () => press('Mesto izvršenja').props.onPress());
    expect(texts()).not.toMatch(/SECRET|45.123456/);
    expect(texts()).toContain('Javna struktura lokacije nije dostupna. Prikazano je približno područje.');
  });
  it('provides the real candidates route after publication and no duplicate publication action', async () => {
    mockNeed.mockResolvedValue({ ...need(7, 'OBJAVLJENA'), brojPrijava: 3 }); await render();
    expect(tree.root.findAllByProps({ label: 'Objavi Zadatak' })).toHaveLength(0);
    await tap('Pogledaj prijave');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/kandidati', params: { id: NEED } });
  });
  it('opens Task-scoped questions with the loaded identity and rejects a callback after blur', async () => {
    await render(); const retained = press('Otvori pitanja i odgovore').props.onPress;
    mockFocused = false; await update(); mockFocused = true; await update();
    await act(async () => retained()); expect(mockRouter.push).not.toHaveBeenCalled();
    await act(async () => press('Otvori pitanja i odgovore').props.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pitanja-zadatka', params: { needId: NEED } });
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
