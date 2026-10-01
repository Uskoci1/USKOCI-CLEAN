// EX-06 S03/S04: expectation vocabulary, the comparison of an expectation with what the matcher and the dispatch did, and the markdown rendering of a run.
// Pure module (no database, no file access): unit-tested in ex06_lib.test.mjs, including negative controls that must report a mismatch.

export class HarnessInputError extends Error {
  constructor(code, detail) {
    super(code + (detail ? ': ' + detail : ''));
    this.code = code;
  }
}

// What a corpus may expect of ONE reference worker for ONE task. An unknown key is refused (a typo must never turn into a vacuous pass).
export const EXPECTATION_KEYS = Object.freeze({
  hardBlockers: 'exact set of match_detail hardBlockers',
  hardBlockersInclude: 'every listed code is among hardBlockers',
  dispatchBlockers: 'exact set of match_detail dispatchBlockers',
  dispatchBlockersInclude: 'every listed code is among dispatchBlockers',
  dispatchEligible: 'match_detail dispatchEligible (boolean)',
  responseAllowed: 'match_detail responseAllowed (boolean): hard gates only, soft gates never block a manual application',
  reasonCodesInclude: 'every listed code is among match_detail reasonCodes',
  delivery: 'an opportunity_deliveries row exists for (worker, need) after one dispatch wave (boolean)',
  event: 'an OPPORTUNITY_AVAILABLE event exists for the worker recipient and the need (boolean)',
  reasonUnspecified: 'true = a negative expectation that names no cause on purpose; the case is listed as UNATTRIBUTED in the report (never compared)',
});

const SET_KEYS = ['hardBlockers', 'dispatchBlockers'];
const INCLUDE_KEYS = ['hardBlockersInclude', 'dispatchBlockersInclude', 'reasonCodesInclude'];
const BOOLEAN_KEYS = ['dispatchEligible', 'responseAllowed', 'delivery', 'event'];
const COMPARED_KEYS = [...SET_KEYS, ...INCLUDE_KEYS, ...BOOLEAN_KEYS];

export const sortedSet = list => [...new Set(Array.isArray(list) ? list : [])].sort();
const sameSet = (a, b) => JSON.stringify(sortedSet(a)) === JSON.stringify(sortedSet(b));
const named = (expect, key) => Array.isArray(expect[key]) && expect[key].length > 0;

/**
 * Throws HarnessInputError for an unknown key, a wrong value type, an expectation that asserts nothing, or a NEGATIVE outcome (responseAllowed:false, dispatchEligible:false,
 * delivery:false, event:false) that does not name its cause. A worker blocked by something unrelated (availability, radius, preference defaults, a fixture mistake) and a wave that
 * never ran both satisfy a bare "false", so a bare negative is refused unless the expectation says reasonUnspecified:true.
 */
