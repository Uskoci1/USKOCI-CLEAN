import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
const mockPolicy = jest.fn(), mockExecution = jest.fn();
const mockRouter = { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), navigate: jest.fn() };
jest.mock('../retentionPolicyClientService', () => ({ retentionPolicyClientService: {
  readStatus: () => mockPolicy(), readExecutionStatus: () => mockExecution(),
} }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', Eye: 'Icon', MapPin: 'Icon', DownloadSimple: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button', Card: 'Card' }));
import Privacy from '../../app/(app)/profil/privatnost';

const ok = (podatak: unknown) => ({ ok: true, podatak });
const policy = (version = 'fixture-v1') => ({ ready: true, policyVersion: version, effectiveAt: '2026-09-10T00:00:00Z',
  rules: [{ dataClass: 'AI_VOLATILE', purpose: 'synthetic purpose', retentionPeriod: 'fixture duration', deletionTrigger: 'fixture trigger',
    exceptionRule: 'fixture exception', legalBasis: 'fixture basis' }] });
const execution = (version = 'fixture-v1') => ({ engineVersion: 'P3_AI_ABANDONED_UNBOUND_V1', executionAdmitted: true, policyVersion: version,
  datasets: [{ dataset: 'AI_ABANDONED_UNBOUND', dataClass: 'AI_VOLATILE', action: 'DELETE', ready: true, reason: null }],
  unsupportedDataClasses: ['MEDIA_OBJECTS'], storageCleanup: 'NOT_APPLICABLE' });
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Privacy />); }); };
const update = async () => { await act(async () => tree.update(<Privacy />)); };
const button = (label: string) => tree.root.findByProps({ label }).props;
const texts = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => {
  jest.clearAllMocks(); mockPolicy.mockReset(); mockExecution.mockReset();
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true;
  mockRouter.canGoBack.mockReturnValue(true);
  mockPolicy.mockResolvedValue(ok({ ready: false, reason: 'RETENTION_POLICY_NOT_PUBLISHED', missingDataClasses: [] }));
  mockExecution.mockResolvedValue(ok({ ...execution(), executionAdmitted: false, policyVersion: null }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it.each(['narucilac', 'uskocer'])('reads both actual services in parallel for %s with no mutation on entry', async intent => {
  mockIntent = intent; const first = deferred(), second = deferred();
  mockPolicy.mockReturnValueOnce(first.promise); mockExecution.mockReturnValueOnce(second.promise);
  await render(); expect(mockPolicy).toHaveBeenCalledTimes(1); expect(mockExecution).toHaveBeenCalledTimes(1);
  expect(texts()).toContain('Učitavamo rokove čuvanja'); expect(button('Osvežite stanje').disabled).toBe(true);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});
it('keeps unpublished retention and unavailable closure explicit with no fake deadline or action', async () => {
  await render(); expect(texts()).toContain('Potpun raspored rokova čuvanja još nije dostupan.');
  expect(texts()).toContain('Zatvaranje naloga trenutno nije dostupno');
  expect(texts()).not.toContain('fixture duration');
  expect(tree.root.findAll(node => node.type === 'Button' as React.ElementType).map(node => node.props.label))
    .toEqual(['Otvorite izvoz', 'Osvežite stanje']);
});
it('renders every published rule field and only the narrow matching capability', async () => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution())); await render();
  for (const value of ['synthetic purpose', 'fixture duration', 'fixture trigger', 'fixture exception', 'fixture basis',
    'samo za napuštene AI razgovore', 'Ovo nije potvrda da je određeni razgovor obrisan']) expect(texts()).toContain(value);
  expect(texts()).not.toContain('P3_AI_ABANDONED_UNBOUND_V1'); expect(texts()).not.toContain('AI_VOLATILE');
});
it('does not combine different policy versions into an admission', async () => {
  mockPolicy.mockResolvedValue(ok(policy('fixture-v2'))); mockExecution.mockResolvedValue(ok(execution('fixture-v1'))); await render();
  expect(texts()).toContain('Dostupnost automatskog brisanja nije potvrđena');
  expect(texts()).not.toContain('brisanje je omogućeno');
});
it.each(['policy', 'execution'])('keeps the other reader usable after %s fails without exposing transport details', async failed => {
  mockPolicy.mockResolvedValue(ok(policy())); mockExecution.mockResolvedValue(ok(execution()));
  (failed === 'policy' ? mockPolicy : mockExecution).mockRejectedValueOnce(new Error('private transport diagnostic'));
  await render(); expect(texts()).not.toContain('private transport'); expect(texts()).not.toContain('brisanje je omogućeno');
  if (failed === 'execution') expect(texts()).toContain('fixture duration');
  await act(async () => button('Osvežite stanje').onPress());
  expect(mockPolicy).toHaveBeenCalledTimes(2); expect(mockExecution).toHaveBeenCalledTimes(2);
});
it('opens existing export once after an explicit double tap', async () => {
  await render(); const open = button('Otvorite izvoz').onPress;
  await act(async () => { open(); open(); }); expect(mockRouter.navigate.mock.calls).toEqual([['/profil/izvoz']]);
});
it.each(['account', 'incarnation', 'intent', 'blur'])('retires retained navigation after %s changes', async change => {
  await render(); const open = button('Otvorite izvoz').onPress;
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: 'account-a' }, accountRevision: 3 };
  else if (change === 'intent') mockIntent = 'uskocer';
  else { mockFocused = false; await update(); mockFocused = true; await update(); }
  await act(async () => open()); expect(mockRouter.navigate).not.toHaveBeenCalled();
});
it.each(['account', 'blur'])('discards late schedule success after %s changes', async change => {
  const old = deferred(); mockPolicy.mockReturnValueOnce(old.promise); await render();
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else mockFocused = false;
  await update(); await act(async () => old.resolve(ok(policy('retired-fixture'))));
  expect(texts()).not.toContain('retired-fixture'); expect(texts()).not.toContain('fixture duration');
});
it.each([true, false])('returns through available history %s or Profile fallback', async history => {
  mockRouter.canGoBack.mockReturnValue(history); await render();
  const back = tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress;
  await act(async () => { back(); back(); });
  expect(mockRouter.back).toHaveBeenCalledTimes(history ? 1 : 0);
  expect(mockRouter.replace.mock.calls).toEqual(history ? [] : [['/profil']]);
});
