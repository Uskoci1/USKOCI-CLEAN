'use strict';

// Preparation only. Read exact Git blobs; never import product code, read env
// values, contact a service or deploy. Payloads stay in ignored local artifacts.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const allowed = name => /^(?:supabase\/functions\/|src\/(?:contracts|lib|features\/voice)\/)[a-zA-Z0-9_./-]+\.(?:ts|mjs|js|json)$/.test(name);

function references(name, text) {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) throw new Error('INVALID_SOURCE:' + name);
  const refs = [];
  const add = (node, kind) => {
    if (!node || !ts.isStringLiteralLike(node)) throw new Error('NONLITERAL_MODULE:' + name);
    refs.push({ specifier: node.text, kind });
  };
  const visit = node => {
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Deno')
      throw new Error('UNREVIEWED_COMPUTED_DENO:' + name);
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.initializer) && node.initializer.text === 'Deno')
      throw new Error('UNREVIEWED_DENO_ALIAS:' + name);
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Deno'
        && /^read(?:Text)?File(?:Sync)?$/.test(node.name.text)
        && (!ts.isCallExpression(node.parent) || node.parent.expression !== node))
      throw new Error('UNREVIEWED_FILE_READER_ALIAS:' + name);
    if (ts.isImportDeclaration(node)) add(node.moduleSpecifier, node.importClause?.isTypeOnly ? 'type' : 'module');
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) add(node.moduleSpecifier, node.isTypeOnly ? 'type' : 'module');
    if (ts.isImportEqualsDeclaration(node)) throw new Error('UNREVIEWED_IMPORT_EQUALS:' + name);
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0], 'module');
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') throw new Error('UNREVIEWED_REQUIRE:' + name);
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'resolve'
          && ts.isMetaProperty(node.expression.expression)
          && node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword) add(node.arguments[0], 'runtime-asset');
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
          && node.expression.expression.text === 'Deno' && /^read(?:Text)?File(?:Sync)?$/.test(node.expression.name.text)) {
        const url = node.arguments[0];
        const resolve = url && ts.isNewExpression(url) && ts.isIdentifier(url.expression) && url.expression.text === 'URL'
          && url.arguments?.length === 1 ? url.arguments[0] : null;
        if (!resolve || !ts.isCallExpression(resolve) || !ts.isPropertyAccessExpression(resolve.expression)
            || resolve.expression.name.text !== 'resolve' || !ts.isMetaProperty(resolve.expression.expression)
            || resolve.expression.expression.keywordToken !== ts.SyntaxKind.ImportKeyword)
          throw new Error('UNREVIEWED_FILE_ASSET:' + name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return refs;
}

function collect(entrypoint, readBlob) {
  const found = new Map(), external = new Map();
  function walk(name) {
    if (!allowed(name) || name.split('/').includes('..')) throw new Error('OUT_OF_SCOPE_SOURCE:' + name);
    if (found.has(name)) return;
    const bytes = readBlob(name);
    if (!Buffer.isBuffer(bytes)) throw new Error('MISSING_GIT_BLOB:' + name);
    const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!Buffer.from(content).equals(bytes)) throw new Error('NONCANONICAL_UTF8:' + name);
    found.set(name, { name, content, sha256: sha(bytes), bytes: bytes.length });
    for (const ref of references(name, content)) {
      if (ref.specifier.startsWith('.')) {
        let target = path.posix.normalize(path.posix.join(path.posix.dirname(name), ref.specifier));
        // Only type imports may use the app's extensionless TypeScript convention.
        // Do not silently rewrite a runtime import that Deno cannot resolve.
        if (!path.posix.extname(target)) {
          if (ref.kind !== 'type') throw new Error('EXTENSIONLESS_RUNTIME_IMPORT:' + name);
          target += '.ts';
        }
        if (ref.kind === 'runtime-asset') throw new Error('UNREVIEWED_LOCAL_ASSET:' + name);
        walk(target);
      } else {
        if (!/^npm:@imagemagick\/magick-wasm@0\.0\.43(?:\/magick\.wasm)?$/.test(ref.specifier))
          throw new Error('UNREVIEWED_EXTERNAL_DEPENDENCY:' + ref.specifier);
        external.set(ref.specifier + ':' + ref.kind, ref);
      }
    }
  }
  walk(entrypoint);
  return { files: [...found.values()].sort((a, b) => a.name.localeCompare(b.name)),
    externalDependencies: [...external.values()].sort((a, b) => a.specifier.localeCompare(b.specifier) || a.kind.localeCompare(b.kind)) };
}

function main() {
  const [flag, source, ...extra] = process.argv.slice(2);
  if (flag !== '--source' || !/^[0-9a-f]{40}$/.test(source || '') || extra.length) throw new Error('EXACT_SOURCE_REQUIRED');
  const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  const tree = git('rev-parse', source + '^{tree}').toString().trim();
  const allFiles = git('ls-tree', '-r', '--name-only', source, 'supabase/functions').toString().trim().split('\n');
  if (allFiles.some(name => /\/(?:deno\.jsonc?|import_map\.json|package\.json)$/.test(name)))
    throw new Error('DEPENDENCY_CONFIG_REQUIRES_REVIEW');
  const names = allFiles.filter(name => /^supabase\/functions\/uskoci-[a-z-]+\/index\.ts$/.test(name)).sort();
  if (names.length !== 11) throw new Error('EDGE_INVENTORY_CHANGED');
  const destination = path.join(root, 'artifacts', 'v5-edge-payloads', source);
  fs.mkdirSync(destination, { recursive: true });
  const functions = names.map(entrypoint => {
    const name = path.posix.basename(path.posix.dirname(entrypoint));
    const graph = collect(entrypoint, file => git('show', source + ':' + file));
    const payload = { project_id: 'leqcwgzvjsxugfgzdmth', name, entrypoint_path: entrypoint,
      verify_jwt: true, files: graph.files.map(({ name, content }) => ({ name, content })) };
    const bytes = Buffer.from(JSON.stringify(payload) + '\n');
    fs.writeFileSync(path.join(destination, name + '.json'), bytes);
    return { name, entrypoint, verifyJwt: true, payloadSha256: sha(bytes), payloadBytes: bytes.length,
      files: graph.files.map(({ content, ...metadata }) => metadata), externalDependencies: graph.externalDependencies };
  });
  const manifest = { status: 'PREPARATION_ONLY_NOT_APPROVED_OR_DEPLOYED', sourceCommit: source, sourceTree: tree,
    projectRef: 'leqcwgzvjsxugfgzdmth', functions,
    remaining: ['Actual hosted bundle and JWT readback', 'Pinned npm WASM asset in hosted runtime',
      'Concrete owner live approval before any deployment'], liveChanged: false, providerInvoked: false };
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ source, tree, functions: functions.length,
    totalFileEntries: functions.reduce((n, f) => n + f.files.length, 0), destination, liveChanged: false }) + '\n');
}
module.exports = { collect, references };
if (require.main === module) main();
