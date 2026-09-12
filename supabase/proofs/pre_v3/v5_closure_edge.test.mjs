// Synthetic transport boundary tests, distinct from the disposable actual Auth/Storage proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadClosureWorker} from './v5_closure_edge_runtime.mjs';
const A='11111111-1111-4111-8111-111111111111',R='22222222-2222-4222-8222-222222222222',G='33333333-3333-4333-8333-333333333333',I='44444444-4444-4444-8444-444444444444',T='55555555-5555-4555-8555-555555555555',H='a'.repeat(64);
const action=(patch={})=>({accountId:A,requestId:R,generation:G,actionId:I,attemptId:T,kind:'STORAGE_DELETE',state:'PENDING',bucket:'profile-media',objectPath:`${A}/v5/${I}/${H}.jpg`,policySha256:H,...patch});
const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
function fixture(patch={},overrides={}){
 const controller=new AbortController(),calls=[];let current=action(patch);const {worker}=loadClosureWorker();
 const t={signal:controller.signal,
  async rpc(name,args){calls.push({name,args});if(overrides[name])return overrides[name](args);
   if(name==='rpc_claim_account_closure_action_service')return current;
   if(name==='rpc_dispatch_account_closure_action_service'){current={...current,state:'DISPATCHED'};return {admitted:true,action:current};}
   if(name==='rpc_complete_account_closure_action_service')return {...current,state:'VERIFIED',evidence:args.p_evidence};
   throw new Error('UNEXPECTED_RPC:'+name);},
  async request(path,init){calls.push({name:init.method,path,body:init.body});if(overrides[init.method])return overrides[init.method](path,init);
   if(init.method==='DELETE')return response({});
   return current.kind==='STORAGE_DELETE'?response({code:'NoSuchKey',statusCode:404},400):response({id:A,deleted_at:new Date().toISOString(),user_metadata:{},app_metadata:{}});}};
 return {calls,controller,run:()=>worker.executeClosureStep(t,A,G)};
}
const count=(f,name)=>f.calls.filter(c=>c.name===name).length;
test('one exact Storage delete, separate object absence, exact generation evidence',async()=>{const f=fixture();assert.equal((await f.run()).kind,'STEP_VERIFIED');
 assert.deepEqual(f.calls.map(c=>c.name),['rpc_claim_account_closure_action_service','rpc_dispatch_account_closure_action_service','DELETE','GET','rpc_complete_account_closure_action_service']);
 assert.deepEqual(JSON.parse(f.calls.find(c=>c.name==='DELETE').body),{prefixes:[action().objectPath]});});
