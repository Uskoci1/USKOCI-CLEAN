const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const { setImmediate: nextTick } = require('node:timers/promises');
const source = readFileSync(join(__dirname, '..', 'metro.config.cjs'), 'utf8');
const projectRoot = join(__dirname, '..');

function load(platform, stores, { root = 'test-project', defaults } = {}) {
  const original = defaults ?? { projectRoot: root, cacheVersion: 'expo-default', cacheStores: stores, resolver: {}, transformer: {}, serializer: {} };
  const module = { exports: {} };
  runInNewContext(source, { module, __dirname: root, process: { platform },
    require(name) {
      if (name === 'node:crypto' || name === 'node:path') return require(name);
      assert.equal(name, 'expo/metro-config');
      return { getDefaultConfig(actualRoot) { assert.equal(actualRoot, root); return original; } };
    },
  });
  assert.equal(module.exports, original);
  return module.exports;
}

test('Windows bounds concurrent warm reads and writes across all stores and preserves values', async () => {
  let active = 0, peak = 0;
  function store() {
    return {
      values: new Map(),
      async io(operation) {
        active += 1; peak = Math.max(peak, active);
        assert.ok(active <= 32, 'cache operations must respect the shared concurrency bound');
        await nextTick();
        try { return operation(); } finally { active -= 1; }
      },
      get(key) { return this.io(() => this.values.get(key) ?? null); },
      set(key, value) { return this.io(() => this.values.set(key, value)); },
      clear() { this.values.clear(); },
    };
  }
  const stores = load('win32', [store(), store()]).cacheStores;
  const values = Array.from({ length: 1200 }, (_, i) => ({ index: i, buffer: Buffer.from([i % 256]) }));
  await Promise.all(values.map((value, i) => stores[i % 2].set(i, value)));
  const reads = await Promise.all(values.map((_, i) => stores[i % 2].get(i)));
  reads.forEach((value, i) => assert.equal(value, values[i]));
  assert.equal(await stores[0].get('absent'), null);
  assert.equal(active, 0);
  assert.equal(peak, 32);
});

test('sync throws and async rejections release their slot without changing errors or stalling later work', async () => {
  const originalError = new Error('CACHE_IO_FAILED');
  const store = load('win32', [{
    get(key) {
      if (key % 3 === 0) throw originalError;
      if (key % 3 === 1) return Promise.reject(originalError);
      return Promise.resolve(key);
    },
    set() { throw originalError; },
    clear() {},
  }]).cacheStores[0];
  const results = await Promise.allSettled(Array.from({ length: 300 }, (_, i) => store.get(i)));
  results.forEach((result, i) => {
    if (i % 3 === 2) { assert.equal(result.status, 'fulfilled'); assert.equal(result.value, i); }
    else { assert.equal(result.status, 'rejected'); assert.equal(result.reason, originalError); }
  });
  await assert.rejects(store.set('key', 'value'), error => error === originalError);
  assert.equal(await store.get(302), 302);
});

test('clear keeps the original store receiver, return value, and synchronous errors', () => {
  const result = {};
  const original = { get() {}, set() {}, clear() { assert.equal(this, original); return result; } };
  const store = load('win32', [original]).cacheStores[0];
  assert.equal(store.name, original.constructor.name);
  assert.equal(store.clear(), result);
  const error = new Error('CLEAR_FAILED');
  original.clear = () => { throw error; };
  assert.throws(() => store.clear(), caught => caught === error);
  original.name = 'named-cache';
  assert.equal(load('win32', [original]).cacheStores[0].name, 'named-cache');
});

for (const platform of ['linux', 'darwin']) {
  test(`${platform} keeps the exact default cache array and store objects`, () => {
    const stores = [{ get() {}, set() {}, clear() {} }];
    assert.equal(load(platform, stores).cacheStores, stores);
  });
}

test('installed Metro discovers the CommonJS config and loads Expo defaults', async () => {
  const { resolveConfig } = require('@expo/metro/metro-config');
  const resolved = await resolveConfig(undefined, projectRoot);
  assert.equal(resolved.filepath, join(projectRoot, 'metro.config.cjs'));
  assert.equal(resolved.config, require('../metro.config.cjs'));
  assert.equal(resolved.config.projectRoot, projectRoot);
  assert.ok(resolved.config.resolver.sourceExts.includes('tsx'));
  assert.ok(resolved.config.cacheStores.length > 0);
});

