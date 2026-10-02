// EX-06 S04: dispatch-lifecycle NEGATIVE-case proof and probes on a disposable DEV-equivalent chain, with actual Auth and PostgREST.
//
// It runs after stage 18 of the workflow (the ex04d-proven source147 -> PKG-050 chain) and after the ex06a candidate was applied to the chain (so the two ex06a bodies equal DEV, as DEV applied it).
// The whole run is s04/lib/main.mjs (runProof): the schema preflight, the pin gate (60 function bodies against the DEV md5 pins), the dispatch config, the certificate and the catalog fingerprint
// before and after, 17 scenarios, the verdict of every case and probe, the report. This file only binds it to the proof adapter (closure_runtime.mjs: loopback targets only), prints the workflow
// annotations and the RESULT line, and exits.
//
// A disagreement between the product (its function bodies as pinned from DEV) and the canonical requirement is a FINDING (F5 ...): listed with its failing rows and a proposed fix as TEXT, never
// adjusted, never fixed here. NOTHING in S04 changes a function body. The exit code is non-zero only when the HARNESS is broken (a scenario failed, a control was not reached, a precondition
// was not built, the certificate or the catalog moved, the report could not be written) or when the chain's function bodies differ from the DEV pins without a named explanation (CHAIN_DIFFERS).
// Settings (all optional): EX06_S04_ONLY=reach,licence (a focused re-run: the others are SKIPPED and the result is PARTIAL), EX06_S04_PINS=strict|report (report: a SUPPORTING pin difference is
// a loud warning instead of a failure), EX06_S04_STRICT_FINDINGS=1 (findings exit 2), EX06_ARTIFACT_DIR, EX06_STAGES_FILE, EX06_QUIET=1.
// Nothing is sent: no push sender and no device exist on the chain; the claim RPC only suppresses or queues rows in the database. No DEV, provider or device access: closure_runtime.mjs refuses
// any target that is not the loopback proof stack. NOTHING in this file has run yet: the first CI run is the first evidence. A disposable chain is NOT DEV.
import * as rt from '../pre_v3/closure_runtime.mjs';
import {resultLine} from './s04/lib/judge.mjs';
import {runProof} from './s04/lib/main.mjs';
import {annotationsFor} from './s04/lib/report.mjs';

const {assert, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const {report, exitCode} = await runProof({rt, env});
for (const line of annotationsFor(report)) console.log(line);
console.log(resultLine(report));
process.exit(exitCode);
