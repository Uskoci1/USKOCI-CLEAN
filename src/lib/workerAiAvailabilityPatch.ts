import type { WorkerAiPatch } from '../data/workerAiClientService';
import type { WorkerAvailabilityInput } from '../contracts/workerAvailability';
import { normalizeWorkerAvailability } from './workerAvailability';

/** Translate an explicit manual calendar edit into bounded candidate operations.
 * Unchanged rules/windows do not enter the patch. IDs for additions are assigned
 * by the server and become visible in the subsequent immutable profile review. */
export function workerAvailabilityPatch(before:WorkerAvailabilityInput,after:WorkerAvailabilityInput):WorkerAiPatch {
  const normalized=normalizeWorkerAvailability(after);if(!normalized)throw new Error('WORKER_AVAILABILITY_INVALID');
  const changes:NonNullable<NonNullable<WorkerAiPatch['availability']>['ruleChanges']>=[];
  for(const old of before.rules) {
    const next=normalized.rules.find(x=>x.id===old.id);
    if(JSON.stringify(next)===JSON.stringify(old))continue;
    changes.push({ruleId:old.id,weekdays:[...old.weekdays],value:null});
  }
  for(const rule of normalized.rules) {
    if(JSON.stringify(before.rules.find(x=>x.id===rule.id))===JSON.stringify(rule))continue;
    const {id:_id,weekdays:days,...value}=rule;changes.push({ruleId:null,weekdays:[...days],value});
  }
  return {availability:{timezone:normalized.timezone,availableNow:normalized.availableNow,ruleChanges:changes,
    windowsUpsert:normalized.windows.filter(w=>JSON.stringify(before.windows.find(x=>x.id===w.id))!==JSON.stringify(w))
      .map(w=>({...w,id:before.windows.some(x=>x.id===w.id)?w.id:null})),
    windowIdsRemove:before.windows.filter(w=>!normalized.windows.some(x=>x.id===w.id)).map(w=>w.id)}};
}
