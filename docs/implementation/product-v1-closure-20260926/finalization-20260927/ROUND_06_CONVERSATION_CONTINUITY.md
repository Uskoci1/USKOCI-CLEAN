# Round 06 — Agreement clarity and conversation continuity

Date: 2026-09-27. Source base: `42640f67`. Scope: P2/P3, limited P4 invalidation. No DEV/Edge mutation, dependency, paid provider call, test data or APK installation.

## Owner direction

The latest owner message authorizes ordinary appearance/flow improvements without per-screen approval and asks for critical review each round. One TypeScript and focused regression package check accompanies this implementation. Native/device/provider execution remains deferred. TaskCard/DiscoveryPeek remain unchanged. General application wording is not permission to apply SQL or move a closure certificate.

## Problem and cause

- The accepted Agreement terms mixed an approximate source-task area with the saved price/time. Equal-weight rows obscured the next decision.
- An open private conversation refreshed on focus, foreground return, own send and explicit refresh, but did not react to foreground push receipt.
- The freshness gate intentionally unmounted private chat while the app resumed. Its local scroll state then started at the end, losing the person's earlier reading position.
- Text draft lived only inside a mounted outbox model. Route exit could lose unsent text despite the interface promising that it remained.
- Exact retry refreshed message history but not prepared photo receipts; a photo attached by the recovered send could remain reserved in the composer until another photo refresh.

## Product and UI decisions

Keep task context, accepted terms and next action distinct. The task title/area link identifies the job; accepted total/time/person count describe the saved agreement. No invented location, amount, rating or status. Preserve the compact chat header layout.

Receiving a push is only a hint to read canonical messages, never message content, a send confirmation or a read receipt. Keep manual refresh available when push is denied, delayed or unavailable. Do not pull a person away from older messages; an explicit send or Latest action resumes following.

Preserve reading intent across the route's privacy/freshness gate using only a message ID and numeric offset. Fresh server-authorized rows must still load before restoration; no cached private transcript is revealed. Persist unsent text separately from immutable sent/unknown commands and clear only the captured draft, never newer typing.

## Implementation and files

- `src/ui/v2/AgreementPresentation.tsx`: overview hierarchy and separation of approximate task context; compact accepted context retained.
- `src/ui/agreements/AgreementWorkspace.tsx`: shared readable next-step typography, no command/authority change.
- `src/data/agreementIncomingRefresh.ts`, `src/hooks/useAgreementIncomingRefresh.ts`: foreground notification-received/dropped invalidation with owner/focus/session guards, bounded deduplication, one active plus one trailing read and a 2 s minimum start cadence. No periodic polling.
- `src/ui/notifications/publicInboxCopy.ts`, `PushRuntime.tsx`: the existing strict public notification validator is shared unchanged; the global handler keeps its existing owner.
- `src/app/dogovor/[id].tsx`: current visible-member admission, stable silent refresh and route-owned reading memory, reset by account revision/Agreement key.
- `src/ui/AgreementChat.tsx`: fresh-row anchor restoration, retired callback fences, explicit-send following and current-owner photo receipt refresh after exact retry.
- `src/data/agreementOutbox.ts`: separate versioned durable draft, account/Agreement scope and logout cleanup. See the focused draft report for storage limits and crash semantics.

## Backend/RPC and read-only DEV observation

Existing message/photo RPCs and existing Agreement-wide read acknowledgement remain. A successful hint refresh is not exact displayed-message acknowledgement. B3a/B3b and exact-message push landing remain prepared, unapplied contracts.

Read-only query against canonical DEV `leqcwgzvjsxugfgzdmth` returned `[]` on 2026-09-27:

```sql
select pubname, schemaname, tablename
from pg_publication_tables
where schemaname='public'
  and tablename in ('agreement_messages','agreements','in_app_notifications')
order by pubname,tablename;
```

This is absence of publication rows for these named tables, not an exhaustive Broadcast audit or new runtime delivery proof. The client therefore uses the already installed Expo notification listener API; it does not pretend a direct database stream exists.

## Design rationale and primary references

