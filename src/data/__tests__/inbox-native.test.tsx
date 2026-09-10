import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockRouter={push:jest.fn(),back:jest.fn(),replace:jest.fn(),canGoBack:jest.fn(()=>true)};
const mockRole=jest.fn(), mockModel={canNavigate:jest.fn(()=>true),open:jest.fn(),readAll:jest.fn(),refresh:jest.fn(),more:jest.fn()};
const at='2026-09-10T12:00:00Z';
const item={id:'event',title:'Vaša Prijava je izabrana',body:'Otvorite Dogovor.',readAt:null,occurredAt:at,role:'WORKER',family:'responses'};
let mockState:any;
jest.mock('react-native',()=>{const native=jest.requireActual('react-native'),React=require('react');return new Proxy(native,{get(target,key){
  if(['View','ActivityIndicator'].includes(String(key)))return key;
  if(key==='FlatList')return ({data,renderItem,ListHeaderComponent,ListEmptyComponent,ListFooterComponent,...props}:any)=>React.createElement('FlatList',props,ListHeaderComponent,
    data.length?data.map((item:any)=>React.createElement(React.Fragment,{key:item.id},renderItem({item}))):ListEmptyComponent,ListFooterComponent);
  return Reflect.get(target,key);
}});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('react-native-svg',()=>({SvgXml:'NativeSvgXml'}));
jest.mock('phosphor-react-native',()=>Object.fromEntries(['ArrowLeft','Bell','Check','CaretRight','GearSix','Handshake','ChatCircle','PaperPlaneTilt','ClipboardText'].map(name=>[name,'Icon'])));
jest.mock('expo-router',()=>({get router(){return mockRouter;},Stack:{Screen:'StackScreen'},useFocusEffect:(effect:()=>void)=>require('react').useEffect(effect,[effect])}));
jest.mock('../../store/uloga',()=>({postaviUlogu:(role:string)=>mockRole(role)}));
jest.mock('../../hooks/useInbox',()=>({useInbox:()=>({state:mockState,model:mockModel})}));
jest.mock('../../ui/Press',()=>({Press:'Press'}));
jest.mock('../../ui/Text',()=>({T:'T'}));
import Inbox from '../../app/obavestenja';
let tree:ReactTestRenderer;
const press=(label:string)=>tree.root.findAllByType('Press' as React.ElementType).find(node=>node.props.accessibilityLabel===label)!;
const text=()=>tree.root.findAllByType('T' as React.ElementType).flatMap(node=>node.children.filter(child=>typeof child==='string')).join(' ');
const render=async()=>act(async()=>{tree=create(<Inbox/>);});
beforeEach(()=>{jest.clearAllMocks();mockModel.canNavigate.mockReturnValue(true);mockModel.open.mockResolvedValue({kind:'AGREEMENT',id:'actual-agreement',role:'WORKER'});
  mockState={page:{items:[],unreadCount:0,hasMore:false,asOf:at},loading:false,paging:false,acting:null,error:null,unavailable:false};});
afterEach(async()=>{await act(async()=>tree?.unmount());});
test('successful empty uses the original vector and one owned settings destination',async()=>{
  await render();expect(text()).toContain('Još nema obaveštenja');expect(tree.root.findByType('NativeSvgXml' as React.ElementType).props.xml).toContain('data-art-kind="inbox"');
  const settings=press('Podesi obaveštenja');await act(async()=>{settings.props.onPress();settings.props.onPress();});
  expect(mockRouter.push.mock.calls).toEqual([['/profil/obavestenja']]);
});
test.each(['load','action','page'])('%s failure preserves last data without asserting a successful empty state',async error=>{
  mockState={...mockState,error,page:error==='load'?null:{...mockState.page,items:[item],unreadCount:1}};await render();
  expect(text()).not.toContain('Još nema obaveštenja');expect(text()).toContain(error==='load'?'pokušajte ponovo da učitate obaveštenja.':'Poslednje učitano stanje ostaje prikazano.');
  if(error!=='load')expect(text()).toContain(item.title);
});
test('an acknowledged event opens only its resolved actual target and role',async()=>{
  mockState.page.items=[item];mockState.page.unreadCount=1;await render();
  await act(async()=>press(`Nepročitano. ${item.title}. ${item.body}`).props.onPress());
  expect(mockModel.open).toHaveBeenCalledWith(item);expect(mockRole).toHaveBeenCalledWith('uskocer');
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]',params:{id:'actual-agreement'}}]]);
});
test('retired ownership suppresses late target and retained settings actions',async()=>{
  let done!:(value:unknown)=>void;mockModel.open.mockReturnValueOnce(new Promise(resolve=>{done=resolve;}));
  mockState.page.items=[item];await render();
  let pending!:Promise<void>;await act(async()=>{pending=press(`Nepročitano. ${item.title}. ${item.body}`).props.onPress();});
  mockModel.canNavigate.mockReturnValue(false);await act(async()=>done({kind:'AGREEMENT',id:'old',role:'WORKER'}));await pending;
  await act(async()=>press('Podesi obaveštenja').props.onPress());expect(mockRole).not.toHaveBeenCalled();expect(mockRouter.push).not.toHaveBeenCalled();
});
