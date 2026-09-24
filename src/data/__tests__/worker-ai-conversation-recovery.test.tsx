import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',K='44444444-4444-4444-8444-444444444444';
let mockAccount=A,mockRevision=1,mockFocused=true,mockParams:{conversationId?:string}={conversationId:C};
const mockListeners=new Set<(s:string)=>void>();
const mockApi={read:jest.fn(),open:jest.fn(),send:jest.fn(),recoverTurn:jest.fn(),cancelTurn:jest.fn(),patch:jest.fn(),prepare:jest.fn(),save:jest.fn(),abandon:jest.fn()};
const mockJournal={load:jest.fn(),save:jest.fn(),clear:jest.fn()};let mockStored:unknown=null;
const mockRouter={back:jest.fn(),replace:jest.fn(),canGoBack:()=>true,setParams:jest.fn()};
const mockVoice={controller:{},state:{phase:'IDLE'}};const mockVoiceHook=jest.fn((_options:unknown)=>mockVoice);
jest.mock('react-native',()=>{const native=jest.requireActual('react-native');return new Proxy(native,{get(target,key){
 if(key==='View')return 'View';
 if(key==='AppState')return{currentState:'active',addEventListener:(_:string,fn:(s:string)=>void)=>{mockListeners.add(fn);return{remove:()=>mockListeners.delete(fn)};}};
 return Reflect.get(target,key);}});});
jest.mock('expo-router',()=>({get router(){return mockRouter;},useLocalSearchParams:()=>mockParams,useFocusEffect:(fn:()=>void)=>require('react').useEffect(()=>mockFocused?fn():undefined,[fn,mockFocused])}));
jest.mock('../../store/sesija',()=>({useSesija:()=>({user:{id:mockAccount},accountRevision:mockRevision}),sesijaSada:()=>({user:{id:mockAccount},accountRevision:mockRevision})}));
jest.mock('../supabaseClient',()=>({supabaseKlijent:jest.fn()}));
jest.mock('../workerAiClientService',()=>({get workerAiClientService(){return mockApi;}}));
jest.mock('../workerAiTurnIntentJournal',()=>({get workerAiTurnIntentJournal(){return mockJournal;}}));
jest.mock('../../features/voice/useHoldToTalk',()=>({useHoldToTalk:(options:unknown)=>mockVoiceHook(options)}));
jest.mock('../../ui/aiFirst/VoiceComposer',()=>({VoiceComposer:'VoiceComposer'}));
jest.mock('../../ui/aiFirst/AiConversationShell',()=>({AiConversationShell:({actions,status,children,...props}:any)=>require('react').createElement('Shell',props,status,actions,children)}));
jest.mock('../../ui/workerProfile/WorkerProfilePresentation',()=>({WorkerProfileFrame:({children}:any)=>children,WorkerProfileStatus:'Status'}));
jest.mock('../../ui/workerProfile/WorkerAiPresentation',()=>({WorkerAiActivation:'Activation',WorkerAiCard:'Card',WorkerAiManual:'Manual',WorkerAiReviewDetails:'Review'}));
jest.mock('../../ui/calendar/AvailabilityForm',()=>({AvailabilityForm:'Availability'}));
jest.mock('../../ui/Text',()=>({T:'T'}));
jest.mock('../../ui/v2/V2Action',()=>({V2Action:'Action'}));
import Screen from '../../app/(app)/profil/razgovor';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';
import { ActionSheet } from '../../ui/system/ActionSheet';
const intent=()=>({accountId:A,conversationId:C,clientRequestId:K});
const turn=(state='PROCESSING',id=K)=>({turnId:B,conversationId:C,clientRequestId:id,attemptId:A,state,retryAllowed:false,authoritative:true});
const recovery=(state:string|null=null,extras={})=>({schemaVersion:'WORKER_PROFILE_V1',accountId:A,conversationId:C,profileId:B,conversationStatus:'OPEN',clientRequestId:K,turn:state?turn(state):null,providerDispatched:false,cancelled:false,canCancel:true,retryAllowed:state===null,authoritative:true,...extras});
const snapshot=(t:unknown=null)=>({schemaVersion:'WORKER_PROFILE_V1',accountId:A,conversationId:C,profileId:B,status:'OPEN',profileStatus:'DRAFT',revision:0,candidate:{},safety:'ALLOW',stale:false,messages:[],turn:t,review:null,saved:null});
const ok=(podatak:unknown)=>({ok:true,podatak});let tree:ReactTestRenderer;
const shell=()=>tree.root.findByType('Shell' as any),action=(label:string)=>tree.root.findByProps({label});
const visibleText=()=>tree.root.findAllByType('T' as any).flatMap(node=>node.children.filter(child=>typeof child==='string')).join(' ');
const flush=async()=>{await act(async()=>{});};
// Editing by hand and the week moved behind "···" (an ActionSheet, 2026-09-24); a test opens the menu, reads the row and
// closes the menu without a choice, as Back does.
const manualDisabled=async()=>{await act(async()=>{shell().props.onOptions();});
 const [row]=tree.root.findAll(node=>node.props.accessibilityRole==='menuitem'&&node.props.accessibilityLabel==='Ručno uredi podatke');
 const disabled=row.props.accessibilityState.disabled;await act(async()=>{tree.root.findByType(ActionSheet).props.onClose();});return disabled;};
