import { createHash } from 'node:crypto';
import { AgreementActionsController } from '../../ui/agreements/AgreementActionsController';
import { agreementPayloadHash, journalFor, normalizeAgreementCommand, parseJournal, type AgreementActionCommand } from '../../ui/agreements/agreementActionsModel';
import type { AgreementChangeSnapshot, AgreementChangeProposal } from '../agreementClientService';
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({}) }));
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const ID='20000000-0000-4000-8000-000000000001',PID='30000000-0000-4000-8000-000000000001',KEY='40000000-0000-4000-8000-000000000001';
const terms={priceRsd:3500,currency:'RSD' as const,scopeNote:'Važeći obim',startsAt:null,endsAt:null};
const proposal: AgreementChangeProposal={proposalId:PID,agreementId:ID,baseVersion:7,proposedBy:B,status:'PENDING',reason:'Dodatni posao',
 createdAt:'2026-09-13T10:00:00Z',respondedAt:null,respondedBy:null,termsAvailable:true,terms:{...terms,priceRsd:4000}};
const propose: AgreementActionCommand={kind:'PROPOSE',value:{dogovorId:ID,ocekivanaVerzija:7,clientRequestId:KEY,razlog:'Privatan razlog',izmena:{cenaIznos:4200,obim:'Privatan sadržaj'}}};
const cancel: AgreementActionCommand={kind:'CANCEL',agreementId:ID,version:7,reason:'Privatan razlog otkazivanja'};
const ok=(podatak:unknown)=>({ok:true,podatak}),unknown={ok:false,kod:'UNCONFIRMED',poruka:'Ishod nije potvrđen.'};
const base=():AgreementChangeSnapshot=>({agreementId:ID,agreementVersion:7,agreementStatus:'CONFIRMED',requesterAccountId:A,workerAccountId:B,terms,proposals:[],
 actions:{agreementId:ID,agreementVersion:7,accountId:A,authoritative:true,canProposeChange:true,canRespondChange:false,canWithdrawChange:false,
  canMarkWorkDone:false,canConfirmCompletion:false,canCancel:true}});
