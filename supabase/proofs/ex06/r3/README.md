# EX-06E R3 — verified calendar consistency and read-only owner recovery

**BOUNDED COMBINED SERVER CANDIDATE PASS / STOPPED FOR OWNER REVIEW / NOT APPLIED TO DEV.**

Verified source `6892bc16049eec3d5c009fa214e27f4cdafb91a5`, run `37262281584`, job `111611825068`, artifact `11324378558`: **39/39 offline, 22/22 disposable behavioral groups, 9/9 refusal probes**, original failure and calendar mismatch before/after revert, exact code/metadata revert, reapply, teardown exit 0. Artifact ZIP hash `dae22edf0d8683c8a729b4ba88cd3cd705e68d7dc548824775570eea6cb1c422`.

Full scoped receipt: `docs/implementation/product-v1-closure-20260926/finalization-20260927/ex06/EX06E_R3_CALENDAR_READBACK_RECEIPT_20261005.md`.

## Authority

The current authority index, full C12 reconciliation (D-0063/D-0080) and final owner review item 21 supersede the separate historical 24h replacement entitlement/window/countdown. Keep same-Zadatak missing capacity via ordinary Prijava/Selection, independent Agreements and requester search authority. Latest owner instructions require manual CLOSED to survive cancellation. Do not recreate an old entitlement system or silently extend recruitment time.

## Combined candidate

`build.mjs` composes R3 from pinned verified R2 SQL inside one transaction. Generated candidate SHA-256 `bd8c823c67c55967f0e62a8e893320897832a6f8f2248c762f9e1c3c15bf87da`; exact code revert `46df9b4931bf4a96baeda560f3afd477a69afc845c82af0dd0f269c541189042`. Use the complete generated candidate, never R2 plus hand edits.

Changes: existing dispatch_next_wave, dispatch_tick, rpc_cancel_agreement and relative_schedule_end_v5 bodies. Adds: R2 time helper/epoch-bound reopen, and two R3 owner-only read functions. No persistent schema table change, certified trigger rewrite, new event vocabulary or new execution state machine.

`rpc_get_need_search_state(uuid)` returns current coverage, manual closure, time admission, canReopen/reason and existing-flow navigation guidance. `rpc_get_reopen_remaining_search_receipt(uuid,integer,timestamptz,text,text)` reads an exact command's history and never submits/retries it. Both execute successfully inside actual READ ONLY transactions and enforce ownership. Historical success cannot overrule current closure.

The relative helper now ends WEEK_FLEXIBLE at the local calendar week boundary, matching ex06a's owner-approved meaning rather than publication +7 days. Twenty-two timezone/DST/year-boundary vectors and existing expiry behavior pass. An expired parent Need does not erase or auto-complete an independently accepted future Agreement; the owner is directed to existing Agreement actions.

## Integration boundary

No client route, APK, physical phone or provider proof is included. Current-state/receipt decoders and UI must be wired before the new command can be offered as a working mobile feature. Revert is exact code rollback, not erasure of business or command history. The tested replay chain is bounded; fresh actual DEV dependency/certificate admission is still required before any owner-approved application.

F5, isolated F10 apply, paid AI and large cleanup remain outside this package. `docs/control/redovi.json` remains the sole registry; this evidence does not mark product/phone rows complete or publish the dashboard.
