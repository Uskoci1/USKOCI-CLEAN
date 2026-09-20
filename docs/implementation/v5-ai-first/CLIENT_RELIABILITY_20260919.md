# Client reliability checkpoint — 2026-09-19

Owner direction in the active Codex conversation moved the independent audit into implementation.
This is a local follow-up to NEXT_AI_HANDOFF_20260919_2100.md, on the same integration branch.
Base commit: 48f8dd3a70a907325408f1e8040f1d1719963329. The implementation and this checkpoint are committed together; the tests below were run against the exact local source hashes before commit.
No canonical DEV application, deployment, new dependency, provider call, device installation or store submission was part of this client packet. The separate later approved pkg023j DEV application is recorded in `pkg023/PKG023J_HOME_ATTENTION.md`.

## Implemented

| Finding | Before | After | Why |
| --- | --- | --- | --- |
| F01: first dictation | A fresh intake had an empty conversation id and the microphone silently refused to begin. | An explicit gesture first obtains microphone permission, then prepares the owned conversation using the existing stable open key, then starts speech. | Viewing a screen still creates nothing. A denied permission creates nothing. Speech can be the first input. |
| F08: foreground push | The transport's exact public body was rejected by the client. | Accept the current exact public sentence plus the previously shipped exact sentence; retain all other payload/privacy restrictions. | Match the existing server without an Edge deployment or accepting arbitrary body text. |
| F07: text-message receipt | Only photo messages had a 15-second receipt deadline. | Both text and photo sends have the same deadline. A timeout remains an unknown outcome in the durable outbox, with the original immutable key. | A hanging request must not strand the composer or encourage a duplicate message. |

F01 preparation is cancellable on release, explicit cancel, navigation, background, account revision change and timeout.
Receipt adoption and session identity advance synchronously after the gesture is rechecked.
No placeholder conversation is sent to speech. Preparation invokes only the existing idempotent conversation opener:
no AI turn, transcript, local AI intent or provider dispatch is created by preparation.
An opener already accepted by the server can leave an empty conversation after cancellation; the client neither deletes it
nor claims transport cancellation rolled back the server. Retrying in the same screen incarnation reuses the same key.
The transcript stays editable; only explicit Send dispatches the AI turn.

No new animation was introduced. The new preparing state communicates actual work, retains cancel and accessible start/stop,
and uses the existing native control, colors and typography. Physical timing/large-text/device verification remains pending.

## Verification actually run

- Full Jest: 232 suites, 4,461 tests passed, 0 failed; 16 tests added. Process exit code 0.
- Jest printed its delayed-exit warning and then exited naturally. The cause is not yet established.
- Eight affected suites with --detectOpenHandles: 248 tests passed, exit 0, no open handle reported.
- TypeScript: npx --no-install tsc --noEmit -p tsconfig.json, exit 0.
- Migration source integrity: PASS, 147 source files unchanged.
- Push/text regressions before their production fixes: 3 failures, 92 passes.
- Android JavaScript export (Metro, production mode, without Hermes bytecode): PASS.
- Last five inspected remote CI runs succeeded, latest PRE-P4 at the base commit. They do not certify this local patch.

## Next / not completed

F02 still counts visible historical responses as applications awaiting a choice. Its correction needs explicit server facts,
with total vs selectable counts kept distinct. The authoritative candidate reader already owns selectability.
Do not silently redefine the four-rule pkg023j contract while moving it to the server.
The later pkg023j checkpoint records the completed candidate, disposable CI proof and separately approved DEV application. It does not close F02 or wire the client to the aggregate. No server proof is claimed by this client checkpoint.

The installed Android APK is not this patch. No phone voice test was performed; the owner must be at the phone and ready.
No iOS-native voice support or store readiness is claimed. Preserve the price_basis/pkg023c/CodeQL holds.
The newly supplied HTML copies match the previously reviewed references byte-for-byte; the pasted release plan also matched.
Those references guide design, not backend authority or permission to apply migrations.
