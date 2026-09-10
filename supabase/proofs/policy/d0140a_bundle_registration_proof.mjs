// D-0140-A policy bundle registration — disposable proof. Loopback only.
// Proves the registered bundle is inert (resolver NULL, not ready), that the
// activation gate is enforced by the schema, that activation alone admits no
// decision, and that ALLOW stays refused by the RU-3 service gate. No policy
// bundle is activated on any live target; no rule text is seeded.
import assert from 'node:assert/strict';
import { replayPendingDomain } from '../legal/pending_domain_replay.mjs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {readD0140aPredecessorPlan} from './d0140a_bundle_registration_predecessor.mjs';
import {publicationBoundary} from './publication_source_boundary.mjs';

const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const boundary=publicationBoundary(readD0140aPredecessorPlan());
const plan=boundary.predecessorPlan;
const out=env.D0140A_ARTIFACT_DIR||'artifacts/d0140a-bundle-registration';mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('supabase/proofs/policy/d0140a_bundle_registration_files.json','utf8'));
const forward=`supabase/migrations/${manifest.forward_file}`,bytes=readFileSync(forward);
assert.deepEqual(bytes,readFileSync(manifest.candidate_file));
assert.equal(bytes.length,manifest.bytes);
assert.equal(createHash('md5').update(bytes).digest('hex'),manifest.md5);
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
const SOURCE_DOC='docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md';
const SOURCE_SHA='792597eb4b5b940238f784587c9431613d3a71bdd7f662e9439fdbed134bd2aa';
const sourceBytes=readFileSync(SOURCE_DOC);
assert.equal(createHash('sha256').update(sourceBytes.toString('utf8').replace(/\r\n/g,'\n')).digest('hex'),SOURCE_SHA,'owner-locked source document changed');
const report={unit:'D0140A_BUNDLE_REGISTRATION',source_sha:env.GITHUB_SHA||null,run_id:env.GITHUB_RUN_ID||null,
  live_access:false,live_promotion:false,provider_called:false,mobile_proof:false,legal_content_real:false,
  policy_activated_live:false,rule_text_seeded:false,allow_enabled:false,
  fixture_boundary:'REAL_LOCAL_POSTGREST_AND_ROLE_SCOPED_PSQL_TRANSACTIONS',
  candidate:manifest,predecessor_plan:plan,full_source_plan:boundary.fullPlan,
  intentional_next_authority_forward:boundary.next,checks:[],lock_interleavings:[]};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const rid=env.RU5_DEVICE_REQUESTER_USER_ID,needId=env.RU5_DEVICE_NEED_ID;
assert.match(String(rid),/^[0-9a-f-]{36}$/i);assert.match(String(needId),/^[0-9a-f-]{36}$/i);
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(query){
  try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],
    {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
  catch(error){
    const code=String(error.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNAVAILABLE';
    report.failed_sql={sqlstate:code,query_sha256:createHash('sha256').update(query).digest('hex')};
    throw new Error(`DISPOSABLE_SQL_FAILED_${code}`);
  }
}
function sqlState(query){try{sql(query);return 'OK';}catch(error){return String(error.message).replace('DISPOSABLE_SQL_FAILED_','');}}
const rows=query=>JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));
async function rejected(promise,code,message){const r=await promise;assert.ok(r.error,'expected rejection');
  if(code)assert.equal(r.error.code,code);if(message)assert.equal(r.error.message,message);return r.error;}
