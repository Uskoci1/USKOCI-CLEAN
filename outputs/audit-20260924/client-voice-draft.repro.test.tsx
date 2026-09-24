import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiTurnIntentJournal } from '../../src/data/aiTurnIntentJournal';
jest.mock('@react-native-async-storage/async-storage', () => { const values = new Map<string, string>(); return { getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }), removeItem: jest.fn(async (key: string) => { values.delete(key); }), clear: jest.fn(async () => { values.clear(); }) }; });
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AiNeedV2Conversation } from '../../src/contracts/aiNeedV2';
import type { VoicePhase } from '../../src/features/voice/holdToTalk';
import { NEED_FACT_V2_DEFINITIONS, type NeedFactV2Key } from '../../src/contracts/needFactsV2';

let mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
let mockParams: { conversationId?: string | string[]; entryKey?: string | string[] } = {}, mockCounter = 0;
let mockReduced = false;
let mockVoicePhase: VoicePhase = 'IDLE';
let mockRealVoice = false;
let mockAppState = 'active';
const mockAppListeners = new Set<(state: string) => void>();
const mockPermission = jest.fn(), mockCapture = {
  start: jest.fn(), stopCapture: jest.fn(), finalize: jest.fn(), dispose: jest.fn(),
};
const mockCreateCapture = jest.fn();
jest.mock('../../src/features/voice/nativeSpeechAdapter', () => ({
  createNativeSpeechAdapter: () => ({ requestPermission: (...args: unknown[]) => mockPermission(...args),
    createCapture: (...args: unknown[]) => mockCreateCapture(...args) }),
}));
jest.mock('../../src/data/supabaseClient', () => ({ supabaseKonfigurisan: () => false }));
const mockVoiceCancel = jest.fn(), mockVoiceOptions = jest.fn();
const mockCancel = jest.fn(), mockRecover = jest.fn();
const mockOpen = jest.fn(), mockLoad = jest.fn(), mockSend = jest.fn(), mockTurn = jest.fn(), mockAbandon = jest.fn();
const mockRouter = { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), push: jest.fn() };
jest.mock('../../src/data/index', () => ({ aiNeedV2Izvor: { openConversation: (...args: unknown[]) => mockOpen(...args),
  loadConversation: (...args: unknown[]) => mockLoad(...args), sendMessage: (...args: unknown[]) => mockSend(...args),
  readTurn: (...args: unknown[]) => mockTurn(...args), recoverTurn: (...args: unknown[]) => mockRecover(...args), cancelTurn: (...args: unknown[]) => mockCancel(...args), abandonConversation: (...args: unknown[]) => mockAbandon(...args) } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../src/store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../src/store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../src/lib/idempotencija', () => ({ noviUuidZahtevId: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++mockCounter).padStart(12, '0')}` }));
jest.mock('../../src/features/voice/useHoldToTalk', () => ({ useHoldToTalk: (options: unknown) => {
  mockVoiceOptions(options);
  if (mockRealVoice) return jest.requireActual('../../src/features/voice/useHoldToTalk').useHoldToTalk(options);
  return { controller: { cancel: mockVoiceCancel, getSnapshot: () => ({ phase: mockVoicePhase }) },
    state: { phase: mockVoicePhase } }; } }));
// The voice module has three parts since 2026-09-24 (the composer's microphone, its notice line and voice mode); the
// harness stands each in as a host element. Their own behaviour is in voice-composer-controls.test.tsx.
jest.mock('../../src/ui/aiFirst/VoiceComposer', () => ({ VoiceComposer: 'VoiceComposer', VoiceNotice: 'VoiceNotice', VoiceMode: 'VoiceMode',
  HOLD_HINT: 'Drži mikrofon dok govoriš, pa pusti da pošalješ.' }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'AppState') return { currentState: mockAppState, addEventListener: (_name: string, listener: (state: string) => void) => {
    mockAppListeners.add(listener); return { remove: () => mockAppListeners.delete(listener) };
  } };
  if (key === 'Keyboard') return { dismiss: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) };
  // One setting, read the way the shell reads it now (useSystemReducedMotion: the startup snapshot, then the live OS value).
  // On a phone both come from the same switch; the harness makes them agree the same way.
  if (key === 'AccessibilityInfo') return { isReduceMotionEnabled: async () => mockReduced, addEventListener: () => ({ remove: () => undefined }) };
  if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 1, fontScale: 1 });
  return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
// The shell now reaches the sheet engine, which imports react-native-gesture-handler, and gesture-handler wraps one of its
// own views with `createAnimatedComponent` when it loads. The harness hands that component back unchanged.
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  FadeIn: { duration: (duration: number) => ({ duration }) },
  FadeInDown: { duration: (duration: number) => ({ duration, withInitialValues: () => ({ duration }) }) },
  useReducedMotion: () => mockReduced, useSharedValue: (value: number) => ({ value, get: () => value, set: (next: number) => { value = next; } }), cancelAnimation: jest.fn(),
  useAnimatedStyle: () => ({}), withDelay: (_d: number, value: unknown) => value,
  withRepeat: (value: unknown) => value, withTiming: (value: number) => value }));
