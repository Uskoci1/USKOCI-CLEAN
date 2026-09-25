import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
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
import { DraftCard } from '../../ui/v2/IntakePresentation';
import { WorkerAiCard } from '../../ui/workerProfile/WorkerAiPresentation';
import { CardValue } from '../../ui/v2/TaskFace';
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
it.each([{height:844,scale:2},{height:420,scale:1}])('keeps one reachable review inside the scroll on constrained geometry %o',async({height,scale})=>{
  mockHeight=height;mockScale=scale;const p=props(), review=jest.fn();
  p.card=()=> <View testID="review-target" onTouchEnd={review}/>;
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  const thread=tree.root.findByProps({testID:'ai-conversation-thread'});
  expect(tree.root.findAllByProps({testID:'ai-pinned-card'})).toHaveLength(0);
  expect(tree.root.findAllByProps({testID:'review-target'})).toHaveLength(1);
  await act(async()=>thread.findByProps({testID:'review-target'}).props.onTouchEnd());
  expect(review).toHaveBeenCalledTimes(1);
  expect(tree.root.findByProps({accessibilityLabel:'Poruka za AI'}).props.editable).toBe(true);
  expect(p.onSend).not.toHaveBeenCalled();
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
it('offers a return to the latest answer without taking the reader away from earlier messages',async()=>{
  const p=props();p.messages=[{id:'a',fromAi:true,body:'Kada ti odgovara?'}];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  const scroll=(offset:number)=>tree.root.findByProps({testID:'ai-conversation-thread'}).props.onScroll({
    nativeEvent:{contentOffset:{y:offset},contentSize:{height:1200},layoutMeasurement:{height:400}}});
  await act(async()=>{tree.root.findByProps({testID:'ai-conversation-thread'}).props.onScrollBeginDrag();scroll(200);});
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(1);
  await act(async()=>tree.update(<AiConversationShell {...p} messages={[...p.messages,{id:'b',fromAi:true,body:'Možeš i kasnije da dopuniš.'}]}/>));
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(1);
  expect(p.onSend).not.toHaveBeenCalled();expect(p.onChange).not.toHaveBeenCalled();
  await act(async()=>tree.root.findByProps({testID:'ai-latest'}).props.onPress());
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(0);
  // Android may send a throttled intermediate event but finish the animation without another onScroll.
  await act(async()=>scroll(300));
  await act(async()=>tree.root.findByProps({testID:'ai-conversation-thread'}).props.onMomentumScrollEnd({
    nativeEvent:{contentOffset:{y:800},contentSize:{height:1200},layoutMeasurement:{height:400}}}));
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(0);
});
it('a different conversation drops the previous scroll hint',async()=>{
  const p=props();p.conversationKey='first';p.messages=[{id:'a',fromAi:true,body:'Prvi razgovor'}];
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  await act(async()=>{
    tree.root.findByProps({testID:'ai-conversation-thread'}).props.onScrollBeginDrag();
    tree.root.findByProps({testID:'ai-conversation-thread'}).props.onScroll({
      nativeEvent:{contentOffset:{y:0},contentSize:{height:1200},layoutMeasurement:{height:400}}});
  });
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(1);
  await act(async()=>tree.update(<AiConversationShell {...p} conversationKey="second"/>));
  expect(tree.root.findAllByProps({testID:'ai-latest'})).toHaveLength(0);
});
it.each([{height:640,scale:1},{height:844,scale:2}])('compacts without disabling editing on constrained geometry %o',async({height,scale})=>{
  mockHeight=height;mockScale=scale;const p=props();
  await act(async()=>{tree=create(<AiConversationShell {...p}/>);});
  expect(p.card).toHaveBeenLastCalledWith(true);
  expect(tree.root.findByProps({accessibilityLabel:'Poruka za AI'}).props.editable).toBe(true);
});

describe('deliberate reading intent', () => {
  let frames: Map<number, FrameRequestCallback>, frameId: number;
  beforeEach(() => {
    frames = new Map(); frameId = 0;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++frameId, callback); return frameId; });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => { if (id != null) frames.delete(id); });
  });
  afterEach(() => { jest.restoreAllMocks(); });
  const flushFrame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); };
  const scroller = () => tree.root.findByProps({ testID: 'ai-conversation-thread' });
  const position = (y: number, height = 1200, viewport = 400) => ({ nativeEvent: {
    contentOffset: { y }, contentSize: { height }, layoutMeasurement: { height: viewport },
  } });
  const layout = (height: number) => ({ nativeEvent: { layout: { height } } });
  const mount = async (p: AiConversationShellProps) => {
    const native = { scrollToEnd: jest.fn(), scrollTo: jest.fn() };
    await act(async () => { tree = create(<AiConversationShell {...p} />, {
      createNodeMock: element => (element.props as { testID?: string }).testID === 'ai-conversation-thread' ? native : null,
    }); });
    return native;
  };
  it('follows the first pending turn across content and keyboard geometry, but cancels queued following on drag', async () => {
    const p = props(), native = await mount(p);
    await act(async () => { scroller().props.onLayout(layout(500)); scroller().props.onContentSizeChange(390, 700); flushFrame(); });
    expect(native.scrollToEnd).not.toHaveBeenCalled(); // Keep the untouched welcome at its beginning.
    await act(async () => tree.update(<AiConversationShell {...p} pending sentMessage="Prva poruka" />));
    await act(async () => { scroller().props.onContentSizeChange(390, 900); mockKeyboard.keyboardDidShow(); scroller().props.onLayout(layout(300)); });
    expect(native.scrollToEnd).toHaveBeenCalledWith({ animated: false });
    await act(async () => scroller().props.onScroll(position(0, 900, 300)));
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(0);
    native.scrollToEnd.mockClear();
    await act(async () => {
      scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(100, 900, 300));
      scroller().props.onScrollEndDrag(position(100, 900, 300)); flushFrame();
    });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(1);
  });
  it('preserves the deliberate history offset when context, viewport and streaming content change', async () => {
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Ranije pitanje' }];
    const native = await mount(p);
    await act(async () => {
      flushFrame(); scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(200));
      scroller().props.onScrollEndDrag(position(200));
    });
    native.scrollToEnd.mockClear();
    await act(async () => {
      // Native clamping is geometry, not a new place chosen by the reader.
      scroller().props.onScroll(position(140)); mockKeyboard.keyboardDidShow();
      scroller().props.onLayout(layout(250)); scroller().props.onContentSizeChange(390, 1600); flushFrame();
    });
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 200, animated: false });
    await act(async () => tree.root.findByProps({ testID: 'ai-inline-context' }).props.onLayout(layout(120)));
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 320, animated: false });
    await act(async () => {
      tree.update(<AiConversationShell {...p} streamingText="Novi deo odgovora" />);
      tree.root.findByProps({ testID: 'ai-inline-context' }).props.onLayout(layout(0));
      scroller().props.onContentSizeChange(390, 1800); flushFrame();
    });
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 200, animated: false });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(1);
  });
  it.each([0, 80])('keeps an anchor inside the old summary at %s when details expand', async offset => {
    mockScale = 2;
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Ranije pitanje' }];
    p.card = () => <View testID="summary" />;
    const native = await mount(p);
    const context = () => tree.root.findByProps({ testID: 'ai-inline-context' });
    await act(async () => {
      flushFrame(); context().props.onLayout(layout(180));
      scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(offset));
      scroller().props.onScrollEndDrag(position(offset));
    });
    native.scrollTo.mockClear(); native.scrollToEnd.mockClear();
    await act(async () => { context().props.onLayout(layout(340)); scroller().props.onContentSizeChange(320, 1360); flushFrame(); });
    expect(native.scrollTo).not.toHaveBeenCalled(); expect(native.scrollToEnd).not.toHaveBeenCalled();
    await act(async () => scroller().props.onLayout(layout(350)));
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: offset, animated: false });
  });
  it('keeps the visible top in place when inline context is first inserted', async () => {
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Ranije pitanje' }];
    const native = await mount(p);
    await act(async () => {
      flushFrame(); scroller().props.onScrollBeginDrag(); scroller().props.onScroll(position(0));
      scroller().props.onScrollEndDrag(position(0));
    });
    native.scrollTo.mockClear();
    await act(async () => tree.root.findByProps({ testID: 'ai-inline-context' }).props.onLayout(layout(180)));
    expect(native.scrollTo).not.toHaveBeenCalled();
  });
  it('reserves space for latest while reading an expanded draft and preserves its review action', async () => {
    mockScale = 2;
    const p = props(), review = jest.fn();
    p.messages = [{ id: 'a', fromAi: true, body: 'Ranije pitanje' }];
    p.card = () => <View testID="expanded-review" onTouchEnd={review} />;
    const native = await mount(p);
    await act(async () => {
      flushFrame();
      tree.root.findByProps({ testID: 'ai-inline-context' }).props.onLayout(layout(360));
      scroller().props.onScrollBeginDrag(); scroller().props.onScrollEndDrag(position(80));
    });
    const region = tree.root.findByProps({ testID: 'ai-latest-region' });
    const latest = tree.root.findByProps({ testID: 'ai-latest' });
    expect(scroller().findAllByProps({ testID: 'ai-latest-region' })).toHaveLength(0);
    expect(StyleSheet.flatten(region.props.style).position).not.toBe('absolute');
    expect(StyleSheet.flatten(latest.props.style).position).not.toBe('absolute');
    native.scrollToEnd.mockClear();
    await act(async () => {
      scroller().props.onLayout(layout(304));
      scroller().findByProps({ testID: 'expanded-review' }).props.onTouchEnd();
    });
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 80, animated: false });
    expect(native.scrollToEnd).not.toHaveBeenCalled();
    expect(review).toHaveBeenCalledTimes(1);
    await act(async () => latest.props.onPress());
    expect(tree.root.findAllByProps({ testID: 'ai-latest-region' })).toHaveLength(0);
    expect(p.onSend).not.toHaveBeenCalled();
  });
  it('treats accessible history scrolling as intent and resumes following only through latest or an enabled send', async () => {
    const p = props(); p.messages = [{ id: 'a', fromAi: true, body: 'Pitanje' }];
    const native = await mount(p);
    await act(async () => {
      flushFrame(); scroller().props.onScroll(position(800));
      scroller().props.onAccessibilityAction({ nativeEvent: { actionName: 'scrollBackward' } });
    });
    expect(native.scrollTo).toHaveBeenLastCalledWith({ y: 500, animated: false });
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(1);
    await act(async () => tree.root.findByProps({ testID: 'ai-send' }).props.onPress());
    expect(p.onSend).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(1);
    await act(async () => tree.root.findByProps({ testID: 'ai-latest' }).props.onPress());
    await act(async () => scroller().props.onScroll(position(600)));
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(0);
    await act(async () => {
      scroller().props.onAccessibilityAction({ nativeEvent: { actionName: 'scrollBackward' } });
      tree.update(<AiConversationShell {...p} canSend />);
    });
    await act(async () => tree.root.findByProps({ testID: 'ai-send' }).props.onPress());
    expect(p.onSend).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByProps({ testID: 'ai-latest' })).toHaveLength(0);
  });
});

