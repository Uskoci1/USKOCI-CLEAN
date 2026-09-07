import { createInboxModel } from '../inboxModel';
import type { InboxItem, InboxPage, InboxPort } from '../../contracts/inbox';
const at='2026-09-07T07:00:00Z';
const row=(id='1'): InboxItem=>({id,role:'WORKER',readAt:null,occurredAt:at,eventType:'RESPONSE_SELECTED',family:'responses',title:'Izabrani ste',body:'Otvorite Dogovor.'});
const page=(items=[row()],hasMore=false): InboxPage=>({items,hasMore,unreadCount:items.length,asOf:at});
const deferred=<T,>()=>{let resolve!:(v:T)=>void;let reject!:(e:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
function setup() {
  const port={list:jest.fn().mockResolvedValue(page()),read:jest.fn().mockResolvedValue(at),
    readAll:jest.fn().mockResolvedValue(1),resolve:jest.fn().mockResolvedValue({kind:'AGREEMENT',id:'a',role:'WORKER'})} satisfies InboxPort;
  let current=true;
  const model=createInboxModel(port,'WORKER',()=>current);
  return {port,model,logout:()=>{current=false;}};
}
describe('Inbox lifecycle and command ownership',()=>{
  it('never displays a late page after logout or blur',async()=>{
    for (const method of ['logout','blur']) {
      const {port,model,logout}=setup();const pending=deferred<InboxPage>();port.list.mockReturnValue(pending.promise);
      model.start();if(method==='logout')logout();else model.stop();
      pending.resolve(page());await flush();expect(model.snapshot().page).toBeNull();
    }
  });
  it('latest refresh wins and a load failure is not an authoritative empty state',async()=>{
    const {port,model}=setup();const first=deferred<InboxPage>();port.list.mockReturnValueOnce(first.promise);
    model.start();await model.refresh();first.resolve(page([row('old')]));await flush();
    expect(model.snapshot().page?.items[0].id).toBe('1');
    port.list.mockRejectedValueOnce(new Error('offline'));await model.refresh();
    expect(model.snapshot().error).toBe('load');expect(model.snapshot().page?.items).toHaveLength(1);
  });
  it('initial failure stays distinct from successful empty',async()=>{
    const {port,model}=setup();port.list.mockRejectedValueOnce(new Error());model.start();await flush();
    expect(model.snapshot()).toMatchObject({page:null,error:'load',loading:false});
    port.list.mockResolvedValueOnce(page([]));await model.refresh();expect(model.snapshot().page?.items).toEqual([]);
  });
  it('serializes paging and merges by event identity',async()=>{
    const {port,model}=setup();port.list.mockResolvedValueOnce(page([row()],true));model.start();await flush();
    const pending=deferred<InboxPage>();port.list.mockReturnValueOnce(pending.promise);
    const running=model.more();await model.more();expect(port.list).toHaveBeenCalledTimes(2);
    expect(port.list).toHaveBeenLastCalledWith('WORKER',{at,id:'1'});
    pending.resolve(page([row(),row('2')]));await running;
    expect(model.snapshot().page?.items.map(x=>x.id)).toEqual(['1','2']);
  });
  it('refresh invalidates in-flight pagination',async()=>{
    const {port,model}=setup();port.list.mockResolvedValueOnce(page([row()],true));model.start();await flush();
    const old=deferred<InboxPage>();port.list.mockReturnValueOnce(old.promise);const pending=model.more();
    port.list.mockResolvedValueOnce(page([row('new')]));await model.refresh();old.resolve(page([row('old')]));await pending;
    expect(model.snapshot().page?.items.map(x=>x.id)).toEqual(['new']);
  });
  it('does not mark read on failure or navigate before server acknowledgment',async()=>{
    const {port,model}=setup();model.start();await flush();port.read.mockRejectedValueOnce(new Error());
    expect(await model.open(row())).toBeNull();expect(model.snapshot().page?.items[0].readAt).toBeNull();expect(port.resolve).not.toHaveBeenCalled();
    expect(await model.open(row())).toMatchObject({kind:'AGREEMENT'});
    expect(model.snapshot().page?.items[0].readAt).toBe(at);expect(model.snapshot().page?.unreadCount).toBe(0);
  });
  it('suppresses duplicate taps and navigation resolved after account loss',async()=>{
    const {port,model,logout}=setup();model.start();await flush();const pending=deferred<unknown>();port.resolve.mockReturnValue(pending.promise);
    const opened=model.open(row());await flush();expect(await model.open(row())).toBeNull();
    logout();pending.resolve({kind:'AGREEMENT',id:'a',role:'WORKER'});expect(await opened).toBeNull();
    expect(port.read).toHaveBeenCalledTimes(1);
  });
  it('preserves read ack if resolver is unavailable and supports retry after error',async()=>{
    const {port,model}=setup();model.start();await flush();port.resolve.mockRejectedValueOnce(new Error());
    await model.open(row());expect(model.snapshot().error).toBe('action');expect(model.snapshot().page?.unreadCount).toBe(0);
    port.resolve.mockResolvedValueOnce({kind:'UNAVAILABLE'});await model.open(row());
    expect(model.snapshot()).toMatchObject({error:null,unavailable:true});expect(model.snapshot().page?.unreadCount).toBe(0);
  });
  it('read-all uses server asOf and then reads authoritative arrivals/count',async()=>{
    const {port,model}=setup();model.start();await flush();port.list.mockResolvedValueOnce(page([row('new')]));
    await model.readAll();expect(port.readAll).toHaveBeenCalledWith(at,'WORKER');
    expect(model.snapshot().page?.unreadCount).toBe(1);expect(model.snapshot().page?.items[0].id).toBe('new');
  });
  it('failed read-all leaves counts untouched and restart clears abandoned actions',async()=>{
    const {port,model}=setup();model.start();await flush();port.readAll.mockRejectedValueOnce(new Error());
    await model.readAll();expect(model.snapshot()).toMatchObject({acting:null,error:'action'});expect(model.snapshot().page?.unreadCount).toBe(1);
    const pending=deferred<string>();port.read.mockReturnValueOnce(pending.promise);const opened=model.open(row());model.stop();model.start();await flush();
    pending.resolve(at);expect(await opened).toBeNull();expect(model.snapshot().acting).toBeNull();
  });
});
