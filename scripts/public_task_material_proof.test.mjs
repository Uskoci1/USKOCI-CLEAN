import test from 'node:test';
import assert from 'node:assert/strict';
import { assertMaterialEnvironment, assertMaterialRequest, rowSnapshotSql, assertOriginalRowsPreserved, main } from './public_task_material_proof.mjs';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const local = 'http://127.0.0.1:54321';
const env = () => ({ RU5_DEVICE_SUPABASE_URL: local,
  RU5_DEVICE_DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  RU5_DEVICE_PROOF_DIR: '/tmp/uskoci-ru5-device-ui', RU5_DEVICE_PACKAGE: 'rs.uskoci.n04proof',
  RU5_DEVICE_REQUESTER_USER_ID: id(1), RU5_DEVICE_WORKER_USER_ID: id(2), RU5_DEVICE_NEED_ID: id(3),
  RU5_DEVICE_ARTIFACT_DIR: 'artifacts/public-task-material-device', GITHUB_SHA: 'a'.repeat(40) });

test('material proof admits only existing disposable project and validates actor/head identities', () => {
  assert.doesNotThrow(() => assertMaterialEnvironment(env()));
  for (const [key, value] of [
    ['RU5_DEVICE_SUPABASE_URL', 'https://leqcwgzvjsxugfgzdmth.supabase.co'],
    ['RU5_DEVICE_DB_URL', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=remote.invalid'],
    ['RU5_DEVICE_PROOF_DIR', '/tmp/other'], ['RU5_DEVICE_PACKAGE', 'rs.uskoci.preview'],
    ['RU5_DEVICE_REQUESTER_USER_ID', `${id(1)}\n`], ['RU5_DEVICE_WORKER_USER_ID', id(1)],
    ['GITHUB_SHA', `${'a'.repeat(40)}\n`],
  ]) assert.throws(() => assertMaterialEnvironment({ ...env(), [key]: value }));
});

test('main refuses production target before SQL, client creation or filesystem changes', async () => {
  await assert.rejects(main({ ...env(), RU5_DEVICE_SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co' }, 'seed'));
  await assert.rejects(main({ ...env(), RU5_DEVICE_DB_URL: 'postgresql://postgres:password@production.invalid:5432/postgres' }, 'postflight'));
});

test('read phase admits only actual public reads, with isolated explicit negative sensitive probe', () => {
  for (const path of ['/rest/v1/needs?select=id', '/auth/v1/user']) {
    assert.equal(assertMaterialRequest(local + path).method, 'GET');
  }
  assert.equal(assertMaterialRequest(local + '/rest/v1/rpc/rpc_get_public_profile', { method: 'POST' }).method, 'POST');
  assert.throws(() => assertMaterialRequest(local + '/rest/v1/need_sensitive'));
  assert.equal(assertMaterialRequest(local + '/rest/v1/need_sensitive', {}, 'read', true).method, 'GET');
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) {
    assert.throws(() => assertMaterialRequest(local + '/rest/v1/needs', { method }));
    assert.throws(() => assertMaterialRequest(local + '/rest/v1/need_sensitive', { method }, 'read', true));
  }
});

test('fixture auth and only the two existing domain commands cannot run after read freeze', () => {
  for (const path of ['/auth/v1/token?grant_type=password', '/auth/v1/admin/users',
    '/rest/v1/rpc/rpc_submit_response', '/rest/v1/rpc/rpc_select_response']) {
    assert.equal(assertMaterialRequest(local + path, { method: 'POST' }, 'setup').method, 'POST');
    assert.throws(() => assertMaterialRequest(local + path, { method: 'POST' }, 'read'));
  }
  for (const path of ['/auth/v1/token?grant_type=refresh_token', '/rest/v1/rpc/rpc_publish_need',
    '/rest/v1/rpc/rpc_send_agreement_message', '/rest/v1/app_profiles']) {
    assert.throws(() => assertMaterialRequest(local + path, { method: 'POST' }, 'setup'));
  }
  assert.throws(() => assertMaterialRequest(local + '/rest/v1/needs', {}, 'unknown'));
});

test('HTTP targets reject spoofed origin, URL credentials, fragments and request-object writes', () => {
  for (const url of ['https://leqcwgzvjsxugfgzdmth.supabase.co/rest/v1/needs',
    'http://127.0.0.1.attacker.invalid:54321/rest/v1/needs', 'http://127.0.0.1:54322/rest/v1/needs',
    local + '/rest/v1/needs#hidden', 'http://user:pass@127.0.0.1:54321/rest/v1/needs']) {
    assert.throws(() => assertMaterialRequest(url));
  }
  assert.throws(() => assertMaterialRequest(new Request(local + '/rest/v1/needs', { method: 'DELETE' })));
});

test('snapshot expression hashes whole rows only in declared public/private tables without interpolation escape', () => {
  for (const table of ['public.needs', 'private.connection_activations']) {
    assert.match(rowSnapshotSql(table), /md5\(to_jsonb\(t\)::text\)/);
    assert.ok(rowSnapshotSql(table).includes(`from ${table} t`));
    assert.ok(!rowSnapshotSql(table).includes(' where '));
  }
  for (const table of ['auth.users', 'public.needs\n', 'public.needs; delete from auth.users',
    'private.connection_activations where true', ['public.needs']]) assert.throws(() => rowSnapshotSql(table));
});

test('original-row preservation allows new setup rows but detects change, removal, duplicate loss and table inventory changes', () => {
  const before = { 'public.needs': ['a', 'b', 'b'], 'private.commands': ['x'] };
  assert.doesNotThrow(() => assertOriginalRowsPreserved(before, { 'public.needs': ['z', 'b', 'a', 'b'], 'private.commands': ['x', 'y'] }));
  for (const after of [
    { 'public.needs': ['a', 'b', 'z'], 'private.commands': ['x'] },
    { 'public.needs': ['a', 'b', 'b'], 'private.commands': [] },
    { 'public.needs': ['a', 'b', 'b'] },
    { ...before, 'private.new_table': [] },
  ]) assert.throws(() => assertOriginalRowsPreserved(before, after));
});
