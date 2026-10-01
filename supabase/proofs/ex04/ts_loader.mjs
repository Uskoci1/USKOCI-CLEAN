import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {posix} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

/**
 * Loads the REAL application modules (plain TypeScript, no React Native) under a transpile-only VM, so a disposable proof runs the same code
 * the app runs: only the transport (`data/supabaseClient`) and the session (`store/sesija`) are supplied. Every loaded file is hashed into
 * `sources`, so a report says exactly which bytes were exercised. A module that is not plain TypeScript fails loudly.
 */
export function loadModules({client, accountId, accountRevision = 1}) {
  const cache = new Map(), sources = [];
  const stubs = {
    'data/supabaseClient': () => ({supabaseKlijent: () => client}),
    'store/sesija': () => ({sesijaSada: () => ({user: {id: accountId}, accountRevision})}),
  };
  function resolve(name) {
    for (const suffix of ['.ts', '/index.ts']) if (existsSync('src/' + name + suffix)) return 'src/' + name + suffix;
    throw new Error('TS_LOADER_UNRESOLVED:' + name);
  }
  function load(name) {
    if (stubs[name]) {
      if (!cache.has(name)) cache.set(name, stubs[name]());
      return cache.get(name);
    }
    if (cache.has(name)) return cache.get(name);
    const path = resolve(name), source = readFileSync(path, 'utf8'), exports = {};
    sources.push({path, sha256: createHash('sha256').update(source).digest('hex')});
    cache.set(name, exports);
    const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
    const require = id => {
      assert.ok(id.startsWith('.'), 'TS_LOADER_EXTERNAL_MODULE:' + id + ' (in ' + name + ')');
      return load(posix.normalize(posix.join(posix.dirname(name), id)));
    };
    vm.runInNewContext(compiled, {exports, require, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, console, Intl, Date, Math, JSON, Number, String, Array, Object, Map, Set, Error, Symbol, Promise},
      {filename: path, timeout: 5000});
    return exports;
  }
  return {load, sources};
}
