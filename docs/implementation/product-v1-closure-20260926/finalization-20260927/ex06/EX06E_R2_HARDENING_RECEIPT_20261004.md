# EX-06E R2 — verified reopen identity and Need-time hardening

## Result and admission boundary

**29/29 offline tests, 16/16 disposable behavioral groups, 5/5 mutation/revert refusal probes PASS. Exact code/metadata revert, original failure before and after revert, and reapply PASS. NO LIVE DEV APPLY.**

This closes the bounded R2 safety tests, not the complete product lifecycle, physical-phone acceptance or every current-DEV dependency. The full EX-06E package is not promoted to DEV approval-ready by this receipt. F5, isolated F10 application, runtime cleanup and new V1 response-deadline controls remain out of scope.

Verified source: `1d34a77d8c541f9ae0a291c61fb2c1444bd7bcbb`, tree `79c171c280eda87fe89d83c4092889db126afb6a`.
Workflow: `EX-06E R2 reopen and time hardening`; run `37233269665`; job `111527246849`; all steps including teardown and artifact preservation SUCCESS.
Artifact ID `11314587694`, name `ex06e-r2-1d34a77d8c541f9ae0a291c61fb2c1444bd7bcbb-37233269665`.
ZIP SHA-256: `88a0380d0341c2cfdf3ea46f8bde0aa9762c9a01a2f9aa9fc155873c59cbb28e`.

The ZIP was independently inspected: its digest, source binding, generated SQL hashes, every scenario group, all refusal results, before/reverted states, original-failure witnesses and teardown. This is not a verdict copied solely from the green Actions label.

## What changed compared with R1

1. A reopen command now identifies the **particular manual closure** it was meant to reopen, not only the material Need revision. Required `p_expected_closed_at` is compared under the Need lock. An unexecuted old request cannot clear a later closure.
2. Reopen request hashes and receipts identify the operation explicitly. Close/reopen ledger key collisions cannot masquerade as a successful command of the other type. The advisory lock uses the same exact separator, full stored key and seed as the inspected close function.
3. A fresh clock is sampled after a lock wait. Both cancellation and reopen refuse to restart matching when the execution boundary passed during that wait.
4. An explicit generic FLEXIBLE end is respected. Exact end is closed, including microsecond boundary cases; a generic start without an end is not silently interpreted as an end. Relative schedules require a known publication origin.
5. Code revert pins both new functions' bodies, grants, owner, arguments/defaults and execution attributes before dropping them. Later changes are refused, not overwritten.

## Executed evidence

The nine R1 scenario groups remain PASS: all five required capacity/manual-closure/reopen variants, past and future fixed windows, the existing response-deadline guard and denied direct mutation. The unaffected participant's Agreement hash stays unchanged. CLOSED plus cancellation preserves the exact closure timestamp, produces zero new target opportunity events/deliveries and does not enqueue the target. An injected stale target queue is removed without an ERROR/retry loop.

Seven additional R2 groups passed:

| Group | Observed result |
| --- | --- |
| Cross-operation close/reopen ledger collisions | Both directions refused; target state unchanged. |
| Delayed FIRST reopen after a newer closure | PT409 / STALE_SEARCH_STATE; old command not recorded; fresh command succeeds. |
| Two actual concurrent same-key reopen calls | One recorded command; one original receipt and one replay; changed payload refused; old four-argument API absent. |
| Generic FLEXIBLE explicit end | One microsecond before accepted; exact end and one microsecond after denied; a start alone invents no end. |
| Relative endpoint/missing origin | All three current relative kinds close at their helper-supplied endpoint; missing publication origin denied. |
| Reopen waits across expiry | Actual blocking backend observed via pg_blocking_pids; query began before end, lock released after end; no matching restart. |
| Cancellation waits across expiry | Same observed real database wait; coverage released but no matching restart. |

The five refusal probes are duplicate candidate, changed new helper body, changed new reopen body, changed grants and changed helper volatility. Every refusal leaves the function catalog unchanged.

Before apply, the original CLOSED/cancellation case produced one failed dispatch tick and ERROR/NEED_REMAINING_SEARCH_CLOSED. After the new code was reverted, the original failure was reproduced again on a fresh fixture. With the candidate, the target stops cleanly. Reapply and final revert also passed.

Missing demand is NOT the invitation recipient count: positive fixtures invited three candidates for one or two unfilled places. Nobody is selected automatically. In the CLOSED stale-queue group a tick also processed three unrelated synthetic tasks; the zero-opportunity guarantee is for the CLOSED target, not the entire disposable database.

## Exactly what a future combined application would change

Use only the generated R2 combined `candidate.sql`, never the older R1 candidate plus ad-hoc edits.

Candidate SHA-256: `8ab4a121e9fc91f6deb23f2355da1ce854f03c1be6562bf390c3318c2640d6e8`.
Exact code revert SHA-256: `c9e38eef66667eae26fc3e106bf0e1fe56b585631c95baca067c39ec59eea253`.
Generated behavioral proof SHA-256: `2c3dc195bff29a39d2509146941754df61d5128d0cff3c55d598dddebef3fd76`.

