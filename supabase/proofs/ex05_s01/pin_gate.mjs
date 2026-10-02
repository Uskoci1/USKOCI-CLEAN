#!/usr/bin/env node
// EX05-S01: the PIN GATE of the disposable chain. It READS the chain (one read-only statement) for the 60 pinned chat-surface functions of dev_pins.json (the 2026-10-02 DEV capture),
// classifies with the pure module lib/pins.mjs, prints EVERY difference in one list before it decides, writes the report and the markdown, and sets the exit code.
//   node supabase/proofs/ex05_s01/pin_gate.mjs --out-dir <dir> [--db <url>] [--observations <file.json>] [--mode enforce|report]
// mode enforce (default, or env EX05_S01_PIN_GATE): exit 1 on a failure (a CORE pin missing or different without an explanation, any B24 conversion difference, a harness problem);
// mode report: print and write everything, exit 0 (the cheap first cycle: see every difference of a chain nobody has run yet).
// "== DEV" in the label claims the pinned function BODIES and metadata only; the chain is NOT DEV (lib/pins.mjs CHAIN_LACKS).
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {loadPins, chainReadSql, classifyPins, evaluatePinGate, listAllPinDifferences, gateLabel, renderPinGateMarkdown, CHAIN_LACKS} from './lib/pins.mjs';

const LOCAL_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error('UNEXPECTED_ARGUMENT ' + key);
    out[key.slice(2)] = argv[++index];
    if (out[key.slice(2)] === undefined) throw new Error('MISSING_VALUE ' + key);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const mode = args.mode ?? process.env.EX05_S01_PIN_GATE ?? 'enforce';
if (!['enforce', 'report'].includes(mode)) throw new Error('MODE_INVALID ' + mode);
if (!args['out-dir']) throw new Error('USAGE --out-dir <dir>');
const {meta, rows} = loadPins(readFileSync(resolve(here, 'dev_pins.json'), 'utf8'));

let observations;
if (args.observations) observations = JSON.parse(readFileSync(args.observations, 'utf8'));
else {
  const db = args.db ?? process.env.DB_URL;
  if (db !== LOCAL_DB) throw new Error('LOCAL_DATABASE_ONLY');
  observations = JSON.parse(execFileSync('psql', [db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-c', chainReadSql(rows)], {encoding: 'utf8'}).trim());
}

const gate = classifyPins(rows, observations);
const evaluation = evaluatePinGate(gate);
const lines = listAllPinDifferences(gate, evaluation);
const label = gateLabel(gate);
mkdirSync(args['out-dir'], {recursive: true});
const report = {unit: 'EX05_S01_PIN_GATE', mode, label, devPins: meta, chainLacks: CHAIN_LACKS, total: gate.total, equal: gate.equal.length, core: {total: gate.core.total, equal: gate.core.equal},
  adjacent: {total: gate.adjacent.total, equal: gate.adjacent.equal}, different: gate.different, missing: gate.missing, harness: gate.harness, verdict: evaluation.ok ? 'PASS' : 'FAIL',
  failures: evaluation.failures, warnings: evaluation.warnings, enforced: mode === 'enforce'};
writeFileSync(args['out-dir'] + '/ex05-s01-pin-gate-report.json', JSON.stringify(report, null, 2) + '\n');
writeFileSync(args['out-dir'] + '/ex05-s01-pin-gate.md', renderPinGateMarkdown(gate, evaluation));
console.log(label);
for (const line of lines) console.log(line);
console.log((evaluation.ok ? 'PASS' : 'FAIL') + ' EX05_S01_PIN_GATE mode=' + mode + ' equal=' + gate.equal.length + '/' + gate.total + ' failures=' + evaluation.failures.length + ' warnings=' + evaluation.warnings.length);
if (!evaluation.ok && mode === 'enforce') process.exit(1);