it('keeps a legal long amount complete in a constrained, wrapping value row at large text', async () => {
  mockScale = 2;
  const p = props();
  p.card = compact => <DraftCard summary={{ title: 'Veliki posao', value: { kind: 'amount', amount: '100.000.000 RSD', basis: 'ukupno' },
    zone: '', people: null }} stillNeeded={null} open busy={false} compact={compact} canReview onReview={jest.fn()} note={null} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const value = tree.root.findByProps({ testID: 'intake-draft-value' });
  expect(StyleSheet.flatten(value.props.style)).toMatchObject({ minWidth: 0, maxWidth: '100%', width: '100%', flexShrink: 1 });
  expect(StyleSheet.flatten(value.parent!.props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
  expect(value.findByType(CardValue).props.large).toBe(true);
  const amount = value.findAll(node => node.type === 'T' as React.ElementType && node.props.children === '100.000.000 RSD')[0];
  expect(amount.props.numberOfLines).toBeUndefined();
  expect(StyleSheet.flatten(amount.props.style)).toMatchObject({ flexShrink: 1, maxWidth: '100%' });
  expect(text()).toContain('100.000.000 RSD'); expect(text()).toContain('ukupno');
  expect(tree.root.findByProps({ testID: 'intake-draft-disclosure' }).props.accessibilityValue.text).toContain('100.000.000 RSD ukupno');
});

it('shows the assistant name once per consecutive group while retaining the identity of every accessible turn', async () => {
  const p = props(); p.messages = [
    { id: 'a', fromAi: true, body: 'Prvo pitanje' }, { id: 'b', fromAi: true, body: 'Dopuna pitanja' },
    { id: 'u', fromAi: false, body: 'Odgovor' }, { id: 'c', fromAi: true, body: 'Sledeće pitanje' },
  ];
  await act(async () => { tree = create(<AiConversationShell {...p} streamingText="Dopuna" />); });
  expect(tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.children === 'AI asistent')).toHaveLength(2);
  for (const message of p.messages) expect(tree.root.findAllByProps({ accessibilityLabel: `${message.fromAi ? 'USKOČI' : 'Ti'}: ${message.body}` })).toHaveLength(1);
  expect(tree.root.findByProps({ accessibilityLabel: 'USKOČI: Dopuna' }).props.accessibilityLiveRegion).toBe('none');
});

it.each(['intake', 'worker'] as const)('%s disclosure stays local, survives same-owner updates and resets with the stable ownership key', async kind => {
  const p = props(), review = jest.fn(); p.conversationKey = 'account:revision:opening-request';
  let disabled = true;
  const profile = { displayName: 'Ana', bio: '', skills: ['Selidbe'], tools: [], vehicles: [], licenses: [], teamCapacity: 2,
    location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 20, approximatePosition: null },
    availability: { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] } };
  p.card = compact => kind === 'intake'
    ? <DraftCard summary={{ title: 'Selidba', value: null, zone: 'Novi Sad', schedule: 'Sutra', people: '2 osobe' }}
        stillNeeded="tačka na mapi" open busy={disabled} compact={compact} canReview={!disabled} onReview={review} note="Proveri detalje pre objave." />
    : <WorkerAiCard profile={profile} compact={compact} review={review} disabled={disabled} />;
  await act(async () => { tree = create(<AiConversationShell {...p} />); });
  const prefix = kind === 'intake' ? 'intake' : 'worker';
  const disclosure = () => tree.root.findByProps({ testID: `${prefix}-draft-disclosure` });
  const details = () => tree.root.findAllByProps({ testID: `${prefix}-draft-details` });
  const reviewTarget = () => tree.root.findByProps({ testID: `${prefix}-draft-review` });
  expect(details()).toHaveLength(0);
  await act(async () => { disclosure().props.onPress(); reviewTarget().props.onPress(); });
  expect(details()).toHaveLength(1); expect(disclosure().props.accessibilityState.expanded).toBe(true);
  expect(review).not.toHaveBeenCalled(); expect(p.onSend).not.toHaveBeenCalled();
  await act(async () => tree.update(<AiConversationShell {...p} messages={[{ id: 'first-persisted', fromAi: true, body: 'Primljeno' }]} />));
  expect(details()).toHaveLength(1); // A server ID arriving does not replace the stable owned opening key.
  if (kind === 'intake') { expect(text()).toContain('tačka na mapi'); expect(text()).toContain('Proveri detalje pre objave.'); }
  await act(async () => tree.update(<AiConversationShell {...p} conversationKey="account:new-revision:opening-request" />));
  expect(details()).toHaveLength(0);
  disabled = false;
  await act(async () => tree.update(<AiConversationShell {...p} conversationKey="account:new-revision:opening-request" />));
  await act(async () => reviewTarget().props.onPress());
  expect(review).toHaveBeenCalledTimes(1);
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
  // Verify r4b ra item B: Switch Access and Voice Access click the microphone (its `activate` action) instead of holding
  // it; with a draft in the field that click is their only way to speech, so it brings the same advice and its action.
  it('a Switch Access click on the held microphone shows the advice and the way to voice mode, and starts nothing', async () => {
    const p = props(); p.value = 'Treba mi prevoz'; p.canSend = true; p.voice = voice();
    await act(async () => { tree = create(<AiConversationShell {...p} />); });
    const mic = tree.root.findAll(node => node.props.testID === 'voice-mic' && typeof node.props.onAccessibilityAction === 'function')[0];
    expect(mic.props.accessibilityActions).toEqual([{ name: 'activate' }]);
    await act(async () => mic.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(text()).toContain(HOLD_HINT);
    expect(p.voice!.controller.begin).not.toHaveBeenCalled();
    await act(async () => tree.root.findByProps({ label: 'Govori bez držanja' }).props.onPress());
    expect(tree.root.findByType(VoiceMode).props.reviewFirst).toBe(true);
    expect(p.onSend).not.toHaveBeenCalled(); expect(p.voice!.controller.begin).not.toHaveBeenCalled();
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
