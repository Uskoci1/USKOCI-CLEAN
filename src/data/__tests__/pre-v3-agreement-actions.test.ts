import { agreementChangeService } from '../agreementClientService';
import type { IzmenaKomanda } from '../ports';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const ID='20000000-0000-4000-8000-000000000001',PID='30000000-0000-4000-8000-000000000001';
let mockAccount=A,mockRevision=1;const mockRpc=jest.fn(),mockFrom=jest.fn();
jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({rpc:mockRpc,from:mockFrom})}));
jest.mock('../../store/sesija',()=>({sesijaSada:()=>({user:{id:mockAccount},accountRevision:mockRevision})}));
const account={accountId:A,accountRevision:1};
const terms={price_rsd:3500,currency:'RSD',scope_note:'Dva ormara',proposed_start_at:null,proposed_end_at:null};
const actionState={agreementId:ID,agreementVersion:7,accountId:A,authoritative:true,
 canProposeChange:false,canRespondChange:true,canWithdrawChange:false,canMarkWorkDone:false,canConfirmCompletion:false,canCancel:true,
 pendingChanges:[{id:PID,baseVersion:7,proposedByAccountId:B,createdAt:'2026-09-11T15:00:00.123456Z',proposedTerms:terms,reason:null}]};
const workspace={id:ID,currentVersion:7,agreementStatus:'CONFIRMED',requesterAccountId:A,workerAccountId:B,terms,actionState};
const command:IzmenaKomanda={dogovorId:ID,ocekivanaVerzija:7,clientRequestId:'persisted-key',razlog:'Dodatni posao',izmena:{cenaIznos:3500}};
const ok=(data:unknown)=>({data,error:null});
beforeEach(()=>{mockRpc.mockReset();mockFrom.mockReset();mockAccount=A;mockRevision=1;mockRpc.mockResolvedValue(ok(workspace));});
afterEach(()=>jest.useRealTimers());
it('uses one workspace snapshot and echoes authoritative actions instead of inferring them from CONFIRMED',async()=>{
 const result=await agreementChangeService.read(ID,account);
 expect(result).toMatchObject({ok:true,podatak:{agreementId:ID,agreementVersion:7,actions:{canProposeChange:false,canRespondChange:true,
  canConfirmCompletion:false,canCancel:true,authoritative:true},proposals:[{proposalId:PID,status:'PENDING',termsAvailable:true}]}});
 expect(mockRpc.mock.calls).toEqual([['rpc_get_agreement_workspace',{p_agreement_id:ID}]]);expect(mockFrom).not.toHaveBeenCalled();
});
it('keeps unavailable historic terms unavailable without fabricating price or scope',async()=>{
 mockRpc.mockResolvedValue(ok({...workspace,terms:{...terms,price_rsd:'3500'},actionState:{...actionState,pendingChanges:[{
  ...actionState.pendingChanges[0],proposedTerms:{...terms,price_rsd:'3500'}}]}}));
 expect(await agreementChangeService.read(ID,account)).toMatchObject({ok:true,podatak:{terms:null,proposals:[{termsAvailable:false,terms:null}]}});
});
it('preserves a real null historic scope and absent currency without fabricating new terms',async()=>{
 mockRpc.mockResolvedValue(ok({...workspace,terms:{price_rsd:1,scope_note:null}}));
 expect(await agreementChangeService.read(ID,account)).toMatchObject({ok:true,podatak:{terms:{priceRsd:1,scopeNote:null,currency:'RSD'}}});
});
it.each([null,undefined])('returns NOT_READY for missing server capability authority %#',async actionState=>{
 mockRpc.mockResolvedValue(ok({...workspace,actionState}));
 expect(await agreementChangeService.read(ID,account)).toMatchObject({ok:false,kod:'AGREEMENT_CAPABILITIES_NOT_READY'});
});
it.each([{...actionState,accountId:B},{...actionState,agreementId:B},{...actionState,agreementVersion:8},
 {...actionState,canProposeChange:'true'},{...actionState,authoritative:false},{...actionState,pendingChanges:null},
 {...actionState,pendingChanges:[...actionState.pendingChanges,...actionState.pendingChanges]},
 {...actionState,pendingChanges:[{...actionState.pendingChanges[0],proposedByAccountId:ID}]},
 {...actionState,pendingChanges:[{...actionState.pendingChanges[0],baseVersion:8}]},
 {...actionState,pendingChanges:[{...actionState.pendingChanges[0],reason:7}]},
 {...actionState,pendingChanges:[{...actionState.pendingChanges[0],createdAt:'not-a-date'}]},
])('fails closed on mismatched, malformed or unbounded capability source %#',async actionState=>{
 mockRpc.mockResolvedValue(ok({...workspace,actionState}));
 expect(await agreementChangeService.read(ID,account)).toMatchObject({ok:false,kod:'AGREEMENT_CHANGE_INVALID'});
});
it('does not carry private/unrecognized server fields into public projection',async()=>{
 mockRpc.mockResolvedValue(ok({...workspace,serverSecret:'PRIVATE',actionState:{...actionState,serverSecret:'PRIVATE'}}));
 expect(JSON.stringify(await agreementChangeService.read(ID,account))).not.toContain('PRIVATE');
});
it.each([0,-1,1.25,2147483648,'3500',null])('refuses invalid price before IO %#',async price=>{
 expect(await agreementChangeService.propose({...command,izmena:{cenaIznos:price}} as IzmenaKomanda,account)).toMatchObject({ok:false,kod:'INVALID_PRICE'});
 expect(mockRpc).not.toHaveBeenCalled();
});
it.each([{izmena:{cenaValuta:'EUR'}},{izmena:{obim:[]}}, {izmena:{team_capacity:2}}, {izmena:[]},
 {izmena:{pocetakIso:'2026-09-15T12:00:00Z'}}, {izmena:{pocetakIso:'2026-02-30T12:00:00Z',krajIso:'2026-03-01T12:00:00Z'}},
 {razlog:'😀'.repeat(4001)}, {clientRequestId:'a'.repeat(201)}, {izmena:{obim:'x'.repeat(4001)}}])('refuses unsupported, one-sided or oversized input %#',async patch=>{
 expect((await agreementChangeService.propose({...command,...patch} as IzmenaKomanda,account)).ok).toBe(false);expect(mockRpc).not.toHaveBeenCalled();
});
it('retains exact retry key, version, reason and microsecond endpoints',async()=>{
 mockRpc.mockResolvedValue(ok(PID));const k={...command,izmena:{pocetakIso:'2026-10-25T02:30:00.000001+02:00',krajIso:'2026-10-25T02:30:00.000002+02:00'}};
 expect(await agreementChangeService.propose(k,account)).toEqual({ok:true,podatak:{proposalId:PID}});
 expect(mockRpc).toHaveBeenCalledWith('rpc_propose_agreement_change_v2',{p_agreement_id:ID,p_expected_version:7,p_client_request_id:'persisted-key',p_reason:'Dodatni posao',p_patch:{proposed_start_at:k.izmena.pocetakIso,proposed_end_at:k.izmena.krajIso}});
});
it.each(['AGREEMENT_CHANGE_AFTER_WORK_DONE','AGREEMENT_CHANGE_PENDING','VERSION_CONFLICT','WORKER_CALENDAR_CONFLICT'])('keeps typed server denials without SQL detail %s',async message=>{
 mockRpc.mockResolvedValue({data:null,error:{message,details:'PRIVATE_SQL'}});
 const result=await agreementChangeService.propose(command,account);expect(result).toMatchObject({ok:false,kod:message});expect(JSON.stringify(result)).not.toContain('PRIVATE_SQL');
});
it('does not claim unknown failed write was not committed or echo arbitrary error',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{message:'PRIVATE SQL / provider body'}});
 expect(await agreementChangeService.propose(command,account)).toMatchObject({ok:false,kod:'AGREEMENT_CHANGE_UNCONFIRMED'});
 expect(JSON.stringify(await agreementChangeService.propose(command,account))).not.toContain('PRIVATE');
});
it('retains exact response receipt and accepts idempotent replay on captured base rather than current version',async()=>{
 const snapshot=await agreementChangeService.read(ID,account);if(!snapshot.ok)throw new Error('TEST_FIXTURE');
 const p=snapshot.podatak.proposals[0];mockRpc.mockResolvedValue(ok({proposalId:PID,accepted:true,agreementVersion:8,authoritative:true}));
 expect(await agreementChangeService.respond(p,true,account)).toMatchObject({ok:true,podatak:{agreementVersion:8}});
 mockRpc.mockResolvedValue(ok({proposalId:PID,accepted:true,agreementVersion:9,authoritative:true}));
 expect(await agreementChangeService.respond(p,true,account)).toMatchObject({ok:false,kod:'AGREEMENT_CHANGE_INVALID'});
});
it('withdraws only with exact authoritative receipt; repeat stays on same proposal',async()=>{
 for(const replay of [false,true]){mockRpc.mockResolvedValue(ok({proposalId:PID,status:'WITHDRAWN',idempotentReplay:replay,authoritative:true}));
 expect(await agreementChangeService.withdraw(PID,account)).toMatchObject({ok:true,podatak:{idempotentReplay:replay}});}
 expect(mockRpc.mock.calls).toEqual(Array(2).fill(['rpc_withdraw_agreement_change',{p_proposal_id:PID}]));
 mockRpc.mockResolvedValue(ok({proposalId:B,status:'WITHDRAWN',idempotentReplay:true,authoritative:true}));
 expect(await agreementChangeService.withdraw(PID,account)).toMatchObject({ok:false,kod:'AGREEMENT_CHANGE_INVALID'});
});
it.each(['A-B','A-B-A'])('fences late read and late write for %s',async change=>{
 let resolve!:(v:unknown)=>void;mockRpc.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 const pending=agreementChangeService.read(ID,account);mockAccount=B;mockRevision=2;if(change==='A-B-A'){mockAccount=A;mockRevision=3;}
 resolve(ok(workspace));expect(await pending).toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});
 expect(await agreementChangeService.propose(command,account)).toMatchObject({ok:false,kod:'AUTH_ACCOUNT_CHANGED'});expect(mockRpc).toHaveBeenCalledTimes(1);
});
