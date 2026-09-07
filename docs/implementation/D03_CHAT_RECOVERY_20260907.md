# D03 mobile message recovery — 2026-09-07

State: IMPLEMENTED / SOURCE TESTED / INHERITED27 ANDROID CHECKPOINTS PROVEN / D03 NATIVE ADMISSION FIXED, REPLAY PENDING / MOBILE NOT CANONICAL.

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

## Canonical integration observed at13:31UTC

The same reviewed mobile source1421acfb is now integrated with canonical4ff2dc0 (PR49, PR55 and PR56). All270 relevant source/config/SQL paths were compared against the intended Git blobs; the15 D03 mobile source paths remain identical1421acfb and imported canonical source remains identical4ff2dc0. Four additive continuity conflicts were resolved without changing source. Full54 suites/467 tests, TypeScript, integrity86/recorded85/pending1 and AST67/26/0 PASS. This records the tested merge working tree before its commit; no new native or live acceptance is implied.

D03 was separately promoted live86 and its alias provenance is now canonical atf055d641. This merge will immediately admit that documentation-only successor before the exact-source mobile PR/device run. No server migration is reapplied. All earlier base85 and pending-backend paragraphs above are historical boundaries; final scaffold/product limitations remain unchanged.

The final source now also includes canonicalf055d641 / PR60. Only documentation, provenance and original evidence were added after the54-suite/467-test integration. All application/build/proof blobs are unchanged; integrity is86 source/live86/pending0. The next step is exact-head Android and CI/CodeQL acceptance, without production replay.

## Actual native boundary and repaired admission

Run34128121944 at9d5962f built and booted the standalone local-only Android APK, then passed10 N04 and17 NAV screenshot/XML checkpoints plus the inherited business/zero-RSD/history79 postflight. It failed before any D03 extension or Chat interaction: the helper incorrectly required a N07 forward file to equal its raw candidate, omitting the already-admitted150-byte two-line header. N02 was2287 bytes versus2137 candidate bytes. Original artifact10021851979 ZIP SHA256 `799054c27299fc2a23e8470cac5b801378ea16f1196dfb6c92137fd0bf4fa10d` was independently downloaded and verified. This failure does not establish a Chat runtime failure or success. No D03 boundary/report/screenshot exists in that artifact.

Reviewed commita792a46 fixes only this harness admission. A pure shared helper now requires the exact canonical header plus original candidate for N01/N02/N03/N05/N06, preserves the canonical MD5/SHA and provenance membership, and retains direct exact N08/D03 mirroring. N02/N03 remain explicitly already applied and are never applied again. All17 pre-existing SQL/candidate/manifest/provenance inputs remain byte-identical.29 source regression cases cover every candidate/forward mutation, coherent two-file mutation, malformed header and missing/duplicate/reordered/missing-alias bindings;19 existing local guard and3 canonical admission tests pass. The workflow executes source admission before disposable setup/APK build.

The branch is now integrated with canonical `6701311d89047c0a1058332362887fb7b396df5a` (PR57/PR58). All existing D03 application/build and Python journey blobs remain unchanged; canonical AI SQL/Edge/proof blobs are preserved. This establishes source input preservation, not a new APK binary digest or native execution result. Source87/recorded live86/pending1 is the incoming provenance snapshot; this branch makes no live observation or provider call. Final integrated validation passes54 suites/467 tests, TypeScript, integrity87/recorded86/pending1,29 admission+19 local guard and44 Python harness checks, plus AST67/26/0. The exact-source27+11 native replay remains pending. The previously successful AI source proofs retain their own accepted boundaries and need no backend replay in this native unit.

[Integrated validation](evidence/d03-chat-recovery-20260907/canonical670-admission-validation.json), [exact Git input preservation](evidence/d03-chat-recovery-20260907/canonical670-input-preservation.json) and [AST observation](evidence/d03-chat-recovery-20260907/canonical670-client-boundary.json) retain the tested merge working-tree boundary before its commit. Their [manifest](evidence/d03-chat-recovery-20260907/canonical670-manifest.json) binds those original recorded files.