const render=async()=>{await act(async()=>{tree=create(<Screen/>);});};
const click=async(label:string)=>{await act(async()=>{action(label).props.onPress();});};
// "Novi razgovor" is asked in an in-app ConfirmSheet (it was Alert.alert); a test presses its buttons.
const sheets=()=>tree.root.findAllByType(ConfirmSheet);
const answer=async(testID:'confirm-sheet-confirm'|'confirm-sheet-cancel')=>{await act(async()=>{tree.root.findByType(ConfirmSheet).findByProps({testID}).props.onPress();});};
beforeEach(()=>{jest.clearAllMocks();mockAccount=A;mockRevision=1;mockFocused=true;mockParams={conversationId:C};mockStored=null;
 mockJournal.load.mockImplementation(async()=>mockStored);mockJournal.save.mockImplementation(async(i:unknown)=>{mockStored=i;});mockJournal.clear.mockImplementation(async()=>{mockStored=null;});
 mockApi.read.mockResolvedValue(ok(snapshot()));mockApi.open.mockResolvedValue(ok(snapshot()));mockApi.recoverTurn.mockImplementation(async(_cid,key)=>ok({...recovery(),clientRequestId:key}));
 mockApi.send.mockResolvedValue({ok:false,kod:'UNKNOWN',poruka:'Ishod nije potvrđen'});mockApi.cancelTurn.mockImplementation(async()=>{mockApi.recoverTurn.mockResolvedValue(ok(recovery('FAILED',{cancelled:true,canCancel:false,retryAllowed:false})));return ok(recovery('FAILED',{cancelled:true,canCancel:false,retryAllowed:false}));});
});
afterEach(async()=>{await act(async()=>tree?.unmount());});
it('accessible speech appends an editable profile message without dispatch; explicit Send uses the edited body',async()=>{
 await render();act(()=>shell().props.onChange('Već ukucano.'));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:'Radim vikendom.',isCurrent:()=>true,session:{mode:'accessible'}})).toBe(true));
 expect(shell().props.value).toBe('Već ukucano.\nRadim vikendom.');expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.save).not.toHaveBeenCalled();
 act(()=>shell().props.onChange('Radim subotom od 10.'));await act(async()=>shell().props.onSend());
 expect(mockApi.send).toHaveBeenCalledTimes(1);expect(mockApi.send.mock.calls[0][1]).toBe('Radim subotom od 10.');
});
it('speech cannot overfill or overwrite a profile draft',async()=>{
 await render();act(()=>shell().props.onChange('a'.repeat(3999)));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:'Još.',isCurrent:()=>true,session:{mode:'accessible'}})).toBe(false));
 expect(shell().props.value).toBe('a'.repeat(3999));expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.save).not.toHaveBeenCalled();
});
it.each(['stale-capture','blur-refocus','account-ABA'] as const)('late profile speech from %s cannot fill a new composer',async reason=>{
 await render();act(()=>shell().props.onChange('Aktuelni tekst'));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 if(reason==='blur-refocus'){await act(async()=>{mockFocused=false;tree.update(<Screen/>);});await act(async()=>{mockFocused=true;tree.update(<Screen/>);});}
 if(reason==='account-ABA'){await act(async()=>{mockRevision=3;tree.update(<Screen/>);});}
 const before=shell().props.value;
 for(const mode of ['accessible','hold'])await act(async()=>expect(receive({text:'stari privatni govor',isCurrent:()=>reason!=='stale-capture',session:{mode}})).toBe(false));
 expect(shell().props.value).toBe(before);expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.save).not.toHaveBeenCalled();
});
// Owner, 2026-09-23: what is said while the microphone is held is the message. It goes out through the same send as the
// button (journal first, then one provider call with its own key), and the typed draft stays where it is.
it('held speech is sent as its own profile message on release, through the journal and the send path',async()=>{
 await render();act(()=>shell().props.onChange('Već ukucano.'));
 const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:' Radim vikendom. ',isCurrent:()=>true,session:{mode:'hold'}})).toBe(true));
 expect(mockJournal.save).toHaveBeenCalledTimes(1);expect(mockApi.send).toHaveBeenCalledTimes(1);
 expect(mockJournal.save.mock.invocationCallOrder[0]).toBeLessThan(mockApi.send.mock.invocationCallOrder[0]);
 expect(mockApi.send.mock.calls[0][1]).toBe('Radim vikendom.');expect(mockApi.send.mock.calls[0][2]).toBe(mockJournal.save.mock.calls[0][0].clientRequestId);
 expect(shell().props.value).toBe('Već ukucano.');
 // The attempt is unconfirmed: more held speech is refused rather than starting a second provider call.
 const again=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(again({text:'Još nešto.',isCurrent:()=>true,session:{mode:'hold'}})).toBe(false));
 expect(mockApi.send).toHaveBeenCalledTimes(1);
});
it('held speech that is empty or over the limit is refused without a send',async()=>{
 await render();const receive=(mockVoiceHook.mock.calls.at(-1)![0] as {onTranscript:(input:unknown)=>boolean}).onTranscript;
 await act(async()=>expect(receive({text:'   ',isCurrent:()=>true,session:{mode:'hold'}})).toBe(false));
 await act(async()=>expect(receive({text:'a'.repeat(4001),isCurrent:()=>true,session:{mode:'hold'}})).toBe(false));
 expect(mockJournal.save).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
});
it('keeps editing by hand and the week behind "···", and offers no menu when the proposal cannot be changed',async()=>{
 await render();expect(tree.root.findAllByProps({label:'Ručno uredi podatke'})).toHaveLength(0);
 await act(async()=>{shell().props.onOptions();});
 const row=(label:string)=>tree.root.findAll(node=>node.props.accessibilityRole==='menuitem'&&node.props.accessibilityLabel===label)[0];
 expect(row('Ručno uredi podatke').props.accessibilityState.disabled).toBe(false);
 expect(row('Uredi nedelju i posebne datume')).toBeDefined();
 await act(async()=>{row('Ručno uredi podatke').props.onPress();});
 expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);expect(tree.root.findAllByType('Manual' as never)).toHaveLength(1);
 await act(async()=>tree.unmount());mockApi.read.mockResolvedValue(ok({...snapshot(),stale:true}));await render();
 expect(shell().props.onOptions).toBeUndefined();
});
it('restores opaque pending key before any open or provider request and exposes safe cancel',async()=>{
 mockStored=intent();mockParams={};await render();expect(mockApi.open).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
 expect(mockApi.recoverTurn).toHaveBeenCalledWith(C,K);expect(mockRouter.setParams).toHaveBeenCalledWith({conversationId:C});
 expect(shell().props.canSend).toBe(false);expect(await manualDisabled()).toBe(true);
 expect(action('Otkaži prethodno slanje').props.disabled).toBe(false);expect(tree.root.findAllByProps({label:'Ponovi isto slanje'})).toHaveLength(0);
 await click('Otkaži prethodno slanje');expect(mockApi.cancelTurn).toHaveBeenCalledWith(C,K);expect(mockJournal.clear).toHaveBeenCalledWith(intent());expect(shell().props.canEdit).toBe(true);
});
it('lost preclaim response keeps typed body in memory and retries only the same persisted ID explicitly',async()=>{
 await render();act(()=>shell().props.onChange('Sačuvan samo u memoriji'));await act(async()=>{shell().props.onSend();});
 const key=mockApi.send.mock.calls[0][2];expect(mockJournal.save).toHaveBeenCalledWith({accountId:A,conversationId:C,clientRequestId:key});
 expect(JSON.stringify(mockJournal.save.mock.calls)).not.toContain('Sačuvan');expect(mockApi.send).toHaveBeenCalledTimes(1);
 expect(shell().props.value).toBe('Sačuvan samo u memoriji');expect(await manualDisabled()).toBe(true);
 await click('Ponovi isto slanje');expect(mockApi.send).toHaveBeenCalledTimes(2);expect(mockApi.send.mock.calls[1].slice(0,3)).toEqual(mockApi.send.mock.calls[0].slice(0,3));
});
it('a server without dispatched-exit capability cannot enable retry, cancellation or manual save',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:false,retryAllowed:false})));
 await render();expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.clear).not.toHaveBeenCalled();expect(await manualDisabled()).toBe(true);
 expect(tree.root.findAllByProps({label:'Otkaži prethodno slanje'})).toHaveLength(0);expect(tree.root.findAllByProps({label:'Ponovi isto slanje'})).toHaveLength(0);
 await click('Proveri stanje razgovora');expect(mockApi.send).not.toHaveBeenCalled();expect(action('Novi razgovor')).toBeTruthy();
});
it('canonical completed history retires key after restart without a provider call',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok({...snapshot(turn('SUCCEEDED')),messages:[{id:B,role:'USER',body:'Canonical text',sequence:1}]}));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('SUCCEEDED',{providerDispatched:true,canCancel:false,retryAllowed:false})));
 await render();expect(mockJournal.clear).toHaveBeenCalledWith(intent());expect(mockApi.send).not.toHaveBeenCalled();expect(shell().props.messages[0].body).toBe('Canonical text');expect(shell().props.canEdit).toBe(true);
});
it.each(['background','account'])('scope loss during journal write prevents network dispatch: %s',async how=>{
 let release!:(v?:unknown)=>void;mockJournal.save.mockImplementationOnce(()=>new Promise(r=>{release=r;}));await render();act(()=>shell().props.onChange('Unsaved text'));
 act(()=>shell().props.onSend());await flush();expect(mockJournal.save).toHaveBeenCalledTimes(1);
 await act(async()=>{if(how==='background')mockListeners.forEach(fn=>fn('background'));else{mockRevision++;tree.update(<Screen/>);}release();});
 expect(mockApi.send).not.toHaveBeenCalled();expect(mockJournal.clear).not.toHaveBeenCalled();
});
it('foreign account cannot restore or send the previous account key',async()=>{
 mockStored=intent();mockJournal.load.mockImplementation(async aid=>aid===A?mockStored:null);await render();
 await act(async()=>{mockAccount=B;mockRevision++;tree.update(<Screen/>);});expect(mockJournal.load).toHaveBeenLastCalledWith(B);expect(mockApi.send).not.toHaveBeenCalled();
 expect(mockJournal.clear).not.toHaveBeenCalled();
});
it('a still-unresolved server cancellation response retains journal and disabled draft',async()=>{
 mockStored=intent();await render();mockApi.cancelTurn.mockImplementationOnce(async()=>{const r=recovery('PROCESSING',{providerDispatched:true,canCancel:false,retryAllowed:false});mockApi.recoverTurn.mockResolvedValue(ok(r));return ok(r);});
 await click('Otkaži prethodno slanje');expect(mockJournal.clear).not.toHaveBeenCalled();expect(shell().props.canEdit).toBe(false);
});