export function validateExpectation(expect, where = 'expectation') {
  if (expect === null || typeof expect !== 'object' || Array.isArray(expect)) throw new HarnessInputError('EXPECTATION_NOT_AN_OBJECT', where);
  const keys = Object.keys(expect);
  if (keys.length === 0) throw new HarnessInputError('EXPECTATION_EMPTY', where + ' asserts nothing');
  for (const key of keys) {
    if (!(key in EXPECTATION_KEYS)) throw new HarnessInputError('EXPECTATION_UNKNOWN_KEY', `${where}: ${key}`);
    const value = expect[key];
    if ([...SET_KEYS, ...INCLUDE_KEYS].includes(key) && !(Array.isArray(value) && value.every(item => typeof item === 'string'))) {
      throw new HarnessInputError('EXPECTATION_WRONG_TYPE', `${where}: ${key} must be an array of strings`);
    }
    if (BOOLEAN_KEYS.includes(key) && typeof value !== 'boolean') throw new HarnessInputError('EXPECTATION_WRONG_TYPE', `${where}: ${key} must be a boolean`);
    if (INCLUDE_KEYS.includes(key) && value.length === 0) throw new HarnessInputError('EXPECTATION_EMPTY', `${where}: ${key} is an empty list (use the exact-set key to expect none)`);
    if (key === 'reasonUnspecified' && value !== true) throw new HarnessInputError('EXPECTATION_WRONG_TYPE', `${where}: reasonUnspecified is true or absent`);
  }
  if (!keys.some(key => COMPARED_KEYS.includes(key))) throw new HarnessInputError('EXPECTATION_EMPTY', where + ' asserts nothing (only reasonUnspecified)');
  if (!expect.reasonUnspecified) {
    const hard = named(expect, 'hardBlockers') || named(expect, 'hardBlockersInclude');
    const soft = named(expect, 'dispatchBlockers') || named(expect, 'dispatchBlockersInclude');
    if (expect.responseAllowed === false && !hard) throw new HarnessInputError('NEGATIVE_EXPECTATION_WITHOUT_CAUSE', `${where}: responseAllowed:false must name a hard blocker (hardBlockers / hardBlockersInclude) or say reasonUnspecified:true`);
    if (expect.dispatchEligible === false && !(hard || soft)) throw new HarnessInputError('NEGATIVE_EXPECTATION_WITHOUT_CAUSE', `${where}: dispatchEligible:false must name a blocker or say reasonUnspecified:true`);
    for (const key of ['delivery', 'event']) {
      if (expect[key] === false && !(hard || soft)) throw new HarnessInputError('NEGATIVE_EXPECTATION_WITHOUT_CAUSE', `${where}: ${key}:false must name a blocker or say reasonUnspecified:true`);
    }
  }
  return expect;
}

/** True when the expectation carries the explicit reasonUnspecified marker (listed as UNATTRIBUTED in a report). */
export const isUnattributed = expect => expect?.reasonUnspecified === true;

/** Which asserted fields are positive (a worker expected to be reached, eligible or clear) and which negative (expected to be blocked or refused). */
export function classifyFields(expect) {
  const positive = [], negative = [];
  for (const field of Object.keys(expect).filter(key => COMPARED_KEYS.includes(key))) {
    const value = expect[field];
    const isPositive = BOOLEAN_KEYS.includes(field) ? value === true : SET_KEYS.includes(field) ? value.length === 0 : field === 'reasonCodesInclude';
    (isPositive ? positive : negative).push(field);
  }
  return {positive, negative};
}

/**
 * The DISTINCT gates an expectation asserts: delivery and event of one worker are functions of the same two blocker arrays and the same wave, so counting every asserted field
 * overstates what was proved. A gate is a blocker code ('HARD:MISSING_REQUIRED_TOOL'), the clear state of a gate class ('HARD:NONE'), or an outcome ('OUTCOME:NOT_DELIVERED').
 */
