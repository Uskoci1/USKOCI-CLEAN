# EX-06E — bounded readback/behavioral proof receipt, 2026-10-04

## Verdict and boundary

**BOUNDED DISPOSABLE SUITE PASS. NOT APPLIED TO DEV. PACKAGE NOT YET APPROVAL-READY.**

Source commit: `f1c4318e34033eab1a67dc3998a7a607c818d159`.
Base inspected: `b15478837ba5828d1c9eccfc1502cd01ed5f93a5`.
Canonical branch: `work/uskoci-ui-unification-20260924`.
Workflow run: `37230071628`; job: `111517706810`; result: SUCCESS.
Artifact: `11313468649`, `ex06e-lifecycle-recovery-f1c4318e34033eab1a67dc3998a7a607c818d159-37230071628`.
Artifact ZIP SHA-256: `6580fafedef601a50fc637f10829f12ae98d6f23e2475aeb189582ad18867ac0`.
The downloaded ZIP digest, source binding, nine individual results, applied/reverted states and teardown were inspected independently of the workflow's success label.

This receipt is evidence within the existing EX-06 work, not a new status registry. `docs/control/redovi.json` remains the registry. No row is promoted to DONE or PHONE PROVEN by this receipt; the registry/generated dashboard have not been regenerated in this checkpoint.

## What changed in this round

Only the proof, its workflow and two offline verification files changed. The server candidate and revert bytes were NOT changed:

- `supabase/candidates/ex06e_lifecycle_recovery.sql`: SHA-256 `356c39f779f39740a3728f7fe3bf40b5e3fdb6bee3a0b8ad26308054ebfabe8d`.
- `supabase/candidates/ex06e_lifecycle_recovery_revert.sql`: SHA-256 `97b945e192632b0a95c8b6b766855ae418f6786ae06088984584eb86d6565ca4`.

The previous run `37223348948` stopped at `assert.ok(res.error, 'direct clear must fail')`. That assertion incorrectly required an explicit error for a forbidden UPDATE. The read-only DEV policy inspection confirmed `needs_owner_update` only admits DRAFT rows. A SELECT-visible SELECTION row can therefore produce a successful response with zero updated rows.

The replacement proof does not accept an empty response alone. It proves the owner can read the exact existing task, fingerprints the whole Need row before/after, compares closure timestamp, coverage and queue state, requires either zero returned rows or the exact permission error class, and checks that no new opportunity events/deliveries appear. It also validates the canonical owner readback again. The observed disposable result was `RLS_ZERO_ROWS`, unchanged state, confirmed owner readback, zero new target opportunity events/deliveries.

Thirteen new offline tests ensure the verifier rejects cleared/changed closure, changed row hash, changed coverage, newly queued dispatch, wrong subject, missing readback, returned rows, transport errors and malformed replies. Together with the six existing source checks: **19/19 PASS**.

The proof now checkpoints each scenario, guards loopback before runtime import, bounds its added API calls, and does not serialize actor/SDK client objects into artifacts.

## Executed behavioral results

| Scenario | Actual result |
| --- | --- |
| 2 required, 1 selected, OPEN | Remaining demand 1; wave SENT. |
| 2 required, 1 selected, OPEN, selected person cancels | Coverage 0, remaining demand 2; recovery queued; wave SENT. |
| 2 required, 2 selected, one cancels | Coverage 1, remaining demand 1; unaffected Agreement row hash unchanged; wave SENT. |
| 2 required, 1 selected, manually CLOSED, selected person cancels | Coverage 0; exact closure timestamp preserved; no target queue; no new target opportunity event/delivery. |
| Same CLOSED task with a deliberately inserted stale queue row | Tick removes target queue without ERROR/retry; repeated tick leaves it absent. |
| CLOSED with one missing place, then canonical reopen | Reopen receipt says 1 missing; coverage remains 1. |
| Close again, replay a PREVIOUSLY SUCCESSFUL reopen | Historical receipt returned, but new closure is not cleared; exact row fingerprint unchanged. |
| Then selected person cancels; canonical new reopen | Reopen receipt says 2 missing; fresh wave reports remaining demand 2. |
| Non-owner reopen and stale Need revision | Both refused without changing the task fingerprint. |
| Known FIXED execution window expired by 26 hours, then cancellation | No recovery queue, wave STOPPED/SEARCH_WINDOW_CLOSED; injected stale queue also terminates. |
| Still-future FIXED execution window, then cancellation | Time admitted; missing demand 2; wave SENT. |
| Explicit expired response_deadline fixture | No recovery queue; STOPPED/SEARCH_WINDOW_CLOSED. No new V1 deadline feature. |
| Direct closure-field UPDATE | RLS_ZERO_ROWS and unchanged canonical/SQL readbacks. |

These are assertions within **9/9 named scenario groups**, not 13 independent phone journeys.

Important interpretation: remaining demand is not the number of invitation recipients. The positive fixtures sent a wave to three candidates while demand was one or two places. No person was automatically selected. F5/recipient deduplication is not closed by this result.