it('confirmed cancellation preserves typed draft then permits safe editing',async()=>{
 await render();act(()=>shell().props.onChange('Retained draft'));await act(async()=>shell().props.onSend());
 await click('Otkaži prethodno slanje');expect(shell().props.value).toBe('Retained draft');expect(shell().props.canEdit).toBe(true);expect(mockApi.send).toHaveBeenCalledTimes(1);
});
it('explicit abandon clears dispatched journal only after exact canonical parent state',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:false,retryAllowed:false})));
 mockApi.abandon.mockImplementation(async()=>{mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{conversationStatus:'ABANDONED',providerDispatched:true,canCancel:false,retryAllowed:false})));
  mockApi.read.mockResolvedValue(ok({...snapshot(turn('UNKNOWN_OUTCOME')),status:'ABANDONED'}));return ok({...snapshot(),status:'ABANDONED'});});
 await render();await click('Novi razgovor');expect(mockJournal.clear).not.toHaveBeenCalled();
 expect(tree.root.findByType(ConfirmSheet).props).toMatchObject({title:'Pokrenuti nov razgovor?',cancelLabel:'Nastavi ovaj razgovor',confirmLabel:'Novi razgovor'});
 await answer('confirm-sheet-cancel');expect(sheets()).toHaveLength(0);expect(mockApi.abandon).not.toHaveBeenCalled();
 await click('Novi razgovor');await answer('confirm-sheet-confirm');expect(mockApi.abandon).toHaveBeenCalledTimes(1);expect(mockApi.abandon).toHaveBeenCalledWith(C);expect(mockJournal.clear).toHaveBeenCalledWith(intent());
 expect(mockRouter.replace).toHaveBeenCalledWith('/profil/razgovor');expect(mockApi.send).not.toHaveBeenCalled();
});
it('keeps the new-conversation question open with a busy confirm while the old one is abandoned, and closes it once that settles',async()=>{
 // The screen returns its command to the sheet; a `void` there would close the question before the command is sent.
 let settle!:(value:unknown)=>void;mockApi.abandon.mockImplementationOnce(()=>new Promise(done=>{settle=done;}));
 // A saved profile changed under this conversation: "Novi razgovor" is offered.
 mockApi.read.mockResolvedValue(ok({...snapshot(),stale:true}));
 await render();await click('Novi razgovor');await answer('confirm-sheet-confirm');
 expect(mockApi.abandon).toHaveBeenCalledTimes(1);expect(sheets()).toHaveLength(1);
 expect(tree.root.findByType(ConfirmSheet).findByProps({testID:'confirm-sheet-confirm'}).props.accessibilityState).toEqual({disabled:true,busy:true});
 mockApi.read.mockResolvedValue(ok({...snapshot(),status:'ABANDONED'}));
 await act(async()=>settle(ok({...snapshot(),status:'ABANDONED'})));
 expect(sheets()).toHaveLength(0);expect(mockRouter.replace).toHaveBeenCalledWith('/profil/razgovor');
});

