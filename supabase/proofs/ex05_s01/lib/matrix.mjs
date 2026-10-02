// EX05-S01: the PROOF MATRIX (pure module, unit-tested in matrix.test.mjs). supabase/proofs/ex05_s01/proof_matrix.json is the single source of the evidence table
// "proof -> predecessor state it assumes -> result on the current chain": one row per EXISTING chat server proof, with what it assumes, whether B24 (PT409 instead of 40001) or Voice B1
// (ledger 215) touches it, the OFFLINE verdict (read from the SQL and from the DEV bodies, no run), and what S01 does about it (re-run at its own position, an updated copy for the post-state
// chain, or nothing and why). This module validates the matrix, extracts a verdict from a CI report, and renders the markdown. With no CI results every result reads NOT RUN and the run
// id is an empty slot: the root fills it after the workflow ran (render_evidence.mjs --reports-dir <downloaded artifacts> prints the filled table).
export const MATRIX_UNIT = 'EX05_S01_PROOF_MATRIX';
export const DISPOSITION_MODES = Object.freeze(['RERUN_AT_POSITION', 'UPDATED_COPY', 'OFFLINE_RERUN', 'NOT_RERUN']);
const ROW_FIELDS = ['id', 'flow', 'proof', 'assumes', 'b24', 'voiceB1', 'offlineVerdict', 'verdictCode', 'evidence', 'disposition'];
const RUN_SLOT = '_(fill in after the run)_';

export function validateMatrix(doc) {
  if (!doc || doc.unit !== MATRIX_UNIT) throw new Error('MATRIX_UNIT');
  if (!Array.isArray(doc.rows) || doc.rows.length === 0) throw new Error('MATRIX_ROWS_REQUIRED');
  for (const key of ['title', 'status', 'workflow', 'intro', 'legend', 'chain', 'notReestablished']) if (doc[key] === undefined) throw new Error('MATRIX_FIELD_MISSING ' + key);
  const ids = new Set();
  for (const row of doc.rows) {
    for (const field of ROW_FIELDS) if (row[field] === undefined || row[field] === null || row[field] === '') throw new Error('MATRIX_ROW_FIELD_MISSING ' + (row.id ?? '?') + ' ' + field);
    if (ids.has(row.id)) throw new Error('MATRIX_DUPLICATE_ID ' + row.id);
    ids.add(row.id);
    if (!Array.isArray(row.evidence) || row.evidence.length === 0) throw new Error('MATRIX_EVIDENCE_REQUIRED ' + row.id);
    if (!Array.isArray(row.disposition)) throw new Error('MATRIX_DISPOSITION_EMPTY ' + row.id);
    if (row.disposition.length === 0) throw new Error('MATRIX_DISPOSITION_EMPTY ' + row.id);
    for (const item of row.disposition) {
      if (!DISPOSITION_MODES.includes(item.mode)) throw new Error('MATRIX_DISPOSITION_MODE ' + row.id + ' ' + item.mode);
      if (item.mode === 'UPDATED_COPY' && (!item.proof || !Array.isArray(item.checks) || item.checks.length === 0 || !item.report)) throw new Error('MATRIX_UPDATED_COPY_INCOMPLETE ' + row.id);
      if (item.mode === 'RERUN_AT_POSITION' && (!item.job || !item.report)) throw new Error('MATRIX_RERUN_INCOMPLETE ' + row.id);
      if (item.mode === 'NOT_RERUN' && !item.why) throw new Error('MATRIX_NOT_RERUN_WHY ' + row.id);
    }
  }
  return doc;
}

/** The verdict of one CI report: {state: PASS|FAIL|NOT_RUN, passed, total}. `locator.proofScript` reads one proof entry of a pkg010 chain summary; RECORDED checks count as passed. */
export function extractResult(report, locator = {}) {
  if (report === null || report === undefined || typeof report !== 'object') return {state: 'NOT_RUN', passed: 0, total: 0};
  if (locator.proofScript) {
    const entry = Array.isArray(report.proofs) ? report.proofs.find(item => item.script === locator.proofScript) : undefined;
    if (!entry) return {state: 'NOT_RUN', passed: 0, total: 0};
    const total = Number(entry.checks ?? 0), pass = entry.result === 'PASS';
    return {state: pass ? 'PASS' : 'FAIL', passed: pass ? total : 0, total};
  }
  const checks = Array.isArray(report.checks) ? report.checks : [];
  return {state: report.result === 'PASS' ? 'PASS' : 'FAIL', passed: checks.filter(item => item.result === 'PASS' || item.result === 'RECORDED').length, total: checks.length};
}

export function summarizeResults(results) {
  const counts = {PASS: 0, FAIL: 0, NOT_RUN: 0};
  for (const item of results) counts[item.state] = (counts[item.state] ?? 0) + 1;
  return {...counts, ok: counts.FAIL === 0 && counts.NOT_RUN === 0};
}

