# EX-06E R3 — calendar consistency and owner-only recovery reads

SOURCE/DISPOSABLE ONLY. NOT APPLIED TO DEV. No new UI import, APK or phone claim. This extends the same bounded EX-06E package; F5, standalone F10 and cleanup remain out of scope.

## Authority reconciliation before this change

The current authority index and the full 50-row reconciliation explicitly classify C12 D-0063/D-0080 replacement entitlement/window/countdown as SUPERSEDED. Final owner review 21/21 keeps same-Zadatak missing-capacity recovery via normal Prijava/Selection, with independent Agreements and the requester choosing Ne trazi vise. The latest owner messages further require CLOSED cancellation to preserve that decision. Therefore no old 24-hour entitlement, countdown, private replacement ledger or automatic post-window extension is introduced here. Earlier EX06E explanations treating that historical entitlement as a current mandatory matching feature were too broad.

Sources: docs/authority/AUTHORITY_INDEX.md (stale/superseded table); docs/authority/sources/owner-history/02_RECONCILIATION/07_C12_SEMANTIC_DECISION_RECONCILIATION_21_21.csv (C12_7 D-0063/D-0080); docs/authority/sources/owner-history/01_CURRENT_CANON/OWNER_REVIEW_21_FINAL_COMPLETE_SOURCE.md (final item 21). The owner-approved ex06a meaning of ove nedelje is the remaining local calendar week; its live matcher already uses that meaning.

## Proposed combined server delta

R2's exact combined candidate/revert inputs remain pinned. R3 changes the existing relative_schedule_end_v5 helper so WEEK_FLEXIBLE expiry and search admission use the local Monday-Sunday calendar week, not publication +7 days. The same validated task timezone/fallback as matching applies. Today/tomorrow retain their local-day meanings. Existing function metadata is preserved.

Two new authenticated owner-only STABLE readers:
- rpc_get_need_search_state(uuid): current coverage, manual search authority, exact closedAt, time admission, canReopen/reason and a next navigation action. Counts do not become a new execution FSM. Existing Agreement workspace authorizes its own confirmation/problem/change/cancel actions.
- rpc_get_reopen_remaining_search_receipt(uuid,integer,timestamptz,text,text): the outcome of an exact earlier command. NOT_CONFIRMED is an observation, not permission to submit automatically. This reader never calls the writer or enqueues dispatch. Historical CONFIRMED can coexist with a current CLOSED state.

The shared Need owns remaining recruitment requirements/time. A separately accepted Agreement snapshot is not overwritten or automatically completed when the Need window passes. In particular, a later accepted term cannot silently extend the Need recruitment window. No new per-allocation replacement subsystem is built from historical C12 text.

## Evidence intended

Retain 16 R2 groups and add six R3 groups. Test 22 independent timezone/DST/year-boundary cases; existing expire_lifecycle after local week end; owner vs outsider/missing reads; both readers in actual READ ONLY transactions; unknown-command reads without any writes; old receipt after a newer closure; independent accepted future terms vs expired Need; and the existing worker done/requester confirmation/terminal history flow. Preserve the original failure before/after revert, drift refusals and exact reapply/revert.

A source check is not a database PASS. Read the actual workflow artifacts before accepting this package. Combined SQL is generated inside one transaction; do not apply R2 plus partial hand edits. Revert is code rollback, not deletion of business or command history.

## Remaining integration

No live DEV application is authorized. UI must consume current state separately from historical receipts, retain exact closedAt without Date rounding, fence stale callbacks and keep the same command on unknown outcomes. No client route calls these readers yet. Native/phone/provider/release checks and full current-DEV chain admission remain separate. docs/control/redovi.json remains the only status registry; this is scoped source documentation, not a new master plan.