- [Apple feedback](https://developer.apple.com/design/human-interface-guidelines/feedback): status belongs alongside the affected action. Retained-history refresh failure stays in the conversation; it does not erase history or open a blocking alert.
- [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps): preserve reachable controls, readable text and meaningful spoken grouping. Existing 48 dp message commands and explicit Latest/manual refresh remain; accepted terms have labels and no fixed line clipping.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): nonblocking updates should be available without forcing focus. Existing polite status feedback is retained; this is design guidance, not a claim of WCAG/native certification.

## Independent source review

Parallel reviewers checked the incoming listener lifecycle and the overview's real data provenance. Root chat review found two regressions before acceptance: old native callbacks could overwrite retained reading memory, and following a send depended on observing an intermediate `sending` render. Mount guards and explicit gesture ownership correct them; focused regressions cover these cases.

Root's later StrictMode review found that effect cleanup cleared restoration intent as well as the scheduled animation frame. Cleanup now cancels the frame while retaining the intent for the replayed setup. The final chat suite exercises actual StrictMode effect replay and records two setups and one cleanup.

## Checks and evidence

The initial parallel Jest attempt failed to spawn workers (`EPERM`, `ROUND_06_JEST.log`). The first in-band run (`ROUND_06_JEST_INBAND.log`) executed 14 suites: 6 failed and 8 passed, with 30 failed / 251 passed tests. The push-runtime suite was blocked by a child-process `EPERM`. The failures were inspected individually:

- Missing-price UI incorrectly displayed `Dogovoreno ukupno` above `Iznos nije sačuvan`. It now uses `Cena`, preserving the words-only contract. The regression assertion was retained and strengthened.
- Overview tests still expected the approximate area inside accepted facts, the old source-link label, unlabeled fact rows and a substring count for `Dogovoreno`. Assertions now follow the approved hierarchy while retaining exact values, callbacks and destinations.
- Duplicated acknowledgement fixtures used an empty history while expecting a read acknowledgement. They now exercise a real nonempty loaded thread, unchanged-list deduplication, refusal without lost messages, and explicit no acknowledgement for empty history, matching the existing Round03 guard.
- The incoming-hook test environment could not execute the preserved dynamic `import()` through its unavailable VM ESM loader. The harness now compiles the exact production hook bytes to CommonJS and substitutes module resolution; lifecycle/control logic is unchanged.
- The prepared-photo retry test omitted the existing photo controller's `refresh` method. Its fixture now provides it and asserts that exact retry refreshes current photo receipts.
- A real two-instance durable-draft race let a queued retry reject an edit already saved before another instance replaced the shared draft. Rechecking dirty state inside the serialized queue preserves independent immutable command capture and the other instance's draft.

The final affected-suite rerun passed **8 suites / 368 tests**, recorded in [ROUND_06_JEST_FINAL.log](ROUND_06_JEST_FINAL.log) and [ROUND_06_JEST_FINAL.json](ROUND_06_JEST_FINAL.json). Root reported TypeScript exit 0 for [ROUND_06_TSC_FINAL.log](ROUND_06_TSC_FINAL.log). After the StrictMode cleanup correction, the dedicated chat rerun passed **1 suite / 38 tests**, including its real effect-replay witness, recorded in [ROUND_06_CHAT_FINAL.log](ROUND_06_CHAT_FINAL.log) and [ROUND_06_CHAT_FINAL.json](ROUND_06_CHAT_FINAL.json).

The final executed total is **9 distinct suites / 406 tests**. Five other suites passed only in the initial run; they remain historical evidence and are not added to the final total or counted twice. No complete repository suite, build, device, screenshot, native scroll/keyboard, real notification or network-failure provider test is claimed.

## Remaining gates / next step

Validate this combined native package once approved, particularly resume/older-history position, keyboard, photo retry and same-event foreground receipt. Then prove the prepared bounded private-history/exact displayed acknowledgement/message-window package on a disposable database; DEV application needs separate owner approval. Voice, exact-message push landing and production-scale query/virtualization proof remain open. The existing 62-row tracker is authoritative; this round is not whole-product READY.

## Delivery

Source implementation commit: `bcd24f31`. Control generation completed with the same 62 rows and no app-called RPC missing from the stored DEV catalog; these are structural checks against the dated snapshot, not fresh runtime proof. The signed-in Claude artifact is reachable, but its documented file chooser timed out twice (AX button and grounded frame input). The remote page still displays 2026-09-24. Publication remains pending; `ROUND_06_PUBLICATION.json` identifies the exact local file.
