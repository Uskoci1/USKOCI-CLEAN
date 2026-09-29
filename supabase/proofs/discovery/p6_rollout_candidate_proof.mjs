import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { URL } from 'node:url';

const root=process.cwd(), out='/tmp/p6-discovery-evidence';
const rollout='supabase/candidates/p6_discovery_rollout.sql';
const base='supabase/candidates/p6_discovery_all.sql';
const v2='supabase/candidates/p6_discovery_cost_v2.sql';
const v3='supabase/candidates/p6_discovery_cost_v3.sql';
const liveObservation='supabase/proofs/discovery/p6_rollout_live_observation.json';
const workflow='.github/workflows/p6-round56-rollout-proof.yml';
const own='supabase/proofs/discovery/p6_rollout_candidate_proof.mjs';
const sources=[rollout,base,v2,v3,liveObservation,own,'supabase/proofs/discovery/p6_http_latest.mjs',workflow,'package.json','package-lock.json'];
const functions=[
 'public.p6_discovery_trim(text)','public.p6_discovery_key(text)','public.p6_discovery_unquote(text)',
 'public.p6_discovery_area(text,text,boolean)','public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz)',
 'public.p6_discovery_civil(text)','public.rpc_discovery_v1(jsonb)'
];
const sha256=value=>createHash('sha256').update(value).digest('hex');
const report={unit:'P6_DEPLOYABLE_ROLLOUT_CANDIDATE',sourceSha:process.env.GITHUB_SHA,result:'FAIL',sourceHashes:{},
 liveAccess:false,serverApplied:false,providerCalled:false,native:false,productionWired:false,p6Finished:false};
let stage='ADMISSION';

