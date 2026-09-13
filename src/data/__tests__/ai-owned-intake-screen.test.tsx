import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiTurnIntentJournal } from '../aiTurnIntentJournal';
jest.mock('@react-native-async-storage/async-storage', () => { const values = new Map<string, string>(); return { getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }), removeItem: jest.fn(async (key: string) => { values.delete(key); }), clear: jest.fn(async () => { values.clear(); }) }; });
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AiNeedV2Conversation } from '../../contracts/aiNeedV2';
import { NEED_FACT_V2_DEFINITIONS, type NeedFactV2Key } from '../../contracts/needFactsV2';

let mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
let mockParams: { conversationId?: string | string[]; entryKey?: string | string[] } = {}, mockCounter = 0;
let mockReduced = false;
const mockCancel = jest.fn(), mockRecover = jest.fn();
const mockOpen = jest.fn(), mockLoad = jest.fn(), mockSend = jest.fn(), mockTurn = jest.fn(), mockAbandon = jest.fn(), mockAlert = jest.fn();
const mockRouter = { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), push: jest.fn() };
jest.mock('../index', () => ({ aiNeedV2Izvor: { openConversation: (...args: unknown[]) => mockOpen(...args),
  loadConversation: (...args: unknown[]) => mockLoad(...args), sendMessage: (...args: unknown[]) => mockSend(...args),
  readTurn: (...args: unknown[]) => mockTurn(...args), recoverTurn: (...args: unknown[]) => mockRecover(...args), cancelTurn: (...args: unknown[]) => mockCancel(...args), abandonConversation: (...args: unknown[]) => mockAbandon(...args) } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++mockCounter).padStart(12, '0')}` }));
jest.mock('../../features/voice/useHoldToTalk', () => ({ useHoldToTalk: () => ({ controller: { resolveSubmission: jest.fn() },
  state: { phase: 'IDLE', submission: null } }) }));
jest.mock('../../ui/aiFirst/VoiceComposer', () => ({ VoiceComposer: 'VoiceComposer' }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'Alert') return { alert: (...args: unknown[]) => mockAlert(...args) };
  if (key === 'Keyboard') return { dismiss: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) };
  if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 1, fontScale: 1 });
  return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' },
  FadeIn: { duration: (duration: number) => ({ duration }) }, useReducedMotion: () => mockReduced }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'SvgPath', G: 'SvgGroup',
  Defs: 'SvgDefs', LinearGradient: 'SvgLinearGradient', Rect: 'SvgRect', Stop: 'SvgStop' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', ArrowRight: 'Icon', CheckCircle: 'Icon', PaperPlaneTilt: 'Icon',
  ShieldCheck: 'Icon', Sparkle: 'Icon', Warning: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button', Card: 'Card' }));
import Intake from '../../app/(app)/nova';

const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', other = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ok = <T,>(podatak: T) => ({ ok: true as const, podatak });
const unknown = () => ({ ok: false, kod: 'AI_TURN_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
function conversation(patch: Partial<AiNeedV2Conversation> = {}): AiNeedV2Conversation {
  return { conversationId: id, schemaVersion: 'NEED_FACT_V2', status: 'OPEN', messages: [], facts: [], safety: 'ALLOW',
    review: { conversationId: id, schemaVersion: 'NEED_FACT_V2', boundNeedId: null, canSaveDraft: false, missingRequired: [], facts: [] }, ...patch };
}
function publicFact(key: NeedFactV2Key, value: unknown): AiNeedV2Conversation['facts'][number] {
  const definition = NEED_FACT_V2_DEFINITIONS[key];
  return { id: key, key, value, displayValue: 'public display', valueType: definition.valueType, privacyClass: 'PUBLIC',
    requiredForDraft: definition.requiredForDraft, status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER', evidence: null };
}
function turn(requestId: string, state: string, retryAllowed = false) { return ok({ conversationId: id, clientRequestId: requestId,
  state, retryAllowed, turnId: state === 'ABSENT' ? null : other, receipt: state === 'SUCCEEDED' ? {
    userMessageId: id, assistantMessageId: other, proposedCount: 0, safety: 'ALLOW', schemaVersion: 'NEED_FACT_V2', authoritative: true } : null }); }
function deferred<T = unknown>() { let resolve!: (value: T) => void; let reject!: (value: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Intake />); }); };
const update = async () => { await act(async () => tree.update(<Intake />)); };
const button = (label: string) => tree.root.findByProps({ label }).props;
const input = () => tree.root.findByProps({ accessibilityLabel: 'Poruka za AI' }).props;
const submit = () => tree.root.findByProps({ accessibilityLabel: mockSend.mock.calls.length ? 'Ponovi istu poruku' : 'Pošalji poruku' }).props;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const type = async (value = 'Treba preneti ormar sutra.') => { await act(async () => input().onChangeText(value)); };
const blur = async () => { mockFocused = false; await update(); };
const focus = async () => { mockFocused = true; await update(); };
const options = async () => { await act(async () => button('Opcije').onPress()); };
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks(); for (const mock of [mockOpen, mockLoad, mockSend, mockTurn, mockAbandon, mockRecover, mockCancel]) mock.mockReset();
  mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockParams = {}; mockCounter = 0;
  mockReduced = false;
  mockRouter.canGoBack.mockReturnValue(true); mockOpen.mockImplementation((requestId: string) => Promise.resolve(ok({ conversationId: id, clientRequestId: requestId })));
  mockLoad.mockResolvedValue(conversation()); mockSend.mockResolvedValue(unknown());
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'ABSENT', true)));
  mockRecover.mockImplementation(async (cid: string, requestId: string) => {
    const result = await mockTurn(cid, requestId);
    return result.ok ? recovery(result.podatak) : result;
  });
  mockCancel.mockResolvedValue(unknown());
  mockAbandon.mockResolvedValue(ok({ conversationId: id, status: 'ABANDONED', authoritative: true }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('opens once with a stable request and resumes the same conversation on refocus without sending or abandoning', async () => {
  await render(); expect(mockOpen).toHaveBeenCalledTimes(1); await blur(); await focus();
  expect(mockOpen).toHaveBeenCalledTimes(1); expect(mockLoad).toHaveBeenCalledTimes(2);
  expect(mockSend).not.toHaveBeenCalled(); expect(mockAbandon).not.toHaveBeenCalled();
});
it('retains the owned open key after an unknown result and retries only by user action', async () => {
  mockOpen.mockResolvedValueOnce(unknown()); await render(); expect(mockOpen).toHaveBeenCalledTimes(1);
  await act(async () => button('Učitajte razgovor ponovo').onPress());
  expect(mockOpen.mock.calls[1][0]).toBe(mockOpen.mock.calls[0][0]); expect(input().value).toBe('');
});
it('does not load after a late open response on a blurred screen; refocus replays its original open key', async () => {
  const old = deferred(); mockOpen.mockReturnValueOnce(old.promise); await render(); const key = mockOpen.mock.calls[0][0];
  await blur(); await act(async () => old.resolve(ok({ conversationId: other, clientRequestId: key })));
  expect(mockLoad).not.toHaveBeenCalled(); await focus(); expect(mockOpen.mock.calls[1][0]).toBe(key);
  expect(mockLoad).toHaveBeenCalledWith(id); expect(mockLoad).not.toHaveBeenCalledWith(other);
});
it.each([['ambiguous', [id]], ['malformed', 'wrong']] as const)('rejects %s resume route without opening a replacement conversation', async (_label, value) => {
  mockParams = { conversationId: value as string | string[] }; await render();
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockLoad).not.toHaveBeenCalled(); expect(text()).toContain('Razgovor trenutno nije dostupan');
});
it('keeps a failed resume as a read failure and does not create another conversation', async () => {
  mockParams = { conversationId: id }; mockLoad.mockRejectedValueOnce(new Error('private backend detail')); await render();
  expect(text()).not.toContain('private backend detail'); await act(async () => button('Učitajte razgovor ponovo').onPress());
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockLoad).toHaveBeenCalledTimes(2);
});
it('serializes two retained send taps before render and keeps the original body and key', async () => {
  const held = deferred(); mockSend.mockReturnValueOnce(held.promise); await render(); await type(); const send = submit().onPress;
  await act(async () => { void send(); void send(); }); expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0].slice(0,3)).toEqual([id, 'Treba preneti ormar sutra.', expect.stringMatching(/^[a-f0-9-]{36}$/)]);
  expect(typeof mockSend.mock.calls[0][3].onText).toBe('function');
  await act(async () => held.resolve(unknown())); expect(input().value).toBe('Treba preneti ormar sutra.'); expect(input().editable).toBe(false);
});
it('requires real readback after unknown and retries the same key/body only when the server permits', async () => {
  await render(); await type(); await act(async () => submit().onPress()); const sent = mockSend.mock.calls[0];
  await act(async () => submit().onPress()); expect(mockSend).toHaveBeenCalledTimes(1);
  await act(async () => button('Proverite ishod').onPress()); expect(mockTurn).toHaveBeenCalledWith(id, sent[2]);
  await act(async () => input().onChangeText('different body')); expect(input().value).toBe(sent[1]);
  await act(async () => submit().onPress()); expect(mockSend.mock.calls[1].slice(0,3)).toEqual(sent.slice(0,3));
});
it('keeps an in-progress server receipt read-only and never polls or retries automatically', async () => {
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'PROCESSING')));
  await render(); await type(); await act(async () => submit().onPress()); await act(async () => button('Proverite ishod').onPress());
  expect(submit().disabled).toBe(true); expect(text()).toContain('AI još obrađuje poruku'); expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockTurn).toHaveBeenCalledTimes(1);
});
it('resolves a lost success receipt using IDs, clears the sent draft and accepts a fresh next request', async () => {
  await render(); await type(); await act(async () => submit().onPress()); const old = mockSend.mock.calls[0][2];
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  await act(async () => button('Proverite ishod').onPress()); expect(input().value).toBe(''); expect(input().editable).toBe(true);
  await type('Druga poruka.'); await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pošalji poruku' }).props.onPress());
  expect(mockSend.mock.calls[1][1]).toBe('Druga poruka.'); expect(mockSend.mock.calls[1][2]).not.toBe(old);
});
it('keeps pending intent across blur and reconciles before enabling another send', async () => {
  const held = deferred(); mockSend.mockReturnValueOnce(held.promise); await render(); await type();
  await act(async () => { void submit().onPress(); }); const key = mockSend.mock.calls[0][2]; await blur();
  await act(async () => held.resolve(unknown())); await focus(); expect(mockTurn).toHaveBeenCalledWith(id, key);
  expect(mockSend).toHaveBeenCalledTimes(1); expect(input().value).toBe('Treba preneti ormar sutra.');
});
it.each(['account ABA', 'intent', 'route'] as const)('rejects retained send callbacks after %s changes', async change => {
  await render(); await type(); const retained = submit().onPress, oldInput = input().onChangeText;
  if (change === 'account ABA') mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 3 };
  if (change === 'intent') mockIntent = 'uskocer';
  if (change === 'route') mockParams = { conversationId: other };
  if (change === 'route') mockLoad.mockResolvedValue(conversation({ conversationId: other }));
  await update(); await act(async () => { oldInput('old private draft'); void retained(); });
  expect(mockSend).not.toHaveBeenCalled(); expect(input().value).toBe('');
});
it('masks old private messages immediately after account ABA and ignores the late read', async () => {
  const held = deferred(); mockLoad.mockReturnValueOnce(held.promise); await render();
  mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 3 }; await update();
  await act(async () => held.resolve(conversation({ messages: [{ id, body: 'old private account message', fromAi: false,
    safety: null, proposedFactIds: [] }] })));
  expect(text()).not.toContain('old private account message'); expect(mockOpen).toHaveBeenCalledTimes(2);
});
it('does not read or navigate from a late send result after account change', async () => {
  const held = deferred(); mockSend.mockReturnValueOnce(held.promise); await render(); await type();
  await act(async () => { void submit().onPress(); }); const requestId = mockSend.mock.calls[0][2];
  mockSession = { user: { id: 'bbbbbbbb-1111-4111-8111-111111111111' }, accountRevision: 2 }; await update(); const reads = mockLoad.mock.calls.length;
  await act(async () => held.resolve(turn(requestId, 'SUCCEEDED')));
  expect(mockLoad).toHaveBeenCalledTimes(reads); expect(mockTurn).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(input().value).toBe('');
});
it('retires a confirmation callback after blur/refocus and never abandons on Back', async () => {
  await render(); await options(); await act(async () => button('Napusti razgovor').onPress());
  const confirm = mockAlert.mock.calls[0][2][1].onPress; await blur(); await focus();
  await act(async () => confirm()); expect(mockAbandon).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress());
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockAbandon).not.toHaveBeenCalled();
});
it('explicit abandonment uses the actual authority and becomes closed only after readback', async () => {
  await render(); await options(); await act(async () => button('Napusti razgovor').onPress()); expect(mockAbandon).not.toHaveBeenCalled();
  mockLoad.mockResolvedValue(conversation({ status: 'ABANDONED' }));
  await act(async () => mockAlert.mock.calls[0][2][1].onPress());
  expect(mockAbandon).toHaveBeenCalledWith(id); expect(text()).toContain('Razgovor je napušten.'); expect(input().editable).toBe(false);
});
it.each(['COMPLETED', 'ABANDONED'] as const)('keeps actual %s conversations read-only', async status => {
  mockLoad.mockResolvedValue(conversation({ status })); await render(); expect(input().editable).toBe(false); await options();
  expect(tree.root.findAllByProps({ label: 'Napusti razgovor' })).toHaveLength(0);
});
it('does not expose abandonment for an edit conversation bound to a Zadatak', async () => {
  const data = conversation(); data.review.boundNeedId = other; mockLoad.mockResolvedValue(data); await render(); await options();
  expect(tree.root.findAllByProps({ label: 'Napusti razgovor' })).toHaveLength(0);
});

it('keeps the complete conversation in its own scroll area beneath the pinned card', async () => {
  const messages = [
    { id: 'old-ai', fromAi: true, body: 'Ranije pitanje' }, { id: 'old-user', fromAi: false, body: 'Raniji odgovor' },
    { id: 'new-ai', fromAi: true, body: 'Koliko ljudi je potrebno?' }, { id: 'new-user', fromAi: false, body: 'Dve osobe.' },
  ].map(message => ({ ...message, safety: null, proposedFactIds: [] }));
  mockLoad.mockResolvedValue(conversation({ messages })); await render();
  expect(text()).toContain('Koliko ljudi je potrebno?'); expect(text()).toContain('Dve osobe.');
  expect(text()).toContain('Ranije pitanje'); expect(text()).toContain('Raniji odgovor');
  const thread = tree.root.findByProps({ testID: 'ai-conversation-thread' });
  expect(thread.findAllByProps({ testID: 'intake-task-summary' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'ai-pinned-card' }).findAllByProps({ testID: 'intake-task-summary' })).toHaveLength(1);
  expect(mockSend).not.toHaveBeenCalled(); expect(mockAbandon).not.toHaveBeenCalled();
});

it('keeps private address and resolved coordinates out of the compact live card and preserves the review destination', async () => {
  const facts: AiNeedV2Conversation['facts'] = [
    { id: 'title', key: 'need.title', value: 'Unos ormara', displayValue: 'Unos ormara', valueType: 'TEXT', privacyClass: 'PUBLIC',
      requiredForDraft: true, status: 'NEEDS_CONFIRMATION', source: 'AI_INFERENCE', evidence: null },
    { id: 'address', key: 'need.exact_address', value: 'Privatna 42', displayValue: 'Privatna 42', valueType: 'TEXT', privacyClass: 'PRIVATE',
      requiredForDraft: false, status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER', evidence: null },
    { id: 'points', key: 'need.resolved_location', value: { latitudeE6: 45255123 }, displayValue: '45255123', valueType: 'OBJECT', privacyClass: 'PRIVATE',
      requiredForDraft: false, status: 'CONFIRMED', source: 'EXPLICIT_USER_ANSWER', evidence: null },
  ];
  mockLoad.mockResolvedValue(conversation({ facts })); await render();
  expect(text()).toContain('Unos ormara'); expect(text()).toContain('NACRT');
  expect(text()).not.toContain('Privatna 42'); expect(text()).not.toContain('45255123');
  const card = tree.root.findByProps({ testID: 'intake-task-summary' });
  expect(card.props.accessibilityLabel).toBe('Otvori sažetak Zadatka');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pregledaj zadatak' })).toHaveLength(1);
  await act(async () => { card.props.onPress(); card.props.onPress(); });
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pregled-zadatka', params: { conversationId: id } });
});

it('offers the owned photo route and options without automatic abandonment', async () => {
  await render(); expect(tree.root.findAllByProps({ label: 'Napusti razgovor' })).toHaveLength(0);
  const labels = tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel).join(' ');
  expect(labels).toContain('Fotografije zadatka'); expect(labels).not.toMatch(/mikrofon|prilo[gž]|glasovn/i);
  await options(); expect(text()).toContain('Povratak čuva razgovor.');
  await act(async () => button('Zatvori').onPress()); expect(mockAbandon).not.toHaveBeenCalled(); expect(mockAlert).not.toHaveBeenCalled();
});

it('respects reduced motion for screen entry and the options panel', async () => {
  mockReduced = true; await render();
  expect(tree.root.findAllByType('AnimatedView' as React.ElementType)).toHaveLength(0);
  await options(); expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('none');
});

it('shows actual typed fixed dates and times in the existing explicit Belgrade display zone', async () => {
  mockLoad.mockResolvedValue(conversation({ facts: [publicFact('need.schedule_kind', 'FIXED_WINDOW'),
    publicFact('need.starts_at', '2026-09-10T16:00:00Z'), publicFact('need.ends_at', '2026-09-10T17:00:00Z')] }));
  await render(); expect(text()).toContain('10.'); expect(text()).toContain('18:00–19:00');
  expect(text()).toContain('vreme u Beogradu'); expect(text()).not.toContain('Tačan termin');
});
it('omits an incomplete fixed interval without inventing an end time', async () => {
  mockLoad.mockResolvedValue(conversation({ facts: [publicFact('need.schedule_kind', 'FIXED_WINDOW'),
    publicFact('need.starts_at', '2026-09-10T16:00:00Z')] }));
  await render(); expect(text()).not.toContain('18:00'); expect(text()).not.toContain('Tačan termin');
});
it.each([[5, '5 osoba'], [11, '11 osoba'], [14, '14 osoba'], [22, '22 osobe']])('uses the correct people label for %s', async (count, label) => {
  mockLoad.mockResolvedValue(conversation({ facts: [publicFact('need.people_needed', count)] }));
  await render(); expect(text()).toContain(label as string);
});

// Owner-requested pre-HTML stabilization: terminal conversation is not a dead end.
it.each(['COMPLETED', 'ABANDONED'] as const)('starts a separate owned Task after %s without changing the first one', async status => {
  const saved = conversation({ status }); saved.review.boundNeedId = status === 'COMPLETED' ? other : null;
  mockParams = { conversationId: id }; mockLoad.mockResolvedValue(saved); await render();
  const start = button('Novi Zadatak').onPress;
  await act(async () => { start(); start(); }); expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  const destination = mockRouter.replace.mock.calls[0][0];
  expect(destination.pathname).toBe('/nova'); expect(destination.params.conversationId).toBeUndefined();
  expect(destination.params.entryKey).toMatch(/^[a-f0-9-]{36}$/);
  mockParams = destination.params;
  mockOpen.mockImplementation(requestId => Promise.resolve(ok({ conversationId: other, clientRequestId: requestId })));
  mockLoad.mockResolvedValue(conversation({ conversationId: other })); await update();
  expect(mockOpen).toHaveBeenCalledTimes(1); expect(mockLoad).toHaveBeenLastCalledWith(other);
  expect(input().value).toBe(''); expect(input().editable).toBe(true);
  expect(mockAbandon).not.toHaveBeenCalled(); expect(mockSend).not.toHaveBeenCalled();
  await blur(); await focus(); expect(mockOpen).toHaveBeenCalledTimes(1);
});
it('retains the new owned-open request after an unknown second-Task open outcome', async () => {
  mockLoad.mockResolvedValue(conversation({ status: 'COMPLETED' })); await render();
  const firstKey = mockOpen.mock.calls[0][0]; await act(async () => button('Novi Zadatak').onPress());
  mockParams = mockRouter.replace.mock.calls[0][0].params; mockOpen.mockResolvedValueOnce(unknown());
  await update(); const nextKey = mockOpen.mock.calls[1][0]; expect(nextKey).not.toBe(firstKey);
  mockLoad.mockResolvedValue(conversation()); await act(async () => button('Učitajte razgovor ponovo').onPress());
  expect(mockOpen.mock.calls[2][0]).toBe(nextKey);
});
it('cannot use a retained new-Task action after losing its account or focus', async () => {
  mockLoad.mockResolvedValue(conversation({ status: 'COMPLETED' })); await render();
  const old = button('Novi Zadatak').onPress; await blur(); await focus(); await act(async () => old());
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('does not advertise a new-Task bypass for an open safety-blocked conversation', async () => {
  mockLoad.mockResolvedValue(conversation({ safety: 'BLOCK' })); await render();
  expect(tree.root.findAllByProps({ label: 'Novi Zadatak' })).toHaveLength(0);
});
it.each(['invalid', [id]])('rejects malformed new-entry key %s without creating a conversation', async entryKey => {
  mockParams = { entryKey }; await render(); expect(mockOpen).not.toHaveBeenCalled();
});
it('normal successful send clears the composer after the actual turn readback', async () => {
  mockSend.mockImplementation((_id: string, _body: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  mockTurn.mockImplementation((_id: string, requestId: string) => Promise.resolve(turn(requestId, 'SUCCEEDED')));
  await render(); await type(); await act(async () => submit().onPress());
  expect(input().value).toBe(''); expect(input().editable).toBe(true); expect(mockSend).toHaveBeenCalledTimes(1);
});

function recovery(status: ReturnType<typeof turn>['podatak'], cancelled = false, dispatched = false) {
  return ok({ accountId: mockSession.user.id, conversationId: id, clientRequestId: status.clientRequestId,
    conversationStatus: 'OPEN', turn: status, providerDispatched: dispatched, cancelled,
    canCancel: !cancelled && !dispatched && status.state !== 'SUCCEEDED', authoritative: true });
}
it('restores only the opaque pending IDs after remount before any open or provider request', async () => {
  await render(); await type('Private typed message'); await act(async () => submit().onPress());
  const requestId = mockSend.mock.calls[0][2];
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toEqual({ accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId });
  expect(String(await AsyncStorage.getItem('uskoci.ai.turn.intent.v1.' + mockSession.user.id))).not.toContain('Private typed message');
  await act(async () => tree.unmount()); mockOpen.mockClear();
  await render(); expect(mockOpen).not.toHaveBeenCalled(); expect(mockRecover).toHaveBeenLastCalledWith(id, requestId);
  expect(mockSend).toHaveBeenCalledTimes(1); expect(input().value).toBe(''); expect(input().editable).toBe(false);
  expect(button('Otkaži slanje poruke')).toBeDefined();
});
it('restored absent intent is never auto retried and clears only after exact cancellation readback', async () => {
  const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await aiTurnIntentJournal.save({ accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId });
  await render(); expect(mockSend).not.toHaveBeenCalled();
  const cancelled = recovery(turn(requestId, 'FAILED', false).podatak, true);
  mockCancel.mockResolvedValue(cancelled); mockRecover.mockResolvedValue(cancelled);
  await act(async () => button('Otkaži slanje poruke').onPress());
  expect(mockCancel).toHaveBeenCalledWith(id, requestId); expect(await aiTurnIntentJournal.load(mockSession.user.id)).toBeNull();
  expect(input().editable).toBe(true); await type('Nova poruka');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pošalji poruku' }).props.onPress());
  expect(mockSend.mock.calls[0][2]).not.toBe(requestId);
});
it('a competing provider dispatch wins cancellation without clearing its durable UUID', async () => {
  const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const intent = { accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId };
  await aiTurnIntentJournal.save(intent); await render();
  const dispatched = recovery(turn(requestId, 'PROCESSING', false).podatak, false, true);
  mockCancel.mockResolvedValue(dispatched); mockRecover.mockResolvedValue(dispatched);
  await act(async () => button('Otkaži slanje poruke').onPress());
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toEqual(intent);
  expect(input().editable).toBe(false); expect(tree.root.findAllByProps({ label: 'Otkaži slanje poruke' })).toHaveLength(0);
  expect(mockSend).not.toHaveBeenCalled();
});
it('canonical success after restart restores conversation and retires the UUID without another send', async () => {
  const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await aiTurnIntentJournal.save({ accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId });
  mockTurn.mockResolvedValue(turn(requestId, 'SUCCEEDED'));
  mockLoad.mockResolvedValue(conversation({ messages: [{ id, fromAi: false, body: 'Canonical private message', safety: null, proposedFactIds: [] }] }));
  await render(); expect(text()).toContain('Canonical private message'); expect(await aiTurnIntentJournal.load(mockSession.user.id)).toBeNull();
  expect(mockSend).not.toHaveBeenCalled(); expect(input().editable).toBe(true);
});
it('a known terminal failure restores a bound edit without abandoning it or resending automatically', async () => {
  const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await aiTurnIntentJournal.save({ accountId: mockSession.user.id, conversationId: id, clientRequestId: requestId });
  mockRecover.mockResolvedValue(recovery(turn(requestId, 'FAILED', false).podatak, false, true));
  const bound = conversation(); bound.review.boundNeedId = other; mockLoad.mockResolvedValue(bound);
  await render();
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toBeNull();
  expect(input().editable).toBe(true); expect(mockSend).not.toHaveBeenCalled(); expect(mockAbandon).not.toHaveBeenCalled();
  expect(text()).toContain('AI nije primenio prethodnu poruku.');
});
it('does not dispatch if opaque UUID persistence fails and keeps the unsent typed body', async () => {
  await render(); await type('Unsent private draft');
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage unavailable'));
  await act(async () => submit().onPress());
  expect(mockSend).not.toHaveBeenCalled(); expect(input().value).toBe('Unsent private draft');
});
it('rechecks account ABA after persistence before any network send', async () => {
  const held = deferred<void>();
  await render(); await type(); jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() => held.promise);
  await act(async () => { void submit().onPress(); });
  mockSession = { user: { id: mockSession.user.id }, accountRevision: 3 }; await update();
  await act(async () => held.resolve()); expect(mockSend).not.toHaveBeenCalled();
});
it('routes a conflicting resumed conversation back to the pending UUID owner without sending', async () => {
  await aiTurnIntentJournal.save({ accountId: mockSession.user.id, conversationId: id, clientRequestId: other });
  mockParams = { conversationId: other }; await render();
  expect(mockOpen).not.toHaveBeenCalled(); expect(mockRecover).not.toHaveBeenCalled(); expect(mockLoad).not.toHaveBeenCalled();
  await act(async () => button('Otvori prethodni razgovor').onPress());
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: id } });
});
it('unknown cancellation response retains the exact UUID across another restart', async () => {
  const intent = { accountId: mockSession.user.id, conversationId: id, clientRequestId: other };
  await aiTurnIntentJournal.save(intent); await render(); await act(async () => button('Otkaži slanje poruke').onPress());
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toEqual(intent);
  await act(async () => tree.unmount()); await render();
  expect(mockRecover).toHaveBeenLastCalledWith(id, other); expect(mockSend).not.toHaveBeenCalled();
});
