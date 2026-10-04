const FORBIDDEN_KEYS=new Set(['email','phone','exactAddress','exactLat','exactLng','exactCoordinates','pushToken','expoPushToken','chatBody','messageBody','scopeNote']);
function obj(v,n){if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(n+'_OBJECT');return v}
function arr(v,n,max){if(!Array.isArray(v)||v.length>max)throw new Error(n+'_ARRAY');return v}
function stamp(v,n){if(typeof v!=='string'||Number.isNaN(Date.parse(v)))throw new Error(n+'_TIME');return v}
function schema(v,want){if(v!==want)throw new Error('SCHEMA_'+want)}
function live(v){if(v!=='LIVE')throw new Error('NOT_LIVE')}
function uuidish(v,n){if(typeof v!=='string'||!/[0-9a-f-]{36}/i.test(v))throw new Error(n+'_ID');return v}
function nonneg(v,n,{nullable=false}={}){if(nullable&&v===null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw new Error(n+'_NUMBER');return v}
function keysafe(v,path='root'){if(Array.isArray(v)){v.forEach((x,i)=>keysafe(x,path+'['+i+']'));return}if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(FORBIDDEN_KEYS.has(k))throw new Error('FORBIDDEN_'+path+'.'+k);keysafe(x,path+'.'+k)}}
function payload(raw,max){const s=JSON.stringify(raw);if(s.length>max)throw new Error('PAYLOAD_TOO_LARGE');keysafe(raw);return obj(raw,'ROOT')}
function privacyFalse(p,n){p=obj(p,n);for(const [k,v] of Object.entries(p))if(v===true)throw new Error(n+'_TRUE_'+k);return p}

export function parseControlSearch(raw){
 const r=payload(raw,65536);schema(r.schemaVersion,'CONTROL_SEARCH_V1');stamp(r.capturedAt,'SEARCH_CAPTURED');live(r.freshness);
 const items=arr(r.items,'SEARCH_ITEMS',20).map((x,i)=>{x=obj(x,'SEARCH_ITEM_'+i);if(!['USER','TASK','APPLICATION','AGREEMENT'].includes(x.kind))throw new Error('SEARCH_KIND');uuidish(x.id,'SEARCH');if(typeof x.label!=='string'||x.label.length>160)throw new Error('SEARCH_LABEL');return x});
 if(typeof r.hasMore!=='boolean')throw new Error('SEARCH_HAS_MORE');
 privacyFalse(r.privacy,'SEARCH_PRIVACY');return Object.freeze({...r,items});
}
export function parseControlUser(raw){
 const r=payload(raw,98304);schema(r.schemaVersion,'CONTROL_USER_V1');stamp(r.capturedAt,'USER_CAPTURED');live(r.freshness);
 const a=obj(r.account,'USER_ACCOUNT');uuidish(a.id,'USER');if(typeof a.fullName!=='string'||a.fullName.length>200)throw new Error('USER_NAME');
 arr(r.profiles,'USER_PROFILES',4);obj(r.counts,'USER_COUNTS');obj(r.reputation,'USER_REPUTATION');arr(r.recentReceivedEvents,'USER_EVENTS',25);
 if(r.lastActivity!==null)throw new Error('USER_LAST_ACTIVITY_NOT_NULL');if(r.lastActivityState!=='UNKNOWN')throw new Error('USER_LAST_ACTIVITY_STATE');
 privacyFalse(r.privacy,'USER_PRIVACY');return Object.freeze(r);
}
export function parseControlTask(raw){
 const r=payload(raw,131072);schema(r.schemaVersion,'CONTROL_TASK_V1');stamp(r.capturedAt,'TASK_CAPTURED');live(r.freshness);
 const t=obj(r.task,'TASK');uuidish(t.id,'TASK');nonneg(t.requiredSlots,'TASK_REQUIRED');nonneg(t.coveredSlots,'TASK_COVERED');
 obj(r.applicationsByStatus,'TASK_APPLICATIONS');const s=obj(r.selections,'TASK_SELECTIONS');nonneg(s.selectedSlots,'TASK_SELECTED');
 arr(r.agreements,'TASK_AGREEMENTS',50);arr(r.recentNeedEvents,'TASK_EVENTS',50);obj(r.coverage,'TASK_COVERAGE');
 const sa=obj(r.searchAuthority,'TASK_SEARCH_AUTHORITY');if(!['UNKNOWN','OPEN','CLOSED'].includes(sa.state))throw new Error('TASK_SEARCH_AUTHORITY_STATE');
 privacyFalse(r.privacy,'TASK_PRIVACY');return Object.freeze(r);
}
export function parseControlAgreement(raw){
 const r=payload(raw,98304);schema(r.schemaVersion,'CONTROL_AGREEMENT_V1');stamp(r.capturedAt,'AGREEMENT_CAPTURED');live(r.freshness);
 const a=obj(r.agreement,'AGREEMENT');uuidish(a.id,'AGREEMENT');uuidish(a.needId,'AGREEMENT_NEED');
 obj(r.task,'AGREEMENT_TASK');obj(r.requester,'AGREEMENT_REQUESTER');obj(r.worker,'AGREEMENT_WORKER');obj(r.acceptedTerms,'AGREEMENT_TERMS');
 obj(r.messages,'AGREEMENT_MESSAGES');obj(r.reviews,'AGREEMENT_REVIEWS');privacyFalse(r.privacy,'AGREEMENT_PRIVACY');return Object.freeze(r);
}
