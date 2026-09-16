#!/usr/bin/env node
/**
 * USKOCI isolated mass-user / chaos harness.
 *
 * Phase 1 intentionally proves the foundation before full marketplace journeys:
 * - provisions real Supabase Auth users on a NON-CANONICAL target only;
 * - authenticates every synthetic user through the ordinary password grant;
 * - runs all product reads with that user's JWT (never the service role);
 * - verifies own-profile scope and hostile cross-account reads;
 * - generates concurrent read pressure and latency percentiles;
 * - optionally hard-deletes the synthetic users and checks for residue.
 *
 * The service-role key is used only for test-user provisioning, cleanup and the
 * final residue check. It is never used for a simulated product action.
 *
 * This script NEVER calls a real AI provider. Provider/load testing is a separate,
 * bounded canary layer so thousands of users cannot burn provider budget.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

const CANONICAL_REF = 'leqcwgzvjsxugfgzdmth';
const CANONICAL_URL = `https://${CANONICAL_REF}.supabase.co`;
const url = String(process.env.MASS_TARGET_URL ?? '').replace(/\/+$/, '');
const publishable = process.env.MASS_PUBLISHABLE_KEY ?? '';
const serviceRole = process.env.MASS_SERVICE_ROLE_KEY ?? '';
const usersRequested = numberEnv('MASS_USERS', 20, 2, 5000);
const concurrency = numberEnv('MASS_CONCURRENCY', Math.min(20, usersRequested), 1, 250);
const readsPerUser = numberEnv('MASS_READS_PER_USER', 4, 1, 100);
const workerRatio = floatEnv('MASS_WORKER_RATIO', 0.70, 0, 1);
const keepData = process.env.MASS_KEEP_DATA === '1';
const out = resolve(process.env.MASS_OUT ?? 'artifacts/mass-user-chaos');
const runId = process.env.MASS_RUN_ID ?? `${Date.now()}-${randomUUID().slice(0, 8)}`;

if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) fail('MASS_TARGET_INVALID');
if (url === CANONICAL_URL || url.includes(CANONICAL_REF)) fail('MASS_CANONICAL_TARGET_REFUSED');
if (!publishable || !serviceRole) fail('MASS_CREDENTIALS_MISSING');

mkdirSync(out, { recursive: true });

const report = {
  schemaVersion: 1,
  unit: 'USKOCI_MASS_USER_CHAOS_PHASE1',
  runId,
  startedAt: new Date().toISOString(),
  target: url,
  canonicalTargetRefused: true,
  serviceRoleUsedForProductActions: false,
  realAiProviderCalls: 0,
  config: { usersRequested, concurrency, readsPerUser, workerRatio, keepData },
  provisioning: { created: 0, failed: 0 },
  authentication: { passed: 0, failed: 0 },
  scope: { ownReads: 0, ownReadFailures: 0, hostileReads: 0, crossAccountLeaks: 0 },
  pressure: { operations: 0, failures: 0, latencyMs: {} },
  cleanup: { attempted: false, deleted: 0, failed: 0, profileResidue: null },
  failures: [],
  result: 'RUNNING',
};

const synthetic = [];
const latency = [];

function fail(code) {
  console.error(code);
  process.exit(2);
}
function numberEnv(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) fail(`${name}_INVALID`);
  return value;
}
function floatEnv(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) fail(`${name}_INVALID`);
  return value;
}
function password() {
  // Never logged or written to the report.
  return `T9!${randomBytes(24).toString('base64url')}aZ`;
}
function email(index) {
  return `mass.${runId}.${String(index).padStart(5, '0')}@example.invalid`;
}
function headers(key, token = null, body = false) {
  return {
    apikey: key,
    ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${key}` }),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  };
}
async function request(path, init = {}, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const started = performance.now();
  try {
    const response = await fetch(url + path, { ...init, redirect: 'error', signal: controller.signal });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 300) }; }
    return { ok: response.ok, status: response.status, body, ms: performance.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
function safeError(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/eyJ[A-Za-z0-9._-]{20,}/g, '<jwt>').slice(0, 500);
}
function recordFailure(stage, index, error) {
  if (report.failures.length < 100) report.failures.push({ stage, index, error: safeError(error) });
}
async function pool(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function provisionOne(index) {
  const role = index / usersRequested < workerRatio ? 'WORKER' : 'REQUESTER';
  const user = { index, role, email: email(index), password: password(), accountId: null, token: null, profileIds: [] };
  const result = await request('/auth/v1/admin/users', {
    method: 'POST',
    headers: headers(serviceRole, null, true),
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { uskoci_mass_test: true, mass_test_run_id: runId, mass_test_role: role },
    }),
  });
  if (!result.ok || !result.body?.id) throw new Error(`ADMIN_CREATE_${result.status}`);
  user.accountId = result.body.id;
  synthetic.push(user);
  report.provisioning.created += 1;
}

async function loginOne(user) {
  const result = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: headers(publishable, null, true),
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!result.ok || !result.body?.access_token || result.body?.user?.id !== user.accountId) {
    throw new Error(`PASSWORD_GRANT_${result.status}`);
  }
  user.token = result.body.access_token;
  const me = await request('/auth/v1/user', { headers: headers(publishable, user.token) });
  if (!me.ok || me.body?.id !== user.accountId || me.body?.role !== 'authenticated') {
    throw new Error(`AUTH_USER_${me.status}`);
  }
  report.authentication.passed += 1;
}

async function readOwnProfiles(user) {
  const query = `/rest/v1/app_profiles?select=id,account_id,kind&account_id=eq.${encodeURIComponent(user.accountId)}`;
  const result = await request(query, { headers: headers(publishable, user.token) });
  latency.push(result.ms);
  report.scope.ownReads += 1;
  if (!result.ok || !Array.isArray(result.body)) throw new Error(`OWN_PROFILE_READ_${result.status}`);
  if (result.body.some(row => row.account_id !== user.accountId)) throw new Error('OWN_PROFILE_SCOPE_VIOLATION');
  user.profileIds = result.body.map(row => row.id).filter(Boolean);
  return result.body;
}

async function hostileCrossAccountRead(user, victim) {
  const query = `/rest/v1/app_profiles?select=id,account_id,kind&account_id=eq.${encodeURIComponent(victim.accountId)}`;
  const result = await request(query, { headers: headers(publishable, user.token) });
  latency.push(result.ms);
  report.scope.hostileReads += 1;
  if (!result.ok) throw new Error(`HOSTILE_PROFILE_READ_${result.status}`);
  if (!Array.isArray(result.body)) throw new Error('HOSTILE_PROFILE_INVALID_BODY');
  if (result.body.length !== 0) {
    report.scope.crossAccountLeaks += result.body.length;
    throw new Error(`CROSS_ACCOUNT_PROFILE_LEAK_${result.body.length}`);
  }
}

async function pressureRead(user, iteration) {
  // This is the same private table/read boundary used by the product's own-profile service.
  const result = await request(
    `/rest/v1/app_profiles?select=id,account_id,kind,profile_status&account_id=eq.${encodeURIComponent(user.accountId)}`,
    { headers: headers(publishable, user.token), headersTimeout: 0 },
  );
  latency.push(result.ms);
  report.pressure.operations += 1;
  if (!result.ok || !Array.isArray(result.body) || result.body.some(row => row.account_id !== user.accountId)) {
    report.pressure.failures += 1;
    throw new Error(`PRESSURE_READ_${iteration}_${result.status}`);
  }
}

async function deleteOne(user) {
  const result = await request(`/auth/v1/admin/users/${user.accountId}?should_soft_delete=false`, {
    method: 'DELETE', headers: headers(serviceRole),
  });
  if (!result.ok) throw new Error(`ADMIN_DELETE_${result.status}`);
  report.cleanup.deleted += 1;
}

async function countProfileResidue() {
  if (!synthetic.length) return 0;
  let residue = 0;
  for (let i = 0; i < synthetic.length; i += 100) {
    const ids = synthetic.slice(i, i + 100).map(user => user.accountId).filter(Boolean);
    const filter = `(${ids.join(',')})`;
    const result = await request(`/rest/v1/app_profiles?select=id,account_id&account_id=in.${encodeURIComponent(filter)}`, {
      headers: headers(serviceRole),
    });
    if (!result.ok || !Array.isArray(result.body)) throw new Error(`RESIDUE_READ_${result.status}`);
    residue += result.body.length;
  }
  return residue;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index] * 100) / 100;
}
function finalizeLatency() {
  report.pressure.latencyMs = {
    samples: latency.length,
    min: latency.length ? Math.round(Math.min(...latency) * 100) / 100 : null,
    p50: percentile(latency, 50),
    p95: percentile(latency, 95),
    p99: percentile(latency, 99),
    max: latency.length ? Math.round(Math.max(...latency) * 100) / 100 : null,
  };
}
function writeReport() {
  report.finishedAt = new Date().toISOString();
  finalizeLatency();
  writeFileSync(resolve(out, 'mass-user-chaos-report.json'), JSON.stringify(report, null, 2) + '\n');
}

try {
  const indexes = Array.from({ length: usersRequested }, (_, index) => index);
  await pool(indexes, concurrency, async index => {
    try { await provisionOne(index); }
    catch (error) { report.provisioning.failed += 1; recordFailure('provision', index, error); }
  });
  if (report.provisioning.failed || synthetic.length !== usersRequested) throw new Error('PROVISIONING_INCOMPLETE');

  await pool(synthetic, concurrency, async (user, index) => {
    try { await loginOne(user); }
    catch (error) { report.authentication.failed += 1; recordFailure('login', index, error); }
  });
  if (report.authentication.failed) throw new Error('AUTHENTICATION_INCOMPLETE');

  await pool(synthetic, concurrency, async (user, index) => {
    try { await readOwnProfiles(user); }
    catch (error) { report.scope.ownReadFailures += 1; recordFailure('own-profile', index, error); }
  });

  // Ring topology: every account tries to read the next account's private app_profiles rows.
  await pool(synthetic, concurrency, async (user, index) => {
    const victim = synthetic[(index + 1) % synthetic.length];
    try { await hostileCrossAccountRead(user, victim); }
    catch (error) { recordFailure('cross-account-read', index, error); }
  });

  const pressureOps = [];
  for (const user of synthetic) for (let i = 0; i < readsPerUser; i += 1) pressureOps.push({ user, i });
  await pool(pressureOps, concurrency, async ({ user, i }, index) => {
    try { await pressureRead(user, i); }
    catch (error) { recordFailure('pressure-read', index, error); }
  });

  const hardFailures = report.provisioning.failed + report.authentication.failed + report.scope.ownReadFailures
    + report.scope.crossAccountLeaks + report.pressure.failures;
  report.result = hardFailures === 0 ? 'PASS' : 'FAIL';
} catch (error) {
  recordFailure('fatal', -1, error);
  report.result = 'FAIL';
} finally {
  // Remove secrets from memory as far as JavaScript permits before cleanup reporting.
  for (const user of synthetic) { user.token = null; user.password = null; }
  if (!keepData && synthetic.length) {
    report.cleanup.attempted = true;
    await pool(synthetic, concurrency, async (user, index) => {
      try { await deleteOne(user); }
      catch (error) { report.cleanup.failed += 1; recordFailure('cleanup', index, error); }
    });
    try { report.cleanup.profileResidue = await countProfileResidue(); }
    catch (error) { recordFailure('residue-check', -1, error); report.cleanup.profileResidue = 'UNKNOWN'; }
    if (report.cleanup.failed || report.cleanup.profileResidue !== 0) report.result = 'FAIL';
  }
  writeReport();
  console.log(JSON.stringify({
    result: report.result,
    runId,
    users: report.provisioning.created,
    authenticated: report.authentication.passed,
    crossAccountLeaks: report.scope.crossAccountLeaks,
    pressureFailures: report.pressure.failures,
    p95Ms: report.pressure.latencyMs.p95 ?? null,
    cleanupResidue: report.cleanup.profileResidue,
    realAiProviderCalls: 0,
  }));
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}
