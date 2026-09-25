# USKOČI — repository entry map

R10 HOME AND DISCOVERY (2026-09-25): app source `0f4d7644`. Read `docs/implementation/design-system/r10-home-and-discovery-20260925/REPORT.md` and its receipt.
Home uses an agenda card with unchanged time/person facts; map search, attribution and preview/list heights adapt
to narrow/large-text layouts; navigation keeps whole labels and selected state. Internal Home fixtures are inert;
the chat fixture now matches the real keyboard origin. Types and 312 suites / 6,067 tests pass with the existing
teardown warning. Initial APK `36112841705` exposed the large-text filter footer; correction APK `36115051955` is attested/installed, with normal and enlarged-text filter controls observed. Extreme-text chat keyboard composition remains open. No server, payment,
provider, migration or dependency change. Preserve the owner's larger-batch working preference.

R9 DECISIONS AND MESSAGES (2026-09-25): source `ad0b16ca`, same UI unification branch. Read
`docs/implementation/design-system/r9-decisions-and-messages-20260925/REPORT.md` and its receipt.
Task detail leads with work and truthful terms; human chat uses a full-width composer and distinct speaker surfaces.
Initial APK `36107782918` confirmed task detail and AI latest-message return, but exposed a clipped recovery control.
Correction keeps both actions outside a measured message viewport. Types and 310 suites / 6,031 tests pass
(existing teardown warning). Correction APK `36110012089` is attested/installed; recovery actions fit normal and large text. R10 observed the normal chat keyboard after the fixture-origin correction; extreme-text keyboard composition remains open.
No server, payment, provider or dependency change.

R8 AI CONVERSATION EXPERIENCE (2026-09-25): source `0976b373`, same UI unification branch. Read
`docs/implementation/design-system/r8-ai-conversations-20260925/REPORT.md` and the root master plan's R8 section.
Task and worker conversations now share a full-width composer, adaptive illustrated summaries, clearer speaker
identity and latest-message navigation. Worker review preserves every frozen fact in open sections; completed
answers announce once without re-entering streamed/history rows. Owner refinement adds mint ground, nuanced white
surfaces, forest user bubbles, illustrated openings and a scrollable summary for very large text/short heights.
Types and 309 suites / 6,016 tests pass with the existing teardown warning. Final combined emulator APK run
`36105043985` is attested and installed on the emulator. Bounded welcome/thread/review/recovery and large-text
observations and bounded docked-keyboard checks are recorded; phone and screen-reader acceptance remain pending. R8's return shortcut
reaches the final answer but can remain visible; R9 carries the terminal-scroll correction. The earlier `5da4bb6e`
APK exposed the large-text crowding corrected in `0976b373`.
No server, provider/prompt, microphone, payment, migration or dependency change. Do not equate text voice mode
with spoken AI answers. Preserve the owner's larger-batch preference and the existing recovery/ownership guards.
Latest owner design direction supersedes old white-only/shadow prohibitions: white can be beautiful with depth
and tonal layers; each screen must be composed for its purpose. The current master-plan checkpoint records this.

R7 CLIENT COHESION (2026-09-25): current app source `43535736`, continuing the R6 recovery on
`work/uskoci-ui-unification-20260924`. Read root `USKOCI_MASTER_PLAN_DIZAJNA.md`'s current checkpoint and
`docs/implementation/design-system/r7-cohesion-20260925/REPORT.md` / `RECEIPT.json`. Place checkboxes removed;
Agreement current-location UI retired; approved explicit-tap Nearby added; typed AI draft ownership and worker
Back/availability defects corrected; shared Inter/motion/card cohesion and branded map palette/pins implemented.
Types and 308 suites / 5,996 tests pass (existing teardown warning). APK run `36099357856` is attested and installed
on the emulator; bounded map/card/filter observations are in the receipt. Large-text search/navigation/credits,
high-density markers, GPS success and phone acceptance remain open. APK/native/phone evidence stays separate.
Owner now wants larger coherent batches before APK/device verification, not a new build for every small edit.
Normal soft/fluid motion stays enabled; Reduce Motion is the individual's system preference. No DEV/Edge/payment
or frozen-migration changes. The control rows and master plan hold remaining AI, R6, functional and release work.

R6 RECOVERY (2026-09-25): Codex recovered the four interrupted local fix commits through `25dd5d13`, integrated
`r6fix-pinmap` and the uncommitted `r6fix-izmene`, and connected all six pending Skeleton callers. Read
`docs/implementation/design-system/r6-integration-20260925/REPORT.md` for scope, evidence and open work. Types clean;
305 suites / 5,921 tests passed (worker teardown warning). The report separates source, CI and emulator acceptance.
The original Claude checkout is intact; this package changes no DEV/Edge, payments, migrations or dependencies.

SHIP PASS (2026-09-23 evening, owner: "večeras šaljem app na Google Play", ship mode). Read
`docs/implementation/RELEASE_CHECKLIST_GOOGLE_PLAY_20260923.md` first: only an internal-testing upload is realistic
tonight, and its remaining steps are the owner's (package name, which is permanent in Play Console; EAS `production`
environment variables; Play Console app, listing and privacy URL). The EAS pre-install hook now admits the reviewed
store bundle (`production`) next to the preview APK with every other boundary unchanged. The rating screen's dead
stars (RATING-DEAD-STARS-01) are fixed and re-checked on the emulator. A read-only regression of 24 screens on build
e9e0ab65 found four copy/logic defects, fixed in 815bedfc
(`docs/implementation/design-audit-20260923/emulator-e9e0ab65/REGRESSION_RECEIPT.json`). Root error boundary,
SuccessMark, sliding segments, memoised lists and `userInterfaceStyle: light` are in. No server, guard contract,
migration or dependency changed tonight; no phone finger test was possible (phone not connected).

V41 DIRECTION (2026-09-23 late evening). The owner: V41 HTML is the direction for the look, not a new layout ("velika
dugmad ostaju, ovo su samo usmerenja"); the forensic UI/UX analysis doc is the rulebook. Početna keeps its two big tiles;
one ORANGE primary per screen, every other action white with a green label. Transferred: one tab header (profile · mark ·
bell), warm strips, underlined tabs with quiet counts, person-first Dogovori cards and Dogovor bar, V41 task detail and
Prijave, Profil identity row, bell swing / arriving art / breathing skeletons. Final code 6f084f95: Jest 251/4,816, proofs
green, emulator regression 24/24 without a crash (docs/implementation/design-audit-20260923/final-6f084f95-v41/).

CLOUD SESSION RESULT (2026-09-24 evening): round 5c, owner decisions 1–7, Discovery V47 (Zadaci on the Airbnb model)
and round 6 are in code on `work/uskoci-ui-unification-20260924` (Jest 302/5,882, nine proofs green, emulator APK run
36038648243), not yet seen on the emulator. Continue from the "Current head" section of
`docs/implementation/design-system/cloud-handoff/README.md`: emulator loop, the owner's evening decisions ("U blizini"
now, remove "Trenutna lokacija", rating comment server package, no place checkbox), then the sweep findings in
`docs/implementation/design-system/r6-sweep/FINDINGS.json`. Payments/price list (PKG-051) belong to the owner's local session.
The owner's Serbian summary of the day: `docs/implementation/design-system/IZVESTAJ_20260924_OBLAK.md`.

