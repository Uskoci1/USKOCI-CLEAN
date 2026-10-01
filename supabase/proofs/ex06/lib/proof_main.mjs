// EX-06 S03: the whole corpus proof as one importable function, so the entry script (ex06_s03_proof.mjs) stays a thin shell around the proof adapter (closure_runtime.mjs) and the
// orchestration can be run offline against a simulated backend (proof_main.test.mjs). Nothing here talks to a database by itself: every read and write goes through the `rt` it is given.
//
// One run:
//   (0) the harness's own negative controls; the schedulers of the chain paused;
//   (1) the pin gate: the 11 S01 function-body pins that stage 18 reaches (equal or not, REPORTED, never fatal), the md5 of the dependency functions, the sha256 of the dispatch config
//       rows and a catalog fingerprint (every function body and trigger of public and private) for information;
//   (2) the certificate: certified, live, erasure source and binding must be equal and ready at the start, and unchanged at the end; the catalog fingerprint unchanged at the end;
//   (3) the CANARY (three product-path cases): any disagreement is a HARNESS_ERROR, never a finding;
//   (4) for each task case of the corpus (the S02 contract corpus through lib/s02_adapter.mjs, else the SMOKE corpus): build the task through the product path and its reference workers
//       through the product's writers (lib/fixtures.mjs), read every fixture back, read the matcher (private.match_detail), run ONE dispatch wave (private.dispatch_next_wave), read the
//       deliveries and OPPORTUNITY_AVAILABLE events, compare with the corpus expectation (lib/runner.mjs);
//   (5) ex06-s03-report.json and a markdown expected-versus-actual table.
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createFixtures} from './fixtures.mjs';
import {DEV_CERTIFICATE_DIGEST_AT_S01, EXTENSION_PINS, EXTRA_PINS, PIN_CONVENTION, PIN_SOURCE, PROOF_POINT_PINS, bodyMd5Map, catalogLines, catalogQuery, configQuery, dependencyBodies,
  dependencyQuery, evaluatePins, evidenceLabel, pinQuery, pinRowsOf} from './pins.mjs';
import {HarnessInputError, failedNegativeControls, renderMarkdown} from './compare.mjs';
import {SMOKE_CORPUS, capFromEnv, chooseCorpusPath, normaliseCorpus, sha256Hex} from './corpus.mjs';
import {loadCorpus} from './s02_adapter.mjs';
import {computeRebase} from './timeutil.mjs';
import {HarnessFailure, checkAssertions, finalizeResult, harnessError, matcherBodiesOf, newReport, runCanary, runCase, say} from './runner.mjs';

const consistent = state => state.ready === true && state.live === state.certified && state.live === state.erasure && state.live === state.binding;

/** The stage lines the workflow wrote (NN-name START / exit=K / SKIPPED), so the report says which stages ran. */
function readStages(env) {
  const path = env.EX06_STAGES_FILE;
  if (!path || !existsSync(path)) return null;
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(line => /\sexit=\d+$|\sSKIPPED/.test(line));
}

/**
 * Runs the proof. deps = {rt (the proof adapter: rows, sql, ok, q, randomUUID, service, actor), env (a plain object), registry (NEED_FACT_V2_DEFINITIONS), sources (the hashed TS sources, or null),
 * fixtureOptions ({flow, abortMs}: tests inject a flow), nowMs, exists (the file-existence check of the corpus search: tests inject one so the default corpus path of the repository does not
 * decide the run)}. Never throws: a failure becomes a harness error of the report. Returns {report, exitCode, saved}.
 */
