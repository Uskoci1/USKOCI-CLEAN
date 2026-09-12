// P12 composition: exact Edge/client source, real disposable Auth/PostgREST/SQL.
// Geocoder responses are explicitly synthetic; all external network IO is denied.
// No deployed gateway, live configuration, real AI/geocoder or handset claim.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {assert,env,sha,q,sql,rows,ok,requester,worker,requesterId,workerId,rp,wp,login,prove,pass,randomUUID} from './closure_runtime.mjs';
import {loadPreV3Clients} from './client_runtime.mjs';
import {migrationSnapshotQuery} from './history_snapshot.mjs';
const upstreamOrigin='https://pre-v3-proof.supabase.co';
const plain=x=>JSON.parse(JSON.stringify(x));
const accept=async p=>{const x=await p;assert.equal(x.ok,true,x.kod);return x.podatak;};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
await prove('PRE_V3_PROVIDER_BOUNDARIES','provider-boundaries-report.json',async report=>{
 await login();const history=rows(migrationSnapshotQuery());assert.equal(history.length,123);report.historyCount=123;
 report.actualClient=true;report.actualEdgeHandler=true;report.mockedRpcResponses=false;report.providerOutputSynthetic=true;
 const workerToken=(await ok(worker.auth.getSession())).session.access_token;
 const requesterToken=(await ok(requester.auth.getSession())).session.access_token;
 let clock=Date.now(),providerMode='ok',providerCalls=0;const envReads=[],calls=[];const hashes={};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const providerRecord={display_name:'Novi Sad, Srbija',lat:'45.2671',lon:'19.8335',place_id:'12345',address:{country_code:'rs'}};
 function loadEdge(path,location=false){
  const bytes=readFileSync(path);assert.deepEqual(bytes,execFileSync('git',['show',sha+':'+path]));hashes[path]=createHash('sha256').update(bytes).digest('hex');
  let handler;
  const context=vm.createContext({exports:{},Request,Response,Headers,URL,URLSearchParams,Intl,TextEncoder,TextDecoder,ReadableStream,AbortController,Date:Clock,setTimeout,clearTimeout,
   console:{error:()=>assert.fail('NO_EDGE_LOGGING'),log:()=>assert.fail('NO_EDGE_LOGGING'),warn:()=>assert.fail('NO_EDGE_LOGGING')},
   Deno:{serve:h=>{handler=h;},env:{get:k=>{envReads.push(k);return k==='SUPABASE_URL'?upstreamOrigin:k==='SUPABASE_ANON_KEY'?env.RU5_DEVICE_ANON_KEY:k==='LOCATIONIQ_ACCESS_TOKEN'&&location?'SYNTHETIC_GEOCODER_TOKEN':undefined;}}},
   fetch:async(input,init={})=>{
    const url=new URL(String(input));calls.push({path:url.pathname,origin:url.origin});
    assert.equal(init.redirect,'error');
    if(url.origin===upstreamOrigin){
     assert.ok(url.pathname==='/auth/v1/user'||url.pathname==='/rest/v1/rpc/rpc_list_location_markets'||url.pathname==='/rest/v1/rpc/rpc_get_need_publication_context');
     return fetch(env.RU5_DEVICE_SUPABASE_URL+url.pathname+url.search,init);
    }
    assert.ok(location&&url.origin==='https://eu1.locationiq.com'&&['/v1/search','/v1/reverse'].includes(url.pathname),'FORBIDDEN_EXTERNAL_NETWORK');
    assert.equal(new Headers(init.headers).get('Authorization'),null);assert.equal(new Headers(init.headers).get('apikey'),null);
    assert.equal(url.searchParams.get('key'),'SYNTHETIC_GEOCODER_TOKEN');providerCalls++;
    if(providerMode==='rate')return new Response('PRIVATE_SYNTHETIC_PROVIDER_BODY',{status:429});
    if(providerMode==='country')return json([{...providerRecord,address:{country_code:'de'}}]);
    if(providerMode==='malformed')return new Response('PRIVATE_SYNTHETIC_PROVIDER_BODY',{status:200});
    if(providerMode==='unavailable')throw new Error('PRIVATE_SYNTHETIC_PROVIDER_STACK');
    return json(url.pathname.endsWith('/reverse')?providerRecord:[providerRecord]);
   }});
  const compiled=ts.transpileModule(bytes.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
  assert.deepEqual(compiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
  new vm.Script(compiled.outputText,{filename:path}).runInContext(context);assert.equal(typeof handler,'function');return handler;
 }
 const locationEdge=loadEdge('supabase/functions/uskoci-location-search/index.ts',true);
 const publicationEdge=loadEdge('supabase/functions/uskoci-publication-evaluate/index.ts');
 const invoke=async(handler,body,token)=>{clock+=2500;return handler(new Request('https://controlled-handler.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}));};
 const invalid=await invoke(locationEdge,{text:'Novi Sad',countryCode:'RS'},'SYNTHETIC_INVALID_SESSION');assert.equal(invalid.status,401);assert.equal(providerCalls,0);
 const unknown=await invoke(locationEdge,{text:'Novi Sad',countryCode:'ZZ'},workerToken);assert.equal(unknown.status,403);assert.equal(providerCalls,0);
 let current={user:{id:workerId},accountRevision:1};let currentClient=worker;
 const runtime=loadPreV3Clients({sourceSha:sha,client:()=>currentClient,session:()=>current});
 const locationClient=runtime.load('src/data/locationClientService.ts').workerLocationClientService;
 const makeResolver=runtime.load('src/data/configuredLocationResolver.ts').createConfiguredLocationResolver;
 const resolver=makeResolver({endpoint:upstreamOrigin+'/functions/v1/uskoci-location-search',providerHint:'locationiq',getAccessToken:async()=>workerToken},
  async(_url,init)=>invoke(locationEdge,JSON.parse(String(init.body)),workerToken));
 const before=await accept(locationClient.read());
 const proposal=await resolver.search({text:'Novi Sad',countryCode:'RS',scopeKey:'worker-location-owned-input'});
 assert.equal(proposal.status,'PROPOSALS');assert.equal(proposal.requiresConfirmation,true);assert.equal(proposal.candidates.length,1);
 assert.equal(proposal.candidates[0].origin.kind,'PROVIDER_CANDIDATE');assert.equal(proposal.candidates[0].origin.providerHint,'locationiq');
 assert.deepEqual(plain(await accept(locationClient.read())),plain(before),'LOOKUP_MUST_NOT_SAVE');
 const reverse=await resolver.reverse({position:plain(proposal.candidates[0].position),countryCode:'RS',scopeKey:'worker-confirmation'});
 assert.equal(reverse.status,'PROPOSALS');assert.equal(reverse.requiresConfirmation,true);
 assert.deepEqual(plain(await accept(locationClient.read())),plain(before),'REVERSE_MUST_NOT_SAVE');
 const chosen=proposal.candidates[0].position;
 const value={operatingCountryCode:'RS',city:'Novi Sad',radiusKm:17,approximatePosition:{latitude:Number(chosen.latitude.toFixed(2)),longitude:Number(chosen.longitude.toFixed(2))}};
 const unconfirmed=await locationClient.save({expectedRevision:before.revision,confirmed:false,value});assert.equal(unconfirmed.ok,false);assert.equal(unconfirmed.kod,'LOCATION_CONFIRMATION_REQUIRED');
 assert.equal((await accept(locationClient.read())).revision,before.revision);
 const saved=await accept(locationClient.save({expectedRevision:before.revision,confirmed:true,value}));assert.equal(saved.saved,true);
 const readback=await accept(locationClient.read());assert.equal(readback.revision,saved.location.revision);assert.equal(readback.city,value.city);
 const matching=rows(`select p.city,p.radius_km,w.approximate_lat,w.approximate_lng,extensions.st_y(w.approximate_geog::extensions.geometry) lat,extensions.st_x(w.approximate_geog::extensions.geometry) lng
 from public.app_profiles p join public.worker_match_preferences w on w.worker_profile_id=p.id where p.id=${q(wp)}::uuid`)[0];
 assert.deepEqual(matching,{city:value.city,radius_km:17,approximate_lat:45.27,approximate_lng:19.83,lat:45.27,lng:19.83});
 pass(report,'ACTUAL_AUTH_EDGE_FORWARD_REVERSE_CLIENT_MAPPING_STAYS_PROPOSAL_UNTIL_EXPLICIT_CANONICAL_SAVE_AND_MATCHING_READBACK');
 for(const [mode,expected] of [['rate','RATE_LIMITED'],['country','UNAVAILABLE'],['malformed','UNAVAILABLE'],['unavailable','UNAVAILABLE']]){
  providerMode=mode;const result=await resolver.search({text:'Novi Sad',countryCode:'RS',scopeKey:'failure-'+mode});assert.equal(result.status,expected);
  assert.equal((await accept(locationClient.read())).revision,readback.revision);assert.ok(!JSON.stringify(result).includes('PRIVATE_SYNTHETIC'));
 }
 pass(report,'PROVIDER_429_WRONG_COUNTRY_MALFORMED_UNAVAILABLE_SAFE_MAPPING_NO_AUTOSAVE');
 providerMode='ok';current={user:{id:requesterId},accountRevision:2};currentClient=requester;
 const policyState=rows('select id,is_active from private.publication_policy_bundles order by id');
 const needId=randomUUID();
 // Local SQL fixture only; deliberately disable policy, never approve or create
 // a legal rule. The earlier Need proof separately uses actual human-reviewed AI save.
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline)
 values(${q(needId)}::uuid,${q(requesterId)}::uuid,${q(rp)}::uuid,'DRAFT','P12 gated draft','Disposable policy boundary','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days');
 update private.publication_policy_bundles set is_active=false;commit;`);
 try{
  assert.equal(sql("select private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM','RS',statement_timestamp()) is null"),'t');
  const beforeDecisions=sql('select count(*) from private.need_publication_decisions'),beforeProviderCalls=providerCalls;
  const secretsBefore=envReads.filter(k=>['OPENAI_API_KEY','GEMINI_API_KEY','SUPABASE_SERVICE_ROLE_KEY'].includes(k)).length;
  let switchAfterResponse=false;
  currentClient=new Proxy(requester,{get(target,prop){
   if(prop==='functions')return{invoke:async(name,{body})=>{assert.equal(name,'uskoci-publication-evaluate');const r=await invoke(publicationEdge,body,requesterToken);const data=await r.json();if(switchAfterResponse)current={user:{id:workerId},accountRevision:3};return r.ok?{data,error:null}:{data:null,error:{context:new Response(JSON.stringify(data),{status:r.status})}};}};
   const v=Reflect.get(target,prop);return typeof v==='function'?v.bind(target):v;
  }});
  const publication=runtime.load('src/data/publicationClientService.ts').publicationClientService;
  const first=await accept(publication.evaluate({needId,expectedRevision:1}));assert.equal(first.kind,'NOT_READY');assert.equal(first.authoritativeDecision,false);
  assert.deepEqual(plain(await accept(publication.evaluate({needId,expectedRevision:1}))),plain(first));
  const outsider=await invoke(publicationEdge,{needId,expectedRevision:1},workerToken);assert.equal(outsider.status,403);
  switchAfterResponse=true;const fenced=await publication.evaluate({needId,expectedRevision:1});assert.equal(fenced.ok,false);assert.match(fenced.kod,/ACCOUNT_CHANGED/);
  assert.equal(sql('select count(*) from private.need_publication_decisions'),beforeDecisions);assert.equal(providerCalls,beforeProviderCalls);
  assert.equal(envReads.filter(k=>['OPENAI_API_KEY','GEMINI_API_KEY','SUPABASE_SERVICE_ROLE_KEY'].includes(k)).length,secretsBefore);
  assert.equal(sql(`select status from public.needs where id=${q(needId)}::uuid`),'DRAFT');
  pass(report,'ACTUAL_PUBLICATION_CLIENT_EDGE_OWNED_SQL_NOT_READY_REPEAT_READBACK_OUTSIDER_DENIAL_AND_LATE_ACCOUNT_FENCE_NO_SECRET_OR_PROVIDER');
 }finally{
  for(const p of policyState)sql(`update private.publication_policy_bundles set is_active=${p.is_active?'true':'false'} where id=${q(p.id)}::uuid`);
  assert.deepEqual(rows('select id,is_active from private.publication_policy_bundles order by id'),policyState);
 }
 assert.deepEqual(rows(migrationSnapshotQuery()),history);report.edgeSourceHashes=hashes;report.clientSourceHashes=runtime.sourceHashes;
 report.syntheticGeocoderCalls=providerCalls;report.productionProviderCalls=0;
 report.limitations=['Synthetic geocoder output; not LocationIQ/provider proof.','Actual local Auth/RPC responses; Edge deployed gateway and physical device not exercised.','Unapproved policy remains NOT_READY. ALLOW/CLARIFY/REVIEW/BLOCK and timeout cases are separately covered by exact Edge unit tests.','Approved live configuration, secrets, processor governance and legal activation are not inferred from source success.'];
});
