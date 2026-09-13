// Exact source, explicitly synthetic I/O. No live provider or database proof.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import vm from 'node:vm';import ts from 'typescript';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account=id(1),conversation=id(2),key=id(3),turnId=id(4),attemptId=id(5);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const turn=(state='SUCCEEDED')=>({turnId,conversationId:conversation,clientRequestId:key,attemptId,state,retryAllowed:false,authoritative:true});
function fixture(options={}){
 let handler;const calls=[],env={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'PUBLIC_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'SERVICE_SYNTHETIC',
  AI_PROVIDER:'gemini',GEMINI_MODEL:'gemini-3.8-flash',GEMINI_API_KEY:'PROVIDER_SYNTHETIC',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',...options.env};
 const output=options.output??{assistantMessage:'Profil je spreman za zajednički pregled 🟢.',safety:'ALLOW',patch:{skills:['Prenos stvari'],teamCapacity:3}};
 const fetch=async(url,init={})=>{
  calls.push({url:String(url),body:init.body?JSON.parse(init.body):null,init});
  if(url.endsWith('/auth/v1/user'))return json(options.auth??{id:account});
  if(url.endsWith('/rpc_claim_worker_ai_turn_service'))return json({acquired:!options.replay,turn:turn(options.replay?'SUCCEEDED':'PROCESSING')});
  if(url.endsWith('/rpc_read_worker_ai_context_service'))return json(options.context??{schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:false,safety:'ALLOW',candidate:{skills:[],availability:{timezone:'Europe/Belgrade',rules:[],windows:[]}},messages:[{role:'USER',body:'SYNTHETIC_USER_MESSAGE'}]});
  if(url.endsWith('/rpc_ai_test_budget_reserve_service'))return json(options.budget??{admitted:true,reservationId:id(8),replay:false,code:'AI_TEST_RESERVED'});
  // Explicit synthetic141 dispatch authorization. This unit transport does not
  // stand in for the separate actual Auth/Postgres race proof.
  if(url.endsWith('/rpc_dispatch_worker_ai_turn_service')){
   if(options.dispatchError)throw new Error('SYNTHETIC_DISPATCH_ACK_LOST');
   return json(options.dispatch??{dispatched:true,turn:turn('PROCESSING')});
  }
  if(url.endsWith('/rpc_complete_worker_ai_turn_service'))return json(options.receipt??turn());
  if(url.endsWith('/rpc_fail_worker_ai_turn_service'))return json(turn('FAILED'));
  if(url.startsWith('https://generativelanguage.googleapis.com/')){
   if(options.provider) return options.provider(init);
   const raw=JSON.stringify(output),fragments=Array.from(raw);
   const body=fragments.map((text,index)=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]},...(index===fragments.length-1?{finishReason:options.finishReason??'STOP'}:{})}]})+'\n\n').join('');
   const bytes=new TextEncoder().encode(body);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
  }
  assert.fail('UNEXPECTED_NETWORK_OR_CANONICAL_WRITER');
 };
 const context=vm.createContext({Request,Response,Headers,URL,TextEncoder,TextDecoder,ReadableStream,AbortController,Date,Intl,setTimeout,clearTimeout,fetch,
   Deno:{env:{get:name=>env[name]},serve:fn=>{handler=fn;}}});
 const evaluate=(file,imports={})=>{
  const source=readFileSync(resolve(file),'utf8'),compiled=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.equal(compiled.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  return new vm.Script(`(function(exports,require){${compiled.outputText}\nreturn exports;})`,{filename:file}).runInContext(context)({},name=>{
   assert.ok(Object.hasOwn(imports,name),'UNDECLARED_IMPORT');return imports[name];});
 };
 const budget=evaluate('supabase/functions/_shared/aiTestBudget.ts'),stream=evaluate('supabase/functions/_shared/geminiTaskStream.ts');
 evaluate('supabase/functions/uskoci-worker-interview/index.ts',{'../_shared/aiTestBudget.ts':budget,'../_shared/geminiTaskStream.ts':stream});
 return {calls,output,invoke:(patch={})=>handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC',Accept:'text/event-stream','Content-Type':'application/json'},
  body:JSON.stringify({conversationId:conversation,clientRequestId:key,text:'SYNTHETIC_USER_MESSAGE',...patch})}))};
}
const providers=f=>f.calls.filter(c=>c.url.startsWith('https://generativelanguage.googleapis.com/'));
const completions=f=>f.calls.filter(c=>c.url.endsWith('/rpc_complete_worker_ai_turn_service'));
const failures=f=>f.calls.filter(c=>c.url.endsWith('/rpc_fail_worker_ai_turn_service'));
async function events(f){const r=await f.invoke();assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/event-stream/);
 return (await r.text()).trim().split('\n\n').map(e=>JSON.parse(e.slice(6)));}
