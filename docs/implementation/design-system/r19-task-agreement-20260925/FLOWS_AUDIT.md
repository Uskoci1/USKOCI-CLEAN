# R19 bounded flow audit: notifications, safety, selection, cancellation and rating

Date: 2026-09-25. Initial read-only inspection of the working tree based on HEAD `5ca735315684473a2e90e31325230c6d46636373`, while R19 integration was in progress. The owner subsequently authorized the two narrow client fixes recorded in the final addendum. This report does not certify the whole application, all SQL bodies currently deployed, or a later APK. No devices, database data, keys, Edge functions or provider calls were changed or run for this audit/fix batch.

The earlier discovery/profile/chat cost audit and JPEG transport review are deliberately not repeated. See `FUNCTIONAL_RECONCILIATION.md`, `PROFILE_SCALING.md` and `BINARY_REVIEW.md` for those subjects.

## Evidence levels

- **Source verified:** the route, handler, service decoder or SQL body was read. This establishes the implementation path, not successful production delivery.
- **Historical server contract:** frozen migration bodies plus later candidate replacements and recorded application receipts. These are forward history, not a fresh `pg_get_functiondef` attestation. An old function body must not be presented as the current server when later replacements exist.
- **Native exercised:** `../r18-continuity-20260925/REAL_JOURNEY.md` and its captures record one authorized task with two actual accounts on phone and emulator, source `74f514d79fa323e135c9ddc23a6cb6b5b934c730`.
- **Fresh DEV observation:** `LIVE_PREFLIGHT.json` reports ledger **202 / 55 dev_alpha**, latest version `20260924202023`, and Edge metadata. The private certificate query was denied with `42501`; retention in that combined query was not measured. `ACTIVE` push-worker metadata is not evidence of delivery to a phone. The historical `docs/control/dev_snapshot.json` remains historical.

The R18 journey passed: remote, flexible end-only, one participant, OFFERS, 100 RSD; publication, worker offer, owner selection, both-direction messages, worker completion, owner confirmation and both saved five-star ratings. It also demonstrated a real eligibility refusal and successful application after the owner authorized the missing real phone tool. It did **not** exercise competing offers, a multi-person offer, cancellation, disputes, block/report, OS push, iOS or the full interruption matrix.

## Reachable user paths and contracts

