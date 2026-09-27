// P5 source-only isolated SQL-role runner. NOT RUN / NOT DEPLOYMENT READY.
// Reuse existing disposable replay, never canonical DEV. No Auth/provider/Storage IO.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertLocalDeviceProofTargets} from './ru5_device_ui_local_guard.mjs';
import {migrationSnapshotQuery} from './pre_v3/history_snapshot.mjs';

const env=process.env;
const candidate='supabase/candidates/worker_profile_licenses_owned_projection.sql';
const proof='supabase/proofs/worker_profile_licenses_owned_projection_proof.sql';
const runner='supabase/proofs/worker_profile_licenses_owned_projection_proof.mjs';
const workflow='.github/workflows/worker-profile-licenses-owned-projection-proof.yml';
const surface='supabase/proofs/pkg023/pkg023_surface.sql';
const expectedChecks=[
  'EXACT_PREDECESSOR_AUTHORITY_AND_UNMOVED_CERTIFICATES',
  'DRAFT_EXACT_OLD_OUTPUT_PLUS_SELF_DECLARED_ARRAY',
  'OWNERSHIP_EMPTY_AND_MISSING_PROFILE',
  'CANONICAL_COMPLETION_PRESERVES_ARRAY_AND_OUTPUT',
  'SYNTHETIC_SUSPENDED_AND_CLOSED_STATUS_MATRIX',
  'AUTH_AND_EXECUTE_DENIALS_NEVER_CLEAR_DATA',
];
const hash=value=>createHash('sha256').update(value).digest('hex');
const report={unit:'WORKER_PROFILE_LICENSES_OWNED_PROJECTION',result:'FAIL',sourceSha:null,sourceTree:null,
  disposableOnly:true,actualDatabase:false,sqlAuthenticatedRoles:false,actualAuth:false,
  liveAccess:false,clientWired:false,deploymentReady:false,providerCalls:0,storageCalls:0,
  certificateMoved:null,catalogRestored:false,fixtureDataRestored:false,checks:[],sourceArtifactHashes:{}};
let stage='LOCAL_TARGET_ADMISSION';
let outputDirectory;
let baseline;

function psql(input,file=false){
  return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-A','-t',
    '-v','ON_ERROR_STOP=1','-v','ECHO=none','-v','VERBOSITY=sqlstate',
    ...(file?['-v','worker_profile_licenses_local_attested=true','-f',proof]:[])],
  {input:file?undefined:input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:90000,maxBuffer:8*1024*1024,
    env:{...env,PGOPTIONS:'-c statement_timeout=30000 -c lock_timeout=5000',PSQL_HISTORY:'/dev/null'}}).trim();
}
const rows=sql=>JSON.parse(psql(`select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (${sql}) x`));
function snapshot(){
  const catalog=rows(`select
    private.closure_source_digest_v5() as digest,
    (select to_jsonb(c) from private.closure_source_v5 c where singleton) as certificate,
    (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) as erasure,
    private.retention_ai_source_ready() as ready,
    private.closure_erasure_binding_v5() as binding,
    (select jsonb_agg(jsonb_build_array(p.oid,md5(to_jsonb(p)::text),obj_description(p.oid,'pg_proc')) order by p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private','rls_private')) as functions,
    (select jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relreplident) order by c.oid)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in('public','private','rls_private') and c.relkind in('r','p')) as table_authority,
    (select jsonb_agg(to_jsonb(c) order by c.data_class) from private.closure_dataset_catalog_v5 c) as datasets,
    (select jsonb_agg(to_jsonb(p) order by p.pubname) from pg_publication p) as publications,
    (select jsonb_agg(to_jsonb(p) order by p.pubname,p.schemaname,p.tablename) from pg_publication_tables p) as publication_tables`)[0];
  // In-memory local-fixture hashes only; no row, identity or body enters artifacts.
  const data=rows(`select
    (select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'[]')) from public.app_profiles p) as profiles,
    (select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) from public.app_accounts a) as accounts,
    (select md5(coalesce(jsonb_agg(to_jsonb(u) order by id)::text,'[]')) from auth.users u) as auth_users`)[0];
  return {catalog,data,surface:psql(readFileSync(surface,'utf8')),history:rows(migrationSnapshotQuery())};
}
function fail(){
  if(report.failureStage) report.rollbackFailureStage=stage;
  else report.failureStage=stage;
  process.exitCode=1;
  // Never serialize Error, argv, SQL, JWT, database URLs or fixture values.
  console.error('FAIL WORKER_PROFILE_LICENSES_'+stage);
}

try{
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
  assert.equal(env.DB_URL,env.RU5_DEVICE_DB_URL);
  for(const key of ['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS']) assert.ok(!env[key]);
  assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
  stage='EXACT_COMMIT_SOURCE_BINDING';
  report.sourceSha=env.GITHUB_SHA;
  report.sourceTree=execFileSync('git',['rev-parse',env.GITHUB_SHA+'^{tree}'],{encoding:'utf8'}).trim();
  for(const path of [candidate,proof,runner,workflow,surface,'supabase/proofs/ru5_device_ui_local_guard.mjs','supabase/proofs/pre_v3/history_snapshot.mjs']){
    const bytes=readFileSync(path);
    assert.deepEqual(bytes,execFileSync('git',['show',env.GITHUB_SHA+':'+path]));
    report.sourceArtifactHashes[path]=hash(bytes);
  }
  outputDirectory=resolve(env.WORKER_PROFILE_LICENSES_ARTIFACT_DIR??'artifacts/worker-profile-licenses');
  mkdirSync(outputDirectory,{recursive:true});
  stage='CATALOG_AND_FIXTURE_BASELINE';
  baseline=snapshot();
  assert.equal(baseline.catalog.ready,true);
  assert.equal(baseline.catalog.digest,baseline.catalog.certificate.sha256);
  assert.equal(baseline.catalog.digest,baseline.catalog.erasure.sha256);
  report.catalogBeforeSha256=hash(JSON.stringify(baseline));
  report.actualDatabase=true;
  stage='EXACT_CANDIDATE_SQL_ROLE_PROOF';
  const stdout=psql(null,true);
  const observed=stdout.split(/\r?\n/).filter(line=>line.startsWith('PASS WORKER_PROFILE_LICENSES_'))
    .map(line=>line.slice('PASS WORKER_PROFILE_LICENSES_'.length));
  assert.deepEqual(observed,expectedChecks);
  report.checks=observed.map(name=>({name,result:'PASS'}));
  report.sqlAuthenticatedRoles=true;
}catch{fail();}
finally{
  if(baseline){
    stage='INDEPENDENT_POST_ROLLBACK_CATALOG_AND_FIXTURES';
    try{
      const after=snapshot();
      report.catalogAfterSha256=hash(JSON.stringify(after));
      report.certificateMoved=JSON.stringify(after.catalog.certificate)!==JSON.stringify(baseline.catalog.certificate)
        ||JSON.stringify(after.catalog.erasure)!==JSON.stringify(baseline.catalog.erasure);
      assert.deepEqual(after,baseline);
      report.catalogRestored=true;
      report.fixtureDataRestored=true;
      report.checks.push({name:'INDEPENDENT_POST_ROLLBACK_CATALOG_AND_FIXTURES',result:'PASS'});
    }catch{fail();}
  }
  if(!report.failureStage&&report.catalogRestored) report.result='PASS';
  if(outputDirectory) writeFileSync(resolve(outputDirectory,'worker-profile-licenses-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(report.result+' WORKER_PROFILE_LICENSES_OWNED_PROJECTION');
}
