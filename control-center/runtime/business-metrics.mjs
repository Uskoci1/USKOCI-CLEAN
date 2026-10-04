function n(bucket,key){const v=Number(bucket?.[key]??0);return Number.isFinite(v)&&v>=0?v:0}
function pct(ok,bad){const d=ok+bad;return d>0?Math.round((ok/d)*1000)/10:null}
export function deriveBusinessMetrics(overview){
 const needs=overview.needs||{},responses=overview.responses||{},agreements=overview.agreements||{},push=overview.push||{},ai=overview.ai||{};
 const pushOutcomes=push.attempts24hByOutcome||{},pushOk=n(pushOutcomes,'OK'),pushBad=n(pushOutcomes,'RETRYABLE')+n(pushOutcomes,'FATAL');
 const aiTotal=Object.values(ai.conversations24h||{}).reduce((a,v)=>a+(Number(v)||0),0);
 return Object.freeze({
  activeUsers24h:{value:overview.accounts.active24h,state:overview.accounts.active24hState||'UNKNOWN'},
  newAccounts24h:overview.accounts.registered24h,
  registeredTotal:overview.accounts.registeredTotal,
  activeWorkerProfiles:overview.workers.activeProfiles,
  availableWorkersNow:overview.workers.availableNow,
  openForMatching:n(needs,'PUBLISHED')+n(needs,'SELECTION'),
  activeTasks:n(needs,'PUBLISHED')+n(needs,'SELECTION')+n(needs,'ACTIVE'),
  applications24h:responses.created24h,
  activeAgreements:n(agreements.byStatus,'CONFIRMED'),
  completed24h:agreements.completed24h,
  reviews24h:overview.reviews.created24h,
  pushBacklog:push.overdueBacklog,
  pushSuccessPct:pct(pushOk,pushBad),
  aiConversations24h:aiTotal
 });
}