| User path | Current route and source ownership | Server contract used | Actual completion evidence / limit |
| --- | --- | --- | --- |
| Open notification inbox | `src/app/obavestenja.tsx` → `useInbox.ts` → `inboxModel.ts` → `inboxClientService.ts`; `InboxPresentation.tsx` renders a FlatList | `rpc_list_inbox`, `rpc_mark_activity_event_read`, `rpc_mark_inbox_read`, `rpc_resolve_activity_event` | Real in-app events appeared during R18. Page/read/resolver paths are implemented; this audit did not perform 1,000-event or account-switch native acceptance. |
| Tap a phone notification | `PushRuntime.tsx` accepts only the generic `{ kind: 'INBOX' }` payload; account/revision/session ownership gates navigation. Cold start also records `/obavestenja` in pendingRoute | Device registration/reconciliation via `pushDeviceClientService.ts`; a tap itself does not claim an entity read or delivery receipt | Opens Inbox, then the server resolves the chosen event. No arbitrary payload URL or target is trusted. OS delivery and tap after cold start remain a separate physical-device gate. See NF-01. |
| Enable phone notifications | `/profil/obavestenja` → `PushPreferences.tsx` → `nativePushDevice.ts`, preferences and device services | Existing session-device read, explicit register/rotate/revoke; `rpc_get_push_readiness` describes transport only | Permission is requested by explicit enable action, not mount. Emulator is intentionally unsupported. A saved preference, token, ready transport or HTTP 200 is not sufficient proof of visible notification delivery. |
| Report/block from task or public person | `prilike/[id].tsx` and `potrebe/[id]/kandidati.tsx` supply `useSafetyEntry`; `PublicProfileSheet.tsx` exposes the same entry; `/bezbednost` validates target/context | `rpc_read_safety_target` resolves visible profile → account target; `rpc_get_account_block`, `rpc_set_account_block`, `rpc_submit_safety_report` | These entry points are present: the old claim that safety is reachable only from a Dogovor is obsolete. PKG-047 records the server bridge as applied. Native report/block acceptance is not supplied by R18. See SF-01/SF-02. |
| Report/block from Dogovor | `/dogovor/[id]` uses the verified opposite participant account, then `/bezbednost` | Same account-scoped safety commands; report context is validated again by the server | Distinct from reporting a work problem to the other participant. No new report or block was submitted in this audit. |
| Recover a private report | `SafetyScreen.tsx` → `safetyClientService.readReportCommand` | `rpc_read_my_safety_report_command`, keyed to the caller's opaque command UUID | Only the UUID is persisted locally; text is not copied into storage. Confirmed receipt clears fields. Existing `rpc_get_my_safety_report` is not needed to make this recovery entry reachable; it is not a full moderation-progress UI. |
| View/unblock blocked people | `/profil/blokirani` → `BlockedAccountsList.tsx`; named confirmation before unblock | `rpc_list_my_account_blocks` with cursor; revision-bound `rpc_set_account_block` | One page is at most 50 items, with explicit next/start actions and recoverable errors. A successful unblock receipt is distinct from a failed list reload. Do not generalize the missing confirmation on SafetyScreen to this screen. |
| Submit an offer | Opportunity composer → `applicationSelectionClientService.podnesiPrijavu` | `rpc_submit_response`, expected task revision, immutable request key, slots/price/time/scope, validated receipt/version/hash | Real R18 offer and eligibility refusal exercised. All team/price-basis/time combinations are not thereby accepted. Existing 4000-character scope and server rejection rules are preserved. |
| Choose and compare applicants | `/potrebe/[id]/kandidati` → `candidateClientService`, `ApplicationSelectionPresentation.tsx`; one selected offer opens its review/confirmation | `rpc_list_need_candidates`; `rpc_select_response` binds task revision, response version/hash and request ID | R18 selected one offer and opened its Dogovor. Comparison is one/two columns according to width/text scale, and FlatList is virtualized. Candidate transport remains unpaged: see AF-01. |
| Recover an uncertain selection | Candidate route retains the original command in its session and offers explicit outcome check/same-command retry | Canonical selected agreement lookup plus server semantic selection idempotency | No optimistic Dogovor is fabricated. This is source evidence; killing/restarting during selection and two concurrent final-slot selections were not performed in R18. |
| Change/cancel a Dogovor | `/dogovor/[id]/izmene` → `AgreementActionsScreen.tsx` → `AgreementActionsController.ts`/`agreementActionsModel.ts` → `agreementClientService.ts` | Current workspace actions; proposal/respond/withdraw commands and `rpc_cancel_agreement` | Editable form → review → explicit command. An opaque/hash journal survives restart; uncertain results require canonical re-read, and reentered payload must match. Cancellation was not executed by this audit or R18. |
| Report a work problem | Inline Dogovor action → `agreementProblemService` in `agreementClientService.ts` | `rpc_report_problem`, then current problem/workspace read | Bilateral work issue, not the private safety report. Source retains one attempt and checks canonical outcome. Operator resolution of a disputed job was outside this audit; a visible report form is not end-to-end resolution evidence. |
| Complete and rate | Dogovor next action → completion service; `/oceni-dogovor` → `AgreementReviewScreen.tsx` → `reviewsClientService.ts` | `rpc_get_my_agreement_review`, `rpc_submit_agreement_review`, reputation reads | Worker finish, owner confirm and both saved ratings were actually exercised in R18. Written review comments are absent from this client contract, rather than silently available behind the star screen. |
| More than two people in a task | Dogovor group entry → `/dogovor/[id]/grupa` → `GroupConversationScreen.tsx`/`groupConversationService.ts` | `rpc_read_group_context_v5`, message pages, command recovery/send and visible-ID read marking | Source includes an explicit group path, members, per-agreement management and history. Group runtime/controller/SQL behavior was not exhaustively audited or exercised here. A single worker offering several slots does not establish accounts or independent ratings for every person they bring. |

## Notifications: what is already connected

The inbox route branches on the server's validated target, not raw notification payload IDs:

- Clarification events open task questions, with the correct own/public context.
- A cancelled-task event whose old target was an opportunity opens the worker's applications.
- A proposed Agreement change opens `/dogovor/[id]/izmene`.
- A message opens `/dogovor/[id]?tab=poruke`; other Agreement events open the overview.
- Application, candidate, own-task and public-task targets each have explicit routes.

The source resolver in `supabase/candidates/pkg045a_task_read_contract.sql` first looks for the caller's visible in-app event. Agreement targets require participation. Response targets choose an existing participant agreement, the worker's application or the owner's candidates. Unavailable targets are not invented. Later PKG-045b pins this resolver; this audit has not independently re-attested its deployed body.

