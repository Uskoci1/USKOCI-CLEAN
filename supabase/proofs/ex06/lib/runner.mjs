// EX-06 S03/S04: the orchestration of a corpus run (one case: build, read back, match, wave, observe, compare, retire), the canary, and the bookkeeping of a report.
// Pure given the fixture factory it is handed: ex06_s03_proof.mjs passes the real one (lib/fixtures.mjs over the proof adapter), the tests pass a scripted fake.
//
// What makes a result evidence rather than a green light:
//   * the canary runs first and any disagreement is a HARNESS_ERROR (a fixture or chain defect), never a finding;
//   * every matcher result and every wave result is shape-validated before it can make an expectation pass (a null matcher result, a NEED_NOT_FOUND shape, a wave that stopped early
//     or ran as round 2 are harness errors, not vacuous passes);
//   * every fixture is read back; a field the product dropped is FIXTURE_NOT_APPLIED:<field>;
//   * a case the product refuses to publish is a FINDING (PRODUCT_PATH_REFUSED_READY_CASE), never silently matched on a direct insert, and it is NOT compared: the scope says so;
//   * every case needs a negative of the CORPUS that names its cause (the harness's own control does not count), or an explicit positiveOnly with the corpus's reason that the report lists;
//   * a schedule shape the corpus asked for that could not be built (the task stores no window) is SHAPE_DEGRADED, never a quiet available-now-only worker;
//   * the result is PASS | FINDINGS | SMOKE_ONLY | PARTIAL | HARNESS_BROKEN, SMOKE never yields PASS, a refused, SHAPE_DEGRADED, degraded, capped or unrun case yields PARTIAL, and every
//     result is quoted with its scope ("PASS on N of M cases, K refused, L skipped, X of Y leaves compared").
import {classifyFields, compareExpectation, comparisonRows, gatesOf, isUnattributed, namesCause, refreshScope, REFUSED_KIND, sortedSet} from './compare.mjs';
import {CANARY_CORPUS, STANDARD_LABELS, hasBypassFacts, normaliseCorpus, referenceWorkerPlan, unreachableReason} from './corpus.mjs';
import {isInfrastructureFailure} from './fixtures.mjs';
import {haversineKm, primaryCity} from './geo.mjs';
import {materialiseTimes} from './timeutil.mjs';

/** The pin-gate md5 of the functions a finding "ran against", by short name. match_detail and dispatch_tick are on the dispatch path (the wave calls match_detail per candidate). */
export const BODY_KEYS = Object.freeze({
  'private.match_detail': 'matchDetail', 'private.match_detail_for_calendar_interval': 'matchDetailForCalendarInterval', 'private.match_detail_without_calendar': 'matchDetailWithoutCalendar',
  'private.dispatch_next_wave': 'dispatchNextWave', 'private.dispatch_tick': 'dispatchTick', 'private.dispatch_cheap_candidate_admitted': 'dispatchCheapCandidateAdmitted',
  'private.candidate_profile_ids': 'candidateProfileIds', 'private.emit_event': 'emitEvent', 'private.push_suppression': 'pushSuppression', 'private.work_kinds_v5': 'workKindsV5',
});

export const short = md5 => (typeof md5 === 'string' ? md5.slice(0, 8) : String(md5));

/** {matchDetail: '38c7894a', ...} from the pin gate's body map. */
export const matcherBodiesOf = bodies => Object.fromEntries(Object.entries(BODY_KEYS).map(([name, key]) => [key, short(bodies[name])]));

/** A failure of the HARNESS (a fixture could not be applied, a result has an impossible shape): the case becomes a HARNESS_ERROR entry and the process exits non-zero. */
export class HarnessFailure extends Error {
  constructor(code, detail) {
    super(code + (detail ? ': ' + detail : ''));
    this.code = code;
  }
}

/** Console output of a run; the offline tests set EX06_QUIET=1 so that the many deliberate failures they provoke do not drown their own report. */
export const say = text => { if (process.env.EX06_QUIET !== '1') console.log(text); };
export const shout = text => { if (process.env.EX06_QUIET !== '1') console.error(text); };

export function harnessError(report, where, error) {
  report.harnessErrors.push({where, message: String(error?.message ?? error).slice(0, 600)});
  shout('HARNESS_ERROR ' + where + ': ' + String(error?.message ?? error).slice(0, 600));
}

export function addFinding(report, caseId, worker, field, expected, actual, bodies, extra = {}) {
  report.findings.push({caseId, worker, field, expected, actual, bodies, bodiesShort: Object.entries(bodies).map(([name, md5]) => name + ':' + md5).join(' '), ...extra});
}

// ------------------------------------------------------------------ shape validation of what the database returned
const isArrayOfStrings = value => Array.isArray(value) && value.every(item => typeof item === 'string');

/**
 * private.match_detail returns an early shape {responseAllowed:false, dispatchEligible:false, hardBlockers:['NEED_NOT_FOUND' | 'WORKER_PROFILE_NOT_FOUND']} with no dispatchBlockers or
 * workerProfileId when a row is missing; a null result or a non-object is just as unusable. Each of them would make most negative expectations vacuously true, so each is refused.
 * `worker` = {profileId, id}. The matcher's own invariants are checked too: responseAllowed == no hard blocker, dispatchEligible == no blocker at all.
 */
