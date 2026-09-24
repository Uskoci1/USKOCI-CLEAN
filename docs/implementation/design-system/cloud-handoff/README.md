# USKOČI UI unification — cloud handoff (2026-09-24)

The owner moved this work to a Claude Code cloud session to use the cloud session credits. This folder is everything
the cloud session needs that used to live only on the owner's PC.

## Read first

1. `AGENTS.md` (repo root) and `USKOCI_MASTER_PLAN_DIZAJNA.md` (the audit, the shared components and the owner's
   12-step order).
2. `rules/` — the working rules copied from the local agent memory. The binding ones:
   - `uskoci-autonomous-perfection-directive.md` — act as the whole senior team; decide everything except money,
     prices, payment provider, paid map/API keys, legal or privacy wording, serious-privacy permissions, destructive
     production changes, the business model and store release.
   - `uskoci-design-lead-directive.md` and `uskoci-design-pass-2026-09-23.md` — the design rules (old HTML is a source
     of function only; no eyebrows or orientation copy; one primary action; hold-to-talk sends on release; Lottie
     approved, expo-speech NOT approved).
   - `uskoci-owner-decisions-2026-09-24.md` — the voice notice wording is approved; a task may show street names (no
     house number) before a Dogovor.
   - `uskoci-ai-chat-reference-gemini.md` — the AI chat look.
   - `uskoci-ci-and-tooling-caveats.md`, `uskoci-route-test-harness-caveats.md`, `uskoci-local-windows-proof-caveats.md`
     — test and CI traps (Android font scale 1.3 arrives as 1.2999 → `useTextScale()`; tracked `outputs/` fixtures are
     type-checked; new supabaseClient imports crash screen suites; workflow scripts must be LF).
   - `uskoci-owner-evidence-first-rule.md` — read the real code before claiming anything; no blind fixes.
3. The receipts in `docs/implementation/design-system/r1-emulator-d7152e9f/` … `r4-emulator-f88216cd/` and
   `OWNER_DECISIONS_20260924.md`.

## Standing boundaries (unchanged)

- Work only on `work/uskoci-ui-unification-20260924`. Never change `clean-alpha-backend`, never merge the quarantine
  branch `repair/ru0-ru1-backend-20260902`, never commit the untracked
  `supabase/migrations/20260913090000_clean_v5_fix_application_spam_and_resolution.sql`, `.impeccable/` or the untracked
  files under `outputs/native-product-review-20260922/`.
- No server, migration, Edge, key or `verify_jwt` change in this UI work. No new dependency without the owner.
- No secrets, passwords or tokens anywhere. No paid AI or map calls.
- Serbian Latin with "ti", no gendered forms, no "server" wording; text ≥ 12 px; touch ≥ 48; never invent data.

## Where the work stands

| Owner step | State |
| --- | --- |
| 1 Audit | done |
| 2 Design system and shared components | done, emulator-verified |
| 3 Navigation, headers, bottom bar | done, emulator-verified |
| 4 Map, pins, filters | done, emulator-verified |
| 5 Task card, task detail, Moje prijave | done, emulator-verified |
| 6 AI conversation (Gemini-style) | done, emulator-verified through the `dizajn-ai` gallery |
| 7 Incoming applications, candidate choice | done, emulator-verified through `dizajn-kandidati` |
| 8 Dogovori, Pregled, Poruke | done, emulator-verified through `dizajn-dogovori` and the real screens |
| 9–11 Profile, calendar, notifications/settings, privacy/support | built and emulator-checked on 644cab09; review fixes (round 5b) — see "Current head" below |
| 12 Remaining screens and whole-app regression | next: `round6.workflow.js` |

Proof workflows green on f88216cd: PKG-003, 004, 005, 006, 007, 047. RU-2 Edge RN source proof fails for a
pre-existing reason (its pinned strings were removed before this branch; last green 2026-09-03).

## Current head

See the last section of this file (updated at handoff).

## How to continue in the cloud

1. Integrate anything the handoff lists as pending, run `npx tsc --noEmit -p tsconfig.json` and the full `npx jest`
   (expect ~300 suites, ~5,600+ tests; a 5 s first-run timeout of `my-applications-native`, `firebase-config`,
   `w02-location-native` or `v5-need-lifecycle-screen` under load passes when re-run alone).
2. Run round 6 with the Workflow tool: `scriptPath: docs/implementation/design-system/cloud-handoff/round6.workflow.js`,
   `args: { repo: '<absolute path of this checkout>', base: '<full sha of the head>' }`. It rebuilds the remaining
   screens (application composer and rating; publish review, place and photos; Q&A and Dogovor sub-screens) as
   audit → build → three-lens review, and runs a whole-app consistency sweep whose findings are each checked by a
   skeptic. Then integrate the branches (cherry-pick), apply the reviews with one fixer per area, verify, run the full
   Jest, push.
3. Each finished round: push, then dispatch the APK build for the emulator:
   `gh workflow run "Build Android development APK" --ref work/uskoci-ui-unification-20260924 -f target=emulator`, and
   the proof workflows whose `paths` match the changed files (`pkg003`…`pkg007`, `pkg047`). The owner's PC does the
   emulator screenshot loop (install with `adb install -r`, galleries `uskociapp://dizajn-*`, emulator in
   Europe/Belgrade); the cloud cannot run the emulator.
4. Record evidence in `docs/implementation/design-system/r<N>-…/` and update `docs/control/redovi.json`
   (`node scripts/control/osvezi.mjs`).

## Open owner items

- Payment-ready UX (99 RSD connection fee, subscription, platform fee, HITNO): waits for the owner's P1–P12 decisions
  in `docs/implementation/research/PAYMENT_READY_ARCHITECTURE_20260923.md`.
- Geocoder for public release (LocationIQ paid vs the state address register), shared vocabulary for vehicles and
  tools, the four calendar wording choices and what "Mogu odmah" means to others (listed in the round-5 calendar
  report), the binding four-sentence candidate choice confirmation (kept word for word).

## Current head at handoff

- Branch `work/uskoci-ui-unification-20260924` at `bc127755` (rounds 1–5 and the round-5 review fixes integrated).
- `npx tsc --noEmit` clean; full Jest **297 suites / 5,707 tests** pass on `bc127755`.
- Emulator build `36015751245` was dispatched on `bc127755`; the owner's PC photographs it.
- **Do first in the cloud (round 5c):** the independent verifiers of the round-5 fixes left small items, all "fix first"
  or low. Read `round5b/*-verify-*.md` (profil: keyboard footer dead tap and two photo fixes that clash; kalendar: the
  overnight-copy one-line regression and two accessibility fixes; obavestenja: the inbox filter rebuilding the whole
  list and two accessibility regressions; privatnost: two support-screen defects; r4: three presentation items). Apply
  them with one fixer per area (disjoint files, as in `round5b/*-fixer.md`), verify, run the full Jest, push.
- Then run round 6 (`round6.workflow.js`).
