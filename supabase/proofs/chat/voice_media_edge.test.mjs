// Voice messages B1-c: the EXACT current uskoci-media source (Agreement voice operations) with the real B0 validator. The synthetic transport is explicitly
// unit-only; the actual SQL, Storage and closure behaviour is proved by the disposable B1 workflow (real sessions, real Storage, the real closure worker source).
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFileSync} from 'node:fs';import {webcrypto,createHash} from 'node:crypto';import ts from 'typescript';
import * as voice from '../../functions/_shared/voiceM4a.mjs';
import {m4aFixture} from './voice_m4a_fixture.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,account=id(1),agreement=id(2),key=id(3),asset=id(4),attempt=id(5),session=id(6),message=id(7);
const audio=Buffer.from(m4aFixture({durationMs:4200})),sha=createHash('sha256').update(audio).digest('hex'),size=audio.length;
const info=voice.inspectVoiceM4a(new Uint8Array(audio)),durationMs=info.durationMs,path=`${account}/agreement-voice-v1/${asset}/${sha}.m4a`;
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const token=(patch={})=>['SYNTHETIC_HEADER',Buffer.from(JSON.stringify({sub:account,role:'authenticated',session_id:session,iss:'https://db.invalid/auth/v1',exp:Math.floor(Date.now()/1000)+3600,...patch})).toString('base64url'),'SYNTHETIC_SIGNATURE'].join('.');
const receipt=(state='READY',patch={})=>({accountId:account,agreementId:agreement,agreementVersion:1,clientRequestId:key,assetId:state==='ABSENT'?null:asset,state,attachedMessageId:null,
 voice:state==='READY'?{assetId:asset,durationMs,byteSize:size,contentType:'audio/mp4'}:null,authoritative:true,...patch});
const stored=state=>['STAGED','READY'].includes(state);
const transfer=(state='PROCESSING',dispatchState='NOT_DISPATCHED',acquired=false,patch={})=>({receipt:receipt(state),attemptId:attempt,path:stored(state)?path:null,
 sha256:stored(state)?sha:null,byteSize:stored(state)?size:null,durationMs:stored(state)?durationMs:null,dispatchState,dispatchOutcome:dispatchState==='SETTLED'?'STORED':null,acquired,...patch});
