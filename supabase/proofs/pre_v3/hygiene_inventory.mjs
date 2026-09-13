// Bounded source admission for the stage123 read-only catalog proof. Future
// migrations remain byte-verified candidates; their catalog proof follows apply.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const v5Candidates=new Set([
 '20260912213702_clean_v5_review_acceptance.sql',
 '20260912214126_clean_v5_bounded_ai_test_budget.sql',
 '20260912220506_clean_v5_owned_worker_profile.sql',
 '20260912222338_clean_v5_owner_safety_legal_reads.sql',
 '20260912224647_clean_v5_owned_media.sql',
 '20260912230039_clean_v5_policy_bound_closure.sql',
 '20260912233901_clean_v5_ai_turn_restart_recovery.sql',
 '20260912234201_clean_v5_owned_qa_recovery.sql',
 '20260913000109_clean_v5_approved_qa_limits.sql',
 '20260913000144_clean_v5_qa_classifier_authority.sql',
 '20260913001000_clean_v5_owned_export_projection.sql',
]);
const digest=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
export function partitionHygieneInventory({candidates,manifest,provenance,history}){
 assert.ok(Array.isArray(candidates)&&Array.isArray(provenance)&&Array.isArray(history)&&history.length>0);
 const known=new Map();
 for(const line of manifest.trim().split('\n')){
  const match=/^([a-f0-9]{32})  ([a-zA-Z0-9_.]+[.]sql)$/.exec(line);
  assert.ok(match,'INVALID_MANIFEST_LINE');assert.ok(!known.has(match[2]),'DUPLICATE_MANIFEST_FILE');known.set(match[2],match[1]);
 }
 const versions=new Set();
 for(const item of history){
  assert.match(item.version,/^[0-9]{14}$/);assert.match(item.row_sha256,/^[a-f0-9]{64}$/);
  assert.ok(!versions.has(item.version),'DUPLICATE_HISTORY_VERSION');versions.add(item.version);
 }
 const high=[...versions].sort().at(-1),seen=new Set(),applied=[],future=[];
 for(const candidate of candidates){
  assert.ok(candidate.file.startsWith('supabase/migrations/'),'OUT_OF_SCOPE_MIGRATION');
  const name=candidate.file.slice('supabase/migrations/'.length);
  assert.ok(/^20260912[0-9]{6}_clean_pre_v3_[a-z0-9_]+[.]sql$/.test(name)||v5Candidates.has(name),'UNADMITTED_CANDIDATE:'+name);
  assert.ok(!seen.has(name),'DUPLICATE_CANDIDATE');seen.add(name);
  assert.equal(known.get(name),digest('md5',candidate.bytes),'CANDIDATE_MANIFEST_MISMATCH:'+name);
  const entries=provenance.filter(entry=>entry.file===name);assert.equal(entries.length,1,'CANDIDATE_PROVENANCE_MISSING_OR_DUPLICATE:'+name);
  const entry=entries[0],version=name.slice(0,14);
  assert.equal(entry.version,version,'CANDIDATE_VERSION_MISMATCH');assert.equal(entry.name,name.slice(15,-4),'CANDIDATE_NAME_MISMATCH');
  assert.equal(entry.raw_md5,known.get(name));assert.equal(entry.raw_sha256,digest('sha256',candidate.bytes));assert.equal(entry.raw_bytes,candidate.bytes.length);
  const item={...candidate,version,sha256:entry.raw_sha256};
  if(versions.has(version))applied.push(item);
  else {assert.ok(version>high,'MISSING_APPLIED_CANDIDATE:'+name);future.push(item);}
 }
 return {applied,future};
}

export function assertPrivateHygieneTables(catalog,expectedNames){
 assert.deepEqual(catalog.map(row=>row.schema+'.'+row.name).sort(),[...expectedNames].sort(),'MISSING_OR_UNEXPECTED_TOUCHED_TABLE');
 for(const table of catalog){
  assert.equal(table.schema,'private');assert.equal(table.rls,true,'RLS:'+table.name);
  assert.equal(table.anon_data,false,'ANON_DATA:'+table.name);assert.equal(table.authenticated_data,false,'RAW_CLIENT_DATA:'+table.name);
 }
}
