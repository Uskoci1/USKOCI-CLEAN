'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildIdentity, backendTarget } = require('./build-identity.cjs');
const sha = 'a'.repeat(40);
const absentGit = () => { throw new Error('git unavailable'); };

test('uses checked-out source over a stale declared workflow SHA', () => {
  const git = (_command, args) => args[0] === 'rev-parse' ? sha + '\n' : '';
  assert.deepEqual(buildIdentity({ root: '.', version: '1.0.0', environment: { GITHUB_SHA: 'b'.repeat(40) }, git }), {
    schemaVersion: 1, version: '1.0.0', sourceCommit: sha, sourceDirty: false, backendTarget: 'unconfigured', backendRelease: null,
  });
});
test('records tracked and untracked work as dirty rather than claiming a clean commit build', () => {
  const git = (_command, args) => args[0] === 'rev-parse' ? sha : '?? uncommitted.ts';
  assert.equal(buildIdentity({ root: '.', git }).sourceDirty, true);
});
test('allows an exact declared source for exported code without fabricating clean-tree proof', () => {
  assert.deepEqual(buildIdentity({ root: '.', version: '1.2.3-test', environment: { USKOCI_BUILD_COMMIT: sha }, git: absentGit }), {
    schemaVersion: 1, version: '1.2.3-test', sourceCommit: sha, sourceDirty: null, backendTarget: 'unconfigured', backendRelease: null,
  });
});
test('never exposes a malformed source, arbitrary version, endpoint credentials or environment secret', () => {
  const identity = buildIdentity({ root: '.', version: 'private-value', git: absentGit, environment: {
    USKOCI_BUILD_COMMIT: 'secret-value', EXPO_PUBLIC_SUPABASE_URL: 'https://private:secret@wrong.example?key=secret',
    SUPABASE_SERVICE_ROLE_KEY: 'service-secret', OPENAI_API_KEY: 'provider-secret',
  } });
  assert.equal(identity.sourceCommit, null);
  assert.equal(identity.version, null);
  assert.equal(identity.backendTarget, 'other');
  assert.equal(JSON.stringify(identity).includes('secret'), false);
});
for (const [url, expected] of [
  ['https://leqcwgzvjsxugfgzdmth.supabase.co', 'canonical'],
  ['https://leqcwgzvjsxugfgzdmth.supabase.co/', 'canonical'],
  ['https://leqcwgzvjsxugfgzdmth.supabase.co.evil.example', 'other'],
  ['https://leqcwgzvjsxugfgzdmth.supabase.co?key=private', 'other'],
  ['http://leqcwgzvjsxugfgzdmth.supabase.co', 'other'],
  ['http://127.0.0.1:54321', 'local'], ['http://10.0.2.2:54321', 'local'],
  ['http://localhost:54321', 'local'], ['', 'unconfigured'],
]) test('classifies target without declaring deployment readiness: ' + url, () => assert.equal(backendTarget(url), expected));
