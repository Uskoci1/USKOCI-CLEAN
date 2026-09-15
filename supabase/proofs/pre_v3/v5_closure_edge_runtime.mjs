// Exact closure worker source. Every transport is supplied explicitly; no ambient IO.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
export function loadClosureWorker(options={}){
 const hashes={};let handler;
 const context=vm.createContext({Request,Response,Headers,URL,TextEncoder,TextDecoder,ReadableStream,AbortController,crypto:webcrypto,
  Date,setTimeout,clearTimeout,fetch:options.fetch??(()=>{throw new Error('NO_DEFAULT_NETWORK');}),Deno:{env:{get:options.env??(()=>undefined)},serve:f=>{handler=f;}},
  console:{log:()=>{throw new Error('CLOSURE_LOGGING_FORBIDDEN');},warn:()=>{throw new Error('CLOSURE_LOGGING_FORBIDDEN');},error:()=>{throw new Error('CLOSURE_LOGGING_FORBIDDEN');}}});
 function load(path,require){const bytes=readFileSync(path);hashes[path]=createHash('sha256').update(bytes).digest('hex');
  const result=ts.transpileModule(bytes.toString(),{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.deepEqual(result.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
  return new vm.Script(`(function(exports,require){${result.outputText}\nreturn exports;})`,{filename:path}).runInContext(context)({},require);}
 const shared=load('supabase/functions/_shared/data-export.ts',()=>{throw new Error('UNKNOWN_CLOSURE_DEPENDENCY');});
 const worker=load('supabase/functions/uskoci-account-closure-worker/closure.ts',name=>{assert.equal(name,'../_shared/data-export.ts');return shared;});
 load('supabase/functions/uskoci-account-closure-worker/index.ts',name=>{if(name==='../_shared/data-export.ts')return shared;if(name==='./closure.ts')return worker;throw new Error('UNKNOWN_CLOSURE_DEPENDENCY');});
 return {worker,handler,sourceHashes:hashes};
}
