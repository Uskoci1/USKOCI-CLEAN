// Bounded proof-only loader of unchanged production services/controllers. Real
// Supabase IO is supplied by the caller; only native session/storage wiring is substituted.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const allowed=new Set(['src/data/serverReceipt.ts','src/data/needLifecycleClientService.ts',
 'src/data/needLifecycleController.ts','src/data/aiNeedV2Production.ts','src/contracts/needFactsV2.ts',
 'src/lib/market.ts','src/lib/location.ts','src/lib/capabilityTerms.ts',
 'src/data/accountClosureClientService.ts','src/data/reviewsClientService.ts','src/data/agreementClientService.ts','src/data/legacyRpcFailure.ts','src/data/calendarErrors.ts',
 'src/lib/calendarTime.ts','src/data/needDetailPresentation.ts','src/ui/calendar/calendarPresentation.ts']);
export function loadPreV3Clients({client,session,sourceSha}) {
 assert.equal(typeof client,'function');assert.equal(typeof session,'function');
 assert.match(sourceSha,/^[a-f0-9]{40}$/);
 const cache=new Map(),sourceHashes={};
 const context=vm.createContext({Request,Response,Headers,URL,URLSearchParams,Intl,TextEncoder,TextDecoder,
  ReadableStream,AbortController,Date,setTimeout,clearTimeout,console:{error:()=>assert.fail('UNEXPECTED_CLIENT_LOG')}});
 function load(path) {
  if(path==='src/data/supabaseClient.ts')return {supabaseKlijent:client};
  if(path==='src/store/sesija.ts')return {sesijaSada:session};
  assert.ok(allowed.has(path),'UNDECLARED_CLIENT_SOURCE:'+path);
  if(cache.has(path))return cache.get(path);
  const bytes=readFileSync(resolve(root,path));
  assert.deepEqual(bytes,execFileSync('git',['show',sourceSha+':'+path],{cwd:root}),'EXACT_CLIENT_SOURCE:'+path);
  sourceHashes[path]=createHash('sha256').update(bytes).digest('hex');
  const compiled=ts.transpileModule(bytes.toString(),{fileName:path,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.deepEqual(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
  const exports={};cache.set(path,exports);
  const require=name=>{assert.ok(name.startsWith('.'),'NO_EXTERNAL_RUNTIME_IMPORT');
   const resolved=relative(root,resolve(root,dirname(path),name+(name.endsWith('.ts')?'':'.ts')));
   return load(resolved);};
  new vm.Script(`(function(exports,require){${compiled.outputText}\n})`,{filename:path}).runInContext(context)(exports,require);
  return exports;
 }
 return {load,sourceHashes};
}
