// EX-06 S04: the report of a run: the judged catalogue, the findings (with their proposed fixes as TEXT), the markdown (an expected-versus-actual table like S03's, the pin table, the probe table
// with the chain body md5 each probe ran against) and the workflow annotations. Pure: it takes plain data and returns plain data and text.
import {CASES, FINDINGS, SCENARIO_BODIES, bodiesOf} from './cases.mjs';
import {DEV_CONFIG} from './config.mjs';
import {judgeCase, scopeSentence} from './judge.mjs';
import {DEV_READ, chainLabel} from './pins.mjs';

/** A table cell: flattened, with the separator escaped and the length bounded. */
export function cell(value) {
  const text = value === undefined || value === null ? '-' : typeof value === 'string' ? value : JSON.stringify(value);
  const flat = text.replaceAll('\n', ' ').replaceAll('|', '\\|');
  return flat.length > 300 ? flat.slice(0, 297) + '...' : flat;
}

const short = md5 => (typeof md5 === 'string' && /^[0-9a-f]{32}$/.test(md5) ? md5.slice(0, 8) : String(md5));

export const NOT_PROVEN = Object.freeze([
  'Behaviour on canonical DEV. The proof reads and writes only the disposable chain; the DEV bodies were read ONCE, read-only, to pin them (2026-10-02 08:55 UTC, ledger 221). A disposable chain is NOT DEV.',
  'Anything the chain does not carry: it stops before A1, B3, P0, P4, P5, pkg051a, B24 (parts 1 and 2), voice B1, EX-04, D12, pkg045b-p0 and the P6 rollout. The function bodies they changed are pinned (a difference is reported); RLS policies, config rows other than dispatch_normal, triggers and grants are not.',
  'Push. Nothing was sent: no Edge function and no device exist on the chain; the claim RPC only suppresses or queues rows in the database. public.rpc_begin_push_send (the post-A1/P4/B24 body) is not on the chain and was not exercised.',
  'Devices and clients. Nothing ran on the HONOR, the emulator or iOS. The Inbox probe is the SERVER answer (rpc_list_inbox, rpc_resolve_activity_event, rpc_read_task), not the client screens.',
  'A real provider. None; the task facts and the evaluator decision are synthetic (the S03 product path), no paid call was made.',
  'Concurrency. One session: two ticks at the same instant, or a wave racing a worker write, are not exercised.',
  'Time. The 15-minute windows, the expiry and the backoff were driven with the p_at parameter of private.dispatch_tick and private.expire_lifecycle against the real clock of the chain; the production scheduler (pg_cron) was paused. Nothing waited a real window.',
  'The labelled fixtures are not product writers: a closure request row (READY), the stored response deadline, the status, rating, exclusions and proactive columns of workers, the re-publication after a confirmed edit and the Agreement booked for the calendar case. The cases that use them say so.',
  'The optional scenarios (calendar, search, revision) rest on fixture paths no CI run had proved when this was authored; a failure there is PARTIAL and names the scenario.',
  'A pass rate. The counts are the scope of THIS run, nothing else. Findings are the product as read from the pinned DEV bodies; the fixes are proposals as text: no candidate was written or applied, and one follows the EX-04 template only after the owner decides.',
]);

/** The judged catalogue: the verdict of every case and probe merged with its catalogue text and the bodies it ran against. */
export function judgeCatalogue(cases, scenarios) {
  return cases.map(def => ({...judgeCase(def, scenarios), title: def.title, requirementText: def.requirement, inference: def.inference ?? null, bodies: bodiesOf(def), expect: def.expect ?? null, control: def.control === true,
    documentedText: def.documented?.text ?? null}));
}

const statesText = list => (list.length ? list.join('+') : 'none');
const failingRows = item => (item.failed ?? (item.rows ?? []).filter(row => !row.ok));

