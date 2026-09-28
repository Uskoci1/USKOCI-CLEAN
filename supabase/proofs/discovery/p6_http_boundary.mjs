// Disposable local full-stack proof, never a DEV apply or an application writer.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env,root=process.cwd(),out=env.P6_PUBLIC_ARTIFACT_DIR;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
assert.equal(env.DB_URL,env.RU5_DEVICE_DB_URL);assert.equal(env.CI,'1');assert.equal(env.GITHUB_ACTIONS,'true');
assert.equal(out,'/tmp/p6-discovery-evidence');assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
assert(env.RU5_DEVICE_ANON_KEY&&env.RU5_DEVICE_SERVICE_ROLE_KEY);
mkdirSync(out,{recursive:true});
const candidate='supabase/candidates/p6_discovery_all.sql';
const pure=['src/data/discoveryV1Contract.ts','src/data/discoveryV1SpatialContract.ts','src/data/marketplaceView.ts',
 'src/lib/calendarTime.ts','src/lib/location.ts','src/lib/market.ts','src/ui/calendar/calendarPresentation.ts'];
const sources=[candidate,'supabase/proofs/discovery/p6_http_boundary.mjs','.github/workflows/p6-http-boundary-proof.yml',...pure,'package.json','package-lock.json'];
const report={unit:'P6_REAL_AUTH_POSTGREST_WIRE',result:'FAIL',sourceSha:env.GITHUB_SHA,sourceHashes:{},checks:[],
 historicalPredecessor:'147 frozen sources plus PKG045b',actualAuth:false,postgrestProven:false,clientWireProven:false,
 liveAccess:false,providerCalled:false,providerCalls:0,deviceProven:false,queryCostProven:false,productionWired:false,storeReady:false};
let stage='SOURCE_BINDING',applied=false,before,requests=0,createdAccounts=0,seeded=false;
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
function sql(text){try{return execFileSync('psql',[env.DB_URL,'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],
 {input:text,encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024}).trim();}
 catch(e){const error=new Error('LOCAL_SQL_REFUSED');error.sqlState=String(e.stderr??'').match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/)?.[1];throw error;}}
const catalog=()=>JSON.parse(sql(`select jsonb_build_object(
 'functions',(select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||p.proowner::text,E'\\n' order by p.oid)) from pg_proc p where p.pronamespace in ('public'::regnamespace,'private'::regnamespace) and p.prokind='f'),
 'policies',(select md5(jsonb_agg(to_jsonb(p) order by oid)::text) from pg_policy p),
 'relations',(select md5(jsonb_agg(jsonb_build_array(oid,relacl,relrowsecurity,relforcerowsecurity) order by oid)::text) from pg_class where relnamespace in ('public'::regnamespace,'private'::regnamespace)),
 'columns',(select md5(jsonb_agg(jsonb_build_array(attrelid,attnum,attacl) order by attrelid,attnum)::text) from pg_attribute where attrelid in (select oid from pg_class where relnamespace in ('public'::regnamespace,'private'::regnamespace))),
 'digest',private.closure_source_digest_v5(),'certificate',(select sha256 from private.closure_source_v5 where singleton),
 'erasure',(select sha256 from private.closure_erasure_source_v5 where singleton),'ready',private.retention_ai_source_ready())`));
