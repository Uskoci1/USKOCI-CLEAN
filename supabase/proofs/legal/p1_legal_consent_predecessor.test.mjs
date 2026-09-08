// Pure source-admission tests: no database, network or environment side effects.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readP1LegalPredecessorPlan } from './p1_legal_consent_predecessor.mjs';

const unit = JSON.parse(readFileSync('supabase/proofs/legal/p1_legal_consent_files.json', 'utf8'));
const md5 = bytes => createHash('md5').update(bytes).digest('hex');

test('plan admits frozen live87 plus the ordered earlier pending stack and P1', () => {
  const plan = readP1LegalPredecessorPlan();
  assert.equal(plan.historical_predecessor_count, 87);
  assert.equal(plan.pending_predecessor_count, 1);
  assert.equal(plan.source_migration_count, 89);
  assert.equal(plan.expected_predecessor_count, 88);
  assert.deepEqual(plan.pending_predecessors.map(entry => entry.file), [
    '20260908120000_clean_p0e_completion_guards.sql',
  ]);
  assert.equal(plan.source_inventory.at(-1).file, unit.forward_file);
});

test('candidate and forward bytes are identical and match the manifest digests', () => {
  const forward = readFileSync(`supabase/migrations/${unit.forward_file}`);
  const candidate = readFileSync(unit.candidate_file);
  assert.deepEqual(forward, candidate);
  assert.equal(forward.length, unit.bytes);
  assert.equal(md5(forward), unit.md5);
  assert.equal(createHash('sha256').update(forward).digest('hex'), unit.sha256);
  assert.ok(!forward.includes(13), 'forward file must be LF only');
});

test('forward file seeds no legal document and closes both tables to client roles', () => {
  const text = readFileSync(`supabase/migrations/${unit.forward_file}`, 'utf8');
  assert.ok(!/insert\s+into\s+private\.legal_document_versions/i.test(text), 'migration must not seed legal documents');
  for (const table of ['private.legal_document_versions', 'public.account_legal_acceptance_events']) {
    assert.ok(text.includes(`alter table ${table} enable row level security;`), `${table} rls`);
    assert.ok(text.includes(`alter table ${table} force row level security;`), `${table} force rls`);
    assert.ok(text.includes(`revoke all on table ${table} from public, anon, authenticated;`), `${table} revoke`);
  }
  assert.ok(text.includes('grant execute on function public.rpc_get_legal_bundle() to anon, authenticated;'));
  assert.ok(text.includes('grant execute on function public.rpc_accept_legal_bundle(text) to authenticated;'));
  assert.ok(text.includes("revoke all on function public.rpc_accept_legal_bundle(text) from public, anon, service_role;"));
  assert.ok(text.includes('pg_advisory_xact_lock'), 'same-key race must be serialized');
  assert.ok(!text.includes('r24_require_user'), 'donor helper must be rebound');
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
