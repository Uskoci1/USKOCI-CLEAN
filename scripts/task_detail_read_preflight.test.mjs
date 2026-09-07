import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertReadProbeRequest } from './task_detail_read_preflight.mjs';

test('read probe admits only the actual local read routes and fixture login', () => {
  for (const path of ['/auth/v1/user', '/rest/v1/needs?select=id', '/rest/v1/app_profiles?select=id']) {
    assert.equal(assertReadProbeRequest('http://127.0.0.1:54321' + path).method, 'GET');
  }
  assert.equal(assertReadProbeRequest('http://127.0.0.1:54321/auth/v1/token?grant_type=password', { method: 'POST' }).method, 'POST');
  assert.equal(assertReadProbeRequest('http://127.0.0.1:54321/rest/v1/rpc/rpc_get_public_profile', { method: 'POST' }).method, 'POST');
});
test('read probe rejects writes, arbitrary RPCs and nonlocal/redirected hosts before fetch', () => {
  for (const [url, method] of [
    ['http://127.0.0.1:54321/rest/v1/needs', 'POST'], ['http://127.0.0.1:54321/rest/v1/needs', 'PATCH'],
    ['http://127.0.0.1:54321/rest/v1/app_profiles', 'DELETE'],
    ['http://127.0.0.1:54321/rest/v1/rpc/rpc_submit_response', 'POST'],
    ['http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token', 'POST'],
    ['https://leqcwgzvjsxugfgzdmth.supabase.co/rest/v1/needs', 'GET'],
    ['http://127.0.0.1.attacker.invalid:54321/rest/v1/needs', 'GET'],
    ['http://127.0.0.1:54321/rest/v1/needs#hidden', 'GET'],
  ]) assert.throws(() => assertReadProbeRequest(url, { method }));
});