const originalFetch=globalThis.fetch;
async function localFetch(input,init={}){
 const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 assert.equal(u.origin,env.RU5_DEVICE_SUPABASE_URL.replace(/\/$/,''),'LOCAL_HTTP_ORIGIN');
 assert(!u.username&&!u.password&&!u.hash&&(u.pathname.startsWith('/auth/v1/')||u.pathname.startsWith('/rest/v1/')),'LOCAL_HTTP_PATH');
 requests++;return originalFetch(input,{...init,redirect:'error',signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
}
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:localFetch}};
const ok=(label,result)=>{if(result.error){const e=new Error(label);e.boundaryCode=result.error.code;throw e;}return result.data;};
const check=name=>report.checks.push({name,result:'PASS'});
const clients=[],users=[];
try{
 assert.equal(git('rev-parse','HEAD'),env.GITHUB_SHA);
 for(const path of sources){const bytes=readFileSync(path);assert.deepEqual(bytes,execFileSync('git',['show',`${env.GITHUB_SHA}:${path}`]));report.sourceHashes[path]=createHash('sha256').update(bytes).digest('hex');}
 assert.equal(report.sourceHashes[candidate],'1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e','ROUND44_CANDIDATE_BINDING');
 const require=createRequire(resolve(root,'package.json')),ts=require('typescript'),allowed=new Set(pure.map(p=>resolve(root,p))),cache=new Map();
 function load(path){assert(allowed.has(path),'PURE_IMPORT_ALLOWLIST');if(cache.has(path))return cache.get(path).exports;
  const m={exports:{}};cache.set(path,m);const compiled=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports','module',compiled)(name=>{assert(name.startsWith('.'),'PURE_IMPORT_LOCAL');return load(resolve(dirname(path),`${name}.ts`));},m.exports,m);return m.exports;}
 const page=load(resolve(root,pure[0])),spatial=load(resolve(root,pure[1]));
 check('EXACT_COMMIT_AND_EXISTING_CLIENT_DECODERS');
 stage='PRECONDITION';before=catalog();assert.equal(sql("select to_regprocedure('public.rpc_discovery_v1(jsonb)') is null"),'t');assert.equal(before.ready,true);
 report.localPostgresVersion=sql('show server_version');report.nodeVersion=process.version;
 stage='LOCAL_CANDIDATE_INSTALL';
 sql(`begin;set local p6_discovery.disposable='SOURCE_ONLY_ROLLBACK';set local lock_timeout='5s';\n${readFileSync(candidate,'utf8')}\ncommit;notify pgrst,'reload schema';`);
 applied=true;check('ADDITIVE_LOCAL_INSTALL_NO_LIVE_LEDGER');
 stage='REAL_AUTH';
 const admin=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_SERVICE_ROLE_KEY,opts);
 for(const label of ['owner','reader','third']){
  const email=`p6-http-${label}-${randomUUID()}@proof.invalid`,password=`P6-Aa1!-${randomUUID()}`;
  const made=ok('LOCAL_ADMIN_CREATE',await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:`P6 fixture ${label}`,city:'Novi Sad'}}));
  assert.match(made.user.id,/^[a-f0-9-]{36}$/);createdAccounts++;const c=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,opts);
  const signed=ok('LOCAL_PASSWORD_SIGNIN',await c.auth.signInWithPassword({email,password}));assert(signed.session?.access_token);assert.equal(signed.user.id,made.user.id);
  const identity=ok('LOCAL_GET_USER',await c.auth.getUser());assert.equal(identity.user.id,made.user.id);clients.push(c);users.push(made.user.id);
 }
 assert.equal(new Set(users).size,3);report.actualAuth=true;check('THREE_DISTINCT_PASSWORD_SESSIONS_AND_GET_USER');
 stage='PUBLIC_BASELINE';
 const initial=await clients[1].from('needs').select('id',{count:'exact',head:true}).in('status',['PUBLISHED','SELECTION']).not('published_at','is',null).is('remaining_search_closed_at',null);
 ok('BASELINE_PUBLIC_READ',initial);assert(Number.isSafeInteger(initial.count));
 stage='FIXTURE_SEED';
 const prefix=`P6HTTP_${randomUUID()}`,ids=Array.from({length:6},()=>randomUUID()),owner=users[0];
 sql(`begin;set local session_replication_role=replica;
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,schedule_kind,published_at,execution_location_mode,approximate_lat,approximate_lng,approximate_city,approximate_area,task_country_code,task_timezone)
 select z.id,'${owner}'::uuid,p.id,case when z.i=5 then 'DRAFT' when z.i=6 then 'CANCELLED' else 'PUBLISHED' end,
 '${prefix}'||' task '||z.i,'PRIVATE_HTTP_MARKER','P6','OFFERS',2,1,'FLEXIBLE',case when z.i<>5 then statement_timestamp()-interval '1 day'+z.i*interval '1 microsecond' end,
 case when z.i=4 then 'REMOTE' else 'STATIONARY' end,case when z.i=4 then null when z.i<=2 then 45.25 else 44.82 end,
 case when z.i=4 then null when z.i<=2 then 19.83 else 20.46 end,'',
 '${prefix}'||case when z.i<=2 then ' Novi Sad' when z.i=4 then ' Remote' else ' Beograd' end,'RS','Europe/Belgrade'
 from unnest(array[${ids.map(id=>`'${id}'::uuid`).join(',')}]) with ordinality z(id,i)
 cross join public.app_profiles p where p.account_id='${owner}'::uuid and p.kind='REQUESTER';
 insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng) select id,'PRIVATE_HTTP_MARKER','PRIVATE_HTTP_MARKER',45.253456,19.834567 from public.needs where id=any(array[${ids.map(id=>`'${id}'::uuid`).join(',')}]);
 set local session_replication_role=origin;commit;`);seeded=true;
 const f={text:prefix,price:'all',where:'any',places:1,when:'any',dates:null,place:null};
 const requestsByMode={PAGE:{mode:'PAGE',filter:f,anchor:null,scope:{kind:'ALL'},limit:2,after:null},
 MAP:{mode:'MAP',filter:f,anchor:null,bounds:[-180,-90,180,90],grid:24},
 PLACES:{mode:'PLACES',filter:{...f,text:'ignored task text',place:'ignored selected locality'},anchor:null,prefix,facetArea:null,limit:1,after:null}};
 async function rpc(client,request){const result=await client.rpc('rpc_discovery_v1',{p_request:request});const data=ok('AUTHENTICATED_RPC',result);
  assert(!JSON.stringify(data).includes('PRIVATE_HTTP_MARKER'),'PRIVATE_MARKER_EXCLUDED');return data;}
 stage='SCHEMA_CACHE';
 for(let attempt=0;;attempt++){
  const response=await clients[1].rpc('rpc_discovery_v1',{p_request:{mode:'EXACT_PUBLIC',needId:ids[0]}});
  if(!response.error)break;
  if(response.error.code!=='PGRST202'||attempt>=4)ok('SCHEMA_CACHE_REFUSED',response);
  await new Promise(resolve=>setTimeout(resolve,500)); // bounded read-only readiness, not a mutation replay
 }
 stage='PAGE_WIRE';
 let req=requestsByMode.PAGE,seen=[];
 for(let i=0;i<4;i++){
  const decoded=page.decodeDiscoveryV1Page(await rpc(clients[1],req),2);assert.equal(decoded.counts.listed,4);seen.push(...decoded.items.map(x=>x.id));
  if(!decoded.hasMore)break;req={...req,anchor:decoded.anchor,after:decoded.nextCursor};
 }
 assert.equal(seen.length,4);assert.deepEqual([...seen].sort(),ids.slice(0,4).sort());check('PAGE_REAL_POSTGREST_DECODE_AND_KEYSET');
 stage='EXACT_WIRE_AND_PRIVATE_STATE';
 for(const c of clients){
  for(const id of ids){const response=page.decodeDiscoveryV1Exact(await rpc(c,{mode:'EXACT_PUBLIC',needId:id}),id);assert.equal(response.items.length,ids.indexOf(id)<4?1:0);}
 }
 check('EXACT_PUBLIC_THREE_ACCOUNTS_DRAFT_CANCELLED_EXCLUDED');
 stage='MAP_WIRE';
 for(const c of [clients[1],clients[2]]){const response=spatial.decodeDiscoveryV1Map(await rpc(c,requestsByMode.MAP));assert.equal(response.counts.mapped,4);assert.equal(response.counts.withoutPoint,1);
  assert.equal(response.buckets.reduce((sum,b)=>sum+(b.kind==='TASK'?1:b.taskCount),0),3);}
 check('MAP_REAL_POSTGREST_STRICT_CURRENT_DECODER');
 stage='PLACES_WIRE';
 req=requestsByMode.PLACES;const places=[];
 for(let i=0;i<4;i++){
  const response=spatial.decodeDiscoveryV1Places(await rpc(clients[1],req),1);assert.equal(response.counts.everywhere,initial.count+4);places.push(...response.items);
  if(!response.hasMore)break;req={...req,anchor:response.anchor,after:response.nextCursor};
 }
 assert.equal(places.length,2);assert.equal(new Set(places.map(x=>x.key)).size,2);assert.deepEqual(places.map(x=>x.count),[2,1]);
 check('PLACES_REAL_POSTGREST_CURRENT_TAIL_DECODER');
 stage='NEGATIVE_AUTH';
 const anonymous=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,opts);
 for(const request of [requestsByMode.PAGE,requestsByMode.MAP,requestsByMode.PLACES,{mode:'EXACT_PUBLIC',needId:ids[0]}]){
  const result=await anonymous.rpc('rpc_discovery_v1',{p_request:request});assert(result.error);assert([401,403].includes(result.status));
 }
 const malformed=await localFetch(env.RU5_DEVICE_SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/rpc_discovery_v1',{
  method:'POST',headers:{apikey:env.RU5_DEVICE_ANON_KEY,Authorization:'Bearer not.a.jwt','Content-Type':'application/json'},body:JSON.stringify({p_request:requestsByMode.PAGE})});
 assert([401,403].includes(malformed.status));await malformed.arrayBuffer();
 check('ANON_ALL_MODES_AND_MALFORMED_JWT_REFUSED');
 stage='COLUMN_AND_PRIVATE_ROW_BOUNDARY';
 const denied=await clients[1].from('needs').select('requester_account_id').eq('id',ids[0]);assert(denied.error);assert.equal(denied.error.code,'42501');
 for(const c of [clients[1],clients[2]]){const hidden=await c.from('need_sensitive').select('exact_address').in('need_id',ids.slice(0,4));
  if(hidden.error)assert.equal(hidden.error.code,'42501');else assert.deepEqual(hidden.data,[]);}
 check('PRIVATE_COLUMNS_AND_SENSITIVE_ROWS_NOT_EXPOSED');
 stage='MALFORMED_REQUESTS';
 for(const request of [{...requestsByMode.MAP,grid:25},{...requestsByMode.PAGE,limit:101},{...requestsByMode.PLACES,limit:31},null]){
  const result=await clients[1].rpc('rpc_discovery_v1',{p_request:request});assert(result.error);assert.equal(result.error.code,'22023');
 }
 check('STRICT_REQUEST_REFUSALS_OVER_HTTP');
 report.postgrestProven=true;report.clientWireProven=true;report.result='PASS';
}catch(error){report.failure={stage,category:'PROOF_REFUSED',
 ...(typeof error.sqlState==='string'&&/^[0-9A-Z]{5}$/.test(error.sqlState)?{sqlState:error.sqlState}:{}),
 ...(/^[A-Z0-9_]{3,100}$/.test(error.message??'')?{diagnostic:error.message}:{}),
 ...(typeof error.boundaryCode==='string'&&/^[A-Z0-9]{3,16}$/.test(error.boundaryCode)?{boundaryCode:error.boundaryCode}:{})};process.exitCode=1;}
