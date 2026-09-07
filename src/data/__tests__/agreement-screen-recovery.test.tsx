import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockAccount = '10000000-0000-4000-8000-000000000001';
let mockAccountRevision = 0;
let mockPlatform = 'android';
let mockId: string | string[] = '20000000-0000-4000-8000-000000000001';
const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() };
const mockRead = jest.fn();
const mockMessages = jest.fn();
const mockSource = { dogovor: mockRead, poruke: mockMessages };
const mockOutbox = { reconcile: jest.fn().mockResolvedValue(undefined) };
let mockOutboxState = { phase: 'loading', entries: [] as any[] };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: mockPlatform };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, FadeIn: { duration: () => undefined } }));
jest.mock('phosphor-react-native', () => ({ CaretLeft: 'Icon', Clock: 'Icon', ArrowRight: 'Icon', ClockCountdown: 'Icon', CheckCircle: 'Icon', Phone: 'Icon', MapPin: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Card: 'Card' }));
jest.mock('../../ui/AgreementChat', () => ({ AgreementChat: 'AgreementChat' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockAccountRevision }), sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockAccountRevision }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => 'narucilac', ulogaSada: () => 'narucilac' }));
jest.mock('../../hooks/useAgreementOutbox', () => ({ useAgreementOutbox: () => ({ model: mockOutbox, state: mockOutboxState }) }));
import Dogovor from '../../app/dogovor/[id]';

const workspace = { id: '20000000-0000-4000-8000-000000000001', naslov: 'Pomoć pri selidbi', stanje: 'CONFIRMED',
  verzija: 1, cena: { prikaz: '3.000 RSD' }, pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0 },
  ucesnici: [], hronologija: [], kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false },
  chatDostupan: true, vremeTekst: 'Fleksibilno', putanjaTekst: 'Beograd', problemOtvoren: false, rokPotvrdeIso: null };
const ownMessage = { id: '30000000-0000-4000-8000-000000000001', clientMessageId: 'poruka_retry_123',
  posiljalacAccountId: '10000000-0000-4000-8000-000000000001', telo: 'Stižem.', moja: true };
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
async function render() { await act(async () => { tree = create(<Dogovor />); }); }
beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset(); mockMessages.mockReset();
  mockAccount = ownMessage.posiljalacAccountId; mockId = workspace.id;
  mockAccountRevision = 0;
  mockPlatform = 'android';
  mockRouter.canGoBack.mockReturnValue(true);
  mockRead.mockResolvedValue(workspace); mockMessages.mockResolvedValue([ownMessage]);
  mockOutboxState = { phase: 'loading', entries: [] };
});
afterEach(async () => { await act(async () => tree?.unmount()); });
describe('D03 actual route and scoped resource integration', () => {
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
});
