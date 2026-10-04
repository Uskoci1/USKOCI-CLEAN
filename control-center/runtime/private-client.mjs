const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES=192*1024;
function id(v,name){v=String(v||'');if(!UUID.test(v))throw new Error(name+'_INVALID');return v}
function originOf(base){const u=new URL(base);if(u.protocol!=='https:'&&u.hostname!=='localhost'&&u.hostname!=='127.0.0.1')throw new Error('CONTROL_CLIENT_HTTPS_REQUIRED');return u.origin}
async function boundedJson(response){
 const len=Number(response.headers.get('content-length')||0);if(len>MAX_BYTES)throw new Error('CONTROL_CLIENT_RESPONSE_TOO_LARGE');
 const text=await response.text();if(text.length>MAX_BYTES)throw new Error('CONTROL_CLIENT_RESPONSE_TOO_LARGE');
 let body;try{body=JSON.parse(text)}catch{throw new Error('CONTROL_CLIENT_JSON_INVALID')}
 if(!response.ok){const e=new Error(String(body?.error||'CONTROL_HTTP_'+response.status));e.status=response.status;e.requestId=body?.requestId||response.headers.get('x-control-request-id');throw e}
 return body;
}
async function timed(fetchImpl,url,ms){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
 try{return await fetchImpl(url,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal:controller.signal})}finally{clearTimeout(timer)}
}
export function createControlPrivateClient({origin,fetchImpl=fetch,timeoutMs=10000}={}){
 const root=originOf(origin||globalThis.location?.origin||'https://control.invalid');
 const get=async path=>boundedJson(await timed(fetchImpl,new URL(path,root).toString(),timeoutMs));
 return Object.freeze({
  session:()=>get('/api/control/session'),
  overview:()=>get('/api/control/overview'),
  search:(q,limit=20)=>{
   q=String(q||'').trim();if(q.length<2||q.length>160)throw new Error('SEARCH_QUERY_INVALID');
   const digits=q.replace(/[^0-9]+/g,'');if(q.includes('@')||(!UUID.test(q)&&digits.length>=6))throw new Error('PRIVATE_IDENTITY_SEARCH_REQUIRES_ELEVATED_MODE');
   return get('/api/control/search?q='+encodeURIComponent(q)+'&limit='+Math.min(Math.max(Number(limit)||20,1),20));
  },
  user:accountId=>get('/api/control/users/'+id(accountId,'USER_ID')),
  task:needId=>get('/api/control/tasks/'+id(needId,'TASK_ID')),
  agreement:agreementId=>get('/api/control/agreements/'+id(agreementId,'AGREEMENT_ID')),
  application:responseId=>get('/api/control/applications/'+id(responseId,'APPLICATION_ID')),
  notification:eventId=>get('/api/control/notifications/'+id(eventId,'EVENT_ID')),
  ai:conversationId=>get('/api/control/ai/'+id(conversationId,'AI_ID')),
  matching:(needId,workerProfileId=null)=>get('/api/control/matching/'+id(needId,'MATCH_NEED_ID')+(workerProfileId?'/'+id(workerProfileId,'MATCH_PROFILE_ID'):''))
 });
}
export const CONTROL_PRIVATE_CLIENT_MAX_BYTES=MAX_BYTES;
