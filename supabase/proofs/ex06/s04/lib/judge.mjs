// EX-06 S04: the verdict mechanics of the dispatch-lifecycle proof. Pure module (no database, no file access): the scenarios produce plain observations, the case catalogue
// (cases.mjs) says what each case expects of them, and this module decides.
//
// What it refuses to do. A negative case never passes without the named CAUSE having been observed (a worker "never reached" because the fixture silently failed proves nothing); a
// control that is not reached is a harness error (the pipeline delivers nothing, so every negative would pass vacuously); a check without a single row, or an evaluator that throws, is
// a harness error; a case of a scenario that did not run is NOT_RUN and counts against the result. A disagreement between the product and the canonical requirement is a FINDING, never
// adjusted: the case says what the requirement is, the report says what the product did.
export const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const sortedUnique = list => [...new Set(Array.isArray(list) ? list : [])].sort();
/** One comparison row: field, expected, actual, ok (structural equality). */
export const row = (field, expected, actual, extra = {}) => ({field, expected, actual, ok: eq(expected, actual), ...extra});

const stateText = item => item.state + (item.suppressionReason ? ':' + item.suppressionReason : '');

/** The rule of rpc_list_inbox: an event is listed when one of its IN_APP rows is not SUPPRESSED (an EXPIRED row is still listed). */
export const visibleInInbox = notifications => (Array.isArray(notifications) ? notifications : []).some(item => item.channel === 'IN_APP' && item.state !== 'SUPPRESSED');

/**
 * What a person experienced of one task, from the observation of one worker: delivered (an opportunity_deliveries row, i.e. a wave slot was spent), reached (an event the person can see
 * in the Inbox), the states of the IN_APP and PUSH rows and the suppression reasons of the rows that were closed at birth.
 */
export function workerFacts(obs) {
  const deliveries = obs?.deliveries ?? [], events = obs?.events ?? [], notifications = obs?.notifications ?? [];
  const inApp = notifications.filter(item => item.channel === 'IN_APP'), push = notifications.filter(item => item.channel === 'PUSH');
  const visible = visibleInInbox(notifications);
  return {delivered: deliveries.length > 0, deliveryRows: deliveries.length, deliveryRounds: sortedUnique(deliveries.map(item => item.round).filter(round => round !== null && round !== undefined)),
    events: events.length, visible, reached: events.length > 0 && visible, inApp: sortedUnique(inApp.map(stateText)), push: sortedUnique(push.map(stateText)),
    suppressionReasons: sortedUnique(notifications.filter(item => item.state === 'SUPPRESSED').map(item => item.suppressionReason))};
}

/**
 * The waves the dispatch must produce from the matcher's own scores: the eligible profiles ordered by score (best first), ties by profile id (the order of the wave loop), cut into
 * consecutive chunks of the configured wave sizes. eligible = [{profileId, score}]; returns [[profileId, ...], ...] and stops where the sizes stop.
 */
export function expectedWaves(eligible, sizes) {
  const ordered = [...eligible].sort((a, b) => (Number(b.score) - Number(a.score)) || (a.profileId < b.profileId ? -1 : a.profileId > b.profileId ? 1 : 0)).map(item => item.profileId);
  const waves = [];
  let from = 0;
  for (const size of sizes) {
    if (from >= ordered.length) break;
    waves.push(ordered.slice(from, from + size));
    from += size;
  }
  return waves;
}

const scenariosOf = def => def.scenarios ?? [def.scenario];
const notRun = (def, reason) => ({id: def.id, kind: def.kind, scenario: def.scenario, scenarios: scenariosOf(def), verdict: 'NOT_RUN', reason, rows: []});
const harness = (def, reason, extra = {}) => ({id: def.id, kind: def.kind, scenario: def.scenario, scenarios: scenariosOf(def), verdict: 'HARNESS_ERROR', reason, rows: [], ...extra});

function judgeWorker(def, obs) {
  if (obs === undefined || obs === null) return notRun(def, `the worker ${def.worker} is missing from the observation`);
  const facts = workerFacts(obs);
  const rows = [];
  if (def.cause) rows.push({field: 'cause present: ' + def.cause.text, expected: true, actual: obs.cause?.observed === true, ok: obs.cause?.observed === true, kind: 'PRECONDITION', detail: obs.cause?.detail ?? null});
  for (const [key, expected] of Object.entries(def.expect ?? {})) rows.push(row(key, expected, facts[key]));
  const base = {id: def.id, kind: def.kind, scenario: def.scenario, scenarios: scenariosOf(def), rows, actualFacts: facts, findingId: def.findingId ?? null};
  if (rows.some(item => item.kind === 'PRECONDITION' && !item.ok)) return {...base, verdict: 'HARNESS_ERROR', reason: 'the named cause was not observed: the fixture did not produce it (' + (obs.cause?.detail ?? def.cause.text) + ')'};
  const failed = rows.filter(item => !item.ok && item.kind !== 'PRECONDITION');
  if (failed.length === 0) return {...base, verdict: 'PASS'};
  if (def.control) return {...base, verdict: 'HARNESS_ERROR', failed, reason: 'a control was not reached: the pipeline delivers nothing, so every negative of this scenario would pass vacuously'};
  if (def.documented) {
    const documentedRows = Object.entries(def.documented.expect).map(([key, expected]) => row(key, expected, facts[key]));
    if (documentedRows.every(item => item.ok)) return {...base, verdict: 'DOCUMENTED', failed, documented: def.documented.text, documentedRows};
  }
  return {...base, verdict: 'FINDING', failed};
}

