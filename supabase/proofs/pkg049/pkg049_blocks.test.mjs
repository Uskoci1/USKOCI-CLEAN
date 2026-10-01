// Dry runs of two blocks of pkg049_proof.mjs, cut out of the source text by markers and executed in a scope that names every free identifier they use (a typo cannot hide):
// (1) the P0 B24 stage loop (which stage SQL is sent for which function, which errors are tolerated, which fail the run) against a stub `sql`;
// (2) the P1b phase (direct PostgREST TABLE writes by a modified client) against the REAL supabase-js client with a MOCK fetch, together with the proof's OWN transport code (settle / resend / call / callTable):
//     every request of lib.DIRECT_WRITE_PLAN is built by the real client as the plan says (method, table, Prefer: return=representation, the filter that targets the row), the outcome evaluation, the surface
//     comparison and the report shape work, and a write that SUCCEEDS fails the phase by the attack's name (the report is recorded before the assertion).
// They prove NOTHING about a database: no database is involved, and the mock answers are the answers the plan EXPECTS. The first CI run is the first observation of the real outcomes.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as lib from './pkg049_lib.mjs';
import * as pins from './pkg049_pins.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const {createClient} = createRequire(root + 'package.json')('@supabase/supabase-js');
const proofText = readFileSync(fileURLToPath(new URL('./pkg049_proof.mjs', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const slice = (startMarker, endMarker) => { const start = proofText.indexOf(startMarker), end = proofText.indexOf(endMarker, start + 1); assert.ok(start >= 0 && end > start, 'markers found: ' + startMarker); return proofText.slice(start, end); };
const transport = slice('async function settle(', '/** SQLSTATEs of the refusals');
const stageLoop = slice('  const b24PriceChain = pins.b24PriceChainTargets();', '  report.stages.b24PriceChain = pins.summarizeB24Stages(b24Stages);');
const pt409Block = slice('    // (h) B24: a stale version or revision', '    report.stale.refusalTotals = refusals;');
const p1b = slice('  // =============================================================== P1b', '  // =============================================================== P2');
const verb = {update: 'PATCH', insert: 'POST', delete: 'DELETE'};

/** `mode` 'good' answers what the plan expects; 'wrong' lets the worker's PATCH of marketplace_responses WRITE (a modified client that succeeds). */
function mockFetch(mode, requests) {
  return async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url), method = (init.method ?? 'GET').toUpperCase(), table = url.pathname.split('/').pop(), rpc = url.pathname.includes('/rpc/');
    requests.push({method, table, rpc, query: url.search, prefer: new Headers(init.headers).get('prefer'), body: init.body ?? null});
    const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
    if (rpc) return json(200, table === 'rpc_select_response' ? 'agreement-id' : table === 'rpc_list_my_applications' ? [{applicationId: 'resp-1'}] : null);
    if (method === 'GET') return json(200, [{id: 'x', price_rsd: 1, requester_price_rsd: 3000, agreement_id: 'a', terms: {}}]);
    const write = method === 'POST' ? 'insert' : method === 'PATCH' ? 'update' : 'delete';
    if (mode === 'wrong' && table === 'marketplace_responses' && write === 'update') return json(200, [{id: 'r', price_rsd: 1}]);
    const denied = message => json(403, {code: '42501', message, details: null, hint: null});
    if (table === 'marketplace_responses' || table === 'marketplace_response_versions') return denied('permission denied for table ' + table);
    if (table === 'needs') return write === 'delete' ? denied('permission denied for table needs') : json(200, url.search.includes('draft-id') ? [{id: 'draft-id', requester_price_rsd: 3100}] : []);
    return write === 'insert' ? denied('new row violates row-level security policy for table "' + table + '"') : json(200, []);
  };
}

async function runP1b(mode) {
  const requests = [], report = {transientRetries: 0, directWrites: null}, passes = [];
  const make = () => createClient('http://127.0.0.1:54321', 'anon-key', {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}, global: {fetch: mockFetch(mode, requests)}});
  const uuid = () => crypto.randomUUID();
  const worker = {client: make(), id: uuid(), workerProfile: uuid()}, requester = {client: make(), id: uuid(), profile: uuid()};
  const provided = {
    lib, assert, report, DEADLINE_MS: 5000, sleep: ms => new Promise(resolve => setTimeout(resolve, ms)), randomUUID: uuid, worker, requester, q: value => "'" + value + "'",
    pass: name => passes.push(name), save: () => {},
    mustOk: (response, label) => { assert.equal(response.error, null, label); return response.data; },
    selectArgs: (need, receipt) => ({p_need_id: need, p_response_id: receipt.responseId}),
    newDraftNeed: () => 'draft-id',
    applyCanonical: async () => ({need: uuid(), receipt: {responseId: 'resp-1', needRevision: 1, version: 1, contentHash: 'a'.repeat(64)}, price: 6000}),
    fp: () => ({same: 1}),
    sql: query => /select id from public\.need_selections/.test(query) ? uuid() : /select requester_price_rsd from public\.needs/.test(query) ? '3100' : /jsonb_build_object/.test(query) ? JSON.stringify({counts: {responses: 2, selections: 1, agreements: 1}}) : '',
  };
  // a scope that resolves every free identifier of the cut-out code from `provided` or the globals, and FAILS NAMED on anything else: a typo in the block cannot hide
  const scope = new Proxy(provided, {has: () => true, get: (target, key) => { if (key === Symbol.unscopables) return undefined; if (key in target) return target[key]; if (key in globalThis) return globalThis[key]; throw new Error('FREE_IDENTIFIER_NOT_PROVIDED ' + String(key)); }});
  const run = new AsyncFunction('ctx', `with (ctx) { ${transport}\n  return (async () => { ${p1b} })(); }`);
  let error = null;
  try { await run(scope); } catch (caught) { error = caught; }
  return {requests, report, passes, error};
}

