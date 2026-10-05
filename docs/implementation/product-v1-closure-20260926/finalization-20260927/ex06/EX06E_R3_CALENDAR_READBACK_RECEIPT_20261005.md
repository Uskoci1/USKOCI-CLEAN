# EX-06E R3 — calendar consistency and read-only recovery: verified receipt

## Verdict and stop boundary

**BOUNDED COMBINED SERVER CANDIDATE PASS: 39/39 offline tests, 22/22 disposable behavioral groups, 9/9 application/revert refusal probes. Exact code/metadata revert and reapply PASS. STOPPED FOR OWNER REVIEW. NOT APPLIED TO DEV.**

This is the requested source/candidate/revert/disposable checkpoint, not a claim that the mobile lifecycle, current public release or all current-DEV packages are accepted. There are no new UI imports, APK builds, physical-phone/provider tests or live writes in this round. F5, standalone F10 application and large cleanup remain out of scope.

Verified source: `6892bc16049eec3d5c009fa214e27f4cdafb91a5`.
Verified tree: `d9d7a029901427f0558c98699c25b7cf6e1ed7f5`.
Canonical branch: `work/uskoci-ui-unification-20260924`.
Workflow: `EX-06E R3 calendar and owner readback`; run `37262281584`; job `111611825068`; every step including teardown and artifact preservation SUCCESS.
Artifact ID: `11324378558`.
Artifact name: `ex06e-r3-6892bc16049eec3d5c009fa214e27f4cdafb91a5-37262281584`.
ZIP SHA-256: `dae22edf0d8683c8a729b4ba88cd3cd705e68d7dc548824775570eea6cb1c422`.

The downloaded ZIP was independently inspected: digest, source binding, generated SQL hashes, all 22 scenario results, all 9 refusal results, before/applied/reverted states, old-failure witnesses, offline-test summary and teardown. This verdict is not inferred solely from a green workflow label.

## Authority correction: no historical 24-hour replacement subsystem

The previous EX06E audit over-read the historical C12 replacement entitlement as a current requirement. The current sources explicitly supersede that subsystem:

- `docs/authority/AUTHORITY_INDEX.md`, stale/superseded table: old C12 24h entitlement/countdown is historical.
- `docs/authority/sources/owner-history/02_RECONCILIATION/07_C12_SEMANTIC_DECISION_RECONCILIATION_21_21.csv`, C12_7 / D-0063 and D-0080: retain same-task missing-capacity recovery, not a separate replacement window/countdown/marketplace.
- `docs/authority/sources/owner-history/01_CURRENT_CANON/OWNER_REVIEW_21_FINAL_COMPLETE_SOURCE.md`, final item 21: same Zadatak, ordinary Prijava/Selection, unaffected Agreements, requester can stop searching.
- The latest owner instructions further require a manual CLOSED search to remain CLOSED after cancellation, until a new explicit requester command.

Therefore this candidate does NOT introduce a 24h extension, replacement entitlement table, replacement countdown or parallel execution FSM. A separately accepted Agreement does not silently rewrite or extend the parent Need's recruitment window. Its own accepted terms and existing completion/change/problem/cancellation authority remain intact.

## What R3 adds to verified R2

### One calendar meaning for "ove nedelje"

Live matching already derives the remaining local Monday-Sunday calendar week from publication and task timezone (ex06a). The old expiry helper instead used publication +7 days. R3 changes the existing `private.relative_schedule_end_v5` body so calendar-week expiry and Need search-time admission agree with that meaning. The valid task timezone/fallback matches the existing matcher. Today/tomorrow retain their local-day semantics. Existing function metadata stays unchanged.

### Two different read questions, two read-only answers

`public.rpc_get_need_search_state(uuid)` returns the owner's CURRENT state: Need/revision/status, serverAsOf, required/covered/missing slots, manual OPEN/CLOSED and exact closedAt, time admission, canReopen/reason, and a navigation next action. It uses the existing coverage and candidate time predicates. It never executes a command. The next action is guidance; the existing Agreement workspace still decides which Agreement mutations the caller may perform.

`public.rpc_get_reopen_remaining_search_receipt(uuid,integer,timestamptz,text,text)` answers whether an exact earlier reopen command committed. It binds the actor, operation, Need/revision, exact observed closure, immutable key and normalized reason. NOT_CONFIRMED is an observation, not permission to retry automatically. CONFIRMED is historical command evidence and can coexist with a currently CLOSED search. This reader never calls reopen or enqueues work.