test('sibling projects sharing the real Router context get isolated installed Metro keys and correct Babel roots', t => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { getDefaultConfig } = require('expo/metro-config');
  const getTransformCacheKey = require('@expo/metro/metro/DeltaBundler/getTransformCacheKey').default;
  const babelTransformerPath = getDefaultConfig(projectRoot).transformer.babelTransformerPath;
  const babelTransformer = require(babelTransformerPath);
  const { resolveBabelrcName } = require(path.join(path.dirname(babelTransformerPath), 'loadBabelConfig.js'));
  const traverse = require('@babel/traverse').default;
  const types = require('@babel/types');
  // Fixture package manifests must remain outside the app/Jest watched tree.
  const scratchParent = path.resolve(require('node:os').tmpdir());
  const scratch = fs.mkdtempSync(path.join(scratchParent, 'uskoci-metro-project-cache-proof-'));
  const sharedModules = fs.realpathSync(path.join(projectRoot, 'node_modules'));
  const oldNodeEnv = process.env.NODE_ENV;
  const fixtures = [], dependencyLinks = [];
  function key(config) {
    const { getTransformOptions, transformVariants, unstable_workerThreads, ...transformerConfig } = config.transformer;
    return getTransformCacheKey({ cacheVersion: config.cacheVersion, projectRoot: config.projectRoot,
      transformerConfig: { transformerPath: config.transformerPath, transformerConfig } });
  }
  try {
    assert.ok(scratch.startsWith(scratchParent + path.sep + 'uskoci-metro-project-cache-proof-'));
    for (const name of ['snapshot-a', 'snapshot-b']) {
      const root = path.join(scratch, name);
      fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'metro-router-cache-fixture', private: true }));
      fs.symlinkSync(sharedModules, path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
      dependencyLinks.push(path.join(root, 'node_modules'));
      assert.equal(resolveBabelrcName(root), undefined, 'fixture must use the installed Expo default preset');
      assert.equal(babelTransformer.getCacheKey({ projectRoot: root, enableBabelRCLookup: true }), '');
      const config = getDefaultConfig(root);
      const filename = fs.realpathSync(path.join(root, 'node_modules', 'expo-router', '_ctx.android.js'));
      fixtures.push({ root, filename, localPath: path.relative(root, filename), config, baseline: key(config), version: config.cacheVersion });
    }
    const [a, b] = fixtures;
    assert.equal(a.filename, b.filename);
    assert.equal(a.localPath, b.localPath);
    assert.equal(a.config.transformer._expoRelativeProjectRoot, b.config.transformer._expoRelativeProjectRoot);
    assert.equal(a.config.transformer._expoRouterPath, b.config.transformer._expoRouterPath);
    assert.equal(a.baseline, b.baseline, 'installed default global keys collide for these shared dependency paths');
    for (const fixture of fixtures) {
      const stores = fixture.config.cacheStores;
      fixture.isolated = load('linux', stores, { root: fixture.root, defaults: fixture.config });
      assert.equal(fixture.isolated.cacheStores, stores, 'project isolation must not replace Expo stores');
      assert.ok(fixture.isolated.cacheVersion.startsWith(fixture.version + ':'));
      fixture.isolatedKey = key(fixture.isolated);
      const again = getDefaultConfig(fixture.root);
      assert.equal(key(load('linux', again.cacheStores, { root: fixture.root, defaults: again })), fixture.isolatedKey);
    }
    assert.notEqual(a.isolatedKey, b.isolatedKey);
    assert.notEqual(a.isolatedKey, a.baseline);

    // This is the installed Expo Babel transformer on the actual shared Router
    // source, not a replacement plugin or a mocked app-root expression. No
    // Metro server, bundle, native build or shared cache entry is produced.
    process.env.NODE_ENV = 'production';
    for (const fixture of fixtures) {
      const { ast } = babelTransformer.transform({ filename: fixture.filename, src: fs.readFileSync(fixture.filename, 'utf8'),
        options: { ...fixture.config.transformer, projectRoot: fixture.root, platform: 'android', dev: false,
          type: 'module', customTransformOptions: { routerRoot: 'src/app' }, enableBabelRCLookup: true } });
      const roots = [];
      traverse(ast, { CallExpression({ node }) {
        if (types.isMemberExpression(node.callee) && types.isIdentifier(node.callee.object, { name: 'require' })
          && types.isIdentifier(node.callee.property, { name: 'context' })) {
          assert.ok(types.isStringLiteral(node.arguments[0]));
          roots.push(node.arguments[0].value);
        }
      } });
      assert.equal(roots.length, 1);
      assert.equal(roots[0], path.relative(path.dirname(fixture.filename), path.join(fixture.root, 'src', 'app')));
      assert.equal(path.resolve(path.dirname(fixture.filename), roots[0]), path.join(fixture.root, 'src', 'app'));
      fixture.routerRoot = roots[0];
    }
    assert.notEqual(a.routerRoot, b.routerRoot, 'different output must never share the dependency transform cache entry');
    t.diagnostic(`Metro ${require('metro/package.json').version}; Expo ${require('expo/package.json').version}; shared real _ctx.android.js; baseline keys equal; isolated keys distinct; both installed Babel roots exact`);
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
    // Remove the links themselves before recursive fixture cleanup; never walk
    // or delete the shared dependency target through a junction/symlink.
    for (const link of dependencyLinks) {
      assert.ok(link.startsWith(scratch + path.sep));
      assert.ok(fs.lstatSync(link).isSymbolicLink());
      fs.unlinkSync(link);
    }
    assert.ok(path.resolve(scratch).startsWith(scratchParent + path.sep + 'uskoci-metro-project-cache-proof-'));
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('installed Expo binary store survives controlled descriptor pressure with unchanged disk values', async t => {
  const fs = require('node:fs');
  const { createHash } = require('node:crypto');
  const { resolve, sep } = require('node:path');
  const { getDefaultConfig } = require('expo/metro-config');
  const scratchParent = resolve(projectRoot, '.expo');
  fs.mkdirSync(scratchParent, { recursive: true });
  const scratch = fs.mkdtempSync(join(scratchParent, 'metro-cache-proof-'));
  // Both the store and cleanup stay below this test's exclusively created root.
  assert.ok(scratch.startsWith(scratchParent + sep + 'metro-cache-proof-'));
  const cacheRoot = join(scratch, 'cache');
  const Store = getDefaultConfig(projectRoot).cacheStores[0].constructor;
  const original = new Store({ root: cacheRoot });
  const wrapped = load('win32', [original]).cacheStores[0];
  const key = text => createHash('sha256').update(text).digest();
  const entries = Array.from({ length: 1200 }, (_, i) => ({
    key: key(`metro-fixture-${i}`),
    value: { path: `fixture-${i}.tsx`, output: [{ type: 'js/module', data: { code: `export default ${i};` } }], buffer: Buffer.from([0, i % 256, 255]) },
  }));
  const readFile = fs.promises.readFile;
  const writeFile = fs.promises.writeFile;
  let active = 0, peak = 0, refusals = 0, completed = 0;
  let pressure = false;
  const emulateDescriptorLimit = 64;
  function instrument(operation) {
    return async function (...args) {
      if (typeof args[0] !== 'string' || !resolve(args[0]).startsWith(cacheRoot + sep)) {
        return operation.apply(this, args);
      }
      if (pressure && active >= emulateDescriptorLimit) {
        refusals += 1;
        throw Object.assign(new Error('Controlled cache descriptor pressure'), { code: 'EMFILE' });
      }
      active += 1;
      peak = Math.max(peak, active);
      try { return await operation.apply(this, args); }
      finally { active -= 1; completed += 1; }
    };
  }
  fs.promises.readFile = instrument(readFile);
  fs.promises.writeFile = instrument(writeFile);
  try {
    await Promise.all(entries.map(entry => wrapped.set(entry.key, entry.value)));
    assert.equal(active, 0);
    assert.equal(peak, 32);

    // The limit is injected, not the machine's real OS descriptor limit. The
    // admitted operations still use the installed Expo store and actual disk.
    pressure = true;
    peak = 0;
    const baseline = await Promise.allSettled(entries.map(entry => original.get(entry.key)));
    assert.equal(peak, emulateDescriptorLimit);
    assert.ok(baseline.some(result => result.status === 'rejected' && result.reason.code === 'EMFILE'));
    assert.ok(refusals > 0);
    const baselineRefusals = refusals;
    peak = 0;
    refusals = 0;
    for (let round = 0; round < 3; round += 1) {
      const values = await Promise.all(entries.map(entry => wrapped.get(entry.key)));
      values.forEach((value, i) => assert.deepEqual(value, entries[i].value));
    }
    assert.equal(active, 0);
    assert.equal(peak, 32);
    assert.equal(refusals, 0);
    assert.equal(await wrapped.get(key('absent')), null);

    const skippedKey = key('skip-css');
    await wrapped.set(skippedKey, { output: [{ data: { css: { skipCache: true } } }] });
    assert.equal(await wrapped.get(skippedKey), null);
    wrapped.clear();
    assert.equal(await wrapped.get(entries[0].key), null);
    await wrapped.set(entries[0].key, entries[0].value);
    assert.deepEqual(await wrapped.get(entries[0].key), entries[0].value);
    t.diagnostic(`Expo ${require('expo/package.json').version}; ${process.platform}; ${Store.name}; 1200 disk writes + 3600 warm reads; injected baseline EMFILE refusals=${baselineRefusals}; wrapped refusals=0; wrapped peak=32; completed disk operations=${completed}`);
  } finally {
    fs.promises.readFile = readFile;
    fs.promises.writeFile = writeFile;
    assert.ok(resolve(scratch).startsWith(scratchParent + sep + 'metro-cache-proof-'));
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
