import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import type { VoiceSnapshot } from '../../features/voice/holdToTalk';
let mockHeight = 844, mockScale = 1, mockReduced = false;
const mockKeyboard: Record<string, () => void> = {};
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, { get(target, key) {
    if (key === 'Keyboard') return { addListener: (name: string, cb: () => void) => {
      mockKeyboard[name] = cb; return { remove: jest.fn() };
    }, dismiss: jest.fn() };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: mockHeight, fontScale: mockScale, scale: 3 });
    if (key === 'AccessibilityInfo') return { isScreenReaderEnabled: async () => false, addEventListener: () => ({ remove: jest.fn() }),
      announceForAccessibility: jest.fn(), isReduceMotionEnabled: async () => mockReduced };
    return ['View', 'ScrollView', 'KeyboardAvoidingView', 'TextInput', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
// The shell now reaches the sheet engine, which imports react-native-gesture-handler, and gesture-handler wraps one of its
// own views with `createAnimatedComponent` when it loads. The harness hands that component back unchanged.
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  FadeIn: { duration: (duration: number) => ({ duration }) },
  FadeInDown: { duration: (duration: number) => ({ duration, withInitialValues: () => ({ duration }) }) },
  useReducedMotion: () => false, useSharedValue: (value: number) => ({ value, get: () => value, set: (next: number) => { value = next; } }), cancelAnimation: jest.fn(),
  useAnimatedStyle: () => ({}), withDelay: (_d: number, value: unknown) => value,
  withRepeat: (value: unknown) => value, withTiming: (value: number) => value }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeArea' }));
// One reduced-motion store (ui/system/motion): the shell, its chrome and voice mode read it; the harness sets it.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'GESTURE_SYNTHETIC' }));
import { AiConversationShell, type AiConversationShellProps } from '../../ui/aiFirst/AiConversationShell';
import { HOLD_HINT, VoiceMode } from '../../ui/aiFirst/VoiceComposer';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
let tree: ReactTestRenderer;
const idle: VoiceSnapshot = { phase: 'IDLE', session: null, finalText: '', interimText: '', audioLevel: null, fallbackText: '', error: null };
const controller = () => ({ begin: jest.fn(() => true), release: jest.fn(), cancel: jest.fn(), useFallback: jest.fn(), getSnapshot: () => idle });
const voice = (patch: Partial<NonNullable<AiConversationShellProps['voice']>> = {}) => ({ controller: controller() as never, state: idle,
  disabled: false, onKeepText: jest.fn(() => true), ...patch }) as NonNullable<AiConversationShellProps['voice']>;