export function assertMatchShape(match, worker) {
  const fail = why => { throw new HarnessFailure('MATCH_SHAPE_INVALID', why); };
  if (match === null || typeof match !== 'object' || Array.isArray(match)) fail('the matcher returned ' + JSON.stringify(match));
  if (isArrayOfStrings(match.hardBlockers) && match.hardBlockers.some(code => code === 'NEED_NOT_FOUND' || code === 'WORKER_PROFILE_NOT_FOUND')) fail('the matcher answered ' + match.hardBlockers.join(','));
  if (match.workerProfileId !== worker.profileId) fail(`workerProfileId ${match.workerProfileId} is not ${worker.profileId}`);
  if (worker.id !== undefined && match.workerAccountId !== worker.id) fail(`workerAccountId ${match.workerAccountId} is not ${worker.id}`);
  for (const key of ['hardBlockers', 'dispatchBlockers', 'reasonCodes']) if (!isArrayOfStrings(match[key])) fail(`${key} is not an array of strings`);
  for (const key of ['responseAllowed', 'dispatchEligible']) if (typeof match[key] !== 'boolean') fail(`${key} is not a boolean`);
  if (!Number.isFinite(match.score)) fail('score is not a finite number');
  if (match.responseAllowed !== (match.hardBlockers.length === 0)) fail('responseAllowed disagrees with hardBlockers');
  if (match.dispatchEligible !== (match.hardBlockers.length === 0 && match.dispatchBlockers.length === 0)) fail('dispatchEligible disagrees with the blockers');
  return match;
}

/**
 * private.dispatch_next_wave returns normally with {status:'STOPPED', reason, inserted:0} when it did nothing (NEED_NOT_OPEN, SLOTS_FILLED, WAVES_EXHAUSTED,
 * RESPONSE_TARGET_AND_COVERAGE_REACHED), and with status 'STOPPED' and NO `reason` key when it looked and found nobody (the round row then says NO_ELIGIBLE_CANDIDATES).
 * Anything but SENT or that genuine STOPPED, a null result, or a round other than the first wave of the task is a harness error: otherwise every delivery:false would pass.
 * `expectedDeliveries` = the workers the corpus expects to be reached; a batch smaller than that cannot prove them.
 */
export function assertWaveShape(wave, {expectedDeliveries = 0} = {}) {
  const fail = (code, why) => { throw new HarnessFailure(code, why); };
  if (wave === null || typeof wave !== 'object' || Array.isArray(wave)) fail('WAVE_SHAPE_INVALID', 'the wave returned ' + JSON.stringify(wave));
  if ('reason' in wave) fail('WAVE_DID_NOT_RUN', `status ${wave.status}, reason ${wave.reason}`);
  if (wave.status !== 'SENT' && wave.status !== 'STOPPED') fail('WAVE_SHAPE_INVALID', 'status ' + JSON.stringify(wave.status));
  if (wave.round !== 1 || wave.policyWaveNo !== 1) fail('WAVE_NOT_FIRST', `round ${wave.round}, policyWaveNo ${wave.policyWaveNo}: a background tick ran an earlier wave`);
  if (!Number.isInteger(wave.inserted) || wave.inserted < 0 || !Number.isInteger(wave.batchSize) || wave.batchSize < 1) fail('WAVE_SHAPE_INVALID', `inserted ${wave.inserted}, batchSize ${wave.batchSize}`);
  if ((wave.status === 'SENT') !== (wave.inserted > 0)) fail('WAVE_SHAPE_INVALID', `status ${wave.status} with inserted ${wave.inserted}`);
  if (wave.batchSize < expectedDeliveries) fail('WAVE_FULL', `batchSize ${wave.batchSize} is smaller than the ${expectedDeliveries} workers the corpus expects to be reached`);
  return wave;
}

// ------------------------------------------------------------------ bookkeeping
const distinctSets = new WeakMap();
function distinctSet(report) {
  if (!distinctSets.has(report)) distinctSets.set(report, new Set());
  return distinctSets.get(report);
}

/** What was really asserted of one corpus expectation: positive = a worker expected to be reached or eligible, negative = a worker expected to be refused or blocked; counted per bucket. */
export function tally(report, bucket, caseId, workerLabel, expect, asserted) {
  const split = classifyFields(Object.fromEntries(asserted.map(field => [field, expect[field]])));
  if (bucket === 'matcher') {
    report.assertions.matcher += asserted.length;
    report.assertions.positive += split.positive.length;
    report.assertions.negative += split.negative.length;
    const set = distinctSet(report);
    for (const gate of gatesOf(expect)) set.add(`${caseId}|${workerLabel}|${gate}`);
    report.assertions.distinct = set.size;
  } else {
    report.assertions[bucket] += asserted.length;
  }
}

/** A precondition is not an expectation of the corpus (the schedule row was enqueued, the fixture was read back): counted apart, never as a positive or negative worker assertion. */
const precondition = report => { report.assertions.preconditions += 1; };

const compact = row => (row ? Object.fromEntries(Object.entries(row).filter(([key]) => !['requester_account_id'].includes(key))) : null);

// ------------------------------------------------------------------ one case
/**
 * One corpus case on the chain. ctx = {report, matcherBodies, nowMs, rebase, corpusLabel, needPath, controls, foreignTokens}.
 * Never throws: a fixture that cannot be applied becomes a HARNESS_ERROR entry (and the process will exit non-zero), a refusal of the product path for a READY case becomes a FINDING,
 * a disagreement between the corpus and the matcher becomes a FINDING (listed, with the body md5s), and the case's fixtures are always retired.
 */
