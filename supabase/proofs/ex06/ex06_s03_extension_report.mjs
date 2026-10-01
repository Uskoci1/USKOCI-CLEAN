// EX-06 S03, SECOND SECTION: what the non-blocking, unproven extension stages did to the chain, read AFTER them (lib/extension_report.mjs).
//
// The corpus proof (ex06_s03_proof.mjs) runs right after stage 18 on exactly the ex04d-proven chain. The extension stages (A1, B3a, B3b, P0, the P4 resolver, P5, B3c, the P4 push
// transport, pkg051a and B24 part 1 in relaxed pre-image mode) run afterwards to reach the post-B24 body of public.rpc_begin_push_send (pin fc76b344), the 12th S01 pin. This reads that
// pin, compares the catalog fingerprint the proof took BEFORE the extension with the one now and prints the objects the extension changed. It asserts nothing about matching and never
// fails the job for a differing pin; it exits non-zero only when it cannot read the chain. No DEV, provider or device access (closure_runtime.mjs refuses any non-loopback target).
import * as rt from '../pre_v3/closure_runtime.mjs';
import {extensionResultLine, runExtensionReport} from './lib/extension_report.mjs';

const {assert, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const {report, exitCode} = runExtensionReport({rt, env});
if (report.result !== 'READ') console.error(report.warnings.at(-1));
console.log(extensionResultLine(report));
process.exit(exitCode);
