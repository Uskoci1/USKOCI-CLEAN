// EX-06 S04: the whole proof as one importable function, so the entry script (../ex06_s04_proof.mjs) stays a thin shell around the proof adapter (closure_runtime.mjs: loopback targets only) and the
// orchestration can be run offline against the simulated world (main.test.mjs). Nothing here talks to a database by itself: every read and write goes through the `rt` (or the injected seams).
//
// One run:
//   (0) the settings (EX06_S04_ONLY, EX06_S04_PINS, EX06_S04_STRICT_FINDINGS ...) are validated; the schedulers of the chain are paused;
//   (1) the SCHEMA preflight: every table and column the proof reads or writes directly must exist on the chain (a missing column is a harness error, never a product finding);
//   (2) the PIN gate: the 60 function bodies of the dispatch lifecycle, compared with the DEV md5 pins read read-only on DEV (lib/pins.mjs); an unexplained difference of a CORE pin (and, in the
//       default strict mode, of a SUPPORTING pin) makes the result CHAIN_DIFFERS: the run still goes on so that the evidence is visible, and says it is NOT evidence about DEV;
//   (3) the dispatch configuration of the chain (private.marketplace_config dispatch_normal: wave sizes, window, target), the certificate and a catalog fingerprint BEFORE;
//   (4) the isolation (every foreign worker and every foreign open task of the chain is parked: they would crowd a wave and a tick);
//   (5) the 17 scenarios (lib/scenarios.mjs) in order, each isolated and cleaned up (lib/runner.mjs); a failing scenario is data;
//   (6) the certificate and the catalog fingerprint AFTER (the proof writes data only), the verdict of every case and probe (lib/judge.mjs), ex06-s04-report.json and ex06-s04-report.md.
// Never throws: a failure becomes a harness error of the report. Returns {report, exitCode, saved}.
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {ABORT_PATTERN, createFixtures} from '../../lib/fixtures.mjs';
import {catalogLines, catalogQuery, configQuery} from '../../lib/pins.mjs';
import {createApi} from './api.mjs';
import {CASES, SCENARIO_IDS} from './cases.mjs';
import {readConfig} from './config.mjs';
import {createDb} from './db.mjs';
import {exitCodeOf, resultOf, summarize} from './judge.mjs';
import {chainLabel, chainVerdict, evaluateS04Pins, notReadChain, s04PinQuery} from './pins.mjs';
import {assembleReport, judgeCatalogue, renderMarkdown} from './report.mjs';
import {runScenarios} from './runner.mjs';
import {SCENARIOS} from './scenarios.mjs';
import {SCHEMA_CONTRACT, missingColumns} from './sql.mjs';

/** A reason to stop the run before the scenarios (a setting, the schema, the configuration, the certificate): it becomes a harness error. */
class StopRun extends Error {
  constructor(code, detail) {
    super(code + (detail ? ': ' + detail : ''));
    this.code = code;
  }
}

const sha256 = text => createHash('sha256').update(text).digest('hex');
const consistent = state => state.ready === true && state.live === state.certified && state.live === state.erasure && state.live === state.binding;
const sameState = (a, b) => a.live === b.live && a.certified === b.certified && a.erasure === b.erasure && a.binding === b.binding && a.ready === b.ready;

/** The settings of a run from its environment (a plain object). problems is non-empty when a setting is invalid: the run stops before it touches the chain. */
export function parseEnv(env) {
  const problems = [];
  let only = null;
  const rawOnly = String(env.EX06_S04_ONLY ?? '').trim();
  if (rawOnly !== '') {
    only = rawOnly.split(',').map(item => item.trim()).filter(Boolean);
    const unknown = only.filter(id => !SCENARIO_IDS.includes(id));
    if (unknown.length) problems.push(`EX06_S04_ONLY names unknown scenario(s) ${unknown.join(', ')}; the scenarios are ${SCENARIO_IDS.join(', ')}`);
    if (only.length === 0) only = null;
  }
  const pinMode = String(env.EX06_S04_PINS ?? '').trim() || 'strict';
  if (!['strict', 'report'].includes(pinMode)) problems.push(`EX06_S04_PINS must be strict or report, got ${JSON.stringify(pinMode)}`);
  return {only, pinMode, strictFindings: env.EX06_S04_STRICT_FINDINGS === '1', outDir: env.EX06_ARTIFACT_DIR ?? env.PRE_V3_ARTIFACT_DIR ?? 'artifacts/ex06', stagesFile: env.EX06_STAGES_FILE ?? null,
    quiet: env.EX06_QUIET === '1', problems};
}

