// EX-06 S04: offline tests of the report: the judged catalogue, the findings with their proposed fixes, the markdown (an expected-versus-actual table like S03's, the pin table, the probe
// table with the body md5 each ran against, the honest label) and the workflow annotations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES, FINDINGS, SCENARIO_IDS} from './cases.mjs';
import {S04_PINS, chainLabel, chainVerdict, evaluateS04Pins} from './pins.mjs';
import {summarize, resultOf} from './judge.mjs';
import {ALL_FIXES, referenceScenarios} from './reference_obs.mjs';
import {annotationsFor, assembleReport, cell, expectedActual, judgeCatalogue, renderMarkdown} from './report.mjs';

const pinRows = (overrides = {}) => S04_PINS.map(pin => ({name: pin.name, nargs: pin.nargs, args: 'x', md5: pin.md5, derived_b24_part1_pt409: 'f'.repeat(32), ...(overrides[pin.name] ?? {})}));

function build({fixes = [], pinOverrides = {}, scenarioStatus = {}, harnessErrors = [], pinMode = 'strict', only = null} = {}) {
  const scenarios = referenceScenarios(fixes);
  for (const [id, status] of Object.entries(scenarioStatus)) scenarios[id] = {status, obs: null, error: 'simulated failure of ' + id};
  const scenarioResults = SCENARIO_IDS.map(id => ({id, title: id + ' title', optional: ['calendar', 'search', 'revision'].includes(id), status: scenarios[id].status, error: scenarios[id].error ?? null, durationMs: 1500, evidence: []}));
  const chain = chainVerdict(evaluateS04Pins(pinRows(pinOverrides)), {mode: pinMode});
  const judged = judgeCatalogue(CASES, scenarios);
  const summary = summarize(judged, {harnessErrors, scenarios: scenarioResults.map(item => ({id: item.id, status: item.status, optional: item.optional})), chain});
  const result = resultOf(summary);
  return assembleReport({sourceSha: 'a'.repeat(40), judged, summary, result, chain, scenarioResults, pinMode, config: {waveSizes: [5, 5, 10, 20], windowMinutes: 15, targetResponses: 3}, only,
    certificate: {before: {live: 'x', certified: 'x'}, after: {live: 'x', certified: 'x'}, unchanged: true}, catalogUnchanged: true, preflight: {missing: []}, auth: {accountsCreated: 101, retries: 0, waitedMs: 0, failures: 0},
    harnessErrors, warnings: [], stages: null, chainCounts: {active_workers: 0}});
}

test('cell escapes the table separator, flattens line breaks and bounds the length', () => {
  assert.equal(cell('a|b'), 'a\\|b');
  assert.equal(cell('a\nb'), 'a b');
  assert.equal(cell({x: 1}), '{"x":1}');
  assert.equal(cell('x'.repeat(500)).length, 300);
  assert.match(cell('x'.repeat(500)), /\.\.\.$/);
  assert.equal(cell(undefined), '-');
});

test('judgeCatalogue merges the verdict with the catalogue text and the bodies the entry ran against', () => {
  const judged = judgeCatalogue(CASES, referenceScenarios([]));
  assert.equal(judged.length, CASES.length);
  const r14 = judged.find(item => item.id === 'R14');
  assert.equal(r14.verdict, 'FINDING');
  assert.match(r14.title, /already applied/);
  assert.match(r14.requirementText, /never reaches/);
  assert.ok(r14.bodies.includes('private.dispatch_cheap_candidate_admitted'));
  const pc = judged.find(item => item.id === 'PC');
  assert.equal(pc.verdict, 'CONFIRMED');
  assert.match(pc.inference, /emit_event creates the PUSH row CREATED/);
});