test('P1b dry run (real supabase-js, mock fetch): the 19 requests of the plan are built as the plan says, evaluated exactly, and the report has its shape', async () => {
  const {requests, report, passes, error} = await runP1b('good');
  assert.equal(error, null, String(error?.stack ?? error));
  assert.equal(passes.length, 1); assert.match(passes[0], /^P1B_18_DIRECT_TABLE_WRITES_BY_A_MODIFIED_CLIENT_REFUSED_OR_FILTERED_WITH_THE_PINNED_OUTCOME/);
  const rows = report.directWrites.rows;
  assert.equal(rows.length, 19); assert.deepEqual(rows.map(row => row.id), lib.DIRECT_WRITE_PLAN.map(item => item.id), 'in plan order, the positive control last');
  assert.ok(rows.every(row => row.problems.length === 0), JSON.stringify(rows.filter(row => row.problems.length)));
  assert.deepEqual(rows.filter(row => row.control).map(row => row.id), ['control_requester_update_draft_needs_price']);
  assert.ok(rows.filter(row => !row.control).every(row => row.surfaceIdentical === true)); assert.equal(rows.find(row => row.control).surfaceIdentical, null);
  assert.equal(report.directWrites.attacks, 18); assert.equal(report.directWrites.chainSpecificAttacks, 3);
  assert.deepEqual(Object.keys(report.directWrites.readControls).sort(), ['requesterReadsTheAgreementVersion', 'requesterReadsTheTask', 'workerReadsOwnApplication', 'workerReadsOwnResponseRow']);
  // what the real client sent: one write per plan item with the plan's method and table, every one asking for the representation (an RLS-filtered write then shows as an EMPTY array, never a bare 204)
  const writes = requests.filter(item => item.method !== 'GET' && !item.rpc);
  assert.deepEqual(writes.map(item => item.method + ' ' + item.table), lib.DIRECT_WRITE_PLAN.map(item => verb[item.op] + ' ' + item.table));
  assert.ok(writes.every(item => /return=representation/.test(item.prefer ?? '')));
  for (const item of writes.filter(entry => entry.method !== 'POST')) assert.match(item.query, /(?:id|response_id|agreement_id|need_id)=eq\./, 'an update or delete targets its row by a filter, never the whole table');
  const forged = Object.fromEntries(writes.filter(item => item.method === 'POST').map(item => [item.table, JSON.parse(item.body)]));
  assert.ok(forged.agreements.selection_id && forged.agreements.selected_response_id && forged.agreements.requester_account_id);
  assert.equal(forged.agreement_versions.terms.price_rsd, 1); assert.equal(forged.marketplace_response_versions.price_rsd, 1); assert.equal(forged.marketplace_responses.price_rsd, 1);
  assert.equal(JSON.parse(writes.find(item => item.table === 'needs' && item.method === 'PATCH' && /requester_price_rsd/.test(item.body)).body).requester_price_rsd, 1);
  assert.equal(requests.filter(item => item.method === 'GET').length, 3, 'three read controls through tables (the fourth goes through an RPC)');
});