/** {expected, actual}: the two cells of the expected-versus-actual table. */
export function expectedActual(item) {
  if (item.verdict === 'NOT_RUN' || (item.verdict === 'HARNESS_ERROR' && item.kind !== 'WORKER' && item.kind !== 'CHECK' && !item.rows?.length)) {
    return {expected: '-', actual: item.reason ?? item.verdict};
  }
  if (item.kind === 'WORKER') {
    const facts = item.actualFacts;
    const expected = (item.rows ?? []).filter(row => row.kind !== 'PRECONDITION').map(row => `${row.field}=${row.expected}`).join(', ');
    if (item.verdict === 'HARNESS_ERROR') return {expected, actual: item.reason};
    return {expected, actual: `delivered=${facts.delivered}, reached=${facts.reached} (IN_APP ${statesText(facts.inApp)}; PUSH ${statesText(facts.push)}; round ${facts.deliveryRounds.join(',') || '-'})`};
  }
  if (item.kind === 'CHECK') {
    const failed = failingRows(item);
    if (item.verdict === 'HARNESS_ERROR') return {expected: '-', actual: item.reason};
    if (failed.length === 0) return {expected: 'every row as required', actual: `all ${item.rows.length} rows as required`};
    return {expected: failed.map(row => `${row.field}: ${JSON.stringify(row.expected)}`).join('; '), actual: failed.map(row => `${row.field}: ${JSON.stringify(row.actual)}`).join('; ')};
  }
  if (item.kind === 'PROBE') {
    return {expected: `the inference holds; canonical requirement: ${item.requirementText}`, actual: `${item.verdict}; requirement ${item.requirement}${item.note ? ': ' + item.note : ''}`};
  }
  return {expected: '-', actual: item.reason ?? item.verdict};
}

function buildFindings(judged, summary) {
  return summary.findingIds.map(id => {
    const raisedBy = judged.filter(item => item.findingId === id && ((item.kind !== 'PROBE' && item.verdict === 'FINDING') || (item.kind === 'PROBE' && item.requirement === 'NOT_MET'))).map(item => ({
      id: item.id, kind: item.kind, verdict: item.verdict, title: item.title, rows: (item.kind === 'PROBE' ? item.rows : failingRows(item)).slice(0, 12).map(row => ({field: row.field, expected: row.expected, actual: row.actual}))}));
    return {id, ...FINDINGS[id], raisedBy};
  });
}

const EVIDENCE_CHARS = 24000;
function evidenceOf(scenarioResults) {
  const out = {};
  for (const item of scenarioResults) {
    if (!item.evidence?.length) continue;
    let budget = EVIDENCE_CHARS;
    out[item.id] = item.evidence.map(entry => {
      const text = JSON.stringify(entry.data);
      const kept = text.length <= budget ? entry.data : {truncated: true, text: text.slice(0, Math.max(0, budget))};
      budget = Math.max(0, budget - text.length);
      return {label: entry.label, data: kept};
    });
  }
  return out;
}

/** The whole report as plain data (the JSON the workflow uploads). */
export function assembleReport({sourceSha, judged, summary, result, chain, scenarioResults, pinMode, config, certificate, catalogUnchanged, preflight, auth, harnessErrors, warnings, stages, chainCounts, only = null}) {
  const bodyMd5 = Object.fromEntries(chain.rows.map(row => [row.name, row.actual]));
  return {package: 'EX-06 S04: dispatch lifecycle negative-case proof and probes', sourceSha: sourceSha ?? null, disposableDbOnly: true, devAccess: false, providerCalls: 0, pushSent: 0,
    level: 'CI disposable chain only (SOURCE + CI): real Auth and PostgREST, no DEV, no provider, no device, nothing sent. A disposable chain is NOT DEV: the label says whether its function bodies are DEV\'s.',
    result, scope: scopeSentence(summary, result), chainVerdict: chain.verdict, evidenceLabel: chainLabel(chain), pinMode, only, summary, chain: {verdict: chain.verdict, mode: chain.mode, counts: chain.counts, fatal: chain.fatal,
      supportingDifferences: chain.supportingDifferences, informational: chain.informational, explained: chain.explained, rows: chain.rows}, bodyMd5, config, certificate, catalogUnchanged, preflight,
    scenarios: scenarioResults.map(item => ({id: item.id, title: item.title, optional: item.optional === true, status: item.status, error: item.error ?? null, durationMs: item.durationMs ?? null, cleanupError: item.cleanupError ?? null,
      bodies: SCENARIO_BODIES[item.id] ?? []})),
    cases: judged, findings: buildFindings(judged, summary), evidence: evidenceOf(scenarioResults), notProven: NOT_PROVEN, harnessErrors, warnings, auth, stages, chainCounts};
}

const verdictCell = item => {
  if (item.kind === 'PROBE') return item.verdict;
  return item.verdict === 'FINDING' && item.findingId ? `FINDING ${item.findingId}` : item.verdict === 'DOCUMENTED' ? 'DOCUMENTED' : item.verdict;
};