Both are authenticated, owner-restricted, STABLE functions with a fixed pg_catalog search path and no table grants to clients. Tests actually execute them in PostgreSQL READ ONLY transactions, as well as through authenticated PostgREST.

## Executed behavioral evidence

All 16 R2 groups remain PASS, including the five owner-required scenarios:

| Scenario | Observed result |
| --- | --- |
| 2 required -> 1 selected -> OPEN | Remaining demand 1; dispatch sends candidate invitations. |
| 2 required -> 1 selected -> OPEN -> selected person cancels | Coverage 0; remaining demand 2; recovery queued. |
| 2 required -> 2 selected -> one cancels | Coverage 1; remaining demand 1; unaffected Agreement hash unchanged. |
| 2 required -> 1 selected -> manual CLOSED -> selected person cancels | Exact closure timestamp preserved; target not queued; zero new target opportunity events/deliveries. |
| CLOSED + missing -> explicit canonical reopen | Both one-missing and two-missing cases proved. Historical replay cannot clear a newer closure. |

Retained R2 safety evidence includes stale-queue removal without an ERROR loop, expired/future time controls, the existing response-deadline guard, denied direct field mutation, close/reopen key collisions, delayed FIRST commands, actual concurrent same-key requests, explicit generic FLEXIBLE ends, strict microsecond endpoints, missing relative origins, and two real database lock waits crossing expiry.

Six R3 groups also PASS:

1. **Calendar endpoints:** 22 independently prepared timezone/DST/year-boundary cases across Europe/Belgrade, Europe/London, America/New_York and Pacific/Auckland, plus today/tomorrow fallback cases. Calendar end and its preceding microsecond checked.
2. **Existing expiry:** an unselected WEEK_FLEXIBLE task is EXPIRED and removed from the queue at the local calendar-week endpoint, using existing expire_lifecycle rather than a new FSM. This uses an explicitly labelled synthetic time fixture.
3. **Owner current-state read:** canReopen and missing capacity match the writer; outsider, participant and absent-task reads do not disclose owner state; READ ONLY transaction and whole target fingerprints remain unchanged.
4. **Unknown-outcome receipt read:** NOT_CONFIRMED does not execute/requeue anything. After a real reopen and a new close, historical CONFIRMED coexists with current CLOSED. Altered payload and a different account are denied. READ ONLY transaction succeeds.
5. **Independent accepted terms:** a passed parent Need window with a future accepted Agreement leaves the Agreement, versions and execution hash unchanged. No automatic completion or time extension; current guidance is OPEN_AGREEMENTS and reopening the expired recruitment window is not allowed. The mismatched timestamps are an explicit synthetic fixture, not a new user-facing change writer.
6. **Existing completion:** worker rpc_mark_work_done -> owner reader shows pending confirmation/OPEN_AGREEMENTS -> requester rpc_confirm_completion -> parent COMPLETED/VIEW_TASK_HISTORY. Required 2, covered 1, missing arithmetic 1 remains truthful, but a terminal task cannot reopen. Completed work is not counted as newly missing work.

The nine refusal probes are duplicate candidate, drift in each R2-added body, R2 grant drift, R2 volatility drift, drift in each new R3 reader body, R3 reader grant drift and relative-helper drift. Each refusal leaves the full checked function catalog unchanged.

The original CLOSED/cancellation ERROR/NEED_REMAINING_SEARCH_CLOSED was reproduced before apply and again after exact code revert. The old rolling-week mismatch was also present before/after revert and absent while the combined candidate was applied. Reapply and final revert both passed.

**Counting boundary:** missing capacity is not the invitation recipient count. Positive fixtures invited three candidates for one or two open places; nobody is automatically selected. The CLOSED stale-queue tick also processed three other synthetic Needs. ZERO is proven for the closed target's new opportunity events/deliveries and queue, not for all activity in the disposable database. This does not close F5.

## Exact future server delta

Use the generated combined R3 `candidate.sql`, not R1/R2 plus manual edits. It is generated inside one transaction from pinned verified inputs.

Candidate SHA-256: `bd8c823c67c55967f0e62a8e893320897832a6f8f2248c762f9e1c3c15bf87da`.
Revert SHA-256: `46df9b4931bf4a96baeda560f3afd477a69afc845c82af0dd0f269c541189042`.
Generated proof SHA-256: `037a47dad126b07a50a0c516b9394224c1c286c930e321289f0677a600575caf`.

Four existing function bodies would change:

