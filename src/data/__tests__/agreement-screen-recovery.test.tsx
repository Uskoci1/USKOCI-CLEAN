import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockAccount = '10000000-0000-4000-8000-000000000001';
let mockAccountRevision = 0;
let mockPlatform = 'android';
let mockFocused = true;
const mockAppListeners = new Set<(state: string) => void>();
let mockId: string | string[] = '20000000-0000-4000-8000-000000000001';
const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn(), push: jest.fn() };
const mockGroupContext = jest.fn();
const mockRead = jest.fn();
const mockMessages = jest.fn();
const mockProblemSubmit = jest.fn(), mockProblemRead = jest.fn();
const mockPhotoRead = jest.fn((_id: string, rows: unknown[]) => Promise.resolve(rows));
const mockSource = { dogovor: mockRead, poruke: mockMessages, oznaciZavrsetak: jest.fn(), potvrdiZavrsetak: jest.fn(),
  prijaviProblem: jest.fn(), podeliTelefon: jest.fn(), opoziviTelefon: jest.fn() };
const mockOutbox = { reconcile: jest.fn().mockResolvedValue(undefined) };
let mockOutboxState = { phase: 'loading', entries: [] as any[] };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: mockPlatform };
    if (key === 'AppState') return { currentState: 'active', addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppListeners.add(listener); return { remove: () => mockAppListeners.delete(listener) };
    } };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../agreementClientService', () => ({ agreementProblemService: { submit: (...args: unknown[]) => mockProblemSubmit(...args), read: (...args: unknown[]) => mockProblemRead(...args) } }));
jest.mock('../groupConversationService', () => ({ groupConversationService: { context: (...args: unknown[]) => mockGroupContext(...args) } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => undefined } }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Card: 'Card' }));
// The Dogovor shows each side's photograph since pkg024a, and that module reaches supabaseClient,
// which registers an AppState listener the moment it is required — before this suite's own
// listener set exists. Every screen suite in this repo stubs the media module for that reason.
jest.mock('../../ui/media/ContextPhotos', () => ({ ProfilePhoto: 'ProfilePhoto', NeedPhotos: 'NeedPhotos' }));
jest.mock('../../ui/AgreementChat', () => ({ AgreementChat: 'AgreementChat' }));
// Keep the real private-location/session boundary; only the native map renderer is external to this route test.
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PrivateMap' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockAccountRevision }), sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockAccountRevision }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource }));
jest.mock('../../hooks/useAgreementOutbox', () => ({ useAgreementOutbox: () => ({ model: mockOutbox, state: mockOutboxState }) }));
jest.mock('../../hooks/useAgreementPhotos', () => ({ useAgreementPhotos: () => ({ agreementId: mockId, loaded: true, busy: false, items: [] }) }));
jest.mock('../agreementPhotoClientService', () => ({ agreementPhotoClientService: { messages: (...args: Parameters<typeof mockPhotoRead>) => mockPhotoRead(...args) } }));
import Dogovor from '../../app/dogovor/[id]';

const workspace = { id: '20000000-0000-4000-8000-000000000001', naslov: 'Pomoć pri selidbi', stanje: 'CONFIRMED',
  verzija: 1, cena: { prikaz: '3.000 RSD' }, pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0 },
  ucesnici: [{ id: '10000000-0000-4000-8000-000000000001', ime: 'Ana', inicijali: 'AN', uloga: 'narucilac', mesta: null, viSte: true },
    { id: '10000000-0000-4000-8000-000000000002', ime: 'Marko', inicijali: 'MA', uloga: 'uskocer', mesta: 1, viSte: false }],
  hronologija: [], kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false },
  chatDostupan: true, vremeTekst: 'Fleksibilno', putanjaTekst: 'Beograd', problemOtvoren: false, rokPotvrdeIso: null,
  radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false } };
