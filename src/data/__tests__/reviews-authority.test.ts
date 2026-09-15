jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
import { reviewsClientService as service, REVIEW_TAGS, accountReputationLabel, type ReviewCommand } from '../reviewsClientService';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const D='dddddddd-dddd-4ddd-8ddd-dddddddddddd', K='cccccccc-cccc-4ccc-8ccc-cccccccccccc', R='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockRpc=jest.fn();
const command=(): ReviewCommand => ({ agreementId:D, targetAccountId:B, rating:5, tags:['RELIABLE','ON_TIME'], clientRequestId:K });
const receipt=()=>({ ...command(),tags:['ON_TIME','RELIABLE'],reviewId:R,reviewerAccountId:A,createdAt:'2026-09-12T10:00:00Z',idempotentReplay:false,authoritative:true });
const context=()=>({accountId:A,agreementId:D,targetAccountId:B,eligible:true,review:null,tagCatalog:{version:'PRE_V3_REVIEW_TAGS_V1',maxTags:3,tags:[...REVIEW_TAGS]},authoritative:true});
beforeEach(()=>{mockSession={user:{id:A},accountRevision:1};mockRpc.mockReset();});
it('captures one immutable review command and strips reciprocal/private extras',async()=>{
 mockRpc.mockResolvedValue({data:{...receipt(),reciprocalReviewed:true,privateNarrative:'SECRET'},error:null});
 const input=command();const pending=service.submit(input);input.rating=1;(input.tags as string[]).push('CAREFUL');
 expect(await pending).toEqual({ok:true,podatak:receipt()});
 expect(mockRpc).toHaveBeenCalledTimes(1);
 expect(mockRpc).toHaveBeenCalledWith('rpc_submit_agreement_review',{p_agreement_id:D,p_target_account_id:B,p_rating:5,p_tags:['ON_TIME','RELIABLE'],p_client_request_id:K});
});
it.each([0,6,1.5,NaN,Infinity,null,'4',true])('rejects non-integer/out-of-range rating %j before IO',async value=>{
 expect((await service.submit({...command(),rating:value} as never)).ok).toBe(false);expect(mockRpc).not.toHaveBeenCalled();
});
it.each([null,['INVENTED'],['RELIABLE','RELIABLE'],['RELIABLE',null],['RELIABLE','ON_TIME','CAREFUL','RESPECTFUL'],[['CAREFUL']]])('rejects malformed tags %j',async value=>{
 expect(await service.submit({...command(),tags:value} as never)).toMatchObject({ok:false,kod:'REVIEW_TAGS_INVALID'});expect(mockRpc).not.toHaveBeenCalled();
});
it.each([{agreementId:'bad'},{targetAccountId:A},{targetAccountId:'bad'},{clientRequestId:'bad'}])('rejects invalid review identity %j',async patch=>{
 expect((await service.submit({...command(),...patch})).ok).toBe(false);expect(mockRpc).not.toHaveBeenCalled();
});
it.each([{reviewId:'bad'},{agreementId:R},{reviewerAccountId:B},{targetAccountId:A},{rating:4},{tags:['CAREFUL']},{clientRequestId:R},{idempotentReplay:'true'},{createdAt:'invalid'},{authoritative:false}])('rejects unbound/malformed success %j',async patch=>{
 mockRpc.mockResolvedValue({data:{...receipt(),...patch},error:null});expect(await service.submit(command())).toMatchObject({ok:false,kod:'REVIEW_INVALID_RECEIPT'});
});
it('accepts immutable same-request replay without another client mutation',async()=>{
 mockRpc.mockResolvedValue({data:{...receipt(),idempotentReplay:true},error:null});
 expect(await service.submit(command())).toMatchObject({ok:true,podatak:{idempotentReplay:true}});expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('returns only own review context, never the peer reciprocal-review status',async()=>{
 mockRpc.mockResolvedValue({data:{...context(),counterpartReviewed:true},error:null});
 expect(await service.context(D)).toEqual({ok:true,podatak:context()});
 mockRpc.mockResolvedValue({data:{...context(),eligible:false,review:receipt()},error:null});
 expect(await service.context(D)).toMatchObject({ok:true,podatak:{eligible:false,review:receipt()}});
});
it.each([{accountId:B},{agreementId:R},{targetAccountId:A},{eligible:'yes'},{review:receipt()},{tagCatalog:{version:'OTHER'}},{authoritative:false}])('rejects foreign or inconsistent context %j',async patch=>{
 mockRpc.mockResolvedValue({data:{...context(),...patch},error:null});expect((await service.context(D)).ok).toBe(false);
});
it('keeps no reviews distinct from a fabricated zero rating',async()=>{
 const empty={accountId:B,reviewCount:0,averageRating:null,state:'NO_REVIEWS',authoritative:true} as const;
 mockRpc.mockResolvedValue({data:empty,error:null});expect(await service.reputation(B)).toEqual({ok:true,podatak:empty});
 expect(accountReputationLabel(empty)).toBe('Još nema ocena');
 mockRpc.mockResolvedValue({data:{...empty,averageRating:0},error:null});expect((await service.reputation(B)).ok).toBe(false);
});
it.each([{reviewCount:-1},{reviewCount:1.5},{averageRating:0},{averageRating:5.1},{averageRating:2.333},{averageRating:'4.5'},{state:'NO_REVIEWS'},{accountId:A}])('rejects fabricated aggregate %j',async patch=>{
 mockRpc.mockResolvedValue({data:{accountId:B,reviewCount:2,averageRating:4.5,state:'RATED',authoritative:true,...patch},error:null});
 expect((await service.reputation(B)).ok).toBe(false);
});
it('reads a role-independent deterministic account aggregate',async()=>{
 const r={accountId:B,reviewCount:7,averageRating:4.14,state:'RATED',authoritative:true};
 mockRpc.mockResolvedValue({data:{...r,workerAverage:1,requesterAverage:5},error:null});
 expect(await service.reputation(B)).toEqual({ok:true,podatak:r});
 expect(mockRpc).toHaveBeenCalledWith('rpc_get_account_reputation',{p_account_id:B});
});
it('keeps typed known failures, suppresses arbitrary SQL/provider messages and never blindly retries',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{message:'REVIEW_ALREADY_SUBMITTED'}});
 expect(await service.submit(command())).toMatchObject({ok:false,kod:'REVIEW_ALREADY_SUBMITTED'});
 mockRpc.mockResolvedValue({data:null,error:{message:'SQL_DETAIL_PRIVATE_TABLE_TOKEN'}});
 const result=await service.submit(command());expect(result).toMatchObject({ok:false,kod:'REVIEW_OUTCOME_UNKNOWN'});expect(JSON.stringify(result)).not.toContain('TOKEN');
 expect(mockRpc).toHaveBeenCalledTimes(2);
});
it('fences a late review after account switch including explicit original scope',async()=>{
 let resolve!:(value:unknown)=>void;mockRpc.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const pending=service.submit(command(),{accountId:A,accountRevision:1});mockSession={user:{id:B},accountRevision:2};
 resolve({data:receipt(),error:null});expect(await pending).toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
});
it('does not issue a read or write for a signed-out session',async()=>{
 mockSession={user:null,accountRevision:2};
 for(const operation of [()=>service.submit(command()),()=>service.context(D),()=>service.reputation(B)])
  expect(await operation()).toMatchObject({ok:false,kod:'AUTH_REQUIRED'});
 expect(mockRpc).not.toHaveBeenCalled();
});