const receipt=(status='PENDING',proposedBy=A)=>ok({found:true,proposalId:PID,agreementId:ID,baseVersion:7,proposedBy,status});
function fixture(raw:string|null=null){
 let current=true,snapshot=base();
 const storage={getItem:jest.fn().mockResolvedValue(raw),setItem:jest.fn().mockResolvedValue(undefined),removeItem:jest.fn().mockResolvedValue(undefined)};
 const service={read:jest.fn().mockImplementation(()=>Promise.resolve(ok(snapshot))),readCommand:jest.fn().mockResolvedValue(ok({found:false})),
  propose:jest.fn().mockResolvedValue(unknown),respond:jest.fn().mockResolvedValue(unknown),withdraw:jest.fn().mockResolvedValue(unknown),cancel:jest.fn().mockResolvedValue(unknown)};
 const controller=new AgreementActionsController({agreementId:ID,account:{accountId:A,accountRevision:1},current:()=>current,storage,service:service as never});
 return {controller,service,storage,setCurrent:(value:boolean)=>{current=value;},setSnapshot:(value:AgreementChangeSnapshot)=>{snapshot=value;}};
}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
it.each(['','abc','čćšđž 😀','x'.repeat(55),'x'.repeat(56),'x'.repeat(63),'x'.repeat(64),'x'.repeat(65),'a'.repeat(10000)])('matches the independent SHA256 oracle for bounded UTF8 %p',input=>{
 expect(agreementPayloadHash(input)).toBe(createHash('sha256').update(input).digest('hex'));
});
it('normalizes reviewed text, hashes every changed field and stores only opaque command metadata',()=>{
 const normalized=normalizeAgreementCommand({...propose,value:{...propose.value,razlog:'  Privatan razlog  ',izmena:{obim:'  Privatan sadržaj ',cenaIznos:4200}}});
 expect(journalFor(normalized)).toEqual(journalFor(propose));
 for(const cmd of [propose,cancel,{kind:'RESPOND',proposal,accept:true},{kind:'WITHDRAW',proposal}] as AgreementActionCommand[]){
  const journal=journalFor(cmd),raw=JSON.stringify(journal);expect(Object.keys(journal)).toHaveLength(8);
  expect(raw).not.toMatch(/Privatan|Važeći|Dodatni|3500|4200|scopeNote|reason/);expect(parseJournal(raw,ID)).toEqual(journal);
 }
 expect(journalFor({...cancel,reason:'Drugi razlog'}).payloadHash).not.toBe(journalFor(cancel).payloadHash);
 expect(journalFor({...propose,value:{...propose.value,izmena:{cenaIznos:4300,obim:'Privatan sadržaj'}}}).payloadHash).not.toBe(journalFor(propose).payloadHash);
});
it('rejects malformed, wrong-account-key journal structure and excessive input without storing bodies',()=>{
 const journal=journalFor(propose);
 for(const patch of [{body:'PRIVATE'},{agreementId:B},{payloadHash:'not-a-hash'},{version:2},{proposalId:PID},{clientRequestId:null},{accept:true}])
  expect(()=>parseJournal(JSON.stringify({...journal,...patch}),ID)).toThrow();
 expect(()=>parseJournal('x'.repeat(2049),ID)).toThrow();expect(()=>agreementPayloadHash('x'.repeat(25001))).toThrow();
});
it('persists opaque identity before one write despite concurrent retained final taps; ACK alone is unknown',async()=>{
 const f=fixture(),gate=deferred<void>();await f.controller.load();f.storage.setItem.mockReturnValue(gate.promise);
 f.service.propose.mockResolvedValue(ok({proposalId:PID}));const first=f.controller.submit(propose);void f.controller.submit(propose);
 expect(f.service.propose).not.toHaveBeenCalled();expect(f.storage.setItem).toHaveBeenCalledTimes(1);
 expect(JSON.parse(f.storage.setItem.mock.calls[0][1])).toEqual(journalFor(propose));gate.resolve();await first;
 expect(f.service.propose).toHaveBeenCalledTimes(1);expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',canRetry:true,needsReentry:false});
 expect(f.storage.removeItem).not.toHaveBeenCalled();expect(f.service.readCommand).toHaveBeenCalledWith(ID,{clientRequestId:KEY},{accountId:A,accountRevision:1});
});
it('confirms a proposal only by its owned exact persisted key and never by an unrelated pending row',async()=>{
 const f=fixture();f.setSnapshot({...base(),proposals:[proposal]});await f.controller.load();
 await f.controller.submit(propose);expect(f.controller.snapshot().phase).toBe('UNKNOWN');
 f.service.readCommand.mockResolvedValue(receipt());await f.controller.refresh();expect(f.controller.snapshot().phase).toBe('CONFIRMED');
 expect(f.service.propose).toHaveBeenCalledTimes(1);await f.controller.acknowledge();expect(f.storage.removeItem).toHaveBeenCalledTimes(1);expect(f.controller.snapshot().phase).toBe('READY');
});
it.each([{agreementId:B},{baseVersion:8},{proposedBy:B}])('refuses mismatched persisted receipt %#',async patch=>{
 const f=fixture(JSON.stringify(journalFor(propose)));f.service.readCommand.mockResolvedValue(ok({...receipt().podatak as object,...patch}));
 await f.controller.load();expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',canRetry:false});expect(f.service.propose).not.toHaveBeenCalled();
});
it('restores by read only, accepts terminal original proposal receipt without auto writing or clearing it',async()=>{
 const f=fixture(JSON.stringify(journalFor(propose)));f.service.readCommand.mockResolvedValue(receipt('ACCEPTED'));
 await f.controller.load();expect(f.controller.snapshot().phase).toBe('CONFIRMED');expect(f.service.propose).not.toHaveBeenCalled();expect(f.storage.removeItem).not.toHaveBeenCalled();
});
it.each([propose,cancel])('restored absent command requires exact normalized body re-entry under the same identity %#',async original=>{
 const journal=journalFor(original),raw=JSON.stringify(Object.fromEntries(Object.entries(journal).reverse()));
 const f=fixture(raw);await f.controller.load();expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',needsReentry:true,canRetry:true});
 await f.controller.retry();expect(f.service.propose).not.toHaveBeenCalled();expect(f.service.cancel).not.toHaveBeenCalled();
 const wrong=original.kind==='PROPOSE'?{...original,value:{...original.value,razlog:'Други разлог'}}:{...original,reason:'Други разлог'};
 await f.controller.submit(wrong);expect(f.storage.setItem).not.toHaveBeenCalled();expect(f.controller.snapshot().error).toMatch(/razlikuje/);
 await f.controller.submit(original);expect(f.storage.setItem).toHaveBeenCalledTimes(1);
 expect(original.kind==='PROPOSE'?f.service.propose:f.service.cancel).toHaveBeenCalledTimes(1);
 expect(JSON.parse(f.storage.setItem.mock.calls[0][1])).toEqual(journal);expect(f.storage.removeItem).not.toHaveBeenCalled();
});
it('cannot retry after readback failure; explicit successful read licenses only the same in-memory command',async()=>{
 const f=fixture();await f.controller.load();f.service.readCommand.mockResolvedValue(unknown);await f.controller.submit(propose);
 expect(f.controller.snapshot().canRetry).toBe(false);await f.controller.retry();expect(f.service.propose).toHaveBeenCalledTimes(1);
 f.service.readCommand.mockResolvedValue(ok({found:false}));await f.controller.refresh();await f.controller.retry();
 expect(f.service.propose).toHaveBeenCalledTimes(2);expect(f.service.propose.mock.calls[0]).toEqual(f.service.propose.mock.calls[1]);
});
it.each([{kind:'RESPOND',proposal,accept:true},{kind:'RESPOND',proposal,accept:false},{kind:'WITHDRAW',proposal:{...proposal,proposedBy:A}}] as AgreementActionCommand[])
('restores exact reviewed server proposal and recovers response/withdrawal status %#',async command=>{
 const f=fixture(JSON.stringify(journalFor(command)));if(command.kind!=='RESPOND'&&command.kind!=='WITHDRAW')throw new Error();
 f.setSnapshot({...base(),proposals:[command.proposal]});f.service.readCommand.mockResolvedValue(receipt('PENDING',command.proposal.proposedBy));
 await f.controller.load();expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',needsReentry:false});
 await f.controller.retry();expect(command.kind==='RESPOND'?f.service.respond:f.service.withdraw).toHaveBeenCalledTimes(1);
 const status=command.kind==='WITHDRAW'?'WITHDRAWN':command.accept?'ACCEPTED':'REJECTED';f.service.readCommand.mockResolvedValue(receipt(status,command.proposal.proposedBy));
 await f.controller.refresh();expect(f.controller.snapshot().phase).toBe('CONFIRMED');
});
it('never restores altered terms from a matching proposal ID and does not claim another terminal outcome as its own',async()=>{
 const original:AgreementActionCommand={kind:'RESPOND',proposal,accept:true},f=fixture(JSON.stringify(journalFor(original)));
 f.setSnapshot({...base(),proposals:[{...proposal,terms:{...terms,priceRsd:9999}}]});f.service.readCommand.mockResolvedValue(receipt('PENDING',B));
 await f.controller.load();expect(f.controller.snapshot().needsReentry).toBe(true);await f.controller.retry();expect(f.service.respond).not.toHaveBeenCalled();
 f.service.readCommand.mockResolvedValue(receipt('WITHDRAWN',B));await f.controller.refresh();expect(f.controller.snapshot().phase).toBe('REJECTED');
});
it('cancellation waits for canonical CANCELLED, not a void transport ACK or disappearance',async()=>{
 const f=fixture();await f.controller.load();f.service.cancel.mockResolvedValue(ok({acknowledged:true}));await f.controller.submit(cancel);
 expect(f.controller.snapshot().phase).toBe('UNKNOWN');expect(f.service.readCommand).not.toHaveBeenCalled();
 f.setSnapshot({...base(),agreementStatus:'CANCELLED'});await f.controller.refresh();expect(f.controller.snapshot().phase).toBe('CONFIRMED');
});
it.each(['dispose','account'])('fences an in-flight command after %s; its opaque journal remains recoverable',async change=>{
 const f=fixture(),gate=deferred<unknown>();await f.controller.load();f.service.propose.mockReturnValue(gate.promise);
 const pending=f.controller.submit(propose);await Promise.resolve();await Promise.resolve();
 if(change==='dispose')f.controller.dispose();else f.setCurrent(false);
 gate.resolve(ok({proposalId:PID}));await pending;expect(f.service.read).toHaveBeenCalledTimes(1);
 expect(f.service.readCommand).not.toHaveBeenCalled();expect(f.storage.removeItem).not.toHaveBeenCalled();
});
it('storage failure prevents unjournaled mutation; known refusal stays settled until explicit acknowledgment',async()=>{
 const f=fixture();await f.controller.load();f.storage.setItem.mockRejectedValue(new Error('DISK_FULL'));await f.controller.submit(cancel);
 expect(f.service.cancel).not.toHaveBeenCalled();expect(f.controller.snapshot().phase).toBe('ERROR');
 const g=fixture();await g.controller.load();g.service.propose.mockResolvedValue({ok:false,kod:'VERSION_CONFLICT',poruka:'Uslovi su promenjeni.'});
 await g.controller.submit(propose);expect(g.controller.snapshot().phase).toBe('REJECTED');await g.controller.retry();expect(g.service.propose).toHaveBeenCalledTimes(1);
});
it('a requester cancel refused because the worker said done is settled, with the owner\'s words (PKG-031a)',async()=>{
 const f=fixture();await f.controller.load();
 f.service.cancel.mockResolvedValue({ok:false,kod:'AGREEMENT_WORK_REPORTED_DONE',poruka:'Radnik je javio da je posao gotov. Potvrdi završetak ili prijavi problem.'});
 await f.controller.submit(cancel);expect(f.controller.snapshot().phase).toBe('REJECTED');
 await f.controller.retry();expect(f.service.cancel).toHaveBeenCalledTimes(1);
});
it.each([{authoritative:false},{accountId:B},{canProposeChange:false}])('does not infer proposal capability from an active Agreement %#',async patch=>{
 const f=fixture();f.setSnapshot({...base(),actions:{...base().actions,...patch} as AgreementChangeSnapshot['actions']});await f.controller.load();
 await f.controller.submit(propose);expect(f.storage.setItem).not.toHaveBeenCalled();expect(f.service.propose).not.toHaveBeenCalled();
});
