import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readD0140aPredecessorPlan} from './d0140a_bundle_registration_predecessor.mjs';
import {publicationBoundary,publicationForward} from './publication_source_boundary.mjs';

test('source103 is fully admitted while old D0140 assertions retain the exact102 boundary',()=>{
  const plan=readD0140aPredecessorPlan(),result=publicationBoundary(plan);
  assert.equal(plan.source_migration_count,103);
  assert.deepEqual(result.fullPlan,plan);
  assert.equal(result.predecessorPlan.source_migration_count,102);
  assert.deepEqual(result.predecessorPlan.pending_successors.concat(result.next),plan.pending_successors);
  assert.equal(result.next.file,publicationForward);
  assert.equal(result.predecessorPlan.source_inventory.at(-1).file,'20260910130851_clean_w02_resolved_location_authority.sql');
});

test('unknown or additional authority successors cannot silently evade old invariants',()=>{
  const plan=readD0140aPredecessorPlan();
  assert.throws(()=>publicationBoundary({...plan,source_migration_count:104}));
  const unknown=structuredClone(plan);unknown.pending_successors.at(-1).file='20260910144645_unknown.sql';
  assert.throws(()=>publicationBoundary(unknown));
  const wrongInventory=structuredClone(plan);wrongInventory.source_inventory.at(-1).file='20260910144645_unknown.sql';
  assert.throws(()=>publicationBoundary(wrongInventory));
});
