# PKG-042 — cancelled Agreement read parity and Home attention

Status: server proof passed; client integration prepared and its combined disposable proof pending.
Canonical DEV is unchanged at ledger 195.

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
comparison. No canonical DEV write occurred. The corrected server proof 35697307349 passed; the next
run will additionally bind the new Home client adapter.

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
Firebase suite then passed alone (8/8; the affected check took 427 ms). A full repeat is running;
the timeout is not counted as a green full run. The updated disposable proof is pending and also
loads the exact new client adapter over real local Auth/PostgREST.

The TypeScript config now excludes the already ignored `artifacts/` output directory, retaining every
Expo base exclusion and every source include. An earlier Edge staging copy under artifacts contained
an intentionally partial dependency tree and was incorrectly picked up by the broad source glob.
No tracked application source was excluded; this is not a suppression of a source type error.
