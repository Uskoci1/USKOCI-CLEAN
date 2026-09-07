import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDiscoveryEnvironment, fixturePlan, snapshotSql, sourceReaders, main } from './shared_discovery_fixture.mjs';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const env = () => ({ RU5_DEVICE_SUPABASE_URL: 'http://127.0.0.1:54321',
  RU5_DEVICE_DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  RU5_DEVICE_PACKAGE: 'rs.uskoci.n04proof', GITHUB_SHA: 'a'.repeat(40),
  RU5_DEVICE_REQUESTER_USER_ID: id(1), RU5_DEVICE_WORKER_USER_ID: id(2), RU5_DEVICE_NEED_ID: id(3),
  RU5_DEVICE_ARTIFACT_DIR: 'artifacts/shared-discovery-device' });

test('fixture accepts only the explicit existing disposable target/package/actor boundary', () => {
  assert.doesNotThrow(() => assertDiscoveryEnvironment(env()));
  for (const [key, value] of [
    ['RU5_DEVICE_SUPABASE_URL', 'https://leqcwgzvjsxugfgzdmth.supabase.co'],
    ['RU5_DEVICE_SUPABASE_URL', 'http://127.0.0.1:54321.evil.invalid'],
    ['RU5_DEVICE_DB_URL', 'postgresql://postgres:secret@db.example.invalid:54322/postgres'],
    ['RU5_DEVICE_DB_URL', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=external.invalid'],
    ['RU5_DEVICE_PACKAGE', 'rs.uskoci.preview'], ['GITHUB_SHA', `${'a'.repeat(40)}\n`],
    ['RU5_DEVICE_REQUESTER_USER_ID', `${id(1)}\n`], ['RU5_DEVICE_WORKER_USER_ID', id(1)],
  ]) assert.throws(() => assertDiscoveryEnvironment({ ...env(), [key]: value }));
});

test('invalid production target rejects before any SQL/client setup even when seed is requested', async () => {
  await assert.rejects(main({ ...env(), RU5_DEVICE_SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co' }, 'seed'));
});

test('fixture is a deterministic34-row plan with close coarse cluster, isolated point, remote/missing and both price modes', () => {
  let n = 0; const rows = fixturePlan(() => id(++n));
  assert.equal(rows.length, 34); assert.equal(new Set(rows.map(row => row.id)).size, 34);
  assert.deepEqual(rows.filter(row => row.lat !== null).map(row => row.ordinal), [1, 2, 5]);
  assert.equal(rows[0].lat, rows[1].lat); assert.ok(Math.abs(rows[0].lng - rows[1].lng) < 0.011);
  assert.equal(rows[2].executionMode, 'REMOTE'); assert.equal(rows[2].lat, null); assert.equal(rows[3].lng, null);
  assert.ok(rows.some(row => row.mode === 'OFFERS')); assert.ok(rows.some(row => row.mode === 'MY_PRICE' && row.price > 0));
  assert.equal(rows.filter(row => row.title.includes('DISCOVERY_3')).length, 5);
  assert.equal(rows.slice(0, 30).filter(row => row.title.includes('DISCOVERY_3')).length, 1);
  assert.ok(rows.every(row => row.required === 2 && row.privateSentinel.startsWith('LOCAL_ONLY_PRIVATE_')));
  assert.throws(() => fixturePlan(() => id(1)));
});

test('postflight query cannot expand outside its table/UUID allowlist and preserves complete original rows', () => {
  assert.throws(() => snapshotSql('public.needs; delete from auth.users'));
  assert.throws(() => snapshotSql('auth.users'));
  assert.throws(() => snapshotSql('public.needs', [`${id(1)}');delete from public.needs;--`]));
  assert.throws(() => snapshotSql('public.agreements', [id(1)]));
  assert.match(snapshotSql('public.needs', [id(1)]), /where id not in/);
  assert.match(snapshotSql('public.need_sensitive', [id(1)]), /where need_id not in/);
  assert.match(snapshotSql('public.needs'), /row_to_json\(t\)/);
});

test('closed VM loads all actual production dependencies including the new formatter and invokes only injected reads', async () => {
  const calls = [];
  const row = { id: id(1), title: 'LOCAL_TEST', status: 'PUBLISHED', created_at: '2026-09-07T12:00:00.123456+00:00',
    starts_at: null, ends_at: null, schedule_kind: 'REMOTE_ANYTIME', execution_location_mode: 'REMOTE',
    approximate_area: '', approximate_city: '', approximate_lat: 0, approximate_lng: 0,
    required_slots: 2, covered_slots: 0, required_skills: [], required_tools: [], required_vehicles: [],
    mode: 'OFFERS', requester_price_rsd: null, requester_profile_id: id(2), response_deadline: null };
  const query = { select(fields) { calls.push(['select', fields]); return this; },
    in() { return this; }, order() { return this; }, limit() { return this; },
    then(resolve, reject) { return Promise.resolve({ data: [row], error: null }).then(resolve, reject); } };
  const { service, pins, fingerprints } = sourceReaders({
    from(table) { assert.equal(table, 'needs'); calls.push(['from', table]); return query; },
    async rpc(name) { assert.equal(name, 'rpc_get_public_profile'); calls.push(['rpc', name]); return { data: null, error: null }; },
  });
  const page = await service.otvorenePrilikeStrana();
  assert.equal(page.items.length, 1); assert.equal(page.nextCursor, null);
  assert.equal(page.items[0].id, row.id); assert.equal(page.items[0].priblizno, null);
  assert.equal(page.items[0].pokrivenost.popunjeno, 0); assert.equal(pins(page.items).features.length, 0);
  assert.deepEqual(fingerprints.map(item => item.path).sort(), ['src/data/discoveryClientService.ts',
    'src/data/discoveryFormat.ts', 'src/data/discoveryView.ts', 'src/data/publicProfileClientService.ts'].sort());
  assert.ok(fingerprints.every(item => item.bytes > 0 && /^[0-9a-f]{64}$/.test(item.sha256)));
  assert.ok(calls.some(([operation]) => operation === 'rpc'));
  assert.ok(calls.filter(([operation]) => operation === 'select').every(([, fields]) => !fields.includes('exact_address')));
});
