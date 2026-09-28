// Reuse the frozen Round45 HTTP proof with only the candidate stack changed.
// Exact source/blob binding; no new public app surface or network destination.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const originalPath='supabase/proofs/discovery/p6_http_boundary.mjs';
const ownPath='supabase/proofs/discovery/p6_http_latest.mjs';
const generatedPath=resolve('supabase/proofs/discovery/.p6_http_latest.generated.mjs');
const out='/tmp/p6-discovery-evidence';
const deltas=['supabase/candidates/p6_discovery_cost_v2.sql','supabase/candidates/p6_discovery_cost_v3.sql'];
assert.equal(process.env.CI,'1');assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.P6_PUBLIC_ARTIFACT_DIR,out);
const original=readFileSync(originalPath);
const blob=createHash('sha1').update('blob '+original.length+'\0').update(original).digest('hex');
assert.equal(blob,'8d656afcad18257e372edd95f32c7f43451c8e37','ROUND45_HTTP_SOURCE_DRIFT');
let source=original.toString('utf8');
function once(old,replacement){assert.equal(source.split(old).length,2,'HTTP_SOURCE_ANCHOR_DRIFT');source=source.replace(old,replacement);}
once('const sources=[candidate,','const sources=[candidate,'+JSON.stringify(ownPath)+','+deltas.map(x=>JSON.stringify(x)).join(',')+',');
once('.github/workflows/p6-http-boundary-proof.yml','.github/workflows/p6-cost-latest-proof.yml');
once("${readFileSync(candidate,'utf8')}\\ncommit;","${readFileSync(candidate,'utf8')}\\n"+deltas.map(x=>"${readFileSync('"+x+"','utf8')}").join('\\n')+'\\ncommit;');
assert.equal(source.split('P6_REAL_AUTH_POSTGREST_WIRE').length,3);
source=source.replaceAll('P6_REAL_AUTH_POSTGREST_WIRE','P6_REAL_AUTH_POSTGREST_COST_V3');
const generatedSha256=createHash('sha256').update(source).digest('hex');
function bindReceipt(receipt){
 return {...receipt,reusedHarnessBlob:blob,generatedHarnessSha256:generatedSha256,
   executedHarness:'exact frozen Round45 with source-bound additive candidate stack only',
   candidateStack:['supabase/candidates/p6_discovery_all.sql',...deltas]};
}
// Exercise the same receipt serializer in admission as in the actual proof.
// A syntax-only check does not detect an undefined metadata identifier.
const admission=JSON.parse(JSON.stringify(bindReceipt({result:'NOT_RUN'})));
assert.equal(admission.generatedHarnessSha256,generatedSha256);
assert.equal(admission.reusedHarnessBlob,blob);
assert.equal(admission.result,'NOT_RUN');
assert.deepEqual(admission.candidateStack,['supabase/candidates/p6_discovery_all.sql',...deltas]);
let created=false;
try{
 writeFileSync(generatedPath,source,{flag:'wx',mode:0o600});created=true;
 const syntax=spawnSync(process.execPath,['--check',generatedPath],{encoding:'utf8',timeout:10000});
 assert.equal(syntax.status,0,'GENERATED_HTTP_SYNTAX');
 if(process.argv[2]==='--verify-source'){
  console.log('PASS P6_HTTP_SOURCE_ADMISSION '+generatedSha256);
 }else{
  assert.equal(process.argv.length,2,'HTTP_PROOF_NO_EXTRA_ARGS');
  const run=spawnSync(process.execPath,[generatedPath],{stdio:'inherit',timeout:180000});
  const originalReceipt=out+'/p6-http-boundary-receipt.json';
  if(existsSync(originalReceipt)){
   const receipt=JSON.parse(readFileSync(originalReceipt,'utf8'));
   writeFileSync(out+'/p6-http-latest-receipt.json',JSON.stringify(bindReceipt(receipt),null,2)+'\n');
  }
  assert.equal(run.status,0,'OPTIMIZED_HTTP_PROOF_REFUSED');
  const r=JSON.parse(readFileSync(out+'/p6-http-latest-receipt.json','utf8'));
  for(const key of ['actualAuth','postgrestProven','clientWireProven','localCandidateRemoved'])assert.equal(r[key],true,key);
  assert.equal(r.result,'PASS');assert.equal(r.checks.length,11);assert(r.checks.every(x=>x.result==='PASS'));
  assert.equal(r.liveAccess,false);assert.equal(r.authenticatedAccounts,3);
  console.log('PASS P6_OPTIMIZED_HTTP_REFRESH');
 }
}finally{if(created)unlinkSync(generatedPath);}
