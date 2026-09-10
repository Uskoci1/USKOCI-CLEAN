import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PublicationOutcome } from '../../contracts/publication';

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
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', CaretRight: 'Icon', Clock: 'Icon', MapPin: 'Icon', PencilSimple: 'Icon', UserMinus: 'Icon', Users: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button', Card: 'Card' }));
import Review from '../../app/(app)/potrebe/[id]/pregled';

function need(revizija = 7, stanje = 'NACRT') {
  return { id: NEED, revizija, stanje, naslov: 'Pregledani Zadatak', opis: 'Opis', podrucjeTekst: 'Novi Sad',
    vremeTekst: 'Po dogovoru', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: [], brojPrijava: 0 };
}
function evaluation(outcome: PublicationOutcome = 'ALLOW', needRevision = 7) {
  return { kind: 'DECISION', decision: { decisionId: '33333333-4444-4555-8666-777777777777', decisionSequence: 23,
    needId: NEED, needRevision, canonicalFingerprint: 'a'.repeat(64), policyBundleId: '44444444-5555-4666-8777-888888888888',
    policyVersion: 3, jurisdiction: 'RS', outcome, decisionAt: '2026-09-10T14:40:32.123456Z', ruleIds: ['RS_PUBLICATION_1'],
    safeReasonCodes: [], publishable: outcome === 'ALLOW', authoritative: true } };
}
const receipt = () => ({ needId: NEED, status: 'PUBLISHED', publishedAt: '2026-09-10T14:40:33.123456Z', responseDeadline: null, idempotentReplay: false });
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
const allow = async () => { await tap('Proveri za objavu'); await tap('Objavi Zadatak'); };
const readback = async () => { await act(async () => { await press('Pokušaj ponovo').props.onPress(); }); };
async function appState(state: string) { await act(async () => { mockAppState.currentState = state;
  [...mockAppListeners].forEach(listener => listener(state)); }); }
beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [mockNeed, mockSearch, mockClose, mockEdit, mockEvaluate, mockPublish]) mock.mockReset();
  mockId = NEED; mockIntent = 'narucilac'; mockFocused = true; mockAppState.currentState = 'active'; mockAppListeners.clear();
  mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
  mockNeed.mockResolvedValue(need()); mockSearch.mockResolvedValue({ closed: false, closedAt: null });
  mockEvaluate.mockResolvedValue(ok(evaluation())); mockPublish.mockResolvedValue(ok(receipt()));
  mockEdit.mockResolvedValue(ok({ needId: NEED, conversationId: CONVERSATION, revision: 7, needStatus: 'DRAFT', authoritative: true })); mockClose.mockResolvedValue(ok(null));
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

