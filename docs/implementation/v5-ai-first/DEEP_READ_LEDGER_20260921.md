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
| 3 | Application submit, stale resolution, pricing | read 2026-09-21 — see findings |
| 4 | Notifications: emit → deliver → push, and the Edge workers | read 2026-09-21 — see findings |
| 5 | AI interview, review, publication | read 2026-09-21 — see findings |
| 6 | Account closure, data export, retention | read 2026-09-21 — see findings |
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

### Area 6 — Account closure, data export, retention

Read in full: `private.retention_maintenance`, `private.data_export_policy_binding`,
`public.rpc_request_data_export`, the start of `public.rpc_start_account_closure_execution`,
`private.closure_account_restricted`, `private.closure_assert_open`. Swept every writer of the closure
request and execution state. Evaluated both bindings live. NOT exercised: starting a closure would lock a
real account, so 6.1 is from reading, not from a run.

**6.1 — defect, serious. Asking to delete an account would lock it and never delete it.**
`closure_account_restricted` is true when the request is in `READY`, `EXECUTING`, `FAILED` or `CLOSED`, and
`closure_assert_open` raises `ACCOUNT_CLOSING` whenever it is — so the account is restricted from the
moment it is prepared (`READY`), before execution even starts. `rpc_start_account_closure_execution` moves
it to `EXECUTING` and does not finish it. Finishing belongs to `rpc_claim_account_closure_action_service`
and `rpc_finalize_account_closure_service` — service-role functions called only by the
`uskoci-account-closure-worker` Edge function, which nothing invokes (4.2). The closure binding is live and
READY (`closure_erasure_binding_v5()` is not null), so a closure WOULD start. Net: the person is locked out
with `ACCOUNT_CLOSING` on every guarded action, and their data is never erased, unless someone runs the
worker by hand. Deletion is a right a user exercises; this is the most serious finding so far. Fix is 4.2's
scheduler — for this worker it is sufficient, because its binding is ready.

**6.2 — defect. A data export is accepted, never delivered, and then blocks asking again.**
`rpc_request_data_export` never consults `data_export_policy_binding()`. It inserts `REQUESTED` and
returns it. It also refuses any new request while one is `REQUESTED` or `PROCESSING`
(`DATA_EXPORT_REQUEST_ALREADY_OPEN`). `data_export_policy_binding()` is NULL today — its first act is to
look for an active `retention_policy_sets` row and there are none — so no export can be delivered even if
a worker ran. Live: one request since 2026-09-13 18:48, 7.6 days, never updated; that account can never
request an export again. The contrast is the fix: `rpc_start_account_closure_execution` checks ITS binding
before inserting anything and refuses honestly with `CLOSURE_POLICY_NOT_READY`. The export request should
do the same with its own binding, and say plainly that export is not available yet.

**6.3 — note, verified and deliberate. Retention runs every minute and deletes nothing.**
`retention_policy_sets`, `retention_policy_rules` and `retention_jobs` are all empty, so each of the 32,321
ticks finds no job and returns. Correct as built: retention periods need counsel, and this project forbids
inventing them (AGENTS, RC2, AF-D22). The consequence to know: nothing is ever deleted automatically — data
accumulates until counsel writes a policy.

**6.4 — refinement of 4.2.** A scheduler would unblock push and account closure (their gates are open) but
NOT data export: its binding is NULL for want of a counsel-approved retention policy set. Export needs both.

### Area 5 — AI interview, review, publication

Read in full: `rpc_ai_complete_need_turn_v2_service`, `rpc_ai_apply_interview_turn_v2_service`, the
whole `validate_need_v2_fact*` chain, `rpc_publish_need_canonical`, `private.need_publication_context`,
`private.expire_lifecycle`. Swept `pg_proc` for every comparison of `starts_at` against the current time.

**5.1 — defect, live now. A job whose time has passed stays published forever.** Nothing rejects a
past start. `need_publication_context` checks country, location, media and policy — no date.
`rpc_publish_need_canonical` checks that `response_deadline` is in the future only when one is given, and
accepts none. The only function in the database that compares `starts_at` to the current time is
`urgent_activation_decision` (HITNO). And `expire_lifecycle`, run every minute, expires a need only when
`response_deadline is not null and response_deadline <= now` — it never looks at `starts_at` or `ends_at`.
So a fixed-time task published without a response deadline is neither refused nor ever expired.
Live on canonical DEV at 2026-09-21: every FIXED_WINDOW task in PUBLISHED has NO response deadline, and
three of them advertise work that is already over — 2026-09-18 10:00–13:00, 2026-09-20 06:38–09:38 and
2026-09-20 13:06–15:06 — still open to applications. The fourth (today 16:00–20:00) becomes the same after
20:00. This is not an edge case: it is what happens to every fixed-time task.
Fix shape (needs owner approval): `expire_lifecycle` also expires a FIXED_WINDOW need in PUBLISHED or
SELECTION once its `ends_at` (or `starts_at` when there is no end) has passed and nobody is selected; and
publication refuses a FIXED_WINDOW whose start is already past.

