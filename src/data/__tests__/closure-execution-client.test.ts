jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({rpc:mockRpc})}));
jest.mock('../../store/sesija',()=>({sesijaSada:()=>mockOwner}));
import {closureExecutionClientService as service,closureClassLabels} from '../closureExecutionClientService';
const A='11111111-1111-4111-8111-111111111111',R='22222222-2222-4222-8222-222222222222',G='33333333-3333-4333-8333-333333333333',K='44444444-4444-4444-8444-444444444444';
let mockOwner={user:{id:A},accountRevision:1};const mockRpc=jest.fn();
const datasets=()=>Object.keys(closureClassLabels).map(dataClass=>({dataClass,action:'RETAIN_RESTRICTED',retentionSeconds:86400,trigger:'CLOSURE_REQUESTED',ruleSha256:'b'.repeat(64)}));
const review=()=>({accountId:A,requestId:R,revision:1,ready:true,policySha256:'a'.repeat(64),blockers:[],code:null,retainedDatasets:datasets(),authAction:'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED',mediaAction:'DELETE_OWNED_OBJECTS',authoritative:true});
const intent=()=>({kind:'START' as const,accountId:A,requestId:R,expectedRevision:1,clientRequestId:K,policySha256:'a'.repeat(64)});
const receipt=()=>({accountId:A,requestId:R,generation:G,state:'EXECUTING',policySha256:'a'.repeat(64),clientRequestId:K,idempotentReplay:false,authoritative:true});
beforeEach(()=>{mockRpc.mockReset();mockOwner={user:{id:A},accountRevision:1};});
it('copies one exact reviewed command and binds returned request/policy/generation',async()=>{mockRpc.mockResolvedValue({data:receipt(),error:null});const i=intent(),p=service.start(i);i.expectedRevision=9;expect((await p).ok).toBe(true);expect(mockRpc).toHaveBeenCalledWith('rpc_start_account_closure_execution',{p_expected_user_id:A,p_request_id:R,p_expected_revision:1,p_client_request_id:K,p_policy_sha256:'a'.repeat(64)});});
it('keeps absent exact-key outcome separate from authorization to submit',async()=>{mockRpc.mockResolvedValue({data:{accountId:A,clientRequestId:K,found:false,receipt:null,execution:null,authoritative:true},error:null});expect(await service.read(K)).toEqual({ok:true,podatak:{found:false,receipt:null,execution:null}});expect(mockRpc).toHaveBeenCalledTimes(1);});
it.each([{accountId:R},{revision:0},{policySha256:null},{retainedDatasets:[]},{blockers:['UNKNOWN']},{blockers:['RETENTION_HOLD']},{code:'CLOSURE_POLICY_NOT_READY'},{authAction:'HARD_DELETE'}])('rejects false readiness %j',async patch=>{mockRpc.mockResolvedValue({data:{...review(),...patch},error:null});expect((await service.review()).ok).toBe(false);});
it('accepts default closed readiness with no invented retention duration',async()=>{mockRpc.mockResolvedValue({data:{...review(),ready:false,policySha256:null,code:'CLOSURE_POLICY_NOT_READY',retainedDatasets:null},error:null});expect(await service.review()).toMatchObject({ok:true,podatak:{ready:false,retainedDatasets:null}});});
it('shows the media policy barrier without exposing its private evidence context or admitting destruction',async()=>{
 mockRpc.mockResolvedValue({data:{...review(),ready:false,code:'CLOSURE_BLOCKED',blockers:['MEDIA_EVIDENCE_POLICY_NOT_READY']},error:null});
 expect(await service.review()).toMatchObject({ok:true,podatak:{ready:false,blockers:['MEDIA_EVIDENCE_POLICY_NOT_READY']}});
 mockRpc.mockResolvedValue({data:{...review(),blockers:['MEDIA_EVIDENCE_POLICY_NOT_READY']},error:null});
 expect((await service.review()).ok).toBe(false);
});
it.each([{accountId:R},{requestId:G},{policySha256:'b'.repeat(64)},{state:'CLOSED'},{generation:null},{clientRequestId:G}])('rejects unrelated start receipt %j',async patch=>{mockRpc.mockResolvedValue({data:{...receipt(),...patch},error:null});expect((await service.start(intent())).ok).toBe(false);});
it('rejects ABA account receipt after the request crossed identity incarnation',async()=>{let done!:(v:unknown)=>void;mockRpc.mockReturnValue(new Promise(resolve=>{done=resolve;}));const p=service.start(intent());mockOwner={user:{id:A},accountRevision:3};done({data:receipt(),error:null});expect(await p).toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});});
it('does not expose arbitrary server narrative',async()=>{mockRpc.mockResolvedValue({data:null,error:{message:'PRIVATE_NARRATIVE'}});const r=await service.start(intent());expect(r).toMatchObject({ok:false,kod:'CLOSURE_OUTCOME_UNKNOWN'});expect(JSON.stringify(r)).not.toContain('PRIVATE_NARRATIVE');});
const erasedReview=()=>({...review(),adapterVersion:'OWNER_AF_D22_EVENT_ERASURE_V1',retainedDatasets:null,exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED'],mediaAction:'DELETE_UNPROTECTED_OWNED_OBJECTS',relationalAction:'ERASE_ORDINARY_PERSONAL_CONTENT'});
const erasureState=()=>({accountId:A,requestId:R,generation:G,state:'EXECUTING',policySha256:'a'.repeat(64),adapterVersion:'OWNER_AF_D22_EVENT_ERASURE_V1',ordinaryContentErased:true,completedSteps:74,totalSteps:74,exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED'],authoritative:true});
it('decodes approved event-bound partial erasure without inventing dates or claiming complete closure',async()=>{
 mockRpc.mockResolvedValue({data:erasedReview(),error:null});expect(await service.review()).toMatchObject({ok:true,podatak:{ready:true,retainedDatasets:null,exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED']}});
 mockRpc.mockResolvedValue({data:{accountId:A,clientRequestId:K,found:true,receipt:receipt(),execution:erasureState(),authoritative:true},error:null});
 expect(await service.read(K)).toMatchObject({ok:true,podatak:{execution:{state:'EXECUTING',ordinaryContentErased:true,exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED']}}});
});
it.each([{adapterVersion:'FUTURE'},{retainedDatasets:datasets()},{exceptions:['UNKNOWN']},{exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED','SCOPED_EVIDENCE_REVIEW_REQUIRED']},{relationalAction:'RETAIN_ALL'},{privateCase:'RAW'}])('rejects unreviewed erasure readiness %j',async patch=>{
 mockRpc.mockResolvedValue({data:{...erasedReview(),...patch},error:null});expect((await service.review()).ok).toBe(false);
});
it.each([{generation:R},{policySha256:'b'.repeat(64)},{completedSteps:75},{totalSteps:0},{ordinaryContentErased:false},{state:'CLOSED'},{exceptions:['CASE_ID']},{privateCopy:'RAW'}])('rejects conflicting erasure recovery %j',async patch=>{
 mockRpc.mockResolvedValue({data:{accountId:A,clientRequestId:K,found:true,receipt:receipt(),execution:{...erasureState(),...patch},authoritative:true},error:null});expect((await service.read(K)).ok).toBe(false);
});
it('accepts a complete AF22 receipt only with empty exceptions and the honest pseudonymous outcome',async()=>{
 const closed={accountId:A,requestId:R,generation:G,state:'CLOSED',policySha256:'a'.repeat(64),closedAt:'2026-09-13T09:00:00Z',adapterVersion:'OWNER_AF_D22_EVENT_ERASURE_V1',authOutcome:'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED',mediaOutcome:'OWNED_OBJECTS_DELETED',relationalOutcome:'ORDINARY_PERSONAL_CONTENT_ERASED',retainedDatasets:[],exceptions:[],pseudonymousAuditRetained:true,authoritative:true};
 mockRpc.mockResolvedValue({data:{accountId:A,clientRequestId:K,found:true,receipt:receipt(),execution:closed,authoritative:true},error:null});expect(await service.read(K)).toMatchObject({ok:true,podatak:{execution:{state:'CLOSED',ordinaryContentErased:true,pseudonymousAuditRetained:true}}});
 mockRpc.mockResolvedValue({data:{accountId:A,clientRequestId:K,found:true,receipt:receipt(),execution:{...closed,exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED']},authoritative:true},error:null});expect((await service.read(K)).ok).toBe(false);
});
