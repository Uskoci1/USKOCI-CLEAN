'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { collect } = require('./prepare-v5-edge-payloads.cjs');
const entry = 'supabase/functions/uskoci-test/index.ts';
const fixture = files => name => Object.hasOwn(files, name) ? Buffer.from(files[name]) : undefined;

test('includes nested source and type dependencies without executing module bodies', () => {
  const graph = collect(entry, fixture({ [entry]: "import { x } from '../_shared/a.ts'; throw new Error('MUST_NOT_EXECUTE');",
    'supabase/functions/_shared/a.ts': "export { x } from '../../../src/contracts/b.ts';",
    'src/contracts/b.ts': "import type { Y } from './c'; export const x = 1;",
    'src/contracts/c.ts': 'export type Y = string;' }));
  assert.equal(graph.files.length, 4);
  assert.equal(graph.externalDependencies.length, 0);
  assert.ok(graph.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
});
test('denies missing dependencies, root escape and extensionless runtime imports', () => {
  for (const text of ["import './missing.ts';", "import '../../../../secret.ts';", "import './missing';"]) {
    assert.throws(() => collect(entry, fixture({ [entry]: text })));
  }
});
test('denies unreviewed registry/URL imports and nonliteral module loading', () => {
  for (const text of ["import 'npm:anything@1';", "import 'https://example.test/a.ts';", 'import(input);', "require('./a.ts');"])
    assert.throws(() => collect(entry, fixture({ [entry]: text })));
});
test('records exact pinned npm module and its WASM asset separately, without fetching', () => {
  const graph = collect(entry, fixture({ [entry]: "import * as m from 'npm:@imagemagick/magick-wasm@0.0.43'; import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.43/magick.wasm');" }));
  assert.equal(graph.files.length, 1);
  assert.deepEqual(graph.externalDependencies.map(x => x.kind), ['module', 'runtime-asset']);
});
test('handles cyclic imports once and rejects malformed source', () => {
  const graph = collect(entry, fixture({ [entry]: "import './a.ts';", 'supabase/functions/uskoci-test/a.ts': "import './index.ts';" }));
  assert.equal(graph.files.length, 2);
  assert.throws(() => collect(entry, fixture({ [entry]: 'import {' })), /INVALID_SOURCE/);
});
test('rejects local and computed filesystem assets instead of silently omitting them', () => {
  for (const text of ["Deno.readFile('./asset.wasm');", "Deno.readTextFile(new URL('./asset.txt', import.meta.url));", 'Deno.readFile(path);'])
    assert.throws(() => collect(entry, fixture({ [entry]: text })), /UNREVIEWED_FILE_ASSET/);
  assert.doesNotThrow(() => collect(entry, fixture({ [entry]: "Deno.readFile(new URL(import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.43/magick.wasm')));" })));
});
test('rejects computed and aliased filesystem readers that hide their asset argument', () => {
  for (const text of ["Deno['readFile']('./asset.wasm');", "const read = Deno.readFile; read('./asset.wasm');", "const { readFile } = Deno; readFile('./asset.wasm');"])
    assert.throws(() => collect(entry, fixture({ [entry]: text })), /UNREVIEWED_/);
});
