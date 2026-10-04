const RPCS=new Set([
 'rpc_control_overview_v1','rpc_control_search_v1','rpc_control_user_v1','rpc_control_task_v1','rpc_control_agreement_v1','rpc_control_notification_v1','rpc_control_ai_v1','rpc_control_matching_v1','rpc_control_application_v1'
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RAW_BYTES=192*1024;
function need(env,key,min=1){const v=String(env?.[key]||'').trim();if(v.length<min)throw new Error('CONTROL_ENV_'+key);return v}
async function timedFetch(fetchImpl,url,init,ms){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort('timeout'),ms);
 try{return await fetchImpl(url,{...init,signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timer)}
}
async function textBounded(response){
 const len=Number(response.headers.get('content-length')||0);
 if(len>MAX_RAW_BYTES)throw new Error('CONTROL_UPSTREAM_TOO_LARGE');
 const text=await response.text();
 if(text.length>MAX_RAW_BYTES)throw new Error('CONTROL_UPSTREAM_TOO_LARGE');
 return text;
}
export function createSupabaseControlDependencies(env,{fetchImpl=fetch}={}){
 const baseRaw=need(env,'CONTROL_SUPABASE_URL',12),anonKey=need(env,'CONTROL_SUPABASE_PUBLIC_KEY',20);
 const serverKey=need(env,'CONTROL_SUPABASE_SERVER_KEY',20),ownerId=need(env,'CONTROL_OWNER_USER_ID',1);
 if(!UUID.test(ownerId))throw new Error('CONTROL_OWNER_USER_ID_INVALID');
 const base=new URL(baseRaw);if(base.protocol!=='https:')throw new Error('CONTROL_SUPABASE_HTTPS_REQUIRED');
 const root=base.origin;
 async function authorize(request){
  const header=request.headers.get('authorization')||'',match=header.match(/^Bearer\s+(.+)$/i);
  if(!match)return {authenticated:false};
  let response;
  try{response=await timedFetch(fetchImpl,root+'/auth/v1/user',{method:'GET',headers:{apikey:anonKey,authorization:'Bearer '+match[1],accept:'application/json'}},5000)}
  catch{return {authenticated:false}}
  if(!response.ok)return {authenticated:false};
  let user;try{user=JSON.parse(await textBounded(response))}catch{return {authenticated:false}}
  if(!UUID.test(String(user?.id||'')))return {authenticated:false};
  return {authenticated:true,role:user.id===ownerId?'OWNER':'USER',userId:user.id};
 }
 async function rpc(name,args={}){
  if(!RPCS.has(name))throw new Error('CONTROL_RPC_NOT_ALLOWED');
  const response=await timedFetch(fetchImpl,root+'/rest/v1/rpc/'+encodeURIComponent(name),{
   method:'POST',headers:{apikey:serverKey,authorization:'Bearer '+serverKey,'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify(args||{})
  },8000);
  const text=await textBounded(response);
  if(!response.ok)throw new Error('CONTROL_RPC_HTTP_'+response.status);
  try{return JSON.parse(text)}catch{throw new Error('CONTROL_RPC_JSON_INVALID')}
 }
 return {authorize,rpc,meta:{origin:root,ownerConfigured:true,allowedRpcCount:RPCS.size}};
}
export const CONTROL_ALLOWED_RPCS=Object.freeze([...RPCS]);
export const CONTROL_SUPABASE_MAX_RAW_BYTES=MAX_RAW_BYTES;
