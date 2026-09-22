# PKG-040 — Q&A classification failure recovery

Status: candidate and local tests; disposable proof pending. Not DEV applied or deployed.
Baseline: ledger194, PKG-039; intake46 / worker17 and publication14 unchanged.

## Contract

An owned Q&A classification failure settles the exact account/task/request/attempt once. The new
service-only function reuses existing CANCELLED with safe reason QA_PROCESSING_FAILED; no new table,
state enum, trigger, policy decision or certificate binding. It changes only PROCESSING and preserves
all other states, original dispatch/lease/hash metadata, and canonical receipts. A retained direct
writer's existing receipt prevents a false cancellation claim; owned recovery reads that receipt first.
No claim/dispatch path is reopened. A person can explicitly submit a new command after the old one ends.

Edge cleanup is independent of caller cancellation and bounded at5 seconds. Provider is bounded at30
seconds within the existing45-second work ceiling; native submit opts into55 seconds, ordinary reads
stay15 seconds. Lost claim ACK without an owned attempt still relies on durable recovery. Lost
completion ACK preserves READY, allowing explicit same-key canonical submission without another model
call. Lost publication ACK preserves COMMITTED. Unknown cleanup outcome remains unconfirmed.
No automatic publication, paid replay, refund, text rewrite or policy activation.

The client explains technical cancellation separately from user cancellation; it keeps the draft and
unlocks only explicit submission. Older clients still understand the existing cancellation envelope.

## Evidence required

Seven failure regressions fail on prior Edge source and pass after. Offline handler tests58/58 and
focused client/UI37/37 and types pass. Full Jest241 suites /4652 tests passes and exits0
(delayed-exit warning, no failed test). Local all-Edge run
passes340/341; the one refusal is the unchanged historical inventory test encountering the owner's
foreign untracked frozen-folder SQL. That file is untouched/excluded; tracked CI must pass all341.
The disposable proof
replays exact source147 and dev_alpha chain through039. It checks pins, tamper rollback, one application,
only one function addition, unchanged ready closure, owner/attempt/task/role binding, both observed
failure/completion lock orders, terminal results and late output. It runs the exact Edge with actual
local Auth/PostgREST, stubbing only the provider, before and after the candidate. There are no real model
calls or synthetic rows/accounts on DEV.

## Boundaries

11.1 is not a promise of instant recovery after process death: existing sweep grace remains. Language
quality, daily/repeated work decisions, price context in Q&A, device testing and release readiness are
separate. Read CI report, fresh preflight, exact candidate application and readback before deployment.
JWT remains true; deployment must read back every bundled asset byte-for-byte.

First CI35676937072 passed341 Edge regressions and replay through039, then stopped before the defect
probe: the new proof wrongly assumed historical device credentials were exported by this fixture.
It now creates explicit disposable actors through local Auth, as PKG-039 does. No DEV application.
Second run35677260660 reproduced the defect and passed candidate pins, ACL, both lock races and
certificate checks, then correctly hit QA_ASK_COOLDOWN because the proof reused an actor immediately
after publishing. Independent publication scenarios now use separate disposable actors; the real
cooldown, policy and timestamps are unchanged.
