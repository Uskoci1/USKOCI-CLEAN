import {workerAvailabilityPatch} from '../workerAiAvailabilityPatch';
import type {WorkerAvailabilityInput} from '../../contracts/workerAvailability';
const WEEK='11111111-1111-4111-8111-111111111111',WEEKEND='22222222-2222-4222-8222-222222222222',WINDOW='33333333-3333-4333-8333-333333333333';
const fixture=():WorkerAvailabilityInput=>({timezone:'Europe/Belgrade',availableNow:true,
 rules:[{id:WEEK,weekdays:[1,2,3,4,5],startTime:'09:00:00',endTime:'17:00:00',startsOn:'2026-01-01',endsOn:null,label:'Week',active:true},
 {id:WEEKEND,weekdays:[0,6],startTime:'10:00:00',endTime:'14:00:00',startsOn:'2026-01-01',endsOn:null,label:'Weekend',active:true}],
 windows:[{id:WINDOW,startsAt:'2026-11-01T10:00:00.123456Z',endsAt:'2026-11-01T11:00:00.654321Z',state:'UNAVAILABLE',label:'Exception'}]});
it('manual weekend edit never touches weekday rule or dated exception',()=>{
 const before=fixture(),after={...fixture(),rules:fixture().rules.map(r=>r.id===WEEKEND?{...r,endTime:'16:00:00'}:r)};
 const patch=workerAvailabilityPatch(before,after).availability!;
 expect(patch.ruleChanges).toHaveLength(2);expect(patch.ruleChanges?.[0]).toEqual({ruleId:WEEKEND,weekdays:[0,6],value:null});
 expect(patch.ruleChanges?.[1]).toMatchObject({ruleId:null,weekdays:[0,6],value:{endTime:'16:00:00'}});
 expect(JSON.stringify(patch)).not.toContain(WEEK);expect(patch.windowsUpsert).toEqual([]);expect(patch.windowIdsRemove).toEqual([]);
 expect(before).toEqual(fixture());
});
it('removing one explicit exception preserves all recurring weekdays',()=>{
 const before=fixture(),after={...fixture(),windows:[]};const patch=workerAvailabilityPatch(before,after).availability!;
 expect(patch.ruleChanges).toEqual([]);expect(patch.windowsUpsert).toEqual([]);expect(patch.windowIdsRemove).toEqual([WINDOW]);
});
it('changed exception retains original exact endpoints and server-owned ID',()=>{
 const before=fixture(),after={...fixture(),windows:fixture().windows.map(w=>({...w,label:'New label'}))};
 expect(workerAvailabilityPatch(before,after).availability?.windowsUpsert).toEqual([{...before.windows[0],label:'New label'}]);
});
it('malformed full calendar cannot produce mutation operations',()=>{
 const before=fixture(),after={...fixture(),rules:fixture().rules.map(r=>r.id===WEEK?{...r,weekdays:[]}:r)};expect(()=>workerAvailabilityPatch(before,after)).toThrow('WORKER_AVAILABILITY_INVALID');
});
