// EX-06 S03: corpus-driven matching contract proof on a disposable DEV-equivalent chain, with actual Auth and PostgREST.
//
// It runs IMMEDIATELY after stage 18 of the workflow (the ex04d-proven source147 -> PKG-050 chain), before any extension stage. The whole run is lib/proof_main.mjs (runProof): the
// pin gate (11 of the 12 S01 function-body pins; the 12th is read after the extension by ex06_s03_extension_report.mjs), the certificate before and after, the canary, the corpus cases, the
// report. This file only binds it to the proof adapter (closure_runtime.mjs: loopback targets only), prints the RESULT line and the workflow annotations, and exits.
//
// A disagreement between the matcher and the corpus is a FINDING: listed with the body md5s it ran against, never adjusted, never fixed here. The exit code is non-zero only when the
// HARNESS is broken (the canary failed, a fixture was not applied, a result had an impossible shape, the certificate moved, the report could not be written); a differing pin only
// downgrades the evidence label. EX06_STRICT_FINDINGS=1 makes findings exit 2 (off by default). EX06_MAX_CASES caps the cases (a positive integer; a capped run is PARTIAL).
// EX06_NEED_PATH = product | direct | auto (the workflow sets product; direct and auto are diagnostic and make every case DEGRADED). EX06_REQUIRE_CORPUS=1: no corpus file is an error
// instead of the SMOKE fall back. The result is PASS | FINDINGS | SMOKE_ONLY | PARTIAL | HARNESS_BROKEN; a green job is not evidence by itself: read the RESULT line.
// No DEV, provider, device or paid call: closure_runtime.mjs refuses any target that is not the loopback proof stack.
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadModules} from '../ex04/ts_loader.mjs';
import {annotationsFor, resultLine} from './lib/compare.mjs';
import {runProof} from './lib/proof_main.mjs';

const {assert, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

let registry = null, sources = null, loadError = null;
try {
  const mods = loadModules({client: null, accountId: null});
  registry = mods.load('contracts/needFactsV2').NEED_FACT_V2_DEFINITIONS;
  sources = mods.sources;
} catch (error) {
  loadError = error;
}
const {report, exitCode} = loadError ? {report: null, exitCode: 1} : await runProof({rt, env, registry, sources});
if (loadError) {
  console.error('HARNESS_ERROR the real need-fact registry could not be loaded: ' + String(loadError?.stack ?? loadError).slice(0, 2000));
  console.log('RESULT HARNESS_BROKEN | the registry of src/contracts/needFactsV2.ts could not be loaded');
} else {
  for (const line of annotationsFor(report)) console.log(line);
  console.log(resultLine(report));
}
process.exit(exitCode);