| Existing function | Before prosrc MD5 | R2 prosrc MD5 |
| --- | --- | --- |
| `private.dispatch_next_wave(uuid)` | `1fd8c51ef026ece24471e2f68250ecc5` | `2b58d69640ac802a5dd3fa3cef6c56d0` |
| `private.dispatch_tick(integer,timestamptz)` | `e568b033b9457736869fc5829ffc5511` | `8798cb6b6f004ecd5d88dd472cd6de0b` |
| `public.rpc_cancel_agreement(uuid,text)` | `f3ca4d5f8bdf324d5773d887d0a2d093` | `e59b8f7d3e14ebbf6f9ddd8dd63b0af7` |

New functions:
- `private.need_search_time_admitted_v1(uuid,timestamptz)`, MD5 `b830cd07c2a5db101a3a28096256a75b`.
- `public.rpc_reopen_remaining_search(uuid,integer,timestamptz,text,text)`, MD5 `ce99ef406e21fdf6d8a01c399cc1ea1c`.

No new persistent table, Need status, trigger change, policy change or new event vocabulary. Existing private command ledger reused. Existing close command and certified remaining-search trigger remain unchanged by the candidate. The four-argument reopen is absent.

Revert restores all three original bodies, removes the two new functions and verifies code/metadata identity. It **does not undo user commands or delete history**. Existing command history must survive code rollback. The disposable certificate stayed `d504b81b596800220ce48df404ad1022642dea4593c16a2404d7dd3fe0edd57e`; retention readiness stayed true; teardown exit 0.

## Failures diagnosed before this green run

- First R2 offline run `37231890024`: JavaScript string replacement interpreted SQL dollar-quoted replacement patterns and duplicated text. Fixed literal replacement with a callback; added a regression test. No database stage was reached.
- Runs `37232122839` and `37232702198`: strict dependency pin correctly refused an older replay version of the close function. Artifact `11314618142` showed only that function mismatched; the baseline itself did not change dependencies. Replacing its single old deterministic conflict code `40001` with current live `PT409` produces exactly the observed live body hash `39fa830132d714a1cc61d3bba73d5cec`.
- `r2/align.mjs` performs that **disposable-only** replay adjustment with exact before/after hashes, metadata preservation and unchanged certificate. It is not a DEV migration or part of the proposed application. The candidate pin was not relaxed.
- The close function's actual SQL newline separator was also confirmed from the raw body, avoiding a doubly escaped separator in the new shared-key lock. This is checked by an offline regression.

## Fresh live DEV boundary confirmation

Read-only connector check at `2026-10-04T20:50:24.552796+00:00` on `leqcwgzvjsxugfgzdmth`:
- all three existing target bodies are still the BEFORE hashes above;
- close body `39fa830132d714a1cc61d3bba73d5cec`;
- certified trigger `ce59ad1cdee98518950e289aa5c329a4`;
- relative helper `7164c2ba0d23a0387376fec67f7154b9`;
- no reopen overload and no new time helper;
- live certificate equals certified `3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23`; retention ready true.

No live SQL write, Edge deploy, cron change, new account, notification send or device operation was performed in this round.

## Remaining limits before whole-package admission

1. **Time semantics are not completely unified.** The tested helper is a Need-time gate. Accepted Agreement windows that differ from the parent Need and per-cancelled-allocation replacement bounds are not implemented/proved here. No blanket +24h extension was added. Also, the existing relative expiry helper still defines WEEK_FLEXIBLE as publication +7 days while ex06a matching derives the remaining local calendar week; the endpoint tests prove gating of the supplied endpoint, not equivalence of these two interpretations. Resolve this existing discrepancy before claiming complete time-lifecycle closure.
2. **Current-chain fidelity remains bounded.** The reconstruction is live79 -> source147 -> PKG-050 -> ex06a plus the explicitly pinned close-conflict alignment. It is not every newer package/configuration on current DEV. The disposable certificate is not a live certificate. Final current-chain/dependency admission is still required.
3. **Client/UI not wired.** The five-argument command requires exact observed closedAt, immutable key and validated receipts. A current owner-authoritative canReopen/time-reason projection and a read-only unknown-outcome reconciliation path remain to implement; historical command success must not override current state. See `supabase/proofs/ex06/r2/CLIENT_READBACK_CONTRACT.md`.
4. **No new phone/provider proof.** Current APK, two-user/phone full lifecycle, push background/lock/tap/ACK and release acceptance remain open.

Stop at this verified R2 checkpoint. Do not apply any candidate to DEV from this receipt. No new product decision is needed merely to prepare the remaining source/disposable checks, but any live application still needs the owner's explicit approval.

`docs/control/redovi.json` remains the sole execution registry. This receipt is scoped evidence, not a replacement tracker. No row was promoted to DONE/PHONE PROVEN; the generated control/dashboard outputs were not refreshed or published in this round.
