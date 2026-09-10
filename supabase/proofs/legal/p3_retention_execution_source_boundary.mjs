import assert from 'node:assert/strict';
import {ownedIntakeSourceBoundary} from '../../../scripts/ci/owned-intake-source.mjs';

export const retentionExecutionForward = '20260910162955_clean_p3_retention_execution_authority.sql';
/** Full raw source admission precedes this explicit execution boundary. The
 * original registry assertions remain at source104, including the separately
 * admitted SQL104 nullable export_delivery contract. SQL105 executes afterwards. */
export function retentionExecutionBoundary(currentPlan) {
  const intake=ownedIntakeSourceBoundary(currentPlan),fullPlan=intake.predecessorPlan;
  assert.equal(fullPlan.source_migration_count, 105, 'P3_EXECUTION_EXPECTS_EXACT_SOURCE105');
  assert.equal(fullPlan.source_inventory.length, 105, 'P3_EXECUTION_INVENTORY_COUNT_MISMATCH');
  assert.equal(fullPlan.pending_successor_count, fullPlan.pending_successors.length);
  const knownSuffix = ['20260910153005_clean_p2_export_delivery_authority.sql', retentionExecutionForward];
  assert.deepEqual(fullPlan.pending_successors.slice(-2).map(x => x.file), knownSuffix, 'P3_EXECUTION_EXPECTS_KNOWN_SUFFIX');
  assert.deepEqual(fullPlan.source_inventory.slice(103).map(x => x.file), knownSuffix);
  for (const [index, successor] of fullPlan.pending_successors.slice(-2).entries()) {
    for (const field of ['md5'])
      assert.equal(successor[field], fullPlan.source_inventory[103 + index][field], 'P3_EXECUTION_PENDING_IDENTITY_MISMATCH');
  }
  const next = fullPlan.pending_successors.at(-1);
  const successors = fullPlan.pending_successors.slice(0, -1);
  return { next, fullPlan:intake.fullPlan, executionPlan:fullPlan, deferredSuccessors:[intake.next,...intake.deferredSuccessors], predecessorPlan: { ...fullPlan,
    source_migration_count: 104, source_inventory: fullPlan.source_inventory.slice(0, 104),
    pending_successors: successors, pending_successor_count: successors.length,
    proof_boundary: 'SOURCE104_BEFORE_INTENTIONAL_P3_EXECUTION_CHANGE' } };
}
