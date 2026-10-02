// EX-05 S02 / RC-02: media-cancel lock order, proved on a DISPOSABLE CHAIN with genuinely concurrent database sessions. ASCII only, LF only.
// Run by .github/workflows/ex05-s02-rc02-proof.yml after the unchanged chain stages (source147 ... Voice B1 application). Never against DEV.
//
// Phases (every phase runs even when an earlier one failed, so one run reports everything; a failure is listed, never guessed away):
//   P0 environment probe, cron paused                P1 chain fidelity: md5 pins vs the DEV bodies read on 2026-10-02, B24 conversion of the task media
//   functions, writer census                         P2 scratch copies for the named controls                 P3 PT409 contract over real PostgREST
//   P4 the interleavings (gate session + parked callers, every wait observed in pg_stat_activity)            P5 verdicts, findings, controls, admission
import {execFileSync, spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import * as rt from '../pre_v3/closure_runtime.mjs';
import * as S from './ex05_s02_sql.mjs';
import * as E from './ex05_s02_engine.mjs';
import * as C from './ex05_s02_catalog.mjs';
import * as P from './ex05_s02_pins.mjs';

const {sql, rows, ok, env, service, randomUUID, assert} = rt;
const Q = S.CATALOG_SQL;
const DB = env.RU5_DEVICE_DB_URL;
const OUT = env.EX05_ARTIFACT_DIR || rt.out;
const ONLY = (env.EX05_ONLY || '').split(',').map(item => item.trim()).filter(Boolean);
const PIN_GATE_ONLY = env.EX05_PIN_GATE_ONLY === '1';
mkdirSync(OUT, {recursive: true});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hex64 = () => (randomUUID() + randomUUID()).replaceAll('-', '');
const tryOk = fn => { try { fn(); return true; } catch { return false; } };
const report = {unit: C.UNIT, label: C.LABEL, sourceSha: env.GITHUB_SHA, result: 'RUNNING', failures: [], devAccess: false, providerCalls: 0, deviceProven: false, notProved: [...C.NOT_PROVED],
  startedAt: new Date().toISOString(), scope: PIN_GATE_ONLY ? 'PIN_GATE_ONLY' : (ONLY.length ? 'FILTERED' : 'FULL'), pinGateOnly: PIN_GATE_ONLY, filter: ONLY,
  environment: {}, chainFidelity: null, contract: [], interleavings: [], controls: [], findings: [], scenarioErrors: [], controlsCreated: []};
const save = () => {
  report.resultLabel = C.resultLabel(report); // a partial run never reads as a plain PASS
  writeFileSync(OUT + '/ex05-s02-report.json', JSON.stringify(report, null, 2) + '\n');
};
const fail = text => { const line = String(text).slice(0, 700); report.failures.push(line); console.error('FAIL ' + line); save(); };
const note = text => console.log(text);
const writeMarkdown = () => writeFileSync(OUT + '/ex05-s02-report.md', C.renderMarkdown(report));
save(); // a RUNNING marker exists from the first second: a step killed while a database call blocks still leaves a report that says so
// A timeout or a cancel of the workflow step must still leave the report and no live session behind (a synchronous psql call can delay the handler by its own timeout).
const terminate = signal => {
  report.failures.push('TERMINATED_BY_' + signal + ' (the step timeout or a cancel of the run)');
  report.result = 'FAIL';
  try { void engine.closeAll(); } catch { /* the engine did not exist yet: no session is open */ }
  try { save(); writeMarkdown(); } catch { /* the report written before is the record */ }
  process.exit(1);
};
process.on('SIGTERM', () => terminate('SIGTERM'));
process.on('SIGINT', () => terminate('SIGINT'));

const query = async text => execFileSync('psql', [DB, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {input: text, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024}).trim();
const engine = E.createEngine({spawn: args => spawn('psql', args, {stdio: ['pipe', 'pipe', 'pipe']}), query, sleep, now: () => Date.now(), dbUrl: DB});

// ---------------------------------------------------------------------------------------------------------------------------------
// Accounts and sessions (the Auth rate limit is per IP and per five minutes: a bounded retry, as the EX-06 adapter does).
// ---------------------------------------------------------------------------------------------------------------------------------
const isRateLimit = error => /\b429\b|over_request_rate_limit|rate limit|too many requests/i.test(String(error?.message ?? error));
async function newActor(label) {
  let waited = 0;
  for (;;) {
    try { return await rt.actor(label); } catch (error) {
      if (!isRateLimit(error) || waited >= 360000) throw error;
      await sleep(30000);
      waited += 30000;
    }
  }
}
async function ownerOf(actor) {
  const session = (await actor.client.auth.getSession()).data.session;
  const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString());
  assert.equal(payload.sub, actor.id);
  assert.ok(payload.session_id, 'the access token carries a session id');
  return {id: actor.id, session: payload.session_id, claims: {sub: payload.sub, role: 'authenticated', session_id: payload.session_id}, actor};
}
async function openConversation(actor) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await actor.client.rpc('rpc_ai_open_need_conversation_owned_v2', {p_client_request_id: randomUUID()});
    if (!result.error) return result.data.conversationId;
    if (!/AI_RATE_LIMITED/.test(result.error.message)) throw new Error('LOCAL_RPC:' + result.error.code + ':' + result.error.message);
    await sleep(12000);
  }
  throw new Error('AI_RATE_LIMITED_TOO_LONG');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// P0: environment