function psql(input,timeout=180000){
 const run=spawnSync('psql',[process.env.DB_URL,'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],
  {input,encoding:'utf8',timeout,maxBuffer:20*1024*1024});
 return run;
}
function mustSql(input,timeout=180000){
 const run=psql(input,timeout);
 if(run.status!==0){
  const e=new Error('P6_ROLLOUT_SQL_REFUSED');
  e.stderr=run.stderr;throw e;
 }
 return run.stdout.trim();
}
function catalog(){
 const fn=functions.map(x=>"'" + x.replaceAll("'","''") + "'").join(',');
 const raw=mustSql(`select jsonb_build_object(
  'rpcPresent',to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null,
  'cert',(select sha256 from private.closure_source_v5 where singleton),
  'erasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
  'digest',private.closure_source_digest_v5(),
  'ready',private.retention_ai_source_ready(),
  'needsAcl',(select relacl::text from pg_class where oid='public.needs'::regclass),
  'authTableSelect',has_table_privilege('authenticated','public.needs','SELECT'),
  'anonTableSelect',has_table_privilege('anon','public.needs','SELECT'),
  'privateReadable',exists(select 1 from unnest(array['requester_account_id','remaining_search_closed_by_account_id','remaining_search_close_reason']) c
    where has_column_privilege('authenticated','public.needs',c,'SELECT') or has_column_privilege('anon','public.needs',c,'SELECT')),
  'functions',(select coalesce(jsonb_object_agg(sig,jsonb_build_object(
     'present',p.oid is not null,
     'bodyMd5',case when p.oid is null then null else md5(replace(p.prosrc,E'\\r\\n',E'\\n')) end,
     'definer',p.prosecdef,'volatility',p.provolatile,'settings',p.proconfig,
     'authenticated',case when p.oid is null then false else has_function_privilege('authenticated',p.oid,'EXECUTE') end,
     'anon',case when p.oid is null then false else has_function_privilege('anon',p.oid,'EXECUTE') end,
     'serviceRole',case when p.oid is null then false else has_function_privilege('service_role',p.oid,'EXECUTE') end
   ) order by sig),'{}'::jsonb)
   from unnest(array[${fn}]) sig left join pg_proc p on p.oid=to_regprocedure(sig))
 )`);
 return JSON.parse(raw);
}
function expectedBodies(){
 const sql=`begin;
set local p6_discovery.disposable='SOURCE_ONLY_ROLLBACK';
${readFileSync(base,'utf8')}
${readFileSync(v2,'utf8')}
${readFileSync(v3,'utf8')}
select jsonb_object_agg(p.oid::regprocedure::text,md5(replace(p.prosrc,E'\\r\\n',E'\\n')) order by p.oid::regprocedure::text)
from pg_proc p where p.oid in (${functions.map(x=>"to_regprocedure('"+x+"')").join(',')});
rollback;`;
 const raw=mustSql(sql);
 const line=raw.split('\n').filter(x=>x.startsWith('{')).at(-1);
 assert(line,'P6_EXPECTED_HASH_OUTPUT');
 return JSON.parse(line);
}
function applyRollout(expectSuccess){
 const run=spawnSync('psql',[process.env.DB_URL,'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-f',rollout],
  {encoding:'utf8',timeout:180000,maxBuffer:20*1024*1024});
 if(expectSuccess && run.status!==0){
  const error=new Error('P6_ROLLOUT_APPLY_LOCAL'); error.stderr=run.stderr; throw error;
 }
 if(!expectSuccess){
  assert.notEqual(run.status,0,'P6_ROLLOUT_REPEAT_MUST_REFUSE');
  assert.match(run.stderr,/P6_ROLLOUT_ALREADY_INSTALLED/);
 }
 return run;
}

try{
 assert.equal(process.env.CI,'1');assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.equal(process.env.P6_PUBLIC_ARTIFACT_DIR,out);
 const u=new URL(process.env.DB_URL);
 assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'54322');assert.equal(u.pathname,'/postgres');assert.equal(u.username,'postgres');
 assert.equal(process.env.DB_URL,process.env.RU5_DEVICE_DB_URL);
 mkdirSync(out,{recursive:true});
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 assert.equal(head,report.sourceSha);
 for(const path of sources){
  const bytes=readFileSync(path);
  assert.deepEqual(bytes,execFileSync('git',['show',head+':'+path]));
  report.sourceHashes[path]=sha256(bytes);
 }
 assert.equal(report.sourceHashes[base],'1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e');
 assert.equal(report.sourceHashes[v2],'4eae3b7befc498318c504bc40c344d72962c0a7e97dcb426bb65df3637944ba3');
 assert.equal(report.sourceHashes[v3],'88cc4d2271ac4a5695a7b831737f80ffcaecc40b2cc9e887200d90825191d05b');
 report.rolloutSha256=report.sourceHashes[rollout];

 stage='PKG045B_PRECONDITION';
 const pre=catalog();
 assert.equal(pre.rpcPresent,false);
 assert.equal(pre.authTableSelect,false);assert.equal(pre.anonTableSelect,false);assert.equal(pre.privateReadable,false);
 assert.equal(pre.ready,true);assert.equal(pre.cert,pre.erasure);assert.equal(pre.cert,pre.digest);
 report.localPredecessor={pkg045bRestricted:true,cert:pre.cert,needsAclSha256:sha256(Buffer.from(pre.needsAcl??''))};

 stage='ROUND48_HTTP_REFRESH';
 const http=JSON.parse(readFileSync(out+'/p6-http-latest-receipt.json','utf8'));
 assert.equal(http.result,'PASS');assert.equal(http.sourceSha,head);
 assert.equal(http.actualAuth,true);assert.equal(http.postgrestProven,true);assert.equal(http.clientWireProven,true);
 assert.equal(http.checks.length,11);assert(http.checks.every(x=>x.result==='PASS'));
 report.http={groups:11,accounts:http.authenticatedAccounts,requests:http.localHttpRequests,currentDecoders:true};

 stage='EXACT_BODY_EQUIVALENCE';
 const expected=expectedBodies();
 assert.equal(Object.keys(expected).length,7);
 report.expectedFinalBodyMd5=expected;

 stage='DEPLOYABLE_LOCAL_APPLY';
 applyRollout(true);
 const post=catalog();
 assert.equal(post.rpcPresent,true);assert.equal(post.ready,true);
 assert.equal(post.cert,pre.cert);assert.equal(post.erasure,pre.erasure);assert.equal(post.digest,pre.digest);
 assert.equal(post.needsAcl,pre.needsAcl);assert.equal(post.authTableSelect,false);assert.equal(post.privateReadable,false);
 const actual=Object.fromEntries(Object.entries(post.functions).map(([key,value])=>[key,value.bodyMd5]));
 assert.deepEqual(actual,expected);
 for(const [signature,value] of Object.entries(post.functions)){
  assert.equal(value.definer,false,signature);assert.deepEqual(value.settings,['search_path=pg_catalog'],signature);
  assert.equal(value.authenticated,true,signature);assert.equal(value.anon,false,signature);assert.equal(value.serviceRole,false,signature);
 }
 report.postApply={certificateUnchanged:true,needsAclUnchanged:true,exactBodyMatch:true,functions:Object.keys(post.functions).length};

 stage='IDEMPOTENCY_REFUSAL';
 applyRollout(false);
 const afterRepeat=catalog();
 assert.deepEqual(afterRepeat.functions,post.functions);assert.equal(afterRepeat.cert,post.cert);assert.equal(afterRepeat.needsAcl,post.needsAcl);
 report.repeatApply='REFUSED_WITHOUT_DRIFT';

 const live=JSON.parse(readFileSync(liveObservation,'utf8'));
 assert.equal(live.rpcDiscoveryV1Present,false);assert.equal(live.pkg045bApplied,false);assert.equal(live.ledgerCount,210);
 report.currentDevObservation=live;
 report.currentDevAdmissible=false;
 report.currentDevBlocker='PKG045b compatible-device gate remains unmet/applied=false; rollout candidate deliberately refuses this predecessor.';
 report.result='PASS';
}catch(error){
 report.failure={stage,category:'PROOF_REFUSED',message:/^P6_[A-Z0-9_]+$/.test(error.message)?error.message:'P6_ROLLOUT_PROOF_FAILED'};
 if(typeof error.stderr==='string'){
  const state=error.stderr.match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/);
  if(state) report.failure.sqlState=state[1];
  const diagnostic=error.stderr.match(/(P6_[A-Z0-9_]+(?::[^\n]*)?)/);
  if(diagnostic) report.failure.diagnostic=diagnostic[1].slice(0,240);
 }
 process.exitCode=1;
}finally{
 report.limits=[
  'Canonical DEV was observed read-only only; no P6 or PKG045b live apply.',
  'The deployable candidate intentionally requires PKG045b already restricted and closure certificate ready.',
  'PKG045b approval is historical/conditional; compatible-device evidence is still required before its apply.',
  'This package proves exact rollout bytes/body/ACL/certificate behavior on a disposable historical target, not native acceptance.',
  'Wider distributions/concurrency/30000-scale and production route/native FULL-return/memory remain open.'
 ];
 writeFileSync(out+'/p6-rollout-candidate-receipt.json',JSON.stringify(report,null,2)+'\n');
 console.log(report.result+' P6_DEPLOYABLE_ROLLOUT_CANDIDATE');
}
