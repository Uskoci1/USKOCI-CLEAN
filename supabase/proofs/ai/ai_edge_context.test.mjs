// Runs the actual Edge handler after TypeScript transpilation in an isolated VM.
// Every fetch/env value is synthetic. This is mocked transport, NOT provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const entry=resolve(root,'supabase/functions/uskoci-ai-interview/index.ts');
const registry=resolve(root,'src/contracts/needFactsV2.ts');
const conversation='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
const userText='GENERIC_SYNTHETIC_INPUT_TWO_PEOPLE';
const providerResult={safety:'ALLOW',assistantMessage:'Pregledajte predloženi broj ljudi.',facts:[
  {key:'need.people_needed',valueJson:'2',displayValue:'2 osobe',evidence:userText,confidence:0.9},
]};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function fixture({now='2026-09-07T12:00:00.000Z',provider='gemini',failure,historyCount=50,schema='NEED_FACT_V2',activeFacts=[],providerOutput}={}){
  const calls=[],logs=[],env={SUPABASE_URL:'https://database.test.invalid',SUPABASE_ANON_KEY:'SYNTHETIC_PUBLIC_KEY',
    SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE_KEY',GEMINI_API_KEY:provider==='gemini'?'SYNTHETIC_GEMINI_KEY':'',
    GEMINI_MODEL:provider==='gemini'?'synthetic-gemini-model':'',OPENAI_API_KEY:'SYNTHETIC_OPENAI_KEY',OPENAI_MODEL:'synthetic-openai-model'};
  let handler;
  class FixedDate extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return Date.parse(now);}}
  const fakeFetch=async(input,options={})=>{
    const url=String(input),headers=Object.fromEntries(new Headers(options.headers).entries());
    const body=options.body?JSON.parse(options.body):null;calls.push({url,method:options.method??'GET',headers,body});
    if(url.includes('/rest/v1/ai_conversations?'))return json([{id:conversation,account_id:owner,fact_schema_version:schema}]);
    if(url.includes('/rest/v1/ai_messages?')){
      const query=new URL(url).searchParams;
      assert.equal(query.get('order'),'sequence_no.desc');assert.equal(query.get('limit'),'40');
      const rows=Array.from({length:historyCount},(_,i)=>({sequence_no:i+1,role:i%2?'ASSISTANT':'USER',body:`SYNTHETIC_HISTORY_${i+1}`}));
      return json(rows.reverse().slice(0,40));
    }
    // Intentionally ignore the query allowlist: the handler must also filter
    // unexpected/manual-only rows returned by the context transport.
    if(url.includes('/rest/v1/ai_structured_facts?'))return json(activeFacts);
    if(url.includes('/rest/v1/rpc/rpc_ai_apply_interview_turn'))return json({proposedCount:body.p_proposals.length});
    if(url.startsWith('https://generativelanguage.googleapis.com/')||url==='https://api.openai.com/v1/responses'){
      if(failure==='network')throw new Error('SYNTHETIC_GEMINI_KEY '+userText+' PRIVATE_PROVIDER_OUTPUT');
      if(failure==='http')return new Response('PRIVATE_PROVIDER_OUTPUT',{status:429});
      if(failure==='json')return new Response('PRIVATE_PROVIDER_OUTPUT '+userText+' SYNTHETIC_GEMINI_KEY',{status:200});
      const result=providerOutput??(schema==='NEED_FACT_V2'?providerResult:{safety:'ALLOW',assistantMessage:'Potreban je pregled.',facts:[]});
      const output=failure==='output'?'PRIVATE_PROVIDER_OUTPUT '+userText:JSON.stringify(result);
      return url.includes('googleapis')?json({candidates:[{content:{parts:[{text:output}]}}]}):json({output_text:output});
    }
    assert.fail('UNEXPECTED_SYNTHETIC_FETCH_ROUTE');
  };
  const context=vm.createContext({Request,Response,Headers,URL,URLSearchParams,Intl,Date:FixedDate,
    fetch:fakeFetch,console:{error:(...args)=>logs.push(args)},Deno:{env:{get:name=>env[name]},serve:fn=>{handler=fn;}}});
  const cache=new Map();
  function load(file){
    assert.ok([entry,registry].includes(file),'test loader may evaluate only exact source entry/shared registry');
    if(cache.has(file))return cache.get(file).exports;
    const source=readFileSync(file,'utf8');
    const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:file});
    assert.equal((result.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
    const module={exports:{}};cache.set(file,module);
    const evaluate=new vm.Script(`(function(require,module,exports){${result.outputText}\n})`,{filename:file}).runInContext(context);
    evaluate(specifier=>load(resolve(dirname(file),specifier)),module,module.exports);return module.exports;
  }
  load(entry);assert.equal(typeof handler,'function');
  const request=overrides=>new Request('https://edge.test.invalid/uskoci-ai-interview',{method:'POST',
    headers:{Authorization:'Bearer SYNTHETIC_USER_SESSION','Content-Type':'application/json'},
    body:JSON.stringify({conversationId:conversation,text:userText,...overrides})});
  return {calls,logs,env,registry:load(registry),invoke:overrides=>handler(request(overrides))};
}
const providerCall=fixture=>fixture.calls.find(x=>x.url.includes('googleapis')||x.url==='https://api.openai.com/v1/responses');
const prompt=call=>call.body.systemInstruction?.parts[0].text??call.body.instructions;
const timeContext=call=>JSON.parse(prompt(call).match(/Serverski vremenski kontekst za trenutni unos u Srbiji: (\{[^}]+\})\./)[1]);

