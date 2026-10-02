// EX05-S01 offline STATIC checks of the proof sources. There is no local Postgres on the authoring machine, so everything that can be checked without a database is checked here:
//   * the import graph resolves, and every name taken from the proof runtime (closure_runtime.mjs) is really exported by it;
//   * every check name is unique, upper-case, and every `requires` names a check declared EARLIER in the same file (a typo would silently skip a whole section otherwise);
//   * no proof changes a function body or the schema: no CREATE OR REPLACE FUNCTION, ALTER FUNCTION/TABLE, DROP TABLE, GRANT/REVOKE, apply_migration or migration-history write (the only
//     DDL allowed is the temporary fault trigger of the text proof, created and dropped by lib/sql_snippets.mjs);
//   * SQLSTATE 40001 appears in a proof only as a NEGATIVE assertion (doesNotMatch) or in prose; conflicts are asserted as PT409;
//   * every source file a proof imports from this package (and the shared fixtures it relies on) is listed in its SOURCES, so the exact-commit binding covers it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {dirname, resolve, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '..');
const root = resolve(here, '../../../..');
const proofFiles = readdirSync(pkg).filter(name => /^ex05_s01_.*_proof\.mjs$/.test(name)).sort();
const text = name => readFileSync(resolve(pkg, name), 'utf8');
const stripComments = source => source.split(/\r?\n/).map(line => line.replace(/^\s*\/\/.*$/, '')).join('\n');

function runtimeExports() {
  const source = readFileSync(resolve(root, 'supabase/proofs/pre_v3/closure_runtime.mjs'), 'utf8');
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s+(?:const|let)\s+([^;]+);/g)) {
    // top-level declarators of the form `a=...,b=...` or `rp,wp`
    let depth = 0, current = '';
    const parts = [];
    for (const ch of match[1]) {
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) { parts.push(current); current = ''; } else current += ch;
    }
    parts.push(current);
    for (const part of parts) { const name = /^\s*(\w+)/.exec(part); if (name) names.add(name[1]); }
  }
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) for (const name of match[1].split(',')) names.add(name.trim());
  return names;
}
const exportsOfRuntime = runtimeExports();

test('the proof runtime export list was parsed (sanity)', () => {
  for (const name of ['sql', 'rows', 'q', 'ok', 'denied', 'actor', 'prefs', 'report', 'service', 'anon', 'env', 'sha', 'out', 'assert', 'randomUUID']) assert.ok(exportsOfRuntime.has(name), name);
});

test('the package has the six post-state proofs', () => {
  assert.deepEqual(proofFiles, ['ex05_s01_group_proof.mjs', 'ex05_s01_photo_proof.mjs', 'ex05_s01_push_proof.mjs', 'ex05_s01_readers_proof.mjs', 'ex05_s01_text_proof.mjs', 'ex05_s01_voice_proof.mjs']);
});

