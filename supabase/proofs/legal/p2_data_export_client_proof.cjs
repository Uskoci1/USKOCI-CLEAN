'use strict';
/** Actual TS client and receipt decoder -> SDK -> local PostgREST -> RLS/RPC.
 * Only the RN singleton/account-store bindings are supplied by this Node runner.
 * No network response is mocked and no SQL is used by this connected-client path.
 * The enclosing workflow owns the explicitly disposable SQL/Auth fixture setup.
 */
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const env = process.env;
  const { assertLocalDeviceProofTargets } = await import('../ru5_device_ui_local_guard.mjs');
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  const report = { source_sha: env.GITHUB_SHA ?? null, result: 'RUNNING', checks: [],
    live_access: false, live_promotion: false, export_artifact_generated: false,
    ui_proven: false, mocked_rpc_responses: false, client_path_sql_writes: false,
    boundary: 'ACTUAL_TYPESCRIPT_CLIENT_AND_SDK_ON_EXISTING_DISPOSABLE_AUTH_POSTGREST_FIXTURES' };
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const clients = [];
  function bind(client, user) {
    const state = { user, accountRevision: 1 };
    const cache = new Map();
    const allowed = new Set(['src/data/dataExportClientService.ts', 'src/data/serverReceipt.ts']);
    const load = filename => {
      assert.ok(allowed.has(filename), 'Unsupported proof module');
      if (cache.has(filename)) return cache.get(filename).exports;
      const source = readFileSync(filename, 'utf8');
      report.input_sha256[filename] = createHash('sha256').update(source).digest('hex');
      const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022 } }).outputText;
      const module = { exports: {} }; cache.set(filename, module);
      const binding = name => {
        if (name === './supabaseClient') return { supabaseKlijent: () => client };
        if (name === '../store/sesija') return { sesijaSada: () => state };
        if (name === './serverReceipt') return load('src/data/serverReceipt.ts');
        throw new Error('Unexpected runtime dependency in admitted proof modules');
      };
      new Function('require', 'module', 'exports', code)(binding, module, module.exports);
      return module.exports;
    };
    return { service: load('src/data/dataExportClientService.ts').dataExportClientService, state };
  }
  const expectOk = result => { assert.equal(result.ok, true, 'Client did not accept its real server receipt'); return result.podatak; };
  let stage = 'AUTH_BINDING';
  report.input_sha256 = {};
  try {
    const actors = [];
    for (const [email, expectedId] of [[env.RU5_DEVICE_WORKER_EMAIL, env.RU5_DEVICE_WORKER_USER_ID],
      [env.RU5_DEVICE_REQUESTER_EMAIL, env.RU5_DEVICE_REQUESTER_USER_ID]]) {
      const client = createClient(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_ANON_KEY, options); clients.push(client);
      const login = await client.auth.signInWithPassword({ email, password: env.RU5_DEVICE_PASSWORD });
      assert.equal(login.error, null, 'Isolated Auth refused fixture credentials');
      const verified = await client.auth.getUser(); assert.equal(verified.error, null);
      assert.equal(verified.data.user.id, expectedId);
      actors.push(bind(client, { id: expectedId }));
    }
    const [a, b] = actors;
    stage = 'REAL_STATUS_AND_REQUEST';
    const previous = expectOk(await a.service.readStatus());
    if (previous.request?.status === 'REQUESTED') expectOk(await a.service.cancelExport(previous.request.receiptId));
    const key = 'p2-connected-' + randomUUID();
    const receipt = expectOk(await a.service.requestExport(key));
    assert.equal(receipt.status, 'REQUESTED'); assert.equal(receipt.idempotentReplay, false);
    const status = expectOk(await a.service.readStatus());
    assert.equal(status.request.receiptId, receipt.receiptId); assert.equal(status.downloadAvailable, false);
    report.checks.push('Actual client creates and reads its owned request through the real SDK/RPC');
    stage = 'OTHER_ACCOUNT_ISOLATION';
    const otherStatus = expectOk(await b.service.readStatus());
    assert.notEqual(otherStatus.request?.receiptId, receipt.receiptId);
    assert.deepEqual(await b.service.cancelExport(receipt.receiptId), {
      ok: false, kod: 'DATA_EXPORT_REQUEST_NOT_FOUND', poruka: 'Zahtev nije pronađen.',
    });
    report.checks.push('Other authenticated client neither reads nor cancels the first account request');
    stage = 'REAL_IDEMPOTENT_REPLAY';
    const replay = expectOk(await a.service.requestExport(key));
    assert.equal(replay.receiptId, receipt.receiptId); assert.equal(replay.idempotentReplay, true);
    report.checks.push('Same-key real provider replay is decoded as replay, not a second request');
    stage = 'REAL_CANCEL_AND_STATUS';
    const cancelled = expectOk(await a.service.cancelExport(receipt.receiptId));
    assert.equal(cancelled.idempotentReplay, false); assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(expectOk(await a.service.cancelExport(receipt.receiptId)).idempotentReplay, true);
    assert.equal(expectOk(await a.service.readStatus()).request.status, 'CANCELLED');
    report.checks.push('Actual owner cancellation, cancellation replay and refreshed status agree');
    stage = 'SIGNED_OUT_CLIENT_BOUNDARY';
    a.state.user = null; a.state.accountRevision++;
    assert.equal((await a.service.readStatus()).kod, 'AUTH_REQUIRED');
    report.checks.push('Account-store logout removes access to the client path without a fabricated receipt');
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL'; report.failed_stage = stage;
    report.failure_category = error?.code === 'ERR_ASSERTION' ? 'ASSERTION' : 'CLIENT_TRANSPORT_OR_SETUP';
  } finally {
    for (const client of clients) await client.auth.stopAutoRefresh();
    const path = resolve(env.P2_ARTIFACT_DIR || 'artifacts/p2-data-export', 'client-proof-report.json');
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
    console.log(report.result + ' P2_CONNECTED_CLIENT');
    if (report.result !== 'PASS') process.exitCode = 1;
  }
}
main().catch(() => { console.error('P2_CONNECTED_CLIENT_SETUP_FAILED'); process.exitCode = 1; });