export async function runCase(fx, caseItem, {report, matcherBodies, nowMs = Date.now(), rebase = null, corpusLabel = 'CORPUS', needPath = 'product', controls = true, foreignTokens = null}) {
  const entry = {id: caseItem.id, family: caseItem.family, status: 'RUN', materialisation: null, synthetic: [], interval: null, scheduleKind: null, rebased: [], degraded: false, unreachable: false,
    positiveOnly: false, positiveOnlyReason: null, shapeDegraded: false, shapeDegradedWorkers: [],
    workers: [], checks: [], notes: [], readBack: {}, wave: null, rounds: null, schedule: null, annotations: caseItem.annotations ?? null};
  const since = fx.mark();
  const stepOf = {current: 'time'};
  const bodies = matcherBodies;
  const reported = new Set();   // `${worker}/${field}` already reported as a finding of the corpus comparison
  try {
    // ---- time: relative and absolute times made concrete against the CI clock
    const times = materialiseTimes(caseItem.expectedFacts, {nowMs, rebase});
    const facts = times.facts;
    entry.interval = times.interval ? {startsAt: times.interval.startsAt, endsAt: times.interval.endsAt} : null;
    entry.scheduleKind = facts['need.schedule_kind'] ?? null;
    entry.rebased = times.rebased;
    const unreachable = unreachableReason(facts);
    if (unreachable) { entry.unreachable = true; entry.unreachableReason = unreachable; report.unreachableCases.push({id: caseItem.id, reason: unreachable}); }
    const bucket = entry.unreachable ? 'unreachable' : 'matcher';

    // ---- plan: the reference workers (plus the harness control) and what the corpus expects of them
    stepOf.current = 'plan';
    const plan = referenceWorkerPlan(caseItem, {controls});
    for (const item of plan) for (const note of item.unconsumed ?? []) entry.notes.push(`UNCONSUMED ${item.label}: ${note.key} = ${JSON.stringify(note.value)}`);
    const live = plan.filter(item => !item.skip);
    for (const item of plan.filter(entry2 => entry2.skip)) entry.notes.push(`worker ${item.label} not built: ${item.skip}`);
    const anchored = live.some(item => !item.control && (item.expect?.dispatchEligible === true || item.expect?.delivery === true));
    // A case is discriminating only through a negative of the CORPUS that names its cause. The harness's own control (the DRAFT copy of the fit worker) is NOT counted: it is the same for every
    // case, so an "everyone eligible" matcher that merely restricts DRAFT profiles would otherwise pass any case that has no negative of its own.
    const named = live.some(item => !item.control && item.expect && classifyFields(item.expect).negative.length > 0 && namesCause(item.expect));
    if (corpusLabel !== 'SMOKE' && !anchored && !caseItem.noEligibleWorker) throw new HarnessFailure('UNANCHORED_CASE', `${caseItem.id}: no worker is expected to be eligible, so a negative can pass because the fixture failed (set noEligibleWorker:true on purpose)`);
    if (corpusLabel !== 'SMOKE' && !named && !caseItem.positiveOnly) throw new HarnessFailure('UNDISCRIMINATING_CASE', `${caseItem.id}: no worker has a negative expectation of the corpus that names its cause (the harness control does not count; set positiveOnly:true with the corpus's reason on purpose)`);
    if (caseItem.positiveOnly) {
      entry.positiveOnly = true;
      entry.positiveOnlyReason = caseItem.positiveOnlyReason ?? null;
      entry.notes.push('POSITIVE_ONLY: ' + (caseItem.positiveOnlyReason ?? 'no reason recorded'));
    } else if (!named) {
      entry.notes.push('CASE_HAS_NO_CORPUS_NEGATIVE: only the harness control gives this case a negative');
      report.warnings.push(`${caseItem.id}: the corpus gives this case no negative that S03 can assert (only the harness control does)`);
    }
    if (!live.some(item => item.expect && !item.control)) {
      entry.status = 'UNASSERTED';
      if (corpusLabel === 'CORPUS') throw new HarnessFailure('UNASSERTED_CASE', `${caseItem.id}: no worker has an expectation`);
    }

    // ---- people
    stepOf.current = 'requester';
    const requester = await fx.createRequester({label: 'req-' + caseItem.id.slice(0, 24), world: 'REAL'});
    stepOf.current = 'workers';
    const built = [];
    for (const item of live) {
      const worker = await fx.createWorker({...item.profile, label: (item.label + '-' + caseItem.id).slice(0, 40), interval: times.interval});
      built.push({...item, worker});
    }
    // A calendar-busy worker (only when the adapter was asked to consume `busy`; S03 reports it UNCONSUMED instead) needs an Agreement over the task window.
    for (const item of built.filter(entry2 => entry2.profile.busy === 'OVERLAPS_TASK_WINDOW')) {
      if (!times.interval) throw new HarnessFailure('BUSY_NEEDS_A_TASK_WINDOW', `${caseItem.id}/${item.label}: busy OVERLAPS_TASK_WINDOW but the task has no window`);
      await fx.bookWorker(item.worker, {startsAt: times.interval.startsAt, endsAt: times.interval.endsAt});
    }
    for (const item of built) if ((item.worker.bypassed ?? []).length) report.bypasses.push({caseId: caseItem.id, worker: item.label, bypassed: item.worker.bypassed});
    stepOf.current = 'foreign';
    const parked = fx.parkForeign();
    foreignTokens?.push(parked);
    report.foreign.parkedWorkers += parked.parkedWorkers;
    if (fx.countForeignActive() > 0) throw new HarnessFailure('FOREIGN_WORKERS_CROWD_WAVE', 'an ACTIVE worker that is not a fixture is still on the chain after parkForeign');

    // ---- the task
    stepOf.current = 'task';
    const direct = unreachable !== null || hasBypassFacts(facts);
    const path = direct ? 'direct' : needPath;
    let need;
    try {
      need = await fx.createNeedFromFacts(requester, facts, {path, nowMs, interval: times.interval});
    } catch (error) {
      const failedStep = error.ex06Step ?? null;
      // A call that timed out (the 30 s abort signal), an aborted call, a conversation that cannot be opened and a turn that cannot be CLAIMED are the harness or the chain failing, not the
      // product refusing a task: they stay harness errors at every step. A refusal of the proposals themselves (provider_turns: the service RPC validates the corpus's own facts) is the
      // product refusing THIS case: a finding of the case, not the end of the whole run.
      if (path === 'product' && failedStep && !isInfrastructureFailure(failedStep, error)) {
        entry.status = 'PRODUCT_PATH_REFUSED';
        entry.step = failedStep;
        entry.error = String(error.message).slice(0, 400);
        entry.materialisation = 'PRODUCT_PATH_REFUSED';
        addFinding(report, caseItem.id, '-', REFUSED_KIND, 'the product path publishes this READY case', `refused at ${failedStep}: ${entry.error}`, bodies,
          {kind: REFUSED_KIND, materialisation: 'PRODUCT_PATH'});
        say('FINDING case ' + caseItem.id + ' (the product path refused it at ' + failedStep + ')');
        return entry;
      }
      throw error;
    }
    entry.materialisation = need.materialisation;
    entry.synthetic = need.synthetic ?? [];
    entry.droppedFacts = need.droppedFacts ?? [];
    const directMaterialised = need.materialisation !== 'PRODUCT_PATH';
    if (directMaterialised) {
      // any direct materialisation is DEGRADED and listed with the facts it dropped; an UNREACHABLE_STATE case is counted apart (below) but is not product-path evidence either
      entry.degraded = true;
      report.degradedCases.push({id: caseItem.id, reason: need.reason ?? (need.productPathFailure ? `product path failed at ${need.productPathFailure.step}` : 'direct materialisation'), dropped: need.droppedFacts ?? [],
        unreachable: entry.unreachable});
    }
    if (need.productPathFailure) entry.notes.push('PRODUCT_PATH_FAILED_AT ' + need.productPathFailure.step + ': ' + need.productPathFailure.message + ' -> the direct insert was used');
    if (need.reason) entry.notes.push(need.reason);
    if ((need.droppedFacts ?? []).length) entry.notes.push('facts the direct insert dropped: ' + need.droppedFacts.join(', '));
    report.paths[directMaterialised ? 'direct' : 'product'] += 1;
    report.bypasses.push({caseId: caseItem.id, task: need.materialisation, synthetic: need.synthetic ?? [], productPathFailure: need.productPathFailure ?? null, reason: need.reason ?? null});
    const where = {materialisation: need.materialisation};
    const effectiveBucket = entry.degraded && !entry.unreachable ? 'degraded' : bucket;

    // ---- read back: what the product stored is what the case intended
    stepOf.current = 'readback';
    const needBack = fx.readBackNeed(need.needId, need.intent ?? {facts, interval: times.interval});
    if (needBack.mismatches.length) throw new HarnessFailure('FIXTURE_NOT_APPLIED:' + needBack.mismatches[0].field, 'task ' + JSON.stringify(needBack.mismatches));
    entry.readBack.need = compact(needBack.row);
    precondition(report);
    const workerBacks = new Map();
    for (const item of built) {
      const back = fx.readBackWorker(item.worker);
      if (back.mismatches.length) throw new HarnessFailure('FIXTURE_NOT_APPLIED:' + back.mismatches[0].field, `worker ${item.label} ${JSON.stringify(back.mismatches)}`);
      workerBacks.set(item.label, back.row);
      precondition(report);
    }
    entry.readBack.workers = Object.fromEntries([...workerBacks].map(([label, row]) => [label, compact(row)]));

    // ---- a schedule shape the CORPUS asked for that could not be built: SHAPE_DEGRADED (never a quiet available-now-only worker). Only workers of the corpus carry the shape they were asked
    // for (annotations.corpusAvailability); the shape the harness picks for a derived worker is its own default and is not a promise of the corpus.
    const degradedShape = built.filter(item => item.annotations?.corpusAvailability && item.worker.shapeCoverage?.wanted === true && item.worker.shapeCoverage.got === 'NONE');
    const shapeDegradedLabels = new Set(degradedShape.map(item => item.label));
    if (degradedShape.length) {
      entry.shapeDegraded = true;
      entry.shapeDegradedWorkers = degradedShape.map(item => ({worker: item.label, shape: item.worker.shapeCoverage.shape, wanted: true, got: item.worker.shapeCoverage.got}));
      for (const item of degradedShape) {
        entry.notes.push(`SHAPE_DEGRADED ${item.label}: the corpus asks for ${item.worker.shapeCoverage.shape} (a weekly rule or window covers the task time) but the task has no window (schedule kind ${entry.scheduleKind ?? 'unknown'}): built as ${item.worker.spec?.availability?.availableNow ? 'available now' : 'not available now'} only`);
      }
      if (needBack.row.starts_at && needBack.row.ends_at) entry.notes.push(`the product stored a window (${needBack.row.starts_at} .. ${needBack.row.ends_at}) the intent did not name: a covering rule could be built after the publish (not done)`);
    }

    // ---- the publish enqueued the task
    stepOf.current = 'schedule';
    const schedule = fx.readSchedule(need.needId);
    entry.schedule = schedule;
    entry.checks.push({field: 'dispatch_schedule row enqueued by the publish', expected: true, actual: schedule.queued, verdict: schedule.queued ? 'PASS' : 'FINDING'});
    precondition(report);
    if (!schedule.queued) addFinding(report, caseItem.id, '-', 'dispatch_schedule row enqueued by the publish', true, false, bodies, where);

    // ---- the matcher (the same function the wave and the pin gate use), shape-validated
    stepOf.current = 'match';
    const geography = facts['need.task_geography'] ?? {mode: 'STATIONARY'};
    for (const item of built) {
      item.match = fx.readMatch(need.needId, item.worker.profileId);
      assertMatchShape(item.match, item.worker);
      const back = workerBacks.get(item.label);
      if (geography.mode === 'REMOTE') {
        if (item.match.distanceToStartKm !== null || item.match.taskLocationMode !== 'REMOTE') throw new HarnessFailure('DISTANCE_NOT_AS_DECLARED', `${item.label}: a REMOTE task must read distance null and mode REMOTE, got ${JSON.stringify([item.match.distanceToStartKm, item.match.taskLocationMode])}`);
        item.distance = {km: null, source: 'REMOTE'};
      } else if (back?.lat !== null && back?.lat !== undefined && needBack.row.approximate_lat !== null) {
        const expected = haversineKm(needBack.row.approximate_lat, needBack.row.approximate_lng, back.lat, back.lng);
        const actual = item.match.distanceToStartKm === null || item.match.distanceToStartKm === undefined ? null : Number(item.match.distanceToStartKm);
        if (actual === null || Math.abs(actual - expected) > 0.02) throw new HarnessFailure('DISTANCE_NOT_AS_DECLARED', `${item.label}: the matcher read ${actual} km, the declared coordinates give ${expected} km (${primaryCity(geography)})`);
        item.distance = {km: actual, expectedKm: expected, source: item.match.distanceSource ?? null};
      } else {
        item.distance = {km: null, source: 'CITY_NAME_COMPARISON'};
      }
    }

    // ---- workers the HARNESS derived (fit / unfit / unknown) differ only in the profile it chose: a matcher that answers identically for all of them means the variation had no effect
    if (caseItem.deriveWorkers) {
      const varied = built.filter(item => !item.control && STANDARD_LABELS.includes(item.label));
      const signatures = new Set(varied.map(item => JSON.stringify([sortedSet(item.match.hardBlockers), sortedSet(item.match.dispatchBlockers), item.match.dispatchEligible])));
      if (varied.length >= 2 && signatures.size === 1) throw new HarnessFailure('FIXTURE_NOT_DISCRIMINATING', `${caseItem.id}: the derived workers ${varied.map(item => item.label).join(', ')} all got the same answer ${[...signatures][0]}: the profile variation had no effect`);
    }

    // ---- ONE dispatch wave for this task, shape-validated, with the round row read back
    stepOf.current = 'wave';
    const expectedDeliveries = built.filter(item => item.expect?.delivery === true || item.expect?.dispatchEligible === true).length;
    const wave = fx.runWave(need.needId);
    const deliveries = fx.readDeliveries(need.needId);
    const rounds = fx.readRounds(need.needId);
    assertWaveShape(wave, {expectedDeliveries});
    entry.wave = wave;
    entry.rounds = rounds.map(round => ({round_no: round.round_no, status: round.status, stop_reason: round.stop_reason, batch_size: round.batch_size}));
    if (rounds.length !== 1 || rounds[0].round_no !== 1) throw new HarnessFailure('WAVE_ROUND_INCONSISTENT', `expected exactly one round row (round 1), found ${JSON.stringify(entry.rounds)}`);
    if ((rounds[0].status === 'SENT') !== (wave.status === 'SENT') || (wave.status === 'STOPPED' && rounds[0].stop_reason !== 'NO_ELIGIBLE_CANDIDATES')) {
      throw new HarnessFailure('WAVE_ROUND_INCONSISTENT', `wave ${wave.status}/${wave.inserted} but the round row says ${rounds[0].status}/${rounds[0].stop_reason}`);
    }
    if (deliveries.length !== wave.inserted) throw new HarnessFailure('WAVE_ROUND_INCONSISTENT', `the wave inserted ${wave.inserted} but ${deliveries.length} delivery rows exist`);
    precondition(report);
    const delivered = new Set(deliveries.map(row => row.worker_profile_id));
    if (wave.inserted === wave.batchSize && built.some(item => item.match.dispatchEligible && !delivered.has(item.worker.profileId))) {
      throw new HarnessFailure('WAVE_FULL', 'the wave inserted its whole batch and an eligible fixture worker was left out: a stray worker may have crowded the wave');
    }

    // ---- observe and compare
    stepOf.current = 'observe';
    for (const item of built) {
      const match = item.match;
      const events = fx.readEvents(item.worker.id, {entityId: need.needId});
      const actual = {hardBlockers: sortedSet(match.hardBlockers), dispatchBlockers: sortedSet(match.dispatchBlockers), dispatchEligible: match.dispatchEligible, responseAllowed: match.responseAllowed,
        reasonCodes: sortedSet(match.reasonCodes), delivery: deliveries.some(row => row.worker_profile_id === item.worker.profileId), event: events.length > 0};
      const worker = {label: item.label, note: item.note, control: item.control, profileStatus: item.profile.status ?? 'ACTIVE', rows: [], derivedRows: [], observedOnly: false, notes: item.worker.notes ?? [],
        distance: item.distance ?? null, annotations: item.annotations ?? null, shapeDegraded: shapeDegradedLabels.has(item.label), shapeCoverage: item.worker.shapeCoverage ?? null,
        observed: {hardBlockers: actual.hardBlockers, dispatchBlockers: actual.dispatchBlockers, dispatchEligible: actual.dispatchEligible, delivery: actual.delivery, event: actual.event, score: match.score}};
      if (item.expect) {
        const result = compareExpectation(item.expect, actual);
        worker.rows = comparisonRows(item.expect, actual);
        if (item.control) report.assertions.controls += result.asserted.length;
        else {
          tally(report, effectiveBucket, caseItem.id, item.label, item.expect, result.asserted);
          report.corpus.leavesComparedAtRun = (report.corpus.leavesComparedAtRun ?? 0) + result.asserted.length;   // the expectation leaves actually compared with the chain at run time
        }
        if (isUnattributed(item.expect)) report.unattributed.push({caseId: caseItem.id, worker: item.label});
        for (const mismatch of result.mismatches) {
          reported.add(`${item.label}/${mismatch.field}`);
          // A finding on a worker that could not be built as the corpus describes (SHAPE_DEGRADED) may be the fixture's limit and not the matcher's: it is marked, not hidden.
          addFinding(report, caseItem.id, item.label, mismatch.field, mismatch.expected, mismatch.actual, bodies, {...where, ...(item.control ? {kind: 'CONTROL'} : shapeDegradedLabels.has(item.label) ? {kind: 'SHAPE_DEGRADED_WORKER'} : {}),
            ...(item.annotations?.sourceReadingPrediction ? {note: 'the corpus records a source-reading prediction that differs: ' + JSON.stringify(item.annotations.sourceReadingPrediction)} : {}),
            ...(shapeDegradedLabels.has(item.label) && !item.control ? {shapeNote: 'this worker was built without the covering schedule the corpus shape promises (the task stores no window): the disagreement may be the fixture limit'} : {})});
        }
      } else {
        worker.observedOnly = true;
      }
      // derived invariants: they follow from the matcher's own result and from what the wave does, whatever the corpus says. An expectation that names notDeliveredBecause says on purpose that an
      // eligible worker is not delivered (the world gate of the dispatch admission): then "eligible => delivered" does not apply to that worker (delivery:false is compared as an expectation).
      const derived = [
        {field: 'eligible => delivered', applies: actual.dispatchEligible && !item.expect?.notDeliveredBecause, ok: actual.delivery, positive: true, key: 'delivery', expected: true, actual: actual.delivery, kind: 'ELIGIBLE_NOT_DELIVERED'},
        {field: 'not eligible => not delivered', applies: !actual.dispatchEligible, ok: !actual.delivery, positive: false, key: 'delivery', expected: false, actual: actual.delivery, kind: 'DELIVERED_BUT_NOT_ELIGIBLE'},
        {field: 'event iff delivery', applies: true, ok: actual.event === actual.delivery, positive: actual.delivery, key: 'event', expected: actual.delivery, actual: actual.event, kind: 'EVENT_DISAGREES_WITH_DELIVERY'},
      ];
      for (const rule of derived.filter(item2 => item2.applies)) {
        worker.derivedRows.push({field: rule.field, expected: rule.expected, actual: rule.actual, verdict: rule.ok ? 'PASS' : 'FINDING'});
        report.assertions.derived[rule.positive ? 'positive' : 'negative'] += 1;
        if (!rule.ok && !reported.has(`${item.label}/${rule.key}`)) {
          reported.add(`${item.label}/${rule.key}`);
          addFinding(report, caseItem.id, item.label, rule.key, rule.expected, rule.actual, bodies, {...where, kind: rule.kind});
        }
      }
      entry.workers.push(worker);
    }

    // ---- a blocker on EVERY worker that no expectation names is more likely a fixture defect than a matcher finding: say so
    const crowd = built.filter(item => !item.control);
    if (crowd.length >= 2) {
      const everywhere = [...new Set(crowd.flatMap(item => [...item.match.hardBlockers, ...item.match.dispatchBlockers]))].filter(code => crowd.every(item => item.match.hardBlockers.includes(code) || item.match.dispatchBlockers.includes(code)));
      const expectedCodes = new Set(crowd.flatMap(item => [...(item.expect?.hardBlockers ?? []), ...(item.expect?.hardBlockersInclude ?? []), ...(item.expect?.dispatchBlockers ?? []), ...(item.expect?.dispatchBlockersInclude ?? [])]));
      const unexplained = everywhere.filter(code => !expectedCodes.has(code));
      if (unexplained.length) {
        entry.notes.push('COMMON_BLOCKER_ON_EVERY_WORKER: ' + unexplained.join(','));
        report.warnings.push(`${caseItem.id}: ${unexplained.join(',')} blocks every reference worker and no expectation names it: check the fixture before reading the findings of this case`);
      }
    }

    // ---- the hidden kinds of the STORED row (category + required skills: the input of the exclusion gate), not of the corpus text
    if (caseItem.expectedKinds !== null && caseItem.expectedKinds !== undefined) {
      const kinds = fx.kindsOfStoredNeed(need.needId);
      const got = sortedSet(kinds.exclusionInput), want = sortedSet(caseItem.expectedKinds), same = JSON.stringify(got) === JSON.stringify(want);
      entry.checks.push({field: 'hidden kinds of the stored task (category + required skills) by private.work_kinds_v5', expected: want, actual: got, verdict: same ? 'PASS' : 'FINDING', skillsOnly: sortedSet(kinds.skillsOnly)});
      report.assertions.kinds.checked += 1;
      if (!same) {
        report.assertions.kinds.mismatched += 1;
        addFinding(report, caseItem.id, '-', 'hidden kinds of the stored task (category + required skills)', want, got, bodies, where);
      }
    }
    if (entry.status !== 'UNASSERTED') {
      // precedence: FINDING > SHAPE_DEGRADED > POSITIVE_ONLY > PASS (a case that is not a plain PASS never reads as one)
      const found = entry.workers.some(worker => worker.rows.some(row => row.verdict === 'FINDING') || worker.derivedRows.some(row => row.verdict === 'FINDING')) || entry.checks.some(check => check.verdict === 'FINDING');
      entry.status = found ? 'FINDING' : entry.shapeDegraded ? 'SHAPE_DEGRADED' : entry.positiveOnly ? 'POSITIVE_ONLY' : 'PASS';
    }
  } catch (error) {
    entry.status = 'HARNESS_ERROR';
    entry.step = stepOf.current;
    entry.error = String(error?.message ?? error).slice(0, 400);
    harnessError(report, `case ${caseItem.id} at ${stepOf.current}`, error);
  } finally {
    try {
      fx.retireSince(since);
    } catch (error) {
      harnessError(report, `case ${caseItem.id} retire`, error);
    }
  }
  say(entry.status + ' case ' + caseItem.id);
  return entry;
}