| Function | Predecessor prosrc MD5 | R3 prosrc MD5 |
| --- | --- | --- |
| `private.dispatch_next_wave(uuid)` | `1fd8c51ef026ece24471e2f68250ecc5` | `2b58d69640ac802a5dd3fa3cef6c56d0` |
| `private.dispatch_tick(integer,timestamptz)` | `e568b033b9457736869fc5829ffc5511` | `8798cb6b6f004ecd5d88dd472cd6de0b` |
| `public.rpc_cancel_agreement(uuid,text)` | `f3ca4d5f8bdf324d5773d887d0a2d093` | `e59b8f7d3e14ebbf6f9ddd8dd63b0af7` |
| `private.relative_schedule_end_v5(text,timestamptz,text)` | `7164c2ba0d23a0387376fec67f7154b9` | `f6e229652da38131289ff3a23c733269` |

Four new functions would be added:

| Function | prosrc MD5 |
| --- | --- |
| `private.need_search_time_admitted_v1(uuid,timestamptz)` | `b830cd07c2a5db101a3a28096256a75b` |
| `public.rpc_reopen_remaining_search(uuid,integer,timestamptz,text,text)` | `ce99ef406e21fdf6d8a01c399cc1ea1c` |
| `public.rpc_get_need_search_state(uuid)` | `0c12e43f2c3f3a7e638dcbbcea1e3b17` |
| `public.rpc_get_reopen_remaining_search_receipt(uuid,integer,timestamptz,text,text)` | `9aa7d2e3e12230d52d75c3500adae373` |

No new persistent table, RLS/trigger change, event vocabulary, Need status, payment/entitlement or execution state machine. Existing close command and certified remaining-search guard remain unchanged. The unsafe old four-argument reopen is absent.

## Revert and preserved history

The tested revert checks the new bodies/privileges and modified relative helper before restoring code. It restores all four predecessor bodies and removes the four new functions. Before/reverted JSON states and the checked full function/metadata catalog match exactly. Reapply/final revert also match.

This is **code rollback, not business-data rollback**. It does not undo user commands, delete command history or restore previously cancelled Agreements. That distinction remains essential after any future live use.

Disposable certificate remained `820fe3479cb1257ac3e3634f6872fdbc5771e9d16c7025eb78d3ff086a846875`, equal to its certified value; retention readiness true. Teardown exit 0.

## Fresh live DEV non-application confirmation

Read-only connector check at `2026-10-05T04:13:38.54042+00:00` on `leqcwgzvjsxugfgzdmth`:
- all four existing targets still have their PREDECESSOR hashes;
- close body `39fa830132d714a1cc61d3bba73d5cec`;
- certified remaining-search guard `ce59ad1cdee98518950e289aa5c329a4`;
- matcher time function `4f0beb65922d2b3d947d69e68a56a956`;
- coverage helper `5a1d10aa69cda3c3095550b6f8e4c03f`;
- no reopen overload, no new time helper and no new owner readers;
- live certificate = certified `3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23`, retention readiness true.

No live migration, RPC write, Edge deploy, cron change, account creation, notification send or physical-device action was performed.

## What still belongs to integration / application approval

The bounded server candidate is now available for owner review with concrete executed proof. It is not automatically applied by this document.

The tested reconstruction is the existing live79 -> source147 -> PKG-050 -> ex06a chain with a separately documented, byte-pinned disposable close-conflict-code alignment. It is NOT complete equivalence to every later package/configuration currently on DEV. Before any approved DEV application, recheck actual function bodies, dependency grants, current certificate and intervening changes; any mismatch is a stop, not permission to relax pins. The disposable certificate cannot be substituted for the live certificate.

Client/UI still need typed decoding, a current-state request and a separate exact-command receipt request, explicit user-triggered reopen with the original key and exact server closedAt, and stale/account-switch fencing. Startup recovery reads history only; it never calls the mutation to find out what happened. UI must use current canReopen/reason, not an old successful receipt or the phone clock, and use existing Agreement routes/actions after time passes. These APIs exist only in the tested candidate, not live DEV or the APK.

After approved server application and a compatible client build, native acceptance should prove both participant cancellations, manual closure, explicit reopen, lost-response/restart recovery, two-device reclosure, expired-time next action, existing completion, and background/locked notification landing where applicable. No such phone/provider acceptance is claimed by this server suite.

`docs/control/redovi.json` remains the sole status registry. This document is scoped evidence. No row has been promoted to DONE/PHONE PROVEN; generated control/dashboard files and hosted publication have not been refreshed in this checkpoint.
