// EX05-S01 offline tests of the proof matrix (supabase/proofs/ex05_s01/proof_matrix.json): its schema, its ties to the proof sources and to the workflow, the result extraction from CI
// reports, and the generated evidence table (docs/.../ex05/EX05_S01_EVIDENCE_TABLE_20261002.md must equal the render of the matrix, byte for byte).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateMatrix, extractResult, renderEvidenceTable, MATRIX_UNIT, DISPOSITION_MODES, summarizeResults} from './matrix.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = path => readFileSync(root + path, 'utf8');
const doc = JSON.parse(read('supabase/proofs/ex05_s01/proof_matrix.json'));
const TABLE_DOC = 'docs/implementation/product-v1-closure-20260926/finalization-20260927/ex05/EX05_S01_EVIDENCE_TABLE_20261002.md';

test('the committed matrix validates', () => {
  assert.equal(doc.unit, MATRIX_UNIT);
  assert.doesNotThrow(() => validateMatrix(doc));
  assert.ok(doc.rows.length >= 14);
});

test('a matrix with a duplicate id, a missing field, an unknown mode or an empty disposition is refused', () => {
  const clone = () => JSON.parse(JSON.stringify(doc));
  const duplicate = clone(); duplicate.rows[1].id = duplicate.rows[0].id;
  assert.throws(() => validateMatrix(duplicate), /MATRIX_DUPLICATE_ID/);
  const missing = clone(); delete missing.rows[0].assumes;
  assert.throws(() => validateMatrix(missing), /MATRIX_ROW_FIELD_MISSING/);
  const mode = clone(); mode.rows[0].disposition[0].mode = 'MAGIC';
  assert.throws(() => validateMatrix(mode), /MATRIX_DISPOSITION_MODE/);
  const empty = clone(); empty.rows[0].disposition = [];
  assert.throws(() => validateMatrix(empty), /MATRIX_DISPOSITION_EMPTY/);
  const wrong = clone(); wrong.unit = 'X';
  assert.throws(() => validateMatrix(wrong), /MATRIX_UNIT/);
});

test('every frozen proof the matrix names exists, and every updated copy and every check name it lists exists in that proof', () => {
  for (const row of doc.rows) {
    for (const file of [row.proof, ...(row.also ?? []), ...(row.originalWorkflow ? [row.originalWorkflow] : [])]) assert.ok(existsSync(root + file), row.id + ' names a missing file ' + file);
    for (const item of row.disposition) {
      if (item.mode !== 'UPDATED_COPY') continue;
      assert.ok(existsSync(root + item.proof), row.id + ' names a missing updated copy ' + item.proof);
      const source = read(item.proof);
      for (const name of item.checks) assert.ok(source.includes("'" + name + "'"), row.id + ': ' + item.proof + ' has no check ' + name);
    }
  }
});