// ------------------------------------------------------------------ the canary
/**
 * The canary runs BEFORE the corpus, on the product path: a fit worker is eligible and delivered, a worker without the required tool is refused with the one named hard blocker, a
 * scheduled task is admitted by the fit worker's covering availability, a worker in another city is outside the radius, and a DRAFT control is restricted. Any disagreement means the
 * pipeline (the fixtures, the product path or the chain) cannot produce what the corpus assumes: it is returned as FAILED and the caller makes it a HARNESS_ERROR, never a finding.
 */
export async function runCanary(fx, {registry, nowMs = Date.now(), matcherBodies, foreignTokens = null, corpus = CANARY_CORPUS}) {
  const sub = newReport();
  const cases = [];
  for (const item of normaliseCorpus(corpus, {registry, label: 'CANARY'}).cases) {
    cases.push(await runCase(fx, item, {report: sub, matcherBodies, nowMs, rebase: null, corpusLabel: 'CANARY', needPath: 'product', controls: true, foreignTokens}));
  }
  const problems = [...sub.harnessErrors.map(error => `${error.where}: ${error.message}`),
    ...sub.findings.map(finding => `${finding.caseId}/${finding.worker}/${finding.field}: expected ${JSON.stringify(finding.expected)}, actual ${JSON.stringify(finding.actual)}`)];
  const failed = cases.some(item => item.status !== 'PASS') || problems.length > 0;
  return {status: failed ? 'FAILED' : 'PASS', cases: cases.map(item => ({id: item.id, status: item.status, materialisation: item.materialisation, workers: item.workers.map(worker => ({label: worker.label, observed: worker.observed}))})),
    problems, assertions: sub.assertions};
}

