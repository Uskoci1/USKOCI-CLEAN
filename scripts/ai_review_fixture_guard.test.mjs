import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { main, proposedFacts, validateAiFixture } from './ai_review_fixture.mjs';
import { admittedPath, forwardedHeaders, boundedBody } from './ai_review_edge_server.mjs';

const env = { RU5_DEVICE_SUPABASE_URL: 'http://127.0.0.1:54321',
  RU5_DEVICE_DB_URL: 'postgresql://postgres:test-only@127.0.0.1:54322/postgres',
  RU5_DEVICE_PACKAGE: 'rs.uskoci.n04proof', RU5_DEVICE_PROOF_DIR: '/tmp/uskoci-ru5-device-ui',
  RU5_DEVICE_ARTIFACT_DIR: 'artifacts/ai-review-device', GITHUB_SHA: 'a'.repeat(40) };

test('exact local proof identity is admitted without requiring credentials', () => validateAiFixture(env));
test('all four entry modes refuse remote targets before file/client/SQL work without exposing URL secrets', async () => {
  for (const mode of ['admit', 'create-account', 'observe', 'verify']) {
    for (const changes of [
      { RU5_DEVICE_SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co' },
      { RU5_DEVICE_SUPABASE_URL: 'http://127.0.0.1.attacker.invalid:54321' },
      { RU5_DEVICE_DB_URL: 'postgresql://postgres:DO_NOT_PRINT@remote.invalid:54322/postgres' },
      { RU5_DEVICE_DB_URL: 'postgresql://postgres:DO_NOT_PRINT@127.0.0.1:54322/postgres?host=remote.invalid' },
      { RU5_DEVICE_PACKAGE: 'rs.uskoci.production' }, { RU5_DEVICE_PROOF_DIR: '/tmp/another-project' },
      { RU5_DEVICE_ARTIFACT_DIR: 'artifacts/another-proof' }, { GITHUB_SHA: 'branch-name' },
    ]) await assert.rejects(main(mode, { ...env, ...changes }), error => !error.message.includes('DO_NOT_PRINT'));
  }
});
test('synthetic proposals preserve typed people, vehicle, route, OFFERS and fixed endpoints without confirmation fields', () => {
  const facts = proposedFacts('a1b2c3d4', '2026-10-12T07:00:00Z', '2026-10-12T09:00:00Z');
  assert.equal(facts.length, 11);
  const byKey = Object.fromEntries(facts.map(f => [f.key, f]));
  assert.equal(Object.keys(byKey).length, 11);
  assert.equal(byKey['need.task_country_code'].value, 'RS');
  assert.equal(byKey['need.people_needed'].value, 2);
  assert.deepEqual(byKey['need.required_vehicles'].value, ['Kombi']);
  assert.equal(byKey['need.price_mode'].value, 'OFFERS');
  assert.equal(byKey['need.schedule_kind'].value, 'FIXED_WINDOW');
  assert.equal(byKey['need.task_geography'].value.mode, 'POINT_TO_POINT');
  assert.notDeepEqual(byKey['need.task_geography'].value.start, byKey['need.task_geography'].value.end);
  for (const fact of facts) {
    assert.deepEqual(Object.keys(fact).sort(), ['key', 'value', 'displayValue', 'evidence', 'confidence'].sort());
    assert.match(fact.evidence, /nije stvarni provider izlaz/);
  }
  assert.throws(() => proposedFacts('../bad', '2026-10-12T07:00:00Z', '2026-10-12T09:00:00Z'));
  assert.throws(() => proposedFacts('a1b2c3d4', '2026-10-12T09:00:00Z', '2026-10-12T07:00:00Z'));
});

test('proof adapter admits only exact Auth/REST/current handler routes', () => {
  for (const path of ['/auth/v1/token?grant_type=password','/auth/v1/user','/rest/v1/needs?select=id','/rest/v1/rpc/rpc_ai_read_need_turn_v2'])assert.ok(admittedPath(path));
  assert.equal(admittedPath('/functions/v1/uskoci-ai-interview'),'handler');
  for (const path of ['https://outside.invalid','//outside.invalid/auth/v1/user','/rest/v1/../auth/v1/user','/rest/v1/%2e%2e/auth/v1/user',
    '/rest/v1/%2fneeds','/auth/v1/admin/users','/storage/v1/object/private','/functions/v1/other','/auth/v1/user#fragment','/rest\\v1/needs'])assert.equal(admittedPath(path),null,path);
});
test('only application request headers pass; forwarded host and credentials cannot be invented', () => {
  const h=forwardedHeaders({authorization:'Bearer fixture',apikey:'fixture-anon',host:'evil.invalid',connection:'keep-alive',
    'x-forwarded-host':'evil.invalid','content-length':'999','content-type':'application/json',cookie:'private'});
  assert.deepEqual([...h.keys()].sort(),['apikey','authorization','content-type']);
  assert.equal(h.get('authorization'),'Bearer fixture');
});
test('streamed bodies are bounded by actual bytes', async () => {
  assert.equal((await boundedBody(Readable.from([Buffer.from('ab'),Buffer.from('cd')]),4)).toString(),'abcd');
  await assert.rejects(boundedBody(Readable.from([Buffer.from('ab'),Buffer.from('cde')]),4),/PROOF_BODY_LIMIT/);
});
