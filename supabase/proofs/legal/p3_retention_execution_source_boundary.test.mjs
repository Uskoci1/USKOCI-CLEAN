import assert from 'node:assert/strict';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve,sep} from 'node:path';
import {test} from 'node:test';
import {readP3RetentionPredecessorPlan} from './p3_retention_schedule_predecessor.mjs';
import {retentionExecutionBoundary,retentionExecutionForward} from './p3_retention_execution_source_boundary.mjs';

test('exact full source105 is admitted before unchanged original registry assertions at104',()=>{
  const plan=readP3RetentionPredecessorPlan(),boundary=retentionExecutionBoundary(plan);
  assert.equal(plan.source_migration_count,105);
  assert.deepEqual(boundary.fullPlan,plan);
  assert.equal(boundary.predecessorPlan.source_migration_count,104);
  assert.equal(boundary.predecessorPlan.source_inventory.length,104);
  assert.deepEqual([...boundary.predecessorPlan.pending_successors,boundary.next],plan.pending_successors);
  assert.equal(boundary.next.file,retentionExecutionForward);
  assert.equal(boundary.predecessorPlan.source_inventory.at(-1).file,'20260910153005_clean_p2_export_delivery_authority.sql');
});

test('missing, extra, unknown, reordered or altered suffix identities fail before registry replay',()=>{
  const plan=readP3RetentionPredecessorPlan();
  for(const count of [103,104,106])assert.throws(()=>retentionExecutionBoundary({...plan,source_migration_count:count}));
  for(const field of ['pending_successors','source_inventory']){
    const changed=structuredClone(plan);changed[field].at(-1).file='20260910162956_unknown.sql';
    assert.throws(()=>retentionExecutionBoundary(changed));
    const reordered=structuredClone(plan);reordered[field].splice(-2,2,...reordered[field].slice(-2).reverse());
    assert.throws(()=>retentionExecutionBoundary(reordered));
  }
  for(const index of [-2,-1])for(const field of ['md5']){
    const changed=structuredClone(plan);changed.pending_successors.at(index)[field]='changed';
    assert.throws(()=>retentionExecutionBoundary(changed));
  }
});

for(const mutation of ['missing','changed','unknown'])test('full admission rejects '+mutation+' SQL105 before any original registry write',()=>{
  const root=mkdtempSync(join(tmpdir(),'p3-execution-admission-'));
  assert.ok(root.startsWith(resolve(tmpdir())+sep)&&basename(root).startsWith('p3-execution-admission-'));
  try{
    const predecessor='supabase/proofs/legal/p3_retention_schedule_predecessor_files.json';
    const admitted=JSON.parse(readFileSync(predecessor,'utf8'));
    const paths=[predecessor,'supabase/proofs/legal/p3_retention_schedule_files.json',
      admitted.d03.manifest,admitted.ai_draft.manifest,'supabase/migrations/MIGRATION_PROVENANCE.json',
      ...readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).map(x=>'supabase/migrations/'+x)];
    for(const path of paths){const target=join(root,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(path,target);}
    assert.equal(retentionExecutionBoundary(readP3RetentionPredecessorPlan(root)).fullPlan.source_migration_count,105);
    const target=join(root,'supabase/migrations',retentionExecutionForward);
    if(mutation==='missing')rmSync(target);
    if(mutation==='changed')writeFileSync(target,'-- altered SQL105 bytes\n');
    if(mutation==='unknown')renameSync(target,join(dirname(target),'20260910162956_unknown.sql'));
    assert.throws(()=>retentionExecutionBoundary(readP3RetentionPredecessorPlan(root)),/SOURCE_PROVENANCE_INVENTORY_MISMATCH|PENDING_MD5_CHANGED/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
