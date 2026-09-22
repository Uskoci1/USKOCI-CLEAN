import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {posix} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

/** Exact application adapter, with only transport/session supplied by disposable Auth. */
export function homeClient(client, accountId) {
  const allowed = ['data/homeAttentionClientService', 'data/serverReceipt', 'ui/system/plural'];
  const cache = new Map(), sources = [];
  function load(name) {
    assert.ok(allowed.includes(name), 'HOME_PROOF_UNEXPECTED_MODULE:' + name);
    if (cache.has(name)) return cache.get(name);
    const path = 'src/' + name + '.ts', source = readFileSync(path, 'utf8'), exports = {};
    sources.push({path, sha256: createHash('sha256').update(source).digest('hex')}); cache.set(name, exports);
    const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
    const require = id => {
      const target = posix.normalize(posix.join(posix.dirname(name), id));
      if (target === 'data/supabaseClient') return {supabaseKlijent: () => client};
      if (target === 'store/sesija') return {sesijaSada: () => ({user: {id: accountId}, accountRevision: 1})};
      return load(target);
    };
    vm.runInNewContext(compiled, {exports, require, setTimeout, clearTimeout}, {filename: path, timeout: 1000});
    return exports;
  }
  return {service: load('data/homeAttentionClientService').homeAttentionClientService, sources};
}
