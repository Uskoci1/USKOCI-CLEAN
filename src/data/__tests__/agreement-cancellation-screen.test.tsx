import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const REQUESTER = '10000000-0000-4000-8000-000000000001', WORKER = '10000000-0000-4000-8000-000000000002';
let mockAccount = REQUESTER, mockAccountRevision = 0, mockFocused = true, mockIntent = 'narucilac';
let mockId = '20000000-0000-4000-8000-000000000001';
const mockAppListeners = new Set<(state: string) => void>();
const mockAlert = jest.fn(), mockRead = jest.fn();
const mockSource = { dogovor: mockRead, poruke: jest.fn(), otkaziDogovor: jest.fn(),
  oznaciZavrsetak: jest.fn(), potvrdiZavrsetak: jest.fn(), podeliTelefon: jest.fn(), opoziviTelefon: jest.fn() };
const mockOutbox = { reconcile: jest.fn().mockResolvedValue(undefined) };
const mockOutboxState = { phase: 'ready', entries: [] };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Alert') return { alert: mockAlert };
    if (key === 'Platform') return { OS: 'android' };
    if (key === 'AppState') return { currentState: 'active', addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppListeners.add(listener); return { remove: () => mockAppListeners.delete(listener) };
    } };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../agreementClientService', () => ({ agreementProblemService: { read: jest.fn(), submit: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => undefined } }));
jest.mock('phosphor-react-native', () => ({ CaretLeft: 'Icon', Clock: 'Icon', ArrowRight: 'Icon', ClockCountdown: 'Icon', CheckCircle: 'Icon', Phone: 'Icon', MapPin: 'Icon' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Card: 'Card' }));
jest.mock('../../ui/AgreementChat', () => ({ AgreementChat: 'AgreementChat' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PrivateMap' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockAccountRevision }),
  sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockAccountRevision }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../hooks/useAgreementOutbox', () => ({ useAgreementOutbox: () => ({ model: mockOutbox, state: mockOutboxState }) }));
import Dogovor from '../../app/dogovor/[id]';

const agreement = { id: '20000000-0000-4000-8000-000000000001', naslov: 'Pomoć pri selidbi', stanje: 'CONFIRMED',
  verzija: 1, cena: { prikaz: '3.000 RSD' }, pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0 },
  ucesnici: [{ id: REQUESTER, ime: 'Ana', inicijali: 'AN', uloga: 'narucilac', mesta: null, viSte: true },
    { id: WORKER, ime: 'Marko', inicijali: 'MA', uloga: 'uskocer', mesta: 1, viSte: false }],
  hronologija: [], kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false },
  chatDostupan: true, vremeTekst: 'Fleksibilno', putanjaTekst: 'Beograd', problemOtvoren: false, rokPotvrdeIso: null };
const cancelled = { ...agreement, stanje: 'CANCELLED', chatDostupan: false };
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const confirmation = () => mockAlert.mock.calls[mockAlert.mock.calls.length - 1][2].find((entry: { style: string }) => entry.style === 'destructive').onPress as () => void;
const hasCancelledCard = () => tree.root.findAll(node => String(node.type) === 'T' && node.children.join('') === 'Dogovor je otkazan.').length === 1;
const rerender = async () => { await act(async () => tree.update(<Dogovor />)); };
async function render() { await act(async () => { tree = create(<Dogovor />); }); }
async function open(reason = '  Ne mogu da nastavim Dogovor.  ') {
  await act(async () => button('Otkaži Dogovor').props.onPress());
  await act(async () => button('Razlog otkazivanja').props.onChangeText(reason));
}
async function ask() { await act(async () => button('Potvrdi otkazivanje').props.onPress()); return confirmation(); }
async function workspaceRefresh() {
  await act(async () => button('Otvori poruke').props.onPress());
  const refresh = tree.root.findByType('AgreementChat' as any).props.refreshWorkspace as () => Promise<void>;
  await act(async () => button('Pregled').props.onPress());
  return refresh;
}
beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset().mockResolvedValue(agreement);
  mockAccount = REQUESTER; mockAccountRevision = 0; mockId = agreement.id; mockIntent = 'narucilac'; mockFocused = true;
  mockSource.poruke.mockReset().mockResolvedValue([]);
  for (const key of ['otkaziDogovor', 'oznaciZavrsetak', 'potvrdiZavrsetak', 'podeliTelefon', 'opoziviTelefon'] as const) {
    mockSource[key].mockReset().mockResolvedValue({ ok: true, podatak: null });
  }
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

