# P4 exact-message client connection

2026-09-27. **CLIENT WIRED / FOCUSED TESTS PASS / NATIVE EXACT LANDING NOT YET PROVEN.**

The owner approved P4 application and client connection. The root agent reports the canonical DEV resolver applied at ledger 207, migration 20260927185451, candidate SHA256 136601fcb2056f06d26706d0a86a91f0b5ff984eee58f18899952a6780b58b57 and body MD5 1769346f2fbf4a70ccf53b47614d2c0f. Application/readback evidence belongs to the root's separate receipt; this report does not independently claim a DEV operation.

## Behavior

A MESSAGE_RECEIVED Inbox row now uses the account/incarnation-scoped activityMessageTargetService. The resolver returns a body-free canonical event/Agreement/message target. The model checks event and role, fences focus/account/filter ownership, aborts abandoned work and refuses fallback to the legacy Agreement-only resolver. Resolution failure leaves the event unread and presents the existing retry state; an authoritative UNAVAILABLE result stays distinct.

The Inbox opens /dogovor/[id] with tab=poruke and the exact messageId. The route validates that identifier, seeds the existing B3 bounded window and measured reading anchor, and remounts only the thread presentation when the target changes. The Agreement workspace, persistent outbox and photo intent owners remain mounted. Existing B3 validation independently authorizes the target; route parameters grant no access.

No opening, window read or programmatic scroll acknowledges messages. Only the existing measured incoming-bubble viewport callback may submit exact canonical IDs to B3a. A failed historical target does not silently show the latest message; the existing explicit latest/retry actions remain available. Returning to the overview is respected on later renders.

## Source

- src/contracts/inbox.ts: typed exact-message target.
- src/data/inboxModel.ts: exact resolver selection, target checks, cancellation/ownership.
- src/hooks/useInbox.ts: captured account/revision resolver wiring.
- src/app/obavestenja.tsx: exact-message route parameters.
- src/app/dogovor/[id].tsx: validated target, bounded-window/geometry intent, retained journal owners.
- src/data/activityMessageTargetService.ts: remove obsolete UNWIRED comment; parser/transport unchanged.
- Tests: inbox-model, inbox-hook, inbox-native, agreement-screen-recovery, agreement-chat-ui.

## Validation

Red before source changes: 10 new Inbox/model/native assertions failed while 45 passed; 4 new route assertions failed while 81 passed. Failures demonstrated generic Agreement targeting, ignored message route parameters and missing historical-window selection.

Green after connection: 148/148 tests across Inbox model/hook/native and actual Agreement route; 355/355 across exact-target service, chat geometry, history service/model, legacy Inbox client and PushRuntime. Total 503 focused tests across 10 suites. TypeScript passed. Git diff whitespace check passed. No full-suite, provider call, account mutation or native exact-message proof is claimed.

## Explicit remaining boundary

The current push payload contains only {kind: INBOX}; it has no event identifier. PushRuntime safely opens Inbox and was left unchanged. The tested connection is push-to-Inbox followed by a chosen event-to-exact-message path. A one-tap provider push-to-exact-message path still requires an approved transport contract carrying an opaque event identifier, matching receiver validation/cold-start ownership, and real provider/device proof. Do not guess the newest row or mark P4's full push chain ready.

Root owns commit, control-table updates and native verification. No server/candidate, dependency, certificate, TaskCard or Peek change was made in this client slice.
