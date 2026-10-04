const MAX_BYTES=128*1024,FORBIDDEN=new Set(['email','phone','exactAddress','exactLat','exactLng','exactCoordinates']);
function safe(v,p='root'){if(Array.isArray(v)){v.forEach((x,i)=>safe(x,p+'['+i+']'));return}if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){if(FORBIDDEN.has(k))throw new Error('MATCHING_FORBIDDEN_'+p+'.'+k);safe(x,p+'.'+k)}}
export function parseControlMatching(raw){
 const text=JSON.stringify(raw);if(text.length>MAX_BYTES)throw new Error('MATCHING_TOO_LARGE');safe(raw);
 if(!raw||typeof raw!=='object'||raw.schemaVersion!=='CONTROL_MATCHING_V1'||raw.freshness!=='LIVE')throw new Error('MATCHING_SCHEMA');
 if(!raw.need||typeof raw.need!=='object')throw new Error('MATCHING_NEED');
 if(!Array.isArray(raw.dispatchRounds)||raw.dispatchRounds.length>20)throw new Error('MATCHING_ROUNDS');
 if(!raw.currentRevisionDeliveries||typeof raw.currentRevisionDeliveries!=='object')throw new Error('MATCHING_DELIVERIES');
 if(raw.worker){
   if(raw.worker.currentEvaluation?.evaluationScope!=='CURRENT_RECOMPUTE')throw new Error('MATCHING_WORKER_SCOPE');
   if(!['UNAVAILABLE_NOT_RECORDED','NOT_APPLICABLE_DELIVERED'].includes(raw.worker.historicalExclusionProof))throw new Error('MATCHING_HISTORY_SEMANTICS');
 }
 if(raw.semantics?.aggregateSource!=='RECORDED_DISPATCH_ONLY')throw new Error('MATCHING_AGGREGATE_SCOPE');
 if(Object.values(raw.privacy||{}).some(Boolean))throw new Error('MATCHING_PRIVACY');
 return Object.freeze(raw);
}
export const CONTROL_MATCHING_MAX_BYTES=MAX_BYTES;
