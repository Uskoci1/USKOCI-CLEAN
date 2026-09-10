import assert from 'node:assert/strict';

export const publicationForward = '20260910144644_clean_w05_publication_evaluator_authority.sql';
/** D0140's unchanged-function assertions belong to the proven source102 prefix.
 * SQL103 intentionally replaces B06; it is applied and proved by W05 afterwards.
 * The entire current source inventory is still admitted before any DB write. */
export function publicationBoundary(fullPlan) {
  assert.equal(fullPlan.source_migration_count, 103, 'W05_EXPECTS_EXACT_SOURCE103');
  const next = fullPlan.pending_successors.at(-1);
  assert.equal(next?.file, publicationForward, 'W05_EXPECTS_KNOWN_FINAL_SUCCESSOR');
  assert.equal(fullPlan.source_inventory.at(-1)?.file, publicationForward);
  const successors = fullPlan.pending_successors.slice(0, -1);
  return { next, fullPlan, predecessorPlan: { ...fullPlan,
    source_migration_count: 102, source_inventory: fullPlan.source_inventory.slice(0, -1),
    pending_successors: successors, pending_successor_count: successors.length,
    proof_boundary: 'SOURCE102_BEFORE_INTENTIONAL_W05_AUTHORITY_CHANGE' } };
}
