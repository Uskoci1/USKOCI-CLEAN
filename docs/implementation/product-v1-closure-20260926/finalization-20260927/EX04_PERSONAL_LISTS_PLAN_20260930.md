# EX-04 — personal lists and Home without whole-list reads: audit and plan (2026-09-30)

Status: **PLAN ONLY. No server or client change, nothing applied.** Owner directive (2026-09-30, point 4): personal lists without client paging are NOT finished; carry them as an explicit open row (EX-04 / P2), never as done. Registry rows A09 (Moji zadaci), A11 (candidates) and B10 (Moje prijave), and the open note RC-03 on A01 (Home).

## What the client reads today (read in source, 2026-09-30)
| Screen | Reader | Shape | Used for |
| --- | --- | --- | --- |
| Home (`src/app/(app)/index.tsx`) | `mojePotrebe`, `mojePrijave`, `mojiDogovori` all whole, plus the bounded `rpc_home_attention` | full lists | task counts (`ownedTaskCounts`), application counts (`applicationCounts`), the next Agreement (an accepted FUTURE start across ALL active Agreements), the ratings-due count and its single id (`composeHome`, `src/data/homeSnapshot.ts`) |
| Moji zadaci (`src/app/(app)/potrebe.tsx`) | `rpc_list_my_tasks` | `jsonb_agg(rpc_read_task(n.id))` for every own task | the list, its sections and the attention filter |
| Moje prijave (`src/app/(app)/moje-prijave.tsx`, also the offer screen) | `rpc_list_my_applications` | every own application | the list, its tabs, the exact-row reconciliation of a pending command |
| Candidates of one task | `rpc_list_need_candidates(p_need_id)` | every candidate of that task, each with `rpc_get_public_profile` and the application evidence | comparison and selection |

The comment in `homeSnapshot.ts` already says it: the counts and the next Agreement still need complete lists; limiting the reads would lose ordering and totals; attention integration alone does not make them bounded.

## What exists on DEV (read-only, ledger 213)
- `rpc_list_my_needs_page(scope, limit, before_at, before_id)` and `rpc_list_my_applications_page(...)` since PKG-023a (keyset `(created_at, id)`, `{items, hasMore, asOf}`, scope ALL | ACTIVE | HISTORY), `rpc_list_my_agreements_page`, `rpc_list_inbox`. No client calls the first two.
- The needs page restates the pre-PKG-045 table columns by hand (no price basis, no selectable-application count): a swap would break the task card (registry A09). `rpc_list_my_tasks` is the contract the client decodes (`rpc_read_task` per task).
- The applications page has the same card fields and the same state function, but a strict newest-first order, while the current read lifts "what waits for me" to the top; it also lacks Na daljinu and the end date (registry B10, R18-E03).
- `rpc_list_need_candidates` has no paging and no limit.

## Plan (each step test-first; every server candidate proven on a disposable database before any DEV word)
1. **`rpc_home_summary()` (additive, read-only, no certificate move).** One bounded answer: own task counts {total, active, waiting, drafts, history}, application counts {total, attention, active, finished}, the next Agreement (id and the accepted start, chosen by the same rule as `composeHome`), the ratings-due count with the single id when there is exactly one, and an explicit `unknown` for a rating check that cannot be answered. Each rule is stated once in SQL from the same server functions that produce the row fields (selectable-application classifier of PKG-035, `private.my_application_state`), and **proven equal to the TypeScript rules over a mixed dataset** (the P6 parity method). Home then reads the summary plus the one Agreement it names, and keeps the existing `rpc_home_attention`.
2. **`rpc_list_my_tasks_page(scope, limit, before_at, before_id)` (additive).** Items are exactly the `rpc_read_task` document (so `mapNeed` and the card stay unchanged) plus `sortAt`; scopes ALL | ACTIVE | DRAFTS | HISTORY | WAITING (waiting = the `hasNeedAttention` rule), because the list's own sections are the same sets the Home counts name.
3. **Moje prijave:** decision already recorded in B10: a short "waits for you" section from the server attention flag above, and below it the paged list; the page gains Na daljinu and the end date as an additive contract (`rpc_list_my_applications_page` stays as it is, a v2 is added). The reconciliation of a pending command already reads its exact owned row and does not depend on the displayed list (APPLICATION_COMMAND_RECONCILIATION_20260920).
4. **Candidates:** a paged, bounded reader only after the comparison screen says how many candidates it must show at once (it compares them side by side); until then the unpaged reader stays and its row count is capped by a stated limit in the contract, never silently.
5. **Client:** services with a cursor and an account/focus-fenced owner (the Discovery owner pattern), "Prikaži još" at the list end, stale-page fencing, unknown-outcome and empty states kept; Home without the three whole reads.
6. **Order of work:** (1) first, because it removes the Home reads that run on every focus; then (2), then (3). Candidate SQL and proof workflow first, client after the owner's "primeni" for that candidate (the client can be written against the proven contract but is not wired before the server has it).

## Owner gates
Each candidate needs his separate "primeni" for DEV. No dependency, no certificate change, no payment, no change of the card or map design. The two SQL readers above are additive, SECURITY DEFINER with the same own-account predicate as `rpc_list_my_tasks`, executable by `authenticated` only.

## Not claimed
Nothing here is measured. The row counts on DEV are tiny (a handful of tasks), so the benefit is scale readiness, not a speed-up today; it must be measured on a seeded disposable database before any claim.
