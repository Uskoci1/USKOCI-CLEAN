// EX-06 ex06a: one pass of the real S02 corpus through the S03 runner, with the single fixture adjustment of the proof (lib/ex06a_lib.mjs augmentSpec). Everything it needs from the outside is
// injected (the fixture factory, the loaded corpus, the registry, a body-md5 reader, a reader of the stored task), so the same code runs in the CI proof against the disposable chain (ex06a_proof.mjs)
// and offline against the simulated backend (ex06a_passes.test.mjs). lib/ (the S03 harness, another writer) is only imported, never edited.
//
// A pass that did not really cover its cases is not a pass: after every pass the coverage (the expected number of cases, none refused by the product path, no unasserted or errored status), the EXACT
// list of the workers the fixture adjustment touched, the capture of the FULL match_detail of EVERY worker, the product path of the two evidence cases (T-003, T-006) and the assumptions behind the narrow
// fixture rule (the stored task has no window, no foreign zone and the pass-clock publication day) are asserted (lib corpusCoverageProblems / adjustedProblems / detailCoverageProblems /
// productPathProblems / narrowFixtureProblems), so a case that is refused in two passes cannot hide behind "identical", an unexpected adjustment cannot be absorbed silently and a worker whose detail
// could not be matched cannot drop out of the comparison. All of it fails the PROOF, not only an offline test.
//
// ONE REBASE FOR EVERY PASS. The S02 corpus carries absolute timestamps against its own clock; the S03 runner shifts them by (this pass's clock - the corpus clock). If every pass took its own clock, the
// stored starts_at of a case would differ between passes by the minutes between the pass starts, and the full match_detail (which carries liveStateDate = the local date of starts_at) would differ
// whenever a local midnight fell between two shifted starts: a false verdict that depends on the time of day. So the rebase is computed ONCE (at the first pass) and every pass of this runner reuses
// it (lib.corpusTimeProblems then proves the stored times are the same in every pass). The earliest corpus start is 28 hours after the corpus clock, so a shared rebase still leaves more than a day
// (REBASE_MAX_AGE_MS bounds the age). The window-less T-003 / T-006 tasks carry no stored time and keep the clock of their own pass for the narrow rule.
import assert from 'node:assert/strict';
import {newReport, runCanary, runCase} from './lib/runner.mjs';
import {computeRebase} from './lib/timeutil.mjs';
import * as lib from './ex06a_lib.mjs';

const short = text => String(text).slice(0, 8);
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
/** A pass takes minutes: no local midnight within this many minutes of its start (T-006's rule and the week of the matrix must not roll over under it). */
export const PASS_GUARD_MINUTES = 20;
const KIND_OF = {'T-003': 'TOMORROW_FLEXIBLE', 'T-006': 'WEEK_FLEXIBLE'};

/**
 * deps = {fx (createFixtures(...) result), corpus (loadCorpus(...) result), registry, sourceSha, bodyMd5 (signature -> md5), readStoredNeed (needId -> {schedule_kind, starts_at, ends_at, published_at,
 * task_timezone} of the needs row: REQUIRED), randomUUID, now (ms clock), sleep, say, record (label, summary, findingKeys), augment (the adjustment, lib.augmentSpec; a parameter only so that an
 * offline test can replace it with a wrong one), shareRebase (true; false only for the offline test that shows what the per-pass rebase did), expectedCases (the number of corpus cases a full pass must cover)}.
 * Returns async corpusPass(label, {caseIds, augment, canary}) -> {outcomes: {caseId: outcome}, details: {'case|label': match_detail}, times: {caseId: {starts_at, ends_at}}, findings: ['case|worker|field'],
 * summary}. Never leaves a fixture worker active and always puts the workers that were on the chain before the pass back as they were. A harness error (a fixture that could not be applied, an
 * impossible matcher shape, a failed canary), a pass that did not cover its cases and an unexpected fixture adjustment all throw.
 */
