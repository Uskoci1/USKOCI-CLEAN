// Pure source-admission tests: no database, network or environment side effects.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readP2ExportPredecessorPlan } from './p2_data_export_predecessor.mjs';

const unit = JSON.parse(readFileSync('supabase/proofs/legal/p2_data_export_files.json', 'utf8'));

test('plan admits frozen live87 plus the ordered earlier pending stack and this unit', () => {
  const provenance = JSON.parse(readFileSync('supabase/migrations/MIGRATION_PROVENANCE.json', 'utf8'));
  const pending = provenance.pending_forward_migrations.map(entry => entry.file);
  const before = pending.slice(0, pending.indexOf(unit.forward_file));
  const plan = readP2ExportPredecessorPlan();
  assert.equal(plan.historical_predecessor_count, 87);
  assert.equal(plan.pending_predecessor_count, before.length);
  assert.equal(plan.source_migration_count, 87 + pending.length);
  assert.equal(plan.expected_predecessor_count, 87 + before.length);
  assert.deepEqual(plan.pending_predecessors.map(entry => entry.file), before);
  const after = pending.slice(pending.indexOf(unit.forward_file) + 1);
  assert.deepEqual(plan.pending_successors.map(entry => entry.file), after);
  assert.equal(plan.pending_successor_count, after.length);
  assert.equal(plan.source_migration_count, plan.expected_predecessor_count + 1 + after.length);
});

test('candidate and forward bytes are identical and match the manifest digests', () => {
  const forward = readFileSync(`supabase/migrations/${unit.forward_file}`);
  assert.deepEqual(forward, readFileSync(unit.candidate_file));
  assert.equal(forward.length, unit.bytes);
  assert.equal(createHash('md5').update(forward).digest('hex'), unit.md5);
  assert.equal(createHash('sha256').update(forward).digest('hex'), unit.sha256);
  assert.ok(!forward.includes(13), 'forward file must be LF only');
});

test('forward file seeds nothing, closes the table and never claims an artifact', () => {
  const text = readFileSync(`supabase/migrations/${unit.forward_file}`, 'utf8');
  const outsideFunctions = text.replace(/\$function\$[\s\S]*?\$function\$/g, '');
  assert.ok(!/insert\s+into/i.test(outsideFunctions), 'migration must not seed rows');
  assert.ok(text.includes('alter table public.data_export_requests enable row level security;'));
  assert.ok(text.includes('alter table public.data_export_requests force row level security;'));
  assert.ok(text.includes('revoke all on table public.data_export_requests from public, anon, authenticated;'));
  for (const fn of ['rpc_get_data_export_status()', 'rpc_request_data_export(text)', 'rpc_cancel_data_export(uuid)']) {
    assert.ok(text.includes(`revoke all on function public.${fn} from public, anon, service_role;`), `${fn} revoke`);
    assert.ok(text.includes(`grant execute on function public.${fn} to authenticated;`), `${fn} grant`);
  }
  assert.ok(text.includes("'downloadAvailable',false"), 'download must never be claimed');
  assert.ok(!text.includes("'downloadAvailable',true"));
  assert.ok(text.includes("'externalDsrChannelReady',false"));
  assert.ok(!/create\s+function\s+[a-z_.]*export_(generate|build|deliver|artifact)/i.test(text), 'no artifact generator');
  assert.ok(text.includes('pg_advisory_xact_lock'), 'per-account race must be serialized');
  assert.ok(text.includes('data_export_one_open_request_uq'), 'one open request per account');
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

for (const mutation of ['changed-source','wrong-checksum','marked-live','wrong-order']) {
  test(`refuses a declared successor with ${mutation} before any database operation`, () => {
    const root = mkdtempSync(join(tmpdir(), 'p2-admission-'));
    try {
      cpSync('supabase',join(root,'supabase'),{recursive:true});
      const file=join(root,'supabase/migrations/MIGRATION_PROVENANCE.json');
      const provenance=JSON.parse(readFileSync(file,'utf8'));
      const suffix=provenance.pending_forward_migrations.filter(entry => entry.version>unit.forward_version);
      assert.ok(suffix.length, 'this integration test requires its admitted later unit');
      const next=suffix[0];
      if(mutation==='changed-source') writeFileSync(join(root,'supabase/migrations',next.file),'-- altered SQL');
      if(mutation==='wrong-checksum') next.raw_md5='0'.repeat(32);
      if(mutation==='marked-live') next.live_applied=true;
      if(mutation==='wrong-order') next.version=unit.forward_version;
      writeFileSync(file,JSON.stringify(provenance));
      assert.throws(() => readP2ExportPredecessorPlan(root), /PENDING_SUCCESSOR_/);
    } finally { rmSync(root,{recursive:true,force:true}); }
  });
}
