import { historicalSource108Fixture } from '../historical_source108_fixture.mjs';
import assert from 'node:assert/strict';
import {ownedIntakeForward,pushTransportForward,dispatchLockForward} from '../../../scripts/ci/owned-intake-source.mjs';
import { test } from 'node:test';
import { readP2ExportPredecessorPlan as readCurrentPlan } from './p2_data_export_predecessor.mjs';
import { deliveryBoundary, deliveryForward, retentionExecutionForward } from './p2_export_delivery_source_boundary.mjs';

// This historical planner intentionally remains closed to the larger integration source.
const readP2ExportPredecessorPlan = (root) => root ? readCurrentPlan(root) : historicalSource108Fixture(readCurrentPlan);
test('the exact current source147 is admitted through the recorded manifest and keeps the SQL108 historical view', () => {
  const current = readCurrentPlan();
  assert.equal(current.source_migration_count, 147);
  const boundary = deliveryBoundary(current);
  assert.equal(boundary.fullPlan.source_migration_count, 147);
  assert.equal(boundary.historicalPlan.source_migration_count, 108);
  assert.equal(boundary.historicalPlan.proof_boundary, 'SOURCE108_HISTORICAL_VIEW_OF_ADMITTED_SOURCE147');
  assert.equal(boundary.currentSourceAdmission.unit, 'EXACT_CURRENT_SOURCE147_ADMISSION');
  assert.equal(boundary.currentSourceAdmission.successors_after_108, 39);
  assert.equal(boundary.currentSourceAdmission.successors.at(-1).file, current.source_inventory.at(-1).file);
  assert.equal(boundary.deferredSuccessors.at(-1).file, '20260910214845_clean_dispatch_need_lock_order.sql');
});

test('a current source that is not exactly the recorded 147 is rejected before any database step', () => {
  const current = readCurrentPlan();
  const dropLast = { ...current, source_migration_count: 146, source_inventory: current.source_inventory.slice(0, -1), pending_successors: current.pending_successors.slice(0, -1), pending_successor_count: current.pending_successor_count - 1 };
  assert.throws(() => deliveryBoundary(dropLast), /CURRENT_SOURCE_COUNT_NOT_ADMITTED/);
  const mutated = { ...current, source_inventory: current.source_inventory.map((entry, index) => index === 120 ? { ...entry, md5: '0'.repeat(32) } : entry) };
  assert.throws(() => deliveryBoundary(mutated), /CURRENT_SOURCE_INVENTORY_CHANGED/);
  const swapped = { ...current, source_inventory: [...current.source_inventory.slice(0, 108), ...current.source_inventory.slice(109), current.source_inventory[108]] };
  assert.throws(() => deliveryBoundary(swapped), /CURRENT_SOURCE_INVENTORY_CHANGED/);
});

test('full source108 is admitted before original P2 assertions at source103 and delivery104', () => {
  const plan = readP2ExportPredecessorPlan(), boundary = deliveryBoundary(plan);
  assert.equal(plan.source_migration_count, 108);
  assert.deepEqual(boundary.fullPlan, plan);
  assert.equal(boundary.predecessorPlan.source_migration_count, 103);
  assert.deepEqual([...boundary.predecessorPlan.pending_successors, boundary.next, ...boundary.deferredSuccessors], plan.pending_successors);
  assert.equal(boundary.next.file, deliveryForward);
  assert.deepEqual(boundary.deferredSuccessors.map(x => x.file), [retentionExecutionForward,ownedIntakeForward,pushTransportForward,dispatchLockForward]);
  assert.equal(boundary.predecessorPlan.source_inventory.at(-1).file,
    '20260910144644_clean_w05_publication_evaluator_authority.sql');
});

test('missing, extra, unknown and reordered successors cannot evade intake invariants', () => {
  const plan = readP2ExportPredecessorPlan();
  for (const count of [103, 104, 105, 106,107,109]) assert.throws(() => deliveryBoundary({ ...plan, source_migration_count: count }));
  for (const field of ['pending_successors', 'source_inventory']) {
    const changed = structuredClone(plan); changed[field].at(-1).file = '20260910153006_unknown.sql';
    assert.throws(() => deliveryBoundary(changed));
  }
  const changed = structuredClone(plan); changed.pending_successors.splice(-2, 2, ...changed.pending_successors.slice(-2).reverse());
  assert.throws(() => deliveryBoundary(changed));
  for (const index of [-2, -1]) for (const field of ['md5']) {
    const altered = structuredClone(plan); altered.pending_successors.at(index)[field] = 'changed';
    assert.throws(() => deliveryBoundary(altered));
  }
});
