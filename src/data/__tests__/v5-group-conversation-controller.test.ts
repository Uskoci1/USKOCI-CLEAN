jest.mock('../supabaseClient',()=>({supabaseKlijent:()=>({})}));
jest.mock('../../store/sesija',()=>({sesijaSada:()=>({})}));
import { GroupConversationController } from '../../ui/groups/GroupConversationController';
import { groupBodyHash,type GroupJournal } from '../groupConversationService';
const A='10000000-0000-4000-8000-000000000001',ID='20000000-0000-4000-8000-000000000001',G='30000000-0000-4000-8000-000000000001',K='40000000-0000-4000-8000-000000000001',M='50000000-0000-4000-8000-000000000001';
const j:GroupJournal={version:1,groupId:G,clientRequestId:K,bodySha256:groupBodyHash('Privatna zajednička poruka')};
const ok=(podatak:unknown)=>({ok:true,podatak}),unknown={ok:false,kod:'GROUP_UNCONFIRMED',poruka:'Proverite ishod.'};
const context=()=>({accountId:A,agreementId:ID,needId:ID,available:true,authoritative:true,group:{groupId:G,title:'Zadatak',canSend:true,terminal:false,role:'PARTICIPANT',members:[],management:null,managementNextId:null,unreadCount:1}});
const message=(sequence='1')=>({messageId:M,sequence,senderAccountId:A,body:'Privatna zajednička poruka',createdAt:'2026-09-13T12:00:00Z',mine:true});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}
function fixture(raw:string|null=null){let current=true;const storage={getItem:jest.fn().mockResolvedValue(raw),setItem:jest.fn().mockResolvedValue(undefined),removeItem:jest.fn().mockResolvedValue(undefined)};
 const service={context:jest.fn().mockResolvedValue(ok(context())),messages:jest.fn().mockResolvedValue(ok({messages:[message()],nextBeforeSequence:null,nextAfterSequence:null})),
 recover:jest.fn().mockResolvedValue(ok({found:false,receipt:null})),send:jest.fn().mockResolvedValue(unknown),markRead:jest.fn().mockResolvedValue(ok({markedCount:1}))};
 const uuid=jest.fn(()=>K),controller=new GroupConversationController({agreementId:ID,account:{accountId:A,accountRevision:1},current:()=>current,storage,service:service as never,uuid});
 return{controller,storage,service,uuid,setCurrent:(v:boolean)=>{current=v;}};
}
it('persists opaque identity before one dispatch despite concurrent retained taps',async()=>{
 const f=fixture(),gate=deferred<void>();await f.controller.load();f.storage.setItem.mockReturnValue(gate.promise);
 const first=f.controller.send('  Privatna zajednička poruka  ');void f.controller.send('Druga poruka');expect(f.service.send).not.toHaveBeenCalled();
 expect(f.storage.setItem).toHaveBeenCalledTimes(1);expect(JSON.parse(f.storage.setItem.mock.calls[0][1])).toEqual(j);expect(f.storage.setItem.mock.calls[0][1]).not.toMatch(/Privatna|poruka/);
 gate.resolve();await first;expect(f.service.send).toHaveBeenCalledTimes(1);expect(f.uuid).toHaveBeenCalledTimes(1);expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',canRetry:false});
});
it('restart reads exact key only; absent receipt requires same hashed reentry and explicit retry',async()=>{
 const f=fixture(JSON.stringify(j));await f.controller.load();expect(f.service.recover).toHaveBeenCalledWith(j,{accountId:A,accountRevision:1});
 expect(f.service.send).not.toHaveBeenCalled();expect(f.uuid).not.toHaveBeenCalled();expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',canRetry:true});
 await f.controller.retry('Druga poruka');expect(f.service.send).not.toHaveBeenCalled();await f.controller.retry('Privatna zajednička poruka');
 expect(f.service.send).toHaveBeenCalledWith(j,'Privatna zajednička poruka',{accountId:A,accountRevision:1});expect(f.storage.setItem).not.toHaveBeenCalled();expect(f.uuid).not.toHaveBeenCalled();
});
it('read failure or read-only context prevents retry and never creates a replacement key',async()=>{
 const f=fixture(JSON.stringify(j));f.service.recover.mockResolvedValue(unknown);await f.controller.load();await f.controller.retry('Privatna zajednička poruka');expect(f.service.send).not.toHaveBeenCalled();
 f.service.recover.mockResolvedValue(ok({found:false,receipt:null}));f.service.context.mockResolvedValue(ok({...context(),group:{...context().group,canSend:false}}));
 await f.controller.refresh();expect(f.controller.snapshot().canRetry).toBe(false);await f.controller.retry('Privatna zajednička poruka');expect(f.service.send).not.toHaveBeenCalled();
});
it('restores authoritative receipt without synthesizing a message; acknowledged refresh loads real page',async()=>{
 const f=fixture(JSON.stringify(j)),receipt={...j,messageId:M};f.service.recover.mockResolvedValue(ok({found:true,receipt}));await f.controller.load();
 expect(f.controller.snapshot()).toMatchObject({phase:'CONFIRMED',receipt,messages:[]});expect(f.service.messages).not.toHaveBeenCalled();expect(f.storage.removeItem).not.toHaveBeenCalled();
 await f.controller.acknowledge();expect(f.storage.removeItem).toHaveBeenCalledTimes(1);expect(f.controller.snapshot()).toMatchObject({phase:'READY',journal:null,messages:[message()]});
});
it('storage failure never dispatches, and malformed/wrong-group journals cannot enable a fresh send',async()=>{
 const f=fixture();await f.controller.load();f.storage.setItem.mockRejectedValue(new Error('DISK'));await f.controller.send('Privatna zajednička poruka');expect(f.service.send).not.toHaveBeenCalled();expect(f.controller.snapshot().phase).toBe('ERROR');
 const wrong=fixture(JSON.stringify({...j,groupId:ID}));await wrong.controller.load();await wrong.controller.refresh();await wrong.controller.send('Nov tekst');
 await wrong.controller.retry('Privatna zajednička poruka');expect(wrong.service.recover).not.toHaveBeenCalled();expect(wrong.service.send).not.toHaveBeenCalled();expect(wrong.controller.snapshot().phase).toBe('ERROR');
 const corrupt=fixture(JSON.stringify({...j,body:'SECRET'}));await corrupt.controller.load();expect(corrupt.service.context).not.toHaveBeenCalled();expect(corrupt.service.send).not.toHaveBeenCalled();
});
it.each(['account','dispose'])('fences late IO after %s change and keeps unsent body out of storage',async kind=>{
 const f=fixture(),gate=deferred<void>();await f.controller.load();f.storage.setItem.mockReturnValue(gate.promise);const pending=f.controller.send('Privatna zajednička poruka');
 if(kind==='account')f.setCurrent(false);else f.controller.dispose();gate.resolve();await pending;expect(f.service.send).not.toHaveBeenCalled();
});
it('never auto marks page rows and filters viewable IDs against the actual loaded owned page',async()=>{
 const f=fixture();await f.controller.load();expect(f.service.markRead).not.toHaveBeenCalled();await f.controller.markVisible([M,M,ID]);expect(f.service.markRead).toHaveBeenCalledWith(G,[M],{accountId:A,accountRevision:1});
 expect(f.service.context).toHaveBeenCalledTimes(2);
});
it('loads older pages with strict server cursor and retains chronological message identity',async()=>{
 const f=fixture();f.service.messages.mockResolvedValueOnce(ok({messages:[message('2')],nextBeforeSequence:'2',nextAfterSequence:null}));await f.controller.load();
 f.service.messages.mockResolvedValueOnce(ok({messages:[{...message(),messageId:K}],nextBeforeSequence:null,nextAfterSequence:'1'}));await f.controller.older();
 expect(f.service.messages.mock.calls[1][2]).toEqual({before:'2'});expect(f.controller.snapshot().messages.map(m=>m.sequence)).toEqual(['1','2']);
});
it('send ACK alone does not clear journal, while a late failed read cannot license a duplicate',async()=>{
 const f=fixture();await f.controller.load();f.service.send.mockResolvedValue(ok({...j,messageId:M}));await f.controller.send('Privatna zajednička poruka');
 expect(f.controller.snapshot().phase).toBe('CONFIRMED');expect(f.storage.removeItem).not.toHaveBeenCalled();await f.controller.send('Druga poruka');expect(f.service.send).toHaveBeenCalledTimes(1);
});
it('corrupt journal remains unreadable across refresh and cannot be overwritten by a new command',async()=>{
 const f=fixture(JSON.stringify({...j,body:'CORRUPT PRIVATE DATA'}));await f.controller.load();await f.controller.refresh();await f.controller.send('Nova poruka');
 expect(f.storage.getItem).toHaveBeenCalledTimes(2);expect(f.service.context).not.toHaveBeenCalled();expect(f.service.send).not.toHaveBeenCalled();expect(f.storage.setItem).not.toHaveBeenCalled();
 f.storage.getItem.mockResolvedValue(JSON.stringify(j));await f.controller.refresh();expect(f.service.recover).toHaveBeenCalledWith(j,{accountId:A,accountRevision:1});
 expect(f.controller.snapshot()).toMatchObject({phase:'UNKNOWN',journal:j});expect(f.storage.setItem).not.toHaveBeenCalled();
});
it('failed authority refresh clears displayed content and cursor before exposing recovery',async()=>{
 const f=fixture();f.service.messages.mockResolvedValueOnce(ok({messages:[message()],nextBeforeSequence:'1',nextAfterSequence:null}));await f.controller.load();
 expect(f.controller.snapshot().messages).toHaveLength(1);f.service.context.mockResolvedValue(unknown);await f.controller.refresh();
 expect(f.controller.snapshot()).toMatchObject({phase:'ERROR',context:null,messages:[],before:null});
});
it('message read denial and now-unavailable context cannot retain previously visible group rows',async()=>{
 const f=fixture();await f.controller.load();f.service.messages.mockResolvedValue(unknown);await f.controller.refresh();expect(f.controller.snapshot().messages).toEqual([]);
 f.service.messages.mockResolvedValue(ok({messages:[message()],nextBeforeSequence:null,nextAfterSequence:null}));await f.controller.refresh();expect(f.controller.snapshot().messages).toHaveLength(1);
 f.service.context.mockResolvedValue(ok({...context(),available:false,group:null}));await f.controller.refresh();expect(f.controller.snapshot()).toMatchObject({phase:'READY',messages:[],before:null});
});
