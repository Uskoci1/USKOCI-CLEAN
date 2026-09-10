// Actual single-file Edge handler. All network IO is supplied by the proof.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
export function loadPushHandler({env,fetch}) {
 assert.equal(typeof env,'function');assert.equal(typeof fetch,'function');let handler;
 const source=readFileSync(new URL('../../functions/uskoci-push-transport/index.ts',import.meta.url));
 const code=ts.transpileModule(source.toString('utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const context=vm.createContext({exports:{},Request,Response,Headers,URL,TextEncoder,TextDecoder,ReadableStream,AbortController,Date,setTimeout,clearTimeout,fetch,
  console:{log:()=>assert.fail('PUSH_LOG_FORBIDDEN'),error:()=>assert.fail('PUSH_LOG_FORBIDDEN'),warn:()=>assert.fail('PUSH_LOG_FORBIDDEN')},Deno:{env:{get:env},serve:value=>handler=value}});
 new vm.Script(code).runInContext(context);assert.equal(typeof handler,'function');
 return {handler,sha256:createHash('sha256').update(source).digest('hex')};
}
