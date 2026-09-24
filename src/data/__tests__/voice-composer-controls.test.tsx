import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { HoldToTalkController, VoiceSnapshot } from '../../features/voice/holdToTalk';
const mockAlert=jest.fn();let mockReader=false,mockReduced=false;
jest.mock('react-native',()=>{const actual=jest.requireActual('react-native');return new Proxy(actual,{get(target,key){
  if(key==='AccessibilityInfo')return{isScreenReaderEnabled:async()=>mockReader,addEventListener:()=>({remove:jest.fn()})};
  if(key==='Alert')return{alert:(...args:unknown[])=>mockAlert(...args)};
  return ['View','Pressable'].includes(String(key))?key:Reflect.get(target,key);
}});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('../../ui/Text',()=>({T:'T'}));
jest.mock('../../ui/Press',()=>({Press:'Press'}));
jest.mock('../../ui/v2/V2Action',()=>({V2Action:'Action'}));
jest.mock('../../ui/entry/BrandAssets',()=>({BrandMark:'BrandMark'}));
jest.mock('../../ui/system/motion',()=>({useReducedMotion:()=>mockReduced}));
jest.mock('../../features/voice/useHoldToTalk',()=>({VOICE_PROCESSING_NOTICE:'Approved transient Google speech notice.'}));
jest.mock('../../lib/idempotencija',()=>({noviUuidZahtevId:()=> 'GESTURE_SYNTHETIC'}));
import { VoiceComposer, VoiceMode, VoiceNotice } from '../../ui/aiFirst/VoiceComposer';
let tree:ReactTestRenderer;
const idle:VoiceSnapshot={phase:'IDLE',session:null,finalText:'',interimText:'',audioLevel:null,fallbackText:'',error:null};
const controller=()=>({begin:jest.fn(()=>true),release:jest.fn(),cancel:jest.fn(),useFallback:jest.fn()});
const text=()=>JSON.stringify(tree.toJSON());
afterEach(async()=>{await act(async()=>tree?.unmount());});beforeEach(()=>{mockReader=false;mockReduced=false;jest.clearAllMocks();});
it('hold release finalizes once while edit/send remain the parent controller responsibility',async()=>{
  const c=controller(),keep=jest.fn();
  await act(async()=>{tree=create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={keep}/>);});
  const mic=tree.root.findByProps({accessibilityLabel:'Drži da govoriš'});
  await act(async()=>mic.props.onPressIn({nativeEvent:{pageY:200}}));
  await act(async()=>{mic.props.onPressOut();mic.props.onPressOut();});
  expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC','hold');expect(c.release).toHaveBeenCalledTimes(1);
  expect(keep).not.toHaveBeenCalled();
});
it('a tap that ends before the microphone listens asks the composer to explain holding; a real hold does not',async()=>{
  const c=controller(),short=jest.fn();
  await act(async()=>{tree=create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={jest.fn()} onTooShort={short}/>);});
  const tap=tree.root.findByProps({accessibilityLabel:'Drži da govoriš'});
  await act(async()=>{tap.props.onPressIn({nativeEvent:{pageY:200}});tap.props.onPressOut();});
  expect(short).toHaveBeenCalledTimes(1);
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onPressIn({nativeEvent:{pageY:200}}));
  await act(async()=>tree.update(<VoiceComposer controller={c as unknown as HoldToTalkController} state={{...idle,phase:'LISTENING'}} disabled={false} onKeepText={jest.fn()} onTooShort={short}/>));
  await act(async()=>tree.root.findByProps({testID:'voice-mic'}).props.onPressOut());
  expect(short).toHaveBeenCalledTimes(1);expect(c.release).toHaveBeenCalledTimes(2);
});
it('screen reader sees explicit Stop, not an instruction to release a held finger',async()=>{
  mockReader=true;const c=controller();const listening={...idle,phase:'LISTENING' as const};
  await act(async()=>{tree=create(<><VoiceComposer controller={c as unknown as HoldToTalkController} state={listening} disabled={false} onKeepText={jest.fn()}/>
    <VoiceNotice controller={c as unknown as HoldToTalkController} state={listening} disabled={false} onKeepText={jest.fn()}/></>);});
  expect(tree.root.findByProps({accessibilityLabel:'Zaustavi i pregledaj tekst'})).toBeDefined();
  expect(text()).toContain('Zaustavi, pregledaj tekst i izaberi Pošalji.');
  // 2026-09-24: the composer has no mode switch of its own any more; tapping instead of holding is voice mode.
  expect(tree.root.findAllByProps({label:'Govor bez držanja'})).toHaveLength(0);
});
it('keeps first-speech preparation cancellable and accessible', async () => {
  mockReader = true; const c = controller();
  // One tree shape throughout, so the microphone keeps the gesture it started.
  await act(async () => { tree = create(<><VoiceComposer controller={c as unknown as HoldToTalkController}
    state={idle} disabled={false} onKeepText={jest.fn()} />
    <VoiceNotice controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={jest.fn()} /></>); });
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pokreni govorni unos' }).props.onPress());
  const preparing = { ...idle, phase: 'PREPARING' as const };
  await act(async () => { tree.update(<><VoiceComposer controller={c as unknown as HoldToTalkController}
    state={preparing} disabled={true} onKeepText={jest.fn()} />
    <VoiceNotice controller={c as unknown as HoldToTalkController} state={preparing} disabled={true} onKeepText={jest.fn()} /></>); });
  const pending = tree.root.findByProps({ accessibilityLabel: 'Pripremamo govorni unos…' });
  expect(pending.props.disabled).toBe(false);
  await act(async () => pending.props.onPress());
  expect(c.release).toHaveBeenCalledWith('GESTURE_SYNTHETIC');
  await act(async () => tree.root.findByProps({ label: 'Otkaži govor' }).props.onPress());
  expect(c.cancel).toHaveBeenCalledWith('gesture');
});
it('the notice hands kept text back only through the screen, and shows the way to the phone settings after a denial',async()=>{
  const c=controller(),keep=jest.fn();
  await act(async()=>{tree=create(<VoiceNotice controller={c as unknown as HoldToTalkController} state={{...idle,fallbackText:'Treba mi prevoz',error:'CAPTURE_FAILED'}}
    disabled={false} onKeepText={keep}/>);});
  await act(async()=>tree.root.findByProps({label:'Uredi sačuvani tekst'}).props.onPress());
  expect(c.useFallback).toHaveBeenCalledWith(keep);
  await act(async()=>tree.update(<VoiceNotice controller={c as unknown as HoldToTalkController} state={{...idle,error:'MIC_PERMISSION_DENIED'}} disabled={false} onKeepText={keep}/>));
  expect(tree.root.findAllByProps({label:'Podešavanja telefona'})).toHaveLength(1);
});

