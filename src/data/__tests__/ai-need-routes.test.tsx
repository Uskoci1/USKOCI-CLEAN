import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { conversation, deferred, fact, id, port, uncertain } from './fixtures/ai-v2';
import type { AiNeedResult, AiNeedV2Conversation } from '../../contracts/aiNeedV2';

let mockAccount=id(1), mockRevision=1, mockParams:any={conversationId:id(2)};
const mockPort=port();
const mockRouter={push:jest.fn(),replace:jest.fn(),back:jest.fn(),canGoBack:jest.fn(()=>true)};
const mockReadNeed=jest.fn(),mockSearch=jest.fn();
jest.mock('react-native',()=>{const n=jest.requireActual('react-native'); return new Proxy(n,{get(t,k){
 return ['View','ScrollView','ActivityIndicator','TextInput','KeyboardAvoidingView'].includes(String(k))?k:Reflect.get(t,k);
}});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('phosphor-react-native',()=>new Proxy({},{get:()=> 'Icon'}));
jest.mock('react-native-reanimated',()=>({__esModule:true,default:{View:'AnimatedView'},FadeInDown:{duration:()=>undefined}}));
jest.mock('expo-router',()=>({get router(){return mockRouter;},useLocalSearchParams:()=>mockParams,
 useFocusEffect:(effect:()=>void)=>require('react').useEffect(effect,[effect])}));
jest.mock('../../store/sesija',()=>({useSesija:()=>({user:{id:mockAccount},accountRevision:mockRevision}),
 sesijaSada:()=>({user:{id:mockAccount},accountRevision:mockRevision})}));
jest.mock('../../store/uloga',()=>({useUloga:()=> 'narucilac',ulogaSada:()=> 'narucilac',useIzvor:()=>mockSource}));
jest.mock('../index',()=>({get aiNeedV2Izvor(){return mockPort;}}));
jest.mock('../ru4Production',()=>({ru4Production:{remainingSearchState:(id:string)=>mockSearch(id)}}));
jest.mock('../../ui/Text',()=>({T:'T'}));
jest.mock('../../ui/Press',()=>({Press:'Press'}));
const mockSource={potreba:(id:string)=>mockReadNeed(id)};
import Nova from '../../app/(app)/nova';
import Review from '../../app/(app)/pregled-nacrta';
import CardScreen from '../../app/(app)/potrebe/[id]/pregled';
import { needDisplayProjection } from '../needDisplayProjection';

let tree:ReactTestRenderer;
const texts=()=>tree.root.findAll(n=>String(n.type)==='T').flatMap(n=>n.children.filter(c=>typeof c==='string')).join(' ');
const button=(label:string)=>tree.root.findAll(n=>String(n.type)==='Press'&&n.props.accessibilityLabel===label)[0];
const press=(label:string)=>button(label).props.onPress();
async function render(element=<Nova/>){await act(async()=>{tree=create(element);});}
async function settle(action:()=>void|Promise<unknown>){await act(async()=>{await action();});}
beforeEach(()=>{
 jest.clearAllMocks(); Object.assign(mockPort,port()); mockAccount=id(1);mockRevision=1;mockParams={conversationId:id(2)};
 mockRouter.canGoBack.mockReturnValue(true);mockSearch.mockResolvedValue({closed:false});
});
afterEach(async()=>{await act(async()=>tree?.unmount());});

describe('actual AI routes + real controller + focus hook',()=>{
 it('rapid send captures input once and preserves unknown outcome without blind retry',async()=>{
  await render(); await settle(()=>tree.root.find(n=>String(n.type)==='TextInput').props.onChangeText('generic input'));
  const reply=deferred<AiNeedResult<{proposed:number}>>();mockPort.sendMessage.mockReturnValue(reply.promise);
  const handler=button('Pošalji poruku').props.onPress;
  await settle(()=>{handler();handler();});expect(mockPort.sendMessage).toHaveBeenCalledTimes(1);
  expect(texts()).toContain('Slanje je u toku');
  await settle(()=>reply.resolve(uncertain));expect(texts()).toContain('Slanje nije potvrđeno');
  expect(tree.root.find(n=>String(n.type)==='TextInput').props.value).toBe('generic input');
  expect(button('Pošalji poruku').props.disabled).toBe(true);
  await settle(()=>press('Proverite razgovor'));expect(mockPort.sendMessage).toHaveBeenCalledTimes(1);
 });
 it('known provider refusal shows fixed actionable error and retains editable text',async()=>{
  mockPort.sendMessage.mockResolvedValue({ok:false,kod:'AI_PROVIDER_NOT_CONFIGURED',poruka:'AI obrada još nije aktivirana na serveru.',outcome:'rejected'});
  await render();await settle(()=>tree.root.find(n=>String(n.type)==='TextInput').props.onChangeText('generic'));
  await settle(()=>press('Pošalji poruku'));
  expect(texts()).toContain('AI obrada još nije aktivirana');expect(tree.root.find(n=>String(n.type)==='TextInput').props.editable).toBe(true);
  expect(tree.root.find(n=>String(n.type)==='TextInput').props.value).toBe('generic');
 });
 it('long facts/history scroll together with keyboard; Back and composer remain outside scroll',async()=>{
  await render();const scroll=tree.root.find(n=>String(n.type)==='ScrollView');
  expect(scroll.findAll(n=>String(n.type)==='T').length).toBeGreaterThan(0);
  expect(scroll.findAll(n=>String(n.type)==='TextInput')).toHaveLength(0);
  expect(scroll.findAll(n=>String(n.type)==='Press'&&n.props.accessibilityLabel==='Nazad')).toHaveLength(0);
  expect(tree.root.find(n=>String(n.type)==='KeyboardAvoidingView').props.behavior).toBeDefined();
 });
 it('route A→B drops late conversation A and stale review CTA',async()=>{
  const old=deferred<AiNeedV2Conversation>();mockPort.loadConversation.mockReturnValueOnce(old.promise);await render();
  mockParams={conversationId:id(22)};mockPort.loadConversation.mockResolvedValue(conversation([fact('need.title','B title')],{conversationId:id(22)}));
  await settle(()=>tree.update(<Nova/>));await settle(()=>old.resolve(conversation([fact('need.title','A private')])));
  expect(texts()).toContain('B title');expect(texts()).not.toContain('A private');
  await settle(()=>press('Pregledajte nacrt'));expect(mockRouter.push).toHaveBeenCalledWith({pathname:'/pregled-nacrta',params:{conversationId:id(22)}});
 });
 it('account ABA before render invalidates captured press and pending request',async()=>{
  await render();await settle(()=>tree.root.find(n=>String(n.type)==='TextInput').props.onChangeText('private A'));
  const send=button('Pošalji poruku').props.onPress;
  mockAccount=id(50);mockRevision++;mockAccount=id(1);mockRevision++;
  await settle(()=>send());expect(mockPort.sendMessage).not.toHaveBeenCalled();
 });
 it('invalid UUID/array routes perform no source read and provide Back fallback',async()=>{
  mockParams={conversationId:[id(2),id(22)]};await render(<Review/>);
  expect(mockPort.loadConversation).not.toHaveBeenCalled();await settle(()=>press('Nazad na Zadatke'));
  expect(mockRouter.replace).toHaveBeenCalledWith('/potrebe');
 });
 it('read failure has Retry and Back; successful retry restores actual review',async()=>{
  mockPort.loadConversation.mockRejectedValueOnce(new Error('private network error'));await render(<Review/>);
  expect(texts()).not.toContain('private network error');
  await settle(()=>press('Pokušajte ponovo'));expect(texts()).toContain('Generic task');
  mockRouter.canGoBack.mockReturnValue(false);await settle(()=>press('Nazad u razgovor'));
  expect(mockRouter.replace).toHaveBeenCalledWith({pathname:'/nova',params:{conversationId:id(2)}});
 });
 it('optional vehicle proposal requires explicit confirmation before Save',async()=>{
  const vehicle=fact('need.required_vehicles',['van'],{status:'NEEDS_CONFIRMATION'});
  mockPort.loadConversation.mockResolvedValue(conversation([vehicle]));await render(<Review/>);
  expect(button('Sačuvajte nacrt').props.disabled).toBe(true);expect(texts()).toContain('Vozilo'.toUpperCase());
  expect(texts()).toContain('Potvrdite ili ispravite sve predložene podatke pre čuvanja.');
  mockPort.loadConversation.mockResolvedValueOnce(conversation([vehicle])).mockResolvedValue(conversation([{...vehicle,status:'CONFIRMED'}]));
  await settle(()=>press('Potvrdite: Vozilo'));expect(mockPort.confirmFact).toHaveBeenCalledTimes(1);
  expect(button('Sačuvajte nacrt').props.disabled).toBe(false);
  expect(texts()).not.toContain('Potvrdite ili ispravite sve predložene podatke pre čuvanja.');
 });
 it('human2→3 correction cannot race Save, then exact current draft receipt navigates once',async()=>{
  const people=fact('need.people_needed',2);
  mockPort.loadConversation.mockResolvedValue(conversation([people]));await render(<Review/>);
  await settle(()=>press('Izmenite: Ljudi'));await settle(()=>tree.root.find(n=>String(n.type)==='TextInput').props.onChangeText('3'));
  const reply=deferred<AiNeedResult<{newFactId:string}>>();mockPort.correctFact.mockReturnValue(reply.promise);
  const save=button('Sačuvajte nacrt').props.onPress;
  await settle(()=>{press('Sačuvaj ispravku');save();});
  expect(mockPort.saveDraft).not.toHaveBeenCalled();expect(mockPort.correctFact.mock.calls[0].slice(0,3)).toEqual([id(10),3,'3']);
  mockPort.loadConversation.mockResolvedValue(conversation([fact('need.people_needed',3,{id:id(11)})]));
  await settle(()=>reply.resolve({ok:true,podatak:{newFactId:id(11)}}));
  await settle(()=>press('Sačuvajte nacrt'));expect(mockPort.saveDraft).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledWith({pathname:'/potrebe/[id]/pregled',params:{id:id(3)}});
 });
 it('fresh server BLOCK at Save prevents RPC even when earlier UI was enabled',async()=>{
  await render(<Review/>);const saved=button('Sačuvajte nacrt').props.onPress;
  mockPort.loadConversation.mockResolvedValue(conversation([], {safety:'BLOCK',review:{...conversation().review,safety:'BLOCK',canSaveDraft:false}}));
  await settle(()=>saved());expect(mockPort.saveDraft).not.toHaveBeenCalled();expect(button('Sačuvajte nacrt').props.disabled).toBe(true);
 });
});
const raw={
 execution_location_mode:'POINT_TO_POINT',need_geography:{public_topology:{mode:'POINT_TO_POINT',start:{city:'Alpha',area:'Center'},end:{city:'Beta',area:'North'}}},
 schedule_kind:'FIXED_WINDOW',starts_at:'2030-05-14T14:00:00Z',ends_at:'2030-05-14T16:00:00Z',
 required_vehicles:['van'],required_skills:['careful carrying'],required_tools:['straps'],required_licenses:['B'],
 minimum_experience_years:2,verified_identity_required:true,need_requirement_details:{critical_conditions:['Keep upright']},
 public_photo_paths:[],category:'Transport'
};
function cardProjection(){return {id:id(3),naslov:'Generic transport',opis:'Generic description',stanje:'NACRT',revizija:1,
 pokrivenost:{popunjeno:0,ukupno:2,preostalo:2,udeo:0},brojPrijava:0,rezimCene:'OFFERS',...needDisplayProjection(raw)};}
describe('saved draft temporary card',()=>{
 it('displays exact public route, full fixed dates, people, offers and every persisted requirement without fake applications',async()=>{
  mockParams={id:id(3)};mockReadNeed.mockResolvedValue(cardProjection());await render(<CardScreen/>);
  const text=texts();for(const item of ['Center, Alpha → North, Beta','2','van','straps','careful carrying','Dozvola: B','najmanje 2','Keep upright','Očekujete ponude','2030','16:00','18:00','Nacrt'])expect(text).toContain(item);
  expect(button('Otvori prijave, ukupno 0')).toBeUndefined();expect(mockSearch).not.toHaveBeenCalled();
  mockRouter.canGoBack.mockReturnValue(false);await settle(()=>press('Nazad'));expect(mockRouter.replace).toHaveBeenCalledWith('/potrebe');
 });
 it('read A→B and retry drop old card and keep failure distinct from empty/loading',async()=>{
  const old=deferred<any>();mockParams={id:id(3)};mockReadNeed.mockReturnValueOnce(old.promise);await render(<CardScreen/>);
  mockParams={id:id(4)};mockReadNeed.mockRejectedValueOnce(new Error('private data'));await settle(()=>tree.update(<CardScreen/>));
  await settle(()=>old.resolve(cardProjection()));expect(texts()).not.toContain('Generic transport');expect(texts()).not.toContain('private data');
  mockReadNeed.mockResolvedValue({...cardProjection(),id:id(4),naslov:'B card'});await settle(()=>press('Pokušaj ponovo'));
  expect(texts()).toContain('B card');expect(mockReadNeed).toHaveBeenLastCalledWith(id(4));
 });
});