const resolvedWitness={version:1,binding:{taskCountryCode:'RS',geography:{mode:'STATIONARY',start:{city:'SYNTHETIC_CITY'}},
  exactAddress:'PRIVATE_RESOLVED_BINDING_ADDRESS'},points:[{slot:'start',latitudeE6:44123456,longitudeE6:20123456,
  origin:{kind:'PROVIDER_CANDIDATE',providerHint:'PRIVATE_RESOLVED_PROVIDER',candidateHint:'PRIVATE_RESOLVED_CANDIDATE'},
  address:'PRIVATE_RESOLVED_POINT_ADDRESS',accessNotes:'PRIVATE_RESOLVED_ACCESS_NOTES'}]};
const manualFact={key:'need.resolved_location',valueJson:JSON.stringify(resolvedWitness),value:JSON.stringify(resolvedWitness),
  displayValue:'PRIVATE_RESOLVED_DISPLAY',evidence:'PRIVATE_RESOLVED_EVIDENCE',confidence:1};

for(const provider of ['gemini','openai'])test(`${provider} outbound V2 schema and prompt registry exclude manual-only facts`,async()=>{
  const f=fixture({provider});assert.equal((await f.invoke()).status,200);
  const call=providerCall(f),schema=call.body.generationConfig?.responseSchema??call.body.text.format.schema;
  const allowedKeys=schema.properties.facts.items.properties.key.enum;
  const promptRegistry=JSON.parse(prompt(call).split('Jedini podržani V2 fact registry: ')[1]);
  assert.deepEqual(allowedKeys,[...f.registry.AI_PROPOSABLE_NEED_FACT_V2_KEYS]);
  assert.deepEqual(promptRegistry.map(fact=>fact.key),allowedKeys);
  assert.ok(allowedKeys.includes('need.task_geography'));assert.ok(allowedKeys.includes('need.task_country_code'));
  assert.ok(allowedKeys.includes('need.exact_address'));assert.ok(!allowedKeys.includes('need.resolved_location'));
  assert.equal(f.registry.NEED_FACT_V2_DEFINITIONS['need.resolved_location'].manualOnly,true);
  assert.ok(f.registry.NEED_FACT_V2_KEYS.includes('need.resolved_location'),'manual form still owns the full registry key');
});

for(const provider of ['gemini','openai'])for(const schema of ['NEED_FACT_V2','LEGACY_TEXT_V1']){
  test(`${provider} ${schema} context query and defensive prompt omit complete resolved witness`,async()=>{
    const activeFacts=[
      {fact_key:'need.people_needed',fact_value:2,display_value:'2 osobe',status:'CONFIRMED'},
      {fact_key:'naslov',fact_value:'SYNTHETIC_LEGACY_TITLE',status:'CONFIRMED'},
      {fact_key:'need.exact_address',fact_value:'SYNTHETIC_EXISTING_PRIVATE_ADDRESS',status:'CONFIRMED'},
      {fact_key:'need.resolved_location',fact_value:resolvedWitness,display_value:manualFact.displayValue,status:'CONFIRMED'},
      {fact_key:'unknown.private_fact',fact_value:'PRIVATE_UNKNOWN_FACT',status:'CONFIRMED'},
    ];
    const f=fixture({provider,schema,activeFacts});assert.equal((await f.invoke()).status,200);
    const query=new URL(f.calls.find(call=>call.url.includes('/ai_structured_facts?')).url).searchParams;
    assert.equal(query.get('conversation_id'),`eq.${conversation}`);assert.equal(query.get('superseded_at'),'is.null');
    const filter=query.get('fact_key');assert.match(filter??'',/^in\.\(.+\)$/);
    const fetchedKeys=JSON.parse(`[${filter.slice(4,-1)}]`);
    assert.ok(fetchedKeys.includes('naslov'));assert.ok(fetchedKeys.includes('need.people_needed'));
    assert.ok(fetchedKeys.includes('need.exact_address'));assert.ok(!fetchedKeys.includes('need.resolved_location'));
    assert.ok(!fetchedKeys.includes('unknown.private_fact'));
    const payload=JSON.stringify(providerCall(f).body);
    for(const privateMarker of ['need.resolved_location','PRIVATE_RESOLVED_','44123456','20123456','latitudeE6','longitudeE6','PRIVATE_UNKNOWN_FACT']){
      assert.ok(!payload.includes(privateMarker),`outbound provider payload contains ${privateMarker}`);
    }
    assert.ok(payload.includes('SYNTHETIC_LEGACY_TITLE'));assert.ok(payload.includes('SYNTHETIC_EXISTING_PRIVATE_ADDRESS'));
    assert.ok(payload.includes('need.people_needed'));assert.deepEqual(f.logs,[]);
  });
}