Why every task has no deadline, read in `src/app/(app)/pregled-zadatka.tsx`: the deadline is optional and
null by default; the only way to set one is a `kind="quiet"` "Uredi rok za prijave" button, easy to pass.
And when it is left empty the screen says, at line 359: **"Bez posebnog roka — do popune, zaustavljanja
potrage ili isteka zadatka."** It tells the requester the task will expire. The server never expires a task
that has no deadline. The screen makes a promise the backend does not keep, which is what makes this a
defect rather than a missing nicety. (The deadline itself is displayed correctly, pinned to the task's own
timezone at line 358.)

**5.2 — note, verified. The AI is not a hole in the wall.** Every proposal from the Edge is re-checked on
the server in `rpc_ai_apply_interview_turn_v2_service`: the key must be in `need_fact_registry`, the value
goes through the full `validate_need_v2_fact` chain, `need.resolved_location` and `need.public_photo_paths`
are refused outright (`LOCATION_EDITOR_REQUIRED` — the AI can never set an exact place or a photo), at most
12 proposals, and a `BLOCK` turn may persist none. Every AI fact is written `NEEDS_CONFIRMATION` /
`AI_INFERENCE`: the model proposes, only a person confirms.

**5.3 — note, verified. The validator chain reaches the price-basis rule.** `validate_need_v2_fact` →
`_pre_country` → `_pre_location` → `_pre_fastest_retirement`, where `need.price_basis` is checked. Built
as four wrappers, each migration wrapping the previous instead of editing it; the `pre_X` names mean "the
version from before X was added", which reads backwards. Works; costs a reader a minute.

**5.4 — note. A turn that arrives after the conversation changed is thrown away, not applied.**
`rpc_ai_complete_need_turn_v2_service` compares the context hash taken when the turn was dispatched with
the current one; if a person corrected a fact while the model was thinking, the turn is marked FAILED
rather than overwriting the correction.

**5.5 — note. The publication gate is the best-built function read so far.** What is published is exactly
what was evaluated: the canonical fingerprint, private materiality marker, public geography, public media,
policy bundle, policy version, jurisdiction and every rule's provenance must all match the ALLOW decision,
and that decision must be the latest for the revision. It re-checks the policy and the deadline against
`clock_timestamp()` just before writing, and refuses to leave a published need without a dispatch schedule.

### Area 4 — Notifications: emit → deliver → push, and the Edge workers

Read in full: `private.emit_event`, `supabase/functions/uskoci-push-transport/index.ts` (155 lines). Swept:
every push RPC, every function mentioning the push sender, `pg_extension`, `cron.job`, every
`.github/workflows/*.yml` for `schedule:`, and the deployed Edge list.

**4.1 — defect. Push is OFF by default, per role, so turning it on once turns it on for one role.**
`emit_event` looks up `notification_preferences where user_id = p_recipient and role_context = p_role`;
when no row matches it sets `push_enabled := false`. Every one of the 7 PUSH deliveries ever created was
`SUPPRESSED / PUSH_OFF` for exactly this reason — the recipient had no row for the role the event was sent
to. The account that enabled push holds a single row, `WORKER=true`; the three events it received AS A
REQUESTER — `RESPONSE_RECEIVED`, `MESSAGE_RECEIVED`, `COMPLETION_REQUIRED`, the ones a requester most needs
— were each suppressed. A person who switches notifications on reasonably expects them on. Fix shape:
default a missing role row to the account's other role's choice, or create both rows when push is enabled.

