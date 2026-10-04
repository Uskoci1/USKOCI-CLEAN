const FORBIDDEN_KEY = /(?:^|_)(?:email|phone|exactaddress|exact_address|exactlat|exact_lat|exactlng|exact_lng|pushtoken|push_token|expopushtoken|expo_push_token|chatbody|chat_body|messagebody|message_body)$/i;
const MAX_BYTES = 32768;

function object(value,name){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(name+'_OBJECT_REQUIRED');
  return value;
}
function finiteNonNegative(value,name,{nullable=false}={}){
  if(nullable&&value===null)return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error(name+'_INVALID');
  return value;
}
function safeKeys(value,path='root'){
  if(Array.isArray(value)){value.forEach((v,i)=>safeKeys(v,path+'['+i+']'));return}
  if(!value||typeof value!=='object')return;
  for(const [key,v] of Object.entries(value)){
    if(FORBIDDEN_KEY.test(key))throw new Error('FORBIDDEN_FIELD_'+path+'.'+key);
    safeKeys(v,path+'.'+key);
  }
}
function bucket(value,name){
  const o=object(value,name),out={};
  for(const [key,n] of Object.entries(o)){
    if(!/^[A-Z0-9_:.-]{1,80}$/.test(key))throw new Error(name+'_KEY_INVALID');
    out[key]=finiteNonNegative(n,name+'_'+key);
  }
  return out;
}
export function parseControlOverview(raw){
  const encoded=JSON.stringify(raw);
  if(encoded.length>MAX_BYTES)throw new Error('OVERVIEW_PAYLOAD_TOO_LARGE');
  safeKeys(raw);
  const r=object(raw,'OVERVIEW');
  if(r.schemaVersion!=='CONTROL_OVERVIEW_V1')throw new Error('OVERVIEW_SCHEMA_VERSION');
  if(r.freshness!=='LIVE')throw new Error('OVERVIEW_NOT_LIVE');
  if(typeof r.capturedAt!=='string'||Number.isNaN(Date.parse(r.capturedAt)))throw new Error('OVERVIEW_CAPTURED_AT');
  const accounts=object(r.accounts,'ACCOUNTS');
  const workers=object(r.workers,'WORKERS');
  const needs=object(r.needs,'NEEDS');
  const responses=object(r.responses,'RESPONSES');
  const agreements=object(r.agreements,'AGREEMENTS');
  const reviews=object(r.reviews,'REVIEWS');
  const push=object(r.push,'PUSH');
  const ai=object(r.ai,'AI');
  const privacy=object(r.privacy,'PRIVACY');
  const result={
    schemaVersion:r.schemaVersion,
    capturedAt:r.capturedAt,
    freshness:r.freshness,
    accounts:{
      registeredTotal:finiteNonNegative(accounts.registeredTotal,'ACCOUNTS_REGISTERED_TOTAL'),
      registered24h:finiteNonNegative(accounts.registered24h,'ACCOUNTS_REGISTERED_24H'),
      active24h:finiteNonNegative(accounts.active24h,'ACCOUNTS_ACTIVE_24H',{nullable:true}),
      active24hState:String(accounts.active24hState||'UNKNOWN'),
      active24hReason:String(accounts.active24hReason||'')
    },
    workers:{
      activeProfiles:finiteNonNegative(workers.activeProfiles,'WORKERS_ACTIVE'),
      availableNow:finiteNonNegative(workers.availableNow,'WORKERS_AVAILABLE')
    },
    needs:{
      byStatus:bucket(needs.byStatus||{},'NEEDS'),
      activeCount:finiteNonNegative(needs.activeCount,'NEEDS_ACTIVE'),
      openForApplicationsCount:finiteNonNegative(needs.openForApplicationsCount,'NEEDS_OPEN_APPLICATIONS'),
      created24h:finiteNonNegative(needs.created24h,'NEEDS_CREATED_24H'),
      published24h:finiteNonNegative(needs.published24h,'NEEDS_PUBLISHED_24H')
    },
    responses:{byStatus:bucket(responses.byStatus||{},'RESPONSES'),created24h:finiteNonNegative(responses.created24h,'RESPONSES_CREATED_24H'),submitted24h:finiteNonNegative(responses.submitted24h,'RESPONSES_SUBMITTED_24H')},
    agreements:{byStatus:bucket(agreements.byStatus||{},'AGREEMENTS'),activeCount:finiteNonNegative(agreements.activeCount,'AGREEMENTS_ACTIVE'),created24h:finiteNonNegative(agreements.created24h,'AGREEMENTS_CREATED_24H'),completed24h:finiteNonNegative(agreements.completed24h,'AGREEMENTS_COMPLETED_24H'),completionMismatchCount:finiteNonNegative(agreements.completionMismatchCount,'AGREEMENTS_COMPLETION_MISMATCH')},
    reviews:{total:finiteNonNegative(reviews.total,'REVIEWS_TOTAL'),created24h:finiteNonNegative(reviews.created24h,'REVIEWS_24H')},
    push:{
      deliveries24hByState:bucket(push.deliveries24hByState||{},'PUSH_DELIVERIES'),
      attempts24hByOutcome:bucket(push.attempts24hByOutcome||{},'PUSH_ATTEMPTS'),
      overdueBacklog:finiteNonNegative(push.overdueBacklog,'PUSH_BACKLOG')
    },
    ai:{conversations24h:bucket(ai.conversations24h||{},'AI_CONVERSATIONS')},
    privacy:{
      containsEmail:privacy.containsEmail===true,
      containsPhone:privacy.containsPhone===true,
      containsExactAddress:privacy.containsExactAddress===true,
      containsPushToken:privacy.containsPushToken===true,
      containsChatBody:privacy.containsChatBody===true
    }
  };
  if(Object.values(result.privacy).some(Boolean))throw new Error('OVERVIEW_PRIVACY_FLAG_TRUE');
  if(result.accounts.active24h===null&&result.accounts.active24hState!=='UNKNOWN')throw new Error('ACTIVE24H_NULL_STATE_MISMATCH');
  return Object.freeze(result);
}
export const CONTROL_OVERVIEW_MAX_BYTES=MAX_BYTES;
