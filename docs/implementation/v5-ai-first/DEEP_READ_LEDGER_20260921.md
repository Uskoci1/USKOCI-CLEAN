# Deep read ledger — the whole codebase, semantically (started 2026-09-21)

Owner instruction, 2026-09-21: read the entire code, database, Supabase and client **semantically**, to the
deepest folder, "ne samo čitanje naslova, fajlova". Every claim that something exists, does not exist,
works or is broken must come from a function body or real data — never from a table name, a grep hit
count or a filename. This ledger exists so the read survives context limits and nothing is skipped.

## Why the order is what it is

The live server is the truth, not the migration history. 35,482 lines of migrations are a forward-only
record in which many bodies were later replaced; reading them in order would mean reading code that no
longer runs. So the server is read from `pg_proc` as it stands now.

| surface | size | read from |
| --- | --- | --- |
| live server, `private` | 245 functions, ~5.4k lines | `pg_get_functiondef` |
| live server, `public` | 235 functions (224 RPC), ~9.6k lines | `pg_get_functiondef` |
| client data layer `src/data` | 91 files, 10.6k lines | source |
| routes `src/app` | ~48 files, ~5.2k lines | source |
| screens `src/ui` | ~150 files, ~11k lines | source |
| contracts, lib, hooks, store, features | ~3.8k lines | source |
| Edge `supabase/functions` | 18 files, 3.3k lines | source (deployed copy byte-verified for uskoci-ai-interview) |
| proof harnesses `supabase/proofs` | 202 files, 30.7k lines | last — tooling, not product |

Areas are read deepest-risk first. The first is the one path never exercised by a real person.

## Areas

| # | area | state |
| --- | --- | --- |
| 1 | Agreement completion → confirmation → rating (W09/W10), server | read 2026-09-21 — see findings |
| 2 | Selection and Povezivanje (`rpc_select_response`) | read 2026-09-21 — see findings |
| 3 | Application submit and pricing by basis | pending |
| 4 | Notifications: emit → deliver → push | pending |
| 5 | AI interview Edge + review + publish | pending |
| 6 | Account, auth, closure, retention, export | pending |
| 7 | Client data layer, file by file | pending |
| 8 | Routes and screens, file by file | pending |
| 9 | HITNO | pending |
| 10 | Proof harnesses | pending |

## Findings

Each finding: where, what the code actually does, why it matters, and the evidence. Severity is
**defect** (wrong behaviour), **rule** (breaks an explicit owner decision), **risk** (correct today,
fragile), or **note** (worth knowing, no action).

### Area 1 — Agreement completion, auto-completion, need completion, rating

Read in full: `rpc_mark_work_done`, `rpc_confirm_completion`, `rpc_tick_auto_completion`,
`private.sync_need_completion`, `private.marketplace_tick`, `rpc_close_remaining_search`,
`rpc_submit_agreement_review`. Plus the `cron.job` table and `cron.job_run_details`.

**1.1 — defect. A Task whose remaining search was closed can never become COMPLETED.**
`rpc_close_remaining_search` only READS `required_slots` (to compute what is left); it writes
`remaining_search_closed_at` and never lowers `required_slots`. `private.sync_need_completion` completes a
need only when `sum(covered_slots of COMPLETED agreements) >= n.required_slots`, and does not look at
`remaining_search_closed_at` at all. `rpc_close_remaining_search` raises `NO_REMAINING_SEARCH` unless at
least one slot is unfilled — so EVERY successful close produces a need whose completed slots are, by
construction, below `required_slots`. Example: 3 wanted, 2 hired, search closed, both finish → 2 < 3 →
`sync_need_completion` returns false forever. Verified there is no other path: the only functions that
set the `COMPLETE` lifecycle token are `sync_need_completion` (setter) and `guard_need_write` (checker).
Blast radius, measured: ratings are NOT blocked — `rpc_submit_agreement_review` requires the AGREEMENT and
its execution to be COMPLETED, not the need. What breaks is the need's own state: it stays
ACTIVE/SELECTION, never reads as finished, and anything keyed on a completed need never fires for it.
Fix shape (not applied — a server change, needs owner approval): in `sync_need_completion`, when
`remaining_search_closed_at is not null`, compare against the slots actually selected rather than
`required_slots`. Never exercised: no need has ever completed on canonical DEV.

**1.2 — defect, minor. Auto-completion is silent.** When the requester confirms,
`rpc_confirm_completion` emits `EXECUTION_STATE_CHANGED` to the worker. When 48 hours pass and
`rpc_tick_auto_completion` completes the same agreement, it emits nothing. The worker is never told their
job was closed. The two paths to the same end state notify differently.

**1.3 — note. The requester can confirm completion before the worker says done, and while a problem is
open.** `rpc_confirm_completion` accepts execution state `CONFIRMED` as well as `AWAITING_REQUESTER`, and
does not check `problem_opened_at` before completing (it only reports it back as
`problemWasPreviouslyReported`). Auto-completion, by contrast, refuses when a problem is open. Probably
intended — the requester owns the decision — but the asymmetry is worth a deliberate yes.

**1.4 — note, verified. Auto-completion runs.** `cron.job` holds one job, `uskoci_marketplace_tick`, every
minute, active, calling `private.marketplace_tick(25)`, which calls `rpc_tick_auto_completion()` along with
lifecycle expiry, dispatch, export and retention maintenance. `cron.job_run_details`: 32,321 runs, all
`succeeded`, 0 failures, from 2026-08-29 23:22 to 2026-09-21 10:02. The 48-hour promise is kept.

**1.5 — note. The completion code is well built.** Both manual paths lock need → agreement → execution in
the same order (no deadlock between them), replay idempotently without a second event, refuse while an
agreement change is pending, and guard the transition with `where state=…` plus a `RACE` raise. The
auto-completion loop uses `for update skip locked` and re-checks every condition after locking.

**1.6 — rule. Copy.** `rpc_mark_work_done`: `'Završetak čeka Vašu potvrdu'` / `'Uskočer je označio Dogovor
kao završen.'`. `rpc_confirm_completion`: `'Naručilac je potvrdio završetak.'`.
`rpc_submit_agreement_review`: `'Dobili ste ocenu za završen Dogovor.'`.

### Area 2 — Selection and Povezivanje

**2.1 — note. The Povezivanje price cannot be changed by adding a version.** `rpc_select_response`
reads `policy_key='REQUESTER_SELECTION_V1' and version=1` only, refuses unless
`charge_mode='PROMOTIONAL_FREE'` and `platform_cost_rsd=0`, and writes the literal `0` into
`connection_activations.platform_cost_rsd`. A version 2 is ignored; editing version 1 to a positive
price makes every selection raise `CONNECTION_POLICY_NOT_READY`. It is a lock, deliberate and consistent
with W12 ("efektivna cena ostaje 0, bez dummy charge-a"). Charging anything means rewriting this function.

**2.2 — note, verified. 1 activation for 3 selections is correct.** The two selections without an
activation are from 2026-08-30; the policy exists from 2026-09-06; the function states that historical
rows are not charged retroactively nor given fabricated receipts. Every selection since has one.

**2.3 — rule. Formal address and banned words in user-facing text.** The same function emits
`'Vaša prijava je izabrana' / 'Otvorite Dogovor za detalje zadatka.'` and raises hints containing
`'Uskocer je izmenio prijavu. Proverite je ponovo.'`, `'Uskocer vise nema vazeci spreman profil'`,
`'Potreba je izmenjena. Pogledajte prijave ponovo.'`. Owner decisions: "ti", never "Uskočer".
