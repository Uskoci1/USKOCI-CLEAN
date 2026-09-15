import { historicalSource108Fixture } from '../historical_source108_fixture.mjs';
import assert from 'node:assert/strict';
import {ownedIntakeForward,pushTransportForward,dispatchLockForward} from '../../../scripts/ci/owned-intake-source.mjs';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve,sep} from 'node:path';
import {test} from 'node:test';
import {readD0140aPredecessorPlan as readCurrentPlan} from './d0140a_bundle_registration_predecessor.mjs';
import {publicationBoundary,publicationForward,exportDeliveryForward,retentionExecutionForward} from './publication_source_boundary.mjs';

// This historical planner intentionally remains closed to the larger integration source.
const readD0140aPredecessorPlan = (root) => root ? readCurrentPlan(root) : historicalSource108Fixture(readCurrentPlan);
test('expanded current source is rejected by the unchanged SQL108 boundary', () => {
  const current = readCurrentPlan();
  assert.ok(current.source_migration_count > 108);
  assert.throws(() => publicationBoundary(current), /W03_EXACT_SOURCE108_REQUIRED/);
});

test('source108 is fully admitted while D0140 stays at102 and W05 applies only103',()=>{
  const plan=readD0140aPredecessorPlan(),result=publicationBoundary(plan);
  assert.equal(plan.source_migration_count,108);
  assert.deepEqual(result.fullPlan,plan);
  assert.equal(result.predecessorPlan.source_migration_count,102);
  assert.deepEqual(result.predecessorPlan.pending_successors.concat(result.next,result.deferredSuccessors),plan.pending_successors);
  assert.equal(result.next.file,publicationForward);
  assert.deepEqual(result.deferredSuccessors.map(x=>x.file),[exportDeliveryForward,retentionExecutionForward,ownedIntakeForward,pushTransportForward,dispatchLockForward]);
  assert.equal(result.predecessorPlan.source_inventory.at(-1).file,'20260910130851_clean_w02_resolved_location_authority.sql');
  assert.equal(result.predecessorPlan.source_inventory.length,102);
});

test('unknown or additional authority successors cannot silently evade old invariants',()=>{
  const plan=readD0140aPredecessorPlan();
  for(const count of [102,103,104,105,106,107,109])assert.throws(()=>publicationBoundary({...plan,source_migration_count:count}));
  const unknown=structuredClone(plan);unknown.pending_successors.at(-1).file='20260910153006_unknown.sql';
  assert.throws(()=>publicationBoundary(unknown));
  const wrongInventory=structuredClone(plan);wrongInventory.source_inventory.at(-1).file='20260910153006_unknown.sql';
  assert.throws(()=>publicationBoundary(wrongInventory));
  const reordered=structuredClone(plan);reordered.pending_successors.splice(-2,2,...reordered.pending_successors.slice(-2).reverse());
  assert.throws(()=>publicationBoundary(reordered));
  const changedDigest=structuredClone(plan);changedDigest.pending_successors.at(-1).md5='0'.repeat(32);
  assert.throws(()=>publicationBoundary(changedDigest));
});

for(const forward of [exportDeliveryForward,retentionExecutionForward,ownedIntakeForward,pushTransportForward,dispatchLockForward])
for(const mutation of ['missing','changed','unknown'])test('full admission rejects '+mutation+' '+forward+' before the W05 boundary',()=>historicalSource108Fixture(sourceRoot => {
  const root=mkdtempSync(join(tmpdir(),'w05-admission-'));
  assert.ok(root.startsWith(resolve(tmpdir())+sep)&&basename(root).startsWith('w05-admission-'));
  try{
    const predecessor='supabase/proofs/policy/d0140a_bundle_registration_predecessor_files.json';
    const admitted=JSON.parse(readFileSync(join(sourceRoot,predecessor),'utf8'));
    const paths=[predecessor,'supabase/proofs/policy/d0140a_bundle_registration_files.json',
      admitted.d03.manifest,admitted.ai_draft.manifest,'supabase/migrations/MIGRATION_PROVENANCE.json',
      ...readdirSync(join(sourceRoot,'supabase/migrations')).filter(x=>x.endsWith('.sql')).map(x=>'supabase/migrations/'+x)];
    for(const path of paths){const target=join(root,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(sourceRoot,path),target);}
    assert.equal(publicationBoundary(readD0140aPredecessorPlan(root)).fullPlan.source_migration_count,108);
    const target=join(root,'supabase/migrations',forward);
    if(mutation==='missing')rmSync(target);
    if(mutation==='changed')writeFileSync(target,'-- altered admitted successor bytes\n');
    if(mutation==='unknown')renameSync(target,join(dirname(target),'20260910153006_unknown.sql'));
    assert.throws(()=>publicationBoundary(readD0140aPredecessorPlan(root)),/SOURCE_PROVENANCE_INVENTORY_MISMATCH|PENDING_MD5_CHANGED/);
  }finally{rmSync(root,{recursive:true,force:true});}
}));