const readReceipt=()=>({assetId:asset,agreementId:agreement,messageId:message,bucket:'agreement-voice',path,sha256:sha,contentType:'audio/mp4',byteSize:size,durationMs,authoritative:true});
const UPLOAD='rpc_agreement_voice_upload_service_v1',READ='rpc_agreement_voice_read_service_v1';
function fixture(options={}){
 const calls=[];let handler;const environment={SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'ANON',SUPABASE_SERVICE_ROLE_KEY:'SERVICE'};
 const fetch=async(url,init={})=>{const p=new URL(url).pathname,c={path:p,init,body:typeof init.body==='string'?JSON.parse(init.body):init.body};calls.push(c);
  const overridden=await options.transport?.(c);if(overridden)return overridden;
  if(p==='/auth/v1/user')return json({id:account});
  if(p.endsWith('/'+READ))return json({...readReceipt(),messageId:c.body.p_message_id});
  if(p.endsWith('/'+UPLOAD)){
   assert.equal(c.body.p_account_id,account);assert.equal(c.body.p_session_id,session);assert.equal(c.body.p_agreement_id,agreement);
   switch(c.body.p_operation){
    case 'CLAIM':assert.deepEqual(Object.keys(c.body.p_input).sort(),['byteSize','contentType','sha256']);assert.equal(c.body.p_input.contentType,'audio/mp4');return json(options.claim??transfer('PROCESSING','NOT_DISPATCHED',true));
    case 'STAGE':assert.equal(c.body.p_input.sha256,sha);assert.equal(c.body.p_input.byteSize,size);assert.equal(c.body.p_input.durationMs,durationMs);assert.equal(c.body.p_input.attemptId,attempt);return json(transfer('STAGED'));
    case 'DISPATCH':return json(transfer('STAGED','DISPATCHING',true));
    case 'SETTLE':return json(transfer(c.body.p_input.outcome==='STORED'?'READY':'FAILED','SETTLED',false,{dispatchOutcome:c.body.p_input.outcome}));
    case 'FAIL':return json(transfer('FAILED'));
    case 'READ':return json(options.read??{receipt:receipt('ABSENT')});
    case 'CANCEL':return json(options.cancel??transfer('CANCELLED'));
    case 'LIST':return json({accountId:account,agreementId:agreement,uploads:[receipt()],authoritative:true});
    default:assert.fail('UNEXPECTED_RPC_OPERATION');
   }
  }
  if(p==='/storage/v1/object/agreement-voice/'+path){
   if(init.method==='POST'){assert.equal(init.headers['x-upsert'],'false');assert.equal(init.headers['Content-Type'],'audio/mp4');assert.equal(createHash('sha256').update(init.body).digest('hex'),sha);return json({});}
   return new Response(new Uint8Array(audio),{headers:{'Content-Type':'audio/mp4'}});
  }
  assert.fail('UNEXPECTED_TRANSPORT:'+p);
 };
 const source=readFileSync('supabase/functions/uskoci-media/index.ts','utf8').replace("import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.43/magick.wasm')","'file:///unit-not-used'");
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const photoStub={configureImageLimits(){},sanitizeImage(){throw new Error('THE_PHOTO_PATH_MUST_NOT_RUN_FOR_VOICE');}};
 new vm.Script(compiled).runInContext(vm.createContext({exports:{},require:name=>{if(name==='npm:@imagemagick/magick-wasm@0.0.43')return{initializeImageMagick:async()=>undefined};
  if(name==='../_shared/voiceM4a.mjs')return voice;assert.equal(name,'../_shared/mediaImageSanitizer.mjs');return photoStub;},
 Request,Response,Headers,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,AbortController,crypto:webcrypto,setTimeout,clearTimeout,fetch,atob,
 Deno:{env:{get:n=>environment[n]},readFile:async()=>new Uint8Array(),serve:fn=>handler=fn}}));
 const invoke=(op='agreement-voice-upload',body=new Uint8Array(audio),headers={})=>handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer '+token(),'Content-Type':'audio/mp4',
  'x-media-operation':op,'x-media-target':agreement,'x-media-version':'1','x-media-request-id':key,...headers},body}));
 const control=(op,body={agreementId:agreement,agreementVersion:1,clientRequestId:key})=>invoke(op,JSON.stringify(body),{'Content-Type':'application/json'});
 return{calls,invoke,control,read:()=>control('agreement-voice-read',{agreementId:agreement,assetId:asset,messageId:message})};
}
const operations=f=>f.calls.filter(x=>x.path.endsWith('/'+UPLOAD)).map(x=>x.body.p_operation);
const posts=f=>f.calls.filter(x=>x.path.startsWith('/storage/')&&x.init.method==='POST');
test('the fixture is a container the B0 validator admits, and the receipt carries metadata only',()=>{assert.ok(durationMs>=300&&durationMs<=300000);assert.equal(info.contentType,'audio/mp4');assert.equal(info.byteSize,size);});
test('one validated private upload and exact readback: the stored bytes ARE the input bytes, the receipt has no path or hash',async()=>{
 const f=fixture(),r=await f.invoke();assert.equal(r.status,200);const body=await r.json();assert.deepEqual(body,receipt());assert.deepEqual(operations(f),['CLAIM','STAGE','DISPATCH','SETTLE']);
 assert.equal(posts(f).length,1);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(body).includes(path)&&!JSON.stringify(body).includes(sha));
 assert.equal(f.calls.find(x=>x.body?.p_operation==='CLAIM').body.p_input.sha256,sha);
});
test('known READY, PROCESSING and CANCELLED replay never repeats the Storage POST',async()=>{
 for(const state of ['READY','PROCESSING','CANCELLED']){const f=fixture({claim:transfer(state,state==='READY'?'SETTLED':'NOT_DISPATCHED')});assert.equal((await f.invoke()).status,200);assert.deepEqual(operations(f),['CLAIM']);assert.equal(posts(f).length,0);}
});
test('unknown staged recovery only verifies the existing bytes and settles, never re-uploads',async()=>{
 const f=fixture({claim:transfer('STAGED','DISPATCHING')});assert.equal((await f.invoke()).status,200);assert.deepEqual(operations(f),['CLAIM','SETTLE']);assert.equal(posts(f).length,0);
});
test('restart exact-key read settles only positive original dispatch bytes, without the recording or an upload retry',async()=>{
 const f=fixture({read:transfer('STAGED','DISPATCHING')});const r=await f.control('agreement-voice-upload-read');assert.equal(r.status,200);assert.deepEqual(await r.json(),receipt());assert.deepEqual(operations(f),['READ','SETTLE']);assert.equal(posts(f).length,0);
 const missing=fixture({read:transfer('STAGED','DISPATCHING'),transport:c=>c.path.startsWith('/storage/')?json({},404):null});
 assert.deepEqual(await(await missing.control('agreement-voice-upload-read')).json(),receipt('STAGED'));assert.deepEqual(operations(missing),['READ']);assert.equal(posts(missing).length,0);
 const wrongType=fixture({read:transfer('STAGED','DISPATCHING'),transport:c=>c.path.startsWith('/storage/')?new Response(new Uint8Array(audio),{headers:{'Content-Type':'image/jpeg'}}):null});
 assert.deepEqual(await(await wrongType.control('agreement-voice-upload-read')).json(),receipt('STAGED'));assert.deepEqual(operations(wrongType),['READ']);
});
test('an ambiguous Storage write stays unknown without a false settlement or a retry',async()=>{
 for(const throws of [true,false]){const f=fixture({transport:c=>{if(c.path.startsWith('/storage/')&&c.init.method==='POST'){if(throws)throw new Error('PRIVATE_TRANSPORT');return json({},500);}}});
  assert.equal((await f.invoke()).status,503);assert.equal(posts(f).length,1);assert.ok(!operations(f).includes('SETTLE'));}
 const rejected=fixture({transport:c=>c.path.startsWith('/storage/')&&c.init.method==='POST'?json({},400):null});
 assert.equal((await rejected.invoke()).status,503);assert.deepEqual(operations(rejected),['CLAIM','STAGE','DISPATCH','SETTLE']);
 assert.equal(rejected.calls.filter(x=>x.body?.p_operation==='SETTLE')[0].body.p_input.outcome,'REJECTED');
});
test('cancel wins before dispatch or after the actual store and the authoritative cancelled receipt survives',async()=>{
 const before=fixture({transport:c=>c.body?.p_operation==='STAGE'?json(transfer('CANCELLED')):null});assert.deepEqual(await(await before.invoke()).json(),receipt('CANCELLED'));assert.equal(posts(before).length,0);
 const after=fixture({transport:c=>c.body?.p_operation==='SETTLE'?json(transfer('CANCELLED','SETTLED',false,{path,sha256:sha,byteSize:size,durationMs})):null});
 assert.deepEqual(await(await after.invoke()).json(),receipt('CANCELLED'));assert.equal(posts(after).length,1);
});
test('explicit absence, cancel and list never send an upload or a message, and an attached cancellation reports the actual receipt',async()=>{
 const f=fixture();assert.deepEqual(await(await f.control('agreement-voice-upload-read')).json(),receipt('ABSENT'));assert.deepEqual(await(await f.control('agreement-voice-upload-cancel')).json(),receipt('CANCELLED'));
 assert.equal((await f.control('agreement-voice-upload-list',{agreementId:agreement})).status,200);assert.equal(posts(f).length,0);assert.deepEqual(operations(f),['READ','CANCEL','LIST']);
 const a=fixture({cancel:transfer('READY','SETTLED',false,{receipt:receipt('READY',{attachedMessageId:message})})});assert.equal((await(await a.control('agreement-voice-upload-cancel')).json()).attachedMessageId,message);
});
test('a foreign receipt, mixed identity, extra property, unsafe path or photo-shaped path fails before any Storage IO',async()=>{
 for(const patch of [{receipt:receipt('READY',{accountId:id(99)})},{receipt:receipt('READY',{agreementVersion:2})},{receipt:{...receipt('READY'),secret:'PRIVATE'}},{path:'https://evil.invalid/audio'},
  {path:`${account}/agreement-v5/${asset}/${sha}.jpg`},{path:`${account}/agreement-voice-v1/${asset}/${sha}.mp3`},{durationMs:299},{byteSize:4194305},{receipt:receipt('READY',{voice:{assetId:asset,durationMs,byteSize:size,contentType:'audio/mpeg'}})}]){
  const f=fixture({claim:transfer('READY','SETTLED',false,patch)});assert.equal((await f.invoke()).status,503);assert.ok(!f.calls.some(x=>x.path.startsWith('/storage/')));
 }
});
test('a list with a foreign, failed, attached or duplicate upload is refused as a whole',async()=>{
 for(const uploads of [[receipt('READY',{accountId:id(99)})],[receipt('FAILED')],[receipt('READY',{attachedMessageId:message})],[receipt('READY'),receipt('READY')]]){
  const f=fixture({transport:c=>c.body?.p_operation==='LIST'?json({accountId:account,agreementId:agreement,uploads,authoritative:true}):null});
  assert.equal((await f.control('agreement-voice-upload-list',{agreementId:agreement})).status,503);
 }
});
test('playback reauthorizes the exact historical message twice and withholds the bytes after a session or visibility revocation',async()=>{
 const good=fixture(),r=await good.read();assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'audio/mp4');assert.equal(r.headers.get('content-length'),String(size));
 assert.equal(createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex'),sha);
 assert.equal(good.calls.filter(x=>x.path.endsWith('/'+READ)).length,2);assert.equal(good.calls.filter(x=>x.path.startsWith('/storage/')).length,1);
 let reads=0;const bad=fixture({transport:c=>c.path.endsWith('/'+READ)&&++reads===2?json({message:'MEDIA_NOT_FOUND'},403):null});
 const denied=await bad.read();assert.equal(denied.status,403);assert.deepEqual(await denied.json(),{code:'MEDIA_NOT_FOUND'});
 const own=fixture();assert.equal((await own.control('agreement-voice-read',{agreementId:agreement,assetId:asset})).status,200);
 assert.equal(own.calls.find(x=>x.path.endsWith('/'+READ)).body.p_message_id,null);
});
test('a wrong MIME, wrong bytes, extra read context or a missing session binding can never return audio',async()=>{
 const mime=fixture({transport:c=>c.path.startsWith('/storage/')?new Response(new Uint8Array(audio),{headers:{'Content-Type':'image/jpeg'}}):null});assert.equal((await mime.read()).status,503);
 const bytes=fixture({transport:c=>c.path.startsWith('/storage/')?new Response(new Uint8Array(audio.subarray(0,size-1)),{headers:{'Content-Type':'audio/mp4'}}):null});assert.equal((await bytes.read()).status,503);
 const extra=fixture();assert.equal((await extra.control('agreement-voice-read',{agreementId:agreement,assetId:asset,messageId:message,accountId:account})).status,400);assert.equal(extra.calls.length,1);
 const f=fixture();assert.equal((await f.invoke('agreement-voice-upload',new Uint8Array(audio),{Authorization:'Bearer '+token({session_id:null})})).status,401);assert.equal(f.calls.length,1);
 const foreign=fixture({transport:c=>c.path.endsWith('/'+READ)?json({...readReceipt(),path:`${id(99)}/agreement-voice-v1/${asset}/${sha}.m4a`,bucket:'profile-media'}):null});assert.equal((await foreign.read()).status,503);
});
test('an invalid container records FAILED before any stage, a wrong declared type never reaches the database, and an oversize body costs nothing',async()=>{
 const corrupt=new Uint8Array(audio);corrupt[4]=0x58;
 const f=fixture();const r=await f.invoke('agreement-voice-upload',corrupt);assert.equal(r.status,400);assert.deepEqual(await r.json(),{code:'MEDIA_FORMAT_UNSUPPORTED'});assert.deepEqual(operations(f),['CLAIM','FAIL']);assert.equal(posts(f).length,0);
 const tiny=fixture();const t=await tiny.invoke('agreement-voice-upload',new Uint8Array(10));assert.equal(t.status,400);assert.deepEqual(await t.json(),{code:'MEDIA_INPUT_INVALID'});assert.deepEqual(operations(tiny),['CLAIM','FAIL']);
 const image=fixture();const i=await image.invoke('agreement-voice-upload',new Uint8Array(audio),{'Content-Type':'image/jpeg'});assert.equal(i.status,400);assert.deepEqual(await i.json(),{code:'MEDIA_FORMAT_UNSUPPORTED'});assert.equal(image.calls.length,1);
 const big=fixture();const b=await big.invoke('agreement-voice-upload',new Uint8Array(4194305));assert.equal(b.status,413);assert.equal(big.calls.length,1);
 const rate=fixture({transport:c=>c.body?.p_operation==='CLAIM'?json({message:'MEDIA_RATE_LIMITED'},429):null});assert.equal((await rate.invoke()).status,429);assert.equal(posts(rate).length,0);
 const conflict=fixture({transport:c=>c.body?.p_operation==='CLAIM'?json({message:'MEDIA_COMMAND_CONFLICT'},409):null});assert.equal((await conflict.invoke()).status,409);assert.equal(posts(conflict).length,0);
});
test('malformed control requests and unknown voice operations are refused before any database call',async()=>{
 for(const [op,body] of [['agreement-voice-upload-read',{agreementId:agreement,agreementVersion:0,clientRequestId:key}],['agreement-voice-upload-read',{agreementId:agreement,agreementVersion:1,clientRequestId:'x'}],
  ['agreement-voice-upload-cancel',{agreementId:agreement,agreementVersion:1,clientRequestId:key,extra:1}],['agreement-voice-upload-list',{agreementId:agreement,extra:1}],['agreement-voice-bogus',{agreementId:agreement}]]){
  const f=fixture();assert.equal((await f.control(op,body)).status,400);assert.equal(f.calls.length,1);
 }
 const f=fixture();const r=await f.invoke('agreement-voice-upload',new Uint8Array(audio),{'x-media-version':'0'});assert.equal(r.status,400);assert.equal(f.calls.length,1);
});
