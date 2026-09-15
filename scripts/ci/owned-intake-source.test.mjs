import { historicalSource108Fixture } from '../../supabase/proofs/historical_source108_fixture.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {readP3RetentionPredecessorPlan as readCurrentPlan} from '../../supabase/proofs/legal/p3_retention_schedule_predecessor.mjs';
import {ownedIntakeSourceBoundary,ownedIntakeForward,retentionForward,pushTransportForward,dispatchLockForward} from './owned-intake-source.mjs';
import {prepare105,prepareNativeSuccessors,admitNativeSuccessors} from './owned-intake-proof.mjs';
const require=createRequire(import.meta.url);
const {classify,makePlan,testArguments}=require('./scope.cjs');

// This historical planner intentionally remains closed to the larger integration source.
const readP3RetentionPredecessorPlan = (root) => root ? readCurrentPlan(root) : historicalSource108Fixture(readCurrentPlan);
test('expanded current source is rejected by the unchanged SQL108 boundary', () => {
  const current = readCurrentPlan();
  assert.ok(current.source_migration_count > 108);
  assert.throws(() => ownedIntakeSourceBoundary(current), /W03_EXACT_SOURCE108_REQUIRED/);
});

test('exact admitted108 splits at105 and106 without losing the transport successor',()=>{
  const plan=readP3RetentionPredecessorPlan(),b=ownedIntakeSourceBoundary(plan);
  assert.equal(b.fullPlan,plan);assert.equal(b.predecessorPlan.source_migration_count,105);
  assert.equal(b.predecessorPlan.source_inventory.at(-1).file,retentionForward);
  assert.equal(b.next.file,ownedIntakeForward);
  assert.deepEqual(b.deferredSuccessors.map(x=>x.file),[pushTransportForward,dispatchLockForward]);
  assert.deepEqual([...b.predecessorPlan.pending_successors,b.next,...b.deferredSuccessors],plan.pending_successors);
  assert.deepEqual(b.predecessorPlan.source_inventory,plan.source_inventory.slice(0,105));
});
test('unknown, missing, reordered or changed105/106 cannot become an admitted prefix',()=>{
  const plan=readP3RetentionPredecessorPlan();
  for(const count of [104,105,106,107,109])assert.throws(()=>ownedIntakeSourceBoundary({...plan,source_migration_count:count}));
  for(const index of [104,105])for(const key of ['file','md5','sha256','bytes']){
    const altered=structuredClone(plan);altered.source_inventory[index][key]=key==='bytes'?1:'changed';
    assert.throws(()=>ownedIntakeSourceBoundary(altered),key+':'+index);
  }
  for(const key of ['file','md5']){const altered=structuredClone(plan);altered.pending_successors.at(-1)[key]='changed';assert.throws(()=>ownedIntakeSourceBoundary(altered));}
  const reordered=structuredClone(plan);reordered.source_inventory.splice(-2,2,...reordered.source_inventory.slice(-2).reverse());
  assert.throws(()=>ownedIntakeSourceBoundary(reordered));
});
test('shared native/bootstrap entry refuses non-loopback targets before any database call',()=>{
  for(const run of [prepare105,prepareNativeSuccessors,admitNativeSuccessors])
    assert.throws(()=>run({RU5_DEVICE_SUPABASE_URL:'https://example.com',RU5_DEVICE_DB_URL:'postgresql://postgres:example@example.com/postgres'}));
});
test('current native schema cannot be prepared or admitted outside explicit marketplace scope',()=>{
  const local={RU5_DEVICE_SUPABASE_URL:'http://127.0.0.1:54321',RU5_DEVICE_DB_URL:'postgresql://postgres:example@127.0.0.1:54322/postgres'};
  for(const run of [prepareNativeSuccessors,admitNativeSuccessors]){
    for(const scope of [undefined,'intake','core'])assert.throws(()=>run({...local,AI_REVIEW_SCOPE:scope}),{code:'ERR_ASSERTION'});
    assert.throws(()=>run({...local,AI_REVIEW_SCOPE:'marketplace',RU5_DEVICE_ARTIFACT_DIR:'artifacts/other'}),{code:'ERR_ASSERTION'});
    assert.throws(()=>run({...local,AI_REVIEW_SCOPE:'marketplace',RU5_DEVICE_ARTIFACT_DIR:'artifacts/ai-review-device',GITHUB_SHA:'main'}),{code:'ERR_ASSERTION'});
  }
});
test('known intake edits select affected local tests without an unrelated native Auth run',()=>{
  for(const path of ['src/app/(app)/nova.tsx','src/app/(app)/pregled-nacrta.tsx','src/data/aiNeedV2Production.ts',
    'src/contracts/aiNeedV2.ts','supabase/functions/uskoci-ai-interview/index.ts',
    'supabase/proofs/ai/owned_intake_proof.mjs','.github/workflows/ai-edge-context-proof.yml',
    'supabase/migrations/'+ownedIntakeForward]){
    assert.ok(classify([path]).includes('w03'),path);assert.ok(!classify([path]).includes('auth'),path);
  }
  const tracked=['src/data/__tests__/w03-ai-need-client.test.ts','src/data/__tests__/ai-owned-intake-screen.test.tsx',
    'src/data/__tests__/draft-review-screen.test.tsx','src/data/__tests__/w02-location-native.test.tsx',
    'src/data/__tests__/password-recovery.test.ts'];
  const targets=testArguments(makePlan([],{domain:'w03'}),tracked);
  for(const path of tracked.slice(0,-1))assert.ok(targets.includes(path),path);
  assert.ok(!targets.includes(tracked.at(-1)));
});

