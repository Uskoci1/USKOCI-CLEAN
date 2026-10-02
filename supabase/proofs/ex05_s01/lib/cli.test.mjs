// EX05-S01 offline tests of the two command-line tools (derive_b24_part1_chain.mjs and pin_gate.mjs): they run as real child processes with PRE-CAPTURED observations, so the file
// handling, the exit codes, the local-database refusal and the report files are proved without a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseB24Part1Targets, CANDIDATE_PATH} from './b24_chain.mjs';
import {loadPins} from './pins.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const pkg = root + 'supabase/proofs/ex05_s01/';
const node = process.execPath;
const run = (script, args, env = {}) => spawnSync(node, [pkg + script, ...args], {cwd: root, encoding: 'utf8', env: {...process.env, ...env}});
const scratch = () => mkdtempSync(join(tmpdir(), 'ex05-s01-cli-'));

const candidate = readFileSync(root + CANDIDATE_PATH, 'utf8');
const targets = parseB24Part1Targets(candidate);
const observations = (overrides = {}) => targets.map(item => ({fn: item.fn, count: 1, sites: item.sites, hasPt409: false, strayMention: false, ...(overrides[item.fn] ?? {})}));

test('derive: with every target observed the variant is the committed candidate and the exit code is 0', () => {
  const dir = scratch(), observationFile = join(dir, 'obs.json');
  writeFileSync(observationFile, JSON.stringify(observations()));
  const result = run('derive_b24_part1_chain.mjs', ['--observations', observationFile, '--out', join(dir, 'variant.sql'), '--report', join(dir, 'report.json')]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /B24_PART1_CHAIN_VARIANT kept=54\/54 sites=89 dropped=0 criticalDropped=0 identicalToCommitted=true/);
  assert.ok(readFileSync(join(dir, 'variant.sql'), 'utf8') === candidate);
  const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
  assert.equal(report.ok, true); assert.equal(report.unit, 'EX05_S01_B24_PART1_CHAIN_VARIANT');
});

test('derive: dropping non-critical targets still exits 0 and lists them; dropping a critical one exits 1 and names it', () => {
  const dir = scratch(), observationFile = join(dir, 'obs.json');
  writeFileSync(observationFile, JSON.stringify(observations({'private.platform_price_add_version': {count: 0, sites: 0}})));
  const fine = run('derive_b24_part1_chain.mjs', ['--observations', observationFile, '--out', join(dir, 'v.sql'), '--report', join(dir, 'r.json')]);
  assert.equal(fine.status, 0, fine.stderr);
  assert.match(fine.stdout, /kept=53\/54 sites=88 dropped=1/); assert.match(fine.stdout, /dropped private\.platform_price_add_version ABSENT/);
  writeFileSync(observationFile, JSON.stringify(observations({'public.rpc_begin_push_send': {count: 0, sites: 0}})));
  const refused = run('derive_b24_part1_chain.mjs', ['--observations', observationFile, '--out', join(dir, 'v2.sql'), '--report', join(dir, 'r2.json')]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /B24_PART1_CRITICAL_TARGET_NOT_CONVERTIBLE public\.rpc_begin_push_send:ABSENT/);
  assert.ok(existsSync(join(dir, 'r2.json')), 'the report is written even when the plan is refused');
});

