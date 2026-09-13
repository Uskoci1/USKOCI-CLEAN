// Exact current handler under supplied synthetic or loopback-only transport.
// No default fetch or credentials; this is not a deployed gateway proof.
import assert from 'node:assert/strict';import vm from 'node:vm';import ts from 'typescript';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
export function loadQaClassifierHandler(options){
 let handler;const sourceHashes={};
 const context=vm.createContext({Request,Response,Headers,URL,TextEncoder,TextDecoder,ReadableStream,AbortController,Date,console:{error:()=>assert.fail('NO_RAW_LOGGING')},
  setTimeout:options.setTimeout??setTimeout,clearTimeout:options.clearTimeout??clearTimeout,fetch:options.fetch,
  Deno:{env:{get:options.env},serve:fn=>{handler=fn;}}});
 function evaluate(file,imports={}){const bytes=readFileSync(file);sourceHashes[file]=createHash('sha256').update(bytes).digest('hex');
  const compiled=ts.transpileModule(bytes.toString('utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.deepEqual(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
  return new vm.Script(`(function(exports,require){${compiled.outputText};return exports;})`,{filename:file}).runInContext(context)({},name=>{assert.ok(Object.hasOwn(imports,name),'UNKNOWN_IMPORT');return imports[name];});}
 const contract=evaluate('src/contracts/qaSubmission.ts'),budget=evaluate('supabase/functions/_shared/aiTestBudget.ts'),hash=evaluate('src/lib/qaTextHash.ts');
 evaluate('supabase/functions/uskoci-qa-classify/index.ts',{'../../../src/contracts/qaSubmission.ts':contract,'../_shared/aiTestBudget.ts':budget,'../../../src/lib/qaTextHash.ts':hash});
 assert.equal(typeof handler,'function');return{handler,sourceHashes};
}
