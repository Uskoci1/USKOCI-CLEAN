# PKG-039 — bounded interview failure settlement

Status: implementation/offline tests; disposable proof pending. Nothing from this package is applied
or deployed. Canonical baseline: PKG-038 ledger193, intake45 / worker16, sourceae332d29.

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
the same request identity and no replay. Focused clients178/178 and worker29/29 pass; types pending.

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
