## Current entry replay — original Android journey passed; route motion repair pending proof

Canonical PR64 is merged at `80e091ee31930b28cc5c2e0af6b6e876a4926362` with exact canonical PRE-P4/CodeQL/CONTROL-0 PASS. It is integrated additively here; W04/W05 source is preserved. PR66 original source `c1b803285e2b5b97c57680ea09c9f17a6934d32d` has SUCCESS native run34160744232 and34 reviewed original PNG/XML checkpoints (7 entry +27 account/Inbox/navigation). Artifact10033052964 is5,932,807 bytes, SHA-256 `c0932b714237ae92d3ba78fd372d06ce13da5f571e32a7a5aa9b3a3c0b7ff602`. These static journeys are proven in their source scope; the full visible owner intro is not accepted.

Actual MP4 frames show the Auth route sliding over the owner sequence: frame55 at7.535878s is partial-width, frame56 at7.953489s first fully visible assembled mark, welcome at11.466433s. The old blue Expo splash is gone. The narrow repair disables the competing Stack transition only for Auth; all original SVGs and12 motion tracks retain their4500ms timeline. A separately reproduced revealed-password carry across Login/Signup is repaired by remounting that field per mode, preserving its value and masking it again. Its actual component regression fails before and passes after the change. Tab selected state already exists; an AX Value0 alone was not a source defect.

Integrated pre-repair source passes64 suites/599 tests; final focused4 suites/36 tests and TypeScript pass. The new source requires a fresh standalone Android replay, original motion inspection and exact-head CI/CodeQL before merge. No60fps, production/provider, full Auth/release or47-item closure is claimed. No SQL, secret or feature-gate change occurred. Prior checkpoints below retain their exact historical boundaries.

---

# SPOJ entry and Auth

## Replay checkpoint after original Android review

Canonical Chat PR61 (`d4d8cd09bf44dd54c7355605b0c256813b46ab1b`) is integrated additively with Metro65. Original entry run34150271309 at95dd6f67 failed after real logout because the inherited harness expected welcome `Prijavi se`, while the current route intentionally opened the complete login form `Prijavite se`. The original artifact10029734028 is5,380,228 bytes, SHA256 `3dcfed5cc6e724ebaf7dbe2a4e7b577abc1c6cbbbd6f248774f0616f648942bc`. Seven entry PNG/XML checkpoints, ten inherited Inbox checkpoints and requester/same-account navigation ran before this failure; this is not complete two-account navigation acceptance. The harness now explicitly verifies the two actual Email/Lozinka fields and absence of private tabs, then performs the second login through that observed form. Four new selector regressions reject missing/extra/mislabeled fields and private destinations without weakening the prior welcome path.

The original15s MP4 was decoded and reviewed at250ms intervals. It visibly shows the old blue Expo placeholder before a partly elapsed owner animation: owner scene is visible around8.25s and welcome around11.75s. Approximately1s hidden behind the native splash is an inference from those pixels and the unguarded source clock, not instrumented timing. The fix mounts the twelve SVG nodes paused at their true first frame, disables the native exit fade, waits for positive layout, completed hide request and two animation-frame callbacks, then starts the unchanged4500ms timeline. A1s readiness failure skips cosmetic motion to usable welcome; cosmetic storage retains its500ms bound. Native splash now uses the warm owner background with a supported transparent Android drawable instead of Expo artwork. All original SVG/track bytes remain unchanged. Fresh Android video is required to accept visible timing; neither mocks nor the low-frame-rate recording prove60fps.

Independent architecture review at95dd found77 client files/30 presentation files/0 AST findings and no manual authority/secret boundary violation. One accessible-name regression on the busy Auth button was fixed by retaining its title and exposing busy/disabled state. Registration consent links and full recovery remain separate launch gaps. No production change occurred.

Owner's current visual source is [SPOJ](https://www.figma.com/design/DovAtPfVaLKL6xnXtQImbf), specifically splash15:487, welcome3:123 and auth3:182. This supersedes our deleted earlier entry proposals. The current unit carries the owner's handshake U and outlined wordmark into the real Expo app and replaces the obscuring Auth sheet with the light SPOJ full-page form. It does not replace the engine or declare the whole visual/product backlog complete.

