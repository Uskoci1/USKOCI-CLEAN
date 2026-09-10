import assert from 'node:assert/strict';
import {ownedIntakeSourceBoundary} from '../../../scripts/ci/owned-intake-source.mjs';

export const publicationForward = '20260910144644_clean_w05_publication_evaluator_authority.sql';
export const exportDeliveryForward = '20260910153005_clean_p2_export_delivery_authority.sql';
export const retentionExecutionForward = '20260910162955_clean_p3_retention_execution_authority.sql';
/** D0140's unchanged-function assertions belong to the proven source102 prefix.
 * SQL103 intentionally replaces B06; it is applied and proved by W05 afterwards.
 * SQL104/P2 and SQL105/P3 are separately proved; both are admitted here but not applied before
 * W05's original authority assertions. Every source byte is still admitted by
 * readPendingSourcePlan before this explicit boundary and any database write. */
export function publicationBoundary(currentPlan) {
  const intake=ownedIntakeSourceBoundary(currentPlan),fullPlan=intake.predecessorPlan;
  assert.equal(fullPlan.source_migration_count, 105, 'W05_EXPECTS_EXACT_SOURCE105');
  assert.equal(fullPlan.source_inventory.length, 105, 'W05_INVENTORY_COUNT_MISMATCH');
  assert.equal(fullPlan.pending_successor_count, fullPlan.pending_successors.length);
  const knownSuffix = [publicationForward, exportDeliveryForward, retentionExecutionForward];
  assert.deepEqual(fullPlan.pending_successors.slice(-3).map(x => x.file), knownSuffix, 'W05_EXPECTS_KNOWN_AUTHORITY_SUFFIX');
  assert.deepEqual(fullPlan.source_inventory.slice(102).map(x => x.file), knownSuffix, 'W05_EXPECTS_KNOWN_INVENTORY_SUFFIX');
  const [next, ...deferredSuccessors] = fullPlan.pending_successors.slice(-3);
  for (const [index, successor] of [next, ...deferredSuccessors].entries()) {
    for (const field of ['md5'])
      assert.equal(successor[field], fullPlan.source_inventory[102 + index][field], 'W05_PENDING_IDENTITY_MISMATCH');
  }
  const successors = fullPlan.pending_successors.slice(0, -3);
  return { next, fullPlan:intake.fullPlan, deferredSuccessors:[...deferredSuccessors,intake.next], predecessorPlan: { ...fullPlan,
    source_migration_count: 102, source_inventory: fullPlan.source_inventory.slice(0, 102),
    pending_successors: successors, pending_successor_count: successors.length,
    proof_boundary: 'SOURCE102_BEFORE_INTENTIONAL_W05_AUTHORITY_CHANGE' } };
}
