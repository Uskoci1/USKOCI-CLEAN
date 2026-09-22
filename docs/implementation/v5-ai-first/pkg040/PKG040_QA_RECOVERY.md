# PKG-040 — Q&A classification failure recovery

Status: proven, DEV applied and exact Edge deployed. APK built; device verification pending.
Baseline was ledger194, PKG-039. Current ledger195; Q&A13 and intake47 (PKG-041), worker17/publication14.

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

## Evidence

Seven failure regressions fail on prior Edge source and pass after. Offline handler tests58/58 and
focused client/UI37/37 and types pass. Full Jest241 suites /4652 tests passes and exits0
(delayed-exit warning, no failed test). Local all-Edge run
passes340/341; the one refusal is the unchanged historical inventory test encountering the owner's
foreign untracked frozen-folder SQL. That file is untouched/excluded. Final tracked CI passes all346
(including five subsequent PKG-041 cases).
The disposable proof
replays exact source147 and dev_alpha chain through039. It checks pins, tamper rollback, one application,
only one function addition, unchanged ready closure, owner/attempt/task/role binding, both observed
failure/completion lock orders, terminal results and late output. It runs the exact Edge with actual
local Auth/PostgREST, stubbing only the provider, before and after the candidate. There are no real model
calls or synthetic rows/accounts on DEV.

## Boundaries

11.1 is not a promise of instant recovery after process death: existing sweep grace remains. Language
quality, daily/repeated work decisions, price context in Q&A, device testing and release readiness are
separate. CI report, fresh preflight, exact candidate application and readback were checked before
deployment. JWT remains true; every deployed bundled asset was compared byte-for-byte.

First CI35676937072 passed341 Edge regressions and replay through039, then stopped before the defect
probe: the new proof wrongly assumed historical device credentials were exported by this fixture.
It now creates explicit disposable actors through local Auth, as PKG-039 does. No DEV application.
Second run35677260660 reproduced the defect and passed candidate pins, ACL, both lock races and
certificate checks, then correctly hit QA_ASK_COOLDOWN because the proof reused an actor immediately
after publishing. Independent publication scenarios now use separate disposable actors; the real
cooldown, policy and timestamps are unchanged.

Final CI35677596411 on2263772e passed17 SQL/Auth/REST checks and346 offline Edge tests. The report is
`DISPOSABLE_PROOF_RECEIPT_20260922.json`. It reproduces the old handler's blocking attempt before the
candidate and proves recovery after, both completion/failure lock orders, READY after lost completion
ACK and COMMITTED after lost publication ACK. The provider is synthetic; Auth/PostgREST are real local
services. The disposable closure digest stays equal and ready; it is not claimed to equal DEV's digest.

## DEV and artifact receipts

Applied `dev_alpha_pkg040a_qa_failure_settlement`, version20260922020108, ledger195 =147 +48.
Exact ledger SQL matches the candidate without its final newline: SHA256
`a47d403705447ef89e35a6f08c5eccc7c3fbd42f44deec45a2dab97a723e31e9`.
Function MD5 `ac65279aa93fa7cd26e433aeddea67b6`, service-only authority/owner/search_path match proof.
The successful transaction asserts unchanged ready DEV closure65980fce before commit. No independent
private digest call is claimed; no existing user rows were rewritten. Application receipt:
`supabase/operations/dev-alpha/ledger/20260922_pkg040_application.receipt.json`.

Q&A v13 ACTIVE / verify_jwt=true; all four read-back assets match the proof's hashes. They were staged
from7b5f794b and are unchanged in proof source2263772e. Anonymous probe returns401. The preceding live
budget helper lacked two unused audio exports; the deployed helper is the same current helper exercised
by CI, and Q&A's reserve-only import is unchanged. See `EDGE_RECEIPT_20260922.json`.

APK35677195929 succeeded fromec3b3d43. Downloaded SHA256
`5568feb7d16083be8b7232795c78a98e1a23bf697d956629f2bbba9b41b8fa93`, 68,549,871 bytes,
matches checksum and both source-bound recovery/icon attestations. No src changes from build source to
HEAD2263772e. It contains native PKG-038/039/040 changes; PKG-041 is server-only. See
`APK_RECEIPT_20260922.json`. Not installed or tested on a phone.