export function createPassRunner({fx, corpus, registry, sourceSha = null, bodyMd5, readStoredNeed, randomUUID, now = Date.now, sleep = defaultSleep, say = () => {}, record = () => {}, augment = lib.augmentSpec,
  shareRebase = true, expectedCases = lib.CORPUS_PIN.buildableCases}) {
  if (typeof readStoredNeed !== 'function') throw new Error('READ_STORED_NEED_REQUIRED: the assumptions behind the narrow fixture rule are read from the stored task');
  let shared = null;
  return async function corpusPass(label, {caseIds = null, augment: augmentOn = true, canary = true} = {}) {
    const wait = lib.clockWaitMs(now(), {guardMinutes: PASS_GUARD_MINUTES});
    if (wait > 0) { say(`CLOCK_GUARD waiting ${Math.round(wait / 1000)} s: a local midnight is close`); await sleep(wait); }
    const nowMs = now();
    let rebase = null;
    if (corpus.clock?.nowUtc) {
      if (shareRebase) {
        if (shared === null) shared = {baseMs: nowMs, rebase: computeRebase({ciNowMs: nowMs, corpusNowUtc: corpus.clock.nowUtc})};
        if (nowMs - shared.baseMs > lib.REBASE_MAX_AGE_MS) throw new Error(`REBASE_TOO_OLD: the shared corpus rebase is ${Math.round((nowMs - shared.baseMs) / 60000)} minutes old (limit ${lib.REBASE_MAX_AGE_MS / 60000})`);
        rebase = shared.rebase;
      } else {
        rebase = computeRebase({ciNowMs: nowMs, corpusNowUtc: corpus.clock.nowUtc});
      }
    }
    const sub = newReport({sourceSha});
    const current = {id: null, kind: null}, adjusted = [], specLabelOf = new Map(), detailsBySpec = {}, needIdOf = {};
    const matcherBodies = {matchDetailWithoutCalendar: short(bodyMd5('private.match_detail_without_calendar(uuid,uuid)')), workerDispatchTimeAdmitted: short(bodyMd5(lib.TARGET))};
    // The factory the runner sees: identical to the S03 one except createWorker, which gives a window-less flexible-day/week worker the schedule its corpus shape stands for (augmentSpec), readMatch,
    // which also keeps the full match_detail of every corpus worker (read before the wave, so the exposure of the fairness component is still zero), and createNeedFromFacts, which remembers the task id
    // of the evidence cases (their stored row is read after the case).
    const wrapped = {...fx, createWorker: async spec => {
      const next = augmentOn && current.id ? augment(spec, current.kind, randomUUID, {nowMs}) : spec;
      if (next !== spec) adjusted.push({caseId: current.id, worker: spec.label});
      const created = await fx.createWorker(next);
      if (current.id) specLabelOf.set(created.profileId, `${current.id}|${spec.label}`);
      return created;
    }, readMatch: (needId, profileId) => {
      const match = fx.readMatch(needId, profileId);
      if (specLabelOf.has(profileId)) detailsBySpec[specLabelOf.get(profileId)] = match;
      return match;
    }, createNeedFromFacts: async (...args) => {
      const need = await fx.createNeedFromFacts(...args);
      if (current.id) needIdOf[current.id] = need.needId;
      return need;
    }};
    const tokens = [], entries = [];
    tokens.push(fx.parkForeign());
    try {
      if (canary) {
        const result = await runCanary(wrapped, {registry, nowMs, matcherBodies, foreignTokens: tokens});
        assert.equal(result.status, 'PASS', 'CANARY_FAILED ' + label + ': ' + result.problems.join(' ; '));
      }
      for (const item of corpus.cases) {
        if (caseIds && !caseIds.includes(item.id)) continue;
        current.id = item.id;
        current.kind = item.expectedFacts?.['need.schedule_kind'] ?? null;
        entries.push(await runCase(wrapped, item, {report: sub, matcherBodies, nowMs, rebase, corpusLabel: 'CORPUS', needPath: 'product', controls: true, foreignTokens: tokens}));
      }
    } finally {
      current.id = null; current.kind = null;
      fx.parkAll();
      for (const token of tokens) fx.restoreForeign(token);
    }
    assert.deepEqual(sub.harnessErrors, [], 'HARNESS_ERRORS in the pass ' + label);
    assert.equal(entries.filter(entry => entry.status === 'HARNESS_ERROR').length, 0, 'HARNESS_ERROR case in the pass ' + label);
    const outcomes = Object.fromEntries(entries.map(entry => [entry.id, lib.outcomeOf(entry)]));
    const details = {};
    for (const entry of entries) {
      for (const worker of entry.workers ?? []) {
        const found = detailsBySpec[`${entry.id}|${(worker.label + '-' + entry.id).slice(0, 40)}`];
        if (found) details[`${entry.id}|${worker.label}`] = found;
      }
    }
    const findings = sub.findings.map(item => `${item.caseId}|${item.worker}|${item.field}`).sort();
    // the stored task of the two evidence cases: the narrow fixture rule rests on what the product stored (no window, no foreign zone, the pass-clock day)
    const stored = {}, narrowProblems = [];
    for (const entry of entries) {
      if (!lib.PRODUCT_PATH_CASES.includes(entry.id) || entry.status === 'PRODUCT_PATH_REFUSED') continue;
      stored[entry.id] = needIdOf[entry.id] ? readStoredNeed(needIdOf[entry.id]) : null;
      if (augmentOn) narrowProblems.push(...lib.narrowFixtureProblems({caseId: entry.id, expectedKind: KIND_OF[entry.id], stored: stored[entry.id], passNowMs: nowMs}));
    }
    const summary = {label, cases: entries.length, statuses: Object.fromEntries([...new Set(entries.map(entry => entry.status))].map(status => [status, entries.filter(entry => entry.status === status).length])),
      findings: findings.length, adjustedWorkers: adjusted, details: Object.keys(details).length, matcherBodies, productPath: sub.paths, nowUtc: new Date(nowMs).toISOString(), rebase, storedEvidenceTasks: stored,
      productPathEvidence: entries.filter(entry => lib.PRODUCT_PATH_CASES.includes(entry.id)).map(entry => ({id: entry.id, materialisation: entry.materialisation, degraded: entry.degraded}))};
    const problems = [...lib.corpusCoverageProblems({outcomes, summary, expectedCases: caseIds ? caseIds.length : expectedCases}), ...lib.adjustedProblems(adjusted, {augment: augmentOn, caseIds}),
      ...lib.detailCoverageProblems({outcomes, details}), ...lib.productPathProblems(entries), ...narrowProblems];
    record(label, {...summary, problems}, findings);
    assert.deepEqual(problems, [], 'THE_PASS_DID_NOT_COVER_WHAT_IT_CLAIMS ' + label);
    return {outcomes, details, times: lib.timesOf(entries), findings, summary};
  };
}
