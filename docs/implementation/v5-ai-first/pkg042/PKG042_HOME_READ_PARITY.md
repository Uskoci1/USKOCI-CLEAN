# PKG-042 — cancelled Agreement read parity and Home attention

Status: combined server/client proof passed and candidate applied to canonical DEV on 2026-09-22.
Ledger196 =147 source +49 dev_alpha. Native client is built and artifact-verified; device checks remain.

## Measured defect

PKG-029b corrected `rpc_list_my_applications()` so a cancelled Agreement no longer alone makes its
application SELECTED. Three other readers still pass any Agreement's existence to
`private.my_application_state`: Home attention, paged applications and the task relationship overlay.
After cancellation followed by a task revision change, the main list says STALE_REVIEW_REQUIRED,
but the other readers say SELECTED: Home omits the required review and the active page omits the row.
With an unchanged revision, the main list says CLOSED while the task overlay still claims SELECTED.

Read-only DEV inspection on 2026-09-22 read every body and the classifier. `FUNCTION_PINS_20260922.json`
records exact before/after hashes. Agreements have UNIQUE(selected_response_id), so the aggregate's
existence predicate refers to the same single Agreement as the other readers' latest-row lookup.
The three functions are not triggers or members of the certified erasure function list. No private
digest execution or real-user impersonation was used for this inspection.

## Repair boundary

The candidate patches exactly three input predicates to the existing classifier, matching PKG-029b.
It preserves the historical agreementId, existing raw SELECTED precedence, stale-before-terminal
precedence, active/history rules, counts, account predicates, order, limits and callable signatures.
It does not rewrite stored responses, cancel Agreements, permit reapplication or change selection rules.
The reference unpaged reader and private classifier remain byte-identical and pinned.

Before/after MD5s, exact single anchors, unchanged authority and unchanged ready closure are asserted
inside one transaction. No schema, trigger, policy, grant, data or certificate change is intended.
No new dependency, provider call or device operation.

## Required proof

Replay the exact applied source and dev_alpha chain through PKG-040; PKG-041 has no SQL.
Reproduce the split before application. Refuse drift and tampering atomically; refuse double application.
Afterward compare the three readers with the existing canonical list for cancelled, changed,
withdrawn, explicit stale, raw SELECTED, confirmed, completed, superseded, absent Agreement and terminal
parent cases. Include 35 changed cancelled applications, complete counts and a three-row preview.
Use actual disposable Auth/PostgREST for the changed cancelled case, owner/outsider isolation and
anonymous denial. Preserve the closure certificate throughout. No synthetic account or data on DEV.

Home client wiring must follow this correction; a bounded attention response does not by itself make
the separate activity/upcoming-Agreement preview reads bounded. Do not claim all Home scans or
Activities pagination solved by this package.

First run 35696725854 reproduced both discrepancies with SQL and real Auth/REST. Atomic drift/tamper
checks passed; the candidate then rolled back because the temporary authority record's `strict` field
was not accessible in PL/pgSQL. Renamed that temporary field to `is_strict`, retaining the authority
comparison. No canonical DEV write occurred in that failed attempt. The corrected server proof
35697307349 passed; combined proof35698097056 additionally binds the new Home client adapter.

## Client attention integration

`homeAttentionClientService` calls the existing no-argument aggregate through the owned receipt
boundary (15-second bound and account-revision fence). Its decoder validates schema version, timestamps,
IDs and cross-field bindings, reason-specific nullability/counts, unique reason identities, priority,
three-item limit and complete count arithmetic. It maps only validated facts into the existing Serbian
wording and exact destination. No backend text is rendered as an error and no failed aggregate is
reconstructed from old lists.

Home calls this reader independently alongside its three preview reads. A failed attention read shows
an unavailable section with retry; successful attention survives failed previews and retains its own
known total. The two start actions, whole-account composition, navigation fences and layouts remain.
Activity and upcoming-Agreement preview reads still load complete lists. No network/payload reduction,
Activities pagination or complete Home read-contract closure is claimed in this slice.

The legacy pure attention composition remains only for the historical SQL oracle and explicit test
source. Production always supplies the aggregate result, including its unavailable state. Other full
count fields are validated but do not overwrite independently loaded preview counts from a different
snapshot. A future bounded preview contract must preserve upcoming-time ordering and row reconciliation.

Local focused tests: 60 pass across decoder/service, Home route and composition. Three new route
regressions fail on the previous route and pass on the new one; the existing account fence stays green.
Types pass. The first full regression run passed 241/242 suites and 4,686/4,687 tests: the existing
Firebase config subprocess exceeded its 15-second deadline (null process status). The unchanged
Firebase suite then passed alone (8/8; the affected check took 427 ms). The full repeat passed
242 suites /4,687 tests and exited0; its existing delayed-exit warning is recorded. The earlier timeout
is not counted as a green full run. Disposable proof35698097056 passes25 checks and346 offline Edge
tests, loading the exact new client adapter over real local Auth/PostgREST. Source dfa54206.

The TypeScript config now excludes the already ignored `artifacts/` output directory, retaining every
Expo base exclusion and every source include. An earlier Edge staging copy under artifacts contained
an intentionally partial dependency tree and was incorrectly picked up by the broad source glob.
No tracked application source was excluded; this is not a suppression of a source type error.

## Applied and verified

Migration20260922071319 `dev_alpha_pkg042a_cancelled_agreement_read_parity` contains the exact proven
candidate without its final newline (SHA256 f0b7356c9f66067e91b2acf63a7f30a6729debc22e1f0e2bc45af6524e145670).
Fresh postflight reads verified all three new body pins, both unchanged dependency pins and all five
owners/ACLs/config/volatility/strictness. The certified closure65980fce stayed unchanged and the
transaction asserted live equality/readiness before and unchanged live/readiness after. No independent
private digest execution is claimed. No existing user row, Edge function or JWT setting was changed.

Receipts: `DISPOSABLE_PROOF_RECEIPT_20260922.json` and
`supabase/operations/dev-alpha/ledger/20260922_pkg042_application.receipt.json`.
PKG-00435698097011 and PKG-00735698097030 also pass on the same source.
Clean CI source147 integrity passes. Local integrity still refuses the owner-preserved foreign
untracked migration; no frozen tracked migration or inventory rule was changed.

APK35698097121 on dfa54206 succeeded. Downloaded68,554,979 bytes; SHA256
3dfddf496163f860f5b9e526d8bd3d291f031526534a9b6f7070b3cd9efa0fde matches the checksum and both
source/tree-bound recovery/icon attestations. See APK_RECEIPT_20260922.json. Not installed/tested;
no claim that the owner's current phone already runs this client or that the complete journey passed.
