// Source harness executes the actual bounded proof loader without starting its
// disposable SQL scenario. Network remains denied unless a test supplies it.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
const proof=readFileSync('supabase/proofs/pre_v3/provider_boundaries_proof.mjs','utf8');
const begin=proof.indexOf(' function loadEdge('),end=proof.indexOf('\n const locationEdge=',begin);
assert.ok(begin>0&&end>begin);
const loaderSource=proof.slice(begin,end);
function fixture({sourceRead=readFileSync}={}){
 const hashes={},calls=[],envReads=[],Clock=Date,sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 let captured;
 const boundedVm={...vm,createContext:value=>{captured=vm.createContext(value);return captured;}};
 const context={assert,vm:boundedVm,ts,readFileSync:sourceRead,execFileSync,createHash,webcrypto,btoa,sha,hashes,calls,envReads,Clock,
  Request,Response,Headers,URL,URLSearchParams,Intl,TextEncoder,TextDecoder,ReadableStream,AbortController,setTimeout,clearTimeout,
  upstreamOrigin:'https://pre-v3-proof.supabase.co',env:{RU5_DEVICE_ANON_KEY:'SYNTHETIC_ANON'},
  fetch:()=>assert.fail('UNEXPECTED_NETWORK'),json:(x,status=200)=>new Response(JSON.stringify(x),{status}),providerMode:'ok',providerCalls:0};
 const load=new Function(...Object.keys(context),loaderSource+'\nreturn loadEdge;')(...Object.values(context));
 return {load,hashes,calls,captured:()=>captured};
}
test('actual publication proof loader admits only exact checked budget source and handles missing auth',async()=>{
 const f=fixture(),handler=f.load('supabase/functions/uskoci-publication-evaluate/index.ts');
 const response=await handler(new Request('https://controlled.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
 assert.equal(response.status,401);assert.deepEqual(f.calls,[]);
 assert.deepEqual(Object.keys(f.hashes).sort(),['supabase/functions/_shared/aiTestBudget.ts','supabase/functions/uskoci-publication-evaluate/index.ts']);
 for(const [file,hash] of Object.entries(f.hashes))assert.equal(hash,createHash('sha256').update(readFileSync(file)).digest('hex'));
});
test('actual location loader remains independent and makes no unauthorized provider request',async()=>{
 const f=fixture(),handler=f.load('supabase/functions/uskoci-location-search/index.ts',true);
 const response=await handler(new Request('https://controlled.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
 assert.equal(response.status,401);assert.deepEqual(f.calls,[]);assert.equal(Object.keys(f.hashes).length,1);
});
test('changed shared bytes fail exact saved-source binding before handler execution',()=>{
 const f=fixture({sourceRead:path=>path.endsWith('/aiTestBudget.ts')?Buffer.from('exports.replaced=true'):readFileSync(path)});
 assert.throws(()=>f.load('supabase/functions/uskoci-publication-evaluate/index.ts'));
});
test('unregistered imports in either loader are rejected',()=>{
 const f=fixture();f.load('supabase/functions/uskoci-publication-evaluate/index.ts');
 assert.throws(()=>f.captured().require('../_shared/unregistered.ts'),/UNADMITTED_PUBLICATION_IMPORT/);
 f.load('supabase/functions/uskoci-location-search/index.ts',true);
 assert.throws(()=>f.captured().require('../_shared/aiTestBudget.ts'),/UNDECLARED_LOCATION_IMPORT/);
});