export function gatesOf(expect) {
  const gates = new Set();
  for (const code of [...(expect.hardBlockers ?? []), ...(expect.hardBlockersInclude ?? [])]) gates.add('HARD:' + code);
  for (const code of [...(expect.dispatchBlockers ?? []), ...(expect.dispatchBlockersInclude ?? [])]) gates.add('SOFT:' + code);
  if (Array.isArray(expect.hardBlockers) && expect.hardBlockers.length === 0) gates.add('HARD:NONE');
  if (Array.isArray(expect.dispatchBlockers) && expect.dispatchBlockers.length === 0) gates.add('SOFT:NONE');
  if (typeof expect.dispatchEligible === 'boolean') gates.add('OUTCOME:' + (expect.dispatchEligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'));
  if (typeof expect.delivery === 'boolean') gates.add('OUTCOME:' + (expect.delivery ? 'DELIVERED' : 'NOT_DELIVERED'));
  if (typeof expect.event === 'boolean') gates.add('OUTCOME:' + (expect.event ? 'EVENT' : 'NO_EVENT'));
  return [...gates].sort();
}

/**
 * Compare an expectation with what was observed. `actual` = {hardBlockers, dispatchBlockers, dispatchEligible, responseAllowed, reasonCodes, delivery, event}.
 * Returns {ok, mismatches:[{field, expected, actual}], asserted:[fields]}: every asserted field is listed, so a report shows what was really checked.
 */
export function compareExpectation(expect, actual) {
  validateExpectation(expect);
  const mismatches = [], asserted = [];
  for (const key of Object.keys(expect)) {
    if (key === 'reasonUnspecified') continue;
    asserted.push(key);
    const wanted = expect[key];
    if (SET_KEYS.includes(key)) {
      if (!sameSet(wanted, actual[key])) mismatches.push({field: key, expected: sortedSet(wanted), actual: sortedSet(actual[key])});
    } else if (INCLUDE_KEYS.includes(key)) {
      const have = key === 'reasonCodesInclude' ? actual.reasonCodes : actual[key.replace('Include', '')];
      const missing = wanted.filter(code => !sortedSet(have).includes(code));
      if (missing.length) mismatches.push({field: key, expected: sortedSet(wanted), actual: sortedSet(have), missing});
    } else if (actual[key] !== wanted) {
      mismatches.push({field: key, expected: wanted, actual: actual[key] === undefined ? null : actual[key]});
    }
  }
  return {ok: mismatches.length === 0, mismatches, asserted};
}

/** One table row per ASSERTED field (PASS or FINDING), so a report shows what was really checked and not only what failed. */
export function comparisonRows(expect, actual) {
  const {mismatches} = compareExpectation(expect, actual);
  return Object.keys(expect).filter(field => field !== 'reasonUnspecified').map(field => {
    const mismatch = mismatches.find(item => item.field === field);
    const shown = SET_KEYS.includes(field) ? sortedSet(actual[field]) : INCLUDE_KEYS.includes(field)
      ? sortedSet(field === 'reasonCodesInclude' ? actual.reasonCodes : actual[field.replace('Include', '')]) : actual[field] === undefined ? null : actual[field];
    return {field, expected: SET_KEYS.includes(field) || INCLUDE_KEYS.includes(field) ? sortedSet(expect[field]) : expect[field], actual: mismatch ? mismatch.actual : shown, verdict: mismatch ? 'FINDING' : 'PASS'};
  });
}

/** Offline negative controls: each pair is an expectation and an observation that MUST disagree, per gate class. Run before the database is touched. */
export const NEGATIVE_CONTROLS = Object.freeze([
  {gate: 'hard gate (exact set)', expect: {hardBlockers: []}, actual: {hardBlockers: ['MISSING_REQUIRED_VEHICLE']}},
  {gate: 'hard gate (include)', expect: {hardBlockersInclude: ['MISSING_REQUIRED_TOOL']}, actual: {hardBlockers: []}},
  {gate: 'soft gate (exact set)', expect: {dispatchBlockers: []}, actual: {dispatchBlockers: ['CURRENT_AVAILABILITY_PAUSED']}},
  {gate: 'soft gate (include)', expect: {dispatchBlockersInclude: ['OUTSIDE_PREFERRED_RADIUS']}, actual: {dispatchBlockers: []}},
  {gate: 'dispatchEligible', expect: {dispatchEligible: false, dispatchBlockersInclude: ['OUTSIDE_AVAILABILITY']}, actual: {dispatchEligible: true, dispatchBlockers: []}},
  {gate: 'responseAllowed (soft gates do not block a manual application)', expect: {responseAllowed: true}, actual: {responseAllowed: false}},
  {gate: 'delivery', expect: {delivery: false, hardBlockersInclude: ['MISSING_REQUIRED_TOOL']}, actual: {delivery: true, hardBlockers: []}},
  {gate: 'event', expect: {event: false, hardBlockersInclude: ['MISSING_REQUIRED_TOOL']}, actual: {event: true, hardBlockers: []}},
]);

/** Returns the gate classes whose negative control did NOT report a mismatch (must be empty for the harness to be trusted). */
export function failedNegativeControls() {
  return NEGATIVE_CONTROLS.filter(control => compareExpectation(control.expect, control.actual).ok).map(control => control.gate);
}

const cell = value => String(typeof value === 'string' ? value : JSON.stringify(value)).replaceAll('|', '\\|').replaceAll('\n', ' ');

/** The one console line a job log is read by: corpus, cases ran / total, skipped, what was asserted, how the tasks were built, findings. */
export function resultLine(report) {
  const a = report.assertions, c = report.corpus;
  return `RESULT ${report.result} | corpus=${c.label} | cases ran ${c.ran}/${c.totalCases}, skipped ${(c.skipped ?? []).length}${c.capped ? ', CAPPED at ' + c.cap : ''} | asserted ${a.matcher} (positive ${a.positive}, negative ${a.negative}, distinct ${a.distinct}), derived ${a.derived.positive + a.derived.negative}, preconditions ${a.preconditions} | tasks: product ${report.paths.product} / direct ${report.paths.direct} | unconsumed ${c.unconsumed?.total ?? 0} | findings ${report.findings.length} | harness errors ${report.harnessErrors.length} | ${report.evidenceLabel}`;
}

/** GitHub workflow command lines for a finished report: ::warning for findings, ::error for a result that is not evidence (SMOKE_ONLY, PARTIAL, HARNESS_BROKEN). */
export function annotationsFor(report) {
  const lines = [];
  if (report.result === 'HARNESS_BROKEN') lines.push(`::error::EX-06 S03 harness broken: ${report.harnessErrors.length} harness error(s); the run proves nothing`);
  if (report.result === 'SMOKE_ONLY') lines.push('::error::EX-06 S03 ran the SMOKE corpus only: harness mechanics, not the contract corpus (never a PASS)');
  if (report.result === 'PARTIAL') lines.push(`::error::EX-06 S03 PARTIAL: ${report.corpus.ran} of ${report.corpus.totalCases} cases ran (${(report.corpus.skipped ?? []).length} skipped, cap ${report.corpus.cap ?? 'none'}, degraded ${(report.degradedCases ?? []).length})`);
  if (report.findings.length) lines.push(`::warning::EX-06 S03: ${report.findings.length} finding(s): the matcher or the chain disagrees with the corpus (none adjusted, none fixed here)`);
  if ((report.corpus.unconsumed?.total ?? 0) > 0) lines.push(`::warning::EX-06 S03: ${report.corpus.unconsumed.total} corpus expectation(s) were NOT consumed (listed in the report)`);
  return lines;
}

/** The markdown of a run (an expected-versus-actual table per corpus case, the pin gate, the coverage and the findings). */
export function renderMarkdown(report) {
  const lines = [];
  const corpus = report.corpus ?? {};
  lines.push('# EX-06 S03 - matching contract proof on a disposable chain');
  lines.push('');
  lines.push(`**Result: ${report.result}** | **Evidence label: ${report.evidenceLabel}**`);
  lines.push(`Level: CI disposable chain only (SOURCE + CI). No DEV, provider, device or paid call. Source text is not live behaviour: this run says what the chain's bodies do, and the label says whether those bodies are DEV's. Nothing here is a pass rate.`);
  lines.push(`Corpus: ${corpus.label} ${corpus.id ?? ''} ${corpus.version ?? ''} (${corpus.totalCases ?? 0} cases: ran ${corpus.ran ?? 0}, skipped ${(corpus.skipped ?? []).length}${corpus.capped ? ', CAPPED at ' + corpus.cap : ''}${corpus.sha256 ? ', sha256 ' + corpus.sha256.slice(0, 16) + '...' : ''}) | findings: ${report.findings.length} | harness errors: ${report.harnessErrors.length}`);
  if (corpus.rebase) lines.push(`Clock rebase: CI now ${corpus.rebase.ciNowUtc} - corpus clock ${corpus.rebase.corpusNowUtc} = ${corpus.rebase.deltaHours} h; every absolute need.starts_at / need.ends_at was shifted by it (offset text and durations kept).`);
  for (const warning of report.warnings) lines.push(`- WARNING: ${cell(warning)}`);
  lines.push('');
  lines.push('## Canary (a fixture defect is a harness error, never a finding)');
  lines.push(report.canary ? `${report.canary.status}${report.canary.cases?.length ? ': ' + report.canary.cases.map(item => `${item.id} ${item.status}`).join(', ') : ''}` : 'not run');
  lines.push('');
  lines.push('## Pin gate (S01 table; md5 of prosrc, carriage returns removed; function bodies at the proof point only)');
  lines.push('| function | role | S01 pin | chain | verdict | explanation |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const row of report.pinRows) lines.push(`| ${cell(row.name)} | ${row.role} | ${row.expected} | ${row.actual} | ${row.verdict} | ${cell(row.explanation ?? '')} |`);
  lines.push('');
  lines.push('Not pinned (reported for information in the JSON report): helper functions, marketplace_config rows, triggers, cron, data, the publish and worker-writer RPCs the fixtures call.');
  const d = report.digest;
  lines.push(`Closure certificate at the start: live ${d.before?.live} | certified ${d.before?.certified} | erasure ${d.before?.erasure} | binding ${d.before?.binding} | ready ${d.before?.ready} (consistent: ${d.startConsistent}); at the end: live ${d.after?.live} (${d.unchanged ? 'unchanged' : 'MOVED'}). ${d.note ?? ''}`);
  lines.push('');
  lines.push('## Expected versus actual');
  lines.push('| case | worker | field | expected | actual | verdict |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const item of report.cases) {
    if (item.status === 'HARNESS_ERROR') {
      lines.push(`| ${cell(item.id)} | - | - | - | ${cell(item.error)} | HARNESS_ERROR at ${cell(item.step)} |`);
      continue;
    }
    if (item.status === 'PRODUCT_PATH_REFUSED') {
      lines.push(`| ${cell(item.id)} | - | - | - | ${cell(item.error)} | FINDING PRODUCT_PATH_REFUSED_READY_CASE at ${cell(item.step)} |`);
      continue;
    }
    for (const worker of item.workers ?? []) {
      for (const row of worker.rows) lines.push(`| ${cell(item.id)} | ${cell(worker.label)} | ${row.field} | ${cell(row.expected)} | ${cell(row.actual)} | ${row.verdict}${item.degraded ? ' (DEGRADED)' : ''}${item.unreachable ? ' (UNREACHABLE_STATE)' : ''} |`);
      for (const row of worker.derivedRows ?? []) lines.push(`| ${cell(item.id)} | ${cell(worker.label)} | ${row.field} (derived invariant) | ${cell(row.expected)} | ${cell(row.actual)} | ${row.verdict} |`);
      if (worker.observedOnly) lines.push(`| ${cell(item.id)} | ${cell(worker.label)} | (no expectation in the corpus) | - | ${cell(worker.observed)} | OBSERVED_ONLY |`);
    }
    for (const check of item.checks ?? []) lines.push(`| ${cell(item.id)} | - | ${cell(check.field)} | ${cell(check.expected)} | ${cell(check.actual)} | ${check.verdict} |`);
  }
  lines.push('');
  lines.push('## Cases not run (every one has a reason)');
  if ((corpus.skipped ?? []).length === 0) lines.push('None.');
  for (const item of corpus.skipped ?? []) lines.push(`- ${cell(item.id)}${item.family ? ' (' + item.family + ')' : ''}: ${cell(item.reason)}`);
  lines.push('');
  lines.push('## Corpus expectations NOT consumed by S03 (reported, never dropped)');
  const unconsumed = corpus.unconsumed ?? {total: 0, byKey: {}, list: []};
  lines.push(`${unconsumed.total} in total: ${Object.entries(unconsumed.byKey ?? {}).map(([key, count]) => `${key} x${count}`).join(', ') || 'none'}. Expectation leaves present ${corpus.leaves?.present ?? 0}, consumed ${corpus.leaves?.consumed ?? 0}, not consumed ${corpus.leaves?.unconsumed ?? 0}.`);
  for (const item of (unconsumed.list ?? []).slice(0, 80)) lines.push(`- ${cell(item.caseId)}${item.worker ? ' / ' + cell(item.worker) : ''}: ${cell(item.key)} = ${cell(item.value)} (${cell(item.reason)})`);
  if ((unconsumed.list ?? []).length > 80) lines.push(`- ... ${(unconsumed.list ?? []).length - 80} more in ex06-s03-report.json`);
  lines.push('');
  lines.push('## How each task was built (product path or a labelled bypass)');
  for (const item of report.cases) {
    lines.push(`- ${cell(item.id)}: ${cell(item.materialisation ?? 'not built')}${(item.synthetic ?? []).length ? ' (synthetic: ' + cell(item.synthetic.join(', ')) + ')' : ''}${(item.notes ?? []).length ? ' | ' + cell(item.notes.join(' | ')) : ''}`);
  }
  for (const bypass of report.bypasses.filter(item => item.bypassed)) lines.push(`- profile bypass in ${cell(bypass.caseId)} / ${cell(bypass.worker)}: ${cell(bypass.bypassed.join('; '))}`);
  for (const item of report.degradedCases ?? []) lines.push(`- DEGRADED ${cell(item.id)}: ${cell(item.reason)}; dropped facts: ${cell((item.dropped ?? []).join(', ') || 'none')}`);
  for (const item of report.unreachableCases ?? []) lines.push(`- UNREACHABLE_STATE ${cell(item.id)}: ${cell(item.reason)}`);
  for (const item of report.unattributed ?? []) lines.push(`- UNATTRIBUTED ${cell(item.caseId)} / ${cell(item.worker)}: a negative expectation without a named cause (reasonUnspecified)`);
  lines.push('');
  const a = report.assertions;
  lines.push(`Assertions: corpus expectation fields ${a.matcher} (positive ${a.positive}, negative ${a.negative}; ${a.distinct} distinct gates), derived invariants ${a.derived.positive + a.derived.negative} (positive ${a.derived.positive}, negative ${a.derived.negative}), preconditions ${a.preconditions}; on DEGRADED cases ${a.degraded}, on UNREACHABLE_STATE cases ${a.unreachable}. Tasks: product ${report.paths.product}, direct ${report.paths.direct}. Needs-path mode: ${report.needPath}.`);
  if (report.stages) {
    lines.push('');
    lines.push('Chain stages (from the workflow): ' + cell(report.stages.join(' ; ')));
  }
  lines.push('');
  lines.push('## Findings (the matcher or the chain disagrees with the corpus; none was adjusted and none was fixed in this slice)');
  if (report.findings.length === 0) lines.push('None.');
  for (const finding of report.findings) {
    lines.push(`- ${cell(finding.caseId)} / ${cell(finding.worker)} / ${finding.field}: expected ${cell(finding.expected)}, actual ${cell(finding.actual)}${finding.materialisation ? ' [' + cell(finding.materialisation) + ']' : ''}${finding.kind ? ' {' + finding.kind + '}' : ''}. Ran against ${cell(finding.bodiesShort ?? finding.bodies)}.`);
  }
  if (report.harnessErrors.length) {
    lines.push('');
    lines.push('## Harness errors (the harness itself did not work; the process exits non-zero)');
    for (const error of report.harnessErrors) lines.push(`- ${cell(error.where)}: ${cell(error.message)}`);
  }
  lines.push('');
  return lines.join('\n');
}
