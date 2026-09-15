import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D='dddddddd-dddd-4ddd-8ddd-dddddddddddd', K='cccccccc-cccc-4ccc-8ccc-cccccccccccc', R='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
let mockAccount: string | null=A, mockRevision=1, mockFocused=true, mockAgreementId: string | string[]=D;
const mockContext=jest.fn(), mockSubmit=jest.fn(), mockReputation=jest.fn();
const mockListeners=new Set<(state:string)=>void>();
const mockRouter={back:jest.fn(),replace:jest.fn(),canGoBack:jest.fn(()=>true)};
jest.mock('react-native',()=>{const native=jest.requireActual('react-native');return new Proxy(native,{get(target,key){
 if(key==='AppState')return{currentState:'active',addEventListener:(_:string,fn:(state:string)=>void)=>{mockListeners.add(fn);return{remove:()=>mockListeners.delete(fn)};}};
 return ['View','ScrollView','ActivityIndicator'].includes(String(key))?key:Reflect.get(target,key);
}});});
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
jest.mock('phosphor-react-native',()=>({Star:'Star'}));
jest.mock('expo-router',()=>({get router(){return mockRouter;},useLocalSearchParams:()=>({agreementId:mockAgreementId}),
 useFocusEffect:(fn:()=>void)=>require('react').useEffect(()=>mockFocused?fn():undefined,[fn,mockFocused])}));
jest.mock('../../../store/sesija',()=>({useSesija:()=>({user:mockAccount?{id:mockAccount}:null,accountRevision:mockRevision}),
 sesijaSada:()=>({user:mockAccount?{id:mockAccount}:null,accountRevision:mockRevision})}));
jest.mock('../../../store/uloga',()=>({useUloga:()=> 'narucilac',ulogaSada:()=> 'narucilac'}));
jest.mock('../../../lib/idempotencija',()=>({noviUuidZahtevId:()=> 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}));
jest.mock('../../../data/supabaseClient',()=>({supabaseKlijent:()=>{throw new Error('Unexpected direct RPC in review presentation test');}}));
jest.mock('../../Text',()=>({T:'T'}));
jest.mock('../../Press',()=>({Press:'Press'}));
jest.mock('../../v2/icons',()=>({V2Icon:'V2Icon'}));
jest.mock('../../../data/reviewsClientService',()=>({
 ...jest.requireActual('../../../data/reviewsClientService'),
 reviewsClientService:{context:(...args:unknown[])=>mockContext(...args),submit:(...args:unknown[])=>mockSubmit(...args),
 reputation:(...args:unknown[])=>mockReputation(...args)}
}));
import ReviewRoute from '../../../app/(app)/oceni-dogovor';
import { AccountReputation } from '../AccountReputation';
import { REVIEW_TAGS } from '../../../data/reviewsClientService';
const context=()=>({accountId:A,agreementId:D,targetAccountId:B,eligible:true,review:null,
 tagCatalog:{version:'PRE_V3_REVIEW_TAGS_V1',maxTags:3,tags:[...REVIEW_TAGS]},authoritative:true});
