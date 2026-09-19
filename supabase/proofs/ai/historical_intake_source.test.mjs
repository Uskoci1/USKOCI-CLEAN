import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {historicalIntakeSource} from './historical_intake_source.mjs';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
const options={env:()=>undefined,fetch:()=>assert.fail('NO_NETWORK_IN_BINDING_TEST')};
test('historical executable bytes retain all four original Git blob IDs and SHA256 values',()=>{
 const historical=historicalIntakeSource();assert.equal(historical.binding.sourceCommit,'67cccb15efc003f154ca472793bd2f704f09b2e5');
 assert.equal(Object.keys(historical.binding.files).length,4);
 for(const [path,file] of Object.entries(historical.binding.files)){
  const bytes=historical.read(path);assert.equal(bytes.length,file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),file.gitBlob);
 }
 assert.throws(()=>historical.read('supabase/functions/_shared/unregistered.ts'),/UNADMITTED_HISTORICAL_SOURCE/);
});
test('historical loader executes the real earlier handler, explicitly reports its origin and denies unauthenticated input',async()=>{
 const runtime=loadOwnedIntakeHandler({...options,historicalPre132:true});
 assert.equal(runtime.sourceBinding.kind,'HISTORICAL_PRE132');
 assert.equal(runtime.sourceBinding.sourceCommit,'67cccb15efc003f154ca472793bd2f704f09b2e5');
 const response=await runtime.handler(new Request('https://controlled.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
 assert.equal(response.status,401);
 for(const [path,file] of Object.entries(runtime.sourceBinding.files))assert.equal(runtime.sourceHashes[path],file.sha256);
});
test('default loader still binds current source; latest dispatch authority is never replaced with a historical response',()=>{
 const runtime=loadOwnedIntakeHandler(options);assert.deepEqual(runtime.sourceBinding,{kind:'CURRENT_SOURCE'});
 const path='supabase/functions/uskoci-ai-interview/index.ts',current=readFileSync(path);
 assert.equal(runtime.sourceHashes[path],createHash('sha256').update(current).digest('hex'));
 assert.match(current.toString(),/rpc_ai_dispatch_need_turn_v2_service/);
 assert.doesNotMatch(historicalIntakeSource().read(path).toString(),/rpc_ai_dispatch_need_turn_v2_service/);
 assert.throws(()=>loadOwnedIntakeHandler({...options,historicalPre132:'other'}),/UNADMITTED_SOURCE_BINDING/);
});
