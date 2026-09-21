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
| 7 | Client data layer, file by file | PARTIAL 2026-09-21 — server claims checked against the client; full per-file read owed |
| 8 | Routes and screens, file by file | pending |
| 9 | HITNO, categories, matching | read 2026-09-21 — see findings |
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

### Area 7 — Client data layer (PARTIAL — see scope)

**Scope, stated plainly.** Not yet read file by file. What was read in full: `src/data/serverReceipt.ts`
(the error pipeline every RPC call goes through), the error map of `applicationSelectionClientService.ts`,
`ru4Production.resolveChangedApplication`, `moje-prijave.tsx` and the edit form in
`MyApplicationsPresentation.tsx`, the data export screen, `notificationPreferencesClientService` and
`PushPreferences.tsx`. Chosen because each server finding above made a claim about what a PERSON sees,
and a server read cannot establish that. Two of those claims turned out to be wrong (7.2, 7.4). A full
read of all 91 `src/data` files is still owed.

Files read in full since, one section each below: `agreementClientService.ts`, `supabaseIzvor.ts`,
`aiNeedV2Production.ts`, `aiTaskReviewClientService.ts`, `aiNeedV2Ui.ts`, `agreementOutbox.ts`, `index.ts`, `ports.ts`,
`supportCaseClientService.ts`, `needClientService.ts`, `homeSnapshot.ts`, `marketplaceView.ts`, `candidateClientService.ts`,
`workerAiClientService.ts`, `aiProductionOverrides.ts`, `aiCommandOverrides.ts`, `productionAuthorityOverrides.ts`,
`applicationSelectionClientService.ts`, `reviewsClientService.ts`, `publicProfileClientService.ts`,
`legacyRpcFailure.ts` (the fixed 39-code copy table the older adapters share; anything else becomes the
caller's constant fallback, never a server string).

**7.1 — risk. An unmapped refusal is shown as "maybe it happened, retry".** `readOwnedResult` never shows a
raw server code — an unknown code falls to `unconfirmed()`, deliberately. For a write that message is
"Ishod radnje nije potvrđen. Osveži prikaz pre ponovnog pokušaja…". That is right for a timeout and wrong
for a business refusal: the server did not fail to answer, it answered no, for a known reason. The server
can raise 348 distinct codes across 175 client-callable RPCs. The submit/select path maps every business
refusal checked, including `FIXED_PRICE_MISMATCH`, `TOTAL_PRICE_REQUIRES_ALL_SLOTS`, `UNKNOWN_PRICE_BASIS`,
`OVERFILL`, `TEAM_CAPACITY_EXCEEDED`, `CONNECTION_POLICY_NOT_READY`. A per-call audit of all 175 is owed.

**7.2 — correction of 6.2.** The export screen offers "Otkaži zahtev?" on a `REQUESTED` export and says
"Priprema kopije trenutno nije dostupna. Tvoj zahtev ostaje zabeležen." when preparation is refused, and
`DATA_EXPORT_REQUEST_ALREADY_OPEN` is mapped. The person is not locked out — they can cancel and ask again.
The defect that remains is accepting a request that cannot be fulfilled.

**7.3 — confirmed end to end: 3.1 is reachable from the app.** When a published task is edited, My
applications offers UPDATE on the now-stale application, with a free editable `TextInput`
"Cena ponude (RSD)" (`MyApplicationsPresentation.tsx:144`). `moje-prijave.tsx:159-160` checks only that it
is a positive integer. The first submit locks the price on both client and server; this door is open on
both.

**7.4 — correction of 6.1.** Preparing sets `NOT_READY` or `BLOCKED`, which are not restricted; the lock
begins at the explicit "delete" confirmation (`EXECUTING`). The unfinished-deletion defect stands.

**7.5 — confirmed: 4.1 is live in the client.** `PushPreferences({ role })` reads and saves exactly one
role (`save(scope.accountId, scope.role, …)` at lines 105, 115, 131). Turning push on in one role's screen
never writes the other role's row, and the server defaults a missing row to off.

**7.6 — note. One refusal message will mislead under the new price basis.** `FIXED_PRICE_MISMATCH` reads
"Cena Zadatka je promenjena." Under PER_PERSON the usual cause is an amount that is not per-person ×
covered, not a changed price.

**7.7 — rule.** `PushPreferences.tsx:181` promises "prikazujemo samo da imaš novo obaveštenje"; the sender
sends "Imate novo obaveštenje. Otvorite aplikaciju." (4.3).

#### `src/data/agreementClientService.ts` — read in full (605 lines)

**7.8 — risk, partly the assistant's own. One agreed instant is now rendered two ways.** `acceptedSchedule`
shows the Agreement's accepted window in the VIEWER's device zone (`needScheduleText(…, viewerZone())`),
with a comment explaining that UTC had printed every Belgrade window two hours early. Earlier the same day
the assistant added `src/lib/dogovorenoVreme.ts`, which pins a worker's proposed start to Europe/Belgrade.
A proposal becomes the Agreement's accepted window on selection, so the same instant now reads pinned on
the application screen and device-local on the Agreement. They agree for anyone in Belgrade's offset and
differ for anyone outside it. Both policies are defensible; applying both to one value is not. The right
answer is the task's saved timezone for both — which neither payload carries yet.

**7.9 — note, verified not a defect.** `mapAgreement` reads the state from `raw.status` and chat
availability from `raw.agreementStatus`. Suspected that one might be absent and chat silently hidden.
Checked both feeding RPCs: `rpc_list_my_agreements_page` and `rpc_get_agreement_workspace` each send both
keys. Not a defect.

**7.10 — rule, minor.** When the user's own name is missing the avatar falls back to initials `'VI'` —
formal — while the name beside it falls back to `'Ti'`.

**7.11 — note.** `const amount = Number(terms.price_rsd ?? 0)` shows "0 RSD" for a missing price, where the
rest of this file fails closed to null. Unreachable today: `rpc_select_response` always writes `price_rsd`.

**7.12 — note.** The Agreement's chronology is always one line, "Dogovor kreiran". Work marked done,
completion and change decisions never appear in it.

**7.13 — note, well built.** The completion receipt is decoded strictly (own agreement, `COMPLETED`, a real
instant, authoritative); the paged list refuses at 20 pages instead of truncating silently; action
capabilities are bound to the exact agreement, version and account and fail closed; the change and
problem flows each carry their own mapped refusals.

#### `src/data/supabaseIzvor.ts` — read in full (354 lines), with the server functions it leads to

**7.14 — note. Two port methods have no screen behind them.** `supabaseIzvor.otkaziDogovor` and
`potvrdiCinjenicu` are called only by the fake source and tests. The cancel the app really runs is
`agreementClientService.ts:439`, from `AgreementActionsScreen` ("Otkazivanje Dogovora"). The bare
`'Greška.'` fallback in both is therefore never shown. Dead code, not a defect.

**7.15 — defect, server. The cancellation reason the app demands is thrown away.** The app requires
"Razlog otkazivanja" (1–4,000 characters) and `rpc_cancel_agreement` refuses an empty one
(`REASON_REQUIRED`). Then the body never writes it: `public.agreements` has 12 columns and none is a
reason; the event payload is `{agreementId, state}`; the other party reads a fixed "Druga strana je
otkazala Dogovor." Nobody — not the counterpart, not support — can ever see why. By contrast
`rpc_close_remaining_search` does store its reason.

**7.16 — risk, server; needs an owner decision. The requester can cancel after the worker says the work
is done.** `private.agreement_action_state` sets `canCancel` for status `CONFIRMED` and execution
`CONFIRMED` **or `AWAITING_REQUESTER`**, and `rpc_cancel_agreement` refuses only `COMPLETED`. So once the
worker taps "gotovo", the requester is offered both "Potvrdi završetak" and "Otkaži Dogovor". Cancelling
stops the 48-hour auto-completion (it needs status `CONFIRMED`), leaves the worker with no completed job
and no right to rate (rating requires `COMPLETED`). The worker's only path is the problem flow. Also:
the cancel does not bump the agreement version, and neither the body nor any of the 8 triggers on
`agreements`/`agreement_execution` touches a pending change proposal — it stays recorded as pending,
inert because answering requires `CONFIRMED`. The closure guard does apply (trigger
`pre_v3_closure_agreement`).

**7.17 — risk, server. The table, not the allowlisted reader, is the privacy boundary for a public
task.** The list reader `rpc_list_open_tasks_v3` returns a narrow allowlist on purpose. But RLS policy
`needs_public_discovery` lets every authenticated same-world account `SELECT` any `PUBLISHED`/`SELECTION`
need, and `authenticated` holds `SELECT` on **all 42 columns** — including `requester_account_id`,
`remaining_search_closed_by_account_id`, `remaining_search_close_reason` (free text, up to 500
characters), `public_photo_paths` and `urgent_policy_version`. The app itself reads only the columns it
shows (`prilika()` names them), so nothing leaks on screen; the exposure is anyone calling the REST API
with their own session. Measured: 12 needs readable this way; 0 close reasons and 0 closed searches exist,
and the app never sends a close reason (`ru4Production.closeRemainingSearch` defaults it to `''`), so
today no free text is exposed. Also: closing the remaining search does not change status, so a closed
search stays in this policy. Fix shape (not applied): column grants on `needs` for `authenticated`, or a
detail reader like the list's.

**7.18 — note. The list ignores the server's own "accepts applications".** `rpc_list_open_tasks_v3`
computes `acceptsApplications` (free slots and a deadline still ahead) and does NOT filter out tasks whose
response deadline has passed. `openTaskRow` drops that field, and the list labels every row
`r.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude'` — `ACTIVE` is never returned (the reader selects only
`PUBLISHED`/`SELECTION`), so every row, including a past-deadline one, says "Traži ponude". The detail
screen is correct: `primaNovePrijave` checks the deadline and `prilike/[id].tsx` re-checks it on a timer
before allowing an application. Neither checks a past start — that is 5.1.

**7.19 — note. The Agreement conversation.** Every bubble's time is
`new Date(iso).toLocaleString('sr-Latn-RS')` — the default format, which includes the full date and
seconds. The other party is labelled "Sagovornik", never by name, although the workspace carries the
counterpart's name. The read has no limit: all messages of the agreement, ascending. No row ceiling is set
in the database role configuration; the Supabase API's own row ceiling is a project setting not readable
from SQL. If one applies, a long conversation would lose its NEWEST messages, silently, because the
order is ascending. Not reachable with today's data.

**7.20 — note, well built.** `poruke()` binds the read to the account before and after the query and
validates every row strictly; `prilika()` refuses malformed capacity, deadline and closure instants
instead of guessing; the open-task walk is keyset-paged and refuses at 25 pages rather than truncating;
task relations are read in bounded batches of 100 and fail to "no label", never a wrong one.

#### `src/data/aiNeedV2Production.ts` (434 lines), `aiTaskReviewClientService.ts` (256), `aiNeedV2Ui.ts` (298) — read in full, with every server function they call

Which path is live, read from the call sites: a screen opens, loads, sends, recovers, cancels and
abandons through `aiNeedV2Production`, and corrects facts through it; it saves and publishes ONLY through
`aiTaskReviewClientService` (`prepare` → `accept` → evaluator Edge → `publish`). `rpc_accept_ai_task_review`
does the saving itself: it confirms every current non-location fact, then calls
`rpc_save_need_draft_from_review` for a new task or `rpc_confirm_need_edit_from_review_v2` for an edit.
`aiNeedV2Production.saveDraft`, `confirmEdit` and `readTurn` have no caller outside tests.

**7.21 — defect, live path. Three refusals a person causes are shown as "Ishod radnje nije potvrđen".**
The accept path can refuse with codes raised by the functions it calls, and `aiTaskReviewClientService`'s
copy table maps none of these three:
- `NO_MATERIAL_CHANGE` — open "Izmeni" on a task, change nothing, save. `rpc_confirm_need_edit_from_review`
  compares snapshots and refuses.
- `MY_PRICE_AMOUNT_REQUIRED` — price mode "Moja cena" with no amount.
- `FIXED_WINDOW_BOUNDS_REQUIRED` — "Tačan termin" without a start, without an end, or ending before it
  starts.

`rpc_prepare_ai_task_review` computes `canAccept` from required facts only — it never looks at the price
mode or the window — so the button is live and the refusal comes after. The person reads "Ishod radnje
nije potvrđen. Osveži prikaz pre ponovnog pokušaja; za ponavljanje koristiš isti zahtev.", refreshes,
presses again, and gets the same. Measured: of 77 intake conversations, 1 has "Moja cena" with no
amount and 1 has "Tačan termin" without both bounds. The right copy already exists — in
`aiNeedV2Production.ERRORS`, which only the dead `saveDraft`/`confirmEdit` use. Client-only fix: map the
three codes on the live path. (The orphaned `NO_MATERIAL_CHANGE` copy is also ungrammatical — "Nisi
promenili nijedan podatak." — and must not be moved as is.)

**7.22 — defect. "5.000" becomes 5.** A number correction runs
`Number(text.replace(/\s/g,'').replace(',', '.'))`. The dot is the Serbian thousands separator. Measured
with node: "5.000" → 5, "15.000" → 15, "5,000" → 5, "1.500" → refused as not whole; only "5 000" and
"5000" are read right. The saved fact is 5 RSD with the display text "5.000". The review shows the value
("5 RSD"), so it can be caught — but nothing warns. Same parser for number of people and years.

**7.23 — defect. A description longer than 1,000 characters cannot be corrected.** The description may be
6,000 characters (server validator and both client decoders agree). `correctionFromText` sends the whole
text as the display value; `correctFact` refuses any display over 1,000 (the column is capped at 1,000
too) with "Unesi ispravnu vrednost." The text box has no `maxLength`, so nothing tells the person where
the limit is or why. Fix shape: for TEXT facts send a shortened display, keep the full value.

**7.24 — risk, concrete instance of 7.1. Out-of-range corrections read as "maybe it happened".** The
client checks only "whole number" and "not empty". The server validator refuses price below 1 or above
100,000,000, people 0 or above 50, experience above 60, title above 140, category above 120, address
above 1,000, access notes above 2,000 — as `V2_PRICE_INVALID`, `V2_PEOPLE_INVALID`, … — and none is
mapped, so "0", "-3" or a 150-character title all end in the unconfirmed message. The same map has two
names the server never raises: `FACT_SUPERSEDED` (the server raises `SUPERSEDED`) and
`DRAFT_SAVE_BLOCKED_BY_SAFETY` (the server raises `AI_NEED_DRAFT_BLOCKED`). Also unmapped:
`CONVERSATION_CLOSED`, `CONVERSATION_NOT_EDITABLE`, `LOCATION_EDITOR_REQUIRED`, `CONFIRMED_PROVENANCE_INVALID`.

**7.25 — rule. Raw internal tokens in a sentence.** When publication is refused for an unconfirmed place,
`notReadyCopy` prints the evaluator's slot names verbatim: "Lokacija nije potvrđena na mapi (start, end)."
— or "waypoints/0", "serviceArea". `aiNeedV2Ui.slotLabel` already turns these into "Polazište",
"Odredište", "Stanica 1", "Područje".

**7.26 — note. Editing a published task takes it off the market.** `rpc_confirm_need_edit_from_review`
writes the task back to `DRAFT`, deletes its dispatch schedule and returns `requiresReadmission: true`;
it must be published again, and its applications go stale (3.1). Consistent with V5's re-admission rule;
worth knowing because nothing in the edit entry point says so.

**7.27 — note, verified not a defect.** The client decoders are all-or-nothing, so any value the server
stores but a decoder refuses would make a whole conversation unreadable. Checked every fact rule against
`private.validate_need_v2_fact*` and the `ai_structured_facts` constraints: the 23 registry keys, their
types, integer ranges, text lengths, list limits (50 × 500), timestamp pattern and enum sets agree; the
client is stricter only on control characters and on Unicode-only whitespace. Measured on 739 stored
facts: 0 with control characters, 0 display values over 1,000, 0 with a null display (the server's
fallback to raw JSON is never used). Edge caps (12 facts, 1,200-character reply) sit inside the client's
(12, 1,500). The review safety fallback (`REVIEW` when no assistant message) matches the client's.

#### `src/data/agreementOutbox.ts` (282 lines) and `src/data/index.ts` (77) — read in full

`index.ts` composes the production source by spreading 13 services over `supabaseIzvor`, later ones
winning; checked that none of them redefines `prilika`, `otvorenePrilike`, `poruke`, `otkaziDogovor`,
`potvrdiCinjenicu` or `mojRadnikProfil`, so the readings in 7.14–7.19 are the ones that run. The fake
source is reachable only in tests or with `EXPO_PUBLIC_USE_FAKE_SOURCE=1`; a missing Supabase
configuration throws instead of falling back.

**7.28 — risk. What the phone keeps after logout, and after an account is closed.** The outbox stores,
per account and Agreement, every pending message and up to 50 sent ones — their full text — in
AsyncStorage under `uskoci:agreement-outbox:v1:<account>:<agreement>`. Nothing ever removes that key: not
when the Agreement ends, not at logout (`signOutLocal` only calls `auth.signOut({scope:'local'})`; the
session store clears no storage), not after an account closure. The same holds for the other journals
(application commands, AI turn intents, support and safety drafts) except the few that delete their own
entry on completion; only the return target is cleared by the auth flow. Another account on the same phone
cannot read these through the app — every key and every read is bound to the account id — but the text
stays on the device. The 2026-09-02 draft legal constitution lists, as an Auth proof requirement,
"logout clears sensitive local intent/workspace state".

**7.29 — note, well built.** The outbox serialises every read-merge-write per key across remounts,
never replays a send by itself, turns a lost answer into "unknown" instead of "failed", refuses a key
reused for different text or photos, reconciles against the server's own rows by client key, sender, text
and photos (never by text alone), and caps pending intents at 50 so failed storage cannot grow memory.

#### `src/data/ports.ts` (251 lines) — read in full; its promises checked against the server

**7.30 — note, verified.** The port comments make four behavioural promises, and each holds on the live
server: cancelling frees only that one Agreement's slot (M06, `rpc_cancel_agreement`); marking work done
opens a 48-hour window (M07); an open problem blocks auto-completion (M07, `rpc_tick_auto_completion`);
a shared phone or location lasts until revoked or until the Agreement ends (OD-12). The last one was
checked closely because no completion path revokes grants — only cancel, task cancel and the owner's own
revoke do. It still holds: `rpc_reveal_contact` refuses unless the Agreement is `CONFIRMED`, so after
completion the grant row stays `GRANTED` but nothing can read it. Stale: `poreklo`'s comment still says
"'lazni' dok ne odobrimo Supabase".

#### `src/data/supportCaseClientService.ts` (221 lines) — read in full, with the `rpc_support_*` functions

**7.31 — note, product fact. Support has nobody to answer it.** Every refusal the support functions can
raise is mapped (the one exception, `SUPPORT_HISTORY_IMMUTABLE`, is a table guard no command reaches).
Submissions are journalled on the device, never replayed, and recovered by one canonical read. But the
operator is a single row in `private.support_operator_grants_v5`, granted only by the service-role
function `rpc_support_set_operator_service_v5` — and that table is empty. `rpc_support_capabilities_v5`
returns `operatorAvailable` meaning "the caller is the operator", so a person is never told nobody is on
the other side. Measured: 0 operators, 0 cases, 0 events, 0 decisions ever. The screens promise no reply
time, which is right while this is so. The operator-only "Bezbednosni predmeti" inbox has the same
empty reader.

#### `src/data/needClientService.ts` (179), `homeSnapshot.ts` (168), `marketplaceView.ts` (68) — read in full

**7.32 — defect, latent. "N prijava · čeka tvoj izbor" counts applications there is nothing to choose
from.** `brojPrijava` is the length of the embedded `marketplace_responses(id)`, and the requester's RLS
policy (`responses_requester_read`) returns every response except `DRAFT` — withdrawn, expired,
not selected and already selected ones included. That one number drives the task's state
(`PUBLISHED` + any response → "Čeka prijave"), the attention flag (`hasNeedAttention`: open slots and
count > 0), the Home card "2 prijave · čeka tvoj izbor", the list's "2 prijave · pogledaj" and the task
screen's "2 prijave za pregled" with its count pill. Two ways to reach it: a worker withdraws from a
published task; or a three-person task gets two workers selected — then it shows "2 prijave · čeka tvoj
izbor" while nobody is waiting. Not visible today: the 5 responses on DEV are 3 `SELECTED` on `ACTIVE`
tasks (which read as "Popunjen" and raise nothing) and 2 `SUBMITTED`. The server aggregate for exactly
this, `pkg023j`, is installed and not wired (AGENTS.md).

**7.33 — note.** Otherwise the Home is composed carefully: each of the three reads fails alone and says
so instead of reading as empty; attention is ordered completion to confirm, open problem, changed task
under my application, then my tasks; Agreements are ordered by start; nothing consults an app-wide mode.
`needClientService` refuses an unknown status, a malformed category, schedule, country or timezone, and a
window whose end is not after its start. Its two failure paths throw the raw PostgREST `error.message`;
whether a screen prints it is for the screen read (Area 8).

#### `src/data/candidateClientService.ts` (148) and `workerAiClientService.ts` (176) — read in full

**7.34 — rule. Counts on the candidate card skip Serbian plural.** `recenzijeTekst` is
`` `${reviews} recenzija` `` or `` `${completed} završenih` ``: "2 recenzija", "3 recenzija", "1 završenih".
`src/ui/system/plural.ts` exists for exactly this and its guard test does not catch a string template.

**7.35 — note, well built; one mismatch.** The worker profile conversation is decoded as strictly as the
task one, and its limits were checked against `private.worker_ai_patch` and `worker_ai_document`: the
server returns the latest 100 messages in ascending order and the client refuses more than 100 or any
out of order — they agree. One difference: the client measures `displayName` (160) and `bio` (4,000)
with `string.length`, which counts UTF-16 units, while the server's `length()` counts characters. A bio
near the limit written with many emoji is accepted by the server and refused by the client decoder,
which would make the whole profile conversation unreadable. Not measured in data; unlikely.

#### `aiProductionOverrides.ts` (151), `aiCommandOverrides.ts` (58), `productionAuthorityOverrides.ts` (42) — read in full

**7.36 — note, verified safe. The whole V1 AI port is dead, and its server doors are shut.** No screen
calls `razgovor`, `otvoriRazgovor`, `posaljiKorisnikovuPoruku`, `ispraviCinjenicu`, `objaviPotrebu` or
`posaljiPoruku`; these three files exist to satisfy the `Izvor` interface. Two of them still reach live
RPCs, so the server side was read: `rpc_ai_publish_need` raises `PACKAGE_4_NOT_READY` unconditionally;
`rpc_ai_correct_fact` (V1) writes any text into any fact without the V2 validator — but the trigger
`guard_ai_fact_schema` refuses a V1 fact in a V2 conversation (`AI_FACT_SCHEMA_MISMATCH`), and the same
trigger runs `validate_need_v2_fact` on every V2 insert, so no path can store a V2 fact the validator
would refuse. (That trigger is also why 7.27 found the stored data clean.)

#### `applicationSelectionClientService.ts` (133), `reviewsClientService.ts` (103), `publicProfileClientService.ts` (74) — read in full

**7.37 — rule. "2 ocena".** `accountReputationLabel` prints `` `${reviewCount} ocena` `` — right for 1, 5
and 11, wrong for 2–4 ("2 ocene"). It also formats with `'sr-RS'` where everything else uses
`'sr-Latn-RS'` (same digits and comma; no visible difference). Every refusal the three review functions
raise is mapped; a rating is 1–5 with at most three tags from a catalog the client checks byte-for-byte
against the server's.

**7.38 — note, well built.** Submit and select validate their command before sending and decode the
receipt against it (the submitted slots, the need revision, a content hash, the snapshot schema);
`readSelectedAgreement` binds the link to the selecting account and treats "not visible" as unknown, never
as absent. The public profile read throws on any inconsistency between review count, average and the
availability flags instead of showing a guessed rating.

### Area 9 — HITNO, categories, and matching

Read in full: `private.urgent_activation_decision`, `private.match_detail_without_calendar`, the
`private.marketplace_config` rows. Measured: every stored category, the skills on open tasks and active
worker profiles, `dispatch_rounds` and `opportunity_deliveries`. Computed: `match_detail_without_calendar`
for every open-task × active-worker pair (it is STABLE and read-only).

**9.1 — note, deliberate. HITNO is switched off, and says why.** `urgent_activation_policy` is
`enabled: false`, `allowedCategories: []`, `chargesFee: false`, with its own note: *"O-2 blokada: bez
kanonskog registra kategorija allowlist ostaje prazan i HITNO je ugašeno."* HITNO can only be admitted for
listed categories, and there is no stable list to put in it. The decision function itself is sound: no
remote tasks, not once filled, not if the start has passed or is more than `maxMinutesToStart` (default
360) away — the only function in the database that guards a start time.

**9.2 — defect, root cause. Categories are whatever the model wrote.** 18 tasks carry 10 spellings, several
of one thing: `transport_selidbe`, `Selidbe i transport`, `Prevoz`, `transport_and_assembly`;
`Moleraj`, `MOLERSKI_RADOVI`; and `"Fizički poslovi"` stored with the quotation marks inside it. Serbian
and English, snake_case and SCREAMING_CASE. This is what blocks 9.1, and the display already carries a
band-aid (`readableCategory` in `NeedPresentation`) that can tidy a spelling but cannot merge synonyms.
Fix shape: give `need.category` a closed list, the way `need_fact_registry` closes the fact keys.

**9.3 — risk, measured. Matching compares free text exactly, so exclusions leak.** Category is used in one
place in matching: a worker's `exclusions` overlapping the task's category or required skills is a hard
block (`PROFILE_EXCLUSION`). Overlap is exact after lowercasing, so a worker who excluded `selidbe` is still
offered `transport_selidbe`. Positive matching is by skills, also exact: active workers hold `electrician`
and `plumber` (English), `Ciscenje stana` and `Fizicki poslovi` (no diacritics), `montaža nameštaja` (with)
— a task needing `čišćenje stana` would not meet a worker with `Ciscenje stana`. Not biting today (10 of 12
open tasks require no skills), but it will as soon as they do.

**9.4 — note, explained by computation. Why "a new task for you" fired once.** `dispatch_rounds`: 48
`STOPPED / NO_ELIGIBLE_CANDIDATES`, 1 `EXPIRED`; one opportunity delivery ever. Running the matcher over all
48 open-task × active-worker pairs: 27 may apply by hand, **0 are eligible for automatic dispatch**.
Soft blockers: `OUTSIDE_AVAILABILITY` 41, `CURRENT_AVAILABILITY_PAUSED` 33, `OUTSIDE_PREFERRED_RADIUS` 24,
`SERVICE_NOT_IN_WORK_PROFILE` 8. Hard: `MISSING_REQUIRED_VEHICLE` 13, `OWN_NEED` 12. The matcher is right;
the workers have not declared availability covering these times. The product consequence is the finding:
proactive notification of new work depends entirely on workers keeping an availability calendar current,
and nothing prompts them to. The earlier suspicion that categories broke matching was wrong, and was
narrowed step by step against the code and the data rather than reported.

**9.5 — note. The matcher is well designed.** Hard gates (active profile, not own task, identity, tools,
licences, vehicles, experience, exclusions) block even a manual application; soft gates (availability,
notification preferences, radius, minimum fee, service) block only automatic dispatch, so manual search
stays open. Scoring weights 30/25/15/15/10/5 with a newcomer fairness term.

### Area 6 — Account closure, data export, retention

Read in full: `private.retention_maintenance`, `private.data_export_policy_binding`,
`public.rpc_request_data_export`, the start of `public.rpc_start_account_closure_execution`,
`private.closure_account_restricted`, `private.closure_assert_open`. Swept every writer of the closure
request and execution state. Evaluated both bindings live. NOT exercised: starting a closure would lock a
real account, so 6.1 is from reading, not from a run.

**6.1 — defect, serious. Confirming account deletion would lock the account and never delete it.**
`closure_account_restricted` is true when the request is in `READY`, `EXECUTING`, `FAILED` or `CLOSED`, and
`closure_assert_open` raises `ACCOUNT_CLOSING` whenever it is. (Correction, made in area 7 after reading
`rpc_prepare_account_closure` in full: this entry first said the account is restricted "from the moment it
is prepared (`READY`)". That was wrong — preparing sets `NOT_READY`, or `BLOCKED` when there are blockers,
and neither is in the restricted list. The claim came from reading the list of restricted states without
reading which state preparation actually writes. The lock begins only at the explicit confirmation.)
`rpc_start_account_closure_execution` — the "yes, delete it" step — moves it to `EXECUTING`, which IS
restricted, and does not finish it. There is no cancel path from `EXECUTING`; for a deletion that is
defensible on its own. Finishing belongs to `rpc_claim_account_closure_action_service`
and `rpc_finalize_account_closure_service` — service-role functions called only by the
`uskoci-account-closure-worker` Edge function, which nothing invokes (4.2). The closure binding is live and
READY (`closure_erasure_binding_v5()` is not null), so a closure WOULD start. Net: the person is locked out
with `ACCOUNT_CLOSING` on every guarded action, and their data is never erased, unless someone runs the
worker by hand. Deletion is a right a user exercises; this is the most serious finding so far. Fix is 4.2's
scheduler — for this worker it is sufficient, because its binding is ready.

**6.2 — defect (severity corrected in area 7, see 7.2). A data export is accepted and never delivered.**
`rpc_request_data_export` never consults `data_export_policy_binding()`. It inserts `REQUESTED` and
returns it. It also refuses any new request while one is `REQUESTED` or `PROCESSING`
(`DATA_EXPORT_REQUEST_ALREADY_OPEN`). `data_export_policy_binding()` is NULL today — its first act is to
look for an active `retention_policy_sets` row and there are none — so no export can be delivered even if
a worker ran. Live: one request since 2026-09-13 18:48, 7.6 days, never updated. (This entry originally
said that account "can never request an export again". That was a claim about the user's experience made
from the server alone, and reading the client disproved it: the screen offers to cancel a `REQUESTED`
export and then ask again. See 7.2.) The contrast is the fix: `rpc_start_account_closure_execution` checks ITS binding
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