for (const file of proofFiles) {
  const source = text(file), code = stripComments(source);

  test(file + ': every relative import resolves to an existing file', () => {
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) assert.ok(existsSync(resolve(pkg, match[1])), 'missing import ' + match[1]);
  });

  test(file + ': every name taken from the proof runtime is exported by closure_runtime.mjs', () => {
    for (const match of code.matchAll(/const\s*\{([^}]+)\}\s*=\s*rt\s*;/g)) {
      for (const part of match[1].split(',')) { const name = part.split(':')[0].trim(); if (name) assert.ok(exportsOfRuntime.has(name), name + ' is not exported by closure_runtime.mjs'); }
    }
    for (const match of code.matchAll(/\brt\.(\w+)/g)) assert.ok(exportsOfRuntime.has(match[1]), 'rt.' + match[1] + ' is not exported by closure_runtime.mjs');
  });

  test(file + ': check names are unique upper-case identifiers and every requires names an EARLIER check', () => {
    const consts = new Map();
    for (const match of code.matchAll(/const\s+(\w+)\s*=\s*'([A-Z0-9_]+)'\s*;/g)) consts.set(match[1], match[2]);
    const declared = [];
    const pattern = /(?:h|harness)\.(check|characterize|requireChain)\(\s*(?:'([A-Z0-9_]+)'|(\w+))/g;
    let match;
    const order = [];
    while ((match = pattern.exec(code)) !== null) {
      const name = match[2] ?? consts.get(match[3]);
      assert.ok(name, 'cannot resolve the check name at offset ' + match.index);
      assert.match(name, /^[A-Z][A-Z0-9_]{5,}$/);
      order.push({name, index: match.index});
    }
    assert.ok(order.length >= 5, 'a proof declares its checks');
    for (const item of order) { assert.ok(!declared.includes(item.name), 'duplicate check name ' + item.name); declared.push(item.name); }
    // requires: [...] arrays, resolved against the checks declared before them
    for (const req of code.matchAll(/requires:\s*\[([^\]]*)\]/g)) {
      const before = order.filter(item => item.index < req.index).map(item => item.name);
      for (const token of req[1].split(',').map(part => part.trim()).filter(Boolean)) {
        const name = token.startsWith("'") ? token.slice(1, -1) : consts.get(token);
        assert.ok(name, 'cannot resolve requires token ' + token);
        assert.ok(before.includes(name), 'requires ' + name + ' which is not declared earlier');
      }
    }
    // REQ-style constants used by checks
    for (const req of code.matchAll(/const\s+REQ\s*=\s*\{requires:\s*\[([^\]]*)\]\}/g)) {
      for (const token of req[1].split(',').map(part => part.trim()).filter(Boolean)) {
        const name = token.startsWith("'") ? token.slice(1, -1) : consts.get(token);
        assert.ok(name && declared.includes(name), 'REQ names an undeclared check ' + token);
      }
    }
  });

  test(file + ': no schema or function change, no migration write, no apply', () => {
    for (const pattern of [/create\s+or\s+replace\s+function/i, /alter\s+function/i, /alter\s+table/i, /create\s+table/i, /drop\s+table/i, /\btruncate\b/i, /\bgrant\s+(execute|select|all|usage)/i,
      /\brevoke\s+(execute|select|all)/i, /apply_migration/i, /insert\s+into\s+supabase_migrations/i, /create\s+(unique\s+)?index/i, /create\s+policy/i]) {
      assert.ok(!pattern.test(code), file + ' contains ' + pattern);
    }
    for (const match of code.matchAll(/drop\s+function/gi)) assert.fail(file + ' drops a function outside lib/sql_snippets.mjs');
  });

  test(file + ': SQLSTATE 40001 appears only as a negative assertion', () => {
    // an upper-case check NAME that mentions the code in prose (..._PT409_NEVER_40001) is not a use of the code
    for (const line of code.split('\n')) {
      const without = line.replace(/[A-Z][A-Z0-9_]*40001[A-Z0-9_]*/g, '');
      if (without.includes('40001')) assert.ok(/doesNotMatch|doesNotInclude|assert\.ok\(!/.test(line), 'a positive use of 40001: ' + line.trim().slice(0, 120));
    }
  });

  test(file + ': every ex05_s01 file it imports, and the runtime, is bound in SOURCES', () => {
    const list = /const SOURCES = \[([\s\S]*?)\];/.exec(source);
    assert.ok(list, 'SOURCES');
    const sources = [...list[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
    for (const path of sources) assert.ok(existsSync(resolve(root, path)), 'SOURCES names a missing file ' + path);
    assert.ok(sources.includes('supabase/proofs/ex05_s01/' + file), 'the proof binds itself');
    assert.ok(sources.includes('supabase/proofs/pre_v3/closure_runtime.mjs'));
    for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = relative(root, resolve(pkg, match[1])).split(sep).join('/');
      if (target.endsWith('closure_runtime.mjs') || target.includes('/lib/') || target.includes('proofs/chat/') || target.includes('proofs/notifications/')) assert.ok(sources.includes(target), 'SOURCES lacks ' + target);
    }
  });

  test(file + ': the report name is unique and the proof ends with the catalog guard and the exit code', () => {
    assert.match(code, /reportName: 'ex05-s01-[a-z]+-report\.json'/);
    assert.match(code, /await h\.catalogGuardCheck\(\);\s*\n\s*process\.exitCode = h\.finish\(\);\s*$/);
    assert.match(code, /h\.beginCatalogGuard\(\)/);
  });
}

test('the report names of the six proofs are distinct', () => {
  const names = proofFiles.map(file => /reportName: '([^']+)'/.exec(text(file))[1]);
  assert.equal(new Set(names).size, names.length);
});
