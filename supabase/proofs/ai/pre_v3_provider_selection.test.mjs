// Exact production Edge handler, synthetic transport only. NOT provider/DB/device proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const content={safety:'ALLOW',assistantMessage:'Razumem. Potrebne su dve osobe u Novom Sadu. Proverite unos.',facts:[{key:'need.people_needed',valueJson:'2',displayValue:'Dve osobe',confidence:0.9,evidence:'dve osobe'}]};
const stored={conversationId:conversation,clientRequestId:key,state:'SUCCEEDED',turnId,retryAllowed:false,receipt:{userMessageId:id(6),assistantMessageId:id(7),proposedCount:1,safety:'ALLOW',schemaVersion:'NEED_FACT_V2',authoritative:true}};
function fixture(options={}){
 const env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',OPENAI_API_KEY:'SYNTHETIC_OPENAI_SECRET',OPENAI_MODEL:'synthetic-openai',GEMINI_API_KEY:'SYNTHETIC_GEMINI_SECRET',GEMINI_MODEL:'synthetic-gemini',...options.env};
 const calls=[],logs=[],envReads=[];
 const clock=Date.parse('2026-09-12T16:00:00Z');
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const runtime=loadOwnedIntakeHandler({env:name=>{envReads.push(name);return env[name];},Date:FixedDate,log:args=>logs.push(args),
  setTimeout:options.setTimeout??setTimeout,clearTimeout:options.clearTimeout??clearTimeout,
  fetch:async(input,init={})=>{
   const url=String(input),body=init.body?JSON.parse(init.body):null;calls.push({url,body,init});
   if(url.endsWith('/auth/v1/user'))return json({id:account});
   if(url.includes('/ai_conversations?'))return json([{id:conversation,account_id:account,status:'OPEN',fact_schema_version:'NEED_FACT_V2'}]);
   if(url.endsWith('/rpc_ai_claim_need_turn_v2_service'))return json(options.replay?{turn:stored,claim:null}:{turn:{...stored,state:'PROCESSING',receipt:null},claim:{attemptId,leaseExpiresAt:new Date(clock+90000).toISOString(),context:{schemaVersion:'NEED_FACT_V2',history:[],activeFacts:[]}}});
   if(url==='https://api.openai.com/v1/responses'||url.startsWith('https://generativelanguage.googleapis.com/')){
    if(options.provider)return options.provider(url,init);
    return json(url.includes('api.openai.com')?{status:'completed',output_text:JSON.stringify(content)}:{candidates:[{content:{parts:[{text:JSON.stringify(content)}]}}]});
   }
   if(url.endsWith('/rpc_ai_complete_need_turn_v2_service'))return json(stored);
   if(url.endsWith('/rpc_ai_fail_need_turn_v2_service'))return json({...stored,state:'FAILED',receipt:null,retryAllowed:true});
   assert.fail('UNEXPECTED_SYNTHETIC_ROUTE');
  }});
 const invoke=()=>runtime.handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC_USER','Content-Type':'application/json'},body:JSON.stringify({conversationId:conversation,clientRequestId:key,text:'Trebaju mi dve osobe u Novom Sadu.'})}));
 return {invoke,calls,logs,envReads};
}
const providers=f=>f.calls.filter(x=>x.url.includes('api.openai.com')||x.url.includes('generativelanguage.googleapis.com'));
const completes=f=>f.calls.filter(x=>x.url.endsWith('/rpc_ai_complete_need_turn_v2_service'));
for(const [name,env,expected] of [
 ['both configured, implicit OpenAI primary',{},'openai'],
 ['OpenAI only',{GEMINI_API_KEY:undefined,GEMINI_MODEL:undefined},'openai'],
 ['Gemini fallback when OpenAI key missing',{OPENAI_API_KEY:undefined},'gemini'],
 ['Gemini fallback when OpenAI model missing',{OPENAI_MODEL:undefined},'gemini'],
 ['explicit OpenAI',{AI_PROVIDER:'openai'},'openai'],
 ['explicit Gemini override',{AI_PROVIDER:'gemini'},'gemini'],
])test(name,async()=>{
 const f=fixture({env});const r=await f.invoke();assert.equal(r.status,200);assert.deepEqual(await r.json(),stored);
 assert.equal(providers(f).length,1);assert.equal(providers(f)[0].url.includes(expected==='openai'?'api.openai.com':'generativelanguage.googleapis.com'),true);
 assert.equal(completes(f).length,1);assert.equal(completes(f)[0].body.p_assistant_message,content.assistantMessage);
 assert.deepEqual(completes(f)[0].body.p_proposals,[{key:'need.people_needed',value:2,displayValue:'Dve osobe',confidence:0.9,evidence:'dve osobe'}]);
 assert.equal(completes(f)[0].body.p_account_id,account);assert.equal(completes(f)[0].body.p_client_request_id,key);
 assert.ok(f.calls.every(x=>x.init.redirect==='error'));
});
for(const env of [{AI_PROVIDER:''},{AI_PROVIDER:'unknown'},{AI_PROVIDER:'openai',OPENAI_API_KEY:undefined},{AI_PROVIDER:'gemini',GEMINI_MODEL:undefined},{OPENAI_MODEL:undefined,GEMINI_MODEL:undefined}])test('invalid or incomplete explicit configuration fails closed',async()=>{
 const f=fixture({env});const r=await f.invoke();assert.equal(r.status,503);assert.equal((await r.json()).code,'AI_PROVIDER_NOT_CONFIGURED');
 assert.equal(providers(f).length,0);assert.equal(completes(f).length,0);
});
for(const provider of ['openai','gemini'])for(const status of [429,500,503])test(`${provider} HTTP ${status} does not retry or switch provider`,async()=>{
 const f=fixture({env:{AI_PROVIDER:provider},provider:()=>new Response('PRIVATE_PROVIDER_BODY',{status})});
 const r=await f.invoke();assert.equal(r.status,502);assert.equal((await r.json()).code,'AI_PROVIDER_FAILED');
 assert.equal(providers(f).length,1);assert.equal(completes(f).length,0);assert.ok(!JSON.stringify(f.logs).includes('PRIVATE_PROVIDER_BODY'));
});
for(const provider of ['openai','gemini'])for(const mode of ['malformed','schema','unavailable'])test(`${provider} ${mode} response cannot persist success`,async()=>{
 const f=fixture({env:{AI_PROVIDER:provider},provider:()=>{
  if(mode==='unavailable')throw new Error('PRIVATE_PROVIDER_STACK');
  const raw=mode==='malformed'?'not-json':JSON.stringify({...content,safety:'UNKNOWN'});
  return json(provider==='openai'?{status:'completed',output_text:raw}:{candidates:[{content:{parts:[{text:raw}]}}]});
 }});
 const r=await f.invoke();const body=await r.json();assert.equal(r.status,502);assert.equal(body.code,'AI_PROVIDER_FAILED');
 assert.equal(providers(f).length,1);assert.equal(completes(f).length,0);assert.ok(!JSON.stringify([body,f.logs]).includes('PRIVATE_PROVIDER_STACK'));
});
for(const provider of ['openai','gemini'])test(`${provider} timeout fences late output and never falls back`,async()=>{
 let resolve;const late=new Promise(r=>{resolve=r;});const timers=new Map();let sequence=0;
 const f=fixture({env:{AI_PROVIDER:provider},provider:()=>late,setTimeout:(fn,ms)=>{const n=++sequence;timers.set(n,{fn,ms});return n;},clearTimeout:n=>timers.delete(n)});
 const running=f.invoke();for(let n=0;n<100&&!providers(f).length;n++)await new Promise(r=>setImmediate(r));
 assert.equal(providers(f).length,1);const deadline=[...timers.values()].find(x=>x.ms===12000);assert.ok(deadline);deadline.fn();
 assert.equal((await running).status,502);resolve(json({output_text:JSON.stringify(content)}));await new Promise(r=>setImmediate(r));
 assert.equal(completes(f).length,0);assert.equal(providers(f).length,1);
});
test('successful replay uses stored receipt even after provider config disappears',async()=>{
 const f=fixture({replay:true,env:{OPENAI_API_KEY:undefined,GEMINI_API_KEY:undefined}});
 assert.deepEqual(await(await f.invoke()).json(),stored);assert.equal(providers(f).length,0);assert.equal(completes(f).length,0);
 assert.ok(!f.envReads.includes('OPENAI_API_KEY'));
});
