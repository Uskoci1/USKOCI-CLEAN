# P3 chat lifecycle — bounded source round, 2026-09-27

Status: **SOURCE ONLY / UNVERIFIED**. Reviewed from base `6bf4e0a06b870d5277cef9b0011c6ac76dacb05c` in `work/uskoci-ui-unification-20260924`; line references below describe the current working tree. No tests, TypeScript check, build, install, device acceptance, live database read, server/Edge application, data mutation, dependency change or paid provider call was performed. This note does not close P3 or claim whole-app acceptance.

Owned files for this round:

- `src/ui/groups/GroupConversationController.ts`
- this report

## Implemented in this source round

The group controller previously used the same `busy` lock for user commands and `markVisible`. A pending read acknowledgement or its subsequent context read therefore caused a send/refresh/older-page tap to return without action. Conversely, a viewability callback while loading a page or sending was discarded; an unchanged visible row need not produce another callback.

`src/ui/groups/GroupConversationController.ts:10,19,83-107` now separates the read-acknowledgement lock from the command lock. It holds one bounded latest observation (at most 50 IDs), drains that observation after the current command/page operation, and rechecks the current group and loaded IDs immediately before the existing read RPC. It never invents viewability for a whole page.

The acknowledgement's optional context refresh captures the command revision and context object (`:28,101-104`). A later command/read retires that refresh, so an old response cannot replace a newer command phase or context. Disposal clears pending visibility (`:17`). Receipt errors are best effort; they do not claim that a message was sent or clear its journal (`:106`). The original exact-hash retry/recovery/explicit-acknowledgement path is unchanged (`:54-82`).

This is a nonvisual controller correction. No presentation, copy, navigation, microphone or recording flow changed. Regression verification is deferred until the owner asks.

## Existing implementation, source-confirmed

| Area | Current source | Bounded conclusion |
| --- | --- | --- |
| Private text/photo send | `src/contracts/agreementMessages.ts:1-27`; `src/data/agreementMessageClientService.ts:23-73` | Immutable account/Agreement/client-message identity; photo command binds version and 1–6 ordered assets; missing/invalid receipt is not confirmed success. |
| Private durable outbox | `src/data/agreementOutbox.ts:41-43,142-177,215-295` | Stores original command before dispatch; retries the same identity; reconciles exact body/photo/message identity; a late failure does not downgrade confirmed state. |
| Photo recovery | `src/hooks/useAgreementPhotos.ts:25-53,65-85,111-129` | Reads journal/inventory; reserves assets held by the outbox; retries upload only after authoritative `ABSENT` with the same ref. Prepared image bytes are memory-only and cleared on blur; reopening recovers existing upload/message state rather than promising to re-upload lost local bytes. |
| Private refresh | `src/app/dogovor/[id].tsx:169-180,195-200`; `src/hooks/useFocusedResource.ts:16-26`; `src/data/focusedResource.ts:43-85` | Focus/foreground/manual/own-send refresh; a bounded read and coalesced trailing refresh; retained refresh failure is explicit. No incoming subscription/polling loop in this path. |
| Private scroll intent | `src/ui/AgreementChat.tsx:136-157,225-257,356` | Existing follow-latest/reading-position logic and latest-message action. This is not paged history or native acceptance. |
| Group paging | `src/data/groupConversationService.ts:54-69`; `src/ui/groups/GroupConversationController.ts:35-47` | Validated 50-message pages, strict sequence cursors, older-page prepend and message-ID deduplication. The service supports `after`, but the controller uses newest/older only. |
| Group lifecycle/read | `src/ui/groups/GroupConversationScreen.tsx:16-36`; `src/data/groupConversationService.ts:81-87` | Focus/foreground controller ownership and account revision fences; real FlatList viewability supplies IDs after 600 ms/60% coverage; the exact-ID RPC is bounded to 50. This round fixes the controller race described above. |
| Group send recovery | `src/ui/groups/GroupConversationController.ts:54-82` | Persisted opaque request identity and body hash; exact re-entry after restart; authoritative receipt recovery; receipt alone does not synthesize a visible history message. |

## Missing / remaining open

1. **Private newest/older history is absent.** `src/data/supabaseIzvor.ts:317-332` reads `agreement_messages` ascending by `created_at,id` with no explicit cursor or limit; service-side row limits can therefore also truncate what the client treats as history. `src/data/agreementPhotoClientService.ts:106-127` batches photo metadata by 50 after that history read; it does not page messages. `src/ui/AgreementChat.tsx:225,293` renders all returned rows in a ScrollView.
2. **Private exact displayed-message acknowledgement is absent.** `src/app/dogovor/[id].tsx:203-218` settles notifications for the Agreement after a loaded messages-tab snapshot. The concurrent parent source round now binds admission to visible/fresh/focused/current-account content and deduplicates the snapshot; it still does not supply individual displayed IDs. `src/data/supabaseIzvor.ts:359-363` passes only the Agreement ID. The candidate body in `supabase/candidates/pkg050a_agreement_messages_read.sql:61-88` settles all eligible unread `MESSAGE_RECEIVED` events for that Agreement; it has no displayed-message-ID or last-displayed boundary. Individual message projections still correctly expose `procitano: null` (`src/data/supabaseIzvor.ts:354`). This round did not disguise the broad RPC as exact read tracking.
3. **Automatic arrivals are absent in both paths.** Private refresh is described above. Group focus/foreground loads a fresh controller, manual refresh/own-send acknowledgement loads a newest page, and there is no loop consuming the existing `after` cursor. Refresh also replaces previously loaded group pages (`src/ui/groups/GroupConversationController.ts:38,43-45`). Stable older-history position while receiving newer pages remains open.
4. **Voice messages are absent.** The private command has body/optional photos only (`src/contracts/agreementMessages.ts:1-7`), and group messages are text-only (`src/data/groupConversationService.ts:8`). Neither human-chat presentation has a voice message kind, recorder/player or voice outbox; `package.json` has no `expo-audio`. AI speech-to-text remains a different feature and is not proof of voice-message delivery.
5. **Group history failure still clears retained messages.** This is intentional in existing authority-denial expectations (`src/data/__tests__/v5-group-conversation-controller.test.ts:68-77`, source read only). No speculative retention change was made that could keep content after access denial. A future network-only retention policy must distinguish transport uncertainty from loss of authority.

## Next proposals, not implemented in this round

- Prepare an additive private newest/older projection and an acknowledgement accepting exact displayed message IDs. Bind both to expected account and Agreement membership; preserve deterministic ordering, photo identity, notification eligibility and closure protections. Review the SQL/proof artifact before any application.
- Bind the approved projection to incremental arrival reads and retained older pages. The group path can use its existing `after` contract; the private path first needs its bounded contract. Review the history/loading/arrival interaction proposal before changing a user flow.
- Keep the voice package separate: private asset authority, atomic send/notification, stable retry identity, export/closure integration, explicit message-kind union, approved audio dependency and owner-approved recording/review/player proposal. No new voice UI or dependency was added here.

When verification is authorized, first cover the concrete group race: a send and refresh admitted during delayed read acknowledgement; viewability received during page load; stale read-context completion after a later command; blur/account change during both reads; invalid/out-of-page IDs. Then run appropriate existing group lifecycle checks. Exact two-account device acceptance and all paging/voice gates remain outstanding.

Follow-on source preparation is recorded separately in `P3_PRIVATE_HISTORY_CONTRACT.md`: a two-RPC private newest/older and exact-read candidate plus adversarial disposable proof source. Those artifacts are **NOT RUN / NOT APPLIED / NOT WIRED TO THE APP** and do not close the missing client behavior above.
