import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',ID='20000000-0000-4000-8000-000000000001',KEY='30000000-0000-4000-8000-000000000001';
let mockSession={user:{id:A},accountRevision:1},mockIntent='uskocer',mockFocused=true,mockForeground='active';
const mockListeners=new Set<(value:string)=>void>(),mockStorage={getItem:jest.fn(),setItem:jest.fn(),removeItem:jest.fn()};
const mockService={read:jest.fn(),recover:jest.fn(),write:jest.fn()},mockCapture=jest.fn(),mockReplace=jest.fn();
jest.mock('../agreementCurrentLocationService',()=>{const actual=jest.requireActual('../agreementCurrentLocationService');return{...actual,agreementCurrentLocationService:{
 read:(...args:unknown[])=>mockService.read(...args),recover:(...args:unknown[])=>mockService.recover(...args),write:(...args:unknown[])=>mockService.write(...args)}};});
jest.mock('../nativeCurrentLocation',()=>({captureCurrentLocation:(...args:unknown[])=>mockCapture(...args)}));
jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({})}));
jest.mock('../../store/sesija',()=>({useSesija:()=>mockSession,sesijaSada:()=>mockSession}));
jest.mock('../../store/uloga',()=>({useUloga:()=>mockIntent,ulogaSada:()=>mockIntent}));
jest.mock('../../lib/idempotencija',()=>({noviUuidZahtevId:()=>'30000000-0000-4000-8000-000000000001'}));
jest.mock('@react-native-async-storage/async-storage',()=>({__esModule:true,default:{getItem:(...args:unknown[])=>mockStorage.getItem(...args),
 setItem:(...args:unknown[])=>mockStorage.setItem(...args),removeItem:(...args:unknown[])=>mockStorage.removeItem(...args)}}));
