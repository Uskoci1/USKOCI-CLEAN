const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN=new Set(['email','phone','exactAddress','exactLat','exactLng','exactCoordinates','pushToken','expoPushToken','chatBody','messageBody','scopeNote']);
const MAX_RESPONSE_BYTES=160*1024;

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
export function createControlApi({authorize,rpc}){
 if(typeof authorize!=='function'||typeof rpc!=='function')throw new Error('CONTROL_API_DEPENDENCY_REQUIRED');
 return async function handle(request){
  if(!(request instanceof Request))return json({error:'BAD_REQUEST_OBJECT'},400);
  if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405,{allow:'GET'});
  let auth;
  try{auth=await authorize(request)}catch{return json({error:'AUTH_UNAVAILABLE'},503)}
  if(!auth?.authenticated)return json({error:'AUTH_REQUIRED'},401);
  if(auth.role!=='OWNER')return json({error:'OWNER_REQUIRED'},403);
  const url=new URL(request.url),p=url.pathname;
  let name,args={};
  try{
   if(p==='/api/control/overview'){name='rpc_control_overview_v1'}
   else if(p==='/api/control/search'){
    const q=(url.searchParams.get('q')||'').trim();
    const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||20)||20,1),20);
    if(q.length<2||q.length>160)return json({error:'SEARCH_QUERY_INVALID'},400);
    name='rpc_control_search_v1';args={p_query:q,p_limit:limit};
   }else if(p.startsWith('/api/control/users/')){name='rpc_control_user_v1';args={p_account_id:idFrom(p,'/api/control/users/')}}
   else if(p.startsWith('/api/control/tasks/')){name='rpc_control_task_v1';args={p_need_id:idFrom(p,'/api/control/tasks/')}}
   else if(p.startsWith('/api/control/agreements/')){name='rpc_control_agreement_v1';args={p_agreement_id:idFrom(p,'/api/control/agreements/')}}
   else return json({error:'NOT_FOUND'},404);
  }catch(e){return json({error:e.message==='INVALID_ID'?'INVALID_ID':'BAD_ROUTE'},400)}
  try{
   const data=bounded(await rpc(name,args,{actorId:auth.userId,role:auth.role}));
   return json(data,200,{'x-control-freshness':String(data?.freshness||'UNKNOWN'),'x-control-schema':String(data?.schemaVersion||'UNKNOWN')});
  }catch(e){
   return json({error:'CONTROL_BACKEND_READ_FAILED',reason:String(e?.message||'FAILED').slice(0,120)},502);
  }
 }
}
export const CONTROL_API_MAX_RESPONSE_BYTES=MAX_RESPONSE_BYTES;
