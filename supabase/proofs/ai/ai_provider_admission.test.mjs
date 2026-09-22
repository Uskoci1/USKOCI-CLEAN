// Actual current handler with synthetic transports; no DB/provider/hosted proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
import {withDialogue} from './dialogue_fixture.mjs';

const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5);
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const receipt={userMessageId:id(6),assistantMessageId:id(7),proposedCount:0,safety:'ALLOW',schemaVersion:'NEED_FACT_V2',authoritative:true};
const turn=state=>({conversationId:conversation,clientRequestId:key,turnId,state,retryAllowed:false,receipt:state==='SUCCEEDED'?receipt:null});
function fixture({schema='NEED_FACT_V2',stream=false,env:patch={},budget,replay}={}){
 const calls=[],envReads=[],env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',
  AI_PROVIDER:'gemini',GEMINI_API_KEY:'SYNTHETIC_GEMINI',GEMINI_MODEL:'gemini-3.8-flash',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',
  OPENAI_API_KEY:'SYNTHETIC_UNAPPROVED_OPENAI',OPENAI_MODEL:'synthetic-openai',...patch};
 const raw=JSON.stringify(withDialogue({safety:'ALLOW',assistantMessage:'Pregledajte podatke.',facts:[]}));
 const fetch=async(input,init={})=>{
  const url=String(input),body=init.body?JSON.parse(init.body):null;calls.push({url,body,init});
  if(url.endsWith('/auth/v1/user'))return json({id:account});
  if(url.includes('/ai_conversations?'))return json([{id:conversation,account_id:account,status:'OPEN',fact_schema_version:schema}]);
  if(url.includes('/ai_messages?')||url.includes('/ai_structured_facts?'))return json([]);
  if(url.endsWith('/rpc_ai_claim_need_turn_v2_service'))return json({turn:turn(replay??'PROCESSING'),claim:replay?null:{attemptId,
   leaseExpiresAt:new Date(Date.now()+90000).toISOString(),context:{schemaVersion:'NEED_FACT_V2',history:[],activeFacts:[]}}});
  if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return json(budget??{admitted:true,reservationId:id(8),replay:false,code:'AI_TEST_RESERVED'});
  if(url.endsWith('/rpc_ai_dispatch_need_turn_v2_service'))return json(true);
  if(url.endsWith('/rpc_ai_complete_need_turn_v2_service'))return json(turn('SUCCEEDED'));
  if(url.endsWith('/rpc_ai_fail_need_turn_v2_service'))return json(turn('FAILED'));
  if(new URL(url).hostname==='generativelanguage.googleapis.com'){
   const frame={candidates:[{content:{parts:[{text:raw}]},finishReason:'STOP'}]};
   return stream?new Response('data: '+JSON.stringify(frame)+'\n\n',{headers:{'Content-Type':'text/event-stream'}}):json(frame);
  }
  assert.fail('UNEXPECTED_SYNTHETIC_ROUTE');
 };
 const {handler}=loadOwnedIntakeHandler({fetch,env:name=>{envReads.push(name);return env[name];}});
 return {calls,envReads,async invoke(){
  const response=await handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC_USER',
   'Content-Type':'application/json',...(stream?{Accept:'text/event-stream'}:{})},
   body:JSON.stringify({conversationId:conversation,text:'Synthetic task',...(schema==='NEED_FACT_V2'?{clientRequestId:key}:{})})}));
  const body=await response.text();
  const events=response.headers.get('Content-Type')?.startsWith('text/event-stream')?body.trim().split('\n\n').map(x=>JSON.parse(x.slice(6))):null;
  return {status:response.status,events,body:events?null:JSON.parse(body)};
 }};
}
const providers=f=>f.calls.filter(c=>['generativelanguage.googleapis.com','api.openai.com'].includes(new URL(c.url).hostname));
const rpc=(f,name)=>f.calls.filter(c=>c.url.endsWith('/'+name));
const materialWrites=f=>f.calls.filter(c=>/\/rpc_ai_(complete_need_turn_v2_service|apply_legacy_need_turn_service)$/.test(c.url));
const assertDenied=result=>{
 if(result.events){assert.deepEqual(result.events.map(e=>e.kind),['accepted','safe_error']);}
 else {assert.equal(result.status,503);assert.ok(['AI_PROVIDER_NOT_CONFIGURED','AI_STREAM_NOT_CONFIGURED'].includes(result.body.code));}
};

