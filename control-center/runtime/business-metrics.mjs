function finite(v,name){if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw new Error(name+'_INVALID');return v}
function pct(ok,bad){const d=ok+bad;return d>0?Math.round((ok/d)*1000)/10:null}
export function deriveBusinessMetrics(overview){
 if(!overview||typeof overview!=='object')throw new Error('OVERVIEW_REQUIRED');
 const accounts=overview.accounts||{},workers=overview.workers||{},needs=overview.needs||{},responses=overview.responses||{},agreements=overview.agreements||{},push=overview.push||{},ai=overview.ai||{},reviews=overview.reviews||{};
 const pushOutcomes=push.attempts24hByOutcome||{},pushOk=finite(Number(pushOutcomes.OK??0),'PUSH_OK'),pushBad=finite(Number(pushOutcomes.RETRYABLE??0),'PUSH_RETRYABLE')+finite(Number(pushOutcomes.FATAL??0),'PUSH_FATAL');
 const aiTotal=Object.values(ai.conversations24h||{}).reduce((a,v)=>a+finite(Number(v),'AI_BUCKET'),0);
 return Object.freeze({
  activeUsers24h:{value:accounts.active24h,state:accounts.active24hState||'UNKNOWN'},
  newAccounts24h:finite(accounts.registered24h,'NEW_ACCOUNTS_24H'),
  registeredTotal:finite(accounts.registeredTotal,'REGISTERED_TOTAL'),
  activeWorkerProfiles:finite(workers.activeProfiles,'ACTIVE_WORKERS'),
  availableWorkersNow:finite(workers.availableNow,'AVAILABLE_WORKERS'),
  openForApplications:finite(needs.openForApplicationsCount,'OPEN_APPLICATIONS'),
  activeTasks:finite(needs.activeCount,'ACTIVE_TASKS'),
  createdTasks24h:finite(needs.created24h,'TASKS_CREATED_24H'),
  publishedTasks24h:finite(needs.published24h,'TASKS_PUBLISHED_24H'),
  submittedApplications24h:finite(responses.submitted24h,'APPLICATIONS_SUBMITTED_24H'),
  activeAgreements:finite(agreements.activeCount,'ACTIVE_AGREEMENTS'),
  completed24h:finite(agreements.completed24h,'COMPLETED_24H'),
  completionMismatchCount:finite(agreements.completionMismatchCount,'COMPLETION_MISMATCH'),
  reviews24h:finite(reviews.created24h,'REVIEWS_24H'),
  pushBacklog:finite(push.overdueBacklog,'PUSH_BACKLOG'),
  pushSuccessPct:pct(pushOk,pushBad),
  aiConversations24h:aiTotal
 });
}
