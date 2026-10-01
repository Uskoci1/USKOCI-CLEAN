// EX-06 ex06a (flexible-window dispatch fix): FAIL-BEFORE / PASS-AFTER proof on a disposable DEV-equivalent chain, with actual Auth and PostgREST. NOTHING here ran yet (authored offline); a CI run is the first evidence.
// One process, six phases on ONE chain (source147 -> PKG-050, the unchanged ex04d-proven stages 03-18). TWO function bodies change (private.worker_dispatch_time_admitted and
// private.match_detail_without_calendar); nothing else.
//   0 CHAIN FIDELITY  every pin the candidate enforces (the two targets and ten neighbours, dispatch_next_wave among them) is read on the chain and must equal the DEV md5, and so must the S03 pin gate
//                     (lib/pins.mjs, 11 pins incl. private.dispatch_next_wave): never faked, a difference is a finding and stops here; the corpus file, its sha256 and its 37 case ids are pinned;
//   1 BEFORE          the function-level matrix (labelled direct fixtures, deterministic anchors: DST days, week boundaries, zones, the local-versus-UTC day, the anchor day of a New York task, stored windows,
//                     the other kinds; the gate, the COMPLETE blocker lists and the eligibility of match_detail per pair), the CLOCK FAMILY (the week that is still running and the rest of today: installed afresh
//                     before every read) and the REAL S02 corpus, 37 task cases on the product path, through the S03 runner (canary first), plus T-003 and T-006 again with the S03 fixtures unmodified
//                     (the "vanilla" pass). Every pass asserts its own coverage (37 cases, none refused), the exact list of adjusted workers, the capture of every worker's full detail, the product path of
//                     T-003 and T-006 and the assumptions of the narrow fixture; ONE corpus rebase serves every pass, so the stored starts_at (and the full detail, which carries liveStateDate) of a case is
//                     the same in every pass whatever the time of day;
//   2 APPLY           refusals first (a drifted neighbour, a drifted target, a CRLF text, an uncertified closure, a second application), then the one atomic DO; exactly TWO functions changed, nothing
//                     added or removed, certificate unmoved;
//   3 AFTER           the same matrix and the same corpus; the difference to BEFORE must be EXACTLY the written-down INTENDED_FLIPS (lib/ex06a_lib.mjs) and, for the FULL match_detail of every worker,
//                     exactly the intended fields; every other case, worker, refusal and delivery identical;
//   4 REVERT          refuses on the predecessor and with a CRLF text, restores the md5 pins, the whole surface and catalog, the matrix and the whole corpus return to the BEFORE state;
//   5 REAPPLY         the same bytes again; the corpus flips of T-003 and T-006 and the matrix return.
// The corpus fixture adjustment (lib augmentSpec) is the ONE deviation from the S03 harness and is reported with every worker it touched; its reason: the corpus describes the FITS worker of T-003 and T-006 as
// "available now and scheduled" but these tasks carry no window, so S03 can only build "available now". It is NARROW (one rule on tomorrow's weekday for T-003, on Sunday for T-006), so that the product path
// discriminates the window and not only the wiring. The predecessor refuses such a worker too (the BEFORE pass shows it), and the unmodified S03 build still cannot be admitted by the candidate (the vanilla pass
// shows it): that is a fixture limit of S03, not a defect of the function, and it is decision D1 in README_EX06A.md.
// No DEV, provider or device access: closure_runtime.mjs refuses any target that is not the loopback proof stack.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadModules} from '../ex04/ts_loader.mjs';
import {createFixtures} from './lib/fixtures.mjs';
import {loadCorpus} from './lib/s02_adapter.mjs';
import {normaliseCorpus} from './lib/corpus.mjs';
import {PROOF_POINT_PINS, evaluatePins, evidenceLabel, pinQuery, pinRowsOf} from './lib/pins.mjs';
import * as lib from './ex06a_lib.mjs';
import {PASS_GUARD_MINUTES, createPassRunner} from './ex06a_passes.mjs';