function judgeCheck(def, obs) {
  let rows;
  try {
    rows = def.evaluate(obs);
  } catch (error) {
    return harness(def, 'the evaluator could not read the observation: ' + String(error?.message ?? error).slice(0, 300));
  }
  if (!Array.isArray(rows) || rows.length === 0) return harness(def, 'a check without a single row proves nothing');
  const base = {id: def.id, kind: def.kind, scenario: def.scenario, scenarios: scenariosOf(def), rows, findingId: def.findingId ?? null};
  const preFailed = rows.filter(item => item.kind === 'PRECONDITION' && !item.ok);
  if (preFailed.length) return harness(def, 'a precondition failed: ' + preFailed.map(item => item.field).join('; ') + ' (the scenario did not build what the check needs)', {rows});
  const failed = rows.filter(item => !item.ok);
  if (failed.length === 0) return {...base, verdict: 'PASS'};
  if (def.documented) {
    const documentedRows = def.documented.evaluate(obs);
    if (Array.isArray(documentedRows) && documentedRows.length > 0 && documentedRows.every(item => item.ok)) return {...base, verdict: 'DOCUMENTED', failed, documented: def.documented.text, documentedRows};
  }
  return {...base, verdict: 'FINDING', failed};
}

const PROBE_RESULTS = ['CONFIRMED', 'REFUTED', 'NOT_REACHED'];
const REQUIREMENTS = ['MET', 'NOT_MET', 'NOT_APPLICABLE'];

function judgeProbe(def, obs) {
  let decision;
  try {
    decision = def.decide(obs);
  } catch (error) {
    return harness(def, 'the probe could not read the observation: ' + String(error?.message ?? error).slice(0, 300));
  }
  if (!decision || !PROBE_RESULTS.includes(decision.result) || !REQUIREMENTS.includes(decision.requirement)) {
    return harness(def, 'a probe may only answer CONFIRMED, REFUTED or NOT_REACHED with a requirement MET, NOT_MET or NOT_APPLICABLE: got ' + JSON.stringify([decision?.result, decision?.requirement]));
  }
  return {id: def.id, kind: def.kind, scenario: def.scenario, scenarios: scenariosOf(def), verdict: decision.result, requirement: decision.requirement, rows: decision.rows ?? [], note: decision.note ?? null,
    findingId: decision.requirement === 'NOT_MET' ? def.findingId ?? null : null, evidence: decision.evidence ?? null};
}

/**
 * The verdict of one catalogue entry. scenarios = {scenarioId: {status: 'OK' | 'HARNESS_ERROR', obs, error}}. A WORKER case reads obs.workers[def.worker] (or def.pick(obs)); a CHECK case
 * evaluates the whole observation of its scenario; a PROBE reads one scenario (its obs) or several (a map scenarioId -> obs).
 */
export function judgeCase(def, scenarios) {
  const ids = def.scenarios ?? [def.scenario];
  const missing = ids.filter(id => scenarios?.[id]?.status !== 'OK');
  if (missing.length) {
    const first = scenarios?.[missing[0]];
    return notRun(def, `the scenario ${missing[0]} did not run${first?.error ? ': ' + String(first.error).slice(0, 300) : ''}`);
  }
  if (def.kind === 'WORKER') return judgeWorker(def, (def.pick ?? (obs => obs?.workers?.[def.worker]))(scenarios[def.scenario].obs));
  if (def.kind === 'CHECK') return judgeCheck(def, scenarios[def.scenario].obs);
  if (def.kind === 'PROBE') return judgeProbe(def, ids.length === 1 ? scenarios[ids[0]].obs : Object.fromEntries(ids.map(id => [id, scenarios[id].obs])));
  return harness(def, 'unknown case kind ' + def.kind);
}

const count = (list, test) => list.filter(test).length;

/**
 * The totals of a run. results = judgeCase outputs (+ the def's title etc. merged by the caller); harnessErrors = [{where, message}]; scenarios = [{id, status}]; chain = {verdict}.
 */
