import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { InboxRole } from '../../contracts/inbox';
let mockSession={user:{id:'account-a'},accountRevision:1};
let mockFocused=true, mockAppState='active';
const mockListeners=new Set<(state:string)=>void>();
const mockPort={list:jest.fn(),read:jest.fn(),readAll:jest.fn(),resolve:jest.fn()};
jest.mock('react-native',()=>{const native=jest.requireActual('react-native');const app={get currentState(){return mockAppState;},addEventListener:(_event:string,listener:(state:string)=>void)=>{
  mockListeners.add(listener);return {remove:()=>mockListeners.delete(listener)};
}};return new Proxy(native,{get:(target,key)=>key==='AppState'?app:Reflect.get(target,key)});});
jest.mock('expo-router',()=>({useFocusEffect:(effect:()=>void)=>require('react').useEffect(()=>mockFocused?effect():undefined,[effect,mockFocused])}));
jest.mock('../../store/sesija',()=>({useSesija:()=>mockSession,sesijaSada:()=>mockSession}));
jest.mock('../inboxClientService',()=>({inboxClientService:{list:(...args:unknown[])=>mockPort.list(...args),read:(...args:unknown[])=>mockPort.read(...args),readAll:(...args:unknown[])=>mockPort.readAll(...args),resolve:(...args:unknown[])=>mockPort.resolve(...args)}}));
import { useInbox } from '../../hooks/useInbox';
function Probe({role=null}:{role?:InboxRole|null}){const inbox=useInbox(role);return React.createElement('Probe',inbox);}
const at='2026-09-10T10:00:00Z', row={id:'event',role:'WORKER',occurredAt:at,readAt:null,title:'Prijava',body:'Dogovor',eventType:'RESPONSE_SELECTED',family:'responses'};
const page={items:[row],unreadCount:1,hasMore:false,asOf:at};
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};};
let tree:ReactTestRenderer;
const current=()=>tree.root.findByType('Probe' as React.ElementType).props;
beforeEach(()=>{jest.clearAllMocks();mockSession={user:{id:'account-a'},accountRevision:1};mockFocused=true;mockAppState='active';mockListeners.clear();mockPort.list.mockResolvedValue(page);mockPort.read.mockResolvedValue(at);mockPort.resolve.mockResolvedValue({kind:'AGREEMENT',role:'WORKER',id:'agreement'});});
afterEach(async()=>{await act(async()=>tree?.unmount());});
test('account ABA retires pending page and navigation before a replacement render',async()=>{
  await act(async()=>{tree=create(<Probe/>);}); const old=current().model;
  const target=deferred<unknown>();mockPort.resolve.mockReturnValueOnce(target.promise);
  let pending!:Promise<unknown>;await act(async()=>{pending=old.open(row);});
  mockSession={user:{id:'account-a'},accountRevision:3}; // A → B → A before React can render.
  await act(async()=>target.resolve({kind:'AGREEMENT',role:'WORKER',id:'old'}));
  expect(await pending).toBeNull();expect(old.canNavigate()).toBe(false);
  await act(async()=>tree.update(<Probe/>));expect(current().model).not.toBe(old);expect(current().model.canNavigate()).toBe(true);
});
test.each(['background','blur','role'])('%s retires the pending target and foreground/refocus reads fresh state',async kind=>{
  await act(async()=>{tree=create(<Probe/>);});const old=current().model;
  const target=deferred<unknown>();mockPort.resolve.mockReturnValueOnce(target.promise);
  let pending!:Promise<unknown>;await act(async()=>{pending=old.open(row);});
  await act(async()=>{
    if(kind==='background'){mockAppState='background';mockListeners.forEach(listener=>listener(mockAppState));}
    if(kind==='blur'){mockFocused=false;tree.update(<Probe/>);}
    if(kind==='role')tree.update(<Probe role="REQUESTER"/>);
  });
  if(kind==='background'||kind==='blur')expect(current().state.page).toBeNull();
  await act(async()=>target.resolve({kind:'AGREEMENT',role:'WORKER',id:'old'}));
  expect(await pending).toBeNull();expect(old.canNavigate()).toBe(false);
  if(kind==='background')await act(async()=>{mockAppState='active';mockListeners.forEach(listener=>listener(mockAppState));});
  if(kind==='blur')await act(async()=>{mockFocused=true;tree.update(<Probe/>);});
  expect(current().state.loading).toBe(false);expect(current().model.canNavigate()).toBe(true);expect(mockPort.list.mock.calls.length).toBeGreaterThanOrEqual(2);
});
