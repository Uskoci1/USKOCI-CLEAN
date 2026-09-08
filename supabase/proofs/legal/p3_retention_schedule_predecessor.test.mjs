// Pure source-admission tests: no database, network or environment side effects.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readP3RetentionPredecessorPlan } from './p3_retention_schedule_predecessor.mjs';

const unit = JSON.parse(readFileSync('supabase/proofs/legal/p3_retention_schedule_files.json', 'utf8'));

test('plan admits frozen live87 plus the ordered earlier pending stack and this unit', () => {
  const provenance = JSON.parse(readFileSync('supabase/migrations/MIGRATION_PROVENANCE.json', 'utf8'));
  const pending = provenance.pending_forward_migrations.map(entry => entry.file);
  const before = pending.slice(0, pending.indexOf(unit.forward_file));
  const plan = readP3RetentionPredecessorPlan();
  assert.equal(plan.historical_predecessor_count, 87);
  assert.equal(plan.pending_predecessor_count, before.length);
  assert.equal(plan.source_migration_count, 87 + pending.length);
  assert.equal(plan.expected_predecessor_count, 87 + before.length);
  assert.deepEqual(plan.pending_predecessors.map(entry => entry.file), before);
  assert.equal(plan.proof_scope, 'HISTORICAL_PLUS_UNIT_PREFIX');
  assert.equal(plan.expected_post_unit_count, plan.expected_predecessor_count + 1);
  assert.deepEqual(plan.unapplied_successors.map(entry => entry.file), pending.slice(pending.indexOf(unit.forward_file) + 1));
  assert.equal(plan.source_migration_count, plan.expected_post_unit_count + plan.unapplied_successors.length);
});

test('candidate and forward bytes are identical and match the manifest digests', () => {
  const forward = readFileSync(`supabase/migrations/${unit.forward_file}`);
  assert.deepEqual(forward, readFileSync(unit.candidate_file));
  assert.equal(forward.length, unit.bytes);
  assert.equal(createHash('md5').update(forward).digest('hex'), unit.md5);
  assert.equal(createHash('sha256').update(forward).digest('hex'), unit.sha256);
  assert.ok(!forward.includes(13), 'forward file must be LF only');
});

test('forward file seeds only the technical data-class inventory and admits no schedule or purge', () => {
  const text = readFileSync(`supabase/migrations/${unit.forward_file}`, 'utf8');
  const outsideFunctions = text.replace(/\$function\$[\s\S]*?\$function\$/g, '');
  assert.ok(!/insert\s+into\s+private\.retention_policy_(sets|rules)/i.test(outsideFunctions), 'migration must not seed a retention schedule');
  const seeds = [...outsideFunctions.matchAll(/^\s*\('([A-Z_]+)','[^']+',true,true\)/gm)].map(m => m[1]);
  assert.equal(seeds.length, 14);
  assert.deepEqual(seeds.slice().sort(), unit.seeded_data_classes.slice().sort());
  for (const absent of ['REVIEWS_REPUTATION', 'SAFETY_SUPPORT', 'COMPLAINT_EVIDENCE', 'ORGANIZATION_DATA']) {
    assert.ok(!seeds.includes(absent), `${absent} has no CLEAN surface yet and must not be seeded`);
  }
  for (const table of ['private.retention_data_classes', 'private.retention_policy_sets', 'private.retention_policy_rules']) {
    assert.ok(text.includes(`alter table ${table} enable row level security;`), `${table} rls`);
    assert.ok(text.includes(`alter table ${table} force row level security;`), `${table} force rls`);
    assert.ok(text.includes(`revoke all on table ${table} from public, anon, authenticated;`), `${table} revoke`);
  }
  assert.ok(text.includes('grant execute on function public.rpc_get_retention_policy_status() to authenticated;'));
  assert.ok(text.includes('grant execute on function public.rpc_publish_retention_policy(text,text,timestamptz,jsonb) to service_role;'));
  assert.ok(text.includes("revoke all on function public.rpc_publish_retention_policy(text,text,timestamptz,jsonb) from public, anon, authenticated;"));
  assert.ok(text.includes("'executionAdmitted',false"), 'execution must not be admitted');
  assert.ok(!text.includes("'executionAdmitted',true"));
  assert.ok(!/create\s+function\s+[a-z_.]*\b(purge|erase|retention_run|retention_apply)/i.test(text), 'no purge worker');
  assert.ok(text.includes('pg_advisory_xact_lock'), 'publication must be serialized');
  assert.ok(text.includes('data_class_code'), 'publisher ambiguity repair must be folded in');
  assert.ok(!text.includes('r24_require_user') && !text.includes('clock_timestamp'), 'donor helpers must be rebound');
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
