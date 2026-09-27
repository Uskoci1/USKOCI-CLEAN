# Round 09 — B3 disposable proof receipt

Status: **DISPOSABLE PROOF PASS / NOT DEV APPLIED / NOT APP-WIRED**.

[CI run 36312570701](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36312570701) succeeded on source `be72a1bd5311e7974bba5572529852156039eac7`, tree `54baad703d1ec4bdc785e51d202762ec13bd9313`. The original download was `outputs/chat-b3-run-36312570701`; temporary files were later retained under ignored `artifacts/round09-local/`, and the selected durable evidence is linked below. Machine-readable details and hashes are in [ROUND_09_B3_PROOF_RECEIPT.json](ROUND_09_B3_PROOF_RECEIPT.json).

## Executed scope

The run used actual disposable Auth and PostgreSQL behind loopback-only guards: historical **source147**, recorded DEV predecessor replay through **PKG-050**, local **Notification A1 preparation**, then B3a and B3b. **PKG-051 was excluded. This is not full current DEV parity.**

| Unit | Result | Recorded checks |
| --- | --- | --- |
| A1 preparation | PASS | 2/2 |
| B3a private history and exact displayed-ID read | PASS | 11/11 |
| B3b exact message window | PASS | 7/7 |

B3a covers bounded history/cursors and microsecond ties; account/member/anonymous refusals; exact event ACK without partial batches, recipient leakage or event sweeps; idempotent replay; suppressed/missing/mismatched delivery links; text/photo metadata; restricted accounts; terminal history and retired sessions. B3b covers exact old-target windows, edges and zero-sided bounds, inclusive re-anchoring, authority refusals, metadata/link validation and unchanged read/delivery state.

All three reports have `actualAuth: true`, `actualDatabase: true`, zero provider/Storage calls and `deviceProven: false`. Their complete `closureBefore` and `closureAfter` objects are equal and readiness remains true; the shared digest is `9432adc2906abde3b991bb79d92f1f924c46d203af054970deeec76a388269b8`.

## Exact-source integrity

All **13 distinct source files** named by the reports match the tested Git blobs and CI SHA-256 manifest. Verification disabled archive line-ending conversion, reconstructed each Git blob object ID from its exact bytes, compared that ID with `git rev-parse` at the tested commit, then compared SHA-256. No newline normalization was used. Raw local bytes of both B3 candidates and the A1 candidate also match their reports.

| Candidate | SHA-256 |
| --- | --- |
| `supabase/candidates/chat_b3a_private_history_read.sql` | `7298317c474e0a1c670c82f8855811b783528427c5a9d9bab796534e67bd0bbc` |
| `supabase/candidates/chat_b3b_message_window.sql` | `d57619fbf972120763861d2bf61fd02122e2b4d5b84fc3be3165404569243f0d` |

Selected raw files were copied byte-for-byte into `b3-ci-36312570701/`; each copy's size and SHA-256 are recorded in the JSON receipt:

- [chat-b3a-report.json](b3-ci-36312570701/chat-b3a-report.json)
- [chat-b3b-report.json](b3-ci-36312570701/chat-b3b-report.json)
- [chat-b3-a1-preparation.json](b3-ci-36312570701/chat-b3-a1-preparation.json)
- [source-binding.txt](b3-ci-36312570701/source-binding.txt)
- [source-sha256.txt](b3-ci-36312570701/source-sha256.txt)

## Earlier failures remain part of the evidence

| Run / source | Actual failure | Correction |
| --- | --- | --- |
| `36310433116` / `96259893` | B3a synthetic NULL participant update hit `CLOSURE_CONTEXT_INVALID`; B3b not reached. | [First raw log](ROUND_07_B3_CI_FIRST.log). Trigger-bypass attempt followed. |
| `36310983457` / `2749c95e` | Replica-trigger fixture still violated canonical requester NOT NULL; B3b not reached. | [Second log](ROUND_07_B3_CI_SECOND.log), [canonical negative-proof correction](ROUND_07_B3_FIXTURE.md). |
| `36312008697` / `7b9f787e` | B3a passed; B3b expected-row oracle sorted its JSONB timestamp alias instead of the typed timestamp. | [Third log](ROUND_07_B3_CI_THIRD.log), [qualified ordering correction](ROUND_07_B3_WINDOW_ORDERING.md). |

The successful proof asserts both participant columns are NOT NULL and ordinary requester/worker/both-NULL writes are refused. **The NULL-participant helper branch was not runtime-tested, and no live exploit is claimed.** No constraints were relaxed or impossible NULL Agreement manufactured.

## DEV boundary and next gate

[Fresh read-only DEV evidence](ROUND_09_DEV_B3_READ_ONLY.json), checked `2026-09-27T10:38:34.583233+00:00`, separately confirms all three B3 RPCs are absent, both participant columns are NOT NULL, and four helper bodies match candidate pins. That narrow read is **not** a full ledger, closure-certificate or Edge attestation.

This receipt does not establish DEV application, Edge deployment, application wiring, voice, realtime incoming messages, exact device push, native behavior or provider/media delivery. Metadata fixtures are not Storage-object delivery proof. No new SQL, proof, tests, types or build ran while preparing this receipt; only artifact/source integrity and document parsing were checked. The enclosing documentation commit records integration; client location source was separately pushed as `a95f9363`.

**DEV application still requires the owner's explicit “primeni”.** After that instruction, re-read current DEV prerequisites immediately before applying: current ledger/scope, exact predecessor/body pins, required indexes/ACL, closure certificate/readiness/binding, and expected RPC absence. This CI success does not authorize an apply or substitute for that fresh check.
