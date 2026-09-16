#!/usr/bin/env node
/**
 * Local disposable Auth/RLS pressure harness.
 * Creates real Auth users, signs each in with an ordinary password grant, checks
 * own app_profiles visibility, attacks the next account's private profile rows,
 * applies concurrent read pressure, then hard-deletes every synthetic account.
 * Localhost only. Zero AI/provider calls.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const users = Number(process.env.MASS_USERS ?? 100);
const concurrency = Number(process.env.MASS_CONCURRENCY ?? 25);
const readsPerUser = Number(process.env.MASS_READS_PER_USER ?? 5);
const outDir = resolve(process.env.MASS_OUT ?? '/tmp/mass-user-chaos');
const runId = process.env.MASS_RUN_ID ?? randomUUID();

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(url)) throw new Error('MASS_AUTH_LOCAL_ONLY');
if (!anonKey || !serviceKey) throw new Error('MASS_AUTH_KEYS_MISSING');
if (!Number.isInteger(users) || users < 2 || users > 1000) throw new Error('MASS_USERS_INVALID');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) throw new Error('MASS_CONCURRENCY_INVALID');
if (!Number.isInteger(readsPerUser) || readsPerUser < 1 || readsPerUser > 50) throw new Error('MASS_READS_INVALID');

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, opts);
const password = `Mass-${randomUUID()}-Aa1!`;
const actors = Array.from({ length: users }, (_, index) => ({ index }));
const latency = [];
const failures = [];
let ownRows = 0, hostileReads = 0, leaks = 0, pressureOps = 0;

function p(values, n) {
  const a = [...values].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.ceil(a.length * n / 100) - 1))] ?? null;
}
function chunks(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}
async function timed(fn) {
  const start = performance.now();
  try { return await fn(); } finally { latency.push(Math.round((performance.now() - start) * 100) / 100); }
}
async function pool(items, limit, fn) {
  let cursor = 0;
  async function runner() {
    while (true) {
      const i = cursor++; if (i >= items.length) return;
      try { await fn(items[i], i); } catch (error) { failures.push({ i, message: error instanceof Error ? error.message : String(error) }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
}

await pool(actors, concurrency, async actor => {
  const email = `mass.local.${runId}.${actor.index}@proof.invalid`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { mass_run_id: runId } });
  if (created.error || !created.data.user?.id) throw new Error(`CREATE:${created.error?.message ?? 'missing'}`);
  actor.accountId = created.data.user.id;
  actor.client = createClient(url, anonKey, opts);
  const login = await timed(() => actor.client.auth.signInWithPassword({ email, password }));
  if (login.error || login.data.user?.id !== actor.accountId || !login.data.session) throw new Error(`LOGIN:${login.error?.message ?? 'identity'}`);
  const me = await timed(() => actor.client.auth.getUser());
  if (me.error || me.data.user?.id !== actor.accountId) throw new Error('GET_USER_IDENTITY');
});
if (failures.length) throw new Error(`MASS_AUTH_PROVISION_LOGIN_FAILED:${failures.length}`);
console.log(`MASS_STAGE auth users=${actors.length}`);

await pool(actors, concurrency, async actor => {
  const own = await timed(() => actor.client.from('app_profiles').select('id,account_id,kind').eq('account_id', actor.accountId));
  if (own.error || !Array.isArray(own.data)) throw new Error(`OWN_READ:${own.error?.message ?? 'invalid'}`);
  if (own.data.some(row => row.account_id !== actor.accountId)) throw new Error('OWN_SCOPE_LEAK');
  assert.ok(own.data.length >= 1, 'OWN_PROFILE_MISSING');
  ownRows += own.data.length;
});
if (failures.length) throw new Error(`MASS_AUTH_OWN_READ_FAILED:${failures.length}`);

await pool(actors, concurrency, async (actor, index) => {
  const victim = actors[(index + 1) % actors.length];
  const hostile = await timed(() => actor.client.from('app_profiles').select('id,account_id,kind').eq('account_id', victim.accountId));
  hostileReads += 1;
  if (hostile.error || !Array.isArray(hostile.data)) throw new Error(`HOSTILE_READ:${hostile.error?.message ?? 'invalid'}`);
  if (hostile.data.length) { leaks += hostile.data.length; throw new Error(`CROSS_ACCOUNT_LEAK:${hostile.data.length}`); }
});
if (failures.length || leaks) throw new Error(`MASS_AUTH_RLS_FAILED failures=${failures.length} leaks=${leaks}`);
console.log(`MASS_STAGE rls hostile_reads=${hostileReads} leaks=${leaks}`);

const pressure = [];
for (const actor of actors) for (let i = 0; i < readsPerUser; i++) pressure.push({ actor, i });
await pool(pressure, concurrency, async ({ actor }) => {
  const result = await timed(() => actor.client.from('app_profiles').select('id,account_id,kind,profile_status').eq('account_id', actor.accountId));
  pressureOps += 1;
  if (result.error || !Array.isArray(result.data) || result.data.some(row => row.account_id !== actor.accountId)) throw new Error('PRESSURE_SCOPE_FAILURE');
});
if (failures.length) throw new Error(`MASS_AUTH_PRESSURE_FAILED:${failures.length}`);
console.log(`MASS_STAGE pressure ops=${pressureOps} failures=0`);

await pool(actors, concurrency, async actor => {
  const deleted = await admin.auth.admin.deleteUser(actor.accountId, false);
  if (deleted.error) throw new Error(`DELETE:${deleted.error.message}`);
});
if (failures.length) throw new Error(`MASS_AUTH_CLEANUP_FAILED:${failures.length}`);

// Never build a single giant PostgREST `in(...)` URL for hundreds/thousands of
// UUIDs. Bounded batches keep the residue assertion about database state rather
// than HTTP request-line length.
let cleanupProfileResidue = 0;
const ids = actors.map(a => a.accountId);
for (const batch of chunks(ids, 50)) {
  const residue = await admin.from('app_profiles').select('id,account_id').in('account_id', batch);
  if (residue.error) throw new Error(`RESIDUE_READ:${residue.error.message}`);
  cleanupProfileResidue += residue.data.length;
}
assert.equal(cleanupProfileResidue, 0, 'PROFILE_RESIDUE');
console.log(`MASS_STAGE cleanup residue=${cleanupProfileResidue}`);

const report = {
  unit: 'MASS_AUTH_RLS_LOCAL', result: 'PASS', disposableLocalOnly: true, providerCalled: false,
  users, concurrency, readsPerUser, ownRows, hostileReads, crossAccountLeaks: leaks,
  pressureOps, pressureFailures: 0, cleanupProfileResidue,
  latencyMs: { samples: latency.length, min: Math.min(...latency), p50: p(latency, 50), p95: p(latency, 95), p99: p(latency, 99), max: Math.max(...latency) },
  createdAt: new Date().toISOString(),
};
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'mass-auth-rls-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS MASS_AUTH_RLS_LOCAL users=${users} hostile_reads=${hostileReads} leaks=0 pressure_ops=${pressureOps} cleanup_residue=${cleanupProfileResidue} provider_calls=0 p95_ms=${report.latencyMs.p95}`);
