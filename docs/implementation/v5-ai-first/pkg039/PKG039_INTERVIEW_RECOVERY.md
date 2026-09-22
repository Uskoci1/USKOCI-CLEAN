# PKG-039 — bounded interview failure settlement

Status: proven and DEV applied on 2026-09-22. Proof source ddb91a8e, run35675491926:
330 offline Edge tests and16 disposable SQL checks pass. Canonical ledger194 (source147 +47 dev_alpha),
intake46 / worker17 byte-equal that source, JWTtrue. Closure65980fce remains ready and unchanged,
asserted inside the candidate transaction; exact applied text and function authority read back.

## Contract

Intake's failure function previously excluded dispatched attempts, so malformed output, HTTP errors,
timeouts and lost completion responses could hold the conversation until the existing delayed sweep.
Candidate039a removes only that exclusion from the pinned failure function. It still updates only the
same account/conversation/request/attempt in PROCESSING, with no cancellation; it preserves dispatched,
request hash, success receipt and cancellation. Existing status logic makes a dispatched FAILED attempt
non-retryable. A new explicitly submitted turn can continue. No provider retry/refund occurs.

Worker failure already has these same-attempt/terminal protections; its function stays unchanged.
Both Edge handlers now attempt at most one bounded metadata settlement on failure, with a5-second
signal independent of the caller. Lost claim ACK without an owned attempt remains for the existing
durable sweep. Cleanup failure never authorizes another provider call. Lost success ACK may remain
unconfirmed in the stream; authoritative readback owns recovery and successful SQL is never overwritten.

Both interview provider calls opt into30 seconds; shared stream callers retain12 seconds unless they
explicitly opt in. Both native send paths wait up to55 seconds; ordinary RPCs retain15. Worker fetch
and body reads race against cancellation, including transports that ignore AbortSignal. These are
bounded tolerances, not promises of actual provider latency or quality. Existing60/90-second leases
remain authoritative. Q&A's45-second path and delayed crash sweep are separate; this does not close
all of deep-read11.1.

## Evidence

Five new intake regressions fail on deployed PKG-038 source and pass after these changes. Focused
worker tests cover disconnect,30-second provider timeout,5-second hanging cleanup, transport failure,
invalid output and lost completion ACK. Both client services accept a response after20 seconds with
the same request identity and no replay. Focused clients178/178 and worker29/29 pass; types pass.
Full Jest241 suites /4650 tests passes and exits0. The first run warned about delayed exit;
the diagnostic rerun with detectOpenHandles also passed all tests and exited0.

The disposable proof reconstructs source147 plus exact DEV candidates through038, demonstrates the
pre-fix blocking state, and checks wrong predecessor/tampering/one application, function surface and
closure invariance. Real local Auth/PostgREST exercises failure, late completion, no same-key replay,
explicit new turn, pre-dispatch behavior, wrong attempt/owner, client denial, cancellation and both
observed lock orders of completion versus failure. Worker real SQL is tested independently of mocked
transport. All synthetic accounts/data are confined to the disposable CI database.

## Application gate

Read the downloaded report before applying. Recheck DEV function pins, apply exact proven candidate,
verify ledger text SHA and unchanged ready closure, then deploy/read back both exact bundles with JWTtrue.
No new dependency, paid provider call, credential handling, phone action or user-row rewrite.

Application receipt: `supabase/operations/dev-alpha/ledger/20260922_pkg039_application.receipt.json`.
Deployed bundles: `EDGE_RECEIPT_20260922.json`. Anonymous requests return401.
PKG-014B run35675491728 passes. PKG-010 run35675491771 reached the real Worker proof and failed
because its old assertion expected PROCESSING after a definite synthetic provider error. The assertion
now requires FAILED and retains dispatch, retry, provider-count and unchanged reservation checks;
the disposable chain must pass before that proof repair is called verified.

Client build35675580983 succeeded; downloaded SHA256062ad8fc… matches checksum and both source-bound
recovery/icon attestations. See APK_RECEIPT_20260922.json; not installed or tested on a phone. This package
does not establish real-provider language quality, Q&A recovery or release readiness.