const closedConfigs=[
 ['old OpenAI environment with absent paid flag',{AI_PROVIDER:'openai',USKOCI_GEMINI_PAID_TEST_ENABLED:undefined}],
 ['OpenAI explicitly selected despite paid flag',{AI_PROVIDER:'openai'}],
 ['absent selector with both provider keys',{AI_PROVIDER:undefined}],
 ['different Gemini model',{GEMINI_MODEL:'gemini-other-model'}],
 ['missing Gemini key',{GEMINI_API_KEY:undefined}],
 ['paid flag absent',{USKOCI_GEMINI_PAID_TEST_ENABLED:undefined}],
 ['paid flag false',{USKOCI_GEMINI_PAID_TEST_ENABLED:'false'}],
 ['paid flag wrong case',{USKOCI_GEMINI_PAID_TEST_ENABLED:'TRUE'}],
];
for(const stream of [false,true])for(const schema of ['NEED_FACT_V2','LEGACY_TEXT_V1'])for(const [label,env] of closedConfigs){
 test(`${stream?'SSE':'HTTP'} ${schema}: ${label} is closed before budget, dispatch or provider`,async()=>{
  const f=fixture({stream,schema,env});assertDenied(await f.invoke());
  assert.equal(providers(f).length,0);assert.equal(rpc(f,'rpc_ai_test_budget_reserve_service').length,0);
  assert.equal(rpc(f,'rpc_ai_dispatch_need_turn_v2_service').length,0);assert.deepEqual(materialWrites(f),[]);
  assert.ok(!f.envReads.includes('OPENAI_API_KEY'));assert.ok(!f.envReads.includes('OPENAI_MODEL'));
  if(schema==='LEGACY_TEXT_V1')assert.equal(rpc(f,'rpc_ai_claim_need_turn_v2_service').length,0);
 });
}
for(const stream of [false,true])for(const optionalFlag of [undefined,'false','true']){
 test(`${stream?'SSE':'HTTP'} V2 reserves once before dispatch with optional budget flag ${String(optionalFlag)}`,async()=>{
  const f=fixture({stream,env:{AI_TEST_BUDGET_REQUIRED:optionalFlag}}),result=await f.invoke();
  if(stream)assert.equal(result.events.at(-1).kind,'final');else assert.equal(result.body.state,'SUCCEEDED');
  const budget=rpc(f,'rpc_ai_test_budget_reserve_service');assert.equal(budget.length,1);
  assert.deepEqual(budget[0].body,{p_account_id:account,p_operation_id:key,p_kind:'LLM',p_max_cost_microusd:250000});
  assert.equal(rpc(f,'rpc_ai_dispatch_need_turn_v2_service').length,1);assert.equal(providers(f).length,1);assert.equal(materialWrites(f).length,1);
  assert.ok(f.calls.indexOf(budget[0])<f.calls.indexOf(rpc(f,'rpc_ai_dispatch_need_turn_v2_service')[0]));
  assert.ok(f.calls.indexOf(rpc(f,'rpc_ai_dispatch_need_turn_v2_service')[0])<f.calls.indexOf(providers(f)[0]));
  assert.equal(new URL(providers(f)[0].url).hostname,'generativelanguage.googleapis.com');
  assert.ok(!f.envReads.includes('AI_TEST_BUDGET_REQUIRED'));
 });
}
for(const stream of [false,true]){
 test(`${stream?'SSE':'HTTP'} legacy has no new paid inference even with every approved flag`,async()=>{
  const f=fixture({stream,schema:'LEGACY_TEXT_V1',env:{AI_TEST_BUDGET_REQUIRED:'true'}});assertDenied(await f.invoke());
  assert.equal(providers(f).length,0);assert.equal(rpc(f,'rpc_ai_test_budget_reserve_service').length,0);assert.deepEqual(materialWrites(f),[]);
 });
 for(const code of ['AI_TEST_BUDGET_NOT_READY','AI_TEST_ACCOUNT_NOT_ADMITTED','AI_TEST_BUDGET_EXHAUSTED','AI_TEST_OPERATION_REPLAY']){
  test(`${stream?'SSE':'HTTP'} ${code} cannot dispatch or bypass into another provider`,async()=>{
   const replay=code==='AI_TEST_OPERATION_REPLAY';
   const f=fixture({stream,budget:{admitted:false,reservationId:replay?id(8):null,replay,code}}),result=await f.invoke();
   if(stream)assert.equal(result.events.at(-1).kind,'safe_error');else {assert.equal(result.status,503);assert.equal(result.body.code,code);}
   assert.equal(rpc(f,'rpc_ai_test_budget_reserve_service').length,1);assert.equal(rpc(f,'rpc_ai_dispatch_need_turn_v2_service').length,0);
   assert.equal(providers(f).length,0);assert.deepEqual(materialWrites(f),[]);
  });
 }
 for(const state of ['SUCCEEDED','PROCESSING','FAILED']){
  test(`${stream?'SSE':'HTTP'} ${state} receipt replay survives absent provider configuration`,async()=>{
   const f=fixture({stream,replay:state,env:{AI_PROVIDER:undefined,GEMINI_API_KEY:undefined,GEMINI_MODEL:undefined,USKOCI_GEMINI_PAID_TEST_ENABLED:undefined}});
   const result=await f.invoke();assert.deepEqual(result.body,turn(state));
   assert.equal(result.status,{SUCCEEDED:200,PROCESSING:202,FAILED:409}[state]);
   assert.equal(rpc(f,'rpc_ai_test_budget_reserve_service').length,0);assert.equal(rpc(f,'rpc_ai_dispatch_need_turn_v2_service').length,0);
   assert.equal(providers(f).length,0);assert.deepEqual(materialWrites(f),[]);assert.ok(!f.envReads.includes('GEMINI_API_KEY'));
  });
 }
}
