import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { trenutak } from '../../lib/trenutak';
import { inboxEventArt } from '../../ui/notifications/InboxPresentation';
import { Appear } from '../../ui/system/Appear';
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
jest.mock('react-native-svg',()=>({__esModule:true,default:'Svg',SvgXml:'NativeSvgXml',Path:'Path',Circle:'Circle',Rect:'Rect',Ellipse:'Ellipse'}));
jest.mock('../../ui/system/motion',()=>({useReducedMotion:()=>false}));
jest.mock('expo-router',()=>({get router(){return mockRouter;},Stack:{Screen:'StackScreen'},useFocusEffect:(effect:()=>void)=>require('react').useEffect(effect,[effect])}));
jest.mock('../../store/uloga',()=>({postaviUlogu:(role:string)=>mockRole(role),useUloga:()=>mockIntent,ulogaSada:()=>mockIntent}));
jest.mock('../../hooks/useInbox',()=>({useInbox:()=>({state:mockState,model:mockModel})}));
jest.mock('../../ui/Press',()=>({Press:'Press'}));
jest.mock('../../ui/Text',()=>({T:'T'}));
import Inbox from '../../app/obavestenja';
let tree:ReactTestRenderer;
const presses=()=>tree.root.findAllByType('Press' as React.ElementType);
const press=(label:string)=>presses().find(node=>node.props.accessibilityLabel===label)!;
// A row's spoken label ends with its day and clock ("…. Danas, 14:05"), which depend on the runner's date and zone.
const row=(prefix:string)=>presses().find(node=>typeof node.props.accessibilityLabel==='string'&&node.props.accessibilityLabel.startsWith(prefix))!;
const unreadRow=(title=item.title,body=item.body)=>row(`Nepročitano. ${title}. ${body}`);
const strings=(node:ReactTestInstance)=>node.findAllByType('T' as React.ElementType).flatMap(t=>t.children.filter(child=>typeof child==='string'));
const text=()=>strings(tree.root).join(' ');
const drawn=(kind:string)=>tree.root.findAll(node=>typeof node.type!=='string'&&node.props?.kind===kind,{deep:false}).length;
const headers=()=>tree.root.findAllByType('T' as React.ElementType).filter(node=>node.props.accessibilityRole==='header').map(node=>node.children.join(''));
const render=async()=>act(async()=>{tree=create(<Inbox/>);});
const openItem=async()=>act(async()=>unreadRow().props.onPress());
beforeEach(()=>{jest.clearAllMocks();mockIntent='narucilac';mockModel.canNavigate.mockReturnValue(true);mockModel.open.mockResolvedValue({kind:'AGREEMENT',id:'actual-agreement',role:'WORKER'});
  mockState={page:{items:[],unreadCount:0,hasMore:false,asOf:at},loading:false,paging:false,acting:null,error:null,unavailable:false};});