The CLOSED stale-queue test's first tick also processed three other synthetic fixture tasks. Its ZERO guarantee is explicitly for the CLOSED target Need (zero target new events/deliveries and its queue removed), not a claim that the whole disposable database had zero work. No real user or live DEV row was involved.

## Exact code revert and certificate evidence

The candidate changes these existing bodies:

| Function | Predecessor prosrc MD5 | Candidate prosrc MD5 |
| --- | --- | --- |
| `private.dispatch_next_wave(uuid)` | `1fd8c51ef026ece24471e2f68250ecc5` | `c37d672ccaf44e86b5e83b117156cdb8` |
| `private.dispatch_tick(integer,timestamptz)` | `e568b033b9457736869fc5829ffc5511` | `8798cb6b6f004ecd5d88dd472cd6de0b` |
| `public.rpc_cancel_agreement(uuid,text)` | `f3ca4d5f8bdf324d5773d887d0a2d093` | `478ce82cafaf93f8e2b7f2d8ad0f3bbb` |

New candidate functions: `private.need_search_time_admitted_v1(uuid,timestamptz)` and `public.rpc_reopen_remaining_search(uuid,integer,text,text)`. No new table. Existing remaining-search ledger reused. Certified `private.guard_remaining_search_close_fields()` is unchanged (`ce59ad1cdee98518950e289aa5c329a4`).

After revert all three predecessor hashes matched, both new functions were absent, the certified trigger stayed unchanged, and retention readiness stayed true. The disposable certificate was `63fd10151d13d411e553c9c6851e9a93f396fcce3a0423505988559db8e8c6db` before/after candidate scenarios and after revert. Teardown exited 0.

This is exact CODE/function rollback on this disposable chain. It does not undo completed user commands, delete command history or rewind business data. Never describe it as a full data rollback. The suite does not yet reproduce the old behavioral failure after revert or prove every later-drift refusal.

The reconstructed chain is the existing live79 -> source147 -> PKG-050 -> ex06a proof chain. It is not proof of complete equivalence to every newer package/configuration on current DEV; the disposable certificate must not be substituted for the live DEV certificate.

## Why this is not yet DEV approval-ready

The green bounded suite is retained, not discarded, but the following narrower admission checks remain OPEN:

1. **Shared-ledger operation identity.** In the reviewed candidate, close/reopen hash the same three payload fields, while reopen stores its key as `reopen:` + client key. Existing close accepts an arbitrary key up to 200 characters. A close submitted with that same prefixed key and identical payload can occupy the reopen lookup and be returned as a close receipt. This is a source-level finding, not a reproduced database failure in this run. Minimal follow-up: bind operation identity to the request hash and stored receipt, align shared-key locking, and prove cross-operation collision refusals without side effects.
2. **A delayed FIRST reopen is not the already-successful replay tested above.** Need revision alone does not identify a particular manual closure. Bind a first reopen to the exact observed `closedAt` (or equivalent existing authority epoch) and prove that an old unexecuted command cannot clear a later closure. This requires a small canonical command/client contract extension, not a new task FSM.
3. **Remaining time admission cases.** Current helper/green tests cover the known FIXED/relative Need window and an explicit response deadline. Bounded generic FLEXIBLE (`ends_at` present), an accepted Agreement window that differs from the parent Need, the exact end boundary and a lock wait crossing that boundary are not proved here. The helper currently does not read generic FLEXIBLE bounds. Do not infer complete replacement-time closure or a +24h extension from the future-window control.
4. **Revert admission and current-chain checks.** Pin both newly added bodies/metadata before a future live revert so later work is not silently dropped; add deliberate drift/refusal checks and a before/fix/revert behavioral witness. Revalidate exact current DEV dependencies and certificate without mutating DEV.

No extra product decision is required to prepare these source/disposable safety checks. No approval to apply any candidate is requested by this receipt.

## Client/UI still missing

No application source or APK changed in this round. `Ponovo traži ljude` is not live merely because the RPC works in disposable tests.

Minimum client contract: capture the same Need, revision, observed manual closure and immutable command key; send the canonical command; distinguish immutable receipt history from CURRENT state; show success only after fresh authorized readback. Unknown outcome retains the same command, not a new intent.

The current readback exposes closedAt but does not yet expose a complete owner-only `canReopen`/time-reason/next-action projection. Extend an existing suitable read authority or add a narrow owner read after reviewing its grant boundary; do not make the phone an authoritative time/matching calculator.

Minimum UI: show actual missing capacity independently of the manual closure. Offer reopen only when currently allowed; after a past execution window, use existing Dogovor completion/confirmation/problem/change/cancel actions. Do not add automatic 24h revival, new response-deadline controls or a parallel execution state machine.

Physical-phone acceptance, provider push delivery/tap/ACK, complete marketplace acceptance and release readiness remain OPEN. F5 remains out of scope; isolated F10 is not applied. Large runtime cleanup is not started.
