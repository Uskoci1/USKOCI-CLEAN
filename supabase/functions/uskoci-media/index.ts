// AF-D07. Original bytes live only in this request. Storage receives a sanitized
// JPEG under an immutable server-generated path; upload never publishes a Task.
import * as magick from 'npm:@imagemagick/magick-wasm@0.0.43';
import { configureImageLimits, sanitizeImage } from '../_shared/mediaImageSanitizer.mjs';
declare const Deno:{env:{get(name:string):string|undefined};readFile(path:string|URL):Promise<Uint8Array>;serve(fn:(req:Request)=>Promise<Response>):void};
type Row=Record<string,any>;
const row=(v:unknown):Row|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Row:null;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-media-operation,x-media-scope,x-media-target,x-media-request-id',
 'Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const safeCodes=['MEDIA_INPUT_INVALID','MEDIA_FORMAT_UNSUPPORTED','MEDIA_DIMENSIONS_TOO_LARGE','MEDIA_SANITIZATION_FAILED','MEDIA_LIMIT_REACHED',
 'MEDIA_NOT_FOUND','MEDIA_NOT_EDITABLE','MEDIA_TURN_PENDING','MEDIA_UPLOAD_PENDING','IDEMPOTENCY_KEY_REUSED'];
class Safe extends Error{constructor(readonly code:string,readonly status=400){super(code);}}
let initialized:Promise<void>|undefined,busy=false;
export async function loadMediaRuntime(){
 if(!initialized)initialized=(async()=>{await magick.initializeImageMagick(await Deno.readFile(new URL(import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.43/magick.wasm'))));configureImageLimits(magick);})();
 await initialized;return magick;
}
async function bytes(message:Request|Response,max:number,signal:AbortSignal):Promise<Uint8Array>{
 const declared=message.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>max))throw new Safe('MEDIA_INPUT_INVALID',413);
 const reader=message.body?.getReader();if(!reader)throw new Safe('MEDIA_INPUT_INVALID');
 const chunks:Uint8Array[]=[];let total=0;const stop=()=>{void reader.cancel().catch(()=>undefined);};signal.addEventListener('abort',stop,{once:true});
 try{for(;;){if(signal.aborted)throw new Error('CANCELLED');const part=await reader.read();if(signal.aborted)throw new Error('CANCELLED');if(part.done)break;
  total+=part.value.byteLength;if(total>max)throw new Safe('MEDIA_INPUT_INVALID',413);chunks.push(part.value);}
  if(declared!==null&&Number(declared)!==total)throw new Error('TRUNCATED');const out=new Uint8Array(total);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;
 }finally{signal.removeEventListener('abort',stop);void reader.cancel().catch(()=>undefined);}
}
const digest=async(data:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(data).buffer)),v=>v.toString(16).padStart(2,'0')).join('');
const parse=(data:Uint8Array)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
function asset(raw:unknown,aid?:string):Row{
 const a=row(raw);if(!a||!id(a.assetId)||!id(a.accountId)||(aid&&a.accountId!==aid)||!id(a.clientRequestId)||!['TASK','AVATAR'].includes(a.scope)
  ||!['PROCESSING','STAGED','READY','FAILED'].includes(a.state)||a.authoritative!==true)throw new Error('INVALID_ASSET');
 if(a.state==='READY'&&(!hash(a.sha256)||a.ref!==`${a.accountId}/v5/${a.assetId}/${a.sha256}.jpg`||!Number.isInteger(a.byteSize)||a.byteSize<1||a.byteSize>5242880||a.contentType!=='image/jpeg'))throw new Error('INVALID_ASSET');
 return a;
}
function supportSession(authorization:string,accountId:string,origin:string):string{
 // Auth /user has already verified this exact bearer. Decode only its signed
 // human/session binding, never a client JSON/header account/session override.
 try{
  const parts=authorization.slice(7).split('.');if(parts.length!==3||parts.some(x=>!x||!/^[A-Za-z0-9_-]+$/.test(x)))throw new Error();
  const encoded=parts[1].replace(/-/g,'+').replace(/_/g,'/'),raw=atob(encoded+'='.repeat((4-encoded.length%4)%4));
  const claims=row(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw,x=>x.charCodeAt(0)))));
  if(!claims||claims.sub!==accountId||claims.role!=='authenticated'||!id(claims.session_id)||claims.iss!==origin+'/auth/v1'
   ||!Number.isSafeInteger(claims.exp)||claims.exp<=Math.floor(Date.now()/1000))throw new Error();return claims.session_id;
 }catch{throw new Safe('AUTH_REQUIRED',401);}
}
function supportMedia(raw:unknown,caseId:string,assetId:string):Row{
 const r=row(raw),path=typeof r?.path==='string'?r.path.split('/'):[];
 if(!r||Object.keys(r).length!==8||Object.keys(r).some(k=>!['assetId','caseId','bucket','path','sha256','contentType','byteSize','authoritative'].includes(k))
  ||r.assetId!==assetId||r.caseId!==caseId||r.bucket!=='profile-media'||!hash(r.sha256)||r.contentType!=='image/jpeg'||r.authoritative!==true
  ||!Number.isInteger(r.byteSize)||r.byteSize<1||r.byteSize>5242880||path.length!==4||!id(path[0])
  ||r.path!==`${path[0]}/v5/${assetId}/${r.sha256}.jpg`)throw new Error('INVALID_SUPPORT_MEDIA');
 return r;
}
export async function handleMedia(req:Request):Promise<Response>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json(405,{code:'METHOD_NOT_ALLOWED'});
 const authorization=req.headers.get('authorization')??'',base=Deno.env.get('SUPABASE_URL')??'',anon=Deno.env.get('SUPABASE_ANON_KEY')??'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
 if(!/^Bearer [^\s]+$/.test(authorization)||authorization.length>16384)return json(401,{code:'AUTH_REQUIRED'});
 let url:URL;try{url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!anon||!service)throw new Error();}catch{return json(503,{code:'MEDIA_UNAVAILABLE'});}
 const abort=new AbortController(),stop=()=>abort.abort(),timer=setTimeout(stop,25000);req.signal.addEventListener('abort',stop,{once:true});if(req.signal.aborted)stop();
 const fetchBound=(path:string,init:RequestInit)=>fetch(path,{...init,redirect:'error',signal:abort.signal});
 const userHeaders={apikey:anon,Authorization:authorization,'Content-Type':'application/json'};
 const serviceHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 const rpc=async(name:string,args:Row)=>{const r=await fetchBound(url.origin+'/rest/v1/rpc/'+name,{method:'POST',headers:serviceHeaders,body:JSON.stringify(args)});
  const v=parse(await bytes(r,32768,abort.signal));if(!r.ok){const code=row(v)?.message;if(safeCodes.includes(code))throw new Safe(code,code==='MEDIA_NOT_FOUND'?403:409);throw new Error('MEDIA_RPC_FAILED');}return v;};
 const objectBytes=async(path:string,expected:string,size:number,strictMime=false)=>{const r=await fetchBound(url.origin+'/storage/v1/object/profile-media/'+path,{headers:{apikey:service,Authorization:'Bearer '+service}});
  if(!r.ok||(strictMime&&r.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='image/jpeg'))throw new Error('STORAGE_UNCONFIRMED');const b=await bytes(r,5242880,abort.signal);if(b.length!==size||await digest(b)!==expected)throw new Error('STORAGE_UNCONFIRMED');return b;};
 let held=false;
 try{
  const auth=await fetchBound(url.origin+'/auth/v1/user',{headers:userHeaders});if(!auth.ok)return json(401,{code:'AUTH_REQUIRED'});
  const user=row(parse(await bytes(auth,65536,abort.signal)));if(!id(user?.id))return json(401,{code:'AUTH_REQUIRED'});const aid=user.id;
  const op=req.headers.get('x-media-operation'),preview=(a:Row)=>({assetId:a.assetId,width:a.width,height:a.height,contentType:'image/jpeg'});
  if(op==='list-need'||op==='list-profile'){
   const input=row(parse(await bytes(req,2048,abort.signal)));if(!input||Object.keys(input).length!==1)throw new Safe('MEDIA_INPUT_INVALID');
   if(op==='list-need'){
    if(!id(input.needId))throw new Safe('MEDIA_INPUT_INVALID');
    const visible=await fetchBound(url.origin+'/rest/v1/needs?id=eq.'+input.needId+'&select=id,revision,public_photo_paths',{headers:userHeaders});
    const rows=parse(await bytes(visible,32768,abort.signal));if(!visible.ok||!Array.isArray(rows)||rows.length!==1||rows[0].id!==input.needId)throw new Safe('MEDIA_NOT_FOUND',403);
    const assets=await rpc('rpc_read_need_media_assets_service',{p_need_id:input.needId,p_expected_revision:rows[0].revision});
    if(!Array.isArray(assets)||assets.length>6||!Array.isArray(rows[0].public_photo_paths)||assets.length!==rows[0].public_photo_paths.length)throw new Error('INVALID_ASSETS');
    const photos=assets.map(raw=>{const a=asset(raw);if(a.scope!=='TASK'||!rows[0].public_photo_paths.includes(a.ref))throw new Error('INVALID_ASSET');return preview(a);});
    return json(200,{needId:input.needId,photos,authoritative:true});
   }
   if(!id(input.profileId))throw new Safe('MEDIA_INPUT_INVALID');
   const visible=await fetchBound(url.origin+'/rest/v1/rpc/rpc_get_public_profile',{method:'POST',headers:userHeaders,body:JSON.stringify({p_profile_id:input.profileId})});
   const publicDocument=parse(await bytes(visible,32768,abort.signal));
   if(!visible.ok)throw new Safe('MEDIA_NOT_FOUND',403);
   let p=row(publicDocument);
   if(publicDocument===null){
    // An inactive profile has no public projection. Its owner may still see the
    // saved private avatar; the owner RPC uses the caller JWT, never service auth.
    const owned=await fetchBound(url.origin+'/rest/v1/rpc/rpc_read_profile_avatar',{method:'POST',headers:userHeaders,body:JSON.stringify({p_profile_id:input.profileId})});
    const doc=row(parse(await bytes(owned,8192,abort.signal)));
    if(!owned.ok||!doc||Object.keys(doc).length!==4||doc.profileId!==input.profileId||doc.accountId!==aid||doc.authoritative!==true)
     throw new Safe('MEDIA_NOT_FOUND',403);
    p=doc;
   }
   if(p?.profileId!==input.profileId)throw new Safe('MEDIA_NOT_FOUND',403);
   if(p.avatarPath===null)return json(200,{profileId:input.profileId,photo:null,authoritative:true});
   const path=typeof p.avatarPath==='string'?p.avatarPath.split('/'):[];
   if(path.length!==4||path[1]!=='v5'||!id(path[2]))return json(200,{profileId:input.profileId,photo:null,authoritative:true});
   const a=asset(await rpc('rpc_read_media_asset_service',{p_asset_id:path[2]}));if(a.scope!=='AVATAR'||a.profileId!==input.profileId||a.ref!==p.avatarPath)throw new Safe('MEDIA_NOT_FOUND',403);
   return json(200,{profileId:input.profileId,photo:preview(a),authoritative:true});
  }
  if(req.headers.get('x-media-operation')==='read'){
   const input=row(parse(await bytes(req,2048,abort.signal)));
   if(!input||!id(input.assetId)||Object.keys(input).some(k=>!['assetId','needId','profileId','caseId'].includes(k))
    ||(input.needId!==undefined&&!id(input.needId))||(input.profileId!==undefined&&!id(input.profileId))||(input.caseId!==undefined&&!id(input.caseId))
    ||[input.needId,input.profileId,input.caseId].filter(v=>v!==undefined).length>1)throw new Safe('MEDIA_INPUT_INVALID');
   if(input.caseId!==undefined){
    const caseId=input.caseId,assetId=input.assetId,sessionId=supportSession(authorization,aid,url.origin);
    const authorize=async()=>{
     const r=await fetchBound(url.origin+'/rest/v1/rpc/rpc_support_media_service_v5',{method:'POST',headers:serviceHeaders,
      body:JSON.stringify({p_account_id:aid,p_session_id:sessionId,p_case_id:caseId,p_asset_id:assetId})});
     const data=parse(await bytes(r,8192,abort.signal));if(!r.ok){
      if(row(data)?.message==='AUTH_REQUIRED')throw new Safe('AUTH_REQUIRED',401);
      if(row(data)?.message==='SUPPORT_REFERENCE_NOT_AVAILABLE')throw new Safe('MEDIA_NOT_FOUND',403);
      throw new Error('SUPPORT_MEDIA_UNCONFIRMED');
     }
     return supportMedia(data,caseId,assetId);
    };
    const admitted=await authorize();const b=await objectBytes(admitted.path,admitted.sha256,admitted.byteSize,true);
    try{
     // The private Storage await must not outlive a revoked grant/session. No
     // bytes reach the caller until the same exact authority is checked again.
     supportSession(authorization,aid,url.origin);const current=await authorize();
     if(current.path!==admitted.path||current.sha256!==admitted.sha256||current.byteSize!==admitted.byteSize)throw new Error('SUPPORT_MEDIA_CHANGED');
     if(abort.signal.aborted)throw new Error('CANCELLED');
     return new Response(new Uint8Array(b).buffer,{status:200,headers:{...cors,'Content-Type':'image/jpeg','Content-Length':String(b.length)}});
    }finally{b.fill(0);}
   }
   const a=asset(await rpc('rpc_read_media_asset_service',{p_asset_id:input.assetId}));
   if(a.accountId!==aid){
    if(a.scope==='TASK'&&id(input.needId)){
     const visible=await fetchBound(url.origin+'/rest/v1/needs?id=eq.'+input.needId+'&select=id,public_photo_paths',{headers:userHeaders});
     const rows=parse(await bytes(visible,32768,abort.signal));
     if(!visible.ok||!Array.isArray(rows)||rows.length!==1||rows[0].id!==input.needId||!Array.isArray(rows[0].public_photo_paths)||!rows[0].public_photo_paths.includes(a.ref))throw new Safe('MEDIA_NOT_FOUND',403);
    }else if(a.scope==='AVATAR'&&id(input.profileId)&&input.profileId===a.profileId){
     const visible=await fetchBound(url.origin+'/rest/v1/rpc/rpc_get_public_profile',{method:'POST',headers:userHeaders,body:JSON.stringify({p_profile_id:input.profileId})});
     const profile=row(parse(await bytes(visible,32768,abort.signal)));if(!visible.ok||profile?.profileId!==input.profileId||profile?.avatarPath!==a.ref)throw new Safe('MEDIA_NOT_FOUND',403);
    }else throw new Safe('MEDIA_NOT_FOUND',403);
   }
   const b=await objectBytes(a.ref,a.sha256,a.byteSize);
   return new Response(new Uint8Array(b).buffer,{status:200,headers:{...cors,'Content-Type':'image/jpeg','Content-Length':String(b.length)}});
  }
  const scope=req.headers.get('x-media-scope'),target=req.headers.get('x-media-target'),key=req.headers.get('x-media-request-id'),type=req.headers.get('content-type')?.split(';')[0];
  if(req.headers.get('x-media-operation')!=='upload'||!['TASK','AVATAR'].includes(scope??'')||!id(target)||!id(key)||!['image/jpeg','image/png','image/webp'].includes(type??''))throw new Safe('MEDIA_INPUT_INVALID');
  if(busy)return json(429,{code:'MEDIA_UPLOAD_PENDING'});busy=true;held=true;
  const input=await bytes(req,10485760,abort.signal);if(!input.length)throw new Safe('MEDIA_INPUT_INVALID');
  const claim=row(await rpc('rpc_claim_media_upload_service',{p_account_id:aid,p_scope:scope,p_target_id:target,p_client_request_id:key,
   p_input_sha256:await digest(input),p_input_bytes:input.length,p_input_type:type}));
  if(!claim||typeof claim.acquired!=='boolean')throw new Error('INVALID_CLAIM');const a=asset(claim.asset,aid);
  let staged:Row;
  if(!claim.acquired){
   if(a.state==='READY'||a.state==='FAILED'||a.state==='PROCESSING')return json(200,a);
   staged=row(claim.staged)??{};
   if(staged.dispatchState!=='DISPATCHING'&&!(staged.dispatchState==='SETTLED'&&staged.dispatchOutcome==='STORED'))return json(200,a);
  }else{
   if(!id(claim.attemptId)||a.state!=='PROCESSING')throw new Error('INVALID_CLAIM');
   let sanitized;try{sanitized=sanitizeImage(input,type,await loadMediaRuntime());}
   catch(e){await rpc('rpc_fail_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_attempt_id:claim.attemptId});
    throw new Safe(e instanceof Error&&safeCodes.includes(e.message)?e.message:'MEDIA_SANITIZATION_FAILED');}
   input.fill(0);
   staged=row(await rpc('rpc_stage_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_attempt_id:claim.attemptId,
    p_sha256:await digest(sanitized.bytes),p_width:sanitized.width,p_height:sanitized.height,p_byte_size:sanitized.bytes.length}))??{};
   if(!hash(staged.sha256)||staged.path!==`${aid}/v5/${a.assetId}/${staged.sha256}.jpg`||staged.byteSize!==sanitized.bytes.length)throw new Error('INVALID_STAGE');
   const dispatch=await rpc('rpc_dispatch_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_attempt_id:claim.attemptId});if(dispatch!==true)throw new Error('DISPATCH_UNKNOWN');
   const stored=await fetchBound(url.origin+'/storage/v1/object/profile-media/'+staged.path,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'image/jpeg','x-upsert':'false'},body:new Uint8Array(sanitized.bytes).buffer});
   sanitized.bytes.fill(0);
   if(!stored.ok&&stored.status!==409){
    // 4xx is a definitive rejected write. Timeouts/5xx remain DISPATCHING: an
    // account cleanup cannot mistake an unknown upstream write for quiescence.
    if(stored.status>=400&&stored.status<500)await rpc('rpc_settle_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_storage_sha256:staged.sha256,p_outcome:'REJECTED'});
    throw new Error('STORAGE_UNCONFIRMED');
   }
   void stored.body?.cancel();
  }
  if(!hash(staged.sha256)||staged.path!==`${aid}/v5/${a.assetId}/${staged.sha256}.jpg`||!Number.isInteger(staged.byteSize)||staged.byteSize<1||staged.byteSize>5242880)throw new Error('INVALID_STAGE');
  const verified=await objectBytes(staged.path,staged.sha256,staged.byteSize);verified.fill(0);
  await rpc('rpc_settle_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_storage_sha256:staged.sha256,p_outcome:'STORED'});
  return json(200,asset(await rpc('rpc_complete_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_storage_sha256:staged.sha256}),aid));
 }catch(e){return e instanceof Safe?json(e.status,{code:e.code}):json(503,{code:'MEDIA_UNCONFIRMED'});}
 finally{clearTimeout(timer);req.signal.removeEventListener('abort',stop);stop();if(held)busy=false;}
}
Deno.serve(handleMedia);
