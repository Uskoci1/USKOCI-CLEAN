import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {partitionHygieneInventory,assertPrivateHygieneTables} from './hygiene_inventory.mjs';
const applied='20260912091000_clean_pre_v3_safety_authority.sql';
const future='20260912213702_clean_v5_review_acceptance.sql';
const hash=(a,b)=>createHash(a).update(b).digest('hex');
function fixture(names=[applied,future]){
 const candidates=names.map(name=>({file:'supabase/migrations/'+name,bytes:Buffer.from('-- SYNTHETIC BOUNDARY ONLY '+name+'\n')}));
 const provenance=candidates.map(c=>({file:c.file.split('/').at(-1),version:c.file.split('/').at(-1).slice(0,14),
  name:c.file.split('/').at(-1).slice(15,-4),raw_md5:hash('md5',c.bytes),raw_sha256:hash('sha256',c.bytes),raw_bytes:c.bytes.length}));
 return {candidates,provenance,manifest:provenance.map(p=>p.raw_md5+'  '+p.file+'\n').join(''),
  history:[{version:applied.slice(0,14),row_sha256:'a'.repeat(64)},{version:'20260912121100',row_sha256:'b'.repeat(64)}]};
}
test('keeps every future byte verified but maps only actually applied versions to stage123 catalog',()=>{
 const result=partitionHygieneInventory(fixture());assert.deepEqual(result.applied.map(x=>x.file),['supabase/migrations/'+applied]);
 assert.deepEqual(result.future.map(x=>x.file),['supabase/migrations/'+future]);assert.match(result.future[0].sha256,/^[a-f0-9]{64}$/);
});
test('rejects missing or mismatched manifest/provenance instead of silently skipping future candidates',()=>{
 for(const alter of [x=>{x.manifest=x.manifest.split('\n')[0]+'\n';},x=>{x.provenance.pop();},
  x=>{x.candidates[1].bytes=Buffer.from('changed');},x=>{x.provenance[1].raw_sha256='0'.repeat(64);}]){
  const input=fixture();alter(input);assert.throws(()=>partitionHygieneInventory(input));
 }
});
test('rejects an unreviewed V5 future file even when both metadata hashes match',()=>{
 assert.throws(()=>partitionHygieneInventory(fixture([applied,'20260912235959_clean_v5_unapproved.sql'])),/UNADMITTED_CANDIDATE/);
});
test('rejects missing historical candidate, duplicate history and version/name remapping',()=>{
 const missing=fixture();missing.history.shift();assert.throws(()=>partitionHygieneInventory(missing),/MISSING_APPLIED_CANDIDATE/);
 const duplicate=fixture();duplicate.history.push(duplicate.history[0]);assert.throws(()=>partitionHygieneInventory(duplicate),/DUPLICATE_HISTORY_VERSION/);
 for(const field of ['version','name']){const input=fixture();input.provenance[0][field]='wrong';assert.throws(()=>partitionHygieneInventory(input),/MISMATCH/);}
});
test('every explicitly admitted V5 migration still requires manifest, provenance and future chronology',()=>{
 const names=[future,'20260912214126_clean_v5_bounded_ai_test_budget.sql','20260912220506_clean_v5_owned_worker_profile.sql','20260912222338_clean_v5_owner_safety_legal_reads.sql',
  '20260912224647_clean_v5_owned_media.sql','20260912230039_clean_v5_policy_bound_closure.sql',
  '20260912233901_clean_v5_ai_turn_restart_recovery.sql','20260912234201_clean_v5_owned_qa_recovery.sql','20260913000109_clean_v5_approved_qa_limits.sql',
  '20260913000144_clean_v5_qa_classifier_authority.sql','20260913001000_clean_v5_owned_export_projection.sql',
  '20260913002405_clean_v5_group_conversation.sql','20260913002428_clean_v5_agreement_location_snapshot.sql',
  '20260913005720_clean_v5_media_evidence_protection.sql','20260913014627_clean_v5_retention_source_compatibility.sql',
  '20260913022110_clean_v5_worker_turn_restart_recovery.sql','20260913044510_clean_v5_unknown_ai_turn_exit.sql',
  '20260913045824_clean_v5_support_case_authority.sql',
 '20260913065130_clean_v5_agreement_private_photos.sql','20260913080237_clean_v5_self_reported_identity_requirement.sql'];
 const result=partitionHygieneInventory(fixture([applied,...names]));assert.equal(result.future.length,20);assert.equal(result.applied.length,1);
});
test('catalog assertion retains exact applied table membership, RLS and no raw anon/authenticated access',()=>{
 const row={schema:'private',name:'safety_reports',rls:true,anon_data:false,authenticated_data:false};
 assertPrivateHygieneTables([row],new Set(['private.safety_reports']));
 for(const patch of [{rls:false},{anon_data:true},{authenticated_data:true},{schema:'public'},{name:'unrelated'}])
  assert.throws(()=>assertPrivateHygieneTables([{...row,...patch}],new Set(['private.safety_reports'])));
 assert.throws(()=>assertPrivateHygieneTables([],new Set(['private.safety_reports'])));
});
