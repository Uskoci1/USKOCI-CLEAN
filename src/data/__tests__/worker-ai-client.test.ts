import {workerAiClientService as service,decodeWorkerAiProfile,decodeWorkerAiReview,decodeWorkerAiSnapshot,type WorkerAiProfile,type WorkerAiReview,type WorkerAiSaved} from '../workerAiClientService';
const OWNER='11111111-1111-4111-8111-111111111111',OTHER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',CONVERSATION='22222222-2222-4222-8222-222222222222',
 PROFILE='33333333-3333-4333-8333-333333333333',REVIEW='44444444-4444-4444-8444-444444444444',KEY='55555555-5555-4555-8555-555555555555';
let mockSession={user:{id:OWNER},accountRevision:1};const mockRpc=jest.fn();
jest.mock('../../store/sesija',()=>({sesijaSada:()=>mockSession}));
jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({rpc:mockRpc})}));
const profile=():WorkerAiProfile=>({displayName:'Petar',bio:'Prenos stvari',skills:['Prenos'],tools:['Kolica'],vehicles:['Kombi'],licenses:[],teamCapacity:3,
 location:{operatingCountryCode:'RS',city:'Beograd',radiusKm:25,approximatePosition:null},availability:{timezone:'Europe/Belgrade',availableNow:true,rules:[],windows:[]}});
const review=():WorkerAiReview=>({schemaVersion:'WORKER_PROFILE_V1',reviewId:REVIEW,conversationId:CONVERSATION,accountId:OWNER,profileId:PROFILE,
 revision:2,profile:profile(),activate:true,missingRequired:[],canAccept:true,expiresAt:'2026-10-01T00:00:00Z',displayedContentDigest:'a'.repeat(64)});
const saved=():WorkerAiSaved=>({reviewId:REVIEW,conversationId:CONVERSATION,accountId:OWNER,profileId:PROFILE,profileStatus:'ACTIVE',saved:true,authoritative:true});
const snapshot=(done=false)=>({schemaVersion:'WORKER_PROFILE_V1',conversationId:CONVERSATION,accountId:OWNER,profileId:PROFILE,status:done?'COMPLETED':'OPEN',
 profileStatus:done?'ACTIVE':'DRAFT',revision:2,candidate:profile(),safety:'ALLOW',stale:done,messages:[],turn:null,review:review(),saved:done?saved():null});
beforeEach(()=>{mockSession={user:{id:OWNER},accountRevision:1};mockRpc.mockReset();mockRpc.mockImplementation(async(name:string)=>({error:null,data:
 name==='rpc_prepare_worker_ai_review'?review():name==='rpc_save_worker_ai_review'?saved():snapshot()}));});
it('single profile review does not invoke canonical save or per-field confirmation',async()=>{
 await expect(service.prepare(CONVERSATION,2,true)).resolves.toEqual({ok:true,podatak:review()});expect(mockRpc.mock.calls.map(x=>x[0])).toEqual(['rpc_prepare_worker_ai_review']);
});
it('explicit save sends only immutable server review identity/digest and one command key',async()=>{
 await expect(service.save(review(),KEY)).resolves.toEqual({ok:true,podatak:saved()});expect(mockRpc).toHaveBeenCalledTimes(1);
 expect(mockRpc).toHaveBeenCalledWith('rpc_save_worker_ai_review',{p_review_id:REVIEW,p_displayed_digest:'a'.repeat(64),p_client_request_id:KEY});
});
it('out-of-owner review and copied task-fact schema cannot become a write',async()=>{
 await expect(service.save({...review(),accountId:OTHER},KEY)).resolves.toMatchObject({ok:false});
 expect(decodeWorkerAiReview({...review(),schemaVersion:'NEED_FACT_V2'},OWNER,CONVERSATION)).toBeNull();expect(mockRpc).not.toHaveBeenCalled();
});
it('late response after account round trip is discarded',async()=>{
 mockRpc.mockImplementation(async()=>{mockSession={user:{id:OWNER},accountRevision:3};return{data:saved(),error:null};});
 await expect(service.save(review(),KEY)).resolves.toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
});
it('lost response recovers completed immutable review and saved receipt from server',async()=>{
 mockRpc.mockRejectedValueOnce(new Error('LOST_ACK'));await expect(service.save(review(),KEY)).resolves.toMatchObject({ok:false});
 mockRpc.mockResolvedValueOnce({data:snapshot(true),error:null});await expect(service.read(CONVERSATION)).resolves.toMatchObject({ok:true,podatak:{status:'COMPLETED',saved:saved()}});
 expect(mockRpc.mock.calls.map(x=>x[0])).toEqual(['rpc_save_worker_ai_review','rpc_read_worker_ai']);
});
it.each([{profileStatus:'DRAFT'},{profileId:OTHER},{reviewId:OTHER},{saved:false}])('rejects incomplete or foreign final receipt %p',async patch=>{
 mockRpc.mockResolvedValue({data:{...saved(),...patch},error:null});await expect(service.save(review(),KEY)).resolves.toMatchObject({ok:false,kod:'WORKER_AI_INVALID_RESPONSE'});
});
it('profile supports draft empty country/city and rejects hidden verification/precision fields',()=>{
 expect(decodeWorkerAiProfile({...profile(),location:{operatingCountryCode:null,city:'',radiusKm:15,approximatePosition:null}})).not.toBeNull();
 expect(decodeWorkerAiProfile({...profile(),verifiedIdentity:true})).toBeNull();
 expect(decodeWorkerAiProfile({...profile(),location:{...profile().location,approximatePosition:{latitude:44.8123,longitude:20.46}}})).toBeNull();
});
it('review labels remain truthful and profile conversation receipts cannot cross owners',()=>{
 expect(decodeWorkerAiReview({...review(),missingRequired:['Ime'],canAccept:true},OWNER,CONVERSATION)).toBeNull();
 expect(decodeWorkerAiSnapshot({...snapshot(),accountId:OTHER},OWNER)).toBeNull();
 expect(decodeWorkerAiSnapshot({...snapshot(true),saved:{...saved(),profileId:OTHER}},OWNER)).toBeNull();
});
it('unsafe SQL details stay out of owner-facing errors',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{message:'WORKER_AI_STALE',details:'PRIVATE_SQL_SENTINEL'}});
 const result=await service.save(review(),KEY);expect(result).toMatchObject({ok:false,kod:'WORKER_AI_STALE'});expect(JSON.stringify(result)).not.toContain('PRIVATE_SQL_SENTINEL');
});