// The options panel reads reduced motion from the one store (ui/system/motion) since 2026-09-24; the conversation shell
// still asks Reanimated, so both answer the same.
jest.mock('../../src/ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'SvgPath', Circle: 'SvgCircle', Ellipse: 'SvgEllipse', G: 'SvgGroup',
  Defs: 'SvgDefs', LinearGradient: 'SvgLinearGradient', Rect: 'SvgRect', Stop: 'SvgStop' }));
jest.mock('../../src/ui/Text', () => ({ T: 'T' }));
// The point editor reaches the native map; the stand-in keeps its one contract that matters here: before confirmed
// points are thrown away it asks its own question (a ConfirmSheet it renders itself), and only the answer closes it.
jest.mock('../../src/ui/location/ConversationPointAsk', () => {
  const React = require('react');
  const { useConfirmSheet } = require('../../src/ui/system/ConfirmSheet');
  function PointAskStub(props: { conversationId: string; onClose: () => void }) {
    const confirmation = useConfirmSheet();
    return React.createElement(React.Fragment, null,
      React.createElement('PointAsk', { conversationId: props.conversationId }),
      React.createElement('Press', { accessibilityLabel: 'Kasnije', onPress: () => confirmation.ask({ title: 'Potvrđena tačka nije sačuvana',
        message: 'Ako sad izađeš, ova tačka se gubi.', cancelLabel: 'Nastavi potvrđivanje', confirmLabel: 'Izađi ipak', tone: 'danger',
        onConfirm: props.onClose }) }),
      confirmation.sheet);
  }
  return { __esModule: true, default: PointAskStub, ConversationPointAsk: PointAskStub };
});
// The conversation loads the point editor with React.lazy (a dynamic import, which Jest runs only with
// --experimental-vm-modules). It is the only lazy part of this screen, so the harness hands lazy the stand-in above.
jest.mock('react', () => ({ ...jest.requireActual('react'), lazy: () => require('../../src/ui/location/ConversationPointAsk').default }));
jest.mock('../../src/ui/Press', () => ({ Press: 'Press' }));
import Intake from '../../src/app/(app)/nova';
import { ConfirmSheet } from '../../src/ui/system/ConfirmSheet';
import { ActionSheet } from '../../src/ui/system/ActionSheet';
import BottomSheet from '@gorhom/bottom-sheet';
import { ProductSheet } from '../../src/ui/product/ProductSheet';

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
// Typing and speaking are two modes: the field opens when the keyboard is chosen, and a
// draft keeps it open. A test that types chooses it first, exactly as a person does.
const openKeyboard = async () => {
  if (tree.root.findAllByProps({ accessibilityLabel: 'Poruka za AI' }).length) return;
  const keyboard = tree.root.findByProps({ accessibilityLabel: 'Piši umesto da govoriš' }).props;
  await act(async () => keyboard.onPress());
};
const type = async (value = 'Treba preneti ormar sutra.') => { await openKeyboard(); await act(async () => input().onChangeText(value)); };
/**
 * A conversation exists once someone has said something into it (owner decision, 2026-09-18), so a
 * test that needs one either starts it by speaking, or comes back to one that already exists — the
 * two ways a person gets to a conversation with a row behind it.
 */
