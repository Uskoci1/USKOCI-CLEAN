import {parseControlOverview} from '../runtime/overview-contract.mjs';
import {parseControlSearch,parseControlUser,parseControlTask,parseControlAgreement} from '../runtime/inspector-contracts.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN=new Set(['email','phone','exactAddress','exactLat','exactLng','exactCoordinates','pushToken','expoPushToken','chatBody','messageBody','scopeNote']);
const MAX_RESPONSE_BYTES=160*1024;
const PARSER={
 rpc_control_overview_v1:parseControlOverview,
 rpc_control_search_v1:parseControlSearch,
 rpc_control_user_v1:parseControlUser,
 rpc_control_task_v1:parseControlTask,
 rpc_control_agreement_v1:parseControlAgreement
};

function requestId(){try{return crypto.randomUUID()}catch{return 'control-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}}
function json(body,status=200,extra={}){
 return new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json; charset=utf-8',
  'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  ...extra
 }});
}
function safe(value,path='root'){
 if(Array.isArray(value)){value.forEach((v,i)=>safe(v,path+'['+i+']'));return}
 if(!value||typeof value!=='object')return;
 for(const [k,v] of Object.entries(value)){
  if(FORBIDDEN.has(k))throw new Error('FORBIDDEN_PAYLOAD_FIELD:'+path+'.'+k);
  safe(v,path+'.'+k);
 }
}
function bounded(body){
 safe(body);
 const encoded=JSON.stringify(body);
 if(encoded.length>MAX_RESPONSE_BYTES)throw new Error('CONTROL_RESPONSE_TOO_LARGE');
 return body;
}
function idFrom(path,prefix){
 const x=path.slice(prefix.length);
 if(!UUID.test(x))throw new Error('INVALID_ID');
 return x;
}
async function auditSafe(audit,event){if(typeof audit!=='function')return;try{await audit(event)}catch{}}

export function createControlApi({authorize,rpc,audit}){
 if(typeof authorize!=='function'||typeof rpc!=='function')throw new Error('CONTROL_API_DEPENDENCY_REQUIRED');
 return async function handle(request){
  const rid=requestId();
  const baseHeaders={'x-control-request-id':rid};
  if(!(request instanceof Request))return json({error:'BAD_REQUEST_OBJECT',requestId:rid},400,baseHeaders);
  if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED',requestId:rid},405,{...baseHeaders,allow:'GET'});
  let auth;
  try{auth=await authorize(request)}catch{
   await auditSafe(audit,{requestId:rid,outcome:'AUTH_UNAVAILABLE'});
   return json({error:'AUTH_UNAVAILABLE',requestId:rid},503,baseHeaders);
  }
  if(!auth?.authenticated){
   await auditSafe(audit,{requestId:rid,outcome:'AUTH_REQUIRED'});
   return json({error:'AUTH_REQUIRED',requestId:rid},401,baseHeaders);
  }
  if(auth.role!=='OWNER'){
   await auditSafe(audit,{requestId:rid,outcome:'OWNER_REQUIRED',actorId:auth.userId||null});
   return json({error:'OWNER_REQUIRED',requestId:rid},403,baseHeaders);
  }
  const url=new URL(request.url),p=url.pathname;
  let name,args={},auditMeta={};
  try{
   if(p==='/api/control/overview'){name='rpc_control_overview_v1'}
   else if(p==='/api/control/search'){
    const q=(url.searchParams.get('q')||'').trim();
    const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||20)||20,1),20);
    if(q.length<2||q.length>160)return json({error:'SEARCH_QUERY_INVALID',requestId:rid},400,baseHeaders);
    name='rpc_control_search_v1';args={p_query:q,p_limit:limit};auditMeta={queryLength:q.length,limit};
   }else if(p.startsWith('/api/control/users/')){name='rpc_control_user_v1';args={p_account_id:idFrom(p,'/api/control/users/')}}
   else if(p.startsWith('/api/control/tasks/')){name='rpc_control_task_v1';args={p_need_id:idFrom(p,'/api/control/tasks/')}}
   else if(p.startsWith('/api/control/agreements/')){name='rpc_control_agreement_v1';args={p_agreement_id:idFrom(p,'/api/control/agreements/')}}
   else return json({error:'NOT_FOUND',requestId:rid},404,baseHeaders);
  }catch(e){return json({error:e.message==='INVALID_ID'?'INVALID_ID':'BAD_ROUTE',requestId:rid},400,baseHeaders)}
  try{
   const raw=await rpc(name,args,{actorId:auth.userId,role:auth.role,requestId:rid});
   const parser=PARSER[name];
   if(typeof parser!=='function')throw new Error('CONTROL_SCHEMA_PARSER_MISSING');
   const data=bounded(parser(raw));
   await auditSafe(audit,{requestId:rid,outcome:'READ_OK',actorId:auth.userId,rpc:name,...auditMeta});
   return json(data,200,{...baseHeaders,'x-control-freshness':String(data.freshness),'x-control-schema':String(data.schemaVersion)});
  }catch(e){
   await auditSafe(audit,{requestId:rid,outcome:'READ_FAILED',actorId:auth.userId,rpc:name,errorClass:String(e?.message||'FAILED').split(':')[0].slice(0,80),...auditMeta});
   return json({error:'CONTROL_BACKEND_READ_FAILED',requestId:rid},502,baseHeaders);
  }
 }
}
export const CONTROL_API_MAX_RESPONSE_BYTES=MAX_RESPONSE_BYTES;
