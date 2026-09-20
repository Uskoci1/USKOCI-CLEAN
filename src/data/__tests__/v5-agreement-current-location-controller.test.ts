import { createHash } from 'node:crypto';
import { AgreementLocationController } from '../../ui/agreements/AgreementLocationController';
import { parseLocationJournal, type AgreementLocationContext, type LocationJournal } from '../agreementCurrentLocationService';
import type { CurrentLocationResult } from '../nativeCurrentLocation';
jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({})}));
jest.mock('../../store/sesija',()=>({sesijaSada:()=>({})}));
const A='10000000-0000-4000-8000-000000000001',ID='20000000-0000-4000-8000-000000000001',KEY='30000000-0000-4000-8000-000000000001';
const account={accountId:A,accountRevision:7};
const point={latitude:45.250123,longitude:19.850456,accuracyMeters:7,capturedAt:'2026-09-13T12:00:00.123Z'};
const ok=(podatak:unknown)=>({ok:true,podatak}),unknown={ok:false,kod:'LOCATION_UNCONFIRMED',poruka:'Ishod nije potvrđen.'};
const base=(role:'WORKER'|'REQUESTER'='WORKER'):AgreementLocationContext=>({agreementId:ID,agreementVersion:4,role,
 canShare:role==='WORKER',canRequest:role==='REQUESTER',point:null,requestedAt:null,authoritative:true});
