#!/usr/bin/env node
// EX05-S01: renders the evidence table "proof -> predecessor state it assumes -> result on the current chain" from supabase/proofs/ex05_s01/proof_matrix.json (the pure module is lib/matrix.mjs).
//   node supabase/proofs/ex05_s01/render_evidence.mjs --write
//        regenerates the committed table (docs/implementation/product-v1-closure-20260926/finalization-20260927/ex05/EX05_S01_EVIDENCE_TABLE_20261002.md) with NO results: every result reads
//        NOT RUN and the run id is an empty slot, because nothing has been run in CI at authoring time.
//   node supabase/proofs/ex05_s01/render_evidence.mjs --check
//        exits 1 when the committed table is not exactly that render (the unit test does the same).
//   node supabase/proofs/ex05_s01/render_evidence.mjs --reports-dir <dir> --run-id <id> [--out <file>] [--summary-out <file>]
//        reads every *.json under <dir> (recursively, matched by file name: the downloaded artifacts of the workflow), fills each row's result and the run id, prints the table (or writes --out)
//        and exits 1 when a row has a FAIL or NOT RUN result, so the evidence job of the workflow carries the verdict.
// Nothing here talks to a database.
import {readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateMatrix, extractResult, summarizeResults, renderEvidenceTable} from './lib/matrix.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
export const TABLE_DOC = 'docs/implementation/product-v1-closure-20260926/finalization-20260927/ex05/EX05_S01_EVIDENCE_TABLE_20261002.md';

function parseArgs(argv) {
  const flags = new Set(['write', 'check']), out = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error('UNEXPECTED_ARGUMENT ' + key);
    const name = key.slice(2);
    if (flags.has(name)) { out[name] = true; continue; }
    out[name] = argv[++index];
    if (out[name] === undefined) throw new Error('MISSING_VALUE ' + key);
  }
  return out;
}

/** Every *.json under `dir`, keyed by base name (the last one wins: the workflow uploads each report name once). Unparseable files are ignored and listed. */
export function collectReports(dir) {
  const reports = new Map(), unreadable = [];
  const walk = current => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!entry.endsWith('.json')) continue;
      try { reports.set(entry, JSON.parse(readFileSync(path, 'utf8'))); } catch { unreadable.push(path); }
    }
  };
  if (existsSync(dir)) walk(dir);
  return {reports, unreadable};
}

/** `item.report` is `file.json` or `file.json#script.mjs` (an entry of a pkg010 chain summary). */
export function resultsFromReports(doc, reports) {
  const results = {};
  for (const row of doc.rows) for (const item of row.disposition) {
    if (!item.report || results[item.report] !== undefined) continue;
    const [file, script] = item.report.split('#');
    results[item.report] = extractResult(reports.get(file) ?? null, script ? {proofScript: script} : {});
  }
  return results;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const doc = validateMatrix(JSON.parse(readFileSync(resolve(args.matrix ?? join(here, 'proof_matrix.json')), 'utf8')));
  const target = resolve(repoRoot, TABLE_DOC);
  if (args.write || args.check) {
    const rendered = renderEvidenceTable(doc);
    if (args.write) {
      mkdirSync(dirname(target), {recursive: true});
      writeFileSync(target, rendered);
      console.log('wrote ' + TABLE_DOC + ' rows=' + doc.rows.length);
      return;
    }
    const committed = existsSync(target) ? readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : null;
    if (committed !== rendered) { console.error('EVIDENCE_TABLE_STALE run: node supabase/proofs/ex05_s01/render_evidence.mjs --write'); process.exitCode = 1; return; }
    console.log('EVIDENCE_TABLE_CURRENT rows=' + doc.rows.length);
    return;
  }
  if (!args['reports-dir']) throw new Error('USAGE --write | --check | --reports-dir <dir> [--run-id <id>] [--out <file>] [--summary-out <file>]');
  const {reports, unreadable} = collectReports(resolve(args['reports-dir']));
  const results = resultsFromReports(doc, reports);
  const table = renderEvidenceTable(doc, {runId: args['run-id'] ?? null, results});
  if (args.out) { mkdirSync(dirname(resolve(args.out)), {recursive: true}); writeFileSync(args.out, table); } else process.stdout.write(table);
  const summary = summarizeResults(Object.values(results));
  const line = 'EX05_S01_EVIDENCE reports=' + reports.size + ' unreadable=' + unreadable.length + ' pass=' + summary.PASS + ' fail=' + summary.FAIL + ' not_run=' + summary.NOT_RUN;
  console.error(line);
  for (const [name, value] of Object.entries(results)) if (value.state !== 'PASS') console.error('  ' + value.state + ' ' + name + ' (' + value.passed + '/' + value.total + ')');
  if (args['summary-out']) writeFileSync(args['summary-out'], JSON.stringify({unit: 'EX05_S01_EVIDENCE', runId: args['run-id'] ?? null, ...summary, unreadable, results}, null, 2) + '\n');
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
