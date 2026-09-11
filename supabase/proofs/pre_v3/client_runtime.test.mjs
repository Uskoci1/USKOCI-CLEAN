import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {loadPreV3Clients} from './client_runtime.mjs';
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
function runtime(){let calls=0;const r=loadPreV3Clients({sourceSha,session:()=>({user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},accountRevision:1}),
 client:()=>({rpc:()=>{calls++;throw new Error('NO_RPC_EXPECTED');}})});return {r,calls:()=>calls};}
test('bounded client loader reads current committed service graph, rejects undeclared modules',async()=>{
 const {r,calls}=runtime();const ai=r.load('src/data/aiNeedV2Production.ts').aiNeedV2Production;
 const result=await ai.openConversation('not-a-request-id');assert.equal(result.ok,false);assert.equal(result.kod,'CLIENT_REQUEST_ID_INVALID');assert.equal(calls(),0);
 assert.ok(r.sourceHashes['src/contracts/needFactsV2.ts']);assert.ok(r.sourceHashes['src/lib/location.ts']);
 assert.throws(()=>r.load('src/app/(app)/nova.tsx'),/UNDECLARED_CLIENT_SOURCE/);
});
test('real lifecycle controller and service share the bounded native session substitute',async()=>{
 const {r,calls}=runtime();const c=r.load('src/data/needLifecycleController.ts').createNeedLifecycleController({
 account:{accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',accountRevision:1},
 command:{action:'DELETE_DRAFT',needId:'invalid',expectedRevision:1,reason:''},refreshOwnedNeeds:async()=>{throw new Error('NO_REFRESH_EXPECTED');}});
 assert.equal(c.snapshot().phase,'REJECTED');await c.submit();assert.equal(calls(),0);
 assert.ok(r.sourceHashes['src/data/needLifecycleClientService.ts']);assert.ok(r.sourceHashes['src/data/serverReceipt.ts']);
});

test('saved Agreement seam loads exact safe mapper and rejects undeclared external writes',async()=>{
 const {r,calls}=runtime();const changes=r.load('src/data/agreementClientService.ts').agreementChangeService;
 const result=await changes.withdraw('invalid',{accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',accountRevision:1});
 assert.equal(result.ok,false);assert.equal(calls(),0);assert.ok(r.sourceHashes['src/data/legacyRpcFailure.ts']);
 assert.ok(r.sourceHashes['src/lib/calendarTime.ts']);
});
