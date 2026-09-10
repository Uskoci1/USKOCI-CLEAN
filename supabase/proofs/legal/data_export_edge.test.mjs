// Real handlers/HTTP/stream primitives; ALL Auth, SQL and Storage transport is
// synthetic here. The separate disposable proof establishes actual Storage IO.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {loadExportHandler} from './data_export_edge_runtime.mjs';
const A='11111111-1111-4111-8111-111111111111',R='22222222-2222-4222-8222-222222222222',G='33333333-3333-4333-8333-333333333333',L='44444444-4444-4444-8444-444444444444',B='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bytes=Buffer.from(JSON.stringify({fixture:'SYNTHETIC_ONLY',ownData:'example'})),SHA=createHash('sha256').update(bytes).digest('hex'),MD5=createHash('md5').update(bytes).digest('hex');
const BUCKET='data-export-artifacts',PATH=`${A}/${R}/${G}.json`,TIME=Date.parse('2026-09-10T15:00:00Z'),EXP='2026-09-10T15:01:00Z';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const claim=()=>({kind:'CLAIMED',receiptId:R,accountId:A,attemptId:G,leaseExpiresAt:EXP,snapshotText:bytes.toString('utf8'),byteLength:bytes.length,sha256:SHA,md5:MD5,bucket:BUCKET,objectPath:PATH,artifactExpiresAt:EXP});
const target=()=>({receiptId:R,accountId:A,downloadGrantId:L,artifactGeneration:G,expiresAt:EXP,artifactExpiresAt:EXP,bucket:BUCKET,objectPath:PATH,byteLength:bytes.length,sha256:SHA,md5:MD5});
function fixture(kind='worker',overrides={}) {
  const calls=[],timers=new Map();let next=0,now=TIME,removed=false;
  class Clock extends Date {static now(){return now;}}
  const environment={SUPABASE_URL:'https://database.test.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_ANON',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_SECRET',...overrides.env};
  const runtime=loadExportHandler(kind,{env:name=>environment[name],Date:Clock,
    setTimeout:(fn,ms)=>{assert.equal(ms,55000);const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    fetch:async(url,init)=>{
      const parsed=new URL(url);assert.equal(parsed.origin,'https://database.test.invalid');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
      const name=parsed.pathname==='/auth/v1/user'?'auth':parsed.pathname.startsWith('/rest/v1/rpc/')?parsed.pathname.split('/').at(-1):init.method==='POST'?'upload':init.method==='DELETE'?'delete':'object';
      const call={name,path:parsed.pathname,headers:Object.fromEntries(new Headers(init.headers)),body:ArrayBuffer.isView(init.body)?Buffer.from(init.body):init.body,method:init.method,signal:init.signal};calls.push(call);
      if(overrides[name])return overrides[name](call,calls.filter(c=>c.name===name).length);
      if(name==='auth')return reply({id:A,role:'authenticated',email:'SYNTHETIC_PRIVATE_EMAIL'});
      if(name==='rpc_get_data_export_status')return reply({hasRequest:true,request:{receiptId:R,status:'REQUESTED'}});
      if(name==='rpc_claim_data_export')return reply(claim());
      if(name==='rpc_complete_data_export')return reply({receiptId:R,status:'READY',artifactGeneration:G,idempotentReplay:false});
      if(name==='rpc_fail_data_export')return reply({receiptId:R,status:'REQUESTED',retryScheduled:true});
      if(name==='rpc_authorize_data_export_download')return reply({receiptId:R,downloadGrantId:L,artifactGeneration:G,expiresAt:EXP});
      if(name==='rpc_resolve_data_export_download')return reply(target());
      if(name==='rpc_claim_data_export_cleanup')return reply({kind:'CLAIMED',receiptId:R,accountId:A,artifactGeneration:G,cleanupAttemptId:L,leaseExpiresAt:EXP,bucket:BUCKET,objectPath:PATH});
      if(name==='rpc_complete_data_export_cleanup')return reply({receiptId:R,artifactGeneration:G,deleted:JSON.parse(init.body).p_deleted});
      if(name==='upload')return reply({Key:PATH});
      if(name==='delete'){removed=true;return reply([{name:PATH}]);}
      if(name==='object')return removed?reply({code:'NoSuchKey',message:'Object missing'},404):new Response(bytes,{headers:{'content-type':'application/json'}});
      throw new Error('UNEXPECTED_TRANSPORT');
    }});
  return {...runtime,calls,timers,advance:ms=>{now+=ms;},expire:()=>{for(const fn of [...timers.values()])fn();},
    invoke:(body=kind==='worker'?{action:'prepare',receiptId:R}:{receiptId:R,artifactGeneration:G},headers={})=>runtime.handler(new Request('https://edge.test.invalid/export',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC_USER_SESSION','Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)}))};
}
const count=(f,name)=>f.calls.filter(c=>c.name===name).length;
async function reached(f,name){for(let i=0;i<300&&count(f,name)===0;i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(count(f,name)>0,name);}
test('owned prepare uploads exact frozen bytes without upsert, reads SHA256 back, then records READY',async()=>{
  const f=fixture(),res=await f.invoke();assert.equal(res.status,200);assert.deepEqual(await res.json(),{receiptId:R,kind:'READY'});
  assert.deepEqual(f.calls.map(c=>c.name),['auth','rpc_get_data_export_status','rpc_claim_data_export','upload','object','rpc_complete_data_export']);
  const upload=f.calls.find(c=>c.name==='upload');assert.equal(upload.headers['x-upsert'],'false');assert.equal(upload.path,`/storage/v1/object/${BUCKET}/${PATH}`);
  assert.deepEqual(upload.body,bytes);
  assert.deepEqual(JSON.parse(f.calls.find(c=>c.name==='rpc_claim_data_export').body),{p_receipt_id:R,p_account_id:A});
  assert.equal(f.calls.find(c=>c.name==='rpc_complete_data_export').headers.authorization,'Bearer SYNTHETIC_SERVICE_SECRET');assert.equal(f.timers.size,0);
});
test('missing reviewed policy produces no upload or fabricated READY',async()=>{
  const f=fixture('worker',{rpc_claim_data_export:()=>reply({kind:'NOT_READY',code:'EXPORT_POLICY_NOT_READY'})});
  assert.deepEqual(await(await f.invoke()).json(),{receiptId:R,kind:'NOT_READY',code:'POLICY_NOT_READY'});assert.equal(count(f,'upload'),0);
});
test('an empty claim never invents PROCESSING or READY',async()=>{
  const f=fixture('worker',{rpc_claim_data_export:()=>reply({kind:'NONE'})});
  assert.deepEqual(await(await f.invoke()).json(),{receiptId:R,kind:'NOT_READY',code:'NOT_AVAILABLE'});assert.equal(count(f,'upload'),0);
});
test('foreign receipt cannot reach claim or Storage',async()=>{const f=fixture('worker',{rpc_get_data_export_status:()=>reply({hasRequest:true,request:{receiptId:B}})});assert.equal((await(await f.invoke()).json()).code,'NOT_AVAILABLE');assert.equal(count(f,'rpc_claim_data_export'),0);});
for(const patch of [{accountId:B},{receiptId:B},{objectPath:`${B}/${R}/${G}.json`},{objectPath:'../private'},{bucket:'profile-media'},{sha256:'private'},{md5:'private'},{byteLength:8388609},{leaseExpiresAt:'2026-09-10T14:00:00Z'},{extra:'PRIVATE'}])test('malformed claim never uploads '+Object.keys(patch)[0],async()=>{
  const f=fixture('worker',{rpc_claim_data_export:()=>reply({...claim(),...patch})});assert.equal((await f.invoke()).status,502);assert.equal(count(f,'upload'),0);
});
test('altered snapshot hash and corrupt stored bytes cannot complete',async()=>{
  for(const override of [{rpc_claim_data_export:()=>reply({...claim(),snapshotText:'wrong'})},{object:()=>new Response('corrupt')}]){
    const f=fixture('worker',override);assert.equal((await(await f.invoke()).json()).kind,'NOT_READY');assert.equal(count(f,'rpc_complete_data_export'),0);assert.equal(count(f,'delete'),0);
  }
});
test('uncertain completion uses fenced failure and never opportunistically deletes',async()=>{
  const f=fixture('worker',{rpc_complete_data_export:()=>{throw new Error('SYNTHETIC_TRANSPORT_LOSS');}});assert.equal((await(await f.invoke()).json()).code,'RETRY_REQUIRED');assert.equal(count(f,'rpc_fail_data_export'),1);assert.equal(count(f,'delete'),0);
});
test('real user Auth rejection prevents all privileged RPCs and Storage',async()=>{for(const kind of ['worker','download']){const f=fixture(kind,{auth:()=>reply({message:'PRIVATE'},401)});assert.equal((await f.invoke()).status,401);assert.equal(f.calls.length,1);}});
test('internal tick requires exact service credential, never a user-supplied actor id',async()=>{
  const rejected=fixture();assert.equal((await rejected.invoke({action:'tick'})).status,400);assert.equal(count(rejected,'rpc_claim_data_export'),0);
  const f=fixture();assert.deepEqual(await(await f.invoke({action:'tick'},{Authorization:'Bearer SYNTHETIC_SERVICE_SECRET'})).json(),{kind:'TICK_COMPLETED'});assert.equal(count(f,'auth'),0);assert.equal(count(f,'rpc_claim_data_export_cleanup'),1);
});
test('cleanup proves missing exact object before recording deleted',async()=>{
  const f=fixture();await f.invoke({action:'cleanup',receiptId:R});assert.equal(JSON.parse(f.calls.find(c=>c.name==='delete').body).prefixes[0],PATH);
  assert.equal(JSON.parse(f.calls.find(c=>c.name==='rpc_complete_data_export_cleanup').body).p_deleted,true);
});
for(const [status,body,deleted] of [[404,{code:'TenantNotFound'},false],[404,{code:'NoSuchBucket'},false],[500,{code:'NoSuchKey'},false],[403,{code:'NoSuchKey'},false],[400,{statusCode:'404',error:'not_found'},true],[404,{message:'proxy missing'},false]])test('cleanup absence interpretation '+status+' '+JSON.stringify(body),async()=>{
  const f=fixture('worker',{object:()=>reply(body,status)});await f.invoke({action:'cleanup',receiptId:R});assert.equal(JSON.parse(f.calls.find(c=>c.name==='rpc_complete_data_export_cleanup').body).p_deleted,deleted);
});
test('download authenticates same owner, verifies actual bytes and rechecks grant before release',async()=>{
  const f=fixture('download'),r=await f.invoke();assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);
  assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-uskoci-export-generation'),G);assert.equal(r.headers.get('x-uskoci-export-sha256'),SHA);
  assert.equal(count(f,'rpc_resolve_data_export_download'),2);assert.equal(f.calls.find(c=>c.name==='rpc_authorize_data_export_download').headers.authorization,'Bearer SYNTHETIC_USER_SESSION');
  assert.deepEqual(JSON.parse(f.calls.find(c=>c.name==='rpc_resolve_data_export_download').body),{p_receipt_id:R,p_download_grant_id:L,p_account_id:A});
});
for(const patch of [{accountId:B},{artifactGeneration:B},{downloadGrantId:B},{bucket:'profile-media'},{objectPath:'signed-url'},{byteLength:8388609},{extra:'PRIVATE'},{expiresAt:'2026-09-10T14:00:00Z'}])test('download refuses malformed grant target '+Object.keys(patch)[0],async()=>{
  const f=fixture('download',{rpc_resolve_data_export_download:()=>reply({...target(),...patch})});assert.equal((await f.invoke()).status,502);assert.equal(count(f,'object'),0);
});
test('grant revoked while reading Storage releases no artifact bytes',async()=>{const f=fixture('download',{rpc_resolve_data_export_download:(_c,n)=>n===1?reply(target()):reply({message:'REVOKED'},409)});const r=await f.invoke();assert.equal(r.status,409);assert.equal((await r.json()).code,'EXPORT_NOT_AVAILABLE');});
test('download corrupt body, expired grant and generic storage errors release no file',async()=>{
  for(const override of [{object:()=>new Response('corrupt')},{object:()=>reply({message:'PRIVATE'},500)},{object:()=>{f.advance(61000);return new Response(bytes);}}]){
    var f=fixture('download',override);assert.notEqual((await f.invoke()).status,200);
  }
});
test('unsupported Range, body actor spoof and oversized JSON stop before Storage',async()=>{
  const f=fixture('download');assert.equal((await f.invoke(undefined,{Range:'bytes=0-1'})).status,416);assert.equal(f.calls.length,0);
  const spoof=fixture();assert.equal((await spoof.invoke({action:'prepare',receiptId:R,accountId:B})).status,400);assert.equal(count(spoof,'rpc_claim_data_export'),0);
  const huge=fixture();assert.equal((await huge.invoke('x'.repeat(3000))).status,413);assert.equal(count(huge,'upload'),0);
});
test('hard timeout fences a late claim response before any Storage mutation',async()=>{
  let resolve;const f=fixture('worker',{rpc_claim_data_export:()=>new Promise(done=>{resolve=done;})}),pending=f.invoke();await reached(f,'rpc_claim_data_export');f.expire();assert.equal((await pending).status,503);
  resolve(reply(claim()));for(let i=0;i<20;i++)await new Promise(done=>setImmediate(done));assert.equal(count(f,'upload'),0);assert.equal(count(f,'rpc_complete_data_export'),0);
});
test('same-isolate concurrent user request cannot duplicate the worker',async()=>{
  let resolve;const f=fixture('worker',{rpc_claim_data_export:()=>new Promise(done=>{resolve=done;})}),first=f.invoke();await reached(f,'rpc_claim_data_export');assert.equal((await f.invoke()).status,429);resolve(reply({kind:'NONE'}));await first;assert.equal(count(f,'rpc_claim_data_export'),1);
});