export async function runProof({rt, env, registry, sources = null, fixtureOptions = {}, nowMs = Date.now(), exists = existsSync}) {
  const {rows} = rt;
  const outDir = env.EX06_ARTIFACT_DIR ?? env.PRE_V3_ARTIFACT_DIR ?? 'artifacts/ex06';
  mkdirSync(outDir, {recursive: true});
  const privateDir = env.PRE_V3_ARTIFACT_DIR ?? outDir;
  const jsonPath = outDir + '/ex06-s03-report.json', markdownPath = outDir + '/ex06-s03-report.md';
  const catalogPath = env.EX06_CATALOG_FILE ?? privateDir + '/ex06-catalog-before-extension.json';
  const strict = env.EX06_STRICT_FINDINGS === '1';
  const report = newReport({sourceSha: env.GITHUB_SHA ?? null, pinConvention: PIN_CONVENTION, pinSource: PIN_SOURCE});
  const save = () => {
    writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
    writeFileSync(markdownPath, renderMarkdown(report));
  };
  const pass = name => { report.checks.push({name, result: 'PASS'}); say('PASS ' + name); };
  let cleanup = () => {};

  async function body() {
    // ---------------------------------------------------------------- the harness itself: offline negative controls and the real fact registry
    const uncaught = failedNegativeControls();
    report.selfTests.negativeControlsFailed = uncaught;
    if (uncaught.length) throw new Error('NEGATIVE_CONTROLS_DID_NOT_FAIL: ' + uncaught.join('; '));
    pass('OFFLINE_NEGATIVE_CONTROLS_REPORT_A_MISMATCH_FOR_EVERY_GATE_CLASS');
    report.sources = sources;
    report.stages = readStages(env);

    const fx = createFixtures(rt, {needPath: env.EX06_NEED_PATH ?? 'product', ...fixtureOptions});
    report.needPath = fx.defaultPath;
    if (fx.defaultPath !== 'product') report.warnings.push(`EX06_NEED_PATH=${fx.defaultPath}: a diagnostic mode; a task the product refuses may be matched on a direct insert, and every such case is DEGRADED`);
    await fx.reloadSchema();
    report.schedulers = fx.pauseSchedulers();
    say('SCHEDULERS ' + JSON.stringify(report.schedulers));
    const foreignTokens = [];
    // Whatever happens next (a canary failure, a harness error, a normal end), the fixtures are retired and the workers that were on the chain before the harness are put back as they were.
    cleanup = () => {
      fx.parkAll();
      for (const token of foreignTokens) report.foreign.restored += fx.restoreForeign(token);
    };

    // ---------------------------------------------------------------- (1) the pin gate at the proof point, (2) the certificate before
    const allRows = rows(pinQuery([...PROOF_POINT_PINS, ...EXTRA_PINS]));
    const gate = evaluatePins(allRows, PROOF_POINT_PINS), extra = evaluatePins(allRows, EXTRA_PINS), bodies = bodyMd5Map(allRows, PROOF_POINT_PINS);
    report.pinGate = gate;
    report.extraPinGate = extra;
    report.pinRows = [...pinRowsOf(gate, PROOF_POINT_PINS),
      ...EXTENSION_PINS.map(pin => ({name: pin.name, role: pin.role, reach: pin.reach, stage: pin.stage, expected: pin.md5, actual: 'NOT READ HERE', verdict: 'READ_AFTER_EXTENSION',
        explanation: 'the post-B24 body is reached only by the extension stages (second section of the run)'})),
      ...pinRowsOf(extra, EXTRA_PINS).map(row => ({...row, role: row.role + ' (informational)'}))];
    report.evidenceLabel = evidenceLabel(gate, PROOF_POINT_PINS.length);
    const dependencies = dependencyBodies(rows(dependencyQuery()));
    const config = rows(configQuery());
    const catalogRows = rows(catalogQuery());
    const catalog = catalogLines(catalogRows);
    writeFileSync(catalogPath, JSON.stringify({taken: new Date(nowMs).toISOString(), rows: catalogRows}) + '\n');
    report.chain = {bodyMd5: bodies, counts: fx.chainCounts(), dependencyBodies: dependencies, configRows: config,
      catalog: {sha256: sha256Hex(catalog.lines.join('\n')), functions: catalog.functions, triggers: catalog.triggers, file: catalogPath},
      note: 'The dependency function md5s, the dispatch config sha256 and the catalog fingerprint are INFORMATIONAL: they are not part of the 12 pins and not part of the evidence label.'};
    say('PIN_GATE ' + report.evidenceLabel + ' equal=' + gate.equal.length + ' different=' + gate.different.length + ' missing=' + gate.missing.length);
    for (const item of gate.different) say('  CHAIN_FIDELITY_FINDING ' + item.name + ' expected ' + item.expected + ' actual ' + item.actual + (item.explanation ? ' (' + item.explanation + ')' : ''));
    const before = fx.closureState();
    report.digest.before = before;
    report.digest.startConsistent = consistent(before);
    report.digest.note = `The chain's digest ${String(before.live).slice(0, 8)} ${before.live === DEV_CERTIFICATE_DIGEST_AT_S01 ? 'equals' : 'differs from'} DEV's ${DEV_CERTIFICATE_DIGEST_AT_S01.slice(0, 8)} at S01 (informational: the chain stops before B24 part 2, voice B1 and pkg045b-p0).`;
    save();
    if (!report.digest.startConsistent) throw new HarnessFailure('CERTIFICATE_NOT_CONSISTENT_AT_THE_START', JSON.stringify(before));
    pass('CERTIFICATE_READY_AND_LIVE_EQUALS_CERTIFIED_EQUALS_ERASURE_EQUALS_BINDING_AT_THE_START');

    // ---------------------------------------------------------------- the corpus
    const corpusPath = chooseCorpusPath(env, exists);
    let corpus;
    if (corpusPath) {
      const text = readFileSync(corpusPath, 'utf8');
      corpus = loadCorpus(JSON.parse(text), {registry, label: 'CORPUS', normaliseNative: normaliseCorpus});
      Object.assign(report.corpus, {label: 'CORPUS', path: corpusPath, sha256: sha256Hex(text)});
    } else {
      corpus = normaliseCorpus(SMOKE_CORPUS, {registry, label: 'SMOKE'});
      Object.assign(report.corpus, {label: 'SMOKE', path: null, sha256: sha256Hex(JSON.stringify(SMOKE_CORPUS))});
      report.warnings.push('No corpus file found: the SMOKE corpus ran. It exercises the harness mechanics only and is not the contract corpus (the result is SMOKE_ONLY, never PASS).');
    }
    const cap = capFromEnv(env.EX06_MAX_CASES);
    const selected = corpus.cases.slice(0, cap ?? Infinity);
    const rebase = corpus.clock?.nowUtc ? computeRebase({ciNowMs: nowMs, corpusNowUtc: corpus.clock.nowUtc}) : null;
    Object.assign(report.corpus, {id: corpus.id, version: corpus.version, totalCases: corpus.totalCases, buildable: corpus.cases.length, cap, capped: cap !== null && cap < corpus.cases.length,
      skipped: corpus.skipped, unconsumed: corpus.unconsumed, leaves: corpus.leaves, rebase, counts: corpus.counts ?? null,
      adapter: corpus.keyCoverage ? {mappedKeyPaths: Object.keys(corpus.keyCoverage.mapped).length, ignoredKeyPaths: Object.keys(corpus.keyCoverage.ignored).length, ignoredReasons: corpus.keyCoverage.ignoredReasons} : null});
    if (report.corpus.capped) report.warnings.push(`EX06_MAX_CASES=${cap}: only ${selected.length} of ${corpus.cases.length} buildable cases ran (the result is PARTIAL)`);
    pass('CORPUS_LOADED_ADAPTED_AND_VALIDATED_AGAINST_THE_REAL_FACT_REGISTRY');
    save();

    const matcherBodies = matcherBodiesOf(bodies);

    // ---------------------------------------------------------------- (3) the canary: a fixture defect is a harness error, never a finding
    const parkedAtStart = fx.parkForeign();
    foreignTokens.push(parkedAtStart);
    report.foreign.parkedWorkers += parkedAtStart.parkedWorkers;
    say('PARKED_FOREIGN_WORKERS ' + parkedAtStart.parkedWorkers);
    report.canary = {status: 'RUNNING', cases: []};
    const canary = await runCanary(fx, {registry, nowMs, matcherBodies, foreignTokens});
    report.canary = canary;
    save();
    if (canary.status !== 'PASS') throw new HarnessFailure('CANARY_FAILED', canary.problems.join(' ; ') || 'a canary case did not pass');
    pass('CANARY_FIT_UNFIT_SCHEDULED_AND_RADIUS_CASES_PASS_ON_THE_PRODUCT_PATH');

    // ---------------------------------------------------------------- (4) the corpus cases
    const ctx = {report, matcherBodies, nowMs, rebase, corpusLabel: report.corpus.label, needPath: fx.defaultPath, controls: true, foreignTokens};
    for (const caseItem of selected) {
      report.cases.push(await runCase(fx, caseItem, ctx));
      report.corpus.ran += 1;
      save();
    }

    // ---------------------------------------------------------------- (2) the certificate after, the catalog after, and what was really asserted
    const after = fx.closureState();
    report.digest.after = after;
    report.digest.unchanged = after.live === before.live && after.certified === before.certified && after.erasure === before.erasure && after.binding === before.binding && after.ready === before.ready;
    if (!report.digest.unchanged) harnessError(report, 'certificate', new Error('the closure certificate (digest, certified value, erasure source, binding or readiness) moved while the harness wrote disposable fixtures'));
    else pass('CERTIFICATE_DIGEST_AND_READINESS_UNCHANGED_BY_THE_FIXTURES');
    const catalogAfter = catalogLines(rows(catalogQuery()));
    if (sha256Hex(catalogAfter.lines.join('\n')) !== report.chain.catalog.sha256) harnessError(report, 'catalog', new Error('a function body or trigger of public/private changed while the harness ran: it must only write data'));
    else pass('CATALOG_FINGERPRINT_UNCHANGED_BY_THE_FIXTURES');
    checkAssertions(report);
  }

  try {
    await body();
  } catch (error) {
    harnessError(report, error instanceof HarnessInputError ? 'input' : error instanceof HarnessFailure ? 'harness failure' : 'harness', error);
    if (process.env.EX06_QUIET !== '1') console.error(String(error?.stack ?? error).slice(0, 3000));
  } finally {
    try {
      cleanup();
    } catch (error) {
      harnessError(report, 'isolation restore', error);
    }
  }
  const exitCode = finalizeResult(report, {strict});
  let saved = true;
  try {
    save();
  } catch (error) {
    saved = false;
    console.error('REPORT_NOT_WRITTEN ' + error.message);
  }
  return {report, exitCode: saved ? exitCode : 1, saved};
}