for(const provider of ['gemini','openai'])for(const schema of ['NEED_FACT_V2','LEGACY_TEXT_V1'])for(const safety of ['ALLOW','BLOCK']){
  test(`${provider} ${schema} ${safety} manual-only proposal rejects whole turn before SQL writer`,async()=>{
    const ordinaryFact=schema==='NEED_FACT_V2'?providerResult.facts[0]:{key:'osoba',value:'2',evidence:userText,confidence:0.9};
    const f=fixture({provider,schema,providerOutput:{safety,assistantMessage:'PRIVATE_RESOLVED_ASSISTANT',facts:[ordinaryFact,manualFact]}});
    const response=await f.invoke();assert.equal(response.status,502);
    assert.equal((await response.json()).code,'AI_PROVIDER_FAILED');assert.equal(providerCalls(f).length,1);
    assert.ok(!f.calls.some(call=>new URL(call.url).pathname.includes('/rpc/')),'no valid subset or empty BLOCK turn may be persisted');
    assert.deepEqual(f.logs,[['AI_PROVIDER_FAILED']]);
  });
}

for(const [now,date,time,offset] of [
  ['2026-09-07T21:59:59.000Z','2026-09-07','23:59:59','+02:00'],
  ['2026-09-07T22:00:00.000Z','2026-09-08','00:00:00','+02:00'],
  ['2026-09-07T23:59:59.000Z','2026-09-08','01:59:59','+02:00'],
  ['2026-09-08T00:00:00.000Z','2026-09-08','02:00:00','+02:00'],
  ['2026-12-31T23:30:00.000Z','2027-01-01','00:30:00','+01:00'],
  ['2026-03-29T00:30:00.000Z','2026-03-29','01:30:00','+01:00'],
  ['2026-03-29T01:30:00.000Z','2026-03-29','03:30:00','+02:00'],
  ['2026-10-25T00:30:00.000Z','2026-10-25','02:30:00','+02:00'],
  ['2026-10-25T01:30:00.000Z','2026-10-25','02:30:00','+01:00'],
])test(`actual outbound server time context at ${now}`,async()=>{
  const f=fixture({now});assert.equal((await f.invoke({nowUtc:'2099-01-01',localDate:'2099-01-01',timeZone:'Pacific/Honolulu'})).status,200);
  assert.deepEqual(timeContext(providerCall(f)),{nowUtc:now,timeZone:'Europe/Belgrade',localDate:date,localTime:time,utcOffset:offset});
  assert.ok(!prompt(providerCall(f)).includes('2099-01-01'));
});

