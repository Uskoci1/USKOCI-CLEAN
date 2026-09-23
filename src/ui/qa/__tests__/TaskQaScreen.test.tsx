import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
const mockContext=jest.fn(),mockRead=jest.fn(),mockOwnerFeed=jest.fn(),mockPublicFeed=jest.fn(),mockAsk=jest.fn(),mockAnswer=jest.fn(),mockDisposition=jest.fn(),mockAiSubmit=jest.fn(),mockAiRecover=jest.fn(),mockAiCancel=jest.fn(),mockLoad=jest.fn(),mockSave=jest.fn(),mockClear=jest.fn();
const A='11111111-1111-4111-8111-111111111111',N='22222222-2222-4222-8222-222222222222',mockKey='33333333-3333-4333-8333-333333333333';
let mockOwner={user:{id:A},accountRevision:1};let mockApp:(value:string)=>void=()=>{};
jest.mock('../../../store/sesija',()=>({sesijaSada:()=>mockOwner,useSesija:()=>mockOwner}));
jest.mock('expo-router',()=>({useFocusEffect:(f:()=>unknown)=>require('react').useEffect(f,[f])}));
jest.mock('react-native',()=>{const o=jest.requireActual('react-native');return new Proxy(o,{get:(obj,k)=>['View','ActivityIndicator','KeyboardAvoidingView','TextInput'].includes(String(k))?k:k==='AppState'?{currentState:'active',addEventListener:(_e:string,f:(s:string)=>void)=>{mockApp=f;return{remove:jest.fn()};}}:Reflect.get(obj,k)});});
jest.mock('../../../data/qaRecoveryClientService',()=>({qaRecoveryClientService:{context:(...a:unknown[])=>mockContext(...a),read:(...a:unknown[])=>mockRead(...a)}}));
jest.mock('../../../data/preselectionQaClientService',()=>({preselectionQaClientService:{ownerQuestions:(...a:unknown[])=>mockOwnerFeed(...a),publicQa:(...a:unknown[])=>mockPublicFeed(...a),askQuestion:(...a:unknown[])=>mockAsk(...a),answerQuestion:(...a:unknown[])=>mockAnswer(...a),dispositionQuestion:(...a:unknown[])=>mockDisposition(...a)}}));
jest.mock('../../../data/qaSubmissionClientService',()=>({qaSubmissionClientService:{submit:(...a:unknown[])=>mockAiSubmit(...a),recover:(...a:unknown[])=>mockAiRecover(...a),cancel:(...a:unknown[])=>mockAiCancel(...a)}}));
jest.mock('../qaIntent',()=>({...jest.requireActual('../qaIntent'),qaIntentJournal:{load:(...a:unknown[])=>mockLoad(...a),save:(...a:unknown[])=>mockSave(...a),clear:(...a:unknown[])=>mockClear(...a)}}));
jest.mock('@react-native-async-storage/async-storage',()=>({}));
jest.mock('../../../lib/idempotencija',()=>({noviUuidZahtevId:()=>mockKey}));
jest.mock('../../settings/SettingsPresentation',()=>{const c=(name:string)=>({children,...props}:any)=>require('react').createElement(name,props,children);return Object.fromEntries(['SettingsScreen','SettingsIntro','SettingsPanel','SettingsText','SettingsAction'].map(n=>[n,c(n)]));});
import {TaskQaScreen} from '../TaskQaScreen';
import {qaTextHash} from '../qaTextHash';
const ok=(podatak:unknown)=>({ok:true,podatak});
const context=(patch={})=>({accountId:A,needId:N,needRevision:2,title:'Montaža police',mode:'PUBLIC',publicRevision:true,activeWorker:true,canAsk:false,canComposeAnswer:false,ratePolicyState:'NOT_READY',questionMaxChars:null,answerMaxChars:null,...patch});
const status=(patch={})=>({accountId:A,needId:N,clientRequestId:mockKey,classificationId:N,type:'ASK',needRevision:2,questionId:null,textSha256:qaTextHash('Da li ima lift?'),state:'PROCESSING',outcome:null,materiality:null,safeReasonCodes:[],canCancel:true,receipt:null,authoritative:true,...patch});
const absent=()=>status({classificationId:null,type:null,needRevision:null,textSha256:null,state:'ABSENT'});
const pending=()=>({type:'ASK',accountId:A,needId:N,needRevision:2,clientRequestId:mockKey,textSha256:qaTextHash('Da li ima lift?')});

