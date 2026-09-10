import assert from 'node:assert/strict';

export const deliveryForward = '20260910153005_clean_p2_export_delivery_authority.sql';
/** Admit the entire exact inventory first. Original P2 invariants execute at
 * source103; delivery104 then proves its intentional projection/owner extension. */
export function deliveryBoundary(fullPlan) {
  assert.equal(fullPlan.source_migration_count, 104, 'P2_DELIVERY_EXPECTS_EXACT_SOURCE104');
  const next = fullPlan.pending_successors.at(-1);
  assert.equal(next?.file, deliveryForward, 'P2_DELIVERY_EXPECTS_KNOWN_FINAL_SUCCESSOR');
  assert.equal(fullPlan.source_inventory.at(-1)?.file, deliveryForward);
  const successors = fullPlan.pending_successors.slice(0, -1);
  assert.equal(successors.at(-1)?.file, '20260910144644_clean_w05_publication_evaluator_authority.sql');
  return { next, fullPlan, predecessorPlan: { ...fullPlan,
    source_migration_count: 103, source_inventory: fullPlan.source_inventory.slice(0, -1),
    pending_successors: successors, pending_successor_count: successors.length,
    proof_boundary: 'SOURCE103_BEFORE_INTENTIONAL_P2_DELIVERY_CHANGE' } };
}