let current='PREFLIGHT';
const check=name=>{current=name;console.log(`START_CHECK ${name}`);};
const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log(`PASS_CHECK ${current}`);};
const tableHash=(table,where='true')=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${table} x where ${where}`);
const authSql=(uid,query)=>`begin;set local role authenticated;select set_config('request.jwt.claim.sub',${q(uid)},true);select set_config('request.jwt.claims',${q(JSON.stringify({sub:uid,role:'authenticated'}))},true);${query};commit;`;
const serviceSql=query=>`begin;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);${query};commit;`;
const POLICY="'RS_PUBLICATION_POLICY_MINIMUM'",JUR="'RS'";
const resolver=()=>sql(`select coalesce(private.current_publication_policy_bundle(${POLICY},${JUR},statement_timestamp())::text,'NULL')`);
const bundleId=()=>sql(`select id from private.publication_policy_bundles where policy_id=${POLICY} and jurisdiction=${JUR} and version=1`);
const EXPECTED_RULES={'RS-MIN-001':'ALLOW','RS-MIN-002':'BLOCK','RS-MIN-003':'BLOCK','RS-MIN-004':'BLOCK','RS-MIN-005':'CLARIFY','RS-MIN-006':'BLOCK','RS-MIN-007':'BLOCK','RS-MIN-008':'BLOCK','RS-MIN-009':'BLOCK','RS-MIN-010':'BLOCK','RS-MIN-011':'BLOCK','RS-MIN-012':'CLARIFY','RS-MIN-013':'CLARIFY','RS-MIN-014':'REVIEW','RS-MIN-015':'NO_OVERRIDE','RS-MIN-016':'REVIEW'};
let history,predecessorCount;
try{
  check('PREFLIGHT_LIVE87_PREDECESSOR_WITHOUT_ANY_BUNDLE');
  predecessorCount=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(predecessorCount,plan.expected_predecessor_count);
  assert.equal(sql('select count(*) from private.publication_policy_bundles'),'0');
  assert.equal(sql('select count(*) from private.publication_policy_rule_refs'),'0');
  assert.equal(resolver(),'NULL');
  report.predecessor_history_count=predecessorCount;pass();

  {
  check('EXACT_FORWARD_APPLY_REGISTERS_ONE_INERT_BUNDLE_WITH_SIXTEEN_RULE_IDS');
  history=tableHash('supabase_migrations.schema_migrations');
  const before=rows('select to_jsonb(m) metadata from supabase_migrations.schema_migrations m order by version');
  report.original_full_history_sha256=createHash('sha256').update(JSON.stringify(before)).digest('hex');
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',forward],{stdio:'pipe'});
  sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(manifest.forward_version)},${q(manifest.forward_name)},array[${q(bytes.toString('utf8'))}])`);
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),history);
  const after=rows('select to_jsonb(m) metadata from supabase_migrations.schema_migrations m where version<>'+q(manifest.forward_version)+' order by version');
  report.after_original_full_history_sha256=createHash('sha256').update(JSON.stringify(after)).digest('hex');
  assert.equal(report.after_original_full_history_sha256,report.original_full_history_sha256);
  const bundles=rows('select policy_id,version,jurisdiction,is_reviewed,is_complete,is_active,reviewed_at,activated_at,effective_from,effective_until,review_provenance from private.publication_policy_bundles');
  assert.equal(bundles.length,1);
  const b=bundles[0];
  assert.deepEqual([b.policy_id,b.version,b.jurisdiction,b.is_reviewed,b.is_complete,b.is_active,b.reviewed_at,b.activated_at,b.effective_from,b.effective_until],['RS_PUBLICATION_POLICY_MINIMUM',1,'RS',false,false,false,null,null,null,null]);
  assert.equal(b.review_provenance.source,SOURCE_DOC);assert.equal(b.review_provenance.source_sha256,SOURCE_SHA);assert.equal(b.review_provenance.review_state,'PENDING_LEGAL_REVIEW');
  const refs=rows(`select rule_id,rule_provenance from private.publication_policy_rule_refs where bundle_id=${q(bundleId())} order by rule_id`);
  assert.deepEqual(Object.fromEntries(refs.map(r=>[r.rule_id,r.rule_provenance.outcome])),EXPECTED_RULES);
  for(const r of refs){assert.equal(r.rule_provenance.source_sha256,SOURCE_SHA);assert.ok(!('text' in r.rule_provenance)&&!('rule_text' in r.rule_provenance),'no rule text may be seeded');assert.match(r.rule_provenance.content,/^NOT_SEEDED/);}
  report.bundle=b;report.rule_ids=refs.map(r=>r.rule_id);
  report.exact_forward_file_applied_disposable=true;report.original_predecessor_full_history_unchanged=true;pass();
  }

  {
  check('REGISTERED_BUNDLE_IS_INERT_RESOLVER_NULL_NOT_READY_NO_ALLOW');
  assert.equal(resolver(),'NULL');
  assert.equal(sql(`select private.publication_policy_bundle_ready(${q(bundleId())},'RS',statement_timestamp())`),'f');
  assert.equal(sql(`select private.ru4b_has_exact_policy_allow('QUESTION',${q(needId)},1,null,'0000000000000000000000000000000000000000000000000000000000000000')`),'f');
  // The RU-3 service gate refuses ALLOW before it even looks at the bundle.
  await rejected(admin.rpc('rpc_record_need_publication_decision_service',{p_need_id:needId,p_expected_revision:1,p_policy_id:'RS_PUBLICATION_POLICY_MINIMUM',p_jurisdiction:'RS',p_outcome:'ALLOW',p_rule_ids:['RS-MIN-001'],p_decision_source:'PROOF',p_safe_reason_codes:[],p_provider_ref:null,p_model_ref:null,p_reviewer_provenance:{},p_service_provenance:{proof:true}}),'42501','RU3_ALLOW_NOT_ENABLED');
  pass();
  }

  {
  check('ACTIVATION_GATE_IS_SCHEMA_ENFORCED_AND_ACTIVATION_ALONE_ADMITS_NOTHING');
  const id=bundleId();
  assert.equal(sqlState(`update private.publication_policy_bundles set is_active=true where id=${q(id)}`),'23514','active requires review and completeness');
  assert.equal(sqlState(`update private.publication_policy_bundles set is_reviewed=true where id=${q(id)}`),'23514','review requires a review stamp');
  assert.equal(sqlState(`update private.publication_policy_bundles set is_reviewed=true,reviewed_at=statement_timestamp(),is_complete=true,is_active=true where id=${q(id)}`),'23514','activation requires activated_at');
  assert.equal(resolver(),'NULL');
  // Disposable-only rehearsal of the authorized activation act: the resolver then returns the bundle...
  sql(`update private.publication_policy_bundles set is_reviewed=true,reviewed_at=statement_timestamp(),is_complete=true,is_active=true,activated_at=statement_timestamp(),review_provenance=review_provenance||'{"review_state":"PROOF_REHEARSAL_ONLY"}'::jsonb where id=${q(id)}`);
  assert.equal(resolver(),id);
  assert.equal(sql(`select private.publication_policy_bundle_ready(${q(id)},'RS',statement_timestamp())`),'t');
  // ...but no decision exists, so nothing is allowed, and ALLOW is still refused by the service gate.
  assert.equal(sql(`select private.ru4b_has_exact_policy_allow('QUESTION',${q(needId)},1,null,'0000000000000000000000000000000000000000000000000000000000000000')`),'f');
  await rejected(admin.rpc('rpc_record_need_publication_decision_service',{p_need_id:needId,p_expected_revision:1,p_policy_id:'RS_PUBLICATION_POLICY_MINIMUM',p_jurisdiction:'RS',p_outcome:'ALLOW',p_rule_ids:['RS-MIN-001'],p_decision_source:'PROOF',p_safe_reason_codes:[],p_provider_ref:null,p_model_ref:null,p_reviewer_provenance:{},p_service_provenance:{proof:true}}),'42501','RU3_ALLOW_NOT_ENABLED');
  assert.equal(sqlState(`insert into private.publication_policy_bundles(policy_id,version,jurisdiction) values(${POLICY},1,${JUR})`),'23505','same version twice');
  assert.equal(sqlState(`insert into private.publication_policy_bundles(policy_id,version,jurisdiction,is_reviewed,reviewed_at,is_complete,is_active,activated_at) values(${POLICY},2,${JUR},true,statement_timestamp(),true,true,statement_timestamp())`),'23505','one active bundle per policy and jurisdiction');
  sql(`update private.publication_policy_bundles set is_active=false,activated_at=null where id=${q(id)}`);
  assert.equal(resolver(),'NULL');
  report.activation_rehearsal='DISPOSABLE_ONLY_REVERTED';pass();
  }

  {
  check('RULE_REFS_ARE_RESTRICTED_AND_CLIENT_ROLES_HAVE_NO_ACCESS');
  const id=bundleId();
  assert.equal(sqlState(`delete from private.publication_policy_bundles where id=${q(id)}`),'23503','rule refs restrict bundle deletion');
  assert.equal(sqlState(`insert into private.publication_policy_rule_refs(bundle_id,rule_id) values(${q(id)},'RS-MIN-001')`),'23505','rule ids unique per bundle');
  assert.equal(sqlState(`insert into private.publication_policy_rule_refs(bundle_id,rule_id) values(${q(id)},'  ')`),'23514','blank rule id refused');
  assert.equal(sqlState(authSql(rid,'select count(*) from private.publication_policy_bundles')),'42501');
  assert.equal(sqlState(authSql(rid,'select count(*) from private.publication_policy_rule_refs')),'42501');
  assert.equal(sqlState(serviceSql('select count(*) from private.publication_policy_bundles')),'42501','service_role has no direct table access either');
  assert.equal(sql(`select count(*) from private.publication_policy_rule_refs where bundle_id=${q(id)}`),'16');
  pass();
  }

  {
  check('FINAL_FINGERPRINTS_HISTORY_AND_NO_CONTENT');
  assert.equal(tableHash('supabase_migrations.schema_migrations',`version<>${q(manifest.forward_version)}`),history);
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(report.migration_history_count,predecessorCount+1);
  assert.equal(report.migration_history_count + plan.pending_successor_count,plan.source_migration_count);
  assert.equal(sql('select count(*) from private.publication_policy_bundles where is_active'),'0');
  assert.equal(sql("select count(*) from private.publication_policy_rule_refs where rule_provenance ? 'text' or rule_provenance ? 'rule_text'"),'0');
  assert.equal(sql('select count(*) from private.need_publication_decisions'),'0');
  assert.equal(sql('select count(*) from private.preselection_qa_policy_decisions'),'0');
  pass();
  }

  current='ADMITTED_SUCCESSOR_DOMAIN_INTEGRATION';
  report.successor_replay=await replayPendingDomain({plan,sql,db,url,snapshot:async()=>({
    tables: (manifest.new_tables ?? ['private.publication_policy_bundles','private.publication_policy_rule_refs']).map(table=>[table,tableHash(table)]),
    security: sql(`select coalesce(jsonb_agg(to_jsonb(p) order by n.nspname,p.proname,p.oid),'[]'::jsonb)::text
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private') and p.proname ~ 'publication_policy|ru4b_has_exact_policy_allow|record_need_publication_decision'`),
    tableGrants: sql(`select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl) order by n.nspname,c.relname),'[]'::jsonb)::text
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relname ~ 'publication_policy'`),
    columnGrants: sql(`select coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,a.attacl) order by n.nspname,c.relname,a.attnum),'[]'::jsonb)::text
      from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
      where n.nspname in ('public','private') and c.relname ~ 'publication_policy' and a.attnum>0 and not a.attisdropped`),
    policies: sql(`select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]'::jsonb)::text
      from pg_policies p where tablename ~ 'publication_policy'`),
    projection: [resolver(),sql('select count(*) from private.need_publication_decisions'),sql('select count(*) from private.preselection_qa_policy_decisions')],
  })});
  report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
  assert.equal(report.migration_history_count,plan.source_migration_count);
  report.result='PASS';
}catch(error){
  report.result='FAIL';report.failed_check=current;
  report.failure=error?.code==='ERR_ASSERTION'?`ASSERTION:${String(error.message).slice(0,200)}`:String(error.message).slice(0,200);
  process.exitCode=1;
}finally{
  writeFileSync(`${out}/proof-report.json`,`${JSON.stringify(report,null,2)}\n`);
  console.log(`${report.result} D0140A_BUNDLE_REGISTRATION`);
}