// Run the actual catalog comparator, with disposable snapshots only. This is a
// JavaScript classification regression; the separate PostgreSQL proof owns DB evidence.
function catalogComparison(alter=()=>{},alterBefore=()=>{}) {
  const source=readFileSync(new URL('../../supabase/proofs/ai/owned_intake_proof.mjs',import.meta.url),'utf8');
  const declarations=source.slice(source.indexOf(' const changedBodySignatures='),source.indexOf(" sql(source.toString('utf8'));"));
  const loopStart=source.indexOf(' for(const old of oldFunctions){const after=');
  const comparison=source.slice(loopStart,source.indexOf(" assert.equal(sql('select private.retention_ai_source_ready()'),'t');",loopStart));
  assert.ok(declarations.includes('changedBodyOids')&&comparison.includes('assert.deepEqual(after,old)'));
  const signatures=[
    'public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)',
    'public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)',
    'public.rpc_save_need_draft_from_review(uuid,uuid,text)',
    'public.rpc_ai_confirm_fact(uuid)','public.rpc_ai_correct_fact_v2(uuid,jsonb,text)','public.rpc_ai_correct_fact(uuid,text)',
    'public.unrelated_fixture_function()',
  ];
  const bySignature=new Map(signatures.map((name,i)=>[name,String(9001+i)]));
  const oldFunctions=signatures.map(name=>({oid:bySignature.get(name),body_md5:'a'.repeat(32),proacl:['owner=X/owner','service_role=X/owner'],
    prosecdef:true,proconfig:['search_path=pg_catalog'],proowner:'10'}));
  const afterFunctions=new Map(oldFunctions.map(row=>[row.oid,structuredClone(row)]));
  alter(afterFunctions);alterBefore(oldFunctions);
  const directOids=signatures.slice(0,2).map(name=>bySignature.get(name));
  const sql=query=>{
    if(query.includes('::regprocedure::oid')){
      const name=query.match(/^select '([^']+)'::regprocedure::oid(?:::text)?$/)?.[1];
      assert.ok(bySignature.has(name));return bySignature.get(name);
    }
    const oid=query.match(/^select ([0-9]+)::oid::regprocedure::text$/)?.[1];
    return signatures.find(name=>bySignature.get(name)===oid)??'UNKNOWN';
  };
  return new Function('assert','oldFunctions','directOids','afterFunctions','sql','q','report',declarations+comparison)(
    assert,oldFunctions,directOids,afterFunctions,sql,value=>"'"+value+"'",{});
}

test('actual OID comparator admits only the four named bodies and two distinct old ACLs',()=>{
  catalogComparison(rows=>{
    for(const oid of ['9001','9002'])rows.get(oid).proacl=['owner=X/owner'];
    for(const oid of ['9003','9004','9005','9006'])rows.get(oid).body_md5='b'.repeat(32);
  });
});

test('actual catalog comparator rejects unknown changes, wrong exception type and missing rows',()=>{
  for(const oid of ['9001','9002','9007'])assert.throws(()=>catalogComparison(rows=>{rows.get(oid).body_md5='b'.repeat(32);}));
  for(const oid of ['9003','9004','9005','9006','9007'])assert.throws(()=>catalogComparison(rows=>{rows.get(oid).proacl=[];}));
  for(const oid of ['9001','9003','9007']){
    assert.throws(()=>catalogComparison(rows=>{rows.get(oid).prosecdef=false;}));
    assert.throws(()=>catalogComparison(rows=>{rows.delete(oid);}));
  }
  assert.throws(()=>catalogComparison(()=>{},rows=>{rows[2].oid=Number(rows[2].oid);}));
});
