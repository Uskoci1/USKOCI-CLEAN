// Run the actual W05 read adapters against the existing disposable Auth/Need fixture.
// This is Node adapter/RLS proof, not Hermes/native UI proof. It makes no business write.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, posix } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../supabase/proofs/ru5_device_ui_local_guard.mjs';

const modules = ['contracts/workerCapacity', 'data/supabaseIzvor', 'data/needClientService', 'data/publicProfileClientService',
  'data/calendarErrors', 'data/legacyRpcFailure', 'data/serverReceipt', 'data/needDetailPresentation', 'lib/capabilityTerms',
  'lib/calendarTime', 'lib/market', 'lib/location', 'ui/calendar/calendarPresentation'];
export function readSourceAdapters(sourceRoot, worker, workerId, trace = []) {
  const source = Object.fromEntries(modules.map(name => [name, readFileSync(join(sourceRoot, 'src', name + '.ts'), 'utf8')]));
  const cache = new Map();
  const load = name => {
    assert.ok(modules.includes(name), 'W05_PROBE_UNKNOWN_SOURCE_MODULE');
    if (cache.has(name)) return cache.get(name);
    const exports = {}; cache.set(name, exports);
    const javascript = ts.transpileModule(source[name], { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: name + '.ts' }).outputText;
    const require = dependency => {
      const target = posix.normalize(posix.join(posix.dirname(name), dependency));
      if (target === 'data/supabaseClient') return { supabaseKlijent: () => worker };
      if (target === 'store/sesija') return { sesijaSada: () => ({ user: { id: workerId }, accountRevision: 1, sessionEpoch: 1 }) };
      return load(target);
    };
    vm.runInNewContext(javascript, { exports, require, setTimeout, clearTimeout, AbortController, Intl,
      console: { error: () => trace.push({ sourceDiagnostic: 'SUPPRESSED_SAFE_SOURCE_ERROR' }) } }, { filename: name + '.ts', timeout: 1000 });
    return exports;
  };
  return { baseline: load('data/supabaseIzvor').supabaseIzvor, needService: load('data/needClientService').needClientService,
    sources: modules.map(name => ({ path: 'src/' + name + '.ts', sha256: createHash('sha256').update(source[name]).digest('hex') })) };
}
export function assertReadProbeRequest(input, init = {}) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert.equal(url.origin, 'http://127.0.0.1:54321', 'W05_PROBE_REQUEST_NOT_LOCAL');
  assert.ok(!url.username && !url.password && !url.hash, 'W05_PROBE_REQUEST_INVALID');
  const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const allowed = {
    '/auth/v1/token': ['POST'],
    '/auth/v1/user': ['GET'],
    '/rest/v1/needs': ['GET'],
    '/rest/v1/app_profiles': ['GET'],
    '/rest/v1/rpc/rpc_get_public_profile': ['POST'],
  };
  assert.ok(allowed[url.pathname]?.includes(method), 'W05_PROBE_READ_ONLY_BOUNDARY');
  if (url.pathname === '/auth/v1/token') assert.equal(url.searchParams.get('grant_type'), 'password');
  return { method, path: url.pathname };
}

async function main() {
  const env = process.env;
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  assert.equal(env.RU5_DEVICE_PACKAGE, 'rs.uskoci.n04proof');
  assert.equal(env.RU5_DEVICE_PROOF_DIR, '/tmp/uskoci-ru5-device-ui');
  const uuid = value => {
    assert.equal(typeof value, 'string');
    assert.equal(value.length, 36);
    assert.match(String(value), /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
    return value;
  };
  const needId = uuid(env.RU5_DEVICE_NEED_ID), workerId = uuid(env.RU5_DEVICE_WORKER_USER_ID);
  const sourceRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const trace = [];
  const nativeFetch = globalThis.fetch;
  const worker = createClient(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const safe = assertReadProbeRequest(input, init);
      const response = await nativeFetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) });
      let errorCode = null;
      if (!response.ok) {
        const body = await response.clone().json().catch(() => null);
        if (typeof body?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(body.code)) errorCode = body.code;
      }
      trace.push({ ...safe, status: response.status, errorCode });
      return response;
    } },
  });
  const login = await worker.auth.signInWithPassword({ email: env.RU5_DEVICE_WORKER_EMAIL, password: env.RU5_DEVICE_PASSWORD });
  assert.equal(login.error, null, 'W05_PROBE_LOCAL_WORKER_AUTH_FAILED');
  assert.equal(login.data.user?.id, workerId);
  const sql = query => execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const countQuery = `select jsonb_build_object('needs',(select count(*) from public.needs),
    'responses',(select count(*) from public.marketplace_responses),'selections',(select count(*) from public.need_selections),
    'agreements',(select count(*) from public.agreements),'history',(select count(*) from supabase_migrations.schema_migrations),
    'bundles',(select count(*) from private.publication_policy_bundles),'decisions',(select count(*) from private.need_publication_decisions))`;
  const before = sql(countQuery);
  const { baseline, needService, sources } = readSourceAdapters(sourceRoot, worker, workerId, trace);
  const reads = [['prilika', () => baseline.prilika(needId)], ['potreba', () => needService.potreba(needId)],
    ['mojRadnikProfil', () => baseline.mojRadnikProfil()]];
  const observations = await Promise.all(reads.map(async ([operation, run]) => {
    try {
      const data = await run();
      assert.ok(data, 'W05_PROBE_REQUIRED_PROJECTION_ABSENT');
      if (operation === 'mojRadnikProfil') assert.equal(data.stanje, 'ACTIVE');
      else {
        assert.equal(data.id, needId);
        assert.ok(Number.isSafeInteger(data.pokrivenost.ukupno) && data.pokrivenost.ukupno > 0);
        if (operation === 'potreba') assert.ok(Number.isSafeInteger(data.revizija) && data.revizija > 0);
      }
      return { operation, result: 'PASS' };
    } catch (error) {
      return { operation, result: 'FAIL', errorType: error?.constructor?.name === 'Error' ? 'Error' : 'OTHER',
        // No raw SQL/server error message, response object, user content or token.
        messageCategory: /^[A-Z0-9_]{1,80}$/.test(error?.message || '') ? error.message : 'READ_OR_PROJECTION_FAILED' };
    }
  }));
  const after = sql(countQuery);
  const report = { observedAt: new Date().toISOString(), sourceSha: env.GITHUB_SHA, localOnly: true, liveAccess: false,
    boundary: env.RU5_DEVICE_CORE106 === '1'
      ? 'actual source adapters / real local Auth and PostgREST / exact106 synthetic published precondition / no business write'
      : 'actual source adapters / real local Auth and PostgREST / pre-N04 original published fixture / no business write',
    sources,
    observations, trace, countsUnchanged: before === after, counts: JSON.parse(after),
    result: observations.every(item => item.result === 'PASS') && before === after ? 'PASS' : 'FAIL' };
  writeFileSync(join(env.RU5_DEVICE_ARTIFACT_DIR, 'w05-source-read-preflight.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  assert.equal(report.result, 'PASS', 'W05_ACTUAL_SOURCE_READS_FAILED');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
