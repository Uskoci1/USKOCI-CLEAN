import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

export const ownedIntakeForward='20260910172132_clean_w03_owned_ai_intake_authority.sql';
export const retentionForward='20260910162955_clean_p3_retention_execution_authority.sql';
export const pushTransportForward='20260910193029_clean_n09_expo_push_transport.sql';
export const dispatchLockForward='20260910214845_clean_dispatch_need_lock_order.sql';
/** Last file of the frozen SQL108 boundary every domain harness reasons about. */
export const historicalBoundaryLast=dispatchLockForward;

/** Exact current source admission (PKG-013 re-baseline). The frozen SQL108 boundary
 * remains the historical view the domain harnesses assert against; the current source
 * is admitted only when its inventory equals the recorded 147-file MD5 manifest byte for
 * byte and every successor after 108 matches supabase/proofs/source147_admission.json
 * by file, md5, sha256 and bytes. Any other count or identity is rejected before any
 * database operation. Nothing here applies a migration or relabels a skipped proof. */
export function admitExactCurrentSource(fullPlan, root=process.cwd()) {
  const manifest=JSON.parse(readFileSync(resolve(root,'supabase/proofs/source147_admission.json'),'utf8'));
  assert.equal(manifest.historical_last_file,historicalBoundaryLast,'CURRENT_SOURCE_MANIFEST_BOUNDARY_MISMATCH');
  assert.equal(fullPlan.source_migration_count,manifest.source_migration_count,'CURRENT_SOURCE_COUNT_NOT_ADMITTED');
  assert.equal(fullPlan.source_inventory.length,manifest.source_migration_count,'CURRENT_SOURCE_INVENTORY_COUNT_MISMATCH');
  assert.equal(fullPlan.pending_successor_count,fullPlan.pending_successors.length);
  const inventoryText=fullPlan.source_inventory.map(entry=>`${entry.md5}  ${entry.file}\n`).join('');
  assert.equal(createHash('sha256').update(inventoryText).digest('hex'),manifest.inventory_sha256,'CURRENT_SOURCE_INVENTORY_CHANGED');
  const manifestText=readFileSync(resolve(root,'supabase/migrations/MD5_MANIFEST.txt'),'utf8').replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(manifestText).digest('hex'),manifest.inventory_sha256,'MD5_MANIFEST_NOT_ADMITTED');
  const after=fullPlan.source_inventory.slice(manifest.historical_boundary_count);
  assert.equal(after.length,manifest.successors_after_108.length,'CURRENT_SOURCE_SUCCESSOR_COUNT_MISMATCH');
  for(const [index,entry] of after.entries()){
    const known=manifest.successors_after_108[index];
    for(const key of ['file','md5','sha256','bytes'])assert.equal(entry[key],known[key],`CURRENT_SOURCE_SUCCESSOR_IDENTITY:${known.file}:${key}`);
    const bytes=readFileSync(resolve(root,'supabase/migrations/'+known.file));
    assert.equal(bytes.length,known.bytes,`CURRENT_SOURCE_SUCCESSOR_BYTES:${known.file}`);
    assert.equal(createHash('md5').update(bytes).digest('hex'),known.md5,`CURRENT_SOURCE_SUCCESSOR_MD5:${known.file}`);
  }
  const admittedSuccessors=fullPlan.pending_successors.filter(entry=>entry.file>historicalBoundaryLast);
  assert.deepEqual(admittedSuccessors.map(entry=>entry.file),after.map(entry=>entry.file),'CURRENT_SOURCE_PENDING_SUCCESSORS_MISMATCH');
  for(const [index,entry] of admittedSuccessors.entries())assert.equal(entry.md5,after[index].md5,'CURRENT_SOURCE_PENDING_IDENTITY_MISMATCH');
  const historicalPending=fullPlan.pending_successors.filter(entry=>entry.file<=historicalBoundaryLast);
  return {currentPlan:fullPlan,admittedSuccessors,manifest,
    historicalPlan:{...fullPlan,source_migration_count:manifest.historical_boundary_count,
      source_inventory:fullPlan.source_inventory.slice(0,manifest.historical_boundary_count),
      pending_successors:historicalPending,pending_successor_count:historicalPending.length,
      proof_boundary:'SOURCE108_HISTORICAL_VIEW_OF_ADMITTED_SOURCE147'}};
}

