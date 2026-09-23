import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockRouter={push:jest.fn(),back:jest.fn(),replace:jest.fn(),canGoBack:jest.fn(()=>true)};
const mockRole=jest.fn(), mockModel={canNavigate:jest.fn(()=>true),open:jest.fn(),readAll:jest.fn(),refresh:jest.fn(),more:jest.fn()};
let mockIntent='narucilac';
const at='2026-09-10T12:00:00Z';
const item={id:'event',eventType:'RESPONSE_SELECTED',title:'Vaša Prijava je izabrana',body:'Otvori Dogovor.',readAt:null,occurredAt:at,role:'WORKER',family:'responses'};
let mockState:any;
jest.mock('react-native',()=>{const native=jest.requireActual('react-native'),React=require('react');return new Proxy(native,{get(target,key){
  if(['View','ActivityIndicator'].includes(String(key)))return key;
  if(key==='Modal')return ({visible,children,...props}:any)=>visible?React.createElement('Modal',props,children):null;
  if(key==='FlatList')return ({data,renderItem,ListHeaderComponent,ListEmptyComponent,ListFooterComponent,...props}:any)=>React.createElement('FlatList',props,ListHeaderComponent,
    data.length?data.map((item:any)=>React.createElement(React.Fragment,{key:item.id},renderItem({item}))):ListEmptyComponent,ListFooterComponent);
  return Reflect.get(target,key);
}});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('react-native-svg',()=>({SvgXml:'NativeSvgXml'}));
jest.mock('../../ui/system/motion',()=>({useReducedMotion:()=>false}));
jest.mock('expo-router',()=>({get router(){return mockRouter;},Stack:{Screen:'StackScreen'},useFocusEffect:(effect:()=>void)=>require('react').useEffect(effect,[effect])}));
jest.mock('../../store/uloga',()=>({postaviUlogu:(role:string)=>mockRole(role),useUloga:()=>mockIntent,ulogaSada:()=>mockIntent}));
jest.mock('../../hooks/useInbox',()=>({useInbox:()=>({state:mockState,model:mockModel})}));
jest.mock('../../ui/Press',()=>({Press:'Press'}));
jest.mock('../../ui/Text',()=>({T:'T'}));
import Inbox from '../../app/obavestenja';
let tree:ReactTestRenderer;
const press=(label:string)=>tree.root.findAllByType('Press' as React.ElementType).find(node=>node.props.accessibilityLabel===label)!;
const text=()=>tree.root.findAllByType('T' as React.ElementType).flatMap(node=>node.children.filter(child=>typeof child==='string')).join(' ');
const render=async()=>act(async()=>{tree=create(<Inbox/>);});
const openItem=async()=>act(async()=>press(`Nepročitano. ${item.title}. ${item.body}`).props.onPress());
beforeEach(()=>{jest.clearAllMocks();mockIntent='narucilac';mockModel.canNavigate.mockReturnValue(true);mockModel.open.mockResolvedValue({kind:'AGREEMENT',id:'actual-agreement',role:'WORKER'});
  mockState={page:{items:[],unreadCount:0,hasMore:false,asOf:at},loading:false,paging:false,acting:null,error:null,unavailable:false};});
afterEach(async()=>{await act(async()=>tree?.unmount());});
test('successful empty uses the original vector and one owned settings destination',async()=>{
  await render();expect(text()).toContain('Još nema obaveštenja');expect(tree.root.findByType('NativeSvgXml' as React.ElementType).props.xml).toContain('data-art-kind="inbox"');
  const settings=press('Podesi obaveštenja');await act(async()=>{settings.props.onPress();settings.props.onPress();});
  expect(mockRouter.push.mock.calls).toEqual([['/profil/obavestenja']]);
});
test.each(['load','action','page'])('%s failure preserves last data without asserting a successful empty state',async error=>{
  mockState={...mockState,error,page:error==='load'?null:{...mockState.page,items:[item],unreadCount:1}};await render();
  expect(text()).not.toContain('Još nema obaveštenja');expect(text()).toContain(error==='load'?'pokušaj ponovo da učitaš obaveštenja.':'Poslednje učitano stanje ostaje prikazano.');
  if(error!=='load')expect(text()).toContain(item.title);
});
test.each([
  ['CLARIFICATION_CREATED','narucilac',{kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'}],
  ['CLARIFICATION_ANSWERED','uskocer',{kind:'OPPORTUNITY',id:'actual-need',role:'WORKER'}],
])('%s opens the questions themselves, not the Zadatak they are somewhere inside',async(eventType,intent,target)=>{
  // The server can only answer a CLARIFICATION with the Need it belongs to, so both sides used to
  // land on the task. The event type is the part that says it was about a question.
  mockIntent=intent;mockModel.open.mockResolvedValue(target);
  mockState.page.items=[{...item,eventType,role:target.role}];mockState.page.unreadCount=1;await render();
  await act(async()=>press(`Nepročitano. ${item.title}. ${item.body}`).props.onPress());
  // The link says whose task the questions are about, so the way back needs no app-wide mode.
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/pitanja-zadatka',params:{needId:'actual-need',own:target.kind==='OWN_NEED'?'1':'0'}}]]);
});
test('an event about the Zadatak itself still opens the Zadatak',async()=>{
  mockModel.open.mockResolvedValue({kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType:'NEED_REVISED',role:'REQUESTER'}];mockState.page.unreadCount=1;await render();
  await act(async()=>press(`Nepročitano. ${item.title}. ${item.body}`).props.onPress());
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/potrebe/[id]/pregled',params:{id:'actual-need'}}]]);
});
// Owner decision 1 (2026-09-19): a notification opens the thing it is about. It used to stop at a sheet
// that asked to switch the whole app into "the other intent" first, and one confirm did both.
test.each(['narucilac','uskocer'])('a Dogovor I work on opens directly, with no sheet and no mode change, whatever the app last was (%s)',async last=>{
  mockIntent=last;mockState.page.items=[item];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockModel.open).toHaveBeenCalledWith(item);expect(mockRole).not.toHaveBeenCalled();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]',params:{id:'actual-agreement'}}]]);
  expect(text()).not.toContain('Prelaziš u');expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
});
test.each(['narucilac','uskocer'])('a notification about my own task opens my view of that task directly (%s)',async last=>{
  mockIntent=last;mockModel.open.mockResolvedValue({kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType:'NEED_REVISED',role:'REQUESTER'}];mockState.page.unreadCount=1;await render();
  await act(async()=>press(`Nepročitano. ${item.title}. ${item.body}`).props.onPress());
  expect(mockRole).not.toHaveBeenCalled();expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/potrebe/[id]/pregled',params:{id:'actual-need'}}]]);
});
test('an event of the current intent opens directly without touching the saved intent',async()=>{
  mockIntent='uskocer';mockState.page.items=[item];await render();
  await openItem();
  expect(mockRole).not.toHaveBeenCalled();expect(text()).not.toContain('Prelazite u');
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]',params:{id:'actual-agreement'}}]]);
});
test('retired ownership suppresses late target and retained settings actions',async()=>{
  let done!:(value:unknown)=>void;mockModel.open.mockReturnValueOnce(new Promise(resolve=>{done=resolve;}));
  mockState.page.items=[item];await render();
  let pending!:Promise<void>;await act(async()=>{pending=press(`Nepročitano. ${item.title}. ${item.body}`).props.onPress();});
  mockModel.canNavigate.mockReturnValue(false);await act(async()=>done({kind:'AGREEMENT',id:'old',role:'WORKER'}));await pending;
  expect(text()).not.toContain('Prelazite u');
  await act(async()=>press('Podesi obaveštenja').props.onPress());expect(mockRole).not.toHaveBeenCalled();expect(mockRouter.push).not.toHaveBeenCalled();
});
test('ownership retired before the target resolves opens nothing, and there is no sheet left to confirm',async()=>{
  mockState.page.items=[item];mockModel.canNavigate.mockReturnValue(false);await render();await openItem();
  expect(mockRole).not.toHaveBeenCalled();expect(mockRouter.push).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({label:'Pređi i otvori'})).toHaveLength(0);
});
// F14 / PG06: the server answers with the thing the event is about; the event type says which part of
// it the person came for. Everything else keeps the overview, where the next step is stated.
test('a message opens the conversation, not the overview it lives behind',async()=>{
  mockModel.open.mockResolvedValue({kind:'AGREEMENT',id:'actual-agreement',role:'WORKER'});
  mockState.page.items=[{...item,eventType:'MESSAGE_RECEIVED'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]',params:{id:'actual-agreement',tab:'poruke'}}]]);
});
test('a proposed change opens the change itself',async()=>{
  mockModel.open.mockResolvedValue({kind:'AGREEMENT',id:'actual-agreement',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType:'AGREEMENT_CHANGE_PROPOSED'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]/izmene',params:{id:'actual-agreement'}}]]);
});
test.each(['AGREEMENT_CHANGE_REJECTED','AGREEMENT_VERSION_CHANGED','EXECUTION_STATE_CHANGED','COMPLETION_REQUIRED'])
('%s keeps the Dogovor overview',async eventType=>{
  mockModel.open.mockResolvedValue({kind:'AGREEMENT',id:'actual-agreement',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/dogovor/[id]',params:{id:'actual-agreement'}}]]);
});
test('a cancelled Zadatak sends the person who applied to their own offers, not to the dead task',async()=>{
  mockModel.open.mockResolvedValue({kind:'OPPORTUNITY',id:'actual-need',role:'WORKER'});
  mockState.page.items=[{...item,eventType:'NEED_CANCELLED',role:'WORKER'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/moje-prijave',params:{}}]]);
});
test('the owner cancelling their own Zadatak still lands on that task',async()=>{
  mockModel.open.mockResolvedValue({kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType:'NEED_CANCELLED',role:'REQUESTER'}];mockState.page.unreadCount=1;await render();
  await openItem();
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/potrebe/[id]/pregled',params:{id:'actual-need'}}]]);
});

// The icon says what kind of thing happened: a message is a speech bubble, a completion is a check — seen
// the other way round on a device on 2026-09-23, because the map went by family alone.
test('a new message wears the speech bubble and a completion the check, whatever family the server files them under',async()=>{
  // The phosphor mock renders every glyph as a host element named after itself, so the tree says which icon was drawn.
  const drawn=(glyph:string)=>tree.root.findAll(node=>String(node.type)===glyph).length;
  mockState.page.items=[{...item,id:'m',eventType:'MESSAGE_RECEIVED',family:'dogovor'},{...item,id:'c',eventType:'EXECUTION_STATE_CHANGED',family:'execution'},{...item,id:'a',eventType:'AGREEMENT_CHANGE_PROPOSED',family:'dogovor'}];
  mockState.page.unreadCount=3;await render();
  expect([drawn('ChatCircle'),drawn('CheckCircle'),drawn('Handshake')]).toEqual([1,1,1]);
});
