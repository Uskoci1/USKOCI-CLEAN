# P4 push to an exact message — bounded source contract

Date: 2026-09-27. Client baseline after Round 03: `a1fe01e4`. Status: **SOURCE PREPARED / PROPOSAL / UNVERIFIED**.

This round reads the current `NOTIFICATION_MATRIX.md` and `CHAT_VOICE_CONTRACT.md`. It does not establish same-message push delivery or exact-message landing. No tests, type checks, builds, installs, device checks, provider calls, dependency changes, database/Edge application or business actions were performed.

## Current path and its limits

| Step | Source evidence | Actual contract |
| --- | --- | --- |
| Durable message event | `supabase/migrations/20260907080000_clean_n01_message_event.sql:61`; photo counterpart at `20260913065130_clean_v5_agreement_private_photos.sql:114` | Canonical event identity is `agreement_message:<message UUID>` with `payload.message_id`; the recipient is the other Agreement participant. Text/photo content is not a push destination authority. |
| Push begin and worker | `supabase/candidates/20260926175504_clean_notification_push_event_type.sql:72`; `supabase/functions/uskoci-push-transport/index.ts:115`–`:124` | The begin receipt provides the event type for fixed copy, not event/message identity. Provider data is exactly `{ kind: 'INBOX' }`. |
| Warm/cold native tap | `src/ui/notifications/PushRuntime.tsx:55`–`:74`, `:100`–`:103` | Strict single-key INBOX data, bounded native-request deduplication, account/revision/session ownership, fixed `/obavestenja` navigation. The cold path remembers the same destination for the root startup consumer. No resolver or read acknowledgment runs here. |
| Startup handoff | `src/store/pendingRoute.ts:16`–`:32`; `src/app/_layout.tsx:70`–`:81` | The in-memory 15-minute handoff holds only a path. It cannot preserve an exact event/message anchor. |
| Inbox row resolution | `src/hooks/useInbox.ts:13`–`:26`; `src/data/inboxModel.ts:49`; `src/data/inboxClientService.ts:47`–`:55` | Account/revision/focus model owns the selected row and asynchronous result. The service resolves one event ID; the current target union contains only kind, entity ID and role. |
| Server resolver | `supabase/candidates/pkg045a_task_read_contract.sql:243`–`:264` | The event must belong to the caller and have an eligible IN_APP delivery. Agreement membership is rechecked. The result is `{ kind: 'AGREEMENT', id, role }`, with no message ID. |
| Existing destination | `src/app/obavestenja.tsx:50`–`:55` | A MESSAGE_RECEIVED Inbox item routes to `/dogovor/[id]` with `tab: 'poruke'`. It does not identify a message. |
| Thread state and scrolling | `src/app/dogovor/[id].tsx:71`–`:79`; `src/ui/AgreementChat.tsx:152`, `:227` | The route initializes its local tab from the parameter; the chat follows its existing latest-message behavior. There is no anchor parameter, exact-target read or target-row positioning contract. |

A native request identifier, generic title/body, newest Inbox row, or newest message cannot substitute for the durable event ID. With today's payload, the client cannot determine which real message caused a push.

## One implemented client fix

`PushRuntime.tap()` previously checked the effect lifetime and live session but omitted the latest rendered `ready` state. The foreground presentation handler already made this check. During the interval between rendering Auth/recovery/unresolved routing and passive effect cleanup, a queued old tap could still navigate to Inbox.

`src/ui/notifications/PushRuntime.tsx:62`–`:65` now also requires the rendered ready/account/revision/session tuple to match the listener owner. The existing stale-request consumption, cold handoff, destination, strict payload shape and listener cleanup remain unchanged. This adds no token acquisition, permission prompt, registration, provider call, read acknowledgment or route.

Deferred verification: retain a tap callback, render `ready=false` before cleanup and invoke it; it must neither navigate, remember a pending route nor clear the native response. Also retain it across account/session changes and unmount. An eligible current warm/cold tap must still open the existing Inbox once. No such check was run in this round.

## Read state must not be inferred from routing

Round 03's model called `port.read(item.id)` before resolving the destination. For MESSAGE_RECEIVED, a failed resolver/navigation could therefore settle the event without displaying any conversation. The integrator's separate narrow follow-up in `inboxModel.ts:58` now resolves message-event opening without the read/optimistic count change; other event behavior and explicit user-requested read-all remain separate and unchanged. Independent source review found no concrete issue in that diff: current-row admission fixes the event type, and the existing token/account/focus fence still rejects a retired resolver result. This was source inspection only; no tests were run.

