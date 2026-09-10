import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readP3RetentionPredecessorPlan} from '../../supabase/proofs/legal/p3_retention_schedule_predecessor.mjs';
import {ownedIntakeSourceBoundary,ownedIntakeForward,retentionForward} from './owned-intake-source.mjs';
import {prepare105} from './owned-intake-proof.mjs';
const require=createRequire(import.meta.url);
const {classify,makePlan,testArguments}=require('./scope.cjs');

test('exact admitted106 splits at105 without losing or applying the owned intake successor',()=>{
  const plan=readP3RetentionPredecessorPlan(),b=ownedIntakeSourceBoundary(plan);
  assert.equal(b.fullPlan,plan);assert.equal(b.predecessorPlan.source_migration_count,105);
  assert.equal(b.predecessorPlan.source_inventory.at(-1).file,retentionForward);
  assert.equal(b.next.file,ownedIntakeForward);
  assert.deepEqual([...b.predecessorPlan.pending_successors,b.next],plan.pending_successors);
  assert.deepEqual(b.predecessorPlan.source_inventory,plan.source_inventory.slice(0,105));
});
test('unknown, missing, reordered or changed105/106 cannot become an admitted prefix',()=>{
  const plan=readP3RetentionPredecessorPlan();
  for(const count of [104,105,107])assert.throws(()=>ownedIntakeSourceBoundary({...plan,source_migration_count:count}));
  for(const index of [104,105])for(const key of ['file','md5','sha256','bytes']){
    const altered=structuredClone(plan);altered.source_inventory[index][key]=key==='bytes'?1:'changed';
    assert.throws(()=>ownedIntakeSourceBoundary(altered),key+':'+index);
  }
  for(const key of ['file','md5']){const altered=structuredClone(plan);altered.pending_successors.at(-1)[key]='changed';assert.throws(()=>ownedIntakeSourceBoundary(altered));}
  const reordered=structuredClone(plan);reordered.source_inventory.splice(-2,2,...reordered.source_inventory.slice(-2).reverse());
  assert.throws(()=>ownedIntakeSourceBoundary(reordered));
});
test('shared native/bootstrap entry refuses non-loopback targets before any database call',()=>{
  assert.throws(()=>prepare105({RU5_DEVICE_SUPABASE_URL:'https://example.com',RU5_DEVICE_DB_URL:'postgresql://postgres:example@example.com/postgres'}));
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
