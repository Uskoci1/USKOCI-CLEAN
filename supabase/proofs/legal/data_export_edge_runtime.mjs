// Executes exact current Edge modules. Callers supply either explicitly synthetic
// transports or the existing loopback-only disposable transport. No default IO.
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const common='supabase/functions/_shared/data-export.ts';
export function loadExportHandler(kind,options) {
  assert.ok(['worker','download'].includes(kind));assert.equal(typeof options.fetch,'function');assert.equal(typeof options.env,'function');
  const entry=`supabase/functions/uskoci-data-export-${kind}/index.ts`,sourceHashes={};let handler;
  const context=vm.createContext({Request,Response,Headers,URL,TextEncoder,TextDecoder,ReadableStream,AbortController,crypto:webcrypto,
    Date:options.Date??Date,setTimeout:options.setTimeout??setTimeout,clearTimeout:options.clearTimeout??clearTimeout,
    fetch:options.fetch,console:{log:()=>{throw new Error('EXPORT_LOGGING_FORBIDDEN');},warn:()=>{throw new Error('EXPORT_LOGGING_FORBIDDEN');},error:()=>{throw new Error('EXPORT_LOGGING_FORBIDDEN');}},
    Deno:{env:{get:options.env},serve:value=>{assert.equal(handler,undefined);handler=value;}}});
  function module(path,require) {
    const bytes=readFileSync(resolve(root,path));sourceHashes[path]=createHash('sha256').update(bytes).digest('hex');
    const compiled=ts.transpileModule(bytes.toString('utf8'),{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
    assert.deepEqual(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error),[]);
    const run=new vm.Script(`(function(exports,require){${compiled.outputText}\nreturn exports;})`,{filename:path}).runInContext(context);
    return run({},require);
  }
  const shared=module(common,()=>{throw new Error('UNDECLARED_EXPORT_DEPENDENCY');});
  module(entry,name=>{assert.equal(name,'../_shared/data-export.ts');return shared;});
  assert.equal(typeof handler,'function');return {handler,sourceHashes};
}