const cell = text => String(text).replace(/\r?\n/g, ' ').replaceAll('|', '\\|');
const baseName = path => String(path).split('/').pop();
const stateText = (result) => result === undefined || result.state === 'NOT_RUN' ? 'NOT RUN' : result.state + ' (' + result.passed + '/' + result.total + ')';

function resultCell(row, results) {
  return row.disposition.map(item => {
    if (item.mode === 'RERUN_AT_POSITION') return 'at position (' + item.job + '): ' + stateText(results[item.report]);
    if (item.mode === 'UPDATED_COPY') return 'updated copy ' + baseName(item.proof) + ': ' + stateText(results[item.report]);
    if (item.mode === 'OFFLINE_RERUN') return 'offline: ' + (results[item.report] ? stateText(results[item.report]) : (item.local ?? 'NOT RUN'));
    return 'not re-run: ' + item.why;
  }).join('; ');
}

/**
 * The evidence table (markdown). `options.results` maps a report name (as the matrix names it) to an extractResult verdict; `options.runId` fills the run slot.
 * Deterministic: the same matrix and options always give the same bytes, so the committed table can be compared (`--check`).
 */
export function renderEvidenceTable(doc, {runId = null, results = {}} = {}) {
  const run = runId === null ? RUN_SLOT : String(runId);
  const lines = [];
  lines.push('# ' + doc.title, '', '**' + doc.status + '**', '');
  for (const paragraph of doc.intro) lines.push(paragraph, '');
  lines.push('## Run record', '', '| Field | Value |', '| --- | --- |', '| Workflow | `' + doc.workflow + '` |', '| Run id | ' + run + ' |',
    '| Head sha | ' + (runId === null ? RUN_SLOT : 'see the run') + ' |', '| DEV facts read | ' + cell(doc.devFacts ?? '') + ' |', '');
  lines.push('## Legend', '');
  for (const item of doc.legend) lines.push('- ' + item);
  lines.push('', '## The chain every post-state proof runs on', '');
  lines.push(doc.chain.description, '');
  for (const stage of doc.chain.stages) lines.push('- ' + stage);
  lines.push('', 'The chain lacks (named, never hidden): ' + doc.chain.lacks.join('; ') + '.', '');
  lines.push('## Table', '', '| ID | Proof (frozen original) | Predecessor state it assumes | Offline verdict (do its assumptions hold on the current chain?) | Result on the current chain | Run id |', '| --- | --- | --- | --- | --- | --- |');
  for (const row of doc.rows) {
    lines.push('| ' + [row.id, '`' + baseName(row.proof) + '`', cell(row.assumes), '**' + row.verdictCode + '**: ' + cell(row.offlineVerdict), cell(resultCell(row, results)), run].join(' | ') + ' |');
  }
  lines.push('', '## Per-row detail', '');
  for (const row of doc.rows) {
    lines.push('### ' + row.id + ' - ' + row.flow + ' - `' + row.proof + '`', '');
    if (row.originalWorkflow) lines.push('- Original workflow: `' + row.originalWorkflow + '`' + (row.originalEvidence ? '; original evidence: ' + row.originalEvidence : ''));
    else if (row.originalEvidence) lines.push('- Original evidence: ' + row.originalEvidence);
    lines.push('- Assumes: ' + row.assumes, '- B24 (PT409 instead of 40001): ' + row.b24, '- Voice B1: ' + row.voiceB1, '- Offline verdict **' + row.verdictCode + '**: ' + row.offlineVerdict);
    lines.push('- Evidence read: ' + row.evidence.join('; '));
    for (const item of row.disposition) {
      if (item.mode === 'RERUN_AT_POSITION') lines.push('- Disposition RERUN AT ITS POSITION in job `' + item.job + '`' + (item.step ? ' (' + item.step + ')' : '') + ': report `' + item.report + '`' + (item.note ? ' - ' + item.note : ''));
      else if (item.mode === 'UPDATED_COPY') lines.push('- Disposition UPDATED COPY `' + item.proof + '` (report `' + item.report + '`): checks ' + item.checks.map(name => '`' + name + '`').join(', ') + (item.diff ? '. Diff against the original: ' + item.diff : ''));
      else if (item.mode === 'OFFLINE_RERUN') lines.push('- Disposition OFFLINE RERUN: ' + item.what + (item.local ? ' (' + item.local + ')' : ''));
      else lines.push('- Disposition NOT RE-RUN: ' + item.why);
    }
    lines.push('');
  }
  lines.push('## Not re-established by this slice (stated, not hidden)', '');
  for (const item of doc.notReestablished) lines.push('- **' + item.what + '**: ' + item.why);
  lines.push('');
  return lines.join('\n');
}
