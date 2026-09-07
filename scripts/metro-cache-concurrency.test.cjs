const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const { setImmediate: nextTick } = require('node:timers/promises');
const source = readFileSync(join(__dirname, '..', 'metro.config.cjs'), 'utf8');
const projectRoot = join(__dirname, '..');

function load(platform, stores) {
  const original = { cacheStores: stores, resolver: {}, transformer: {}, serializer: {} };
  const module = { exports: {} };
  runInNewContext(source, { module, __dirname: 'test-project', process: { platform },
    require(name) {
      assert.equal(name, 'expo/metro-config');
      return { getDefaultConfig(root) { assert.equal(root, 'test-project'); return original; } };
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