test('Auth erasure uses should_soft_delete true and never reports hard subject deletion',async()=>{const f=fixture({kind:'AUTH_IDENTITY_ERASE',bucket:null,objectPath:null});await f.run();assert.deepEqual(JSON.parse(f.calls.find(c=>c.name==='DELETE').body),{should_soft_delete:true});assert.equal(f.calls.at(-1).args.p_evidence,'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED');});
for(const patch of [{accountId:R},{generation:R},{actionId:null},{attemptId:'invalid'},{policySha256:'invalid'},{bucket:'foreign'},{objectPath:'../private'},{objectPath:`${A}/a/../private`},{objectPath:`${R}/private`},{objectPath:`${A}/%2e%2e`},{objectPath:`${A}/private?secret=1`},{kind:'UNKNOWN'},{extra:'private'}])test('bad claim cannot dispatch '+Object.keys(patch)[0]+JSON.stringify(patch),async()=>{const f=fixture(patch);await assert.rejects(f.run());assert.equal(count(f,'DELETE'),0);assert.equal(count(f,'rpc_dispatch_account_closure_action_service'),0);});
test('unknown prior dispatch is read-only reconciliation, never a destructive retry',async()=>{const f=fixture({state:'DISPATCHED'});await f.run();assert.equal(count(f,'DELETE'),0);assert.equal(count(f,'rpc_dispatch_account_closure_action_service'),0);assert.equal(count(f,'rpc_complete_account_closure_action_service'),1);});
for(const absent of [response({message:'proxy not found'},404),response({code:'NoSuchBucket',statusCode:404},400),response({code:'NoSuchKey',statusCode:403},404),response({},200)])test('generic or ambiguous response never proves object deletion '+absent.status,async()=>{const f=fixture({}, {GET:()=>absent});assert.equal((await f.run()).kind,'PENDING');assert.equal(count(f,'rpc_complete_account_closure_action_service'),0);});
test('late admission after abort cannot call Storage',async()=>{let f;f=fixture({}, {rpc_dispatch_account_closure_action_service:()=>{f.controller.abort();return {admitted:true,action:action({state:'DISPATCHED'})};}});await assert.rejects(f.run());assert.equal(count(f,'DELETE'),0);});
test('late destructive ACK after abort cannot read or mark evidence',async()=>{let f;f=fixture({}, {DELETE:()=>{f.controller.abort();return response({});}});await assert.rejects(f.run());assert.equal(count(f,'GET'),0);assert.equal(count(f,'rpc_complete_account_closure_action_service'),0);});
test('late absence after abort cannot complete',async()=>{let f;f=fixture({}, {GET:()=>{f.controller.abort();return response({code:'NoSuchKey'},404);}});await assert.rejects(f.run());assert.equal(count(f,'rpc_complete_account_closure_action_service'),0);});
test('changed attempt in admission cannot use the old authorization',async()=>{const f=fixture({}, {rpc_dispatch_account_closure_action_service:()=>({admitted:true,action:action({attemptId:R,state:'DISPATCHED'})})});await assert.rejects(f.run());assert.equal(count(f,'DELETE'),0);});
test('duplicate dispatch admission false reconciles only',async()=>{const f=fixture({}, {rpc_dispatch_account_closure_action_service:()=>({admitted:false,action:action({state:'DISPATCHED'})})});await f.run();assert.equal(count(f,'DELETE'),0);});
for(const value of [{id:A,deleted_at:null,user_metadata:{},app_metadata:{}},{id:A,deleted_at:new Date().toISOString(),user_metadata:{email:'still present'},app_metadata:{}},{id:R,deleted_at:new Date().toISOString(),user_metadata:{},app_metadata:{}}])test('Auth metadata/identity not erased never completes '+JSON.stringify(value),async()=>{const f=fixture({kind:'AUTH_IDENTITY_ERASE',bucket:null,objectPath:null},{GET:()=>response(value)});assert.equal((await f.run()).kind,'PENDING');assert.equal(count(f,'rpc_complete_account_closure_action_service'),0);});
test('hard missing Auth user is not proof of approved subject-retaining erasure',async()=>{const f=fixture({kind:'AUTH_IDENTITY_ERASE',bucket:null,objectPath:null},{GET:()=>response({code:'user_not_found'},404)});assert.equal((await f.run()).kind,'PENDING');});
test('worker is disabled by default and rejects non-service access before any RPC',async()=>{
 const base={SUPABASE_URL:'https://closure.test.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_ANON_KEY',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_SECRET'};let io=0;
 const runtime=loadClosureWorker({env:n=>base[n],fetch:async()=>{io++;throw Error('NO_IO_EXPECTED');}});
 const request=(token)=>new Request('https://edge.test.invalid/closure',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({accountId:A,generation:G})});
 assert.equal((await runtime.handler(request('SYNTHETIC_USER_SESSION'))).status,403);
 assert.deepEqual(await(await runtime.handler(request(base.SUPABASE_SERVICE_ROLE_KEY))).json(),{kind:'DISABLED'});assert.equal(io,0);
});
test('maintenance remains bounded and checks no jobs when the current binding is closed',async()=>{
 const base={SUPABASE_URL:'https://closure.test.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_ANON_KEY',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_SECRET',USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED:'true'};let io=0;
 const runtime=loadClosureWorker({env:n=>base[n],fetch:async(url,init)=>{io++;assert.ok(url.endsWith('/rpc/rpc_list_account_closure_work_service'));assert.deepEqual(JSON.parse(init.body),{p_limit:2});return response([]);}});
 const request=n=>new Request('https://edge.test.invalid/closure',{method:'POST',headers:{authorization:`Bearer ${base.SUPABASE_SERVICE_ROLE_KEY}`,'content-type':'application/json'},body:JSON.stringify({action:'maintenance',maxSteps:n})});
 assert.equal((await runtime.handler(request(9))).status,400);assert.equal(io,0);
 assert.deepEqual(await(await runtime.handler(request(2))).json(),{kind:'MAINTENANCE_CHECKED',checked:0,verified:0,pending:0,closed:0,blocked:0});assert.equal(io,1);
});
