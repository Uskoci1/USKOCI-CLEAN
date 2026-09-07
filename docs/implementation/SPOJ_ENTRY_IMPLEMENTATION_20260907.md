# SPOJ entry and Auth

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