/** The markdown of a run. */
export function renderMarkdown(report) {
  const lines = [];
  const s = report.summary;
  lines.push('# EX-06 S04 - dispatch lifecycle negative-case proof and probes (disposable chain)');
  lines.push('');
  lines.push(`**Result: ${report.result}** | **Chain: ${report.chainVerdict}** | **Evidence label: ${report.evidenceLabel}**`);
  lines.push(`**Scope: ${report.scope}**`);
  lines.push(`Level: ${report.level} Nothing was sent: the push sender does not exist on the chain and the claim RPC only writes rows in the database.`);
  if (report.only) lines.push(`Focused re-run: only the scenario(s) ${report.only.join(', ')} ran (EX06_S04_ONLY); the others are SKIPPED and the result is PARTIAL.`);
  if (report.result === 'CHAIN_DIFFERS') lines.push(`**The chain's function bodies differ from the DEV pins without a named explanation: ${report.chain.fatal.join(', ')}. The cases below are NOT evidence about DEV.**`);
  lines.push(`Pin mode: ${report.pinMode}. Auth accounts created: ${report.auth?.accountsCreated ?? 0}; 429 retries: ${report.auth?.retries ?? 0}. Closure certificate unchanged: ${report.certificate?.unchanged}. Catalog (functions and triggers) unchanged by the run: ${report.catalogUnchanged}.`);
  for (const warning of report.warnings ?? []) lines.push(`- WARNING: ${cell(warning)}`);
  lines.push('');
  lines.push(`## Chain fidelity (md5 of prosrc, carriage returns removed; the DEV side was read read-only on ${DEV_READ.readAtUtc} UTC, ledger ${DEV_READ.ledger})`);
  lines.push('| function | tier | role | DEV md5 | chain md5 | verdict | proven | note |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of report.chain.rows) lines.push(`| ${cell(row.name)} | ${row.tier} | ${row.role} | ${row.expected} | ${row.actual} | ${row.verdict} | ${row.proven} | ${cell(row.explanation || row.use)} |`);
  lines.push('');
  lines.push(`${report.chain.counts.core} CORE pins are the bodies the S03 corpus proof and the ex06a proof already proved equal on the chain (ex06a applied by the workflow before the proof, as DEV did); ${report.chain.counts.supporting} SUPPORTING pins are the other bodies a case depends on; ${report.chain.counts.informational} INFORMATIONAL helpers are compared and never fatal. Not pinned: RLS policies, config rows other than dispatch_normal, triggers, grants.`);
  if (report.config) lines.push(`Dispatch config on the chain (private.marketplace_config dispatch_normal): wave sizes ${JSON.stringify(report.config.waveSizes)}, window ${report.config.windowMinutes} min, target responses ${report.config.targetResponses}${report.config.equalsDev === undefined ? '' : `; sha256 ${report.config.equalsDev ? 'equals' : 'DIFFERS from'} DEV's ${DEV_CONFIG.dispatch_normal.sha256.slice(0, 8)}... (read ${DEV_CONFIG.readAtUtc} UTC)`}.`);
  lines.push('');
  lines.push('## Scenarios');
  lines.push('| scenario | optional | status | seconds | bodies it ran against (chain md5) | error |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const item of report.scenarios) lines.push(`| ${item.id} | ${item.optional ? 'yes' : 'no'} | ${item.status} | ${item.durationMs === null ? '-' : Math.round(item.durationMs / 1000)} | ${cell(item.bodies.map(name => `${name} ${short(report.bodyMd5[name])}`).join('; '))} | ${cell(item.error)} |`);
  lines.push('');
  lines.push('## Cases: expected versus actual (a CASE is a requirement of the plan 12.5 / owner row D-0114 / W06; FINDING = the product, read from its pinned DEV bodies, does not meet it)');
  lines.push('| id | case | requirement | expected | actual | verdict |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const item of report.cases.filter(entry => entry.kind !== 'PROBE')) {
    const {expected, actual} = expectedActual(item);
    lines.push(`| ${item.id} | ${cell(item.title)} | ${cell(item.requirementText)} | ${cell(expected)} | ${cell(actual)} | ${verdictCell(item)}${item.documentedText ? ' (' + cell(item.documentedText) + ')' : ''} |`);
  }
  lines.push('');
  lines.push('## Probes (each answers CONFIRMED / REFUTED / NOT_REACHED for the inference, and says whether the canonical requirement is MET; the chain body md5 it ran against is listed)');
  lines.push('| id | probe | inference | result | requirement | note | ran against |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const item of report.cases.filter(entry => entry.kind === 'PROBE')) {
    const bodies = item.bodies.map(name => `${name} ${short(report.bodyMd5[name])}`).join('; ');
    lines.push(`| ${item.id} | ${cell(item.title)} | ${cell(item.inference)} | ${item.verdict} | ${item.requirement ?? '-'} | ${cell(item.note ?? item.reason)} | ${cell(bodies)} |`);
  }
  lines.push('');
  lines.push('## Findings (none was fixed in this slice; each proposed fix is TEXT: a candidate follows the EX-04 template only after the owner decides)');
  if (report.findings.length === 0) lines.push('None.');
  for (const finding of report.findings) {
    lines.push('');
    lines.push(`### ${finding.id} - ${finding.title} (${finding.severity}; owner decision needed: ${finding.ownerDecision ? 'yes' : 'no'})`);
    lines.push(finding.summary);
    lines.push(`Raised by: ${finding.raisedBy.map(item => `${item.id} (${item.verdict})`).join(', ')}.`);
    for (const item of finding.raisedBy) for (const evidence of item.rows.slice(0, 6)) lines.push(`- ${item.id}: ${cell(evidence.field)}: expected ${cell(evidence.expected)}, actual ${cell(evidence.actual)}`);
    lines.push(`Proposed fix (text only): ${finding.proposedFix}`);
  }
  lines.push('');
  const evidenceIds = [...new Set(report.cases.filter(item => item.verdict === 'FINDING' || item.requirement === 'NOT_MET').flatMap(item => item.scenarios ?? [item.scenario]))].filter(id => report.evidence[id]);
  lines.push('## Evidence of the scenarios that raised a finding (bounded; the full rows are in the JSON report)');
  if (evidenceIds.length === 0) lines.push('None.');
  for (const id of evidenceIds) for (const entry of report.evidence[id]) lines.push(`- ${id} / ${cell(entry.label)}: ${cell(JSON.stringify(entry.data).slice(0, 1200))}`);
  lines.push('');
  lines.push('## Not proved');
  for (const item of report.notProven) lines.push(`- ${item}`);
  if ((report.harnessErrors ?? []).length) {
    lines.push('');
    lines.push('## Harness errors (the harness itself did not work; the process exits non-zero)');
    for (const error of report.harnessErrors) lines.push(`- ${cell(error.where)}: ${cell(error.message)}`);
  }
  lines.push('');
  lines.push(`Totals: cases ${s.cases.total} (${s.cases.PASS} as required, ${s.cases.DOCUMENTED} documented, ${s.cases.FINDING} finding, ${s.cases.NOT_RUN} not run, ${s.cases.HARNESS_ERROR} harness error); probes ${s.probes.total} (${s.probes.CONFIRMED} confirmed, ${s.probes.REFUTED} refuted, ${s.probes.NOT_REACHED} not reached); findings ${s.findingIds.join(', ') || 'none'}.`);
  return lines.join('\n') + '\n';
}

/** GitHub workflow command lines: ::error for a result that is not evidence, ::warning for findings, ::notice for the scope. */
export function annotationsFor(report) {
  const lines = [];
  const s = report.summary;
  if (report.result === 'HARNESS_BROKEN') lines.push(`::error::EX-06 S04 harness broken: ${report.harnessErrors.length} harness error(s), ${s.scenarios.filter(item => item.status !== 'OK' && !item.optional).length} required scenario(s) failed, ${s.cases.HARNESS_ERROR + s.probes.HARNESS_ERROR} case(s) in error, ${s.notRunBlocking} case(s) not run; the run proves less than its scope says`);
  if (report.result === 'CHAIN_DIFFERS') lines.push(`::error::EX-06 S04: the chain's function bodies differ from the DEV pins without a named explanation (${report.chain.fatal.join(', ')}); the results are NOT evidence about DEV`);
  const skipped = report.scenarios.filter(item => item.status === 'SKIPPED').map(item => item.id);
  const failedOptional = s.optionalFailed.filter(id => !skipped.includes(id));
  if (failedOptional.length) lines.push(`::error::EX-06 S04 PARTIAL: optional scenario(s) ${failedOptional.join(', ')} did not run; their cases are NOT_RUN`);
  if (skipped.length) lines.push(`::warning::EX-06 S04 focused re-run (EX06_S04_ONLY): ${skipped.length} scenario(s) were not selected, their cases are NOT_RUN; this run is PARTIAL by design`);
  if (report.chain.mode === 'report' && report.chain.supportingDifferences.length) lines.push(`::warning::EX-06 S04: SUPPORTING pin(s) differ from DEV (report mode): ${report.chain.supportingDifferences.join(', ')}`);
  if (s.findingIds.length) lines.push(`::warning::EX-06 S04: ${s.findingIds.length} finding(s) (${s.findingIds.join(', ')}): the product, read from its pinned DEV bodies, does not meet the canonical requirement (none fixed in this slice)`);
  if (s.probes.NOT_REACHED > 0) lines.push(`::warning::EX-06 S04: ${s.probes.NOT_REACHED} probe(s) could not be reached on the chain`);
  if (['PASS', 'FINDINGS', 'PARTIAL'].includes(report.result)) lines.push(`::notice::EX-06 S04 scope: ${report.scope}`);
  return lines;
}

export const CATALOGUE = CASES;