jest.mock('expo-router',()=>({router:{canGoBack:()=>false,replace:(...args:unknown[])=>mockReplace(...args)},
 useFocusEffect:(effect:()=>void)=>require('react').useEffect(()=>mockFocused?effect():undefined,[effect,mockFocused])}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('react-native',()=>{const native=jest.requireActual('react-native');return new Proxy(native,{get(target,key){
 if(['View','ScrollView'].includes(String(key)))return String(key);if(key==='AppState')return{get currentState(){return mockForeground;},
  addEventListener:(_name:string,listener:(value:string)=>void)=>{mockListeners.add(listener);return{remove:()=>mockListeners.delete(listener)};}};return Reflect.get(target,key);
}});});
jest.mock('../../ui/Text',()=>({T:'T'}));
jest.mock('../../ui/v2/V2Action',()=>({V2Action:'Action'}));
jest.mock('../../ui/location/ResolvedPinMap',()=>({ResolvedPinMap:'PinMap'}));
import {AgreementLocationScreen} from '../../ui/agreements/AgreementLocationScreen';
const ok=(podatak:unknown)=>({ok:true,podatak}),unknown={ok:false,kod:'LOCATION_UNCONFIRMED',poruka:'Ishod nije potvrđen.'};
const point={latitude:45.25,longitude:19.85,accuracyMeters:9.1,capturedAt:'2026-09-13T12:00:00Z',sharedAt:'2026-09-13T12:00:01Z'};
const context=(role='WORKER')=>({agreementId:ID,agreementVersion:7,role,canShare:role==='WORKER',canRequest:role==='REQUESTER',requestedAt:null,point:null,authoritative:true});
const journal={version:1,agreementId:ID,agreementVersion:7,clientRequestId:KEY,kind:'SHARE',inputSha256:'a'.repeat(64)};
let tree:ReactTestRenderer|undefined;
const page=()=> <AgreementLocationScreen agreementId={ID}/>;
const render=async()=>{await act(async()=>{tree=create(page());});};
const action=(label:string)=>tree!.root.findByProps({label}).props;
const tap=async(label:string)=>{await act(async()=>action(label).onPress());};
const text=()=>JSON.stringify(tree!.toJSON());
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
beforeEach(()=>{jest.clearAllMocks();for(const group of [mockStorage,mockService])for(const fn of Object.values(group))fn.mockReset();mockCapture.mockReset();
 mockSession={user:{id:A},accountRevision:1};mockIntent='uskocer';mockFocused=true;mockForeground='active';mockStorage.getItem.mockResolvedValue(null);
 mockStorage.setItem.mockResolvedValue(undefined);mockStorage.removeItem.mockResolvedValue(undefined);mockService.read.mockResolvedValue(ok(context()));
 mockService.recover.mockResolvedValue(ok({found:false,command:null}));mockService.write.mockResolvedValue(unknown);
 const {sharedAt:_sharedAt,...sensor}=point;mockCapture.mockResolvedValue({kind:'POINT',point:sensor});
});
afterEach(async()=>{await act(async()=>tree?.unmount());tree=undefined;expect(mockListeners.size).toBe(0);mockListeners.clear();});
it('requester asks without GPS and sees optional worker consent copy before any action',async()=>{
 mockIntent='narucilac';mockService.read.mockResolvedValue(ok(context('REQUESTER')));await render();expect(text()).toContain('podeljena dobrovoljno');
 expect(mockCapture).not.toHaveBeenCalled();expect(tree!.root.findAllByProps({label:'Podeli jednu trenutnu lokaciju'})).toHaveLength(0);
 await tap('Zatraži trenutnu lokaciju');expect(mockCapture).not.toHaveBeenCalled();expect(mockService.write).toHaveBeenCalledTimes(1);expect(mockService.write.mock.calls[0][1]).toBeNull();
});
it('offers one explicit share, deduplicates retained taps, then exposes only read/cancel for unknown outcome',async()=>{
 await render();const gate=deferred<unknown>();mockCapture.mockReturnValue(gate.promise);const share=action('Podeli jednu trenutnu lokaciju').onPress;
 await act(async()=>{share();share();});expect(mockCapture).toHaveBeenCalledTimes(1);expect(action('Prekini deljenje')).toBeDefined();expect(mockStorage.setItem).not.toHaveBeenCalled();
 const {sharedAt:_sharedAt,...sensor}=point;await act(async()=>gate.resolve({kind:'POINT',point:sensor}));
 expect(mockService.write).toHaveBeenCalledTimes(1);expect(action('Proveri prvobitni zahtev')).toBeDefined();expect(action('Zaustavi zahtev ako još nije poslat')).toBeDefined();
 expect(tree!.root.findAllByProps({label:'Podeli jednu trenutnu lokaciju'})).toHaveLength(0);expect(mockStorage.setItem.mock.calls[0][1]).not.toMatch(/latitude|longitude|capturedAt/);
});
it('renders a static disabled last-shared map with explicit capture and server times, never tracks on read',async()=>{
 mockService.read.mockResolvedValue(ok({...context(),point}));await render();expect(text()).toContain('ranije zabeležena tačka');expect(text()).toContain('Ne potvrđuje sadašnji položaj');
 expect(text()).toContain('Zabeležena: ');expect(text()).toContain('Poslata: ');expect(text()).not.toContain('server');expect(text()).toContain('10');
 const map=tree!.root.findByType('PinMap' as never).props;expect(map.disabled).toBe(true);expect(map.position).toEqual({latitude:point.latitude,longitude:point.longitude});
 expect(mockCapture).not.toHaveBeenCalled();expect(mockService.write).not.toHaveBeenCalled();expect(mockStorage.setItem).not.toHaveBeenCalled();
});
it('closed server context reveals no action or old point',async()=>{
 mockService.read.mockResolvedValue(ok({...context(),canShare:false}));await render();expect(text()).toContain('aktivnog fizičkog Dogovora');
 expect(tree!.root.findAllByType('PinMap' as never)).toHaveLength(0);expect(tree!.root.findAllByProps({label:'Podeli jednu trenutnu lokaciju'})).toHaveLength(0);
 expect(tree!.root.findAllByProps({label:'Zatraži trenutnu lokaciju'})).toHaveLength(0);
});
it('restart reads unknown original request and a committed cancellation race is shown as shared',async()=>{
 mockStorage.getItem.mockResolvedValue(JSON.stringify(journal));await render();expect(mockCapture).not.toHaveBeenCalled();expect(mockService.write).not.toHaveBeenCalled();
 await tap('Proveri prvobitni zahtev');expect(mockService.recover).toHaveBeenCalledTimes(2);expect(mockService.write).not.toHaveBeenCalled();
 mockService.write.mockResolvedValue(ok({state:'COMMITTED'}));await tap('Zaustavi zahtev ako još nije poslat');expect(text()).toContain('Jedna lokacija je podeljena');
 expect(text()).not.toContain('zahtev je zaustavljen');expect(mockStorage.removeItem).not.toHaveBeenCalled();expect(mockCapture).not.toHaveBeenCalled();
});
it.each(['blur','account','ABA','background'])('retires capture and rejects late sensor/retained callbacks after %s',async change=>{
 await render();const gate=deferred<unknown>();mockCapture.mockReturnValue(gate.promise);const old=action('Podeli jednu trenutnu lokaciju').onPress;
 await act(async()=>old());const signal=mockCapture.mock.calls[0][0];expect(signal.aborted).toBe(false);
 await act(async()=>{if(change==='blur')mockFocused=false;else if(change==='account')mockSession={user:{id:B},accountRevision:2};
  else if(change==='ABA')mockSession={user:{id:A},accountRevision:3};
  else{mockForeground='background';[...mockListeners].forEach(fn=>fn('background'));}tree!.update(page());});
 expect(signal.aborted).toBe(true);const calls=mockCapture.mock.calls.length;
 const {sharedAt:_sharedAt,...sensor}=point;await act(async()=>{gate.resolve({kind:'POINT',point:sensor});old();});
 expect(mockCapture).toHaveBeenCalledTimes(calls);expect(mockService.write).not.toHaveBeenCalled();expect(mockStorage.setItem).not.toHaveBeenCalled();expect(mockStorage.removeItem).not.toHaveBeenCalled();
});
// Owner decision 1 (2026-09-19): the app has no global mode, and a Dogovor works the same for both of its
// sides from the relation it carries itself. 'role' used to be a row of the table above.
it('a flip of the retired app mode retires nothing: a capture in flight is not aborted',async()=>{
 await render();const gate=deferred<unknown>();mockCapture.mockReturnValue(gate.promise);const old=action('Podeli jednu trenutnu lokaciju').onPress;
 await act(async()=>old());const signal=mockCapture.mock.calls[0][0];
 await act(async()=>{mockIntent='narucilac';tree!.update(page());});
 expect(signal.aborted).toBe(false);
});
it('has a deterministic back fallback and removes its AppState observation on unmount',async()=>{
 await render();expect(mockListeners.size).toBe(1);
 await act(async()=>tree!.root.findByProps({accessibilityLabel:'Nazad'}).props.onPress());expect(mockReplace).toHaveBeenCalledWith({pathname:'/dogovor/[id]',params:{id:ID}});
 await act(async()=>tree!.unmount());tree=undefined;expect(mockListeners.size).toBe(0);
});
it('says what is shared and with whom before the one action, and never implies a live position',async()=>{
 await render();expect(text()).toContain('Jedna tačka, ne praćenje');expect(text()).toContain('Vide je samo učesnici ovog Dogovora');
 expect(text()).toContain('samo kada pritisneš dugme');expect(text()).not.toMatch(/uživo|u realnom vremenu|prati(?!\s+putovanje)/i);
 expect(tree!.root.findAllByProps({label:'Zatraži trenutnu lokaciju'})).toHaveLength(0);expect(mockCapture).not.toHaveBeenCalled();
});