// ---------------------------------------------------------------------------------------------------------------------------------
let deadlockSettable = true;
let rolesOk = true;
function probeEnvironment() {
  const env0 = report.environment;
  env0.node = process.version;
  env0.psql = execFileSync('psql', ['--version'], {encoding: 'utf8'}).trim();
  env0.server = sql('show server_version');
  env0.deadlockTimeoutDefault = sql('show deadlock_timeout');
  deadlockSettable = tryOk(() => sql(Q.probeDeadlock()));
  env0.deadlockTimeoutSettable = deadlockSettable;
  env0.roleSwitch = {authenticated: tryOk(() => sql(Q.probeRole('authenticated'))), service_role: tryOk(() => sql(Q.probeRole('service_role')))};
  rolesOk = env0.roleSwitch.authenticated && env0.roleSwitch.service_role;
  if (!rolesOk) fail('ROLE_SWITCH_UNAVAILABLE: the sessions cannot run as authenticated / service_role');
  // Without a per-transaction deadlock_timeout the victim of a cycle cannot be steered and the judge would drop the victim assertion: that is a weaker proof,
  // so it is a listed failure of the environment (never a quiet PASS). Every phase still runs, so the run reports everything it observed.
  if (!deadlockSettable) fail('DEADLOCK_TIMEOUT_NOT_SETTABLE: the proof role cannot set deadlock_timeout per transaction, so the victim of a cycle is not steered and the victim assertions are dropped; this is a defect of the proof environment, not a verdict on RC-02');
  env0.cronBefore = rows(Q.cronJobs());
  if (env0.cronBefore.some(job => job.active)) sql(Q.cronPause());
  env0.cronAfter = rows(Q.cronJobs());
  if (env0.cronAfter.some(job => job.active)) fail('CRON_JOBS_STILL_ACTIVE: ' + JSON.stringify(env0.cronAfter));
  const names = env0.cronBefore.map(job => job.jobname).sort();
  env0.cronNamesEqualDevPin = JSON.stringify(names) === JSON.stringify([...pins.cron].sort());
}

// ---------------------------------------------------------------------------------------------------------------------------------
// P1: chain fidelity
// ---------------------------------------------------------------------------------------------------------------------------------
const pins = P.loadPins();
const readFunction = signature => rows(Q.functionRow(signature))[0] ?? null;
const readTrigger = name => {
  const [schema, relation, trigger] = name.split('.');
  return rows(Q.triggerRow(schema, relation, trigger))[0]?.md5 ?? null;
};
const closureState = () => rows(Q.closureState())[0];
const classifyAll = () => Object.entries(pins.functions).map(([signature, pin]) => P.classifyFunction(signature, pin, readFunction(signature)));