it.each([{safety:'BLOCK'},{safety:'REVIEW'},{stale:true},{status:'ABANDONED'},{status:'COMPLETED'}])('revokes microphone scope whenever its visible composer becomes unavailable: %p',async state=>{
 await render();expect((mockVoiceHook.mock.calls.at(-1) as unknown[])[0]).toMatchObject({conversationId:C});
 mockApi.read.mockResolvedValue(ok({...snapshot(),...state}));
 await act(async()=>{mockFocused=false;tree.update(<Screen/>);});await act(async()=>{mockFocused=true;tree.update(<Screen/>);});
 expect((mockVoiceHook.mock.calls.at(-1) as unknown[])[0]).toMatchObject({conversationId:null});expect(shell().props.voice).toBeUndefined();
});
it('retains microphone command scope during a legitimate pending turn',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn())));mockApi.recoverTurn.mockResolvedValue(ok(recovery('PROCESSING',{providerDispatched:true,canCancel:false,retryAllowed:false})));
 await render();expect((mockVoiceHook.mock.calls.at(-1) as unknown[])[0]).toMatchObject({conversationId:C});
});
it('dispatched unknown exposes explicit exit with cost copy and requires canonical readback before a fresh message',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:true,retryAllowed:false})));
 await render();expect(action('Odustani od odgovora').props.disabled).toBe(false);
 expect(visibleText()).toContain('taj pokušaj se ipak računa');expect(shell().props.canEdit).toBe(false);
 mockApi.cancelTurn.mockImplementationOnce(async()=>{const value=recovery('FAILED',{providerDispatched:true,cancelled:true,canCancel:false,retryAllowed:false});
  mockApi.recoverTurn.mockResolvedValue(ok(value));mockApi.read.mockResolvedValue(ok(snapshot(turn('FAILED'))));return ok(value);});
 await click('Odustani od odgovora');expect(mockJournal.clear).toHaveBeenCalledWith(intent());expect(shell().props.canEdit).toBe(true);
 expect(mockApi.send).not.toHaveBeenCalled();act(()=>shell().props.onChange('Nova izričita poruka'));await act(async()=>shell().props.onSend());
 expect(mockApi.send).toHaveBeenCalledTimes(1);expect(mockApi.send.mock.calls[0][2]).not.toBe(K);
});
it('lost dispatched exit ACK stays blocked until remount recovers the same cancelled request',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:true,retryAllowed:false})));
 mockApi.cancelTurn.mockResolvedValueOnce({ok:false,kod:'UNKNOWN',poruka:'Ishod nije potvrđen'});
 await render();await click('Odustani od odgovora');expect(mockJournal.clear).not.toHaveBeenCalled();expect(shell().props.canEdit).toBe(false);
 await act(async()=>tree.unmount());mockApi.recoverTurn.mockResolvedValue(ok(recovery('FAILED',{providerDispatched:true,cancelled:true,canCancel:false,retryAllowed:false})));
 mockApi.read.mockResolvedValue(ok(snapshot(turn('FAILED'))));await render();expect(mockJournal.clear).toHaveBeenCalledWith(intent());
 expect(shell().props.canEdit).toBe(true);expect(mockApi.send).not.toHaveBeenCalled();
});
it('completion winning the exit race keeps the actual completed profile proposal visible',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:true,retryAllowed:false})));await render();
 mockApi.cancelTurn.mockImplementationOnce(async()=>{const value=recovery('SUCCEEDED',{providerDispatched:true,canCancel:false,retryAllowed:false});
  mockApi.recoverTurn.mockResolvedValue(ok(value));mockApi.read.mockResolvedValue(ok({...snapshot(turn('SUCCEEDED')),messages:[{id:B,role:'ASSISTANT',body:'Stvarni završen odgovor'}]}));return ok(value);});
 await click('Odustani od odgovora');expect(shell().props.messages).toEqual([{id:B,fromAi:true,body:'Stvarni završen odgovor'}]);
 expect(visibleText()).not.toContain('Odgovor je otkazan i podaci su ostali nepromenjeni');expect(mockJournal.clear).toHaveBeenCalledWith(intent());
 expect(mockApi.send).not.toHaveBeenCalled();
});
it('late dispatched exit after account reincarnation cannot clear the old journal or update the new screen',async()=>{
 mockStored=intent();mockApi.read.mockResolvedValue(ok(snapshot(turn('UNKNOWN_OUTCOME'))));
 mockApi.recoverTurn.mockResolvedValue(ok(recovery('UNKNOWN_OUTCOME',{providerDispatched:true,canCancel:true,retryAllowed:false})));await render();
 let release!:(value:unknown)=>void;mockApi.cancelTurn.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 act(()=>action('Odustani od odgovora').props.onPress());await flush();
 await act(async()=>{mockRevision++;tree.update(<Screen/>);});
 await act(async()=>release(ok(recovery('FAILED',{providerDispatched:true,cancelled:true,canCancel:false,retryAllowed:false}))));
 expect(mockJournal.clear).not.toHaveBeenCalled();expect(mockApi.send).not.toHaveBeenCalled();
});