Inbox paging is real: service page size 30, paired `(occurredAt, id)` cursor, duplicate-ID rejection, model deduplication and explicit older-page action. SQL source limits pages to 100 at maximum. Read-all is bound to the response's `asOf` and role, so it does not intentionally acknowledge events that arrived after that page snapshot. Role/account/focus epochs retire late responses.

At 1,000 notifications this is incremental paging, not an automatic 1,000-request burst or 1,000 mounted rows. Loaded pages accumulate in memory as the person asks for them; no load/battery benchmark was run. Server count/query cost and current indexes were not freshly profiled.

Push completion still needs one controlled physical-device sequence: supported build/configuration, explicit OS permission, server device registration, an authorized event, provider acceptance and receipt, visible lock-screen notification, tap to current-account Inbox, then event to correct destination. Repeat cold/warm start and account change. Do not enable general sending or manufacture events merely to close this checklist without the owner's scope.

## Source findings at the inspection cutoff

SF-01 and NF-01 were subsequently fixed in source; their original evidence is preserved below and the final addendum records checks. SF-02 and AF-01 remain open.

### SF-01 — delayed safety lookup can reopen a departed context

Priority: P2 interaction correctness; independently confirmed source path, not a new server-authorization finding.

`src/ui/safety/useSafetyEntry.ts:17` starts the request, and lines 21–29 unconditionally settle state and navigate after successful target resolution. There is no focus cleanup, unmount retirement, or profile/context generation guard.

**Trigger:** start “Prijavi ili blokiraj” on one person, then leave the route or change the profile/context supplied to the hook while the read is pending. A late same-account successful response can still navigate to the former person's safety screen. `readOwnedResult` protects an account change, but leaving a screen under the same account does not change that identity.

**Impact:** unexpected navigation and ambiguous target context at a sensitive action. No report/block is automatically submitted by this callback.

**Safe follow-up:** bind the read to the active route/profile/context, retire it on blur/unmount/change, and ignore late success/error. Preserve the server-owned target lookup. Add deferred-success tests for leaving/changing context. Existing `src/ui/__tests__/public-profile-safety-entry.test.tsx` covers success, unavailable, refusal and double tap, but not this lifetime.

### SF-02 — direct generic block action lacks a named confirmation

Priority: P2; already noted in R6/current gaps, still present in source.

`src/ui/safety/SafetyScreen.tsx:27–46` displays “Kontakt sa korisnikom” and submits `setBlock` on the first button press. The route has target/context IDs, but the screen does not display a verified person's name or ask for a final confirmation. A mis-tap can block a person immediately. `/profil/blokirani` already has a named confirmation; reuse its interaction approach where possible, without trusting a route string as authoritative identity.

The service correctly checks revision, exact receipt, caller and target; this finding is about what the person sees and confirms, not a claim that those server checks are absent.

### NF-01 — push tap can stack another copy of the Inbox

Priority: P2/minor; R6 finding independently still present.

`src/ui/notifications/PushRuntime.tsx:73` calls `router.push('/obavestenja')` for every accepted distinct notification tap. If Inbox is already open, another Inbox is pushed and Back returns to the same screen. The seen-ID guard prevents replay of one request, not navigation duplication from another notification.

**Safe follow-up:** use route-reusing navigation appropriate to the installed router, preserving cold pendingRoute handling, strict payload validation and account ownership. Check warm Inbox, another screen and cold-start cases. This audit did not change the route or rerun those tests.

### AF-01 — candidates are virtualized on screen but not paged over the network

Priority: P1 before high-volume marketplace acceptance; source-confirmed scaling gap, not measured latency or corrupt selection.

`src/data/candidateClientService.ts:130` calls `rpc_list_need_candidates(p_need_id)` once without cursor/limit and decodes the complete array before returning. The function body in `20260906010000_clean_ru5_selection_eligibility_revalidation.sql:191–353` aggregates all non-draft responses into one JSON value. It includes a public-profile read per candidate. PKG-035's replacement shares canonical candidate-state calculation but does not add pagination or bound the aggregate.

For one candidate this is small. For 1,000 historical/current responses on one task it still builds and transmits the full candidate document and computes per-row metadata/state. A 15-second route deadline can replace this with an error; it does not prove bounded server work. `ApplicationSelectionPresentation.tsx:180` correctly uses FlatList (`initialNumToRender=8`, batches of 8, window 7), so saying “all candidate cards render at once” would be wrong.

