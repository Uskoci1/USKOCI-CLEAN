# EX-06E R2 — verified reopen identity and bounded Need-time hardening

**DISPOSABLE R2 PASS / NOT APPLIED TO DEV / WHOLE LIFECYCLE NOT YET APPROVAL-READY.**

Verified source `1d34a77d8c541f9ae0a291c61fb2c1444bd7bcbb`, run `37233269665`, artifact `11314587694`: 29/29 offline tests, 16/16 behavioral groups, 5/5 drift/application refusals. Original closed-search failure reproduced before the candidate and after exact code revert; reapply and final revert pass. Teardown exit 0.

Read the scoped receipt and admission limits at `docs/implementation/product-v1-closure-20260926/finalization-20260927/ex06/EX06E_R2_HARDENING_RECEIPT_20261004.md` and the proposed client readback in `CLIENT_READBACK_CONTRACT.md`. These are evidence/contract notes within the existing tracker, not a new master plan.

## Reproduction

R1 green run 37230071628 and input hashes are retained. `build.mjs` deterministically creates combined candidate.sql, revert.sql and manifest.json from frozen R1 candidate/revert/proof plus the R2 time body and scenario fragment. The generated candidate SHA-256 is `8ab4a121e9fc91f6deb23f2355da1ce854f03c1be6562bf390c3318c2640d6e8`; revert SHA-256 is `c9e38eef66667eae26fc3e106bf0e1fe56b585631c95baca067c39ec59eea253`. Do not apply R1 plus partial edits. Changed source pins or anchors fail generation.

The canonical R2 command is `rpc_reopen_remaining_search(uuid,integer,timestamptz,text,text)`, binding exact observed closedAt. Operation identity, exact shared-key locking and stored receipt validation prevent close/reopen confusion and stale first commands. The unsafe four-argument form is absent. Replays are history, not current-state readback.

Known Need-time bounds, including generic FLEXIBLE ends, use strict endpoints and a fresh clock after locks. Real blocked API calls proved expiry during both reopen and cancellation. The certified trigger and existing close command stay unchanged by the candidate; no new table or task FSM.

`align.mjs` is a strictly loopback-only replay adjustment of the old close function's single deterministic conflict code to the already-observed live PT409 body. It pins both hashes, metadata and certificate. It is not a DEV migration. The full newer DEV chain remains a separate admission check.

Revert refuses changed new bodies/grants/metadata, restores the three existing functions and removes the two new functions. It does not undo user commands or erase history.

## Still open

Accepted Agreement windows differing from the parent Need, per-allocation replacement time and the existing WEEK_FLEXIBLE +7-days expiry versus remaining-calendar-week matching discrepancy are not closed by R2. No blanket +24h revival was introduced. Client/UI current-state/receipt reads and phone/provider acceptance remain open. F5 and large cleanup remain outside this work. Any DEV change requires a later explicit owner approval.
