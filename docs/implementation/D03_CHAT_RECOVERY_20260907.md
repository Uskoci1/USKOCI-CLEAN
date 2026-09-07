# D03 mobile message recovery — 2026-09-07

State: IMPLEMENTED / SOURCE TESTED / ANDROID REPLAY PENDING / NOT CANONICAL OR LIVE.

This continues the current Agreement screen as a testable scaffold. It does not establish final visual design. The owner's latest instruction reserves final navigation, screen organization, cards, maps, floating commands, photos, vehicles, calendar, colors, typography and animation for a later approved Figma source; Fable intro is a separate asset. Existing functional contracts and server authority remain independent of that future layout.

## Behavior and architecture

The former message send cleared the composer before a network acknowledgement and gave the user no stable retry intent. The screen now uses `useAgreementOutbox`, an account/Agreement-scoped local command model and the typed `AgreementMessagePort`. The port calls the existing server-owned v2 message command from PR #55. It does not create a parallel chat writer, event engine or delivery state.

`src/app/dogovor/[id].tsx` binds the route, focused server projections and hook. `src/ui/AgreementChat.tsx` renders those projections and invokes the hook's commands. Neither imports a raw Supabase SDK, issues SQL/table writes, chooses a provider, holds a privileged key, sets server status or computes an authoritative business deadline. Composer length feedback and disabled controls are presentation hints; the command adapter and server validate independently. The server owns membership, terminal-state admission, immutable retry identity and the resulting message/event transaction.

`src/data/agreementOutbox.ts` snapshots the actor, Agreement, key and body before awaiting storage. It durably records the command before sending, rejects immediate duplicate capture, and allows composing another message while one is in flight. Per-store-key read/merge/write serialization prevents a delayed acknowledgement from overwriting a newer pending command. No network request occupies the storage lock. Older errors cannot replace a newer acknowledgement. Retries keep the exact original command; hydration never sends automatically.

Focus generation and monotonic `accountRevision` prevent a stored callback from dispatching after blur or A → B → A, even before React renders. A successful authoritative read reconciles only matching sender, command key, body and message ID. Matching text alone is not receipt evidence. Pending intents are never pruned; up to 50 uncertain intents and a bounded acknowledged cache are retained separately from server history. Corrupt/unavailable storage is explicit and does not silently discard the composer.

`src/data/supabaseIzvor.ts` owns the existing authenticated read adapter. Invalid route/actor input cannot issue a query; current Auth identity is checked before and after the read. Transport, missing response and malformed rows are errors, while only a successful empty array means no messages. Legacy messages without a command key remain readable. No read receipt is invented (`procitano: null`).

The composer remains outside the history scroller and uses keyboard avoidance. Initial/latest messages are scrolled into view; reading older history is not interrupted by a content resize, and an explicit new outgoing command returns to the latest message. The overview itself scrolls so a long title cannot push all controls out of reach. Empty, loading, error, unknown send, retry, read-only and Back states are distinct. Inert controls and an unrelated Applications link were removed. Existing functional contact/completion/problem commands remain; their broader recovery/concurrency work is not claimed closed here.

## Source validation

- Full current source after the capacity fix: **52 Jest suites /419 tests PASS**, TypeScript PASS. This supersedes the earlier interim50/394 count.
- Actual message adapter tests cover Auth changes, bad routes/rows, read errors, sender/key preservation and unknown read receipts.
- Actual route/hook/component tests cover rapid capture, reconciliation before hydration, stale A → B and batched A → B → A completion, rejected-send workspace refresh, composer/keyboard structure, explicit retry and scroll position.
- The pure outbox and message command tests cover durable-before-send ordering, storage failures, immutable retries, real deferred-request ordering, stop/start generations, cross-instance acknowledgement reconciliation and terminal retry admission.
- Native harness syntax and local-outage/observer tests pass. These are harness checks, not Android execution proof.

The final independent review reproduced an unbounded volatile fallback at sourcecc94fda: with maxPending1, repeated storage failures while composing the next draft retained3 unsaved rows. The fix checks capacity before capture and counts the union of durable pending keys and volatile reservations inside the serialized write. Retrying a reservation excludes only its own key, so recovery remains possible at capacity. Two deferred-storage regressions cover repeated failures, a mixed durable-unknown/unsaved limit, preserved current text and exact same-key recovery. The independent six-suite D03 check passed104 tests before these two additions; the final full run above includes them. The10 local-target/observer tests also passed without touching Docker, an emulator or a live endpoint.

Updated bounded client inspection:67 source files /26 presentation files /0 findings, and local migration integrity85/live-snapshot85/pending0 PASS. See [capacity-fix source evidence](evidence/d03-chat-recovery-20260907/capacity-fix-validation.json) and [AST fingerprints](evidence/d03-chat-recovery-20260907/client-boundary-capacity-fix.json). These artifacts record the dirty tested source before its commit; no Android or production acceptance is added.

Backend PR #55 separately proves server idempotency, contention, actor/membership negatives and rollback behavior at its exact recorded source. That proof does not substitute for this mobile source's device proof.

## Physical Android acceptance still required

The new `d03-chat-mobile-proof.yml` preserves the existing 27 Inbox/navigation checkpoints and adds 11 D03 screenshot/XML pairs. It exercises both real authenticated sides, two immediate Send taps, received messages, keyboard/composer bounds, a scoped local REST outage, unknown outcome, manual retry, fresh single-copy reads, real terminal completion and Back.

The optional native outbox observation reads only one synthetic account/Agreement key from the fixed proof package on a confirmed emulator, read-only. It cannot enumerate or dump Auth storage. If SQLite observation is unavailable, the artifact records that limitation; native key-identity proof is not claimed from visible text alone. Backend/model key proof remains separate.

The native database fixture is explicitly a local reconstructed predecessor with exact extensions, not a full canonical-history replay or a production observation. The harness admits the exact source migrations after the inherited journey and checks message/event/delivery/gate effects. No proof environment, fixture or observer is an application runtime dependency.

This workflow has **not yet run for this source**. Do not infer device acceptance from the earlier PR49 artifact. Required integration order is current PR49 source, canonical PR55 dependency, final combined checks, then a fresh exact-source Android run and artifact review.

## Remaining limits

The read path currently refreshes on focus/foreground or explicit pull-to-refresh; it does not claim realtime delivery. History pagination beyond the server REST row cap remains open. Unsent text survives the current mounted model's read failures, while persisted attempts survive remount; a never-submitted draft is not claimed durable across process death. Attachments, groups, notifications provider delivery and full contact/completion recovery remain separate units. No private message read receipt or final visual acceptance is claimed.

No D03 production migration, provider call, dispatch, publication, pricing change or gate activation occurred. Original live85 provenance remains the current recorded baseline until a separate fresh read and reviewed forward promotion.
