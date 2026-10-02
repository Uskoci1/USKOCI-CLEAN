#!/usr/bin/env node
// EX05-S01: derives the B24 Part 1 CHAIN VARIANT from the committed candidate (supabase/candidates/b24_nonretried_conflicts_part1.sql) for the DISPOSABLE chain. The logic is the pure module
// lib/b24_chain.mjs (unit-tested offline); this file only reads the chain, writes two files and sets the exit code.
//   node supabase/proofs/ex05_s01/derive_b24_part1_chain.mjs --out <variant.sql> --report <report.json> [--db <url>] [--observations <file.json>] [--candidate <path>] [--print-observation-sql]
// --db           the disposable database (only postgresql://postgres:postgres@127.0.0.1:54322/postgres is accepted: never DEV, never a hosted project)
// --observations a pre-captured result of the observation statement (offline tests); without --db the file is required
// Exit 1 when a CRITICAL target (a function the chat proofs assert on) cannot be converted on this chain. The variant is applied by the workflow with b24.preimage = relaxed; NEVER to DEV.
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {parseB24Part1Targets, targetObservationSql, planChainVariant, CANDIDATE_PATH} from './lib/b24_chain.mjs';

const LOCAL_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error('UNEXPECTED_ARGUMENT ' + key);
    if (key === '--print-observation-sql') { out.printObservationSql = true; continue; }
    out[key.slice(2)] = argv[++index];
    if (out[key.slice(2)] === undefined) throw new Error('MISSING_VALUE ' + key);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const candidateText = readFileSync(args.candidate ?? CANDIDATE_PATH, 'utf8');
const targets = parseB24Part1Targets(candidateText);
if (args.printObservationSql) { process.stdout.write(targetObservationSql(targets) + '\n'); process.exit(0); }
if (!args.out || !args.report) throw new Error('USAGE --out <variant.sql> --report <report.json>');

let observations;
if (args.observations) observations = JSON.parse(readFileSync(args.observations, 'utf8'));
else {
  const db = args.db ?? process.env.DB_URL;
  if (db !== LOCAL_DB) throw new Error('LOCAL_DATABASE_ONLY');
  observations = JSON.parse(execFileSync('psql', [db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-c', targetObservationSql(targets)], {encoding: 'utf8'}).trim());
}

const plan = planChainVariant(candidateText, observations);
writeFileSync(args.out, plan.sql);
writeFileSync(args.report, JSON.stringify(plan.report, null, 2) + '\n');
console.log('B24_PART1_CHAIN_VARIANT kept=' + plan.report.kept + '/' + plan.report.targets + ' sites=' + plan.report.keptSites + ' dropped=' + plan.report.dropped.length
  + ' criticalDropped=' + plan.report.criticalDropped.length + ' identicalToCommitted=' + plan.report.identicalToCommitted);
for (const item of plan.report.dropped) console.log('  dropped ' + item.fn + ' ' + item.reason + ' (expected ' + item.expectedSites + ' sites, observed ' + item.observedSites + ', functions ' + item.count + ')');
if (!plan.report.ok) { console.error('FAIL B24_PART1_CRITICAL_TARGET_NOT_CONVERTIBLE ' + plan.report.criticalDropped.map(item => item.fn + ':' + item.reason).join(', ')); process.exit(1); }
