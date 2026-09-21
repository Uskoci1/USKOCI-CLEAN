# AI deadline and recovery investigation — 2026-09-22

Scope: read-only continuation for deep-read 11.1 / 11.2. **Not a fix or deployment receipt.**
Client/Edge source baseline: `0c01ac7b`. No provider call, account impersonation, secret read, database
write, device action or deployment. No current incidence counts were measured. Historical counts in the
September21 ledger are not new measurements.

## What is established from bodies

### Publication review: the active client path matters

`src/data/aiTaskReviewClientService.ts::resumeFor` first reads the durable review command. Only ACCEPTED
invokes `uskoci-publication-evaluate`. That invocation is wrapped in `readOwnedResult` (15-second caller
timeout, including session lookup); this wrapper does not cancel server execution. It then reads the
durable command again, even after a lost response. EVALUATING / UNKNOWN_OUTCOME do not cause another
provider dispatch. Only an authoritative EVALUATED/ALLOW receipt reaches publication.

The separate `publicationClientService` timeout is not evidence for this screen's review path.
`src/data/serverReceipt.ts` must not be globally lengthened to solve a single AI operation.

`uskoci-publication-evaluate/index.ts` uses one 12-second AbortController for the whole request: request
parsing, auth, publication context, review claim, up to six validated images, budget admission, provider
request and durable completion. Its `reviewComplete` uses the same `fetchBound` and aborted signal.
The outer timeout/error handler returns a safe not-ready response, but does not settle the claimed review.
A failure while downloading an image after claim can also leave the claim outstanding; the issue is not
limited to a slow model response.

Four full live bodies were read on canonical DEV through `pg_get_functiondef`:

| Function | Live body MD5 | Observed contract |
| --- | --- | --- |
| `public.rpc_claim_ai_task_review_evaluation_service(uuid,uuid,uuid,integer,jsonb)` | `634ec06c2950f44346e7bcc451ee8d14` | Acquires only ACCEPTED, writes EVALUATING with a 60-second lease and a new attempt. All other states return the existing command. |
| `public.rpc_complete_ai_task_review_evaluation_service(uuid,uuid,uuid,text,text[],text[],text,text,text)` | `2f8d7b6c717d557101c374a283eaac20` | Completion is fenced to the same attempt, EVALUATING state and unexpired lease. EVALUATED/PUBLISHED replay must have the same result hash. Can persist a bounded NOT_READY outcome without publishing. |
| `public.rpc_read_ai_task_review(uuid)` | `81d88772f51042d81952c0d94cbaa850` | Owned read returns the review envelope and command document; it does not restart evaluation. |
| `private.ai_task_review_command_document(uuid)` | `5d3319b32dc4ff8ffa12bd22522da674` | Projects expired EVALUATING as UNKNOWN_OUTCOME. This is a read projection, not a stored failure or retry permission. |

The budget helper separately bounds admission to five seconds, forwards parent abort, and rejects replay.
No timeout is evidence that a dispatched provider request incurred no charge. Never refund or repeat an
uncertain paid attempt solely because the caller did not receive a result.

Reproduction run (local, no network):
`node --test --test-name-pattern='V5 provider timeout' supabase/proofs/policy/publication_evaluator_edge.test.mjs`
passed its one selected test, exit 0. That **existing test asserts the current unresolved claim** and rejection
of a late provider response; passing it reproduces the limitation, not its remediation. The fixture executes
the actual handler in a VM with controlled timers and synthetic transport. Reuse this harness for the fix;
preserve its no-late-authority and no-repeat assertions while adding bounded metadata settlement.

### Intake / worker conversation coupling

Intake uses `REQUEST_TIMEOUT_MS = 15_000`; worker streaming likewise has a 15-second client deadline.
The shared provider stream still has a 12-second timer. Intake's `retireAttempt` intentionally skips
retirement once dispatch is uncertain. PKG-027b later sweeps expired intake/worker/QA attempts, but its
candidate does not include publication review commands. It is not proof that publication recovery is solved.

This investigation has not yet compared every deployed Edge bundle or read every live fail/dispatch
function. Do not infer deployed byte equality or widen this finding to all AI operations.

## Next implementation and proof boundaries

1. Read the remaining live dispatch/fail/lease bodies and the certificate's function membership before
   choosing the smallest package. Do not introduce a new attempt merely to escape UNKNOWN_OUTCOME.
