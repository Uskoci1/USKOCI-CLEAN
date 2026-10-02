// EX-06 ex06b: one pass of a corpus (the real S02 corpus v1, or the additive v1.1) through the S03 runner. Everything it needs from the outside is injected (the fixture factory, the loaded corpus, the
// registry, a body-md5 reader), so the same code runs in the CI proof against the disposable chain (ex06b_proof.mjs) and offline against the simulated backend (ex06b_passes.test.mjs).
// lib/ (the S03 harness, another writer) is only imported, never edited. There is NO fixture adjustment here (ex06a needed one for T-003 and T-006; this package changes no schedule logic).
//
// A pass that did not really cover its cases is not a pass: after every pass the coverage (the expected number of cases, none refused by the product path, no unasserted or errored status) and the capture
// of the FULL match_detail of EVERY worker are asserted (lib coverageProblems / detailCoverageProblems), so a case that is refused in two passes cannot hide behind "identical" and a worker whose
// detail could not be matched cannot drop out of the comparison. All of it fails the PROOF, not only an offline test.
//
// ONE REBASE FOR EVERY PASS. The S02 corpus carries absolute timestamps against its own clock; the S03 runner shifts them by (this pass's clock - the corpus clock). If every pass took its own clock, the
// stored starts_at of a case would differ between passes by the minutes between the pass starts, and the full match_detail (which carries liveStateDate = the local date of starts_at) would differ
// whenever a local midnight fell between two shifted starts: a false verdict that depends on the time of day. So the rebase is computed ONCE (at the first pass) and every pass of this runner reuses
// it (lib.corpusTimeProblems then proves the stored times are the same in every pass). The earliest corpus start is 28 hours after the corpus clock, so a shared rebase still leaves more than a day.
import assert from 'node:assert/strict';
import {newReport, runCanary, runCase} from './lib/runner.mjs';
import {computeRebase} from './lib/timeutil.mjs';
import * as lib from './ex06b_lib.mjs';

const short = text => String(text).slice(0, 8);
/** The shared rebase of a runner must not be older than this: a corpus whose earliest start lies 28 hours after its clock still has time left. */
export const REBASE_MAX_AGE_MS = 3 * 3600 * 1000;
export const MATCH_DETAIL_WITHOUT_CALENDAR = 'private.match_detail_without_calendar(uuid,uuid)';

/**
 * deps = {fx (createFixtures(...) result), corpus (a loaded or normalised corpus: {cases, clock?}), registry, sourceSha, bodyMd5 (signature -> md5), now (ms clock), say, record (label, summary, findingKeys),
 * shareRebase (true), expectedCases (the number of cases a FULL pass of this corpus must cover)}.
 * Returns async corpusPass(label, {caseIds, canary}) -> {outcomes: {caseId: outcome}, details: {'case|label': match_detail}, times: {caseId: {starts_at, ends_at}}, findings: ['case|worker|field'], summary}.
 * Never leaves a fixture worker active and always puts the workers that were on the chain before the pass back as they were. A harness error (a fixture that could not be applied, an impossible
 * matcher shape, a failed canary) and a pass that did not cover its cases throw.
 */
export function createPassRunner({fx, corpus, registry, sourceSha = null, bodyMd5, now = Date.now, say = () => {}, record = () => {}, shareRebase = true, expectedCases = corpus.cases.length}) {
  let shared = null;
  return async function corpusPass(label, {caseIds = null, canary = true} = {}) {
    const nowMs = now();
    let rebase = null;
    if (corpus.clock?.nowUtc) {
      if (shareRebase) {
        if (shared === null) shared = {baseMs: nowMs, rebase: computeRebase({ciNowMs: nowMs, corpusNowUtc: corpus.clock.nowUtc})};
        if (nowMs - shared.baseMs > REBASE_MAX_AGE_MS) throw new Error(`REBASE_TOO_OLD: the shared corpus rebase is ${Math.round((nowMs - shared.baseMs) / 60000)} minutes old (limit ${REBASE_MAX_AGE_MS / 60000})`);
        rebase = shared.rebase;
      } else {
        rebase = computeRebase({ciNowMs: nowMs, corpusNowUtc: corpus.clock.nowUtc});
      }
    }
    const sub = newReport({sourceSha});
    const current = {id: null}, specLabelOf = new Map(), detailsBySpec = {};
    const matcherBodies = {workKindsV5: short(bodyMd5(lib.TARGET)), matchDetailWithoutCalendar: short(bodyMd5(MATCH_DETAIL_WITHOUT_CALENDAR))};
    // The factory the runner sees: identical to the S03 one except createWorker, which remembers which spec label a worker was built for, and readMatch, which also keeps the full match_detail of every
    // corpus worker (read before the wave, so the exposure of the fairness component is still zero).
    const wrapped = {...fx, createWorker: async spec => {
      const created = await fx.createWorker(spec);
      if (current.id) specLabelOf.set(created.profileId, `${current.id}|${spec.label}`);
      return created;
    }, readMatch: (needId, profileId) => {
      const match = fx.readMatch(needId, profileId);
      if (specLabelOf.has(profileId)) detailsBySpec[specLabelOf.get(profileId)] = match;
      return match;
    }};
    const tokens = [], entries = [];
    const startedLocalDate = localDate(nowMs);
    tokens.push(fx.parkForeign());
    try {
      if (canary) {
        const result = await runCanary(wrapped, {registry, nowMs, matcherBodies, foreignTokens: tokens});
        assert.equal(result.status, 'PASS', 'CANARY_FAILED ' + label + ': ' + result.problems.join(' ; '));
      }
      for (const item of corpus.cases) {
        if (caseIds && !caseIds.includes(item.id)) continue;
        current.id = item.id;
        entries.push(await runCase(wrapped, item, {report: sub, matcherBodies, nowMs, rebase, corpusLabel: 'CORPUS', needPath: 'product', controls: true, foreignTokens: tokens}));
      }
    } finally {
      current.id = null;
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
    const summary = {label, cases: entries.length, statuses: Object.fromEntries([...new Set(entries.map(entry => entry.status))].map(status => [status, entries.filter(entry => entry.status === status).length])),
      findings: findings.length, details: Object.keys(details).length, matcherBodies, productPath: sub.paths, nowUtc: new Date(nowMs).toISOString(), localDateAtStart: startedLocalDate, localDateAtEnd: localDate(now()),
      rebase, bypasses: sub.bypasses.map(item => ({caseId: item.caseId, worker: item.worker ?? null, bypassed: item.bypassed ?? null}))};
    const problems = [...lib.coverageProblems({outcomes, summary, expectedCases: caseIds ? caseIds.length : expectedCases}), ...lib.detailCoverageProblems({outcomes, details}),
      ...(sub.paths.direct > 0 ? [`DIRECT_MATERIALISATION ${sub.paths.direct}: every task must be built through the product path`] : [])];
    record(label, {...summary, problems}, findings);
    assert.deepEqual(problems, [], 'THE_PASS_DID_NOT_COVER_WHAT_IT_CLAIMS ' + label);
    return {outcomes, details, times: lib.timesOf(entries), findings, summary};
  };
}
/** The Europe/Belgrade calendar date of an instant (recorded per pass so that a report reader can see whether two compared passes straddled a local midnight). */
export function localDate(ms) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(ms));
}
