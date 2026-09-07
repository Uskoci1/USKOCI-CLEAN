import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertLocalDeviceProofTargets } from './ru5_device_ui_local_guard.mjs';

const API = 'http://127.0.0.1:54321';
const DB = 'postgresql://postgres:synthetic-secret@127.0.0.1:54322/postgres';

test('accepts only the existing disposable proof API/database contract', () => {
  assert.doesNotThrow(() => assertLocalDeviceProofTargets(API, DB));
  assert.doesNotThrow(() => assertLocalDeviceProofTargets(`${API}/`, DB));
});

for (const api of [
  'https://leqcwgzvjsxugfgzdmth.supabase.co',
  'http://127.0.0.1.attacker.invalid:54321',
  'http://127.0.0.1:54321@attacker.invalid',
  'http://user:secret@127.0.0.1:54321',
  'https://127.0.0.1:54321',
  'http://127.0.0.1:54322',
  'http://127.0.0.1:54321/rest/v1',
  'http://127.0.0.1:54321?target=remote',
  'http://127.0.0.1:54321#remote',
  undefined,
]) {
  test(`rejects unsafe API case ${String(api).replace('user:secret', 'redacted')}`, () => {
    assert.throws(() => assertLocalDeviceProofTargets(api, DB), /RU5_DEVICE_/);
  });
}

for (const db of [
  'postgresql://postgres:secret@db.leqcwgzvjsxugfgzdmth.supabase.co:5432/postgres',
  'postgresql://postgres:secret@127.0.0.1:5432/postgres',
  'postgresql://postgres:secret@127.0.0.1:54322/other_database',
  'postgresql://postgres:secret@127.0.0.1:54322/postgres?host=remote.invalid',
  'postgresql://postgres:secret@127.0.0.1:54322/postgres#remote',
  'postgresql://postgres:secret@127.0.0.1.attacker.invalid:54322/postgres',
  undefined,
]) {
  test('rejects unsafe DB target without exposing credentials', () => {
    assert.throws(() => assertLocalDeviceProofTargets(API, db), error => {
      assert.match(error.message, /RU5_DEVICE_/);
      assert.ok(!error.message.includes('secret'));
      assert.ok(!error.message.includes('postgresql://'));
      return true;
    });
  });
}

test('fixture validates both targets before client creation or fixture mutation', () => {
  const fixture = readFileSync(new URL('./ru5_device_ui_fixture.mjs', import.meta.url), 'utf8');
  const guardAt = fixture.indexOf('assertLocalDeviceProofTargets(url, dbUrl);');
  assert.ok(guardAt > 0);
  assert.ok(guardAt < fixture.indexOf('createClient(url,'));
  assert.ok(guardAt < fixture.indexOf('await createRealAccount('));
  assert.ok(guardAt < fixture.indexOf('psql(`'));
});