for(const provider of ['gemini','openai'])test(`${provider} actual handler sends newest30 chronologically and persists validated proposals`,async()=>{
  const f=fixture({provider}),result=await f.invoke(),body=await result.json();assert.equal(result.status,200);
  assert.equal(body.provider,provider);assert.equal(body.schemaVersion,'NEED_FACT_V2');assert.equal(body.predlozeno,1);
  const call=providerCall(f),messages=provider==='gemini'?call.body.contents:call.body.input;
  const texts=messages.map(x=>x.parts?.[0].text??x.content[0].text);
  assert.deepEqual(texts,[...Array.from({length:30},(_,i)=>`SYNTHETIC_HISTORY_${i+21}`),userText]);
  assert.match(prompt(call),/nedostajući čas, trajanje, kraj termina ili nejasnu lokaciju/);
  assert.match(prompt(call),/nikada potvrđen termin Zadatka/);assert.match(prompt(call),/ljudska potvrda/);
  assert.equal(timeContext(call).timeZone,'Europe/Belgrade');
  if(provider==='gemini'){
    assert.equal(call.headers['x-goog-api-key'],f.env.GEMINI_API_KEY);assert.equal(new URL(call.url).search,'');
    assert.ok(!call.url.includes(f.env.GEMINI_API_KEY));assert.ok(!f.calls.some(x=>new URL(x.url).hostname==='api.openai.com'));
  }else{assert.equal(call.headers.authorization,`Bearer ${f.env.OPENAI_API_KEY}`);assert.equal(call.body.store,false);}
  const persist=f.calls.find(x=>x.url.includes('/rpc/rpc_ai_apply_interview_turn_v2_service'));assert.ok(persist);
  assert.equal(persist.headers.authorization,'Bearer SYNTHETIC_SERVICE_KEY');assert.equal(persist.body.p_account_id,owner);
  assert.equal(persist.body.p_conversation_id,conversation);assert.equal(persist.body.p_user_message,userText);
  assert.deepEqual(persist.body.p_proposals,[{key:'need.people_needed',value:2,displayValue:'2 osobe',evidence:userText,confidence:0.9}]);
  assert.deepEqual(f.logs,[]);assert.ok(!JSON.stringify(body).includes('SYNTHETIC_'));
});

test('short history stays chronological without invented prior turns',async()=>{
  const f=fixture({historyCount:3});assert.equal((await f.invoke()).status,200);
  assert.deepEqual(providerCall(f).body.contents.map(x=>x.parts[0].text),['SYNTHETIC_HISTORY_1','SYNTHETIC_HISTORY_2','SYNTHETIC_HISTORY_3',userText]);
});
test('legacy provider context shares date grounding without V2 writer cutover',async()=>{
  const f=fixture({schema:'LEGACY_TEXT_V1'});assert.equal((await f.invoke()).status,200);
  assert.equal(timeContext(providerCall(f)).localDate,'2026-09-07');
  assert.ok(f.calls.some(x=>x.url.endsWith('/rpc/rpc_ai_apply_interview_turn_service')));
  assert.ok(!f.calls.some(x=>x.url.endsWith('/rpc/rpc_ai_apply_interview_turn_v2_service')));
});
for(const failure of ['network','http','json','output'])test(`provider ${failure} failure logs fixed categories only and performs no writer call`,async()=>{
  const f=fixture({failure}),response=await f.invoke();assert.equal(response.status,502);
  assert.equal((await response.json()).code,'AI_PROVIDER_FAILED');
  const expected=failure==='http'?[['GEMINI_GENERATE_FAILED',429],['AI_PROVIDER_FAILED']]:[['AI_PROVIDER_FAILED']];
  assert.deepEqual(f.logs,expected);assert.ok(!f.calls.some(x=>x.url.includes('/rpc/')));
  assert.ok(!JSON.stringify(f.logs).includes('SYNTHETIC_'));assert.ok(!JSON.stringify(f.logs).includes('PRIVATE_PROVIDER_OUTPUT'));
});

const providerCalls=f=>f.calls.filter(call=>[
  'generativelanguage.googleapis.com','api.openai.com',
].includes(new URL(call.url).hostname));
const hostFor={gemini:'generativelanguage.googleapis.com',openai:'api.openai.com'};

for(const selected of ['openai','gemini'])test(`explicit ${selected} chooses only its configured pair even when both are present`,async()=>{
  const f=fixture();f.env.AI_PROVIDER=selected;
  const other=selected==='openai'?'gemini':'openai';
  const response=await f.invoke({provider:other,AI_PROVIDER:other}),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.provider,selected);
  const calls=providerCalls(f);assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).hostname,hostFor[selected]);
  if(selected==='openai'){
    assert.equal(calls[0].headers.authorization,`Bearer ${f.env.OPENAI_API_KEY}`);
    assert.equal(calls[0].body.model,f.env.OPENAI_MODEL);assert.equal(calls[0].body.store,false);
  }else{
    assert.equal(calls[0].headers['x-goog-api-key'],f.env.GEMINI_API_KEY);
    assert.ok(new URL(calls[0].url).pathname.includes(encodeURIComponent(f.env.GEMINI_MODEL)));
  }
  const persist=f.calls.find(call=>new URL(call.url).pathname==='/rest/v1/rpc/rpc_ai_apply_interview_turn_v2_service');
  assert.ok(persist);assert.equal(persist.body.p_account_id,owner);
  assert.deepEqual(Object.keys(persist.body).sort(),[
    'p_account_id','p_assistant_message','p_conversation_id','p_proposals','p_safety','p_user_message',
  ]);
  assert.equal(persist.body.p_proposals[0].key,'need.people_needed');assert.equal(persist.body.p_proposals[0].value,2);
  assert.deepEqual(f.logs,[]);assert.ok(!JSON.stringify(body).includes('SYNTHETIC_'));
});