test('every check of every updated proof is named by at least one matrix row (the table is complete)', () => {
  const named = new Set();
  for (const row of doc.rows) for (const item of row.disposition) if (item.mode === 'UPDATED_COPY') for (const name of item.checks) named.add(item.proof + '#' + name);
  for (const proof of ['text', 'readers', 'photo', 'group', 'voice', 'push']) {
    const path = 'supabase/proofs/ex05_s01/ex05_s01_' + proof + '_proof.mjs', source = read(path);
    const names = [...source.matchAll(/h\.(?:check|characterize)\(\s*'([A-Z0-9_]+)'/g)].map(match => match[1]);
    const constants = new Map([...source.matchAll(/const\s+(\w+)\s*=\s*'([A-Z0-9_]+)'\s*;/g)].map(match => [match[1], match[2]]));
    for (const match of source.matchAll(/h\.(?:check|characterize)\(\s*([A-Z_]+)\s*,/g)) if (constants.has(match[1])) names.push(constants.get(match[1]));
    for (const name of names) {
      if (/^FIXTURE_|^CHAIN_IS_|^SOURCE_BYTES/.test(name)) continue; // fixtures and harness checks are not behaviour rows
      assert.ok(named.has(path + '#' + name), 'no matrix row names ' + path + ' check ' + name);
    }
  }
});

test('the workflow named by the matrix exists, runs every updated proof and every job the dispositions name', () => {
  assert.ok(existsSync(root + doc.workflow));
  const workflow = read(doc.workflow);
  for (const row of doc.rows) for (const item of row.disposition) {
    assert.ok(DISPOSITION_MODES.includes(item.mode));
    if (item.job) assert.ok(new RegExp('^  ' + item.job + ':', 'm').test(workflow), row.id + ' names job ' + item.job + ' which the workflow does not define');
    if (item.mode === 'UPDATED_COPY') assert.ok(workflow.includes(item.proof.split('/').pop()), row.id + ': the workflow does not run ' + item.proof);
  }
});

test('extractResult reads a plain report, a pkg010 chain summary entry and a missing report', () => {
  assert.deepEqual(extractResult({result: 'PASS', checks: [{name: 'A', result: 'PASS'}, {name: 'B', result: 'PASS'}]}, {}), {state: 'PASS', passed: 2, total: 2});
  assert.deepEqual(extractResult({result: 'FAIL', checks: [{name: 'A', result: 'PASS'}, {name: 'B', result: 'FAIL'}], failures: [{name: 'B'}]}, {}), {state: 'FAIL', passed: 1, total: 2});
  const summary = {proofs: [{script: 'v5_group_conversation_proof.mjs', result: 'PASS', checks: 6}, {script: 'v5_agreement_photos_proof.mjs', result: 'FAIL', checks: 3}]};
  assert.deepEqual(extractResult(summary, {proofScript: 'v5_group_conversation_proof.mjs'}), {state: 'PASS', passed: 6, total: 6});
  assert.deepEqual(extractResult(summary, {proofScript: 'v5_agreement_photos_proof.mjs'}), {state: 'FAIL', passed: 0, total: 3});
  assert.deepEqual(extractResult(summary, {proofScript: 'nope.mjs'}), {state: 'NOT_RUN', passed: 0, total: 0});
  assert.deepEqual(extractResult(null, {}), {state: 'NOT_RUN', passed: 0, total: 0});
  assert.deepEqual(extractResult({result: 'PASS', checks: [{name: 'A', result: 'PASS'}, {name: 'R', result: 'RECORDED'}], skipped: 0, failed: 0, recorded: 1}, {}), {state: 'PASS', passed: 2, total: 2});
});

test('summarizeResults counts rows by state and reports the exit verdict', () => {
  const rows = [{state: 'PASS'}, {state: 'PASS'}, {state: 'FAIL'}, {state: 'NOT_RUN'}];
  assert.deepEqual(summarizeResults(rows), {PASS: 2, FAIL: 1, NOT_RUN: 1, ok: false});
  assert.equal(summarizeResults([{state: 'PASS'}]).ok, true);
});

test('the committed evidence table is exactly the render of the matrix with no CI results (a slot for the run id, every result NOT RUN)', () => {
  const rendered = renderEvidenceTable(doc);
  assert.ok(existsSync(root + TABLE_DOC), 'run: node supabase/proofs/ex05_s01/render_evidence.mjs --write');
  assert.ok(read(TABLE_DOC).replace(/\r\n/g, '\n') === rendered, 'the committed table is stale: run node supabase/proofs/ex05_s01/render_evidence.mjs --write');
  assert.match(rendered, /\| ID \| Proof \(frozen original\) \| Predecessor state it assumes \| Offline verdict/);
  assert.match(rendered, /Run id/); assert.match(rendered, /NOT RUN/);
});

test('the rendered table with results shows PASS/FAIL counts and the run id, and keeps failed evidence visible', () => {
  const row = doc.rows[0], report = row.disposition.find(item => item.report)?.report;
  assert.ok(report);
  const withResults = renderEvidenceTable(doc, {runId: '123456789', results: {[report]: {state: 'FAIL', passed: 3, total: 5}}});
  assert.match(withResults, /123456789/); assert.match(withResults, /FAIL \(3\/5\)/);
});
