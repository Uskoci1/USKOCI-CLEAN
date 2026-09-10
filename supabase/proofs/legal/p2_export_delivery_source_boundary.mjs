import assert from 'node:assert/strict';

export const deliveryForward = '20260910153005_clean_p2_export_delivery_authority.sql';
export const retentionExecutionForward = '20260910162955_clean_p3_retention_execution_authority.sql';
/** Admit the entire exact inventory first. Original P2 invariants execute at
 * source103; delivery104 then proves its intentional projection/owner extension.
 * The exact known SQL105 is admitted but deferred to its P3 execution proof. */
export function deliveryBoundary(fullPlan) {
  assert.equal(fullPlan.source_migration_count, 105, 'P2_DELIVERY_EXPECTS_EXACT_SOURCE105');
  assert.equal(fullPlan.source_inventory.length, 105, 'P2_DELIVERY_INVENTORY_COUNT_MISMATCH');
  assert.equal(fullPlan.pending_successor_count, fullPlan.pending_successors.length);
  const knownSuffix = [deliveryForward, retentionExecutionForward];
  assert.deepEqual(fullPlan.pending_successors.slice(-2).map(x => x.file), knownSuffix, 'P2_DELIVERY_EXPECTS_KNOWN_SUFFIX');
  assert.deepEqual(fullPlan.source_inventory.slice(103).map(x => x.file), knownSuffix);
  const [next, deferred] = fullPlan.pending_successors.slice(-2);
  for (const [index, successor] of [next, deferred].entries()) {
    for (const field of ['md5'])
      assert.equal(successor[field], fullPlan.source_inventory[103 + index][field], 'P2_DELIVERY_PENDING_IDENTITY_MISMATCH');
  }
  const successors = fullPlan.pending_successors.slice(0, -2);
  assert.equal(successors.at(-1)?.file, '20260910144644_clean_w05_publication_evaluator_authority.sql');
  return { next, fullPlan, deferredSuccessors: [deferred], predecessorPlan: { ...fullPlan,
    source_migration_count: 103, source_inventory: fullPlan.source_inventory.slice(0, 103),
    pending_successors: successors, pending_successor_count: successors.length,
    proof_boundary: 'SOURCE103_BEFORE_INTENTIONAL_P2_DELIVERY_CHANGE' } };
}
