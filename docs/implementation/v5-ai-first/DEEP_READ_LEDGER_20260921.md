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
| 7 | Client data layer, file by file | read 2026-09-21 — all 91 files, each checked against the server functions it calls (7.1–7.59) |
| 8 | Routes and screens, file by file | read 2026-09-21 — 48 routes, 107 screen files, 11 hooks, stores, lib, features, contracts (8.1–8.28) |
| 9 | HITNO, categories, matching | read 2026-09-21 — see findings |
| 10 | Proof harnesses | pending |
| 11 | Edge functions, file by file | read 2026-09-21 — all 18 files, deployed list compared (11.1–11.5) |
| 12 | Server functions, all of them | read 2026-09-21 — all 480 (`public` 235, `private` 245) in full, plus grants (12.1–12.16) |

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
**Applied 2026-09-21 (PKG-027c):** these notification texts are now mapped to "ti" and the product's words, including those already stored.

### Area 7 — Client data layer (complete)

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
`applicationSelectionClientService.ts`, `reviewsClientService.ts`, `publicProfileClientService.ts`, `contactClientService.ts`,
`workerProfileClientService.ts`, `dataExportClientService.ts`, `accountClosureClientService.ts`, `closureExecutionClientService.ts`,
`mediaClientService.ts`, `legalClientService.ts`, `publicationClientService.ts`, `needLifecycleController.ts`, `needLifecycleClientService.ts`,
`dataExportDeliveryService.ts`, `preselectionQaClientService.ts`, `qaSubmissionClientService.ts`, `qaRecoveryClientService.ts`,
`applicationClientService.ts`, `myApplicationsClientService.ts`, `ru4Production.ts`, `applicationCommandJournal.ts`,
`agreementMessageClientService.ts`, `groupConversationService.ts`, `agreementPhotoClientService.ts`, `agreementCompletion.ts`,
`agreementCurrentLocationService.ts`, `safetyClientService.ts`, `authClientService.ts`, `aiNeedTurnStream.ts`,
`passwordRecoveryClientService.ts`, `passwordRecoveryLink.ts`, `processorMapClientService.ts`, `retentionPolicyClientService.ts`,
`locationClientService.ts`, `configuredLocationResolver.ts`, `productionLocationResolver.ts`, `locationResolver.ts`, `inboxModel.ts`,
`inboxClientService.ts`, `notificationPreferencesClientService.ts`, `pushDeviceClientService.ts`, `pushReadinessClientService.ts`, `nativePushDevice.ts`,
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
session store clears no storage), not after an account closure. *(Narrowed after reading every journal:)*
the other journals are deliberate — support, safety, Q&A, AI-turn, location and closure intents store only
opaque ids and a content hash, and `aiTurnIntentJournal` says outright that unknown outcomes "survive app
exit/logout" so the same command can be resolved later. The only other one holding personal text is the
application command journal (the offer's price and note, up to 4,000 characters), and it deletes itself
once that command is resolved. So the one that matters is the outbox: message text, never removed. Only
the return target is cleared by the auth flow. Another account on the same phone cannot read these through
the app — every key and every read is bound to the account id — but the text stays on the device. The 2026-09-02 draft legal constitution lists, as an Auth proof requirement,
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

#### `contactClientService.ts` (143), `workerProfileClientService.ts` (142), and the screen that calls the latter, `src/app/(app)/profil/radnik.tsx` (182) — read in full

**7.39 — note. The worker profile screen replaces every refusal with one sentence.** `radnik.tsx:106`
does `if (!result.ok) return failed();`, so whatever `azurirajRadnikProfil` says — "Unesi ime pre
završetka profila.", "Unesi mesto rada…", "Unesi bar jednu veštinu…", "Prethodno čuvanje profila se još
obrađuje." — the person reads "Čuvanje nije potvrđeno. Pogledaj sačuvani profil pre nego što probaš
ponovo." Today this costs little: the screen checks the same three things `rpc_complete_worker_profile`
checks (name ≥ 2, city ≥ 2, ≥ 1 skill) before it offers "Proveri i aktiviraj profil", so those refusals
should not arise. Measured: 4 active worker profiles, 1 draft; the draft has a name and a city and no
skill — which the screen asks for by name ("Dopuni osnovne podatke"). One active profile has no skill
left: activation required one, and nothing stops removing it afterwards. The service's formal "Dostupnost
menjajte…" is unreachable — the screen's command builder never sends availability.

**7.40 — note, well built.** Phone and location grants go through `rpc_set_contact_grant`; the location
reveal decoder refuses a reveal that names the viewer as owner, an expired grant, an address that does not
match the confirmed points, or a start pin that is not the confirmed start point. All eleven location
refusals are mapped; phone refusals go through the shared legacy table, which has `PHONE_NOT_SET` and
`AGREEMENT_NOT_ACTIVE`.

#### `dataExportClientService.ts` (147), `accountClosureClientService.ts` (103), `closureExecutionClientService.ts` (66) — read in full, with `private.account_closure_preparation` and `rpc_get_account_closure`

**7.41 — risk. Two closure services, two answers.** The preparation path and its server counterpart agree
with each other and say closure cannot run: `private.account_closure_preparation` appends
`CLOSURE_EXECUTION_NOT_READY` unconditionally and hard-codes `executionReady: false` (its comment: "There
is intentionally NO operator flag to bypass missing code"), and `accountClosureClientService` refuses any
receipt without that reason. The execution path (`rpc_review_account_closure_execution`,
`rpc_start_account_closure_execution`, adapter `OWNER_AF_D22_EVENT_ERASURE_V1`) is a second authority that
can report `ready: true` and start (6.1). Both are wired into one screen, `ClosureDialog.tsx`. Also, once
an execution starts, `rpc_get_account_closure` returns `restricted: true`, and the preparation decoder
refuses anything but `restricted: false` and states `BLOCKED`/`NOT_READY` — so `accountClosureClientService.read`
fails for an account that is closing. What the person sees then is for the screen read (Area 8).

**7.42 — note, well built.** The export client admits only intake and a validated artifact descriptor
(size, sha256, md5, expiry, generation); a server "download available" flag cannot switch on delivery by
itself; lifecycle dates must agree with the status (a cancelled request has a cancel time, a finished one
a completion time). All eight export refusals are mapped.

#### `mediaClientService.ts` (144), `legalClientService.ts` (129), `publicationClientService.ts` (122), and `src/features/media/nativePhotoPicker.ts` (82) — read in full

**7.43 — note, product fact. No Terms of Use or Privacy Policy exists in the database, and nobody has
accepted any.** `rpc_get_legal_bundle` looks for an active, published, effective `TERMS` and `PRIVACY`
row in `private.legal_document_versions`; the table has 0 rows and `account_legal_acceptance_events` has
0 rows. The app handles it honestly — "Uslovi korišćenja i Politika privatnosti još nisu objavljeni." —
and the closure preparation reports `LEGAL_POLICY_NOT_READY` from the same read. Consistent with AGENTS.md
(RC2 received, operator details and legal certification not invented), stated here because it is a hard
precondition for anyone outside the test circle. `legalClientService.acceptBundle`, the older and weaker
acceptance path, has no caller; the screen uses `acceptReviewedBundle`, which binds the exact document
hashes the person read.

**7.44 — note.** Photos are prepared on the phone (at most 1600 px on the long side, JPEG 0.85, ≤ 5 MB)
and sanitised again by the Edge function; the client decoders require the storage path to be exactly
`<account>/v5/<asset>/<sha256>.jpg`. One formal string, `MEDIA_DIMENSIONS_TOO_LARGE: 'Smanjite
fotografiju pre slanja.'`, is unreachable from the app because the picker already resizes. Publication's
decision decoder requires `publishable` to equal `outcome === 'ALLOW'`, a jurisdiction code and at least
one rule id — a decision without its reasons is refused.

#### `needLifecycleController.ts` (127) and `needLifecycleClientService.ts` (88) — read in full, with `rpc_cancel_need`

**7.45 — rule, server copy; otherwise well built.** Cancelling a task stops every pending side effect first
(queued notifications, dispatch rounds, opportunity deliveries, grants), then expires open applications
and tells each worker — with `'Potreba je otkazana'` / `'Narucilac je otkazao Potrebu za koju ste poslali
prijavu.'`: the retired word "Potreba", "Narucilac" without its diacritic, and formal "ste". Unlike the
Agreement cancel (7.15), this one keeps the reason (in the marketplace audit, capped at 500). The client
matches the server exactly, including the replay receipt reporting `affectedResponses: 0`, and maps every
refusal; the controller never resubmits by itself and allows "retry the same" only after a read-back has
shown the first attempt did not land.
**Applied 2026-09-21 (PKG-027c):** the two texts now read "Zadatak je otkazan" / "Zadatak za koji imaš prijavu je otkazan.", including those already stored. The discarded reason on the Agreement cancel (7.15) is not changed.

#### `dataExportDeliveryService.ts` (125) and the Edge function it calls, `uskoci-data-export-worker/index.ts` (95) — read in full

**7.46 — correction of 4.2, found by reading the client.** 4.2 said nothing runs the data export worker.
Wrong for this worker: `prepareExport` invokes `uskoci-data-export-worker` with `{action:'prepare',
receiptId}` under the person's own session; the worker checks the receipt is theirs, then claims,
uploads, verifies and completes with the service role. Only its `tick` (catch-up and artifact cleanup) is
internal-only and unscheduled. The closure and push workers do refuse any non-service caller
(`SERVICE_ROLE_REQUIRED`), so 4.2 stands for them. And the export is stuck for a different reason:
`private.data_export_policy_binding()` returns null — no export policy is bound — so
`rpc_claim_data_export` answers `EXPORT_POLICY_NOT_READY` before it touches the request, and the app shows
"Priprema kopije trenutno nije dostupna" (7.2). Measured: the one request is `REQUESTED` since
2026-09-13 16:48 UTC, 0 attempts, 0 artifacts ever. Fix shape: bind the export policy (an owner/legal
decision), not a scheduler. The download path itself is careful: no signed URL, a fixed Edge URL with
redirects refused, size and hashes from headers checked against the body, bytes zeroed on every exit.

#### `preselectionQaClientService.ts` (123), `qaSubmissionClientService.ts` (50), `qaRecoveryClientService.ts` (33) — read in full, with the `ru4b` and QA functions

**7.47 — defect, server, latent. Questions about a task close exactly while it is still recruiting.**
After a selection, `rpc_select_response` sets the task to `ACTIVE` when every slot is covered and to
`SELECTION` when some are still open. Every Q&A function — `rpc_read_preselection_qa_context`,
`rpc_ru4b_ask_preselection_question`, `rpc_ru4b_answer_preselection_question`,
`rpc_ru4b_public_preselection_qa`, `rpc_check_preselection_qa_limits_service` — allows `PUBLISHED` and
`ACTIVE` and refuses `SELECTION`. So on a three-person task with one person chosen — still on the map,
still taking applications — a worker opening "Pitanja" gets `NEED_NOT_FOUND` ("Zadatak nije dostupan
ovom nalogu."), the answered questions disappear from public view, and the owner can no longer answer;
while on a fully staffed `ACTIVE` task, which nobody new can join, questions stay open. It reads as
`SELECTION` and `ACTIVE` swapped. Not reachable today: no task is in `SELECTION`.

**7.48 — note.** The live question path is `qaSubmissionClientService.submit` → Edge `uskoci-qa-classify`:
every question and every answer is classified by the AI provider before the canonical writer stores it;
reads never call the provider. `preselectionQaClientService.askQuestion`/`answerQuestion` (the direct
writers) have no caller; its reads and `dispositionQuestion` are used. `private.ru4b_assert_rate_authority_ready`
raises unconditionally and has no caller left — dead.

#### `applicationClientService.ts` (98), `myApplicationsClientService.ts` (78), `ru4Production.ts` (114) — read in full, with `rpc_list_my_applications`

**7.49 — defect, server, latent. A cancelled Agreement leaves the worker's application "izabrana" forever.**
`rpc_list_my_applications` maps a response to `SELECTED` when *any* Agreement names it
(`agreement_id is not null`), whatever that Agreement's status, and sets `attentionRequired` for every
`SELECTED` row, which also sorts it to the top. `rpc_cancel_agreement` sets the response to `NOT_SELECTED`
but the Agreement row remains — so after a cancel, "Moje prijave" shows that application as chosen and
needing attention, at the top, permanently, opening a cancelled Agreement. (The Home is spared:
`composeActivities` moves a `SELECTED` row whose Agreement is not active into history.) Not reachable
today: the three Agreements on DEV are all `CONFIRMED`. Every state the server can emit is in the client's
allowed set, so the list itself never fails on a state.

**7.50 — note.** `ru4Production.resolveChangedApplication` accepts any non-error answer as success and
falls back to the version it sent when the receipt names none — the pattern `povuciPrijavu`'s own comment
says was removed there for exactly that reason. Harmless today: both branches of
`rpc_resolve_stale_response_after_need_edit` always return `version` and `status`.

#### `applicationCommandJournal.ts` (80), `agreementMessageClientService.ts` (81), `groupConversationService.ts` (88) — read in full

**7.51 — note, well built; one stale comment.** The application journal keeps exactly one unresolved
command per account and task, refuses to replace it with a new key, and retires only the exact command it
saved. The message service binds each send to the account and a client key and turns a missing receipt
into "unknown", never "failed"; its closing comment "Inert until the accepted forward contract is live and
the real screen is bound" is stale — `useAgreementOutbox` binds it to the live chat. The group
conversation decoders check membership (≤ 51), keyset pages (≤ 50, strictly ordered within the cursor)
and that `mine` agrees with the sender.

#### `agreementPhotoClientService.ts` (130), `agreementCompletion.ts` (37), `agreementCurrentLocationService.ts` (55) — read in full

**7.52 — note, verified complete.** Every refusal `rpc_mark_work_done` (14 codes) and `rpc_confirm_completion`
(10) can raise has its own sentence in `completionErrors`, and every refusal of the two live-location
functions is mapped — the completion path, never exercised by a person, at least says the right thing
when it refuses. Agreement photos are bound to the exact Agreement version, and a photo message is
accepted only if its text, version and client key match the chat row it decorates.

#### `safetyClientService.ts` (114) and `authClientService.ts` (96) — read in full

**7.53 — note.** Blocking and private safety reports map every refusal their five functions raise; a
report's text is never read back to its target, and the block list is keyset-paged by target id. The
reports land in the safety inbox that has no operator (7.31). Auth never shows a provider message: rate
limits, outages and each operation's failure get one fixed sentence each; sign-up carries no legal
acceptance step (there is nothing published to accept, 7.43); logout revokes this device's push
registration first, then signs out only this device's session.

#### `aiNeedTurnStream.ts` (113), `passwordRecoveryClientService.ts` (115), `passwordRecoveryLink.ts` (44), `processorMapClientService.ts` (109), `retentionPolicyClientService.ts` (84) — read in full

**7.54 — note, product fact. Every published privacy artefact is empty, and the app says so.** Measured:
`private.legal_document_versions` 0 rows (7.43), `private.processor_map_sets` 0 and
`processor_map_entries` 0 while `processor_provider_inventory` holds 4 providers,
`private.retention_policy_sets` 0 and `retention_policy_rules` 0, and no export policy bound (7.46).
Each client reader treats "not published" as a normal answer with honest copy and refuses a partial or
inconsistent map or schedule outright rather than showing part of it. The runtime pieces that do exist —
the AF-D22 closure erasure binding and the AI-conversation retention adapter — are separate from these
published statements; a person reading "Privatnost" today is told nothing is published yet, which is true.

**7.55 — note, well built.** The AI stream accepts only an ordered event sequence bound to one turn and
attempt, caps text at 1,500 characters and the stream at 256 KB, and never shows a provider's text; any
break becomes "unconfirmed", then the turn is recovered by reading it. Password recovery uses a separate
transient session that never logs the person in, accepts only the pinned `uskociapp://oporavak` with a
`type=recovery` fragment, re-checks the user on the server right before writing, and never retries a
write whose answer was lost. The build pins that redirect and attests it inside the APK. Whether Supabase
Auth's own redirect allow-list contains it cannot be read from SQL.

#### `locationClientService.ts` (107), `configuredLocationResolver.ts` (178), `productionLocationResolver.ts` (31), `locationResolver.ts` (65) — read in full

**7.56 — note.** Address search goes only through the app's own Edge function `uskoci-location-search`
(deployed, v13, JWT-verified) with the provider named `locationiq`; the provider key lives only in Edge
and cannot be read from here. A candidate is a proposal until the person confirms it; the request carries
the typed text and country only — never the account, access notes or local scope — and refuses
redirects and a public Nominatim endpoint. `createLocationResolver` (the coarse, provider-less port) has no
caller left. Location saves are revision-bound and a receipt is accepted only if the saved value equals
what was sent.

#### `inboxModel.ts` (91), `inboxClientService.ts` (59), `notificationPreferencesClientService.ts` (95), `pushDeviceClientService.ts` (69), `pushReadinessClientService.ts` (48), `nativePushDevice.ts` (28), with `app.config.js` and the APK workflow

**7.57 — note, product fact. The APK the owner installs cannot obtain a push token.** `nativePushDevice`
asks Expo for a push token, which on Android requires Firebase. `app.config.js` attaches
`config/firebase/google-services.json` only when the package is `rs.uskoci.preview` (the EAS preview) and
deletes it for every other package — its own comment: "Preview Firebase has no Android client for
proof/dev/unknown packages". The `Build Android development APK` workflow — the one this project installs
with `adb install -r` — rewrites the package to `rs.uskoci.dev`. So on that APK the token request cannot
succeed and "turn on notifications" cannot register the phone, independently of the missing sender
schedule (4.2) and the per-role default (4.1). Stated from the configuration; not observed on a device.

**7.58 — note, well built.** The inbox model discards any answer that arrives after the screen, role or
account changed, marks one item read before resolving where it leads, and lets the server recount after
"read all". Preferences are saved per role with a revision and the receipt must echo every setting sent.
Push device registration, rotation and revocation are revision-bound; logout revokes the session's
device first with a 4-second bound so a slow network cannot keep a person signed in. Push readiness is
decoded as a strict state machine and never inferred from a registered token.

#### The remaining 30 files — read in full

`requesterProfileClientService`, `ownProfileClientService`, `workerAvailabilityClientService`,
`workerCapacityClientService`, `workerCalendarClientService`, `needUrgencyClientService`,
`responseClientService`, `taskRelation`, `needPublicationReadiness`, `entryIntentClientService`,
`supabaseClient`, `authAvailabilityClientService`, `marketClientService`, `calendarErrors`, `buildIdentity`,
`remainingSearchCloseAttempt`, `needDetailPresentation`, `focusedResource`, `nativeCurrentLocation`,
`passwordRecoveryErrors`, `aiTurnIntentJournal`, `workerAiTurnIntentJournal`, `agreementPhotoJournal`,
`supportCaseJournal`, `supportCaseTypes`, `supportCaseWire`, `supportCaseReadDecoders`, `serverReceipt`
(read earlier), and the two fakes `lazniIzvor` (771) and `lazniAi` (355).

**7.59 — note.** Nothing in these contradicts the server. Checked against it: `taskRelation` treats a
withdrawn or closed application as "may apply again", and the database agrees — the unique index
`marketplace_responses_one_live_per_worker_need` covers only live statuses. `needPublicationReadiness`
answers from `rpc_get_need_publication_context` and never becomes the permission to publish.
`focusedResource` keeps what a screen showed while re-reading and wipes it when the app goes to the
background, so the recents thumbnail holds no private data. `needUrgencyClientService` issues one
`fn_need_urgency` call per urgent task (four at a time) — fine at today's volume, a cost at hundreds.
`needDetailPresentation.readableTitle` strips a pair of quotes that the AI wraps around titles ("six of
seventeen tasks"); its own comment says the real repair belongs in the interview prompt. The two fakes are
reachable only under Jest or `EXPO_PUBLIC_USE_FAKE_SOURCE=1` (the APK sets `0`); they model the retired V1
intake and carry one formal line ("Kako biste ukratko nazvali ovaj posao?") that no user can see.

**Area 7 is complete: all 91 files of `src/data` read in full.**

### Area 8 — Routes and screens (complete)

Scope: 48 route files in `src/app` (5,183 lines), 107 screen files in `src/ui` (10,458 lines), the 11 hooks.
Read so far, in full: both layouts, `+native-intent.tsx`, `auth.tsx`, the sixteen small routes
(redirects, support, safety, review, questions, blocked, about, legacy draft review, task place),
`useOwnedEditor`, `useFocusedResource`.

**8.1 — note, well built.** The root layout sends a signed-out person to sign in and remembers where they
were going (`pendingRoute`), then takes them there once — a link or push that required signing in is
finished, not dropped. Every route file in `src/app/(app)` is registered with the tab navigator; the
three Agreement sub-routes (`izmene`, `grupa`, `lokacija`) are not declared inside `Stack.Protected`, but
the root redirect still sends a signed-out visitor to `/auth` and each screen's reads require a session.
`useOwnedEditor` shows the service's own sentence on a refusal and a fixed "Podaci nisu učitani…" on a
transport failure; `useFocusedResource` exposes only a boolean error, so no raw server message can
reach a screen through it (this closes the question left in 7.33 for every screen built on it).

**8.2 — defect, legal. Sign-up asks for a consent that is neither backed nor recorded.** Registration
refuses to proceed until "Prihvatam Uslove korišćenja i potvrđujem da sam pročitao/la Politiku
privatnosti" is ticked. The two links open a modal that reads the legal bundle — which has 0 documents
(7.43), so there is nothing to read. And the tick goes nowhere: `authClientService.signUp` sends only
names, city, email and password; no acceptance event is written (`account_legal_acceptance_events` has
0 rows). Every account created so far "accepted" documents that did not exist, and the product has no
record that they did.

**8.3 — rule.** `auth.tsx:408` — "Zaboravili ste lozinku?" is formal; everything around it says "ti".

#### `nova.tsx` (290), `pregled-zadatka.tsx` (415), `dogovor/[id].tsx` (340) — read in full

**8.4 — defect. "Podeli svoj broj" can never succeed, and the screen hides why.** `rpc_set_contact_grant`
refuses a phone share with `PHONE_NOT_SET` unless `app_accounts.phone` is filled. That column is written
only from `auth.users.phone` (a phone-OTP sign-in) or a `phone` in sign-up metadata — and the app's
sign-up sends none. No screen anywhere lets a person add a number (searched `src` for any phone write;
profile data edits the display name only). Measured: 0 of 5 accounts have a phone. So on every Agreement
the contact section offers "Podeli svoj broj", the server refuses, and `dogovor/[id].tsx`'s `mutate`
throws away the mapped sentence ("Najpre dodaj broj telefona na nalog.") and shows "Promena nije
potvrđena. Osveži Dogovor pre novog pokušaja." — which also marks the screen uncertain. The mapped
sentence would not help either: there is nowhere to add the number.

**8.5 — defect, confirms 7.21 on screen.** `pregled-zadatka.tsx` computes its own reasons for a disabled
publish button (block, missing facts, no place, identity, open editors) and none covers "Moja cena" with no
amount, "Tačan termin" without both ends, or an edit with no change. The button stays live; the refusal
comes back unmapped; `useOwnedEditor` shows "Ishod radnje nije potvrđen…" and marks the screen uncertain,
so the footer offers only "Učitaj pregled i proveri ishod" — which re-reads the same review and leads back
to the same button.

**8.6 — defect, truthfulness; ties to 5.1.** With no response deadline the review says "Bez posebnog roka —
do popune, zaustavljanja potrage ili isteka zadatka." A task without a deadline never expires (5.1): the
third way it promises does not exist.

**8.7 — risk.** When publication comes back `REVIEW`, the screen offers "Zatraži pregled podrške", which
opens a support case — and support has no operator (7.31). The one path the product gives for a task held
for review leads to a queue nobody reads.

**8.8 — rule, copy.** `nova.tsx:254`: "Odustali ste od odgovora. Podaci su ostali nepromenjeni, a
rezervisana potrošnja je zadržana." — formal, and "rezervisana potrošnja" is internal cost language a
person cannot act on. `nova.tsx:228`, when leaving a conversation: "Podaci se čuvaju prema objavljenim
pravilima" — no retention rules are published (7.54). `dogovor/[id].tsx:242`: "da pokušate ponovo" —
formal. `dogovor/[id].tsx:169` does the same as 8.4 for a refused problem report: every refusal becomes
"Prijava nije potvrđena…", discarding the mapped copy for `NARRATIVE_TOO_LONG` and the others.

**8.9 — note, verified.** The screen's claims hold on the server: "Ovaj opis vide oba učesnika i sačuvan je u
Porukama" — `rpc_report_problem` inserts the narrative as an Agreement message; "Bez odgovora se Dogovor
zatvara sam" — the 48-hour auto-completion runs (1.4). The review deadline is shown in the device's zone
with its raw IANA name ("(Europe/Belgrade)") and seconds. `nova.tsx` no longer creates a conversation on
open — only the first word or the microphone does (the fix for "38 of 62 empty conversations").

#### `prilike/[id]/prijava.tsx` (151), `potrebe/[id]/pregled.tsx` (189), and the composer `ui/v2/ApplicationSelectionPresentation.tsx`

**8.10 — defect, the assistant's own incomplete work (pkg025). On a "po osobi" task a worker cannot apply
for more than one person.** Since pkg025b, `rpc_submit_response` requires, for `MY_PRICE` with basis
`PER_PERSON`, that the application's price equal the per-person amount × the people it covers. The
application composer was never taught the basis: `prijava.tsx:71-72` fills the price with
`need.ponudjenaCena.iznos` — the per-person amount — and `ApplicationSelectionPresentation.tsx:119-133`
locks that field for `MY_PRICE`, under the note "Ovo je ukupan iznos za sve ljude koje dovodiš, ne cena
po osobi." So a worker bringing two people to a 5,000-per-person task sends 5,000, the server expects
10,000, refuses with `FIXED_PRICE_MISMATCH`, the screen says "Cena Zadatka je promenjena…", and "uredi
novu ponudu" puts the same locked 5,000 back. Only a one-person application can ever pass. The task
price at the top of the composer (`:64`) also shows the bare amount with no "po osobi", while every other
screen uses `needPriceText`. Not yet hit — no published task has a basis — but 4 open intake conversations
already carry `need.price_basis = PER_PERSON`; the first one published with two or more people will show
it. Client-only fix: lock the price at per-person × people for `PER_PERSON` and say so.
**Fixed in the client 2026-09-21.** `fixedApplicationPrice` / `fixedApplicationPeople` (beside `needPriceText`)
state the server's rule once. The composer derives the price from the people for PER_PERSON, fixes the people
to every place for TOTAL, and derives both again at send time from the same Need read as the revision. The
task price at the top now uses `needPriceText`. Two composer tests fail on the old code and pass on the new;
the full suite passes (238 suites, 4538 tests). No device check yet, and no published task has a basis to
try it on.

**8.11 — note, copy.** `potrebe/[id]/pregled.tsx:136`: "Zatvorićemo potragu za preostalih N mesta" —
"preostalih 1 mesta" for one. `:142` replaces every refusal of the close with "Potraga nije potvrđeno
zatvorena." (ungrammatical, and it hides the mapped reason). The edit warning says acceptance "ponovo
pokreće proveru za objavu" but not that the task leaves the market until republished (7.26).

#### `obavestenja.tsx` (163) and `profil.tsx` (152), with `rpc_list_inbox`

**8.13 — rule. Every notification a person has ever read is formal, and most use the retired words.** The
Inbox shows `title`/`body` exactly as the emitting function stored them in `notification_deliveries`
(fallback: "Novo obaveštenje" / "Otvorite za trenutne informacije."). All 7 in-app deliveries on DEV —
every one shown so far — are formal ("Imate", "Vaša", "Vam", "Otvorite") and two name "Uskočer" /
"Naručilac". Swept every string literal in all `public`/`private` function bodies for the formal forms and
the retired words; the notification texts that break the owner's rules are:
`rpc_select_response` "Vaša prijava je izabrana" / "Otvorite Dogovor za detalje zadatka.";
`rpc_mark_work_done` "Završetak čeka Vašu potvrdu" / "Uskočer je označio Dogovor kao završen.";
`rpc_confirm_completion` "Naručilac je potvrdio završetak."; `rpc_submit_agreement_review` "Dobili ste
ocenu za završen Dogovor."; `rpc_send_agreement_message` and `…_photo_message_v5` "Imate novu poruku u
Dogovoru."; `pre_v3_application_event` "Imate novu prijavu za Zadatak."; `rpc_mark_response_viewed`
"Naručilac je pregledao Vašu prijavu."; `dispatch_next_wave` "Nova prilika koja može da Vam odgovara";
`rpc_report_problem` "Otvorite Dogovor da vidite prijavljeni problem."; `rpc_propose_agreement_change_v2`
"Pogledajte predlog i odgovorite u Dogovoru."; `rpc_respond_agreement_change` "Pogledajte važeće uslove u
Dogovoru."; `rpc_ru4b_ask_preselection_question` "Uskočer je postavio anonimno pitanje o Zadatku.";
`rpc_ru4b_answer_preselection_question` "Naručilac je odgovorio na Vaše pitanje."; `rpc_withdraw_response`
"Uskocer je povukao prijavu za Vasu Potrebu." (also without diacritics); `rpc_cancel_need` "Potreba je
otkazana" / "Narucilac je otkazao Potrebu za koju ste poslali prijavu."; `rpc_list_inbox` fallback
"Otvorite za trenutne informacije.". Five more in `rpc_select_response` are exception hints ("Uskocer je
izmenio prijavu. Proverite je ponovo." …), which the client never displays. This replaces 1.6, 2.3 and
7.45 as the single inventory. A copy fix is a server change and reaches only new events — stored
deliveries keep their text.
**Applied 2026-09-21: PKG-027c** maps every one of these texts in `private.emit_event` through one copy table,
rewrote all 14 stored deliveries, and corrected the Inbox fallback; the push text is "Imaš novo obaveštenje.
Otvori aplikaciju." (Edge `uskoci-push-transport` v12). The five exception hints are unchanged; the client
does not display them. receipt `supabase/operations/dev-alpha/ledger/20260921_pkg027_application.receipt.json`.

**8.14 — note.** The profile hub tells a suspended worker "Profil je obustavljen. Piši podršci." — support
has no operator (7.31). The Inbox resolves every event to its own screen, questions to the question
screen, and a filter by role; its "N nepročitanih" and "Pročitaj sve" are server-counted.

#### The remaining route files — read in full

`index.tsx`, `dogovori.tsx`, `prilike.tsx`, `mapa.tsx`, `potrebe.tsx`, `moje-aktivnosti.tsx`, `moje-prijave.tsx`,
`potrebe/[id]/kandidati.tsx`, `raspored.tsx`, `profil/{obavestenja,podaci,dostupnost,lokacija,privatnost,
pravna,izvoz,razgovor,fotografija}.tsx`, `fotografije-zadatka.tsx`, `oporavak.tsx`.

**8.15 — rule, copy.** `oporavak.tsx:78`: "Postavite novu lozinku za nalog:" — formal. `profil/razgovor.tsx`
repeats the intake's "Odustali ste od odgovora… rezervisana potrošnja je zadržana" (`:167`) and "Ako je
obrada već počela, rezervisana potrošnja ostaje zadržana" (`:208`) — internal cost wording on a worker's
profile screen.

**8.16 — note, verified.** Every other claim these screens make holds against the code behind them.
"Izabrane fotografije šaljemo Google Gemini servisu radi provere sadržaja pre objave" — the publication
evaluator sends each JPEG as `inlineData` to Gemini, and when image review is off it refuses a task with
photos as `PUBLIC_MEDIA_NOT_READY` rather than publishing unchecked ones. The worker-profile conversation
reuses the latest open one instead of creating a row per visit (`rpc_open_worker_ai`). The export screen
matches 7.46 exactly: "Pripremi kopiju" answers "Priprema kopije trenutno nije dostupna. Tvoj zahtev ostaje
zabeležen." The privacy and legal screens say "not published" where nothing is published (7.54). The
calendar shows only work the person agreed to do, and says so. One person has two names — the requester
profile's ("Ime na profilu") and the worker profile's — edited on different screens.

**8.12 — note, well built.** The application composer journals the exact command before sending, never
sends a second key for the same intent, retires it only on its own receipt or a known refusal, and
restores an unresolved one after a cold start; the owner's task screen asks the publication gate itself
why a draft cannot be published instead of guessing, and binds every late answer to its focus.

#### `src/ui` — Agreement changes, location, closure, review, questions, safety, task lifecycle

Read in full: `agreements/{agreementActionsModel,AgreementActionsController}.ts`,
`agreements/{AgreementActionsScreen,AgreementWorkspace,AgreementLocationScreen}.tsx`,
`AgreementLocationController.ts`, `closure/{ClosureDialog.tsx,closureIntent.ts}`,
`reviews/{AgreementReviewScreen,AccountReputation}.tsx`, `qa/{TaskQaScreen,TaskQaEntry}.tsx`,
`safety/SafetyScreen.tsx`, `needs/NeedLifecycleActions.tsx`. With them, in full: `rpc_cancel_agreement`,
`rpc_respond_agreement_change`, `rpc_mark_work_done`, `rpc_tick_auto_completion`, `private.marketplace_tick`,
`private.sync_need_completion`, `private.emit_event`, `rpc_list_inbox`, `rpc_review_account_closure_execution`,
`private.closure_blockers_v5`, `private.closure_erasure_hard_blockers_v5`, `rpc_submit_safety_report`,
`private.support_safety_case_v5`, `rpc_cancel_need`, `rpc_ai_claim_need_turn_v2_service`,
`private.ai_need_turn_status`, `rpc_ai_cancel_need_turn_v2`, `rpc_ai_abandon_need_conversation_v2`,
`rpc_open_worker_ai`, `private.worker_ai_document`, `private.worker_ai_turn_document`. Re-verified on
the way, against the bodies: 7.15 (the cancel reason is discarded), 7.16 (cancel stays open after "gotovo"),
1.2 (auto-completion emits nothing) and 8.13 (every stored notification text) — all hold. The one live
Agreement in `AWAITING_REQUESTER` has its deadline at 2026-09-22 10:40 UTC and no open problem, so it will
be the first auto-completion on DEV, and per 1.2 neither side will be told.

**8.17 — defect, measured. AI turns that never finish freeze their conversation and block account
closure for good.** Four turns are `PROCESSING` with `provider_dispatched = true` and a lease that ran out
days ago: three task-intake turns (accounts 4 and 5; created 2026-09-13 13:42, 2026-09-16 20:41 and 20:44
UTC; 90-second leases) and one worker-profile turn (account 4, 2026-09-16 20:47; 60-second lease). Nothing
moves an expired, dispatched turn out of `PROCESSING`: only the Edge worker completing or failing it, the
person cancelling that exact request, or — for intake only — abandoning that conversation. The minute tick
has no sweep. By design (`ai_need_turn_status`: "Expiry/abort is not proof that a provider request did not
run… every unresolved turn blocks successors") each such turn freezes its conversation. Two consequences
reach a person. (1) `closure_blockers_v5` counts any `PROCESSING` turn as `PENDING_WORKFLOW`; it is account
4's only blocker, so closing that account says "Sačekaj završetak započete obrade." — a wait with no end.
(2) There is no way out from the app: the intake conversations are not listed anywhere to reopen, and the
worker screen offers "Novi razgovor" for an expired turn (`worker_ai_turn_document` reports
`UNKNOWN_OUTCOME`), but its abandon does not touch `worker_ai_turns` — of the five functions that update
that table, none is the abandon — so the blocker survives the escape the screen offers. Cancel needs the
original request key, which the client only has from its own journal. Why the Edge worker died after
dispatch is not established here; the mechanism that lets any post-dispatch failure do this is 11.1. Fix shape (server, needs approval): a sweep that marks a dispatched turn
`FAILED` once its lease has been expired for, say, ten minutes — same "never retried" meaning, but it stops
blocking successors and closure; and let the worker abandon fail its open turn the way the intake one does.
**Applied 2026-09-21: PKG-027b**, exactly that shape. Within three minutes of the apply, the ticks moved the
3 stuck intake turns and the 1 stuck worker turn to `FAILED`. receipt `supabase/operations/dev-alpha/ledger/20260921_pkg027_application.receipt.json`.

**8.18 — risk. Closure starts on one tap, and a second device is never told it is running.** Answers what
7.41 left for this area. The dialog's "Pokreni zatvaranje naloga" starts the irreversible erasure on a
single press — no confirmation dialog, no typed word — and with 6.1 that press locks the account without
erasing it. Today no account can reach the button: all five have hard blockers (measured: active
Agreements, open tasks, an active application, and 8.17). The screen knows a closure is running only from
the local START journal. On the device that started it: "Zahtev je pokrenut.", "Provereni koraci: N od M",
and a sign-out. On any other device, or after a reinstall, it falls back to the review, which for a
closing account returns `ready: false` (the account is restricted), `code: null` (a request exists and no
hard blocker remains) and `blockers: []`; the dialog then prints "Najpre reši obaveze navedene ispod."
above an empty list, with "Proveri stanje zahteva" as the only action. The preparation reader that 7.41
found refusing a closing account is reached only from "Pripremi pregled", which this state does not show,
so that refusal never surfaces here. Also, latent: `duration()` renders "1 dana", "1 sati", "2 sati" — it
is used only for retained datasets, which the live erasure adapter sends as `null`.

**8.19 — defect, truthfulness.** `SafetyScreen.tsx:51`: "Privatna prijava ide automatskoj proveri. Ako ti
treba čovek, otvori zahtev podršci." There is no automatic check: `rpc_submit_safety_report` inserts the
report and an audit row, and its trigger opens a `SAFETY` support case — that is all. The same screen says,
correctly, "Prijavu prima podrška" (`:120`). And the button under the false line opens a second, ordinary
support case beside the safety case the report already created, in the same inbox with no operator (7.31).

**8.20 — note, well built, with one dead end.** The Agreement-change controller journals the exact
command before sending, restores a respond/withdraw from the server's own proposal only when its hash
matches, and demands the original terms be typed again for a propose or cancel whose body is not on the
device. Every refusal the four change functions raise is either mapped or resolved by reading the
agreement back. The dead end: a clear refusal (say `VERSION_CONFLICT`) left unacknowledged comes back
after a restart as "Ishod nije potvrđen", and the only way out is to retype the same terms so the server
can refuse them again. The location controller stores only opaque coordinates of its request, and
explains that a shared point is past, not live. The review screen shows the saved receipt as final;
the task-lifecycle panel's copy holds against `rpc_cancel_need` (applications close, Agreements cancel
separately). The Q&A screen hides answers from an older revision and says so.

#### `src/ui` — support, group conversation, notifications, availability, worker profile, lists and cards

Read in full: `support/*` (9 files), `groups/*` (3), `notifications/{PushPreferences,PushRuntime}.tsx`,
`calendar/*` (3), `workerProfile/*` (3), `v2/{MarketplacePresentation,TaskCard,NeedUrgencyBadge,
NeedPresentation,PublicNeedPresentation,MyApplicationsPresentation,AgreementCollectionPresentation,
AgreementPresentation}.tsx`. With them: `rpc_prepare_worker_ai_review` (its "missing" list is written in
Serbian labels, so "Dopuni: …" reads as words), `rpc_abandon_worker_ai`, the triggers on
`ai_conversations`.

**8.21 — rule, copy — the formal and mixed forms the first sweep missed.** The first sweep (8.13, 8.15)
read only quoted strings; text written directly between JSX tags was never scanned. A second pass over
JSX text finds: `MarketplacePresentation.tsx:89` "Promeni pretragu ili poništite filtere." — "ti" and
"Vi" in one sentence, on the empty state every search can reach; `location/ResolvedPinMap.tsx:193`
"Tačka nije izabrana. Pronađite područje i dodirnite mapu." — formal; `GroupConversationScreen.tsx:63`
"Ovo upravljanje vidiš samo vi." — "vidiš" with "vi", ungrammatical (meant "ti"); `AvailabilityForm.tsx:134`
"Promena će se sačuvati tek kada sačuvate dostupnost." — formal, beside "Odustani"/"Ukloni";
`location/NeedLocationForm.tsx:145` "Tačka koju uređujete" — formal. Plural address to the pair
("Ovde se dogovarate… između vas dvoje", `AgreementChat.tsx:121`; "Dogovorite zajedničke korake…",
"dogovarajte u svom privatnom Dogovoru" in the group screen) is grammatical but still speaks to one reader
in the plural. And a leftover of the retired "Potreba": the owner's own task detail (`NeedPresentation.tsx:16`)
labels a Zadatak "Objavljena", "Delimično popunjena", "Popunjena", "Zatvorena" — feminine, for a masculine
noun — while the card for the same task (`TaskCard.tsx:231`) says "Objavljen", "Popunjen", "Zatvoren".

**8.22 — note, copy, plurals.** Counts glued to a fixed plural read wrong for one: "{n} nepročitanih" in
the group screen and its entry ("1 nepročitanih"), "{n} stavki alata · {n} vozila" on the worker profile
("1 stavki alata · 1 vozila"), "{n} redovnih termina" on the worker AI card, and the same card's team size,
"{n} ljudi" for everything but one ("2 ljudi"). `system/plural.ts` already has the helper, `osoba()`
included, and these four do not use it. The group composer allows 4,000 characters, its
counter reads "/ 2.000", and past 2,000 the send button just greys out with nothing turning red — the
limit (`groupBody`, 1–2,000) is right, the field is not. Availability shows raw ISO dates and seconds
("Od 2026-09-21", "2026-09-21 · 22:00:00 → …") and the raw zone name ("Europe/Belgrade") where the rest of
the app formats them. A finished Dogovor card always says "ocena pomaže drugima da izaberu", also after
the person has rated.

**8.23 — note, verified and well built.** Support: a create journals the exact command and retires it
only on a canonical receipt; the context entry reuses an existing case for the same reference instead of
opening a second; operator actions render only when the case says this viewer may take them; a message
chosen as evidence is shown before it is attached. Group conversation: the body is never written to disk
(four opaque fields are), and a message is marked read only when it was actually on screen for 600 ms.
Push preferences: every claim holds against `private.emit_event` — a disabled category suppresses both the
in-app row and the push, quiet hours apply only to push, and the lock-screen text is the generic line the
transport sends. The worker AI screen's review lists exactly what the save writes.

#### `src/ui` — the rest: location and maps, media, AI conversation, home, system, settings, auth, entry

Read in full: `location/*` (9 files), `AgreementPrivateLocation.tsx`, `media/*` (3), `aiFirst/*` (5),
`home/*` (3), `system/*` (11), `settings/SettingsPresentation.tsx`, `legal/legalReview.ts`, `auth/*` (4),
`entry/*` (7), `referenceEntry/*` (2), `v2/{IntakePresentation,ApplicationSelectionPresentation,
DiscoveryMap(.web,.types),V2Action,icons,tokens,spojInboxArt}`, `Button`, `Press`, `Text`, `InboxBell`,
`BuildIdentity`. With them: `supabase/functions/_shared/mediaImageSanitizer.mjs` and its use in
`uskoci-media`. **All 107 files in `src/ui` are now read.**

**8.24 — note, copy.** Smaller things a person reads:
"Tvoje prijave trenutno nisu učitani." — Home and Moje aktivnosti build "`${what} trenutno nisu učitani.`"
and one of the subjects is feminine. The intake's point ask says "Dve tačke, dva dodira." for any task
with more than one point, and a multi-stop route can have up to twenty-two. The AI conversation's text
field says "Napiši šta ti treba ili šta da promenim…" on the worker profile too, where the question on
screen is "Čime se baviš?". More fixed plurals: "{n} konkretnih ponuda · još {n} ljudi" and "{p} / {u}
ljudi" on the candidate list, "{n} nepročitanih" in the bell's spoken label. The map picker prints the
raw coordinates under the map ("Geografska širina 44.812345; …") to every sighted user, not only to a
screen reader. The entry's waiting line "Pripremamo prijavu…" uses "prijava" for signing in, the word the
rest of the app keeps for an application. And the copy assumes a man throughout — "Objavio zadatak",
"Uskočio", "Već si se prijavio", "Dostupan sam", "Nov na USKOČI" — while sign-up alone writes
"pročitao/la"; whether that is a decision is the owner's to make, it is recorded here because it is
consistent everywhere except one place.

**8.25 — note, accessibility, measured.** `system/tokens.ts` documents nine text/background contrast
pairs; recomputed from the hex values, all nine hold (12.45, 5.68, 6.42, 5.59, 5.11, 2.44 as the stated
defect, 5.98, 5.91, 7.84). One pair outside that table fails: the hint under "Objavi zadatak" on the Home
tile, `#584022` on the orange `#FF850F`, is 3.97:1 — below 4.5 for text that size.

**8.26 — note, verified.** "Fotografije su privatne za ovaj Dogovor; uklanjamo metapodatke" holds: the
media worker decodes every upload server-side with ImageMagick, auto-orients, then `strip()`s EXIF, GPS,
XMP, ICC and comments before storing a re-encoded JPEG (1600 px edge, quality 82), and the phone also
re-encodes with `exif: false` before sending. The worker's area search drops every precise coordinate
before anything reaches state (two decimals only), and refuses the whole answer if any candidate is in
another country. The map pin really can be dragged (native projection both ways), as the conversation
tells a person it can. `referenceEntry/ReferenceEntryHero.tsx` and its data file (about 540 lines) are
imported by no production file — one test mocks them — which matches AGENTS calling that directory an
older donor; `entry/BrandScene`'s `BrandScene` component is likewise used only by a test. `v2/icons.tsx`
says of itself that it is no longer drawn and is kept on purpose as a supplied asset.

#### Hooks, stores, lib, features, contracts, bootstrap — read in full

All 11 hooks; `store/{sesija,uloga,pendingRoute,povratniCilj,passwordRecoveryIntent}`; all 16 `lib` files;
`features/voice/{holdToTalk,nativeSpeechAdapter,speechProtocol,useHoldToTalk}` and
`features/media/nativePhotoPicker`; the runtime parts of the 23 `contracts` files (the rest are types);
`bootstrap/*`; `theme/tokens.ts`. With them: `private.need_fact_registry`.

**8.27 — rule, needs an owner decision. Three answers to "in which zone is an agreed time shown".**
`lib/dogovorenoVreme.ts` pins Europe/Belgrade for a worker's proposed window and argues that a TERM
"must read the same on both phones". `agreementClientService` shows the accepted Agreement window in the
reader's own phone zone and argues that this "is what a time is read in". `dogovor/[id].tsx` pins Belgrade
again for the confirmation deadline, and the Agreement-change screen types and shows the new terms in the
device zone. Both comments are reasoned; they contradict each other. For two people in Serbia every one
of them prints the same clock time; for a person abroad the same Dogovor reads two ways on two screens.

**8.28 — note, verified.** The client fact registry (`NEED_FACT_V2_DEFINITIONS`, 23 keys) matches
`private.need_fact_registry` exactly — every key, value type, required-for-draft flag and privacy class.
The session store bounds its restore at 8 s and counts every change of identity, so A→B→A is visible to
every guard. `povratniCilj` keeps NEED, DOGOVOR and REQUESTER_DRAFT return targets that no code ever
writes — its only writer stores `{ kind: 'NONE' }`, as `pendingRoute.ts` itself says; after signing in the
entry choice opens `/mapa` or `/nova`, and a remembered route wins over both. Speech is Android-only (the
native module `UskociVoice`); on iOS the microphone reports "Govorni unos još nije povezan". The token
travels in a WebSocket header, never the URL; audio is PCM in bounded chunks; nothing spoken is sent to
the conversation until the person presses Pošalji. The photo picker reads nothing from EXIF, re-encodes
before upload, and deletes only its own cache copies. Motion tokens exist (`press 120`, springs), and seven
production files use the animation runtime.

Area 8 is complete: 48 route files, 107 screen files, 11 hooks and the client support code.

### Area 11 — Edge functions, file by file (complete)

Read in full: all 18 files in `supabase/functions` (3,281 lines) — `uskoci-ai-interview`,
`uskoci-worker-interview`, `uskoci-qa-classify`, `uskoci-publication-evaluate`, `uskoci-media`,
`uskoci-location-search`, `uskoci-speech-session/{index,proxy}`, `uskoci-account-closure-worker/{index,closure}`,
`uskoci-data-export-{worker,download}`, `uskoci-push-transport`, and `_shared/{geminiTaskStream,aiTestBudget,
data-export,mediaImageSanitizer}`. With them: the deployed list (11 functions, all `verify_jwt = true`,
matching the 11 in the repository), `rpc_ai_test_budget_reserve_service`, `private.ai_test_budget_v5`,
`rpc_claim_ai_task_review_evaluation_service`, the review-command and turn-command state counts, and the
last 24 h of function logs.

**11.1 — defect, the mechanism behind 8.17.** Every AI call is cut at a hard 12 seconds: the shared stream
(`_shared/geminiTaskStream.ts`, `setTimeout(stop, 12000)`) and the non-streaming path (`boundedJson(…, 12000)`)
alike. Once a turn is dispatched, no failure moves it out of `PROCESSING`: in `uskoci-ai-interview`,
`retireAttempt()` returns at once when `dispatchUncertain` is set; `uskoci-worker-interview` calls `fail()`
only for unparseable output, so a timeout, a provider error, a dropped client or a refused completion all
leave the turn running; `uskoci-qa-classify` answers 502 without failing on a non-`STOP` finish or invalid
output. With no sweep (8.17), that turn then blocks its conversation and the account's closure. Measured on
`private.ai_need_turn_commands`: the 122 successful intake turns took 2.5 s at the median, 4.7 s at p90 and
11.0 s at worst, claim to completion — the slowest success one second under the ceiling — and 15 of 137
dispatched turns ended without an answer (12 later cancelled by the person, 3 still stuck). The function
logs for 13–16 September are no longer retained (the 24-hour window holds no AI failure line), so which
failure each of those was is not established here; the ceiling, "never fail after dispatch" and "no sweep"
together are enough for one slow answer to freeze a conversation. Fix shape (Edge and SQL, needs approval):
a ceiling that fits the answers actually seen, a dispatched-and-failed state for a definite local failure
(timeout, provider error) that still forbids a second paid call but stops blocking, and the sweep in 8.17.
**Only the sweep is done (PKG-027b, applied 2026-09-21).** The 12-second ceiling and a dispatched-and-failed
state are not changed; they still need their own decision.

**11.2 — risk, latent.** The publication evaluator has one 12-second deadline for everything: auth, context,
downloading up to six photos, and a Gemini call at `MEDIA_RESOLUTION_HIGH`. Its claim moves an accepted
review to `EVALUATING` with a 60-second lease, and `rpc_claim_ai_task_review_evaluation_service` re-acquires
only from `ACCEPTED` — so an evaluation that times out after claiming answers "EVALUATOR_UNAVAILABLE" for
that review forever, and the person has to prepare a new review. Not reached yet: no review is stuck in
`EVALUATING` (9 published, 2 evaluated, 4 accepted), and no task has ever been published with a photo (0 of 18).

**11.3 — risk, copy.** `uskoci-media` holds a single module-level `busy` flag, shared by every person whose
request lands on that isolate. While one upload is being sanitized, anyone else's upload gets 429
`MEDIA_UPLOAD_PENDING`, which the app shows as "Prethodno slanje još nije potvrđeno. Osveži prikaz." — about
an upload that person never made; for Agreement photos the code is `MEDIA_BUSY`, which the app does not map.
Serialising ImageMagick's memory is a reasonable reason; the sentence it produces is not true.

**11.4 — note, the gates.** Every paid path is behind environment flags whose values cannot be read from
here: `USKOCI_GEMINI_PAID_TEST_ENABLED` (all Gemini), `USKOCI_SPEECH_CONTROLLED_TEST_ENABLED` (speech),
`USKOCI_QA_CLASSIFIER_ENABLED` (questions), `USKOCI_GEMINI_IMAGE_REVIEW_ENABLED` (photos at publication),
`USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED` (the closure worker — which, per 6.1, nothing invokes either). The
model is pinned to `gemini-3.8-flash` in four functions and `gemini-3.5-transcribe-live` for speech. The
test budget's $5 ceiling is not enforced (`reservation_cap_enforced = false`, the owner-requested removal
recorded in commit 8b14ac54); holds stand at $5.13 against it, and nothing but the flags limits further spend.

**11.5 — note, verified and well built.** Location search keeps its key on the server, uses the fixed EU
endpoint, rate-limits per person, and refuses the whole answer if any candidate is in another country —
also for a reverse lookup near a border, which then reads "Predlozi trenutno nisu dostupni". The export
download buffers the file and re-checks authority before releasing a byte. The closure worker never
repeats a destructive request and settles each step by a separate read. The speech proxy keeps the Gemini
key on the server (in the provider's own WebSocket URL form), bounds audio and transcript, and settles cost
from the audio actually forwarded. The Edge functions' own error sentences are formal ("Prijavite se…",
"Sačekajte…"), but the app never displays an Edge `message` — it maps codes — so no person reads them.

### Area 12 — Server functions, all of them (complete)

Read in full: every function in `public` (235) and `private` (245), from `pg_get_functiondef` on the live
server, in 24 consecutive batches ordered by name, with the live rows each claim below depends on. Findings
already recorded elsewhere are not repeated: the stale-application price door (3.1), the Q&A status set
(7.47), the notification copy inventory (8.13), stuck AI turns (8.17, 11.1), HITNO and matching (9.x).

**12.1 — defect, measured. A task stops looking for workers by itself about twenty minutes after it is
published, for good.** *(Corrected 2026-09-21: the first version said "about two hours", reading only
`dispatch_tick`; the rounds on DEV show the real mechanism.)* `private.dispatch_next_wave` inserts a
`dispatch_rounds` row for every check and counts every row — including a check that found nobody
(`STOPPED / NO_ELIGIBLE_CANDIDATES`) — against the four-wave budget (`waveSizes` 5, 5, 10, 20). So the fifth
check returns `WAVES_EXHAUSTED` and `private.dispatch_tick` deletes the task from `private.dispatch_schedule`;
its own give-up after eight attempts is never reached. Measured: each of the 12 open tasks has exactly four
rounds, all empty, spanning 16–18 minutes after publication, and none since. Only three things ever put a task back in
that queue: a change to the task (`enqueue_on_need_change`), a withdrawn application
(`rpc_withdraw_response`) and a cancelled Agreement (`rpc_cancel_agreement`) — verified by sweeping every
body for `enqueue_dispatch(` and `insert into private.dispatch_schedule`. Nothing a worker does — declaring
availability, widening the radius, activating a profile — re-queues anything. Live: 12 open tasks, 0 rows
in the queue. So none of the 12 will ever be offered to anyone again automatically, whatever the workers
change; 9.4's "depends on workers keeping availability current" is true only for the first twenty minutes.
Also, the error branch of the same loop retries every 10 minutes with no limit (the give-up at 8 is only in
the "no candidates" branch). Fix: PKG-027a (approved 2026-09-21) — empty checks no longer count as waves,
no give-up, at most six hours between checks, and a worker's changes re-queue at once. **Applied
2026-09-21**; all 12 open tasks are back in the queue. The error branch is unchanged (every 10 minutes,
no limit). receipt `supabase/operations/dev-alpha/ledger/20260921_pkg027_application.receipt.json`.

**12.2 — defect, the assistant's own incomplete work (pkg025). Editing a task loses or refuses its price
basis.** `rpc_ai_open_need_edit_conversation_v2` seeds the edit conversation from the live task with one
`case` per registry key; of the 23 keys only `need.price_basis` has no branch (`need.resolved_location` is
cloned separately after the loop — verified against `need_fact_registry`). The edit writer
`rpc_confirm_need_edit_from_review` then sets `price_basis` from the fact, or NULL when the fact is absent.
So an edit of a "po osobi" task that the AI does not re-ask about silently turns it back into the old
null-basis rule. The opposite case is refused: `price_basis` is in none of the "material" definitions —
`need_material_snapshot`, `need_full_edit_snapshot`, `need_publication_fingerprint_snapshot` (and so
`need_edit_base_marker`), nor `guard_need_write`'s list — so an edit whose only change is TOTAL ↔ PER_PERSON
is refused with `NO_MATERIAL_CHANGE` (which the live path shows as "Ishod radnje nije potvrđen", 7.21), and
the publication decision is blind to the basis. *(Corrected 2026-09-21: the first version also said the
owner's own list lacks the basis. `rpc_list_my_needs_page` does omit it, but the app never calls that
function — it reads its own tasks directly with `price_basis` (`needClientService.ts:118,136`) — so nothing
is missing on screen.)* Not hit yet: all 18 tasks have a null basis. Fix: PKG-027e (approved 2026-09-21).
**Applied 2026-09-21.** The edit opens with the task's basis, and the basis counts as a material change. It
is still not in the publication fingerprint, on purpose (see the PKG-027 contract).

**12.3 — defect, the specific cause of the stuck worker-profile turn in 8.17.**
`rpc_fail_worker_ai_turn_service` fails a turn only `if t.state='PROCESSING' and t.lease_expires_at>=
clock_timestamp()` — only while the 60-second lease is still running. After the lease the call does nothing;
`rpc_complete_worker_ai_turn_service` raises `WORKER_AI_TURN_STALE` without changing the state; and
`rpc_claim_worker_ai_turn_service`, `rpc_patch_worker_ai`, `rpc_prepare_worker_ai_review` and
`rpc_save_worker_ai_review` all refuse while a `PROCESSING` row exists. `rpc_open_worker_ai` reopens the
newest OPEN session, so the person lands in the frozen conversation every time. Live: the QA account's turn
of 2026-09-16 20:47:59 (lease to 20:48:59) is still `PROCESSING`, conversation OPEN, last message the
person's, no reply. The intake side has the opposite, sensible rule (complete after the lease → `FAILED`).
**Applied 2026-09-21: PKG-027b.** That turn (lease to 20:48:59) is now `FAILED`. The sweep got it within
three minutes of the apply. `rpc_fail_worker_ai_turn_service` is unchanged on purpose, because the sweep owns
expired turns.

**12.4 — defect, invented public text.** `handle_uskoci_auth_user_created` writes a headline and a bio the
person never wrote into both profiles at sign-up. The current body uses neutral sentences; every live
profile still carries the older ones — all five worker profiles "Spreman da uskočim kada se dogovor jasno
postavi." / "Dostupan za poslove koji odgovaraju profilu i kalendaru." (masculine), all five requester
profiles "Tražim pouzdanu pomoć uz jasan dogovor." / "Novi član USKOČI zajednice.". `rpc_get_public_profile`
returns the worker's headline and bio, `publicProfileClientService.ts:42` maps the headline and
`PublicProfileSheet.tsx:46` shows it — so every requester reads a sentence about each worker that the worker
did not write. `worker_ai_initial` hands the invented bio to the profile AI as the person's own. A missing
name becomes "USKOČI korisnik", which satisfies `rpc_complete_worker_profile`'s two-character rule, so a
worker can go ACTIVE under that name. Fix shape: empty defaults, and a one-time clean of the stored text
(both need approval).
**Applied 2026-09-21: PKG-027d.** Sign-up writes empty strings; all 10 DEV profiles had only invented
sentences, and now have an empty headline and bio. The public profile already returns null for empty. The
"USKOČI korisnik" name default is not changed.

**12.5 — defect. The Q&A contact filter reads dates and price ranges as phone numbers.**
`private.ru4b_public_floor_reason` refuses `\+?[0-9][0-9 ()/.\-]{6,}[0-9]` as `PHONE_NOT_PUBLIC`. Measured
on the live function (pure, no writes): "Da li može 12.10.2026 posle podne?" → `PHONE_NOT_PUBLIC`; "Cena
15000 - 20000 je ok?" → `PHONE_NOT_PUBLIC`; "Treba 2 radnika od 8 do 16h" → allowed. It guards both the
worker's question and the owner's answer. Not reached yet: no question was ever asked on DEV
(`qa_ai_commands` is empty).

**12.6 — defect, addendum to 3.1.** Beyond the price rules, `rpc_resolve_stale_response_after_need_edit`
(called by `ru4Production.ts:93`) also skips the world check, the profile readiness check (name, city,
skills) and the application evidence snapshot — so a re-confirmed application shows as `LEGACY_UNPROVEN` in
`rpc_list_need_candidates` — and its WITHDRAW notifies no one, unlike `rpc_withdraw_response`. Never used on
DEV (`response_revision_resolution_commands` is empty).

**12.7 — defect, latent. Remote or physical is decided from the schedule, not the place.**
`rpc_select_response` creates `agreement_execution.mode = 'REMOTE'` only when `schedule_kind =
'REMOTE_ANYTIME'`, otherwise `'PHYSICAL'`, ignoring `execution_location_mode`. A remote task scheduled
"danas" would get live-location sharing (allowed only for PHYSICAL/PICKUP_DELIVERY); a physical task marked
REMOTE_ANYTIME would lose it. `PICKUP_DELIVERY` is never produced. Live: no remote task; the 3 Agreements are
PHYSICAL and correct.

**12.8 — defect, small. One guard is not null-safe.** `guard_remaining_search_close_fields` raises only
`if current_setting('uskoci.need_lifecycle', true) <> 'CLOSE_REMAINING_SEARCH'`; with the setting never set
the comparison is NULL (measured) and the guard lets the write through. `authenticated` holds column UPDATE
on the three `remaining_search_*` columns and `needs_owner_update` limits it to the owner's own DRAFT, so the
reach is a person stamping their own draft. Every other guard in the schema uses `is distinct from` (swept).

**12.9 — risk. Closing the remaining search tells no applicant.** `rpc_close_remaining_search` moves every
open application of the task, including those awaiting stale review, to `EXPIRED` and emits no event; the
workers learn it only by opening their list. `rpc_cancel_need`, by contrast, notifies each one.

**12.10 — risk. "Prepare" and "start" disagree about a running job.** `account_closure_preparation` reports
`PENDING_WORKFLOW` only for a running intake turn; `closure_blockers_v5`, which gates the start, also counts
worker-profile and Q&A turns and a running export. An account whose only running job is a worker-profile
turn (12.3) is shown as ready, then refused at start with `CLOSURE_BLOCKED`.

**12.11 — note, verified. Test and real accounts never see each other — and the real side is the owner
alone.** `rpc_list_open_tasks_v3` is SECURITY INVOKER, so RLS decides: `needs_public_discovery` requires
`private.viewer_same_world`, and `rpc_submit_response` re-checks `accounts_same_world`. The REAL world today
is the owner's two accounts: personal (worker profile ACTIVE) and business (worker profile DRAFT, so it
cannot apply). Live: 8 of the 12 open tasks belong to the owner's personal account, and no account that can
see them is able to apply — the three ACTIVE test workers (QA and fixtures) are in the TEST world and never
see them. So a real task published from the owner's phone cannot be answered from the QA account; the first
real applicant needs a second real person. Two readers skip the world check and answer any signed-in account that knows a task id:
`rpc_read_preselection_qa_context` (title, revision) and `rpc_ru4b_public_preselection_qa` (answered
questions).

**12.12 — note, copy and small data points.** `media_write_task_refs` and the edit opener label photos
"N fotografija" — "2 fotografija", "3 fotografija". The edit opener's display values are raw: "MY_PRICE",
"FIXED_WINDOW", an ISO timestamp, "STATIONARY". `data_export_snapshot` still exports `app_accounts.active_mode`
as `activeMode` — the removed global mode; every account holds "requester". The sign-up trigger still writes
it. `match_detail_without_calendar` compares the task price with a worker's minimum fee without the basis or
the number of people, and counts a task with no required skills as a service match for every worker (+30).

**12.13 — note, verified and good. The grants are tight.** Of 235 `public` functions, `anon` can execute 3
(`my_cloud_profile_bundle`, invoker, returns nothing without a user; the pre-request hook
`rpc_closure_api_guard`; `rpc_get_legal_bundle`), `authenticated` 159. All 52 `*_service` functions and every
function taking `p_account_id` are closed to both — except `rpc_get_account_reputation`, a read. `authenticated`
has no USAGE on schema `private`; its one EXECUTE there is `viewer_same_world`, used inside the discovery
policy. Several service functions have no internal role check and rely on these grants alone
(`rpc_ai_claim_need_turn_v2_service`, `rpc_claim_qa_classification_service`, `rpc_set_retention_hold` …) —
correct today, one widened grant from wrong.

**12.14 — note, dead or switched off.** `rpc_ai_publish_need` (always `PACKAGE_4_NOT_READY`), `rpc_publish_need`,
`rpc_ai_propose_fact` and `rpc_propose_agreement_change` (v1) are retired stubs; `ru4b_assert_rate_authority_ready`
always raises and has no caller; `identity_admitted` is constant false, so "verified identity" tasks cannot be
created; `urgent_activation_policy` is off (9.1). `guard_profile_write` forces `account_type = INDIVIDUAL` with
no path to change it.

**12.15 — note, limits worth knowing.** Title 140, description 6,000, price 1–100,000,000 RSD, 1–50 people;
worker AI and intake AI 6 turns a minute; Q&A 500/1,000 characters, 10 questions a day, 3 per task, 60 s
apart; support 5 cases a day (privacy requests exempt); push at most 10 devices per account, never two
accounts on one token; reviews 1–5 with up to 3 of 6 fixed tags; the requester has 48 h to confirm "gotovo".

**12.16 — note, well built.** Every command is idempotent by (account, request id, input hash) and refuses a
reused key with different content; every multi-row write takes locks in one documented order (task →
agreement → response); publication re-proves the whole provenance chain (newest decision, fingerprint,
current policy bundle, rule snapshot) at the moment of publishing; push is at-most-once — a send that may
have happened is never resent; closure erasure deletes storage before relational redaction and identity last.

Area 12 is complete: 480 functions.

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
**Candidate proven 2026-09-21, not applied: PKG-028a.** On the disposable stack, a confirmed deletion reached CLOSED through the tick alone, in 75 calls (about an hour and a quarter at one a minute). `docs/implementation/v5-ai-first/pkg028/PKG028_WORKERS_AND_PAST_TASKS.md`.

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
**Candidate proven 2026-09-21, not applied: PKG-028b.** Expiry at the end of a fixed window; a past start refused at publish; the client says it before the paid check. On canonical DEV the three tasks above would expire, all the owner's own and none with an application. The relative kinds (`TODAY_FLEXIBLE` and the others) have no date and remain open. `docs/implementation/v5-ai-first/pkg028/PKG028_WORKERS_AND_PAST_TASKS.md`.

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

**4.2 — defect, systemic. Three deployed Edge workers have nothing that runs them.** *(Partly corrected
by 7.46: the data export worker also has an on-demand path the app calls, and the export is stuck for a
different reason.)*
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
**Candidate proven 2026-09-21, not applied: PKG-028a** (run 35602743935). A minute tick calls each worker that has work with the service key the owner stores in Vault. Applying it needs the owner's yes, plus the key and the closure switch. `docs/implementation/v5-ai-first/pkg028/PKG028_WORKERS_AND_PAST_TASKS.md`.

**4.3 — rule. The one push text that would ever reach a phone is formal.** `uskoci-push-transport`
line 108 sends, for every event, `title: 'USKOČI', body: 'Imate novo obaveštenje. Otvorite aplikaciju.'`.
The generic body is deliberate — no recipient, payload or URL leaves the server — but it breaks the owner's
"ti". `src/ui/notifications/PushRuntime.tsx` already recognises both `'Imate …'` and `'Imaš novo obaveštenje.
Otvori aplikaciju.'`, so the sender can move to the informal wording without breaking recognition of pushes
already queued.
**Applied 2026-09-21:** Edge `uskoci-push-transport` v12 sends "Imaš novo obaveštenje. Otvori aplikaciju.", byte-identical to the repo. Push has still never run on DEV (4.2).

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
**Applied 2026-09-21 (PKG-027c)** for the notification text. The exception hints are unchanged; the client never displays them.