// ------------------------------------------------------------------ the run as a whole
/** The checks that need the whole run: a proof that asserted nothing is vacuous (harness error); a contract-corpus run without a positive or a negative expectation is a harness error too. */
export function checkAssertions(report) {
  const strict = report.corpus.label === 'CORPUS';
  const a = report.assertions;
  // A diagnostic direct run (EX06_NEED_PATH=direct|auto) and an UNREACHABLE_STATE case assert against the chain too, in their own buckets (a.degraded / a.unreachable): the run is then PARTIAL
  // (finalizeResult), not vacuous. A run in which nothing at all was compared with the chain (the product refused every case, no worker had an expectation) is vacuous.
  if (a.matcher + a.degraded + a.unreachable === 0) harnessError(report, 'vacuous', new Error('PROOF_IS_VACUOUS: no worker expectation was asserted'));
  const quiet = (condition, code, text) => {
    if (!condition) return;
    if (strict) harnessError(report, 'vacuous', new Error(code + ': ' + text));
    else report.warnings.push(text);
  };
  quiet(a.matcher > 0 && a.positive === 0, 'NO_POSITIVE_EXPECTATION', 'No positive expectation (delivery:true / dispatchEligible:true / an empty blocker set): the run cannot show that a fitting worker is reached.');
  quiet(a.matcher > 0 && a.negative === 0, 'NO_NEGATIVE_EXPECTATION', 'No negative expectation (a blocker, delivery:false or dispatchEligible:false): the run cannot show that a blocked worker is refused.');
  if (report.unattributed.length) report.warnings.push(`${report.unattributed.length} negative expectation(s) name no cause (reasonUnspecified): listed as UNATTRIBUTED`);
  if (report.degradedCases.length) report.warnings.push(`${report.degradedCases.length} case(s) were DEGRADED (a direct insert replaced the product path): their assertions are counted apart and the result is PARTIAL`);
  if (report.unreachableCases.length) report.warnings.push(`${report.unreachableCases.length} case(s) are UNREACHABLE_STATE (the product cannot produce the task): counted apart`);
  const scope = refreshScope(report);
  if (scope.refused > 0) report.warnings.push(`${scope.refused} READY case(s) were REFUSED by the product path and NOT compared (the result is PARTIAL): ${report.cases.filter(item => item.status === 'PRODUCT_PATH_REFUSED').map(item => `${item.id}@${item.step}`).join(', ')}`);
  if (scope.shapeDegraded > 0) report.warnings.push(`${scope.shapeDegraded} case(s) are SHAPE_DEGRADED (the schedule shape the corpus asked for could not be built, the task stores no window; the result is PARTIAL): ${report.cases.filter(item => item.shapeDegraded).map(item => item.id).join(', ')}`);
  if (scope.positiveOnly > 0) report.warnings.push(`${scope.positiveOnly} case(s) are POSITIVE_ONLY (the corpus gives no matcher-level negative; compared, but an everyone-eligible matcher would pass them): ${report.cases.filter(item => item.positiveOnly).map(item => item.id).join(', ')}`);
}