const journal=(kind:'SHARE'|'REQUEST'='SHARE'):LocationJournal=>({version:1,agreementId:ID,agreementVersion:4,clientRequestId:KEY,kind,inputSha256:'a'.repeat(64)});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
const flush=async()=>{for(let n=0;n<5;n++)await Promise.resolve();};
function fixture(raw:string|null=null,context=base()){
 let current=true;
 const storage={getItem:jest.fn().mockResolvedValue(raw),setItem:jest.fn().mockResolvedValue(undefined),removeItem:jest.fn().mockResolvedValue(undefined)};
 const service={read:jest.fn().mockResolvedValue(ok(context)),recover:jest.fn().mockResolvedValue(ok({found:false,command:null})),write:jest.fn().mockResolvedValue(unknown)};
 const capture=jest.fn().mockResolvedValue({kind:'POINT',point}),uuid=jest.fn().mockReturnValue(KEY);
 const controller=new AgreementLocationController({agreementId:ID,account,current:()=>current,storage,service:service as never,capture,uuid});
 return{controller,storage,service,capture,uuid,setCurrent:(next:boolean)=>{current=next;}};
}
it('REQUEST never acquires GPS and sends only null point after persisting the opaque identity',async()=>{
 const f=fixture(null,base('REQUESTER'));await f.controller.load();const gate=deferred<void>();f.storage.setItem.mockReturnValue(gate.promise);
 const pending=f.controller.send('REQUEST');void f.controller.send('REQUEST');expect(f.capture).not.toHaveBeenCalled();expect(f.service.write).not.toHaveBeenCalled();
 const raw=f.storage.setItem.mock.calls[0][1],j=JSON.parse(raw);expect(Object.keys(j).sort()).toEqual(['agreementId','agreementVersion','clientRequestId','inputSha256','kind','version']);
 const digest=createHash('sha256').update(JSON.stringify({agreementId:ID,agreementVersion:4,clientRequestId:KEY,kind:'REQUEST',point:null})).digest('hex');
 expect(j.inputSha256).toBe(digest);gate.resolve();await pending;expect(f.service.write).toHaveBeenCalledTimes(1);expect(f.service.write).toHaveBeenCalledWith(j,null,account);
 expect(f.controller.snapshot().phase).toBe('UNKNOWN');expect(f.storage.removeItem).not.toHaveBeenCalled();
});
it('SHARE captures once across duplicate taps and stores no coordinates or timestamp before the first network write',async()=>{
 const f=fixture();await f.controller.load();const capture=deferred<CurrentLocationResult>(),storage=deferred<void>();f.capture.mockReturnValue(capture.promise);f.storage.setItem.mockReturnValue(storage.promise);
 const pending=f.controller.send('SHARE');void f.controller.send('SHARE');expect(f.capture).toHaveBeenCalledTimes(1);expect(f.controller.snapshot().phase).toBe('CAPTURING');expect(f.storage.setItem).not.toHaveBeenCalled();
 capture.resolve({kind:'POINT',point});await flush();expect(f.storage.setItem).toHaveBeenCalledTimes(1);expect(f.service.write).not.toHaveBeenCalled();
 const raw=f.storage.setItem.mock.calls[0][1],j=parseLocationJournal(raw,ID);expect(raw).not.toMatch(/latitude|longitude|accuracy|capturedAt|45\.250123|19\.850456|2026-09-13/);
 const digest=createHash('sha256').update(JSON.stringify({agreementId:ID,agreementVersion:4,clientRequestId:KEY,kind:'SHARE',point})).digest('hex');expect(j.inputSha256).toBe(digest);
 storage.resolve();await pending;expect(f.service.write).toHaveBeenCalledWith(j,point,account);expect(f.service.write).toHaveBeenCalledTimes(1);expect(f.uuid).toHaveBeenCalledTimes(1);
});
it.each(['DENIED','CANCELLED','UNAVAILABLE','UNSUPPORTED'] as const)('does not persist or send after capture %s',async kind=>{
 const f=fixture();f.capture.mockResolvedValue({kind});await f.controller.load();await f.controller.send('SHARE');expect(f.controller.snapshot().phase).toBe('READY');
 expect(f.storage.setItem).not.toHaveBeenCalled();expect(f.service.write).not.toHaveBeenCalled();expect(f.uuid).not.toHaveBeenCalled();
});
it('an explicit stop wins over an already-resolved POINT awaiting its microtask continuation',async()=>{
 const f=fixture(),gate=deferred<CurrentLocationResult>();f.capture.mockReturnValue(gate.promise);await f.controller.load();const pending=f.controller.send('SHARE');
 gate.resolve({kind:'POINT',point});f.controller.stopCapture();expect(f.capture.mock.calls[0][0].aborted).toBe(true);await pending;
 expect(f.storage.setItem).not.toHaveBeenCalled();expect(f.service.write).not.toHaveBeenCalled();expect(f.controller.snapshot().phase).toBe('READY');
});
it.each(['SHARE','REQUEST'] as const)('restores unknown %s through read only without new capture, UUID or network write',async kind=>{
 const j=journal(kind),f=fixture(JSON.stringify(j));await f.controller.load();await f.controller.refresh();await f.controller.send(kind);
 expect(f.service.recover).toHaveBeenCalledTimes(2);expect(f.service.recover).toHaveBeenCalledWith(j,account);expect(f.service.read).not.toHaveBeenCalled();
 expect(f.capture).not.toHaveBeenCalled();expect(f.uuid).not.toHaveBeenCalled();expect(f.service.write).not.toHaveBeenCalled();expect(f.storage.setItem).not.toHaveBeenCalled();
 expect(f.storage.removeItem).not.toHaveBeenCalled();expect(f.controller.snapshot().phase).toBe('UNKNOWN');
});
it.each(['COMMITTED','CANCELLED'] as const)('cancel race uses the authoritative %s outcome and retains journal until acknowledgment',async state=>{
 const j=journal(),f=fixture(JSON.stringify(j));await f.controller.load();f.service.write.mockResolvedValue(ok({...j,state}));await f.controller.cancelUnknown();
 expect(f.service.write).toHaveBeenCalledWith(j,null,account,true);expect(f.capture).not.toHaveBeenCalled();expect(f.controller.snapshot().phase).toBe('CONFIRMED');
 expect(f.controller.snapshot().message).toContain(state==='COMMITTED'?'lokacija je podeljena':'zahtev je zaustavljen');expect(f.storage.removeItem).not.toHaveBeenCalled();
 await f.controller.acknowledge();expect(f.storage.removeItem).toHaveBeenCalledWith(f.controller.key);expect(f.service.read).toHaveBeenCalledTimes(1);expect(f.controller.snapshot().journal).toBeNull();
});
it('unknown cancellation keeps the exact original identity and only refreshes by read',async()=>{
 const j=journal(),f=fixture(JSON.stringify(j));await f.controller.load();await f.controller.cancelUnknown();await f.controller.refresh();
 expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',journal:j});expect(f.service.write).toHaveBeenCalledTimes(1);expect(f.storage.removeItem).not.toHaveBeenCalled();expect(f.capture).not.toHaveBeenCalled();
});
it('restored positive receipt is confirmed without GPS and remains durable until explicit acknowledgment',async()=>{
 const f=fixture(JSON.stringify(journal('REQUEST')));f.service.recover.mockResolvedValue(ok({found:true,command:{state:'COMMITTED'}}));
 await f.controller.load();expect(f.controller.snapshot().message).toContain('Molba za lokaciju');expect(f.service.write).not.toHaveBeenCalled();expect(f.capture).not.toHaveBeenCalled();expect(f.storage.removeItem).not.toHaveBeenCalled();
});
it.each(['broken JSON',JSON.stringify({...journal(),latitude:45}),JSON.stringify({...journal(),agreementId:KEY})])('keeps corrupt storage closed across refresh instead of replacing its unknown identity %#',async raw=>{
 const f=fixture(raw);await f.controller.load();expect(f.controller.snapshot().phase).toBe('ERROR');await f.controller.refresh();await f.controller.send('SHARE');
 expect(f.service.read).not.toHaveBeenCalled();expect(f.capture).not.toHaveBeenCalled();expect(f.storage.setItem).not.toHaveBeenCalled();expect(f.service.write).not.toHaveBeenCalled();expect(f.storage.removeItem).not.toHaveBeenCalled();
});
it('a storage failure prevents any unjournaled share write',async()=>{
 const f=fixture();await f.controller.load();f.storage.setItem.mockRejectedValue(new Error('Disk full'));await f.controller.send('SHARE');
 expect(f.service.write).not.toHaveBeenCalled();expect(f.controller.snapshot().phase).toBe('ERROR');
});
it.each(['capture','storage','network'] as const)('account or focus retirement fences late %s without clearing durable identity',async stage=>{
 const f=fixture();await f.controller.load();const gate=deferred<unknown>();
 if(stage==='capture')f.capture.mockReturnValue(gate.promise);else if(stage==='storage')f.storage.setItem.mockReturnValue(gate.promise);else f.service.write.mockReturnValue(gate.promise);
 const pending=f.controller.send('SHARE');await flush();f.setCurrent(false);f.controller.dispose();
 if(stage==='capture')expect(f.capture.mock.calls[0][0].aborted).toBe(true);
 gate.resolve(stage==='capture'?{kind:'POINT',point}:ok({state:'COMMITTED'}));await pending;
 expect(f.service.write).toHaveBeenCalledTimes(stage==='network'?1:0);expect(f.storage.removeItem).not.toHaveBeenCalled();expect(f.controller.snapshot().phase).toBe('LOADING');
});
it('ignores retained callbacks after dispose and removes subscriptions',async()=>{
 const f=fixture(),listener=jest.fn();const unsubscribe=f.controller.subscribe(listener);await f.controller.load();unsubscribe();f.controller.dispose();listener.mockClear();
 await f.controller.send('SHARE');await f.controller.refresh();await f.controller.cancelUnknown();expect(listener).not.toHaveBeenCalled();expect(f.capture).not.toHaveBeenCalled();expect(f.service.read).toHaveBeenCalledTimes(1);
});
it.each(['SHARE','REQUEST'] as const)('requires the current authoritative %s capability and never derives it from mere membership',async kind=>{
 const f=fixture(null,{...base(),canShare:false,canRequest:false});await f.controller.load();await f.controller.send(kind);expect(f.capture).not.toHaveBeenCalled();expect(f.storage.setItem).not.toHaveBeenCalled();expect(f.service.write).not.toHaveBeenCalled();
});