describe('R04 explicit canonical publication', () => {
  it.each(['Need', 'remaining search'] as const)('bounds a hanging %s read, keeps retry/back usable, and retires its late result', async source => {
    jest.useFakeTimers(); const pending = deferred();
    if (source === 'Need') mockNeed.mockReturnValueOnce(pending.promise); else mockSearch.mockReturnValueOnce(pending.promise);
    await render(); await act(async () => { jest.advanceTimersByTime(15_000); });
    expect(texts()).toContain('Učitavanje traje predugo');
    expect(press('Nazad').props.onPress).toEqual(expect.any(Function));
    expect(tree.root.findAllByProps({ label: 'Proveri za objavu' })).toHaveLength(0);
    mockNeed.mockResolvedValue({ ...need(8), naslov: 'Sveže učitani Zadatak' }); await readback();
    await act(async () => pending.resolve(source === 'Need' ? { ...need(), naslov: 'Zastareli Zadatak' } : { closed: true }));
    expect(texts()).toContain('Sveže učitani Zadatak'); expect(texts()).not.toContain('Zastareli Zadatak');
    mockEvaluate.mockResolvedValue(ok(evaluation('ALLOW', 8))); await tap('Proveri za objavu');
    expect(mockEvaluate).toHaveBeenCalledWith({ needId: NEED, expectedRevision: 8 });
    await act(async () => press('Nazad').props.onPress()); expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
  it('does not query on mount and presents policy NOT_READY as a nondecision with an explicit retry', async () => {
    mockEvaluate.mockResolvedValue(ok({ kind: 'NOT_READY', needId: NEED, needRevision: 7, authoritativeDecision: false, code: 'POLICY_NOT_READY' }));
    await render(); expect(mockEvaluate).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ label: 'Objavi Zadatak' })).toHaveLength(0);
    await tap('Proveri za objavu');
    expect(mockEvaluate).toHaveBeenCalledWith({ needId: NEED, expectedRevision: 7 });
    expect(texts()).toContain('Provera za objavu još nije dostupna. Nacrt je sačuvan.');
    expect(tree.root.findAllByProps({ label: 'Objavi Zadatak' })).toHaveLength(0);
    await tap('Ponovi proveru za objavu'); expect(mockEvaluate).toHaveBeenCalledTimes(2);
  });

  it.each<PublicationOutcome>(['CLARIFY', 'REVIEW', 'BLOCK'])('shows %s without a publish affordance or invented provider explanation', async outcome => {
    mockEvaluate.mockResolvedValue(ok(evaluation(outcome))); await render(); await tap('Proveri za objavu');
    expect(tree.root.findAllByProps({ label: 'Objavi Zadatak' })).toHaveLength(0);
    expect(button('Izmeni nacrt').props.disabled).toBe(false); expect(mockPublish).not.toHaveBeenCalled();
  });

  it('offers an owned readback when the evaluator reports NEED_CHANGED, instead of repeatedly evaluating the stale revision', async () => {
    mockEvaluate.mockResolvedValue(ok({ kind: 'NOT_READY', needId: NEED, needRevision: 7, authoritativeDecision: false, code: 'NEED_CHANGED' }));
    await render(); await tap('Proveri za objavu'); expect(texts()).toContain('Učitajte trenutno stanje pre nove provere');
    mockNeed.mockResolvedValue(need(8)); await readback(); mockEvaluate.mockResolvedValue(ok(evaluation('ALLOW', 8)));
    await tap('Proveri za objavu'); expect(mockEvaluate).toHaveBeenLastCalledWith({ needId: NEED, expectedRevision: 8 });
  });

  it.each([
    ['mismatched revision', { needRevision: 8 }], ['foreign need', { needId: OTHER }],
    ['unconfirmed decision', { authoritative: false }], ['false ALLOW', { publishable: false }],
    ['private provider text', { explanation: 'private database details' }],
  ])('rejects %s even when a service result is marked ok', async (_, change) => {
    const result = evaluation(); mockEvaluate.mockResolvedValue(ok({ ...result, decision: { ...result.decision, ...change } }));
    await render(); await tap('Proveri za objavu');
    expect(texts()).toContain('Rezultat provere nije potvrđen'); expect(texts()).not.toContain('private database');
    expect(tree.root.findAllByProps({ label: 'Objavi Zadatak' })).toHaveLength(0); expect(mockPublish).not.toHaveBeenCalled();
  });

  it('requires a separate native confirmation, serializes double taps, and reads a real published projection', async () => {
    const pending = deferred(); mockPublish.mockReturnValueOnce(pending.promise);
    await render(); await allow();
    expect(mockPublish).not.toHaveBeenCalled(); expect(mockAlert.mock.calls[0][1]).toContain('Dodatni rok za prijave nije izabran');
    const action = confirmation(); await act(async () => { action(); action(); });
    expect(mockPublish).toHaveBeenCalledTimes(1); expect(mockPublish.mock.calls[0][0]).toEqual({ needId: NEED, expectedRevision: 7,
      decisionSequence: 23, responseDeadline: null, clientRequestId: expect.any(String), confirmed: true });
    expect(texts()).not.toContain('Server je potvrdio objavu');
    mockNeed.mockResolvedValue(need(7, 'OBJAVLJENA'));
    await act(async () => pending.resolve(ok(receipt())));
    expect(mockNeed).toHaveBeenCalledTimes(2); expect(texts()).toContain('Objavljena');
    expect(texts()).toContain('ponovo učitano stanje'); expect(tree.root.findAllByProps({ label: 'Objavi Zadatak' })).toHaveLength(0);
  });

  it.each(['account before render', 'account incarnation', 'blur and return', 'background and return', 'route'])(
    'retires a retained native confirmation after %s', async reason => {
      await render(); await allow(); const retained = confirmation();
      if (reason === 'account before render') mockSession = { user: { id: OTHER }, accountRevision: 2 };
      else if (reason === 'account incarnation') mockSession = { user: { id: ACCOUNT }, accountRevision: 3 };
      else if (reason === 'blur and return') { mockFocused = false; await update(); mockFocused = true; await update(); }
      else if (reason === 'background and return') { await appState('background'); await appState('active'); }
      else { mockId = OTHER; mockNeed.mockResolvedValue({ ...need(), id: OTHER }); await update(); }
      await act(async () => retained()); expect(mockPublish).not.toHaveBeenCalled();
    });

  it('clears a prior ALLOW on background even when the same revision is read on return', async () => {
    await render(); await tap('Proveri za objavu'); await appState('inactive'); await appState('active');
    expect(tree.root.findAllByProps({ label: 'Objavi Zadatak' })).toHaveLength(0);
    expect(mockEvaluate).toHaveBeenCalledTimes(1); expect(mockNeed).toHaveBeenCalledTimes(2);
  });

  it.each(['account', 'blur'] as const)('ignores a late evaluation after %s changes', async reason => {
    const pending = deferred(); mockEvaluate.mockReturnValueOnce(pending.promise);
    await render(); await act(async () => { void button('Proveri za objavu').props.onPress(); });
    if (reason === 'account') mockSession = { user: { id: OTHER }, accountRevision: 2 }; else mockFocused = false;
    await update(); await act(async () => pending.resolve(ok(evaluation())));
    expect(tree.root.findAllByProps({ label: 'Objavi Zadatak' })).toHaveLength(0); expect(mockPublish).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'thrown', 'malformed receipt'] as const)('reads back after %s and retries the identical intent and key', async reason => {
    if (reason === 'rejected') mockPublish.mockResolvedValueOnce({ ok: false, kod: 'UNCONFIRMED', poruka: 'Objava nije potvrđena.' });
    else if (reason === 'thrown') mockPublish.mockRejectedValueOnce(new Error('secret server detail'));
    else mockPublish.mockResolvedValueOnce(ok({ ...receipt(), needId: OTHER }));
    await render(); await allow(); await confirm(); const command = mockPublish.mock.calls[0][0];
    expect(texts()).not.toContain('Server je potvrdio objavu'); expect(texts()).not.toContain('secret server detail');
    expect(tree.root.findAllByProps({ label: 'Ponovi isti zahtev za objavu' })).toHaveLength(0);
    await readback(); await tap('Ponovi isti zahtev za objavu'); expect(mockPublish).toHaveBeenCalledTimes(1);
    mockNeed.mockResolvedValue(need(7, 'OBJAVLJENA')); await confirm();
    expect(mockPublish).toHaveBeenCalledTimes(2); expect(mockPublish.mock.calls[1][0]).toEqual(command);
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
  });

  it('drops a previous unknown intent after a changed revision and creates a new key only after fresh evaluation and confirmation', async () => {
    mockPublish.mockResolvedValueOnce({ ok: false, kod: 'UNKNOWN', poruka: 'Objava nije potvrđena.' });
    await render(); await allow(); await confirm(); const oldCommand = mockPublish.mock.calls[0][0];
    mockNeed.mockResolvedValue(need(8)); await readback();
    expect(tree.root.findAllByProps({ label: 'Ponovi isti zahtev za objavu' })).toHaveLength(0);
    mockEvaluate.mockResolvedValue(ok(evaluation('ALLOW', 8))); await allow();
    mockNeed.mockResolvedValue(need(8, 'OBJAVLJENA')); await confirm();
    expect(mockPublish.mock.calls[1][0].expectedRevision).toBe(8);
    expect(mockPublish.mock.calls[1][0].clientRequestId).not.toBe(oldCommand.clientRequestId);
  });

  it.each(['PUBLICATION_POLICY_STALE', 'PUBLICATION_CONTEXT_STALE', 'PUBLICATION_CONTEXT_NOT_READY', 'PUBLICATION_DECISION_NOT_ALLOW', 'PUBLICATION_DECISION_CONTEXT_STALE'])(
    'requires readback and a new explicit evaluation after the definitive server rejection %s', async kod => {
      mockPublish.mockResolvedValueOnce({ ok: false, kod, poruka: 'Potrebna je nova provera pre objave.' });
      await render(); await allow(); await confirm(); const oldCommand = mockPublish.mock.calls[0][0];
      expect(tree.root.findAllByProps({ label: 'Proveri za objavu' })).toHaveLength(0);
      await readback(); expect(tree.root.findAllByProps({ label: 'Ponovi isti zahtev za objavu' })).toHaveLength(0);
      const fresh = evaluation(); fresh.decision.decisionSequence = 24; mockEvaluate.mockResolvedValue(ok(fresh));
      await allow(); expect(mockPublish).toHaveBeenCalledTimes(1); mockNeed.mockResolvedValue(need(7, 'OBJAVLJENA')); await confirm();
      expect(mockPublish.mock.calls[1][0].decisionSequence).toBe(24);
      expect(mockPublish.mock.calls[1][0].clientRequestId).not.toBe(oldCommand.clientRequestId);
    });

  it('reports an accepted publication receipt with refresh needed when the fresh read fails, without manufacturing a card', async () => {
    await render(); await allow(); mockNeed.mockRejectedValueOnce(new Error('private SQL failure')); await confirm();
    expect(texts()).toContain('Objava je potvrđena. Trenutni prikaz treba osvežiti.');
    expect(texts()).not.toContain('Pregledani Zadatak'); expect(texts()).not.toContain('Objavljena');
    expect(texts()).not.toContain('private SQL'); mockNeed.mockResolvedValue(need(7, 'OBJAVLJENA'));
    await readback(); expect(texts()).toContain('Objavljena'); expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('does not claim a fresh projection while the post-receipt read is pending', async () => {
    const pending = deferred(); await render(); await allow(); mockNeed.mockReturnValueOnce(pending.promise); await confirm();
    expect(texts()).toContain('Objava je potvrđena. Učitavamo trenutno stanje');
    expect(texts()).not.toContain('Prikazujemo ponovo učitano');
    await act(async () => pending.resolve(need(7, 'OBJAVLJENA'))); expect(texts()).toContain('Prikazujemo ponovo učitano');
  });

  it.each(['account', 'blur'] as const)('does not expose a late publication receipt after %s changes', async reason => {
    const pending = deferred(); mockPublish.mockReturnValueOnce(pending.promise); await render(); await allow(); await confirm();
    if (reason === 'account') mockSession = { user: { id: OTHER }, accountRevision: 2 }; else mockFocused = false;
    await update(); await act(async () => pending.resolve(ok(receipt())));
    expect(texts()).not.toContain('Objava je potvrđena'); expect(texts()).not.toContain('Server je potvrdio objavu');
  });

  it('uses the existing DRAFT edit path only after an actual accepted open-edit receipt', async () => {
    await render(); await tap('Izmeni nacrt'); expect(mockEdit).not.toHaveBeenCalled(); await confirm();
    expect(mockEdit).toHaveBeenCalledWith(NEED);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CONVERSATION } });
  });

  it('does not open an invented edit route from a malformed receipt', async () => {
    mockEdit.mockResolvedValueOnce(ok({ needId: OTHER, conversationId: CONVERSATION, revision: 7 }));
    await render(); await tap('Izmeni nacrt'); await confirm(); expect(mockRouter.push).not.toHaveBeenCalled();
    expect(texts()).toContain('Otvaranje izmene nije potvrđeno');
  });

  it('does not silently navigate into a server-opened newer revision from an old confirmation', async () => {
    mockEdit.mockResolvedValueOnce(ok({ needId: NEED, conversationId: CONVERSATION, revision: 8, needStatus: 'DRAFT', authoritative: true }));
    await render(); await tap('Izmeni nacrt'); await confirm(); expect(mockRouter.push).not.toHaveBeenCalled();
    expect(texts()).toContain('Zadatak je promenjen. Učitajte trenutno stanje');
  });

  it('gates publication by requester intent and rejects stale read retry callbacks after blur', async () => {
    mockNeed.mockRejectedValueOnce(new Error('offline')); await render(); const retry = press('Pokušaj ponovo').props.onPress;
    mockFocused = false; await update(); mockFocused = true; await update();
    await act(async () => retry()); expect(mockNeed).toHaveBeenCalledTimes(2);
    mockIntent = 'radnik'; await update(); expect(tree.root.findAllByProps({ label: 'Proveri za objavu' })).toHaveLength(0);
  });

  it('preserves published remaining-search closure with one confirmed command and an authoritative reread', async () => {
    mockNeed.mockResolvedValue({ ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    await render(); await act(async () => press('Ne traži više nikoga').props.onPress());
    expect(mockClose).not.toHaveBeenCalled(); mockSearch.mockResolvedValue({ closed: true });
    const action = confirmation(); await act(async () => { action(); action(); });
    expect(mockClose).toHaveBeenCalledTimes(1); expect(mockClose).toHaveBeenCalledWith(NEED, 7, expect.any(String));
    expect(mockNeed).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Ne traži više nikoga' })).toHaveLength(0);
  });

  it.each(['edit', 'remaining search'] as const)('retires retained published %s confirmation on blur', async action => {
    mockNeed.mockResolvedValue(action === 'edit' ? need(7, 'OBJAVLJENA')
      : { ...need(7, 'DELIMICNO_POPUNJENA'), pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } });
    await render(); await act(async () => press(action === 'edit' ? 'Izmeni Zadatak' : 'Ne traži više nikoga').props.onPress());
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
  it('keeps one primary publication action outside the scroll with bottom safe area', async () => {
    await render(); const action = button('Proveri za objavu');
    let parent = action.parent;
    while (parent) { expect(parent.type).not.toBe('ScrollView'); parent = parent.parent; }
    expect(tree.root.findByType('SafeAreaView' as React.ElementType).props.edges).toEqual(['top', 'bottom']);
    expect(tree.root.findAllByProps({ label: 'Proveri za objavu' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ label: 'Pogledaj prijave' })).toHaveLength(0);
    expect(texts()).not.toContain('HITNO'); expect(texts()).not.toContain('Pitanja i odgovori');
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
});