test('derive: --print-observation-sql prints one read-only statement; a non-local database and a missing output are refused', () => {
  const printed = run('derive_b24_part1_chain.mjs', ['--print-observation-sql']);
  assert.equal(printed.status, 0); assert.match(printed.stdout, /^select coalesce\(jsonb_agg/); assert.ok(!printed.stdout.trim().endsWith(';'));
  const dir = scratch();
  const remote = run('derive_b24_part1_chain.mjs', ['--db', 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres', '--out', join(dir, 'v.sql'), '--report', join(dir, 'r.json')]);
  assert.notEqual(remote.status, 0); assert.match(remote.stderr, /LOCAL_DATABASE_ONLY/);
  const noOut = run('derive_b24_part1_chain.mjs', ['--observations', join(dir, 'missing.json')]);
  assert.notEqual(noOut.status, 0); assert.match(noOut.stderr, /USAGE/);
});

const {rows} = loadPins(readFileSync(pkg + 'dev_pins.json', 'utf8'));
const equalObservations = () => rows.map(row => ({signature: row.signature, exists: true, bodyMd5: row.bodyMd5, metadataMd5: row.metadataMd5, hasPt409: row.pt409, has40001: false}));

test('pin gate: an identical chain passes, writes the report and the markdown, and prints the DEV-equal label', () => {
  const dir = scratch(), observationFile = join(dir, 'obs.json');
  writeFileSync(observationFile, JSON.stringify(equalObservations()));
  const result = run('pin_gate.mjs', ['--observations', observationFile, '--out-dir', join(dir, 'out')]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /EX05-S01 PINS == DEV \(60\/60/); assert.match(result.stdout, /PASS EX05_S01_PIN_GATE mode=enforce equal=60\/60 failures=0 warnings=0/);
  const report = JSON.parse(readFileSync(join(dir, 'out', 'ex05-s01-pin-gate-report.json'), 'utf8'));
  assert.equal(report.verdict, 'PASS'); assert.equal(report.devPins.combinedMd5, '0d917757efecc1bce8a4d3b167525375'); assert.ok(report.chainLacks.length >= 5);
  assert.ok(readFileSync(join(dir, 'out', 'ex05-s01-pin-gate.md'), 'utf8').startsWith('## EX05-S01 pin gate'));
});

test('pin gate: a core difference fails in enforce mode, passes in report mode, and BOTH print every difference', () => {
  const dir = scratch(), observationFile = join(dir, 'obs.json');
  const core = rows.find(row => row.group === 'core' && !row.composite);
  writeFileSync(observationFile, JSON.stringify(equalObservations().map(item => item.signature === core.signature ? {...item, bodyMd5: 'f'.repeat(32)} : item)));
  const enforced = run('pin_gate.mjs', ['--observations', observationFile, '--out-dir', join(dir, 'e')]);
  assert.equal(enforced.status, 1);
  assert.match(enforced.stdout, /FAIL CORE_PIN_UNEXPLAINED_DIFFERENCE/); assert.match(enforced.stdout, new RegExp('DIFF \\[core\\] ' + core.signature.replace(/[().]/g, '\\$&')));
  const reported = run('pin_gate.mjs', ['--observations', observationFile, '--out-dir', join(dir, 'r'), '--mode', 'report']);
  assert.equal(reported.status, 0);
  assert.match(reported.stdout, /FAIL EX05_S01_PIN_GATE mode=report/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'r', 'ex05-s01-pin-gate-report.json'), 'utf8')).enforced, false);
});

test('pin gate: the environment variable sets the mode, an unknown mode and a non-local database are refused', () => {
  const dir = scratch(), observationFile = join(dir, 'obs.json');
  writeFileSync(observationFile, JSON.stringify(equalObservations().slice(1)));
  const viaEnv = run('pin_gate.mjs', ['--observations', observationFile, '--out-dir', join(dir, 'o')], {EX05_S01_PIN_GATE: 'report'});
  assert.equal(viaEnv.status, 0); assert.match(viaEnv.stdout, /mode=report/);
  const badMode = run('pin_gate.mjs', ['--observations', observationFile, '--out-dir', join(dir, 'o2'), '--mode', 'whatever']);
  assert.notEqual(badMode.status, 0); assert.match(badMode.stderr, /MODE_INVALID/);
  const remote = run('pin_gate.mjs', ['--db', 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres', '--out-dir', join(dir, 'o3')]);
  assert.notEqual(remote.status, 0); assert.match(remote.stderr, /LOCAL_DATABASE_ONLY/);
});

test('both tools are valid ES modules (syntax)', () => {
  for (const script of ['derive_b24_part1_chain.mjs', 'pin_gate.mjs']) execFileSync(node, ['--check', pkg + script]);
});
