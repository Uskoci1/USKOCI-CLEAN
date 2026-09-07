jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { createAiNeedV2Service, mapAiNeedReview } from '../aiNeedV2Production';
import { conversation, deferred, fact, id } from './fixtures/ai-v2';
const context = () => ({accountId:id(1),isCurrent:jest.fn(()=>true)});
function setup() {
 const auth = jest.fn().mockResolvedValue({data:{user:{id:id(1)}},error:null});
 const invoke = jest.fn().mockResolvedValue({data:{schemaVersion:'NEED_FACT_V2',predlozeno:1},error:null});
 const rpc = jest.fn().mockResolvedValue({data:null,error:null});
 const builder:any = {select:jest.fn(),eq:jest.fn(),maybeSingle:jest.fn().mockResolvedValue({data:{id:id(4)},error:null})};
 builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder);
 const from = jest.fn(()=>builder);
 const service = createAiNeedV2Service(()=>({auth:{getUser:auth},functions:{invoke},rpc,from} as any));
 return {service,auth,invoke,rpc,builder,from};
}
const httpError = (status:number,code:string) => ({context:{status,clone:()=>({json:async()=>({code,message:'private provider raw payload'})})}});
describe('AI production port',()=>{
 it.each([[503,'AI_PROVIDER_NOT_CONFIGURED'],[400,'MESSAGE_INVALID'],[502,'CONVERSATION_CONTEXT_FAILED'],[401,'AUTH_REQUIRED']])('known pre-persist %s/%s retains code as rejected',async(status,code)=>{
  const {service,invoke}=setup(); invoke.mockResolvedValue({data:null,error:httpError(Number(status),String(code))});
  const result=await service.sendMessage(id(2),'generic',context());
  expect(result).toMatchObject({ok:false,kod:code,outcome:'rejected'}); expect(JSON.stringify(result)).not.toContain('private provider');
 });
 it.each([[502,'AI_TURN_PERSIST_FAILED'],[502,'AI_PROVIDER_FAILED'],[500,'AI_PROVIDER_NOT_CONFIGURED'],[400,'unexpected']])('uncertain %s/%s is never blindly replayable',async(status,code)=>{
  const {service,invoke}=setup(); invoke.mockResolvedValue({data:null,error:httpError(Number(status),String(code))});
  expect(await service.sendMessage(id(2),'generic',context())).toMatchObject({ok:false,outcome:'unknown'});
 });
 it('unreadable error response and malformed success are unknown',async()=>{
  const {service,invoke}=setup(); invoke.mockResolvedValueOnce({error:{context:{status:503,clone(){throw Error('payload');}}}});
  expect(await service.sendMessage(id(2),'generic',context())).toMatchObject({outcome:'unknown'});
  invoke.mockResolvedValueOnce({data:{schemaVersion:'NEED_FACT_V2',predlozeno:'1'}});
  expect(await service.sendMessage(id(2),'generic',context())).toMatchObject({outcome:'unknown'});
 });
 it('copies payload and actor before deferred auth; changed actor cannot invoke Edge',async()=>{
  const {service,auth,invoke}=setup(); const wait=deferred<any>(); auth.mockReturnValue(wait.promise);
  const scope=context(), work=service.sendMessage(id(2),'  captured  ',scope);
  scope.accountId=id(99); scope.isCurrent.mockReturnValue(false);
  wait.resolve({data:{user:{id:id(1)}},error:null}); expect(await work).toMatchObject({kod:'AUTH_CONTEXT_CHANGED'});
  expect(invoke).not.toHaveBeenCalled();
 });
 it('wrong authenticated account is rejected before any request',async()=>{
  const {service,auth,invoke}=setup(); auth.mockResolvedValue({data:{user:{id:id(99)}},error:null});
  expect(await service.sendMessage(id(2),'generic',context())).toMatchObject({kod:'AUTH_CONTEXT_CHANGED'});
  expect(invoke).not.toHaveBeenCalled();
 });
 it('draft profile read is account/kind/status scoped and stale completion cannot save',async()=>{
  const {service,builder,rpc}=setup(); const wait=deferred<any>(); builder.maybeSingle.mockReturnValue(wait.promise);
  const scope=context(); const work=service.saveDraft(id(2),'stable',scope); await Promise.resolve(); await Promise.resolve();
  scope.isCurrent.mockReturnValue(false); wait.resolve({data:{id:id(4)},error:null}); await work;
  expect(builder.eq.mock.calls).toEqual([['account_id',id(1)],['kind','REQUESTER'],['profile_status','ACTIVE']]);
  expect(rpc).not.toHaveBeenCalled();
 });
 it('maps server BLOCK refusal as known rejected, never raw SQL detail',async()=>{
  const {service,rpc}=setup(); rpc.mockResolvedValue({error:{code:'P0001',message:'AI_NEED_DRAFT_BLOCKED'}});
  expect(await service.saveDraft(id(2),'stable',context())).toMatchObject({kod:'AI_NEED_DRAFT_BLOCKED',outcome:'rejected'});
 });
 it('captures correction array before auth and rejects invalid serialization without RPC',async()=>{
  const {service,auth,rpc}=setup(); const wait=deferred<any>(); auth.mockReturnValueOnce(wait.promise);
  rpc.mockResolvedValue({data:id(11),error:null}); const value=['van']; const work=service.correctFact(id(10),value,'van',context()); value.push('later');
  wait.resolve({data:{user:{id:id(1)}},error:null}); await work;
  expect(rpc.mock.calls[0][1].p_value).toEqual(['van']);
  rpc.mockClear(); expect(await service.correctFact(id(10),undefined,'invalid',context())).toMatchObject({kod:'INVALID_FACT'});
  expect(rpc).not.toHaveBeenCalled();
 });
 it('strict review retains canonical SYSTEM_DERIVED and every optional proposal',()=>{
  const f=fact('need.required_vehicles',['van'],{source:'SYSTEM_DERIVED',status:'NEEDS_CONFIRMATION'});
  const result=mapAiNeedReview({...conversation([f]).review,facts:[f]},id(2)); expect(result.facts).toEqual([f]);
 });
 it('real read uses authoritative review safety, with messages and review scoped to one conversation',async()=>{
  const {service,builder,rpc}=setup();
  builder.maybeSingle.mockResolvedValue({data:{id:id(2),fact_schema_version:'NEED_FACT_V2'},error:null});
  builder.order=jest.fn().mockResolvedValue({data:[{id:id(20),role:'ASSISTANT',body:'Historical reply',safety:'ALLOW'}],error:null});
  rpc.mockResolvedValue({data:{...conversation().review,safety:'BLOCK',canSaveDraft:false},error:null});
  const result=await service.loadConversation(id(2),context());
  expect(result?.safety).toBe('BLOCK'); expect(result?.review.canSaveDraft).toBe(false);
  expect(builder.eq.mock.calls).toEqual([['id',id(2)],['purpose','NEED_INTAKE'],['conversation_id',id(2)]]);
  expect(rpc).toHaveBeenCalledWith('rpc_ai_need_review_v2',{p_conversation_id:id(2)});
 });
 it('unavailable owner conversation never reads messages/review',async()=>{
  const {service,builder,rpc}=setup();builder.maybeSingle.mockResolvedValue({data:null,error:null});
  expect(await service.loadConversation(id(2),context())).toBeNull();expect(rpc).not.toHaveBeenCalled();
 });
 it('account change while conversation header is pending prevents subsequent reads',async()=>{
  const {service,builder,rpc}=setup();const scope=context(), wait=deferred<any>();
  builder.maybeSingle.mockReturnValue(wait.promise);const work=service.loadConversation(id(2),scope);
  await Promise.resolve();await Promise.resolve();scope.isCurrent.mockReturnValue(false);
  wait.resolve({data:{id:id(2),fact_schema_version:'NEED_FACT_V2'},error:null});
  await expect(work).rejects.toThrow('AI_AUTH_CONTEXT_CHANGED');expect(rpc).not.toHaveBeenCalled();
 });
 it.each([
  {canSaveDraft:'false'}, {safety:undefined}, {missingRequired:['unknown.key']},
  {facts:[fact('need.title','x',{source:'SYSTEM' as any})]},
  {facts:[fact(),fact()]}, {safety:'BLOCK',canSaveDraft:true},
 ])('fails closed on malformed/ambiguous review %j',patch=>{
  expect(()=>mapAiNeedReview({...conversation().review,...patch},id(2))).toThrow();
 });
});