/**
 * result and exit code. PASS | FINDINGS | SMOKE_ONLY | PARTIAL | HARNESS_BROKEN. Findings and differing pins never make the harness fail; a harness error always does;
 * EX06_STRICT_FINDINGS=1 makes findings exit 2. SMOKE never yields PASS; a capped run, a run with a buildable case that did not run, a degraded case (a direct insert), a case the product
 * path REFUSED (never compared) or a SHAPE_DEGRADED case (the corpus's schedule shape not built) yields PARTIAL. The scope of what was compared (corpus.compared / refused / errored,
 * corpus.leavesComparedAtRun, report.scope) is written with it: the result is never quoted without "PASS on N of M cases, K refused, L skipped, X of Y leaves compared".
 * Cases skipped by design (WORKER family, tasks that publish nothing) do not make the result PARTIAL: they are listed with their reasons and counted in the scope.
 */
export function finalizeResult(report, {strict = false} = {}) {
  const broken = report.harnessErrors.length > 0 || report.cases.some(item => item.status === 'HARNESS_ERROR');
  const c = report.corpus;
  const scope = refreshScope(report);
  const buildable = c.buildable ?? Math.max(0, (c.totalCases ?? 0) - (c.skipped ?? []).length);
  const partial = c.capped === true || (c.ran ?? report.cases.length) < buildable || report.degradedCases.length > 0 || scope.refused > 0 || scope.shapeDegraded > 0;
  report.result = broken ? 'HARNESS_BROKEN' : c.label === 'SMOKE' ? 'SMOKE_ONLY' : partial ? 'PARTIAL' : report.findings.length ? 'FINDINGS' : 'PASS';
  return broken ? 1 : report.findings.length && strict ? 2 : 0;
}