// Every raw file is admitted by the existing source reader before this exact
// split. Historical direct-writer assertions belong to105; W03 proves106.
// A plan larger than the frozen108 is admitted only through admitExactCurrentSource;
// the historical108 view then goes through the unchanged identity checks below.
export function ownedIntakeSourceBoundary(currentPlan, root=process.cwd()) {
  const admission=currentPlan.source_migration_count===108?null:admitExactCurrentSource(currentPlan,root);
  const fullPlan=admission?admission.historicalPlan:currentPlan;
  const manifest=JSON.parse(readFileSync(resolve(root,'supabase/proofs/ai/owned_intake_files.json'),'utf8'));
  assert.equal(fullPlan.source_migration_count,108,'W03_EXACT_SOURCE108_REQUIRED');
  assert.equal(fullPlan.source_inventory.length,108);
  assert.equal(fullPlan.pending_successor_count,fullPlan.pending_successors.length);
  assert.deepEqual(fullPlan.source_inventory.slice(104).map(x=>x.file),[retentionForward,ownedIntakeForward,pushTransportForward,dispatchLockForward]);
  assert.deepEqual(fullPlan.pending_successors.slice(-4).map(x=>x.file),[retentionForward,ownedIntakeForward,pushTransportForward,dispatchLockForward]);
  assert.equal(manifest.forward_file,ownedIntakeForward);
  assert.equal(manifest.predecessor105_file,retentionForward);
  assert.equal(manifest.expected_predecessor_count,105);assert.equal(manifest.expected_history_count,106);
  const [previous,next]=fullPlan.source_inventory.slice(104);
  assert.equal(previous.md5,manifest.predecessor105_md5);assert.equal(previous.sha256,manifest.predecessor105_sha256);
  assert.equal(previous.bytes,readFileSync(resolve(root,'supabase/migrations/'+retentionForward)).length);
  assert.equal(fullPlan.pending_successors.at(-3).version,manifest.forward_version);
  assert.equal(fullPlan.pending_successors.at(-3).name,manifest.forward_name);
  for(const key of ['bytes','md5','sha256'])assert.equal(next[key],manifest[key],'W03_UNIT_SOURCE_MISMATCH:'+key);
  for(const [i,entry] of fullPlan.pending_successors.slice(-4).entries())
    assert.equal(entry.md5,fullPlan.source_inventory[104+i].md5,'W03_PENDING_IDENTITY_MISMATCH');
  const successors=fullPlan.pending_successors.slice(0,-3);
  // Transport107 and dispatch108 are fully admitted here and exercised by their
  // dedicated existing domain probes; original W03 predecessor remains exact105.
  // Successors 109-147 admitted by identity are listed under currentSourceAdmission;
  // deferredSuccessors keeps the historical108 shape every domain report gate expects.
  return {fullPlan:admission?admission.currentPlan:fullPlan,historicalPlan:fullPlan,
    currentSourceAdmission:admission?{unit:admission.manifest.unit,source_migration_count:admission.currentPlan.source_migration_count,
      successors_after_108:admission.admittedSuccessors.length,successors:admission.admittedSuccessors,inventory_sha256:admission.manifest.inventory_sha256}:null,
    next:fullPlan.pending_successors.at(-3),
    deferredSuccessors:fullPlan.pending_successors.slice(-2),manifest,predecessorPlan:{...fullPlan,
    source_migration_count:105,source_inventory:fullPlan.source_inventory.slice(0,105),
    pending_successors:successors,pending_successor_count:successors.length,
    proof_boundary:'SOURCE105_BEFORE_INTENTIONAL_W03_RAW_WRITER_CLOSURE'}};
}