Even with that follow-up, the existing visible-thread acknowledgment at `src/app/dogovor/[id].tsx:205`–`:218` is coarse. Its ownership/readiness fence prevents hidden-thread dispatch, but the RPC accepts only an Agreement ID. It can settle an event for a message outside the displayed snapshot. It is not exact-message proof.

The source-only B3a candidate (`supabase/candidates/chat_b3a_private_history_read.sql:38`, `:92`) proposes newest/older pages and exact displayed-ID event acknowledgment. It is not applied or wired into this client. Newest/older paging also cannot directly retrieve an arbitrarily old push target in bounded work.

## Smallest proposed exact-message contract

All of the following are proposals. Server changes require their own reviewed candidate, disposable proof and explicit application approval. Automatic push-to-thread navigation and target-position behavior require approval of the concrete user flow before implementation.

1. **Carry one opaque event reference.** Extend the reviewed transport contract with a strict payload such as `{ kind: 'INBOX', eventId: '<UUID>' }`. Retain the current single-key payload as a legacy Inbox fallback. Add no Agreement/message IDs, route strings, user content or private metadata to push. The service-only begin receipt must derive the event ID from the same locked delivery/attempt whose copy and token are admitted; the worker only forwards that validated field.
2. **Resolve before acknowledging.** An additive expected-account/current-session resolver accepts the event ID and returns a discriminated `AGREEMENT_MESSAGE` target containing canonical event, Agreement and message IDs, or unavailable. It rechecks event recipient, eligible IN_APP delivery, Agreement membership, MESSAGE_RECEIVED type and the exact `agreement_message:<id>` plus `payload.message_id` link. Unknown, foreign, deleted or mismatched targets fall back to Inbox; there is no guessed newest-message route. Resolution itself does not mutate read state.
3. **Read a bounded target window.** Extend the paging contract with an authorized anchor/window operation that proves the target belongs to the resolved Agreement and returns a bounded chronological page containing it, with stable timestamp/UUID cursors on both sides as needed. Do not walk unbounded older pages until the target happens to appear. This is a separate capability from B3a's newest/older-only candidate and must retain its photo identity validation and server timestamp precision.
4. **Own the landing intent.** Use a typed, in-memory, expiring event intent bound to the current account revision/session and request generation. Warm/cold/auth-return paths consume the same intent once. A new account, logout, retired focus or newer tap invalidates earlier asynchronous work. Router params are hints; authorization comes from the fresh resolver/window response. Legacy pushes continue to Inbox. Do not remount or clear a durable message outbox merely to consume another landing intent in the same Agreement.
5. **Position, then acknowledge actual visibility.** The approved thread interaction must consume each new landing intent even when the same Agreement component is retained. Wait for that target's real rendered geometry/viewability; then acknowledge only verified displayed message IDs through the proven exact-ID successor. Do not mark the event read merely on tap, resolver success, page load or scroll request. Explicit Inbox read-all remains an explicit bulk notification action and must not be represented as proof that message rows were viewed.

This contract reuses the canonical message/event identities, fixed public copy, Inbox fallback and existing Agreement thread. It adds only the identity and bounded-read capabilities that today's route lacks. No part is connected to an unapplied RPC by this round.

## Bounded next implementation and evidence

Prepare one source-only server/proof package for the reviewed event reference, expected-account resolver and bounded anchor window. Its proof should bind exact source bytes, verify unchanged unrelated authority/closure surfaces, and cover wrong account, expired session, foreign/missing/suppressed event, wrong event-message linkage, terminal Agreement history, old targets beyond the newest page, equal timestamp ties, and later arrivals. Keep all notification copy/privacy and delivery guards intact.

Only after the server package and visible landing interaction are approved should the client gain the strict new payload variant, owned event intent, validated target union and anchor consumption. Retain the current fallback throughout migration. Exact displayed acknowledgment replaces the coarse automatic message path; it must not coexist with an earlier automatic event sweep that erases its boundary.

When separately authorized, use two physical-device accounts to send one real text/photo message, record its canonical message/event/delivery identity, receive that same event's push and tap it cold and warm. Include a target older than the newest page, an already-open same-Agreement overview/thread, rapid taps for different events, foreground/background transitions, account switch and unavailable target. Confirm the actual target becomes visible and unrelated/new/offscreen message events remain unread. Provider ticket or generic Inbox arrival alone is insufficient acceptance. Voice later uses the same event/landing contract after its own storage/closure/dependency gates.
