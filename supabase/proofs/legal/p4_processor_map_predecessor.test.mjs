// Pure source-admission tests: no database, network or environment side effects.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readP4ProcessorPredecessorPlan } from './p4_processor_map_predecessor.mjs';

const unit = JSON.parse(readFileSync('supabase/proofs/legal/p4_processor_map_files.json', 'utf8'));

test('plan admits exactly the frozen live87 inventory plus one pending forward file', () => {
  const plan = readP4ProcessorPredecessorPlan();
  assert.equal(plan.historical_predecessor_count, 87);
  assert.equal(plan.source_migration_count, 88);
  assert.equal(plan.expected_predecessor_count, 87);
  assert.equal(plan.source_inventory.at(-1).file, unit.forward_file);
});

test('candidate and forward bytes are identical and match the manifest digests', () => {
  const forward = readFileSync(`supabase/migrations/${unit.forward_file}`);
  assert.deepEqual(forward, readFileSync(unit.candidate_file));
  assert.equal(forward.length, unit.bytes);
  assert.equal(createHash('md5').update(forward).digest('hex'), unit.md5);
  assert.equal(createHash('sha256').update(forward).digest('hex'), unit.sha256);
  assert.ok(!forward.includes(13), 'forward file must be LF only');
});

test('forward file seeds only the technical inventory and no legal map row', () => {
  const text = readFileSync(`supabase/migrations/${unit.forward_file}`, 'utf8');
  const outsideFunctions = text.replace(/\$function\$[\s\S]*?\$function\$/g, '');
  assert.ok(!/insert\s+into\s+private\.processor_map_(sets|entries)/i.test(outsideFunctions), 'migration must not seed a legal map');
  const seeds = [...text.matchAll(/^\s*\('([A-Z_]+)','[^']+',/gm)].map(m => m[1]);
  assert.deepEqual(seeds, ['SUPABASE_PLATFORM', 'OPENAI_AI', 'GOOGLE_GEMINI_AI', 'EXPO_PUSH']);
  assert.deepEqual(seeds.slice().sort(), unit.seeded_inventory.slice().sort());
  for (const table of ['private.processor_provider_inventory', 'private.processor_map_sets', 'private.processor_map_entries']) {
    assert.ok(text.includes(`alter table ${table} enable row level security;`), `${table} rls`);
    assert.ok(text.includes(`alter table ${table} force row level security;`), `${table} force rls`);
    assert.ok(text.includes(`revoke all on table ${table} from public, anon, authenticated;`), `${table} revoke`);
  }
  assert.ok(text.includes('grant execute on function public.rpc_get_processor_map_status() to authenticated;'));
  assert.ok(text.includes('grant execute on function public.rpc_publish_processor_map(text,text,timestamptz,jsonb) to service_role;'));
  assert.ok(text.includes("revoke all on function public.rpc_publish_processor_map(text,text,timestamptz,jsonb) from public, anon, authenticated;"));
  assert.ok(text.includes("'runtimeProviderGateAdmitted',false"), 'runtime gate must not be admitted');
  assert.ok(!text.includes("'runtimeProviderGateAdmitted',true"));
  assert.ok(text.includes('pg_advisory_xact_lock'), 'publication must be serialized');
  assert.ok(!text.includes('r24_require_user') && !text.includes('clock_timestamp'), 'donor helpers must be rebound');
  assert.ok(!/wjxilkkyyuxyzbvhgmop|uskoci-ai-transcribe|uskoci-push-dispatch/.test(text), 'donor project evidence must not leak into CLEAN inventory');
});

test('provenance declares the unit as pending and not live', () => {
  const provenance = JSON.parse(readFileSync('supabase/migrations/MIGRATION_PROVENANCE.json', 'utf8'));
  const pending = provenance.pending_forward_migrations.find(entry => entry.file === unit.forward_file);
  assert.ok(pending, 'pending entry missing');
  assert.equal(pending.classification, 'PENDING_FORWARD_MIGRATION');
  assert.equal(pending.live_applied, false);
  assert.equal(pending.raw_md5, unit.md5);
  assert.equal(pending.predecessor_live_migration_count, 87);
  assert.equal(pending.predecessor_live_head, '20260907135905');
});
