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
| 4 Map, pins, filters | done, emulator-verified; rebuilt 24.09 as Discovery V47 (Airbnb model) — in code, emulator check pending |
| 5 Task card, task detail, Moje prijave | done, emulator-verified |
| 6 AI conversation (Gemini-style) | done, emulator-verified through the `dizajn-ai` gallery |
| 7 Incoming applications, candidate choice | done, emulator-verified through `dizajn-kandidati` |
| 8 Dogovori, Pregled, Poruke | done, emulator-verified through `dizajn-dogovori` and the real screens |
| 9–11 Profile, calendar, notifications/settings, privacy/support | built and emulator-checked on 644cab09; round 5b and 5c review fixes in code (5c emulator check pending) |
| 12 Remaining screens and whole-app regression | round 6 screens done in code (emulator check pending); whole-app sweep paused with 181 findings in `../r6-sweep/FINDINGS.json` |

Proof workflows green on b4531ef: PKG-004, 005, 006, 007, 008, 010, 042, 046, 050 (earlier on f88216cd: PKG-003, 047). RU-2 Edge RN source proof fails for a
pre-existing reason (its pinned strings were removed before this branch; last green 2026-09-03).

## Current head

See the last section of this file (updated at handoff).

## How to continue (any agent: Claude Code, Codex or a person)

Round 6 is done; `round6.workflow.js` is kept as history (it needs Claude's Workflow tool). Everything below works
with a plain shell.

1. `git fetch origin && git checkout work/uskoci-ui-unification-20260924 && git pull`, then `npm ci` (its postinstall
   generates the gitignored `src/ui/referenceEntry/entryReferenceData.ts`; with `--ignore-scripts` run
   `node scripts/sync-entry-reference-assets.cjs` yourself).
2. Work the "Next, in this order" list in the "Current head" section below. One writer per file; the owner's local
   session owns payments and PKG-051.
3. Verify every change: `npx tsc --noEmit -p tsconfig.json` and the full Jest
   `npx jest -w 3 --testTimeout=30000 --testPathIgnorePatterns '<rootDir>/.claude/' '/node_modules/'` (expect about
   302 suites / 5,882 tests; a first-run 5 s timeout under load passes when re-run alone). Read the rules in
   `rules/` first (text scale via `useTextScale()`, the route test harness traps, LF line endings).
4. Push, then dispatch the emulator APK (`gh workflow run build-android-dev-apk.yml --ref
   work/uskoci-ui-unification-20260924 -f target=emulator`) and every `pkg0*` proof workflow whose `push.paths` match
   the changed files (they run only on `work/pre-v3-engine-integration-20260911` by themselves, so dispatch them on
   this branch). The owner's PC does the emulator screenshots (`adb install -r`, galleries `uskociapp://dizajn-*`,
   emulator in Europe/Belgrade).
5. Record evidence in `docs/implementation/design-system/r<N>-…/`, update `docs/control/redovi.json`, run
   `node scripts/control/osvezi.mjs`, commit, and republish `docs/control/out/tabla.html` to the control table page.

## Open owner items

- Payment-ready UX (99 RSD connection fee, subscription, platform fee, HITNO): waits for the owner's P1–P12 decisions
  in `docs/implementation/research/PAYMENT_READY_ARCHITECTURE_20260923.md`.
- Geocoder for public release (LocationIQ paid vs the state address register), shared vocabulary for vehicles and
  tools, the four calendar wording choices and what "Mogu odmah" means to others (listed in the round-5 calendar
  report), the binding four-sentence candidate choice confirmation (kept word for word).

## Current head (updated 2026-09-24 evening by the cloud session)

Any agent (Claude or Codex) continues from here. The earlier "current head" text (bc127755, round 5c to do first) is
history: round 5c and round 6 are done.

**Branch** `work/uskoci-ui-unification-20260924` (the cloud session also mirrors it to `…-poazkl`). Head: see
`git log -1`; code head `b4531ef` plus docs. Nothing was merged into `main`. No server, migration, Edge, key or DEV
change was made by the cloud session.

**Done on 2026-09-24 in the cloud session** (all in code and tests, NOT yet seen on the emulator or a phone):
- Round 5c: the verifier leftovers of `round5b/*-verify-*.md` in five areas (profil, kalendar, obavestenja,
  privatnost/podrska, r4).