test('expectedActual: a worker case shows the delivered / reached facts, a check shows its failing rows, a probe shows the inference and the answer', () => {
  const judged = judgeCatalogue(CASES, referenceScenarios([]));
  const find = id => judged.find(item => item.id === id);
  const worker = expectedActual(find('R14'));
  assert.match(worker.expected, /delivered=false.*reached=false|reached=false/);
  assert.match(worker.actual, /delivered=true/);
  assert.match(worker.actual, /reached=true/);
  assert.match(worker.actual, /IN_APP CREATED/);
  const check = expectedActual(find('T03b'));
  assert.match(check.expected, /0/);
  assert.match(check.actual, /6/);
  const passing = expectedActual(find('W01'));
  assert.match(passing.actual, /all \d+ rows as required/);
  const probe = expectedActual(find('PA'));
  assert.match(probe.expected, /requirement/);
  assert.match(probe.actual, /CONFIRMED/);
});

test('the report: a findings list with every proposed fix as text, the raising cases, and nothing fixed', () => {
  const report = build();
  assert.equal(report.result, 'FINDINGS');
  assert.deepEqual(report.findings.map(item => item.id), ['F10', 'F11', 'F12', 'F5', 'F6', 'F7', 'F8', 'F9']);
  const f5 = report.findings.find(item => item.id === 'F5');
  assert.equal(f5.title, FINDINGS.F5.title);
  assert.match(f5.proposedFix, /marketplace_responses/);
  assert.deepEqual(f5.raisedBy.map(item => item.id), ['R14']);
  const f9 = report.findings.find(item => item.id === 'F9');
  assert.deepEqual(f9.raisedBy.map(item => item.id).sort(), ['PD3', 'T03b']);
  assert.equal(report.devAccess, false);
  assert.equal(report.disposableDbOnly, true);
  assert.equal(report.pushSent, 0);
  assert.equal(report.providerCalls, 0);
  assert.ok(report.notProven.length >= 8);
  assert.ok(report.notProven.some(item => /DEV/.test(item)) && report.notProven.some(item => /device/i.test(item)) && report.notProven.some(item => /push/i.test(item)));
});

test('the report of a fixed world has no findings and says PASS with its scope', () => {
  const report = build({fixes: ALL_FIXES});
  assert.equal(report.result, 'PASS');
  assert.deepEqual(report.findings, []);
  assert.match(report.scope, /^PASS on \d+ of \d+ cases decided/);
});