// Review r4 ra item 15: the shell's dead `subtitle` prop is gone (the chrome drew nothing for it), so the helper no longer passes one.
const props = (): AiConversationShellProps => ({title:'Novi zadatak',card:jest.fn(()=>null),
  messages:[],welcome:'Šta ti treba?',welcomeDetail:'Opiši zadatak.',value:'Sačuvana poruka',canEdit:true,
  canSend:false,pending:false,busy:false,onChange:jest.fn(),onSend:jest.fn(),onBack:jest.fn(),onOptions:jest.fn()});
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(()=>{mockHeight=844;mockScale=1;mockReduced=false;});
afterEach(async()=>{await act(async()=>tree?.unmount());});
it('keeps recovery scrollable and composer reachable, without discarding a pending draft',async()=>{
  const p=props();p.pending=true;p.status=<>Provera ishoda je dostupna.</>;
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  const thread=tree.root.findByProps({testID:'ai-conversation-thread'});
  expect(thread.findByProps({testID:'ai-recovery-in-thread'})).toBeDefined();
  const footer=tree.root.findByProps({testID:'ai-composer-footer'});
  expect(footer.findAllByProps({testID:'ai-recovery-in-thread'})).toHaveLength(0);
  expect(footer.findByProps({accessibilityLabel:'Poruka za AI'}).props.value).toBe('Sačuvana poruka');
  expect(p.card).toHaveBeenLastCalledWith(true);
  expect(StyleSheet.flatten(thread.props.style).minHeight).toBe(0);
  expect(p.onSend).not.toHaveBeenCalled();
});
it('offers a way in before the first word, and one tap puts it in the message',async()=>{
  // 38 of the first 62 conversations never received a single message: the screen opened, said
  // "Reci šta ti treba" over an empty card, and was left. An opening is a start, not a command,
  // so it lands in the composer for the person to finish rather than being sent for them.
  const p=props();p.openings=['Treba mi prevoz','Treba mi majstor'];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  const opening=tree.root.findByProps({accessibilityLabel:'Treba mi prevoz'});
  await act(async()=>opening.props.onPress());
  expect(p.onChange).toHaveBeenCalledWith('Treba mi prevoz ');
  expect(p.onSend).not.toHaveBeenCalled();
});
it('hides the pinned area entirely when there is nothing yet to pin',async()=>{
  const p=props();p.card=jest.fn(()=>null);
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(tree.root.findAllByProps({testID:'ai-pinned-card'})).toHaveLength(0);
});
it('does not offer openings once the conversation has started, or while it cannot be edited',async()=>{
  const p=props();p.openings=['Treba mi prevoz'];p.messages=[{id:'m1',fromAi:false,body:'Treba mi krečenje'}];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(tree.root.findAllByProps({accessibilityLabel:'Treba mi prevoz'})).toHaveLength(0);
  const closed=props();closed.openings=['Treba mi prevoz'];closed.canEdit=false;
  await act(async()=>tree.update(<AiConversationShell {...closed}/>));
  expect(tree.root.findAllByProps({accessibilityLabel:'Treba mi prevoz'})).toHaveLength(0);
});
it('an empty status fragment does not permanently collapse a normal task card',async()=>{
  const p=props();p.status=<></>;
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(p.card).toHaveBeenLastCalledWith(false);
  await act(async()=>mockKeyboard.keyboardDidShow());expect(p.card).toHaveBeenLastCalledWith(true);
  await act(async()=>mockKeyboard.keyboardDidHide());expect(p.card).toHaveBeenLastCalledWith(false);
});
it.each([{height:640,scale:1},{height:844,scale:2}])('compacts without disabling editing on constrained geometry %o',async({height,scale})=>{
  mockHeight=height;mockScale=scale;const p=props();
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(p.card).toHaveBeenLastCalledWith(true);
  expect(tree.root.findByProps({accessibilityLabel:'Poruka za AI'}).props.editable).toBe(true);
});
it('explains speech privacy in an in-app notice with one button, not a system alert',async()=>{
  // 2026-09-24: the (i) of the old voice bar is a quiet link under the welcome now (and the (i) of voice mode).
  const p=props();p.value='';p.voice=voice();
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  await act(async()=>tree.root.findByProps({accessibilityLabel:'O govornom unosu i privatnosti'}).props.onPress());
  const notice=tree.root.findByType(ConfirmSheet);
  expect(notice.props).toMatchObject({title:'Govorni unos i privatnost',message:VOICE_PROCESSING_NOTICE,confirmLabel:'U redu',cancelLabel:null});
  expect(notice.findAllByProps({testID:'confirm-sheet-cancel'})).toHaveLength(0);
  await act(async()=>notice.findByProps({testID:'confirm-sheet-confirm'}).props.onPress());
  expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
});