const receipt=(command:Record<string,unknown>)=>({...command,reviewId:R,reviewerAccountId:A,createdAt:'2026-09-12T10:00:00Z',idempotentReplay:false,authoritative:true});
let tree:ReactTestRenderer;
const texts=()=>tree.root.findAll(node=>String(node.type)==='T').flatMap(node=>node.children.filter(x=>typeof x==='string')).join(' ');
const button=(label:string)=>tree.root.findByProps({accessibilityLabel:label});
const click=(label:string)=>act(()=>button(label).props.onPress());
const settle=async()=>{await act(async()=>{});};
async function render(){await act(async()=>{tree=create(<ReviewRoute/>);});}
beforeEach(()=>{jest.clearAllMocks();mockAccount=A;mockRevision=1;mockFocused=true;mockAgreementId=D;
 mockContext.mockReset().mockResolvedValue({ok:true,podatak:context()});mockSubmit.mockReset();mockReputation.mockReset();
 mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async()=>{await act(async()=>tree?.unmount());});

it('loads the server target/catalog without submitting and requires an explicit 1–5 selection',async()=>{
 await render();expect(mockContext).toHaveBeenCalledWith(D,{accountId:A,accountRevision:1});
 expect(mockSubmit).not.toHaveBeenCalled();expect(button('Sačuvaj ocenu').props.disabled).toBe(true);
 expect(tree.root.findAllByProps({accessibilityRole:'radio'})).toHaveLength(5);
 expect(tree.root.findAllByProps({accessibilityRole:'checkbox'})).toHaveLength(6);
 expect(tree.root.findAll(node=>String(node.type)==='TextInput')).toHaveLength(0);
 click('Ocena 4 od 5');expect(button('Sačuvaj ocenu').props.disabled).toBe(false);
 click('Po dogovoru');click('Pažljivo');click('Na vreme');expect(button('Pouzdano').props.disabled).toBe(true);
});
it('double tap sends one immutable command and only matching server readback shows success',async()=>{
 let finish!:(x:unknown)=>void;mockSubmit.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await render();click('Ocena 5 od 5');click('Pouzdano');const submit=button('Sačuvaj ocenu').props.onPress;
 act(()=>{submit();submit();});expect(mockSubmit).toHaveBeenCalledTimes(1);expect(texts()).not.toContain('Ocena je sačuvana');
 const command=mockSubmit.mock.calls[0][0];expect(command).toEqual({agreementId:D,targetAccountId:B,rating:5,tags:['RELIABLE'],clientRequestId:K});
 mockContext.mockResolvedValue({ok:true,podatak:{...context(),eligible:false,review:receipt(command)}});
 await act(async()=>finish({ok:true,podatak:receipt(command)}));expect(texts()).toContain('Ocena je sačuvana');
 expect(texts()).toContain('5');expect(mockRouter.back).not.toHaveBeenCalled();
});
it('unknown outcome freezes selection, requires readback, and retries exactly the original command',async()=>{
 mockSubmit.mockResolvedValue({ok:false,kod:'REVIEW_OUTCOME_UNKNOWN',poruka:'Proverite sačuvanu ocenu.'});
 await render();click('Ocena 3 od 5');const staleRating=button('Ocena 1 od 5').props.onPress;
 const staleSave=button('Sačuvaj ocenu').props.onPress;click('Sačuvaj ocenu');await settle();
 act(()=>{staleRating();staleSave();});expect(mockSubmit).toHaveBeenCalledTimes(1);
 expect(button('Ocena 3 od 5').props.accessibilityState.checked).toBe(true);
 click('Proveri sačuvanu ocenu');await settle();act(()=>staleSave());expect(mockSubmit).toHaveBeenCalledTimes(1);
 click('Ponovi istu ocenu');await settle();expect(mockSubmit).toHaveBeenCalledTimes(2);
 expect(mockSubmit.mock.calls[1]).toEqual(mockSubmit.mock.calls[0]);
});
it('lost acknowledgement resolves from own stored review without another write',async()=>{
 mockSubmit.mockResolvedValue({ok:false,kod:'REVIEW_OUTCOME_UNKNOWN',poruka:'Proverite sačuvanu ocenu.'});
 await render();click('Ocena 4 od 5');click('Sačuvaj ocenu');await settle();
 mockContext.mockResolvedValue({ok:true,podatak:{...context(),eligible:false,review:receipt(mockSubmit.mock.calls[0][0])}});
 click('Proveri sačuvanu ocenu');await settle();expect(texts()).toContain('Ocena je sačuvana');expect(mockSubmit).toHaveBeenCalledTimes(1);
});
it('server ineligibility and already submitted receipt never expose a new submission',async()=>{
 mockContext.mockResolvedValue({ok:true,podatak:{...context(),eligible:false}});await render();
 expect(texts()).toContain('Ocena još nije dostupna');expect(tree.root.findAllByProps({accessibilityRole:'radio'})).toHaveLength(0);
 expect(mockSubmit).not.toHaveBeenCalled();
});
it('background invalidates retained actions and foreground requires a fresh server read',async()=>{
 await render();click('Ocena 5 od 5');const oldSave=button('Sačuvaj ocenu').props.onPress;
 act(()=>{mockListeners.forEach(fn=>fn('background'));oldSave();});expect(mockSubmit).not.toHaveBeenCalled();
 await act(async()=>mockListeners.forEach(fn=>fn('active')));expect(mockContext.mock.calls.length).toBeGreaterThan(1);
 act(()=>oldSave());expect(mockSubmit).not.toHaveBeenCalled();
});
it('invalid route and account switch cannot reuse the previous focused write callback',async()=>{
 await render();click('Ocena 5 od 5');const oldSave=button('Sačuvaj ocenu').props.onPress;
 mockAccount=B;mockRevision=2;mockContext.mockResolvedValue({ok:true,podatak:{...context(),accountId:B,targetAccountId:A}});
 await act(async()=>tree.update(<ReviewRoute/>));act(()=>oldSave());expect(mockSubmit).not.toHaveBeenCalled();
 expect(button('Sačuvaj ocenu').props.disabled).toBe(true);
 mockAgreementId=[D];await act(async()=>tree.update(<ReviewRoute/>));expect(texts()).toContain('Ocena nije dostupna');
});
it('reputation distinguishes no reviews from unavailable state and never invents 0.0',async()=>{
 mockReputation.mockResolvedValue({ok:true,podatak:{accountId:A,reviewCount:0,averageRating:null,state:'NO_REVIEWS',authoritative:true}});
 await act(async()=>{tree=create(<AccountReputation accountId={A}/>);});expect(texts()).toContain('Još nema ocena');expect(texts()).not.toContain('0,0');
 mockReputation.mockResolvedValue({ok:false,kod:'REPUTATION_READ_UNAVAILABLE',poruka:'Unavailable'});
 mockRevision=2;await act(async()=>tree.update(<AccountReputation accountId={A}/>));
 expect(texts()).toContain('Ocene trenutno nisu dostupne');expect(texts()).not.toContain('Još nema ocena');
});