function chainFidelity() {
  const before = classifyAll();
  const certificateBefore = closureState();
  const converted = [];
  for (const item of before.filter(entry => entry.status === 'EXPECTED_PRE_B24')) {
    try {
      const definition = sql(Q.functionDef(item.sig));
      const conversion = S.convertB24(definition);
      sql(conversion.sql);
      converted.push({sig: item.sig, sites: conversion.sites, md5After: readFunction(item.sig)?.md5 ?? null});
    } catch (error) {
      converted.push({sig: item.sig, sites: 0, md5After: null, error: String(error.message).slice(0, 300)});
    }
  }
  const certificateAfter = closureState();
  const after = classifyAll();
  const triggers = Object.entries(pins.triggers).map(([name, pin]) => P.classifyTrigger(name, pin, readTrigger(name)));
  const writers = rows(Q.census(pins.census.pattern)).map(row => row.name);
  const remaining = rows(Q.remaining40001(Object.keys(pins.functions))).map(row => row.sig);
  const certificate = {before: certificateBefore, after: certificateAfter, unchangedByConversion: certificateBefore.live === certificateAfter.live && certificateBefore.certified === certificateAfter.certified && certificateAfter.ready === true};
  const verdict = P.fidelityVerdict({pins, before, after, triggers, census: P.censusDiff(writers, pins.census.writers), converted, certificate, remaining40001: remaining});
  report.chainFidelity = {...verdict, devRead: pins.devRead, differences: after.filter(item => item.status !== 'EQUAL').concat(triggers.filter(item => item.status !== 'EQUAL')),
    conversion: converted, certificate, writersOnChain: writers, outsideTheMatrix: pins.census.outsideTheMatrix,
    label: 'The chain is NOT DEV (it lacks pkg051a, PKG-045b P0, P6 rollout v3 and B24 part 1, and its ledger, OIDs and certificate are chain-internal). This verdict says only that the pinned bodies and trigger definitions equal the DEV ones.'};
  if (verdict.verdict !== 'DEV_FAITHFUL') fail('CHAIN_NOT_DEV_FAITHFUL: ' + verdict.problems.slice(0, 8).join(' | '));
  for (const warning of verdict.warnings) note('WARN ' + warning);
  note(`PIN GATE ${verdict.verdict}: ${verdict.equal} of ${verdict.checked} functions and ${verdict.triggersEqual} of ${verdict.triggersChecked} triggers equal DEV; ${converted.length} converted (B24)`);
  save();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// P2: scratch copies for the named controls (a schema the proof drops; no production body is touched)
// ---------------------------------------------------------------------------------------------------------------------------------
function createControls() {
  sql(Q.scratchSetup());
  const make = (signatureOfOriginal, mutate, scratchSignature, grantTo) => {
    const definition = sql(Q.functionDef(signatureOfOriginal));
    const mutation = mutate(definition);
    sql(mutation.sql);
    sql(Q.scratchGrant(scratchSignature, grantTo));
    const stored = rows(Q.scratchStored(scratchSignature))[0]?.md5 ?? null;
    const entry = {scratch: scratchSignature, original: signatureOfOriginal, originalBodyMd5: S.md5Hex(mutation.originalBody), expectedBodyMd5: S.md5Hex(mutation.expectedBody), storedBodyMd5: stored,
      storedEqualsExpected: stored === S.md5Hex(mutation.expectedBody), differsFromOriginal: S.md5Hex(mutation.expectedBody) !== S.md5Hex(mutation.originalBody)};
    report.controlsCreated.push(entry);
    if (!entry.storedEqualsExpected || !entry.differsFromOriginal) throw new Error('SCRATCH_COPY_NOT_AS_INTENDED:' + scratchSignature);
  };
  make('public.rpc_cancel_media_upload(uuid,uuid)', S.mutateCancelConvFirst, `${S.SCRATCH_SCHEMA}.rpc_cancel_media_upload_conv_first(uuid,uuid)`, 'authenticated');
  for (const kind of ['photo', 'voice']) {
    const info = S.KINDS[kind];
    make(`${info.uploadFn}(uuid,uuid,text,uuid,integer,uuid,jsonb)`, definition => S.mutateUploadServiceInverted(definition, kind),
      `${S.SCRATCH_SCHEMA}.${info.uploadRpc}_inverted(uuid,uuid,text,uuid,integer,uuid,jsonb)`, 'service_role');
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------------------------------------------
const shared = {taskOwner: null, pairs: {}};
async function taskOwner() { return (shared.taskOwner ??= ownerOf(await newActor('ex05-task'))); }
async function freshOwner() { return ownerOf(await newActor('ex05-closure')); }
const svcTask = (owner, name, args) => ok(service.rpc(name, {p_account_id: owner.id, ...args}));

async function taskFixture(owner, upload) {
  const conv = await openConversation(owner.actor);
  const ctx = {kind: 'task', owner, conv, key: randomUUID(), asset: null, attempt: null, sha: hex64(), stageSha: hex64(), prepareId: randomUUID()};
  if (upload === 'ABSENT') return ctx;
  const claimed = await svcTask(owner, 'rpc_claim_media_upload_service', {p_scope: 'TASK', p_target_id: conv, p_client_request_id: ctx.key, p_input_sha256: ctx.sha, p_input_bytes: 2048, p_input_type: 'image/jpeg'});
  ctx.asset = claimed.asset.assetId;
  ctx.attempt = claimed.attemptId;
  if (upload !== 'PROCESSING') {
    await svcTask(owner, 'rpc_stage_media_upload_service', {p_asset_id: ctx.asset, p_attempt_id: ctx.attempt, p_sha256: ctx.stageSha, p_width: 800, p_height: 600, p_byte_size: 4096});
    await svcTask(owner, 'rpc_dispatch_media_upload_service', {p_asset_id: ctx.asset, p_attempt_id: ctx.attempt});
  }
  if (upload === 'SETTLED' || upload === 'READY') await svcTask(owner, 'rpc_settle_media_upload_service', {p_asset_id: ctx.asset, p_storage_sha256: ctx.stageSha, p_outcome: 'STORED'});
  if (upload === 'READY') await svcTask(owner, 'rpc_complete_media_upload_service', {p_asset_id: ctx.asset, p_storage_sha256: ctx.stageSha});
  const want = {PROCESSING: 'PROCESSING', DISPATCHING: 'STAGED', SETTLED: 'STAGED', READY: 'READY'}[upload];
  const state = JSON.parse(await query(S.taskStateSql(ctx)));
  if (state.state !== want || state.selected !== true) throw new Error('FIXTURE_STATE:' + JSON.stringify(state));
  if (upload === 'READY' && state.inRefs !== true) throw new Error('FIXTURE_NOT_IN_THE_DRAFT:' + JSON.stringify(state));
  return ctx;
}

async function agreementShared(kind) {
  if (shared.pairs[kind]) return shared.pairs[kind];
  shared.pairs[kind] = (async () => {
    const requester = await newActor(`ex05-${kind}-q`);
    const worker = await newActor(`ex05-${kind}-w`);
    const profile = (actor, profileKind) => rows(Q.profileId(actor.id, profileKind))[0].id;
    const requesterProfile = profile(requester, 'REQUESTER');
    const workerProfile = profile(worker, 'WORKER');
    sql(Q.workerProfileUpdate(workerProfile));
    await ok(worker.client.rpc('rpc_complete_worker_profile', {p_profile_id: workerProfile}));
    const needId = randomUUID();
    sql(Q.needInsert({id: needId, requester: requester.id, requesterProfile, title: 'EX-05 S02 ' + kind}));
    const offer = await ok(worker.client.rpc('rpc_submit_response', {p_need_id: needId, p_need_revision: 1, p_worker_profile_id: workerProfile, p_covered_slots: 1, p_price_rsd: 3000,
      p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: null, p_client_request_id: randomUUID()}));
    const agreement = await ok(requester.client.rpc('rpc_select_response', {p_need_id: needId, p_need_revision: offer.needRevision, p_response_id: offer.responseId,
      p_response_version: offer.version, p_content_hash: offer.contentHash, p_client_request_id: randomUUID()}));
    assert.ok(agreement, 'the Agreement exists');
    return {requester, worker, owner: await ownerOf(requester), agreement};
  })();
  return shared.pairs[kind];
}

async function uploadBudget(info, ownerId) {
  for (let i = 0; i < 60; i++) {
    const recent = Number(sql(Q.uploadBudget(info.table, ownerId)));
    if (recent <= info.perMinute - 3) return;
    await sleep(4000);
  }
  throw new Error('UPLOAD_BUDGET_TIMEOUT');
}

async function agreementFixture(kind, upload) {
  const info = S.KINDS[kind];
  const pair = await agreementShared(kind);
  await uploadBudget(info, pair.owner.id);
  const ctx = {kind, owner: pair.owner, agreement: pair.agreement, key: randomUUID(), asset: null, attempt: null, sha: hex64(), stageSha: null, cmid: 'ex05_' + randomUUID().replaceAll('-', ''), prepareId: randomUUID()};
  ctx.stageSha = kind === 'voice' ? ctx.sha : hex64();
  if (upload === 'ABSENT') return ctx;
  const operation = (op, input) => ok(service.rpc(info.uploadRpc, {p_account_id: pair.owner.id, p_session_id: pair.owner.session, p_operation: op, p_agreement_id: pair.agreement, p_version: 1, p_key: ctx.key, p_input: input}));
  const claimed = await operation('CLAIM', info.claimInput(ctx));
  ctx.asset = claimed.receipt.assetId;
  ctx.attempt = claimed.attemptId;
  await operation('STAGE', info.stageInput(ctx));
  await operation('DISPATCH', {});
  if (upload === 'READY') await operation('SETTLE', info.settleInput(ctx));
  const state = JSON.parse(await query(S.agreementStateSql(ctx)));
  const want = upload === 'READY' ? 'READY' : 'STAGED';
  if (state.state !== want || state.attached !== false) throw new Error('FIXTURE_STATE:' + JSON.stringify(state));
  return ctx;
}

async function buildContext(spec) {
  if (spec.fixture.family === 'task') return taskFixture(spec.fresh === 'owner' ? await freshOwner() : await taskOwner(), spec.fixture.upload);
  return agreementFixture(spec.kind, spec.fixture.upload);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// P3: deterministic conflicts answer PT409 over the real PostgREST (never 40001, which PostgREST 14 would re-run without end)
// ---------------------------------------------------------------------------------------------------------------------------------
function recordContract(id, expectedMessage, result) {
  const observed = {status: result.status ?? null, code: result.error?.code ?? null, message: String(result.error?.message ?? '').slice(0, 80)};
  const pass = observed.code === 'PT409' && observed.status === 409 && observed.message === expectedMessage;
  report.contract.push({id, expected: {status: 409, code: 'PT409', message: expectedMessage}, observed, verdict: pass ? 'PASS' : 'FAIL'});
  if (!pass) fail(`PT409_CONTRACT:${id}: expected 409 PT409 ${expectedMessage}, observed ${JSON.stringify(observed)}`);
}
async function contractChecks() {
  try {
    const owner = await taskOwner();
    const first = await taskFixture(owner, 'PROCESSING');
    recordContract('TASK_COMPLETE_OF_AN_UNSETTLED_UPLOAD', 'MEDIA_STORAGE_UNCONFIRMED',
      await service.rpc('rpc_complete_media_upload_service', {p_account_id: owner.id, p_asset_id: first.asset, p_storage_sha256: hex64()}));
    recordContract('TASK_STAGE_WITH_A_STALE_ATTEMPT', 'MEDIA_ATTEMPT_STALE',
      await service.rpc('rpc_stage_media_upload_service', {p_account_id: owner.id, p_asset_id: first.asset, p_attempt_id: randomUUID(), p_sha256: hex64(), p_width: 800, p_height: 600, p_byte_size: 4096}));
    const otherConversation = await openConversation(owner.actor);
    recordContract('TASK_CANCEL_THROUGH_ANOTHER_CONVERSATION', 'MEDIA_COMMAND_CONFLICT',
      await owner.actor.client.rpc('rpc_cancel_media_upload', {p_conversation_id: otherConversation, p_client_request_id: first.key}));
  } catch (error) { fail('CONTRACT_TASK_PHASE:' + String(error.message).slice(0, 300)); }
  for (const kind of ['photo', 'voice']) {
    try {
      const info = S.KINDS[kind];
      const pair = await agreementShared(kind);
      const claimed = await agreementFixture(kind, 'DISPATCHING');
      const call = (key, version, input, op = 'CLAIM') => service.rpc(info.uploadRpc, {p_account_id: pair.owner.id, p_session_id: pair.owner.session, p_operation: op, p_agreement_id: pair.agreement, p_version: version, p_key: key, p_input: input});
      recordContract(`AGREEMENT_${kind.toUpperCase()}_CLAIM_OF_THE_SAME_KEY_WITH_OTHER_INPUT`, 'MEDIA_COMMAND_CONFLICT', await call(claimed.key, 1, info.claimInput({...claimed, sha: hex64()})));
      recordContract(`AGREEMENT_${kind.toUpperCase()}_CLAIM_AT_A_STALE_VERSION`, 'MEDIA_VERSION_CONFLICT', await call(randomUUID(), 9, info.claimInput(claimed)));
      const ready = await agreementFixture(kind, 'READY');
      const send = assetId => {
        const common = {p_expected_user_id: pair.owner.id, p_agreement_id: pair.agreement, p_expected_version: 1, p_client_message_id: ready.cmid};
        return pair.requester.client.rpc(info.sendRpc, kind === 'voice' ? {...common, p_asset_id: assetId} : {...common, p_body: '', p_asset_ids: [assetId]});
      };
      const sent = await send(ready.asset);
      if (sent.error) throw new Error('CONTRACT_SEND_FAILED:' + sent.error.code + ':' + sent.error.message);
      recordContract(`AGREEMENT_${kind.toUpperCase()}_SEND_OF_THE_SAME_MESSAGE_ID_WITH_ANOTHER_ASSET`, 'MEDIA_COMMAND_CONFLICT', await send(randomUUID()));
    } catch (error) { fail(`CONTRACT_${kind.toUpperCase()}_PHASE:` + String(error.message).slice(0, 300)); }
  }
  save();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// P4: the interleavings
// ---------------------------------------------------------------------------------------------------------------------------------
const compactOutcome = outcome => ({ok: outcome.ok, exitCode: outcome.exitCode, sqlstate: outcome.sqlstate, message: outcome.message, result: Object.values(outcome.results ?? {})[0] ?? null});
async function interleavings(catalog) {
  let number = 0;
  const verdicts = [];
  const runs = new Map();
  for (const spec of catalog) {
    number += 1;
    note(`START ${String(number).padStart(2, '0')}/${catalog.length} ${spec.id}`);
    let run;
    try {
      const ctx = await buildContext(spec);
      run = await E.runScenario({engine, spec, ctx, scenarioNo: number, deadlockSettable, query, now: () => Date.now(), sleep});
    } catch (error) {
      run = {id: spec.id, outcomes: {}, edges: [], statements: {}, steps: [], final: null, error: 'FIXTURE_OR_ENGINE:' + String(error.message).slice(0, 400), deadlockSettable};
      await engine.closeAll();
    }
    const verdict = C.judge(spec, run);
    verdicts.push(verdict);
    runs.set(spec.id, run);
    const victimOutcome = verdict.victim ? run.outcomes[verdict.victim] : null;
    report.interleavings.push({
      id: spec.id, group: spec.group, kind: spec.kind, title: spec.title, expectedClass: spec.expect.class, expectedVictim: spec.expect.victim ?? null, observedClass: verdict.observedClass, victim: verdict.victim,
      verdict: verdict.verdict, problems: verdict.problems, errors: verdict.errors, finding: spec.finding ?? null, control: spec.control ?? null,
      edges: run.edges, snapshot: run.snapshot, cycle: run.cycle, steps: run.steps, statements: run.statements, final: run.final, durationMs: run.durationMs ?? null,
      outcomes: Object.fromEntries(Object.entries(run.outcomes).map(([name, outcome]) => [name, compactOutcome(outcome)])),
      ...(victimOutcome && victimOutcome.sqlstate === '40P01' ? {deadlock: {victim: verdict.victim, sqlstate: '40P01', edges: victimOutcome.edges, detail: victimOutcome.detail, context: victimOutcome.context, hint: victimOutcome.hint}} : {}),
    });
    if (run.error) report.scenarioErrors.push(`${spec.id}: ${run.error}`);
    note(`${verdict.verdict === 'AS_EXPECTED' ? 'PASS' : 'DIFF'} ${spec.id}: expected ${spec.expect.class}, observed ${verdict.observedClass}${verdict.victim ? ' (victim ' + verdict.victim + ')' : ''}${verdict.problems.length ? ' | ' + verdict.problems.slice(0, 3).join(' | ') : ''}`);
    save();
  }
  return {verdicts, runs};
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------------------------------------------
async function main() {
  const full = C.buildCatalog();
  const problems = C.validateCatalog(full, {statements: S.STATEMENTS, gates: S.GATES});
  if (problems.length) fail('CATALOG_INVALID: ' + problems.join(' | '));
  const catalog = full.filter(spec => !ONLY.length || ONLY.includes(spec.id));
  if (ONLY.length && catalog.length !== ONLY.length) fail('EX05_ONLY_NAMES_UNKNOWN_SCENARIOS: ' + ONLY.filter(id => !full.some(spec => spec.id === id)).join(','));
  try { probeEnvironment(); } catch (error) { fail('PROBE:' + String(error.message).slice(0, 300)); }
  try { chainFidelity(); } catch (error) { fail('CHAIN_FIDELITY_PHASE:' + String(error.message).slice(0, 400)); }
  if (PIN_GATE_ONLY) {
    report.result = report.failures.length ? 'FAIL' : 'PASS';
    save();
    writeMarkdown();
    console.log(`${C.resultLabel(report)} EX05_S02_PIN_GATE_ONLY (${C.partialNotice(report)})`);
    process.exitCode = report.result === 'PASS' ? 0 : 1;
    return;
  }
  let controlsReady = true;
  try { createControls(); } catch (error) { controlsReady = false; fail('CONTROLS_NOT_CREATED:' + String(error.message).slice(0, 400)); }
  if (rolesOk) {
    try { await contractChecks(); } catch (error) { fail('CONTRACT_PHASE:' + String(error.message).slice(0, 300)); }
    const runnable = catalog.filter(spec => controlsReady || !spec.control);
    if (runnable.length !== catalog.length) fail('CONTROL_SCENARIOS_SKIPPED_BECAUSE_THE_SCRATCH_COPIES_ARE_MISSING');
    const {verdicts, runs} = await interleavings(runnable);
    report.controls = C.controlsSummary(runnable, verdicts, runs);
    report.findings = C.buildFindings(runnable, verdicts);
  }
  await engine.closeAll();
  try { sql(Q.scratchDrop()); } catch (error) { note('WARN scratch schema not dropped: ' + String(error.message).slice(0, 200)); }
  report.finishedAt = new Date().toISOString();
  report.result = report.failures.length ? 'FAIL' : 'PASS';
  try {
    const admitted = C.admitReport(report, {catalog: full, sourceSha: env.GITHUB_SHA, filter: ONLY});
    report.admission = {admitted: true, ...admitted};
  } catch (error) {
    report.admission = {admitted: false, reason: String(error.message).slice(0, 2000)};
    report.result = 'FAIL';
    report.failures.push(String(error.message).slice(0, 700));
  }
  save();
  writeMarkdown();
  for (const finding of report.findings) {
    if (finding.status === 'REPRODUCED') console.log(`::warning title=RC-02 finding ${finding.id} REPRODUCED::${finding.text}`);
  }
  const partialNotice = C.partialNotice(report);
  console.log(`${C.resultLabel(report)} ${C.UNIT} (${report.interleavings.filter(item => item.verdict === 'AS_EXPECTED').length} of ${report.interleavings.length} interleavings as registered; findings ${report.findings.map(f => f.id + ':' + f.status).join(', ')})${partialNotice ? ' ' + partialNotice : ''}`);
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}

try {
  await main();
} catch (error) {
  report.result = 'FAIL';
  report.failures.push('UNCAUGHT:' + String(error && error.stack ? error.stack : error).slice(0, 1500));
  save();
  try { writeMarkdown(); } catch { /* the JSON report is the record */ }
  try { await engine.closeAll(); } catch { /* nothing left */ }
  console.error(report.failures.at(-1));
  process.exitCode = 1;
}