describe('the floating composer (owner step 6, Gemini reference)', () => {
  it('empty: the microphone and the voice-mode button, no send; text: the round send instead', async () => {
    const p = props(); p.value = ''; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const composer = tree.root.findByProps({ testID: 'ai-composer' });
    expect(composer.findAllByProps({ testID: 'voice-mic' }).length).toBeGreaterThan(0);
    expect(composer.findAllByProps({ testID: 'ai-voice-mode' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ testID: 'ai-send' })).toHaveLength(0);
    const typed = { ...p, value: 'Treba mi prevoz', canSend: true };
    await act(async () => tree.update(<AiConversationShell {...typed} />));
    expect(tree.root.findAllByProps({ testID: 'ai-voice-mode' })).toHaveLength(0);
    const send = tree.root.findByProps({ testID: 'ai-send' });
    expect(send.props).toMatchObject({ accessibilityLabel: 'Pošalji poruku', disabled: false });
    await act(async () => send.props.onPress());
    // The shell only asks: the screen's own send, with every guard it has, decides.
    expect(p.onSend).toHaveBeenCalledTimes(1);
  });
  it('whitespace is not text: the send stays away until something is written', async () => {
    const p = props(); p.value = '   '; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ testID: 'ai-send' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'ai-voice-mode' })).toHaveLength(1);
  });
  it('pending: the send is the same message again, disabled, and says why to the eye and to a screen reader', async () => {
    const p = props(); p.pending = true; p.canSend = false; p.voice = voice({ disabled: true });
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const send = tree.root.findByProps({ testID: 'ai-send' });
    expect(send.props).toMatchObject({ accessibilityLabel: 'Ponovi istu poruku', disabled: true, accessibilityState: { disabled: true },
      accessibilityHint: 'Prethodna poruka čeka ishod. Proveri ga u razgovoru.' });
    expect(tree.root.findByProps({ testID: 'ai-send-reason' }).props.children).toBe('Prethodna poruka čeka ishod. Proveri ga u razgovoru.');
    const busy = { ...p, busy: true };
    await act(async () => tree.update(<AiConversationShell {...busy} />));
    expect(tree.root.findByProps({ testID: 'ai-send' }).props.accessibilityHint).toBe('Poruka se šalje.');
  });
  it('a send that can go says nothing extra', async () => {
    const p = props(); p.canSend = true;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ testID: 'ai-send-reason' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'ai-send' }).props.accessibilityHint).toBeUndefined();
  });
  it('"+" is drawn only when there is something to attach to, and says when it cannot be used', async () => {
    const p = props();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Fotografije zadatka' })).toHaveLength(0);
    const onPress = jest.fn();
    const attach = { ...p, attach: { label: 'Fotografije zadatka', onPress, disabled: true } };
    await act(async () => tree.update(<AiConversationShell {...attach} />));
    const plus = tree.root.findByProps({ accessibilityLabel: 'Fotografije zadatka' });
    expect(plus.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  });
  it('a tap on the held microphone explains itself above the composer; typing takes the advice away', async () => {
    const p = props(); p.value = ''; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onPressIn === 'function')[0];
    await act(async () => { mic.props.onPressIn({ nativeEvent: { pageY: 200 } }); mic.props.onPressOut(); });
    expect(text()).toContain(HOLD_HINT);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Poruka za AI' }).props.onChangeText('T'));
    expect(text()).not.toContain(HOLD_HINT);
  });
  // Review r4 ra item 7: once the field has text the waveform gives way to send, so the advice after a tap carries the
  // way to speak without holding; with a draft it opens voice mode with the review on, so speech joins the draft.
  it.each([['with a draft', 'Treba mi prevoz', true], ['with an empty field', '', false]] as const)(
    'the advice after a tap opens voice mode without holding %s', async (_name, value, review) => {
      const p = props(); p.value = value; p.canSend = !!value; p.voice = voice();
      await act(async () => { tree = create(<AiConversationShell {...p} />); });
      expect(tree.root.findAllByProps({ label: 'Govori bez držanja' })).toHaveLength(0);
      const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onPressIn === 'function')[0];
      await act(async () => { mic.props.onPressIn({ nativeEvent: { pageY: 200 } }); mic.props.onPressOut(); });
      await act(async () => tree.root.findByProps({ label: 'Govori bez držanja' }).props.onPress());
      expect(tree.root.findByType(VoiceMode).props.reviewFirst).toBe(review);
      expect(text()).not.toContain(HOLD_HINT);
      // Opening voice mode starts nothing: the one capture is the tap on the held microphone that brought the advice.
      expect(p.onSend).not.toHaveBeenCalled(); expect(p.voice!.controller.begin).toHaveBeenCalledTimes(1);
    });
  it('the advice offers no voice mode while the screen cannot take a message', async () => {
    const p = props(); p.value = 'Treba mi prevoz'; p.voice = voice({ disabled: true });
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onPressIn === 'function')[0];
    await act(async () => { mic.props.onPressIn({ nativeEvent: { pageY: 200 } }); mic.props.onPressOut(); });
    expect(tree.root.findAllByProps({ label: 'Govori bez držanja' })).toHaveLength(0);
  });
  it('the chrome has no "···" when the screen has nothing to put behind it', async () => {
    const p = props(); delete p.onOptions;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Opcije' })).toHaveLength(0);
  });
});

