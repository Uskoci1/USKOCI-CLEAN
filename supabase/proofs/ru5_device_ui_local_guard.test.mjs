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


// Current core path is separately admitted; old historical fixture remains explicit.
const { validateCoreFixture, coreLocation, prepareCore105 } = await import('./ru5_device_ui_fixture.mjs');
test('core105 setup rejects every nonlocal/unbound entry before credentials or SQL', async () => {
  const env={RU5_DEVICE_SUPABASE_URL:'http://127.0.0.1:54321',RU5_DEVICE_DB_URL:'postgresql://postgres:test@127.0.0.1:54322/postgres',
    RU5_DEVICE_CORE106:'1',RU5_DEVICE_PACKAGE:'rs.uskoci.n04proof',RU5_DEVICE_PROOF_DIR:'/tmp/uskoci-ru5-device-ui',RU5_DEVICE_ARTIFACT_DIR:'artifacts/ru5-device-ui',GITHUB_SHA:'a'.repeat(40)};
  validateCoreFixture(env);
  for(const changed of [{RU5_DEVICE_SUPABASE_URL:'https://production.invalid'},{RU5_DEVICE_DB_URL:'postgresql://postgres:DO_NOT_PRINT@remote.invalid/postgres'},
    {RU5_DEVICE_CORE106:'0'},{RU5_DEVICE_PACKAGE:'rs.uskoci.production'},{RU5_DEVICE_PROOF_DIR:'/tmp/other'},
    {RU5_DEVICE_ARTIFACT_DIR:'artifacts/other'},{GITHUB_SHA:'branch'}])
    await assert.rejects(prepareCore105({...env,...changed}),error=>!error.message.includes('DO_NOT_PRINT'));
});
test('core pin precondition binds explicit country and public topology without provider attestation', () => {
  const value=coreLocation();assert.equal(value.taskCountryCode,'RS');assert.equal(value.geography.mode,'STATIONARY');
  assert.equal(value.exactAddress,null);assert.equal(value.accessNotes,null);assert.deepEqual(value.resolvedLocation.binding,{taskCountryCode:'RS',geography:value.geography,exactAddress:null});
  assert.deepEqual(value.resolvedLocation.points,[{slot:'start',latitudeE6:45251234,longitudeE6:19831234,origin:{kind:'MANUAL_PIN'}}]);
});