describe('voice mode', () => {
  const session = { accountId: 'a', accountRevision: 1, conversationId: 'c', generation: 1, gestureId: 'GESTURE_SYNTHETIC', startedAt: 0 };
  const mode = (c: ReturnType<typeof controller>, state: VoiceSnapshot, extra: Partial<React.ComponentProps<typeof VoiceMode>> = {}) =>
    <VoiceMode voice={{ controller: c as unknown as HoldToTalkController, state, disabled: false, onKeepText: jest.fn() }}
      prompt="Reci šta ti treba." answer={null} said={null} thinking={false} onClose={jest.fn()} {...extra} />;
  const mic = () => tree.root.findByProps({ testID: 'voice-mode-mic' });
  it('a tap starts listening, a second tap sends what was said through the screen, and nothing is kept locally', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    expect(text()).toContain('kao tekst');
    await act(async () => mic().props.onPress());
    expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'hold');
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: { ...session, mode: 'hold' }, audioLevel: 0.4 }, { onClose })));
    expect(mic().props.accessibilityLabel).toBe('Pošalji izgovoreno');
    await act(async () => mic().props.onPress());
    expect(c.release).toHaveBeenCalledWith('GESTURE_SYNTHETIC');
    // Sent: voice mode stays open for the answer, which arrives as text.
    await act(async () => tree.update(mode(c, { ...idle, phase: 'FINALIZING', session: { ...session, mode: 'hold' } }, { onClose })));
    await act(async () => tree.update(mode(c, { ...idle, session: { ...session, mode: 'hold' } }, { onClose, thinking: true, said: 'Treba mi prevoz.' })));
    expect(onClose).not.toHaveBeenCalled(); expect(c.cancel).not.toHaveBeenCalled();
    expect(text()).toContain('Stiže odgovor…');
  });
  it('closing while listening throws the capture away and sends nothing', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    await act(async () => mic().props.onPress());
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: { ...session, mode: 'hold' } }, { onClose })));
    await act(async () => tree.root.findByProps({ testID: 'voice-mode-close' }).props.onPress());
    expect(c.cancel).toHaveBeenCalledWith('gesture'); expect(c.release).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledWith('closed');
  });
  it('closing after the second tap does not take the message back: it is already on its way through the screen', async () => {
    const c = controller(), onClose = jest.fn(), hold = { ...session, mode: 'hold' as const };
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    await act(async () => mic().props.onPress());
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: hold }, { onClose })));
    await act(async () => mic().props.onPress());
    await act(async () => tree.update(mode(c, { ...idle, phase: 'FINALIZING', session: hold }, { onClose })));
    await act(async () => tree.root.findByProps({ testID: 'voice-mode-close' }).props.onPress());
    expect(onClose).toHaveBeenCalledWith('closed');
    await act(async () => tree.unmount());
    expect(c.cancel).not.toHaveBeenCalled(); expect(c.release).toHaveBeenCalledTimes(1);
  });
  it('new words stand alone while they arrive; the last exchange returns when the microphone rests', async () => {
    const c = controller(), hold = { ...session, mode: 'hold' as const };
    const exchange = { said: 'Treba mi prevoz.', answer: 'Odakle i dokle?' };
    await act(async () => { tree = create(mode(c, idle, exchange)); });
    expect(text()).toContain('Odakle i dokle?');
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: hold, finalText: 'Iz Novog Sada' }, exchange)));
    expect(text()).toContain('Iz Novog Sada'); expect(text()).not.toContain('Odakle i dokle?'); expect(text()).not.toContain('Treba mi prevoz.');
    await act(async () => tree.update(mode(c, idle, exchange)));
    expect(text()).toContain('Odakle i dokle?');
  });
  it('review before sending is a switch that starts nothing; with it the capture goes to the field and voice mode steps aside', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    const review = tree.root.findByProps({ accessibilityLabel: 'Pregledaj tekst pre slanja' });
    await act(async () => review.props.onPress());
    expect(c.begin).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityLabel: 'Pregledaj tekst pre slanja' }).props.accessibilityState.checked).toBe(true);
    await act(async () => mic().props.onPress());
    expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'accessible');
    const reviewed = { ...session, mode: 'accessible' as const };
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: reviewed }, { onClose })));
    expect(mic().props.accessibilityLabel).toBe('Zaustavi i pregledaj tekst');
    await act(async () => tree.update(mode(c, { ...idle, phase: 'FINALIZING', session: reviewed }, { onClose })));
    await act(async () => tree.update(mode(c, { ...idle, session: reviewed }, { onClose })));
    expect(onClose).toHaveBeenCalledWith('review');
  });
  it('a failed capture keeps voice mode open with the error and the way to the kept text', async () => {
    const c = controller(), onClose = jest.fn();
    await act(async () => { tree = create(mode(c, idle, { onClose })); });
    await act(async () => tree.update(mode(c, { ...idle, phase: 'LISTENING', session: { ...session, mode: 'hold' } }, { onClose })));
    await act(async () => tree.update(mode(c, { ...idle, session: { ...session, mode: 'hold' }, error: 'CAPTURE_FAILED', fallbackText: 'Treba mi' }, { onClose })));
    expect(onClose).not.toHaveBeenCalled();
    expect(text()).toContain('Govorni unos je prekinut.');
    expect(tree.root.findAllByProps({ label: 'Uredi sačuvani tekst' })).toHaveLength(1);
  });
  it('while the screen cannot take a message the microphone is disabled and the line says why', async () => {
    const c = controller();
    await act(async () => { tree = create(<VoiceMode voice={{ controller: c as unknown as HoldToTalkController, state: idle, disabled: true, onKeepText: jest.fn() }}
      prompt="Reci šta ti treba." answer={null} said="Treba mi prevoz." thinking onClose={jest.fn()} />); });
    expect(mic().props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
    await act(async () => mic().props.onPress());
    expect(c.begin).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ testID: 'voice-mode-line' }).props.children).toBe('Stiže odgovor…');
  });
  it('the glow follows nothing and the screen does not fade under reduced motion', async () => {
    mockReduced = true; const c = controller();
    await act(async () => { tree = create(mode(c, { ...idle, phase: 'LISTENING', session: { ...session, mode: 'hold' }, audioLevel: 0.9 })); });
    const glow = tree.root.findByProps({ testID: 'voice-glow' });
    expect(glow.findAll(node => typeof node.type !== 'string' && String((node.type as { displayName?: string }).displayName).startsWith('Animated.'))).toHaveLength(0);
    expect(tree.root.findAll(node => node.props.animationType !== undefined)[0].props.animationType).toBe('none');
    await act(async () => tree.unmount());
    mockReduced = false;
    await act(async () => { tree = create(mode(c, idle)); });
    expect(tree.root.findByProps({ testID: 'voice-glow' }).findAll(node => typeof node.type !== 'string'
      && String((node.type as { displayName?: string }).displayName).startsWith('Animated.')).length).toBeGreaterThan(0);
    expect(tree.root.findAll(node => node.props.animationType !== undefined)[0].props.animationType).toBe('fade');
  });
  it('a screen reader always reviews: there is no switch to turn it off', async () => {
    mockReader = true; const c = controller();
    await act(async () => { tree = create(mode(c, idle)); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pregledaj tekst pre slanja' })).toHaveLength(0);
    await act(async () => mic().props.onPress());
    expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC', 'accessible');
  });
});
