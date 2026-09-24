import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { HoldToTalkController, VoiceSnapshot } from '../../features/voice/holdToTalk';
const mockAlert=jest.fn();let mockReader=false;
jest.mock('react-native',()=>{const actual=jest.requireActual('react-native');return new Proxy(actual,{get(target,key){
  if(key==='AccessibilityInfo')return{isScreenReaderEnabled:async()=>mockReader,addEventListener:()=>({remove:jest.fn()})};
  if(key==='Alert')return{alert:(...args:unknown[])=>mockAlert(...args)};
  return ['View','Pressable'].includes(String(key))?key:Reflect.get(target,key);
}});});
jest.mock('../../ui/Text',()=>({T:'T'}));
jest.mock('../../ui/v2/V2Action',()=>({V2Action:'Action'}));
jest.mock('../../features/voice/useHoldToTalk',()=>({VOICE_PROCESSING_NOTICE:'Approved transient Google speech notice.'}));
jest.mock('../../lib/idempotencija',()=>({noviUuidZahtevId:()=> 'GESTURE_SYNTHETIC'}));
import { VoiceComposer } from '../../ui/aiFirst/VoiceComposer';
let tree:ReactTestRenderer;
const idle:VoiceSnapshot={phase:'IDLE',session:null,finalText:'',interimText:'',audioLevel:null,fallbackText:'',error:null};
const controller=()=>({begin:jest.fn(()=>true),release:jest.fn(),cancel:jest.fn(),useFallback:jest.fn()});
afterEach(async()=>{await act(async()=>tree?.unmount());});beforeEach(()=>{mockReader=false;jest.clearAllMocks();});
it('offers accessible mode in the mic row without starting capture or sending a turn',async()=>{
  const c=controller(),keep=jest.fn();
  await act(async()=>{tree=create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={keep}/>);});
  const toggle=tree.root.findByProps({label:'Bez držanja'});
  expect(toggle.parent?.findAllByProps({accessibilityLabel:'Drži da govoriš'}).length).toBeGreaterThan(0);
  await act(async()=>toggle.props.onPress());
  expect(c.begin).not.toHaveBeenCalled();expect(keep).not.toHaveBeenCalled();
  const mic=tree.root.findByProps({accessibilityLabel:'Pokreni govorni unos'});
  expect(mic.props.onPressIn).toBeUndefined();
  await act(async()=>mic.props.onPress());expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC','accessible');
});
it('hold release finalizes once while edit/send remain the parent controller responsibility',async()=>{
  const c=controller(),keep=jest.fn();
  await act(async()=>{tree=create(<VoiceComposer controller={c as unknown as HoldToTalkController} state={idle} disabled={false} onKeepText={keep}/>);});
  const mic=tree.root.findByProps({accessibilityLabel:'Drži da govoriš'});
  await act(async()=>mic.props.onPressIn({nativeEvent:{pageY:200}}));
  await act(async()=>{mic.props.onPressOut();mic.props.onPressOut();});
  expect(c.begin).toHaveBeenCalledWith('GESTURE_SYNTHETIC','hold');expect(c.release).toHaveBeenCalledTimes(1);
  expect(keep).not.toHaveBeenCalled();
});
it('screen reader sees explicit Stop, not an instruction to release a held finger',async()=>{
  mockReader=true;const c=controller();
  await act(async()=>{tree=create(<VoiceComposer controller={c as unknown as HoldToTalkController}
    state={{...idle,phase:'LISTENING'}} disabled={false} onKeepText={jest.fn()}/>);});
  expect(tree.root.findByProps({accessibilityLabel:'Zaustavi i pregledaj tekst'})).toBeDefined();
  expect(JSON.stringify(tree.toJSON())).toContain('Zaustavi, pregledaj tekst i izaberi Pošalji.');
  expect(tree.root.findAllByProps({label:'Bez držanja'})).toHaveLength(0);
});
it('keeps first-speech preparation cancellable and accessible', async () => {
  mockReader = true; const c = controller();
  await act(async () => { tree = create(<VoiceComposer controller={c as unknown as HoldToTalkController}
    state={idle} disabled={false} onKeepText={jest.fn()} />); });
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pokreni govorni unos' }).props.onPress());
  await act(async () => { tree.update(<VoiceComposer controller={c as unknown as HoldToTalkController}
    state={{ ...idle, phase: 'PREPARING' }} disabled={true} onKeepText={jest.fn()} />); });
  const pending = tree.root.findByProps({ accessibilityLabel: 'Pripremam govorni unos…' });
  expect(pending.props.disabled).toBe(false);
  await act(async () => pending.props.onPress());
  expect(c.release).toHaveBeenCalledWith('GESTURE_SYNTHETIC');
  await act(async () => tree.root.findByProps({ label: 'Otkaži govor' }).props.onPress());
  expect(c.cancel).toHaveBeenCalledWith('gesture');
});