describe('voice mode', () => {
  it('opens from the waveform, shows the last exchange as text, and closes without touching the microphone', async () => {
    const p = props(); p.value = ''; p.voice = voice();
    p.messages = [{ id: 'u', fromAi: false, body: 'Treba mi prevoz.' }, { id: 'a', fromAi: true, body: 'Odakle i dokle?' }];
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findAllByType(VoiceMode)).toHaveLength(0);
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-mode' }).props.onPress());
    const mode = tree.root.findByType(VoiceMode);
    expect(mode.props).toMatchObject({ answer: 'Odakle i dokle?', said: 'Treba mi prevoz.', thinking: false });
    expect(text()).toContain('Odakle i dokle?');
    await act(async () => tree.root.findByProps({ testID: 'voice-mode-close' }).props.onPress());
    expect(tree.root.findAllByType(VoiceMode)).toHaveLength(0);
    expect(p.voice.controller.cancel).not.toHaveBeenCalled();
    expect(p.onSend).not.toHaveBeenCalled();
  });
  it('the waveform is disabled while the screen cannot take a message', async () => {
    const p = props(); p.value = ''; p.voice = voice({ disabled: true });
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    expect(tree.root.findByProps({ testID: 'ai-voice-mode' }).props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  });
  it('holds still under reduced motion and fades in otherwise', async () => {
    const p = props(); p.value = ''; p.voice = voice();
    mockReduced = true;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-mode' }).props.onPress());
    expect(tree.root.findAllByType('AnimatedView' as React.ElementType)).toHaveLength(0);
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Razgovor glasom').length).toBeGreaterThan(0);
    await act(async () => tree.unmount());
    mockReduced = false;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-mode' }).props.onPress());
    expect(tree.root.findByProps({ testID: 'voice-glow' }).findAllByType('AnimatedView' as React.ElementType)).toHaveLength(1);
  });
  it('a reviewed capture lands in the field and voice mode steps aside for it', async () => {
    const p = props(); p.value = ''; const v = voice(); p.voice = v;
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    await act(async () => tree.root.findByProps({ testID: 'ai-voice-mode' }).props.onPress());
    await act(async () => tree.root.findAll(node => node.props.accessibilityLabel === 'Pregledaj tekst pre slanja' && node.props.onPress)[0].props.onPress());
    await act(async () => tree.root.findAll(node => node.props.testID === 'voice-mode-mic' && node.props.onPress)[0].props.onPress());
    expect(v.controller.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'accessible');
    const session = { accountId: 'a', accountRevision: 1, conversationId: 'c', generation: 1, gestureId: 'GESTURE_SYNTHETIC', startedAt: 0, mode: 'accessible' as const };
    for (const phase of ['LISTENING', 'FINALIZING'] as const)
      await act(async () => tree.update(<AiConversationShell {...p} voice={{ ...v, state: { ...idle, phase, session } }} />));
    expect(tree.root.findAllByType(VoiceMode)).toHaveLength(1);
    await act(async () => tree.update(<AiConversationShell {...p} value="Treba mi prevoz." voice={{ ...v, state: { ...idle, session } }} />));
    expect(tree.root.findAllByType(VoiceMode)).toHaveLength(0);
  });
});
