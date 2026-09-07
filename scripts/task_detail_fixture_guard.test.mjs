import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const base = { ...process.env, RU5_DEVICE_SUPABASE_URL: 'http://127.0.0.1:54321',
  RU5_DEVICE_DB_URL: 'postgresql://postgres:synthetic-secret@127.0.0.1:54322/postgres',
  RU5_DEVICE_PACKAGE: 'rs.uskoci.n04proof', RU5_DEVICE_PROOF_DIR: '/tmp/uskoci-ru5-device-ui' };
for (const change of [
  { RU5_DEVICE_SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co' },
  { RU5_DEVICE_DB_URL: 'postgresql://postgres:synthetic-secret@remote.invalid:5432/postgres' },
  { RU5_DEVICE_DB_URL: 'postgresql://postgres:synthetic-secret@127.0.0.1:54322/postgres?host=remote.invalid' },
]) {
  test('actual deadline fixture refuses unsafe target before any psql call', () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./task_detail_deadline_fixture.mjs', import.meta.url))],
      { env: { ...base, ...change }, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RU5_DEVICE_/);
    assert.ok(!result.stderr.includes('synthetic-secret'));
    assert.ok(!result.stderr.includes('spawnSync psql'));
    assert.ok(!result.stdout.includes('PASS'));
  });
}
