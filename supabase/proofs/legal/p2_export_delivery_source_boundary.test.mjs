import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readP2ExportPredecessorPlan } from './p2_data_export_predecessor.mjs';
import { deliveryBoundary, deliveryForward } from './p2_export_delivery_source_boundary.mjs';

test('full source104 is admitted before original P2 assertions at source103', () => {
  const plan = readP2ExportPredecessorPlan(), boundary = deliveryBoundary(plan);
  assert.equal(plan.source_migration_count, 104);
  assert.deepEqual(boundary.fullPlan, plan);
  assert.equal(boundary.predecessorPlan.source_migration_count, 103);
  assert.deepEqual([...boundary.predecessorPlan.pending_successors, boundary.next], plan.pending_successors);
  assert.equal(boundary.next.file, deliveryForward);
  assert.equal(boundary.predecessorPlan.source_inventory.at(-1).file,
    '20260910144644_clean_w05_publication_evaluator_authority.sql');
});

test('missing, extra, unknown and reordered successors cannot evade intake invariants', () => {
  const plan = readP2ExportPredecessorPlan();
  for (const count of [103, 105]) assert.throws(() => deliveryBoundary({ ...plan, source_migration_count: count }));
  for (const field of ['pending_successors', 'source_inventory']) {
    const changed = structuredClone(plan); changed[field].at(-1).file = '20260910153006_unknown.sql';
    assert.throws(() => deliveryBoundary(changed));
  }
  const changed = structuredClone(plan); changed.pending_successors.splice(-2, 2, ...changed.pending_successors.slice(-2).reverse());
  assert.throws(() => deliveryBoundary(changed));
});