PKG-051a (2026-09-24, proven and **applied** on the owner's "primeni pkg051a"): a versioned platform price list
(cenovnik) for Povezivanje (`CONNECTION`) and HITNO (`URGENT_BOOST`), every price **0 RSD**, server only. Canonical DEV
ledger is now **202 = 147 + 55 dev_alpha** (`20260924202023 dev_alpha_pkg051a_platform_price_list`); the certified closure
digest `cc248ff1…` is unchanged in all three places and asserted before and after. Storage: four data rows under new keys in
`private.marketplace_config` (`platform_price:<PRODUCT>:000001`, `platform_price_head`, `platform_payments` = off) — a
design-lead decision, because a new private table would move the certificate; the table's DDL, ACL, RLS and three existing
rows are pinned unchanged. Five `private` functions, SECURITY INVOKER, `search_path=pg_catalog`, executable ONLY by the
database owner (`{postgres=X/postgres}`; anon/authenticated/service_role refused, PostgREST cannot see them):
`platform_payments_enabled()` (kill switch: on only with the exact enabled row AND an existing `private.platform_charges`,
which no package creates), `platform_price_canonical(…)`, `platform_price_versions()` (integrity: self-hash, chain,
times, head; fails closed with `PRICE_LIST_INTEGRITY_FAILED`), `platform_price_list_at(timestamptz)` (current/next per
product; never serves a price above 0 while payments are off) and `platform_price_add_version(…)` (the only writer;
append-only; refuses any amount > 0 with `PLATFORM_PAYMENTS_DISABLED` while payments are off; a 0 version can always be
appended). **Nothing reads the list yet**: no app screen, no charge, no quote; the free Povezivanje ledger alone governs
every Agreement; P1–P12 stay open. Proof `36053060680` 17/17 on `0db57f50`; receipt
`supabase/operations/dev-alpha/ledger/20260924_pkg051a_application.receipt.json`; contract with the owner's 3-step
Serbian how-to `docs/implementation/v5-ai-first/pkg051/PKG051_PLATFORM_PRICE_LIST.md`. Same day: the owner's Codex app was
found running `npm ci` inside this session's worktree (`.claude/worktrees/uskoci-kompletan-audit-2e715e`), which gutted
`node_modules` mid-Jest; one agent per checkout. Late evening: build b4531ef4 was checked on the emulator (Zadaci
tab + the three round-6 galleries, 80 scenes; 113 confirmed findings in
`docs/implementation/design-system/r6-emulator-b4531ef/`), four fix groups were integrated (97653c2d, b1f394e6,
94a550d7, 25dd5d13), and the owner handed the rest to Codex: read the section "Handoff to Codex — 2026-09-24, 23:55"
at the end of `docs/implementation/design-system/cloud-handoff/README.md`.

CLOUD HANDOFF (2026-09-24, owner: continue in the cloud to use the cloud session credits): read
`docs/implementation/design-system/cloud-handoff/README.md` first. It carries the working rules copied from the local
agent memory (`cloud-handoff/rules/`), where rounds 1-5 stand (steps 1-11 built and emulator-checked; receipts in
`docs/implementation/design-system/r1-…` to `r5-…`), the round-5 verifier leftovers to apply first, and the cloud-ready
round-6 workflow (remaining screens plus a whole-app sweep). The emulator screenshot loop stays on the owner's PC.

MASTER DESIGN PLAN (2026-09-24): read `USKOCI_MASTER_PLAN_DIZAJNA.md` first for all UI/UX work. It holds the audit, the shared
components that replace the conflicting ones, and the owner's 12-step order. Work branch: `work/uskoci-ui-unification-20260924`.

AUTONOMOUS PERFECTION DIRECTIVE (owner, 2026-09-23 late night; memory: uskoci-autonomous-perfection-directive). Act as the
whole senior product team and decide everything except: real payments, prices, payment provider, Google Maps/API billing,
external accounts or keys, legal/privacy decisions, a permission with serious privacy consequences, destructive production
migrations or data deletion, the core business model, a store/production release. QA device is the Android EMULATOR
(AVD USKOCI_V5_TEST, build target `emulator`), not the phone. Every screen: implement → types/tests → build → emulator
screenshot → separate UX and VISUAL critique → fix → screenshot, until finished. LOCKED IA (plan in the Claude Doc tab
"Plan ekrana (23. sep)" of https://claude.ai/code/artifact/4e3c1c50-fa0b-48a7-b998-454e0b8b6923; sketches
https://claude.ai/artifact/B2YMSAQVPz7iuq6TXHgZLf): tabs Početna (overview: tiles, Čeka te, next Dogovor, Moji zadaci and
Moje prijave rows) | Zadaci (other people's tasks: map and list as ONE screen with a draggable list sheet) | Dogovori;
Moje aktivnosti retired; /mapa and /prilike redirect to /zadaci. The AI chat's reference look is the Gemini app (pill
composer, voice mode; memory: uskoci-ai-chat-reference-gemini). CI proofs that start the full local Supabase retry the start
on registry throttling (25dc016a).

SYSTEM PASS (2026-09-23 night, owner: "ovaj sistem ikona … kroz ceo app … izgled kartice isti", and of the orange
"Oceni saradnju" on his phone: "nije ove boje … loš fazon"). The PRIMARY ACTION IS NOW GREEN with a white label (V28 and
V41 both draw it so; `brandAction` + `sys.color.onGreen`); orange stays an accent only (Home publish tile, what waits,
map "+"). Do not switch it back from the doc alone. Also landed: one `vreme()` time format (src/lib/vreme.ts: "24. sep ·
12:00", year only when not current, never seconds); FactArt as the one icon system for every fact (12 new kinds); one
card look (`card`/`cardCompact` with V28's TaskCard shadow, `inset` for notes, no card inside a card); one voice without
grammatical gender (Tražiš pomoć / Uskačeš, Posao je gotov, Mogu odmah); one command vocabulary; no "server" wording;
notification settings in plain Serbian; one `field` token and pill chips. Commits cd2ffa2d…fbea3919 = checkpoint A,
including the eight fixes from the independent code review and the push-provider fix for Podešavanja obaveštenja found
on the phone. The owner's USB phone (HONOR, Android 16) runs fbea3919 via `adb install -r`, 0 crash lines
(docs/implementation/design-audit-20260923/phone-fbea3919/). After checkpoint A the owner's MASTER directive puts the work
in design-lead mode (memory: uskoci-design-lead-directive): toolset in docs/implementation/design-system/TOOLSET.md;
audit, design system, pictograms and screen order in the Claude Doc
https://claude.ai/code/artifact/4e3c1c50-fa0b-48a7-b998-454e0b8b6923; no screen is done before the phone screenshot loop.
Not done: one reduced-motion hook (motion.ts and useSystemReducedMotion.ts remain), write paths on the phone.
Step G.0 (c89b7223): the bottom bar only on the three roots (Početna, Mapa, Dogovori); 20 inner screens checked on the
phone without it (docs/implementation/design-system/g0-phone-c89b7223/). OWNER RULE, 2026-09-23 late: V28/V41/V46 HTML
is product documentation (functions, content, logic, data, flows), NOT design authority. For every screen ask whether a
premium USKOČI built from zero would organise it this way; if not, recompose it from scratch. Keep function and flow,
not the old look; key screens loop redesign → phone screenshot → critique → redesign.

CURRENT PRODUCT CHECKPOINT (2026-09-22): read
`docs/implementation/NEXT_AI_HANDOFF_20260922_PRODUCT_EXECUTION.md` first, then the current status,
integrated finishing plan, owner design direction/UX blueprint and control README. The paragraphs
below are dated history where superseded. The owner explicitly permits parallel agents now;
use bounded scopes and one writer per file. He made the connected USB phone available for retained-data
updates/read-only checks; no auth bypass, paid provider probe or real business mutation is implied.

Client implementation `9286fdeb` includes explicit offer review, named receipt landing, readable
offer cards/real note previews, accessible preview facts, truthful missing-rating copy and explicit
Agreement completion review for both sides. Existing services/guards/recovery/server are unchanged.
Combined types and 242 suites / 4,719 tests pass, exit0 (known Jest teardown warning). Read
`functional-audit-20260922/PRODUCT_EXECUTION_RECEIPT.json` for exact source/build/device status;
APK35775425984 is its source-bound build. Prior45a APK was installed with login retained and the
actual My Applications card inspected;50178 review/Android Back was checked without sending an offer.
Real two-party submission/completion, iOS, push delivery and Claude acceptance are still separate gates.

Four bounded reconciliation reports in functional-audit-20260922 cover UX, client/engine, release
operations and verification coverage; they explicitly distinguish current source from saved DEV
snapshots and untested paths. Do not represent them as a fresh exhaustive server audit. The release
plan is current; control rows remain the sole execution tracker. Its normal browser upload currently
has an unconfirmed file-chooser outcome; generation alone is not publication.

Keep other authors' control README/template changes and the forbidden untracked migration out of
your commits unless ownership is explicitly transferred. No server migration was applied in this round.

Owner follow-up (2026-09-22): the offer composer now opens an explicit review before sending.
See docs/implementation/functional-audit-20260922/OFFER_REVIEW.md and its receipt. The unchanged
route owns all validation, journaling and recovery. Types and 242 suites / 4,704 tests pass;
four new regressions fail on the predecessor. Both APKs of 50178e6b are attested and downloaded;
the emulator build is installed and opens to welcome/auth only. F10 remains partial: authenticated native acceptance,
named post-submit navigation and independent Claude review are pending. Do not bypass sign-in.

Owner follow-up (2026-09-22): continue client work while the owner cannot sign in on the emulator.
Use the isolated actual-component review without credentials, auth bypass or DEV fixtures; keep
authenticated native/device acceptance pending. Discovery now has persistent search, clear applied
price filters and compact illustrated map/list controls. Types and 242 suites / 4,700 tests pass.
See functional-audit-20260922/DISCOVERY_SEARCH.md and its receipt. Backend filtering and remaining
F06/F07 contracts remain open; this is not a completed discovery or release gate.

Functional analysis approval (2026-09-22, owner: "odobram sve to"): the 48-section analysis,
D1-D10 interpretations and proposed order are approved. Begin with client foundation F01-F04:
settings readback affordance, narrow map legend, notification type and primary section indication.
See docs/implementation/functional-audit-20260922/CLIENT_FOUNDATION.md. This supersedes the
analysis waiting gate below; backend/guard/certificate/dependency boundaries remain unchanged.

Control table (2026-09-22, owner request): `docs/control/` is the one living table from UX blueprint to phone (62 rows, six lights, blockers, store gates, two-phone test). After every piece of work: refresh `dev_snapshot.json` if DEV changed, edit `redovi.json`, run `node scripts/control/osvezi.mjs`, commit, and republish `docs/control/out/tabla.html` to https://claude.ai/artifact/VxTvL3VpwhYv8cxJCWzD5t. Telefon is green only with phone evidence for the current build. See `docs/control/README.md`.

Latest owner instruction (2026-09-22, after design autonomy): complete and show the whole-app functional
screen matrix before further implementation. New screens wait for approval of the analysis. Record
coverage/evidence in docs/implementation/functional-audit-20260922/. Existing approved bottom-sheet
APK/device verification may finish. No new backend/guard/recovery/dependency authorization is implied.
Owner follow-up: read docs/implementation/v5-ai-first/UX_NACRT_20260922.md before each screen.
Every audit row must record agreement, missing capability and proposed deviation from that draft.
Disclose differences before implementation; see functional-audit-20260922/REPORT.md D1-D10.

Latest owner design direction: read docs/implementation/OWNER_DESIGN_DIRECTION_20260922.md before
each screen. Inter/colors/FactArt/TaskCard are the foundation, V28 is a starting point with design freedom.
Green titles are explicitly welcomed; the preceding dark-title instruction was withdrawn. Work one
screen at a time, show it with one sentence of rationale, prove types/tests, build and verify on the phone.
Claude's independent screen review is required, not presumed complete.
Only @gorhom/bottom-sheet5.2.14 is newly approved; no blanket package or backend-change approval.
Package approval 2026-09-23 (owner "Da" to the explicit ask): `lottie-react-native` ~7.3.8, installed with `expo install`, for
characters and moments only (AI assistant states, "Dogovoreno!", empty states), never buttons or facts; wrapper
`src/ui/system/LottieArt.tsx` enforces reduced motion (first frame) and spoken-or-silent accessibility. `expo-speech`
(a narrator) was asked for separately and is NOT approved. The owner's Lottie files (V28) are awaited; none is bundled yet.

Native connected design slice20260922: ProductDetails now frames task details, applications,
Agreement overview, AI intake and settings; compact underlined views, larger real-profile identities,
existing colored FactArt navigation and reduced-motion handling are implemented. Filter attention/price
now apply atomically, and cancelling the sheet discards both drafts. Full Jest242/4689 and types pass;
new APK/device verification is pending at this entry's first commit. See
docs/implementation/DESIGN_NATIVE_CONNECTED_SLICES_20260922.md for scope, research, reuse candidates,
evidence and the missing server-owned Agreement subject links. No dependencies or DEV state changed.

Design direction, owner clarification 2026-09-22: preserve the supplied V28 HTML's colored illustrated
icons, palette, clean legibility and inset bottom-navigation character. Improve density using V31 as a
comparison; do not revert to the old native visuals or generic icons. See
docs/implementation/DESIGN_V31_V28_EXECUTION_20260922.md (R5 supplement) and the independent three-card
study outputs/design-v31-v28-20260922/PREDLOG.html. No production UI or dependency was changed in that pass.

Design freedom, latest owner decision 2026-09-22 (later the same day). It supersedes the "identical look"
paragraph below. The owner saw Codex's native screens and said some are better solved than in V28 (green
titles are "lepa i jasna"). He wants the designer to explore every possibility to the maximum (Wolt/Airbnb
quality, adapted to USKOČI) and then decide the design and layout of each screen:
- **V28, the slice-1 foundation and the V28 reference screens** (`docs/implementation/v5-ai-first/v28-reference/`)
  are the starting point and inspiration, not a lock.
- **Codex composes the screens.** Claude verifies each one (types, Jest, pictures next to V28) and reports.
- **Non-negotiable:**
  - server, guards and recovery stay;
  - no invented data;
  - text no smaller than 12 px;
  - a missing price never looks like an amount;
  - the bottom navigation always shows where you are;
  - tests pass;
  - new packages need the owner's approval.

Identical look, owner decision 2026-09-22 ("identičan izgled … slova … da preneseš u app" → "može"),
superseded above as a layout rule. Transfer the V28 look into the app, at V31's density, without the
prototypes' defects: text under 12 px, the Lottie layer-order bug, zero-noise chips, demo-only concepts.
Slice 1 is in production code:
- bundled Inter (`assets/fonts/inter`, OFL; the `expo-font` plugin; `src/ui/interFont.ts`);
- V28's measured palette in `sys.color`;
- the prototype's two-tone icons (`src/ui/system/FactArt.tsx`);
- the V28-anatomy `TaskCard`.

Web smoke and Jest pass; the phone render awaits a new APK. The three open owner choices are tabs
(Početna vs the prototype's Zadaci), primary button colour, and card corner. Record:
`docs/implementation/v5-ai-first/V31_IDENTICAL_LOOK_20260922.md`.

Current status index: `docs/implementation/USKOCI_CURRENT_STATUS.md`. Read the mandatory handoff first;
the index separates implemented/proved/applied/built/device-verified states and points out older snapshots.

Single integrated execution plan: `docs/implementation/APP_FINISHING_PLAN_20260922.md` (R1–R9),
consolidated at the owner's request on 2026-09-22. It covers engineering, push, complete flows, design,
account data, moderation/support, operator/legal/charging, production and store release. Keep its order
and completion evidence aligned with the status index. It grants no new permissions or product decisions.

Design pass (2026-09-23, owner: "brže i kvalitetnije"): the forensic UI/UX analysis is a Claude Doc the owner reads
(https://claude.ai/code/artifact/447394ea-56a9-49d8-9aba-46b49637af59; repo pointer and evidence in
`docs/implementation/design-audit-20260923/`). Owner rules recorded there and applied: no eyebrow and no copy explaining
where you are (inner bar = arrow + title-of-content), one orange action per screen with the reason beside a grey one,
"stalno / ponekad / retko" placement, hold-to-talk SENDS on release (accessible mode keeps review). Landed on
`work/pre-v3-engine-integration-20260911`: step 0 (fe97dc11: one inner bar, SettingsIntro without kicker/tagline, settings
gap, missing price as label), voice send (d4adb0b3), `lottie-react-native` ~7.3.8 approved by "Da" with `LottieArt`
wrapper (55b08aae/322cef0f; `expo-speech` NOT approved), AI welcome presence + FactArt card (aacff002), detail
(42dfe993), own tasks hidden in Prilike (2d4b61ed), discovery density (0a7005e6), notification row + Serbian time in the
offer (ce922ebb), grey offer button says why (f2703baa), finished Dogovor read-only line (4afd2ef3), unrated finished
Dogovor stays active with "Čeka tvoju ocenu" (7443432b). Emulator verified up to aacff002 (screens in design-audit
folders); the phone APK for aacff002 is downloaded, not installed. Awaited from the owner: HTML references, V28 Lottie
files, "oceni" for the emulator rating, the phone. Not done: seconds in `needScheduleText` (cdl-a03 fixtures), tab-bar
section highlight, the filter contract (PG02), fifth attention reason (server), notification text with names (server).

PKG-050a (2026-09-23, proven and **applied** on the owner's "Primeni pkg050a"): reading a Dogovor's conversation settles its
"Nova poruka" notifications (D03 / P01). Canonical DEV ledger is now **201 = 147 + 54 dev_alpha**, function-only, certificate
`cc248ff1…` unchanged and asserted before/after. `public.rpc_mark_agreement_messages_read(uuid)`, authenticated only, parties
only, marks read the caller's own unread MESSAGE_RECEIVED events about that one Agreement with the same in-app visibility rule
as `rpc_mark_activity_event_read`; nothing of the other party's and no other event kind. The app calls it through
`Izvor.oznaciPorukeProcitanim` whenever the Poruke tab shows a freshly loaded list (best effort). Proof `35826370830` 7/7,
re-proven `35827171627`; receipt `supabase/operations/dev-alpha/ledger/20260923_pkg050a_application.receipt.json`; contract
`docs/implementation/v5-ai-first/pkg050/PKG050_AGREEMENT_MESSAGES_READ.md`. **The installed builds do not call it yet.**
Same day: the two-party flow on phone + emulator reached COMPLETED (receipt in
`functional-audit-20260922/device-20260923/dve-strane/`); the tracked `outputs/…/review.tsx` fixture and the task-detail
suite were repaired after they had failed every proof workflow since 332d285f; all four proof workflows are green on 52ce4cc0.

PKG-047 and PKG-048 (2026-09-23, proven and **applied** on the owner's "primeni pkg047a i primeni pkg048a").
Canonical DEV ledger is now **200 = 147 + 53 dev_alpha**; both are function-only and the certified closure digest
stays `cc248ff125c67146bb343db7d222230cb291be99048125d55f6b547ce49e36f7`, ready, which each candidate asserts
before and after.
- **PKG-047a** (F05 / B08 / N06 / N07): `public.rpc_read_safety_target(uuid)`, authenticated only, resolves a
  public profile into the person behind it plus the caller's own block revision, repeating the visibility of
  `rpc_get_public_profile` exactly and answering null — never an error — for an unknown, unpublished or hidden
  profile, the caller's own account, or a block in either direction. Report and block are keyed by the account
  because a person shows two faces; the owner decided on 2026-09-22 that this id may be disclosed for safety,
  the same disclosure a Dogovor already makes. The app gains one entry, "Prijavi ili blokiraj", on the public
  profile sheet, wired from an opportunity and from a candidate. Proof `35805442368`, 10/10.
- **PKG-048a** (F12 / D02): `rpc_get_agreement_workspace` also returns `needId` and `applicationId`, so a Dogovor
  can open the Zadatak and the Prijava it grew out of. Nothing new is disclosed — the function already answers
  only the two parties and each owns its end. Proof `35805788358`, 7/7, including that the rest of the document
  is byte-identical. **The app does not show the links yet.**
Receipts: `supabase/operations/dev-alpha/ledger/20260923_pkg047a_application.receipt.json` and
`…_pkg048a_application.receipt.json`. Neither has been exercised on a phone.

PKG-046 (2026-09-22, proven and **applied**; the owner approved the certificate movement with "primeni pkg046a"):
task-photo upload cancellation, finding F16 / control row A05. The app's "Odustani od nepotvrđenog slanja" called
`rpc_cancel_media_upload(uuid,uuid)`, which did not exist on DEV. The 2026-09-16 pkg008 candidate could not be used:
it creates a new table, which moves the closure certificate AND would sit outside the 73 redaction relations.
Instead the cancellation lives inside `private.owned_media_assets` as a `CANCELLED` tombstone (null inputs, TASK,
never selected/dispatched/stored), the service claim gains one fence after its advisory lock
(`MEDIA_COMMAND_CANCELLED`), `rpc_read_media_upload` skips tombstones, and the new owner-only writer retires an
absent, admitted or READY command through existing writers. Disposable proof `35787119578` (source `a0c12868`)
passes all 10 checks, including a real closure worker erasing an account that holds a tombstone.
**Canonical DEV ledger is now 198 = 147 + 51 dev_alpha, and the certified closure digest is
`cc248ff125c67146bb343db7d222230cb291be99048125d55f6b547ce49e36f7`** in all three places, `retention_ai_source_ready()`
true; the earlier `65980fce…` is historical, so any candidate pinned to it is stale. The four existing media rows are
untouched, no Storage object and no Edge function changed. Receipt:
`supabase/operations/dev-alpha/ledger/20260922_pkg046a_application.receipt.json`; contract:
`docs/implementation/v5-ai-first/pkg046/PKG046_MEDIA_UPLOAD_CANCELLATION.md`. **Not done:** the button has not been
pressed on a phone (the installed APK already makes the exact call, so no new build is needed), and the Edge
`uskoci-media` safe-code change is written but NOT deployed — that is the owner's byte-exact CLI route and affects
only how a delayed send's refusal is reported.

Control table (2026-09-22, strengthened): the owner's read-only forensic package R4 (frozen at `9286fdeb`) is
verified by its own manifest hashes and kept at `docs/control/izvori/r4-20260922/`. `scripts/control/osvezi.mjs`
turns it into four sections that are re-checked against the live tree: `tokovi` (all 24 notifications — where the
blueprint wants each one and which screen the app really opens, checked against `src/app/obavestenja.tsx`: 14 exact,
7 right screen but not the right place, 1 wrong target, 2 unproven), `nivoi` (all 62 rows placed across 13 surfaces),
`praznine` (12 read-model gaps) and `snimak` (re-tests the snapshot's claims). The snapshot supplies analysis; the
lights stay computed. See `docs/control/README.md`.

PKG-045 (2026-09-22, proven; A DEV applied, B HOLD): public task column privacy7.17. Candidate A adds
explicit task reads and adapts list/notification dependencies; it preserves the ready closure certificate
and old clients. Candidate B removes broad SELECT and maintains five dependent owner predicates.
IMPORTANT: table ACLs are in closure_erasure_program_digest_v5(), so B includes an isolated recertification
and requires explicit owner approval AND compatible APK rollout. On 2026-09-22 the owner explicitly
approved pkg045b and the internal certificate update AFTER verification of the new app. That approval
is granted; do not ask for it again. B remains ON HOLD for phone readiness and verified rollout.
A is applied: ledger197, unchanged ready closure65980fce asserted atomically,
exact ledger text and six function bodies/ACLs/security/config match proof35710468643 source92f75b11.
17 SQL/Auth/REST/actual-client checks and355 offline Edge tests pass. Real disposable closure under B
reaches CLOSED and erases the draft/private address. Finding7.17 remains OPEN until B rollout.
APK35707463751 source05fa7232 is built/downloaded,
hash ed69c7ae… and both attestations match; not installed. Types, Jest242/4687 and108 focused client checks
pass. Phone readiness and the number of active test phones are still pending; approval does not imply
that the device verification condition has been met.
See pkg045/PKG045_TASK_COLUMN_PRIVACY.md, PROOF_35710468643.json and the A DEV receipt.

PKG-044 (2026-09-22, Edge deployed): do not overwrite a contextual ASK for a genuinely missing field
with a canned question. Preserve known-field retargeting and all fact/ambiguity/ownership guards.
Three old-code failing regressions,90 focused checks and types pass. CI35702324170 source7b6478a8:
355 offline Edge tests plus25 disposable integration checks. Owner confirmed improved dialogue and asked
for warmer, slightly longer replies with occasional emojis. Prompt-only refinement d73d8c5a passes90 local
checks; CI35704269701 passes types,355 Edge/25 integration checks. Current intake50 byte-verified,
JWTtrue, anonymous401 (TONE_EDGE_RECEIPT_20260922.json). No SQL/client/secret change or agent-paid call.
Owner reports warmer/better conversation; no universal dialogue-quality claim. See
pkg044/PKG044_CONTEXTUAL_INTAKE_QUESTIONS.md and receipt. Existing installed APK requires no replacement.

PKG-043 (2026-09-22, Edge deployed): owner phone attempt exposed Gemini400 INVALID_ARGUMENT on intake47.
Outgoing dialogue.questionKey enum contained an empty string; use NONE on wire and normalize at the
strict decoder boundary. Two regressions fail before/pass after; CI35701314667 sourcee2d34bda passes351
offline Edge tests plus25 existing disposable SQL/Auth/REST checks. Intake48 byte-verified, JWTtrue,
anonymous401; no SQL/client/credential change, ledger196. Owner retry yielded two SUCCEEDED receipts
and visible phone replies. Separate repetitive generic ASK wording is corrected in PKG-044; this is
not a conversation-quality sign-off. See pkg043/PKG043_GEMINI_QUESTION_SENTINEL.md.

PKG-042 (2026-09-22, proven and DEV applied): cancelled-Agreement read parity for Home, paged applications
and task relations; Home now consumes the owned validated attention aggregate with explicit unavailable
state and no inference fallback. Other preview reads remain full lists. Ledger196 =147 source +49 dev_alpha,
ready closure65980fce preserved atomically; exact candidate/body/authority readback matches. Proof35698097056
source dfa54206 passes25 SQL/Auth/REST/exact-client checks plus346 offline Edge tests. Types and full repeat
242 suites /4687 Jest tests pass, exit0; first run's Firebase subprocess timeout is documented, not hidden.
PKG-00435698097011 and PKG-00735698097030 pass. No Edge/JWT/certificate/user-row change or phone action.
APK35698097121 source dfa54206 built/downloaded; SHA2563dfddf49… and source/tree/attestations match.
Installed on the owner's USB phone on20260922 with adb install -r; installed SHA256 matches. Cold launch
and signed-in Home rendering observed. AI/provider and whole journey not tested by the agent. Receipt:
pkg042/DEVICE_INSTALLATION_RECEIPT_20260922.json. Latest continuation: `docs/implementation/NEXT_AI_HANDOFF_20260922_HOME_ATTENTION.md`.
Read `docs/implementation/v5-ai-first/pkg042/PKG042_HOME_READ_PARITY.md` and receipts. Do not claim complete
Home pagination, fewer preview fetches, release readiness or device verification from this package.

PKG-040 / PKG-041 (2026-09-22, proven and DEV applied/deployed): Q&A owned failure settlement,
independent bounded cleanup and native55s submit; intake guards contradictory literal relative-day
evidence without guessing dates from negation. Ledger195 =147 source +48 dev_alpha; closure65980fce
and readiness preserved atomically. Proof35677596411 passes17 SQL/Auth/REST checks and346 offline Edge
tests. Intake47 / worker17 / Q&A13 / publication14, JWTtrue; new deployments byte-verified. Types and
241 suites /4652 Jest tests pass. PKG-01035676936960 and PKG-014B35677260602 pass.
APK35677195929 sourceec3b3d43 built/downloaded: SHA2565568feb7… matches checksum, source and both
attestations. Not installed/tested. See pkg040/PKG040_QA_RECOVERY.md, pkg041/PKG041_RELATIVE_DAY_EVIDENCE.md
and docs/implementation/NEXT_AI_HANDOFF_20260922_AI_REPAIRS.md. Process-death/unknown-claim sweep grace,
real-provider semantic quality, daily/repeated-work decision and phone verification remain open.

PKG-039 (2026-09-22, proven and DEV applied): independent bounded failure settlement for intake/worker,
no paid replay and no overwrite of committed success. Interview provider30s / native send55s;
ordinary RPC15s and SQL leases unchanged. Proof35675491926:330 Edge tests /16 SQL checks including
both observed completion/failure lock orders. DEV ledger194; unchanged ready closure65980fce asserted
atomically; exact candidate/authority readback. Intake46 / worker17 byte-verified, JWTtrue. Types and
241 suites /4650 tests pass. APK35675580983 built, downloaded hash/source/attestations match;
not installed/tested. No device/provider-quality claim. See
`docs/implementation/v5-ai-first/pkg039/PKG039_INTERVIEW_RECOVERY.md` and receipts.
Q&A and the delayed process-crash sweep remain separate limits;11.1 is not wholly closed.

PKG-038 (2026-09-22, proven and DEV applied): AI dialogue action validation, finish handoff,
complete fact context, no-op filtering and delayed prose until owned completion. Full23-field review
cap is fixed. Ledger193; unchanged ready closure65980fce asserted atomically. Proof35674102419 passes
321 Edge tests /11 SQL checks. Intake v45 / worker v16 are byte-verified, JWTtrue. Native removes duplicate
historical fact decorations and treats UNKNOWN honestly:241 suites /4648 tests, types clean; build/device
pending. See `docs/implementation/v5-ai-first/pkg038/PKG038_CONVERSATION_SEMANTICS.md` and receipts.
No provider-quality claim: daily/repeated work decision, complex date semantics, long history and
interview timeout recovery remain open. Do not mark the whole semantic audit closed.

AI conversation semantic audit (2026-09-22, historical baseline):
`docs/implementation/v5-ai-first/ai-conversation-audit-20260922/REPORT.md` compares intended behavior,
current intake v44 / worker v15, 13 live SQL bodies and stored DEV dialogues. Repeated summaries and
questions after finish are observed; wrong relative dates, daily-price units and retained terms after
task changes are separate material findings. Eight offline diagnostics reproduce limitations; 123 existing
boundary tests pass. Neither establishes model quality or a fix. No DEV write/provider/device action;
ledger192. See the report before changing prompts or claiming the conversation is complete. Timeout
recovery11.1 and publication PKG-037 remain separate. Do not copy raw conversations into the repository.

PKG-037 (2026-09-22, proven and DEV applied): publication-only deep-read 11.2 recovery.
Separate preparation/provider/settlement deadlines, single settlement after a lost ACK, client 55-second
accepted-review wait and a bounded expired-review branch in the existing sweep. See
`docs/implementation/v5-ai-first/pkg037/PKG037_PUBLICATION_RECOVERY.md`. Local Edge 47/47, focused
client/native 80/80 and full Jest 241 suites / 4646 tests pass; types clean. Disposable proof35669180188
passes 18 checks on source2d6f0bc5. DEV ledger192; candidate text/body/ACL readback verified, certificate
65980fce… unchanged. Publication Edge v14 byte-equals proven source, verify_jwt=true; deployed with the
already cached CLI after a transient HTTP520. No credential read or paid call. APK35669226055 succeeded;
downloaded hash e47955fd… matches checksum and both source-bound attestations. No phone installed/tested.
Interview/worker/QA finding 11.1 remains separate and open. Finishing/growth
gates: `docs/implementation/APP_FINISHING_PLAN_20260922.md`.

PKG-036 (2026-09-22, client-only): first bounded slice of deep-read 7.1. Eleven live lifecycle RPCs and
ten selected guard/calendar bodies were read; exact MD5s and per-call comparison are under
`docs/implementation/v5-ai-first/pkg036/`. Task/Agreement refusal copy now survives screen/controller
handling. `AGREEMENT_CHANGE_INVALID_RECEIPT` is separate from rejected input and still requires recovery.
New regressions: 30 failed on former source, 34 pass after. Types clean; full local Jest
241 suites / 4644 passed and exited 0. CI PKG-004 `35661988323` and PKG-007 `35661988415` passed.
No DEV writes; ledger remains
191 at read-only preflight. No certificate/JWT/dependency/device change. 7.1 remains partial/open.
APK `35662001128`, source `0c01ac7b`, succeeded; downloaded SHA256 `b883d7a7…` matches checksum and
both recovery/icon attestations. See the package's `APK_RECEIPT_20260922.json`. Not installed/tested.
The baseline AI investigation is `docs/implementation/v5-ai-first/AI_DEADLINE_RECOVERY_INVESTIGATION_20260922.md`.
PKG-037 supersedes its publication reproducer; interview deadlines remain unresolved.

PKG-035 (2026-09-21, **proven and applied**): deep-read 7.32 now separates historical applications from
those currently selectable. Candidate list, owner computed field and Home aggregate share the classifier;
actual proposed interval and fixed-price rules match final selection. DEV ledger **191 = 147 + 44 dev_alpha**.
Proof `35658331088` passed 38 checks, including actual local Auth/PostgREST and Home overflow. Exact ledger
text/body/ACL readback matches. No user-data rewrite, certificate move or JWT change. Receipt:
`supabase/operations/dev-alpha/ledger/20260921_pkg035_application.receipt.json`; contract and proof:
`docs/implementation/v5-ai-first/pkg035/PKG035_SELECTABLE_APPLICATIONS.md`.
Client `62e90e92` passes types and 240 suites / 4606 tests; three new regressions fail before/pass after.
Home/cards/detail use the new count; historical totals remain accessible. New APK run `35657828926`
from `fe60a385` succeeded; downloaded APK hash `2afcefc1…` matches checksum/recovery/icon attestations.
See `docs/implementation/v5-ai-first/pkg035/APK_RECEIPT_20260921.json`. No phone installed/tested.
Older APK `35654417281` succeeded and its downloaded hash was verified, but does not contain PKG-035.
The full Home aggregate is still not wired; this fixes counts without claiming pagination/read reduction.
Remaining: 7.41, 7.17, 7.1, 11.1, 11.2, plus legal/phone decisions and device verification.
The foreign untracked frozen-folder SQL remains untouched; local inventory refuses it, tracked CI inventory passes.

PKG-034 (2026-09-21, **proven and applied**): closure preparation now projects the certified executor's hard
blockers into the existing five-code receipt contract (12.10). Ledger **190 = 147 + 43 dev_alpha**.
Run `35654209245` passed 25 checks; exact applied text/body verified. No certificate move, grant change,
existing-row rewrite or account deletion. Receipt:
`supabase/operations/dev-alpha/ledger/20260921_pkg034_application.receipt.json`.
Contract: `docs/implementation/v5-ai-first/pkg034/PKG034_CLOSURE_PREPARATION.md`.
7.41 legacy readiness flags and 8.18 recovery on another device remain open. Android build run
`35654417281` was dispatched on `d5e42242`; check its actual result before claiming an APK exists.

PKG-033 (2026-09-21, **proven and applied**): application admission parity for deep read 3.1 / 7.3 / 12.6.
Canonical DEV ledger is **189 = 147 + 42 dev_alpha**. Receipt:
`supabase/operations/dev-alpha/ledger/20260921_pkg033_application.receipt.json`.
Proof run `35651463755` passed 41 checks; the recorded migration text SHA-256 and all four resulting body
pins match the proof. The owner supplied the missing nonsecret closure preflight; the candidate asserted
the unchanged, ready certificate before committing. Direct private readback still returns 42501; do not
claim it was separately measured afterward. Client `b4d5a5a9` passes 240 suites / 4596 tests and types;
it has not been built into a new APK or tested on a phone. Scope:
`docs/implementation/v5-ai-first/pkg033/PKG033_APPLICATION_ADMISSION.md`.
Resume: `docs/implementation/NEXT_AI_HANDOFF_20260921_CODEX.md`. The foreign migration remains excluded.

**Start here (2026-09-21 21:45): `docs/implementation/NEXT_AI_HANDOFF_20260921_2145.md`.** It records the current
worktree, branch, canonical DEV state (ledger 188, certificate `65980fce…`), the owner's standing rules, everything
applied on 2026-09-21 (PKG-027 to PKG-032), the exact method for a DEV change, and where the work stopped. It
supersedes `NEXT_AI_HANDOFF_20260919_2100.md`. The paragraphs below remain the detailed record per package.

Latest visual clarification (2026-09-20): the supplied HTML is a starting direction, NOT a final
design or pixel lock. Refine hierarchy, layout, components, states and motion using product judgment;
preserve original brand/entry assets and actual business semantics. Read
`docs/implementation/v5-ai-first/DESIGN_PACK_EXECUTION_20260920.md` for the tools and next design round.
The owner explicitly requests the new direction. Read
`docs/implementation/v5-ai-first/HTML_DIRECTION_HOME_20260920.md` for the exact source
hashes, native adaptation and evidence. This supersedes preserving the previous authenticated Home
composition below; original brand/entry assets remain. This first Home/tab surface does not complete
the other screens, aggregate wiring or end-to-end device verification. Skills are implementation
guidance; they do not override the owner's latest visual direction.

CodeQL "Insecure randomness" (2026-09-21, owner-accepted as debt): the five `high` alerts have ONE
source, `src/lib/idempotencija.ts`, and the flagged files contain no `Math.random()` at all. The
fallback is the path that runs (RN 0.86.3 defines no `randomUUID`, no polyfill is installed), but the
value is a `clientRequestId` — an idempotency key behind RLS, not a secret — and the one failure mode
that would matter, a repeated PRNG sequence colliding two keys, is measured absent: 258 of 258
distinct, 0 shared prefixes, 0 malformed. The owner chose to merge and record rather than take a new
dependency. Full evidence and what would close it:
`docs/implementation/evidence/codeql-insecure-randomness-20260921/`. This accepts those six alerts
for that cause; a new alert is a new decision.

PKG-032 (2026-09-21, proven and **applied**, item 8 of the owner's "odobravam sve"): ledger now **188 = 147 + 41
dev_alpha**.
- `pkg032a` keeps the cancellation reason as the canceller's Agreement message (7.15).
- `pkg032b` makes the remaining-search guard null-safe (12.8). Because that guard is a trigger function, it also
  re-binds the certified closure source.
- **The certified digest is now `65980fce…`** in all three places, and the source is ready. Older paragraphs'
  `67730f62` is historical.
- A real account closed end to end on the new certificate in the proof.
- Contract: `docs/implementation/v5-ai-first/pkg032/PKG032_CANCEL_REASON_AND_GUARD.md`.

PKG-031 (2026-09-21, proven and **applied** on the owner's "odobravam sve" to ten numbered proposals): ledger then
**186 = 147 + 39 dev_alpha**.
- **Server:**
  - `pkg031a`: the requester cannot cancel after the worker says done (7.16).
  - `pkg031b`: `private.work_kinds_v5`, the hidden list of eleven kinds of work used only by matching, for
    exclusions and skills (9.2/9.3). No stored row changed.
- **App, in git and not yet in an installed build:**
  - agreed times in Serbian time with "po vremenu u Srbiji" (8.27);
  - no category shown to people;
  - sign-up says the legal documents are not published yet, instead of a tick that recorded nothing (8.2);
  - no "Izmene i otkazivanje" for the requester after done.
- Contract: `docs/implementation/v5-ai-first/pkg031/PKG031_OWNER_RULES.md`.

PKG-030 (2026-09-21, proven and **applied**; owner "kreni" to option A, then "odobravam sve"): ledger then
**184 = 147 + 37 dev_alpha**.

On DEV the Edge `SUPABASE_SERVICE_ROLE_KEY` is a secret key (`sb_secret_`), so the legacy key the owner stored could
never reach the workers. What changed:
- The workers now take the server key on `apikey`.
- The tick (`pkg030a`) sends it there.
- `uskoci-push-transport` v14, `uskoci-data-export-worker` v14 and `uskoci-account-closure-worker` v3 run with
  `verify_jwt = false` and check the key themselves.
- `uskoci-data-export-download` v14 keeps `verify_jwt = true`.
- All four are byte-identical on readback. Without a key, each worker refuses by itself.
- **Done 2026-09-21:** the owner stored the secret key. Push answers `DISABLED` (its switch is off), export answers
  `TICK_COMPLETED`, closure answers `MAINTENANCE_CHECKED` (its switch is on), and the minute tick answers `TICKED`.

Contract, status and receipt: `docs/implementation/v5-ai-first/pkg030/PKG030_WORKERS_SECRET_KEY.md`. The PKG-028
paragraph's key instruction is corrected there.

PKG-029 (2026-09-21, proven and **applied** on the owner's "dozvoljavam sve" to the written command): ledger then
**183 = 147 + 36 dev_alpha**. It covers 4.1, 1.2, 12.9, 1.1, 7.49, 12.7, 7.47, 12.5, 6.2, 12.11 and the relative
schedules ("danas"/"sutra"/"ove nedelje" now expire).
- **Temporary:** `pkg029e` puts the owner's accounts in the TEST world while testing. Take it out before real users.
- Contract: `docs/implementation/v5-ai-first/pkg029/PKG029_SERVER_ROUND.md`, including what is deliberately not in
  this round (7.15, 3.1/12.6, 7.16, 8.27, 9.2/9.3, 11.1/11.2, 12.8, 12.10, 8.2).
- The ledger count in the PKG-028 paragraph below is historical.

PKG-028 (2026-09-21, proven and **applied** on the owner's "kreni" to the written plan; ledger was then **178 = 147 + 31**): `pkg028a` runs the three Edge workers from a minute tick
(pg_net + a Vault key the owner stores), which makes account deletion (6.1), export (4.2) and push actually run.
`pkg028b` expires fixed-time tasks whose window is over and refuses publishing a past start (5.1). The disposable
proof passed (run 35602743935). The tick sends nothing until the owner stores the key and sets
`USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED` (receipt `20260921_pkg028_application.receipt.json`). Read
`docs/implementation/v5-ai-first/pkg028/PKG028_WORKERS_AND_PAST_TASKS.md`. The client side of 8.10 and 5.1 is in
git, but not in any installed build.

PKG-027 (2026-09-21, owner-approved and applied): the deep read
(`docs/implementation/v5-ai-first/DEEP_READ_LEDGER_20260921.md`) found real server defects. The owner
approved this round with "odobravam sve to". Contract, proof and application:
`docs/implementation/v5-ai-first/pkg027/PKG027_OWNER_APPROVED_FIXES.md`. The disposable proof passed
(run 35594168645). Five candidates are applied to canonical DEV, each byte-identical to its file:
- `pkg027a`: a task keeps being offered to workers;
- `pkg027b`: stuck AI turns are failed by the tick;
- `pkg027c`: notifications use "ti", including the stored ones;
- `pkg027d`: no invented profile headline or bio;
- `pkg027e`: the price basis survives an edit.

The push text is deployed as Edge `uskoci-push-transport` v12, byte-identical on readback. Canonical DEV
ledger was then **176 = 147 frozen source + 29 dev_alpha** (current count: PKG-028 paragraph above). Digest `67730f62` live = certified, and
`retention_ai_source_ready()` is true. Receipt:
`supabase/operations/dev-alpha/ledger/20260921_pkg027_application.receipt.json`.

**Not approved** by that answer, and each needs its own decision. *(Historical: 7.47, 12.5, 12.7, 12.9 and 12.11 were
later approved and applied in PKG-029; 3.1, 11.1, 12.8 and 12.10 remain open.)*
- the stale-application price door (3.1);
- Q&A statuses (7.47);
- the phone filter (12.5);
- remote/physical execution mode (12.7);
- 12.8, 12.9, 12.10;
- the AI 12-second ceiling (11.1);
- the owner's real tasks being invisible to test workers (12.11).

No device pass has been done.

Price basis (2026-09-20, owner-approved and applied): a task can say what its price is FOR, and an
application is priced by it. Read `docs/implementation/v5-ai-first/pkg025/PKG025A_PRICE_BASIS.md`.
The owner authorized this chain explicitly on 2026-09-20 ("sve dozvoljavam", "Cena", "ajde kreni",
"primeni pkg025d"), which **supersedes** the earlier sentence below withholding `price_basis`.
Applied to canonical DEV: `pkg025a` (the column and its CHECK), `pkg025b` (`rpc_submit_response`
prices an application by the basis), `pkg025c` (the bounded marketplace reader returns it), and
`pkg025d` (the `need.price_basis` fact key, its TOTAL/PER_PERSON rule, and the write in both review
writers). Canonical DEV ledger was then **171 = 147 frozen source + 24 dev_alpha** (current count:
PKG-027 paragraph above), digest `67730f62`
live = certified, `retention_ai_source_ready()` true, confirmed by readback. All 18 tasks keep a null
basis, so nothing existing changed. The Edge function was deployed by the owner the same day
(version 42, all four assets byte-identical on readback, `OPTIONS` 200, `verify_jwt` unchanged), so
the AI can now ask "ukupno ili po osobi". **Still open:** no device pass, and the house
disposable-database proof was not run. The material
list / fingerprint / edit-history step remains its own package; it is not a precondition, for the
reason recorded in that document.

Latest follow-up (2026-09-20 local): after the three mandatory handoff/owner-decision/AGENTS reads,
read `docs/implementation/v5-ai-first/pkg023/PKG023J_HOME_ATTENTION.md`. The owner separately approved
ONLY pkg023j, conditional on ready private preconditions. Its exact CI-proven transaction passed both
private checks before/after creation and was applied as `20260919221214_dev_alpha_pkg023j_home_attention`.
Canonical DEV ledger was **165 = 147 frozen source + 18 dev_alpha** at that moment; see the PKG-027
paragraph above for the current count. The aggregate is installed but not wired into the client. F02,
paging, final UI and device verification remain open. Other DEV migrations still need a separate
explicit owner decision; the older general AF-D26 authorization below does not override that newer
boundary. **No pkg023c activation is authorized.** The sentence that also withheld `price_basis` is
**superseded** by the owner's explicit approvals of 2026-09-20 recorded above — do not read it as a
current block. The historical handoff's counts are not current live counts.

Latest client follow-up: read `docs/implementation/v5-ai-first/APPLICATION_COMMAND_RECONCILIATION_20260920.md`.
My applications now reconciles a pending command against its exact owned response row, independently
of the displayed list. It remains unpaged; this does not complete Home wiring, notification paging
or a device proof. No additional DEV migration was needed or applied for this client correction.

Later local follow-up (2026-09-19): after the mandatory handoff/owner-decision reading below, read
`docs/implementation/v5-ai-first/CLIENT_RELIABILITY_20260919.md` for the F01/F07/F08 client corrections
and their exact verification scope. They do not authorize canonical DEV writes or close pkg023j.

**Historical (2026-09-19; superseded by the 2026-09-21 handoff at the top): `docs/implementation/NEXT_AI_HANDOFF_20260919_2100.md`.** It was the
handoff of that day: where the work stopped, every file touched and what each one is for, the owner's standing rules,
the six migrations applied to canonical DEV that day, and the next piece of work stated exactly. It
supersedes `NEXT_AI_HANDOFF_20260911_0504.md` and its manifest, which record a SAFE STOP that was lifted.

Current entry (PKG-012, 2026-09-16): read `docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md`
first. It names the one current authority chain (reconciliation, Execution Ledger, owner
decisions, PKG-011B design system) and marks every older checkpoint historical.

Current resume: owner explicitly requested V5 AI-FIRST implementation on 2026-09-12.
Read `docs/implementation/v5-ai-first/OWNER_PRIVATE_TEST_DECISIONS_20260913.md`
first: latest AF-D26 authorizes verified backend promotion on canonical
DEV/ALPHA `leqcwgzvjsxugfgzdmth` for the connected private APK. Do not create
extra staging or reset donor labs. A distinct future production project remains
outside this authorization. Then read `docs/implementation/v5-ai-first/EXECUTION.md` for the active package,
known AF-01–AF-06 decisions and current work. This supersedes the historical SAFE
STOP and older auth/per-fact UX locks below. The existing CLEAN authority,
integration branch and private boundaries remain. AF-D26 authorizes verified
canonical DEV/ALPHA changes; the separate production gate remains.

Owner persistent skill selection (2026-09-13): read
`docs/implementation/v5-ai-first/DESIGN_SKILLS.md` and apply its nine locally
installed design/native skills to relevant USKOČI work. User/V5 decisions win
over skill examples; preserve the original entry/mascot/motion/HOME.

This is an existing Expo/React Native marketplace with Supabase authority. Do not restart it or create another product master.

Read in this order:

1. `docs/authority/AUTHORITY_INDEX.md`: newest owner commands, final21/21 review, complete50-row reconciliation and explicit supersessions. Latest explicit owner decision wins. Never turn a historical proposal into approval.
2. `HANDOFF.md`, the top checkpoints of `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, `CURRENT_IMPLEMENTATION_STATUS.md`, `IMPLEMENTATION_CONTINUITY.md`, then the linked latest `NEXT_AI_HANDOFF_*.md` and `NEXT_AI_HANDOFF_MANIFEST.json`. Physically read Git/CI/live metadata; actual newer state wins implementation facts.
3. Product/architecture sources named in the authority index. CLEAN/Supabase owns business rules; keep existing RPC/RLS/revision/idempotency boundaries.
4. Active V5 visual authority is the supplied sibling `USKOCI_V5_AI_FIRST_PAKET/07_REFERENCA/USKOCI_SPOJ_V4_9_COMPOSITION.html`, preserved in `01_HTML/USKOCI_V5_AI_FIRST.html`, together with the full V5 command. Preserve its entry composition, original photographs/SVG notes, mascot, timing and HOME signature. The older repository SPOJ V2/referenceEntry donors do not override V4.9. Use true RN/SVG and original assets, without a WebView or the HTML demo runtime. See `docs/implementation/v5-ai-first/NATIVE_CHECKPOINT138_REVIEW.md` for the discovered older native composition and the pending V4.9 correction.
5. Legal/policy sources, the supplied RC2 package and current V5 owner decisions. RC2 content has been received; AF-D22 supersedes the old retention proposal. Follow the documented adaptation and exact executable readiness, without inventing operator details, legal certification or retention periods. Old missing-package requests are historical.
6. `docs/authority/sources/closure-plan/USKOCI_RADNI_PAKETI.json` and current owner execution command: W03–W13 scope, current cursor and parent flows. Old package physical status is historical.
7. Existing proof/evidence only for the affected risk; exact run/source scope matters.

Root is the sole integrator/live writer. Isolate subagent file ownership. Reuse existing code. Targeted checks during development; full regression/migration/security/CodeQL/device gates at major integration, complete vertical journey or release candidate. No secrets in client/repository/logs/tests. Do not request passwords/JWT.

Migrations are forward-only; never rewrite an applied migration. Keep quarantine branch `repair/ru0-ru1-backend-20260902` isolated: never merge, cherry-pick or apply it. Preserve existing Auth/RLS/concurrency and controlled live preflight/postflight gates.

The earlier owner SAFE STOP is superseded by the active V5 resume and AF-D26 promotion decision above. The previous long AGENTS is preserved, **HISTORICAL**, at `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md`. It is not the active reading order or cursor.
