# PKG-042 — cancelled Agreement read parity and Home attention

Status: candidate prepared; disposable CI proof pending. Canonical DEV is unchanged at ledger 195.

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
