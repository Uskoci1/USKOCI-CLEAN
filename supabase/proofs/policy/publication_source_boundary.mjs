import assert from 'node:assert/strict';

export const publicationForward = '20260910144644_clean_w05_publication_evaluator_authority.sql';
export const exportDeliveryForward = '20260910153005_clean_p2_export_delivery_authority.sql';
/** D0140's unchanged-function assertions belong to the proven source102 prefix.
 * SQL103 intentionally replaces B06; it is applied and proved by W05 afterwards.
 * SQL104 is separately proved by P2; it is admitted here but not applied before
 * W05's original authority assertions. Every source byte is still admitted by
 * readPendingSourcePlan before this explicit boundary and any database write. */
export function publicationBoundary(fullPlan) {
  assert.equal(fullPlan.source_migration_count, 104, 'W05_EXPECTS_EXACT_SOURCE104');
  assert.equal(fullPlan.source_inventory.length, 104, 'W05_INVENTORY_COUNT_MISMATCH');
  assert.equal(fullPlan.pending_successor_count, fullPlan.pending_successors.length);
  const knownSuffix = [publicationForward, exportDeliveryForward];
  assert.deepEqual(fullPlan.pending_successors.slice(-2).map(x => x.file), knownSuffix, 'W05_EXPECTS_KNOWN_AUTHORITY_SUFFIX');
  assert.deepEqual(fullPlan.source_inventory.slice(102).map(x => x.file), knownSuffix, 'W05_EXPECTS_KNOWN_INVENTORY_SUFFIX');
  const [next, deferred] = fullPlan.pending_successors.slice(-2);
  assert.equal(next.md5, fullPlan.source_inventory[102].md5, 'W05_PENDING_DIGEST_MISMATCH');
  assert.equal(deferred.md5, fullPlan.source_inventory[103].md5, 'W05_DEFERRED_DIGEST_MISMATCH');
  const successors = fullPlan.pending_successors.slice(0, -2);
  return { next, fullPlan, deferredSuccessors: [deferred], predecessorPlan: { ...fullPlan,
    source_migration_count: 102, source_inventory: fullPlan.source_inventory.slice(0, 102),
    pending_successors: successors, pending_successor_count: successors.length,
    proof_boundary: 'SOURCE102_BEFORE_INTENTIONAL_W05_AUTHORITY_CHANGE' } };
}