test('distinct owned profile streams real Unicode text, reserves approved budget and completes candidate only',async()=>{
 const f=fixture(),es=await events(f);assert.equal(es[0].kind,'accepted');assert.equal(es.at(-1).kind,'final');assert.deepEqual(es.at(-1).turn,turn());
 assert.equal(es.filter(e=>e.kind==='text_delta').map(e=>e.text).join(''),f.output.assistantMessage);
 for(let i=0;i<es.length;i++){assert.equal(es[i].sequence,i+1);assert.equal(es[i].attemptId,attemptId);assert.equal(es[i].conversationId,conversation);}
 assert.equal(providers(f).length,1);assert.equal(completions(f).length,1);assert.deepEqual(completions(f)[0].body.p_output,f.output);
 assert.equal(providers(f)[0].body.generationConfig.maxOutputTokens,8192);assert.equal(f.calls.find(c=>c.url.includes('budget')).body.p_operation_id,key);
 assert.ok(!JSON.stringify(es).includes('PROVIDER_SYNTHETIC'));assert.ok(!f.calls.some(c=>c.url.includes('rpc_save_worker')));
});
test('completed/unknown claim replay cannot reserve or call the provider again',async()=>{
 const f=fixture({replay:true});assert.deepEqual(await(await f.invoke()).json(),turn());assert.equal(providers(f).length,0);assert.equal(f.calls.length,2);
});
for(const env of [{USKOCI_GEMINI_PAID_TEST_ENABLED:''},{AI_PROVIDER:'openai'},{GEMINI_MODEL:'another-model'}])test('unapproved config remains closed before reservation/provider',async()=>{
 const f=fixture({env});assert.equal((await f.invoke()).status,503);assert.equal(providers(f).length,0);assert.equal(failures(f).length,1);assert.ok(!f.calls.some(c=>c.url.includes('budget')));
});
for(const budget of [{admitted:false,reservationId:null,replay:false,code:'AI_TEST_BUDGET_EXHAUSTED'},
 {admitted:false,reservationId:id(8),replay:true,code:'AI_TEST_OPERATION_REPLAY'}])test('budget denial or replay cannot call provider',async()=>{
 const f=fixture({budget});assert.equal((await f.invoke()).status,503);assert.equal(providers(f).length,0);assert.equal(failures(f).length,1);
});
for(const context of [{schemaVersion:'NEED_FACT_V2'},{schemaVersion:'WORKER_PROFILE_V1',accountId:id(99)},
 {schemaVersion:'WORKER_PROFILE_V1',accountId:account,conversationId:conversation,status:'OPEN',stale:true}])test('wrong schema, owner or stale context fails before budget/provider',async()=>{
 const f=fixture({context});assert.equal((await f.invoke()).status,409);assert.equal(providers(f).length,0);assert.ok(!f.calls.some(c=>c.url.includes('budget')));
});
test('model cannot add task facts, verified fields or invented coordinates',async()=>{
 for(const patch of [{'need.title':'Wrong schema'},{verifiedIdentity:true},{location:{approximatePosition:{latitude:44.81,longitude:20.46}}}]){
  const f=fixture({output:{assistantMessage:'Test',safety:'ALLOW',patch}}),es=await events(f);
  assert.equal(es.at(-1).kind,'safe_error');assert.equal(completions(f).length,0);assert.equal(failures(f).length,1);
 }
});
test('truncated provider response remains unknown without a second call or candidate completion',async()=>{
 const f=fixture({finishReason:'MAX_TOKENS'}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.equal(completions(f).length,0);assert.equal(failures(f).length,0);
});
test('wrong final owner/attempt receipt never becomes accepted UI card',async()=>{
 const f=fixture({receipt:{...turn(),attemptId:id(99)}}),es=await events(f);assert.equal(es.at(-1).kind,'safe_error');assert.ok(!es.some(e=>e.kind==='final'));
});
test('extra input commands and oversized body fail before Auth/SQL/provider',async()=>{
 const f=fixture();assert.equal((await f.invoke({publish:true})).status,400);assert.equal(f.calls.length,0);
 assert.equal((await f.invoke({text:'x'.repeat(21000)})).status,400);assert.equal(f.calls.length,0);
});

test('canonical cancellation receipt before provider I/O prevents charge and completion',async()=>{
 const f=fixture({dispatch:{dispatched:false,turn:turn('FAILED')}}),r=await f.invoke();
 assert.equal(r.status,200);assert.deepEqual(await r.json(),turn('FAILED'));assert.equal(providers(f).length,0);assert.equal(completions(f).length,0);
 assert.equal(f.calls.filter(c=>c.url.includes('budget')).length,1); // conservative reservation is never refunded
});
test('lost dispatch acknowledgement remains unknown and cannot call provider',async()=>{
 const f=fixture({dispatchError:true});assert.equal((await f.invoke()).status,409);assert.equal(providers(f).length,0);assert.equal(failures(f).length,0);
});
for(const dispatch of [{dispatched:true,turn:{...turn('PROCESSING'),attemptId:id(99)}},{dispatched:true,turn:turn('FAILED')},
 {dispatched:true,turn:{...turn('PROCESSING'),retryAllowed:true}},{dispatched:true,turn:turn('PROCESSING'),hidden:true}])
 test('malformed or foreign dispatch proof cannot authorize provider I/O',async()=>{
  const f=fixture({dispatch});assert.equal((await f.invoke()).status,409);assert.equal(providers(f).length,0);assert.equal(failures(f).length,0);
 });
