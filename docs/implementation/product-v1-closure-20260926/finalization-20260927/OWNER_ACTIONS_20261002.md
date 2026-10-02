# What only the owner can do or decide (2026-10-02)

**Update 2026-10-02 11:02: the owner accepted all 75 proposals (record: `OWNER_DECISIONS_20261002_ALL75.md`).** What remains for him are the actions in section 2 and the exact "PRIMENI ..." words of section 3; the table of ten answers below is now a record of what was proposed and accepted.

Answer to the owner's question "šta treba kroz mene" (what has to go through me). This is a **reading list, not a tracker**: the status registry stays `docs/control/redovi.json` and the plan stays `docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html`. Nothing below is a decision until the owner says so; every "default" is the team's proposal and is applied only as a working assumption (and recorded as such). The complete lists, with sources, live in the scope records: `EX05_CANONICAL_SCOPE_20261001.md` (sections 8-9), `EX06_CANONICAL_SCOPE_20261001.md` (owner questions Q1-Q7), `EX07_CANONICAL_SCOPE_20261001.md` (sections 8-9), `EX09_CANONICAL_SCOPE_20261001.md` and the `finalization.ex09` block of the registry (23 gates, 14 questions), and `docs/implementation/ui-ux-pass-20261002/UIUX_PLAN_AND_STATUS_20261002.md` (13 UI questions).

The COMPLETE list (75 questions, a proposal for each, sources) is `OWNER_QUESTIONS_AND_PROPOSALS_20261002.md`, and the same list is an interactive page that saves the answers: https://claude.ai/artifact/9JRQthzUMM6M3qw4ZxCK2a (private, only the owner can open it). The ten below are the ones to answer first.

## 1. The ten answers that unblock the most (one word each is enough)

| # | Question | Proposed default (not a decision) | What it unblocks |
| --- | --- | --- | --- |
| 1 | **iOS in the first release?** | Android first; iOS recorded as an explicit limit | EX-09 store scope, voice/push "DONE" wording, the iPhone half of every account flow, Apple account and bundle id |
| 2 | **Push in the first store release?** | No, until a Firebase app for `rs.uskoci` exists; P4 closes on the Android preview build | EX-05 S06/S12, EX-06 "relevant notification" measure (Q2), J14 |
| 3 | **Free launch at 0 RSD or a connection fee before the first public release?** | Free at 0 RSD (plan 3.2, price list is at 0) | Terms, store copy, payments work, B09/PKG-049 |
| 4 | **PROD: a new separate Supabase project (organisation, plan, region, cost) or a formal promotion of DEV?** | New separate project (the plan's recommendation) | EX-09 promotion package, reviewer accounts, removal of the TEST world |
| 5 | **V1 scope: HITNO (urgent dispatch), P05 reminder, voice, the written review comment (D12): deliver or defer?** | HITNO out of V1; P05 explicitly deferred; voice Android-only until iOS exists; D12 stays server-applied with the client behind a flag until the legal texts exist | Store truth, Terms, EX-05/EX-06 closure wording |
| 6 | **expo-audio and the microphone text** (the 2026-09-30 compatibility check is written; hold-to-talk sends on release vs tap-review-send) | Approve expo-audio; keep hold-to-talk sends on release with the accessible review mode (AGENTS 3.6.3) | B2-b native voice, the Android dictation migration |
| 7 | **Operator / company data, domain, named moderation-support person and intake channel** | Nothing is invented; drafts keep `[[OPERATER]]` placeholders | Every legal page, N04, N02 real email, store forms, support/safety "works" claims |
| 8 | **Retention periods (the 12 LEG-10 decisions) with counsel** | Cannot be defaulted by the team | Export policy publication (N09), closure disclosure, final privacy pass |
| 9 | **Paid-AI budget for the EX-06 corpus run** (provider/model, maximum calls and a ceiling, which accounts) | No paid call until agreed; the corpus stays synthetic | EX-06 S08, the live interview-to-notification chain |
| 10 | **The 13 UI questions** (icon colour, Home doors photos vs FactArt, tab bar dock, haptics policy, Poruke tab, map ground, ...) | Each has a default in the UI plan and is applied as an A/B on the design board | UI waves 3-12 without waiting |

## 2. Things only you can do (accounts, keys, devices)

- **A phone window**: your word "sad" (about 6 minutes). Next use: the three B22 animation probes on the Zadaci screen (the UI wave-1 build is already installed and was seen once on 2026-10-02). Keep USB debugging on, the app open on Početna, the notification shade closed.
- **Accounts and keys, never typed into chat**: Apple Developer account (and an iPhone), Google Play developer account (type and opening date decide the 12-testers rule; confirm `rs.uskoci` is permanent), Firebase Android app + FCM credential + Expo access token (only if push is in), EAS production environment variables, Supabase Auth dashboard (Site URL, redirect allowlist), email sender with SPF/DKIM and a domain, production Gemini billing, a disposable mailbox, a second signed-in session for person B on the emulator.
- **Hygiene**: restrict or rotate the two publicly leaked Google API keys named in `docs/implementation/cleanup-inventory-20260930/`; the repository is public.
- **Repository setting I will not change without your word**: the variable `RNR01_PUBLISH_PATCHED` (it makes the published dev APK the Reanimated-patched one).
- **B22 closure**: after the probes P1, P2, P4 pass, the registry wording says B22 closes only with your word ("effect without animation regression").

## 3. Words I will ask for later (each is a separate, exact "PRIMENI ..."; none is requested today)

| Package | State | The words |
| --- | --- | --- |
| EX-06 ex06b (alias registry + F2 stem fix, certificate-neutral) | being authored; needs a green CI proof and a written approval block | "PRIMENI EX-06 ex06b" |
| EX-07 N06/N07 target name (function-only), N10 second-device closure discovery (moves the certificate), policy publication mechanism (no values) | candidates not yet written | each its own "PRIMENI", the certificate one naming the re-bind and a compatible APK |
| EX-05 single-target push admission | needs your answer to question 2 and to the route question first | "PRIMENI ..." |
| D12 revert | exists, proven on the chain, NOT applied; its window closes at the first stored comment | only if you want it |
| Anything on PROD, any real closure, any DEV test-account creation, any message sent on DEV | not authorised | your prior word each time (AGENTS 3.1.8) |

## 4. What the team does without you (the working queue, in order)

D12 client behind the OFF flag; UI wave 2 (tab bar, Glyph/chrome) and the first-look fixes (clipped "Istorija" tab label, card head at 361 dp); EX-06 S04 (dispatch negatives proof) and S06 (alias registry candidate); EX-05 S02 (media-cancel concurrency proof); then EX-07 S01/S02/S03/S08, EX-05 S01/S03/S04, the legal matrices (technical drafts only), the stale proof pin tables, UI waves 3-11. Each unit is reviewed by independent read-only agents before it is committed, proven on a disposable chain or by tests, and recorded in the registry with what is and is not proven. Nothing is applied to DEV or PROD, no phone is touched and no paid call is made without the words above.