**4.2 — defect, systemic. Three deployed Edge workers have nothing that runs them.**
`uskoci-push-transport` (ACTIVE, v11), `uskoci-data-export-worker` (ACTIVE, v12) and
`uskoci-account-closure-worker` (ACTIVE, v1) each process a queue and must be invoked on a schedule. Nothing
invokes them: no database function references them; `pg_net` is not installed, so the database cannot call
Edge at all; the only `cron.job` is `uskoci_marketplace_tick`, which is database-only; and no GitHub workflow
has a `schedule:` trigger — the workers appear only in proof workflows and CI scope scripts. Evidence in the
data: `push_runtime_readiness` has never been written (the sender writes it on every tick and probe); one
data export has sat in `REQUESTED` since 2026-09-13 18:48 — 7.6 days, never updated. No account closure has
ever been requested, so that worker is unobserved, but it has the same shape and the same missing trigger.
The data export is a right a user exercises; a request that is never processed is a promise the product
does not keep. Fix shape: a scheduler for the workers — `pg_net` + `pg_cron` calling each with the service
role, or a platform schedule — plus the `EXPO_PUSH_TRANSPORT_ENABLED` switch (see 4.4), which is a secret and
could not be read from here.

**4.3 — rule. The one push text that would ever reach a phone is formal.** `uskoci-push-transport`
line 108 sends, for every event, `title: 'USKOČI', body: 'Imate novo obaveštenje. Otvorite aplikaciju.'`.
The generic body is deliberate — no recipient, payload or URL leaves the server — but it breaks the owner's
"ti". `src/ui/notifications/PushRuntime.tsx` already recognises both `'Imate …'` and `'Imaš novo obaveštenje.
Otvori aplikaciju.'`, so the sender can move to the informal wording without breaking recognition of pushes
already queued.

**4.4 — note. The sender itself is well built and would work if run.** A master switch
(`EXPO_PUSH_TRANSPORT_ENABLED === 'true'`; otherwise a tick returns `DISABLED` with no DB or provider I/O),
service-role-only, one run at a time, lease-based claim → begin → complete, literal provider URLs with no
redirects, receipts checked on a later tick, no blind resend on an unknown outcome, and no provider message,
token or address ever logged or returned.

**4.5 — correction of the assistant's own earlier claims, kept on the record.** On 2026-09-21 the assistant
said "the sender never ran" from an empty `push_runtime_readiness`, and read `PUSH_OFF` as the user's switch.
The first was true for a reason it did not know (4.2 — nothing runs it); the second was wrong (4.1 — it is
the per-role default, and the user's switch was on). Both were claims from a table, made before the code
was read.

### Area 3 — Application submit, stale resolution, pricing

Read in full: `rpc_resolve_stale_response_after_need_edit`; the price section of `rpc_submit_response`;
and a sweep for every function that writes a response's price.

**3.1 — defect. The price rules hold on one door and not the other.** Exactly two functions write a
response's price (verified by sweeping `pg_proc` for inserts into `marketplace_response_versions` and for
price assignments; a third hit, `rpc_confirm_need_edit_from_review`, sets the TASK's price and is not a
response writer):

| rule | `rpc_submit_response` | `rpc_resolve_stale_response_after_need_edit` |
| --- | --- | --- |
| price > 0 | yes | yes |
| MY_PRICE, null basis: price = task price (`FIXED_PRICE_MISMATCH`) | yes | **no** |
| PER_PERSON: price = per-person × covered | yes | **no** |
| TOTAL: must cover all slots, price = total | yes | **no** |
| covered ≤ REMAINING slots | yes | no — checks ≤ `required_slots` |
| covered ≤ team capacity | yes | no |

The last two are caught later: `rpc_select_response` re-checks `OVERFILL` and `TEAM_CAPACITY_EXCEEDED`.
The price is NOT: `rpc_select_response` copies `v_ver.price_rsd` straight into the Agreement terms without
comparing it to the task. So on the stale path the fixed-price guarantee and both basis rules are simply
absent, and what the worker enters is what the Agreement is made at if the requester selects it.

Reachable through the normal flow: the requester edits a published task → `rpc_confirm_need_edit_from_review`
bumps the revision → open applications become `STALE_REVIEW_REQUIRED` → the worker chooses `UPDATE` and
may enter any price > 0, or `KEEP` and retain a price that no longer matches the task's edited fixed price.
The requester sees the offered price before selecting, so this is not silent — the requester is the last
check — but it is exactly the check `FIXED_PRICE_MISMATCH` exists so they do not have to make.

**Owned:** pkg025b (2026-09-20) added the PER_PERSON and TOTAL rules to `rpc_submit_response` only. The
gap existed before — the stale door never enforced the fixed price — but that change made it wider: the
price-basis feature protects one of the two doors that write the price.

Fix shape (not applied — needs owner approval): move the price rule into one private function both
writers call, with the same inputs (task mode, basis, requester price, required and remaining slots,
covered, price), and have `rpc_select_response` re-assert it against the current task before copying the
price into the terms, so a price that went stale cannot be selected into an Agreement.

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