const {assert, sql, rows, q, randomUUID, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const TARGET = lib.TARGET, DETAIL = lib.DETAIL_TARGET;
const candidate = readFileSync('supabase/candidates/ex06a_flexible_window.sql', 'utf8');
const revert = readFileSync('supabase/candidates/ex06a_flexible_window_revert.sql', 'utf8');
const postflight = readFileSync('supabase/proofs/ex06/ex06a_postflight.readonly.sql', 'utf8');
// The corpus is part of the proof: a different file, a smaller selection or another id set is a different proof (EX06_CORPUS must not point elsewhere).
const corpusOverride = env.EX06_CORPUS === undefined || env.EX06_CORPUS === lib.CORPUS_PIN.path ? null : env.EX06_CORPUS;
const corpusPath = lib.CORPUS_PIN.path;
const outDir = env.PRE_V3_ARTIFACT_DIR ?? 'artifacts/ex06a';
mkdirSync(outDir, {recursive: true});
const reportPath = outDir + '/ex06a-report.json';
const md5 = text => createHash('md5').update(text).digest('hex');
const sha = text => createHash('sha256').update(text).digest('hex');
const trimmed = text => text.replace(/\n$/, '');
const newBody = lib.dollarLiteral(candidate, 'new_body'), NEW_MD5 = md5(newBody);
const detailAnchor = lib.dollarLiteral(candidate, 'detail_anchor'), detailReplacement = lib.dollarLiteral(candidate, 'detail_replacement');
const DETAIL_NEW_MD5 = candidate.match(/detail_new_md5 constant text := '([0-9a-f]{32})'/)[1];
const report = {package: 'EX-06 ex06a: flexible-window dispatch fix (private.worker_dispatch_time_admitted + private.match_detail_without_calendar, function-only, two bodies)', sourceSha: env.GITHUB_SHA,
  disposableDbOnly: true, devAccess: false, providerCalls: 0, windowDefinition: lib.WINDOW_DEFINITION, oldMd5: {[TARGET]: lib.OLD_MD5, [DETAIL]: lib.DETAIL_OLD_MD5}, newMd5: {[TARGET]: NEW_MD5, [DETAIL]: DETAIL_NEW_MD5},
  result: 'RUNNING', checks: [], notProven: [
    'behaviour on DEV data (none touched)', 'real provider output (the facts and the evaluator decision are synthetic)', 'push delivery and devices', 'the owner semantic (the owner words, a proposal until "primeni")',
    'application-time and calendar-conflict paths (not touched by the functions and not exercised)', 'a chain that differs from DEV in any function the pins do not cover', 'a TOMORROW/WEEK task with exactly one stored bound (open finding F4: still refused, not changed)',
    'a dispatch wave for a scheduled-only worker (live intent off, a real weekly rule): proved at function level (match_detail dispatchEligible for the matrix pairs), not through a wave on the product path']};
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const pass = name => { report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name); };
const say = text => console.log(text);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ------------------------------------------------------------------ database reads
const bodyMd5 = signature => sql(`select md5(replace(prosrc,E'\\r','')) from pg_proc where oid=${q(signature)}::regprocedure`);
// the body text itself (sql() trims its output, and a body starts and ends with a newline): read as JSON
const bodyText = signature => rows(`select replace(prosrc,E'\\r','') as body from pg_proc where oid=${q(signature)}::regprocedure`)[0].body;
const closure = () => rows('select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified, private.retention_ai_source_ready() ready')[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const catalog = () => rows(`select 'function:' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as name, md5(replace(p.prosrc, E'\\r', '')) as md5
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prokind in ('f', 'p')
  union all select 'trigger:' || n.nspname || '.' || c.relname || '.' || t.tgname, md5(pg_get_triggerdef(t.oid))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private') and not t.tgisinternal order by 1`);
const targetNames = ['private.match_detail_without_calendar', 'private.worker_dispatch_time_admitted'];   // sorted: the names of the two changed surface lines

// ------------------------------------------------------------------ the function-level matrix and the clock family (labelled direct fixtures; the product path is the corpus)
let plan = null, ids = null;
/**
 * Installs a plan (lib.buildMatrix or lib.buildClockFamily) as labelled direct fixtures and reads back what was STORED (the matrix measures what was stored, never what was meant). The clock-relative
 * cases need a local day that is neither at its very start nor at its very end: the proof waits first (clockWaitMs), then builds the plan from the clock of that moment.
 */
async function installPlan(build, label) {
  const wait = lib.clockWaitMs(Date.now(), {guardMinutes: PASS_GUARD_MINUTES});
  if (wait > 0) { say(`CLOCK_GUARD (${label}) waiting ${Math.round(wait / 1000)} s`); await sleep(wait); }
  const built = build(Date.now());
  const planIds = {requester: {account: randomUUID(), profile: randomUUID()}, workers: {}, tasks: {}};
  for (const key of Object.keys(built.workers)) planIds.workers[key] = {account: randomUUID(), profile: randomUUID()};
  for (const key of Object.keys(built.tasks)) planIds.tasks[key] = randomUUID();
  sql(lib.fixtureSql(built, planIds, q));
  // read back: the matrix measures what was stored, never what was meant (a trigger that rewrote published_at would void every anchor)
  const stored = rows(`select id, schedule_kind, starts_at, ends_at, published_at, task_timezone, status from public.needs where id = any(array[${Object.values(planIds.tasks).map(id => q(id) + '::uuid').join(',')}])`);
  assert.equal(stored.length, Object.keys(built.tasks).length, label + ' TASKS_STORED');
  const ms = value => (value === null || value === undefined ? null : Date.parse(value));
  for (const [key, task] of Object.entries(built.tasks)) {
    const row = stored.find(item => item.id === planIds.tasks[key]);
    assert.equal(row.status, 'PUBLISHED', `${label} TASK_STATUS ${key}`);
    assert.equal(row.schedule_kind, task.kind, `${label} TASK_KIND ${key}`);
    assert.equal(ms(row.published_at), task.publishedAt ?? null, `${label} TASK_PUBLISHED_AT ${key}`);
    assert.equal(ms(row.starts_at), task.startsAt ?? null, `${label} TASK_STARTS_AT ${key}`);
    assert.equal(ms(row.ends_at), task.endsAt ?? null, `${label} TASK_ENDS_AT ${key}`);
    assert.equal(row.task_timezone, task.taskZone, `${label} TASK_ZONE ${key}`);
  }
  const workers = rows(`select p.id, p.profile_status, p.available_now, (select count(*) from public.profile_availability_rules r where r.profile_id = p.id)::integer as rules,
      (select count(*) from public.profile_availability_windows w where w.profile_id = p.id)::integer as windows, (select m.timezone from public.worker_match_preferences m where m.worker_profile_id = p.id) as zone
    from public.app_profiles p where p.id = any(array[${Object.values(planIds.workers).map(id => q(id.profile) + '::uuid').join(',')}])`);
  assert.equal(workers.length, Object.keys(built.workers).length, label + ' WORKERS_STORED');
  for (const [key, worker] of Object.entries(built.workers)) {
    const row = workers.find(item => item.id === planIds.workers[key].profile);
    assert.deepEqual([row.profile_status, row.available_now, row.rules, row.windows, row.zone], [worker.status ?? 'ACTIVE', worker.availableNow, worker.rules.length, worker.windows.length, worker.zone],
      `${label} WORKER_STORED ${key}`);
  }
  return {built, planIds};
}
async function installMatrix() {
  const installed = await installPlan(lib.buildMatrix, 'MATRIX');
  plan = installed.built; ids = installed.planIds;
  report.matrix = {cases: plan.cases.length, unchangedPairs: plan.unchanged.length, tasks: Object.keys(plan.tasks).length, workers: Object.keys(plan.workers).length, anchors: plan.anchors};
  save();
}
function readPlan(part, partIds) {
  const out = {}, pairs = lib.pairsOf(part, partIds);
  for (let i = 0; i < pairs.length; i += 30) {
    for (const row of rows(lib.evaluationSql(pairs.slice(i, i + 30), q))) out[row.pair] = {admitted: row.admitted, cheap: row.cheap, detail: row.detail, codes: lib.scheduleCodesOf(row.detail)};
  }
  assert.equal(Object.keys(out).length, pairs.length, 'ALL_PAIRS_READ');
  return out;
}
const readMatrix = () => readPlan(plan, ids);
/**
 * state = 'before' (the predecessor) | 'after' (the candidate): every case against its written expectation through lib.pairProblems (the gate, the COMPLETE blocker lists, the eligibility - a flip must be
 * dispatchEligible - the cheap gate and the structure of every full detail), the unchanged pairs against theirs (their complete codes included) and, for 'after' with the before-results, the WHOLE detail against
 * the before-detail (only the intended fields change).
 */
function checkPlan(part, results, state, before = null) {
  for (const item of part.cases) {
    const got = results[item.id], active = (part.workers[item.worker].status ?? 'ACTIVE') === 'ACTIVE';
    assert.deepEqual(lib.pairProblems({expect: item[state], got, active}), [], `${state} ${item.id} (${item.note})`);
    if (state === 'after' && before) {
      const flips = !item.before.admitted && item.after.admitted;
      const pausedGone = (item.before.codes ?? []).includes('CURRENT_AVAILABILITY_PAUSED') && !(item.after.codes ?? []).includes('CURRENT_AVAILABILITY_PAUSED');
      assert.deepEqual(lib.detailDelta(before[item.id].detail, got.detail, {flips, pausedGone}), [], `after ${item.id}: only the intended fields of match_detail changed (flip ${flips}, paused code gone ${pausedGone})`);
    }
  }
  for (const item of part.unchanged) assert.deepEqual(lib.pairProblems({expect: {admitted: item.admitted, codes: item.codes}, got: results[item.id], active: true}), [], `${state} ${item.id}: unchanged behaviour`);
}
const checkMatrix = (results, state, before = null) => checkPlan(plan, results, state, before);
/**
 * The CLOCK FAMILY (a WEEK task published now: the part of the week before now is over, the rest of today and the last hour of the week are still to come): installed afresh and read at once, before
 * every read of the matrix, so that each read sees windows that are still to come "now" (the matrix is read over about an hour). state as in checkPlan.
 */
async function readClockFamily(state, label) {
  const {built, planIds} = await installPlan(lib.buildClockFamily, 'CLOCK_FAMILY ' + label);
  const results = readPlan(built, planIds);
  checkPlan(built, results, state);
  report.clockFamily = {...(report.clockFamily ?? {}), [label]: {state, cases: built.cases.length, anchors: built.anchors}};
  save();
  return built.cases.length;
}
const sameMatrix = (a, b, keys, label) => {
  for (const key of keys) {
    assert.equal(a[key].admitted, b[key].admitted, `${label} ${key} admitted`);
    assert.equal(a[key].cheap, b[key].cheap, `${label} ${key} cheap`);
    assert.deepEqual(a[key].detail, b[key].detail, `${label} ${key} match_detail`);
  }
};
const compactMatrix = results => Object.fromEntries(Object.entries(results).map(([key, value]) => [key, {admitted: value.admitted, cheap: value.cheap, codes: value.codes}]));

// ------------------------------------------------------------------ the corpus passes (the S03 runner on the real S02 corpus; lib/ is imported, never edited)
const mods = loadModules({client: null, accountId: null});
const registry = mods.load('contracts/needFactsV2').NEED_FACT_V2_DEFINITIONS;
const corpusText = readFileSync(corpusPath, 'utf8');
const corpus = loadCorpus(JSON.parse(corpusText), {registry, label: 'CORPUS', normaliseNative: normaliseCorpus});
const corpusIds = corpus.cases.map(item => item.id);
report.corpus = {path: corpusPath, sha256: sha(corpusText), sha256Lf: lib.corpusTextSha256(corpusText), id: corpus.id, version: corpus.version, totalCases: corpus.totalCases, buildableCases: corpus.cases.length,
  skipped: corpus.skipped.length, idsSha256: lib.corpusIdsSha256(corpusIds), pinned: lib.CORPUS_PIN};
const fx = createFixtures(rt, {needPath: 'product'});
const taskCaseIds = ['T-003', 'T-006'];
// the stored task of an evidence case (T-003, T-006): the narrow fixture rule rests on it (no window, no foreign zone, the pass-clock publication day)
const readStoredNeed = needId => rows(`select schedule_kind, starts_at, ends_at, published_at, task_timezone from public.needs where id = ${q(needId)}::uuid`)[0] ?? null;
const corpusPass = createPassRunner({fx, corpus, registry, sourceSha: env.GITHUB_SHA ?? null, bodyMd5, readStoredNeed, randomUUID, say, sleep, expectedCases: lib.CORPUS_PIN.buildableCases,
  record: (label, summary, findingKeys) => { report.passes = {...(report.passes ?? {}), [label]: {...summary, findingKeys}}; save(); }});
// ONE rebase serves every pass (the runner reuses the first): the stored times of every case, and so the full detail (liveStateDate), are the same in every pass
const sameTimes = (reference, other, label) => assert.deepEqual(lib.corpusTimeProblems(reference.times, other.times, {referenceRebase: reference.summary.rebase, otherRebase: other.summary.rebase}), [],
  'THE_CORPUS_TIMES_AND_THE_REBASE_ARE_THE_SAME_IN_EVERY_PASS: ' + label);
const pick = (outcomes, idsWanted) => Object.fromEntries(idsWanted.map(id => [id, outcomes[id]]));
const pickDetails = (details, idsWanted) => Object.fromEntries(Object.entries(details).filter(([key]) => idsWanted.includes(key.split('|')[0])));

async function main() {
  const surfaceBefore = surface(), catalogBefore = catalog(), closureBefore = closure();
  assert.equal(closureBefore.ready, true); assert.equal(closureBefore.live, closureBefore.certified);
  report.certificateBefore = closureBefore;
  assert.equal(corpusOverride, null, 'EX06_CORPUS_OVERRIDE_REFUSED: ' + corpusOverride);
  assert.deepEqual(lib.corpusPinProblems({path: corpusPath, text: corpusText, ids: corpusIds}), [], 'THE_CORPUS_IS_NOT_THE_PINNED_ONE');

  // ================================================================ 0 CHAIN FIDELITY
  const pins = lib.parsePins(candidate);
  assert.equal(pins.length, 12, 'two targets and ten neighbours');
  assert.deepEqual([pins[0].signature, pins[1].signature], [TARGET, DETAIL]);
  assert.deepEqual([pins[0].md5, pins[1].md5], [lib.OLD_MD5, lib.DETAIL_OLD_MD5]);
  report.chainFidelity = pins.map(pin => ({signature: pin.signature, pinDevMd5: pin.md5, chainMd5: bodyMd5(pin.signature)}));
  const differing = report.chainFidelity.filter(item => item.pinDevMd5 !== item.chainMd5);
  report.chainFidelityVerdict = differing.length ? 'CHAIN_DIFFERS_FROM_DEV: ' + differing.map(item => item.signature).join('; ') : 'EQUAL: every pin the candidate enforces (the 2 targets + 10 neighbours) equals the DEV md5 on the chain';
  save();
  assert.deepEqual(differing, [], 'CHAIN_FIDELITY_FINDING: the chain does not carry the DEV predecessor; the candidate (exact pins) cannot be proven on it, and nothing is faked');
  // the S03 gate: the matcher, dispatch (incl. private.dispatch_next_wave, which turns dispatchEligible into deliveries), event and push functions the corpus evidence depends on
  const gate = evaluatePins(rows(pinQuery(PROOF_POINT_PINS)), PROOF_POINT_PINS);
  report.s03PinGate = {label: evidenceLabel(gate), equal: gate.equal.length, different: gate.different, missing: gate.missing, rows: pinRowsOf(gate, PROOF_POINT_PINS)};
  save();
  assert.deepEqual([gate.different, gate.missing], [[], []], 'S03_PIN_GATE_FINDING: a function the corpus evidence depends on differs from DEV on the chain: ' + JSON.stringify(report.s03PinGate.rows.filter(row => row.verdict !== 'EQUAL')));
  assert.equal(bodyMd5(TARGET), lib.OLD_MD5); assert.equal(bodyMd5(DETAIL), lib.DETAIL_OLD_MD5);
  // the bytes the DO will produce for the second function, computed independently of the DO from the chain's own body
  const chainDetail = bodyText(DETAIL);
  assert.equal(chainDetail.split(detailAnchor).length - 1, 1, 'THE_ANCHOR_OCCURS_ONCE_IN_THE_CHAIN_BODY');
  assert.equal(md5(chainDetail.split(detailAnchor).join(detailReplacement)), DETAIL_NEW_MD5, 'THE_PINNED_NEW_BODY_MD5_IS_WHAT_THE_EDIT_PRODUCES_ON_THE_CHAIN_BODY');
  pass('CHAIN_PREDECESSORS_EQUAL_THE_DEV_PINS_BOTH_TARGETS_TEN_NEIGHBOURS_AND_THE_S03_PIN_GATE');
  await fx.reloadSchema();
  report.schedulers = fx.pauseSchedulers();

  // ================================================================ 1 BEFORE
  await installMatrix();
  const matrixBefore = readMatrix();
  checkMatrix(matrixBefore, 'before');
  report.matrixBefore = compactMatrix(matrixBefore);
  await readClockFamily('before', 'BEFORE');
  pass('BEFORE_MATRIX_THE_PREDECESSOR_REFUSES_EVERY_WINDOWLESS_FLEXIBLE_TASK_AND_ANSWERS_THE_UNCHANGED_KINDS_AS_WRITTEN');
  const passBefore = await corpusPass('before');
  report.corpusRebase = passBefore.summary.rebase;
  const vanillaBefore = await corpusPass('before-vanilla', {caseIds: taskCaseIds, augment: false, canary: false});
  sameTimes(passBefore, vanillaBefore, 'before-vanilla');
  assert.deepEqual(lib.diffOutcomes(pick(passBefore.outcomes, taskCaseIds), vanillaBefore.outcomes), [], 'THE_ADJUSTED_FIXTURE_CHANGES_NOTHING_ON_THE_PREDECESSOR');
  for (const id of taskCaseIds) assert.equal(passBefore.outcomes[id].workers.fits.dispatchEligible, false, 'F1_REPRODUCED ' + id);
  for (const id of taskCaseIds) assert.deepEqual(passBefore.outcomes[id].workers.fits.dispatchBlockers, ['OUTSIDE_AVAILABILITY'], 'F1_REPRODUCED_BY_NAME ' + id);
  for (const [id, label] of [['T-003', 'unknown-capability'], ['T-006', 'does-not-fit'], ['T-006', 'unknown-capability']]) {
    assert.deepEqual(passBefore.outcomes[id].workers[label].dispatchBlockers, ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY'], `F3_REPRODUCED ${id} ${label}`);
  }
  pass('BEFORE_CORPUS_F1_REPRODUCED_EVEN_FOR_A_WORKER_WHO_DECLARES_A_NARROW_SCHEDULE_AND_THE_ADJUSTMENT_CHANGES_NOTHING_ON_THE_PREDECESSOR');
  assert.equal(passBefore.findings.length > 0, true);
  assert.throws(() => sql(revert), /EX06A_REVERT_STATE_NOT_THE_APPLIED_ONE/);
  assert.deepEqual(surface(), surfaceBefore); assert.equal(bodyMd5(TARGET), lib.OLD_MD5); assert.equal(bodyMd5(DETAIL), lib.DETAIL_OLD_MD5);
  pass('REVERT_REFUSES_ON_THE_PREDECESSOR_ATOMICALLY');

  // ================================================================ 2 APPLY
  const driftNeighbour = lib.tamperPin(candidate, pins[2].signature), driftTarget = lib.tamperPin(candidate, TARGET), driftDetail = lib.tamperPin(candidate, DETAIL);
  for (const drifted of [driftNeighbour, driftTarget, driftDetail]) assert.notEqual(drifted, candidate);
  assert.throws(() => sql(driftNeighbour), new RegExp('EX06A_PREDECESSOR_DRIFT: ' + pins[2].signature.split('(')[0].replace('.', '\\.')));
  assert.throws(() => sql(driftTarget), /EX06A_PREDECESSOR_DRIFT: private\.worker_dispatch_time_admitted/);
  assert.throws(() => sql(driftDetail), /EX06A_PREDECESSOR_DRIFT: private\.match_detail_without_calendar/);
  assert.deepEqual(surface(), surfaceBefore); assert.equal(bodyMd5(TARGET), lib.OLD_MD5); assert.equal(bodyMd5(DETAIL), lib.DETAIL_OLD_MD5);
  pass('PREDECESSOR_DRIFT_REFUSED_ATOMICALLY_FOR_A_NEIGHBOUR_AND_FOR_EACH_OF_THE_TWO_TARGETS');
  assert.throws(() => sql(candidate.replace(/\n/g, '\r\n')), /EX06A_CRLF_TEXT/);
  assert.deepEqual(surface(), surfaceBefore); assert.equal(bodyMd5(TARGET), lib.OLD_MD5); assert.equal(bodyMd5(DETAIL), lib.DETAIL_OLD_MD5);
  pass('A_CRLF_TEXT_IS_REFUSED_ATOMICALLY');
  assert.throws(() => sql(`begin; set local session_replication_role=replica; update private.closure_source_v5 set sha256=repeat('0',64) where singleton; ${candidate}\nrollback;`), /EX06A_CLOSURE_NOT_READY/);
  assert.deepEqual(surface(), surfaceBefore); assert.deepEqual(closure(), closureBefore);
  pass('UNCERTIFIED_CLOSURE_REFUSED_ATOMICALLY');
  sql(candidate);
  assert.throws(() => sql(candidate), /EX06A_ALREADY_APPLIED/);
  pass('APPLIED_ONCE_SECOND_RUN_REFUSED');
  assert.equal(bodyMd5(TARGET), NEW_MD5); assert.equal(bodyMd5(DETAIL), DETAIL_NEW_MD5);
  const surfaceAfter = surface(), catalogAfter = catalog();
  const surfaceDelta = lib.surfaceDelta(surfaceBefore, surfaceAfter);
  assert.equal(surfaceDelta.onlyBodiesChanged, true, 'EXACTLY_THE_BODIES_OF_THE_TWO_TARGETS_CHANGED_AND_ONLY_THEIR_MD5');
  assert.equal(surfaceDelta.names.length, 2);
  assert.deepEqual(surfaceDelta.names.map(name => name.split('(')[0]), targetNames, 'THE_CHANGED_SURFACE_LINES_ARE_THE_TWO_TARGETS: ' + surfaceDelta.names.join(' ; '));
  report.surfaceRemoved = surfaceDelta.removed; report.surfaceAdded = surfaceDelta.added;
  const catalogDelta = lib.diffNamed(catalogBefore, catalogAfter);
  assert.deepEqual([catalogDelta.added, catalogDelta.removed], [[], []]);
  assert.equal(catalogDelta.changed.length, 2);
  assert.deepEqual(catalogDelta.changed.map(item => item.name.replace(/^function:/, '').split('(')[0]), targetNames);
  const changedOf = name => catalogDelta.changed.find(item => item.name.startsWith('function:' + name + '('));
  assert.deepEqual([changedOf(targetNames[1]).before, changedOf(targetNames[1]).after], [lib.OLD_MD5, NEW_MD5]);
  assert.deepEqual([changedOf(targetNames[0]).before, changedOf(targetNames[0]).after], [lib.DETAIL_OLD_MD5, DETAIL_NEW_MD5]);
  report.catalogChanged = catalogDelta.changed;
  pass('EXACTLY_TWO_FUNCTIONS_CHANGED_NOTHING_ADDED_NOTHING_REMOVED_ATTRIBUTES_AND_ACL_EQUAL');
  assert.deepEqual(closure(), closureBefore);
  pass('CERTIFICATE_UNCHANGED_READY_AFTER_THE_APPLICATION');
  const flight = JSON.parse(sql(postflight));
  assert.deepEqual(flight.problems, []); assert.deepEqual(flight.informational, []); report.postflight = flight;
  assert.equal(report.chainFidelity.length, flight.pinsChecked, 'THE_POSTFLIGHT_CHECKS_THE_SAME_PINS');
  pass('DEV_POSTFLIGHT_FILE_EMPTY_ON_THE_CHAIN');
  report.candidateSha256 = sha(trimmed(candidate)); report.revertSha256 = sha(trimmed(revert)); report.postflightSha256 = sha(trimmed(postflight));
  assert.throws(() => sql(revert.replace(/\n/g, '\r\n')), /EX06A_REVERT_CRLF_TEXT/);
  assert.equal(bodyMd5(TARGET), NEW_MD5); assert.equal(bodyMd5(DETAIL), DETAIL_NEW_MD5);
  pass('A_CRLF_REVERT_IS_REFUSED_ATOMICALLY');

  // ================================================================ 3 AFTER
  const matrixAfter = readMatrix();
  checkMatrix(matrixAfter, 'after', matrixBefore);
  const unchangedKeys = plan.unchanged.map(item => item.id);
  sameMatrix(matrixBefore, matrixAfter, unchangedKeys, 'UNCHANGED_BY_THE_CANDIDATE');
  const stayKeys = plan.cases.filter(item => item.before.admitted === item.after.admitted && JSON.stringify(item.before.codes) === JSON.stringify(item.after.codes)).map(item => item.id);
  assert.ok(stayKeys.length >= 40, 'the stay-refused cases are many: ' + stayKeys.length);
  sameMatrix(matrixBefore, matrixAfter, stayKeys, 'STAYS_REFUSED');
  report.matrixAfter = compactMatrix(matrixAfter);
  await readClockFamily('after', 'AFTER');
  pass('AFTER_MATRIX_THE_DERIVED_WINDOW_ADMITS_REAL_AVAILABILITY_INSIDE_IT_AND_NOTHING_ELSE_DST_EDGES_ZONES_ANCHOR_DAYS_WEEK_BOUNDARIES_THE_REST_OF_TODAY_AND_THE_FULL_DETAIL_INCLUDED');
  const passAfter = await corpusPass('after');
  sameTimes(passBefore, passAfter, 'after');
  const flips = lib.checkFlips(lib.diffOutcomes(passBefore.outcomes, passAfter.outcomes), lib.INTENDED_FLIPS);
  report.corpusFlips = {matched: flips.matched.length, unintended: flips.unintended, missing: flips.missing};
  assert.deepEqual(flips.unintended, [], 'UNINTENDED_FLIPS_ON_THE_CORPUS');
  assert.deepEqual(flips.missing, [], 'INTENDED_FLIPS_MISSING_ON_THE_CORPUS');
  assert.equal(flips.matched.length, lib.INTENDED_FLIPS.length);
  const detailProblemsAfter = lib.corpusDetailProblems(passBefore.details, passAfter.details);
  report.corpusDetailProblems = detailProblemsAfter;
  assert.deepEqual(detailProblemsAfter, [], 'THE_FULL_MATCH_DETAIL_OF_EVERY_CORPUS_WORKER_CHANGED_ONLY_AS_INTENDED');
  const removed = passBefore.findings.filter(key => !passAfter.findings.includes(key)), added = passAfter.findings.filter(key => !passBefore.findings.includes(key));
  assert.deepEqual(added, [], 'NO_NEW_FINDING_AFTER_THE_CANDIDATE');
  assert.deepEqual([...removed].sort(), [...lib.FINDINGS_CLOSED].sort(), 'THE_FINDINGS_THE_CANDIDATE_CLOSES_ARE_EXACTLY_F1_AND_THE_THREE_PAUSED_CODE_DISAGREEMENTS_OF_F3');
  report.findingsClosed = removed;
  pass('AFTER_CORPUS_THE_ONLY_DIFFERENCES_ARE_THE_WRITTEN_INTENDED_FLIPS_T003_AND_T006_FITS_ELIGIBLE_AND_DELIVERED_THE_NONE_DECLARED_WORKERS_LOSE_ONLY_THE_PAUSED_CODE_EVERYTHING_ELSE_IDENTICAL');
  const vanillaAfter = await corpusPass('after-vanilla', {caseIds: taskCaseIds, augment: false, canary: false});
  sameTimes(passBefore, vanillaAfter, 'after-vanilla');
  const vanillaFlips = lib.checkFlips(lib.diffOutcomes(vanillaBefore.outcomes, vanillaAfter.outcomes), lib.VANILLA_INTENDED_FLIPS);
  assert.deepEqual([vanillaFlips.unintended, vanillaFlips.missing], [[], []], 'VANILLA_S03_FIXTURE_CHANGES_ONLY_THE_PAUSED_CODE_OF_THE_NONE_DECLARED_WORKERS');
  for (const id of taskCaseIds) assert.deepEqual(vanillaAfter.outcomes[id].workers.fits.dispatchBlockers, ['OUTSIDE_AVAILABILITY'], 'VANILLA_FITS_STAYS_REFUSED ' + id);
  pass('AFTER_VANILLA_THE_UNMODIFIED_S03_FIXTURE_STILL_CANNOT_BE_ADMITTED_DECISION_D1_LIVE_INTENT_ALONE_IS_NOT_AVAILABILITY');
  assert.deepEqual(closure(), closureBefore); assert.deepEqual(surface(), surfaceAfter);
  pass('CERTIFICATE_AND_SURFACE_STAY_AFTER_THE_READS_AND_THE_DATA_WRITES');

  // ================================================================ 4 REVERT
  sql(revert);
  assert.equal(bodyMd5(TARGET), lib.OLD_MD5); assert.equal(bodyMd5(DETAIL), lib.DETAIL_OLD_MD5);
  assert.deepEqual(surface(), surfaceBefore, 'THE_WHOLE_SURFACE_IS_RESTORED_EXACTLY');
  assert.deepEqual(catalog(), catalogBefore, 'THE_WHOLE_CATALOG_IS_RESTORED_EXACTLY');
  assert.deepEqual(closure(), closureBefore);
  assert.throws(() => sql(revert), /EX06A_REVERT_STATE_NOT_THE_APPLIED_ONE/);
  pass('REVERT_RESTORES_THE_MD5_PINS_THE_SURFACE_AND_THE_CATALOG_AND_REFUSES_TO_RUN_TWICE');
  const matrixReverted = readMatrix();
  sameMatrix(matrixBefore, matrixReverted, Object.keys(matrixBefore), 'REVERTED_EQUALS_BEFORE');
  await readClockFamily('before', 'REVERTED');
  pass('REVERTED_MATRIX_EQUALS_THE_BEFORE_MATRIX_ANSWER_FOR_ANSWER_AND_DETAIL_FOR_DETAIL');
  const passReverted = await corpusPass('reverted');
  sameTimes(passBefore, passReverted, 'reverted');
  assert.deepEqual(lib.diffOutcomes(passBefore.outcomes, passReverted.outcomes), [], 'REVERTED_CORPUS_EQUALS_BEFORE');
  assert.deepEqual(lib.corpusDetailProblems(passBefore.details, passReverted.details, {}), [], 'REVERTED_DETAILS_EQUAL_BEFORE');
  assert.deepEqual(passReverted.findings, passBefore.findings);
  const vanillaReverted = await corpusPass('reverted-vanilla', {caseIds: taskCaseIds, augment: false, canary: false});
  sameTimes(passBefore, vanillaReverted, 'reverted-vanilla');
  assert.deepEqual(lib.diffOutcomes(vanillaBefore.outcomes, vanillaReverted.outcomes), []);
  pass('REVERTED_CORPUS_EQUALS_THE_BEFORE_CORPUS_EVERY_CASE_WORKER_REFUSAL_DELIVERY_AND_FULL_DETAIL');

  // ================================================================ 5 REAPPLY
  sql(candidate);
  assert.equal(bodyMd5(TARGET), NEW_MD5); assert.equal(bodyMd5(DETAIL), DETAIL_NEW_MD5);
  assert.deepEqual(surface(), surfaceAfter, 'REAPPLY_PRODUCES_THE_SAME_SURFACE');
  assert.deepEqual(catalog(), catalogAfter, 'REAPPLY_PRODUCES_THE_SAME_CATALOG');
  assert.deepEqual(closure(), closureBefore);
  const flightAgain = JSON.parse(sql(postflight));
  assert.deepEqual([flightAgain.problems, flightAgain.informational], [[], []]);
  const matrixAgain = readMatrix();
  sameMatrix(matrixAfter, matrixAgain, Object.keys(matrixAfter), 'REAPPLIED_EQUALS_AFTER');
  await readClockFamily('after', 'REAPPLIED');
  const passAgain = await corpusPass('reapplied', {caseIds: taskCaseIds, canary: false});
  sameTimes(passBefore, passAgain, 'reapplied');
  assert.deepEqual(lib.diffOutcomes(pick(passAfter.outcomes, taskCaseIds), passAgain.outcomes), [], 'REAPPLIED_FLIPS_EQUAL_AFTER');
  assert.deepEqual(lib.corpusDetailProblems(pickDetails(passAfter.details, taskCaseIds), passAgain.details, {}), [], 'REAPPLIED_DETAILS_EQUAL_AFTER');
  pass('REAPPLY_AGAIN_EQUAL_SURFACE_CATALOG_MATRIX_AND_THE_T003_T006_FLIPS');
  report.certificateAfter = closure();
  report.result = 'PASS'; save();
}
main().catch(error => { report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 4000); save(); console.error(report.failure); process.exit(1); });