const start = async (body = 'Treba preneti ormar sutra.') => {
  await render(); await type(body); await act(async () => submit().onPress());
};
const resume = async () => { mockParams = { conversationId: id }; await render(); };
const blur = async () => { mockFocused = false; await update(); };
const focus = async () => { mockFocused = true; await update(); };
// Leaving the conversation is asked in an in-app ConfirmSheet (it was Alert.alert). `leaveSheet().props.onConfirm` is the
// screen's own answer, the closure the Alert used to get; the buttons are what a person presses.
const leaveSheet = () => tree.root.findByType(ConfirmSheet);
const leaveSheets = () => tree.root.findAllByType(ConfirmSheet);
const answer = (testID: 'confirm-sheet-confirm' | 'confirm-sheet-cancel') => leaveSheet().findByProps({ testID }).props.onPress();
const options = async () => { await act(async () => tree.root.findByProps({ accessibilityLabel: 'Opcije' }).props.onPress()); };
// The options panel became the app's "···" menu (ActionSheet, 2026-09-24): its rows are menu items, not V2Actions, and it
// closes without a choice the way a menu does (Back, a tap outside), which is its own onClose.
const menuItems = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'menuitem' && node.props.accessibilityLabel === label);
const menuItem = (label: string) => { const [item] = menuItems(label); if (!item) throw new Error(`No menu item ${label}`); return item.props; };
const closeMenu = async () => { await act(async () => tree.root.findByType(ActionSheet).props.onClose()); };
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks(); for (const mock of [mockOpen, mockLoad, mockSend, mockTurn, mockAbandon, mockRecover, mockCancel]) mock.mockReset();
  mockSession = { user: { id: 'aaaaaaaa-1111-4111-8111-111111111111' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockParams = {}; mockCounter = 0;
  mockReduced = false;
  mockVoicePhase = 'IDLE';
  mockRealVoice = false; mockAppState = 'active'; mockAppListeners.clear();
  mockPermission.mockReset().mockResolvedValue('granted');
  mockCreateCapture.mockReset().mockReturnValue(mockCapture);
  mockCapture.start.mockReset().mockResolvedValue(undefined);
  mockCapture.finalize.mockReset().mockResolvedValue({ kind: 'final', text: 'Treba prevesti ormar.' });
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

function recovery(status: ReturnType<typeof turn>['podatak'], cancelled = false, dispatched = false) {
  return ok({ accountId: mockSession.user.id, conversationId: id, clientRequestId: status.clientRequestId,
    conversationStatus: 'OPEN', turn: status, providerDispatched: dispatched, cancelled,
    canCancel: !cancelled && !dispatched && status.state !== 'SUCCEEDED', authoritative: true });
}
// Read-only audit reproduction. Expected behavior assertions fail on b1da968c.
// All transport, auth, storage and speech adapters are mocked; real route and editor execute.
it('AUDIT CF01: successful held speech preserves a different unsent typed draft', async () => {
  mockSend.mockImplementation((_id: string, _body: string, key: string) => Promise.resolve(turn(key, 'SUCCEEDED')));
  mockTurn.mockImplementation((_id: string, key: string) => Promise.resolve(turn(key, 'SUCCEEDED')));
  await render(); await type('Već ukucano.');
  const receive = mockVoiceOptions.mock.calls.at(-1)![0].onTranscript;
  await act(async () => expect(receive({ text: 'Treba mi prevoz.', isCurrent: () => true, session: { mode: 'hold' } })).toBe(true));
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0][1]).toBe('Treba mi prevoz.');
  expect(await aiTurnIntentJournal.load(mockSession.user.id)).toBeNull();
  expect(input().value).toBe('Već ukucano.');
});
it('AUDIT CF01: recovery of a successful held speech turn preserves the unsent typed draft', async () => {
  await render(); await type('Već ukucano.');
  const receive = mockVoiceOptions.mock.calls.at(-1)![0].onTranscript;
  await act(async () => expect(receive({ text: 'Treba mi prevoz.', isCurrent: () => true, session: { mode: 'hold' } })).toBe(true));
  expect(input().value).toBe('Već ukucano.');
  const key = mockSend.mock.calls[0][2];
  mockTurn.mockResolvedValue(turn(key, 'SUCCEEDED'));
  await act(async () => button('Proveri ishod').onPress());
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(input().value).toBe('Već ukucano.');
});