// EX-06 S04: offline tests of the orchestration (main.mjs): the settings, the schema preflight, the pin gate, the configuration, the certificate and catalog checks, the isolation and its cleanup, the
// focused re-run, the report files and the exit codes. The run is driven against the simulated world (world_sim.mjs) and a fake proof adapter that answers the pin, config and catalog queries.
// They prove the orchestration is wired and fails loudly; they say nothing about what the chain does: the CI run does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CASES, SCENARIO_IDS} from './cases.mjs';
import {DEV_CONFIG} from './config.mjs';
import {S04_PINS, chainLabel, notReadChain} from './pins.mjs';
import {ALL_FIXES} from './reference_obs.mjs';
import {annotationsFor} from './report.mjs';
import {SCHEMA_CONTRACT} from './sql.mjs';
import {World} from './world_sim.mjs';
import {parseEnv, readStages, runProof} from './main.mjs';

const contractRows = (skip = null) => Object.entries(SCHEMA_CONTRACT).flatMap(([table, columns]) => columns.filter(column => `${table}.${column}` !== skip).map(column => ({t: table, column_name: column})));
const devConfigRows = () => [
  {key: 'dispatch_normal', sha256: DEV_CONFIG.dispatch_normal.sha256, wave_sizes: [5, 5, 10, 20], target_responses: '3', window_minutes: '15'},
  {key: 'dispatch_urgent', sha256: DEV_CONFIG.dispatch_urgent.sha256, wave_sizes: [10, 10, 20], target_responses: '3', window_minutes: '3'},
  {key: 'urgent_activation_policy', sha256: DEV_CONFIG.urgent_activation_policy.sha256, wave_sizes: null, target_responses: null, window_minutes: null},
];

function fakeRt({pinOverrides = {}, configRows = devConfigRows(), catalogDrift = false} = {}) {
  let catalogReads = 0;
  const queries = [];
  const rt = {
    rows(sql) {
      queries.push(sql.slice(0, 80));
      if (sql.includes('derived_b24_part1_pt409')) return S04_PINS.map(pin => ({name: pin.name, nargs: pin.nargs, args: 'x', md5: pin.md5, derived_b24_part1_pt409: 'f'.repeat(32), ...(pinOverrides[pin.name] ?? {})}));
      if (sql.includes('private.marketplace_config')) return configRows;
      if (sql.includes("'function:' ||")) { catalogReads += 1; return [{name: 'function:private.emit_event(x)', md5: catalogDrift && catalogReads > 1 ? 'b'.repeat(32) : 'a'.repeat(32)}, {name: 'trigger:public.needs.t', md5: 'c'.repeat(32)}]; }
      throw new Error('unexpected query: ' + sql.slice(0, 80));
    },
    sql() { throw new Error('unexpected sql'); },
    randomUUID: () => '00000000-0000-4000-8000-000000000001',
  };
  return {rt, queries};
}