- Owner decisions 1–7 (see `../OWNER_DECISIONS_20260924.md`): "Mogu odmah" saves on its own; no skill labels in the
  offer; export step "Ova kopija se ne može sačuvati."; no "server" wording in receipts; photos only in task detail.
- Discovery V47 (the Zadaci tab on the Airbnb interaction model: search pill, step-card panel Gde/Kada/Kako se radi/
  Koliko vas dolazi/Cena, quick chips, list follows the map, "Bez tačke na mapi", one floating pin card, "Mapa" pill,
  remembered state) plus 21 fixes from three independent reviews; one reset label "Obriši uslove".
- Round 6 in three parallel cloud sessions, each with a three-lens review applied: `../r6-prijava/REPORT.md`,
  `../r6-objava/REPORT.md`, `../r6-dogovor-dodaci/REPORT.md` (specs in `../r6-specs/`). Galleries:
  `uskociapp://dizajn-prijava`, `dizajn-objava`, `dizajn-dodaci`.
- Verification on `b4531ef`: `tsc` clean; full Jest **302 suites / 5,882 tests**; proofs green: PKG-004, 005, 006, 007,
  008, 010, 042, 046, 050; emulator APK run `36038648243` (artifact `USKOCI-DEV-APK`).
- Control table rows updated (`docs/control/redovi.json`, 24.09 uveče notes) and recomputed.

**Next, in this order**
1. **Emulator loop on the owner's PC** for `b4531ef`: DONE 2026-09-24 late evening (local session). Build 36038648243
   installed on the emulator; the Zadaci tab and the three galleries photographed (27 + 24 + 28 scenes) and critiqued
   by two lenses with a code-aware skeptic per finding: **113 confirmed findings** (2 high, 36 medium, 75 low) in
   `docs/implementation/design-system/r6-emulator-b4531ef/FINDINGS.json`, the fix order per file in `R6_CRITIQUE.md`,
   the receipt in `R6_RECEIPT.json`. Still owed: widths 320–430 dp and font scale 1.3, real flows, TalkBack.
   **Fix what the pictures show** = the "Fix first" table of `R6_CRITIQUE.md`, one writer per file.
2. **Owner decisions of 2026-09-24 evening, not yet built:**
   - a. "U blizini" NOW (owner: "Da, odmah"): add `expo-location` with `npx expo install expo-location` (approved),
     ask the foreground permission only when the person taps "U blizini", use the position only to centre the map,
     never store or send it.
   - b. Remove "Trenutna lokacija" (sharing where I am now) from the Dogovor: its screen, route
     `/dogovor/[id]/lokacija` and entry points. KEEP the exact task address grant (`AgreementPrivateLocation`). Delete
     nothing on the server.
   - c. Written comment with a rating: YES. Needs a server package first (candidate + disposable proof + contract:
     column, length, who sees it, report path, retention on closure); DEV only on the owner's "primeni"; then the UI.
   - d. Remove the place confirmation checkbox ("Javno mesto i privatni podaci su provereni.", also the remote and the
     worker-area variants): pressing save is the confirmation (the client still sends `confirmed: true`).
   - e. Past special availability dates are never deleted automatically (no change needed).
3. **Whole-app sweep findings:** `../r6-sweep/FINDINGS.json` — 181 findings (24 major: 22 confirmed, 2 unchecked; 157
   minor/polish unchecked). The run was paused to save usage. Re-verify each against the current code, then fix with
   one fixer per area.
4. After each step: tsc + full Jest, push, dispatch the emulator APK and the proofs whose paths match, update
   `docs/control/redovi.json` + `node scripts/control/osvezi.mjs`, republish the control table.

**Coordination.** The owner's local session is building PKG-051 (versioned platform price list at 0 RSD). Payments
and the price list belong to it; the cloud session did not touch those files. It must `git fetch origin` and merge
`origin/work/uskoci-ui-unification-20260924` before its next push (no rebase, no force push).

**Still the owner's:** the payment model (free now; later Google Play billing, e.g. via RevenueCat, and/or a web
"USKOČI kredit" with DinaCard/Visa; KupujemProdajem-style paid visibility discussed), legal documents, the geocoder,
the production database, Play Console and the closed test.