test('the markdown says exactly what was and was not proved: the label, the level, the scope, and a disposable chain is NOT DEV', () => {
  const markdown = renderMarkdown(build());
  assert.match(markdown, /^# EX-06 S04 - dispatch lifecycle negative-case proof and probes/);
  assert.match(markdown, /\*\*Result: FINDINGS\*\*/);
  assert.match(markdown, /FUNCTION BODIES == DEV/);
  assert.match(markdown, /A disposable chain is NOT DEV/);
  assert.match(markdown, /nothing was sent/i);
  assert.match(markdown, /## Not proved/);
  assert.match(markdown, /## Chain fidelity/);
  assert.match(markdown, /## Cases: expected versus actual/);
  assert.match(markdown, /## Probes/);
  assert.match(markdown, /## Findings/);
  assert.ok(markdown.endsWith('\n'));
  assert.ok(markdown.length < 400000, 'bounded: ' + markdown.length);
});

test('the markdown has one row per case with its verdict, and the rows keep their column count (no stray separator)', () => {
  const markdown = renderMarkdown(build());
  const lines = markdown.split('\n');
  const rows = lines.filter(line => /^\| (R|L|V|C|Z|W|I|T)\d/.test(line));
  assert.equal(rows.length, CASES.filter(item => item.kind !== 'PROBE').length);
  for (const line of rows) assert.equal(line.replace(/\\\|/g, '').split('|').length, 8, line.slice(0, 120));
  assert.ok(rows.some(line => /R14.*FINDING/.test(line)));
  assert.ok(rows.some(line => /C01.*DOCUMENTED/.test(line)));
  assert.ok(rows.some(line => /R01.*PASS/.test(line)));
});

test('the probe table names the chain body md5 each probe ran against', () => {
  const markdown = renderMarkdown(build());
  const row = markdown.split('\n').find(line => line.startsWith('| PC '));
  assert.ok(row, 'probe PC has a row');
  assert.match(row, /CONFIRMED/);
  assert.match(row, /NOT_MET/);
  assert.match(row, /private\.emit_event 67413eff/);
  assert.match(row, /private\.push_suppression 0e027760/);
  assert.match(row, /public\.rpc_claim_push_transport 8059dcbd/);
});

test('the markdown lists the pins (tier, DEV md5, chain md5, verdict) and the explained differences', () => {
  const target = S04_PINS.find(pin => pin.name === 'public.rpc_set_account_block');
  const markdown = renderMarkdown(build({pinOverrides: {'public.rpc_set_account_block': {md5: target.chain.preImageDev, derived_b24_part1_pt409: target.md5}}}));
  const row = markdown.split('\n').find(line => line.includes('public.rpc_set_account_block') && line.startsWith('|'));
  assert.match(row, /SUPPORTING/);
  assert.match(row, new RegExp(target.md5));
  assert.match(row, /EXPLAINED/);
  assert.match(row, /B24 part 1/);
  assert.match(markdown, /1 explained by B24 part 1/);
});

test('a chain that differs is loud: the banner, the CHAIN_DIFFERS result, the affected pins, and the cases are marked as not evidence about DEV', () => {
  const report = build({pinOverrides: {'private.emit_event': {md5: 'e'.repeat(32)}}});
  assert.equal(report.result, 'CHAIN_DIFFERS');
  const markdown = renderMarkdown(report);
  assert.match(markdown, /CHAIN_DIFFERS/);
  assert.match(markdown, /NOT evidence about DEV/);
  assert.match(markdown, /private\.emit_event/);
  const annotations = annotationsFor(report);
  assert.ok(annotations.some(line => line.startsWith('::error::') && /chain/i.test(line)));
});

test('a failed scenario is listed with its error, the report is HARNESS_BROKEN and the annotation is an error', () => {
  const report = build({scenarioStatus: {ticks: 'HARNESS_ERROR'}});
  assert.equal(report.result, 'HARNESS_BROKEN');
  const markdown = renderMarkdown(report);
  assert.match(markdown, /simulated failure of ticks/);
  assert.match(markdown, /NOT_RUN/);
  assert.ok(annotationsFor(report).some(line => line.startsWith('::error::') && /harness/i.test(line)));
});

test('an optional scenario that failed is PARTIAL: an error annotation names it, the result is not hidden', () => {
  const report = build({scenarioStatus: {calendar: 'HARNESS_ERROR'}});
  assert.equal(report.result, 'PARTIAL');
  const annotations = annotationsFor(report);
  assert.ok(annotations.some(line => line.startsWith('::error::') && /PARTIAL/.test(line) && /calendar/.test(line)));
  assert.ok(annotations.some(line => line.startsWith('::warning::') && /finding/i.test(line)), 'the findings still show');
});

test('annotations: findings are warnings, the scope is a notice, probes that are not met are named', () => {
  const annotations = annotationsFor(build());
  assert.ok(annotations.some(line => line.startsWith('::warning::') && /8 finding/.test(line) && /F5/.test(line)));
  assert.ok(annotations.some(line => line.startsWith('::notice::') && /FINDINGS on/.test(line)));
  assert.ok(annotationsFor(build({fixes: ALL_FIXES})).every(line => !line.startsWith('::error::')));
  for (const line of annotations) assert.ok(!line.includes('\n'));
});

test('a focused re-run (EX06_S04_ONLY) is stated in the scope and the report', () => {
  const report = build({only: ['reach']});
  assert.deepEqual(report.only, ['reach']);
  assert.match(renderMarkdown(report), /Focused re-run: only the scenario\(s\) reach/);
});
