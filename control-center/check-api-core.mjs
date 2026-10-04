import assert from 'node:assert/strict';
import {createControlApi,CONTROL_API_MAX_RESPONSE_BYTES} from './server/control-api-core.mjs';
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222',now='2026-10-04T17:00:00Z';
const fixtures={
 rpc_control_overview_v1:{schemaVersion:'CONTROL_OVERVIEW_V1',capturedAt:now,freshness:'LIVE',accounts:{registeredTotal:2,registered24h:1,active24h:null,active24hState:'UNKNOWN',active24hReason:'NO_CANONICAL_CROSS_APP_ACTIVITY_SIGNAL'},workers:{activeProfiles:1,availableNow:1},needs:{PUBLISHED:1},responses:{byStatus:{SUBMITTED:1},created24h:1},agreements:{byStatus:{CONFIRMED:1},created24h:1},reviews:{total:0,created24h:0},push:{deliveries24hByState:{},attempts24hByOutcome:{},overdueBacklog:0},ai:{conversations24h:{}},privacy:{containsEmail:false,containsPhone:false,containsExactAddress:false,containsPushToken:false,containsChatBody:false}},
 rpc_control_search_v1:{schemaVersion:'CONTROL_SEARCH_V1',capturedAt:now,freshness:'LIVE',items:[{kind:'USER',id,label:'M P',secondary:'NS',state:'ONBOARDED',matchKind:'NAME_PREFIX'}],hasMore:false,privacy:{returnsEmail:false,returnsPhone:false,returnsExactAddress:false,returnsMessageBody:false}},
 rpc_control_user_v1:{schemaVersion:'CONTROL_USER_V1',capturedAt:now,freshness:'LIVE',account:{id,fullName:'M P',city:'NS',activeMode:'requester',onboardingComplete:true,createdAt:now},profiles:[],counts:{needsByStatus:{},applicationsByStatus:{},agreementsByRoleStatus:{}},reputation:{receivedCount:0,averageRating:null,givenCount:0},recentReceivedEvents:[],lastActivity:null,lastActivityState:'UNKNOWN',lastActivityReason:'NO_CANONICAL_CROSS_APP_ACTIVITY_SIGNAL',privacy:{containsEmail:false,containsPhone:false,containsExactAddress:false,containsPushToken:false,containsChatBody:false}},
 rpc_control_task_v1:{schemaVersion:'CONTROL_TASK_V1',capturedAt:now,freshness:'LIVE',task:{id,status:'PUBLISHED',title:'Test',requiredSlots:1,coveredSlots:0,hasExactLocation:false},applicationsByStatus:{},selections:{byStatus:{},selectedSlots:0},agreements:[],coverage:{requiredSlots:1,coveredSlots:0,state:'EMPTY'},searchAuthority:{state:'UNKNOWN',reason:'READBACK'},recentNeedEvents:[],privacy:{containsExactAddress:false,containsExactCoordinates:false,containsChatBody:false}},
 rpc_control_agreement_v1:{schemaVersion:'CONTROL_AGREEMENT_V1',capturedAt:now,freshness:'LIVE',agreement:{id,needId:id2,status:'CONFIRMED',currentVersion:1,createdAt:now},task:{title:'Test',city:'NS',area:'Centar',hasExactLocation:false},requester:{accountId:id,profileId:id,displayName:'A',city:'NS'},worker:{accountId:id2,profileId:id2,displayName:'B',city:'NS'},acceptedTerms:{priceRsd:1000,coveredSlots:1,proposedStartAt:null,proposedEndAt:null,needRevision:1,responseVersion:1},execution:{state:'CONFIRMED'},messages:{count:0,lastMessageAt:null},reviews:{count:0,requesterSubmitted:false,workerSubmitted:false},privacy:{containsMessageBody:false,containsExactAddress:false,containsExactCoordinates:false}}
};
let calls=[],audits=[];
const api=createControlApi({
 authorize:async()=>({authenticated:true,role:'OWNER',userId:id}),
 rpc:async(name,args,ctx)=>{calls.push({name,args,ctx});return structuredClone(fixtures[name])},
 audit:async e=>audits.push(e)
});
let r=await api(new Request('https://control.invalid/api/control/overview'));
assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0');assert.ok(r.headers.get('x-control-request-id'));assert.equal(calls.at(-1).name,'rpc_control_overview_v1');
r=await api(new Request('https://control.invalid/api/control/search?q=mil&limit=99'));assert.equal(r.status,200);assert.deepEqual(calls.at(-1).args,{p_query:'mil',p_limit:20});assert.equal(audits.at(-1).queryLength,3);assert.equal('p_query' in audits.at(-1),false);
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
const leak=createControlApi({authorize:async()=>({authenticated:true,role:'OWNER',userId:id}),rpc:async()=>({...structuredClone(fixtures.rpc_control_overview_v1),email:'secret@example.invalid'})});
let bad=await leak(new Request('https://control.invalid/api/control/overview'));assert.equal(bad.status,502);assert.deepEqual(Object.keys(await bad.json()).sort(),['error','requestId']);
const wrongSchema=createControlApi({authorize:async()=>({authenticated:true,role:'OWNER',userId:id}),rpc:async()=>({...structuredClone(fixtures.rpc_control_task_v1),schemaVersion:'CONTROL_TASK_V2'})});
bad=await wrongSchema(new Request('https://control.invalid/api/control/tasks/'+id));assert.equal(bad.status,502);
const rawError=createControlApi({authorize:async()=>({authenticated:true,role:'OWNER',userId:id}),rpc:async()=>{throw new Error('SQL_SECRET_TABLE_NAME')}});
bad=await rawError(new Request('https://control.invalid/api/control/overview'));const body=await bad.json();assert.equal(bad.status,502);assert.equal(JSON.stringify(body).includes('SQL_SECRET_TABLE_NAME'),false);
assert.ok(CONTROL_API_MAX_RESPONSE_BYTES<=160*1024);
assert.ok(audits.some(x=>x.outcome==='READ_OK'));
console.log('CONTROL API CORE SCHEMA/AUDIT PASS');