2. Separate preparation/provider time budgets from a bounded metadata-settlement budget. A cancelled
   request cannot supply the cleanup signal. Preserve account, revision, policy and attempt fencing.
3. Prove the race between a late successful completion and failure settlement: whichever becomes
   authoritative must not be overwritten by the other. Never treat unpersisted provider output as ALLOW.
4. Prove pre-dispatch abort, post-dispatch timeout, 429, invalid output, lost claim acknowledgement,
   lost completion acknowledgement and image-fetch failure. Use mocked transport/fake timers and a
   disposable database; no real provider calls and no fake DEV records.
5. Test the actual accepted-review client path, including its 15-second caller timeout and subsequent
   readback. Longer Edge execution alone is insufficient, especially for the streaming interview paths.
6. If SQL is needed, use a candidate, before/after proof, exact body pins and ledger receipt. Certificate
   movement requires explicit approval. For Edge, verify deployed bytes and preserve JWT configuration.

No particular replacement timeout or new state is approved or implemented by this document.

## Follow-up while PKG-037 is proving (source `2d6f0bc5`)

Publication finding 11.2 is now implemented in the separate PKG-037 candidate/Edge/client package; its
application state is recorded in that package, not inferred here. This follow-up is read-only for 11.1.

Deployed bundles were fetched and compared against git, not only their entrypoints:

| Bundle | Version / JWT | Comparison |
| --- | --- | --- |
| Intake | 44 / true | Entry, facts contract and budget helper byte-equal. Stream helper differs only in CRLF versus LF; normalized content equal. |
| Worker interview | 15 / true | Entry byte-equal. Stream helper has only the same line-ending difference. Budget helper lacks the two later speech-settlement exports; the existing reservation logic is unchanged. |
| Q&A | 12 / true | Entry and both client contract/hash dependencies byte-equal. Budget helper lacks the same unused speech exports. |

The deployed stream helper hash is `f29a990a27ab7ce301ed836a00231370b0db1685ef40ba085cca3953751870aa`;
git LF hash is `f7fec0b75b1cad8f2f034b0da6f8a66f64184b40bcb2c496a4eec47e06b6df5c`.
Do not call normalized equivalence byte equality. None of these functions was deployed in this follow-up.

Correction to the historical ledger's opening generalization: **not every current AI endpoint has a
12-second total deadline**. The deployed Q&A entry has a 45-second controller covering the request; its
`fetchJson` races against that signal and adds no 12-second provider timer. Intake and worker streaming
do share the 12-second provider helper, and both client streaming paths still stop at 15 seconds.
Q&A still returns unconfirmed after invalid/non-STOP output without settling the claimed command.

Read live complete failure/status/dispatch bodies:

| Function | `md5(prosrc)` | Relevant behavior |
| --- | --- | --- |
| `rpc_ai_fail_need_turn_v2_service` | `17baf5705063e2c65059a9cf43310be8` | Fails only PROCESSING, same attempt, not dispatched, not cancelled. Calling it after dispatch cannot terminate that attempt. |
| `private.ai_need_turn_status` | `c764f3db154221e66dc43afb336b927f` | FAILED is retryable only if not dispatched and not cancelled; all PROCESSING siblings block successors. |
| `rpc_fail_worker_ai_turn_service` | `7012758702e5d5d77f96bf2ccf6bf9ca` | Can fail same-attempt PROCESSING before lease expiry, including dispatched; returns the existing turn document. |
| `private.worker_ai_turn_document` | `82daa0a4586b20b8bd4e4c2e781e1bcd` | Projects an expired PROCESSING lease as UNKNOWN_OUTCOME; retryAllowed is always false. |
| `rpc_dispatch_worker_ai_turn_service` | `05c6f257e25baec1ea39abbc4246b36f` | Requires current owner/session/attempt/lease/source and one undispatched PROCESSING turn; records dispatch before provider IO. |

Intake completion was also read: it requires `provider_dispatched=true` and returns the existing status
without applying facts when that precondition is absent. PKG-037's first disposable fixture used an older
pre-dispatch test sequence and was refused; the fixture now exercises current dispatch and asserts SUCCEEDED.

Next: compare the remaining worker claim/completion/recovery and Q&A dispatch/completion/cancellation
bodies and ACLs. Then choose a bounded failure settlement preserving dispatch and request identity,
prove late-result/lost-ACK behavior and align only the affected client deadlines. An existing FAILED
state may suffice; this read does not authorize a new state, provider replay, refund or certificate change.