test('P1b dry run: a write that SUCCEEDS fails the phase by the attack name, and the report already holds every row', async () => {
  const {report, passes, error} = await runP1b('wrong');
  assert.ok(error, 'a PATCH that writes must fail the phase'); assert.equal(passes.length, 0);
  assert.match(String(error.message), /^P1B_DIRECT_TABLE_WRITES/); assert.match(String(error.message), /worker_update_responses: expected a refusal, got success \(observed HTTP 200 1 row\(s\)\)/);
  assert.equal(report.directWrites?.rows?.length, 19, 'the rows are recorded BEFORE the assertion, so a failed run still reports what it observed');
  assert.ok(report.directWrites.rows.find(row => row.id === 'worker_update_responses').problems.length >= 1);
  assert.ok(report.directWrites.rows.filter(row => row.id !== 'worker_update_responses').every(row => row.problems.length === 0), 'the other rows are unaffected');
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// the P0 B24 stage loop
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const [STALE, CONFIRM] = pins.b24PriceChainTargets();
const psqlGuard = guard => `LOCAL_SQL:PROCESS_EXIT:status=3:psql:<stdin>:12: ERROR:  ${guard}: public.rpc_x(uuid)\nCONTEXT:  PL/pgSQL function inline_code_block line 12 at RAISE`;
/** Runs the proof's stage loop with the md5 each function carries and a `sql` that behaves as given (it receives the stage text and returns or throws). */
async function runStageLoop({md5, sql}) {
  const sent = [], reads = {[STALE.signature]: md5.stale, [CONFIRM.signature]: md5.confirm};
  const provided = {assert, pins, q: value => "'" + String(value).replaceAll("'", "''") + "'", readMd5: signature => reads[signature] ?? null, sql: text => { sent.push(text); return sql(text); }};
  const scope = new Proxy(provided, {has: () => true, get: (target, key) => { if (key === Symbol.unscopables) return undefined; if (key in target) return target[key]; if (key in globalThis) return globalThis[key]; throw new Error('FREE_IDENTIFIER_NOT_PROVIDED ' + String(key)); }});
  const run = new AsyncFunction('ctx', `with (ctx) { ${stageLoop}\n  return b24Stages; }`);
  try { return {stages: await run(scope), sent, error: null}; } catch (error) { return {stages: null, sent, error}; }
}
const onlyFor = (text, target) => text.includes(target.signature) && !text.includes((target === STALE ? CONFIRM : STALE).signature);

test('P0 stage loop: a body that already equals the DEV body needs nothing, a known pre-image is converted ONE TRANSACTION PER FUNCTION', async () => {
  const dev = await runStageLoop({md5: {stale: STALE.devMd5, confirm: CONFIRM.devMd5}, sql: () => assert.fail('nothing to send')});
  assert.equal(dev.error, null); assert.deepEqual(dev.sent, []); assert.deepEqual(dev.stages.map(stage => [stage.id, stage.applied, stage.status.split(' (')[0]]), [['stale_resolver', false, 'NOT NEEDED'], ['confirm_need_edit', false, 'NOT NEEDED']]);
  const pre = await runStageLoop({md5: {stale: STALE.preMd5, confirm: CONFIRM.preMd5}, sql: () => ''});
  assert.equal(pre.error, null); assert.equal(pre.sent.length, 2, 'one call per function');
  assert.ok(onlyFor(pre.sent[0], STALE) && onlyFor(pre.sent[1], CONFIRM), 'each call carries exactly its own function');
  assert.deepEqual(pre.stages.map(stage => [stage.id, stage.applied]), [['stale_resolver', true], ['confirm_need_edit', true]]);
  assert.match(pins.summarizeB24Stages(pre.stages), /^stale_resolver APPLIED \(d37c4f7c -> 96cb9aac; the derived md5 equalled the DEV md5 before anything was executed\); confirm_need_edit APPLIED \(dfa1a809 -> 450b6f8d;/);
  const mixed = await runStageLoop({md5: {stale: STALE.devMd5, confirm: CONFIRM.preMd5}, sql: () => ''});
  assert.equal(mixed.sent.length, 1); assert.ok(onlyFor(mixed.sent[0], CONFIRM)); assert.deepEqual(mixed.stages.map(stage => stage.applied), [false, true]);
});
/** Runs P4(h) with the md5 the stale resolver carries, whether a 40001 remains in its body, and the stage status recorded by P0. */
async function runPt409({md5, has40001, stage}) {
  const calls = {applyCanonical: 0, refusals: []}, report = {stale: {}, gaps: []};
  const provided = {assert, pins, report, SIG: Object.fromEntries(pins.PINS.map(pin => [pin.id, pin.signature])), flag: value => value === 't', q: value => "'" + value + "'", per: {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3},
    readMd5: () => md5, sql: () => (has40001 ? 't' : 'f'), b24Stages: stage ? [stage] : [], fp: () => ({same: 1}),
    applyCanonical: async () => { calls.applyCanonical += 1; return {need: 'n', receipt: {responseId: 'resp-1'}}; },
    resolve: async (response, version, revision, action) => ({response, version, revision, action}),
    mustRefuse: (response, message, label, expect) => calls.refusals.push({response, message, label, expect})};
  const scope = new Proxy(provided, {has: () => true, get: (target, key) => { if (key === Symbol.unscopables) return undefined; if (key in target) return target[key]; if (key in globalThis) return globalThis[key]; throw new Error('FREE_IDENTIFIER_NOT_PROVIDED ' + String(key)); }});
  await new AsyncFunction('ctx', `with (ctx) { ${pt409Block} }`)(scope);
  return {report, calls};
}
test('P4(h): PT409 / HTTP 409 runs WHENEVER the stale resolver is the DEV body (converted here or already there); otherwise the skip is a recorded gap with the TRUE reason', async () => {
  const applied = await runPt409({md5: STALE.devMd5, has40001: false, stage: {id: 'stale_resolver', applied: true, status: 'APPLIED (x)'}});
  assert.deepEqual(applied.report.gaps, []); assert.equal(applied.calls.applyCanonical, 1); assert.equal(applied.calls.refusals.length, 2);
  for (const refusal of applied.calls.refusals) { assert.equal(refusal.message, 'STALE_REVIEW_REQUIRED'); assert.deepEqual(refusal.expect, {sqlstate: 'PT409', status: 409}); }
  assert.deepEqual([applied.calls.refusals[0].response.version, applied.calls.refusals[1].response.revision], [99, 99], 'a stale response version, then a stale need revision');
  assert.equal(applied.report.stale.pt409.status, 409); assert.equal(applied.report.stale.pt409.convertedByThisRun, true); assert.equal(applied.report.stale.pt409.resolverIsTheDevBody, true);
  // a chain that ALREADY carries the DEV body (a stage that was NOT NEEDED): the 409 coverage still runs (round 2 skipped it because this process did not apply the stage)
  const already = await runPt409({md5: STALE.devMd5, has40001: false, stage: {id: 'stale_resolver', applied: false, status: 'NOT NEEDED (the body already equals the DEV body)'}});
  assert.deepEqual(already.report.gaps, []); assert.equal(already.calls.refusals.length, 2); assert.equal(already.report.stale.pt409.convertedByThisRun, false);
  // the pre-image still raises 40001: calling it with a stale version would hang PostgREST 14, so nothing is sent and the gap says why
  const hang = await runPt409({md5: STALE.preMd5, has40001: true, stage: {id: 'stale_resolver', applied: false, status: 'NOT APPLIED (PKG049_B24_PREIMAGE_DRIFT: x)'}});
  assert.equal(hang.calls.applyCanonical, 0); assert.equal(hang.calls.refusals.length, 0); assert.equal(hang.report.stale.pt409.skipped, true); assert.equal(hang.report.gaps.length, 1);
  assert.ok(hang.report.gaps[0].includes(STALE.preMd5) && hang.report.gaps[0].includes(STALE.devMd5) && hang.report.gaps[0].includes('retries without end') && hang.report.gaps[0].includes('NOT APPLIED (PKG049_B24_PREIMAGE_DRIFT: x)'), hang.report.gaps[0]);
  assert.ok(hang.report.gaps[0].startsWith('PT409 (HTTP 409 for a stale response version or need revision) NOT demonstrated: '));
  // an absent function and the (impossible) DEV body that still has a 40001 are skips as well, never a silent pass
  const absent = await runPt409({md5: null, has40001: false, stage: undefined});
  assert.equal(absent.report.gaps.length, 1); assert.ok(absent.report.gaps[0].includes('ABSENT') && absent.report.gaps[0].includes('not run'));
  const odd = await runPt409({md5: STALE.devMd5, has40001: true, stage: {id: 'stale_resolver', applied: true, status: 'APPLIED (x)'}});
  assert.equal(odd.calls.refusals.length, 0); assert.equal(odd.report.gaps.length, 1);
  assert.equal(lib.resultOf(odd.report.gaps), 'PASS_WITH_GAPS'); assert.equal(lib.resultOf(applied.report.gaps), 'PASS');
});
test('P0 stage loop: ONLY a chain-drift guard on a body that was not the known pre-image is tolerated (recorded as NOT APPLIED); everything else fails the run', async () => {
  // the stale resolver drifted (md5 is neither the pre-image nor the DEV body) and the stage SQL says so: tolerated, recorded, the confirm function is still converted on its own
  const drift = await runStageLoop({md5: {stale: '0'.repeat(32), confirm: CONFIRM.preMd5}, sql: text => { if (onlyFor(text, STALE)) throw new Error(psqlGuard('PKG049_B24_PREIMAGE_DRIFT')); return ''; }});
  assert.equal(drift.error, null); assert.equal(drift.sent.length, 2);
  assert.deepEqual(drift.stages.map(stage => [stage.id, stage.applied, stage.guard ?? null]), [['stale_resolver', false, 'PKG049_B24_PREIMAGE_DRIFT'], ['confirm_need_edit', true, null]]);
  assert.match(drift.stages[0].status, /^NOT APPLIED \(PKG049_B24_PREIMAGE_DRIFT: the chain body is not the pinned pre-image; the pin gate reports it\)$/);
  const absent = await runStageLoop({md5: {stale: null, confirm: CONFIRM.devMd5}, sql: () => { throw new Error(psqlGuard('PKG049_B24_FUNCTION_ABSENT')); }});
  assert.equal(absent.error, null); assert.equal(absent.stages[0].guard, 'PKG049_B24_FUNCTION_ABSENT');
  // a SQL defect, a timeout, a certificate guard and a derivation mismatch FAIL the run, naming the function and the reason
  for (const [message, reason] of [['LOCAL_SQL:PROCESS_EXIT:status=3:psql:<stdin>:4: ERROR:  syntax error at or near "xx"', 'NOT_A_STAGE_GUARD'], ['LOCAL_SQL:ETIMEDOUT:status=NONE:', 'NOT_A_STAGE_GUARD'],
    [psqlGuard('PKG049_B24_CERTIFICATE_MOVED'), 'GUARD_IS_NOT_A_DOCUMENTED_CHAIN_DRIFT: PKG049_B24_CERTIFICATE_MOVED'], [psqlGuard('PKG049_B24_DERIVATION_MISMATCH'), 'GUARD_IS_NOT_A_DOCUMENTED_CHAIN_DRIFT: PKG049_B24_DERIVATION_MISMATCH']]) {
    const failed = await runStageLoop({md5: {stale: STALE.preMd5, confirm: CONFIRM.preMd5}, sql: () => { throw new Error(message); }});
    assert.ok(failed.error, reason); assert.match(failed.error.message, new RegExp('^B24_PRICE_CHAIN_STAGE_FAILED stale_resolver \\(' + reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\): ')); assert.equal(failed.sent.length, 1, 'the run stops at the first failure');
  }
  // a drift guard that fires on a body the loop had just read as the known pre-image is a defect of the SQL or the harness, not a chain difference
  const impossible = await runStageLoop({md5: {stale: STALE.preMd5, confirm: CONFIRM.preMd5}, sql: () => { throw new Error(psqlGuard('PKG049_B24_SITE_COUNT_DRIFT')); }});
  assert.ok(impossible.error); assert.match(impossible.error.message, /^B24_PRICE_CHAIN_STAGE_FAILED stale_resolver \(DRIFT_GUARD_ON_THE_KNOWN_PRE_IMAGE\): /);
  // the failure of the ADJACENT function fails the run too (any other error rethrows), but never before the stale resolver has been converted on its own
  const adjacent = await runStageLoop({md5: {stale: STALE.preMd5, confirm: CONFIRM.preMd5}, sql: text => { if (onlyFor(text, CONFIRM)) throw new Error('LOCAL_SQL:ETIMEDOUT:status=NONE:'); return ''; }});
  assert.ok(adjacent.error); assert.match(adjacent.error.message, /^B24_PRICE_CHAIN_STAGE_FAILED confirm_need_edit /); assert.equal(adjacent.sent.length, 2); assert.ok(onlyFor(adjacent.sent[0], STALE));
});
