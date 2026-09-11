import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

export const ownedIntakeForward='20260910172132_clean_w03_owned_ai_intake_authority.sql';
export const retentionForward='20260910162955_clean_p3_retention_execution_authority.sql';
export const pushTransportForward='20260910193029_clean_n09_expo_push_transport.sql';
export const dispatchLockForward='20260910214845_clean_dispatch_need_lock_order.sql';
export const agreementChangeForward='20260911035330_clean_m05_agreement_change_authority.sql';

// Every raw file is admitted by the existing source reader before this exact
// split. Historical direct-writer assertions belong to105; W03 proves106.
export function ownedIntakeSourceBoundary(fullPlan, root=process.cwd()) {
  const manifest=JSON.parse(readFileSync(resolve(root,'supabase/proofs/ai/owned_intake_files.json'),'utf8'));
  assert.equal(fullPlan.source_migration_count,109,'W03_EXACT_SOURCE109_REQUIRED');
  assert.equal(fullPlan.source_inventory.length,109);
  assert.equal(fullPlan.pending_successor_count,fullPlan.pending_successors.length);
  const suffix=[retentionForward,ownedIntakeForward,pushTransportForward,dispatchLockForward,agreementChangeForward];
  assert.deepEqual(fullPlan.source_inventory.slice(104).map(x=>x.file),suffix);
  assert.deepEqual(fullPlan.pending_successors.slice(-5).map(x=>x.file),suffix);
  assert.equal(manifest.forward_file,ownedIntakeForward);
  assert.equal(manifest.predecessor105_file,retentionForward);
  assert.equal(manifest.expected_predecessor_count,105);assert.equal(manifest.expected_history_count,106);
  const [previous,next]=fullPlan.source_inventory.slice(104);
  assert.equal(previous.md5,manifest.predecessor105_md5);assert.equal(previous.sha256,manifest.predecessor105_sha256);
  assert.equal(previous.bytes,readFileSync(resolve(root,'supabase/migrations/'+retentionForward)).length);
  assert.equal(fullPlan.pending_successors.at(-4).version,manifest.forward_version);
  assert.equal(fullPlan.pending_successors.at(-4).name,manifest.forward_name);
  for(const key of ['bytes','md5','sha256'])assert.equal(next[key],manifest[key],'W03_UNIT_SOURCE_MISMATCH:'+key);
  for(const [i,entry] of fullPlan.pending_successors.slice(-5).entries())
    assert.equal(entry.md5,fullPlan.source_inventory[104+i].md5,'W03_PENDING_IDENTITY_MISMATCH');
  const successors=fullPlan.pending_successors.slice(0,-4);
  // Transport107, dispatch108 and Agreement109 are admitted and exercised by their
  // dedicated existing domain probes; original W03 predecessor remains exact105.
  return {fullPlan,next:fullPlan.pending_successors.at(-4),deferredSuccessors:fullPlan.pending_successors.slice(-3),manifest,predecessorPlan:{...fullPlan,
    source_migration_count:105,source_inventory:fullPlan.source_inventory.slice(0,105),
    pending_successors:successors,pending_successor_count:successors.length,
    proof_boundary:'SOURCE105_BEFORE_INTENTIONAL_W03_RAW_WRITER_CLOSURE'}};
}
