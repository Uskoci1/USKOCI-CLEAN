#!/usr/bin/env node
// EX05-S01: turns the TAP output of `node --test --test-reporter=tap <files>` into the small report the evidence table reads (the OFFLINE_RERUN row, OF-01).
//   node supabase/proofs/ex05_s01/offline_report.mjs --tap <file.tap> --exit <code> --out <report.json> [--unit <name>]
// The counts come from the TAP summary lines (# tests, # pass, # fail); `checks` has one synthetic entry per counted test so the table shows pass/total exactly as node counted them.
// A non-zero exit code, a failing test, or a missing summary is a FAIL (never a silent PASS). No database, no network.
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function tapReport(tap, exitCode, unit = 'EX05_S01_OFFLINE_EXISTING') {
  const count = key => { const match = new RegExp('^# ' + key + ' (\\d+)\\s*$', 'm').exec(tap); return match ? Number(match[1]) : null; };
  const tests = count('tests'), pass = count('pass'), fail = count('fail'), cancelled = count('cancelled') ?? 0;
  const summarised = tests !== null && pass !== null && fail !== null;
  const passed = summarised ? pass : 0, total = summarised ? tests : 0;
  const ok = summarised && Number(exitCode) === 0 && fail === 0 && cancelled === 0 && tests > 0 && pass === tests;
  const checks = [];
  for (let index = 1; index <= total; index++) checks.push({name: 'node-test-' + index, result: index <= passed ? 'PASS' : 'FAIL'});
  return {unit, result: ok ? 'PASS' : 'FAIL', exitCode: Number(exitCode), tests: total, pass: passed, fail: summarised ? fail : null, cancelled, summarised, checks};
}

function main() {
  const args = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!key.startsWith('--') || process.argv[index + 1] === undefined) throw new Error('USAGE --tap <file> --exit <code> --out <report.json> [--unit <name>]');
    args[key.slice(2)] = process.argv[index + 1];
  }
  if (!args.tap || args.exit === undefined || !args.out) throw new Error('USAGE --tap <file> --exit <code> --out <report.json> [--unit <name>]');
  const report = tapReport(readFileSync(args.tap, 'utf8'), args.exit, args.unit);
  writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n');
  console.log(report.result + ' ' + report.unit + ' tests=' + report.tests + ' pass=' + report.pass + ' fail=' + report.fail);
  if (report.result !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
