import { execFileSync } from 'node:child_process';

// Exercise the actual Node/CommonJS dependency path used by native prebuild.
// Jest's module transformer must not hide an incompatible package override.
it('keeps Xcode project IDs compatible and rejects out-of-bounds UUID writes', () => {
  const result = execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const xcodeRequire = createRequire(require.resolve('xcode'));
    const uuid = xcodeRequire('uuid');
    const project = require('xcode').project('not-read.pbxproj');
    project.hash = { project: { objects: { PBXGroup: {} } } };
    const ids = new Set();
    for (let i = 0; i < 128; i++) {
      const id = project.generateUuid();
      assert.match(id, /^[0-9A-F]{24}$/);
      assert.ok(!ids.has(id));
      ids.add(id);
      project.hash.project.objects.PBXGroup[id] = {};
    }
    assert.equal(project.allUuids().length, 128);
    assert.match(uuid.v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    for (const version of ['v3', 'v5']) {
      assert.throws(() => uuid[version]('x', uuid[version].DNS, new Uint8Array(8), 4), RangeError);
    }
    console.log('PASS XCODE_COMMONJS_IDS_AND_UUID_BOUNDS');
  `], { encoding: 'utf8', timeout: 15000 });
  expect(result.trim()).toBe('PASS XCODE_COMMONJS_IDS_AND_UUID_BOUNDS');
});