/** The skeleton of a run's report. */
export function newReport({sourceSha = null, pinConvention = null, pinSource = null} = {}) {
  return {unit: 'EX06_S03_MATCHING_CONTRACT_PROOF', sourceSha, disposableDbOnly: true, devAccess: false, providerCalls: 0, deviceProven: false,
    result: 'RUNNING', evidenceLabel: 'CHAIN NOT READ', pinConvention, pinSource, needPath: null,
    corpus: {label: 'NONE', id: null, version: null, totalCases: 0, buildable: 0, ran: 0, compared: 0, refused: 0, errored: 0, cap: null, capped: false, path: null, sha256: null, skipped: [], unconsumed: {total: 0, byKey: {}, list: []},
      leaves: {present: 0, consumed: 0, unconsumed: 0, validatedOnly: 0, assertable: 0}, leavesComparedAtRun: 0, positiveOnly: [], rebase: null},
    scope: null, auth: null, activeBackends: null,
    canary: null, stages: null, chain: {}, pinGate: null, pinRows: [], extraPinGate: null,
    digest: {before: null, after: null, startConsistent: null, unchanged: null, note: null},
    assertions: {matcher: 0, positive: 0, negative: 0, distinct: 0, derived: {positive: 0, negative: 0}, controls: 0, preconditions: 0, degraded: 0, unreachable: 0, kinds: {checked: 0, mismatched: 0}},
    paths: {product: 0, direct: 0}, foreign: {parkedWorkers: 0, restored: 0}, schedulers: null, selfTests: {negativeControlsFailed: null},
    cases: [], findings: [], harnessErrors: [], warnings: [], bypasses: [], degradedCases: [], unreachableCases: [], unattributed: [], checks: []};
}