export function summarize(results, {harnessErrors = [], scenarios = [], chain = {verdict: 'EQUAL'}} = {}) {
  const cases = results.filter(item => item.kind !== 'PROBE'), probes = results.filter(item => item.kind === 'PROBE');
  const caseCounts = {total: cases.length, PASS: 0, FINDING: 0, DOCUMENTED: 0, NOT_RUN: 0, HARNESS_ERROR: 0};
  for (const item of cases) caseCounts[item.verdict] += 1;
  const probeCounts = {total: probes.length, CONFIRMED: 0, REFUTED: 0, NOT_REACHED: 0, NOT_RUN: 0, HARNESS_ERROR: 0, requirementNotMet: count(probes, item => item.requirement === 'NOT_MET')};
  for (const item of probes) probeCounts[item.verdict] += 1;
  const findingIds = sortedUnique(results.filter(item => (item.kind !== 'PROBE' && item.verdict === 'FINDING') || (item.kind === 'PROBE' && item.requirement === 'NOT_MET')).map(item => item.findingId).filter(Boolean));
  const optionalFailed = scenarios.filter(item => item.optional && item.status !== 'OK').map(item => item.id);
  const notRunBlocking = count(results, item => item.verdict === 'NOT_RUN' && !(item.scenarios ?? [item.scenario]).some(id => optionalFailed.includes(id)));
  return {cases: caseCounts, probes: probeCounts, findingIds, notRun: caseCounts.NOT_RUN + probeCounts.NOT_RUN, notRunBlocking, optionalFailed, harnessErrors, scenarios,
    scenariosOk: count(scenarios, item => item.status === 'OK'), chain,
    findingCount: count(results, item => (item.kind !== 'PROBE' && item.verdict === 'FINDING') || (item.kind === 'PROBE' && item.requirement === 'NOT_MET'))};
}

/**
 * HARNESS_BROKEN > CHAIN_DIFFERS > PARTIAL > FINDINGS > PASS. Anything that did not run, errored or could not be judged is HARNESS_BROKEN: the run proves less than its scope says. The one
 * exception is an OPTIONAL scenario (it rests on a fixture path no CI run has proved yet, e.g. an Agreement booked through a labelled direct insert): its failure is PARTIAL, and its
 * cases are NOT_RUN with the reason, never a silent pass.
 */
export function resultOf(summary) {
  const requiredFailed = summary.scenarios.some(item => !item.optional && item.status !== 'OK');
  const broken = summary.harnessErrors.length > 0 || requiredFailed || summary.cases.HARNESS_ERROR > 0 || summary.probes.HARNESS_ERROR > 0 || summary.notRunBlocking > 0;
  if (broken) return 'HARNESS_BROKEN';
  if (summary.chain?.verdict === 'DIFFERS') return 'CHAIN_DIFFERS';
  if (summary.optionalFailed.length > 0) return 'PARTIAL';
  if (summary.findingCount > 0) return 'FINDINGS';
  return 'PASS';
}

/** 0 for PASS and FINDINGS, 2 for FINDINGS under strict findings, 1 for a broken harness or a chain that differs. */
export function exitCodeOf(result, {strictFindings = false} = {}) {
  if (result === 'HARNESS_BROKEN' || result === 'CHAIN_DIFFERS') return 1;
  if (result === 'FINDINGS' && strictFindings) return 2;
  return 0;
}

/** The sentence a result is never quoted without: what was decided, what was found, what the probes said. */
export function scopeSentence(summary, result) {
  const c = summary.cases, p = summary.probes;
  const decided = c.PASS + c.FINDING + c.DOCUMENTED;
  const findings = summary.findingIds.length ? `${summary.findingIds.length} finding${summary.findingIds.length === 1 ? '' : 's'} (${summary.findingIds.join(', ')})` : '0 findings';
  const optional = summary.optionalFailed.length ? `; optional scenario(s) not run: ${summary.optionalFailed.join(', ')}` : '';
  return `${result} on ${decided} of ${c.total} cases decided (${c.PASS} as required, ${c.DOCUMENTED} documented, ${c.FINDING} finding, ${c.NOT_RUN} not run, ${c.HARNESS_ERROR} harness error), ${findings}; probes: ${p.CONFIRMED} confirmed, ${p.REFUTED} refuted, ${p.NOT_REACHED} not reached (of ${p.total})${optional}`;
}

/** The one console line a job log is read by. */
export function resultLine(report) {
  const s = report.summary, auth = report.auth ?? {};
  return `RESULT ${report.result} | chain ${report.chainVerdict} | cases ${s.cases.total}: ${s.cases.PASS} pass, ${s.cases.DOCUMENTED} documented, ${s.cases.FINDING} finding, ${s.cases.NOT_RUN} not run, ${s.cases.HARNESS_ERROR} harness error`
    + ` | probes ${s.probes.total}: ${s.probes.CONFIRMED} confirmed, ${s.probes.REFUTED} refuted, ${s.probes.NOT_REACHED} not reached | scenarios ${s.scenariosOk}/${s.scenarios.length} ok`
    + ` | findings ${s.findingIds.join(',') || 'none'} | accounts ${auth.accountsCreated ?? 0}, 429 retries ${auth.retries ?? 0}`;
}