describe('M06 actual route cancellation, with real owned editor and V2 actions', () => {
  it('requires a reason and explicit native destructive confirmation; cancel/dismiss never writes', async () => {
    await render(); await open('   ');
    expect(button('Potvrdi otkazivanje').props.disabled).toBe(true);
    await act(async () => button('Potvrdi otkazivanje').props.onPress());
    expect(mockAlert).not.toHaveBeenCalled();
    await act(async () => button('Razlog otkazivanja').props.onChangeText('Ne mogu da nastavim.'));
    const submit = await ask();
    expect(mockAlert.mock.calls[0][0]).toBe('Otkaži ovaj Dogovor?');
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
    await act(async () => mockAlert.mock.calls[0][2][0].onPress());
    await act(async () => submit());
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
    const dismissed = await ask();
    await act(async () => mockAlert.mock.calls[1][3].onDismiss());
    await act(async () => dismissed());
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
  });
  it.each([['narucilac', 'CONFIRMED'], ['uskocer', 'CONFIRMED'], ['narucilac', 'AWAITING_REQUESTER'], ['uskocer', 'AWAITING_REQUESTER']])(
    'uses the actual %s participant in %s even under the opposite selected intent', async (role, state) => {
      mockIntent = role === 'narucilac' ? 'uskocer' : 'narucilac';
      mockRead.mockResolvedValue({ ...agreement, stanje: state, ucesnici: agreement.ucesnici.map(party => ({ ...party,
        uloga: party.viSte ? role : role === 'narucilac' ? 'uskocer' : 'narucilac' })) });
      await render(); await open(); const submit = await ask(); mockRead.mockResolvedValue(cancelled);
      await act(async () => submit());
      expect(mockSource.otkaziDogovor).toHaveBeenCalledWith(agreement.id, 'Ne mogu da nastavim Dogovor.');
      expect(mockRead).toHaveBeenCalledTimes(2); expect(hasCancelledCard()).toBe(true);
    });
  it.each(['COMPLETED', 'CANCELLED', 'UNKNOWN'])('does not offer cancellation for %s', async state => {
    mockRead.mockResolvedValue({ ...agreement, stanje: state }); await render();
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Otkaži Dogovor' })).toHaveLength(0);
  });
  it('does not grant cancellation from intent or a mismatched participant identity', async () => {
    mockRead.mockResolvedValue({ ...agreement, ucesnici: agreement.ucesnici.map(party => ({ ...party, viSte: party.id === WORKER })) });
    await render(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Otkaži Dogovor' })).toHaveLength(0);
  });
  it('serializes confirmation double taps and cross-action writes until actual readback', async () => {
    let done!: (result: unknown) => void;
    mockSource.otkaziDogovor.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
    await render(); await open(); const submit = await ask(), complete = button('Potvrdi završetak').props.onPress;
    await act(async () => { submit(); submit(); complete(); });
    expect(mockSource.otkaziDogovor).toHaveBeenCalledTimes(1);
    expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
    expect(button('Proveravamo otkazivanje…').props.disabled).toBe(true);
    expect(hasCancelledCard()).toBe(false);
    mockRead.mockResolvedValue(cancelled);
    await act(async () => done({ ok: true, podatak: null }));
    expect(hasCancelledCard()).toBe(true);
  });
  it('retires a displayed confirmation if its reason changes', async () => {
    await render(); await open(); const submit = await ask();
    await act(async () => button('Razlog otkazivanja').props.onChangeText('Novi razlog.'));
    await act(async () => submit());
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
    const next = await ask(); mockRead.mockResolvedValue(cancelled); await act(async () => next());
    expect(mockSource.otkaziDogovor).toHaveBeenCalledWith(agreement.id, 'Novi razlog.');
  });
  it('retires old confirmation synchronously when a same-version refresh starts, before React commits', async () => {
    await render(); const refresh = await workspaceRefresh(); await open(); const submit = await ask();
    let done!: (result: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
    await act(async () => { void refresh(); submit(); });
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
    await act(async () => done(agreement)); await act(async () => submit());
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
  });
  it.each(['account', 'ABA', 'intent', 'route'])('a retained native confirmation cannot cross %s ownership', async change => {
    await render(); await open(); const submit = await ask();
    if (change === 'account') mockAccount = WORKER;
    if (change === 'ABA') mockAccountRevision += 2;
    if (change === 'intent') mockIntent = 'uskocer';
    if (change === 'route') { mockId = '20000000-0000-4000-8000-000000000002'; await rerender(); }
    await act(async () => submit());
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
  });
  it('blur/refocus cannot revive a retained native confirmation', async () => {
    await render(); await open(); const submit = await ask();
    mockFocused = false; await rerender(); await act(async () => submit());
    mockFocused = true; await rerender(); await act(async () => submit());
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalledTimes(2);
  });
  it('batched background/foreground retires confirmation before the fresh read finishes', async () => {
    await render(); await open(); const submit = await ask();
    let done!: (result: unknown) => void;
    mockRead.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
    await act(async () => { mockAppListeners.forEach(listener => { listener('background'); listener('active'); }); submit(); });
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
    expect(texts()).not.toContain(agreement.naslov);
    await act(async () => done({ ...agreement, verzija: 2 })); await act(async () => submit());
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
  });
  it('unmount retires confirmation without a write or later side effect', async () => {
    await render(); await open(); const submit = await ask();
    await act(async () => tree.unmount()); await act(async () => submit());
    expect(mockSource.otkaziDogovor).not.toHaveBeenCalled();
  });
  it.each(['reject', 'throw', 'malformed'])('an unknown %s freezes the exact reason and permits only explicit read-then-same-intent retry', async kind => {
    if (kind === 'throw') mockSource.otkaziDogovor.mockRejectedValueOnce(new Error('private raw detail'));
    else mockSource.otkaziDogovor.mockResolvedValueOnce(kind === 'reject'
      ? { ok: false, kod: 'OFFLINE', poruka: 'private raw detail' } : { ok: true, podatak: { status: 'CANCELLED' } });
    await render(); await open(); const edit = button('Razlog otkazivanja').props.onChangeText, submit = await ask();
    await act(async () => submit());
    expect(texts()).toContain('Otkazivanje nije potvrđeno'); expect(texts()).not.toContain('private raw detail');
    expect(button('Razlog otkazivanja').props.editable).toBe(false);
    expect(button('Ponovi isto otkazivanje').props.disabled).toBe(true);
    await act(async () => { edit('Drugi razlog'); submit(); button('Ponovi isto otkazivanje').props.onPress(); });
    expect(mockSource.otkaziDogovor).toHaveBeenCalledTimes(1);
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(button('Ponovi isto otkazivanje').props.disabled).toBe(false);
    expect(button('Razlog otkazivanja').props.value).toBe('Ne mogu da nastavim Dogovor.');
    await act(async () => button('Ponovi isto otkazivanje').props.onPress());
    mockRead.mockResolvedValue(cancelled); await act(async () => confirmation()());
    expect(mockSource.otkaziDogovor.mock.calls).toEqual([[agreement.id, 'Ne mogu da nastavim Dogovor.'], [agreement.id, 'Ne mogu da nastavim Dogovor.']]);
    expect(hasCancelledCard()).toBe(true);
  });
  it.each(['active', 'completed', 'wrong-id', 'missing', 'read-error'])('an acknowledged void command cannot manufacture cancellation from %s readback', async result => {
    await render(); await open(); const submit = await ask();
    if (result === 'read-error') mockRead.mockRejectedValueOnce(new Error('private read detail'));
    else mockRead.mockResolvedValueOnce(result === 'missing' ? null : result === 'wrong-id' ? { ...cancelled, id: WORKER }
      : { ...agreement, stanje: result === 'completed' ? 'COMPLETED' : 'CONFIRMED' });
    await act(async () => submit());
    expect(hasCancelledCard()).toBe(false); expect(texts()).toContain('Otkazivanje nije potvrđeno');
    expect(texts()).not.toContain('private read detail');
    expect(button('Ponovi isto otkazivanje').props.disabled).toBe(true);
    mockRead.mockResolvedValue({ ...agreement, stanje: 'COMPLETED', chatDostupan: false });
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(texts()).toContain('Dogovor je završen');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Ponovi isto otkazivanje' })).toHaveLength(0);
  });
  it('keeps pending UI until cancellation readback and uses its revoked contact/read-only chat projection', async () => {
    mockRead.mockResolvedValueOnce({ ...agreement, kontakt: { ...agreement.kontakt, njihovTelefon: '+38160111222' } });
    await render(); await act(async () => button('Kontakt').props.onPress());
    expect(texts()).toContain('+38160111222'); await open(); const submit = await ask();
    let done!: (data: unknown) => void; mockRead.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
    await act(async () => submit());
    expect(hasCancelledCard()).toBe(false); expect(button('Proveravamo otkazivanje…').props.disabled).toBe(true);
    await act(async () => done(cancelled));
    expect(hasCancelledCard()).toBe(true); expect(texts()).not.toContain('+38160111222');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Potvrdi završetak' })).toHaveLength(0);
    await act(async () => button('Otvori poruke').props.onPress());
    expect(tree.root.findByType('AgreementChat' as any).props.writable).toBe(false);
  });
  it('a hanging command times out, ignores late success and only resolves through explicit server read', async () => {
    jest.useFakeTimers(); let done!: (result: unknown) => void;
    mockSource.otkaziDogovor.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
    await render(); await open(); const submit = await ask(); await act(async () => submit());
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(texts()).toContain('Otkazivanje nije potvrđeno');
    await act(async () => done({ ok: true, podatak: null }));
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(button('Ponovi isto otkazivanje').props.disabled).toBe(true);
    mockRead.mockResolvedValue(cancelled);
    await act(async () => button('Osveži status Dogovora').props.onPress());
    expect(hasCancelledCard()).toBe(true); expect(mockSource.otkaziDogovor).toHaveBeenCalledTimes(1);
  });
  it('does not begin a read from a late cancellation result after account ABA', async () => {
    let done!: (result: unknown) => void;
    mockSource.otkaziDogovor.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
    await render(); await open(); const submit = await ask(); await act(async () => submit());
    mockAccountRevision += 2;
    await act(async () => done({ ok: true, podatak: null }));
    expect(mockRead).toHaveBeenCalledTimes(1); expect(hasCancelledCard()).toBe(false);
  });
});
