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
test('PKG-030: the server key on apikey is accepted without a Bearer; a person or a near key is not',async()=>{
 const base={SUPABASE_URL:'https://closure.test.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_ANON_KEY',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_SECRET'};let io=0;
 const runtime=loadClosureWorker({env:n=>base[n],fetch:async()=>{io++;throw Error('NO_IO_EXPECTED');}});
 const request=headers=>new Request('https://edge.test.invalid/closure',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({accountId:A,generation:G})});
 assert.deepEqual(await(await runtime.handler(request({apikey:base.SUPABASE_SERVICE_ROLE_KEY}))).json(),{kind:'DISABLED'});
 for(const [headers,status] of [[{apikey:base.SUPABASE_SERVICE_ROLE_KEY+'x'},401],[{apikey:base.SUPABASE_ANON_KEY},401],[{},401],
  [{apikey:base.SUPABASE_ANON_KEY,authorization:'Bearer SYNTHETIC_USER_SESSION'},403]])assert.equal((await runtime.handler(request(headers))).status,status);
 assert.equal(io,0);
});
test('maintenance remains bounded and checks no jobs when the current binding is closed',async()=>{
 const base={SUPABASE_URL:'https://closure.test.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_ANON_KEY',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_SECRET',USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED:'true'};let io=0;
 const runtime=loadClosureWorker({env:n=>base[n],fetch:async(url,init)=>{io++;assert.ok(url.endsWith('/rpc/rpc_list_account_closure_work_service'));assert.deepEqual(JSON.parse(init.body),{p_limit:2});return response([]);}});
 const request=n=>new Request('https://edge.test.invalid/closure',{method:'POST',headers:{authorization:`Bearer ${base.SUPABASE_SERVICE_ROLE_KEY}`,'content-type':'application/json'},body:JSON.stringify({action:'maintenance',maxSteps:n})});
 assert.equal((await runtime.handler(request(9))).status,400);assert.equal(io,0);
 assert.deepEqual(await(await runtime.handler(request(2))).json(),{kind:'MAINTENANCE_CHECKED',checked:0,verified:0,pending:0,closed:0,blocked:0});assert.equal(io,1);
});
const relational=(patch={})=>({accountId:A,generation:G,actionId:I,attemptId:T,kind:'RELATIONAL_REDACT',state:'DISPATCHED',rowsChanged:100,completedSteps:1,totalSteps:74,authoritative:true,...patch});
test('AF22 relational dispatch calls only the bounded canonical SQL step, never Storage/Auth HTTP',async()=>{
 const f=fixture({kind:'RELATIONAL_REDACT',bucket:null,objectPath:null},{rpc_redact_account_closure_step_service:()=>relational()});
 assert.equal((await f.run()).kind,'RELATIONAL_PROGRESS');
 assert.deepEqual(f.calls.map(c=>c.name),['rpc_claim_account_closure_action_service','rpc_dispatch_account_closure_action_service','rpc_redact_account_closure_step_service']);
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1).args)),{p_account_id:A,p_generation:G,p_action_id:I,p_attempt_id:T});
});
test('unknown relational response can resume the same generation without another dispatch or external write',async()=>{
 const f=fixture({kind:'RELATIONAL_REDACT',bucket:null,objectPath:null,state:'DISPATCHED'},{rpc_redact_account_closure_step_service:()=>relational({state:'VERIFIED',rowsChanged:0,completedSteps:74})});
 assert.equal((await f.run()).kind,'STEP_VERIFIED');assert.equal(count(f,'rpc_dispatch_account_closure_action_service'),0);assert.equal(count(f,'DELETE'),0);
});
for(const patch of [{accountId:R},{generation:R},{attemptId:R},{actionId:R},{rowsChanged:101},{rowsChanged:-1},{completedSteps:75},{totalSteps:0},{state:'VERIFIED'},{authoritative:false},{rawContent:'UNTRUSTED'},{state:'CLOSED'}])test('AF22 rejects malformed or cross-generation relational receipt '+Object.keys(patch)[0],async()=>{
 const f=fixture({kind:'RELATIONAL_REDACT',bucket:null,objectPath:null,state:'DISPATCHED'},{rpc_redact_account_closure_step_service:()=>relational(patch)});
 await assert.rejects(f.run());assert.equal(count(f,'DELETE'),0);assert.equal(count(f,'rpc_complete_account_closure_action_service'),0);
});
test('late relational receipt after cancellation cannot be claimed as verified',async()=>{
 let f;f=fixture({kind:'RELATIONAL_REDACT',bucket:null,objectPath:null,state:'DISPATCHED'},{rpc_redact_account_closure_step_service:()=>{f.controller.abort();return relational({state:'VERIFIED',completedSteps:74});}});await assert.rejects(f.run());
});
const erasureProgress=(patch={})=>({accountId:A,requestId:R,generation:G,state:'EXECUTING',policySha256:H,adapterVersion:'OWNER_AF_D22_EVENT_ERASURE_V1',ordinaryContentErased:true,completedSteps:74,totalSteps:74,exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED'],authoritative:true,...patch});
test('scoped exceptions produce truthful pending progress and no Auth dispatch',async()=>{
 const f=fixture({}, {rpc_claim_account_closure_action_service:()=>({kind:'EXCEPTIONS_PENDING',progress:erasureProgress()})});
 assert.equal((await f.run()).kind,'EXCEPTIONS_PENDING');assert.equal(f.calls.length,1);
});
for(const patch of [{ordinaryContentErased:false},{exceptions:[]},{exceptions:['ARBITRARY']},{exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED','SCOPED_EVIDENCE_REVIEW_REQUIRED']},{state:'CLOSED'},{accountId:R},{completedSteps:70},{body:'PRIVATE'}])test('scoped pending cannot hide malformed progress '+Object.keys(patch)[0],async()=>{
 const f=fixture({}, {rpc_claim_account_closure_action_service:()=>({kind:'EXCEPTIONS_PENDING',progress:erasureProgress(patch)})});await assert.rejects(f.run());assert.equal(f.calls.length,1);
});
const erasedClosed=(patch={})=>({accountId:A,requestId:R,generation:G,state:'CLOSED',closedAt:'2026-09-13T09:00:00Z',policySha256:H,authOutcome:'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED',mediaOutcome:'OWNED_OBJECTS_DELETED',relationalOutcome:'ORDINARY_PERSONAL_CONTENT_ERASED',retainedDatasets:[],authoritative:true,adapterVersion:'OWNER_AF_D22_EVENT_ERASURE_V1',pseudonymousAuditRetained:true,exceptions:[],...patch});
test('AF22 CLOSED states ordinary erasure and explicit pseudonymous audit retention',()=>{
 const {worker}=loadClosureWorker();assert.equal(worker.decodeClosed(erasedClosed(),A,G).pseudonymousAuditRetained,true);
});
for(const patch of [{relationalOutcome:'RETAINED_RESTRICTED'},{exceptions:['SCOPED_EVIDENCE_REVIEW_REQUIRED']},{retainedDatasets:[{retentionSeconds:30}]},{pseudonymousAuditRetained:false},{adapterVersion:'UNREVIEWED'},{privateCopy:'RAW'}])test('AF22 CLOSED rejects an incomplete or invented outcome '+Object.keys(patch)[0],()=>{
 const {worker}=loadClosureWorker();assert.throws(()=>worker.decodeClosed(erasedClosed(patch),A,G));
});