## Source boundary

- Eleven bundled owner SVG layers; twelve recorded Figma motion nodes, one shared Reanimated UI clock, original4500ms timeline. Motion loops only in Figma; production plays once, can be skipped, and honors reduced motion. The serialized tracks and file/node provenance are in `evidence/figma-entry-20260907/`.
- Intro persistence is cosmetic, versioned, read-bounded500ms and ignored after unmount. Backgrounding finishes the intro. A failed read/write cannot block Auth.
- Both entry intent choices use `entryIntentClientService` and the existing typed return store. The5s expiry invalidates the storage callback; the serialized store rolls a late write back before another queued intent can write. Auth runtime, actual session and monotonic account revision remain authoritative.
- Auth form uses the existing SDK-free contract, Auth hooks and `authClientService`. Read-only public `/auth/v1/settings` is projected by `authAvailabilityClientService` with a10s bound and abort/revision handling. Only implemented and enabled methods appear. No guessed OAuth, successful signup/email delivery, saved task or account role is shown.
- Empty email/password receives an immediate local prompt. Other form checks concern entered fields only; actual Auth acceptance and account/session ownership remain on the existing server/runtime boundary.
- An existing typed completed return target keeps its behavior. Entry NONE intents route to requester Novi or worker Zadaci. `form=login` skips intro for protected route admission. This does **not** create every missing deep-link return target and must not be called backlog5 closure.

## Architecture review

The AST audit covers all current `app/ui/hooks/contracts/data/store` TypeScript, including untracked new files, with per-file fingerprints;74 files/29 presentation files/0 findings at the first audit. Presentation has no direct Supabase/OpenAI SDK import, raw RPC/network command or privileged AI/service secret. Manual diff review confirms no SQL, publication/payment/business authority or new provider in entry rendering. Owner/session logic lives in the existing store/service/hooks. Static checks do not prove arbitrary semantic security or runtime behavior.

Independent review found a hung guest-intent storage call could lock welcome; the5s guard and late-write invalidation now cover it. Seven intro lifecycle/reduced-motion/storage tests and five intent timeout/account/retry tests complement the existing form/service/return ownership suite. The27 focused new/changed entry tests passed;17 existing native harness tests and TypeScript passed locally. One parallel local TSC and a broad Jest attempt hit host memory allocation limits; the subsequent serial bounded-memory run passed all54 suites/453 tests in25.282s. No passing result is inferred from the earlier partial output.

## Physical observations and pending proof

Signed-out web inspection at localhost8091 observed the owner wordmark, welcome choices, light login and scrollable registration at390×844. Controls could be clicked; there was no covering backdrop and no browser runtime error in the inspected interval. This is a web observation, not native motion/login acceptance. No test account, draft, email or OTP was created on production. An empty login click exposed the missing local empty check; the new source fixes it and requires fresh rebuilt verification.

`intent-shell-mobile-proof.yml` now records the signed-out intro MP4 and7 entry PNG/XML pairs in addition to the inherited real disposable Auth/account/profile/Inbox/navigation journey. It uses the existing local-only Supabase fixture and proof package, never canonical production credentials/data. Recovery remains honestly unavailable with Back. Reduced-motion screenshot proves entry reachability under the OS preference; its actual animation suppression is separately covered by the hook test, not inferred from a final still image. Exact-source native run/artifact review and final CI/CodeQL remain pending at this checkpoint.

## Remaining boundaries

Original47-item list remains the execution backlog, including AI factual preview/one final confirmation, shared exploration/map pins for both intentions, Agreement/chat, completion/capacity/calendar, push receipts, recovery/legal, publication review and store release. This unit closes none of those by appearance alone. Fresh17:09UTC read-only Supabase preflight still observed87 migrations, existing Edgev11,0RSD, HITNO-off and publication gates. No production configuration, migration, Edge, secret or price was changed.