**Safe follow-up:** a separately approved server page/count/sort contract, then client cursor integration. Preserve the distinction between selectable and historical counts, exact version/hash selection, mixed team sizes, comparison, immutable pending selection and re-read after revision changes. Do not hide rows with a local cap or sort only a loaded page while calling it the cheapest overall.

## Selection, cancellation and rating: facts that must survive polish

1. **Selection is bound to the actual offer, not its painted card.** The current route freezes response ID/version/hash and task revision. The later semantic SQL implementation in `20260906100000_clean_p0d03_requester_connection_activation_v1.sql` includes requester-scoped request-hash replay protection, advisory command locking, locked task/response reads, current profile/team readiness, eligibility and overfill checks. The older pre-idempotency body must not be quoted as a new security hole. PKG-033 adds shared application-price checks to selection/stale resolution; PKG-029b fixes remote execution mode to follow place rather than schedule. Their application claims are historical receipts, not a new deployment by this audit.
2. **Slots are not the number of separately identified people.** One selected offer can cover several slots and creates one Agreement between the posting account and the selected worker account. Two selected accounts create distinct Agreements; grouping does not erase their separate accepted terms/completion/review rights. Test competing final-slot selection and combinations of team capacities before calling this native path accepted.
3. **Cancellation is not an ordinary form save.** The controller journals the normalized command before sending and re-reads state after uncertain outcomes. It treats canonical CANCELLED as confirmed and COMPLETED as incompatible; it does not claim the server acknowledged a specific actor's reason from status alone. PKG-031 prevents the task owner cancelling after worker “done”; UI actions come from current server workspace, and the server also rejects that path.
4. **The stored cancellation reason has a bounded existing contract.** PKG-032 writes it as a bilateral conversation message only when neither side is safety-blocked or closing, and truncates the prefixed message to 2,000 characters. The client permits a reason up to 4,000. Therefore “the full 4,000-character reason is always delivered” is false. This is the explicit candidate behavior, not a newly executed loss incident; any broader retention/delivery change needs a separate decision and server proof.
5. **Closing remaining search and task completion are already linked in recorded PKG-029b.** Completion compares completed selected slots with the selected total when remaining search is closed, and refuses completion with zero completed slots. The old blanket claim “closing search strands every task forever” is superseded. Multiple selected Agreements with one cancellation still need their own acceptance scenario.
6. **Ratings are real and account-based.** `reviewsClientService.ts` accepts integer 1–5, up to three server-catalog tags, explicit counterparty and UUID; it validates exact returned receipt. SQL requires both Agreement and execution completed, actual participant/counterparty and one review per author per Agreement. A later block does not revoke earned review entitlement. The review screen re-reads the saved receipt; R18 proved both sides' saved reviews. That does not prove every profile aggregate or written-comment feature.
7. **Group paths are separate.** Inspected group service accepts at most 51 members, 50 management items per page and 50 message items per page; participants must not receive owner management data. Visible-message read marking is bounded to 50 IDs. The group screen has account/revision/focus/background fences. Those source contracts cannot substitute for testing three actual participants, removal/cancellation and different visibility rights.

## Safety does have a downstream support path, but operations remain a gate

The private report is not simply an inert form. In the inspected historical support body (`20260913045824_clean_v5_support_case_authority.sql:215–233`), insertion creates one private SAFETY support case and its event via a trigger, keeping the narrative in the private report relation. The UI's statement that a report opens a support request is grounded in that implementation.

This does **not** establish that an operator is currently staffed/granted access, responded within a promised time, or can finish the full policy/appeal workflow in the deployed environment. No report was sent, no operator identity read and no live support decision made here. A moderation receipt is not a resolution or automatic sanction. Report context/body, personal contact details and legal data must not be copied into push payloads during UX simplification.

## Corrections to old or overly broad claims

| Claim to avoid | Evidence-bounded replacement |
| --- | --- |
| “Safety is available only from Dogovor.” | Task/public-profile/candidate safety entries now resolve their target through PKG-047; finish target presentation and lookup lifetime. |
| “Reviews are 0% implemented.” | Both sides saved real ratings in R18. Written comments and remaining UI/acceptance work are distinct. |
| “Workeri rade, so push is done.” | Worker/auth/cron/transport observations are layers. Visible delivery plus destination on a physical phone is still needed. |
| “PKG-050 installed builds do not call message read marking.” | That AGENTS paragraph describes its September 23 checkpoint. Current source calls the adapter; current read-boundary concerns are documented in the existing chat audit, not re-audited here. |
| “PKG-048 links are not in the app.” | That is historical prose. Current Dogovor workspace has task/application links; do not reimplement them from that stale paragraph. |
| “1,000 applications means 1,000 React cards mounted.” | Candidate FlatList is virtualized; the unpaged server aggregate/network/decode is the remaining issue. |
| “One two-account success means all participant flows passed.” | R18 covers its recorded one-person remote scenario only. Team capacity, competing offers, changes, cancellation, disputes, safety and push have separate gates. |