it('technical classification cancellation explains failure and unlocks only explicit new input',async()=>{
 mockLoad.mockResolvedValue(pending());mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));
 mockAiRecover.mockResolvedValue(ok(status({state:'CANCELLED',canCancel:false,safeReasonCodes:['QA_PROCESSING_FAILED']})));
 await render();expect(allText()).toContain('Provera teksta nije uspela');
 expect(allText()).not.toContain('pravila su promenjeni');expect(mockClear).toHaveBeenCalledWith(A,N,mockKey);
 expect(mockAiSubmit).not.toHaveBeenCalled();expect(button('Pošalji pitanje')).toBeDefined();
});
let tree:ReactTestRenderer;
const button=(label:string)=>tree.root.findAll(n=>n.type==='SettingsAction' as React.ElementType).find(n=>n.props.label===label);
const allText=()=>tree.root.findAll(n=>typeof n.type==='string').flatMap(n=>n.children.filter(c=>typeof c==='string')).join(' ');
async function render(){await act(async()=>{tree=create(<TaskQaScreen needId={N} onBack={jest.fn()}/>);});}
async function type(value:string,label='Tekst pitanja'){await act(async()=>tree.root.findByProps({accessibilityLabel:label}).props.onChangeText(value));}
beforeEach(()=>{jest.clearAllMocks();mockOwner={user:{id:A},accountRevision:1};mockContext.mockResolvedValue(ok(context()));mockRead.mockResolvedValue(ok({found:false,command:null}));mockPublicFeed.mockResolvedValue(ok([]));mockOwnerFeed.mockResolvedValue(ok([]));mockLoad.mockResolvedValue(null);mockSave.mockResolvedValue(undefined);mockClear.mockResolvedValue(undefined);mockAiSubmit.mockResolvedValue({ok:false,kod:'QA_CLASSIFICATION_UNCONFIRMED',poruka:'Ishod nije potvrđen.'});mockAiRecover.mockResolvedValue(ok(absent()));mockAiCancel.mockResolvedValue(ok(status({state:'CANCELLED',canCancel:false})));});
afterEach(async()=>{await act(async()=>tree?.unmount());});
it('shows honest unavailable gate and never sends on entry',async()=>{await render();expect(allText()).toContain('Slanje novih pitanja trenutno nije dostupno');expect(button('Pošalji pitanje')).toBeUndefined();expect(mockAiSubmit).not.toHaveBeenCalled();});
it('restores key read first and absent does not automatically replay',async()=>{mockLoad.mockResolvedValue(pending());await render();expect(mockRead).toHaveBeenCalledWith(N,mockKey,{accountId:A,accountRevision:1});expect(mockAiSubmit).not.toHaveBeenCalled();await act(async()=>button('Ponovi isti zahtev')!.props.onPress());expect(mockAiSubmit).not.toHaveBeenCalled();expect(allText()).toContain('potpuno isti tekst');await type('Da li ima lift?','Isti tekst prethodne radnje');await act(async()=>button('Ponovi isti zahtev')!.props.onPress());expect(mockAiSubmit).toHaveBeenCalledWith({type:'ASK',needId:N,needRevision:2,text:'Da li ima lift?',clientRequestId:mockKey},{accountId:A,accountRevision:1});});
it('persists opaque command before one explicit double-tap dispatch',async()=>{mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();await type('Da li ima lift?');mockSave.mockImplementation(async()=>{expect(mockAiSubmit).not.toHaveBeenCalled();});const press=button('Pošalji pitanje')!.props.onPress;await act(async()=>{press();press();});expect(mockAiSubmit).toHaveBeenCalledTimes(1);expect(mockSave).toHaveBeenCalledWith(pending());});
it('durable storage failure and account ABA each prevent dispatch',async()=>{mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();await type('Da li ima lift?');let done!:()=>void;mockSave.mockReturnValue(new Promise<void>(r=>{done=r;}));await act(async()=>button('Pošalji pitanje')!.props.onPress());mockOwner={user:{id:A},accountRevision:3};await act(async()=>{done();});expect(mockAiSubmit).not.toHaveBeenCalled();});
it('background during persistence prevents any late send; resume only reads',async()=>{mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();await type('Da li ima lift?');let done!:()=>void;mockSave.mockReturnValue(new Promise<void>(r=>{done=r;}));await act(async()=>button('Pošalji pitanje')!.props.onPress());await act(async()=>{mockApp('background');done();});expect(mockAiSubmit).not.toHaveBeenCalled();mockLoad.mockResolvedValue(pending());await act(async()=>mockApp('active'));expect(mockAiSubmit).not.toHaveBeenCalled();expect(mockRead).toHaveBeenCalled();});
it('restores only exact receipt and states question is still awaiting answer',async()=>{mockLoad.mockResolvedValue(pending());mockRead.mockResolvedValue(ok({found:true,command:{type:'ASK',needRevision:2,textSha256:pending().textSha256,receipt:{questionId:mockKey,status:'PENDING_ANSWER',needRevision:2,idempotentReplay:true}}}));await render();expect(allText()).toContain('Javno se prikazuje kada stigne odgovor');expect(mockClear).toHaveBeenCalledWith(A,N,mockKey);expect(mockAiSubmit).not.toHaveBeenCalled();});
it('does not leak non-current answered feed when task changed during read',async()=>{mockPublicFeed.mockResolvedValue(ok([{questionId:mockKey,needRevision:1,questionText:'OLD_SECRET',answerText:'OLD',edited:false}]));await render();expect(allText()).not.toContain('OLD_SECRET');expect(allText()).toContain('Zadatak je izmenjen');});
it('owner sees pending first and explicit old revision without an answer action',async()=>{mockContext.mockResolvedValue(ok(context({mode:'OWNER',canComposeAnswer:true})));mockOwnerFeed.mockResolvedValue(ok([{questionId:mockKey,needRevision:1,questionText:'OLD',status:'PENDING_ANSWER',answerText:null,edited:false},{questionId:N,needRevision:2,questionText:'CURRENT',status:'PENDING_ANSWER',answerText:null,edited:false}]));await render();expect(allText().indexOf('CURRENT')).toBeLessThan(allText().indexOf('OLD'));expect(allText()).toContain('ne opisuju aktuelne uslove');expect(tree.root.findAll(n=>n.type==='SettingsAction' as React.ElementType&&n.props.label==='Odgovori')).toHaveLength(1);});
it('saved submit closure is retired after refresh',async()=>{mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();await type('Da li ima lift?');const old=button('Pošalji pitanje')!.props.onPress;await act(async()=>button('Osveži pitanja i ishod radnje')!.props.onPress());await act(async()=>old());expect(mockAiSubmit).not.toHaveBeenCalled();});
it('restored provider processing never offers replay and cancellation is explicit',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status()));await render();
 expect(mockAiSubmit).not.toHaveBeenCalled();expect(mockAiCancel).not.toHaveBeenCalled();expect(button('Ponovi isti zahtev')).toBeUndefined();
 await act(async()=>button('Odustani od ovog slanja')!.props.onPress());
 expect(mockAiCancel).toHaveBeenCalledWith({type:'ASK',needId:N,needRevision:2,clientRequestId:mockKey,textSha256:pending().textSha256},{accountId:A,accountRevision:1});
 expect(mockClear).toHaveBeenCalledWith(A,N,mockKey);expect(allText()).toContain('Slanje je otkazano');
});
it('canonical commit winning cancellation is shown as sent, never falsely cancelled',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status()));
 mockAiCancel.mockResolvedValue(ok(status({state:'COMMITTED',canCancel:false,outcome:'ALLOW',receipt:{questionId:mockKey,status:'PENDING_ANSWER',needRevision:2,idempotentReplay:true}})));
 await render();await act(async()=>button('Odustani od ovog slanja')!.props.onPress());
 expect(allText()).toContain('Pitanje je poslato');expect(allText()).not.toContain('Slanje je otkazano');expect(mockClear).toHaveBeenCalledTimes(1);
});
it('unknown cancellation keeps persisted intent and reads again without a new submit',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status()));mockAiCancel.mockResolvedValue({ok:false,kod:'UNKNOWN',poruka:'Nepotvrđeno'});
 await render();await act(async()=>button('Odustani od ovog slanja')!.props.onPress());
 expect(mockClear).not.toHaveBeenCalled();expect(mockAiSubmit).not.toHaveBeenCalled();expect(mockAiRecover.mock.calls.length).toBeGreaterThan(1);
});
it('ready classification only continues the same key with explicitly re-entered matching text',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status({state:'READY',outcome:'ALLOW'})));await render();
 expect(mockAiSubmit).not.toHaveBeenCalled();await type('Da li ima lift?','Isti tekst prethodne radnje');await act(async()=>button('Ponovi isti zahtev')!.props.onPress());
 expect(mockAiSubmit).toHaveBeenCalledTimes(1);expect(mockAsk).not.toHaveBeenCalled();
});
it('a mismatched classifier hash cannot clear the intent or offer retry/cancel',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status({textSha256:'f'.repeat(64)})));await render();
 expect(mockClear).not.toHaveBeenCalled();expect(button('Ponovi isti zahtev')).toBeUndefined();expect(button('Odustani od ovog slanja')).toBeUndefined();
});
it('material answer rejection directs the owner back to canonical Task edit without publishing',async()=>{
 const intent={...pending(),type:'ANSWER',questionId:N};mockLoad.mockResolvedValue(intent);
 mockAiRecover.mockResolvedValue(ok(status({type:'ANSWER',questionId:N,state:'REJECTED',outcome:'ALLOW',materiality:'MATERIAL',canCancel:false})));
 await render();expect(button('Nazad na zadatak radi izmene')).toBeDefined();expect(allText()).toContain('menja uslove zadatka');expect(mockAnswer).not.toHaveBeenCalled();expect(mockAiSubmit).not.toHaveBeenCalled();
});
it('a grey send button says why, and the reason leaves once the question is written',async()=>{
 mockContext.mockResolvedValue(ok(context({canAsk:true,ratePolicyState:'READY',questionMaxChars:500})));await render();
 expect(button('Pošalji pitanje')!.props.disabled).toBe(true);expect(allText()).toContain('Upiši pitanje pre slanja.');
 await type('Da li ima lift?');expect(button('Pošalji pitanje')!.props.disabled).toBe(false);expect(allText()).not.toContain('Upiši pitanje pre slanja.');
 expect(mockAiSubmit).not.toHaveBeenCalled();
});
it('leaving while cancellation awaits a receipt cannot clear newer local state',async()=>{
 mockLoad.mockResolvedValue(pending());mockAiRecover.mockResolvedValue(ok(status()));let resolve!:(v:unknown)=>void;
 mockAiCancel.mockReturnValue(new Promise(r=>{resolve=r;}));await render();await act(async()=>button('Odustani od ovog slanja')!.props.onPress());
 await act(async()=>{mockApp('background');resolve(ok(status({state:'CANCELLED',canCancel:false})));});expect(mockClear).not.toHaveBeenCalled();
});
