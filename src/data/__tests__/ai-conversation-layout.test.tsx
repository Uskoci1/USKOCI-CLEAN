import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
let mockHeight = 844, mockScale = 1;
const mockKeyboard: Record<string, () => void> = {};
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, { get(target, key) {
    if (key === 'Keyboard') return { addListener: (name: string, cb: () => void) => {
      mockKeyboard[name] = cb; return { remove: jest.fn() };
    } };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: mockHeight, fontScale: mockScale, scale: 3 });
    return ['View', 'ScrollView', 'KeyboardAvoidingView', 'TextInput', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeArea' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', DotsThree: 'Icon', PaperPlaneTilt: 'Icon' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { AiConversationShell, type AiConversationShellProps } from '../../ui/aiFirst/AiConversationShell';
let tree: ReactTestRenderer;
const props = (): AiConversationShellProps => ({title:'Novi zadatak',subtitle:'MENI TREBA',card:jest.fn(()=>null),
  messages:[],welcome:'Šta ti treba?',welcomeDetail:'Opiši zadatak.',value:'Sačuvana poruka',canEdit:true,
  canSend:false,pending:false,busy:false,onChange:jest.fn(),onSend:jest.fn(),onBack:jest.fn(),onOptions:jest.fn()});
beforeEach(()=>{mockHeight=844;mockScale=1;});
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
