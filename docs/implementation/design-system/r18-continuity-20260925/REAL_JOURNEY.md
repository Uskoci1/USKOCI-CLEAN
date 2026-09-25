# R18 — one real two-account journey, 25 September 2026

## Result and scope

The native success path passed: new task through the real AI interview, review and publication, another
account's offer, selection, messages in both directions, worker completion, requester confirmation and both
saved ratings. This is one REMOTE, flexible/end-only, one-person, OFFERS task; it is not complete app acceptance.
Both devices run source `74f514d79fa323e135c9ddc23a6cb6b5b934c730`. The physical phone and x86 emulator have
different ABI APK hashes from the same source/tree; they must not be described as the same binary.

The owner explicitly authorized one new DEV task from zero, necessary text AI calls for that task, use of
their existing two accounts, and addition of **Pametni telefon** to the worker's existing equipment. The owner
personally switched the phone account. No credentials were used by the agent. No new account, backend code,
schema, Edge function, payment, microphone, key, installed dependency or destructive cleanup was involved.

Phone: HONOR VKP_NX9, requester **Milos SLJIVIC**, APK run 36183495466. Emulator: existing USKOCI_V5_TEST,
worker **msljivic031**, APK run 36183499333. See APK.phone.json / APK.emulator.json for exact attestations.
Task title: **Test R18 - provera toka aplikacije**. It is explicitly a product test, not a real paid job or
customer endorsement. Test records and the approved profile equipment remain on DEV; nothing was erased.

## Executed path

| Step | Actual observation | Primary capture names |
| --- | --- | --- |
| Create | One text prompt produced a ready remote task draft requiring one smartphone-equipped person, offers, end 27 September 23:59. | phone/test-ai-answer-one |
| Review | Existing structured title editor set the explicit test title. Full review retained the end date; the compact draft's shorter date label was not evidence of lost server data. | phone/test-title-entered, test-review-facts |
| Publish | Publication succeeded; owner management showed the published task, other account saw it in Discovery without an invented map point. | phone/test-publish-result, published-task-owner; emulator/published-task-other-account |
| First offer | 100 RSD total, one person, explanatory test note. Eligibility refused it; an outcome check resolved the refusal. No offer was visible to the owner. | emulator/worker-offer-confirm, worker-offer-sent, worker-offer-recovery; phone/owner-applicants |
| Correct real profile | Existing equipment was Pegla and Elektro alat. Owner approved adding their smartphone; saved-and-verified feedback appeared. Other eligibility inputs were not changed. | emulator/worker-skills-lower, worker-tool-saved |
| Offer again | A new reviewed command with the same 100 RSD/one-person terms succeeded; owner saw one application. | emulator/second-offer-confirm, offer-accepted; phone/owner-applicant-arrived |
| Select | Owner inspected the offer and confirmed the exact accepted terms. An active Agreement appeared on both sides. | phone/owner-selection-confirm, owner-agreement-active; emulator/worker-agreement-active |
| Messages | Requester sent a test message, worker refreshed and received it, worker replied, requester refreshed and received it. History and writing remained usable. | phone/owner-message-sent, owner-reply-received; emulator/worker-message-received, worker-reply-sent |
| Worker done | Explicit confirmation moved the Agreement into waiting for the other side. | emulator/worker-finish-confirm, worker-finish-result |
| Owner confirms | Reopening the owner's Agreement refreshed the waiting state. Explicit confirmation produced completed Agreement and rating action. | phone/owner-awaiting-confirmation, owner-finish-confirm, owner-completed |
| Ratings | Both accounts separately saved 5/5 for this test; each showed saved receipt, not just selected stars. | phone/owner-rating-saved; emulator/worker-rating-saved |
| Final collections | Worker active list empty; test Agreement visible as completed in History. Owner task displayed Zatvoren, 1/1 filled, one historical application and no selectable applications. | emulator/worker-after-rating-list, worker-completed-history; phone/parent-task-completed |
| In-app events | Test-related opportunity, viewed application, selection, message, completion and rating notifications were visible. OS push delivery was not tested. | emulator/worker-notifications |

The final parent label **Zatvoren** proves only the terminal presentation. `needClientService.ts` folds
COMPLETED, CANCELLED, EXPIRED and ARCHIVED into that label. No separate raw parent status read was performed.
The Agreement's completed receipt/history and both saved ratings are independently visible in the native flow.

## Concrete remaining findings

| ID | Evidence and consequence | Next action |
| --- | --- | --- |
| R18-E01 | `useOwnedEditor.ts` treats every non-ok write as uncertain. A known eligibility refusal still offers Proveri ishod before a new command. | Distinguish conclusive refusal from transport uncertainty without weakening reconciliation or command identity. |
| R18-E02 | Required smartphone was absent. Adding only the real approved tool made the next offer succeed. The recorded server gate supplies hard-blocker details, but applicationSelectionClientService/serverReceipt retain only calendar-specific details and generic eligibility text. | Preserve allowlisted hard-blocker meaning and provide a precise route to correction; do not invent missing tools from a generic error. |
| R18-E03 | MyApplications showed Lokacija nije navedena / Fleksibilno for this remote/end-only task. `applicationClientService.ts` reads area/city/start only; recorded `rpc_list_my_applications` lacks execution mode/end/timezone. | Separate additive server projection proposal, then shared truthful formatting. Never infer remote from null coordinates. |
| R18-E04 | Empty Active collection still had Android accessibility description Aktivni, 1 Dogovor while its visible count/body were correct. `Segmented` clears accessibilityValue to undefined; native description retirement is incomplete. | Explicitly retire the spoken count, regression-test count-to-empty and verify native transition. |
| R18-V01 | Both actual docked-keyboard PNGs clip the first line of a multiline draft. Sending succeeded and full sent text is visible. | Correct composer geometry/internal scrolling at ordinary font and phone font 1.15, then inspect keyboard again. |
| R18-V02 | Selection success feedback is partly below the offer viewport; Open Agreement remains reachable. | Reveal concise success/focus after the confirmed result. |
| R18-V03 | Discovery capture contains blank outlined circle pins. | Inspect real marker rendering and selected/list return together in the next map batch. |

Manual message/status refresh worked. Automatic incoming delivery, paging and exact read acknowledgement
remain open; a short successful exchange does not close them. Existing RC-03 mitigation still makes P+C total
reads and needs a genuine server aggregate. These findings are recorded in the single control table, not
silently marked fixed by this test.

## Evidence limits and continuation

CAPTURES manifests bind images to source, installed APK hash, device settings and capture time. Named independent
reviews cover 12 phone and 25 emulator images; unreviewed intermediate captures are explicitly marked as collected
only. Source review explains possible mechanisms but is not a fresh database-body attestation. No direct SQL was
run in this acceptance pass. The historical DEV catalog date remains unchanged.

Not exercised: photographs/upload cancellation, avatar upload, voice/dictation, documents, real payment,
onsite/private addresses, group work, multiple competing offers, changes/disputes/cancellation, notification
OS permission/delivery, cold start/account-switch fences, deliberate offline/double-tap/timeout matrix, third
account isolation, iOS, extreme font/width and screen-reader acceptance. Those are remaining work, not failures
inferred from this pass. The full 32-step two-phone plan remains incomplete; one endpoint here is an emulator.

The owner then requested clearer cards, compact capacity, task-led Agreement, improved photo/chat/map/AI
composition and another functional audit. Continue that as a coherent client batch, preserving this successful
path. SQL/dependency/provider authorization does not expand from the design request. The one-test paid AI
authorization is now fulfilled; do not reuse it for new test conversations.
