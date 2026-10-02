// Missing historical predecessor only. Loopback; reuses the existing D12 gate/variant rules.
// Does not widen the single-target install's exact eight body pins or run the D12 test suite.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
for(const key of ['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS'])assert.ok(!process.env[key],'UNEXPECTED_PG_OVERRIDE');
assert.equal(process.env.PUSH_SINGLE_TARGET_DISPOSABLE,'SINGLE_TARGET_V1');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),process.env.GITHUB_SHA);
const rt=await import(pathToFileURL(resolve('supabase/proofs/pre_v3/closure_runtime.mjs')));
const pins=await import(pathToFileURL(resolve('supabase/proofs/d12/d12_pins.mjs')));
const {sanitizeMessage}=await import(pathToFileURL(resolve('supabase/proofs/ex05_s01/lib/runner.mjs')));
assert.equal(process.env.DB_URL,process.env.RU5_DEVICE_DB_URL);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={unit:'PUSH_SINGLE_TARGET_D12_PREDECESSOR',sourceSha:process.env.GITHUB_SHA,result:'RUNNING',disposableOnly:true,liveAccess:false,providerCalled:false,sources:{}};
const read=path=>{const bytes=readFileSync(path);assert.deepEqual(bytes,execFileSync('git',['show',process.env.GITHUB_SHA+':'+path]));report.sources[path]=sha(bytes);return bytes.toString('utf8');};
try {
 read('supabase/proofs/d12/d12_pins.mjs');read('supabase/proofs/push_single_target/prepare-d12.mjs');
 const data=pins.loadPins(read('supabase/proofs/d12/d12_pins.json'));
 const observed=JSON.parse(rt.sql(pins.chainReadSql(data,rt.q)));
 const gate=pins.classifyPins(data,observed),evaluation=pins.evaluatePinGate(gate);
 report.gate={...evaluation,differences:pins.listAllPinDifferences(gate,evaluation)};
 assert.equal(evaluation.ok,true,'D12_EXISTING_GATE_REFUSED: '+evaluation.failures.join(';'));
 const variants={};
 for(const [name,path,requireFound] of [
  ['pre','supabase/proofs/d12/d12_preflight.readonly.sql',true],
  ['application','supabase/candidates/d12_review_comment.sql',true],
  ['post','supabase/proofs/d12/d12_postflight.readonly.sql',false]]) {
  const original=read(path),v=pins.buildChainVariant(original,gate,{requireFound});
  assert.ok(pins.variantDiffersOnlyAtPins(original,v.text,v.applied),'D12_VARIANT_OUTSIDE_EXISTING_PIN_RULES');
  variants[name]=v.text;(report.variants??={})[name]={sha256:sha(v.text),sameBytes:v.text===original,replaced:v.applied.filter(x=>x.replaced)};
 }
 const pre=JSON.parse(rt.sql(variants.pre));assert.deepEqual(pre.problems,[]);assert.equal(pre.ready,true);assert.equal(pre.erasureBindingMatches,true);assert.equal(pre.closureExecutionsExecuting,0);
 rt.sql(variants.application);
 const post=JSON.parse(rt.sql(variants.post));assert.deepEqual(post.problems,[]);assert.equal(post.ready,true);assert.equal(post.erasureBindingMatches,true);
 // Explicit narrow postcondition for the failed gate. Original installer rechecks all eight pins next.
 assert.equal(rt.sql("select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)'::regprocedure"),'3891fe77d38af04e06cfe4c9e4abb96f');
 report.result='PASS';
}catch(error){report.result='FAIL';report.failure=sanitizeMessage(error);process.exitCode=1;console.error(report.failure);}
finally{writeFileSync(resolve(rt.out,'single-target-d12-predecessor.json'),JSON.stringify(report,null,2)+'\n');console.log(report.result+' D12 predecessor');}
