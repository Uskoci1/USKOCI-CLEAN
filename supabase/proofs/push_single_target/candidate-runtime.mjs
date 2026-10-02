// Actual scratch candidate Edge, following the existing n09 VM runtime. Every IO path is injected.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
const require = createRequire(resolve(process.cwd(),'package.json'));
const ts = require('typescript');
const {notificationPushCopy} = await import(pathToFileURL(resolve(process.cwd(),'supabase/functions/_shared/pushNotificationCopy.mjs')));
export function loadCandidate({env,fetch}) {
 assert.equal(typeof env,'function'); assert.equal(typeof fetch,'function'); let handler;
 const source=readFileSync(new URL('./supabase/functions/uskoci-push-transport/index.ts',import.meta.url));
 const compiled=ts.transpileModule(source.toString('utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const context=vm.createContext({exports:{},require:specifier=>{if(specifier==='../_shared/pushNotificationCopy.mjs')return {notificationPushCopy};throw Error('UNEXPECTED_REQUIRE');},
  Request,Response,Headers,URL,TextEncoder,TextDecoder,ReadableStream,AbortController,Date,setTimeout,clearTimeout,fetch,
  console:{log:()=>assert.fail('PUSH_LOG_FORBIDDEN'),warn:()=>assert.fail('PUSH_LOG_FORBIDDEN'),error:()=>assert.fail('PUSH_LOG_FORBIDDEN')},
  Deno:{env:{get:env},serve:value=>{handler=value;}}});
 new vm.Script(compiled).runInContext(context); assert.equal(typeof handler,'function');
 return {handler,sha256:createHash('sha256').update(source).digest('hex')};
}
