// Loopback-only native proof adapter. Auth and REST are real; only the model is
// synthetic. This does NOT prove the hosted Edge gateway or a provider call.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateAiFixture} from './ai_review_fixture.mjs';
import {loadOwnedIntakeHandler} from '../supabase/proofs/ai/owned_intake_edge_runtime.mjs';

export function admittedPath(raw) {
  if(typeof raw!=='string'||!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\')||raw.includes('#')||/(?:^|\/)\.{1,2}(?:\/|\?|$)/.test(raw))return null;
  const parsed=new URL(raw,'http://127.0.0.1:54329');
  if(parsed.origin!=='http://127.0.0.1:54329'||/%(?:2f|5c|2e)/i.test(parsed.pathname)||parsed.pathname.includes('/../'))return null;
  if(parsed.pathname==='/functions/v1/uskoci-ai-interview')return 'handler';
  if(/^\/auth\/v1\/(?:settings|token|user|logout|signup)$/.test(parsed.pathname))return 'auth';
  if(/^\/rest\/v1\/(?:[a-z][a-z_0-9]*|rpc\/[a-z][a-z_0-9]*)$/.test(parsed.pathname))return 'rest';
  return null;
}
export function localUpstream(raw) {
  if(!admittedPath(raw))return null;
  const incoming=new URL(raw,'http://127.0.0.1:54329');
  // Request data can affect only a validated route and its query, never the
  // upstream protocol, authority, credentials, port or redirect destination.
  const target=new URL('http://127.0.0.1:54321');
  target.pathname=incoming.pathname;target.search=incoming.search;
  return target;
}
export function forwardedHeaders(raw) {
  const headers=new Headers();
  for(const key of ['authorization','apikey','content-type','accept','prefer','accept-profile','content-profile','x-client-info','x-supabase-api-version','range','range-unit'])
    if(typeof raw[key]==='string')headers.set(key,raw[key]);
  return headers;
}
export async function boundedBody(stream,maximum=524288) {
  const parts=[];let size=0;
  for await(const part of stream){size+=part.length;if(size>maximum)throw new Error('PROOF_BODY_LIMIT');parts.push(part);}
  return Buffer.concat(parts);
}
export function startAdapter(env=process.env) {
  validateAiFixture(env);
  const out=env.RU5_DEVICE_ARTIFACT_DIR,fixture=JSON.parse(readFileSync(out+'/ai-review-fixture.json','utf8'));
  assert.equal(fixture.sourceSha,env.GITHUB_SHA);assert.equal(fixture.localOnly,true);assert.equal(fixture.providerProof,false);
  const report={sourceSha:env.GITHUB_SHA,localOnly:true,actualHandler:true,actualAuth:true,mockedRpc:false,
    providerProof:false,gatewayProof:false,providerCalls:0,handlerCalls:0,committedResponseDropped:false,forwardedAuth:0,forwardedRest:0};
  const save=()=>writeFileSync(out+'/ai-edge-adapter.json',JSON.stringify(report,null,2)+'\n');
  const runtime=loadOwnedIntakeHandler({env:name=>({SUPABASE_URL:env.RU5_DEVICE_SUPABASE_URL,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,AI_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_NOT_A_SECRET',OPENAI_MODEL:'SYNTHETIC_NATIVE_PROOF'})[name],
    fetch:async(input,init={})=>{
      const url=new URL(String(input));
      if(url.href==='https://api.openai.com/v1/responses'){
        report.providerCalls++;save();
        assert.equal(report.providerCalls,1,'NO_AUTOMATIC_PROVIDER_REPLAY');
        const payload=JSON.parse(String(init.body));assert.ok(JSON.stringify(payload).includes(fixture.input));
        return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({safety:'ALLOW',
          assistantMessage:'Pregledajte podatke i potvrdite šta vam odgovara.',facts:fixture.proposals})}),{headers:{'Content-Type':'application/json'}});
      }
      assert.equal(url.origin,'http://127.0.0.1:54321');
      assert.ok(url.pathname==='/auth/v1/user'||/^\/rest\/v1\/(?:ai_conversations|rpc\/[a-z_0-9]+)$/.test(url.pathname));
      return fetch(url,{...init,redirect:'error'});
    }});
  report.sourceHashes=runtime.sourceHashes;save();
  const server=createServer(async(req,res)=>{
    const kind=admittedPath(req.url),upstream=localUpstream(req.url),method=req.method;
    if(!kind||!upstream||!['GET','POST','PATCH','DELETE'].includes(method)){res.writeHead(404);res.end();return;}
    const cancelled=new AbortController();req.on('aborted',()=>cancelled.abort());
    const timer=setTimeout(()=>cancelled.abort(),25000);
    try {
      const body=await boundedBody(req,kind==='handler'?18000:524288),headers=forwardedHeaders(req.headers);
      let response;
      if(kind==='handler'){
        if(method!=='POST')throw new Error('PROOF_METHOD');
        report.handlerCalls++;save();
        response=await runtime.handler(new Request('http://127.0.0.1:54329'+req.url,{method,headers,body,signal:cancelled.signal}));
      }else{
        report[kind==='auth'?'forwardedAuth':'forwardedRest']++;save();
        response=await fetch(upstream,{method,headers,body:['GET','HEAD'].includes(method)?undefined:body,
          redirect:'error',signal:cancelled.signal});
      }
      const bytes=response.body?await boundedBody(response.body,4*1024*1024):Buffer.alloc(0);
      if(kind==='handler'&&response.status===200&&!report.committedResponseDropped){
        const receipt=JSON.parse(bytes.toString('utf8'));assert.equal(receipt.state,'SUCCEEDED');
        report.committedResponseDropped=true;save();
        // Deliberate local transport loss AFTER real SQL acknowledgment. The UI
        // must use owned readback; never replay the write or fabricate success.
        res.destroy();return;
      }
      const responseHeaders={};
      for(const name of ['content-type','content-range','range-unit','preference-applied','www-authenticate']){
        const value=response.headers.get(name);if(value)responseHeaders[name]=value;
      }
      responseHeaders['content-length']=String(bytes.length);res.writeHead(response.status,responseHeaders);res.end(bytes);
    }catch{if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});res.end('{"error":"PROOF_TRANSPORT_FAILED"}');}
    finally{clearTimeout(timer);save();}
  });
  server.requestTimeout=30000;server.headersTimeout=10000;
  server.listen(54329,'127.0.0.1',()=>console.log('READY AI_REVIEW_LOOPBACK_ADAPTER providerProof=false gatewayProof=false'));
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const server=startAdapter();process.on('SIGTERM',()=>server.close());process.on('SIGINT',()=>server.close());}
  catch{console.error('AI_REVIEW_ADAPTER_START_FAILED');process.exitCode=1;}
}