## Safest next order

1. Finish the existing R19 integration/build without adding a new server deployment. Preserve the source/device split in the receipt.
2. Integrate the two completed client fixes below with normal full checks and one build. The remaining safety presentation work is a verified target and explicit block confirmation; no extra APK for each line.
3. One authorized native acceptance batch: competing offers/final slots, team-slot offer, changed task/offer before selection, interrupted selection, cancellation before/after “done”, bilateral problem versus private safety, both ratings and back navigation. Use disposable test database for destructive/state-heavy permutations; do not mutate unrelated DEV work.
4. Complete the physical push path with the owner and exact source build. Record provider/receipt/device/tap evidence separately; keep general enablement an explicit operational decision.
5. Propose the candidate page/count contract with disposable proof and current-server preflight, then seek the required apply decision. This is additional to the separately recorded Discovery/Home scaling work.
6. Prepare the written review-comment server package only after defining maximum length, audience, reporting/moderation and retention. Do not add a text box that the current review RPC cannot persist.
7. Close support/legal/operator and store gates using their own evidence. This audit does not change their status or claim publication readiness.

## Exact coverage boundary

Read route/handler/service bodies for Inbox/PushRuntime/native registration/readiness/preferences; safety entry/screen/service/blocked list; candidate list/selection; Agreement actions controller/model and cancellation/problem service paths; review screen/service; and group route/screen/service contracts. Read relevant source SQL bodies for inbox visibility/resolution, safety target/block/report/support bridge, semantic selection, candidate projection/state replacement, price parity, lifecycle completion/cancellation and rating authority. Cross-checked R6 findings, current gaps, control statements, R18 REAL_JOURNEY and R19 live preflight.

Not a new exhaustive read of every function, worker, support controller, group controller, policy/index/trigger or Edge deployment. No new performance measurements were run; the report labels deductions from inspected source accordingly. The subsequent narrow regression checks are below. Native, deployment and integrated-test assertions belong to their linked receipts, not the existence of this document.

## Same-day source fix addendum — SF-01 and NF-01

After the report, the owner authorized exactly these two client corrections before the R19 build:

- `src/ui/safety/useSafetyEntry.ts`: a focus-owned scope now retires pending target resolution on blur/unmount and whenever profile, need or Agreement context changes. A rendered-context check also prevents a retained previous handler from reading the old target. Refocusing creates a new scope; an old success or error cannot navigate, clear a new pending request or overwrite the current error. The existing service remains responsible for account/target authority. Closing only a profile sheet without leaving its route or changing hook inputs is not claimed as a separate retirement signal by this patch.
- `src/ui/notifications/PushRuntime.tsx`: a validated tap now uses the installed router's `navigate('/obavestenja')`, reusing Inbox instead of pushing another copy. Strict public payload checks, seen-ID deduplication, current account/revision/session guard and cold pendingRoute handling are unchanged. This does not enable push or prove delivery.

Regression files: `src/ui/__tests__/public-profile-safety-entry.test.tsx` and `src/data/__tests__/push-runtime.test.tsx`. The new blur/refocus, profile change, context change, late-error and two Inbox-navigation assertions failed against the old runtime. An additional committed-unmount test passes with the fix; its unmount and late completion use separate React act boundaries. Existing successful lookup/refusal/double-tap and push privacy/account-ABA/lifecycle tests still pass.

Focused run: `npx jest -w 2 --testTimeout=30000 --runTestsByPath src/ui/__tests__/public-profile-safety-entry.test.tsx src/data/__tests__/push-runtime.test.tsx src/data/__tests__/application-selection-native.test.tsx` — **3 suites / 115 tests passed**. The actual candidate route verifies the new focus hook integrates with its existing lifecycle mock. The other candidate-route fixture already provides the same hook; public-detail route tests explicitly mock this hook, so no shared mock was changed. `git diff --check` passed for the four runtime/test files (only normal LF/CRLF checkout warnings).

`npx tsc --noEmit -p tsconfig.json` completed with exit code 0. Full integrated R19 tests/build and native tap/late-navigation acceptance are still the root integration's responsibility; this addendum does not mark them complete.
