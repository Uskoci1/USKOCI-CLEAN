import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { main, proposedFacts, REVIEWED_AI_DEPENDENCY, validateAiFixture } from './ai_review_fixture.mjs';

const env = { RU5_DEVICE_SUPABASE_URL: 'http://127.0.0.1:54321',
  RU5_DEVICE_DB_URL: 'postgresql://postgres:test-only@127.0.0.1:54322/postgres',
  RU5_DEVICE_PACKAGE: 'rs.uskoci.n04proof', RU5_DEVICE_PROOF_DIR: '/tmp/uskoci-ru5-device-ui',
  RU5_DEVICE_ARTIFACT_DIR: 'artifacts/ai-review-device', GITHUB_SHA: 'a'.repeat(40) };

test('exact local proof identity is admitted without requiring credentials', () => validateAiFixture(env));
test('native dependency retains reviewed PR57 bytes and only the two existing RPC definitions', () => {
  const bytes = readFileSync(REVIEWED_AI_DEPENDENCY.file);
  assert.equal(bytes.length, 21141);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'ee0077ae883328f865a73eed0ebab9434a8c2e47add750b055de45950e5a77d1');
  const definitions = [...bytes.toString('utf8').matchAll(/create or replace function public\.([a-z0-9_]+)\(/gi)].map(m => m[1]);
  assert.deepEqual(definitions, ['rpc_ai_need_review_v2', 'rpc_save_need_draft_from_review']);
});
test('all four entry modes refuse remote targets before file/client/SQL work without exposing URL secrets', async () => {
  for (const mode of ['admit', 'create-account', 'seed', 'observe']) {
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
  assert.equal(facts.length, 10);
  const byKey = Object.fromEntries(facts.map(f => [f.key, f]));
  assert.equal(Object.keys(byKey).length, 10);
  assert.equal(byKey['need.people_needed'].value, 2);
  assert.deepEqual(byKey['need.required_vehicles'].value, ['Kombi']);
  assert.equal(byKey['need.price_mode'].value, 'OFFERS');
  assert.equal(byKey['need.schedule_kind'].value, 'FIXED_WINDOW');
  assert.equal(byKey['need.task_geography'].value.mode, 'POINT_TO_POINT');
  assert.notDeepEqual(byKey['need.task_geography'].value.start, byKey['need.task_geography'].value.end);
  for (const fact of facts) {
    assert.deepEqual(Object.keys(fact).sort(), ['key', 'value', 'displayValue', 'evidence', 'confidence'].sort());
    assert.match(fact.evidence, /nije provider izlaz/);
  }
  assert.throws(() => proposedFacts('../bad', '2026-10-12T07:00:00Z', '2026-10-12T09:00:00Z'));
  assert.throws(() => proposedFacts('a1b2c3d4', '2026-10-12T09:00:00Z', '2026-10-12T07:00:00Z'));
});