const ownMessage = { id: '30000000-0000-4000-8000-000000000001', clientMessageId: 'poruka_retry_123',
  dogovorVerzija: 2, posiljalacAccountId: '10000000-0000-4000-8000-000000000001', telo: 'Stižem.', moja: true };
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
async function render() { await act(async () => { tree = create(<Dogovor />); }); }
beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset(); mockMessages.mockReset();
  mockAccount = ownMessage.posiljalacAccountId; mockId = workspace.id;
  mockAccountRevision = 0;
  mockFocused = true;
  mockPlatform = 'android';
  mockRouter.canGoBack.mockReturnValue(true);
  mockRead.mockResolvedValue(workspace); mockMessages.mockResolvedValue([ownMessage]);
  mockProblemSubmit.mockReset().mockResolvedValue({ ok: false, kod: 'NOT_CONFIGURED', poruka: 'unconfirmed' });
  mockProblemRead.mockReset();
  mockPhotoRead.mockReset().mockImplementation((_id, rows) => Promise.resolve(rows));
  mockGroupContext.mockReset().mockResolvedValue({ ok: true, podatak: { group: null } });
  mockOutboxState = { phase: 'loading', entries: [] };
  for (const name of ['oznaciZavrsetak', 'potvrdiZavrsetak', 'prijaviProblem', 'podeliTelefon', 'opoziviTelefon'] as const) {
    mockSource[name].mockReset().mockResolvedValue({ ok: true, podatak: null });
  }
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });
describe('D03 actual route and scoped resource integration', () => {
  it('opens the server-admitted group for this owned Agreement with its unread count', async () => {
    mockGroupContext.mockResolvedValue({ ok: true, podatak: { group: { groupId: '30000000-0000-4000-8000-000000000001', unreadCount: 2 } } });
    await render();
    expect(mockGroupContext).toHaveBeenCalledWith(workspace.id, { accountId: mockAccount, accountRevision: 0 });
    await act(async () => button('Grupni razgovor · 2 nepročitanih').props.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dogovor/[id]/grupa', params: { id: workspace.id } });
  });
  it.each(['android', 'ios'])('owns keyboard avoidance at the full-screen boundary on %s without changing workspace/outbox authority', async platform => {
    mockPlatform = platform;
    await render();
    const avoidance = tree.root.findByType('KeyboardAvoidingView' as any);
    expect(avoidance.parent?.type).toBe('SafeAreaView');
    expect(avoidance.props.enabled).toBe(false);
    expect(avoidance.props.behavior).toBe(platform === 'ios' ? 'padding' : 'height');
    expect(avoidance.props.keyboardVerticalOffset).toBeUndefined();
    expect(avoidance.findByProps({ accessibilityLabel: 'Nazad' })).toBeTruthy();
    await act(async () => button('Poruke').props.onPress());
    expect(tree.root.findAllByType('KeyboardAvoidingView' as any)).toHaveLength(1);
    expect(avoidance.props.enabled).toBe(true);
    const chat = avoidance.findByType('AgreementChat' as any);
    expect(chat.props.outbox).toBe(mockOutbox);
    expect(chat.props.state).toBe(mockOutboxState);
    expect(chat.props.writable).toBe(true);
    expect(chat.props.messages).toEqual([ownMessage]);
    await act(async () => button('Pregled').props.onPress());
    expect(avoidance.props.enabled).toBe(false);
    expect(texts()).toContain(workspace.naslov);
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockMessages).toHaveBeenCalledTimes(1);
  });
  it('reconciles a server read again after outbox hydration becomes ready', async () => {
    await render(); expect(mockMessages).toHaveBeenCalledWith(workspace.id, mockAccount);
    mockOutbox.reconcile.mockClear(); mockOutboxState = { phase: 'ready', entries: [] };
    await act(async () => tree.update(<Dogovor />));
    expect(mockOutbox.reconcile).toHaveBeenCalledWith([{ senderAccountId: mockAccount,
      clientMessageId: ownMessage.clientMessageId, messageId: ownMessage.id, body: ownMessage.telo }]);
  });
  it('invalid/array route cannot read private data and retains a safe Back destination', async () => {
    mockId = [workspace.id]; mockRouter.canGoBack.mockReturnValue(false);
    await render(); expect(mockRead).not.toHaveBeenCalled(); expect(mockMessages).not.toHaveBeenCalled();
    await act(async () => button('Nazad').props.onPress());
    expect(mockRouter.replace).toHaveBeenCalledWith('/dogovori');
  });
  it('loading and read failure both retain Back; retry recovers the actual workspace', async () => {
    let rejectRead!: (error: Error) => void;
    mockRead.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRead = reject; }));
    await render(); expect(button('Nazad')).toBeTruthy();
    await act(async () => rejectRead(new Error('offline')));
    expect(texts()).toContain('Dogovor nije učitan'); expect(texts()).not.toContain('Dogovor nije dostupan');
    await act(async () => button('Ponovo učitaj Dogovor').props.onPress());
    expect(texts()).toContain(workspace.naslov);
  });
  it('late account A message read cannot reconcile into the new account B screen', async () => {
    let resolveA!: (data: unknown) => void;
    mockMessages.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; })).mockResolvedValue([]);
    await render(); mockOutbox.reconcile.mockClear();
    mockAccount = '10000000-0000-4000-8000-000000000002';
    await act(async () => tree.update(<Dogovor />));
    mockOutbox.reconcile.mockClear();
    await act(async () => resolveA([ownMessage]));
    expect(mockOutbox.reconcile).not.toHaveBeenCalled();
  });
  it('a server read-only refusal rechecks the workspace instead of keeping a stale composer active', async () => {
    mockOutboxState = { phase: 'ready', entries: [] }; await render();
    mockRead.mockResolvedValue({ ...workspace, chatDostupan: false });
    mockOutboxState = { phase: 'ready', entries: [{ command: { clientMessageId: 'poruka_retry_123' }, error: 'READ_ONLY', attempt: 1 }] };
    await act(async () => tree.update(<Dogovor />));
    await act(async () => button('Poruke').props.onPress());
    const chat = tree.root.findByType('AgreementChat' as any);
    expect(chat.props.terminal).toBe(true); expect(chat.props.writable).toBe(false);
    expect(mockRead).toHaveBeenCalledTimes(2);
  });
  it('batched A→B→A cannot revive an old message read even before React renders the changed session', async () => {
    let resolveA!: (data: unknown) => void;
    mockMessages.mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }));
    await render(); mockOutbox.reconcile.mockClear();
    mockAccountRevision += 2; // Auth store observed both transitions; visible ID is A again.
    await act(async () => resolveA([ownMessage]));
    expect(mockOutbox.reconcile).not.toHaveBeenCalled();
  });
  it('uses the actual Agreement party role for completion even with the opposite selected intent', async () => {
    mockRead.mockResolvedValue({ ...workspace, radnje: { mozeOznacitiZavrsetak: true, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false },
      ucesnici: workspace.ucesnici.map(party => ({ ...party, uloga: party.viSte ? 'uskocer' : 'narucilac' })) });
    await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi završetak' })).toHaveLength(0);
    await act(async () => button('Završio sam').props.onPress());
    expect(mockSource.oznaciZavrsetak).toHaveBeenCalledWith(workspace.id);
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalledTimes(2);
  });
  it('serializes double completion and blocks cross-action writes until authoritative readback', async () => {
    let resolve!: (result: unknown) => void;
    mockSource.potvrdiZavrsetak.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render();
    await act(async () => button('Kontakt').props.onPress());
    const complete = button('Potvrdi završetak').props.onPress;
    const share = button('Podeli svoj broj').props.onPress;
    await act(async () => { complete(); complete(); share(); });
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    expect(mockSource.podeliTelefon).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalledTimes(1);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => resolve({ ok: true, podatak: null }));
    expect(texts()).toContain('Dogovor je završen');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi završetak' })).toHaveLength(0);
  });
  it('an unknown completion remains fenced until explicit successful reconciliation', async () => {
    mockSource.potvrdiZavrsetak.mockResolvedValueOnce({ ok: false, kod: 'TIMEOUT', poruka: 'secret upstream detail' });
    await render();
    const complete = button('Potvrdi završetak').props.onPress;
    await act(async () => complete());
    expect(texts()).toContain('Promena nije potvrđena');
    expect(texts()).not.toContain('secret upstream detail');
    await act(async () => complete());
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
  });
  it('a retained action cannot submit after an A→B→A auth incarnation change', async () => {
    await render(); const complete = button('Potvrdi završetak').props.onPress;
    mockAccountRevision += 2;
    await act(async () => complete());
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  });
  it.each(['CANCELLED', 'COMPLETED'])('a %s Agreement has no completion action', async state => {
    mockRead.mockResolvedValue({ ...workspace, stanje: state }); await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi završetak' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Završio sam' })).toHaveLength(0);
  });
  it('requires an explicit narrative for a problem and preserves its draft on failure', async () => {
    mockRead.mockResolvedValue({ ...workspace, stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-12T14:00:00Z' });
    mockProblemSubmit.mockResolvedValueOnce({ ok: false, kod: 'OFFLINE', poruka: 'provider detail' });
    await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' })).toHaveLength(0);
    await act(async () => button('Prijavi problem').props.onPress());
    expect(button('Pošalji prijavu problema').props.disabled).toBe(true);
    expect(tree.root.findByType('KeyboardAvoidingView' as any).props.enabled).toBe(true);
    await act(async () => button('Opiši problem').props.onChangeText('  Nisu prenete poslednje kutije.  '));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(mockProblemSubmit).toHaveBeenCalledWith(workspace.id, 'Nisu prenete poslednje kutije.', { accountId: mockAccount, accountRevision: 0 });
    expect(button('Opiši problem').props.value).toBe('  Nisu prenete poslednje kutije.  ');
    expect(button('Ponovi istu prijavu problema').props.disabled).toBe(true);
    expect(texts()).not.toContain('provider detail');
  });
  it.each([
    ['narucilac', 'CONFIRMED'], ['uskocer', 'CONFIRMED'],
    ['narucilac', 'AWAITING_REQUESTER'], ['uskocer', 'AWAITING_REQUESTER'],
  ])('allows the actual %s participant to report while %s and explains the shared description', async (role, state) => {
    mockRead.mockResolvedValue({ ...workspace, stanje: state, ucesnici: workspace.ucesnici.map(party => ({ ...party,
      uloga: party.viSte ? role : role === 'narucilac' ? 'uskocer' : 'narucilac' })) });
    await render();
    act(() => button('Prijavi problem').props.onPress());
    expect(texts()).toContain('Opis će videti druga strana u Porukama. Ovo nije poverljiva prijava podršci.');
    expect(button('Opiši problem').props.value).toBe('');
    expect(mockProblemSubmit).not.toHaveBeenCalled();
  });
  it('shows only the first stored report after a bound receipt and still permits explicit requester completion', async () => {
    const openedAt = '2026-09-10T18:00:00.123456+00:00';
    const narrative = 'Nisu prenete poslednje kutije.';
    mockProblemSubmit.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, problemOtvoren: true });
      return { ok: true, podatak: { agreementId: workspace.id, problemOpenedAt: '2026-09-10T18:00:00.123456Z',
        problemOpenedBy: mockAccount, idempotentReplay: false, authoritative: true, noAutomaticFaultOrDebt: true } };
    });
    mockProblemRead.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'AVAILABLE',
      report: { openedAt, openedBy: mockAccount, narrative } } });
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText(narrative));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(mockProblemRead).toHaveBeenCalledWith(workspace.id, 1, workspace.ucesnici.map(party => party.id),
      { accountId: mockAccount, accountRevision: 0 });
    expect(texts()).toContain('Problem je prijavljen'); expect(texts()).toContain(narrative);
    expect(texts()).toContain('Prijava je tvoja.');
    expect(texts()).toContain('Automatski završetak je zaustavljen. Završetak se i dalje može potvrditi.');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prijavi problem' })).toHaveLength(0);
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
  });
  it('preserves a counterparty first report instead of claiming that a racing new description was saved', async () => {
    const openedAt = '2026-09-10T18:00:00Z', openedBy = workspace.ucesnici[1].id;
    mockProblemSubmit.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, problemOtvoren: true });
      return { ok: true, podatak: { agreementId: workspace.id, problemOpenedAt: openedAt, problemOpenedBy: openedBy,
        idempotentReplay: true, authoritative: true, noAutomaticFaultOrDebt: true } };
    });
    mockProblemRead.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'AVAILABLE',
      report: { openedAt, openedBy, narrative: 'Opis prve prijave druge strane.' } } });
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Moj drugačiji opis.'));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(texts()).toContain('Prijavila je druga strana.');
    expect(texts()).toContain('Opis prve prijave druge strane.');
    expect(texts()).toContain('Tvoj novi opis nije dodat.');
    expect(texts()).not.toContain('Moj drugačiji opis.');
  });
  it.each(['CONFIRMED', 'AWAITING_REQUESTER'])('preserves a legacy report on %s, chat and explicit completion without enabling an overwrite', async stanje => {
    mockRead.mockResolvedValue({ ...workspace, stanje, problemOtvoren: true });
    mockProblemRead.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'LEGACY_UNAVAILABLE', report: null } });
    await render();
    expect(texts()).toContain(workspace.naslov);
    expect(texts()).toContain('Detalji starije prijave nisu dostupni');
    expect(texts()).not.toContain('Prijava je tvoja.');
    expect(texts()).not.toContain('sačuvan je u Porukama');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prijavi problem' })).toHaveLength(0);
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
    // PKG-007: only the server's terminal COMPLETED readback confirms the explicit completion.
    mockSource.potvrdiZavrsetak.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED', problemOtvoren: true, radnje: null });
      return { ok: true, podatak: { zavrsenoIso: '2026-09-16T10:00:00Z', ponovljeno: false } };
    });
    await act(async () => button('Potvrdi završetak').props.onPress());
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledWith(workspace.id);
    expect(texts()).toContain('Dogovor je završen');
    await act(async () => button('Otvori poruke').props.onPress());
    expect(tree.root.findByType('AgreementChat' as any).props.writable).toBe(true);
    expect(mockProblemSubmit).not.toHaveBeenCalled();
  });
  it.each(['failure', 'absent', 'throw'])('preserves the known Agreement when optional report detail is %s', async kind => {
    mockRead.mockResolvedValue({ ...workspace, problemOtvoren: true });
    if (kind === 'throw') mockProblemRead.mockRejectedValue(new Error('private detail'));
    else mockProblemRead.mockResolvedValue(kind === 'absent'
      ? { ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'ABSENT', report: null } }
      : { ok: false, kod: 'PROBLEM_REPORT_INVALID', poruka: 'private detail' });
    await render();
    expect(texts()).toContain(workspace.naslov);
    expect(texts()).toContain('Detalji prijave trenutno nisu učitani.');
    expect(texts()).not.toContain('private detail');
    expect(texts()).not.toContain('Detalji starije prijave');
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prijavi problem' })).toHaveLength(0);
    await act(async () => button('Osveži detalje prijave').props.onPress());
    expect(mockProblemRead).toHaveBeenCalledTimes(2);
    await act(async () => button('Otvori poruke').props.onPress());
    expect(tree.root.findByType('AgreementChat' as any).props.writable).toBe(true);
  });
  it.each(['LEGACY_UNAVAILABLE', 'UNAVAILABLE'])('cannot confirm a newly submitted report from %s details', async state => {
    mockProblemSubmit.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, problemOtvoren: true });
      return { ok: true, podatak: { agreementId: workspace.id, problemOpenedAt: '2026-09-10T18:00:00Z',
        problemOpenedBy: mockAccount, idempotentReplay: false, authoritative: true, noAutomaticFaultOrDebt: true } };
    });
    mockProblemRead.mockResolvedValue(state === 'LEGACY_UNAVAILABLE'
      ? { ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state, report: null } }
      : { ok: false, kod: 'PROBLEM_REPORT_READ_FAILED', poruka: 'unconfirmed' });
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Opis mora biti potvrđen.'));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(texts()).toContain('Sačuvana prijava nije potvrđena.');
    expect(texts()).not.toContain('Problem je prijavljen');
    expect(button('Ponovi istu prijavu problema').props.disabled).toBe(true);
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Problem je prijavljen');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Ponovi istu prijavu problema' })).toHaveLength(0);
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
  });
  it('serializes duplicate and cross-action taps; after unknown readback retries only the original description', async () => {
    let resolve!: (value: unknown) => void;
    mockProblemSubmit.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('  Prvi opis.  '));
    const retainedInput = button('Opiši problem').props.onChangeText;
    const submit = button('Pošalji prijavu problema').props.onPress;
    const complete = button('Potvrdi završetak').props.onPress;
    act(() => { submit(); submit(); complete(); });
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    await act(async () => resolve({ ok: false, kod: 'TIMEOUT', poruka: 'private provider detail' }));
    act(() => submit());
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
    expect(button('Opiši problem').props.editable).toBe(false);
    expect(button('Ponovi istu prijavu problema').props.disabled).toBe(true);
    await act(async () => button('Osveži status Dogovora').props.onPress());
    act(() => { submit(); retainedInput('Promenjen opis.'); });
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
    expect(button('Opiši problem').props.value).toBe('  Prvi opis.  ');
    expect(button('Ponovi istu prijavu problema').props.disabled).toBe(false);
    await act(async () => button('Ponovi istu prijavu problema').props.onPress());
    expect(mockProblemSubmit).toHaveBeenCalledTimes(2);
    expect(mockProblemSubmit.mock.calls.map(args => args[1])).toEqual(['Prvi opis.', 'Prvi opis.']);
  });
  it('does not confirm a receipt when authoritative readback lacks the report, preserving the draft', async () => {
    mockProblemSubmit.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id,
      problemOpenedAt: '2026-09-10T18:00:00Z', problemOpenedBy: mockAccount, idempotentReplay: false,
      authoritative: true, noAutomaticFaultOrDebt: true } });
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Sačuvati opis.'));
    await act(async () => button('Pošalji prijavu problema').props.onPress());
    expect(texts()).not.toContain('Problem je prijavljen');
    expect(texts()).toContain('Sačuvana prijava nije potvrđena');
    expect(button('Opiši problem').props.value).toBe('Sačuvati opis.');
    expect(button('Ponovi istu prijavu problema').props.disabled).toBe(true);
  });
  it('clears the displayed workspace on blur and cannot revive a late report or retained write on refocus', async () => {
    let resolve!: (value: unknown) => void;
    mockProblemSubmit.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Opis pre izlaska.'));
    const submit = button('Pošalji prijavu problema').props.onPress;
    act(() => submit());
    mockFocused = false; await act(async () => tree.update(<Dogovor />));
    await act(async () => resolve({ ok: false, kod: 'OFFLINE', poruka: 'late private detail' }));
    expect(texts()).not.toContain(workspace.naslov);
    expect(texts()).not.toContain('late private detail');
    mockFocused = true; await act(async () => tree.update(<Dogovor />));
    act(() => submit());
    expect(mockProblemSubmit).toHaveBeenCalledTimes(1);
    expect(button('Opiši problem').props.value).toBe('Opis pre izlaska.');
    expect(button('Ponovi istu prijavu problema').props.disabled).toBe(false);
  });
  it('an account incarnation change drops the old report result and does not issue its private readback', async () => {
    let resolve!: (value: unknown) => void;
    mockProblemSubmit.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render(); act(() => button('Prijavi problem').props.onPress());
    act(() => button('Opiši problem').props.onChangeText('Privatni opis naloga A.'));
    act(() => button('Pošalji prijavu problema').props.onPress());
    mockAccountRevision += 2;
    await act(async () => tree.update(<Dogovor />));
    const readsBeforeLateReceipt = mockRead.mock.calls.length;
    await act(async () => resolve({ ok: true, podatak: { agreementId: workspace.id,
      problemOpenedAt: '2026-09-10T18:00:00Z', problemOpenedBy: mockAccount, idempotentReplay: false,
      authoritative: true, noAutomaticFaultOrDebt: true } }));
    expect(mockRead).toHaveBeenCalledTimes(readsBeforeLateReceipt);
    expect(mockProblemRead).not.toHaveBeenCalled();
    expect(texts()).not.toContain('Privatni opis naloga A.');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opiši problem' })).toHaveLength(0);
  });
  it.each(['CANCELLED', 'COMPLETED'])('shows a saved first report on %s without offering a new report', async state => {
    mockRead.mockResolvedValue({ ...workspace, stanje: state, problemOtvoren: true });
    mockProblemRead.mockResolvedValue({ ok: true, podatak: { agreementId: workspace.id, agreementVersion: 1, state: 'AVAILABLE',
      report: { openedAt: '2026-09-10T18:00:00Z', openedBy: mockAccount, narrative: 'Sačuvani opis.' } } });
    await render(); expect(texts()).toContain('Sačuvani opis.');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prijavi problem' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pošalji prijavu problema' })).toHaveLength(0);
  });
  it('Remote never mounts the private physical location surface', async () => {
    mockRead.mockResolvedValue({ ...workspace, rezim: 'DALJINSKI', kontakt: { ...workspace.kontakt, lokacijaPostoji: true } });
    await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Lokacija i pristup' })).toHaveLength(0);
    expect(texts()).toContain('Na daljinu');
    expect(texts()).not.toContain(workspace.putanjaTekst);
  });
  it('hides private workspace on background and fences retained actions until foreground readback', async () => {
    mockRead.mockResolvedValueOnce({ ...workspace, kontakt: { ...workspace.kontakt, njihovTelefon: '+38160111222' } });
    await render(); await act(async () => button('Kontakt').props.onPress());
    expect(texts()).toContain('+38160111222');
    const complete = button('Potvrdi završetak').props.onPress;
    await act(async () => { mockAppListeners.forEach(listener => listener('background')); complete(); });
    expect(texts()).not.toContain('+38160111222');
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    let resolve!: (data: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await act(async () => { mockAppListeners.forEach(listener => listener('active')); complete(); });
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(texts()).not.toContain('+38160111222');
    await act(async () => resolve({ ...workspace, stanje: 'CANCELLED' }));
    expect(texts()).toContain('Dogovor je otkazan');
    await act(async () => complete());
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  });
  it('resumes only after an in-flight completion settles and rereads the changed workspace', async () => {
    let finish!: (result: unknown) => void;
    mockSource.potvrdiZavrsetak.mockImplementationOnce(() => new Promise(done => { finish = done; }));
    await render();
    await act(async () => button('Potvrdi završetak').props.onPress());
    await act(async () => mockAppListeners.forEach(listener => listener('background')));
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    expect(texts()).not.toContain(workspace.naslov);
    expect(mockRead).toHaveBeenCalledTimes(1);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => finish({ ok: true, podatak: null }));
    expect(texts()).toContain('Dogovor je završen');
    expect(mockRead).toHaveBeenCalledTimes(3); // successful command readback, then resume snapshot
  });
  it('a second foreground event supersedes a pending resume read without revealing its stale result', async () => {
    await render();
    let first!: (data: unknown) => void, second!: (data: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(done => { first = done; }))
      .mockImplementationOnce(() => new Promise(done => { second = done; }));
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    await act(async () => mockAppListeners.forEach(listener => listener('active')));
    await act(async () => first({ ...workspace, naslov: 'Stari rezultat' }));
    expect(texts()).not.toContain('Stari rezultat');
    await act(async () => second({ ...workspace, stanje: 'CANCELLED' }));
    expect(texts()).toContain('Dogovor je otkazan');
  });
  it('a hanging workspace request offers bounded retry and cannot overwrite its successful replacement', async () => {
    jest.useFakeTimers();
    let late!: (data: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(done => { late = done; }));
    await render();
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(texts()).toContain('Dogovor nije učitan');
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => button('Ponovo učitaj Dogovor').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
    await act(async () => late({ ...workspace, naslov: 'Istekli rezultat' }));
    expect(texts()).not.toContain('Istekli rezultat');
  });
  it('a hanging completion becomes unknown, ignores its late result and permits authoritative refresh', async () => {
    jest.useFakeTimers();
    let late!: (result: unknown) => void;
    mockSource.potvrdiZavrsetak.mockImplementationOnce(() => new Promise(done => { late = done; }));
    await render(); const complete = button('Potvrdi završetak').props.onPress;
    await act(async () => complete());
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(texts()).toContain('Čuvanje nije potvrđeno');
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    expect(button('Osveži status Dogovora').props.disabled).toBe(false);
    await act(async () => late({ ok: true, podatak: null }));
    expect(mockRead).toHaveBeenCalledTimes(1);
    await act(async () => complete());
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED' });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
  });
  it('keeps the support selection exit for readable terminal history and latches its navigation', async () => {
    mockRead.mockResolvedValue({ ...workspace, verzija: 7, stanje: 'COMPLETED', chatDostupan: false }); await render();
    await act(async () => button('Poruke').props.onPress()); const chat = tree.root.findByType('AgreementChat' as React.ElementType).props;
    expect(chat.writable).toBe(false); expect(chat.messages[0].dogovorVerzija).toBe(2); expect(chat.support.canAct()).toBe(true);
    const open = jest.fn(); await act(async () => { chat.support.navigate(open); chat.support.navigate(open); });
    expect(open).toHaveBeenCalledTimes(1); expect(chat.support.canAct()).toBe(false);
    expect(mockSource.prijaviProblem).not.toHaveBeenCalled(); expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  });
  it.each(['blur/focus', 'account ABA'] as const)('fences an old message support entry after %s', async change => {
    await render(); await act(async () => button('Poruke').props.onPress()); const old = tree.root.findByType('AgreementChat' as React.ElementType).props.support;
    expect(old.canAct()).toBe(true);
    if (change === 'blur/focus') { mockFocused = false; await act(async () => tree.update(<Dogovor />)); mockFocused = true; }
    else mockAccountRevision = 2;
    await act(async () => tree.update(<Dogovor />)); const open = jest.fn(); await act(async () => old.navigate(open));
    expect(old.canAct()).toBe(false); expect(open).not.toHaveBeenCalled();
  });
});
describe('PKG-007 server completion permissions and terminal readback', () => {
  const none = { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false };
  const pendingChange = { ...none, izmenaNaCekanju: true };
  const asParty = (radnje: unknown, role: 'narucilac' | 'uskocer', state = 'CONFIRMED') => ({ ...workspace, radnje, stanje: state,
    ucesnici: workspace.ucesnici.map(party => ({ ...party, uloga: party.viSte ? role : role === 'narucilac' ? 'uskocer' : 'narucilac' })) });
  const absent = (label: string) => expect(tree.root.findAllByProps({ accessibilityLabel: label })).toHaveLength(0);
  const receipt = { ok: true, podatak: { zavrsenoIso: '2026-09-16T10:00:00.123456+00:00', ponovljeno: false } };
  it.each([['narucilac', 'CONFIRMED'], ['uskocer', 'CONFIRMED'], ['narucilac', 'AWAITING_REQUESTER']])(
    'a pending change hides the %s completion action while %s and explains why', async (role, state) => {
    mockRead.mockResolvedValue(asParty(pendingChange, role as 'narucilac' | 'uskocer', state));
    await render();
    absent('Potvrdi završetak'); absent('Završio sam');
    expect(texts()).toContain('Predlog izmene čeka odgovor');
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(mockSource.oznaciZavrsetak).not.toHaveBeenCalled();
  });
  it.each([null, undefined])('missing server permissions (%s) fail closed until an explicit readback restores the action', async radnje => {
    mockRead.mockResolvedValueOnce({ ...workspace, radnje });
    await render();
    absent('Potvrdi završetak'); absent('Završio sam');
    expect(texts()).toContain('Dozvole za završetak nisu potvrđene');
    await act(async () => button('Osveži dozvole za završetak').props.onPress());
    expect(mockRead).toHaveBeenCalledTimes(2);
    expect(button('Potvrdi završetak').props.disabled).toBe(false);
    expect(texts()).not.toContain('Dozvole za završetak nisu potvrđene');
  });
  it('a server-denied requester permission hides the action even without a pending change', async () => {
    mockRead.mockResolvedValue({ ...workspace, radnje: none });
    await render();
    absent('Potvrdi završetak');
    expect(texts()).not.toContain('Predlog izmene čeka odgovor');
    expect(texts()).not.toContain('Dozvole za završetak nisu potvrđene');
  });
  it.each([['narucilac', { ...none, mozeOznacitiZavrsetak: true }], ['uskocer', { ...none, mozePotvrditiZavrsetak: true }]])(
    'a permission granted to the other party does not enable the %s', async (role, radnje) => {
    mockRead.mockResolvedValue(asParty(radnje, role as 'narucilac' | 'uskocer'));
    await render();
    absent('Potvrdi završetak'); absent('Završio sam');
  });
  it('an unchanged readback after a valid confirmation receipt stays unconfirmed until explicit reconciliation', async () => {
    mockSource.potvrdiZavrsetak.mockResolvedValueOnce(receipt);
    await render();
    await act(async () => button('Potvrdi završetak').props.onPress());
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledWith(workspace.id);
    expect(mockRead).toHaveBeenCalledTimes(2);
    expect(texts()).toContain('Server nije potvrdio završetak');
    expect(texts()).not.toContain('Dogovor je završen');
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    await act(async () => button('Potvrdi završetak').props.onPress());
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED', radnje: none });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
    absent('Potvrdi završetak');
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
  });
  it('a valid COMPLETED readback confirms the requester completion', async () => {
    mockSource.potvrdiZavrsetak.mockImplementationOnce(async () => {
      mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED', radnje: none });
      return receipt;
    });
    await render();
    await act(async () => button('Potvrdi završetak').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
    expect(texts()).not.toContain('Server nije potvrdio završetak');
    expect(button('Oceni saradnju')).toBeTruthy();
    absent('Potvrdi završetak');
  });
  it('shows the known server denial copy, never the adapter text, and does not read back', async () => {
    mockSource.potvrdiZavrsetak.mockResolvedValueOnce({ ok: false, kod: 'AGREEMENT_CHANGE_PENDING', poruka: 'adapter text' });
    await render();
    await act(async () => button('Potvrdi završetak').props.onPress());
    expect(texts()).toContain('Najpre odgovori na postojeći predlog izmene.');
    expect(texts()).not.toContain('adapter text');
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(button('Potvrdi završetak').props.disabled).toBe(true);
    mockRead.mockResolvedValue({ ...workspace, radnje: pendingChange });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    absent('Potvrdi završetak');
    expect(texts()).toContain('Predlog izmene čeka odgovor');
  });
  it('the worker mark is confirmed only by an AWAITING_REQUESTER or COMPLETED readback', async () => {
    const asWorker = asParty({ ...none, mozeOznacitiZavrsetak: true }, 'uskocer');
    mockRead.mockResolvedValue(asWorker);
    mockSource.oznaciZavrsetak.mockResolvedValueOnce({ ok: true, podatak: { rokPotvrdeIso: '2026-09-18T10:00:00Z' } });
    await render();
    await act(async () => button('Završio sam').props.onPress());
    expect(mockSource.oznaciZavrsetak).toHaveBeenCalledWith(workspace.id);
    expect(texts()).toContain('Server nije potvrdio završetak');
    expect(button('Završio sam').props.disabled).toBe(true);
    mockRead.mockResolvedValue({ ...asWorker, stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z', radnje: none });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Čeka se potvrda druge strane');
    absent('Završio sam');
    expect(mockSource.oznaciZavrsetak).toHaveBeenCalledTimes(1);
  });
  it('a completion receipt arriving after an A→B→A auth incarnation change cannot apply or read back', async () => {
    let resolve!: (value: unknown) => void;
    mockSource.potvrdiZavrsetak.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await render();
    act(() => button('Potvrdi završetak').props.onPress());
    expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledTimes(1);
    mockAccountRevision += 2;
    await act(async () => tree.update(<Dogovor />));
    const readsBeforeLateReceipt = mockRead.mock.calls.length;
    mockRead.mockResolvedValue({ ...workspace, stanje: 'COMPLETED', radnje: none });
    await act(async () => resolve(receipt));
    expect(mockRead).toHaveBeenCalledTimes(readsBeforeLateReceipt);
    expect(texts()).not.toContain('Dogovor je završen');
  });
});