test('absent selector preserves legacy Gemini-first selection and ignores client provider fields',async()=>{
  const f=fixture();assert.equal(f.env.AI_PROVIDER,undefined);
  const response=await f.invoke({provider:'openai',AI_PROVIDER:'openai'});
  assert.equal(response.status,200);assert.equal((await response.json()).provider,'gemini');
  assert.equal(providerCalls(f).length,1);assert.equal(new URL(providerCalls(f)[0].url).hostname,hostFor.gemini);
});

for(const missing of ['GEMINI_API_KEY','GEMINI_MODEL'])test(`legacy selection uses OpenAI when ${missing} is absent`,async()=>{
  const f=fixture();delete f.env[missing];
  const response=await f.invoke();assert.equal(response.status,200);assert.equal((await response.json()).provider,'openai');
  assert.equal(providerCalls(f).length,1);assert.equal(new URL(providerCalls(f)[0].url).hostname,hostFor.openai);
});

for(const invalid of ['','OPENAI',' openai','anthropic','gemini,openai'])test(`invalid explicit selector ${JSON.stringify(invalid)} fails before provider or writer`,async()=>{
  const f=fixture();f.env.AI_PROVIDER=invalid;
  const response=await f.invoke();assert.equal(response.status,503);
  assert.equal((await response.json()).code,'AI_PROVIDER_NOT_CONFIGURED');
  assert.deepEqual(providerCalls(f),[]);assert.ok(!f.calls.some(call=>new URL(call.url).pathname.includes('/rpc/')));
  assert.deepEqual(f.logs,[]);
});

for(const selected of ['openai','gemini'])for(const suffix of ['API_KEY','MODEL'])for(const missing of [undefined,'']){
  test(`explicit ${selected} with ${suffix} ${missing===undefined?'absent':'empty'} never falls back`,async()=>{
    const f=fixture();f.env.AI_PROVIDER=selected;f.env[`${selected.toUpperCase()}_${suffix}`]=missing;
    const response=await f.invoke();assert.equal(response.status,503);
    assert.equal((await response.json()).code,'AI_PROVIDER_NOT_CONFIGURED');assert.deepEqual(providerCalls(f),[]);
    assert.ok(!f.calls.some(call=>new URL(call.url).pathname.includes('/rpc/')));assert.deepEqual(f.logs,[]);
  });
}

test('absent selector with neither complete pair retains the known pre-provider 503',async()=>{
  const f=fixture();delete f.env.GEMINI_MODEL;delete f.env.OPENAI_MODEL;
  const response=await f.invoke();assert.equal(response.status,503);
  assert.equal((await response.json()).code,'AI_PROVIDER_NOT_CONFIGURED');assert.deepEqual(providerCalls(f),[]);
  assert.ok(!f.calls.some(call=>new URL(call.url).pathname.includes('/rpc/')));assert.deepEqual(f.logs,[]);
});

for(const selected of ['openai','gemini'])for(const failure of ['network','http','json','output']){
  test(`explicit ${selected} ${failure} failure calls no alternate provider and no writer`,async()=>{
    const f=fixture({failure});f.env.AI_PROVIDER=selected;
    const response=await f.invoke();assert.equal(response.status,502);assert.equal((await response.json()).code,'AI_PROVIDER_FAILED');
    const calls=providerCalls(f);assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).hostname,hostFor[selected]);
    assert.ok(!f.calls.some(call=>new URL(call.url).pathname.includes('/rpc/')));
    const httpCategory=selected==='openai'?'OPENAI_RESPONSES_FAILED':'GEMINI_GENERATE_FAILED';
    assert.deepEqual(f.logs,failure==='http'?[[httpCategory,429],['AI_PROVIDER_FAILED']]:[['AI_PROVIDER_FAILED']]);
    assert.ok(!JSON.stringify(f.logs).includes('SYNTHETIC_'));assert.ok(!JSON.stringify(f.logs).includes('PRIVATE_PROVIDER_OUTPUT'));
  });
}