finally{
 if(applied){try{
  sql(`begin;drop function public.rpc_discovery_v1(jsonb);drop function public.p6_discovery_area(text,text,boolean);drop function public.p6_discovery_unquote(text);drop function public.p6_discovery_key(text);drop function public.p6_discovery_trim(text);drop function public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz);drop function public.p6_discovery_civil(text);commit;`);
  assert.deepEqual(catalog(),before);assert.equal(sql("select to_regprocedure('public.rpc_discovery_v1(jsonb)') is null"),'t');check('CANDIDATE_REMOVED_EXISTING_AUTHORITY_UNCHANGED');report.localCandidateRemoved=true;
 }catch(error){report.result='FAIL';report.cleanupFailure={category:'CLEANUP_REFUSED'};process.exitCode=1;}}
 report.localHttpRequests=requests;report.createdAccounts=createdAccounts;report.authenticatedAccounts=users.length;report.publicRows=seeded?4:0;report.nonPublicRows=seeded?2:0;
 report.limitations=['Historical PKG045b predecessor, not current DEV compatibility','Admin-created local users are not N02 signup/email-delivery proof','Synthetic fixtures are removed by mandatory stack teardown, not product account deletion','No 30-sample latency budget, internal query plan or native evidence','No production reader wiring or live server apply'];
 writeFileSync(join(out,'p6-http-boundary-receipt.json'),JSON.stringify(report,null,2)+'\n');
 console.log(report.result+' P6_REAL_AUTH_POSTGREST_WIRE');
}