afterEach(async()=>{await act(async()=>tree?.unmount());});
test('successful empty is the shared empty state with the bell, and one owned settings destination',async()=>{
  await render();expect(text()).toContain('Još nema obaveštenja');expect(drawn('bell')).toBe(1);
  // The SPOJ V2 vector and its eyebrow ("Na jednom mestu") are gone: an empty list says so the way every list does.
  expect(tree.root.findAllByType('NativeSvgXml' as React.ElementType)).toHaveLength(0);expect(text()).not.toContain('Na jednom mestu');
  const settings=press('Podesi obaveštenja');await act(async()=>{settings.props.onPress();settings.props.onPress();});
  expect(mockRouter.push.mock.calls).toEqual([['/profil/obavestenja']]);
});
test('a filtered empty list names what it is empty of, without the settings shortcut',async()=>{
  await render();
  await act(async()=>press('Moji zadaci').props.onPress());
  expect(text()).toContain('Još nema obaveštenja o tvojim zadacima');expect(text()).not.toContain('Nove Prijave, poruke');
  expect(presses().filter(node=>node.props.accessibilityLabel==='Podesi obaveštenja')).toHaveLength(1);
  await act(async()=>press('Moje prijave').props.onPress());
  expect(text()).toContain('Još nema obaveštenja o tvojim prijavama');
});
test('the first read shows the breathing placeholders under the tabs, not a bare spinner',async()=>{
  mockState={...mockState,page:null,loading:true};await render();
  expect(text()).toContain('Učitavamo obaveštenja…');expect(press('Sve')).toBeDefined();
  expect(text()).not.toContain('Još nema obaveštenja');
});
test.each(['load','action','page'])('%s failure preserves last data without asserting a successful empty state',async error=>{
  mockState={...mockState,error,page:error==='load'?null:{...mockState.page,items:[item],unreadCount:1}};await render();
  expect(text()).not.toContain('Još nema obaveštenja');expect(text()).toContain(error==='load'?'pokušaj ponovo da učitaš obaveštenja.':'Poslednje učitano stanje ostaje prikazano.');
  if(error!=='load')expect(text()).toContain(item.title);
});
test('a failed page of older events is said next to the button that loads them, not at the top',async()=>{
  mockState={...mockState,error:'page',page:{...mockState.page,items:[item],unreadCount:1,hasMore:true}};await render();
  const copy=text();
  expect(copy).toContain('Starija obaveštenja nisu učitana.');
  expect(copy.indexOf('Starija obaveštenja nisu učitana.')).toBeGreaterThan(copy.indexOf(item.title));
  expect(copy).not.toContain('Radnja nije potvrđena.');expect(copy).not.toContain('Obaveštenja nisu osvežena.');
  await act(async()=>press('Učitaj starija obaveštenja').props.onPress());
  expect(mockModel.more).toHaveBeenCalledTimes(1);expect(mockModel.refresh).not.toHaveBeenCalled();
});
test('an action that failed with a page offers a re-read in the notice, drawn on the quiet wash, never orange',async()=>{
  mockState={...mockState,error:'action',page:{...mockState.page,items:[item],unreadCount:1}};await render();
  expect(text()).toContain('Radnja nije potvrđena.');
  // The button reads the list again; "Pokušaj ponovo" promised to repeat the action (round-5 review, 2026-09-24).
  expect(presses().filter(node=>node.props.accessibilityLabel==='Pokušaj ponovo')).toHaveLength(0);
  await act(async()=>press('Osveži obaveštenja').props.onPress());expect(mockModel.refresh).toHaveBeenCalledTimes(1);
  const fills=tree.root.findAll(node=>typeof node.type==='string').map(node=>StyleSheet.flatten(node.props.style)?.backgroundColor);
  expect(fills).not.toContain('#FFF5E9');
});
// Round-5 review (2026-09-24): motion only for an event that really arrived. An older page is fetched, not arrived, and a
// filter's first page is what was there; both used to fade in row by row.
test('only an event newer than the list moves; an older page and a new filter\'s first page stay still',async()=>{
  const minutesAgo=(minutes:number)=>new Date(Date.parse(at)-minutes*60_000).toISOString();
  const moving=()=>tree.root.findAllByType(Appear).filter(node=>node.props.animate).map(node=>node.props.children.props.item.id);
  mockState.page={...mockState.page,items:[{...item,id:'a',occurredAt:minutesAgo(10)},{...item,id:'b',occurredAt:minutesAgo(20)}],unreadCount:2,hasMore:true};
  await render();
  expect(moving()).toEqual([]);
  mockState={...mockState,page:{...mockState.page,items:[{...item,id:'new',occurredAt:minutesAgo(1)},...mockState.page.items]}};
  await act(async()=>tree.update(<Inbox/>));
  expect(moving()).toEqual(['new']);
  mockState={...mockState,page:{...mockState.page,items:[...mockState.page.items,{...item,id:'older',occurredAt:minutesAgo(600)}]}};
  await act(async()=>tree.update(<Inbox/>));
  expect(moving()).toEqual([]);
  // Another filter is another list: its first page, even with an event newer than anything shown before, is not news.
  mockState={...mockState,page:{...mockState.page,items:[{...item,id:'requester',occurredAt:minutesAgo(0)},{...item,id:'r2',occurredAt:minutesAgo(30)}]}};
  await act(async()=>press('Moji zadaci').props.onPress());
  expect(moving()).toEqual([]);
});
test('events are grouped under their day, the day said once',async()=>{
  const now=new Date(), today=now.toISOString(), earlier=new Date(now.getTime()-60_000).toISOString();
  const yesterday=new Date(now.getTime()-24*3600_000).toISOString(), old='2025-03-14T10:00:00Z';
  mockState.page.items=[{...item,id:'a',occurredAt:today},{...item,id:'b',occurredAt:earlier},{...item,id:'c',occurredAt:yesterday},{...item,id:'d',occurredAt:old}];
  mockState.page.unreadCount=4;await render();
  // One header per run of the same day (two events a minute apart share "Danas"; across midnight they would not).
  const days=[today,earlier,yesterday,old].map(value=>trenutak(value)!.dan).filter((day,index,all)=>index===0||all[index-1]!==day);
  expect(headers().filter(label=>label!=='Obaveštenja')).toEqual(days);
  expect(days).toEqual(expect.arrayContaining(['Danas','Juče']));expect(days.length).toBeLessThanOrEqual(4);
  expect(trenutak(old)!.dan).toMatch(/2025$/);
  // The row says its day and clock to a screen reader, after the words it shows.
  const moment=trenutak(old)!;
  expect(presses().some(node=>node.props.accessibilityLabel===`Nepročitano. ${item.title}. ${item.body}. ${moment.dan}, ${moment.sat}`)).toBe(true);
});
test('unread is a dot and a heavier title, never a tinted card or an orange icon well',async()=>{
  mockState.page.items=[{...item,id:'a'},{...item,id:'b',readAt:at,title:'Pročitan naslov'},{...item,id:'c'}];mockState.page.unreadCount=2;await render();
  expect(tree.root.findAll(node=>node.props.testID==='inbox-unread-dot'&&typeof node.type==='string')).toHaveLength(2);
  const rows=presses().filter(node=>/^(Nepročitano|Pročitano)\. /.test(node.props.accessibilityLabel??''));
  expect(rows).toHaveLength(3);
  for(const node of rows){const style=StyleSheet.flatten(node.props.style);expect(style.backgroundColor).toBeUndefined();expect(style.borderRadius).toBeUndefined();expect(style.borderColor).not.toBe('#C9D6CF');}
  const fills=tree.root.findAll(node=>typeof node.type==='string').map(node=>StyleSheet.flatten(node.props.style)?.backgroundColor);
  expect(fills).not.toContain('#FFF5E9');
  const read=row(`Pročitano. Pročitan naslov.`).findAllByType('T' as React.ElementType)[0];expect(read.props.variant).toBe('body');
  expect(unreadRow().findAllByType('T' as React.ElementType)[0].props.variant).toBe('bodyStrong');
  // No second arrow: the whole row is the button.
  expect(tree.root.findAllByType('CaretRight' as React.ElementType)).toHaveLength(0);
});
test('"Označi sve kao pročitano" reads everything once and shows its own spinner while it works',async()=>{
  mockState.page.items=[item];mockState.page.unreadCount=1;await render();
  const readAll=press('Označi sve kao pročitano');expect(readAll).toBeDefined();
  await act(async()=>readAll.props.onPress());expect(mockModel.readAll).toHaveBeenCalledTimes(1);
  mockState={...mockState,acting:'all'};await act(async()=>tree.update(<Inbox/>));
  expect(press('Označi sve kao pročitano').props.accessibilityState).toEqual({disabled:true,busy:true});
  // Every row waits too, and none claims to be at work itself.
  expect(unreadRow().props.disabled).toBe(true);expect(unreadRow().props.accessibilityState).toEqual({disabled:true,busy:false});
  mockState={...mockState,acting:null,page:{...mockState.page,items:[{...item,readAt:at}],unreadCount:0}};
  await act(async()=>tree.update(<Inbox/>));
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Nema nepročitanih obaveštenja.');
  expect(presses().filter(node=>node.props.accessibilityLabel==='Označi sve kao pročitano')).toHaveLength(0);
});
test('the row being opened turns its picture into a spinner; the others wait',async()=>{
  mockState={...mockState,acting:'b',page:{...mockState.page,items:[{...item,id:'a'},{...item,id:'b',title:'Druga'}],unreadCount:2}};await render();
  expect(row('Nepročitano. Druga.').findAllByType('ActivityIndicator' as React.ElementType)).toHaveLength(1);
  expect(row('Nepročitano. Druga.').props.accessibilityState).toEqual({disabled:true,busy:true});
  expect(unreadRow().findAllByType('ActivityIndicator' as React.ElementType)).toHaveLength(0);
  expect(unreadRow().props.disabled).toBe(true);
});
test('a new task for you leads with the task itself, the only row the data lets lead with the task',async()=>{
  const title='Nova prilika koja ti može odgovarati', body='Prenos ormana do kombija';
  mockState.page.items=[{...item,eventType:'OPPORTUNITY_AVAILABLE',family:'opportunities',title,body}];mockState.page.unreadCount=1;await render();
  expect(strings(unreadRow(title,body)).slice(0,2)).toEqual([body,title]);
});
test.each([
  ['CLARIFICATION_CREATED','narucilac',{kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'}],
  ['CLARIFICATION_ANSWERED','uskocer',{kind:'OPPORTUNITY',id:'actual-need',role:'WORKER'}],
])('%s opens the questions themselves, not the Zadatak they are somewhere inside',async(eventType,intent,target)=>{
  // The server can only answer a CLARIFICATION with the Need it belongs to, so both sides used to
  // land on the task. The event type is the part that says it was about a question.
  mockIntent=intent;mockModel.open.mockResolvedValue(target);
  mockState.page.items=[{...item,eventType,role:target.role}];mockState.page.unreadCount=1;await render();
  await openItem();
  // The link says whose task the questions are about, so the way back needs no app-wide mode.
  expect(mockRouter.push.mock.calls).toEqual([[{pathname:'/pitanja-zadatka',params:{needId:'actual-need',own:target.kind==='OWN_NEED'?'1':'0'}}]]);
});
test('an event about the Zadatak itself still opens the Zadatak',async()=>{
  mockModel.open.mockResolvedValue({kind:'OWN_NEED',id:'actual-need',role:'REQUESTER'});
  mockState.page.items=[{...item,eventType:'NEED_REVISED',role:'REQUESTER'}];mockState.page.unreadCount=1;await render();
  await openItem();
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
  await openItem();
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
  let pending!:Promise<void>;await act(async()=>{pending=unreadRow().props.onPress();});
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
  // Each event wears its FactArt drawing (the one icon system); counted once per drawing, not per wrapper.
  mockState.page.items=[{...item,id:'m',eventType:'MESSAGE_RECEIVED',family:'dogovor'},{...item,id:'c',eventType:'EXECUTION_STATE_CHANGED',family:'execution'},{...item,id:'a',eventType:'AGREEMENT_CHANGE_PROPOSED',family:'dogovor'}];
  mockState.page.unreadCount=3;await render();
  expect([drawn('chat'),drawn('check'),drawn('agreements')]).toEqual([1,1,1]);
});
test('a task change, a cancellation and a question are drawn as what they are, not as offers',()=>{
  expect(inboxEventArt('NEED_REVISED','responses')).toBe('tasks');
  expect(inboxEventArt('NEED_CANCELLED','responses')).toBe('tasks');
  expect(inboxEventArt('CLARIFICATION_CREATED','responses')).toBe('chat');
  expect(inboxEventArt('CLARIFICATION_ANSWERED','responses')).toBe('chat');
  expect(inboxEventArt('PRIVATE_ACCESS_GRANTED','dogovor')).toBe('lock');
  expect(inboxEventArt('REVIEW_RECEIVED','dogovor')).toBe('star');
  expect(inboxEventArt('COMPLETION_REQUIRED','dogovor')).toBe('check');
  expect(inboxEventArt('RESPONSE_SELECTED','responses')).toBe('offers');
  expect(inboxEventArt('SOMETHING_NEW','recovery')).toBe('shield');
  expect(inboxEventArt('SOMETHING_NEW','account')).toBe('bell');
});
