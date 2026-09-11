import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AgreementChangeSnapshot } from '../agreementClientService';

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const ID = '20000000-0000-4000-8000-000000000001', P = '30000000-0000-4000-8000-000000000001';
let mockAccount = A, mockRevision = 0, mockFocus = true, mockIntent = 'narucilac', mockId = ID;
const mockListeners = new Set<(state: string) => void>(), mockAlert = jest.fn();
const mockService = { read: jest.fn(), propose: jest.fn(), respond: jest.fn() };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Alert') return { alert: mockAlert };
    if (key === 'Platform') return { OS: 'android' };
    if (key === 'AppState') return { currentState: 'active', addEventListener: (_event: string, listener: (state: string) => void) => {
      mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
    } };
    return ['View', 'ScrollView', 'TextInput', 'ActivityIndicator', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocus ? effect() : undefined, [effect, mockFocus]) }));
jest.mock('../agreementClientService', () => ({ agreementChangeService: {
  read: (...args: unknown[]) => mockService.read(...args), propose: (...args: unknown[]) => mockService.propose(...args),
  respond: (...args: unknown[]) => mockService.respond(...args),
} }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => false }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', CalendarBlank: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import Screen from '../../app/dogovor/izmene/[id]';

const terms = { priceRsd: 3000, currency: 'RSD' as const, scopeNote: 'Prenos stvari',
  startsAt: '2099-01-01T12:00:00.000001Z', endsAt: '2099-01-01T13:00:00.000002Z' };
const base: AgreementChangeSnapshot = { agreementId: ID, agreementVersion: 1, agreementStatus: 'CONFIRMED',
  requesterAccountId: A, workerAccountId: B, terms, proposals: [] };
const proposal = { proposalId: P, agreementId: ID, baseVersion: 1, proposedBy: B, status: 'PENDING' as const,
  reason: 'Drugi termin', createdAt: '2026-09-11T10:00:00Z', respondedBy: null, respondedAt: null,
  termsAvailable: true as const, terms: { ...terms, priceRsd: 4000 } };
const ok = (podatak: AgreementChangeSnapshot) => ({ ok: true, podatak });
let tree: ReactTestRenderer;
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const press = async (label: string) => { await act(async () => button(label).props.onPress()); };
const write = async (label: string, value: string) => { await act(async () => button(label).props.onChangeText(value)); };
const render = async () => { await act(async () => { tree = create(<Screen />); }); };
const rerender = async () => { await act(async () => tree.update(<Screen />)); };
const confirmation = () => mockAlert.mock.calls.at(-1)[2][1].onPress as () => void;
beforeEach(() => {
  jest.clearAllMocks(); mockAccount = A; mockRevision = 0; mockFocus = true; mockIntent = 'narucilac'; mockId = ID;
  mockService.read.mockReset().mockResolvedValue(ok(base)); mockService.propose.mockReset(); mockService.respond.mockReset();
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('sends only changed price/scope and preserves untouched accepted microsecond interval', async () => {
  await render(); await press('Predloži izmenu'); await write('Nova cena u RSD', '4000');
  mockService.propose.mockResolvedValue({ ok: true, podatak: { proposalId: P } });
  mockService.read.mockResolvedValue(ok({ ...base, proposals: [{ ...proposal, proposedBy: A, reason: null }] }));
  await press('Pošalji predlog izmene');
  const [command, account] = mockService.propose.mock.calls[0];
  expect(command).toMatchObject({ dogovorId: ID, ocekivanaVerzija: 1, izmena: { cenaIznos: 4000 } });
  expect(command.izmena).toEqual({ cenaIznos: 4000 });
  expect(command.clientRequestId).toMatch(/^agreement-change_/); expect(account).toEqual({ accountId: A, accountRevision: 0 });
  expect(text()).toContain('Predlog je sačuvan'); expect(text()).toContain('VAŽEĆI USLOVI');
  expect(mockService.respond).not.toHaveBeenCalled();
});
it('refuses unchanged or invalid price without a write', async () => {
  await render(); await press('Predloži izmenu'); await press('Pošalji predlog izmene');
  expect(text()).toContain('Izmenite cenu');
  for (const value of ['0', '-3', '1.5', '2147483648']) {
    await write('Nova cena u RSD', value); await press('Pošalji predlog izmene');
  }
  expect(mockService.propose).not.toHaveBeenCalled();
});
it('unknown outcome freezes the exact command and requires successful read before explicit retry', async () => {
  await render(); await press('Predloži izmenu'); await write('Novi obim posla', 'Nova celina');
  mockService.propose.mockResolvedValue({ ok: false, kod: 'AGREEMENT_CHANGE_UNCONFIRMED', poruka: 'Osvežite predloge.' });
  await press('Pošalji predlog izmene'); const command = mockService.propose.mock.calls[0][0];
  expect(button('Novi obim posla').props.editable).toBe(false);
  expect(button('Ponovi isti zahtev').props.disabled).toBe(true);
  await press('Ponovi isti zahtev'); expect(mockService.propose).toHaveBeenCalledTimes(1);
  await press('Osveži sačuvane predloge');
  mockService.propose.mockResolvedValue({ ok: true, podatak: { proposalId: P } });
  mockService.read.mockResolvedValue(ok({ ...base, proposals: [{ ...proposal, proposedBy: A, reason: null, terms: { ...terms, scopeNote: 'Nova celina' } }] }));
  await press('Ponovi isti zahtev'); expect(mockService.propose.mock.calls[1][0]).toBe(command);
  expect(text()).toContain('Predlog je sačuvan');
});
it('RPC acknowledgement without its actual proposal never produces a success state', async () => {
  await render(); await press('Predloži izmenu'); await write('Nova cena u RSD', '4000');
  mockService.propose.mockResolvedValue({ ok: true, podatak: { proposalId: P } });
  await press('Pošalji predlog izmene');
  expect(text()).not.toContain('Predlog je sačuvan'); expect(button('Ponovi isti zahtev').props.disabled).toBe(true);
});
it('a returned proposal with different semantic terms cannot confirm the submitted intent', async () => {
  await render(); await press('Predloži izmenu'); await write('Nova cena u RSD', '5000');
  mockService.propose.mockResolvedValue({ ok: true, podatak: { proposalId: P } });
  mockService.read.mockResolvedValue(ok({ ...base, proposals: [{ ...proposal, proposedBy: A, reason: null }] }));
  await press('Pošalji predlog izmene');
  expect(text()).not.toContain('Predlog je sačuvan'); expect(button('Ponovi isti zahtev').props.disabled).toBe(true);
});
it('acceptance needs explicit confirmation and actual accepted proposal plus fresh workspace', async () => {
  mockService.read.mockResolvedValue(ok({ ...base, proposals: [proposal] })); await render();
  await press('Prihvati izmenu'); expect(mockService.respond).not.toHaveBeenCalled();
  mockService.respond.mockResolvedValue({ ok: true, podatak: { proposalId: P, accepted: true, agreementVersion: 2, authoritative: true } });
  mockService.read.mockResolvedValue(ok({ ...base, agreementVersion: 2, terms: proposal.terms,
    proposals: [{ ...proposal, status: 'ACCEPTED', respondedBy: A, respondedAt: '2026-09-11T10:01:00Z' }] }));
  await act(async () => confirmation()());
  expect(mockService.respond).toHaveBeenCalledWith(proposal, true, { accountId: A, accountRevision: 0 });
  expect(text()).toContain('Prihvatanje je potvrđeno');
});
it('refresh start retires an open native decision even when the read returns the same version', async () => {
  mockService.read.mockResolvedValue(ok({ ...base, proposals: [proposal] })); await render();
  await press('Prihvati izmenu'); const retained = confirmation();
  let resolve!: (value: ReturnType<typeof ok>) => void;
  mockService.read.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await press('Osveži sačuvane predloge'); await act(async () => retained());
  expect(mockService.respond).not.toHaveBeenCalled();
  await act(async () => resolve(ok({ ...base, proposals: [proposal] }))); await act(async () => retained());
  expect(mockService.respond).not.toHaveBeenCalled();
});
it.each(['account', 'background', 'blur'])('a retained confirmation cannot write after %s retirement', async mode => {
  mockService.read.mockResolvedValue(ok({ ...base, proposals: [proposal] })); await render();
  await press('Odbij predlog'); const retained = confirmation();
  if (mode === 'account') { mockRevision += 2; await rerender(); }
  else if (mode === 'blur') { mockFocus = false; await rerender(); }
  else await act(async () => mockListeners.forEach(listener => listener('background')));
  await act(async () => retained()); expect(mockService.respond).not.toHaveBeenCalled();
});
it('background during a submitted write prevents follow-up read or adoption until resume refresh', async () => {
  await render(); await press('Predloži izmenu'); await write('Nova cena u RSD', '4000');
  let resolve!: (value: unknown) => void;
  mockService.propose.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await press('Pošalji predlog izmene');
  await act(async () => mockListeners.forEach(listener => listener('background')));
  await act(async () => resolve({ ok: true, podatak: { proposalId: P } }));
  expect(mockService.read).toHaveBeenCalledTimes(1); expect(text()).not.toContain('Predlog je sačuvan');
  await act(async () => mockListeners.forEach(listener => listener('active')));
  expect(mockService.read).toHaveBeenCalledTimes(2); expect(button('Ponovi isti zahtev').props.disabled).toBe(false);
});
it('own, stale and terminal proposals have no response action; malformed legacy terms permit only rejection', async () => {
  mockService.read.mockResolvedValue(ok({ ...base, proposals: [{ ...proposal, termsAvailable: false, terms: null }] })); await render();
  expect(button('Prihvati izmenu').props.disabled).toBe(true); expect(button('Odbij predlog').props.disabled).toBe(false);
  for (const value of [{ ...base, proposals: [{ ...proposal, proposedBy: A }] },
    { ...base, agreementVersion: 2, proposals: [proposal] },
    { ...base, agreementStatus: 'CANCELLED' as const, proposals: [proposal] }]) {
    mockService.read.mockResolvedValue(ok(value)); await press('Osveži sačuvane predloge');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Prihvati izmenu' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Odbij predlog' })).toHaveLength(0);
  }
});