/** The stage lines the workflow wrote (NN-name START / exit=K / SKIPPED), so the report says which stages ran. */
export function readStages(path, exists = existsSync, read = readFileSync) {
  if (!path || !exists(path)) return null;
  return String(read(path, 'utf8')).split(/\r?\n/).filter(line => /\sexit=\d+$|\sSKIPPED/.test(line));
}

/**
 * Runs the proof. deps = {rt (the proof adapter: rows, sql, ok, randomUUID, service), env (a plain object), seams (tests inject {fx, db, api, now, sleep, newId}; the real run builds them from rt),
 * say (console.log), fixtureOptions}. Returns {report, exitCode, saved}.
 */
export async function runProof({rt, env, seams = null, say = console.log, fixtureOptions = {}}) {
  const settings = parseEnv(env);
  const state = {harnessErrors: [], warnings: [], results: [], chain: notReadChain(settings.pinMode), config: null, certificate: null, catalogUnchanged: null, preflight: {missing: [], tables: Object.keys(SCHEMA_CONTRACT).length},
    stages: null, chainCounts: null, schedulers: null, foreign: {parkedWorkers: 0, scheduleRowsRemoved: 0, restored: 0}, activeBackends: null, stopReason: null};
  const harnessError = (where, error) => state.harnessErrors.push({where, message: String(error?.message ?? error).slice(0, 600)});
  let fx = null, outReady = true, saved = true;
  const jsonPath = settings.outDir + '/ex06-s04-report.json', markdownPath = settings.outDir + '/ex06-s04-report.md';
  try {
    mkdirSync(settings.outDir, {recursive: true});
  } catch (error) {
    outReady = false;
    harnessError('artifact directory', error);
  }
  const foreignTokens = [];
  let cleanup = () => {};

  /** A partial report while the run is still going: if the job is killed, the file says how far it got. */
  const saveProgress = () => {
    try {
      writeFileSync(jsonPath, JSON.stringify({package: 'EX-06 S04', result: 'RUNNING', sourceSha: env.GITHUB_SHA ?? null, chainVerdict: state.chain.verdict, chainLabel: chainLabel(state.chain), config: state.config,
        scenarios: state.results.map(item => ({id: item.id, status: item.status, error: item.error, durationMs: item.durationMs})), harnessErrors: state.harnessErrors, warnings: state.warnings}, null, 2) + '\n');
    } catch (error) {
      state.warnings.push('the progress report could not be written: ' + String(error?.message ?? error).slice(0, 200));
    }
  };

  async function body() {
    if (!outReady) throw new StopRun('ARTIFACT_DIRECTORY_NOT_WRITABLE', settings.outDir);
    if (settings.problems.length) throw new StopRun('SETTINGS_INVALID', settings.problems.join(' ; '));
    fx = seams?.fx ?? createFixtures(rt, {needPath: 'product', ...fixtureOptions});
    const db = seams?.db ?? createDb(rt), api = seams?.api ?? createApi(rt);
    state.stages = readStages(settings.stagesFile);

    // ---------------------------------------------------------------- (0) the chain's schedulers, (1) the schema contract
    await fx.reloadSchema();
    state.schedulers = fx.pauseSchedulers();
    say('SCHEDULERS ' + JSON.stringify(state.schedulers));
    const missing = missingColumns(db.schemaColumns());
    state.preflight.missing = missing;
    if (missing.length) throw new StopRun('SCHEMA_CONTRACT_NOT_MET', `${missing.length} column(s) the proof reads or writes do not exist on the chain: ${missing.slice(0, 12).map(item => item.table + '.' + item.column).join(', ')}`);
    say('SCHEMA_CONTRACT ' + state.preflight.tables + ' tables, every column present');

    // ---------------------------------------------------------------- (2) the pin gate
    const pinRows = evaluateS04Pins(rt.rows(s04PinQuery()));
    state.chain = chainVerdict(pinRows, {mode: settings.pinMode});
    say('PIN_GATE ' + chainLabel(state.chain));
    for (const row of pinRows.filter(item => item.verdict !== 'EQUAL')) say(`  PIN ${row.verdict} ${row.tier} ${row.name} expected ${row.expected} actual ${row.actual}${row.explanation ? ' (' + row.explanation + ')' : ''}`);
    if (state.chain.verdict === 'DIFFERS') state.warnings.push('the chain differs from the DEV pins without a named explanation (' + state.chain.fatal.join(', ') + '): the run goes on so that the evidence is visible, and it is NOT evidence about DEV');

    // ---------------------------------------------------------------- (3) the configuration, the certificate and the catalog before
    const config = readConfig(rt.rows(configQuery()));
    if (!config.ok) throw new StopRun('DISPATCH_CONFIG_UNUSABLE', config.problems.join(' ; '));
    state.config = {waveSizes: config.waveSizes, windowMinutes: config.windowMinutes, targetResponses: config.targetResponses, equalsDev: config.equalsDev, rows: config.rows};
    if (!config.equalsDev) state.warnings.push('the dispatch_normal row of the chain does not equal the DEV row: the scenarios use the chain values, so what a wave case says about DEV is weaker');
    say(`DISPATCH_CONFIG waves ${JSON.stringify(config.waveSizes)} window ${config.windowMinutes} min target ${config.targetResponses}; equals DEV ${config.equalsDev}`);
    const before = fx.closureState();
    state.certificate = {before, after: null, startConsistent: consistent(before), unchanged: null};
    if (!consistent(before)) throw new StopRun('CERTIFICATE_NOT_CONSISTENT_AT_THE_START', JSON.stringify(before));
    const catalogBefore = sha256(catalogLines(rt.rows(catalogQuery())).lines.join('\n'));
    state.chainCounts = fx.chainCounts();
    say('CHAIN_COUNTS ' + JSON.stringify(state.chainCounts));

    // ---------------------------------------------------------------- (4) the isolation. Whatever happens next, the cleanup below retires the fixtures and puts the foreign workers back.
    cleanup = () => {
      if (state.results.some(item => item.abort) || state.harnessErrors.some(item => ABORT_PATTERN.test(String(item.message)))) {
        try {
          state.activeBackends = fx.diagnoseActiveBackends({terminate: true});
          say(`ACTIVE_BACKENDS after an aborted call: ${state.activeBackends.backends.length}, terminated ${state.activeBackends.terminated.length}`);
        } catch (error) {
          state.warnings.push('the active backends could not be read after an aborted call: ' + String(error?.message ?? error).slice(0, 300));
        }
      }
      fx.parkAll();
      for (const token of foreignTokens) state.foreign.restored += fx.restoreForeign(token);
    };
    const parked = fx.parkForeign({schedule: true});
    foreignTokens.push(parked);
    state.foreign.parkedWorkers = parked.parkedWorkers;
    state.foreign.scheduleRowsRemoved = parked.scheduleRowsRemoved;
    db.retireAllNeeds();
    say(`ISOLATION parked ${parked.parkedWorkers} foreign worker(s), removed ${parked.scheduleRowsRemoved} foreign schedule row(s), every open task of the chain cancelled`);
    saveProgress();

    // ---------------------------------------------------------------- (5) the scenarios
    const ctx = {fx, db, api, newId: seams?.newId ?? rt.randomUUID, now: seams?.now ?? (() => Date.now()), sleep: seams?.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))), say,
      config: {waveSizes: config.waveSizes, windowMinutes: config.windowMinutes, targetResponses: config.targetResponses}};
    await runScenarios(ctx, SCENARIOS, {say, only: settings.only, onResult: entry => { state.results.push(entry); saveProgress(); }});

    // ---------------------------------------------------------------- (6) the certificate and the catalog after
    const after = fx.closureState();
    state.certificate.after = after;
    state.certificate.unchanged = sameState(before, after);
    if (!state.certificate.unchanged) harnessError('certificate', new Error('the closure certificate (digest, certified value, erasure source, binding or readiness) moved while the harness wrote disposable fixtures'));
    else say('PASS CERTIFICATE_DIGEST_AND_READINESS_UNCHANGED_BY_THE_FIXTURES');
    state.catalogUnchanged = sha256(catalogLines(rt.rows(catalogQuery())).lines.join('\n')) === catalogBefore;
    if (!state.catalogUnchanged) harnessError('catalog', new Error('a function body or trigger of public/private changed while the harness ran: it must only write data'));
    else say('PASS CATALOG_FINGERPRINT_UNCHANGED_BY_THE_FIXTURES');
  }

  try {
    await body();
  } catch (error) {
    state.stopReason = String(error?.message ?? error).slice(0, 300);
    harnessError(error instanceof StopRun ? 'stop: ' + error.code : 'harness', error);
    if (!settings.quiet) console.error(String(error?.stack ?? error).slice(0, 3000));
  } finally {
    try {
      cleanup();
    } catch (error) {
      harnessError('isolation restore', error);
    }
  }

  // ------------------------------------------------------------------ the verdicts and the report
  const scenarioList = [], scenarios = {};
  for (const scenario of SCENARIOS) {
    const ran = state.results.find(item => item.id === scenario.id);
    if (ran) {
      scenarios[scenario.id] = {status: ran.status, obs: ran.obs, error: ran.error};
      scenarioList.push({id: ran.id, title: ran.title, optional: ran.optional, status: ran.status, error: ran.error, durationMs: ran.durationMs, cleanupError: ran.cleanupError, evidence: ran.evidence});
    } else if (settings.only && !settings.only.includes(scenario.id)) {
      const error = 'not selected by EX06_S04_ONLY (' + settings.only.join(',') + ')';
      scenarios[scenario.id] = {status: 'SKIPPED', obs: null, error};
      scenarioList.push({id: scenario.id, title: scenario.title, optional: true, status: 'SKIPPED', error, durationMs: null, cleanupError: null, evidence: []});
    } else {
      const error = state.stopReason ? 'the run stopped before this scenario: ' + state.stopReason : 'the run ended before this scenario';
      scenarios[scenario.id] = {status: 'NOT_RUN', obs: null, error};
      scenarioList.push({id: scenario.id, title: scenario.title, optional: scenario.optional === true, status: 'NOT_RUN', error, durationMs: null, cleanupError: null, evidence: []});
    }
  }
  const judged = judgeCatalogue(CASES, scenarios);
  const summary = summarize(judged, {harnessErrors: state.harnessErrors, scenarios: scenarioList.map(item => ({id: item.id, status: item.status, optional: item.optional})), chain: state.chain});
  const result = resultOf(summary);
  const report = assembleReport({sourceSha: env.GITHUB_SHA ?? null, judged, summary, result, chain: state.chain, scenarioResults: scenarioList, pinMode: settings.pinMode, config: state.config,
    certificate: state.certificate, catalogUnchanged: state.catalogUnchanged, preflight: state.preflight, auth: fx?.authStats?.() ?? null, harnessErrors: state.harnessErrors, warnings: state.warnings,
    stages: state.stages, chainCounts: state.chainCounts, only: settings.only});
  report.isolation = {schedulers: state.schedulers, foreign: state.foreign, activeBackends: state.activeBackends};
  report.settings = {only: settings.only, pins: settings.pinMode, strictFindings: settings.strictFindings, outDir: settings.outDir};
  for (const item of report.cases) say(`${item.kind === 'PROBE' ? 'PROBE' : 'CASE'} ${item.id} ${item.verdict}${item.requirement ? ' requirement ' + item.requirement : ''}${item.findingId ? ' ' + item.findingId : ''}`);
  try {
    if (!outReady) throw new Error('the artifact directory could not be created');
    writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
    writeFileSync(markdownPath, renderMarkdown(report));
  } catch (error) {
    saved = false;
    console.error('REPORT_NOT_WRITTEN ' + String(error?.message ?? error).slice(0, 300));
  }
  return {report, exitCode: saved ? exitCodeOf(result, {strictFindings: settings.strictFindings}) : 1, saved};
}
