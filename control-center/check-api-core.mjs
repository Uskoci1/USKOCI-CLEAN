import assert from 'node:assert/strict';
import {createControlApi,CONTROL_API_MAX_RESPONSE_BYTES} from './server/control-api-core.mjs';
const id='11111111-1111-4111-8111-111111111111';
let calls=[];
const baseData={schemaVersion:'CONTROL_OVERVIEW_V1',freshness:'LIVE',capturedAt:'2026-10-04T17:00:00Z',ok:true};
const api=createControlApi({
 authorize:async()=>({authenticated:true,role:'OWNER',userId:id}),
 rpc:async(name,args)=>{calls.push({name,args});return {...baseData,schemaVersion:name==='rpc_control_search_v1'?'CONTROL_SEARCH_V1':baseData.schemaVersion}}
});
let r=await api(new Request('https://control.invalid/api/control/overview'));
assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(calls.at(-1).name,'rpc_control_overview_v1');
r=await api(new Request('https://control.invalid/api/control/search?q=mil&limit=99'));assert.equal(r.status,200);assert.deepEqual(calls.at(-1).args,{p_query:'mil',p_limit:20});
r=await api(new Request('https://control.invalid/api/control/users/'+id));assert.equal(r.status,200);assert.equal(calls.at(-1).name,'rpc_control_user_v1');
r=await api(new Request('https://control.invalid/api/control/tasks/'+id));assert.equal(r.status,200);assert.equal(calls.at(-1).name,'rpc_control_task_v1');
r=await api(new Request('https://control.invalid/api/control/agreements/'+id));assert.equal(r.status,200);assert.equal(calls.at(-1).name,'rpc_control_agreement_v1');
assert.equal((await api(new Request('https://control.invalid/api/control/overview',{method:'POST'}))).status,405);
assert.equal((await api(new Request('https://control.invalid/api/control/users/nope'))).status,400);
assert.equal((await api(new Request('https://control.invalid/api/control/search?q=x'))).status,400);
const denied=createControlApi({authorize:async()=>({authenticated:true,role:'SUPPORT',userId:id}),rpc:async()=>{throw new Error('MUST_NOT_CALL')}});
assert.equal((await denied(new Request('https://control.invalid/api/control/overview'))).status,403);
const unauth=createControlApi({authorize:async()=>({authenticated:false}),rpc:async()=>{throw new Error('MUST_NOT_CALL')}});
assert.equal((await unauth(new Request('https://control.invalid/api/control/overview'))).status,401);
const leak=createControlApi({authorize:async()=>({authenticated:true,role:'OWNER',userId:id}),rpc:async()=>({...baseData,email:'secret@example.invalid'})});
assert.equal((await leak(new Request('https://control.invalid/api/control/overview'))).status,502);
const huge=createControlApi({authorize:async()=>({authenticated:true,role:'OWNER',userId:id}),rpc:async()=>({...baseData,padding:'x'.repeat(CONTROL_API_MAX_RESPONSE_BYTES)})});
assert.equal((await huge(new Request('https://control.invalid/api/control/overview'))).status,502);
assert.ok(CONTROL_API_MAX_RESPONSE_BYTES<=160*1024);
console.log('CONTROL API CORE PASS');