function seamsOf(world, {columns = contractRows()} = {}) {
  world.db.schemaColumns = () => columns;
  let counter = 0;
  return {fx: world.fx, db: world.db, api: world.api, now: () => world.now(), sleep: async ms => world.advance(ms), newId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`};
}

async function run({world = new World(), env = {}, rtOptions = {}, columns, mutate = null} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 's04-main-'));
  const seams = seamsOf(world, columns ? {columns} : {});
  if (mutate) mutate(world, seams);
  const {rt, queries} = fakeRt(rtOptions);
  const result = await runProof({rt, env: {EX06_ARTIFACT_DIR: dir, EX06_QUIET: '1', GITHUB_SHA: 'a'.repeat(40), ...env}, seams, say: () => {}});
  return {...result, dir, world, queries, cleanup: () => rmSync(dir, {recursive: true, force: true})};
}

test('parseEnv: defaults, a focused re-run, strict findings, and the settings that stop the run before it touches the chain', () => {
  const plain = parseEnv({});
  assert.deepEqual([plain.only, plain.pinMode, plain.strictFindings, plain.problems, plain.outDir, plain.stagesFile], [null, 'strict', false, [], 'artifacts/ex06', null]);
  assert.deepEqual(parseEnv({EX06_S04_ONLY: ' reach , licence '}).only, ['reach', 'licence']);
  assert.equal(parseEnv({EX06_S04_ONLY: ''}).only, null, 'an empty workflow input is no selection');
  assert.equal(parseEnv({EX06_S04_PINS: 'report'}).pinMode, 'report');
  assert.equal(parseEnv({EX06_S04_STRICT_FINDINGS: '1'}).strictFindings, true);
  assert.equal(parseEnv({PRE_V3_ARTIFACT_DIR: '/x'}).outDir, '/x');
  assert.match(parseEnv({EX06_S04_ONLY: 'reach,nonsense'}).problems[0], /unknown scenario\(s\) nonsense/);
  assert.match(parseEnv({EX06_S04_PINS: 'loose'}).problems[0], /strict or report/);
});

test('readStages keeps the stage lines only', () => {
  assert.equal(readStages(null), null);
  assert.equal(readStages('/none', () => false), null);
  const text = '01-dependencies exit=0\n03-source147 START\n03-source147 exit=0\n20-x SKIPPED (an earlier stage failed)\nnoise\n';
  assert.deepEqual(readStages('/x', () => true, () => text), ['01-dependencies exit=0', '03-source147 exit=0', '20-x SKIPPED (an earlier stage failed)']);
});

test('the notRead chain says nothing was compared', () => {
  assert.match(chainLabel(notReadChain()), /NOT READ .* nothing in this report is evidence about DEV/);
});

test('AS_BUILT: the whole run ends FINDINGS with the eight predicted findings, writes both report files and exits 0; the report carries no environment', async () => {
  const outcome = await run();
  try {
    assert.equal(outcome.report.result, 'FINDINGS');
    assert.equal(outcome.exitCode, 0);
    assert.equal(outcome.saved, true);
    assert.deepEqual(outcome.report.summary.findingIds, ['F10', 'F11', 'F12', 'F5', 'F6', 'F7', 'F8', 'F9']);
    assert.equal(outcome.report.cases.length, CASES.length);
    assert.equal(outcome.report.summary.scenariosOk, SCENARIO_IDS.length);
    assert.equal(outcome.report.chainVerdict, 'EQUAL');
    assert.equal(outcome.report.config.equalsDev, true);
    assert.equal(outcome.report.certificate.unchanged, true);
    assert.equal(outcome.report.catalogUnchanged, true);
    const json = readFileSync(join(outcome.dir, 'ex06-s04-report.json'), 'utf8');
    const parsed = JSON.parse(json);
    assert.equal(parsed.result, 'FINDINGS');
    assert.equal(parsed.devAccess, false);
    assert.equal(parsed.pushSent, 0);
    assert.ok(!/RU5_DEVICE|SERVICE_ROLE|password/i.test(json), 'no environment value reaches the report');
    const markdown = readFileSync(join(outcome.dir, 'ex06-s04-report.md'), 'utf8');
    assert.match(markdown, /^# EX-06 S04 - dispatch lifecycle negative-case proof and probes/);
    assert.match(markdown, /A disposable chain is NOT DEV/);
    assert.equal(outcome.report.isolation.foreign.parkedWorkers, 0);
  } finally { outcome.cleanup(); }
});

test('FIXED: with every proposed fix applied the same run passes; strict findings exit 2 only for the as-built world', async () => {
  const fixed = await run({world: new World({fixes: ALL_FIXES})});
  const strict = await run({env: {EX06_S04_STRICT_FINDINGS: '1'}});
  try {
    assert.equal(fixed.report.result, 'PASS');
    assert.equal(fixed.exitCode, 0);
    assert.equal(strict.report.result, 'FINDINGS');
    assert.equal(strict.exitCode, 2);
  } finally { fixed.cleanup(); strict.cleanup(); }
});

test('a CORE pin that differs makes the result CHAIN_DIFFERS (exit 1) and the run still shows every case, marked as not evidence about DEV', async () => {
  const outcome = await run({rtOptions: {pinOverrides: {'private.emit_event': {md5: 'e'.repeat(32)}}}});
  try {
    assert.equal(outcome.report.result, 'CHAIN_DIFFERS');
    assert.equal(outcome.exitCode, 1);
    assert.equal(outcome.report.summary.scenariosOk, SCENARIO_IDS.length, 'the scenarios ran');
    assert.deepEqual(outcome.report.chain.fatal, ['private.emit_event']);
    assert.match(readFileSync(join(outcome.dir, 'ex06-s04-report.md'), 'utf8'), /NOT evidence about DEV/);
    assert.ok(outcome.report.warnings.some(item => /private\.emit_event/.test(item)));
  } finally { outcome.cleanup(); }
});

test('a SUPPORTING pin that differs is fatal in strict mode and a loud warning in report mode', async () => {
  const overrides = {'public.rpc_cancel_need': {md5: 'd'.repeat(32)}};
  const strict = await run({rtOptions: {pinOverrides: overrides}});
  const report = await run({rtOptions: {pinOverrides: overrides}, env: {EX06_S04_PINS: 'report'}});
  try {
    assert.equal(strict.report.result, 'CHAIN_DIFFERS');
    assert.equal(report.report.chainVerdict, 'DIFFERS_SUPPORTING_ONLY');
    assert.equal(report.report.result, 'FINDINGS');
    assert.ok(annotationsFor(report.report).some(line => line.startsWith('::warning::') && /SUPPORTING pin/.test(line)));
  } finally { strict.cleanup(); report.cleanup(); }
});


test('a column the proof needs that the chain lacks stops the run BEFORE any fixture: a harness error that names it, never a finding', async () => {
  const outcome = await run({columns: contractRows('public.needs.task_timezone')});
  try {
    assert.equal(outcome.report.result, 'HARNESS_BROKEN');
    assert.equal(outcome.exitCode, 1);
    assert.match(outcome.report.harnessErrors[0].message, /SCHEMA_CONTRACT_NOT_MET.*public\.needs\.task_timezone/);
    assert.ok(!outcome.world.calls.includes('createRequester'), 'no fixture was built');
    assert.equal(outcome.report.chainVerdict, 'NOT_READ');
    assert.equal(outcome.report.summary.scenariosOk, 0);
    assert.equal(outcome.report.cases.filter(item => item.verdict === 'NOT_RUN').length, CASES.length);
  } finally { outcome.cleanup(); }
});

test('an invalid setting stops the run before it reads the chain', async () => {
  const outcome = await run({env: {EX06_S04_ONLY: 'reach,typo'}});
  try {
    assert.equal(outcome.report.result, 'HARNESS_BROKEN');
    assert.match(outcome.report.harnessErrors[0].message, /SETTINGS_INVALID.*typo/);
    assert.equal(outcome.queries.length, 0, 'the chain was not read');
    assert.deepEqual(outcome.world.calls, []);
  } finally { outcome.cleanup(); }
});

test('an unusable dispatch configuration and an inconsistent certificate each stop the run with a named harness error', async () => {
  const badConfig = await run({rtOptions: {configRows: []}});
  const badCertificate = await run({mutate: world => { world.fx.closureState = () => ({live: 'a', certified: 'b', erasure: 'a', binding: 'a', ready: true}); }});
  try {
    assert.match(badConfig.report.harnessErrors[0].message, /DISPATCH_CONFIG_UNUSABLE.*dispatch_normal/);
    assert.match(badCertificate.report.harnessErrors[0].message, /CERTIFICATE_NOT_CONSISTENT_AT_THE_START/);
    for (const outcome of [badConfig, badCertificate]) { assert.equal(outcome.report.result, 'HARNESS_BROKEN'); assert.deepEqual(outcome.world.calls, [], 'no fixture was built'); }
  } finally { badConfig.cleanup(); badCertificate.cleanup(); }
});

test('a certificate that moves during the run and a catalog that changes during the run are harness errors', async () => {
  let reads = 0;
  const moved = await run({mutate: world => { world.fx.closureState = () => ({live: reads++ === 0 ? 'a' : 'z', certified: 'a', erasure: 'a', binding: 'a', ready: true}); }});
  const drift = await run({rtOptions: {catalogDrift: true}});
  try {
    assert.equal(moved.report.result, 'HARNESS_BROKEN');
    assert.ok(moved.report.harnessErrors.some(item => item.where === 'certificate'));
    assert.equal(moved.report.certificate.unchanged, false);
    assert.equal(drift.report.result, 'HARNESS_BROKEN');
    assert.ok(drift.report.harnessErrors.some(item => item.where === 'catalog'));
    assert.equal(drift.report.catalogUnchanged, false);
  } finally { moved.cleanup(); drift.cleanup(); }
});

test('the isolation runs before the first scenario (foreign workers and schedule rows parked, every open task cancelled) and the cleanup always runs, with the foreign token restored', async () => {
  const log = [];
  const outcome = await run({mutate: (world, seams) => {
    const parkForeign = world.fx.parkForeign.bind(world.fx);
    world.fx.parkForeign = options => { log.push('parkForeign ' + JSON.stringify(options)); return {...parkForeign(options), parkedWorkers: 3, restore: [{id: 'p1'}]}; };
    world.fx.restoreForeign = token => { log.push('restoreForeign ' + token.restore.length); return token.restore.length; };
    world.fx.parkAll = () => log.push('parkAll');
    world.db.retireAllNeeds = () => log.push('retireAllNeeds');
    const createRequester = world.fx.createRequester.bind(world.fx);
    world.fx.createRequester = async spec => { if (!log.includes('first requester')) log.push('first requester'); return createRequester(spec); };
    void seams;
  }});
  try {
    assert.deepEqual(log.slice(0, 3), ['parkForeign {"schedule":true}', 'retireAllNeeds', 'first requester']);
    assert.deepEqual(log.slice(-2), ['parkAll', 'restoreForeign 1']);
    assert.equal(outcome.report.isolation.foreign.parkedWorkers, 3);
    assert.equal(outcome.report.isolation.foreign.restored, 1);
  } finally { outcome.cleanup(); }
});

test('a scenario that fails is data (HARNESS_BROKEN, its cases NOT_RUN); an aborted call makes the cleanup diagnose and terminate the stuck backends first', async () => {
  const diagnosed = [];
  const outcome = await run({mutate: world => {
    const original = world.fx.createRequester.bind(world.fx);
    world.fx.createRequester = async spec => { if (String(spec.label).includes('waves')) throw new Error('TimeoutError: The operation was aborted due to timeout'); return original(spec); };
    world.fx.diagnoseActiveBackends = options => { diagnosed.push(options); return {backends: [{pid: 1}], terminated: [1]}; };
  }});
  try {
    assert.equal(outcome.report.result, 'HARNESS_BROKEN');
    assert.equal(outcome.report.scenarios.find(item => item.id === 'waves').status, 'HARNESS_ERROR');
    assert.deepEqual(diagnosed, [{terminate: true}]);
    assert.equal(outcome.report.isolation.activeBackends.terminated.length, 1);
    assert.equal(outcome.report.cases.find(item => item.id === 'W01')?.verdict ?? 'NOT_RUN', 'NOT_RUN');
  } finally { outcome.cleanup(); }
});

test('a focused re-run (EX06_S04_ONLY) runs only the named scenarios, marks the others SKIPPED, ends PARTIAL and exits 0; a focused re-run is a warning, never an error annotation', async () => {
  const outcome = await run({env: {EX06_S04_ONLY: 'reach,licence'}});
  try {
    assert.equal(outcome.report.result, 'PARTIAL');
    assert.equal(outcome.exitCode, 0);
    assert.equal(outcome.report.scenarios.filter(item => item.status === 'OK').length, 2);
    assert.equal(outcome.report.scenarios.filter(item => item.status === 'SKIPPED').length, SCENARIO_IDS.length - 2);
    assert.deepEqual(outcome.report.only, ['reach', 'licence']);
    assert.ok(outcome.report.cases.some(item => item.verdict === 'NOT_RUN' && /not selected by EX06_S04_ONLY/.test(item.reason)));
    const annotations = annotationsFor(outcome.report);
    assert.ok(annotations.some(line => line.startsWith('::warning::') && /focused re-run/.test(line)));
    assert.ok(!annotations.some(line => line.startsWith('::error::')));
    assert.deepEqual(outcome.world.calls.filter(name => name === 'runWave').length > 0, true);
  } finally { outcome.cleanup(); }
});

test('the progress report exists while the run is going and the final report replaces it; an artifact directory that cannot be created is a harness error and exit 1', async () => {
  const dir = mkdtempSync(join(tmpdir(), 's04-progress-'));
  const seenWhileRunning = [];
  const outcome = await run({env: {EX06_ARTIFACT_DIR: dir}, mutate: world => {
    const parkAll = world.fx.parkAll.bind(world.fx);
    world.fx.parkAll = () => { seenWhileRunning.push(existsSync(join(dir, 'ex06-s04-report.json')) ? JSON.parse(readFileSync(join(dir, 'ex06-s04-report.json'), 'utf8')).result : 'none'); return parkAll(); };
  }});
  try {
    assert.deepEqual(seenWhileRunning, ['RUNNING']);
    assert.equal(JSON.parse(readFileSync(join(dir, 'ex06-s04-report.json'), 'utf8')).result, 'FINDINGS');
  } finally { outcome.cleanup(); rmSync(dir, {recursive: true, force: true}); }
  const file = join(tmpdir(), 's04-main-file-' + process.pid);
  writeFileSync(file, 'x');
  try {
    const {rt} = fakeRt();
    const blocked = await runProof({rt, env: {EX06_ARTIFACT_DIR: join(file, 'sub'), EX06_QUIET: '1'}, seams: seamsOf(new World()), say: () => {}});
    assert.equal(blocked.exitCode, 1);
    assert.equal(blocked.saved, false);
    assert.equal(blocked.report.result, 'HARNESS_BROKEN');
  } finally { rmSync(file, {force: true}); }
});
